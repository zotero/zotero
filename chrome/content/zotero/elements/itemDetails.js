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
	const waitFrame = async () => {
		return waitNoLongerThan(new Promise((resolve) => {
			requestAnimationFrame(resolve);
		}), 30);
	};
	
	const waitFrames = async (n) => {
		for (let i = 0; i < n; i++) {
			await waitFrame();
		}
	};

	const waitDOMUpdate = async (timeout = 50) => {
		return new Promise((resolve) => {
			requestIdleCallback(resolve, { timeout });
		});
	};

	const waitNoLongerThan = async (promise, ms = 1000) => {
		return Promise.race([
			promise,
			Zotero.Promise.delay(ms)
		]);
	};

	class ItemDetails extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<hbox id="zotero-view-item-container" class="zotero-view-item-container" flex="1">
				<html:div class="zotero-view-item-main">
					<item-pane-header id="zotero-item-pane-header" />
					
					<html:div id="zotero-view-item" class="zotero-view-item" tabindex="0" data-l10n-id="item-details-pane">
						<info-box id="zotero-editpane-info-box" data-pane="info"/>
						
						<abstract-box id="zotero-editpane-abstract" class="zotero-editpane-abstract" data-pane="abstract"/>

						<attachments-box id="zotero-editpane-attachments" data-pane="attachments"/>

						<notes-box id="zotero-editpane-notes" class="zotero-editpane-notes" data-pane="notes"/>

						<attachment-box id="zotero-attachment-box" data-pane="attachment-info" data-use-preview="true" hidden="true"/>
						
						<attachment-annotations-box id="zotero-editpane-attachment-annotations" data-pane="attachment-annotations" hidden="true"/>
						
						<libraries-collections-box id="zotero-editpane-libraries-collections" class="zotero-editpane-libraries-collections" data-pane="libraries-collections"/>

						<tags-box id="zotero-editpane-tags" class="zotero-editpane-tags" data-pane="tags"/>

						<related-box id="zotero-editpane-related" class="zotero-editpane-related" data-pane="related"/>
					</html:div>
				</html:div>
			</hbox>
		`);

		get item() {
			return this._item;
		}

		set item(item) {
			this._item = item;
		}

		/*
		 * For contextPane update
		 */
		get parentID() {
			return this._cachedParentID;
		}

		set parentID(parentID) {
			this._cachedParentID = parentID;
		}

		get editable() {
			return this._editable;
		}

		set editable(editable) {
			this._editable = editable;
			this.toggleAttribute('readonly', !editable);
		}

		get tabID() {
			return this._tabID;
		}
	
		set tabID(tabID) {
			this._tabID = tabID;
		}

		get tabType() {
			return this.getAttribute('tabType');
		}

		set tabType(tabType) {
			this.setAttribute('tabType', tabType);
		}
		
		get collectionTreeRow() {
			return this._collectionTreeRow;
		}
		
		set collectionTreeRow(collectionTreeRow) {
			this._collectionTreeRow = collectionTreeRow;
		}

		get pinnedPane() {
			return this.getAttribute('pinnedPane');
		}
		
		set pinnedPane(val) {
			if (val && !this.getEnabledPane(val)) {
				// Store pinned pane because custom sections may not be ready yet
				this._pendingPinnedPane = val;
				val = '';
			}
			this.setAttribute('pinnedPane', val || '');
			if (val) {
				this._pendingPinnedPane = '';
				this._pinnedPaneMinScrollHeight = this._getMinScrollHeightForPane(this.getEnabledPane(val));
			}
			this.sidenav.updatePaneStatus(val);
			this._savePinnedPane();
		}

		get _minScrollHeight() {
			return parseFloat(this._paneParent.style.getPropertyValue('--min-scroll-height') || 0);
		}
		
		set _minScrollHeight(val) {
			this._paneParent.style.setProperty('--min-scroll-height', val + 'px');
		}

		get _collapsed() {
			let collapsible = this.closest('splitter:not([hidden="true"]) + *');
			if (!collapsible) return false;
			return collapsible.getAttribute('collapsed') === 'true';
		}
		
		set _collapsed(val) {
			let collapsible = this.closest('splitter:not([hidden="true"]) + *');
			if (!collapsible) return;
			let splitter = collapsible.previousElementSibling;
			if (val) {
				collapsible.setAttribute('collapsed', 'true');
				collapsible.removeAttribute("width");
				collapsible.removeAttribute("height");
				splitter.setAttribute('state', 'collapsed');
				splitter.setAttribute('substate', 'after');
			}
			else {
				collapsible.removeAttribute('collapsed');
				splitter.setAttribute('state', '');
				splitter.setAttribute('substate', 'after');
			}
			window.dispatchEvent(new Event('resize'));
		}

		get sidenav() {
			return this._sidenav;
		}

		set sidenav(sidenav) {
			this._sidenav = sidenav;
			sidenav.container = this;
			// Manually update once and further changes will be synced automatically to sidenav
			this.forceUpdateSideNav();
		}

		get skipRender() {
			return this._skipRender;
		}

		set skipRender(val) {
			this._skipRender = val;
			let panes = this.getPanes();
			for (let pane of [this._header, ...panes]) {
				pane.skipRender = val;
			}
		}

		static get observedAttributes() {
			return ['pinnedPane'];
		}

		init() {
			this._container = this.querySelector('#zotero-view-item-container');
			this._header = this.querySelector('#zotero-item-pane-header');
			this._paneParent = this.querySelector('#zotero-view-item');

			this._container.addEventListener("keydown", this._handleKeydown);
			this._paneParent.addEventListener('scroll', this._handleContainerScroll);

			this._paneHiddenOb = new MutationObserver(this._handlePaneStatus);
			this._paneHiddenOb.observe(this._paneParent, {
				attributes: true,
				attributeFilter: ["hidden"],
				subtree: true,
			});
			this._initIntersectionObserver();

			this._notifierID = Zotero.Notifier.registerObserver(
				this, ['item', 'itempane', 'tab'], 'ItemDetails');
			this._prefsObserverID = Zotero.Prefs.registerObserver('pinnedPane', this._restorePinnedPane.bind(this));

			this._disableScrollHandler = false;
			this._pinnedPaneMinScrollHeight = 0;

			this._lastUpdateCustomSection = "";

			this._lastScrollTop = 0;

			// If true, will render on tab select
			this._pendingRender = false;
			// If true, will skip render
			this._skipRender = false;
		}

		destroy() {
			this._container.removeEventListener("keydown", this._handleKeydown);
			this._paneParent.removeEventListener('scroll', this._handleContainerScroll);

			this._paneHiddenOb.disconnect();
			this._intersectionOb.disconnect();

			Zotero.Notifier.unregisterObserver(this._notifierID);
			Zotero.Prefs.unregisterObserver(this._prefsObserverID);
		}

		async render() {
			if (!this.initialized || !this.item) {
				return;
			}

			if (this.skipRender) {
				this._pendingRender = true;
				return;
			}
			this._pendingRender = false;

			let item = this.item;
			Zotero.debug('Viewing item');
			this._isRendering = true;
			// For tests
			let resolve;
			if (Zotero.test) {
				this._renderPromise = new Promise(r => resolve = r);
			}

			this.renderCustomSections();
			this._restorePinnedPane();

			let panes = this.getPanes();

			// Unobserve intersection to prevent unwanted rendering.
			// Checking flags in _handleIntersection is not reliable because it's async.
			this._toggleIntersectionObserver(false);

			for (let box of [this._header, ...panes]) {
				box.editable = this.editable;
				box.tabID = this.tabID;
				box.tabType = this.tabType;
				box.item = item;
				box.collectionTreeRow = this.collectionTreeRow;
				// Discard hidden panes
				if (box.hidden && box.discard) {
					box.discard();
				}
				// Execute sync render immediately
				if (!box.hidden && box.render) {
					box.render();
				}
			}

			let pinnedPaneElem = this.getEnabledPane(this.pinnedPane);
			let pinnedIndex = panes.indexOf(pinnedPaneElem);
			
			this._paneParent.style.paddingBottom = '';
			if (pinnedPaneElem) {
				let paneID = pinnedPaneElem.dataset.pane;
				await this.scrollToPane(paneID, 'instant');
				this.pinnedPane = paneID;
			}
			else {
				// Keep the scroll position after reordering
				this._paneParent.scrollTo(0, this._lastScrollTop);
				this._lastScrollTop = 0;
			}

			// Only execute async render for visible panes
			for (let box of panes) {
				if (!box.asyncRender) {
					continue;
				}
				if (pinnedIndex > -1 && panes.indexOf(box) < pinnedIndex) {
					continue;
				}
				if (!this.isPaneVisible(box.dataset.pane)) {
					continue;
				}
				await waitNoLongerThan(box.asyncRender(), 500);
				// Make sure the layout is updated for next isPaneVisible check
				await waitDOMUpdate();
			}

			if (this.item.id == item.id) {
				this._isRendering = false;
			}

			// Re-enable intersection observer
			this._toggleIntersectionObserver(true);

			if (Zotero.test) {
				resolve();
			}
		}

		renderCustomSections() {
			let { options: targetPanes, updateID } = Zotero.ItemPaneManager.customSectionData;
			if (this._lastUpdateCustomSection == updateID) return;
			this._lastUpdateCustomSection = updateID;

			let currentPaneElements = this.getCustomPanes();
			// Remove
			for (let elem of currentPaneElements) {
				let elemPaneID = elem.dataset.pane;
				if (targetPanes.find(pane => pane.paneID == elemPaneID)) continue;
				this._intersectionOb.unobserve(elem);
				elem.remove();
				this.sidenav.removePane(elemPaneID);
			}
			// Create
			let currentPaneIDs = currentPaneElements.map(elem => elem.dataset.pane);
			for (let section of targetPanes) {
				let { paneID, header, sidenav, bodyXHTML,
					onInit, onDestroy, onItemChange, onRender, onAsyncRender, onToggle,
					sectionButtons } = section;
				if (currentPaneIDs.includes(paneID)) continue;
				let elem = document.createXULElement("item-pane-custom-section");
				elem.dataset.sidenavOptions = JSON.stringify(sidenav || {});
				elem.paneID = paneID;
				elem.bodyXHTML = bodyXHTML;
				elem.registerSectionIcon({ icon: header.icon, darkIcon: header.darkIcon });
				elem.registerHook({ type: "init", callback: onInit });
				elem.registerHook({ type: "destroy", callback: onDestroy });
				elem.registerHook({ type: "itemChange", callback: onItemChange });
				elem.registerHook({ type: "render", callback: onRender });
				elem.registerHook({ type: "asyncRender", callback: onAsyncRender });
				elem.registerHook({ type: "toggle", callback: onToggle });
				if (sectionButtons) {
					for (let buttonOptions of sectionButtons) {
						elem.registerSectionButton(buttonOptions);
					}
				}
				if (this._pendingRender) {
					elem.pendingRender = true;
				}
				this._paneParent.append(elem);
				elem.setL10nID(header.l10nID);
				elem.setL10nArgs(header.l10nArgs);
				this._intersectionOb.observe(elem);
				this.sidenav.addPane(paneID);
				this.sidenav.updatePaneStatus(paneID);
			}
			// Update pending pinned pane
			if (this._pendingPinnedPane && this.getEnabledPane(this._pendingPinnedPane)) {
				this.pinnedPane = this._pendingPinnedPane;
			}

			if (this.sidenav) {
				this.initPaneOrder(this.sidenav.getPersistedOrder());
			}
		}

		renderCustomHead(callback) {
			this._header.renderCustomHead(callback);
		}

		notify = async (action, type, ids, _extraData) => {
			if (action == 'refresh' && this.item) {
				if (type == 'itempane') {
					this.renderCustomSections();
				}
				await this.render();
			}

			if (action == 'select' && type == 'tab') {
				this._handleTabSelect(ids);
			}
		};

		getPane(id) {
			return this._paneParent.querySelector(`:scope > [data-pane="${CSS.escape(id)}"]`);
		}

		getEnabledPane(id) {
			return this._paneParent.querySelector(`:scope > [data-pane="${CSS.escape(id)}"]:not([hidden])`);
		}

		getPanes() {
			return Array.from(this._paneParent.querySelectorAll(':scope > [data-pane]'));
		}

		getEnabledPanes() {
			return Array.from(this._paneParent.querySelectorAll(':scope > [data-pane]:not([hidden])'));
		}

		getVisiblePanes() {
			let panes = this.getPanes();
			let visiblePanes = [];
			for (let paneElem of panes) {
				if (this.isPaneVisible(paneElem.dataset.pane)) {
					visiblePanes.push(paneElem);
				}
				else if (visiblePanes.length > 0) {
					// Early stop at first invisible pane after some visible panes
					break;
				}
			}
			return visiblePanes;
		}

		getCustomPanes() {
			return Array.from(this._paneParent.querySelectorAll(':scope > item-pane-custom-section[data-pane]'));
		}

		isPaneVisible(paneID) {
			let paneElem = this.getEnabledPane(paneID);
			if (!paneElem) return false;
			let paneRect = paneElem.getBoundingClientRect();
			let containerRect = this._paneParent.getBoundingClientRect();
			if (paneRect.top >= containerRect.bottom || paneRect.bottom <= containerRect.top) {
				return false;
			}
			return true;
		}

		forceUpdateSideNav() {
			this.getPanes().forEach(elem => this._sidenav.updatePaneStatus(elem.dataset.pane));
		}

		initPaneOrder(order) {
			let panes = this.getPanes();
			let paneIDs = panes.map(elem => elem.dataset.pane);

			// Compare the order of paneIDs with the given order
			let isOrderDifferent = false;
			let lastOrderIdx = -1;
			for (let paneID of paneIDs) {
				let idx = order.indexOf(paneID);
				if (idx == -1) {
					continue;
				}
				if (idx < lastOrderIdx) {
					isOrderDifferent = true;
					break;
				}
				lastOrderIdx = idx;
			}

			if (!isOrderDifferent) {
				return;
			}

			// Rearrange panes according to the given order. Unordered panes will stay at the end
			for (let i = order.length - 1; i >= 0; i--) {
				let paneID = order[i];
				let idx = paneIDs.indexOf(paneID);
				if (idx == -1) {
					continue;
				}
				this._paneParent.prepend(panes[idx]);
			}
		}

		/**
		 * Change the order of panes
		 * @param {string} paneID
		 * @param {number} newIdx
		 * @param {Object} options
		 * @param {boolean} options.render - Whether to rerender panes after reordering
		 */
		async changePaneOrder(paneID, newIdx, options = {}) {

			let panes = this.getPanes();
			let paneIDs = panes.map(elem => elem.dataset.pane);
			let currentIndex = paneIDs.indexOf(paneID);
			if (currentIndex == -1) return;
			if (currentIndex == newIdx || currentIndex == newIdx - 1) return;
			let currentPane = panes[currentIndex];
			if (newIdx < panes.length) {
				this._paneParent.insertBefore(currentPane, panes[newIdx]);
			}
			else {
				this._paneParent.appendChild(currentPane);
			}

			// Rerender panes after reordering
			if (options.render !== false) {
				this._lastScrollTop = this._paneParent.scrollTop;
				await this.render();
			}
		}

		async scrollToPane(paneID, behavior = 'smooth') {
			let panes = this.getEnabledPanes();
			let paneIndex = panes.findIndex(elem => elem.dataset.pane == paneID);
			let pane = panes[paneIndex];
			if (!pane) return null;

			let scrollPromise;

			// If the itemPane is collapsed, just remember which pane needs to be scrolled to
			// when itemPane is expanded.
			if (this._collapsed) {
				return null;
			}

			// Temporarily disable intersection observer to prevent unwanted rendering
			this._toggleIntersectionObserver(false);

			// The pane should always be at the very top
			// If there isn't enough stuff below it for it to be at the top, we add padding
			// We use a ::before pseudo-element for this so that we don't need to add another level to the DOM
			this._makeSpaceForPane(pane);
			if (behavior == 'smooth') {
				this._disableScrollHandler = true;
				scrollPromise = this._waitForScroll();
				scrollPromise.then(() => this._disableScrollHandler = false);
			}
			else {
				// Wait for the next DOM update to make sure the height is updated before rendering
				scrollPromise = waitDOMUpdate();
			}
			pane.scrollIntoView({ block: 'start', behavior });
			pane.focus();
			await scrollPromise;

			// Check current and following panes for async render
			for (let i = paneIndex; i < panes.length; i++) {
				let nextPane = panes[i];
				// Stop if the pane is not visible anymore
				if (!this.isPaneVisible(nextPane.dataset.pane)) {
					break;
				}
				if (nextPane.asyncRender) {
					await nextPane.asyncRender();
					// Wait for the next DOM update to make sure the layout is updated
					await waitDOMUpdate();
				}
			}

			// Re-enable intersection observer
			this._toggleIntersectionObserver(true);
			return true;
		}
		
		_makeSpaceForPane(pane) {
			let oldMinScrollHeight = this._minScrollHeight;
			let newMinScrollHeight = this._getMinScrollHeightForPane(pane);
			if (newMinScrollHeight > oldMinScrollHeight) {
				this._minScrollHeight = newMinScrollHeight;
			}
		}
		
		_getMinScrollHeightForPane(pane) {
			let paneRect = pane.getBoundingClientRect();
			let containerRect = this._paneParent.getBoundingClientRect();
			// No offsetTop property for XUL elements
			let offsetTop = paneRect.top - containerRect.top + this._paneParent.scrollTop;
			return offsetTop + containerRect.height;
		}

		async _waitForScroll() {
			let scrollPromise = Zotero.Promise.defer();
			let lastScrollTop = this._paneParent.scrollTop;
			const checkScrollStart = () => {
				// If the scrollTop is not changed, wait for scroll to happen
				if (lastScrollTop === this._paneParent.scrollTop) {
					requestAnimationFrame(checkScrollStart);
				}
				// Wait for scroll to end
				else {
					requestAnimationFrame(checkScrollEnd);
				}
			};
			const checkScrollEnd = async () => {
				// Wait for 3 frames to make sure not further scrolls
				await waitFrames(3);
				if (lastScrollTop === this._paneParent.scrollTop) {
					scrollPromise.resolve();
				}
				else {
					lastScrollTop = this._paneParent.scrollTop;
					requestAnimationFrame(checkScrollEnd);
				}
			};
			checkScrollStart();
			// Abort after 3 seconds, which should be enough
			return Promise.race([
				scrollPromise.promise,
				Zotero.Promise.delay(3000)
			]);
		}

		async blurOpenField() {
			let panes = [this._header, ...this.getPanes()];
			for (let pane of panes) {
				if (pane.blurOpenField && pane.contains(document.activeElement)) {
					await pane.blurOpenField();
					break;
				}
			}
			this._paneParent.focus();
		}

		_initIntersectionObserver() {
			if (this._intersectionOb) {
				this._intersectionOb.disconnect();
			}
			this._intersectionOb = new IntersectionObserver(this._handleIntersection);
			this._toggleIntersectionObserver(true);
		}

		_toggleIntersectionObserver(enabled) {
			let panes = this.getPanes();
			if (enabled) {
				panes.forEach(elem => this._intersectionOb.observe(elem));
			}
			else {
				panes.forEach(elem => this._intersectionOb.unobserve(elem));
			}
		}

		_handleContainerScroll = () => {
			// Don't scroll hidden pane
			if (this.hidden || this._disableScrollHandler) return;

			let minHeight = this._minScrollHeight;
			if (minHeight) {
				let newMinScrollHeight = this._paneParent.scrollTop + this._paneParent.clientHeight;
				// Ignore overscroll (which generates scroll events on Windows 11, unlike on macOS)
				// and don't shrink below the pinned pane's min scroll height
				if (newMinScrollHeight > this._paneParent.scrollHeight
						|| this.getEnabledPane(this.pinnedPane) && newMinScrollHeight < this._pinnedPaneMinScrollHeight) {
					return;
				}
				this._minScrollHeight = newMinScrollHeight;
			}
		};

		// Keyboard navigation within the itemPane. Also handles contextPane keyboard nav
		_handleKeydown = (event) => {
			let stopEvent = () => {
				event.preventDefault();
				event.stopPropagation();
			};
			let isLibraryTab = Zotero_Tabs.selectedIndex == 0;

			// Tab from the scrollable area focuses the pinned pane if it exists
			if (event.target.classList.contains("zotero-view-item") && event.key == "Tab" && !event.shiftKey && this.pinnedPane) {
				let pane = this.getPane(this.pinnedPane);
				pane.firstChild._head.focus();
				stopEvent();
				return;
			}
			// On Escape/Enter on editable-text, return focus to the item tree or reader
			if (event.key == "Escape" || (event.key == "Enter" && event.target.classList.contains('input'))) {
				if (isLibraryTab) {
					document.querySelector('#zotero-items-tree .virtualized-table').focus();
				}
				else {
					let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
					if (reader) {
						reader.focus();
					}
				}
			}
		};

		_handlePaneStatus = (muts) => {
			for (let mut of muts) {
				let paneID = mut.target.dataset.pane;
				if (paneID) {
					this.sidenav.updatePaneStatus(paneID);
				}
			}
		};

		/**
		 * This function handles the intersection of panes with the viewport.
		 * It triggers rendering and discarding of panes based on their visibility.
		 * Panes are not rendered until they become visible in the viewport.
		 * This approach prevents unnecessary rendering of all panes at once when switching items,
		 * which can lead to slow performance and excessive battery usage,
		 * especially for slow panes, e.g. attachment preview.
		 * @param {IntersectionObserverEntry[]} entries
		 * @returns {Promise<void>}
		 */
		_handleIntersection = async (entries) => {
			if (this._isRendering) return;
			let needsRefresh = [];
			let needsDiscard = [];
			entries.forEach((entry) => {
				let targetPaneElem = entry.target;
				if (entry.isIntersecting
						&& (targetPaneElem.render || targetPaneElem.asyncRender)) {
					needsRefresh.push(targetPaneElem);
				}
				else if (targetPaneElem.discard) {
					needsDiscard.push(targetPaneElem);
				}
			});
			let needsCheckVisibility = false;
			// Sidenav is in smooth scrolling mode
			if (this._disableScrollHandler) {
				// Wait for scroll to finish
				await this._waitForScroll();
				needsCheckVisibility = true;
			}
			if (needsRefresh.length > 0) {
				needsRefresh.forEach(async (paneElem) => {
					if (needsCheckVisibility && !this.isPaneVisible(paneElem.dataset.pane)) {
						return;
					}
					if (paneElem.render) paneElem.render();
					if (paneElem.asyncRender) await paneElem.asyncRender();
				});
			}
			if (needsDiscard.length > 0) {
				needsDiscard.forEach((paneElem) => {
					if (needsCheckVisibility && this.isPaneVisible(paneElem.dataset.pane)) {
						return;
					}
					if (paneElem.discard) paneElem.discard();
				});
			}
		};

		_handleTabSelect(tabIDs) {
			if (!this.tabID || typeof Zotero_Tabs === 'undefined') {
				return;
			}
			let isTabSelected = tabIDs.includes(this.tabID);
			this.skipRender = !isTabSelected;
			if (isTabSelected && this._pendingRender) {
				this.render();
			}
		}

		_savePinnedPane() {
			if (this.tabType !== 'library') {
				return;
			}
			let pinnedPane = this.pinnedPane;
			if (pinnedPane) {
				Zotero.Prefs.set('pinnedPane', pinnedPane);
			}
			else {
				Zotero.Prefs.clear('pinnedPane');
			}
		}

		_restorePinnedPane() {
			if (this.tabType !== 'library') {
				return;
			}
			let pinnedPane = Zotero.Prefs.get('pinnedPane') || '';
			if (this.pinnedPane !== pinnedPane) {
				this.pinnedPane = pinnedPane;
			}
		}
	}

	customElements.define("item-details", ItemDetails);
}
