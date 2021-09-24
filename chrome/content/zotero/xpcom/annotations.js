/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
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

"use strict";

Zotero.Annotations = new function () {
	// Keep in sync with items.js::loadAnnotations()
	Zotero.defineProperty(this, 'ANNOTATION_TYPE_HIGHLIGHT', { value: 1 });
	Zotero.defineProperty(this, 'ANNOTATION_TYPE_NOTE', { value: 2 });
	Zotero.defineProperty(this, 'ANNOTATION_TYPE_IMAGE', { value: 3 });
	Zotero.defineProperty(this, 'ANNOTATION_TYPE_INK', { value: 4 });
	
	Zotero.defineProperty(this, 'PROPS', {
		value: ['type', 'text', 'comment', 'color', 'pageLabel', 'sortIndex', 'position'],
		writable: false
	});
	
	
	this.getCacheImagePath = function ({ libraryID, key }) {
		var file = this._getLibraryCacheDirectory(libraryID);
		return OS.Path.join(file, key + '.png');
	};


	this.hasCacheImage = async function (item) {
		return OS.File.exists(this.getCacheImagePath(item));
	};
	
	
	this.saveCacheImage = async function ({ libraryID, key }, blob) {
		var item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
		if (!item) {
			throw new Error(`Item not found`);
		}
		if (item.itemType != 'annotation' || item.annotationType != 'image') {
			throw new Error("Item must be an image annotation item");
		}
		
		var cacheDir = Zotero.DataDirectory.getSubdirectory('cache', true);
		var file = this._getLibraryCacheDirectory(item.libraryID);
		await Zotero.File.createDirectoryIfMissingAsync(file, { from: cacheDir });
		
		file = OS.Path.join(file, item.key + '.png');
		Zotero.debug("Creating annotation cache file " + file);
		await Zotero.File.putContentsAsync(file, blob);
		await Zotero.File.setNormalFilePermissions(file);
		
		return file;
	};
	
	
	this.removeCacheImage = async function ({ libraryID, key }) {
		var path = this.getCacheImagePath({ libraryID, key });
		Zotero.debug("Deleting annotation cache file " + path);
		await OS.File.remove(path, { ignoreAbsent: true });
	};
	
	
	/**
	 * Remove cache files that are no longer in use
	 */
	this.removeOrphanedCacheFiles = async function () {
		// TODO
	};
	
	
	/**
	 * Remove all cache files for a given library
	 */
	this.removeLibraryCacheFiles = async function (libraryID) {
		var path = this._getLibraryCacheDirectory(libraryID);
		await OS.File.removeDir(path, { ignoreAbsent: true, ignorePermissions: true });
	};
	
	
	this._getLibraryCacheDirectory = function (libraryID) {
		var parts = [Zotero.DataDirectory.getSubdirectory('cache')];
		var library = Zotero.Libraries.get(libraryID);
		if (library.libraryType == 'user') {
			parts.push('library');
		}
		else if (library.libraryType == 'group') {
			parts.push('groups', library.groupID);
		}
		else {
			throw new Error(`Unexpected library type '${library.libraryType}'`);
		}
		return OS.Path.join(...parts);
	};
	
	
	this.toJSON = async function (item) {
		var o = {};
		o.libraryID = item.libraryID;
		o.key = item.key;
		o.type = item.annotationType;
		o.isExternal = item.annotationIsExternal;
		o.isAuthor = !item.createdByUserID || item.createdByUserID == Zotero.Users.getCurrentUserID();
		if (!o.isAuthor) {
			o.authorName = Zotero.Users.getName(item.createdByUserID);
		}
		// TODO: Replace this with the actual code that checks if user is a group admin
		let isGroupAdmin = false;
		o.readOnly = o.isExternal || (!o.isAuthor && !isGroupAdmin);
		if (o.type == 'highlight') {
			o.text = item.annotationText;
		}
		else if (o.type == 'image') {
			let file = this.getCacheImagePath(item);
			if (await OS.File.exists(file)) {
				o.image = await Zotero.File.generateDataURI(file, 'image/png');
			}
		}
		o.comment = item.annotationComment;
		o.pageLabel = item.annotationPageLabel;
		o.color = item.annotationColor;
		o.sortIndex = item.annotationSortIndex;
		// annotationPosition is a JSON string, but we want to pass the raw object to the reader
		o.position = JSON.parse(item.annotationPosition);
		
		// Add tags and tag colors
		var tagColors = Zotero.Tags.getColors(item.libraryID);
		var tags = item.getTags().map((t) => {
			let obj = {
				name: t.tag
			};
			if (tagColors.has(t.tag)) {
				obj.color = tagColors.get(t.tag).color;
				// Add 'position' for sorting
				obj.position = tagColors.get(t.tag).position;
			}
			return obj;
		});
		// Sort colored tags by position and other tags by name
		tags.sort((a, b) => {
			if (!a.color && !b.color) return Zotero.localeCompare(a.name, b.name);
			if (!a.color && !b.color) return -1;
			if (!a.color && b.color) return 1;
			return a.position - b.position;
		});
		// Remove temporary 'position' value
		tags.forEach(t => delete t.position);
		if (tags.length) {
			o.tags = tags;
		}
		
		o.dateModified = item.dateModified;
		return o;
	};
	
	
	/**
	 * @param {Zotero.Item} attachment - Saved parent attachment item
	 * @param {Object} json
	 * @return {Promise<Zotero.Item>} - Promise for an annotation item
	 */
	this.saveFromJSON = async function (attachment, json, saveOptions = {}) {
		if (!attachment) {
			throw new Error("'attachment' not provided");
		}
		if (!attachment.libraryID) {
			throw new Error("'attachment' is not saved");
		}
		if (!json.key) {
			throw new Error("'key' not provided in JSON");
		}
		
		var item = Zotero.Items.getByLibraryAndKey(attachment.libraryID, json.key);
		if (!item) {
			item = new Zotero.Item('annotation');
			item.libraryID = attachment.libraryID;
			item.key = json.key;
			await item.loadPrimaryData();
		}
		item.parentID = attachment.id;
		
		item._requireData('annotation');
		item._requireData('annotationDeferred');
		item.annotationType = json.type;
		if (json.type == 'highlight') {
			item.annotationText = json.text;
		}
		item.annotationIsExternal = !!json.isExternal;
		item.annotationComment = json.comment;
		item.annotationColor = json.color;
		item.annotationPageLabel = json.pageLabel;
		item.annotationSortIndex = json.sortIndex;
		
		item.annotationPosition = JSON.stringify(Object.assign({}, json.position));
		// TODO: Can colors be set?
		item.setTags((json.tags || []).map(t => ({ tag: t.name })));
		
		// For Mendeley import -- additive only
		if (json.relations) {
			for (let predicate in json.relations) {
				item.addRelation(predicate, json.relations[predicate]);
			}
		}
		
		await item.saveTx(saveOptions);
		
		return item;
	};
};
