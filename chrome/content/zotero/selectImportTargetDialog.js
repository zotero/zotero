/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Center for History and New Media
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

Components.utils.import("resource://gre/modules/Services.jsm");

let io = window.arguments[0];
if (io.wrappedJSObject) io = io.wrappedJSObject;

let menulist;
let selectedTarget;

function load() {
	function selectTarget(libraryOrCollection) {
		menulist.setAttribute('label', libraryOrCollection.name);
		menulist.setAttribute('value', libraryOrCollection.treeViewID);
		selectedTarget = libraryOrCollection;
		// Menu looks too cramped with an icon
		menulist.removeAttribute('image');
	}

	async function createNewCollection(libraryID) {
		let name = Zotero.getMainWindow().Zotero_File_Interface.nameCollectionForImportedFile(
			file,
			libraryID,
			Zotero.getString("fileInterface.imported")
		);
		let newName = { value: name };
		let result = Services.prompt.prompt(window,
			Zotero.getString('pane.collections.newCollection'),
			Zotero.getString('pane.collections.name'), newName, '', {});
		if (result) {
			let collection = new Zotero.Collection();
			collection.libraryID = libraryID;
			collection.name = newName.value || name;
			await collection.saveTx();
			selectTarget(collection);
		}
	}

	let { file } = io.dataIn;

	document.title = Zotero.getString('ingester.importFile.title');
	document.getElementById('select-target-text').value
		= Zotero.getString('ingester.importFile.text', file.leafName);

	let isEditable = row => row.editable
        && (!file.leafName.endsWith('.pdf') || row.filesEditable);
	let libraries = Zotero.Libraries.getAll().filter(isEditable);

	let treeRow = Zotero.getActiveZoteroPane().getCollectionTreeRow();
	if (!isEditable(treeRow)) {
		selectedTarget = Zotero.Libraries.userLibrary;
	}
	else if (!treeRow.isLibrary() && !treeRow.isCollection()) {
		selectedTarget = Zotero.Libraries.get(treeRow.ref.libraryID);
	}
	else {
		selectedTarget = treeRow.ref;
	}

	menulist = document.getElementById('select-target-menu');
	menulist.setAttribute('label', selectedTarget.name || Zotero.Libraries.get(selectedTarget.libraryID).name);

	menulist.addEventListener('popupshowing', (event) => {
		let popup = document.getElementById('select-target-menu-popup');
		if (event.target !== popup) return;
		while (popup.childElementCount) {
			popup.removeChild(popup.firstChild);
		}
		for (let library of libraries) {
			let menu = Zotero.Utilities.Internal.createMenuForTarget(
				library,
				popup,
				{
					initialValue: selectedTarget.treeViewID,
					onChange(event, libraryOrCollection) {
						event.preventDefault();
						selectTarget(libraryOrCollection);
					},
					menusOnTopLevel: true
				}
			);

			let newCollectionMenuitem = document.createElement('menuitem');
			newCollectionMenuitem.setAttribute('label',
				Zotero.getString('ingester.importFile.newCollection'));
			newCollectionMenuitem.setAttribute('image',
				`chrome://zotero/skin/toolbar-collection-add${Zotero.hiDPISuffix}.png`);
			newCollectionMenuitem.classList.add('menuitem-iconic');
			newCollectionMenuitem.addEventListener('command', (event) => {
				event.stopPropagation();
				createNewCollection(library.libraryID);
			});

			if (menu.menupopup.childElementCount > 2) {
				menu.querySelector('menuseparator').before(newCollectionMenuitem);
			}
			else {
				menu.querySelector('menuseparator').replaceWith(newCollectionMenuitem);
			}
		}
	});
}

function accept() {
	io.dataOut.libraryID = selectedTarget.libraryID;
	if (selectedTarget.objectType === 'collection') {
		io.dataOut.collectionID = selectedTarget.id;
	}
}
