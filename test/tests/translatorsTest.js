"use strict";

describe("Zotero.Translators", function () {
	describe("#init()", function () {
		async function testUpdateCache({ translatorID, oldLabel, newLabel, oldLastUpdated, newLastUpdated }) {
			var oldTranslator = buildDummyTranslator('web', `function doDetect() {}; function doSearch(); {}`, {
				label: oldLabel,
				translatorID,
				translatorType: 8,
				lastUpdated: oldLastUpdated
			});
			await Zotero.Translators.save(oldTranslator.metadata, oldTranslator.code);
			await Zotero.Translators.reinit();
			var matched = (await Zotero.Translators.getAllForType('search'))
				.filter(x => x.translatorID == translatorID);
			assert.lengthOf(matched, 1);
			assert.equal(matched[0].label, oldLabel);
			var oldPath = matched[0].path;
			assert.isTrue(await OS.File.exists(oldPath));
			
			var rows = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM translatorCache WHERE fileName=?",
				oldTranslator.label + ".js"
			);
			assert.equal(rows, 1);
			
			var newTranslator = buildDummyTranslator('web', `function doDetect() {}; function doSearch(); {}`, {
				label: newLabel,
				translatorID,
				translatorType: 8,
				lastUpdated: newLastUpdated
			});
			await Zotero.Translators.save(newTranslator.metadata, newTranslator.code);
			await Zotero.Translators.reinit();
			
			matched = (await Zotero.Translators.getAllForType('search'))
				.filter(x => x.translatorID == translatorID);
			assert.lengthOf(matched, 1);
			assert.equal(matched[0].label, newLabel);
			assert.isFalse(await OS.File.exists(oldPath));
			assert.isTrue(await OS.File.exists(matched[0].path));
			
			rows = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM translatorCache WHERE fileName=?",
				oldTranslator.label + ".js"
			);
			assert.equal(rows, 0);
			
			rows = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM translatorCache WHERE fileName=?",
				newTranslator.label + ".js"
			);
			assert.equal(rows, 1);
		}
		
		it("should update cache when deleting old translator with same id", async function () {
			await testUpdateCache({
				translatorID: 'f678741b-b82d-48a3-a7c2-26764d08cc34',
				oldLabel: 'Old Test Translator',
				newLabel: 'New Test Translator',
				oldLastUpdated: '2021-06-25 00:00:00',
				newLastUpdated: '2021-06-25 00:05:00',
			});
		});
		
		it("should update cache when deleting second translator with same id and timestamp", async function () {
			await testUpdateCache({
				translatorID: '4bff4da8-b3f6-47dc-957a-dcb96dc48d4f',
				oldLabel: 'Old Test Translator 2',
				newLabel: 'New Test Translator 2',
				oldLastUpdated: '2021-06-25 00:00:00',
				newLastUpdated: '2021-06-25 00:00:00',
			});
		});
	});
	
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
