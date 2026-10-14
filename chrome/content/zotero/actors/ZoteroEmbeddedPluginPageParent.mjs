ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	PluginTrace: "chrome://zotero/content/xpcom/plugins/trace.mjs",
});

// Chrome-side hub for an embedded plugin page: relays page messages (via
// PluginPageChannel) and dispatches zoteroHost.api calls.
export class ZoteroEmbeddedPluginPageParent extends JSWindowActorParent {
	_listeners = new Set();
	
	_hostAPI = null;
	
	_hostAPIDeferred = null;
	
	receiveMessage({ name, data }) {
		switch (name) {
			case "fromPage":
				this._deliver(data);
				break;
			case "hostCall":
				return this._callHostAPI(data);
		}
		return undefined;
	}
	
	addListener(fn) {
		this._listeners.add(fn);
	}
	
	removeListener(fn) {
		this._listeners.delete(fn);
	}
	
	send(data) {
		this.sendAsyncMessage("toPage", data);
	}
	
	// Declare the page's host API; always called once the page loads (with {}
	// if the host declares none) so held page calls settle
	setHostAPI(api) {
		this._hostAPI = api || {};
		this._hostAPIDeferred?.resolve();
	}
	
	async _callHostAPI(data) {
		// Hold calls made before the load completes -- the API is declared then
		if (!this._hostAPI) {
			if (!this._hostAPIDeferred) {
				this._hostAPIDeferred = Promise.withResolvers();
			}
			await this._hostAPIDeferred.promise;
		}
		let name = String(data?.name || "");
		// A page call is plugin code reaching chrome, traced like a sandbox call under the page it came from
		let t = lazy.PluginTrace.start();
		let failure;
		try {
			let handler = Object.prototype.hasOwnProperty.call(this._hostAPI, name)
				? this._hostAPI[name]
				: null;
			if (typeof handler !== "function") {
				throw new Error("Unknown host API");
			}
			// Host APIs take a single JSON-object argument
			let params = data.params ?? {};
			if (typeof params !== "object" || Array.isArray(params)) {
				throw new Error("params must be a plain object");
			}
			return await handler(params);
		}
		catch (e) {
			failure = e;
			throw e;
		}
		finally {
			if (t) lazy.PluginTrace.end(t, this._pluginID, "call", `${this._pagePath}:zoteroHost.api.${name}`, failure);
		}
	}

	// The page's principal is the plugin's own moz-extension policy
	get _pluginID() {
		return this.manager?.documentPrincipal?.addonPolicy?.id || "unknown";
	}

	// The page within the plugin, as its URL path; the host is the plugin's UUID, which the plugin ID covers
	get _pagePath() {
		try {
			return this.manager?.documentURI?.pathQueryRef || "";
		}
		catch {
			return "";
		}
	}

	_deliver(data) {
		for (let fn of this._listeners) {
			try {
				fn(data);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	}
}
