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

import { VarCheck } from "chrome://zotero/content/xpcom/plugins/utils.mjs";

const DataAddress = {

	/**
	 * A key only names an object together with a library, so a bare one takes the library of the object
	 * being edited, then the change set's
	 * @param {Zotero.DataObjects} [objects] - Omit for a type whose objects have no key
	 * @returns {StoreAddressDef}
	 */
	objectAddress(objects) {
		let keyToID = objects && ((libraryID, key) => objects.getIDFromLibraryAndKey(libraryID, key) || null);
		let forms = keyToID
			? "an ID, a key, { key, libraryID } or the { ref } of an object the change set creates"
			: "an ID or the { ref } of an object the change set creates";

		function libraryFor(given, fallbacks) {
			return Number.isInteger(given) ? given : fallbacks.find(Number.isInteger);
		}

		return {
			fields: ["id", "key", "libraryID"],

			plan(entry, defaults, fail) {
				if (Number.isInteger(entry.id)) {
					// A library given along with an ID is a claim to hold the caller to, not a lookup key
					return keyToID && Number.isInteger(entry.libraryID)
						? { id: entry.id, libraryID: entry.libraryID, type: entry.type }
						: { id: entry.id };
				}
				if (typeof entry.key === "string" && entry.key) {
					if (!keyToID) {
						fail.invalid(`${entry.type} objects have no key`);
					}
					let libraryID = libraryFor(entry.libraryID, [defaults.libraryID]);
					if (libraryID === undefined) {
						fail.invalid("a key needs a libraryID");
					}
					return { key: entry.key, libraryID, type: entry.type };
				}
				fail.invalid(`needs an integer id${keyToID ? " or a key" : ""}`);
				return undefined;
			},

			resolve(address, fail) {
				if (address.id !== undefined) {
					let placed = address.libraryID !== undefined && objects.getLibraryAndKeyFromID(address.id);
					if (placed && placed.libraryID !== address.libraryID) {
						fail.notFound(`no ${address.type} with ID ${address.id} in library ${address.libraryID}`);
					}
					return address.id;
				}
				let id = keyToID(address.libraryID, address.key);
				if (!id) {
					fail.notFound(`no ${address.type} with key ${address.key} in library ${address.libraryID}`);
				}
				return id;
			},

			fromValue(value, { defaults, scope, type }, fail) {
				if (Number.isInteger(value)) {
					return value;
				}
				let isObject = VarCheck.isObject(value);
				let key = typeof value === "string" ? value : (isObject ? value.key : undefined);
				if (typeof key === "string" && key) {
					if (!keyToID) {
						fail.invalid(`${type} objects have no key`);
					}
					let libraryID = libraryFor(isObject ? value.libraryID : undefined, [scope, defaults.libraryID]);
					if (libraryID === undefined) {
						fail.invalid(`key ${key} needs a libraryID`);
					}
					let id = keyToID(libraryID, key);
					if (!id) {
						fail.notFound(`no ${type} with key ${key} in library ${libraryID}`);
					}
					return id;
				}
				fail.invalid(`must be ${forms}, got ${JSON.stringify(value)}`);
				return undefined;
			},
		};
	},
};

export { DataAddress };
