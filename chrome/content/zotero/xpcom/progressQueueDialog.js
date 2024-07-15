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

Zotero.ProgressQueueDialog = function (progressQueue) {
	const SUCCESS_IMAGE = 'chrome://zotero/skin/tick.png';
	const FAILURE_IMAGE = 'chrome://zotero/skin/cross.png';
	const LOADING_IMAGE = 'chrome://zotero/skin/arrow_refresh.png';
	
	let _progressQueue = this.progressQueue = progressQueue;
	
	let _progressWindow = null;
	let _progressIndicator = null;
	let _io = { progressQueue: _progressQueue };
	let _status = null;
	let _showMinimize = true;
	
	this.open = function () {
		if (_progressWindow) {
			_progressWindow.focus();
			return;
		}
		
		let win = Services.wm.getMostRecentWindow("navigator:browser");
		if (win) {
			_progressWindow = win.openDialog("chrome://zotero/content/progressQueueDialog.xhtml",
				"", "chrome,close=yes,resizable=yes,dependent,dialog,centerscreen", _io);
		}
		else {
			_progressWindow = Services.ww.openWindow(null, "chrome://zotero/content/progressQueueDialog.xhtml",
				"", "chrome,close=yes,resizable=yes,dependent,dialog,centerscreen", _io);
		}
		
		_progressWindow.addEventListener('pageshow', _onWindowLoaded.bind(this), false);
	};
	
	this.setStatus = function (msg) {
		_status = msg;
		if (_progressWindow) {
			let label = _progressWindow.document.getElementById("label");
			if (label) {
				if (typeof msg === 'object' && 'l10nId' in msg) {
					_progressWindow.document.l10n.setAttributes(label, msg.l10nId, msg.l10nArgs);
				}
				else {
					label.value = msg;
				}
			}
		}
	};
	
	this.showMinimizeButton = function (show) {
		_showMinimize = show;
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
		_progressQueue.cancel();
	};
	
	function _onWindowLoaded() {
		var rootElement = _progressWindow.document.getElementById('progress-queue-root');
		Zotero.UIProperties.registerRoot(rootElement);
		
		_progressIndicator = _progressWindow.document.getElementById('progress-indicator');
		_progressWindow.document.getElementById('cancel-button')
			.addEventListener('command', () => {
				this.close();
			}, false);
		
		_progressWindow.document.getElementById('minimize-button')
			.addEventListener('command', function () {
				_progressWindow.close();
			}, false);
		
		_progressWindow.document.getElementById('close-button')
			.addEventListener('command', () => {
				this.close();
			}, false);
		
		_progressWindow.addEventListener('keypress', function (e) {
			if (e.keyCode === _progressWindow.KeyEvent.DOM_VK_ESCAPE) {
				// If done processing, Esc is equivalent to Close rather than Minimize
				if (_progressQueue.getTotal() === _progressQueue.getProcessedTotal()) {
					_progressQueue.cancel();
				}
				_progressWindow.close();
			}
		});
		
		_progressWindow.addEventListener('unload', function () {
			_progressQueue.removeListener('rowadded', _updateProgress);
			_progressQueue.removeListener('rowupdated', _updateProgress);
			_progressQueue.removeListener('rowdeleted', _updateProgress);
			_progressWindow = null;
			_progressIndicator = null;
			_status = null;
			_showMinimize = true;
		});
		
		_progressQueue.addListener('rowadded', _updateProgress);
		_progressQueue.addListener('rowupdated', _updateProgress);
		_progressQueue.addListener('rowdeleted', _updateProgress);
		
		_updateProgress();
	}
	
	function _updateProgress() {
		if (!_progressWindow) return;
		let total = _progressQueue.getTotal();
		let processed = _progressQueue.getProcessedTotal();
		if (total === 0) {
			_progressIndicator.value = 0;
		}
		else {
			_progressIndicator.value = processed * 100 / total;
		}
		if (processed === total) {
			_progressWindow.document.getElementById("cancel-button").hidden = true;
			_progressWindow.document.getElementById("minimize-button").hidden = true;
			_progressWindow.document.getElementById("close-button").hidden = false;
			_progressWindow.document.getElementById("label").value = _status || Zotero.getString('general.finished');
		}
		else {
			_progressWindow.document.getElementById("cancel-button").hidden = false;
			_progressWindow.document.getElementById("minimize-button").hidden = !_showMinimize;
			_progressWindow.document.getElementById("close-button").hidden = true;
			_progressWindow.document.getElementById("label").value = _status || Zotero.getString('general.processing');
		}
	}
};
