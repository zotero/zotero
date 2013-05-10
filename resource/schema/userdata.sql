-- 78

-- Copyright (c) 2009 Center for History and New Media
--                    George Mason University, Fairfax, Virginia, USA
--                    http://zotero.org
--
-- This file is part of Zotero.
-- 
-- Zotero is free software: you can redistribute it and/or modify
-- it under the terms of the GNU Affero General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
-- 
-- Zotero is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU Affero General Public License for more details.
-- 
-- You should have received a copy of the GNU Affero General Public License
-- along with Zotero.  If not, see <http://www.gnu.org/licenses/>.


-- This file creates tables containing user-specific data for new users --
-- any changes made here must be mirrored in transition steps in schema.js::_migrateSchema()


CREATE TABLE version (
    schema TEXT PRIMARY KEY,
    version INT NOT NULL
);
CREATE INDEX schema ON version(schema);

-- Settings that have to be tied to the local database rather than the profile directory
CREATE TABLE settings (
    setting TEXT,
    key TEXT,
    value,
    PRIMARY KEY (setting, key)
);

-- Settings that get synced between Zotero installations
CREATE TABLE syncedSettings (
    setting TEXT NOT NULL,
    libraryID INT NOT NULL,
    value NOT NULL,
    version INT NOT NULL DEFAULT 0,
    synced INT NOT NULL DEFAULT 0,
    PRIMARY KEY (setting, libraryID)
);

-- The foundational table; every item collected has a unique record here
CREATE TABLE items (
    itemID INTEGER PRIMARY KEY,
    itemTypeID INT NOT NULL,
    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    libraryID INT,
    key TEXT NOT NULL,
    UNIQUE (libraryID, key),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID)
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
CREATE INDEX itemData_fieldID ON itemData(fieldID);

-- Note data for note and attachment items
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
    syncState INT DEFAULT 0,
    storageModTime INT,
    storageHash TEXT,
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (sourceItemID) REFERENCES items(itemID)
);
CREATE INDEX itemAttachments_sourceItemID ON itemAttachments(sourceItemID);
CREATE INDEX itemAttachments_mimeType ON itemAttachments(mimeType);
CREATE INDEX itemAttachments_syncState ON itemAttachments(syncState);

CREATE TABLE tags (
    tagID INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE,
    type INT NOT NULL,
    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    libraryID INT,
    key TEXT NOT NULL,
    UNIQUE (libraryID, name, type),
    UNIQUE (libraryID, key)
);

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
    creatorDataID INT NOT NULL,
    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    libraryID INT,
    key TEXT NOT NULL,
    UNIQUE (libraryID, key),
    FOREIGN KEY (creatorDataID) REFERENCES creatorData(creatorDataID)
);
CREATE INDEX creators_creatorDataID ON creators(creatorDataID);

-- Unique creator data, which can be associated with more than one creator
CREATE TABLE creatorData (
    creatorDataID INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    shortName TEXT,
    fieldMode INT,
    birthYear INT
);
CREATE INDEX creatorData_name ON creatorData(lastName, firstName);

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

CREATE TABLE collections (
    collectionID INTEGER PRIMARY KEY,
    collectionName TEXT NOT NULL,
    parentCollectionID INT DEFAULT NULL,
    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    libraryID INT,
    key TEXT NOT NULL,
    UNIQUE (libraryID, key),
    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID)
);

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
    savedSearchName TEXT NOT NULL,
    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    libraryID INT,
    key TEXT NOT NULL,
    UNIQUE (libraryID, key)
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

CREATE TABLE deletedItems (
    itemID INTEGER PRIMARY KEY,
    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX deletedItems_dateDeleted ON deletedItems(dateDeleted);

CREATE TABLE relations (
    libraryID INT NOT NULL,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subject, predicate, object)
);
CREATE INDEX relations_object ON relations(object);

CREATE TABLE libraries (
    libraryID INTEGER PRIMARY KEY,
    libraryType TEXT NOT NULL
);

CREATE TABLE users (
    userID INTEGER PRIMARY KEY,
    username TEXT NOT NULL
);

CREATE TABLE groups (
    groupID INTEGER PRIMARY KEY,
    libraryID INT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    editable INT NOT NULL,
    filesEditable INT NOT NULL,
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID)
);

CREATE TABLE groupItems (
    itemID INTEGER PRIMARY KEY,
    createdByUserID INT NOT NULL,
    lastModifiedByUserID INT NOT NULL,
    FOREIGN KEY (createdByUserID) REFERENCES users(userID),
    FOREIGN KEY (lastModifiedByUserID) REFERENCES users(userID)
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
    libraryID INT NOT NULL,
    key TEXT NOT NULL,
    timestamp INT NOT NULL,
    UNIQUE (syncObjectTypeID, libraryID, key),
    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)
);
CREATE INDEX syncDeleteLog_timestamp ON syncDeleteLog(timestamp);

CREATE TABLE storageDeleteLog (
    libraryID INT,
    key TEXT NOT NULL,
    timestamp INT NOT NULL,
    PRIMARY KEY (libraryID, key)
);
CREATE INDEX storageDeleteLog_timestamp ON storageDeleteLog(timestamp);

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

CREATE TABLE proxies (
    proxyID INTEGER PRIMARY KEY,
    multiHost INT,
    autoAssociate INT,
    scheme TEXT
);

CREATE TABLE proxyHosts (
    hostID INTEGER PRIMARY KEY,
    proxyID INTEGER,
    hostname TEXT,
    FOREIGN KEY (proxyID) REFERENCES proxies(proxyID)
);
CREATE INDEX proxyHosts_proxyID ON proxyHosts(proxyID);


-- These shouldn't be used yet
CREATE TABLE customItemTypes (
    customItemTypeID INTEGER PRIMARY KEY,
    typeName TEXT,
    label TEXT,
    display INT DEFAULT 1, -- 0 == hide, 1 == display, 2 == primary
    icon TEXT
);

CREATE TABLE customFields (
    customFieldID INTEGER PRIMARY KEY,
    fieldName TEXT,
    label TEXT
);

CREATE TABLE customItemTypeFields (
    customItemTypeID INT NOT NULL,
    fieldID INT,
    customFieldID INT,
    hide INT NOT NULL,
    orderIndex INT NOT NULL,
    PRIMARY KEY (customItemTypeID, orderIndex),
    FOREIGN KEY (customItemTypeID) REFERENCES customItemTypes(customItemTypeID),
    FOREIGN KEY (fieldID) REFERENCES fields(fieldID),
    FOREIGN KEY (customFieldID) REFERENCES customFields(customFieldID)
);
CREATE INDEX customItemTypeFields_fieldID ON customItemTypeFields(fieldID);
CREATE INDEX customItemTypeFields_customFieldID ON customItemTypeFields(customFieldID);

CREATE TABLE customBaseFieldMappings (
    customItemTypeID INT,
    baseFieldID INT,
    customFieldID INT,
    PRIMARY KEY (customItemTypeID, baseFieldID, customFieldID),
    FOREIGN KEY (customItemTypeID) REFERENCES customItemTypes(customItemTypeID),
    FOREIGN KEY (baseFieldID) REFERENCES fields(fieldID),
    FOREIGN KEY (customFieldID) REFERENCES customFields(customFieldID)
);
CREATE INDEX customBaseFieldMappings_baseFieldID ON customBaseFieldMappings(baseFieldID);
CREATE INDEX customBaseFieldMappings_customFieldID ON customBaseFieldMappings(customFieldID);

CREATE TABLE translatorCache (
	leafName TEXT PRIMARY KEY,
	translatorJSON TEXT,
	code TEXT,
	lastModifiedTime INT
);