-- 1

-- This file creates tables containing user-specific data -- any changes made
-- here must be mirrored in transition steps in schema.js::_migrateSchema(),
-- as this file will only be used for new users.


DROP TABLE IF EXISTS version;
CREATE TABLE version (
    schema TEXT PRIMARY KEY,
    version INT NOT NULL
);
DROP INDEX IF EXISTS schema;
CREATE INDEX schema ON version(schema);

-- The foundational table; every item collected has a unique record here
DROP TABLE IF EXISTS items;
CREATE TABLE items (
    itemID INTEGER PRIMARY KEY,
    itemTypeID INT,
    title TEXT,
    dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP,
    dateModified DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Type-specific data for individual items
DROP TABLE IF EXISTS itemData;
CREATE TABLE itemData (
    itemID INT,
    fieldID INT,
    value,
    PRIMARY KEY (itemID, fieldID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (fieldID) REFERENCES fields(fieldID)
);
DROP INDEX IF EXISTS value;
CREATE INDEX value ON itemData(value);

-- Note data for note items
DROP TABLE IF EXISTS itemNotes;
CREATE TABLE itemNotes (
    itemID INT,
    sourceItemID INT,
    note TEXT,
    PRIMARY KEY (itemID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (sourceItemID) REFERENCES items(itemID)
);
DROP INDEX IF EXISTS itemNotes_sourceItemID;
CREATE INDEX itemNotes_sourceItemID ON itemNotes(sourceItemID);

-- Metadata for attachment items
DROP TABLE IF EXISTS itemAttachments;
CREATE TABLE itemAttachments (
    itemID INT,
    sourceItemID INT,
    linkMode INT,
    mimeType TEXT,
    charsetID INT,
    path TEXT,
    originalPath TEXT,
    PRIMARY KEY (itemID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (sourceItemID) REFERENCES items(sourceItemID)
);
DROP INDEX IF EXISTS itemAttachments_sourceItemID;
CREATE INDEX itemAttachments_sourceItemID ON itemAttachments(sourceItemID);
DROP INDEX IF EXISTS itemAttachments_mimeType;
CREATE INDEX itemAttachments_mimeType ON itemAttachments(mimeType);

-- Individual entries for each tag
DROP TABLE IF EXISTS tags;
CREATE TABLE tags (
    tagID INT,
    tag TEXT UNIQUE,
    PRIMARY KEY (tagID)
);

-- Associates items with keywords
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

DROP TABLE IF EXISTS itemSeeAlso;
CREATE TABLE itemSeeAlso (
    itemID INT,
    linkedItemID INT,
    PRIMARY KEY (itemID, linkedItemID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (linkedItemID) REFERENCES items(itemID)
);
DROP INDEX IF EXISTS itemSeeAlso_linkedItemID;
CREATE INDEX itemSeeAlso_linkedItemID ON itemSeeAlso(linkedItemID);

-- Names of each individual "creator" (inc. authors, editors, etc.)
DROP TABLE IF EXISTS creators;
CREATE TABLE creators (
    creatorID INT,
    firstName TEXT,
    lastName TEXT,
    isInstitution INT,
    PRIMARY KEY (creatorID)
);

-- Associates single or multiple creators to items
DROP TABLE IF EXISTS itemCreators;
CREATE TABLE itemCreators (
    itemID INT,
    creatorID INT,
    creatorTypeID INT DEFAULT 1,
    orderIndex INT DEFAULT 0,
    PRIMARY KEY (itemID, creatorID, creatorTypeID, orderIndex),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (creatorID) REFERENCES creators(creatorID)
    FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)
);

-- Collections for holding items
DROP TABLE IF EXISTS collections;
CREATE TABLE collections (
    collectionID INT,
    collectionName TEXT,
    parentCollectionID INT,
    PRIMARY KEY (collectionID),
    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID)
);

-- Associates items with the various collections they belong to
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

DROP TABLE IF EXISTS savedSearches;
CREATE TABLE savedSearches (
    savedSearchID INT,
    savedSearchName TEXT,
    PRIMARY KEY(savedSearchID)
);

DROP TABLE IF EXISTS savedSearchConditions;
CREATE TABLE savedSearchConditions (
    savedSearchID INT,
    searchConditionID INT,
    condition TEXT,
    operator TEXT,
    value TEXT,
    required NONE,
    PRIMARY KEY(savedSearchID, searchConditionID),
    FOREIGN KEY (savedSearchID) REFERENCES savedSearches(savedSearchID)
);

INSERT INTO "items" VALUES(1233, 14, 'Zotero - Quick Start Guide', '2006-08-31 20:00:00', '2006-08-31 20:00:00');
INSERT INTO "itemAttachments" VALUES(1233, NULL, 3, 'text/html', 25, 'http://www.zotero.org/docs/quick_start_guide.php', NULL);

