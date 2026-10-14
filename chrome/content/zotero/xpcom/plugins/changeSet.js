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


// The change set builder for Zotero.DataStore: a dependency-free script that loadSubScript evaluates in
// chrome and in each sandbox. The IIFE hides the helpers, since loaders take every top-level var
var DataChangeSet = (() => {
"use strict";

// Zotero object keys: 8 characters from this alphabet
const KEY_RE = /^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/;

// Operations after which the object no longer exists; mirrors the store's `terminal` flags, which decide
const TERMINAL_OPS = new Set(["erase"]);

let refCounter = 0;

function isKey(value) {
	return typeof value === "string" && KEY_RE.test(value);
}

function assertInteger(value, what) {
	if (!Number.isInteger(value)) {
		throw new TypeError(`${what} must be an integer, got ${value === null ? "null" : typeof value}`);
	}
}

// Operation params and create blocks are plain JSON data; copied on the way in and out, so neither the
// caller's later edits nor edits to a JSON export reach the shared internal state
function clonePlain(value) {
	if (Array.isArray(value)) {
		return value.map(clonePlain);
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clonePlain(entry)]));
	}
	return value;
}

// A persistent operation list: versions share their tail, so deriving an editor never copies
function appendOp(list, op) {
	return { op, prev: list, length: list ? list.length + 1 : 1 };
}

function opsToArray(list) {
	let ops = new Array(list ? list.length : 0);
	for (let node = list; node; node = node.prev) {
		ops[node.length - 1] = clonePlain(node.op);
	}
	return ops;
}

// How an operation names another object: an ID, a key (bare, or with its library), { ref } or an editor
function toIDRef(value, what) {
	if (value instanceof ObjectChanges) {
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
 * The operations queued for one object, in order. Immutable: every method returns a new editor
 */
class ObjectChanges {
	#state;

	constructor(state) {
		this.#state = Object.freeze({ ...state });
	}

	get type() {
		return this.#state.type;
	}

	get id() {
		return this.#state.id;
	}

	get key() {
		return this.#state.key;
	}

	/**
	 * The library a key-addressed editor resolves in; unset means the change set's library
	 */
	get libraryID() {
		return this.#state.libraryID;
	}

	get ref() {
		return this.#state.ref;
	}

	get revision() {
		return this.#state.revision;
	}

	/**
	 * Whether this editor creates its object, as opposed to addressing one another editor creates
	 */
	get isNew() {
		return this.#state.create !== undefined;
	}

	get ops() {
		return opsToArray(this.#state.ops);
	}

	get isTerminal() {
		return !!this.#state.terminal;
	}

	/**
	 * Fail the commit unless the object is still at this snapshot revision
	 * @param {string | number} revision
	 * @returns {this}
	 */
	expect(revision) {
		if (this.#state.ref !== undefined) {
			throw new Error(`${this._describe()} is not saved yet, so it has no revision to expect`);
		}
		if (!(typeof revision === "string" && revision) && !Number.isInteger(revision)) {
			throw new TypeError("revision must be a non-empty string or an integer");
		}
		if (this.#state.revision !== undefined && this.#state.revision !== revision) {
			throw new Error(`${this._describe()} already expects revision ${this.#state.revision}`);
		}
		return this._derive({ revision });
	}

	toJSON() {
		let { type, id, key, libraryID, ref, create, revision } = this.#state;
		let json = { type };
		if (ref !== undefined) {
			json.ref = ref;
			if (create !== undefined) {
				json.create = clonePlain(create);
			}
		}
		else if (id !== undefined) {
			json.id = id;
		}
		else {
			json.key = key;
			if (libraryID !== undefined) {
				json.libraryID = libraryID;
			}
		}
		if (revision !== undefined) {
			json.revision = revision;
		}
		json.ops = this.ops;
		return json;
	}

	_describe() {
		let { type, id, key, ref } = this.#state;
		return `${type} ${ref !== undefined ? `ref '${ref}'` : (id ?? key)}`;
	}

	// What two editors of one set must agree on to be the same object
	_address() {
		let { type, id, key, libraryID, ref } = this.#state;
		if (ref !== undefined) {
			return `ref:${ref}`;
		}
		if (id !== undefined) {
			return `${type}:${id}`;
		}
		return `${type}:${key}@${libraryID ?? ""}`;
	}

	_derive(patch) {
		return new this.constructor({ ...this.#state, ...patch });
	}

	_push(op, params = {}) {
		if (this.#state.terminal) {
			throw new Error(`No operation can follow ${this.#state.terminal} on ${this._describe()}`);
		}
		let editor = this._derive({ ops: appendOp(this.#state.ops, { op, ...clonePlain(params) }) });
		return TERMINAL_OPS.has(op) ? editor._derive({ terminal: op }) : editor;
	}

	/**
	 * The same object addressed twice in a set: the later editor's operations follow this one's
	 * @param {ObjectChanges} other
	 * @returns {ObjectChanges}
	 */
	_merge(other) {
		if (other.constructor !== this.constructor) {
			throw new TypeError(`Cannot merge a ${other.type} editor into ${this._describe()}`);
		}
		let revision = this.#state.revision;
		if (other.revision !== undefined) {
			if (revision !== undefined && revision !== other.revision) {
				throw new Error(`${this._describe()} is expected at two different revisions`);
			}
			revision = other.revision;
		}
		// A ref-addressed editor and the one creating that ref collapse into the creating entry
		let merged = this._derive({ revision, create: this.#state.create ?? other.#state.create });
		for (let { op, ...params } of other.ops) {
			merged = merged._push(op, params);
		}
		return merged;
	}
}

class ItemChanges extends ObjectChanges {
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

class CollectionChanges extends ObjectChanges {
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

class SearchChanges extends ObjectChanges {
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

class LibraryChanges extends ObjectChanges {
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

// Types addressed by key as well as by ID; mirrors the store's address hooks, which are the authority
const KEYED = ["item", "collection", "search"];

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
			return new EDITORS[type]({ type, ref: target.ref });
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
	let editor = new EDITORS[type](state);
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
		ref = `${type}-${++refCounter}`;
	}
	if (typeof ref !== "string" || !ref) {
		throw new TypeError("ref must be a non-empty string");
	}
	// A create block may carry the type it was written for, as a snapshot does
	let { type: _type, ...params } = create;
	if (params.parent !== undefined) {
		params.parent = toIDRef(params.parent, "parent");
	}
	return new EDITORS[type]({ type, ref, create: clonePlain(params) });
}

// Editors of one object collapse into one entry, in the order first seen; an editor that only addresses a
// ref sits where the editor creating that ref is, its operations after the creator's own
function mergeEditors(editors) {
	let byAddress = new Map();
	let merged = [];
	let refOnly = [];
	let place = (editor) => {
		let address = editor._address();
		let index = byAddress.get(address);
		if (index === undefined) {
			byAddress.set(address, merged.length);
			merged.push(editor);
		}
		else {
			merged[index] = merged[index]._merge(editor);
		}
	};
	for (let editor of editors) {
		if (!(editor instanceof ObjectChanges)) {
			throw new TypeError("A change set is made of editors from ChangeSet.item(), collection(), ...");
		}
		if (editor.ref !== undefined && !editor.isNew) {
			refOnly.push(editor);
		}
		else {
			place(editor);
		}
	}
	// A ref nothing creates stays a lone entry, which the store rejects with the reason
	refOnly.forEach(place);
	return merged;
}

/**
 * The changes to commit together, one editor per object, applied in order. Immutable: `with` and
 * `inLibrary` return new sets
 */
class DataChangeSet {
	#editors;

	#libraryID;

	/**
	 * @param {ObjectChanges[]} [editors]
	 * @param {number} [libraryID] - The library bare keys resolve in when no editor says otherwise
	 */
	constructor(editors = [], libraryID = undefined) {
		if (libraryID !== undefined) {
			assertInteger(libraryID, "libraryID");
		}
		this.#editors = Object.freeze(mergeEditors(editors));
		this.#libraryID = libraryID;
	}

	static empty() {
		return new DataChangeSet();
	}

	/**
	 * @param {...ObjectChanges} editors
	 * @returns {DataChangeSet}
	 */
	static of(...editors) {
		return new DataChangeSet(editors);
	}

	/**
	 * Rebuild a change set from its JSON
	 * @param {{ libraryID?: number, changes: object[] }} json
	 * @returns {DataChangeSet}
	 */
	static from(json) {
		let editors = (json?.changes || []).map((entry) => {
			let editor;
			if (entry.create !== undefined) {
				editor = created(entry.type, entry.create, entry.ref);
			}
			else if (entry.ref !== undefined) {
				editor = new EDITORS[entry.type]({ type: entry.type, ref: entry.ref });
			}
			else {
				editor = existing(entry.type, entry.id ?? { key: entry.key, libraryID: entry.libraryID },
					{ revision: entry.revision }, KEYED.includes(entry.type));
			}
			for (let { op, ...params } of entry.ops || []) {
				editor = editor._push(op, params);
			}
			return editor;
		});
		return new DataChangeSet(editors, json?.libraryID);
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

	get size() {
		return this.#editors.length;
	}

	get editors() {
		return this.#editors.slice();
	}

	get libraryID() {
		return this.#libraryID;
	}

	/**
	 * @param {...ObjectChanges} editors
	 * @returns {DataChangeSet} A new set with these editors after the current ones
	 */
	with(...editors) {
		return new DataChangeSet([...this.#editors, ...editors], this.#libraryID);
	}

	/**
	 * @param {number} libraryID
	 * @returns {DataChangeSet} A new set whose bare keys resolve in this library
	 */
	inLibrary(libraryID) {
		return new DataChangeSet(this.#editors, libraryID);
	}

	toJSON() {
		let json = {};
		if (this.#libraryID !== undefined) {
			json.libraryID = this.#libraryID;
		}
		json.changes = this.#editors.map(editor => editor.toJSON());
		return json;
	}
}

/**
 * What names another object in an operation: an ID, a key, { key, libraryID }, { ref } or an editor
 * @typedef {number | string | { key: string, libraryID?: number } | { ref: string } | ObjectChanges} IDRefInput
 *
 *
 * @typedef {object} EditorOptions
 * @property {string | number} [revision] - Existing objects: the snapshot revision the commit expects
 * @property {number} [libraryID] - Existing objects: the library of a bare key
 * @property {string} [ref] - Created objects: how later entries address it; generated if omitted
 */

DataChangeSet.ObjectChanges = ObjectChanges;
DataChangeSet.ItemChanges = ItemChanges;
DataChangeSet.CollectionChanges = CollectionChanges;
DataChangeSet.SearchChanges = SearchChanges;
DataChangeSet.LibraryChanges = LibraryChanges;

return DataChangeSet;
})();
