"use strict";

describe("Zotero.Translators", function () {
	describe("#getWebTranslatorsForLocation()", function () {
		var genericTranslator, topLevelTranslator, frameTranslator;
		var noMatchURL = 'http://notowls.com/citation/penguin-migration-patterns';
		var topMatchURL = 'http://www.owl.com/owl_page/snowy_owl';
		var frameMatchURL = 'http://iframe.owl.com/citation/owl-migration-patterns';
		
		before(function* (){
			genericTranslator = buildDummyTranslator('web', `function doDetect() {}; function doWeb(); {}`, {
				translatorID: 'generic-translator'
			});
			topLevelTranslator = buildDummyTranslator('web', `function doDetect() {}; function doWeb(); {}`, {
				translatorID: 'top-level-translator',
				target: "https?://www\\.owl\\.com/(citation|owl_page)/.+"
			});
			frameTranslator = buildDummyTranslator('web', `function doDetect() {}; function doWeb(); {}`, {
				translatorID: 'frame-translator',
				target: "https?://([^.]+\\.)?owl\\.com/(citation|owl_page)/.+",
				targetAll: "https?://iframe.owl\\.com/(citation|owl_page)/.+"
			});	
			
			let getAllForType = sinon.stub(Zotero.Translators, 'getAllForType');
			getAllForType.withArgs('web').resolves([genericTranslator, topLevelTranslator, frameTranslator]);
			getAllForType.withArgs('webWithTargetAll').resolves([frameTranslator]);
			
			let regexp = new RegExp(topLevelTranslator.target, 'i');
			assert.isFalse(regexp.test(noMatchURL));
			assert.isTrue(regexp.test(topMatchURL));
			assert.isFalse(regexp.test(frameMatchURL));

			regexp = new RegExp(frameTranslator.target, 'i');
			assert.isFalse(regexp.test(noMatchURL));
			assert.isTrue(regexp.test(topMatchURL));
			assert.isTrue(regexp.test(frameMatchURL));

			regexp = new RegExp(frameTranslator.targetAll, 'i');
			assert.isFalse(regexp.test(noMatchURL));
			assert.isFalse(regexp.test(topMatchURL));
			assert.isTrue(regexp.test(frameMatchURL));
		});
		
		after(function* (){
			Zotero.Translators.getAllForType.restore();
		});
		
		describe("when called from a root document", function() {
			it("should return generic translators when not matching any translator `target`", function* () {
				var translators = yield Zotero.Translators.getWebTranslatorsForLocation(noMatchURL, noMatchURL);
				assert.equal(translators[0].length, 1);
				assert.equal(translators[0][0].translatorID, 'generic-translator');
			});
			
			it("should return all matching translators without `targetAll` property", function* () {
				var translators = yield Zotero.Translators.getWebTranslatorsForLocation(topMatchURL, topMatchURL);
				assert.equal(translators[0].length, 2);
				assert.equal(translators[0][0].translatorID, 'generic-translator');
				assert.equal(translators[0][1].translatorID, 'top-level-translator');
			});
			
			it("should return translators that match both `target` and `targetAll` when both properties present", function* () {
				var translators = yield Zotero.Translators.getWebTranslatorsForLocation(frameMatchURL, frameMatchURL);
				assert.equal(translators[0].length, 2);
				assert.equal(translators[0][0].translatorID, 'generic-translator');
				assert.equal(translators[0][1].translatorID, 'frame-translator');
			});
		
		});
		
		describe("when called from an iframe", function() {
			it("should not return generic translators or translators without `targetAll` property", function* () {
				var translators = yield Zotero.Translators.getWebTranslatorsForLocation(frameMatchURL, noMatchURL);
				assert.equal(translators[0].length, 0);
			});
		
			it("should not return translators that match `target` but not `targetAll", function* () {
				var translators = yield Zotero.Translators.getWebTranslatorsForLocation(noMatchURL, topMatchURL);
				assert.equal(translators[0].length, 0);
			});
			
			it("should return translators that match both `target` and `targetAll`", function* () {
				var translators = yield Zotero.Translators.getWebTranslatorsForLocation(frameMatchURL, topMatchURL);
				assert.equal(translators[0].length, 1);
				assert.equal(translators[0][0].translatorID, 'frame-translator');
			});
		});
	});
});
