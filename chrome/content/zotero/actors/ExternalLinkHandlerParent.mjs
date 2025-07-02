ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

export class ExternalLinkHandlerParent extends JSWindowActorParent {
	async receiveMessage({ name, data }) {
		switch (name) {
			case "launchURL": {
				Zotero.launchURL(data);
				return;
			}
		}
	}
}
