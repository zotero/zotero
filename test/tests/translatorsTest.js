"use strict";

describe("Zotero.Translators", function () {
	describe("#init()", function () {
		async function testUpdateCache({ translatorID, label1, label2, lastUpdated1, lastUpdated2, expect }) {
			var translator1 = buildDummyTranslator('web', `function doDetect() {}; function doSearch(); {}`, {
				label: label1,
				translatorID,
				translatorType: 8,
				lastUpdated: lastUpdated1
			});
			await Zotero.Translators.save(translator1.metadata, translator1.code);
			await Zotero.Translators.reinit();
			var matched = (await Zotero.Translators.getAllForType('search'))
				.filter(x => x.translatorID == translatorID);
			assert.lengthOf(matched, 1);
			assert.equal(matched[0].label, label1);
			var path1 = matched[0].path;
			assert.isTrue(await OS.File.exists(path1));
			
			var rows = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM translatorCache WHERE fileName=?",
				translator1.label + ".js"
			);
			assert.equal(rows, 1);
			
			var translator2 = buildDummyTranslator('web', `function doDetect() {}; function doSearch(); {}`, {
				label: label2,
				translatorID,
				translatorType: 8,
				lastUpdated: lastUpdated2
			});
			await Zotero.Translators.save(translator2.metadata, translator2.code);
			await Zotero.Translators.reinit();
			
			matched = (await Zotero.Translators.getAllForType('search'))
				.filter(x => x.translatorID == translatorID);
			assert.lengthOf(matched, 1);
			assert.equal(matched[0].label, expect == 1 ? label1 : label2);
			// If keeping the second translator, make sure the first one was deleted
			if (expect == 2) {
				assert.isFalse(await OS.File.exists(path1));
			}
			assert.isTrue(await OS.File.exists(matched[0].path));
			
			rows = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM translatorCache WHERE fileName=?",
				(expect == 1 ? translator2.label  : translator1.label) + ".js"
			);
			assert.equal(rows, 0);
			
			rows = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM translatorCache WHERE fileName=?",
				(expect == 1 ? translator1.label  : translator2.label) + ".js"
			);
			assert.equal(rows, 1);
		}
		
		it("should delete older translator with same id", async function () {
			await testUpdateCache({
				translatorID: 'f678741b-b82d-48a3-a7c2-26764d08cc34',
				label1: 'Test Translator A 1',
				label2: 'Test Translator A 2',
				lastUpdated1: '2021-06-25 00:00:00',
				lastUpdated2: '2021-06-25 00:05:00',
				expect: 2
			});
		});
		
		it("should delete newer translator with same id", async function () {
			await testUpdateCache({
				translatorID: 'abd90f38-0900-4952-9935-3938933699b9',
				label1: 'Test Translator B 1',
				label2: 'Test Translator B 2',
				lastUpdated1: '2021-06-25 00:05:00',
				lastUpdated2: '2021-06-25 00:00:00',
				expect: 1
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
