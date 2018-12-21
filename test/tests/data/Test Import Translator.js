{
    "translatorID": "619ed0f3-d8f3-4086-b1e7-f57ef35c3c43",
    "label": "Import Zotero JSON",
    "creator": "Simon Kornblith",
    "target": "json",
    "minVersion": "",
    "maxVersion": "",
    "priority": 1,
    "inRepository": false,
    "translatorType": 1,
    "browserSupport": "g",
    "lastUpdated": "2015-06-12 20:15:00"
}

var parsedData;

function parseInput() {
    var str, json = "";
    
    // Read in the whole file at once, since we can't easily parse a JSON stream. The 
    // chunk size here is pretty arbitrary, although larger chunk sizes may be marginally
    // faster. We set it to 1MB.
    while((str = Z.read(1048576)) !== false) json += str;
    
    try {
        parsedData = JSON.parse(json);
    } catch(e) {
        Zotero.debug(e);
    }
}

function detectImport() {
    parseInput();
    if(!parsedData) return false;
    return typeof parsedData === "object" && parsedData["journalArticle"];
}

function doImport() {
	parseInput();
	if(!parsedData) item.complete(false, 'No valid items found');
    for(var itemType in parsedData) {
        var item = new Z.Item(itemType);
        for (var field in parsedData[itemType]) {
            item[field] = parsedData[itemType][field];
        }
        item.complete();
    }
}
