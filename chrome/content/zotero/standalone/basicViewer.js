/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

/*const { E10SUtils } = ChromeUtils.import(
	"resource://gre/modules/E10SUtils.jsm"
);*/

const SANDBOXED_SCRIPTS = 0x80;

var browser;

window.addEventListener("load", /*async */function () {
	browser = document.querySelector('browser');
	
	browser.addEventListener('pagetitlechanged', () => {
		document.title = browser.contentTitle || browser.currentURI.spec;
	});
	
	/*
	browser.setAttribute("remote", "true");
	//browser.setAttribute("remoteType", E10SUtils.EXTENSION_REMOTE_TYPE);
	
	await new Promise((resolve) => {
		browser.addEventListener("XULFrameLoaderCreated", () => resolve());
	});
	*/
	
	/*browser.messageManager.loadFrameScript(
		'chrome://zotero/content/standalone/basicViewerContent.js',
		false
	);*/
	//browser.docShellIsActive = false;

	// Get URI and options passed in via openWindow()
	let { uri, options } = window.arguments[0].wrappedJSObject;
	window.viewerOriginalURI = uri;
	loadURI(Services.io.newURI(uri), options);
}, false);

window.addEventListener("keypress", function (event) {
	// Cmd-R/Ctrl-R (with or without Shift) to reload
	if (((Zotero.isMac && event.metaKey && !event.ctrlKey)
			|| (!Zotero.isMac && event.ctrlKey))
			&& !event.altKey && event.which == 114) {
		browser.reloadWithFlags(browser.webNavigation.LOAD_FLAGS_BYPASS_CACHE);
	}
});

window.addEventListener('dragover', (e) => {
	// Prevent default to allow drop (e.g. to allow dropping an XPI on the Add-ons window)
	e.preventDefault();
});

function loadURI(uri, options = {}) {
	// browser.browsingContext.allowJavascript (sic) would seem to do what we want here,
	// but it has no effect. So we use sandboxFlags instead:
	if (options.allowJavaScript !== false) {
		browser.browsingContext.sandboxFlags &= ~SANDBOXED_SCRIPTS;
	}
	else {
		browser.browsingContext.sandboxFlags |= SANDBOXED_SCRIPTS;
	}
	if (options.cookieSandbox) {
		options.cookieSandbox.attachToBrowser(browser);
	}
	browser.loadURI(
		uri,
		{
			triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
		}
	);
}
