/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env node */

const _path = require("path");
const { getESMFiles } = require(_path.resolve(__dirname, "./is-esmified.js"));
const {
  esmifyExtension,
  isString,
  warnForPath,
  isMemberExpressionWithIdentifiers,
} = require(_path.resolve(__dirname, "./utils.js"));

function isTargetESM(resourceURI) {
  if ("ESMIFY_TARGET_PREFIX" in process.env) {
    const files = getESMFiles(resourceURI);
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

function isImportESModuleCall(node) {
  return isMemberExpressionWithIdentifiers(node.callee, [
    "ChromeUtils",
    "importESModule",
  ]);
}

// Replace `ChromeUtils.import`, `Cu.import`, and `ChromeUtils.importESModule`
// with static import if it's at the top-level of system ESM file.
function tryReplacingWithStaticImport(
  jscodeshift,
  inputFile,
  path,
  resourceURINode,
  alwaysReplace
) {
  if (!alwaysReplace && !inputFile.endsWith(".mjs")) {
    // Static import is available only in system ESM.
    return false;
  }

  // Check if it's at the top-level.
  if (path.parent.node.type !== "VariableDeclarator") {
    return false;
  }

  if (path.parent.parent.node.type !== "VariableDeclaration") {
    return false;
  }

  const decls = path.parent.parent.node;
  if (decls.declarations.length !== 1) {
    return false;
  }

  if (path.parent.parent.parent.node.type !== "Program") {
    return false;
  }

  if (path.node.arguments.length !== 1) {
    return false;
  }

  const resourceURI = resourceURINode.value;

  // Collect imported symbols.
  const specs = [];
  if (path.parent.node.id.type === "Identifier") {
    specs.push(jscodeshift.importNamespaceSpecifier(path.parent.node.id));
  } else if (path.parent.node.id.type === "ObjectPattern") {
    for (const prop of path.parent.node.id.properties) {
      if (prop.shorthand) {
        specs.push(jscodeshift.importSpecifier(prop.key));
      } else if (prop.value.type === "Identifier") {
        specs.push(jscodeshift.importSpecifier(prop.key, prop.value));
      } else {
        return false;
      }
    }
  } else {
    return false;
  }

  // If this is `ChromeUtils.import` or `Cu.import`, replace the extension.
  // no-op for `ChromeUtils.importESModule`.
  resourceURINode.value = esmifyExtension(resourceURI);

  const e = jscodeshift.importDeclaration(specs, resourceURINode);
  e.comments = path.parent.parent.node.comments;
  path.parent.parent.node.comments = [];
  path.parent.parent.replace(e);

  return true;
}

function replaceImportESModuleCall(
  inputFile,
  jscodeshift,
  path,
  alwaysReplace
) {
  if (path.node.arguments.length !== 1) {
    warnForPath(
      inputFile,
      path,
      `importESModule call should have only one argument`
    );
    return;
  }

  const resourceURINode = path.node.arguments[0];
  if (!isString(resourceURINode)) {
    warnForPath(inputFile, path, `resource URI should be a string`);
    return;
  }

  if (!alwaysReplace) {
    const resourceURI = resourceURINode.value;
    if (!isTargetESM(resourceURI)) {
      return;
    }
  }

  // If this cannot be replaced with static import, do nothing.
  tryReplacingWithStaticImport(
    jscodeshift,
    inputFile,
    path,
    resourceURINode,
    alwaysReplace
  );
}

exports.isImportESModuleCall = isImportESModuleCall;
exports.tryReplacingWithStaticImport = tryReplacingWithStaticImport;
exports.replaceImportESModuleCall = replaceImportESModuleCall;
