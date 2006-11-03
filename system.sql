-- 7

-- This file creates system tables that can be safely wiped and reinitialized
-- at any time, as long as existing ids are preserved.


    -- Valid item types ("book," "journalArticle," etc.)
    DROP TABLE IF EXISTS itemTypes;
    CREATE TABLE itemTypes (
        itemTypeID INTEGER PRIMARY KEY,
        typeName TEXT,
        templateItemTypeID INT,
        display INT DEFAULT 1 -- 0 == hide, 1 == display, 2 == primary
    );
    
    -- Describes various types of fields and their format restrictions,
    -- and indicates whether data should be stored as strings or integers
    --
    -- unused
    DROP TABLE IF EXISTS fieldFormats;
    CREATE TABLE fieldFormats (
        fieldFormatID INTEGER PRIMARY KEY,
        regex TEXT,
        isInteger INT
    );
    
    -- Field types for item metadata
    DROP TABLE IF EXISTS fields;
    CREATE TABLE fields (
        fieldID INTEGER PRIMARY KEY,
        fieldName TEXT,
        fieldFormatID INT,
        FOREIGN KEY (fieldFormatID) REFERENCES fieldFormat(fieldFormatID)
    );
    
    -- Defines valid fields for each itemType, their display order, and their default visibility
    DROP TABLE IF EXISTS itemTypeFields;
    CREATE TABLE itemTypeFields (
        itemTypeID INT,
        fieldID INT,
        hide INT,
        orderIndex INT,
        PRIMARY KEY (itemTypeID, fieldID),
        FOREIGN KEY (itemTypeID) REFERENCES itemTypes(itemTypeID),
        FOREIGN KEY (fieldID) REFERENCES fields(fieldID)
    );
    
    DROP TABLE IF EXISTS charsets;
    CREATE TABLE charsets (
        charsetID INTEGER PRIMARY KEY,
        charset TEXT UNIQUE
    );
    DROP INDEX IF EXISTS charsets_charset;
    CREATE INDEX charsets_charset ON charsets(charset);
    
    DROP TABLE IF EXISTS fileTypes;
    CREATE TABLE fileTypes (
        fileTypeID INTEGER PRIMARY KEY,
        fileType TEXT UNIQUE
    );
    DROP INDEX IF EXISTS fileTypes_fileType;
    CREATE INDEX fileTypes_fileType ON fileTypes(fileType);
    
    DROP TABLE IF EXISTS fileTypeMimeTypes;
    CREATE TABLE fileTypeMimeTypes (
        fileTypeID INT,
        mimeType TEXT,
        PRIMARY KEY (fileTypeID, mimeType),
        FOREIGN KEY (fileTypeID) REFERENCES fileTypes(fileTypeID)
    );
    DROP INDEX IF EXISTS fileTypeMimeTypes_mimeType;
    CREATE INDEX fileTypeMimeTypes_mimeType ON fileTypeMimeTypes(mimeType);
    
    -- Defines the possible creator types (contributor, editor, author)
    DROP TABLE IF EXISTS creatorTypes;
    CREATE TABLE creatorTypes (
        creatorTypeID INTEGER PRIMARY KEY,
        creatorType TEXT
    );
    
DROP TABLE IF EXISTS itemTypeCreatorTypes;
CREATE TABLE itemTypeCreatorTypes (
    itemTypeID INT,
    creatorTypeID INT,
    primaryField INT,
    PRIMARY KEY (itemTypeID, creatorTypeID),
    FOREIGN KEY (itemTypeID) REFERENCES itemTypes(itemTypeID),
    FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)
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
    
    
    -- unused
    INSERT INTO "fieldFormats" VALUES(1, '.*', 0);
    INSERT INTO "fieldFormats" VALUES(2, '[0-9]*', 1);
    INSERT INTO "fieldFormats" VALUES(3, '[0-9]{4}', 1);

INSERT INTO itemTypes VALUES (1,'note',NULL,0);
INSERT INTO itemTypes VALUES (2,'book',NULL,2);
INSERT INTO itemTypes VALUES (3,'bookSection',2,2);
INSERT INTO itemTypes VALUES (4,'journalArticle',NULL,2);
INSERT INTO itemTypes VALUES (5,'magazineArticle',NULL,2);
INSERT INTO itemTypes VALUES (6,'newspaperArticle',NULL,2);
INSERT INTO itemTypes VALUES (7,'thesis',NULL,1);
INSERT INTO itemTypes VALUES (8,'letter',NULL,1);
INSERT INTO itemTypes VALUES (9,'manuscript',NULL,1);
INSERT INTO itemTypes VALUES (10,'interview',NULL,1);
INSERT INTO itemTypes VALUES (11,'film',NULL,1);
INSERT INTO itemTypes VALUES (12,'artwork',NULL,1);
INSERT INTO itemTypes VALUES (13,'webpage',NULL,0);
INSERT INTO itemTypes VALUES (14,'attachment',NULL,0);
INSERT INTO itemTypes VALUES (15,'report',NULL,1);
INSERT INTO itemTypes VALUES (16,'bill',NULL,1);
INSERT INTO itemTypes VALUES (17,'case',NULL,1);
INSERT INTO itemTypes VALUES (18,'hearing',NULL,1);
INSERT INTO itemTypes VALUES (19,'patent',NULL,1);
INSERT INTO itemTypes VALUES (20,'statute',NULL,1);
INSERT INTO itemTypes VALUES (21,'email',NULL,1);
INSERT INTO itemTypes VALUES (22,'map',NULL,1);
INSERT INTO itemTypes VALUES (23,'blogPost',NULL,1);
INSERT INTO itemTypes VALUES (24,'instantMessage',NULL,1);
INSERT INTO itemTypes VALUES (25,'forumPost',NULL,1);
INSERT INTO itemTypes VALUES (26,'audioRecording',NULL,1);
INSERT INTO itemTypes VALUES (27,'presentation',NULL,1);
INSERT INTO itemTypes VALUES (28,'videoRecording',NULL,1);
INSERT INTO itemTypes VALUES (29,'tvBroadcast',NULL,1);
INSERT INTO itemTypes VALUES (30,'radioBroadcast',NULL,1);
INSERT INTO itemTypes VALUES (31,'podcast',NULL,1);
INSERT INTO itemTypes VALUES (32,'computerProgram',NULL,1);

INSERT INTO fields VALUES (1,'url',NULL);
INSERT INTO fields VALUES (2,'rights',NULL);
INSERT INTO fields VALUES (3,'series',NULL);
INSERT INTO fields VALUES (4,'volume',NULL);
INSERT INTO fields VALUES (5,'issue',NULL);
INSERT INTO fields VALUES (6,'edition',NULL);
INSERT INTO fields VALUES (7,'place',NULL);
INSERT INTO fields VALUES (8,'publisher',NULL);
INSERT INTO fields VALUES (10,'pages',NULL);
INSERT INTO fields VALUES (11,'ISBN',NULL);
INSERT INTO fields VALUES (12,'publicationTitle',NULL);
INSERT INTO fields VALUES (13,'ISSN',NULL);
INSERT INTO fields VALUES (14,'date',NULL);
INSERT INTO fields VALUES (15,'section',NULL);
INSERT INTO fields VALUES (18,'callNumber',NULL);
INSERT INTO fields VALUES (19,'archiveLocation',NULL);
INSERT INTO fields VALUES (21,'distributor',NULL);
INSERT INTO fields VALUES (22,'extra',NULL);
INSERT INTO fields VALUES (25,'journalAbbreviation',NULL);
INSERT INTO fields VALUES (26,'DOI',NULL);
INSERT INTO fields VALUES (27,'accessDate',NULL);
INSERT INTO fields VALUES (28,'seriesTitle',NULL);
INSERT INTO fields VALUES (29,'seriesText',NULL);
INSERT INTO fields VALUES (30,'seriesNumber',NULL);
INSERT INTO fields VALUES (31,'institution',NULL);
INSERT INTO fields VALUES (32,'reportType',NULL);
INSERT INTO fields VALUES (36,'code',NULL);
INSERT INTO fields VALUES (40,'session',NULL);
INSERT INTO fields VALUES (41,'legislativeBody',NULL);
INSERT INTO fields VALUES (42,'history',NULL);
INSERT INTO fields VALUES (43,'reporter',NULL);
INSERT INTO fields VALUES (44,'court',NULL);
INSERT INTO fields VALUES (45,'numberOfVolumes',NULL);
INSERT INTO fields VALUES (46,'committee',NULL);
INSERT INTO fields VALUES (48,'assignee',NULL);
INSERT INTO fields VALUES (50,'patentNumber',NULL);
INSERT INTO fields VALUES (51,'priorityNumbers',NULL);
INSERT INTO fields VALUES (52,'issueDate',NULL);
INSERT INTO fields VALUES (53,'references',NULL);
INSERT INTO fields VALUES (54,'legalStatus',NULL);
INSERT INTO fields VALUES (55,'codeNumber',NULL);
INSERT INTO fields VALUES (59,'artworkMedium',NULL);
INSERT INTO fields VALUES (60,'number',NULL);
INSERT INTO fields VALUES (61,'artworkSize',NULL);
INSERT INTO fields VALUES (62,'repository',NULL);
INSERT INTO fields VALUES (63,'videoRecordingType',NULL);
INSERT INTO fields VALUES (64,'interviewMedium',NULL);
INSERT INTO fields VALUES (65,'letterType',NULL);
INSERT INTO fields VALUES (66,'manuscriptType',NULL);
INSERT INTO fields VALUES (67,'mapType',NULL);
INSERT INTO fields VALUES (68,'scale',NULL);
INSERT INTO fields VALUES (69,'thesisType',NULL);
INSERT INTO fields VALUES (70,'websiteType',NULL);
INSERT INTO fields VALUES (71,'audioRecordingType',NULL);
INSERT INTO fields VALUES (72,'label',NULL);
INSERT INTO fields VALUES (74,'presentationType',NULL);
INSERT INTO fields VALUES (75,'meetingName',NULL);
INSERT INTO fields VALUES (76,'studio',NULL);
INSERT INTO fields VALUES (77,'runningTime',NULL);
INSERT INTO fields VALUES (78,'network',NULL);
INSERT INTO fields VALUES (79,'postType',NULL);
INSERT INTO fields VALUES (80,'audioFileType',NULL);
INSERT INTO fields VALUES (81,'version',NULL);
INSERT INTO fields VALUES (82,'system',NULL);
INSERT INTO fields VALUES (83,'company',NULL);

INSERT INTO itemTypeFields VALUES (2, 3, NULL, 1);
INSERT INTO itemTypeFields VALUES (2, 30, NULL, 2);
INSERT INTO itemTypeFields VALUES (2, 4, NULL, 3);
INSERT INTO itemTypeFields VALUES (2, 45, NULL, 4);
INSERT INTO itemTypeFields VALUES (2, 6, NULL, 5);
INSERT INTO itemTypeFields VALUES (2, 7, NULL, 6);
INSERT INTO itemTypeFields VALUES (2, 8, NULL, 7);
INSERT INTO itemTypeFields VALUES (2, 14, NULL, 8);
INSERT INTO itemTypeFields VALUES (2, 10, NULL, 9);
INSERT INTO itemTypeFields VALUES (2, 11, NULL, 10);
INSERT INTO itemTypeFields VALUES (2, 18, NULL, 11);
INSERT INTO itemTypeFields VALUES (2, 19, NULL, 12);
INSERT INTO itemTypeFields VALUES (2, 62, NULL, 13);
INSERT INTO itemTypeFields VALUES (2, 2, NULL, 14);
INSERT INTO itemTypeFields VALUES (2, 1, NULL, 15);
INSERT INTO itemTypeFields VALUES (2, 27, NULL, 16);
INSERT INTO itemTypeFields VALUES (2, 22, NULL, 17);
INSERT INTO itemTypeFields VALUES (3, 12, NULL, 1);
INSERT INTO itemTypeFields VALUES (3, 3, NULL, 2);
INSERT INTO itemTypeFields VALUES (3, 30, NULL, 3);
INSERT INTO itemTypeFields VALUES (3, 4, NULL, 4);
INSERT INTO itemTypeFields VALUES (3, 45, NULL, 5);
INSERT INTO itemTypeFields VALUES (3, 6, NULL, 6);
INSERT INTO itemTypeFields VALUES (3, 7, NULL, 7);
INSERT INTO itemTypeFields VALUES (3, 8, NULL, 8);
INSERT INTO itemTypeFields VALUES (3, 14, NULL, 9);
INSERT INTO itemTypeFields VALUES (3, 10, NULL, 10);
INSERT INTO itemTypeFields VALUES (3, 11, NULL, 11);
INSERT INTO itemTypeFields VALUES (3, 18, NULL, 12);
INSERT INTO itemTypeFields VALUES (3, 19, NULL, 13);
INSERT INTO itemTypeFields VALUES (3, 62, NULL, 14);
INSERT INTO itemTypeFields VALUES (3, 2, NULL, 15);
INSERT INTO itemTypeFields VALUES (3, 1, NULL, 16);
INSERT INTO itemTypeFields VALUES (3, 27, NULL, 17);
INSERT INTO itemTypeFields VALUES (3, 22, NULL, 18);
INSERT INTO itemTypeFields VALUES (4, 12, NULL, 1);
INSERT INTO itemTypeFields VALUES (4, 4, NULL, 2);
INSERT INTO itemTypeFields VALUES (4, 5, NULL, 3);
INSERT INTO itemTypeFields VALUES (4, 10, NULL, 4);
INSERT INTO itemTypeFields VALUES (4, 14, NULL, 5);
INSERT INTO itemTypeFields VALUES (4, 3, NULL, 6);
INSERT INTO itemTypeFields VALUES (4, 28, NULL, 7);
INSERT INTO itemTypeFields VALUES (4, 29, NULL, 8);
INSERT INTO itemTypeFields VALUES (4, 25, NULL, 9);
INSERT INTO itemTypeFields VALUES (4, 26, NULL, 10);
INSERT INTO itemTypeFields VALUES (4, 13, NULL, 11);
INSERT INTO itemTypeFields VALUES (4, 18, NULL, 12);
INSERT INTO itemTypeFields VALUES (4, 19, NULL, 13);
INSERT INTO itemTypeFields VALUES (4, 62, NULL, 14);
INSERT INTO itemTypeFields VALUES (4, 2, NULL, 15);
INSERT INTO itemTypeFields VALUES (4, 1, NULL, 16);
INSERT INTO itemTypeFields VALUES (4, 27, NULL, 17);
INSERT INTO itemTypeFields VALUES (4, 22, NULL, 18);
INSERT INTO itemTypeFields VALUES (5, 12, NULL, 1);
INSERT INTO itemTypeFields VALUES (5, 4, NULL, 2);
INSERT INTO itemTypeFields VALUES (5, 5, NULL, 3);
INSERT INTO itemTypeFields VALUES (5, 14, NULL, 4);
INSERT INTO itemTypeFields VALUES (5, 10, NULL, 5);
INSERT INTO itemTypeFields VALUES (5, 13, NULL, 6);
INSERT INTO itemTypeFields VALUES (5, 18, NULL, 7);
INSERT INTO itemTypeFields VALUES (5, 19, NULL, 8);
INSERT INTO itemTypeFields VALUES (5, 62, NULL, 9);
INSERT INTO itemTypeFields VALUES (5, 2, NULL, 10);
INSERT INTO itemTypeFields VALUES (5, 1, NULL, 11);
INSERT INTO itemTypeFields VALUES (5, 27, NULL, 12);
INSERT INTO itemTypeFields VALUES (5, 22, NULL, 13);
INSERT INTO itemTypeFields VALUES (6, 12, NULL, 1);
INSERT INTO itemTypeFields VALUES (6, 6, NULL, 2);
INSERT INTO itemTypeFields VALUES (6, 14, NULL, 3);
INSERT INTO itemTypeFields VALUES (6, 15, NULL, 4);
INSERT INTO itemTypeFields VALUES (6, 10, NULL, 5);
INSERT INTO itemTypeFields VALUES (6, 13, NULL, 6);
INSERT INTO itemTypeFields VALUES (6, 18, NULL, 7);
INSERT INTO itemTypeFields VALUES (6, 19, NULL, 8);
INSERT INTO itemTypeFields VALUES (6, 62, NULL, 9);
INSERT INTO itemTypeFields VALUES (6, 2, NULL, 10);
INSERT INTO itemTypeFields VALUES (6, 1, NULL, 11);
INSERT INTO itemTypeFields VALUES (6, 27, NULL, 12);
INSERT INTO itemTypeFields VALUES (6, 22, NULL, 13);
INSERT INTO itemTypeFields VALUES (7, 69, NULL, 1);
INSERT INTO itemTypeFields VALUES (7, 8, NULL, 2);
INSERT INTO itemTypeFields VALUES (7, 14, NULL, 3);
INSERT INTO itemTypeFields VALUES (7, 10, NULL, 4);
INSERT INTO itemTypeFields VALUES (7, 18, NULL, 5);
INSERT INTO itemTypeFields VALUES (7, 19, NULL, 6);
INSERT INTO itemTypeFields VALUES (7, 62, NULL, 7);
INSERT INTO itemTypeFields VALUES (7, 2, NULL, 8);
INSERT INTO itemTypeFields VALUES (7, 1, NULL, 9);
INSERT INTO itemTypeFields VALUES (7, 27, NULL, 10);
INSERT INTO itemTypeFields VALUES (7, 22, NULL, 11);
INSERT INTO itemTypeFields VALUES (8, 65, NULL, 1);
INSERT INTO itemTypeFields VALUES (8, 14, NULL, 2);
INSERT INTO itemTypeFields VALUES (8, 18, NULL, 3);
INSERT INTO itemTypeFields VALUES (8, 19, NULL, 4);
INSERT INTO itemTypeFields VALUES (8, 62, NULL, 5);
INSERT INTO itemTypeFields VALUES (8, 2, NULL, 6);
INSERT INTO itemTypeFields VALUES (8, 1, NULL, 7);
INSERT INTO itemTypeFields VALUES (8, 27, NULL, 8);
INSERT INTO itemTypeFields VALUES (8, 22, NULL, 9);
INSERT INTO itemTypeFields VALUES (9, 66, NULL, 1);
INSERT INTO itemTypeFields VALUES (9, 7, NULL, 2);
INSERT INTO itemTypeFields VALUES (9, 14, NULL, 3);
INSERT INTO itemTypeFields VALUES (9, 10, NULL, 4);
INSERT INTO itemTypeFields VALUES (9, 18, NULL, 5);
INSERT INTO itemTypeFields VALUES (9, 19, NULL, 6);
INSERT INTO itemTypeFields VALUES (9, 62, NULL, 7);
INSERT INTO itemTypeFields VALUES (9, 2, NULL, 8);
INSERT INTO itemTypeFields VALUES (9, 1, NULL, 9);
INSERT INTO itemTypeFields VALUES (9, 27, NULL, 10);
INSERT INTO itemTypeFields VALUES (9, 22, NULL, 11);
INSERT INTO itemTypeFields VALUES (10, 14, NULL, 1);
INSERT INTO itemTypeFields VALUES (10, 64, NULL, 2);
INSERT INTO itemTypeFields VALUES (10, 18, NULL, 3);
INSERT INTO itemTypeFields VALUES (10, 19, NULL, 4);
INSERT INTO itemTypeFields VALUES (10, 62, NULL, 5);
INSERT INTO itemTypeFields VALUES (10, 2, NULL, 6);
INSERT INTO itemTypeFields VALUES (10, 1, NULL, 7);
INSERT INTO itemTypeFields VALUES (10, 27, NULL, 8);
INSERT INTO itemTypeFields VALUES (10, 22, NULL, 9);
INSERT INTO itemTypeFields VALUES (11, 21, NULL, 1);
INSERT INTO itemTypeFields VALUES (11, 63, NULL, 2);
INSERT INTO itemTypeFields VALUES (11, 14, NULL, 3);
INSERT INTO itemTypeFields VALUES (11, 77, NULL, 4);
INSERT INTO itemTypeFields VALUES (11, 18, NULL, 5);
INSERT INTO itemTypeFields VALUES (11, 19, NULL, 6);
INSERT INTO itemTypeFields VALUES (11, 62, NULL, 7);
INSERT INTO itemTypeFields VALUES (11, 2, NULL, 8);
INSERT INTO itemTypeFields VALUES (11, 1, NULL, 9);
INSERT INTO itemTypeFields VALUES (11, 27, NULL, 10);
INSERT INTO itemTypeFields VALUES (11, 22, NULL, 11);
INSERT INTO itemTypeFields VALUES (12, 59, NULL, 1);
INSERT INTO itemTypeFields VALUES (12, 61, NULL, 2);
INSERT INTO itemTypeFields VALUES (12, 14, NULL, 3);
INSERT INTO itemTypeFields VALUES (12, 18, NULL, 4);
INSERT INTO itemTypeFields VALUES (12, 19, NULL, 5);
INSERT INTO itemTypeFields VALUES (12, 62, NULL, 6);
INSERT INTO itemTypeFields VALUES (12, 2, NULL, 7);
INSERT INTO itemTypeFields VALUES (12, 1, NULL, 8);
INSERT INTO itemTypeFields VALUES (12, 27, NULL, 9);
INSERT INTO itemTypeFields VALUES (12, 22, NULL, 10);
INSERT INTO itemTypeFields VALUES (13, 12, NULL, 1);
INSERT INTO itemTypeFields VALUES (13, 70, NULL, 2);
INSERT INTO itemTypeFields VALUES (13, 14, NULL, 3);
INSERT INTO itemTypeFields VALUES (13, 1, NULL, 4);
INSERT INTO itemTypeFields VALUES (13, 27, NULL, 5);
INSERT INTO itemTypeFields VALUES (13, 2, NULL, 6);
INSERT INTO itemTypeFields VALUES (13, 22, NULL, 7);
INSERT INTO itemTypeFields VALUES (14, 27, NULL, 1);
INSERT INTO itemTypeFields VALUES (14, 1, NULL, 2);
INSERT INTO itemTypeFields VALUES (15, 60, NULL, 1);
INSERT INTO itemTypeFields VALUES (15, 32, NULL, 2);
INSERT INTO itemTypeFields VALUES (15, 28, NULL, 3);
INSERT INTO itemTypeFields VALUES (15, 7, NULL, 4);
INSERT INTO itemTypeFields VALUES (15, 31, NULL, 5);
INSERT INTO itemTypeFields VALUES (15, 14, NULL, 6);
INSERT INTO itemTypeFields VALUES (15, 10, NULL, 7);
INSERT INTO itemTypeFields VALUES (15, 18, NULL, 8);
INSERT INTO itemTypeFields VALUES (15, 19, NULL, 9);
INSERT INTO itemTypeFields VALUES (15, 62, NULL, 10);
INSERT INTO itemTypeFields VALUES (15, 2, NULL, 11);
INSERT INTO itemTypeFields VALUES (15, 1, NULL, 12);
INSERT INTO itemTypeFields VALUES (15, 27, NULL, 13);
INSERT INTO itemTypeFields VALUES (15, 22, NULL, 14);
INSERT INTO itemTypeFields VALUES (16, 60, NULL, 1);
INSERT INTO itemTypeFields VALUES (16, 36, NULL, 2);
INSERT INTO itemTypeFields VALUES (16, 4, NULL, 3);
INSERT INTO itemTypeFields VALUES (16, 15, NULL, 4);
INSERT INTO itemTypeFields VALUES (16, 10, NULL, 5);
INSERT INTO itemTypeFields VALUES (16, 41, NULL, 6);
INSERT INTO itemTypeFields VALUES (16, 40, NULL, 7);
INSERT INTO itemTypeFields VALUES (16, 42, NULL, 8);
INSERT INTO itemTypeFields VALUES (16, 14, NULL, 9);
INSERT INTO itemTypeFields VALUES (16, 2, NULL, 10);
INSERT INTO itemTypeFields VALUES (16, 1, NULL, 11);
INSERT INTO itemTypeFields VALUES (16, 27, NULL, 12);
INSERT INTO itemTypeFields VALUES (16, 22, NULL, 13);
INSERT INTO itemTypeFields VALUES (17, 43, NULL, 1);
INSERT INTO itemTypeFields VALUES (17, 4, NULL, 2);
INSERT INTO itemTypeFields VALUES (17, 44, NULL, 3);
INSERT INTO itemTypeFields VALUES (17, 10, NULL, 4);
INSERT INTO itemTypeFields VALUES (17, 42, NULL, 5);
INSERT INTO itemTypeFields VALUES (17, 14, NULL, 6);
INSERT INTO itemTypeFields VALUES (17, 2, NULL, 7);
INSERT INTO itemTypeFields VALUES (17, 1, NULL, 8);
INSERT INTO itemTypeFields VALUES (17, 27, NULL, 9);
INSERT INTO itemTypeFields VALUES (17, 22, NULL, 10);
INSERT INTO itemTypeFields VALUES (18, 46, NULL, 1);
INSERT INTO itemTypeFields VALUES (18, 7, NULL, 2);
INSERT INTO itemTypeFields VALUES (18, 8, NULL, 3);
INSERT INTO itemTypeFields VALUES (18, 45, NULL, 4);
INSERT INTO itemTypeFields VALUES (18, 60, NULL, 5);
INSERT INTO itemTypeFields VALUES (18, 10, NULL, 6);
INSERT INTO itemTypeFields VALUES (18, 41, NULL, 7);
INSERT INTO itemTypeFields VALUES (18, 40, NULL, 8);
INSERT INTO itemTypeFields VALUES (18, 42, NULL, 9);
INSERT INTO itemTypeFields VALUES (18, 14, NULL, 10);
INSERT INTO itemTypeFields VALUES (18, 2, NULL, 11);
INSERT INTO itemTypeFields VALUES (18, 1, NULL, 12);
INSERT INTO itemTypeFields VALUES (18, 27, NULL, 13);
INSERT INTO itemTypeFields VALUES (18, 22, NULL, 14);
INSERT INTO itemTypeFields VALUES (19, 7, NULL, 1);
INSERT INTO itemTypeFields VALUES (19, 48, NULL, 2);
INSERT INTO itemTypeFields VALUES (19, 60, NULL, 3);
INSERT INTO itemTypeFields VALUES (19, 14, NULL, 4);
INSERT INTO itemTypeFields VALUES (19, 10, NULL, 5);
INSERT INTO itemTypeFields VALUES (19, 50, NULL, 6);
INSERT INTO itemTypeFields VALUES (19, 51, NULL, 7);
INSERT INTO itemTypeFields VALUES (19, 52, NULL, 8);
INSERT INTO itemTypeFields VALUES (19, 53, NULL, 9);
INSERT INTO itemTypeFields VALUES (19, 54, NULL, 10);
INSERT INTO itemTypeFields VALUES (19, 2, NULL, 11);
INSERT INTO itemTypeFields VALUES (19, 1, NULL, 12);
INSERT INTO itemTypeFields VALUES (19, 27, NULL, 13);
INSERT INTO itemTypeFields VALUES (19, 22, NULL, 14);
INSERT INTO itemTypeFields VALUES (20, 36, NULL, 1);
INSERT INTO itemTypeFields VALUES (20, 55, NULL, 2);
INSERT INTO itemTypeFields VALUES (20, 60, NULL, 3);
INSERT INTO itemTypeFields VALUES (20, 14, NULL, 4);
INSERT INTO itemTypeFields VALUES (20, 10, NULL, 5);
INSERT INTO itemTypeFields VALUES (20, 15, NULL, 6);
INSERT INTO itemTypeFields VALUES (20, 40, NULL, 7);
INSERT INTO itemTypeFields VALUES (20, 42, NULL, 8);
INSERT INTO itemTypeFields VALUES (20, 2, NULL, 9);
INSERT INTO itemTypeFields VALUES (20, 1, NULL, 10);
INSERT INTO itemTypeFields VALUES (20, 27, NULL, 11);
INSERT INTO itemTypeFields VALUES (20, 22, NULL, 12);
INSERT INTO itemTypeFields VALUES (21, 14, NULL, 1);
INSERT INTO itemTypeFields VALUES (21, 2, NULL, 2);
INSERT INTO itemTypeFields VALUES (21, 1, NULL, 3);
INSERT INTO itemTypeFields VALUES (21, 27, NULL, 4);
INSERT INTO itemTypeFields VALUES (21, 22, NULL, 5);
INSERT INTO itemTypeFields VALUES (22, 67, NULL, 1);
INSERT INTO itemTypeFields VALUES (22, 68, NULL, 2);
INSERT INTO itemTypeFields VALUES (22, 28, NULL, 3);
INSERT INTO itemTypeFields VALUES (22, 6, NULL, 4);
INSERT INTO itemTypeFields VALUES (22, 7, NULL, 5);
INSERT INTO itemTypeFields VALUES (22, 8, NULL, 6);
INSERT INTO itemTypeFields VALUES (22, 14, NULL, 7);
INSERT INTO itemTypeFields VALUES (22, 11, NULL, 8);
INSERT INTO itemTypeFields VALUES (22, 18, NULL, 9);
INSERT INTO itemTypeFields VALUES (22, 19, NULL, 10);
INSERT INTO itemTypeFields VALUES (22, 62, NULL, 11);
INSERT INTO itemTypeFields VALUES (22, 2, NULL, 12);
INSERT INTO itemTypeFields VALUES (22, 1, NULL, 13);
INSERT INTO itemTypeFields VALUES (22, 27, NULL, 14);
INSERT INTO itemTypeFields VALUES (22, 22, NULL, 15);
INSERT INTO itemTypeFields VALUES (23, 12, NULL, 1);
INSERT INTO itemTypeFields VALUES (23, 70, NULL, 2);
INSERT INTO itemTypeFields VALUES (23, 14, NULL, 3);
INSERT INTO itemTypeFields VALUES (23, 1, NULL, 4);
INSERT INTO itemTypeFields VALUES (23, 27, NULL, 5);
INSERT INTO itemTypeFields VALUES (23, 2, NULL, 6);
INSERT INTO itemTypeFields VALUES (23, 22, NULL, 7);
INSERT INTO itemTypeFields VALUES (24, 14, NULL, 1);
INSERT INTO itemTypeFields VALUES (24, 2, NULL, 2);
INSERT INTO itemTypeFields VALUES (24, 1, NULL, 3);
INSERT INTO itemTypeFields VALUES (24, 27, NULL, 4);
INSERT INTO itemTypeFields VALUES (24, 22, NULL, 5);
INSERT INTO itemTypeFields VALUES (25, 12, NULL, 1);
INSERT INTO itemTypeFields VALUES (25, 79, NULL, 2);
INSERT INTO itemTypeFields VALUES (25, 14, NULL, 3);
INSERT INTO itemTypeFields VALUES (25, 2, NULL, 4);
INSERT INTO itemTypeFields VALUES (25, 1, NULL, 5);
INSERT INTO itemTypeFields VALUES (25, 27, NULL, 6);
INSERT INTO itemTypeFields VALUES (25, 22, NULL, 7);
INSERT INTO itemTypeFields VALUES (26, 71, NULL, 1);
INSERT INTO itemTypeFields VALUES (26, 28, NULL, 2);
INSERT INTO itemTypeFields VALUES (26, 4, NULL, 3);
INSERT INTO itemTypeFields VALUES (26, 45, NULL, 4);
INSERT INTO itemTypeFields VALUES (26, 7, NULL, 5);
INSERT INTO itemTypeFields VALUES (26, 72, NULL, 6);
INSERT INTO itemTypeFields VALUES (26, 14, NULL, 7);
INSERT INTO itemTypeFields VALUES (26, 77, NULL, 8);
INSERT INTO itemTypeFields VALUES (26, 11, NULL, 9);
INSERT INTO itemTypeFields VALUES (26, 18, NULL, 10);
INSERT INTO itemTypeFields VALUES (26, 19, NULL, 11);
INSERT INTO itemTypeFields VALUES (26, 62, NULL, 12);
INSERT INTO itemTypeFields VALUES (26, 2, NULL, 13);
INSERT INTO itemTypeFields VALUES (26, 1, NULL, 14);
INSERT INTO itemTypeFields VALUES (26, 27, NULL, 15);
INSERT INTO itemTypeFields VALUES (26, 22, NULL, 16);
INSERT INTO itemTypeFields VALUES (27, 74, NULL, 1);
INSERT INTO itemTypeFields VALUES (27, 7, NULL, 2);
INSERT INTO itemTypeFields VALUES (27, 75, NULL, 3);
INSERT INTO itemTypeFields VALUES (27, 2, NULL, 4);
INSERT INTO itemTypeFields VALUES (27, 1, NULL, 5);
INSERT INTO itemTypeFields VALUES (27, 27, NULL, 6);
INSERT INTO itemTypeFields VALUES (27, 22, NULL, 7);
INSERT INTO itemTypeFields VALUES (28, 63, NULL, 1);
INSERT INTO itemTypeFields VALUES (28, 28, NULL, 2);
INSERT INTO itemTypeFields VALUES (28, 4, NULL, 3);
INSERT INTO itemTypeFields VALUES (28, 45, NULL, 4);
INSERT INTO itemTypeFields VALUES (28, 7, NULL, 5);
INSERT INTO itemTypeFields VALUES (28, 76, NULL, 6);
INSERT INTO itemTypeFields VALUES (28, 14, NULL, 7);
INSERT INTO itemTypeFields VALUES (28, 77, NULL, 8);
INSERT INTO itemTypeFields VALUES (28, 11, NULL, 9);
INSERT INTO itemTypeFields VALUES (28, 18, NULL, 10);
INSERT INTO itemTypeFields VALUES (28, 19, NULL, 11);
INSERT INTO itemTypeFields VALUES (28, 62, NULL, 12);
INSERT INTO itemTypeFields VALUES (28, 2, NULL, 13);
INSERT INTO itemTypeFields VALUES (28, 1, NULL, 14);
INSERT INTO itemTypeFields VALUES (28, 27, NULL, 15);
INSERT INTO itemTypeFields VALUES (28, 22, NULL, 16);
INSERT INTO itemTypeFields VALUES (29, 28, NULL, 1);
INSERT INTO itemTypeFields VALUES (29, 60, NULL, 2);
INSERT INTO itemTypeFields VALUES (29, 63, NULL, 3);
INSERT INTO itemTypeFields VALUES (29, 7, NULL, 4);
INSERT INTO itemTypeFields VALUES (29, 78, NULL, 5);
INSERT INTO itemTypeFields VALUES (29, 14, NULL, 6);
INSERT INTO itemTypeFields VALUES (29, 77, NULL, 7);
INSERT INTO itemTypeFields VALUES (29, 18, NULL, 8);
INSERT INTO itemTypeFields VALUES (29, 19, NULL, 9);
INSERT INTO itemTypeFields VALUES (29, 62, NULL, 10);
INSERT INTO itemTypeFields VALUES (29, 2, NULL, 11);
INSERT INTO itemTypeFields VALUES (29, 1, NULL, 12);
INSERT INTO itemTypeFields VALUES (29, 27, NULL, 13);
INSERT INTO itemTypeFields VALUES (29, 22, NULL, 14);
INSERT INTO itemTypeFields VALUES (30, 28, NULL, 1);
INSERT INTO itemTypeFields VALUES (30, 60, NULL, 2);
INSERT INTO itemTypeFields VALUES (30, 71, NULL, 3);
INSERT INTO itemTypeFields VALUES (30, 7, NULL, 4);
INSERT INTO itemTypeFields VALUES (30, 78, NULL, 5);
INSERT INTO itemTypeFields VALUES (30, 14, NULL, 6);
INSERT INTO itemTypeFields VALUES (30, 77, NULL, 7);
INSERT INTO itemTypeFields VALUES (30, 18, NULL, 8);
INSERT INTO itemTypeFields VALUES (30, 19, NULL, 9);
INSERT INTO itemTypeFields VALUES (30, 62, NULL, 10);
INSERT INTO itemTypeFields VALUES (30, 2, NULL, 11);
INSERT INTO itemTypeFields VALUES (30, 1, NULL, 12);
INSERT INTO itemTypeFields VALUES (30, 27, NULL, 13);
INSERT INTO itemTypeFields VALUES (30, 22, NULL, 14);
INSERT INTO itemTypeFields VALUES (31, 28, NULL, 1);
INSERT INTO itemTypeFields VALUES (31, 60, NULL, 2);
INSERT INTO itemTypeFields VALUES (31, 80, NULL, 3);
INSERT INTO itemTypeFields VALUES (31, 77, NULL, 4);
INSERT INTO itemTypeFields VALUES (31, 2, NULL, 5);
INSERT INTO itemTypeFields VALUES (31, 1, NULL, 6);
INSERT INTO itemTypeFields VALUES (31, 27, NULL, 7);
INSERT INTO itemTypeFields VALUES (31, 22, NULL, 8);
INSERT INTO itemTypeFields VALUES (32, 28, NULL, 1);
INSERT INTO itemTypeFields VALUES (32, 81, NULL, 2);
INSERT INTO itemTypeFields VALUES (32, 82, NULL, 3);
INSERT INTO itemTypeFields VALUES (32, 7, NULL, 4);
INSERT INTO itemTypeFields VALUES (32, 83, NULL, 5);
INSERT INTO itemTypeFields VALUES (32, 11, NULL, 6);
INSERT INTO itemTypeFields VALUES (32, 18, NULL, 7);
INSERT INTO itemTypeFields VALUES (32, 19, NULL, 8);
INSERT INTO itemTypeFields VALUES (32, 62, NULL, 9);
INSERT INTO itemTypeFields VALUES (32, 2, NULL, 10);
INSERT INTO itemTypeFields VALUES (32, 1, NULL, 11);
INSERT INTO itemTypeFields VALUES (32, 27, NULL, 12);
INSERT INTO itemTypeFields VALUES (32, 22, NULL, 13);

INSERT INTO creatorTypes VALUES(1, "author");
INSERT INTO creatorTypes VALUES(2, "contributor");
INSERT INTO creatorTypes VALUES(3, "editor");
INSERT INTO creatorTypes VALUES(4, "translator");
INSERT INTO creatorTypes VALUES(5, "seriesEditor");
INSERT INTO creatorTypes VALUES(6, "interviewee");
INSERT INTO creatorTypes VALUES(7, "interviewer");
INSERT INTO creatorTypes VALUES(8, "director");
INSERT INTO creatorTypes VALUES(9, "scriptwriter");
INSERT INTO creatorTypes VALUES(10, "producer");
INSERT INTO creatorTypes VALUES(11, "castMember");
INSERT INTO creatorTypes VALUES(12, "sponsor");
INSERT INTO creatorTypes VALUES(13, "counsel");
INSERT INTO creatorTypes VALUES(14, "inventor");
INSERT INTO creatorTypes VALUES(15, "attorneyAgent");
INSERT INTO creatorTypes VALUES(16, "recipient");
INSERT INTO creatorTypes VALUES(17, "performer");
INSERT INTO creatorTypes VALUES(18, "composer");
INSERT INTO creatorTypes VALUES(19, "wordsBy");
INSERT INTO creatorTypes VALUES(20, "cartographer");
INSERT INTO creatorTypes VALUES(21, "programmer");
INSERT INTO creatorTypes VALUES(22, "artist");
INSERT INTO creatorTypes VALUES(23, "commenter");
INSERT INTO creatorTypes VALUES(24, "presenter");
INSERT INTO creatorTypes VALUES(25, "guest");
INSERT INTO creatorTypes VALUES(26, "podcaster");
INSERT INTO creatorTypes VALUES(27, "reviewedAuthor");

INSERT INTO itemTypeCreatorTypes VALUES(2,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(2,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(2,3,0);
INSERT INTO itemTypeCreatorTypes VALUES(2,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(2,5,0);
INSERT INTO itemTypeCreatorTypes VALUES(3,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(3,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(3,3,0);
INSERT INTO itemTypeCreatorTypes VALUES(3,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(3,5,0);
INSERT INTO itemTypeCreatorTypes VALUES(4,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(4,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(4,3,0);
INSERT INTO itemTypeCreatorTypes VALUES(4,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(4,27,0);
INSERT INTO itemTypeCreatorTypes VALUES(5,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(5,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(5,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(5,27,0);
INSERT INTO itemTypeCreatorTypes VALUES(6,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(6,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(6,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(6,27,0);
INSERT INTO itemTypeCreatorTypes VALUES(7,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(7,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(8,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(8,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(8,16,0);
INSERT INTO itemTypeCreatorTypes VALUES(9,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(9,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(9,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(10,6,1);
INSERT INTO itemTypeCreatorTypes VALUES(10,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(10,7,0);
INSERT INTO itemTypeCreatorTypes VALUES(10,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(11,8,1);
INSERT INTO itemTypeCreatorTypes VALUES(11,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(11,9,0);
INSERT INTO itemTypeCreatorTypes VALUES(11,10,0);
INSERT INTO itemTypeCreatorTypes VALUES(12,22,1);
INSERT INTO itemTypeCreatorTypes VALUES(12,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(13,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(13,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(13,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(15,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(15,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(15,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(15,5,0);
INSERT INTO itemTypeCreatorTypes VALUES(16,12,1);
INSERT INTO itemTypeCreatorTypes VALUES(16,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(17,13,1);
INSERT INTO itemTypeCreatorTypes VALUES(17,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(18,2,1);
INSERT INTO itemTypeCreatorTypes VALUES(19,14,1);
INSERT INTO itemTypeCreatorTypes VALUES(19,15,0);
INSERT INTO itemTypeCreatorTypes VALUES(19,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(20,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(20,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(21,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(21,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(21,16,0);
INSERT INTO itemTypeCreatorTypes VALUES(22,20,1);
INSERT INTO itemTypeCreatorTypes VALUES(22,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(22,5,0);
INSERT INTO itemTypeCreatorTypes VALUES(23,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(23,23,0);
INSERT INTO itemTypeCreatorTypes VALUES(23,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(24,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(24,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(24,16,0);
INSERT INTO itemTypeCreatorTypes VALUES(25,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(25,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(26,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(26,17,1);
INSERT INTO itemTypeCreatorTypes VALUES(26,18,0);
INSERT INTO itemTypeCreatorTypes VALUES(26,19,0);
INSERT INTO itemTypeCreatorTypes VALUES(27,24,1);
INSERT INTO itemTypeCreatorTypes VALUES(27,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(28,8,1);
INSERT INTO itemTypeCreatorTypes VALUES(28,9,0);
INSERT INTO itemTypeCreatorTypes VALUES(28,10,0);
INSERT INTO itemTypeCreatorTypes VALUES(28,11,0);
INSERT INTO itemTypeCreatorTypes VALUES(28,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(29,8,1);
INSERT INTO itemTypeCreatorTypes VALUES(29,9,0);
INSERT INTO itemTypeCreatorTypes VALUES(29,10,0);
INSERT INTO itemTypeCreatorTypes VALUES(29,11,0);
INSERT INTO itemTypeCreatorTypes VALUES(29,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(29,25,0);
INSERT INTO itemTypeCreatorTypes VALUES(30,8,1);
INSERT INTO itemTypeCreatorTypes VALUES(30,9,0);
INSERT INTO itemTypeCreatorTypes VALUES(30,10,0);
INSERT INTO itemTypeCreatorTypes VALUES(30,11,0);
INSERT INTO itemTypeCreatorTypes VALUES(30,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(30,25,0);
INSERT INTO itemTypeCreatorTypes VALUES(31,26,1);
INSERT INTO itemTypeCreatorTypes VALUES(31,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(31,25,0);
INSERT INTO itemTypeCreatorTypes VALUES(32,21,1);
INSERT INTO itemTypeCreatorTypes VALUES(32,2,0);


    INSERT INTO "fileTypes" VALUES(1, 'webpage');
    INSERT INTO "fileTypes" VALUES(2, 'image');
    INSERT INTO "fileTypes" VALUES(3, 'pdf');
    INSERT INTO "fileTypes" VALUES(4, 'audio');
    INSERT INTO "fileTypes" VALUES(5, 'video');
    INSERT INTO "fileTypes" VALUES(6, 'document');
    INSERT INTO "fileTypes" VALUES(7, 'presentation');
    
    -- webpage
    INSERT INTO "fileTypeMIMETypes" VALUES(1, 'text/html');
    -- image
    INSERT INTO "fileTypeMIMETypes" VALUES(2, 'image/');
    INSERT INTO "fileTypeMIMETypes" VALUES(2, 'application/vnd.oasis.opendocument.graphics');
    INSERT INTO "fileTypeMIMETypes" VALUES(2, 'application/vnd.oasis.opendocument.image');
    -- pdf
    INSERT INTO "fileTypeMIMETypes" VALUES(3, 'application/pdf');
    -- audio
    INSERT INTO "fileTypeMIMETypes" VALUES(4, 'audio/');
    INSERT INTO "fileTypeMIMETypes" VALUES(4, 'x-pn-realaudio');
    INSERT INTO "fileTypeMIMETypes" VALUES(4, 'application/ogg');
    INSERT INTO "fileTypeMIMETypes" VALUES(4, 'application/x-killustrator');
    -- video
    INSERT INTO "fileTypeMIMETypes" VALUES(5, 'video/');
    INSERT INTO "fileTypeMIMETypes" VALUES(5, 'application/x-shockwave-flash');
    -- document
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'text/plain');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/rtf');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/msword');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'text/xml');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/postscript');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/wordperfect5.1');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/x-latex');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/x-tex');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/x-kword');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/x-kspread');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/x-kchart');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/vnd.oasis.opendocument.chart');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/vnd.oasis.opendocument.database');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/vnd.oasis.opendocument.formula');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/vnd.oasis.opendocument.spreadsheet');
    INSERT INTO "fileTypeMIMETypes" VALUES(6, 'application/vnd.oasis.opendocument.text');
    -- presentation
    INSERT INTO "fileTypeMIMETypes" VALUES(7, 'application/powerpoint');
    INSERT INTO "fileTypeMIMETypes" VALUES(7, 'application/vnd.oasis.opendocument.presentation');
    INSERT INTO "fileTypeMIMETypes" VALUES(7, 'application/x-kpresenter');
    
    INSERT INTO "charsets" VALUES(1, 'utf-8');
    INSERT INTO "charsets" VALUES(2, 'ascii');
    INSERT INTO "charsets" VALUES(3, 'windows-1250');
    INSERT INTO "charsets" VALUES(4, 'windows-1251');
    INSERT INTO "charsets" VALUES(5, 'windows-1252');
    INSERT INTO "charsets" VALUES(6, 'windows-1253');
    INSERT INTO "charsets" VALUES(7, 'windows-1254');
    INSERT INTO "charsets" VALUES(8, 'windows-1257');
    INSERT INTO "charsets" VALUES(9, 'us');
    INSERT INTO "charsets" VALUES(10, 'us-ascii');
    INSERT INTO "charsets" VALUES(11, 'utf-7');
    INSERT INTO "charsets" VALUES(12, 'iso8859-1');
    INSERT INTO "charsets" VALUES(13, 'iso8859-15');
    INSERT INTO "charsets" VALUES(14, 'iso_646.irv:1991');
    INSERT INTO "charsets" VALUES(15, 'iso_8859-1');
    INSERT INTO "charsets" VALUES(16, 'iso_8859-1:1987');
    INSERT INTO "charsets" VALUES(17, 'iso_8859-2');
    INSERT INTO "charsets" VALUES(18, 'iso_8859-2:1987');
    INSERT INTO "charsets" VALUES(19, 'iso_8859-4');
    INSERT INTO "charsets" VALUES(20, 'iso_8859-4:1988');
    INSERT INTO "charsets" VALUES(21, 'iso_8859-5');
    INSERT INTO "charsets" VALUES(22, 'iso_8859-5:1988');
    INSERT INTO "charsets" VALUES(23, 'iso_8859-7');
    INSERT INTO "charsets" VALUES(24, 'iso_8859-7:1987');
    INSERT INTO "charsets" VALUES(25, 'iso-8859-1');
    INSERT INTO "charsets" VALUES(26, 'iso-8859-1-windows-3.0-latin-1');
    INSERT INTO "charsets" VALUES(27, 'iso-8859-1-windows-3.1-latin-1');
    INSERT INTO "charsets" VALUES(28, 'iso-8859-15');
    INSERT INTO "charsets" VALUES(29, 'iso-8859-2');
    INSERT INTO "charsets" VALUES(30, 'iso-8859-2-windows-latin-2');
    INSERT INTO "charsets" VALUES(31, 'iso-8859-3');
    INSERT INTO "charsets" VALUES(32, 'iso-8859-4');
    INSERT INTO "charsets" VALUES(33, 'iso-8859-5');
    INSERT INTO "charsets" VALUES(34, 'iso-8859-5-windows-latin-5');
    INSERT INTO "charsets" VALUES(35, 'iso-8859-6');
    INSERT INTO "charsets" VALUES(36, 'iso-8859-7');
    INSERT INTO "charsets" VALUES(37, 'iso-8859-8');
    INSERT INTO "charsets" VALUES(38, 'iso-8859-9');
    INSERT INTO "charsets" VALUES(39, 'l1');
    INSERT INTO "charsets" VALUES(40, 'l2');
    INSERT INTO "charsets" VALUES(41, 'l4');
    INSERT INTO "charsets" VALUES(42, 'latin1');
    INSERT INTO "charsets" VALUES(43, 'latin2');
    INSERT INTO "charsets" VALUES(44, 'latin4');
    INSERT INTO "charsets" VALUES(45, 'x-mac-ce');
    INSERT INTO "charsets" VALUES(46, 'x-mac-cyrillic');
    INSERT INTO "charsets" VALUES(47, 'x-mac-greek');
    INSERT INTO "charsets" VALUES(48, 'x-mac-roman');
    INSERT INTO "charsets" VALUES(49, 'x-mac-turkish');
    INSERT INTO "charsets" VALUES(50, 'adobe-symbol-encoding');
    INSERT INTO "charsets" VALUES(51, 'ansi_x3.4-1968');
    INSERT INTO "charsets" VALUES(52, 'ansi_x3.4-1986');
    INSERT INTO "charsets" VALUES(53, 'big5');
    INSERT INTO "charsets" VALUES(54, 'chinese');
    INSERT INTO "charsets" VALUES(55, 'cn-big5');
    INSERT INTO "charsets" VALUES(56, 'cn-gb');
    INSERT INTO "charsets" VALUES(57, 'cn-gb-isoir165');
    INSERT INTO "charsets" VALUES(58, 'cp367');
    INSERT INTO "charsets" VALUES(59, 'cp819');
    INSERT INTO "charsets" VALUES(60, 'cp850');
    INSERT INTO "charsets" VALUES(61, 'cp852');
    INSERT INTO "charsets" VALUES(62, 'cp855');
    INSERT INTO "charsets" VALUES(63, 'cp857');
    INSERT INTO "charsets" VALUES(64, 'cp862');
    INSERT INTO "charsets" VALUES(65, 'cp864');
    INSERT INTO "charsets" VALUES(66, 'cp866');
    INSERT INTO "charsets" VALUES(67, 'csascii');
    INSERT INTO "charsets" VALUES(68, 'csbig5');
    INSERT INTO "charsets" VALUES(69, 'cseuckr');
    INSERT INTO "charsets" VALUES(70, 'cseucpkdfmtjapanese');
    INSERT INTO "charsets" VALUES(71, 'csgb2312');
    INSERT INTO "charsets" VALUES(72, 'cshalfwidthkatakana');
    INSERT INTO "charsets" VALUES(73, 'cshppsmath');
    INSERT INTO "charsets" VALUES(74, 'csiso103t618bit');
    INSERT INTO "charsets" VALUES(75, 'csiso159jisx02121990');
    INSERT INTO "charsets" VALUES(76, 'csiso2022jp');
    INSERT INTO "charsets" VALUES(77, 'csiso2022jp2');
    INSERT INTO "charsets" VALUES(78, 'csiso2022kr');
    INSERT INTO "charsets" VALUES(79, 'csiso58gb231280');
    INSERT INTO "charsets" VALUES(80, 'csisolatin4');
    INSERT INTO "charsets" VALUES(81, 'csisolatincyrillic');
    INSERT INTO "charsets" VALUES(82, 'csisolatingreek');
    INSERT INTO "charsets" VALUES(83, 'cskoi8r');
    INSERT INTO "charsets" VALUES(84, 'csksc56011987');
    INSERT INTO "charsets" VALUES(85, 'csshiftjis');
    INSERT INTO "charsets" VALUES(86, 'csunicode11');
    INSERT INTO "charsets" VALUES(87, 'csunicode11utf7');
    INSERT INTO "charsets" VALUES(88, 'csunicodeascii');
    INSERT INTO "charsets" VALUES(89, 'csunicodelatin1');
    INSERT INTO "charsets" VALUES(90, 'cswindows31latin5');
    INSERT INTO "charsets" VALUES(91, 'cyrillic');
    INSERT INTO "charsets" VALUES(92, 'ecma-118');
    INSERT INTO "charsets" VALUES(93, 'elot_928');
    INSERT INTO "charsets" VALUES(94, 'euc-jp');
    INSERT INTO "charsets" VALUES(95, 'euc-kr');
    INSERT INTO "charsets" VALUES(96, 'extended_unix_code_packed_format_for_japanese');
    INSERT INTO "charsets" VALUES(97, 'gb2312');
    INSERT INTO "charsets" VALUES(98, 'gb_2312-80');
    INSERT INTO "charsets" VALUES(99, 'greek');
    INSERT INTO "charsets" VALUES(100, 'greek8');
    INSERT INTO "charsets" VALUES(101, 'hz-gb-2312');
    INSERT INTO "charsets" VALUES(102, 'ibm367');
    INSERT INTO "charsets" VALUES(103, 'ibm819');
    INSERT INTO "charsets" VALUES(104, 'ibm850');
    INSERT INTO "charsets" VALUES(105, 'ibm852');
    INSERT INTO "charsets" VALUES(106, 'ibm855');
    INSERT INTO "charsets" VALUES(107, 'ibm857');
    INSERT INTO "charsets" VALUES(108, 'ibm862');
    INSERT INTO "charsets" VALUES(109, 'ibm864');
    INSERT INTO "charsets" VALUES(110, 'ibm866');
    INSERT INTO "charsets" VALUES(111, 'iso-10646');
    INSERT INTO "charsets" VALUES(112, 'iso-10646-j-1');
    INSERT INTO "charsets" VALUES(113, 'iso-10646-ucs-2');
    INSERT INTO "charsets" VALUES(114, 'iso-10646-ucs-4');
    INSERT INTO "charsets" VALUES(115, 'iso-10646-ucs-basic');
    INSERT INTO "charsets" VALUES(116, 'iso-10646-unicode-latin1');
    INSERT INTO "charsets" VALUES(117, 'iso-2022-jp');
    INSERT INTO "charsets" VALUES(118, 'iso-2022-jp-2');
    INSERT INTO "charsets" VALUES(119, 'iso-2022-kr');
    INSERT INTO "charsets" VALUES(120, 'iso-ir-100');
    INSERT INTO "charsets" VALUES(121, 'iso-ir-101');
    INSERT INTO "charsets" VALUES(122, 'iso-ir-103');
    INSERT INTO "charsets" VALUES(123, 'iso-ir-110');
    INSERT INTO "charsets" VALUES(124, 'iso-ir-126');
    INSERT INTO "charsets" VALUES(125, 'iso-ir-144');
    INSERT INTO "charsets" VALUES(126, 'iso-ir-149');
    INSERT INTO "charsets" VALUES(127, 'iso-ir-159');
    INSERT INTO "charsets" VALUES(128, 'iso-ir-58');
    INSERT INTO "charsets" VALUES(129, 'iso-ir-6');
    INSERT INTO "charsets" VALUES(130, 'iso646-us');
    INSERT INTO "charsets" VALUES(131, 'jis_x0201');
    INSERT INTO "charsets" VALUES(132, 'jis_x0208-1983');
    INSERT INTO "charsets" VALUES(133, 'jis_x0212-1990');
    INSERT INTO "charsets" VALUES(134, 'koi8-r');
    INSERT INTO "charsets" VALUES(135, 'korean');
    INSERT INTO "charsets" VALUES(136, 'ks_c_5601');
    INSERT INTO "charsets" VALUES(137, 'ks_c_5601-1987');
    INSERT INTO "charsets" VALUES(138, 'ks_c_5601-1989');
    INSERT INTO "charsets" VALUES(139, 'ksc5601');
    INSERT INTO "charsets" VALUES(140, 'ksc_5601');
    INSERT INTO "charsets" VALUES(141, 'ms_kanji');
    INSERT INTO "charsets" VALUES(142, 'shift_jis');
    INSERT INTO "charsets" VALUES(143, 't.61');
    INSERT INTO "charsets" VALUES(144, 't.61-8bit');
    INSERT INTO "charsets" VALUES(145, 'unicode-1-1-utf-7');
    INSERT INTO "charsets" VALUES(146, 'unicode-1-1-utf-8');
    INSERT INTO "charsets" VALUES(147, 'unicode-2-0-utf-7');
    INSERT INTO "charsets" VALUES(148, 'windows-31j');
    INSERT INTO "charsets" VALUES(149, 'x-cns11643-1');
    INSERT INTO "charsets" VALUES(150, 'x-cns11643-1110');
    INSERT INTO "charsets" VALUES(151, 'x-cns11643-2');
    INSERT INTO "charsets" VALUES(152, 'x-cp1250');
    INSERT INTO "charsets" VALUES(153, 'x-cp1251');
    INSERT INTO "charsets" VALUES(154, 'x-cp1253');
    INSERT INTO "charsets" VALUES(155, 'x-dectech');
    INSERT INTO "charsets" VALUES(156, 'x-dingbats');
    INSERT INTO "charsets" VALUES(157, 'x-euc-jp');
    INSERT INTO "charsets" VALUES(158, 'x-euc-tw');
    INSERT INTO "charsets" VALUES(159, 'x-gb2312-11');
    INSERT INTO "charsets" VALUES(160, 'x-imap4-modified-utf7');
    INSERT INTO "charsets" VALUES(161, 'x-jisx0208-11');
    INSERT INTO "charsets" VALUES(162, 'x-ksc5601-11');
    INSERT INTO "charsets" VALUES(163, 'x-sjis');
    INSERT INTO "charsets" VALUES(164, 'x-tis620');
    INSERT INTO "charsets" VALUES(165, 'x-unicode-2-0-utf-7');
    INSERT INTO "charsets" VALUES(166, 'x-x-big5');
    INSERT INTO "charsets" VALUES(167, 'x0201');
    INSERT INTO "charsets" VALUES(168, 'x0212');
