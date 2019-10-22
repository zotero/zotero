-- 32

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

-- Populated at startup from itemTypes and customItemTypes
DROP TABLE IF EXISTS itemTypesCombined;
CREATE TABLE itemTypesCombined (
    itemTypeID INT NOT NULL,
    typeName TEXT NOT NULL,
    display INT DEFAULT 1 NOT NULL,
    custom INT NOT NULL,
    PRIMARY KEY (itemTypeID)
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
    FOREIGN KEY (fieldFormatID) REFERENCES fieldFormats(fieldFormatID)
);

-- Populated at startup from fields and customFields
DROP TABLE IF EXISTS fieldsCombined;
CREATE TABLE fieldsCombined (
    fieldID INT NOT NULL,
    fieldName TEXT NOT NULL,
    label TEXT,
    fieldFormatID INT,
    custom INT NOT NULL,
    PRIMARY KEY (fieldID)
);

-- Defines valid fields for each itemType, their display order, and their default visibility
DROP TABLE IF EXISTS itemTypeFields;
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
DROP TABLE IF EXISTS itemTypeFieldsCombined;
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
DROP TABLE IF EXISTS baseFieldMappings;
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
DROP TABLE IF EXISTS baseFieldMappingsCombined;
CREATE TABLE baseFieldMappingsCombined (
    itemTypeID INT,
    baseFieldID INT,
    fieldID INT,
    PRIMARY KEY (itemTypeID, baseFieldID, fieldID)
);
CREATE INDEX baseFieldMappingsCombined_baseFieldID ON baseFieldMappingsCombined(baseFieldID);
CREATE INDEX baseFieldMappingsCombined_fieldID ON baseFieldMappingsCombined(fieldID);

DROP TABLE IF EXISTS charsets;
CREATE TABLE charsets (
    charsetID INTEGER PRIMARY KEY,
    charset TEXT UNIQUE
);
CREATE INDEX charsets_charset ON charsets(charset);

DROP TABLE IF EXISTS fileTypes;
CREATE TABLE fileTypes (
    fileTypeID INTEGER PRIMARY KEY,
    fileType TEXT UNIQUE
);
CREATE INDEX fileTypes_fileType ON fileTypes(fileType);

DROP TABLE IF EXISTS fileTypeMimeTypes;
CREATE TABLE fileTypeMimeTypes (
    fileTypeID INT,
    mimeType TEXT,
    PRIMARY KEY (fileTypeID, mimeType),
    FOREIGN KEY (fileTypeID) REFERENCES fileTypes(fileTypeID)
);
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
CREATE INDEX itemTypeCreatorTypes_creatorTypeID ON itemTypeCreatorTypes(creatorTypeID);

DROP TABLE IF EXISTS syncObjectTypes;
CREATE TABLE syncObjectTypes (
    syncObjectTypeID INTEGER PRIMARY KEY,
    name TEXT
);
CREATE INDEX syncObjectTypes_name ON syncObjectTypes(name);

-- unused
INSERT INTO "fieldFormats" VALUES(1, '.*', 0);
INSERT INTO "fieldFormats" VALUES(2, '[0-9]*', 1);
INSERT INTO "fieldFormats" VALUES(3, '[0-9]{4}', 1);

INSERT INTO "charsets" VALUES (1, "utf-8");
INSERT INTO "charsets" VALUES (2, "big5");
INSERT INTO "charsets" VALUES (3, "euc-jp");
INSERT INTO "charsets" VALUES (4, "euc-kr");
INSERT INTO "charsets" VALUES (5, "gb18030");
INSERT INTO "charsets" VALUES (6, "gbk");
INSERT INTO "charsets" VALUES (7, "ibm866");
INSERT INTO "charsets" VALUES (8, "iso-2022-jp");
INSERT INTO "charsets" VALUES (9, "iso-8859-2");
INSERT INTO "charsets" VALUES (10, "iso-8859-3");
INSERT INTO "charsets" VALUES (11, "iso-8859-4");
INSERT INTO "charsets" VALUES (12, "iso-8859-5");
INSERT INTO "charsets" VALUES (13, "iso-8859-6");
INSERT INTO "charsets" VALUES (14, "iso-8859-7");
INSERT INTO "charsets" VALUES (15, "iso-8859-8");
INSERT INTO "charsets" VALUES (16, "iso-8859-8-i");
INSERT INTO "charsets" VALUES (17, "iso-8859-10");
INSERT INTO "charsets" VALUES (18, "iso-8859-13");
INSERT INTO "charsets" VALUES (19, "iso-8859-14");
INSERT INTO "charsets" VALUES (20, "iso-8859-15");
INSERT INTO "charsets" VALUES (21, "iso-8859-16");
INSERT INTO "charsets" VALUES (22, "koi8-r");
INSERT INTO "charsets" VALUES (23, "koi8-u");
INSERT INTO "charsets" VALUES (24, "macintosh");
INSERT INTO "charsets" VALUES (25, "replacement");
INSERT INTO "charsets" VALUES (26, "shift_jis");
INSERT INTO "charsets" VALUES (27, "utf-16be");
INSERT INTO "charsets" VALUES (28, "utf-16le");
INSERT INTO "charsets" VALUES (29, "windows-874");
INSERT INTO "charsets" VALUES (30, "windows-1250");
INSERT INTO "charsets" VALUES (31, "windows-1251");
INSERT INTO "charsets" VALUES (32, "windows-1252");
INSERT INTO "charsets" VALUES (33, "windows-1253");
INSERT INTO "charsets" VALUES (34, "windows-1254");
INSERT INTO "charsets" VALUES (35, "windows-1255");
INSERT INTO "charsets" VALUES (36, "windows-1256");
INSERT INTO "charsets" VALUES (37, "windows-1257");
INSERT INTO "charsets" VALUES (38, "windows-1258");
INSERT INTO "charsets" VALUES (39, "x-mac-cyrillic");
INSERT INTO "charsets" VALUES (40, "x-user-defined");

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
INSERT INTO "fileTypeMIMETypes" VALUES(7, 'application/vnd.ms-powerpoint');

INSERT INTO "syncObjectTypes" VALUES(1, 'collection');
INSERT INTO "syncObjectTypes" VALUES(2, 'creator');
INSERT INTO "syncObjectTypes" VALUES(3, 'item');
INSERT INTO "syncObjectTypes" VALUES(4, 'search');
INSERT INTO "syncObjectTypes" VALUES(5, 'tag');
INSERT INTO "syncObjectTypes" VALUES(6, 'relation');
INSERT INTO "syncObjectTypes" VALUES(7, 'setting');
