{
        "translatorID": "d49e3a67-e2c1-4217-825c-2b22cffd332a",
        "label": "LiveJournal",
        "creator": "Avram Lyon",
        "target": "^https?://.*\\.livejournal\\.com/(?:$|[0-9]+\\.html)",
        "minVersion": "2.1",
        "maxVersion": "",
        "priority": 100,
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-06-15 17:19:24"
}

/* FW LINE 46:127318f30c1d */ function flatten(c){var b=new Array();for(var d in c){var e=c[d];if(e instanceof Array){b=b.concat(flatten(e))}else{b.push(e)}}return b}var FW={_scrapers:new Array()};FW._Base=function(){this.callHook=function(b,c,e,a){if(typeof this["hooks"]==="object"){var d=this["hooks"][b];if(typeof d==="function"){d(c,e,a)}}};this.evaluateThing=function(f,e,c){var b=typeof f;if(b==="string"){return f}else{if(b==="object"){if(f instanceof Array){var d=this.evaluateThing;var a=f.map(function(g){return d(g,e,c)});return flatten(a)}else{return f.evaluate(e,c)}}else{if(b==="function"){return f(e,c)}else{return undefined}}}}};FW.Scraper=function(a){FW._scrapers.push(new FW._Scraper(a))};FW._Scraper=function(a){for(x in a){this[x]=a[x]}this._singleFieldNames=["abstractNote","applicationNumber","archive","archiveLocation","artworkMedium","artworkSize","assignee","audioFileType","audioRecordingType","billNumber","blogTitle","bookTitle","callNumber","caseName","code","codeNumber","codePages","codeVolume","committee","company","conferenceName","country","court","date","dateDecided","dateEnacted","dictionaryTitle","distributor","docketNumber","documentNumber","DOI","edition","encyclopediaTitle","episodeNumber","extra","filingDate","firstPage","forumTitle","genre","history","institution","interviewMedium","ISBN","ISSN","issue","issueDate","issuingAuthority","journalAbbreviation","label","language","legalStatus","legislativeBody","letterType","libraryCatalog","manuscriptType","mapType","medium","meetingName","nameOfAct","network","number","numberOfVolumes","numPages","pages","patentNumber","place","postType","presentationType","priorityNumbers","proceedingsTitle","programTitle","programmingLanguage","publicLawNumber","publicationTitle","publisher","references","reportNumber","reportType","reporter","reporterVolume","rights","runningTime","scale","section","series","seriesNumber","seriesText","seriesTitle","session","shortTitle","studio","subject","system","thesisType","title","type","university","url","version","videoRecordingType","volume","websiteTitle","websiteType"];this._makeAttachments=function(q,b,f,s){if(f instanceof Array){f.forEach(function(k){this._makeAttachments(q,b,k,s)},this)}else{if(typeof f==="object"){var p=f.urls||f.url;var m=f.types||f.type;var e=f.titles||f.title;var h=this.evaluateThing(p,q,b);var o=this.evaluateThing(e,q,b);var r=this.evaluateThing(m,q,b);var l=(r instanceof Array);var n=(o instanceof Array);if(!(h instanceof Array)){h=[h]}for(var j in h){var c=h[j];var g;var d;if(l){g=r[j]}else{g=r}if(n){d=o[j]}else{d=o}s.attachments.push({url:c,title:d,type:g})}}}};this.makeItems=function(o,b,m,c,l){var q=new Zotero.Item(this.itemType);q.url=b;for(var h in this._singleFieldNames){var n=this._singleFieldNames[h];if(this[n]){var g=this.evaluateThing(this[n],o,b);if(g instanceof Array){q[n]=g[0]}else{q[n]=g}}}var r=["creators","tags"];for(var f in r){var p=r[f];var d=this.evaluateThing(this[p],o,b);if(d){for(var e in d){q[p].push(d[e])}}}this._makeAttachments(o,b,this["attachments"],q);c(q,this,o,b);l([q])}};FW._Scraper.prototype=new FW._Base;FW.MultiScraper=function(a){FW._scrapers.push(new FW._MultiScraper(a))};FW._MultiScraper=function(a){for(x in a){this[x]=a[x]}this._mkSelectItems=function(e,d){var b=new Object;for(var c in e){b[d[c]]=e[c]}return b};this._selectItems=function(d,c,e){var b=new Array();Zotero.selectItems(this._mkSelectItems(d,c),function(f){for(var g in f){b.push(g)}e(b)})};this._mkAttachments=function(g,d,f){var b=this.evaluateThing(this["attachments"],g,d);var c=new Object();if(b){for(var e in f){c[f[e]]=b[e]}}return c};this._makeChoices=function(f,p,c,d,h){if(f instanceof Array){f.forEach(function(k){this._makeTitlesUrls(k,p,c,d,h)},this)}else{if(typeof f==="object"){var m=f.urls||f.url;var e=f.titles||f.title;var n=this.evaluateThing(m,p,c);var j=this.evaluateThing(e,p,c);var l=(j instanceof Array);if(!(n instanceof Array)){n=[n]}for(var g in n){var b=n[g];var o;if(l){o=j[g]}else{o=j}h.push(b);d.push(o)}}}};this.makeItems=function(j,b,g,c,f){Zotero.debug("Entering MultiScraper.makeItems");if(this.beforeFilter){var k=this.beforeFilter(j,b);if(k!=b){this.makeItems(j,k,g,c,f);return}}var e=[];var h=[];this._makeChoices(this["choices"],j,b,e,h);var d=this._mkAttachments(j,b,h);this._selectItems(e,h,function(m){if(!m){f([])}else{var l=[];var n=this.itemTrans;Zotero.Utilities.processDocuments(m,function(q){var p=q.documentURI;var o=n;if(o===undefined){o=FW.getScraper(q,p)}if(o===undefined){}else{o.makeItems(q,p,d[p],function(r){l.push(r);c(r,o,q,p)},function(){})}},function(){f(l)})}})}};FW._MultiScraper.prototype=new FW._Base;FW.DelegateTranslator=function(a){return new FW._DelegateTranslator(a)};FW._DelegateTranslator=function(a){for(x in a){this[x]=a[x]}this._translator=Zotero.loadTranslator(this.translatorType);this._translator.setTranslator(this.translatorId);this.makeItems=function(g,d,b,f,c){Zotero.debug("Entering DelegateTranslator.makeItems");var e;Zotero.Utilities.HTTP.doGet(d,function(h){this._translator.setHandler("itemDone",function(k,j){e=j;if(b){j.attachments=b}});this._translator.setString(h);this._translator.translate();f(e)},function(){c([e])})}};FW.DelegateTranslator.prototype=new FW._Scraper;FW._StringMagic=function(){this._filters=new Array();this.addFilter=function(a){this._filters.push(a);return this};this.split=function(a){return this.addFilter(function(b){return b.split(a).filter(function(c){return(c!="")})})};this.replace=function(c,b,a){return this.addFilter(function(d){if(d.match(c)){return d.replace(c,b,a)}else{return d}})};this.prepend=function(a){return this.replace(/^/,a)};this.append=function(a){return this.replace(/$/,a)};this.remove=function(b,a){return this.replace(b,"",a)};this.trim=function(){return this.addFilter(function(a){return Zotero.Utilities.trim(a)})};this.trimInternal=function(){return this.addFilter(function(a){return Zotero.Utilities.trimInternal(a)})};this.match=function(a,b){if(!b){b=0}return this.addFilter(function(d){var c=d.match(a);if(c===undefined||c===null){return undefined}else{return c[b]}})};this.cleanAuthor=function(b,a){return this.addFilter(function(c){return Zotero.Utilities.cleanAuthor(c,b,a)})};this.key=function(a){return this.addFilter(function(b){return b[a]})};this.capitalizeTitle=function(){return this.addFilter(function(a){return Zotero.Utilities.capitalizeTitle(a)})};this.unescapeHTML=function(){return this.addFilter(function(a){return Zotero.Utilities.unescapeHTML(a)})};this.unescape=function(){return this.addFilter(function(a){return unescape(a)})};this._applyFilters=function(c,e){for(i in this._filters){c=flatten(c);c=c.filter(function(a){return((a!==undefined)&&(a!==null))});for(var d=0;d<c.length;d++){try{if((c[d]===undefined)||(c[d]===null)){continue}else{c[d]=this._filters[i](c[d],e)}}catch(b){c[d]=undefined;Zotero.debug("Caught exception "+b+"on filter: "+this._filters[i])}}c=c.filter(function(a){return((a!==undefined)&&(a!==null))})}return c}};FW.PageText=function(){return new FW._PageText()};FW._PageText=function(){this._filters=new Array();this.evaluate=function(c){var b=[c.documentElement.innerHTML];b=this._applyFilters(b,c);if(b.length==0){return false}else{return b}}};FW._PageText.prototype=new FW._StringMagic();FW.Url=function(){return new FW._Url()};FW._Url=function(){this._filters=new Array();this.evaluate=function(d,c){var b=[c];b=this._applyFilters(b,d);if(b.length==0){return false}else{return b}}};FW._Url.prototype=new FW._StringMagic();FW.Xpath=function(a){return new FW._Xpath(a)};FW._Xpath=function(a){this._xpath=a;this._filters=new Array();this.text=function(){var b=function(c){if(typeof c==="object"&&c.textContent){return c.textContent}else{return c}};this.addFilter(b);return this};this.sub=function(b){var c=function(f,e){var d=e.evaluate(b,f,null,XPathResult.ANY_TYPE,null);if(d){return d.iterateNext()}else{return undefined}};this.addFilter(c);return this};this.evaluate=function(e){var d=e.evaluate(this._xpath,e,null,XPathResult.ANY_TYPE,null);var c=new Array();var b;while(b=d.iterateNext()){c.push(b)}c=this._applyFilters(c,e);if(c.length==0){return false}else{return c}}};FW._Xpath.prototype=new FW._StringMagic();FW.detectWeb=function(e,b){for(var c in FW._scrapers){var d=FW._scrapers[c];var f=d.evaluateThing(d.itemType,e,b);if(!d.detect){return f}else{var a=d.evaluateThing(d.detect,e,b);if(a.length>0&&a[0]){return f}}}return undefined};FW.getScraper=function(b,a){var c=FW.detectWeb(b,a);return FW._scrapers.filter(function(d){return(d.evaluateThing(d.itemType,b,a)==c)&&(d.evaluateThing(d.detect,b,a))})[0]};FW.doWeb=function(c,a){Zotero.debug("Entering FW.doWeb");var b=FW.getScraper(c,a);b.makeItems(c,a,[],function(f,e,g,d){e.callHook("scraperDone",f,g,d);if(!f.title){f.title=""}f.complete()},function(){Zotero.done()});Zotero.wait();Zotero.debug("Leaving FW.doWeb")};



/**
    Copyright (c) 2011, Avram Lyon

    This program is free software: you can redistribute it and/or
    modify it under the terms of the GNU Affero General Public License
    as published by the Free Software Foundation, either version 3 of
    the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
    Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public
    License along with this program.  If not, see
    <http://www.gnu.org/licenses/>.
*/

/* There are at least three major page structures on LJ, represented
   by the scrapers and tests specified below. Additional structures
   may need additional logic. */

function detectWeb(doc, url) { return FW.detectWeb(doc, url); }
function doWeb(doc, url) { return FW.doWeb(doc, url); }

FW.MultiScraper({
itemType         : 'multiple',
detect           : FW.Url().match(/livejournal\.com\/?$/),
choices          : {
  titles :      FW.Xpath('//a[@class="subj-link"]').text(),
  urls   :      FW.Xpath('//a[@class="subj-link"]').key("href")
}
});

// http://kurgus.livejournal.com
FW.Scraper({
itemType         : "blogPost",
detect           : FW.Xpath('//dt[@class="entry-title"]/text()[1]'),
title            : FW.Xpath('//dt[@class="entry-title"]/text()[1]').text(),
date            : FW.Xpath('//dt[@class="entry-title"]/following-sibling::dd[1]/dl/dd[@class="entry-date"]/abbr')
                    .key("title").remove(/T.*$/),
attachments      : [{ url: FW.Url(),
  title:  "LiveJournal Snapshot",
  type: "text/html" }],
creators         : FW.Xpath('//dt[@class="entry-title"]/following-sibling::dd[1]/dl/dd[@class="username"]/span/a/b').text().cleanAuthor("author"),
blogTitle         : FW.Xpath('//h2/span').text(),
tags            : FW.Xpath('//div[@class="ljtags"]/a').text()
});

// http://ulr.livejournal.com
FW.Scraper({
itemType         : "blogPost",
detect           : FW.Xpath('//div[@class="asset-header-content-inner"]'),
title            : FW.Xpath('//div[@class="asset-header-content-inner"]/h2/a').text(),
date            : FW.Xpath('//div[@class="asset-header-content-inner"]/div[@class="asset-meta"]//abbr')
                    .text().remove(/at.*$/),
attachments      : [{ url: FW.Url(),
  title:  "LiveJournal Snapshot",
  type: "text/html" }],
creators         : FW.Xpath('//dd[@class="profile-username item"]/span[@class="ljuser ljuser-name_"]/a/b').text().cleanAuthor("author"),
blogTitle         : FW.Xpath('//div[@id="header-name"]/a').text()
});

// http://irek-murtazin.livejournal.com
FW.Scraper({
itemType         : "blogPost",
detect           : FW.Xpath('//table[@class="entrybox"]//table[1]//td[@class="caption"]'),
title            : FW.Xpath('//table[@class="entrybox"]//table[1]//td[@class="caption"]').text(),
date            : FW.Xpath('//table[@class="entrybox"]//table[1]//td[@class="index"]')
                    .text().replace(/\[(.*)\|.*\]/, '$1'),
attachments      : [{ url: FW.Url(),
  title:  "LiveJournal Snapshot",
  type: "text/html" }],
creators         : FW.Xpath('//form[@class="w-cs-search"]/input[@name="journal"]').key("value").cleanAuthor("author"),
blogTitle         : FW.Xpath('//table[@id="topbox"]//div[@align="center"]').text()
});

/** BEGIN TEST CASES **/
var testCases = [
    {
        "type": "web",
        "url": "http://kurgus.livejournal.com/",
        "items": []
    },
    {
        "type": "web",
        "url": "http://irek-murtazin.livejournal.com/487966.html",
        "items": [
            {
                "itemType": "blogPost",
                "creators": [
                    {
                        "firstName": "",
                        "lastName": "irek_murtazin",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://irek-murtazin.livejournal.com/487966.html",
                        "title": "LiveJournal Snapshot",
                        "type": "text/html"
                    }
                ],
                "url": "http://irek-murtazin.livejournal.com/487966.html",
                "blogTitle": "Ирек Муртазин",
                "date": "Jun. 12th, 2011",
                "title": "12 июня 1991 года",
                "libraryCatalog": "LiveJournal",
                "accessDate": "CURRENT_TIMESTAMP",
                "checkFields": "title"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://kurgus.livejournal.com/60523.html",
        "items": [
            {
                "itemType": "blogPost",
                "creators": [
                    {
                        "firstName": "",
                        "lastName": "kurgus",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "apple",
                    "safari",
                    "zotero",
                    "Библиотеки"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://kurgus.livejournal.com/60523.html",
                        "title": "LiveJournal Snapshot",
                        "type": "text/html"
                    }
                ],
                "url": "http://kurgus.livejournal.com/60523.html",
                "blogTitle": "kurgus",
                "date": "2011-06-14",
                "title": "Zotero, Mac, пожелания и разочарания",
                "libraryCatalog": "LiveJournal",
                "accessDate": "CURRENT_TIMESTAMP",
                "checkFields": "title"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://ulr.livejournal.com/164941.html",
        "items": [
            {
                "itemType": "blogPost",
                "creators": [
                    {
                        "firstName": "",
                        "lastName": "ulr",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://ulr.livejournal.com/164941.html",
                        "title": "LiveJournal Snapshot",
                        "type": "text/html"
                    }
                ],
                "url": "http://ulr.livejournal.com/164941.html",
                "blogTitle": "Лариса",
                "date": "May. 18th, 2011 ",
                "title": "Двойной праздник",
                "libraryCatalog": "LiveJournal",
                "accessDate": "CURRENT_TIMESTAMP",
                "checkFields": "title"
            }
        ]
    }
]
/** END TEST CASES **/
