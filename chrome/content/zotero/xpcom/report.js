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


Zotero.Report = {};

Zotero.Report.HTML = new function () {
	let domParser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
		.createInstance(Components.interfaces.nsIDOMParser);
	
	this.listGenerator = function* (items, combineChildItems) {
		yield '<!DOCTYPE html>\n'
			+ '<html>\n'
			+ '	<head>\n'
			+ '		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\n'
			+ '		<title>' + Zotero.getString('report.title.default') + '</title>\n'
			+ '		<link rel="stylesheet" type="text/css" href="' + _getCSSDataURI('detail') + '"/>\n'
			+ '		<link rel="stylesheet" type="text/css" media="screen,projection" href="' + _getCSSDataURI('detail_screen') + '"/>\n'
			+ '		<link rel="stylesheet" type="text/css" media="print" href="' + _getCSSDataURI('detail_print') + '"/>\n'
			+ '	</head>\n'
			+ '	<body>\n'
			+ '		<ul class="report' + (combineChildItems ? ' combineChildItems' : '') + '">';
		
		for (let i=0; i<items.length; i++) {
			let obj = items[i];
			
			let content = '\n\t\t\t<li id="item_' + obj.key + '" class="item ' + obj.itemType + '">\n';
			
			if (obj.title) {
				// Top-level item matched search, so display title
				if (obj.reportSearchMatch) {
					content += '\t\t\t<h2>' + escapeXML(obj.title) + '</h2>\n';
				}
				// Non-matching parent, so display "Parent Item: [Title]"
				else {
					content += '\t\t\t<h2 class="parentItem">' + escapeXML(Zotero.getString('report.parentItem'))
						+ ' <span class="title">' + escapeXML(obj.title) + '</span></h2>\n';
				}
			}
			
			// If parent matches search, display parent item metadata table and tags
			if (obj.reportSearchMatch) {
				content += _generateMetadataTable(obj);
				
				content += _generateTagsList(obj);
				
				// Independent note
				if (obj['note']) {
					content += '\n\t\t\t';
					content += getNoteHTML(obj.note);
				}
			}
			
			// Children
			if (obj.reportChildren) {
				// Child notes
				if (obj.reportChildren.notes.length) {
					// Only display "Notes:" header if parent matches search
					if (obj.reportSearchMatch) {
						content += '\t\t\t\t<h3 class="notes">' + escapeXML(Zotero.getString('report.notes')) + '</h3>\n';
					}
					content += '\t\t\t\t<ul class="notes">\n';
					for (let note of obj.reportChildren.notes) {
						content += '\t\t\t\t\t<li id="item_' + note.key + '">\n';
						
						content += getNoteHTML(note.note);
						
						// Child note tags
						content += _generateTagsList(note);
						
						content += '\t\t\t\t\t</li>\n';
					}
					content += '\t\t\t\t</ul>\n';
				}
			
				// Chid attachments
				content += _generateAttachmentsList(obj.reportChildren);
			}
			
			// Related items
			if (obj.reportSearchMatch && Zotero.Relations.relatedItemPredicate in obj.relations) {
				content += '\t\t\t\t<h3 class="related">' + escapeXML(Zotero.getString('itemFields.related')) + '</h3>\n';
				content += '\t\t\t\t<ul class="related">\n';
				var rels = obj.relations[Zotero.Relations.relatedItemPredicate];
				// TEMP
				if (!Array.isArray(rels)) {
					rels = [rels];
				}
				for (let i=0; i<rels.length; i++) {
					let rel = rels[i];
					let relItem = yield Zotero.URI.getURIItem(rel);
					if (relItem) {
						content += '\t\t\t\t\t<li id="item_' + relItem.key + '">';
						content += escapeXML(relItem.getDisplayTitle());
						content += '</li>\n';
					}
				}
				content += '\t\t\t\t</ul>\n';
			}
			
			
			content += '\t\t\t</li>\n\n';
			
			yield content;
		}
		
		yield '\t\t</ul>\n\t</body>\n</html>';
	};
	
	
	function _getCSSDataURI(file) {
		return 'data:text/css;base64,'
			+ Zotero.Utilities.Internal.Base64.encode(
				Zotero.File.getResource(`chrome://zotero/skin/report/${file}.css`)
			);
	}
	
	
	function _generateMetadataTable(obj) {
		var table = false;
		var content = '\t\t\t\t<table>\n';
		
		// Item type
		content += '\t\t\t\t\t<tr>\n';
		content += '\t\t\t\t\t\t<th>'
			+ escapeXML(Zotero.getString('itemFields.itemType'))
			+ '</th>\n';
		content += '\t\t\t\t\t\t<td>' + escapeXML(Zotero.ItemTypes.getLocalizedString(obj.itemType)) + '</td>\n';
		content += '\t\t\t\t\t</tr>\n';
		
		// Creators
		if (obj['creators']) {
			table = true;
			var displayText;
			
			for (let creator of obj['creators']) {
				// One field
				if (creator.name !== undefined) {
					displayText = creator.name;
				}
				// Two field
				else {
					displayText = (creator.firstName + ' ' + creator.lastName).trim();
				}
				
				content += '\t\t\t\t\t<tr>\n';
				content += '\t\t\t\t\t\t<th class="' + creator.creatorType + '">'
					+ escapeXML(Zotero.getString('creatorTypes.' + creator.creatorType))
					+ '</th>\n';
				content += '\t\t\t\t\t\t<td>' + escapeXML(displayText) + '</td>\n';
				content += '\t\t\t\t\t</tr>\n';
			}
		}
		
		// Move dateAdded and dateModified to the end of the objay
		var da = obj['dateAdded'];
		var dm = obj['dateModified'];
		delete obj['dateAdded'];
		delete obj['dateModified'];
		obj['dateAdded'] = da;
		obj['dateModified'] = dm;
		
		for (var i in obj) {
			// Skip certain fields
			switch (i) {
				case 'reportSearchMatch':
				case 'reportChildren':
				
				case 'key':
				case 'version':
				case 'itemType':
				case 'title':
				case 'creators':
				case 'note':
				case 'collections':
				case 'relations':
				case 'tags':
				case 'deleted':
				case 'parentItem':
				
				case 'charset':
				case 'contentType':
				case 'linkMode':
				case 'path':
					continue;
			}
			
			try {
				var localizedFieldName = Zotero.ItemFields.getLocalizedString(i);
			}
			// Skip fields we don't have a localized string for
			catch (e) {
				Zotero.debug('Localized string not available for ' + 'itemFields.' + i, 2);
				continue;
			}
			
			obj[i] = (obj[i] + '').trim();
			
			// Skip empty fields
			if (!obj[i]) {
				continue;
			}
			
			table = true;
			var fieldText;
			
			if (i == 'url' && obj[i].match(/^https?:\/\//)) {
				fieldText = '<a href="' + escapeXML(obj[i]) + '">' + escapeXML(obj[i]) + '</a>';
			}
			// Hyperlink DOI
			else if (i == 'DOI') {
				fieldText = '<a href="' + escapeXML('http://doi.org/' + obj[i]) + '">'
					+ escapeXML(obj[i]) + '</a>';
			}
			// Remove SQL date from multipart dates
			// (e.g. '2006-00-00 Summer 2006' becomes 'Summer 2006')
			else if (i=='date') {
				fieldText = escapeXML(Zotero.Date.multipartToStr(obj[i]));
			}
			// Convert dates to local format
			else if (i=='accessDate' || i=='dateAdded' || i=='dateModified') {
				var date = Zotero.Date.isoToDate(obj[i], true)
				fieldText = escapeXML(date.toLocaleString());
			}
			else {
				fieldText = escapeXML(obj[i]);
			}
			
			content += '\t\t\t\t\t<tr>\n\t\t\t\t\t<th>' + escapeXML(localizedFieldName)
				+ '</th>\n\t\t\t\t\t\t<td>' + fieldText + '</td>\n\t\t\t\t\t</tr>\n';
		}
		
		content += '\t\t\t\t</table>\n';
		
		return table ? content : '';
	}
	
	
	function _generateTagsList(obj) {
		var content = '';
		if (obj.tags && obj.tags.length) {
			var str = Zotero.getString('report.tags');
			content += '\t\t\t\t<h3 class="tags">' + escapeXML(str) + '</h3>\n';
			content += '\t\t\t\t<ul class="tags">\n';
			for (let i=0; i<obj.tags.length; i++) {
				content += '\t\t\t\t\t<li>' + escapeXML(obj.tags[i].tag) + '</li>\n';
			}
			content += '\t\t\t\t</ul>\n';
		}
		return content;
	}
	
	
	function _generateAttachmentsList(obj) {
		var content = '';
		if (obj.attachments && obj.attachments.length) {
			content += '\t\t\t\t<h3 class="attachments">' + escapeXML(Zotero.getString('itemFields.attachments')) + '</h3>\n';
			content += '\t\t\t\t<ul class="attachments">\n';
			for (let i=0; i<obj.attachments.length; i++) {
				let attachment = obj.attachments[i];
				
				content += '\t\t\t\t\t<li id="item_' + attachment.key + '">';
				if (attachment.title !== undefined) {
					content += escapeXML(attachment.title);
				}
				
				// Attachment tags
				content += _generateTagsList(attachment);
				
				// Attachment note
				if (attachment.note) {
					content += '\t\t\t\t\t\t<div class="note">';
					content += getNoteHTML(attachment.note);
					content += '\t\t\t\t\t</div>';
				}
				
				content += '\t\t\t\t\t</li>\n';
			}
			content += '\t\t\t\t</ul>\n';
		}
		return content;
	}
	
	
	function getNoteHTML(note) {
		// If HTML tag or entity, parse as HTML
		if (note.match(/(<(p|ul|ol|div|a|br|b|i|u|strong|em( >))|&[a-z]+;|&#[0-9]+;)/)) {
			let doc = domParser.parseFromString('<div>'
				+ note
					// Strip control characters (for notes that were
					// added before item.setNote() started doing this)
					.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
			 + '</div>', "text/html");
			return doc.body.innerHTML + '\n';
		}
		// Otherwise, treat as plain text
		return '<p class="plaintext">' + escapeXML(note) + '</p>\n';
	}
	
	
	var escapeXML = function (str) {
		str = str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '\u2B1A');
		return Zotero.Utilities.htmlSpecialChars(str);
	}
}
