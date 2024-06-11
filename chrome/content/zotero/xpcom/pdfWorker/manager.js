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
const CMAPS_URL = 'resource://zotero/reader/pdf/web/cmaps/';
const STANDARD_FONTS_URL = 'resource://zotero/reader/pdf/web/standard_fonts/';

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
		// this._worker.terminate();
		// this._worker = null;
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
							CMAPS_URL + message.data + '.bcmap',
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
				try {
					if (message.action === 'FetchStandardFontData') {
						let response = await Zotero.HTTP.request(
							'GET',
							STANDARD_FONTS_URL + message.data,
							{ responseType: 'arraybuffer' }
						);
						respData = new Uint8Array(response.response);
					}
				}
				catch (e) {
					Zotero.debug('Failed to fetch standard font data:');
					Zotero.debug(e);
				}
				try {
					if (message.action === 'SaveRenderedAnnotation') {
						let { libraryID, annotationKey, buf } = message.data;
						let annotationItem = Zotero.Items.getByLibraryAndKey(libraryID, annotationKey);
						let win = Zotero.getMainWindow();
						let blob = new win.Blob([new Uint8Array(buf)]);
						await Zotero.Annotations.saveCacheImage(annotationItem, blob);
						await Zotero.Notifier.trigger('modify', 'item', [annotationItem.id]);
						respData = true;
					}
				}
				catch (e) {
					Zotero.debug('Failed to save rendered annotation:');
					Zotero.logError(e);
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
	async export(itemID, path, isPriority, password, transfer) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);
			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}
			let t = new Date();
			Zotero.debug(`Exporting PDF for item ${attachment.libraryKey}`);
			let items = attachment.getAnnotations();
			items = items.filter(x => !x.annotationIsExternal);
			let annotations = [];
			for (let item of items) {
				annotations.push({
					id: item.key,
					type: item.annotationType,
					// Author name is only set when the PDF file is 1) in a group library,
					// 2) was moved back to a private library or 3) was imported from a PDF file
					// that was previously exported in 1) or 2) case
					authorName: item.annotationAuthorName || Zotero.Users.getName(item.createdByUserID) || '',
					comment: (item.annotationComment || '').replace(/<\/?(i|b|sub|sup)>/g, ''),
					color: item.annotationColor,
					position: JSON.parse(item.annotationPosition),
					dateModified: Zotero.Date.sqlToISO8601(item.dateModified),
					tags: item.getTags().map(x => x.tag)
				});
			}
			let attachmentPath = await attachment.getFilePathAsync();
			if (!attachmentPath) {
				Zotero.warn("Not exporting missing file " + attachment.getFilePath());
				return 0;
			}
			let buf = await IOUtils.read(attachmentPath);
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
				try {
					error.name = JSON.parse(e.message).name;
				}
				catch (e) {
					Zotero.logError(e);
				}
				Zotero.logError(error);
				throw error;
			}
			
			await IOUtils.write(path || attachmentPath, new Uint8Array(res.buf));
			
			if (transfer) {
				await Zotero.Items.erase(items.map(x => x.id));
			}
			
			Zotero.debug(`Exported PDF with ${annotations.length} annotation(s) in ${new Date() - t} ms`);
			
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
	 * @param {Boolean} transfer
	 * @returns {Promise<Boolean>} Whether any annotations were imported/deleted
	 */
	async import(itemID, isPriority, password, transfer) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);
			
			Zotero.debug("Importing annotations for item " + attachment.libraryKey);
			let t = new Date();
			
			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}

			let mtime = Math.floor(await attachment.attachmentModificationTime / 1000);
			if (!transfer && attachment.attachmentLastProcessedModificationTime === mtime) {
				Zotero.debug("File hasn't changed since last-processed time -- skipping annotations import");
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
			let fileSize = (await IOUtils.stat(path)).size;
			if (fileSize > Math.pow(2, 31) - 1) {
				throw new Error(`The file "${path}" is too large`);
			}
			let buf = await IOUtils.read(path);
			buf = new Uint8Array(buf).buffer;

			try {
				var { imported, deleted, buf: modifiedBuf } = await this._query('import', {
					buf, existingAnnotations, password, transfer
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'import' failed: ${JSON.stringify({
					existingAnnotations,
					error: e.message
				})}`);
				try {
					error.name = JSON.parse(e.message).name;
				}
				catch (e) {
					Zotero.logError(e);
				}
				Zotero.logError(error);
				throw error;
			}
			
			let ids = [];
			for (let key of deleted) {
				let annotation = Zotero.Items.getByLibraryAndKey(attachment.libraryID, key);
				if (annotation) {
					ids.push(annotation.id);
				}
			}
			if (ids.length) {
				await Zotero.Items.erase(ids);
			}
			
			let notifierQueue = new Zotero.Notifier.Queue();
			try {
				for (let annotation of imported) {
					annotation.key = Zotero.DataObjectUtilities.generateKey();
					annotation.isExternal = !(transfer && annotation.transferable);
					annotation.tags = annotation.tags.map(x => ({ name: x }));
					await Zotero.Annotations.saveFromJSON(attachment, annotation, {
						notifierQueue
					});
				}
			}
			finally {
				await Zotero.Notifier.commit(notifierQueue);
			}
			
			if (transfer) {
				if (modifiedBuf) {
					await IOUtils.write(path, new Uint8Array(modifiedBuf));
					mtime = Math.floor(await attachment.attachmentModificationTime / 1000);
				}
			}

			attachment.attachmentLastProcessedModificationTime = mtime;
			await attachment.saveTx({
				skipAll: true
			});
			
			Zotero.debug(`Imported ${imported.length} annotation(s) for item ${attachment.libraryKey} `
				+ `in ${new Date() - t} ms`);
			
			return !!(imported.length || deleted.length);
		}, isPriority);
	}

	async processCitaviAnnotations(pdfPath, citaviAnnotations, isPriority, password) {
		return this._enqueue(async () => {
			let fileSize = (await IOUtils.stat(pdfPath)).size;
			if (fileSize > Math.pow(2, 31) - 1) {
				throw new Error(`The file "${pdfPath}" is too large`);
			}
			let buf = await IOUtils.read(pdfPath);
			buf = new Uint8Array(buf).buffer;
			try {
				var annotations = await this._query('importCitavi', {
					buf, citaviAnnotations, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'importCitavi' failed: ${JSON.stringify({
					citaviAnnotations,
					error: e.message
				})}`);
				Zotero.logError(error);
				throw error;
			}
			return annotations;
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
			let fileSize = (await IOUtils.stat(pdfPath)).size;
			if (fileSize > Math.pow(2, 31) - 1) {
				throw new Error(`The file "${pdfPath}" is too large`);
			}
			let buf = await IOUtils.read(pdfPath);
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

	/**
	 * Delete pages from PDF attachment
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Array} pageIndexes
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise}
	 */
	async deletePages(itemID, pageIndexes, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);

			Zotero.debug(`Deleting [${pageIndexes.join(', ')}] pages for item ${attachment.libraryKey}`);
			let t = new Date();

			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}

			let annotations = attachment
				.getAnnotations()
				.map(annotation => ({
					id: annotation.id,
					position: JSON.parse(annotation.annotationPosition)
				}));

			let path = await attachment.getFilePathAsync();
			let buf = await IOUtils.read(path);
			buf = new Uint8Array(buf).buffer;

			try {
				var { buf: modifiedBuf } = await this._query('deletePages', {
					buf, pageIndexes, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'deletePages' failed: ${JSON.stringify({ error: e.message })}`);
				try {
					error.name = JSON.parse(e.message).name;
				}
				catch (e) {
					Zotero.logError(e);
				}
				Zotero.logError(error);
				throw error;
			}

			// Delete annotations from deleted pages
			let ids = [];
			for (let i = annotations.length - 1; i >= 0; i--) {
				let { id, position } = annotations[i];
				if (pageIndexes.includes(position.pageIndex)) {
					ids.push(id);
					annotations.splice(i, 1);
				}
			}
			if (ids.length) {
				await Zotero.Items.erase(ids);
			}

			// Shift page index for other annotations
			ids = [];
			await Zotero.DB.executeTransaction(async function () {
				let rows = await Zotero.DB.queryAsync('SELECT itemID, position FROM itemAnnotations WHERE parentItemID=?', itemID);
				for (let { itemID, position } of rows) {
					try {
						position = JSON.parse(position);
					}
					catch (e) {
						Zotero.logError(e);
						continue;
					}
					// Find the count of deleted pages before the current annotation page
					let shift = pageIndexes.reduce((prev, cur) => cur < position.pageIndex ? prev + 1 : prev, 0);
					if (shift > 0) {
						position.pageIndex -= shift;
						position = JSON.stringify(position);
						await Zotero.DB.queryAsync('UPDATE itemAnnotations SET position=? WHERE itemID=?', [position, itemID]);
						ids.push(itemID);
					}
				}
			});
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('item');
			let loadedObjects = objectsClass.getLoaded();
			for (let object of loadedObjects) {
				if (ids.includes(object.id)) {
					await object.reload(null, true);
				}
			}
			await Zotero.Items.updateSynced(ids, false);
			await Zotero.Notifier.trigger('modify', 'item', ids, {});

			await IOUtils.write(path, new Uint8Array(modifiedBuf));
			let mtime = Math.floor(await attachment.attachmentModificationTime / 1000);
			attachment.attachmentLastProcessedModificationTime = mtime;
			await attachment.saveTx({
				skipAll: true
			});

			Zotero.debug(`Deleted pages for item ${attachment.libraryKey} in ${new Date() - t} ms`);
		}, isPriority);
	}

	/**
	 * Rotate pages in PDF attachment
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Array} pageIndexes
	 * @param {Integer} degrees 90, 180, 270
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise}
	 */
	async rotatePages(itemID, pageIndexes, degrees, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);

			Zotero.debug(`Rotating [${pageIndexes.join(', ')}] pages for item ${attachment.libraryKey}`);
			let t = new Date();

			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}

			let path = await attachment.getFilePathAsync();
			let buf = await IOUtils.read(path);
			buf = new Uint8Array(buf).buffer;

			try {
				var { buf: modifiedBuf } = await this._query('rotatePages', {
					buf, pageIndexes, degrees, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'rotatePages' failed: ${JSON.stringify({ error: e.message })}`);
				try {
					error.name = JSON.parse(e.message).name;
				}
				catch (e) {
					Zotero.logError(e);
				}
				Zotero.logError(error);
				throw error;
			}

			await IOUtils.write(path, new Uint8Array(modifiedBuf));
			let mtime = Math.floor(await attachment.attachmentModificationTime / 1000);
			attachment.attachmentLastProcessedModificationTime = mtime;
			await attachment.saveTx({
				skipAll: true
			});

			Zotero.debug(`Rotated pages for item ${attachment.libraryKey} in ${new Date() - t} ms`);
		}, isPriority);
	}

	/**
	 * Get fulltext
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Integer|null} maxPages Pages count to extract, or all pages if 'null'
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise}
	 */
	async getFullText(itemID, maxPages, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);

			Zotero.debug(`Getting fulltext content from item ${attachment.libraryKey}`);
			let t = new Date();

			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}

			let path = await attachment.getFilePathAsync();
			let buf = await IOUtils.read(path);
			buf = new Uint8Array(buf).buffer;

			try {
				var result = await this._query('getFulltext', {
					buf, maxPages, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'getFullText' failed: ${JSON.stringify({ error: e.message })}`);
				try {
					error.name = JSON.parse(e.message).name;
				}
				catch (e) {
					Zotero.logError(e);
				}
				Zotero.logError(error);
				throw error;
			}

			Zotero.debug(`Extracted full text for item ${attachment.libraryKey} in ${new Date() - t} ms`);

			return result;
		}, isPriority);
	}

	/**
	 * Get data for recognizer-server
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise}
	 */
	async getRecognizerData(itemID, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);

			Zotero.debug(`Getting PDF recognizer data from item ${attachment.libraryKey}`);
			let t = new Date();

			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}

			let path = await attachment.getFilePathAsync();
			let buf = await IOUtils.read(path);
			buf = new Uint8Array(buf).buffer;

			try {
				var result = await this._query('getRecognizerData', { buf, password }, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'getRecognizerData' failed: ${JSON.stringify({ error: e.message })}`);
				try {
					error.name = JSON.parse(e.message).name;
				}
				catch (e) {
					Zotero.logError(e);
				}
				Zotero.logError(error);
				throw error;
			}

			Zotero.debug(`Extracted PDF recognizer data for item ${attachment.libraryKey} in ${new Date() - t} ms`);

			return result;
		}, isPriority);
	}

	async renderAttachmentAnnotations(itemID, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);
			let t = new Date();

			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}

			let annotations = [];
			for (let annotation of attachment.getAnnotations()) {
				if (['image', 'ink'].includes(annotation.annotationType)
					&& !await Zotero.Annotations.hasCacheImage(annotation)) {
					annotations.push({
						id: annotation.key,
						color: annotation.annotationColor,
						position: JSON.parse(annotation.annotationPosition)
					});
				}
			}
			if (!annotations.length) {
				return 0;
			}

			Zotero.debug(`Rendering ${annotations.length} annotation(s) for attachment ${attachment.key}`);

			let path = await attachment.getFilePathAsync();
			let buf = await OS.File.read(path, {});
			buf = new Uint8Array(buf).buffer;

			let { libraryID } = attachment;

			try {
				var result = await this._query('renderAnnotations', { libraryID, buf, annotations, password }, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'renderAnnotations' failed: ${JSON.stringify({ error: e.message })}`);
				try {
					error.name = JSON.parse(e.message).name;
				}
				catch (e) {
					Zotero.logError(e);
				}
				Zotero.logError(error);
				throw error;
			}

			Zotero.debug(`Rendered ${annotations.length} PDF annotation(s) ${attachment.libraryKey} in ${new Date() - t} ms`);

			return result;
		}, isPriority);
	}

	/**
	 * Determine whether the PDF has any embedded annotations
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise<Boolean>}
	 */
	async hasAnnotations(itemID, isPriority, password) {
		return this._enqueue(async () => {
			let attachment = await Zotero.Items.getAsync(itemID);

			Zotero.debug(`Detecting embedded annotations in item ${attachment.libraryKey}`);

			if (!attachment.isPDFAttachment()) {
				throw new Error('Item must be a PDF attachment');
			}

			let path = await attachment.getFilePathAsync();
			let buf = await IOUtils.read(path);
			buf = new Uint8Array(buf).buffer;

			try {
				var result = await this._query('hasAnnotations', { buf, password }, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker 'hasAnnotations' failed: ${JSON.stringify({ error: e.message })}`);
				try {
					error.name = JSON.parse(e.message).name;
				}
				catch (e) {
					Zotero.logError(e);
				}
				Zotero.logError(error);
				throw error;
			}

			return result.hasAnnotations;
		}, isPriority);
	}
}

Zotero.PDFWorker = new PDFWorker();
