/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// A utility to check if given JSM is already ESM-ified.

/* eslint-env node */

const fs = require("fs");
const _path = require("path");
const { esmifyExtension } = require(_path.resolve(__dirname, "./utils.js"));

let json_map;
if (process.env.ESMIFY_MAP_JSON) {
  json_map = _path.resolve(process.env.ESMIFY_MAP_JSON);
} else {
  json_map = _path.resolve(__dirname, "./map.json");
}
const uri_map = JSON.parse(fs.readFileSync(json_map));
const esm_uri_map = generateESMURIMap(uri_map);

function generateESMURIMap(jsm_map) {
  const esm_map = {};

  for (let [uri, jsms] of Object.entries(jsm_map)) {
    if (typeof jsms === "string") {
      jsms = [jsms];
    }
    esm_map[esmifyExtension(uri)] = jsms.map(esmifyExtension);
  }

  return esm_map;
}

function isESMifiedSlow(resourceURI) {
  if (!(resourceURI in uri_map)) {
    console.log(`WARNING: Unknown module: ${resourceURI}`);
    return { result: false, jsms: [] };
  }

  let jsms = uri_map[resourceURI];
  if (typeof jsms === "string") {
    jsms = [jsms];
  }

  const prefix = "../../";
  for (const jsm of jsms) {
    if (fs.existsSync(prefix + jsm)) {
      return { result: false, jsms };
    }
    const esm = esmifyExtension(jsm);
    if (!fs.existsSync(prefix + esm)) {
      return { result: false, jsms };
    }
  }

  return { result: true, jsms };
}

const isESMified_memo = {};
function isESMified(resourceURI, files) {
  if (!(resourceURI in isESMified_memo)) {
    isESMified_memo[resourceURI] = isESMifiedSlow(resourceURI);
  }

  for (const jsm of isESMified_memo[resourceURI].jsms) {
    files.push(esmifyExtension(jsm));
  }

  return isESMified_memo[resourceURI].result;
}

function getESMFiles(resourceURI) {
  if (resourceURI in esm_uri_map) {
    return esm_uri_map[resourceURI];
  }
  return [];
}

exports.isESMified = isESMified;
exports.getESMFiles = getESMFiles;
