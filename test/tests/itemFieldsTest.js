"use strict";

describe("Zotero.ItemFields", function () {
	describe("#getBaseIDFromTypeAndField()", function () {
		it("should return the base field id for an item type and base-mapped field", function* () {
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
		
		it("should return the base field id for an item type and base field", function* () {
			assert.equal(
				Zotero.ItemFields.getBaseIDFromTypeAndField('book', 'publisher'),
				Zotero.ItemFields.getID('publisher')
			);
		})
		
		it("should return false for an item type and non-base-mapped field", function* () {
			assert.isFalse(
				Zotero.ItemFields.getBaseIDFromTypeAndField('audioRecording', 'runningTime')
			);
		})
	})
})
