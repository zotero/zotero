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
	 * the background, so that processor bumps don't block consumers. Pass
	 * allowStale: false to wait for the regeneration instead -- for consumers
	 * that store references into the pack's content and can't have the cache
	 * change out from under them.
	 *
	 * @param {Integer} itemID
	 * @param {Object} [options]
	 * @param {Boolean} [options.isPriority] - Put a needed extraction at the
	 *     front of the worker queue (for user-initiated requests)
	 * @param {Boolean} [options.allowStale=true] - Whether a cached pack from
	 *     an older processor version may be returned
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
			let cache = await _readValidCache(context, {
				allowStaleProcessorVersion: options.allowStale !== false
			});
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

	/**
	 * Get an attachment's text as outline-based sections. Each section runs
	 * from one outline heading to the next; a document without an outline
	 * falls back to per-page sections, and to a single section when there are
	 * no pages either.
	 *
	 * Blocks the document marks as excluded flow (running heads, page
	 * numbers) are left out. The rest is reported as the document describes
	 * it, for callers to filter as their use calls for: a section lists the
	 * blocks it's made of, each with its flow class and whether it's a
	 * reference entry, and `text` is simply those blocks joined.
	 *
	 * Sections and blocks carry what the document knows about where they are:
	 * - pageIndex: 0-based index into the document's pages
	 * - pageLabel: page label ('ix', '15'), or the ordinal page number for a
	 *   PDF without labels. An EPUB's synthetic locations produce none.
	 * - position: for PDFs, a reader-navigable { pageIndex, rects }
	 * A section's location is that of its first block.
	 *
	 * @param {Integer} itemID
	 * @param {Object} [options] - See getPack()
	 * @returns {Promise<Object>} { ok: true, sections: [{ text, outlinePath,
	 *     startBlock, endBlock, pageIndex, pageLabel, position, blocks:
	 *     [{ index, text, flowClass, reference, pageIndex, pageLabel,
	 *     position }] }] }, or { ok: false, reason } (see getPack())
	 */
	this.getSections = async function (itemID, options = {}) {
		let result = await this.getPack(itemID, options);
		if (!result.ok) {
			return { ok: false, reason: result.reason };
		}
		try {
			let reader = await _openPack(new Uint8Array(result.bytes));
			let structure = await reader.materialize();
			return { ok: true, sections: _getStructureSections(structure) };
		}
		catch (e) {
			Zotero.logError(e);
			return { ok: false, reason: 'failed' };
		}
	};

	/**
	 * Get ranges of an attachment's top-level blocks, without materializing
	 * the whole document -- the pack stores blocks in independently
	 * compressed groups, so only the groups a range touches are read. For
	 * consumers that keep block references into the document (e.g. where an
	 * embedded chunk came from) and later need those blocks' text and
	 * location back.
	 *
	 * Each requested [startBlock, endBlock] range (inclusive) yields its
	 * blocks in order, reported the way getSections() reports them -- plain
	 * text, flow class, whether it's a reference entry, page and position --
	 * plus `outlineHeading` for blocks the outline uses as section headings
	 * (whose text getSections() folds into the outline path instead of the
	 * running text), and the outline path in effect where the range starts.
	 *
	 * @param {Integer} itemID
	 * @param {Number[][]} ranges - [startBlock, endBlock] pairs
	 * @param {Object} [options] - See getPack()
	 * @returns {Promise<Object>} { ok: true, ranges: [{ outlinePath, blocks:
	 *     [{ index, text, flowClass, reference, outlineHeading, pageIndex,
	 *     pageLabel, position }] }] }, or { ok: false, reason } (see
	 *     getPack())
	 */
	this.getBlockRanges = async function (itemID, ranges, options = {}) {
		let result = await this.getPack(itemID, options);
		if (!result.ok) {
			return { ok: false, reason: result.reason };
		}
		try {
			let reader = await _openPack(new Uint8Array(result.bytes));
			let metadata = await reader.getMetadata();
			let catalog = await reader.getCatalog();
			let blockCount = reader.getTopLevelBlockCount();
			let blockPages = _getBlockPages(catalog, blockCount);
			let headings = _flattenOutline(catalog?.outline, [])
				.sort((a, b) => a.blockIndex - b.blockIndex);
			let headingBlocks = new Set(headings.map(heading => heading.blockIndex));
			let results = [];
			for (let [startBlock, endBlock] of ranges) {
				let nodes = await reader.getBlocks(startBlock, endBlock);
				let first = Math.max(0, startBlock);
				let blocks = nodes.map((node, i) => {
					let index = first + i;
					let entry = {
						index,
						text: _getNestedBlockPlainText(node).trim(),
						reference: _isReferenceBlock(node),
						outlineHeading: headingBlocks.has(index)
					};
					if (node.flowClass) {
						entry.flowClass = node.flowClass;
					}
					return Object.assign(entry,
						_getBlockLocation(node, catalog, metadata, blockPages, index));
				});
				// The path of the last outline heading at or before the
				// range's start -- the same path getSections() gives the
				// section the range starts in
				let path = [];
				for (let heading of headings) {
					if (heading.blockIndex > startBlock) {
						break;
					}
					path = heading.path;
				}
				results.push({ outlinePath: path.join(' > '), blocks });
			}
			return { ok: true, ranges: results };
		}
		catch (e) {
			Zotero.logError(e);
			return { ok: false, reason: 'failed' };
		}
	};

	/**
	 * The identity of the extraction this module would produce for an
	 * attachment right now: its processor type and version plus the pack
	 * schema's major version. For consumers that store data derived from
	 * packs, to fold into their staleness keys, so that a processor upgrade
	 * -- which changes what the same file extracts to -- re-derives what they
	 * stored. Null when the attachment isn't a supported type or the
	 * extraction module isn't available.
	 *
	 * @param {Zotero.Item} item
	 * @returns {Promise<String|null>} - e.g. 'pdf/3/1'
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
		return processorType
			+ '/' + metadata.SDT_PROCESSOR_VERSIONS[processorType]
			+ '/' + _getSchemaMajorVersion(metadata.SDT_SCHEMA_VERSION);
	};

	// The section walk over a materialized structure. Mirrors the outline
	// handling of the document-worker's own section chunker
	// (structured-document-text/src/chunker.js), which the bundled reader
	// module doesn't export; switch to that export if it grows one.
	function _getStructureSections(structure) {
		let content = Array.isArray(structure?.content) ? structure.content : [];
		if (!content.length) {
			return [];
		}
		// Section boundaries: the outline's heading blocks, or page starts for
		// a document without an outline. Block 0 is always a boundary, so
		// front matter before the first heading forms a section of its own.
		let headings = _flattenOutline(structure.catalog?.outline, []);
		let boundaries = headings.length
			? headings
			: _getPageBoundaries(structure.catalog, content.length);
		// A boundary at block 0 emits no section of its own -- it just seeds
		// the first section's path
		boundaries = boundaries
			.filter(b => b.blockIndex < content.length)
			.sort((a, b) => a.blockIndex - b.blockIndex);
		let blockPages = _getBlockPages(structure.catalog, content.length);

		let sections = [];
		let startBlock = 0;
		let path = [];
		let isHeading = false;
		for (let boundary of [...boundaries, { blockIndex: content.length, path }]) {
			if (boundary.blockIndex > startBlock) {
				let endBlock = boundary.blockIndex - 1;
				let blocks = [];
				let location = null;
				// A section that starts at an outline heading skips the
				// heading block's own text: the heading is already the last
				// component of the section's outline path
				for (let i = startBlock + (isHeading ? 1 : 0); i <= endBlock; i++) {
					let block = content[i];
					if (!block || block.flowClass === 'excluded') {
						continue;
					}
					let text = _getNestedBlockPlainText(block).trim();
					if (!text) {
						continue;
					}
					let entry = { index: i, text, reference: _isReferenceBlock(block) };
					if (block.flowClass) {
						entry.flowClass = block.flowClass;
					}
					let blockLocation = _getBlockLocation(
						block, structure.catalog, structure.metadata, blockPages, i);
					location = location || blockLocation;
					blocks.push(Object.assign(entry, blockLocation));
				}
				if (blocks.length) {
					// A section is located where it begins -- at its heading
					// when it has one, since that's where a reader would land
					// -- falling back to its first reported block
					let start = _getBlockLocation(content[startBlock],
						structure.catalog, structure.metadata, blockPages, startBlock);
					sections.push(Object.assign({
						text: blocks.map(block => block.text).join('\n'),
						outlinePath: path.join(' > '),
						startBlock,
						endBlock
					}, start.pageIndex === undefined ? location : start, { blocks }));
				}
			}
			startBlock = boundary.blockIndex;
			path = boundary.path;
			isHeading = !!boundary.isHeading;
		}
		return sections;
	}

	// Where a block sits in the source document, as far as the document says.
	// Only the fields that are actually known are returned.
	function _getBlockLocation(node, catalog, metadata, blockPages, index) {
		let location = {};
		// PDF blocks carry page geometry: [pageIndex, x1, y1, x2, y2] rects,
		// which the reader can scroll to and highlight
		let pageRects = node?.anchor?.pageRects;
		let pageIndex = null;
		if (Array.isArray(pageRects) && pageRects.length
				&& Number.isInteger(pageRects[0][0])) {
			pageIndex = pageRects[0][0];
			let rects = pageRects
				.filter(rect => rect[0] === pageIndex && rect.length >= 5)
				.map(rect => rect.slice(1));
			if (rects.length) {
				location.position = { pageIndex, rects };
			}
		}
		// Without geometry (EPUB, snapshot), the catalog's per-page content
		// ranges still say which page a block falls on
		if (pageIndex === null) {
			pageIndex = blockPages[index];
		}
		if (pageIndex === null) {
			return location;
		}
		location.pageIndex = pageIndex;
		// An EPUB's synthetic locations aren't page numbers -- a label from
		// them would read as one
		if (catalog?.pageMappingType !== 'locations') {
			let label = catalog?.pages?.[pageIndex]?.label;
			if (!label && metadata?.processor?.type === 'pdf') {
				label = String(pageIndex + 1);
			}
			if (label) {
				location.pageLabel = label;
			}
		}
		return location;
	}

	// blockIndex -> pageIndex, from the catalog's per-page content ranges: the
	// last page starting at or before the block. Built in one pass up front,
	// since every block needs it.
	function _getBlockPages(catalog, blockCount) {
		let pages = Array.isArray(catalog?.pages) ? catalog.pages : [];
		let starts = [];
		for (let i = 0; i < pages.length; i++) {
			let start = pages[i]?.contentRange?.[0]?.[0];
			if (Number.isInteger(start) && start >= 0) {
				starts.push({ start, pageIndex: i });
			}
		}
		starts.sort((a, b) => a.start - b.start);
		let blockPages = new Array(blockCount).fill(null);
		let current = null;
		let next = 0;
		for (let i = 0; i < blockCount; i++) {
			while (next < starts.length && starts[next].start <= i) {
				current = starts[next].pageIndex;
				next++;
			}
			blockPages[i] = current;
		}
		return blockPages;
	}

	// Whether a block is a bibliography entry: flagged as one by the processor
	// (from entry structure and the in-text citation graph, so
	// language-independent), or made up entirely of blocks that are, as a
	// reference list is.
	function _isReferenceBlock(node) {
		if (node.reference) {
			return true;
		}
		let children = Array.isArray(node.content)
			? node.content.filter(child => child.text === undefined)
			: [];
		return children.length > 0 && children.every(_isReferenceBlock);
	}

	// Outline entries flattened to their top-level block indexes, each with
	// its full heading path
	function _flattenOutline(items, ancestors) {
		let result = [];
		if (!Array.isArray(items)) {
			return result;
		}
		for (let item of items) {
			if (!item || typeof item !== 'object' || typeof item.title !== 'string') {
				continue;
			}
			let blockIndex = Array.isArray(item.ref) && Number.isInteger(item.ref[0])
				? item.ref[0]
				: null;
			let path = [...ancestors, item.title];
			if (blockIndex !== null && blockIndex >= 0) {
				result.push({ blockIndex, path, isHeading: true });
			}
			result.push(..._flattenOutline(item.children, path));
		}
		return result;
	}

	// Page-start block indexes, for sectioning a document with no outline.
	// A page's contentRange starts with a content point whose first component
	// is the top-level block index.
	function _getPageBoundaries(catalog, blockCount) {
		let pages = Array.isArray(catalog?.pages) ? catalog.pages : [];
		let boundaries = [];
		let seen = new Set();
		for (let page of pages) {
			let start = page?.contentRange?.[0]?.[0];
			if (Number.isInteger(start) && start >= 0 && start < blockCount && !seen.has(start)) {
				seen.add(start);
				boundaries.push({ blockIndex: start, path: [] });
			}
		}
		return boundaries;
	}

	// Plain text of a block, recursing into nested blocks. A local copy of the
	// module's un-exported text helper (structured-document-text/src/text.js).
	function _getNestedBlockPlainText(node) {
		if (node.text !== undefined) {
			return node.text;
		}
		if (!node.content) {
			return '';
		}
		let hasChildBlock = node.content.some(child => child.text === undefined);
		if (!hasChildBlock) {
			let result = '';
			for (let child of node.content) {
				if (child.text !== undefined) {
					result += child.text;
				}
			}
			return result;
		}
		let parts = [];
		for (let child of node.content) {
			if (child.text !== undefined) {
				continue;
			}
			let text = _getNestedBlockPlainText(child);
			if (text) {
				parts.push(text);
			}
		}
		return parts.join('\n');
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
