// Per-page actor running in an embedded plugin page's own process (see
// embeddedPage.mjs): injects window.zoteroHost messaging and drives auto-resize.
export class ZoteroEmbeddedPluginPageChild extends JSWindowActorChild {
	_resizeObserver = null;
	
	_resizeAxes = { height: false, width: false };
	
	_resizeContent = false;
	
	_lastSize = null;
	
	_pageListeners = new Set();
	
	_injected = false;
	
	handleEvent(event) {
		if (event.type === "DOMDocElementInserted") {
			this._injectMessaging();
		}
	}
	
	receiveMessage({ name, data }) {
		switch (name) {
			case "toPage":
				this._deliverToPage(data);
				break;
			case "startAutoResize":
				this._resizeAxes = { height: !!data.height, width: !!data.width };
				this._resizeContent = !!data.content;
				this._startAutoResize();
				break;
			case "stopAutoResize":
				this._resizeObserver?.disconnect();
				this._resizeObserver = null;
				break;
		}
	}
	
	didDestroy() {
		this._resizeObserver?.disconnect();
		this._resizeObserver = null;
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
	
	// Observe the content and report its size to the parent, which sizes the host
	_startAutoResize() {
		if (this._resizeObserver || (!this._resizeAxes.height && !this._resizeAxes.width)) {
			return;
		}
		this._resizeObserver = new this.contentWindow.ResizeObserver(() => this._sendResize());
		this._resizeObserver.observe(this.document.documentElement);
		this._sendResize();
	}
	
	_sendResize() {
		let root = this.document?.documentElement;
		if (!root) {
			return;
		}
		let size = {};
		if (this._resizeContent) {
			// Full document scroll size, for a host that fits itself to the page
			if (this._resizeAxes.height) {
				size.height = root.scrollHeight;
			}
			if (this._resizeAxes.width) {
				size.width = root.scrollWidth;
			}
		}
		else {
			// A viewport-filling root echoes viewport changes back and spirals when a
			// scrollbar appears, so report only sizes the page expresses itself (ceiled)
			let rect = root.getBoundingClientRect();
			if (this._resizeAxes.height && Math.abs(rect.height - root.clientHeight) > 1) {
				size.height = Math.ceil(rect.height);
			}
			if (this._resizeAxes.width && Math.abs(rect.width - root.clientWidth) > 1) {
				size.width = Math.ceil(rect.width);
			}
		}
		if (!("height" in size) && !("width" in size)) {
			return;
		}
		// Skip repeats so a viewport echo can't ping-pong with the parent
		if (this._lastSize
				&& this._lastSize.height === size.height
				&& this._lastSize.width === size.width) {
			return;
		}
		this._lastSize = size;
		this.sendAsyncMessage("resize", size);
	}
}
