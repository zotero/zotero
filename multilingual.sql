-- 1

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

CREATE TABLE zlsTags (
	tag TEXT PRIMARY KEY,
	nickname TEXT,
	parent TEXT
);
CREATE INDEX zlsTags_nickname ON zlsTags(nickname);
CREATE INDEX zlsTags_parent ON zlsTags(parent);

CREATE TABLE zlsPreferences (
	profile TEXT NOT NULL,
	param TEXT NOT NULL,
	tag TEXT NOT NULL,
	PRIMARY KEY (profile, param, tag)
);
CREATE INDEX zlsPreferences_param ON zlsPreferences(param, profile);

CREATE TABLE itemCreatorsMain (
    itemID INT,
    creatorID INT,
    creatorTypeID INT DEFAULT 1,
    orderIndex INT DEFAULT 0,
	languageTag TEXT,
	PRIMARY KEY (itemID, creatorID, creatorTypeID, orderIndex, languageTag)
);

CREATE TABLE itemCreatorsAlt (
    itemID INT,
    creatorID INT,
    creatorTypeID INT DEFAULT 1,
    orderIndex INT DEFAULT 0,
	languageTag TEXT,
    PRIMARY KEY (itemID, creatorID, creatorTypeID, orderIndex, languageTag),
    FOREIGN KEY (itemID) REFERENCES items(itemID),
    FOREIGN KEY (creatorID) REFERENCES creators(creatorID)
    FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)
);

CREATE TABLE itemDataMain (
    itemID INTEGER,
    fieldID INTEGER,
    languageTag TEXT,
	PRIMARY KEY (itemID, fieldID)
);

CREATE TABLE itemDataAlt (
    itemID INTEGER,
    fieldID INTEGER,
    languageTag TEXT,
    valueID INTEGER,
	PRIMARY KEY (itemID, fieldID, languageTag)
);

CREATE TABLE duplicateCheckList (
    itemID INTEGER PRIMARY KEY,
    checkFields TEXT
);

