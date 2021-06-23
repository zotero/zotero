/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
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

Zotero.UpdateMetadataDialog = function (options) {
	let _progressWindow;
	let _progressIndicator;
	let _applyAll;
	let _diffTable;

	/**
	 * Open dialog
	 */
	this.open = function () {
		if (_progressWindow) {
			_progressWindow.focus();
			return;
		}

		let win = Services.wm.getMostRecentWindow('navigator:browser');
		if (win) {
			_progressWindow = win.openDialog('chrome://zotero/content/updateMetadataDialog.xul',
				'', 'chrome,close=yes,resizable=yes,dependent,dialog,centerscreen');
		}
		else {
			_progressWindow = Services.ww.openWindow(null, 'chrome://zotero/content/updateMetadataDialog.xul',
				'', 'chrome,close=yes,resizable=yes,dependent,dialog,centerscreen', null);
		}

		_progressWindow.addEventListener('pageshow', _onWindowLoaded.bind(this), false);
	};

	/**
	 * Check if dialog is open
	 * @returns {Boolean}
	 */
	this.isOpen = function () {
		return !!_progressWindow;
	};

	/**
	 * Close dialog
	 */
	this.close = function () {
		// In case close() is called before open()
		if (!_progressWindow) {
			return;
		}
		_progressWindow.close();
	};

	/**
	 * All dialog updates are set here. Updates XUL components
	 * and React `diffTable`
	 * @param rows
	 */
	this.setRows = function (rows) {
		if (!_diffTable) {
			return;
		}
		_diffTable.current.setRows(rows);
		let total = rows.length;
		let processed = rows.filter(row => [Zotero.UpdateMetadata.ROW_SUCCEEDED,
			Zotero.UpdateMetadata.ROW_FAILED].includes(row.status)).length;
		_updateProgress(total, processed);

		// Disabled 'Apply All' when processing or when no pending changes left
		let isProcessing = total !== processed;
		let hasPending = rows.find(row => row.fields.length !== 0 && !row.isDone && row.fields.find(field => !field.isDisabled));
		_applyAll.disabled = (isProcessing || !hasPending) ? 'true' : false;
	};

	/**
	 * Attach even listeners and `diffTable`
	 * @private
	 */
	function _onWindowLoaded() {
		_progressWindow.document.title = Zotero.getString('updateMetadata.title');
		_progressIndicator = _progressWindow.document.getElementById('progress-indicator');
		_progressWindow.document.getElementById('cancel-button')
		.addEventListener('command', () => {
			this.close();
			options.onCancel();
		}, false);

		_progressWindow.document.getElementById('close-button')
		.addEventListener('command', () => {
			this.close();
			options.onClose();
		}, false);

		_applyAll = _progressWindow.document.getElementById('apply-all-button');
		_applyAll.addEventListener('command', () => {
			options.onApplyAll();
		}, false);

		_progressWindow.addEventListener('keypress', function (e) {
			if (e.keyCode === _progressWindow.KeyEvent.DOM_VK_ESCAPE) {
				options.onPressEscape();
			}
		});

		_progressWindow.addEventListener('unload', function () {
			_progressWindow = null;
			_progressIndicator = null;
			_diffTable = null;
		});

		// Init React diffTable component
		let diffTableContainer = _progressWindow.document.getElementById('diff-table-container');
		Zotero.DiffTable.init(
			diffTableContainer,
			{
				onToggle: options.onToggle,
				onIgnore: options.onIgnore,
				onOpenItem: options.onOpenItem,
				onApply: options.onApply
			},
			(ref) => {
				_diffTable = ref;
				options.onInit();
			}
		);
	}

	/**
	 * Update XUL dialog elements on progress change
	 * @param {Number} total
	 * @param {Number} processed
	 * @private
	 */
	function _updateProgress(total, processed) {
		if (!_progressWindow) return;
		_progressIndicator.value = processed * 100 / total;
		if (processed === total) {
			_progressWindow.document.getElementById('cancel-button').hidden = true;
			_progressWindow.document.getElementById('close-button').hidden = false;
			_progressWindow.document.getElementById('label').value = Zotero.getString('general.finished');
		}
		else {
			_progressWindow.document.getElementById('cancel-button').hidden = false;
			_progressWindow.document.getElementById('close-button').hidden = true;
			_progressWindow.document.getElementById('label').value = Zotero.getString('general.processing');
		}
	}
};
