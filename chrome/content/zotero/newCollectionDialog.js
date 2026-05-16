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

import CollectionTree from 'zotero/collectionTree';

var Zotero_New_Collection_Dialog = {
	_handleLoad() {
		let io = window.arguments[0];
		
		let nameElem = document.querySelector('#name');
		nameElem.value = io.name;
		nameElem.select();
		document.addEventListener('dialogaccept', () => this._handleAccept());
		
		this._libraryID = io.libraryID;
		this._parentCollectionID = io.parentCollectionID;

		// depending on how many collections there are, display the dropdown
		// or the entire collection tree
		if (Zotero.Collections.canListCollectionsInMenu(this._libraryID)) {
			document.getElementById("create-in").hidden = false;
			this._updateMenu();
		}
		else {
			document.getElementById("zotero-collections-tree-container").hidden = false;
			setTimeout(() => {
				window.moveToAlertPosition();
				this._initCollectionTree();
			});
		}
	},

	_handleAccept() {
		window.arguments[0].dataOut = {
			name: document.querySelector('#name').value,
			libraryID: this._libraryID,
			parentCollectionID: this._parentCollectionID
		};
	},

	async _initCollectionTree() {
		this._collectionsView = await CollectionTree.init(document.getElementById('zotero-collections-tree'), {
			onSelectionChange: () => {
				let selectedCollection = this._collectionsView.getSelectedCollection();
				this._parentCollectionID = selectedCollection ? selectedCollection.id : null;
			},
			filterLibraryIDs: [this._libraryID],
			hideSources: ['duplicates', 'trash', 'feeds', 'unfiled', 'retracted', 'publications', 'searches', 'recentlyRead']
		});
		
		await this._collectionsView.makeVisible();
		
		if (this._parentCollectionID) {
			await this._collectionsView.selectByID('C' + this._parentCollectionID);
		}
		else {
			await this._collectionsView.selectByID('L' + this._libraryID);
		}
	},

	_updateMenu() {
		let createInField = document.querySelector('#create-in');
		let menupopup = createInField.firstElementChild;
		menupopup.replaceChildren();

		let createdNode = Zotero.Utilities.Internal.createMenuForTarget(
			Zotero.Libraries.get(this._libraryID),
			menupopup,
			this._parentCollectionID ? 'C' + this._parentCollectionID : 'L' + this._libraryID,
			(event, libraryOrCollection) => {
				// if a menu for a collection with children is clicked, close the entire menu,
				// otherwise it oddly remains open
				if (event.target.tagName == "menu") {
					menupopup.hidePopup();
				}
				this._libraryID = libraryOrCollection.libraryID;
				if (libraryOrCollection.objectType === 'collection') {
					this._parentCollectionID = libraryOrCollection.id;
				}
				else {
					this._parentCollectionID = null;
				}
				this._updateSelectedCollectionLabel();
			},
			null
		);
		// If createMenuForTarget() built a submenu, replace it with its child menuitems
		if (createdNode.menupopup) {
			createdNode.replaceWith(...createdNode.menupopup.children);
		}

		this._updateSelectedCollectionLabel();
	},

	_updateSelectedCollectionLabel() {
		let createInField = document.querySelector('#create-in');
		let selectedID = this._parentCollectionID ? 'C' + this._parentCollectionID : 'L' + this._libraryID;
		let checkedItem = createInField.querySelector(`[value="${selectedID}"]`);
		createInField.setAttribute('label', checkedItem?.label || '');
		createInField.image = checkedItem?.image;
	}
};

