/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006-2016 Center for History and New Media
                          George Mason University, Fairfax, Virginia, USA
                          https://zotero.org
    
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

Zotero.SearchConditions = new function(){
	this.get = get;
	this.getStandardConditions = getStandardConditions;
	this.hasOperator = hasOperator;
	this.getLocalizedName = getLocalizedName;
	this.parseSearchString = parseSearchString;
	this.parseCondition = parseCondition;
	
	var _initialized = false;
	var _conditions;
	var _standardConditions;
	
	var self = this;
	
	/*
	 * Define the advanced search operators
	 */
	var _operators = {
		// Standard -- these need to match those in zoterosearch.xml
		is: true,
		isNot: true,
		beginsWith: true,
		contains: true,
		doesNotContain: true,
		isLessThan: true,
		isGreaterThan: true,
		isBefore: true,
		isAfter: true,
		isInTheLast: true,
		
		// Special
		any: true,
		all: true,
		true: true,
		false: true
	};
	
	
	/*
	 * Define and set up the available advanced search conditions
	 *
	 * Flags:
	 *  - special (don't show in search window menu)
	 *  - template (special handling)
	 *  - noLoad (can't load from saved search)
	 */
	this.init = Zotero.Promise.coroutine(function* () {
		var conditions = [
			//
			// Special conditions
			//
			{
				name: 'deleted',
				operators: {
					true: true,
					false: true
				}
			},
			
			// Don't include child items
			{
				name: 'noChildren',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'unfiled',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'retracted',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'publications',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'includeParentsAndChildren',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'includeParents',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'includeChildren',
				operators: {
					true: true,
					false: true
				}
			},
			
			// Search recursively within collections
			{
				name: 'recursive',
				operators: {
					true: true,
					false: true
				}
			},
			
			// Join mode
			{
				name: 'joinMode',
				operators: {
					any: true,
					all: true
				}
			},
			
			{
				name: 'quicksearch-titleCreatorYear',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				noLoad: true
			},
			
			{
				name: 'quicksearch-fields',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				noLoad: true
			},
			
			{
				name: 'quicksearch-everything',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				noLoad: true
			},
			
			// Deprecated
			{
				name: 'quicksearch',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				noLoad: true
			},
			
			// Quicksearch block markers
			{
				name: 'blockStart',
				noLoad: true
			},
			
			{
				name: 'blockEnd',
				noLoad: true
			},
			
			// Shortcuts for adding collections and searches by id
			{
				name: 'collectionID',
				operators: {
					is: true,
					isNot: true
				},
				noLoad: true
			},
			
			{
				name: 'savedSearchID',
				operators: {
					is: true,
					isNot: true
				},
				noLoad: true
			},
			
			
			//
			// Standard conditions
			//
			
			// Collection id to search within
			{
				name: 'collection',
				operators: {
					is: true,
					isNot: true
				},
				table: 'collectionItems',
				field: 'collectionID'
			},
			
			// Saved search to search within
			{
				name: 'savedSearch',
				operators: {
					is: true,
					isNot: true
				},
				special: true
			},
			
			{
				name: 'dateAdded',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true,
					isInTheLast: true
				},
				table: 'items',
				field: 'dateAdded'
			},
			
			{
				name: 'dateModified',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true,
					isInTheLast: true
				},
				table: 'items',
				field: 'dateModified'
			},
			
			// Deprecated
			{
				name: 'itemTypeID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'itemTypeID',
				special: true
			},
			
			{
				name: 'itemType',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'typeName'
			},
			
			{
				name: 'fileTypeID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'itemAttachments',
				field: 'fileTypeID'
			},
			
			{
				name: 'tagID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'itemTags',
				field: 'tagID',
				special: true
			},
			
			{
				name: 'tag',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemTags',
				field: 'name'
			},
			
			{
				name: 'note',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'itemNotes',
				// Exclude note prefix and suffix
				field: `SUBSTR(note, ${1 + Zotero.Notes.notePrefix.length}, `
					+ `LENGTH(note) - ${Zotero.Notes.notePrefix.length + Zotero.Notes.noteSuffix.length})`
			},
			
			{
				name: 'childNote',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'items',
				// Exclude note prefix and suffix
				field: `SUBSTR(note, ${1 + Zotero.Notes.notePrefix.length}, `
					+ `LENGTH(note) - ${Zotero.Notes.notePrefix.length + Zotero.Notes.noteSuffix.length})`
			},
			
			{
				name: 'creator',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemCreators',
				field: "TRIM(firstName || ' ' || lastName)"
			},
			
			{
				name: 'lastName',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemCreators',
				field: 'lastName',
				special: true
			},
			
			{
				name: 'field',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true,
					beginsWith: true
				},
				table: 'itemData',
				field: 'value',
				aliases: yield Zotero.DB.columnQueryAsync("SELECT fieldName FROM fieldsCombined "
					+ "WHERE fieldName NOT IN ('accessDate', 'date', 'pages', "
					+ "'section','seriesNumber','issue')"),
				template: true // mark for special handling
			},
			
			{
				name: 'datefield',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true,
					isInTheLast: true
				},
				table: 'itemData',
				field: 'value',
				aliases: ['accessDate', 'date', 'dateDue', 'accepted'], // TEMP - NSF
				template: true // mark for special handling
			},
			
			{
				name: 'year',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemData',
				field: 'SUBSTR(value, 1, 4)',
				special: true
			},
			
			{
				name: 'numberfield',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true,
					isLessThan: true,
					isGreaterThan: true
				},
				table: 'itemData',
				field: 'value',
				aliases: ['pages', 'numPages', 'numberOfVolumes', 'section', 'seriesNumber','issue'],
				template: true // mark for special handling
			},
			
			{
				name: 'libraryID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'libraryID',
				special: true,
				noLoad: true
			},
			
			{
				name: 'key',
				operators: {
					is: true,
					isNot: true,
					beginsWith: true
				},
				table: 'items',
				field: 'key',
				special: true,
				noLoad: true,
				inlineFilter: function (val) {
					return Zotero.Utilities.isValidObjectKey(val) ? `'${val}'` : false;
				}
			},
			
			{
				name: 'itemID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'itemID',
				special: true,
				noLoad: true
			},
			
			{
				name: 'annotation',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'annotations',
				field: 'text'
			},
			
			{
				name: 'fulltextWord',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'fulltextItemWords',
				field: 'word',
				flags: {
					leftbound: true
				},
				special: true
			},
			
			{
				name: 'fulltextContent',
				operators: {
					contains: true,
					doesNotContain: true
				},
				special: false
			},
			
			{
				name: 'tempTable',
				operators: {
					is: true
				}
			}
		];
		
		// Index conditions by name and aliases
		_conditions = {};
		for (var i in conditions) {
			_conditions[conditions[i]['name']] = conditions[i];
			if (conditions[i]['aliases']) {
				for (var j in conditions[i]['aliases']) {
					// TEMP - NSF
					switch (conditions[i]['aliases'][j]) {
						case 'dateDue':
						case 'accepted':
							if (!Zotero.ItemTypes.getID('nsfReviewer')) {
								continue;
							}
					}
					_conditions[conditions[i]['aliases'][j]] = conditions[i];
				}
			}
			_conditions[conditions[i]['name']] = conditions[i];
		}
		
		_standardConditions = [];
		
		var baseMappedFields = Zotero.ItemFields.getBaseMappedFields();
		var locale = Zotero.locale;
		
		// Separate standard conditions for menu display
		for (var i in _conditions){
			var fieldID = false;
			if (['field', 'datefield', 'numberfield'].indexOf(_conditions[i]['name']) != -1) {
				fieldID = Zotero.ItemFields.getID(i);
			}
			
			// If explicitly special...
			if (_conditions[i]['special'] ||
				// or a template master (e.g. 'field')...
				(_conditions[i]['template'] && i==_conditions[i]['name']) ||
				// or no table and not explicitly unspecial...
				(!_conditions[i]['table'] &&
					typeof _conditions[i]['special'] == 'undefined') ||
				// or field is a type-specific version of a base field...
				(fieldID && baseMappedFields.indexOf(fieldID) != -1)) {
				// ...then skip
				continue;
			}
			
			let localized = self.getLocalizedName(i);
			// Hack to use a different name for "issue" in French locale,
			// where 'number' and 'issue' are translated the same
			// https://forums.zotero.org/discussion/14942/
			if (Zotero.ItemFields.getName(fieldID) == 'issue' && locale.substr(0, 2) == 'fr') {
				localized = "Num\u00E9ro (p\u00E9riodique)";
			}
			
			_standardConditions.push({
				name: i,
				localized: localized,
				operators: _conditions[i]['operators'],
				flags: _conditions[i]['flags']
			});
		}
		
		var collation = Zotero.getLocaleCollation();
		_standardConditions.sort(function(a, b) {
			return collation.compareString(1, a.localized, b.localized);
		});
	});
	
	
	/*
	 * Get condition data
	 */
	function get(condition){
		return _conditions[condition];
	}
	
	
	/*
	 * Returns array of possible conditions
	 *
	 * Does not include special conditions, only ones that would show in a drop-down list
	 */
	function getStandardConditions(){
		// TODO: return copy instead
		return _standardConditions;
	}
	
	
	/*
	 * Check if an operator is valid for a given condition
	 */
	function hasOperator(condition, operator){
		var [condition, mode] = this.parseCondition(condition);
		
		if (!_conditions) {
			throw new Zotero.Exception.UnloadedDataException("Search conditions not yet loaded");
		}
		
		if (!_conditions[condition]){
			let e = new Error("Invalid condition '" + condition + "' in hasOperator()");
			e.name = "ZoteroInvalidDataError";
			throw e;
		}
		
		if (!operator && typeof _conditions[condition]['operators'] == 'undefined'){
			return true;
		}
		
		return !!_conditions[condition]['operators'][operator];
	}
	
	
	function getLocalizedName(str) {
		// TEMP
		if (str == 'itemType') {
			str = 'itemTypeID';
		}
		
		try {
			return Zotero.getString('searchConditions.' + str)
		}
		catch (e) {
			return Zotero.ItemFields.getLocalizedString(str);
		}
	}
	
	
	/**
	 * Compare two API JSON condition objects
	 */
	this.equals = function (data1, data2) {
		return data1.condition === data2.condition
			&& data1.operator === data2.operator
			&& data1.value === data2.value;
	}
	
	
	/*
	 * Parses a search into words and "double-quoted phrases"
	 *
	 * Also strips unpaired quotes at the beginning and end of words
	 *
	 * Returns array of objects containing 'text' and 'inQuotes'
	 */
	function parseSearchString(str) {
		var parts = str.split(/\s*("[^"]*")\s*|"\s|\s"|^"|"$|'\s|\s'|^'|'$|\s/m);
		var parsed = [];
		
		for (var i in parts) {
			var part = parts[i];
			if (!part || !part.length) {
				continue;
			}
			
			if (part.charAt(0)=='"' && part.charAt(part.length-1)=='"') {
				parsed.push({
					text: part.substring(1, part.length-1),
					inQuotes: true
				});
			}
			else {
				parsed.push({
					text: part,
					inQuotes: false
				});
			}
		}
		
		return parsed;
	}
	
	
	function parseCondition(condition){
		var mode = false;
		var pos = condition.indexOf('/');
		if (pos != -1){
			mode = condition.substr(pos+1);
			condition = condition.substr(0, pos);
		}
		
		return [condition, mode];
	}
}
