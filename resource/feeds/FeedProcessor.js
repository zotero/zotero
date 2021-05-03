/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function LOG(str) {
  dump("*** " + str + "\n");
}

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

const FP_CONTRACTID = "@mozilla.org/feed-processor;1";
const FP_CLASSID = Components.ID("{26acb1f0-28fc-43bc-867a-a46aabc85dd4}");
const FP_CLASSNAME = "Feed Processor";
const FR_CONTRACTID = "@mozilla.org/feed-result;1";
const FR_CLASSID = Components.ID("{072a5c3d-30c6-4f07-b87f-9f63d51403f2}");
const FR_CLASSNAME = "Feed Result";
const FEED_CONTRACTID = "@mozilla.org/feed;1";
const FEED_CLASSID = Components.ID("{5d0cfa97-69dd-4e5e-ac84-f253162e8f9a}");
const FEED_CLASSNAME = "Feed";
const ENTRY_CONTRACTID = "@mozilla.org/feed-entry;1";
const ENTRY_CLASSID = Components.ID("{8e4444ff-8e99-4bdd-aa7f-fb3c1c77319f}");
const ENTRY_CLASSNAME = "Feed Entry";
const TEXTCONSTRUCT_CONTRACTID = "@mozilla.org/feed-textconstruct;1";
const TEXTCONSTRUCT_CLASSID =
  Components.ID("{b992ddcd-3899-4320-9909-924b3e72c922}");
const TEXTCONSTRUCT_CLASSNAME = "Feed Text Construct";
const GENERATOR_CONTRACTID = "@mozilla.org/feed-generator;1";
const GENERATOR_CLASSID =
  Components.ID("{414af362-9ad8-4296-898e-62247f25a20e}");
const GENERATOR_CLASSNAME = "Feed Generator";
const PERSON_CONTRACTID = "@mozilla.org/feed-person;1";
const PERSON_CLASSID = Components.ID("{95c963b7-20b2-11db-92f6-001422106990}");
const PERSON_CLASSNAME = "Feed Person";

const IO_CONTRACTID = "@mozilla.org/network/io-service;1";
const BAG_CONTRACTID = "@mozilla.org/hash-property-bag;1";
const ARRAY_CONTRACTID = "@mozilla.org/array;1";
const SAX_CONTRACTID = "@mozilla.org/saxparser/xmlreader;1";
const PARSERUTILS_CONTRACTID = "@mozilla.org/parserutils;1";

const gMimeService = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);

const XMLNS = "http://www.w3.org/XML/1998/namespace";
const RSS090NS = "http://my.netscape.com/rdf/simple/0.9/";

/** *** Some general utils *****/
function strToURI(link, base) {
  base = base || null;
  try {
    return Services.io.newURI(link, null, base);
  } catch (e) {
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

function isIID(a, iid) {
  var rv = false;
  try {
    a.QueryInterface(iid);
    rv = true;
  } catch (e) {
  }
  return rv;
}

function isIArray(a) {
  return isIID(a, Ci.nsIArray);
}

function isIFeedContainer(a) {
  return isIID(a, Ci.nsIFeedContainer);
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
    var linkElement = links.queryElementAt(i, Ci.nsIPropertyBag2);
    // atom:link MUST have @href
    if (bagHasKey(linkElement, "href")) {
      var relAttribute = null;
      if (bagHasKey(linkElement, "rel"))
        relAttribute = linkElement.getPropertyAsAString("rel");
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

function arrayContains(array, element) {
  for (var i = 0; i < array.length; ++i) {
    if (array[i] == element) {
      return true;
    }
  }
  return false;
}

// XXX add hasKey to nsIPropertyBag
function bagHasKey(bag, key) {
  try {
    bag.getProperty(key);
    return true;
  } catch (e) {
    return false;
  }
}

function makePropGetter(key) {
  return function FeedPropGetter(bag) {
    try {
      return bag.getProperty(key);
    } catch (e) {
    }
    return null;
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

function FeedResult() {}
FeedResult.prototype = {
  bozo: false,
  doc: null,
  version: null,
  headers: null,
  uri: null,
  stylesheet: null,

  registerExtensionPrefix: function FR_registerExtensionPrefix(ns, prefix) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  // XPCOM stuff
  classID: FR_CLASSID,
  QueryInterface: ChromeUtils.generateQI([Ci.nsIFeedResult]),
};

function Feed() {
  this.subtitle = null;
  this.title = null;
  this.items = Cc[ARRAY_CONTRACTID].createInstance(Ci.nsIMutableArray);
  this.link = null;
  this.id = null;
  this.generator = null;
  this.authors = Cc[ARRAY_CONTRACTID].createInstance(Ci.nsIMutableArray);
  this.contributors = Cc[ARRAY_CONTRACTID].createInstance(Ci.nsIMutableArray);
  this.baseURI = null;
  this.enclosureCount = 0;
  this.type = Ci.nsIFeed.TYPE_FEED;
}

Feed.prototype = {
  searchLists: {
    title: ["title", "rss1:title", "atom03:title", "atom:title"],
    subtitle: ["description", "dc:description", "rss1:description",
               "atom03:tagline", "atom:subtitle"],
    items: ["items", "atom03_entries", "entries"],
    id: ["atom:id", "rdf:about"],
    generator: ["generator"],
    authors: ["authors"],
    contributors: ["contributors"],
    link:  [["link", strToURI], ["rss1:link", strToURI]],
    categories: ["categories", "dc:subject"],
    rights: ["atom03:rights", "atom:rights"],
    cloud: ["cloud"],
    image: ["image", "rss1:image", "atom:logo"],
    textInput: ["textInput", "rss1:textinput"],
    skipDays: ["skipDays"],
    skipHours: ["skipHours"],
    updated: ["pubDate", "lastBuildDate", "atom03:modified", "dc:date",
              "dcterms:modified", "atom:updated"],
  },

  normalize: function Feed_normalize() {
    fieldsToObj(this, this.searchLists);
    if (this.skipDays)
      this.skipDays = this.skipDays.getProperty("days");
    if (this.skipHours)
      this.skipHours = this.skipHours.getProperty("hours");

    if (this.updated)
      this.updated = dateParse(this.updated);

    // Assign Atom link if needed
    if (bagHasKey(this.fields, "links"))
      this._atomLinksToURI();

    this._calcEnclosureCountAndFeedType();

    // Resolve relative image links
    if (this.image && bagHasKey(this.image, "url"))
      this._resolveImageLink();

    this._resetBagMembersToRawText([this.searchLists.subtitle,
                                    this.searchLists.title]);
  },

  _calcEnclosureCountAndFeedType: function Feed_calcEnclosureCountAndFeedType() {
    var entries_with_enclosures = 0;
    var audio_count = 0;
    var image_count = 0;
    var video_count = 0;
    var other_count = 0;

    for (var i = 0; i < this.items.length; ++i) {
      var entry = this.items.queryElementAt(i, Ci.nsIFeedEntry);
      entry.QueryInterface(Ci.nsIFeedContainer);

      if (entry.enclosures && entry.enclosures.length > 0) {
        ++entries_with_enclosures;

        for (var e = 0; e < entry.enclosures.length; ++e) {
          var enc = entry.enclosures.queryElementAt(e, Ci.nsIWritablePropertyBag2);
          if (enc.hasKey("type")) {
            var enctype = enc.get("type");

            if (/^audio/.test(enctype)) {
              ++audio_count;
            } else if (/^image/.test(enctype)) {
              ++image_count;
            } else if (/^video/.test(enctype)) {
              ++video_count;
            } else {
              ++other_count;
            }
          } else {
            ++other_count;
          }
        }
      }
    }

    var feedtype = Ci.nsIFeed.TYPE_FEED;

    // For a feed to be marked as TYPE_VIDEO, TYPE_AUDIO and TYPE_IMAGE,
    // we enforce two things:
    //
    //    1. all entries must have at least one enclosure
    //    2. all enclosures must be video for TYPE_VIDEO, audio for TYPE_AUDIO or image
    //       for TYPE_IMAGE
    //
    // Otherwise it's a TYPE_FEED.
    if (entries_with_enclosures == this.items.length && other_count == 0) {
      if (audio_count > 0 && !video_count && !image_count) {
        feedtype = Ci.nsIFeed.TYPE_AUDIO;

      } else if (image_count > 0 && !audio_count && !video_count) {
        feedtype = Ci.nsIFeed.TYPE_IMAGE;

      } else if (video_count > 0 && !audio_count && !image_count) {
        feedtype = Ci.nsIFeed.TYPE_VIDEO;
      }
    }

    this.type = feedtype;
    this.enclosureCount = other_count + video_count + audio_count + image_count;
  },

  _atomLinksToURI: function Feed_linkToURI() {
    var links = this.fields.getPropertyAsInterface("links", Ci.nsIArray);
    var alternates = findAtomLinks("alternate", links);
    if (alternates.length > 0) {
      var href = alternates[0].getPropertyAsAString("href");
      var base;
      if (bagHasKey(alternates[0], "xml:base"))
        base = alternates[0].getPropertyAsAString("xml:base");
      this.link = this._resolveURI(href, base);
    }
  },

  _resolveImageLink: function Feed_resolveImageLink() {
    var base;
    if (bagHasKey(this.image, "xml:base"))
      base = this.image.getPropertyAsAString("xml:base");
    var url = this._resolveURI(this.image.getPropertyAsAString("url"), base);
    if (url)
      this.image.setPropertyAsAString("url", url.spec);
  },

  _resolveURI: function Feed_resolveURI(linkSpec, baseSpec) {
    var uri = null;
    try {
      var base = baseSpec ? strToURI(baseSpec, this.baseURI) : this.baseURI;
      uri = strToURI(linkSpec, base);
    } catch (e) {
      LOG(e);
    }

    return uri;
  },

  // reset the bag to raw contents, not text constructs
  _resetBagMembersToRawText: function Feed_resetBagMembers(fieldLists) {
    for (var i = 0; i < fieldLists.length; i++) {
      for (var j = 0; j < fieldLists[i].length; j++) {
        if (bagHasKey(this.fields, fieldLists[i][j])) {
          var textConstruct = this.fields.getProperty(fieldLists[i][j]);
          this.fields.setPropertyAsAString(fieldLists[i][j],
                                           textConstruct.text);
        }
      }
    }
  },

  // XPCOM stuff
  classID: FEED_CLASSID,
  QueryInterface: ChromeUtils.generateQI([Ci.nsIFeed, Ci.nsIFeedContainer]),
};

function Entry() {
  this.summary = null;
  this.content = null;
  this.title = null;
  this.fields = Cc["@mozilla.org/hash-property-bag;1"].
    createInstance(Ci.nsIWritablePropertyBag2);
  this.link = null;
  this.id = null;
  this.baseURI = null;
  this.updated = null;
  this.published = null;
  this.authors = Cc[ARRAY_CONTRACTID].createInstance(Ci.nsIMutableArray);
  this.contributors = Cc[ARRAY_CONTRACTID].createInstance(Ci.nsIMutableArray);
}

Entry.prototype = {
  fields: null,
  enclosures: null,
  mediaContent: null,

  searchLists: {
    title: ["title", "rss1:title", "atom03:title", "atom:title"],
    link: [["link", strToURI], ["rss1:link", strToURI]],
    id: [["guid", makePropGetter("guid")], "rdf:about",
         "atom03:id", "atom:id"],
    authors: ["authors"],
    contributors: ["contributors"],
    summary: ["description", "rss1:description", "dc:description",
              "atom03:summary", "atom:summary"],
    content: ["content:encoded", "atom03:content", "atom:content"],
    rights: ["atom03:rights", "atom:rights"],
    published: ["pubDate", "atom03:issued", "dcterms:issued", "atom:published"],
    updated: ["pubDate", "atom03:modified", "dc:date", "dcterms:modified",
              "atom:updated"],
  },

  normalize: function Entry_normalize() {
    fieldsToObj(this, this.searchLists);

    // Assign Atom link if needed
    if (bagHasKey(this.fields, "links"))
      this._atomLinksToURI();

    // Populate enclosures array
    this._populateEnclosures();

    // The link might be a guid w/ permalink=true
    if (!this.link && bagHasKey(this.fields, "guid")) {
      var guid = this.fields.getProperty("guid");
      var isPermaLink = true;

      if (bagHasKey(guid, "isPermaLink"))
        isPermaLink = guid.getProperty("isPermaLink").toLowerCase() != "false";

      if (guid && isPermaLink)
        this.link = strToURI(guid.getProperty("guid"));
    }

    if (this.updated)
      this.updated = dateParse(this.updated);
    if (this.published)
      this.published = dateParse(this.published);

    this._resetBagMembersToRawText([this.searchLists.content,
                                    this.searchLists.summary,
                                    this.searchLists.title]);
  },

  _populateEnclosures: function Entry_populateEnclosures() {
    if (bagHasKey(this.fields, "links"))
      this._atomLinksToEnclosures();

    // Add RSS2 enclosure to enclosures
    if (bagHasKey(this.fields, "enclosure"))
      this._enclosureToEnclosures();

    // Add media:content to enclosures
    if (bagHasKey(this.fields, "mediacontent"))
      this._mediaToEnclosures("mediacontent");

    // Add media:thumbnail to enclosures
    if (bagHasKey(this.fields, "mediathumbnail"))
      this._mediaToEnclosures("mediathumbnail");

    // Add media:content in media:group to enclosures
    if (bagHasKey(this.fields, "mediagroup"))
      this._mediaToEnclosures("mediagroup", "mediacontent");
  },

  __enclosure_map: null,

  _addToEnclosures: function Entry_addToEnclosures(new_enc) {
    // items we add to the enclosures array get displayed in the FeedWriter and
    // they must have non-empty urls.
    if (!bagHasKey(new_enc, "url") || new_enc.getPropertyAsAString("url") == "")
      return;

    if (this.__enclosure_map == null)
      this.__enclosure_map = {};

    var previous_enc = this.__enclosure_map[new_enc.getPropertyAsAString("url")];

    if (previous_enc != undefined) {
      previous_enc.QueryInterface(Ci.nsIWritablePropertyBag2);

      if (!bagHasKey(previous_enc, "type") && bagHasKey(new_enc, "type")) {
        previous_enc.setPropertyAsAString("type", new_enc.getPropertyAsAString("type"));
        try {
          let handlerInfoWrapper = gMimeService.getFromTypeAndExtension(new_enc.getPropertyAsAString("type"), null);
          if (handlerInfoWrapper && handlerInfoWrapper.description) {
            previous_enc.setPropertyAsAString("typeDesc", handlerInfoWrapper.description);
          }
        } catch (ext) {}
      }

      if (!bagHasKey(previous_enc, "length") && bagHasKey(new_enc, "length"))
        previous_enc.setPropertyAsAString("length", new_enc.getPropertyAsAString("length"));

      return;
    }

    if (this.enclosures == null) {
      this.enclosures = Cc[ARRAY_CONTRACTID].createInstance(Ci.nsIMutableArray);
      this.enclosures.QueryInterface(Ci.nsIMutableArray);
    }

    this.enclosures.appendElement(new_enc);
    this.__enclosure_map[new_enc.getPropertyAsAString("url")] = new_enc;
  },

  _atomLinksToEnclosures: function Entry_linkToEnclosure() {
    var links = this.fields.getPropertyAsInterface("links", Ci.nsIArray);
    var enc_links = findAtomLinks("enclosure", links);
    if (enc_links.length == 0)
      return;

    for (var i = 0; i < enc_links.length; ++i) {
      var link = enc_links[i];

      // an enclosure must have an href
      if (!(link.getProperty("href")))
        return;

      var enc = Cc[BAG_CONTRACTID].createInstance(Ci.nsIWritablePropertyBag2);

      // copy Atom bits over to equivalent enclosure bits
      enc.setPropertyAsAString("url", link.getPropertyAsAString("href"));
      if (bagHasKey(link, "type"))
        enc.setPropertyAsAString("type", link.getPropertyAsAString("type"));
      if (bagHasKey(link, "length"))
        enc.setPropertyAsAString("length", link.getPropertyAsAString("length"));

      this._addToEnclosures(enc);
    }
  },

  _enclosureToEnclosures: function Entry_enclosureToEnclosures() {
    var enc = this.fields.getPropertyAsInterface("enclosure", Ci.nsIPropertyBag2);

    if (!(enc.getProperty("url")))
      return;

    this._addToEnclosures(enc);
  },

  _mediaToEnclosures: function Entry_mediaToEnclosures(mediaType, contentType) {
    var content;

    // If a contentType is specified, the mediaType is a simple propertybag,
    // and the contentType is an array inside it.
    if (contentType) {
      var group = this.fields.getPropertyAsInterface(mediaType, Ci.nsIPropertyBag2);
      content = group.getPropertyAsInterface(contentType, Ci.nsIArray);
    } else {
      content = this.fields.getPropertyAsInterface(mediaType, Ci.nsIArray);
    }

    for (var i = 0; i < content.length; ++i) {
      var contentElement = content.queryElementAt(i, Ci.nsIWritablePropertyBag2);

      // media:content don't require url, but if it's not there, we should
      // skip it.
      if (!bagHasKey(contentElement, "url"))
        continue;

      var enc = Cc[BAG_CONTRACTID].createInstance(Ci.nsIWritablePropertyBag2);

      // copy media:content bits over to equivalent enclosure bits
      enc.setPropertyAsAString("url", contentElement.getPropertyAsAString("url"));
      if (bagHasKey(contentElement, "type")) {
        enc.setPropertyAsAString("type", contentElement.getPropertyAsAString("type"));
      } else if (mediaType == "mediathumbnail") {
        // thumbnails won't have a type, but default to image types
        enc.setPropertyAsAString("type", "image/*");
        enc.setPropertyAsBool("thumbnail", true);
      }

      if (bagHasKey(contentElement, "fileSize")) {
        enc.setPropertyAsAString("length", contentElement.getPropertyAsAString("fileSize"));
      }

      this._addToEnclosures(enc);
    }
  },

  // XPCOM stuff
  classID: ENTRY_CLASSID,
  QueryInterface: ChromeUtils.generateQI(
    [Ci.nsIFeedEntry, Ci.nsIFeedContainer]
  ),
};

Entry.prototype._atomLinksToURI = Feed.prototype._atomLinksToURI;
Entry.prototype._resolveURI = Feed.prototype._resolveURI;
Entry.prototype._resetBagMembersToRawText =
   Feed.prototype._resetBagMembersToRawText;

// TextConstruct represents and element that could contain (X)HTML
function TextConstruct() {
  this.lang = null;
  this.base = null;
  this.type = "text";
  this.text = null;
  this.parserUtils = Cc[PARSERUTILS_CONTRACTID].getService(Ci.nsIParserUtils);
}

TextConstruct.prototype = {
  plainText: function TC_plainText() {
    if (this.type != "text") {
      return this.parserUtils.convertToPlainText(stripTags(this.text),
        Ci.nsIDocumentEncoder.OutputSelectionOnly |
        Ci.nsIDocumentEncoder.OutputAbsoluteLinks,
        0);
    }
    return this.text;
  },

  createDocumentFragment: function TC_createDocumentFragment(element) {
    if (this.type == "text") {
      var doc = element.ownerDocument;
      var docFragment = doc.createDocumentFragment();
      var node = doc.createTextNode(this.text);
      docFragment.appendChild(node);
      return docFragment;
    }
    var isXML;
    if (this.type == "xhtml")
      isXML = true;
    else if (this.type == "html")
      isXML = false;
    else
      return null;

    let flags = Ci.nsIParserUtils.SanitizerDropForms;
    return this.parserUtils.parseFragment(this.text, flags, isXML,
                                          this.base, element);
  },

  // XPCOM stuff
  classID: TEXTCONSTRUCT_CLASSID,
  QueryInterface: ChromeUtils.generateQI([Ci.nsIFeedTextConstruct]),
};

// Generator represents the software that produced the feed
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
    this.version = this._attributes.getValueFromName("", "version");
    var uriAttribute = this._attributes.getValueFromName("", "uri") ||
                       this._attributes.getValueFromName("", "url");
    this.uri = strToURI(uriAttribute, this.baseURI);

    // RSS1
    uriAttribute = this._attributes.getValueFromName(RDF_NS, "resource");
    if (uriAttribute) {
      this.agent = uriAttribute;
      this.uri = strToURI(uriAttribute, this.baseURI);
    }
  },

  // XPCOM stuff
  classID: GENERATOR_CLASSID,
  QueryInterface: ChromeUtils.generateQI(
    [Ci.nsIFeedGenerator, Ci.nsIFeedElementBase]
  ),
};

function Person() {
  this.name = null;
  this.uri = null;
  this.email = null;

  // nsIFeedElementBase
  this.attributes = null;
  this.baseURI = null;
}

Person.prototype = {
  // XPCOM stuff
  classID: PERSON_CLASSID,
  QueryInterface: ChromeUtils.generateQI(
    [Ci.nsIFeedPerson, Ci.nsIFeedElementBase]
  ),
};

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
      try {
        prop = container.fields.getProperty(field);
      } catch (e) {
      }
      if (prop) {
        prop = isArray(props) ? props[1](prop) : prop;
        container[key] = prop;
      }
    }
  }
}

/**
 * Lower cases an element's localName property
 * @param   element A DOM element.
 *
 * @returns The lower case localName property of the specified element
 */
function LC(element) {
  return element.localName.toLowerCase();
}

// TODO move these post-processor functions
// create a generator element
function atomGenerator(s, generator) {
  generator.QueryInterface(Ci.nsIFeedGenerator);
  generator.agent = s.trim();
  return generator;
}

// post-process atom:logo to create an RSS2-like structure
function atomLogo(s, logo) {
  logo.setPropertyAsAString("url", s.trim());
}

// post-process an RSS category, map it to the Atom fields.
function rssCatTerm(s, cat) {
  // add slash handling?
  cat.setPropertyAsAString("term", s.trim());
  return cat;
}

// post-process a GUID
function rssGuid(s, guid) {
  guid.setPropertyAsAString("guid", s.trim());
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
  author.QueryInterface(Ci.nsIFeedPerson);
  // check for RSS2 string format
  var chars = s.trim();
  var matches = chars.match(/(.*)\((.*)\)/);
  var emailCheck =
    /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  if (matches) {
    var match1 = matches[1].trim();
    var match2 = matches[2].trim();
    if (match2.indexOf("mailto:") == 0)
      match2 = match2.substring(7);
    if (emailCheck.test(match1)) {
      author.email = match1;
      author.name = match2;
    } else if (emailCheck.test(match2)) {
      author.email = match2;
      author.name = match1;
    } else {
      // put it back together
      author.name = match1 + " (" + match2 + ")";
    }
  } else {
    author.name = chars;
    if (chars.indexOf("@"))
      author.email = chars;
  }
  return author;
}

//
// skipHours and skipDays map to arrays, so we need to change the
// string to an nsISupports in order to stick it in there.
//
function rssArrayElement(s) {
  var str = Cc["@mozilla.org/supports-string;1"].
              createInstance(Ci.nsISupportsString);
  str.data = s;
  str.QueryInterface(Ci.nsISupportsString);
  return str;
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
  _isInScope: function XH__isInScope(ns) {
    for (var i in this._inScopeNS) {
      for (var uri in this._inScopeNS[i]) {
        if (this._inScopeNS[i][uri] == ns)
          return true;
      }
    }
    return false;
  },

  startDocument: function XH_startDocument() {
  },
  endDocument: function XH_endDocument() {
  },
  startElement: function XH_startElement(namespace, localName, qName, attributes) {
    ++this._depth;
    this._inScopeNS.push([]);

    // RFC4287 requires XHTML to be wrapped in a div that is *not* part of
    // the content. This prevents people from screwing up namespaces, but
    // we need to skip it here.
    if (this._isAtom && this._depth == 1 && localName == "div")
      return;

    // If it's an XHTML element, record it. Otherwise, it's ignored.
    if (namespace == XHTML_NS) {
      this._buf += "<" + localName;
      var uri;
      for (var i = 0; i < attributes.length; ++i) {
        uri = attributes.getURI(i);
        // XHTML attributes aren't in a namespace
        if (uri == "") {
          this._buf += (" " + attributes.getLocalName(i) + "='" +
                        xmlEscape(attributes.getValue(i)) + "'");
        } else {
          // write a small set of allowed attribute namespaces
          var prefix = gAllowedXHTMLNamespaces[uri];
          if (prefix != null) {
            // The attribute value we'll attempt to write
            var attributeValue = xmlEscape(attributes.getValue(i));

            // it's an allowed attribute NS.
            // write the attribute
            this._buf += (" " + prefix + ":" +
                          attributes.getLocalName(i) +
                          "='" + attributeValue + "'");

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
  endElement: function XH_endElement(uri, localName, qName) {
    --this._depth;
    this._inScopeNS.pop();

    // We need to skip outer divs in Atom. See comment in startElement.
    if (this._isAtom && this._depth == 0 && localName == "div")
      return;

    // When we peek too far, go back to the main processor
    if (this._depth < 0) {
      this._processor.returnFromXHTMLHandler(this._buf.trim(),
                                             uri, localName, qName);
      return;
    }
    // If it's an XHTML element, record it. Otherwise, it's ignored.
    if (uri == XHTML_NS) {
      this._buf += "</" + localName + ">";
    }
  },
  characters: function XH_characters(data) {
    this._buf += xmlEscape(data);
  },
  processingInstruction: function XH_processingInstruction() {
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
  startDocument: function EH_startDocument() {
  },
  endDocument: function EH_endDocument() {
  },
  startElement: function EH_startElement(uri, localName, qName, attrs) {
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
  endElement: function EH_endElement(uri, localName, qName) {
    --this._depth;
    if (this._depth == 0) {
      var text = this._hasChildElements ? null : this._buf.trim();
      this._processor.returnFromExtHandler(this._uri, this._localName,
                                           text, this._attrs);
    }
  },
  characters: function EH_characters(data) {
    if (!this._hasChildElements)
      this._buf += data;
  },
  processingInstruction: function EH_processingInstruction() {
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
function FeedProcessor() {
  this._reader = Cc[SAX_CONTRACTID].createInstance(Ci.nsISAXXMLReader);
  this._buf =  "";
  this._feed = Cc[BAG_CONTRACTID].createInstance(Ci.nsIWritablePropertyBag2);
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
  this._textConstructs = {"atom:title": "text",
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
                          "atom03:content": "text"};
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
      "item": new ElementInfo("items", Cc[ENTRY_CONTRACTID], null, true),
      "managingEditor": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                        rssAuthor, true),
      "dc:creator": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                    rssAuthor, true),
      "dc:author": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                   rssAuthor, true),
      "dc:contributor": new ElementInfo("contributors", Cc[PERSON_CONTRACTID],
                                         rssAuthor, true),
      "category": new ElementInfo("categories", null, rssCatTerm, true),
      "cloud": new ElementInfo("cloud", null, null, false),
      "image": new ElementInfo("image", null, null, false),
      "textInput": new ElementInfo("textInput", null, null, false),
      "skipDays": new ElementInfo("skipDays", null, null, false),
      "skipHours": new ElementInfo("skipHours", null, null, false),
      "generator": new ElementInfo("generator", Cc[GENERATOR_CONTRACTID],
                                   atomGenerator, false),
    },

    "IN_ITEMS": {
      "author": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                rssAuthor, true),
      "dc:creator": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                    rssAuthor, true),
      "dc:author": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                   rssAuthor, true),
      "dc:contributor": new ElementInfo("contributors", Cc[PERSON_CONTRACTID],
                                         rssAuthor, true),
      "category": new ElementInfo("categories", null, rssCatTerm, true),
      "enclosure": new ElementInfo("enclosure", null, null, false),
      "media:content": new ElementInfo("mediacontent", null, null, true),
      "media:group": new ElementInfo("mediagroup", null, null, false),
      "media:thumbnail": new ElementInfo("mediathumbnail", null, null, true),
      "guid": new ElementInfo("guid", null, rssGuid, false),
    },

    "IN_SKIPDAYS": {
      "day": new ElementInfo("days", null, rssArrayElement, true),
    },

    "IN_SKIPHOURS": {
      "hour": new ElementInfo("hours", null, rssArrayElement, true),
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
      "rss1:item": new ElementInfo("items", Cc[ENTRY_CONTRACTID], null, true),
    },

    "IN_RDF_CHANNEL": {
      "admin:generatorAgent": new ElementInfo("generator",
                                              Cc[GENERATOR_CONTRACTID],
                                              null, false),
      "dc:creator": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                    rssAuthor, true),
      "dc:author": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                   rssAuthor, true),
      "dc:contributor": new ElementInfo("contributors", Cc[PERSON_CONTRACTID],
                                         rssAuthor, true),
    },

    /** ******* ATOM 1.0 **********/
    "IN_ATOM": {
      "atom:author": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                     null, true),
      "atom:generator": new ElementInfo("generator", Cc[GENERATOR_CONTRACTID],
                                        atomGenerator, false),
      "atom:contributor": new ElementInfo("contributors", Cc[PERSON_CONTRACTID],
                                          null, true),
      "atom:link": new ElementInfo("links", null, null, true),
      "atom:logo": new ElementInfo("atom:logo", null, atomLogo, false),
      "atom:entry": new ElementInfo("entries", Cc[ENTRY_CONTRACTID],
                                    null, true),
    },

    "IN_ENTRIES": {
      "atom:author": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                     null, true),
      "atom:contributor": new ElementInfo("contributors", Cc[PERSON_CONTRACTID],
                                          null, true),
      "atom:link": new ElementInfo("links", null, null, true),
    },

    /** ******* ATOM 0.3 **********/
    "IN_ATOM03": {
      "atom03:author": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                       null, true),
      "atom03:contributor": new ElementInfo("contributors",
                                            Cc[PERSON_CONTRACTID],
                                            null, true),
      "atom03:link": new ElementInfo("links", null, null, true),
      "atom03:entry": new ElementInfo("atom03_entries", Cc[ENTRY_CONTRACTID],
                                      null, true),
      "atom03:generator": new ElementInfo("generator", Cc[GENERATOR_CONTRACTID],
                                          atomGenerator, false),
    },

    "IN_ATOM03_ENTRIES": {
      "atom03:author": new ElementInfo("authors", Cc[PERSON_CONTRACTID],
                                       null, true),
      "atom03:contributor": new ElementInfo("contributors",
                                            Cc[PERSON_CONTRACTID],
                                            null, true),
      "atom03:link": new ElementInfo("links", null, null, true),
      "atom03:entry": new ElementInfo("atom03_entries", Cc[ENTRY_CONTRACTID],
                                      null, true),
    },
  };
}

// See startElement for a long description of how feeds are processed.
FeedProcessor.prototype = {

  // Set ourselves as the SAX handler, and set the base URI
  _init: function FP_init(uri) {
    this._reader.contentHandler = this;
    this._reader.errorHandler = this;
    this._result = Cc[FR_CONTRACTID].createInstance(Ci.nsIFeedResult);
    if (uri) {
      this._result.uri = uri;
      this._reader.baseURI = uri;
      this._xmlBaseStack[0] = uri;
    }
  },

  // This function is called once we figure out what type of feed
  // we're dealing with. Some feed types require digging a bit further
  // than the root.
  _docVerified: function FP_docVerified(version) {
    this._result.doc = Cc[FEED_CONTRACTID].createInstance(Ci.nsIFeed);
    this._result.doc.baseURI =
      this._xmlBaseStack[this._xmlBaseStack.length - 1];
    this._result.doc.fields = this._feed;
    this._result.version = version;
  },

  // When we're done with the feed, let the listener know what
  // happened.
  _sendResult: function FP_sendResult() {
    this._haveSentResult = true;
    try {
      // Can be null when a non-feed is fed to us
      if (this._result.doc)
        this._result.doc.normalize();
    } catch (e) {
      LOG("FIXME: " + e);
    }

    try {
      if (this.listener != null)
        this.listener.handleResult(this._result);
    } finally {
      this._result = null;
    }
  },

  // Parsing functions
  parseAsync: function FP_parseAsync(requestObserver, uri) {
    this._init(uri);
    this._reader.parseAsync(requestObserver);
  },

  // nsIStreamListener

  // The XMLReader will throw sensible exceptions if these get called
  // out of order.
  onStartRequest: function FP_onStartRequest(request, context) {
    // this will throw if the request is not a channel, but so will nsParser.
    var channel = request.QueryInterface(Ci.nsIChannel);
    channel.contentType = "application/vnd.mozilla.maybe.feed";
    this._reader.onStartRequest(request, context);
  },

  onStopRequest: function FP_onStopRequest(request, context, statusCode) {
    try {
      this._reader.onStopRequest(request, context, statusCode);
    } finally {
      this._reader = null;
    }
  },

  onDataAvailable:
  function FP_onDataAvailable(request, context, inputStream, offset, count) {
    this._reader.onDataAvailable(request, context, inputStream, offset, count);
  },

  // nsISAXErrorHandler

  // We only care about fatal errors. When this happens, we may have
  // parsed through the feed metadata and some number of entries. The
  // listener can still show some of that data if it wants, and we'll
  // set the bozo bit to indicate we were unable to parse all the way
  // through.
  fatalError: function FP_reportError() {
    this._result.bozo = true;
    // XXX need to QI to FeedProgressListener
    if (!this._haveSentResult)
      this._sendResult();
  },

  // nsISAXContentHandler

  startDocument: function FP_startDocument() {
    // LOG("----------");
  },

  endDocument: function FP_endDocument() {
    if (!this._haveSentResult)
      this._sendResult();
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
  startElement: function FP_startElement(uri, localName, qName, attributes) {
    this._buf = "";
    ++this._depth;
    var elementInfo;

    // LOG("<" + localName + ">");

    // Check for xml:base
    var base = attributes.getValueFromName(XMLNS, "base");
    if (base) {
      this._xmlBaseStack[this._depth] =
        strToURI(base, this._xmlBaseStack[this._xmlBaseStack.length - 1]);
    }

    // To identify the element we're dealing with, we look up the
    // namespace URI in our gNamespaces dictionary, which will give us
    // a "canonical" prefix for a namespace URI. For example, this
    // allows Dublin Core "creator" elements to be consistently mapped
    // to "dc:creator", for easy field access by consumer code. This
    // strategy also happens to shorten up our state table.
    var key =  this._prefixForNS(uri) + localName;

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
    if ((this._result.version == "atom" || this._result.version == "atom03") &&
        this._textConstructs[key] != null) {
      var type = attributes.getValueFromName("", "type");
      if (type != null && type.includes("xhtml")) {
        this._xhtmlHandler =
          new XHTMLHandler(this, (this._result.version == "atom"));
        this._reader.contentHandler = this._xhtmlHandler;
        return;
      }
    }

    // Check our current state, and see if that state has a defined
    // transition. For example, this._trans["atom:entry"]["atom:author"]
    // will have one, and it tells us to add an item to our authors array.
    if (this._trans[this._state] && this._trans[this._state][key]) {
      elementInfo = this._trans[this._state][key];
    } else {
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
    } else if (elementInfo.feedVersion) {
      this._state = "IN_" + elementInfo.fieldName.toUpperCase();

      // Check for the older RSS2 variants
      if (elementInfo.feedVersion == "rss2")
        elementInfo.feedVersion = this._findRSSVersion(attributes);
      else if (uri == RSS090NS)
        elementInfo.feedVersion = "rss090";

      this._docVerified(elementInfo.feedVersion);
      this._stack.push([this._feed, this._state]);
      this._mapAttributes(this._feed, attributes);
    } else {
      this._state = this._processComplexElement(elementInfo, attributes);
    }
  },

  // In the endElement handler, we decrement the stack and look
  // for cleanup/transition functions to execute. The second part
  // of the state transition works as above in startElement, but
  // the state we're looking for is prefixed with an underscore
  // to distinguish endElement events from startElement events.
  endElement:  function FP_endElement(uri, localName, qName) {
    var elementInfo = this._handlerStack[this._depth];
    // LOG("</" + localName + ">");
    if (elementInfo && !elementInfo.isWrapper)
      this._closeComplexElement(elementInfo);

    // cut down xml:base context
    if (this._xmlBaseStack.length == this._depth + 1)
      this._xmlBaseStack = this._xmlBaseStack.slice(0, this._depth);

    // our new state is whatever is at the top of the stack now
    if (this._stack.length > 0)
      this._state = this._stack[this._stack.length - 1][1];
    this._handlerStack = this._handlerStack.slice(0, this._depth);
    --this._depth;
  },

  // Buffer up character data. The buffer is cleared with every
  // opening element.
  characters: function FP_characters(data) {
    this._buf += data;
  },

  processingInstruction: function FP_processingInstruction(target, data) {
    if (target == "xml-stylesheet") {
      var hrefAttribute = data.match(/href=[\"\'](.*?)[\"\']/);
      if (hrefAttribute && hrefAttribute.length == 2)
        this._result.stylesheet = strToURI(hrefAttribute[1], this._result.uri);
    }
  },

  // end of nsISAXContentHandler

  // Handle our more complicated elements--those that contain
  // attributes and child elements.
  _processComplexElement:
  function FP__processComplexElement(elementInfo, attributes) {
    var obj;

    // If the container is an entry/item, it'll need to have its
    // more esoteric properties put in the 'fields' property bag.
    if (elementInfo.containerClass == Cc[ENTRY_CONTRACTID]) {
      obj = elementInfo.containerClass.createInstance(Ci.nsIFeedEntry);
      obj.baseURI = this._xmlBaseStack[this._xmlBaseStack.length - 1];
      this._mapAttributes(obj.fields, attributes);
    } else if (elementInfo.containerClass) {
      obj = elementInfo.containerClass.createInstance(Ci.nsIFeedElementBase);
      obj.baseURI = this._xmlBaseStack[this._xmlBaseStack.length - 1];
      obj.attributes = attributes; // just set the SAX attributes
    } else {
      obj = Cc[BAG_CONTRACTID].createInstance(Ci.nsIWritablePropertyBag2);
      this._mapAttributes(obj, attributes);
    }

    // We should have a container/propertyBag that's had its
    // attributes processed. Now we need to attach it to its
    // container.
    var newProp;

    // First we'll see what's on top of the stack.
    var container = this._stack[this._stack.length - 1][0];

    // Check to see if it has the property
    var prop;
    try {
      prop = container.getProperty(elementInfo.fieldName);
    } catch (e) {
    }

    if (elementInfo.isArray) {
      if (!prop) {
        container.setPropertyAsInterface(elementInfo.fieldName,
                                         Cc[ARRAY_CONTRACTID].
                                         createInstance(Ci.nsIMutableArray));
      }

      newProp = container.getProperty(elementInfo.fieldName);
      // XXX This QI should not be necessary, but XPConnect seems to fly
      // off the handle in the browser, and loses track of the interface
      // on large files. Bug 335638.
      newProp.QueryInterface(Ci.nsIMutableArray);
      newProp.appendElement(obj);

      // If new object is an nsIFeedContainer, we want to deal with
      // its member nsIPropertyBag instead.
      if (isIFeedContainer(obj))
        newProp = obj.fields;

    } else {
      // If it doesn't, set it.
      if (!prop) {
        container.setPropertyAsInterface(elementInfo.fieldName, obj);
      }
      newProp = container.getProperty(elementInfo.fieldName);
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
  _closeComplexElement: function FP__closeComplexElement(elementInfo) {
    var stateTuple = this._stack.pop();
    var container = stateTuple[0];
    var containerParent = stateTuple[2];
    var element = null;
    var isArray = isIArray(container);

    // If it's an array and we have to post-process,
    // grab the last element
    if (isArray)
      element = container.queryElementAt(container.length - 1, Ci.nsISupports);
    else
      element = container;

    // Run the post-processing function if there is one.
    if (elementInfo.closeFunc)
      element = elementInfo.closeFunc(this._buf, element);

    // If an nsIFeedContainer was on top of the stack,
    // we need to normalize it
    if (elementInfo.containerClass == Cc[ENTRY_CONTRACTID])
      containerParent.normalize();

    // If it's an array, re-set the last element
    if (isArray)
      container.replaceElementAt(element, container.length - 1);
  },

  _prefixForNS: function FP_prefixForNS(uri) {
    if (!uri)
      return "";
    var prefix = gNamespaces[uri];
    if (prefix)
      return prefix + ":";
    if (uri.toLowerCase().indexOf("http://backend.userland.com") == 0)
      return "";
    return null;
  },

  _mapAttributes: function FP__mapAttributes(bag, attributes) {
    // Cycle through the attributes, and set our properties using the
    // prefix:localNames we find in our namespace dictionary.
    for (var i = 0; i < attributes.length; ++i) {
      var key = this._prefixForNS(attributes.getURI(i)) + attributes.getLocalName(i);
      var val = attributes.getValue(i);
      bag.setPropertyAsAString(key, val);
    }
  },

  // Only for RSS2esque formats
  _findRSSVersion: function FP__findRSSVersion(attributes) {
    var versionAttr = attributes.getValueFromName("", "version").trim();
    var versions = { "0.91": "rss091",
                     "0.92": "rss092",
                     "0.93": "rss093",
                     "0.94": "rss094" };
    if (versions[versionAttr])
      return versions[versionAttr];
    if (versionAttr.substr(0, 2) != "2.")
      return "rssUnknown";
    return "rss2";
  },

  // unknown element values are returned here. See startElement above
  // for how this works.
  returnFromExtHandler:
  function FP_returnExt(uri, localName, chars, attributes) {
    --this._depth;

    // take control of the SAX events
    this._reader.contentHandler = this;
    if (localName == null && chars == null)
      return;

    // we don't take random elements inside rdf:RDF
    if (this._state == "IN_RDF")
      return;

    // Grab the top of the stack
    var top = this._stack[this._stack.length - 1];
    if (!top)
      return;

    var container = top[0];
    // Grab the last element if it's an array
    if (isIArray(container)) {
      var contract = this._handlerStack[this._depth].containerClass;
      // check if it's something specific, but not an entry
      if (contract && contract != Cc[ENTRY_CONTRACTID]) {
        var el = container.queryElementAt(container.length - 1,
                                          Ci.nsIFeedElementBase);
        // XXX there must be a way to flatten these interfaces
        if (contract == Cc[PERSON_CONTRACTID])
          el.QueryInterface(Ci.nsIFeedPerson);
        else
          return; // don't know about this interface

        let propName = localName;
        var prefix = gNamespaces[uri];

        // synonyms
        if ((uri == "" ||
             prefix &&
             ((prefix.indexOf("atom") > -1) ||
              (prefix.indexOf("rss") > -1))) &&
            (propName == "url" || propName == "href"))
          propName = "uri";

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
        } catch (e) {
          // ignore XPConnect errors
        }
        // the rest of the function deals with entry- and feed-level stuff
        return;
      }
      container = container.queryElementAt(container.length - 1,
                                           Ci.nsIWritablePropertyBag2);
    }

    // Make the buffer our new property
    var propName = this._prefixForNS(uri) + localName;

    // But, it could be something containing HTML. If so,
    // we need to know about that.
    if (this._textConstructs[propName] != null &&
        this._handlerStack[this._depth].containerClass !== null) {
      var newProp = Cc[TEXTCONSTRUCT_CONTRACTID].
                    createInstance(Ci.nsIFeedTextConstruct);
      newProp.text = chars;
      // Look up the default type in our table
      var type = this._textConstructs[propName];
      var typeAttribute = attributes.getValueFromName("", "type");
      if (this._result.version == "atom" && typeAttribute != null) {
        type = typeAttribute;
      } else if (this._result.version == "atom03" && typeAttribute != null) {
        if (typeAttribute.toLowerCase().includes("xhtml")) {
          type = "xhtml";
        } else if (typeAttribute.toLowerCase().includes("html")) {
          type = "html";
        } else if (typeAttribute.toLowerCase().includes("text")) {
          type = "text";
        }
      }

      // If it's rss feed-level description, it's not supposed to have html
      if (this._result.version.includes("rss") &&
          this._handlerStack[this._depth].containerClass != ENTRY_CONTRACTID) {
        type = "text";
      }
      newProp.type = type;
      newProp.base = this._xmlBaseStack[this._xmlBaseStack.length - 1];
      container.setPropertyAsInterface(propName, newProp);
    } else {
      container.setPropertyAsAString(propName, chars);
    }
  },

  // Sometimes, we'll hand off SAX handling duties to an XHTMLHandler
  // (see above) that will scrape out non-XHTML stuff, normalize
  // namespaces, and remove the wrapper div from Atom 1.0. When the
  // XHTMLHandler is done, it'll callback here.
  returnFromXHTMLHandler:
  function FP_returnFromXHTMLHandler(chars, uri, localName, qName) {
    // retake control of the SAX content events
    this._reader.contentHandler = this;

    // Grab the top of the stack
    var top = this._stack[this._stack.length - 1];
    if (!top)
      return;
    var container = top[0];

    // Assign the property
    var newProp =  newProp = Cc[TEXTCONSTRUCT_CONTRACTID].
                   createInstance(Ci.nsIFeedTextConstruct);
    newProp.text = chars;
    newProp.type = "xhtml";
    newProp.base = this._xmlBaseStack[this._xmlBaseStack.length - 1];
    container.setPropertyAsInterface(this._prefixForNS(uri) + localName,
                                     newProp);

    // XHTML will cause us to peek too far. The XHTML handler will
    // send us an end element to call. RFC4287-valid feeds allow a
    // more graceful way to handle this. Unfortunately, we can't count
    // on compliance at this point.
    this.endElement(uri, localName, qName);
  },

  // XPCOM stuff
  classID: FP_CLASSID,
  QueryInterface: ChromeUtils.generateQI(
    [Ci.nsIFeedProcessor, Ci.nsISAXContentHandler, Ci.nsISAXErrorHandler,
     Ci.nsIStreamListener, Ci.nsIRequestObserver]
  ),
};

var components = [FeedProcessor, FeedResult, Feed, Entry,
                  TextConstruct, Generator, Person];

this.NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
