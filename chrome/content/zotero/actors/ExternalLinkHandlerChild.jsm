var EXPORTED_SYMBOLS = ["ExternalLinkHandlerChild"];


class ExternalLinkHandlerChild extends JSWindowActorChild {
	async handleEvent(event) {
		switch (event.type) {
			case "click": {
				let { button, target } = event;
				if (button !== 0) {
					break;
				}
				if ((target.localName === 'a' || target.localName === 'area') && target.href
						|| target.localName === 'label' && target.classList.contains('text-link')) {
					event.stopPropagation();
					event.preventDefault();
					await this._sendLaunchURL(target.href || target.getAttribute('href'));
				}
				break;
			}
		}
	}
	
	async _sendLaunchURL(url) {
		await this.sendAsyncMessage("launchURL", url);
	}
}
