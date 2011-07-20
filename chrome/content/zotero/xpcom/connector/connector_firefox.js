/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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

Zotero.Connector_Browser = new function() {
	/**
	 * Called if Zotero version is determined to be incompatible with Standalone
	 */
	this.onIncompatibleStandaloneVersion = function(zoteroVersion, standaloneVersion) {
		Zotero.startupError = 'Zotero for Firefox '+Zotero.version+' is incompatible with the running '+
			'version of Zotero Standalone'+(standaloneVersion ? " ("+standaloneVersion+")" : "")+
			'.\n\nPlease ensure that you have installed the latest version of these components. See '+
			'http://www.zotero.org/support/standalone for more details.';
		Zotero.initialized = false;
	}
	
	/**
	 * Called if connector is offline. This should only happen if Zotero is getting a DB busy 
	 * message and no connector is open, so use the DB busy error message here.
	 */
	this.onStateChange = function(isOnline) {
		if(isOnline) return;
		
		var msg = Zotero.localeJoin([
			Zotero.getString('startupError.databaseInUse'),
			Zotero.getString(Zotero.isStandalone ? 'startupError.closeFirefox' : 'startupError.closeStandalone')
		]);
		Zotero.startupError = msg;
		Zotero.initialized = false;
	}
}