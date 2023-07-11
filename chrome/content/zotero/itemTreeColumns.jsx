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
 * @typedef ItemTreeColumnOptions
 * @type {object}
 * @property {string} dataKey - Required, see use in ItemTree#_getRowData()
 * @property {string} label - The column label. Either a string or the id to an i18n string.
 * @property {string} [pluginID] - Set plugin ID to auto remove column when plugin is removed.
 * @property {string[]} [enabledTreeIDs=[]] - Which tree ids the column should be enabled in. If undefined, enabled in main tree. If ["*"], enabled in all trees.
 * @property {string[]} [defaultIn] - Will be deprecated. Types of trees the column is default in. Can be [default, feed];
 * @property {string[]} [disabledIn] - Will be deprecated. Types of trees where the column is not available
 * @property {boolean} [sortReverse=false] - Default: false. Set to true to reverse the sort order
 * @property {number} [flex=1] - Default: 1. When the column is added to the tree how much space it should occupy as a flex ratio
 * @property {string} [width] - A column width instead of flex ratio. See above.
 * @property {boolean} [fixedWidth] - Default: false. Set to true to disable column resizing
 * @property {boolean} [staticWidth] - Default: false. Set to true to prevent columns from changing width when the width of the tree increases or decreases
 * @property {number} [minWidth] - Override the default [20px] column min-width for resizing
 * @property {React.Component} [iconLabel] - Set an Icon label instead of a text-based one
 * @property {string} [iconPath] - Set an Icon path, overrides {iconLabel}
 * @property {string | React.Component} [htmlLabel] - Set an HTML label, overrides {iconLabel} and {label}. Can be a HTML string or a React component.
 * @property {boolean} [showInColumnPicker=true] - Default: true. Set to true to show in column picker.
 * @property {boolean} [columnPickerSubMenu=false] - Default: false. Set to true to display the column in "More Columns" submenu of column picker.
 * @property {boolean} [primary] - Should only be one column at the time. Title is the primary column
 * @property {boolean} [custom] - Set automatically to true when the column is added by the user
 * @property {(item: Zotero.Item, dataKey: string) => string} [dataProvider] - Custom data provider that is called when rendering cells
 * @property {(index: number, data: string, column: ItemTreeColumnOptions & {className: string}) => HTMLElement} [renderCell] - The cell renderer function
 * @property {string[]} [zoteroPersist] - Which column properties should be persisted between zotero close
 */

/**
 * @type {ItemTreeColumnOptions[]}
 * @constant
 */
const COLUMNS = [
	{
		dataKey: "title",
		primary: true,
		defaultIn: ["default", "feeds", "feed"],
		label: "itemFields.title",
		showInColumnPicker: false,
		flex: 4,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "firstCreator",
		defaultIn: ["default", "feeds", "feed"],
		label: "zotero.items.creator_column",
		showInColumnPicker: true,
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "itemType",
		label: "zotero.items.itemType",
		showInColumnPicker: true,
		width: "40",
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "date",
		defaultIn: ["feeds", "feed"],
		sortReverse: true,
		label: "itemFields.date",
		showInColumnPicker: true,
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "year",
		disabledIn: ["feeds", "feed"],
		sortReverse: true,
		label: "zotero.items.year_column",
		showInColumnPicker: true,
		flex: 1,
		staticWidth: true,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "publisher",
		label: "itemFields.publisher",
		showInColumnPicker: true,
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "publicationTitle",
		label: "itemFields.publicationTitle",
		showInColumnPicker: true,
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "journalAbbreviation",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.journalAbbreviation",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "language",
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.language",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "accessDate",
		disabledIn: ["feeds", "feed"],
		sortReverse: true,
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.accessDate",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "libraryCatalog",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.libraryCatalog",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "callNumber",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.callNumber",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "rights",
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.rights",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "dateAdded",
		sortReverse: true,
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		label: "itemFields.dateAdded",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "dateModified",
		sortReverse: true,
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		label: "zotero.items.dateModified_column",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "archive",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.archive",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "archiveLocation",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.archiveLocation",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "place",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.place",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "volume",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.volume",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "edition",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.edition",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "number",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.number",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "pages",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.pages",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "issue",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.issue",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "series",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.series",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "seriesTitle",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.seriesTitle",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "court",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.court",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "medium",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.medium",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "genre",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.genre",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "system",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.system",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "shortTitle",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		label: "itemFields.shortTitle",
		flex: 2,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "extra",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		label: "itemFields.extra",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "hasAttachment",
		defaultIn: ["default"],
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		label: "zotero.tabs.attachments.label",
		iconLabel: <Icons.IconAttachSmall />,
		fixedWidth: true,
		width: "32",
		zoteroPersist: ["hidden", "sortDirection"]
	},
	{
		dataKey: "numNotes",
		disabledIn: ["feeds", "feed"],
		showInColumnPicker: true,
		label: "zotero.tabs.notes.label",
		iconLabel: <Icons.IconTreeitemNoteSmall />,
		width: "26",
		minWidth: 26,
		staticWidth: true,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	},
	{
		dataKey: "feed",
		disabledIn: ["default", "feed"],
		showInColumnPicker: true,
		label: "itemFields.feed",
		flex: 1,
		zoteroPersist: ["width", "hidden", "sortDirection"]
	}
];

/**
 * Returns the columns that match the given data keys from the COLUMNS constant.
 * @param {string | string[]} dataKeys - The data key(s) to match.
 * @returns {ItemTreeColumnOptions | ItemTreeColumnOptions[]} - The matching columns.
 */
function getColumnDefinitionsByDataKey(dataKeys) {
	const isSingle = !Array.isArray(dataKeys);
	if (isSingle) {
		dataKeys = [dataKeys];
	}
	const matches = COLUMNS.filter(column => dataKeys.includes(column.dataKey)).map(column => Object.assign({}, column, { hidden: false }));
	return isSingle ? matches[0] : matches;
}

module.exports = {
	COLUMNS,
	getColumnDefinitionsByDataKey,
};
