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
	// that a query written anywhere can be read anywhere. An operator here
	// replaces the default the colon form would use, so `after:2020` means
	// dated after 2020 rather than `date is 2020`.
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
			for (let prop of Object.keys(Zotero.Annotations)) {
				let match = /^ANNOTATION_TYPE_(.+)$/.exec(prop);
				if (!match) {
					continue;
				}
				let name = match[1].toLowerCase();
				values[Zotero.getString('reader-' + name + '-annotation-short').toLowerCase()]
					= String(Zotero.Annotations[prop]);
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
	const NAME_OPERATOR_OVERRIDES = { is: 'contains', isNot: 'doesNotContain' };

	// A condition that matches a creator, which searching itemCreators gives
	// away
	function _isNameCondition(condition) {
		return Zotero.SearchConditions.get(condition)?.table == 'itemCreators';
	}

	// Operators can be several words, matched longest first so that "is not
	// empty" wins over "is not" and "is". A comparison also reads with an
	// extra "is" ("year is before 2020"), which only a condition that
	// compares takes that way -- `title is before` matches the word.
	//
	// These are the English forms, which keep working in every locale so that
	// a query written anywhere can be read anywhere. Each operator can also be
	// written the way the Advanced Search shows it, which is localized.
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

	// The same as a locale says them, each message a comma-separated list
	const PREFIX_OPERATOR_KEYWORDS = {
		'search-query-keyword-no': 'isEmpty',
		'search-query-keyword-has': 'isNotEmpty'
	};

	// Things an item can have some or none of, which the prefix operators
	// test as counts: `no annotation` means no annotations at all, not an
	// annotation with an empty field
	const PREFIX_COUNT_CONDITIONS = {
		annotation: 'numAnnotations',
		annotations: 'numAnnotations',
		note: 'numNotes',
		notes: 'numNotes',
		tag: 'numTags',
		tags: 'numTags',
		attachment: 'numAttachments',
		attachments: 'numAttachments'
	};

	// How each prefix operator compares a count
	const PREFIX_COUNT_COMPARISONS = {
		isEmpty: { operator: 'is', value: '0' },
		isNotEmpty: { operator: 'isGreaterThan', value: '0' }
	};

	// The count tests as whole phrases a locale can offer, each message a
	// comma-separated list: where English has `no notes`, German can offer
	// "keine notizen". The English forms above work in every locale.
	const COUNT_PHRASE_KEYWORDS = {
		'search-query-keyword-no-annotations':
			{ condition: 'numAnnotations', operator: 'is', value: '0' },
		'search-query-keyword-has-annotations':
			{ condition: 'numAnnotations', operator: 'isGreaterThan', value: '0' },
		'search-query-keyword-no-notes':
			{ condition: 'numNotes', operator: 'is', value: '0' },
		'search-query-keyword-has-notes':
			{ condition: 'numNotes', operator: 'isGreaterThan', value: '0' },
		'search-query-keyword-no-tags':
			{ condition: 'numTags', operator: 'is', value: '0' },
		'search-query-keyword-has-tags':
			{ condition: 'numTags', operator: 'isGreaterThan', value: '0' },
		'search-query-keyword-no-attachments':
			{ condition: 'numAttachments', operator: 'is', value: '0' },
		'search-query-keyword-has-attachments':
			{ condition: 'numAttachments', operator: 'isGreaterThan', value: '0' }
	};

	const JOIN_WORDS = { and: 'all', or: 'any' };

	const JOIN_KEYWORDS = {
		'search-query-keyword-and': 'all',
		'search-query-keyword-or': 'any'
	};

	const QUOTES = ['"', "'", '“', '‘'];
	const CLOSING_QUOTES = { '"': '"', "'": "'", '“': '”', '‘': '’' };

	// "3 days", "2 weeks" -- the value an isInTheLast condition stores, where
	// each unit is written as the date comparison understands it. Weeks are
	// counted in days, which is one of the units it has.
	const DURATION_UNITS = {
		day: 'day',
		days: 'day',
		week: 'week',
		weeks: 'week',
		month: 'month',
		months: 'month',
		year: 'year',
		years: 'year'
	};

	// The same as a locale says them, each message a comma-separated list of
	// every form someone would type
	const DURATION_KEYWORDS = {
		'search-query-keyword-days': 'day',
		'search-query-keyword-weeks': 'week',
		'search-query-keyword-months': 'month',
		'search-query-keyword-years': 'year'
	};

	// The range operators, and whether each one excludes the range
	const RANGE_OPERATORS = { isBetween: false, isNotBetween: true };

	// An end of a range: a year, a year and month, or a full date for a date
	// condition, a whole number for one that counts
	const RANGE_END_RE = /^(\d{1,4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;
	const COUNT_RE = /^\d+$/;

	// A range written as one word: `1970..2000` anywhere, and `1970-2000` for
	// years, which is two of them since a year is four digits and a month is
	// at most two
	const RANGE_DOTS_RE = /^([^.]+)\.\.([^.]+)$/;
	const RANGE_YEARS_RE = /^(\d{4})[-\u2013\u2014](\d{4})$/;

	// Punctuation between the ends, which reads the same in every locale
	const RANGE_MARKS_RE = /^\s*(?:\.\.|[-\u2013\u2014])\s*/;

	// The ways a range is written, each an example with its two ends filled
	// in: whatever comes before the first end opens the range, whatever comes
	// between the ends separates them, and whatever follows the second end
	// closes it. Written this way, each form keeps its own words together, so
	// `between 1970 and 2000` and `1970 to 2000` each read only as they're
	// said, and `and` separates ends only where it can't be joining clauses.
	const RANGE_FORMS = {
		isBetween: [
			'between 2020 and 2025',
			'is between 2020 and 2025',
			'from 2020 to 2025',
			'2020 to 2025'
		],
		isNotBetween: [
			'not between 2020 and 2025',
			'is not between 2020 and 2025'
		]
	};

	// The same as a locale says them, each message a comma-separated list
	const RANGE_KEYWORDS = {
		'search-query-keyword-range': 'isBetween',
		'search-query-keyword-range-excluded': 'isNotBetween'
	};

	// An example's two ends, which are numbers in whatever digits the locale
	// writes them in, and the words around them
	const RANGE_FORM_RE = /^(.*?)\p{Nd}+(.*?)\p{Nd}+(.*)$/u;

	// How a condition that compares reads a range: a date brackets with before
	// and after, a count with less than and greater than. `key` orders two
	// ends written at different granularities, and `step` gives the value just
	// outside an end, since the comparisons are exclusive.
	const RANGE_KINDS = {
		date: {
			lower: 'isAfter',
			upper: 'isBefore',
			key: _dateKey,
			step: _stepDate
		},
		count: {
			lower: 'isGreaterThan',
			upper: 'isLessThan',
			key: value => (COUNT_RE.test(value) ? parseInt(value) : null),
			step: (value, step) => (COUNT_RE.test(value) ? String(parseInt(value) + step) : null)
		}
	};

	var _fields = null;
	var _operators = null;
	var _prefixOperators = null;
	var _joinWords = null;
	var _durationUnits = null;
	var _rangeForms = null;
	var _fieldPhrases = null;
	var _operatorPhrases = null;
	var _durationPhrases = null;
	var _prefixOperatorPhrases = null;
	var _prefixCountPhrases = null;
	var _countPhrases = null;
	var _countPhrasePhrases = null;
	var _prefixContextRE = null;
	var _values = {};
	var _valuePhrases = {};
	var _operatorRE = null;

	// The words a locale offers for something, from a message that lists them
	// separated by commas
	function _localizedWords(l10nID) {
		let translated;
		try {
			translated = Zotero.ftl.formatValueSync(l10nID);
		}
		catch (e) {
			Zotero.logError(e);
		}
		return (translated || '').split(',')
			.map(word => word.trim().toLowerCase().replace(/\s+/g, ' '))
			.filter(Boolean);
	}

	// An operator as the Advanced Search shows it, which every locale
	// translates
	function _localizedOperator(operatorName) {
		try {
			// The two operators that take no value are in Fluent; the rest are
			// still in the properties file
			return UNARY.has(operatorName)
				? Zotero.ftl.formatValueSync('search-operator-' + operatorName)
				: Zotero.getString('searchOperator.' + operatorName);
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
	}

	// Every operator, by the English forms above, by the way the Advanced
	// Search shows it, and -- for a range -- by the word each form opens with
	function _getOperators() {
		if (_operators) {
			return _operators;
		}
		_operators = { ...OPERATOR_WORDS };
		let add = (name, operatorName) => {
			let key = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
			// A word that already means something else here keeps its meaning
			if (key && !_operators[key]) {
				_operators[key] = operatorName;
			}
		};
		for (let operatorName of new Set(Object.values(OPERATOR_WORDS))) {
			add(_localizedOperator(operatorName), operatorName);
		}
		for (let [opener, { operator }] of Object.entries(_getRangeForms().openers)) {
			add(opener, operator);
		}
		return _operators;
	}

	function _getPrefixOperators() {
		if (!_prefixOperators) {
			_prefixOperators = { ...PREFIX_OPERATORS };
			for (let [id, operatorName] of Object.entries(PREFIX_OPERATOR_KEYWORDS)) {
				for (let word of _localizedWords(id)) {
					if (!_prefixOperators[word]) {
						_prefixOperators[word] = operatorName;
					}
				}
			}
		}
		return _prefixOperators;
	}

	function _getJoinWords() {
		if (!_joinWords) {
			_joinWords = { ...JOIN_WORDS };
			for (let [id, joinMode] of Object.entries(JOIN_KEYWORDS)) {
				for (let word of _localizedWords(id)) {
					// Clauses are joined by a single word, so a phrase can't
					// be one
					if (!word.includes(' ') && !_joinWords[word]) {
						_joinWords[word] = joinMode;
					}
				}
			}
		}
		return _joinWords;
	}

	function _getDurationUnits() {
		if (!_durationUnits) {
			_durationUnits = { ...DURATION_UNITS };
			for (let [id, unit] of Object.entries(DURATION_KEYWORDS)) {
				for (let word of _localizedWords(id)) {
					if (!_durationUnits[word]) {
						_durationUnits[word] = unit;
					}
				}
			}
		}
		return _durationUnits;
	}

	// The range forms, read out of the examples they're given as: the words
	// around each end, keyed by the word the range opens with, or listed as
	// the forms that open with nothing and so read as a value would
	function _getRangeForms() {
		if (_rangeForms) {
			return _rangeForms;
		}
		_rangeForms = { openers: {}, bare: [] };
		let add = (example, operatorName) => {
			let parts = RANGE_FORM_RE.exec(example);
			if (!parts) {
				// The ends are what the words are read around, so a form
				// without them can't be read
				Zotero.warn(`Range form '${example}' doesn't give both ends as numbers`);
				return;
			}
			let [, opener, separator, trailing] = parts
				.map(part => part.trim().toLowerCase().replace(/\s+/g, ' '));
			// Ends with nothing between them can't be told apart
			if (!separator) {
				return;
			}
			// Not every locale puts spaces between words, so a form also reads
			// as one word
			let escape = words => words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			let form = {
				separator,
				trailing,
				compactRE: new RegExp('^(.+?)' + escape(separator) + '(.+?)'
					+ escape(trailing) + '$')
			};
			if (opener) {
				if (!_rangeForms.openers[opener]) {
					_rangeForms.openers[opener] = { operator: operatorName, forms: [] };
				}
				_rangeForms.openers[opener].forms.push(form);
			}
			// A range with nothing in front of it is written where a value
			// goes, so it reads with whatever operator the clause has, and an
			// excluded range has to say so
			else if (operatorName === 'isBetween') {
				_rangeForms.bare.push(form);
			}
		};
		for (let [operatorName, examples] of Object.entries(RANGE_FORMS)) {
			for (let example of examples) {
				add(example, operatorName);
			}
		}
		for (let [id, operatorName] of Object.entries(RANGE_KEYWORDS)) {
			for (let example of _localizedWords(id)) {
				add(example, operatorName);
			}
		}
		return _rangeForms;
	}

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
			? _getOperators()[split.operator]
			: (field.operator || _defaultOperator(field));
		let valueStart = split.valueStart + /^\s*/.exec(head.slice(split.valueStart))[0].length;
		return {
			field,
			operatorName,
			valueStart,
			// Whether the condition takes the operator: `type before boo`
			// names a condition and an operator but doesn't make a clause
			supported: _supportsOperator(field, operatorName)
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
		if (last.type === 'join' && _getJoinWords()[last.value.toLowerCase()] === 'any'
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
			if (join.type === 'join' && _getJoinWords()[join.value.toLowerCase()] === 'any'
					&& previous.type === 'value' && previous.field) {
				let field = self.getField(previous.field);
				return _valuesFor(self, field.condition, head, last.start, caret, openQuote);
			}
		}
		return null;
	}

	// The parameters the autocomplete search takes for a condition whose values
	// come from the library rather than a fixed list (see
	// zotero-autocomplete.mjs), or false for one that has neither. A creator
	// condition looks itself up, since its name is the creator type to match,
	// and takes both one- and two-field creators.
	function _valueLookup(condition) {
		if (condition == 'tag') {
			return { fieldName: 'tag' };
		}
		if (_isNameCondition(condition)) {
			return { fieldName: condition, fieldMode: 2 };
		}
		return false;
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
			let lookup = typed && _valueLookup(condition);
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
						let best = byCondition.get(clause.condition);
						if (!best || _isPreferredFieldName(name, best)) {
							byCondition.set(clause.condition, name);
						}
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
			let words = Object.keys(_getPrefixOperators())
				.sort((a, b) => b.length - a.length)
				.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				.join('|');
			_prefixContextRE = new RegExp('(?:^|[\\s(])(' + words + ')\\s+$', 'i');
		}
		let match = _prefixContextRE.exec(head);
		return match ? _getPrefixOperators()[match[1].toLowerCase()] : null;
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
			if (rest && Object.keys(_getOperators())
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
			let operators = Object.keys(_getOperators())
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
	 * @return {Object[]} - [{ type, value, start, end }], where type is
	 *     'field', 'operator', 'value', 'join', 'paren', 'text', or 'space'
	 */
	this.tokenize = function (text) {
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
			let field = _matchPhrase(text, pos, _fieldPhrases);
			let clause = field && _readClauseTokens(this, text, pos, field);
			if (!clause) {
				clause = _readPrefixClause(this, text, pos);
			}
			if (!clause) {
				clause = _readCountPhrase(text, pos);
			}
			if (clause) {
				tokens.push(...clause.tokens);
				pos = clause.end;
				continue;
			}

			let { value, end, quoted } = _readWord(text, pos);
			let isJoin = !quoted && _getJoinWords()[value.toLowerCase()];
			// `tag is foo or bar` repeats the field of the clause the `or`
			// directly follows, and the repeated value is read the same way
			// the first one was
			if (isJoin && _getJoinWords()[value.toLowerCase()] === 'any') {
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
				if (_supportsOperator(definition, _getOperators()[match.name])) {
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
			: _getOperators()[operator.name];
		if (!operatorName || !_supportsOperator(definition, operatorName)) {
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
		let value = _readValue(self, text, valueStart, definition, operatorName, operator.name);
		if (value && value.pending) {
			// The rest of a range is still to come, so the clause is
			// recognized but has nothing to match on yet
			tokens[tokens.length - 1].pending = true;
			tokens.push({
				type: 'value',
				value: text.slice(valueStart, value.end),
				field: field.name,
				operator: operatorName,
				start: operator.end,
				end: value.end,
				pending: true
			});
			return { tokens, end: value.end };
		}
		if (!value || !value.value) {
			return null;
		}
		let token = {
			type: 'value',
			value: value.value,
			field: field.name,
			operator: operatorName,
			start: operator.end,
			end: value.end,
			quoted: value.quoted
		};
		if (value.range) {
			token.range = value.range;
			token.operatorPhrase = operator.name;
		}
		tokens.push(token);
		return { tokens, end: value.end };
	}

	// A value is a word, a quoted string, a duration ("3 days"), or one of the
	// values the condition accepts, which can run to several words
	// ("book section")
	function _readValue(self, text, pos, definition, operatorName, operatorPhrase) {
		if (operatorName === 'isInTheLast') {
			let number = /^(\d+)\s*/.exec(text.slice(pos));
			let unit = number && _matchPhrase(text, pos + number[0].length, _durationPhrases);
			if (!unit) {
				return null;
			}
			let count = parseInt(number[1]);
			let name = _getDurationUnits()[unit.name];
			if (name === 'week') {
				count *= 7;
				name = 'day';
			}
			return { value: count + ' ' + name + 's', end: unit.end };
		}
		// A range, which only a condition that compares takes, so a hyphen or
		// a `to` stays part of the value everywhere else
		let range = _readRange(text, pos, definition, operatorName, operatorPhrase);
		if (range) {
			return range;
		}
		if (RANGE_OPERATORS.hasOwnProperty(operatorName)) {
			// `between` without a range after it doesn't make a clause
			return null;
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
		if (_looksLikeClause(text, valueStart) || _readPrefixClause(self, text, valueStart)
				|| _readCountPhrase(text, valueStart)) {
			return null;
		}
		let value = _readValue(self, text, valueStart, definition, previous.operator,
			previous.operatorPhrase);
		if (!value || !value.value) {
			return null;
		}
		let token = {
			type: 'value',
			value: value.value,
			field: previous.field,
			operator: previous.operator,
			start: pos,
			end: value.end,
			quoted: value.quoted
		};
		if (value.range) {
			token.range = value.range;
			token.operatorPhrase = previous.operatorPhrase;
		}
		return token;
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
		// On a child-scoped field, an empty-field test matches items that have
		// a child with the field empty, which isn't what `no` says, so `no`
		// doesn't apply there
		if (field.level && operatorName === 'isEmpty') {
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
	function _readPrefixClause(self, text, pos) {
		let prefix = _matchPhrase(text, pos, _prefixOperatorPhrases);
		if (!prefix || !/\s/.test(text[prefix.end] || '')) {
			return null;
		}
		let operatorEnd = prefix.end;
		let targetStart = operatorEnd + /^\s*/.exec(text.slice(operatorEnd))[0].length;
		let target = _matchPhrase(text, targetStart, _fieldPhrases)
			|| _matchPhrase(text, targetStart, _prefixCountPhrases);
		if (!target) {
			return null;
		}
		let clause = _resolvePrefixClause(self, _getPrefixOperators()[prefix.name], target.name);
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

	// A whole phrase a locale offers for a count test, read as a single token
	// that is a clause by itself
	function _readCountPhrase(text, pos) {
		let phrase = _matchPhrase(text, pos, _countPhrasePhrases);
		if (!phrase) {
			return null;
		}
		return {
			tokens: [{
				type: 'field',
				value: text.slice(pos, phrase.end),
				name: phrase.name,
				clause: { ..._countPhrases[phrase.name] },
				start: pos,
				end: phrase.end
			}],
			end: phrase.end
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
			_operatorPhrases = _phrasesByLength(Object.keys(_getOperators()));
			_prefixOperatorPhrases = _phrasesByLength(Object.keys(_getPrefixOperators()));
			_durationPhrases = _phrasesByLength(Object.keys(_getDurationUnits()));
			_prefixCountPhrases = _phrasesByLength(Object.keys(PREFIX_COUNT_CONDITIONS));
			_countPhrases = {};
			for (let [id, clause] of Object.entries(COUNT_PHRASE_KEYWORDS)) {
				let translated;
				try {
					translated = Zotero.ftl.formatValueSync(id);
				}
				catch (e) {
					Zotero.logError(e);
				}
				for (let phrase of (translated || '').split(',')) {
					phrase = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
					if (phrase && !_countPhrases[phrase]) {
						_countPhrases[phrase] = clause;
					}
				}
			}
			_countPhrasePhrases = _phrasesByLength(Object.keys(_countPhrases));
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
	 * @return {Object} - { tree, text }, where tree is
	 *     { joinMode, children: [...] } with children being clauses
	 *     ({ condition, operator, value }) or nested trees, and text is the
	 *     free text, in input order
	 */
	this.parse = function (text) {
		let tokens = this.tokenize(text).filter(token => token.type !== 'space');
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
	 * Free text is matched the way the given quick search mode matches text, so
	 * `by:smith crispr` filters by creator and searches the rest for "crispr"
	 * in whatever fields the mode covers.
	 *
	 * @param {String} query
	 * @param {Object} [options]
	 * @param {Number} [options.libraryID]
	 * @param {String} [options.mode] - A quick search mode
	 * @return {Zotero.Search|false}
	 */
	this.getSearch = function (query, { libraryID, mode } = {}) {
		let { tree, text } = this.parse(query);
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
			// A group that matches at a child level is scoped to it, so all of
			// its conditions match the same child
			if (node.level) {
				search.addCondition('resultLevel', node.level);
			}
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

	// How a field reads a range, or null for one that doesn't compare
	function _rangeKind(field) {
		if (field.operators.includes('isAfter') && field.operators.includes('isBefore')) {
			return RANGE_KINDS.date;
		}
		if (field.operators.includes('isGreaterThan') && field.operators.includes('isLessThan')) {
			return RANGE_KINDS.count;
		}
		return null;
	}

	// Whether a field takes an operator, counting the range operators, which
	// are made out of the comparisons rather than being operators themselves
	function _supportsOperator(field, operatorName) {
		return RANGE_OPERATORS.hasOwnProperty(operatorName)
			? !!_rangeKind(field)
			: field.operators.includes(operatorName);
	}

	// A date end padded out, so that ends written at different granularities
	// compare
	function _dateKey(value) {
		let parts = RANGE_END_RE.exec(value);
		return parts
			? Zotero.Utilities.lpad(parts[1], '0', 4)
				+ '-' + Zotero.Utilities.lpad(parts[2] || '0', '0', 2)
				+ '-' + Zotero.Utilities.lpad(parts[3] || '0', '0', 2)
			: null;
	}

	// The date just outside a given one, stepped at the granularity it was
	// written: a year by a year, a year and month by a month, a full date by
	// a day
	function _stepDate(value, step) {
		let parts = RANGE_END_RE.exec(value);
		if (!parts) {
			return null;
		}
		let year = parseInt(parts[1]);
		let month = parts[2] === undefined ? null : parseInt(parts[2]);
		let day = parts[3] === undefined ? null : parseInt(parts[3]);
		if ((month !== null && (month < 1 || month > 12))
				|| (day !== null && (day < 1 || day > 31))) {
			return null;
		}
		if (day !== null) {
			let date = new Date(0);
			date.setUTCFullYear(year, month - 1, day);
			// A day the month doesn't have is no date at all, rather than one
			// in the month after it
			if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
				return null;
			}
			date.setUTCDate(day + step);
			year = date.getUTCFullYear();
			month = date.getUTCMonth() + 1;
			day = date.getUTCDate();
		}
		else if (month !== null) {
			let months = year * 12 + month - 1 + step;
			year = Math.floor(months / 12);
			month = months % 12 + 1;
		}
		else {
			year += step;
		}
		if (year < 1) {
			return null;
		}
		return Zotero.Utilities.lpad(year, '0', 4)
			+ (month === null ? '' : '-' + Zotero.Utilities.lpad(month, '0', 2))
			+ (day === null ? '' : '-' + Zotero.Utilities.lpad(day, '0', 2));
	}

	// The two ends of a range and where it ends, or null if what's written
	// isn't one. Both ends are kept as written, along with the values just
	// outside them, since the comparisons a range becomes are exclusive.
	function _readRange(text, pos, definition, operatorName, operatorPhrase) {
		let kind = _rangeKind(definition);
		let spelled = RANGE_OPERATORS.hasOwnProperty(operatorName);
		if (!kind || (!spelled && !['is', 'isNot'].includes(operatorName))) {
			return null;
		}
		// Only the forms the range was opened with, so that each one's words
		// stay together
		let forms = spelled
			? _getRangeForms().openers[operatorPhrase]?.forms
			: _getRangeForms().bare;
		if (!forms) {
			return null;
		}
		let first = _readWord(text, pos);
		if (!first.value || first.quoted) {
			return null;
		}
		// A range written with `between` has no other reading, so one that
		// runs to the end of the query is still being typed
		let unfinished = () => (spelled && kind.key(first.value) !== null
			? { pending: true, end: text.length }
			: null);
		let from, to;
		let end = first.end;
		let compact = RANGE_DOTS_RE.exec(first.value) || RANGE_YEARS_RE.exec(first.value)
			|| _matchCompactForm(first.value, forms);
		if (compact) {
			[, from, to] = compact;
		}
		else {
			from = first.value;
			let separator = _matchRangeSeparator(text, first.end, forms);
			if (!separator) {
				return /^\s*$/.test(text.slice(first.end)) ? unfinished() : null;
			}
			let second = _readWord(text, separator.end);
			if (!second.value || second.quoted) {
				return second.value ? null : unfinished();
			}
			to = second.value;
			end = second.end;
			// The words the form closes with, for a locale that has any
			if (separator.trailing) {
				let closed = _matchWords(text, end + /^\s*/.exec(text.slice(end))[0].length,
					separator.trailing.split(' '));
				if (closed === -1) {
					return end === text.length ? unfinished() : null;
				}
				end = closed;
			}
		}
		let fromKey = kind.key(from);
		let toKey = kind.key(to);
		let below = kind.step(from, -1);
		let above = kind.step(to, 1);
		// Ends that aren't values to compare, that have nothing outside them
		// to compare against, or that don't make a range in the order they
		// were written, so what's there is something else -- or, at the end of
		// the query, an end still being typed
		if (fromKey === null || toKey === null || fromKey > toKey || !below || !above) {
			return end === text.length ? unfinished() : null;
		}
		return {
			value: text.slice(pos, end).trim().replace(/\s+/g, ' '),
			end,
			range: { from, to, below, above }
		};
	}

	// A whole range written as one word, the way a locale that doesn't space
	// its words writes one
	function _matchCompactForm(word, forms) {
		for (let form of forms) {
			let match = form.compactRE.exec(word);
			if (match) {
				return match;
			}
		}
		return null;
	}

	// What separates two ends: punctuation, which reads the same in every
	// locale, or the words of one of the forms the range was opened with
	function _matchRangeSeparator(text, pos, forms) {
		let marks = RANGE_MARKS_RE.exec(text.slice(pos));
		if (marks) {
			return { end: pos + marks[0].length, trailing: '' };
		}
		let space = /^\s+/.exec(text.slice(pos));
		if (!space) {
			return null;
		}
		let start = pos + space[0].length;
		let matched = null;
		// The longest separator wins, so one that begins another doesn't take
		// its place
		for (let form of forms) {
			let end = _matchWords(text, start, form.separator.split(' '));
			if (end !== -1 && (!matched || end > matched.end)) {
				matched = { end, trailing: form.trailing };
			}
		}
		if (!matched) {
			return null;
		}
		return {
			end: matched.end + /^\s*/.exec(text.slice(matched.end))[0].length,
			trailing: matched.trailing
		};
	}

	// The pair of comparisons a range becomes. They're exclusive, so each end
	// is compared against the value just outside it: between 1970 and 2000 is
	// after 1969 and before 2001. Excluding a range compares the ends as
	// written, and either one matching is enough.
	function _rangeNode(field, operatorName, range) {
		let kind = _rangeKind(field);
		let excluded = operatorName === 'isNot' || RANGE_OPERATORS[operatorName];
		let children = excluded
			? [
				{ condition: field.condition, operator: kind.upper, value: range.from },
				{ condition: field.condition, operator: kind.lower, value: range.to }
			]
			: [
				{ condition: field.condition, operator: kind.lower, value: range.below },
				{ condition: field.condition, operator: kind.upper, value: range.above }
			];
		let node = { joinMode: excluded ? 'any' : 'all', children };
		// Both comparisons are about the same child, so the level scopes the
		// pair rather than each of them, which would let two children each
		// match one end
		if (field.level) {
			node.level = field.level;
		}
		return node;
	}

	function _defaultOperator(field) {
		// A condition with a list of values to choose from, or a tag, has
		// discrete values rather than text to match within, so `tag:foo` means
		// the tag foo rather than tags containing "foo"
		let discrete = field.condition == 'tag' || !!VALUE_LOOKUPS[field.condition];
		if (discrete && field.operators.includes('is')) {
			return 'is';
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
				let joinMode = _getJoinWords()[token.value.toLowerCase()];
				if (children.length) {
					joins[children.length] = joinMode;
				}
				state.pos++;
				// A value alone after `or` repeats the field of the clause
				// before it (see the tokenizer), so `tag is foo or bar` means
				// two tag conditions
				let next = state.tokens[state.pos];
				let previous = children[children.length - 1];
				if (next && next.type === 'value' && previous) {
					children.push(_clauseFromValueToken(next));
					state.pos++;
				}
				continue;
			}
			// A clause whose value is still to come has nothing to match on, and
			// isn't text to search for either (see _readClauseTokens())
			if (token.type === 'field' && state.tokens[state.pos + 1]?.pending) {
				state.pending = true;
				state.pos += 2;
				// The end of a range that has been typed so far
				if (state.tokens[state.pos]?.pending) {
					state.pos++;
				}
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
		// A token carrying its resolved clause: a prefix operator, whose target
		// follows it, or a count phrase that is a clause by itself (see the
		// tokenizer)
		if (token.clause) {
			state.pos += token.type === 'operator' ? 2 : 1;
			return { ...token.clause };
		}
		if (token.type !== 'field') {
			return null;
		}
		let field = Zotero.SearchQuery.getField(token.name);
		let operator = state.tokens[state.pos + 1].name;
		if (NAME_OPERATOR_OVERRIDES[operator] && _isNameCondition(field.condition)) {
			operator = NAME_OPERATOR_OVERRIDES[operator];
		}
		let clause = { condition: field.condition, operator, value: '' };
		if (UNARY.has(operator)) {
			state.pos += 2;
		}
		else {
			state.pos += 3;
			let value = state.tokens[state.pos - 1];
			if (value.range) {
				return _rangeNode(field, operator, value.range);
			}
			clause.value = value.value;
		}
		if (field.level) {
			clause.level = field.level;
		}
		return clause;
	}

	// The clause a repeated value makes on its own, from the field and operator
	// its token carries. The clause it repeats can be a range, which is a
	// group rather than something to copy a value into.
	function _clauseFromValueToken(token) {
		let field = Zotero.SearchQuery.getField(token.field);
		if (token.range) {
			return _rangeNode(field, token.operator, token.range);
		}
		let operator = token.operator;
		if (NAME_OPERATOR_OVERRIDES[operator] && _isNameCondition(field.condition)) {
			operator = NAME_OPERATOR_OVERRIDES[operator];
		}
		let clause = { condition: field.condition, operator, value: token.value };
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
