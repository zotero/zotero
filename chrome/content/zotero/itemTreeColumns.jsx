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

const React = require('react');
const Icons = require('components/icons');

/**
 * @typedef ItemTreeColumnOption
 * @type {object}
 * @property {string} dataKey - Required, see use in ItemTree#_getRowData()
 * @property {Set.<string>} [defaultIn] - Types of trees the column is default in. Can be [default, feed];
 * @property {Set.<string>} [disabledIn] - Types of trees where the column is not available
 * @property {number} [defaultSort=1] - Default: 1. -1 for descending sort
 * @property {number} [flex=1] - Default: 1. When the column is added to the tree how much space it should occupy as a flex ratio
 * @property {string} [width] - A column width instead of flex ratio. See above.
 * @property {boolean} [fixedWidth] - Default: false. Set to true to disable column resizing
 * @property {boolean} [staticWidth] - Default: false. Set to true to prevent columns from changing width when the width of the tree increases or decreases
 * @property {number} [minWidth] - Override the default [20px] column min-width for resizing
 * @property {string} label - The column label. Either a string or the id to an i18n string.
 * @property {React.Component} [iconLabel] - Set an Icon label instead of a text-based one
 * @property {string} [iconPath] - Set an Icon path, overrides {iconLable}
 * @property {boolean} [ignoreInColumnPicker=false] - Default: false. Set to true to not display in column picker.
 * @property {boolean} [submenu=false] - Default: false. Set to true to display the column in "More Columns" submenu of column picker.
 * @property {boolean} [primary] - Should only be one column at the time. Title is the primary column
 * @property {boolean} [custom] - Set automatically to true when the column is added by the user
 * @property {string} [pluginID] - Set plugin ID to auto remove column when plugin is removed
 * @property {Set.<string>} zoteroPersist - Which column properties should be persisted between zotero close
 */

/**
 * @type {ItemTreeColumnOption[]}
 * @constant
 */
const DEFAULT_COLUMNS = [
	{
		dataKey: "title",
		primary: true,
		defaultIn: new Set(["default", "feeds", "feed"]),
		label: "itemFields.title",
		ignoreInColumnPicker: true,
		flex: 4,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "firstCreator",
		defaultIn: new Set(["default", "feeds", "feed"]),
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
		defaultIn: new Set(["feeds", "feed"]),
		defaultSort: -1,
		label: "itemFields.date",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "year",
		disabledIn: ["feeds", "feed"],
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
		disabledIn: ["feeds", "feed"],
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
		disabledIn: ["feeds", "feed"],
		defaultSort: -1,
		submenu: true,
		label: "itemFields.accessDate",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "libraryCatalog",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.libraryCatalog",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "callNumber",
		disabledIn: ["feeds", "feed"],
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
		disabledIn: ["feeds", "feed"],
		label: "itemFields.dateAdded",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "dateModified",
		defaultSort: -1,
		disabledIn: ["feeds", "feed"],
		label: "zotero.items.dateModified_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "archive",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.archive",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "archiveLocation",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.archiveLocation",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "place",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.place",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "volume",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.volume",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "edition",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.edition",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "number",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.number",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "pages",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.pages",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "issue",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.issue",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "series",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.series",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "seriesTitle",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.seriesTitle",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "court",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.court",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "medium",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.medium",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "genre",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.genre",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "system",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.system",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "shortTitle",
		disabledIn: ["feeds", "feed"],
		submenu: true,
		label: "itemFields.shortTitle",
		flex: 2,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "extra",
		disabledIn: ["feeds", "feed"],
		label: "itemFields.extra",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "hasAttachment",
		defaultIn: new Set(["default"]),
		disabledIn: ["feeds", "feed"],
		label: "zotero.tabs.attachments.label",
		iconLabel: <Icons.IconAttachSmall />,
		fixedWidth: true,
		width: "16",
		zoteroPersist: new Set(["hidden", "sortDirection"])
	},
	{
		dataKey: "numNotes",
		disabledIn: ["feeds", "feed"],
		label: "zotero.tabs.notes.label",
		iconLabel: <Icons.IconTreeitemNoteSmall />,
		width: "14",
		minWidth: 14,
		staticWidth: true,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "feed",
		disabledIn: ["default", "feed"],
		label: "itemFields.feed",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	}
];



/**
 * @type {ItemTreeColumnOption[]}
 * @constant
 */
const CUSTOM_COLUMNS = [];

/**
 * 
 * @param {string} dataKey 
 * @returns {ItemTreeColumnOption | {}}
 */
function getDefaultColumnByDataKey(dataKey) {
	return Object.assign({}, getColumns().find(col => col.dataKey == dataKey), { hidden: false });
}

/**
 * 
 * @param {string[]} dataKeys 
 * @returns {ItemTreeColumnOption[]}
 */
function getDefaultColumnsByDataKeys(dataKeys) {
	return getColumns().filter(column => dataKeys.includes(column.dataKey)).map(column => Object.assign({}, column, { hidden: false }));
}

/**
 * Get all column options
 * @returns {ItemTreeColumnOption[]}
 */
function getColumns() {
	return [...DEFAULT_COLUMNS, ...CUSTOM_COLUMNS];
}

/**
 * Add a new column option
 * @param {ItemTreeColumnOption} option 
 */
function addColumn(option) {
	// check if option has dataKey and label
	if(!option.dataKey || !option.label){
		throw new Error("Column option must have dataKey and label.");
	}
	// check if column with dataKey already exists
	if(getDefaultColumnByDataKey(option.dataKey).dataKey){
		throw new Error("Column option with dataKey " + option.dataKey + " already exists.");
	}
	CUSTOM_COLUMNS.push(Object.assign({}, option, {custom: true}));
}

/**
 * Remove a column option
 * @param {string} dataKey 
 */
function removeColumn(dataKey) {
	const index = CUSTOM_COLUMNS.findIndex(column => column.dataKey == dataKey);
	if(index > -1){
		CUSTOM_COLUMNS.splice(index, 1);
	}
}

module.exports = {
	getColumns,
	addColumn,
	removeColumn,
	getDefaultColumnByDataKey,
	getDefaultColumnsByDataKeys,
};
