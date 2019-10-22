-- 18

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


-- ";---" is an ugly hack for Zotero.DB.executeSQLFile()

-- Don't allow empty creators
DROP TRIGGER IF EXISTS insert_creatorData;
CREATE TRIGGER insert_creators BEFORE INSERT ON creators
  FOR EACH ROW WHEN NEW.firstName='' AND NEW.lastName=''
  BEGIN
    SELECT RAISE (ABORT, 'Creator names cannot be empty');---
  END;

DROP TRIGGER IF EXISTS update_creatorData;
CREATE TRIGGER update_creators BEFORE UPDATE ON creators
  FOR EACH ROW WHEN NEW.firstName='' AND NEW.lastName=''
  BEGIN
    SELECT RAISE (ABORT, 'Creator names cannot be empty');---
  END;


-- Don't allow collection parents in different libraries
DROP TRIGGER IF EXISTS fki_collections_parentCollectionID_libraryID;
CREATE TRIGGER fki_collections_parentCollectionID_libraryID
  BEFORE INSERT ON collections
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collections" violates foreign key constraint "fki_collections_parentCollectionID_libraryID"')
    WHERE NEW.parentCollectionID IS NOT NULL AND
    NEW.libraryID != (SELECT libraryID FROM collections WHERE collectionID = NEW.parentCollectionID);---
  END;

DROP TRIGGER IF EXISTS fku_collections_parentCollectionID_libraryID;
CREATE TRIGGER fku_collections_parentCollectionID_libraryID
  BEFORE UPDATE ON collections
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collections" violates foreign key constraint "fku_collections_parentCollectionID_libraryID"')
    WHERE NEW.parentCollectionID IS NOT NULL AND
    NEW.libraryID != (SELECT libraryID FROM collections WHERE collectionID = NEW.parentCollectionID);---
  END;


-- collectionItems libraryID
DROP TRIGGER IF EXISTS fki_collectionItems_libraryID;
CREATE TRIGGER fki_collectionItems_libraryID
  BEFORE INSERT ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collectionItems" violates foreign key constraint "fki_collectionItems_libraryID"')
    WHERE (SELECT libraryID FROM collections WHERE collectionID = NEW.collectionID) != (SELECT libraryID FROM items WHERE itemID = NEW.itemID);---
  END;

DROP TRIGGER IF EXISTS fku_collectionItems_libraryID;
CREATE TRIGGER fku_collectionItems_libraryID
  BEFORE UPDATE ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collectionItems" violates foreign key constraint "fku_collectionItems_libraryID"')
    WHERE (SELECT libraryID FROM collections WHERE collectionID = NEW.collectionID) != (SELECT libraryID FROM items WHERE itemID = NEW.itemID);---
  END;


-- Don't allow child items to exist explicitly in collections
DROP TRIGGER IF EXISTS fki_collectionItems_itemID_parentItemID;
CREATE TRIGGER fki_collectionItems_itemID_parentItemID
  BEFORE INSERT ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collectionItems" violates foreign key constraint "fki_collectionItems_itemID_parentItemID"')
    WHERE NEW.itemID IN (SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL UNION SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL);---
  END;

DROP TRIGGER IF EXISTS fku_collectionItems_itemID_parentItemID;
CREATE TRIGGER fku_collectionItems_itemID_parentItemID
  BEFORE UPDATE OF itemID ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collectionItems" violates foreign key constraint "fku_collectionItems_itemID_parentItemID"')
    WHERE NEW.itemID IN (SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL UNION SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL);---
  END;

-- When making a standalone attachment a child, remove from any collections
DROP TRIGGER IF EXISTS fku_itemAttachments_parentItemID_collectionItems_itemID;
CREATE TRIGGER fku_itemAttachments_parentItemID_collectionItems_itemID
  BEFORE UPDATE OF parentItemID ON itemAttachments
  FOR EACH ROW WHEN OLD.parentItemID IS NULL AND NEW.parentItemID IS NOT NULL BEGIN
    DELETE FROM collectionItems WHERE itemID = NEW.itemID;---
  END;

-- When making a standalone note a child, remove from any collections
DROP TRIGGER IF EXISTS fku_itemNotes_parentItemID_collectionItems_itemID;
CREATE TRIGGER fku_itemNotes_parentItemID_collectionItems_itemID
  BEFORE UPDATE OF parentItemID ON itemNotes
  FOR EACH ROW WHEN OLD.parentItemID IS NULL AND NEW.parentItemID IS NOT NULL BEGIN
    DELETE FROM collectionItems WHERE itemID = NEW.itemID;---
  END;

-- Make sure tags aren't empty
DROP TRIGGER IF EXISTS fki_tags;
CREATE TRIGGER fki_tags
BEFORE INSERT ON tags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'Tag cannot be blank')
    WHERE TRIM(NEW.name)='';---
  END;

DROP TRIGGER IF EXISTS fku_tags;
CREATE TRIGGER fku_tags
  BEFORE UPDATE OF name ON tags
  FOR EACH ROW BEGIN
      SELECT RAISE(ABORT, 'Tag cannot be blank')
      WHERE TRIM(NEW.name)='';---
  END;
