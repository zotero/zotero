/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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


{
	class NotesContext extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<deck class="context-node" flex="1" selectedIndex="0">
				<vbox class="zotero-context-notes-list" flex="1">
					<hbox style="display: flex;">
						<vbox style="flex: 1;">
							<search-textbox data-l10n-id="context-notes-search" data-l10n-attrs="placeholder"
								style="margin: 6px 8px 7px 8px;"
								type="search" timeout="250">
							</search-textbox>
						</vbox>
					</hbox>
					<vbox style="display: flex; min-width: 0;" flex="1">
						<html:div class="notes-list-container" tabindex="-1">
							<context-notes-list></context-notes-list>
						</html:div>
					</vbox>
				</vbox>
				<vbox class="zotero-context-note-container context-note-standalone">
					<vbox class="zotero-context-pane-editor-parent-line"></vbox>
					<html:div class="divider"></html:div>
					<note-editor class="zotero-context-pane-pinned-note" flex="1"></note-editor>
				</vbox>
				<vbox class="zotero-context-note-container context-note-child">
					<vbox class="zotero-context-pane-editor-parent-line"></vbox>
					<html:div class="divider"></html:div>
					<deck class="zotero-context-pane-tab-notes-deck" flex="1"></deck>
				</vbox>	
			</deck>
		`);

		get editable() {
			return this._editable;
		}

		set editable(editable) {
			this._editable = editable;
		}

		get libraryID() {
			return Number(this.node.dataset.libraryId);
		}
		
		set libraryID(libraryID) {
			this.node.dataset.libraryId = libraryID;
			this.editable = Zotero.Libraries.get(libraryID).editable;
		}

		get selectedIndex() {
			return this.node.selectedIndex;
		}

		set selectedIndex(selectedIndex) {
			this.setAttribute("selectedIndex", selectedIndex);
			this.node.selectedIndex = selectedIndex;
		}

		get selectedPanel() {
			return this.node.selectedPanel;
		}

		set selectedPanel(selectedPanel) {
			this.node.selectedPanel = selectedPanel;
		}

		get viewType() {
			return ["notesList", "standaloneNote", "childNote"][this.node.selectedIndex];
		}

		set viewType(viewType) {
			let viewTypeMap = {
				notesList: "0",
				standaloneNote: "1",
				childNote: "2",
			};
			if (!(viewType in viewTypeMap)) {
				throw new Error(`NotesContext.viewType must be one of ["notesList", "standaloneNote", "childNote"], but got ${viewType}`);
			}
			this.node.setAttribute("selectedIndex", viewTypeMap[viewType]);
		}

		static get observedAttributes() {
			return ['selectedIndex'];
		}

		attributeChangedCallback(name, oldValue, newValue) {
			switch (name) {
				case 'selectedIndex':
					this.node.selectedIndex = newValue;
					break;
			}
		}

		update = Zotero.Utilities.throttle(this._updateNotesList, 1000, { leading: false });

		cachedNotes = [];

		affectedIDs = new Set();

		updateFromCache = () => this._updateNotesList(true);
		
		init() {
			this.node = this.querySelector(".context-node");
			this.editor = this.querySelector(".zotero-context-pane-pinned-note");
			this.notesList = this.querySelector("context-notes-list");
			this.input = this.querySelector("search-textbox");
			this.input.addEventListener('command', () => {
				this.notesList.expanded = false;
				this._updateNotesList();
			});

			this._preventViewTypeCache = false;
			this._cachedViewType = "";

			this._initNotesList();
		}

		focus() {
			if (this.viewType == "notesList") {
				this.input.focus();
				return true;
			}
			else {
				this._getCurrentEditor().focusFirst();
				return true;
			}
		}

		_initNotesList() {
			this.notesList.addEventListener('note-click', (event) => {
				let { id } = event.detail;
				let item = Zotero.Items.get(id);
				if (item) {
					this._setPinnedNote(item);
				}
			});
			this.notesList.addEventListener('note-contextmenu', (event) => {
				let { id, screenX, screenY } = event.detail;
				let item = Zotero.Items.get(id);
				if (item) {
					document.getElementById('context-pane-list-move-to-trash').setAttribute('disabled', !this.editable);
					let popup = document.getElementById('context-pane-list-popup');
					let handleCommand = event => this._handleListPopupClick(id, event);
					popup.addEventListener('popupshowing', () => {
						popup.addEventListener('command', handleCommand, { once: true });
						popup.addEventListener('popuphiding', () => {
							popup.removeEventListener('command', handleCommand);
						}, { once: true });
					}, { once: true });
					popup.openPopupAtScreen(screenX, screenY, true);
				}
			});
			this.notesList.addEventListener('add-child', (event) => {
				document.getElementById('context-pane-add-child-note').setAttribute('disabled', !this.editable);
				document.getElementById('context-pane-add-child-note-from-annotations').setAttribute('disabled', !this.editable);
				let popup = document.getElementById('context-pane-add-child-note-button-popup');
				popup.onclick = this._handleAddChildNotePopupClick;
				popup.openPopup(event.detail.button, 'after_end');
			});
			this.notesList.addEventListener('add-standalone', (event) => {
				document.getElementById('context-pane-add-standalone-note').setAttribute('disabled', !this.editable);
				document.getElementById('context-pane-add-standalone-note-from-annotations').setAttribute('disabled', !this.editable);
				let popup = document.getElementById('context-pane-add-standalone-note-button-popup');
				popup.onclick = this._handleAddStandaloneNotePopupClick;
				popup.openPopup(event.detail.button, 'after_end');
			});
		}

		async _createNoteFromAnnotations(child) {
			let attachment = this._getCurrentAttachment();
			if (!attachment) {
				return;
			}
			let annotations = attachment.getAnnotations().filter(x => x.annotationType != 'ink');
			if (!annotations.length) {
				return;
			}
			let note = await Zotero.EditorInstance.createNoteFromAnnotations(
				annotations,
				{
					parentID: child && attachment.parentID
				}
			);

			ZoteroContextPane.updateAddToNote();

			this.input.value = '';
			this._updateNotesList();

			this._setPinnedNote(note);
		}

		_createNote(child) {
			this.viewType = "standaloneNote";
			let item = new Zotero.Item('note');
			item.libraryID = this.libraryID;
			if (child) {
				let attachment = this._getCurrentAttachment();
				if (!attachment) {
					return;
				}
				item.parentID = attachment.parentID;
			}
			this._setPinnedNote(item);
			ZoteroContextPane.updateAddToNote();
			
			this.input.value = '';
			this._updateNotesList();
		}

		_isNotesListVisible() {
			let splitter = ZoteroContextPane.getSplitter();
			
			return Zotero_Tabs.selectedID != 'zotero-pane'
				&& ZoteroContextPane.viewType == "notes"
				&& this.viewType == "notesList"
				&& splitter.getAttribute('state') != 'collapsed';
		}

		_getCurrentEditor() {
			let splitter = ZoteroContextPane.getSplitter();
			if (splitter.getAttribute('state') == 'collapsed' || ZoteroContextPane.viewType != "notes") return null;
			return this.node.selectedPanel.querySelector('note-editor');
		}

		_getCurrentAttachment() {
			let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
			if (reader) {
				return Zotero.Items.get(reader.itemID);
			}
			return null;
		}

		_setPinnedNote(item) {
			let { editor, node } = this;

			let isChild = false;
			let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
			if (reader) {
				let attachment = Zotero.Items.get(reader.itemID);
				if (attachment.parentItemID == item.parentItemID) {
					isChild = true;
				}
			}

			let tabNotesDeck = this.querySelector('.zotero-context-pane-tab-notes-deck');
			let parentTitleContainer;
			let vbox;
			if (isChild) {
				vbox = document.createXULElement('vbox');
				vbox.setAttribute('data-tab-id', Zotero_Tabs.selectedID);
				vbox.style.display = 'flex';

				editor = new (customElements.get('note-editor'));
				editor.style.display = 'flex';
				editor.style.width = '100%';
				vbox.append(editor);

				tabNotesDeck.append(vbox);

				editor.mode = this.editable ? 'edit' : 'view';
				editor.item = item;
				editor.parentItem = null;

				this.viewType = "childNote";
				tabNotesDeck.setAttribute('selectedIndex', tabNotesDeck.children.length - 1);

				parentTitleContainer = this.querySelector('.context-note-child > .zotero-context-pane-editor-parent-line');
			}
			else {
				this.viewType = "standaloneNote";
				editor.mode = this.editable ? 'edit' : 'view';
				editor.item = item;
				editor.parentItem = null;

				parentTitleContainer = node.querySelector('.context-note-standalone > .zotero-context-pane-editor-parent-line');
			}

			editor.focus();

			let parentItem = item.parentItem;
			let container = document.createElement('div');
			container.classList.add("parent-title-container");
			let returnBtn = document.createXULElement("toolbarbutton");
			returnBtn.classList.add("zotero-tb-note-return");
			returnBtn.addEventListener("command", () => {
				// Immediately save note content before vbox with note-editor iframe is destroyed below
				editor.saveSync();
				ZoteroContextPane.viewType = "notes";
				this.viewType = "notesList";
				vbox?.remove();
				ZoteroContextPane.updateAddToNote();
				this._preventViewTypeCache = true;
			});
			let title = document.createElement('div');
			title.className = 'parent-title';
			title.textContent = parentItem?.getDisplayTitle() || '';
			container.append(returnBtn, title);
			parentTitleContainer.replaceChildren(container);
			ZoteroContextPane.updateAddToNote();
		}

		async _updateNotesList(useCached) {
			let query = this.input.value;
			let notes;
			
			// Calls itself and debounces until notes list becomes
			// visible, and then updates
			if (!useCached && !this._isNotesListVisible()) {
				this.update();
				return;
			}
			
			if (useCached && this.cachedNotes.length) {
				notes = this.cachedNotes;
			}
			else {
				await Zotero.Schema.schemaUpdatePromise;
				let s = new Zotero.Search();
				s.addCondition('libraryID', 'is', this.libraryID);
				s.addCondition('itemType', 'is', 'note');
				if (query) {
					let parts = Zotero.SearchConditions.parseSearchString(query);
					for (let part of parts) {
						s.addCondition('note', 'contains', part.text);
					}
				}
				notes = await s.search();
				notes = Zotero.Items.get(notes);
				if (Zotero.Prefs.get('sortNotesChronologically.reader')) {
					notes.sort((a, b) => {
						a = a.dateModified;
						b = b.dateModified;
						return (a > b ? -1 : (a < b ? 1 : 0));
					});
				}
				else {
					let collation = Zotero.getLocaleCollation();
					notes.sort((a, b) => {
						let aTitle = Zotero.Items.getSortTitle(a.getNoteTitle());
						let bTitle = Zotero.Items.getSortTitle(b.getNoteTitle());
						return collation.compareString(1, aTitle, bTitle);
					});
				}
				
				let cachedNotesIndex = new Map();
				for (let cachedNote of this.cachedNotes) {
					cachedNotesIndex.set(cachedNote.id, cachedNote);
				}
				notes = notes.map((note) => {
					let parentItem = note.parentItem;
					// If neither note nor parent item is affected try to return the cached note
					if (!this.affectedIDs.has(note.id)
						&& (!parentItem || !this.affectedIDs.has(parentItem.id))) {
						let cachedNote = cachedNotesIndex.get(note.id);
						if (cachedNote) {
							return cachedNote;
						}
					}
					let text = note.note;
					text = Zotero.Utilities.unescapeHTML(text);
					text = text.trim();
					text = text.slice(0, 500);
					let parts = text.split('\n').map(x => x.trim()).filter(x => x.length);
					let title = parts[0] && parts[0].slice(0, Zotero.Notes.MAX_TITLE_LENGTH);
					let date = Zotero.Date.sqlToDate(note.dateModified, true);
					date = Zotero.Date.toFriendlyDate(date);
					
					return {
						id: note.id,
						title: title || Zotero.getString('pane.item.notes.untitled'),
						body: parts[1] || '',
						date,
						parentID: note.parentID,
						parentItemType: parentItem && parentItem.itemType,
						parentTitle: parentItem && parentItem.getDisplayTitle()
					};
				});
				this.cachedNotes = notes;
				this.affectedIDs = new Set();
			}

			let attachment = this._getCurrentAttachment();
			let parentID = attachment && attachment.parentID;
			this.notesList.hasParent = !!parentID;
			this.notesList.notes = notes.map(note => ({
				...note,
				isCurrentChild: parentID && note.parentID == parentID
			}));
		}

		_cacheViewType() {
			if (ZoteroContextPane.viewType == "notes"
				&& this.viewType != "childNote" && !this._preventViewTypeCache) {
				this._cachedViewType = this.viewType;
			}
			this._preventViewTypeCache = false;
		}

		_restoreViewType() {
			if (!this._cachedViewType) return;
			this.viewType = this._cachedViewType;
			this._cachedViewType = "";
		}

		_handleListPopupClick(id, event) {
			switch (event.originalTarget.id) {
				case 'context-pane-list-show-in-library':
					ZoteroPane_Local.selectItem(id);
					Zotero_Tabs.select('zotero-pane');
					break;

				case 'context-pane-list-edit-in-window':
					ZoteroPane_Local.openNoteWindow(id);
					break;

				case 'context-pane-list-move-to-trash':
					if (this.editable) {
						Zotero.Items.trashTx(id);
						this.cachedNotes = this.cachedNotes.filter(x => x.id != id);
						this._updateNotesList(true);
					}
					break;

				default:
			}
		}
		
		_handleAddChildNotePopupClick = (event) => {
			if (!this.editable) {
				return;
			}
			switch (event.originalTarget.id) {
				case 'context-pane-add-child-note':
					this._createNote(true);
					break;

				case 'context-pane-add-child-note-from-annotations':
					this._createNoteFromAnnotations(true);
					break;

				default:
			}
		};

		_handleAddStandaloneNotePopupClick = (event) => {
			if (!this.editable) {
				return;
			}
			switch (event.originalTarget.id) {
				case 'context-pane-add-standalone-note':
					this._createNote();
					break;

				case 'context-pane-add-standalone-note-from-annotations':
					this._createNoteFromAnnotations();
					break;

				default:
			}
		};
	}
	customElements.define("notes-context", NotesContext);
}
