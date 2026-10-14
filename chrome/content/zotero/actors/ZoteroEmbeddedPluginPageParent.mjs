ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

// Chrome-side hub for an embedded plugin page: relays page messages (via
// PluginPageChannel), dispatches zoteroHost.api calls, and applies resizes.
export class ZoteroEmbeddedPluginPageParent extends JSWindowActorParent {
	_listeners = new Set();
	
	_hostAPI = null;
	
	_hostAPIDeferred = null;
	
	receiveMessage({ name, data }) {
		switch (name) {
			case "fromPage":
				this._deliver(data);
				break;
			case "resize":
				this._applyResize(data);
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
		return handler(params);
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
	
	_applyResize(data) {
		// embedderElement is the host <browser>/<iframe>; sizing it here works
		// even when the page itself is out-of-process
		let element = this.browsingContext?.embedderElement;
		if (!element) {
			return;
		}
		if (typeof data.height === "number") {
			element.style.height = data.height + "px";
		}
		if (typeof data.width === "number") {
			element.style.width = data.width + "px";
		}
	}
}
