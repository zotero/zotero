{
	"translatorID":"0a84a653-79ea-4c6a-8a68-da933e3b504a",
	"translatorType":4,
	"label":"Alexander Street Press",
	"creator":"John West and Michael Berkowitz",
	"target":"http://(?:www\\.)alexanderstreet",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if( url.indexOf("object.details.aspx") != -1 ) {
		var zitemtype = doc.getElementById("ctl00_ctl00_MasterContentBody_ContentPlaceHolder1_txtZType").value;
		switch (zitemtype.toLowerCase()) {
		        case "book":
		        	return "book";
		        	break;
		        case "chapter":
		        	return "bookSection";
		        	break;
		        case "journal":
		        	return "journalArticle";
		        	break;
		        case "manuscript":
		        	return "manuscript";
		        	break;
		        case "audio":
		        	return "audioRecording";
		        	break;
		        case "video":
		        	return "videoRecording";
		        	break;
		        case "issue":
		        	return "journalArticle";
		        	break;
		        case "article":
		        	return "journalArticle";
		        	break;
		        case "series":
		        	return "interview";
		        	break;
		        case "session":
		        	return "interview";
		        	break;
		        default:
		        	return "document";
		}
	} else if (url.indexOf("results.aspx") != -1) {
		return "multiple";
	}
}

function scrape(doc, url) {
	// set prefix for serverside control
	var p = "ctl00_ctl00_MasterContentBody_ContentPlaceHolder1_txtZ";

	// get values from hidden inputs
	var ztype = GetItemType(doc.getElementById(p+"Type").value);
	var ztitle = doc.getElementById(p+"Title").value;
	var zbooktitle = doc.getElementById(p+"BookTitle").value;
	var znotes = doc.getElementById(p+"Notes").value;
	var zurl = doc.getElementById(p+"URL").value;
	var zrights = doc.getElementById(p+"Rights").value;
	var zseries = doc.getElementById(p+"Series").value;
	var zvolume = doc.getElementById(p+"Volume").value;
	var zissue = doc.getElementById(p+"Issue").value;
	var zedition = doc.getElementById(p+"Edition").value;
	var zplace = doc.getElementById(p+"Place").value;
	var zpublisher = doc.getElementById(p+"Publisher").value;
	var zpages = doc.getElementById(p+"Pages").value;
	var zrepository = doc.getElementById(p+"Repository").value;
	var zlabel = doc.getElementById(p+"Label").value;
	var zrunningTime = doc.getElementById(p+"RunningTime").value;
	var zlanguage = doc.getElementById(p+"Language").value;
	var zauthor = doc.getElementById(p+"Author").value;
	var zeditor = doc.getElementById(p+"Editor").value;
	var ztranslator = doc.getElementById(p+"Translator").value;
	var zinterviewee = doc.getElementById(p+"Interviewee").value;
	var zinterviewer = doc.getElementById(p+"Interviewer").value;
	var zrecipient = doc.getElementById(p+"Recipient").value;
	var zdirector = doc.getElementById(p+"Director").value;
	var zscriptwriter = doc.getElementById(p+"ScriptWriter").value;
	var zproducer = doc.getElementById(p+"Producer").value;
	var zcastMember = doc.getElementById(p+"CastMember").value;
	var zperformer = doc.getElementById(p+"Performer").value;
	var zcomposer = doc.getElementById(p+"Composer").value;

	// create Zotero item
	var newArticle = new Zotero.Item(ztype);

	// populate Zotero item
	newArticle.title = ztitle;
	newArticle.bookTitle = zbooktitle;
	newArticle.notes = znotes;
	newArticle.url = zurl;
	newArticle.place = zplace;
	newArticle.publisher = zpublisher;
	newArticle.pages = zpages;
	newArticle.rights = zrights;
	newArticle.series = zseries;
	newArticle.volume = zvolume;
	newArticle.issue = zissue;
	newArticle.edition = zedition;
	newArticle.repository = zrepository;
	newArticle.label = zlabel;
	newArticle.runningTime = zrunningTime;
	newArticle.language = zlanguage;
	newArticle.editor = zeditor;
	newArticle.translator = ztranslator;
	newArticle.interviewee = zinterviewee;
	newArticle.interviewer = zinterviewer;
	newArticle.recipient = zrecipient;
	newArticle.director = zdirector;
	newArticle.scriptwriter = zscriptwriter;
	newArticle.producer = zproducer;
	newArticle.castMember = zcastMember;
	newArticle.performer = zperformer;
	newArticle.composer = zcomposer;
	var aus = zauthor.split(";");
	for (var i=0; i< aus.length ; i++) {
		 newArticle.creators.push(Zotero.Utilities.cleanAuthor(aus[i], "author", true));
	}

	newArticle.attachments = [{url:doc.location.href, title:"Alexander Street Press Snapshot", mimeType:"text/html"}];
	if (doc.evaluate('//a[contains(@href, "get.pdf")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var pdfurl = doc.evaluate('//a[contains(@href, "get.pdf")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		newArticle.attachments.push({url:pdfurl, title:"Alexander Street Press PDF", mimeType:"application/pdf"});
	} else if (doc.evaluate('//a[contains(@href, "get.jpg")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var imgurl = doc.evaluate('//a[contains(@href, "get.jpg")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href.replace(/.{2}$/, "01");
		newArticle.attachments.push({url:imgurl, title:"Alexander Street Press Pg 1", mimeType:"image/jpg"});
		newArticle.notes = [{note:"Further page images can be found by following the URL of the 'Alexander Street Press Pg 1' attachment and iterating the final digits of the URL"}];
	}
	// save Zotero item
	newArticle.complete();

}

function GetItemType(zitemtype) {
	switch (zitemtype.toLowerCase()) {
	        case "book":
	        	return "book";
	        	break;
	        case "chapter":
	        	return "bookSection";
	        	break;
	        case "journal":
	        	return "journalArticle";
	        	break;
	        case "manuscript":
	        	return "manuscript";
	        	break;
	        case "audio":
	        	return "audioRecording";
	        	break;
	        case "video":
	        	return "videoRecording";
	        	break;
	        case "issue":
	        	return "journalArticle";
	        	break;
	        case "article":
	        	return "journalArticle";
	        	break;
	        case "series":
	        	return "interview";
	        	break;
	        case "session":
	        	return "interview";
	        	break;
	        default:
	        	return "document";
       }
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = '//tbody/tr/td[2][@class="data"]/a[1]';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}

	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
}