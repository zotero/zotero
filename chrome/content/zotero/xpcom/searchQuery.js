/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org

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

/**
 * Zotero.SearchQuery -- a text form of the search conditions the Advanced
 * Search edits, for typing searches into a search box:
 *
 *     by:smith after:2020 tag:"to read" crispr
 *     creator is smith and (tag is foo or bar)
 *
 * A clause is a field, an operator, and a value. Clauses can be grouped with
 * parentheses and joined with `and` or `or`, with `and` binding tighter, so
 * `a or b and c` means `a or (b and c)`. Anything that isn't a clause is free
 * text, returned separately for the caller to match however its search mode
 * matches text.
 *
 * Parsing never fails: text that doesn't look like a clause is just text, so
 * a DOI, a URL, or a title with a colon in it searches as typed. The same
 * goes for anything the search itself would reject -- an unknown item type or
 * an empty value -- since searching for the text finds too much, while a
 * malformed condition finds nothing.
 */
Zotero.SearchQuery = new function () {
	// Short names a locale can offer for a condition, each message a
	// comma-separated list. A locale can give a condition as many as it likes;
	// one that collides with a condition name is skipped.
	const KEYWORDS = {
		'search-query-keyword-creator': { condition: 'creator' },
		'search-query-keyword-publication': { condition: 'publicationTitle' },
		'search-query-keyword-item-type': { condition: 'itemType' },
		'search-query-keyword-language': { condition: 'language' },
		'search-query-keyword-abstract': { condition: 'abstractNote' },
		'search-query-keyword-fulltext': { condition: 'fulltextContent' },
		'search-query-keyword-date': { condition: 'date' },
		'search-query-keyword-date-before': { condition: 'date', operator: 'isBefore' },
		'search-query-keyword-date-after': { condition: 'date', operator: 'isAfter' },
		'search-query-keyword-date-added': { condition: 'dateAdded' },
		'search-query-keyword-date-modified': { condition: 'dateModified' }
	};

	// The same short names in English, which keep working in every locale so
	// that a query written anywhere can be read anywhere. An operator here is
	// the one the colon form uses, so `after:2020` is a date comparison rather
	// than a match.
	const ALIASES = {
		by: { condition: 'creator' },
		'number of tags': { condition: 'numTags' },
		'number of notes': { condition: 'numNotes' },
		'number of attachments': { condition: 'numAttachments' },
		'number of annotations': { condition: 'numAnnotations' },
		'in': { condition: 'publicationTitle' },
		publication: { condition: 'publicationTitle' },
		journal: { condition: 'publicationTitle' },
		year: { condition: 'date' },
		before: { condition: 'date', operator: 'isBefore' },
		after: { condition: 'date', operator: 'isAfter' },
		since: { condition: 'date', operator: 'isAfter' },
		added: { condition: 'dateAdded' },
		modified: { condition: 'dateModified' },
		lang: { condition: 'language' },
		type: { condition: 'itemType' },
		fulltext: { condition: 'fulltextContent' },
		text: { condition: 'fulltextContent' },
		abstract: { condition: 'abstractNote' },
		// The only colored thing that's searchable, so `type is annotation
		// and color is red` reads the way people write it
		color: { condition: 'annotationColor' }
	};

	// Conditions matched against an item's children, beyond the ones whose own
	// definition says which level they match at
	const CHILD_FIELDS = {
		'annotation tag': { condition: 'tag', level: 'annotation' },
		'note tag': { condition: 'tag', level: 'note' },
		'attachment tag': { condition: 'tag', level: 'attachment' },
		'note text': { condition: 'note', level: 'note' },
		'attachment title': { condition: 'title', level: 'attachment' }
	};

	// Conditions that are plumbing rather than something to type, plus those
	// whose values are keys or ids no one can type from memory: a collection
	// name isn't unique and a saved search's key is opaque, so those need
	// completion that keeps the value behind the label.
	const EXCLUDED = new Set([
		'joinMode', 'groupStart', 'groupEnd', 'resultLevel', 'bestMatch',
		'includeParentsAndChildren', 'includeParents', 'includeChildren',
		'recursive', 'noChildren', 'includeDeleted', 'deleted', 'tempTable',
		'libraryID', 'key', 'itemID', 'savedSearchID', 'collectionID', 'tagID',
		'itemTypeID', 'fileTypeID',
		'collection', 'savedSearch', 'annotationAuthor',
		// Quick search modes, which exist as conditions so that opening the
		// Advanced Search from the quick search can show what it searched
		'titleCreatorYear', 'anyField'
	]);

	// Conditions whose values come from the library rather than a fixed list,
	// with the parameters the autocomplete search takes for each (see
	// zotero-autocomplete.mjs)
	const VALUE_LOOKUPS_BY_SEARCH = {
		tag: { fieldName: 'tag' },
		creator: { fieldName: 'creator', fieldMode: 2 },
		author: { fieldName: 'author', fieldMode: 2 },
		editor: { fieldName: 'editor', fieldMode: 2 },
		bookAuthor: { fieldName: 'bookAuthor', fieldMode: 2 }
	};

	// Conditions stored as internal names, ids, or codes, keyed by the names
	// shown in the interface, which are what a query uses. A value that isn't
	// in the list isn't a value for that condition at all.
	const VALUE_LOOKUPS = {
		itemType: () => {
			let values = {};
			for (let type of Zotero.ItemTypes.getTypes()) {
				values[Zotero.ItemTypes.getLocalizedString(type.name).toLowerCase()] = type.name;
			}
			return values;
		},
		annotationColor: () => {
			let values = {};
			for (let [l10nID, hex] of Zotero.Annotations.COLORS) {
				values[Zotero.ftl.formatValueSync(l10nID).toLowerCase()] = hex;
			}
			return values;
		},
		annotationType: () => {
			let values = {};
			for (let name of ['highlight', 'underline', 'note', 'text', 'image', 'ink']) {
				let id = Zotero.Annotations['ANNOTATION_TYPE_' + name.toUpperCase()];
				if (id === undefined) {
					continue;
				}
				try {
					values[Zotero.getString('reader-' + name + '-annotation-short')
						.toLowerCase()] = String(id);
				}
				catch (e) {}
			}
			return values;
		},
		attachmentStorageType: () => {
			let values = {};
			for (let type of ['storedFile', 'linkedFile', 'webLink']) {
				values[Zotero.getString('attachment-storage-type-' + type).toLowerCase()] = type;
			}
			return values;
		}
	};

	// A name condition compares against the full name, so `creator is okonkwo`
	// would match only a creator with no first name. In a typed query that
	// reads as "the creator is Okonkwo", so match within the name instead --
	// the same as the quick search does.
	const NAME_CONDITIONS = new Set(['creator', 'author', 'editor', 'bookAuthor', 'lastName']);
	const NAME_OPERATOR_OVERRIDES = { is: 'contains', isNot: 'doesNotContain' };

	// Conditions whose values are discrete rather than text to match within,
	// so `tag:foo` means the tag foo rather than tags containing "foo"
	const DEFAULT_OPERATORS = {
		tag: 'is',
		itemType: 'is',
		annotationColor: 'is',
		annotationType: 'is',
		attachmentStorageType: 'is'
	};

	// Operators can be several words, matched longest first so that "is not
	// empty" wins over "is not" and "is". A comparison also reads with an
	// extra "is" ("year is before 2020"), which only a condition that
	// compares takes that way -- `title is before` matches the word.
	const OPERATOR_WORDS = {
		'is': 'is',
		'is not': 'isNot',
		'is empty': 'isEmpty',
		'is not empty': 'isNotEmpty',
		'contains': 'contains',
		'does not contain': 'doesNotContain',
		'begins with': 'beginsWith',
		'starts with': 'beginsWith',
		'before': 'isBefore',
		'is before': 'isBefore',
		'after': 'isAfter',
		'is after': 'isAfter',
		'since': 'isAfter',
		'in the last': 'isInTheLast',
		'is in the last': 'isInTheLast',
		'within the last': 'isInTheLast',
		'greater than': 'isGreaterThan',
		'is greater than': 'isGreaterThan',
		'more than': 'isGreaterThan',
		'is more than': 'isGreaterThan',
		'less than': 'isLessThan',
		'is less than': 'isLessThan',
		'>': 'isGreaterThan',
		'<': 'isLessThan'
	};

	// Operators that take no value
	const UNARY = new Set(['isEmpty', 'isNotEmpty']);

	// Operators that come before a condition instead of after it, reading
	// the way they're said: `no doi`, `has doi`
	const PREFIX_OPERATORS = { no: 'isEmpty', has: 'isNotEmpty' };

	// Things an item can have some or none of, which the prefix operators
	// test as counts: `no annotation` means no annotations at all, not an
	// annotation with an empty field
	const PREFIX_COUNT_CONDITIONS = {
		annotation: 'numAnnotations',
		note: 'numNotes',
		tag: 'numTags',
		attachment: 'numAttachments'
	};

	// How each prefix operator compares a count
	const PREFIX_COUNT_COMPARISONS = {
		isEmpty: { operator: 'is', value: '0' },
		isNotEmpty: { operator: 'isGreaterThan', value: '0' }
	};

	const JOIN_WORDS = { and: 'all', or: 'any' };

	const QUOTES = ['"', "'", '“', '‘'];
	const CLOSING_QUOTES = { '"': '"', "'": "'", '“': '”', '‘': '’' };

	// "3 days", "2 weeks" -- the value an isInTheLast condition stores. Weeks
	// are counted in days, which is what the date comparison understands.
	const DURATION_RE = /^(\d+)\s*(day|week|month|year)s?\b/i;

	var _fields = null;
	var _fieldPhrases = null;
	var _operatorPhrases = null;
	var _prefixOperatorPhrases = null;
	var _prefixCountPhrases = null;
	var _prefixContextRE = null;
	var _values = {};
	var _valuePhrases = {};
	var _operatorRE = null;

	// Every condition the Advanced Search offers is typeable, by its
	// localized name and by any alias above
	function _getFields() {
		if (_fields) {
			return _fields;
		}
		_fields = {};
		// Conditions by their stored name, which the tables below refer to
		// but the syntax doesn't expose
		let byCondition = {};
		let add = (name, field) => {
			let key = (name || '').toLowerCase();
			if (key && !_fields[key]) {
				_fields[key] = field;
			}
		};
		for (let { name, localized, operators } of Zotero.SearchConditions.getStandardConditions()) {
			if (EXCLUDED.has(name)) {
				continue;
			}
			let field = {
				condition: name,
				operators: Object.keys(operators || { contains: true })
			};
			// A condition that matches at one particular level is scoped to
			// it, so `annotation text:foo` finds items with a matching
			// annotation. An array of levels means it matches natively at
			// each of them.
			let level = Zotero.SearchConditions.get(name).level;
			if (typeof level == 'string' && !['item', 'any'].includes(level)) {
				field.level = level;
			}
			byCondition[name] = field;
			add(localized, field);
		}
		// Aliases win over the condition names they shadow: `type` is far more
		// likely to mean the item type than the report/thesis Type field
		for (let [alias, { condition, operator }] of Object.entries(ALIASES)) {
			let field = byCondition[condition];
			if (field) {
				_fields[alias] = operator ? { ...field, operator } : field;
			}
		}
		for (let [id, { condition, operator }] of Object.entries(KEYWORDS)) {
			let field = byCondition[condition];
			if (!field) {
				continue;
			}
			let translated;
			try {
				translated = Zotero.ftl.formatValueSync(id);
			}
			catch (e) {
				Zotero.logError(e);
			}
			for (let keyword of (translated || '').split(',')) {
				keyword = keyword.trim().toLowerCase();
				// A keyword that collides with a condition name would shadow
				// it, so only add ones that are free
				if (keyword && !_fields[keyword]) {
					_fields[keyword] = operator ? { ...field, operator } : field;
				}
			}
		}
		for (let [name, { condition, level }] of Object.entries(CHILD_FIELDS)) {
			let base = byCondition[condition];
			if (base) {
				add(name, { ...base, level });
			}
		}
		return _fields;
	}

	/**
	 * Field names available for completion.
	 *
	 * @return {String[]}
	 */
	this.getFieldNames = function () {
		return Object.keys(_getFields());
	};

	/**
	 * The search condition a field name maps to, or false if it isn't one.
	 *
	 * @param {String} name
	 * @return {Object|false}
	 */
	this.getField = function (name) {
		return _getFields()[(name || '').toLowerCase()] || false;
	};

	/**
	 * The values a condition accepts, keyed by what can be typed for each, or
	 * null if it takes any value.
	 *
	 * @param {String} condition
	 * @return {Object|null}
	 */
	this.getValues = function (condition) {
		if (!VALUE_LOOKUPS[condition]) {
			return null;
		}
		if (!_values[condition]) {
			_values[condition] = VALUE_LOOKUPS[condition]();
		}
		return _values[condition];
	};

	/**
	 * Completions for what's being typed at the caret: a condition name
	 * partway through a word, or a value for a condition that takes
	 * particular ones. Free text, dates, and numbers have nothing to offer.
	 *
	 * @param {String} text
	 * @param {Number} [caret=text.length] - Offset of the caret
	 * @return {Object|null} - { type, start, end, completions }, where type is
	 *     'field' or 'value', start and end are the offsets the completion
	 *     replaces, and each completion is { text, label, description }
	 */
	this.getCompletions = function (text, caret = text.length) {
		// Completing partway through a word would leave its tail behind
		if (caret < text.length && !/[\s)]/.test(text[caret])) {
			return null;
		}
		let head = text.slice(0, caret);
		let openQuote = _openQuoteAt(head);
		let clause = _activeClause(this, head);
		return _trailingValueCompletions(this, head, caret, openQuote)
			|| _valueCompletions(this, clause, head, caret, openQuote)
			|| _fieldCompletions(this, clause, head, caret, openQuote);
	};

	// Values for `type:jour`, where the condition takes particular ones
	function _valueCompletions(self, clause, head, caret, openQuote) {
		// A unary operator's clause is complete, so what follows isn't a value
		if (!clause || !clause.supported || UNARY.has(clause.operatorName)) {
			return null;
		}
		return _valuesFor(self, clause.field.condition, head, clause.valueStart, caret, openQuote);
	}

	// The clause whose value ends at the caret, if the name before the last
	// colon or operator is a condition that takes that operator. The name can
	// be several words ("publication title"), and what precedes it is text,
	// so try the longest name that's a condition.
	function _activeClause(self, head) {
		let split = _valueSplit(head);
		if (!split) {
			return null;
		}
		let words = head.slice(0, split.fieldEnd).trim().split(/\s+/);
		let field = null;
		for (let i = 0; i < words.length && !field; i++) {
			field = self.getField(words.slice(i).join(' '));
		}
		if (!field) {
			return null;
		}
		let operatorName = split.operator
			? OPERATOR_WORDS[split.operator]
			: (field.operator || _defaultOperator(field));
		let valueStart = split.valueStart + /^\s*/.exec(head.slice(split.valueStart))[0].length;
		return {
			field,
			operatorName,
			valueStart,
			// Whether the condition takes the operator: `type before boo`
			// names a condition and an operator but doesn't make a clause
			supported: field.operators.includes(operatorName)
		};
	}

	// Completions for what the tokenizer already reads as a value ending at
	// the caret -- a clause's own value (`tag:zz`) or one being typed after
	// `or`, which repeats the field of the clause before it
	function _trailingValueCompletions(self, head, caret, openQuote) {
		let tokens = self.tokenize(head).filter(token => token.type !== 'space');
		let last = tokens[tokens.length - 1];
		if (!last) {
			return null;
		}
		// A value the tokenizer already read ("tag:foo or zz")
		if (last.type === 'value' && last.field && last.end === head.length) {
			let field = self.getField(last.field);
			let start = last.start + /^\s*/.exec(head.slice(last.start))[0].length;
			return _valuesFor(self, field.condition, head, start, caret, openQuote);
		}
		// A value not started yet ("type:book or ")
		if (last.type === 'join' && JOIN_WORDS[last.value.toLowerCase()] === 'any'
				&& last.end < head.length) {
			let previous = tokens[tokens.length - 2];
			if (previous && previous.type === 'value' && previous.field) {
				let field = self.getField(previous.field);
				return _valuesFor(self, field.condition, head, caret, caret, openQuote);
			}
			return null;
		}
		// A value that doesn't read as one yet ("annotation color:red or bl")
		if (last.type === 'text' && last.end === head.length && tokens.length >= 3) {
			let join = tokens[tokens.length - 2];
			let previous = tokens[tokens.length - 3];
			if (join.type === 'join' && JOIN_WORDS[join.value.toLowerCase()] === 'any'
					&& previous.type === 'value' && previous.field) {
				let field = self.getField(previous.field);
				return _valuesFor(self, field.condition, head, last.start, caret, openQuote);
			}
		}
		return null;
	}

	// Completions for a condition's value being typed at `start`, replacing
	// through the caret. An opening quote is replaced along with what it
	// quotes, so the completion's own quoting isn't doubled; a quote opened
	// anywhere else means the caret is inside quoted text, which is being
	// typed, not completed.
	function _valuesFor(self, condition, head, start, caret, openQuote) {
		if (openQuote !== -1 && openQuote !== start) {
			return null;
		}
		let typed = head.slice(start);
		if (QUOTES.includes(typed[0])) {
			typed = typed.slice(1);
		}
		let values = self.getValues(condition);
		if (!values) {
			// Values the library supplies, which the caller looks up (they take
			// a query) and turns into completions. Every tag or creator in the
			// library is a list to scroll, not a suggestion, so they need
			// something to match.
			let lookup = typed && VALUE_LOOKUPS_BY_SEARCH[condition];
			return lookup
				? { type: 'value', lookup, prefix: typed, start, end: caret, completions: [] }
				: null;
		}
		let names = Object.keys(values)
			.filter(name => name.startsWith(typed.toLowerCase()))
			.sort((a, b) => a.localeCompare(b));
		// What's typed isn't any of the values, so it may be something else
		// being typed after the clause, like a new condition name
		if (!names.length) {
			return null;
		}
		return {
			type: 'value',
			start,
			end: caret,
			completions: names.map(name => ({
				text: _quoteIfNeeded(name),
				label: name,
				// A value that is a color shows itself
				color: /^#[0-9a-f]{6}$/i.test(values[name]) ? values[name] : undefined
			}))
		};
	}

	// Condition names for `ta`, offered by the shortest name each one has, so
	// that a condition appears once however many ways it can be written
	function _fieldCompletions(self, clause, head, caret, openQuote) {
		// Inside an unfinished quote everything is the value being typed, and
		// a word that could be continuing an operator ("year is b...") isn't
		// the start of a new field
		if (openQuote !== -1 || _continuesOperator(self, head)) {
			return null;
		}
		// A name can be several words ("annotation type"), so try the longest
		// phrase before the caret first: `annotation ty` completes to
		// `annotation type:`, not to `type:`
		for (let word of head.matchAll(/[^\s()]+/g)) {
			// The word where a clause's value starts is that value being
			// typed, not a new field: `title is ta` isn't heading for `tag:`.
			// The same goes for an operator the condition doesn't take --
			// `type before boo` isn't heading for `book author:`.
			if (clause && !UNARY.has(clause.operatorName) && word.index === clause.valueStart) {
				continue;
			}
			// After `no` or `has`, a name alone makes a clause (`no doi`), so
			// offer only names the operator resolves with, and without the
			// colon
			let prefixOperator = _prefixOperatorBefore(head.slice(0, word.index));
			let typed = head.slice(word.index).toLowerCase();
			let byCondition = new Map();
			let names = self.getFieldNames();
			if (prefixOperator) {
				names = names.concat(Object.keys(PREFIX_COUNT_CONDITIONS)
					.filter(name => !names.includes(name)));
			}
			for (let name of names) {
				if (!name.startsWith(typed)) {
					continue;
				}
				if (prefixOperator) {
					let clause = _resolvePrefixClause(self, prefixOperator, name);
					if (!clause) {
						continue;
					}
					// A count (`no annotation`) rather than a field test
					if (PREFIX_COUNT_CONDITIONS[name]) {
						byCondition.set(clause.condition, name);
						continue;
					}
				}
				let field = self.getField(name);
				let key = field.condition + '/' + (field.operator || '') + '/' + (field.level || '');
				let best = byCondition.get(key);
				if (!best || _isPreferredFieldName(name, best)) {
					byCondition.set(key, name);
				}
			}
			if (!byCondition.size) {
				continue;
			}
			return {
				type: 'field',
				start: word.index,
				end: caret,
				completions: _sorted([...byCondition.values()]).map(name => ({
					text: prefixOperator ? name : name + ':',
					label: prefixOperator ? name : name + ':',
					// A count name ('annotation') says what it means itself
					description: prefixOperator && PREFIX_COUNT_CONDITIONS[name]
						? undefined
						: Zotero.SearchConditions.getLocalizedName(self.getField(name).condition)
				}))
			};
		}
		return null;
	}

	// The offset of an opening quote that hasn't been closed, or -1. A quote
	// only opens at the start of a word, so an apostrophe inside one doesn't
	// count.
	function _openQuoteAt(head) {
		let open = -1;
		for (let i = 0; i < head.length; i++) {
			if (open === -1) {
				if (QUOTES.includes(head[i]) && (i === 0 || /[\s(:]/.test(head[i - 1]))) {
					open = i;
				}
			}
			else if (head[i] === CLOSING_QUOTES[head[open]]) {
				open = -1;
			}
		}
		return open;
	}

	// The prefix operator the word being completed follows, if any: in
	// `no d` the `d` is a prefix target, not a new field
	function _prefixOperatorBefore(head) {
		if (!_prefixContextRE) {
			let words = Object.keys(PREFIX_OPERATORS)
				.sort((a, b) => b.length - a.length)
				.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				.join('|');
			_prefixContextRE = new RegExp('(?:^|[\\s(])(' + words + ')\\s+$', 'i');
		}
		let match = _prefixContextRE.exec(head);
		return match ? PREFIX_OPERATORS[match[1].toLowerCase()] : null;
	}

	// Whether the words at the end could be an operator still being typed
	// after a condition name, as in `year is b` on its way to
	// `year is before 2020`
	function _continuesOperator(self, head) {
		_initPhrases(self);
		for (let word of head.matchAll(/[^\s()]+/g)) {
			let field = _matchPhrase(head, word.index, _fieldPhrases);
			if (!field) {
				continue;
			}
			let rest = head.slice(field.end).trim()
				.replace(/\s+/g, ' ')
				.toLowerCase();
			if (rest && Object.keys(OPERATOR_WORDS)
					.some(name => name.length > rest.length && name.startsWith(rest))) {
				return true;
			}
		}
		return false;
	}

	// Where the value being typed starts, and where the condition naming it
	// ends: after a colon (`tag:foo`, operator null) or after an operator
	// (`tag is foo`). The last one in the query is the one being typed.
	function _valueSplit(head) {
		let split = null;
		let colon = head.lastIndexOf(':');
		if (colon !== -1) {
			split = { fieldEnd: colon, valueStart: colon + 1, operator: null };
		}
		let pattern = _operatorPattern();
		pattern.lastIndex = 0;
		let match;
		while ((match = pattern.exec(head))) {
			let valueStart = match.index + match[0].length;
			if (!split || valueStart > split.valueStart) {
				split = {
					fieldEnd: match.index,
					valueStart,
					operator: match[1].replace(/\s+/g, ' ').toLowerCase()
				};
			}
		}
		return split;
	}

	// Operators as they're written between a condition and its value, matched
	// longest first so that `is not empty` doesn't read as `is`
	function _operatorPattern() {
		if (!_operatorRE) {
			let operators = Object.keys(OPERATOR_WORDS)
				.sort((a, b) => b.length - a.length)
				.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'))
				.join('|');
			_operatorRE = new RegExp('\\s+(' + operators + ')\\s+', 'gi');
		}
		return _operatorRE;
	}

	// The shortest of a condition's names, counting a name and its spaced
	// form as the same length and preferring the spaced one, so `t` offers
	// 'type' rather than 'item type'
	function _isPreferredFieldName(name, other) {
		let compact = name.replace(/\s+/g, '');
		let otherCompact = other.replace(/\s+/g, '');
		if (compact.length !== otherCompact.length) {
			return compact.length < otherCompact.length;
		}
		let spaced = name.includes(' ');
		if (spaced !== other.includes(' ')) {
			return spaced;
		}
		return name < other;
	}

	/**
	 * A value as it has to be written in a query to read back as one value.
	 *
	 * @param {String} value
	 * @return {String}
	 */
	this.formatValue = function (value) {
		return _quoteIfNeeded(value);
	};

	/**
	 * Whether the text has an opening quotation mark whose phrase hasn't
	 * been closed yet, so what's quoted is still being typed.
	 *
	 * @param {String} text
	 * @return {Boolean}
	 */
	this.hasOpenQuote = function (text) {
		return _openQuoteAt(text || '') !== -1;
	};

	// A value with spaces or parentheses in it has to be quoted to read back
	// as one value, as does one starting with a quotation mark. There are no
	// escapes, so quote with a character the value doesn't contain.
	function _quoteIfNeeded(value) {
		if (!/[\s()]/.test(value) && !QUOTES.includes(value[0])) {
			return value;
		}
		for (let open of QUOTES) {
			let close = CLOSING_QUOTES[open];
			if (!value.includes(open) && !value.includes(close)) {
				return open + value + close;
			}
		}
		// A value containing every kind of quotation mark can't be written
		return '"' + value + '"';
	}

	function _sorted(names) {
		return names.sort((a, b) => a.length - b.length || a.localeCompare(b));
	}

	/**
	 * Split a query into tokens, for highlighting and completion as the user
	 * types as well as for parse(). Every character of the input belongs to
	 * exactly one token, so the tokens can be rendered in place.
	 *
	 * @param {String} text
	 * @param {Object} [options]
	 * @param {Set} [options.literalAt] - Offsets where a field was recognized
	 *     and the user undid it, so it reads as text from here on
	 * @return {Object[]} - [{ type, value, start, end }], where type is
	 *     'field', 'operator', 'value', 'join', 'paren', 'text', or 'space'
	 */
	this.tokenize = function (text, { literalAt } = {}) {
		_initPhrases(this);
		let tokens = [];
		let pos = 0;
		while (pos < text.length) {
			if (/\s/.test(text[pos])) {
				let start = pos;
				while (pos < text.length && /\s/.test(text[pos])) {
					pos++;
				}
				tokens.push({ type: 'space', value: text.slice(start, pos), start, end: pos });
				continue;
			}
			if (text[pos] === '(' || text[pos] === ')') {
				tokens.push({ type: 'paren', value: text[pos], start: pos, end: pos + 1 });
				pos++;
				continue;
			}

			// A field name only counts as one when a colon or an operator
			// follows it, so "Vol 2: The Return" stays text
			let field = literalAt && literalAt.has(pos)
				? null
				: _matchPhrase(text, pos, _fieldPhrases);
			let clause = field && _readClauseTokens(this, text, pos, field);
			if (!clause) {
				clause = _readPrefixClause(this, text, pos, literalAt);
			}
			if (clause) {
				tokens.push(...clause.tokens);
				pos = clause.end;
				continue;
			}

			let { value, end, quoted } = _readWord(text, pos);
			let isJoin = !quoted && JOIN_WORDS[value.toLowerCase()];
			// `tag is foo or bar` repeats the field of the clause the `or`
			// directly follows, and the repeated value is read the same way
			// the first one was
			if (isJoin && JOIN_WORDS[value.toLowerCase()] === 'any') {
				let previous = tokens.filter(token => token.type !== 'space').pop();
				let repeated = previous && previous.type === 'value' && previous.field
					&& _readRepeatedValue(this, text, end, previous);
				if (repeated) {
					tokens.push({ type: 'join', value, start: pos, end });
					tokens.push(repeated);
					pos = repeated.end;
					continue;
				}
			}
			tokens.push({ type: isJoin ? 'join' : 'text', value, start: pos, end, quoted });
			pos = end;
		}
		return tokens;
	};

	// The tokens for a whole clause, or null if what follows the field name
	// doesn't make one
	function _readClauseTokens(self, text, start, field) {
		let definition = self.getField(field.name);
		// A colon may be spaced away from its field ("tag : foo")
		let afterField = field.end + /^\s*/.exec(text.slice(field.end))[0].length;
		let operator = null;
		if (text[afterField] === ':') {
			operator = { name: ':', end: afterField + 1 };
		}
		else {
			// The longest reading the condition supports, so `date is before
			// 2020` compares dates while `title is before` matches a title
			// against "before"
			for (let match of _matchPhrases(text, afterField, _operatorPhrases)) {
				if (definition.operators.includes(OPERATOR_WORDS[match.name])) {
					operator = match;
					break;
				}
			}
			// A colon after a word operator ("year before:2020") is
			// punctuation, not part of the value
			if (operator) {
				let colon = /^\s*:/.exec(text.slice(operator.end));
				if (colon) {
					operator = { ...operator, end: operator.end + colon[0].length };
				}
			}
		}
		if (!operator) {
			return null;
		}
		let operatorName = operator.name === ':'
			? (definition.operator || _defaultOperator(definition))
			: OPERATOR_WORDS[operator.name];
		if (!operatorName || !definition.operators.includes(operatorName)) {
			return null;
		}
		let tokens = [
			{
				type: 'field',
				value: text.slice(start, field.end),
				name: field.name,
				start,
				end: field.end
			},
			{
				type: 'operator',
				value: text.slice(field.end, operator.end).trim(),
				name: operatorName,
				start: field.end,
				end: operator.end
			}
		];
		if (UNARY.has(operatorName)) {
			return { tokens, end: operator.end };
		}
		let valueStart = operator.end + /^\s*/.exec(text.slice(operator.end))[0].length;
		if (valueStart >= text.length) {
			// The value is still to come, as after completing a condition name.
			// The clause is recognized -- so it's highlighted, and it isn't text
			// to search for -- but it has nothing to match on yet.
			tokens[tokens.length - 1].pending = true;
			return { tokens, end: operator.end };
		}
		if (/[()]/.test(text[valueStart])) {
			return null;
		}
		let value = _readValue(self, text, valueStart, definition, operatorName);
		if (!value || !value.value) {
			return null;
		}
		tokens.push({
			type: 'value',
			value: value.value,
			field: field.name,
			operator: operatorName,
			start: operator.end,
			end: value.end,
			quoted: value.quoted
		});
		return { tokens, end: value.end };
	}

	// A value is a word, a quoted string, a duration ("3 days"), or one of the
	// values the condition accepts, which can run to several words
	// ("book section")
	function _readValue(self, text, pos, definition, operatorName) {
		if (operatorName === 'isInTheLast') {
			let duration = DURATION_RE.exec(text.slice(pos));
			if (!duration) {
				return null;
			}
			let count = parseInt(duration[1]);
			let unit = duration[2].toLowerCase();
			if (unit === 'week') {
				count *= 7;
				unit = 'day';
			}
			return { value: count + ' ' + unit + 's', end: pos + duration[0].length };
		}
		let values = self.getValues(definition.condition);
		if (values) {
			// A condition with a fixed set of values doesn't take any other,
			// so anything else isn't a clause at all
			if (QUOTES.includes(text[pos])) {
				let quoted = _readWord(text, pos);
				let stored = values[quoted.value.toLowerCase()];
				return stored ? { value: stored, end: quoted.end, quoted: true } : null;
			}
			let phrase = _matchPhrase(text, pos, _getValuePhrases(self, definition.condition));
			return phrase ? { value: values[phrase.name], end: phrase.end } : null;
		}
		// An unterminated quote is an unfinished value, not a value that
		// starts with a quotation mark
		if (QUOTES.includes(text[pos]) && !_readWord(text, pos).quoted) {
			return null;
		}
		let word = _readWord(text, pos);
		if (word.end <= pos) {
			return null;
		}
		// Conditions that filter their own values (a count has to be a number)
		// reject anything else, so it isn't a clause
		let filter = Zotero.SearchConditions.get(definition.condition).inlineFilter;
		if (filter && filter(word.value) === false) {
			return null;
		}
		return { value: word.value, end: word.end, quoted: word.quoted };
	}

	// The value after an `or`, read for the same field and operator as the
	// clause the `or` follows
	function _readRepeatedValue(self, text, pos, previous) {
		let definition = self.getField(previous.field);
		let valueStart = pos + /^\s*/.exec(text.slice(pos))[0].length;
		if (valueStart >= text.length || /[()]/.test(text[valueStart])) {
			return null;
		}
		// Something written as a clause of its own is one, even if it doesn't
		// name a condition or take the value it was given -- it's text, not a
		// value for the previous field
		if (_looksLikeClause(text, valueStart) || _readPrefixClause(self, text, valueStart)) {
			return null;
		}
		let value = _readValue(self, text, valueStart, definition, previous.operator);
		if (!value || !value.value) {
			return null;
		}
		return {
			type: 'value',
			value: value.value,
			field: previous.field,
			operator: previous.operator,
			start: pos,
			end: value.end,
			quoted: value.quoted
		};
	}

	// The clause a prefix operator and its target make: a count comparison
	// for something countable (`no annotation` -> numAnnotations is 0), or
	// the operator itself on a condition that takes it (`no doi` -> DOI
	// isEmpty). Null if the target is neither.
	function _resolvePrefixClause(self, operatorName, targetName) {
		let count = PREFIX_COUNT_CONDITIONS[targetName];
		if (count) {
			let comparison = PREFIX_COUNT_COMPARISONS[operatorName];
			return comparison ? { condition: count, ...comparison } : null;
		}
		let field = self.getField(targetName);
		if (!field || !field.operators.includes(operatorName)) {
			return null;
		}
		let clause = { condition: field.condition, operator: operatorName, value: '' };
		if (field.level) {
			clause.level = field.level;
		}
		return clause;
	}

	// `no doi` or `has annotation` -- an operator written before what it
	// tests. A target that doesn't resolve keeps the operator word as text.
	function _readPrefixClause(self, text, pos, literalAt) {
		let prefix = _matchPhrase(text, pos, _prefixOperatorPhrases);
		if (!prefix || !/\s/.test(text[prefix.end] || '')) {
			return null;
		}
		let operatorEnd = prefix.end;
		if (literalAt && literalAt.has(operatorEnd)) {
			return null;
		}
		let targetStart = operatorEnd + /^\s*/.exec(text.slice(operatorEnd))[0].length;
		let target = _matchPhrase(text, targetStart, _fieldPhrases)
			|| _matchPhrase(text, targetStart, _prefixCountPhrases);
		if (!target) {
			return null;
		}
		let clause = _resolvePrefixClause(self, PREFIX_OPERATORS[prefix.name], target.name);
		if (!clause) {
			return null;
		}
		// Followed by a colon or an operator, the target starts a clause of
		// its own, and the prefix is text
		let after = target.end + /^\s*/.exec(text.slice(target.end))[0].length;
		if (text[after] === ':' || _matchPhrase(text, after, _operatorPhrases)) {
			return null;
		}
		return {
			tokens: [
				{
					type: 'operator',
					value: text.slice(pos, operatorEnd),
					name: clause.operator,
					// The parser takes the whole clause from here rather than
					// reinterpreting the target name
					clause,
					start: pos,
					end: operatorEnd
				},
				{
					type: 'field',
					value: text.slice(operatorEnd, target.end),
					name: target.name,
					start: operatorEnd,
					end: target.end
				}
			],
			end: target.end
		};
	}

	// Whether a field name followed by a colon or an operator starts here,
	// whether or not it makes a usable clause
	function _looksLikeClause(text, pos) {
		let field = _matchPhrase(text, pos, _fieldPhrases);
		if (!field) {
			return false;
		}
		let after = field.end + /^\s*/.exec(text.slice(field.end))[0].length;
		return text[after] === ':' || !!_matchPhrase(text, after, _operatorPhrases);
	}

	function _initPhrases(self) {
		if (!_fieldPhrases) {
			_fieldPhrases = _phrasesByLength(self.getFieldNames());
			_operatorPhrases = _phrasesByLength(Object.keys(OPERATOR_WORDS));
			_prefixOperatorPhrases = _phrasesByLength(Object.keys(PREFIX_OPERATORS));
			_prefixCountPhrases = _phrasesByLength(Object.keys(PREFIX_COUNT_CONDITIONS));
		}
	}

	function _getValuePhrases(self, condition) {
		if (!_valuePhrases[condition]) {
			_valuePhrases[condition] = _phrasesByLength(Object.keys(self.getValues(condition)));
		}
		return _valuePhrases[condition];
	}

	/**
	 * Parse a query into a condition tree and the free text left over.
	 *
	 * @param {String} text
	 * @param {Object} [options] - As for tokenize()
	 * @return {Object} - { tree, text }, where tree is
	 *     { joinMode, children: [...] } with children being clauses
	 *     ({ condition, operator, value }) or nested trees, and text is the
	 *     free text, in input order
	 */
	this.parse = function (text, options) {
		let tokens = this.tokenize(text, options).filter(token => token.type !== 'space');
		let state = { tokens, pos: 0, ranges: [], text, pending: false };
		let group = _parseSequence(state, false);
		// Without a clause anywhere, the whole query is text as typed
		if (!group.children.length && !state.pending) {
			return { tree: null, text: text.trim().replace(/\s+/g, ' ') };
		}
		return {
			tree: group.children.length
				? { joinMode: group.joinMode, children: group.children }
				: null,
			text: _freeText(state)
		};
	};

	/**
	 * Build a search from a query, or false if the query has no clauses and so
	 * is just text to search for.
	 *
	 * Free text is matched the way the given quick search mode matches text,
	 * so `by:smith crispr` filters by creator and then, in Best Match mode,
	 * ranks what's left by relevance to "crispr".
	 *
	 * @param {String} query
	 * @param {Object} [options]
	 * @param {Number} [options.libraryID]
	 * @param {String} [options.mode] - A quick search mode
	 * @param {Set} [options.literalAt] - As for tokenize()
	 * @return {Zotero.Search|false}
	 */
	this.getSearch = function (query, { libraryID, mode, literalAt } = {}) {
		let { tree, text } = this.parse(query, { literalAt });
		if (!tree) {
			return false;
		}
		let search = new Zotero.Search();
		if (libraryID) {
			search.libraryID = libraryID;
		}
		// The query describes items, so return items: a condition that
		// matches on a child -- attachment content, a tag on an attachment --
		// maps up to the item that owns it, rather than each condition
		// filtering at whatever level it happens to match, which would give
		// `type:book attachment content:crypto` nothing.
		// But a child type names the rows themselves, so it sets the result
		// level instead of being a condition: the level is the type filter,
		// and the other conditions map to it -- `type:attachment by:smith`
		// means Smith's attachments.
		let resultLevel = 'item';
		if (tree.joinMode === 'all') {
			let pins = tree.children.filter(child => !child.children
				&& child.condition === 'itemType' && child.operator === 'is'
				&& ['attachment', 'note', 'annotation'].includes(child.value));
			// Conflicting types stay conditions, and honestly match nothing
			if (pins.length && new Set(pins.map(pin => pin.value)).size === 1) {
				resultLevel = pins[0].value;
				tree = { ...tree, children: tree.children.filter(child => !pins.includes(child)) };
			}
		}
		search.addCondition('resultLevel', resultLevel);
		// Free text is joined to the clauses with "all", so an "any" query
		// becomes a group rather than something the text is OR'd into
		this.addToSearch(search, text && tree.joinMode === 'any'
			? { joinMode: 'all', children: [tree] }
			: tree);
		if (text) {
			if (mode === 'bestMatch' && Zotero.Embeddings?.isEnabled()) {
				search.addCondition('bestMatch', 'contains', text);
			}
			else {
				let quicksearchMode = ['titleCreatorYear', 'everything'].includes(mode)
					? mode
					: 'fields';
				search.addCondition('quicksearch-' + quicksearchMode, 'contains', text);
			}
		}
		return search;
	};

	/**
	 * Add a parsed query's conditions to a search.
	 *
	 * @param {Zotero.Search} search
	 * @param {Object} tree - From parse()
	 */
	this.addToSearch = function (search, tree) {
		if (!tree) {
			return;
		}
		if (tree.joinMode && tree.joinMode !== 'all') {
			search.addCondition('joinMode', tree.joinMode);
		}
		for (let child of tree.children) {
			_addNode(search, child);
		}
	};

	function _addNode(search, node) {
		if (node.children) {
			search.addCondition('groupStart', 'true', '');
			search.addCondition('joinMode', node.joinMode);
			for (let child of node.children) {
				_addNode(search, child);
			}
			search.addCondition('groupEnd', 'true', '');
			return;
		}
		// A condition that matches at a child level is scoped to it, so the
		// match maps up to the item the search returns
		if (node.level) {
			search.addCondition('groupStart', 'true', '');
			search.addCondition('resultLevel', node.level);
			search.addCondition(node.condition, node.operator, node.value);
			search.addCondition('groupEnd', 'true', '');
			return;
		}
		search.addCondition(node.condition, node.operator, node.value);
	}

	// Read a bare or quoted word, returning where it ends
	function _readWord(text, pos) {
		if (QUOTES.includes(text[pos])) {
			let end = text.indexOf(CLOSING_QUOTES[text[pos]], pos + 1);
			if (end !== -1) {
				return { value: text.slice(pos + 1, end), end: end + 1, quoted: true };
			}
		}
		let end = pos;
		while (end < text.length && !/[\s()]/.test(text[end])) {
			end++;
		}
		return { value: text.slice(pos, end), end, quoted: false };
	}

	function _phrasesByLength(names) {
		return names
			.map(name => ({ name, words: name.split(' ') }))
			.sort((a, b) => b.words.length - a.words.length);
	}

	// Match the longest phrase from `phrases` at `pos`, allowing any run of
	// whitespace between words. Returns { name, end } or null.
	function _matchPhrase(text, pos, phrases) {
		for (let phrase of phrases) {
			let end = _matchWords(text, pos, phrase.words);
			if (end !== -1) {
				return { name: phrase.name, end };
			}
		}
		return null;
	}

	// Every phrase that matches at `pos`, longest first
	function _matchPhrases(text, pos, phrases) {
		let matches = [];
		for (let phrase of phrases) {
			let end = _matchWords(text, pos, phrase.words);
			if (end !== -1) {
				matches.push({ name: phrase.name, end });
			}
		}
		return matches;
	}

	function _matchWords(text, pos, words) {
		let at = pos;
		for (let i = 0; i < words.length; i++) {
			if (i) {
				let space = /^\s+/.exec(text.slice(at));
				if (!space) {
					return -1;
				}
				at += space[0].length;
			}
			let word = text.substr(at, words[i].length);
			if (word.toLowerCase() !== words[i]) {
				return -1;
			}
			at += word.length;
			// The phrase has to end at a word boundary
			if (i === words.length - 1 && at < text.length && !/[\s():]/.test(text[at])) {
				return -1;
			}
		}
		return at;
	}

	function _defaultOperator(field) {
		let preferred = DEFAULT_OPERATORS[field.condition];
		if (preferred && field.operators.includes(preferred)) {
			return preferred;
		}
		for (let operator of ['contains', 'is']) {
			if (field.operators.includes(operator)) {
				return operator;
			}
		}
		return field.operators[0];
	}

	// Parse a run of clauses, groups, and join words, stopping at a closing
	// paren when inside a group. Anything else is free text, kept as the text
	// that was typed rather than as reassembled tokens.
	function _parseSequence(state, inGroup) {
		let children = [];
		// The join word before each child, so `and` can bind tighter than `or`
		let joins = [];
		let closeRange = null;
		while (state.pos < state.tokens.length) {
			let token = state.tokens[state.pos];
			if (token.type === 'paren' && token.value === ')') {
				state.pos++;
				if (inGroup) {
					closeRange = [token.start, token.end];
					break;
				}
				state.ranges.push([token.start, token.end]);
				continue;
			}
			if (token.type === 'paren' && token.value === '(') {
				state.pos++;
				let group = _parseSequence(state, true);
				if (group.children.length) {
					children.push({ joinMode: group.joinMode, children: group.children });
				}
				else {
					// Parentheses around no clauses are part of the text
					state.ranges.push([token.start, token.end]);
					if (group.closeRange) {
						state.ranges.push(group.closeRange);
					}
				}
				continue;
			}
			if (token.type === 'join') {
				let joinMode = JOIN_WORDS[token.value.toLowerCase()];
				if (children.length) {
					joins[children.length] = joinMode;
				}
				state.pos++;
				// A value alone after `or` repeats the field of the clause
				// before it (see the tokenizer), so `tag is foo or bar` means
				// two tag conditions
				let next = state.tokens[state.pos];
				let previous = children[children.length - 1];
				if (next && next.type === 'value' && previous && !previous.children) {
					children.push({ ...previous, value: next.value });
					state.pos++;
				}
				continue;
			}
			// A clause whose value is still to come has nothing to match on, and
			// isn't text to search for either (see _readClauseTokens())
			if (token.type === 'field' && state.tokens[state.pos + 1].pending) {
				state.pending = true;
				state.pos += 2;
				continue;
			}
			let clause = _readClause(state);
			if (clause) {
				children.push(clause);
				continue;
			}
			state.ranges.push([token.start, token.end]);
			state.pos++;
		}
		return { ..._join(children, joins), closeRange };
	}

	// `and` binds tighter than `or`, as it does everywhere else, so
	// `a or b and c` is `a or (b and c)`. Runs of and-joined children become
	// nested groups, which the search supports.
	function _join(children, joins) {
		if (children.length < 2) {
			return { joinMode: 'all', children };
		}
		let runs = [[children[0]]];
		for (let i = 1; i < children.length; i++) {
			if (joins[i] === 'any') {
				runs.push([children[i]]);
			}
			else {
				runs[runs.length - 1].push(children[i]);
			}
		}
		if (runs.length === 1) {
			return { joinMode: 'all', children };
		}
		return {
			joinMode: 'any',
			children: runs.map(run => run.length === 1
				? run[0]
				: { joinMode: 'all', children: run })
		};
	}

	function _readClause(state) {
		let token = state.tokens[state.pos];
		if (!token) {
			return null;
		}
		// A prefix operator's token carries its resolved clause (see
		// _readPrefixClause())
		if (token.type === 'operator' && token.clause) {
			state.pos += 2;
			return { ...token.clause };
		}
		if (token.type !== 'field') {
			return null;
		}
		let field = Zotero.SearchQuery.getField(token.name);
		let operator = state.tokens[state.pos + 1].name;
		if (NAME_CONDITIONS.has(field.condition) && NAME_OPERATOR_OVERRIDES[operator]) {
			operator = NAME_OPERATOR_OVERRIDES[operator];
		}
		let clause = { condition: field.condition, operator, value: '' };
		if (UNARY.has(operator)) {
			state.pos += 2;
		}
		else {
			state.pos += 3;
			clause.value = state.tokens[state.pos - 1].value;
		}
		if (field.level) {
			clause.level = field.level;
		}
		return clause;
	}

	// The text that was typed for everything that wasn't a clause, with runs
	// that were adjacent in the input kept together
	function _freeText(state) {
		let merged = [];
		for (let range of state.ranges.slice().sort((a, b) => a[0] - b[0])) {
			let last = merged[merged.length - 1];
			if (last && last[1] === range[0]) {
				last[1] = range[1];
			}
			else {
				merged.push(range.slice());
			}
		}
		return merged.map(([start, end]) => state.text.slice(start, end)).join(' ');
	}
};
