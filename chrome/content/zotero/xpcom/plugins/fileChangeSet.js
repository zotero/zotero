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

// The change set builder for Zotero.FileStore: the file half on top of ChangeSetBase and FilePath, which the
// loader puts on the holder before this script, in chrome and in each sandbox
/* global ChangeSetBase, FilePath */
// eslint-disable-next-line no-unused-vars
var FileChangeSet = (() => {
"use strict";

const { ChangesBase, ChangeSet, bytesView } = ChangeSetBase;
const path = FilePath;

const ENCODINGS = ["utf8", "utf-8", "base64"];

function assertPath(value, what) {
	if (typeof value !== "string" || !value) {
		throw new TypeError(`${what} must be a non-empty string`);
	}
	if (!path.isAbsolute(value) && !value.startsWith("file:")) {
		throw new TypeError(`${what} must be an absolute path or a file: URL, got ${value}`);
	}
	return value;
}

// A string crosses as is with its encoding; bytes cross as bytes, and only a JSON export encodes them
function contentParams(data, encoding) {
	if (typeof data === "string") {
		if (encoding !== undefined && !ENCODINGS.includes(encoding)) {
			throw new TypeError(`encoding must be one of ${ENCODINGS.join(", ")}`);
		}
		return encoding === undefined ? { data } : { data, encoding };
	}
	let bytes = bytesView(data);
	if (!bytes) {
		throw new TypeError("data must be a string, an ArrayBuffer or a typed array");
	}
	if (encoding !== undefined) {
		throw new TypeError("bytes take no encoding");
	}
	return { data: bytes };
}

// In JSON, bytes become base64, which the store and Node both take as an encoding
function opJSON(op) {
	return ArrayBuffer.isView(op.data) ? { ...op, data: op.data.toBase64(), encoding: "base64" } : op;
}

function withBoolean(params, name, value) {
	if (value !== undefined) {
		params[name] = !!value;
	}
	return params;
}

/**
 * A path's editor; `rename` moves the object, so later operations and the result use the new path
 */
class PathChanges extends ChangesBase {
	get path() {
		return this._state.path;
	}

	_addressJSON() {
		return { path: this._state.path };
	}

	_addressKey() {
		return this._state.path;
	}

	_addressLabel() {
		return this._state.path;
	}
}

class FileChanges extends PathChanges {
	static TERMINAL_OPS = new Set(["rm"]);

	toJSON() {
		let json = super.toJSON();
		json.ops = json.ops.map(opJSON);
		return json;
	}

	/**
	 * Create or replace the file's content
	 * @param {string | ArrayBuffer | ArrayBufferView} data
	 * @param {{ encoding?: "utf8" | "base64", overwrite?: boolean, flush?: boolean }} [options] - `encoding` says
	 *     what a string holds; `overwrite: false` refuses an existing file; `flush` forces the OS buffers to disk
	 */
	writeFile(data, { encoding, overwrite, flush } = {}) {
		let params = withBoolean(contentParams(data, encoding), "overwrite", overwrite);
		return this._push("writeFile", withBoolean(params, "flush", flush));
	}

	/**
	 * @param {string | ArrayBuffer | ArrayBufferView} data
	 * @param {{ encoding?: "utf8" | "base64", flush?: boolean }} [options] - What a string holds, and whether
	 *     to force the OS buffers to disk
	 */
	appendFile(data, { encoding, flush } = {}) {
		return this._push("appendFile", withBoolean(contentParams(data, encoding), "flush", flush));
	}

	/**
	 * @param {number} [length] - Bytes to keep; 0 when omitted
	 */
	truncate(length) {
		if (length !== undefined && !(Number.isInteger(length) && length >= 0)) {
			throw new TypeError("length must be a non-negative integer");
		}
		return this._push("truncate", length === undefined ? {} : { length });
	}

	/**
	 * @param {string} dest
	 * @param {{ overwrite?: boolean }} [options] - An existing destination is refused unless true
	 */
	copyFile(dest, { overwrite } = {}) {
		return this._push("copyFile", withBoolean({ dest: assertPath(dest, "dest") }, "overwrite", overwrite));
	}

	/**
	 * @param {string} dest
	 * @param {{ overwrite?: boolean }} [options] - An existing destination is refused unless true
	 */
	rename(dest, { overwrite } = {}) {
		return this._push("rename", withBoolean({ dest: assertPath(dest, "dest") }, "overwrite", overwrite));
	}

	/**
	 * @param {{ force?: boolean }} [options] - An absent file is no error with force
	 */
	rm({ force } = {}) {
		return this._push("rm", withBoolean({}, "force", force));
	}
}

class DirectoryChanges extends PathChanges {
	static TERMINAL_OPS = new Set(["rm"]);

	/**
	 * @param {{ recursive?: boolean }} [options] - Creates missing ancestors and accepts an existing directory
	 */
	makeDir({ recursive } = {}) {
		return this._push("makeDir", withBoolean({}, "recursive", recursive));
	}

	/**
	 * @param {string} dest - Must not exist
	 */
	rename(dest) {
		return this._push("rename", { dest: assertPath(dest, "dest") });
	}

	/**
	 * Copy the tree
	 * @param {string} dest
	 * @param {{ overwrite?: boolean }} [options] - An existing destination is replaced only with true
	 */
	cp(dest, { overwrite } = {}) {
		return this._push("cp", withBoolean({ dest: assertPath(dest, "dest") }, "overwrite", overwrite));
	}

	/**
	 * @param {{ recursive?: boolean, force?: boolean }} [options] - `recursive` is required for a directory,
	 *     as in Node; an absent directory is no error with `force`
	 */
	rm({ recursive, force } = {}) {
		return this._push("rm", withBoolean(withBoolean({}, "recursive", recursive), "force", force));
	}
}

const EDITORS = {
	file: FileChanges,
	directory: DirectoryChanges,
};

function editorClass(type) {
	if (!EDITORS[type]) {
		throw new TypeError(`Unknown object type '${type}'`);
	}
	return EDITORS[type];
}

/**
 * @param {string} type
 * @param {string | object} target - A path, or a stat snapshot whose revision is then expected
 * @param {{ revision?: string }} [options]
 */
function editorFor(type, target, { revision } = {}) {
	let state = { type };
	if (typeof target === "string") {
		state.path = assertPath(target, "path");
	}
	else if (target !== null && typeof target === "object") {
		if (target.type !== undefined && target.type !== type) {
			throw new TypeError(`Expected a ${type}, got ${target.type}`);
		}
		state.path = assertPath(target.path, "path");
		if (revision === undefined) {
			revision = target.revision;
		}
	}
	else {
		throw new TypeError(`A ${type} is addressed by its path or a stat snapshot, got ${typeof target}`);
	}
	let editor = new (editorClass(type))(state);
	return revision === undefined ? editor : editor.expect(revision);
}

/**
 * The file operations to commit together, one editor per path, applied in order until one fails
 */
class FileChangeSet extends ChangeSet {
	static _editorFromJSON(entry) {
		return this._replay(editorFor(entry.type, entry.path, { revision: entry.revision }), entry.ops);
	}

	/**
	 * @param {string | object} file - A path, or a stat snapshot whose revision is then expected
	 * @param {{ revision?: string }} [options]
	 * @returns {FileChanges}
	 */
	static file(file, options) {
		return editorFor("file", file, options);
	}

	/**
	 * @param {string | object} directory - A path, or a stat snapshot whose revision is then expected
	 * @param {{ revision?: string }} [options]
	 * @returns {DirectoryChanges}
	 */
	static directory(directory, options) {
		return editorFor("directory", directory, options);
	}
}

FileChangeSet.path = path;
FileChangeSet.PathChanges = PathChanges;
FileChangeSet.FileChanges = FileChanges;
FileChangeSet.DirectoryChanges = DirectoryChanges;

return FileChangeSet;
})();
