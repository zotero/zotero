/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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
    
    
    Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
    
    ***** END LICENSE BLOCK *****
*/

/**
 * Interface for proxy.xul add proxy confirmation dialog
 * @namespace
 */
var Zotero_Proxy_Dialog = new function() {
	var halfSecondsRemaining = 4;
	var acceptButton;
	var addString;
	
	/**
	 * Initializes dialog
	 */
	this.init = function() {
		document.getElementById("description").firstChild.nodeValue = Zotero.getString("proxies.recognized.message",
			[window.arguments[0].site, window.arguments[0].proxy]);
		acceptButton = document.documentElement.getButton("accept")
		acceptButton.disabled = true;
		addString = Zotero.getString("proxies.recognized.add");
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
							  .getService(Components.interfaces.nsIPrefBranch);
		halfSecondsRemaining = Math.round(prefs.getIntPref("security.dialog_enable_delay")/500)+1;
		_updateRemaining();
	}
	
	/**
	 * Called when "Add" button is pressed
	 */
	this.accept = function() {
		window.arguments[0].disable = false;//document.getElementById("disable").checked;
		window.arguments[0].add = true;
	}
	
	/**
	 * Called when "Ignore" button is pressed
	 */
	this.cancel = function() {
		window.arguments[0].disable = false;//document.getElementById("disable").checked;
		window.arguments[0].add = false;
	}
	
	/**
	 * Updates the number of seconds the accept button remains disabled, then sets a timeout to call
	 * itself again, or alternatively, enables the button
	 * @inner
	 */
	function _updateRemaining() {
		halfSecondsRemaining--;
		if(halfSecondsRemaining == 0) {
			acceptButton.disabled = false;
			acceptButton.label = addString;
		} else {
			acceptButton.label = addString+" ("+halfSecondsRemaining+")";
			window.setTimeout(_updateRemaining, 500);
		}
	}
}