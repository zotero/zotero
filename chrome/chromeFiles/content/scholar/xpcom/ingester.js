// Scholar for Firefox Ingester
// Utilities based on code taken from Piggy Bank 2.1.1 (BSD-licensed)
// This code is licensed according to the GPL

Scholar.Ingester = new Object();

/////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.ProxyMonitor
//
/////////////////////////////////////////////////////////////////

// A singleton for recognizing EZProxies and converting URLs such that databases
// will work from outside them. Unfortunately, this only works with the ($495)
// EZProxy software. If there are open source alternatives, we should support
// them too.

/*
 * Precompile proxy regexps
 */
Scholar.Ingester.ProxyMonitor = new function() {
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
			if(channel.getResponseHeader("Server") == "EZproxy") {
				// We're connected to an EZproxy
				if(channel.responseStatus != "302") {
					return;
				}
				
				Scholar.debug(channel.URI.spec);
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
				
				if(channel.URI.host == newURI.host && channel.URI.port != newURI.port) {
					// Different ports but the same server means EZproxy active
					
					Scholar.debug("EZProxy: host "+newURI.hostPort+" is really "+properURI.hostPort);
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
				Scholar.debug("EZProxy: proper url is "+url);
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
				Scholar.debug("EZProxy: proxied url is "+url);
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

Scholar.OpenURL = new function() {
	this.resolve = resolve;
	this.discoverResolvers = discoverResolvers;
	this.createContextObject = createContextObject;
	this.parseContextObject = parseContextObject;
	
	/*
	 * Returns a URL to look up an item in the OpenURL resolver
	 */
	function resolve(itemObject) {
		var co = createContextObject(itemObject, Scholar.Prefs.get("openURL.version"));
		if(co) {
			return Scholar.Prefs.get("openURL.resolver")+"?"+co;
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
			
			resolverArray[name] = [url, version];
		}
		
		return resolverArray;
	}
	
	/*
	 * Generates an OpenURL ContextObject from an item
	 */
	function createContextObject(itemObject, version) {
		var item = itemObject.toArray();
		
		var identifiers = new Array();
		if(item.DOI) {
			identifiers.push(item.DOI);
		}
		if(item.ISBN) {
			identifiers.push("urn:isbn:");
		}
		
		// encode ctx_ver (if available) and identifiers
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
			co += _mapTag(item.title, "atitle", version)		
			co += _mapTag(item.publicationTitle, (version == "0.1" ? "title" : "jtitle"), version)		
			co += _mapTag(item.journalAbbreviation, "stitle", version);
			co += _mapTag(item.volume, "volume", version);
			co += _mapTag(item.issue, "issue", version);
		} else if(item.itemType == "book" || item.itemType == "bookitem") {
			if(version == "0.1") {
				co += "&genre=book";
			} else {
				co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&rft.genre=book";
			}
			
			if(item.itemType == "book") {
				co += "&rft.genre=book";
				co += _mapTag(item.title, (version == "0.1" ? "title" : "btitle"), version);
			} else {
				co += "&rft.genre=bookitem";
				co += _mapTag(item.title, "atitle", version)		
				co += _mapTag(item.publicationTitle, (version == "0.1" ? "title" : "btitle"), version);
			}
			
			co += _mapTag(item.place, "place", version);
			co += _mapTag(item.publisher, "publisher", version)		
			co += _mapTag(item.edition, "edition", version);
			co += _mapTag(item.seriesTitle, "series", version);
		} else if(item.itemType == "thesis" && version == "1.0") {
			co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Adissertation";
			
			_mapTag(item.title, "title", version);
			_mapTag(item.publisher, "inst", version);
			_mapTag(item.thesisType, "degree", version);
		} else {
			return false;
		}
		
		// encode fields on all items
		for each(creator in item.creators) {
			if(creator.firstName) {
				co += _mapTag(creator.firstName, "aufirst", version);
				co += _mapTag(creator.lastName, "aulast", version);
			} else {
				co += _mapTag(creator.lastName, "aucorp", version);
			}
		}
		
		if(item.date) {
			co += _mapTag(item.date, "date", version);
		} else {
			co += _mapTag(item.year, "date", version);
		}
		co += _mapTag(item.pages, "pages", version);
		co += _mapTag(item.ISBN, "ISBN", version);
		co += _mapTag(item.ISSN, "ISSN", version);
		
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
		var coParts = co.split("&");
		
		if(!item) {
			var item = new Array();
			item.creators = new Array();
		}
		
		// get type
		item.itemType = _determineResourceType(coParts);
		if(!item.itemType) {
			return false;
		}
		
		var pagesKey = "";
		
		for each(part in coParts) {
			var keyVal = part.split("=");
			var key = keyVal[0];
			var value = unescape(keyVal[1].replace(/\+|%2[bB]/g, " "));
			if(!value) {
				continue;
			}
			
			if(key == "rft_id") {
				var firstEight = value.substr(0, 8).toLowerCase();
				if(firstEight == "info:doi") {
					item.DOI = value;
				} else if(firstEight == "urn:isbn") {
					item.ISBN = value.substr(9);
				}
			} else if(key == "rft.btitle") {
				if(item.itemType == "book") {
					item.title = value;
				} else if(item.itemType == "bookSection") {
					item.publicationTitle = value;
				}
			} else if(key == "rft.atitle" && item.itemType != "book") {
				item.title = value;
			} else if(key == "rft.jtitle" && item.itemType == "journal") {
				item.publcation = value;
			} else if(key == "rft.stitle" && item.itemType == "journal") {
				item.journalAbbreviation = value;
			} else if(key == "rft.date") {
				item.date = value;
			} else if(key == "rft.volume") {
				item.volume = value;
			} else if(key == "rft.issue") {
				item.issue = value;
			} else if(key == "rft.pages") {
				pagesKey = key;
				item.pages = value;
			} else if(key == "rft.spage") {
				if(pagesKey != "rft.pages") {
					pagesKey = key;
					// make pages look like start-end
					if(pagesKey == "rft.epage") {
						if(value != item.pages) {
							item.pages = value+"-"+item.pages;
						}
					} else {
						item.pages = value;
					}
				}
			} else if(key == "rft.epage") {
				if(pagesKey != "rft.pages") {
					pagesKey = key;
					// make pages look like start-end
					if(pagesKey == "rft.spage") {
						if(value != item.pages) {
							item.pages = +item.pages+"-"+value;
						}
					} else {
						item.pages = value;
					}
				}
			} else if(key == "issn" || (key == "eissn" && !item.ISSN)) {
				item.ISSN = value;
			} else if(key == "rft.aulast") {
				var lastCreator = item.creators[item.creators.length-1];
				if(item.creators.length && !lastCreator.lastName && !lastCreator.institutional) {
					lastCreator.lastName = value;
				} else {
					item.creators.push({lastName:value});
				}
			} else if(key == "rft.aufirst") {
				var lastCreator = item.creators[item.creators.length-1];
				if(item.creators.length && !lastCreator.firstName && !lastCreator.institutional) {
					lastCreator.firstName = value;
				} else {
					item.creators.push({firstName:value});
				}
			} else if(key == "rft.au") {
				item.creators.push(Scholar.cleanAuthor(value, "author", true));
			} else if(key == "rft.aucorp") {
				item.creators.push({lastName:value, institutional:true});
			} else if(key == "rft.isbn" && !item.ISBN) {
				item.ISBN = value;
			} else if(key == "rft.pub") {
				item.publisher = value;
			} else if(key == "rft.place") {
				item.place = value;
			} else if(key == "rft.edition") {
				item.edition = value;
			} else if(key == "rft.series") {
				item.seriesTitle = value;
			}
		}
		
		return item;
	}
	
	/*
	 * Determines the type of an OpenURL contextObject
	 */
	function _determineResourceType(coParts) {
		// determine resource type
		var type = false;
		for(var i in coParts) {
			if(coParts[i].substr(0, 12) == "rft_val_fmt=") {
				var format = unescape(coParts[i].substr(12));
				if(format == "info:ofi/fmt:kev:mtx:journal") {
					var type = "journal";
				} else if(format == "info:ofi/fmt:kev:mtx:book") {
					if(Scholar.inArray("rft.genre=bookitem", coParts)) {
						var type = "bookSection";
					} else {
						var type = "book";
					}
					break;
				}
			}
		}
		return type;
	}
	
	/*
	 * Used to map tags for generating OpenURL contextObjects
	 */
	function _mapTag(data, tag, version) {
		if(data) {
			if(version == "0.1") {
				return "&"+tag+"="+escape(data);
			} else {
				return "&rft."+tag+"="+escape(data);
			}
		} else {
			return "";
		}
	}
}

Scholar.Ingester.MIMEHandler = new function() {
	var on = false;
	
	this.init = init;
	
	/*
	 * registers URIContentListener to handle MIME types
	 */
	function init() {
		var prefStatus = Scholar.Prefs.get("parseEndNoteMIMETypes");
		if(!on && prefStatus) {
			var uriLoader = Components.classes["@mozilla.org/uriloader;1"].
			                getService(Components.interfaces.nsIURILoader);
			uriLoader.registerContentListener(Scholar.Ingester.MIMEHandler.URIContentListener);
			on = true;
		} else if(on && !prefStatus) {
			var uriLoader = Components.classes["@mozilla.org/uriloader;1"].
			                getService(Components.interfaces.nsIURILoader);
			uriLoader.unRegisterContentListener(Scholar.Ingester.MIMEHandler.URIContentListener);
			on = false;			
		}
	}
}

/*
 * Scholar.Ingester.MIMEHandler.URIContentListener: implements
 * nsIURIContentListener interface to grab MIME types
 */
Scholar.Ingester.MIMEHandler.URIContentListener = new function() {
	var _desiredContentTypes = ["application/x-endnote-refer", "application/x-research-info-systems"];
	
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
		if(Scholar.inArray(contentType, _desiredContentTypes)) {
			return true;
		}
		return false;
	}
	
	function doContent(contentType, isContentPreferred, request, contentHandler) {
		Scholar.debug("doing content for "+request.name);
		contentHandler.value = new Scholar.Ingester.MIMEHandler.StreamListener(request, contentType);
		return false;
	}
	
	function isPreferred(contentType, desiredContentType) {
		if(Scholar.inArray(contentType, _desiredContentTypes)) {
			return true;
		}
		return false;
	}
	
	function onStartURIOpen(URI) {
		return true;
	}
}

/*
 * Scholar.Ingester.MIMEHandler.StreamListener: implements nsIStreamListener and
 * nsIRequestObserver interfaces to download MIME types we've grabbed
 */
Scholar.Ingester.MIMEHandler.StreamListener = function(request, contentType) {
	this._request = request;
	this._contentType = contentType
	this._readString = "";
	this._scriptableStream = null;
	this._scriptableStreamInput = null
	
	// get front window
	var windowWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
						getService(Components.interfaces.nsIWindowWatcher);
	this._frontWindow = windowWatcher.activeWindow;
	this._frontWindow.Scholar_Ingester_Interface.Progress.show();
}

Scholar.Ingester.MIMEHandler.StreamListener.prototype.QueryInterface = function(iid) {
	if(iid.equals(Components.interfaces.nsISupports)
	   || iid.equals(Components.interfaces.nsIRequestObserver)
	   || iid.equals(Components.interfaces.nsIStreamListener)) {
		return this;
	}
	throw Components.results.NS_ERROR_NO_INTERFACE;
}

Scholar.Ingester.MIMEHandler.StreamListener.prototype.onStartRequest = function(channel, context) {}

/*
 * called when there's data available; basicallly, we just want to collect this data
 */
Scholar.Ingester.MIMEHandler.StreamListener.prototype.onDataAvailable = function(request, context, inputStream, offset, count) {
	Scholar.debug(count+" bytes available");
	
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
Scholar.Ingester.MIMEHandler.StreamListener.prototype.onStopRequest = function(channel, context, status) {
	Scholar.debug("request finished");
	var externalHelperAppService = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"].
	                               getService(Components.interfaces.nsIExternalHelperAppService);
	
	// attempt to import through Scholar.Translate
	var translation = new Scholar.Translate("import");
	translation.setLocation(this._request.name);
	translation.setString(this._readString);
	translation.setHandler("itemDone", this._frontWindow.Scholar_Ingester_Interface._itemDone);
	translation.setHandler("done", this._frontWindow.Scholar_Ingester_Interface._finishScraping);
	
	// attempt to retrieve translators
	var translators = translation.getTranslators();
	if(!translators.length) {
		// we lied. we can't really translate this file. call
		// nsIExternalHelperAppService with the data
		this._frontWindow.Scholar_Ingester_Interface.Progress.kill();

		var streamListener;
		if(streamListener = externalHelperAppService.doContent(this._contentType, this._request, this._frontWindow)) {
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