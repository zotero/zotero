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

var browser;
function loadURI() {
	browser.loadURI.apply(browser, arguments);
}

window.addEventListener("load", function() {
	browser = document.getElementById('my-browser');
	
	// align page title with title of shown document
	browser.addEventListener("pageshow", function() {
		document.title = (browser.contentDocument.title
			? browser.contentDocument.title
			: browser.contentDocument.location.href);
	}, false);
	
	// show document
	browser.loadURI.apply(browser, window.arguments);
	
	// XXX Why is this necessary to make the scroll bars appear?
	window.setTimeout(function() {
		document.getElementById("my-browser").style.overflow = "auto";
	}, 0);
}, false);

window.addEventListener("keypress", function (event) {
	// Cmd-R/Ctrl-R (with or without Shift) to reload
	if (((Zotero.isMac && event.metaKey && !event.ctrlKey)
			|| (!Zotero.isMac && event.ctrlKey))
			&& !event.altKey && event.which == 114) {
		browser.reloadWithFlags(browser.webNavigation.LOAD_FLAGS_BYPASS_CACHE);
	}
});

// Handle <label class="text-link />
window.addEventListener("click", function (event) {
	if (event.originalTarget.localName == 'label'
			&& event.originalTarget.classList.contains('text-link')) {
		Zotero.launchURL(event.originalTarget.getAttribute('href'));
	}
});
