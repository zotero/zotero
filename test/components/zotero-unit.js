"use strict";
/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2012 Center for History and New Media
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
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function ZoteroUnit() {
	this.wrappedJSObject = this;
}
ZoteroUnit.prototype = {
	/* nsICommandLineHandler */
	handle:function(cmdLine) {
        this.tests = cmdLine.handleFlagWithParam("test", false);
        this.noquit = cmdLine.handleFlag("noquit", false);
		this.makeTestData = cmdLine.handleFlag("makeTestData", false);
		this.noquit = !this.makeTestData && this.noquit;
		this.runTests = !this.makeTestData;
		this.bail = cmdLine.handleFlag("bail", false);
		this.startAt = cmdLine.handleFlagWithParam("startAtTestFile", false);
		this.stopAt = cmdLine.handleFlagWithParam("stopAtTestFile", false);
		this.grep = cmdLine.handleFlagWithParam("grep", false);
		this.timeout = cmdLine.handleFlagWithParam("ZoteroTestTimeout", false);
	},

	dump:function(x) {
		dump(x);
	},
	
	contractID: "@mozilla.org/commandlinehandler/general-startup;1?type=zotero-unit",
	classDescription: "Zotero Unit Command Line Handler",
	classID: Components.ID("{b8570031-be5e-46e8-9785-38cd50a5d911}"),
	service: true,
	_xpcom_categories: [{category:"command-line-handler", entry:"m-zotero-unit"}],
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsICommandLineHandler,
	                                       Components.interfaces.nsISupports])
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([ZoteroUnit]);
