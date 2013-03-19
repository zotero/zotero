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
    
	
	Based on nsChromeExtensionHandler example code by Ed Anuff at
	http://kb.mozillazine.org/Dev_:_Extending_the_Chrome_Protocol
	
    ***** END LICENSE BLOCK *****
*/

const ZOTERO_SCHEME = "zotero";
const ZOTERO_PROTOCOL_CID = Components.ID("{9BC3D762-9038-486A-9D70-C997AF848A7C}");
const ZOTERO_PROTOCOL_CONTRACTID = "@mozilla.org/network/protocol;1?name=" + ZOTERO_SCHEME;
const ZOTERO_PROTOCOL_NAME = "Zotero Chrome Extension Protocol";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Dummy chrome URL used to obtain a valid chrome channel
// This one was chosen at random and should be able to be substituted
// for any other well known chrome URL in the browser installation
const DUMMY_CHROME_URL = "chrome://mozapps/content/xpinstall/xpinstallConfirm.xul";


function ChromeExtensionHandler() {
	this.wrappedJSObject = this;
	this._systemPrincipal = null;
	this._extensions = {};
	
	
	/*
	 * Report generation extension for Zotero protocol
	 *
	 * Example URLs:
	 *
	 * zotero://report/    -- library
	 * zotero://report/collection/0_ABCD1234
	 * zotero://report/search/0_ABCD1234
	 * zotero://report/items/0_ABCD1234-0_BCDE2345-0_CDEF3456
	 * zotero://report/item/0_ABCD1234
	 *
	 * Optional format can be specified after hashes
	 *
	 *  - 'html', 'rtf', 'csv' ['rtf' and 'csv' not yet supported]
	 *  - defaults to 'html' if not specified
	 *
	 * e.g. zotero://report/collection/0_ABCD1234/rtf
	 * 
	 *
	 * Sorting:
	 *
	 * 	- 'sort' query string variable
	 *  - format is field[/order] [, field[/order], ...]
	 *  - order can be 'asc', 'a', 'desc' or 'd'; defaults to ascending order
	 *
	 *  zotero://report/collection/0_ABCD1234?sort=itemType/d,title
	 *
	 *
	 * Also supports ids (e.g., zotero://report/collection/1234), but ids are not
	 * guaranteed to be consistent across synced machines
	 */
	var ReportExtension = new function(){
		this.newChannel = newChannel;
		
		this.__defineGetter__('loadAsChrome', function () { return false; });
		
		function newChannel(uri){
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
			
			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
			
			generateContent:try {
				var mimeType, content = '';
				
				var [path, queryString] = uri.path.substr(1).split('?');
				var [type, ids, format] = path.split('/');
				
				// Get query string variables
				if (queryString) {
					var queryVars = queryString.split('&');
					for (var i in queryVars) {
						var [key, val] = queryVars[i].split('=');
						switch (key) {
							case 'sort':
								var sortBy = val;
								break;
						}
					}
				}
				
				switch (type){
					case 'collection':
						var lkh = Zotero.Collections.parseLibraryKeyHash(ids);
						if (lkh) {
							var col = Zotero.Collections.getByLibraryAndKey(lkh.libraryID, lkh.key);
						}
						else {
							var col = Zotero.Collections.get(ids);
						}
						if (!col) {
							mimeType = 'text/html';
							content = 'Invalid collection ID or key';
							break generateContent;
						}
						var results = col.getChildItems();
						break;
					
					case 'search':
						var lkh = Zotero.Searches.parseLibraryKeyHash(ids);
						if (lkh) {
							var s = Zotero.Searches.getByLibraryAndKey(lkh.libraryID, lkh.key);
						}
						else {
							var s = Zotero.Searches.get(ids);
						}
						if (!s) {
							mimeType = 'text/html';
							content = 'Invalid search ID or key';
							break generateContent;
						}
						
						// FIXME: Hack to exclude group libraries for now
						var s2 = new Zotero.Search();
						s2.setScope(s);
						var groups = Zotero.Groups.getAll();
						for each(var group in groups) {
							s2.addCondition('libraryID', 'isNot', group.libraryID);
						}
						var ids = s2.search();
						
						var results = Zotero.Items.get(ids);
						break;
					
					case 'items':
					case 'item':
						ids = ids.split('-');
						
						// Keys
						if (Zotero.Items.parseLibraryKeyHash(ids[0])) {
							var results = [];
							for each(var lkh in ids) {
								var lkh = Zotero.Items.parseLibraryKeyHash(lkh);
								var item = Zotero.Items.getByLibraryAndKey(lkh.libraryID, lkh.key);
								if (item) {
									results.push(item);
								}
							}
						}
						// IDs
						else {
							var results = Zotero.Items.get(ids);
						}
						
						if (!results.length) {
							mimeType = 'text/html';
							content = 'Invalid ID';
							break generateContent;
						}
						break;
						
					default:
						// Proxy CSS files
						if (type.match(/^detail.*\.css$/)) {
							var chromeURL = 'chrome://zotero/skin/report/' + type;
							var ios = Components.classes["@mozilla.org/network/io-service;1"]
										.getService(Components.interfaces.nsIIOService);
							var uri = ios.newURI(chromeURL, null, null);
							var chromeReg = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
										.getService(Components.interfaces.nsIChromeRegistry);
							var fileURI = chromeReg.convertChromeURL(uri);
							var ph = Components.classes["@mozilla.org/network/protocol;1?name=file"]
										.createInstance(Components.interfaces.nsIFileProtocolHandler);
							var channel = ioService.newChannelFromURI(fileURI);
							return channel;
						}
						
						// Display all items
						var type = 'library';
						var s = new Zotero.Search();
						s.addCondition('noChildren', 'true');
						var ids = s.search();
						var results = Zotero.Items.get(ids);
				}
				
				var items = [];
				var itemsHash = {}; // key = itemID, val = position in |items|
				var searchItemIDs = {}; // hash of all selected items
				var searchParentIDs = {}; // hash of parents of selected child items
				var searchChildIDs = {}; // hash of selected chlid items
				
				var includeAllChildItems = Zotero.Prefs.get('report.includeAllChildItems');
				var combineChildItems = Zotero.Prefs.get('report.combineChildItems');
				
				var unhandledParents = {};
				for (var i=0; i<results.length; i++) {
					// Don't add child items directly
					// (instead mark their parents for inclusion below)
					var sourceItemID = results[i].getSource();
					if (sourceItemID) {
						searchParentIDs[sourceItemID] = true;
						searchChildIDs[results[i].getID()] = true;
						
						// Don't include all child items if any child
						// items were selected
						includeAllChildItems = false;
					}
					// If combining children or standalone note/attachment, add matching parents
					else if (combineChildItems || !results[i].isRegularItem()
							|| results[i].numChildren() == 0) {
						itemsHash[results[i].getID()] = [items.length];
						items.push(results[i].toArray(2));
						// Flag item as a search match
						items[items.length - 1].reportSearchMatch = true;
					}
					else {
						unhandledParents[i] = true;
					}
					searchItemIDs[results[i].getID()] = true;
				}
				
				// If including all child items, add children of all matched
				// parents to the child array
				if (includeAllChildItems) {
					for (var id in searchItemIDs) {
						if (!searchChildIDs[id]) {
							var children = [];
							var item = Zotero.Items.get(id);
							if (!item.isRegularItem()) {
								continue;
							}
							var func = function (ids) {
								if (ids) {
									for (var i=0; i<ids.length; i++) {
										searchChildIDs[ids[i]] = true;
									}
								}
							};
							func(item.getNotes());
							func(item.getAttachments());
						}
					}
				}
				// If not including all children, add matching parents,
				// in case they don't have any matching children below
				else {
					for (var i in unhandledParents) {
						itemsHash[results[i].id] = [items.length];
						items.push(results[i].toArray(2));
						// Flag item as a search match
						items[items.length - 1].reportSearchMatch = true;
					}
				}
				
				if (combineChildItems) {
					// Add parents of matches if parents aren't matches themselves
					for (var id in searchParentIDs) {
						if (!searchItemIDs[id] && !itemsHash[id]) {
							var item = Zotero.Items.get(id);
							itemsHash[id] = items.length;
							items.push(item.toArray(2));
						}
					}
					
					// Add children to reportChildren property of parents
					for (var id in searchChildIDs) {
						var item = Zotero.Items.get(id);
						var parentItemID = item.getSource();
						if (!items[itemsHash[parentItemID]].reportChildren) {
							items[itemsHash[parentItemID]].reportChildren = {
								notes: [],
								attachments: []
							};
						}
						if (item.isNote()) {
							items[itemsHash[parentItemID]].reportChildren.notes.push(item.toArray());
						}
						if (item.isAttachment()) {
							items[itemsHash[parentItemID]].reportChildren.attachments.push(item.toArray());
						}
					}
				}
				// If not combining children, add a parent/child pair
				// for each matching child
				else {
					for (var id in searchChildIDs) {
						var item = Zotero.Items.get(id);
						var parentID = item.getSource();
						var parentItem = Zotero.Items.get(parentID);
						
						if (!itemsHash[parentID]) {
							// If parent is a search match and not yet added,
							// add on its own
							if (searchItemIDs[parentID]) {
								itemsHash[parentID] = [items.length];
								items.push(parentItem.toArray(2));
								items[items.length - 1].reportSearchMatch = true;
							}
							else {
								itemsHash[parentID] = [];
							}
						}
						
						// Now add parent and child
						itemsHash[parentID].push(items.length);
						items.push(parentItem.toArray(2));
						if (item.isNote()) {
							items[items.length - 1].reportChildren = {
								notes: [item.toArray()],
								attachments: []
							};
						}
						else if (item.isAttachment()) {
							items[items.length - 1].reportChildren = {
								notes: [],
								attachments: [item.toArray()]
							};
						}
					}
				}
				
				
				// Sort items
				if (!sortBy) {
					sortBy = 'title';
				}
				
				var sorts = sortBy.split(',');
				for (var i=0; i<sorts.length; i++) {
					var [field, order] = sorts[i].split('/');
					// Year field is really date field
					if (field == 'year') {
						field = 'date';
					}
					switch (order) {
						case 'd':
						case 'desc':
							order = -1;
							break;
						
						default:
							order = 1;
					}
					
					sorts[i] = {
						field: field,
						order: order
					};
				}
				
				
				var collation = Zotero.getLocaleCollation();
				var compareFunction = function(a, b) {
					var index = 0;
					
					// Multidimensional sort
					do {
						// In combineChildItems, use note or attachment as item
						if (!combineChildItems) {
							if (a.reportChildren) {
								if (a.reportChildren.notes.length) {
									a = a.reportChildren.notes[0];
								}
								else {
									a = a.reportChildren.attachments[0];
								}
							}
							
							if (b.reportChildren) {
								if (b.reportChildren.notes.length) {
									b = b.reportChildren.notes[0];
								}
								else {
									b = b.reportChildren.attachments[0];
								}
							}
						}
						
						var valA, valB;
						
						if (sorts[index].field == 'title') {
							// For notes, use content for 'title'
							if (a.itemType == 'note') {
								valA = a.note;
							}
							else {
								valA = a.title; 
							}
							
							if (b.itemType == 'note') {
								valB = b.note;
							}
							else {
								valB = b.title; 
							}
							
							valA = Zotero.Items.getSortTitle(valA);
							valB = Zotero.Items.getSortTitle(valB);
						}
						else if (sorts[index].field == 'date') {
							var itemA = Zotero.Items.getByLibraryAndKey(a.libraryID, a.key);
							var itemB = Zotero.Items.getByLibraryAndKey(b.libraryID, b.key);
							valA = itemA.getField('date', true, true);
							valB = itemB.getField('date', true, true);
						}
						// TEMP: This is an ugly hack to make creator sorting
						// slightly less broken. To do this right, real creator
						// sorting needs to be abstracted from itemTreeView.js.
						else if (sorts[index].field == 'firstCreator') {
							var itemA = Zotero.Items.getByLibraryAndKey(a.libraryID, a.key);
							var itemB = Zotero.Items.getByLibraryAndKey(b.libraryID, b.key);
							valA = itemA.getField('firstCreator');
							valB = itemB.getField('firstCreator');
						}
						else {
							valA = a[sorts[index].field];
							valB = b[sorts[index].field];
						}
						
						// Put empty values last
						if (!valA && valB) {
							var cmp = 1;
						}
						else if (valA && !valB) {
							var cmp = -1;
						}
						else {
							var cmp = collation.compareString(0, valA, valB);
						}
						
						var result = 0;
						if (cmp != 0) {
							result = cmp * sorts[index].order;
						}
						index++;
					}
					while (result == 0 && sorts[index]);
					
					return result;
				};
				
				items.sort(compareFunction);
				for (var i in items) {
					if (items[i].reportChildren) {
						items[i].reportChildren.notes.sort(compareFunction);
						items[i].reportChildren.attachments.sort(compareFunction);
					}
				}
				
				// Pass off to the appropriate handler
				switch (format){
					case 'rtf':
						mimeType = 'text/rtf';
						break;
						
					case 'csv':
						mimeType = 'text/plain';
						break;
					
					default:
						var content = Zotero.Report.generateHTMLDetails(items, combineChildItems);
						mimeType = 'text/html';
				}
			}
			catch (e){
				Zotero.debug(e);
				throw (e);
			}
			
			var uri_str = 'data:' + (mimeType ? mimeType + ',' : '') + encodeURIComponent(content);
			var ext_uri = ioService.newURI(uri_str, null, null);
			var extChannel = ioService.newChannelFromURI(ext_uri);
			
			return extChannel;
		}
	};

	var TimelineExtension = new function(){
		this.newChannel = newChannel;
		
		this.__defineGetter__('loadAsChrome', function () { return true; });
		
		/*
		queryString key abbreviations:  intervals = i  |  dateType = t  |  timelineDate = d
		
		interval abbreviations:  day = d  |  month = m  |  year = y  |  decade = e  |  century = c  |  millennium = i
		dateType abbreviations:  date = d  |  dateAdded = da  |  dateModified = dm
		timelineDate format:  shortMonthName.day.year  (year is positive for A.D. and negative for B.C.)
		
		
		
		zotero://timeline   -----> creates HTML for timeline 
			(defaults:  type = library | intervals = month, year, decade | timelineDate = today's date | dateType = date)
			
			
		Example URLs:
		
		zotero://timeline/library?i=yec
		zotero://timeline/collection/12345?t=da&d=Jul.24.2008
		zotero://timeline/search/54321?d=Dec.1.-500&i=dmy&t=d
		
		
		
		zotero://timeline/data    ----->creates XML file
			(defaults:  type = library  |  dateType = date)
		
		
		Example URLs:
		
		zotero://timeline/data/library?t=da
		zotero://timeline/data/collection/12345
		zotero://timeline/data/search/54321?t=dm
		
		*/
		function newChannel(uri) {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);

			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;

			generateContent:try {
				var mimeType, content = '';
	
				var [path, queryString] = uri.path.substr(1).split('?');
				var [intervals, timelineDate, dateType] = ['','',''];
				
				if (queryString) {
					var queryVars = queryString.split('&');
					for (var i in queryVars) {
						var [key, val] = queryVars[i].split('=');
						if(val) {
							switch (key) {
								case 'i':
									intervals = val;
									break;
								case 'd':
									timelineDate = val;
									break;
								case 't':
									dateType = val;
									break;
							}
						}
					}
				}
				
				var pathParts = path.split('/');
				if (pathParts[0] != 'data') {
					var [type, id] = pathParts;
				}
				else {
					var [, type, id] = pathParts;
				}
				
				// Get the collection or search object
				var collection, search;
				switch (type) {
					case 'collection':
						var lkh = Zotero.Collections.parseLibraryKeyHash(id);
						if (lkh) {
							collection = Zotero.Collections.getByLibraryAndKey(lkh.libraryID, lkh.key);
						}
						else {
							collection = Zotero.Collections.get(id);
						}
						if (!collection) {
							mimeType = 'text/html';
							content = 'Invalid collection ID or key';
							break generateContent;
						}
						break;
					
					case 'search':
						var lkh = Zotero.Searches.parseLibraryKeyHash(id);
						if (lkh) {
							var s = Zotero.Searches.getByLibraryAndKey(lkh.libraryID, lkh.key);
						}
						else {
							var s = Zotero.Searches.get(id);
						}
						if (!s) {
							mimeType = 'text/html';
							content = 'Invalid search ID or key';
							break generateContent;
						}
						
						// FIXME: Hack to exclude group libraries for now
						var search = new Zotero.Search();
						search.setScope(s);
						var groups = Zotero.Groups.getAll();
						for each(var group in groups) {
							search.addCondition('libraryID', 'isNot', group.libraryID);
						}
						break;
				}
				
				if (pathParts[0] != 'data') {
					//creates HTML file
					content = Zotero.File.getContentsFromURL('chrome://zotero/skin/timeline/timeline.html');
					mimeType = 'text/html';
					
					var [type, id] = pathParts;
					
					if(!timelineDate){
						timelineDate=Date();
						var dateParts=timelineDate.toString().split(' ');
						timelineDate=dateParts[1]+'.'+dateParts[2]+'.'+dateParts[3];
					}
					if (intervals.length < 3) {
						intervals += "mye".substr(intervals.length);
					}
					
					var theIntervals = new Object();
						theIntervals['d'] = 'Timeline.DateTime.DAY';
						theIntervals['m'] = 'Timeline.DateTime.MONTH';
						theIntervals['y'] = 'Timeline.DateTime.YEAR';
						theIntervals['e'] = 'Timeline.DateTime.DECADE';
						theIntervals['c'] = 'Timeline.DateTime.CENTURY';
						theIntervals['i'] = 'Timeline.DateTime.MILLENNIUM';
					
					//sets the intervals of the timeline bands
					var theTemp = '<body onload="onLoad(';
					var a = (theIntervals[intervals[0]]) ? theIntervals[intervals[0]] : 'Timeline.DateTime.MONTH';
					var b = (theIntervals[intervals[1]]) ? theIntervals[intervals[1]] : 'Timeline.DateTime.YEAR';
					var c = (theIntervals[intervals[2]]) ? theIntervals[intervals[2]] : 'Timeline.DateTime.DECADE';
					content = content.replace(theTemp, theTemp + a + ',' + b + ',' + c + ',\'' + timelineDate + '\'');
					
					theTemp = 'document.write("<title>';
					if(type == 'collection') {
						content = content.replace(theTemp, theTemp + collection.name + ' - ');
					}
					else if(type == 'search') {
						content = content.replace(theTemp, theTemp + search.name + ' - ');
					}
					else {
						content = content.replace(theTemp, theTemp + Zotero.getString('pane.collections.library') + ' - ');
					}
					
					theTemp = 'Timeline.loadXML("zotero://timeline/data/';
					var d = '';
					//passes information (type,ids, dateType) for when the XML is created
					if(!type || (type != 'collection' && type != 'search')) {
						d += 'library' + (id ? "/" + id : "");
					}
					else {
						d += type + '/' + id;
					}
					
					if(dateType) {
						d += '?t=' + dateType;
					}
					
					content = content.replace(theTemp, theTemp + d);
					
					
					var uri_str = 'data:' + (mimeType ? mimeType + ',' : '') + encodeURIComponent(content);
					var ext_uri = ioService.newURI(uri_str, null, null);
					var extChannel = ioService.newChannelFromURI(ext_uri);

					return extChannel;
				}
				// Create XML file
				else {
					switch (type) {
						case 'collection':
							var results = collection.getChildItems();
							break;
						
						case 'search':
							var ids = search.search();
							var results = Zotero.Items.get(ids);
							break;
						
						default:
							type = 'library';
							var s = new Zotero.Search();
							s.addCondition('libraryID', 'is', id ? id : null);
							s.addCondition('noChildren', 'true');
							var ids = s.search();
							var results = Zotero.Items.get(ids);
					}

					var items = [];
					// Only include parent items
					for (var i = 0; i < results.length; i++) {
						if (!results[i].getSource()) {
							items.push(results[i]);
						}
					}
					
					if (!items) {
						mimeType = 'text/html';
						content = 'Invalid ID';
						break generateContent;
					}
					
					mimeType = 'application/xml';
					
					var theDateTypes = new Object();
						theDateTypes['d'] = 'date';
						theDateTypes['da'] = 'dateAdded';
						theDateTypes['dm'] = 'dateModified';
					
					//default dateType = date
					if (!dateType || !theDateTypes[dateType]) {
						dateType = 'd';
					}
					
					content = Zotero.Timeline.generateXMLDetails(items, theDateTypes[dateType]);
				}
				
				var uri_str = 'data:' + (mimeType ? mimeType + ',' : '') + encodeURIComponent(content);
				var ext_uri = ioService.newURI(uri_str, null, null);
				var extChannel = ioService.newChannelFromURI(ext_uri);
				
				return extChannel;
			}
			catch (e){
				Zotero.debug(e);
				throw (e);
			}
		}
	};
	
	
	/*
		zotero://attachment/[id]/
	*/
	var AttachmentExtension = new function() {
		this.newChannel = newChannel;
		
		this.__defineGetter__('loadAsChrome', function () { return false; });
		
		function newChannel(uri) {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
			
			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
			
			try {
				var errorMsg;
				var [id, fileName] = uri.path.substr(1).split('/');
				
				if (parseInt(id) != id) {
					// Proxy annotation icons
					if (id.match(/^annotation.*\.(png|html|css|gif)$/)) {
						var chromeURL = 'chrome://zotero/skin/' + id;
						var ios = Components.classes["@mozilla.org/network/io-service;1"].
									getService(Components.interfaces.nsIIOService);
						var uri = ios.newURI(chromeURL, null, null);
						var chromeReg = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
								.getService(Components.interfaces.nsIChromeRegistry);
						var fileURI = chromeReg.convertChromeURL(uri);
					}
					else {
						return _errorChannel("Attachment id not an integer");
					}
				}
				
				if (!fileURI) {
					var item = Zotero.Items.get(id);
					if (!item) {
						return _errorChannel("Item not found");
					}
					var file = item.getFile();
					if (!file) {
						return _errorChannel("File not found");
					}
					if (fileName) {
						file = file.parent;
						file.append(fileName);
						if (!file.exists()) {
							return _errorChannel("File not found");
						}
					}
				}
				
				var ph = Components.classes["@mozilla.org/network/protocol;1?name=file"].
						createInstance(Components.interfaces.nsIFileProtocolHandler);
				if (!fileURI) {
					var fileURI = ph.newFileURI(file);
				}
				var channel = ioService.newChannelFromURI(fileURI);
				//set originalURI so that it seems like we're serving from zotero:// protocol
				//this is necessary to allow url() links to work from within css files
				//otherwise they try to link to files on the file:// protocol, which is not allowed
				channel.originalURI = uri;

				return channel;
			}
			catch (e) {
				Zotero.debug(e);
				throw (e);
			}
		}
		
		
		function _errorChannel(msg) {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
			var uriStr = 'data:text/plain,' + encodeURIComponent(msg);
			var dataURI = ioService.newURI(uriStr, null, null);
			var channel = ioService.newChannelFromURI(dataURI);
			return channel;
		}
	};
	
	
	/**
	 * zotero://select/[type]/0_ABCD1234
	 * zotero://select/[type]/1234 (not consistent across synced machines)
	 */
	var SelectExtension = new function(){
		this.newChannel = newChannel;
		
		function newChannel(uri) {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);

			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;

			generateContent:try {
				var mimeType, content = '';
				
				var [path, queryString] = uri.path.substr(1).split('?');
				var [type, id] = path.split('/');
				
				// currently only able to select one item
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
				var win = wm.getMostRecentWindow("navigator:browser");
				
				// restore window if it's in the dock
				if(win.windowState == Components.interfaces.nsIDOMChromeWindow.STATE_MINIMIZED) {
					win.restore();
				}
				
				// open Zotero pane
				win.ZoteroPane.show();
				
				if(!id) return;
				
				var lkh = Zotero.Items.parseLibraryKeyHash(id);
				if (lkh) {
					var item = Zotero.Items.getByLibraryAndKey(lkh.libraryID, lkh.key);
				}
				else {
					var item = Zotero.Items.get(id);
				}
				if (!item) {
					var msg = "Item " + id + " not found in zotero://select";
					Zotero.debug(msg, 2);
					Components.utils.reportError(msg);
					return;
				}
				
				win.ZoteroPane.selectItem(item.id);
			}
			catch (e){
				Zotero.debug(e);
				throw (e);
			}
		}
	};
	
	/*
		zotero://fullscreen
	*/
	var FullscreenExtension = new function() {
		this.newChannel = newChannel;
		
		this.__defineGetter__('loadAsChrome', function () { return false; });
		
		function newChannel(uri) {
			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
				
			generateContent: try {
				var window = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
					.getService(Components.interfaces.nsIWindowWatcher)
					.openWindow(null, 'chrome://zotero/content/standalone/standalone.xul', '',
						'chrome,centerscreen,resizable', null);
			}
			catch (e) {
				Zotero.debug(e);
				throw (e);
			}
		}
	};
	
	
	/*
		zotero://debug/
	*/
	var DebugExtension = new function() {
		this.newChannel = newChannel;
		
		this.__defineGetter__('loadAsChrome', function () { return false; });
		
		function newChannel(uri) {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
			
			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
			
			try {
				var output = Zotero.Debug.get();
				
				var uriStr = 'data:text/plain,' + encodeURIComponent(output);
				var extURI = ioService.newURI(uriStr, null, null);
				return ioService.newChannelFromURI(extURI);
			}
			catch (e) {
				Zotero.debug(e);
				throw (e);
			}
		}
	};
	
	var ConnectorChannel = function(uri, data) {
		var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
			.getService(Components.interfaces.nsIScriptSecurityManager);
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		
		this.name = uri;
		this.URI = ioService.newURI(uri, "UTF-8", null);
		this.owner = (secMan.getCodebasePrincipal || secMan.getSimpleCodebasePrincipal)(this.URI);
		this._isPending = true;
		
		var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
			createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		converter.charset = "UTF-8";
		this._stream = converter.convertToInputStream(data);
		this.contentLength = this._stream.available();
	}
	
	ConnectorChannel.prototype.contentCharset = "UTF-8";
	ConnectorChannel.prototype.contentType = "text/html";
	ConnectorChannel.prototype.notificationCallbacks = null;
	ConnectorChannel.prototype.securityInfo = null;
	ConnectorChannel.prototype.status = 0;
	ConnectorChannel.prototype.loadGroup = null;
	ConnectorChannel.prototype.loadFlags = 393216;
	
	ConnectorChannel.prototype.__defineGetter__("originalURI", function() { return this.URI });
	ConnectorChannel.prototype.__defineSetter__("originalURI", function() { });
	
	ConnectorChannel.prototype.asyncOpen = function(streamListener, context) {
		if(this.loadGroup) this.loadGroup.addRequest(this, null);
		streamListener.onStartRequest(this, context);
		streamListener.onDataAvailable(this, context, this._stream, 0, this.contentLength);
		streamListener.onStopRequest(this, context, this.status);
		this._isPending = false;
		if(this.loadGroup) this.loadGroup.removeRequest(this, null, 0);
	}
	
	ConnectorChannel.prototype.isPending = function() {
		return this._isPending;
	}
	
	ConnectorChannel.prototype.cancel = function(status) {
		this.status = status;
		this._isPending = false;
		if(this._stream) this._stream.close();
	}
	
	ConnectorChannel.prototype.suspend = function() {}
	
	ConnectorChannel.prototype.resume = function() {}
	
	ConnectorChannel.prototype.open = function() {
		return this._stream;
	}
	
	ConnectorChannel.prototype.QueryInterface = function(iid) {
		if (!iid.equals(Components.interfaces.nsIChannel) && !iid.equals(Components.interfaces.nsIRequest) &&
				!iid.equals(Components.interfaces.nsISupports)) {
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		return this;
	}
	
	/**
	 * zotero://connector/
	 *
	 * URI spoofing for transferring page data across boundaries
	 */
	var ConnectorExtension = new function() {
		this.loadAsChrome = false;
		
		this.newChannel = function(uri) {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
			var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
				.getService(Components.interfaces.nsIScriptSecurityManager);
			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
			
			try {
				var originalURI = uri.path;
				originalURI = decodeURIComponent(originalURI.substr(originalURI.indexOf("/")+1));
				if(!Zotero.Server.Connector.Data[originalURI]) {
					return null;
				} else {
					return new ConnectorChannel(originalURI, Zotero.Server.Connector.Data[originalURI]);
				}
			} catch(e) {
				Zotero.debug(e);
				throw e;
			}
		}
	};
	
	var ReportExtensionSpec = ZOTERO_SCHEME + "://report"
	this._extensions[ReportExtensionSpec] = ReportExtension;
	
	var TimelineExtensionSpec = ZOTERO_SCHEME + "://timeline"
	this._extensions[TimelineExtensionSpec] = TimelineExtension;
	
	var AttachmentExtensionSpec = ZOTERO_SCHEME + "://attachment"
	this._extensions[AttachmentExtensionSpec] = AttachmentExtension;
	
	var SelectExtensionSpec = ZOTERO_SCHEME + "://select"
	this._extensions[SelectExtensionSpec] = SelectExtension;
	
	var FullscreenExtensionSpec = ZOTERO_SCHEME + "://fullscreen"
	this._extensions[FullscreenExtensionSpec] = FullscreenExtension;
	
	var DebugExtensionSpec = ZOTERO_SCHEME + "://debug"
	this._extensions[DebugExtensionSpec] = DebugExtension;
	
	var ConnectorExtensionSpec = ZOTERO_SCHEME + "://connector"
	this._extensions[ConnectorExtensionSpec] = ConnectorExtension;
}


/*
 * Implements nsIProtocolHandler
 */
ChromeExtensionHandler.prototype = {
	scheme: ZOTERO_SCHEME,
	
	defaultPort : -1,
	
	protocolFlags :
		Components.interfaces.nsIProtocolHandler.URI_NORELATIVE |
		Components.interfaces.nsIProtocolHandler.URI_NOAUTH |
		// DEBUG: This should be URI_IS_LOCAL_FILE, and MUST be if any
		// extensions that modify data are added
		//  - https://www.zotero.org/trac/ticket/1156
		//
		Components.interfaces.nsIProtocolHandler.URI_IS_LOCAL_FILE,
		//Components.interfaces.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,
		
	allowPort : function(port, scheme) {
		return false;
	},
	
	newURI : function(spec, charset, baseURI) {
		var newURL = Components.classes["@mozilla.org/network/standard-url;1"]
			.createInstance(Components.interfaces.nsIStandardURL);
		newURL.init(1, -1, spec, charset, baseURI);
		return newURL.QueryInterface(Components.interfaces.nsIURI);
	},
	
	newChannel : function(uri) {
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		
		var chromeService = Components.classes["@mozilla.org/network/protocol;1?name=chrome"]
			.getService(Components.interfaces.nsIProtocolHandler);
		
		var newChannel = null;
		
		try {
			var uriString = uri.spec.toLowerCase();
			
			for (var extSpec in this._extensions) {
				var ext = this._extensions[extSpec];
				
				if (uriString.indexOf(extSpec) == 0) {
					if (ext.loadAsChrome && this._systemPrincipal == null) {
						var chromeURI = chromeService.newURI(DUMMY_CHROME_URL, null, null);
						var chromeChannel = chromeService.newChannel(chromeURI);
						
						// Cache System Principal from chrome request
						// so proxied pages load with chrome privileges
						this._systemPrincipal = chromeChannel.owner;
						
						var chromeRequest = chromeChannel.QueryInterface(Components.interfaces.nsIRequest);
						chromeRequest.cancel(0x804b0002); // BINDING_ABORTED
					}
					
					var extChannel = ext.newChannel(uri);
					// Extension returned null, so cancel request
					if (!extChannel) {
						var chromeURI = chromeService.newURI(DUMMY_CHROME_URL, null, null);
						var extChannel = chromeService.newChannel(chromeURI);
						var chromeRequest = extChannel.QueryInterface(Components.interfaces.nsIRequest);
						chromeRequest.cancel(0x804b0002); // BINDING_ABORTED
					}
					
					// Apply cached system principal to extension channel
					if (ext.loadAsChrome) {
						extChannel.owner = this._systemPrincipal;
					}
					
					if(!extChannel.originalURI) extChannel.originalURI = uri;
					
					return extChannel;
				}
			}
			
			// pass request through to ChromeProtocolHandler::newChannel
			if (uriString.indexOf("chrome") != 0) {
				uriString = uri.spec;
				uriString = "chrome" + uriString.substring(uriString.indexOf(":"));
				uri = chromeService.newURI(uriString, null, null);
			}
			
			newChannel = chromeService.newChannel(uri);
		}
		catch (e) {
			throw Components.results.NS_ERROR_FAILURE;
		}
		
		return newChannel;
	},
	
	contractID: ZOTERO_PROTOCOL_CONTRACTID,
	classDescription: ZOTERO_PROTOCOL_NAME,
	classID: ZOTERO_PROTOCOL_CID,
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports,
	                                       Components.interfaces.nsIProtocolHandler])
};

//
// XPCOM goop
//

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([ChromeExtensionHandler]);
} else {
	var NSGetModule = XPCOMUtils.generateNSGetModule([ChromeExtensionHandler]);
}