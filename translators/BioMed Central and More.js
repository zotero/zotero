{
	"translatorID":"1a3e63b2-0adf-4c8e-928b-c58c2594b45d",
	"translatorType":4,
	"label":"BioMed Central and More",
	"creator":"Ben Parr",
	"target":"http://[^/]*(jcmr-online|respiratory-research|bio-diglib|nuclear-receptor|medimmunol|kinetoplastids|filariajournal|cellandchromosome|actavetscand|aidsrestherapy|almob|ann-clinmicrob|annals-general-psychiatry|asir-journal|arthritis-research|apfmj|anzhealthpolicy|behavioralandbrainfunctions|biodatamining|biology-direct|biomagres|biomedical-engineering-online|bpsmedicine|biotechnologyforbiofuels|biomedcentral|breast-cancer-research|cancerci|cbmjournal|cardiab|cardiovascularultrasound|casesjournal|lipidsignaling.cbdjournals|biosignaling|celldiv|cerebrospinalfluidresearch|journal.chemistrycentral|capmh|cmjournal|chiroandosteo|clinicalmolecularallergy|cpementalhealth|comparative-hepatology|conflictandhealth|resource-allocation|coughjournal|ccforum|cytojournal|diagnosticpathology|dynamic-med|ete-online|ehjournal|epi-perspectives|epigeneticsandchromatin|fibrogenesis|frontiersinzoology|gvt-journal|genomebiology|genomemedicine|geochemicaltransactions|globalizationandhealth|gutpathogens|harmreductionjournal|head-face-med|hqlo|health-policy-systems|human-resources-health|immunityageing|immunome-research|implementationscience|infectagentscancer|intarchmed|internationalbreastfeedingjournal|equityhealthj|ijbnpa|ij-healthgeographics|ijmhs|issoonline|jautoimdis|jbioleng|jbiol|j-biomed-discovery|jbppni|carcinogenesis|cardiothoracicsurgery|jcmr-online|jcircadianrhythms|ethnobiomed|jexpclinassistreprod|jeccr|jfootankleres|jhoonline|jibtherapies|journal-inflammation|jmedicalcasereports|jmolecularsignaling|jnanobiotechnology|jnrbm|jneuroengrehab|jneuroinflammation|occup-med|josr-online|jissn|translational-medicine|traumamanagement|lipidworld|malariajournal|microbialcellfactories|molecularbrain|molecular-cancer|molecularcytogenetics|molecularneurodegeneration|molecularpain|neuraldevelopment|nonlinearbiomedphys|nutritionandmetabolism|nutritionj|ojrd|om-pc|parasitesandvectors|particleandfibretoxicology|pathogeneticsjournal|pssjournal|ped-rheum|peh-med|plantmethods|pophealthmetrics|proteomesci|ro-journal|rbej|reproductive-health-journal|respiratory-research|retrovirology|salinesystems|the-scientist|scoliosisjournal|scfbm|substanceabusepolicy|tbiomed|thrombosisjournal|thyroidresearchjournal|tobaccoinduceddiseases|trialsjournal|urooncologyjournal|virologyj|wjes|wjso)\\.(com|org|net)",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-15 19:45:00"
}

function detectWeb(doc,url)
{
	var namespace = doc.documentElement.namespaceURI;
    	var nsResolver = namespace ? function(prefix) {
        if (prefix == "x" ) return namespace; else return null;
    	} : null;
    	
    	var xpath='//meta[@name="citation_fulltext_html_url"]';
    	
    	//Single
    	if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) 
    		{return "journalArticle";}
    		
    	
    	//Multiple
    	xpath='//a[@class="hiddenlink"][span[@class="xcitationtitle"][b]]';
	xpath+=' | //span[@class="xcitationtitle2"]/a[@class="hiddenlink"]';
	xpath+=' | //div[@class="bodytext"]/a[@class="hiddenlink"][font/b]';
	xpath+=' | //p[@class="bodytext"]/a[@class="hiddenblack"][b]';
	xpath+=' | //div[@class="bodytext"]/a[@class="hiddenblack"][b]';
	xpath+=' | //div[@class="bodytext"]/a[@class="hiddenlink"][font/b]';
	
	var rows=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var row;
	var link;
	while(row=rows.iterateNext())
	{
		link=row.href;
		if(link.indexOf("pubmed")<0 && link.substr(link.length-4)!=".pdf" && link.indexOf("blogs.")<0)
			{return "multiple";}
	}
	
}

function parseRIS(getURL)
{  
    Zotero.Utilities.HTTP.doGet(getURL, function(text){
        // load translator for RIS
        var translator = Zotero.loadTranslator ("import");
        translator.setHandler("itemDone", function(obj, newItem) {
	        var doi = newItem.DOI;
		var splitURL = newItem.url.split('/');
		
		if(splitURL.length>=3 && doi){
			var doiSuffix = doi.slice(doi.indexOf('/')+1);
			var pdfURL = splitURL[0] + '/' + splitURL[1] + '/' + splitURL[2];
			pdfURL += '/content/pdf/' + doiSuffix + '.pdf';
			var source = splitURL[2].replace(/^www./i,'').replace(/\.[\w]+$/i,'');
			newItem.attachments = [
				//{url:newItem.url+'/abstract', title:source + " Abstract Snapshot", mimeType:"text/html"},
				{url:newItem.url, title:source + " Snapshot", mimeType:"text/html"},
				{url:pdfURL, title:source + " PDF", mimeType:"application/pdf"}
			];
		}
	        newItem.complete();
        });
        translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
        translator.setString(text);
        translator.translate();
        Zotero.done();
    }, function() {});

    Zotero.wait();
}

function doWeb(doc,url)
{
	var namespace = doc.documentElement.namespaceURI;
    	var nsResolver = namespace ? function(prefix) {
        if (prefix == "x" ) return namespace; else return null;
    	} : null;
    	
    	var xpath='//meta[@name="citation_fulltext_html_url"]/@content';
    	var rows;
    	var row=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
    	if (row) 
    	{
	    	//Single Article	    	
	    	var url=row.textContent+"/citation/";
	    	Zotero.Utilities.HTTP.doPost(url, 'include=cit&format=refman&direct=on&submit=Download+references&action=submit', function(text)
	    		{parseRIS(url+'?include=cit&format=refman&direct=on&submit=Download+references&action=submit');});
   
    		Zotero.wait();
    		return true;
	}
 	
 	
 	//Multiple
    	xpath='//a[@class="hiddenlink"][span[@class="xcitationtitle"][b]]';
	xpath+=' | //span[@class="xcitationtitle2"]/a[@class="hiddenlink"]';
	xpath+=' | //div[@class="bodytext"]/a[@class="hiddenlink"][font/b]';
	xpath+=' | //p[@class="bodytext"]/a[@class="hiddenblack"][b]';
	xpath+=' | //div[@class="bodytext"]/a[@class="hiddenblack"][b]';
	xpath+=' | //div[@class="bodytext"]/a[@class="hiddenlink"][font/b]';

	rows=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var items=new Array();
	var link;
	var t;
	while(row=rows.iterateNext())
	{
		link=row.href;
		if(link.indexOf("pubmed")<0 && link.substr(link.length-4)!=".pdf" && link.indexOf("blogs.")<0)
		{
			t=link.split('/');
			if(t[t.length-1].indexOf("comments#")>-1)
				{link=t.slice(0,t.length-1).join('/');}
			items[link.replace("/abstract","")+"/citation"]=row.textContent;
		}
	}
	
	items = Zotero.selectItems(items);
       	var uris=new Array();
       	if (!items)
               {return true;}

        for (var i in items)
               {uris.push(i);}

       	Zotero.Utilities.HTTP.doPost(uris, "include=cit&format=refman&direct=on&submit=Download+references&action=submit", function(text)
       	{
       	    for (var j = 0 ; j < uris.length ; j++)
       	    	{parseRIS(uris[j] + "?include=cit&format=refman&direct=on&submit=Download+references&action=submit");}
       	});
       
       	Zotero.wait();
}
