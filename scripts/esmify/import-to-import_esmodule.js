/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// jscodeshift rule to replace import calls for JSM with import calls for ESM
// or static import for ESM.

/* eslint-env node */

const _path = require("path");
const { isESMified } = require(_path.resolve(__dirname, "./is-esmified.js"));
const {
  jsmExtPattern,
  esmifyExtension,
  isIdentifier,
  isString,
  warnForPath,
  getPrevStatement,
  getNextStatement,
  isMemberExpressionWithIdentifiers,
  rewriteMemberExpressionWithIdentifiers,
  createMemberExpressionWithIdentifiers,
} = require(_path.resolve(__dirname, "./utils.js"));
const {
  isImportESModuleCall,
  replaceImportESModuleCall,
  tryReplacingWithStaticImport,
} = require(_path.resolve(__dirname, "./static-import.js"));

module.exports = function (fileInfo, api) {
  const { jscodeshift } = api;
  const root = jscodeshift(fileInfo.source);
  doTranslate(fileInfo.path, jscodeshift, root);
  return root.toSource({ lineTerminator: "\n" });
};

module.exports.doTranslate = doTranslate;

function isESMifiedAndTarget(resourceURI) {
  const files = [];
  if (!isESMified(resourceURI, files)) {
    return false;
  }

  if ("ESMIFY_TARGET_PREFIX" in process.env) {
    const targetPrefix = process.env.ESMIFY_TARGET_PREFIX;
    for (const esm of files) {
      if (esm.startsWith(targetPrefix)) {
        return true;
      }
    }

    return false;
  }

  return true;
}

const importCalls = [
  {
    from: ["Cu", "import"],
    to: ["ChromeUtils", "importESModule"],
  },
  {
    from: ["Components", "utils", "import"],
    to: ["ChromeUtils", "importESModule"],
  },
  {
    from: ["ChromeUtils", "import"],
    to: ["ChromeUtils", "importESModule"],
  },
  {
    from: ["SpecialPowers", "ChromeUtils", "import"],
    to: ["SpecialPowers", "ChromeUtils", "importESModule"],
  },
];

const singleLazyGetterCalls = [
  {
    from: ["XPCOMUtils", "defineLazyModuleGetter"],
    to: ["ChromeUtils", "defineESModuleGetters"],
  },
  {
    from: ["ChromeUtils", "defineModuleGetter"],
    to: ["ChromeUtils", "defineESModuleGetters"],
  },
  {
    from: ["SpecialPowers", "ChromeUtils", "defineModuleGetter"],
    to: ["SpecialPowers", "ChromeUtils", "defineESModuleGetters"],
  },
];

const multiLazyGettersCalls = [
  {
    from: ["XPCOMUtils", "defineLazyModuleGetters"],
    to: ["ChromeUtils", "defineESModuleGetters"],
  },
];

function isMemberExpressionMatchingPatterns(node, patterns) {
  for (const item of patterns) {
    if (isMemberExpressionWithIdentifiers(node, item.from)) {
      return item;
    }
  }

  return null;
}

function replaceImportCall(inputFile, jscodeshift, path, rewriteItem) {
  if (path.node.arguments.length !== 1) {
    warnForPath(inputFile, path, `import call should have only one argument`);
    return;
  }

  const resourceURINode = path.node.arguments[0];
  if (!isString(resourceURINode)) {
    warnForPath(inputFile, path, `resource URI should be a string`);
    return;
  }

  const resourceURI = resourceURINode.value;
  if (!resourceURI.match(jsmExtPattern)) {
    warnForPath(inputFile, path, `Non-jsm: ${resourceURI}`);
    return;
  }

  if (!isESMifiedAndTarget(resourceURI)) {
    return;
  }

  if (
    !tryReplacingWithStaticImport(
      jscodeshift,
      inputFile,
      path,
      resourceURINode,
      false
    )
  ) {
    rewriteMemberExpressionWithIdentifiers(path.node.callee, rewriteItem.to);
    resourceURINode.value = esmifyExtension(resourceURI);
  }
}

// Find `ChromeUtils.defineESModuleGetters` or variant statement specified by
// expectedIDs, adjacent to `path` which uses the same target object.
function findDefineESModuleGettersStmt(path, expectedIDs) {
  // `path` must be top-level.
  if (path.parent.node.type !== "ExpressionStatement") {
    return null;
  }

  if (path.parent.parent.node.type !== "Program") {
    return null;
  }

  // Get previous or next statement with ChromeUtils.defineESModuleGetters.
  let callStmt;
  const prev = getPrevStatement(path.parent);
  if (
    prev &&
    prev.type === "ExpressionStatement" &&
    prev.expression.type === "CallExpression" &&
    isMemberExpressionWithIdentifiers(prev.expression.callee, expectedIDs)
  ) {
    callStmt = prev;
  } else {
    const next = getNextStatement(path.parent);
    if (
      next &&
      next.type === "ExpressionStatement" &&
      next.expression.type === "CallExpression" &&
      isMemberExpressionWithIdentifiers(next.expression.callee, expectedIDs)
    ) {
      callStmt = next;
    } else {
      return null;
    }
  }

  const call = callStmt.expression;

  if (call.arguments.length !== 2) {
    return null;
  }

  const modulesNode = call.arguments[1];
  if (modulesNode.type !== "ObjectExpression") {
    return null;
  }

  // Check if the target object is same.
  if (
    path.node.arguments[0].type === "ThisExpression" &&
    call.arguments[0].type === "ThisExpression"
  ) {
    return callStmt;
  }

  if (
    path.node.arguments[0].type === "Identifier" &&
    call.arguments[0].type === "Identifier" &&
    path.node.arguments[0].name === call.arguments[0].name
  ) {
    return callStmt;
  }

  return null;
}

function getPropKeyString(prop) {
  if (prop.key.type === "Identifier") {
    return prop.key.name;
  }

  if (prop.key.type === "Literal") {
    return prop.key.value.toString();
  }

  return "";
}

function sortProps(obj) {
  obj.properties.sort((a, b) => {
    return getPropKeyString(a) < getPropKeyString(b) ? -1 : 1;
  });
}

// Move comments above `nodeFrom` before `nodeTo`.
function moveComments(nodeTo, nodeFrom) {
  if (!nodeFrom.comments) {
    return;
  }
  if (nodeTo.comments) {
    nodeTo.comments = [...nodeTo.comments, ...nodeFrom.comments];
  } else {
    nodeTo.comments = nodeFrom.comments;
  }
  nodeFrom.comments = [];
}

function replaceLazyGetterCall(inputFile, jscodeshift, path, rewriteItem) {
  if (path.node.arguments.length !== 3) {
    warnForPath(inputFile, path, `lazy getter call should have 3 arguments`);
    return;
  }

  const nameNode = path.node.arguments[1];
  if (!isString(nameNode)) {
    warnForPath(inputFile, path, `name should be a string`);
    return;
  }

  const resourceURINode = path.node.arguments[2];
  if (!isString(resourceURINode)) {
    warnForPath(inputFile, path, `resource URI should be a string`);
    return;
  }

  const resourceURI = resourceURINode.value;
  if (!resourceURI.match(jsmExtPattern)) {
    warnForPath(inputFile, path, `Non-js/jsm: ${resourceURI}`);
    return;
  }

  if (!isESMifiedAndTarget(resourceURI)) {
    return;
  }

  resourceURINode.value = esmifyExtension(resourceURI);
  const prop = jscodeshift.property(
    "init",
    jscodeshift.identifier(nameNode.value),
    resourceURINode
  );

  const callStmt = findDefineESModuleGettersStmt(path, rewriteItem.to);
  if (callStmt) {
    // Move a property to existing ChromeUtils.defineESModuleGetters call.

    moveComments(callStmt, path.parent.node);
    path.parent.prune();

    callStmt.expression.arguments[1].properties.push(prop);
    sortProps(callStmt.expression.arguments[1]);
  } else {
    // Convert this call into ChromeUtils.defineESModuleGetters.

    rewriteMemberExpressionWithIdentifiers(path.node.callee, rewriteItem.to);
    path.node.arguments = [
      path.node.arguments[0],
      jscodeshift.objectExpression([prop]),
    ];
  }
}

function replaceLazyGettersCall(inputFile, jscodeshift, path, rewriteItem) {
  if (path.node.arguments.length !== 2) {
    warnForPath(inputFile, path, `lazy getters call should have 2 arguments`);
    return;
  }

  const modulesNode = path.node.arguments[1];
  if (modulesNode.type !== "ObjectExpression") {
    warnForPath(inputFile, path, `modules parameter should be an object`);
    return;
  }

  const esmProps = [];
  const jsmProps = [];

  for (const prop of modulesNode.properties) {
    const resourceURINode = prop.value;
    if (!isString(resourceURINode)) {
      warnForPath(inputFile, path, `resource URI should be a string`);
      jsmProps.push(prop);
      continue;
    }

    const resourceURI = resourceURINode.value;
    if (!resourceURI.match(jsmExtPattern)) {
      warnForPath(inputFile, path, `Non-js/jsm: ${resourceURI}`);
      jsmProps.push(prop);
      continue;
    }

    if (!isESMifiedAndTarget(resourceURI)) {
      jsmProps.push(prop);
      continue;
    }

    esmProps.push(prop);
  }

  if (esmProps.length === 0) {
    return;
  }

  let callStmt = findDefineESModuleGettersStmt(path, rewriteItem.to);
  if (jsmProps.length === 0) {
    if (callStmt) {
      // Move all properties to existing ChromeUtils.defineESModuleGetters call.

      moveComments(callStmt, path.parent.node);
      path.parent.prune();

      for (const prop of esmProps) {
        const resourceURINode = prop.value;
        resourceURINode.value = esmifyExtension(resourceURINode.value);
        callStmt.expression.arguments[1].properties.push(prop);
      }
      sortProps(callStmt.expression.arguments[1]);
    } else {
      // Convert this call into ChromeUtils.defineESModuleGetters.

      rewriteMemberExpressionWithIdentifiers(path.node.callee, rewriteItem.to);
      for (const prop of esmProps) {
        const resourceURINode = prop.value;
        resourceURINode.value = esmifyExtension(resourceURINode.value);
      }
    }
  } else {
    // Move some properties to ChromeUtils.defineESModuleGetters.

    if (path.parent.node.type !== "ExpressionStatement") {
      warnForPath(inputFile, path, `lazy getters call in unexpected context`);
      return;
    }

    if (!callStmt) {
      callStmt = jscodeshift.expressionStatement(
        jscodeshift.callExpression(
          createMemberExpressionWithIdentifiers(jscodeshift, rewriteItem.to),
          [path.node.arguments[0], jscodeshift.objectExpression([])]
        )
      );
      path.parent.insertBefore(callStmt);
    }

    moveComments(callStmt, path.parent.node);

    for (const prop of esmProps) {
      const resourceURINode = prop.value;
      resourceURINode.value = esmifyExtension(resourceURINode.value);
      callStmt.expression.arguments[1].properties.push(prop);
    }
    sortProps(callStmt.expression.arguments[1]);

    path.node.arguments[1].properties = jsmProps;
  }
}

function getProp(obj, key) {
  if (obj.type !== "ObjectExpression") {
    return null;
  }

  for (const prop of obj.properties) {
    if (prop.computed) {
      continue;
    }

    if (!prop.key) {
      continue;
    }

    if (isIdentifier(prop.key, key)) {
      return prop;
    }
  }

  return null;
}

function tryReplaceActorDefinition(inputFile, path, name) {
  const obj = path.node;

  const prop = getProp(obj, name);
  if (!prop) {
    return;
  }

  const moduleURIProp = getProp(prop.value, "moduleURI");
  if (!moduleURIProp) {
    return;
  }

  if (!isString(moduleURIProp.value)) {
    warnForPath(inputFile, path, `${name} moduleURI should be a string`);
    return;
  }

  const moduleURI = moduleURIProp.value.value;
  if (!moduleURI.match(jsmExtPattern)) {
    warnForPath(inputFile, path, `${name} Non-js/jsm: ${moduleURI}`);
    return;
  }

  if (!isESMifiedAndTarget(moduleURI)) {
    return;
  }

  moduleURIProp.key.name = "esModuleURI";
  moduleURIProp.value.value = esmifyExtension(moduleURI);
}

function doTranslate(inputFile, jscodeshift, root) {
  root.find(jscodeshift.CallExpression).forEach(path => {
    if (isImportESModuleCall(path.node)) {
      replaceImportESModuleCall(inputFile, jscodeshift, path, false);
      return;
    }

    const callee = path.node.callee;

    let item;
    item = isMemberExpressionMatchingPatterns(callee, importCalls);
    if (item) {
      replaceImportCall(inputFile, jscodeshift, path, item);
      return;
    }

    item = isMemberExpressionMatchingPatterns(callee, singleLazyGetterCalls);
    if (item) {
      replaceLazyGetterCall(inputFile, jscodeshift, path, item);
      return;
    }

    item = isMemberExpressionMatchingPatterns(callee, multiLazyGettersCalls);
    if (item) {
      replaceLazyGettersCall(inputFile, jscodeshift, path, item);
    }
  });

  root.find(jscodeshift.ObjectExpression).forEach(path => {
    tryReplaceActorDefinition(inputFile, path, "parent");
    tryReplaceActorDefinition(inputFile, path, "child");
  });
}
