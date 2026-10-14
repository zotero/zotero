// Per-page actor running in an embedded plugin page's own process (see
// embeddedPage.mjs): injects window.zoteroHost messaging and drives auto-resize.
export class ZoteroEmbeddedPluginPageChild extends JSWindowActorChild {
	_resizeObserver = null;
	
	_resizeAxes = { height: false, width: false };
	
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
				this._startAutoResize();
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
		let api = Cu.createObjectIn(win, { defineAs: "zoteroHost" });
		Cu.exportFunction(data => this.sendAsyncMessage("fromPage", data), api, { defineAs: "sendMessage" });
		Cu.exportFunction(fn => this._pageListeners.add(fn), api, { defineAs: "addMessageListener" });
		Cu.exportFunction(fn => this._pageListeners.delete(fn), api, { defineAs: "removeMessageListener" });
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
		// A root that only fills the viewport (auto width, 100% height) echoes viewport
		// changes back and spirals when a scrollbar appears, so report only sizes the
		// page expresses itself; ceil so a fractional size can't leave 1px of overflow
		let rect = root.getBoundingClientRect();
		let size = {};
		if (this._resizeAxes.height && Math.abs(rect.height - root.clientHeight) > 1) {
			size.height = Math.ceil(rect.height);
		}
		if (this._resizeAxes.width && Math.abs(rect.width - root.clientWidth) > 1) {
			size.width = Math.ceil(rect.width);
		}
		if ("height" in size || "width" in size) {
			this.sendAsyncMessage("resize", size);
		}
	}
}
