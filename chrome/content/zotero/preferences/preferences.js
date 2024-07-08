/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
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

"use strict";

var Zotero_Preferences = {
	panes: new Map(),
	
	_firstPaneLoadDeferred: Zotero.Promise.defer(),
	
	_paneSelectDeferred: Zotero.Promise.defer(),
	
	_observerSymbols: new Map(),
	
	_mutationObservers: new Map(),

	init: function () {
		this.navigation = document.getElementById('prefs-navigation');
		this.content = document.getElementById('prefs-content');
		this.helpContainer = document.getElementById('prefs-help-container');
		this.searchField = document.getElementById('prefs-search');

		this.navigation.addEventListener('mouseover', event => this._handleNavigationMouseOver(event));
		this.navigation.addEventListener('select', () => this._handleNavigationSelect());
		this.searchField.addEventListener('command', () => this._search(this.searchField.value));
		
		document.getElementById('prefs-subpane-back-button').addEventListener('command', () => {
			let parent = this.panes.get(this.navigation.value).parent;
			if (parent) {
				this.navigation.value = parent;
			}
		});

		this.searchField.focus();
		
		Zotero.PreferencePanes.builtInPanes.forEach(pane => this._addPane(pane));
		if (Zotero.PreferencePanes.pluginPanes.length) {
			this.navigation.append(document.createElement('hr'));
			Zotero.PreferencePanes.pluginPanes
				.sort((a, b) => Zotero.localeCompare(a.rawLabel, b.rawLabel))
				.forEach(pane => this._addPane(pane));
		}

		if (window.arguments) {
			var io = window.arguments[0];
			io = io.wrappedJSObject || io;

			if (io.pane) {
				this.navigateToPane(io.pane, { scrollTo: io.scrollTo });
			}
		}
		else if (document.location.hash == "#cite") {
			this.navigation.value = 'zotero-prefpane-cite';
		}

		if (!this.navigation.value) {
			this.navigation.value = Zotero.Prefs.get('lastSelectedPrefPane');
			// If no last selected pane or ID is invalid, select General
			if (!this.navigation.value) {
				this.navigation.value = 'zotero-prefpane-general';
			}
		}
	},
	
	onUnload: function () {
		for (let symbol of this._observerSymbols.values()) {
			Zotero.Prefs.unregisterObserver(symbol);
		}
		this._observerSymbols.clear();

		for (let [_key, pane] of this.panes) {
			for (let child of pane.container.children) {
				let event = new Event('unload');
				child.dispatchEvent(event);
			}
		}
	},
	
	waitForFirstPaneLoad: async function () {
		await this._firstPaneLoadDeferred.promise;
	},

	waitForPaneSelect: async function () {
		await this._paneSelectDeferred.promise;
	},

	/**
	 * Select a pane in the navigation sidebar, displaying its content.
	 * Clears the current search and hides all other panes' content.
	 *
	 * @param {String} paneID
	 * @param {Object} [options]
	 * @param {String} [options.scrollTo] Selector to scroll to after displaying the pane
	 * @returns {Promise<void>}
	 */
	async navigateToPane(paneID, { scrollTo } = {}) {
		let oldPaneID = this.navigation.value;
		this.navigation.value = paneID;
		if (oldPaneID !== paneID) {
			await this.waitForPaneSelect();
		}
		if (scrollTo) {
			let elem = this.panes.get(paneID)?.container.querySelector(scrollTo);
			if (elem) {
				elem.scrollIntoView({ block: 'start' });
			}
		}
	},

	openHelpLink: function () {
		let helpURL = this.panes.get(this.navigation.value)?.helpURL;
		if (helpURL) {
			Zotero.launchURL(helpURL);
		}
	},

	async _handleNavigationMouseOver(event) {
		if (event.target.tagName === 'richlistitem') {
			await this._loadPane(event.target.value);
		}
	},

	async _handleNavigationSelect() {
		let paneID = this.navigation.value;
		if (paneID) {
			let pane = this.panes.get(paneID);
			this.searchField.value = '';
			await this._search('');
			
			await this._loadPane(paneID);
			if (this.navigation.value !== paneID) {
				// User navigated away from this pane while it was loading
				return;
			}
			
			await this._showPane(paneID);
			this.content.scrollTop = 0;

			this._paneSelectDeferred.resolve(pane);
			this._paneSelectDeferred = Zotero.Promise.defer();

			for (let child of this.content.children) {
				if (child !== this.helpContainer && child !== pane.container) {
					child.hidden = true;
				}
			}
			for (let navItem of this.navigation.children) {
				navItem.setAttribute('data-parent-selected', pane.parent && navItem.value === pane.parent);
			}

			this.helpContainer.hidden = !pane.helpURL;
			document.getElementById('prefs-subpane-back-button').hidden = !pane.parent;

			if (!pane.parent) {
				Zotero.Prefs.set('lastSelectedPrefPane', paneID);
			}
		}
		else {
			for (let navItem of this.navigation.children) {
				navItem.setAttribute('data-parent-selected', false);
			}
			
			this.helpContainer.hidden = true;
			document.getElementById('prefs-subpane-back-button').hidden = true;
		}
	},

	/**
	 * Add a pane to the left navigation sidebar. The pane source (`src`) is
	 * loaded as a fragment, not a full document.
	 *
	 * @param {Object} options
	 * @param {String} options.id Must be unique
	 * @param {String} [options.pluginID] ID of the plugin that registered the pane
	 * @param {String} [options.parent] ID of parent pane (if provided, pane is hidden from the sidebar)
	 * @param {String} [options.label] A DTD/.properties key (optional for panes with parents)
	 * @param {String} [options.rawLabel] A raw string to use as the label if options.label is not provided
	 * @param {String} [options.image] URI of an icon (displayed in the navigation sidebar)
	 * @param {String} options.src URI of an XHTML fragment
	 * @param {String[]} [options.scripts] Array of URIs of scripts to load along with the pane
	 * @param {String[]} [options.stylesheets] Array of URIs of CSS stylesheets to load along with the pane
	 * @param {Boolean} [options.defaultXUL] If true, parse the markup at `src` as XUL instead of XHTML:
	 * 		whitespace-only text nodes are ignored, XUL is the default namespace, and HTML tags are
	 * 		namespaced under `html:`. Default behavior is the opposite: whitespace nodes are preserved,
	 * 		HTML is the default namespace, and XUL tags are under `xul:`.
	 * @param {String} [options.helpURL] If provided, a help button will be displayed under the pane
	 * 		and the provided URL will open when it is clicked
	 */
	_addPane(options) {
		let { id, parent, label, rawLabel, image } = options;

		let listItem = document.createXULElement('richlistitem');
		listItem.value = id;

		if (image) {
			let imageElem = document.createXULElement('image');
			imageElem.src = image;
			listItem.append(imageElem);
		}

		// We still add a hidden richlistitem even if this is a subpane,
		// so we can invisibly select it and prevent richlistbox from selecting
		// its first visible child on focus (which would hide the visible subpane)
		if (parent) {
			listItem.hidden = true;
		}
		else {
			let labelElem = document.createXULElement('label');
			if (!rawLabel) {
				if (Zotero.Intl.strings.hasOwnProperty(label)) {
					rawLabel = Zotero.Intl.strings[label];
				}
				else {
					rawLabel = Zotero.getString(label);
				}
			}
			labelElem.value = rawLabel;
			listItem.append(labelElem);
		}

		this.navigation.append(listItem);

		let container = document.createElement('div');
		container.classList.add('pane-container');
		container.hidden = true;
		this.helpContainer.before(container);

		this.panes.set(id, {
			...options,
			rawLabel,
			loaded: false,
			container,
		});
	},

	/**
	 * Load a pane if not already loaded.
	 *
	 * @param {String} id
	 * @return {Promise<void>}
	 */
	async _loadPane(id) {
		let pane = this.panes.get(id);
		if (pane.loaded) {
			return;
		}
		if (pane.loadPromise) {
			await pane.loadPromise;
			return;
		}
		
		let rest = async () => {
			// Hack - make sure the following code does not run synchronously so we can set loadPromise immediately
			await Zotero.Promise.delay();
			
			if (pane.scripts) {
				for (let script of pane.scripts) {
					Services.scriptloader.loadSubScript(script, window);
				}
			}
			if (pane.stylesheets) {
				for (let stylesheet of pane.stylesheets) {
					document.insertBefore(
						document.createProcessingInstruction('xml-stylesheet', `href="${stylesheet}"`),
						document.firstChild
					);
				}
			}
			let markup = Zotero.File.getContentsFromURL(pane.src);
			let dtdFiles = [
				'chrome://zotero/locale/zotero.dtd',
				'chrome://zotero/locale/preferences.dtd',
			];
			let contentFragment = pane.defaultXUL
				? MozXULElement.parseXULToFragment(markup, dtdFiles)
				: this._parseXHTMLToFragment(markup, dtdFiles);
			contentFragment = document.importNode(contentFragment, true);

			this._initImportedNodesPreInsert(contentFragment);
			
			let heading = document.createElement('h1');
			heading.textContent = pane.rawLabel;
			pane.container.append(contentFragment);
			if (pane.container.querySelector('.main-section')) {
				pane.container.querySelector('.main-section').prepend(heading);
			}
			else {
				pane.container.prepend(heading);
			}

			await document.l10n.ready;
			try {
				await document.l10n.translateFragment(pane.container);
			}
			catch (e) {
				// Some element had invalid l10n attributes, but elements with valid l10n attributes were
				// translated successfully, so no need to treat this as fatal
				// The error will be undefined for some reason, so make our own
				Zotero.logError(new Error(`document.l10n.translateFragment() failed -- invalid data-l10n-id in pane '${pane.id}'?`));
			}
			await this._initImportedNodesPostInsert(pane.container);

			pane.loaded = true;
		};
		pane.loadPromise = rest();
		await pane.loadPromise;
	},

	/**
	 * Display a pane's content, alongside any other panes already showing.
	 * Pane must be loaded (#_loadPane()).
	 * @param {String} id
	 */
	_showPane(id) {
		let pane = this.panes.get(id);
		if (!pane.loaded) {
			throw new Error(`Pane '${id}' not loaded`);
		}
		pane.container.hidden = false;
		for (let child of pane.container.children) {
			let event = new Event('showing');
			child.dispatchEvent(event);
		}
	},
	
	_parseXHTMLToFragment(str, entities = []) {
		// Adapted from MozXULElement.parseXULToFragment

		/* eslint-disable indent */
		let parser = new DOMParser();
		parser.forceEnableXULXBL();
		let doc = parser.parseFromSafeString(
			`
${entities.length
		? `<!DOCTYPE bindings [ ${entities.reduce((preamble, url, index) => {
				return preamble + `<!ENTITY % _dtd-${index} SYSTEM "${url}"> %_dtd-${index}; `;
			}, '')}]>`
		: ""}
<div xmlns="http://www.w3.org/1999/xhtml"
		xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
${str}
</div>`, "application/xml");
		/* eslint-enable indent */

		if (doc.documentElement.localName === 'parsererror') {
			throw new Error('not well-formed XHTML');
		}

		// We use a range here so that we don't access the inner DOM elements from
		// JavaScript before they are imported and inserted into a document.
		let range = doc.createRange();
		range.selectNodeContents(doc.querySelector('div'));
		return range.extractContents();
	},

	/**
	 * To be called before insertion into the document tree:
	 * Move all processing instructions (XML <?...?>) found in the imported fragment into the document root
	 * so that they actually have an effect. This essentially "activates" <?xml-stylesheet?> nodes.
	 *
	 * @param {DocumentFragment} fragment
	 * @private
	 */
	_initImportedNodesPreInsert(fragment) {
		let processingInstrWalker = document.createTreeWalker(fragment, NodeFilter.SHOW_PROCESSING_INSTRUCTION);
		let processingInstr = processingInstrWalker.currentNode;
		while (processingInstr) {
			document.insertBefore(
				document.createProcessingInstruction(processingInstr.target, processingInstr.data),
				document.firstChild
			);
			if (processingInstr.parentNode) {
				processingInstr.parentNode.removeChild(processingInstr);
			}
			processingInstr = processingInstrWalker.nextNode();
		}
	},

	_useChecked(elem) {
		return (elem instanceof HTMLInputElement && elem.type == 'checkbox')
			|| elem.tagName == 'checkbox';
	},

	_syncFromPref(elem, preference, force = false) {
		let value = Zotero.Prefs.get(preference, true);
		if (this._useChecked(elem)) {
			value = !!value;
			if (!force && elem.checked === value) {
				return;
			}
			elem.checked = value;
		}
		else {
			value = String(value);
			if (!force && elem.value === value) {
				return;
			}
			elem.value = value;
		}
		elem.dispatchEvent(new Event('syncfrompreference'));
	},

	_syncToPrefOnModify(event) {
		if (event.currentTarget.getAttribute('preference')) {
			let value = this._useChecked(event.currentTarget) ? event.currentTarget.checked : event.currentTarget.value;
			event.currentTarget.dispatchEvent(new Event('synctopreference'));
			Zotero.Prefs.set(event.currentTarget.getAttribute('preference'), value, true);
		}
	},

	/**
	 * To be called after insertion into the document tree:
	 * Activates `preference` attributes and inline oncommand handlers and dispatches a load event at the end.
	 *
	 * @param {Element} container
	 * @private
	 */
	async _initImportedNodesPostInsert(container) {
		let attachToPreference = (elem) => {
			if (this._observerSymbols.has(elem)) {
				return Promise.resolve();
			}
			
			let preference = elem.getAttribute('preference');
			try {
				if (container.querySelector('preferences > preference#' + preference)) {
					Zotero.warn('<preference> is deprecated -- `preference` attribute values '
						+ 'should be full preference keys, not <preference> IDs');
					preference = container.querySelector('preferences > preference#' + preference)
						.getAttribute('name');
					elem.setAttribute('preference', preference);
				}
				else if (!preference.includes('.')) {
					Zotero.warn('`preference` attribute value `' + preference + '` looks like a <preference> ID, '
						+ 'although no element with that ID exists. Its value should be a preference key.');
				}
			}
			catch (e) {
				// Ignore
			}

			let symbol = Zotero.Prefs.registerObserver(
				preference,
				() => this._syncFromPref(elem, preference),
				true
			);
			this._observerSymbols.set(elem, symbol);
			
			if (elem.tagName === 'menulist') {
				// Set up an observer to resync if this menulist has items added later
				// (If we set elem.value before the corresponding item is added, the label won't be updated when it
				//  does get added, unless we do this)
				let mutationObserver = new MutationObserver((mutations) => {
					let value = Zotero.Prefs.get(preference, true);
					for (let mutation of mutations) {
						for (let node of mutation.addedNodes) {
							if (node.tagName === 'menuitem' && node.value === value) {
								Zotero.debug(`Preferences: menulist attached to ${preference} has new item matching current pref value '${value}'`);
								// Set selectedItem so the menulist updates its label, icon, and description
								// The selectedItem setter fires select and ValueChange, but we don't listen to either
								// of those events
								elem.selectedItem = node;
								return;
							}
						}
					}
				});
				mutationObserver.observe(elem, {
					childList: true,
					subtree: true
				});
				this._mutationObservers.set(elem, mutationObserver);
			}

			elem.addEventListener('command', this._syncToPrefOnModify.bind(this));
			elem.addEventListener('input', this._syncToPrefOnModify.bind(this));
			elem.addEventListener('change', this._syncToPrefOnModify.bind(this));

			// Set timeout before populating the value so the pane can add listeners first
			return new Promise(resolve => setTimeout(() => {
				this._syncFromPref(elem, elem.getAttribute('preference'), true);
				resolve();
			}));
		};
		
		let detachFromPreference = (elem) => {
			if (this._observerSymbols.has(elem)) {
				Zotero.Prefs.unregisterObserver(this._observerSymbols.get(elem));
				this._observerSymbols.delete(elem);
			}
			if (this._mutationObservers.has(elem)) {
				this._mutationObservers.get(elem).disconnect();
				this._mutationObservers.delete(elem);
			}
		};

		let awaitBeforeShowing = [];

		// Activate `preference` attributes
		// Do not await anything between here and the 'load' event dispatch below! That would cause 'syncfrompreference'
		// events to be fired before 'load'!
		for (let elem of container.querySelectorAll('[preference]')) {
			awaitBeforeShowing.push(attachToPreference(elem));
		}
		
		new MutationObserver((mutations) => {
			for (let mutation of mutations) {
				if (mutation.type == 'attributes') {
					let target = mutation.target;
					detachFromPreference(target);
					if (target.hasAttribute('preference')) {
						// Don't bother awaiting these
						attachToPreference(target);
					}
				}
				else if (mutation.type == 'childList') {
					for (let node of mutation.removedNodes) {
						detachFromPreference(node);
						if (node.nodeType == Node.ELEMENT_NODE) {
							for (let subElem of node.querySelectorAll('[preference]')) {
								detachFromPreference(subElem);
							}
						}
					}
					for (let node of mutation.addedNodes) {
						if (node.nodeType == Node.ELEMENT_NODE) {
							if (node.hasAttribute('preference')) {
								attachToPreference(node);
							}
							for (let subElem of node.querySelectorAll('[preference]')) {
								attachToPreference(subElem);
							}
						}
					}
				}
			}
		}).observe(container, {
			childList: true,
			subtree: true,
			attributeFilter: ['preference']
		});

		// parseXULToFragment() doesn't convert oncommand attributes into actual
		// listeners, so we'll do it here
		for (let elem of container.querySelectorAll('[oncommand]')) {
			elem.oncommand = elem.getAttribute('oncommand');
		}

		for (let child of container.children) {
			let event = new Event('load');
			event.waitUntil = (promise) => {
				awaitBeforeShowing.push(promise);
			};
			child.dispatchEvent(event);
		}

		await Promise.allSettled(awaitBeforeShowing);

		// If this is the first pane to be loaded, notify anyone waiting
		// (for tests)
		this._firstPaneLoadDeferred.resolve();
	},

	/**
	 * If term is falsy, clear the current search and show the first pane.
	 * If term is truthy, execute a search:
	 *   - Deselect the selected section
	 *   - Show all preferences from all sections
	 *   - Hide those not matching the search term (by full text and data-search-strings[-raw])
	 *   - Highlight full-text matches and show tooltips by search string matches
	 *
	 * @param {String} [term]
	 */
	_search: Zotero.Utilities.Internal.serial(async function (term) {
		// Initial housekeeping:

		// Clear existing highlights
		this._getSearchSelection().removeAllRanges();

		// Remove existing tooltips
		// Need to convert to array before iterating so elements being removed from the
		// live collection doesn't mess with the iteration
		for (let oldTooltipParent of [...this.content.getElementsByClassName('search-tooltip-parent')]) {
			oldTooltipParent.replaceWith(oldTooltipParent.firstElementChild);
		}

		// Show hidden sections
		for (let hidden of [...this.content.getElementsByClassName('hidden-by-search')]) {
			hidden.classList.remove('hidden-by-search');
			hidden.ariaHidden = false;
		}

		// Hide help button by default - _handleNavigationSelect() will show it when appropriate
		this.helpContainer.hidden = true;

		if (!term) {
			if (this.navigation.selectedIndex == -1) {
				this.navigation.selectedIndex = 0;
			}
			return;
		}

		// Clear pane selection
		this.navigation.clearSelection();
		
		// Don't show help button when searching
		this.helpContainer.hidden = true;

		// Make sure all panes are loaded into the DOM and show top-level ones
		for (let [id, pane] of this.panes) {
			if (pane.parent) {
				pane.container.hidden = true;
			}
			else {
				await this._loadPane(id);
				await this._showPane(id);
			}
		}

		// Replace <label value="abc"/> with <label>abc</label>
		// This renders exactly the same and enables highlighting using ranges
		for (let label of document.getElementsByTagNameNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label')) {
			if (label.getAttribute('value') && !label.textContent) {
				label.textContent = label.getAttribute('value');
				label.removeAttribute('value');
			}
		}

		// Clean the search term but keep the original -
		//displaying with diacritics removed is confusing
		let termForDisplay = Zotero.Utilities.trimInternal(term).toLowerCase();
		term = this._normalizeSearch(term);

		for (let paneContainer of this.content.querySelectorAll(':scope > .pane-container')) {
			let roots = paneContainer.children;
			while (roots.length === 1 && roots[0].childElementCount) {
				roots = roots[0].children;
			}
			for (let root of roots) {
				let matches = await this._findNodesMatching(root, term);
				if (matches.length) {
					let touchedTabPanels = new Set();
					for (let node of matches) {
						if (node.nodeType === Node.TEXT_NODE) {
							// For text nodes, add a native highlight on the matched range
							let value = node.nodeValue.toLowerCase();
							let index = value.indexOf(term);
							if (index == -1) continue; // Should not happen

							let range = document.createRange();
							range.setStart(node, index);
							range.setEnd(node, index + term.length);
							this._getSearchSelection().addRange(range);
						}
						else if (node.nodeType == Node.ELEMENT_NODE) {
							// For element nodes, wrap the element and add a tooltip
							// (So please don't use .parentElement etc. in event listeners)

							// Structure:
							// hbox.search-tooltip-parent
							//   | <node>
							//   | span.search-tooltip
							//       | span
							//           | <termForDisplay>
							let tooltipParent = document.createXULElement('hbox');
							tooltipParent.className = 'search-tooltip-parent';
							node.replaceWith(tooltipParent);
							let tooltip = document.createElement('span');
							tooltip.className = 'search-tooltip';
							let tooltipText = document.createElement('span');
							tooltipText.append(termForDisplay);
							tooltip.append(tooltipText);
							tooltipParent.append(node, tooltip);

							// https://searchfox.org/mozilla-central/rev/703391c381f92a73d9a938cbe0d33ca64d94583b/browser/components/preferences/findInPage.js#689-691
							let tooltipRect = tooltip.getBoundingClientRect();
							tooltip.style.left = `calc(50% - ${tooltipRect.width / 2}px)`;
						}

						let tabPanel = this._closest(node, 'tabpanels > tabpanel');
						let tabPanels = tabPanel?.parentElement;
						if (tabPanels && !touchedTabPanels.has(tabPanels)) {
							let tab = tabPanels.getRelatedElement(tabPanel);
							if (tab.control) {
								tab.control.selectedItem = tab;
								touchedTabPanels.add(tabPanels);
							}
						}
					}
				}
				else {
					root.classList.add('hidden-by-search');
					root.ariaHidden = true;
				}
			}
			if (Array.from(roots).every(root => root.classList.contains('hidden-by-search'))) {
				paneContainer.classList.add('hidden-by-search');
				paneContainer.ariaHidden = true;
			}
		}
	}),

	/**
	 * Search for the given term (case-insensitive) in the tree.
	 *
	 * @param {Element} root
	 * @param {String} term Must be normalized (normalizeSearch())
	 * @return {Promise<Node[]>}
	 */
	async _findNodesMatching(root, term) {
		const EXCLUDE_SELECTOR = 'input, [hidden]:not([hidden="false"]), [no-highlight]';

		let matched = new Set();
		let treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let currentNode;
		while ((currentNode = treeWalker.nextNode())) {
			if (this._closest(currentNode, EXCLUDE_SELECTOR)
					|| !currentNode.nodeValue
					|| currentNode.length < term.length) {
				continue;
			}
			if (this._normalizeSearch(currentNode.nodeValue).includes(term)) {
				let unhighlightableParent = this._closest(currentNode, 'menulist');
				if (unhighlightableParent) {
					matched.add(unhighlightableParent);
				}
				else {
					matched.add(currentNode);
				}
			}
		}

		for (let elem of root.querySelectorAll('[data-search-strings-raw], [data-search-strings]')) {
			if (elem.closest(EXCLUDE_SELECTOR)) {
				continue;
			}

			let strings = [];
			if (elem.hasAttribute('data-search-strings-parsed')) {
				strings = JSON.parse(elem.getAttribute('data-search-strings-parsed'));
			}
			else {
				if (elem.hasAttribute('data-search-strings-raw')) {
					let rawStrings = elem.getAttribute('data-search-strings-raw')
						.split(',')
						.map(this._normalizeSearch)
						.filter(Boolean);
					strings.push(...rawStrings);
				}

				if (elem.hasAttribute('data-search-strings')) {
					let stringKeys = elem.getAttribute('data-search-strings')
						.split(',')
						.map(s => s.trim())
						.filter(Boolean);
					// Get strings from Fluent
					let localizedStrings = await document.l10n.formatMessages(stringKeys);
					localizedStrings = localizedStrings.flatMap((message, i) => {
						// If we got something from Fluent, use the value and relevant attributes
						if (message) {
							return [message.value, message.attributes?.title, message.attributes?.label];
						}

						// If we didn't, try strings from DTDs and properties
						let key = stringKeys[i];
						return [
							Zotero.Intl.strings.hasOwnProperty(key)
								? Zotero.Intl.strings[key]
								: Zotero.getString(key)
						];
					}).filter(Boolean)
						.map(this._normalizeSearch)
						.filter(Boolean);
					strings.push(...localizedStrings);
				}

				elem.setAttribute('data-search-strings-parsed', JSON.stringify(strings));
			}

			if (strings.some(s => s.includes(term))) {
				matched.add(elem);
			}
		}

		return [...matched];
	},

	/**
	 * @param {String} s
	 * @return {String}
	 */
	_normalizeSearch(s) {
		return Zotero.Utilities.removeDiacritics(
			Zotero.Utilities.trimInternal(s).toLowerCase(),
			true);
	},

	/**
	 * @return {Selection}
	 */
	_getSearchSelection() {
		// https://searchfox.org/mozilla-central/rev/703391c381f92a73d9a938cbe0d33ca64d94583b/browser/components/preferences/findInPage.js#226-239
		let controller = window.docShell
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsISelectionDisplay)
			.QueryInterface(Ci.nsISelectionController);
		let selection = controller.getSelection(
			Ci.nsISelectionController.SELECTION_FIND
		);
		selection.setColors('currentColor', '#ffe900', 'currentColor', '#003eaa');
		return selection;
	},

	/**
	 * Like {@link Element#closest} for all nodes.
	 *
	 * @param {Node} node
	 * @param {String} selector
	 * @return {Element | null}
	 */
	_closest(node, selector) {
		while (node && node.nodeType != Node.ELEMENT_NODE) {
			node = node.parentNode;
		}
		return node?.closest(selector);
	},
	
	/**
	 * @deprecated Use {@link Zotero.launchURL}
	 */
	openURL: function (url) {
		Zotero.warn("Zotero_Preferences.openURL() is deprecated -- use Zotero.launchURL()");
		Zotero.launchURL(url);
	}
};
