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

Zotero.Connector_Debug = new function() {
	/**
	 * Call a callback depending upon whether debug output is being stored
	 */
	this.storing = function(callback) {
		callback(Zotero.Debug.storing);
	}
	
	/**
	 * Call a callback with the lines themselves
	 */
	this.get = function(callback) {
		callback(Zotero.Debug.get());
	}
		
	/**
	 * Call a callback with the number of lines of output
	 */
	this.count = function(callback) {
		callback(Zotero.Debug.count());
	}
	
	/**
	 * Submit data to the sserver
	 */
	this.submitReport = function(callback) {
		var uploadCallback = function (xmlhttp) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			
			if (!xmlhttp.responseXML) {
				callback(false, 'Invalid response from server');
				return;
			}
			var reported = xmlhttp.responseXML.getElementsByTagName('reported');
			if (reported.length != 1) {
				callback(false, 'The server returned an error. Please try again.');
				return;
			}
			
			var reportID = reported[0].getAttribute('reportID');
			callback(true, reportID);
		}
		
		Zotero.HTTP.doPost("http://www.zotero.org/repo/report?debug=1", Zotero.Debug.get(),
			function(xmlhttp) {
				if (!xmlhttp.responseXML) {
					callback(false, 'Invalid response from server');
					return;
				}
				var reported = xmlhttp.responseXML.getElementsByTagName('reported');
				if (reported.length != 1) {
					callback(false, 'The server returned an error. Please try again.');
					return;
				}
				
				var reportID = reported[0].getAttribute('reportID');
				callback(true, reportID);
			}, {"Content-Type":"text/plain"});
	}
}