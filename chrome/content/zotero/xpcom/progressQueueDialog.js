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
	let _rowIDs = [];
	let _status = null;
	let _showMinimize = true;
	
	this.open = function () {
		if (_progressWindow) {
			_progressWindow.focus();
			return;
		}
		
		let win = Services.wm.getMostRecentWindow("navigator:browser");
		if (win) {
			_progressWindow = win.openDialog("chrome://zotero/content/progressQueueDialog.xul",
				"", "chrome,close=yes,resizable=yes,dependent,dialog,centerscreen");
		}
		else {
			_progressWindow = Services.ww.openWindow(null, "chrome://zotero/content/progressQueueDialog.xul",
				"", "chrome,close=yes,resizable=yes,dependent,dialog,centerscreen", null);
		}
		
		_progressWindow.addEventListener('pageshow', _onWindowLoaded.bind(this), false);
	};
	
	this.setStatus = function (msg) {
		_status = msg;
		if (_progressWindow) {
			let label = _progressWindow.document.getElementById("label");
			if (label) {
				label.value = msg;
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
	
	function _getImageByStatus(status) {
		if (status === Zotero.ProgressQueue.ROW_PROCESSING) {
			return LOADING_IMAGE;
		}
		else if (status === Zotero.ProgressQueue.ROW_FAILED) {
			return FAILURE_IMAGE;
		}
		else if (status === Zotero.ProgressQueue.ROW_SUCCEEDED) {
			return SUCCESS_IMAGE;
		}
		return '';
	}
	
	function _rowToTreeItem(row) {
		let treeitem = _progressWindow.document.createElement('treeitem');
		treeitem.setAttribute('id', 'item-' + row.id);
		
		let treerow = _progressWindow.document.createElement('treerow');
		
		let treecell = _progressWindow.document.createElement('treecell');
		treecell.setAttribute('id', 'item-' + row.id + '-icon');
		treecell.setAttribute('src', _getImageByStatus(row.status));
		
		treerow.appendChild(treecell);
		
		treecell = _progressWindow.document.createElement('treecell');
		treecell.setAttribute('label', row.fileName);
		treerow.appendChild(treecell);
		
		treecell = _progressWindow.document.createElement('treecell');
		treecell.setAttribute('id', 'item-' + row.id + '-title');
		treecell.setAttribute('label', row.message);
		treerow.appendChild(treecell);
		
		treeitem.appendChild(treerow);
		return treeitem;
	}
	
	function _onWindowLoaded() {
		let rows = _progressQueue.getRows();
		_rowIDs = [];
		
		_progressWindow.document.title = Zotero.getString(_progressQueue.getTitle());
		
		let col1 = _progressWindow.document.getElementById('col1');
		let col2 = _progressWindow.document.getElementById('col2');
		
		let columns = _progressQueue.getColumns();
		col1.setAttribute('label', Zotero.getString(columns[0]));
		col2.setAttribute('label', Zotero.getString(columns[1]));
		
		let treechildren = _progressWindow.document.getElementById('treechildren');
		
		for (let row of rows) {
			_rowIDs.push(row.id);
			let treeitem = _rowToTreeItem(row);
			treechildren.appendChild(treeitem);
		}
		
		_progressWindow.document.getElementById('tree').addEventListener('dblclick',
			function (event) {
				_onDblClick(event, this);
			}
		);
		
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
			_progressQueue.removeListener('rowadded');
			_progressQueue.removeListener('rowupdated');
			_progressQueue.removeListener('rowdeleted');
			_progressWindow = null;
			_progressIndicator = null;
			_status = null;
			_showMinimize = true;
			_rowIDs = [];
		});
		
		_updateProgress();
		
		_progressQueue.addListener('rowadded', function (row) {
			_rowIDs.push(row.id);
			let treeitem = _rowToTreeItem(row);
			treechildren.appendChild(treeitem);
			_updateProgress();
		});
		
		_progressQueue.addListener('rowupdated', function (row) {
			let itemIcon = _progressWindow.document.getElementById('item-' + row.id + '-icon');
			let itemTitle = _progressWindow.document.getElementById('item-' + row.id + '-title');
			
			itemIcon.setAttribute('src', _getImageByStatus(row.status));
			itemTitle.setAttribute('label', row.message);
			_updateProgress();
		});
		
		_progressQueue.addListener('rowdeleted', function (row) {
			_rowIDs.splice(_rowIDs.indexOf(row.id), 1);
			let treeitem = _progressWindow.document.getElementById('item-' + row.id);
			treeitem.parentNode.removeChild(treeitem);
			_updateProgress();
		});
	}
	
	function _updateProgress() {
		if (!_progressWindow) return;
		let total = _progressQueue.getTotal();
		let processed = _progressQueue.getProcessedTotal();
		_progressIndicator.value = processed * 100 / total;
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
	
	/**
	 * Focus items in Zotero library when double-clicking them in the Retrieve
	 * metadata window.
	 * @param {Event} event
	 * @param {tree} tree XUL tree object
	 * @private
	 */
	async function _onDblClick(event, tree) {
		if (event && tree && event.type === 'dblclick') {
			let itemID = _rowIDs[tree.treeBoxObject.getRowAt(event.clientX, event.clientY)];
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
};
