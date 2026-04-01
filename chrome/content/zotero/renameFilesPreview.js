/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
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

var RenameFilesPreview = { // eslint-disable-line no-unused-vars
	_rows: [],
	_columns: [{ dataKey: 'name', label: '', primary: true, flex: 1 }],
	_treeRef: null,
	_root: null,

	init: function () {
		this._args = window.arguments[0].wrappedJSObject;
		this._args.cancelled = true;
		this.libraryID = this._args.libraryID;

		this.introEl = document.getElementById('preview-intro');
		this.filesListEl = document.getElementById('preview-files-list');
		this.loadingEl = document.getElementById('preview-loading');
		this.progressEl = document.getElementById('preview-progress');
		this.progressEl.classList.add('hidden');
		this.acceptBtn = document.getElementById('preview-accept-btn');
		this.cancelBtn = document.getElementById('preview-cancel-btn');

		this.cancelBtn.addEventListener('command', () => window.close());
		this.acceptBtn.addEventListener('command', this.handleAccept.bind(this));

		if (this.libraryID === Zotero.Libraries.userLibraryID) {
			document.l10n.setAttributes(this.introEl, 'rename-files-preview-intro');
		}
		else {
			let libraryName = Zotero.Libraries.get(this.libraryID).name;
			document.l10n.setAttributes(this.introEl, 'rename-files-preview-intro-library', { library: libraryName });
		}

		this._rowRenderer = VirtualizedTable.makeRowRenderer(this._getRowData.bind(this));
		setTimeout(this._loadPreview.bind(this), 0);
	},

	_loadPreview: async function () {
		this._rows = [];
		let results = await renameFilesFromParent({ libraryID: this.libraryID, pretend: true });
		this.loadingEl.hidden = true;
		this.acceptBtn.disabled = false;

		if (results.length === 0) {
			this._noFiles = true;
			this.introEl.dataset.l10nId = 'rename-files-preview-no-files';
			this.cancelBtn.hidden = true;
			document.l10n.setAttributes(this.acceptBtn, 'file-renaming-done-button');

			// Mark as done for user library
			if (this.libraryID === Zotero.Libraries.userLibraryID) {
				Zotero.Prefs.set('autoRenameFiles.done', true);
			}
		}
		else {
			this._rows = results.flatMap(obj => [
				{ name: obj.oldName },
				{ name: obj.newName },
				{ type: 'separator' }
			]);
			this._render();
		}
	},

	handleAccept: async function () {
		this._args.cancelled = false;
		if (this._noFiles) {
			window.close();
			return;
		}

		this.filesListEl.hidden = true;
		this.progressEl.classList.remove('hidden');
		this.introEl.dataset.l10nId = 'rename-files-preview-renaming';
		this.cancelBtn.hidden = true;
		this.acceptBtn.hidden = true;

		await renameFilesFromParent({
			libraryID: this.libraryID,
			reportProgress: (progress) => {
				this.progressEl.value = progress;
			}
		});

		this._unmount();
		window.close();
	},

	_render: function () {
		let customRowHeights = [];
		this._rows.forEach((row, index) => {
			if (row.type === 'separator') {
				customRowHeights.push([index, 8]);
			}
		});

		this._root = ReactDOM.createRoot(this.filesListEl);
		this._root.render((
			<VirtualizedTable
				columns={this._columns}
				containerWidth={this.filesListEl.clientWidth}
				customRowHeights={customRowHeights}
				disableFontSizeScaling={true}
				getRowCount={() => this._rows.length}
				getRowHeight={this._getRowHeight.bind(this)}
				id="rename-files-confirm-table"
				isSelectable={this._getIsSelectable.bind(this)}
				ref={ref => this._treeRef = ref}
				renderItem={this._renderItem.bind(this)}
				showHeader={false}
			/>
		));
	},

	_renderItem: function (index, selection, oldDiv, ...args) {
		if (this._rows[index].type === 'separator') {
			let div = oldDiv || document.createElement('div');
			div.innerHTML = '';
			div.className = 'row separator';
			return div;
		}
		let div = this._rowRenderer(index, selection, oldDiv, ...args);
		div.classList.toggle('old', index % 3 === 0);
		div.classList.toggle('new', index % 3 === 1);
		return div;
	},

	_getIsSelectable: function (index) {
		return this._rows[index].type !== 'separator';
	},

	_getRowData: function (index) {
		return this._rows[index];
	},

	_getRowHeight: function ({ _renderedTextHeight }) {
		return _renderedTextHeight;
	},

	_unmount: function () {
		if (this._root) {
			this._root.unmount();
			this._root = null;
		}
		this._rows = [];
	}
};
