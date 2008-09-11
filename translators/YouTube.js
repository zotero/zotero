{
	"translatorID":"d3b1d34c-f8a1-43bb-9dd6-27aa6403b217",
	"translatorType":4,
	"label":"YouTube",
	"creator":"Sean Takats and Michael Berkowitz",
	"target":"https?://[^/]*youtube\\.com\\/",
	"minVersion":"1.0.0rc4",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-03-30 08:30:00"
}

function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
	var xpath = '//input[@type="hidden" and @name="video_id"]';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "videoRecording";
	}
	if (doc.evaluate('//div[@class="vtitle"]/a[@class="vtitlelink" and contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	}
	if (doc.evaluate('//div[starts-with(@class, "vtitle")]/a[contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){	
		return "multiple";
	}
	if (doc.evaluate('//div[@class="vltitle"]/div[@class="vlshortTitle"]/a[contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){	
		return "multiple";
	}
}



function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
	var host = doc.location.host;
	var video_ids = new Array();
	var xpath = '//input[@type="hidden" and @name="video_id"]';
	var elmts;
	var elmt;
	elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	elmt = elmts.iterateNext();
	if(elmt) {
		//single video
		var video_id = elmt.value;
		video_ids.push(video_id);
	} else {
		// multiple videos
		var items = new Object();
		var videoRe = /\/watch\?v=([a-zA-Z0-9-_]+)/;
// search results		
		if (elmt = doc.evaluate('//div[@class="vtitle"]/a[@class="vtitlelink" and contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate('//div[@class="vtitle"]/a[@class="vtitlelink" and contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
// categories and community pages and user pages and browse pages
		} else if (doc.evaluate('//div[starts-with(@class, "vtitle")]/a[contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate('//div[starts-with(@class, "vtitle")]/a[contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (doc.evaluate('//div[@class="vltitle"]/div[@class="vlshortTitle"]/a[contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate('//div[@class="vltitle"]/div[@class="vlshortTitle"]/a[contains(@href, "/watch?v=")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		while (elmt = elmts.iterateNext()){
			var title = elmt.textContent;
			title = Zotero.Utilities.trimInternal(title);
			var link = elmt.href;
			var m = videoRe(link);
			var video_id = m[1];
			items[video_id] = title;
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for(var i in items) {
			video_ids.push(i);
		}
	}
	getData(video_ids, host);			
}

function getData(ids, host){
	var uris = new Array();	
	var url = "http://gdata.youtube.com/feeds/videos/";
	for each(var id in ids){
		uris.push(url+id);
	}
	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		// clean up header
		text = text.replace(/<\?xml[^>]*\?>/, "");
		text = text.replace(/<entry[^>]*>/, "<entry>");
		// replace colons in XML tags
		text = text.replace(/<media:/g, "<media_").replace(/<\/media:/g, "</media_");
//		text = text.replace(/<yt:/g, "<yt_").replace(/<\/yt:/g, "</yt_");
		text = text.replace(/yt:/g, "yt_");
		text = text.replace(/<gd:/g, "<gd_").replace(/<\/gd:/g, "</gd_");
		text = text.replace(/<\/?(georss|gml)[^>]+>/g, "");
		// pad xml
		text = "<zotero>"+text+"</zotero>";
		var xml = new XML(text);
		var newItem = new Zotero.Item("videoRecording");
		var title = "";
		var title = xml..media_title[0].text().toString();
		if (xml..media_title.length()){
			var title = Zotero.Utilities.cleanString(xml..media_title[0].text().toString());
			if (title == ""){
				title = " ";
			}
			newItem.title = title;
		}
		if (xml..media_keywords.length()){
			var keywords = xml..media_keywords[0].text().toString();
			keywords = keywords.split(",");
			for each(var tag in keywords){
				newItem.tags.push(Zotero.Utilities.trimInternal(tag));
			}
		}
		if (xml..published.length()){
			var date = xml..published[0].text().toString();
			newItem.date = date.substr(0, 10);
		}
		if (xml..author.name.length()){
			var author = xml..author.name[0].text().toString();
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "contributor", true));
		}
		if (xml..media_player.length()){
			var url = xml..media_player[0].@url.toString();
			newItem.url = url;
			newItem.attachments.push({title:"YouTube Link", snapshot:false, mimeType:"text/html", url:url});
		}
		if (xml..yt_duration.length()){
			var runningTime = xml..yt_duration[0].@seconds.toString();
			newItem.runningTime = runningTime + " seconds";
		}
		if (xml..media_description.length()){
			newItem.abstractNote = xml..media_description[0].text().toString();
		}
		
		var next_url = newItem.url.replace(/\/\/([^/]+)/, "//" + host).replace("watch?v=", "v/") + '&rel=1';
		Zotero.Utilities.loadDocument(next_url, function(newDoc) {
			var new_url = newDoc.location.href.replace("swf/l.swf", "get_video");
			newItem.attachments.push({url:new_url, title:"YouTube Video Recording", mimeType:"video/x-flv"});
			newItem.complete();
		}, function() {Zotero.done;});
	});
	Zotero.wait();
}