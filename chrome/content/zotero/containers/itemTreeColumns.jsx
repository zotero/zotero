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

const COLUMNS = [
	{
		dataKey: "title",
		primary: true,
		defaultIn: new Set(["default", "feed"]),
		label: "zotero.items.title_column",
		ignoreInColumnPicker: "true",
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
		label: "zotero.items.type_column",
		width: "40",
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "date",
		defaultIn: new Set(["feed"]),
		label: "zotero.items.date_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "year",
		disabledIn: "feed",
		label: "zotero.items.year_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "publisher",
		label: "zotero.items.publisher_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "publicationTitle",
		disabledIn: "feed",
		label: "zotero.items.publication_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "journalAbbreviation",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.journalAbbr_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "language",
		submenu: true,
		label: "zotero.items.language_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "accessDate",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.accessDate_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "libraryCatalog",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.libraryCatalog_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "callNumber",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.callNumber_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "rights",
		submenu: true,
		label: "zotero.items.rights_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "dateAdded",
		disabledIn: "feed",
		label: "zotero.items.dateAdded_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "dateModified",
		disabledIn: "feed",
		label: "zotero.items.dateModified_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "archive",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.archive_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "archiveLocation",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.archiveLocation_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "place",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.place_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "volume",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.volume_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "edition",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.edition_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "pages",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.pages_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "issue",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.issue_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "series",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.series_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "seriesTitle",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.seriesTitle_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "court",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.court_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "medium",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.medium_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "genre",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.genre_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "system",
		disabledIn: "feed",
		submenu: true,
		label: "zotero.items.system_column",
		flex: 1,
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	},
	{
		dataKey: "extra",
		disabledIn: "feed",
		label: "zotero.items.extra_column",
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
		width: "14",
		zoteroPersist: new Set(["hidden", "sortDirection"])
	},
	{
		dataKey: "numNotes",
		disabledIn: "feed",
		label: "zotero.tabs.notes.label",
		iconLabel: <Icons.IconTreeitemNoteSmall />,
		width: "14",
		zoteroPersist: new Set(["width", "hidden", "sortDirection"])
	}
];
let DATA_KEY_TO_COLUMN = {};
for (const column of COLUMNS) {
	DATA_KEY_TO_COLUMN[column.dataKey] = column;
}

function getDefaultColumnByDataKey(dataKey) {
	return Object.assign({}, DATA_KEY_TO_COLUMN[dataKey], {hidden: false});
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
