{
	"translatorID":"dede653d-d1f8-411e-911c-44a0219bbdad",
	"translatorType":4,
	"label":"GPO Access e-CFR",
	"creator":"Bill McKinney",
	"target":"^http://ecfr\\.gpoaccess\\.gov/cgi/t/text/text-idx.+",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-06-18 18:15:00"
}

function detectWeb(doc, url) {
	var re = new RegExp("^http://ecfr\.gpoaccess\.gov/cgi/t/text/text-idx");
	if(re.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}

function get_nextsibling(n)
  {
  var x=n.nextSibling;
  while (x.nodeType!=1)
   {
   x=x.nextSibling;
   }
  return x;
}
function scrape(doc) {

	var newItem = new Zotero.Item("statute");
	newItem.url = doc.location.href;
	var extraText = new String();
	var tmpSection = "";
	newItem.code = "Electronic Code of Federal Regulations";
	newItem.language = "en-us";
	
	var spanTags = doc.getElementsByTagName("span");
	for(var i=0; i<spanTags.length; i++) {
		if (spanTags[i].className == "mainheader") {
			var tmpStr = spanTags[i].innerHTML;
			tmpStr = tmpStr.replace(/\&nbsp;/g, " ");
			tmpStr = tmpStr.replace(/\&\#167;/g, "Sec.");
			newItem.codeNumber = tmpStr;
			newItem.title = "e-CFR: " + tmpStr;
		}
		if (spanTags[i].className == "div5head") {
			var tmpStr = spanTags[i].childNodes[0].innerHTML;
			tmpStr = tmpStr.replace(/\&nbsp;/g, " ");
			tmpStr = tmpStr.replace(/\&\#167;/g, "Sec.");
			tmpSection = tmpStr;
		}
	}

	var heading5Tags = doc.getElementsByTagName("h5");
	for(var i=0; i<heading5Tags.length; i++) {
		var tmpStr = heading5Tags[0].innerHTML;
		tmpStr = tmpStr.replace(/\&nbsp;/g, " ");
		tmpStr = tmpStr.replace(/\&\#167;/g, "Sec.");
		if (tmpSection != "") {
			tmpSection = tmpSection + " - ";
		}
		newItem.section = tmpSection + tmpStr;
		break;
	}

	// statutory source
	var boldTags = doc.getElementsByTagName("b");
	for(var i=0; i<boldTags.length; i++) {
		var s = new String(boldTags[i].innerHTML);
		if (s.indexOf("Source:") > -1) {
			newItem.history = "Source: " + boldTags[i].nextSibling.nodeValue;
		}
		if (s.indexOf("Authority:") > -1) {
			newItem.extra = "Authority: " + boldTags[i].nextSibling.nodeValue;
		}
	}

	newItem.complete();
}

function doWeb(doc, url) {
	var re = new RegExp("http://ecfr\.gpoaccess\.gov/cgi/t/text/text-idx.+");
	if(re.test(doc.location.href)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc,"http://ecfr\.gpoaccess\.gov/cgi/t/text/text-idx.+");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Zotero.Utilities.processDocuments(uris, function(doc) { scrape(doc) },
			function() { Zotero.done(); }, null);
		
		Zotero.wait();
	}
}