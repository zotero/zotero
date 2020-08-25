/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
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


Zotero.Notes = new function() {
	this.noteToTitle = noteToTitle;
	// Currently active editor instances
	this.editorInstances = [];
	
	
	this.__defineGetter__("MAX_TITLE_LENGTH", function() { return 120; });
	this.__defineGetter__("defaultNote", function () { return '<div class="zotero-note znv1"></div>'; });
	this.__defineGetter__("notePrefix", function () { return '<div class="zotero-note znv1">'; });
	this.__defineGetter__("noteSuffix", function () { return '</div>'; });
	
	Zotero.defineProperty(this, 'schemaVersion', {
		value: 1,
		writable: false
	});
	
	/**
	* Return first line (or first MAX_LENGTH characters) of note content
	**/
	function noteToTitle(text) {
		var origText = text;
		text = text.trim();
		text = Zotero.Utilities.unescapeHTML(text);
		
		// If first line is just an opening HTML tag, remove it
		//
		// Example:
		//
		// <blockquote>
		// <p>Foo</p>
		// </blockquote>
		if (/^<[^>\n]+[^\/]>\n/.test(origText)) {
			text = text.trim();
		}
		
		var max = this.MAX_TITLE_LENGTH;
		
		var t = text.substring(0, max);
		var ln = t.indexOf("\n");
		if (ln>-1 && ln<max) {
			t = t.substring(0, ln);
		}
		return t;
	}
	
	/**
	 * 	Replaces local URIs for citation and highlight nodes
	 *
	 * 	Must be called just before the initial sync,
	 * 	if called later the item version will be increased,
	 * 	which might be incovenient for the future (better) notes sync
	 *
	 * @param item Note item
	 * @returns {Promise}
	 */
	this.updateURIs = async (item) => {
		let html = item.getNote();
		let num = 0;
		// "uri":"http://zotero.org/users/local/(.+?)/items/(.+?)"
		let regex = new RegExp(/%22uri%22%3A%22http%3A%2F%2Fzotero.org%2Fusers%2Flocal%2F(.+?)%2Fitems%2F(.+?)%22/g);
		html = html.replace(regex, function (m, g1, g2) {
			num++;
			let libraryID = Zotero.URI.getURILibrary('http://zotero.org/users/local/' + g1);
			let libraryURI = Zotero.URI.getLibraryURI(libraryID);
			return encodeURIComponent('"uri":"' + libraryURI + '/items/' + g2 + '"');
		});
		if (num) {
			item.setNote(html);
			// Cut off saving for each editor instance for this item,
			// to make sure none of the editor instances will concurrently
			// overwrite our changes
			this.editorInstances.forEach(editorInstance => {
				if (editorInstance.item.id === item.id) {
					editorInstance.disableSaving = true;
				}
			});
			// Although, theoretically, a new editor instance with the old data can still
			// be created while asynchronous `item.saveTx` is in progress, but really unlikely

			// Observer notification will automatically recreate the affected editor instances
			await item.saveTx();
			Zotero.debug(`Updated URIs for item ${item.id}: ${num}`);
		}
	}
}

if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = Zotero.Notes;
}
