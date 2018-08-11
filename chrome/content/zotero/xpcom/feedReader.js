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


/**
 * Sample feeds:
 * 
 * http://cyber.law.harvard.edu/rss/examples/rss2sample.xml
 * http://feeds.feedburner.com/acs/acbcct
 * http://www.cell.com/molecular-cell/current.rss
 * http://ieeexplore.ieee.org/search/searchresult.jsp?searchField%3DSearch_All%26queryText%3Dwater&searchOrigin=saved_searches&rssFeed=true&rssFeedName=water
 * http://www.sciencemag.org/rss/current.xml
 * http://rss.sciencedirect.com/publication/science/20925212
 * http://www.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?rss_guid=1fmfIeN4X5Q8HemTZD5Rj6iu6-FQVCn7xc7_IPIIQtS1XiD9bf
 * http://export.arxiv.org/rss/astro-ph
 * http://fhs.dukejournals.org/rss_feeds/recent.xml
 */

/**
 * class Zotero.FeedReader
 * Asynchronously reads an ATOM/RSS feed
 *
 * @param {String} url URL of the feed
 *
 * @property {Zotero.Promise<Object>} feedProperties An object
 *   representing feed properties
 * @property {Zotero.Promise<FeedItem>*} ItemIterator Returns an iterator
 *   for feed items. The iterator returns FeedItem promises that have to be
 *   resolved before requesting the next promise. When all items are exhausted.
 *   the promise resolves to null.
 * @method {void} terminate Stops retrieving/parsing the feed. Data parsed up
 *   to this point is still available.
 */
Zotero.FeedReader = function(url) {
	if (!url) throw new Error("Feed URL must be supplied");

	
	this._url = url;
	this._feedItems = [Zotero.Promise.defer()];
	this._feedProcessed = Zotero.Promise.defer();

	let feedFetched = Zotero.Promise.defer();
	feedFetched.promise.then(function(feed) {
		let info = {};
		
		info.title = feed.title ? feed.title.plainText() : '';
		info.subtitle = feed.subtitle ? feed.subtitle.plainText() : '';
		
		if (feed.updated) info.updated = new Date(feed.updated);
		
		// categories: MDN says "not yet implemented"
		
		info.creators = Zotero.FeedReader._processCreators(feed, 'authors', 'author');
		
		// TODO: image as icon
		
		let publicationTitle = Zotero.FeedReader._getFeedField(feed, 'publicationName', 'prism')
			|| Zotero.FeedReader._getFeedField(feed, 'pubTitle');
		if (publicationTitle) info.publicationTitle = publicationTitle;
		
		let publisher = Zotero.FeedReader._getFeedField(feed, 'publisher', 'dc');
		if (publisher) info.publisher = publisher;
		
		let rights = (feed.rights && feed.rights.plainText())
			|| Zotero.FeedReader._getFeedField(feed, 'copyright', 'prism')
			|| Zotero.FeedReader._getFeedField(feed, 'rights', 'dc')
			|| Zotero.FeedReader._getFeedField(feed, 'copyright');
		if (rights) info.rights = rights;
		
		let issn = Zotero.FeedReader._getFeedField(feed, 'issn', 'prism');
		if (issn) info.ISSN = issn;
		
		let isbn = Zotero.FeedReader._getFeedField(feed, 'isbn', 'prism')
			|| Zotero.FeedReader._getFeedField(feed, 'isbn')
		if (isbn) info.ISBN = isbn;
		
		let language = Zotero.FeedReader._getFeedField(feed, 'language', 'dc')
			|| Zotero.FeedReader._getFeedField(feed, 'language');
		if (language) info.language = language;
		
		let ttl = Zotero.FeedReader._getFeedField(feed, 'ttl');
		if (ttl) info.ttl = ttl;
		
		this._feedProperties = info;
		this._feed = feed;
	}.bind(this)).then(function(){
		let items = this._feed.items;
		if (items && items.length) {
			for (let i=0; i<items.length; i++) {
				let item = items.queryElementAt(i, Components.interfaces.nsIFeedEntry);
				if (!item) continue;
				
				let feedItem = Zotero.FeedReader._getFeedItem(item, this._feedProperties);
				if (!feedItem) continue;
				
				let lastItem = this._feedItems[this._feedItems.length - 1];
				this._feedItems.push(Zotero.Promise.defer()); // Push a new deferred promise so an iterator has something to return
				lastItem.resolve(feedItem);
			}
		}
		this._feedProcessed.resolve();
	}.bind(this)).catch(function(e) {
		Zotero.debug("Feed processing failed " + e.message);
		this._feedProcessed.reject(e);
	}.bind(this)).finally(function() {
		// Make sure the last promise gets resolved to null
		let lastItem = this._feedItems[this._feedItems.length - 1];
		lastItem.resolve(null);
	}.bind(this));
	
	// Set up asynchronous feed processor
	let feedProcessor = Components.classes["@mozilla.org/feed-processor;1"]
		.createInstance(Components.interfaces.nsIFeedProcessor);

	let feedUrl = Services.io.newURI(url, null, null);
	feedProcessor.parseAsync(null, feedUrl);
	
	feedProcessor.listener = {
		/*
		 * MDN suggests that we could use nsIFeedProgressListener to handle the feed
		 * as it gets loaded, but this is actually not implemented (as of 32.0.3),
		 * so we have to load the whole feed and handle it in handleResult.
		 */
		handleResult: (result) => {
			if (!result.doc) {
				this.terminate("No Feed");
				return;
			}
			
			let newFeed = result.doc.QueryInterface(Components.interfaces.nsIFeed);
			feedFetched.resolve(newFeed);
		}
	};
	
	Zotero.debug("FeedReader: Fetching feed from " + feedUrl.spec);
	
	this._channel = Services.io.newChannelFromURI2(feedUrl, null, 
		Services.scriptSecurityManager.getSystemPrincipal(), null, 
		Ci.nsILoadInfo.SEC_NORMAL, Ci.nsIContentPolicy.TYPE_OTHER);
	this._channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
	this._channel.asyncOpen(feedProcessor, null); // Sends an HTTP request
}

/*
 * The constructor initiates async feed processing, but _feedProcessed
 * needs to be resolved before proceeding.
 */
Zotero.FeedReader.prototype.process = Zotero.Promise.coroutine(function* () {
	return this._feedProcessed.promise;
});

/*
 * Terminate feed processing at any given time
 * @param {String} status Reason for terminating processing
 */
Zotero.FeedReader.prototype.terminate = function(status) {
	Zotero.debug("FeedReader: Terminating feed reader (" + status + ")");
	
	// Reject feed promise if not resolved yet
	if (this._feedProcessed.promise.isPending()) {
		this._feedProcessed.reject(new Error(status));
	}
	
	// Reject feed item promise if not resolved yet
	let lastItem = this._feedItems[this._feedItems.length - 1];
	if (lastItem.promise.isPending()) {
		// It seemed like a good idea to reject the last item but
		// it's not really been useful yet, aside from bluebird
		// throwing errors about unhandled rejections in tests
		// so we suppress them here. TODO: We should probably
		// rethink whether this code makes sense and make it better.
		let er = new Error(status);
		er.handledRejection = true;
		lastItem.reject(er);
	}
	
	// Close feed connection
	if (this._channel.isPending()) {
		this._channel.cancel(Components.results.NS_BINDING_ABORTED);
	}
};

Zotero.defineProperty(Zotero.FeedReader.prototype, 'feedProperties', {
	get: function(){ 
		if (!this._feedProperties) {
			throw new Error("Feed has not been resolved yet. Try calling FeedReader#process first")
		}
		return this._feedProperties
	}
});

/*
 * Feed item iterator
 * Each iteration returns a _promise_ for an item. The promise _MUST_ be
 * resolved before requesting the next item.
 * The last item will always be resolved to `null`, unless the feed processing
 * is terminated ahead of time, in which case it will be rejected with the reason
 * for termination.
 */
Zotero.defineProperty(Zotero.FeedReader.prototype, 'ItemIterator', {
	get: function() {
		let items = this._feedItems;
		let feedReader = this;
		
		let iterator = function() {
			if (!feedReader._feedProperties) {
				throw new Error("Feed has not been resolved yet. Try calling FeedReader#process first")
			}
			this.index = 0;
		};
		
		iterator.prototype.next = function() {
			let item = items[this.index++];
			return {
				value: item ? item.promise : null,
				done: this.index >= items.length
			};
		};
		
		iterator.prototype.last = function() {
			return items[items.length-1];
		}
		
		return iterator;
	}
}, {lazy: true});


/*****************************
 * Item processing functions *
 *****************************/
 	 
/**
 * Determine item type based on item data
 */
Zotero.FeedReader._guessItemType = function(item) {
	// Default to journalArticle
	item.itemType = 'journalArticle';
	
	if (item.ISSN) {
		return; // journalArticle
	}
	
	if (item.ISBN) {
		item.itemType = 'bookSection';
		return;
	}
	
	if (item.publicationType) {
		let type = item.publicationType.toLowerCase();
		if (type.indexOf('conference') != -1) {
			item.itemType = 'conferencePaper';
			return;
		}
		if (type.indexOf('journal') != -1) {
			item.itemType = 'journalArticle';
			return;
		}
		if (type.indexOf('book') != -1) {
			item.itemType = 'bookSection';
			return;
		}
	}
};

/*
 * Fetch creators from given field of a feed entry
 */
Zotero.FeedReader._processCreators = function(feedEntry, field, role) {
	let names = [],
		nameStr;
	try {
		let personArr = feedEntry[field]; // Seems like this part can throw if there is no author data in the feed
		for (let i=0; i<personArr.length; i++) {
			let person = personArr.queryElementAt(i, Components.interfaces.nsIFeedPerson);
			if (!person || !person.name) continue;
			
			let name = Zotero.Utilities.cleanTags(Zotero.Utilities.trimInternal(person.name));
			if (!name) continue;
			
			let commas = name.split(',').length - 1,
					other = name.split(/\s(?:and|&)\s|;/).length - 1,
					separators = commas + other;
			if (personArr.length == 1 &&
				// Has typical name separators
				(other || commas > 1
				// If only one comma and first part has more than one space,
				// it's probably not lastName, firstName
					|| (commas == 1 && name.split(/\s*,/)[0].indexOf(' ') != -1)
				)
			) {
				// Probably multiple authors listed in a single field
				nameStr = name;
				break; // For clarity. personArr.length == 1 anyway
			} else {
				names.push(name);
			}
		}
	} 
	catch(e) {
		if (e.result != Components.results.NS_ERROR_FAILURE) throw e;
		
		if (field != 'authors') return [];
		
		// ieeexplore places these in "authors"... sigh
		nameStr = Zotero.FeedReader._getFeedField(feedEntry, 'authors');
		if (nameStr) nameStr = Zotero.Utilities.trimInternal(nameStr);
		if (!nameStr) return [];
	}
	
	if (nameStr) {
		names = nameStr.split(/\s(?:and|&)\s|\s*[,;]\s*/);
	}
	
	let creators = [];
	for (let i=0; i<names.length; i++) {
		let creator = Zotero.Utilities.cleanAuthor(
			names[i],
			role,
			names[i].split(',').length == 2
		);
		if (!creator.firstName) {
			creator.fieldMode = 1;
		}
		// Sometimes these end up empty when parsing really nasty HTML based fields, so just skip.
		if (!creator.firstName && !creator.lastName) {
			continue;
		}
		
		creators.push(creator);
	}
	return creators;
}

/*
 * Parse feed entry into a Zotero item
 */
Zotero.FeedReader._getFeedItem = function(feedEntry, feedInfo) {
	// ID is not required, but most feeds have these and we have to rely on them
	// to handle updating properly
	// Can probably fall back to links on missing id - unlikely to change
	if (!feedEntry.id && !feedEntry.link) {
		Zotero.debug("FeedReader: Feed item missing an ID or link - discarding");
		return;
	}
	
	let item = {
		guid: feedEntry.id || feedEntry.link.spec
	};
			
	if (feedEntry.title) item.title = Zotero.FeedReader._getRichText(feedEntry.title, 'title');
	
	if (feedEntry.summary) {
		item.abstractNote = Zotero.FeedReader._getRichText(feedEntry.summary, 'abstractNote');
		
		if (!item.title) {
			// We will probably have to trim this, so let's use plain text to
			// avoid splitting inside some markup
			let title = Zotero.Utilities.trimInternal(feedEntry.summary.plainText());
			let splitAt = title.lastIndexOf(' ', 50);
			if (splitAt == -1) splitAt = 50;
			
			item.title = title.substr(0, splitAt);
			if (splitAt <= title.length) item.title += '...';
		}
	}
	
	if (feedEntry.link) item.url = feedEntry.link.spec;
	
	if (feedEntry.rights) item.rights = Zotero.FeedReader._getRichText(feedEntry.rights, 'rights');
	
	item.creators = Zotero.FeedReader._processCreators(feedEntry, 'authors', 'author');
	if (!item.creators.length) {
		// Use feed authors as item author. Maybe not the best idea.
		for (let i=0; i<feedInfo.creators.length; i++) {
			if (feedInfo.creators[i].creatorType != 'author') continue;
			item.creators.push(feedInfo.creators[i]);
		}
	}
	
	let contributors = Zotero.FeedReader._processCreators(feedEntry, 'contributors', 'contributor');
	if (contributors.length) item.creators = item.creators.concat(contributors);
	
	/** Done with basic metadata, now look for better data **/
	
	let date = Zotero.FeedReader._getFeedField(feedEntry, 'publicationDate', 'prism')
		|| Zotero.FeedReader._getFeedField(feedEntry, 'date', 'dc')
		// DEBUG: Why not get these from the feedEntry?
		|| Zotero.FeedReader._getFeedField(feedEntry, 'pubDate') // RSS
		|| Zotero.FeedReader._getFeedField(feedEntry, 'updated', 'atom') // Atom
		|| Zotero.FeedReader._getFeedField(feedEntry, 'published', 'atom'); // Atom
		
	
	if (date) item.date = date;
	
	let publicationTitle = Zotero.FeedReader._getFeedField(feedEntry, 'publicationName', 'prism')
		|| Zotero.FeedReader._getFeedField(feedEntry, 'source', 'dc')
		|| Zotero.FeedReader._getFeedField(feedEntry, 'pubTitle');
	if (publicationTitle) item.publicationTitle = publicationTitle;
	
	let publicationType = Zotero.FeedReader._getFeedField(feedEntry, 'pubType');
	if (publicationType) item.publicationType = publicationType;
	
	let startPage = Zotero.FeedReader._getFeedField(feedEntry, 'startPage');
	let endPage = Zotero.FeedReader._getFeedField(feedEntry, 'endPage');
	if (startPage || endPage) {
		item.pages = ( startPage || '' )
			+ ( endPage && startPage ? '–' : '' )
			+ ( endPage || '' );
	}
	
	let issn = Zotero.FeedReader._getFeedField(feedEntry, 'issn', 'prism');
	if (issn) item.ISSN = issn;
	
	let isbn = Zotero.FeedReader._getFeedField(feedEntry, 'isbn', 'prism')
		|| Zotero.FeedReader._getFeedField(feedEntry, 'isbn')
	if (isbn) item.ISBN = isbn;
	
	let identifier = Zotero.FeedReader._getFeedField(feedEntry, 'identifier', 'dc');
	if (identifier) {
		let cleanId = Zotero.Utilities.cleanDOI(identifier);
		if (cleanId) {
			if (!item.DOI) item.DOI = cleanId;
		} else if (cleanId = Zotero.Utilities.cleanISBN(identifier)) {
			if (!item.ISBN) item.ISBN = cleanId;
		} else if (cleanId = Zotero.Utilities.cleanISSN(identifier)) {
			if (!item.ISSN) item.ISSN = cleanId;
		}
	}
	
	let publisher = Zotero.FeedReader._getFeedField(feedEntry, 'publisher', 'dc');
	if (publisher) item.publisher = publisher;
	
	let rights = Zotero.FeedReader._getFeedField(feedEntry, 'copyright', 'prism')
		|| Zotero.FeedReader._getFeedField(feedEntry, 'rights', 'dc')
		|| Zotero.FeedReader._getFeedField(feedEntry, 'copyright');
	if (rights) item.rights = rights;
	
	let language = Zotero.FeedReader._getFeedField(feedEntry, 'language', 'dc')
		|| Zotero.FeedReader._getFeedField(feedEntry, 'language');
	if (language) item.language = language;
	
	/** Incorporate missing values from feed metadata **/
	
	let supplementFields = ['publicationTitle', 'ISSN', 'publisher', 'rights', 'language'];
	for (let i=0; i<supplementFields.length; i++) {
		let field = supplementFields[i];
		if (!item[field] && feedInfo[field]) {
			item[field] = feedInfo[field];
		}
	}
	
	Zotero.FeedReader._guessItemType(item);
	
	item.enclosedItems = Zotero.FeedReader._getEnclosedItems(feedEntry);
	
	return item;
}

/*********************
 * Utility functions *
 *********************/
/*
 * Convert HTML-formatted text to Zotero-compatible formatting
 */
Zotero.FeedReader._getRichText = function(feedText, field) {
	let domDiv = Zotero.Utilities.Internal.getDOMDocument().createElement("div");
	let domFragment = feedText.createDocumentFragment(domDiv);
	return Zotero.Utilities.dom2text(domFragment, field);
};

/*
 * Get field value from feed entry by namespace:fieldName
 */
// Properties are stored internally as ns+name, but only some namespaces are
// supported. Others are just "null"
let ns = {
	'prism': 'null',
	'dc': 'dc:'
}
Zotero.FeedReader._getFeedField = function(feedEntry, field, namespace) {
	let prefix = namespace ? ns[namespace] || 'null' : '';
	try {
		return feedEntry.fields.getPropertyAsAUTF8String(prefix+field);
	} catch(e) {}
	
	try {
		if (namespace && !ns[namespace]) {
			prefix = namespace + ':';
			return feedEntry.fields.getPropertyAsAUTF8String(prefix+field);
		}
	} catch(e) {}
	
	return;
}

Zotero.FeedReader._getEnclosedItems = function(feedEntry) {
	var enclosedItems = [];
	
	if (feedEntry.enclosures) {
		for (let i = 0; i < feedEntry.enclosures.length; i++) {
			let elem = feedEntry.enclosures.queryElementAt(0, Components.interfaces.nsIPropertyBag2);
			if (elem.get('url')) {
				let enclosedItem = {url: elem.get('url'), contentType: elem.get('type') || ''};
				enclosedItems.push(enclosedItem);
			}
		}
	}
	
	return enclosedItems;
}
