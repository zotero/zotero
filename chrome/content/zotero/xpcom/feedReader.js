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
 */

/**
 * class Zotero.FeedReader
 * Asynchronously reads an ATOM/RSS feed
 *
 * @param {String} url URL of the feed
 *
 * @property {Zotero.Promise<Object>} feedProperties An object
 *   representing feed properties
 * @property {Zotero.Promise<FeedItem>*} itemIterator Returns an iterator
 *   for feed items. The iterator returns FeedItem promises that have to be
 *   resolved before requesting the next promise. When all items are exhausted.
 *   the promise resolves to null.
 * @method {void} terminate Stops retrieving/parsing the feed. Data parsed up
 *   to this point is still available.
 */
Zotero.FeedReader = new function() {
	let ios = Components.classes["@mozilla.org/network/io-service;1"]
		.getService(Components.interfaces.nsIIOService);
	
	/*****************************
	 * Item processing functions *
	 *****************************/
	 
	 /**
	  * Determine item type based on item data
	  */
	function guessItemType(item) {
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
	function processCreators(feedEntry, field, role) {
		let names = [],
			nameStr;
		try {
			let personArr = feedEntry[field]; // Seems like this part can throw if there is no author data in the feed
			for (let i=0; i<personArr.length; i++) {
				let person = personArr.queryElementAt(i, Components.interfaces.nsIFeedPerson);
				if (!person || !person.name) continue;
				
				let name = Zotero.Utilities.trimInternal(person.name);
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
		} catch(e) {
			if (e.result != Components.results.NS_ERROR_FAILURE) throw e
			
			if (field != 'authors') return [];
			
			// ieeexplore places these in "authors"... sigh
			nameStr = getFeedField(feedEntry, null, 'authors');
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
			
			creators.push(creator);
		}
		return creators;
	}
	
	/*********************
	 * Utility functions *
	 *********************/
	/*
	 * Convert HTML-formatted text to Zotero-compatible formatting
	 */
	let domDiv = Zotero.Utilities.Internal.getDOMDocument().createElement("div");
	function getRichText(feedText, field) {
		let domFragment = feedText.createDocumentFragment(domDiv);
		return Zotero.Utilities.dom2text(domFragment, field);
	}
	
	/*
	 * Format JS date as SQL date + time zone offset
	 */
	function formatDate(date) {
		let offset = (date.getTimezoneOffset() / 60) * -1;
		let absOffset = Math.abs(offset);
		offset = offset
			? ' ' + (offset < 0 ? '-' : '+')
				+ Zotero.Utilities.lpad(Math.floor(absOffset), '0', 2)
				+ ('' + ( (absOffset - Math.floor(absOffset)) || '' )).substr(1) // Get ".5" fraction or "" otherwise
			: '';
		return Zotero.Date.dateToSQL(date, false) + offset;
	}
	
	/*
	 * Get field value from feed entry by namespace:fieldName
	 */
	// Properties are stored internally as ns+name, but only some namespaces are
	// supported. Others are just "null"
	let ns = {
		'prism': 'null',
		'dc': 'dc:'
	}
	function getFeedField(feedEntry, namespace, field) {
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
	
	/*
	 * Parse feed entry into a Zotero item
	 */
	function getFeedItem(feedEntry, feedInfo) {
		// ID is not required, but most feeds have these and we have to rely on them
		// to handle updating properly
		if (!feedEntry.id) {
			Zotero.debug("FeedReader: Feed item missing an ID");
			return;
		}
		
		let item = {
			guid: feedEntry.id
		};
				
		if (feedEntry.title) item.title = getRichText(feedEntry.title, 'title');
		
		if (feedEntry.summary) {
			item.abstractNote = getRichText(feedEntry.summary, 'abstractNote');
			
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
		
		if (feedEntry.updated) item.dateModified = new Date(feedEntry.updated);
		
		if (feedEntry.published) {
			let date = new Date(feedEntry.published);
			
			if (!date.getUTCSeconds() && !(date.getUTCHours() && date.getUTCMinutes())) {
				// There was probably no time, but there may have been a a date range,
				// so something could have ended up in the hour _or_ minute field
				item.date = getFeedField(feedEntry, null, 'pubDate')
					/* In case it was magically pulled from some other field */
					|| ( date.getUTCFullYear() + '-'
						+ (date.getUTCMonth() + 1) + '-'
						+  date.getUTCDate() );
			} else {
				item.date = formatDate(date);
				// Add time zone
			}
			
			if (!item.dateModified) {
				items.dateModified = date;
			}
		}
		
		if (!item.dateModified) {
			// When there's no reliable modification date, we can assume that item doesn't get updated
			Zotero.debug("FeedReader: Feed item missing a modification date (" + item.guid + ")");
			item.dateModified = null;
		}
		
		if (!item.date && item.dateModified) {
			// Use lastModified date
			item.date = formatDate(item.dateModified);
		}
		
		// Convert date modified to string, since those are directly comparable
		if (item.dateModified) item.dateModified = Zotero.Date.dateToSQL(item.dateModified, true);
		
		if (feedEntry.rights) item.rights = getRichText(feedEntry.rights, 'rights');
		
		item.creators = processCreators(feedEntry, 'authors', 'author');
		if (!item.creators.length) {
			// Use feed authors as item author. Maybe not the best idea.
			for (let i=0; i<feedInfo.creators.length; i++) {
				if (feedInfo.creators[i].creatorType != 'author') continue;
				item.creators.push(feedInfo.creators[i]);
			}
		}
		
		let contributors = processCreators(feedEntry, 'contributors', 'contributor');
		if (contributors.length) item.creators = item.creators.concat(contributors);
		
		/** Done with basic metadata, now look for better data **/
		
		let date = getFeedField(feedEntry, 'prism', 'publicationDate')
			|| getFeedField(feedEntry, 'dc', 'date');
		if (date) item.date = date;
		
		let publicationTitle = getFeedField(feedEntry, 'prism', 'publicationName')
			|| getFeedField(feedEntry, 'dc', 'source')
			|| getFeedField(feedEntry, null, 'pubTitle');
		if (publicationTitle) item.publicationTitle = publicationTitle;
		
		let publicationType = getFeedField(feedEntry, null, 'pubType');
		if (publicationType) item.publicationType = publicationType;
		
		let startPage = getFeedField(feedEntry, null, 'startPage');
		let endPage = getFeedField(feedEntry, null, 'endPage');
		if (startPage || endPage) {
			item.pages = ( startPage || '' )
				+ ( endPage && startPage ? '–' : '' )
				+ ( endPage || '' );
		}
		
		let issn = getFeedField(feedEntry, 'prism', 'issn');
		if (issn) item.ISSN = issn;
		
		let isbn = getFeedField(feedEntry, 'prism', 'isbn')
			|| getFeedField(feedEntry, null, 'isbn')
		if (isbn) item.ISBN = isbn;
		
		let identifier = getFeedField(feedEntry, 'dc', 'identifier');
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
		
		let publisher = getFeedField(feedEntry, 'dc', 'publisher');
		if (publisher) item.publisher = publisher;
		
		let rights = getFeedField(feedEntry, 'prism', 'copyright')
			|| getFeedField(feedEntry, 'dc', 'rights')
			|| getFeedField(feedEntry, null, 'copyright');
		if (rights) item.rights = rights;
		
		let language = getFeedField(feedEntry, 'dc', 'language')
			|| getFeedField(feedEntry, null, 'language');
		if (language) item.language = language;
		
		/** Incorporate missing values from feed metadata **/
		
		let supplementFields = ['publicationTitle', 'ISSN', 'publisher', 'rights', 'language'];
		for (let i=0; i<supplementFields.length; i++) {
			let field = supplementFields[i];
			if (!item[field] && feedInfo[field]) {
				item[field] = feedInfo[field];
			}
		}
		
		guessItemType(item);
		
		return item;
	}
	
	/*********************
	 * FeedReader object *
	 *********************/
	let FeedReader = function(url) {
		if (!url) throw new Error("Feed URL must be supplied");
		
		this._feed = Zotero.Promise.defer(); // Fetched asynchronously
		
		this._feedProperties = this._feed.promise
		.then(function(feed) {
			let info = {};
			
			info.title = feed.title ? feed.title.plainText() : '';
			info.subtitle = feed.subtitle ? feed.subtitle.plainText() : '';
			
			if (feed.updated) info.updated = new Date(feed.updated);
			
			// categories: MDN says "not yet implemented"
			
			info.creators = processCreators(feed, 'authors', 'author');
			
			// TODO: image as icon
			
			let publicationTitle = getFeedField(feed, 'prism', 'publicationName')
				|| getFeedField(feed, null, 'pubTitle');
			if (publicationTitle) info.publicationTitle = publicationTitle;
			
			let publisher = getFeedField(feed, 'dc', 'publisher');
			if (publisher) info.publisher = publisher;
			
			let rights = (feed.rights && feed.rights.plainText())
				|| getFeedField(feed, 'prism', 'copyright')
				|| getFeedField(feed, 'dc', 'rights')
				|| getFeedField(feed, null, 'copyright');
			if (rights) info.rights = rights;
			
			let issn = getFeedField(feed, 'prism', 'issn');
			if (issn) info.ISSN = issn;
			
			let isbn = getFeedField(feed, 'prism', 'isbn')
				|| getFeedField(feed, null, 'isbn')
			if (isbn) info.ISBN = isbn;
			
			let language = getFeedField(feed, 'dc', 'language')
				|| getFeedField(feed, null, 'language');
			if (language) info.language = language;
			
			let ttl = getFeedField(feed, null, 'ttl');
			if (ttl) info.ttl = ttl;
			
			return info;
		});
		
		// Array of deferred item promises
		this._feedItems = [Zotero.Promise.defer()];
		
		// Process items once they're available and push them into the array
		Zotero.Promise.join(
			this._feed.promise,
			this._feedProperties,
			(feed, feedInfo) => {
				let items = feed.items;
				if (items && items.length) {
					for (let i=0; i<items.length; i++) {
						let item = items.queryElementAt(i, Components.interfaces.nsIFeedEntry);
						if (!item) continue;
						
						let feedItem = getFeedItem(item, feedInfo);
						if (!feedItem) continue;
						
						let lastItem = this._feedItems[this._feedItems.length - 1];
						this._feedItems.push(Zotero.Promise.defer()); // Push a new deferred promise so an iterator has something to return
						lastItem.resolve(feedItem);
					}
				}
			}
		)
		.finally(() => {
			// Make sure the last promise gets resolved to null
			let lastItem = this._feedItems[this._feedItems.length - 1];
			lastItem.resolve(null);
		});
		
		// Set up asynchronous feed processor
		let feedProcessor = Components.classes["@mozilla.org/feed-processor;1"]
			.createInstance(Components.interfaces.nsIFeedProcessor);
		
		let feedUrl = ios.newURI(url, null, null);
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
				this._feed.resolve(newFeed);
			}
		};
		
		Zotero.debug("FeedReader: Fetching feed from " + feedUrl.spec);
		
		this._channel = ios.newChannelFromURI(feedUrl);
		this._channel.asyncOpen(feedProcessor, null); // Sends an HTTP request
	}
	
	Zotero.defineProperty(FeedReader.prototype, 'feedProperties', {
		get: function() this._feedProperties
	});
	
	/*
	 * Feed item iterator
	 * Each iteration returns a _promise_ for an item. The promise _MUST_ be
	 * resolved before requesting the next item.
	 * The last item will always be resolved to `null`, unless the feed processing
	 * is terminated ahead of time, in which case it will be rejected with the reason
	 * for termination.
	 */
	Zotero.defineProperty(FeedReader.prototype, 'itemIterator', {
		get: function() {
			let items = this._feedItems;
			return new function() {
				let i = 0;
				this.next = function() {
					let item = items[i++];
					return {
						value: item ? item.promise : null,
						done: i >= items.length
					};
				};
			}
		}
	});
	
	/*
	 * Terminate feed processing at any given time
	 * @param {String} status Reason for terminating processing
	 */
	FeedReader.prototype.terminate = function(status) {
		Zotero.debug("FeedReader: Terminating feed reader (" + status + ")");
		
		// Reject feed promise if not resolved yet
		if (this._feed.promise.isPending()) {
			this._feed.reject(status);
		}
		
		// Reject feed item promise if not resolved yet
		let lastItem = this._feedItems[this._feedItems.length - 1];
		if (lastItem.promise.isPending()) {
			lastItem.reject(status);
		}
		
		// Close feed connection
		if (channel.isPending) {
			channel.cancel(Components.results.NS_BINDING_ABORTED);
		}
	};
	
	return FeedReader;
};