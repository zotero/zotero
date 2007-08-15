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
	
	
	Based on nsChromeExtensionHandler example code by Ed Anuff at
	http://kb.mozillazine.org/Dev_:_Extending_the_Chrome_Protocol
    
	
    ***** END LICENSE BLOCK *****
*/


const ZOTERO_SCHEME = "zotero";
const ZOTERO_PROTOCOL_CID = Components.ID("{9BC3D762-9038-486A-9D70-C997AF848A7C}");
const ZOTERO_PROTOCOL_CONTRACTID = "@mozilla.org/network/protocol;1?name=" + ZOTERO_SCHEME;
const ZOTERO_PROTOCOL_NAME = "Zotero Chrome Extension Protocol";

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
	 * zotero://report/collection/12345
	 * zotero://report/search/12345
	 * zotero://report/items/12345-23456-34567
	 * zotero://report/item/12345
	 *
	 * Optional format can be specified after ids
	 *
	 *  - 'html', 'rtf', 'csv'
	 *  - defaults to 'html' if not specified
	 *
	 * e.g. zotero://report/collection/12345/rtf
	 * 
	 *
	 * Sorting:
	 *
	 * 	- 'sort' query string variable
	 *  - format is field[/order] [, field[/order], ...]
	 *  - order can be 'asc', 'a', 'desc' or 'd'; defaults to ascending order
	 *
	 *  zotero://report/collection/13245?sort=itemType/d,title
	 */
	var ReportExtension = new function(){
		this.newChannel = newChannel;
		
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
						var results = Zotero.getItems(ids);
						break;
					
					case 'search':
						var s = new Zotero.Search(ids);
						var ids = s.search();
						break;
					
					case 'items':
					case 'item':
						var ids = ids.split('-');
						break;
						
					default:
						var type = 'library';
						var s = new Zotero.Search();
						s.addCondition('noChildren', 'true');
						var ids = s.search();
				}
				
				if (!results) {
					var results = Zotero.Items.get(ids);
				}
				var items = [];
				// Only include parent items
				for (var i=0; i<results.length; i++) {
					if (!results[i].getSource()) {
						items.push(results[i]);
					}
				}
				
				if (!items){
					mimeType = 'text/html';
					content = 'Invalid ID';
					break generateContent;
				}
				
				// Sort items
				if (!sortBy) {
					sortBy = 'title';
				}
				
				var sorts = sortBy.split(',');
				for (var i=0; i<sorts.length; i++) {
					var [field, order] = sorts[i].split('/');
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
						var cmp = collation.compareString(0,
							a.getField(sorts[index].field),
							b.getField(sorts[index].field)
						);
						
						if (cmp == 0) {
							continue;
						}
						
						var result = cmp * sorts[index].order;
						index++;
					}
					while (result == 0 && sorts[index]);
					
					return result;
				};
				
				items.sort(compareFunction);
				
				// Convert item objects to export arrays
				for (var i=0; i<items.length; i++) {
					items[i] = items[i].toArray();
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
						format = 'html';
						mimeType = 'application/xhtml+xml';
						content = Zotero.Report.generateHTMLDetails(items);
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
						var theCollection = Zotero.Collections.get(id);
						content = content.replace(theTemp, theTemp + theCollection.getName() + ' - ');
					}
					else if(type == 'search') {
						var theSearch = Zotero.Searches.get(id);
						content = content.replace(theTemp, theTemp + theSearch['name'] + ' - ');
					}
					else {
						content = content.replace(theTemp, theTemp + Zotero.getString('pane.collections.library') + ' - ');
					}
					
					theTemp = 'Timeline.loadXML("zotero://timeline/data/';
					var d = '';
					//passes information (type,ids, dateType) for when the XML is created
					if(!type || (type != 'collection' && type != 'search')) {
						d += 'library?t=' + dateType;
					}
					else {
						d += type + '/' + id + '?t=' + dateType;
					}
					content = content.replace(theTemp, theTemp + d);
					
					
					var uri_str = 'data:' + (mimeType ? mimeType + ',' : '') + encodeURIComponent(content);
					var ext_uri = ioService.newURI(uri_str, null, null);
					var extChannel = ioService.newChannelFromURI(ext_uri);

					return extChannel;
				}
				else {
					//creates XML file
					var [, type, ids] = pathParts;
					
					switch (type){
						case 'collection':
							var results = Zotero.getItems(ids);
							break;

						case 'search':
							var s = new Zotero.Search(ids);
							var ids = s.search();
							break;

						default:
							type = 'library';
							var s = new Zotero.Search();
							s.addCondition('noChildren', 'true');
							var ids = s.search();
					}

					if (!results) {
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

					// Convert item objects to export arrays
					for (var i = 0; i < items.length; i++) {
						items[i] = items[i].toArray();
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
		zotero://select/type/id
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
				
				//currently only able to select one item
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
				var win = wm.getMostRecentWindow(null);
				
				if(!win.ZoteroPane.isShowing()){
					win.ZoteroPane.toggleDisplay();
				}
				
				win.ZoteroPane.selectItem(id);
			}
			catch (e){
				Zotero.debug(e);
				throw (e);
			}
		}
	};

	
	var ReportExtensionSpec = ZOTERO_SCHEME + "://report"
	ReportExtensionSpec = ReportExtensionSpec.toLowerCase();
	
	this._extensions[ReportExtensionSpec] = ReportExtension;

	var TimelineExtensionSpec = ZOTERO_SCHEME + "://timeline"
	TimelineExtensionSpec = TimelineExtensionSpec.toLowerCase();

	this._extensions[TimelineExtensionSpec] = TimelineExtension;
	
	var SelectExtensionSpec = ZOTERO_SCHEME + "://select"
	SelectExtensionSpec = SelectExtensionSpec.toLowerCase();

	this._extensions[SelectExtensionSpec] = SelectExtension;
}


/*
 * Implements nsIProtocolHandler
 */
ChromeExtensionHandler.prototype = {
	scheme: ZOTERO_SCHEME,
	
	defaultPort : -1,
	
	protocolFlags : Components.interfaces.nsIProtocolHandler.URI_STD,
	
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
			
			for (extSpec in this._extensions) {
				var ext = this._extensions[extSpec];
				
				if (uriString.indexOf(extSpec) == 0) {
					if (this._systemPrincipal == null) {
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
					
					if (this._systemPrincipal != null) {
						// applying cached system principal to extension channel
						extChannel.owner = this._systemPrincipal;
					}
					
					extChannel.originalURI = uri;
					
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
	
	QueryInterface : function(iid) {
		if (!iid.equals(Components.interfaces.nsIProtocolHandler) &&
				!iid.equals(Components.interfaces.nsISupports)) {
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		return this;
	}
};


//
// XPCOM goop
//

var ChromeExtensionModule = {
	cid: ZOTERO_PROTOCOL_CID,
	
	contractId: ZOTERO_PROTOCOL_CONTRACTID,
	
	registerSelf : function(compMgr, fileSpec, location, type) {
		compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(
			ZOTERO_PROTOCOL_CID, 
			ZOTERO_PROTOCOL_NAME, 
			ZOTERO_PROTOCOL_CONTRACTID, 
			fileSpec, 
			location,
			type
		);
	},
	
	getClassObject : function(compMgr, cid, iid) {
		if (!cid.equals(ZOTERO_PROTOCOL_CID)) {
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		if (!iid.equals(Components.interfaces.nsIFactory)) {
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
		}
		return this.myFactory;
	},
	
	canUnload : function(compMgr) {
		return true;
	},
	
	myFactory : {
		createInstance : function(outer, iid) {
			if (outer != null) {
				throw Components.results.NS_ERROR_NO_AGGREGATION;
			}
			
			return new ChromeExtensionHandler().QueryInterface(iid);
		}
	}
};

function NSGetModule(compMgr, fileSpec) {
    return ChromeExtensionModule;
}
