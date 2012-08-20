/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2012 Center for History and New Media
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
"use strict";

// Necessary to prevent JQuery from dying
window.History.prototype.pushState = window.History.prototype.replaceState = function() {};

var Zotero = Components.classes["@zotero.org/Zotero;1"]
	.getService(Components.interfaces.nsISupports)
	.wrappedJSObject;

/** ACTIONS **/

var Actions = {
	/**
	 * Perform translation
	 * @param {String} translatorID
	 * @param {Integer} libraryID
	 * @param {Integer} collectionID
	 */
	"translate": function(translatorID, libraryID, collectionID) {
		ZoteroData.translate.setTranslator(translatorID);
		window.parent.Zotero_Browser.performTranslation(ZoteroData.translate, libraryID,
			Zotero.Collections.get(collectionID));
	},
	
	/**
	 * Save a webpage item
	 * @param {Integer} libraryID
	 * @param {Integer} collectionID
	 * @param {Event} event The event that triggered the save. This is passed so that
	 *     its properties may be used to determine whether to save a snapshot.
	 */
	"saveWebPage": function(libraryID, collectionID, event) {
		// TODO make this save to the right library/collection
		window.parent.ZoteroPane.addItemFromPage('temporaryPDFHack',
			event.shiftKey ? !Zotero.Prefs.get('automaticSnapshots') : null);
	},
	
	/**
	 * Lookup with a locate engine
	 * @param {String} locateEngine The name of the locate engine
	 * @param {Event} event The event that triggered the save. This is passed so that
	 *     its properties may be used to determine whether to open a new window.
	 */
	"lookup": function(locateEngine, event) {
		ZoteroData.translate.setTranslator(ZoteroData.translators[0]);
		window.parent.Zotero_Browser.performLookup(ZoteroData.translate,
			locateEngine === "Library Lookup" ? null : locateEngine, event);
	},
	
	/**
	 * Resize the panel to fit its contents
	 * @param {Integer} width The inner width the panel should be sized to
	 * @param {Integer} height The inner height the pannel should be sized to
	 */
	"resize": function(width, height) {
		var panel = window.parent.document.getElementById("zotero-save-panel");
		if(!panel) return;
		panel.sizeTo(panel.clientWidth-window.innerWidth+width,
			panel.clientHeight-window.innerHeight+height);
	},
	
	/**
	 * Close the panel
	 */
	"close": function() {
		var panel = window.parent.document.getElementById("zotero-save-panel");
		if(!panel) return;
		panel.hidePopup();
	}
};

/** DATA ACCESS **/

/**
 * @namespace
 */
var CollectionList = {
	/**
	 * Get library list
	 * @return {Promise}
	 */
	"getLibraries":function getLibraries() {
		var collections = [{
				"name":Zotero.getString("pane.collections.library"),
				"id":null,
				"libraryID":null,
				"hasChildCollections":!!Zotero.getCollections(null, false, null).length
			}],
			groups = Zotero.Groups.getAll();
		for(var i=0; i<groups.length; i++) {
			var group = groups[i],
				libraryID = group.libraryID;
			if(Zotero.Libraries.isEditable(libraryID)) {
				collections.push({
					"name":group.name,
					"id":null,
					"libraryID":libraryID,
					"hasChildCollections":!!Zotero.getCollections(null, false, libraryID).length
				});
			}
		}
		return Q.resolve(collections);
	},
	
	/**
	 * Get child collections of a given collection or library
	 * @return {Promise}
	 */
	"getCollections":function getCollections(collectionID, libraryID) {
		return Q.resolve([{
				"name":collection.name,
				"id":collection.id,
				"libraryID":collection.libraryID,
				"hasChildCollections":collection.hasChildCollections()
			} for each(collection in Zotero.getCollections(collectionID, false, libraryID))]);
	}
};

/**
 * @namespace
 */
var RecentlyUsed = {
	"MAX": 5,
	"_collections": null,
	
	/**
	 * Get an array of recently used collections
	 * @return {Promise}
	 */
	"get":function get() {
		// Load saved collections
		if(!this._collections) {
			this._collections = [];
			
			var savedCollections;
			try {
				savedCollections = JSON.parse(Zotero.Prefs.get("saveItem.recentlyUsed"));
				for(var i=0; i<savedCollections.length; i++) {
					this.add(this._collections, savedCollections[i]);
				}
			} catch(e) {
				savedCollections = [];
			};
			
			// Get currently selected collection
			try {
				var pane = Zotero.getActiveZoteroPane(),
					collection = pane.getSelectedCollection();
				this.add(this._collections, {
					"id": (collection ? collection.id : null),
					"libraryID": (collection ? collection.libraryID : pane.getSelectedLibraryID())
				}, true);
			} catch(e) {};
		}
		
		return Q.resolve(this._collections.slice());
	},
	
	/**
	 * Add a collection to the recently used list
	 * @param {Object[]} collectionList
	 * @param {Object} collection
	 * @param {Boolean} prepend Whether to prepend the collection to the collection list
	 * @return {Object[]} New collection list
	 */
	"add":function add(collectionList, collection, prepend) {
		// Don't append more than MAX items to the list
		if(collectionList.length >= this.MAX && !prepend) return;
		
		// Ensure that there are no duplicates of this collection already in the list
		if(this._checkForDuplicate(collectionList, collection, prepend)) {
			return collectionList;
		}
		
		// Ensure that the collection exists and is editable
		if((collection.libraryID && (
				!Zotero.Libraries.exists(collection.libraryID) || 
				!Zotero.Libraries.isEditable(collection.libraryID)
			)) || (collection.id &&
				!Zotero.Collections.get(collection.id))) {
			return collectionList;
		}
		
		// Clone collection and modify name so that it contains the library name
		var newCollection = {
				"id":collection.id,
				"libraryID":collection.libraryID
			},
			libraryName = newCollection.libraryID
				? Zotero.Libraries.getName(newCollection.libraryID)
				: Zotero.getString("pane.collections.library");
		if(newCollection.id) {
			var zoteroCollection = Zotero.Collections.get(newCollection.id);
			newCollection.name = zoteroCollection.name+" ("+libraryName+")";
			newCollection.hasChildCollections = zoteroCollection.hasChildCollections();
		} else {
			newCollection.name = libraryName;
			newCollection.hasChildCollections = !!Zotero.getCollections(newCollection.libraryID, false, null).length
		}
		
		// Add to list
		collectionList[prepend ? "unshift" : "push"](newCollection);
		// Make sure list length doesn't exceed maximum
		if(collectionList.length > this.MAX) collectionList.pop();
		return collectionList;
	},
	
	/**
	 * Save a new collection to the recently used list
	 * @param {Object} collection
	 */
	"save":function save(collection) {
		if(!this._checkForDuplicate(this._collections, collection, true)) {
			this._collections.unshift({"id":collection.id, "libraryID":collection.libraryID});
		}
		if(this._collections.length > this.MAX) {
			this._collections = this._collections.slice(0, this.MAX);
		}
		Zotero.Prefs.set("saveItem.recentlyUsed", JSON.stringify(this._collections));
	},
	
	/**
	 * Check for a duplicate of this item, optionally moving it to the top if it is
	 * already present in the list
	 */
	"_checkForDuplicate":function _checkForDuplicate(list, collection, moveToTop) {
		for(var i=0; i<list.length; i++) {
			var currentCollection = list[i];
			if(currentCollection.id == collection.id
					&& currentCollection.libraryID == collection.libraryID) {
				if(moveToTop) {
					// In prepend mode, move the collection to the top of the list
					list.splice(i, 1);
					list.unshift(currentCollection);
				}
				return true;
			}
		}
		return false;
	}
};

/**
 * @namespace
 */
var LookupEngines = {
	"get":function get() {
		return Translators.get().then(function(translators) {
			if(!translators.length) return Q.resolve([]);
			var lookupEngines = Zotero.LocateManager.getVisibleEngines();
			lookupEngines.splice(0, 0, {
				"name":"Library Lookup",
				"icon":"chrome://zotero/skin/locate-library-lookup.png"
			});
			return Q.resolve(lookupEngines);
		});
	}
};

/**
 * @namespace
 */
var Translators = {
	"get":function get() {
		return Q.resolve((typeof ZoteroData !== "undefined" && ZoteroData.translators) || []);
	}
};

/** DOM MANIPULATION **/

/**
 * @namespace
 */
var EventHandlers = {
	/**
	 * Called when the navbar is clicked to switch between save and lookup modes
	 */
	"navbarClick":function navbarClick(mode) {
		$("#save")[mode === "save" ? "show" : "hide"]();
		$("#lookup")[mode === "lookup" ? "show" : "hide"]();
	},
	
	/**
	 * Called when the arrow next to a collection is clicked to generate and move to the
	 * page containing the collection contents
	 */
	"arrowClick":function arrowClick(event) {
		function updateBackButton(button) {
			button.attr("href", "#"+$.mobile.activePage.prop('id'));
		}
		
		event.stopPropagation();
		var collection = event.data,
			libraryID = collection.libraryID,
			collectionID = collection.id,
			collectionName = collection.name,
			pageID = "collection-"+libraryID+"-"+collectionID;
		
		var existingPage = document.getElementById(pageID);
		if(existingPage) {
			existingPage = $(existingPage);
			updateBackButton(existingPage.find(".backbutton"));
			$.mobile.changePage($(existingPage), {"transition":"slide"});
		} else {
			CollectionList.getCollections(collectionID, libraryID).then(function(collections) {
				Builder.sortCollections(collections);
				var page = $(document.createElement("div")),
					content = $(document.createElement("div")),
					listview = $(document.createElement("ul")),
					header = $(document.createElement("div")),
					header_h1 = $(document.createElement("h1")),
					back = $(document.createElement("a"));
				page.attr({"id":pageID, "name":collectionName, "data-role":"page"});
				page.addClass("collection-page");
				content.attr({"data-role":"content"});
				listview.attr({"id":"listview-"+pageID, "data-role":"listview",
					"data-divider-theme":"b"});
				header.attr({"data-role":"header", "data-theme":"b"});
				header_h1.text(collectionName);
				back.attr({"data-transition":"slide", "data-direction":"reverse",
					"data-icon":"arrow-l"});
				back.text("Back");
				updateBackButton(back);
				
				header.append(back);
				header.append(header_h1);
				page.append(header);
				content.append(listview);
				page.append(content);
				$(document.body).append(page);
				page.on("pageinit", function() {
					Builder.collectionList(listview, collections);
				});
				$.mobile.changePage(page, {"transition":"slide"});
			});
		}
	},
	
	/**
	 * Called when the save button is clicked
	 */
	"saveClick":function saveClick(event) {
		var selectedCollection = $("#main-page .collection.ui-btn-active").data("collection");
		if(selectedCollection) {
			RecentlyUsed.save(selectedCollection);
			var translatorID = $("#main-page .translator[checked]").attr("value");
			if(translatorID === "webpage") {
				Actions.saveWebPage(selectedCollection.libraryID, selectedCollection.collectionID, event);
			} else {
				Actions.translate(translatorID, selectedCollection.libraryID, selectedCollection.id);
			}
			Actions.close();
		}
	},
	
	/**
	 * Called when a collection (not its arrow) is clicked to select that collection
	 */
	"collectionSelect":function collectionSelect(event) {
		var target = $(event.target);
		$("#main-page .collection.ui-btn-active").removeClass("ui-btn-active");
		if(target.parents("div[data-role=page]").attr("id") === "main-page") {
			target.parents(".collection").addClass("ui-btn-active");
		} else {
			var collection = event.data;
			RecentlyUsed.get().then(function(collections) {
				RecentlyUsed.add(collections, collection, true);
				Builder.recentlyUsedList(collections);
				$(".recently-used.collection").first().addClass("ui-btn-active");
				$.mobile.changePage("#main-page", {"reverse":true, "transition":"slide"});
			});
		}
	},
	
	/**
	 * Called when a lookup engine is selected
	 */
	"lookupSelect":function lookupSelect(event) {
		Actions.lookup(event.target.textContent, event);
		Actions.close();
	}
};

/**
 * @namespace
 */
var Builder = {
	/**
	 * Sort a list of collections alphabetically
	 */
	"sortCollections":function(collections) {
		collections.sort(function(a, b) {
			var aLibraryID = a.libraryID, bLibraryID = b.libraryID;
			if(aLibraryID === null && bLibraryID !== null) return -1;
			if(aLibraryID !== null && bLibraryID === null) return 1;
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		});
	},
	
	/**
	 * Add collections to the DOM
	 * @param {listview} listview A JQM listview to add the list to
	 * @param {Object[]} collections Collections to add to the list. Each collection must
	 *     have name, id, and libraryID properties
	 * @param {Boolean} prepend Whether to prepend to listview
	 * @return {JQueryNode[]}
	 */
	"collectionList":function collectionList(listview, collections, prepend) {
		listview = $(listview);
		var lis = [], insert;
		if(prepend) {
			var after;
			insert = function(el) {
				if(after) {
					after.after(el);
				} else {
					listview.prepend(el);
				}
				after = el;
			};
		} else {
			insert = function(el) {
				listview.append(el);
			}
		}
		
		for(var i=0; i<collections.length; i++) {
			var el = lis[i] = $(document.createElement("li")),
				collection = collections[i];
			el.addClass("collection");
			el.data("collection", collection);
			$.fn.jqmData(el, "theme", "c");
			
			var a = $(document.createElement("a"));
			a.text(collection.name);
			a.on("click", collection, EventHandlers.collectionSelect);
			el.append(a);
			insert(el);
		}
		
		listview.listview("refresh");
		
		// Hack list to change action of arrows
		for(var i=0; i<lis.length; i++) {
			var arrowSpan = lis[i].find(".ui-icon-arrow-r"),
				collection = collections[i];
			if(collection.hasChildCollections) {
				arrowSpan.css("zIndex", 2);
				arrowSpan.on("mousedown", collection, EventHandlers.arrowClick);
			} else {
				arrowSpan.hide();
			}
		}
		
		return lis;
	},
	
	/**
	 * Add a divider to the DOM
	 * @param {listview} listview A JQM listview to add the divider to
	 * @param {String} name Name of the divider
	 * @param {Boolean} prepend Whether to prepend to listview
	 * @return {JQueryNode}
	 */
	"divider":function divider(listview, name, prepend) {
		var li = $(document.createElement("li"));
		$.fn.jqmData(li, "role", "list-divider");
		li.addClass("ui-bar-d divider");
		li.text(name);
		$(listview)[prepend ? "prepend" : "append"](li);
		return li;
	},
	
	/**
	 * Build or refresh the recently used list, adding the divider if necessary
	 */
	"recentlyUsedList":function recentlyUsedList(recentlyUsed) {
		$(".recently-used").remove();
		if(recentlyUsed.length) {
			var listview = $("#main-page-list-view"),
				nodes = Builder.collectionList(listview, recentlyUsed, true);
			for(var i=0; i<nodes.length; i++) {
				nodes[i].addClass("recently-used");
			};
			nodes[0].addClass("ui-btn-active");
			$("#save-button").removeClass("ui-disabled");
			Builder.divider(listview, "Recently Used", true).addClass("recently-used");
			listview.listview("refresh");
		}
	}
};

$("#main-page").on("pageinit", function() {
	var header = "navbar";
	
	RecentlyUsed.get().then(Builder.recentlyUsedList);
	
	CollectionList.getLibraries().then(function(libraries) {
		Builder.sortCollections(libraries);
		var listview = $("#main-page-list-view");
		Builder.divider(listview, "Libraries");
		Builder.collectionList(listview, libraries);
	});
	
	LookupEngines.get().then(function(lookupEngines) {
		// If no lookup engines, don't show navbar
		if(!lookupEngines.length) {
			header = "header";
			$("#navbar").hide();
			$("#header").show();
			return;
		}
	
		// Create CSS styles for icons
		var style = "";
		for(var i=0; i<lookupEngines.length; i++) {
			style += ".ui-icon-locate-engine-"+i+" { "+
				"background-image: url("+lookupEngines[i].icon+"); "+
				"width: 16px; "+
				"height: 16px; "+
				"border-radius: 0; "+
				"background-color: transparent; "+
			"}";
		}
		
		// Add CSS styles to document
		var styleNode = document.createElement('style');
		styleNode.type = "text/css";
		if("styleSheet" in styleNode) {	// IE
			styleNode.styleSheet.cssText = style;
		} else {						// Other browsers
			styleNode.appendChild(document.createTextNode(style));
		}
		document.getElementsByTagName('head')[0].appendChild(styleNode);
		
		// Add buttons
		var lookupButtons = $(document.createElement("div"));
		lookupButtons.attr({"data-role":"controlgroup"});
		for(var i=0; i<lookupEngines.length; i++) {
			var a = $(document.createElement("a"));
			a.text(lookupEngines[i].name);
			a.attr({"data-role":"button", "data-mini":"true", "data-icon":"locate-engine-"+i});
			a.on("click", EventHandlers.lookupSelect);
			lookupButtons.append(a);
		}
		$("#lookup").append(lookupButtons).trigger("create");
	});
	
	Translators.get().then(function(translators) {
		// Add buttons
		var fieldset = $(document.createElement("fieldset"));
		fieldset.attr({"data-role":"controlgroup", "data-mini":"true"});
		for(var i=0; i<translators.length; i++) {
			var translator = translators[i],
				input = $(document.createElement("input")),
				label = $(document.createElement("label"));
			// TODO localize
			label.text('Using "'+translator.label+'"');
			label.attr({"for":translator.translatorID});
			input.addClass("translator");
			input.attr({"name":"translatorID",
				"id":translator.translatorID,
				"value":translator.translatorID,
				"type":"radio"});
			if(i === 0) input.attr("checked", "1");
			fieldset.append(input, label);
		}
		
		var input = $(document.createElement("input")),
			label = $(document.createElement("label"));
		// TODO localize
		label.text('As Web Page Item');
		label.attr({"for":"webpage"});
		input.addClass("translator");
		input.attr({"name":"translatorID",
			"id":"webpage",
			"value":"webpage",
			"type":"radio"});
		if(i === 0) input.attr("checked", "1");
		fieldset.append(input, label);
		
		$("#translators").append(fieldset).trigger("create");
		
		// Resize window
		var newHeight = document.getElementById(header).clientHeight+document.getElementById("save").clientHeight;
		if(newHeight !== window.innerHeight) {
			Actions.resize(window.innerWidth, newHeight);
		}
	}).end();
});