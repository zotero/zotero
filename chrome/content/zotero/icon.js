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
			// When dropping combo button into panel, add two independent buttons instead
			if (area == CustomizableUI.AREA_PANEL) {
				let mainID = getSingleID('main');
				let saveID = getSingleID('save');
				CustomizableUI.removeWidgetFromArea(id);
				// Remove independent main and save buttons first if they're already in panel
				CustomizableUI.removeWidgetFromArea(mainID);
				CustomizableUI.removeWidgetFromArea(saveID);
				CustomizableUI.addWidgetToArea(mainID, area, position);
				let placement = CustomizableUI.getPlacementOfWidget(mainID)
				let mainPos = placement.position;
				CustomizableUI.addWidgetToArea(saveID, area, mainPos + 1);
				return;
			}
			
			var isUpgrade = false;
			try {
				isUpgrade = Zotero.Prefs.get("firstRunGuidanceShown.saveIcon");
			} catch(e) {}
			var property = "firstRunGuidance.toolbarButton." + (isUpgrade ? "upgrade" : "new");
			var shortcut = Zotero.getString(
					Zotero.isMac ? "general.keys.cmdShift" : "general.keys.ctrlShift"
				) + Zotero.Prefs.get("keys.openZotero");
			
			let widget = CustomizableUI.getWidget(id);
			for (let instance of widget.instances) {
				let doc = instance.node.ownerDocument;
				
				updateItemForArea(instance.node, area);
				
				doc.getElementById("zotero-main-button-guidance").show({
					text: Zotero.getString(property, shortcut)
				});
				doc.getElementById("zotero-save-button-guidance").show();
			}
		}
		else if (id == getSingleID('save')) {
			let widget = CustomizableUI.getWidget(id);
			for (let instance of widget.instances) {
				instance.node.ownerDocument.defaultView.Zotero_Browser.updateStatus();
			}
		}
	},
	
	onWidgetOverflow: function (node, container) {
		if (node.id == comboButtonsID) {
			node.classList.add("toolbarbutton-1");
		}
	},
	
	onWidgetUnderflow: function (node, container) {
		if (node.id == comboButtonsID) {
			node.classList.remove("toolbarbutton-1");
		}
	},
	
	// Save icon in panel isn't in DOM until menu is shown once and therefore isn't updated
	// on page loads, so update the icon status when the panel is first shown so that it
	// doesn't remain disabled
	onAreaNodeRegistered: function (area, node) {
		if (area == CustomizableUI.AREA_PANEL) {
			var placement = CustomizableUI.getPlacementOfWidget(comboButtonsID)
			var update = false;
			let singleID = getSingleID('save');
			if (placement && placement.area == CustomizableUI.AREA_PANEL) {
				update = true;
			}
			else {
				placement = CustomizableUI.getPlacementOfWidget(singleID);
				if (placement && placement.area == CustomizableUI.AREA_PANEL) {
					update = true;
				}
			}
			if (update) {
				let widget = CustomizableUI.getWidget(singleID);
				for (let instance of widget.instances) {
					instance.node.ownerDocument.defaultView.Zotero_Browser.updateStatus();
				}
			}
		}
	}
})

// Create the combo buttons, which go in the toolbar by default
CustomizableUI.createWidget({
	id: comboButtonsID,
	type: 'custom',
	label: 'Zotero',
	tooltiptext: "Zotero",
	defaultArea: CustomizableUI.AREA_NAVBAR,
	onBuild: function (document) {
		const kNSXUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
		
		var item = document.createElementNS(kNSXUL, "toolbaritem");
		item.setAttribute("id", comboButtonsID);
		item.setAttribute("label", "Zotero (Combo)"); // TODO: localize
		// Set this as an attribute in addition to the property to make sure we can style correctly.
		item.setAttribute("removable", "true");
		item.classList.add("chromeclass-toolbar-additional");
		
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
			if (attribs.name == 'main') {
				button.setAttribute('label', Zotero.clientName);
			}
			else if (attribs.name == 'save') {
				button.setAttribute('label', Zotero.getString('ingester.saveToZotero'));
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

// Create the independent Z button, which isn't shown by default
CustomizableUI.createWidget({
	id: getSingleID('main'),
	label: Zotero.clientName,
	tooltiptext: getTooltipText('main'),
	defaultArea: false,
	onCommand: function (event) {
		event.target.ownerDocument.defaultView.ZoteroOverlay.toggleDisplay();
	}
});

// Create the independent save button, which isn't shown by default
CustomizableUI.createWidget({
	id: getSingleID('save'),
	label: Zotero.getString('ingester.saveToZotero'),
	tooltiptext: getTooltipText('save'),
	defaultArea: false,
	onCommand: function (event) {
		event.target.ownerDocument.defaultView.Zotero_Browser.scrapeThisPage(null, event);
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

function getSingleID(button) {
	return getID(button) + '-single';
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
			text = Zotero.clientName;
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
 * in the different areas
 */
function updateItemForArea(item, area) {
	if (area) {
		var areaType = CustomizableUI.getAreaType(area);
		var inPanel = area == CustomizableUI.AREA_PANEL;
		var classes = inPanel ? "panel-combined-button" : "toolbarbutton-1 toolbarbutton-combined";
		item.setAttribute("cui-areatype", areaType);
		item.classList.add("toolbaritem-combined-buttons");
		if (inPanel) {
			item.classList.add("panel-wide-item");
		}
		var buttons = item.getElementsByTagName('toolbarbutton');
		for (let i = 0; i < buttons.length; i++) {
			let button = buttons[i];
			button.setAttribute("class", classes);
			button.setAttribute("cui-areatype", areaType);
		}
	}
	// In customization palette pretend it's a single icon
	else {
		item.classList.remove("toolbaritem-combined-buttons");
		item.classList.remove("panel-wide-item");
		var buttons = item.getElementsByTagName('toolbarbutton');
		for (let i = 0; i < buttons.length; i++) {
			let button = buttons[i];
			button.setAttribute("class", "toolbarbutton-1");
			button.removeAttribute("cui-areatype");
		}
	}
}

function setAttributes(elem, attrs) {
	for (let i in attrs) {
		elem.setAttribute(i, attrs[i]);
	}
}
