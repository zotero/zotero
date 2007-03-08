/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/


Zotero.ProgressWindowSet = new function() {
	this.add = add;
	this.tile = tile;
	this.remove = remove;
	this.updateTimers = updateTimers;
	
	var _progressWindows = [];
	
	const X_OFFSET = 25;
	const Y_OFFSET = 35;
	const Y_SEPARATOR = 12;
	const X_WINDOWLESS_OFFSET = 50;
	const Y_WINDOWLESS_OFFSET = 100;
	
	function add(progressWindow, instance) {
		_progressWindows.push({
			progressWindow: progressWindow,
			instance: instance
		});
	}
	
	
	function tile(progressWin) {
		var parent = progressWin.opener;
		var y_sub = null;
		
		for (var i=0; i<_progressWindows.length; i++) {
			var p = _progressWindows[i].progressWindow;
			
			// Skip progress windows from other windows
			if (p.opener != parent) {
				continue;
			}
			
			if (!y_sub) {
				y_sub = Y_OFFSET + p.outerHeight;
			}
			
			if (parent) {
				var right = parent.screenX + parent.outerWidth;
				var bottom = parent.screenY + parent.outerHeight;
				// On OS X outerHeight doesn't include 22px title bar and
				// moveTo() positions popups 22px below the specified location
				if (Zotero.isMac) {
					bottom += (22 * 2);
				}
			}
			else {
				var right = progressWin.screen.width + X_OFFSET - X_WINDOWLESS_OFFSET;
				var bottom = progressWin.screen.height + Y_OFFSET - Y_WINDOWLESS_OFFSET;
			}
			
			p.moveTo(right - p.outerWidth - X_OFFSET, bottom - y_sub);
			
			y_sub += p.outerHeight + Y_SEPARATOR;
		}
	}
	
	
	function remove(progressWin) {
		for (var i=0; i<_progressWindows.length; i++) {
			if (_progressWindows[i].progressWindow == progressWin) {
				_progressWindows.splice(i, 1);
			}
		}
	}
	
	
	function updateTimers() {
		if (!_progressWindows.length) {
			return;
		}
		
		for (var i=0; i<_progressWindows.length; i++) {
			_progressWindows[i].instance.fade();
		}
	}
}


/*
 * Handles the display of a div showing progress in scraping, indexing, etc.
 *
 * Pass the active window into the constructor
 */
Zotero.ProgressWindow = function(_window){
	this.show = show;
	this.changeHeadline = changeHeadline;
	this.addLines = addLines;
	this.addDescription = addDescription;
	this.fade = fade;
	this.kill = kill;
	
	var _window = null;
	
	var _progressWindow = null;
	var _windowLoaded = false;
	var _windowLoading = false;
	var _timeoutID = false;
	
	// keep track of all of these things in case they're called before we're
	// done loading the progress window
	var _loadHeadline = '';
	var _loadLines = [];
	var _loadIcons = [];
	var _loadDescription = null;
	
	
	function show() {
		if(_windowLoading || _windowLoaded) {	// already loading or loaded
			return false;
		}
		
		var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
					getService(Components.interfaces.nsIWindowWatcher);
		
		if (!_window){
			_window = ww.activeWindow;
		}
		
		if (_window) {
			_progressWindow = _window.openDialog("chrome://zotero/chrome/progressWindow.xul",
				"", "chrome,dialog=no,titlebar=no,popup=yes");
		}
		else {
			_progressWindow = ww.openWindow(null, "chrome://zotero/chrome/progressWindow.xul",
				"", "chrome,dialog=no,titlebar=no,popup=yes", null);
		}
		_progressWindow.addEventListener("pageshow", _onWindowLoaded, false);
		_progressWindow.addEventListener("mouseover", _onMouseOver, false);
		_progressWindow.addEventListener("mouseout", _onMouseOut, false);
		_progressWindow.addEventListener("mouseup", _onMouseUp, false);
		
		_windowLoading = true;
		
		Zotero.ProgressWindowSet.add(_progressWindow, this);
		
		return true;
	}
	
	function changeHeadline(headline) {
		if(_windowLoaded) {
			_progressWindow.document.getElementById("zotero-progress-text-headline").value = headline;
		} else {
			_loadHeadline = headline;
		}
	}
	
	function addLines(label, icon) {
		if(_windowLoaded) {
			for (var i in label) {
				var newLabel = _progressWindow.document.createElement("label");
				newLabel.setAttribute("class", "zotero-progress-item-label");
				newLabel.setAttribute("crop", "end");
				newLabel.setAttribute("value", label[i]);
				
				var newImage = _progressWindow.document.createElement("image");
				newImage.setAttribute("class", "zotero-progress-item-icon");
				newImage.setAttribute("src", icon[i]);
				
				var newHB = _progressWindow.document.createElement("hbox");
				newHB.setAttribute("class", "zotero-progress-item-hbox");
				newHB.setAttribute("valign", "center");
				newHB.appendChild(newImage);
				newHB.appendChild(newLabel);
				
				_progressWindow.document.getElementById("zotero-progress-text-box").appendChild(newHB);
			}
			
			_move();
		} else {
			_loadLines = _loadLines.concat(label);
			_loadIcons = _loadIcons.concat(icon);
		}
	}
	
	
	/*
	 * Add a description to the progress window
	 *
	 * <a> elements are turned into XUL links
	 */
	function addDescription(text) {
		if(_windowLoaded) {
			var newHB = _progressWindow.document.createElement("hbox");
			newHB.setAttribute("class", "zotero-progress-item-hbox");
			var newDescription = _progressWindow.document.createElement("description");
			
			var utils = new Zotero.Utilities();
			var parts = utils.parseMarkup(text);
			for each(var part in parts) {
				if (part.type == 'text') {
					var elem = _progressWindow.document.createTextNode(part.text);
				}
				else if (part.type == 'link') {
					var elem = _progressWindow.document.createElement('label');
					elem.setAttribute('value', part.text);
					elem.setAttribute('class', 'text-link');
					for (var i in part.attributes) {
						elem.setAttribute(i, part.attributes[i]);
						
						if (i == 'href') {
							// DEBUG: As of Fx2, 'mouseup' seems to be the only
							// way to detect a click in a popup window
							elem.addEventListener('mouseup', _handleLinkClick, false);
						}
					}
				}
				
				newDescription.appendChild(elem);
			}
			
			newHB.appendChild(newDescription);
			_progressWindow.document.getElementById("zotero-progress-text-box").appendChild(newHB);
			
			_move();
		} else {
			_loadDescription = text;
		}
	}
	
	
	function fade() {
		if (_windowLoaded || _windowLoading) {
			if (_timeoutID) {
				return;
			}
			
			_timeoutID = _progressWindow.setTimeout(_timeout, 2500);
		}
	}
	
	function kill() {
		_disableTimeout();
		_windowLoaded = false;
		_windowLoading = false;
		Zotero.ProgressWindowSet.remove(_progressWindow);
		try {
			_progressWindow.close();
		} catch(ex) {}
	}
	
	function _onWindowLoaded() {
		_windowLoading = false;
		_windowLoaded = true;
		
		_move();
		// do things we delayed because the window was loading
		changeHeadline(_loadHeadline);
		addLines(_loadLines, _loadIcons);
		if (_loadDescription) {
			addDescription(_loadDescription);
		}
		
		// reset parameters
		_loadHeadline = '';
		_loadLines = [];
		_loadIcons = [];
		_loadDescription = null;
	}
	
	function _move() {
		_progressWindow.sizeToContent();
		Zotero.ProgressWindowSet.tile(_progressWindow);
	}
	
	function _timeout() {
		kill();	// could check to see if we're really supposed to fade yet
				// (in case multiple scrapers are operating at once)
		_timeoutID = false;
	}
	
	function _disableTimeout() {
		_progressWindow.clearTimeout(_timeoutID);
		_timeoutID = false;
	}
	
	
	/*
	 * Disable the fade timer when the mouse is over the window
	 */
	function _onMouseOver(e) {
		_disableTimeout();
	}
	
	
	/*
	 * Start the fade timer when the mouse leaves the window
	 *
	 * Note that this onmouseout doesn't work correctly on popups in Fx2,
	 * so 1) we have to calculate the window borders manually to avoid fading
	 * when the mouse is still over the box, and 2) this only does anything
	 * when the mouse is moved off of the browser window -- otherwise the fade
	 * is triggered by onmousemove on appcontent in overlay.xul.
	 */
	function _onMouseOut(e) {
		// |this| refers to progressWindow's XUL window
		var top = this.screenY + (Zotero.isMac ? 22 : 0);
		if ((e.screenX >= this.screenX && e.screenX <= (this.screenX + this.outerWidth))
			&& (e.screenY >= top) && e.screenY <= (top + this.outerHeight)) {
				return;
		}
		
		fade();
	}
	
	
	function _onMouseUp(e) {
		kill();
	}
	
	
	/*
	 * Open URL specified in target's href attribute in a new window
	 */
	function _handleLinkClick(event) {
		_progressWindow.open(event.target.getAttribute('href'), 'zotero-loaded-page',
			'menubar=yes,location=yes,toolbar=yes,personalbar=yes,resizable=yes,scrollbars=yes,status=yes');
	}
}
