/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shared utility functions.

/* eslint-env node */

function warnForPath(inputFile, path, message) {
  const loc = path.node.loc;
  console.log(
    `WARNING: ${inputFile}:${loc.start.line}:${loc.start.column} : ${message}`
  );
}

// Get the previous statement of `path.node` in `Program`.
function getPrevStatement(path) {
  const parent = path.parent;
  if (parent.node.type !== "Program") {
    return null;
  }

  const index = parent.node.body.findIndex(n => n == path.node);
  if (index === -1) {
    return null;
  }

  if (index === 0) {
    return null;
  }

  return parent.node.body[index - 1];
}

// Get the next statement of `path.node` in `Program`.
function getNextStatement(path) {
  const parent = path.parent;
  if (parent.node.type !== "Program") {
    return null;
  }

  const index = parent.node.body.findIndex(n => n == path.node);
  if (index === -1) {
    return null;
  }

  if (index + 1 == parent.node.body.length) {
    return null;
  }

  return parent.node.body[index + 1];
}

function isIdentifier(node, name) {
  if (node.type !== "Identifier") {
    return false;
  }
  if (node.name !== name) {
    return false;
  }
  return true;
}

function isString(node) {
  return node.type === "Literal" && typeof node.value === "string";
}

const jsmExtPattern = /\.(jsm|js|jsm\.js)$/;

function esmifyExtension(path) {
  return path.replace(jsmExtPattern, ".sys.mjs");
}

// Given possible member expression, return the list of Identifier nodes in
// the source order.
//
// Returns an empty array if:
//   * not a simple MemberExpression tree with Identifiers
//   * there's computed property
function memberExpressionsToIdentifiers(memberExpr) {
  let ids = [];

  function f(node) {
    if (node.type !== "MemberExpression" || node.computed) {
      return false;
    }

    if (node.object.type === "Identifier") {
      ids.push(node.object);
      ids.push(node.property);
      return true;
    }

    if (!f(node.object)) {
      return false;
    }
    ids.push(node.property);
    return true;
  }

  if (!f(memberExpr)) {
    return [];
  }

  return ids;
}

// Returns true if the node is a simple MemberExpression tree with Identifiers
// matches expectedIDs.
function isMemberExpressionWithIdentifiers(node, expectedIDs) {
  const actualIDs = memberExpressionsToIdentifiers(node);
  if (actualIDs.length !== expectedIDs.length) {
    return false;
  }

  for (let i = 0; i < expectedIDs.length; i++) {
    if (actualIDs[i].name !== expectedIDs[i]) {
      return false;
    }
  }

  return true;
}

// Rewrite the Identifiers of MemberExpression tree to toIDs.
// `node` must be a simple MemberExpression tree with Identifiers, and
// the length of Identifiers should match.
function rewriteMemberExpressionWithIdentifiers(node, toIDs) {
  const actualIDs = memberExpressionsToIdentifiers(node);
  for (let i = 0; i < toIDs.length; i++) {
    actualIDs[i].name = toIDs[i];
  }
}

// Create a simple MemberExpression tree with given Identifiers.
function createMemberExpressionWithIdentifiers(jscodeshift, ids) {
  if (ids.length < 2) {
    throw new Error("Unexpected length of ids for member expression");
  }

  if (ids.length > 2) {
    return jscodeshift.memberExpression(
      createMemberExpressionWithIdentifiers(jscodeshift, ids.slice(0, -1)),
      jscodeshift.identifier(ids[ids.length - 1])
    );
  }

  return jscodeshift.memberExpression(
    jscodeshift.identifier(ids[0]),
    jscodeshift.identifier(ids[1])
  );
}

exports.warnForPath = warnForPath;
exports.getPrevStatement = getPrevStatement;
exports.getNextStatement = getNextStatement;
exports.isIdentifier = isIdentifier;
exports.isString = isString;
exports.jsmExtPattern = jsmExtPattern;
exports.esmifyExtension = esmifyExtension;
exports.isMemberExpressionWithIdentifiers = isMemberExpressionWithIdentifiers;
exports.rewriteMemberExpressionWithIdentifiers =
  rewriteMemberExpressionWithIdentifiers;
exports.createMemberExpressionWithIdentifiers =
  createMemberExpressionWithIdentifiers;
