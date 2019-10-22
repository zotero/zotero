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

var ZoteroOverlay = new function () {
	this.onLoad = async function () {
		try {
			if (!Zotero) {
				throw new Error("No Zotero object");
			}
			if (Zotero.skipLoading) {
				throw new Error("Skipping loading");
			}
			
			await Zotero.Promise.all([Zotero.initializationPromise, Zotero.unlockPromise]);
			
			Zotero.debug("Initializing overlay");
			
			if (Zotero.skipLoading) {
				throw new Error("Skipping loading");
			}
			
			ZoteroPane.init();
		}
		catch (e) {
			Zotero.debug(e, 1);
			throw e;
		}
	};
	
	
	this.onUnload = function() {
		ZoteroPane.destroy();
	}
}

window.addEventListener("load", async function(e) {
	try {
		await ZoteroOverlay.onLoad(e);
		await ZoteroPane.makeVisible();
	}
	catch (e) {
		Components.utils.reportError(e);
		if (Zotero) {
			Zotero.debug(e, 1);
		}
		else {
			dump(e + "\n\n");
		}
	}
}, false);
window.addEventListener("unload", function(e) { ZoteroOverlay.onUnload(e); }, false);
