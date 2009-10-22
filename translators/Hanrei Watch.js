{
	"translatorID":"8e5f8616-05d0-4d33-8554-dad76b20ecbx",
	"translatorType":4,
	"label":"Hanrei Watch RSS service",
	"creator":"Frank Bennett",
	"target":"http://kanz.jp/hanrei/detail.html\\?idx=[0-9]+$",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-11-14 16:59:24"
}

function detectWeb(doc, url) {
	return "case";
}

var years = {};
years["明治"] = 1867;
years["大正"] = 1911;
years["昭和"] = 1925;
years["平成"] = 1988;

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var item = new Zotero.Item("case");

	//
	// For values that require no special post-processing, get Xpath targets in raw list form.
	// Values to be extracted are for docket number, case nickname, court, and the abstract
	// of the judgment.
	//
	var values = [];
	values.push( doc.evaluate( '//table[@class="detail"]//th[contains(text(),"事件番号")]/following-sibling::td[position()=1]',  doc, null, XPathResult.ANY_TYPE, null) );
	values.push( doc.evaluate( '//table[@class="detail"]//th[contains(text(),"事件名")]/following-sibling::td[position()=1]',  doc, null, XPathResult.ANY_TYPE, null) );
	values.push( doc.evaluate( '//table[@class="detail"]//th[contains(text(),"裁判所")]/following-sibling::td[position()=1]',  doc, null, XPathResult.ANY_TYPE, null) );
	values.push( doc.evaluate( '//table[@class="detail"]//th[contains(text(),"裁判要旨")]/following-sibling::td[position()=1]',  doc, null, XPathResult.ANY_TYPE, null) );
	//
	// For each variable above, extract its string value, if any.
	//
	for (var pos in values){
		values[pos] = values[pos].iterateNext();
		if (values[pos]){
			values[pos] = values[pos].textContent;
		}
	}

	//
	// Get the date, and normalize the format and the year
	//
	var date = doc.evaluate( '//table[@class="detail"]//th[contains(text(),"裁判年月日")]/following-sibling::td[position()=1]',  doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	if (date){
		date = date.textContent;
		date = date.replace(/日$/,"");
		date = date.replace(/(月|年)/g,"-");

		var m = date.match(/^(平成|昭和|大正|明治)([0-9]+)(.*)/);
		if (m && years[m[1]]){
			date = (years[m[1]] + parseInt(m[2],10)) + m[3];
		}
	}

	//
	// Get the URL of the PDF attachment.
	//
	var pdf = doc.evaluate( '//a[contains(text(),"PDF File")]/@href',  doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	if (pdf){
		pdf = pdf.textContent;
	}

	//
	// Assemble the item and declare it complete.
	//
	item.type = "case";
	item.docketNumber = values[0];
	item.title = values[1];
	item.court = values[2];
	item.abstractNote = values[3];
	item.date = date;
	item.url = url;
	item.attachments.push( {
		url:pdf,
		title:"SupCt PDF",
		mimeType:"application/pdf"} );
	item.complete();
}
