var EXPORTED_SYMBOLS = ["SequoiaContextMenuParent"];

class SequoiaContextMenuParent extends JSWindowActorParent {
	async receiveMessage({ name, data }) {
		switch (name) {
			case "openContextMenuAtScreen": {
				let { screenX, screenY } = data;
				let browser = this.browsingContext?.embedderElement;
				if (!browser) {
					return;
				}
				let contextMenuID = browser.closest('[context]')?.getAttribute('context');
				let contextMenu = browser.ownerDocument.getElementById(contextMenuID);
				if (!contextMenu) {
					return;
				}
				contextMenu.openPopupAtScreen(screenX, screenY, true);
			}
		}
	}
}
