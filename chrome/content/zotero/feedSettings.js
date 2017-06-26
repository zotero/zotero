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
		let cleanURL = Zotero.Utilities.cleanURL(url, true);

		if (cleanURL) {
			if (/^https?:\/\/[^\/\s]+\/\S/.test(cleanURL)) {
				return cleanURL;
			} else {
				Zotero.debug(url + " has an unsupported protocol for feeds");
			}
		}
	};
	
	this.init = Zotero.Promise.coroutine(function* () {
		this.toggleAdvancedOptions(false);
		
		data = window.arguments[0];
		
		if (data.url) {
			document.getElementById('feed-url').value = data.url;
			// Do not allow to change URL for existing feed
			document.getElementById('feed-url').readOnly = true;
		} else {
			this.invalidateURL();
		}
		
		if (data.title) {
			document.getElementById('feed-title').value = data.title;
		}
		
		let ttl;
		if (data.ttl !== undefined) {
			ttl = Math.floor(data.ttl / 60);
		} else {
			ttl = Zotero.Prefs.get('feeds.defaultTTL');
		}
		document.getElementById('feed-ttl').value = ttl;
		
		let cleanupReadAfter = data.cleanupReadAfter;
		if (cleanupReadAfter === undefined) cleanupReadAfter = Zotero.Prefs.get('feeds.defaultCleanupReadAfter');
		document.getElementById('feed-cleanupReadAfter').value = cleanupReadAfter;
		
		let cleanupUnreadAfter = data.cleanupUnreadAfter;
		if (cleanupUnreadAfter === undefined) cleanupUnreadAfter = Zotero.Prefs.get('feeds.defaultCleanupUnreadAfter');
		document.getElementById('feed-cleanupUnreadAfter').value = cleanupUnreadAfter;
		
		if (data.url && !data.urlIsValid) {
			yield this.validateURL();
		}
	});
	
	this.invalidateURL = function() {
		urlTainted = true;
		if (feedReader) {
			feedReader.terminate();
			feedReader = null;
		}
		
		if (!urlIsValid) return;
		
		urlIsValid = false;
		document.getElementById('feed-title').disabled = true;
		document.getElementById('feed-ttl').disabled = true;
		document.getElementById('feed-cleanupReadAfter').disabled = true;
		document.getElementById('feed-cleanupUnreadAfter').disabled = true;
		document.documentElement.getButton('accept').disabled = true;
	};
	
	this.validateURL = Zotero.Promise.coroutine(function* () {
		if (feedReader) {
			feedReader.terminate();
			feedReader = null;
		}
		
		let url = cleanURL(document.getElementById('feed-url').value);
		urlTainted = false;
		if (!url) return;
		
		try {
			var fr = feedReader = new Zotero.FeedReader(url);
			yield fr.process();
			let feed = fr.feedProperties;
			// Prevent progress if textbox changes triggered another call to
			// validateURL / invalidateURL (old session)
			if (feedReader !== fr || urlTainted) return;
			
			let title = document.getElementById('feed-title');
			if (feed.title && (!data.url || data.unsaved)) {
				title.value = feed.title;
			}
			
			let ttl = document.getElementById('feed-ttl');
			if (feed.ttl && (!data.url || data.unsaved)) {
				ttl.value = Math.floor(feed.ttl / 60) || 1;
			}
			
			document.getElementById('feed-url').value = url;
			
			urlIsValid = true;
			title.disabled = false;
			ttl.disabled = false;
			document.getElementById('feed-cleanupReadAfter').disabled = false;
			document.getElementById('feed-cleanupUnreadAfter').disabled = false;
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
		data.cleanupReadAfter = document.getElementById('feed-cleanupReadAfter').value * 1;
		data.cleanupUnreadAfter = document.getElementById('feed-cleanupUnreadAfter').value * 1;
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