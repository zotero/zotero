/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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
 * Fake tooltip implementation for HTML-in-XUL elements where neither 'title' nor 'tooltiptext' works
 */
// eslint-disable-next-line camelcase,no-unused-vars
var Zotero_Tooltip = new function () {
	// On macOS, the tooltip appears even if the mouse keeps moving over the element, but Mozilla
	// shows it only once the mouse stops, so follow that as long as there are XUL elements.
	const MOUSE_STOP_DELAY = 500;
	
	var text;
	var timeoutID;
	var x;
	var y;
	
	/**
	 * Start tracking the mouse and show a tooltip after it stops
	 */
	this.start = function (tooltipText) {
		window.addEventListener('mousemove', handleMouseMove);
		text = tooltipText;
	};
	
	/**
	 * Stop tracking the mouse and hide the tooltip if it's showing
	 */
	this.stop = function () {
		window.removeEventListener('mousemove', handleMouseMove);
		clearTimeout(timeoutID);
		// Mozilla hides the tooltip as soon as the mouse leaves the element, which is also different
		// from macOS behavior
		hidePopup();
	};
	
	function handleMouseMove(event) {
		if (timeoutID) {
			clearTimeout(timeoutID);
		}
		x = event.screenX;
		y = event.screenY;
		timeoutID = setTimeout(handleMouseStop, MOUSE_STOP_DELAY);
	}
	
	function handleMouseStop() {
		var tooltipElem = document.getElementById('fake-tooltip');
		tooltipElem.setAttribute('label', text);
		tooltipElem.openPopupAtScreen(x, y, false, null);
	}
	
	function hidePopup() {
		var tooltipElem = document.getElementById('fake-tooltip');
		tooltipElem.hidePopup();
	}
};
