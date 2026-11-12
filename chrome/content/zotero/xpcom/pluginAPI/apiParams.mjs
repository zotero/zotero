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

const Params = {
	// A string from a fixed list; the message names the values, the path is the validator's
	oneOf: values => ({
		type: "string",
		checkHook: value => values.includes(value) || `must be one of ${values.join(", ")}, got ${value}`,
	}),

	intList: {
		type: "array",
		checkHook: value => value.every(Number.isInteger) || "every entry must be an integer",
	},

	nonEmptyString: {
		type: "string",
		checkHook: value => !!value.trim() || "must not be empty",
	},

	scalarOrObject: {
		type: "any",
		checkHook: value => value !== null && ["string", "number", "boolean", "object"].includes(typeof value)
			|| "must be a string, number, boolean or object",
	},
};

export { Params };
