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
	const CONNECTOR_SERVER_API_VERSION = 1;
	
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
					Zotero.debug("Connector: Method "+method+" failed");
					if(callback) callback(false, req.status);
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
			newCallback, {"Content-Type":"application/json"});
	}
}