/* global JSWindowActorParent:false */

var EXPORTED_SYMBOLS = ["MendeleyAuthParent"]; // eslint-disable-line no-unused-vars

ChromeUtils.defineESModuleGetters(this, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

class MendeleyAuthParent extends JSWindowActorParent { // eslint-disable-line no-unused-vars
	async receiveMessage({ name, data }) {
		switch (name) {
			case "debug": {
				if (data.kind === "log") {
					Zotero.debug(`MendeleyAuth actor: ${data.message}`);
				}
				else if (data.kind === "error") {
					Zotero.debug(`MendeleyAuth actor: ${data.message}. Error: ${data.error}`);
				}
			}
		}
	}
}
