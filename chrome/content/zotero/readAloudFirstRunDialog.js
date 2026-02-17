var Zotero_Read_Aloud_First_Run = new function () {
	let io;
	
	this.init = function () {
		io = window.arguments[0];
		
		this._dialog = document.getElementById('zotero-read-aloud-first-run');
		this._iframe = document.getElementById('read-aloud-first-run-iframe');

		let acceptButton = this._dialog.getButton('accept');
		acceptButton.disabled = true;

		document.addEventListener('dialogaccept', event => this.accept(event));
		document.addEventListener('dialogcancel', () => this.cancel());

		this._createReadAloudFirstRun();
	};

	this._createReadAloudFirstRun = function () {
		let { lang, ftl, getReadAloudRemoteInterface } = io.dataIn;

		let browserWindow = this._iframe.contentWindow;
		browserWindow.wrappedJSObject.createReadAloudFirstRun(Cu.cloneInto({
			lang,
			ftl,
			loggedIn: Zotero.Sync.Runner.enabled,
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
			onLogIn: () => {
				setTimeout(() => Zotero.Utilities.Internal.openPreferences('zotero-prefpane-sync'));
			},
			onSetDoneMode: ({ enabled, needsLogIn }) => {
				let acceptButton = this._dialog.getButton('accept');
				acceptButton.disabled = !enabled;
				if (needsLogIn) {
					acceptButton.label = Zotero.getString('reader-read-aloud-log-in-button');
					this._needsLogIn = true;
				}
				else {
					acceptButton.label = Zotero.getString('reader-read-aloud-done-button');
					this._needsLogIn = false;
				}
			},
		}, browserWindow, { cloneFunctions: true }));
	};

	this.accept = function (event) {
		if (this._needsLogIn) {
			this.cancel();
			Zotero.Utilities.Internal.openPreferences('zotero-prefpane-sync');
			return;
		}

		let result = this._iframe.contentWindow.wrappedJSObject.submit();
		if (result) {
			io.dataOut = result;
		}
		else {
			event.preventDefault();
		}
	};

	this.cancel = function () {
		io.dataOut = null;
	};
};
