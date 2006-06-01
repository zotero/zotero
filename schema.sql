-- 12

    DROP TABLE IF EXISTS version;
    CREATE TABLE version (
        version INTEGER PRIMARY KEY
    );
    
    DROP TABLE IF EXISTS items;
    CREATE TABLE items (
        itemID INTEGER PRIMARY KEY,
        itemTypeID INT,
        title TEXT,
        dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP,
        dateModified DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    DROP TABLE IF EXISTS itemTypes;
    CREATE TABLE itemTypes (
        itemTypeID INTEGER PRIMARY KEY,
        typeName TEXT
    );
    
    DROP TABLE IF EXISTS fieldFormats;
    CREATE TABLE fieldFormats (
        fieldFormatID INTEGER PRIMARY KEY,
        regex TEXT,
        isInteger INT
    );
    
    DROP TABLE IF EXISTS fields;
    CREATE TABLE fields (
        fieldID INTEGER PRIMARY KEY,
        fieldName TEXT,
        fieldFormatID INT,
        FOREIGN KEY (fieldFormatID) REFERENCES fieldFormat(fieldFormatID)
    );
    
    DROP TABLE IF EXISTS itemTypeFields;
    CREATE TABLE itemTypeFields (
        itemTypeID INT,
        fieldID INT,
        orderIndex INT,
        PRIMARY KEY (itemTypeID, fieldID),
        FOREIGN KEY (itemTypeID) REFERENCES itemTypes(itemTypeID),
        FOREIGN KEY (fieldID) REFERENCES itemTypes(itemTypeID)
    );
    
    DROP TABLE IF EXISTS itemData;
    CREATE TABLE itemData (
        itemID INT,
        fieldID INT,
        value NONE,
        PRIMARY KEY (itemID, fieldID),
        FOREIGN KEY (itemID) REFERENCES items(itemID),
        FOREIGN KEY (fieldID) REFERENCES fields(fieldID)
    );
    DROP INDEX IF EXISTS value;
    CREATE INDEX value ON itemData(value);
    
    DROP TABLE IF EXISTS keywords;
    CREATE TABLE keywords (
        keywordID INTEGER PRIMARY KEY,
        keyword TEXT
    );
    DROP INDEX IF EXISTS keyword;
    CREATE INDEX keyword ON keywords(keyword);
    
    DROP TABLE IF EXISTS itemKeywords;
    CREATE TABLE itemKeywords (
        itemID INT,
        keywordID INT,
        PRIMARY KEY (itemID, keywordID),
        FOREIGN KEY (itemID) REFERENCES items(itemID),
        FOREIGN KEY (keywordID) REFERENCES keywords(keywordID)
    );
    DROP INDEX IF EXISTS keywordID;
    CREATE INDEX keywordID ON itemKeywords(keywordID);
    
    DROP TABLE IF EXISTS creators;
    CREATE TABLE creators (
        creatorID INT,
        firstName TEXT,
        lastName TEXT,
        PRIMARY KEY (creatorID)
    );
    
    DROP TABLE IF EXISTS creatorTypes;
    CREATE TABLE creatorTypes (
        creatorTypeID INTEGER PRIMARY KEY,
        creatorType TEXT
    );
    
    DROP TABLE IF EXISTS itemCreators;
    CREATE TABLE itemCreators (
        itemID INT,
        creatorID INT,
        creatorTypeID INT DEFAULT 1,
        orderIndex INT DEFAULT 0,
        PRIMARY KEY (itemID, creatorID),
        FOREIGN KEY (itemID) REFERENCES items(itemID),
        FOREIGN KEY (creatorID) REFERENCES creators(creatorID)
        FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)
    );
    
    DROP TABLE IF EXISTS collections;
    CREATE TABLE collections (
        collectionID INT,
        collectionName TEXT,
        parentCollectionID INT,
        PRIMARY KEY (collectionID),
        FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID)
    );
    
    DROP TABLE IF EXISTS collectionItems;
    CREATE TABLE collectionItems (
        collectionID INT,
        itemID INT,
        orderIndex INT DEFAULT 0,
        PRIMARY KEY (collectionID, itemID),
        FOREIGN KEY (collectionID) REFERENCES collections(collectionID),
        FOREIGN KEY (itemID) REFERENCES items(itemID)
    );
    DROP INDEX IF EXISTS itemID;
    CREATE INDEX itemID ON collectionItems(itemID);
    
    CREATE TABLE scrapers (
        scraperID INTEGER PRIMARY KEY,
        centralScraperID INT,
        centralLastUpdated DATETIME,
        localLastUpdated DATETIME,
        label TEXT,
        creator TEXT,
        urlPattern TEXT,
        scraperDetectCode TEXT,
        scraperJavaScript TEXT
    );
    
    
    -- Some sample data
    INSERT INTO itemTypes VALUES (1,'book');
    INSERT INTO itemTypes VALUES (2,'journalArticle');
    
    INSERT INTO "fieldFormats" VALUES(1, '.*', 0);
    INSERT INTO "fieldFormats" VALUES(2, '[0-9]*', 1);
    INSERT INTO "fieldFormats" VALUES(3, '[0-9]{4}', 1);
    
    INSERT INTO fields VALUES (1,'source',NULL);
    INSERT INTO fields VALUES (2,'rights',NULL);
    INSERT INTO fields VALUES (3,'series',NULL);
    INSERT INTO fields VALUES (4,'volume',NULL);
    INSERT INTO fields VALUES (5,'number',NULL);
    INSERT INTO fields VALUES (6,'edition',NULL);
    INSERT INTO fields VALUES (7,'place',NULL);
    INSERT INTO fields VALUES (8,'publisher',NULL);
    INSERT INTO fields VALUES (9,'year',3);
    INSERT INTO fields VALUES (10,'pages',2);
    INSERT INTO fields VALUES (11,'ISBN',NULL);
    INSERT INTO fields VALUES (12,'publication',NULL);
    INSERT INTO fields VALUES (13,'ISSN',NULL);
    
    INSERT INTO itemTypeFields VALUES (1,1,1);
    INSERT INTO itemTypeFields VALUES (1,2,2);
    INSERT INTO itemTypeFields VALUES (1,3,3);
    INSERT INTO itemTypeFields VALUES (1,4,4);
    INSERT INTO itemTypeFields VALUES (1,5,5);
    INSERT INTO itemTypeFields VALUES (1,6,6);
    INSERT INTO itemTypeFields VALUES (1,7,7);
    INSERT INTO itemTypeFields VALUES (1,8,8);
    INSERT INTO itemTypeFields VALUES (1,9,9);
    INSERT INTO itemTypeFields VALUES (1,10,10);
    INSERT INTO itemTypeFields VALUES (1,11,11);
    INSERT INTO itemTypeFields VALUES (2,1,1);
    INSERT INTO itemTypeFields VALUES (2,2,2);
    INSERT INTO itemTypeFields VALUES (2,12,3);
    INSERT INTO itemTypeFields VALUES (2,4,4);
    INSERT INTO itemTypeFields VALUES (2,5,5);
    INSERT INTO itemTypeFields VALUES (2,10,6);
    
    INSERT INTO "items" VALUES(1, 1, 'Online connections: Internet interpersonal relationships', '2006-03-12 05:24:40', '2006-03-12 05:24:40');
    INSERT INTO "items" VALUES(2, 1, 'Computer-Mediated Communication: Human-to-Human Communication Across the Internet', '2006-03-12 05:25:50', '2006-03-12 05:25:50');
    INSERT INTO "items" VALUES(3, 2, 'Residential propinquity as a factor in marriage selection', '2006-03-12 05:26:37', '2006-03-12 05:26:37');
    INSERT INTO "items" VALUES(4, 1, 'Connecting: how we form social bonds and communities in the Internet age', '2006-03-12 05:27:15', '2006-03-12 05:27:15');
    INSERT INTO "items" VALUES(5, 1, 'Male, Female, Email: The Struggle for Relatedness in a Paranoid Society', '2006-03-12 05:27:36', '2006-03-12 05:27:36');
    INSERT INTO "items" VALUES(6, 2, 'Social Implications of Sociology', '2006-03-12 05:27:53', '2006-03-12 05:27:53');
    INSERT INTO "items" VALUES(7, 1, 'Social Pressures in Informal Groups: A Study of Human Factors in Housing', '2006-03-12 05:28:05', '2006-03-12 05:28:05');
    INSERT INTO "items" VALUES(8, 1, 'Cybersociety 2.0: Revisiting Computer-Mediated Community and Technology', '2006-03-12 05:28:37', '2006-03-12 05:28:37');
    INSERT INTO "items" VALUES(9, 2, 'The Computer as a Communication Device', '2006-03-12 05:29:03', '2006-03-12 05:29:03');
    INSERT INTO "items" VALUES(10, 2, 'What Does Research Say about the Nature of Computer-mediated Communication: Task-Oriented, Social-Emotion-Oriented, or Both?', '2006-03-12 05:29:12', '2006-03-12 05:29:12');
    INSERT INTO "items" VALUES(11, 1, 'The second self: computers and the human spirit', '2006-03-12 05:30:38', '2006-03-12 05:30:38');
    INSERT INTO "items" VALUES(12, 1, 'Life on the screen: identity in the age of the Internet', '2006-03-12 05:30:49', '2006-03-12 05:30:49');
    INSERT INTO "items" VALUES(13, 2, 'The computer conference: An altered state of communication', '2006-03-12 05:31:00', '2006-03-12 05:31:00');
    INSERT INTO "items" VALUES(14, 2, 'Computer Networks as Social Networks: Collaborative Work, Telework, and Community', '2006-03-12 05:31:17', '2006-03-12 05:31:17');
    INSERT INTO "items" VALUES(15, 1, 'The Internet in everyday life', '2006-03-12 05:31:41', '2006-03-12 05:31:41');
    
    INSERT INTO "itemData" VALUES(1, 9, 2001);
    INSERT INTO "itemData" VALUES(1, 7, 'Cresskill, N.J.');
    INSERT INTO "itemData" VALUES(1, 8, 'Hampton Press');
    INSERT INTO "itemData" VALUES(2, 9, 2002);
    INSERT INTO "itemData" VALUES(2, 8, 'Allyn & Bacon Publishers');
    INSERT INTO "itemData" VALUES(2, 10, 347);
    INSERT INTO "itemData" VALUES(2, 11, '0-205-32145-3');
    
    INSERT INTO "creatorTypes" VALUES(1, "author");
    INSERT INTO "creatorTypes" VALUES(2, "contributor");
    INSERT INTO "creatorTypes" VALUES(3, "editor");
    
    INSERT INTO "creators" VALUES(1, 'Susan B.', 'Barnes');
    INSERT INTO "creators" VALUES(2, 'J.S.', 'Bassard');
    INSERT INTO "creators" VALUES(3, 'Mary', 'Chayko');
    INSERT INTO "creators" VALUES(4, 'Michael', 'Civin');
    INSERT INTO "creators" VALUES(5, 'Paul', 'DiMaggio');
    INSERT INTO "creators" VALUES(6, 'Leon', 'Festinger');
    INSERT INTO "creators" VALUES(7, 'Stanley', 'Schachter');
    INSERT INTO "creators" VALUES(8, 'Kurt', 'Back');
    INSERT INTO "creators" VALUES(9, 'Steven G.', 'Jones');
    INSERT INTO "creators" VALUES(10, 'J.C.R.', 'Licklider');
    INSERT INTO "creators" VALUES(11, 'Robert W.', 'Taylor');
    INSERT INTO "creators" VALUES(12, 'Yuliang', 'Lui');
    INSERT INTO "creators" VALUES(13, 'Sherry', 'Turkle');
    INSERT INTO "creators" VALUES(14, 'J.', 'Vallee');
    INSERT INTO "creators" VALUES(15, 'Barry', 'Wellman');
    
    INSERT INTO "itemCreators" VALUES(1, 1, 1, 0);
    INSERT INTO "itemCreators" VALUES(2, 1, 1, 0);
    INSERT INTO "itemCreators" VALUES(3, 2, 1, 0);
    INSERT INTO "itemCreators" VALUES(4, 3, 1, 0);
    INSERT INTO "itemCreators" VALUES(5, 4, 1, 0);
    INSERT INTO "itemCreators" VALUES(6, 5, 1, 0);
    INSERT INTO "itemCreators" VALUES(7, 6, 1, 0);
    INSERT INTO "itemCreators" VALUES(8, 9, 1, 0);
    INSERT INTO "itemCreators" VALUES(9, 10, 1, 0);
    INSERT INTO "itemCreators" VALUES(10, 12, 1, 0);
    INSERT INTO "itemCreators" VALUES(11, 13, 1, 0);
    INSERT INTO "itemCreators" VALUES(12, 13, 1, 0);
    INSERT INTO "itemCreators" VALUES(13, 14, 1, 0);
    INSERT INTO "itemCreators" VALUES(14, 15, 1, 0);
    INSERT INTO "itemCreators" VALUES(15, 15, 1, 0);
    INSERT INTO "itemCreators" VALUES(7, 7, 1, 1);
    INSERT INTO "itemCreators" VALUES(7, 8, 1, 2);
    INSERT INTO "itemCreators" VALUES(9, 11, 1, 1);
    
    INSERT INTO collections VALUES (1241, 'Test Project', NULL);
    INSERT INTO collections VALUES (3262, 'Another Test Project', NULL);
    INSERT INTO collections VALUES (6856, 'Yet Another Project', NULL);
    INSERT INTO collections VALUES (7373, 'A Sub-project!', 6856);
    INSERT INTO collections VALUES (9233, 'A Sub-sub-project!', 7373);
    
    INSERT INTO collectionItems VALUES (6856, 14, 0);
    INSERT INTO collectionItems VALUES (6856, 13, 1);
    INSERT INTO collectionItems VALUES (7373, 15, 0);
    INSERT INTO collectionItems VALUES (1241, 12, 0);
    
    INSERT INTO "scrapers" VALUES(1, NULL, NULL, NULL, 'Amazon.com Scraper', 'Simon Kornblith', '^http://www.amazon.com/gp/product/', NULL, 'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
if (prefix == ''x'') return namespace; else return null;
} : null;

var getNode = function(doc, contextNode, xpath, nsResolver) {
return doc.evaluate(xpath, contextNode, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
}

var cleanString = function(s) {
s = utilities.trimString(s);
return s.replace(/ +/g, " ");
}

var uri = doc.location.href;

model.addStatement(uri, prefixRDF + "type", prefixDCMI + "text", false);

// Retrieve authors
var xpath = ''/html/body/table/tbody/tr/td[2]/form/div[@class="buying"]/a'';
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
for (var i = 0; i < elmts.length; i++) {
var elmt = elmts[i];

model.addStatement(uri, prefixDC + ''creator'', cleanString(getNode(doc, elmt, ''./text()[1]'', nsResolver).nodeValue), false); // Use your own type here
}

// Retrieve data from "Product Details" box
var xpath = ''/html/body/table/tbody/tr/td[2]/table/tbody/tr/td[@class="bucket"]/div[@class="content"]/ul/li'';
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
for (var i = 0; i < elmts.length; i++) {
var elmt = elmts[i];
var attribute = cleanString(getNode(doc, elmt, ''./B[1]/text()[1]'', nsResolver).nodeValue);
if(getNode(doc, elmt, ''./text()[1]'', nsResolver)) {
var value = cleanString(getNode(doc, elmt, ''./text()[1]'', nsResolver).nodeValue);

if(attribute == "Publisher:") {
if(value.lastIndexOf("(") != -1) {
var date = value.substring(value.lastIndexOf("(")+1, value.length-1);
value = value.substring(0, value.lastIndexOf("(")-1);
}
if(value.lastIndexOf(";") != -1) {
var edition = value.substring(value.lastIndexOf(";")+2, value.length);
value = value.substring(0, value.lastIndexOf(";"));
}
model.addStatement(uri, prefixDC + ''publisher'', value);
model.addStatement(uri, prefixDC + ''date'', date);
model.addStatement(uri, prefixDC + ''hasVersion'', edition);
} else if(attribute == "Language:") {
model.addStatement(uri, prefixDC + ''language'', value);
} else if(attribute == "ISBN:") {
model.addStatement(uri, prefixDC + ''identifier'', ''ISBN ''+value);
} else if(value.substring(value.indexOf(" ")+1, value.length) == "pages") {
model.addStatement(uri, prefixDummy + ''pages'', value.substring(0, value.indexOf(" ")));
model.addStatement(uri, prefixDC + ''medium'', attribute.substring(0, attribute.indexOf(":")));
}
}
}

var xpath = ''/html/body/table/tbody/tr/td[2]/form/div[@class="buying"]/b[@class="sans"]'';
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
var title = cleanString(getNode(doc, elmts[0], ''./text()[1]'', nsResolver).nodeValue);
if(title.lastIndexOf("(") != -1 && title.lastIndexOf(")") == title.length-1) {
title = title.substring(0, title.lastIndexOf("(")-1);
}
model.addStatement(uri, prefixDC + ''title'', title);');
