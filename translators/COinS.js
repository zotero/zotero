{
	"translatorID":"05d07af9-105a-4572-99f6-a8e231c0daef",
	"translatorType":4,
	"label":"COinS",
	"creator":"Simon Kornblith",
	"target":null,
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":300,
	"inRepository":true,
	"lastUpdated":"2007-09-15 20:08:46"
}

function detectWeb(doc, url) {
	var spanTags = doc.getElementsByTagName("span");
	
	var encounteredType = false;
	
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Zotero.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				
				// determine if it's a valid type
				var item = new Zotero.Item;
				var success = Zotero.Utilities.parseContextObject(spanTitle, item);
				
				if(item.itemType) {
					if(encounteredType) {
						return "multiple";
					} else {
						encounteredType = item.itemType;
					}
				}
			}
		}
	}
	
	return encounteredType;
}

// used to retrieve next COinS object when asynchronously parsing COinS objects
// on a page
function retrieveNextCOinS(needFullItems, newItems, couldUseFullItems, doc) {
	if(needFullItems.length) {
		var item = needFullItems.shift();
		
		Zotero.debug("looking up contextObject");
		var search = Zotero.loadTranslator("search");
		search.setHandler("itemDone", function(obj, item) {
			newItems.push(item);
		});
		search.setHandler("done", function() {
			retrieveNextCOinS(needFullItems, newItems, couldUseFullItems, doc);
		});
		search.setSearch(item);
		
		// look for translators
		var translators = search.getTranslators();
		if(translators.length) {
			search.setTranslator(translators);
			search.translate();
		} else {
			retrieveNextCOinS(needFullItems, newItems, couldUseFullItems, doc);
		}
	} else {
		completeCOinS(newItems, couldUseFullItems, doc);
		Zotero.done();
	}
}

// saves all COinS objects
function completeCOinS(newItems, couldUseFullItems, doc) {
	if(newItems.length > 1) {
		var selectArray = new Array();
		
		for(var i in newItems) {
			selectArray[i] = newItems[i].title;
		}
		selectArray = Zotero.selectItems(selectArray);
		
		var useIndices = new Array();
		for(var i in selectArray) {
			useIndices.push(i);
		}
		completeItems(newItems, useIndices, couldUseFullItems);
	} else if(newItems.length) {
		completeItems(newItems, [0], couldUseFullItems);
	}
}

function completeItems(newItems, useIndices, couldUseFullItems, doc) {
	if(!useIndices.length) {
		return;
	}
	var i = useIndices.shift();
	
	// grab full item if the COinS was missing an author
	if(couldUseFullItems[i]) {
		Zotero.debug("looking up contextObject");
		var search = Zotero.loadTranslator("search");
		
		var firstItem = false;
		search.setHandler("itemDone", function(obj, newItem) {
			if(!firstItem) {
				// add doc as attachment
				newItem.attachments.push({document:doc});
				newItem.complete();
				firstItem = true;
			}
		});
		search.setHandler("done", function(obj) {
			// if we didn't find anything, use what we had before (even if it
			// lacks the creator)
			if(!firstItem) {
				newItems[i].complete();
			}
			// call next
			completeItems(newItems, useIndices, couldUseFullItems);
		});
		
		search.setSearch(newItems[i]);			
		var translators = search.getTranslators();
		if(translators.length) {
			search.setTranslator(translators);
			search.translate();
		} else {
			// add doc as attachment
			newItems[i].attachments.push({document:doc});
			newItems[i].complete();
			// call next
			completeItems(newItems, useIndices, couldUseFullItems);
		}
	} else {
		// add doc as attachment
		newItems[i].attachments.push({document:doc});
		newItems[i].complete();
		// call next
		completeItems(newItems, useIndices, couldUseFullItems);
	}
}

function doWeb(doc, url) {
	var newItems = new Array();
	var needFullItems = new Array();
	var couldUseFullItems = new Array();
	
	var spanTags = doc.getElementsByTagName("span");
	
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Zotero.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				var newItem = new Zotero.Item();
				newItem.repository = false;	// do not save repository
				if(Zotero.Utilities.parseContextObject(spanTitle, newItem)) {
					if(newItem.title) {
						if(!newItem.creators.length) {
							// if we have a title but little other identifying
							// information, say we'll get full item later
							newItem.contextObject = spanTitle;
							couldUseFullItems[newItems.length] = true;
						}
						
						// title and creators are minimum data to avoid looking up
						newItems.push(newItem);
					} else {
						// retrieve full item
						newItem.contextObject = spanTitle;
						needFullItems.push(newItem);
					}
				}
			}
		}
	}
	
	Zotero.debug(needFullItems);
	if(needFullItems.length) {
		// retrieve full items asynchronously
		Zotero.wait();
		retrieveNextCOinS(needFullItems, newItems, couldUseFullItems, doc);
	} else {
		completeCOinS(newItems, couldUseFullItems, doc);
	}
}