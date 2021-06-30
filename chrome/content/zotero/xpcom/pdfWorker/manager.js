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
const RENDERER_URL = 'resource://zotero/pdf-renderer/renderer.html';

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
			if (message.responseID) {
				let { resolve, reject } = this._waitingPromises[message.responseID];
				delete this._waitingPromises[message.responseID];
				if (message.data) {
					resolve(message.data);
				}
				else {
					reject(new Error(JSON.stringify(message.error)));
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
				this._worker.postMessage({ responseID: event.data.id, data: respData });
			}
		});
		this._worker.addEventListener('error', (event) => {
			Zotero.logError(`PDF Web Worker error (${event.filename}:${event.lineno}): ${event.message}`);
		});
	}
	
	canImport(item) {
		if (item.isPDFAttachment()) {
			return true;
		}
		else if (item.isRegularItem()) {
			let ids = item.getAttachments();
			for (let id of ids) {
				let attachment = Zotero.Items.get(id);
				if (attachment.isPDFAttachment()) {
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
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise<Integer>} Number of written annotations
	 */
	async export(itemID, path, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);
			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}
			let items = attachment.getAnnotations();
			items = items.filter(x => !x.annotationIsExternal);
			let annotations = [];
			for (let item of items) {
				annotations.push({
					id: item.key,
					type: item.annotationType,
					authorName: Zotero.Users.getName(item.createdByUserID) || Zotero.Users.getCurrentUsername() || '',
					comment: (item.annotationComment || '').replace(/<\/?(i|b|sub|sup)>/g, ''),
					color: item.annotationColor,
					position: JSON.parse(item.annotationPosition),
					dateModified: item.dateModified
				});
			}
			let attachmentPath = await attachment.getFilePathAsync();
			let buf = await OS.File.read(attachmentPath, {});
			buf = new Uint8Array(buf).buffer;

			try {
				var res = await this._query('export', {
					buf, annotations, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'export' failed: ${JSON.stringify({
					annotations,
					error: e.message
				})}`);
				Zotero.logError(error);
				throw error;
			}
			
			await OS.File.writeAtomic(path, new Uint8Array(res.buf));
			return annotations.length;
		}, isPriority);
	}

	/**
	 * Export children PDF attachments with annotations
	 *
	 * @param {Zotero.Item} item
	 * @param {String} directory
	 * @param {Boolean} [isPriority]
	 */
	async exportParent(item, directory, isPriority) {
		if (!item.isRegularItem()) {
			throw new Error('Item must be a regular item');
		}
		if (!directory) {
			throw new Error('\'directory\' not provided');
		}
		let promises = [];
		let ids = item.getAttachments();
		for (let id of ids) {
			let attachment = Zotero.Items.get(id);
			if (attachment.isPDFAttachment()) {
				let path = OS.Path.join(directory, attachment.attachmentFilename);
				promises.push(this.export(id, path, isPriority));
			}
		}
		await Promise.all(promises);
	}

	/**
	 * Import annotations from PDF attachment
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise<Integer>} Number of annotations
	 */
	async import(itemID, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);
			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}

			let mtime = Math.floor(await attachment.attachmentModificationTime / 1000);
			if (attachment.attachmentLastProcessedModificationTime === mtime) {
				return false;
			}

			let existingAnnotations = attachment
			.getAnnotations()
			.filter(x => x.annotationIsExternal)
			.map(annotation => ({
				id: annotation.key,
				type: annotation.annotationType,
				position: JSON.parse(annotation.annotationPosition),
				comment: annotation.annotationComment || ''
			}));

			let path = await attachment.getFilePathAsync();
			let buf = await OS.File.read(path, {});
			buf = new Uint8Array(buf).buffer;

			try {
				var { imported, deleted } = await this._query('import', {
					buf, existingAnnotations, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'import' failed: ${JSON.stringify({
					existingAnnotations,
					error: e.message
				})}`);
				Zotero.logError(error);
				throw error;
			}

			for (let annotation of imported) {
				annotation.key = Zotero.DataObjectUtilities.generateKey();
				annotation.isExternal = true;
				await Zotero.Annotations.saveFromJSON(attachment, annotation);
			}

			for (let key of deleted) {
				let annotation = Zotero.Items.getByLibraryAndKey(attachment.libraryID, key);
				await annotation.eraseTx();
			}

			attachment.attachmentLastProcessedModificationTime = mtime;
			await attachment.saveTx({ skipDateModifiedUpdate: true });

			return !!(imported.length || deleted.length);
		}, isPriority);
	}
	
	/**
	 * Process Mendeley annotations by extending with data from PDF file
	 *
	 * @param {String} pdfPath PDF file path
	 * @param {Array} mendeleyAnnotations
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise<Array>} Partial annotations
	 */
	async processMendeleyAnnotations(pdfPath, mendeleyAnnotations, isPriority, password) {
		return this._enqueue(async () => {
			let buf = await OS.File.read(pdfPath, {});
			buf = new Uint8Array(buf).buffer;
			try {
				var annotations = await this._query('importMendeley', {
					buf, mendeleyAnnotations, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'importMendeley' failed: ${JSON.stringify({
					mendeleyAnnotations,
					error: e.message
				})}`);
				Zotero.logError(error);
				throw error;
			}
			return annotations;
		}, isPriority);
	}
	
	/**
	 * Import annotations for each PDF attachment of parent item
	 *
	 * @param {Zotero.Item} item
	 * @param {Boolean} [isPriority]
	 */
	async importParent(item, isPriority) {
		if (!item.isRegularItem()) {
			throw new Error('Item must be a regular item');
		}
		let promises = [];
		let ids = item.getAttachments();
		for (let id of ids) {
			let attachment = Zotero.Items.get(id);
			if (attachment.isPDFAttachment()) {
				promises.push(this.import(id, isPriority));
			}
		}
		await Promise.all(promises);
	}
}

Zotero.PDFWorker = new PDFWorker();


// PDF Renderer
class PDFRenderer {
	constructor() {
		this._browser = null;
		this._lastPromiseID = 0;
		this._waitingPromises = {};
		this._queue = [];
		this._processingQueue = false;
	}

	async _processQueue() {
		await this._init();
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
			this._browser.contentWindow.postMessage({
				id: this._lastPromiseID,
				action,
				data
			}, this._browser.contentWindow.origin, transfer);
		});
	}

	async _init() {
		if (this._browser) return;
		return new Promise((resolve) => {
			this._browser = Zotero.Browser.createHiddenBrowser();
			let doc = this._browser.ownerDocument;
			let container = doc.createElement('hbox');
			container.style.position = 'fixed';
			container.style.zIndex = '-1';
			container.append(this._browser);
			doc.documentElement.append(container);
			this._browser.style.width = '1px';
			this._browser.style.height = '1px';
			this._browser.addEventListener('DOMContentLoaded', (event) => {
				if (this._browser.contentWindow.location.href === 'about:blank') return;
				this._browser.contentWindow.addEventListener('message', _handleMessage);
			});
			this._browser.loadURI(RENDERER_URL);

			let _handleMessage = async (event) => {
				if (event.source !== this._browser.contentWindow) {
					return;
				}
				let message = event.data;
				if (message.responseID) {
					let { resolve, reject } = this._waitingPromises[message.responseID];
					delete this._waitingPromises[message.responseID];
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
				
				if (message.action === 'initialized') {
					this._browser.contentWindow.postMessage(
						{ responseID: message.id, data: {} },
						this._browser.contentWindow.origin
					);
					resolve();
				}
				else if (message.action === 'renderedAnnotation') {
					let { id, image } = message.data.annotation;
					
					try {
						let item = await Zotero.Items.getAsync(id);
						let win = Zotero.getMainWindow();
						let blob = new win.Blob([new Uint8Array(image)]);
						await Zotero.Annotations.saveCacheImage(item, blob);
						await Zotero.Notifier.trigger('modify', 'item', [item.id]);
					} catch (e) {
						Zotero.logError(e);
					}

					this._browser.contentWindow.postMessage(
						{ responseID: message.id, data: {} },
						this._browser.contentWindow.origin
					);
				}
			};
		});
	}

	/**
	 * Render missing image annotation images for attachment
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Boolean} [isPriority]
	 * @returns {Promise<Integer>}
	 */
	async renderAttachmentAnnotations(itemID, isPriority) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);
			let annotations = [];
			for (let annotation of attachment.getAnnotations()) {
				if (annotation.annotationType === 'image'
					&& !await Zotero.Annotations.hasCacheImage(annotation)) {
					annotations.push({
						id: annotation.id,
						position: JSON.parse(annotation.annotationPosition)
					});
				}
			}
			if (!annotations.length) {
				return 0;
			}
			let path = await attachment.getFilePathAsync();
			let buf = await OS.File.read(path, {});
			buf = new Uint8Array(buf).buffer;
			return this._query('renderAnnotations', { buf, annotations }, [buf]);
		}, isPriority);
	}

	/**
	 * Render image annotation image
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Boolean} [isPriority]
	 * @returns {Promise<Boolean>}
	 */
	async renderAnnotation(itemID, isPriority) {
		return this._enqueue(async () => {
			let annotation = await Zotero.Items.getAsync(itemID);
			if (await Zotero.Annotations.hasCacheImage(annotation)) {
				return false;
			}
			let attachment = await Zotero.Items.getAsync(annotation.parentID);
			let path = await attachment.getFilePathAsync();
			let buf = await OS.File.read(path, {});
			buf = new Uint8Array(buf).buffer;
			let annotations = [{
				id: annotation.id,
				position: JSON.parse(annotation.annotationPosition)
			}];
			return !!await this._query('renderAnnotations', { buf, annotations }, [buf]);
		}, isPriority);
	}
}

Zotero.PDFRenderer = new PDFRenderer();
