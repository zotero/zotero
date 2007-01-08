function onDone(xmlhttp, manual){
	var translatorUpdates = xmlhttp.responseXML.getElementsByTagName('translator');
	var styleUpdates = xmlhttp.responseXML.getElementsByTagName('style');
	
	if (!translatorUpdates.length && !styleUpdates.length){
		Zotero.debug('All translators and styles are up-to-date');
		return -1;
	}
	
	//xmlhttp.responseXML.normalize();
	
	for (var i=0, len=translatorUpdates.length; i<len; i++){
		Zotero.debug( translatorUpdates[i].getElementsByTagName('code')[0].firstChild.nodeValue );
		Zotero.debug( translatorUpdates[i].getElementsByTagName('code')[0].childNodes.length );
		Zotero.debug('-----------------------------');
		Zotero.debug('-----------------------------');
		continue;
		
		/*
		var codeNode = translatorUpdates[i].getElementsByTagName('code')[0];
		var code = '';
		for (var j=0; j<codeNode.childNodes.length; j++){
			code += codeNode.childNodes[j].nodeValue;
		}
		*/
		Zotero.debug(code);
		Zotero.debug('-----------------------------');
	}
}

function doGo(s){
	Zotero.Utilities.HTTP.doGet('http://www.zotero.org/repo/fetch/' + s, onDone);
}


function compareVersions(a,b) {
 var x = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                   .getService(Components.interfaces.nsIVersionComparator)
                   .compare(a,b);
 if(x == 0)
   return a + "==" + b;
 else if(x > 0)
   return a + ">" + b;
 return a + "<" + b;
}
//Zotero.debug(compareVersions("1.0.0b3.r1*", "1.0.0b3.r1.SVN"));

//Zotero.Utilities.HTTP.doGet('http://www.zotero.org/repo/fetch/96b9f483-c44d-5784-cdad-ce21b984fe01', onDone);
//Zotero.Utilities.HTTP.doGet('http://www.zotero.org/repo/fetch', onDone);

function pickFile(){
        const nsIFilePicker = Components.interfaces.nsIFilePicker;

        var fp = Components.classes["@mozilla.org/filepicker;1"]
                .createInstance(nsIFilePicker);
        fp.init(window, "Dialog Title", nsIFilePicker.modeGetFile);
        fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);

        var rv = fp.show();
        if (rv == nsIFilePicker.returnOK){
                return fp.file;
        }
}


/*
var rows = Zotero.DB.columnQuery("SELECT translatorID FROM translators");
for each(var row in rows){
	doGo(row.substr(0, 32));
}
*/
