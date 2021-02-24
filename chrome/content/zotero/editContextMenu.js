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

// Support context menus on HTML text boxes
//
// Adapted from editMenuOverlay.js in Fx68
// This entire file can be replaced with that file when Zotero upgrades.
//
// Currently it requires both:
// `chrome://global/content/editMenuOverlay.js`
// `chrome://global/content/globalOverlay.js`

window.addEventListener(
	"DOMContentLoaded",
	() => {
		let commands = document.createElement('commandset');

		let commandSetAll = document.createElement('commandset');
		commandSetAll.id = 'editMenuCommandSetAll';
		commandSetAll.setAttribute('commandupdater', 'true');
		commandSetAll.setAttribute('events', 'focus,select');
		commandSetAll.setAttribute('oncommandupdate', 'goUpdateGlobalEditMenuItems()');
		commands.appendChild(commandSetAll);

		let commandSetUndo = document.createElement('commandset');
		commandSetUndo.id = 'editMenuCommandSetUndo';
		commandSetUndo.setAttribute('commandupdater', 'true');
		commandSetUndo.setAttribute('events', 'undo');
		commandSetUndo.setAttribute('oncommandupdate', 'goUpdateUndoEditMenuItems()');
		commands.appendChild(commandSetUndo);

		let commandSetPaste = document.createElement('commandset');
		commandSetPaste.id = 'editMenuCommandSetPaste';
		commandSetPaste.setAttribute('commandupdater', 'true');
		commandSetPaste.setAttribute('events', 'clipboard');
		commandSetPaste.setAttribute('oncommandupdate', 'goUpdatePasteMenuItems()');
		commands.appendChild(commandSetPaste);

		const createCommand = function (name) {
			let command = document.createElement('command');
			command.id = `cmd_${name}`;
			command.setAttribute('oncommand', `goDoCommand('cmd_${name}')`);
			return command;
		};

		commands.appendChild(createCommand('undo'));
		commands.appendChild(createCommand('cut'));
		commands.appendChild(createCommand('copy'));
		commands.appendChild(createCommand('paste'));
		commands.appendChild(createCommand('delete'));
		commands.appendChild(createCommand('selectAll'));

		let container = document.querySelector("commandset") || document.documentElement;
		container.appendChild(commands);
	},
	{ once: true }
);

function createContentAreaContextMenuItem(name) {
	let item = document.createElement('menuitem');
	item.id = 'context-' + name.toLowerCase();
	item.setAttribute('label', Zotero.Intl.strings[name + 'Cmd.label']);
	item.setAttribute('accesskey', Zotero.Intl.strings[name + 'Cmd.accesskey']);
	item.setAttribute('command', 'cmd_' + name);
	return item;
}

function createContentAreaContextMenu() {
	let menupopup = document.createElement('menupopup');
	menupopup.id = 'contentAreaContextMenu';

	menupopup.appendChild(createContentAreaContextMenuItem('undo'));
	let undoSep = document.createElement('menuseparator');
	undoSep.id = 'context-sep-undo';
	menupopup.appendChild(undoSep);
	menupopup.appendChild(createContentAreaContextMenuItem('cut'));
	menupopup.appendChild(createContentAreaContextMenuItem('copy'));
	menupopup.appendChild(createContentAreaContextMenuItem('paste'));
	menupopup.appendChild(createContentAreaContextMenuItem('delete'));
	let pasteSep = document.createElement('menuseparator');
	pasteSep.id = 'context-sep-paste';
	menupopup.appendChild(pasteSep);
	menupopup.appendChild(createContentAreaContextMenuItem('selectAll'));

	document.documentElement.appendChild(menupopup);
	return menupopup;
}

window.addEventListener("contextmenu", e => {
	const HTML_NS = "http://www.w3.org/1999/xhtml";
	let needsContextMenu =
		e.target.ownerDocument == document &&
		!e.defaultPrevented &&
		e.target.parentNode.nodeName != "moz-input-box" &&
		((["textarea", "input"].includes(e.target.localName) &&
			e.target.namespaceURI == HTML_NS) ||
			e.target.closest("search-textbox"));

	if (!needsContextMenu) {
		return;
	}

	let popup = document.getElementById("contentAreaContextMenu")
		|| createContentAreaContextMenu();

	goUpdateGlobalEditMenuItems(true);
	popup.openPopupAtScreen(e.screenX, e.screenY, true);
	// Don't show any other context menu at the same time. There can be a
	// context menu from an ancestor too but we only want to show this one.
	e.preventDefault();
});
