// -moz-window-dragging is chrome-only CSS (fx153+) that author sheets can't use,
// so pages mark window drag areas with data attributes, mapped by this user sheet
const WINDOW_DRAG_SHEET = "data:text/css," + encodeURIComponent(
	"[window-dragging] { -moz-window-dragging: drag; }"
	+ "[window-dragging] :is(button, a, input, select, textarea,"
	+ " [contenteditable]:not([contenteditable='false' i]))"
	+ " { -moz-window-dragging: no-drag; }"
	+ "[window-no-drag] { -moz-window-dragging: no-drag; }"
);

// Per-page actor running in an embedded plugin page's own process (see
// embeddedPage.mjs): injects window.zoteroHost messaging.
export class ZoteroEmbeddedPluginPageChild extends JSWindowActorChild {
	_pageListeners = new Set();
	
	_injected = false;
	
	handleEvent(event) {
		if (event.type === "DOMDocElementInserted") {
			this._injectMessaging();
			this._loadWindowDragSheet();
		}
	}
	
	receiveMessage({ name, data }) {
		if (name === "toPage") {
			this._deliverToPage(data);
		}
	}
	
	didDestroy() {
		this._pageListeners.clear();
	}
	
	// Inject window.zoteroHost before the page's own scripts run, so the page
	// talks to chrome with no postMessage or token dance.
	_injectMessaging() {
		let win = this.contentWindow;
		if (!win || this._injected) {
			return;
		}
		this._injected = true;
		let host = Cu.createObjectIn(win, { defineAs: "zoteroHost" });
		Cu.exportFunction(data => this.sendAsyncMessage("fromPage", data), host, { defineAs: "sendMessage" });
		Cu.exportFunction(fn => this._pageListeners.add(fn), host, { defineAs: "addMessageListener" });
		Cu.exportFunction(fn => this._pageListeners.delete(fn), host, { defineAs: "removeMessageListener" });
		Cu.waiveXrays(host).api = this._buildHostAPIProxy(win);
	}
	
	// The user-origin sheet may use the chrome-only property; whether dragging
	// actually happens stays gated by the host docShell's windowDraggingAllowed
	_loadWindowDragSheet() {
		try {
			let winUtils = this.contentWindow?.windowUtils;
			winUtils?.loadSheetUsingURIString(WINDOW_DRAG_SHEET, winUtils.USER_SHEET);
		}
		catch (e) {
			console.error(e);
		}
	}

	// zoteroHost.api.<name>(params) as a page-compartment Proxy so any name is
	// callable synchronously; chrome validates the name and runs the handler
	_buildHostAPIProxy(win) {
		let cache = new Map();
		let traps = Cu.createObjectIn(win);
		Cu.exportFunction((_target, name) => {
			// Symbols and `then` must stay undefined, or the proxy looks thenable
			if (typeof name !== "string" || name === "then") {
				return undefined;
			}
			if (!cache.has(name)) {
				cache.set(name, Cu.exportFunction(params => this._callHost(win, name, params), win));
			}
			return cache.get(name);
		}, traps, { defineAs: "get" });
		return new win.Proxy(Cu.createObjectIn(win), traps);
	}
	
	// Host APIs take a single JSON-object argument and resolve with a clonable result
	_callHost(win, name, params) {
		return new win.Promise((resolve, reject) => {
			this.sendQuery("hostCall", { name, params })
				.then(result => resolve(result === undefined ? undefined : Cu.cloneInto(result, win)))
				.catch(e => reject(new win.Error(`${name}: ${e?.message || e}`)));
		});
	}
	
	_deliverToPage(data) {
		let win = this.contentWindow;
		if (!win) {
			return;
		}
		// Clone into the page's compartment before handing it to page listeners
		let cloned = Cu.cloneInto(data, win);
		for (let fn of this._pageListeners) {
			try {
				fn(cloned);
			}
			catch (e) {
				console.error(e);
			}
		}
	}
}
