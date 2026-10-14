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

import { PathIdentity } from "chrome://zotero/content/xpcom/plugins/filePath.mjs";

function native(path) {
	return PathIdentity.toNative(path);
}

function withNativeTmpPath(options) {
	return options?.tmpPath ? { ...options, tmpPath: native(options.tmpPath) } : options;
}

/**
 * IOUtils over canonical paths, the one place that spells a path natively; children come back canonical
 */
const FileIO = {
	stat(path) {
		return IOUtils.stat(native(path));
	},

	exists(path) {
		return IOUtils.exists(native(path));
	},

	read(path, options) {
		return IOUtils.read(native(path), options);
	},

	readUTF8(path) {
		return IOUtils.readUTF8(native(path));
	},

	write(path, data, options) {
		return IOUtils.write(native(path), data, withNativeTmpPath(options));
	},

	writeUTF8(path, text, options) {
		return IOUtils.writeUTF8(native(path), text, withNativeTmpPath(options));
	},

	copy(source, dest, options) {
		return IOUtils.copy(native(source), native(dest), options);
	},

	move(source, dest, options) {
		return IOUtils.move(native(source), native(dest), options);
	},

	remove(path, options) {
		return IOUtils.remove(native(path), options);
	},

	makeDirectory(path, options) {
		return IOUtils.makeDirectory(native(path), options);
	},

	async getChildren(path) {
		let children = await IOUtils.getChildren(native(path));
		return children.map(child => PathIdentity.canonicalize(child));
	},

	computeHexDigest(path, algorithm) {
		return IOUtils.computeHexDigest(native(path), algorithm);
	},
};

export { FileIO };
