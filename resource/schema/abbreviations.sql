-- 1

-- Copyright (c) 2011 Frank G. Bennett, Jr., Faculty of Law, Nagoya University
--                    Nagoya, Japan  http://twitter.com/#!/fgbjr
-- Copyright (c) 2012 Center for History and New Media
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


-- This file creates tables for Zotero abbreviations. Since these abbreviations are loaded
-- into the tables from JSON files, they can be safely updated at any time.

DROP TABLE IF EXISTS lists;
CREATE TABLE lists (
	listID INTEGER PRIMARY KEY AUTOINCREMENT,
	listURI TEXT NOT NULL,
	listName TEXT NOT NULL,
	UNIQUE (listURI)
);
CREATE INDEX lists_listURI ON lists(listURI);

DROP TABLE IF EXISTS jurisdictions;
CREATE TABLE jurisdictions (
	jurisdictionID INTEGER PRIMARY KEY AUTOINCREMENT,
	jurisdiction TEXT NOT NULL,
	UNIQUE (jurisdiction)
);
CREATE INDEX jurisdictions_jurisdiction ON jurisdictions(jurisdiction);
INSERT INTO jurisdictions VALUES(1, 'default');

DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
	categoryID INTEGER PRIMARY KEY,
	category TEXT NOT NULL
);
CREATE INDEX categories_category ON categories(category);

DROP TABLE IF EXISTS abbreviations;
CREATE TABLE abbreviations (
   listID INTEGER NOT NULL,
   jurisdictionID INTEGER,
   categoryID INTEGER NOT NULL,
   string TEXT NOT NULL COLLATE NOCASE,
   abbreviation TEXT NOT NULL,
   PRIMARY KEY (listID, jurisdictionID, categoryID, string),
   FOREIGN KEY(listID) REFERENCES lists(listID),
   FOREIGN KEY(jurisdictionID) REFERENCES jurisdictions(jurisdictionID),
   FOREIGN KEY(categoryID) REFERENCES categories(categoryID)
);

DROP TABLE IF EXISTS phrases;
CREATE TABLE phrases (
   listID INTEGER NOT NULL,
   jurisdictionID INTEGER,
   categoryID INTEGER NOT NULL,
   string TEXT NOT NULL COLLATE NOCASE,
   abbreviation TEXT NOT NULL,
   PRIMARY KEY (listID, jurisdictionID, categoryID, string),
   FOREIGN KEY(listID) REFERENCES lists(listID),
   FOREIGN KEY(jurisdictionID) REFERENCES jurisdictions(jurisdictionID),
   FOREIGN KEY(categoryID) REFERENCES categories(categoryID)
);
CREATE INDEX phrases_listID_categoryID ON phrases(listID, jurisdictionID, categoryID);
CREATE INDEX phrases_string ON phrases(string);

DROP TABLE IF EXISTS version;
CREATE TABLE version (
	version INTEGER NOT NULL
);
INSERT INTO version VALUES (1);