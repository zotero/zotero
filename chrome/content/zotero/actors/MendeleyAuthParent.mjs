/* global JSWindowActorParent:false */

ChromeUtils.defineESModuleGetters(this, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});  

export class MendeleyAuthParent extends JSWindowActorParent {  
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
