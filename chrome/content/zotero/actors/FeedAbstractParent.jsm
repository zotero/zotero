var EXPORTED_SYMBOLS = ["FeedAbstractParent"];

ChromeUtils.defineESModuleGetters(this, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

class FeedAbstractParent extends JSWindowActorParent {
	async receiveMessage({ name, data }) {
		switch (name) {
			case "getStylesheet": {
				return Zotero.File.getResource('chrome://zotero/skin/feedAbstract.css');
			}
			
			case "resize": {
				this._resizeBrowser(data.offsetWidth, data.offsetHeight);
				return;
			}
		}
	}
	
	_resizeBrowser(width, height) {
		let browser = this.browsingContext?.embedderElement;
		if (!browser) return;
		browser.style.width = width + 'px';
		browser.style.height = height + 'px';
	}
}
