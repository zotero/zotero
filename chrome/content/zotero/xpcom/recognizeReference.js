/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2025 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
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

// TODO: Consider moving approximateMatch into utilities
/**
 * Approximate string matching in text
 *
 * @param {String} text A text to search for the pattern
 * @param {String} pattern An approximate string to search for
 * @param {Number} maxErrors Maximum errors (Levenshtein distance)
 * @return {Array} An array of matches containing 'start', 'end' and 'errors' parameters
 */
function approximateMatch(text, pattern, maxErrors) {
	/**
	 * https://github.com/robertknight/approx-string-match-js
	 *
	 * Implementation of Myers' online approximate string matching algorithm [1].
	 *
	 * This has O((k/w) * n) complexity where `n` is the length of the text, `k` is
	 * the maximum number of errors allowed (always <= the pattern length) and `w`
	 * is the word size. Because JS only supports bitwise operations on 32 bit
	 * integers, `w` is 32.
	 *
	 * As far as I am aware, there aren't any online algorithms which are
	 * significantly better for a wide range of input parameters. The problem can be
	 * solved faster using "filter then verify" approaches which first filter out
	 * regions of the text that cannot match using a "cheap" check and then verify
	 * the remaining potential matches. The verify step requires an algorithm such
	 * as this one however.
	 *
	 * The algorithm's approach is essentially to optimize the classic dynamic
	 * programming solution to the problem by computing columns of the matrix in
	 * word-sized chunks (ie. dealing with 32 chars of the pattern at a time) and
	 * avoiding calculating regions of the matrix where the minimum error count is
	 * guaranteed to exceed the input threshold.
	 *
	 * The paper consists of two parts, the first describes the core algorithm for
	 * matching patterns <= the size of a word (implemented by `advanceBlock` here).
	 * The second uses the core algorithm as part of a larger block-based algorithm
	 * to handle longer patterns.
	 *
	 * [1] G. Myers, “A Fast Bit-Vector Algorithm for Approximate String Matching
	 * Based on Dynamic Programming,” vol. 46, no. 3, pp. 395–415, 1999.
	 */

	function reverse(s) {
		return s.split('').reverse().join('');
	}

	function fill(ary, x) {
		for (var i = 0; i < ary.length; i += 1) {
			ary[i] = x;
		}
		return ary;
	}

	/**
	 * Given the ends of approximate matches for `pattern` in `text`, find
	 * the start of the matches.
	 *
	 * @param findEndFn - Function for finding the end of matches in
	 * text.
	 * @return Matches with the `start` property set.
	 */
	function findMatchStarts(text, pattern, matches, findEndFn) {
		var minCost = Math.min.apply(Math, matches.map(function (m) {
			return m.errors;
		}));
		return matches.filter(function (m) {
			return m.errors === minCost;
		}).map(function (m) {
			// Find start of each match by reversing the pattern and matching segment
			// of text and searching for an approx match with the same number of
			// errors.
			var minStart = Math.max(0, m.end - pattern.length - m.errors);
			var textRev = reverse(text.slice(minStart, m.end));
			var patRev = reverse(pattern);
			// If there are multiple possible start points, choose the one that
			// maximizes the length of the match.
			var start = findEndFn(textRev, patRev, m.errors).reduce(function (min, rm) {
				if (m.end - rm.end < min) {
					return m.end - rm.end;
				}
				return min;
			}, m.end);
			return {
				start: start,
				end: m.end,
				errors: m.errors
			};
		});
	}

	/**
	 * Block calculation step of the algorithm.
	 *
	 * From Fig 8. on p. 408 of [1].
	 *
	 * @param b - The block level
	 * @param t - Character from the text, represented as
	 *        a value in the `ctx.peq` alphabet.
	 * @param hIn - Horizontal input delta ∈ {1,0,-1}
	 * @return Horizontal output delta
	 */
	function advanceBlock(ctx, b, t, hIn) {
		var pV = ctx.P[b];
		var mV = ctx.M[b];
		var eq = ctx.peq[t][b];
		var hOut = 0;
		// Step 1: Compute horizontal deltas.
		var xV = eq | mV;
		if (hIn < 0) {
			eq |= 1;
		}
		var xH = (((eq & pV) + pV) ^ pV) | eq;
		var pH = mV | ~(xH | pV);
		var mH = pV & xH;
		// Step 2: Update score (value of last row of this block).
		if (pH & ctx.lastRowMask[b]) {
			hOut += 1;
		}
		else if (mH & ctx.lastRowMask[b]) {
			hOut -= 1;
		}
		// Step 3: Update vertical deltas for use when processing next char.
		pH <<= 1;
		mH <<= 1;
		if (hIn < 0) {
			mH |= 1;
		}
		else if (hIn > 0) {
			pH |= 1;
		}
		pV = mH | ~(xV | pH);
		mV = pH & xV;
		ctx.P[b] = pV;
		ctx.M[b] = mV;
		return hOut;
	}

	/**
	 * Find the ends and error counts for matches of `pattern` in `text`.
	 *
	 * This is the block-based search algorithm from Fig. 9 on p.410 of [1].
	 */
	function findMatchEnds(text, pattern, maxErrors) {
		if (pattern.length === 0) {
			return [];
		}
		// Clamp error count so we can rely on the `maxErrors` and `pattern.length`
		// rows being in the same block below.
		maxErrors = Math.min(maxErrors, pattern.length);
		var matches = [];
		// Word size.
		var w = 32;
		// Index of maximum block level.
		var bMax = Math.ceil(pattern.length / w) - 1;
		// Context used across block calculations.
		var ctx = {
			bMax: bMax,
			P: fill(Array(bMax + 1), 0),
			M: fill(Array(bMax + 1), 0),
			peq: [],
			lastRowMask: fill(Array(bMax + 1), 1 << 31)
		};
		ctx.lastRowMask[bMax] = 1 << ((pattern.length - 1) % w);
		// Calculate `ctx.peq` - the locations of chars within the pattern.
		for (var c = 0; c < text.length; c += 1) {
			var val = text.charCodeAt(c);
			if (ctx.peq[val]) {
				// Duplicate char in text.
				continue;
			}
			// `ctx.peq[val]` is a bit-array where each int represents a 32-char slice
			// of the pattern.
			ctx.peq[val] = Array(bMax + 1);
			for (var b = 0; b <= bMax; b += 1) {
				ctx.peq[val][b] = 0;
				// Set all the bits where the pattern matches the current char (ch).
				// For indexes beyond the end of the pattern, always set the bit as if the
				// pattern contained a wildcard char in that position.
				for (var r = 0; r < w; r += 1) {
					var idx = (b * w) + r;
					if (idx >= pattern.length) {
						continue;
					}
					var match = pattern.charCodeAt(idx) === val;
					if (match) {
						ctx.peq[val][b] |= (1 << r);
					}
				}
			}
		}
		// Index of last-active block level in the column.
		var y = Math.max(0, Math.ceil(maxErrors / w) - 1);
		// Initialize maximum error count at bottom of each block.
		var score = [];
		for (var b = 0; b <= y; b += 1) {
			score[b] = (b + 1) * w;
		}
		score[bMax] = pattern.length;
		// Initialize vertical deltas for each block.
		for (var b = 0; b <= y; b += 1) {
			ctx.P[b] = ~0;
			ctx.M[b] = 0;
		}
		// Process each char of the text, computing the error count for `w` chars of
		// the pattern at a time.
		for (var j = 0; j < text.length; j += 1) {
			var ch = text.charCodeAt(j);
			// Calculate error count for blocks that we definitely have to process for
			// this column.
			var carry = 0;
			for (var b = 0; b <= y; b += 1) {
				carry = advanceBlock(ctx, b, ch, carry);
				score[b] += carry;
			}
			// Check if we also need to compute an additional block, or if we can reduce
			// the number of blocks processed for the next column.
			if ((score[y] - carry) <= maxErrors
				&& (y < ctx.bMax)
				&& ((ctx.peq[ch][y + 1] & 1)
					|| (carry < 0))) {
				// Error count for bottom block is under threshold, increase the number of
				// blocks processed for this column & next by 1.
				y += 1;
				ctx.P[y] = ~0;
				ctx.M[y] = 0;
				var maxBlockScore = y === bMax ? ((pattern.length % w) || w) : w;
				score[y] = score[y - 1] + maxBlockScore - carry + advanceBlock(ctx, y, ch, carry);
			}
			else {
				// Error count for bottom block exceeds threshold, reduce the number of
				// blocks processed for the next column.
				while (y > 0 && score[y] >= maxErrors + w) {
					y -= 1;
				}
			}
			// If error count is under threshold, report a match.
			if (y === ctx.bMax && score[y] <= maxErrors) {
				matches.push({
					end: j + 1,
					errors: score[y],
					start: -1
				});
			}
		}
		return matches;
	}

	var matches = findMatchEnds(text, pattern, maxErrors);
	return findMatchStarts(text, pattern, matches, findMatchEnds);
}

function isbn10to13(isbn10) {
	let chars = isbn10.split('');
	chars.unshift('9', '7', '8');
	chars.pop();
	let i = 0;
	let sum = 0;
	for (i = 0; i < 12; i += 1) {
		sum += chars[i] * ((i % 2) ? 3 : 1);
	}
	let checkDigit = (10 - (sum % 10)) % 10;
	chars.push(checkDigit);
	return chars.join('');
}

function isbn13to10(isbn13) {
	// Remove hyphens and validate
	let raw = isbn13.replace(/[^0-9X]/gi, '');
	if (!raw.startsWith('978') || raw.length !== 13) {
		return null;
	}
	let core = raw.slice(3, 12); // 9 digits after '978'
	// Calculate check digit
	let sum = 0;
	for (let i = 0; i < 9; i++) {
		sum += (10 - i) * parseInt(core[i]);
	}
	let checksum = (11 - (sum % 11)) % 11;
	let checkDigit = checksum === 10 ? 'X' : checksum.toString();

	return core + checkDigit;
}

function normalize(text) {
	return text.replace(/\s+/g, '').toLowerCase();
}

async function itemMatchesReference(item, reference) {
	let urls = Array.from(new Set(reference.map(x => x.attributes?.url).filter(x => x)));
	let text = reference.map(item => item.text).join('');
	text = urls.join(' ') + ' ' + text;
	let normalizedText = normalize(text);

	let matchedIdentifierLength = 0;
	let identifiers = [];

	// Collect all identifiers from the item
	let doi = item.getField('DOI');
	if (doi) {
		identifiers.push({ DOI: doi });
	}
	// Use both types of ISBNs when possible
	let isbn = item.getField('ISBN');
	if (isbn) {
		isbn = Zotero.Utilities.cleanISBN(isbn);
		if (isbn) {
			identifiers.push({ ISBN: isbn });
			if (isbn.length === 10) {
				let isbn13 = isbn10to13(isbn);
				identifiers.push({ ISBN: isbn13 });
			}
			else if (isbn.length === 13) {
				let isbn10 = isbn13to10(isbn);
				if (isbn10) {
					identifiers.push({ ISBN: isbn10 });
				}
			}
		}
	}
	// Extract identifiers from URL
	let url = item.getField('url');
	if (url) {
		identifiers.push(...Zotero.Utilities.extractIdentifiers(url));
	}
	// Extract identifiers from extra field
	let lines = item.getField('extra').split('\n');
	for (let line in lines) {
		identifiers.push(...Zotero.Utilities.extractIdentifiers(line));
	}
	// Match an identifier in the normalized text. Length threshold is 4
	for (let identifier of identifiers) {
		for (let key in identifier) {
			let value = identifier[key];
			if (normalizedText.includes(value) && value.length >= 4) {
				matchedIdentifierLength = value.length;
			}
		}
	}

	// Match URL. Length threshold is 15
	let matchedURLLength = 0;
	url = item.getField('url');
	if (url) {
		let normalizedURL = normalize(url);
		if (normalizedURL.length >= 15) {
			let matches = approximateMatch(normalizedText, normalizedURL, 2);
			if (matches.length) {
				matchedURLLength += url.length;
			}
		}
	}

	// Match title. Length threshold is 10
	let title = item.getField('title');
	let matchedTitleLength = 0;
	let normalizedTitle = normalize(title);
	if (normalizedTitle.length >= 10) {
		let matches = approximateMatch(normalizedText, normalizedTitle, Math.floor(normalizedTitle.length / 10));
		if (matches.length) {
			matchedTitleLength = normalizedTitle.length;
		}
	}

	// Split text into alphabetic words and match with creators. Length threshold is 2
	let names = new Set();
	let creators = item.getCreators();
	for (let creator of creators) {
		if (creator.firstName.length >= 2) {
			names.add(creator.firstName.toLowerCase());
		}
		if (creator.lastName.length >= 2) {
			names.add(creator.lastName.toLowerCase());
		}
	}
	let words = text.split(/[^\p{L}]+/u).map(word => word.toLowerCase());
	let matchedNamesLength = 0;
	for (let word of words) {
		if (names.has(word)) {
			matchedNamesLength += word.length;
		}
	}

	// Match page or page range if there are at least 4 digits involved
	let matchedPagesLength = 0;
	let integers = text.match(/\d+/g) || [];
	let pages = item.getField('pages');
	if (pages) {
		let interval = pages.match(/\d+/g) || [];
		if (interval.length === 1 && interval[0].length >= 4 && integers.includes(interval[0])) {
			matchedPagesLength = interval[0].length;
		}
		else if (interval.length === 2 && interval.join('').length >= 4) {
			let [start, end] = interval;
			for (let i = 0; i < integers.length - 1; i++) {
				if (integers[i] === start && integers[i + 1] === end) {
					matchedPagesLength = interval[0].length + integers[1].length;
					break;
				}
			}
		}
	}

	// Match year
	let yearMatched = false;
	let year = parseInt(item.getField('year'));
	if (integers.includes(year)) {
		yearMatched = true;
	}

	let matchedTypesNum = (
		(matchedIdentifierLength && 1)
		+ (matchedURLLength && 1)
		+ (matchedTitleLength && 1)
		+ (matchedNamesLength && 1)
		+ (matchedPagesLength && 1)
		+ (yearMatched && 1)
	);

	return (
		matchedIdentifierLength >= 7
		|| matchedURLLength >= 25
		|| matchedTypesNum >= 2
	);
}

class ReferenceResolver {



	async resolve(reference, libraryID, partialCallback) {

		function jsonToItem(json) {
			let item = new Zotero.Item();
			item.libraryID = libraryID;
			item.fromJSON(json);
			return item;
		}


		let identifier = this._parseIdentifier(reference);
		if (!identifier) {
			// let res = await this._resolveIdentifier(reference);
			// if (res && res.DOI) {
			// 	identifier = { DOI: res.DOI };
			// }
		}

		let item;
		if (identifier) {
			item = await this._getItemByIdentifier(identifier);
		}

		// Fallback to Crossref REST API bibliography search
		if (!item) {
			item = await this._searchReferenceOnCrossref(reference, libraryID);
			if (item) {
				let { DOI } = item;
				// Get item from the old Crossref XML API because the REST API lacks page range
				item = await this._getItemByIdentifier({ DOI });
			}
		}

		if (item && !item.abstractNote && item.DOI && item.libraryCatalog.includes('Crossref')) {
			console.log('HAS PARTIAL');
			partialCallback(jsonToItem(item));
			let url = item.url || `https://doi.org/${encodeURIComponent(item.DOI)}`;
			let urlItem = await this._getItemFromURL(url);
			if (urlItem && urlItem.abstractNote) {
				item.abstractNote = urlItem.abstractNote;
			}
		}

		await Zotero.Promise.delay(3000);
		if (item) {
			return jsonToItem(item);
		}
		return null;
	}

	_parseIdentifier(reference) {
		let urls = Array.from(new Set(reference.map(x => x.attributes?.url).filter(x => x)));
		let text = reference.map(item => item.text).join('');
		// Combine all URLs and text together, because URLs can contain identifiers like DOI
		text = urls.join(' ') + ' ' + text;
		let identifiers = Zotero.Utilities.extractIdentifiers(text);
		// We need a stricter PMID parsing than in extractIdentifiers, as it parses random numbers…
		if (identifiers.length && !identifiers[0].PMID) {
			return identifiers[0];
		}
		else {
			let PMID = text.match(/PMID[:\s]*([0-9]+)/i)?.[1] || null;
			if (PMID) {
				return { PMID };
			}
		}
		return null;
	}

	async _resolveIdentifier(json) {
		let uri = 'http://test/resolve';
		let client = Zotero.Sync.Runner.getAPIClient();
		let req = await client.makeRequest(
			'POST',
			uri,
			{
				successCodes: [200],
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(json),
				noAPIKey: true
			}
		);
		return JSON.parse(req.responseText);
	}

	async _getItemByIdentifier(identifier) {
		let translate = new Zotero.Translate.Search();
		translate.setIdentifier(identifier);
		let translators = await translate.getTranslators();
		if (translators.length) {
			translate.setTranslator(translators);
			try {
				translate.setHandler('select', function (translate, items, callback) {
					for (let i in items) {
						let obj = {};
						obj[i] = items[i];
						callback(obj);
						return;
					}
				});

				let newItems = await translate.translate({
					libraryID: false,
					saveAttachments: false
				});
				if (newItems.length) {
					return newItems[0];
				}
			}
			catch (e) {
				Zotero.debug('Translation failed: ' + e);
			}
		}
		return null;
	}

	async _searchReferenceOnCrossref(reference, libraryID) {
		let text = reference.map(item => item.text).join('');
		let translate = new Zotero.Translate.Search();
		translate.setTranslator(Zotero.Translators.TRANSLATOR_ID_CROSSREF_REST);
		translate.setSearch({ query: text });
		let items = await translate.translate({
			libraryID: false,
			saveAttachments: false
		});
		for (let item of items) {
			let translatedItem = new Zotero.Item();
			translatedItem.libraryID = libraryID;
			translatedItem.fromJSON(item);
			if (await itemMatchesReference(translatedItem, reference)) {
				return item;
			}
		}
		return null;
	}

	async _getItemFromURL(url) {
		let results;
		try {
			results = await Zotero.HTTP.processDocuments(url, async function (doc) {
				try {
					let translate = new Zotero.Translate.Web();
					translate.setDocument(doc);
					translate.setHandler('select', function (translate, items, callback) {
						for (let i in items) {
							let obj = {};
							obj[i] = items[i];
							callback(obj);
							return;
						}
					});
					let translators = await translate.getTranslators();
					if (!translators.length) {
						return null;
					}
					translate.setTranslator(translators[0]);
					let newItems = await translate.translate({ libraryID: false, saveAttachments: false });
					return newItems[0];
				}
				catch (e) {
					Zotero.logError(e);
				}
				return null;
			});
		}
		catch (e) {
			Zotero.logError(e);
		}
		if (results) {
			return results[0];
		}
		return null;
	}
}

class ReferenceMatcher {
	async match(reference, libraryID) {
		let item;
		let itemIDs;
		itemIDs = await this._searchByIdentifier(reference, libraryID);
		itemIDs = itemIDs.slice(0, 10);
		if (itemIDs.length) {
			return this._getBestItem(itemIDs);
		}

		itemIDs = await this._searchByURL(reference, libraryID);
		itemIDs = itemIDs.slice(0, 10);
		if (itemIDs.length) {
			return this._getBestItem(itemIDs);
		}

		itemIDs = await this._searchByTitle(reference, libraryID);
		itemIDs = itemIDs.slice(0, 50);
		item = await this._matchBestItem(itemIDs, reference);
		if (item) {
			return item;
		}

		itemIDs = await this._searchByTitleSample(reference, libraryID);
		itemIDs = itemIDs.slice(0, 50);
		item = await this._matchBestItem(itemIDs, reference);
		if (item) {
			return item;
		}

		itemIDs = await this._searchByAuthor(reference, libraryID);
		itemIDs = itemIDs.slice(0, 50);
		item = await this._matchBestItem(itemIDs, reference);
		if (item) {
			return item;
		}

		itemIDs = await this._searchByPageRange(reference, libraryID);
		itemIDs = itemIDs.slice(0, 50);
		item = await this._matchBestItem(itemIDs, reference);
		if (item) {
			return item;
		}

		itemIDs = await this._searchByYear(reference, libraryID);
		itemIDs = itemIDs.slice(0, 50);
		item = await this._matchBestItem(itemIDs, reference);
		if (item) {
			return item;
		}
		return null;
	}

	async _searchByIdentifier(reference, libraryID) {
		let urls = Array.from(new Set(reference.map(x => x.attributes?.url).filter(x => x)));
		let text = reference.map(item => item.text).join('');
		let identifiers = Zotero.Utilities.extractIdentifiers(text);
		identifiers.push(...Zotero.Utilities.extractIdentifiers(urls.join(' ')));
		let search = new Zotero.Search();
		search.libraryID = libraryID;
		search.addCondition('noChildren', 'true');
		search.addCondition('joinMode', 'any');
		let triggered = false;
		for (let identifier of identifiers) {
			for (let key in identifier) {
				let value = identifier[key];
				if (value.length < 5) continue;
				triggered = true;
				// Convert between isbn 10 and 13
				if (key === 'ISBN') {
					if (value.length === 10) {
						search.addCondition('isbn', 'contains', value);
						search.addCondition('isbn', 'contains', isbn10to13(value));
					}
					else {
						search.addCondition('isbn', 'contains', value);
						let isbn10 = isbn13to10(value);
						if (isbn10) {
							search.addCondition('isbn', 'contains', isbn10);
						}
					}
				}
				// DOI/URL can still wrap other identifiers like arXiv in DOI or DOI in URL
				search.addCondition('DOI', 'is', value);
				search.addCondition('url', 'contains', value);
				search.addCondition('extra', 'contains', value);
			}
		}
		if (!triggered) {
			return [];
		}
		return search.search();
	}

	_searchByURL(reference, libraryID) {
		let urls = new Set(reference.map(x => x.attributes?.url).filter(x => x));
		let text = reference.map(item => item.text).join('');
		let urlRegex = /(https?:\/\/|www\.|10\.)[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
		let match;
		while ((match = urlRegex.exec(text)) !== null) {
			urls.add(match[0]);
		}
		urls = Array.from(urls);
		if (!urls.length) {
			return [];
		}
		let search = new Zotero.Search();
		search.addCondition('noChildren', 'true');
		search.libraryID = libraryID;
		search.addCondition('joinMode', 'any');
		for (let url of urls) {
			if (url.slice(-1) === '/') {
				url = url.slice(0, -1);
			}
			search.addCondition('url', 'contains', url);
		}
		return search.search();
	}

	async _searchByTitle(reference, libraryID) {
		let text = reference.map(item => item.text).join('');
		let quotePairs = [['"', '"'], ['“', '”'], ["'", "'"], ['‘', '’']];
		let titleCandidates = quotePairs.flatMap(([start, end]) => (
			[...text.matchAll(new RegExp(`${start}(.*?)${end}`, 'g'))].map(m => m[1])
		));
		titleCandidates.push(
			...text.split('.'),
			...text.split(','),
			...text.split(new RegExp(`[,.]`)),
			...text.split(new RegExp(`[:.]`)),
			...text.split(new RegExp(`[:,]`)),
			...text.split(new RegExp(`[:,.)]`)),
		);
		if (reference.length >= 3) {
			titleCandidates.push(...reference.map(x => x.text));
		}
		// Trim non-alphanumeric
		titleCandidates = titleCandidates.map(x => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));
		titleCandidates = Array.from(new Set(titleCandidates));
		titleCandidates = titleCandidates.filter(x => x.length < 20);
		let search = new Zotero.Search();
		search.addCondition('noChildren', 'true');
		search.libraryID = libraryID;
		search.addCondition('joinMode', 'any');
		for (let candidate of titleCandidates) {
			search.addCondition('title', 'contains', candidate);
			search.addCondition('publicationTitle', 'contains', candidate);
			search.addCondition('shortTitle', 'contains', candidate);
		}
		return search.search();
	}

	async _searchByTitleSample(reference, libraryID) {
		let text = reference.map(item => item.text).join('');
		text = text.replace(/[.'"‘’“”]/g, ' ');
		let parts = text.split(' ').filter(x => x);
		const SAMPLE_LENGTH = 4;
		let samples = [];
		for (let i = 0; i <= parts.length - SAMPLE_LENGTH; i++) {
			let sample = parts.slice(i, i + SAMPLE_LENGTH).join(' ');
			samples.push(sample);
			if (samples.length >= 50) {
				break;
			}
		}
		let search = new Zotero.Search();
		search.addCondition('noChildren', 'true');
		search.libraryID = libraryID;
		search.addCondition('joinMode', 'any');
		for (let sample of samples) {
			search.addCondition('title', 'contains', sample);
			search.addCondition('publicationTitle', 'contains', sample);
			search.addCondition('shortTitle', 'contains', sample);
		}
		return search.search();
	}

	async _searchByAuthor(reference, libraryID) {
		let text = reference.map(item => item.text).join('');
		// Split text on any sequence of non-letter Unicode characters
		let words = text.split(/[^\p{L}]+/u);
		// Filter words that are at least 3 characters and first character is uppercase
		let filtered = words.filter(word => word.length >= 3 && word[0] === word[0].toUpperCase());
		let candidates = Array.from(new Set(filtered));
		let search = new Zotero.Search();
		search.addCondition('noChildren', 'true');
		search.libraryID = libraryID;
		search.addCondition('joinMode', 'any');
		for (let candidate of candidates) {
			// To match shorter names, we ensure they end with a separator to reduce the chance
			// of matching a sequence in the middle of an author name
			if (candidate.length <= 4) {
				search.addCondition('creator', 'contains', candidate + ' ');
				search.addCondition('creator', 'contains', candidate + ',');
				search.addCondition('creator', 'contains', ' ' + candidate);
				search.addCondition('creator', 'contains', ',' + candidate);
			}
			else {
				search.addCondition('creator', 'contains', candidate);
			}
		}
		return search.search();
	}

	async _searchByPageRange(reference, libraryID) {
		let text = reference.map(item => item.text).join('');
		// Match ranges
		let regex = new RegExp(`(\\d+)\\s*[\\-‐‑‒–—−]\\s*(\\d+)`, 'g');
		let results = [];
		let match;
		while ((match = regex.exec(text)) !== null) {
			results.push(parseInt(match[1]) + '-' + parseInt(match[2]));
		}
		let search = new Zotero.Search();
		search.addCondition('noChildren', 'true');
		search.libraryID = libraryID;
		search.addCondition('joinMode', 'any');
		for (let range of results) {
			search.addCondition('pages', 'is', range);
		}
		return search.search();
	}

	async _searchByYear(reference, libraryID) {
		let text = reference.map(item => item.text).join('');
		let currentYear = new Date().getFullYear();
		let rx = /(^|\(|\s|,)(\d{4})(?=\)|,|\s|$)/g;
		let candidates = [];
		let match;
		while ((match = rx.exec(text)) !== null) {
			let year = parseInt(match[2]);
			if (year >= 1800 && year <= currentYear) {
				candidates.push(year.toString());
			}
		}
		let search = new Zotero.Search();
		search.addCondition('noChildren', 'true');
		search.libraryID = libraryID;
		search.addCondition('joinMode', 'any');
		for (let year of candidates) {
			search.addCondition('date', 'is', year);
		}
		return search.search();
	}

	async _matchBestItem(itemIDs, reference) {
		if (itemIDs.length) {
			let items = await Zotero.Items.getAsync(itemIDs);
			if (items.length) {
				let validatedItems = [];
				for (let item of items) {
					if (await itemMatchesReference(item, reference)) {
						validatedItems.push(item);
					}
				}
				if (validatedItems.length) {
					return this._getBestItem(validatedItems.map(x => x.id));
				}
			}
		}
		return null;
	}

	async _getBestItem(itemIDs) {
		let list = [];
		let items = await Zotero.Items.getAsync(itemIDs);
		for (let item of items) {
			let score = 0;
			let attachments = await item.getBestAttachments();
			if (attachments.some(x => x.isPDFAttachment() || x.isEPUBAttachment())) {
				score = 2;
			}
			else if (attachments.some(x => x.isSnapshotAttachment())) {
				score = 1;
			}
			list.push([score, item]);
		}
		list.sort((a, b) => b[0] - a[0]);
		return list[0][1];
	}
}

class RecognizeReference {
	constructor() {
		this._referenceMatcher = new ReferenceMatcher();
		this._referenceResolver = new ReferenceResolver();
	}

	async match(reference, libraryID) {
		return this._referenceMatcher.match(reference, libraryID);
	}

	async resolve(reference, libraryID, partialCallback) {
		return this._referenceResolver.resolve(reference, libraryID, partialCallback);
	}

	async itemToJSON(item) {
		console.trace();
		let attachment = await item.getBestAttachment();
		let attachmentID;
		let attachmentImageSrc;
		// It seems that this._bestAttachmentState isn't null even if there are no attachments
		if (attachment && item.getAttachments().length) {
			attachmentID = attachment.id;
			attachmentImageSrc = attachment.getImageSrcAlt();
		}
		return {
			itemID: item.itemID,
			title: item.getField('title'),
			creator: item.getField('firstCreator'),
			year: item.getField('year'),
			url: item.getField('url'),
			abstract: item.getField('abstractNote'),
			imageSrc: item.getImageSrcAlt(),
			attachmentID,
			attachmentImageSrc,
		};
	}
}

Zotero.RecognizeReference = new RecognizeReference;
