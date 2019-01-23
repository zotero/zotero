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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const ios = Services.io;

// Dummy chrome URL used to obtain a valid chrome channel
const DUMMY_CHROME_URL = "chrome://zotero/content/zoteroPane.xul";

var Zotero = Components.classes["@zotero.org/Zotero;1"]
	.getService(Components.interfaces.nsISupports)
	.wrappedJSObject;

function ZoteroProtocolHandler() {
	this.wrappedJSObject = this;
	this._principal = null;
	this._extensions = {};
	
	
	/**
	 * zotero://data/library/collection/ABCD1234/items?sort=itemType&direction=desc
	 * zotero://data/groups/12345/collection/ABCD1234/items?sort=title&direction=asc
	 */
	var DataExtension = {
		loadAsChrome: false,
		
		newChannel: function (uri) {
			return new AsyncChannel(uri, function* () {
				this.contentType = 'text/plain';
				
				path = uri.spec.match(/zotero:\/\/[^/]+(.*)/)[1];
				
				try {
					return Zotero.Utilities.Internal.getAsyncInputStream(
						Zotero.API.Data.getGenerator(path)
					);
				}
				catch (e) {
					if (e instanceof Zotero.Router.InvalidPathException) {
						return "URL could not be parsed";	
					}
				}
			});
		}
	};
	
	
	/*
	 * Report generation extension for Zotero protocol
	 */
	var ReportExtension = {
		loadAsChrome: false,
		
		newChannel: function (uri) {
			return new AsyncChannel(uri, function* () {
				var userLibraryID = Zotero.Libraries.userLibraryID;
				
				var path = uri.pathQueryRef;
				if (!path) {
					return 'Invalid URL';
				}
				path = path.substr('//report/'.length);
				
				// Proxy CSS files
				if (path.endsWith('.css')) {
					var chromeURL = 'chrome://zotero/skin/report/' + path;
					Zotero.debug(chromeURL);
					let uri = ios.newURI(chromeURL, null, null);
					var chromeReg = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
						.getService(Components.interfaces.nsIChromeRegistry);
					return chromeReg.convertChromeURL(uri);
				}
				
				var params = {
					objectType: 'item',
					format: 'html',
					sort: 'title'
				};
				var router = new Zotero.Router(params);
				
				// Items within a collection or search
				router.add('library/:scopeObject/:scopeObjectKey/items', function () {
					params.libraryID = userLibraryID;
				});
				router.add('groups/:groupID/:scopeObject/:scopeObjectKey/items');
				
				// All items
				router.add('library/items/:objectKey', function () {
					params.libraryID = userLibraryID;
				});
				router.add('groups/:groupID/items');
				
				// Old-style URLs
				router.add('collection/:id/html/report.html', function () {
					params.scopeObject = 'collections';
					var lkh = Zotero.Collections.parseLibraryKeyHash(params.id);
					if (lkh) {
						params.libraryID = lkh.libraryID || userLibraryID;
						params.scopeObjectKey = lkh.key;
					}
					else {
						params.scopeObjectID = params.id;
					}
					delete params.id;
				});
				router.add('search/:id/html/report.html', function () {
					params.scopeObject = 'searches';
					var lkh = Zotero.Searches.parseLibraryKeyHash(this.id);
					if (lkh) {
						params.libraryID = lkh.libraryID || userLibraryID;
						params.scopeObjectKey = lkh.key;
					}
					else {
						params.scopeObjectID = this.id;
					}
					delete params.id;
				});
				router.add('items/:ids/html/report.html', function () {
					var ids = this.ids.split('-');
					params.libraryID = ids[0].split('_')[0] || userLibraryID;
					params.itemKey = ids.map(x => x.split('_')[1]);
					delete params.ids;
				});
				
				var parsed = router.run(path);
				if (!parsed) {
					return "URL could not be parsed";
				}
				
				// TODO: support old URLs
				// collection
				// search
				// items
				// item
				if (params.sort.indexOf('/') != -1) {
					let parts = params.sort.split('/');
					params.sort = parts[0];
					params.direction = parts[1] == 'd' ? 'desc' : 'asc';
				}
				
				try {
					Zotero.API.parseParams(params);
					var results = yield Zotero.API.getResultsFromParams(params);
				}
				catch (e) {
					Zotero.debug(e, 1);
					return e.toString();
				}
				
				var mimeType, content = '';
				var items = [];
				var itemsHash = {}; // key = itemID, val = position in |items|
				var searchItemIDs = new Set(); // All selected items
				var searchParentIDs = new Set(); // Parents of selected child items
				var searchChildIDs = new Set() // Selected chlid items
				
				var includeAllChildItems = Zotero.Prefs.get('report.includeAllChildItems');
				var combineChildItems = Zotero.Prefs.get('report.combineChildItems');
				
				var unhandledParents = {};
				for (var i=0; i<results.length; i++) {
					// Don't add child items directly
					// (instead mark their parents for inclusion below)
					var parentItemID = results[i].parentItemID;
					if (parentItemID) {
						searchParentIDs.add(parentItemID);
						searchChildIDs.add(results[i].id);
						
						// Don't include all child items if any child
						// items were selected
						includeAllChildItems = false;
					}
					// If combining children or standalone note/attachment, add matching parents
					else if (combineChildItems || !results[i].isRegularItem()
							|| results[i].numChildren() == 0) {
						itemsHash[results[i].id] = [items.length];
						items.push(results[i].toJSON({ mode: 'full' }));
						// Flag item as a search match
						items[items.length - 1].reportSearchMatch = true;
					}
					else {
						unhandledParents[i] = true;
					}
					searchItemIDs.add(results[i].id);
				}
				
				// If including all child items, add children of all matched
				// parents to the child array
				if (includeAllChildItems) {
					for (let id of searchItemIDs) {
						if (!searchChildIDs.has(id)) {
							var children = [];
							var item = yield Zotero.Items.getAsync(id);
							if (!item.isRegularItem()) {
								continue;
							}
							var func = function (ids) {
								if (ids) {
									for (var i=0; i<ids.length; i++) {
										searchChildIDs.add(ids[i]);
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
						items.push(results[i].toJSON({ mode: 'full' }));
						// Flag item as a search match
						items[items.length - 1].reportSearchMatch = true;
					}
				}
				
				if (combineChildItems) {
					// Add parents of matches if parents aren't matches themselves
					for (let id of searchParentIDs) {
						if (!searchItemIDs.has(id) && !itemsHash[id]) {
							var item = yield Zotero.Items.getAsync(id);
							itemsHash[id] = items.length;
							items.push(item.toJSON({ mode: 'full' }));
						}
					}
					
					// Add children to reportChildren property of parents
					for (let id of searchChildIDs) {
						let item = yield Zotero.Items.getAsync(id);
						var parentID = item.parentID;
						if (!items[itemsHash[parentID]].reportChildren) {
							items[itemsHash[parentID]].reportChildren = {
								notes: [],
								attachments: []
							};
						}
						if (item.isNote()) {
							items[itemsHash[parentID]].reportChildren.notes.push(item.toJSON({ mode: 'full' }));
						}
						if (item.isAttachment()) {
							items[itemsHash[parentID]].reportChildren.attachments.push(item.toJSON({ mode: 'full' }));
						}
					}
				}
				// If not combining children, add a parent/child pair
				// for each matching child
				else {
					for (let id of searchChildIDs) {
						var item = yield Zotero.Items.getAsync(id);
						var parentID = item.parentID;
						var parentItem = Zotero.Items.get(parentID);
						
						if (!itemsHash[parentID]) {
							// If parent is a search match and not yet added,
							// add on its own
							if (searchItemIDs.has(parentID)) {
								itemsHash[parentID] = [items.length];
								items.push(parentItem.toJSON({ mode: 'full' }));
								items[items.length - 1].reportSearchMatch = true;
							}
							else {
								itemsHash[parentID] = [];
							}
						}
						
						// Now add parent and child
						itemsHash[parentID].push(items.length);
						items.push(parentItem.toJSON({ mode: 'full' }));
						if (item.isNote()) {
							items[items.length - 1].reportChildren = {
								notes: [item.toJSON({ mode: 'full' })],
								attachments: []
							};
						}
						else if (item.isAttachment()) {
							items[items.length - 1].reportChildren = {
								notes: [],
								attachments: [item.toJSON({ mode: 'full' })]
							};
						}
					}
				}
				
				// Sort items
				// TODO: restore multiple sort fields
				var sorts = [{
					field: params.sort,
					order: params.direction != 'desc' ? 1 : -1
				}];
				
				
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
							var itemA = Zotero.Items.getByLibraryAndKey(params.libraryID, a.key);
							var itemB = Zotero.Items.getByLibraryAndKey(params.libraryID, b.key);
							valA = itemA.getField('date', true, true);
							valB = itemB.getField('date', true, true);
						}
						// TEMP: This is an ugly hack to make creator sorting
						// slightly less broken. To do this right, real creator
						// sorting needs to be abstracted from itemTreeView.js.
						else if (sorts[index].field == 'firstCreator') {
							var itemA = Zotero.Items.getByLibraryAndKey(params.libraryID, a.key);
							var itemB = Zotero.Items.getByLibraryAndKey(params.libraryID, b.key);
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
				switch (params.format) {
					case 'rtf':
						this.contentType = 'text/rtf';
						return '';
						
					case 'csv':
						this.contentType = 'text/plain';
						return '';
					
					default:
						this.contentType = 'text/html';
						return Zotero.Utilities.Internal.getAsyncInputStream(
							Zotero.Report.HTML.listGenerator(items, combineChildItems),
							function () {
								Zotero.logError(e);
								return '<span style="color: red; font-weight: bold">Error generating report</span>';
							}
						);
				}
			});
		}
	};
	
	/**
	 * Generate MIT SIMILE Timeline
	 *
	 * Query string key abbreviations: intervals = i
	 *                                 dateType = t
	 *                                 timelineDate = d
	 * 
	 * interval abbreviations:  day = d  |  month = m  |  year = y  |  decade = e  |  century = c  |  millennium = i
	 * dateType abbreviations:  date = d  |  dateAdded = da  |  dateModified = dm
	 * timelineDate format:  shortMonthName.day.year  (year is positive for A.D. and negative for B.C.)
	 * 
	 * Defaults: intervals = month, year, decade
	 *           dateType = date
	 *           timelineDate = today's date
	 */
	var TimelineExtension = {
		loadAsChrome: true,
		
		newChannel: function (uri) {
			return new AsyncChannel(uri, function* () {
				var userLibraryID = Zotero.Libraries.userLibraryID;
				
				var path = uri.spec.match(/zotero:\/\/[^/]+(.*)/)[1];
				if (!path) {
					this.contentType = 'text/html';
					return 'Invalid URL';
				}
				
				var params = {};
				var router = new Zotero.Router(params);
				
				// HTML
				router.add('library/:scopeObject/:scopeObjectKey', function () {
					params.libraryID = userLibraryID;
					params.controller = 'html';
				});
				router.add('groups/:groupID/:scopeObject/:scopeObjectKey', function () {
					params.controller = 'html';
				});
				router.add('library', function () {
					params.libraryID = userLibraryID;
					params.controller = 'html';
				});
				router.add('groups/:groupID', function () {
					params.controller = 'html';
				});
				
				// Data
				router.add('data/library/:scopeObject/:scopeObjectKey', function () {
					params.libraryID = userLibraryID;
					params.controller = 'data';
				});
				router.add('data/groups/:groupID/:scopeObject/:scopeObjectKey', function () {
					params.controller = 'data';
				});
				router.add('data/library', function () {
					params.libraryID = userLibraryID;
					params.controller = 'data';
				});
				router.add('data/groups/:groupID', function () {
					params.controller = 'data';
				});
				
				// Old-style HTML URLs
				router.add('collection/:id', function () {
					params.controller = 'html';
					params.scopeObject = 'collections';
					var lkh = Zotero.Collections.parseLibraryKeyHash(params.id);
					if (lkh) {
						params.libraryID = lkh.libraryID || userLibraryID;
						params.scopeObjectKey = lkh.key;
					}
					else {
						params.scopeObjectID = params.id;
					}
					delete params.id;
				});
				router.add('search/:id', function () {
					params.controller = 'html';
					params.scopeObject = 'searches';
					var lkh = Zotero.Searches.parseLibraryKeyHash(params.id);
					if (lkh) {
						params.libraryID = lkh.libraryID || userLibraryID;
						params.scopeObjectKey = lkh.key;
					}
					else {
						params.scopeObjectID = params.id;
					}
					delete params.id;
				});
				router.add('/', function () {
					params.controller = 'html';
					params.libraryID = userLibraryID;
				});
				
				var parsed = router.run(path);
				if (!parsed) {
					this.contentType = 'text/html';
					return "URL could not be parsed";
				}
				if (params.groupID) {
					params.libraryID = Zotero.Groups.getLibraryIDFromGroupID(params.groupID);
				}
				
				var intervals = params.i ? params.i : '';
				var timelineDate = params.d ? params.d : '';
				var dateType = params.t ? params.t : '';
				
				// Get the collection or search object
				var collection, search;
				switch (params.scopeObject) {
					case 'collections':
						if (params.scopeObjectKey) {
							collection = yield Zotero.Collections.getByLibraryAndKeyAsync(
								params.libraryID, params.scopeObjectKey
							);
						}
						else {
							collection = yield Zotero.Collections.getAsync(params.scopeObjectID);
						}
						if (!collection) {
							this.contentType = 'text/html';
							return 'Invalid collection ID or key';
						}
						break;
					
					case 'searches':
						if (params.scopeObjectKey) {
							var s = yield Zotero.Searches.getByLibraryAndKeyAsync(
								params.libraryID, params.scopeObjectKey
							);
						}
						else {
							var s = yield Zotero.Searches.getAsync(params.scopeObjectID);
						}
						if (!s) {
							return 'Invalid search ID or key';
						}
						
						// FIXME: Hack to exclude group libraries for now
						var search = new Zotero.Search();
						search.setScope(s);
						var groups = Zotero.Groups.getAll();
						for (let group of groups) {
							search.addCondition('libraryID', 'isNot', group.libraryID);
						}
						break;
				}
				
				//
				// Create XML file
				//
				if (params.controller == 'data') {
					switch (params.scopeObject) {
						case 'collections':
							var results = collection.getChildItems();
							break;
						
						case 'searches':
							var ids = yield search.search();
							var results = yield Zotero.Items.getAsync(ids);
							break;
						
						default:
							if (params.scopeObject) {
								return "Invalid scope object '" + params.scopeObject + "'";
							}
							
							let s = new Zotero.Search();
							s.addCondition('libraryID', 'is', params.libraryID);
							s.addCondition('noChildren', 'true');
							var ids = yield s.search();
							var results = yield Zotero.Items.getAsync(ids);
					}
					
					var items = [];
					// Only include parent items
					for (let i=0; i<results.length; i++) {
						if (!results[i].parentItemID) {
							items.push(results[i]);
						}
					}
					
					var dateTypes = {
						d: 'date',
						da: 'dateAdded',
						dm: 'dateModified'
					};
					
					//default dateType = date
					if (!dateType || !dateTypes[dateType]) {
						dateType = 'd';
					}
					
					this.contentType = 'application/xml';
					return Zotero.Utilities.Internal.getAsyncInputStream(
						Zotero.Timeline.generateXMLDetails(items, dateTypes[dateType])
					);
				}
				
				//
				// Generate main HTML page
				//
				var content = Zotero.File.getContentsFromURL('chrome://zotero/skin/timeline/timeline.html');
				this.contentType = 'text/html';
				
				if(!timelineDate){
					timelineDate=Date();
					var dateParts=timelineDate.toString().split(' ');
					timelineDate=dateParts[1]+'.'+dateParts[2]+'.'+dateParts[3];
				}
				if (!intervals || intervals.length < 3) {
					intervals += "mye".substr(intervals.length);
				}
				
				var theIntervals = {
					d: 'Timeline.DateTime.DAY',
					m: 'Timeline.DateTime.MONTH',
					y: 'Timeline.DateTime.YEAR',
					e: 'Timeline.DateTime.DECADE',
					c: 'Timeline.DateTime.CENTURY',
					i: 'Timeline.DateTime.MILLENNIUM'
				};
				
				//sets the intervals of the timeline bands
				var tempStr = '<body onload="onLoad(';
				var a = (theIntervals[intervals[0]]) ? theIntervals[intervals[0]] : 'Timeline.DateTime.MONTH';
				var b = (theIntervals[intervals[1]]) ? theIntervals[intervals[1]] : 'Timeline.DateTime.YEAR';
				var c = (theIntervals[intervals[2]]) ? theIntervals[intervals[2]] : 'Timeline.DateTime.DECADE';
				content = content.replace(tempStr, tempStr + a + ',' + b + ',' + c + ',\'' + timelineDate + '\'');
				
				tempStr = 'document.write("<title>';
				if (params.scopeObject == 'collections') {
					content = content.replace(tempStr, tempStr + collection.name + ' - ');
				}
				else if (params.scopeObject == 'searches') {
					content = content.replace(tempStr, tempStr + search.name + ' - ');
				}
				else {
					content = content.replace(tempStr, tempStr + Zotero.getString('pane.collections.library') + ' - ');
				}
				
				tempStr = 'Timeline.loadXML("zotero://timeline/data/';
				var d = '';
				if (params.groupID) {
					d += 'groups/' + params.groupID + '/';
				}
				else {
					d += 'library/';
				}
				if (params.scopeObject) {
					d += params.scopeObject + "/" + params.scopeObjectKey;
				}
				if (dateType) {
					d += '?t=' + dateType;
				}
				return content.replace(tempStr, tempStr + d);
			});
		}
	};
	
	
	/**
	 * zotero://select/[type]/0_ABCD1234
	 * zotero://select/[type]/1234 (not consistent across synced machines)
	 */
	var SelectExtension = {
		noContent: true,
		
		doAction: Zotero.Promise.coroutine(function* (uri) {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			
			var path = uri.pathQueryRef;
			if (!path) {
				return 'Invalid URL';
			}
			path = path.substr('//select/'.length);
			var mimeType, content = '';
			
			var params = {
				objectType: 'item'
			};
			var router = new Zotero.Router(params);
			
			// Item within a collection or search
			router.add('library/:scopeObject/:scopeObjectKey/items/:objectKey', function () {
				params.libraryID = userLibraryID;
			});
			router.add('groups/:groupID/:scopeObject/:scopeObjectKey/items/:objectKey');
			
			// All items
			router.add('library/items/:objectKey', function () {
				params.libraryID = userLibraryID;
			});
			router.add('groups/:groupID/items/:objectKey');
			
			// Old-style URLs
			router.add('items/:id', function () {
				var lkh = Zotero.Items.parseLibraryKeyHash(params.id);
				if (lkh) {
					params.libraryID = lkh.libraryID || userLibraryID;
					params.objectKey = lkh.key;
				}
				else {
					params.objectID = params.id;
				}
				delete params.id;
			});
			
			// Collection
			router.add('library/collections/:objectKey', function () {
				params.objectType = 'collection'
				params.libraryID = userLibraryID;
			});
			router.add('groups/:groupID/collections/:objectKey', function () {
				params.objectType = 'collection'
			});
			// Search
			router.add('library/searches/:objectKey', function () {
				params.objectType = 'search'
				params.libraryID = userLibraryID;
			});
			router.add('groups/:groupID/searches/:objectKey', function () {
				params.objectType = 'search'
			});
			
			router.run(path);
			
			Zotero.API.parseParams(params);
			
			if (!params.objectKey && !params.objectID && !params.itemKey) {
				Zotero.debug("No objects specified");
				return;
			}
			
			var results = yield Zotero.API.getResultsFromParams(params);
			
			if (!results.length) {
				var msg = "Objects not found";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg);
				return;
			}
			
			var zp = Zotero.getActiveZoteroPane();
			if (!zp) {
				// TEMP
				throw new Error("Pane not open");
			}
			
			if (params.objectType == 'collection') {
				return zp.collectionsView.selectCollection(results[0].id);
			}
			else if (params.objectType == 'search') {
				return zp.collectionsView.selectSearch(results[0].id);
			}
			else {
				// Select collection first if specified
				if (params.scopeObject == 'collections') {
					let col;
					if (params.scopeObjectKey) {
						col = Zotero.Collections.getByLibraryAndKey(
							params.libraryID, params.scopeObjectKey
						);
					}
					else {
						col = Zotero.Collections.get(params.scopeObjectID);
					}
					yield zp.collectionsView.selectCollection(col.id);
				}
				else if (params.scopeObject == 'searches') {
					let s;
					if (params.scopeObjectKey) {
						s = Zotero.Searches.getByLibraryAndKey(
							params.libraryID, params.scopeObjectKey
						);
					}
					else {
						s = Zotero.Searches.get(params.scopeObjectID);
					}
					yield zp.collectionsView.selectSearch(s.id);
				}
				// If collection not specified, select library root
				else {
					yield zp.collectionsView.selectLibrary(params.libraryID);
				}
				return zp.selectItems(results.map(x => x.id));
			}
		}),
		
		newChannel: function (uri) {
			this.doAction(uri);
		}
	};
	
	/*
		zotero://debug/
	*/
	var DebugExtension = {
		loadAsChrome: false,
		
		newChannel: function (uri) {
			return new AsyncChannel(uri, function* () {
				this.contentType = "text/plain";
				
				try {
					return Zotero.Debug.get();
				}
				catch (e) {
					Zotero.debug(e, 1);
					throw e;
				}
			});
		}
	};
	
	var ConnectorChannel = function(uri, data) {
		var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
			.getService(Components.interfaces.nsIScriptSecurityManager);
		
		this.name = uri;
		this.URI = ios.newURI(uri, "UTF-8", null);
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
			var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
				.getService(Components.interfaces.nsIScriptSecurityManager);
			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
			
			try {
				var originalURI = uri.pathQueryRef.substr('zotero://connector/'.length);
				originalURI = decodeURIComponent(originalURI);
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
	
	
	/**
	 * Open a PDF at a given page (or try to)
	 *
	 * zotero://open-pdf/library/items/[itemKey]?page=[page]
	 * zotero://open-pdf/groups/[groupID]/items/[itemKey]?page=[page]
	 *
	 * Also supports ZotFile format:
	 * zotero://open-pdf/[libraryID]_[key]/[page]
	 */
	var OpenPDFExtension = {
		noContent: true,
		
		doAction: async function (uri) {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			
			var uriPath = uri.pathQueryRef;
			if (!uriPath) {
				return 'Invalid URL';
			}
			uriPath = uriPath.substr('//open-pdf/'.length);
			var mimeType, content = '';
			
			var params = {
				objectType: 'item'
			};
			var router = new Zotero.Router(params);
			
			// All items
			router.add('library/items/:objectKey', function () {
				params.libraryID = userLibraryID;
			});
			router.add('groups/:groupID/items/:objectKey');
			
			// ZotFile URLs
			router.add(':id/:page', function () {
				var lkh = Zotero.Items.parseLibraryKeyHash(params.id);
				if (!lkh) {
					Zotero.warn(`Invalid URL ${url}`);
					return;
				}
				params.libraryID = lkh.libraryID || userLibraryID;
				params.objectKey = lkh.key;
				delete params.id;
			});
			router.run(uriPath);
			
			Zotero.API.parseParams(params);
			var results = await Zotero.API.getResultsFromParams(params);
			var page = params.page;
			if (parseInt(page) != page) {
				page = null;
			}
			
			if (!results.length) {
				Zotero.warn(`No item found for ${uriPath}`);
				return;
			}
			
			var item = results[0];
			
			if (!item.isFileAttachment()) {
				Zotero.warn(`Item for ${uriPath} is not a file attachment`);
				return;
			}
			
			var path = await item.getFilePathAsync();
			if (!path) {
				Zotero.warn(`${path} not found`);
				return;
			}
			
			if (!path.toLowerCase().endsWith('.pdf')
					&& Zotero.MIME.sniffForMIMEType(await Zotero.File.getSample(path)) != 'application/pdf') {
				Zotero.warn(`${path} is not a PDF`);
				return;
			}
			
			// If no page number, just open normally
			if (!page) {
				let zp = Zotero.getActiveZoteroPane();
				// TODO: Open pane if closed (macOS)
				if (zp) {
					zp.viewAttachment([item.id]);
				}
				return;
			}
			
			try {
				var opened = Zotero.OpenPDF.openToPage(path, page);
			}
			catch (e) {
				Zotero.logError(e);
			}
			// If something went wrong, just open PDF without page
			if (!opened) {
				let zp = Zotero.getActiveZoteroPane();
				// TODO: Open pane if closed (macOS)
				if (zp) {
					zp.viewAttachment([item.id]);
				}
				return;
			}
			Zotero.Notifier.trigger('open', 'file', item.id);
		},
		
		
		newChannel: function (uri) {
			this.doAction(uri);
		}
	};
	
	this._extensions[ZOTERO_SCHEME + "://data"] = DataExtension;
	this._extensions[ZOTERO_SCHEME + "://report"] = ReportExtension;
	this._extensions[ZOTERO_SCHEME + "://timeline"] = TimelineExtension;
	this._extensions[ZOTERO_SCHEME + "://select"] = SelectExtension;
	this._extensions[ZOTERO_SCHEME + "://debug"] = DebugExtension;
	this._extensions[ZOTERO_SCHEME + "://connector"] = ConnectorExtension;
	this._extensions[ZOTERO_SCHEME + "://open-pdf"] = OpenPDFExtension;
}


/*
 * Implements nsIProtocolHandler
 */
ZoteroProtocolHandler.prototype = {
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
	
	getExtension: function (uri) {
		let uriString = uri;
		if (uri instanceof Components.interfaces.nsIURI) {
			uriString = uri.spec;
		}
		uriString = uriString.toLowerCase();
		
		for (let extSpec in this._extensions) {
			if (uriString.startsWith(extSpec)) {
				return this._extensions[extSpec];
			}
		}
		
		return false;
	},
				
	newURI: function (spec, charset, baseURI) {
		return Components.classes["@mozilla.org/network/simple-uri-mutator;1"]
			.createInstance(Components.interfaces.nsIURIMutator)
			.setSpec(spec)
			.finalize();
	},
	
	newChannel : function(uri) {
		var chromeService = Components.classes["@mozilla.org/network/protocol;1?name=chrome"]
			.getService(Components.interfaces.nsIProtocolHandler);
		
		var newChannel = null;
		
		try {
			let ext = this.getExtension(uri);
			
			if (!ext) {
				// Return cancelled channel for unknown paths
				//
				// These can be in the form zotero://example.com/... -- maybe for "//example.com" URLs?
				var chromeURI = chromeService.newURI(DUMMY_CHROME_URL, null, null);
				var extChannel = chromeService.newChannel(chromeURI);
				var chromeRequest = extChannel.QueryInterface(Components.interfaces.nsIRequest);
				chromeRequest.cancel(0x804b0002); // BINDING_ABORTED
				return extChannel;
			}
			
			if (!this._principal && ext.loadAsChrome) {
				this._principal = Services.scriptSecurityManager.getSystemPrincipal();
			}
			
			var extChannel = ext.newChannel(uri);
			// Extension returned null, so cancel request
			if (!extChannel) {
				var chromeURI = chromeService.newURI(DUMMY_CHROME_URL, null, null);
				var extChannel = chromeService.newChannel(chromeURI);
				var chromeRequest = extChannel.QueryInterface(Components.interfaces.nsIRequest);
				chromeRequest.cancel(0x804b0002); // BINDING_ABORTED
			}
			
			// Apply cached principal to extension channel
			if (this._principal) {
				extChannel.owner = this._principal;
			}
			
			if(!extChannel.originalURI) extChannel.originalURI = uri;
			
			return extChannel;
		}
		catch (e) {
			Components.utils.reportError(e);
			Zotero.debug(e, 1);
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


/**
 * nsIChannel implementation that takes a promise-yielding generator that returns a
 * string, nsIAsyncInputStream, or file
 */
function AsyncChannel(uri, gen) {
	this._generator = gen;
	this._isPending = true;
	
	// nsIRequest
	this.name = uri;
	this.loadFlags = 0;
	this.loadGroup = null;
	this.status = 0;
	
	// nsIChannel
	this.contentLength = -1;
	this.contentType = "text/html";
	this.contentCharset = "utf-8";
	this.URI = uri;
	this.originalURI = uri;
	this.owner = null;
	this.notificationCallbacks = null;
	this.securityInfo = null;
}

AsyncChannel.prototype = {
	asyncOpen: Zotero.Promise.coroutine(function* (streamListener, context) {
		if (this.loadGroup) this.loadGroup.addRequest(this, null);
		
		var channel = this;
		
		var resolve;
		var reject;
		var promise = new Zotero.Promise(function () {
			resolve = arguments[0];
			reject = arguments[1];
		});
		
		var listenerWrapper = {
			onStartRequest: function (request, context) {
				//Zotero.debug("Starting request");
				streamListener.onStartRequest(channel, context);
			},
			onDataAvailable: function (request, context, inputStream, offset, count) {
				//Zotero.debug("onDataAvailable");
				streamListener.onDataAvailable(channel, context, inputStream, offset, count);
			},
			onStopRequest: function (request, context, status) {
				//Zotero.debug("Stopping request");
				streamListener.onStopRequest(channel, context, status);
				channel._isPending = false;
				if (status == 0) {
					resolve();
				}
				else {
					reject(new Error("AsyncChannel request failed with status " + status));
				}
			}
		};
		
		//Zotero.debug("AsyncChannel's asyncOpen called");
		var t = new Date;
		
		var data;
		try {
			if (!data) {
				data = yield Zotero.spawn(channel._generator, channel)
			}
			if (typeof data == 'string') {
				//Zotero.debug("AsyncChannel: Got string from generator");
				
				listenerWrapper.onStartRequest(this, context);
				
				let converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
					.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
				converter.charset = "UTF-8";
				let inputStream = converter.convertToInputStream(data);
				listenerWrapper.onDataAvailable(this, context, inputStream, 0, inputStream.available());
				
				listenerWrapper.onStopRequest(this, context, this.status);
			}
			// If an async input stream is given, pass the data asynchronously to the stream listener
			else if (data instanceof Ci.nsIAsyncInputStream) {
				//Zotero.debug("AsyncChannel: Got input stream from generator");
				
				var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
				try {
					pump.init(data, 0, 0, true);
				}
				catch (e) {
					pump.init(data, -1, -1, 0, 0, true);
				}
				pump.asyncRead(listenerWrapper, context);
			}
			else if (data instanceof Ci.nsIFile || data instanceof Ci.nsIURI) {
				if (data instanceof Ci.nsIFile) {
					//Zotero.debug("AsyncChannel: Got file from generator");
					data = ios.newFileURI(data);
				}
				else {
					//Zotero.debug("AsyncChannel: Got URI from generator");
				}

				let uri = data;
				uri.QueryInterface(Ci.nsIURL);
				this.contentType = Zotero.MIME.getMIMETypeFromExtension(uri.fileExtension);
				if (!this.contentType) {
					let sample = yield Zotero.File.getSample(data);
					this.contentType = Zotero.MIME.getMIMETypeFromData(sample);
				}
				
				Components.utils.import("resource://gre/modules/NetUtil.jsm");
				NetUtil.asyncFetch(data, function (inputStream, status) {
					if (!Components.isSuccessCode(status)) {
						reject();
						return;
					}
					
					listenerWrapper.onStartRequest(channel, context);
					try {
						listenerWrapper.onDataAvailable(channel, context, inputStream, 0, inputStream.available());
					}
					catch (e) {
						reject(e);
					}
					listenerWrapper.onStopRequest(channel, context, status);
				});
			}
			else if (data === undefined) {
				this.cancel(0x804b0002); // BINDING_ABORTED
			}
			else {
				throw new Error("Invalid return type (" + typeof data + ") from generator passed to AsyncChannel");
			}
			
			if (this._isPending) {
				//Zotero.debug("AsyncChannel request succeeded in " + (new Date - t) + " ms");
				channel._isPending = false;
			}
			
			return promise;
		} catch (e) {
			Zotero.debug(e, 1);
			if (channel._isPending) {
				streamListener.onStopRequest(channel, context, Components.results.NS_ERROR_FAILURE);
				channel._isPending = false;
			}
			throw e;
		} finally {
			if (channel.loadGroup) channel.loadGroup.removeRequest(channel, null, 0);
		}
	}),
	
	// nsIRequest
	isPending: function () {
		return this._isPending;
	},
	
	cancel: function (status) {
		Zotero.debug("Cancelling");
		this.status = status;
		this._isPending = false;
	},
	
	resume: function () {
		Zotero.debug("Resuming");
	},
	
	suspend: function () {
		Zotero.debug("Suspending");
	},
	
	// nsIWritablePropertyBag
	setProperty: function (prop, val) {
		this[prop] = val;
	},
	
	
	deleteProperty: function (prop) {
		delete this[prop];
	},
	
	
	QueryInterface: function (iid) {
		if (iid.equals(Components.interfaces.nsISupports)
				|| iid.equals(Components.interfaces.nsIRequest)
				|| iid.equals(Components.interfaces.nsIChannel)
				// pdf.js wants this
				|| iid.equals(Components.interfaces.nsIWritablePropertyBag)) {
			return this;
		}
		throw Components.results.NS_ERROR_NO_INTERFACE;
	}
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([ZoteroProtocolHandler]);
