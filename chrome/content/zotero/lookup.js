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
	 * Performs a lookup by DOI, PMID, or ISBN
	 */
	this.accept = Zotero.Promise.coroutine(function* (textBox) {
		var identifiers = Zotero.Utilities.Internal.extractIdentifiers(textBox.value);
		if (!identifiers.length) {
			Zotero.alert(
				window,
				Zotero.getString("lookup.failure.title"),
				Zotero.getString("lookup.failureToID.description")
			);
			return false;
		}

		var libraryID = false;
		var collection = false;
		try {
			libraryID = ZoteroPane_Local.getSelectedLibraryID();
			collection = ZoteroPane_Local.getSelectedCollection();
		} catch(e) {
			/** TODO: handle this **/
		}

		var successful = 0;					//counter for successful retrievals

		Zotero_Lookup.toggleProgress(true);

		for (let identifier of identifiers) {
			var translate = new Zotero.Translate.Search();
			translate.setIdentifier(identifier);

			// be lenient about translators
			let translators = yield translate.getTranslators();
			translate.setTranslator(translators);

			try {
				let newItems = yield translate.translate({
					libraryID,
					collections: collection ? [collection.id] : false
				});
				successful++;
			}
			// Continue with other ids on failure
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		Zotero_Lookup.toggleProgress(false);
		// TODO: Give indication if some failed
		if (successful) {
			document.getElementById("zotero-lookup-panel").hidePopup();
		}
		else {
			Zotero.alert(
				window,
				Zotero.getString("lookup.failure.title"),
				Zotero.getString("lookup.failure.description")
			);
		}
		
		return false;
	});
	
	
	this.showPanel = function (button) {
		var panel = document.getElementById('zotero-lookup-panel');
		panel.openPopup(button, "after_start", 16, -2, false, false);
	}
	
	
	/**
	 * Focuses the field
	 */
	this.onShowing = function (event) {
		// Ignore context menu
		if (event.originalTarget.id != 'zotero-lookup-panel') return;
		
		document.getElementById("zotero-lookup-panel").style.padding = "10px";
		this.getActivePanel().getElementsByTagName('textbox')[0].focus();
		
		// Resize arrow box to fit content
		if (Zotero.isMac) {
			let panel = document.getElementById("zotero-lookup-panel");
			let box = panel.firstChild;
			panel.sizeTo(box.scrollWidth, box.scrollHeight);
		}
	}
	
	
	/**
	 * Cancels the popup and resets fields
	 */
	this.onHidden = function (event) {
		// Ignore context menu
		if (event.originalTarget.id != 'zotero-lookup-panel') return;
		
		document.getElementById("zotero-lookup-textbox").value = "";
		document.getElementById("zotero-lookup-multiline-textbox").value = "";
		Zotero_Lookup.toggleProgress(false);
		
		// Revert to single-line when closing
		this.toggleMultiline(false);
	}
	
	
	this.getActivePanel = function() {
		var mlPanel = document.getElementById("zotero-lookup-multiline");
		if (mlPanel.collapsed) return document.getElementById("zotero-lookup-singleLine");
		return mlPanel;
	}
	
	
	/**
	 * Handles a key press
	 */
	this.onKeyPress = function(event, textBox) {
		var keyCode = event.keyCode;
		//use enter to start search, shift+enter to insert a new line. Flipped in multiline mode
		var multiline = textBox.getAttribute('multiline');
		var search = multiline ? event.shiftKey : !event.shiftKey;
		if(keyCode === 13 || keyCode === 14) {
			if(search) {
				Zotero_Lookup.accept(textBox);
				event.stopImmediatePropagation();
			} else if(!multiline) {	//switch to multiline
				var mlTextbox = Zotero_Lookup.toggleMultiline(true);
				mlTextbox.value = mlTextbox.value.trim() !== '' ? mlTextbox.value + '\n' : '';
			}
		} else if(keyCode == event.DOM_VK_ESCAPE) {
			document.getElementById("zotero-lookup-panel").hidePopup();
		}
		return true;
	}
	
	
	this.onInput = function (event, textbox) {
		this.adjustTextbox(textbox);
	};
	
	
	/**
	 * Converts the textbox to multiline if newlines are detected
	 */
	this.adjustTextbox = function (textbox) {
		if (textbox.value.trim().match(/[\r\n]/)) {
			Zotero_Lookup.toggleMultiline(true);
		}
		// Since we ignore trailing and leading newlines, we should also trim them for display
		// can't use trim, because then we cannot add leading/trailing spaces to the single line textbox
		else {
			textbox.value = textbox.value.replace(/^([ \t]*[\r\n]+[ \t]*)+|([ \t]*[\r\n]+[ \t]*)+$/g,"");
		}
	}
	
	
	/**
	 * Performs the switch to multiline textbox and returns that textbox
	 */
	this.toggleMultiline = function(on) {
		var mlPanel = document.getElementById("zotero-lookup-multiline");
		var mlTxtBox = document.getElementById("zotero-lookup-multiline-textbox");
		var slPanel = document.getElementById("zotero-lookup-singleLine");
		var slTxtBox = document.getElementById("zotero-lookup-textbox");
		var source = on ? slTxtBox : mlTxtBox;
		var dest = on ? mlTxtBox : slTxtBox;

		//copy over the value
		dest.value = source.value;

		//switch textboxes
		mlPanel.setAttribute("collapsed", !on);
		slPanel.setAttribute("collapsed", !!on);

		// Resize arrow box to fit content -- also done in onShowing()
		if(Zotero.isMac) {
			var panel = document.getElementById("zotero-lookup-panel");
			var box = panel.firstChild;
			panel.sizeTo(box.scrollWidth, box.scrollHeight);
		}
		
		dest.focus();
		return dest;
	}

	this.toggleProgress = function(on) {
		// In Firefox 52.6.0, progressmeters burn CPU at idle on Linux when undetermined, even
		// if they're hidden. (Being hidden is enough on macOS.)
		var mode = on ? 'undetermined' : 'determined';
		
		//single line
		var txtBox = document.getElementById("zotero-lookup-textbox");
		txtBox.style.opacity = on ? 0.5 : 1;
		txtBox.disabled = !!on;
		var p1 = document.getElementById("zotero-lookup-progress");
		p1.mode = mode;

		//multiline
		document.getElementById("zotero-lookup-multiline-textbox").disabled = !!on;
		var p2 = document.getElementById("zotero-lookup-multiline-progress");
		p2.mode = mode;
		p2.hidden = !on;
	}
}
