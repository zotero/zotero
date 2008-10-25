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


Zotero.Report = new function() {
	this.generateHTMLDetails = generateHTMLDetails;
	this.generateHTMLList = generateHTMLList;
	
	// Sites that don't need the query string
	// (full URL is kept for link but stripped for display)
	var _noQueryStringSites = [
		/^http:\/\/([^\.]*\.)?nytimes\.com/
	];
	
	
	function generateHTMLDetails(items, combineChildItems) {
		var ZU = new Zotero.Utilities();
		var escapeXML = ZU.htmlSpecialChars;
		
		var content = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" ';
        content += '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n';
		content += '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">\n';
		content += '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\n';
		content += '<title>' + Zotero.getString('report.title.default') + '</title>\n';
		content += '<link rel="stylesheet" type="text/css" href="chrome://zotero/skin/report/detail.css"/>\n';
		content += '<link rel="stylesheet" type="text/css" media="screen,projection" href="chrome://zotero/skin/report/detail_screen.css"/>\n';
		content += '<link rel="stylesheet" type="text/css" media="print" href="chrome://zotero/skin/report/detail_print.css"/>\n';
		content += '</head>\n\n<body>\n';
		
		content += '<ul class="report' + (combineChildItems ? ' combineChildItems' : '') + '">\n';
		for each(var arr in items) {
			content += '\n<li id="i' + arr.itemID + '" class="item ' + arr.itemType + '">\n';
			
			if (arr.title) {
				// Top-level item matched search, so display title
				if (arr.reportSearchMatch) {
					content += '<h2>' + escapeXML(arr.title) + '</h2>\n';
				}
				// Non-matching parent, so display "Parent Item: [Title]"
				else {
					content += '<h2 class="parentItem">' + escapeXML(Zotero.getString('report.parentItem'))
						+ ' <span class="title">' + escapeXML(arr.title) + '</span></h2>';
				}
			}
			
			// If parent matches search, display parent item metadata table and tags
			if (arr.reportSearchMatch) {
				content += _generateMetadataTable(arr);
				
				content += _generateTagsList(arr);
				
				// Independent note
				if (arr['note']) {
					content += '\n';
					if (arr.note.substr(0, 1024).match(/<p[^>]*>/)) {
						content += arr.note + '\n';
					}
					// Wrap plaintext notes in <p>
					else {
						content += '<p class="plaintext">' + arr.note + '</p>\n';
					}
				}
			}
			
			// Children
			if (arr.reportChildren) {
				// Child notes
				if (arr.reportChildren.notes.length) {
					// Only display "Notes:" header if parent matches search
					if (arr.reportSearchMatch) {
						content += '<h3 class="notes">' + escapeXML(Zotero.getString('report.notes')) + '</h3>\n';
					}
					content += '<ul class="notes">\n';
					for each(var note in arr.reportChildren.notes) {
						content += '<li id="i' + note.itemID + '">\n';
						
						if (note.note.substr(0, 1024).match(/<p[^>]*>/)) {
							content += note.note + '\n';
						}
						// Wrap plaintext notes in <p>
						else {
							content += '<p class="plaintext">' + escapeXML(note.note) + '</p>\n';
						}
						
						// Child note tags
						content += _generateTagsList(note);
						
						content += '</li>\n';
					}
					content += '</ul>\n';
				}
			
				// Chid attachments
				content += _generateAttachmentsList(arr.reportChildren);
			}
			
			// Related
			if (arr.reportSearchMatch && arr['seeAlso'] && arr['seeAlso'].length) {
				content += '<h3 class="related">' + escapeXML(Zotero.getString('itemFields.related')) + '</h3>\n';
				content += '<ul class="related">\n';
				var relateds = Zotero.Items.get(arr['seeAlso']);
				for each(var related in relateds) {
					content += '<li id="i' + related.getID() + '">';
					content += escapeXML(related.getField('title'));
					content += '</li>\n';
				}
				content += '</ul>\n';
			}
			
			
			content += '</li>\n\n';
		}
		content += '</ul>\n';
		content += '</body>\n</html>';
		
		return content;
	}
	
	
	function generateHTMLList(items) {
		
	}
	
	
	function _generateMetadataTable(arr) {
		var ZU = new Zotero.Utilities();
		var escapeXML = ZU.htmlSpecialChars;
		
		var table = false;
		var content = '<table>\n';
		
		// Item type
		content += '<tr>\n';
		content += '<th>'
			+ escapeXML(Zotero.getString('itemFields.itemType'))
			+ '</th>\n';
		content += '<td>' + escapeXML(Zotero.getString('itemTypes.' + arr['itemType'])) + '</td>\n';
		content += '</tr>\n';
		
		// Creators
		if (arr['creators']) {
			table = true;
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
				
				content += '<tr>\n';
				content += '<th class="' + creator.creatorType + '">'
					+ escapeXML(Zotero.getString('creatorTypes.' + creator.creatorType))
					+ '</th>\n';
				content += '<td>' + escapeXML(displayText) + '</td>\n';
				content += '</tr>\n';
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
				
				case 'itemType':
				case 'itemID':
				case 'sourceItemID':
				case 'title':
				case 'firstCreator':
				case 'creators':
				case 'tags':
				case 'seeAlso':
				case 'notes':
				case 'note':
				case 'attachments':
					continue;
			}
			
			try {
				var localizedFieldName = Zotero.getString('itemFields.' + i);
			}
			// Skip fields we don't have a localized string for
			catch (e) {
				Zotero.debug('Localized string not available for ' + 'itemFields.' + i, 2);
				continue;
			}
			
			arr[i] = ZU.trim(arr[i] + '');
			
			// Skip empty fields
			if (!arr[i]) {
				continue;
			}
			
			table = true;
			var fieldText;
			
			// Shorten long URLs manually until Firefox wraps at ?
			// (like Safari) or supports the CSS3 word-wrap property
			var firstSpace = arr[i].indexOf(' ');
			if (arr[i].indexOf('http://') === 0 &&
					((firstSpace == -1 && arr[i].length > 29) || firstSpace > 29)) {
				
				var stripped = false;
				
				// Strip query string for sites we know don't need it
				for each(var re in _noQueryStringSites) {
					if (re.test(arr[i])){
						var pos = arr[i].indexOf('?');
						if (pos != -1) {
							fieldText = arr[i].substr(0, pos);
							stripped = true;
						}
						break;
					}
				}
				
				if (!stripped) {
					// Add a line-break after the ? of long URLs
					fieldText = arr[i].replace('?', "?<ZOTEROBREAK/>");
					
					// Strip query string variables from the end while the
					// query string is longer than the main part
					var pos = fieldText.indexOf('?');
					if (pos != -1) {
						while (pos < (fieldText.length / 2)) {
							var lastAmp = fieldText.lastIndexOf('&');
							if (lastAmp == -1) {
								break;
							}
							fieldText = fieldText.substr(0, lastAmp);
							var shortened = true;
						}
						// Append '&...' to the end
						if (shortened) {
							 fieldText += "&<ZOTEROHELLIP/>";
						}
					}
				}
				
				if (i == 'url' && firstSpace == -1) {
					fieldText = '<a href="' + escapeXML(arr[i]) + '">'
						+ escapeXML(fieldText) + '</a>';
				}
			}
			// Remove SQL date from multipart dates
			// (e.g. '2006-00-00 Summer 2006' becomes 'Summer 2006')
			else if (i=='date') {
				fieldText = escapeXML(Zotero.Date.multipartToStr(arr[i]));
			}
			// Convert dates to local format
			else if (i=='accessDate' || i=='dateAdded' || i=='dateModified') {
				var date = Zotero.Date.sqlToDate(arr[i], true)
				fieldText = escapeXML(date.toLocaleString());
			}
			else {
				fieldText = escapeXML(arr[i]);
			}
			
			content += '<tr>\n<th>' + escapeXML(localizedFieldName)
				+ '</th>\n<td>' + fieldText + '</td>\n</tr>\n';
		}
		
		content += '</table>';
		
		return table ? content : '';
	}
	
	
	function _generateTagsList(arr) {
		var ZU = new Zotero.Utilities();
		var escapeXML = ZU.htmlSpecialChars;
		
		var content = '';
		if (arr['tags'] && arr['tags'].length) {
			var str = Zotero.getString('report.tags');
			content += '<h3 class="tags">' + escapeXML(str) + '</h3>\n';
			content += '<ul class="tags">\n';
			for each(var tag in arr.tags) {
				content += '<li>' + escapeXML(tag.fields.name) + '</li>\n';
			}
			content += '</ul>\n';
		}
		return content;
	}
	
	
	function _generateAttachmentsList(arr) {
		var ZU = new Zotero.Utilities();
		var escapeXML = ZU.htmlSpecialChars;
		
		var content = '';
		if (arr.attachments && arr.attachments.length) {
			content += '<h3 class="attachments">' + escapeXML(Zotero.getString('itemFields.attachments')) + '</h3>\n';
			content += '<ul class="attachments">\n';
			for each(var attachment in arr.attachments) {
				content += '<li id="i' + attachment.itemID + '">';
				content += escapeXML(attachment.title);
				
				// Attachment tags
				content += _generateTagsList(attachment);
				
				// Attachment note
				if (attachment.note) {
					content += '<div class="note">';
					if (attachment.note.substr(0, 1024).match(/<p[^>]*>/)) {
						content += attachment.note + '\n';
					}
					// Wrap plaintext notes in <p>
					else {
						content += '<p class="plaintext">' + escapeXML(attachment.note) + '</p>\n';
					}
					content += '</div>';
				}
				
				content += '</li>\n';
			}
			content += '</ul>\n';
		}
		return content;
	}
}
