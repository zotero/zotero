/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
	                 Vienna, Virginia, USA
	                 https://zotero.org

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: 'chrome://zotero/content/zotero.mjs',
	setTimeout: 'resource://gre/modules/Timer.sys.mjs',
	clearTimeout: 'resource://gre/modules/Timer.sys.mjs',
});

import { BibliographyMatcher } from './bibliographyMatcher.mjs';

const CROSSREF_TRANSLATOR_ID = '0a61e167-de9a-4f93-a68a-628b48855909';
const MAX_IDENTIFIER_LOOKUPS = 3;
const MAX_TRANSLATORS_PER_IDENTIFIER = 3;
const MAX_TRANSLATOR_SELECTIONS = 5;
const MAX_PROVIDER_CANDIDATES = 20;

/** Bibliographic reference lookup. Library lookup never starts network work. */
export const onlineReferenceLookup = new class {
	constructor() {
		this.ONLINE_LOOKUP_TIMEOUT_MS = 20000;
		this.PROVIDER_TIMEOUT_MS = 7000;
		this.ABSTRACT_TIMEOUT_MS = 2000;
		this._providerFlights = new Map();
	}
	
	/** Return a single verified item, or an unsuccessful lookup status. */
	async findOnline(reference, { signal = new AbortController().signal } = {}) {
		let parsed = BibliographyMatcher.prepareReference(reference);
		if (signal.aborted) throw new Zotero.HTTP.CancelledException();
		if (!parsed) return { status: 'invalid' };
		let searches = this._identifierSearches(parsed);
		if (searches.length > MAX_IDENTIFIER_LOOKUPS) return { status: 'incomplete' };
		let deadline = Date.now() + this.ONLINE_LOOKUP_TIMEOUT_MS;
		let failures = [], items = [];
		for (let identifier of searches) {
			try {
				let found = await this._runProvider(() => this._translateIdentifier(identifier),
					signal, this._getProviderTimeout(deadline));
				if (signal.aborted) throw new Zotero.HTTP.CancelledException();
				// Check raw pools before deduplication, which could hide an overflow witness.
				if (found.length > MAX_PROVIDER_CANDIDATES) return { status: 'incomplete' };
				items = BibliographyMatcher.deduplicateCandidates([...items, ...found]);
			}
			catch (e) {
				if (signal.aborted) throw e;
				// A failed identifier route can hide a competing work.
				if (searches.length > 1 || e?.name === 'IncompleteCandidatePoolError') return { status: 'incomplete' };
				failures.push(this.errorStatus(e));
			}
		}
		if (items.length) {
			let match = BibliographyMatcher.matchCandidates(reference, items);
			if (match.status === 'matched' || match.reason === 'ambiguous-identifiers') {
				return this._addPublisherAbstract(match, signal, deadline);
			}
		}
		try {
			let found = await this._runProvider(() => this._translateSearch({
				search: { itemType: 'document', query: parsed.text.replace(/\s+/g, ' ').trim() },
				translator: CROSSREF_TRANSLATOR_ID,
			}), signal, this._getProviderTimeout(deadline));
			if (signal.aborted) throw new Zotero.HTTP.CancelledException();
			if (found.length > MAX_PROVIDER_CANDIDATES) return { status: 'incomplete' };
			items = BibliographyMatcher.deduplicateCandidates([...items, ...found]);
		}
		catch (e) {
			if (signal.aborted) throw e;
			if (e?.name === 'IncompleteCandidatePoolError') return { status: 'incomplete' };
			failures.push(this.errorStatus(e));
			// Keep incomplete candidate verification distinct from a failed fallback.
			if (!items.length) return { status: this._bestFailure(failures) };
		}
		let match = BibliographyMatcher.matchCandidates(reference, items);
		return match.status === 'unmatched' && match.reason !== 'ambiguous-identifiers' && failures.length
			? { status: this._bestFailure(failures) }
			: this._addPublisherAbstract(match, signal, deadline);
	}

	async _addPublisherAbstract(match, signal, deadline) {
		let item = match.item;
		if (match.status !== 'matched' || item.id || item.getField('abstractNote')?.trim()) return match;
		deadline = Math.min(deadline, Date.now() + this.ABSTRACT_TIMEOUT_MS);
		let timeout = deadline - Date.now();
		if (timeout <= 0) return match;
		try {
			// Website URL suffixes are not additional declared DOIs.
			let dois = BibliographyMatcher.extractItemIdentifiers({
				DOI: item.getField('DOI'), extra: item.getField('extra'),
			}).DOI;
			if (dois.size !== 1) return match;
			let [doi] = dois;
			let results = await this._runProvider(() => this._translateLandingPage(doi), signal, timeout);
			if (signal.aborted) throw new Zotero.HTTP.CancelledException();
			if (Date.now() >= deadline || results.length !== 1) return match;
			let { DOI, extra, abstractNote: abstract } = results[0];
			let resultDOIs = BibliographyMatcher.extractItemIdentifiers({ DOI, extra }).DOI;
			if (resultDOIs.size !== 1 || !resultDOIs.has(doi)
					|| typeof abstract !== 'string' || !abstract.trim()) return match;
			// Optional enrichment must not make the verified result too large to cache or save.
			BibliographyMatcher.createCandidateSnapshot({ ...item.toJSON(), abstractNote: abstract });
			item.setField('abstractNote', abstract);
		}
		catch (e) {
			if (signal.aborted) throw e;
		}
		return match;
	}

	_translateLandingPage(doi) {
		return this._shareProvider(JSON.stringify(['landing-page', doi]), async () => {
			let xhr = await Zotero.HTTP.request('GET', `https://doi.org/${encodeURIComponent(doi)}`, {
				responseType: 'document', timeout: this.ABSTRACT_TIMEOUT_MS, errorDelayMax: 0,
			});
			if (!xhr.response || !['text/html', 'application/xhtml+xml'].includes(xhr.response.contentType)) return [];
			let translate = new Zotero.Translate.Web();
			translate.setDocument(Zotero.HTTP.wrapDocument(xhr.response, xhr.responseURL));
			let translators = await translate.getTranslators();
			if (!translators.length) return [];
			translate.setTranslator(translators[0]);
			translate.setHandler('select', (obj, items, callback) => callback(false));
			return translate.translate({ libraryID: false, saveAttachments: false });
		});
	}
	
	errorStatus(error) {
		if (error instanceof Zotero.HTTP.CancelledException || error?.name === 'AbortError') return 'cancelled';
		if (error instanceof Zotero.HTTP.TimeoutException) return 'timeout';
		if (error instanceof Zotero.HTTP.BrowserOfflineException) return 'offline';
		if (error?.status === 429) return 'rate-limited';
		if (error?.status === 408 || error?.name === 'TimeoutError') return 'timeout';
		return 'error';
	}
	
	_identifierSearches(parsed) {
		// Additional labelled identifiers are conflict evidence, not new provider
		// routes. Retain Utilities' primary-type routing for arXiv and ADS.
		let primary = Zotero.Utilities.extractIdentifiers(parsed.text);
		return Object.entries(parsed.identifiers).flatMap(([type, values]) => (
			[...values].filter(value => !['arXiv', 'adsBibcode'].includes(type)
				|| primary.some(identifier => identifier[type]?.toLowerCase() === value.toLowerCase()))
				.map(value => ({ [type]: value }))
		));
	}
	
	_shareProvider(key, run) {
		// Standard translators cannot be cancelled. Reuse identical outstanding
		// work even if an earlier caller has stopped waiting for it.
		if (!this._providerFlights.has(key)) {
			let pending = Promise.resolve().then(run)
				.finally(() => this._providerFlights.delete(key));
			this._providerFlights.set(key, pending);
		}
		return this._providerFlights.get(key);
	}
	
	_translateIdentifier(identifier) {
		return this._shareProvider(JSON.stringify(['identifier', identifier]), async () => {
			let translate = new Zotero.Translate.Search();
			translate.setIdentifier(identifier);
			let translators = await translate.getTranslators();
			if (!translators.length) return [];
			translate.setTranslator(translators.slice(0, MAX_TRANSLATORS_PER_IDENTIFIER));
			return this._runTranslation(translate);
		});
	}
	
	_translateSearch({ search, translator }) {
		return this._shareProvider(JSON.stringify(['search', translator, search]), () => {
			let translate = new Zotero.Translate.Search();
			translate.setSearch(search);
			translate.setTranslator(translator);
			return this._runTranslation(translate);
		});
	}
	
	async _runTranslation(translate) {
		let incompleteError;
		translate.setHandler('select', (obj, items, callback) => {
			let keys = Object.keys(items);
			if (keys.length > MAX_TRANSLATOR_SELECTIONS) {
				// Never certify a subset of translator choices as a complete pool.
				incompleteError = new Error('Translator selection exceeds the candidate limit');
				incompleteError.name = 'IncompleteCandidatePoolError';
				callback(false);
				return;
			}
			callback(items);
		});
		let items = await translate.translate({ libraryID: false, saveAttachments: false }).catch((e) => {
			// Search uses ERROR_NO_RESULTS for both empty and failed searches.
			// Neither establishes a successfully searched empty pool.
			throw incompleteError || e;
		});
		if (incompleteError) throw incompleteError;
		// Keep one overflow witness instead of certifying a silently truncated pool.
		return Array.isArray(items) ? items.slice(0, MAX_PROVIDER_CANDIDATES + 1) : [];
	}
	
	async _runProvider(run, signal, timeout) {
		if (signal.aborted) throw new Zotero.HTTP.CancelledException();
		let promise = Promise.resolve().then(() => {
			if (signal.aborted) throw new Zotero.HTTP.CancelledException();
			return run();
		});
		let timeoutID, onAbort;
		try {
			// Stop this caller's wait, not the translator's shared network work.
			return await Promise.race([promise, new Promise((resolve, reject) => {
				onAbort = () => reject(new Zotero.HTTP.CancelledException());
				signal.addEventListener('abort', onAbort, { once: true });
				timeoutID = setTimeout(() => reject(new Zotero.HTTP.TimeoutException(timeout)), timeout);
			})]);
		}
		finally {
			clearTimeout(timeoutID);
			signal.removeEventListener('abort', onAbort);
		}
	}
	
	_getProviderTimeout(deadline) {
		let remaining = deadline - Date.now();
		if (remaining <= 0) throw new Zotero.HTTP.TimeoutException(remaining);
		return Math.min(this.PROVIDER_TIMEOUT_MS, remaining);
	}
	
	_bestFailure(statuses) {
		for (let status of ['offline', 'rate-limited', 'timeout', 'error', 'cancelled']) {
			if (statuses.includes(status)) return status;
		}
		return 'error';
	}
};


// Shared across Reader sessions so simultaneous Adds cannot create duplicates.
export const referenceSaver = new class {
	constructor() {
		this._metadataSaveTails = new Map();
		this._attachmentFlights = new Map();
	}
	
	async saveCandidate(metadata, { libraryID } = {}) {
		let library = Zotero.Libraries.get(libraryID);
		if (!library?.editable) {
			throw new Error('Target library is not editable');
		}
		let candidate = BibliographyMatcher.createCandidateSnapshot(metadata);
		let previous = this._metadataSaveTails.get(libraryID) || Promise.resolve();
		let metadataSave = previous.catch(() => {}).then(async () => {
			// Serialize only identity verification and metadata persistence per library.
			// File acquisition runs after releasing this queue.
			let duplicate = await BibliographyMatcher.checkForDuplicate(candidate, libraryID);
			if (duplicate.status === 'matched') return { item: duplicate.item, existing: true };
			if (duplicate.status !== 'absent') {
				let error = new Error('Duplicate identity could not be resolved');
				error.name = 'DuplicateCheckUnresolvedError';
				throw error;
			}
			if (!Zotero.Libraries.get(libraryID)?.editable) {
				throw new Error('Target library is not editable');
			}
			let itemSaver = new Zotero.Translate.ItemSaver({
				libraryID,
				attachmentMode: Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE,
				saveOptions: { skipSelect: true },
			});
			let items = await itemSaver.saveItems([candidate]);
			let item = items?.[0];
			if (!item || item.libraryID !== libraryID || !item.isRegularItem() || item.deleted) {
				throw new Error('ItemSaver returned an invalid bibliographic item');
			}
			return { item, existing: false };
		});
		this._track(this._metadataSaveTails, libraryID, metadataSave);
		let saved = await metadataSave;
		// Metadata is ready now; optional PDF acquisition completes independently.
		let fileAcquisitionPromise = this._attachmentFlights.get(saved.item.id);
		if (!saved.existing && !fileAcquisitionPromise) {
			fileAcquisitionPromise = this._acquireAssociatedFile(saved.item, libraryID);
			this._track(this._attachmentFlights, saved.item.id, fileAcquisitionPromise);
		}
		return { ...saved, fileAcquisitionPromise };
	}
	
	getFileAcquisitionPromise(itemID) {
		return this._attachmentFlights.get(itemID);
	}
	
	_track(map, key, promise) {
		map.set(key, promise);
		let release = () => {
			if (map.get(key) === promise) map.delete(key);
		};
		promise.then(release, release);
	}
	
	async _acquireAssociatedFile(item, libraryID) {
		try {
			if (!item.deleted && item.libraryID === libraryID
					&& Zotero.Libraries.get(libraryID)?.filesEditable
					&& Zotero.Prefs.get('downloadAssociatedFiles')
					&& Zotero.Attachments.canFindFileForItem(item)) {
				let resolvers = Zotero.Attachments.getFileResolvers(item, ['oa', 'custom'], true);
				await Zotero.Attachments.addFileFromURLs(item, resolvers);
			}
		}
		catch (e) {
			// A missing PDF (including shutdown during acquisition) never rolls
			// back a committed item or leaves an unhandled background rejection.
			Zotero.logError(e);
		}
	}
};

function formatDisplayText(value, maxLength) {
	// Bound plain display text without deleting bibliographic content that
	// resembles URLs or markup. Operational URLs remain validated and host-owned.
	return String(value ?? '')
		.slice(0, maxLength)
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.replace(/\s+/gu, ' ')
		.trim();
}

/** One document session owns references, action tokens, and successful online metadata. */
export class ReaderReferenceSession {
	static MAX_REFERENCES = 128;
	
	static MAX_SOURCE_KEY_LENGTH = 512;
	
	static MAX_REQUEST_FIELD_LENGTH = 128;
	
	static MAX_DISPLAY_FIELD_LENGTH = 2000;
	
	static MAX_ABSTRACT_LENGTH = 20000;
	
	constructor(attachment, reader) {
		if (!attachment?.id || !attachment.isAttachment()) throw new Error('Expected a Reader attachment');
		this._reader = reader;
		this._attachmentID = attachment.id;
		this._libraryID = attachment.libraryID;
		this._references = new Map();
		this._operations = new Map();
		this._onlineMatchCache = new Map();
		this._disposed = false;
	}
	
	get readerOptions() {
		return {
			onMatchReference: (request, callback) => this._handleRequest('matchReference', request, callback),
			onFindReferenceOnline: (request, callback) => this._handleRequest('findOnline', request, callback),
			onCancelReferenceLookup: request => this.cancel(request),
			onPerformReferenceAction: (request, callback) => this._handleRequest('performAction', request, callback),
		};
	}
	
	async _handleRequest(method, request, callback) {
		let reader = this._reader;
		if (this._disposed || !reader || typeof callback !== 'function') return;
		let response;
		try {
			response = await this[method](JSON.parse(JSON.stringify(request)));
		}
		catch (e) {
			Zotero.logError(e);
			response = this._response(request, { status: method === 'performAction' ? 'failed' : 'error' });
		}
		if (this._disposed || reader._isUninitialized || !reader._iframeWindow) return;
		try {
			callback(Components.utils.cloneInto(response, reader._iframeWindow));
			// Deliver saved metadata before reporting a completed background download.
			let result = response.result;
			if (result?.libraryState === 'existing') {
				let update = await this.waitForAttachmentUpdate(response.referenceKey, result.resultID);
				if (update && !this._disposed && !reader._isUninitialized && reader._iframeWindow) {
					reader._internalReader.updateReferenceResult(Components.utils.cloneInto(update, reader._iframeWindow));
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	matchReference(request) {
		let text = Array.isArray(request?.referenceParts) && BibliographyMatcher.getReferenceText(request.referenceParts);
		if (this._disposed || this._operations.has(request?.requestID)
				|| !this._validRequest(request, ['sourceKey']) || !text) return this._response(request, { status: 'invalid' });
		return this._lookup(request, this._replaceReference(request.sourceKey, text), false);
	}
	
	findOnline(request) {
		if (!this._validRequest(request, ['referenceKey'])) return this._response(request, { status: 'invalid' });
		if (!this._references.has(request.referenceKey)) return this._response(request, { status: 'expired' });
		return this._lookup(request, request.referenceKey, true);
	}
	
	async _lookup(request, referenceKey, online) {
		let reference = this._references.get(referenceKey);
		let controller = new AbortController();
		let operation = { controller, referenceKey };
		let restored = this._onlineMatchCache.has(reference.text);
		let respond = data => this._response(request, { referenceKey,
			...(!online && restored ? { lookupSource: 'online' } : {}), ...data });
		if (this._disposed || this._operations.has(request.requestID)) return respond({ status: 'invalid' });
		for (let pending of this._operations.values()) {
			if (pending.referenceKey === referenceKey) pending.controller.abort();
		}
		this._operations.set(request.requestID, operation);
		try {
			let item, candidateJSON;
			let existing = !online && !restored;
			if (restored) {
				candidateJSON = JSON.parse(this._onlineMatchCache.get(reference.text));
			}
			else {
				if (online && Zotero.HTTP.browserIsOffline()) return respond({ status: 'offline' });
				let match = await (online
					? onlineReferenceLookup.findOnline(reference.text, { signal: controller.signal })
					: BibliographyMatcher.matchLibrary(reference.text, this._libraryID, { signal: controller.signal }));
				if (!this._isCurrent(operation)) return respond({ status: 'cancelled' });
				if (match.status !== 'matched') return respond({ status: this._lookupStatus(match) });
				item = match.item;
			}
			if (!existing) {
				candidateJSON ||= BibliographyMatcher.createCandidateSnapshot(item);
				let duplicate = await BibliographyMatcher.checkForDuplicate(candidateJSON, this._libraryID);
				existing = duplicate.status === 'matched';
				if (existing) {
					item = duplicate.item;
				}
				else if (restored) {
					item = new Zotero.Item(candidateJSON.itemType);
					item.fromJSON(candidateJSON);
				}
			}
			if (!this._isCurrent(operation)) return respond({ status: 'cancelled' });
			let binding = { resultID: this._createOpaqueID(), referenceKey };
			let result;
			if (existing) {
				if (!this._isValidItem(item)) throw new Error('Item is outside the session library');
				binding.itemID = item.id;
				binding.fileAcquisitionPromise = referenceSaver.getFileAcquisitionPromise(item.id);
				result = await this._createLibraryResult(binding.resultID, item);
			}
			else {
				binding.candidateJSON = candidateJSON;
				binding.viewURL = this._viewURL(item);
				let actions = [];
				if (Zotero.Libraries.get(this._libraryID)?.editable) actions.push('add-to-library');
				if (binding.viewURL) actions.push('view-online');
				result = { resultID: binding.resultID, libraryState: 'unsaved',
					actions, display: this._getDisplayMetadata(item) };
			}
			if (!this._isCurrent(operation)) return respond({ status: 'cancelled' });
			if (existing && !this._isValidItem(item)) return respond({ status: 'expired' });
			binding.actions = result.actions;
			reference.result = binding;
			if (online && !restored) {
				// Snapshot validation already bounds the complete serialized metadata.
				this._onlineMatchCache.set(reference.text, JSON.stringify(candidateJSON));
				if (this._onlineMatchCache.size > ReaderReferenceSession.MAX_REFERENCES) {
					this._onlineMatchCache.delete(this._onlineMatchCache.keys().next().value);
				}
			}
			return respond({ status: 'strong', result });
		}
		catch (e) {
			let cancelled = !this._isCurrent(operation) || e?.name === 'AbortError';
			if (!cancelled) Zotero.logError(online ? new Error('Reference provider request failed') : e);
			return respond({ status: cancelled ? 'cancelled' : online ? onlineReferenceLookup.errorStatus(e) : 'error' });
		}
		finally {
			this._operations.delete(request.requestID);
		}
	}
	
	async performAction(request) {
		let respond = (status, result) => this._response(request, { status, result });
		if (!this._validRequest(request, ['referenceKey', 'resultID', 'action'])) return respond('failed');
		let { referenceKey, resultID, action } = request;
		let reference = this._references.get(referenceKey);
		let binding = reference?.result;
		if (binding?.resultID !== resultID) return respond('stale');
		if (!binding || this._disposed) return respond('stale');
		if (!binding.actions.includes(action) || reference.saving) return respond('failed');
		if (action === 'add-to-library') reference.saving = request.requestID;
		try {
			let item = binding.itemID ? await Zotero.Items.getAsync(binding.itemID) : null;
			if (!this._isBoundResult(binding) || (binding.itemID && !this._isValidItem(item))) return respond('stale');
			if (action === 'add-to-library') {
				let source = await Zotero.Items.getAsync(this._attachmentID);
				if (!this._isBoundResult(binding) || !source?.isAttachment() || source.deleted
						|| source.libraryID !== this._libraryID) return respond('stale');
				if (item || !Zotero.Libraries.get(this._libraryID)?.editable) return respond('failed');
				// A delegated save belongs to the library, not the lifetime of the popup.
				let saved = await referenceSaver.saveCandidate(binding.candidateJSON, { libraryID: this._libraryID });
				binding.itemID = saved.item.id;
				binding.fileAcquisitionPromise = saved.fileAcquisitionPromise;
				delete binding.candidateJSON;
				delete binding.viewURL;
				let result = await this._createLibraryResult(resultID, saved.item);
				binding.actions = result.actions;
				return respond(saved.existing ? 'existing' : 'saved', result);
			}
			let win = Zotero.getMainWindow();
			if (!win) throw new Error('No Zotero window is available');
			if (action === 'view-online') {
				let url = item ? this._viewURL(item) : this._validHTTPURL(binding.viewURL);
				if (!url) return respond(item ? 'failed' : 'stale');
				win.ZoteroPane.loadURI(url);
			}
			else if (action === 'show-in-library' && item) {
				await win.ZoteroPane.selectItem(item.id);
			}
			else if (action === 'open-attachment' && item) {
				let attachment = await item.getBestAttachment();
				if (!this._isBoundResult(binding) || !this._isValidItem(item)) return respond('stale');
				if (!attachment || attachment.deleted || attachment.libraryID !== this._libraryID
						|| attachment.parentID !== item.id) return respond('stale');
				await win.ZoteroPane.viewAttachment(attachment.id);
			}
			else {
				return respond('failed');
			}
			return respond(this._isBoundResult(binding) ? 'ok' : 'stale');
		}
		catch (e) {
			Zotero.logError(e);
			return respond(e?.name === 'DuplicateCheckUnresolvedError' ? 'duplicate-conflict' : 'failed');
		}
		finally {
			if (action === 'add-to-library') delete reference.saving;
		}
	}
	
	async waitForAttachmentUpdate(referenceKey, resultID) {
		let binding = this._references.get(referenceKey)?.result;
		if (binding?.resultID !== resultID || !binding.fileAcquisitionPromise) return null;
		let completion = binding.fileAcquisitionPromise;
		delete binding.fileAcquisitionPromise;
		await completion;
		if (!this._isBoundResult(binding)) return null;
		let item = binding.itemID && await Zotero.Items.getAsync(binding.itemID);
		if (!this._isBoundResult(binding) || !this._isValidItem(item)) return null;
		let result = await this._createLibraryResult(resultID, item);
		if (!this._isBoundResult(binding) || !this._isValidItem(item)) return null;
		let changed = result.actions.join() !== binding.actions.join();
		binding.actions = result.actions;
		return changed ? { referenceKey, result } : null;
	}
	
	cancel(request) {
		this._operations.get(request?.requestID)?.controller.abort();
	}
	
	dispose() {
		this._disposed = true;
		this._reader = null;
		for (let pending of this._operations.values()) pending.controller.abort();
		this._operations.clear();
		this._references.clear();
		this._onlineMatchCache.clear();
	}
	
	_validRequest(request, fields) {
		return ['requestID', ...fields].every(field => typeof request?.[field] === 'string'
			&& request[field].length > 0 && request[field].length <= (field === 'sourceKey'
			? ReaderReferenceSession.MAX_SOURCE_KEY_LENGTH
			: ReaderReferenceSession.MAX_REQUEST_FIELD_LENGTH));
	}
	
	_isCurrent(operation) {
		return !this._disposed && !operation.controller.signal.aborted && this._references.has(operation.referenceKey);
	}
	
	_replaceReference(sourceKey, text) {
		for (let [key, reference] of this._references) {
			if (reference.sourceKey === sourceKey) this._removeReference(key);
		}
		let referenceKey = this._createOpaqueID();
		this._references.set(referenceKey, { sourceKey, text });
		if (this._references.size > ReaderReferenceSession.MAX_REFERENCES) {
			this._removeReference(this._references.keys().next().value);
		}
		return referenceKey;
	}
	
	_removeReference(referenceKey) {
		this._references.delete(referenceKey);
		for (let pending of this._operations.values()) {
			if (pending.referenceKey === referenceKey) pending.controller.abort();
		}
	}
	
	_isBoundResult(binding) {
		return !this._disposed && this._references.get(binding.referenceKey)?.result === binding;
	}
	
	async _createLibraryResult(resultID, item) {
		let actions = ['show-in-library'];
		if (await item.getBestAttachment()) actions.unshift('open-attachment');
		if (this._viewURL(item)) actions.push('view-online');
		return { resultID, libraryState: 'existing', actions, display: this._getDisplayMetadata(item) };
	}
	
	_getDisplayMetadata(item) {
		let getField = (field, maxLength = ReaderReferenceSession.MAX_DISPLAY_FIELD_LENGTH) => {
			let value = item.getField(field, false, true);
			let clipped = field === 'abstractNote' && String(value ?? '').length > maxLength;
			return formatDisplayText(value, clipped ? maxLength - 1 : maxLength) + (clipped ? '…' : '');
		};
		let display = {
			itemType: Zotero.ItemTypes.getName(item.itemTypeID) || 'document',
			title: Zotero.Utilities.Internal.renderItemTitle(getField('title')),
			firstCreator: getField('firstCreator'),
			year: getField('year'),
		};
		let abstract = getField('abstractNote', ReaderReferenceSession.MAX_ABSTRACT_LENGTH);
		if (abstract) display.abstract = abstract;
		return display;
	}
	
	_isValidItem(item) {
		return !!item && item.libraryID === this._libraryID && item.isRegularItem() && !item.deleted;
	}
	
	_viewURL(item) {
		let url = this._validHTTPURL(item.getField('url'));
		if (url) return url;
		let doi = Zotero.Utilities.cleanDOI(item.getField('DOI'));
		return doi ? `https://doi.org/${encodeURIComponent(doi)}` : null;
	}
	
	_validHTTPURL(value) {
		try {
			let url = new URL(value);
			return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
				? url.href
				: null;
		}
		catch {
			return null;
		}
	}
	
	_response(request, { referenceKey, status, result, lookupSource }) {
		let echo = field => (typeof request?.[field] === 'string' ? request[field].slice(0, ReaderReferenceSession.MAX_REQUEST_FIELD_LENGTH) : '');
		let response = { requestID: echo('requestID'), referenceKey: referenceKey || echo('referenceKey'), status };
		if (result) response.result = result;
		if (lookupSource === 'online') response.lookupSource = lookupSource;
		return response;
	}
	
	_lookupStatus(match) {
		switch (match?.status) {
			case 'invalid':
			case 'incomplete':
			case 'offline':
			case 'rate-limited':
			case 'timeout':
			case 'cancelled':
			case 'error': return match.status;
			case 'unmatched': return match.reason === 'invalid-input' ? 'invalid' : 'no-match';
			default: return 'error';
		}
	}
	
	_createOpaqueID() {
		return Services.uuid.generateUUID().toString().replace(/[{}]/g, '');
	}
}
