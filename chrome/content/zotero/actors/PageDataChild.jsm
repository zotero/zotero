var EXPORTED_SYMBOLS = ["PageDataChild"];

let { documentIsReady } = ChromeUtils.importESModule("chrome://zotero/content/actors/actorUtils.mjs");

class PageDataChild extends JSWindowActorChild {
	async receiveMessage(message) {
		// Special case for loadURI: don't wait for document to be ready,
		// since we haven't loaded anything yet
		if (message.name === "loadURI") {
			return this.loadURI(message.data.uri);
		}
		
		let document = this.document;
		
		// Wait for 'interactive' or 'complete'
		await documentIsReady(document, { allowInteractiveAfter: 0 });
		
		switch (message.name) {
			case "characterSet":
				return document.characterSet;
			
			case "title":
				return document.title;
			
			case "bodyText":
				return document.documentElement.innerText;
			
			case "cookie":
				return document.cookie;
			
			case "documentHTML":
				return new XMLSerializer().serializeToString(document);
			
			case "channelInfo": {
				let docShell = this.contentWindow.docShell;
				try {
					let channel = (docShell.currentDocumentChannel || docShell.failedChannel)
						?.QueryInterface(Ci.nsIHttpChannel);
					if (channel) {
						return {
							responseStatus: channel.responseStatus,
							responseStatusText: channel.responseStatusText
						};
					}
				}
				catch (e) {}
				return null;
			}
		}
	}
	
	loadURI(uri) {
		// https://searchfox.org/mozilla-central/rev/e69f323af80c357d287fb6314745e75c62eab92a/toolkit/actors/BackgroundThumbnailsChild.sys.mjs#44-85
		let docShell = this.docShell.QueryInterface(Ci.nsIWebNavigation);
		// Don't allow downloads/external apps
		docShell.allowContentRetargeting = false;

		// Get the document to force a content viewer to be created, otherwise
		// the first load can fail.
		if (!this.document) {
			return false;
		}
		
		let loadURIOptions = {
			triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
		};
		
		try {
			docShell.loadURI(
				Services.io.newURI(uri),
				loadURIOptions
			);
			return true;
		}
		catch (e) {
			return false;
		}
	}
}
