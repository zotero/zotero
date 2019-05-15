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
 * This is a HTTP-based integration interface for Zotero. The actual
 * heavy lifting occurs in the connector and/or wherever the connector delegates the heavy
 * lifting to.
 */
Zotero.HTTPIntegrationClient = {
	deferredResponse: null,
	sendCommandPromise: Zotero.Promise.resolve(),
	sendCommand: async function(command, args=[]) {
		let payload = JSON.stringify({command, arguments: args});
		function sendCommand() {
			Zotero.HTTPIntegrationClient.deferredResponse = Zotero.Promise.defer();
			Zotero.HTTPIntegrationClient.sendResponse.apply(Zotero.HTTPIntegrationClient,
				[200, 'application/json', payload]);
			return Zotero.HTTPIntegrationClient.deferredResponse.promise;
		}
		// Force issued commands to occur sequentially, since these are really just
		// a sequence of HTTP requests and responses.
		// We might want to consider something better later, but this has the advantage of
		// being easy to interface with as a Client, as you don't need SSE or WS.
		if (command != 'Document.complete') {
			Zotero.HTTPIntegrationClient.sendCommandPromise = 
				Zotero.HTTPIntegrationClient.sendCommandPromise.then(sendCommand, sendCommand);
		} else {
			await Zotero.HTTPIntegrationClient.sendCommandPromise;
			sendCommand();
		}
		return Zotero.HTTPIntegrationClient.sendCommandPromise;
	}
};

Zotero.HTTPIntegrationClient.Application = function() {
	this.primaryFieldType = "Http";
	this.secondaryFieldType = "Http";
	this.outputFormat = 'html';
	this.supportedNotes = ['footnotes'];
	this.supportsImportExport = false;
	this.processorName = "HTTP Integration";
};
Zotero.HTTPIntegrationClient.Application.prototype = {
	getActiveDocument: async function() {
		let result = await Zotero.HTTPIntegrationClient.sendCommand('Application.getActiveDocument');
		this.outputFormat = result.outputFormat || this.outputFormat;
		this.supportedNotes = result.supportedNotes || this.supportedNotes;
		this.supportsImportExport = result.supportsImportExport || this.supportsImportExport;
		this.processorName = result.processorName || this.processorName;
		return new Zotero.HTTPIntegrationClient.Document(result.documentID);
	}
};

/**
 * See integrationTests.js
 */
Zotero.HTTPIntegrationClient.Document = function(documentID) {
	this._documentID = documentID;
};
for (let method of ["activate", "canInsertField", "displayAlert", "getDocumentData",
	"setDocumentData", "setBibliographyStyle", "importDocument", "exportDocument"]) {
	Zotero.HTTPIntegrationClient.Document.prototype[method] = async function() {
		return Zotero.HTTPIntegrationClient.sendCommand("Document."+method,
			[this._documentID].concat(Array.prototype.slice.call(arguments)));
	};
}

// @NOTE Currently unused, prompts are done using the connector
Zotero.HTTPIntegrationClient.Document.prototype._displayAlert = async function(dialogText, icon, buttons) {
	var ps = Services.prompt;
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_OK)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
	
	switch (buttons) {
		case DIALOG_BUTTONS_OK:
			buttonFlags = ps.BUTTON_POS_0_DEFAULT + ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK; break;
		case DIALOG_BUTTONS_OK_CANCEL:
			buttonFlags = ps.BUTTON_POS_0_DEFAULT + ps.STD_OK_CANCEL_BUTTONS; break;
		case DIALOG_BUTTONS_YES_NO:
			buttonFlags = ps.BUTTON_POS_0_DEFAULT + ps.STD_YES_NO_BUTTONS; break;
		case DIALOG_BUTTONS_YES_NO_CANCEL:
			buttonFlags = ps.BUTTON_POS_0_DEFAULT + ps.BUTTON_POS_0 * ps.BUTTON_TITLE_YES +
				ps.BUTTON_POS_1 * ps.BUTTON_TITLE_NO +
				ps.BUTTON_POS_2 * ps.BUTTON_TITLE_CANCEL; break;
	}

	var result = ps.confirmEx(
		null,
		"Zotero",
		dialogText,
		buttonFlags,
		null, null, null,
		null,
		{}
	);
	
	switch (buttons) {
		default:
			break;
		case DIALOG_BUTTONS_OK_CANCEL:
		case DIALOG_BUTTONS_YES_NO:
			result = (result+1)%2; break;
		case DIALOG_BUTTONS_YES_NO_CANCEL:
			result = result == 0 ? 2 : result == 2 ? 0 : 1; break;
	}
	await this.activate();
	return result;
}
Zotero.HTTPIntegrationClient.Document.prototype.cleanup = async function() {};
Zotero.HTTPIntegrationClient.Document.prototype.cursorInField = async function(fieldType) {
	var retVal = await Zotero.HTTPIntegrationClient.sendCommand("Document.cursorInField", [this._documentID, fieldType]);
	if (!retVal) return null;
	return new Zotero.HTTPIntegrationClient.Field(this._documentID, retVal);
};
Zotero.HTTPIntegrationClient.Document.prototype.insertField = async function(fieldType, noteType) {
	var retVal = await Zotero.HTTPIntegrationClient.sendCommand("Document.insertField", [this._documentID, fieldType, parseInt(noteType) || 0]);
	return new Zotero.HTTPIntegrationClient.Field(this._documentID, retVal);
};
Zotero.HTTPIntegrationClient.Document.prototype.getFields = async function(fieldType) {
	var retVal = await Zotero.HTTPIntegrationClient.sendCommand("Document.getFields", [this._documentID, fieldType]);
	return retVal.map(field => new Zotero.HTTPIntegrationClient.Field(this._documentID, field));
};
Zotero.HTTPIntegrationClient.Document.prototype.convert = async function(fields, fieldType, noteTypes) {
	fields = fields.map((f) => f._id);
	await Zotero.HTTPIntegrationClient.sendCommand("Document.convert", [this._documentID, fields, fieldType, noteTypes]);
};
Zotero.HTTPIntegrationClient.Document.prototype.complete = async function() {
	Zotero.HTTPIntegrationClient.inProgress = false;
	Zotero.HTTPIntegrationClient.sendCommand("Document.complete", [this._documentID]);
};

/**
 * See integrationTests.js
 */
Zotero.HTTPIntegrationClient.Field = function(documentID, json) {
	this._documentID = documentID; 
	this._id = json.id;
	this._code = json.code;
	this._text = json.text;
	this._noteIndex = json.noteIndex;
};
Zotero.HTTPIntegrationClient.Field.prototype = {};

for (let method of ["delete", "select", "removeCode"]) {
	Zotero.HTTPIntegrationClient.Field.prototype[method] = async function() {
		return Zotero.HTTPIntegrationClient.sendCommand("Field."+method,
			[this._documentID, this._id].concat(Array.prototype.slice.call(arguments)));
	};
}
Zotero.HTTPIntegrationClient.Field.prototype.getText = async function() {
	return this._text;
};
Zotero.HTTPIntegrationClient.Field.prototype.setText = async function(text, isRich) {
	// The HTML will be stripped by Google Docs and and since we're 
	// caching this value, we need to strip it ourselves
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
             .createInstance(Components.interfaces.nsIDOMParser);
	var doc = parser.parseFromString(text, "text/html");
	this._text = doc.documentElement.textContent;
	return Zotero.HTTPIntegrationClient.sendCommand("Field.setText", [this._documentID, this._id, text, true]);
};
Zotero.HTTPIntegrationClient.Field.prototype.getCode = async function() {
	return this._code;
};
Zotero.HTTPIntegrationClient.Field.prototype.setCode = async function(code) {
	this._code = code;
	return Zotero.HTTPIntegrationClient.sendCommand("Field.setCode", [this._documentID, this._id, code]);
};
Zotero.HTTPIntegrationClient.Field.prototype.getNoteIndex = async function() {
	return this._noteIndex;
};
Zotero.HTTPIntegrationClient.Field.prototype.equals = async function(arg) {
	return this._id === arg._id;
};
