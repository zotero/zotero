/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2025 Corporation for Digital Scholarship
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
	class AdvancedSearchPane extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<hbox class="saved-search-name-row">
				<label control="saved-search-name" data-l10n-id="new-collection-name"/>
				<html:input type="text" id="saved-search-name"/>
			</hbox>
			<zoterosearch/>
			<hbox class="advanced-search-buttons">
				<button class="cancel-button" data-l10n-id="cancel-button"/>
				<button class="search-button" data-l10n-id="search-button" default="true"/>
				<button class="clear-button" data-l10n-id="clear-button"/>
				<button class="save-button" data-l10n-id="save-search-button"/>
			</hbox>
		`);

		init() {
			this._nameField = this.querySelector('#saved-search-name');
			this._searchElem = this.querySelector('zoterosearch');
			this._cancelButton = this.querySelector('.cancel-button');
			this._searchButton = this.querySelector('.search-button');
			this._clearButton = this.querySelector('.clear-button');
			this._saveButton = this.querySelector('.save-button');

			this._searchElem.addEventListener('input', () => this._searchElem.updateSearch());
			this._searchElem.addEventListener('command', () => this._searchElem.updateSearch());
			
			this._cancelButton.addEventListener('command', () => this.cancel());
			this._searchButton.addEventListener('command', () => this.submit());
			this._clearButton.addEventListener('command', () => this.clear());
			this._saveButton.addEventListener('command', () => this.save());
			
			if (!['temporary', 'saved'].includes(this.type)) {
				throw new Error(`Invalid type: ${this.type}`);
			}
			
			if (this.type === 'saved') {
				this._saveButton.setAttribute('default', 'true');
			}

			this.addEventListener('keydown', this._handleKeyDown);
		}

		_handleKeyDown = async (event) => {
			this._searchElem.updateSearch();
			if (event.key === 'Enter') {
				if (this.type === 'temporary') {
					await this.submit();
				}
				else {
					await this.save();
				}
			}
		};

		/**
		 * @returns {'temporary' | 'saved'}
		 */
		get type() {
			return this.getAttribute('type');
		}
		
		get search() {
			return this._search;
		}
		
		set search(search) {
			if (this.type === 'saved') {
				if (!search?.id) {
					throw new Error('Cannot edit unsaved search');
				}
				this._searchID = search.id;
				this._search = search.clone();
				this._nameField.value = search.name;
			}
			else if (search) {
				this._search = search.clone();
			}
			else {
				this._search = new Zotero.Search();
				this._search.addCondition('title', 'contains', '');
			}
		}
		
		_ensureSearch() {
			if (!this._search && this.type === 'temporary') {
				this.search = null;
			}
		}

		refresh() {
			this._ensureSearch();
			this._searchElem.search = this._search;
			// There would be no way to scope a saved search to anything but the library root,
			// so disable the option to save.
			// Somewhat unfortunate - revisit when/if we support nested condition sets in the UI.
			this._saveButton.disabled = this.type === 'temporary' && !ZoteroPane.getCollectionTreeRow().isLibrary();
		}

		async cancel() {
			await ZoteroPane.setSavedSearchEditorState('closed');
		}

		async submit() {
			if (this.type === 'saved') {
				throw new Error('submit() is unsupported for saved search');
			}
			
			this._ensureSearch();
			await ZoteroPane.itemsView.setFilter('advanced-search', this._search);
			ZoteroPane.itemsView.focus();
		}
		
		async clear() {
			if (this.type === 'saved') {
				throw new Error('clear() is unsupported for saved search');
			}

			this.search = null;
			await this.submit();
		}

		async save() {
			if (this.type === 'saved') {
				let search = Zotero.Searches.get(this._searchID);
				if (!search) {
					throw new Error('Missing search');
				}
				search.fromJSON(this._search.toJSON());
				search.name = this._nameField.value;
				await search.saveTx();
				await ZoteroPane.setSavedSearchEditorState('closed');
				Zotero_Tabs.rename('zotero-pane', search.name);
				return;
			}

			let collectionTreeRow = ZoteroPane.getCollectionTreeRow();
			if (!collectionTreeRow.isLibrary()) {
				throw new Error('Can only save in library root');
			}
			this._ensureSearch();
			
			let libraryID = collectionTreeRow.ref.libraryID;
			let searches = await Zotero.Searches.getAll(libraryID);
			let prefix = Zotero.getString('pane.collections.untitled');
			let name = Zotero.Utilities.Internal.getNextName(
				prefix,
				searches.map(s => s.name).filter(n => n.startsWith(prefix))
			);
			
			let search = this._search.clone(libraryID);
			search.name = name;
			await search.saveTx();

			await ZoteroPane.setAdvancedSearchState('closed');
		}
		
		focus(options) {
			this._searchElem.querySelector('#conditionsmenu').focus(options);
		}
	}
	customElements.define("advanced-search-pane", AdvancedSearchPane);
}
