/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     http://digitalscholar.org/
    
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

const WORKER_URL = 'chrome://zotero/content/xpcom/pdfWorker/worker.js';
const CMAPS_URL = 'resource://zotero/pdf-reader/cmaps/';

class PDFWorker {
	constructor() {
		this._worker = null;
		this._lastPromiseID = 0;
		this._waitingPromises = {};
		this._queue = [];
		this._processingQueue = false;
	}

	async _processQueue() {
		this._init();
		if (this._processingQueue) {
			return;
		}
		this._processingQueue = true;
		let item;
		while ((item = this._queue.shift())) {
			if (item) {
				let [fn, resolve, reject] = item;
				try {
					resolve(await fn());
				}
				catch (e) {
					reject(e);
				}
			}
		}
		this._processingQueue = false;
	}

	async _enqueue(fn, isPriority) {
		return new Promise((resolve, reject) => {
			if (isPriority) {
				this._queue.unshift([fn, resolve, reject]);
			}
			else {
				this._queue.push([fn, resolve, reject]);
			}
			this._processQueue();
		});
	}

	async _query(action, data, transfer) {
		return new Promise((resolve, reject) => {
			this._lastPromiseID++;
			this._waitingPromises[this._lastPromiseID] = { resolve, reject };
			this._worker.postMessage({ id: this._lastPromiseID, action, data }, transfer);
		});
	}

	_init() {
		if (this._worker) return;
		this._worker = new Worker(WORKER_URL);
		this._worker.addEventListener('message', async (event) => {
			let message = event.data;
			// console.log(event.data)
			if (message.responseId) {
				let { resolve, reject } = this._waitingPromises[message.responseId];
				delete this._waitingPromises[message.responseId];
				if (message.data) {
					resolve(message.data);
				}
				else {
					let err = new Error(message.error.message);
					Object.assign(err, message.error);
					reject(err);
				}
				return;
			}
			if (message.id) {
				let respData = null;
				try {
					if (message.action === 'FetchBuiltInCMap') {
						let response = await Zotero.HTTP.request(
							'GET',
							CMAPS_URL + event.data.data.name + '.bcmap',
							{ responseType: 'arraybuffer' }
						);
						respData = {
							compressionType: 1,
							cMapData: new Uint8Array(response.response)
						};
					}
				}
				catch (e) {
					Zotero.debug('Failed to fetch CMap data:');
					Zotero.debug(e);
				}
				this._worker.postMessage({ responseId: event.data.id, data: respData });
			}
		});
		this._worker.addEventListener('error', (event) => {
			Zotero.debug('PDF Web Worker error:');
			Zotero.debug(event);
		});
	}

	isPDFAttachment(item) {
		return item.isAttachment() && item.attachmentContentType === 'application/pdf';
	}

	canImport(item) {
		if (this.isPDFAttachment(item)) {
			return true;
		}
		else if (item.isRegularItem()) {
			let ids = item.getAttachments();
			for (let id of ids) {
				let attachment = Zotero.Items.get(id);
				if (this.isPDFAttachment(attachment)) {
					return true;
				}
			}
		}
	}
	
	/**
	 * Export attachment with annotations to specified path
	 *
	 * @param {Integer} itemID
	 * @param {String} path
	 * @param {Boolean} isPriority
	 * @param {String} password
	 * @returns {Promise<Integer>} Number of written annotations
	 */
	async export(itemID, path, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);
			if (!this.isPDFAttachment(attachment)) {
				throw new Error('not a valid attachment');
			}
			let ids = attachment.getAnnotations();
			let annotations = [];
			for (let id of ids) {
				let item = await Zotero.Items.getAsync(id);
				annotations.push({
					id: item.key,
					type: item.annotationType,
					authorName: Zotero.Users.getName(item.createdByUserID) || '',
					comment: item.annotationComment || '',
					color: item.annotationColor,
					position: JSON.parse(item.annotationPosition),
					dateModified: item.dateModified
				});
			}
			let attachmentPath = await attachment.getFilePath();
			let buf = await OS.File.read(attachmentPath, {});
			buf = new Uint8Array(buf).buffer;
			let res = await this._query('export', { buf, annotations, password }, [buf]);
			await OS.File.writeAtomic(path, new Uint8Array(res.buf));
			return annotations.length;
		});
	}

	/**
	 * Export children PDF attachments with annotations
	 *
	 * @param {Zotero.Item} item
	 * @param {String} directory
	 */
	async exportParent(item, directory) {
		if (!item.isRegularItem()) {
			throw new Error('regular item not provided');
		}
		if (!directory) {
			throw new Error('\'directory\' not provided');
		}
		let promises = [];
		let ids = item.getAttachments();
		for (let id of ids) {
			let attachment = Zotero.Items.get(id);
			if (this.isPDFAttachment(attachment)) {
				let path = OS.Path.join(directory, attachment.attachmentFilename);
				promises.push(this.export(id, path));
			}
		}
		await Promise.all(promises);
	}

	/**
	 * Import annotations from PDF attachment
	 *
	 * @param {Integer} itemID
	 * @param {Boolean} save Save imported annotations, or otherwise just return the number of importable annotations
	 * @param {Boolean} isPriority
	 * @param {String} password
	 * @returns {Promise<Integer>} Number of annotations
	 */
	async import(itemID, save, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);
			if (!this.isPDFAttachment(attachment)) {
				throw new Error('not a valid PDF attachment');
			}
			// TODO: Remove when fixed
			attachment._loaded.childItems = true;
			let ids = attachment.getAnnotations();
			let existingAnnotations = [];
			for (let id of ids) {
				let item = await Zotero.Items.getAsync(id);
				existingAnnotations.push({
					id: item.key,
					type: item.annotationType,
					comment: item.annotationComment || '',
					position: JSON.parse(item.annotationPosition)
				});
			}
			let path = await attachment.getFilePath();
			let buf = await OS.File.read(path, {});
			buf = new Uint8Array(buf).buffer;
			let res = await this._query('import', { buf, existingAnnotations, password }, [buf]);
			let annotations = res.annotations;
			if (save) {
				for (let annotation of annotations) {
					// TODO: Utilize the saved Zotero item key for deduplication. Newer annotation modificaiton date wins
					annotation.key = Zotero.DataObjectUtilities.generateKey();
					await Zotero.Annotations.saveFromJSON(attachment, annotation);
				}
				Zotero.PDF.hasUnmachedAnnotations[itemID] = false;
			}
			else {
				Zotero.PDF.hasUnmachedAnnotations[itemID] = !!annotations.length;
			}
			for (let reader of Zotero.Reader._readers) {
				if (reader._itemID === itemID) {
					reader.toggleImportPrompt(!!Zotero.PDF.hasUnmachedAnnotations[itemID]);
				}
			}
			Zotero.PDF.dateChecked[itemID] = Zotero.Date.dateToISO(new Date());
			return annotations.length;
		});
	}
	
	/**
	 * Import children PDF attachment annotations
	 *
	 * @param {Zotero.Item} item
	 */
	async importParent(item) {
		if (!item.isRegularItem()) {
			throw new Error('regular item not provided');
		}
		let promises = [];
		let ids = item.getAttachments();
		for (let id of ids) {
			let attachment = Zotero.Items.get(id);
			if (this.isPDFAttachment(attachment)) {
				promises.push(this.import(id, true));
			}
		}
		await Promise.all(promises);
	}
}

Zotero.PDFWorker = new PDFWorker();
