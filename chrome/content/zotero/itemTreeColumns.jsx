/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
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

(function() {
const React = require('react');
const Icons = require('components/icons');

/**
 * @type Column {
 * 	dataKey: string,				// Required, see use in ItemTree#_getRowData()
 *
 * 	defaultIn: Set<string>,			// Types of trees the column is default in. Can be [default, feed];
 * 	disabledIn: Set<string>,		// Types of trees where the column is not available
 * 	defaultSort: number				// Default: 1. -1 for descending sort
 *
 * 	flex: number,					// Default: 1. When the column is added to the tree how much space it should occupy as a flex ratio
 * 	width: string,					// A column width instead of flex ratio. See above.
 * 	fixedWidth: boolean				// Default: false. Set to true to disable column resizing
 * 	staticWidth: boolean			// Default: false. Set to true to prevent columns from changing width when
 * 									// the width of the tree increases or decreases
 * 	minWidth: number,				// Override the default [20px] column min-width for resizing
 *
 * 	label: string,					// The column label. Either a string or the id to an i18n string.
 * 	iconLabel: React.Component,		// Set an Icon label instead of a text-based one
 *
 * 	ignoreInColumnPicker: boolean	// Default: false. Set to true to not display in column picker.
 * 	submenu: boolean,				// Default: false. Set to true to display the column in "More Columns" submenu of column picker.
 *
 * 	primary: boolean,				// Should only be one column at the time. Title is the primary column
 * 	zoteroPersist: Set<string>,		// Which column properties should be persisted between zotero close
 * 	}
 */
const COLUMNS = [
	{
		dataKey: "title",
		primary: true,
		defaultIn: new Set(["default", "feed"]),
		label: "itemFields.title",
		ignoreInColumnPicker: true,
		flex: 4,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "firstCreator",
		defaultIn: new Set(["default", "feed"]),
		label: "zotero.items.creator_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "itemType",
		label: "zotero.items.itemType",
		width: "40",
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "date",
		defaultIn: new Set(["feed"]),
		defaultSort: -1,
		label: "itemFields.date",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "year",
		disabledIn: "feed",
		defaultSort: -1,
		label: "zotero.items.year_column",
		flex: 1,
		staticWidth: true,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "publisher",
		label: "itemFields.publisher",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "publicationTitle",
		label: "itemFields.publicationTitle",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "journalAbbreviation",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.journalAbbreviation",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "language",
		submenu: true,
		label: "itemFields.language",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "accessDate",
		disabledIn: "feed",
		defaultSort: -1,
		submenu: true,
		label: "itemFields.accessDate",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "libraryCatalog",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.libraryCatalog",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "callNumber",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.callNumber",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "rights",
		submenu: true,
		label: "itemFields.rights",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "dateAdded",
		defaultSort: -1,
		disabledIn: "feed",
		label: "itemFields.dateAdded",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "dateModified",
		defaultSort: -1,
		disabledIn: "feed",
		label: "zotero.items.dateModified_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "archive",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.archive",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "archiveLocation",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.archiveLocation",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "place",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.place",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "volume",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.volume",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "edition",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.edition",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "pages",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.pages",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "issue",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.issue",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "series",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.series",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "seriesTitle",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.seriesTitle",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "court",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.court",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "medium",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.medium",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "genre",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.genre",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "system",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.system",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "shortTitle",
		disabledIn: "feed",
		submenu: true,
		label: "itemFields.shortTitle",
		flex: 2,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "extra",
		disabledIn: "feed",
		label: "itemFields.extra",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "hasAttachment",
		defaultIn: new Set(["default"]),
		disabledIn: "feed",
		label: "zotero.tabs.attachments.label",
		iconLabel: <Icons.IconAttachSmall />,
		fixedWidth: true,
		width: "16",
		zoteroPersist: new Set(["hidden", "sortDirection"])
	},
	{
		dataKey: "numNotes",
		disabledIn: "feed",
		label: "zotero.tabs.notes.label",
		iconLabel: <Icons.IconTreeitemNoteSmall />,
		width: "14",
		minWidth: 14,
		staticWidth: true,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	}
];

function getDefaultColumnByDataKey(dataKey) {
	return Object.assign({}, COLUMNS.find(col => col.dataKey == dataKey), {hidden: false});
}

function getDefaultColumnsByDataKeys(dataKeys) {
	return COLUMNS.filter(column => dataKeys.includes(column.dataKey)).map(column => Object.assign({}, column, {hidden: false}));
}

module.exports = {
	COLUMNS,
	getDefaultColumnByDataKey,
	getDefaultColumnsByDataKeys,
};

})();
