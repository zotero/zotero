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
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
	
    ***** END LICENSE BLOCK *****
*/

Zotero.Ingester = new Object();

/////////////////////////////////////////////////////////////////
//
// Zotero.Ingester.ProxyMonitor
//
/////////////////////////////////////////////////////////////////

// A singleton for recognizing EZProxies and converting URLs such that databases
// will work from outside them. Unfortunately, this only works with the ($495)
// EZProxy software. If there are open source alternatives, we should support
// them too.

/*
 * Precompile proxy regexps
 */
Zotero.Ingester.ProxyMonitor = new function() {
	var _ezProxyRe = new RegExp();
	_ezProxyRe.compile("\\?(?:.+&)?(url|qurl)=([^&]+)", "i");
	/*var _hostRe = new RegExp();
	_hostRe.compile("^https?://(([^/:]+)(?:\:([0-9]+))?)");*/
	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
							  .getService(Components.interfaces.nsIIOService);
	var on = false;
	var _mapFromProxy = null;
	var _mapToProxy = null;
	
	this.init = init;
	this.proxyToProper = proxyToProper;
	this.properToProxy = properToProxy;
	this.observe = observe;
	
	function init() {
		if(!on) {
			var observerService = Components.classes["@mozilla.org/observer-service;1"]
										.getService(Components.interfaces.nsIObserverService);
			observerService.addObserver(this, "http-on-examine-response", false);
		}
		on = true;
	}
	
	function observe(channel) {
		channel.QueryInterface(Components.interfaces.nsIHttpChannel);
		try {
			// remove content-disposition headers for endnote, etc.
			var contentType = channel.getResponseHeader("Content-Type").toLowerCase();
			for each(var desiredContentType in Zotero.Ingester.MIMEHandler.URIContentListener.desiredContentTypes) {
				if(contentType.length < desiredContentType.length) {
					break;
				} else {
					if(contentType.substr(0, desiredContentType.length) == desiredContentType) {
						channel.setResponseHeader("Content-Disposition", "", false);
						break;
					}
				}
			}
		} catch(e) {}
		
		try {
			// find ezproxies
			if(channel.getResponseHeader("Server") == "EZproxy") {
				// We're connected to an EZproxy
				if(channel.responseStatus != "302") {
					return;
				}
				
				// We should be able to scrape the URL out of this
				var m = _ezProxyRe.exec(channel.URI.spec);
				if(!m) {
					return;
				}
				
				// Found URL
				var variable = m[1];
				var properURL = m[2];
				if(variable.toLowerCase() == "qurl") {
					properURL = unescape(properURL);
				}
				var properURI = _parseURL(properURL);
				if(!properURI) {
					return;
				}
				
				// Get the new URL
				var newURL = channel.getResponseHeader("Location");
				if(!newURL) {
					return;
				}
				var newURI = _parseURL(newURL);
				if(!newURI) {
					return;
				}
				
				if((channel.URI.host == newURI.host && channel.URI.port != newURI.port) ||
				   (newURI.host != channel.URI.host &&
				    newURI.hostPort.substr(newURI.hostPort.length-channel.URI.hostPort.length) == channel.URI.hostPort)) {
					// Different ports but the same server means EZproxy active
					
					Zotero.debug("EZProxy: host "+newURI.hostPort+" is really "+properURI.hostPort);
					// Initialize variables here so people who never use EZProxies
					// don't get the (very very minor) speed hit
					if(!_mapFromProxy) {
						_mapFromProxy = new Object();
						_mapToProxy = new Object();
					}
					_mapFromProxy[newURI.hostPort] = properURI.hostPort;
					_mapToProxy[properURI.hostPort] = newURI.hostPort;
				}
			}
		} catch(e) {}
	}
	
	/*
	 * Returns a page's proper url, adjusting for proxying
	 */
	function proxyToProper(url) {
		if(_mapFromProxy) {
			// EZProxy detection is active
			
			var uri = _parseURL(url);
			if(uri && _mapFromProxy[uri.hostPort]) {
				url = url.replace(uri.hostPort, _mapFromProxy[uri.hostPort]);
				Zotero.debug("EZProxy: proper url is "+url);
			}
		}
		
		return url;
	}
	
	/*
	 * Returns a page's proxied url from the proper url
	 */
	function properToProxy(url) {
		if(_mapToProxy) {
			// EZProxy detection is active
			
			var uri = _parseURL(url);
			if(uri && _mapToProxy[uri.hostPort]) {
				// Actually need to map
				url = url.replace(uri.hostPort, _mapToProxy[uri.hostPort]);
				Zotero.debug("EZProxy: proxied url is "+url);
			}
		}
		
		return url;
	}
	
	/*
	 * Parses a url into components (hostPort, port, host, and spec)
	 */
	function _parseURL(url) {
		// create an nsIURI (not sure if this is faster than the regular
		// expression, but it's at least more kosher)
		var uri = ioService.newURI(url, null, null);
		return uri;
	}
}

Zotero.OpenURL = new function() {
	this.resolve = resolve;
	this.discoverResolvers = discoverResolvers;
	this.createContextObject = createContextObject;
	this.parseContextObject = parseContextObject;
	
	/*
	 * Returns a URL to look up an item in the OpenURL resolver
	 */
	function resolve(itemObject) {
		var co = createContextObject(itemObject, Zotero.Prefs.get("openURL.version"));
		if(co) {
			return Zotero.Prefs.get("openURL.resolver")+"?"+co;
		}
		return false;
	}
	
	/*
	 * Queries OCLC's OpenURL resolver registry and returns an address and version
	 */
	function discoverResolvers() {
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
		req.open("GET", "http://worldcatlibraries.org/registry/lookup?IP=requestor", false);
		req.send(null);
		
		if(!req.responseXML) {
			throw "Could not access resolver registry";
		}
		
		var resolverArray = new Array();
		var resolvers = req.responseXML.getElementsByTagName("resolver");
		for(var i=0; i<resolvers.length; i++) {
			var resolver = resolvers[i];
			
			var name = resolver.parentNode.getElementsByTagName("institutionName");
			if(!name.length) {
				continue;
			}
			name = name[0].textContent;
			
			var url = resolver.getElementsByTagName("baseURL");
			if(!url.length) {
				continue;
			}
			url = url[0].textContent;
			
			if(resolver.getElementsByTagName("Z39.88-2004").length > 0) {
				var version = "1.0";
			} else if(resolver.getElementsByTagName("OpenUrl 0.1").length > 0) {
				var version = "0.1";
			} else {
				continue;
			}
			
			resolverArray.push({name:name, url:url, version:version});
		}
		
		return resolverArray;
	}
	
	/*
	 * Generates an OpenURL ContextObject from an item
	 */
	function createContextObject(item, version) {
		if(item.toArray) {
			item = item.toArray();
		}
		
		var identifiers = new Array();
		if(item.DOI) {
			identifiers.push("info:doi/"+item.DOI);
		}
		if(item.ISBN) {
			identifiers.push("urn:isbn:"+item.ISBN);
		}
		
		// encode ctx_ver (if available) and identifiers
		// TODO identifiers may need to be encoded as follows:
		// rft_id=info:doi/<the-url-encoded-doi>
		// rft_id=http://<the-rest-of-the-url-encoded-url>
		if(version == "0.1") {
			var co = "";
			
			for each(identifier in identifiers) {
				co += "&id="+escape(identifier);
			}
		} else {
			var co = "url_ver=Z39.88-2004&ctx_ver=Z39.88-2004";
			
			for each(identifier in identifiers) {
				co += "&rft_id="+escape(identifier);
			}
		}
		
		// encode genre and item-specific data
		if(item.itemType == "journalArticle") {
			if(version == "0.1") {
				co += "&genre=article";
			} else {
				co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&rft.genre=article";
			}
			if(item.title) co += _mapTag(item.title, "atitle", version)		
			if(item.publicationTitle) co += _mapTag(item.publicationTitle, (version == "0.1" ? "title" : "jtitle"), version)		
			if(item.journalAbbreviation) co += _mapTag(item.journalAbbreviation, "stitle", version);
			if(item.volume) co += _mapTag(item.volume, "volume", version);
			if(item.issue) co += _mapTag(item.issue, "issue", version);
		} else if(item.itemType == "book" || item.itemType == "bookSection") {
			if(version == "0.1") {
				co += "&genre=book";
			} else {
				co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook";
			}
			
			if(item.itemType == "book") {
				co += "&rft.genre=book";
				if(item.title) co += _mapTag(item.title, (version == "0.1" ? "title" : "btitle"), version);
			} else {
				co += "&rft.genre=bookitem";
				if(item.title) co += _mapTag(item.title, "atitle", version)		
				if(item.publicationTitle) co += _mapTag(item.publicationTitle, (version == "0.1" ? "title" : "btitle"), version);
			}
			
			if(item.place) co += _mapTag(item.place, "place", version);
			if(item.publisher) co += _mapTag(item.publisher, "publisher", version)		
			if(item.edition) co += _mapTag(item.edition, "edition", version);
			if(item.series) co += _mapTag(item.series, "series", version);
		} else if(item.itemType == "thesis" && version == "1.0") {
			co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Adissertation";
			
			if(item.title) co += _mapTag(item.title, "title", version);
			if(item.publisher) co += _mapTag(item.publisher, "inst", version);
			if(item.type) co += _mapTag(item.type, "degree", version);
		} else if(item.itemType == "patent" && version == "1.0") {
			co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Apatent";
			
			if(item.title) co += _mapTag(item.title, "title", version);
			if(item.assignee) co += _mapTag(item.assignee, "assignee", version);
			if(item.patentNumber) co += _mapTag(item.patentNumber, "number", version);
			
			if(item.issueDate) {
				co += _mapTag(Zotero.Date.strToISO(item.issueDate), "date", version);
			}
		} else {
			return false;
		}
		
		if(item.creators && item.creators.length) {
			// encode first author as first and last
			var firstCreator = item.creators[0];
			if(item.itemType == "patent") {
				co += _mapTag(firstCreator.firstName, "invfirst", version);
				co += _mapTag(firstCreator.lastName, "invlast", version);
			} else {
				if(firstCreator.isInstitution) {
					co += _mapTag(firstCreator.lastName, "aucorp", version);
				} else {
					co += _mapTag(firstCreator.firstName, "aufirst", version);
					co += _mapTag(firstCreator.lastName, "aulast", version);
				}
			}
			
			// encode subsequent creators as au
			for each(creator in item.creators) {
				co += _mapTag((creator.firstName ? creator.firstName+" " : "")+creator.lastName, (item.itemType == "patent" ? "inventor" : "au"), version);
			}
		}
		
		if(item.date) {
			co += _mapTag(Zotero.Date.strToISO(item.date), (item.itemType == "patent" ? "appldate" : "date"), version);
		}
		if(item.pages) co += _mapTag(item.pages, "pages", version);
		if(item.ISBN) co += _mapTag(item.ISBN, "isbn", version);
		if(item.ISSN) co += _mapTag(item.ISSN, "issn", version);
		
		if(version == "0.1") {
			// chop off leading & sign if version is 0.1
			co = co.substr(1);
		}
		
		return co;
	}
	
	/*
	 * Generates an item in the format returned by item.fromArray() given an
	 * OpenURL version 1.0 contextObject
	 *
	 * accepts an item array to fill, or creates and returns a new item array
	 */
	function parseContextObject(co, item) {
		if(!item) {
			var item = new Array();
			item.creators = new Array();
		}
		
		var coParts = co.split("&");
		
		// get type
		for each(var part in coParts) {
			if(part.substr(0, 12) == "rft_val_fmt=") {
				var format = decodeURIComponent(part.substr(12));
				if(format == "info:ofi/fmt:kev:mtx:journal") {
					item.itemType = "journalArticle";
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:book") {
					if(Zotero.inArray("rft.genre=bookitem", coParts)) {
						item.itemType = "bookSection";
					} else if(Zotero.inArray("rft.genre=conference", coParts) || Zotero.inArray("rft.genre=proceeding", coParts)) {
						item.itemType = "conferencePaper";
					} else if(Zotero.inArray("rft.genre=report", coParts)) {
						item.itemType = "report";
					} else {
						item.itemType = "book";
					}
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:dissertation") {
					item.itemType = "thesis";
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:patent") {
					item.itemType = "patent";
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:dc") {
					item.itemType = "webpage";
					break;
				}
			}
		}
		if(!item.itemType) {
			return false;
		}
		
		var pagesKey = "";
		
		// keep track of "aucorp," "aufirst," "aulast"
		var complexAu = new Array();
		
		for each(var part in coParts) {
			var keyVal = part.split("=");
			var key = keyVal[0];
			var value = decodeURIComponent(keyVal[1].replace(/\+|%2[bB]/g, " "));
			if(!value) {
				continue;
			}
			
			if(key == "rft_id") {
				var firstEight = value.substr(0, 8).toLowerCase();
				if(firstEight == "info:doi") {
					item.DOI = value.substr(9);
				} else if(firstEight == "urn:isbn") {
					item.ISBN = value.substr(9);
				} else if(value.substr(0, 7) == "http://") {
					item.url = value;
					item.accessDate = "";
				}
			} else if(key == "rft.btitle") {
				if(item.itemType == "book" || item.itemType == "conferencePaper" || item.itemType == "report") {
					item.title = value;
				} else if(item.itemType == "bookSection") {
					item.publicationTitle = value;
				}
			} else if(key == "rft.atitle" && (item.itemType == "journalArticle" ||
			                                  item.itemType == "bookSection")) {
				item.title = value;
			} else if(key == "rft.jtitle" && item.itemType == "journalArticle") {
				item.publicationTitle = value;
			} else if(key == "rft.stitle" && item.itemType == "journalArticle") {
				item.journalAbbreviation = value;
			} else if(key == "rft.title") {
				if(item.itemType == "journalArticle" || item.itemType == "bookSection") {
					item.publicationTitle = value;
				} else {
					item.title = value;
				}
			} else if(key == "rft.date") {
				if(item.itemType == "patent") {
					item.issueDate = value;
				} else {
					item.date = value;
				}
			} else if(key == "rft.volume") {
				item.volume = value;
			} else if(key == "rft.issue") {
				item.issue = value;
			} else if(key == "rft.pages") {
				pagesKey = key;
				item.pages = value;
			} else if(key == "rft.spage") {
				if(pagesKey != "rft.pages") {
					// make pages look like start-end
					if(pagesKey == "rft.epage") {
						if(value != item.pages) {
							item.pages = value+"-"+item.pages;
						}
					} else {
						item.pages = value;
					}
					pagesKey = key;
				}
			} else if(key == "rft.epage") {
				if(pagesKey != "rft.pages") {
					// make pages look like start-end
					if(pagesKey == "rft.spage") {
						if(value != item.pages) {
							item.pages = item.pages+"-"+value;
						}
					} else {
						item.pages = value;
					}
					pagesKey = key;
				}
			} else if(key == "rft.issn" || (key == "rft.eissn" && !item.ISSN)) {
				item.ISSN = value;
			} else if(key == "rft.aulast" || key == "rft.invlast") {
				var lastCreator = complexAu[complexAu.length-1];
				if(complexAu.length && !lastCreator.lastName && !lastCreator.institutional) {
					lastCreator.lastName = value;
				} else {
					complexAu.push({lastName:value, creatorType:(key == "rft.aulast" ? "author" : "inventor")});
				}
			} else if(key == "rft.aufirst" || key == "rft.invfirst") {
				var lastCreator = complexAu[complexAu.length-1];
				if(complexAu.length && !lastCreator.firstName && !lastCreator.institutional) {
					lastCreator.firstName = value;
				} else {
					complexAu.push({firstName:value, creatorType:(key == "rft.aufirst" ? "author" : "inventor")});
				}
			} else if(key == "rft.au" || key == "rft.creator" || key == "rft.contributor" || key == "rft.inventor") {
				if(key == "rft.contributor") {
					var type = "contributor";
				} else if(key == "rft.inventor") {
					var type = "inventor";
				} else {
					var type = "author";
				}
				
				if(value.indexOf(",") !== -1) {
					item.creators.push(Zotero.Utilities.prototype.cleanAuthor(value, type, true));
				} else {
					item.creators.push(Zotero.Utilities.prototype.cleanAuthor(value, type, false));
				}
			} else if(key == "rft.aucorp") {
				complexAu.push({lastName:value, isInstitution:true});
			} else if(key == "rft.isbn" && !item.ISBN) {
				item.ISBN = value;
			} else if(key == "rft.pub" || key == "rft.publisher") {
				item.publisher = value;
			} else if(key == "rft.place") {
				item.place = value;
			} else if(key == "rft.edition") {
				item.edition = value;
			} else if(key == "rft.series") {
				item.series = value;
			} else if(item.itemType == "thesis") {
				if(key == "rft.inst") {
					item.publisher = value;
				} else if(key == "rft.degree") {
					item.type = value;
				}
			} else if(item.itemType == "patent") {
				if(key == "rft.assignee") {
					item.assignee = value;
				} else if(key == "rft.number") {
					item.patentNumber = value;
				} else if(key == "rft.appldate") {
					item.date = value;
				}
			} else if(format == "info:ofi/fmt:kev:mtx:dc") {
				if(key == "rft.identifier") {
					if(value.length > 8) {	// we could check length separately for
											// each type, but all of these identifiers
											// must be > 8 characters
						if(value.substr(0, 5) == "ISBN ") {
							item.ISBN = value.substr(5);
						} else if(value.substr(0, 5) == "ISSN ") {
							item.ISSN = value.substr(5);
						} else if(value.substr(0, 8) == "urn:doi:") {
							item.DOI = value.substr(4);
						} else if(value.substr(0, 7) == "http://" || value.substr(0, 8) == "https://") {
							item.url = value;
						}
					}
				} else if(key == "rft.description") {
					item.extra = value;
				} else if(key == "rft.rights") {
					item.rights = value;
				} else if(key == "rft.subject") {
					item.tags.push(value);
				} else if(key == "rft.type") {
					if(Zotero.ItemTypes.getID(value)) item.itemType = value;
				} else if(key == "rft.source") {
					item.publicationTitle = value;
				}
			}
		}
		
		// combine two lists of authors, eliminating duplicates
		for each(var au in complexAu) {
			var pushMe = true;
			for each(var pAu in item.creators) {
				// if there's a plain author that is close to this author (the
				// same last name, and the same first name up to a point), keep
				// the plain author, since it might have a middle initial
				if(pAu.lastName == au.lastName &&
				   (pAu.firstName == au.firstName == "" ||
				   (pAu.firstName.length >= au.firstName.length &&
				   pAu.firstName.substr(0, au.firstName.length) == au.firstName))) {
					pushMe = false;
					break;
				}
			}
			if(pushMe) item.creators.push(au);
		}
		
		return item;
	}
	
	/*
	 * Used to map tags for generating OpenURL contextObjects
	 */
	function _mapTag(data, tag, version) {
		if(data) {
			if(version == "0.1") {
				return "&"+tag+"="+encodeURIComponent(data);
			} else {
				return "&rft."+tag+"="+encodeURIComponent(data);
			}
		} else {
			return "";
		}
	}
}

Zotero.Ingester.MIMEHandler = new function() {
	var on = false;
	
	this.init = init;
	
	/*
	 * registers URIContentListener to handle MIME types
	 */
	function init() {
		var prefStatus = Zotero.Prefs.get("parseEndNoteMIMETypes");
		if(!on && prefStatus) {
			var uriLoader = Components.classes["@mozilla.org/uriloader;1"].
			                getService(Components.interfaces.nsIURILoader);
			uriLoader.registerContentListener(Zotero.Ingester.MIMEHandler.URIContentListener);
			on = true;
		} else if(on && !prefStatus) {
			var uriLoader = Components.classes["@mozilla.org/uriloader;1"].
			                getService(Components.interfaces.nsIURILoader);
			uriLoader.unRegisterContentListener(Zotero.Ingester.MIMEHandler.URIContentListener);
			on = false;			
		}
	}
}

/*
 * Zotero.Ingester.MIMEHandler.URIContentListener: implements
 * nsIURIContentListener interface to grab MIME types
 */
Zotero.Ingester.MIMEHandler.URIContentListener = new function() {
	// list of content types to capture
	// NOTE: must be from shortest to longest length
	this.desiredContentTypes = ["application/x-endnote-refer",
	                           "application/x-research-info-systems"];
	
	this.QueryInterface = QueryInterface;
	this.canHandleContent = canHandleContent;
	this.doContent = doContent;
	this.isPreferred = isPreferred;
	this.onStartURIOpen = onStartURIOpen;
	
	function QueryInterface(iid) {
		if(iid.equals(Components.interfaces.nsISupports)
		   || iid.equals(Components.interfaces.nsISupportsWeakReference)
		   || iid.equals(Components.interfaces.nsIURIContentListener)) {
			return this;
		}
		throw Components.results.NS_ERROR_NO_INTERFACE;
	}
	
	function canHandleContent(contentType, isContentPreferred, desiredContentType) {
		if(Zotero.inArray(contentType, this.desiredContentTypes)) {
			return true;
		}
		return false;
	}
	
	function doContent(contentType, isContentPreferred, request, contentHandler) {
		Zotero.debug("doing content for "+request.name);
		contentHandler.value = new Zotero.Ingester.MIMEHandler.StreamListener(request, contentType);
		return false;
	}
	
	function isPreferred(contentType, desiredContentType) {
		if(Zotero.inArray(contentType, this.desiredContentTypes)) {
			return true;
		}
		return false;
	}
	
	function onStartURIOpen(URI) {
		return true;
	}
}

/*
 * Zotero.Ingester.MIMEHandler.StreamListener: implements nsIStreamListener and
 * nsIRequestObserver interfaces to download MIME types we've grabbed
 */
Zotero.Ingester.MIMEHandler.StreamListener = function(request, contentType) {
	this._request = request;
	this._contentType = contentType
	this._readString = "";
	this._scriptableStream = null;
	this._scriptableStreamInput = null
	
	// get front window
	var windowWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
						getService(Components.interfaces.nsIWindowWatcher);
	this._frontWindow = windowWatcher.activeWindow;
	this._frontWindow.Zotero_Browser.progress.show();
	
	Zotero.debug("EndNote prepared to grab content type "+contentType);
}

Zotero.Ingester.MIMEHandler.StreamListener.prototype.QueryInterface = function(iid) {
	if(iid.equals(Components.interfaces.nsISupports)
	   || iid.equals(Components.interfaces.nsIRequestObserver)
	   || iid.equals(Components.interfaces.nsIStreamListener)) {
		return this;
	}
	throw Components.results.NS_ERROR_NO_INTERFACE;
}

Zotero.Ingester.MIMEHandler.StreamListener.prototype.onStartRequest = function(channel, context) {}

/*
 * called when there's data available; basicallly, we just want to collect this data
 */
Zotero.Ingester.MIMEHandler.StreamListener.prototype.onDataAvailable = function(request, context, inputStream, offset, count) {
	Zotero.debug(count+" bytes available");
	
	if(inputStream != this._scriptableStreamInput) {	// get storage stream
														// if there's not one
		this._scriptableStream = Components.classes["@mozilla.org/scriptableinputstream;1"].
					             createInstance(Components.interfaces.nsIScriptableInputStream);
		this._scriptableStream.init(inputStream);
		this._scriptableStreamInput = inputStream;
	}
	this._readString += this._scriptableStream.read(count);
}

/*
 * called when the request is done
 */
Zotero.Ingester.MIMEHandler.StreamListener.prototype.onStopRequest = function(channel, context, status) {
	Zotero.debug("request finished");
	var externalHelperAppService = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"].
	                               getService(Components.interfaces.nsIExternalHelperAppService);
	
	// attempt to import through Zotero.Translate
	var translation = new Zotero.Translate("import");
	translation.setLocation(this._request.name);
	translation.setString(this._readString);
	
	//  use front window's save functions and folder
	var frontWindow = this._frontWindow;
	
	var saveLocation = null;
	try {
		saveLocation = frontWindow.ZoteroPane.getSelectedCollection();
	} catch(e) {}
	translation.setHandler("itemDone", function(obj, item) { frontWindow.Zotero_Browser.itemDone(obj, item, saveLocation) });
	translation.setHandler("done", function(obj, item) { frontWindow.Zotero_Browser.finishScraping(obj, item, saveLocation) });
	
	// attempt to retrieve translators
	var translators = translation.getTranslators();
	if(!translators.length) {
		// we lied. we can't really translate this file. call
		// nsIExternalHelperAppService with the data
		frontWindow.Zotero_Browser.progress.close();

		var streamListener;
		if(streamListener = externalHelperAppService.doContent(this._contentType, this._request, frontWindow)) {
			// create a string input stream
			var inputStream = Components.classes["@mozilla.org/io/string-input-stream;1"].
							  createInstance(Components.interfaces.nsIStringInputStream);
			inputStream.setData(this._readString, this._readString.length);
			
			streamListener.onStartRequest(channel, context);
			streamListener.onDataAvailable(this._request, context, inputStream, 0, this._readString.length);
			streamListener.onStopRequest(channel, context, status);
		}
		return false;
	}
	
	// translate using first available
	translation.setTranslator(translators[0]);
	translation.translate();
}