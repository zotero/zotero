{
	"translatorID":"c82c574d-7fe8-49ca-a360-a05d6e34fec0",
	"translatorType":4,
	"label":"zotero.org",
	"creator":"Dan Stillman",
	"target":"^https?://[^/]*zotero\\.org/(groups/)?[^/]+/(items(/?[0-9]+?)?|items/collection/[0-9]+)(\\?.*)?$",
	"minVersion":"1.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-05-29 22:55:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
	
	// Skip private groups
	if (url.match(/\/groups\/[0-9]+\/items/)) {
		return false;
	}
	
	var a = doc.evaluate('//li[@id="library-tab"]/a[text()="My Library"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	// Skip current user's library
	if (a && url.indexOf(a.href.match(/(^.+)\/items/)[1]) == 0) {
		return false;
	}
	// Library and collections
	if (url.match(/\/items\/?(\?.*)?$/) || url.match(/\/items\/collection\/[0-9]+(\?.*)?$/)) {
		if (!doc.getElementById("field-table")) {
			return false;
		}
		return "multiple";
	}

	// Individual item
	else if (url.match(/\/items\/[0-9]+(\?.*)?$/)) {
		// TODO: embed in page, because this is absurd
		var typeMap = {
			"Note": "note",
			"Attachment": "attachment",
			"Book": "book",
			"Book Section": "bookSection",
			"Journal Article": "journalArticle",
			"Magazine Article": "magazineArticle",
			"Newspaper Article": "newspaperArticle",
			"Thesis": "thesis",
			"Letter": "letter",
			"Manuscript": "manuscript",
			"Interview": "interview",
			"Film": "film",
			"Artwork": "artwork",
			"Web Page": "webpage",
			"Report": "report",
			"Bill": "bill",
			"Case": "case",
			"Hearing": "hearing",
			"Patent": "patent",
			"Statute": "statute",
			"E-mail": "email",
			"Map": "map",
			"Blog Post": "blogPost",
			"Instant Message": "instantMessage",
			"Forum Post": "forumPost",
			"Audio Recording": "audioRecording",
			"Presentation": "presentation",
			"Video Recording": "videoRecording",
			"TV Broadcast": "tvBroadcast",
			"Radio Broadcast": "radioBroadcast",
			"Podcast": "podcast",
			"Computer Program": "computerProgram",
			"Conference Paper": "conferencePaper",
			"Document": "document",
			"Encyclopedia Article":"encyclopediaArticle",
			"Dictionary Entry": "dictionaryEntry"
		};
		var td = doc.evaluate('//div[@id="content"]/div[@class="major-col"]/table//tr[th[text()="Item Type"]]/td', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		return td ? typeMap[td.textContent] : "book";
	}
}

function xmlToItem(xmlItem) {
	// "with ({});" needed to fix default namespace scope issue
	// See https://bugzilla.mozilla.org/show_bug.cgi?id=330572
	default xml namespace = 'http://zotero.org/namespaces/transfer'; with ({});
	var itemType = xmlItem.@itemType;
	
	// FIXME: translate.js only allow top-level attachments in import mode
	if (itemType == 'attachment') {
		itemType = 'document';
	}
	
	var newItem = new Zotero.Item(itemType);
	
	// Don't auto-set repository
	newItem.repository = false;
	
	for each(var field in xmlItem.field) {
		var fieldName = field.@name.toString();
		newItem[fieldName] = field.toString();
	}
	
	// Item creators
	for each(var creator in xmlItem.creator) {
		var data = {
			creatorType: creator.@creatorType
		};
		if (creator.creator.fieldMode == 1) {
			data.fieldMode = 1;
			data.lastName = creator.creator.name.toString();
		}
		else {
			data.firstName = creator.creator.firstName.toString();
			data.lastName = creator.creator.lastName.toString();
		}
		newItem.creators.push(data);
	}
	
	// Both notes and attachments might have parents and notes
	if (itemType == 'note' || itemType == 'attachment') {
		newItem.note = xmlItem.note.toString();
	}
	
	// Attachment metadata
	if (itemType == 'attachment') {
		//newItem.attachmentLinkMode = parseInt(xmlItem.@linkMode);
		newItem.mimeType = xmlItem.@mimeType.toString();
		newItem.charset = xmlItem.@charset.toString();
		var path = xmlItem.path.toString();
		if (path) { 
			newItem.path = path;
		}
	}
	
	newItem.complete();

}


function doWeb(doc, url) {
	// User library
	if (url.indexOf("/groups/") == -1) {
		//var userID = url.match(/^http:\/\/[^\/]*zotero\.org\/[^\/]+\/([0-9]+)/)[1];
		var userID = doc.getElementById('libraryUserID').getAttribute('title');
		var apiPrefix = "https://api.zotero.org/users/" + userID + "/";
		var itemRe = /^https?:\/\/[^\/]*zotero\.org\/[^\/]+\/items\/([0-9]+)/;
	}
	// Group library
	else {
		//var groupID = url.match(/^http:\/\/[^\/]*zotero\.org\/groups\/[^\/]+\/([0-9]+)/)[1];
		var groupID = doc.getElementById('libraryGroupID').getAttribute('title');
		var apiPrefix = "https://api.zotero.org/groups/" + groupID + "/";
		var itemRe = /^https?:\/\/[^\/]*zotero\.org\/groups\/[^\/]+\/items\/([0-9]+)/;
	}
	
	var nsAtom = new Namespace('http://www.w3.org/2005/Atom');
	var nsZXfer = new Namespace('http://zotero.org/namespaces/transfer');
	
	if (detectWeb(doc, url) == "multiple") {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
			} : null;
		var column = doc.evaluate('//table[@id="field-table"]//td[1][@class="title"][not(contains(./a, "Unpublished Note"))]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elems = [], td;
		while (td = column.iterateNext()) {
			elems.push(td);
		}
		var items = Zotero.Utilities.getItemArray(doc, elems);
		
		items = Zotero.selectItems(items);
		if (!items) {
			return true;
		}
		
		var apiURLs = [], itemID, apiURL;
		for (var url in items) {
			itemID = url.match(itemRe)[1];
			apiURL = apiPrefix + "items/" + itemID + "?content=full";
			apiURLs.push(apiURL);
		}
		
		Zotero.Utilities.HTTP.doGet(apiURLs, function(text) {
			// Strip XML declaration and convert to E4X
			var entry = new XML(text.replace(/<\?xml.*\?>/, ''));
			xmlToItem(entry.nsAtom::content.nsZXfer::item);
		}, function () { Zotero.done(); });
	}
	else {
		var itemID = url.match(itemRe)[1];
		var apiURL = apiPrefix + "items/" + itemID + "?content=full";
		Zotero.Utilities.doGet(apiURL, function (text) {
			// Strip XML declaration and convert to E4X
			var entry = new XML(text.replace(/<\?xml.*\?>/, ''));
			xmlToItem(entry.nsAtom::content.nsZXfer::item);
			Zotero.done();
		});
	}
	Zotero.wait();
}
