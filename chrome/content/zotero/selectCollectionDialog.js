/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

import CollectionTree from 'zotero/collectionTree';

var collectionsView;
var loaded;
var io;

var doLoad = async function () {
	// Set font size from pref
	var sbc = document.getElementById('zotero-select-collection-container');
	Zotero.UIProperties.registerRoot(sbc);
	
	io = window.arguments[0];
	if (io.wrappedJSObject) io = io.wrappedJSObject;
	
	let filterLibraryIDs = io.filterLibraryIDs || false;
	collectionsView = await CollectionTree.init(document.getElementById('zotero-collections-tree'), {
		onSelectionChange: async () => {
			let selectedRow = collectionsView.getRow(collectionsView.selection.focused);
			let canSelect = await io.canSelect(selectedRow.ref);
			document.getElementById("select-collection-dialog").getButton("accept").disabled = !canSelect;
		},
		filterLibraryIDs,
		hideSources: ['duplicates', 'trash', 'feeds', 'unfiled', 'retracted', 'publications', 'searches', 'recentlyRead'],
		onActivate: () => {
			document.querySelector('dialog').acceptDialog();
		}
	});

	await collectionsView.makeVisible();

	if (io.currentCollectionID) {
		await collectionsView.selectByID('C' + io.currentCollectionID);
	}

	document.addEventListener('dialogaccept', doAccept);
	
	// Setup keyboard navigation
	let collectionTree = document.getElementById('collection-tree');
	let searchField = document.getElementById('zotero-collections-search');

	searchField.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			_handleCollectionFilterEscape(event);
		}
		else if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
			_handleCollectionFilterEnter(event);
		}
	});
	
	collectionTree.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			_handleCollectionFilterEscape(event);
		}
	});
	
	// Used in tests
	loaded = true;
};

function doUnload()
{
	collectionsView.unregister();
	
	io.deferred && io.deferred.resolve();
}

function handleCollectionSearchInput() {
	let collectionsSearchField = document.getElementById("zotero-collections-search");
	collectionsView.setFilter(collectionsSearchField.value);
}

function doAccept() {
	let selected = collectionsView.getRow(collectionsView.selection.focused);
	io.dataOut = selected.ref;
}

function _handleCollectionFilterEnter(event) {
	let result = collectionsView.focusCollectionTree("#zotero-collections-search");
	if (result) {
		result.focus();
		event.preventDefault();
		event.stopPropagation();
	}
}

function _handleCollectionFilterEscape(event) {
	if (!document.getElementById("zotero-collections-search").value) return;

	let result = collectionsView.clearCollectionSearch("#zotero-collections-search");
	if (result) {
		result.focus();
	}
	event.preventDefault();
	event.stopPropagation();
}
