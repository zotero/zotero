/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
	
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
		window.arguments[0].disable = document.getElementById("disable").checked;
		window.arguments[0].add = true;
	}
	
	/**
	 * Called when "Ignore" button is pressed
	 */
	this.cancel = function() {
		window.arguments[0].disable = document.getElementById("disable").checked;
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