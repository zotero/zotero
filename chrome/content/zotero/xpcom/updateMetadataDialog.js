/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Center for History and New Media
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

Zotero.UpdateMetadataDialog = function (options) {
	let _progressWindow;
	let _progressIndicator;
	let _showMinimize = true;
	let _diffTable;

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

	this.isOpen = function () {
		return !!_progressWindow;
	};

	this.close = function () {
		// In case close() is called before open()
		if (!_progressWindow) {
			return;
		}
		_progressWindow.close();
	};

	this.setRows = function (rows) {
		if (!_diffTable) {
			return;
		}
		_diffTable.current.setRows(rows);
		let total = rows.length;
		let processed = rows.filter(row => [Zotero.UpdateMetadata.ROW_SUCCEEDED,
			Zotero.UpdateMetadata.ROW_FAILED].includes(row.status)).length;
		_updateProgress(total, processed);
	}

	function _onWindowLoaded() {
		_progressWindow.document.title = Zotero.getString('updateMetadata.title');
		_progressIndicator = _progressWindow.document.getElementById('progress-indicator');
		_progressWindow.document.getElementById('cancel-button')
		.addEventListener('command', () => {
			this.close();
			options.onCancel();
		}, false);

		_progressWindow.document.getElementById('minimize-button')
		.addEventListener('command', function () {
			_progressWindow.close();
			options.onClose();
		}, false);

		_progressWindow.document.getElementById('close-button')
		.addEventListener('command', () => {
			this.close();
			options.onClose();
		}, false);

		_progressWindow.document.getElementById('apply-button')
		.addEventListener('command', () => {
			options.onApply();
		}, false);

		_progressWindow.addEventListener('keypress', function (e) {
			if (e.keyCode === _progressWindow.KeyEvent.DOM_VK_ESCAPE) {
				options.onPressEscape();
			}
		});

		_progressWindow.addEventListener('unload', function () {
			_progressWindow = null;
			_progressIndicator = null;
			_showMinimize = true;
			_diffTable = null;
		});

		let diffTableContainer = _progressWindow.document.getElementById('diff-table-container');
		Zotero.DiffTable.init(
			diffTableContainer,
			{
				onToggle: options.onToggle,
				onDoubleClick: options.onDoubleClick
			},
			(ref) => {
				_diffTable = ref;
				options.onInit();
			}
		);
	}

	function _updateProgress(total, processed) {
		if (!_progressWindow) return;
		_progressIndicator.value = processed * 100 / total;
		if (processed === total) {
			_progressWindow.document.getElementById('cancel-button').hidden = true;
			_progressWindow.document.getElementById('minimize-button').hidden = true;
			_progressWindow.document.getElementById('close-button').hidden = false;
			_progressWindow.document.getElementById('label').value = Zotero.getString('general.finished');
		}
		else {
			_progressWindow.document.getElementById('cancel-button').hidden = false;
			_progressWindow.document.getElementById('minimize-button').hidden = total === processed;
			_progressWindow.document.getElementById('close-button').hidden = true;
			_progressWindow.document.getElementById('label').value = Zotero.getString('general.processing');
		}
	}
}
