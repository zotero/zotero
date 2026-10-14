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

/**
 * Which path is which, for grants and destination checks. Canonical paths throughout (forward slashes, one
 * spelling per place): `canonicalize` is the one way in from any spelling, `toNative` the one way out
 */
const PathIdentity = {
	// Any spelling to the canonical one; Win32's `\\?\` and `\\.\` aliases fold away, which no platform API does
	_canonical(path) {
		path = Zotero.File.normalizeToUnix(path);
		return Zotero.isWin ? path.replace(/^\/\/[?.]\/(UNC\/)?/i, (_, unc) => (unc ? "//" : "")) : path;
	},

	// The canonical form of an absolute path in any spelling, or of a file: URL
	canonicalize(rawPath) {
		if (typeof rawPath !== "string" || !rawPath) {
			throw new Error("File path must be a non-empty string");
		}
		let path = rawPath;
		if (path.startsWith("file:")) {
			path = Services.io.newURI(path).QueryInterface(Ci.nsIFileURL).file.path;
		}
		path = PathIdentity._canonical(path);
		if (!PathUtils.isAbsolute(PathIdentity.toNative(path))) {
			throw new Error(`File path must be absolute: ${rawPath}`);
		}
		return path;
	},

	// The spelling a platform API takes
	toNative(path) {
		return Zotero.isWin ? path.replaceAll("/", "\\") : path;
	},

	// The canonical parent, null at a root; PathUtils takes the native spelling only
	parent(path) {
		let parent = PathUtils.parent(PathIdentity.toNative(path));
		return parent === null ? null : PathIdentity._canonical(parent);
	},

	// isSymlink() is always false on Windows, where `target` reads through a symlink or junction once the file
	// is stat-ed; elsewhere it answers for a dangling link too and throws where there is nothing at all
	_isLink(file) {
		if (Zotero.isWin) {
			return file.exists() && file.target !== file.path;
		}
		try {
			return file.isSymlink();
		}
		catch {
			return false;
		}
	},

	// Where the path really leads, a missing tail kept as given; a link that leads nowhere is an error, since
	// writing through it would create its target
	realPath(path, hops = 40) {
		let file = Zotero.File.pathToFile(PathIdentity.toNative(path));
		let leaves = [];
		for (; file.parent; file = file.parent) {
			leaves.unshift(file.leafName);
		}
		for (let i = 0; i < leaves.length; i++) {
			file.append(leaves[i]);
			if (PathIdentity._isLink(file)) {
				if (!hops) {
					throw new Error(`Too many links resolving ${path}`);
				}
				let target = PathIdentity.canonicalize(file.target);
				return PathIdentity.realPath(PathIdentity._canonical([target, ...leaves.slice(i + 1)].join("/")), hops - 1);
			}
		}
		return PathIdentity.canonicalize(file.path);
	},

	// Folded where the default file system ignores case
	foldCase(path) {
		return Zotero.isWin || Zotero.isMac ? path.toLowerCase() : path;
	},

	same(a, b) {
		return PathIdentity.foldCase(a) === PathIdentity.foldCase(b);
	},

	// Pure, since both are canonical already; a directory contains itself
	contains(dir, path) {
		dir = PathIdentity.foldCase(dir);
		path = PathIdentity.foldCase(path);
		return path === dir || path.startsWith(dir.endsWith("/") ? dir : `${dir}/`);
	},
};

/**
 * Node-named helpers for a plugin: any spelling this platform understands in, canonical out, backed by
 * PathUtils and the core normalizer; globals.mjs mirrors them into a sandbox
 */
const FilePath = Object.freeze({
	sep: "/",

	isAbsolute(value) {
		return typeof value === "string" && value !== "" && PathUtils.isAbsolute(PathIdentity.toNative(value));
	},

	// Collapses `.`, `..` and repeated separators; a `..` above a root is an error, where Node clamps
	normalize(value) {
		if (typeof value !== "string") {
			throw new TypeError("path must be a string");
		}
		return value === "" ? "." : PathIdentity._canonical(value) || ".";
	},

	join(...parts) {
		let given = parts.filter(part => typeof part === "string" && part);
		return given.length ? FilePath.normalize(given.join("/")) : ".";
	},

	dirname(value) {
		let normalized = FilePath.normalize(value);
		if (FilePath.isAbsolute(normalized)) {
			return PathIdentity.parent(normalized) ?? normalized;
		}
		let index = normalized.lastIndexOf("/");
		return index === -1 ? "." : normalized.slice(0, index) || ".";
	},

	basename(value, ext) {
		let normalized = FilePath.normalize(value);
		let name = normalized.slice(normalized.lastIndexOf("/") + 1);
		// A root has no name, whatever its spelling on this platform
		if (FilePath.isAbsolute(normalized) && PathIdentity.parent(normalized) === null) {
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

export { FilePath, PathIdentity };
