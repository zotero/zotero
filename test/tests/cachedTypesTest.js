describe("Zotero.CachedTypes", function() {
	describe("Zotero.ItemTypes", function () {
		describe("#getPrimaryTypes()", function () {
			it("should return an array of objects with 'id' and 'name' properties", function () {
				var types = Zotero.ItemTypes.getPrimaryTypes();
				assert.lengthOf(types, 5);
				for (let type of types) {
					assert.property(type, 'id');
					assert.property(type, 'name');
				}
			});
			
			it("shouldn't include 'webpage'", function () {
				assert.notInclude(Zotero.ItemTypes.getPrimaryTypes().map(x => x.name), 'webpage');
			});
			
			it("shouldn't include 'attachment'", function () {
				assert.notInclude(Zotero.ItemTypes.getPrimaryTypes().map(x => x.name), 'attachment');
			});
		});
		
		describe("#getSecondaryTypes()", function () {
			it("should return an array of objects with 'id' and 'name' properties", function () {
				var types = Zotero.ItemTypes.getSecondaryTypes();
				assert.isAbove(types.length, 5);
				for (let type of types) {
					assert.property(type, 'id');
					assert.property(type, 'name');
				}
			});
			
			it("shouldn't include 'webpage'", function () {
				assert.notInclude(Zotero.ItemTypes.getSecondaryTypes().map(x => x.name), 'webpage');
			});
			
			it("shouldn't include 'attachment'", function () {
				assert.notInclude(Zotero.ItemTypes.getPrimaryTypes().map(x => x.name), 'attachment');
			});
		});
	});
	
	describe("Zotero.CharacterSets", function() {
		describe("#toCanonical()", function() {
			let toCanon = Zotero.CharacterSets.toCanonical.bind(Zotero.CharacterSets);
			it("should return charset name given a normalized charset name", function() {
				assert.equal(toCanon('utf-8'), 'utf-8');
				assert.equal(toCanon('windows-1252'), 'windows-1252');
				assert.equal(toCanon('utf-16be'), 'utf-16be')
			});
			it("should return charset name given a label", function() {
				assert.equal(toCanon('unicode-1-1-utf-8'), 'utf-8');
				assert.equal(toCanon('ISO-8859-16'), 'iso-8859-16', 'converts compatibility label to name');
				assert.equal(toCanon('Chinese'), 'gbk', 'not case sensitive');
				assert.equal(toCanon('\ncp1252 '), 'windows-1252', 'ignores leading/trailing whitespace');
			});
			it("should return big5-hkscs for big5-hkscs", function() {
				assert.equal(toCanon('big5-hkscs'), 'big5-hkscs');
			});
			it("should return false for invalid charset", function() {
				assert.isFalse(toCanon('foo'));
			});
		});
		describe("#toLabel()", function() {
			let toLabel = Zotero.CharacterSets.toLabel.bind(Zotero.CharacterSets);
			it("should return a compatibility label given a charset name", function() {
				assert.equal(toLabel('utf-8'), 'UTF-8');
				assert.equal(toLabel('gbk'), 'GBK', 'returns GBK in non-mozCompat mode');
				assert.equal(toLabel('macintosh'), 'macintosh', 'unspecified compatibility mappings are unchanged');
			});
			it("should return gbk in mozCompat mode", function() {
				assert.equal(toLabel('gbk', true), 'gbk');
			});
			it("should return false for invalid charset", function() {
				assert.isFalse(toLabel('foo'));
			});
		});
	});
});