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
const ASSETS_URL = 'chrome://zotero/content/xpcom/pdfWorker/';
const READER_PDF_ASSETS_URL = 'resource://zotero/reader/pdf/web/';

function getAssetURL(path) {
	if (path.startsWith('cmaps/') || path.startsWith('standard_fonts/')) {
		return READER_PDF_ASSETS_URL + path;
	}
	return ASSETS_URL + path;
}

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

	// Like _query, but onPartial fires for each isPartial message before the
	// terminal response resolves the promise. Returns { promise, abort }.
	_streamingQuery(action, data, transfer, onPartial) {
		this._lastPromiseID++;
		let id = this._lastPromiseID;
		let promise = new Promise((resolve, reject) => {
			this._waitingPromises[id] = { resolve, reject, onPartial };
			this._worker.postMessage({ id, action, data }, transfer);
		});
		let abort = () => {
			if (this._worker && this._waitingPromises[id]) {
				this._worker.postMessage({ action: 'abort', id });
			}
		};
		return { promise, abort };
	}

	_init() {
		if (this._worker) return;
		this._worker = new Worker(WORKER_URL);
		this._worker.addEventListener('message', async (event) => {
			let message = event.data;
			if ('responseID' in message) {
				let promise = this._waitingPromises[message.responseID];
				if (!promise) {
					Zotero.debug(`Received response from PDF worker for unknown request ${message.responseID}`);
					return;
				}
				if (message.isPartial) {
					if (promise.onPartial) {
						try {
							promise.onPartial(message.data);
						}
						catch (e) {
							Zotero.logError(e);
						}
					}
					return;
				}
				delete this._waitingPromises[message.responseID];
				let { resolve, reject } = promise;
				if ('error' in message) {
					reject(new Error(JSON.stringify(message.error)));
				}
				else {
					resolve(message.data);
				}
				return;
			}
			if ('id' in message) {
				let respData = null;
				try {
					if (message.action === 'FetchData') {
						let response = await Zotero.HTTP.request(
							'GET',
							getAssetURL(message.data),
							{ responseType: 'arraybuffer' }
						);
						respData = new Uint8Array(response.response);
					}
				}
				catch (e) {
					Zotero.debug(`Failed to fetch data (${message.data}):`);
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
			Zotero.logError(`Document worker error (${event.filename}:${event.lineno}): ${event.message}`);
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
			if (!annotations.length) {
				await Zotero.File.copyFile(attachmentPath, path);
				return 0;
			}
			let buf = await IOUtils.read(attachmentPath);
			buf = new Uint8Array(buf).buffer;

			try {
				var res = await this._query('pdf.writeAnnotations', {
					buf, annotations, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.writeAnnotations' failed: ${JSON.stringify({
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
			
			await IOUtils.write(path, new Uint8Array(res.buf));
			
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

			let mtime = Math.floor((await attachment.attachmentModificationTime) / 1000);
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
				var { imported, deleted, buf: modifiedBuf } = await this._query('pdf.importAnnotations', {
					buf, existingAnnotations, password, transfer
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.importAnnotations' failed: ${JSON.stringify({
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
					mtime = Math.floor((await attachment.attachmentModificationTime) / 1000);
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
				var annotations = await this._query('pdf.importCitaviAnnotations', {
					buf, citaviAnnotations, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.importCitaviAnnotations' failed: ${JSON.stringify({
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
				var annotations = await this._query('pdf.importMendeleyAnnotations', {
					buf, mendeleyAnnotations, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.importMendeleyAnnotations' failed: ${JSON.stringify({
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
				var { buf: modifiedBuf } = await this._query('pdf.deletePages', {
					buf, pageIndexes, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.deletePages' failed: ${JSON.stringify({ error: e.message })}`);
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
			let mtime = Math.floor((await attachment.attachmentModificationTime) / 1000);
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
				var { buf: modifiedBuf } = await this._query('pdf.rotatePages', {
					buf, pageIndexes, degrees, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.rotatePages' failed: ${JSON.stringify({ error: e.message })}`);
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
			let mtime = Math.floor((await attachment.attachmentModificationTime) / 1000);
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
				var result = await this._query('pdf.getFulltext', {
					buf, maxPages, password
				}, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.getFulltext' failed: ${JSON.stringify({ error: e.message })}`);
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
	 * Get structured document text for a PDF, EPUB, or snapshot attachment
	 *
	 * @param {Integer} itemID Attachment item id
	 * @param {Boolean} [isPriority]
	 * @param {String} [password]
	 * @returns {Promise<Object|null>}
	 */
	async getStructuredData(itemID, isPriority, password) {
		return this._enqueue(async () => {
			let prep = await this._prepareStructuredDataRequest(itemID);
			if (!prep) return null;
			let { attachment, contentType, buf, sourceHash } = prep;
			Zotero.debug(`Getting structured document text from item ${attachment.libraryKey}`);
			let t = new Date();
			try {
				var result = await this._query('getStructuredDocumentText', {
					buf, contentType, password, sourceHash
				}, [buf]);
			}
			catch (e) {
				throw this._wrapStructuredDataError(e);
			}
			Zotero.debug(`Extracted structured document text for item ${attachment.libraryKey} in ${new Date() - t} ms`);
			return result;
		}, isPriority);
	}

	async _prepareStructuredDataRequest(itemID) {
		let attachment = await Zotero.Items.getAsync(itemID);
		if (!(attachment.isPDFAttachment()
				|| attachment.isEPUBAttachment()
				|| attachment.isSnapshotAttachment())) {
			throw new Error('Item must be a PDF, EPUB, or snapshot attachment');
		}
		let path = await attachment.getFilePathAsync();
		if (!path) return null;
		let buf = await IOUtils.read(path);
		let sourceHash = await attachment.attachmentHash;
		if (!sourceHash) {
			throw new Error('Attachment is missing an MD5 hash');
		}
		return {
			attachment,
			contentType: attachment.attachmentContentType,
			buf: new Uint8Array(buf).buffer,
			sourceHash,
		};
	}

	_wrapStructuredDataError(e) {
		let error = new Error(`Worker action 'getStructuredDocumentText' failed: ${JSON.stringify({ error: e.message })}`);
		try {
			error.name = JSON.parse(e.message).name;
		}
		catch (parseErr) {
			Zotero.logError(parseErr);
		}
		Zotero.logError(error);
		return error;
	}

	// Streaming variant of getStructuredData. onChunk receives partial chunks
	// ({ kind: 'partial', pages, content, pageIndexOffset, contentIndexOffset,
	// pageIndexRange, totalPageCount }) followed by a final chunk
	// ({ kind: 'final', structure }). Returns { promise, abort }.
	getStructuredDataStream(itemID, onChunk, options = {}) {
		let abortFn = null;
		let aborted = false;
		let { password, batchSize, isPriority } = options;
		let promise = this._enqueue(async () => {
			if (aborted) {
				let e = new Error('Aborted');
				e.name = 'AbortError';
				throw e;
			}
			let prep = await this._prepareStructuredDataRequest(itemID);
			if (!prep) return;
			let { attachment, contentType, buf, sourceHash } = prep;
			Zotero.debug(`Streaming structured document text from item ${attachment.libraryKey}`);
			let t = new Date();
			try {
				let { promise: queryPromise, abort } = this._streamingQuery(
					'getStructuredDocumentTextJSON',
					{
						buf,
						contentType,
						password,
						sourceHash,
						streaming: true,
						...(batchSize ? { batchSize } : {}),
					},
					[buf],
					onChunk
				);
				abortFn = abort;
				if (aborted) abort();
				await queryPromise;
			}
			catch (e) {
				throw this._wrapStructuredDataError(e);
			}
			Zotero.debug(`Streamed structured document text for item ${attachment.libraryKey} in ${new Date() - t} ms`);
		}, isPriority);
		return {
			promise,
			abort: () => {
				aborted = true;
				if (abortFn) abortFn();
			},
		};
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
				var result = await this._query('pdf.getRecognizerData', { buf, password }, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.getRecognizerData' failed: ${JSON.stringify({ error: e.message })}`);
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
					&& !(await Zotero.Annotations.hasCacheImage(annotation))) {
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
			if (!path) {
				return 0;
			}
			let buf = await OS.File.read(path, {});
			buf = new Uint8Array(buf).buffer;

			let { libraryID } = attachment;

			try {
				var result = await this._query('pdf.renderAnnotations', { libraryID, buf, annotations, password }, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.renderAnnotations' failed: ${JSON.stringify({ error: e.message })}`);
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
				var result = await this._query('pdf.hasAnnotations', { buf, password }, [buf]);
			}
			catch (e) {
				let error = new Error(`Worker action 'pdf.hasAnnotations' failed: ${JSON.stringify({ error: e.message })}`);
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
