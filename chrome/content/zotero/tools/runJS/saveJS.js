/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2021 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org

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

Components.utils.import("resource://gre/modules/osfile.jsm");

let textbox, acceptButton;
// eslint-disable-next-line no-unused-vars
async function onLoad() {
	textbox = document.getElementById('save-as');
	acceptButton = document.documentElement.getButton("accept");
}

// eslint-disable-next-line no-unused-vars
async function onKeyPress(event) {
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
		return;
	}

	if (textbox.value.length > 0) {
		if (event.keyCode == event.DOM_VK_RETURN) {
			accept();
			event.preventDefault();
		}
		else {
			acceptButton.disabled = false;
		}
	}
	else {
		acceptButton.disabled = true;
	}
}

// eslint-disable-next-line no-unused-vars
async function accept() {
	// Make sure we have some text
	if (textbox.value.length === 0) {
		return false;
	}
	
	let name = Zotero.File.getValidFileName(textbox.value);
	if (!name.endsWith('.js')) {
		name += '.js';
	}

	// Make sure file does not exist
	let force = document.getElementById('force-write').checked;
	let filePath = OS.Path.join(Zotero.getScriptsDirectory().path, name);
	if (!force && await OS.File.exists(filePath)) {
		document.getElementById('error-section').hidden = false;
		window.sizeToContent();
		return false;
	}

	window.arguments[0].dataOut = name;
	window.close();
	return true;
}
