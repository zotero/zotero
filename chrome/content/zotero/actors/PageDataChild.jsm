var EXPORTED_SYMBOLS = ["PageDataChild"];

class PageDataChild extends JSWindowActorChild {
	async receiveMessage(message) {
		let window = this.contentWindow;
		let document = window.document;
		
		await this.documentIsReady();
		
		switch (message.name) {
			case "characterSet":
				return document.characterSet;
			
			case "title":
				return document.title;
			
			case "bodyText":
				return document.documentElement.innerText;
		}
	}
	
	// From Mozilla's ScreenshotsComponentChild.jsm
	documentIsReady() {
		const contentWindow = this.contentWindow;
		const document = this.document;
		
		// Make sure the document element has been created
		function readyEnough() {
			return document.readyState !== "uninitialized" && document.documentElement;
		}
		
		if (readyEnough()) {
			return Promise.resolve();
		}
		return new Promise((resolve, reject) => {
			function onChange(event) {
				if (event.type === "pagehide") {
					document.removeEventListener("readystatechange", onChange);
					contentWindow.removeEventListener("pagehide", onChange);
					reject(new Error("document unloaded before it was ready"));
				}
				else if (readyEnough()) {
					document.removeEventListener("readystatechange", onChange);
					contentWindow.removeEventListener("pagehide", onChange);
					resolve();
				}
			}
			document.addEventListener("readystatechange", onChange);
			contentWindow.addEventListener("pagehide", onChange, { once: true });
		});
	}
}
