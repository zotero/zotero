/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-disable quote-props */
/* globals SAXXMLReader */

"use strict";

function LOG(str) {
	Zotero.debug("Feed Processor: " + str);
}

const XMLNS = "http://www.w3.org/XML/1998/namespace";
const RSS090NS = "http://my.netscape.com/rdf/simple/0.9/";

/** *** Some general utils *****/
function strToURI(link, base) {
	base = base || undefined;
	try {
		return new URL(link, base);
	}
	catch (e) {
		return null;
	}
}

function isArray(a) {
	return isObject(a) && a.constructor == Array;
}

function isObject(a) {
	return (a && typeof a == "object") || isFunction(a);
}

function isFunction(a) {
	return typeof a == "function";
}

function stripTags(someHTML) {
	return someHTML.replace(/<[^>]+>/g, "");
}

/**
 * Searches through an array of links and returns a JS array
 * of matching property bags.
 */
const IANA_URI = "http://www.iana.org/assignments/relation/";
function findAtomLinks(rel, links) {
	var rvLinks = [];
	for (var i = 0; i < links.length; ++i) {
		var linkElement = links[i];
		// atom:link MUST have @href
		if (linkElement.href) {
			var relAttribute = null;
			if (linkElement.rel) {
				relAttribute = linkElement.rel;
			}
			if ((!relAttribute && rel == "alternate") || relAttribute == rel) {
				rvLinks.push(linkElement);
				continue;
			}
			// catch relations specified by IANA URI
			if (relAttribute == IANA_URI + rel) {
				rvLinks.push(linkElement);
			}
		}
	}
	return rvLinks;
}

function xmlEscape(s) {
	s = s.replace(/&/g, "&amp;");
	s = s.replace(/>/g, "&gt;");
	s = s.replace(/</g, "&lt;");
	s = s.replace(/"/g, "&quot;");
	s = s.replace(/'/g, "&apos;");
	return s;
}

function makePropGetter(key) {
	return function(bag) {
		return bag[key];
	};
}

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
// namespace map
var gNamespaces = {
	"http://webns.net/mvcb/": "admin",
	"http://backend.userland.com/rss": "",
	"http://blogs.law.harvard.edu/tech/rss": "",
	"http://www.w3.org/2005/Atom": "atom",
	"http://purl.org/atom/ns#": "atom03",
	"http://purl.org/rss/1.0/modules/content/": "content",
	"http://purl.org/dc/elements/1.1/": "dc",
	"http://purl.org/dc/terms/": "dcterms",
	"http://www.w3.org/1999/02/22-rdf-syntax-ns#": "rdf",
	"http://purl.org/rss/1.0/": "rss1",
	"http://my.netscape.com/rdf/simple/0.9/": "rss1",
	"http://wellformedweb.org/CommentAPI/": "wfw",
	"http://purl.org/rss/1.0/modules/wiki/": "wiki",
	"http://www.w3.org/XML/1998/namespace": "xml",
	"http://search.yahoo.com/mrss/": "media",
	"http://search.yahoo.com/mrss": "media",
};

// We allow a very small set of namespaces in XHTML content,
// for attributes only
var gAllowedXHTMLNamespaces = {
	"http://www.w3.org/XML/1998/namespace": "xml",
	// if someone ns qualifies XHTML, we have to prefix it to avoid an
	// attribute collision.
	"http://www.w3.org/1999/xhtml": "xhtml",
};

// Implements nsIFeedResult
function FeedResult() {}
FeedResult.prototype = {
	bozo: false,
	doc: null,
	version: null,
	headers: null,
	uri: null,
	stylesheet: null,
};

// Implements nsIFeed, nsIFeedContainer
function Feed() {
	this.subtitle = null;
	this.title = null;
	this.items = [];
	this.link = null;
	this.id = null;
	this.generator = null;
	this.authors = [];
	this.contributors = [];
	this.baseURI = null;
	this.enclosureCount = 0;
	this.type = Feed.TYPE_FEED;
}

Feed.TYPE_FEED = 0;
Feed.TYPE_AUDIO = 1;
Feed.TYPE_IMAGE = 2;
Feed.TYPE_VIDEO = 4;

Feed.prototype = {
	searchLists: {
		title: ["title", "rss1:title", "atom03:title", "atom:title"],
		subtitle: [
			"description",
			"dc:description",
			"rss1:description",
			"atom03:tagline",
			"atom:subtitle",
		],
		items: ["items", "atom03_entries", "entries"],
		id: ["atom:id", "rdf:about"],
		generator: ["generator"],
		authors: ["authors"],
		contributors: ["contributors"],
		link: [["link", strToURI], ["rss1:link", strToURI]],
		categories: ["categories", "dc:subject"],
		rights: ["atom03:rights", "atom:rights"],
		cloud: ["cloud"],
		image: ["image", "rss1:image", "atom:logo"],
		textInput: ["textInput", "rss1:textinput"],
		skipDays: ["skipDays"],
		skipHours: ["skipHours"],
		updated: [
			"pubDate",
			"lastBuildDate",
			"atom03:modified",
			"dc:date",
			"dcterms:modified",
			"atom:updated",
		],
	},
	
	normalize: function () {
		fieldsToObj(this, this.searchLists);
		if (this.skipDays) {
			this.skipDays = this.skipDays.days;
		}
		if (this.skipHours) {
			this.skipHours = this.skipHours.hours;
		}
		
		if (this.updated) {
			this.updated = dateParse(this.updated);
		}
		
		// Assign Atom link if needed
		if (this.fields.links) {
			this._atomLinksToURI();
		}
		
		this._calcEnclosureCountAndFeedType();
		
		// Resolve relative image links
		if (this.image && this.image.url) {
			this._resolveImageLink();
		}
		
		this._resetBagMembersToRawText([this.searchLists.subtitle, this.searchLists.title]);
	},
	
	_calcEnclosureCountAndFeedType: function () {
		var entriesWithEnclosures = 0;
		var audioCount = 0;
		var imageCount = 0;
		var videoCount = 0;
		var otherCount = 0;
		
		for (var i = 0; i < this.items.length; ++i) {
			var entry = this.items[i];
			
			if (entry.enclosures && entry.enclosures.length > 0) {
				++entriesWithEnclosures;
				
				for (var e = 0; e < entry.enclosures.length; ++e) {
					var enc = entry.enclosures[e];
					if (enc.type) {
						var enctype = enc.type;
						
						if (/^audio/.test(enctype)) {
							++audioCount;
						}
						else if (/^image/.test(enctype)) {
							++imageCount;
						}
						else if (/^video/.test(enctype)) {
							++videoCount;
						}
						else {
							++otherCount;
						}
					}
					else {
						++otherCount;
					}
				}
			}
		}
		
		var feedtype = Feed.TYPE_FEED;
		
		// For a feed to be marked as TYPE_VIDEO, TYPE_AUDIO and TYPE_IMAGE,
		// we enforce two things:
		//
		//    1. all entries must have at least one enclosure
		//    2. all enclosures must be video for TYPE_VIDEO, audio for TYPE_AUDIO or image
		//       for TYPE_IMAGE
		//
		// Otherwise it's a TYPE_FEED.
		if (entriesWithEnclosures == this.items.length && otherCount == 0) {
			if (audioCount > 0 && !videoCount && !imageCount) {
				feedtype = Feed.TYPE_AUDIO;
			}
			else if (imageCount > 0 && !audioCount && !videoCount) {
				feedtype = Feed.TYPE_IMAGE;
			}
			else if (videoCount > 0 && !audioCount && !imageCount) {
				feedtype = Feed.TYPE_VIDEO;
			}
		}
		
		this.type = feedtype;
		this.enclosureCount = otherCount + videoCount + audioCount + imageCount;
	},
	
	_atomLinksToURI: function () {
		var links = this.fields.links;
		var alternates = findAtomLinks("alternate", links);
		if (alternates.length > 0) {
			var href = alternates[0].href;
			var base;
			if (alternates[0]["xml:base"]) {
				base = alternates[0]["xml:base"];
			}
			this.link = this._resolveURI(href, base);
		}
	},
	
	_resolveImageLink: function () {
		var base;
		if (this.image["xml:base"]) {
			base = this.image["xml:base"];
		}
		var url = this._resolveURI(this.image.url, base);
		if (url) {
			this.image.url = url.href;
		}
	},
	
	_resolveURI: function (linkSpec, baseSpec) {
		var uri = null;
		try {
			var base = baseSpec ? strToURI(baseSpec, this.baseURI) : this.baseURI;
			uri = strToURI(linkSpec, base);
		}
		catch (e) {
			LOG(e);
		}

		return uri;
	},
	
	// reset the bag to raw contents, not text constructs
	_resetBagMembersToRawText: function (fieldLists) {
		for (var i = 0; i < fieldLists.length; i++) {
			for (var j = 0; j < fieldLists[i].length; j++) {
				if (this.fields[fieldLists[i][j]]) {
					var textConstruct = this.fields[fieldLists[i][j]];
					this.fields[fieldLists[i][j]] = textConstruct.text;
				}
			}
		}
	},
};

// Implements nsIFeedEntry, nsIFeedContainer
function Entry() {
	this.summary = null;
	this.content = null;
	this.title = null;
	this.fields = {};
	this.link = null;
	this.id = null;
	this.baseURI = null;
	this.updated = null;
	this.published = null;
	this.authors = [];
	this.contributors = [];
}

Entry.prototype = {
	fields: null,
	enclosures: null,
	mediaContent: null,
	
	searchLists: {
		title: ["title", "rss1:title", "atom03:title", "atom:title"],
		link: [["link", strToURI], ["rss1:link", strToURI]],
		id: [
			["guid", makePropGetter("guid")],
			"rdf:about",
			"atom03:id",
			"atom:id",
		],
		authors: ["authors"],
		contributors: ["contributors"],
		summary: [
			"description",
			"rss1:description",
			"dc:description",
			"atom03:summary",
			"atom:summary",
		],
		content: ["content:encoded", "atom03:content", "atom:content"],
		rights: ["atom03:rights", "atom:rights"],
		published: ["pubDate", "atom03:issued", "dcterms:issued", "atom:published"],
		updated: [
			"pubDate",
			"atom03:modified",
			"dc:date",
			"dcterms:modified",
			"atom:updated",
		],
	},
	
	normalize: function () {
		fieldsToObj(this, this.searchLists);
		
		// Assign Atom link if needed
		if (this.fields.links) {
			this._atomLinksToURI();
		}
		
		// Populate enclosures array
		this._populateEnclosures();
		
		// The link might be a guid w/ permalink=true
		if (!this.link && this.fields.guid) {
			var guid = this.fields.guid;
			var isPermaLink = true;
			
			if (guid.isPermaLink) {
				isPermaLink = guid.isPermaLink.toLowerCase() != "false";
			}
			
			if (guid && isPermaLink) {
				this.link = strToURI(guid.guid);
			}
		}
		
		if (this.updated) {
			this.updated = dateParse(this.updated);
		}
		if (this.published) {
			this.published = dateParse(this.published);
		}
		
		this._resetBagMembersToRawText([
			this.searchLists.content,
			this.searchLists.summary,
			this.searchLists.title,
		]);
	},
	
	_populateEnclosures: function () {
		if (this.fields.links) {
			this._atomLinksToEnclosures();
		}
		
		// Add RSS2 enclosure to enclosures
		if (this.fields.enclosure) {
			this._enclosureToEnclosures();
		}
		
		// Add media:content to enclosures
		if (this.fields.mediacontent) {
			this._mediaToEnclosures("mediacontent");
		}
		
		// Add media:thumbnail to enclosures
		if (this.fields.mediathumbnail) {
			this._mediaToEnclosures("mediathumbnail");
		}
		
		// Add media:content in media:group to enclosures
		if (this.fields.mediagroup) {
			this._mediaToEnclosures("mediagroup", "mediacontent");
		}
	},
	
	__enclosureMap: null,
	
	_addToEnclosures: function (newEnc) {
		// items we add to the enclosures array get displayed in the FeedWriter and
		// they must have non-empty urls.
		if (!newEnc.url || newEnc.url == "") {
			return;
		}
		
		if (this.__enclosureMap === null) {
			this.__enclosureMap = {};
		}
		
		var previousEnc = this.__enclosureMap[newEnc.url];
		
		if (previousEnc != undefined) {
			if (!previousEnc.type && newEnc.type) {
				previousEnc.type = newEnc.type;
			}
			
			if (!previousEnc.length && newEnc.length) {
				previousEnc.length = newEnc.length;
			}
			
			return;
		}
		
		if (this.enclosures === null) {
			this.enclosures = [];
		}
		
		this.enclosures.push(newEnc);
		this.__enclosureMap[newEnc.url] = newEnc;
	},
	
	_atomLinksToEnclosures: function () {
		var links = this.fields.links;
		var encLinks = findAtomLinks("enclosure", links);
		if (encLinks.length == 0) {
			return;
		}
		
		for (var i = 0; i < encLinks.length; ++i) {
			var link = encLinks[i];
			
			// an enclosure must have an href
			if (!link.href) {
				return;
			}
			
			var enc = {};
			
			// copy Atom bits over to equivalent enclosure bits
			enc.url = link.href;
			if (link.type) {
				enc.type = link.type;
			}
			if (link.length) {
				enc.length = link.length;
			}
			
			this._addToEnclosures(enc);
		}
	},
	
	_enclosureToEnclosures: function () {
		var enc = this.fields.enclosure;

		if (!enc.url) {
			return;
		}

		this._addToEnclosures(enc);
	},
	
	_mediaToEnclosures: function (mediaType, contentType) {
		var content;
		
		// If a contentType is specified, the mediaType is a simple propertybag,
		// and the contentType is an array inside it.
		if (contentType) {
			var group = this.fields[mediaType];
			content = group[contentType];
		}
		else {
			content = this.fields[mediaType];
		}
		
		for (var i = 0; i < content.length; ++i) {
			var contentElement = content[i];
			
			// media:content don't require url, but if it's not there, we should
			// skip it.
			if (!contentElement.url) {
				continue;
			}
			
			var enc = {};
			
			// copy media:content bits over to equivalent enclosure bits
			enc.url = contentElement.url;
			if (contentElement.type) {
				enc.type = contentElement.type;
			}
			else if (mediaType == "mediathumbnail") {
				// thumbnails won't have a type, but default to image types
				enc.type = "image/*";
				enc.thumbnail = true;
			}
			
			if (contentElement.fileSize) {
				enc.length = contentElement.fileSize;
			}
			
			this._addToEnclosures(enc);
		}
	},
};

Entry.prototype._atomLinksToURI = Feed.prototype._atomLinksToURI;
Entry.prototype._resolveURI = Feed.prototype._resolveURI;
Entry.prototype._resetBagMembersToRawText = Feed.prototype._resetBagMembersToRawText;

// TextConstruct represents and element that could contain (X)HTML
// Implements nsIFeedTextConstruct
function TextConstruct() {
	this.lang = null;
	this.base = null;
	this.type = "text";
	this.text = null;
}

TextConstruct.prototype = {
	plainText: function () {
		if (this.type != "text") {
			return stripTags(this.text);
		}
		return this.text;
	},
	
	createDocumentFragment: function (element) {
		if (this.type == "text") {
			const doc = element.ownerDocument;
			const docFragment = doc.createDocumentFragment();
			const node = doc.createTextNode(this.text);
			docFragment.appendChild(node);
			return docFragment;
		}
		
		let parserType;
		if (this.type == "xhtml") {
			parserType = "application/xhtml+xml";
		}
		else if (this.type == "html") {
			parserType = "text/html";
		}
		else {
			return null;
		}
		
		const parsedDoc = new DOMParser().parseFromString(this.text, parserType);
		return parsedDoc.documentElement;
	},
};

// Generator represents the software that produced the feed
// Implements nsIFeedGenerator, nsIFeedElementBase
function Generator() {
	this.lang = null;
	this.agent = null;
	this.version = null;
	this.uri = null;
	
	// nsIFeedElementBase
	this._attributes = null;
	this.baseURI = null;
}

Generator.prototype = {
	get attributes() {
		return this._attributes;
	},
	
	set attributes(value) {
		this._attributes = value;
		this.version = (this._attributes.getNamedItemNS("", "version") || {}).value;
		var uriAttribute = (this._attributes.getNamedItemNS("", "uri") || {}).value
			|| (this._attributes.getNamedItemNS("", "url") || {}).value;
		this.uri = strToURI(uriAttribute, this.baseURI);
		
		// RSS1
		uriAttribute = (this._attributes.getNamedItemNS(RDF_NS, "resource") || {}).value;
		if (uriAttribute) {
			this.agent = uriAttribute;
			this.uri = strToURI(uriAttribute, this.baseURI);
		}
	},
};

// Implements nsIFeedPerson, nsIFeedElementBase
function Person() {
	this.name = null;
	this.uri = null;
	this.email = null;
	
	// nsIFeedElementBase
	this.attributes = null;
	this.baseURI = null;
}

/**
 * Map a list of fields into properties on a container.
 *
 * @param container An nsIFeedContainer
 * @param fields A list of fields to search for. List members can
 *               be a list, in which case the second member is
 *               transformation function (like parseInt).
 */
function fieldsToObj(container, fields) {
	var props, prop, field, searchList;
	for (var key in fields) {
		searchList = fields[key];
		for (var i = 0; i < searchList.length; ++i) {
			props = searchList[i];
			prop = null;
			field = isArray(props) ? props[0] : props;
			prop = container.fields[field];
			if (prop) {
				prop = isArray(props) ? props[1](prop) : prop;
				container[key] = prop;
			}
		}
	}
}

// create a generator element
function atomGenerator(s, generator) {
	generator.agent = s.trim();
	return generator;
}

// post-process atom:logo to create an RSS2-like structure
function atomLogo(s, logo) {
	logo.url = s.trim();
}

// post-process an RSS category, map it to the Atom fields.
function rssCatTerm(s, cat) {
	// add slash handling?
	cat.term = s.trim();
	return cat;
}

// post-process a GUID
function rssGuid(s, guid) {
	guid.guid = s.trim();
	return guid;
}

// post-process an RSS author element
//
// It can contain a field like this:
//
//  <author>lawyer@boyer.net (Lawyer Boyer)</author>
//
// or, delightfully, a field like this:
//
//  <dc:creator>Simon St.Laurent (mailto:simonstl@simonstl.com)</dc:creator>
//
// We want to split this up and assign it to corresponding Atom
// fields.
//
function rssAuthor(s, author) {
	// check for RSS2 string format
	var chars = s.trim();
	var matches = chars.match(/(.*)\((.*)\)/);
	var emailCheck
		= /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
	if (matches) {
		var match1 = matches[1].trim();
		var match2 = matches[2].trim();
		if (match2.indexOf("mailto:") == 0) {
			match2 = match2.substring(7);
		}
		if (emailCheck.test(match1)) {
			author.email = match1;
			author.name = match2;
		}
		else if (emailCheck.test(match2)) {
			author.email = match2;
			author.name = match1;
		}
		else {
			// put it back together
			author.name = match1 + " (" + match2 + ")";
		}
	}
	else {
		author.name = chars;
		if (chars.indexOf("@")) {
			author.email = chars;
		}
	}
	return author;
}

/**
 * Tries parsing a string through the JavaScript Date object.
 * @param aDateString
 *        A string that is supposedly an RFC822 or RFC3339 date.
 * @return A Date.toUTCString, or null if the string can't be parsed.
 */
function dateParse(aDateString) {
	let dateString = aDateString.trim();
	// Without bug 682781 fixed, JS won't parse an RFC822 date with a Z for the
	// timezone, so convert to -00:00 which works for any date format.
	dateString = dateString.replace(/z$/i, "-00:00");
	let date = new Date(dateString);
	if (!isNaN(date)) {
		return date.toUTCString();
	}
	return null;
}

const XHTML_NS = "http://www.w3.org/1999/xhtml";

// The XHTMLHandler handles inline XHTML found in things like atom:summary
function XHTMLHandler(processor, isAtom) {
	this._buf = "";
	this._processor = processor;
	this._depth = 0;
	this._isAtom = isAtom;
	// a stack of lists tracking in-scope namespaces
	this._inScopeNS = [];
}

// The fidelity can be improved here, to allow handling of stuff like
// SVG and MathML. XXX
XHTMLHandler.prototype = {
	
	// look back up at the declared namespaces
	// we always use the same prefixes for our safe stuff
	_isInScope: function (ns) {
		for (var i in this._inScopeNS) {
			for (var uri in this._inScopeNS[i]) {
				if (this._inScopeNS[i][uri] == ns) {
					return true;
				}
			}
		}
		return false;
	},
	
	startDocument: function () {
	},
	endDocument: function () {
	},
	startElement: function (namespace, localName, qName, attributes) {
		++this._depth;
		this._inScopeNS.push([]);
		
		// RFC4287 requires XHTML to be wrapped in a div that is *not* part of
		// the content. This prevents people from screwing up namespaces, but
		// we need to skip it here.
		if (this._isAtom && this._depth == 1 && localName == "div") {
			return;
		}
		
		// If it's an XHTML element, record it. Otherwise, it's ignored.
		if (namespace == XHTML_NS) {
			this._buf += "<" + localName;
			var uri;
			for (var i = 0; i < attributes.length; ++i) {
				uri = attributes.item(i).namespaceURI;
				// XHTML attributes aren't in a namespace
				if (uri == "") {
					this._buf += (" " + attributes.item(i).localName + "='"
						+ xmlEscape(attributes.item(i).value) + "'");
				}
				else {
					// write a small set of allowed attribute namespaces
					var prefix = gAllowedXHTMLNamespaces[uri];
					if (prefix) {
						// The attribute value we'll attempt to write
						var attributeValue = xmlEscape(attributes.item(i).value);
						
						// it's an allowed attribute NS.
						// write the attribute
						this._buf += (" " + prefix + ":"
													+ attributes.item(i).localName
													+ "='" + attributeValue + "'");
						
						// write an xmlns declaration if necessary
						if (prefix != "xml" && !this._isInScope(uri)) {
							this._inScopeNS[this._inScopeNS.length - 1].push(uri);
							this._buf += " xmlns:" + prefix + "='" + uri + "'";
						}
					}
				}
			}
			this._buf += ">";
		}
	},
	endElement: function (uri, localName, qName) {
		--this._depth;
		this._inScopeNS.pop();
		
		// We need to skip outer divs in Atom. See comment in startElement.
		if (this._isAtom && this._depth == 0 && localName == "div") {
			return;
		}
		
		// When we peek too far, go back to the main processor
		if (this._depth < 0) {
			this._processor.returnFromXHTMLHandler(this._buf.trim(), uri, localName, qName);
			return;
		}
		// If it's an XHTML element, record it. Otherwise, it's ignored.
		if (uri == XHTML_NS) {
			this._buf += "</" + localName + ">";
		}
	},
	characters: function (data) {
		this._buf += xmlEscape(data);
	},
	processingInstruction: function () {
	},
};

/**
 * The ExtensionHandler deals with elements we haven't explicitly
 * added to our transition table in the FeedProcessor.
 */
function ExtensionHandler(processor) {
	this._buf = "";
	this._depth = 0;
	this._hasChildElements = false;
	
	// The FeedProcessor
	this._processor = processor;
	
	// Fields of the outermost extension element.
	this._localName = null;
	this._uri = null;
	this._qName = null;
	this._attrs = null;
}

ExtensionHandler.prototype = {
	startDocument: function () {
	},
	endDocument: function () {
	},
	startElement: function (uri, localName, qName, attrs) {
		++this._depth;
		
		if (this._depth == 1) {
			this._uri = uri;
			this._localName = localName;
			this._qName = qName;
			this._attrs = attrs;
		}
		
		// if we descend into another element, we won't send text
		this._hasChildElements = (this._depth > 1);
	},
	endElement: function (_uri, _localName, _qName) {
		--this._depth;
		if (this._depth == 0) {
			var text = this._hasChildElements ? null : this._buf.trim();
			this._processor.returnFromExtHandler(this._uri, this._localName, text, this._attrs);
		}
	},
	characters: function (data) {
		if (!this._hasChildElements) {
			this._buf += data;
		}
	},
	processingInstruction: function () {
	},
};


/**
 * ElementInfo is a simple container object that describes
 * some characteristics of a feed element. For example, it
 * says whether an element can be expected to appear more
 * than once inside a given entry or feed.
 */
function ElementInfo(fieldName, containerClass, closeFunc, isArray) {
	this.fieldName = fieldName;
	this.containerClass = containerClass;
	this.closeFunc = closeFunc;
	this.isArray = isArray;
	this.isWrapper = false;
}

/**
 * FeedElementInfo represents a feed element, usually the root.
 */
function FeedElementInfo(fieldName, feedVersion) {
	this.isWrapper = false;
	this.fieldName = fieldName;
	this.feedVersion = feedVersion;
}

/**
 * Some feed formats include vestigial wrapper elements that we don't
 * want to include in our object model, but we do need to keep track
 * of during parsing.
 */
function WrapperElementInfo(fieldName) {
	this.isWrapper = true;
	this.fieldName = fieldName;
}

/** *** The Processor *****/
// Implements nsIFeedProcessor, nsISAXContentHandler, nsISAXErrorHandler,
//            nsIStreamListener, nsIRequestObserver
function FeedProcessor() {
	this._reader = new SAXXMLReader();
	this._buf = "";
	this._feed = {};
	this._handlerStack = [];
	this._xmlBaseStack = []; // sparse array keyed to nesting depth
	this._depth = 0;
	this._state = "START";
	this._result = null;
	this._extensionHandler = null;
	this._xhtmlHandler = null;
	this._haveSentResult = false;
	
	// The nsIFeedResultListener waiting for the parse results
	this.listener = null;
	
	// These elements can contain (X)HTML or plain text.
	// We keep a table here that contains their default treatment
	this._textConstructs = {
		"atom:title": "text",
		"atom:summary": "text",
		"atom:rights": "text",
		"atom:content": "text",
		"atom:subtitle": "text",
		"description": "html",
		"rss1:description": "html",
		"dc:description": "html",
		"content:encoded": "html",
		"title": "text",
		"rss1:title": "text",
		"atom03:title": "text",
		"atom03:tagline": "text",
		"atom03:summary": "text",
		"atom03:content": "text"
	};
	this._stack = [];
	
	this._trans = {
		"START": {
			// If we hit a root RSS element, treat as RSS2.
			"rss": new FeedElementInfo("RSS2", "rss2"),
			
			// If we hit an RDF element, if could be RSS1, but we can't
			// verify that until we hit a rss1:channel element.
			"rdf:RDF": new WrapperElementInfo("RDF"),
			
			// If we hit a Atom 1.0 element, treat as Atom 1.0.
			"atom:feed": new FeedElementInfo("Atom", "atom"),
			
			// Treat as Atom 0.3
			"atom03:feed": new FeedElementInfo("Atom03", "atom03"),
		},
		
		/** ******* RSS2 **********/
		"IN_RSS2": {
			"channel": new WrapperElementInfo("channel"),
		},
		
		"IN_CHANNEL": {
			"item": new ElementInfo("items", Entry, null, true),
			"managingEditor": new ElementInfo("authors", Person, rssAuthor, true),
			"dc:creator": new ElementInfo("authors", Person, rssAuthor, true),
			"dc:author": new ElementInfo("authors", Person, rssAuthor, true),
			"dc:contributor": new ElementInfo("contributors", Person, rssAuthor, true),
			"category": new ElementInfo("categories", null, rssCatTerm, true),
			"cloud": new ElementInfo("cloud", null, null, false),
			"image": new ElementInfo("image", null, null, false),
			"textInput": new ElementInfo("textInput", null, null, false),
			"skipDays": new ElementInfo("skipDays", null, null, false),
			"skipHours": new ElementInfo("skipHours", null, null, false),
			"generator": new ElementInfo("generator", Generator, atomGenerator, false),
		},
		
		"IN_ITEMS": {
			"author": new ElementInfo("authors", Person, rssAuthor, true),
			"dc:creator": new ElementInfo("authors", Person, rssAuthor, true),
			"dc:author": new ElementInfo("authors", Person, rssAuthor, true),
			"dc:contributor": new ElementInfo("contributors", Person, rssAuthor, true),
			"category": new ElementInfo("categories", null, rssCatTerm, true),
			"enclosure": new ElementInfo("enclosure", null, null, false),
			"media:content": new ElementInfo("mediacontent", null, null, true),
			"media:group": new ElementInfo("mediagroup", null, null, false),
			"media:thumbnail": new ElementInfo("mediathumbnail", null, null, true),
			"guid": new ElementInfo("guid", null, rssGuid, false),
		},
		
		"IN_SKIPDAYS": {
			"day": new ElementInfo("days", null, null, true),
		},
		
		"IN_SKIPHOURS": {
			"hour": new ElementInfo("hours", null, null, true),
		},
		
		"IN_MEDIAGROUP": {
			"media:content": new ElementInfo("mediacontent", null, null, true),
			"media:thumbnail": new ElementInfo("mediathumbnail", null, null, true),
		},
		
		/** ******* RSS1 **********/
		"IN_RDF": {
			// If we hit a rss1:channel, we can verify that we have RSS1
			"rss1:channel": new FeedElementInfo("rdf_channel", "rss1"),
			"rss1:image": new ElementInfo("image", null, null, false),
			"rss1:textinput": new ElementInfo("textInput", null, null, false),
			"rss1:item": new ElementInfo("items", Entry, null, true),
		},
		
		"IN_RDF_CHANNEL": {
			"admin:generatorAgent": new ElementInfo("generator", Generator, null, false),
			"dc:creator": new ElementInfo("authors", Person, rssAuthor, true),
			"dc:author": new ElementInfo("authors", Person, rssAuthor, true),
			"dc:contributor": new ElementInfo("contributors", Person, rssAuthor, true),
		},
		
		/** ******* ATOM 1.0 **********/
		"IN_ATOM": {
			"atom:author": new ElementInfo("authors", Person, null, true),
			"atom:generator": new ElementInfo("generator", Generator, atomGenerator, false),
			"atom:contributor": new ElementInfo("contributors", Person, null, true),
			"atom:link": new ElementInfo("links", null, null, true),
			"atom:logo": new ElementInfo("atom:logo", null, atomLogo, false),
			"atom:entry": new ElementInfo("entries", Entry, null, true),
		},
		
		"IN_ENTRIES": {
			"atom:author": new ElementInfo("authors", Person, null, true),
			"atom:contributor": new ElementInfo("contributors", Person, null, true),
			"atom:link": new ElementInfo("links", null, null, true),
		},
		
		/** ******* ATOM 0.3 **********/
		"IN_ATOM03": {
			"atom03:author": new ElementInfo("authors", Person, null, true),
			"atom03:contributor": new ElementInfo("contributors", Person, null, true),
			"atom03:link": new ElementInfo("links", null, null, true),
			"atom03:entry": new ElementInfo("atom03_entries", Entry, null, true),
			"atom03:generator": new ElementInfo("generator", Generator, atomGenerator, false),
		},
		
		"IN_ATOM03_ENTRIES": {
			"atom03:author": new ElementInfo("authors", Person, null, true),
			"atom03:contributor": new ElementInfo("contributors", Person, null, true),
			"atom03:link": new ElementInfo("links", null, null, true),
			"atom03:entry": new ElementInfo("atom03_entries", Entry, null, true),
		},
	};
}

// See startElement for a long description of how feeds are processed.
FeedProcessor.prototype = {
	// Set ourselves as the SAX handler, and set the base URI
	_init: function (uri) {
		this._reader.contentHandler = this;
		this._reader.errorHandler = this;
		this._result = new FeedResult();
		if (uri) {
			this._result.uri = uri;
			this._reader.baseURI = uri;
			this._xmlBaseStack[0] = uri;
		}
	},
	
	// This function is called once we figure out what type of feed
	// we're dealing with. Some feed types require digging a bit further
	// than the root.
	_docVerified: function (version) {
		this._result.doc = new Feed();
		this._result.doc.baseURI
			= this._xmlBaseStack[this._xmlBaseStack.length - 1];
		this._result.doc.fields = this._feed;
		this._result.version = version;
	},
	
	// When we're done with the feed, let the listener know what
	// happened.
	_sendResult: function () {
		this._haveSentResult = true;
		try {
			// Can be null when a non-feed is fed to us
			if (this._result.doc) {
				this._result.doc.normalize();
			}
		}
		catch (e) {
			LOG("FIXME: " + e);
		}
		
		try {
			if (this.listener !== null) {
				this.listener.handleResult(this._result);
			}
		}
		finally {
			this._result = null;
		}
	},
	
	// Parsing functions
	parseAsync: function (requestObserver, uri) {
		this._init(uri);
		this._reader.parseAsync(requestObserver);
	},
	
	// Fetch API
	
	onResponseAvailable(response) {
		return this._reader.onResponseAvailable(response);
	},
	
	// nsISAXErrorHandler
	
	// We only care about fatal errors. When this happens, we may have
	// parsed through the feed metadata and some number of entries. The
	// listener can still show some of that data if it wants, and we'll
	// set the bozo bit to indicate we were unable to parse all the way
	// through.
	fatalError: function () {
		this._result.bozo = true;
		// XXX need to QI to FeedProgressListener
		if (!this._haveSentResult) {
			this._sendResult();
		}
	},
	
	// nsISAXContentHandler
	
	startDocument: function () {
		// LOG("----------");
	},
	
	endDocument: function () {
		if (!this._haveSentResult) {
			this._sendResult();
		}
	},
	
	// The transitions defined above identify elements that contain more
	// than just text. For example RSS items contain many fields, and so
	// do Atom authors. The only commonly used elements that contain
	// mixed content are Atom Text Constructs of type="xhtml", which we
	// delegate to another handler for cleaning. That leaves a couple
	// different types of elements to deal with: those that should occur
	// only once, such as title elements, and those that can occur
	// multiple times, such as the RSS category element and the Atom
	// link element. Most of the RSS1/DC elements can occur multiple
	// times in theory, but in practice, the only ones that do have
	// analogues in Atom.
	//
	// Some elements are also groups of attributes or sub-elements,
	// while others are simple text fields. For the most part, we don't
	// have to pay explicit attention to the simple text elements,
	// unless we want to post-process the resulting string to transform
	// it into some richer object like a Date or URI.
	//
	// Elements that have more sophisticated content models still end up
	// being dictionaries, whether they are based on attributes like RSS
	// cloud, sub-elements like Atom author, or even items and
	// entries. These elements are treated as "containers". It's
	// theoretically possible for a container to have an attribute with
	// the same universal name as a sub-element, but none of the feed
	// formats allow this by default, and I don't of any extension that
	// works this way.
	//
	startElement: function (uri, localName, qName, attributes) {
		this._buf = "";
		++this._depth;
		var elementInfo;
		
		// LOG("<" + localName + ">");
		
		// Check for xml:base
		var base = (attributes.getNamedItemNS(XMLNS, "base") || {}).value;
		if (base) {
			this._xmlBaseStack[this._depth]
				= strToURI(base, this._xmlBaseStack[this._xmlBaseStack.length - 1]);
		}
		
		// To identify the element we're dealing with, we look up the
		// namespace URI in our gNamespaces dictionary, which will give us
		// a "canonical" prefix for a namespace URI. For example, this
		// allows Dublin Core "creator" elements to be consistently mapped
		// to "dc:creator", for easy field access by consumer code. This
		// strategy also happens to shorten up our state table.
		var key = this._prefixForNS(uri) + localName;
		
		// Check to see if we need to hand this off to our XHTML handler.
		// The elements we're dealing with will look like this:
		//
		// <title type="xhtml">
		//   <div xmlns="http://www.w3.org/1999/xhtml">
		//     A title with <b>bold</b> and <i>italics</i>.
		//   </div>
		// </title>
		//
		// When it returns in returnFromXHTMLHandler, the handler should
		// give us back a string like this:
		//
		//    "A title with <b>bold</b> and <i>italics</i>."
		//
		// The Atom spec explicitly says the div is not part of the content,
		// and explicitly allows whitespace collapsing.
		//
		if ((this._result.version == "atom" || this._result.version == "atom03")
				&& this._textConstructs[key]) {
			var type = (attributes.getNamedItemNS("", "type") || {}).value;
			if (type && type.includes("xhtml")) {
				this._xhtmlHandler
					= new XHTMLHandler(this, (this._result.version == "atom"));
				this._reader.contentHandler = this._xhtmlHandler;
				return;
			}
		}
		
		// Check our current state, and see if that state has a defined
		// transition. For example, this._trans["atom:entry"]["atom:author"]
		// will have one, and it tells us to add an item to our authors array.
		if (this._trans[this._state] && this._trans[this._state][key]) {
			elementInfo = this._trans[this._state][key];
		}
		else {
			// If we don't have a transition, hand off to extension handler
			this._extensionHandler = new ExtensionHandler(this);
			this._reader.contentHandler = this._extensionHandler;
			this._extensionHandler.startElement(uri, localName, qName, attributes);
			return;
		}
		
		// This distinguishes wrappers like 'channel' from elements
		// we'd actually like to do something with (which will test true).
		this._handlerStack[this._depth] = elementInfo;
		if (elementInfo.isWrapper) {
			this._state = "IN_" + elementInfo.fieldName.toUpperCase();
			this._stack.push([this._feed, this._state]);
		}
		else if (elementInfo.feedVersion) {
			this._state = "IN_" + elementInfo.fieldName.toUpperCase();
			
			// Check for the older RSS2 variants
			if (elementInfo.feedVersion == "rss2") {
				elementInfo.feedVersion = this._findRSSVersion(attributes);
			}
			else if (uri == RSS090NS) {
				elementInfo.feedVersion = "rss090";
			}
			
			this._docVerified(elementInfo.feedVersion);
			this._stack.push([this._feed, this._state]);
			this._mapAttributes(this._feed, attributes);
		}
		else {
			this._state = this._processComplexElement(elementInfo, attributes);
		}
	},
	
	// In the endElement handler, we decrement the stack and look
	// for cleanup/transition functions to execute. The second part
	// of the state transition works as above in startElement, but
	// the state we're looking for is prefixed with an underscore
	// to distinguish endElement events from startElement events.
	endElement: function (_uri, _localName, _qName) {
		var elementInfo = this._handlerStack[this._depth];
		// LOG("</" + localName + ">");
		if (elementInfo && !elementInfo.isWrapper) {
			this._closeComplexElement(elementInfo);
		}
		
		// cut down xml:base context
		if (this._xmlBaseStack.length == this._depth + 1) {
			this._xmlBaseStack = this._xmlBaseStack.slice(0, this._depth);
		}
		
		// our new state is whatever is at the top of the stack now
		if (this._stack.length > 0) {
			this._state = this._stack[this._stack.length - 1][1];
		}
		this._handlerStack = this._handlerStack.slice(0, this._depth);
		--this._depth;
	},
	
	// Buffer up character data. The buffer is cleared with every
	// opening element.
	characters: function (data) {
		this._buf += data;
	},
	
	processingInstruction: function (target, data) {
		if (target == "xml-stylesheet") {
			var hrefAttribute = data.match(/href=["'](.*?)["']/);
			if (hrefAttribute && hrefAttribute.length == 2) {
				this._result.stylesheet = strToURI(hrefAttribute[1], this._result.uri);
			}
		}
	},
	
	// end of nsISAXContentHandler
	
	// Handle our more complicated elements--those that contain
	// attributes and child elements.
	_processComplexElement: function (elementInfo, attributes) {
		var obj;
		
		// If the container is an entry/item, it'll need to have its
		// more esoteric properties put in the 'fields' property bag.
		const Class = elementInfo.containerClass;
		if (Class == Entry) {
			obj = new Class();
			obj.baseURI = this._xmlBaseStack[this._xmlBaseStack.length - 1];
			this._mapAttributes(obj.fields, attributes);
		}
		else if (elementInfo.containerClass) {
			obj = new Class();
			obj.baseURI = this._xmlBaseStack[this._xmlBaseStack.length - 1];
			obj.attributes = attributes; // just set the SAX attributes
		}
		else {
			obj = {};
			this._mapAttributes(obj, attributes);
		}
		
		// We should have a container/propertyBag that's had its
		// attributes processed. Now we need to attach it to its
		// container.
		var newProp;
		
		// First we'll see what's on top of the stack.
		var container = this._stack[this._stack.length - 1][0];
		
		// Check to see if it has the property
		var prop = container[elementInfo.fieldName];
		
		if (elementInfo.isArray) {
			if (!prop) {
				container[elementInfo.fieldName] = [];
			}
			
			newProp = container[elementInfo.fieldName];
			newProp.push(obj);
			
			// If new object is an nsIFeedContainer, we want to deal with
			// its member nsIPropertyBag instead.
			if (obj.fields) {
				newProp = obj.fields;
			}
		}
		else {
			// If it doesn't, set it.
			if (!prop) {
				container[elementInfo.fieldName] = obj;
			}
			newProp = container[elementInfo.fieldName];
		}
		
		// make our new state name, and push the property onto the stack
		var newState = "IN_" + elementInfo.fieldName.toUpperCase();
		this._stack.push([newProp, newState, obj]);
		return newState;
	},
	
	// Sometimes we need reconcile the element content with the object
	// model for a given feed. We use helper functions to do the
	// munging, but we need to identify array types here, so the munging
	// happens only to the last element of an array.
	_closeComplexElement: function (elementInfo) {
		var stateTuple = this._stack.pop();
		var container = stateTuple[0];
		var containerParent = stateTuple[2];
		var element = null;
		
		// If it's an array and we have to post-process,
		// grab the last element
		if (isArray(container)) {
			element = container[container.length - 1];
		}
		else {
			element = container;
		}
		
		// Run the post-processing function if there is one.
		if (elementInfo.closeFunc) {
			element = elementInfo.closeFunc(this._buf, element);
		}
		
		// If an nsIFeedContainer was on top of the stack,
		// we need to normalize it
		if (elementInfo.containerClass == Entry) {
			containerParent.normalize();
		}
		
		// If it's an array, re-set the last element
		if (isArray(container)) {
			container[container.length - 1] = element;
		}
	},
	
	_prefixForNS: function (uri) {
		if (!uri) {
			return "";
		}
		var prefix = gNamespaces[uri];
		if (prefix) {
			return prefix + ":";
		}
		if (uri.toLowerCase().indexOf("http://backend.userland.com") == 0) {
			return "";
		}
		return null;
	},
	
	_mapAttributes: function (bag, attributes) {
		// Cycle through the attributes, and set our properties using the
		// prefix:localNames we find in our namespace dictionary.
		for (var i = 0; i < attributes.length; ++i) {
			var key = this._prefixForNS(attributes.item(i).namespaceURI) + attributes.item(i).localName;
			var val = attributes.item(i).value;
			bag[key] = val;
		}
	},
	
	// Only for RSS2esque formats
	_findRSSVersion: function (attributes) {
		var versionAttr = (attributes.getNamedItemNS("", "version") || {}).value.trim();
		var versions = {
			"0.91": "rss091",
			"0.92": "rss092",
			"0.93": "rss093",
			"0.94": "rss094"
		};
		if (versions[versionAttr]) {
			return versions[versionAttr];
		}
		if (versionAttr.substr(0, 2) != "2.") {
			return "rssUnknown";
		}
		return "rss2";
	},
	
	// unknown element values are returned here. See startElement above
	// for how this works.
	returnFromExtHandler: function (uri, localName, chars, attributes) {
		--this._depth;
		
		// take control of the SAX events
		this._reader.contentHandler = this;
		if (localName === null && chars === null) {
			return;
		}
		
		// we don't take random elements inside rdf:RDF
		if (this._state == "IN_RDF") {
			return;
		}
		
		// Grab the top of the stack
		var top = this._stack[this._stack.length - 1];
		if (!top) {
			return;
		}
		
		var container = top[0];
		// Grab the last element if it's an array
		if (isArray(container)) {
			var contract = this._handlerStack[this._depth].containerClass;
			// check if it's something specific, but not an entry
			if (contract && contract != Entry) {
				var el = container[container.length - 1];
				if (contract != Person) {
					return; // don't know about this interface
				}
				
				let propName = localName;
				var prefix = gNamespaces[uri];
				
				// synonyms
				if (
					(uri == ""
						|| prefix
						&& ((prefix.indexOf("atom") > -1)
							|| (prefix.indexOf("rss") > -1)))
					&& (propName == "url" || propName == "href")
				) {
					propName = "uri";
				}
				
				try {
					if (el[propName] !== "undefined") {
						var propValue = chars;
						// convert URI-bearing values to an nsIURI
						if (propName == "uri") {
							var base = this._xmlBaseStack[this._xmlBaseStack.length - 1];
							propValue = strToURI(chars, base);
						}
						el[propName] = propValue;
					}
				}
				catch (e) {
					// ignore XPConnect errors
				}
				// the rest of the function deals with entry- and feed-level stuff
				return;
			}
			container = container[container.length - 1];
		}
		
		// Make the buffer our new property
		var propName = this._prefixForNS(uri) + localName;
		
		// But, it could be something containing HTML. If so,
		// we need to know about that.
		if (this._textConstructs[propName]
				&& this._handlerStack[this._depth].containerClass !== null) {
			var newProp = new TextConstruct();
			newProp.text = chars;
			// Look up the default type in our table
			var type = this._textConstructs[propName];
			var typeAttribute = (attributes.getNamedItemNS("", "type") || {}).value;
			if (this._result.version == "atom" && typeAttribute) {
				type = typeAttribute;
			}
			else if (this._result.version == "atom03" && typeAttribute) {
				if (typeAttribute.toLowerCase().includes("xhtml")) {
					type = "xhtml";
				}
				else if (typeAttribute.toLowerCase().includes("html")) {
					type = "html";
				}
				else if (typeAttribute.toLowerCase().includes("text")) {
					type = "text";
				}
			}
			
			// If it's rss feed-level description, it's not supposed to have html
			if (this._result.version.includes("rss")
					&& this._handlerStack[this._depth].containerClass != Entry) {
				type = "text";
			}
			newProp.type = type;
			newProp.base = this._xmlBaseStack[this._xmlBaseStack.length - 1];
			container[propName] = newProp;
		}
		else {
			container[propName] = chars;
		}
	},
	
	// Sometimes, we'll hand off SAX handling duties to an XHTMLHandler
	// (see above) that will scrape out non-XHTML stuff, normalize
	// namespaces, and remove the wrapper div from Atom 1.0. When the
	// XHTMLHandler is done, it'll callback here.
	returnFromXHTMLHandler: function (chars, uri, localName, qName) {
		// retake control of the SAX content events
		this._reader.contentHandler = this;
		
		// Grab the top of the stack
		var top = this._stack[this._stack.length - 1];
		if (!top) {
			return;
		}
		var container = top[0];
		
		// Assign the property
		var newProp = new TextConstruct();
		newProp.text = chars;
		newProp.type = "xhtml";
		newProp.base = this._xmlBaseStack[this._xmlBaseStack.length - 1];
		container[this._prefixForNS(uri) + localName] = newProp;
		
		// XHTML will cause us to peek too far. The XHTML handler will
		// send us an end element to call. RFC4287-valid feeds allow a
		// more graceful way to handle this. Unfortunately, we can't count
		// on compliance at this point.
		this.endElement(uri, localName, qName);
	},
};

if (typeof module == "object") {
	module.exports = FeedProcessor;
}
