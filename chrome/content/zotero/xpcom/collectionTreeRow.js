/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
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

"use strict";

Zotero.CollectionTreeRow = function (collectionTreeView, type, ref, level, isOpen) {
	this.view = collectionTreeView;
	this.type = type;
	this.ref = ref;
	this.level = level || 0
	this.isOpen = isOpen || false;
	this.onUnload = null;
}


Zotero.CollectionTreeRow.prototype.__defineGetter__('id', function () {
	switch (this.type) {
		case 'library':
		case 'group':
		case 'feed':
			return 'L' + this.ref.libraryID;
		
		case 'collection':
			return 'C' + this.ref.id;
		
		case 'search':
			return 'S' + this.ref.id;
		
		case 'duplicates':
			return 'D' + this.ref.libraryID;
		
		case 'unfiled':
			return 'U' + this.ref.libraryID;
		
		case 'retracted':
			return 'R' + this.ref.libraryID;
		
		case 'publications':
			return 'P' + this.ref.libraryID;
			
		case 'trash':
			return 'T' + this.ref.libraryID;
		
		case 'header':
			switch (this.ref.id) {
				case 'group-libraries-header':
					return "HG";
				case 'feed-libraries-header':
					return "HF";
			}
			break;
	}
	
	return '';
});

Zotero.CollectionTreeRow.prototype.isLibrary = function (includeGlobal)
{
	if (includeGlobal) {
		var global = ['library', 'group', 'feed'];
		return global.indexOf(this.type) != -1;
	}
	return this.type == 'library';
}

Zotero.CollectionTreeRow.prototype.isCollection = function()
{
	return this.type == 'collection';
}

Zotero.CollectionTreeRow.prototype.isSearch = function()
{
	return this.type == 'search';
}

Zotero.CollectionTreeRow.prototype.isDuplicates = function () {
	return this.type == 'duplicates';
}

Zotero.CollectionTreeRow.prototype.isUnfiled = function () {
	return this.type == 'unfiled';
}

Zotero.CollectionTreeRow.prototype.isRetracted = function () {
	return this.type == 'retracted';
}

Zotero.CollectionTreeRow.prototype.isTrash = function()
{
	return this.type == 'trash';
}

Zotero.CollectionTreeRow.prototype.isHeader = function () {
	return this.type == 'header';
}

Zotero.CollectionTreeRow.prototype.isPublications = function() {
	return this.type == 'publications';
}

Zotero.CollectionTreeRow.prototype.isGroup = function() {
	return this.type == 'group';
}

Zotero.CollectionTreeRow.prototype.isFeed = function() {
	return this.type == 'feed';
}

Zotero.CollectionTreeRow.prototype.isSeparator = function () {
	return this.type == 'separator';
}

Zotero.CollectionTreeRow.prototype.isBucket = function()
{
	return this.type == 'bucket';
}

Zotero.CollectionTreeRow.prototype.isShare = function()
{
	return this.type == 'share';
}



// Special
Zotero.CollectionTreeRow.prototype.isWithinGroup = function () {
	return this.ref && !this.isHeader()
		&& Zotero.Libraries.get(this.ref.libraryID).libraryType == 'group';
}

Zotero.CollectionTreeRow.prototype.isWithinEditableGroup = function () {
	if (!this.isWithinGroup()) {
		return false;
	}
	var groupID = Zotero.Groups.getGroupIDFromLibraryID(this.ref.libraryID);
	return Zotero.Groups.get(groupID).editable;
}

Zotero.CollectionTreeRow.prototype.__defineGetter__('editable', function () {
	if (this.isTrash() || this.isShare() || this.isBucket()) {
		return false;
	}
	if (this.isGroup() || this.isFeed()) {
		return this.ref.editable;
	}
	if (!this.isWithinGroup() || this.isPublications()) {
		return true;
	}
	var libraryID = this.ref.libraryID;
	if (this.isCollection() || this.isSearch() || this.isDuplicates() || this.isUnfiled() || this.isRetracted()) {
		var type = Zotero.Libraries.get(libraryID).libraryType;
		if (type == 'group') {
			var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
			var group = Zotero.Groups.get(groupID);
			return group.editable;
		}
		throw ("Unknown library type '" + type + "' in Zotero.CollectionTreeRow.editable");
	}
	return false;
});

Zotero.CollectionTreeRow.prototype.__defineGetter__('filesEditable', function () {
	if (this.isTrash() || this.isShare() || this.isFeed()) {
		return false;
	}
	if (!this.isWithinGroup() || this.isPublications()) {
		return true;
	}
	var libraryID = this.ref.libraryID;
	if (this.isGroup()) {
		return this.ref.filesEditable;
	}
	if (this.isCollection() || this.isSearch() || this.isDuplicates() || this.isUnfiled() || this.isRetracted()) {
		var type = Zotero.Libraries.get(libraryID).libraryType;
		if (type == 'group') {
			var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
			var group = Zotero.Groups.get(groupID);
			return group.filesEditable;
		}
		throw ("Unknown library type '" + type + "' in Zotero.CollectionTreeRow.filesEditable");
	}
	return false;
});


Zotero.CollectionTreeRow.visibilityGroups = {'feed': 'feed'};


Zotero.CollectionTreeRow.prototype.__defineGetter__('visibilityGroup', function() {
	return Zotero.CollectionTreeRow.visibilityGroups[this.type] || 'default';
});


Zotero.CollectionTreeRow.prototype.getName = function()
{
	switch (this.type) {
		case 'library':
			return Zotero.getString('pane.collections.library');
		
		case 'publications':
			return Zotero.getString('pane.collections.publications');
		
		case 'trash':
			return Zotero.getString('pane.collections.trash');
		
		case 'header':
			return this.ref.label;
		
		case 'separator':
			return "";
		
		default:
			return this.ref.name;
	}
}

Zotero.CollectionTreeRow.prototype.getItems = Zotero.Promise.coroutine(function* ()
{
	switch (this.type) {
		// Fake results if this is a shared library
		case 'share':
			return this.ref.getAll();
		
		case 'bucket':
			return this.ref.getItems();
	}
	
	var ids = yield this.getSearchResults();
	
	// Filter out items that exist in the items table (where search results come from) but that haven't
	// yet been registered. This helps prevent unloaded-data crashes when switching collections while
	// items are being added (e.g., during sync).
	var len = ids.length;
	ids = ids.filter(id => Zotero.Items.getLibraryAndKeyFromID(id));
	if (len > ids.length) {
		let diff = len - ids.length;
		Zotero.debug(`Not showing ${diff} unloaded item${diff != 1 ? 's' : ''}`);
	}
	
	if (!ids.length) {
		return []
	}
	
	return Zotero.Items.getAsync(ids);
});

Zotero.CollectionTreeRow.prototype.getSearchResults = Zotero.Promise.coroutine(function* (asTempTable) {
	if (Zotero.CollectionTreeCache.lastTreeRow && Zotero.CollectionTreeCache.lastTreeRow.id !== this.id) {
		Zotero.CollectionTreeCache.clear();
	}
	
	if(!Zotero.CollectionTreeCache.lastResults) {
		var s = yield this.getSearchObject();
		Zotero.CollectionTreeCache.lastResults = yield s.search();
		Zotero.CollectionTreeCache.lastTreeRow = this;
	}
	
	if(asTempTable) {
		if(!Zotero.CollectionTreeCache.lastTempTable) {
			Zotero.CollectionTreeCache.lastTempTable = yield Zotero.Search.idsToTempTable(Zotero.CollectionTreeCache.lastResults);
		}
		return Zotero.CollectionTreeCache.lastTempTable;
	}
	return Zotero.CollectionTreeCache.lastResults;
});

/*
 * Returns the search object for the currently display
 *
 * This accounts for the collection, saved search, quicksearch, tags, etc.
 */
Zotero.CollectionTreeRow.prototype.getSearchObject = Zotero.Promise.coroutine(function* () {
	if (Zotero.CollectionTreeCache.lastTreeRow && Zotero.CollectionTreeCache.lastTreeRow.id !== this.id) {
		Zotero.CollectionTreeCache.clear();
	}
	
	if(Zotero.CollectionTreeCache.lastSearch) {
		return Zotero.CollectionTreeCache.lastSearch;
	}	
	
	var includeScopeChildren = false;
	
	// Create/load the inner search
	if (this.ref instanceof Zotero.Search) {
		var s = this.ref;
	}
	else if (this.isDuplicates()) {
		var s = yield this.ref.getSearchObject();
		let tmpTable;
		for (let id in s.conditions) {
			let c = s.conditions[id];
			if (c.condition == 'tempTable') {
				tmpTable = c.value;
				break;
			}
		}
		// Called by ItemTreeView::unregister()
		this.onUnload = async function () {
			await Zotero.DB.queryAsync(`DROP TABLE IF EXISTS ${tmpTable}`);
		};
	}
	else {
		var s = new Zotero.Search();
		s.addCondition('libraryID', 'is', this.ref.libraryID);
		// Library root
		if (this.isLibrary(true)) {
			s.addCondition('noChildren', 'true');
			includeScopeChildren = true;
		}
		else if (this.isCollection()) {
			s.addCondition('noChildren', 'true');
			s.addCondition('collectionID', 'is', this.ref.id);
			if (Zotero.Prefs.get('recursiveCollections')) {
				s.addCondition('recursive', 'true');
			}
			includeScopeChildren = true;
		}
		else if (this.isPublications()) {
			s.addCondition('publications', 'true');
		}
		else if (this.isTrash()) {
			s.addCondition('deleted', 'true');
		}
		else {
			throw new Error('Invalid search mode ' + this.type);
		}
	}
	
	// Create the outer (filter) search
	var s2 = new Zotero.Search();
	s2.addCondition('libraryID', 'is', this.ref.libraryID);
	
	if (this.isTrash()) {
		s2.addCondition('deleted', 'true');
	}
	s2.setScope(s, includeScopeChildren);
	
	if (this.searchText) {
		var cond = 'quicksearch-' + Zotero.Prefs.get('search.quicksearch-mode');
		s2.addCondition(cond, 'contains', this.searchText);
	}
	
	if (this.tags){
		for (let tag of this.tags) {
			s2.addCondition('tag', 'is', tag);
		}
	}
	
	Zotero.CollectionTreeCache.lastTreeRow = this;
	Zotero.CollectionTreeCache.lastSearch = s2;
	return s2;
});

Zotero.CollectionTreeRow.prototype.getChildTags = function () {
	Zotero.warn("Zotero.CollectionTreeRow::getChildTags() is deprecated -- use getTags() instead");
	return this.getTags();
};

/**
 * Returns all the tags used by items in the current view
 *
 * @return {Promise<Object[]>}
 */
Zotero.CollectionTreeRow.prototype.getTags = async function (types, tagIDs) {
	switch (this.type) {
		// TODO: implement?
		case 'share':
			return [];
		
		case 'bucket':
			return [];
	}
	var results = await this.getSearchResults(true);
	return Zotero.Tags.getAllWithin({ tmpTable: results, types, tagIDs });
};


Zotero.CollectionTreeRow.prototype.setSearch = function (searchText) {
	Zotero.CollectionTreeCache.clear();
	this.searchText = searchText;
}

Zotero.CollectionTreeRow.prototype.setTags = function (tags) {
	Zotero.CollectionTreeCache.clear();
	this.tags = tags;
}

/*
 * Returns TRUE if saved search, quicksearch or tag filter
 */
Zotero.CollectionTreeRow.prototype.isSearchMode = function() {
	switch (this.type) {
		case 'search':
		case 'publications':
		case 'trash':
			return true;
	}
	
	// Quicksearch
	if (this.searchText != '') {
		return true;
	}
	
	// Tag filter
	if (this.tags && this.tags.size) {
		return true;
	}
}
