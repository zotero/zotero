/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
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

//////////////////////////////////////////////////////////////////////////////
//
// Zotero_Feed_Settings
//
//////////////////////////////////////////////////////////////////////////////

var Zotero_Feed_Settings = new function() {
	let urlIsValid = true,
		data = null,
		feedReader = null,
		urlTainted = false;
	
	let cleanURL = function(url) {
		url = url.trim();
		if (!url) return;
		
		let ios = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		
		let cleanUrl;
		try {
			let uri = ios.newURI(url, null, null);
			if (uri.scheme != 'http' && uri.scheme != 'https') {
				Zotero.debug(uri.scheme + " is not a supported protocol for feeds.");
			}
			
			cleanUrl = uri.spec;
		} catch (e) {
			if (e.result == Components.results.NS_ERROR_MALFORMED_URI) {
				// Assume it's a URL missing "http://" part
				try {
					cleanUrl = ios.newURI('http://' + url, null, null).spec;
				} catch (e) {}
			}
			throw e;
		}
		
		if (!cleanUrl) return;
		
		if (/^https?:\/\/[^\/\s]+\/\S/.test(cleanUrl)) return cleanUrl;
	};
	
	this.init = function() {
		this.toggleAdvancedOptions(false);
		
		data = window.arguments[0];
		
		if (data.url) {
			document.getElementById('feed-url').value = data.url;
		}
		
		if (!data.url) {
			this.invalidateUrl();
		} else {
			// Do not allow to change URL for existing feed
			document.getElementById('feed-url').readOnly = true;
		}
		
		if (data.title) {
			document.getElementById('feed-title').value = data.title;
		}
		
		let ttl;
		if (data.ttl !== undefined) {
			ttl = Math.floor(data.ttl / 60);
		} else {
			ttl = 1;
		}
		document.getElementById('feed-ttl').value = ttl;
		
		let cleanupAfter = data.cleanupAfter;
		if (cleanupAfter === undefined) cleanupAfter = 2;
		document.getElementById('feed-cleanupAfter').value = cleanupAfter;
		
		if (data.url && !data.urlIsValid) {
			this.validateUrl();
		}
	};
	
	this.invalidateUrl = function() {
		urlTainted = true;
		if (feedReader) {
			feedReader.terminate();
			feedReader = null;
		}
		
		if (!urlIsValid) return;
		
		urlIsValid = false;
		document.getElementById('feed-title').disabled = true;
		document.getElementById('feed-ttl').disabled = true;
		document.getElementById('feed-cleanupAfter').disabled = true;
		document.documentElement.getButton('accept').disabled = true;
	};
	
	this.validateUrl = Zotero.Promise.coroutine(function* () {
		if (feedReader) {
			feedReader.terminate();
			feedReader = null;
		}
		
		let url = cleanURL(document.getElementById('feed-url').value);
		urlTainted = false;
		if (!url) return;
		
		try {
			let fr = feedReader = new Zotero.FeedReader(url);
			yield fr.process();
			let feed = fr.feedProperties;
			// Prevent progress if textbox changes triggered another call to
			// validateUrl / invalidateUrl (old session)
			if (feedReader !== fr || urlTainted) return;
			
			let title = document.getElementById('feed-title');
			if (!data.url && feed.title) {
				title.value = feed.title;
			}
			
			let ttl = document.getElementById('feed-ttl');
			if (!data.url && feed.ttl) {
				ttl.value = Math.floor(feed.ttl / 60) || 1;
			}
			
			document.getElementById('feed-url').value = url;
			
			urlIsValid = true;
			title.disabled = false;
			ttl.disabled = false;
			document.getElementById('feed-cleanupAfter').disabled = false;
			document.documentElement.getButton('accept').disabled = false;
		}
		catch (e) {
			Zotero.debug(e);
		}
		finally {
			if (feedReader === fr) feedReader = null;
		}
	});
	
	this.accept = function() {
		data.url = document.getElementById('feed-url').value;
		data.title = document.getElementById('feed-title').value;
		data.ttl = document.getElementById('feed-ttl').value * 60;
		data.cleanupAfter = document.getElementById('feed-cleanupAfter').value * 1;
		return true;
	};
	
	this.cancel = function() {
		data.cancelled = true;
		return true;
	};
	
	/*
	 * Show/hide advanced options
	 * @param {Boolean} [show] If set, indicates whether the advanced
	 *   options should be shown or not. If omitted, the options toggle
	 */
	this.toggleAdvancedOptions = function(show) {
		var opts = document.getElementById("advanced-options-togglable");
		opts.hidden = show !== undefined ? !show : !opts.hidden;
		document.getElementById("advanced-options")
			.setAttribute("state", opts.hidden ? "closed" : "open");
		window.sizeToContent();
	};
}