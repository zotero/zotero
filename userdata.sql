-- 38

-- This file creates tables containing user-specific data -- any changes made
-- here must be mirrored in transition steps in schema.js::_migrateSchema()


CREATE TABLE version (
    schema TEXT PRIMARY KEY,
    version INT NOT NULL
);
CREATE INDEX schema ON version(schema);

CREATE TABLE settings (
    setting TEXT,
    key TEXT,
    value,
    PRIMARY KEY (setting, key)
);

-- The foundational table; every item collected has a unique record here
CREATE TABLE items (
    itemID INTEGER PRIMARY KEY,
    itemTypeID INT,
    dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP,
    dateModified DATETIME DEFAULT CURRENT_TIMESTAMP,
    key TEXT NOT NULL UNIQUE
);

CREATE TABLE itemDataValues (
    valueID INTEGER PRIMARY KEY,
    value UNIQUE
);

-- Type-specific data for individual items
CREATE TABLE itemData (
    itemID INT,
    fieldID INT,
    valueID,
    PRIMARY KEY (itemID, fieldID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (fieldID) REFERENCES fields(fieldID),
    FOREIGN KEY (valueID) REFERENCES itemDataValues(valueID)
);

-- Note data for note items
CREATE TABLE itemNotes (
    itemID INTEGER PRIMARY KEY,
    sourceItemID INT,
    note TEXT,
    title TEXT,
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (sourceItemID) REFERENCES items(itemID)
);
CREATE INDEX itemNotes_sourceItemID ON itemNotes(sourceItemID);

-- Metadata for attachment items
CREATE TABLE itemAttachments (
    itemID INTEGER PRIMARY KEY,
    sourceItemID INT,
    linkMode INT,
    mimeType TEXT,
    charsetID INT,
    path TEXT,
    originalPath TEXT,
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (sourceItemID) REFERENCES items(sourceItemID)
);
CREATE INDEX itemAttachments_sourceItemID ON itemAttachments(sourceItemID);
CREATE INDEX itemAttachments_mimeType ON itemAttachments(mimeType);

-- Individual entries for each tag
CREATE TABLE tags (
    tagID INTEGER PRIMARY KEY,
    name TEXT COLLATE NOCASE,
    type INT,
    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,
    key TEXT NOT NULL UNIQUE,
    UNIQUE (name, type)
);

-- Associates items with keywords
CREATE TABLE itemTags (
    itemID INT,
    tagID INT,
    PRIMARY KEY (itemID, tagID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (tagID) REFERENCES tags(tagID)
);
CREATE INDEX itemTags_tagID ON itemTags(tagID);

CREATE TABLE itemSeeAlso (
    itemID INT,
    linkedItemID INT,
    PRIMARY KEY (itemID, linkedItemID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (linkedItemID) REFERENCES items(itemID)
);
CREATE INDEX itemSeeAlso_linkedItemID ON itemSeeAlso(linkedItemID);


CREATE TABLE creators (
    creatorID INTEGER PRIMARY KEY,
    creatorDataID INT,
    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,
    key TEXT NOT NULL UNIQUE,
    FOREIGN KEY (creatorDataID) REFERENCES creatorData(creatorDataID)
);
CREATE INDEX creators_creatorDataID ON creators(creatorDataID);

-- Each individual creator
CREATE TABLE creatorData (
    creatorDataID INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    shortName TEXT,
    fieldMode INT,
    birthYear INT
);

-- Associates single or multiple creators to items
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
CREATE TABLE collections (
    collectionID INTEGER PRIMARY KEY,
    collectionName TEXT,
    parentCollectionID INT,
    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,
    key TEXT NOT NULL UNIQUE,
    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID)
);

-- Associates items with the various collections they belong to
CREATE TABLE collectionItems (
    collectionID INT,
    itemID INT,
    orderIndex INT DEFAULT 0,
    PRIMARY KEY (collectionID, itemID),
    FOREIGN KEY (collectionID) REFERENCES collections(collectionID),
    FOREIGN KEY (itemID) REFERENCES items(itemID)
);
CREATE INDEX itemID ON collectionItems(itemID);

CREATE TABLE savedSearches (
    savedSearchID INTEGER PRIMARY KEY,
    savedSearchName TEXT,
    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,
    key TEXT NOT NULL UNIQUE
);

CREATE TABLE savedSearchConditions (
    savedSearchID INT,
    searchConditionID INT,
    condition TEXT,
    operator TEXT,
    value TEXT,
    required NONE,
    PRIMARY KEY (savedSearchID, searchConditionID),
    FOREIGN KEY (savedSearchID) REFERENCES savedSearches(savedSearchID)
);

CREATE TABLE fulltextItems (
    itemID INTEGER PRIMARY KEY,
    version INT,
    indexedPages INT,
    totalPages INT,
    indexedChars INT,
    totalChars INT,
    FOREIGN KEY (itemID) REFERENCES items(itemID)
);
CREATE INDEX fulltextItems_version ON fulltextItems(version);

CREATE TABLE fulltextWords (
    wordID INTEGER PRIMARY KEY,
    word TEXT UNIQUE
);

CREATE TABLE fulltextItemWords (
    wordID INT,
    itemID INT,
    PRIMARY KEY (wordID, itemID),
    FOREIGN KEY (wordID) REFERENCES fulltextWords(wordID),
    FOREIGN KEY (itemID) REFERENCES items(itemID)
);
CREATE INDEX fulltextItemWords_itemID ON fulltextItemWords(itemID);

CREATE TABLE syncDeleteLog (
    syncObjectTypeID INT NOT NULL,
    objectID INT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    timestamp INT NOT NULL,
    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)
);
CREATE INDEX syncDeleteLog_timestamp ON syncDeleteLog(timestamp);

CREATE TABLE translators (
    translatorID TEXT PRIMARY KEY,
    minVersion TEXT,
    maxVersion TEXT,
    lastUpdated DATETIME,
    inRepository INT,
    priority INT,
    translatorType INT,
    label TEXT,
    creator TEXT,
    target TEXT,
    detectCode TEXT,
    code TEXT
);
CREATE INDEX translators_type ON translators(translatorType);

CREATE TABLE csl (
    cslID TEXT PRIMARY KEY,
    updated DATETIME,
    title TEXT,
    csl TEXT
);

CREATE TABLE annotations (
    annotationID INTEGER PRIMARY KEY,
    itemID INT,
    parent TEXT,
    textNode INT,
    offset INT,
    x INT,
    y INT,
    cols INT,
    rows INT,
    text TEXT,
    collapsed BOOL,
    dateModified DATE,
    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID)
);
CREATE INDEX annotations_itemID ON annotations(itemID);

CREATE TABLE highlights (
    highlightID INTEGER PRIMARY KEY,
    itemID INTEGER,
    startParent TEXT,
    startTextNode INT,
    startOffset INT,
    endParent TEXT,
    endTextNode INT,
    endOffset INT,
    dateModified DATE,
    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID)
);
CREATE INDEX highlights_itemID ON highlights(itemID);