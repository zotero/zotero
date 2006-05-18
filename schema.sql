-- 8

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
        dateModified DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT,
        rights TEXT
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
    CREATE INDEX value ON itemData (value);
    
    DROP TABLE IF EXISTS keywords;
    CREATE TABLE keywords (
        keywordID INTEGER PRIMARY KEY,
        keyword TEXT
    );
    
    DROP TABLE IF EXISTS itemKeywords;
    CREATE TABLE itemKeywords (
        itemID INT,
        keywordID INT,
        PRIMARY KEY (itemID, keywordID),
        FOREIGN KEY (itemID) REFERENCES items(itemID),
        FOREIGN KEY (keywordID) REFERENCES keywords(keywordID)
    );
    
    DROP TABLE IF EXISTS creators;
    CREATE TABLE creators (
        creatorID INT,
        creatorTypeID INT DEFAULT 1,
        firstName TEXT,
        lastName TEXT,
        PRIMARY KEY (creatorID),
        FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)
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
        orderIndex INT DEFAULT 0,
        PRIMARY KEY (itemID, creatorID),
        FOREIGN KEY (itemID) REFERENCES items(itemID),
        FOREIGN KEY (creatorID) REFERENCES creators(creatorID)
    );
    
    DROP TABLE IF EXISTS folders;
    CREATE TABLE folders (
        folderID INT,
        folderName TEXT,
        PRIMARY KEY (folderID)
    );
    INSERT INTO folders VALUES (0, 'root');
    
    DROP TABLE IF EXISTS treeStructure;
    CREATE TABLE treeStructure (
        id INT,
        isFolder INT,
        orderIndex INT,
        parentFolderID INT DEFAULT 0,
        PRIMARY KEY (id, isFolder),
        FOREIGN KEY (parentFolderID) REFERENCES folders(folderID)
    );
    DROP INDEX IF EXISTS parentFolderID;
    CREATE INDEX parentFolderID ON treeStructure(parentFolderID);
    INSERT INTO treeStructure VALUES (0, 1, 0, NULL);
    
    -- Some sample data
    INSERT INTO itemTypes VALUES (1,'book');
    INSERT INTO itemTypes VALUES (2,'journalArticle');
    
    INSERT INTO "fieldFormats" VALUES(1, '.*', 0);
    INSERT INTO "fieldFormats" VALUES(2, '[0-9]*', 1);
    INSERT INTO "fieldFormats" VALUES(3, '[0-9]{4}', 1);
    
    INSERT INTO fields VALUES (1,'series',NULL);
    INSERT INTO fields VALUES (2,'volume',NULL);
    INSERT INTO fields VALUES (3,'number',NULL);
    INSERT INTO fields VALUES (4,'edition',NULL);
    INSERT INTO fields VALUES (5,'place',NULL);
    INSERT INTO fields VALUES (6,'publisher',NULL);
    INSERT INTO fields VALUES (7,'year',3);
    INSERT INTO fields VALUES (8,'pages',2);
    INSERT INTO fields VALUES (9,'ISBN',NULL);
    INSERT INTO fields VALUES (10,'publication',NULL);
    INSERT INTO fields VALUES (11,'ISSN',NULL);
    
    INSERT INTO itemTypeFields VALUES (1,1,1);
    INSERT INTO itemTypeFields VALUES (1,2,2);
    INSERT INTO itemTypeFields VALUES (1,3,3);
    INSERT INTO itemTypeFields VALUES (1,4,4);
    INSERT INTO itemTypeFields VALUES (1,5,5);
    INSERT INTO itemTypeFields VALUES (1,6,6);
    INSERT INTO itemTypeFields VALUES (1,7,7);
    INSERT INTO itemTypeFields VALUES (1,8,8);
    INSERT INTO itemTypeFields VALUES (1,9,9);
    INSERT INTO itemTypeFields VALUES (2,10,1);
    INSERT INTO itemTypeFields VALUES (2,2,2);
    INSERT INTO itemTypeFields VALUES (2,3,3);
    INSERT INTO itemTypeFields VALUES (2,8,4);
    
    INSERT INTO "items" VALUES(1, 1, 'Online connections: Internet interpersonal relationships', '2006-03-12 05:24:40', '2006-03-12 05:24:40', NULL, NULL);
    INSERT INTO "items" VALUES(2, 1, 'Computer-Mediated Communication: Human-to-Human Communication Across the Internet', '2006-03-12 05:25:50', '2006-03-12 05:25:50', NULL, NULL);
    INSERT INTO "items" VALUES(3, 2, 'Residential propinquity as a factor in marriage selection', '2006-03-12 05:26:37', '2006-03-12 05:26:37', NULL, NULL);
    INSERT INTO "items" VALUES(4, 1, 'Connecting: how we form social bonds and communities in the Internet age', '2006-03-12 05:27:15', '2006-03-12 05:27:15', NULL, NULL);
    INSERT INTO "items" VALUES(5, 1, 'Male, Female, Email: The Struggle for Relatedness in a Paranoid Society', '2006-03-12 05:27:36', '2006-03-12 05:27:36', NULL, NULL);
    INSERT INTO "items" VALUES(6, 2, 'Social Implications of Sociology', '2006-03-12 05:27:53', '2006-03-12 05:27:53', NULL, NULL);
    INSERT INTO "items" VALUES(7, 1, 'Social Pressures in Informal Groups: A Study of Human Factors in Housing', '2006-03-12 05:28:05', '2006-03-12 05:28:05', NULL, NULL);
    INSERT INTO "items" VALUES(8, 1, 'Cybersociety 2.0: Revisiting Computer-Mediated Community and Technology', '2006-03-12 05:28:37', '2006-03-12 05:28:37', NULL, NULL);
    INSERT INTO "items" VALUES(9, 2, 'The Computer as a Communication Device', '2006-03-12 05:29:03', '2006-03-12 05:29:03', NULL, NULL);
    INSERT INTO "items" VALUES(10, 2, 'What Does Research Say about the Nature of Computer-mediated Communication: Task-Oriented, Social-Emotion-Oriented, or Both?', '2006-03-12 05:29:12', '2006-03-12 05:29:12', NULL, NULL);
    INSERT INTO "items" VALUES(11, 1, 'The second self: computers and the human spirit', '2006-03-12 05:30:38', '2006-03-12 05:30:38', NULL, NULL);
    INSERT INTO "items" VALUES(12, 1, 'Life on the screen: identity in the age of the Internet', '2006-03-12 05:30:49', '2006-03-12 05:30:49', NULL, NULL);
    INSERT INTO "items" VALUES(13, 2, 'The computer conference: An altered state of communication', '2006-03-12 05:31:00', '2006-03-12 05:31:00', NULL, NULL);
    INSERT INTO "items" VALUES(14, 2, 'Computer Networks as Social Networks: Collaborative Work, Telework, and Community', '2006-03-12 05:31:17', '2006-03-12 05:31:17', NULL, NULL);
    INSERT INTO "items" VALUES(15, 1, 'The Internet in everyday life', '2006-03-12 05:31:41', '2006-03-12 05:31:41', NULL, NULL);
    
    INSERT INTO "itemData" VALUES(1, 7, 2001);
    INSERT INTO "itemData" VALUES(1, 5, 'Cresskill, N.J.');
    INSERT INTO "itemData" VALUES(1, 6, 'Hampton Press');
    INSERT INTO "itemData" VALUES(2, 7, 2002);
    INSERT INTO "itemData" VALUES(2, 6, 'Allyn & Bacon Publishers');
    INSERT INTO "itemData" VALUES(2, 8, 347);
    INSERT INTO "itemData" VALUES(2, 9, '0-205-32145-3');
    
    INSERT INTO "creators" VALUES(1, 1, 'Susan B.', 'Barnes');
    INSERT INTO "creators" VALUES(2, 1, 'J.S.', 'Bassard');
    INSERT INTO "creators" VALUES(3, 1, 'Mary', 'Chayko');
    INSERT INTO "creators" VALUES(4, 1, 'Michael', 'Civin');
    INSERT INTO "creators" VALUES(5, 1, 'Paul', 'DiMaggio');
    INSERT INTO "creators" VALUES(6, 1, 'Leon', 'Festinger');
    INSERT INTO "creators" VALUES(7, 1, 'Stanley', 'Schachter');
    INSERT INTO "creators" VALUES(8, 1, 'Kurt', 'Back');
    INSERT INTO "creators" VALUES(9, 1, 'Steven G.', 'Jones');
    INSERT INTO "creators" VALUES(10, 1, 'J.C.R.', 'Licklider');
    INSERT INTO "creators" VALUES(11, 1, 'Robert W.', 'Taylor');
    INSERT INTO "creators" VALUES(12, 1, 'Yuliang', 'Lui');
    INSERT INTO "creators" VALUES(13, 1, 'Sherry', 'Turkle');
    INSERT INTO "creators" VALUES(14, 1, 'J.', 'Vallee');
    INSERT INTO "creators" VALUES(15, 1, 'Barry', 'Wellman');
    
    INSERT INTO "itemCreators" VALUES(1, 1, 0);
    INSERT INTO "itemCreators" VALUES(2, 1, 0);
    INSERT INTO "itemCreators" VALUES(3, 2, 0);
    INSERT INTO "itemCreators" VALUES(4, 3, 0);
    INSERT INTO "itemCreators" VALUES(5, 4, 0);
    INSERT INTO "itemCreators" VALUES(6, 5, 0);
    INSERT INTO "itemCreators" VALUES(7, 6, 0);
    INSERT INTO "itemCreators" VALUES(8, 9, 0);
    INSERT INTO "itemCreators" VALUES(9, 10, 0);
    INSERT INTO "itemCreators" VALUES(10, 12, 0);
    INSERT INTO "itemCreators" VALUES(11, 13, 0);
    INSERT INTO "itemCreators" VALUES(12, 13, 0);
    INSERT INTO "itemCreators" VALUES(13, 14, 0);
    INSERT INTO "itemCreators" VALUES(14, 15, 0);
    INSERT INTO "itemCreators" VALUES(15, 15, 0);
    INSERT INTO "itemCreators" VALUES(7, 7, 1);
    INSERT INTO "itemCreators" VALUES(7, 8, 2);
    INSERT INTO "itemCreators" VALUES(9, 11, 1);
    
    INSERT INTO folders VALUES (1241, 'Test Folder');
    INSERT INTO folders VALUES (3262, 'Another Test Folder');
    INSERT INTO folders VALUES (6856, 'Yet Another Folder');
    INSERT INTO folders VALUES (7373, 'A Subfolder!');
    INSERT INTO folders VALUES (9233, 'A Sub-subfolder!');
    
    INSERT INTO treeStructure VALUES (1, 0, 1, 0);
    INSERT INTO treeStructure VALUES (3262, 1, 2, 0);
    INSERT INTO treeStructure VALUES (2, 0, 3, 0);
    INSERT INTO treeStructure VALUES (3, 0, 4, 0);
    INSERT INTO treeStructure VALUES (4, 0, 5, 0);
    INSERT INTO treeStructure VALUES (5, 0, 6, 0);
    INSERT INTO treeStructure VALUES (6, 0, 7, 0);
    INSERT INTO treeStructure VALUES (7, 0, 8, 0);
    INSERT INTO treeStructure VALUES (8, 0, 9, 0);
    INSERT INTO treeStructure VALUES (9, 0, 10, 0);
    INSERT INTO treeStructure VALUES (6856, 1, 11, 0);
    INSERT INTO treeStructure VALUES (14, 0, 12, 6856);
    INSERT INTO treeStructure VALUES (13, 0, 13, 6856);
    INSERT INTO treeStructure VALUES (7373, 1, 14, 6856);
    INSERT INTO treeStructure VALUES (15, 0, 15, 7373);
    INSERT INTO treeStructure VALUES (9233, 1, 16, 7373);
    INSERT INTO treeStructure VALUES (11, 0, 17, 0);
    INSERT INTO treeStructure VALUES (10, 0, 18, 0);
    INSERT INTO treeStructure VALUES (1241, 1, 19, 0);
    INSERT INTO treeStructure VALUES (12, 0, 20, 1241);
