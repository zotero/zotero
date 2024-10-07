var { getTargetElement, createContextMenuEvent } = ChromeUtils.importESModule("chrome://zotero/content/contextMenuUtils.sys.mjs");

var EXPORTED_SYMBOLS = ["SequoiaContextMenuChild"];

/**
 * Child-frame implementation of macOS Sequoia Ctrl-Enter context menu behavior.
 * See platformKeys.js for the chrome implementation.
 */
class SequoiaContextMenuChild extends JSWindowActorChild {
	_lastPreventedContextMenuTime = 0;
	
	async receiveMessage({ name }) {
		switch (name) {
			case "handleContextMenuEvent": {
				// Chrome code received a contextmenu event and wants us to handle it
				this._handleContextMenuEvent();
			}
		}
	}
	
	_handleContextMenuEvent() {
		let targetElement = getTargetElement(this.document);
		if (!targetElement) {
			return;
		}
		if ('browsingContext' in targetElement) {
			// Recursively call child SequoiaContextMenu actor
			targetElement.browsingContext.currentWindowGlobal.getActor('SequoiaContextMenu')
				.sendAsyncMessage('handleContextMenuEvent');
			return;
		}
		let contextMenuEvent = createContextMenuEvent(targetElement);
		let showNative = targetElement.dispatchEvent(contextMenuEvent);
		// If default wasn't prevented, tell our parent to show the
		// embedding browser's context menu
		if (showNative) {
			this.sendAsyncMessage("openContextMenuAtScreen", {
				screenX: contextMenuEvent.screenX,
				screenY: contextMenuEvent.screenY,
			});
		}
	}
}
