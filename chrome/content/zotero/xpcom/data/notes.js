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
	// Keep in sync with utilities_item.js::noteToTitle() in zotero/utilities
	this.__defineGetter__("MAX_TITLE_LENGTH", function() { return 120; });
	this.__defineGetter__("defaultNote", function () { return '<div class="zotero-note znv1"></div>'; });
	this.__defineGetter__("notePrefix", function () { return '<div class="zotero-note znv1">'; });
	this.__defineGetter__("noteSuffix", function () { return '</div>'; });
	
	this._editorInstances = [];
	this._downloadInProgressPromise = null;
	
	this.noteToTitle = function(text) {
		Zotero.debug(`Zotero.Note.noteToTitle() is deprecated -- use Zotero.Utilities.Item.noteToTitle() instead`);
		return Zotero.Utilities.Item.noteToTitle(text);
	};
	
	this.registerEditorInstance = function(instance) {
		this._editorInstances.push(instance);
	};
	
	this.unregisterEditorInstance = async function(instance) {
		// Make sure the editor instance is not unregistered while
		// Zotero.Notes.updateUser is in progress, otherwise the
		// instance might not get the`disableSaving` flag set
		await Zotero.DB.executeTransaction(async () => {
			this._editorInstances = this._editorInstances.filter(x => x !== instance);
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

	/**
	 * Update item key URLs in the item's note, replacing all instances of each
	 * key in itemKeyMap with the associated value.
	 * Passed item should have an embedded note or be a note item.
	 *
	 * @param {Zotero.Item} item
	 * @param {Map<String, String>} itemKeyMap
	 */
	this.replaceAllItemKeys = function (item, itemKeyMap) {
		let note = item.getNote();
		let keys = [...itemKeyMap.keys()].join('|');
		let re = new RegExp(`%2Fitems%2F(${keys})`, 'g');
		note = note.replace(re, (str, key) => `%2Fitems%2F${itemKeyMap.get(key)}`);
		re = new RegExp(`data-attachment-key="(${keys})"`);
		note = note.replace(re, (str, key) => `data-attachment-key="${itemKeyMap.get(key)}"`);
		item.setNote(note);
	};

	/**
	 * Convenience function to call replaceAllItemKeys with a single key-value pair.
	 *
	 * @param {Zotero.Item} item
	 * @param {String} fromItemKey
	 * @param {String} toItemKey
	 */
	this.replaceItemKey = function (item, fromItemKey, toItemKey) {
		this.replaceAllItemKeys(item, new Map([[fromItemKey, toItemKey]]));
	};

	this.getExportableNote = async function(item) {
		if (!item.isNote()) {
			throw new Error('Item is not a note');
		}
		let note = item.getNote();
		
		let parser = new DOMParser();
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

			nodes = doc.querySelectorAll('span[style]');
			for (let node of nodes) {
				// Browser converts #RRGGBBAA hex color to rgba function, and we convert it to rgb function,
				// because word processors don't understand colors with alpha channel
				if (node.style.backgroundColor && node.style.backgroundColor.startsWith('rgba')) {
					node.style.backgroundColor = node.style.backgroundColor
						.replace('rgba', 'rgb')
						.split(',')
						.slice(0, 3)
						.join(',') + ')';
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
	this.ensureEmbeddedImagesAreAvailable = async function (item) {
		let resolvePromise = () => {};
		if (this._downloadInProgressPromise) {
			await this._downloadInProgressPromise;
		}
		else {
			this._downloadInProgressPromise = new Promise((resolve) => {
				resolvePromise = () => {
					this._downloadInProgressPromise = null;
					resolve();
				};
			});
		}
		try {
			var attachments = Zotero.Items.get(item.getAttachments());
			for (let attachment of attachments) {
				let path = await attachment.getFilePathAsync();
				if (!path) {
					Zotero.debug(`Image file not found for item ${attachment.key}. Trying to download`);
					let fileSyncingEnabled = Zotero.Sync.Storage.Local.getEnabledForLibrary(item.libraryID);
					if (!fileSyncingEnabled) {
						Zotero.debug('File sync is disabled');
						resolvePromise();
						return false;
					}

					try {
						let results = await Zotero.Sync.Runner.downloadFile(attachment);
						if (!results || !results.localChanges) {
							Zotero.debug('Download failed');
							resolvePromise();
							return false;
						}
					}
					catch (e) {
						Zotero.debug(e);
						resolvePromise();
						return false;
					}
				}
			}
		}
		catch (e) {
			Zotero.debug(e);
			resolvePromise();
			return false;
		}

		resolvePromise();
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
		let parser = new DOMParser();
		let doc = parser.parseFromString(note, 'text/html');
	
		// Copy note image attachments and replace keys in the new note
		for (let attachment of attachments) {
			if (await attachment.fileExists()) {
				let copiedAttachment = await Zotero.Attachments.copyEmbeddedImage({ attachment, note: toNote });
				let node = doc.querySelector(`img[data-attachment-key="${attachment.key}"]`);
				if (node) {
					node.setAttribute('data-attachment-key', copiedAttachment.key);
				}
			}
		}
		toNote.setNote(doc.body.innerHTML);
		await toNote.save({ skipDateModifiedUpdate: true });
	};
	
	this.promptToIgnoreMissingImage = function () {
		let ps = Services.prompt;
		let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		let index = ps.confirmEx(
			null,
			Zotero.getString('general.warning'),
			Zotero.getString('pane.item.notes.ignoreMissingImage'),
			buttonFlags,
			Zotero.getString('general.continue'),
			null, null, null, {}
		);
		return !index;
	};
	
	this.deleteUnusedEmbeddedImages = async function (item) {
		if (!item.isNote()) {
			throw new Error('Item is not a note');
		}
		
		if (this._editorInstances.some(x => x._item && x._item.id === item.id)) {
			return;
		}
		
		let note = item.getNote();
		let parser = new DOMParser();
		let doc = parser.parseFromString(note, 'text/html');
		
		let keys = Array.from(doc.querySelectorAll('img[data-attachment-key]'))
			.map(node => node.getAttribute('data-attachment-key'));

		let attachments = Zotero.Items.get(item.getAttachments());
		for (let attachment of attachments) {
			if (!keys.includes(attachment.key)) {
				await attachment.eraseTx();
			}
		}
	};

	this.hasSchemaVersion = function (note) {
		let parser = new DOMParser();
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

		let parser = new DOMParser();
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
		item.setNote(doc.body.innerHTML);
		await item.saveTx({ skipDateModifiedUpdate: true });
		return true;
	};
};

if (typeof process === 'object' && process + '' === '[object process]') {
	module.exports = Zotero.Notes;
}
