{
	"translatorID":"232e24fe-2f68-44fc-9366-ecd45720ee9e",
	"translatorType":4,
	"label":"Patents - USPTO",
	"creator":"Bill McKinney",
	"target":"^http://patft\\.uspto\\.gov/netacgi/nph-Parser.+",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-06-21 06:30:00"
}

function detectWeb(doc, url) {
	var re = new RegExp("^http://patft\.uspto\.gov/netacgi/nph-Parser");
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

	var newItem = new Zotero.Item("patent");
	newItem.url = doc.location.href;
	var extraText = new String();
	var tmpStr = new String();
	var tmpRefs = "";
	var tmpTitle = doc.title;
	
	var fontTags = doc.getElementsByTagName("font");
	for(var i=0; i<fontTags.length; i++) {
		if (fontTags[i].getAttribute("size") == "+1") {
			tmpTitle = tmpTitle + " - " + fontTags[i].innerHTML;
		}
	}
	tmpTitle = Zotero.Utilities.cleanString(tmpTitle);
	tmpTitle = tmpTitle.replace(/<[^>]+>/g, "");
	newItem.title = tmpTitle;
	
	var cellTags = doc.getElementsByTagName("td");
	for(var i=0; i<cellTags.length; i++) {

		var s = new String(cellTags[i].innerHTML);
		if (s.indexOf("United States Patent") > -1) {
			
			tmpStr = cellTags[i+1].childNodes[0].innerHTML;
			tmpStr = tmpStr.replace(/<[^>]+>/gi, "");
			tmpStr = tmpStr.replace(/,/gi, "");
			newItem.patentNumber = tmpStr;
			
			tmpStr = cellTags[i+3].innerHTML;
			tmpStr = tmpStr.replace(/<[^>]+>/gi, "");
			newItem.issueDate = tmpStr;
			continue;
		}
		if (s.indexOf("Assignee") > -1) {
			tmpStr = cellTags[i+1].innerHTML;
			tmpStr = tmpStr.replace(/<\/?\w+>/gi, "");
			newItem.assignee = tmpStr;
			continue;
		}
		if (s.indexOf("Inventors") > -1) {
			tmpStr = cellTags[i+1].innerHTML;
			
			var inventors = tmpStr.split(/<b>,/ig);
			for (var j=0; j<inventors.length; j++) {
				var tmpInventor = inventors[j];
				tmpInventor = tmpInventor.replace(/<\/?\w+>/gi, "");
				tmpInventor = tmpInventor.replace(/\([^\)]+\)/gi, "");
				tmpInventor = tmpInventor.replace(/^\s+/gi, "");
				
				var names = tmpInventor.split(";");
				if (names) {
					var lname = names[0];
					var fname = names[1];
					lname = lname.replace(/^\s+/gi, "");
					lname = lname.replace(/\s+$/gi, "");
					fname= fname.replace(/^\s+/gi, "");
					fname= fname.replace(/\s+$/gi, "");
					newItem.creators.push({lastName:lname, firstName:fname, creatorType:"inventor"});
				}
			}
			continue;
		}
		
		// references
		if (s.indexOf("<a href=\"/netacgi/nph-Parser?Sect2") > -1) {
				tmpRefs = tmpRefs + cellTags[i].childNodes[0].innerHTML + " ";
		}
		if (s.indexOf("<a href=\"http://appft1.uspto.gov/netacgi/nph-Parser?TERM1") > -1) {
				tmpRefs = tmpRefs + cellTags[i].childNodes[0].innerHTML + " ";
		}
	}
	
	var centerTags = doc.getElementsByTagName("center");
	for(var i=0; i<centerTags.length; i++) {
		var s = new String(centerTags[i].innerHTML);
		if (s.indexOf("Abstract") > -1) {
			//newItem.extra = "ok";
			var el = get_nextsibling(centerTags[i]);
			newItem.abstractNote = el.innerHTML;
		}
	
	}

	newItem.references = tmpRefs;
	newItem.complete();
}

function doWeb(doc, url) {
	var re = new RegExp("^http://patft\.uspto\.gov/netacgi/nph-Parser.+");
	if(re.test(doc.location.href)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "^http://patft\.uspto\.gov/netacgi/nph-Parser.+");
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