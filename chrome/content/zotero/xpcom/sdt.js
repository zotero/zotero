/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 Corporation for Digital Scholarship
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

const SDT_CACHE_FILE_NAME = '.zotero-sdt-cache';
const DOCUMENT_WORKER_METADATA_URL = 'resource://zotero/document-worker/metadata.json';

Zotero.SDT = new function () {
	// Per-item in-flight generation, so that concurrent getPack() calls share
	// one extraction and two generations can never race on the same cache file
	let _generating = new Map();
	let _sourceHashCache = new Map();
	// Source hash of the last password-required failure per item, so that a
	// password-protected file isn't re-extracted until the file changes
	let _passwordFailures = new Map();
	let _module = null;
	let _moduleErrorLogged = false;
	let _documentWorkerMetadata = null;
	let _documentWorkerMetadataErrorLogged = false;

	// Load the bundled SDT module lazily, so that a missing or broken
	// resource degrades to an 'unavailable' result instead of breaking
	// Zotero startup. Load failures aren't cached, so a load is retried
	// on the next call (require() itself caches successful loads)
	function _getModule() {
		if (!_module) {
			try {
				_module = require('resource://zotero/document-worker/structured-document-text.js');
			}
			catch (e) {
				if (!_moduleErrorLogged) {
					_moduleErrorLogged = true;
					Zotero.logError(e);
				}
				return null;
			}
		}
		return _module;
	}

	/**
	 * Get the structured document text pack for a PDF, EPUB, or snapshot
	 * attachment, generating and caching it if necessary. The returned bytes
	 * are owned by the caller -- a later regeneration can't affect them.
	 *
	 * If the cached pack was produced by an older (but still readable)
	 * processor version, it's returned as is and a regeneration is started in
	 * the background, so that processor bumps don't block consumers.
	 *
	 * @param {Integer} itemID
	 * @param {Object} [options]
	 * @param {Boolean} [options.isPriority] - Put a needed extraction at the
	 *     front of the worker queue (for user-initiated requests)
	 * @param {Function} [options.onProgress] - Called with SDT generation
	 *     progress from 0 to 100 when generation is needed
	 * @returns {Promise<Object>} { ok: true, bytes: ArrayBuffer, packVersion,
	 *     schemaMajorVersion }, or { ok: false, reason: 'unavailable' |
	 *     'password-required' | 'failed' }
	 */
	this.getPack = async function (itemID, options = {}) {
		try {
			if (!_getModule() || !(await _getDocumentWorkerMetadata())) {
				return { ok: false, reason: 'unavailable' };
			}
			let context = await _getAttachmentContext(itemID);
			if (!context.ok) {
				return { ok: false, reason: context.reason };
			}
			let cache = await _readValidCache(context, { allowStaleProcessorVersion: true });
			if (cache.ok) {
				if (cache.staleProcessorVersion) {
					_generate(context, {}).catch(e => Zotero.logError(e));
				}
				return _makeResult(cache);
			}
			return await _generate(context, options);
		}
		catch (e) {
			Zotero.logError(e);
			return { ok: false, reason: 'failed' };
		}
	};

	/**
	 * Ensure that a current pack is cached for an attachment, generating or
	 * regenerating it if necessary, without returning it. For warming up the
	 * cache (e.g., at import time), so that later getPack() calls are hits.
	 *
	 * Unlike getPack(), which returns a stale-processor pack immediately and
	 * regenerates in the background, this resolves only once the cache is
	 * fully current.
	 *
	 * @param {Integer} itemID
	 * @param {Object} [options] - See getPack()
	 * @returns {Promise<Boolean>} - Whether a current pack is cached
	 */
	this.ensure = async function (itemID, options = {}) {
		try {
			if (!_getModule() || !(await _getDocumentWorkerMetadata())) {
				return false;
			}
			let context = await _getAttachmentContext(itemID);
			if (!context.ok) {
				return false;
			}
			let cache = await _readValidCache(context, {});
			if (cache.ok) {
				return true;
			}
			let result = await _generate(context, options);
			return result.ok;
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
	};

	/**
	 * Get a parsed pack reader for in-process consumers
	 *
	 * @param {Integer} itemID
	 * @param {Object} [options] - See getPack()
	 * @returns {Promise<Object|null>}
	 */
	this.getReader = async function (itemID, options = {}) {
		let result = await this.getPack(itemID, options);
		if (!result.ok) {
			return null;
		}
		return _openPack(new Uint8Array(result.bytes));
	};

	async function _readValidCache({ sourceHash, cachePath, processorType }, options) {
		let bytes;
		try {
			bytes = await IOUtils.read(cachePath);
		}
		catch (e) {
			if (e.name === 'NotFoundError') {
				return { ok: false, reason: 'missing' };
			}
			throw e;
		}
		return _validateBytes(bytes, sourceHash, processorType, options);
	}

	// Validate a pack held in memory, so that the validated bytes can't be
	// affected by concurrent file changes
	async function _validateBytes(bytes, sourceHash, processorType, options = {}) {
		let documentWorkerMetadata = await _getDocumentWorkerMetadata();
		let expectedProcessorVersion = documentWorkerMetadata
			&& documentWorkerMetadata.SDT_PROCESSOR_VERSIONS[processorType];
		if (!expectedProcessorVersion) {
			return { ok: false, reason: 'unavailable' };
		}
		try {
			// openStructuredDocumentTextPack() validates the pack magic and
			// version itself, so a corrupt or unsupported-pack-version cache
			// throws here and is reported as 'invalid-cache'. The schema major
			// version is content semantics that the module deliberately
			// doesn't validate, so check it here
			let reader = await _openPack(bytes);
			let { header } = reader;
			if (header.packVersion !== documentWorkerMetadata.SDT_PACK_VERSION
					|| _getSchemaMajorVersion(header.schemaVersion)
						!== _getSchemaMajorVersion(documentWorkerMetadata.SDT_SCHEMA_VERSION)) {
				return { ok: false, reason: 'unsupported-version' };
			}

			let metadata = await reader.getMetadata();
			if (metadata.source?.hash !== sourceHash) {
				return { ok: false, reason: 'stale-source' };
			}
			if (metadata.processor?.type !== processorType) {
				return { ok: false, reason: 'stale-processor' };
			}
			let staleProcessorVersion = metadata.processor?.version !== expectedProcessorVersion;
			if (staleProcessorVersion
					&& !(options.allowStaleProcessorVersion
						&& _isPositiveInteger(metadata.processor?.version))) {
				return { ok: false, reason: 'stale-processor' };
			}
			return { ok: true, bytes, header, staleProcessorVersion };
		}
		catch (e) {
			return { ok: false, reason: 'invalid-cache', error: e };
		}
	}

	function _makeResult({ bytes, header }) {
		return {
			ok: true,
			// IOUtils.read() and the worker both produce exactly-sized buffers
			bytes: bytes.buffer,
			packVersion: header.packVersion,
			schemaMajorVersion: _getSchemaMajorVersion(header.schemaVersion),
		};
	}

	function _generate(context, options) {
		let key = _getItemKey(context.item);
		let generation = _generating.get(key);
		if (generation) {
			_addGenerationProgressListener(generation, options.onProgress);
			return generation.promise;
		}

		generation = {
			promise: null,
			listeners: new Set(),
			lastProgress: null,
		};
		_addGenerationProgressListener(generation, options.onProgress);

		let promise = _generateUnqueued(context, options, (progress) => {
			_reportGenerationProgress(generation, progress);
		})
			.finally(() => _generating.delete(key));
		generation.promise = promise;
		_generating.set(key, generation);
		return promise;
	}

	function _addGenerationProgressListener(generation, onProgress) {
		if (typeof onProgress !== 'function') {
			return;
		}
		generation.listeners.add(onProgress);
		if (generation.lastProgress !== null) {
			_callProgressListener(onProgress, generation.lastProgress);
		}
	}

	function _reportGenerationProgress(generation, progress) {
		generation.lastProgress = progress;
		for (let listener of generation.listeners) {
			_callProgressListener(listener, progress);
		}
	}

	function _callProgressListener(onProgress, progress) {
		try {
			onProgress(progress);
		}
		catch {
			// Progress reporting is best-effort and must not affect extraction.
		}
	}

	async function _generateUnqueued({ item, sourceHash, cachePath, processorType }, options, onProgress) {
		try {
			if (_passwordFailures.get(_getItemKey(item)) === sourceHash) {
				return { ok: false, reason: 'password-required' };
			}
			let t = new Date();
			let result = await Zotero.PDFWorker.getStructuredDocumentText(item.id, {
				isPriority: !!options.isPriority,
				onProgress,
			});
			if (!result?.buf) {
				return { ok: false, reason: 'failed' };
			}
			let bytes = new Uint8Array(result.buf);
			// Validate against the file's current hash rather than the one
			// captured above, since the file can change while the extraction
			// job waits in the worker queue and the worker stamps the hash it
			// computes at processing time
			let currentHash = await _getSourceHash(item) || sourceHash;
			let cache = await _validateBytes(bytes, currentHash, processorType);
			if (!cache.ok) {
				Zotero.debug(`Generated SDT pack for item ${item.libraryKey} is unusable: ${cache.reason}`);
				return { ok: false, reason: 'failed' };
			}
			// Don't use Zotero.Attachments.createDirectoryForItem() here -- it
			// deletes and recreates the directory, which would destroy other
			// files stored there (e.g., the full-text cache of a linked file)
			await Zotero.File.createDirectoryIfMissingAsync(PathUtils.parent(cachePath));
			await IOUtils.write(cachePath, bytes, { tmpPath: `${cachePath}.tmp` });
			Zotero.debug(
				`Generated SDT pack for item ${item.libraryKey} in ${new Date() - t} ms `
				+ `(${bytes.byteLength} bytes)`
			);
			return _makeResult(cache);
		}
		catch (e) {
			if (_isPasswordError(e)) {
				_passwordFailures.set(_getItemKey(item), sourceHash);
				return { ok: false, reason: 'password-required' };
			}
			Zotero.logError(e);
			return { ok: false, reason: 'failed' };
		}
	}

	async function _openPack(bytes) {
		let SDT = _getModule();
		let pako = require('pako');
		let source = {
			byteLength: bytes.byteLength,
			read: async (offset, length) => bytes.buffer.slice(
				bytes.byteOffset + offset,
				bytes.byteOffset + offset + length
			),
		};
		return SDT.openStructuredDocumentTextPack(source, {
			inflate: b => pako.inflateRaw(b),
		});
	}

	async function _getDocumentWorkerMetadata() {
		if (_documentWorkerMetadata) {
			return _documentWorkerMetadata;
		}
		try {
			let metadata = JSON.parse(
				await Zotero.File.getContentsFromURLAsync(DOCUMENT_WORKER_METADATA_URL)
			);
			_validateDocumentWorkerMetadata(metadata);
			_documentWorkerMetadata = metadata;
			return metadata;
		}
		catch (e) {
			if (!_documentWorkerMetadataErrorLogged) {
				_documentWorkerMetadataErrorLogged = true;
				Zotero.logError(e);
			}
			return null;
		}
	}

	function _validateDocumentWorkerMetadata(metadata) {
		let SDT = _getModule();
		if (!metadata || typeof metadata !== 'object') {
			throw new Error('Invalid document-worker metadata');
		}
		if (typeof metadata.SDT_SCHEMA_VERSION !== 'string'
				|| !_isPositiveInteger(metadata.SDT_PACK_VERSION)
				|| !metadata.SDT_PROCESSOR_VERSIONS
				|| typeof metadata.SDT_PROCESSOR_VERSIONS !== 'object') {
			throw new Error('Invalid document-worker metadata');
		}
		for (let processorType of ['pdf', 'epub', 'snapshot']) {
			if (!_isPositiveInteger(metadata.SDT_PROCESSOR_VERSIONS[processorType])) {
				throw new Error('Invalid document-worker processor metadata');
			}
		}
		if (!SDT
				|| metadata.SDT_SCHEMA_VERSION !== SDT.SDT_SCHEMA_VERSION
				|| metadata.SDT_PACK_VERSION !== SDT.SDT_PACK_VERSION) {
			throw new Error('Document-worker metadata does not match the bundled SDT reader');
		}
	}

	function _getCachePath(item) {
		return PathUtils.join(Zotero.Attachments.getStorageDirectory(item).path, SDT_CACHE_FILE_NAME);
	}

	async function _getAttachmentContext(itemID) {
		// getAsync() returns false, not null, for a nonexistent item
		let item = await Zotero.Items.getAsync(itemID);
		if (!item || !item.isAttachment()) {
			return { ok: false, reason: 'unavailable' };
		}
		// The type checks exclude linked-URL attachments, and _getSourceHash()
		// returns null when the attachment has no readable file
		let processorType = _getProcessorType(item);
		if (!processorType) {
			return { ok: false, reason: 'unavailable' };
		}
		let sourceHash = await _getSourceHash(item);
		if (!sourceHash) {
			return { ok: false, reason: 'unavailable' };
		}
		return {
			ok: true,
			item,
			sourceHash,
			processorType,
			cachePath: _getCachePath(item),
		};
	}

	function _getProcessorType(item) {
		if (item.isPDFAttachment()) {
			return 'pdf';
		}
		if (item.isEPUBAttachment()) {
			return 'epub';
		}
		if (item.isSnapshotAttachment()) {
			return 'snapshot';
		}
		return null;
	}

	function _getSchemaMajorVersion(schemaVersion) {
		return Number(String(schemaVersion).split('.')[0]);
	}

	function _getItemKey(item) {
		return `${item.libraryID}/${item.key}`;
	}

	function _isPositiveInteger(value) {
		return Number.isInteger(value) && value > 0;
	}

	async function _getSourceHash(item) {
		try {
			// attachmentHash reads and hashes the whole file, so reuse the
			// result as long as the file's path, size, and mtime are unchanged
			let path = await item.getFilePathAsync();
			if (!path) {
				return null;
			}
			let { size, lastModified } = await IOUtils.stat(path);
			let cached = _sourceHashCache.get(item.id);
			if (cached
					&& cached.path === path
					&& cached.size === size
					&& cached.mtime === lastModified) {
				return cached.hash;
			}
			let hash = await item.attachmentHash;
			if (hash) {
				_sourceHashCache.set(item.id, { path, size, mtime: lastModified, hash });
			}
			return hash;
		}
		catch (e) {
			if (e.name !== 'NotFoundError') {
				Zotero.logError(e);
			}
			return null;
		}
	}

	function _isPasswordError(e) {
		// Password-protected documents aren't supported, but the failure is
		// classified as 'password-required' so that the reason can be shown
		// to the user. (PDFWorker restores the error name from the worker
		// error JSON.)
		return e?.name === 'PasswordException';
	}
};
