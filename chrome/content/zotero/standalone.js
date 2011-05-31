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
    
    ***** END LICENSE BLOCK *****
*/

/*
 * This object contains the various functions for the interface
 */
var ZoteroStandalone = new function()
{
	this.onLoad = function() {
		if(!Zotero || !Zotero.initialized) {
			ZoteroPane.displayStartupError();
			window.close();
			return;
		}
		ZoteroPane.init();
		ZoteroPane.makeVisible();
		
		// Run check for corrupt installation, where the wrong Gecko runtime is being used
		if(Zotero.isMac) {
			 var greDir = Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties)
				.get("GreD", Components.interfaces.nsIFile);
			if(greDir.isSymlink() || greDir.leafName !== "Current") {
				var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				ps.alert(null, "", Zotero.getString('standalone.corruptInstallation'));
			}
		}
		
	}
	
	this.onUnload = function() {
		ZoteroPane.destroy();
	}
}

window.addEventListener("load", function(e) { ZoteroStandalone.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroStandalone.onUnload(e); }, false);