/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
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

Components.utils.import("resource:///modules/CustomizableUI.jsm");

var comboButtonsID = 'zotero-toolbar-buttons';

CustomizableUI.addListener({
	onWidgetAdded: function (id, area, position) {
		if (id == comboButtonsID) {
			var item = document.getElementById(id);
			// Element may not exist yet if it was added to the panel
			if (item) {
				updateItemForArea(item, area);
			}
			
			var isUpgrade = false;
			try {
				isUpgrade = Zotero.Prefs.get("firstRunGuidanceShown.saveIcon");
			} catch(e) {}
			var property = "firstRunGuidance.toolbarButton." + (isUpgrade ? "upgrade" : "new");
			var shortcut = Zotero.getString(
					Zotero.isMac ? "general.keys.cmdShift" : "general.keys.ctrlShift"
				) + Zotero.Prefs.get("keys.openZotero");
			document.getElementById("zotero-toolbar-button-guidance").show(
				null, Zotero.getString(property, shortcut)
			);
		}
	},
	
	// Save icon in panel isn't in DOM until menu is shown once and therefore isn't updated
	// on page loads, so update the icon status when the panel is first shown so that it
	// doesn't remain disabled
	onAreaNodeRegistered: function (area, node) {
		if (area == CustomizableUI.AREA_PANEL) {
			var placement = CustomizableUI.getPlacementOfWidget("zotero-toolbar-buttons")
			var update = false;
			if (placement && placement.area == CustomizableUI.AREA_PANEL) {
				update = true;
			}
			else {
				placement = CustomizableUI.getPlacementOfWidget("zotero-toolbar-save-button-single");
				if (placement && placement.area == CustomizableUI.AREA_PANEL) {
					update = true;
				}
			}
			if (update) {
				Zotero_Browser.updateStatus();
			}
		}
	}
})


// Create the combo buttons, which go in the toolbar by default
CustomizableUI.createWidget({
	id: comboButtonsID,
	type: 'custom',
	label: 'zotero',
	tooltiptext: "Zotero",
	defaultArea: CustomizableUI.AREA_NAVBAR,
	onBuild: function (document) {
		const kNSXUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
		
		var item = document.createElementNS(kNSXUL, "toolbaritem");
		item.setAttribute("id", comboButtonsID);
		// Set this as an attribute in addition to the property to make sure we can style correctly.
		item.setAttribute("removable", "true");
		item.classList.add("chromeclass-toolbar-additional");
		item.classList.add("toolbaritem-combined-buttons");
		item.classList.add("panel-wide-item");
		
		['main', 'save'].map(button => {
			return {
				name: button,
				id: getID(button),
				tooltiptext: getTooltipText(button),
				oncommand: getCommand(button)
			};
		}).forEach(function(attribs, index) {
			if (index != 0) {
				item.appendChild(document.createElementNS(kNSXUL, "separator"));
			}
			let button = document.createElementNS(kNSXUL, "toolbarbutton");
			if (attribs.name == 'save') {
				button.setAttribute('disabled', 'true');
				button.setAttribute('type', 'menu-button');
				let menupopup = document.createElementNS(kNSXUL, "menupopup");
				menupopup.setAttribute('onpopupshowing', "Zotero_Browser.onStatusPopupShowing(event)");
				button.appendChild(menupopup);
			}
			delete attribs.name;
			setAttributes(button, attribs);
			item.appendChild(button);
		});
		
		updateItemForArea(item, this.currentArea)
		
		return item;
	}
});


// Create the independent save button, which isn't shown by default
CustomizableUI.createWidget({
	id: getID('save') + '-single',
	label: Zotero.getString('ingester.saveToZotero'),
	tooltiptext: getTooltipText('save'),
	defaultArea: false,
	onCommand: function (event) {
		Zotero_Browser.scrapeThisPage(null, event);
	},
	onCreated: function (button) {
		const kNSXUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
		button.setAttribute('disabled', 'true');
		button.setAttribute('type', 'menu-button');
		let menupopup = document.createElementNS(kNSXUL, "menupopup");
		menupopup.setAttribute('onpopupshowing', "Zotero_Browser.onStatusPopupShowing(event)");
		button.appendChild(menupopup);
	}
});


function getID(button) {
	switch (button) {
	case 'main':
		return "zotero-toolbar-main-button";
	
	case 'save':
		return "zotero-toolbar-save-button";
	}
}

function getCommand(button) {
	switch (button) {
	case 'main':
		return "ZoteroOverlay.toggleDisplay()";
	
	case 'save':
		return "Zotero_Browser.scrapeThisPage(null, event)";
	}
}

function getTooltipText(button) {
	var text;
	switch (button) {
	case 'main':
		if (Zotero && Zotero.initialized) {
			text = Zotero.getString('general.open', Zotero.clientName);
			let key = Zotero.Keys.getKeyForCommand('openZotero');
			if (key) {
				// Add RLE mark in RTL mode to make shortcut render the right way
				text += (Zotero.rtl ? ' \u202B' : ' ') + '('
					+ (Zotero.isMac ? '⇧⌘' : Zotero.getString('general.keys.ctrlShift'))
					+ key
					+ ')';
			}
			
		}
		else {
			if (Zotero) {
				text = Zotero.startupError;
			}
			
			// Use defaults if necessary
			if (!text) {
				// Get the stringbundle manually
				let src = 'chrome://zotero/locale/zotero.properties';
				let localeService = Components.classes['@mozilla.org/intl/nslocaleservice;1']
					.getService(Components.interfaces.nsILocaleService);
				let appLocale = localeService.getApplicationLocale();
				let stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
					.getService(Components.interfaces.nsIStringBundleService);
				let stringBundle = stringBundleService.createBundle(src, appLocale);
				text = stringBundle.GetStringFromName('startupError');
			}
		}
		break;
	
	case 'save':
		text = Zotero.getString('ingester.saveToZotero');
		break;
	}
	return text;
}

/**
 * Set various attributes that allow treeitem and subelements to be styled properly
 */
function updateItemForArea(item, area) {
	var areaType = CustomizableUI.getAreaType(area);
	var inPanel = area == CustomizableUI.AREA_PANEL;
	var classes = inPanel ? "panel-combined-button" : "toolbarbutton-1 toolbarbutton-combined";
	item.setAttribute("cui-areatype", areaType);
	var buttons = item.getElementsByTagName('toolbarbutton');
	for (let i = 0; i < buttons.length; i++) {
		let button = buttons[i];
		button.setAttribute("class", classes);
		button.setAttribute("cui-areatype", areaType);
	}
}

function setAttributes(elem, attrs) {
	for (let i in attrs) {
		elem.setAttribute(i, attrs[i]);
	}
}
