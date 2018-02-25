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
    
    ***** END LICENSE BLOCK *****
*/

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
			var base = Zotero.Prefs.get("openURL.resolver");
			// Add & if there's already a ?
			var splice = base.indexOf("?") == -1 ? "?" : "&";
			return base + splice + co;
		}
		return false;
	}
	
	/*
	 * Queries OCLC's OpenURL resolver registry and returns an address and version
	 */
	function discoverResolvers() {
		var req = new XMLHttpRequest();
		req.open("GET", "http://worldcatlibraries.org/registry/lookup?IP=requestor", false);
		req.send(null);
		
		if(!req.responseXML) {
			throw new Error("Could not access resolver registry");
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
			} else if(resolver.getElementsByTagName("OpenURL_0.1").length > 0) {
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
	function createContextObject(item, version, asObj) {
		var entries = (asObj ? {} : []);
		
		function _mapTag(data, tag, dontAddPrefix) {
			if(!data) return;
			
			if(version === "1.0" && !dontAddPrefix) tag = "rft."+tag;
			
			if(asObj) {
				if(!entries[tag]) entries[tag] = [];
				entries[tag].push(data);
			} else {
				entries.push(tag+"="+encodeURIComponent(data));
			}
		}
		
		if (item.toJSON) {
			item = item.toJSON();
		}
		
		// find pmid
		const pmidRe = /(?:\n|^)PMID:\s*(\d+)/g;
		var pmid = pmidRe.exec(item.extra);
		if(pmid) pmid = pmid[1];
		
		// encode ctx_ver (if available) and encode identifiers
		if(version == "0.1") {
			_mapTag("Zotero:2", "sid", true);
			if(item.DOI) _mapTag("doi:"+item.DOI, "id", true);
			if(item.ISBN) _mapTag(item.ISBN, "isbn", true);
			if(pmid) _mapTag("pmid:"+pmid, "id", true);
		} else {
			_mapTag("Z39.88-2004", "url_ver", true);
			_mapTag("Z39.88-2004", "ctx_ver", true);
			_mapTag("info:sid/zotero.org:2", "rfr_id", true);
			if(item.DOI) _mapTag("info:doi/"+item.DOI, "rft_id", true);
			if(item.ISBN) _mapTag("urn:isbn:"+item.ISBN, "rft_id", true);
			if(pmid) _mapTag("info:pmid/"+pmid, "rft_id", true);
		}
		
		// encode genre and item-specific data
		if(item.itemType == "journalArticle") {
			if(version === "1.0") {
				_mapTag("info:ofi/fmt:kev:mtx:journal", "rft_val_fmt", true);
			}
			_mapTag("article", "genre");
			
			_mapTag(item.title, "atitle");
			_mapTag(item.publicationTitle, (version == "0.1" ? "title" : "jtitle"));
			_mapTag(item.journalAbbreviation, "stitle");
			_mapTag(item.volume, "volume");
			_mapTag(item.issue, "issue");
		} else if(item.itemType == "book" || item.itemType == "bookSection" || item.itemType == "conferencePaper" || item.itemType == "report") {
			if(version === "1.0") {
				_mapTag("info:ofi/fmt:kev:mtx:book", "rft_val_fmt", true);
			}
			
			if(item.itemType == "book") {
				_mapTag("book", "genre");
				_mapTag(item.title, (version == "0.1" ? "title" : "btitle"));
			} else if (item.itemType == "conferencePaper") {
				_mapTag("proceeding", "genre");
				_mapTag(item.title, "atitle");
				_mapTag(item.proceedingsTitle, (version == "0.1" ? "title" : "btitle"));
			} else if (item.itemType == "report") {
				_mapTag("report", "genre");
				_mapTag(item.seriesTitle, "series");
				_mapTag(item.title, (version == "0.1" ? "title" : "btitle"));
			} else {
				_mapTag("bookitem", "genre");
				_mapTag(item.title, "atitle");
				_mapTag(item.publicationTitle, (version == "0.1" ? "title" : "btitle"));
			}
			
			_mapTag(item.place, "place");
			_mapTag(item.publisher, "publisher");
			_mapTag(item.edition, "edition");
			_mapTag(item.series, "series");
		} else if(item.itemType == "thesis" && version == "1.0") {
			_mapTag("info:ofi/fmt:kev:mtx:dissertation", "rft_val_fmt", true);
			
			_mapTag(item.title, "title");
			_mapTag(item.publisher, "inst");
			_mapTag(item.type, "degree");
		} else if(item.itemType == "patent" && version == "1.0") {
			_mapTag("info:ofi/fmt:kev:mtx:patent", "rft_val_fmt", true);
			
			_mapTag(item.title, "title");
			_mapTag(item.assignee, "assignee");
			_mapTag(item.patentNumber, "number");
			
			if(item.issueDate) {
				_mapTag(Zotero.Date.strToISO(item.issueDate), "date");
			}
		} else {
			//we map as much as possible to DC for all other types. This will export some info
			//and work very nicely on roundtrip. All of these fields legal for mtx:dc according to
			//http://alcme.oclc.org/openurl/servlet/OAIHandler/extension?verb=GetMetadata&metadataPrefix=mtx&identifier=info:ofi/fmt:kev:mtx:dc
			_mapTag("info:ofi/fmt:kev:mtx:dc", "rft_val_fmt", true);
			//lacking something better we use Zotero item types here; no clear alternative and this works for roundtrip
			_mapTag(item.itemType, "type");
			_mapTag(item.title, "title");
			_mapTag(item.publicationTitle, "source");
			_mapTag(item.rights, "rights");
			_mapTag(item.publisher, "publisher");
			_mapTag(item.abstractNote, "description");
			if(item.DOI){
				 _mapTag("urn:doi:" + item.DOI, "identifier");
			}
			else if(item.url){
				 _mapTag(item.url, "identifier");
			}
		}
		
		if(item.creators && item.creators.length) {
			// encode first author as first and last
			let firstCreator = Zotero.Utilities.Internal.getFirstCreatorFromItemJSON(item);
			if(item.itemType == "patent") {
				_mapTag(firstCreator.firstName, "invfirst");
				_mapTag(firstCreator.lastName, "invlast");
			} else {
				if(firstCreator.isInstitution) {
					_mapTag(firstCreator.lastName, "aucorp");
				} else {
					_mapTag(firstCreator.firstName, "aufirst");
					_mapTag(firstCreator.lastName, "aulast");
				}
			}
			
			// encode subsequent creators as au
			for(var i=0; i<item.creators.length; i++) {
				_mapTag((item.creators[i].firstName ? item.creators[i].firstName+" " : "")+
					item.creators[i].lastName, (item.itemType == "patent" ? "inventor" : "au"));
			}
		}
		
		if(item.date) {
			_mapTag(Zotero.Date.strToISO(item.date), (item.itemType == "patent" ? "appldate" : "date"));
		}
		if(item.pages) {
			_mapTag(item.pages, "pages");
			var pages = item.pages.split(/[-–]/);
			if(pages.length > 1) {
				_mapTag(pages[0], "spage");
				if(pages.length >= 2) _mapTag(pages[1], "epage");
			}
		}
		_mapTag(item.numPages, "tpages");
		_mapTag(item.ISBN, "isbn");
		_mapTag(item.ISSN, "issn");
		_mapTag(item.language, "language");
		if(asObj) return entries;
		return entries.join("&");
	}

	function _cloneIfNecessary(obj1, obj2) {
		if (Zotero.isFx && !Zotero.isBookmarklet) {
			return Components.utils.cloneInto(obj1, obj2);
		}
		return obj1;
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
		for(var i=0; i<coParts.length; i++) {
			if(coParts[i].substr(0, 12) == "rft_val_fmt=") {
				var format = decodeURIComponent(coParts[i].substr(12));
				if(format == "info:ofi/fmt:kev:mtx:journal") {
					item.itemType = "journalArticle";
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:book") {
					if(coParts.indexOf("rft.genre=bookitem") !== -1) {
						item.itemType = "bookSection";
					} else if(coParts.indexOf("rft.genre=conference") !== -1 || coParts.indexOf("rft.genre=proceeding") !== -1) {
						item.itemType = "conferencePaper";
					} else if(coParts.indexOf("rft.genre=report") !== -1) {
						item.itemType = "report";
					} else if(coParts.indexOf("rft.genre=document") !== -1) {
						item.itemType = "document";
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
		
		for(var i=0; i<coParts.length; i++) {
			var keyVal = coParts[i].split("=");
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
				} else if(value.match(/^https?:\/\//)) {
					item.url = value;
					item.accessDate = "";
				}
			} else if(key == "rft.btitle") {
				if(item.itemType == "book" || item.itemType == "report") {
					item.title = value;
				} else if(item.itemType == "bookSection" || item.itemType == "conferencePaper") {
					item.publicationTitle = value;
				}
			} else if(key == "rft.atitle"
					&& ["journalArticle", "bookSection", "conferencePaper"].indexOf(item.itemType) !== -1) {
				item.title = value;
			} else if(key == "rft.jtitle" && item.itemType == "journalArticle") {
				item.publicationTitle = value;
			} else if(key == "rft.stitle" && item.itemType == "journalArticle") {
				item.journalAbbreviation = value;
			} else if(key == "rft.title") {
				if(["journalArticle", "bookSection", "conferencePaper"].indexOf(item.itemType) !== -1) {
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
					complexAu.push(_cloneIfNecessary({lastName:value, creatorType:(key == "rft.aulast" ? "author" : "inventor"), offset:item.creators.length}, item));
				}
			} else if(key == "rft.aufirst" || key == "rft.invfirst") {
				var lastCreator = complexAu[complexAu.length-1];
				if(complexAu.length && !lastCreator.firstName && !lastCreator.institutional) {
					lastCreator.firstName = value;
				} else {
					complexAu.push(_cloneIfNecessary({firstName:value, creatorType:(key == "rft.aufirst" ? "author" : "inventor"), offset:item.creators.length}, item));
				}
			} else if(key == "rft.au" || key == "rft.creator" || key == "rft.contributor" || key == "rft.inventor") {
				if(key == "rft.contributor") {
					var type = "contributor";
				} else if(key == "rft.inventor") {
					var type = "inventor";
				} else {
					var type = "author";
				}
				
				item.creators.push(_cloneIfNecessary(Zotero.Utilities.cleanAuthor(value, type, value.indexOf(",") !== -1), item));
			} else if(key == "rft.aucorp") {
				complexAu.push(_cloneIfNecessary({lastName:value, isInstitution:true}, item));
			} else if(key == "rft.isbn" && !item.ISBN) {
				item.ISBN = value;
			} else if(key == "rft.pub" || key == "rft.publisher") {
				item.publisher = value;
			} else if(key == "rft.place") {
				item.place = value;
			} else if(key == "rft.tpages") {
				item.numPages = value;
			} else if(key == "rft.edition") {
				item.edition = value;
			} else if(key == "rft.series") {
				if(item.itemType == "report") {
					item.seriesTitle = value;
				} else {
					item.series = value;
				}
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
			} else {
				// The following keys are technically only valid in Dublin Core
				// (i.e., format == "info:ofi/fmt:kev:mtx:dc") but in practice
				// 'format' is not always set
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
					item.abstractNote = value;
				} else if(key == "rft.rights") {
					item.rights = value;
				} else if(key == "rft.language") {
				  	item.language = value;
				}  else if(key == "rft.subject") {
					item.tags.push(value);
				} else if(key == "rft.type") {
					if(Zotero.Utilities.itemTypeExists(value)) item.itemType = value;
				} else if(key == "rft.source") {
					item.publicationTitle = value;
				}
			}
		}

		// To maintain author ordering when complex and simple authors are combined,
		// we remember where they were and the correct offsets
		var inserted = 0;
		
		// combine two lists of authors, eliminating duplicates
		for(var i=0; i<complexAu.length; i++) {
			var pushMe = true;
			var offset = complexAu[i].offset;
			delete complexAu[i].offset;
			for (var j = 0; j < item.creators.length; j++) {
			    // if there's a plain author that is close to this author (the
			    // same last name, and the same first name up to a point), keep
			    // the plain author, since it might have a middle initial
			    if (item.creators[j].lastName == complexAu[i].lastName &&
			        item.creators[j].firstName &&
			        ((item.creators[j].firstName == "" && complexAu[i].firstName == "") ||
			            (item.creators[j].firstName.length >= complexAu[i].firstName.length &&
			                item.creators[j].firstName.substr(0, complexAu[i].firstName.length) == complexAu[i].firstName))) {
			        pushMe = false;
			        break;
			    }
			}
			// Splice in the complex creator at the correct location,
			// accounting for previous insertions
			if(pushMe) {
				item.creators.splice(offset + inserted, 0, complexAu[i]);
				inserted++;
			}
		}
		
		return item;
	}
}

if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = Zotero.OpenURL;
}
