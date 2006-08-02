/*
	Scholar
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
	
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

var autoUpdateBox;
var positionMenu;

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
	
	positionMenu = document.getElementById('positionMenu');
	positionMenu.selectedIndex = Scholar.Prefs.get('scholarPaneOnTop') ? 0 : 1;

}

function accept()
{
	Scholar.Prefs.set('automaticScraperUpdates', autoUpdateBox.checked)
	Scholar.Prefs.set('scholarPaneOnTop', positionMenu.selectedIndex == 0)
}