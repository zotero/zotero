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
 * Splits a string by outer-most brackets (`{{` and '}}' by default, configurable).
 *
 * @param {string} input - The input string to split.
 * @returns {string[]} An array of strings split by outer-most brackets.
 */
export function splitByOuterBrackets(input, left = '{{', right = '}}') {
	const result = [];
	let startIndex = 0;
	let depth = 0;

	for (let i = 0; i < input.length; i++) {
		if (input.slice(i, i + 2) === left) {
			if (depth === 0) {
				result.push(input.slice(startIndex, i));
				startIndex = i;
			}
			depth++;
		}
		else if (input.slice(i, i + 2) === right) {
			depth--;
			if (depth === 0) {
				result.push(input.slice(startIndex, i + 2));
				startIndex = i + 2;
			}
		}
	}

	if (startIndex < input.length) {
		result.push(input.slice(startIndex));
	}

	return result;
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
	const hyphenToCamel = varName => varName.replace(/-(.)/g, (_, g1) => g1.toUpperCase());

	const getAttributes = (part) => {
		let attrsRegexp = new RegExp(/(([\w-]*) *=+ *(['"])((\\\3|[^\3])*?)\3)/g);
		let attrs = {};
		let match;
		while ((match = attrsRegexp.exec(part))) {
			if (match[1]) { // if first alternative (i.e. argument with value wrapped in " or ') matched, even if value is empty
				attrs[hyphenToCamel(match[2])] = match[4];
			}
		}
		return attrs;
	};

	
	const evaluateIdentifier = (ident, args = {}) => {
		ident = hyphenToCamel(ident);

		if (!(ident in vars)) {
			return '';
		}

		const identValue = typeof vars[ident] === 'function' ? vars[ident](args) : vars[ident];

		if (Array.isArray(identValue)) {
			return identValue.length ? identValue.join(',') : '';
		}

		if (typeof identValue !== 'string') {
			throw new Error(`Identifier "${ident}" does not evaluate to a string`);
		}
		
		return identValue;
	};
	
	// evaluates extracted (i.e. without brackets) statement (e.g. `sum a="1" b="2"`) into a string value
	const evaluateStatement = (statement) => {
		statement = statement.trim();
		const operator = statement.split(' ', 1)[0].trim();
		const args = statement.slice(operator.length).trim();

		return evaluateIdentifier(operator, getAttributes(args));
	};

	// splits raw (i.e. bracketed) statement (e.g. `{{ sum a="1" b="2" }}) into operator and arguments (e.g. ['sum', 'a="1" b="2"'])
	const splitStatement = (statement) => {
		statement = statement.slice(2, -2).trim();
		const operator = statement.split(' ', 1)[0].trim();
		const args = statement.slice(operator.length).trim();
		return [operator, args];
	};

	// We allow unquoted numbers in conditions, e.g. `a == 1` or `a == 1.0`  but not `a == 1.0.0` or `a == 1st edition`
	const asNumber = (string) => {
		if (typeof string === 'number') {
			return string;
		}
		const number = parseFloat(string);
		if (!Number.isNaN(number) && string?.trim().match(/^[+-]?\d+(\.\d+)?$/)) {
			return number;
		}
		return null;
	};

	// evaluates a condition (e.g. `a == "b"`) into a boolean value
	const evaluateCondition = (condition) => {
		const comparators = ['==', '!=', "<=", ">=", '<', '>'];
		condition = condition.trim();
		
		// Regular expression breakdown for condition matching:
		// - `match[1]`: Left operand if it's a statement enclosed in `{{...}}`.
		// - `match[3]`: Left operand if it's a string literal, extracted without quotes.
		// - `match[4]`: Left operand if it's a standalone identifier (e.g., a variable) or a number
		// - `match[6]`: Right operand if it's a statement enclosed in `{{...}}`.
		// - `match[8]`: Right operand if it's a string literal, extracted without quotes.
		// - `match[9]`: Right operand if it's a standalone identifier or a number.
		// - `match[2]` and `match[7]`: Captured quotes around string literals, used to ensure matching pairs.
		// - `match[5]`: The comparator (e.g., `==`, `!=`, `<`, `>`, etc.), extracted from `comparators.join('|')`.
		const match = condition.match(new RegExp(String.raw`(?:{{(.*?)}}|(?:(['"])(.*?)\2)|([^ ]+)) *(${comparators.join('|')}) *(?:{{(.*?)}}|(?:(['"])(.*?)\7)|([^ ]+))`));
		
		if (!match) {
			// condition is a statement or identifier without a comparator
			if (condition.startsWith('{{')) {
				const [operator, args] = splitStatement(condition);
				return !!evaluateIdentifier(operator, getAttributes(args));
			}
			return !!evaluateIdentifier(condition);
		}

		const left = match[1] ? evaluateStatement(match[1]) : match[3] ?? asNumber(match[4]) ?? evaluateIdentifier(match[4]) ?? '';
		const comparator = match[5];
		const right = match[6] ? evaluateStatement(match[6]) : match[8] ?? asNumber(match[9]) ?? evaluateIdentifier(match[9]) ?? '';

		switch (comparator) {
			default:
			case '==':
				return (asNumber(left) === null || asNumber(right === null)) ? left.toLowerCase() == right.toLowerCase() : asNumber(left) == asNumber(right);
			case '!=':
				return (asNumber(left) === null || asNumber(right === null)) ? left.toLowerCase() != right.toLowerCase() : asNumber(left) != asNumber(right);
			case ">=":
				return (asNumber(left) === null || asNumber(right === null)) ? left.toLowerCase() >= right.toLowerCase() : asNumber(left) >= asNumber(right);
			case "<=":
				return (asNumber(left) === null || asNumber(right === null)) ? left.toLowerCase() <= right.toLowerCase() : asNumber(left) <= asNumber(right);
			case '>':
				return (asNumber(left) === null || asNumber(right === null)) ? left.toLowerCase() > right.toLowerCase() : asNumber(left) > asNumber(right);
			case '<':
				return (asNumber(left) === null || asNumber(right === null)) ? left.toLowerCase() < right.toLowerCase() : asNumber(left) < asNumber(right);
		}
	};

	let html = '';
	const levels = [{ condition: true }];
	const parts = splitByOuterBrackets(template);

	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		let level = levels[levels.length - 1];

		if (part.startsWith('{{')) {
			const [operator, args] = splitStatement(part);
		
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
				const attrs = getAttributes(part);
				html += evaluateIdentifier(operator, attrs);
			}
		}
		else if (level.condition) {
			html += part;
		}
	}
	return html;
}
