-- 27

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
        itemID INT,
        sourceItemID INT,
        note TEXT,
        PRIMARY KEY (itemID),
        FOREIGN KEY (sourceItemID) REFERENCES items(itemID)
    );
    DROP INDEX IF EXISTS itemNotes_sourceItemID;
    CREATE INDEX itemNotes_sourceItemID ON itemNotes(sourceItemID);
    
    DROP TABLE IF EXISTS tags;
    CREATE TABLE tags (
        tagID INT,
        tag TEXT UNIQUE,
        PRIMARY KEY (tagID)
    );
    
    DROP TABLE IF EXISTS itemTags;
    CREATE TABLE itemTags (
        itemID INT,
        tagID INT,
        PRIMARY KEY (itemID, tagID),
        FOREIGN KEY (itemID) REFERENCES items(itemID),
        FOREIGN KEY (tagID) REFERENCES tags(tagID)
    );
    DROP INDEX IF EXISTS itemTags_tagID;
    CREATE INDEX itemTags_tagID ON itemTags(tagID);
    
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
    
    DROP TABLE IF EXISTS translators;
    CREATE TABLE translators (
        translatorID TEXT PRIMARY KEY,
        lastUpdated DATETIME,
        type TEXT,
        label TEXT,
        creator TEXT,
        target TEXT,
        detectCode TEXT,
        code TEXT
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
    
    
    INSERT INTO itemTypes VALUES (1,'note');
    INSERT INTO itemTypes VALUES (2,'book');
    INSERT INTO itemTypes VALUES (3,'bookSection');
    INSERT INTO itemTypes VALUES (4,'journalArticle');
    INSERT INTO itemTypes VALUES (5,'magazineArticle');
    INSERT INTO itemTypes VALUES (6,'newspaperArticle');
    INSERT INTO itemTypes VALUES (7,'thesis');
    INSERT INTO itemTypes VALUES (8,'letter');
    INSERT INTO itemTypes VALUES (9,'manuscript');
    INSERT INTO itemTypes VALUES (10,'interview');
    INSERT INTO itemTypes VALUES (11,'film');
    INSERT INTO itemTypes VALUES (12,'artwork');
    INSERT INTO itemTypes VALUES (13,'website');
    
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
    INSERT INTO fields VALUES (14,'date',NULL);
    INSERT INTO fields VALUES (15,'section',NULL);
    INSERT INTO fields VALUES (16,'thesisType',NULL);
    INSERT INTO fields VALUES (17,'accessionNumber',NULL);
    INSERT INTO fields VALUES (18,'callNumber',NULL);
    INSERT INTO fields VALUES (19,'archiveLocation',NULL);
    INSERT INTO fields VALUES (20,'medium',NULL);
    INSERT INTO fields VALUES (21,'distributor',NULL);
    INSERT INTO fields VALUES (22,'extra',NULL);
    INSERT INTO fields VALUES (23,'url',NULL);
    INSERT INTO fields VALUES (24,'type',NULL);
    
    INSERT INTO "itemTypeFields" VALUES(2, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(2, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(2, 3, 3);
    INSERT INTO "itemTypeFields" VALUES(2, 4, 4);
    INSERT INTO "itemTypeFields" VALUES(2, 5, 5);
    INSERT INTO "itemTypeFields" VALUES(2, 6, 6);
    INSERT INTO "itemTypeFields" VALUES(2, 7, 7);
    INSERT INTO "itemTypeFields" VALUES(2, 8, 8);
    INSERT INTO "itemTypeFields" VALUES(2, 9, 9);
    INSERT INTO "itemTypeFields" VALUES(2, 10, 10);
    INSERT INTO "itemTypeFields" VALUES(2, 11, 11);
    INSERT INTO "itemTypeFields" VALUES(4, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(4, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(4, 12, 3);
    INSERT INTO "itemTypeFields" VALUES(4, 4, 4);
    INSERT INTO "itemTypeFields" VALUES(4, 5, 5);
    INSERT INTO "itemTypeFields" VALUES(4, 10, 6);
    INSERT INTO "itemTypeFields" VALUES(4, 13, 7);
    INSERT INTO "itemTypeFields" VALUES(3, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(3, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(3, 12, 3);
    INSERT INTO "itemTypeFields" VALUES(3, 3, 4);
    INSERT INTO "itemTypeFields" VALUES(3, 4, 5);
    INSERT INTO "itemTypeFields" VALUES(3, 5, 6);
    INSERT INTO "itemTypeFields" VALUES(3, 6, 7);
    INSERT INTO "itemTypeFields" VALUES(3, 7, 8);
    INSERT INTO "itemTypeFields" VALUES(3, 8, 9);
    INSERT INTO "itemTypeFields" VALUES(3, 9, 10);
    INSERT INTO "itemTypeFields" VALUES(3, 10, 11);
    INSERT INTO "itemTypeFields" VALUES(3, 11, 12);
    INSERT INTO "itemTypeFields" VALUES(5, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(5, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(5, 12, 3);
    INSERT INTO "itemTypeFields" VALUES(5, 14, 4);
    INSERT INTO "itemTypeFields" VALUES(5, 10, 5);
    INSERT INTO "itemTypeFields" VALUES(5, 13, 6);
    INSERT INTO "itemTypeFields" VALUES(6, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(6, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(6, 12, 3);
    INSERT INTO "itemTypeFields" VALUES(6, 6, 4);
    INSERT INTO "itemTypeFields" VALUES(6, 14, 5);
    INSERT INTO "itemTypeFields" VALUES(6, 15, 6);
    INSERT INTO "itemTypeFields" VALUES(6, 10, 7);
    INSERT INTO "itemTypeFields" VALUES(6, 13, 8);
    INSERT INTO "itemTypeFields" VALUES(7, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(7, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(7, 8, 3);
    INSERT INTO "itemTypeFields" VALUES(7, 16, 4);
    INSERT INTO "itemTypeFields" VALUES(7, 9, 5);
    INSERT INTO "itemTypeFields" VALUES(7, 10, 6);
    INSERT INTO "itemTypeFields" VALUES(7, 17, 8);
    INSERT INTO "itemTypeFields" VALUES(8, 2, 1);
    INSERT INTO "itemTypeFields" VALUES(8, 24, 2);
    INSERT INTO "itemTypeFields" VALUES(8, 14, 3);
    INSERT INTO "itemTypeFields" VALUES(8, 19, 4);
    INSERT INTO "itemTypeFields" VALUES(9, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(9, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(9, 24, 3);
    INSERT INTO "itemTypeFields" VALUES(9, 7, 4);
    INSERT INTO "itemTypeFields" VALUES(9, 14, 5);
    INSERT INTO "itemTypeFields" VALUES(9, 19, 6);
    INSERT INTO "itemTypeFields" VALUES(10, 2, 1);
    INSERT INTO "itemTypeFields" VALUES(10, 14, 2);
    INSERT INTO "itemTypeFields" VALUES(10, 20, 3);
    INSERT INTO "itemTypeFields" VALUES(10, 19, 4);
    INSERT INTO "itemTypeFields" VALUES(11, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(11, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(11, 21, 3);
    INSERT INTO "itemTypeFields" VALUES(11, 9, 4);
    INSERT INTO "itemTypeFields" VALUES(12, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(12, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(12, 24, 3);
    INSERT INTO "itemTypeFields" VALUES(12, 14, 4);
    INSERT INTO "itemTypeFields" VALUES(13, 1, 1);
    INSERT INTO "itemTypeFields" VALUES(13, 2, 2);
    INSERT INTO "itemTypeFields" VALUES(13, 14, 3);
    INSERT INTO "itemTypeFields" VALUES(13, 23, 4);
    INSERT INTO "itemTypeFields" VALUES(12, 18, 5);
    INSERT INTO "itemTypeFields" VALUES(2, 18, 12);
    INSERT INTO "itemTypeFields" VALUES(3, 18, 13);
    INSERT INTO "itemTypeFields" VALUES(11, 18, 5);
    INSERT INTO "itemTypeFields" VALUES(12, 17, 6);
    INSERT INTO "itemTypeFields" VALUES(12, 22, 7);
    INSERT INTO "itemTypeFields" VALUES(2, 17, 13);
    INSERT INTO "itemTypeFields" VALUES(2, 22, 14);
    INSERT INTO "itemTypeFields" VALUES(3, 17, 14);
    INSERT INTO "itemTypeFields" VALUES(3, 22, 15);
    INSERT INTO "itemTypeFields" VALUES(11, 17, 6);
    INSERT INTO "itemTypeFields" VALUES(11, 22, 7);
    INSERT INTO "itemTypeFields" VALUES(10, 17, 6);
    INSERT INTO "itemTypeFields" VALUES(10, 18, 5);
    INSERT INTO "itemTypeFields" VALUES(10, 22, 7);
    INSERT INTO "itemTypeFields" VALUES(4, 17, 9);
    INSERT INTO "itemTypeFields" VALUES(4, 18, 8);
    INSERT INTO "itemTypeFields" VALUES(4, 22, 10);
    INSERT INTO "itemTypeFields" VALUES(8, 17, 6);
    INSERT INTO "itemTypeFields" VALUES(8, 18, 5);
    INSERT INTO "itemTypeFields" VALUES(8, 22, 7);
    INSERT INTO "itemTypeFields" VALUES(5, 17, 8);
    INSERT INTO "itemTypeFields" VALUES(5, 18, 7);
    INSERT INTO "itemTypeFields" VALUES(5, 22, 9);
    INSERT INTO "itemTypeFields" VALUES(9, 17, 8);
    INSERT INTO "itemTypeFields" VALUES(9, 18, 7);
    INSERT INTO "itemTypeFields" VALUES(9, 22, 9);
    INSERT INTO "itemTypeFields" VALUES(6, 17, 10);
    INSERT INTO "itemTypeFields" VALUES(6, 18, 9);
    INSERT INTO "itemTypeFields" VALUES(6, 22, 11);
    INSERT INTO "itemTypeFields" VALUES(7, 18, 7);
    INSERT INTO "itemTypeFields" VALUES(7, 22, 9);
    INSERT INTO "itemTypeFields" VALUES(13, 22, 5);
    
    -- Some sample data
    INSERT INTO "items" VALUES(1, 2, 'Online connections: Internet interpersonal relationships', '2006-03-12 05:24:40', '2006-03-12 05:24:40');
    INSERT INTO "items" VALUES(2, 2, 'Computer-Mediated Communication: Human-to-Human Communication Across the Internet', '2006-03-12 05:25:50', '2006-03-12 05:25:50');
    INSERT INTO "items" VALUES(3, 4, 'Residential propinquity as a factor in marriage selection', '2006-03-12 05:26:37', '2006-03-12 05:26:37');
    INSERT INTO "items" VALUES(4, 2, 'Connecting: how we form social bonds and communities in the Internet age', '2006-03-12 05:27:15', '2006-03-12 05:27:15');
    INSERT INTO "items" VALUES(5, 2, 'Male, Female, Email: The Struggle for Relatedness in a Paranoid Society', '2006-03-12 05:27:36', '2006-06-26 16:26:53');
    INSERT INTO "items" VALUES(6, 4, 'Social Implications of Sociology', '2006-03-12 05:27:53', '2006-03-12 05:27:53');
    INSERT INTO "items" VALUES(7, 2, 'Social Pressures in Informal Groups: A Study of Human Factors in Housing', '2006-03-12 05:28:05', '2006-03-12 05:28:05');
    INSERT INTO "items" VALUES(8, 2, 'Cybersociety 2.0: Revisiting Computer-Mediated Community and Technology', '2006-03-12 05:28:37', '2006-03-12 05:28:37');
    INSERT INTO "items" VALUES(9, 4, 'The Computer as a Communication Device', '2006-03-12 05:29:03', '2006-03-12 05:29:03');
    INSERT INTO "items" VALUES(10, 4, 'What Does Research Say about the Nature of Computer-mediated Communication: Task-Oriented, Social-Emotion-Oriented, or Both?', '2006-03-12 05:29:12', '2006-03-12 05:29:12');
    INSERT INTO "items" VALUES(11, 2, 'The second self: computers and the human spirit', '2006-03-12 05:30:38', '2006-03-12 05:30:38');
    INSERT INTO "items" VALUES(12, 2, 'Life on the screen: identity in the age of the Internet', '2006-03-12 05:30:49', '2006-03-12 05:30:49');
    INSERT INTO "items" VALUES(13, 4, 'The computer conference: An altered state of communication', '2006-03-12 05:31:00', '2006-03-12 05:31:00');
    INSERT INTO "items" VALUES(14, 4, 'Computer Networks as Social Networks: Collaborative Work, Telework, and Community', '2006-03-12 05:31:17', '2006-03-12 05:31:17');
    INSERT INTO "items" VALUES(15, 2, 'The Internet in everyday life', '2006-03-12 05:31:41', '2006-03-12 05:31:41');
    
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
