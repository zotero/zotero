"use strict";

describe("Zotero.ItemFields", function () {
	describe("#getBaseIDFromTypeAndField()", function () {
		it("should return the base field id for an item type and base-mapped field", async function () {
			assert.equal(
				Zotero.ItemFields.getBaseIDFromTypeAndField('audioRecording', 'label'),
				Zotero.ItemFields.getID('publisher')
			);
			
			// Accept ids too
			assert.equal(
				Zotero.ItemFields.getBaseIDFromTypeAndField(
					Zotero.ItemTypes.getID('audioRecording'),
					Zotero.ItemFields.getID('label')
				),
				Zotero.ItemFields.getID('publisher')
			);
		})
		
		it("should return the base field id for an item type and base field", async function () {
			assert.equal(
				Zotero.ItemFields.getBaseIDFromTypeAndField('book', 'publisher'),
				Zotero.ItemFields.getID('publisher')
			);
		});
		
		it("should return the base field id for an item type and base field when type has a base-mapped field", function () {
			assert.equal(
				Zotero.ItemFields.getBaseIDFromTypeAndField('hearing', 'number'),
				Zotero.ItemFields.getID('number')
			);
		});
		
		it("should return false for an item type and non-base-mapped field", async function () {
			assert.isFalse(
				Zotero.ItemFields.getBaseIDFromTypeAndField('audioRecording', 'runningTime')
			);
		});
		
		it("should return false for invalid type-field combination", function () {
			assert.isFalse(
				Zotero.ItemFields.getBaseIDFromTypeAndField('note', 'runningTime')
			);
		});
	});
	
	describe("#isDate()", function () {
		it("should treat base and mapped date-type fields as dates", function () {
			assert.isTrue(Zotero.ItemFields.isDate('date'));
			assert.isTrue(Zotero.ItemFields.isDate('dateDecided'));
			assert.isTrue(Zotero.ItemFields.isDate('originalDate'));
			assert.isTrue(Zotero.ItemFields.isDate('priorityDate'));
			assert.isFalse(Zotero.ItemFields.isDate('title'));
		});
	});

	describe("#getDirection()", function () {
		it("should follow app locale for primary field", function () {
			assert.equal(Zotero.ItemFields.getDirection('book', 'dateAdded', ''), Zotero.dir)
		});
		
		it("should use item language for non-field", function () {
			assert.equal(Zotero.ItemFields.getDirection('book', 'creator-0-lastName', 'ar'), 'rtl');
		});
	});

	describe("#_getLoadInfo()", function () {
		it("should resolve a base field to the item type's field", function () {
			var info = Zotero.ItemFields._getLoadInfo(
				Zotero.ItemTypes.getID('thesis'), Zotero.ItemFields.getID('publisher')
			);
			assert.equal(info.fieldID, Zotero.ItemFields.getID('university'));
			assert.isTrue(info.valid);
		});

		it("should mark a field that isn't valid for the item type", function () {
			var info = Zotero.ItemFields._getLoadInfo(
				Zotero.ItemTypes.getID('book'), Zotero.ItemFields.getID('websiteTitle')
			);
			assert.isFalse(info.valid);
		});

		it("should return false for an unknown field", function () {
			assert.isFalse(Zotero.ItemFields._getLoadInfo(Zotero.ItemTypes.getID('book'), 999999));
		});

		// A plugin that replaces a lookup method must still be consulted
		it("should use a replaced lookup method", function () {
			var bookID = Zotero.ItemTypes.getID('book');
			var titleID = Zotero.ItemFields.getID('title');
			assert.isTrue(Zotero.ItemFields._getLoadInfo(bookID, titleID).valid);

			var original = Zotero.ItemFields.isValidForType;
			Zotero.ItemFields.isValidForType = () => false;
			try {
				assert.isFalse(Zotero.ItemFields._getLoadInfo(bookID, titleID).valid);
			}
			finally {
				Zotero.ItemFields.isValidForType = original;
			}
			assert.isTrue(Zotero.ItemFields._getLoadInfo(bookID, titleID).valid);
		});
	});
})
