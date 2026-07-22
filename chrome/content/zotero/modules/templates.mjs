/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2026 Corporation for Digital Scholarship
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

/**
 * Regular-expression source matching the body of a `quote`-delimited string: any run of
 * characters -- including newlines -- up to the closing quote. Backslashes are ordinary
 * characters (there is no escaping), so the first `quote` always closes the string. Shared by
 * the template tokenizer and the string-literal parser so they agree on what a string is.
 *
 * @param {String} quote - The delimiting quote character (`"` or `'`).
 * @returns {String} A regular-expression source fragment.
 */
function quotedStringBodySource(quote) {
	return `[^${quote}]*`;
}

/**
 * Match the body and closing quote of a string literal that opens at `str[i]` (which must be a
 * `"` or `'`), using the shared quoted-string grammar. The match's `[0]` spans everything after
 * the opening quote up to and including the closing quote.
 *
 * @param {String} str
 * @param {Number} i - Index of the opening quote within `str`.
 * @returns {Array|null} The RegExp match, or null if the string is never closed.
 */
function matchQuotedString(str, i) {
	let quote = str[i];
	return str.slice(i + 1).match(new RegExp('^' + quotedStringBodySource(quote) + quote));
}

/**
 * Scan a template (or a bracketed statement's interior) and yield one token per structural
 * element, so the tokenizer, validator and condition splitter share a single pass over the
 * `{{`/`}}` grammar instead of each re-implementing the quote-skipping and depth-tracking.
 *
 * Yields `{ type, start, end, depth }` tokens, where `type` is one of:
 *   - `text`   -- a run of ordinary characters; `depth` is the nesting level it sits in
 *   - `string` -- a quoted string consumed whole, so its `{{`/`}}` are not delimiters
 *   - `open`   -- a `{{`; `depth` is the level it opens from (0 at the top level)
 *   - `close`  -- a `}}`; `depth` is the level it returns to (negative for a stray closer)
 *
 * Quoted strings are recognized with the shared grammar. By default they are only recognized
 * inside a statement (depth > 0); pass `quotesAtDepthZero` for callers that scan a statement's
 * interior, where the top level is already inside a statement.
 *
 * @param {String} str
 * @param {Object} [options]
 * @param {Boolean} [options.quotesAtDepthZero=false] - Recognise quoted strings at depth 0 too.
 * @yields {Object} A `{ type, start, end, depth }` token.
 */
function* scanTemplateStructure(str, { quotesAtDepthZero = false } = {}) {
	let depth = 0;
	let textStart = 0;
	let i = 0;
	while (i < str.length) {
		if ((quotesAtDepthZero || depth > 0) && (str[i] === '"' || str[i] === "'")) {
			if (i > textStart) {
				yield { type: 'text', start: textStart, end: i, depth };
			}
			let match = matchQuotedString(str, i);
			// An unterminated quote swallows the rest, leaving any open `{{` unclosed
			let end = match ? i + match[0].length + 1 : str.length;
			yield { type: 'string', start: i, end, depth };
			i = end;
			textStart = i;
		}
		else if (str.slice(i, i + 2) === '{{') {
			if (i > textStart) {
				yield { type: 'text', start: textStart, end: i, depth };
			}
			yield { type: 'open', start: i, end: i + 2, depth };
			depth++;
			i += 2;
			textStart = i;
		}
		else if (str.slice(i, i + 2) === '}}') {
			if (i > textStart) {
				yield { type: 'text', start: textStart, end: i, depth };
			}
			depth--;
			yield { type: 'close', start: i, end: i + 2, depth };
			i += 2;
			textStart = i;
		}
		else {
			i++;
		}
	}
	if (str.length > textStart) {
		yield { type: 'text', start: textStart, end: str.length, depth };
	}
}

/**
 * Splits a template string by its outer-most `{{` and `}}` brackets, returning an array
 * of alternating literal-text and bracketed-statement parts (statements retain their braces).
 *
 * `{{` and `}}` that appear inside a quoted string literal within a statement are treated as
 * ordinary characters rather than delimiters, so a statement such as `{{ "{{" }}` is returned
 * as a single part.
 *
 * @param {String} input - The template string to split.
 * @returns {String[]} An array of text and bracketed-statement parts.
 */
export function parseTemplateBrackets(input) {
	let result = [];
	let startIndex = 0;
	
	for (let token of scanTemplateStructure(input)) {
		if (token.type === 'open' && token.depth === 0) {
			result.push(input.slice(startIndex, token.start));
			startIndex = token.start;
		}
		else if (token.type === 'close' && token.depth === 0) {
			result.push(input.slice(startIndex, token.end));
			startIndex = token.end;
		}
	}

	if (startIndex < input.length) {
		result.push(input.slice(startIndex));
	}

	return result;
}

/**
 * If the statement is a single quoted string literal (e.g. `"foo"` or `'foo'`), return its
 * unquoted contents; otherwise return null. Backslashes are ordinary characters, so the first
 * matching quote closes the literal.
 *
 * @param {String} statement - A `{{ }}` statement with its braces already stripped.
 * @returns {String|null}
 */
function parseStringLiteral(statement) {
	statement = statement.trim();
	let quote = statement[0];
	if (quote !== '"' && quote !== "'") {
		return null;
	}
	let match = statement.match(new RegExp(`^${quote}(${quotedStringBodySource(quote)})${quote}$`));
	return match ? match[1] : null;
}

/**
 * A basic templating engine
 *
 * - 'if' statement does case-insensitive string comparison
 * -  functions can be called from if statements but must be wrapped in {{}} if arguments are passed (e.g. {{myFunction arg1="foo" arg2="bar"}})
 *
 * Vars example:
 *  {
 * 	  color: '#ff6666',
 * 	  highlight: '<span class="highlight">This is a highlight</span>,
 *    comment: 'This is a comment',
 *    citation: '<span class="citation">(Author, 1900)</citation>',
 *    image: '<img src="…"/>',
 *    tags: (attrs) => ['tag1', 'tag2'].map(tag => tag.name).join(attrs.join || ' ')
 *  }
 *
 * Template example:
 *  {{if color == '#ff6666'}}
 *    <h2>{{highlight}}</h2>
 *  {{elseif color == '#2ea8e5'}}
 *    {{if comment}}<p>{{comment}}:</p>{{endif}}<blockquote>{{highlight}}</blockquote><p>{{citation}}</p>
 *  {{else}}
 *    <p>{{highlight}} {{citation}} {{comment}} {{if tags}} #{{tags join=' #'}}{{endif}}</p>
 *  {{endif}}
 *
 * @param {String} template
 * @param {Object} vars
 * @returns {String} HTML
 */
export function generateHTMLFromTemplate(template, vars) {
	let hyphenToCamel = varName => varName.replace(/-(.)/g, (_, g1) => g1.toUpperCase());

	let getAttributes = (part) => {
		// Match `name="value"` pairs, reusing the shared string-literal grammar for the value
		// so quote and newline handling stay in lockstep with the rest of the engine
		let dq = quotedStringBodySource('"');
		let sq = quotedStringBodySource("'");
		let attrsRegexp = new RegExp(String.raw`([\w-]*) *=+ *(?:"(${dq})"|'(${sq})')`, 'g');
		let attrs = {};
		let match;
		while ((match = attrsRegexp.exec(part))) {
			// Exactly one quote branch matches; an empty value ('') is preserved
			attrs[hyphenToCamel(match[1])] = match[2] ?? match[3];
		}
		return attrs;
	};

	
	let evaluateIdentifier = (ident, args = {}) => {
		// A missing operand (e.g. an empty `{{}}` used in a comparison) has no identifier
		if (typeof ident !== 'string') {
			return '';
		}
		ident = hyphenToCamel(ident);

		if (!(ident in vars)) {
			return '';
		}

		let identValue = typeof vars[ident] === 'function' ? vars[ident](args) : vars[ident];

		if (Array.isArray(identValue)) {
			return identValue.length ? identValue.join(',') : '';
		}

		if (typeof identValue !== 'string') {
			throw new Error(`Identifier "${ident}" does not evaluate to a string`);
		}
		
		return identValue;
	};
	
	// evaluates extracted (i.e. without brackets) statement (e.g. `sum a="1" b="2"`) into a string value
	let evaluateStatement = (statement) => {
		statement = statement.trim();
		// A bare string literal evaluates to its contents, matching how the top-level loop renders
		// `{{ "x" }}`, so a nested statement is consistent whether at the top level or in a condition
		let literal = parseStringLiteral(statement);
		if (literal !== null) {
			return literal;
		}
		let operator = statement.split(/\s+/, 1)[0];
		let args = statement.slice(operator.length).trim();

		return evaluateIdentifier(operator, getAttributes(args));
	};

	// splits raw (i.e. bracketed) statement (e.g. `{{ sum a="1" b="2" }}) into operator and arguments (e.g. ['sum', 'a="1" b="2"'])
	let splitStatement = (statement) => {
		statement = statement.slice(2, -2).trim();
		let operator = statement.split(/\s+/, 1)[0];
		let args = statement.slice(operator.length).trim();
		return [operator, args];
	};

	// We allow unquoted numbers in conditions, e.g. `a == 1` or `a == 1.0`  but not `a == 1.0.0` or `a == 1st edition`
	let asNumber = (string) => {
		if (typeof string === 'number') {
			return string;
		}
		let number = parseFloat(string);
		if (!Number.isNaN(number) && string?.trim().match(/^[+-]?\d+(\.\d+)?$/)) {
			return number;
		}
		return null;
	};

	// evaluates a single operand (nested statement, string literal, identifier or number)
	let evaluateOperand = (operand) => {
		operand = operand.trim();
		if (operand.startsWith('{{') && operand.endsWith('}}')) {
			return evaluateStatement(operand.slice(2, -2));
		}
		let literal = parseStringLiteral(operand);
		if (literal !== null) {
			return literal;
		}
		return asNumber(operand) ?? evaluateIdentifier(operand) ?? '';
	};

	// evaluates a condition (e.g. `a == "b"`) into a boolean value
	let evaluateCondition = (condition) => {
		let comparators = ['==', '!=', "<=", ">=", '<', '>'];
		condition = condition.trim();
		
		// Find the top-level comparator in `cond`, skipping quoted strings (via the shared
		// string grammar) and nested `{{...}}` statements, so a `}}`, quote or comparator
		// inside a quoted operand argument is never mistaken for template structure. The
		// condition is a statement interior, so quotes are recognized at depth 0 too.
		let splitCondition = (cond) => {
			for (let token of scanTemplateStructure(cond, { quotesAtDepthZero: true })) {
				if (token.type !== 'text' || token.depth !== 0) {
					continue;
				}
				for (let i = token.start; i < token.end; i++) {
					for (let comparator of comparators) {
						if (cond.startsWith(comparator, i)) {
							return {
								left: cond.slice(0, i),
								comparator,
								right: cond.slice(i + comparator.length),
							};
						}
					}
				}
			}
			return null;
		};

		// Unwrap a `{{ }}` that spans the whole condition when its interior holds a comparison
		// (e.g. `{{ authorsCount == "2" }}`), so it's evaluated as one; a wrapped function call
		// without a comparator (e.g. `{{ myFn arg="x" }}`) is left for the truthiness path below
		let wrapping = parseTemplateBrackets(condition);
		while (wrapping.length === 2 && wrapping[1] === condition && splitCondition(condition.slice(2, -2).trim())) {
			condition = condition.slice(2, -2).trim();
			wrapping = parseTemplateBrackets(condition);
		}

		let split = splitCondition(condition);
		
		if (!split) {
			// condition is a statement or identifier without a comparator
			if (condition.startsWith('{{')) {
				return !!evaluateStatement(condition.slice(2, -2));
			}
			return !!evaluateIdentifier(condition);
		}

		let left = evaluateOperand(split.left);
		let comparator = split.comparator;
		let right = evaluateOperand(split.right);

		// Compare numerically only when both operands are numeric; otherwise compare
		// case-insensitively as strings, coercing a bare number back to a string
		let leftNumber = asNumber(left);
		let rightNumber = asNumber(right);
		let bothNumbers = leftNumber !== null && rightNumber !== null;
		let leftValue = bothNumbers ? leftNumber : String(left).toLowerCase();
		let rightValue = bothNumbers ? rightNumber : String(right).toLowerCase();

		switch (comparator) {
			default:
			case '==':
				return leftValue == rightValue;
			case '!=':
				return leftValue != rightValue;
			case ">=":
				return leftValue >= rightValue;
			case "<=":
				return leftValue <= rightValue;
			case '>':
				return leftValue > rightValue;
			case '<':
				return leftValue < rightValue;
		}
	};

	let html = '';
	let levels = [{ condition: true }];
	let parts = parseTemplateBrackets(template);

	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		let level = levels[levels.length - 1];

		if (part.startsWith('{{')) {
			let [operator, args] = splitStatement(part);
		
			if (operator === 'if') {
				level = { condition: false, executed: false, parentCondition: levels[levels.length - 1].condition };
				levels.push(level);
			}
			if (['if', 'elseif'].includes(operator)) {
				if (!level.executed) {
					level.condition = level.parentCondition && evaluateCondition(args);
					level.executed = level.condition;
				}
				else {
					level.condition = false;
				}
				continue;
			}
			else if (operator === 'else') {
				level.condition = level.parentCondition && !level.executed;
				level.executed = level.condition;
				continue;
			}
			else if (operator === 'endif') {
				// Don't pop the base level for an unbalanced {{endif}} (i.e. one without a matching
				// {{if}}), which would leave `levels` empty and cause `level` to be undefined on the
				// next iteration
				if (levels.length > 1) {
					levels.pop();
				}
				continue;
			}
			if (level.condition) {
				let literal = parseStringLiteral(part.slice(2, -2));
				if (literal !== null) {
					html += literal;
				}
				else {
					let attrs = getAttributes(part);
					html += evaluateIdentifier(operator, attrs);
				}
			}
		}
		else if (level.condition) {
			html += part;
		}
	}
	return html;
}

/**
 * Check whether a template is well-formed -- its `{{`/`}}` brackets are matched (ignoring
 * braces inside string literals) and its {{if}}/{{endif}} blocks are balanced. Syntactic check only.
 *
 * @param {String} template
 * @returns {Boolean} True if the template is well-formed, false if it is malformed
 */
export function isTemplateValid(template) {
	if (typeof template !== 'string') {
		return false;
	}
	let depth = 0;
	let statementStart = 0;
	// One entry per open {{if}} block, tracking whether its {{else}} has been seen
	let levels = [];
	for (let token of scanTemplateStructure(template)) {
		if (token.type === 'open') {
			if (depth === 0) {
				statementStart = token.start;
			}
			depth++;
		}
		else if (token.type === 'close') {
			// A `}}` with no open `{{` is a stray closer
			if (depth === 0) {
				return false;
			}
			depth--;
			// A nested `{{ }}` is part of its statement's text; only validate complete
			// top-level statements
			if (depth > 0) {
				continue;
			}
			let statement = template.slice(statementStart + 2, token.start).trim();
			let operator = statement.split(/\s+/, 1)[0];
			let level = levels[levels.length - 1];
			switch (operator) {
				case 'if':
					// An empty condition is allowed: it evaluates to false (forcing any {{else}}),
					// which the engine has always rendered, so keep such templates valid
					levels.push({ seenElse: false });
					break;
				case 'elseif':
					// An elseif outside of an if block, or after that block's else, is unbalanced
					if (!level || level.seenElse) {
						return false;
					}
					break;
				case 'else':
					// An else outside of an if block, or a second else in the same block, is unbalanced
					if (!level || level.seenElse) {
						return false;
					}
					level.seenElse = true;
					break;
				case 'endif':
					// An endif without a matching if is unbalanced
					if (!level) {
						return false;
					}
					levels.pop();
					break;
				default:
					// A statement beginning with a quote must be a well-formed string literal;
					// anything else (e.g. `"x" y="z"`) is malformed
					if ((statement.startsWith('"') || statement.startsWith("'"))
							&& parseStringLiteral(statement) === null) {
						return false;
					}
			}
		}
	}
	// An unclosed `{{` leaves depth > 0; any unmatched {{if}} leaves a level open
	return depth === 0 && levels.length === 0;
}
