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
	this.removeNote = removeNote;
	this.addNote = addNote;
	this.removeAttachment = removeAttachment;
	this.addAttachmentFromDialog = addAttachmentFromDialog;
	this.addAttachmentFromPage = addAttachmentFromPage;
	
	
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
		_notesList = document.getElementById('zotero-editpane-dynamic-notes');
		_notesLabel = document.getElementById('zotero-editpane-notes-label');
		_attachmentsList = document.getElementById('zotero-editpane-dynamic-attachments');
		_attachmentsLabel = document.getElementById('zotero-editpane-attachments-label');
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
	
	
	function removeNote(id)
	{
		var note = Zotero.Items.get(id);
		if(note)
			if(confirm(Zotero.getString('pane.item.notes.delete.confirm')))
				note.erase();
	}
	
	function addNote()
	{
		ZoteroPane.openNoteWindow(null, null, _itemBeingEdited.id);
	}
	
	function _updateNoteCount()
	{
		var c = _notesList.childNodes.length;
		
		var str = 'pane.item.notes.count.';
		switch (c){
			case 0:
				str += 'zero';
				break;
			case 1:
				str += 'singular';
				break;
			default:
				str += 'plural';
				break;
		}
		
		_notesLabel.value = Zotero.getString(str, [c]);
	}
	
	function _updateAttachmentCount()
	{
		var c = _attachmentsList.childNodes.length;
		
		var str = 'pane.item.attachments.count.';
		switch (c){
			case 0:
				str += 'zero';
				break;
			case 1:
				str += 'singular';
				break;
			default:
				str += 'plural';
				break;
		}
		
		_attachmentsLabel.value = Zotero.getString(str, [c]);
	}
	
	function removeAttachment(id)
	{
		var attachment = Zotero.Items.get(id);
		if(attachment)
			if(confirm(Zotero.getString('pane.item.attachments.delete.confirm')))
				attachment.erase();
	}
	
	function addAttachmentFromDialog(link)
	{
		ZoteroPane.addAttachmentFromDialog(link, _itemBeingEdited.id);
	}
	
	function addAttachmentFromPage(link)
	{
		ZoteroPane.addAttachmentFromPage(link, _itemBeingEdited.id);
	}
}

addEventListener("load", function(e) { ZoteroItemPane.onLoad(e); }, false);
