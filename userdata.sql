-- 36

-- This file creates tables containing user-specific data -- any changes
-- to existing tables made here must be mirrored in transition steps in
-- schema.js::_migrateSchema()


CREATE TABLE IF NOT EXISTS version (
    schema TEXT PRIMARY KEY,
    version INT NOT NULL
);
CREATE INDEX IF NOT EXISTS schema ON version(schema);

CREATE TABLE IF NOT EXISTS settings (
    setting TEXT,
    key TEXT,
    value,
    PRIMARY KEY (setting, key)
);

-- Show or hide pre-mapped fields for system item types
CREATE TABLE IF NOT EXISTS userFieldMask (
    itemTypeID INT,
    fieldID INT,
    hide INT,
    PRIMARY KEY (itemTypeID, fieldID),
    FOREIGN KEY (itemTypeID, fieldID) REFERENCES itemTypeFields(itemTypeID, fieldID)
);

-- User-defined item types -- itemTypeIDs must be >= 1000
CREATE TABLE IF NOT EXISTS userItemTypes (
    itemTypeID INTEGER PRIMARY KEY,
    typeName TEXT,
    templateItemTypeID INT
);

-- Control visibility and placement of system and user item types
CREATE TABLE IF NOT EXISTS userItemTypeMask (
    itemTypeID INTEGER PRIMARY KEY,
    display INT, -- 0 == hide, 1 == show, 2 == primary
    FOREIGN KEY (itemTypeID) REFERENCES userItemTypes(itemTypeID)
);

-- User-defined fields
CREATE TABLE IF NOT EXISTS userFields (
    userFieldID INTEGER PRIMARY KEY,
    fieldName TEXT
);

-- Map custom fields to system and custom item types
CREATE TABLE IF NOT EXISTS userItemTypeFields (
    itemTypeID INT,
    userFieldID INT,
    orderIndex INT,
    PRIMARY KEY (itemTypeID, userFieldID),
    FOREIGN KEY (userFieldID) REFERENCES userFields(userFieldID)
);

-- The foundational table; every item collected has a unique record here
CREATE TABLE IF NOT EXISTS items (
    itemID INTEGER PRIMARY KEY,
    itemTypeID INT,
    dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP,
    dateModified DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itemDataValues (
    valueID INTEGER PRIMARY KEY,
    value
);

-- Type-specific data for individual items
--
-- Triggers specified in schema.js due to lack of trigger IF [NOT] EXISTS in Firefox 2.0
CREATE TABLE IF NOT EXISTS itemData (
    itemID INT,
    fieldID INT,
    valueID,
    PRIMARY KEY (itemID, fieldID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (fieldID) REFERENCES fields(fieldID),
    FOREIGN KEY (valueID) REFERENCES itemDataValues(valueID)
);

-- Note data for note items
CREATE TABLE IF NOT EXISTS itemNotes (
    itemID INTEGER PRIMARY KEY,
    sourceItemID INT,
    note TEXT,
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (sourceItemID) REFERENCES items(itemID)
);
CREATE INDEX IF NOT EXISTS itemNotes_sourceItemID ON itemNotes(sourceItemID);

CREATE TABLE IF NOT EXISTS itemNoteTitles (
    itemID INTEGER PRIMARY KEY,
    title TEXT,
    FOREIGN KEY (itemID) REFERENCES itemNotes(itemID)
);

-- Metadata for attachment items
CREATE TABLE IF NOT EXISTS itemAttachments (
    itemID INTEGER PRIMARY KEY,
    sourceItemID INT,
    linkMode INT,
    mimeType TEXT,
    charsetID INT,
    path TEXT,
    originalPath TEXT,
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (sourceItemID) REFERENCES items(itemID)
);
CREATE INDEX IF NOT EXISTS itemAttachments_sourceItemID ON itemAttachments(sourceItemID);
CREATE INDEX IF NOT EXISTS itemAttachments_mimeType ON itemAttachments(mimeType);

-- Individual entries for each tag
CREATE TABLE IF NOT EXISTS tags (
    tagID INTEGER PRIMARY KEY,
    tag TEXT,
    tagType INT,
    UNIQUE (tag, tagType)
);

-- Associates items with keywords
CREATE TABLE IF NOT EXISTS itemTags (
    itemID INT,
    tagID INT,
    PRIMARY KEY (itemID, tagID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (tagID) REFERENCES tags(tagID)
);
CREATE INDEX IF NOT EXISTS itemTags_tagID ON itemTags(tagID);

CREATE TABLE IF NOT EXISTS itemSeeAlso (
    itemID INT,
    linkedItemID INT,
    PRIMARY KEY (itemID, linkedItemID),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (linkedItemID) REFERENCES items(itemID)
);
CREATE INDEX IF NOT EXISTS itemSeeAlso_linkedItemID ON itemSeeAlso(linkedItemID);

-- Names of each individual "creator" (inc. authors, editors, etc.)
CREATE TABLE IF NOT EXISTS creators (
    creatorID INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    fieldMode INT
);

-- Associates single or multiple creators to items
CREATE TABLE IF NOT EXISTS itemCreators (
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
CREATE TABLE IF NOT EXISTS collections (
    collectionID INTEGER PRIMARY KEY,
    collectionName TEXT,
    parentCollectionID INT,
    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID)
);

-- Associates items with the various collections they belong to
CREATE TABLE IF NOT EXISTS collectionItems (
    collectionID INT,
    itemID INT,
    orderIndex INT DEFAULT 0,
    PRIMARY KEY (collectionID, itemID),
    FOREIGN KEY (collectionID) REFERENCES collections(collectionID),
    FOREIGN KEY (itemID) REFERENCES items(itemID)
);
CREATE INDEX IF NOT EXISTS itemID ON collectionItems(itemID);

CREATE TABLE IF NOT EXISTS savedSearches (
    savedSearchID INTEGER PRIMARY KEY,
    savedSearchName TEXT
);

CREATE TABLE IF NOT EXISTS savedSearchConditions (
    savedSearchID INT,
    searchConditionID INT,
    condition TEXT,
    operator TEXT,
    value TEXT,
    required NONE,
    PRIMARY KEY (savedSearchID, searchConditionID),
    FOREIGN KEY (savedSearchID) REFERENCES savedSearches(savedSearchID)
);

CREATE TABLE IF NOT EXISTS fulltextItems (
    itemID INTEGER PRIMARY KEY,
    version INT,
    indexedPages INT,
    totalPages INT,
    indexedChars INT,
    totalChars INT,
    FOREIGN KEY (itemID) REFERENCES items(itemID)
);
CREATE INDEX IF NOT EXISTS fulltextItems_version ON fulltextItems(version);

CREATE TABLE IF NOT EXISTS fulltextWords (
    wordID INTEGER PRIMARY KEY,
    word TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS fulltextWords_word ON fulltextWords(word);

CREATE TABLE IF NOT EXISTS fulltextItemWords (
    wordID INT,
    itemID INT,
    PRIMARY KEY (wordID, itemID),
    FOREIGN KEY (wordID) REFERENCES fulltextWords(wordID),
    FOREIGN KEY (itemID) REFERENCES items(itemID)
);
CREATE INDEX IF NOT EXISTS fulltextItemWords_itemID ON fulltextItemWords(itemID);

CREATE TABLE IF NOT EXISTS translators (
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
CREATE INDEX IF NOT EXISTS translators_type ON translators(translatorType);

CREATE TABLE IF NOT EXISTS csl (
    cslID TEXT PRIMARY KEY,
    updated DATETIME,
    title TEXT,
    csl TEXT
);

CREATE TABLE IF NOT EXISTS annotations (
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
CREATE INDEX IF NOT EXISTS annotations_itemID ON annotations(itemID);

CREATE TABLE IF NOT EXISTS highlights (
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
CREATE INDEX IF NOT EXISTS highlights_itemID ON highlights(itemID);