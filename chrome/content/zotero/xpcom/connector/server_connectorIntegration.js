/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2017 Center for History and New Media
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

/**
 * Adds integration endpoints related to doc integration via HTTP/connector.
 * 
 * document/execCommand initiates an integration command and responds with the
 * next request for the http client (e.g. 'Application.getDocument').
 * The client should respond to document/respond with the payload and expect
 * another response with the next request, until it receives 'Document.complete'
 * at which point the integration transaction is considered complete.
 */
Zotero.Server.Endpoints['/connector/document/execCommand'] = function() {};
Zotero.Server.Endpoints['/connector/document/execCommand'].prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	init: function(data, sendResponse) {
		if (Zotero.HTTPIntegrationClient.inProgress) {
			// This will focus the last integration window if present
			Zotero.Integration.execCommand('http', data.command, data.docId);
			sendResponse(503, 'text/plain', 'Integration transaction is already in progress')
			return;
		}
		Zotero.HTTPIntegrationClient.inProgress = true;
		Zotero.HTTPIntegrationClient.sendResponse = sendResponse;
		Zotero.Integration.execCommand('http', data.command, data.docId);
	},
};

Zotero.Server.Endpoints['/connector/document/respond'] = function() {};
Zotero.Server.Endpoints['/connector/document/respond'].prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	init: function (data, sendResponse) {
		// Earlier version of the gdocs plugin used to double-encode the JSON data
		try {
			data = JSON.parse(data);
		}
		catch (e) {}
		if (data && data.error) {
			// Apps Script stack is a JSON object
			if (typeof data.stack != "string") {
				data.stack = JSON.stringify(data.stack);
			}
			let error = data;
			if (data.error == 'Alert') {
				error = new Zotero.Exception.Alert(data.message);
				error.stack = data.stack;
			}
			Zotero.HTTPIntegrationClient.deferredResponse.reject(error);
		} else {
			Zotero.HTTPIntegrationClient.deferredResponse.resolve(data);
		}
		Zotero.HTTPIntegrationClient.sendResponse = sendResponse;
	}
};

// For managing macOS integration and progress window focus
Zotero.Server.Endpoints['/connector/sendToBack'] = function() {};
Zotero.Server.Endpoints['/connector/sendToBack'].prototype = {
	supportedMethods: ["POST", "GET"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	init: function (requestData) {
		Zotero.Utilities.Internal.sendToBack();
		return 200;
	},
};
