/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2014 Center for History and New Media
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

var Zotero_AttachLink = new function() {
	function getAttachFileLabel() {
		return window.opener.document
			.getElementById('zotero-tb-attachment-add-file-link')
			.label;
	};

	this.submit = function() {
		var link = document.getElementById('zotero-attach-uri-input').value;
		var message = document.getElementById('zotero-attach-uri-message');
		var cleanURI = Zotero.Attachments.cleanAttachmentURI(link, true);
		
		if (!cleanURI) {
			message.textContent = Zotero.getString('pane.items.attach.link.uri.unrecognized');
			window.sizeToContent();
			document.getElementById('zotero-attach-uri-input').select();
			return false;
		}
		// Don't allow "file:" links, because using "Attach link to file" is the right way
		else if (cleanURI.toLowerCase().indexOf('file:') == 0) {
			message.textContent = Zotero.getString('pane.items.attach.link.uri.file',
				[getAttachFileLabel()]);
			window.sizeToContent();
			document.getElementById('zotero-attach-uri-input').select();
			return false;
		}
		else {
			window.arguments[0].out = {
				link:	cleanURI,
				title:	document.getElementById('zotero-attach-uri-title').value
			};
			return true;
		}
	};
}