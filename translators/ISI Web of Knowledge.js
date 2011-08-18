{
	"translatorID": "594ebe3c-90a0-4830-83bc-9502825a6810",
	"label": "ISI Web of Knowledge",
	"creator": "Michael Berkowitz, Avram Lyon",
	"target": "^https?://[^/]*webofknowledge\\.com/",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 5,
	"lastUpdated": "2011-08-01 16:50:59"
}

function detectWeb(doc, url) {
	if (url.indexOf("full_record.do") !== -1) {
		return "multiple";
	} else if ((doc.title.indexOf(" Results") !== -1)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var ids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object;
		var xpath = '//a[@class="smallV110"]';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href.match(/\?(.*)/)[1]] = next_title.textContent;
		}
		Zotero.selectItems(items, function (items) {
			for (var i in items) {
				ids.push(i);
			}
			fetchIds(ids, url);
		}); 
	} else {
		ids.push(url.match(/\?(.*)/)[1]);
		fetchIds(ids, url);
	}
}

function fetchIds(ids, url) {
	// Call yourself
	var importer = Zotero.loadTranslator("import");
	importer.setTranslator("594ebe3c-90a0-4830-83bc-9502825a6810");
	
	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var m = hostRegexp.exec(url);
	var host = m[1];
	for (var i in ids) {
		ids[i] = host+"/full_record.do?" + ids[i];
	}
	var product = url.match("product=([^\&]+)\&")[1];
	Zotero.Utilities.processDocuments(ids, function (newDoc) {
		var url = newDoc.location.href;
		var names = ["recordID", "colName", "SID", "selectedIds", "sortBy", "qid", "product" ];
		var values = {};
		var n;
		for each (n in names) {
			values[n] = newDoc.evaluate('//input[@name="'+n+'"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
		}
		var post2 = 'locale=en_US&fileOpt=fieldtagged'+
					'&colName=' + values.colName + '&action=saveDataToRef'+
					'&qid='+values.qid+'&sortBy='+values.sortBy.replace(/;/g,"%3;")+
					'&SID='+values.SID+'&product='+values.product+'&filters=FUNDING+SUBJECT_CATEGORY+JCR_CATEGORY+LANG+IDS+PAGEC+SABBR+CITREFC+ISSN+PUBINFO+KEYWORDS+CITTIMES+ADDRS+CONFERENCE_SPONSORS+DOCTYPE+ABSTRACT+CONFERENCE_INFO+SOURCE+TITLE+AUTHORS++&numRecords=1&locale=en_US';
		var post = 'action=go&viewType=fullRecord&product='+values.product
				+'&mark_id='+values.product+'&colName=' + values.colName
				+'&recordID='+values.recordID.replace(/;/g,"%3;")
				+'&sortBy='+values.sortBy.replace(/;/g,"%3;")+'&mode=outputService'
				+'&qid='+values.qid+'&SID='+values.SID+
				+'&format=saveToRef&filters=FUNDING+SUBJECT_CATEGORY+JCR_CATEGORY+LANG+IDS+PAGEC+SABBR+CITREFC+ISSN+PUBINFO+KEYWORDS+CITTIMES+ADDRS+CONFERENCE_SPONSORS+DOCTYPE+ABSTRACT+CONFERENCE_INFO+SOURCE+TITLE+AUTHORS++&selectedIds=3&mark_to=&mark_from=&count_new_items_marked=0&value%28record_select_type%29=selrecords&marked_list_candidates=3&LinksAreAllowedRightClick=CitedRefList.do&LinksAreAllowedRightClick=CitingArticles.do&LinksAreAllowedRightClick=OneClickSearch.do&LinksAreAllowedRightClick=full_record.do&fields_selection=FUNDING+SUBJECT_CATEGORY+JCR_CATEGORY+LANG+IDS+PAGEC+SABBR+CITREFC+ISSN+PUBINFO+KEYWORDS+CITTIMES+ADDRS+CONFERENCE_SPONSORS+DOCTYPE+ABSTRACT+CONFERENCE_INFO+SOURCE+TITLE+AUTHORS++&save_options=fieldtagged';
		Zotero.Utilities.doPost('http://apps.webofknowledge.com/OutboundService.do',post, function (text, obj) {
			Zotero.Utilities.doPost('http://ets.webofknowledge.com/ETS/saveDataToRef.do',post2, function (text, obj) {
				importer.setString(text);
				importer.setHandler("itemDone", function (obj, item) {
					item.attachments = [{url: url, type: "text/html", title: "ISI Web of Knowledge Record"}];
					item.complete();
				});
				importer.translate();
			});
		});
	}, function() {});
	Zotero.wait();
}

function detectImport() {
	var line;
	var i = 0;
	while((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, "");
		if(line != "") {
			if(line.substr(0, 4).match(/^PT [A-Z]/)) {
				return true;
			} else {
				if(i++ > 3) {
					return false;
				}
			}
				}
		}
}

function processTag(item, field, content) {
	var map = {
		"J": "journalArticle",
		"S": "bookSection", // Not sure
		"P": "patent",
		"B": "book"
	};
	if (field == "PT") {
		item.itemType = map[content];
		if (item.itemType === undefined) {
			item.itemType = "journalArticle";
			Zotero.debug("Unknown type: " + content);
		}
	} else if ((field == "AF" || field == "AU")) {
		//Z.debug(content);
		authors = content.split("\n");
		for each (var i in authors) {
			var author = i.split(",");
			item.creators[0][field].push({firstName:author[1].trim(),
					lastName:author[0].trim(),
					creatorType:"author"});
		}
	} else if ((field == "BE")) {
		//Z.debug(content);
		authors = content.split("\n");
		for each (var i in authors) {
			var author = i.split(",");
			item.creators[1].push({firstName:author[1].trim(),
					lastName:author[0].trim(),
					creatorType:"editor"});
		}
	} else if (field == "TI") {
		item.title = content;
	} else if (field == "JI") {
		item.journalAbbreviation = content;
	} else if (field == "SO") {
		item.publicationTitle = content;
	} else if (field == "SN") {
		item.ISSN = content;
	} else if (field == "BN") {
		item.ISBN = content;
	} else if (field == "PD" || field == "PY") {
		if (item.date) {
			item.date += " " + content;
		} else {
			item.date = content;
		}
		var year = item.date.match(/\d{4}/);
		// If we have a double year, eliminate one
		if (year && item.date.replace(year[0],"").indexOf(year[0]) !== -1)
			item.date = item.date.replace(year[0],"");
	} else if (field == "VL") {
		item.volume = content;
	} else if (field == "IS") {
		item.issue = content;
	} else if (field == "UT") {
		item.extra += content;
	} else if (field == "BP") {
		item.pages = content;
	} else if (field == "EP") {
		item.pages += "-" + content;
	} else if (field == "AB") {
		item.abstractNote = content;
	} else if (field == "PI" || field == "C1") {
		item.place = content;
	} else if (field == "LA") {
		item.language = content;
	} else if (field == "PU") {
		item.publisher = content;
	// Patent stuff
	} else if (field == "DG") {
		item.issueDate = content;
	} else if (field == "PN") {
		item.patentNumber = content;
	} else if (field == "AE") {
		item.assignee = content;
	} else if (field == "PL") { // not sure...
		item.priorityNumber = content;
	} else if (field == "PC") { // use for patents
		item.country = content;
	// A whole mess of tags
	} else if (field == "DE" || field == "BD"
			|| field == "OR" || field == "ID"
			|| field == "MC" || field == "MQ") {
		item.tags = item.tags.concat(content.split(";"));
	} else if (field == "DI") {
		item.DOI = content;
	} else {
		Zotero.debug("Discarding: " + field + " => "+content);
	}
}

function completeItem(item) {
	var i;
	var creators = [];
	// If we have full names, drop the short ones
	if (item.creators[0]["AF"].length) {
		creators = item.creators[0]["AF"];
	} else {
		creators = item.creators[0]["AU"];
	}
	// Add other creators
	if (item.creators[1])
		item.creators = creators.concat(item.creators[1]);
	else
		item.creators = creators;
		
	// If we have a patent, change author to inventor
	if (item.itemType == "patent") {
		for (i in item.creators) {
			if (item.creators[i].creatorType == "author") {
				item.creators[i].creatorType = "inventor";
			}
		}
	}
	
	// Fix caps, trim in various places
	for (i in item.tags) {
		item.tags[i] = item.tags[i].trim();
		if (item.tags[i].toUpperCase() == item.tags[i])
			item.tags[i]=item.tags[i].toLowerCase();
	}
	
	var toFix = ["publisher", "publicationTitle", "place"];
	for (i in toFix) {
		var field = toFix[i];
		if (item[field] && item[field].toUpperCase() == item[field])
			item[field]=ZU.capitalizeTitle(item[field].toLowerCase(),true);		
	}

	item.complete();
}

function doImport(text) {
	var line = true;
	var tag = data = false;
	do {    // first valid line is type
		line = Zotero.read();
		line = line.replace(/^\s+/, "");
	} while(line !== false && !line.substr(0, 6).match(/^PT [A-Z]/));

	var item = new Zotero.Item();
	var i = 0;
	item.creators = [{"AU":[], "AF":[]}, []];
	item.extra = "";


	var tag = "PT";
	
	var data = line.substr(3);
	
	var rawLine;
	while((rawLine = Zotero.read()) !== false) {    // until EOF
		// trim leading space if this line is not part of a note
		line = rawLine.replace(/^\s+/, "");
		var split = line.match(/^([A-Z0-9]{2}) (?:([^\n]*))?/);
		// Force a match for ER
		if (line.substr(0,2) == "ER") split = ["","ER",""];
		if(split) {
			// if this line is a tag, take a look at the previous line to map
			// its tag
			if(tag) {
				//Zotero.debug("tag: '"+tag+"'; data: '"+data+"'");
				processTag(item, tag, data);
			}

			// then fetch the tag and data from this line
			tag = split[1];
			data = split[2];
			
			if(tag == "ER") {	       // ER signals end of reference
				// unset info
				tag = data = false;
				completeItem(item);
			}
			if(tag == "PT") {
				// new item
				item = new Zotero.Item();
				item.creators = [{"AU":[], "AF":[]}, []];
				item.extra = "";
				i++;
			}
		} else {
			// otherwise, assume this is data from the previous line continued
			if(tag == "AU" || tag == "AF" || tag == "BE") {
				//Z.debug(rawLine);
				// preserve line endings for AU fields
				data += rawLine.replace(/^  /,"\n");
			} else if(tag) {
				// otherwise, concatenate and avoid extra spaces
				if(data[data.length-1] == " " || rawLine[0] == " ") {
					data += rawLine;
				} else {
					data += " "+rawLine;
				}
			}
		}
	}

	if(tag && tag != "ER") {	// save any unprocessed tags
		//Zotero.debug(tag);
		processTag(item, tag, data);
		completeItem(item);
	}
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "import",
		"input": "﻿FN Thomson Reuters Web of Knowledge\u000aVR 1.0\u000aPT J\u000aAU Zelle, Rintze M.\u000a   Harrison, Jacob C.\u000a   Pronk, Jack T.\u000a   van Maris, Antonius J. A.\u000aTI Anaplerotic Role for Cytosolic Malic Enzyme in Engineered Saccharomyces\u000a   cerevisiae Strains\u000aSO APPLIED AND ENVIRONMENTAL MICROBIOLOGY\u000aVL 77\u000aIS 3\u000aBP 732\u000aEP 738\u000aDI 10.1128/AEM.02132-10\u000aPD FEB 2011\u000aPY 2011\u000aAB Malic enzyme catalyzes the reversible oxidative decarboxylation of\u000a   malate to pyruvate and CO(2). The Saccharomyces cerevisiae MAE1 gene\u000a   encodes a mitochondrial malic enzyme whose proposed physiological roles\u000a   are related to the oxidative, malate-decarboxylating reaction. Hitherto,\u000a   the inability of pyruvate carboxylase-negative (Pyc(-)) S. cerevisiae\u000a   strains to grow on glucose suggested that Mae1p cannot act as a\u000a   pyruvate-carboxylating, anaplerotic enzyme. In this study, relocation of\u000a   malic enzyme to the cytosol and creation of thermodynamically favorable\u000a   conditions for pyruvate carboxylation by metabolic engineering, process\u000a   design, and adaptive evolution, enabled malic enzyme to act as the sole\u000a   anaplerotic enzyme in S. cerevisiae. The Escherichia coli NADH-dependent\u000a   sfcA malic enzyme was expressed in a Pyc(-) S. cerevisiae background.\u000a   When PDC2, a transcriptional regulator of pyruvate decarboxylase genes,\u000a   was deleted to increase intracellular pyruvate levels and cells were\u000a   grown under a CO(2) atmosphere to favor carboxylation, adaptive\u000a   evolution yielded a strain that grew on glucose (specific growth rate,\u000a   0.06 +/- 0.01 h(-1)). Growth of the evolved strain was enabled by a\u000a   single point mutation (Asp336Gly) that switched the cofactor preference\u000a   of E. coli malic enzyme from NADH to NADPH. Consistently, cytosolic\u000a   relocalization of the native Mae1p, which can use both NADH and NADPH,\u000a   in a pyc1,2 Delta pdc2 Delta strain grown under a CO(2) atmosphere, also\u000a   enabled slow-growth on glucose. Although growth rates of these strains\u000a   are still low, the higher ATP efficiency of carboxylation via malic\u000a   enzyme, compared to the pyruvate carboxylase pathway, may contribute to\u000a   metabolic engineering of S. cerevisiae for anaerobic, high-yield\u000a   C(4)-dicarboxylic acid production.\u000aTC 0\u000aZ9 0\u000aSN 0099-2240\u000aUT WOS:000286597100004\u000aER\u000a\u000aPT J\u000aAU Zelle, Rintze M.\u000a   Trueheart, Josh\u000a   Harrison, Jacob C.\u000a   Pronk, Jack T.\u000a   van Maris, Antonius J. A.\u000aTI Phosphoenolpyruvate Carboxykinase as the Sole Anaplerotic Enzyme in\u000a   Saccharomyces cerevisiae\u000aSO APPLIED AND ENVIRONMENTAL MICROBIOLOGY\u000aVL 76\u000aIS 16\u000aBP 5383\u000aEP 5389\u000aDI 10.1128/AEM.01077-10\u000aPD AUG 2010\u000aPY 2010\u000aAB Pyruvate carboxylase is the sole anaplerotic enzyme in glucose-grown\u000a   cultures of wild-type Saccharomyces cerevisiae. Pyruvate\u000a   carboxylase-negative (Pyc(-)) S. cerevisiae strains cannot grow on\u000a   glucose unless media are supplemented with C(4) compounds, such as\u000a   aspartic acid. In several succinate-producing prokaryotes,\u000a   phosphoenolpyruvate carboxykinase (PEPCK) fulfills this anaplerotic\u000a   role. However, the S. cerevisiae PEPCK encoded by PCK1 is repressed by\u000a   glucose and is considered to have a purely decarboxylating and\u000a   gluconeogenic function. This study investigates whether and under which\u000a   conditions PEPCK can replace the anaplerotic function of pyruvate\u000a   carboxylase in S. cerevisiae. Pyc(-) S. cerevisiae strains\u000a   constitutively overexpressing the PEPCK either from S. cerevisiae or\u000a   from Actinobacillus succinogenes did not grow on glucose as the sole\u000a   carbon source. However, evolutionary engineering yielded mutants able to\u000a   grow on glucose as the sole carbon source at a maximum specific growth\u000a   rate of ca. 0.14 h(-1), one-half that of the (pyruvate\u000a   carboxylase-positive) reference strain grown under the same conditions.\u000a   Growth was dependent on high carbon dioxide concentrations, indicating\u000a   that the reaction catalyzed by PEPCK operates near thermodynamic\u000a   equilibrium. Analysis and reverse engineering of two independently\u000a   evolved strains showed that single point mutations in pyruvate kinase,\u000a   which competes with PEPCK for phosphoenolpyruvate, were sufficient to\u000a   enable the use of PEPCK as the sole anaplerotic enzyme. The PEPCK\u000a   reaction produces one ATP per carboxylation event, whereas the original\u000a   route through pyruvate kinase and pyruvate carboxylase is ATP neutral.\u000a   This increased ATP yield may prove crucial for engineering of efficient\u000a   and low-cost anaerobic production of C(4) dicarboxylic acids in S.\u000a   cerevisiae.\u000aTC 1\u000aZ9 1\u000aSN 0099-2240\u000aUT WOS:000280633400006\u000aER\u000a\u000aPT J\u000aAU Zelle, Rintze M.\u000a   De Hulster, Erik\u000a   Kloezen, Wendy\u000a   Pronk, Jack T.\u000a   van Maris, Antonius J. A.\u000aTI Key Process Conditions for Production of C(4) Dicarboxylic Acids in\u000a   Bioreactor Batch Cultures of an Engineered Saccharomyces cerevisiae\u000a   Strain\u000aSO APPLIED AND ENVIRONMENTAL MICROBIOLOGY\u000aVL 76\u000aIS 3\u000aBP 744\u000aEP 750\u000aDI 10.1128/AEM.02396-09\u000aPD FEB 2010\u000aPY 2010\u000aAB A recent effort to improve malic acid production by Saccharomyces\u000a   cerevisiae by means of metabolic engineering resulted in a strain that\u000a   produced up to 59 g liter(-1) of malate at a yield of 0.42 mol (mol\u000a   glucose)(-1) in calcium carbonate-buffered shake flask cultures. With\u000a   shake flasks, process parameters that are important for scaling up this\u000a   process cannot be controlled independently. In this study, growth and\u000a   product formation by the engineered strain were studied in bioreactors\u000a   in order to separately analyze the effects of pH, calcium, and carbon\u000a   dioxide and oxygen availability. A near-neutral pH, which in shake\u000a   flasks was achieved by adding CaCO(3), was required for efficient C(4)\u000a   dicarboxylic acid production. Increased calcium concentrations, a side\u000a   effect of CaCO(3) dissolution, had a small positive effect on malate\u000a   formation. Carbon dioxide enrichment of the sparging gas (up to 15%\u000a   [vol/vol]) improved production of both malate and succinate. At higher\u000a   concentrations, succinate titers further increased, reaching 0.29 mol\u000a   (mol glucose)(-1), whereas malate formation strongly decreased. Although\u000a   fully aerobic conditions could be achieved, it was found that moderate\u000a   oxygen limitation benefitted malate production. In conclusion, malic\u000a   acid production with the engineered S. cerevisiae strain could be\u000a   successfully transferred from shake flasks to 1-liter batch bioreactors\u000a   by simultaneous optimization of four process parameters (pH and\u000a   concentrations of CO(2), calcium, and O(2)). Under optimized conditions,\u000a   a malate yield of 0.48 +/- 0.01 mol (mol glucose)(-1) was obtained in\u000a   bioreactors, a 19% increase over yields in shake flask experiments.\u000aTC 2\u000aZ9 2\u000aSN 0099-2240\u000aUT WOS:000274017400015\u000aER\u000a\u000aPT J\u000aAU Abbott, Derek A.\u000a   Zelle, Rintze M.\u000a   Pronk, Jack T.\u000a   van Maris, Antonius J. A.\u000aTI Metabolic engineering of Saccharomyces cerevisiae for production of\u000a   carboxylic acids: current status and challenges\u000aSO FEMS YEAST RESEARCH\u000aVL 9\u000aIS 8\u000aBP 1123\u000aEP 1136\u000aDI 10.1111/j.1567-1364.2009.00537.x\u000aPD DEC 2009\u000aPY 2009\u000aAB To meet the demands of future generations for chemicals and energy and\u000a   to reduce the environmental footprint of the chemical industry,\u000a   alternatives for petrochemistry are required. Microbial conversion of\u000a   renewable feedstocks has a huge potential for cleaner, sustainable\u000a   industrial production of fuels and chemicals. Microbial production of\u000a   organic acids is a promising approach for production of chemical\u000a   building blocks that can replace their petrochemically derived\u000a   equivalents. Although Saccharomyces cerevisiae does not naturally\u000a   produce organic acids in large quantities, its robustness, pH tolerance,\u000a   simple nutrient requirements and long history as an industrial workhorse\u000a   make it an excellent candidate biocatalyst for such processes. Genetic\u000a   engineering, along with evolution and selection, has been successfully\u000a   used to divert carbon from ethanol, the natural endproduct of S.\u000a   cerevisiae, to pyruvate. Further engineering, which included expression\u000a   of heterologous enzymes and transporters, yielded strains capable of\u000a   producing lactate and malate from pyruvate. Besides these metabolic\u000a   engineering strategies, this review discusses the impact of transport\u000a   and energetics as well as the tolerance towards these organic acids. In\u000a   addition to recent progress in engineering S. cerevisiae for organic\u000a   acid production, the key limitations and challenges are discussed in the\u000a   context of sustainable industrial production of organic acids from\u000a   renewable feedstocks.\u000aTC 11\u000aZ9 11\u000aSN 1567-1356\u000aUT WOS:000271264400001\u000aER\u000a\u000aPT J\u000aAU Zelle, Rintze M.\u000a   de Hulster, Erik\u000a   van Winden, WoUter A.\u000a   de Waard, Pieter\u000a   Dijkema, Cor\u000a   Winkler, Aaron A.\u000a   Geertman, Jan-Maarten A.\u000a   van Dijken, Johannes P.\u000a   Pronk, Jack T.\u000a   van Maris, Antonius J. A.\u000aTI Malic acid production by Saccharomyces cerevisiae: Engineering of\u000a   pyruvate carboxylation, oxaloacetate reduction, and malate export\u000aSO APPLIED AND ENVIRONMENTAL MICROBIOLOGY\u000aVL 74\u000aIS 9\u000aBP 2766\u000aEP 2777\u000aDI 10.1128/AEM.02591-07\u000aPD MAY 2008\u000aPY 2008\u000aAB Malic acid is a potential biomass-derivable \"building block\" for\u000a   chemical synthesis. Since wild-type Saccharomyces cerevisiae strains\u000a   produce only low levels of malate, metabolic engineering is required to\u000a   achieve efficient malate production with this yeast. A promising pathway\u000a   for malate production from glucose proceeds via carboxylation of\u000a   pyruvate, followed by reduction of oxaloacetate to malate. This redox-\u000a   and ATP-neutral, CO2-fixing pathway has a theoretical maximum yield of 2\u000a   mol malate (mol glucose)(-1). A previously engineered glucose-tolerant,\u000a   C-2-independent pyruvate decarboxylase-negative S. cerevisiae strain was\u000a   used as the platform to evaluate the impact of individual and combined\u000a   introduction of three genetic modifications: (i) overexpression of the\u000a   native pyruvate carboxylase encoded by PYC2, (ii) high-level expression\u000a   of an allele of the MDH3 gene, of which the encoded malate dehydrogenase\u000a   was retargeted to the cytosol by deletion of the C-terminal peroxisomal\u000a   targeting sequence, and (iii) functional expression of the\u000a   Schizosaccharomyces pombe malate transporter gene SpMAE1. While single\u000a   or double modifications improved malate production, the highest malate\u000a   yields and titers were obtained with the simultaneous introduction of\u000a   all three modifications. In glucose-grown batch cultures, the resulting\u000a   engineered strain produced malate at titers of up to 59 g liter(-1) at a\u000a   malate yield of 0.42 mol (mol glucose)(-1). Metabolic flux analysis\u000a   showed that metabolite labeling patterns observed upon nuclear magnetic\u000a   resonance analyses of cultures grown on C-13-labeled glucose were\u000a   consistent with the envisaged nonoxidative, fermentative pathway for\u000a   malate production. The engineered strains still produced substantial\u000a   amounts of pyruvate, indicating that the pathway efficiency can be\u000a   further improved.\u000aTC 15\u000aZ9 17\u000aSN 0099-2240\u000aUT WOS:000255567900024\u000aER\u000a\u000aEF",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Rintze M.",
						"lastName": "Zelle",
						"creatorType": "author"
					},
					{
						"firstName": "Jacob C.",
						"lastName": "Harrison",
						"creatorType": "author"
					},
					{
						"firstName": "Jack T.",
						"lastName": "Pronk",
						"creatorType": "author"
					},
					{
						"firstName": "Antonius J. A.",
						"lastName": "van Maris",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "WOS:000286597100004",
				"title": "Anaplerotic Role for Cytosolic Malic Enzyme in Engineered Saccharomyces   cerevisiae Strains",
				"publicationTitle": "Applied and Environmental Microbiology",
				"volume": "77",
				"issue": "3",
				"pages": "732-738",
				"DOI": "10.1128/AEM.02132-10",
				"date": "FEB  2011",
				"abstractNote": "Malic enzyme catalyzes the reversible oxidative decarboxylation of   malate to pyruvate and CO(2). The Saccharomyces cerevisiae MAE1 gene   encodes a mitochondrial malic enzyme whose proposed physiological roles   are related to the oxidative, malate-decarboxylating reaction. Hitherto,   the inability of pyruvate carboxylase-negative (Pyc(-)) S. cerevisiae   strains to grow on glucose suggested that Mae1p cannot act as a   pyruvate-carboxylating, anaplerotic enzyme. In this study, relocation of   malic enzyme to the cytosol and creation of thermodynamically favorable   conditions for pyruvate carboxylation by metabolic engineering, process   design, and adaptive evolution, enabled malic enzyme to act as the sole   anaplerotic enzyme in S. cerevisiae. The Escherichia coli NADH-dependent   sfcA malic enzyme was expressed in a Pyc(-) S. cerevisiae background.   When PDC2, a transcriptional regulator of pyruvate decarboxylase genes,   was deleted to increase intracellular pyruvate levels and cells were   grown under a CO(2) atmosphere to favor carboxylation, adaptive   evolution yielded a strain that grew on glucose (specific growth rate,   0.06 +/- 0.01 h(-1)). Growth of the evolved strain was enabled by a   single point mutation (Asp336Gly) that switched the cofactor preference   of E. coli malic enzyme from NADH to NADPH. Consistently, cytosolic   relocalization of the native Mae1p, which can use both NADH and NADPH,   in a pyc1,2 Delta pdc2 Delta strain grown under a CO(2) atmosphere, also   enabled slow-growth on glucose. Although growth rates of these strains   are still low, the higher ATP efficiency of carboxylation via malic   enzyme, compared to the pyruvate carboxylase pathway, may contribute to   metabolic engineering of S. cerevisiae for anaerobic, high-yield   C(4)-dicarboxylic acid production.",
				"ISSN": "0099-2240"
			},
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Rintze M.",
						"lastName": "Zelle",
						"creatorType": "author"
					},
					{
						"firstName": "Josh",
						"lastName": "Trueheart",
						"creatorType": "author"
					},
					{
						"firstName": "Jacob C.",
						"lastName": "Harrison",
						"creatorType": "author"
					},
					{
						"firstName": "Jack T.",
						"lastName": "Pronk",
						"creatorType": "author"
					},
					{
						"firstName": "Antonius J. A.",
						"lastName": "van Maris",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "WOS:000280633400006",
				"title": "Phosphoenolpyruvate Carboxykinase as the Sole Anaplerotic Enzyme in   Saccharomyces cerevisiae",
				"publicationTitle": "Applied and Environmental Microbiology",
				"volume": "76",
				"issue": "16",
				"pages": "5383-5389",
				"DOI": "10.1128/AEM.01077-10",
				"date": "AUG  2010",
				"abstractNote": "Pyruvate carboxylase is the sole anaplerotic enzyme in glucose-grown   cultures of wild-type Saccharomyces cerevisiae. Pyruvate   carboxylase-negative (Pyc(-)) S. cerevisiae strains cannot grow on   glucose unless media are supplemented with C(4) compounds, such as   aspartic acid. In several succinate-producing prokaryotes,   phosphoenolpyruvate carboxykinase (PEPCK) fulfills this anaplerotic   role. However, the S. cerevisiae PEPCK encoded by PCK1 is repressed by   glucose and is considered to have a purely decarboxylating and   gluconeogenic function. This study investigates whether and under which   conditions PEPCK can replace the anaplerotic function of pyruvate   carboxylase in S. cerevisiae. Pyc(-) S. cerevisiae strains   constitutively overexpressing the PEPCK either from S. cerevisiae or   from Actinobacillus succinogenes did not grow on glucose as the sole   carbon source. However, evolutionary engineering yielded mutants able to   grow on glucose as the sole carbon source at a maximum specific growth   rate of ca. 0.14 h(-1), one-half that of the (pyruvate   carboxylase-positive) reference strain grown under the same conditions.   Growth was dependent on high carbon dioxide concentrations, indicating   that the reaction catalyzed by PEPCK operates near thermodynamic   equilibrium. Analysis and reverse engineering of two independently   evolved strains showed that single point mutations in pyruvate kinase,   which competes with PEPCK for phosphoenolpyruvate, were sufficient to   enable the use of PEPCK as the sole anaplerotic enzyme. The PEPCK   reaction produces one ATP per carboxylation event, whereas the original   route through pyruvate kinase and pyruvate carboxylase is ATP neutral.   This increased ATP yield may prove crucial for engineering of efficient   and low-cost anaerobic production of C(4) dicarboxylic acids in S.   cerevisiae.",
				"ISSN": "0099-2240"
			},
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Rintze M.",
						"lastName": "Zelle",
						"creatorType": "author"
					},
					{
						"firstName": "Erik",
						"lastName": "De Hulster",
						"creatorType": "author"
					},
					{
						"firstName": "Wendy",
						"lastName": "Kloezen",
						"creatorType": "author"
					},
					{
						"firstName": "Jack T.",
						"lastName": "Pronk",
						"creatorType": "author"
					},
					{
						"firstName": "Antonius J. A.",
						"lastName": "van Maris",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "WOS:000274017400015",
				"title": "Key Process Conditions for Production of C(4) Dicarboxylic Acids in   Bioreactor Batch Cultures of an Engineered Saccharomyces cerevisiae   Strain",
				"publicationTitle": "Applied and Environmental Microbiology",
				"volume": "76",
				"issue": "3",
				"pages": "744-750",
				"DOI": "10.1128/AEM.02396-09",
				"date": "FEB  2010",
				"abstractNote": "A recent effort to improve malic acid production by Saccharomyces   cerevisiae by means of metabolic engineering resulted in a strain that   produced up to 59 g liter(-1) of malate at a yield of 0.42 mol (mol   glucose)(-1) in calcium carbonate-buffered shake flask cultures. With   shake flasks, process parameters that are important for scaling up this   process cannot be controlled independently. In this study, growth and   product formation by the engineered strain were studied in bioreactors   in order to separately analyze the effects of pH, calcium, and carbon   dioxide and oxygen availability. A near-neutral pH, which in shake   flasks was achieved by adding CaCO(3), was required for efficient C(4)   dicarboxylic acid production. Increased calcium concentrations, a side   effect of CaCO(3) dissolution, had a small positive effect on malate   formation. Carbon dioxide enrichment of the sparging gas (up to 15%   [vol/vol]) improved production of both malate and succinate. At higher   concentrations, succinate titers further increased, reaching 0.29 mol   (mol glucose)(-1), whereas malate formation strongly decreased. Although   fully aerobic conditions could be achieved, it was found that moderate   oxygen limitation benefitted malate production. In conclusion, malic   acid production with the engineered S. cerevisiae strain could be   successfully transferred from shake flasks to 1-liter batch bioreactors   by simultaneous optimization of four process parameters (pH and   concentrations of CO(2), calcium, and O(2)). Under optimized conditions,   a malate yield of 0.48 +/- 0.01 mol (mol glucose)(-1) was obtained in   bioreactors, a 19% increase over yields in shake flask experiments.",
				"ISSN": "0099-2240"
			},
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Derek A.",
						"lastName": "Abbott",
						"creatorType": "author"
					},
					{
						"firstName": "Rintze M.",
						"lastName": "Zelle",
						"creatorType": "author"
					},
					{
						"firstName": "Jack T.",
						"lastName": "Pronk",
						"creatorType": "author"
					},
					{
						"firstName": "Antonius J. A.",
						"lastName": "van Maris",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "WOS:000271264400001",
				"title": "Metabolic engineering of Saccharomyces cerevisiae for production of   carboxylic acids: current status and challenges",
				"publicationTitle": "Fems Yeast Research",
				"volume": "9",
				"issue": "8",
				"pages": "1123-1136",
				"DOI": "10.1111/j.1567-1364.2009.00537.x",
				"date": "DEC  2009",
				"abstractNote": "To meet the demands of future generations for chemicals and energy and   to reduce the environmental footprint of the chemical industry,   alternatives for petrochemistry are required. Microbial conversion of   renewable feedstocks has a huge potential for cleaner, sustainable   industrial production of fuels and chemicals. Microbial production of   organic acids is a promising approach for production of chemical   building blocks that can replace their petrochemically derived   equivalents. Although Saccharomyces cerevisiae does not naturally   produce organic acids in large quantities, its robustness, pH tolerance,   simple nutrient requirements and long history as an industrial workhorse   make it an excellent candidate biocatalyst for such processes. Genetic   engineering, along with evolution and selection, has been successfully   used to divert carbon from ethanol, the natural endproduct of S.   cerevisiae, to pyruvate. Further engineering, which included expression   of heterologous enzymes and transporters, yielded strains capable of   producing lactate and malate from pyruvate. Besides these metabolic   engineering strategies, this review discusses the impact of transport   and energetics as well as the tolerance towards these organic acids. In   addition to recent progress in engineering S. cerevisiae for organic   acid production, the key limitations and challenges are discussed in the   context of sustainable industrial production of organic acids from   renewable feedstocks.",
				"ISSN": "1567-1356"
			},
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Rintze M.",
						"lastName": "Zelle",
						"creatorType": "author"
					},
					{
						"firstName": "Erik",
						"lastName": "de Hulster",
						"creatorType": "author"
					},
					{
						"firstName": "WoUter A.",
						"lastName": "van Winden",
						"creatorType": "author"
					},
					{
						"firstName": "Pieter",
						"lastName": "de Waard",
						"creatorType": "author"
					},
					{
						"firstName": "Cor",
						"lastName": "Dijkema",
						"creatorType": "author"
					},
					{
						"firstName": "Aaron A.",
						"lastName": "Winkler",
						"creatorType": "author"
					},
					{
						"firstName": "Jan-Maarten A.",
						"lastName": "Geertman",
						"creatorType": "author"
					},
					{
						"firstName": "Johannes P.",
						"lastName": "van Dijken",
						"creatorType": "author"
					},
					{
						"firstName": "Jack T.",
						"lastName": "Pronk",
						"creatorType": "author"
					},
					{
						"firstName": "Antonius J. A.",
						"lastName": "van Maris",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "WOS:000255567900024",
				"title": "Malic acid production by Saccharomyces cerevisiae: Engineering of   pyruvate carboxylation, oxaloacetate reduction, and malate export",
				"publicationTitle": "Applied and Environmental Microbiology",
				"volume": "74",
				"issue": "9",
				"pages": "2766-2777",
				"DOI": "10.1128/AEM.02591-07",
				"date": "MAY  2008",
				"abstractNote": "Malic acid is a potential biomass-derivable \"building block\" for   chemical synthesis. Since wild-type Saccharomyces cerevisiae strains   produce only low levels of malate, metabolic engineering is required to   achieve efficient malate production with this yeast. A promising pathway   for malate production from glucose proceeds via carboxylation of   pyruvate, followed by reduction of oxaloacetate to malate. This redox-   and ATP-neutral, CO2-fixing pathway has a theoretical maximum yield of 2   mol malate (mol glucose)(-1). A previously engineered glucose-tolerant,   C-2-independent pyruvate decarboxylase-negative S. cerevisiae strain was   used as the platform to evaluate the impact of individual and combined   introduction of three genetic modifications: (i) overexpression of the   native pyruvate carboxylase encoded by PYC2, (ii) high-level expression   of an allele of the MDH3 gene, of which the encoded malate dehydrogenase   was retargeted to the cytosol by deletion of the C-terminal peroxisomal   targeting sequence, and (iii) functional expression of the   Schizosaccharomyces pombe malate transporter gene SpMAE1. While single   or double modifications improved malate production, the highest malate   yields and titers were obtained with the simultaneous introduction of   all three modifications. In glucose-grown batch cultures, the resulting   engineered strain produced malate at titers of up to 59 g liter(-1) at a   malate yield of 0.42 mol (mol glucose)(-1). Metabolic flux analysis   showed that metabolite labeling patterns observed upon nuclear magnetic   resonance analyses of cultures grown on C-13-labeled glucose were   consistent with the envisaged nonoxidative, fermentative pathway for   malate production. The engineered strains still produced substantial   amounts of pyruvate, indicating that the pathway efficiency can be   further improved.",
				"ISSN": "0099-2240"
			}
		]
	},
	{
		"type": "import",
		"input": "FN Thomson Reuters Web of Knowledge\u000aVR 1.0\u000aPT J\u000aAU Smith, L. J.\u000a   Schwark, W. S.\u000a   Cook, D. R.\u000a   Moon, P. F.\u000a   Erb, H. N.\u000a   Looney, A. L.\u000aTI Pharmacokinetics of intravenous mivacurium in halothane-anesthetized\u000a   dogs.\u000aSO Veterinary Surgery\u000aVL 27\u000aIS 2\u000aPS 170\u000aPY 1998\u000aUT CABI:19982209000\u000aDT Abstract only\u000aLA English\u000aSN 0161-3499\u000aCC LL900Animal Toxicology, Poisoning and Pharmacology (Discontinued March\u000a   2000); LL070Pets and Companion Animals\u000aCN 151-67-7\u000aDE anaesthesia; halothane; muscle relaxants; pharmacokinetics\u000aOR dogs\u000aBD Canis; Canidae; Fissipeda; carnivores; mammals; vertebrates; Chordata;\u000a   animals; small mammals; eukaryotes\u000aER\u000a\u000aEF",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "L. J.",
						"lastName": "Smith",
						"creatorType": "author"
					},
					{
						"firstName": "W. S.",
						"lastName": "Schwark",
						"creatorType": "author"
					},
					{
						"firstName": "D. R.",
						"lastName": "Cook",
						"creatorType": "author"
					},
					{
						"firstName": "P. F.",
						"lastName": "Moon",
						"creatorType": "author"
					},
					{
						"firstName": "H. N.",
						"lastName": "Erb",
						"creatorType": "author"
					},
					{
						"firstName": "A. L.",
						"lastName": "Looney",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"anaesthesia",
					"halothane",
					"muscle relaxants",
					"pharmacokinetics",
					"dogs",
					"Canis",
					"Canidae",
					"Fissipeda",
					"carnivores",
					"mammals",
					"vertebrates",
					"Chordata",
					"animals",
					"small mammals",
					"eukaryotes"
				],
				"seeAlso": [],
				"attachments": [],
				"extra": "CABI:19982209000",
				"title": "Pharmacokinetics of intravenous mivacurium in halothane-anesthetized   dogs.",
				"publicationTitle": "Veterinary Surgery",
				"volume": "27",
				"issue": "2",
				"date": "1998",
				"language": "English",
				"ISSN": "0161-3499"
			}
		]
	},
	{
		"type": "import",
		"input": "FN Thomson Reuters Web of Knowledge\u000aVR 1.0\u000aPT J\u000aAU Smith, JM \u000aAF Smith, J. Mark\u000aTI Gripewater\u000aSO FIDDLEHEAD\u000aLA English \u000aDT Poetry\u000aNR 0\u000aTC 0\u000aZ9 0\u000aPU UNIV NEW BRUNSWICK\u000aPI FREDERICTON\u000aPA DEPT ENGLISH, CAMPUS HOUSE, PO BOX 4400, FREDERICTON, NB E3B 5A3, CANADA\u000aSN 0015-0630\u000aJ9 FIDDLEHEAD\u000aJI Fiddlehead\u000aPD SPR\u000aPY 2011\u000aIS 247\u000aBP 82\u000aEP 82\u000aPG 1\u000aWC Literary Reviews\u000aSC Literature\u000aGA 757VG\u000aUT WOS:000290115300030\u000aER\u000a\u000aEF",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "J. Mark",
						"lastName": "Smith",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "WOS:000290115300030",
				"title": "Gripewater",
				"publicationTitle": "Fiddlehead",
				"language": "English",
				"publisher": "Univ New Brunswick",
				"place": "Fredericton",
				"ISSN": "0015-0630",
				"journalAbbreviation": "Fiddlehead",
				"date": "SPR 2011",
				"issue": "247",
				"pages": "82-82"
			}
		]
	},
	{
		"type": "import",
		"input": "﻿FN Thomson Reuters Web of Knowledge\u000aVR 1.0\u000aPT S\u000aAU McCormick, MC\u000a   Litt, JS\u000a   Smith, VC\u000a   Zupancic, JAF\u000aAF McCormick, Marie C.\u000a   Litt, Jonathan S.\u000a   Smith, Vincent C.\u000a   Zupancic, John A. F.\u000aBE Fielding, JE\u000a   Brownson, RC\u000a   Green, LW\u000aTI Prematurity: An Overview and Public Health Implications\u000aSO ANNUAL REVIEW OF PUBLIC HEALTH, VOL 32\u000aSE Annual Review of Public Health\u000aLA English\u000aDT Review\u000aDE infant mortality; childhood morbidity; prevention\u000aID LOW-BIRTH-WEIGHT; NEONATAL INTENSIVE-CARE; QUALITY-OF-LIFE; EXTREMELY\u000a   PRETERM BIRTH; YOUNG-ADULTS BORN; AGE 8 YEARS; CHILDREN BORN;\u000a   BRONCHOPULMONARY DYSPLASIA; LEARNING-DISABILITIES; EXTREME PREMATURITY\u000aAB The high rate of premature births in the United States remains a public\u000a   health concern. These infants experience substantial morbidity and\u000a   mortality in the newborn period, which translate into significant\u000a   medical costs. In early childhood, survivors are characterized by a\u000a   variety of health problems, including motor delay and/or cerebral palsy,\u000a   lower IQs, behavior problems, and respiratory illness, especially\u000a   asthma. Many experience difficulty with school work, lower\u000a   health-related quality of life, and family stress. Emerging information\u000a   in adolescence and young adulthood paints a more optimistic picture,\u000a   with persistence of many problems but with better adaptation and more\u000a   positive expectations by the young adults. Few opportunities for\u000a   prevention have been identified; therefore, public health approaches to\u000a   prematurity include assurance of delivery in a facility capable of\u000a   managing neonatal complications, quality improvement to minimize\u000a   interinstitutional variations, early developmental support for such\u000a   infants, and attention to related family health issues.\u000aC1 [McCormick, MC] Harvard Univ, Dept Soc Human Dev & Hlth, Sch Publ Hlth, Boston, MA 02115 USA\u000a   [McCormick, MC; Litt, JS; Smith, VC; Zupancic, JAF] Beth Israel Deaconess Med Ctr, Dept Neonatol, Boston, MA 02215 USA\u000a   [Litt, JS] Childrens Hosp Boston, Div Newborn Med, Boston, MA 02115 USA\u000aRP McCormick, MC (reprint author), Harvard Univ, Dept Soc Human Dev & Hlth, Sch Publ Hlth, Boston, MA 02115 USA\u000aEM mmccormi@hsph.harvard.edu\u000a   vsmith1@bidmc.harvard.edu\u000a   jzupanci@bidmc.harvard.edu\u000a   Jonathan.Litt@childrens.harvard.edu\u000aNR 91\u000aTC 1\u000aZ9 1\u000aPU ANNUAL REVIEWS\u000aPI PALO ALTO\u000aPA 4139 EL CAMINO WAY, PO BOX 10139, PALO ALTO, CA 94303-0897 USA\u000aSN 0163-7525\u000aBN 978-0-8243-2732-3\u000aJ9 ANNU REV PUBL HEALTH\u000aJI Annu. Rev. Public Health\u000aPY 2011\u000aVL 32\u000aBP 367\u000aEP 379\u000aDI 10.1146/annurev-publhealth-090810-182459\u000aPG 13\u000aGA BUZ33\u000aUT WOS:000290776200020\u000aER\u000a\u000aEF",
		"items": [
			{
				"itemType": "bookSection",
				"creators": [
					{
						"firstName": "Marie C.",
						"lastName": "McCormick",
						"creatorType": "author"
					},
					{
						"firstName": "Jonathan S.",
						"lastName": "Litt",
						"creatorType": "author"
					},
					{
						"firstName": "Vincent C.",
						"lastName": "Smith",
						"creatorType": "author"
					},
					{
						"firstName": "John A. F.",
						"lastName": "Zupancic",
						"creatorType": "author"
					},
					{
						"firstName": "JE",
						"lastName": "Fielding",
						"creatorType": "editor"
					},
					{
						"firstName": "RC",
						"lastName": "Brownson",
						"creatorType": "editor"
					},
					{
						"firstName": "LW",
						"lastName": "Green",
						"creatorType": "editor"
					}
				],
				"notes": [],
				"tags": [
					"infant mortality",
					"childhood morbidity",
					"prevention",
					"low-birth-weight",
					"neonatal intensive-care",
					"quality-of-life",
					"extremely   preterm birth",
					"young-adults born",
					"age 8 years",
					"children born",
					"bronchopulmonary dysplasia",
					"learning-disabilities",
					"extreme prematurity"
				],
				"seeAlso": [],
				"attachments": [],
				"extra": "WOS:000290776200020",
				"title": "Prematurity: An Overview and Public Health Implications",
				"publicationTitle": "Annual Review of Public Health, Vol 32",
				"language": "English",
				"abstractNote": "The high rate of premature births in the United States remains a public   health concern. These infants experience substantial morbidity and   mortality in the newborn period, which translate into significant   medical costs. In early childhood, survivors are characterized by a   variety of health problems, including motor delay and/or cerebral palsy,   lower IQs, behavior problems, and respiratory illness, especially   asthma. Many experience difficulty with school work, lower   health-related quality of life, and family stress. Emerging information   in adolescence and young adulthood paints a more optimistic picture,   with persistence of many problems but with better adaptation and more   positive expectations by the young adults. Few opportunities for   prevention have been identified; therefore, public health approaches to   prematurity include assurance of delivery in a facility capable of   managing neonatal complications, quality improvement to minimize   interinstitutional variations, early developmental support for such   infants, and attention to related family health issues.",
				"place": "Palo Alto",
				"publisher": "Annual Reviews",
				"ISSN": "0163-7525",
				"ISBN": "978-0-8243-2732-3",
				"journalAbbreviation": "Annu. Rev. Public Health",
				"date": "2011",
				"volume": "32",
				"pages": "367-379",
				"DOI": "10.1146/annurev-publhealth-090810-182459"
			}
		]
	},
	{
		"type": "import",
		"input": "﻿FN Thomson Reuters Web of Knowledge\u000aVR 1.0\u000aPT P\u000aUT BIOSIS:PREV201100469175\u000aDT Patent\u000aTI Indexing cell delivery catheter\u000aAU Solar, Matthew S.\u000a   Parmer, Kari\u000a   Smith, Philip\u000a   Murdock, Frank\u000aPN US 07967789\u000aAE Medtronic Inc\u000aDG June 28, 2011\u000aPC USA\u000aPL 604-16501\u000aSO Official Gazette of the United States Patent and Trademark Office\u000a   Patents\u000aPY 2011\u000aPD JUN 28 2011\u000aLA English\u000aAB An insertion device with an insertion axis includes an axial actuator\u000a   with a first portion and a second portion. The first portion is moveable\u000a   along the insertion axis relative to the second portion. The insertion\u000a   device further includes a first tube coupled to the first portion of the\u000a   axial actuator, and the first tube is movable along the insertion axis\u000a   in response to movement of the first portion relative to the second\u000a   portion. The device further includes a second tube having a radially\u000a   biased distal end. The distal end is substantially contained within the\u000a   first tube in a first state, and the second tube is rotatable with\u000a   respect to the first tube. Also, the second tube is axially movable to a\u000a   second state, and a portion of a distal end of the second tube is\u000a   exposed from a distal end of the first tube in the second state.\u000aC1 Indialantic, FL USA\u000aSN 0098-1133\u000aMC Human Medicine (Medical Sciences); Equipment Apparatus Devices and\u000a   Instrumentation\u000aCC 12502, Pathology - General\u000aMQ indexing cell delivery catheter; medical supplies\u000aER\u000a\u000aEF",
		"items": [
			{
				"itemType": "patent",
				"creators": [
					{
						"firstName": "Matthew S.",
						"lastName": "Solar",
						"creatorType": "inventor"
					},
					{
						"firstName": "Kari",
						"lastName": "Parmer",
						"creatorType": "inventor"
					},
					{
						"firstName": "Philip",
						"lastName": "Smith",
						"creatorType": "inventor"
					},
					{
						"firstName": "Frank",
						"lastName": "Murdock",
						"creatorType": "inventor"
					}
				],
				"notes": [],
				"tags": [
					"Human Medicine (Medical Sciences)",
					"Equipment Apparatus Devices and   Instrumentation",
					"indexing cell delivery catheter",
					"medical supplies"
				],
				"seeAlso": [],
				"attachments": [],
				"extra": "BIOSIS:PREV201100469175",
				"title": "Indexing cell delivery catheter",
				"patentNumber": "US 07967789",
				"assignee": "Medtronic Inc",
				"issueDate": "June 28, 2011",
				"country": "USA",
				"priorityNumber": "604-16501",
				"publicationTitle": "Official Gazette of the United States Patent and Trademark Office   Patents",
				"date": "JUN 28 2011",
				"language": "English",
				"abstractNote": "An insertion device with an insertion axis includes an axial actuator   with a first portion and a second portion. The first portion is moveable   along the insertion axis relative to the second portion. The insertion   device further includes a first tube coupled to the first portion of the   axial actuator, and the first tube is movable along the insertion axis   in response to movement of the first portion relative to the second   portion. The device further includes a second tube having a radially   biased distal end. The distal end is substantially contained within the   first tube in a first state, and the second tube is rotatable with   respect to the first tube. Also, the second tube is axially movable to a   second state, and a portion of a distal end of the second tube is   exposed from a distal end of the first tube in the second state.",
				"place": "Indialantic, FL USA",
				"ISSN": "0098-1133"
			}
		]
	},
	{
		"type": "import",
		"input": "﻿FN Thomson Reuters Web of Knowledge\u000aVR 1.0\u000aPT B\u000aAU Smith, W. G.\u000aTI Ecological anthropology of households in East Madura, Indonesia.\u000aSO Ecological anthropology of households in East Madura, Indonesia\u000aPD 2011\u000aPY 2011\u000aZ9 0\u000aBN 978-90-8585933-8\u000aUT CABI:20113178956\u000aER\u000a\u000aPT J\u000aAU Smith, S. A.\u000aTI Production and characterization of polyclonal antibodies to\u000a   hexanal-lysine adducts for use in an ELISA to monitor lipid oxidation in\u000a   a meat model system.\u000aSO Dissertation Abstracts International, B\u000aVL 58\u000aIS 9\u000aPD 1998, thesis publ. 1997\u000aPY 1998\u000aZ9 0\u000aSN 0419-4217\u000aUT FSTA:1998-09-Sn1570\u000aER\u000a\u000aPT J\u000aAU Smith, E. H.\u000aTI The enzymic oxidation of linoleic and linolenic acid.\u000aSO Dissertation Abstracts International, B\u000aVL 49\u000aIS 4\u000aBP BRD\u000aPD 1988\u000aPY 1988\u000aZ9 0\u000aSN 0419-4217\u000aUT FSTA:1989-04-N-0004\u000aER\u000a\u000aPT J\u000aAU Smith, C. S.\u000aTI The syneresis of renneted milk gels.\u000aSO Dissertation Abstracts International. B, Sciences and Engineering\u000aVL 49\u000aIS 5\u000aBP 1459\u000aPD 1988\u000aPY 1988\u000aZ9 0\u000aSN 0419-4217\u000aUT CABI:19910448509\u000aER\u000a\u000aEF",
		"items": [
			{
				"itemType": "book",
				"creators": [
					{
						"firstName": "W. G.",
						"lastName": "Smith",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "CABI:20113178956",
				"title": "Ecological anthropology of households in East Madura, Indonesia.",
				"publicationTitle": "Ecological anthropology of households in East Madura, Indonesia",
				"date": "2011",
				"ISBN": "978-90-8585933-8"
			},
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "S. A.",
						"lastName": "Smith",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "FSTA:1998-09-Sn1570",
				"title": "Production and characterization of polyclonal antibodies to   hexanal-lysine adducts for use in an ELISA to monitor lipid oxidation in   a meat model system.",
				"publicationTitle": "Dissertation Abstracts International, B",
				"volume": "58",
				"issue": "9",
				"date": ", thesis publ. 1997 1998",
				"ISSN": "0419-4217"
			},
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "E. H.",
						"lastName": "Smith",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "FSTA:1989-04-N-0004",
				"title": "The enzymic oxidation of linoleic and linolenic acid.",
				"publicationTitle": "Dissertation Abstracts International, B",
				"volume": "49",
				"issue": "4",
				"pages": "BRD",
				"date": "1988",
				"ISSN": "0419-4217"
			},
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "C. S.",
						"lastName": "Smith",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "CABI:19910448509",
				"title": "The syneresis of renneted milk gels.",
				"publicationTitle": "Dissertation Abstracts International. B, Sciences and Engineering",
				"volume": "49",
				"issue": "5",
				"pages": "1459",
				"date": "1988",
				"ISSN": "0419-4217"
			}
		]
	}
]
/** END TEST CASES **/
