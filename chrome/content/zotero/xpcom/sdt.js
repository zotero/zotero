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

	// Load the bundled SDT modules -- the pack reader and the chunker --
	// lazily, so a missing or broken resource degrades to 'unavailable'
	// rather than breaking startup; a failed load is retried on the next
	// call (require() itself caches successful loads)
	function _getModule() {
		if (!_module) {
			try {
				_module = {
					...require('resource://zotero/document-worker/structured-document-text.js'),
					...require('resource://zotero/document-worker/structured-document-text-chunker.js')
				};
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
	 * attachment, generating and caching it if necessary. A pack from an
	 * older but readable processor version is returned as is and regenerated
	 * in the background, unless allowStale is false.
	 *
	 * @param {Integer} itemID
	 * @param {Object} [options]
	 * @param {Boolean} [options.isPriority] - Put a needed extraction at the
	 *     front of the worker queue (for user-initiated requests)
	 * @param {Boolean} [options.allowStale=true] - Whether a cached pack from
	 *     an older processor version may be returned
	 * @param {Boolean} [options.cachedOnly] - Return 'not-cached' rather than
	 *     extracting the document when no pack is cached
	 * @param {Function} [options.onProgress] - Called with SDT generation
	 *     progress from 0 to 100 when generation is needed
	 * @returns {Promise<Object>} { ok: true, bytes: ArrayBuffer, packVersion,
	 *     schemaMajorVersion }, or { ok: false, reason: 'unavailable' |
	 *     'password-required' | 'not-cached' | 'failed' }
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
			let cache = await _readValidCache(context, {
				allowStaleProcessorVersion: options.allowStale !== false
			});
			if (cache.ok) {
				if (cache.staleProcessorVersion) {
					_generate(context, {}).catch(e => Zotero.logError(e));
				}
				return _makeResult(cache);
			}
			// Extracting a document costs seconds; a caller that only wants
			// structure if it's already there says so rather than waiting
			if (options.cachedOnly) {
				return { ok: false, reason: 'not-cached' };
			}
			return await _generate(context, options);
		}
		catch (e) {
			Zotero.logError(e);
			return { ok: false, reason: 'failed' };
		}
	};

	/**
	 * Ensure a current pack is cached for an attachment, generating or
	 * regenerating it if necessary, without returning it. Unlike getPack(),
	 * this resolves only once the cache is current.
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
	 * Whether an attachment's cached pack was made by the extraction this
	 * module does now: the same pack format, schema major version and
	 * processor. Only the pack's front matter and metadata are read, and
	 * not the attachment, so a pack made from an earlier file still counts.
	 *
	 * @param {Integer} itemID
	 * @returns {Promise<Boolean>} - False also when there's no readable pack
	 */
	this.isCurrent = async function (itemID) {
		let item = await Zotero.Items.getAsync(itemID, { noCache: true });
		let processorType = item && item.isAttachment() && _getProcessorType(item);
		let expected = processorType && _getModule() && await _getDocumentWorkerMetadata();
		if (!expected) {
			return false;
		}
		let path = _getCachePath(item);
		try {
			let { size } = await IOUtils.stat(path);
			let reader = await _getModule().openStructuredDocumentTextPack({
				byteLength: size,
				read: async (offset, length) => {
					let bytes = await IOUtils.read(path, { offset, maxBytes: length });
					return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
				}
			}, { inflate: b => require('pako').inflateRaw(b) });
			let { header } = reader;
			let { processor } = await reader.getMetadata();
			return header.packVersion === expected.SDT_PACK_VERSION
				&& _getSchemaMajorVersion(header.schemaVersion)
					=== _getSchemaMajorVersion(expected.SDT_SCHEMA_VERSION)
				&& processor?.type === processorType
				&& processor?.version === expected.SDT_PROCESSOR_VERSIONS[processorType];
		}
		catch {
			// Missing, or not a pack this module can open
			return false;
		}
	};

	/**
	 * The chunks of an attachment's structured text, for embedding, cut in
	 * the document worker so that neither inflating the pack nor cutting it
	 * blocks this thread. Each carries its plain `text`, the `embedText`
	 * with outline context woven in, its estimated `tokens`, `outlinePath`,
	 * `pageLabel`, `anchor` -- where in the file its text is, null when the
	 * document has no geometry for it -- and `position`, the reader
	 * position it opens at, null when the anchor doesn't resolve.
	 *
	 * @param {Integer} itemID
	 * @param {Object} [options] - getPack()'s options, `isPriority` putting
	 *     the cut at the front of the worker queue too
	 * @param {Boolean} [options.annotations] - Give each chunk the
	 *     attachment's `annotations` on its text, as readAnchors() does
	 * @returns {Promise<Object>} - { ok: true, chunks, contentHash }, the
	 *     hash being the source file's as the pack records it, or
	 *     { ok: false, reason }: getPack()'s reasons, or 'cut-failed' when
	 *     the pack is there but the worker couldn't cut it
	 */
	this.getItemChunks = async function (itemID, { annotations = false, ...options } = {}) {
		let result = await this.getPack(itemID, options);
		if (!result.ok) {
			return { ok: false, reason: result.reason };
		}
		let marks = annotations ? _getTextAnnotations(itemID) : [];
		let cut;
		try {
			cut = await Zotero.PDFWorker.getStructuredDocumentTextChunks(
				result.bytes, {
					isPriority: options.isPriority,
					positions: marks.map(mark => mark.position)
				});
		}
		catch {
			// Logged by the worker manager
			return { ok: false, reason: 'cut-failed' };
		}
		// The worker and the bundled chunker come from the same build, so a
		// mismatch is a build defect, not something to work around
		let version = _getModule().CHUNKER_VERSION;
		if (cut.chunkerVersion !== version) {
			Zotero.logError(new Error(`Document worker chunker version ${cut.chunkerVersion} `
				+ `doesn't match the bundled chunker's ${version}`));
			return { ok: false, reason: 'cut-failed' };
		}
		let chunks = cut.chunks.map((chunk) => {
			if (annotations) {
				chunk = _withAnnotations(chunk, marks);
			}
			else {
				delete chunk.overlaps;
			}
			return _withFirstPosition(chunk);
		});
		return { ok: true, chunks, contentHash: cut.sourceHash };
	};

	/**
	 * The chunks of a plain text with no structure, paragraphs separated by
	 * blank lines, as getItemChunks() gives them but without an anchor
	 *
	 * @param {String} text
	 * @param {Object} [options] - The module's chunking options
	 * @returns {Object[]}
	 */
	this.getPlainTextChunks = function (text, options = {}) {
		return _getModule().getPlainTextChunks(text, options);
	};

	/**
	 * Read chunks back from an attachment's structured text by their stored
	 * anchors, in the document worker so that neither inflating the pack
	 * nor reading it blocks this thread. An anchor on nothing the current
	 * extraction has, as after the file changed, reads back as null.
	 *
	 * @param {Integer} itemID
	 * @param {Object[]} anchors - A chunk's `anchor` per entry
	 * @param {Object} [options] - getPack()'s options, `isPriority` putting
	 *     the read at the front of the worker queue too
	 * @returns {Promise<Object>} { ok: true, chunks: [{ text, outlinePath,
	 *     pageLabel, position, annotations } | null] }, `position` the
	 *     reader position the chunk opens at and `annotations` the
	 *     attachment's highlights and underlines on its text, each
	 *     { key, type, color, comment, ranges } with the { start, end }
	 *     ranges of `text` it covers; or { ok: false, reason }: getPack()'s
	 *     reasons, or 'failed' when the worker couldn't read the pack
	 */
	this.readAnchors = async function (itemID, anchors, options = {}) {
		let result = await this.getPack(itemID, options);
		if (!result.ok) {
			return { ok: false, reason: result.reason };
		}
		let marks = _getTextAnnotations(itemID);
		try {
			let chunks = await Zotero.PDFWorker.readStructuredDocumentTextAnchors(
				result.bytes, anchors, {
					isPriority: options.isPriority,
					positions: marks.map(mark => mark.position)
				});
			return {
				ok: true,
				chunks: chunks.map(chunk => chunk && _withFirstPosition(_withAnnotations(chunk, marks)))
			};
		}
		catch {
			// Logged by the worker manager
			return { ok: false, reason: 'failed' };
		}
	};

	/**
	 * The identity of the extraction and division this module would produce
	 * for an attachment right now: its processor type and version, the pack
	 * schema's major version and the chunker's version. Null when the
	 * attachment isn't a supported type or the extraction module isn't
	 * available.
	 *
	 * @param {Zotero.Item} item
	 * @returns {Promise<String|null>} - e.g. 'pdf/3/1/1'
	 */
	this.getProcessorVersion = async function (item) {
		let processorType = _getProcessorType(item);
		if (!processorType) {
			return null;
		}
		let metadata = await _getDocumentWorkerMetadata();
		if (!metadata) {
			return null;
		}
		return _getProcessorVersion(metadata, processorType);
	};

	/**
	 * The identities getProcessorVersion() gives right now, one per
	 * processor type. Empty when the extraction module isn't available.
	 *
	 * @returns {Promise<String[]>}
	 */
	this.getProcessorVersions = async function () {
		let metadata = await _getDocumentWorkerMetadata();
		if (!metadata) {
			return [];
		}
		return Object.keys(metadata.SDT_PROCESSOR_VERSIONS)
			.map(processorType => _getProcessorVersion(metadata, processorType));
	};

	function _getProcessorVersion(metadata, processorType) {
		return processorType
			+ '/' + metadata.SDT_PROCESSOR_VERSIONS[processorType]
			+ '/' + _getSchemaMajorVersion(metadata.SDT_SCHEMA_VERSION)
			+ '/' + _getModule().CHUNKER_VERSION;
	}

	/**
	 * The version of the chunker that cuts text here, structured or plain.
	 * Null when the module isn't available.
	 *
	 * @returns {Number|null}
	 */
	this.getChunkerVersion = function () {
		let module = _getModule();
		return module ? module.CHUNKER_VERSION : null;
	};

	// A chunk from the worker with only the first of its positions, the one
	// the reader opens at
	function _withFirstPosition({ positions, ...chunk }) {
		return { ...chunk, position: positions?.[0] || null };
	}

	// The attachment's annotations that mark a stretch of its text, with
	// their reader positions parsed
	function _getTextAnnotations(itemID) {
		let item = Zotero.Items.get(itemID);
		if (!item?.isAttachment()) {
			return [];
		}
		return item.getAnnotations()
			.filter(annotation => ['highlight', 'underline'].includes(annotation.annotationType))
			.map(annotation => ({
				key: annotation.key,
				type: annotation.annotationType,
				color: annotation.annotationColor,
				comment: annotation.annotationComment,
				position: JSON.parse(annotation.annotationPosition)
			}));
	}

	// The marks that cover some of the chunk's text, each with the ranges
	// the worker found for its position, in place of the ranges
	function _withAnnotations({ overlaps, ...chunk }, marks) {
		let annotations = [];
		marks.forEach(({ key, type, color, comment }, i) => {
			if (overlaps?.[i]) {
				annotations.push({ key, type, color, comment, ranges: overlaps[i] });
			}
		});
		return { ...chunk, annotations };
	}

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
		// getAsync() returns false, not null, for a nonexistent item. The
		// item is read, never shown or saved, so it isn't kept in the cache
		// when it wasn't there already.
		let item = await Zotero.Items.getAsync(itemID, { noCache: true });
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

/**
 * Zotero.SDT.AutoIndex -- extract sdt of every valid attachment.
 */
Zotero.SDT.AutoIndex = new function () {
	// Debounce before a sweep starts, so a burst of saved attachments (an
	// import, a sync) is taken in one
	const KICK_DELAY = 3000;
	// Before the first sweep of a session, out of the way of startup
	const STARTUP_DELAY = 10000;

	let _initialized = false;
	let _sweeping = null;
	let _kicked = false;
	let _kickTimer = null;
	// While a sweep runs, how often listeners hear of its progress
	const NOTIFY_INTERVAL = 500;

	// Attachments settled this session -- cached, or not extractable as
	// they are -- until they're saved again
	let _settled = new Set();
	// Eligible attachments as the last count found them, null before one
	let _total = null;
	let _listeners = new Set();
	let _notifiedAt = 0;

	/**
	 * Wire up the sweep: kicked by saved attachments and finished syncs,
	 * and once at startup. Guarded so multiple windows don't double-register.
	 */
	this.init = function () {
		if (_initialized) {
			return;
		}
		_initialized = true;
		Zotero.Prefs.registerObserver('sdt.autoExtract', () => {
			_notify();
			this.kick();
		});
		Zotero.Notifier.registerObserver({
			notify: (event, type, ids) => {
				if (type == 'sync') {
					if (event == 'finish') {
						this.kick();
					}
					return;
				}
				if (event == 'add' || event == 'modify') {
					// A saved attachment may have a new file, or its first
					for (let id of ids) {
						_settled.delete(id);
					}
					this.kick();
				}
			}
		}, ['item', 'sync'], 'sdtAutoIndex');
		this.kick(STARTUP_DELAY);
	};

	/**
	 * Whether attachments are extracted ahead of time at all
	 * @return {Boolean}
	 */
	this.isEnabled = function () {
		return !!Zotero.Prefs.get('sdt.autoExtract');
	};

	/**
	 * Start a sweep after a delay, which gathers a burst of kicks into one.
	 * A kick during a sweep has it go again once it's over.
	 *
	 * @param {Number} [delay=KICK_DELAY] - Milliseconds
	 */
	this.kick = function (delay = KICK_DELAY) {
		if (!this.isEnabled()) {
			return;
		}
		if (_kickTimer) {
			clearTimeout(_kickTimer);
		}
		_kickTimer = setTimeout(() => {
			_kickTimer = null;
			this.sweep();
		}, delay);
	};

	/**
	 * @return {Object} - { enabled, sweeping, settled, total }: the
	 *     attachments settled this session out of the eligible ones, `total`
	 *     null until they're first counted
	 */
	this.getStatus = function () {
		return {
			enabled: this.isEnabled(),
			sweeping: !!_sweeping,
			settled: _settled.size,
			total: _total
		};
	};

	/**
	 * Count the eligible attachments, if not counted yet, and notify
	 * listeners
	 *
	 * @return {Promise<Object>} - The status, as getStatus() gives it
	 */
	this.refreshStatus = async function () {
		if (_total === null) {
			_total = (await _getEligibleIDs()).length;
		}
		_notify();
		return this.getStatus();
	};

	/**
	 * @param {Function} fn - Called with the status, as getStatus() gives it,
	 *     when a sweep starts, as it goes and when it ends
	 */
	this.addListener = function (fn) {
		_listeners.add(fn);
	};

	this.removeListener = function (fn) {
		_listeners.delete(fn);
	};

	/**
	 * Go over every eligible attachment again now, including those already
	 * settled this session, as after their caches were cleared
	 *
	 * @return {Promise} - The sweep, as sweep() gives it
	 */
	this.restart = function () {
		_settled.clear();
		_notify();
		if (_kickTimer) {
			clearTimeout(_kickTimer);
			_kickTimer = null;
		}
		return this.sweep();
	};

	/**
	 * Sweep now: go over every eligible attachment and extract where no
	 * current pack is cached, until there's nothing left or the preference
	 * is turned off. Returns the sweep already going when there is one.
	 *
	 * @return {Promise}
	 */
	this.sweep = function () {
		if (_sweeping) {
			_kicked = true;
			return _sweeping;
		}
		_sweeping = _sweep()
			.catch(e => Zotero.logError(e))
			.finally(() => {
				_sweeping = null;
				_notify();
				if (_kicked) {
					_kicked = false;
					this.kick();
				}
			});
		return _sweeping;
	};

	// The eligible attachments: PDFs and EPUBs with a file, imported or
	// linked, and snapshots, in the user and group libraries. Ids only, so
	// a whole library is a few hundred kilobytes at most.
	async function _getEligibleIDs() {
		let libraryIDs = Zotero.Libraries.getAll()
			.filter(library => ['user', 'group'].includes(library.libraryType))
			.map(library => library.libraryID);
		return Zotero.DB.columnQueryAsync(
			"SELECT itemID FROM itemAttachments IA JOIN items I USING (itemID) "
				+ "WHERE ((IA.contentType IN ('application/pdf', 'application/epub+zip') "
					+ "AND IA.linkMode!=" + Zotero.Attachments.LINK_MODE_LINKED_URL + ") "
					+ "OR (IA.contentType='text/html' "
						+ "AND IA.linkMode=" + Zotero.Attachments.LINK_MODE_IMPORTED_URL + ")) "
				+ "AND I.libraryID IN (" + (libraryIDs.join(',') || 'NULL') + ") "
				+ "ORDER BY I.itemID"
		);
	}

	function _notify() {
		_notifiedAt = Date.now();
		let status = Zotero.SDT.AutoIndex.getStatus();
		for (let fn of _listeners) {
			try {
				fn(status);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	}

	async function _sweep() {
		let started = Date.now();
		let extracted = 0;
		let eligibleIDs = await _getEligibleIDs();
		// Attachments gone since, or no longer eligible, don't count
		let eligible = new Set(eligibleIDs);
		_settled = new Set([..._settled].filter(id => eligible.has(id)));
		_total = eligibleIDs.length;
		_notify();
		for (let itemID of eligibleIDs) {
			if (!Zotero.SDT.AutoIndex.isEnabled()) {
				break;
			}
			if (_settled.has(itemID)) {
				continue;
			}
			// The pack's first bytes, so a settled library costs little to
			// go over; one an older extraction made is made again
			if (!await Zotero.SDT.isCurrent(itemID)) {
				// Whatever the outcome -- extracted, no file, password,
				// failed -- the attachment is left alone until it's saved
				// again, which brings a file or a new one
				if (await Zotero.SDT.ensure(itemID)) {
					extracted++;
				}
			}
			_settled.add(itemID);
			if (Date.now() - _notifiedAt >= NOTIFY_INTERVAL) {
				_notify();
			}
		}
		if (extracted) {
			Zotero.debug(`SDT: sweep extracted ${extracted} `
				+ Zotero.Utilities.pluralize(extracted, 'attachment')
				+ ` in ${Math.round((Date.now() - started) / 1000)} s`);
		}
	}
};
