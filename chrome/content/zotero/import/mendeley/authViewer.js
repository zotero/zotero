/* eslint camelcase: ["error", {allow: ["Zotero_File_Interface"]} ] */
/* global Zotero_File_Interface: false */

Services.scriptloader.loadSubScript("chrome://zotero/content/fileInterface.js", window);
const { E10SUtils } = ChromeUtils.import("resource://gre/modules/E10SUtils.jsm");
const URI = `https://api.mendeley.com/oauth/authorize?client_id=5907&redirect_uri=https%3A%2F%2Fzotero-static.s3.amazonaws.com%2Fmendeley_oauth_redirect.html&response_type=code&state=&scope=all`;
var startTime;

const tryExtractAuthCode = (browser) => {
	const matchResult = browser.webNavigation.currentURI.spec
		.match(/mendeley_oauth_redirect.html(?:.*?)(?:\?|&)code=(.*?)(?:&|$)/i);
	return matchResult ? matchResult[1] : false;
};

const clearCookies = (since) => {
	const cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);
	const sinceμs = since * 1000;
	const cookiesSince = cookieManager.getCookiesSince(sinceμs);
	Zotero.debug(`Deleting ${cookiesSince.length} cookies created during Mendeley Auth (last ${(Date.now() - since)}ms)`);
	cookieManager.removeAllSince(sinceμs);
};


window.addEventListener('unload', () => {
	clearCookies(startTime);
});

window.addEventListener("load", () => {
	// basicViewer uses remote="false" browser, we need to re-construct the browser so it's
	// capable of loading a mendeley auth website
	const browser = document.querySelector('browser');
	browser.setAttribute('remote', 'true');
	browser.changeRemoteness({ remoteType: E10SUtils.DEFAULT_REMOTE_TYPE });
	browser.construct();

	startTime = Date.now();

	browser.addEventListener("pagetitlechanged", (_event) => {
		const mendeleyCode = tryExtractAuthCode(browser);
		if (mendeleyCode) {
			window.close();
			Zotero_File_Interface.showImportWizard({ mendeleyCode });
		}
		document.title = browser.contentTitle;
	});

	browser.loadURI(URI, {
		triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
	});
}, false);
