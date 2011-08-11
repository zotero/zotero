{
	"translatorID": "4e7119e0-02be-4848-86ef-79a64185aad8",
	"label": "Bookmarks",
	"creator": "Avram Lyon",
	"target": "html",
	"minVersion": "2.1b6",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 3,
	"browserSupport": "gscn",
	"lastUpdated": "2011-07-09 18:52:34"
}

/*
   Browser bookmarks translator
   Copyright (C) 2011 Avram Lyon, ajlyon@gmail.com

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

 /* This translator imports and exports browser bookmark files in the standard
  * "Netscape Bookmark Format".
  * See http://msdn.microsoft.com/en-us/library/aa753582%28VS.85%29.aspx
  * This code draws from the CSL style for bookmark export, by Rintze Zelle
  * http://www.zotero.org/styles/bookmark-export
  * Input looks like:
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>
<DL>
    <DT><A HREF="http://www.example.com/">Example Site</A></DT>
    <DD>Longer title</DD>
</DL>
  */

const MAX_DETECT_LINES = 150;

function detectImport() {
	var text = "";
	var line;
	var match;
	var re = /<DT>\s*<A[^>]*HREF="([^"]+)"[^>]*>([^<\n]+)/gi;
	var i = 0;
	while((line = Zotero.read()) !== false && (i++ < MAX_DETECT_LINES)) {
		text += line;
		match = re.exec(text);
		if (match) {
			Zotero.debug("Found a match with line: "+line);
			return true;
		}
	}
	return false;	
}

function doImport() {
	var line;
	var hits;
	var item = false;
	var itemIncomplete = false;
	var collection = false;
	var re = /([A-Za-z_]+)="([^"]+)"/g; 
	while((line = Zotero.read()) !== false) {
		if (line.indexOf("<DT>") !== -1 && line.indexOf("<A") !== -1) {
			if (itemIncomplete) item.complete();
			itemIncomplete = true;
			//Zotero.debug(line);
			item = new Zotero.Item("webpage");
			if (collection) collection.children.push(item);
			item.title = line.match(/>([^<]*)<\/A>/)[1];
			//Zotero.debug(item.title);
			while(hits = re.exec(line)) {
				if (!hits) {
					Zotero.debug("RE no match in "+line);
					continue;
				}
				switch (hits[1]) {
					case "HREF":	item.url = hits[2]; 
									break;
					case "TAGS": item.tags = hits[2].split(','); break;
					case "ICON": break;
					case "ICON_URI": break;
					case "ADD_DATE":
							item.accessDate = convertDate(hits[2]);
							break;
					default: item.extra = item.extra ? 	item.extra + "; "+ [hits[1], hits[2]].join("=") :
										[hits[1], hits[2]].join("=");
				}
			}
			if (item.url.match(/^place:/)) {
				item = false;
				itemIncomplete = false;
			}
		} else if (line.indexOf("<DT>") !== -1 && line.indexOf("<H3") !== -1) {
			if (collection) {
				collection.complete();
			}
			collection = new Zotero.Collection();
			collection.name = Zotero.Utilities.unescapeHTML(line.match(/<H3[^>]*>([^<]*)<\/H3>/i)[1]);
			Zotero.debug("Starting collection: "+ collection.name);
			collection.type = "collection";
			collection.children = new Array();
		} else if (line.substr(0,4) == "<DD>") {
			if (itemIncomplete) item.abstractNote = item.abstractNote ? item.abstractNote + " " + line.substr(4) : line.substr(4);
			else Zotero.debug("Discarding description line without item: " + line);
		} else {
			//Zotero.debug("Discarding line: " + line);
		}
	}
	if (item && itemIncomplete) item.complete();
	if (collection) collection.complete();
}

function convertDate(timestamp){
	var d = new Date(timestamp*1000);
 	function pad(n){return n<10 ? '0'+n : n};
 	return d.getUTCFullYear()+'-'
      + pad(d.getUTCMonth()+1)+'-'
      + pad(d.getUTCDate())+' '
      + pad(d.getUTCHours())+':'
      + pad(d.getUTCMinutes())+':'
      + pad(d.getUTCSeconds())+' UTC';
 }



function doExport() {
	var item;
	
	var header = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n'+
'<!-- This is an automatically generated file.\n'+
'     It will be read and overwritten.\n'+
'     DO NOT EDIT! -->\n'+
'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n'+
'<TITLE>Bookmarks</TITLE>\n'+
'<H1>Bookmarks Menu</H1>\n'+
'<DL>\n';
	var footer = '</DL>';
	//var tags = "";

	Zotero.write(header);
	while (item = Zotero.nextItem()) {
		// TODO Be more verbose, making an informative title and including more metadata
		//tags = item.tags.forEach(function (tag) {return tag.tag}).join(",");
		if (item.url) Zotero.write('    <DT><A HREF="'+item.url+'">'+item.title+'</A>\n');
		else Zotero.debug("Skipping item without URL: "+item.title);
	}
	Zotero.write(footer);
}


/** BEGIN TEST CASES **/
var testCases = []
/** END TEST CASES **/
