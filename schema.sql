-- 22

    DROP TABLE IF EXISTS version;
    CREATE TABLE version (
        schema TEXT PRIMARY KEY,
        version INT NOT NULL
    );
    DROP INDEX IF EXISTS schema;
    CREATE INDEX schema ON version(schema);
    
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
    
    DROP TABLE IF EXISTS itemNotes;
    CREATE TABLE itemNotes (
        noteID INT,
        itemID INT,
        note TEXT,
        dateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
        dateModified DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (noteID),
        FOREIGN KEY (itemID) REFERENCES items(itemID)
    );
    DROP INDEX IF EXISTS itemNotes_itemID;
    CREATE INDEX itemNotes_itemID ON itemNotes(itemID);
    
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
        PRIMARY KEY (itemID, creatorID, creatorTypeID),
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
    
    DROP TABLE IF EXISTS scrapers;
    CREATE TABLE scrapers (
        scraperID TEXT PRIMARY KEY,
        lastUpdated DATETIME,
        label TEXT,
        creator TEXT,
        urlPattern TEXT,
        scraperDetectCode TEXT,
        scraperJavaScript TEXT
    );
    
    
    DROP TABLE IF EXISTS transactionSets;
    CREATE TABLE transactionSets (
        transactionSetID INTEGER PRIMARY KEY,
        event TEXT,
        id INT
    );
    
    DROP TABLE IF EXISTS transactions;
    CREATE TABLE transactions (
        transactionID INTEGER PRIMARY KEY,
        transactionSetID INT,
        context TEXT,
        action TEXT
    );
    DROP INDEX IF EXISTS transactions_transactionSetID;
    CREATE INDEX transactions_transactionSetID ON transactions(transactionSetID);
    
    DROP TABLE IF EXISTS transactionLog;
    CREATE TABLE transactionLog (
        transactionID INT,
        field TEXT,
        value NONE,
        PRIMARY KEY (transactionID, field, value),
        FOREIGN KEY (transactionID) REFERENCES transactions(transactionID)
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
    INSERT INTO itemTypeFields VALUES (2,13,7);
    
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
