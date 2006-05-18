var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
var whateverBox;

/*
	To add a new preference:
		* modify defaults/prefs.js
		* add a control to prefs.xul
		* in this document:
			1) add var above
			2) add lines to init() function
			3) add line to accept() function
*/

function init()
{	
	whateverBox = document.getElementById('whateverBox');
	whateverBox.checked = prefManager.getBoolPref('extensions.scholar.whatever');

}

function accept()
{
	prefManager.setBoolPref('extensions.scholar.whatever', whateverBox.checked);
}