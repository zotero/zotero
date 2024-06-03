var EXPORTED_SYMBOLS = ["ExternalLinkHandlerParent"];

ChromeUtils.defineESModuleGetters(this, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

class ExternalLinkHandlerParent extends JSWindowActorParent {
	async receiveMessage({ name, data }) {
		switch (name) {
			case "launchURL": {
				Zotero.launchURL(data);
				return;
			}
		}
	}
}
