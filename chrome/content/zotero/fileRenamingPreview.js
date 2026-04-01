/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2025 Corporation for Digital Scholarship
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

import VirtualizedTable from 'components/virtualized-table';
import React from 'react'; // eslint-disable-line no-unused-vars
import ReactDOM from "react-dom";

const { renameFilesFromParent } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");

var FileRenamingPreview = { // eslint-disable-line no-unused-vars
	rows: [],
	columns: [{ dataKey: 'name', label: '', primary: true, flex: 1 }],
	treeRef: null,
	_root: null,
	_containerEl: null,
	_progressEl: null,

	init: function (containerEl, progressEl) {
		this._containerEl = containerEl;
		this._progressEl = progressEl;
		this.rowRenderer = VirtualizedTable.makeRowRenderer(this.getRowData.bind(this));
	},

	// Run dry-run and render results. Returns the raw results array (empty if nothing to rename).
	loadPreview: async function (libraryID) {
		this.rows = [];
		if (this._root) {
			this._root.unmount();
			this._root = null;
		}

		let results = await renameFilesFromParent({ libraryID, pretend: true });
		if (results.length === 0) {
			return [];
		}

		this.rows = results.flatMap(obj => [
			{ name: obj.oldName },
			{ name: obj.newName },
			{ type: 'separator' }
		]);
		this.render();
		return results;
	},

	// Execute the actual rename with progress reporting.
	runRename: async function (libraryID) {
		await renameFilesFromParent({
			libraryID,
			reportProgress: this.updateProgress.bind(this)
		});
	},

	render: function () {
		let customRowHeights = [];
		this.rows.forEach((row, index) => {
			if (row.type === 'separator') {
				customRowHeights.push([index, 8]);
			}
		});

		this._root = ReactDOM.createRoot(this._containerEl);
		this._root.render((
			<VirtualizedTable
				columns={this.columns}
				containerWidth={this._containerEl.clientWidth}
				customRowHeights={customRowHeights}
				disableFontSizeScaling={true}
				getRowCount={() => this.rows.length}
				getRowHeight={this.getRowHeight.bind(this)}
				id="rename-files-confirm-table"
				isSelectable={this.getIsSelectable.bind(this)}
				ref={ref => this.treeRef = ref}
				renderItem={this.renderItem.bind(this)}
				showHeader={false}
			/>
		));
	},

	renderItem: function (index, selection, oldDiv, ...args) {
		if (this.rows[index].type === 'separator') {
			let div = oldDiv || document.createElement('div');
			div.innerHTML = '';
			div.className = 'row separator';
			return div;
		}
		let div = this.rowRenderer(index, selection, oldDiv, ...args);
		div.classList.toggle('old', index % 3 === 0);
		div.classList.toggle('new', index % 3 === 1);
		return div;
	},

	getIsSelectable: function (index) {
		return this.rows[index].type !== 'separator';
	},

	getRowData: function (index) {
		return this.rows[index];
	},

	getRowHeight: function ({ _renderedTextHeight }) {
		return _renderedTextHeight;
	},

	updateProgress: function (progress) {
		this._progressEl.value = progress;
	},

	destroy: function () {
		if (this._root) {
			this._root.unmount();
			this._root = null;
		}
		this.rows = [];
	}
};
