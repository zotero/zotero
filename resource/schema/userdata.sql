-- 123

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

--
-- Tables populated by global schema
--

-- Valid item types ("book," "journalArticle," etc.)
CREATE TABLE itemTypes (
    itemTypeID INTEGER PRIMARY KEY,
    typeName TEXT,
    templateItemTypeID INT,
    display INT DEFAULT 1 -- 0 == hide, 1 == display, 2 == primary
);

-- Populated at startup from itemTypes and customItemTypes
CREATE TABLE itemTypesCombined (
    itemTypeID INT NOT NULL,
    typeName TEXT NOT NULL,
    display INT DEFAULT 1 NOT NULL,
    custom INT NOT NULL,
    PRIMARY KEY (itemTypeID)
);

-- Field types for item metadata
CREATE TABLE fields (
    fieldID INTEGER PRIMARY KEY,
    fieldName TEXT,
    fieldFormatID INT,
    FOREIGN KEY (fieldFormatID) REFERENCES fieldFormats(fieldFormatID)
);

-- Populated at startup from fields and customFields
CREATE TABLE fieldsCombined (
    fieldID INT NOT NULL,
    fieldName TEXT NOT NULL,
    label TEXT,
    fieldFormatID INT,
    custom INT NOT NULL,
    PRIMARY KEY (fieldID)
);

-- Defines valid fields for each itemType, their display order, and their default visibility
CREATE TABLE itemTypeFields (
    itemTypeID INT,
    fieldID INT,
    hide INT,
    orderIndex INT,
    PRIMARY KEY (itemTypeID, orderIndex),
    UNIQUE (itemTypeID, fieldID),
    FOREIGN KEY (itemTypeID) REFERENCES itemTypes(itemTypeID),
    FOREIGN KEY (fieldID) REFERENCES fields(fieldID)
);
CREATE INDEX itemTypeFields_fieldID ON itemTypeFields(fieldID);

-- Populated at startup from itemTypeFields and customItemTypeFields
CREATE TABLE itemTypeFieldsCombined (
    itemTypeID INT NOT NULL,
    fieldID INT NOT NULL,
    hide INT,
    orderIndex INT NOT NULL,
    PRIMARY KEY (itemTypeID, orderIndex),
    UNIQUE (itemTypeID, fieldID)
);
CREATE INDEX itemTypeFieldsCombined_fieldID ON itemTypeFieldsCombined(fieldID);

-- Maps base fields to type-specific fields (e.g. publisher to label in audioRecording)
CREATE TABLE baseFieldMappings (
    itemTypeID INT,
    baseFieldID INT,
    fieldID INT,
    PRIMARY KEY (itemTypeID, baseFieldID, fieldID),
    FOREIGN KEY (itemTypeID) REFERENCES itemTypes(itemTypeID),
    FOREIGN KEY (baseFieldID) REFERENCES fields(fieldID),
    FOREIGN KEY (fieldID) REFERENCES fields(fieldID)
);
CREATE INDEX baseFieldMappings_baseFieldID ON baseFieldMappings(baseFieldID);
CREATE INDEX baseFieldMappings_fieldID ON baseFieldMappings(fieldID);

-- Populated at startup from baseFieldMappings and customBaseFieldMappings
CREATE TABLE baseFieldMappingsCombined (
    itemTypeID INT,
    baseFieldID INT,
    fieldID INT,
    PRIMARY KEY (itemTypeID, baseFieldID, fieldID)
);
CREATE INDEX baseFieldMappingsCombined_baseFieldID ON baseFieldMappingsCombined(baseFieldID);
CREATE INDEX baseFieldMappingsCombined_fieldID ON baseFieldMappingsCombined(fieldID);

-- Defines the possible creator types (contributor, editor, author)
CREATE TABLE creatorTypes (
    creatorTypeID INTEGER PRIMARY KEY,
    creatorType TEXT
);

CREATE TABLE itemTypeCreatorTypes (
    itemTypeID INT,
    creatorTypeID INT,
    primaryField INT,
    PRIMARY KEY (itemTypeID, creatorTypeID),
    FOREIGN KEY (itemTypeID) REFERENCES itemTypes(itemTypeID),
    FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)
);
CREATE INDEX itemTypeCreatorTypes_creatorTypeID ON itemTypeCreatorTypes(creatorTypeID);

--
-- End of tables populated by global schema
--

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
    PRIMARY KEY (setting, libraryID),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE
);

-- Primary data applicable to all items
CREATE TABLE items (
    itemID INTEGER PRIMARY KEY,
    itemTypeID INT NOT NULL,
    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    libraryID INT NOT NULL,
    key TEXT NOT NULL,
    version INT NOT NULL DEFAULT 0,
    synced INT NOT NULL DEFAULT 0,
    UNIQUE (libraryID, key),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE
);
CREATE INDEX items_synced ON items(synced);

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
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (fieldID) REFERENCES fieldsCombined(fieldID),
    FOREIGN KEY (valueID) REFERENCES itemDataValues(valueID)
);
CREATE INDEX itemData_fieldID ON itemData(fieldID);
CREATE INDEX itemData_valueID ON itemData(valueID);

-- Note data for note and attachment items
CREATE TABLE itemNotes (
    itemID INTEGER PRIMARY KEY,
    parentItemID INT,
    note TEXT,
    title TEXT,
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (parentItemID) REFERENCES items(itemID) ON DELETE CASCADE
);
CREATE INDEX itemNotes_parentItemID ON itemNotes(parentItemID);

-- Metadata for attachment items
CREATE TABLE itemAttachments (
    itemID INTEGER PRIMARY KEY,
    parentItemID INT,
    linkMode INT,
    contentType TEXT,
    charsetID INT,
    path TEXT,
    syncState INT DEFAULT 0,
    storageModTime INT,
    storageHash TEXT,
    lastProcessedModificationTime INT,
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (parentItemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (charsetID) REFERENCES charsets(charsetID) ON DELETE SET NULL
);
CREATE INDEX itemAttachments_parentItemID ON itemAttachments(parentItemID);
CREATE INDEX itemAttachments_charsetID ON itemAttachments(charsetID);
CREATE INDEX itemAttachments_contentType ON itemAttachments(contentType);
CREATE INDEX itemAttachments_syncState ON itemAttachments(syncState);
CREATE INDEX itemAttachments_lastProcessedModificationTime ON itemAttachments(lastProcessedModificationTime);

CREATE TABLE itemAnnotations (
    itemID INTEGER PRIMARY KEY,
    parentItemID INT NOT NULL,
    type INTEGER NOT NULL,
    authorName TEXT,
    text TEXT,
    comment TEXT,
    color TEXT,
    pageLabel TEXT,
    sortIndex TEXT NOT NULL,
    position TEXT NOT NULL,
    isExternal INT NOT NULL,
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (parentItemID) REFERENCES itemAttachments(itemID)
);
CREATE INDEX itemAnnotations_parentItemID ON itemAnnotations(parentItemID);

CREATE TABLE tags (
    tagID INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE itemRelations (
    itemID INT NOT NULL,
    predicateID INT NOT NULL,
    object TEXT NOT NULL,
    PRIMARY KEY (itemID, predicateID, object),
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (predicateID) REFERENCES relationPredicates(predicateID) ON DELETE CASCADE
);
CREATE INDEX itemRelations_predicateID ON itemRelations(predicateID);
CREATE INDEX itemRelations_object ON itemRelations(object);

CREATE TABLE itemTags (
    itemID INT NOT NULL,
    tagID INT NOT NULL,
    type INT NOT NULL,
    PRIMARY KEY (itemID, tagID),
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (tagID) REFERENCES tags(tagID) ON DELETE CASCADE
);
CREATE INDEX itemTags_tagID ON itemTags(tagID);

CREATE TABLE creators (
    creatorID INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    fieldMode INT,
    UNIQUE (lastName, firstName, fieldMode)
);

CREATE TABLE itemCreators (
    itemID INT NOT NULL,
    creatorID INT NOT NULL,
    creatorTypeID INT NOT NULL DEFAULT 1,
    orderIndex INT NOT NULL DEFAULT 0,
    PRIMARY KEY (itemID, creatorID, creatorTypeID, orderIndex),
    UNIQUE (itemID, orderIndex),
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (creatorID) REFERENCES creators(creatorID) ON DELETE CASCADE,
    FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)
);
CREATE INDEX itemCreators_creatorTypeID ON itemCreators(creatorTypeID);

CREATE TABLE collections (
    collectionID INTEGER PRIMARY KEY,
    collectionName TEXT NOT NULL,
    parentCollectionID INT DEFAULT NULL,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    libraryID INT NOT NULL,
    key TEXT NOT NULL,
    version INT NOT NULL DEFAULT 0,
    synced INT NOT NULL DEFAULT 0,
    UNIQUE (libraryID, key),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,
    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID) ON DELETE CASCADE
);
CREATE INDEX collections_synced ON collections(synced);

CREATE TABLE collectionItems (
    collectionID INT NOT NULL,
    itemID INT NOT NULL,
    orderIndex INT NOT NULL DEFAULT 0,
    PRIMARY KEY (collectionID, itemID),
    FOREIGN KEY (collectionID) REFERENCES collections(collectionID) ON DELETE CASCADE,
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE
);
CREATE INDEX collectionItems_itemID ON collectionItems(itemID);

CREATE TABLE collectionRelations (
    collectionID INT NOT NULL,
    predicateID INT NOT NULL,
    object TEXT NOT NULL,
    PRIMARY KEY (collectionID, predicateID, object),
    FOREIGN KEY (collectionID) REFERENCES collections(collectionID) ON DELETE CASCADE,
    FOREIGN KEY (predicateID) REFERENCES relationPredicates(predicateID) ON DELETE CASCADE
);
CREATE INDEX collectionRelations_predicateID ON collectionRelations(predicateID);
CREATE INDEX collectionRelations_object ON collectionRelations(object);

CREATE TABLE feeds (
    libraryID INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    lastUpdate TIMESTAMP,
    lastCheck TIMESTAMP,
    lastCheckError TEXT,
    cleanupReadAfter INT,
    cleanupUnreadAfter INT,
    refreshInterval INT,
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE
);

CREATE TABLE feedItems (
    itemID INTEGER PRIMARY KEY,
    guid TEXT NOT NULL UNIQUE,
    readTime TIMESTAMP,
    translatedTime TIMESTAMP,
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE
);

CREATE TABLE savedSearches (
    savedSearchID INTEGER PRIMARY KEY,
    savedSearchName TEXT NOT NULL,
    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    libraryID INT NOT NULL,
    key TEXT NOT NULL,
    version INT NOT NULL DEFAULT 0,
    synced INT NOT NULL DEFAULT 0,
    UNIQUE (libraryID, key),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE
);
CREATE INDEX savedSearches_synced ON savedSearches(synced);

CREATE TABLE savedSearchConditions (
    savedSearchID INT NOT NULL,
    searchConditionID INT NOT NULL,
    condition TEXT NOT NULL,
    operator TEXT,
    value TEXT,
    required NONE,
    PRIMARY KEY (savedSearchID, searchConditionID),
    FOREIGN KEY (savedSearchID) REFERENCES savedSearches(savedSearchID) ON DELETE CASCADE
);

CREATE TABLE deletedCollections (
    collectionID INTEGER PRIMARY KEY,
    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (collectionID) REFERENCES collections(collectionID) ON DELETE CASCADE
);
CREATE INDEX deletedCollections_dateDeleted ON deletedCollections(dateDeleted);

CREATE TABLE deletedItems (
    itemID INTEGER PRIMARY KEY,
    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE
);
CREATE INDEX deletedItems_dateDeleted ON deletedItems(dateDeleted);

CREATE TABLE deletedSearches (
    savedSearchID INTEGER PRIMARY KEY,
    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (savedSearchID) REFERENCES savedSearches(savedSearchID) ON DELETE CASCADE
);
CREATE INDEX deletedSearches_dateDeleted ON deletedItems(dateDeleted);

CREATE TABLE libraries (
    libraryID INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    editable INT NOT NULL,
    filesEditable INT NOT NULL,
    version INT NOT NULL DEFAULT 0,
    storageVersion INT NOT NULL DEFAULT 0,
    lastSync INT NOT NULL DEFAULT 0,
    archived INT NOT NULL DEFAULT 0
);

CREATE TABLE users (
    userID INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE groups (
    groupID INTEGER PRIMARY KEY,
    libraryID INT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    version INT NOT NULL,
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE
);

CREATE TABLE groupItems (
    itemID INTEGER PRIMARY KEY,
    createdByUserID INT,
    lastModifiedByUserID INT,
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,
    FOREIGN KEY (createdByUserID) REFERENCES users(userID) ON DELETE SET NULL,
    FOREIGN KEY (lastModifiedByUserID) REFERENCES users(userID) ON DELETE SET NULL
);

CREATE TABLE publicationsItems (
    itemID INTEGER PRIMARY KEY
);

CREATE TABLE retractedItems (
	itemID INTEGER PRIMARY KEY,
	data TEXT,
	flag INT DEFAULT 0,
	FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE
);

CREATE TABLE fulltextItems (
    itemID INTEGER PRIMARY KEY,
    indexedPages INT,
    totalPages INT,
    indexedChars INT,
    totalChars INT,
    version INT NOT NULL DEFAULT 0,
    synced INT NOT NULL DEFAULT 0,
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE
);
CREATE INDEX fulltextItems_synced ON fulltextItems(synced);
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
    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE
);
CREATE INDEX fulltextItemWords_itemID ON fulltextItemWords(itemID);

CREATE TABLE syncCache (
    libraryID INT NOT NULL,
    key TEXT NOT NULL,
    syncObjectTypeID INT NOT NULL,
    version INT NOT NULL,
    data TEXT,
    PRIMARY KEY (libraryID, key, syncObjectTypeID, version),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,
    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)
);

CREATE TABLE syncDeleteLog (
    syncObjectTypeID INT NOT NULL,
    libraryID INT NOT NULL,
    key TEXT NOT NULL,
    dateDeleted TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (syncObjectTypeID, libraryID, key),
    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE
);

CREATE TABLE syncQueue (
    libraryID INT NOT NULL,
    key TEXT NOT NULL,
    syncObjectTypeID INT NOT NULL,
    lastCheck TIMESTAMP,
    tries INT,
    PRIMARY KEY (libraryID, key, syncObjectTypeID),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,
    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID) ON DELETE CASCADE
);

CREATE TABLE storageDeleteLog (
    libraryID INT NOT NULL,
    key TEXT NOT NULL,
    dateDeleted TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (libraryID, key),
    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE
);

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

CREATE TABLE relationPredicates (
    predicateID INTEGER PRIMARY KEY,
    predicate TEXT UNIQUE
);

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
    fileName TEXT PRIMARY KEY,
    metadataJSON TEXT,
    lastModifiedTime INT
);

CREATE TABLE dbDebug1 (
    a INTEGER PRIMARY KEY
);
