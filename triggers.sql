-- 1

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

-- itemData/fieldID
DROP TRIGGER IF EXISTS fki_itemData_fieldID_fields_fieldID;
CREATE TRIGGER fki_itemData_fieldID_fields_fieldID
  BEFORE INSERT ON itemData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "itemData" violates foreign key constraint "fki_itemData_fieldID_fields_fieldID"')
    WHERE NEW.fieldID IS NOT NULL AND (SELECT COUNT(*) FROM fields WHERE fieldID = NEW.fieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_itemData_fieldID_fields_fieldID;
CREATE TRIGGER fku_itemData_fieldID_fields_fieldID
  BEFORE UPDATE OF fieldID ON itemData
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "itemData" violates foreign key constraint "fku_itemData_fieldID_fields_fieldID"')
    WHERE NEW.fieldID IS NOT NULL AND (SELECT COUNT(*) FROM fields WHERE fieldID = NEW.fieldID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_itemData_fieldID_fields_fieldID;
CREATE TRIGGER fkd_itemData_fieldID_fields_fieldID
  BEFORE DELETE ON FIELDS
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "fields" violates foreign key constraint "fkd_itemData_fieldID_fields_fieldID"')
    WHERE (SELECT COUNT(*) FROM itemData WHERE fieldID = OLD.fieldID) > 0;
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

-- savedSearchConditions/searchConditionID
DROP TRIGGER IF EXISTS fki_savedSearchConditions_searchConditionID_savedSearches_savedSearchID;
CREATE TRIGGER fki_savedSearchConditions_searchConditionID_savedSearches_savedSearchID
  BEFORE INSERT ON savedSearchConditions
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'insert on table "savedSearchConditions" violates foreign key constraint "fki_savedSearchConditions_searchConditionID_savedSearches_savedSearchID"')
    WHERE NEW.searchConditionID IS NOT NULL AND (SELECT COUNT(*) FROM savedSearches WHERE savedSearchID = NEW.searchConditionID) = 0;
  END;

DROP TRIGGER IF EXISTS fku_savedSearchConditions_searchConditionID_savedSearches_savedSearchID;
CREATE TRIGGER fku_savedSearchConditions_searchConditionID_savedSearches_savedSearchID
  BEFORE UPDATE OF searchConditionID ON savedSearchConditions
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'update on table "savedSearchConditions" violates foreign key constraint "fku_savedSearchConditions_searchConditionID_savedSearches_savedSearchID"')
    WHERE NEW.searchConditionID IS NOT NULL AND (SELECT COUNT(*) FROM savedSearches WHERE savedSearchID = NEW.searchConditionID) = 0;
  END;

DROP TRIGGER IF EXISTS fkd_savedSearchConditions_searchConditionID_savedSearches_savedSearchID;
CREATE TRIGGER fkd_savedSearchConditions_searchConditionID_savedSearches_savedSearchID
  BEFORE DELETE ON savedSearches
  FOR EACH ROW BEGIN
    SELECT RAISE(ABORT, 'delete on table "savedSearches" violates foreign key constraint "fkd_savedSearchConditions_searchConditionID_savedSearches_savedSearchID"')
    WHERE (SELECT COUNT(*) FROM savedSearchConditions WHERE searchConditionID = OLD.savedSearchID) > 0;
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
