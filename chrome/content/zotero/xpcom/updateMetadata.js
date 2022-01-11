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

Zotero.UpdateMetadata = new function () {
	const OFFLINE_RECHECK_DELAY = 60 * 1000;
	
	let _queue = [];
	let _queueProcessing = false;
	let _processingItemID = null;
	
	let _progressQueue = Zotero.ProgressQueues.create({
		id: 'update',
		title: 'updateMetadata.title',
		columns: [
			'general.item',
			'general.result'
		]
	});
	
	_progressQueue.addListener('cancel', function () {
		_queue = [];
	});
	
	
	/**
	 * Check whether a given item could theoretically be updated
	 * @param {Zotero.Item} item
	 * @return {Boolean}
	 */
	this.canUpdate = function (item) {
		return item.isRegularItem();
	};
	
	
	/**
	 * Triggers queue processing and returns when all items in the queue are processed
	 * @return {Promise}
	 */
	async function _processQueue() {
		await Zotero.Schema.schemaUpdatePromise;
		
		if (_queueProcessing) return;
		_queueProcessing = true;
		
		while (1) {
			if (Zotero.HTTP.browserIsOffline()) {
				await Zotero.Promise.delay(OFFLINE_RECHECK_DELAY);
				continue;
			}
			
			let itemID = _queue.pop();
			if (!itemID) break;
			
			_processingItemID = itemID;
			
			_progressQueue.updateRow(itemID, Zotero.ProgressQueue.ROW_PROCESSING, Zotero.getString('general.processing'));
			
			try {
				let item = await Zotero.Items.getAsync(itemID);
				
				if (!item) {
					throw new Error();
				}
				
				let updated = await Zotero.Utilities.Internal.updateItemMetadata(item);
				_progressQueue.updateRow(itemID, Zotero.ProgressQueue.ROW_SUCCEEDED,
					updated ? Zotero.getString('general.updated') : '');
			}
			catch (e) {
				Zotero.logError(e);
				
				_progressQueue.updateRow(
					itemID,
					Zotero.ProgressQueue.ROW_FAILED,
					e instanceof Zotero.Exception.Alert
						? e.message
						: Zotero.getString('general.error')
				);
			}
		}
		
		_queueProcessing = false;
		_processingItemID = null;
	}
	
	
	/**
	 * Add items to the queue and trigger processing
	 * @param {Zotero.Item[]} items
	 */
	this.updateItems = async function (items) {
		for (let item of items) {
			if (
				_processingItemID === item.id ||
				_queue.includes(item.id) ||
				!this.canUpdate(item)
			) {
				continue;
			}
			_queue.unshift(item.id);
			_progressQueue.addRow(item);
		}
		await _processQueue();
	};
};
