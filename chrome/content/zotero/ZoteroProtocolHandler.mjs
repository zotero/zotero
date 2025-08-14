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

import { NetUtil } from "resource://gre/modules/NetUtil.sys.mjs";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const ios = Services.io;

// Dummy chrome URL used to obtain a valid chrome channel
const DUMMY_CHROME_URL = "chrome://zotero/content/zoteroPane.xul";

import { Zotero } from "chrome://zotero/content/zotero.mjs";

export function ZoteroProtocolHandler() {
	this.wrappedJSObject = this;
	this._principal = null;
	this._extensions = {};
	
	
	
	/**
	 * zotero://attachment/library/items/[itemKey]
	 * zotero://attachment/groups/[groupID]/items/[itemKey]
	 *
	 * And for snapshot attachments only:
	 * zotero://attachment/library/items/[itemKey]/[resourcePath]
	 * zotero://attachment/groups/[groupID]/items/[itemKey]/[resourcePath]
	 */
	var AttachmentExtension = {
		loadAsChrome: false,
		
		newChannel: function (uri, loadInfo) {
			return new AsyncChannel(uri, loadInfo, async function () {
				try {
					var uriPath = uri.pathQueryRef;
					if (!uriPath) {
						return this._errorChannel('Invalid URL');
					}
					uriPath = uriPath.substring(1);
					
					var params = {};
					var router = new Zotero.Router(params);
					router.add('library/items/:itemKey', function () {
						params.libraryID = Zotero.Libraries.userLibraryID;
					});
					router.add('groups/:groupID/items/:itemKey');
					router.run(uriPath);
					
					if (params.groupID) {
						params.libraryID = Zotero.Groups.getLibraryIDFromGroupID(params.groupID);
					}
					if (!params.itemKey) {
						return this._errorChannel("Item key not provided");
					}
					var item = await Zotero.Items.getByLibraryAndKeyAsync(params.libraryID, params.itemKey);
					
					if (!item) {
						return this._errorChannel(`No item found for ${uriPath}`);
					}
					if (!item.isFileAttachment()) {
						return this._errorChannel(`Item for ${uriPath} is not a file attachment`);
					}
					
					var path = await item.getFilePathAsync();
					if (!path) {
						return this._errorChannel(`${path} not found`);
					}
					
					var resourcePathParts = uriPath.split('/')
						.slice(params.groupID !== undefined ? 4 : 3)
						.filter(Boolean);
					if (resourcePathParts.length) {
						if (item.attachmentReaderType !== 'snapshot') {
							return this._errorChannel(`Item for ${uriPath} is not a snapshot attachment -- cannot access resources`);
						}
						
						try {
							path = PathUtils.join(PathUtils.parent(path), ...resourcePathParts);
						}
						catch (e) {
							Zotero.logError(e);
							return this._errorChannel(`Resource ${resourcePathParts.join('/')} not found`);
						}
						if (!(await IOUtils.exists(path))) {
							return this._errorChannel(`Resource ${resourcePathParts.join('/')} not found`);
						}
					}
					
					// Set originalURI so that it seems like we're serving from zotero:// protocol.
					// This is necessary to allow url() links to work from within CSS files.
					// Otherwise they try to link to files on the file:// protocol, which isn't allowed.
					this.originalURI = uri;
					
					return Zotero.File.pathToFile(path);
				}
				catch (e) {
					return this._errorChannel(e.message);
				}
			}.bind(this));
		},
		
		
		_errorChannel: function (msg) {
			Zotero.logError(msg);
			this.status = Components.results.NS_ERROR_FAILURE;
			this.contentType = 'text/plain';
			return msg;
		}
	};
	
	
	
	/**
	 * zotero://data/library/collection/ABCD1234/items?sort=itemType&direction=desc
	 * zotero://data/groups/12345/collection/ABCD1234/items?sort=title&direction=asc
	 */
	var DataExtension = {
		loadAsChrome: false,
		
		newChannel: function (uri, loadInfo) {
			return new AsyncChannel(uri, loadInfo, async function () {
				this.contentType = 'text/plain';
				
				var path = uri.spec.match(/zotero:\/\/[^/]+(.*)/)[1];
				
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
		loadAsChrome: true,
		
		newChannel: function (uri, loadInfo) {
			return new AsyncChannel(uri, loadInfo, async function () {
				var userLibraryID = Zotero.Libraries.userLibraryID;
				
				var path = uri.pathQueryRef;
				if (!path) {
					return 'Invalid URL';
				}
				path = path.substring(1);
				
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
					var results = await Zotero.API.getResultsFromParams(params);
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
							var item = await Zotero.Items.getAsync(id);
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
							var item = await Zotero.Items.getAsync(id);
							itemsHash[id] = items.length;
							items.push(item.toJSON({ mode: 'full' }));
						}
					}
					
					// Add children to reportChildren property of parents
					for (let id of searchChildIDs) {
						let item = await Zotero.Items.getAsync(id);
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
						var item = await Zotero.Items.getAsync(id);
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
				var compareFunction = function (a, b) {
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
							Zotero.Report.HTML.listGenerator(items, combineChildItems, params.libraryID),
							function () {
								Zotero.logError(e);
								return '<span style="color: red; font-weight: 600">Error generating report</span>';
							}
						);
				}
			});
		}
	};
	
	
	/**
	 * Select an item
	 *
	 * zotero://select/library/items/[itemKey]
	 * zotero://select/groups/[groupID]/items/[itemKey]
	 *
	 * Deprecated:
	 *
	 * zotero://select/[type]/0_ABCD1234
	 * zotero://select/[type]/1234 (not consistent across synced machines)
	 */
	var SelectExtension = {
		noContent: true,
		
		doAction: async function (uri) {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			
			var path = uri.pathQueryRef;
			if (!path) {
				return 'Invalid URL';
			}
			path = path.substring(1);
			
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
			
			var results = await Zotero.API.getResultsFromParams(params);
			
			if (!results.length) {
				var msg = "Objects not found";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg);
				return;
			}
			
			var win = Zotero.getMainWindow();
			var zp = win?.ZoteroPane;
			if (!zp) {
				// TEMP
				throw new Error("Pane not open");
			}
			
			win.Zotero_Tabs.select('zotero-pane');
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
					await zp.collectionsView.selectCollection(col.id);
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
					await zp.collectionsView.selectSearch(s.id);
				}
				// If collection not specified, select library root
				else {
					await zp.collectionsView.selectLibrary(params.libraryID);
				}
				return zp.selectItems(results.map(x => x.id));
			}
		},
		
		newChannel: function (uri) {
			this.doAction(uri);
		}
	};
	
	/*
		zotero://debug/
	*/
	var DebugExtension = {
		loadAsChrome: false,
		
		newChannel: function (uri, loadInfo) {
			return new AsyncChannel(uri, loadInfo, async function () {
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
	
	/*
		zotero://pdf.js/viewer.html
		zotero://pdf.js/pdf/1/ABCD5678
	*/
	var PDFJSExtension = {
		loadAsChrome: true,
		
		newChannel: function (uri) {
			return new AsyncChannel(uri, async function () {
				try {
					uri = uri.spec;
					// Proxy PDF.js files
					if (uri.startsWith('zotero://pdf.js/') && !uri.startsWith('zotero://pdf.js/pdf/')) {
						uri = uri.replace(/zotero:\/\/pdf.js\//, 'resource://zotero/pdf.js/');
						let newURI = Services.io.newURI(uri, null, null);
						return this.getURIInputStream(newURI);
					}
					
					// Proxy attachment PDFs
					var pdfPrefix = 'zotero://pdf.js/pdf/';
					if (!uri.startsWith(pdfPrefix)) {
						return this._errorChannel("File not found");
					}
					var [libraryID, key] = uri.substr(pdfPrefix.length).split('/');
					libraryID = parseInt(libraryID);
					
					var item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
					if (!item) {
						return this._errorChannel("Item not found");
					}
					var path = await item.getFilePathAsync();
					if (!path) {
						return this._errorChannel("File not found");
					}
					return this.getURIInputStream(OS.Path.toFileURI(path));
				}
				catch (e) {
					Zotero.debug(e, 1);
					throw e;
				}
			}.bind(this));
		},
		
		
		getURIInputStream: function (uri) {
			return new Zotero.Promise((resolve, reject) => {
				NetUtil.asyncFetch(uri, function (inputStream, result) {
					if (!Components.isSuccessCode(result)) {
						// TODO: Handle error
						return;
					}
					resolve(inputStream);
				});
			});
		},
		
		
		_errorChannel: function (msg) {
			this.status = Components.results.NS_ERROR_FAILURE;
			this.contentType = 'text/plain';
			return msg;
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
	var OpenExtension = {
		noContent: true,
		
		doAction: async function (uri) {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			
			var uriPath = uri.pathQueryRef;
			if (!uriPath) {
				return 'Invalid URL';
			}
			uriPath = uriPath.substring(1);
			
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
			var { annotation, page, cfi, sel } = params;
			
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
			
			var location = {};
			
			if (page) {
				location.pageIndex = parseInt(page) - 1;
			}
			if (annotation) {
				location.annotationID = annotation;
			}
			
			if (cfi) {
				location.position = {
					type: 'FragmentSelector',
					conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
					value: decodeURIComponent(cfi)
				};
			}
			else if (sel) {
				location.position = {
					type: 'CssSelector',
					value: decodeURIComponent(sel)
				};
			}
			
			// Don't pass empty location
			if (!Object.keys(location).length) {
				location = null;
			}

			var openInWindow = Zotero.Prefs.get('openReaderInNewWindow');

			try {
				await Zotero.FileHandlers.open(item, {
					location,
					openInWindow,
				});
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			Zotero.Notifier.trigger('open', 'file', item.id);
		},
		
		
		newChannel: function (uri) {
			this.doAction(uri);
		}
	};
	
	this._extensions[ZOTERO_SCHEME + "://attachment"] = AttachmentExtension;
	this._extensions[ZOTERO_SCHEME + "://data"] = DataExtension;
	this._extensions[ZOTERO_SCHEME + "://report"] = ReportExtension;
	this._extensions[ZOTERO_SCHEME + "://select"] = SelectExtension;
	this._extensions[ZOTERO_SCHEME + "://debug"] = DebugExtension;
	this._extensions[ZOTERO_SCHEME + "://pdf.js"] = PDFJSExtension;
	this._extensions[ZOTERO_SCHEME + "://open"] = OpenExtension;
	this._extensions[ZOTERO_SCHEME + "://open-pdf"] = OpenExtension;
}


/*
 * Implements nsIProtocolHandler
 */
ZoteroProtocolHandler.prototype = {
	get scheme() {
		return ZOTERO_SCHEME;
	},
	protocolFlags:
		Ci.nsIProtocolHandler.URI_NORELATIVE
			| Ci.nsIProtocolHandler.URI_NOAUTH
			| Ci.nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT
			// URI_IS_UI_RESOURCE: more secure than URI_LOADABLE_BY_ANYONE, less secure than URI_DANGEROUS_TO_LOAD
			// This is the security level used by the chrome:// protocol
			| Ci.nsIProtocolHandler.URI_IS_UI_RESOURCE
			| Ci.nsIProtocolHandler.URI_NON_PERSISTABLE
			| Ci.nsIProtocolHandler.URI_IS_LOCAL_RESOURCE
			| Ci.nsIProtocolHandler.URI_SYNC_LOAD_IS_OK,
	get defaultPort() {
		return -1;
	},
	allowPort: function allowPort() {
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
		// A temporary workaround because baseURI.resolve(spec) just returns spec
		if (baseURI) {
			if (!spec.includes('://') && baseURI.spec.includes('/pdf.js/')) {
				let parts = baseURI.spec.split('/');
				parts.pop();
				parts.push(spec);
				spec = parts.join('/');
			}
		}
	
		return Components.classes["@mozilla.org/network/simple-uri-mutator;1"]
			.createInstance(Components.interfaces.nsIURIMutator)
			.setSpec(spec)
			.finalize();
	},
	
	newChannel: function (uri, loadInfo) {
		try {
			let ext = this.getExtension(uri);
			
			// Return cancelled channel for unknown paths
			if (!ext) {
				return this._getCancelledChannel();
			}
			
			var extChannel = ext.newChannel(uri, loadInfo);
			// Extension returned null, so cancel request
			if (!extChannel) {
				return this._getCancelledChannel();
			}
			
			// Apply cached principal to extension channel
			if (ext.loadAsChrome) {
				if (!this._principal) {
					this._principal = Services.scriptSecurityManager.getSystemPrincipal();
				}
				extChannel.owner = this._principal;
			}
			
			//if(!extChannel.originalURI) extChannel.originalURI = uri;
			
			return extChannel;
		}
		catch (e) {
			Components.utils.reportError(e);
			Zotero.debug(e, 1);
			throw Components.results.NS_ERROR_FAILURE;
		}
		
		return null;
	},
	
	_getCancelledChannel: function () {
		var channel = NetUtil.newChannel({
			uri: DUMMY_CHROME_URL,
			loadUsingSystemPrincipal: true,
		})
		var req = channel.QueryInterface(Components.interfaces.nsIRequest);
		req.cancel(0x804b0002); // BINDING_ABORTED
		return channel;
	},
	
	contractID: ZOTERO_PROTOCOL_CONTRACTID,
	classDescription: ZOTERO_PROTOCOL_NAME,
	classID: ZOTERO_PROTOCOL_CID,
	//QueryInterface: ChromeUtils.generateQI([Components.interfaces.nsIProtocolHandler])
	QueryInterface: ChromeUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIProtocolHandler]),
};

/**
 * @static
 *
 * Unregistered in Zotero.reinit() for tests
 */
ZoteroProtocolHandler.init = function () {
	Services.io.registerProtocolHandler(
		'zotero',
		new ZoteroProtocolHandler(),
		ZoteroProtocolHandler.prototype.protocolFlags,
		ZoteroProtocolHandler.prototype.defaultPort
	);
};


/**
 * nsIChannel implementation that takes an async function that returns a
 * string, nsIAsyncInputStream, or file
 */
function AsyncChannel(uri, loadInfo, func) {
	this.URI = this.originalURI = uri;
	this.loadInfo = loadInfo;
	
	this._function = func;
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
	asyncOpen: async function (streamListener) {
		if (this.loadGroup) this.loadGroup.addRequest(this, null);
		
		var channel = this;
		
		var resolve;
		var reject;
		var promise = new Zotero.Promise(function () {
			resolve = arguments[0];
			reject = arguments[1];
		});
		
		var listenerWrapper = {
			onStartRequest: function (request) {
				//Zotero.debug("Starting request");
				streamListener.onStartRequest(channel);
			},
			onDataAvailable: function (request, inputStream, offset, count) {
				//Zotero.debug("onDataAvailable");
				try {
					streamListener.onDataAvailable(channel, inputStream, offset, count);
				}
				catch (e) {
					channel.cancel(e.result);
				}
			},
			onStopRequest: function (request, status) {
				//Zotero.debug("Stopping request");
				streamListener.onStopRequest(channel, status);
				channel._isPending = false;
				if (status === Cr.NS_OK) {
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
				data = await channel._function();
			}
			if (typeof data == 'string') {
				//Zotero.debug("AsyncChannel: Got string from generator");
				
				listenerWrapper.onStartRequest(this);
				
				let inputStream = Cc["@mozilla.org/io/string-input-stream;1"]
					.createInstance(Ci.nsIStringInputStream);
				inputStream.setUTF8Data(data);
				
				listenerWrapper.onDataAvailable(this, inputStream, 0, inputStream.available());
				
				listenerWrapper.onStopRequest(this, this.status);
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
				pump.asyncRead(listenerWrapper, null);
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
					let sample = await Zotero.File.getSample(uri.spec);
					this.contentType = Zotero.MIME.getMIMETypeFromData(sample);
				}
				
				NetUtil.asyncFetch({ uri: data, loadUsingSystemPrincipal: true }, function (inputStream, status) {
					if (!Components.isSuccessCode(status)) {
						reject();
						return;
					}
					
					listenerWrapper.onStartRequest(channel);
					try {
						listenerWrapper.onDataAvailable(channel, inputStream, 0, inputStream.available());
					}
					catch (e) {
						reject(e);
					}
					listenerWrapper.onStopRequest(channel, status);
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
				streamListener.onStopRequest(channel, Components.results.NS_ERROR_FAILURE);
				channel._isPending = false;
			}
			throw e;
		} finally {
			try {
				if (channel.loadGroup) channel.loadGroup.removeRequest(channel, null, 0);
			}
			catch (e) {}
		}
	},
	
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
	/*setProperty: function (prop, val) {
		this[prop] = val;
	},
	
	
	deleteProperty: function (prop) {
		delete this[prop];
	},*/
	
	QueryInterface: ChromeUtils.generateQI([Ci.nsIChannel, Ci.nsIRequest]),
				/*pdf.js wants this
				|| iid.equals(Components.interfaces.nsIWritablePropertyBag)) {*/
};
