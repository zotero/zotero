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
	let { uri, options } = window.arguments[0].wrappedJSObject;

	browser = document.querySelector('browser');
	if (options?.cookieContextId) {
		// Set usercontextid on new <browser> so it takes effect
		let newBrowser = document.createXULElement('browser');
		for (let { name, value } of browser.attributes) {
			newBrowser.setAttribute(name, value);
		}
		newBrowser.setAttribute('usercontextid', String(options.cookieContextId));
		browser.replaceWith(newBrowser);
		browser = newBrowser;
	}
	window.gBrowser = browser; // For ZoomManager
	
	browser.addEventListener('pagetitlechanged', () => {
		document.title = browser.contentTitle || browser.currentURI.spec;
	});

	if (options?.customUserAgent) {
		browser.browsingContext.customUserAgent = options.customUserAgent;
	}

	window.viewerOriginalURI = uri;
	window.viewerCookieContextId = options?.cookieContextId;
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
	browser.loadURI(
		uri,
		{
			triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
		}
	);
}
