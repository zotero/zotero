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
	this.AUTO_SYNC_DELAY = 15;
	this.__defineGetter__("MAX_TITLE_LENGTH", function() { return 120; });
	this.__defineGetter__("defaultNote", function () { return '<div class="zotero-note znv1"></div>'; });
	this.__defineGetter__("notePrefix", function () { return '<div class="zotero-note znv1">'; });
	this.__defineGetter__("noteSuffix", function () { return '</div>'; });
	
	this._editorInstances = [];
	
	/**
	* Return first line (or first MAX_LENGTH characters) of note content
	**/
	this.noteToTitle = function(text) {
		var origText = text;
		text = text.trim();
		text = text.replace(/<br\s*\/?>/g, ' ');
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
		let note = item.getNote();
		
		let parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser);
		let doc = parser.parseFromString(note, 'text/html');
		
		// Make sure this is the new note
		let metadataContainer = doc.querySelector('body > div[data-schema-version]');
		if (metadataContainer) {
			// Load base64 image data into src
			let nodes = doc.querySelectorAll('img[data-attachment-key]');
			for (let node of nodes) {
				let attachmentKey = node.getAttribute('data-attachment-key');
				if (attachmentKey) {
					let attachment = Zotero.Items.getByLibraryAndKey(item.libraryID, attachmentKey);
					if (attachment && attachment.parentID == item.id) {
						let dataURI = await attachment.attachmentDataURI;
						node.setAttribute('src', dataURI);
					}
				}
				node.removeAttribute('data-attachment-key');
			}
			
			// Set itemData for each citation citationItem
			nodes = doc.querySelectorAll('.citation[data-citation]');
			for (let node of nodes) {
				let citation = node.getAttribute('data-citation');
				try {
					citation = JSON.parse(decodeURIComponent(citation));
					for (let citationItem of citation.citationItems) {
						// Get itemData from existing item
						let item = await Zotero.EditorInstance.getItemFromURIs(citationItem.uris);
						if (item) {
							citationItem.itemData = Zotero.Cite.System.prototype.retrieveItem(item);
						}
						// Get itemData from note metadata container
						else {
							try {
								let items = JSON.parse(decodeURIComponent(metadataContainer.getAttribute('data-citation-items')));
								let item = items.find(item => item.uris.some(uri => citationItem.uris.includes(uri)));
								if (item) {
									citationItem.itemData = item.itemData;
								}
							}
							catch (e) {
							}
						}
						if (!citationItem.itemData) {
							node.replaceWith('(MISSING CITATION)');
							break;
						}
					}
					citation = encodeURIComponent(JSON.stringify(citation));
					node.setAttribute('data-citation', citation);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}
		return doc.body.innerHTML;
	};

	/**
	 * Download embedded images if they don't exist locally
	 *
	 * @param {Zotero.Item} item
	 * @returns {Promise<boolean>}
	 */
	this.ensureEmbeddedImagesAvailable = async function (item) {
		var attachments = Zotero.Items.get(item.getAttachments());
		for (let attachment of attachments) {
			let path = attachment.getFilePath();
			if (!path || !await OS.File.exists(path)) {
				let fileSyncingEnabled = Zotero.Sync.Storage.Local.getEnabledForLibrary(item.libraryID);
				if (!fileSyncingEnabled) {
					Zotero.debug('File sync is disabled');
					return false;
				}

				try {
					let results = await Zotero.Sync.Runner.downloadFile(attachment);
					if (!results || !results.localChanges) {
						Zotero.debug('Download failed');
						return false;
					}
				}
				catch (e) {
					Zotero.debug(e);
					return false;
				}
			}
		}
		return true;
	};

	/**
	 * Copy embedded images from one note to another and update
	 * item keys in note HTML.
	 *
	 * Must be called after copying a note
 	 *
	 * @param {Zotero.Item} fromNote
	 * @param {Zotero.Item} toNote
	 * @returns {Promise}
	 */
	this.copyEmbeddedImages = async function (fromNote, toNote) {
		Zotero.DB.requireTransaction();
		
		let attachments = Zotero.Items.get(fromNote.getAttachments());
		if (!attachments.length) {
			return;
		}

		let note = toNote.note;
		let parser = Components.classes['@mozilla.org/xmlextras/domparser;1']
			.createInstance(Components.interfaces.nsIDOMParser);
		let doc = parser.parseFromString(note, 'text/html');
	
		// Copy note image attachments and replace keys in the new note
		for (let attachment of attachments) {
			let copiedAttachment = await Zotero.Attachments.copyEmbeddedImage({ attachment, note: toNote });
			let node = doc.querySelector(`img[data-attachment-key="${attachment.key}"]`);
			if (node) {
				node.setAttribute('data-attachment-key', copiedAttachment.key);
			}
		}

		note = doc.body.innerHTML;
		note = note.trim();
		toNote.setNote(note);
		await toNote.save({ skipDateModifiedUpdate: true });
	};

	this.hasSchemaVersion = function (note) {
		let parser = Components.classes['@mozilla.org/xmlextras/domparser;1']
		.createInstance(Components.interfaces.nsIDOMParser);
		let doc = parser.parseFromString(note, 'text/html');
		return !!doc.querySelector('body > div[data-schema-version]');
	};

	/**
	 * Upgrade v1 notes:
	 * - Pull itemData from citations, highlights, images into metadata container
	 * - For `data-annotation` keep only the following fields:
	 *    - uri
	 *    - text
	 *    - color
	 *    - pageLabel
	 *    - position
	 *    - citationItem
	 * - Increase schema version number
	 *
	 * @param {Zotero.Item} item
	 * @returns {Promise<boolean>}
	 */
	this.upgradeSchemaV1 = async function (item) {
		let note = item.note;

		let parser = Components.classes['@mozilla.org/xmlextras/domparser;1']
		.createInstance(Components.interfaces.nsIDOMParser);
		let doc = parser.parseFromString(note, 'text/html');

		let metadataContainer = doc.querySelector('body > div[data-schema-version]');
		if (!metadataContainer) {
			return false;
		}

		let schemaVersion = parseInt(metadataContainer.getAttribute('data-schema-version'));
		if (schemaVersion !== 1) {
			return false;
		}
		
		let storedCitationItems = [];
		try {
			let data = JSON.parse(decodeURIComponent(metadataContainer.getAttribute('data-citation-items')));
			if (Array.isArray(data)) {
				storedCitationItems = data;
			}
		} catch (e) {
		}

		function pullItemData(citationItem) {
			let { uris, itemData } = citationItem;
			if (itemData) {
				delete citationItem.itemData;
				let item = storedCitationItems.find(item => item.uris.some(uri => uris.includes(uri)));
				if (!item) {
					storedCitationItems.push({ uris, itemData });
				}
			}
		}
		
		let nodes = doc.querySelectorAll('.citation[data-citation]');
		for (let node of nodes) {
			let citation = node.getAttribute('data-citation');
			try {
				citation = JSON.parse(decodeURIComponent(citation));
				citation.citationItems.forEach(citationItem => pullItemData(citationItem));
				citation = encodeURIComponent(JSON.stringify(citation));
				node.setAttribute('data-citation', citation);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}

		// img[data-annotation] and div.highlight[data-annotation]
		nodes = doc.querySelectorAll('*[data-annotation]');
		for (let node of nodes) {
			let annotation = node.getAttribute('data-annotation');
			try {
				annotation = JSON.parse(decodeURIComponent(annotation));
				if (annotation.citationItem) {
					pullItemData(annotation.citationItem);
				}
				annotation = {
					uri: annotation.uri,
					text: annotation.text,
					color: annotation.color,
					pageLabel: annotation.pageLabel,
					position: annotation.position,
					citationItem: annotation.citationItem
				};
				annotation = encodeURIComponent(JSON.stringify(annotation));
				node.setAttribute('data-annotation', annotation);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}

		if (storedCitationItems.length) {
			storedCitationItems = encodeURIComponent(JSON.stringify(storedCitationItems));
			metadataContainer.setAttribute('data-citation-items', storedCitationItems);
		}
		schemaVersion++;
		metadataContainer.setAttribute('data-schema-version', schemaVersion);
		note = doc.body.innerHTML;
		note = note.trim();
		item.setNote(note);
		await item.saveTx({ skipDateModifiedUpdate: true });
		return true;
	};
};

if (typeof process === 'object' && process + '' === '[object process]') {
	module.exports = Zotero.Notes;
}
