/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* exported Loader, resolveURI, Module, Require, unload */

const systemPrincipal = Components.Constructor(
    "@mozilla.org/systemprincipal;1",
    "nsIPrincipal"
)();

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyServiceGetter(
    lazy,
    "resProto",
    "@mozilla.org/network/protocol;1?name=resource",
    "nsIResProtocolHandler"
);

ChromeUtils.defineESModuleGetters(
    lazy,
    {
      NetUtil: "resource://gre/modules/NetUtil.sys.mjs",
    },
    { global: "contextual" }
);

const VENDOR_URI = "resource://devtools/client/shared/vendor/";
const REACT_ESM_MODULES = new Set([
  VENDOR_URI + "react-dev.js",
  VENDOR_URI + "react.js",
  VENDOR_URI + "react-dom-dev.js",
  VENDOR_URI + "react-dom.js",
  VENDOR_URI + "react-dom-factories.js",
  VENDOR_URI + "react-dom-server-dev.js",
  VENDOR_URI + "react-dom-server.js",
  VENDOR_URI + "react-prop-types-dev.js",
  VENDOR_URI + "react-prop-types.js",
  VENDOR_URI + "react-test-renderer.js",
]);

// Define some shortcuts.
function* getOwnIdentifiers(x) {
  yield* Object.getOwnPropertyNames(x);
  yield* Object.getOwnPropertySymbols(x);
}

function isJSONURI(uri) {
  return uri.endsWith(".json");
}
function isESMURI(uri) {
  return uri.endsWith(".mjs");
}
function isJSURI(uri) {
  return uri.endsWith(".js");
}
const AbsoluteRegExp = /^(resource|chrome|file|jar):/;
function isAbsoluteURI(uri) {
  return AbsoluteRegExp.test(uri);
}
function isRelative(id) {
  return id.startsWith(".");
}

function readURI(uri) {
  const nsURI = lazy.NetUtil.newURI(uri);
  if (nsURI.scheme == "resource") {
    // Resolve to a real URI, this will catch any obvious bad paths without
    // logging assertions in debug builds, see bug 1135219
    uri = lazy.resProto.resolveURI(nsURI);
  }

  const stream = lazy.NetUtil.newChannel({
    uri: lazy.NetUtil.newURI(uri, "UTF-8"),
    loadUsingSystemPrincipal: true,
  }).open();
  const count = stream.available();
  const data = lazy.NetUtil.readInputStreamToString(stream, count, {
    charset: "UTF-8",
  });

  stream.close();

  return data;
}

// Combines all arguments into a resolved, normalized path
function join(base, ...paths) {
  // If this is an absolute URL, we need to normalize only the path portion,
  // or we wind up stripping too many slashes and producing invalid URLs.
  const match = /^((?:resource|file|chrome)\:\/\/[^\/]*|jar:[^!]+!)(.*)/.exec(
      base
  );
  if (match) {
    return match[1] + normalize([match[2], ...paths].join("/"));
  }

  return normalize([base, ...paths].join("/"));
}

// Function takes set of options and returns a JS sandbox. Function may be
// passed set of options:
//  - `name`: A string value which identifies the sandbox in about:memory. Will
//    throw exception if omitted.
// - `prototype`: Ancestor for the sandbox that will be created. Defaults to
//    `{}`.
function Sandbox(options) {
  // Normalize options and rename to match `Cu.Sandbox` expectations.
  const sandboxOptions = {
    // This will allow exposing Components as well as Cu, Ci and Cr.
    wantComponents: true,

    // By default, Sandbox come with a very limited set of global.
    // The list of all available symbol names is available over there:
    // https://searchfox.org/mozilla-central/rev/31368c7795f44b7a15531d6c5e52dc97f82cf2d5/js/xpconnect/src/Sandbox.cpp#905-997
    // Request to expose all meaningful global here:
    wantGlobalProperties: [
      "AbortController",
      "atob",
      "btoa",
      "Blob",
      "crypto",
      "ChromeUtils",
      "CSS",
      "CSSRule",
      "CustomStateSet",
      "DOMParser",
      "Element",
      "Event",
      "FileReader",
      "FormData",
      "Headers",
      "InspectorCSSParser",
      "InspectorUtils",
      "MIDIInputMap",
      "MIDIOutputMap",
      "Node",
      "TextDecoder",
      "TextEncoder",
      "TrustedHTML",
      "TrustedScript",
      "TrustedScriptURL",
      "URL",
      "URLSearchParams",
      "Window",
      "XMLHttpRequest",
    ],

    sandboxName: options.name,
    sandboxPrototype: "prototype" in options ? options.prototype : {},
    freshCompartment: options.freshCompartment || false,
  };

  return Cu.Sandbox(systemPrincipal, sandboxOptions);
}

// This allows defining some modules in AMD format while retaining CommonJS
// compatibility with this loader by allowing the factory function to have
// access to general CommonJS functions, e.g.
//
//   define(function(require, exports, module) {
//     ... code ...
//   });
function define(factory) {
  factory(this.require, this.exports, this.module);
}

// Populates `exports` of the given CommonJS `module` object, in the context
// of the given `loader` by evaluating code associated with it.
function load(loader, module) {
  const require = Require(loader, module);

  // We expose set of properties defined by `CommonJS` specification via
  // prototype of the sandbox. Also globals are deeper in the prototype
  // chain so that each module has access to them as well.
  const properties = {
    require,
    module,
    exports: module.exports,
  };
  if (loader.supportAMDModules) {
    properties.define = define;
  }

  // Create a new object in the shared global of the loader, that will be used
  // as the scope object for this particular module.
  const scopeFromSharedGlobal = new loader.sharedGlobal.Object();
  Object.assign(scopeFromSharedGlobal, properties);

  const originalExports = module.exports;
  try {
    Services.scriptloader.loadSubScript(module.uri, scopeFromSharedGlobal);
  } catch (error) {
    // loadSubScript sometime throws string errors, which includes no stack.
    // At least provide the current stack by re-throwing a real Error object.
    if (typeof error == "string") {
      if (
          error.startsWith("Error creating URI") ||
          error.startsWith("Error opening input stream (invalid filename?)")
      ) {
        throw new Error(
            `Module \`${module.id}\` is not found at ${module.uri}`
        );
      }
      throw new Error(
          `Error while loading module \`${module.id}\` at ${module.uri}:` +
          "\n" +
          error
      );
    }
    // Otherwise just re-throw everything else which should have a stack
    throw error;
  }

  // Only freeze the exports object if we created it ourselves. Modules
  // which completely replace the exports object and still want it
  // frozen need to freeze it themselves.
  if (module.exports === originalExports) {
    Object.freeze(module.exports);
  }

  return module;
}

// Utility function to normalize module `uri`s so they have `.js` extension.
function normalizeExt(uri) {
  if (isJSURI(uri) || isJSONURI(uri) || isESMURI(uri)) {
    return uri;
  }
  return uri + ".js";
}

// Utility function to join paths. In common case `base` is a
// `requirer.uri` but in some cases it may be `baseURI`. In order to
// avoid complexity we require `baseURI` with a trailing `/`.
function resolve(id, base) {
  if (!isRelative(id)) {
    return id;
  }

  const baseDir = dirname(base);

  let resolved;
  if (baseDir.includes(":")) {
    resolved = join(baseDir, id);
  } else {
    resolved = normalize(`${baseDir}/${id}`);
  }

  // Joining and normalizing removes the "./" from relative files.
  // We need to ensure the resolution still has the root
  if (base.startsWith("./")) {
    resolved = "./" + resolved;
  }

  return resolved;
}

function compileMapping(paths) {
  // Make mapping array that is sorted from longest path to shortest path.
  const mapping = Object.keys(paths)
      .sort((a, b) => b.length - a.length)
      .map(path => [path, paths[path]]);

  const PATTERN = /([.\\?+*(){}[\]^$])/g;
  const escapeMeta = str => str.replace(PATTERN, "\\$1");

  const patterns = [];
  paths = {};

  for (let [path, uri] of mapping) {
    // Strip off any trailing slashes to make comparisons simpler
    if (path.endsWith("/")) {
      path = path.slice(0, -1);
      uri = uri.replace(/\/+$/, "");
    }

    paths[path] = uri;

    // We only want to match path segments explicitly. Examples:
    // * "foo/bar" matches for "foo/bar"
    // * "foo/bar" matches for "foo/bar/baz"
    // * "foo/bar" does not match for "foo/bar-1"
    // * "foo/bar/" does not match for "foo/bar"
    // * "foo/bar/" matches for "foo/bar/baz"
    //
    // Check for an empty path, an exact match, or a substring match
    // with the next character being a forward slash.
    if (path == "") {
      patterns.push("");
    } else {
      patterns.push(`${escapeMeta(path)}(?=$|/)`);
    }
  }

  const pattern = new RegExp(`^(${patterns.join("|")})`);

  // This will replace the longest matching path mapping at the start of
  // the ID string with its mapped value.
  return id => {
    return id.replace(pattern, (m0, m1) => paths[m1]);
  };
}

export function resolveURI(id, mapping) {
  // Do not resolve if already a resource URI
  if (isAbsoluteURI(id)) {
    return normalizeExt(id);
  }

  return normalizeExt(mapping(id));
}

// Creates version of `require` that will be exposed to the given `module`
// in the context of the given `loader`. Each module gets own limited copy
// of `require` that is allowed to load only a modules that are associated
// with it during link time.
export function Require(loader, requirer) {
  const { modules, mapping, mappingCache, requireHook } = loader;

  function require(id) {
    if (!id) {
      // Throw if `id` is not passed.
      throw Error(
          "You must provide a module name when calling require() from " +
          requirer.id,
          requirer.uri
      );
    }

    if (requireHook) {
      return requireHook(id, _require);
    }

    return _require(id);
  }

  function _require(id) {
    let { uri, requirement } = getRequirements(id);

    // Load all react modules as ES Modules, in the Browser Loader global.
    // For this we have to ensure using ChromeUtils.importESModule with `global:"current"`,
    // but executed from the Loader global scope. `syncImport` does that.
    if (REACT_ESM_MODULES.has(uri)) {
      // All CommonJS modules are still importing the .js/CommonJS version,
      // but we hack these require() call to load the ESM version.
      uri = uri.replace(/.js$/, ".mjs");
    }

    let module = null;
    // If module is already cached by loader then just use it.
    if (uri in modules) {
      module = modules[uri];
    } else if (isESMURI(uri)) {
      module = modules[uri] = Module(requirement, uri);
      const rv = ChromeUtils.importESModule(uri, {
        global: "contextual",
      });
      module.exports = rv.default || rv;
    } else if (isJSONURI(uri)) {
      let data;

      // First attempt to load and parse json uri
      // ex: `test.json`
      // If that doesn"t exist, check for `test.json.js`
      // for node parity
      try {
        data = JSON.parse(readURI(uri));
        module = modules[uri] = Module(requirement, uri);
        module.exports = data;
      } catch (err) {
        // If error thrown from JSON parsing, throw that, do not
        // attempt to find .json.js file
        if (err && /JSON\.parse/.test(err.message)) {
          throw err;
        }
        uri = uri + ".js";
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
        Object.freeze(load(loader, module));
      } catch (e) {
        // Clear out modules cache so we can throw on a second invalid require
        delete modules[uri];
        throw e;
      }
    }

    return module.exports;
  }

  // Resolution function taking a module name/path and
  // returning a resourceURI and a `requirement` used by the loader.
  // Used by both `require` and `require.resolve`.
  function getRequirements(id) {
    if (!id) {
      // Throw if `id` is not passed.
      throw Error(
          "you must provide a module name when calling require() from " +
          requirer.id,
          requirer.uri
      );
    }

    let requirement, uri;

    if (modules[id]) {
      uri = requirement = id;
    } else if (requirer) {
      // Resolve `id` to its requirer if it's relative.
      requirement = resolve(id, requirer.id);
    } else {
      requirement = id;
    }

    // Resolves `uri` of module using loaders resolve function.
    if (!uri) {
      if (mappingCache.has(requirement)) {
        uri = mappingCache.get(requirement);
      } else {
        uri = resolveURI(requirement, mapping);
        mappingCache.set(requirement, uri);
      }
    }

    // Throw if `uri` can not be resolved.
    if (!uri) {
      throw Error(
          "Module: Can not resolve '" +
          id +
          "' module required by " +
          requirer.id +
          " located at " +
          requirer.uri,
          requirer.uri
      );
    }

    return { uri, requirement };
  }

  // Expose the `resolve` function for this `Require` instance
  require.resolve = _require.resolve = function (id) {
    const { uri } = getRequirements(id);
    return uri;
  };

  // This is like webpack's require.context.  It returns a new require
  // function that prepends the prefix to any requests.
  require.context = prefix => {
    return id => {
      return require(prefix + id);
    };
  };

  return require;
}

// Makes module object that is made available to CommonJS modules when they
// are evaluated, along with `exports` and `require`.
export function Module(id, uri) {
  return Object.create(null, {
    id: { enumerable: true, value: id },
    exports: {
      enumerable: true,
      writable: true,
      value: Object.create(null),
      configurable: true,
    },
    uri: { value: uri },
  });
}

// Takes `loader`, and unload `reason` string and notifies all observers that
// they should cleanup after them-self.
export function unload(loader, reason) {
  // subject is a unique object created per loader instance.
  // This allows any code to cleanup on loader unload regardless of how
  // it was loaded. To handle unload for specific loader subject may be
  // asserted against loader.destructor or require("@loader/unload")
  // Note: We don not destroy loader's module cache or sandboxes map as
  // some modules may do cleanup in subsequent turns of event loop. Destroying
  // cache may cause module identity problems in such cases.
  const subject = { wrappedJSObject: loader.destructor };
  Services.obs.notifyObservers(subject, "devtools:loader:destroy", reason);
}

// Function makes new loader that can be used to load CommonJS modules.
// Loader takes following options:
// - `paths`: Mandatory dictionary of require path mapped to absolute URIs.
//   Object keys are path prefix used in require(), values are URIs where each
//   prefix should be mapped to.
// - `globals`: Optional map of globals, that all module scopes will inherit
//   from. Map is also exposed under `globals` property of the returned loader
//   so it can be extended further later. Defaults to `{}`.
// - `sandboxName`: String, name of the sandbox displayed in about:memory.
// - `sandboxPrototype`: Object used to define globals on all module's
//   sandboxes.
// - `requireHook`: Optional function used to replace native require function
//   from loader. This function receive the module path as first argument,
//   and native require method as second argument.
export function Loader(options) {
  let { paths, globals } = options;
  if (!globals) {
    globals = {};
  }

  // We create an identity object that will be dispatched on an unload
  // event as subject. This way unload listeners will be able to assert
  // which loader is unloaded. Please note that we intentionally don"t
  // use `loader` as subject to prevent a loader access leakage through
  // observer notifications.
  const destructor = Object.create(null);

  const mapping = compileMapping(paths);

  // Define pseudo modules.
  const builtinModuleExports = {
    "@loader/unload": destructor,
    "@loader/options": options,
  };

  const modules = {};
  for (const id of Object.keys(builtinModuleExports)) {
    // We resolve `uri` from `id` since modules are cached by `uri`.
    const uri = resolveURI(id, mapping);
    const module = Module(id, uri);

    // Lazily expose built-in modules in order to
    // allow them to be loaded lazily.
    Object.defineProperty(module, "exports", {
      enumerable: true,
      get() {
        return builtinModuleExports[id];
      },
    });

    modules[uri] = module;
  }

  let sharedGlobal;
  if (options.sharedGlobal) {
    sharedGlobal = options.sharedGlobal;
  } else {
    // Create the unique sandbox we will be using for all modules,
    // so that we prevent creating a new compartment per module.
    // The side effect is that all modules will share the same
    // global objects.
    sharedGlobal = Sandbox({
      name: options.sandboxName || "Zotero",
      prototype: options.sandboxPrototype || globals,
      freshCompartment: options.freshCompartment,
    });
  }

  if (options.sharedGlobal || options.sandboxPrototype) {
    // If we were given a sharedGlobal or a sandboxPrototype, we have to define
    // the globals on the shared global directly. Note that this will not work
    // for callers who depend on being able to add globals after the loader was
    // created.
    for (const name of getOwnIdentifiers(globals)) {
      Object.defineProperty(
          sharedGlobal,
          name,
          Object.getOwnPropertyDescriptor(globals, name)
      );
    }
  }

  // Loader object is just a representation of a environment
  // state. We mark its properties non-enumerable
  // as they are pure implementation detail that no one should rely upon.
  const returnObj = {
    destructor: { enumerable: false, value: destructor },
    globals: { enumerable: false, value: globals },
    mapping: { enumerable: false, value: mapping },
    mappingCache: { enumerable: false, value: new Map() },
    // Map of module objects indexed by module URIs.
    modules: { enumerable: false, value: modules },
    sharedGlobal: { enumerable: false, value: sharedGlobal },
    supportAMDModules: {
      enumerable: false,
      value: options.supportAMDModules || false,
    },
    requireHook: {
      enumerable: false,
      writable: true,
      value: options.requireHook,
    },
  };

  return Object.create(null, returnObj);
}

// NB: These methods are from the UNIX implementation of OS.Path. Refactoring
//     this module to not use path methods on stringly-typed URIs is
//     non-trivial.
function dirname(path) {
  let index = path.lastIndexOf("/");
  if (index == -1) {
    return ".";
  }
  while (index >= 0 && path[index] == "/") {
    --index;
  }
  return path.slice(0, index + 1);
}

function normalize(path) {
  const stack = [];
  let absolute;
  if (path.length >= 0 && path[0] == "/") {
    absolute = true;
  } else {
    absolute = false;
  }
  path.split("/").forEach(function (v) {
    switch (v) {
      case "":
      case ".": // fallthrough
        break;
      case "..":
        if (!stack.length) {
          if (absolute) {
            throw new Error("Path is ill-formed: attempting to go past root");
          } else {
            stack.push("..");
          }
        } else if (stack[stack.length - 1] == "..") {
          stack.push("..");
        } else {
          stack.pop();
        }
        break;
      default:
        stack.push(v);
    }
  });
  const string = stack.join("/");
  return absolute ? "/" + string : string;
}
