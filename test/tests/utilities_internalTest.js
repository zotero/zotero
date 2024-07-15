"use strict";

describe("Zotero.Utilities.Internal", function () {
	var ZUI;
		
	before(function () {
		ZUI = Zotero.Utilities.Internal;
	});
	
	
	
	describe("#md5()", function () {
		it("should generate hex string given file path", function* () {
			var file = OS.Path.join(getTestDataDirectory().path, 'test.png');
			assert.equal(
				Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(file)),
				'93da8f1e5774c599f0942dcecf64b11c'
			);
		})
	})
	
	
	describe("#md5Async()", function () {
		it("should generate hex string given file path", function* () {
			var file = OS.Path.join(getTestDataDirectory().path, 'test.png');
			yield assert.eventually.equal(
				Zotero.Utilities.Internal.md5Async(file),
				'93da8f1e5774c599f0942dcecf64b11c'
			);
		});
		
		it("should generate hex string given file path for file bigger than chunk size", function* () {
			var tmpDir = Zotero.getTempDirectory().path;
			var file = OS.Path.join(tmpDir, 'md5Async');
			
			let encoder = new TextEncoder();
			let arr = encoder.encode("".padStart(100000, "a"));
			yield OS.File.writeAtomic(file, arr);
			
			yield assert.eventually.equal(
				Zotero.Utilities.Internal.md5Async(file),
				'1af6d6f2f682f76f80e606aeaaee1680'
			);
			
			yield OS.File.remove(file);
		});
		
		it("should return false for a nonexistent file", async function () {
			var tmpDir = Zotero.getTempDirectory().path;
			var file = OS.Path.join(tmpDir, 'nonexistent-asawefaweoihafa');
			await assert.eventually.isFalse(ZUI.md5Async(file));
		});
		
		it("should return hash for an empty file", async function () {
			const emptyHash = 'd41d8cd98f00b204e9800998ecf8427e';
			
			var tmpDir = Zotero.getTempDirectory().path;
			var file = OS.Path.join(tmpDir, 'empty-file');
			await IOUtils.write(file, new Uint8Array());
			
			await assert.eventually.equal(ZUI.md5Async(file), emptyHash);
			
			await IOUtils.remove(file);
		});
	})
	
	
	describe("#gzip()/gunzip()", function () {
		it("should compress and decompress a Unicode text string", function* () {
			var text = "Voilà! \u1F429";
			var compstr = yield Zotero.Utilities.Internal.gzip(text);
			assert.isAbove(compstr.length, 0);
			assert.notEqual(compstr.length, text.length);
			var str = yield Zotero.Utilities.Internal.gunzip(compstr);
			assert.equal(str, text);
		});
	});
	
	
	describe("#decodeUTF8()", function () {
		it("should properly decode binary string", async function () {
			let text = String.fromCharCode.apply(null, new Uint8Array([226, 130, 172]));
			let utf8 = Zotero.Utilities.Internal.decodeUTF8(text);
			assert.equal(utf8, "€");
		});
	});
	
	
	describe("#containsEmoji()", function () {
		it("should return true for text with an emoji", function () {
			assert.isTrue(Zotero.Utilities.Internal.containsEmoji("🐩 Hello 🐩"));
		});
		
		it("should return true for text with an emoji with text representation that use Variation Selector-16", function () {
			assert.isTrue(Zotero.Utilities.Internal.containsEmoji("This is a ⭐️"));
		});
		
		it("should return true for text with an emoji made up of multiple characters with ZWJ", function () {
			assert.isTrue(Zotero.Utilities.Internal.containsEmoji("I am a 👨‍🌾"));
		});
		
		it("should return false for integer", function () {
			assert.isFalse(Zotero.Utilities.Internal.containsEmoji("0"));
		});
	});
	
	describe("#delayGenerator", function () {
		var spy;
		
		before(function () {
			spy = sinon.spy(Zotero.Promise, "delay");
		});
		
		afterEach(function () {
			spy.resetHistory();
		});
		
		after(function () {
			spy.restore();
		});
		
		it("should delay for given amounts of time without limit", function* () {
			var intervals = [1, 2];
			var gen = Zotero.Utilities.Internal.delayGenerator(intervals);
			
			// When intervals are exhausted, keep using last interval
			var testIntervals = intervals.slice();
			testIntervals.push(intervals[intervals.length - 1]);
			
			for (let i of testIntervals) {
				let val = yield gen.next().value;
				assert.isTrue(val);
				assert.isTrue(spy.calledWith(i));
				spy.resetHistory();
			}
		});
		
		it("should return false when maxTime is reached", function* () {
			var intervals = [5, 10];
			var gen = Zotero.Utilities.Internal.delayGenerator(intervals, 30);
			
			// When intervals are exhausted, keep using last interval
			var testIntervals = intervals.slice();
			testIntervals.push(intervals[intervals.length - 1]);
			
			for (let i of testIntervals) {
				let val = yield gen.next().value;
				assert.isTrue(val);
				assert.isTrue(spy.calledWith(i));
				spy.resetHistory();
			}
			
			// Another interval would put us over maxTime, so return false immediately
			let val = yield gen.next().value;
			assert.isFalse(val);
			assert.isFalse(spy.called);
		});
	});
	
	
	describe("#extractExtraFields()", function () {
		it("should ignore 'Type: note', 'Type: attachment', and 'Type: annotation'", function () {
			for (let type of ['note', 'attachment', 'annotation']) {
				let str = `Type: ${type}`;
				let { itemType, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
				assert.isNull(itemType, type);
				assert.equal(extra, `Type: ${type}`, type);
			}
		});
		
		it("should ignore numeric values for Type", function () {
			for (let type of ['3']) {
				let str = `Type: ${type}`;
				let { itemType, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
				assert.isNull(itemType, type);
				assert.equal(extra, `Type: ${type}`, type);
			}
		});
		
		it("should use the first mapped Zotero type for a CSL type", function () {
			var str = 'type: personal_communication';
			var { itemType, fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(itemType, 'letter');
		});
		
		it("should extract a field", function () {
			var val = '10.1234/abcdef';
			var str = `DOI: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a field for a given item", function () {
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			var val = '10.1234/abcdef';
			var str = `DOI: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a CSL field", function () {
			var val = '10.1234/abcdef';
			var str = `container-title: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, Zotero.Schema.CSL_TEXT_MAPPINGS['container-title'].length);
			assert.equal(fields.get('publicationTitle'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a CSL field for a given item type", function () {
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			var val = '10.1234/abcdef';
			var str = `container-title: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('publicationTitle'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a field with different case", function () {
			var val = '10.1234/abcdef';
			var str = `doi: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a field with other fields, text, and whitespace", function () {
			var date = '2020-04-01';
			var doi = '10.1234/abcdef';
			var str = `Line 1\nDate: ${date}\nFoo: Bar\nDOI: ${doi}\n\nLine 2`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 2);
			assert.equal(fields.get('date'), date);
			assert.equal(fields.get('DOI'), doi);
			assert.equal(extra, 'Line 1\nFoo: Bar\n\nLine 2');
		});
		
		it("should extract the first instance of a field", function () {
			var date1 = '2020-04-01';
			var date2 = '2020-04-02';
			var str = `Date: ${date1}\nDate: ${date2}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('date'), date1);
			assert.equal(extra, "Date: " + date2);
		});
		
		it("shouldn't extract a field from a line that begins with a whitespace", function () {
			var str = '\n number-of-pages: 11';
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 0);
		});
		
		it("shouldn't extract a field that already exists on the item", function () {
			var item = createUnsavedDataObject('item', { itemType: 'book' });
			item.setField('numPages', 10);
			var str = 'number-of-pages: 11';
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.equal(fields.size, 0);
		});
		
		it("should extract an author and add it to existing creators", function () {
			var item = createUnsavedDataObject('item', { itemType: 'book' });
			item.setCreator(0, { creatorType: 'author', name: 'Foo' });
			var str = 'author: Bar';
			var { fields, creators, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.equal(fields.size, 0);
			assert.lengthOf(creators, 1);
			assert.equal(creators[0].creatorType, 'author');
			assert.equal(creators[0].name, 'Bar');
		});
		
		it("should extract a CSL date field", function () {
			var str = 'issued: 2000';
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('date'), 2000);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a CSL name", function () {
			var str = 'container-author: Last || First';
			var { creators, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.lengthOf(creators, 1);
			assert.propertyVal(creators[0], 'creatorType', 'bookAuthor');
			assert.propertyVal(creators[0], 'firstName', 'First');
			assert.propertyVal(creators[0], 'lastName', 'Last');
			assert.strictEqual(extra, '');
		});
		
		it("should extract a CSL name that's valid for a given item type", function () {
			var item = createUnsavedDataObject('item', { itemType: 'bookSection' });
			var str = 'container-author: Last || First';
			var { creators, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.lengthOf(creators, 1);
			assert.propertyVal(creators[0], 'creatorType', 'bookAuthor');
			assert.propertyVal(creators[0], 'firstName', 'First');
			assert.propertyVal(creators[0], 'lastName', 'Last');
			assert.strictEqual(extra, '');
		});
		
		it("shouldn't extract a CSL name that's not valid for a given item type", function () {
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			var str = 'container-author: Last || First';
			var { creators, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.lengthOf(creators, 0);
			assert.strictEqual(extra, str);
		});
		
		it("should extract the citeproc-js cheater syntax", function () {
			var issued = '{:number-of-pages:11}\n{:issued:2014}';
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(issued);
			assert.equal(fields.size, 2);
			assert.equal(fields.get('numPages'), 11);
			assert.equal(fields.get('date'), 2014);
			assert.strictEqual(extra, '');
		});
		
		it("should ignore empty creator in citeproc-js cheater syntax", function () {
			var str = '{:author: }\n';
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 0);
			assert.strictEqual(extra, str);
		});
	});
	
	describe("#combineExtraFields", function () {
		var originalDate = "1887";
		var publicationPlace = "New York";
		var doi = '10.1234/123456789';
		var fieldMap = new Map();
		fieldMap.set('originalDate', originalDate);
		fieldMap.set('publicationPlace', publicationPlace);
		fieldMap.set('DOI', doi);
		var fieldStr = `DOI: ${doi}\nOriginal Date: ${originalDate}\nPublication Place: ${publicationPlace}`;
		
		it("should create 'field: value' pairs from field map", function () {
			var extra = "";
			var newExtra = ZUI.combineExtraFields(extra, fieldMap);
			assert.equal(newExtra, fieldStr);
		});
		
		it("should add fields above existing Extra content", function () {
			var extra = "This is a note.";
			var newExtra = ZUI.combineExtraFields(extra, fieldMap);
			assert.equal(newExtra, fieldStr + '\n' + extra);
		});
		
		it("should replace existing fields", function () {
			var extra = "This is a note.\nOriginal Date: 1886\nFoo: Bar";
			var newExtra = ZUI.combineExtraFields(extra, fieldMap);
			assert.equal(
				newExtra,
				fieldStr.split(/\n/).filter(x => !x.startsWith('Original Date')).join("\n")
					+ "\nThis is a note.\nOriginal Date: 1887\nFoo: Bar"
			);
		});
	});
	
	describe("#extractIdentifiers()", function () {
		it("should extract ISBN-10", async function () {
			var id = "0838985890";
			var identifiers = ZUI.extractIdentifiers(id);
			assert.lengthOf(identifiers, 1);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.propertyVal(identifiers[0], "ISBN", id);
		});
		
		it("should extract ISBN-13", async function () {
			var identifiers = ZUI.extractIdentifiers("978-0838985892");
			assert.lengthOf(identifiers, 1);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.propertyVal(identifiers[0], "ISBN", "9780838985892");
		});
		
		it("should extract multiple ISBN-13s", async function () {
			var identifiers = ZUI.extractIdentifiers("978-0838985892 9781479347711 ");
			assert.lengthOf(identifiers, 2);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.lengthOf(Object.keys(identifiers[1]), 1);
			assert.propertyVal(identifiers[0], "ISBN", "9780838985892");
			assert.propertyVal(identifiers[1], "ISBN", "9781479347711");
		});
		
		it("should extract DOI", async function () {
			var id = "10.4103/0976-500X.85940";
			var identifiers = ZUI.extractIdentifiers(id);
			assert.lengthOf(identifiers, 1);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.propertyVal(identifiers[0], "DOI", id);
		});
		
		it("should extract PMID", async function () {
			var identifiers = ZUI.extractIdentifiers("1 PMID:24297125,222 3-4 1234567890, 123456789");
			assert.lengthOf(identifiers, 4);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.lengthOf(Object.keys(identifiers[1]), 1);
			assert.lengthOf(Object.keys(identifiers[2]), 1);
			assert.lengthOf(Object.keys(identifiers[3]), 1);
			assert.propertyVal(identifiers[0], "PMID", "1");
			assert.propertyVal(identifiers[1], "PMID", "24297125");
			assert.propertyVal(identifiers[2], "PMID", "222");
			assert.propertyVal(identifiers[3], "PMID", "123456789");
		});
		
		it("should extract multiple old and new style arXivs", async function () {
			var identifiers = ZUI.extractIdentifiers("0706.0044 arXiv:0706.00441v1,12345678,hep-ex/9809001v1, math.GT/0309135.");
			assert.lengthOf(identifiers, 4);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.lengthOf(Object.keys(identifiers[1]), 1);
			assert.lengthOf(Object.keys(identifiers[2]), 1);
			assert.lengthOf(Object.keys(identifiers[3]), 1);
			assert.propertyVal(identifiers[0], "arXiv", "0706.0044");
			assert.propertyVal(identifiers[1], "arXiv", "0706.00441");
			assert.propertyVal(identifiers[2], "arXiv", "hep-ex/9809001");
			assert.propertyVal(identifiers[3], "arXiv", "math.GT/0309135");
		});

		it("should extract ADS bibcodes", async function () {
			var identifiers = ZUI.extractIdentifiers("9 2021wfc..rept....8D, 2022MSSP..16208010Y.");
			assert.lengthOf(identifiers, 2);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.lengthOf(Object.keys(identifiers[1]), 1);
			assert.propertyVal(identifiers[0], "adsBibcode", "2021wfc..rept....8D");
			assert.propertyVal(identifiers[1], "adsBibcode", "2022MSSP..16208010Y");
		});
	});
	
	describe("#resolveLocale()", function () {
		var availableLocales;
		
		before(function () {
			availableLocales = Services.locale.availableLocales;
		});
		
		function resolve(locale) {
			return Zotero.Utilities.Internal.resolveLocale(locale, availableLocales);
		}
		
		it("should return en-US for en-US", function () {
			assert.equal(resolve('en-US'), 'en-US');
		});
		
		it("should return en-US for en", function () {
			assert.equal(resolve('en'), 'en-US');
		});
		
		it("should return fr-FR for fr-FR", function () {
			assert.equal(resolve('fr-FR'), 'fr-FR');
		});
		
		it("should return fr-FR for fr", function () {
			assert.equal(resolve('fr'), 'fr-FR');
		});
		
		it("should return ar for ar", function () {
			assert.equal(resolve('ar'), 'ar');
		});
		
		it("should return pt-PT for pt", function () {
			assert.equal(resolve('pt'), 'pt-PT');
		});
		
		it("should return zh-CN for zh-CN", function () {
			assert.equal(resolve('zh-CN'), 'zh-CN');
		});
		
		it("should return zh-TW for zh-TW", function () {
			assert.equal(resolve('zh-TW'), 'zh-TW');
		});
		
		it("should return zh-CN for zh", function () {
			assert.equal(resolve('zh'), 'zh-CN');
		});
	});
	
	describe("#camelToTitleCase()", function () {
		it("should convert 'fooBar' to 'Foo Bar'", function () {
			assert.equal(Zotero.Utilities.Internal.camelToTitleCase('fooBar'), 'Foo Bar');
		});
		
		it("should keep all-caps strings intact", function () {
			assert.equal(Zotero.Utilities.Internal.camelToTitleCase('DOI'), 'DOI');
		});
		
		it("should convert 'fooBAR' to 'Foo BAR'", function () {
			assert.equal(Zotero.Utilities.Internal.camelToTitleCase('fooBAR'), 'Foo BAR');
		});

	});
	
	describe("#getNextName()", function () {
		it("should get the next available numbered name", function () {
			var existing = ['Name', 'Name 1', 'Name 3'];
			assert.equal(Zotero.Utilities.Internal.getNextName('Name', existing), 'Name 2');
		});
		
		it("should return 'Name 1' if no numbered names", function () {
			var existing = ['Name'];
			assert.equal(Zotero.Utilities.Internal.getNextName('Name', existing), 'Name 1');
		});
		
		it("should return 'Name' if only numbered names", function () {
			var existing = ['Name 1', 'Name 3'];
			assert.equal(Zotero.Utilities.Internal.getNextName('Name', existing), 'Name');
		});
		
		it("should trim given name if trim=true", function () {
			var existing = ['Name', 'Name 1', 'Name 2', 'Name 3'];
			assert.equal(Zotero.Utilities.Internal.getNextName('Name 2', existing, true), 'Name 4');
		});
	});

	describe("#parseURL()", function () {
		var f;
		before(() => {
			f = Zotero.Utilities.Internal.parseURL;
		});

		describe("#fileName", function () {
			it("should contain filename", function () {
				assert.propertyVal(f('http://example.com/abc/def.html?foo=bar'), 'fileName', 'def.html');
			});

			it("should be empty if no filename", function () {
				assert.propertyVal(f('http://example.com/abc/'), 'fileName', '');
			});
		});

		describe("#fileExtension", function () {
			it("should contain extension", function () {
				assert.propertyVal(f('http://example.com/abc/def.html?foo=bar'), 'fileExtension', 'html');
			});

			it("should be empty if no extension", function () {
				assert.propertyVal(f('http://example.com/abc/def'), 'fileExtension', '');
			});

			it("should be empty if no filename", function () {
				assert.propertyVal(f('http://example.com/abc/'), 'fileExtension', '');
			});
		});

		describe("#fileBaseName", function () {
			it("should contain base name", function () {
				assert.propertyVal(f('http://example.com/abc/def.html?foo=bar'), 'fileBaseName', 'def');
			});

			it("should equal filename if no extension", function () {
				assert.propertyVal(f('http://example.com/abc/def'), 'fileBaseName', 'def');
			});

			it("should be empty if no filename", function () {
				assert.propertyVal(f('http://example.com/abc/'), 'fileBaseName', '');
			});
		});
	});

	describe("#generateHTMLFromTemplate()", function () {
		it("should support variables with attributes", function () {
			var vars = {
				v1: '1',
				v2: pars => `${pars.a1 ?? ''}${pars.a2 ?? ''}${pars.a3 ?? ''}`,
				v3: () => '',
				v5: () => 'something',
				ar1: [],
				ar2: [1, 2]
			};
			var template = `{{ v1}}{{v2 a1= "1"  a2 =' 2' a3 = "3 "}}{{v3}}{{v4}}{{if ar1}}ar1{{endif}}{{if ar2}}{{ar2}}{{endif}}{{if v5}}yes{{endif}}{{if v3}}no1{{endif}}{{if v2}}{{v2}}{{endif}}`;
			var html = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(html, '11 23 1,2yes');
		});

		it("should support empty string as attribute value and correctly render returned false-ish values", function () {
			const vars = {
				length: ({ string }) => string.length.toString(),
			};
			const template = `"" has a length of {{ length string="" }} and "hello" has a length of {{ length string="hello" }}`;
			const out = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(out, '"" has a length of 0 and "hello" has a length of 5');
		});

		it("should support functions in comparison statements", function () {
			const vars = {
				sum: ({ a, b }) => (parseInt(a) + parseInt(b)).toString(),
				fooBar: ({ isFoo }) => (isFoo === 'true' ? 'foo' : 'bar'),
				false: 'false',
				twoWords: 'two words',
				onlyOne: 'actually == 1'
			};
			const template = `{{if {{ sum a="1" b="2" }} == "3"}}1 + 2 = {{sum a="1" b="2"}}{{else}}no speak math{{endif}}`;
			const out = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(out, '1 + 2 = 3');

			const template2 = '{{if false != "false"}}no{{elseif false == "false"}}yes{{else}}no{{endif}}';
			const out2 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template2, vars);
			assert.equal(out2, 'yes');

			const template3 = '{{ if twoWords == "two words" }}yes{{else}}no{{endif}}';
			const out3 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template3, vars);
			assert.equal(out3, 'yes');

			const template4 = '{{ if onlyOne == \'actually == 1\' }}yes{{else}}no{{endif}}';
			const out4 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template4, vars);
			assert.equal(out4, 'yes');

			const template5 = '{{ if "3" == {{ sum a="1" b="2" }} }}yes{{else}}no{{endif}}';
			const out5 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template5, vars);
			assert.equal(out5, 'yes');

			const template6 = '{{ if {{ sum a="1" b="2" }} }}yes{{else}}no{{endif}}';
			const out6 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template6, vars);
			assert.equal(out6, 'yes');

			const template7 = '{{ if {{ twoWords }} }}yes{{else}}no{{endif}}';
			const out7 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template7, vars);
			assert.equal(out7, 'yes');

			const template8 = '{{ if twoWords }}yes{{else}}no{{endif}}';
			const out8 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template8, vars);
			assert.equal(out8, 'yes');

			const template9 = '{{ if missing }}no{{else}}yes{{endif}}';
			const out9 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template9, vars);
			assert.equal(out9, 'yes');

			const template10 = '{{ if {{ missing foo="bar" }} }}no{{else}}yes{{endif}}';
			const out10 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template10, vars);
			assert.equal(out10, 'yes');

			const template11 = '{{ if {{ missing foo="bar" }} == "" }}yes{{else}}no{{endif}}';
			const out11 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template11, vars);
			assert.equal(out11, 'yes');

			const template12 = '{{ if fooBar == "bar" }}yes{{else}}no{{endif}}';
			const out12 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template12, vars);
			assert.equal(out12, 'yes');

			const template13 = '{{ if {{ fooBar }} == "bar" }}yes{{else}}no{{endif}}';
			const out13 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template13, vars);
			assert.equal(out13, 'yes');

			const template14 = `{{if {{ sum a="1" b="2" }}=="3"}}1 + 2 = {{sum a="1" b="2"}}{{else}}no{{endif}}`;
			const out14 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template14, vars);
			assert.equal(out14, '1 + 2 = 3');
			
			const template15 = `{{if "two words"==twoWords}}yes{{else}}no{{endif}}`;
			const out15 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template15, vars);
			assert.equal(out15, 'yes');
		});

		it("should accept hyphen-case variables and attributes", function () {
			const vars = {
				fooBar: ({ isFoo }) => (isFoo === 'true' ? 'foo' : 'bar'),
			};
			const template = '{{ foo-bar is-foo="true" }}{{ if {{ foo-bar is-foo="false" }} == "bar" }}{{ foo-bar is-foo="false" }}{{ endif }}';
			const out = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(out, 'foobar');
		});

		it("should work with a condition in the middle", function () {
			const vars = {
				v1: '1',
			};
			const template = 'test {{ if v1 == "1" }}yes{{ else }}no{{ endif }} foobar';
			const out = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(out, 'test yes foobar');
		});

		it("missing identifiers are evaluted as empty string", function () {
			const vars = {
				foo: 'foo',
			};
			const template = '{{bar}}{{ if foo == "" }}no{{elseif foo}}{{foo}}{{else}}no{{endif}}';
			const out = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(out, 'foo');

			const template2 = 'test: {{ if bar == "" }}yes{{else}}no{{endif}}';
			const out2 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template2, vars);
			assert.equal(out2, 'test: yes');
		});

		it("should preserve whitespace outside of brackets", function () {
			const template = ' starts }} with {{ whitespace  	{"test"}  ==  \'foobar\'   ';
			const out = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, {});
			assert.equal(out, template);
			const vars = {
				space: ' ',
				spaceFn: () => ' ',
			};

			const whitespace = ' {{if spaceFn}}{{else}}  {{endif}}{{space}} {{space-fn}}';
			const out2 = Zotero.Utilities.Internal.generateHTMLFromTemplate(whitespace, vars);
			assert.equal(out2, '    ');
		});

		it("should accept array values in logic statements", function () {
			let someTags = ['foo', 'bar'];
			const vars = {
				tags: ({ join }) => (join ? someTags.join(join) : someTags),
			};
			const template = '{{ if tags }}#{{ tags join=" #" }}{{else}}no tags{{endif}}';
			const out = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(out, '#foo #bar');

			someTags = [];
			const out2 = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(out2, 'no tags');
		});


		it("should throw if function returns anything else than a string (or an array which is always joined into string)", function () {
			const vars = {
				number: () => 1,
				logic: () => true,
				array: () => [],
				fn: () => 1,
			};
			assert.throws(() => Zotero.Utilities.Internal.generateHTMLFromTemplate('{{ number }}', vars), /Identifier "number" does not evaluate to a string/);
			assert.throws(() => Zotero.Utilities.Internal.generateHTMLFromTemplate('{{ logic }}', vars), /Identifier "logic" does not evaluate to a string/);
			assert.throws(() => Zotero.Utilities.Internal.generateHTMLFromTemplate('{{ if fn }}no{{endif}}', vars), /Identifier "fn" does not evaluate to a string/);
			assert.throws(() => Zotero.Utilities.Internal.generateHTMLFromTemplate('{{ if {{ fn foo="bar" }} }}no{{endif}}', vars), /Identifier "fn" does not evaluate to a string/);
		});

		it("should support nested 'if' statements", function () {
			var vars = {
				v1: '1',
				v2: 'H',
			};
			var template = `{{if v1 == '1'}}yes1{{if x}}no{{elseif v2  == "h" }}yes2{{endif}}{{elseif v2 == "2"}}no{{else}}no{{endif}} {{if v2 == "1"}}not{{elseif x}}not{{else}}yes3{{ endif}}`;
			var html = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			assert.equal(html, 'yes1yes2 yes3');
		});
	});
});
