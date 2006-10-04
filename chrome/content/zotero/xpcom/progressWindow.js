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

/*
 * Handles the display of a div showing progress in scraping, indexing, etc.
 *
 * Pass the active window into the constructor
 */
Zotero.ProgressWindow = function(_window){
	if (!_window){
		var _window =
			Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
				getService(Components.interfaces.nsIWindowWatcher).
				activeWindow;
	}
	
	var _progressWindow = null;
	var _windowLoaded = false;
	var _windowLoading = false;
	// keep track of all of these things in case they're called before we're
	// done loading the progress window
	var _loadDescription = null;
	var _loadLines = new Array();
	var _loadIcons = new Array();
	var _loadHeadline = '';
	
	this.show = show;
	this.changeHeadline = changeHeadline;
	this.addLines = addLines;
	this.addDescription = addDescription;
	this.fade = fade;
	this.kill = kill;
	
	
	function show() {
		if(_windowLoading || _windowLoaded) {	// already loading or loaded
			return false;
		}
		_progressWindow = _window.openDialog("chrome://zotero/chrome/progressWindow.xul",
		                                    "", "chrome,dialog=no,titlebar=no,popup=yes");
		_progressWindow.addEventListener("load", _onWindowLoaded, false);
		_windowLoading = true;
		
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
			for(i in label) {
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
	
	function addDescription(text) {
		if(_windowLoaded) {
			var newHB = _progressWindow.document.createElement("hbox");
			newHB.setAttribute("class", "zotero-progress-item-hbox");
			var newDescription = _progressWindow.document.createElement("description");
			newDescription.setAttribute("class", "zotero-progress-description");
			var newText = _progressWindow.document.createTextNode(text);
			
			newDescription.appendChild(newText);
			newHB.appendChild(newDescription);
			_progressWindow.document.getElementById("zotero-progress-text-box").appendChild(newHB);
			
			_move();
		} else {
			_loadDescription = text;
		}
	}
	
	function fade() {
		if(_windowLoaded || _windowLoading) {
			_window.setTimeout(_timeout, 2500);
		}
	}
	
	function kill() {
		_windowLoaded = false;
		_windowLoading = false;
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
		if(_loadDescription) {
			addDescription(_loadDescription);
		}
		
		// reset parameters
		_loadDescription = null;
		_loadLines = new Array();
		_loadIcons = new Array();
		_loadHeadline = '';
	}
	
	function _move() {
		_progressWindow.sizeToContent();
		_progressWindow.moveTo(
			_window.screenX + _window.innerWidth - _progressWindow.outerWidth - 30,
			_window.screenY + _window.innerHeight - _progressWindow.outerHeight - 10
		);
	}
	
	function _timeout() {
		kill();	// could check to see if we're really supposed to fade yet
				// (in case multiple scrapers are operating at once)
	}
}
