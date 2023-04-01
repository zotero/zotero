/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
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


"use strict";

{
	class AttachmentBox extends XULElement {
		constructor() {
			super();

			this.editable = false;
			this.clickableLink = false;
			this.displayButton = false;
			this.displayNote = false;

			this.buttonCaption = null;
			this.clickHandler = null;

			this._mode = "view";

			this._item = null;

			this.content = MozXULElement.parseXULToFragment(`
				<vbox id="attachment-box" flex="1" orient="vertical"
						xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
						xmlns:html="http://www.w3.org/1999/xhtml">
					<vbox id="metadata">
						<label id="title"/>
						<label id="url" crop="end"
							ondragstart="var dt = event.dataTransfer; dt.setData('text/x-moz-url', this.value); dt.setData('text/uri-list', this.value); dt.setData('text/plain', this.value);"/>
						<html:table>
							<html:tr id="fileNameRow">
								<html:td><label id="fileName-label"/></html:td>
								<html:td><label id="fileName" crop="end"/></html:td>
							</html:tr>
							<html:tr id="accessedRow">
								<html:td><label id="accessed-label"/></html:td>
								<html:td><label id="accessed"/></html:td>
							</html:tr>
							<html:tr id="pagesRow">
								<html:td><label id="pages-label"/></html:td>
								<html:td><label id="pages"/></html:td>
							</html:tr>
							<html:tr id="dateModifiedRow" hidden="true">
								<html:td><label id="dateModified-label"/></html:td>
								<html:td><label id="dateModified"/></html:td>
							</html:tr>
							<html:tr id="indexStatusRow">
								<html:td><label id="index-status-label"/></html:td>
								<html:td><hbox>
									<label id="index-status"/>
									<image id="reindex" onclick="this.hidden = true; setTimeout(function () { ZoteroPane_Local.reindexItem(); }, 50)"/>
								</hbox></html:td>
							</html:tr>
						</html:table>
					</vbox>
					
					<note-editor id="attachment-note-editor" notitle="1" flex="1"/>
					
					<button id="select-button" hidden="true"/>
					
					<popupset>
						<menupopup id="url-menu">
							<menuitem id="url-menuitem-copy"/>
						</menupopup>
					</popupset>
				</vbox>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}

		get mode() {
			return this._mode;
		}

		set mode(val) {
			Zotero.debug("Setting mode to '" + val + "'");
					
			this.editable = false;
			this.synchronous = false;
			this.displayURL = false;
			this.displayFileName = false;
			this.clickableLink = false;
			this.displayAccessed = false;
			this.displayPages = false;
			this.displayDateModified = false;
			this.displayIndexed = false;
			this.displayNote = false;
			this.displayNoteIfEmpty = false;
			
			switch (val) {
				case 'view':
					this.displayURL = true;
					this.displayFileName = true;
					this.clickableLink = true;
					this.displayAccessed = true;
					this.displayPages = true;
					this.displayIndexed = true;
					this.displayNote = true;
					this.displayDateModified = true;
					break;
				
				case 'edit':
					this.editable = true;
					this.displayURL = true;
					this.displayFileName = true;
					this.clickableLink = true;
					this.displayAccessed = true;
					this.displayPages = true;
					this.displayIndexed = true;
					this.displayNote = true;
					this.displayNoteIfEmpty = true;
					this.displayDateModified = true;
					break;
				
				case 'merge':
					this.synchronous = true;
					this.displayURL = true;
					this.displayFileName = true;
					this.displayAccessed = true;
					this.displayNote = true;
					this.displayDateModified = true;
					break;
				
				case 'mergeedit':
					this.synchronous = true;
					this.editable = true;
					this.displayURL = true;
					this.displayFileName = true;
					this.displayAccessed = true;
					this.displayNote = true;
					// Notes aren't currently editable in mergeedit pane
					this.displayNoteIfEmpty = false;
					this.displayDateModified = true;
					break;
				
				case 'filemerge':
					this.synchronous = true;
					this.displayURL = true;
					this.displayFileName = true;
					this.displayDateModified = true;
					break;
				
				default:
					throw new Error("Invalid mode '" + val + "' in <attachment-box>");
			}
			
			this._mode = val;
			this.querySelector('#attachment-box').setAttribute('mode', val);
		}

		get item() {
			return this._item;
		}

		set item(val) {
			if (!(val instanceof Zotero.Item)) {
				throw new Error("'item' must be a Zotero.Item");
			}
			this._item = val;
			this.refresh();
		}

		connectedCallback() {
			this.appendChild(document.importNode(this.content, true));

			// For the time being, use a silly little popup
			this._id('title').addEventListener('click', () => {
				if (this.editable) {
					this.editTitle();
				}
			});

			this._id('url').addEventListener('contextmenu', (event) => {
				this._id('url-menu').openPopupAtScreen(event.screenX, event.screenY, true);
			});

			let copyMenuitem = this._id('url-menuitem-copy');
			copyMenuitem.label = Zotero.getString('general.copy');
			copyMenuitem.addEventListener('command', () => {
				Zotero.Utilities.Internal.copyTextToClipboard(this.item.getField('url'));
			});

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'attachmentbox');
		}

		disconnectedCallback() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
			this.replaceChildren();
		}

		notify(event, type, ids, extraData) {
			if (event != 'modify' || !this.item || !this.item.id) return;
			for (let id of ids) {
				if (id != this.item.id) {
					continue;
				}
				
				var noteEditor = this._id('attachment-note-editor');
				if (extraData
						&& extraData[id]
						&& extraData[id].noteEditorID
						&& extraData[id].noteEditorID == noteEditor.instanceID) {
					//Zotero.debug("Skipping notification from current attachment note field");
					continue;
				}
				
				this.refresh();
				break;
			}
		}

		refresh() {
			Zotero.debug('Refreshing attachment box');
			
			var title = this._id('title');
			var fileNameRow = this._id('fileNameRow');
			var urlField = this._id('url');
			var accessed = this._id('accessedRow');
			var pagesRow = this._id('pagesRow');
			var dateModifiedRow = this._id('dateModifiedRow');
			var indexStatusRow = this._id('indexStatusRow');
			var selectButton = this._id('select-button');
			
			// DEBUG: this is annoying -- we really want to use an abstracted
			// version of createValueElement() from itemPane.js
			// (ideally in an XBL binding)
			
			// Wrap title to multiple lines if necessary
			while (title.hasChildNodes()) {
				title.removeChild(title.firstChild);
			}
			var val = this.item.getField('title');
			
			if (typeof val != 'string') {
				val += "";
			}
			
			var firstSpace = val.indexOf(" ");
			// Crop long uninterrupted text, and use value attribute for empty field
			if ((firstSpace == -1 && val.length > 29 ) || firstSpace > 29 || val === "") {
				title.setAttribute('crop', 'end');
				title.setAttribute('value', val);
			}
			// Create a <description> element, essentially
			else {
				title.removeAttribute('value');
				title.appendChild(document.createTextNode(val));
			}
			
			if (this.editable) {
				title.className = 'zotero-clicky';
			}
			
			var isImportedURL = this.item.attachmentLinkMode ==
									Zotero.Attachments.LINK_MODE_IMPORTED_URL;
			
			// Metadata for URL's
			if (this.item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL
					|| isImportedURL) {
				// URL
				if (this.displayURL) {
					var urlSpec = this.item.getField('url');
					urlField.setAttribute('value', urlSpec);
					urlField.setAttribute('tooltiptext', urlSpec);
					urlField.setAttribute('hidden', false);
					if (this.clickableLink) {
						urlField.onclick = function (event) {
							if (event.button == 0) {
								ZoteroPane_Local.loadURI(this.value, event);
							}
						};
						urlField.className = 'zotero-text-link';
					}
					else {
						urlField.className = '';
					}
					urlField.hidden = false;
				}
				else {
					urlField.hidden = true;
				}
				
				// Access date
				if (this.displayAccessed) {
					this._id("accessed-label").value = Zotero.getString('itemFields.accessDate')
						+ Zotero.getString('punctuation.colon');
					let val = this.item.getField('accessDate');
					if (val) {
						val = Zotero.Date.sqlToDate(val, true);
					}
					if (val) {
						this._id("accessed").value = val.toLocaleString();
						accessed.hidden = false;
					}
					else {
						accessed.hidden = true;
					}
				}
				else {
					accessed.hidden = true;
				}
			}
			// Metadata for files
			else {
				urlField.hidden = true;
				accessed.hidden = true;
			}
			
			if (this.item.attachmentLinkMode
						!= Zotero.Attachments.LINK_MODE_LINKED_URL
					&& this.displayFileName) {
				var fileName = this.item.attachmentFilename;
				
				if (fileName) {
					this._id("fileName-label").value = Zotero.getString('pane.item.attachments.filename')
						+ Zotero.getString('punctuation.colon');
					this._id("fileName").value = fileName;
					fileNameRow.hidden = false;
				}
				else {
					fileNameRow.hidden = true;
				}
			}
			else {
				fileNameRow.hidden = true;
			}
			
			// Page count
			if (this.displayPages) {
				Zotero.Fulltext.getPages(this.item.id)
				.then(function (pages) {
					if (!this.item) return;
					
					pages = pages ? pages.total : null;
					if (pages) {
						this._id("pages-label").value = Zotero.getString('itemFields.pages')
							+ Zotero.getString('punctuation.colon');
						this._id("pages").value = pages;
						pagesRow.hidden = false;
					}
					else {
						pagesRow.hidden = true;
					}
				}.bind(this));
			}
			else {
				pagesRow.hidden = true;
			}
			
			if (this.displayDateModified) {
				this._id("dateModified-label").value = Zotero.getString('itemFields.dateModified')
					+ Zotero.getString('punctuation.colon');
				// Conflict resolution uses a modal window, so promises won't work, but
				// the sync process passes in the file mod time as dateModified
				if (this.synchronous) {
					this._id("dateModified").value = Zotero.Date.sqlToDate(
						this.item.getField('dateModified'), true
					).toLocaleString();
					dateModifiedRow.hidden = false;
				}
				else {
					this.item.attachmentModificationTime
					.then(function (mtime) {
						if (!this._id) return;
						
						if (mtime) {
							this._id("dateModified").value = new Date(mtime).toLocaleString();
						}
						dateModifiedRow.hidden = !mtime;
					}.bind(this));
				}
			}
			else {
				dateModifiedRow.hidden = true;
			}
			
			// Full-text index information
			if (this.displayIndexed) {
				this.updateItemIndexedState()
				.then(function () {
					if (!this.item) return;
					indexStatusRow.hidden = false;
				}.bind(this));
			}
			else {
				indexStatusRow.hidden = true;
			}
			
			var noteEditor = this._id('attachment-note-editor');
			
			if (this.displayNote && (this.displayNoteIfEmpty || this.item.note != '')) {
				noteEditor.linksOnTop = true;
				noteEditor.hidden = false;
				
				// Don't make note editable (at least for now)
				if (this.mode == 'merge' || this.mode == 'mergeedit') {
					noteEditor.mode = 'merge';
					noteEditor.displayButton = false;
				}
				else {
					noteEditor.mode = this.mode;
				}
				noteEditor.parent = null;
				noteEditor.item = this.item;
			}
			else {
				noteEditor.hidden = true;
			}
			noteEditor.viewMode = 'library';
			
			if (this.displayButton) {
				selectButton.label = this.buttonCaption;
				selectButton.hidden = false;
				selectButton.setAttribute('oncommand',
					event => this.clickHandler(event.target));
			}
			else {
				selectButton.hidden = true;
			}
		}

		async editTitle() {
			var item = this.item;
			var oldTitle = item.getField('title');
			
			var nsIPS = Services.prompt;
			
			var newTitle = { value: oldTitle };
			var checkState = { value: Zotero.Prefs.get('lastRenameAssociatedFile') };
			
			while (true) {
				// Don't show "Rename associated file" option for
				// linked URLs
				if (item.attachmentLinkMode ==
						Zotero.Attachments.LINK_MODE_LINKED_URL) {
					var result = nsIPS.prompt(
						window,
						'',
						Zotero.getString('pane.item.attachments.rename.title'),
						newTitle,
						null,
						{}
					);
					
					// If they hit cancel or left it blank
					if (!result || !newTitle.value) {
						return;
					}
					
					break;
				}
				
				var result = nsIPS.prompt(
					window,
					'',
					Zotero.getString('pane.item.attachments.rename.title'),
					newTitle,
					Zotero.getString('pane.item.attachments.rename.renameAssociatedFile'),
					checkState
				);

				// If they hit cancel or left it blank
				if (!result || !newTitle.value) {
					return;
				}
				
				Zotero.Prefs.set('lastRenameAssociatedFile', checkState.value);
				
				// Rename associated file
				if (checkState.value) {
					var newFilename = newTitle.value.trim();
					if (newFilename.search(/\.\w{1,10}$/) == -1) {
						// User did not specify extension. Use current
						var oldExt = item.getFilename().match(/\.\w{1,10}$/);
						if (oldExt) newFilename += oldExt[0];
					}
					var renamed = await item.renameAttachmentFile(newFilename);
					if (renamed == -1) {
						var confirmed = nsIPS.confirm(
							window,
							'',
							newFilename + ' exists. Overwrite existing file?'
						);
						if (!confirmed) {
							// If they said not to overwrite existing file,
							// start again
							continue;
						}
						
						// Force overwrite, but make sure we check that this doesn't fail
						renamed = await item.renameAttachmentFile(newFilename, true);
					}
					
					if (renamed == -2) {
						nsIPS.alert(
							window,
							Zotero.getString('general.error'),
							Zotero.getString('pane.item.attachments.rename.error')
						);
						return;
					}
					else if (!renamed) {
						nsIPS.alert(
							window,
							Zotero.getString('pane.item.attachments.fileNotFound.title'),
							Zotero.getString('pane.item.attachments.fileNotFound.text1')
						);
					}
				}
				
				break;
			}
			
			if (newTitle.value != oldTitle) {
				item.setField('title', newTitle.value);
				await item.saveTx();
			}
		}

		onViewClick(event) {
			ZoteroPane_Local.viewAttachment(this.item.id, event, !this.editable);
		}

		onShowClick(event) {
			ZoteroPane_Local.showAttachmentInFilesystem(this.item.id, event.originalTarget, !this.editable);
		}

		updateItemIndexedState() {
			return (async () => {
				var indexStatus = this._id('index-status');
				var reindexButton = this._id('reindex');
				
				var status = await Zotero.Fulltext.getIndexedState(this.item);
				if (!this.item) return;
				
				var str = 'fulltext.indexState.';
				switch (status) {
					case Zotero.Fulltext.INDEX_STATE_UNAVAILABLE:
						str += 'unavailable';
						break;
					case Zotero.Fulltext.INDEX_STATE_UNINDEXED:
						str = 'general.no';
						break;
					case Zotero.Fulltext.INDEX_STATE_PARTIAL:
						str += 'partial';
						break;
					case Zotero.Fulltext.INDEX_STATE_QUEUED:
						str += 'queued';
						break;
					case Zotero.Fulltext.INDEX_STATE_INDEXED:
						str = 'general.yes';
						break;
				}
				this._id("index-status-label").value = Zotero.getString('fulltext.indexState.indexed')
					+ Zotero.getString('punctuation.colon');
				indexStatus.value = Zotero.getString(str);
				
				// Reindex button tooltip (string stored in zotero.properties)
				var str = Zotero.getString('pane.items.menu.reindexItem');
				reindexButton.setAttribute('tooltiptext', str);
				
				var show = false;
				if (this.editable) {
					show = await Zotero.Fulltext.canReindex(this.item);
					if (!this.item) return;
				}
				
				if (show) {
					reindexButton.setAttribute('hidden', false);
				}
				else {
					reindexButton.setAttribute('hidden', true);
				}
			})();
		}

		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}

	customElements.define("attachment-box", AttachmentBox);
}
