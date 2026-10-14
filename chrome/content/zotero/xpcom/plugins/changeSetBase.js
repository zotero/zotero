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

// The generic half of a change set builder, a dependency-free script that loadSubScript evaluates in
// chrome and in each sandbox before a store's own builder script, which extends the two classes
// eslint-disable-next-line no-unused-vars
var ChangeSetBase = (() => {
"use strict";

let refCounter = 0;

// The bytes of a typed array, DataView or ArrayBuffer as a Uint8Array over the same buffer; null otherwise
function bytesView(value) {
	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	}
	if (Object.prototype.toString.call(value) === "[object ArrayBuffer]") {
		return new Uint8Array(value);
	}
	return null;
}

// Operation params and create blocks are plain data (JSON plus bytes); copied on the way in and out, so
// neither the caller's later edits nor edits to an export reach the shared internal state
function clonePlain(value) {
	let bytes = bytesView(value);
	if (bytes) {
		return bytes.slice();
	}
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

/**
 * The operations queued for one object, in order; immutable, every method returns a new editor. A subclass
 * names its object (`_addressJSON`, `_addressKey`, `_addressLabel`) and its terminal operations (`TERMINAL_OPS`)
 */
class ChangesBase {
	static TERMINAL_OPS = new Set();

	constructor(state) {
		this._state = Object.freeze({ ...state });
	}

	get type() {
		return this._state.type;
	}

	get ref() {
		return this._state.ref;
	}

	get revision() {
		return this._state.revision;
	}

	/**
	 * Whether this editor creates its object, as opposed to addressing one another editor creates
	 */
	get isNew() {
		return this._state.create !== undefined;
	}

	get ops() {
		return opsToArray(this._state.ops);
	}

	get isTerminal() {
		return !!this._state.terminal;
	}

	/**
	 * Fail the commit unless the object is still at this snapshot revision
	 * @param {string | number} revision
	 * @returns {this}
	 */
	expect(revision) {
		if (this._state.ref !== undefined) {
			throw new Error(`${this._describe()} is not saved yet, so it has no revision to expect`);
		}
		if (!(typeof revision === "string" && revision) && !Number.isInteger(revision)) {
			throw new TypeError("revision must be a non-empty string or an integer");
		}
		if (this._state.revision !== undefined && this._state.revision !== revision) {
			throw new Error(`${this._describe()} already expects revision ${this._state.revision}`);
		}
		return this._derive({ revision });
	}

	/**
	 * The entry as the store reads it, any bytes kept as bytes
	 * @returns {object}
	 */
	toPlain() {
		let { type, ref, create, revision } = this._state;
		let plain = { type };
		if (ref !== undefined) {
			plain.ref = ref;
			if (create !== undefined) {
				plain.create = clonePlain(create);
			}
		}
		else {
			Object.assign(plain, this._addressJSON());
		}
		if (revision !== undefined) {
			plain.revision = revision;
		}
		plain.ops = this.ops;
		return plain;
	}

	// A builder whose operations carry bytes overrides this to encode them
	toJSON() {
		return this.toPlain();
	}

	/**
	 * The entry keys that name an existing object
	 * @returns {object}
	 */
	_addressJSON() {
		throw new Error("_addressJSON() is the builder's to define");
	}

	// What two editors of one set must agree on to be the same object
	_addressKey() {
		return JSON.stringify(this._addressJSON());
	}

	_addressLabel() {
		return Object.values(this._addressJSON()).join("/");
	}

	_describe() {
		let { type, ref } = this._state;
		return `${type} ${ref !== undefined ? `ref '${ref}'` : this._addressLabel()}`;
	}

	_address() {
		let { type, ref } = this._state;
		return ref !== undefined ? `ref:${ref}` : `${type}:${this._addressKey()}`;
	}

	_derive(patch) {
		return new this.constructor({ ...this._state, ...patch });
	}

	_push(op, params = {}) {
		if (this._state.terminal) {
			throw new Error(`No operation can follow ${this._state.terminal} on ${this._describe()}`);
		}
		let editor = this._derive({ ops: appendOp(this._state.ops, { op, ...clonePlain(params) }) });
		return this.constructor.TERMINAL_OPS.has(op) ? editor._derive({ terminal: op }) : editor;
	}

	/**
	 * The same object addressed twice in a set: the later editor's operations follow this one's
	 * @param {ChangesBase} other
	 * @returns {ChangesBase}
	 */
	_merge(other) {
		if (other.constructor !== this.constructor) {
			throw new TypeError(`Cannot merge a ${other.type} editor into ${this._describe()}`);
		}
		let revision = this._state.revision;
		if (other.revision !== undefined) {
			if (revision !== undefined && revision !== other.revision) {
				throw new Error(`${this._describe()} is expected at two different revisions`);
			}
			revision = other.revision;
		}
		// A ref-addressed editor and the one creating that ref collapse into the creating entry; two
		// creators under one ref are a mistake to report, not a merge
		if (this._state.create !== undefined && other._state.create !== undefined) {
			throw new Error(`${this._describe()} is created twice`);
		}
		let merged = this._derive({ revision, create: this._state.create ?? other._state.create });
		for (let { op, ...params } of other.ops) {
			merged = merged._push(op, params);
		}
		return merged;
	}
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
		if (!(editor instanceof ChangesBase)) {
			throw new TypeError("A change set is made of editors from the set's factories");
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
 * The changes to commit together, one editor per object, applied in order. Immutable: `with` and the
 * defaults setters return new sets. A subclass adds the per-type factories and `_editorFromJSON`
 */
class ChangeSet {
	_editors;

	_defaults;

	/**
	 * @param {ChangesBase[]} [editors]
	 * @param {object} [defaults] - Every key of the set but `changes`, for the store's types to read
	 */
	constructor(editors = [], defaults = {}) {
		this._editors = Object.freeze(mergeEditors(editors));
		this._defaults = Object.freeze({ ...defaults });
	}

	static empty() {
		return new this();
	}

	/**
	 * @param {...ChangesBase} editors
	 * @returns {ChangeSet}
	 */
	static of(...editors) {
		return new this(editors);
	}

	/**
	 * Rebuild a change set from its JSON
	 * @param {{ changes: object[] }} json
	 * @returns {ChangeSet}
	 */
	static from(json) {
		let { changes = [], ...defaults } = json || {};
		return new this(changes.map(entry => this._editorFromJSON(entry)), defaults);
	}

	/**
	 * The editor a JSON entry stands for, with its operations replayed
	 * @param {object} entry
	 * @returns {ChangesBase}
	 */
	static _editorFromJSON(_entry) {
		throw new Error("_editorFromJSON() is the builder's to define");
	}

	static _replay(editor, ops) {
		for (let { op, ...params } of ops || []) {
			editor = editor._push(op, params);
		}
		return editor;
	}

	get size() {
		return this._editors.length;
	}

	get editors() {
		return this._editors.slice();
	}

	get defaults() {
		return { ...this._defaults };
	}

	/**
	 * @param {...ChangesBase} editors
	 * @returns {ChangeSet} A new set with these editors after the current ones
	 */
	with(...editors) {
		return new this.constructor([...this._editors, ...editors], this._defaults);
	}

	_withDefaults(patch) {
		return new this.constructor(this._editors, { ...this._defaults, ...patch });
	}

	/**
	 * The set as the store reads it, any bytes kept as bytes
	 * @returns {object}
	 */
	toPlain() {
		return { ...this._defaults, changes: this._editors.map(editor => editor.toPlain()) };
	}

	toJSON() {
		return { ...this._defaults, changes: this._editors.map(editor => editor.toJSON()) };
	}
}

/**
 * The ref an object has until it is saved, when the caller gives none
 */
function nextRef(type) {
	return `${type}-${++refCounter}`;
}

return { ChangesBase, ChangeSet, bytesView, clonePlain, nextRef };
})();
