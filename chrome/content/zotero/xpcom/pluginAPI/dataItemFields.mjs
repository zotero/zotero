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
 * What setField accepts on an item, beyond the item fields Zotero.ItemFields knows
 */
const DataItemFields = {
	// API JSON keys setField takes besides item fields, mapped to item properties as fromJSON does; `create`:
	// the kind's create block carries it, set in this order (core saves no annotation row without them)
	PROPERTIES: {
		contentType: { prop: "attachmentContentType", kind: "attachment" },
		charset: { prop: "attachmentCharset", kind: "attachment" },
		annotationType: { prop: "annotationType", kind: "annotation", create: true },
		annotationAuthorName: { prop: "annotationAuthorName", kind: "annotation" },
		annotationText: { prop: "annotationText", kind: "annotation" },
		annotationComment: { prop: "annotationComment", kind: "annotation" },
		annotationColor: { prop: "annotationColor", kind: "annotation" },
		annotationPageLabel: { prop: "annotationPageLabel", kind: "annotation" },
		annotationSortIndex: { prop: "annotationSortIndex", kind: "annotation", create: true },
		annotationPosition: { prop: "annotationPosition", kind: "annotation", json: true, create: true },
	},

	// API JSON keys setField refuses, with what to use instead
	REJECTED: {
		itemType: "setType",
		creators: "setCreators",
		tags: "setTags",
		collections: "setCollections",
		relations: "setRelations",
		note: "setNote",
		parentItem: "setParent",
		deleted: "trash or restore",
		inPublications: "setInPublications",
		linkMode: "the create block; it cannot change",
		filename: "the create block's file or relinkAttachmentFile",
		path: "the create block's file or relinkAttachmentFile",
		md5: "sync; it is read-only",
		mtime: "sync; it is read-only",
		key: "nothing; it is read-only",
		version: "nothing; it is read-only",
		dateAdded: "nothing; it is read-only",
		dateModified: "nothing; it is read-only",
	},

	// Own keys only, so a prototype name such as constructor is an unknown field
	_property(field) {
		return Object.hasOwn(DataItemFields.PROPERTIES, field) ? DataItemFields.PROPERTIES[field] : undefined;
	},

	/**
	 * @param {"attachment" | "annotation"} [kind] - Every kind's when omitted
	 * @returns {string[]} The properties a create block carries, in the order they are set
	 */
	createFields(kind) {
		return Object.entries(DataItemFields.PROPERTIES)
			.filter(([, property]) => property.create && (!kind || property.kind === kind))
			.map(([field]) => field);
	},

	/**
	 * A reason setField cannot set this field on this item, or nothing. Only item fields and the properties
	 * above pass: core's setField takes identifiers and primary fields too (libraryID, key, synced)
	 */
	check(item, field, value) {
		if (Object.hasOwn(DataItemFields.REJECTED, field)) {
			return `'${field}' is set with ${DataItemFields.REJECTED[field]}`;
		}
		let property = DataItemFields._property(field);
		// Core refuses an attachment property on another kind itself, but takes an annotation one anywhere
		if (property) {
			if (property.kind === "annotation" && !item.isAnnotation()) {
				return `'${field}' applies to annotations only`;
			}
		}
		else if (!Zotero.ItemFields.getID(field)) {
			return `unknown field '${field}'`;
		}
		if (typeof value === "object" && !property?.json) {
			return "value must be a string, number or boolean";
		}
		return undefined;
	},

	apply(item, field, value) {
		let property = DataItemFields._property(field);
		if (!property) {
			item.setField(field, String(value));
			return;
		}
		item[property.prop] = property.json && typeof value === "object" ? JSON.stringify(value) : String(value);
	},
};

export { DataItemFields };
