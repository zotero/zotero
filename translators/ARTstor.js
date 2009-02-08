{
	"translatorID":"5278b20c-7c2c-4599-a785-12198ea648bf",
	"translatorType":4,
	"label":"ARTstor",
	"creator":"Ameer Ahmed and Michael Berkowitz",
	"target":"http://[^/]artstor.org[^/]*",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-02-08 22:10:00"
}

function detectWeb(doc, url) {
	if (url.match(/(S|s)earch/) && (doc.evaluate('//div[@id="thumbContentWrap"]/div', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/\w+/))) return "multiple"
}

function doWeb(doc, url) {
	if (url.indexOf("|")!=-1){	
	scrape(doc, url);
	}
}

function scrape(doc, url){
	var savedItems = new Array();
	var saved = 0;
	var urlstub = url.substring(url.indexOf('.org/')+5,url.length);
	urlstub = url.substring(0,url.indexOf('.org/')+5) + urlstub.substring(0, urlstub.indexOf('/')+1)
	var suburl = url.substring(url.indexOf('|')+1, url.length);
        var groupname = suburl.substring(0, suburl.indexOf("|"));
	var searchterm = '//*[@id="thumbSubTitle"]';
		var stt = doc.evaluate(searchterm, doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	var st = stt.firstChild.nodeValue;
	var pageNn = '//*[@id="pageNo"]';
	var stt = doc.evaluate(pageNn, doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	var pg;
      	if (stt.value==1){
        	pg = 1;
        } else if (stt.value==2){
        	pg = 25;
        } else {
		pg = ((stt.value-1) * 24) + 1;
        }
        var groupid;
	//check if user is on search page if not construct the query using the 2nd pattern
	if (groupname.indexOf("search")!=-1){
		groupid = "1/" + pg + "/24/0?tn=1&name=&id=all&kw=" +st + "&type=1";
	}else {
		groupid = suburl.substring(suburl.indexOf('|')+1, suburl.indexOf('||')) + "//thumbnails/" + pg + "/24/0";
	}
	// Initial query to get results from the service - primary purpose is to get objectids. which in turn are required for the 2nd service call, which exposes the actual metadata
	Zotero.Utilities.HTTP.doGet(urlstub + "secure/" + groupname + "//" + groupid, function(text) {
		var json = JSON.parse(text);
		items = new Object();
		for(var i=0; i<json.thumbnails.length; i++) {
		child = json.thumbnails[i];
		var tmpUrl = urlstub + "secure/metadata/" + child.objectId + "?_method=Infolder";
		//here we are saving the url service call to get each objects metadata
		savedItems[saved] = tmpUrl;
		items[tmpUrl]=child.objectId;
		saved++;
	}
	// GET VALUES FROM THE WEB
	var xpath = '//div[@id="thumbContentWrap"]';
	var elmts = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	var webitems = new Object();
	var selectedNums = new Array();
	var si=0;
	var c = elmts.getElementsByTagName('*');
	var title = "";
	for(var i=0; i<c.length; i++) {
		var child = c[i];
		if (child.id.indexOf("_imageHolder")!=-1){
			var csss = child.style;
			var glow = csss.getPropertyValue('border');
		}
		if (child.id.indexOf("_thumb1")!=-1){
			title = child.title;
		}
		if (child.id.indexOf("_thumb2")!=-1){
			title+= " :: " + child.title;
		}
		if (child.id.indexOf("_thumb3")!=-1){
			var childtitle = child.title;
			var dialogTitle = title;
			if (childtitle.length>1) {
				dialogTitle+="  " + childtitle;
			}
		        var sitem = child.id.substring(6,child.id.indexOf("_"));
			webitems[sitem-1] = dialogTitle;
			if (glow.indexOf(75)!=-1){
				selectedNums[si]=sitem-1;
				si++;
			}
	 		title = null;
		}
	}
	// GET VALUES FROM THE WEB		
	var tcount=0;
	var newitems = null;
	if (selectedNums.length>0){
		newitems = new Object();
		for (j=0; j<selectedNums.length;j++){
			var numnum = selectedNums[j];
			for (var x in items){
				if (numnum==tcount){
					newitems[x] = webitems[tcount];
					tcount=0;
					break;
				} else {
					tcount++;
				}
			}
		}
	} else {
		tcount = 0;	
		for (var x in items){
			items[x] = webitems[tcount];
			tcount++;
		}
	}
	if (newitems!=null){
		items = newitems;
	}
	//show dialogbox
	var items = Zotero.selectItems(items);
	if(!items) {
		return true;
	}
	var urls = new Array();
	for(var i in items) {
		urls.push(i);
	}
	//this gets called when an object is selected in the dialog box, fires off a get on the service url
	Zotero.Utilities.HTTP.doGet(urls, function(text) {
		json = eval("(" + text + ")");
		var newArticle = new Zotero.Item('artwork');
		for (var i=0; i<json.metaData.length; i++) {
			child = json.metaData[i];
			// MISSING CULTURE!!!		
			if (child.fieldName.indexOf("Title")!=-1){
				if (newArticle.title!=null){
					newArticle.title+= ";" + child.fieldValue;
				} else {			
					newArticle.title = child.fieldValue;
				}
			}
			if (child.fieldName.indexOf("Creator")!=-1){
				if (child.fieldValue != "") {
					if (child.fieldValue.match(/,/)) {
						var aut = child.fieldValue.match(/^([^,]+),\s+(.*)$/);
						if (aut[1].match(/\s/)) {
							newArticle.notes.push({note:"Artist information: " + aut[2]});
							newArticle.creators.push(Zotero.Utilities.cleanAuthor(aut[1], "artist"));
						} else {
							var extras = aut[2].match(/^([^,]+),\s+(.*)$/);
							newArticle.creators.push({firstName:extras[1], lastName:aut[1], creatorType:"author"});
							newArticle.notes.push({note:"Artist information: " + extras[2]});
						}
					} else {
						newArticle.creators.push(Zotero.Utilities.cleanAuthor(child.fieldValue, "artist"));
					}
				}
			}
			if (child.fieldName.indexOf("Culture")!=-1){
				newArticle.creators.push(Zotero.Utilities.cleanAuthor(child.fieldValue, "producer", true));
			}
			if (child.fieldName.indexOf("Rights")!=-1){
				if (newArticle.rights!=null){
					newArticle.rights+= ";" + child.fieldValue.replace(/<wbr\/>/g, "");
				} else {
					newArticle.rights = child.fieldValue.replace(/<wbr\/>/g, "");
				}
			}
			if (child.fieldName.indexOf("Subject")!=-1){
				newArticle.tags.push(Zotero.Utilities.trimInternal(child.fieldValue));
			}
			if (child.fieldName.indexOf("Location")!=-1){
				newArticle.tags.push(Zotero.Utilities.trimInternal(child.fieldValue));
			}
			if (child.fieldName.indexOf("Style Period")!=-1){
				newArticle.tags.push(Zotero.Utilities.trimInternal(child.fieldValue));
			}
			if (child.fieldName.indexOf("Work Type")!=-1){
				newArticle.tags.push(Zotero.Utilities.trimInternal(child.fieldValue));
			}
			if (child.fieldName.indexOf("Material")!=-1 || child.fieldName.indexOf("Technique")!=-1 ){
				if (newArticle.artworkMedium!=null){
					newArticle.artworkMedium+= ";" + Zotero.Utilities.trimInternal(child.fieldValue);
				} else {
					newArticle.artworkMedium = Zotero.Utilities.trimInternal(child.fieldValue);
				}
			}
			if (child.fieldName.indexOf("Measurements")!=-1){
				if (newArticle.artworkSize!=null){
					newArticle.artworkSize+= ";" + Zotero.Utilities.trimInternal(child.fieldValue);
				} else {			
					newArticle.artworkSize = Zotero.Utilities.trimInternal(child.fieldValue);
				}
			}
			if (child.fieldName.indexOf("Date")!=-1){
				if (newArticle.date!=null){
					newArticle.date+= ";" + Zotero.Utilities.trimInternal(child.fieldValue);
				} else {
					//bug here!! when date parser fails, entire object is not saved in Zotero - works in Scaffold, fails in Zotero! to patch remove all occurrences of B.C
					newArticle.date = Zotero.Utilities.trimInternal(child.fieldValue.replace(/B.C./i, ""));
				}
			}
			if (child.fieldName.indexOf("Repository")!=-1){
				if (newArticle.repository!=null){
					newArticle.repository+= ";" + Zotero.Utilities.trimInternal(child.fieldValue);
				} else {			
					newArticle.repository = Zotero.Utilities.trimInternal(child.fieldValue);
				}
			}
			if (child.fieldName.indexOf("Source")!=-1){
				if (newArticle.archiveLocation!=null){
					newArticle.archiveLocation+= ";" + Zotero.Utilities.trimInternal(child.fieldValue);
				} else {			
					newArticle.archiveLocation = Zotero.Utilities.trimInternal(child.fieldValue);
				}
			}
			if (child.fieldName.indexOf("Description")!=-1){
				if (newArticle.abstractNote!=null){
					newArticle.abstractNote+= ";" + Zotero.Utilities.trimInternal(child.fieldValue);
				} else {
					newArticle.abstractNote = Zotero.Utilities.trimInternal(child.fieldValue);
				}
			}
			if (child.fieldName.indexOf("Collection")!=-1){
				if (newArticle.extra!=null){
					newArticle.extra+= ";" + Zotero.Utilities.trimInternal(child.fieldValue);
				} else {			
					newArticle.extra = Zotero.Utilities.trimInternal(child.fieldValue);
				}
			}
		}
		var objectId = json.objectId;
		//this is called to get the url stub for the ARTstor viewer
		Zotero.Utilities.HTTP.doGet(urlstub + "secure/metadata/" + objectId + "?_method=FpHtml", function(dom) {
			var testurl = dom.substring(dom.lastIndexOf('<td class="data">')+21,dom.lastIndexOf('</td>')); 
			var t2 = "http://www.artstor.org"; 
			var tmp2 = testurl.replace(/<wbr\/>/g, "");
			tmp2 = tmp2.substring(0, tmp2.indexOf("&userId"));
			//build ARTstorImageURL
			artstorimgurl = t2+tmp2;
			newArticle.url = artstorimgurl;
			newArticle.callNumber = objectId;
			newArticle.complete();
			Zotero.done();
		}); 
		Zotero.wait();
	});
	Zotero.wait();
});
Zotero.wait();
}