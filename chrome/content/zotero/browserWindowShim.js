// Try our very hardest to look like a browser window so Firefox doesn't make its own
// We're faking it like Thunderbird does in a couple places:
//   https://searchfox.org/comm-esr128/rev/c0882dde78e3fb440d2c0bb730e9ac5377762cbf/mail/base/content/mailWindow.js
//   https://searchfox.org/comm-esr128/rev/c0882dde78e3fb440d2c0bb730e9ac5377762cbf/mail/components/extensions/extensionPopup.js
// But we can try a little less hard because our browsers will never be visible


var { AppConstants } = ChromeUtils.importESModule(
	"resource://gre/modules/AppConstants.sys.mjs"
);
var { XPCOMUtils } = ChromeUtils.importESModule(
	"resource://gre/modules/XPCOMUtils.sys.mjs"
);

// In case PrintUtils isn't already loaded:
XPCOMUtils.defineLazyScriptGetter(
	window,
	"PrintUtils",
	"chrome://global/content/printUtils.js"
);

class nsBrowserAccess {
	QueryInterface = ChromeUtils.generateQI(["nsIBrowserDOMWindow"]);

	_openURIInNewTab() {
		// Callers pass this method all kinds of crazy arguments,
		// but it seems like we don't need anything complicated:
		let browser = document.createXULElement('browser');
		browser.hidden = true;
		document.documentElement.appendChild(browser);
		return browser;
	}

	createContentWindow(
		aURI,
		aOpenWindowInfo,
		aWhere,
		aFlags,
		aTriggeringPrincipal,
		aCsp
	) {
		return this.getContentWindowOrOpenURI(
			null,
			aOpenWindowInfo,
			aWhere,
			aFlags,
			aTriggeringPrincipal,
			aCsp,
			true
		);
	}

	createContentWindowInFrame(aURI, aParams, aWhere, aFlags, aName) {
		// Passing a null-URI to only create the content window,
		// and pass true for aSkipLoad to prevent loading of
		// about:blank
		return this.getContentWindowOrOpenURIInFrame(
			null,
			aParams,
			aWhere,
			aFlags,
			aName,
			true
		);
	}

	openURI(aURI, aOpenWindowInfo, aWhere, aFlags, aTriggeringPrincipal, aCsp) {
		if (!aURI) {
			throw Components.Exception(
				"openURI should only be called with a valid URI",
				Cr.NS_ERROR_FAILURE
			);
		}
		return this.getContentWindowOrOpenURI(
			aURI,
			aOpenWindowInfo,
			aWhere,
			aFlags,
			aTriggeringPrincipal,
			aCsp,
			false
		);
	}

	openURIInFrame(aURI, aParams, aWhere, aFlags, aName) {
		return this.getContentWindowOrOpenURIInFrame(
			aURI,
			aParams,
			aWhere,
			aFlags,
			aName,
			false
		);
	}

	getContentWindowOrOpenURI(
		aURI,
		aOpenWindowInfo,
		aWhere,
		aFlags,
		aTriggeringPrincipal,
		aCsp,
		aSkipLoad
	) {
		if (aWhere == Ci.nsIBrowserDOMWindow.OPEN_PRINT_BROWSER) {
			const browser =
				PrintUtils.handleStaticCloneCreatedForPrint(aOpenWindowInfo);
			return browser ? browser.browsingContext : null;
		}

		const isExternal = !!(aFlags & Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL);

		if (aOpenWindowInfo && isExternal) {
			throw Components.Exception(
				"nsBrowserAccess.openURI did not expect aOpenWindowInfo to be " +
				"passed if the context is OPEN_EXTERNAL.",
				Cr.NS_ERROR_FAILURE
			);
		}

		if (isExternal && aURI && aURI.schemeIs("chrome")) {
			Services.console.logStringMessage(
				"use -chrome command-line option to load external chrome urls\n"
			);
			return null;
		}

		const ReferrerInfo = Components.Constructor(
			"@mozilla.org/referrer-info;1",
			"nsIReferrerInfo",
			"init"
		);

		let referrerInfo;
		if (aFlags & Ci.nsIBrowserDOMWindow.OPEN_NO_REFERRER) {
			referrerInfo = new ReferrerInfo(Ci.nsIReferrerInfo.EMPTY, false, null);
		} else if (
			aOpenWindowInfo &&
			aOpenWindowInfo.parent &&
			aOpenWindowInfo.parent.window
		) {
			referrerInfo = new ReferrerInfo(
				aOpenWindowInfo.parent.window.document.referrerInfo.referrerPolicy,
				true,
				Services.io.newURI(aOpenWindowInfo.parent.window.location.href)
			);
		} else {
			referrerInfo = new ReferrerInfo(Ci.nsIReferrerInfo.EMPTY, true, null);
		}

		if (aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWTAB) {
			Services.console.logStringMessage(
				"Opening a URI in something other than a new tab is not supported, opening in new tab instead"
			);
		}

		const browser = this._openURIInNewTab(
			aURI,
			referrerInfo,
			isExternal,
			aOpenWindowInfo,
			aTriggeringPrincipal,
			aCsp,
			aSkipLoad,
			aOpenWindowInfo?.openerBrowser?.getAttribute("messagemanagergroup")
		);

		return browser ? browser.browsingContext : null;
	}

	getContentWindowOrOpenURIInFrame(
		aURI,
		aParams,
		aWhere,
		aFlags,
		aName,
		aSkipLoad
	) {
		if (aWhere == Ci.nsIBrowserDOMWindow.OPEN_PRINT_BROWSER) {
			return PrintUtils.handleStaticCloneCreatedForPrint(
				aParams.openWindowInfo
			);
		}

		if (aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWTAB) {
			Services.console.logStringMessage(
				"Error: openURIInFrame can only open in new tabs or print"
			);
			return null;
		}

		const isExternal = !!(aFlags & Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL);

		return this._openURIInNewTab(
			aURI,
			aParams.referrerInfo,
			isExternal,
			aParams.openWindowInfo,
			aParams.triggeringPrincipal,
			aParams.csp,
			aSkipLoad,
			aParams.openerBrowser?.getAttribute("messagemanagergroup")
		);
	}

	canClose() {
		return true;
	}

	get tabCount() {
		return 1;
	}
}

window.addEventListener("DOMContentLoaded", () => {
	window.docShell.treeOwner
		.QueryInterface(Ci.nsIInterfaceRequestor)
		.getInterface(Ci.nsIAppWindow).XULBrowserWindow = window.XULBrowserWindow;
	window.browserDOMWindow = new nsBrowserAccess();
});
