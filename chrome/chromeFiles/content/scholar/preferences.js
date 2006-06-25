var autoUpdateBox;

/*
	To add a new preference:
		1) modify defaults/preferences/scholar.js
		2) in this document:
			a) add var above
			b) add lines to init() function
			c) add line to accept() function
		3) add a control to prefs.xul
		4) (Optional) To add an observer for a preference change,
			add an appropriate case in the switch statement
			in Scholar.Prefs.observe()
*/

function init()
{	
	autoUpdateBox = document.getElementById('autoUpdateBox');
	autoUpdateBox.checked = Scholar.Prefs.get('automaticScraperUpdates');

}

function accept()
{
	Scholar.Prefs.set('automaticScraperUpdates', autoUpdateBox.checked)
}