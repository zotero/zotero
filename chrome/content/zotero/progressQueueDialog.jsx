/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
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

Components.utils.import("resource://gre/modules/Services.jsm");
import React from 'react';
import ReactDOM from 'react-dom';
import VirtualizedTable from 'components/virtualized-table';
const { IntlProvider } = require('react-intl');
const { getDOMElement } = require('components/icons');
const { renderCell } = VirtualizedTable;

let _progressIndicator = null;
let _progressQueue;
let _tree;

function _getImageByStatus(status) {
	if (status === Zotero.ProgressQueue.ROW_PROCESSING) {
		return getDOMElement('IconArrowRefresh');
	}
	else if (status === Zotero.ProgressQueue.ROW_FAILED) {
		return getDOMElement('IconCross');
	}
	else if (status === Zotero.ProgressQueue.ROW_SUCCEEDED) {
		return getDOMElement('IconTick');
	}
	return document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
}
	
function _rowToTreeItem(index, selection, oldDiv=null, columns) {
	let rows = _progressQueue.getRows();
	let row = rows[index];
	
	let div;
	if (oldDiv) {
		div = oldDiv;
		div.innerHTML = "";
	}
	else {
		div = document.createElementNS("http://www.w3.org/1999/xhtml", 'div');
		div.className = "row";
	}

	div.classList.toggle('selected', selection.isSelected(index));

	for (let column of columns) {
		if (column.dataKey === 'success') {
			let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
			span.className = `cell icon ${column.className}`;
			span.appendChild(_getImageByStatus(row.status));
			div.appendChild(span);
		}
		else {
			div.appendChild(renderCell(index, row[column.dataKey], column));
		}
	}
	return div;
}
	
function _init() {
	var io = window.arguments[0];
	_progressQueue = io.progressQueue;
	document.title = Zotero.getString(_progressQueue.getTitle());

	let columns = _progressQueue.getColumns();

	const tableColumns = [
		{ dataKey: 'success', fixedWidth: true, width: "26" },
		{ dataKey: 'fileName', label: Zotero.getString(columns[0]) },
		{ dataKey: 'message', label: Zotero.getString(columns[1]) },
	];
	
	const domEl = document.querySelector('#tree');
	let elem = (
		<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
			<VirtualizedTable
				getRowCount={() => _progressQueue.getRows().length}
				id="locateManager-table"
				ref={ref => io.tree = _tree = ref}
				renderItem={_rowToTreeItem}
				showHeader={true}
				columns={tableColumns}
				onActivate={_handleActivate}
			/>
		</IntlProvider>
	);
	ReactDOM.render(elem, domEl);
}
	
/**
 * Focus items in Zotero library when double-clicking them in the Retrieve
 * metadata window.
 * @param {Event} event
 * @param {Number[]} indices to activate
 * @private
 */
async function _handleActivate(event, indices) {
	if (event && event.type === 'dblclick') {
		let itemID = _progressQueue.getRows()[indices[0]].id;
		if (!itemID) return;
		
		let item = await Zotero.Items.getAsync(itemID);
		if (!item) return;
		
		if (item.parentItemID) itemID = item.parentItemID;
		
		let win = Services.wm.getMostRecentWindow("navigator:browser");
		if (win) {
			win.ZoteroPane.selectItem(itemID, false, true);
			win.focus();
		}
	}
}
