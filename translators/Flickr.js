{
	"translatorID":"5dd22e9a-5124-4942-9b9e-6ee779f1023e",
	"translatorType":4,
	"label":"Flickr",
	"creator":"Sean Takats",
	"target":"^http://(?:www\\.)?flickr\\.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-01 17:20:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;

	if (elmt = doc.evaluate('//h1[@property="dc:title" and starts-with(@id, "title_div")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){		                       
		return "artwork";
	} else if (doc.evaluate('//td[@class="DetailPic"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	} else if (doc.evaluate('//div[contains(@class, "StreamView")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	} else if (doc.evaluate('//div[@id="setThumbs"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		if (!doc.URL.match('/comments/')) {
			return "multiple";
		}
	} else if (doc.evaluate('//p[@class="StreamList" or @class="UserTagList"]/span/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
	var items = new Object();
	var photo_ids = new Array();
	var uris = new Array();
	var key = "3cde2fca0879089abf827c1ec70268b5";

	var elmts;
	var elmt;

// single result
	if (elmt = doc.evaluate('//h1[@property="dc:title" and starts-with(@id, "title_div")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){		                       
		var photo_id = elmt.id;
		photo_id = photo_id.substr(9);
		photo_ids.push(photo_id);
	} else { //multiple results
		var photoRe = /\/photos\/[^\/]*\/([0-9]+)\//;
//search results
		if (doc.evaluate('//td[@class="DetailPic"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate('//td[@class="DetailPic"]//a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while (elmt = elmts.iterateNext()){
				var title = elmt.title;
				title = Zotero.Utilities.trimInternal(title);
				var link = elmt.href;
				var m = photoRe(link);
				var photo_id = m[1];
				items[photo_id] = title;
			}
// photo stream
		} else if (doc.evaluate('//div[contains(@class, "StreamView")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			if (doc.evaluate('//div[contains(@class, "StreamView") and starts-with(@id, "sv_title_")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				elmts = doc.evaluate('//div[contains(@class, "StreamView") and starts-with(@id, "sv_title_")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			} else {
				elmts = doc.evaluate('//div[contains(@class, "StreamView") and starts-with(@id, "sv_body_")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			}
			while (elmt = elmts.iterateNext()){
				//var title = Zotero.Utilities.trimInternal(elmt.textContent);
				var title = elmt.getElementsByTagName("h4")[0].textContent
				var photo_id = elmt.id;
				photo_id = photo_id.replace(/(sv_body_|sv_title_)/,''); 
				Zotero.debug("id="+photo_id)
				items[photo_id] = title;
			}
// photo set
		} else if (doc.evaluate('//div[@class="setThumbs-indv"]/span', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate('//div[@class="setThumbs-indv"]/span', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while (elmt = elmts.iterateNext()){
				var title = doc.evaluate('./a/@title', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				var photo_id = elmt.id.substr(11);
				items[photo_id] = title;
			}
// tagged with
		} else if (doc.evaluate('//p[@class="StreamList" or @class="UserTagList"]/span/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			var elmts = doc.evaluate('//p[@class="StreamList" or @class="UserTagList"]//a[img]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while (elmt = elmts.iterateNext()){
				var title = Zotero.Utilities.trimInternal(elmt.title);
				var link = elmt.href;
				var m = photoRe(link);
				var photo_id = m[1];
				items[photo_id] = title;
			}
		} else {
			Zotero.debug('AND NOTHING');
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for(var i in items) {
			photo_ids.push(i);
		}
	}
	for each(var photo_id in photo_ids){
		uris.push("http://api.flickr.com/services/rest/?method=flickr.photos.getInfo&api_key="+key+"&photo_id="+photo_id);
	}
	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		text = text.replace(/<\?xml[^>]*\?>/, "");
		var xml = new XML(text);
		var newItem = new Zotero.Item("artwork");
		var title = "";
		if (xml..title.length()){
			var title = Zotero.Utilities.cleanString(xml..title[0].text().toString());
			if (title == ""){
				title = " ";
			}
			newItem.title = title;
		}
		for(var i=0; i<xml..tag.length(); i++) {
			newItem.tags.push(Zotero.Utilities.cleanString(xml..tag[i].text().toString()));
		}
		if (xml..dates.length()){
			var date = xml..dates[0].@taken.toString();
			newItem.date = date.substr(0, 10);
		}
		if (xml..owner.length()){
			var author = xml..owner[0].@realname.toString();
			if (author == ""){
				author = xml..owner[0].@username.toString();
			}
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "artist"));
		}
		if (xml..url.length()){
			newItem.url = xml..url[0].text().toString();
		}
		if (xml..description.length()){
			newItem.abstractNote = xml..description[0].text().toString();
		}
		var format = xml..photo[0].@originalformat.toString();
		var photo_id = xml..photo[0].@id.toString();
		
// get attachment code
		var uri = "http://api.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key="+key+"&photo_id="+photo_id;
		Zotero.Utilities.HTTP.doGet(uri, function(text) {
			text = text.replace(/<\?xml[^>]*\?>/, "");
			var xml = new XML(text);
			var last = xml..size.length() - 1;
			var attachmentUri = xml..size[last].@source.toString();
			newItem.attachments = [{title:title, url:attachmentUri}];
			newItem.complete();
		}, function(){Zotero.done();});	
	});
	Zotero.wait();
}