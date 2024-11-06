/* global JSWindowActorChild:false */

var EXPORTED_SYMBOLS = ["MendeleyAuthChild"]; // eslint-disable-line no-unused-vars

class MendeleyAuthChild extends JSWindowActorChild { // eslint-disable-line no-unused-vars
	async receiveMessage(message) {
		let window = this.contentWindow;
		let document = window.document;

		await this.documentIsReady();

		switch (message.name) {
			case "login":
				try {
					document.querySelector('input[name="pf.username"]').value = message.data.login;
					document.querySelector("button[value=emailContinue]").removeAttribute("disabled");
					document.querySelector("button[value=emailContinue]").click();
					return true;
				}
				catch (e) {
					this.sendAsyncMessage('debug', { kind: 'error', message: 'Failed to enter login', error: e.message });
				}
				break;
			case "password":
				try {
					document.querySelector('input[name="password"]').value = message.data.password;
					document.querySelector("button[type=submit][value=signin]").removeAttribute("disabled");
					document.querySelector("button[type=submit][value=signin]").click();
					return true;
				}
				catch (e) {
					this.sendAsyncMessage('debug', { kind: 'error', message: 'Failed to enter password', error: e.message });
				}
				break;
		}

		return false;
	}
	
	// From Mozilla's ScreenshotsComponentChild.jsm
	documentIsReady() {
		const contentWindow = this.contentWindow;
		const document = this.document;
		
		function readyEnough() {
			return document.readyState === "complete";
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
