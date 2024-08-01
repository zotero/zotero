/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009-2011 Center for History and New Media
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

/**
 * Handles UI for lookup panel
 * @namespace
 */
var Zotero_Lookup = new function () {
	/**
	 * Performs a lookup by DOI, PMID, or ISBN on the given textBox value
	 * and adds any items it can.
	 *
	 * If a childItem is passed, then only one identifier is allowed, the
	 * child's library/collection information is used and no attachments are
	 * saved for the parent.
	 *
	 * @param textBox {HTMLElement} - Textbox containing identifiers
	 * @param childItem {Zotero.Item|false} - Child item (optional)
	 * @param toggleProgress {function} - Callback to toggle progress on/off
	 * @returns {Promise<Zotero.Item[]>}
	 */
	this._button = null;
	this.addItemsFromIdentifier = async function (textBox, childItem, toggleProgress) {
		var identifiers = Zotero.Utilities.extractIdentifiers(textBox.value);
		if (!identifiers.length) {
			Zotero.alert(
				window,
				Zotero.getString("lookup.failure.title"),
				Zotero.getString("lookup.failureToID.description")
			);
			return false;
		}
		else if (childItem && identifiers.length > 1) {
			// Only allow one identifier when creating a parent for a child
			Zotero.alert(
				window,
				Zotero.getString("lookup.failure.title"),
				Zotero.getString("lookup.failureTooMany.description")
			);
			return false;
		}

		var libraryID = false;
		var collections = false;
		if (childItem) {
			libraryID = childItem.libraryID;
			collections = childItem.collections;
		}
		else {
			try {
				libraryID = ZoteroPane.getSelectedLibraryID();
				let collection = ZoteroPane.getSelectedCollection();
				collections = collection ? [collection.id] : false;
			}
			catch (e) {
				/** TODO: handle this **/
			}
		}

		toggleProgress(true);

		// Group PubMed IDs into batches of 200
		//
		// Up to 10,000 ids can apparently be passed in a single request, but 200 is the recommended
		// limit for GET, which we currently use, and passing batches of 200 seems...fine.
		//
		// https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.id
		if (identifiers.length && identifiers[0].PMID) {
			let chunkSize = 200;
			let newIdentifiers = [];
			for (let i = 0; i < identifiers.length; i += chunkSize) {
				newIdentifiers.push({
					PMID: identifiers.slice(i, i + chunkSize).map(x => x.PMID)
				});
			}
			identifiers = newIdentifiers;
		}
		
		let newItems = [];
		for (let identifier of identifiers) {
			let translate = new Zotero.Translate.Search();
			translate.setIdentifier(identifier);

			// be lenient about translators
			let translators = await translate.getTranslators();
			translate.setTranslator(translators);

			try {
				newItems.push(...await translate.translate({
					libraryID,
					collections,
					saveAttachments: !childItem
				}));
			}
			// Continue with other ids on failure
			catch (e) {
				Zotero.logError(e);
			}
		}

		toggleProgress(false);
		if (!newItems.length) {
			Zotero.alert(
				window,
				Zotero.getString("lookup.failure.title"),
				Zotero.getString("lookup.failure.description")
			);
		}
		// TODO: Give indication if some, but not all failed

		return newItems;
	};

	/**
	 * Try a lookup and hide popup if successful
	 */
	this.accept = async function (textBox) {
		let newItems = await Zotero_Lookup.addItemsFromIdentifier(
			textBox,
			false,
			on => Zotero_Lookup.setShowProgress(on)
		);

		if (newItems.length) {
			// Send the focus to the item tree after the popup closes
			ZoteroPane.lastFocusedElement = null;
			document.getElementById("zotero-lookup-panel").hidePopup();
			document.getElementById("item-tree-main-default").focus();
		}
		return false;
	};


	this.showPanel = function (button) {
		var panel = document.getElementById('zotero-lookup-panel');
		this._button = button;
		if (!button) {
			button = document.getElementById("zotero-tb-lookup");
		}
		panel.openPopup(button, "after_start", 0, 0, false, false);
	};
	
	this.onFocusOut = function (event) {
		// If the lookup popup was triggered by the lookup button,
		// we want to return there on focus out. So we check
		// (1) that we came from a button and (2) that
		// event.relatedTarget === null, i.e. that the user hasn't used
		// the mouse or keyboard to select something, and focus is leaving
		// the popup because the popup was hidden/dismissed.

		if (this._button && event.relatedTarget === null) {
			event.preventDefault();
			event.stopPropagation();
			this._button.focus();
			this._button = null;
		}
		else {
			this._button = null;
		}
	};
	
	
	/**
	 * Focuses the field
	 */
	this.onShown = function (event) {
		// Ignore context menu
		if (event.originalTarget.id != 'zotero-lookup-panel') return;
		
		this.getActivePanel().querySelector('textarea').focus();
	};
	
	
	/**
	 * Cancels the popup and resets fields
	 */
	this.onHidden = function (event) {
		// Ignore context menu
		if (event.originalTarget.id != 'zotero-lookup-panel') return;
		
		document.getElementById("zotero-lookup-textbox").value = "";
		Zotero_Lookup.setShowProgress(false);
		
		// Revert to single-line when closing
		this.setMultiline(false);
	};
	
	
	this.getActivePanel = function() {
		var mlPanel = document.getElementById("zotero-lookup-multiline");
		if (mlPanel.hidden) return document.getElementById("zotero-lookup-singleLine");
		return mlPanel;
	};
	
	
	this.handleToolbarButtonMouseDown = function (event) {
		var button = event.target;
		if (button.disabled) {
			event.preventDefault();
			return;
		}
		this.showPanel(button);
	};
	
	
	/**
	 * Handles a key press
	 */
	this.onKeyPress = function (event, textBox) {
		var keyCode = event.keyCode;
		//use enter to start search, shift+enter to insert a new line. Flipped in multiline mode
		var multiline = textBox.rows > 1;
		var search = multiline ? event.shiftKey : !event.shiftKey;
		if (keyCode === 13 || keyCode === 14) {
			if (search) {
				Zotero_Lookup.accept(textBox);
				event.preventDefault();
			}
			else if (!multiline) {	// switch to multiline
				Zotero_Lookup.setMultiline(true);
			}
		}
		else if (keyCode == event.DOM_VK_ESCAPE) {
			document.getElementById("zotero-lookup-panel").hidePopup();
		}
	};
	
	
	this.onInput = function (event, textBox) {
		if (/[\r\n]/.test(textBox.value)) {
			this.setMultiline(true);
		}
	};
	
	
	this.setMultiline = function (on) {
		var mlTxtBox = document.getElementById("zotero-lookup-textbox");
		var mlButtons = document.getElementById('zotero-lookup-buttons');

		mlTxtBox.rows = on ? 5 : 1;
		mlButtons.hidden = !on;

		return mlTxtBox;
	};

	this.setShowProgress = function (on) {
		// In Firefox 52.6.0, progressmeters burn CPU at idle on Linux when undetermined, even
		// if they're hidden. (Being hidden is enough on macOS.)
		
		document.getElementById("zotero-lookup-textbox").disabled = !!on;
		var p = document.getElementById("zotero-lookup-multiline-progress");
		if (on) {
			p.removeAttribute('value');
		}
		else {
			p.setAttribute('value', 0);
		}
		p.hidden = !on;
	};
};
