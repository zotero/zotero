-- 17

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


-- Triggers to validate date field
DROP TRIGGER IF EXISTS insert_date_field;
CREATE TRIGGER insert_date_field BEFORE INSERT ON itemData
  FOR EACH ROW WHEN NEW.fieldID IN (14, 27, 52, 96, 100)
  BEGIN
    SELECT CASE
        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 1, 4) AS INT) BETWEEN 0 AND 9999 AND
        SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 5, 1) = '-' AND
        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 6, 2) AS INT) BETWEEN 0 AND 12 AND
        SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 8, 1) = '-' AND
        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 9, 2) AS INT) BETWEEN 0 AND 31
      WHEN 0 THEN RAISE (ABORT, 'Date field must begin with SQL date') END;
  END;

DROP TRIGGER IF EXISTS update_date_field;
CREATE TRIGGER update_date_field BEFORE UPDATE ON itemData
  FOR EACH ROW WHEN NEW.fieldID IN (14, 27, 52, 96, 100)
  BEGIN
    SELECT CASE
        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 1, 4) AS INT) BETWEEN 0 AND 9999 AND
        SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 5, 1) = '-' AND
        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 6, 2) AS INT) BETWEEN 0 AND 12 AND
        SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 8, 1) = '-' AND
        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 9, 2) AS INT) BETWEEN 0 AND 31
      WHEN 0 THEN RAISE (ABORT, 'Date field must begin with SQL date') END;
  END;


-- Don't allow empty creators
DROP TRIGGER IF EXISTS insert_creatorData;
CREATE TRIGGER insert_creatorData BEFORE INSERT ON creatorData
  FOR EACH ROW WHEN NEW.firstName='' AND NEW.lastName=''
  BEGIN
    SELECT RAISE (ABORT, 'Creator names cannot be empty');
  END;

DROP TRIGGER IF EXISTS update_creatorData;
CREATE TRIGGER update_creatorData BEFORE UPDATE ON creatorData
  FOR EACH ROW WHEN NEW.firstName='' AND NEW.lastName=''
  BEGIN
    SELECT RAISE (ABORT, 'Creator names cannot be empty');
  END;


--
-- Fake foreign key constraint checks using triggers
--

-- annotations/itemID
DROP TRIGGER IF EXISTS fki_annotations_itemID_itemAttachments_itemID;
CREATE TRIGGER fki_annotations_itemID_itemAttachments_itemID
  BEFORE INSERT ON annotations
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "annotations" violates foreign key constraint "fki_annotations_itemID_itemAttachments_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM itemAttachments WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_annotations_itemID_itemAttachments_itemID;
CREATE TRIGGER fku_annotations_itemID_itemAttachments_itemID
  BEFORE UPDATE OF itemID ON annotations
  FOR EACH ROW
  BEGIN
    SELECT RAISE(ABORT, 'update on table "annotations" violates foreign key constraint "fku_annotations_itemID_itemAttachments_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM itemAttachments WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_annotations_itemID_itemAttachments_itemID;
CREATE TRIGGER fkd_annotations_itemID_itemAttachments_itemID
  BEFORE DELETE ON itemAttachments
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "itemAttachments" violates foreign key constraint "fkd_annotations_itemID_itemAttachments_itemID"')
    WHERE (SELECT COUNT(*) FROM annotations WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_annotations_itemID;
CREATE TRIGGER fku_itemAttachments_itemID_annotations_itemID
  AFTER UPDATE OF itemID ON itemAttachments
  FOR EACH ROW BEGIN
    UPDATE annotations SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;

-- collections/parentCollectionID
DROP TRIGGER IF EXISTS fki_collections_parentCollectionID_collections_collectionID;
CREATE TRIGGER fki_collections_parentCollectionID_collections_collectionID
  BEFORE INSERT ON collections
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collections" violates foreign key constraint "fki_collections_parentCollectionID_collections_collectionID"')
    WHERE NEW.parentCollectionID IS NOT NULL AND (SELECT COUNT(*) FROM collections WHERE collectionID = NEW.parentCollectionID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_collections_parentCollectionID_collections_collectionID;
CREATE TRIGGER fku_collections_parentCollectionID_collections_collectionID
  BEFORE UPDATE OF parentCollectionID ON collections
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collections" violates foreign key constraint "fku_collections_parentCollectionID_collections_collectionID"')
    WHERE NEW.parentCollectionID IS NOT NULL AND (SELECT COUNT(*) FROM collections WHERE collectionID = NEW.parentCollectionID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_collections_parentCollectionID_collections_collectionID;
CREATE TRIGGER fkd_collections_parentCollectionID_collections_collectionID
  BEFORE DELETE ON collections
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "collections" violates foreign key constraint "fkd_collections_parentCollectionID_collections_collectionID"')
    WHERE (SELECT COUNT(*) FROM collections WHERE parentCollectionID = OLD.collectionID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_collections_collectionID_collections_parentCollectionID;
CREATE TRIGGER fku_collections_collectionID_collections_parentCollectionID
  AFTER UPDATE OF collectionID ON collections
  FOR EACH ROW BEGIN
    UPDATE collections SET parentCollectionID=NEW.collectionID WHERE parentCollectionID=OLD.collectionID;
  END;

-- Don't allow collection parents in different libraries
DROP TRIGGER IF EXISTS fki_collections_parentCollectionID_libraryID;
CREATE TRIGGER fki_collections_parentCollectionID_libraryID
  BEFORE INSERT ON collections
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collections" violates foreign key constraint "fki_collections_parentCollectionID_libraryID"')
    WHERE NEW.parentCollectionID IS NOT NULL AND
    (
        (
            NEW.libraryID IS NULL
                AND
            (SELECT libraryID FROM collections WHERE collectionID = NEW.parentCollectionID) IS NOT NULL
        ) OR (
            NEW.libraryID IS NOT NULL
                AND
            (SELECT libraryID FROM collections WHERE collectionID = NEW.parentCollectionID) IS NULL
        ) OR
        NEW.libraryID != (SELECT libraryID FROM collections WHERE collectionID = NEW.parentCollectionID)
    );
  END;

DROP TRIGGER IF EXISTS fku_collections_parentCollectionID_libraryID;
CREATE TRIGGER fku_collections_parentCollectionID_libraryID
  BEFORE UPDATE ON collections
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collections" violates foreign key constraint "fku_collections_parentCollectionID_libraryID"')
    WHERE NEW.parentCollectionID IS NOT NULL AND
    (
        (
            NEW.libraryID IS NULL
                AND
            (SELECT libraryID FROM collections WHERE collectionID = NEW.parentCollectionID) IS NOT NULL
        ) OR (
            NEW.libraryID IS NOT NULL
                AND
            (SELECT libraryID FROM collections WHERE collectionID = NEW.parentCollectionID) IS NULL
        ) OR
        NEW.libraryID != (SELECT libraryID FROM collections WHERE collectionID = NEW.parentCollectionID)
    );
  END;

-- collectionItems/collectionID
DROP TRIGGER IF EXISTS fki_collectionItems_collectionID_collections_collectionID;
CREATE TRIGGER fki_collectionItems_collectionID_collections_collectionID
  BEFORE INSERT ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collectionItems" violates foreign key constraint "fki_collectionItems_collectionID_collections_collectionID"')
    WHERE NEW.collectionID IS NOT NULL AND (SELECT COUNT(*) FROM collections WHERE collectionID = NEW.collectionID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_collectionItems_collectionID_collections_collectionID;
CREATE TRIGGER fku_collectionItems_collectionID_collections_collectionID
  BEFORE UPDATE OF collectionID ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collectionItems" violates foreign key constraint "fku_collectionItems_collectionID_collections_collectionID"')
    WHERE NEW.collectionID IS NOT NULL AND (SELECT COUNT(*) FROM collections WHERE collectionID = NEW.collectionID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_collectionItems_collectionID_collections_collectionID;
CREATE TRIGGER fkd_collectionItems_collectionID_collections_collectionID
  BEFORE DELETE ON collections
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "collections" violates foreign key constraint "fkd_collectionItems_collectionID_collections_collectionID"')
    WHERE (SELECT COUNT(*) FROM collectionItems WHERE collectionID = OLD.collectionID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_collections_collectionID_collectionItems_collectionID;
CREATE TRIGGER fku_collections_collectionID_collectionItems_collectionID
  AFTER UPDATE OF collectionID ON collections
  FOR EACH ROW BEGIN
    UPDATE collectionItems SET collectionID=NEW.collectionID WHERE collectionID=OLD.collectionID;
  END;

-- collectionItems/itemID
DROP TRIGGER IF EXISTS fki_collectionItems_itemID_items_itemID;
CREATE TRIGGER fki_collectionItems_itemID_items_itemID
  BEFORE INSERT ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collectionItems" violates foreign key constraint "fki_collectionItems_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_collectionItems_itemID_items_itemID;
CREATE TRIGGER fku_collectionItems_itemID_items_itemID
  BEFORE UPDATE OF itemID ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collectionItems" violates foreign key constraint "fku_collectionItems_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_collectionItems_itemID_items_itemID;
CREATE TRIGGER fkd_collectionItems_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_collectionItems_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM collectionItems WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_collectionItems_itemID;
CREATE TRIGGER fku_items_itemID_collectionItems_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE collectionItems SET collectionID=NEW.itemID WHERE collectionID=OLD.itemID;
  END;

-- collectionItems libraryID
DROP TRIGGER IF EXISTS fki_collectionItems_libraryID;
CREATE TRIGGER fki_collectionItems_libraryID
  BEFORE INSERT ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collectionItems" violates foreign key constraint "fki_collectionItems_libraryID"')
    WHERE (
        (SELECT libraryID FROM collections WHERE collectionID = NEW.collectionID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM collections WHERE collectionID = NEW.collectionID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
    ) OR
        (SELECT libraryID FROM collections WHERE collectionID = NEW.collectionID) != (SELECT libraryID FROM items WHERE itemID = NEW.itemID);
  END;

DROP TRIGGER IF EXISTS fku_collectionItems_libraryID;
CREATE TRIGGER fku_collectionItems_libraryID
  BEFORE UPDATE ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collectionItems" violates foreign key constraint "fku_collectionItems_libraryID"')
    WHERE (
        (SELECT libraryID FROM collections WHERE collectionID = NEW.collectionID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM collections WHERE collectionID = NEW.collectionID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
    ) OR
        (SELECT libraryID FROM collections WHERE collectionID = NEW.collectionID) != (SELECT libraryID FROM items WHERE itemID = NEW.itemID);
  END;


-- Don't allow child items to exist explicitly in collections
DROP TRIGGER IF EXISTS fki_collectionItems_itemID_sourceItemID;
CREATE TRIGGER fki_collectionItems_itemID_sourceItemID
  BEFORE INSERT ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "collectionItems" violates foreign key constraint "fki_collectionItems_itemID_sourceItemID"')
    WHERE NEW.itemID IN (SELECT itemID FROM itemAttachments WHERE sourceItemID IS NOT NULL UNION SELECT itemID FROM itemNotes WHERE sourceItemID IS NOT NULL);
  END;

DROP TRIGGER IF EXISTS fku_collectionItems_itemID_sourceItemID;
CREATE TRIGGER fku_collectionItems_itemID_sourceItemID
  BEFORE UPDATE OF itemID ON collectionItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "collectionItems" violates foreign key constraint "fku_collectionItems_itemID_sourceItemID"')
    WHERE NEW.itemID IN (SELECT itemID FROM itemAttachments WHERE sourceItemID IS NOT NULL UNION SELECT itemID FROM itemNotes WHERE sourceItemID IS NOT NULL);
  END;

-- When making a standalone attachment a child, remove from any collections
DROP TRIGGER IF EXISTS fku_itemAttachments_sourceItemID_collectionItems_itemID;
CREATE TRIGGER fku_itemAttachments_sourceItemID_collectionItems_itemID
  BEFORE UPDATE OF sourceItemID ON itemAttachments
  FOR EACH ROW WHEN OLD.sourceItemID IS NULL AND NEW.sourceItemID IS NOT NULL BEGIN
    DELETE FROM collectionItems WHERE itemID = NEW.itemID;
  END;

-- When making a standalone note a child, remove from any collections
DROP TRIGGER IF EXISTS fku_itemNotes_sourceItemID_collectionItems_itemID;
CREATE TRIGGER fku_itemNotes_sourceItemID_collectionItems_itemID
  BEFORE UPDATE OF sourceItemID ON itemNotes
  FOR EACH ROW WHEN OLD.sourceItemID IS NULL AND NEW.sourceItemID IS NOT NULL BEGIN
    DELETE FROM collectionItems WHERE itemID = NEW.itemID;
  END;


-- creators/creatorDataID
DROP TRIGGER IF EXISTS fki_creators_creatorDataID_creatorData_creatorDataID;
CREATE TRIGGER fki_creators_creatorDataID_creatorData_creatorDataID
  BEFORE INSERT ON creators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "creators" violates foreign key constraint "fki_creators_creatorDataID_creatorData_creatorDataID"')
    WHERE NEW.creatorDataID IS NOT NULL AND (SELECT COUNT(*) FROM creatorData WHERE creatorDataID = NEW.creatorDataID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_creators_creatorDataID_creatorData_creatorDataID;
CREATE TRIGGER fku_creators_creatorDataID_creatorData_creatorDataID
  BEFORE UPDATE OF creatorDataID ON creators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "creators" violates foreign key constraint "fku_creators_creatorDataID_creatorData_creatorDataID"')
    WHERE NEW.creatorDataID IS NOT NULL AND (SELECT COUNT(*) FROM creatorData WHERE creatorDataID = NEW.creatorDataID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_creators_creatorDataID_creatorData_creatorDataID;
CREATE TRIGGER fkd_creators_creatorDataID_creatorData_creatorDataID
  BEFORE DELETE ON creatorData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "creatorData" violates foreign key constraint "fkd_creators_creatorDataID_creatorData_creatorDataID"')
    WHERE (SELECT COUNT(*) FROM creators WHERE creatorDataID = OLD.creatorDataID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_creatorData_creatorDataID_creators_creatorDataID;
CREATE TRIGGER fku_creatorData_creatorDataID_creators_creatorDataID
  BEFORE UPDATE OF creatorDataID ON creatorData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "creatorData" violates foreign key constraint "fku_creatorData_creatorDataID_creators_creatorDataID"')
    WHERE (SELECT COUNT(*) FROM creators WHERE creatorDataID = OLD.creatorDataID) > 0;
  END;


-- customBaseFieldMappings/customItemTypeID
DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID;
CREATE TRIGGER fki_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID
  BEFORE INSERT ON customBaseFieldMappings
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "customBaseFieldMappings" violates foreign key constraint "fki_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID"')
    WHERE NEW.customItemTypeID IS NOT NULL AND (SELECT COUNT(*) FROM customItemTypes WHERE customItemTypeID = NEW.customItemTypeID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID;
CREATE TRIGGER fku_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID
  BEFORE UPDATE OF customItemTypeID ON customBaseFieldMappings
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "customBaseFieldMappings" violates foreign key constraint "fku_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID"')
    WHERE NEW.customItemTypeID IS NOT NULL AND (SELECT COUNT(*) FROM customItemTypes WHERE customItemTypeID = NEW.customItemTypeID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID;
CREATE TRIGGER fkd_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID
  BEFORE DELETE ON customItemTypes
  FOR EACH ROW BEGIN
    DELETE FROM customBaseFieldMappings WHERE customItemTypeID = OLD.customItemTypeID;
  END;

DROP TRIGGER IF EXISTS fku_customItemTypes_customItemTypeID_customBaseFieldMappings_customItemTypeID;
CREATE TRIGGER fku_customItemTypes_customItemTypeID_customBaseFieldMappings_customItemTypeID
  AFTER UPDATE OF customItemTypeID ON customItemTypes
  FOR EACH ROW BEGIN
    UPDATE customBaseFieldMappings SET customItemTypeID=NEW.customItemTypeID WHERE customItemTypeID=OLD.customItemTypeID;
  END;


-- customBaseFieldMappings/baseFieldID
DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_baseFieldID_fields_fieldID;
CREATE TRIGGER fki_customBaseFieldMappings_baseFieldID_fields_fieldID
  BEFORE INSERT ON customBaseFieldMappings
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "customBaseFieldMappings" violates foreign key constraint "fki_customBaseFieldMappings_baseFieldID_fields_fieldID"')
    WHERE NEW.baseFieldID IS NOT NULL AND (SELECT COUNT(*) FROM fields WHERE fieldID = NEW.baseFieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_baseFieldID_fields_fieldID;
CREATE TRIGGER fku_customBaseFieldMappings_baseFieldID_fields_fieldID
  BEFORE UPDATE OF baseFieldID ON customBaseFieldMappings
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "customBaseFieldMappings" violates foreign key constraint "fku_customBaseFieldMappings_baseFieldID_fields_fieldID"')
    WHERE NEW.baseFieldID IS NOT NULL AND (SELECT COUNT(*) FROM fields WHERE fieldID = NEW.baseFieldID) = 0;
  END;


-- customBaseFieldMappings/customFieldID
DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_customFieldID_customFields_customFieldID;
CREATE TRIGGER fki_customBaseFieldMappings_customFieldID_customFields_customFieldID
  BEFORE INSERT ON customBaseFieldMappings
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "customBaseFieldMappings" violates foreign key constraint "fki_customBaseFieldMappings_customFieldID_customFields_customFieldID"')
    WHERE NEW.customFieldID IS NOT NULL AND (SELECT COUNT(*) FROM customFields WHERE customFieldID = NEW.customFieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_customFieldID_customFields_customFieldID;
CREATE TRIGGER fku_customBaseFieldMappings_customFieldID_customFields_customFieldID
  BEFORE UPDATE OF customFieldID ON customBaseFieldMappings
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "customBaseFieldMappings" violates foreign key constraint "fku_customBaseFieldMappings_customFieldID_customFields_customFieldID"')
    WHERE NEW.customFieldID IS NOT NULL AND (SELECT COUNT(*) FROM customFields WHERE customFieldID = NEW.customFieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_customBaseFieldMappings_customFieldID_customFields_customFieldID;
CREATE TRIGGER fkd_customBaseFieldMappings_customFieldID_customFields_customFieldID
  BEFORE DELETE ON customFields
  FOR EACH ROW BEGIN
    DELETE FROM customBaseFieldMappings WHERE customFieldID = OLD.customFieldID;
  END;

DROP TRIGGER IF EXISTS fku_customFields_customFieldID_customBaseFieldMappings_customFieldID;
CREATE TRIGGER fku_customFields_customFieldID_customBaseFieldMappings_customFieldID
  AFTER UPDATE OF customFieldID ON customFields
  FOR EACH ROW BEGIN
    UPDATE customBaseFieldMappings SET customFieldID=NEW.customFieldID WHERE customFieldID=OLD.customFieldID;
  END;


-- customItemTypeFields/customItemTypeID
DROP TRIGGER IF EXISTS fki_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID;
CREATE TRIGGER fki_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID
  BEFORE INSERT ON customItemTypeFields
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "customItemTypeFields" violates foreign key constraint "fki_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID"')
    WHERE NEW.customItemTypeID IS NOT NULL AND (SELECT COUNT(*) FROM customItemTypes WHERE customItemTypeID = NEW.customItemTypeID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID;
CREATE TRIGGER fku_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID
  BEFORE UPDATE OF customItemTypeID ON customItemTypeFields
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "customItemTypeFields" violates foreign key constraint "fku_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID"')
    WHERE NEW.customItemTypeID IS NOT NULL AND (SELECT COUNT(*) FROM customItemTypes WHERE customItemTypeID = NEW.customItemTypeID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID;
CREATE TRIGGER fkd_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID
  BEFORE DELETE ON customItemTypes
  FOR EACH ROW BEGIN
    DELETE FROM customItemTypeFields WHERE customItemTypeID = OLD.customItemTypeID;
  END;

DROP TRIGGER IF EXISTS fku_customItemTypes_customItemTypeID_customItemTypeFields_customItemTypeID;
CREATE TRIGGER fku_customItemTypes_customItemTypeID_customItemTypeFields_customItemTypeID
  AFTER UPDATE OF customItemTypeID ON customItemTypes
  FOR EACH ROW BEGIN
    UPDATE customItemTypeFields SET customItemTypeID=NEW.customItemTypeID WHERE customItemTypeID=OLD.customItemTypeID;
  END;


-- customItemTypeFields/fieldID
DROP TRIGGER IF EXISTS fki_customItemTypeFields_fieldID_fields_fieldID;
CREATE TRIGGER fki_customItemTypeFields_fieldID_fields_fieldID
  BEFORE INSERT ON customItemTypeFields
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "customItemTypeFields" violates foreign key constraint "fki_customItemTypeFields_fieldID_fields_fieldID"')
    WHERE NEW.fieldID IS NOT NULL AND (SELECT COUNT(*) FROM fields WHERE fieldID = NEW.fieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_customItemTypeFields_fieldID_fields_fieldID;
CREATE TRIGGER fku_customItemTypeFields_fieldID_fields_fieldID
  BEFORE UPDATE OF fieldID ON customItemTypeFields
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "customItemTypeFields" violates foreign key constraint "fku_customItemTypeFields_fieldID_fields_fieldID"')
    WHERE NEW.fieldID IS NOT NULL AND (SELECT COUNT(*) FROM fields WHERE fieldID = NEW.fieldID) = 0;
  END;


-- customItemTypeFields/customFieldID
DROP TRIGGER IF EXISTS fki_customItemTypeFields_customFieldID_customFields_customFieldID;
CREATE TRIGGER fki_customItemTypeFields_customFieldID_customFields_customFieldID
  BEFORE INSERT ON customItemTypeFields
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "customItemTypeFields" violates foreign key constraint "fki_customItemTypeFields_customFieldID_customFields_customFieldID"')
    WHERE NEW.customFieldID IS NOT NULL AND (SELECT COUNT(*) FROM customFields WHERE customFieldID = NEW.customFieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_customItemTypeFields_customFieldID_customFields_customFieldID;
CREATE TRIGGER fku_customItemTypeFields_customFieldID_customFields_customFieldID
  BEFORE UPDATE OF customFieldID ON customItemTypeFields
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "customItemTypeFields" violates foreign key constraint "fku_customItemTypeFields_customFieldID_customFields_customFieldID"')
    WHERE NEW.customFieldID IS NOT NULL AND (SELECT COUNT(*) FROM customFields WHERE customFieldID = NEW.customFieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_customItemTypeFields_customFieldID_customFields_customFieldID;
CREATE TRIGGER fkd_customItemTypeFields_customFieldID_customFields_customFieldID
  BEFORE DELETE ON customFields
  FOR EACH ROW BEGIN
    DELETE FROM customItemTypeFields WHERE customFieldID = OLD.customFieldID;
  END;

DROP TRIGGER IF EXISTS fku_customFields_customFieldID_customItemTypeFields_customFieldID;
CREATE TRIGGER fku_customFields_customFieldID_customItemTypeFields_customFieldID
  AFTER UPDATE OF customFieldID ON customFields
  FOR EACH ROW BEGIN
    UPDATE customItemTypeFields SET customFieldID=NEW.customFieldID WHERE customFieldID=OLD.customFieldID;
  END;


-- fulltextItems/itemID
DROP TRIGGER IF EXISTS fki_fulltextItems_itemID_items_itemID;
CREATE TRIGGER fki_fulltextItems_itemID_items_itemID
  BEFORE INSERT ON fulltextItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "fulltextItems" violates foreign key constraint "fki_fulltextItems_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_fulltextItems_itemID_items_itemID;
CREATE TRIGGER fku_fulltextItems_itemID_items_itemID
  BEFORE UPDATE OF itemID ON fulltextItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "fulltextItems" violates foreign key constraint "fku_fulltextItems_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_fulltextItems_itemID_items_itemID;
CREATE TRIGGER fkd_fulltextItems_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_fulltextItems_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM fulltextItems WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_fulltextItems_itemID;
CREATE TRIGGER fku_items_itemID_fulltextItems_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE fulltextItems SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;


-- fulltextItemWords/wordID
DROP TRIGGER IF EXISTS fki_fulltextItemWords_wordID_fulltextWords_wordID;
CREATE TRIGGER fki_fulltextItemWords_wordID_fulltextWords_wordID
  BEFORE INSERT ON fulltextItemWords
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "fulltextItemWords" violates foreign key constraint "fki_fulltextItemWords_wordID_fulltextWords_wordID"')
    WHERE NEW.wordID IS NOT NULL AND (SELECT COUNT(*) FROM fulltextWords WHERE wordID = NEW.wordID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_fulltextItemWords_wordID_fulltextWords_wordID;
CREATE TRIGGER fku_fulltextItemWords_wordID_fulltextWords_wordID
  BEFORE UPDATE OF wordID ON fulltextItemWords
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "fulltextItemWords" violates foreign key constraint "fku_fulltextItemWords_wordID_fulltextWords_wordID"')
    WHERE NEW.wordID IS NOT NULL AND (SELECT COUNT(*) FROM fulltextWords WHERE wordID = NEW.wordID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_fulltextItemWords_wordID_fulltextWords_wordID;
CREATE TRIGGER fkd_fulltextItemWords_wordID_fulltextWords_wordID
  BEFORE DELETE ON fulltextWords
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "fulltextWords" violates foreign key constraint "fkd_fulltextItemWords_wordID_fulltextWords_wordID"')
    WHERE (SELECT COUNT(*) FROM fulltextItemWords WHERE wordID = OLD.wordID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_fulltextWords_wordID_fulltextItemWords_wordID;
CREATE TRIGGER fku_fulltextWords_wordID_fulltextItemWords_wordID
  BEFORE UPDATE OF wordID ON fulltextWords
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "fulltextWords" violates foreign key constraint "fku_fulltextWords_wordID_fulltextItemWords_wordID"')
    WHERE (SELECT COUNT(*) FROM fulltextItemWords WHERE wordID = OLD.wordID) > 0;
  END;

-- fulltextItemWords/itemID
DROP TRIGGER IF EXISTS fki_fulltextItemWords_itemID_items_itemID;
CREATE TRIGGER fki_fulltextItemWords_itemID_items_itemID
  BEFORE INSERT ON fulltextItemWords
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "fulltextItemWords" violates foreign key constraint "fki_fulltextItemWords_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_fulltextItemWords_itemID_items_itemID;
CREATE TRIGGER fku_fulltextItemWords_itemID_items_itemID
  BEFORE UPDATE OF itemID ON fulltextItemWords
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "fulltextItemWords" violates foreign key constraint "fku_fulltextItemWords_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_fulltextItemWords_itemID_items_itemID;
CREATE TRIGGER fkd_fulltextItemWords_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_fulltextItemWords_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM fulltextItemWords WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_fulltextItemWords_itemID;
CREATE TRIGGER fku_items_itemID_fulltextItemWords_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE fulltextItemWords SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;

-- groups/libraryID
DROP TRIGGER IF EXISTS fki_groups_libraryID_libraries_libraryID;
CREATE TRIGGER fki_groups_libraryID_libraries_libraryID
  BEFORE INSERT ON groups
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "groups" violates foreign key constraint "fki_groups_libraryID_libraries_libraryID"')
    WHERE NEW.libraryID IS NOT NULL AND (SELECT COUNT(*) FROM libraries WHERE libraryID = NEW.libraryID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_groups_libraryID_libraries_libraryID;
CREATE TRIGGER fku_groups_libraryID_libraries_libraryID
  BEFORE UPDATE OF libraryID ON groups
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "groups" violates foreign key constraint "fku_groups_libraryID_libraries_libraryID"')
    WHERE NEW.libraryID IS NOT NULL AND (SELECT COUNT(*) FROM libraries WHERE libraryID = NEW.libraryID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_groups_libraryID_libraries_libraryID;
CREATE TRIGGER fkd_groups_libraryID_libraries_libraryID
  BEFORE DELETE ON libraries
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "libraries" violates foreign key constraint "fkd_groups_libraryID_libraries_libraryID"')
    WHERE (SELECT COUNT(*) FROM groups WHERE libraryID = OLD.libraryID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_libraries_libraryID_groups_libraryID;
CREATE TRIGGER fku_libraries_libraryID_groups_libraryID
  AFTER UPDATE OF libraryID ON libraries
  FOR EACH ROW BEGIN
    UPDATE groups SET libraryID=NEW.libraryID WHERE libraryID=OLD.libraryID;
  END;

-- groupItems/createdByUserID
DROP TRIGGER IF EXISTS fki_groupItems_createdByUserID_users_userID;
CREATE TRIGGER fki_groupItems_createdByUserID_users_userID
  BEFORE INSERT ON groupItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "groupItems" violates foreign key constraint "fki_groupItems_createdByUserID_users_userID"')
    WHERE NEW.createdByUserID IS NOT NULL AND (SELECT COUNT(*) FROM users WHERE userID = NEW.createdByUserID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_groupItems_createdByUserID_users_userID;
CREATE TRIGGER fku_groupItems_createdByUserID_users_userID
  BEFORE UPDATE OF createdByUserID ON groupItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "groupItems" violates foreign key constraint "fku_groupItems_createdByUserID_users_userID"')
    WHERE NEW.createdByUserID IS NOT NULL AND (SELECT COUNT(*) FROM users WHERE userID = NEW.createdByUserID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_groupItems_createdByUserID_users_userID;
CREATE TRIGGER fkd_groupItems_createdByUserID_users_userID
  BEFORE DELETE ON users
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "users" violates foreign key constraint "fkd_groupItems_createdByUserID_users_userID"')
    WHERE (SELECT COUNT(*) FROM groupItems WHERE createdByUserID = OLD.userID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_users_userID_groupItems_createdByUserID;
CREATE TRIGGER fku_users_userID_groupItems_createdByUserID
  AFTER UPDATE OF userID ON users
  FOR EACH ROW BEGIN
    UPDATE groupItems SET createdByUserID=NEW.userID WHERE createdByUserID=OLD.userID;
  END;

-- groupItems/lastModifiedByUserID
DROP TRIGGER IF EXISTS fki_groupItems_lastModifiedByUserID_users_userID;
CREATE TRIGGER fki_groupItems_lastModifiedByUserID_users_userID
  BEFORE INSERT ON groupItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "groupItems" violates foreign key constraint "fki_groupItems_lastModifiedByUserID_users_userID"')
    WHERE NEW.lastModifiedByUserID IS NOT NULL AND (SELECT COUNT(*) FROM users WHERE userID = NEW.lastModifiedByUserID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_groupItems_lastModifiedByUserID_users_userID;
CREATE TRIGGER fku_groupItems_lastModifiedByUserID_users_userID
  BEFORE UPDATE OF lastModifiedByUserID ON groupItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "groupItems" violates foreign key constraint "fku_groupItems_lastModifiedByUserID_users_userID"')
    WHERE NEW.lastModifiedByUserID IS NOT NULL AND (SELECT COUNT(*) FROM users WHERE userID = NEW.lastModifiedByUserID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_groupItems_lastModifiedByUserID_users_userID;
CREATE TRIGGER fkd_groupItems_lastModifiedByUserID_users_userID
  BEFORE DELETE ON users
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "users" violates foreign key constraint "fkd_groupItems_lastModifiedByUserID_users_userID"')
    WHERE (SELECT COUNT(*) FROM groupItems WHERE lastModifiedByUserID = OLD.userID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_users_userID_groupItems_lastModifiedByUserID;
CREATE TRIGGER fku_users_userID_groupItems_lastModifiedByUserID
  AFTER UPDATE OF userID ON users
  FOR EACH ROW BEGIN
    UPDATE groupItems SET lastModifiedByUserID=NEW.userID WHERE lastModifiedByUserID=OLD.userID;
  END;

-- highlights/itemID
DROP TRIGGER IF EXISTS fki_highlights_itemID_itemAttachments_itemID;
CREATE TRIGGER fki_highlights_itemID_itemAttachments_itemID
  BEFORE INSERT ON highlights
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "highlights" violates foreign key constraint "fki_highlights_itemID_itemAttachments_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM itemAttachments WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_highlights_itemID_itemAttachments_itemID;
CREATE TRIGGER fku_highlights_itemID_itemAttachments_itemID
  BEFORE UPDATE OF itemID ON highlights
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "highlights" violates foreign key constraint "fku_highlights_itemID_itemAttachments_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM itemAttachments WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_highlights_itemID_itemAttachments_itemID;
CREATE TRIGGER fkd_highlights_itemID_itemAttachments_itemID
  BEFORE DELETE ON itemAttachments
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "itemAttachments" violates foreign key constraint "fkd_highlights_itemID_itemAttachments_itemID"')
    WHERE (SELECT COUNT(*) FROM highlights WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_highlights_itemID;
CREATE TRIGGER fku_itemAttachments_itemID_highlights_itemID
  AFTER UPDATE OF itemID ON itemAttachments
  FOR EACH ROW BEGIN
    UPDATE highlights SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;

-- itemAttachments/itemID
DROP TRIGGER IF EXISTS fki_itemAttachments_itemID_items_itemID;
CREATE TRIGGER fki_itemAttachments_itemID_items_itemID
  BEFORE INSERT ON itemAttachments
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemAttachments" violates foreign key constraint "fki_itemAttachments_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_items_itemID;
CREATE TRIGGER fku_itemAttachments_itemID_items_itemID
  BEFORE UPDATE OF itemID ON itemAttachments
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemAttachments" violates foreign key constraint "fku_itemAttachments_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemAttachments_itemID_items_itemID;
CREATE TRIGGER fkd_itemAttachments_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemAttachments_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM itemAttachments WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_itemAttachments_itemID;
CREATE TRIGGER fku_items_itemID_itemAttachments_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemAttachments SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;

-- itemAttachments
DROP TRIGGER IF EXISTS fki_itemAttachments;
CREATE TRIGGER fki_itemAttachments
  BEFORE INSERT ON itemAttachments
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemAttachments" violates foreign key constraint "fki_itemAttachments"')
    WHERE
    NEW.sourceItemID IS NOT NULL AND (
    (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID) IS NULL
    ) OR
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) != (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID)
    );
    
    -- Make sure this is an attachment item
    SELECT RAISE(ABORT, 'item is not an attachment') WHERE
    (SELECT itemTypeID FROM items WHERE itemID = NEW.itemID) != 14;
    
    -- Make sure parent is a regular item
    SELECT RAISE(ABORT, 'parent is not a regular item') WHERE
    NEW.sourceItemID IS NOT NULL AND (SELECT itemTypeID FROM items WHERE itemID = NEW.sourceItemID) IN (1,14);
    
    -- If child, make sure attachment is not in a collection
    SELECT RAISE(ABORT, 'collection item must be top level') WHERE
    NEW.sourceItemID IS NOT NULL AND (SELECT COUNT(*) FROM collectionItems WHERE itemID=NEW.itemID)>0;
  END;

DROP TRIGGER IF EXISTS fku_itemAttachments;
CREATE TRIGGER fku_itemAttachments
  BEFORE UPDATE ON itemAttachments
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemAttachments" violates foreign key constraint "fku_itemAttachments"')
    WHERE
    NEW.sourceItemID IS NOT NULL AND (
    (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID) IS NULL
    ) OR
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) != (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID)
    );
    
    -- Make sure parent is a regular item
    SELECT RAISE(ABORT, 'parent is not a regular item') WHERE
    NEW.sourceItemID IS NOT NULL AND (SELECT itemTypeID FROM items WHERE itemID = NEW.sourceItemID) IN (1,14);
  END;

-- itemAttachments/sourceItemID
DROP TRIGGER IF EXISTS fki_itemAttachments_sourceItemID_items_itemID;
CREATE TRIGGER fki_itemAttachments_sourceItemID_items_itemID
  BEFORE INSERT ON itemAttachments
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemAttachments" violates foreign key constraint "fki_itemAttachments_sourceItemID_items_sourceItemID"')
    WHERE NEW.sourceItemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.sourceItemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemAttachments_sourceItemID_items_itemID;
CREATE TRIGGER fku_itemAttachments_sourceItemID_items_itemID
  BEFORE UPDATE OF sourceItemID ON itemAttachments
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemAttachments" violates foreign key constraint "fku_itemAttachments_sourceItemID_items_sourceItemID"')
    WHERE NEW.sourceItemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.sourceItemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemAttachments_sourceItemID_items_itemID;
CREATE TRIGGER fkd_itemAttachments_sourceItemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemAttachments_sourceItemID_items_sourceItemID"')
    WHERE (SELECT COUNT(*) FROM itemAttachments WHERE sourceItemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_itemAttachments_sourceItemID;
CREATE TRIGGER fku_items_itemID_itemAttachments_sourceItemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemAttachments SET sourceItemID=NEW.itemID WHERE sourceItemID=OLD.itemID;
  END;

-- itemCreators/itemID
DROP TRIGGER IF EXISTS fki_itemCreators_itemID_items_itemID;
CREATE TRIGGER fki_itemCreators_itemID_items_itemID
  BEFORE INSERT ON itemCreators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemCreators" violates foreign key constraint "fki_itemCreators_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemCreators_itemID_items_itemID;
CREATE TRIGGER fku_itemCreators_itemID_items_itemID
  BEFORE UPDATE OF itemID ON itemCreators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemCreators" violates foreign key constraint "fku_itemCreators_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemCreators_itemID_items_itemID;
CREATE TRIGGER fkd_itemCreators_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemCreators_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM itemCreators WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_itemCreators_itemID;
CREATE TRIGGER fku_items_itemID_itemCreators_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemCreators SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;

-- itemCreators/creatorID
DROP TRIGGER IF EXISTS fki_itemCreators_creatorID_creators_creatorID;
CREATE TRIGGER fki_itemCreators_creatorID_creators_creatorID
  BEFORE INSERT ON itemCreators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemCreators" violates foreign key constraint "fki_itemCreators_creatorID_creators_creatorID"')
    WHERE NEW.creatorID IS NOT NULL AND (SELECT COUNT(*) FROM creators WHERE creatorID = NEW.creatorID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemCreators_creatorID_creators_creatorID;
CREATE TRIGGER fku_itemCreators_creatorID_creators_creatorID
  BEFORE UPDATE OF creatorID ON itemCreators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemCreators" violates foreign key constraint "fku_itemCreators_creatorID_creators_creatorID"')
    WHERE NEW.creatorID IS NOT NULL AND (SELECT COUNT(*) FROM creators WHERE creatorID = NEW.creatorID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemCreators_creatorID_creators_creatorID;
CREATE TRIGGER fkd_itemCreators_creatorID_creators_creatorID
  BEFORE DELETE ON creators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "creators" violates foreign key constraint "fkd_itemCreators_creatorID_creators_creatorID"')
    WHERE (SELECT COUNT(*) FROM itemCreators WHERE creatorID = OLD.creatorID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_creators_creatorID_itemCreators_creatorID;
CREATE TRIGGER fku_creators_creatorID_itemCreators_creatorID
  AFTER UPDATE OF creatorID ON creators
  FOR EACH ROW BEGIN
    UPDATE itemCreators SET creatorID=NEW.creatorID WHERE creatorID=OLD.creatorID;
  END;

-- itemCreators/creatorTypeID
DROP TRIGGER IF EXISTS fki_itemCreators_creatorTypeID_creatorTypes_creatorTypeID;
CREATE TRIGGER fki_itemCreators_creatorTypeID_creatorTypes_creatorTypeID
  BEFORE INSERT ON itemCreators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemCreators" violates foreign key constraint "fki_itemCreators_creatorTypeID_creatorTypes_creatorTypeID"')
    WHERE NEW.creatorTypeID IS NOT NULL AND (SELECT COUNT(*) FROM creatorTypes WHERE creatorTypeID = NEW.creatorTypeID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemCreators_creatorTypeID_creatorTypes_creatorTypeID;
CREATE TRIGGER fku_itemCreators_creatorTypeID_creatorTypes_creatorTypeID
  BEFORE UPDATE OF creatorTypeID ON itemCreators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemCreators" violates foreign key constraint "fku_itemCreators_creatorTypeID_creatorTypes_creatorTypeID"')
    WHERE NEW.creatorTypeID IS NOT NULL AND (SELECT COUNT(*) FROM creatorTypes WHERE creatorTypeID = NEW.creatorTypeID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemCreators_creatorTypeID_creatorTypes_creatorTypeID;
CREATE TRIGGER fkd_itemCreators_creatorTypeID_creatorTypes_creatorTypeID
  BEFORE DELETE ON creatorTypes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "creatorTypes" violates foreign key constraint "fkd_itemCreators_creatorTypeID_creatorTypes_creatorTypeID"')
    WHERE (SELECT COUNT(*) FROM itemCreators WHERE creatorTypeID = OLD.creatorTypeID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_creatorTypes_creatorTypeID_itemCreators_creatorTypeID;
CREATE TRIGGER fku_creatorTypes_creatorTypeID_itemCreators_creatorTypeID
  BEFORE UPDATE OF creatorTypeID ON creatorTypes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "creatorTypes" violates foreign key constraint "fku_creatorTypes_creatorTypeID_itemCreators_creatorTypeID"')
    WHERE (SELECT COUNT(*) FROM itemCreators WHERE creatorTypeID = OLD.creatorTypeID) > 0;
  END;


-- itemCreators libraryID
DROP TRIGGER IF EXISTS fki_itemCreators_libraryID;
CREATE TRIGGER fki_itemCreators_libraryID
  BEFORE INSERT ON itemCreators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemCreators" violates foreign key constraint "fki_itemCreators_libraryID"')
    WHERE (
        (SELECT libraryID FROM creators WHERE creatorID = NEW.creatorID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM creators WHERE creatorID = NEW.creatorID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
    ) OR
        (SELECT libraryID FROM creators WHERE creatorID = NEW.creatorID) != (SELECT libraryID FROM items WHERE itemID = NEW.itemID);
  END;

DROP TRIGGER IF EXISTS fku_itemCreators_libraryID;
CREATE TRIGGER fku_itemCreators_libraryID
  BEFORE UPDATE ON itemCreators
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemCreators" violates foreign key constraint "fku_itemCreators_libraryID"')
    WHERE (
        (SELECT libraryID FROM creators WHERE creatorID = NEW.creatorID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM creators WHERE creatorID = NEW.creatorID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
    ) OR
        (SELECT libraryID FROM creators WHERE creatorID = NEW.creatorID) != (SELECT libraryID FROM items WHERE itemID = NEW.itemID);
  END;


-- itemData/itemID
DROP TRIGGER IF EXISTS fki_itemData_itemID_items_itemID;
CREATE TRIGGER fki_itemData_itemID_items_itemID
  BEFORE INSERT ON itemData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemData" violates foreign key constraint "fki_itemData_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemData_itemID_items_itemID;
CREATE TRIGGER fku_itemData_itemID_items_itemID
  BEFORE UPDATE OF itemID ON itemData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemData" violates foreign key constraint "fku_itemData_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemData_itemID_items_itemID;
CREATE TRIGGER fkd_itemData_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemData_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM itemData WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_itemData_itemID;
CREATE TRIGGER fku_items_itemID_itemData_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemData SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;

-- itemData/fieldID
DROP TRIGGER IF EXISTS fki_itemData_fieldID_fields_fieldID;
CREATE TRIGGER fki_itemData_fieldID_fields_fieldID
  BEFORE INSERT ON itemData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemData" violates foreign key constraint "fki_itemData_fieldID_fieldsCombined_fieldID"')
    WHERE NEW.fieldID IS NOT NULL AND (SELECT COUNT(*) FROM fieldsCombined WHERE fieldID = NEW.fieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemData_fieldID_fields_fieldID;
CREATE TRIGGER fku_itemData_fieldID_fields_fieldID
  BEFORE UPDATE OF fieldID ON itemData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemData" violates foreign key constraint "fku_itemData_fieldID_fieldsCombined_fieldID"')
    WHERE NEW.fieldID IS NOT NULL AND (SELECT COUNT(*) FROM fieldsCombined WHERE fieldID = NEW.fieldID) = 0;
  END;

-- itemData/valueID
DROP TRIGGER IF EXISTS fki_itemData_valueID_itemDataValues_valueID;
CREATE TRIGGER fki_itemData_valueID_itemDataValues_valueID
  BEFORE INSERT ON itemData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemData" violates foreign key constraint "fki_itemData_valueID_itemDataValues_valueID"')
    WHERE NEW.valueID IS NOT NULL AND (SELECT COUNT(*) FROM itemDataValues WHERE valueID = NEW.valueID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemData_valueID_itemDataValues_valueID;
CREATE TRIGGER fku_itemData_valueID_itemDataValues_valueID
  BEFORE UPDATE OF valueID ON itemData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemData" violates foreign key constraint "fku_itemData_valueID_itemDataValues_valueID"')
    WHERE NEW.valueID IS NOT NULL AND (SELECT COUNT(*) FROM itemDataValues WHERE valueID = NEW.valueID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemData_valueID_itemDataValues_valueID;
CREATE TRIGGER fkd_itemData_valueID_itemDataValues_valueID
  BEFORE DELETE ON itemDataValues
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "itemDataValues" violates foreign key constraint "fkd_itemData_valueID_itemDataValues_valueID"')
    WHERE (SELECT COUNT(*) FROM itemData WHERE valueID = OLD.valueID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_itemDataValues_valueID_itemData_valueID;
CREATE TRIGGER fku_itemDataValues_valueID_itemData_valueID
  BEFORE UPDATE OF valueID ON itemDataValues
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemDataValues" violates foreign key constraint "fku_itemDataValues_valueID_itemData_valueID"')
    WHERE (SELECT COUNT(*) FROM itemData WHERE valueID = OLD.valueID) > 0;
  END;

-- itemNotes/itemID
DROP TRIGGER IF EXISTS fki_itemNotes_itemID_items_itemID;
CREATE TRIGGER fki_itemNotes_itemID_items_itemID
  BEFORE INSERT ON itemNotes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemNotes" violates foreign key constraint "fki_itemNotes_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemNotes_itemID_items_itemID;
CREATE TRIGGER fku_itemNotes_itemID_items_itemID
  BEFORE UPDATE OF itemID ON itemNotes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemNotes" violates foreign key constraint "fku_itemNotes_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemNotes_itemID_items_itemID;
CREATE TRIGGER fkd_itemNotes_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemNotes_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM itemNotes WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_itemNotes_itemID;
CREATE TRIGGER fku_items_itemID_itemNotes_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemNotes SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;


-- itemNotes
DROP TRIGGER IF EXISTS fki_itemNotes;
CREATE TRIGGER fki_itemNotes
  BEFORE INSERT ON itemNotes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemNotes" violates foreign key constraint "fki_itemNotes_libraryID"')
    WHERE
    NEW.sourceItemID IS NOT NULL AND (
    (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID) IS NULL
    ) OR
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) != (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID)
    );
    
    -- Make sure this is a note or attachment item
    SELECT RAISE(ABORT, 'item is not a note or attachment') WHERE
    (SELECT itemTypeID FROM items WHERE itemID = NEW.itemID) NOT IN (1,14);
    
    -- Make sure parent is a regular item
    SELECT RAISE(ABORT, 'parent is not a regular item') WHERE
    NEW.sourceItemID IS NOT NULL AND (SELECT itemTypeID FROM items WHERE itemID = NEW.sourceItemID) IN (1,14);
    
    -- If child, make sure note is not in a collection
    SELECT RAISE(ABORT, 'collection item must be top level') WHERE
    NEW.sourceItemID IS NOT NULL AND (SELECT COUNT(*) FROM collectionItems WHERE itemID=NEW.itemID)>0;
  END;

DROP TRIGGER IF EXISTS fku_itemNotes;
CREATE TRIGGER fku_itemNotes
  BEFORE UPDATE ON itemNotes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemNotes" violates foreign key constraint "fku_itemNotes"')
    WHERE
    NEW.sourceItemID IS NOT NULL AND (
    (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID) IS NULL
    ) OR
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) != (SELECT libraryID FROM items WHERE itemID = NEW.sourceItemID)
    );
    
    -- Make sure parent is a regular item
    SELECT RAISE(ABORT, 'parent is not a regular item') WHERE
    NEW.sourceItemID IS NOT NULL AND (SELECT itemTypeID FROM items WHERE itemID = NEW.sourceItemID) IN (1,14);
  END;


-- itemNotes/sourceItemID
DROP TRIGGER IF EXISTS fki_itemNotes_sourceItemID_items_itemID;
CREATE TRIGGER fki_itemNotes_sourceItemID_items_itemID
  BEFORE INSERT ON itemNotes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemNotes" violates foreign key constraint "fki_itemNotes_sourceItemID_items_itemID"')
    WHERE NEW.sourceItemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.sourceItemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemNotes_sourceItemID_items_itemID;
CREATE TRIGGER fku_itemNotes_sourceItemID_items_itemID
  BEFORE UPDATE OF sourceItemID ON itemNotes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemNotes" violates foreign key constraint "fku_itemNotes_sourceItemID_items_itemID"')
    WHERE NEW.sourceItemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.sourceItemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemNotes_sourceItemID_items_itemID;
CREATE TRIGGER fkd_itemNotes_sourceItemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemNotes_sourceItemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM itemNotes WHERE sourceItemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_itemNotes_sourceItemID;
CREATE TRIGGER fku_items_itemID_itemNotes_sourceItemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemNotes SET sourceItemID=NEW.itemID WHERE sourceItemID=OLD.itemID;
  END;

-- items/libraryID
DROP TRIGGER IF EXISTS fki_items_libraryID_libraries_libraryID;
CREATE TRIGGER fki_items_libraryID_libraries_libraryID
  BEFORE INSERT ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "items" violates foreign key constraint "fki_items_libraryID_libraries_libraryID"')
    WHERE NEW.libraryID IS NOT NULL AND (SELECT COUNT(*) FROM libraries WHERE libraryID = NEW.libraryID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_items_libraryID_libraries_libraryID;
CREATE TRIGGER fku_items_libraryID_libraries_libraryID
  BEFORE UPDATE OF libraryID ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "items" violates foreign key constraint "fku_items_libraryID_libraries_libraryID"')
    WHERE NEW.libraryID IS NOT NULL AND (SELECT COUNT(*) FROM libraries WHERE libraryID = NEW.libraryID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_items_libraryID_libraries_libraryID;
CREATE TRIGGER fkd_items_libraryID_libraries_libraryID
  BEFORE DELETE ON libraries
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "libraries" violates foreign key constraint "fkd_items_libraryID_libraries_libraryID"')
    WHERE (SELECT COUNT(*) FROM items WHERE libraryID = OLD.libraryID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_libraries_libraryID_items_libraryID;
CREATE TRIGGER fku_libraries_libraryID_items_libraryID
  AFTER UPDATE OF libraryID ON libraries
  FOR EACH ROW BEGIN
    UPDATE items SET libraryID=NEW.libraryID WHERE libraryID=OLD.libraryID;
  END;

-- itemSeeAlso/itemID
DROP TRIGGER IF EXISTS fki_itemSeeAlso_itemID_items_itemID;
CREATE TRIGGER fki_itemSeeAlso_itemID_items_itemID
  BEFORE INSERT ON itemSeeAlso
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemSeeAlso" violates foreign key constraint "fki_itemSeeAlso_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemSeeAlso_itemID_items_itemID;
CREATE TRIGGER fku_itemSeeAlso_itemID_items_itemID
  BEFORE UPDATE OF itemID ON itemSeeAlso
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemSeeAlso" violates foreign key constraint "fku_itemSeeAlso_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemSeeAlso_itemID_items_itemID;
CREATE TRIGGER fkd_itemSeeAlso_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemSeeAlso_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM itemSeeAlso WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_itemSeeAlso_itemID;
CREATE TRIGGER fku_items_itemID_itemSeeAlso_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemSeeAlso SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;

-- itemSeeAlso/linkedItemID
DROP TRIGGER IF EXISTS fki_itemSeeAlso_linkedItemID_items_itemID;
CREATE TRIGGER fki_itemSeeAlso_linkedItemID_items_itemID
  BEFORE INSERT ON itemSeeAlso
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemSeeAlso" violates foreign key constraint "fki_itemSeeAlso_linkedItemID_items_itemID"')
    WHERE NEW.linkedItemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.linkedItemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemSeeAlso_linkedItemID_items_itemID;
CREATE TRIGGER fku_itemSeeAlso_linkedItemID_items_itemID
  BEFORE UPDATE OF linkedItemID ON itemSeeAlso
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemSeeAlso" violates foreign key constraint "fku_itemSeeAlso_linkedItemID_items_itemID"')
    WHERE NEW.linkedItemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.linkedItemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemSeeAlso_linkedItemID_items_itemID;
CREATE TRIGGER fkd_itemSeeAlso_linkedItemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemSeeAlso_linkedItemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM itemSeeAlso WHERE linkedItemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_itemSeeAlso_linkedItemID;
CREATE TRIGGER fku_items_itemID_itemSeeAlso_linkedItemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemSeeAlso SET linkedItemID=NEW.itemID WHERE linkedItemID=OLD.itemID;
  END;


-- itemSeeAlso libraryID
DROP TRIGGER IF EXISTS fki_itemSeeAlso_libraryID;
CREATE TRIGGER fki_itemSeeAlso_libraryID
  BEFORE INSERT ON itemSeeAlso
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemSeeAlso" violates foreign key constraint "fki_itemSeeAlso_libraryID"')
    WHERE (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.linkedItemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.linkedItemID) IS NULL
    ) OR
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) != (SELECT libraryID FROM items WHERE itemID = NEW.linkedItemID);
  END;

DROP TRIGGER IF EXISTS fku_itemSeeAlso_libraryID;
CREATE TRIGGER fku_itemSeeAlso_libraryID
  BEFORE UPDATE ON itemSeeAlso
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemSeeAlso" violates foreign key constraint "fku_itemSeeAlso_libraryID"')
    WHERE (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.linkedItemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.linkedItemID) IS NULL
    ) OR
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) != (SELECT libraryID FROM items WHERE itemID = NEW.linkedItemID);
  END;


-- itemTags/itemID
DROP TRIGGER IF EXISTS fki_itemTags_itemID_items_itemID;
CREATE TRIGGER fki_itemTags_itemID_items_itemID
  BEFORE INSERT ON itemTags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemTags" violates foreign key constraint "fki_itemTags_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemTags_itemID_items_itemID;
CREATE TRIGGER fku_itemTags_itemID_items_itemID
  BEFORE UPDATE OF itemID ON itemTags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemTags" violates foreign key constraint "fku_itemTags_itemID_items_itemID"')
    WHERE NEW.itemID IS NOT NULL AND (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemTags_itemID_items_itemID;
CREATE TRIGGER fkd_itemTags_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_itemTags_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM itemTags WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fkd_items_itemID_itemTags_itemID;
CREATE TRIGGER fkd_items_itemID_itemTags_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE itemTags SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;


-- itemTags libraryID
DROP TRIGGER IF EXISTS fki_itemTags_libraryID;
CREATE TRIGGER fki_itemTags_libraryID
  BEFORE INSERT ON itemTags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemTags" violates foreign key constraint "fki_itemTags_libraryID"')
    WHERE (
        (SELECT libraryID FROM tags WHERE tagID = NEW.tagID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM tags WHERE tagID = NEW.tagID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
    ) OR
        (SELECT libraryID FROM tags WHERE tagID = NEW.tagID) != (SELECT libraryID FROM items WHERE itemID = NEW.itemID);
  END;

DROP TRIGGER IF EXISTS fku_itemTags_libraryID;
CREATE TRIGGER fku_itemTags_libraryID
  BEFORE UPDATE ON itemTags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemTags" violates foreign key constraint "fku_itemTags_libraryID"')
    WHERE (
        (SELECT libraryID FROM tags WHERE tagID = NEW.tagID) IS NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NOT NULL
    ) OR (
        (SELECT libraryID FROM tags WHERE tagID = NEW.tagID) IS NOT NULL
            AND
        (SELECT libraryID FROM items WHERE itemID = NEW.itemID) IS NULL
    ) OR
        (SELECT libraryID FROM tags WHERE tagID = NEW.tagID) != (SELECT libraryID FROM items WHERE itemID = NEW.itemID);
  END;


-- itemTags/tagID
DROP TRIGGER IF EXISTS fki_itemTags_tagID_tags_tagID;
CREATE TRIGGER fki_itemTags_tagID_tags_tagID
  BEFORE INSERT ON itemTags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemTags" violates foreign key constraint "fki_itemTags_tagID_tags_tagID"')
    WHERE NEW.tagID IS NOT NULL AND (SELECT COUNT(*) FROM tags WHERE tagID = NEW.tagID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemTags_tagID_tags_tagID;
CREATE TRIGGER fku_itemTags_tagID_tags_tagID
  BEFORE UPDATE OF tagID ON itemTags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemTags" violates foreign key constraint "fku_itemTags_tagID_tags_tagID"')
    WHERE NEW.tagID IS NOT NULL AND (SELECT COUNT(*) FROM tags WHERE tagID = NEW.tagID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemTags_tagID_tags_tagID;
CREATE TRIGGER fkd_itemTags_tagID_tags_tagID
  BEFORE DELETE ON tags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "tags" violates foreign key constraint "fkd_itemTags_tagID_tags_tagID"')
    WHERE (SELECT COUNT(*) FROM itemTags WHERE tagID = OLD.tagID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_tags_tagID_itemTags_tagID;
CREATE TRIGGER fku_tags_tagID_itemTags_tagID
  AFTER UPDATE OF tagID ON tags
  FOR EACH ROW BEGIN
    UPDATE itemTags SET tagID=NEW.tagID WHERE tagID=OLD.tagID;
  END;


-- savedSearchConditions/savedSearchID
DROP TRIGGER IF EXISTS fki_savedSearchConditions_savedSearchID_savedSearches_savedSearchID;
CREATE TRIGGER fki_savedSearchConditions_savedSearchID_savedSearches_savedSearchID
  BEFORE INSERT ON savedSearchConditions
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "savedSearchConditions" violates foreign key constraint "fki_savedSearchConditions_savedSearchID_savedSearches_savedSearchID"')
    WHERE (SELECT COUNT(*) FROM savedSearches WHERE savedSearchID = NEW.savedSearchID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_savedSearchConditions_savedSearchID_savedSearches_savedSearchID;
CREATE TRIGGER fku_savedSearchConditions_savedSearchID_savedSearches_savedSearchID
  BEFORE UPDATE OF savedSearchID ON savedSearchConditions
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "savedSearchConditions" violates foreign key constraint "fku_savedSearchConditions_savedSearchID_savedSearches_savedSearchID"')
    WHERE (SELECT COUNT(*) FROM savedSearches WHERE savedSearchID = NEW.savedSearchID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_savedSearchConditions_savedSearchID_savedSearches_savedSearchID;
CREATE TRIGGER fkd_savedSearchConditions_savedSearchID_savedSearches_savedSearchID
  BEFORE DELETE ON savedSearches
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "savedSearches" violates foreign key constraint "fkd_savedSearchConditions_savedSearchID_savedSearches_savedSearchID"')
    WHERE (SELECT COUNT(*) FROM savedSearchConditions WHERE savedSearchID = OLD.savedSearchID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_savedSearches_savedSearchID_savedSearchConditions_savedSearchID;
CREATE TRIGGER fku_savedSearches_savedSearchID_savedSearchConditions_savedSearchID
  AFTER UPDATE OF savedSearchID ON savedSearches
  FOR EACH ROW BEGIN
    UPDATE savedSearchConditions SET savedSearchID=NEW.savedSearchID WHERE savedSearchID=OLD.savedSearchID;
  END;

-- deletedItems/itemID
DROP TRIGGER IF EXISTS fki_deletedItems_itemID_items_itemID;
CREATE TRIGGER fki_deletedItems_itemID_items_itemID
  BEFORE INSERT ON deletedItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "deletedItems" violates foreign key constraint "fki_deletedItems_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_deletedItems_itemID_items_itemID;
CREATE TRIGGER fku_deletedItems_itemID_items_itemID
  BEFORE UPDATE OF itemID ON deletedItems
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "deletedItems" violates foreign key constraint "fku_deletedItems_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM items WHERE itemID = NEW.itemID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_deletedItems_itemID_items_itemID;
CREATE TRIGGER fkd_deletedItems_itemID_items_itemID
  BEFORE DELETE ON items
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "items" violates foreign key constraint "fkd_deletedItems_itemID_items_itemID"')
    WHERE (SELECT COUNT(*) FROM deletedItems WHERE itemID = OLD.itemID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_items_itemID_deletedItems_itemID;
CREATE TRIGGER fku_items_itemID_deletedItems_itemID
  AFTER UPDATE OF itemID ON items
  FOR EACH ROW BEGIN
    UPDATE deletedItems SET itemID=NEW.itemID WHERE itemID=OLD.itemID;
  END;


-- syncDeleteLog/syncObjectTypeID
DROP TRIGGER IF EXISTS fki_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID;
CREATE TRIGGER fki_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID
  BEFORE INSERT ON syncDeleteLog
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "syncDeleteLog" violates foreign key constraint "fki_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID"')
    WHERE (SELECT COUNT(*) FROM syncObjectTypes WHERE syncObjectTypeID = NEW.syncObjectTypeID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID;
CREATE TRIGGER fku_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID
  BEFORE UPDATE OF syncObjectTypeID ON syncDeleteLog
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "syncDeleteLog" violates foreign key constraint "fku_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID"')
    WHERE (SELECT COUNT(*) FROM syncObjectTypes WHERE syncObjectTypeID = NEW.syncObjectTypeID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID;
CREATE TRIGGER fkd_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID
  BEFORE DELETE ON syncObjectTypes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "syncObjectTypes" violates foreign key constraint "fkd_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID"')
    WHERE (SELECT COUNT(*) FROM syncDeleteLog WHERE syncObjectTypeID = OLD.syncObjectTypeID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_syncObjectTypes_syncObjectTypeID_syncDeleteLog_syncObjectTypeID;
CREATE TRIGGER fku_syncObjectTypes_syncObjectTypeID_syncDeleteLog_syncObjectTypeID
  BEFORE DELETE ON syncObjectTypes
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "syncObjectTypes" violates foreign key constraint "fku_syncObjectTypes_syncObjectTypeID_syncDeleteLog_syncObjectTypeID"')
    WHERE (SELECT COUNT(*) FROM syncDeleteLog WHERE syncObjectTypeID = OLD.syncObjectTypeID) > 0;
  END;

-- proxyHosts/proxyID
DROP TRIGGER IF EXISTS fki_proxyHosts_proxyID_proxies_proxyID;
CREATE TRIGGER fki_proxyHosts_proxyID_proxies_proxyID
BEFORE INSERT ON proxyHosts
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "proxyHosts" violates foreign key constraint "fki_proxyHosts_proxyID_proxies_proxyID"')
    WHERE (SELECT COUNT(*) FROM proxies WHERE proxyID = NEW.proxyID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_proxyHosts_proxyID_proxies_proxyID;
CREATE TRIGGER fku_proxyHosts_proxyID_proxies_proxyID
  BEFORE UPDATE OF proxyID ON proxyHosts
  FOR EACH ROW BEGIN
      SELECT RAISE(ABORT, 'update on table "proxyHosts" violates foreign key constraint "fku_proxyHosts_proxyID_proxies_proxyID"')
        WHERE (SELECT COUNT(*) FROM proxies WHERE proxyID = NEW.proxyID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_proxyHosts_proxyID_proxies_proxyID;
CREATE TRIGGER fkd_proxyHosts_proxyID_proxies_proxyID
  BEFORE DELETE ON proxies
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "proxies" violates foreign key constraint "fkd_proxyHosts_proxyID_proxies_proxyID"')
    WHERE (SELECT COUNT(*) FROM proxyHosts WHERE proxyID = OLD.proxyID) > 0;
  END;

DROP TRIGGER IF EXISTS fku_proxies_proxyID_proxyHosts_proxyID;
CREATE TRIGGER fku_proxies_proxyID_proxyHosts_proxyID
  BEFORE DELETE ON proxies
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "proxies" violates foreign key constraint "fku_proxies_proxyID_proxyHosts_proxyID"')
    WHERE (SELECT COUNT(*) FROM proxyHosts WHERE proxyID = OLD.proxyID) > 0;
  END;

-- Make sure tags aren't empty
DROP TRIGGER IF EXISTS fki_tags;
CREATE TRIGGER fki_tags
BEFORE INSERT ON tags
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'Tag cannot be blank')
    WHERE TRIM(NEW.name)='';
  END;

DROP TRIGGER IF EXISTS fku_tags;
CREATE TRIGGER fku_tags
  BEFORE UPDATE OF name ON tags
  FOR EACH ROW BEGIN
      SELECT RAISE(ABORT, 'Tag cannot be blank')
      WHERE TRIM(NEW.name)='';
  END;

