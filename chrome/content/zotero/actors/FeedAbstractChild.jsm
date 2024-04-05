var EXPORTED_SYMBOLS = ["FeedAbstractChild"];


class FeedAbstractChild extends JSWindowActorChild {
	_stylesheet;
	
	_stylesheetPromise;
	
	actorCreated() {
		this._stylesheetPromise = this.sendQuery('getStylesheet');
	}
	
	async handleEvent(event) {
		switch (event.type) {
			case "DOMDocElementInserted": {
				await this._injectStylesheet();
				new this.contentWindow.ResizeObserver(() => this._sendResize())
					.observe(this._getResizeRoot());
				await this._sendResize();
				this.contentWindow.requestAnimationFrame(() => {
					this.sendAsyncMessage("show");
				});
				break;
			}
		}
	}
	
	async _sendResize() {
		let root = this._getResizeRoot();
		await this.sendAsyncMessage("resize", { offsetWidth: root.offsetWidth, offsetHeight: root.offsetHeight });
	}
	
	_getResizeRoot() {
		return this.document.documentElement;
	}
	
	async _injectStylesheet() {
		if (!this._stylesheet) {
			this._stylesheet = new this.contentWindow.CSSStyleSheet();
			this._stylesheet.replaceSync(await this._stylesheetPromise);
		}
		
		this.document.wrappedJSObject.adoptedStyleSheets.push(this._stylesheet);
	}
}
