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

const HELPERS = ["isAbsolute", "normalize", "join", "dirname", "basename", "extname"];

function requireString(value, what) {
	if (typeof value !== "string") {
		throw new TypeError(`${what} must be a string`);
	}
	return value;
}

function toNative(value) {
	return Zotero.isWin ? value.replace(/\//g, "\\") : value;
}

// PathUtils spells a drive root without its separator
function withRootSeparator(value) {
	return /^[A-Za-z]:$/.test(value) ? `${value}\\` : value;
}

/**
 * Node-named path helpers over the canonical form (forward slashes everywhere), backed by PathUtils and
 * Zotero's normalizer, so only this platform's paths are understood; a sandbox gets them through exportFilePath
 */
const FilePath = Object.freeze({
	sep: "/",

	isAbsolute(value) {
		return typeof value === "string" && value !== "" && PathUtils.isAbsolute(toNative(value));
	},

	// Collapses `.`, `..` and repeated separators; a `..` above a root is an error, where Node clamps
	normalize(value) {
		requireString(value, "path");
		return value === "" ? "." : Zotero.File.normalizeToUnix(value) || ".";
	},

	join(...parts) {
		let given = parts.filter(part => typeof part === "string" && part);
		return given.length ? FilePath.normalize(given.join("/")) : ".";
	},

	dirname(value) {
		let normalized = FilePath.normalize(value);
		if (FilePath.isAbsolute(normalized)) {
			let parent = PathUtils.parent(toNative(normalized));
			return parent === null ? normalized : FilePath.normalize(withRootSeparator(parent));
		}
		let index = normalized.lastIndexOf("/");
		return index === -1 ? "." : normalized.slice(0, index) || ".";
	},

	basename(value, ext) {
		let normalized = FilePath.normalize(value);
		let name = normalized.slice(normalized.lastIndexOf("/") + 1);
		// A root has no name, whatever its spelling on this platform
		if (FilePath.isAbsolute(normalized) && PathUtils.parent(toNative(normalized)) === null) {
			name = "";
		}
		if (ext && name !== ext && name.endsWith(ext)) {
			return name.slice(0, -ext.length);
		}
		return name;
	},

	extname(value) {
		let name = FilePath.basename(value);
		let index = name.lastIndexOf(".");
		return index > 0 ? name.slice(index) : "";
	},
});

/**
 * The helpers as functions of a sandbox, each failure arriving there as its own TypeError
 * @param {object} scope
 * @returns {object}
 */
function exportFilePath(scope) {
	let mirror = Cu.createObjectIn(scope);
	Object.defineProperty(mirror, "sep", { value: FilePath.sep, enumerable: true });
	for (let name of HELPERS) {
		Cu.exportFunction((...args) => {
			try {
				return FilePath[name](...args);
			}
			catch (e) {
				throw new scope.TypeError(String(e?.message ?? e));
			}
		}, mirror, { defineAs: name });
	}
	return mirror;
}

export { FilePath, exportFilePath };
