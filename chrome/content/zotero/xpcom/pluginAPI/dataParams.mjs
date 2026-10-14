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
 * Whether a value names a Zotero object: an ID, a key, { key, libraryID } or the { ref } of one the
 * change set creates
 */
function isIDRef(value) {
	if (Number.isInteger(value) || Zotero.Utilities.isValidObjectKey(value)) {
		return true;
	}
	if (value === null || typeof value !== "object") {
		return false;
	}
	return (typeof value.ref === "string" && !!value.ref)
		|| (Zotero.Utilities.isValidObjectKey(value.key)
			&& (value.libraryID === undefined || Number.isInteger(value.libraryID)));
}

const ID_REF_FORMS = "an ID, a key, { key, libraryID } or { ref }";

/**
 * The param-schema fragments Zotero.DataStore's catalogs are built from; all of them assume library
 * data, so another store writes its own rather than reusing these
 */
const DataParams = {
	idRef: (optional = false) => ({
		type: "any",
		optional,
		checkHook: value => (optional && value === undefined) || isIDRef(value) || `must be ${ID_REF_FORMS}`,
	}),

	nullableIDRef: {
		type: "any",
		checkHook: value => value === null || isIDRef(value) || `must be ${ID_REF_FORMS} or null`,
	},

	idRefList: {
		type: "array",
		checkHook: value => value.every(isIDRef) || `every entry must be ${ID_REF_FORMS}`,
	},

	// A single object is addressed by its ID, or by libraryID and key
	address: idName => ({
		[idName]: { type: "number", optional: true },
		libraryID: { type: "number", optional: true },
		key: { type: "string", optional: true },
	}),

	condition: {
		condition: "string",
		operator: "string",
		value: { type: "any", optional: true },
	},

	conditionList: (optional = false) => ({
		type: "array",
		optional,
		children: DataParams.condition,
	}),

	feedSettings: {
		url: { type: "string", optional: true },
		refreshInterval: { type: "number", optional: true },
		cleanupReadAfter: { type: "number", optional: true },
		cleanupUnreadAfter: { type: "number", optional: true },
	},
};

export { DataParams };
