var Zotero_Read_Aloud_Voices = new function () {
	let io;

	this.init = function () {
		io = window.arguments[0];

		this._dialog = document.getElementById('zotero-read-aloud-voices');
		this._iframe = document.getElementById('read-aloud-voices-iframe');

		document.addEventListener('dialogaccept', event => this.accept(event));
		document.addEventListener('dialogcancel', () => this.cancel());

		this._createReadAloudVoices();
	};

	this._createReadAloudVoices = function () {
		let { lang, tier, readAloudEnabledVoices, ftl, getReadAloudRemoteInterface } = io.dataIn;

		let browserWindow = this._iframe.contentWindow;
		browserWindow.wrappedJSObject.createReadAloudVoices(Cu.cloneInto({
			lang,
			tier,
			readAloudEnabledVoices,
			ftl,
			remoteInterface: getReadAloudRemoteInterface(browserWindow),
			onOpenLink: (url) => {
				let win = Services.wm.getMostRecentWindow('navigator:browser');
				if (win) {
					win.ZoteroPane.loadURI(url);
				}
			},
			onPurchaseCredits: () => {
				// TODO
			},
			onCancel: () => {
				this._dialog.cancelDialog();
			},
		}, browserWindow, { cloneFunctions: true }));
	};

	this.accept = function (event) {
		let results = this._iframe.contentWindow.wrappedJSObject.submit();
		if (results) {
			io.dataOut = Cu.cloneInto(results, window);
		}
		else {
			event.preventDefault();
		}
	};

	this.cancel = function () {
		io.dataOut = null;
	};
};
