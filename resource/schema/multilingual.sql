-- 2

-- This code is used only when migrating to MLZ from an existing
-- Zotero DB, or when creating an MLZ DB from scratch. In the former
-- case the version number ("multilingual") will be bumped down to "1"
-- during install to indicate that hack-field records should be handled.

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

