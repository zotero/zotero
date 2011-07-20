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

Zotero.Connector = new function() {
	const CONNECTOR_URI = "http://127.0.0.1:23119/";
	const CONNECTOR_API_VERSION = 2;
	
	this.isOnline = null;
	
	/**
	 * Checks if Zotero is online and passes current status to callback
	 * @param {Function} callback
	 */
	this.checkIsOnline = function(callback) {
		Zotero.Connector.callMethod("ping", {}, function(status) {
			callback(status !== false);
		});
	}

	// saner descriptions of some HTTP error codes
	this.EXCEPTION_NOT_AVAILABLE = 0;
	this.EXCEPTION_BAD_REQUEST = 400;
	this.EXCEPTION_NO_ENDPOINT = 404;
	this.EXCEPTION_INCOMPATIBLE_VERSION = 412;
	this.EXCEPTION_CONNECTOR_INTERNAL = 500;
	this.EXCEPTION_METHOD_NOT_IMPLEMENTED = 501;
	this.EXCEPTION_CODES = [0, 400, 404, 412, 500, 501];
	
	/**
	 * Sends the XHR to execute an RPC call.
	 *
	 * @param	{String}		method			RPC method. See documentation above.
	 * @param	{Object}		data			RPC data. See documentation above.
	 * @param	{Function}		callback		Function to be called when requests complete.
	 */
	this.callMethod = function(method, data, callback) {
		var newCallback = function(req) {
			try {
				var isOnline = req.status !== Zotero.Connector.EXCEPTION_NOT_AVAILABLE
					&& req.status !== Zotero.Connector.EXCEPTION_INCOMPATIBLE_VERSION;
				
				if(Zotero.Connector.isOnline !== isOnline) {
					Zotero.Connector.isOnline = isOnline;
					if(Zotero.Connector_Browser && Zotero.Connector_Browser.onStateChange) {
						Zotero.Connector_Browser.onStateChange(isOnline);
					}
				}
				
				if(Zotero.Connector.EXCEPTION_CODES.indexOf(req.status) !== -1) {
					Zotero.debug("Connector: Method "+method+" failed with status "+req.status);
					if(callback) callback(false, req.status);
					
					// Check for incompatible version
					if(req.status === 404 || req.status === 412) {
						if(Zotero.Connector_Browser && Zotero.Connector_Browser.onIncompatibleStandaloneVersion) {
							var standaloneVersion = req.getResponseHeader("X-Zotero-Version");
							Zotero.Connector_Browser.onIncompatibleStandaloneVersion(Zotero.version, standaloneVersion);
							throw "Connector: Version mismatch: Connector version "+Zotero.version
								+", Standalone version "+(standaloneVersion ? standaloneVersion : "<unknown>");
						}
					}
				} else {
					Zotero.debug("Connector: Method "+method+" succeeded");
					var val = null;
					if(req.responseText) {
						if(req.getResponseHeader("Content-Type") === "application/json") {
							val = JSON.parse(req.responseText);
						} else {
							val = req.responseText;
						}
					}
					if(callback) callback(val, req.status);
				}
			} catch(e) {
				Zotero.logError(e);
				return;
			}
		};
		var uri = CONNECTOR_URI+"connector/"+method;
		
		Zotero.HTTP.doPost(uri, JSON.stringify(data),
			newCallback, {
				"Content-Type":"application/json",
				"X-Zotero-Version":Zotero.version,
				"X-Zotero-Connector-API-Version":CONNECTOR_API_VERSION
		});
	}
}

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