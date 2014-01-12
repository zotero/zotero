/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

Zotero.Report = new function() {
	this.fillElement = function(elt, text) {
		elt.appendChild(this.doc.createTextNode(text));
	}

	this.addElement = function(parent,child) {
		if (typeof child == 'string') {
				child = this.doc.createElement(child);
		}
		// for no indentation, just do
		// parent.appendChild(child);
		// return child;

		var indent = '', elem = parent;

		while (elem.parentNode) {
			indent += '  ';
			elem = elem.parentNode;
		}

		if (parent.hasChildNodes()) { // && parent.lastChild.nodeType === 3 && /^\s*[\r\n]\s*$/.test(parent.lastChild.textContent)) {
			parent.insertBefore(this.doc.createTextNode("\n" + indent), parent.lastChild);
			parent.insertBefore(child, parent.lastChild);
		} else {
			parent.appendChild(this.doc.createTextNode("\n" + indent));
			parent.appendChild(child);
			parent.appendChild(this.doc.createTextNode("\n" + indent.slice(0,-2)));
		}

		return child;
	}

	this.addNote = function(elt, note) {
		// If not valid XML, display notes with entities encoded
		var note = '<div>' + note
			// &nbsp; isn't valid in HTML
			.replace(/&nbsp;/g, "&#160;")
			// Strip control characters (for notes that were
			// added before item.setNote() started doing this)
			.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
			+ '</div>';
		var note = this.parser.parseFromString(note, 'text/html');
		if (note.documentElement.tagName == 'parsererror') {
			Zotero.debug(note.documentElement.textContent, 2);
			var p = this.addElement(elt, 'p');
			p.setAttribute('class', 'plaintext');
			this.fillElement(p, arr.note);
		} else { // Otherwise render markup normally
			this.addElement(elt, note.documentElement);
		}
	}
	
	this.generateHTMLDetails = function(items, combineChildItems) {
		this.parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser);
		this.doc = this.parser.parseFromString('<!DOCTYPE html><html><head></head><body></body></html>', 'text/html');
		this.serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer);

		var head = this.doc.getElementsByTagName('head')[0];
		var body = this.doc.getElementsByTagName('body')[0];

		var meta = this.addElement(head, 'meta');
		meta.setAttribute('http-equiv', 'Content-Type');
		meta.setAttribute('content', 'text/html; charset=utf-8');

		var title = this.addElement(head, 'title');
		this.fillElement(title, Zotero.getString('report.title.default'));

		for (var props of [
					{href: 'zotero://report/detail.css'},
					{href: 'zotero://report/detail_screen.css', media: 'screen,projection'}, 
					{href: 'zotero://report/detail_print.css',	media: 'print'}]) {
			var link = this.addElement(head, 'link');
			link.setAttribute('rel', 'stylesheet');
			link.setAttribute('style', 'text/css');
			link.setAttribute('href', props.href);
			if (props.media) { link.setAttribute('media', props.media); }
		}

		var reportUL = this.addElement(body, 'ul');
		reportUL.setAttribute('class', 'report' + (combineChildItems ? ' combineChildItems' : ''));
		
		for each(var arr in items) {
			var reportItem = this.addElement(reportUL, 'li');
			reportItem.setAttribute('id', 'item-' + arr.itemID);
			reportItem.setAttribute('class', 'item ' + arr.itemType);
			
			if (arr.title) {
				var h2 = this.addElement(reportItem, 'h2');
				if (arr.reportSearchMatch) { // Top-level item matched search, so display title
					this.fillElement(h2, arr.title);
				}
				else {											// Non-matching parent, so display "Parent Item: [Title]"
					h2.setAttribute('class', 'parentItem');
					this.fillElement(h2, Zotero.getString('report.parentItem'));
					var span = this.addElement(h2, 'span');
					span.setAttribute('class', 'title');
					this.fillElement(span, arr.title);
				}
			}
			
			// If parent matches search, display parent item metadata table and tags
			if (arr.reportSearchMatch) {
				this._generateMetadataTable(reportItem, arr);
				
				this._generateTagsList(reportItem, arr);
				
				// Independent note
				if (arr['note']) { this.addNote(reportItem, arr.note); }
			}
			
			// Children
			if (arr.reportChildren) {
				// Child notes
				if (arr.reportChildren.notes.length) {
					// Only display "Notes:" header if parent matches search
					if (arr.reportSearchMatch) {
						var h3 = this.addElement(reportItem, 'h3');
						h3.setAttribute('class', 'notes');
						this.fillElement(h3, Zotero.getString('report.notes'));
					}
					var notesUL = this.addElement(reportItem, 'ul');
					notesUL.setAttribute('class', 'notes');
					for each(var note in arr.reportChildren.notes) {
						var notesLI = this.addElement(notesUL, 'li');
						notesLI.setAttribute('id', 'note-' + note.itemID);

						this.addNote(notesLI, note.note);

						// Child note tags
						this._generateTagsList(notesLI, note);
					}
				}
			
				// Chid attachments
				this._generateAttachmentsList(reportItem, arr.reportChildren);
			}
			
			// Related
			if (arr.reportSearchMatch && arr.related && arr.related.length) {
				var h3 = this.addElement(reportItem, 'h3');
				h3.setAttribute('class', 'related');
				this.fillElement(h3, Zotero.getString('itemFields.related'));

				var relatedUL = this.addElement(reportItem, 'ul');
				var relateds = Zotero.Items.get(arr.related);
				for each(var related in relateds) {
					var relatedLI = this.addElement(relatedUL, 'li');
					relatedLI.setAttribute('id', 'related-' + related.getID());
					this.fillElement(relatedLI, related.getDisplayTitle());
				}
			}
		}

		return this.serializer.serializeToString(this.doc);
	}
	
	this._generateMetadataTable = function(root, arr) {
		var table = this.addElement(root, 'table');
		var unlink = true;
    // add and optionally unlink or the indentation is off
		
		// Item type
		var tr = this.addElement(table, 'tr');
		tr.setAttribute('class', 'itemType');
		var th = this.addElement(tr, 'th');
		this.fillElement(th, Zotero.getString('itemFields.itemType'));
		var td = this.addElement(tr, 'td');
		this.fillElement(td, Zotero.ItemTypes.getLocalizedString(arr.itemType));

		// Creators
		if (arr['creators']) {
			unlink = false;
			var displayText;
			
			for each(var creator in arr['creators']) {
				// Two fields
				if (creator['fieldMode']==0) {
					displayText = creator['firstName'] + ' ' + creator['lastName'];
				}
				// Single field
				else if (creator['fieldMode']==1) {
					displayText = creator['lastName'];
				}
				else {
					// TODO
				}
				
				var tr = this.addElement(table, 'tr');
				tr.setAttribute('class', 'creator ' + creator.creatorType);
				var th = this.addElement(tr, 'th');
				th.setAttribute('class', creator.creatorType);
				this.fillElement(th, Zotero.getString('creatorTypes.' + creator.creatorType));
				var td = this.addElement(tr, 'td');
				this.fillElement(td, displayText);
			}
		}
		
		// Move dateAdded and dateModified to the end of the array
		var da = arr['dateAdded'];
		var dm = arr['dateModified'];
		delete arr['dateAdded'];
		delete arr['dateModified'];
		arr['dateAdded'] = da;
		arr['dateModified'] = dm;
		
		for (var i in arr) {
			// Skip certain fields
			switch (i) {
				case 'reportSearchMatch':
				case 'reportChildren':
				
				case 'libraryID':
				case 'key':
				case 'itemType':
				case 'itemID':
				case 'sourceItemID':
				case 'title':
				case 'firstCreator':
				case 'creators':
				case 'tags':
				case 'related':
				case 'notes':
				case 'note':
				case 'attachments':
					continue;
			}
			
			try {
				var localizedFieldName = Zotero.ItemFields.getLocalizedString(arr.itemType, i);
			}
			// Skip fields we don't have a localized string for
			catch (e) {
				Zotero.debug('Localized string not available for ' + 'itemFields.' + i, 2);
				continue;
			}
			
			arr[i] = Zotero.Utilities.trim(arr[i] + '');
			
			// Skip empty fields
			if (!arr[i]) {
				continue;
			}
			
			unlink = false;

			var tr = this.addElement(table, 'tr');
			tr.setAttribute('class', i);
			var th = this.addElement(tr, 'th');
			th.setAttribute('class', i);
			this.fillElement(th, localizedFieldName)
			var td = this.addElement(tr, 'td');

			if (i == 'url' && arr[i].match(/^https?:\/\//)) {
				var a = this.addElement(td, 'a');
				a.setAttribute('href', arr[i]);
				this.fillElement(a, arr[i]);
			}
			// Remove SQL date from multipart dates
			// (e.g. '2006-00-00 Summer 2006' becomes 'Summer 2006')
			else if (i=='date') {
				this.fillElement(td, Zotero.Date.multipartToStr(arr[i]));
			}
			// Convert dates to local format
			else if (i=='accessDate' || i=='dateAdded' || i=='dateModified') {
				var date = Zotero.Date.sqlToDate(arr[i], true)
				this.fillElement(td, date.toLocaleString());
			}
			else {
				this.fillElement(td, arr[i]);
			}
		}
		
		if (unlink) { root.removeChild(table); }
	}
	
	this._generateTagsList = function(root, arr) {
		if (arr['tags'] && arr['tags'].length) {
			var h3 = this.addElement(root, 'h3');
			h3.setAttribute('class', 'tags');
			this.fillElement(h3, Zotero.getString('report.tags'));
			var ul = this.addElement(root, 'ul');
			ul.setAttribute('class', 'tags');
			for each(var tag in arr.tags) {
				this.fillElement(this.addElement(ul, 'li'), tag.fields.name);
			}
		}
	}

	this._generateAttachmentsList = function(root, arr) {
		if (arr.attachments && arr.attachments.length) {
			var h3 = this.addElement(root, 'h3');
			h3.setAttribute('class', 'attachments');
			this.fillElement(h3, Zotero.getString('itemFields.attachments'));
			var ul = this.addElement(root, 'ul');
			ul.setAttribute('class', 'attachments');
			for each(var attachment in arr.attachments) {
				var li = this.addElement(ul, 'li');
				li.setAttribute('id', 'attachment-' + attachment.itemID);
				this.fillElement(li, attachment.title);
				
				// Attachment tags
				this._generateTagsList(li, attachment);
				
				// Attachment note
				if (attachment.note) { this.addNote(li, attachment.note); }
			}
		}
	}
}
