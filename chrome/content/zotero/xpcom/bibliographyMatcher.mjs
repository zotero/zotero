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


/**
 * Match one visible bibliography record against library or transient items.
 *
 * The matcher deliberately has no citation-style grammar. It retrieves a bounded
 * candidate union, aligns each candidate's own metadata to the visible record,
 * rejects explicit contradictions, and returns only a confident, unique match.
 * Shared retrieval and metadata helpers also support stricter identity checks
 * before saving provider candidates.
 */
ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: 'chrome://zotero/content/zotero.mjs',
});

const ISBN_PATTERN = /(?<![\p{L}\p{N}_])(?:97[89](?:[\x2D\xAD\u2010-\u2015\u2043\u2212\s]*\d){10}|\d(?:[\x2D\xAD\u2010-\u2015\u2043\u2212\s]*\d){8}[\x2D\xAD\u2010-\u2015\u2043\u2212\s]*[\dX])(?![\p{L}\p{N}_])/giu;
const PAGE_LABEL_PATTERN = String.raw`\b(?:p{1,2}|pages?)\.?\s*`;
const PAGE_RANGE_PATTERN = String.raw`(\p{L}?)(\d+)\s*[-\u2010-\u2015\u2212]\s*(\p{L}?)(\d+)(?![\p{L}\p{N}])`;

export const BibliographyMatcher = new class {
	constructor() {
		this.MAX_CANDIDATE_JSON_LENGTH = 256 * 1024;
		this.MAX_MATCH_TEXT_LENGTH = 4000;
		this.MAX_REFERENCE_PARTS = 500;
		this.MAX_CANDIDATES = 100;
		this.CANDIDATE_BATCH_SIZE = 100;
		this.MAX_REFERENCE_TOKENS = 256;
		this.MAX_ALIGNMENT_FIELD_TOKENS = 64;
		this.MAX_ALIGNMENT_EXTRA_TOKENS = 8;
		this.MAX_IDENTIFIER_PROBES = 32;
		this.MAX_RETRIEVAL_ROWS = 20000;
		this.MAX_RETRIEVAL_DURATION_MS = 2000;
		this.MAX_EVALUATION_DURATION_MS = 2000;
		
		// A match needs strong title/author/year evidence; distinct works need a clear lead.
		this.MIN_STRICT_SCORE = 0.96;
		this.MIN_MATCH_MARGIN = 0.08;
	}
	
	/**
	 * Match against a populated library using a bounded union of general search
	 * routes. No result set is truncated into an apparent winner.
	 *
	 * @param {Object} [options]
	 * @param {AbortSignal} [options.signal] - Cooperative cancellation between
	 *     async stages and while consuming streamed rows, not a SQLite interrupt.
	 * @return {Promise<Object>}
	 */
	async matchLibrary(reference, libraryID, { signal } = {}) {
		this._throwIfAborted(signal);
		let parsed = this.prepareReference(reference);
		if (!parsed || !libraryID) return { status: 'unmatched', reason: 'invalid-input' };
		if (parsed.tokens.length > this.MAX_REFERENCE_TOKENS) {
			return { status: 'incomplete', reason: 'reference-token-limit' };
		}
		let identifiers = await this._searchByIdentifiers(parsed.identifiers, libraryID, signal);
		this._throwIfAborted(signal);
		if (identifiers.incomplete) return { status: 'incomplete', reason: 'retrieval-limit' };
		let evaluations = new Map();
		let identifierItems = identifiers.ids.length ? await this._loadLibraryCandidates(identifiers.ids, libraryID, signal) : [];
		for (let item of identifierItems) {
			evaluations.set(item.id, this._evaluate(item, parsed, false));
		}
		let exact = this._exactIdentifierResult([...evaluations.values()]);
		if (exact) return exact;
		
		let titles = await this._searchTitleCandidates(parsed, libraryID, { signal });
		if (titles.incomplete) return { status: 'incomplete', reason: 'retrieval-limit' };
		let ids = titles.ids.filter(id => !evaluations.has(id));
		let started = Date.now(), lastYield = started;
		for (let offset = 0; offset < ids.length; offset += this.CANDIDATE_BATCH_SIZE) {
			let items = await this._loadLibraryCandidates(ids.slice(offset, offset + this.CANDIDATE_BATCH_SIZE), libraryID, signal);
			for (let item of items) {
				this._throwIfAborted(signal);
				if (Date.now() - started >= this.MAX_EVALUATION_DURATION_MS) {
					return { status: 'incomplete', reason: 'evaluation-time-limit' };
				}
				evaluations.set(item.id, this._evaluate(item, parsed, false));
				if (Date.now() - lastYield >= 16) {
					await Zotero.Promise.delay(0);
					lastYield = Date.now();
				}
			}
		}
		this._throwIfAborted(signal);
		return this._rankEvaluations([...evaluations.values()], parsed);
	}
	
	/**
	 * Evaluate provider candidates with the same confidence requirements, retaining
	 * title-space repair and input order for equivalent publication records.
	 *
	 * @param {String|Array|Object} reference
	 * @param {Array<Zotero.Item|Object>} candidates
	 * @return {Object}
	 */
	matchCandidates(reference, candidates) {
		let parsed = this.prepareReference(reference);
		if (!parsed || !Array.isArray(candidates)) {
			return { status: 'unmatched', reason: 'invalid-input' };
		}
		if (parsed.tokens.length > this.MAX_REFERENCE_TOKENS) {
			return { status: 'incomplete', reason: 'reference-token-limit' };
		}
		if (candidates.length > this.MAX_CANDIDATES) {
			return { status: 'incomplete', reason: 'candidate-overflow' };
		}
		
		let items;
		try {
			items = candidates.map((candidate) => {
				if (candidate instanceof Zotero.Item) return candidate;
				let item = new Zotero.Item(candidate.itemType);
				item.fromJSON(candidate);
				return item;
			});
		}
		catch {
			// An unreadable competitor must not turn a partial pool into a winner.
			return { status: 'incomplete', reason: 'invalid-candidate' };
		}
		return this._rankEvaluations(items.map(item => this._evaluate(item, parsed)), parsed, { preferFirst: true });
	}
	
	/** Validate and join visible text without extracting matching evidence. */
	getReferenceText(reference) {
		let parts = typeof reference === 'string'
			? [{ text: reference }]
			: Array.isArray(reference) ? reference : reference?.referenceParts || reference?.textParts;
		if (!Array.isArray(parts) || !parts.length || parts.length > this.MAX_REFERENCE_PARTS
				|| parts.some(part => typeof part?.text !== 'string')) return null;
		let text = parts.map(part => part.text).join('');
		return text.trim() && text.length <= this.MAX_MATCH_TEXT_LENGTH ? text : null;
	}
	
	/** Parse only visible text, never hyperlink attributes, as matching evidence. */
	prepareReference(reference) {
		let text = this.getReferenceText(reference);
		if (text === null) return null;
		let normalizedText = Zotero.Utilities.Internal.normalizeForSearch(text);
		let identifiers = this.extractIdentifiers(text);
		let spans = [...normalizedText.matchAll(/[\p{L}\p{M}\p{N}]+/gu)];
		let tokens = spans.map(match => match[0]);
		let alignmentTerms = new Set(tokens);
		for (let i = 1; i < tokens.length; i++) alignmentTerms.add(tokens[i - 1] + tokens[i]);
		return {
			text, normalizedText, identifiers, tokens, alignmentTerms,
			titleProbes: [...new Set(tokens)].filter(token => [...token].length >= 4 && /\p{L}/u.test(token)),
			tokenSpans: spans.map(match => ({ start: match.index, end: match.index + match[0].length })),
			numericEvidenceText: this._maskIdentifierAndURLSpans(normalizedText, identifiers),
			etAlPositions: this._sequencePositions(tokens, ['et', 'al']),
		};
	}
	
	extractIdentifiers(text) {
		text = String(text || '');
		let identifiers = this._emptyIdentifiers();
		for (let value of this._extractISBNs(text)) identifiers.ISBN.add(value);
		for (let identifier of Zotero.Utilities.extractIdentifiers(text)) {
			if (identifier.DOI) {
				let value = Zotero.Utilities.cleanDOI(identifier.DOI);
				if (value) identifiers.DOI.add(value.toLowerCase());
			}
			if (identifier.ISBN) {
				let value = Zotero.Utilities.cleanISBN(identifier.ISBN);
				if (value) identifiers.ISBN.add(Zotero.Utilities.toISBN13(value));
			}
			if (identifier.arXiv) identifiers.arXiv.add(String(identifier.arXiv).toLowerCase());
			if (identifier.adsBibcode) identifiers.adsBibcode.add(String(identifier.adsBibcode));
		}
		// Keep explicitly named identifiers even when Utilities finds a DOI first.
		for (let [type, pattern] of [
			['arXiv', /\b(?:arxiv(?:\s*:\s*|\s+)|(?:https?:\/\/)?(?:www\.)?arxiv\.org\/(?:abs|pdf)\/)([^\s<>]+)/giu],
			['adsBibcode', /\b(?:ads\s*bibcode\s*:\s*|(?:https?:\/\/)?(?:ui\.)?adsabs\.harvard\.edu\/abs\/)([^\s<>]+)/giu],
		]) {
			for (let match of text.matchAll(pattern)) {
				for (let identifier of Zotero.Utilities.extractIdentifiers(match[1])) {
					let value = identifier[type];
					if (value) identifiers[type].add(type === 'arXiv' ? String(value).toLowerCase() : String(value));
				}
			}
		}
		// Utilities intentionally accepts bare PMID-like numbers and returns only the
		// first identifier type it finds. Extract labelled PMIDs independently so a
		// DOI cannot mask them and unrelated citation numbers can never become PMIDs.
		for (let match of text.matchAll(/\bPMID\s*:?\s*(\d{1,9})(?!\d)/giu)) {
			identifiers.PMID.add(match[1]);
		}
		identifiers.adsBibcode = new Set(new Map([...identifiers.adsBibcode]
			.map(value => [value.toLowerCase(), value])).values());
		return identifiers;
	}
	
	/**
	 * Extract supported identifiers from a Zotero item, transient item, plain
	 * translator object, or getField-compatible function. Parse first-class
	 * identifier fields separately so one identifier type cannot mask another.
	 */
	extractItemIdentifiers(source) {
		let getField = field => (typeof source === 'function'
			? source(field)
			: typeof source?.getField === 'function' ? source.getField(field, false, true) : source?.[field]);
		let texts = ['DOI', 'ISBN', 'PMID', 'extra', 'url'].flatMap((field) => {
			let value = getField(field);
			if (!value) return [];
			return ['extra', 'url'].includes(field) ? String(value).split(/\r?\n/u).filter(Boolean) : `${field}: ${value}`;
		});
		let identifiers = this._emptyIdentifiers();
		for (let text of texts) {
			for (let [type, values] of Object.entries(this.extractIdentifiers(text))) {
				for (let value of values) identifiers[type].add(value);
			}
		}
		return identifiers;
	}
	
	// Structured item identity is deliberately stricter than citation matching.
	// The caller supplies a canonical snapshot from createCandidateSnapshot().
	async checkForDuplicate(candidate, libraryID) {
		if (['DOI', 'ISBN', 'PMID', 'extra', 'url'].some(field => (
			(candidate[field]?.length || 0) > this.MAX_MATCH_TEXT_LENGTH
		))) return { status: 'unresolved', reason: 'incomplete' };
		let identifiers = this.extractItemIdentifiers(candidate);
		let route = await this._searchByIdentifiers(identifiers, libraryID);
		if (route.incomplete) return { status: 'unresolved', reason: 'incomplete' };
		let identifierMatches = (await this._loadLibraryCandidates(route.ids, libraryID)).map(item => ({
			item, evidence: this._identifierEvidence(identifiers, this.extractItemIdentifiers(item)),
		})).filter(result => result.evidence.match);
		if (identifierMatches.length) {
			return identifierMatches.length === 1 && !identifierMatches[0].evidence.conflict
				? { status: 'matched', item: identifierMatches[0].item }
				: { status: 'unresolved', reason: 'ambiguous' };
		}
		let rawTitle = this._candidateField(candidate, 'title');
		let titles = await this._searchByExactTitle(rawTitle, libraryID);
		if (titles.incomplete) return { status: 'unresolved', reason: 'incomplete' };
		// Container identifiers still retrieve records for structured inspection,
		// even when they do not establish record identity by themselves.
		let ids = [...new Set([...route.ids, ...titles.ids])];
		if (ids.length > this.MAX_CANDIDATES) return { status: 'unresolved', reason: 'incomplete' };
		let items = await this._loadLibraryCandidates(ids, libraryID);
		let identity = this._candidateField(candidate, 'date') && candidate.creators?.length && this._getIdentityKey(candidate);
		let title = this._normalizeMatchText(rawTitle);
		let matches = [];
		let unresolved = false;
		for (let item of items) {
			let evidence = this._identifierEvidence(identifiers, this.extractItemIdentifiers(item));
			if (evidence.conflict) {
				// A shared identifier plus a different identifier is unresolved identity.
				if (evidence.match) unresolved = true;
				continue;
			}
			if (evidence.match) {
				matches.push(item);
				continue;
			}
			// Local identity is not an incoming provider payload. In particular,
			// descriptive fields must not impose a transport-size limit on this check.
			let json = {
				itemType: item.itemType,
				...Object.fromEntries(item.getUsedFields(true).map(field => [field, item.getField(field)])),
				creators: item.getCreatorsJSON(),
			};
			if (identity && this._getIdentityKey(json) === identity) {
				matches.push(item);
			}
			else if (this._normalizeMatchText(this._candidateField(json, 'title')) === title
					&& !this._knownDifferentIdentity(json, candidate)) {
				unresolved = true;
			}
		}
		if (unresolved || matches.length > 1) return { status: 'unresolved', reason: 'ambiguous' };
		return matches.length ? { status: 'matched', item: matches[0] } : { status: 'absent' };
	}
	
	createCandidateSnapshot(input) {
		let item = input instanceof Zotero.Item ? input : null;
		if (item) {
			if (!item.isRegularItem()) throw new Error('Candidate is not a bibliographic item');
			input = item.toJSON();
		}
		if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid candidate');
		let size = 0;
		let copyFields = (source, fields) => {
			let output = {};
			size += 2;
			for (let field of new Set(fields)) {
				let value = source?.[field];
				if (typeof value === 'string' && value) {
					size += value.length;
					output[field] = value;
				}
				if (size > this.MAX_CANDIDATE_JSON_LENGTH) throw new Error('Candidate exceeds the candidate payload limit');
			}
			return output;
		};
		let output = copyFields(input, ['itemType', ...Zotero.ItemFields.getAll().map(field => field.name)]);
		if (!output.itemType || !this._candidateField(output, 'title')) throw new Error('Candidate is missing required bibliographic fields');
		if (Array.isArray(input.creators)) {
			output.creators = input.creators.map((creator) => {
				let safe = copyFields(creator, ['creatorType', 'firstName', 'lastName', 'name']);
				if (creator?.fieldMode === 1) safe.fieldMode = 1;
				return safe;
			}).filter(creator => creator.name || creator.lastName);
		}
		if (JSON.stringify(output).length > this.MAX_CANDIDATE_JSON_LENGTH) {
			throw new Error('Candidate exceeds the candidate payload limit');
		}
		if (item) return output;
		item = new Zotero.Item(output.itemType);
		item.fromJSON(output);
		return this.createCandidateSnapshot(item);
	}
	
	getCandidateKey(candidate) {
		// Without record identifiers, deduplicate only complete equivalent metadata.
		let fields = Object.keys(candidate).filter(key => key !== 'creators').sort()
			.map(key => [key, candidate[key]]);
		return JSON.stringify([fields, this._getIdentityKey({ creators: candidate.creators })]);
	}
	
	deduplicateCandidates(candidates) {
		let records = [];
		for (let candidate of candidates) {
			let json;
			try {
				json = typeof candidate?.toJSON === 'function' ? candidate.toJSON() : candidate;
			}
			catch {
				return candidates;
			}
			// Leave unreadable candidates in the pool so verification can reject it.
			if (!json || typeof json !== 'object') return candidates;
			let identifiers = this.extractItemIdentifiers(json);
			let key = this.getCandidateKey(json);
			if (records.some((record) => {
				let evidence = this._identifierEvidence(identifiers, record.identifiers);
				return !evidence.conflict && (evidence.match || key === record.key);
			})) continue;
			records.push({ candidate, key, identifiers });
		}
		return records.map(record => record.candidate);
	}
	
	_throwIfAborted(signal) {
		if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
	}
	
	async _loadLibraryCandidates(ids, libraryID, signal) {
		this._throwIfAborted(signal);
		let items = (await Zotero.Items.getAsync(ids)).filter(item => (
			item && item.libraryID === libraryID && item.isRegularItem() && !item.deleted
		));
		this._throwIfAborted(signal);
		await Zotero.Items.loadDataTypes(items, ['itemData', 'creators']);
		this._throwIfAborted(signal);
		return items;
	}
	
	_rankEvaluations(evaluations, reference, { preferFirst = false } = {}) {
		let exact = this._exactIdentifierResult(evaluations);
		if (exact) return exact;
		let all = evaluations.filter(candidate => !candidate.conflict).sort((a, b) => b.score - a.score);
		let candidates = all;
		// Ignore weak records whose full title repeats an independently supported
		// work's containing publication at the same citation position.
		let containers = new Set();
		if (all.some(candidate => candidate.titleKey)) {
			for (let leader of all) {
				if (!leader.strict) continue;
				let { title, container, containerKey } = leader.titleContext;
				if (!(container.start >= title.end)) continue;
				let key = JSON.stringify([container.start, container.end, containerKey]);
				if (!containers.has(key) && this._hasIndependentTitle(leader, reference)) containers.add(key);
			}
			if (containers.size) {
				candidates = all.filter(candidate => !containers.has(candidate.titleKey));
			}
		}
		let [first, second] = candidates;
		let competitive = first?.strict ? first.score - this.MIN_MATCH_MARGIN : this.MIN_STRICT_SCORE;
		// Excluded containers still count towards metadata completeness.
		if (all.some(candidate => candidate.incomplete && candidate.scoreUpperBound >= competitive)) {
			return { status: 'incomplete', reason: 'metadata-limit' };
		}
		let unique = !second || first.score - second.score >= this.MIN_MATCH_MARGIN;
		if (first?.strict && !unique && preferFirst) {
			// Provider records can describe the same work in different publications.
			// Use their input order, not their venue or DOI, to resolve that choice.
			let workKey = (candidate) => {
				let { title, creators, years, pageRanges } = this._prepareMatchMetadata(candidate.item);
				if (years.size !== 1 || pageRanges.size !== 1) return null;
				return JSON.stringify([
					title.tokens,
					creators.map(({ family, given }) => [family.tokens, given.tokens]),
					[...years],
					[...pageRanges],
				]);
			};
			let key = workKey(first);
			unique = key && candidates.slice(1).every(candidate => first.score - candidate.score >= this.MIN_MATCH_MARGIN
				|| (candidate.strict && workKey(candidate) === key));
		}
		if (first?.strict && unique) {
			// Reject a winning title fragment without promoting another candidate.
			if (!this._hasIndependentTitle(first, reference)) {
				return { status: 'unmatched', reason: 'insufficient-evidence' };
			}
			return { status: 'matched', item: first.item };
		}
		return { status: 'unmatched', reason: first && second && first.score - second.score < this.MIN_MATCH_MARGIN
			? 'ambiguous'
			: 'insufficient-evidence' };
	}
	
	_exactIdentifierResult(evaluations) {
		let exact = evaluations.filter(candidate => candidate.exact);
		if (!exact.length) return null;
		return exact.length === 1
			? { status: 'matched', item: exact[0].item }
			: { status: 'unmatched', reason: 'ambiguous-identifiers' };
	}
	
	_evaluate(item, reference, allowTitleSplits = true) {
		let metadata = this._prepareMatchMetadata(item);
		let identifier = this._identifierEvidence(reference.identifiers, metadata.identifiers);
		if (identifier.match) return { item, exact: !identifier.conflict, conflict: identifier.conflict, score: 1 };
		let title = this._alignmentEvidence(metadata.title, reference.tokens, allowTitleSplits);
		let container = this._alignmentEvidence(metadata.container, reference.tokens);
		let creator = this._creatorEvidence(metadata.creators, reference, [title, container]);
		if (creator.positions.size) {
			title = this._alignmentEvidence(metadata.title,
				reference.tokens.map((token, i) => (creator.positions.has(i) ? '' : token)), allowTitleSplits);
		}
		// Numbers within a matched title/container are not publication dates or pages.
		let numericText = reference.numericEvidenceText;
		for (let field of [title, container]) {
			if (field.similarity !== 1 || field.start === undefined) continue;
			let start = reference.tokenSpans[field.start].start;
			let end = reference.tokenSpans[field.end - 1].end;
			numericText = numericText.slice(0, start) + ' '.repeat(end - start) + numericText.slice(end);
		}
		let yearText = numericText.replace(new RegExp(PAGE_LABEL_PATTERN
			+ `(?:${PAGE_RANGE_PATTERN}|\\p{L}?\\d+(?![\\p{L}\\p{N}]))`, 'giu'), ' ');
		let year = this._overlapEvidence(this._extractYears(yearText), metadata.years);
		let pages = this._overlapEvidence(this._extractPageRanges(numericText, { requirePageLabel: true }), metadata.pageRanges);
		let titleLengthFactor = Math.min(1, metadata.title.alphanumericLength / 16);
		// Local title evidence must be reachable by the fast query. Titles needing
		// split-word repair or lacking a usable word anchor are left to Find Online.
		if (!allowTitleSplits) {
			let searchTitle = Zotero.Utilities.Internal.normalizeForSearch(String(item.getField('title', false, true) || ''));
			if (!reference.titleProbes.some(probe => searchTitle.includes(probe))) titleLengthFactor = 0;
		}
		let score = title.similarity * titleLengthFactor;
		let strict = score >= this.MIN_STRICT_SCORE && creator.supported && year.match;
		return {
			item, score,
			strict,
			titleKey: strict || score < this.MIN_STRICT_SCORE - this.MIN_MATCH_MARGIN || title.start === undefined
				? null
				: JSON.stringify([title.start, title.end, metadata.title.tokens.join(' ')]),
			titleContext: strict
				? { title, container, creator, creators: metadata.creators,
					titleTokens: metadata.title.tokens, containerKey: metadata.container.tokens.join(' ') }
				: null,
			conflict: identifier.conflict || creator.conflict || year.conflict || pages.conflict,
			incomplete: metadata.incomplete || metadata.incompleteCreators || title.incomplete || container.incomplete,
			scoreUpperBound: metadata.incomplete ? 1 : this._alignmentUpperBound(metadata.title.tokens, reference.alignmentTerms, allowTitleSplits) * titleLengthFactor,
		};
	}
	
	_hasIndependentTitle({ item, titleContext }, reference) {
		let { title, container, creator, creators, titleTokens } = titleContext;
		let creatorPositions = creator.positions;
		let covered = index => creatorPositions.has(index) || /^\p{N}+$/u.test(reference.tokens[index] || '')
			|| (container.similarity === 1 && index >= container.start && index < container.end);
		// Quotes/brackets and sentence separators delimit a field. A colon or
		// dash alone does not: it commonly continues the same title/subtitle.
		let separated = (left, right) => {
			let gap = reference.normalizedText.slice(reference.tokenSpans[left].end, reference.tokenSpans[right].start);
			if (/[\p{Ps}\p{Pe}\p{Pi}\p{Pf}".,;!?\n\r]/u.test(gap)) return true;
			if (!/\s\/|\/\s/u.test(gap)) return false;
			// A double slash separates a container. A single slash can also be
			// part of a title, so require the following text to identify a creator.
			return gap.includes('//') || creator.occurrences.some((starts, index) => {
				let position = starts.find(position => position >= right);
				if (position === undefined) return false;
				let given = creators[index].given.tokens;
				let visible = reference.tokens.slice(right, position);
				return !visible.length || (visible.length <= given.length && this._creatorGivenCompatible(given, visible));
			});
		};
		let before = index => index === 0 || covered(index - 1) || separated(index - 1, index);
		let after = index => index === reference.tokens.length || covered(index) || separated(index - 1, index);
		let { start, end } = title;
		if (start === undefined || end === undefined) return false;
		// An approximate alignment can omit a differing edge word. Account for
		// those item-title words, not arbitrary extra words around an exact fragment.
		if (!before(start)) start -= title.leadingMissing || 0;
		if (!after(end)) end += title.trailingMissing || 0;
		if (start < 0 || end > reference.tokens.length || !before(start) || !after(end)) return false;
		
		// Matching editors inside a chapter reference does not identify its book
		// as the cited work. Account for known metadata before those creators,
		// allowing only a short label rather than an unexplained preceding work.
		// A creator can occur first as a chapter author and again near the book
		// title. Use the occurrence nearest before this title, not the first one.
		let preceding = creator.occurrences.map(starts => starts.findLast(position => position < start))
			.filter(position => position !== undefined);
		let prefixEnd = Math.min(...(preceding.length ? preceding : creatorPositions));
		let prefix = reference.tokens.slice(0, prefixEnd).filter((token, i) => {
			if (creatorPositions.has(i)) return false;
			let span = reference.tokenSpans[i];
			return /\p{L}/u.test(token) && reference.numericEvidenceText.slice(span.start, span.end).trim();
		});
		if (prefix.length <= 2) return true;
		let known = new Set(titleTokens);
		if (prefix.filter(token => !known.has(token)).length <= 2) return true;
		for (let field of [
			'publicationTitle',
			'seriesTitle',
			'repository',
			'publisher',
			'place',
			'university',
			'proceedingsTitle',
			'conferenceName',
			'bookTitle',
			'edition',
		]) {
			let value = String(item.getField(field, false, true) || '');
			if (value.length > this.MAX_MATCH_TEXT_LENGTH) continue;
			for (let token of this._prepareField(value).tokens) known.add(token);
		}
		return prefix.filter(token => !known.has(token)).length <= 2;
	}
	
	_prepareMatchMetadata(item) {
		let incomplete = false;
		let getField = (field) => {
			let value = String(item.getField(field, false, true) || '');
			if (value.length <= this.MAX_MATCH_TEXT_LENGTH) return value;
			incomplete = true;
			return '';
		};
		let title = this._prepareField(getField('title'));
		let container = this._prepareField(['publicationTitle', 'seriesTitle', 'repository'].map(getField).find(Boolean) || '');
		let itemCreators = item.getCreators();
		// Use the same creator-role precedence as Zotero's firstCreator display.
		for (let type of [Zotero.CreatorTypes.getPrimaryIDForType(item.itemTypeID),
			...['editor', 'director', 'contributor'].map(role => Zotero.CreatorTypes.getID(role))]) {
			let primaryCreators = itemCreators.filter(creator => creator.creatorTypeID === type);
			if (primaryCreators.length) {
				itemCreators = primaryCreators;
				break;
			}
		}
		let creators = itemCreators.slice(0, 100).map(creator => ({
			family: this._prepareField(creator.lastName || creator.name || ''),
			given: this._prepareField(creator.firstName || ''),
		})).filter(creator => creator.family.tokens.length);
		let years = this._extractYears(getField('date') || getField('year'));
		let pageRanges = this._extractPageRanges(getField('pages'));
		let identifiers = this.extractItemIdentifiers(getField);
		return { incomplete, incompleteCreators: itemCreators.length > 100, title, container, creators, years, pageRanges, identifiers };
	}
	
	_identifierEvidence(referenceIdentifiers, itemIdentifiers) {
		let match = false, conflict = false;
		for (let type of Object.keys(referenceIdentifiers)) {
			let referenceValues = referenceIdentifiers[type];
			let itemValues = itemIdentifiers[type];
			if (!referenceValues.size || !itemValues.size) continue;
			let normalizedItems = new Set([...itemValues].map(value => value.toLowerCase()));
			let intersects = [...referenceValues].some(value => normalizedItems.has(value.toLowerCase()));
			if (intersects) {
				match ||= type !== 'ISBN';
			}
			else {
				conflict = true;
			}
		}
		// ISBN identifies an edition/container, not necessarily the cited record
		// (for example, its chapters share the same ISBN). Keep it for retrieval
		// and contradiction evidence, but never grant record-identity authority.
		return { match, conflict };
	}
	
	_overlapEvidence(referenceValues, itemValues) {
		let match = [...referenceValues].some(value => itemValues.has(value));
		return { match, conflict: !match && referenceValues.size === 1 && itemValues.size > 0 };
	}
	
	_alignmentEvidence(field, referenceTokens, allowTitleSplits = true) {
		if (!field.tokens.length) return { similarity: 0 };
		let target = field.tokens.slice(0, this.MAX_ALIGNMENT_FIELD_TOKENS);
		let incomplete = target.length < field.tokens.length;
		// Exact matches are token sequences, not arbitrary string substrings (for
		// example, a title "Net" must not match the word "Internet").
		let positions = this._sequencePositions(referenceTokens, field.tokens);
		if (positions.length) {
			return { similarity: 1, start: positions[0], end: positions[0] + field.tokens.length };
		}
		let alignment = this._boundedTokenAlignment(target, referenceTokens, allowTitleSplits);
		// Dice overlap combines full field coverage and local precision. Unlike
		// their arithmetic mean, a dense one-word fragment cannot start at 0.5.
		let similarity = 2 * alignment.matches
			/ (field.tokens.length + alignment.matches + (alignment.sourceGaps || 0));
		return { similarity, incomplete, start: alignment.start, end: alignment.end,
			leadingMissing: alignment.targetStart || 0,
			trailingMissing: field.tokens.length - (alignment.targetEnd || 0) };
	}
	
	_alignmentUpperBound(target, source, allowTitleSplits = true) {
		let matches = 0;
		for (let i = 0; i < target.length; i++) {
			if (source.has(target[i]) || (allowTitleSplits
					&& ((i > 0 && source.has(target[i - 1] + target[i]))
						|| (i + 1 < target.length && source.has(target[i] + target[i + 1]))))) matches++;
		}
		return target.length ? 2 * matches / (target.length + matches) : 0;
	}
	
	_boundedTokenAlignment(target, source, allowTitleSplits = true) {
		let index = new Map();
		for (let i = 0; i < target.length; i++) {
			// Only complete provider pools can credit splitting one reference word.
			for (let units of (allowTitleSplits ? [2, 1] : [1])) {
				if (i + units > target.length) continue;
				let token = target.slice(i, i + units).join('');
				if (!index.has(token)) index.set(token, []);
				index.get(token).push({ position: i, units });
			}
		}
		let maxSpan = Math.min(this.MAX_REFERENCE_TOKENS, target.length + this.MAX_ALIGNMENT_EXTRA_TOKENS);
		let best = { matches: 0, sourceGaps: 0, targetGaps: 0 };
		for (let start = 0; start < source.length; start++) {
			let targetIndex = 0, targetStart = 0, matches = 0, sourceGaps = 0, previousSource = start - 1;
			for (let i = start; i < Math.min(source.length, start + maxSpan); i++) {
				let minimum = targetIndex;
				let found = index.get(source[i])?.find(entry => entry.position >= minimum);
				let sourceUnits = 1;
				// A joined source pair may match one target token, not two target tokens.
				let pair = i + 1 < source.length
					? index.get(source[i] + source[i + 1])?.find(entry => entry.units === 1 && entry.position >= minimum)
					: null;
				if (pair && (!found || pair.position < found.position)) {
					found = pair;
					sourceUnits = 2;
				}
				if (!found) {
					if (!matches) break;
					continue;
				}
				sourceGaps += i - previousSource - 1;
				if (!matches) targetStart = found.position;
				matches += found.units;
				targetIndex = found.position + found.units;
				previousSource = i + sourceUnits - 1;
				i = previousSource;
				let targetGaps = targetIndex - matches;
				if (matches > best.matches || (matches === best.matches
						&& sourceGaps + targetGaps < best.sourceGaps + best.targetGaps)) {
					best = { matches, sourceGaps, targetGaps, start, end: previousSource + 1,
						targetStart, targetEnd: targetIndex };
				}
				if (targetIndex >= target.length) break;
			}
		}
		return best;
	}
	
	_creatorEvidence(creators, reference, fields) {
		let fieldPositions = new Set();
		for (let field of fields) {
			if (field.similarity === 1) {
				for (let i = field.start; i < field.end; i++) fieldPositions.add(i);
			}
		}
		let occurrences = creators.map(creator => this._sequencePositions(reference.tokens, creator.family.tokens));
		let blocked = new Set(fieldPositions);
		for (let [index, starts] of occurrences.entries()) {
			for (let start of starts) {
				for (let i = start; i < start + creators[index].family.tokens.length; i++) blocked.add(i);
			}
		}
		let matched = 0, cursor = 0, prefixLength = 0, prefixEnd = -1;
		let conflict = false, missingGiven = false;
		let positions = new Set();
		for (let [index, creator] of creators.entries()) {
			let minimum = cursor;
			let start = occurrences[index].find(position => position >= minimum && !fieldPositions.has(position));
			if (start === undefined) continue;
			let end = start + creator.family.tokens.length;
			for (let i = start; i < end; i++) positions.add(i);
			cursor = end;
			matched++;
			if (index === prefixLength) {
				prefixLength++;
				prefixEnd = end;
			}
			let given = creator.given.tokens;
			if (!given.length) continue;
			let visible = this._creatorGivenSpan(reference, { start, end }, blocked, Math.max(3, given.length));
			for (let position of visible.positions) {
				positions.add(position);
				blocked.add(position);
			}
			if (!visible.tokens.length) {
				missingGiven = true;
			}
			else if (!this._creatorGivenCompatible(given, visible.tokens)) {
				conflict = true;
			}
		}
		let etAl = prefixEnd >= 0 && reference.etAlPositions.some(position => position >= prefixEnd && position <= prefixEnd + 3);
		return { positions, occurrences, conflict,
			supported: matched > 0 && !conflict && (etAl || (matched === creators.length && !missingGiven)) };
	}
	
	_creatorGivenSpan(reference, family, blocked, maxLength) {
		let collect = (direction) => {
			let result = [];
			let positions = [];
			let previous = direction < 0 ? family.start : family.end - 1;
			for (let i = previous + direction; i >= 0 && i < reference.tokens.length; i += direction) {
				let token = reference.tokens[i];
				if (blocked.has(i) || /\p{N}/u.test(token) || ['et', 'al', 'and'].includes(token)) break;
				let left = Math.min(i, previous);
				let right = Math.max(i, previous);
				let separator = reference.normalizedText.slice(
					reference.tokenSpans[left].end, reference.tokenSpans[right].start
				);
				if (/[;:&]/u.test(separator)
						|| (separator.includes('.') && reference.tokens[left].length > 1)
						|| (separator.includes(',') && (direction < 0 || result.length))) break;
				result.push(token);
				positions.push(i);
				previous = i;
				if (result.length === maxLength) break;
			}
			return { tokens: direction < 0 ? result.reverse() : result, positions };
		};
		let before = collect(-1);
		return before.tokens.length ? before : collect(1);
	}
	
	_creatorGivenCompatible(givenTokens, nearby) {
		let initials = givenTokens.map(token => token[0]).join('');
		if (!initials) return false;
		if (nearby.length === 1 && initials.startsWith(nearby[0])) return true;
		return nearby.slice(0, givenTokens.length).every((token, index) => (
			givenTokens[index] === token
			|| (token.length === 1 && givenTokens[index]?.startsWith(token))
			|| (givenTokens[index]?.length === 1 && token.startsWith(givenTokens[index]))
		));
	}
	
	_sequencePositions(source, target) {
		if (!target.length || target.length > source.length) return [];
		let positions = [];
		outer: for (let i = 0; i <= source.length - target.length; i++) {
			for (let j = 0; j < target.length; j++) {
				if (source[i + j] !== target[j]) continue outer;
			}
			positions.push(i);
		}
		return positions;
	}
	
	_extractISBNs(text) {
		let forms = new Set();
		let bounded = String(text || '').slice(0, this.MAX_MATCH_TEXT_LENGTH);
		// Match only bounded ISBN-shaped spans using the same separators that
		// cleanISBN() accepts, and leave checksum validation to that utility.
		for (let match of bounded.matchAll(ISBN_PATTERN)) {
			let value = Zotero.Utilities.cleanISBN(match[0]);
			if (!value) continue;
			forms.add(Zotero.Utilities.toISBN13(value));
		}
		return forms;
	}
	
	_emptyIdentifiers() {
		return { DOI: new Set(), ISBN: new Set(), PMID: new Set(), arXiv: new Set(), adsBibcode: new Set() };
	}
	
	_extractYears(text) {
		return new Set([...String(text || '').normalize('NFKC').matchAll(
			/(?<!\p{N})(1[5-9]\d{2}|20\d{2}|2100)(?!\p{N})/gu
		)].map(match => match[1]));
	}
	
	_extractPageRanges(text, { requirePageLabel = false } = {}) {
		// Reference text requires a page label; a stored pages field does not.
		let prefix = requirePageLabel ? PAGE_LABEL_PATTERN : String.raw`(?<![\p{L}\p{N}])`;
		let pattern = new RegExp(prefix + PAGE_RANGE_PATTERN, 'giu');
		let ranges = new Set();
		for (let [, firstPrefix, first, lastPrefix, last] of String(text || '').normalize('NFKC').matchAll(pattern)) {
			firstPrefix = firstPrefix.toLowerCase();
			lastPrefix = (lastPrefix || firstPrefix).toLowerCase();
			if (firstPrefix !== lastPrefix) continue;
			last = first.slice(0, Math.max(0, first.length - last.length)) + last;
			if (Number(first) <= Number(last)) ranges.add(`${firstPrefix}${first}-${lastPrefix}${last}`);
		}
		return ranges;
	}
	
	_prepareField(value) {
		let raw = String(value || '').replace(/<\/?(?:i|b|em|strong|sub|sup|span)(?:\s+[^<>]*)?\s*>/gi, '');
		let normalized = this._normalizeMatchText(raw);
		return {
			raw,
			tokens: normalized.match(/[\p{L}\p{M}\p{N}]+/gu) || [],
			alphanumericLength: [...normalized].filter(char => /[\p{L}\p{N}]/u.test(char)).length,
		};
	}
	
	_normalizeMatchText(value) {
		return Zotero.Utilities.Internal.normalizeForSearch(String(value || ''))
			.replace(/[\p{P}\p{S}\p{Z}\s]+/gu, ' ')
			.trim();
	}
	
	_maskIdentifierAndURLSpans(value, identifiers = this.extractIdentifiers(value)) {
		let text = Zotero.Utilities.Internal.normalizeForSearch(String(value || ''))
			.replace(/\b(?:https?|ftp):\/\/[^\s<>]+/giu, match => ' '.repeat(match.length));
		// Mask exactly the identifiers accepted by the parser, including bare and
		// legacy arXiv forms. Preserve character positions for candidate alignment.
		for (let type of ['DOI', 'arXiv', 'adsBibcode']) {
			for (let identifier of identifiers[type]) {
				identifier = Zotero.Utilities.Internal.normalizeForSearch(identifier);
				text = text.replaceAll(identifier, ' '.repeat(identifier.length));
			}
		}
		return text
			.replace(/\bPMID\s*:?\s*(\d{1,9})(?!\d)/giu,
				(match, number) => (identifiers.PMID.has(number) ? ' '.repeat(match.length) : match))
			.replace(ISBN_PATTERN,
				match => (Zotero.Utilities.cleanISBN(match) ? ' '.repeat(match.length) : match));
	}
	
	_regularItemConditions(alias) {
		return ['itemNotes', 'itemAttachments', 'itemAnnotations', 'deletedItems']
			.map(table => `NOT EXISTS (SELECT 1 FROM ${table} WHERE ${table}.itemID=${alias}.itemID)`)
			.join(' AND ');
	}
	
	async _searchByIdentifiers(identifiers, libraryID, signal) {
		this._throwIfAborted(signal);
		if (Object.values(identifiers).reduce((sum, values) => sum + values.size, 0) > this.MAX_IDENTIFIER_PROBES) {
			return { ids: [], incomplete: true };
		}
		let comparisonIdentifiers = Object.fromEntries(Object.entries(identifiers)
			.map(([type, values]) => [type, new Set([...values].map(value => value.toLowerCase()))]));
		let clauses = [], params = [libraryID];
		let fieldNames = new Map();
		let textProbes = [...identifiers.DOI, ...identifiers.PMID, ...identifiers.arXiv, ...identifiers.adsBibcode];
		for (let [field, values] of [
			['DOI', identifiers.DOI],
			['PMID', identifiers.PMID],
			['extra', textProbes],
			['url', textProbes],
			['ISBN', identifiers.ISBN.size ? textProbes : []],
		]) {
			let fields = [Zotero.ItemFields.getID(field),
				...(field === 'ISBN' ? [] : Zotero.ItemFields.getTypeFieldsFromBase(field) || [])];
			let conditions = [];
			for (let value of values) {
				let normalized = Zotero.Utilities.Internal.normalizeForSearch(value);
				conditions.push('instr(COALESCE(V.valueNormalized, lower(V.value)), ?) > 0');
				params.push(normalized);
			}
			// cleanDOI() can decode URLs, but the resulting DOI must start with 10.
			// Include every raw/encoded form of that prefix, not unrelated escaped URLs.
			if (identifiers.DOI.size && field !== 'PMID' && (field !== 'ISBN' || identifiers.ISBN.size)) {
				conditions.push("(instr(V.value, '%') > 0 AND (V.value GLOB '*10[./%]*' "
					+ "OR V.value GLOB '*1%30*' OR V.value GLOB '*%31*' OR instr(V.value, char(0)) > 0))");
			}
			if (field === 'ISBN' && identifiers.ISBN.size) {
				// ISBN-10 and ISBN-13 share these nine digits. Strip common separators;
				// leave other separators to the parser, which verifies the complete ISBN.
				for (let value of identifiers.ISBN) {
					conditions.push("instr(replace(replace(V.value, '-', ''), ' ', ''), ?) > 0");
					params.push(value.slice(3, 12));
				}
				// GLOB stops at NUL, while the identifier parser does not.
				conditions.push("(V.value GLOB '*[^ -~]*' OR instr(V.value, char(0)) > 0)");
			}
			if (conditions.length) {
				for (let id of fields) fieldNames.set(id, field);
				clauses.push(`(D.fieldID IN (${fields.join(',')}) AND (${conditions.join(' OR ')}))`);
			}
		}
		if (!clauses.length) return { ids: [], incomplete: false };
		let ids = new Set();
		// SQL retrieves a superset; the matcher's parser verifies identifier equality
		// before applying the candidate limit, including mixed-content ISBN fields.
		// CROSS JOIN keeps value filtering ahead of item and deletion checks.
		await Zotero.DB.queryAsync(
			'SELECT D.itemID AS itemID, D.fieldID AS fieldID, V.value AS value '
				+ 'FROM itemData D INDEXED BY itemData_fieldID '
				+ 'CROSS JOIN itemDataValues V ON V.valueID=D.valueID CROSS JOIN items I ON I.itemID=D.itemID '
				+ 'WHERE I.libraryID=? AND (' + clauses.join(' OR ') + ') AND ' + this._regularItemConditions('I'),
			params,
			{
				noCache: true,
				onRow: (row, cancel) => {
					if (signal?.aborted) {
						cancel();
						return;
					}
					let field = fieldNames.get(row.getResultByName('fieldID'));
					let stored = this.extractItemIdentifiers({ [field]: row.getResultByName('value') });
					if (!Object.entries(stored).some(([type, values]) => [...values]
						.some(value => comparisonIdentifiers[type].has(value.toLowerCase())))) return;
					ids.add(row.getResultByName('itemID'));
					if (ids.size > this.MAX_CANDIDATES) cancel();
				},
			}
		);
		this._throwIfAborted(signal);
		return { ids: [...ids], incomplete: ids.size > this.MAX_CANDIDATES };
	}
	
	async _searchByExactTitle(title, libraryID) {
		let fields = [Zotero.ItemFields.getID('title'), ...Zotero.ItemFields.getTypeFieldsFromBase('title')];
		let tokens = this._normalizeMatchText(title).split(' ').filter(Boolean);
		if (!tokens.length) return { ids: [], incomplete: false };
		let value = '%' + tokens.map(token => Zotero.DB.escapeSQLExpression(token)).join('%') + '%';
		// Retrieve a superset of normalized title equality, including punctuation
		// and spacing variants. Keep an overflow witness before structured inspection.
		let ids = await Zotero.DB.columnQueryAsync(
			'SELECT I.itemID FROM items I WHERE I.libraryID=? AND ' + this._regularItemConditions('I')
				+ ' AND I.itemID IN (SELECT D.itemID FROM itemData D JOIN itemDataValues V ON V.valueID=D.valueID '
				+ `WHERE D.fieldID IN (${fields.join(',')}) AND COALESCE(V.valueNormalized, V.value) LIKE ? ESCAPE '\\') LIMIT ?`,
			[libraryID, value, this.MAX_CANDIDATES + 1], { noCache: true }
		);
		return { ids, incomplete: ids.length > this.MAX_CANDIDATES };
	}
	
	async _searchTitleCandidates(reference, libraryID, { signal } = {}) {
		this._throwIfAborted(signal);
		let probes = reference.titleProbes;
		if (!probes.length) return { ids: [], incomplete: false };
		let fields = [Zotero.ItemFields.getID('title'), ...Zotero.ItemFields.getTypeFieldsFromBase('title')];
		// Search title values once for all probes. Project every mapped title,
		// including aliases that did not themselves contain a probe.
		let sql = 'SELECT itemID FROM items WHERE libraryID=? AND itemID IN ('
			+ 'SELECT D.itemID FROM itemData D JOIN itemDataValues V ON V.valueID=D.valueID '
			+ `WHERE D.fieldID IN (${fields.join(',')}) AND (`
			+ probes.map(() => "COALESCE(V.valueNormalized, V.value) LIKE ? ESCAPE '\\'").join(' OR ') + '))';
		let params = [libraryID, ...probes.map((probe) => {
			let value = Zotero.DB.escapeSQLExpression(probe);
			return '%' + value + '%';
		})];
		let ids = new Set();
		let incomplete = false, rows = 0, started = Date.now();
		let expired = () => rows > this.MAX_RETRIEVAL_ROWS
			|| Date.now() - started > this.MAX_RETRIEVAL_DURATION_MS;
		await Zotero.DB.queryAsync(
			`SELECT R.itemID AS itemID, V.value AS value FROM (${sql}) R `
				+ `LEFT JOIN itemData D ON D.itemID=R.itemID AND D.fieldID IN (${fields.join(',')}) `
				+ 'LEFT JOIN itemDataValues V ON V.valueID=D.valueID '
				+ 'WHERE ' + this._regularItemConditions('R'),
			params,
			{
				noCache: true,
				onRow: (row, cancel) => {
					if (signal?.aborted) {
						cancel();
						return;
					}
					rows++;
					let field = this._prepareField(row.getResultByName('value'));
					// An optimistic bound is only a retrieval filter, never a match score.
					if (this._alignmentUpperBound(field.tokens, reference.alignmentTerms, false) * Math.min(1, field.alphanumericLength / 16)
							>= this.MIN_STRICT_SCORE - this.MIN_MATCH_MARGIN) ids.add(row.getResultByName('itemID'));
					if (expired()) {
						incomplete = true;
						cancel();
					}
				},
			}
		);
		this._throwIfAborted(signal);
		return { ids: [...ids], incomplete: incomplete || expired() };
	}
	
	_candidateField(candidate, baseField) {
		let fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(candidate.itemType, baseField);
		return (fieldID && candidate[Zotero.ItemFields.getName(fieldID)]) || candidate[baseField] || '';
	}
	
	_normalizeIdentityText(value) {
		return String(value || '').normalize('NFKC').toLowerCase()
			.replace(/\s+/gu, ' ')
			.trim();
	}
	
	_getIdentityKey(candidate) {
		// Bibliographic identity excludes descriptive/cataloguing additions. Every
		// creator, role, and remaining schema field participates without truncation.
		let excluded = new Set([
			'abstractNote',
			'extra',
			'language',
			'rights',
			'shortTitle',
			'url',
			'accessDate',
			'libraryCatalog',
			'callNumber',
			'DOI',
			'ISBN',
			'PMID',
			'ISSN',
		]);
		let fields = Object.keys(candidate).filter(key => key !== 'creators' && !excluded.has(key))
			.sort()
			.map(key => [key, this._normalizeIdentityText(candidate[key])])
			.filter(([, value]) => value);
		let creators = (candidate.creators || []).map(creator => [
			this._normalizeIdentityText(creator.creatorType || 'author'),
			creator.name || creator.fieldMode === 1 ? 'single' : 'person',
			this._normalizeIdentityText(creator.name || creator.lastName),
			this._normalizeIdentityText(creator.firstName),
		]);
		return JSON.stringify([fields, creators]);
	}
	
	_knownDifferentIdentity(a, b) {
		let normalize = value => Zotero.Utilities.Internal.normalizeForSearch(String(value || '')).trim();
		if (a.itemType !== b.itemType) return true;
		for (let field of ['edition', 'volume', 'issue', 'pages']) {
			let left = this._candidateField(a, field), right = this._candidateField(b, field);
			if (left && right && normalize(left) !== normalize(right)) return true;
		}
		let yearsA = this._extractYears(this._candidateField(a, 'date'));
		let yearsB = this._extractYears(this._candidateField(b, 'date'));
		if (yearsA.size && yearsB.size && ![...yearsA].some(year => yearsB.has(year))) return true;
		// Full structured names can prove distinct works with a shared title.
		// Initials, partial creator lists and missing names remain unresolved.
		let complete = creators => creators?.length && creators.every(creator => (
			creator.name || creator.fieldMode === 1
			|| (creator.lastName && /^[\p{L}]{2,}(?:[\s-][\p{L}]{2,})*$/u.test(creator.firstName || '')
				&& !/^[\p{Lu}]{2,3}$/u.test(creator.firstName))
		));
		if (!complete(a.creators) || !complete(b.creators)
				|| a.creators.length !== b.creators.length) return false;
		return a.creators.some(left => !b.creators.some((right) => {
			if (normalize(left.creatorType || 'author') !== normalize(right.creatorType || 'author')
					|| normalize(left.name || left.lastName) !== normalize(right.name || right.lastName)) return false;
			let givenA = normalize(left.firstName).split(/[\s-]+/u);
			let givenB = normalize(right.firstName).split(/[\s-]+/u);
			return givenA.slice(0, Math.min(givenA.length, givenB.length))
				.every((token, index) => token === givenB[index]);
		}));
	}
};
