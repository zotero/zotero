{
	"translatorID":"54ac4ec1-9d07-45d3-9d96-48bed3411fb6",
	"translatorType":4,
	"label":"National Library of Australia (new catalog)",
	"creator":"Mark Triggs and Steve McPhillips",
	"target":"catalogue.nla.gov.au",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-02-08 22:10:00"
}

function detectWeb(doc, url) {
    if (url.match("/Record/[0-9]+")) {
        var format = Zotero.Utilities.cleanString(doc.getElementById("myformat").textContent);

        if (format == "Audio") {
            return "audioRecording";
        }
        else if (format == "Book") {
            return "book";
        }
        else if (format == "Journal/Newspaper") {
            return "journalArticle";
        }
        else if (format == "Manuscript") {
            return "manuscript";
        }
        else if (format == "Map") {
            return "map";
        }
        else if (format == "Music") {
            return "audioRecording";
        }
        else if (format == "Online") {
            return "webpage";
        }
        else if (format == "Picture") {
            return "artwork";
        }
        else if (format == "Video") {
            return "videoRecording";
        }
        else {
            return "book";
        }
    } else if (url.match ("/Search/Home") &&
               doc.getElementById ("resultItemLine1")) {
        return "multiple";
    }
}

function as_array(obj) {
    if (obj instanceof Array) {
        return obj;
    } else {
        return [obj];
    }
}


function load_item(responseText, requestObject, format) {
    var metadata = JSON.parse(Zotero.Utilities.cleanString(responseText));
    var newItem = new Zotero.Item(format);

    /* load in our authors */
    if (metadata.authors) {
        for (var i=0; i< metadata.authors.length ; i++) {
            newItem.creators.push(Zotero.Utilities.cleanAuthor
                                  (metadata.authors[i], "author", true));
        }
    }

    /* and our tags */
    if (metadata.tags) {
        for (var i=0; i< metadata.tags.length ; i++) {
            newItem.tags.push(metadata.tags[i]);
        }
    }
    
    /* and our summary */
    if (metadata.notes) {
        newItem.notes.push ({"note": metadata.notes});
    }

    /* and everything else */
    for (var attr in metadata) {
        if (!newItem[attr]) {
            newItem[attr] = metadata[attr];
        }
    }
    newItem.repository = "National Library of Australia";
    newItem.complete();
}

function doWeb(doc, url) {
    format = detectWeb(doc, url);

    items = [];
    if (format == "multiple") {
        for (var url in Zotero.selectItems((Zotero.Utilities.getItemArray
                                            (doc, doc, "/Record/[0-9]+")))) {
            items.push(url);
        }
    } else {
        items.push(url);
    }

    if (items.length > 0) {
        Zotero.Utilities.processDocuments(items, function(onedoc) {
                handleDocument(onedoc);
            }, function() { Zotero.done(); });

        Zotero.wait();
    }
}


function handleDocument(doc) {
    bibid = doc.location.href.match("^.*\/Record/([0-9]+)")[1];
    format = detectWeb(doc, doc.location.href);
    Zotero.Utilities.HTTP.doGet("http://catalogue.nla.gov.au/Record/" +
                                bibid +
                                "/Export?style=zotero",
                                function(text, obj) {
                                    load_item(text, obj, format);
                                });
}