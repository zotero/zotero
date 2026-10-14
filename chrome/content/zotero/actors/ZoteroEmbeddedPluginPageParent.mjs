ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

// Chrome-side hub for an embedded plugin page: relays messages to/from the page
// (via PluginPageChannel) and applies the size the page reports.
export class ZoteroEmbeddedPluginPageParent extends JSWindowActorParent {
	_listeners = new Set();
	
	receiveMessage({ name, data }) {
		switch (name) {
			case "fromPage":
				this._deliver(data);
				break;
			case "resize":
				this._applyResize(data);
				break;
		}
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
