/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/


/*
 * Zotero.getCollections(parent)
 *
 * Returns an array of all collections are children of a collection
 * as Zotero.Collection instances
 *
 * Takes parent collectionID as optional parameter;
 * by default, returns root collections
 */
Zotero.getCollections = function(parent, recursive) {
	var toReturn = new Array();
	
	if (!parent) {
		parent = null;
	}
	
	var sql = "SELECT collectionID AS id, collectionName AS name FROM collections C "
		+ "WHERE parentCollectionID " + (parent ? '=' + parent : 'IS NULL');
	if (!parent) {
		sql += " AND libraryID IS NULL";
	}
	var children = Zotero.DB.query(sql);
	
	if (!children) {
		Zotero.debug('No child collections of collection ' + parent, 5);
		return toReturn;
	}
	
	// Do proper collation sort
	var collation = Zotero.getLocaleCollation();
	children.sort(function (a, b) {
		return collation.compareString(1, a.name, b.name);
	});
	
	for (var i=0, len=children.length; i<len; i++) {
		var obj = Zotero.Collections.get(children[i].id);
		if (!obj) {
			throw ('Collection ' + children[i].id + ' not found');
		}
		
		toReturn.push(obj);
		
		// If recursive, get descendents
		if (recursive) {
			var desc = obj.getDescendents(false, 'collection');
			for (var j in desc) {
				var obj2 = Zotero.Collections.get(desc[j]['id']);
				if (!obj2) {
					throw ('Collection ' + desc[j] + ' not found');
				}
				
				// TODO: This is a quick hack so that we can indent subcollections
				// in the search dialog -- ideally collections would have a
				// getLevel() method, but there's no particularly quick way
				// of calculating that without either storing it in the DB or
				// changing the schema to Modified Preorder Tree Traversal,
				// and I don't know if we'll actually need it anywhere else.
				obj2.level = desc[j].level;
				
				toReturn.push(obj2);
			}
		}
	}
	
	return toReturn;
}
