/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
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

// The change set builder for Zotero.DataStore: the data half on top of ChangeSetBase, which loadSubScript
// evaluated into the same holder first, in chrome and in each sandbox
/* global ChangeSetBase */
// eslint-disable-next-line no-unused-vars
var DataChangeSet = (() => {
"use strict";

const { ChangesBase, ChangeSet, clonePlain, nextRef } = ChangeSetBase;

// Zotero object keys: 8 characters from this alphabet
const KEY_RE = /^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/;

function isKey(value) {
	return typeof value === "string" && KEY_RE.test(value);
}

function assertInteger(value, what) {
	if (!Number.isInteger(value)) {
		throw new TypeError(`${what} must be an integer, got ${value === null ? "null" : typeof value}`);
	}
}

// How an operation names another object: an ID, a key (bare, or with its library), { ref } or an editor
function toIDRef(value, what) {
	if (value instanceof DataObjectChanges) {
		if (value.ref !== undefined) {
			return { ref: value.ref };
		}
		if (value.id !== undefined) {
			return value.id;
		}
		return value.libraryID === undefined ? value.key : { key: value.key, libraryID: value.libraryID };
	}
	if (Number.isInteger(value) || isKey(value)) {
		return value;
	}
	if (value !== null && typeof value === "object") {
		if (typeof value.ref === "string" && value.ref) {
			return { ref: value.ref };
		}
		if (isKey(value.key)) {
			if (value.libraryID === undefined) {
				return value.key;
			}
			assertInteger(value.libraryID, `${what}.libraryID`);
			return { key: value.key, libraryID: value.libraryID };
		}
	}
	throw new TypeError(`${what} must be an ID, a key, { key, libraryID }, { ref } or an editor`);
}

function toIDRefList(values, what) {
	if (!Array.isArray(values)) {
		throw new TypeError(`${what} must be an array`);
	}
	return values.map(value => toIDRef(value, `each of ${what}`));
}

/**
 * A data object's editor, addressed by ID, by key and library, or by ref
 */
class DataObjectChanges extends ChangesBase {
	static TERMINAL_OPS = new Set(["erase"]);

	get id() {
		return this._state.id;
	}

	get key() {
		return this._state.key;
	}

	/**
	 * The library a key-addressed editor resolves in; unset means the change set's library
	 */
	get libraryID() {
		return this._state.libraryID;
	}

	_addressJSON() {
		let { id, key, libraryID } = this._state;
		if (id !== undefined) {
			return { id };
		}
		return libraryID === undefined ? { key } : { key, libraryID };
	}

	_addressKey() {
		let { id, key, libraryID } = this._state;
		return id !== undefined ? String(id) : `${key}@${libraryID ?? ""}`;
	}

	_addressLabel() {
		return String(this._state.id ?? this._state.key);
	}
}

class ItemChanges extends DataObjectChanges {
	setType(itemType) {
		return this._push("setType", { itemType });
	}

	setField(field, value) {
		return this._push("setField", { field, value });
	}

	/**
	 * @param {Record<string, string | number | boolean>} fields
	 */
	setFields(fields) {
		return Object.entries(fields).reduce((editor, [field, value]) => editor.setField(field, value), this);
	}

	setCreators(creators) {
		return this._push("setCreators", { creators });
	}

	addCreator(creator) {
		return this._push("addCreator", { creator });
	}

	/**
	 * @param {(string | { tag: string, type?: number })[]} tags
	 */
	setTags(tags) {
		return this._push("setTags", { tags });
	}

	addTag(tag, type) {
		return this._push("addTag", type === undefined ? { tag } : { tag, type });
	}

	removeTag(tag) {
		return this._push("removeTag", { tag });
	}

	/**
	 * @param {IDRefInput[]} collections - Bare keys resolve in the item's library
	 */
	setCollections(collections) {
		return this._push("setCollections", { collections: toIDRefList(collections, "collections") });
	}

	addToCollection(collection) {
		return this._push("addToCollection", { collection: toIDRef(collection, "collection") });
	}

	removeFromCollection(collection) {
		return this._push("removeFromCollection", { collection: toIDRef(collection, "collection") });
	}

	setRelations(relations) {
		return this._push("setRelations", { relations });
	}

	addRelation(predicate, object) {
		return this._push("addRelation", { predicate, object });
	}

	removeRelation(predicate, object) {
		return this._push("removeRelation", { predicate, object });
	}

	setNote(note) {
		return this._push("setNote", { note });
	}

	/**
	 * @param {IDRefInput | null} parent - null makes the item top-level
	 */
	setParent(parent) {
		return this._push("setParent", { parent: parent === null ? null : toIDRef(parent, "parent") });
	}

	setInPublications(value) {
		return this._push("setInPublications", { value: !!value });
	}

	trash() {
		return this._push("trash");
	}

	restore() {
		return this._push("restore");
	}

	erase() {
		return this._push("erase");
	}
}

class CollectionChanges extends DataObjectChanges {
	setName(name) {
		return this._push("setName", { name });
	}

	setParent(parent) {
		return this._push("setParent", { parent: parent === null ? null : toIDRef(parent, "parent") });
	}

	addItems(items) {
		return this._push("addItems", { items: toIDRefList(items, "items") });
	}

	removeItems(items) {
		return this._push("removeItems", { items: toIDRefList(items, "items") });
	}

	trash() {
		return this._push("trash");
	}

	restore() {
		return this._push("restore");
	}

	erase() {
		return this._push("erase");
	}
}

class SearchChanges extends DataObjectChanges {
	setName(name) {
		return this._push("setName", { name });
	}

	/**
	 * @param {{ condition: string, operator: string, value?: string }[]} conditions - Replaces all conditions
	 */
	setConditions(conditions) {
		return this._push("setConditions", { conditions });
	}

	addCondition(condition, operator, value) {
		return this._push("addCondition", value === undefined ? { condition, operator } : { condition, operator, value });
	}

	erase() {
		return this._push("erase");
	}
}

class LibraryChanges extends DataObjectChanges {
	// Feeds only
	setName(name) {
		return this._push("setName", { name });
	}

	/**
	 * Feeds only
	 * @param {{ url?: string, refreshInterval?: number, cleanupReadAfter?: number, cleanupUnreadAfter?: number }} settings
	 */
	setFeed(settings) {
		return this._push("setFeed", { ...settings });
	}

	refreshFeed() {
		return this._push("refreshFeed");
	}

	clearExpiredFeedItems() {
		return this._push("clearExpiredFeedItems");
	}

	/**
	 * @param {IDRefInput[]} items - Feed items of this feed
	 * @param {boolean} [read]
	 */
	markRead(items, read = true) {
		return this._push("markRead", { items: toIDRefList(items, "items"), read: !!read });
	}

	/**
	 * Feeds only
	 */
	erase() {
		return this._push("erase");
	}

	renameTag(from, to) {
		return this._push("renameTag", { from, to });
	}

	removeTag(tag) {
		return this._push("removeTag", { tag });
	}

	/**
	 * @param {string | null} color - A hex color, or null to clear
	 */
	setTagColor(tag, color, position) {
		return this._push("setTagColor", position === undefined ? { tag, color } : { tag, color, position });
	}
}

const EDITORS = {
	item: ItemChanges,
	collection: CollectionChanges,
	search: SearchChanges,
	library: LibraryChanges,
};

// Types addressed by key as well as by ID; mirrors the store's address hooks, which decide
const KEYED = ["item", "collection", "search"];

function editorClass(type) {
	if (!EDITORS[type]) {
		throw new TypeError(`Unknown object type '${type}'`);
	}
	return EDITORS[type];
}

/**
 * An editor for one object. An ID, key or snapshot addresses a saved object; a ref, or an editor carrying
 * one, addresses the object another editor of the set creates; any other object describes one to create
 * @param {string} type
 * @param {number | string | object} target
 * @param {EditorOptions} [options]
 */
function editorFor(type, target, { revision, libraryID, ref } = {}) {
	let isObject = target !== null && typeof target === "object";
	if (isObject && target.id === undefined && target.key === undefined) {
		if (target.type !== undefined && target.type !== type) {
			throw new TypeError(`Expected a ${type}, got ${target.type}`);
		}
		// The ref is the ID an object has until it is saved
		if (typeof target.ref === "string" && target.ref) {
			if (revision !== undefined || libraryID !== undefined || ref !== undefined) {
				throw new TypeError("An object addressed by ref takes no options");
			}
			return new (editorClass(type))({ type, ref: target.ref });
		}
		if (revision !== undefined || libraryID !== undefined) {
			throw new TypeError("revision and libraryID apply to an existing object, not one being created");
		}
		return created(type, target, ref);
	}
	if (ref !== undefined) {
		throw new TypeError("ref applies to a created object");
	}
	return existing(type, target, { revision, libraryID }, KEYED.includes(type));
}

/**
 * @param {string} type
 * @param {number | string | object} target
 * @param {{ revision?: string, libraryID?: number }} [options] - libraryID applies to a key the target
 *     does not already carry one for
 * @param {boolean} [keyed] - Whether the type has keys
 */
function existing(type, target, { revision, libraryID } = {}, keyed = true) {
	let state = { type };
	if (Number.isInteger(target)) {
		state.id = target;
	}
	else if (keyed && isKey(target)) {
		state.key = target;
	}
	else if (target !== null && typeof target === "object") {
		if (target.type !== undefined && target.type !== type) {
			throw new TypeError(`Expected a ${type}, got ${target.type}`);
		}
		if (Number.isInteger(target.id)) {
			state.id = target.id;
		}
		else if (keyed && isKey(target.key)) {
			state.key = target.key;
			if (target.libraryID !== undefined) {
				assertInteger(target.libraryID, `${type} libraryID`);
				state.libraryID = target.libraryID;
			}
		}
		else {
			throw new TypeError(`A ${type} snapshot needs an id${keyed ? " or a key" : ""}`);
		}
		if (revision === undefined) {
			revision = target.revision;
		}
	}
	else {
		throw new TypeError(`A ${type} is addressed by ID${keyed ? ", key" : ""} or snapshot, got ${typeof target}`);
	}
	if (state.key !== undefined && state.libraryID === undefined && libraryID !== undefined) {
		assertInteger(libraryID, `${type} libraryID`);
		state.libraryID = libraryID;
	}
	let editor = new (editorClass(type))(state);
	return revision === undefined ? editor : editor.expect(revision);
}

/**
 * An editor for an object the commit creates; later entries reach it as { ref } or by passing the editor
 * @param {string} type
 * @param {object} create - The type's create params
 * @param {string} [ref] - Generated when omitted
 */
function created(type, create, ref) {
	if (ref === undefined) {
		ref = nextRef(type);
	}
	if (typeof ref !== "string" || !ref) {
		throw new TypeError("ref must be a non-empty string");
	}
	// A create block may carry the type it was written for, as a snapshot does
	let { type: _type, ...params } = create;
	if (params.parent !== undefined) {
		params.parent = toIDRef(params.parent, "parent");
	}
	return new (editorClass(type))({ type, ref, create: clonePlain(params) });
}

/**
 * The changes to commit together; `libraryID` is where bare keys resolve when no editor says otherwise
 */
class DataChangeSet extends ChangeSet {
	constructor(editors = [], defaults = {}) {
		if (defaults.libraryID !== undefined) {
			assertInteger(defaults.libraryID, "libraryID");
		}
		super(editors, defaults);
	}

	static _editorFromJSON(entry) {
		let editor;
		if (entry.create !== undefined) {
			editor = created(entry.type, entry.create, entry.ref);
		}
		else if (entry.ref !== undefined) {
			editor = new (editorClass(entry.type))({ type: entry.type, ref: entry.ref });
		}
		else {
			editor = existing(entry.type, entry.id ?? { key: entry.key, libraryID: entry.libraryID },
				{ revision: entry.revision }, KEYED.includes(entry.type));
		}
		return this._replay(editor, entry.ops);
	}

	/**
	 * An existing item by ID, key or snapshot (whose revision is then expected), the item another editor
	 * creates by its ref or that editor, or a new one from `{ libraryID, itemType, parent?, linkMode? }`
	 * @param {number | string | object} item
	 * @param {EditorOptions} [options]
	 * @returns {ItemChanges}
	 */
	static item(item, options) {
		return editorFor("item", item, options);
	}

	/**
	 * An existing collection by ID, key or snapshot, a created one by ref or editor, or a new one from
	 * `{ libraryID, name, parent? }`
	 * @param {number | string | object} collection
	 * @param {EditorOptions} [options]
	 * @returns {CollectionChanges}
	 */
	static collection(collection, options) {
		return editorFor("collection", collection, options);
	}

	/**
	 * An existing saved search by ID, key or snapshot, a created one by ref or editor, or a new one from
	 * `{ libraryID, name, conditions? }`
	 * @param {number | string | object} search
	 * @param {EditorOptions} [options]
	 * @returns {SearchChanges}
	 */
	static search(search, options) {
		return editorFor("search", search, options);
	}

	/**
	 * An existing library by ID or snapshot, a created feed by ref or editor, or a new feed from
	 * `{ libraryType: "feed", name, url, ... }`
	 * @param {number | object} library
	 * @param {EditorOptions} [options]
	 * @returns {LibraryChanges}
	 */
	static library(library, options) {
		return editorFor("library", library, options);
	}

	get libraryID() {
		return this._defaults.libraryID;
	}

	/**
	 * @param {number} libraryID
	 * @returns {DataChangeSet} A new set whose bare keys resolve in this library
	 */
	inLibrary(libraryID) {
		assertInteger(libraryID, "libraryID");
		return this._withDefaults({ libraryID });
	}
}

/**
 * What names another object in an operation: an ID, a key, { key, libraryID }, { ref } or an editor
 * @typedef {number | string | { key: string, libraryID?: number } | { ref: string } | DataObjectChanges} IDRefInput
 *
 *
 * @typedef {object} EditorOptions
 * @property {string | number} [revision] - Existing objects: the snapshot revision the commit expects
 * @property {number} [libraryID] - Existing objects: the library of a bare key
 * @property {string} [ref] - Created objects: how later entries address it; generated if omitted
 */

DataChangeSet.DataObjectChanges = DataObjectChanges;
DataChangeSet.ItemChanges = ItemChanges;
DataChangeSet.CollectionChanges = CollectionChanges;
DataChangeSet.SearchChanges = SearchChanges;
DataChangeSet.LibraryChanges = LibraryChanges;

return DataChangeSet;
})();
