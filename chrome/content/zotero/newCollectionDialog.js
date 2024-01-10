/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
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

var Zotero_New_Collection_Dialog = {
	_handleLoad() {
		let io = window.arguments[0];
		
		document.querySelector('#name').value = io.name;
		document.addEventListener('dialogaccept', () => this._handleAccept());
		
		this._libraryID = io.libraryID;
		this._parentCollectionID = io.parentCollectionID;
		this._updateMenu();
	},

	_handleAccept() {
		window.arguments[0].dataOut = {
			name: document.querySelector('#name').value,
			libraryID: this._libraryID,
			parentCollectionID: this._parentCollectionID
		};
	},

	_updateMenu() {
		let createInField = document.querySelector('#create-in');
		let menupopup = createInField.firstElementChild;
		// Fascinatingly, clearing the children of the menupopup isn't enough here.
		// We have to completely recreate it or it will no longer be willing to open.
		menupopup.replaceWith(menupopup = document.createXULElement('menupopup'));

		let createdNode = Zotero.Utilities.Internal.createMenuForTarget(
			Zotero.Libraries.get(this._libraryID),
			menupopup,
			this._parentCollectionID ? 'C' + this._parentCollectionID : 'L' + this._libraryID,
			(event, libraryOrCollection) => {
				this._libraryID = libraryOrCollection.libraryID;
				if (libraryOrCollection.objectType === 'collection') {
					this._parentCollectionID = libraryOrCollection.id;
				}
				else {
					this._parentCollectionID = null;
				}
				this._updateMenu();
			},
			null
		);
		// If createMenuForTarget() built a submenu, replace it with its child menuitems
		if (createdNode.menupopup) {
			createdNode.replaceWith(...createdNode.menupopup.children);
		}

		let checkedItem = menupopup.querySelector('[checked="true"]');
		createInField.setAttribute('label', checkedItem?.label || '');
		createInField.image = checkedItem?.image;
	}
};

