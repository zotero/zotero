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
	var _lastItem;
	
	this.onLoad = onLoad;
	
	
	function onLoad()
	{
		if (!Zotero || !Zotero.initialized) {
			return;
		}
		
		// Not in item pane, so skip the introductions
		if (!document.getElementById('zotero-view-tabbox')) {
			return;
		}
		
		_itemBox = document.getElementById('zotero-editpane-item-box');
		_tagsBox = document.getElementById('zotero-editpane-tags');
		_relatedBox = document.getElementById('zotero-editpane-related');
	}
	
	
	/*
	 * Load an item
	 */
	this.viewItem = function (item, mode, index) {
		if (!index) {
			index = 0;
		}
		
		Zotero.debug('Viewing item in pane ' + index);
		
		switch (index) {
			case 0:
				var box = _itemBox;
				break;
				
			case 1:
				var box = _tagsBox;
				break;
			
			case 2:
				var box = _relatedBox;
				break;
		}
		
		// Force blur() when clicking off a textbox to another item in middle
		// pane, since for some reason it's not being called automatically
		if (_lastItem && _lastItem != item) {
			switch (index) {
				case 0:
				case 1:
					box.blurOpenField();
					// DEBUG: Currently broken
					//box.scrollToTop();
					break;
			}
		}
		
		_lastItem = item;
		
		if (mode) {
			box.mode = mode;
		}
		else {
			box.mode = 'edit';
		}
		box.item = item;
	}
}

addEventListener("load", function(e) { ZoteroItemPane.onLoad(e); }, false);
