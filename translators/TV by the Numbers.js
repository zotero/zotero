{
    "translatorID":"180a62bf-efdd-4d38-8d85-8971af04dd85",
    "label":"TV by the Numbers",
    "creator":"odie5533",
    "target":"^http://tvbythenumbers\\.com",
    "minVersion":"1.0",
    "maxVersion":"",
    "priority":100,
    "inRepository":"0",
    "translatorType":4,
    "lastUpdated":"2010-08-04 03:31:19"
}

/*
    TV by the Numbers - translator for Zotero
    Copyright (C) 2010 odie5533

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

/*
    This translator supports saving a snapshot of a single post and saving
    the citation of many posts at once without visiting each post. Thus, it does
    not save a snapshot when multiple citations are to be saved.
*/


PUB_TITLE = "TV by the Numbers";
XPATH_TITLE = "//title";
XPATH_PAGES = null;
XPATH_DATE = "substring-after(substring-before(string(//p[@class='posted_on']),' by '), 'on ')";
RE_DATE = /(.*)/;
XPATH_AUTHORS = "substring-after(string(//p[@class='posted_on']),' by ')";
RE_AUTHORS = /(.*)/;

function detectWeb(doc, url) {
    /* site has lots of garbage, check we're on the right doc */
    if (!xpath_string(doc, doc, XPATH_TITLE))
        return;
    var posts = doc.evaluate("count(//div[@class='post-alt blog'])", doc, null,
        XPathResult.NUMBER_TYPE, null).numberValue;
    if (posts  == 1)
        return "webpage";
    else if (posts > 1)
        return "multiple";
}

function xpath_string(doc, node, xpath) {
    var res = doc.evaluate(xpath, node, null, XPathResult.STRING_TYPE, null);
    if (!res || !res.stringValue)
        return null;
    return Zotero.Utilities.trim(res.stringValue);
}

function xpre(doc, node, xpath, reg) {
    var xpmatch = xpath_string(doc, node, xpath);
    return reg.exec(xpmatch)[1];
}

function scrape(doc, url) {
    var items = new Array();
    var posts = doc.evaluate("//div[@class='post-alt blog']", doc, null,
        XPathResult.ANY_TYPE, null);
        
    var post_count = 0;

    while (post = posts.iterateNext()) {
        var newItem = new Zotero.Item("webpage");
        newItem.publicationTitle = PUB_TITLE;
        
        var link = post.getElementsByTagName("a")[0];
        newItem.url = link.href;
        
        var title = Zotero.Utilities.unescapeHTML(
            Zotero.Utilities.cleanTags(link.textContent));
        title = title.replace(/(\s+)(?:‘|’)|(?:‘|’)(\s+)/g, "$1''$2").replace(/‘|’/g, "'");
        newItem.title = title;
        
        if (XPATH_DATE)
            newItem.date = xpre(doc, post, XPATH_DATE, RE_DATE);
        if (XPATH_PAGES)
            newItem.pages = xpath_string(doc, post, XPATH_PAGES);
        
        //authors
        var author_text = xpre(doc, post, XPATH_AUTHORS, RE_AUTHORS);
        var authors = [];
        if (author_text) {
            if (author_text.indexOf(" and ") != -1)
                authors = author_text.split(" and ");
            else if (author_text.indexOf(";") != -1)
                authors = author_text.split(";");
            else
                authors.push(author_text);
        }
        for each(var a in authors)
            if (a != 'null')
                newItem.creators.push(
                    Zotero.Utilities.cleanAuthor(a, "author"));

        // attach html
        if (url == newItem.url)
            newItem.attachments.push({title:PUB_TITLE+" Snapshot",
                mimeType:"text/html", url:doc.location.href, snapshot:true});
        
        newItem.toString = function() { return this.title; };
        items[newItem.url] = newItem;
        post_count++;
    }
    
    /* a stupidly complex way of calling selectItems, and then completing
       the items which were selected */
    if (post_count > 1) {
        var sel_items = new Object();
        for each(var i in items)
            sel_items[i.url] = i.title;
        sel_items = Zotero.selectItems(sel_items);
        
        for (var i in sel_items)
            items[i].complete();
    } else if (post_count == 1)
        for each(var i in items)
            i.complete();
}

function doWeb(doc, url) {
    scrape(doc, url);
}
