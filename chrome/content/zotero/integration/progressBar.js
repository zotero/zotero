/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Center for History and New Media
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
Components.utils.import("resource://gre/modules/Services.jsm");

var Zotero_ProgressBar = new function () {
	var initialized, io;
	
	/**
	 * Pre-initialization, when the dialog has loaded but has not yet appeared
	 */
	this.onDOMContentLoaded = function(event) {
		if(event.target === document) {
			initialized = true;
			io = window.arguments[0].wrappedJSObject;
			if (io.onLoad) {
				io.onLoad(_onProgress);
			}
			
			// Only hide chrome on Windows or Mac
			if(Zotero.isMac) {
				document.documentElement.setAttribute("drawintitlebar", true);
			} else if(Zotero.isWin) {
				document.documentElement.setAttribute("hidechrome", true);
			}
			
			new WindowDraggingElement(document.getElementById("quick-format-dialog"), window);

			// With fx60 and drawintitlebar=true Firefox calculates the minHeight
			// as titlebar+maincontent, so we have hack around that here.
			if (Zotero.isMac && Zotero.platformMajorVersion >= 60) {
				document.getElementById("quick-format-entry").style.marginBottom = "-22px";
			}
		
		}
	};
	
	/**
	 * Center the window
	 */
	this.onLoad = function(event) {
		if(event.target !== document) return;		
		// make sure we are visible
		window.focus();
		window.setTimeout(function() {
			var targetX = Math.floor(-window.outerWidth/2 + (window.screen.width / 2));
			var targetY = Math.floor(-window.outerHeight/2 + (window.screen.height / 2));
			Zotero.debug("Moving window to "+targetX+", "+targetY);
			window.moveTo(targetX, targetY);
		}, 0);
	};
	
	/**
	 * Called when progress changes
	 */
	function _onProgress(percent) {
		var meter = document.getElementById("quick-format-progress-meter");
		if(percent === null) {
			meter.mode = "undetermined";
		} else {
			meter.mode = "determined";
			meter.value = Math.round(percent);
		}
	}
	
	/**
	 * Resizes windows
	 * @constructor
	 */
	var Resizer = function(panel, targetWidth, targetHeight, pixelsPerStep, stepsPerSecond) {
		this.panel = panel;
		this.curWidth = panel.clientWidth;
		this.curHeight = panel.clientHeight;
		this.difX = (targetWidth ? targetWidth - this.curWidth : 0);
		this.difY = (targetHeight ? targetHeight - this.curHeight : 0);
		this.step = 0;
		this.steps = Math.ceil(Math.max(Math.abs(this.difX), Math.abs(this.difY))/pixelsPerStep);
		this.timeout = (1000/stepsPerSecond);
		
		var me = this;
		this._animateCallback = function() { me.animate() };
	};
	
	/**
	 * Performs a step of the animation
	 */
	Resizer.prototype.animate = function() {
		if(this.stopped) return;
		this.step++;
		this.panel.sizeTo(this.curWidth+Math.round(this.step*this.difX/this.steps),
			this.curHeight+Math.round(this.step*this.difY/this.steps));
		if(this.step !== this.steps) {
			window.setTimeout(this._animateCallback, this.timeout);
		}
	};
	
	/**
	 * Halts resizing
	 */
	Resizer.prototype.stop = function() {
		this.stopped = true;
	};
}

window.addEventListener("DOMContentLoaded", Zotero_ProgressBar.onDOMContentLoaded, false);
window.addEventListener("load", Zotero_ProgressBar.onLoad, false);
