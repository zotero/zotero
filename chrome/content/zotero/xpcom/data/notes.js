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
	this._editorInstances = [];
	
	this.__defineGetter__("MAX_TITLE_LENGTH", function() { return 120; });
	this.__defineGetter__("defaultNote", function () { return '<div class="zotero-note znv1"></div>'; });
	this.__defineGetter__("notePrefix", function () { return '<div class="zotero-note znv1">'; });
	this.__defineGetter__("noteSuffix", function () { return '</div>'; });
	
	/**
	* Return first line (or first MAX_LENGTH characters) of note content
	**/
	this.noteToTitle = function(text) {
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
	};
	
	this.registerEditorInstance = function(instance) {
		this._editorInstances.push(instance);
	};
	
	this.unregisterEditorInstance = async function(instance) {
		// Make sure the editor instance is not unregistered while
		// Zotero.Notes.updateUser is in progress, otherwise the
		// instance might not get the`disableSaving` flag set
		await Zotero.DB.executeTransaction(async () => {
			let index = this._editorInstances.indexOf(instance);
			if (index >= 0) {
				this._editorInstances.splice(index, 1);
			}
		});
	};

	/**
	 * Replace local URIs for citations and highlights
	 * in all notes. Cut-off note saving for the opened
	 * notes and then trigger notification to refresh
	 *
	 * @param {Number} fromUserID
	 * @param {Number} toUserID
	 * @returns {Promise<void>}
	 */
	this.updateUser = async function (fromUserID, toUserID) {
		if (!fromUserID) {
			fromUserID = 'local%2F' + Zotero.Users.getLocalUserKey();
		}
		if (!toUserID) {
			throw new Error('Invalid target userID ' + toUserID);
		}
		Zotero.DB.requireTransaction();

		// `"http://zotero.org/users/${fromUserID}/items/`
		let from = `%22http%3A%2F%2Fzotero.org%2Fusers%2F${fromUserID}%2Fitems%2F`;
		// `"http://zotero.org/users/${toUserId}/items/`
		let to = `%22http%3A%2F%2Fzotero.org%2Fusers%2F${toUserID}%2Fitems%2F`;
		let sql = `UPDATE itemNotes SET note=REPLACE(note, '${from}', '${to}')`;
		await Zotero.DB.queryAsync(sql);

		// Disable saving for each editor instance to make sure none
		// of the instances can overwrite our changes
		this._editorInstances.forEach(x => x.disableSaving = true);

		let idsToRefresh = [];
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('item');
		let loadedObjects = objectsClass.getLoaded();
		for (let object of loadedObjects) {
			if (object.isNote()) {
				idsToRefresh.push(object.id);
				await object.reload(['note'], true);
			}
		}

		Zotero.DB.addCurrentCallback('commit', async () => {
			await Zotero.Notifier.trigger('refresh', 'item', idsToRefresh);
		});
	};
	
	this.getExportableNote = async function(item) {
		if (!item.isNote()) {
			throw new Error('Item is not a note');
		}
		var note = item.getNote();
		
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser);
		var doc = parser.parseFromString(note, 'text/html');
		
		var nodes = doc.querySelectorAll('img[data-attachment-key]');
		for (var node of nodes) {
			var attachmentKey = node.getAttribute('data-attachment-key');
			if (attachmentKey) {
				var attachment = Zotero.Items.getByLibraryAndKey(item.libraryID, attachmentKey);
				if (attachment && attachment.parentID == item.id) {
					var dataURI = await attachment.attachmentDataURI;
					node.setAttribute('src', dataURI);
				}
			}
			node.removeAttribute('data-attachment-key');
		}
		return doc.body.innerHTML;
	};

	this.hasSchemaVersion = function (note) {
		let parser = Components.classes['@mozilla.org/xmlextras/domparser;1']
		.createInstance(Components.interfaces.nsIDOMParser);
		let doc = parser.parseFromString(note, 'text/html');
		return !!doc.querySelector('body > div[data-schema-version]');
	};
};

if (typeof process === 'object' && process + '' === '[object process]') {
	module.exports = Zotero.Notes;
}
