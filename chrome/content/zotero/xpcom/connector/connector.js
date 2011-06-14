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
	
	this.isOnline = true;
	this.haveRefreshedData = false;
	this.data = null;
	
	/**
	 * Called to initialize Zotero
	 */
	this.init = function() {
		Zotero.Connector.getData();
	}
	
	function _getDataFile() {
		var dataFile = Zotero.getZoteroDirectory();
		dataFile.append("connector.json");
		return dataFile;
	}
	
	/**
	 * Serializes the Zotero.Connector.data object to localStorage/preferences
	 * @param {String} [json] The 
	 */
	this.serializeData = function(json) {
		if(!json) json = JSON.stringify(Zotero.Connector.data);
		
		if(Zotero.isFx) {
			Zotero.File.putContents(_getDataFile(), json);
		} else {
			localStorage.data = json;
		}
	}
	
	/**
	 * Unserializes the Zotero.Connector.data object from localStorage/preferences
	 */
	this.unserializeData = function() {
		var data = null;
		
		if(Zotero.isFx) {
			var dataFile = _getDataFile();
			if(dataFile.exists()) data = Zotero.File.getContents(dataFile);
		} else {
			if(localStorage.data) data = localStorage.data;
		}
		
		if(data) Zotero.Connector.data = JSON.parse(data);
	}

	// saner descriptions of some HTTP error codes
	this.EXCEPTION_NOT_AVAILABLE = 0;
	this.EXCEPTION_BAD_REQUEST = 400;
	this.EXCEPTION_NO_ENDPOINT = 404;
	this.EXCEPTION_CONNECTOR_INTERNAL = 500;
	this.EXCEPTION_METHOD_NOT_IMPLEMENTED = 501;
	this.EXCEPTION_CODES = [0, 400, 404, 500, 501];
	
	/**
	 * Updates Zotero's status depending on the success or failure of a request
	 *
	 * @param	{Boolean}		isOnline		Whether or not Zotero was online
	 * @param	{Function}		successCallback	Function to be called after loading new data if
	 *		Zotero is online
	 * @param	{Function}		failureCallback	Function to be called if Zotero is offline
	 *
	 * Calls Zotero.Connector.Browser.onStateChange(isOnline, method, context) if status has changed
	 */
	 function _checkState(isOnline, callback) {
		if(isOnline) {
			if(Zotero.Connector.haveRefreshedData) {
				if(callback) callback(true);
			} else {
				Zotero.Connector.getData(callback);
			}
		} else {
			if(callback) callback(false, this.EXCEPTION_NOT_AVAILABLE);
		}
		
		if(Zotero.Connector.isOnline !== isOnline) {
			Zotero.Connector.isOnline = isOnline;
			if(Zotero.Connector_Browser && Zotero.Connector_Browser.onStateChange) {
				Zotero.Connector_Browser.onStateChange(isOnline);
			}
		}
		
		return isOnline;
	}
	
	/**
	 * Loads list of translators and other relevant data from local Zotero instance
	 *
	 * @param	{Function}		successCallback	Function to be called after loading new data if
	 *		Zotero is online
	 * @param	{Function}		failureCallback	Function to be called if Zotero is offline
	 */
	this.getData = function(callback) {
		Zotero.HTTP.doPost(CONNECTOR_URI+"connector/getData",
			JSON.stringify({"browser":Zotero.Connector_Browser}),
			function(req) {
				var isOnline = req.status !== 0;
				
				if(isOnline) {
					// if request succeded, update data
					Zotero.Connector.haveRefreshedData = true;
					Zotero.Connector.serializeData(req.responseText);
					Zotero.Connector.data = JSON.parse(req.responseText);
				} else {
					// if request failed, unserialize saved data
					Zotero.Connector.unserializeData();
				}
				Zotero.Connector.Types.init(Zotero.Connector.data.schema);
				
				// update online state. this shouldn't loop, since haveRefreshedData should
				// be true if isOnline is true.
				_checkState(isOnline, callback);
			}, {"Content-Type":"application/json"});
	}
	
	/**
	 * Gives callback an object containing schema and preferences from Zotero.Connector.data
	 */
	this.getSchemaAndPreferences = function(callback) {
		if(Zotero.Connector.data) {
			callback({"schema":Zotero.Connector.data["schema"],
					"preferences":Zotero.Connector.data["preferences"]});
			return;
		}
		
		this.getData(function(success) {
			if(success) {
				callback({"schema":Zotero.Connector.data["schema"],
						"preferences":Zotero.Connector.data["preferences"]});
				return;
			}
			callback(false);
		});
	}
	
	/**
	 * Sends the XHR to execute an RPC call.
	 *
	 * @param	{String}		method			RPC method. See documentation above.
	 * @param	{Object}		data			RPC data. See documentation above.
	 * @param	{Function}		successCallback	Function to be called if request succeeded.
	 * @param	{Function}		failureCallback	Function to be called if request failed.
	 */
	this.callMethod = function(method, data, callback) {
		Zotero.HTTP.doPost(CONNECTOR_URI+"connector/"+method, JSON.stringify(data),
			function(req) {
				_checkState(req.status != 0, function() {
						if(!callback) callback(false);
						
						if(Zotero.Connector.EXCEPTION_CODES.indexOf(req.status) !== -1) {
							if(callback) callback(false, req.status);
						} else {
							if(callback) {
								var val = undefined;
								if(req.responseText) {
									if(req.getResponseHeader("Content-Type") === "application/json") {
										val = JSON.parse(req.responseText);
									} else {
										val = req.responseText;
									}
								}
								callback(val, req.status);
							}
						}
					});
			}, {"Content-Type":"application/json"});
	}
}