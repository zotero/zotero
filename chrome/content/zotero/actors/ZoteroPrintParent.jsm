var EXPORTED_SYMBOLS = ["ZoteroPrintParent"];

const { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
});

ChromeUtils.defineESModuleGetters(this, {
	Zotero: "chrome://zotero/content/zotero.mjs",
});

class ZoteroPrintParent extends JSWindowActorParent {
	async receiveMessage({ name, data }) {
		switch (name) {
			case "zoteroPrint": {
				await this.zoteroPrint(data || {});
			}
		}
	}

	/**
	 * A custom print function to work around Zotero 7 printing issues
	 * @param {Object} [options]
	 * @param {Object} [options.overrideSettings] PrintUtils.getPrintSettings() settings to override
	 * @returns {Promise<void>}
	 */
	async zoteroPrint(options = {}) {
		let win = Zotero.getMainWindow();
		if (win) {
			let { PrintUtils } = win;
			let settings = PrintUtils.getPrintSettings("", false);
			Object.assign(settings, options.overrideSettings || {});
			let doPrint = await PrintUtils.handleSystemPrintDialog(
				this.browsingContext.topChromeWindow, false, settings
			);
			if (doPrint) {
				let printPromise = this.browsingContext.print(settings);
				// An ugly hack to close the browser window that has a static clone
				// of the content that is being printed. Without this, the window
				// will be open while transferring the content into system print queue,
				// which can take time for large PDF files
				let win = Services.wm.getMostRecentWindow("navigator:browser");
				if (win?.document?.getElementById('statuspanel')) {
					win.close();
				}
				await printPromise;
			}
		}
	}
}
