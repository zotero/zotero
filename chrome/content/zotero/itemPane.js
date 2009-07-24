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

var ZoteroItemPane = new function() {
	var _itemBeingEdited;
	
	var _lastPane;
	var _loaded;
	
	var _lastTabIndex;
	var _tabDirection;
	var _tabIndexMaxTagsFields = 0;
	
	this.onLoad = onLoad;
	this.viewItem = viewItem;
	this.loadPane = loadPane;
	
	
	function onLoad()
	{
		if (!Zotero || !Zotero.initialized) {
			return;
		}
		
		// Not in item pane, so skip the introductions
		if (!document.getElementById('zotero-view-tabbox')) {
			return;
		}
		
		_deck = document.getElementById('zotero-view-item');
		_itemBox = document.getElementById('zotero-editpane-item-box');
		_tagsBox = document.getElementById('zotero-editpane-tags');
		_relatedBox = document.getElementById('zotero-editpane-related');
	}
	
	/*
	 * Loads an item 
	 */
	function viewItem(thisItem, mode) {
		//Zotero.debug('Viewing item');
		
		// Force blur() when clicking off a textbox to another item in middle
		// pane, since for some reason it's not being called automatically
		if (_itemBeingEdited && _itemBeingEdited != thisItem) {
			switch (_deck.selectedIndex) {
				// Info
				case 0:
					// TODO: fix
					//var boxes = _itemBox.getElementsByTagName('textbox');
					
					// When coming from another element, scroll pane to top
					//scrollToTop();
					break;
					
				// Tags
				case 3:
					var boxes = document.getAnonymousNodes(_tagsBox)[0].getElementsByTagName('textbox');
					break;
			}
			
			if (boxes && boxes.length == 1) {
				//boxes[0].inputField.blur();
			}
		}
		
		_itemBeingEdited = thisItem;
		_loaded = {};
		
		loadPane(_deck.selectedIndex, mode);
	}
	
	
	function loadPane(index, mode) {
		//Zotero.debug('Loading item pane ' + index);
		
		// Clear the tab index when switching panes
		if (_lastPane!=index) {
			_lastTabIndex = null;
		}
		_lastPane = index;
		
		if (_loaded[index]) {
			return;
		}
		_loaded[index] = true;
		
		// Info pane
		if (index == 0) {
			// Hack to allow read-only mode in right pane -- probably a better
			// way to allow access to this
			if (mode) {
				_itemBox.mode = mode;
			}
			else {
				_itemBox.mode = 'edit';
			}
			_itemBox.item = _itemBeingEdited;
		}
		
		
		// Tags pane
		else if (index == 1) {
			if (mode) {
				_tagsBox.mode = mode;
			}
			else {
				_tagsBox.mode = 'edit';
			}
			
			var focusMode = 'tags';
			var focusBox = _tagsBox;
			_tagsBox.item = _itemBeingEdited;
		}
		
		// Related pane
		else if (index == 2) {
			_relatedBox.item = _itemBeingEdited;
		}
	}
}

addEventListener("load", function(e) { ZoteroItemPane.onLoad(e); }, false);
