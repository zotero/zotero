var EXPORTED_SYMBOLS = ["DocumentIsReadyChild"];

let { documentIsReady } = ChromeUtils.importESModule("chrome://zotero/content/actors/actorUtils.mjs");

class DocumentIsReadyChild extends JSWindowActorChild {
	async receiveMessage({ name, data }) {
		if (name !== "waitForDocument") {
			return null;
		}

		let { allowInteractiveAfter } = data;
		await documentIsReady(this.document, { allowInteractiveAfter });
	}
}
