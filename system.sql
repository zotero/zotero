-- 21

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

-- Maps base fields to type-specific fields (e.g. publisher to label in audioRecording)
DROP TABLE IF EXISTS baseFieldMappings;
CREATE TABLE baseFieldMappings (
    itemTypeID INT,
    baseFieldID INT,
    fieldID INT,
    PRIMARY KEY (itemTypeID, baseFieldID, fieldID),
    FOREIGN KEY (baseFieldID) REFERENCES fields(fieldID),
    FOREIGN KEY (fieldID) REFERENCES fields(fieldID)
);
DROP INDEX IF EXISTS baseFieldMappings_baseFieldID;
CREATE INDEX baseFieldMappings_baseFieldID ON baseFieldMappings(baseFieldID);

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
INSERT INTO itemTypes VALUES (33,'conferencePaper',NULL,1);
INSERT INTO itemTypes VALUES (34,'document',NULL,2);
INSERT INTO itemTypes VALUES (35,'encyclopediaArticle',NULL,1);
INSERT INTO itemTypes VALUES (36,'dictionaryEntry',NULL,1);

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
INSERT INTO fields VALUES (84,'conferenceName',NULL);
INSERT INTO fields VALUES (85,'encyclopediaTitle',NULL);
INSERT INTO fields VALUES (86,'dictionaryTitle',NULL);
INSERT INTO fields VALUES (87,'language',NULL);
INSERT INTO fields VALUES (88,'programmingLanguage',NULL);
INSERT INTO fields VALUES (89,'university',NULL);
INSERT INTO fields VALUES (90,'abstractNote',NULL);
INSERT INTO fields VALUES (91,'websiteTitle',NULL);
INSERT INTO fields VALUES (92,'reportNumber',NULL);
INSERT INTO fields VALUES (93,'billNumber',NULL);
INSERT INTO fields VALUES (94,'codeVolume',NULL);
INSERT INTO fields VALUES (95,'codePages',NULL);
INSERT INTO fields VALUES (96,'dateDecided',NULL);
INSERT INTO fields VALUES (97,'reporterVolume',NULL);
INSERT INTO fields VALUES (98,'firstPage',NULL);
INSERT INTO fields VALUES (99,'documentNumber',NULL);
INSERT INTO fields VALUES (100,'dateEnacted',NULL);
INSERT INTO fields VALUES (101,'publicLawNumber',NULL);
INSERT INTO fields VALUES (102,'country',NULL);
INSERT INTO fields VALUES (103,'applicationNumber',NULL);
INSERT INTO fields VALUES (104,'forumTitle',NULL);
INSERT INTO fields VALUES (105,'episodeNumber',NULL);
INSERT INTO fields VALUES (107,'blogTitle',NULL);
INSERT INTO fields VALUES (108,'type',NULL);
INSERT INTO fields VALUES (109,'medium',NULL);
INSERT INTO fields VALUES (110,'title',NULL);
INSERT INTO fields VALUES (111,'caseName',NULL);
INSERT INTO fields VALUES (112,'nameOfAct',NULL);
INSERT INTO fields VALUES (113,'subject',NULL);
INSERT INTO fields VALUES (114,'proceedingsTitle',NULL);
INSERT INTO fields VALUES (115,'bookTitle',NULL);
INSERT INTO fields VALUES (116,'shortTitle',NULL);
INSERT INTO fields VALUES (117,'chapter',NULL);

INSERT INTO itemTypeFields VALUES (2, 110, NULL, 1); -- book/title
INSERT INTO itemTypeFields VALUES (2, 90, NULL, 2); -- book/abstractNote
INSERT INTO itemTypeFields VALUES (2, 3, NULL, 3); -- book/series
INSERT INTO itemTypeFields VALUES (2, 30, NULL, 4); -- book/seriesNumber
INSERT INTO itemTypeFields VALUES (2, 4, NULL, 5); -- book/volume
INSERT INTO itemTypeFields VALUES (2, 45, NULL, 6); -- book/numberOfVolumes
INSERT INTO itemTypeFields VALUES (2, 6, NULL, 7); -- book/edition
INSERT INTO itemTypeFields VALUES (2, 7, NULL, 8); -- book/place
INSERT INTO itemTypeFields VALUES (2, 8, NULL, 9); -- book/publisher
INSERT INTO itemTypeFields VALUES (2, 14, NULL, 10); -- book/date
INSERT INTO itemTypeFields VALUES (2, 10, NULL, 11); -- book/pages
INSERT INTO itemTypeFields VALUES (2, 87, NULL, 12); -- book/language
INSERT INTO itemTypeFields VALUES (2, 11, NULL, 13); -- book/ISBN
INSERT INTO itemTypeFields VALUES (2, 116, NULL, 14); -- book/shortTitle
INSERT INTO itemTypeFields VALUES (2, 1, NULL, 15); -- book/url
INSERT INTO itemTypeFields VALUES (2, 27, NULL, 16); -- book/accessDate
INSERT INTO itemTypeFields VALUES (2, 18, NULL, 17); -- book/callNumber
INSERT INTO itemTypeFields VALUES (2, 19, NULL, 18); -- book/archiveLocation
INSERT INTO itemTypeFields VALUES (2, 62, NULL, 19); -- book/repository
INSERT INTO itemTypeFields VALUES (2, 2, NULL, 20); -- book/rights
INSERT INTO itemTypeFields VALUES (2, 22, NULL, 21); -- book/extra
INSERT INTO itemTypeFields VALUES (3, 110, NULL, 1); -- bookSection/title
INSERT INTO itemTypeFields VALUES (3, 90, NULL, 2); -- bookSection/abstractNote
INSERT INTO itemTypeFields VALUES (3, 115, NULL, 3); -- bookSection/bookTitle
INSERT INTO itemTypeFields VALUES (3, 3, NULL, 4); -- bookSection/series
INSERT INTO itemTypeFields VALUES (3, 30, NULL, 5); -- bookSection/seriesNumber
INSERT INTO itemTypeFields VALUES (3, 4, NULL, 6); -- bookSection/volume
INSERT INTO itemTypeFields VALUES (3, 45, NULL, 7); -- bookSection/numberOfVolumes
INSERT INTO itemTypeFields VALUES (3, 6, NULL, 8); -- bookSection/edition
INSERT INTO itemTypeFields VALUES (3, 7, NULL, 9); -- bookSection/place
INSERT INTO itemTypeFields VALUES (3, 8, NULL, 10); -- bookSection/publisher
INSERT INTO itemTypeFields VALUES (3, 14, NULL, 11); -- bookSection/date
INSERT INTO itemTypeFields VALUES (3, 10, NULL, 12); -- bookSection/pages
INSERT INTO itemTypeFields VALUES (3, 87, NULL, 13); -- bookSection/language
INSERT INTO itemTypeFields VALUES (3, 11, NULL, 14); -- bookSection/ISBN
INSERT INTO itemTypeFields VALUES (3, 116, NULL, 15); -- bookSection/shortTitle
INSERT INTO itemTypeFields VALUES (3, 1, NULL, 16); -- bookSection/url
INSERT INTO itemTypeFields VALUES (3, 27, NULL, 17); -- bookSection/accessDate
INSERT INTO itemTypeFields VALUES (3, 18, NULL, 18); -- bookSection/callNumber
INSERT INTO itemTypeFields VALUES (3, 19, NULL, 19); -- bookSection/archiveLocation
INSERT INTO itemTypeFields VALUES (3, 62, NULL, 20); -- bookSection/repository
INSERT INTO itemTypeFields VALUES (3, 2, NULL, 21); -- bookSection/rights
INSERT INTO itemTypeFields VALUES (3, 22, NULL, 22); -- bookSection/extra
INSERT INTO itemTypeFields VALUES (3, 117, NULL, 23); -- bookSection/chapter
INSERT INTO itemTypeFields VALUES (4, 110, NULL, 1); -- journalArticle/title
INSERT INTO itemTypeFields VALUES (4, 90, NULL, 2); -- journalArticle/abstractNote
INSERT INTO itemTypeFields VALUES (4, 12, NULL, 3); -- journalArticle/publicationTitle
INSERT INTO itemTypeFields VALUES (4, 4, NULL, 4); -- journalArticle/volume
INSERT INTO itemTypeFields VALUES (4, 5, NULL, 5); -- journalArticle/issue
INSERT INTO itemTypeFields VALUES (4, 10, NULL, 6); -- journalArticle/pages
INSERT INTO itemTypeFields VALUES (4, 14, NULL, 7); -- journalArticle/date
INSERT INTO itemTypeFields VALUES (4, 3, NULL, 8); -- journalArticle/series
INSERT INTO itemTypeFields VALUES (4, 28, NULL, 9); -- journalArticle/seriesTitle
INSERT INTO itemTypeFields VALUES (4, 29, NULL, 10); -- journalArticle/seriesText
INSERT INTO itemTypeFields VALUES (4, 25, NULL, 11); -- journalArticle/journalAbbreviation
INSERT INTO itemTypeFields VALUES (4, 87, NULL, 12); -- journalArticle/language
INSERT INTO itemTypeFields VALUES (4, 26, NULL, 13); -- journalArticle/DOI
INSERT INTO itemTypeFields VALUES (4, 13, NULL, 14); -- journalArticle/ISSN
INSERT INTO itemTypeFields VALUES (4, 116, NULL, 15); -- journalArticle/shortTitle
INSERT INTO itemTypeFields VALUES (4, 1, NULL, 16); -- journalArticle/url
INSERT INTO itemTypeFields VALUES (4, 27, NULL, 17); -- journalArticle/accessDate
INSERT INTO itemTypeFields VALUES (4, 18, NULL, 18); -- journalArticle/callNumber
INSERT INTO itemTypeFields VALUES (4, 19, NULL, 19); -- journalArticle/archiveLocation
INSERT INTO itemTypeFields VALUES (4, 62, NULL, 20); -- journalArticle/repository
INSERT INTO itemTypeFields VALUES (4, 2, NULL, 21); -- journalArticle/rights
INSERT INTO itemTypeFields VALUES (4, 22, NULL, 22); -- journalArticle/extra
INSERT INTO itemTypeFields VALUES (5, 110, NULL, 1); -- magazineArticle/title
INSERT INTO itemTypeFields VALUES (5, 90, NULL, 2); -- magazineArticle/abstractNote
INSERT INTO itemTypeFields VALUES (5, 12, NULL, 3); -- magazineArticle/publicationTitle
INSERT INTO itemTypeFields VALUES (5, 4, NULL, 4); -- magazineArticle/volume
INSERT INTO itemTypeFields VALUES (5, 5, NULL, 5); -- magazineArticle/issue
INSERT INTO itemTypeFields VALUES (5, 14, NULL, 6); -- magazineArticle/date
INSERT INTO itemTypeFields VALUES (5, 10, NULL, 7); -- magazineArticle/pages
INSERT INTO itemTypeFields VALUES (5, 87, NULL, 8); -- magazineArticle/language
INSERT INTO itemTypeFields VALUES (5, 13, NULL, 9); -- magazineArticle/ISSN
INSERT INTO itemTypeFields VALUES (5, 116, NULL, 10); -- magazineArticle/shortTitle
INSERT INTO itemTypeFields VALUES (5, 1, NULL, 11); -- magazineArticle/url
INSERT INTO itemTypeFields VALUES (5, 27, NULL, 12); -- magazineArticle/accessDate
INSERT INTO itemTypeFields VALUES (5, 18, NULL, 13); -- magazineArticle/callNumber
INSERT INTO itemTypeFields VALUES (5, 19, NULL, 14); -- magazineArticle/archiveLocation
INSERT INTO itemTypeFields VALUES (5, 62, NULL, 15); -- magazineArticle/repository
INSERT INTO itemTypeFields VALUES (5, 2, NULL, 16); -- magazineArticle/rights
INSERT INTO itemTypeFields VALUES (5, 22, NULL, 17); -- magazineArticle/extra
INSERT INTO itemTypeFields VALUES (6, 110, NULL, 1); -- newspaperArticle/title
INSERT INTO itemTypeFields VALUES (6, 90, NULL, 2); -- newspaperArticle/abstractNote
INSERT INTO itemTypeFields VALUES (6, 12, NULL, 3); -- newspaperArticle/publicationTitle
INSERT INTO itemTypeFields VALUES (6, 6, NULL, 4); -- newspaperArticle/edition
INSERT INTO itemTypeFields VALUES (6, 14, NULL, 5); -- newspaperArticle/date
INSERT INTO itemTypeFields VALUES (6, 15, NULL, 6); -- newspaperArticle/section
INSERT INTO itemTypeFields VALUES (6, 10, NULL, 7); -- newspaperArticle/pages
INSERT INTO itemTypeFields VALUES (6, 87, NULL, 8); -- newspaperArticle/language
INSERT INTO itemTypeFields VALUES (6, 116, NULL, 9); -- newspaperArticle/shortTitle
INSERT INTO itemTypeFields VALUES (6, 13, NULL, 10); -- newspaperArticle/ISSN
INSERT INTO itemTypeFields VALUES (6, 1, NULL, 11); -- newspaperArticle/url
INSERT INTO itemTypeFields VALUES (6, 27, NULL, 12); -- newspaperArticle/accessDate
INSERT INTO itemTypeFields VALUES (6, 18, NULL, 13); -- newspaperArticle/callNumber
INSERT INTO itemTypeFields VALUES (6, 19, NULL, 14); -- newspaperArticle/archiveLocation
INSERT INTO itemTypeFields VALUES (6, 62, NULL, 15); -- newspaperArticle/repository
INSERT INTO itemTypeFields VALUES (6, 2, NULL, 16); -- newspaperArticle/rights
INSERT INTO itemTypeFields VALUES (6, 22, NULL, 17); -- newspaperArticle/extra
INSERT INTO itemTypeFields VALUES (7, 110, NULL, 1); -- thesis/title
INSERT INTO itemTypeFields VALUES (7, 90, NULL, 2); -- thesis/abstractNote
INSERT INTO itemTypeFields VALUES (7, 69, NULL, 3); -- thesis/thesisType
INSERT INTO itemTypeFields VALUES (7, 89, NULL, 4); -- thesis/university
INSERT INTO itemTypeFields VALUES (7, 14, NULL, 5); -- thesis/date
INSERT INTO itemTypeFields VALUES (7, 10, NULL, 6); -- thesis/pages
INSERT INTO itemTypeFields VALUES (7, 87, NULL, 7); -- thesis/language
INSERT INTO itemTypeFields VALUES (7, 116, NULL, 8); -- thesis/shortTitle
INSERT INTO itemTypeFields VALUES (7, 1, NULL, 9); -- thesis/url
INSERT INTO itemTypeFields VALUES (7, 27, NULL, 10); -- thesis/accessDate
INSERT INTO itemTypeFields VALUES (7, 18, NULL, 11); -- thesis/callNumber
INSERT INTO itemTypeFields VALUES (7, 19, NULL, 12); -- thesis/archiveLocation
INSERT INTO itemTypeFields VALUES (7, 62, NULL, 13); -- thesis/repository
INSERT INTO itemTypeFields VALUES (7, 2, NULL, 14); -- thesis/rights
INSERT INTO itemTypeFields VALUES (7, 22, NULL, 15); -- thesis/extra
INSERT INTO itemTypeFields VALUES (8, 110, NULL, 1); -- letter/title
INSERT INTO itemTypeFields VALUES (8, 90, NULL, 2); -- letter/abstractNote
INSERT INTO itemTypeFields VALUES (8, 65, NULL, 3); -- letter/letterType
INSERT INTO itemTypeFields VALUES (8, 14, NULL, 4); -- letter/date
INSERT INTO itemTypeFields VALUES (8, 87, NULL, 5); -- letter/language
INSERT INTO itemTypeFields VALUES (8, 116, NULL, 6); -- letter/shortTitle
INSERT INTO itemTypeFields VALUES (8, 1, NULL, 7); -- letter/url
INSERT INTO itemTypeFields VALUES (8, 27, NULL, 8); -- letter/accessDate
INSERT INTO itemTypeFields VALUES (8, 18, NULL, 9); -- letter/callNumber
INSERT INTO itemTypeFields VALUES (8, 19, NULL, 10); -- letter/archiveLocation
INSERT INTO itemTypeFields VALUES (8, 62, NULL, 11); -- letter/repository
INSERT INTO itemTypeFields VALUES (8, 2, NULL, 12); -- letter/rights
INSERT INTO itemTypeFields VALUES (8, 22, NULL, 13); -- letter/extra
INSERT INTO itemTypeFields VALUES (9, 110, NULL, 1); -- manuscript/title
INSERT INTO itemTypeFields VALUES (9, 90, NULL, 2); -- manuscript/abstractNote
INSERT INTO itemTypeFields VALUES (9, 66, NULL, 3); -- manuscript/manuscriptType
INSERT INTO itemTypeFields VALUES (9, 7, NULL, 4); -- manuscript/place
INSERT INTO itemTypeFields VALUES (9, 14, NULL, 5); -- manuscript/date
INSERT INTO itemTypeFields VALUES (9, 10, NULL, 6); -- manuscript/pages
INSERT INTO itemTypeFields VALUES (9, 87, NULL, 7); -- manuscript/language
INSERT INTO itemTypeFields VALUES (9, 116, NULL, 8); -- manuscript/shortTitle
INSERT INTO itemTypeFields VALUES (9, 1, NULL, 9); -- manuscript/url
INSERT INTO itemTypeFields VALUES (9, 27, NULL, 10); -- manuscript/accessDate
INSERT INTO itemTypeFields VALUES (9, 18, NULL, 11); -- manuscript/callNumber
INSERT INTO itemTypeFields VALUES (9, 19, NULL, 12); -- manuscript/archiveLocation
INSERT INTO itemTypeFields VALUES (9, 62, NULL, 13); -- manuscript/repository
INSERT INTO itemTypeFields VALUES (9, 2, NULL, 14); -- manuscript/rights
INSERT INTO itemTypeFields VALUES (9, 22, NULL, 15); -- manuscript/extra
INSERT INTO itemTypeFields VALUES (10, 110, NULL, 1); -- interview/title
INSERT INTO itemTypeFields VALUES (10, 90, NULL, 2); -- interview/abstractNote
INSERT INTO itemTypeFields VALUES (10, 14, NULL, 3); -- interview/date
INSERT INTO itemTypeFields VALUES (10, 64, NULL, 4); -- interview/interviewMedium
INSERT INTO itemTypeFields VALUES (10, 87, NULL, 5); -- interview/language
INSERT INTO itemTypeFields VALUES (10, 116, NULL, 6); -- interview/shortTitle
INSERT INTO itemTypeFields VALUES (10, 1, NULL, 7); -- interview/url
INSERT INTO itemTypeFields VALUES (10, 27, NULL, 8); -- interview/accessDate
INSERT INTO itemTypeFields VALUES (10, 18, NULL, 9); -- interview/callNumber
INSERT INTO itemTypeFields VALUES (10, 19, NULL, 10); -- interview/archiveLocation
INSERT INTO itemTypeFields VALUES (10, 62, NULL, 11); -- interview/repository
INSERT INTO itemTypeFields VALUES (10, 2, NULL, 12); -- interview/rights
INSERT INTO itemTypeFields VALUES (10, 22, NULL, 13); -- interview/extra
INSERT INTO itemTypeFields VALUES (11, 110, NULL, 1); -- film/title
INSERT INTO itemTypeFields VALUES (11, 90, NULL, 2); -- film/abstractNote
INSERT INTO itemTypeFields VALUES (11, 21, NULL, 3); -- film/distributor
INSERT INTO itemTypeFields VALUES (11, 63, NULL, 4); -- film/videoRecordingType
INSERT INTO itemTypeFields VALUES (11, 14, NULL, 5); -- film/date
INSERT INTO itemTypeFields VALUES (11, 77, NULL, 6); -- film/runningTime
INSERT INTO itemTypeFields VALUES (11, 87, NULL, 7); -- film/language
INSERT INTO itemTypeFields VALUES (11, 116, NULL, 8); -- film/shortTitle
INSERT INTO itemTypeFields VALUES (11, 1, NULL, 9); -- film/url
INSERT INTO itemTypeFields VALUES (11, 27, NULL, 10); -- film/accessDate
INSERT INTO itemTypeFields VALUES (11, 18, NULL, 11); -- film/callNumber
INSERT INTO itemTypeFields VALUES (11, 19, NULL, 12); -- film/archiveLocation
INSERT INTO itemTypeFields VALUES (11, 62, NULL, 13); -- film/repository
INSERT INTO itemTypeFields VALUES (11, 2, NULL, 14); -- film/rights
INSERT INTO itemTypeFields VALUES (11, 22, NULL, 15); -- film/extra
INSERT INTO itemTypeFields VALUES (12, 110, NULL, 1); -- artwork/title
INSERT INTO itemTypeFields VALUES (12, 90, NULL, 2); -- artwork/abstractNote
INSERT INTO itemTypeFields VALUES (12, 59, NULL, 3); -- artwork/artworkMedium
INSERT INTO itemTypeFields VALUES (12, 61, NULL, 4); -- artwork/artworkSize
INSERT INTO itemTypeFields VALUES (12, 14, NULL, 5); -- artwork/date
INSERT INTO itemTypeFields VALUES (12, 87, NULL, 6); -- artwork/language
INSERT INTO itemTypeFields VALUES (12, 116, NULL, 7); -- artwork/shortTitle
INSERT INTO itemTypeFields VALUES (12, 18, NULL, 8); -- artwork/callNumber
INSERT INTO itemTypeFields VALUES (12, 19, NULL, 9); -- artwork/archiveLocation
INSERT INTO itemTypeFields VALUES (12, 62, NULL, 10); -- artwork/repository
INSERT INTO itemTypeFields VALUES (12, 1, NULL, 11); -- artwork/url
INSERT INTO itemTypeFields VALUES (12, 27, NULL, 12); -- artwork/accessDate
INSERT INTO itemTypeFields VALUES (12, 2, NULL, 13); -- artwork/rights
INSERT INTO itemTypeFields VALUES (12, 22, NULL, 14); -- artwork/extra
INSERT INTO itemTypeFields VALUES (13, 110, NULL, 1); -- webpage/title
INSERT INTO itemTypeFields VALUES (13, 90, NULL, 2); -- webpage/abstractNote
INSERT INTO itemTypeFields VALUES (13, 91, NULL, 3); -- webpage/websiteTitle
INSERT INTO itemTypeFields VALUES (13, 70, NULL, 4); -- webpage/websiteType
INSERT INTO itemTypeFields VALUES (13, 14, NULL, 5); -- webpage/date
INSERT INTO itemTypeFields VALUES (13, 116, NULL, 6); -- webpage/shortTitle
INSERT INTO itemTypeFields VALUES (13, 1, NULL, 7); -- webpage/url
INSERT INTO itemTypeFields VALUES (13, 27, NULL, 8); -- webpage/accessDate
INSERT INTO itemTypeFields VALUES (13, 87, NULL, 9); -- webpage/language
INSERT INTO itemTypeFields VALUES (13, 2, NULL, 10); -- webpage/rights
INSERT INTO itemTypeFields VALUES (13, 22, NULL, 11); -- webpage/extra
INSERT INTO itemTypeFields VALUES (14, 110, NULL, 1); -- attachment/title
INSERT INTO itemTypeFields VALUES (14, 27, NULL, 2); -- attachment/accessDate
INSERT INTO itemTypeFields VALUES (14, 1, NULL, 3); -- attachment/url
INSERT INTO itemTypeFields VALUES (15, 110, NULL, 1); -- report/title
INSERT INTO itemTypeFields VALUES (15, 90, NULL, 2); -- report/abstractNote
INSERT INTO itemTypeFields VALUES (15, 92, NULL, 3); -- report/reportNumber
INSERT INTO itemTypeFields VALUES (15, 32, NULL, 4); -- report/reportType
INSERT INTO itemTypeFields VALUES (15, 28, NULL, 5); -- report/seriesTitle
INSERT INTO itemTypeFields VALUES (15, 7, NULL, 6); -- report/place
INSERT INTO itemTypeFields VALUES (15, 31, NULL, 7); -- report/institution
INSERT INTO itemTypeFields VALUES (15, 14, NULL, 8); -- report/date
INSERT INTO itemTypeFields VALUES (15, 10, NULL, 9); -- report/pages
INSERT INTO itemTypeFields VALUES (15, 87, NULL, 10); -- report/language
INSERT INTO itemTypeFields VALUES (15, 116, NULL, 11); -- report/shortTitle
INSERT INTO itemTypeFields VALUES (15, 1, NULL, 12); -- report/url
INSERT INTO itemTypeFields VALUES (15, 27, NULL, 13); -- report/accessDate
INSERT INTO itemTypeFields VALUES (15, 18, NULL, 14); -- report/callNumber
INSERT INTO itemTypeFields VALUES (15, 19, NULL, 15); -- report/archiveLocation
INSERT INTO itemTypeFields VALUES (15, 62, NULL, 16); -- report/repository
INSERT INTO itemTypeFields VALUES (15, 2, NULL, 17); -- report/rights
INSERT INTO itemTypeFields VALUES (15, 22, NULL, 18); -- report/extra
INSERT INTO itemTypeFields VALUES (16, 110, NULL, 1); -- bill/title
INSERT INTO itemTypeFields VALUES (16, 90, NULL, 2); -- bill/abstractNote
INSERT INTO itemTypeFields VALUES (16, 93, NULL, 3); -- bill/billNumber
INSERT INTO itemTypeFields VALUES (16, 36, NULL, 4); -- bill/code
INSERT INTO itemTypeFields VALUES (16, 94, NULL, 5); -- bill/codeVolume
INSERT INTO itemTypeFields VALUES (16, 15, NULL, 6); -- bill/section
INSERT INTO itemTypeFields VALUES (16, 95, NULL, 7); -- bill/codePages
INSERT INTO itemTypeFields VALUES (16, 41, NULL, 8); -- bill/legislativeBody
INSERT INTO itemTypeFields VALUES (16, 40, NULL, 9); -- bill/session
INSERT INTO itemTypeFields VALUES (16, 42, NULL, 10); -- bill/history
INSERT INTO itemTypeFields VALUES (16, 14, NULL, 11); -- bill/date
INSERT INTO itemTypeFields VALUES (16, 87, NULL, 12); -- bill/language
INSERT INTO itemTypeFields VALUES (16, 1, NULL, 13); -- bill/url
INSERT INTO itemTypeFields VALUES (16, 27, NULL, 14); -- bill/accessDate
INSERT INTO itemTypeFields VALUES (16, 116, NULL, 15); -- bill/shortTitle
INSERT INTO itemTypeFields VALUES (16, 2, NULL, 16); -- bill/rights
INSERT INTO itemTypeFields VALUES (16, 22, NULL, 17); -- bill/extra
INSERT INTO itemTypeFields VALUES (17, 111, NULL, 1); -- case/caseName
INSERT INTO itemTypeFields VALUES (17, 90, NULL, 2); -- case/abstractNote
INSERT INTO itemTypeFields VALUES (17, 43, NULL, 3); -- case/reporter
INSERT INTO itemTypeFields VALUES (17, 97, NULL, 4); -- case/reporterVolume
INSERT INTO itemTypeFields VALUES (17, 44, NULL, 5); -- case/court
INSERT INTO itemTypeFields VALUES (17, 98, NULL, 6); -- case/firstPage
INSERT INTO itemTypeFields VALUES (17, 42, NULL, 7); -- case/history
INSERT INTO itemTypeFields VALUES (17, 96, NULL, 8); -- case/dateDecided
INSERT INTO itemTypeFields VALUES (17, 87, NULL, 9); -- case/language
INSERT INTO itemTypeFields VALUES (17, 116, NULL, 10); -- case/shortTitle
INSERT INTO itemTypeFields VALUES (17, 1, NULL, 11); -- case/url
INSERT INTO itemTypeFields VALUES (17, 27, NULL, 12); -- case/accessDate
INSERT INTO itemTypeFields VALUES (17, 2, NULL, 13); -- case/rights
INSERT INTO itemTypeFields VALUES (17, 22, NULL, 14); -- case/extra
INSERT INTO itemTypeFields VALUES (18, 110, NULL, 1); -- hearing/title
INSERT INTO itemTypeFields VALUES (18, 90, NULL, 2); -- hearing/abstractNote
INSERT INTO itemTypeFields VALUES (18, 46, NULL, 3); -- hearing/committee
INSERT INTO itemTypeFields VALUES (18, 7, NULL, 4); -- hearing/place
INSERT INTO itemTypeFields VALUES (18, 8, NULL, 5); -- hearing/publisher
INSERT INTO itemTypeFields VALUES (18, 45, NULL, 6); -- hearing/numberOfVolumes
INSERT INTO itemTypeFields VALUES (18, 99, NULL, 7); -- hearing/documentNumber
INSERT INTO itemTypeFields VALUES (18, 10, NULL, 8); -- hearing/pages
INSERT INTO itemTypeFields VALUES (18, 41, NULL, 9); -- hearing/legislativeBody
INSERT INTO itemTypeFields VALUES (18, 40, NULL, 10); -- hearing/session
INSERT INTO itemTypeFields VALUES (18, 42, NULL, 11); -- hearing/history
INSERT INTO itemTypeFields VALUES (18, 14, NULL, 12); -- hearing/date
INSERT INTO itemTypeFields VALUES (18, 87, NULL, 13); -- hearing/language
INSERT INTO itemTypeFields VALUES (18, 116, NULL, 14); -- hearing/shortTitle
INSERT INTO itemTypeFields VALUES (18, 1, NULL, 15); -- hearing/url
INSERT INTO itemTypeFields VALUES (18, 27, NULL, 16); -- hearing/accessDate
INSERT INTO itemTypeFields VALUES (18, 2, NULL, 17); -- hearing/rights
INSERT INTO itemTypeFields VALUES (18, 22, NULL, 18); -- hearing/extra
INSERT INTO itemTypeFields VALUES (19, 110, NULL, 1); -- patent/title
INSERT INTO itemTypeFields VALUES (19, 90, NULL, 2); -- patent/abstractNote
INSERT INTO itemTypeFields VALUES (19, 7, NULL, 3); -- patent/place
INSERT INTO itemTypeFields VALUES (19, 48, NULL, 4); -- patent/assignee
INSERT INTO itemTypeFields VALUES (19, 50, NULL, 5); -- patent/patentNumber
INSERT INTO itemTypeFields VALUES (19, 14, NULL, 6); -- patent/date
INSERT INTO itemTypeFields VALUES (19, 10, NULL, 7); -- patent/pages
INSERT INTO itemTypeFields VALUES (19, 103, NULL, 8); -- patent/applicationNumber
INSERT INTO itemTypeFields VALUES (19, 51, NULL, 9); -- patent/priorityNumbers
INSERT INTO itemTypeFields VALUES (19, 52, NULL, 10); -- patent/issueDate
INSERT INTO itemTypeFields VALUES (19, 53, NULL, 11); -- patent/references
INSERT INTO itemTypeFields VALUES (19, 54, NULL, 12); -- patent/legalStatus
INSERT INTO itemTypeFields VALUES (19, 87, NULL, 13); -- patent/language
INSERT INTO itemTypeFields VALUES (19, 116, NULL, 14); -- patent/shortTitle
INSERT INTO itemTypeFields VALUES (19, 1, NULL, 15); -- patent/url
INSERT INTO itemTypeFields VALUES (19, 27, NULL, 16); -- patent/accessDate
INSERT INTO itemTypeFields VALUES (19, 2, NULL, 17); -- patent/rights
INSERT INTO itemTypeFields VALUES (19, 22, NULL, 18); -- patent/extra
INSERT INTO itemTypeFields VALUES (20, 112, NULL, 1); -- statute/nameOfAct
INSERT INTO itemTypeFields VALUES (20, 90, NULL, 2); -- statute/abstractNote
INSERT INTO itemTypeFields VALUES (20, 36, NULL, 3); -- statute/code
INSERT INTO itemTypeFields VALUES (20, 55, NULL, 4); -- statute/codeNumber
INSERT INTO itemTypeFields VALUES (20, 101, NULL, 5); -- statute/publicLawNumber
INSERT INTO itemTypeFields VALUES (20, 100, NULL, 6); -- statute/dateEnacted
INSERT INTO itemTypeFields VALUES (20, 10, NULL, 7); -- statute/pages
INSERT INTO itemTypeFields VALUES (20, 15, NULL, 8); -- statute/section
INSERT INTO itemTypeFields VALUES (20, 40, NULL, 9); -- statute/session
INSERT INTO itemTypeFields VALUES (20, 42, NULL, 10); -- statute/history
INSERT INTO itemTypeFields VALUES (20, 87, NULL, 11); -- statute/language
INSERT INTO itemTypeFields VALUES (20, 116, NULL, 12); -- statute/shortTitle
INSERT INTO itemTypeFields VALUES (20, 1, NULL, 13); -- statute/url
INSERT INTO itemTypeFields VALUES (20, 27, NULL, 14); -- statute/accessDate
INSERT INTO itemTypeFields VALUES (20, 2, NULL, 15); -- statute/rights
INSERT INTO itemTypeFields VALUES (20, 22, NULL, 16); -- statute/extra
INSERT INTO itemTypeFields VALUES (21, 113, NULL, 1); -- email/subject
INSERT INTO itemTypeFields VALUES (21, 90, NULL, 2); -- email/abstractNote
INSERT INTO itemTypeFields VALUES (21, 14, NULL, 3); -- email/date
INSERT INTO itemTypeFields VALUES (21, 116, NULL, 4); -- email/shortTitle
INSERT INTO itemTypeFields VALUES (21, 1, NULL, 5); -- email/url
INSERT INTO itemTypeFields VALUES (21, 27, NULL, 6); -- email/accessDate
INSERT INTO itemTypeFields VALUES (21, 87, NULL, 7); -- email/language
INSERT INTO itemTypeFields VALUES (21, 2, NULL, 8); -- email/rights
INSERT INTO itemTypeFields VALUES (21, 22, NULL, 9); -- email/extra
INSERT INTO itemTypeFields VALUES (22, 110, NULL, 1); -- map/title
INSERT INTO itemTypeFields VALUES (22, 90, NULL, 2); -- map/abstractNote
INSERT INTO itemTypeFields VALUES (22, 67, NULL, 3); -- map/mapType
INSERT INTO itemTypeFields VALUES (22, 68, NULL, 4); -- map/scale
INSERT INTO itemTypeFields VALUES (22, 28, NULL, 5); -- map/seriesTitle
INSERT INTO itemTypeFields VALUES (22, 6, NULL, 6); -- map/edition
INSERT INTO itemTypeFields VALUES (22, 7, NULL, 7); -- map/place
INSERT INTO itemTypeFields VALUES (22, 8, NULL, 8); -- map/publisher
INSERT INTO itemTypeFields VALUES (22, 14, NULL, 9); -- map/date
INSERT INTO itemTypeFields VALUES (22, 87, NULL, 10); -- map/language
INSERT INTO itemTypeFields VALUES (22, 11, NULL, 11); -- map/ISBN
INSERT INTO itemTypeFields VALUES (22, 116, NULL, 12); -- map/shortTitle
INSERT INTO itemTypeFields VALUES (22, 1, NULL, 13); -- map/url
INSERT INTO itemTypeFields VALUES (22, 27, NULL, 14); -- map/accessDate
INSERT INTO itemTypeFields VALUES (22, 18, NULL, 15); -- map/callNumber
INSERT INTO itemTypeFields VALUES (22, 19, NULL, 16); -- map/archiveLocation
INSERT INTO itemTypeFields VALUES (22, 62, NULL, 17); -- map/repository
INSERT INTO itemTypeFields VALUES (22, 2, NULL, 18); -- map/rights
INSERT INTO itemTypeFields VALUES (22, 22, NULL, 19); -- map/extra
INSERT INTO itemTypeFields VALUES (23, 110, NULL, 1); -- blogPost/title
INSERT INTO itemTypeFields VALUES (23, 90, NULL, 2); -- blogPost/abstractNote
INSERT INTO itemTypeFields VALUES (23, 107, NULL, 3); -- blogPost/blogTitle
INSERT INTO itemTypeFields VALUES (23, 70, NULL, 4); -- blogPost/websiteType
INSERT INTO itemTypeFields VALUES (23, 14, NULL, 5); -- blogPost/date
INSERT INTO itemTypeFields VALUES (23, 1, NULL, 6); -- blogPost/url
INSERT INTO itemTypeFields VALUES (23, 27, NULL, 7); -- blogPost/accessDate
INSERT INTO itemTypeFields VALUES (23, 87, NULL, 8); -- blogPost/language
INSERT INTO itemTypeFields VALUES (23, 116, NULL, 9); -- blogPost/shortTitle
INSERT INTO itemTypeFields VALUES (23, 2, NULL, 10); -- blogPost/rights
INSERT INTO itemTypeFields VALUES (23, 22, NULL, 11); -- blogPost/extra
INSERT INTO itemTypeFields VALUES (24, 110, NULL, 1); -- instantMessage/title
INSERT INTO itemTypeFields VALUES (24, 90, NULL, 2); -- instantMessage/abstractNote
INSERT INTO itemTypeFields VALUES (24, 14, NULL, 3); -- instantMessage/date
INSERT INTO itemTypeFields VALUES (24, 87, NULL, 4); -- instantMessage/language
INSERT INTO itemTypeFields VALUES (24, 116, NULL, 5); -- instantMessage/shortTitle
INSERT INTO itemTypeFields VALUES (24, 1, NULL, 6); -- instantMessage/url
INSERT INTO itemTypeFields VALUES (24, 27, NULL, 7); -- instantMessage/accessDate
INSERT INTO itemTypeFields VALUES (24, 2, NULL, 8); -- instantMessage/rights
INSERT INTO itemTypeFields VALUES (24, 22, NULL, 9); -- instantMessage/extra
INSERT INTO itemTypeFields VALUES (25, 110, NULL, 1); -- forumPost/title
INSERT INTO itemTypeFields VALUES (25, 90, NULL, 2); -- forumPost/abstractNote
INSERT INTO itemTypeFields VALUES (25, 104, NULL, 3); -- forumPost/forumTitle
INSERT INTO itemTypeFields VALUES (25, 79, NULL, 4); -- forumPost/postType
INSERT INTO itemTypeFields VALUES (25, 14, NULL, 5); -- forumPost/date
INSERT INTO itemTypeFields VALUES (25, 87, NULL, 6); -- forumPost/language
INSERT INTO itemTypeFields VALUES (25, 116, NULL, 7); -- forumPost/shortTitle
INSERT INTO itemTypeFields VALUES (25, 1, NULL, 8); -- forumPost/url
INSERT INTO itemTypeFields VALUES (25, 27, NULL, 9); -- forumPost/accessDate
INSERT INTO itemTypeFields VALUES (25, 2, NULL, 10); -- forumPost/rights
INSERT INTO itemTypeFields VALUES (25, 22, NULL, 11); -- forumPost/extra
INSERT INTO itemTypeFields VALUES (26, 110, NULL, 1); -- audioRecording/title
INSERT INTO itemTypeFields VALUES (26, 90, NULL, 2); -- audioRecording/abstractNote
INSERT INTO itemTypeFields VALUES (26, 71, NULL, 3); -- audioRecording/audioRecordingType
INSERT INTO itemTypeFields VALUES (26, 28, NULL, 4); -- audioRecording/seriesTitle
INSERT INTO itemTypeFields VALUES (26, 4, NULL, 5); -- audioRecording/volume
INSERT INTO itemTypeFields VALUES (26, 45, NULL, 6); -- audioRecording/numberOfVolumes
INSERT INTO itemTypeFields VALUES (26, 7, NULL, 7); -- audioRecording/place
INSERT INTO itemTypeFields VALUES (26, 72, NULL, 8); -- audioRecording/label
INSERT INTO itemTypeFields VALUES (26, 14, NULL, 9); -- audioRecording/date
INSERT INTO itemTypeFields VALUES (26, 77, NULL, 10); -- audioRecording/runningTime
INSERT INTO itemTypeFields VALUES (26, 87, NULL, 11); -- audioRecording/language
INSERT INTO itemTypeFields VALUES (26, 11, NULL, 12); -- audioRecording/ISBN
INSERT INTO itemTypeFields VALUES (26, 116, NULL, 13); -- audioRecording/shortTitle
INSERT INTO itemTypeFields VALUES (26, 18, NULL, 14); -- audioRecording/callNumber
INSERT INTO itemTypeFields VALUES (26, 19, NULL, 15); -- audioRecording/archiveLocation
INSERT INTO itemTypeFields VALUES (26, 62, NULL, 16); -- audioRecording/repository
INSERT INTO itemTypeFields VALUES (26, 1, NULL, 17); -- audioRecording/url
INSERT INTO itemTypeFields VALUES (26, 27, NULL, 18); -- audioRecording/accessDate
INSERT INTO itemTypeFields VALUES (26, 2, NULL, 19); -- audioRecording/rights
INSERT INTO itemTypeFields VALUES (26, 22, NULL, 20); -- audioRecording/extra
INSERT INTO itemTypeFields VALUES (27, 110, NULL, 1); -- presentation/title
INSERT INTO itemTypeFields VALUES (27, 90, NULL, 2); -- presentation/abstractNote
INSERT INTO itemTypeFields VALUES (27, 74, NULL, 3); -- presentation/presentationType
INSERT INTO itemTypeFields VALUES (27, 14, NULL, 4); -- presentation/date
INSERT INTO itemTypeFields VALUES (27, 7, NULL, 5); -- presentation/place
INSERT INTO itemTypeFields VALUES (27, 75, NULL, 6); -- presentation/meetingName
INSERT INTO itemTypeFields VALUES (27, 1, NULL, 7); -- presentation/url
INSERT INTO itemTypeFields VALUES (27, 27, NULL, 8); -- presentation/accessDate
INSERT INTO itemTypeFields VALUES (27, 87, NULL, 9); -- presentation/language
INSERT INTO itemTypeFields VALUES (27, 116, NULL, 10); -- presentation/shortTitle
INSERT INTO itemTypeFields VALUES (27, 2, NULL, 11); -- presentation/rights
INSERT INTO itemTypeFields VALUES (27, 22, NULL, 12); -- presentation/extra
INSERT INTO itemTypeFields VALUES (28, 110, NULL, 1); -- videoRecording/title
INSERT INTO itemTypeFields VALUES (28, 90, NULL, 2); -- videoRecording/abstractNote
INSERT INTO itemTypeFields VALUES (28, 63, NULL, 3); -- videoRecording/videoRecordingType
INSERT INTO itemTypeFields VALUES (28, 28, NULL, 4); -- videoRecording/seriesTitle
INSERT INTO itemTypeFields VALUES (28, 4, NULL, 5); -- videoRecording/volume
INSERT INTO itemTypeFields VALUES (28, 45, NULL, 6); -- videoRecording/numberOfVolumes
INSERT INTO itemTypeFields VALUES (28, 7, NULL, 7); -- videoRecording/place
INSERT INTO itemTypeFields VALUES (28, 76, NULL, 8); -- videoRecording/studio
INSERT INTO itemTypeFields VALUES (28, 14, NULL, 9); -- videoRecording/date
INSERT INTO itemTypeFields VALUES (28, 77, NULL, 10); -- videoRecording/runningTime
INSERT INTO itemTypeFields VALUES (28, 87, NULL, 11); -- videoRecording/language
INSERT INTO itemTypeFields VALUES (28, 11, NULL, 12); -- videoRecording/ISBN
INSERT INTO itemTypeFields VALUES (28, 116, NULL, 13); -- videoRecording/shortTitle
INSERT INTO itemTypeFields VALUES (28, 1, NULL, 14); -- videoRecording/url
INSERT INTO itemTypeFields VALUES (28, 27, NULL, 15); -- videoRecording/accessDate
INSERT INTO itemTypeFields VALUES (28, 18, NULL, 16); -- videoRecording/callNumber
INSERT INTO itemTypeFields VALUES (28, 19, NULL, 17); -- videoRecording/archiveLocation
INSERT INTO itemTypeFields VALUES (28, 62, NULL, 18); -- videoRecording/repository
INSERT INTO itemTypeFields VALUES (28, 2, NULL, 19); -- videoRecording/rights
INSERT INTO itemTypeFields VALUES (28, 22, NULL, 20); -- videoRecording/extra
INSERT INTO itemTypeFields VALUES (29, 110, NULL, 1); -- tvBroadcast/title
INSERT INTO itemTypeFields VALUES (29, 90, NULL, 2); -- tvBroadcast/abstractNote
INSERT INTO itemTypeFields VALUES (29, 28, NULL, 3); -- tvBroadcast/seriesTitle
INSERT INTO itemTypeFields VALUES (29, 105, NULL, 4); -- tvBroadcast/episodeNumber
INSERT INTO itemTypeFields VALUES (29, 63, NULL, 5); -- tvBroadcast/videoRecordingType
INSERT INTO itemTypeFields VALUES (29, 7, NULL, 6); -- tvBroadcast/place
INSERT INTO itemTypeFields VALUES (29, 78, NULL, 7); -- tvBroadcast/network
INSERT INTO itemTypeFields VALUES (29, 14, NULL, 8); -- tvBroadcast/date
INSERT INTO itemTypeFields VALUES (29, 77, NULL, 9); -- tvBroadcast/runningTime
INSERT INTO itemTypeFields VALUES (29, 87, NULL, 10); -- tvBroadcast/language
INSERT INTO itemTypeFields VALUES (29, 116, NULL, 11); -- tvBroadcast/shortTitle
INSERT INTO itemTypeFields VALUES (29, 1, NULL, 12); -- tvBroadcast/url
INSERT INTO itemTypeFields VALUES (29, 27, NULL, 13); -- tvBroadcast/accessDate
INSERT INTO itemTypeFields VALUES (29, 18, NULL, 14); -- tvBroadcast/callNumber
INSERT INTO itemTypeFields VALUES (29, 19, NULL, 15); -- tvBroadcast/archiveLocation
INSERT INTO itemTypeFields VALUES (29, 62, NULL, 16); -- tvBroadcast/repository
INSERT INTO itemTypeFields VALUES (29, 2, NULL, 17); -- tvBroadcast/rights
INSERT INTO itemTypeFields VALUES (29, 22, NULL, 18); -- tvBroadcast/extra
INSERT INTO itemTypeFields VALUES (30, 110, NULL, 1); -- radioBroadcast/title
INSERT INTO itemTypeFields VALUES (30, 90, NULL, 2); -- radioBroadcast/abstractNote
INSERT INTO itemTypeFields VALUES (30, 28, NULL, 3); -- radioBroadcast/seriesTitle
INSERT INTO itemTypeFields VALUES (30, 105, NULL, 4); -- radioBroadcast/episodeNumber
INSERT INTO itemTypeFields VALUES (30, 71, NULL, 5); -- radioBroadcast/audioRecordingType
INSERT INTO itemTypeFields VALUES (30, 7, NULL, 6); -- radioBroadcast/place
INSERT INTO itemTypeFields VALUES (30, 78, NULL, 7); -- radioBroadcast/network
INSERT INTO itemTypeFields VALUES (30, 14, NULL, 8); -- radioBroadcast/date
INSERT INTO itemTypeFields VALUES (30, 77, NULL, 9); -- radioBroadcast/runningTime
INSERT INTO itemTypeFields VALUES (30, 87, NULL, 10); -- radioBroadcast/language
INSERT INTO itemTypeFields VALUES (30, 116, NULL, 11); -- radioBroadcast/shortTitle
INSERT INTO itemTypeFields VALUES (30, 1, NULL, 12); -- radioBroadcast/url
INSERT INTO itemTypeFields VALUES (30, 27, NULL, 13); -- radioBroadcast/accessDate
INSERT INTO itemTypeFields VALUES (30, 18, NULL, 14); -- radioBroadcast/callNumber
INSERT INTO itemTypeFields VALUES (30, 19, NULL, 15); -- radioBroadcast/archiveLocation
INSERT INTO itemTypeFields VALUES (30, 62, NULL, 16); -- radioBroadcast/repository
INSERT INTO itemTypeFields VALUES (30, 2, NULL, 17); -- radioBroadcast/rights
INSERT INTO itemTypeFields VALUES (30, 22, NULL, 18); -- radioBroadcast/extra
INSERT INTO itemTypeFields VALUES (31, 110, NULL, 1); -- podcast/title
INSERT INTO itemTypeFields VALUES (31, 90, NULL, 2); -- podcast/abstractNote
INSERT INTO itemTypeFields VALUES (31, 28, NULL, 3); -- podcast/seriesTitle
INSERT INTO itemTypeFields VALUES (31, 105, NULL, 4); -- podcast/episodeNumber
INSERT INTO itemTypeFields VALUES (31, 80, NULL, 5); -- podcast/audioFileType
INSERT INTO itemTypeFields VALUES (31, 77, NULL, 6); -- podcast/runningTime
INSERT INTO itemTypeFields VALUES (31, 1, NULL, 7); -- podcast/url
INSERT INTO itemTypeFields VALUES (31, 27, NULL, 8); -- podcast/accessDate
INSERT INTO itemTypeFields VALUES (31, 87, NULL, 9); -- podcast/language
INSERT INTO itemTypeFields VALUES (31, 116, NULL, 10); -- podcast/shortTitle
INSERT INTO itemTypeFields VALUES (31, 2, NULL, 11); -- podcast/rights
INSERT INTO itemTypeFields VALUES (31, 22, NULL, 12); -- podcast/extra
INSERT INTO itemTypeFields VALUES (32, 110, NULL, 1); -- computerProgram/title
INSERT INTO itemTypeFields VALUES (32, 90, NULL, 2); -- computerProgram/abstractNote
INSERT INTO itemTypeFields VALUES (32, 28, NULL, 3); -- computerProgram/seriesTitle
INSERT INTO itemTypeFields VALUES (32, 81, NULL, 4); -- computerProgram/version
INSERT INTO itemTypeFields VALUES (32, 82, NULL, 5); -- computerProgram/system
INSERT INTO itemTypeFields VALUES (32, 7, NULL, 6); -- computerProgram/place
INSERT INTO itemTypeFields VALUES (32, 83, NULL, 7); -- computerProgram/company
INSERT INTO itemTypeFields VALUES (32, 88, NULL, 8); -- computerProgram/programmingLanguage
INSERT INTO itemTypeFields VALUES (32, 11, NULL, 9); -- computerProgram/ISBN
INSERT INTO itemTypeFields VALUES (32, 116, NULL, 10); -- computerProgram/shortTitle
INSERT INTO itemTypeFields VALUES (32, 1, NULL, 11); -- computerProgram/url
INSERT INTO itemTypeFields VALUES (32, 2, NULL, 12); -- computerProgram/rights
INSERT INTO itemTypeFields VALUES (32, 18, NULL, 13); -- computerProgram/callNumber
INSERT INTO itemTypeFields VALUES (32, 19, NULL, 14); -- computerProgram/archiveLocation
INSERT INTO itemTypeFields VALUES (32, 62, NULL, 15); -- computerProgram/repository
INSERT INTO itemTypeFields VALUES (32, 27, NULL, 16); -- computerProgram/accessDate
INSERT INTO itemTypeFields VALUES (32, 22, NULL, 17); -- computerProgram/extra
INSERT INTO itemTypeFields VALUES (33, 110, NULL, 1); -- conferencePaper/title
INSERT INTO itemTypeFields VALUES (33, 90, NULL, 2); -- conferencePaper/abstractNote
INSERT INTO itemTypeFields VALUES (33, 14, NULL, 3); -- conferencePaper/date
INSERT INTO itemTypeFields VALUES (33, 114, NULL, 4); -- conferencePaper/proceedingsTitle
INSERT INTO itemTypeFields VALUES (33, 84, NULL, 5); -- conferencePaper/conferenceName
INSERT INTO itemTypeFields VALUES (33, 7, NULL, 6); -- conferencePaper/place
INSERT INTO itemTypeFields VALUES (33, 8, NULL, 7); -- conferencePaper/publisher
INSERT INTO itemTypeFields VALUES (33, 4, NULL, 8); -- conferencePaper/volume
INSERT INTO itemTypeFields VALUES (33, 10, NULL, 9); -- conferencePaper/pages
INSERT INTO itemTypeFields VALUES (33, 3, NULL, 10); -- conferencePaper/series
INSERT INTO itemTypeFields VALUES (33, 87, NULL, 11); -- conferencePaper/language
INSERT INTO itemTypeFields VALUES (33, 26, NULL, 12); -- conferencePaper/DOI
INSERT INTO itemTypeFields VALUES (33, 11, NULL, 13); -- conferencePaper/ISBN
INSERT INTO itemTypeFields VALUES (33, 116, NULL, 14); -- conferencePaper/shortTitle
INSERT INTO itemTypeFields VALUES (33, 1, NULL, 15); -- conferencePaper/url
INSERT INTO itemTypeFields VALUES (33, 27, NULL, 16); -- conferencePaper/accessDate
INSERT INTO itemTypeFields VALUES (33, 18, NULL, 17); -- conferencePaper/callNumber
INSERT INTO itemTypeFields VALUES (33, 19, NULL, 18); -- conferencePaper/archiveLocation
INSERT INTO itemTypeFields VALUES (33, 62, NULL, 19); -- conferencePaper/repository
INSERT INTO itemTypeFields VALUES (33, 2, NULL, 20); -- conferencePaper/rights
INSERT INTO itemTypeFields VALUES (33, 22, NULL, 21); -- conferencePaper/extra
INSERT INTO itemTypeFields VALUES (34, 110, NULL, 1); -- document/title
INSERT INTO itemTypeFields VALUES (34, 90, NULL, 2); -- document/abstractNote
INSERT INTO itemTypeFields VALUES (34, 8, NULL, 3); -- document/publisher
INSERT INTO itemTypeFields VALUES (34, 14, NULL, 4); -- document/date
INSERT INTO itemTypeFields VALUES (34, 87, NULL, 5); -- document/language
INSERT INTO itemTypeFields VALUES (34, 116, NULL, 6); -- document/shortTitle
INSERT INTO itemTypeFields VALUES (34, 1, NULL, 7); -- document/url
INSERT INTO itemTypeFields VALUES (34, 27, NULL, 8); -- document/accessDate
INSERT INTO itemTypeFields VALUES (34, 18, NULL, 9); -- document/callNumber
INSERT INTO itemTypeFields VALUES (34, 19, NULL, 10); -- document/archiveLocation
INSERT INTO itemTypeFields VALUES (34, 62, NULL, 11); -- document/repository
INSERT INTO itemTypeFields VALUES (34, 2, NULL, 12); -- document/rights
INSERT INTO itemTypeFields VALUES (34, 22, NULL, 13); -- document/extra
INSERT INTO itemTypeFields VALUES (35, 110, NULL, 1); -- encyclopediaArticle/title
INSERT INTO itemTypeFields VALUES (35, 90, NULL, 2); -- encyclopediaArticle/abstractNote
INSERT INTO itemTypeFields VALUES (35, 85, NULL, 3); -- encyclopediaArticle/encyclopediaTitle
INSERT INTO itemTypeFields VALUES (35, 3, NULL, 4); -- encyclopediaArticle/series
INSERT INTO itemTypeFields VALUES (35, 30, NULL, 5); -- encyclopediaArticle/seriesNumber
INSERT INTO itemTypeFields VALUES (35, 4, NULL, 6); -- encyclopediaArticle/volume
INSERT INTO itemTypeFields VALUES (35, 45, NULL, 7); -- encyclopediaArticle/numberOfVolumes
INSERT INTO itemTypeFields VALUES (35, 6, NULL, 8); -- encyclopediaArticle/edition
INSERT INTO itemTypeFields VALUES (35, 7, NULL, 9); -- encyclopediaArticle/place
INSERT INTO itemTypeFields VALUES (35, 8, NULL, 10); -- encyclopediaArticle/publisher
INSERT INTO itemTypeFields VALUES (35, 14, NULL, 11); -- encyclopediaArticle/date
INSERT INTO itemTypeFields VALUES (35, 10, NULL, 12); -- encyclopediaArticle/pages
INSERT INTO itemTypeFields VALUES (35, 11, NULL, 13); -- encyclopediaArticle/ISBN
INSERT INTO itemTypeFields VALUES (35, 116, NULL, 14); -- encyclopediaArticle/shortTitle
INSERT INTO itemTypeFields VALUES (35, 1, NULL, 15); -- encyclopediaArticle/url
INSERT INTO itemTypeFields VALUES (35, 27, NULL, 16); -- encyclopediaArticle/accessDate
INSERT INTO itemTypeFields VALUES (35, 87, NULL, 17); -- encyclopediaArticle/language
INSERT INTO itemTypeFields VALUES (35, 18, NULL, 18); -- encyclopediaArticle/callNumber
INSERT INTO itemTypeFields VALUES (35, 19, NULL, 19); -- encyclopediaArticle/archiveLocation
INSERT INTO itemTypeFields VALUES (35, 62, NULL, 20); -- encyclopediaArticle/repository
INSERT INTO itemTypeFields VALUES (35, 2, NULL, 21); -- encyclopediaArticle/rights
INSERT INTO itemTypeFields VALUES (35, 22, NULL, 22); -- encyclopediaArticle/extra
INSERT INTO itemTypeFields VALUES (36, 110, NULL, 1); -- dictionaryEntry/title
INSERT INTO itemTypeFields VALUES (36, 90, NULL, 2); -- dictionaryEntry/abstractNote
INSERT INTO itemTypeFields VALUES (36, 86, NULL, 3); -- dictionaryEntry/dictionaryTitle
INSERT INTO itemTypeFields VALUES (36, 3, NULL, 4); -- dictionaryEntry/series
INSERT INTO itemTypeFields VALUES (36, 30, NULL, 5); -- dictionaryEntry/seriesNumber
INSERT INTO itemTypeFields VALUES (36, 4, NULL, 6); -- dictionaryEntry/volume
INSERT INTO itemTypeFields VALUES (36, 45, NULL, 7); -- dictionaryEntry/numberOfVolumes
INSERT INTO itemTypeFields VALUES (36, 6, NULL, 8); -- dictionaryEntry/edition
INSERT INTO itemTypeFields VALUES (36, 7, NULL, 9); -- dictionaryEntry/place
INSERT INTO itemTypeFields VALUES (36, 8, NULL, 10); -- dictionaryEntry/publisher
INSERT INTO itemTypeFields VALUES (36, 14, NULL, 11); -- dictionaryEntry/date
INSERT INTO itemTypeFields VALUES (36, 10, NULL, 12); -- dictionaryEntry/pages
INSERT INTO itemTypeFields VALUES (36, 87, NULL, 13); -- dictionaryEntry/language
INSERT INTO itemTypeFields VALUES (36, 11, NULL, 14); -- dictionaryEntry/ISBN
INSERT INTO itemTypeFields VALUES (36, 116, NULL, 15); -- dictionaryEntry/shortTitle
INSERT INTO itemTypeFields VALUES (36, 1, NULL, 16); -- dictionaryEntry/url
INSERT INTO itemTypeFields VALUES (36, 27, NULL, 17); -- dictionaryEntry/accessDate
INSERT INTO itemTypeFields VALUES (36, 18, NULL, 18); -- dictionaryEntry/callNumber
INSERT INTO itemTypeFields VALUES (36, 19, NULL, 19); -- dictionaryEntry/archiveLocation
INSERT INTO itemTypeFields VALUES (36, 62, NULL, 20); -- dictionaryEntry/repository
INSERT INTO itemTypeFields VALUES (36, 2, NULL, 21); -- dictionaryEntry/rights
INSERT INTO itemTypeFields VALUES (36, 22, NULL, 22); -- dictionaryEntry/extra


INSERT INTO baseFieldMappings VALUES (16, 4, 94); -- bill/volume/codeVolume
INSERT INTO baseFieldMappings VALUES (17, 4, 97); -- case/volume/reporterVolume
INSERT INTO baseFieldMappings VALUES (19, 7, 102); -- patent/place/country
INSERT INTO baseFieldMappings VALUES (7, 8, 89); -- thesis/publisher/university
INSERT INTO baseFieldMappings VALUES (15, 8, 31); -- report/publisher/institution
INSERT INTO baseFieldMappings VALUES (26, 8, 72); -- audioRecording/publisher/label
INSERT INTO baseFieldMappings VALUES (28, 8, 76); -- videoRecording/publisher/studio
INSERT INTO baseFieldMappings VALUES (30, 8, 78); -- radioBroadcast/publisher/network
INSERT INTO baseFieldMappings VALUES (32, 8, 83); -- computerProgram/publisher/company
INSERT INTO baseFieldMappings VALUES (16, 10, 95); -- bill/pages/codePages
INSERT INTO baseFieldMappings VALUES (17, 10, 98); -- case/pages/firstPage
INSERT INTO baseFieldMappings VALUES (17, 12, 43); -- case/publicationTitle/reporter
INSERT INTO baseFieldMappings VALUES (3, 12, 115); -- bookSection/publicationTitle/bookTitle
INSERT INTO baseFieldMappings VALUES (33, 12, 114); -- conferencePaper/publicationTitle/proceedingsTitle
INSERT INTO baseFieldMappings VALUES (13, 12, 91); -- webpage/publicationTitle/websiteTitle
INSERT INTO baseFieldMappings VALUES (23, 12, 107); -- blogPost/publicationTitle/blogTitle
INSERT INTO baseFieldMappings VALUES (25, 12, 104); -- forumPost/publicationTitle/forumTitle
INSERT INTO baseFieldMappings VALUES (35, 12, 85); -- encyclopediaEntry/publicationTitle/encyclopediaTitle
INSERT INTO baseFieldMappings VALUES (36, 12, 86); -- dictionaryEntry/publicationTitle/dictionaryTitle
INSERT INTO baseFieldMappings VALUES (17, 14, 96); -- case/date/dateDecided
INSERT INTO baseFieldMappings VALUES (19, 14, 52); -- patent/date/issueDate
INSERT INTO baseFieldMappings VALUES (20, 14, 100); -- statute/date/dateEnacted
INSERT INTO baseFieldMappings VALUES (15, 60, 92); -- report/number/reportNumber
INSERT INTO baseFieldMappings VALUES (16, 60, 93); -- bill/number/billNumber
INSERT INTO baseFieldMappings VALUES (18, 60, 99); -- hearing/number/documentNumber
INSERT INTO baseFieldMappings VALUES (19, 60, 50); -- patent/number/patentNumber
INSERT INTO baseFieldMappings VALUES (20, 60, 101); -- statute/number/publicLawNumber
INSERT INTO baseFieldMappings VALUES (29, 60, 105); -- tvBroadcast/number/episodeNumber
INSERT INTO baseFieldMappings VALUES (30, 60, 105); -- radioBroadcast/number/episodeNumber
INSERT INTO baseFieldMappings VALUES (31, 60, 105); -- podcast/number/episodeNumber
INSERT INTO baseFieldMappings VALUES (7, 108, 69); -- thesis/type/thesisType
INSERT INTO baseFieldMappings VALUES (8, 108, 65); -- letter/type/letterType
INSERT INTO baseFieldMappings VALUES (9, 108, 66); -- manuscript/type/manuscriptType
INSERT INTO baseFieldMappings VALUES (11, 108, 63); -- film/type/videoRecordingType
INSERT INTO baseFieldMappings VALUES (13, 108, 70); -- webpage/type/websiteType
INSERT INTO baseFieldMappings VALUES (15, 108, 32); -- report/type/reportType
INSERT INTO baseFieldMappings VALUES (22, 108, 67); -- map/type/mapType
INSERT INTO baseFieldMappings VALUES (23, 108, 70); -- blogPost/type/websiteType
INSERT INTO baseFieldMappings VALUES (25, 108, 79); -- forumPost/type/postType
INSERT INTO baseFieldMappings VALUES (26, 108, 71); -- audioRecording/type/audioRecordingType
INSERT INTO baseFieldMappings VALUES (27, 108, 74); -- presentation/type/presentationType
INSERT INTO baseFieldMappings VALUES (28, 108, 63); -- videoRecording/type/videoRecodingType
INSERT INTO baseFieldMappings VALUES (29, 108, 63); -- tvBroadcast/type/videoRecodingType
INSERT INTO baseFieldMappings VALUES (30, 108, 71); -- radioBroadcast/type/audioRecordingType
INSERT INTO baseFieldMappings VALUES (31, 108, 80); -- podcast/type/audioFileType
INSERT INTO baseFieldMappings VALUES (10, 109, 64); -- interview/medium/interviewMedium
INSERT INTO baseFieldMappings VALUES (12, 109, 59); -- artwork/medium/artworkMedium
INSERT INTO baseFieldMappings VALUES (17, 110, 111); -- case/title/caseName
INSERT INTO baseFieldMappings VALUES (20, 110, 112); -- statute/title/nameOfAct
INSERT INTO baseFieldMappings VALUES (20, 12, 36); -- statute/publicationTitle/code
INSERT INTO baseFieldMappings VALUES (21, 110, 113); -- email/title/subject

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
INSERT INTO itemTypeCreatorTypes VALUES(33, 1, 1);
INSERT INTO itemTypeCreatorTypes VALUES(33, 2, 0);
INSERT INTO itemTypeCreatorTypes VALUES(33, 3, 0);
INSERT INTO itemTypeCreatorTypes VALUES(33, 4, 0);
INSERT INTO itemTypeCreatorTypes VALUES(33, 5, 0);
INSERT INTO itemTypeCreatorTypes VALUES(34,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(34,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(34,3,0);
INSERT INTO itemTypeCreatorTypes VALUES(34,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(34,27,0);
INSERT INTO itemTypeCreatorTypes VALUES(35,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(35,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(35,3,0);
INSERT INTO itemTypeCreatorTypes VALUES(35,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(35,5,0);
INSERT INTO itemTypeCreatorTypes VALUES(36,1,1);
INSERT INTO itemTypeCreatorTypes VALUES(36,2,0);
INSERT INTO itemTypeCreatorTypes VALUES(36,3,0);
INSERT INTO itemTypeCreatorTypes VALUES(36,4,0);
INSERT INTO itemTypeCreatorTypes VALUES(36,5,0);


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
