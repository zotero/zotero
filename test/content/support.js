/**
 * Open a window. Returns a promise for the window.
 */
function loadWindow(winurl, argument) {
	var deferred = Q.defer();
	var win = window.openDialog(winurl, "_blank", "chrome", argument);
	var func = function() {
		win.removeEventListener("load", func, false);
		deferred.resolve(win);
	};
	win.addEventListener("load", func, false);
	return deferred.promise;
}

/**
 * Loads a Zotero pane in a new window. Returns the containing window.
 */
function loadZoteroPane() {
	return loadWindow("chrome://browser/content/browser.xul").then(function(win) {
		win.ZoteroOverlay.toggleDisplay(true);

		// Hack to wait for pane load to finish. This is the same hack
		// we use in ZoteroPane.js, so either it's not good enough
		// there or it should be good enough here.
		return Q.delay(52).then(function() {
			return win;
		});
	});
}

/**
 * Waits for a window with a specific URL to open. Returns a promise for the window.
 */
function waitForWindow(uri) {
	var deferred = Q.defer();
	Components.utils.import("resource://gre/modules/Services.jsm");
	var loadobserver = function(ev) {
		ev.originalTarget.removeEventListener("load", loadobserver, false);
		if(ev.target.location == uri) {
			Services.ww.unregisterNotification(winobserver);
			deferred.resolve(ev.target.docShell.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
				             getInterface(Components.interfaces.nsIDOMWindow));
		}
	};
	var winobserver = {"observe":function(subject, topic, data) {
		if(topic != "domwindowopened") return;
		var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
		win.addEventListener("load", loadobserver, false);
	}};
	var enumerator = Services.ww.registerNotification(winobserver);
	return deferred.promise;
}

/**
 * Waits for a single item event. Returns a promise for the item ID(s).
 */
function waitForItemEvent(event) {
	var deferred = Q.defer();
	var notifierID = Zotero.Notifier.registerObserver({notify:function(ev, type, ids, extraData) {
		if(ev == event) {
			Zotero.Notifier.unregisterObserver(notifierID);
			deferred.resolve(ids);
		}
	}}, ["item"]);
	return deferred.promise;
}

/**
 * Ensures that the PDF tools are installed, or installs them if not. Returns a promise.
 */
function installPDFTools() {
	if(Zotero.Fulltext.pdfConverterIsRegistered() && Zotero.Fulltext.pdfInfoIsRegistered()) {
		return Q(true);
	}

	// Begin install procedure
	return loadWindow("chrome://zotero/content/preferences/preferences.xul", {
		pane: 'zotero-prefpane-search',
		action: 'pdftools-install'
	}).then(function(win) {
		// Wait for confirmation dialog
		return waitForWindow("chrome://global/content/commonDialog.xul").then(function(dlg) {
			// Accept confirmation dialog
			dlg.document.documentElement.acceptDialog();

			// Wait for install to finish
			var deferred = Q.defer();
			var id = setInterval(function() {
				if(Zotero.Fulltext.pdfConverterIsRegistered() && Zotero.Fulltext.pdfInfoIsRegistered()) {
					win.close();
					clearInterval(id);
					deferred.resolve(true);
				}
			}, 500);
			return deferred.promise;
		});
	});
}

/**
 * Returns a promise for the nsIFile corresponding to the test data
 * directory (i.e., test/tests/data)
 */
function getTestDataDirectory() {
	Components.utils.import("resource://gre/modules/Services.jsm");
	var resource = Services.io.getProtocolHandler("resource").
	               QueryInterface(Components.interfaces.nsIResProtocolHandler),
	    resURI = Services.io.newURI("resource://zotero-unit-tests/data", null, null);
	return Services.io.newURI(resource.resolveURI(resURI), null, null).
	       QueryInterface(Components.interfaces.nsIFileURL).file;
}