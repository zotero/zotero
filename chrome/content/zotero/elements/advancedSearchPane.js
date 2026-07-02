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
				<button class="save-button" data-l10n-id="save-search-new-button"/>
			</hbox>
		`);

		_active = false;

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
				// Editing an existing search saves changes directly, so just "Save"
				// (vs. "Save Search…" for creating a new one, which prompts for a name)
				this._saveButton.setAttribute('data-l10n-id', 'save-search-edit-button');
			}

			this.addEventListener('keydown', this._handleKeyDown);
		}

		_handleKeyDown = async (event) => {
			this._searchElem.updateSearch();
			// Shift-Enter adds a new condition (handled by the search element), so
			// don't run/save the search for it
			if (event.key === 'Enter' && !event.shiftKey) {
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

		/**
		 * The ID of the saved search being edited, for type "saved"
		 */
		get editedSearchID() {
			return this._searchID;
		}
		
		/**
		 * Whether the search has been submitted and should filter the items list
		 */
		get active() {
			return this._active;
		}
		
		set search(search) {
			this._active = false;
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
				// Default a fresh search to top-level items, so a condition on a child
				// (e.g. attachment content) maps up to its item without any grouping
				this._search.addCondition('resultLevel', 'item');
				this._search.addCondition('title', 'contains', '');
			}
			this._searchElem.search = this._search;
		}
		
		_ensureSearch() {
			if (!this._search && this.type === 'temporary') {
				this.search = null;
			}
		}

		// Allow saving at an editable library or group root (but not a feed) or with
		// collections and/or saved searches selected within a single editable library,
		// in which case the selection is added to the saved search as scope conditions
		// (see _addScopeConditions())
		_canSaveInSelection() {
			let collectionTreeRows = ZoteroPane.getCollectionTreeRows();
			if (!collectionTreeRows.length) {
				return false;
			}
			let libraryID = collectionTreeRows[0].ref?.libraryID;
			return collectionTreeRows.every((row) => {
				if (row.ref?.libraryID !== libraryID || !row.editable) {
					return false;
				}
				return (row.isLibrary(true) && !row.isFeed())
					|| row.isCollection()
					|| row.isSearch();
			});
		}

		refresh() {
			this._ensureSearch();
			let libraryID = ZoteroPane.getSelectedLibraryID();
			// Keep the previous library when the selected row doesn't have one (e.g., Feeds)
			if (libraryID) {
				this._search.libraryID = libraryID;
			}
			// Set the libraries the search applies to: a temporary search spans all
			// selected libraries, a saved search just its own. Used to scope value
			// autocomplete and, when more than one library is involved, to drop the
			// Collection/Saved Search condition, which can only resolve within one library.
			if (this.type === 'temporary') {
				let libraryIDs = [];
				for (let row of ZoteroPane.getCollectionTreeRows()) {
					let id = row.ref && row.ref.libraryID;
					if (id !== undefined && id !== null && !libraryIDs.includes(id)) {
						libraryIDs.push(id);
					}
				}
				this._searchElem.scopeLibraryIDs = libraryIDs;
			}
			else {
				this._searchElem.scopeLibraryIDs = [this._search.libraryID];
			}
			this._searchElem.search = this._search;
			this._saveButton.disabled = this.type === 'temporary' && !this._canSaveInSelection();
		}

		async cancel() {
			await ZoteroPane.setSavedSearchEditorState('closed');
		}

		async submit() {
			if (this.type === 'saved') {
				throw new Error('submit() is unsupported for saved search');
			}

			this._searchElem.updateSearch();
			this._active = true;
			await ZoteroPane.itemsView.setFilter('advanced-search', this._search);
		}
		
		async clear() {
			if (this.type === 'saved') {
				throw new Error('clear() is unsupported for saved search');
			}

			this.search = null;
			await ZoteroPane.itemsView.setFilter('advanced-search', null);
		}

		async save() {
			this._searchElem.updateSearch();
			
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

			let collectionTreeRows = ZoteroPane.getCollectionTreeRows();
			if (!this._canSaveInSelection()) {
				throw new Error('Can only save in an editable library, collection, or saved search');
			}
			this._ensureSearch();

			let libraryID = collectionTreeRows[0].ref.libraryID;
			let searches = await Zotero.Searches.getAll(libraryID);
			let prefix = Zotero.getString('pane.collections.untitled');
			let defaultName = Zotero.Utilities.Internal.getNextName(
				prefix,
				searches.map(s => s.name).filter(n => n.startsWith(prefix))
			);

			// Prompt for a name, defaulting to the next "Untitled" name
			let [title, message] = await document.l10n.formatValues([
				'save-search-name-title',
				'save-search-name-message'
			]);
			let nameObj = { value: defaultName };
			if (!Services.prompt.prompt(window, title, message, nameObj, null, {})) {
				return;
			}
			let name = nameObj.value.trim() || defaultName;

			let search = this._search.clone(libraryID);
			search.name = name;
			// If saving within collections or saved searches rather than at the library
			// root, scope the search to the selection
			if (!collectionTreeRows.some(row => row.isLibrary(true))) {
				this._addScopeConditions(search, collectionTreeRows);
			}
			await search.saveTx();

			await ZoteroPane.setAdvancedSearchState('closed');
		}
		
		// Scope a search to the given collection/saved search rows by adding a top-level
		// collection/savedSearch condition for each -- an 'any' group of them when more
		// than one row is selected. If the search's own join mode is 'any', its existing
		// conditions move into an 'any' group of their own so the scope conditions apply
		// to every result.
		_addScopeConditions(search, collectionTreeRows) {
			let conditions = Object.values(search.getConditions());
			
			// Split the existing conditions into top-level markers/flags, which are
			// position-independent and stay at the top level, and the rest, which may get
			// wrapped in a group below. The search always comes from updateSearch(), so
			// these are the only markers/flags that can appear at the top level.
			const FLAGS = ['resultLevel', 'recursive', 'includeParentsAndChildren'];
			let joinMode = 'all';
			let flags = [];
			let rest = [];
			let depth = 0;
			// Number of top-level conditions and groups -- a single one doesn't need wrapping
			let units = 0;
			for (let condition of conditions) {
				if (condition.condition == 'groupStart') {
					if (!depth) {
						units++;
					}
					depth++;
					rest.push(condition);
				}
				else if (condition.condition == 'groupEnd') {
					depth--;
					rest.push(condition);
				}
				else if (!depth && condition.condition == 'joinMode') {
					joinMode = condition.operator;
				}
				else if (!depth && FLAGS.includes(condition.condition)) {
					flags.push(condition);
				}
				else {
					if (!depth) {
						units++;
					}
					rest.push(condition);
				}
			}
			
			let scope = collectionTreeRows.map(row => ({
				condition: row.isCollection() ? 'collection' : 'savedSearch',
				operator: 'is',
				value: row.ref.key
			}));
			// Search subcollections when the collections view does
			if (Zotero.Prefs.get('recursiveCollections')
					&& scope.some(c => c.condition == 'collection')
					&& !flags.some(c => c.condition == 'recursive')) {
				flags.push({ condition: 'recursive', operator: 'true', value: null });
			}
			if (scope.length > 1) {
				scope = [
					{ condition: 'groupStart', operator: 'true', value: '' },
					{ condition: 'joinMode', operator: 'any', value: null },
					...scope,
					{ condition: 'groupEnd', operator: 'true', value: '' }
				];
			}
			if (joinMode == 'any' && units > 1) {
				rest = [
					{ condition: 'groupStart', operator: 'true', value: '' },
					{ condition: 'joinMode', operator: 'any', value: null },
					...rest,
					{ condition: 'groupEnd', operator: 'true', value: '' }
				];
			}
			
			// Rebuild the search's conditions in the new order. removeCondition()
			// renumbers the remaining conditions, so 0 is always the next one to remove.
			let count = conditions.length;
			for (let i = 0; i < count; i++) {
				search.removeCondition(0);
			}
			for (let condition of [...scope, ...rest, ...flags]) {
				search.addCondition(
					condition.condition + (condition.mode ? '/' + condition.mode : ''),
					condition.operator,
					condition.value
				);
			}
		}
		
		focus(options) {
			let menu = this._searchElem.querySelector('#conditionsmenu');
			// focusVisible so the focus ring shows even though we're focusing
			// programmatically (in response to a click)
			menu.focus({ focusVisible: true, ...options });
		}
	}
	customElements.define("advanced-search-pane", AdvancedSearchPane);
}
