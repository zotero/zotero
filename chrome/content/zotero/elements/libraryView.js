/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2026 Corporation for Digital Scholarship
					 Falls Church, Virginia, USA
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

/* global ItemTreeMenuBar: false, TagSelectorContainer: false, Zotero_Lookup: false */

/**
 * The library view owned by a library tab
 */
{
	class LibraryView extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<hbox id="zotero-trees" class="zotero-trees" flex="1">
				<vbox id="zotero-collections-pane" class="zotero-collections-pane" zotero-persist="width">
					<toolbar id="zotero-toolbar-collection-tree" tabindex="-1" class="zotero-toolbar-collection-tree zotero-toolbar toolbar toolbar-primary">
						<hbox id="zotero-collections-toolbar" class="zotero-collections-toolbar" align="center">
							<toolbarbutton id="zotero-tb-collection-add" tabindex="-1" class="zotero-tb-collection-add zotero-tb-button" data-l10n-id="toolbar-new-collection" command="cmd_zotero_newCollection"/>
							<spacer flex="1"></spacer>
							<html:div style="display: flex;flex-direction: row; flex-grow: 0; flex-shrink: 1; min-width: 0;">
								<toolbarbutton id="zotero-tb-collections-search" data-l10n-id="zotero-collections-search-btn" tabindex="-1" class="zotero-tb-collections-search zotero-tb-button"/>
								<search-textbox
									id="zotero-collections-search" class="zotero-collections-search hidden" disabled="true"
									data-l10n-id="zotero-collections-search"
									data-l10n-attrs="placeholder"
									oncommand="this.closest('library-view').handleCollectionSearchInput()"/>
							</html:div>
						</hbox>
					</toolbar>
					<!-- This is used for positioning the sync error icon panel
							under specific tree cells, which don't exist as
							elements on their own -->
					<box id="zotero-collections-tree-shim"/>
					<!-- This extra vbox prevents the toolbar from getting compressed when resizing
							the tag selector to max height -->
					<vbox id="zotero-collections-tree-container" class="zotero-collections-tree-container virtualized-table-container" flex="1" clickthrough="never">
						<html:div id="zotero-collections-tree" class="zotero-collections-tree"></html:div>
					</vbox>
					<splitter
						id="zotero-tags-splitter"
						orient="vertical"
						collapse="after"
						zotero-persist="state"
						onmousemove="if (this.getAttribute('state') == 'dragging') { this.closest('library-view').handleTagSelectorResize(); }"
					>
						<grippy oncommand="this.closest('library-view').toggleTagSelector()"/>
					</splitter>
					<!-- 'collapsed' is no longer necessary here due to the persisted 'state' on
						 zotero-tags-splitter, but without this an old-style entry for 'collapsed'
						 in localstore.rdf can cause the pane to always be closed on Zotero open.
						
						 TODO: deal with this some other way?
					-->
					<vbox id="zotero-tag-selector-container" class="zotero-tag-selector-container" zotero-persist="height,collapsed" clickthrough="never">
						<html:div id="zotero-tag-selector" class="zotero-tag-selector" label="&tagSelector.label;"/>
					</vbox>
				</vbox>
				
				<splitter id="zotero-collections-splitter" resizebefore="closest" resizeafter="closest" collapse="before"
					zotero-persist="state"
					onmousemove="this.closest('library-view').getElement('zotero-items-toolbar').setAttribute('state', this.getAttribute('state'));ZoteroPane.updateLayoutConstraints();"
					oncommand="ZoteroPane.updateLayoutConstraints()">
					<grippy id="zotero-collections-grippy"/>
				</splitter>
				
				<box id="zotero-layout-switcher" class="zotero-layout-switcher" orient="horizontal" zotero-persist="orient">
					<vbox id="zotero-items-pane-container" class="zotero-items-pane-container">
						<toolbar id="zotero-toolbar-item-tree" tabindex="-1" class="zotero-toolbar-item-tree zotero-toolbar toolbar toolbar-primary">
							<hbox id="zotero-items-toolbar" class="zotero-items-toolbar" align="center" flex="1">
								<toolbarbutton
										id="zotero-tb-add"
										class="zotero-tb-add zotero-tb-button"
										tabindex="-1"
										tooltiptext="&zotero.toolbar.newItem.label;"
										type="menu"
										wantdropmarker="true"
										onmousedown="if (this.disabled) { event.preventDefault(); return; }">
									<menupopup onpopupshowing="ZoteroPane.updateNewItemTypes(this)"></menupopup>
								</toolbarbutton>
								
								<toolbarbutton
									id="zotero-tb-lookup"
									tabindex="-1"
									class="zotero-tb-lookup zotero-tb-button"
									tooltiptext="&zotero.toolbar.lookup.label;"
									type="panel"
									onmousedown="Zotero_Lookup.handleToolbarButtonMouseDown(event)"
								/>
								
								<panel id="zotero-lookup-panel" class="zotero-lookup-panel" type="arrow" animate="false"
										noautohide="true"
										onpopupshown="Zotero_Lookup.onShown(event)"
										onpopuphidden="Zotero_Lookup.onHidden(event)"
										onfocusout="Zotero_Lookup.onFocusOut(event)"
								>
									<vbox>
										<label control="zotero-lookup-textbox">&zotero.lookup.description;</label>
										<vbox id="zotero-lookup-multiline">
											<html:textarea
												id="zotero-lookup-textbox"
												class="zotero-lookup-textbox"
												onkeypress="Zotero_Lookup.onKeyPress(event, this)"
												oninput="Zotero_Lookup.onInput(event, this)"
												oncontextmenu="Zotero_Lookup.onContextMenu(event, this)"
												rows="1"
												wrap="off"/>
											<hbox id="zotero-lookup-buttons" align="start" hidden="true">
												<button
													align="start"
													oncommand="Zotero_Lookup.accept(this.closest('library-view').getElement('zotero-lookup-textbox'))"
													label="&zotero.lookup.button.search;"/>
												<html:progress id="zotero-lookup-multiline-progress" class="zotero-lookup-multiline-progress" value="0" hidden="true" style="flex: 1"/>
											</hbox>
										</vbox>
									</vbox>
								</panel>
								
								<toolbarbutton
										id="zotero-tb-attachment-add"
										class="zotero-tb-attachment-add zotero-tb-button"
										tabindex="-1"
										data-l10n-id="toolbar-add-attachment"
										type="menu"
										wantdropmarker="true">
									<menupopup onpopupshowing="ZoteroPane.updateAddAttachmentMenu(event, this)">
										<menuitem
											data-l10n-id="menu-add-standalone-file-attachment"
											command="cmd_zotero_newStandaloneFileAttachment"
										/>
										<menuitem
											data-l10n-id="menu-add-standalone-linked-file-attachment"
											command="cmd_zotero_newStandaloneLinkedFileAttachment"
										/>
										<menuseparator/>
										<menuitem
											data-l10n-id="menu-add-child-file-attachment"
											command="cmd_zotero_newChildFileAttachment"
										/>
										<menuitem
											data-l10n-id="menu-add-child-linked-file-attachment"
											command="cmd_zotero_newChildLinkedFileAttachment"
											id="zotero-tb-attachment-add-file-link"
										/>
										<menuitem
											data-l10n-id="menu-add-child-linked-url-attachment"
											command="cmd_zotero_newChildURLAttachment"
										/>
									</menupopup>
								</toolbarbutton>
								<toolbarbutton
										id="zotero-tb-note-add" class="zotero-tb-note-add zotero-tb-button" tooltiptext="&zotero.toolbar.newNote;"
										type="menu"
										tabindex="-1"
										wantdropmarker="true">
									<menupopup onpopupshowing="ZoteroPane.updateNewNoteMenu(event, this)">
										<menuitem
											data-l10n-id="menu-new-standalone-note"
											command="cmd_zotero_newStandaloneNote"
										/>
										<menuitem
											data-l10n-id="menu-new-item-note"
											command="cmd_zotero_newChildNote"
										/>
									</menupopup>
								</toolbarbutton>
								
								<spacer flex="1"/>
								<image id="zotero-tb-search-spinner" class="zotero-tb-search-spinner zotero-spinner-16"/>
								<quick-search-textbox id="zotero-tb-search" timeout="250"
										onkeydown="this.closest('library-view').handleSearchKeypress(this, event)"
										oncommand="this.closest('library-view').search()"/>
								
								<!-- Stacked mode only: Toggle Item Pane button -->
								<toolbarbutton
									id="zotero-tb-toggle-item-pane-stacked"
									class="zotero-tb-toggle-item-pane-stacked zotero-tb-button"
									tabindex="-1"
									data-l10n-id="toggle-item-pane"
									oncommand="ZoteroPane.toggleItemPane()"
								/>
							</hbox>
						
						</toolbar>
						<advanced-search-deck id="zotero-advanced-search-pane-deck"/>
						<hbox id="zotero-items-pane" class="zotero-items-pane virtualized-table-container" flex="1" clickthrough="never">
							<html:div id="zotero-items-tree" class="zotero-items-tree"></html:div>
						</hbox>
					</vbox>
					
					
					<splitter id="zotero-items-splitter" class="zotero-items-splitter" resizebefore="closest" resizeafter="closest" collapse="after" orient="horizontal" zotero-persist="state orient"
						onmousemove="ZoteroPane.updateLayoutConstraints()"
						oncommand="ZoteroPane.updateLayoutConstraints()">
						<grippy id="zotero-items-grippy"/>
					</splitter>
					
					<!-- itemPane.xul -->
					<item-pane id="zotero-item-pane" class="zotero-item-pane" zotero-persist="width height"/>
				</box>
			</hbox>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/standalone.dtd']);
		
		collectionsView = null;
		
		itemsView = null;
		
		itemPane = null;
		
		tagSelector = null;
		
		// [element, listener] for the collection tree focus listener added in initCollectionsTree()
		_collectionsTreeFocusListener = null;
		
		_lastSelectedItems = [];
		
		_libraryTabStateRestores = 0;
		
		_libraryTabStatePromise = Promise.resolve();
		
		_itemsPaneMessageLocked = false;
		
		_quickSearchIsQuery = false;
		
		_uninited = false;
		
		// Appended to the template's element ids in every view but the window's primary one,
		// which keeps the base ids
		_idSuffix = '';
		
		// The element ids stamped by the template, which get the suffix
		_templateIDs = null;
		
		// Whether the view has finished initializing and can adopt and flush shared state
		loaded = false;
		
		/**
		 * The id of the tab this view belongs to, which is also the id of its <tab-content>
		 * container in the deck
		 */
		get tabID() {
			return this.closest('tab-content')?.id;
		}
		
		/**
		 * Whether this is the window's active library view, which drives window-level state
		 * such as command enabled states
		 */
		get isActiveView() {
			return ZoteroPane.libraryView === this;
		}
		
		/**
		 * Whether this view's tab is the selected tab
		 */
		get isVisible() {
			return Zotero_Tabs.selectedID === this.tabID;
		}
		
		/**
		 * A subtree element by its base id
		 *
		 * All lookups of elements inside the view go through this rather than
		 * document.getElementById(), so that they resolve within this view
		 *
		 * @param {String} id
		 * @return {Element|null}
		 */
		getElement(id) {
			if (this._idSuffix && this._templateIDs.has(id)) {
				id += this._idSuffix;
			}
			return this.querySelector('#' + CSS.escape(id));
		}
		
		/**
		 * The base id of one of this view's elements
		 *
		 * @param {String} id
		 * @return {String}
		 */
		getBaseID(id) {
			if (this._idSuffix && id.endsWith(this._idSuffix)) {
				return id.slice(0, -this._idSuffix.length);
			}
			return id;
		}
		
		init() {
			this._templateIDs = new Set(
				[...this.content.querySelectorAll('[id]')].map(el => el.id)
			);
			// The window's first library view is the primary view and keeps the base ids
			let tabID = this.tabID;
			if (ZoteroPane.primaryLibraryView && tabID) {
				this._idSuffix = '-' + tabID;
				for (let el of this.querySelectorAll('[id]')) {
					if (this._templateIDs.has(el.id)) {
						el.id += this._idSuffix;
					}
				}
				for (let el of this.querySelectorAll('[control]')) {
					let control = el.getAttribute('control');
					if (this._templateIDs.has(control)) {
						el.setAttribute('control', control + this._idSuffix);
					}
				}
			}
			this._destroyed = false;
			ZoteroPane.registerLibraryView(this);
			this.itemPane = this.getElement('zotero-item-pane');
			this._container = this.closest('tab-content');
			this._container?.addEventListener('tab-selection-change', this._handleTabSelectionChange);
		}
		
		destroy() {
			this._destroyed = true;
			this._container?.removeEventListener('tab-selection-change', this._handleTabSelectionChange);
			ZoteroPane.unregisterLibraryView(this);
			this.uninit();
		}
		
		/**
		 * Initialize the view's trees, containers, and state after the element is connected
		 *
		 * Used for views created after the window has loaded. The view's tab should be
		 * selected, since the trees measure themselves as they render.
		 *
		 * @param {Object} [state] - A library view state, as returned by
		 *     captureLibraryTabState()
		 * @return {Promise}
		 */
		async load(state) {
			// The items tree has to be initialized first, since the collections tree selects a
			// row as soon as it's initialized, which loads items into the items tree
			await this.initItemsTree();
			if (this._releaseIfDestroyed()) {
				return;
			}
			this.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
			await this.initCollectionsTree(state?.collections?.[0]);
			if (this._releaseIfDestroyed()) {
				return;
			}
			this.initCollectionTreeSearch();
			this.setUpKeyboardNavigation();
			this.initUIProperties();
			this.adoptSharedState();
			ZoteroPane.updateLayout();
			ZoteroPane.updateWindow();
			await this.initTagSelector();
			if (this._releaseIfDestroyed()) {
				return;
			}
			await this.tagSelector?.adoptPrefs();
			if (this._releaseIfDestroyed()) {
				return;
			}
			this.loaded = true;
			Zotero.Plugins.notifyMainWindowLoad(window);
			await this.restoreLibraryTabState(state);
			ZoteroPane.updateLayoutConstraints();
		}
		
		/**
		 * Tear down what finished initializing after the view was destroyed mid-load
		 *
		 * @return {Boolean} - Whether the view has been destroyed
		 */
		_releaseIfDestroyed() {
			if (!this._destroyed) {
				return false;
			}
			this._uninited = false;
			this.uninit();
			return true;
		}
		
		/**
		 * Make the view's container a root for the font size and density properties
		 */
		initUIProperties() {
			let container = this._container;
			Zotero.UIProperties.registerRoot(container);
			container.addEventListener('UIPropertiesChanged', () => {
				this.collectionsView?.updateFontSize();
				this.itemsView?.updateFontSize();
			});
		}
		
		/**
		 * Arrange the panes for the standard or stacked layout
		 *
		 * @param {Boolean} stacked
		 */
		applyLayout(stacked) {
			let layoutSwitcher = this.getElement("zotero-layout-switcher");
			let itemsSplitter = this.getElement("zotero-items-splitter");
			let sidenav = this.getElement("zotero-view-item-sidenav");
			let orient = stacked ? "vertical" : "horizontal";
			layoutSwitcher.setAttribute("orient", orient);
			itemsSplitter.setAttribute("orient", orient);
			sidenav.classList.toggle("stacked", stacked);
			this.itemPane.classList.toggle("stacked", stacked);
		}
		
		_handleTabSelectionChange = (event) => {
			if (!this.loaded) {
				return;
			}
			if (event.detail.selected) {
				this.adoptSharedState();
			}
			else {
				this.flushSharedState();
			}
		};
		
		/**
		 * Apply the shared pane, column, and tag selector settings, which another view may
		 * have changed since this view last showed
		 */
		adoptSharedState() {
			ZoteroPane.unserializePersist(this);
			this.applyLayout(Zotero.Prefs.get("layout") === "stacked");
			this.itemsView?.reloadColumnPrefs().catch(e => Zotero.logError(e));
			this.tagSelector?.adoptPrefs().catch(e => Zotero.logError(e));
		}
		
		/**
		 * Write the shared settings this view holds, before another view takes over
		 */
		flushSharedState() {
			ZoteroPane.serializePersist(this);
			this.itemsView?._writeColumnPrefsToFile(true);
		}
		
		/**
		 * Tear down the trees and the tag selector, and remove the listeners added to them
		 */
		uninit() {
			if (this._uninited) {
				return;
			}
			this._uninited = true;
			this.loaded = false;
			if (this._collectionsTreeFocusListener) {
				let [elem, listener] = this._collectionsTreeFocusListener;
				elem.removeEventListener("focus", listener);
				this._collectionsTreeFocusListener = null;
			}
			if (this.collectionsView) this.collectionsView.unregister();
			if (this.itemsView) this.itemsView.unregister();
			this.uninitContainers();
		}
		
		async initItemsTree() {
			try {
				const CollectionViewItemTree = require('zotero/collectionViewItemTree');
				this._uninited = false;
				var itemsTree = this.getElement('zotero-items-tree');
				this.itemsView = await CollectionViewItemTree.init(itemsTree, {
					// Every library view's tree shares the "main" id, which keys its column
					// prefs and the plugin columns enabled for it
					id: "main",
					domIdSuffix: this._idSuffix,
					// Only the visible view writes the shared column prefs
					shouldPersistColumnPrefs: () => this.isVisible,
					dragAndDrop: true,
					columnPicker: true,
					onSelectionChange: selection => ZoteroPane.itemSelected(selection, this),
					onContextMenu: (...args) => ZoteroPane.onItemsContextMenuOpen(...args),
					onActivate: (event, items) => ZoteroPane.onItemTreeActivate(event, items),
					emptyMessage: Zotero.getString('pane.items.loading')
				});
				this.itemsView.onRefresh.addListener(() => this.setTagScope());
				// Update the item pane on every refresh, so the "items in this view" count stays in
				// sync when the result set changes without a selection change (e.g., quick search,
				// tag filter, or sort with nothing selected)
				this.itemsView.onRefresh.addListener(async () => {
					await ZoteroPane.itemSelected(null, this);
				});
				// Also update the count when rows are added or removed by notifier events with
				// nothing selected (e.g., items downloaded during a sync). Debounced so that the
				// item pane doesn't re-render within the notifier dispatch or once per event in
				// a burst of changes.
				let updateUnselectedCount = Zotero.Utilities.debounce(() => {
					if (!this.itemsView.selection.count) {
						this.itemPane.render();
					}
				}, 100);
				this.itemsView.onRowCountChange.addListener(() => {
					if (!this.itemsView.selection.count) {
						updateUnselectedCount();
					}
				});
				this.itemsView.waitForLoad().then(() => Zotero.uiIsReady());
			}
			catch (e) {
				Zotero.logError(e);
				Zotero.debug(e, 1);
			}
		}
		
		/**
		 * @param {String} [initialFolder] - The collection tree row id to select at startup
		 */
		async initCollectionsTree(initialFolder) {
			try {
				const CollectionTree = require('zotero/collectionTree');
				var collectionsTree = this.getElement('zotero-collections-tree');
				this.collectionsView = await CollectionTree.init(collectionsTree, {
					id: 'collection-tree' + this._idSuffix,
					initialFolder,
					onSelectionChange: prevSelection => this.onCollectionSelected(prevSelection),
					onContextMenu: (...args) => ZoteroPane.onCollectionsContextMenuOpen(...args),
					dragAndDrop: true,
					multiSelect: true
				});
				let treeElem = collectionsTree.firstChild;
				let focusListener = this.collectionsView.recordCollectionTreeFocus;
				treeElem.addEventListener("focus", focusListener);
				this._collectionsTreeFocusListener = [treeElem, focusListener];
			}
			catch (e) {
				Zotero.logError(e);
				Zotero.debug(e, 1);
			}
		}
		
		initCollectionTreeSearch() {
			let collectionSearchField = this.getElement("zotero-collections-search");
			let collectionSearchButton = this.getElement("zotero-tb-collections-search");
			collectionSearchField.style.visibility = 'hidden';
			collectionSearchField.addEventListener("blur", this.handleCollectionSearchBlur);
			collectionSearchButton.addEventListener("click", (_) => {
				if (!collectionSearchField.classList.contains("visible")) {
					collectionSearchButton.style.display = 'none';
					// If the collectionPane is narrow, set smaller max-width
					let maxWidth = collectionSearchField.getAttribute("data-expanded-width");
					if (maxWidth) {
						collectionSearchField.style.maxWidth = `${maxWidth}px`;
					}
					collectionSearchField.style.visibility = 'visible';
					collectionSearchField.classList.add("visible", "expanding");
					// Enable and focus the field only after it was revealed to prevent the cursor
					// from changing between 'text' and 'pointer' back and forth as the input field expands
					setTimeout(() => {
						collectionSearchField.removeAttribute("disabled");
						collectionSearchField.classList.remove("expanding");
						collectionSearchField.focus();
					}, 250);
					return;
				}
				collectionSearchField.focus();
			});
		}
		
		handleCollectionSearchBlur = () => {
			this.hideCollectionSearch();
		};
		
		hideCollectionSearch() {
			let collectionSearchField = this.getElement("zotero-collections-search");
			let collectionSearchButton = this.getElement("zotero-tb-collections-search");
			if (!collectionSearchField.value.length && collectionSearchField.classList.contains("visible")) {
				collectionSearchField.classList.remove("visible");
				collectionSearchField.setAttribute("disabled", true);
				setTimeout(() => {
					collectionSearchButton.style.display = '';
					collectionSearchField.style.visibility = 'hidden';
					collectionSearchField.style.removeProperty('max-width');
				}, 50);
			}
		}
		
		handleCollectionSearchInput() {
			let collectionsSearchField = this.getElement("zotero-collections-search");
			this.collectionsView.setFilter(collectionsSearchField.value);
			// Make sure that the filter ends up being hidden if the value is cleared
			// after the blur event fires. This happens on windows on cross icon click.
			if (collectionsSearchField.value.length == 0
					&& document.activeElement !== collectionsSearchField) {
				this.hideCollectionSearch();
			}
		}
		
		initContainers() {
			this.initTagSelector();
		}
		
		uninitContainers() {
			if (this.tagSelector) this.tagSelector.uninit();
		}
		
		async initTagSelector() {
			try {
				var container = this.getElement('zotero-tag-selector-container');
				if (!container.hasAttribute('collapsed')) {
					this.tagSelector = await TagSelectorContainer.init(
						this.getElement('zotero-tag-selector'),
						{
							container,
							onSelection: this.updateTagFilter.bind(this),
						}
					);
					// Occasionally, when the app is first opened, the scrollable tag list doesn't
					// occupy the full height of the tag selector. This ensures that it occupies all
					// available space.
					setTimeout(() => {
						this.tagSelector.handleResize();
					}, 100);
				}
			}
			catch (e) {
				Zotero.logError(e);
				Zotero.debug(e, 1);
			}
		}
		
		handleTagSelectorResize = Zotero.Utilities.debounce(async function () {
			if (this.tagSelectorShown()) {
				// Initialize if dragging open after startup
				if (!this.tagSelector) {
					await this.setTagScope();
				}
				this.tagSelector.handleResize();
			}
		}, 100);
		
		/*
		 * Sets the tag filter on the items view
		 */
		async updateTagFilter() {
			if (this.itemsView) {
				await this.itemsView.setFilter('tags', this.tagSelector.getTagSelection());
			}
		}
		
		// Keep in sync with ZoteroStandalone.updateViewOption()
		async toggleTagSelector() {
			var container = this.getElement('zotero-tag-selector-container');
			var showing = container.hasAttribute('collapsed');
			container.toggleAttribute('collapsed', !showing);
			
			// If showing, set scope to items in current view
			// and focus filter textbox
			if (showing) {
				await this.setTagScope();
				this.tagSelector.focusTextbox();
			}
			// If hiding, clear selection
			else {
				this.tagSelector.uninit();
				this.tagSelector = null;
			}
		}
		
		tagSelectorShown() {
			var collectionTreeRows = this.getCollectionTreeRows();
			if (!collectionTreeRows.length) return false;
			var tagSelector = this.getElement('zotero-tag-selector-container');
			return !!tagSelector && !tagSelector.hasAttribute('collapsed');
		}
		
		async updateTagSelectorViewSettingsMenu() {
			document.getElementById('show-automatic').toggleAttribute('checked', this.tagSelector.showAutomatic);
			document.getElementById('display-all-tags').toggleAttribute('checked', this.tagSelector.displayAllTags);
			document.getElementById('num-selected').label = this.tagSelector.label;
			var libraryID = this.tagSelector.libraryID;
			var library = Zotero.Libraries.get(libraryID);
			// 'Delete Automatic Tags in This Library' is per-library, so disable it when the
			// selection spans multiple libraries
			var enabled = !this.tagSelector.multiLibrary
				&& library.editable
				&& (await Zotero.Tags.getAutomaticInLibrary(libraryID)).length > 0;
			document.getElementById('delete-automatic-tags').disabled = !enabled;
		}
		
		/*
		 * Set the tags scope to the items in the current view
		 *
		 * Passed to the items tree to trigger on changes
		 */
		async setTagScope() {
			var collectionTreeRows = this.getCollectionTreeRows();
			if (this.tagSelectorShown()) {
				if (!this.tagSelector) {
					await this.initTagSelector();
				}
				if (collectionTreeRows.every(o => o.editable)) {
					this.tagSelector.setMode('edit');
				}
				else {
					this.tagSelector.setMode('view');
				}
				this.tagSelector.onItemViewChanged({
					libraryID: collectionTreeRows[0].ref && collectionTreeRows[0].ref.libraryID,
					collectionTreeRows
				});
			}
		}
		
		onCollectionSelected = Zotero.serial(async function () {
			var collectionTreeRows = this.getCollectionTreeRows();
			if (!collectionTreeRows.length) {
				Zotero.debug('LibraryView.onCollectionSelected: No selected collection found');
				return;
			}
			
			// Only certain combinations of rows can be shown together in one items view.
			// Collections, saved searches, and library roots can be mixed freely, within or
			// across libraries, except that a library root can't be combined with a collection
			// or saved search -- a library already shows all of its items, so pairing it with
			// one of its own child collections/searches has no use case. Recently Read can be
			// combined only with other Recently Read rows (across libraries). All other special
			// views (Trash, Duplicates, etc.) can't be shown alongside anything else. The
			// visibility-group check enforces both the Recently Read restriction and the
			// feed/non-feed split: Recently Read and feeds are each their own group, so pairing
			// one with a collection (or with each other) spans two groups, which can't share an
			// items view. When the selected rows can't be shown together, drop everything except
			// the focused row and show just that. Selections spanning multiple libraries are
			// shown grouped by library in the items list.
			if (collectionTreeRows.length > 1) {
				let combinable = collectionTreeRows.every(
					row => row.isCollection() || row.isSearch() || row.isLibrary(true)
						|| row.isFeeds() || row.isRecentlyRead()
				);
				let mixesVisibilityGroups = new Set(
					collectionTreeRows.map(row => row.visibilityGroup)
				).size > 1;
				// A library root already shows all of its items, so don't combine it with a
				// collection or saved search (which share its visibility group)
				let mixesLibraryAndCollection = collectionTreeRows.some(row => row.isLibrary(true))
					&& collectionTreeRows.some(row => row.isCollection() || row.isSearch());
				if (!combinable || mixesVisibilityGroups || mixesLibraryAndCollection) {
					Zotero.debug("LibraryView.onCollectionSelected: Selected rows can't be shown "
						+ "together -- keeping only the focused row");
					// Drop all but the focused row. Don't await selectByID() here: it awaits
					// waitForSelect(), whose 'select' event can't fire until this handler
					// returns, so it would deadlock. Reducing the selection directly
					// re-triggers onCollectionSelected() with the single row.
					this.collectionsView.selection.select(this.collectionsView.selection.focused);
					return;
				}
			}
			
			if (this.itemsView?.collectionTreeRows
					&& Zotero.Utilities.arrayEquals(
						collectionTreeRows.map(r => r.id).sort(),
						this.itemsView.collectionTreeRows.map(r => r.id).sort()
					)) {
				Zotero.debug("LibraryView.onCollectionSelected: Collection selection hasn't changed");
				
				// Update enabled actions, in case editability has changed
				if (this.isActiveView) {
					ZoteroPane._updateEnabledActionsForCollectionTreeRows(collectionTreeRows);
				}
				return;
			}
			
			let advancedSearchDeck = this.getElement('zotero-advanced-search-pane-deck');
			if (this.itemsView.collectionTreeRows[0]?.isSearch()
					&& advancedSearchDeck.state === 'open'
					&& advancedSearchDeck.selectedSearchType === 'saved'
					&& !(await this._confirmCloseSavedSearchEditor())) {
				// Revert the selection to just the search being edited, suppressing the
				// selection event so that this handler doesn't re-run and re-prompt
				this.collectionsView.selection.selectEventsSuppressed = true;
				try {
					let index = this.collectionsView.getRowIndexByID(this.itemsView.collectionTreeRows[0].id);
					if (index !== false) {
						this.collectionsView.selection.select(index);
					}
				}
				finally {
					this.collectionsView.selection.selectEventsSuppressed = false;
				}
				return;
			}
			
			// Rename tab
			Zotero_Tabs.rename(this.tabID);
			
			// Clear quick search and tag selector when switching views
			this.getElement('zotero-tb-search').onCollectionSelected();
			if (this.tagSelector) {
				this.tagSelector.clearTagSelection();
			}
			
			this._refreshAdvancedSearchPane(collectionTreeRows);
			if (this.isActiveView) {
				ZoteroPane._updateEnabledActionsForCollectionTreeRows(collectionTreeRows);
			}
			
			for (let collectionTreeRow of collectionTreeRows) {
				collectionTreeRow.setSearch('');
				if (this.tagSelector) {
					collectionTreeRow.setTags(this.tagSelector.getTagSelection());
				}
				
				// If item data not yet loaded for library, load it now.
				// Other data types are loaded at startup
				if (collectionTreeRow.isFeeds()) {
					var feedsToLoad = Zotero.Feeds.getAll().filter(feed => !feed.getDataLoaded('item'));
					if (feedsToLoad.length) {
						Zotero.debug("Waiting for items to load for feeds " + feedsToLoad.map(feed => feed.libraryID));
						this.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
						for (let feed of feedsToLoad) {
							await feed.waitForDataLoad('item');
						}
					}
				}
				else {
					var library = Zotero.Libraries.get(collectionTreeRow.ref.libraryID);
					if (!library.getDataLoaded('item')) {
						Zotero.debug("Waiting for items to load for library " + library.libraryID);
						this.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
						await library.waitForDataLoad('item');
					}
				}
			}
			
			await this.itemsView.changeCollectionTreeRows(collectionTreeRows);
			
			// Only the window's active view sets the last viewed collection, which is also where the
			// connector saves when no main window is open
			if (this.isActiveView) {
				Zotero.Prefs.set('lastViewedFolder', collectionTreeRows[0].id);
			}
			// The focused row is the one just clicked, whereas collectionTreeRows is in tree order
			let focusedRow = this.collectionsView.selectedTreeRow;
			if (focusedRow && focusedRow.isCollection()) {
				Zotero.Collections.addToRecent(focusedRow.ref);
			}
		});
		
		/**
		 * @return {Promise<Boolean>} - Promise that resolves to true if an item was selected,
		 *                              or false if not (used for tests, though there could possibly
		 *                              be a better test for whether the item pane changed)
		 */
		itemSelected() {
			return (async () => {
				if (!this.itemsView || !this.itemsView.selection) {
					Zotero.debug("Items view not available in itemSelected", 2);
					return false;
				}
				let collectionTreeRows = this.getCollectionTreeRows();
				// I don't think this happens in normal usage, but it can happen during tests
				if (!collectionTreeRows.length) {
					return false;
				}
				
				var selectedItems = this.itemsView.getSelectedObjects();
				
				// Display buttons at top of item pane depending on context. This needs to run even if the
				// selection hasn't changed, because the selected items might have been modified.
				this.itemPane.data = selectedItems;
				this.itemPane.collectionTreeRows = collectionTreeRows;
				this.itemPane.itemsView = this.itemsView;
				this.itemPane.editable = this.collectionsView.editable;
				this.itemPane.updateItemPaneButtons(selectedItems);
				
				// Tab selection observer in standalone.js makes sure that
				// updateQuickCopyCommands is called
				if (this.isActiveView && Zotero_Tabs.selectedIsLibrary) {
					ZoteroPane.updateQuickCopyCommands(selectedItems);
				}
				
				// Check if selection has actually changed. The onselect event that calls this
				// can be called in various situations where the selection didn't actually change,
				// such as whenever selectEventsSuppressed is set to false.
				var ids = selectedItems.map(item => item.treeViewID);
				ids.sort();
				if (ids.length && Zotero.Utilities.arrayEquals(this._lastSelectedItems, ids)) {
					return false;
				}
				this._lastSelectedItems = ids;
				
				return this.itemPane.render();
			})()
			.catch((e) => {
				Zotero.logError(e);
				Zotero.crash();
				throw e;
			});
		}
		
		/**
		 * return {CollectionTreeRow[]}
		 */
		getCollectionTreeRows() {
			if (!this.collectionsView) {
				return [];
			}
			// selection.selected is in click order -- return rows in collections-list order
			return [...this.collectionsView.selection.selected]
				.sort((a, b) => a - b)
				.map(index => this.collectionsView.getRow(index));
		}
		
		/**
		 * @param {Zotero.CollectionTreeRow[]} [collectionTreeRows] - During collection selection,
		 *     the newly selected rows, which aren't in the items view yet
		 */
		_refreshAdvancedSearchPane(collectionTreeRows) {
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			
			deck.pane.refresh();
			
			let search = this._getActiveAdvancedSearch();
			if (collectionTreeRows) {
				for (let collectionTreeRow of collectionTreeRows) {
					collectionTreeRow.setAdvancedSearch(search);
				}
				return undefined;
			}
			// Apply via the items view, whose rows can be different objects from the
			// collection tree's current rows
			return this.itemsView.setFilter('advanced-search', search);
		}
		
		/**
		 * The Advanced Search the items list is filtered by, if any
		 *
		 * @return {Zotero.Search|null}
		 */
		_getActiveAdvancedSearch() {
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			return deck.state === 'closed' || deck.selectedSearchType !== 'temporary' || !deck.pane.active
				? null
				: deck.pane.search;
		}
		
		/**
		 * The library a collection tree row id belongs to
		 *
		 * @param {String} [rowID]
		 * @return {Integer|null}
		 */
		_getLibraryIDFromRowID(rowID) {
			if (!rowID) {
				return null;
			}
			let objectID = parseInt(rowID.substr(1));
			switch (rowID[0]) {
				case 'L':
				case 'T':
				case 'D':
				case 'U':
				case 'Y':
				case 'R':
				case 'P':
					return objectID;
				
				case 'C':
					return Zotero.Collections.get(objectID)?.libraryID ?? null;
				
				case 'S':
					return Zotero.Searches.get(objectID)?.libraryID ?? null;
			}
			return null;
		}
		
		/**
		 * Capture the collection selection of the library view, which is all the session
		 * keeps of a library tab
		 *
		 * @return {Object|null} - { collections, focusedCollection }, or null if the view
		 *     isn't ready
		 */
		captureCollectionsState() {
			let collectionTreeRows = this.getCollectionTreeRows();
			if (this._libraryTabStateRestores || !collectionTreeRows.length) {
				return null;
			}
			let focusedRow = this.collectionsView.getRow(this.collectionsView.selection.focused);
			return {
				collections: collectionTreeRows.map(row => row.id),
				focusedCollection: focusedRow ? focusedRow.id : null
			};
		}
		
		/**
		 * Capture the state of the library view, for another library tab or window
		 *
		 * @return {Object|null} - A JSON-serializable snapshot, or null if the view isn't ready
		 */
		captureLibraryTabState() {
			if (this._libraryTabStateRestores
					|| !this.collectionsView
					|| !this.itemsView?.collectionTreeRows?.length) {
				return null;
			}
			let focusedRow = this.collectionsView.getRow(this.collectionsView.selection.focused);
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			let advancedSearch = null;
			if (deck.state !== 'closed') {
				// Include conditions that are being edited but haven't been run
				deck.pane.updateSearch();
				advancedSearch = {
					state: deck.state,
					type: deck.selectedSearchType,
					active: deck.pane.active,
					search: deck.pane.search ? deck.pane.search.toJSON() : null,
					libraryID: deck.pane.search ? deck.pane.search.libraryID : null,
					savedSearchID: deck.pane.editedSearchID ?? null,
					savedSearchName: deck.pane.savedSearchName
				};
			}
			return {
				collections: this.getCollectionTreeRows().map(row => row.id),
				focusedCollection: focusedRow ? focusedRow.id : null,
				collectionsScrollTop: this.collectionsView.getScrollPosition(),
				items: this.itemsView.getSelectedObjects().map(object => object.treeViewID),
				itemsScroll: this.itemsView.getScrollPosition() || null,
				quickSearch: this.getElement('zotero-tb-search').value,
				advancedSearch,
				tags: {
					selected: this.tagSelector ? [...this.tagSelector.getTagSelection()] : [],
					filter: this.tagSelector ? this.tagSelector.searchString : ''
				}
			};
		}
		
		/**
		 * Show a library view captured by captureLibraryTabState()
		 *
		 * @param {Object} [state]
		 * @return {Promise}
		 */
		restoreLibraryTabState(state) {
			this._libraryTabStateRestores++;
			this._libraryTabStatePromise = (async () => {
				try {
					await this._restoreLibraryTabState(state || {});
				}
				catch (e) {
					Zotero.logError(e);
				}
				finally {
					this._libraryTabStateRestores--;
				}
			})();
			return this._libraryTabStatePromise;
		}
		
		/**
		 * Wait for any in-progress restore of the library view
		 *
		 * @return {Promise}
		 */
		waitForLibraryTabState() {
			return this._libraryTabStatePromise;
		}
		
		_restoreLibraryTabState = Zotero.serial(async function (state) {
			if (!this.collectionsView) {
				return;
			}
			await this.collectionsView.waitForLoad();
			
			// Show the loading message only if the collection selection is changing, so that a
			// window that opens with the collection already selected keeps its loaded items
			// list showing
			let itemsPaneMessageShown = !Zotero.Utilities.arrayEquals(
				this.getCollectionTreeRows().map(row => row.id).sort(),
				(state.collections || []).slice().sort()
			);
			if (itemsPaneMessageShown) {
				this.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
			}
			
			// Set the Advanced Search first, so that a collection change applies it to the new rows
			this._restoreAdvancedSearchState(state.advancedSearch);
			
			let selected = await this.collectionsView.restoreSelection(state.collections, {
				focusedID: state.focusedCollection,
				scrollTop: state.collectionsScrollTop
			});
			if (!selected) {
				let libraryID = this._getLibraryIDFromRowID(state.collections?.[0]);
				if (!libraryID || !(await this.collectionsView.selectLibrary(libraryID))) {
					await this.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
				}
			}
			// Let any queued collection selection finish before reapplying the filters it clears
			await this.onCollectionSelected();
			await this.itemsView.waitForLoad();
			
			// Reapply the quick search, tag filter, and Advanced Search together, so that the
			// items list refreshes once
			let searchText = state.quickSearch || '';
			let tags = new Set(state.tags?.selected || []);
			let mode = Zotero.Prefs.get('search.quicksearch-mode');
			// A quick search with conditions in it is run as a search, as search() does
			let query = Zotero.SearchQuery.getSearch(searchText, { mode });
			this._quickSearchIsQuery = !!query;
			let text = query ? '' : Zotero.SearchQuery.parse(searchText).text;
			let advancedSearch = query || this._getActiveAdvancedSearch();
			let searchBox = this.getElement('zotero-tb-search');
			searchBox.value = searchText;
			searchBox.updateMode();
			if (this.tagSelector) {
				this.tagSelector.setTagSelection(tags);
				this.tagSelector.handleSearch(state.tags?.filter || '');
			}
			let changed = false;
			for (let collectionTreeRow of this.itemsView.collectionTreeRows) {
				changed = collectionTreeRow.setSearch(text, mode) || changed;
				changed = collectionTreeRow.setTags(tags) || changed;
				changed = collectionTreeRow.setAdvancedSearch(advancedSearch) || changed;
			}
			if (changed) {
				if (!itemsPaneMessageShown) {
					itemsPaneMessageShown = true;
					this.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
				}
				await this.itemsView.refresh();
			}
			if (itemsPaneMessageShown) {
				this.clearItemsPaneMessage();
			}
			
			let selectedCount = state.items?.length
				? await this.itemsView.selectItems(state.items, true, true)
				: 0;
			if (!selectedCount && this.itemsView.selection.count) {
				this.itemsView.selection.clearSelection();
			}
			this.itemsView.setScrollPosition(state.itemsScroll);
		});
		
		/**
		 * Show or reset the Advanced Search pane for a library tab state
		 *
		 * @param {Object} [state] - The advancedSearch property of a library view state. If
		 *     not present, or if it edits a saved search that no longer exists, the pane is
		 *     reset and closed.
		 */
		_restoreAdvancedSearchState(state) {
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			let savedSearch = state?.type === 'saved' && Zotero.Searches.get(state.savedSearchID);
			if (!state || (state.type === 'saved' && !savedSearch)) {
				deck.selectedSearchType = 'temporary';
				deck.state = 'closed';
				deck.pane.search = null;
			}
			else {
				deck.selectedSearchType = state.type;
				deck.state = state.state;
				if (savedSearch) {
					deck.pane.search = savedSearch;
					if (state.search) {
						deck.pane.search.fromJSON(state.search);
					}
					deck.pane.savedSearchName = state.savedSearchName;
				}
				else {
					let search = null;
					if (state.search) {
						search = new Zotero.Search();
						// A library is required to clone the search; the pane's refresh() sets
						// the one the selected rows belong to
						search.libraryID = state.libraryID || Zotero.Libraries.userLibraryID;
						search.fromJSON(state.search);
					}
					deck.pane.search = search;
				}
				deck.pane.active = state.active;
			}
			this.getElement('zotero-tb-search').updateMode();
		}
		
		/**
		 * Prompt to save changes in the open saved-search editor and close it
		 *
		 * If the editor has no changes to save, or if the search being edited was deleted or
		 * trashed, leaving nothing to save the changes to, the editor is closed without a prompt.
		 *
		 * @return {Promise<Boolean>} - False if the user chose Cancel, leaving the editor open
		 */
		async _confirmCloseSavedSearchEditor() {
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			let editedSearch = Zotero.Searches.get(deck.pane.editedSearchID);
			if (!editedSearch || editedSearch.deleted || !deck.pane.hasChanges) {
				await deck.pane.cancel();
				return true;
			}
			let result = Zotero.Prompt.confirm({
				window,
				title: Zotero.getString('saved-search-close-confirmation-title'),
				text: Zotero.getString('saved-search-close-confirmation-body'),
				button0: Zotero.Prompt.BUTTON_TITLE_SAVE,
				button1: Zotero.Prompt.BUTTON_TITLE_CANCEL,
				button2: Zotero.Prompt.BUTTON_TITLE_DONT_SAVE
			});
			switch (result) {
				case 0:
					await deck.pane.save();
					return true;
				case 1:
					return false;
				default:
					await deck.pane.cancel();
					return true;
			}
		}
		
		/**
		 * @param {'open' | 'collapsed' | 'closed'} state
		 * @param {Boolean} [skipRefresh=false] - Don't refresh the items view
		 */
		async setAdvancedSearchState(state, { skipRefresh = false } = {}) {
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			// Replacing or closing the saved-search editor discards its working copy, so
			// prompt to save changes first, as when switching collections
			if (deck.state === 'open' && deck.selectedSearchType === 'saved') {
				if (!(await this._confirmCloseSavedSearchEditor())) {
					return;
				}
				// The editor is now closed, which is all a close or collapse needs; only
				// opening the temporary pane continues
				if (state !== 'open') {
					return;
				}
			}
			let oldState = deck.state;
			deck.selectedSearchType = 'temporary';
			deck.state = state;
			
			let advancedSearchPane = deck.pane;
			
			this.getElement('zotero-tb-search').updateMode();
			let refreshPromise;
			if (!skipRefresh && !(state === 'open' && oldState === 'collapsed'
					|| state === 'collapsed' && oldState === 'open')) {
				// State change changes displayed items - refresh the tree
				refreshPromise = this._refreshAdvancedSearchPane();
			}
			
			// Update the pane state synchronously, so that a state change initiated
			// while the refresh below is pending doesn't see a stale search
			if (state === 'closed') {
				advancedSearchPane.search = null;
			}
			else if (state === 'open') {
				Zotero_Tabs.selectLibraryTab();
				advancedSearchPane.focus();
			}
			
			await refreshPromise;
		}
		
		/**
		 * @param {'open' | 'collapsed' | 'closed'} state
		 */
		async toggleAdvancedSearchState(state) {
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			if (state === deck.state && deck.selectedSearchType !== 'saved') {
				// If we're trying to open the pane, and it's already open but not focused,
				// focus it
				if (state === 'open' && !deck.pane.matches(':focus-within')) {
					deck.pane.focus();
					return;
				}
				
				// Flip the state
				switch (state) {
					case 'open':
						state = 'closed';
						break;
					case 'collapsed':
					case 'closed':
						state = 'open';
						break;
				}
			}
			await this.setAdvancedSearchState(state);
		}
		
		/**
		 * Build a search from the quick search text, reproducing the quick search mode as
		 * editable conditions
		 *
		 * @param {String} searchText
		 * @param {String} mode - The quick search mode to reproduce
		 * @return {Zotero.Search|null} - Null if the text contains no conditions or words
		 */
		_buildSearchFromQuickSearch(searchText, mode) {
			// Conditions written in the query ("tag:foo") become conditions in the
			// search; what's left is split into words (keeping quoted phrases
			// intact), as the quick search does
			let { tree, text } = Zotero.SearchQuery.parse(searchText);
			let parts = Zotero.SearchConditions.parseSearchString(text);
			if (!parts.length && !tree) {
				return null;
			}
			
			let search = new Zotero.Search();
			let libraryID = this.collectionsView?.getSelectedLibraryIDs()[0];
			if (libraryID) {
				search.libraryID = libraryID;
			}
			
			// Reproduce the quick search mode as editable conditions, one per word joined
			// with "all": Title/Creator/Year and All Fields & Tags each map to a single
			// condition, Everything to an "any" group of Any Field plus full-text.
			// Title/Creator/Year matches only top-level items, so set the result level to item.
			if (tree) {
				// The words are joined to the conditions with "all", so an "any"
				// query becomes a group rather than something they're OR'd into
				Zotero.SearchQuery.addToSearch(search, parts.length && tree.joinMode === 'any'
					? { joinMode: 'all', children: [tree] }
					: tree);
			}
			if (mode === 'titleCreatorYear') {
				search.addCondition('resultLevel', 'item');
			}
			for (let part of parts) {
				if (mode === 'everything') {
					search.addCondition('groupStart', 'true', '');
					search.addCondition('joinMode', 'any');
					search.addCondition('anyField', 'contains', part.text);
					search.addCondition('fulltextContent', 'contains', part.text);
					search.addCondition('groupEnd', 'true', '');
				}
				else if (mode === 'titleCreatorYear') {
					search.addCondition('titleCreatorYear', 'contains', part.text);
				}
				else {
					search.addCondition('anyField', 'contains', part.text);
				}
			}
			return search;
		}
		
		/**
		 * Open the Advanced Search pane seeded from the quick search text, reproducing
		 * the current quick search mode as editable conditions.
		 *
		 * The quick search field is cleared, since its text now lives in the Advanced
		 * Search. Closing the Advanced Search resets to an unfiltered view.
		 *
		 * @param {String} searchText
		 * @param {String} [mode='fields'] - The quick search mode to reproduce
		 */
		async openAdvancedSearchFromQuickSearch(searchText, mode = 'fields') {
			let search = this._buildSearchFromQuickSearch(searchText, mode);
			if (!search) {
				await this.toggleAdvancedSearchState('open');
				return;
			}
			
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			
			// Show the Advanced Search and seed it, without yet touching the items list,
			// so that the quick search results stay visible until they're replaced below
			deck.selectedSearchType = 'temporary';
			deck.state = 'open';
			deck.pane.search = search;
			deck.pane.refresh();
			
			// Clear the quick search text and every selected row's filter (without their own
			// refresh), so the field doesn't flash empty and closing Advanced Search returns
			// to an unfiltered view. The submit() below replaces the results in place.
			let searchBox = this.getElement('zotero-tb-search');
			searchBox.updateMode();
			searchBox.value = '';
			for (let collectionTreeRow of this.itemsView.collectionTreeRows) {
				collectionTreeRow.setSearch('');
			}
			
			Zotero_Tabs.selectLibraryTab();
			await deck.pane.submit();
			// Focus the first condition so the user can refine the seeded search
			deck.pane.focus();
		}
		
		/**
		 * Open a new main window showing this view's collection selection with the Advanced
		 * Search pane open
		 *
		 * If searchText contains conditions or words, the new window's search is seeded from it,
		 * reproducing the quick search mode as editable conditions, and run against the new
		 * window's items list. This view's quick search is left in place.
		 *
		 * @param {String} [searchText]
		 * @param {String} [mode='fields'] - The quick search mode to reproduce
		 */
		openAdvancedSearchInNewWindow(searchText, mode = 'fields') {
			let { state } = this._getAdvancedSearchTabData(searchText, mode);
			return Zotero.openMainWindow({ libraryTabState: state });
		}
		
		/**
		 * Open a new library tab with this view's collection selection and the Advanced Search
		 * open, seeded with the given quick search. This view's quick search is left in place.
		 *
		 * @param {String} [searchText]
		 * @param {String} [mode='fields'] - The quick search mode to reproduce
		 */
		openAdvancedSearchInNewTab(searchText, mode = 'fields') {
			let data = this._getAdvancedSearchTabData(searchText, mode);
			Zotero_Tabs.addLibraryTab({
				...data,
				selectOptions: { focusElementID: 'zotero-advanced-search-pane-deck' }
			});
		}
		
		/**
		 * @return {Object} - { title, icon, state } for a library tab or window showing the
		 *     Advanced Search, seeded with the given quick search, in the configured new-tab
		 *     target
		 */
		_getAdvancedSearchTabData(searchText, mode) {
			let data = ZoteroPane.getNewLibraryTabData();
			let search = searchText ? this._buildSearchFromQuickSearch(searchText, mode) : null;
			// Search the library of the collection the new tab shows
			let match = search && data.state.collections?.[0]?.match(/^([CL])(\d+)$/);
			if (match) {
				let id = parseInt(match[2]);
				let libraryID = match[1] == 'C' ? Zotero.Collections.get(id)?.libraryID : id;
				if (libraryID) {
					search.libraryID = libraryID;
				}
			}
			data.state.advancedSearch = {
				state: 'open',
				type: 'temporary',
				active: !!search,
				search: search ? search.toJSON() : null,
				libraryID: search ? search.libraryID : null
			};
			return data;
		}
		
		/**
		 * @param {'open' | 'closed'} state
		 */
		async setSavedSearchEditorState(state) {
			let collectionTreeRow = this.getCollectionTreeRows()[0];
			if (state === 'open' && !collectionTreeRow.isSearch()) {
				throw new Error('Cannot show saved search editor outside search row');
			}
			
			let deck = this.getElement('zotero-advanced-search-pane-deck');
			deck.selectedSearchType = 'saved';
			deck.state = state;
			
			if (state === 'open') {
				deck.pane.search = collectionTreeRow.ref;
			}
			
			this.getElement('zotero-tb-search').updateMode();
			let refreshPromise = this._refreshAdvancedSearchPane();
			if (state === 'open') {
				deck.pane.focus();
			}
			await refreshPromise;
		}
		
		async clearQuicksearch(skipSearchRun) {
			var search = this.getElement('zotero-tb-search');
			if (search.searchTextbox.value !== '') {
				search.searchTextbox.value = '';
				if (!skipSearchRun) {
					await this.search();
				}
				return true;
			}
			return false;
		}
		
		/**
		 * Some keys trigger an immediate search
		 */
		handleSearchKeypress(textbox, event) {
			if (event.keyCode == event.DOM_VK_ESCAPE) {
				if (textbox.searchTextbox.value) {
					textbox.searchTextbox.value = '';
					this.search();
				}
				else {
					this.itemsView?.focus();
				}
			}
			else if (event.keyCode == event.DOM_VK_RETURN) {
				this.search(true);
			}
		}
		
		/**
		 * @return {Promise}
		 */
		async search(runAdvanced) {
			if (!this.itemsView) {
				return;
			}
			var search = this.getElement('zotero-tb-search');
			var searchVal = search.searchTextbox.value;
			if (!runAdvanced && Zotero.SearchQuery.hasOpenQuote(searchVal)) {
				return;
			}
			var spinner = this.getElement('zotero-tb-search-spinner');
			spinner.setAttribute("status", "animate");
			spinner.style.visibility = 'visible';
			// A query with conditions in it ("by:smith crispr") filters by those
			// and matches whatever text is left over the way the current mode
			// does; anything else is text to search for, as typed
			// Each selected row scopes the query to its own library, so the query
			// carries none of its own -- with one, a multi-library selection would
			// match only in that library
			let query = Zotero.SearchQuery.getSearch(searchVal, {
				mode: Zotero.Prefs.get('search.quicksearch-mode')
			});
			if (query) {
				this._quickSearchIsQuery = true;
				await this.itemsView.setFilter('search', '');
				await this.itemsView.setFilter('advanced-search', query);
			}
			else {
				// Only clear a search this set, so an open Advanced Search keeps
				// its own
				if (this._quickSearchIsQuery) {
					this._quickSearchIsQuery = false;
					await this.itemsView.setFilter('advanced-search', null);
				}
				// A condition whose value hasn't been typed yet is left out of the
				// text, so completing a condition name doesn't search for it
				await this.itemsView.setFilter('search',
					Zotero.SearchQuery.parse(searchVal).text);
			}
			spinner.style.removeProperty("visibility");
			spinner.removeAttribute("status");
		}
		
		// Sets the itemsView message.
		// The message is displayed using an HTML/CSS mechanism inside the items tree,
		// but it is not as robust as XUL. Unfortunately we cannot use the original XUL
		// version since it causes terrible layout issues when mixing XUL and HTML
		setItemsPaneMessage(content, lock) {
			if (this._itemsPaneMessageLocked) {
				return;
			}
			
			// Make message permanent
			if (lock) {
				this._itemsPaneMessageLocked = true;
			}
			
			if (this.itemsView) {
				this.itemsView.setItemsPaneMessage(content, lock);
			}
		}
		
		clearItemsPaneMessage() {
			// If message box is locked, don't clear
			if (this._itemsPaneMessageLocked) {
				return;
			}
			
			if (this.itemsView) {
				this.itemsView.clearItemsPaneMessage();
			}
		}
		
		setUpKeyboardNavigation() {
			let moveFocus = ZoteroPane.moveFocusForActionsMap;
			let collectionTreeToolbar = this.getElement("zotero-toolbar-collection-tree");
			let itemTreeToolbar = this.getElement("zotero-toolbar-item-tree");
			let itemTree = this.getElement("zotero-items-tree");
			let collectionsTree = this.getElement("zotero-collections-tree");
			let tagSelector = this.getElement("zotero-tag-selector");
			let tagContainer = this.getElement('zotero-tag-selector-container');
			let collectionsPane = this.getElement("zotero-collections-pane");
			
			let collectionsSearchField = this.getElement("zotero-collections-search");
			let clearCollectionSearch = () => {
				// If empty filter - just focus the collectionTree
				if (collectionsSearchField.value.length == 0) {
					return this.getElement(this.collectionsView.id);
				}
				// Clear the search field and focus collection tree
				if (collectionsSearchField.value.length) {
					collectionsSearchField.value = '';
					this.collectionsView.setFilter("", true);
				}
				this.hideCollectionSearch();
				return null;
			};
			let focusCollectionTree = () => {
				// Prevent Enter/Tab pressed before the filtering ran from doing anything
				if (!this.collectionsView.filterEquals(collectionsSearchField.value)) {
					return null;
				}
				// If the current row passes the filter, make sure it is visible and focus collectionTree
				if (this.collectionsView.focusedRowMatchesFilter()) {
					this.collectionsView.ensureRowIsVisible(this.collectionsView.selection.focused);
					return this.getElement(this.collectionsView.id);
				}
				// Otherwise, focus the first row passing the filter
				this.collectionsView.focusFirstMatchingRow(false);
				return null;
			};
			collectionTreeToolbar.addEventListener("keydown", (event) => {
				let actionsMap = {
					'zotero-tb-collection-add': {
						ArrowNext: () => null,
						ArrowPrevious: () => null,
						Tab: () => this.getElement('zotero-tb-collections-search').click(),
						ShiftTab: () => document.getElementById('zotero-tb-sync')
					},
					'zotero-collections-search': {
						Tab: focusCollectionTree,
						ShiftTab: () => this.getElement('zotero-tb-collection-add'),
						Enter: focusCollectionTree,
						Escape: clearCollectionSearch
					},
				};
				moveFocus(actionsMap, event, true);
			});
			
			itemTreeToolbar.addEventListener("keydown", (event) => {
				let actionsMap = {
					'zotero-tb-add': {
						ArrowNext: () => this.getElement("zotero-tb-lookup"),
						ArrowPrevious: () => null,
						Tab: () => this.getElement("zotero-tb-search").focus(),
						ShiftTab: () => {
							if (collectionsPane.hasAttribute("collapsed")) {
								return document.getElementById('zotero-tb-sync');
							}
							if (tagContainer.hasAttribute('collapsed')) {
								return focusCollectionTree();
							}
							return tagSelector.querySelector("button");
						}
					},
					'zotero-tb-lookup': {
						ArrowNext: () => this.getElement("zotero-tb-attachment-add"),
						ArrowPrevious: () => this.getElement("zotero-tb-add"),
						Tab: () => this.getElement("zotero-tb-search").focus(),
						ShiftTab: () => this.getElement('zotero-tb-collections-search').click(),
						Enter: () => Zotero_Lookup.showPanel(event.target),
						' ': () => Zotero_Lookup.showPanel(event.target)
					},
					'zotero-tb-attachment-add': {
						ArrowNext: () => this.getElement("zotero-tb-note-add"),
						ArrowPrevious: () => this.getElement("zotero-tb-lookup"),
						Tab: () => this.getElement("zotero-tb-search").focus(),
						ShiftTab: () => this.getElement('zotero-tb-collections-search').click()
					},
					'zotero-tb-note-add': {
						ArrowNext: () => null,
						ArrowPrevious: () => this.getElement("zotero-tb-attachment-add"),
						Tab: () => this.getElement("zotero-tb-search").focus(),
						ShiftTab: () => this.getElement('zotero-tb-collections-search').click()
					},
					'zotero-tb-search-dropmarker': {
						ArrowNext: () => null,
						ArrowPrevious: () => null,
						Tab: () => this.getElement("zotero-tb-search-textbox"),
						ShiftTab: () => this.getElement('zotero-tb-add')
					},
					'advanced-collapse-button': {
						ShiftTab: () => this.getElement('zotero-tb-add')
					},
					'zotero-tb-search-textbox': {
						Tab: () => this.getElement("zotero-tb-search-advanced-button"),
						ShiftTab: () => this.getElement("zotero-tb-search").focus()
					},
					'zotero-tb-search-advanced-button': {
						Tab: () => this.getElement("zotero-tb-toggle-item-pane-stacked"),
						ShiftTab: () => this.getElement("zotero-tb-search-textbox")
					},
					'zotero-tb-toggle-item-pane-stacked': {
						Tab: () => itemTree.querySelector(".virtualized-table"),
						ShiftTab: () => this.getElement("zotero-tb-search-advanced-button")
					},
				};
				moveFocus(actionsMap, event, true);
			});
			
			collectionsTree.addEventListener("keydown", (event) => {
				let actionsMap = {
					[this.collectionsView?.id]: {
						ShiftTab: () => this.getElement('zotero-tb-collections-search').click(),
						Tab: () => {
							if (tagContainer.hasAttribute('collapsed')) {
								return this.getElement('zotero-tb-add');
							}
							// If tag selector is collapsed, go to "New item" button, otherwise focus tag selector
							if (this.tagSelector.isTagListEmpty()) {
								return tagSelector.querySelector(".search-input");
							}
							this.tagSelector.focusTagList();
							return null;
						},
						Escape: clearCollectionSearch
					}
				};
				moveFocus(actionsMap, event);
			});
			
			itemTree.addEventListener("keydown", (event) => {
				let actionsMap = {
					// The item tree's DOM id has a view-specific suffix, so key on the current view's id
					[this.itemsView?.id]: {
						ShiftTab: () => {
							let advancedSearchDeck = this.getElement('zotero-advanced-search-pane-deck');
							// Advanced Search open - focus the last focusable element of the deck
							if (advancedSearchDeck?.state === 'open') {
								Services.focus.moveFocus(
									window,
									this.getElement('zotero-items-pane'),
									Services.focus.MOVEFOCUS_BACKWARD,
									0
								);
								return null;
							}
							// Advanced Search collapsed - focus the close button
							if (advancedSearchDeck?.state === 'collapsed') {
								return this.getElement('zotero-tb-search').querySelector('.advanced-close-button');
							}
							return this.getElement('zotero-tb-toggle-item-pane-stacked');
						}
					}
				};
				moveFocus(actionsMap, event);
			});
			
			tagSelector.addEventListener("keydown", (e) => {
				let actionsMap = {
					'search-input': {
						Tab: () => tagSelector.querySelector('.tag-selector-actions'),
						ShiftTab: () => {
							if (this.tagSelector.isTagListEmpty()) {
								return this.getElement(this.collectionsView.id);
							}
							this.tagSelector.focusTagList();
							return null;
						},
					},
					'tag-selector-item': {
						Tab: () => tagSelector.querySelector(".search-input"),
						ShiftTab: () => this.getElement(this.collectionsView.id),
					},
					'tag-selector-actions': {
						Tab: () => this.getElement('zotero-tb-add'),
						ShiftTab: () => tagSelector.querySelector(".search-input")
					},
					'tag-selector-list': {
						Tab: () => tagSelector.querySelector(".search-input"),
						ShiftTab: () => this.getElement(this.collectionsView.id),
					}
				};
				moveFocus(actionsMap, e);
			});
		}
	}
	
	customElements.define('library-view', LibraryView);
}
