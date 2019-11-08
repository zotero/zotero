/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

;((factory) => { // Module boilerplate :(
  if (typeof(require) === 'function') { // CommonJS
    require("chrome").Cu.import(module.uri, exports);
  }
  else if (typeof Components != 'undefined') { // JSM
    let module = { uri: __URI__, id: "toolkit/loader", exports: Object.create(null) }
    factory(module);
    Object.assign(this, module.exports);
    this.EXPORTED_SYMBOLS = Object.getOwnPropertyNames(module.exports);
  }
  else {
    throw Error("Loading environment is not supported");
  }
})(module => {

'use strict';

module.metadata = {
  "stability": "unstable"
};

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();
const { loadSubScript } = Cc['@mozilla.org/moz/jssubscript-loader;1'].
                     getService(Ci.mozIJSSubScriptLoader);
const { addObserver, notifyObservers } = Cc['@mozilla.org/observer-service;1'].
                        getService(Ci.nsIObserverService);
const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});
const { NetUtil } = Cu.import("resource://gre/modules/NetUtil.jsm", {});
const { join: pathJoin, normalize, dirname } = Cu.import("resource://gre/modules/osfile/ospath_unix.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "resProto",
                                   "@mozilla.org/network/protocol;1?name=resource",
                                   "nsIResProtocolHandler");
XPCOMUtils.defineLazyServiceGetter(this, "zipCache",
                                   "@mozilla.org/libjar/zip-reader-cache;1",
                                   "nsIZipReaderCache");

XPCOMUtils.defineLazyGetter(this, "XulApp", () => {
  let xulappURI = module.uri.replace("toolkit/loader.js",
                                     "sdk/system/xul-app.jsm");
  return Cu.import(xulappURI, {});
});

// Define some shortcuts.
const bind = Function.call.bind(Function.bind);
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const prototypeOf = Object.getPrototypeOf;
const getOwnIdentifiers = x => [...Object.getOwnPropertyNames(x),
                                ...Object.getOwnPropertySymbols(x)];

const NODE_MODULES = new Set([
  "assert",
  "buffer_ieee754",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "_debugger",
  "dgram",
  "dns",
  "domain",
  "events",
  "freelist",
  "fs",
  "http",
  "https",
  "_linklist",
  "module",
  "net",
  "os",
  "path",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "vm",
  "zlib",
]);

const COMPONENT_ERROR = '`Components` is not available in this context.\n' +
  'Functionality provided by Components may be available in an SDK\n' +
  'module: https://developer.mozilla.org/en-US/Add-ons/SDK \n\n' +
  'However, if you still need to import Components, you may use the\n' +
  '`chrome` module\'s properties for shortcuts to Component properties:\n\n' +
  'Shortcuts: \n' +
  '    Cc = Components' + '.classes \n' +
  '    Ci = Components' + '.interfaces \n' +
  '    Cu = Components' + '.utils \n' +
  '    CC = Components' + '.Constructor \n' +
  'Example: \n' +
  '    let { Cc, Ci } = require(\'chrome\');\n';

// Workaround for bug 674195. Freezing objects from other compartments fail,
// so we use `Object.freeze` from the same component instead.
function freeze(object) {
  if (prototypeOf(object) === null) {
      Object.freeze(object);
  }
  else {
    prototypeOf(prototypeOf(object.isPrototypeOf)).
      constructor. // `Object` from the owner compartment.
      freeze(object);
  }
  return object;
}

// Returns map of given `object`-s own property descriptors.
const descriptor = iced(function descriptor(object) {
  let value = {};
  getOwnIdentifiers(object).forEach(function(name) {
    value[name] = getOwnPropertyDescriptor(object, name)
  });
  return value;
});
Loader.descriptor = descriptor;

// Freeze important built-ins so they can't be used by untrusted code as a
// message passing channel.
freeze(Object);
freeze(Object.prototype);
freeze(Function);
freeze(Function.prototype);
freeze(Array);
freeze(Array.prototype);
freeze(String);
freeze(String.prototype);

// This function takes `f` function sets it's `prototype` to undefined and
// freezes it. We need to do this kind of deep freeze with all the exposed
// functions so that untrusted code won't be able to use them a message
// passing channel.
function iced(f) {
  if (!Object.isFrozen(f)) {
    f.prototype = undefined;
  }
  return freeze(f);
}

// Defines own properties of given `properties` object on the given
// target object overriding any existing property with a conflicting name.
// Returns `target` object. Note we only export this function because it's
// useful during loader bootstrap when other util modules can't be used &
// thats only case where this export should be used.
const override = iced(function override(target, source) {
  let properties = descriptor(target)
  let extension = descriptor(source || {})
  getOwnIdentifiers(extension).forEach(function(name) {
    properties[name] = extension[name];
  });
  return Object.defineProperties({}, properties);
});
Loader.override = override;

function sourceURI(uri) { return String(uri).split(" -> ").pop(); }
Loader.sourceURI = iced(sourceURI);

function isntLoaderFrame(frame) { return frame.fileName !== module.uri }

function parseURI(uri) { return String(uri).split(" -> ").pop(); }
Loader.parseURI = parseURI;

function parseStack(stack) {
  let lines = String(stack).split("\n");
  return lines.reduce(function(frames, line) {
    if (line) {
      let atIndex = line.indexOf("@");
      let columnIndex = line.lastIndexOf(":");
      let lineIndex = line.lastIndexOf(":", columnIndex - 1);
      let fileName = parseURI(line.slice(atIndex + 1, lineIndex));
      let lineNumber = parseInt(line.slice(lineIndex + 1, columnIndex));
      let columnNumber = parseInt(line.slice(columnIndex + 1));
      let name = line.slice(0, atIndex).split("(").shift();
      frames.unshift({
        fileName: fileName,
        name: name,
        lineNumber: lineNumber,
        columnNumber: columnNumber
      });
    }
    return frames;
  }, []);
}
Loader.parseStack = parseStack;

function serializeStack(frames) {
  return frames.reduce(function(stack, frame) {
    return frame.name + "@" +
           frame.fileName + ":" +
           frame.lineNumber + ":" +
           frame.columnNumber + "\n" +
           stack;
  }, "");
}
Loader.serializeStack = serializeStack;

class DefaultMap extends Map {
  constructor(createItem, items = undefined) {
    super(items);

    this.createItem = createItem;
  }

  get(key) {
    if (!this.has(key)) {
      this.set(key, this.createItem(key));
    }

    return super.get(key);
  }
}

const urlCache = {
  /**
   * Returns a list of fully-qualified URLs for entries within the zip
   * file at the given URI which are either directories or files with a
   * .js or .json extension.
   *
   * @param {nsIJARURI} uri
   * @param {string} baseURL
   *        The original base URL, prior to resolution.
   *
   * @returns {Set<string>}
   */
  getZipFileContents(uri, baseURL) {
    // Make sure the path has a trailing slash, and strip off the leading
    // slash, so that we can easily check whether it is a path prefix.
    let basePath = addTrailingSlash(uri.JAREntry).slice(1);
    let file = uri.JARFile.QueryInterface(Ci.nsIFileURL).file;

    let enumerator = zipCache.getZip(file).findEntries("(*.js|*.json|*/)");

    let results = new Set();
    for (let entry of XPCOMUtils.IterStringEnumerator(enumerator)) {
      if (entry.startsWith(basePath)) {
        let path = entry.slice(basePath.length);

        results.add(baseURL + path);
      }
    }

    return results;
  },

  zipContentsCache: new DefaultMap(baseURL => {
    let uri = NetUtil.newURI(baseURL);

    if (baseURL.startsWith("resource:")) {
      uri = NetUtil.newURI(resProto.resolveURI(uri));
    }

    if (uri instanceof Ci.nsIJARURI) {
      return urlCache.getZipFileContents(uri, baseURL);
    }

    return null;
  }),

  filesCache: new DefaultMap(url => {
    try {
      let uri = NetUtil.newURI(url).QueryInterface(Ci.nsIFileURL);

      return uri.file.exists();
    } catch (e) {
      return false;
    }
  }),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference]),

  observe() {
    // Clear any module resolution caches when the startup cache is flushed,
    // since it probably means we're loading new copies of extensions.
    this.zipContentsCache.clear();
    this.filesCache.clear();
  },

  /**
   * Returns the base URL for the given URL, if one can be determined. For
   * a resource: URL, this is the root of the resource package. For a jar:
   * URL, it is the root of the JAR file. Otherwise, null is returned.
   *
   * @param {string} url
   * @returns {string?}
   */
  getBaseURL(url) {
    // By using simple string matching for the common case of resource: URLs
    // backed by jar: URLs, we can avoid creating any nsIURI objects for the
    // common case where the JAR contents are already cached.
    if (url.startsWith("resource://")) {
      return /^resource:\/\/[^\/]+\//.exec(url)[0];
    }

    let uri = NetUtil.newURI(url);
    if (uri instanceof Ci.nsIJARURI) {
      return `jar:${uri.JARFile.spec}!/`;
    }

    return null;
  },

  /**
   * Returns true if the target of the given URL exists as a local file,
   * or as an entry in a local zip file.
   *
   * @param {string} url
   * @returns {boolean}
   */
  exists(url) {
    if (!/\.(?:js|json)$/.test(url)) {
      url = addTrailingSlash(url);
    }

    let baseURL = this.getBaseURL(url);
    let scripts = baseURL && this.zipContentsCache.get(baseURL);
    if (scripts) {
      return scripts.has(url);
    }

    return this.filesCache.get(url);
  },
}
addObserver(urlCache, "startupcache-invalidate", true);

function readURI(uri) {
  let nsURI = NetUtil.newURI(uri);
  if (nsURI.scheme == "resource") {
    // Resolve to a real URI, this will catch any obvious bad paths without
    // logging assertions in debug builds, see bug 1135219
    uri = resProto.resolveURI(nsURI);
  }

  let stream = NetUtil.newChannel({
    uri: NetUtil.newURI(uri, 'UTF-8'),
    loadUsingSystemPrincipal: true}
  ).open2();
  let count = stream.available();
  let data = NetUtil.readInputStreamToString(stream, count, {
    charset: 'UTF-8'
  });

  stream.close();

  return data;
}

// Combines all arguments into a resolved, normalized path
function join(base, ...paths) {
  // If this is an absolute URL, we need to normalize only the path portion,
  // or we wind up stripping too many slashes and producing invalid URLs.
  let match = /^((?:resource|file|chrome)\:\/\/[^\/]*|jar:[^!]+!)(.*)/.exec(base);
  if (match) {
    return match[1] + normalize(pathJoin(match[2], ...paths));
  }

  return normalize(pathJoin(base, ...paths));
}
Loader.join = join;

// Function takes set of options and returns a JS sandbox. Function may be
// passed set of options:
//  - `name`: A string value which identifies the sandbox in about:memory. Will
//    throw exception if omitted.
// - `principal`: String URI or `nsIPrincipal` for the sandbox. Defaults to
//    system principal.
// - `prototype`: Ancestor for the sandbox that will be created. Defaults to
//    `{}`.
// - `wantXrays`: A Boolean value indicating whether code outside the sandbox
//    wants X-ray vision with respect to objects inside the sandbox. Defaults
//    to `true`.
// - `sandbox`: A sandbox to share JS compartment with. If omitted new
//    compartment will be created.
// - `metadata`: A metadata object associated with the sandbox. It should
//    be JSON-serializable.
// For more details see:
// https://developer.mozilla.org/en/Components.utils.Sandbox
const Sandbox = iced(function Sandbox(options) {
  // Normalize options and rename to match `Cu.Sandbox` expectations.
  options = {
    // Do not expose `Components` if you really need them (bad idea!) you
    // still can expose via prototype.
    wantComponents: false,
    sandboxName: options.name,
    principal: 'principal' in options ? options.principal : systemPrincipal,
    wantXrays: 'wantXrays' in options ? options.wantXrays : true,
    wantGlobalProperties: 'wantGlobalProperties' in options ?
                          options.wantGlobalProperties : [],
    sandboxPrototype: 'prototype' in options ? options.prototype : {},
    invisibleToDebugger: 'invisibleToDebugger' in options ?
                         options.invisibleToDebugger : false,
    metadata: 'metadata' in options ? options.metadata : {},
    waiveIntereposition: !!options.waiveIntereposition
  };

  if (options.metadata && options.metadata.addonID) {
    options.addonId = options.metadata.addonID;
  }

  let sandbox = Cu.Sandbox(options.principal, options);

  // Each sandbox at creation gets set of own properties that will be shadowing
  // ones from it's prototype. We override delete such `sandbox` properties
  // to avoid shadowing.
  delete sandbox.Iterator;
  delete sandbox.Components;
  delete sandbox.importFunction;
  delete sandbox.debug;

  return sandbox;
});
Loader.Sandbox = Sandbox;

// Evaluates code from the given `uri` into given `sandbox`. If
// `options.source` is passed, then that code is evaluated instead.
// Optionally following options may be given:
// - `options.encoding`: Source encoding, defaults to 'UTF-8'.
// - `options.line`: Line number to start count from for stack traces.
//    Defaults to 1.
// - `options.version`: Version of JS used, defaults to '1.8'.
const evaluate = iced(function evaluate(sandbox, uri, options) {
  let { source, line, version, encoding } = override({
    encoding: 'UTF-8',
    line: 1,
    version: '1.8',
    source: null
  }, options);

  return source ? Cu.evalInSandbox(source, sandbox, version, uri, line)
                : loadSubScript(uri, sandbox, encoding);
});
Loader.evaluate = evaluate;

// Populates `exports` of the given CommonJS `module` object, in the context
// of the given `loader` by evaluating code associated with it.
const load = iced(function load(loader, module) {
  let { sandboxes, globals, loadModuleHook } = loader;
  let require = Require(loader, module);

  // We expose set of properties defined by `CommonJS` specification via
  // prototype of the sandbox. Also globals are deeper in the prototype
  // chain so that each module has access to them as well.
  let descriptors = descriptor({
    require: require,
    module: module,
    exports: module.exports,
    get Components() {
      // Expose `Components` property to throw error on usage with
      // additional information
      throw new ReferenceError(COMPONENT_ERROR);
    }
  });

  let sandbox;
  if ((loader.useSharedGlobalSandbox || isSystemURI(module.uri)) &&
      loader.sharedGlobalBlocklist.indexOf(module.id) == -1) {
    // Create a new object in this sandbox, that will be used as
    // the scope object for this particular module
    sandbox = new loader.sharedGlobalSandbox.Object();
    // Inject all expected globals in the scope object
    getOwnIdentifiers(globals).forEach(function(name) {
      descriptors[name] = getOwnPropertyDescriptor(globals, name)
      descriptors[name].configurable = true;
    });
    Object.defineProperties(sandbox, descriptors);
  }
  else {
    sandbox = Sandbox({
      name: module.uri,
      prototype: Object.create(globals, descriptors),
      wantXrays: false,
      wantGlobalProperties: module.id == "sdk/indexed-db" ? ["indexedDB"] : [],
      invisibleToDebugger: loader.invisibleToDebugger,
      metadata: {
        addonID: loader.id,
        URI: module.uri
      }
    });
  }
  sandboxes[module.uri] = sandbox;

  try {
    evaluate(sandbox, module.uri);
  }
  catch (error) {
    let { message, fileName, lineNumber } = error;
    let stack = error.stack || Error().stack;
    let frames = parseStack(stack).filter(isntLoaderFrame);
    let toString = String(error);
    let file = sourceURI(fileName);

    // Note that `String(error)` where error is from subscript loader does
    // not puts `:` after `"Error"` unlike regular errors thrown by JS code.
    // If there is a JS stack then this error has already been handled by an
    // inner module load.
    if (/^Error opening input stream/.test(String(error))) {
      let caller = frames.slice(0).pop();
      fileName = caller.fileName;
      lineNumber = caller.lineNumber;
      message = "Module `" + module.id + "` is not found at " + module.uri;
      toString = message;
    }
    // Workaround for a Bug 910653. Errors thrown by subscript loader
    // do not include `stack` field and above created error won't have
    // fileName or lineNumber of the module being loaded, so we ensure
    // it does.
    else if (frames[frames.length - 1].fileName !== file) {
      frames.push({ fileName: file, lineNumber: lineNumber, name: "" });
    }

    let prototype = typeof(error) === "object" ? error.constructor.prototype :
                    Error.prototype;

    throw Object.create(prototype, {
      message: { value: message, writable: true, configurable: true },
      fileName: { value: fileName, writable: true, configurable: true },
      lineNumber: { value: lineNumber, writable: true, configurable: true },
      stack: { value: serializeStack(frames), writable: true, configurable: true },
      toString: { value: () => toString, writable: true, configurable: true },
    });
  }

  if (loadModuleHook) {
    module = loadModuleHook(module, require);
  }

  if (loader.checkCompatibility) {
    let err = XulApp.incompatibility(module);
    if (err) {
      throw err;
    }
  }

  if (module.exports && typeof(module.exports) === 'object')
    freeze(module.exports);

  return module;
});
Loader.load = load;

// Utility function to normalize module `uri`s so they have `.js` extension.
function normalizeExt(uri) {
  return isJSURI(uri) ? uri :
         isJSONURI(uri) ? uri :
         isJSMURI(uri) ? uri :
         uri + '.js';
}

// Strips `rootURI` from `string` -- used to remove absolute resourceURI
// from a relative path
function stripBase(rootURI, string) {
  return string.replace(rootURI, './');
}

// Utility function to join paths. In common case `base` is a
// `requirer.uri` but in some cases it may be `baseURI`. In order to
// avoid complexity we require `baseURI` with a trailing `/`.
const resolve = iced(function resolve(id, base) {
  if (!isRelative(id))
    return id;

  let baseDir = dirname(base);
  if (!baseDir)
    return normalize(id);

  let resolved = join(baseDir, id);

  // Joining and normalizing removes the './' from relative files.
  // We need to ensure the resolution still has the root
  if (isRelative(base))
    resolved = './' + resolved;

  return resolved;
});
Loader.resolve = resolve;

// Attempts to load `path` and then `path.js`
// Returns `path` with valid file, or `undefined` otherwise
function resolveAsFile(path) {
  // Append '.js' to path name unless it's another support filetype
  path = normalizeExt(path);
  if (urlCache.exists(path)) {
    return path;
  }

  return null;
}

// Attempts to load `path/package.json`'s `main` entry,
// followed by `path/index.js`, or `undefined` otherwise
function resolveAsDirectory(path) {
  try {
    // If `path/package.json` exists, parse the `main` entry
    // and attempt to load that
    let manifestPath = addTrailingSlash(path) + 'package.json';

    let main = (urlCache.exists(manifestPath) &&
                getManifestMain(JSON.parse(readURI(manifestPath))));
    if (main) {
      let found = resolveAsFile(join(path, main));
      if (found) {
        return found
      }
    }
  } catch (e) {}

  return resolveAsFile(addTrailingSlash(path) + 'index.js');
}

function resolveRelative(rootURI, modulesDir, id) {
  let fullId = join(rootURI, modulesDir, id);

  let resolvedPath = (resolveAsFile(fullId) ||
                      resolveAsDirectory(fullId));
  if (resolvedPath) {
    return stripBase(rootURI, resolvedPath);
  }

  return null;
}

// From `resolve` module
// https://github.com/substack/node-resolve/blob/master/lib/node-modules-paths.js
function* getNodeModulePaths(rootURI, start) {
  let moduleDir = 'node_modules';

  let parts = start.split('/');
  while (parts.length) {
    let leaf = parts.pop();
    let path = join(...parts, leaf, moduleDir);
    if (leaf !== moduleDir && urlCache.exists(join(rootURI, path))) {
      yield path;
    }
  }

  if (urlCache.exists(join(rootURI, moduleDir))) {
    yield moduleDir;
  }
}

// Node-style module lookup
// Takes an id and path and attempts to load a file using node's resolving
// algorithm.
// `id` should already be resolved relatively at this point.
// http://nodejs.org/api/modules.html#modules_all_together
const nodeResolve = iced(function nodeResolve(id, requirer, { rootURI }) {
  // Resolve again
  id = Loader.resolve(id, requirer);

  // If this is already an absolute URI then there is no resolution to do
  if (isAbsoluteURI(id)) {
    return null;
  }

  // we assume that extensions are correct, i.e., a directory doesnt't have '.js'
  // and a js file isn't named 'file.json.js'
  let resolvedPath;

  if ((resolvedPath = resolveRelative(rootURI, "", id))) {
    return resolvedPath;
  }

  // If the requirer is an absolute URI then the node module resolution below
  // won't work correctly as we prefix everything with rootURI
  if (isAbsoluteURI(requirer)) {
    return null;
  }

  // If manifest has dependencies, attempt to look up node modules
  // in the `dependencies` list
  for (let modulesDir of getNodeModulePaths(rootURI, dirname(requirer))) {
    if ((resolvedPath = resolveRelative(rootURI, modulesDir, id))) {
      return resolvedPath;
    }
  }

  // We would not find lookup for things like `sdk/tabs`, as that's part of
  // the alias mapping. If during `generateMap`, the runtime lookup resolves
  // with `resolveURI` -- if during runtime, then `resolve` will throw.
  return null;
});

Loader.nodeResolve = nodeResolve;

function addTrailingSlash(path) {
  return path.replace(/\/*$/, "/");
}

const resolveURI = iced(function resolveURI(id, mapping) {
  // Do not resolve if already a resource URI
  if (isAbsoluteURI(id))
    return normalizeExt(id);

  for (let [path, uri] of mapping) {
    // Strip off any trailing slashes to make comparisons simpler
    let stripped = path.replace(/\/+$/, "");

    // We only want to match path segments explicitly. Examples:
    // * "foo/bar" matches for "foo/bar"
    // * "foo/bar" matches for "foo/bar/baz"
    // * "foo/bar" does not match for "foo/bar-1"
    // * "foo/bar/" does not match for "foo/bar"
    // * "foo/bar/" matches for "foo/bar/baz"
    //
    // Check for an empty path, an exact match, or a substring match
    // with the next character being a forward slash.
    if(stripped === "" || id === stripped || id.startsWith(stripped + "/")) {
      return normalizeExt(id.replace(path, uri));
    }
  }
  return null;
});
Loader.resolveURI = resolveURI;

// Creates version of `require` that will be exposed to the given `module`
// in the context of the given `loader`. Each module gets own limited copy
// of `require` that is allowed to load only a modules that are associated
// with it during link time.
const Require = iced(function Require(loader, requirer) {
  let {
    modules, mapping, resolve: loaderResolve, load,
    manifest, rootURI, isNative, requireMap,
    requireHook
  } = loader;

  if (isSystemURI(requirer.uri)) {
    // Built-in modules don't require the expensive module resolution
    // algorithm used by SDK add-ons, so give them the more efficient standard
    // resolve instead.
    isNative = false;
    loaderResolve = Loader.resolve;
  }

  function require(id) {
    if (!id) // Throw if `id` is not passed.
      throw Error('You must provide a module name when calling require() from '
                  + requirer.id, requirer.uri);

    if (requireHook) {
      return requireHook(id, _require);
    }

    return _require(id);
  }

  function _require(id) {
    // Fix require() from react-autosuggest
    if (id == 'React') id = 'react';
    
    let { uri, requirement } = getRequirements(id);
    let module = null;
    // If module is already cached by loader then just use it.
    if (uri in modules) {
      module = modules[uri];
    }
    else if (isJSMURI(uri)) {
      module = modules[uri] = Module(requirement, uri);
      module.exports = Cu.import(uri, {});
      freeze(module);
    }
    else if (isJSONURI(uri)) {
      let data;

      // First attempt to load and parse json uri
      // ex: `test.json`
      // If that doesn't exist, check for `test.json.js`
      // for node parity
      try {
        data = JSON.parse(readURI(uri));
        module = modules[uri] = Module(requirement, uri);
        module.exports = data;
        freeze(module);
      }
      catch (err) {
        // If error thrown from JSON parsing, throw that, do not
        // attempt to find .json.js file
        if (err && /JSON\.parse/.test(err.message))
          throw err;
        uri = uri + '.js';
      }
    }

    // If not yet cached, load and cache it.
    // We also freeze module to prevent it from further changes
    // at runtime.
    if (!(uri in modules)) {
      // Many of the loader's functionalities are dependent
      // on modules[uri] being set before loading, so we set it and
      // remove it if we have any errors.
      module = modules[uri] = Module(requirement, uri);
      try {
        freeze(load(loader, module));
      }
      catch (e) {
        // Clear out modules cache so we can throw on a second invalid require
        delete modules[uri];
        // Also clear out the Sandbox that was created
        delete loader.sandboxes[uri];
        throw e;
      }
    }

    return module.exports;
  }

  // Resolution function taking a module name/path and
  // returning a resourceURI and a `requirement` used by the loader.
  // Used by both `require` and `require.resolve`.
  function getRequirements(id) {
    if (!id) // Throw if `id` is not passed.
      throw Error('you must provide a module name when calling require() from '
                  + requirer.id, requirer.uri);

    let requirement, uri;

    // TODO should get native Firefox modules before doing node-style lookups
    // to save on loading time
    if (isNative) {
      // If a requireMap is available from `generateMap`, use that to
      // immediately resolve the node-style mapping.
      // TODO: write more tests for this use case
      if (requireMap && requireMap[requirer.id])
        requirement = requireMap[requirer.id][id];

      let { overrides } = manifest.jetpack;
      for (let key in overrides) {
        // ignore any overrides using relative keys
        if (/^[.\/]/.test(key)) {
          continue;
        }

        // If the override is for x -> y,
        // then using require("x/lib/z") to get reqire("y/lib/z")
        // should also work
        if (id == key || id.startsWith(key + "/")) {
          id = overrides[key] + id.substr(key.length);
          id = id.replace(/^[.\/]+/, "");
        }
      }

      // For native modules, we want to check if it's a module specified
      // in 'modules', like `chrome`, or `@loader` -- if it exists,
      // just set the uri to skip resolution
      if (!requirement && modules[id])
        uri = requirement = id;

      // If no requireMap was provided, or resolution not found in
      // the requireMap, and not a npm dependency, attempt a runtime lookup
      if (!requirement && !NODE_MODULES.has(id)) {
        // If `isNative` defined, this is using the new, native-style
        // loader, not cuddlefish, so lets resolve using node's algorithm
        // and get back a path that needs to be resolved via paths mapping
        // in `resolveURI`
        requirement = loaderResolve(id, requirer.id, {
          manifest: manifest,
          rootURI: rootURI
        });
      }

      // If not found in the map, not a node module, and wasn't able to be
      // looked up, it's something
      // found in the paths most likely, like `sdk/tabs`, which should
      // be resolved relatively if needed using traditional resolve
      if (!requirement) {
        requirement = isRelative(id) ? Loader.resolve(id, requirer.id) : id;
      }
    }
    else if (modules[id]) {
      uri = requirement = id;
    }
    else if (requirer) {
      // Resolve `id` to its requirer if it's relative.
      requirement = loaderResolve(id, requirer.id);
    }
    else {
      requirement = id;
    }

    // Resolves `uri` of module using loaders resolve function.
    uri = uri || resolveURI(requirement, mapping);

    // Throw if `uri` can not be resolved.
    if (!uri) {
      throw Error('Module: Can not resolve "' + id + '" module required by ' +
                  requirer.id + ' located at ' + requirer.uri, requirer.uri);
    }

    return { uri: uri, requirement: requirement };
  }

  // Expose the `resolve` function for this `Require` instance
  require.resolve = _require.resolve = function resolve(id) {
    let { uri } = getRequirements(id);
    return uri;
  }

  // This is like webpack's require.context.  It returns a new require
  // function that prepends the prefix to any requests.
  require.context = prefix => {
    return id => {
      return require(prefix + id);
    };
  };

  // Make `require.main === module` evaluate to true in main module scope.
  require.main = loader.main === requirer ? requirer : undefined;
  return iced(require);
});
Loader.Require = Require;

const main = iced(function main(loader, id) {
  // If no main entry provided, and native loader is used,
  // read the entry in the manifest
  if (!id && loader.isNative)
    id = getManifestMain(loader.manifest);
  let uri = resolveURI(id, loader.mapping);
  let module = loader.main = loader.modules[uri] = Module(id, uri);
  return loader.load(loader, module).exports;
});
Loader.main = main;

// Makes module object that is made available to CommonJS modules when they
// are evaluated, along with `exports` and `require`.
const Module = iced(function Module(id, uri) {
  return Object.create(null, {
    id: { enumerable: true, value: id },
    exports: { enumerable: true, writable: true, value: Object.create(null),
               configurable: true },
    uri: { value: uri }
  });
});
Loader.Module = Module;

// Takes `loader`, and unload `reason` string and notifies all observers that
// they should cleanup after them-self.
const unload = iced(function unload(loader, reason) {
  // subject is a unique object created per loader instance.
  // This allows any code to cleanup on loader unload regardless of how
  // it was loaded. To handle unload for specific loader subject may be
  // asserted against loader.destructor or require('@loader/unload')
  // Note: We don not destroy loader's module cache or sandboxes map as
  // some modules may do cleanup in subsequent turns of event loop. Destroying
  // cache may cause module identity problems in such cases.
  let subject = { wrappedJSObject: loader.destructor };
  notifyObservers(subject, 'sdk:loader:destroy', reason);
});
Loader.unload = unload;

// Function makes new loader that can be used to load CommonJS modules
// described by a given `options.manifest`. Loader takes following options:
// - `globals`: Optional map of globals, that all module scopes will inherit
//   from. Map is also exposed under `globals` property of the returned loader
//   so it can be extended further later. Defaults to `{}`.
// - `modules` Optional map of built-in module exports mapped by module id.
//   These modules will incorporated into module cache. Each module will be
//   frozen.
// - `resolve` Optional module `id` resolution function. If given it will be
//   used to resolve module URIs, by calling it with require term, requirer
//   module object (that has `uri` property) and `baseURI` of the loader.
//   If `resolve` does not returns `uri` string exception will be thrown by
//   an associated `require` call.
function Loader(options) {
  if (options.sharedGlobalBlacklist && !options.sharedGlobalBlocklist) {
    options.sharedGlobalBlocklist = options.sharedGlobalBlacklist;
  }
  let {
    modules, globals, resolve, paths, rootURI, manifest, requireMap, isNative,
    metadata, sharedGlobal, sharedGlobalBlocklist, checkCompatibility, waiveIntereposition
  } = override({
    paths: {},
    modules: {},
    globals: {
      get console() {
        // Import Console.jsm from here to prevent loading it until someone uses it
        let { ConsoleAPI } = Cu.import("resource://gre/modules/Console.jsm");
        let console = new ConsoleAPI({
          consoleID: options.id ? "addon/" + options.id : ""
        });
        Object.defineProperty(this, "console", { value: console });
        return this.console;
      }
    },
    checkCompatibility: false,
    resolve: options.isNative ?
      // Make the returned resolve function have the same signature
      (id, requirer) => Loader.nodeResolve(id, requirer, { rootURI: rootURI }) :
      Loader.resolve,
    sharedGlobalBlocklist: ["sdk/indexed-db"],
    waiveIntereposition: false
  }, options);

  // Create overrides defaults, none at the moment
  if (typeof manifest != "object" || !manifest) {
    manifest = {};
  }
  if (typeof manifest.jetpack != "object" || !manifest.jetpack) {
    manifest.jetpack = {
      overrides: {}
    };
  }
  if (typeof manifest.jetpack.overrides != "object" || !manifest.jetpack.overrides) {
    manifest.jetpack.overrides = {};
  }

  // We create an identity object that will be dispatched on an unload
  // event as subject. This way unload listeners will be able to assert
  // which loader is unloaded. Please note that we intentionally don't
  // use `loader` as subject to prevent a loader access leakage through
  // observer notifications.
  let destructor = freeze(Object.create(null));

  // Make mapping array that is sorted from longest path to shortest path.
  let mapping = Object.keys(paths)
                      .sort((a, b) => b.length - a.length)
                      .map(path => [path, paths[path]]);

  // Define pseudo modules.
  modules = override({
    '@loader/unload': destructor,
    '@loader/options': options,
    'chrome': { Cc: Cc, Ci: Ci, Cu: Cu, Cr: Cr, Cm: Cm,
                CC: bind(CC, Components), components: Components,
                // `ChromeWorker` has to be inject in loader global scope.
                // It is done by bootstrap.js:loadSandbox for the SDK.
                ChromeWorker: ChromeWorker
    }
  }, modules);

  const builtinModuleExports = modules;
  modules = {};
  for (let id of Object.keys(builtinModuleExports)) {
    // We resolve `uri` from `id` since modules are cached by `uri`.
    let uri = resolveURI(id, mapping);
    // In native loader, the mapping will not contain values for
    // pseudomodules -- store them as their ID rather than the URI
    if (isNative && !uri)
      uri = id;
    let module = Module(id, uri);

    // Lazily expose built-in modules in order to
    // allow them to be loaded lazily.
    Object.defineProperty(module, "exports", {
      enumerable: true,
      get: function() {
        return builtinModuleExports[id];
      }
    });

    modules[uri] = freeze(module);
  }

  // Create the unique sandbox we will be using for all modules,
  // so that we prevent creating a new comportment per module.
  // The side effect is that all modules will share the same
  // global objects.
  let sharedGlobalSandbox = Sandbox({
    name: "Addon-SDK",
    wantXrays: false,
    wantGlobalProperties: [],
    invisibleToDebugger: options.invisibleToDebugger || false,
    metadata: {
      addonID: options.id,
      URI: "Addon-SDK"
    },
    prototype: options.sandboxPrototype || {}
  });

  // Loader object is just a representation of a environment
  // state. We freeze it and mark make it's properties non-enumerable
  // as they are pure implementation detail that no one should rely upon.
  let returnObj = {
    destructor: { enumerable: false, value: destructor },
    globals: { enumerable: false, value: globals },
    mapping: { enumerable: false, value: mapping },
    // Map of module objects indexed by module URIs.
    modules: { enumerable: false, value: modules },
    metadata: { enumerable: false, value: metadata },
    useSharedGlobalSandbox: { enumerable: false, value: !!sharedGlobal },
    sharedGlobalSandbox: { enumerable: false, value: sharedGlobalSandbox },
    sharedGlobalBlocklist: { enumerable: false, value: sharedGlobalBlocklist },
    sharedGlobalBlacklist: { enumerable: false, value: sharedGlobalBlocklist },
    // Map of module sandboxes indexed by module URIs.
    sandboxes: { enumerable: false, value: {} },
    resolve: { enumerable: false, value: resolve },
    // ID of the addon, if provided.
    id: { enumerable: false, value: options.id },
    // Whether the modules loaded should be ignored by the debugger
    invisibleToDebugger: { enumerable: false,
                           value: options.invisibleToDebugger || false },
    load: { enumerable: false, value: options.load || load },
    checkCompatibility: { enumerable: false, value: checkCompatibility },
    requireHook: { enumerable: false, value: options.requireHook },
    loadModuleHook: { enumerable: false, value: options.loadModuleHook },
    // Main (entry point) module, it can be set only once, since loader
    // instance can have only one main module.
    main: new function() {
      let main;
      return {
        enumerable: false,
        get: function() { return main; },
        // Only set main if it has not being set yet!
        set: function(module) { main = main || module; }
      }
    }
  };

  if (isNative) {
    returnObj.isNative = { enumerable: false, value: true };
    returnObj.manifest = { enumerable: false, value: manifest };
    returnObj.requireMap = { enumerable: false, value: requireMap };
    returnObj.rootURI = { enumerable: false, value: addTrailingSlash(rootURI) };
  }

  return freeze(Object.create(null, returnObj));
};
Loader.Loader = Loader;

var isSystemURI = uri => /^resource:\/\/(gre|devtools|testing-common)\//.test(uri);

var isJSONURI = uri => uri.endsWith('.json');
var isJSMURI = uri => uri.endsWith('.jsm');
var isJSURI = uri => uri.endsWith('.js');
var isAbsoluteURI = uri => uri.startsWith("resource://") ||
                           uri.startsWith("chrome://") ||
                           uri.startsWith("file://");
var isRelative = id => id.startsWith(".");

// Default `main` entry to './index.js' and ensure is relative,
// since node allows 'lib/index.js' without relative `./`
function getManifestMain(manifest) {
  let main = manifest.main || './index.js';
  return isRelative(main) ? main : './' + main;
}

module.exports = iced(Loader);
});

