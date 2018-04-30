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

/**
 * @fileOverview Tools for automatically retrieving a citation for the given PDF
 */

/**
 * Front end for recognizing PDFs
 * @namespace
 */

var Zotero_RecognizePDF_Dialog = new function () {
	const SUCCESS_IMAGE = 'chrome://zotero/skin/tick.png';
	const FAILURE_IMAGE = 'chrome://zotero/skin/cross.png';
	const LOADING_IMAGE = 'chrome://zotero/skin/arrow_refresh.png';
	
	let _progressWindow = null;
	let _progressIndicator = null;
	let _rowIDs = [];
	
	this.open = function() {
		if (_progressWindow) {
			_progressWindow.focus();
			return;
		}
		_progressWindow = window.openDialog('chrome://zotero/content/recognizePDFDialog.xul', '', 'chrome,close=yes,resizable=yes,dependent,dialog,centerscreen');
		_progressWindow.addEventListener('pageshow', _onWindowLoaded.bind(this), false);
	};
	
	function close() {
		_progressWindow.close();
	}
	
	function _getImageByStatus(status) {
		if (status === Zotero.RecognizePDF.ROW_PROCESSING) {
			return LOADING_IMAGE;
		}
		else if (status === Zotero.RecognizePDF.ROW_FAILED) {
			return FAILURE_IMAGE;
		}
		else if (status === Zotero.RecognizePDF.ROW_SUCCEEDED) {
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
		let rows = Zotero.RecognizePDF.getRows();
		_rowIDs = [];
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
			.addEventListener('command', function () {
				close();
				Zotero.RecognizePDF.cancel();
			}, false);
		
		_progressWindow.document.getElementById('minimize-button')
			.addEventListener('command', function () {
				close();
			}, false);
		
		_progressWindow.document.getElementById('close-button')
			.addEventListener('command', function () {
				close();
				Zotero.RecognizePDF.cancel();
			}, false);
		
		_progressWindow.addEventListener('keypress', function (e) {
			if (e.keyCode === KeyEvent.DOM_VK_ESCAPE) {
				// If done processing, Esc is equivalent to Close rather than Minimize
				if (Zotero.RecognizePDF.getTotal() == Zotero.RecognizePDF.getProcessedTotal()) {
					Zotero.RecognizePDF.cancel();
				}
				close();
			}
		});
		
		_progressWindow.addEventListener('unload', function () {
			Zotero.RecognizePDF.removeListener('rowadded');
			Zotero.RecognizePDF.removeListener('rowupdated');
			Zotero.RecognizePDF.removeListener('rowdeleted');
			_progressWindow = null;
			_progressIndicator = null;
			_rowIDs = [];
		});
		
		_updateProgress();
		
		Zotero.RecognizePDF.addListener('rowadded', function (row) {
			_rowIDs.push(row.id);
			let treeitem = _rowToTreeItem(row);
			treechildren.appendChild(treeitem);
			_updateProgress();
		});
		
		Zotero.RecognizePDF.addListener('rowupdated', function (row) {
			let itemIcon = _progressWindow.document.getElementById('item-' + row.id + '-icon');
			let itemTitle = _progressWindow.document.getElementById('item-' + row.id + '-title');
			
			itemIcon.setAttribute('src', _getImageByStatus(row.status));
			itemTitle.setAttribute('label', row.message);
			_updateProgress();
		});
		
		Zotero.RecognizePDF.addListener('rowdeleted', function (row) {
			_rowIDs.splice(_rowIDs.indexOf(row.id), 1);
			let treeitem = _progressWindow.document.getElementById('item-' + row.id);
			treeitem.parentNode.removeChild(treeitem);
			_updateProgress();
		});
	}
	
	function _updateProgress() {
		if (!_progressWindow) return;
		let total = Zotero.RecognizePDF.getTotal();
		let processed = Zotero.RecognizePDF.getProcessedTotal();
		_progressIndicator.value = processed * 100 / total;
		if (processed === total) {
			_progressWindow.document.getElementById("cancel-button").hidden = true;
			_progressWindow.document.getElementById("minimize-button").hidden = true;
			_progressWindow.document.getElementById("close-button").hidden = false;
			_progressWindow.document.getElementById("label").value = Zotero.getString('recognizePDF.complete.label');
		}
		else {
			_progressWindow.document.getElementById("cancel-button").hidden = false;
			_progressWindow.document.getElementById("minimize-button").hidden = false;
			_progressWindow.document.getElementById("close-button").hidden = true;
			_progressWindow.document.getElementById("label").value = Zotero.getString('recognizePDF.recognizing.label');
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
			
			if (window.ZoteroOverlay) {
				window.ZoteroOverlay.toggleDisplay(true);
			}
			
			window.ZoteroPane.selectItem(itemID, false, true);
			window.focus();
		}
	}
};
