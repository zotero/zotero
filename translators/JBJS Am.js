{
	"translatorID": "8a325571-c2a8-417a-8a25-b1dca65154c3",
	"label": "JBJS Am",
	"creator": "Max Gordon and Avram Lyon",
	"target": "^https?://(?:www\\.)?jbjs.org[^\\/]*/(?:searchresults|issue|article)\\.aspx",
	"minVersion": "1.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-08-26 00:33:07"
}

/*
   JBJS Translator
   Copyright (C) 2011 Max Gordon and Avram Lyon

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.

   You should have received a copy of the GNU Affero General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 This translator is derived from the Wiley Online Library translator, which
 was first written by Sean Takats and Michael Berkowitz.
 */

function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (url.match(/\/issue|\/searchresults/)) {
		return "multiple";
	} else return "journalArticle";
}

function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var host = 'http://' + doc.location.host + "/";
	
	var urls = new Array();
	if(detectWeb(doc, url) == "multiple") {  //search
		var title;
		var availableItems = new Array();
		var articles = doc.evaluate('//div[@class="articleContent"]//a[@class="relatedArticle"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		//Zotero.debug(articles);
		var article = false;
		while (article = articles.iterateNext()) {
			availableItems[article.href] = article.textContent;
		}
		Zotero.selectItems(availableItems, function (items) {
			if(!items) {
				return true;
			}
			for (var i in items) {
				urls.push(i);
			}
			Zotero.Utilities.processDocuments(urls, scrape, function () { Zotero.done(); });
		});
	} else { //single article
		scrape(doc, url);
	}
	Zotero.wait();
}

function scrape(doc,url)
{
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	   
	var newItem=new Zotero.Item("journalArticle");
	   var temp;
	   var xpath;
	   var row;
	   var rows;

	   newItem.url = doc.location.href;
	   var metaTags = doc.getElementsByTagName("meta");

	   var pages = [false, false];
	   var doi = false;
	   var pdf = false;
	   var html = false;
	for (var i = 0; i< metaTags.length; i++) {
		var tag = metaTags[i].getAttribute("name");
		var value = metaTags[i].getAttribute("content");
		//Zotero.debug(pages + pdf + html);
	   		//Zotero.debug("Have meta tag: " + tag + " => " + value);
		switch (tag) {
			// Google.
			case "citation_journal_title": if (!newItem.publicationTitle) newItem.publicationTitle = value; break;
			case "citation_journal_abbrev": if (!newItem.journalAbbreviation) newItem.journalAbbreviation = value; break;
			case "citation_author":    			
				newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "author", true));
			case "citation_title": if (!newItem.title) newItem.title = value; break;
			case "citation_publisher": if (!newItem.publisher) newItem.publisher = value; break;
			case "citation_date": if (!newItem.date && value != "NaN" && value != "") newItem.date = value; break;
			case "citation_year": if (!newItem.date && value != "NaN" && value != "") newItem.date = value; break;
			case "citation_volume": if (!newItem.volume && value != "NaN" && value != "") newItem.volume = value; break;
			case "citation_issue": if (!newItem.issue && value != "NaN" && value != "") newItem.issue = value; break;
			case "citation_firstpage": if (!pages[0] && value != "NaN" && value != "") pages[0] = value; break;
			case "citation_lastpage": if (!pages[1] && value != "NaN" && value != "") pages[1] = value; break;
			case "citation_issn": if (!newItem.ISSN && value != "NaN" && value != "") newItem.ISSN = value; break;
			case "citation_isbn": if (!newItem.ISBN && value != "NaN" && value != "") newItem.ISBN = value; break;
			case "citation_doi": if (!newItem.DOI) newItem.DOI = value; break;
			case "citation_reference": break; // These are citations in the paper-- Z doesn't use them
			default:
				Zotero.debug("Ignoring meta tag: " + tag + " => " + value);
		}
	}
		
	if (pages[0] && pages[1]) newItem.pages = pages.join('-')
	else newItem.pages = pages[0] ? pages[1] : (pages[1] ? pages[1] : "");

	// Get the abstract
	var abstractNode = doc.evaluate('//div[h2/text()="Abstract"]/following-sibling::div[1]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (abstractNode) newItem.abstractNote = abstractNode.textContent;
	
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.jbjs.org/article.aspx?articleid=35426",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Delamarter",
						"lastName": "Rick",
						"creatorType": "author"
					},
					{
						"firstName": "Zigler",
						"lastName": "Jack E. ",
						"creatorType": "author"
					},
					{
						"firstName": "Balderston",
						"lastName": "Richard A. ",
						"creatorType": "author"
					},
					{
						"firstName": "Cammisa",
						"lastName": "Frank P. ",
						"creatorType": "author"
					},
					{
						"firstName": "Goldstein",
						"lastName": "Jeffrey A. ",
						"creatorType": "author"
					},
					{
						"firstName": "Spivak",
						"lastName": "Jeffrey M. ",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"url": "http://www.jbjs.org/article.aspx?articleid=35426",
				"publicationTitle": "The Journal of Bone and Joint Surgery (American)",
				"journalAbbreviation": "JBJS",
				"title": "Prospective, Randomized, Multicenter Food and Drug Administration Investigational Device Exemption Study of the ProDisc-L Total Disc Replacement Compared with Circumferential Arthrodesis for the Treatment of Two-Level Lumbar Degenerative Disc Disease: Results at Twenty-four Months",
				"volume": "93",
				"issue": "8",
				"date": "4/20/2011 12:00:00 AM",
				"ISSN": "0021-9355",
				"DOI": "10.2106/JBJS.I.00680",
				"publisher": "The Journal of Bone and Joint Surgery",
				"pages": "705-715",
				"abstractNote": "Background: \n  Disc replacement arthroplasty previously has been shown to be an effective alternative to spine fusion for the treatment of single-level lumbar degenerative disc disease. The purpose of the present study was to determine the twenty-four-month results of a clinical trial of the ProDisc-L total disc replacement as compared with spinal fusion for the treatment of degenerative disc disease at two contiguous vertebral levels from L3 to S1.Methods: \n  A total of 237 patients were treated in a randomized controlled trial designed as a non-inferiority study for regulatory application purposes. Blocked randomization was performed with use of a 2:1 ratio of total disc arthroplasty to circumferential arthrodesis. Evaluations, including patient self-assessments, physical and neurological examinations, and radiographic examinations, were performed preoperatively, six weeks postoperatively, and three, six, twelve, eighteen, and twenty-four months postoperatively.Results: \n  At twenty-four months, 58.8% (eighty-seven) of 148 patients in the total disc replacement group were classified as a statistical success, compared with 47.8% (thirty-two) of sixty-seven patients in the arthrodesis group; non-inferiority was demonstrated. The mean Oswestry Disability Index in both groups significantly improved from baseline (p < 0.0001); the mean percentage improvement for the total disc replacement group was significantly better than that for the arthrodesis group (p = 0.0282). An established clinical criterion for success, a =15-point improvement in the Oswestry Disability Index from baseline, occurred in 73.2% (109) of 149 patients in the total disc replacement group and 59.7% (thirty-seven) of sixty-two patients in the arthrodesis group. The Short Form-36 physical component scores were significantly better for the total disc replacement group as compared with the arthrodesis group (p = 0.0141 at twenty-four months). Visual analog scale scores for satisfaction significantly favored total disc replacement from three to twenty-four months. At twenty-four months, 78.2% (111) of 142 patients in the total disc replacement group and 62.1% (thirty-six) of fifty-eight patients in the arthrodesis group responded “yes” when asked if they would have the same surgery again. Lumbar spine range of motion on radiographs averaged 7.8° at the superior disc and 6.2° at the inferior disc in patients with total disc replacement. Reduction in narcotics usage significantly favored the total disc replacement group at twenty-four months after surgery (p = 0.0020).Conclusions: \n  Despite the relatively short duration of follow-up and design limitations, the present study suggests that two-level lumbar disc arthroplasty is an alternative to and offers clinical advantages in terms of pain relief and functional recovery in comparison with arthrodesis. Longer-term follow-up is needed to determine the risks for implant wear and/or degenerative segment changes.Level of Evidence: \n  Therapeutic Level I. See Instructions to Authors for a complete description of levels of evidence.",
				"libraryCatalog": "JBJS Am",
				"shortTitle": "Prospective, Randomized, Multicenter Food and Drug Administration Investigational Device Exemption Study of the ProDisc-L Total Disc Replacement Compared with Circumferential Arthrodesis for the Treatment of Two-Level Lumbar Degenerative Disc Disease"
			}
		]
	}
]
/** END TEST CASES **/
