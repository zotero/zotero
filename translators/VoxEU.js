{
        "translatorID": "508e8fb9-8a33-4095-844f-133cba7e7b54",
        "label": "VoxEU",
        "creator": "Sebastian Karcher",
        "target": "^https?://www\\.voxeu\\.org",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-05-24 01:09:58"
}

/*Examples:
Individual item
http://www.voxeu.org/index.php?q=node/6258
Search results
http://www.voxeu.org/index.php?q=search/node/eichengreen */

function detectWeb(doc, url) { return FW.detectWeb(doc, url); }
function doWeb(doc, url) { return FW.doWeb(doc, url); }
 
/** Articles */
FW.Scraper({
itemType : 'blogPost',
detect : FW.Xpath('//div[@class="terms"]'),
title : FW.Xpath('//div[@id="main"]/div[@id="squeeze"]/h1').text().trim(),
attachments : {
  url : FW.Url(),
  title : "voxEU snapshot",
  type : "text/html"
},
creators : FW.Xpath('//table[@class="layouttable"]/tbody/*/td/p/a ').text().cleanAuthor("author"),
abstractNote : FW.Xpath('//table[@class="layouttable"]/tbody/tr/td/div/em').text(),
date : FW.Xpath('//table[@class="layouttable"]/tbody/*/td/p/text()[last()] ').text(),
publicationTitle : "VoxEU.org",
tags : FW.Xpath('//div[@class="terms"]//li').text()
});
 
/** Search results */
FW.MultiScraper({
itemType : "multiple",
detect : FW.Xpath('//div[@class="content"]/dl[contains(@class, "search-results")]'),
choices : {
  titles : FW.Xpath('//div[@class="content"]/dl/dt[@class="title"]/a').text(),
  urls : FW.Xpath('//div[@class="content"]/dl/dt[@class="title"]/a').key('href').text()
}
});