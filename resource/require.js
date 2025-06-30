'use strict';

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Manages the base loader (loader.sys.mjs) instance used to load CJS modules.
 */

const {
	Loader,
	Require,
	resolveURI,
	unload,
} = ChromeUtils.importESModule("resource://zotero/loader.sys.mjs");

const DEFAULT_SANDBOX_NAME = "Zotero (Module loader)";

var gNextLoaderID = 0;

/**
 * The main loader API. The standard instance of this loader is exported as
 * |loader| below, but if a fresh copy of the loader is needed, then a new
 * one can also be created.
 *
 * The two following boolean flags are used to control the sandboxes into
 * which the modules are loaded.
 * @param freshCompartment boolean
 *        If true, the modules will be forced to be loaded in a distinct
 *        compartment. It is typically used to load the modules in a distinct
 *        system compartment, different from the main one, which is shared by
 *        all ESMs, XPCOMs and modules loaded with this flag set to true.
 *        We use this in order to debug modules loaded in this shared system
 *        compartment. The debugger actor has to be running in a distinct
 *        compartment than the context it is debugging.
 * @param useLoaderGlobal boolean
 *        If true, the loader will reuse the current global to load other
 *        modules instead of creating a sandbox with custom options. Cannot be
 *        used with freshCompartment.
 */
function ZoteroLoader({
	freshCompartment = false,
	useLoaderGlobal = false,
} = {}) {
	if (useLoaderGlobal && freshCompartment) {
		throw new Error(
			"Loader cannot use freshCompartment if useLoaderGlobal is true"
		);
	}

	const paths = {
		'': 'resource://zotero/',
		'containers/': 'chrome://zotero/content/containers/',
		'components/': 'chrome://zotero/content/components/',
		'zotero/': 'chrome://zotero/content/'
	};

	// In case the Loader ESM is loaded in the existing global,
	// also reuse this global for all CommonJS modules.
	const sharedGlobal =
		useLoaderGlobal ||
		// eslint-disable-next-line mozilla/reject-globalThis-modification
		Cu.getRealmLocation(globalThis) == "Zotero global"
			? Cu.getGlobalForObject({})
			: undefined;
	this.loader = new Loader({
		paths,
		sharedGlobal,
		freshCompartment,
		sandboxName: useLoaderGlobal
			? "Zotero (Server Module Loader)"
			: DEFAULT_SANDBOX_NAME,
		// Make sure `define` function exists. JSON Viewer needs modules in AMD
		// format, as it currently uses RequireJS from a content document and
		// can't access our usual loaders. So, any modules shared with the JSON
		// Viewer should include a define wrapper:
		//
		//   // Make this available to both AMD and CJS environments
		//   define(function(require, exports, module) {
		//     ... code ...
		//   });
		//
		supportAMDModules: true,
		requireHook: (id, require) => {
			// if (id.startsWith("raw!") || id.startsWith("theme-loader!")) {
			// 	return requireRawId(id, require);
			// }
			return require(id);
		},
	});

	this.require = Require(this.loader, { id: "zotero" });

	// Various globals are available from ESM, but not from sandboxes,
	// inject them into the globals list.
	// Changes here should be mirrored to .eslintrc.
	const injectedGlobals = {
		BrowsingContext,
		CanonicalBrowsingContext,
		ChromeWorker,
		console,
		DebuggerNotificationObserver,
		DOMPoint,
		DOMQuad,
		DOMRect,
		fetch,
		HeapSnapshot,
		IOUtils,
		L10nRegistry,
		Localization,
		NamedNodeMap,
		NodeFilter,
		PathUtils,
		Services,
		StructuredCloneHolder,
		WebExtensionPolicy,
		WebSocket,
		WindowGlobalChild,
		WindowGlobalParent,
	};
	for (const name in injectedGlobals) {
		this.loader.globals[name] = injectedGlobals[name];
	}
	
	Object.defineProperty(this.loader.globals, "Zotero", {
		get: () => {
			const { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
			// TODO: Cache
			return Zotero;
		}
	})

	// Fetch custom pseudo modules and globals
	const { modules, globals } = {
		// TODO: TEMP: Stub this out
		modules: {},
		globals: {},
	}

	// Register custom pseudo modules to the current loader instance
	for (const id in modules) {
		const uri = resolveURI(id, this.loader.mapping);
		this.loader.modules[uri] = {
			get exports() {
				return modules[id];
			},
		};
	}

	// Register custom globals to the current loader instance
	Object.defineProperties(
		this.loader.sharedGlobal,
		Object.getOwnPropertyDescriptors(globals)
	);

	this.id = gNextLoaderID++;
}

ZoteroLoader.prototype = {
	destroy(reason = "shutdown") {
		unload(this.loader, reason);
		delete this.loader;
	},
};

// Export the standard instance of ZoteroLoader used by the tools.
// TODO: Zotero: Not making require.js an ESM for now, so this isn't exposed
// Should it be?
let loader = new ZoteroLoader();

var require = loader.require;
