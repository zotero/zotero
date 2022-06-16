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
	init: function () {
		this.panes = new Map();
		this.navigation = document.getElementById('prefs-navigation');
		this.content = document.getElementById('prefs-content');

		this.navigation.addEventListener('select', () => this.onNavigationSelect());
		document.getElementById('prefs-search').addEventListener('command',
			event => this.search(event.target.value));

		this.addPane({
			id: 'zotero-prefpane-general',
			label: 'zotero.preferences.prefpane.general',
			image: 'chrome://zotero/skin/prefs-general.png',
			src: 'chrome://zotero/content/preferences/preferences_general.xhtml',
			onLoad() {
				Zotero_Preferences.General.init();
			}
		});
		this.addPane({
			id: 'zotero-prefpane-sync',
			label: 'zotero.preferences.prefpane.sync',
			image: 'chrome://zotero/skin/prefs-sync.png',
			src: 'chrome://zotero/content/preferences/preferences_sync.xhtml',
			onLoad() {
				Zotero_Preferences.Sync.init();
			}
		});
		this.addPane({
			id: 'zotero-prefpane-search',
			label: 'zotero.preferences.prefpane.search',
			image: 'chrome://zotero/skin/prefs-search.png',
			src: 'chrome://zotero/content/preferences/preferences_search.xhtml',
			onLoad() {
				Zotero_Preferences.Search.init();
			}
		});
		this.addPane({
			id: 'zotero-prefpane-export',
			label: 'zotero.preferences.prefpane.export',
			image: 'chrome://zotero/skin/prefs-export.png',
			src: 'chrome://zotero/content/preferences/preferences_export.xhtml',
			onLoad() {
				Zotero_Preferences.Export.init();
			}
		});
		this.addPane({
			id: 'zotero-prefpane-cite',
			label: 'zotero.preferences.prefpane.cite',
			image: 'chrome://zotero/skin/prefs-styles.png',
			src: 'chrome://zotero/content/preferences/preferences_cite.xhtml',
			onLoad() {
				Zotero_Preferences.Cite.init();
			}
		});
		this.addPane({
			id: 'zotero-prefpane-advanced',
			label: 'zotero.preferences.prefpane.advanced',
			image: 'chrome://zotero/skin/prefs-advanced.png',
			src: 'chrome://zotero/content/preferences/preferences_advanced.xhtml',
			onLoad() {
				Zotero_Preferences.Advanced.init();
			}
		});

		if (window.arguments) {
			var io = window.arguments[0];
			io = io.wrappedJSObject || io;
			
			if (io.pane) {
				let tabID = io.tab;
				let tabIndex = io.tabIndex;
				var pane = document.getElementById(io.pane);
				this.navigation.value = io.pane;
				// Select tab within pane by tab id
				if (tabID !== undefined) {
					let tab = document.getElementById(tabID);
					if (tab) {
						tab.control.selectedItem = tab;
					}
				}
				// Select tab within pane by index
				else if (tabIndex !== undefined) {
					pane.querySelector('tabbox').selectedIndex = tabIndex;
				}
			}
		}
		else if (document.location.hash == "#cite") {
			this.panes.get('zotero-prefpane-cite').show();
		}
	},
	
	onUnload: function () {
		if (Zotero_Preferences.Debug_Output) {
			Zotero_Preferences.Debug_Output.onUnload();
		}
	},

	async addPane(options) {
		let { id, label, image, src, onLoad } = options;

		let listItem = document.createXULElement('richlistitem');
		listItem.value = id;

		if (image) {
			let imageElem = document.createXULElement('image');
			imageElem.src = image;
			listItem.append(imageElem);
		}

		let labelElem = document.createXULElement('label');
		if (Zotero.Intl.strings.hasOwnProperty(label)) {
			label = Zotero.Intl.strings[label];
		}
		else {
			label = Zotero.getString(label);
		}
		labelElem.value = label;

		listItem.append(labelElem);
		this.navigation.append(listItem);

		let container = document.createXULElement('vbox');
		container.id = id;
		this.content.append(container);

		let imported = false;

		this.panes.set(id, {
			show: (all) => {
				if (!imported) {
					let contentFragment = MozXULElement.parseXULToFragment(
						Zotero.File.getContentsFromURL(src),
						[
							'chrome://zotero/locale/zotero.dtd',
							'chrome://zotero/locale/preferences.dtd'
						]
					);
					contentFragment = document.importNode(contentFragment, true);
					this.initImportedNodes(contentFragment);
					container.append(contentFragment);
					imported = true;

					if (onLoad) onLoad();
				}
	
				for (let child of this.content.children) {
					child.setAttribute('hidden', !all && child.id != id);
				}
			}
		});
	},

	onNavigationSelect() {
		if (this.navigation.value) {
			document.getElementById('prefs-search').value = '';
			this.search('');
			this.panes.get(this.navigation.value).show();
		}
		else {
			for (let child of this.content.children) {
				child.setAttribute('hidden', true);
			}
		}
	},

	search(term) {
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

		if (!term) {
			if (this.navigation.selectedIndex == -1) {
				this.navigation.selectedIndex = 0;
			}
			return;
		}

		// Clear pane selection
		this.navigation.clearSelection();

		// Make sure all panes are loaded into the DOM
		for (let pane of this.panes.values()) {
			pane.show(true);
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

		for (let container of this.content.children) {
			let root = container.firstElementChild;
			if (!root) continue;

			for (let child of root.children) {
				let matches = this._searchRecursively(child, term);
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
					child.classList.add('hidden-by-search');
					child.ariaHidden = true;
				}
			}
		}
	},

	/**
	 * Search for the given term (case-insensitive) in the tree.
	 *
	 * @param {Element} root
	 * @param {String} term Must be normalized (normalizeSearch())
	 * @return {Node[]}
	 */
	_searchRecursively(root, term) {
		const EXCLUDE_SELECTOR = 'input, [no-highlight]';

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
			if (elem.hasAttribute('data-search-strings-raw')) {
				let rawStrings = elem.getAttribute('data-search-strings-raw')
					.split(',')
					.map(this._normalizeSearch)
					.filter(Boolean);
				if (rawStrings.some(s => s.includes(term))) {
					matched.add(elem);
					continue;
				}
			}

			if (elem.hasAttribute('data-search-strings')) {
				let stringKeys = elem.getAttribute('data-search-strings')
					.split(',')
					.map(s => s.trim())
					.filter(Boolean);
				for (let key of stringKeys) {
					if (Zotero.Intl.strings.hasOwnProperty(key)) {
						if (this._normalizeSearch(Zotero.Intl.strings[key]).includes(term)) {
							matched.add(elem);
							break;
						}
					}
					else if (this._normalizeSearch(Zotero.getString(key).replace(/%(\d+\$)?S/g, ''))
							.includes(term)) {
						matched.add(elem);
						break;
					}
				}
			}
		}

		return [...matched];
	},

	_normalizeSearch(s) {
		return Zotero.Utilities.removeDiacritics(
			Zotero.Utilities.trimInternal(s).toLowerCase(),
			true);
	},

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

	initImportedNodes(root) {
		// Activate `preference` attributes
		for (let elem of root.querySelectorAll('[preference]')) {
			let preference = elem.getAttribute('preference');
			if (root.querySelector('preferences > preference#' + preference)) {
				Zotero.debug('<preference> is deprecated -- `preference` attribute values '
					+ 'should be full preference keys, not <preference> IDs');
				preference = root.querySelector('preferences > preference#' + preference)
					.getAttribute('name');
			}

			let useChecked = (elem instanceof HTMLInputElement && elem.type == 'checkbox')
				|| elem.tagName == 'checkbox';
			
			elem.addEventListener(elem instanceof XULElement ? 'command' : 'input', () => {
				let value = useChecked ? elem.checked : elem.value;
				Zotero.Prefs.set(preference, value, true);
				elem.dispatchEvent(new Event('synctopreference'));
			});

			// Set timeout so pane can add listeners first
			setTimeout(() => {
				let value = Zotero.Prefs.get(preference, true);
				if (useChecked) {
					elem.checked = value;
				}
				else {
					elem.value = value;
				}
	
				elem.dispatchEvent(new Event('syncfrompreference'));
			});
		}

		// parseXULToFragment() doesn't convert oncommand attributes into actual
		// listeners, so we'll do it here
		for (let elem of root.querySelectorAll('[oncommand]')) {
			elem.oncommand = elem.getAttribute('oncommand');
		}

		root.dispatchEvent(new Event('paneload'));
	},
	
	openURL: function (url, windowName) {
		// Non-instantApply prefwindows are usually modal, so we can't open in the topmost window,
		// since it's probably behind the window
		var instantApply = Zotero.Prefs.get("browser.preferences.instantApply", true);
		
		if (instantApply) {
			window.opener.ZoteroPane_Local.loadURI(url, { shiftKey: true, metaKey: true });
		}
		else {
			if (Zotero.isStandalone) {
				var io = Components.classes['@mozilla.org/network/io-service;1']
							.getService(Components.interfaces.nsIIOService);
				var uri = io.newURI(url, null, null);
				var handler = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
							.getService(Components.interfaces.nsIExternalProtocolService)
							.getProtocolHandlerInfo('http');
				handler.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
				handler.launchWithURI(uri, null);
			}
			else {
				var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
							.getService(Components.interfaces.nsIWindowWatcher);
				var win = ww.openWindow(
					window,
					url,
					windowName ? windowName : null,
					"chrome=no,menubar=yes,location=yes,toolbar=yes,personalbar=yes,resizable=yes,scrollbars=yes,status=yes",
					null
				);
			}
		}
	},
	
	openHelpLink: function () {
		var url = "http://www.zotero.org/support/preferences/";
		var helpTopic = document.getElementsByTagName("prefwindow")[0].currentPane.helpTopic;
		url += helpTopic;
		
		this.openURL(url, "helpWindow");
	},
	
	
	/**
	 * Opens a URI in the basic viewer in Standalone, or a new window in Firefox
	 */
	openInViewer: function (uri, newTab) {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		const features = "menubar=yes,toolbar=no,location=no,scrollbars,centerscreen,resizable";
		
		if(Zotero.isStandalone) {
			var win = wm.getMostRecentWindow("zotero:basicViewer");
			if(win) {
				win.loadURI(uri);
			} else {
				window.openDialog("chrome://zotero/content/standalone/basicViewer.xhtml",
					"basicViewer", "chrome,resizable,centerscreen,menubar,scrollbars", uri);
			}
		} else {
			var win = wm.getMostRecentWindow("navigator:browser");
			if(win) {
				if(newTab) {
					win.gBrowser.selectedTab = win.gBrowser.addTab(uri);
				} else {
					win.open(uri, null, features);
				}
			}
			else {
				var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
							.getService(Components.interfaces.nsIWindowWatcher);
				var win = ww.openWindow(null, uri, null, features + ",width=775,height=575", null);
			}
		}
	}
};