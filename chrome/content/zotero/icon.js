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

var buttonID = 'zotero-toolbar-button';
CustomizableUI.createWidget({
	id: buttonID,
	label: "Zotero",
	tooltiptext: "Zotero",
	defaultArea: CustomizableUI.AREA_NAVBAR,
	onCommand: function () {
		ZoteroOverlay.toggleDisplay();
	},
	onCreated: function (node) {
		if (Zotero && Zotero.initialized) {
			// TODO: move to strings
			let str = 'Zotero';
			let key = Zotero.Keys.getKeyForCommand('openZotero');
			if (key) {
				str += ' ('
					+ (Zotero.isMac ? '⇧⌘' : Zotero.getString('general.keys.ctrlShift'))
					+ key
				+ ')';
			}
			node.setAttribute('tooltiptext', str);
			
			var placement = CustomizableUI.getPlacementOfWidget(buttonID);
			// If icon is in toolbar, show guidance panel if necessary
			if (placement && placement.area == 'nav-bar') {
				window.setTimeout(function() {
					var isUpgrade = false;
					try {
						isUpgrade = Zotero.Prefs.get("firstRunGuidanceShown.saveIcon");
					} catch(e) {}
					var property = "firstRunGuidance.toolbarButton."+(isUpgrade ? "upgrade" : "new");
					var shortcut = Zotero.getString(Zotero.isMac ? "general.keys.cmdShift" : "general.keys.ctrlShift")+
								   Zotero.Prefs.get("keys.openZotero");
					document.getElementById("zotero-toolbar-button-guidance").show(null, Zotero.getString(property, shortcut));
				});
			}
		}
		else {
			if (Zotero) {
				var errMsg = Zotero.startupError;
			}
			
			// Use defaults if necessary
			if (!errMsg) {
				// Get the stringbundle manually
				var src = 'chrome://zotero/locale/zotero.properties';
				var localeService = Components.classes['@mozilla.org/intl/nslocaleservice;1'].
						getService(Components.interfaces.nsILocaleService);
				var appLocale = localeService.getApplicationLocale();
				var stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
					.getService(Components.interfaces.nsIStringBundleService);
				var stringBundle = stringBundleService.createBundle(src, appLocale);
				
				var errMsg = stringBundle.GetStringFromName('startupError');
			}
			
			node.setAttribute('tooltiptext', errMsg);
			node.setAttribute('error', 'true');
		}
	}
});
