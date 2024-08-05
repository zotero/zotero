var EXPORTED_SYMBOLS = ["ExternalLinkHandlerChild"];


class ExternalLinkHandlerChild extends JSWindowActorChild {
	async handleEvent(event) {
		switch (event.type) {
			case "click": {
				let { button, target } = event;
				if (button !== 0) {
					return;
				}
				
				let href;
				if (target.localName === 'a' || target.localName === 'area') {
					href = target.href;
				}
				else if (target.localName === 'label' && target.classList.contains('text-link')) {
					href = target.getAttribute('href');
				}
				
				if (!href || this._shouldOpenInternally(href)) {
					return;
				}
				
				event.stopPropagation();
				event.preventDefault();
				await this._sendLaunchURL(href);
				break;
			}
		}
	}

	_shouldOpenInternally(href) {
		let hrefURL;
		try {
			hrefURL = new URL(href);
		}
		catch (e) {
			// Not a valid URL: open externally
			return false;
		}
		let currentURL = this.contentWindow.location;
		
		// eslint-disable-next-line no-script-url
		if (hrefURL.protocol === 'javascript:') {
			// Link executes a script: open internally
			return true;
		}
		
		if (hrefURL.origin + hrefURL.pathname + hrefURL.search === currentURL.origin + currentURL.pathname + currentURL.search
				&& hrefURL.hash) {
			// Link points to the same page with a hash: open internally
			return true;
		}

		if (hrefURL.origin === 'https://www.zotero.org' && /^\/styles\/[^/?#]+$/.test(hrefURL.pathname)) {
			// Links points directly to CSL in the repo: open internally
			return true;
		}
		
		// Everything else: open externally
		// This might include links that Zotero.launchURL() is just going to reject,
		// like chrome:// URLs, but we'll just let it print that error
		return false;
	}
	
	async _sendLaunchURL(url) {
		await this.sendAsyncMessage("launchURL", url);
	}
}
