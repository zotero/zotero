var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
var autoUpdateBox;

/*
	To add a new preference:
		1) modify defaults/preferences/scholar.js
		2) in this document:
			a) add var above
			b) add lines to init() function
			c) add line to accept() function
		3) add a control to prefs.xul
*/

function init()
{	
	autoUpdateBox = document.getElementById('autoUpdateBox');
	autoUpdateBox.checked = prefManager.getBoolPref('extensions.scholar.automaticScraperUpdates');

}

function accept()
{
	prefManager.setBoolPref('extensions.scholar.automaticScraperUpdates', autoUpdateBox.checked);
}