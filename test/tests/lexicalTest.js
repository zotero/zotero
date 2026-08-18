"use strict";

describe("Zotero.Lexical", function () {
	describe("#parseQuery()", function () {
		it("should split a query into normalized word units", function () {
			// Trailing space: the last word is finished, so nothing is a prefix
			let units = Zotero.Lexical.parseQuery("OWL Migrátion ");
			assert.deepEqual(units, [
				{ type: 'word', text: 'owl', prefix: false },
				{ type: 'word', text: 'migration', prefix: false }
			]);
		});

		it("should flag the trailing mid-word token as a prefix", function () {
			let units = Zotero.Lexical.parseQuery("owl migr");
			assert.deepEqual(units, [
				{ type: 'word', text: 'owl', prefix: false },
				{ type: 'word', text: 'migr', prefix: true }
			]);
			// Punctuation after the word means it's finished too
			units = Zotero.Lexical.parseQuery("owl migr.");
			assert.isFalse(units[1].prefix);
		});

		it("should keep a quoted multi-word part as one exact phrase", function () {
			let units = Zotero.Lexical.parseQuery('"united states" owl');
			assert.deepEqual(units, [
				{ type: 'phrase', text: 'united states', tokens: ['united', 'states'] },
				{ type: 'word', text: 'owl', prefix: true }
			]);
		});

		it("should treat a quoted single word as an exact word", function () {
			let units = Zotero.Lexical.parseQuery('"owl"');
			assert.deepEqual(units, [
				{ type: 'word', text: 'owl', prefix: false }
			]);
		});

		it("should split a mixed-script part into word and CJK units", function () {
			let units = Zotero.Lexical.parseQuery("covid疫情");
			assert.deepEqual(units, [
				{ type: 'word', text: 'covid', prefix: false },
				{ type: 'cjk', text: '疫情', bigrams: '疫情' }
			]);
		});

		it("should carry a CJK run as its overlapping bigrams", function () {
			let units = Zotero.Lexical.parseQuery("疫情控制 ");
			assert.deepEqual(units, [
				{ type: 'cjk', text: '疫情控制', bigrams: '疫情 情控 控制' }
			]);
		});

		it("should carry a single CJK character with no bigrams", function () {
			let units = Zotero.Lexical.parseQuery("疫 ");
			assert.deepEqual(units, [
				{ type: 'cjk', text: '疫', bigrams: null }
			]);
		});

		it("should count a repeated term once, preferring its exact form", function () {
			// The trailing 'owl' would be a prefix, but the query already
			// contains it as a finished word
			let units = Zotero.Lexical.parseQuery("owl migration owl");
			assert.deepEqual(units, [
				{ type: 'word', text: 'owl', prefix: false },
				{ type: 'word', text: 'migration', prefix: false }
			]);
		});

		it("should return no units for text with nothing to match", function () {
			assert.deepEqual(Zotero.Lexical.parseQuery(""), []);
			assert.deepEqual(Zotero.Lexical.parseQuery("   "), []);
			assert.deepEqual(Zotero.Lexical.parseQuery("!!! ..."), []);
		});
	});

	describe("#analyzeQuery()", function () {
		var stubs = [];

		afterEach(function () {
			stubs.forEach(stub => stub.restore());
			stubs = [];
		});

		function stubStatistics(corpusSize, dfByText) {
			stubs.push(sinon.stub(Zotero.Lexical, 'getCorpusSize')
				.resolves(corpusSize));
			stubs.push(sinon.stub(Zotero.Lexical, 'getDocumentFrequency')
				.callsFake(async unit => dfByText[unit.text] ?? 0));
		}

		it("should weight terms by rarity, with ubiquitous ones near zero", async function () {
			stubStatistics(1000, { fall: 600, of: 1000, communism: 5 });
			let units = await Zotero.Lexical.analyzeQuery("fall of communism ");
			let byText = new Map(units.map(unit => [unit.text, unit]));
			// "communism" is what decides this query's ranking
			assert.isAbove(byText.get('communism').weight, byText.get('fall').weight);
			assert.isAbove(byText.get('fall').weight, byText.get('of').weight);
			// A term in every document carries almost nothing -- the stoplist,
			// without a stoplist
			assert.isBelow(byText.get('of').weight, 0.001);
			// The documented formula: ln(1 + (N - df + 0.5) / (df + 0.5))
			assert.approximately(
				byText.get('communism').weight,
				Math.log(1 + (1000 - 5 + 0.5) / (5 + 0.5)),
				1e-12
			);
		});

		it("should give a term in no document the query's maximum weight", async function () {
			stubStatistics(1000, { communism: 5, zzunseen: 0 });
			let units = await Zotero.Lexical.analyzeQuery("communism zzunseen ");
			let byText = new Map(units.map(unit => [unit.text, unit]));
			assert.isAbove(byText.get('zzunseen').weight, byText.get('communism').weight);
		});

		it("should degrade to uniform weights with no corpus", async function () {
			stubStatistics(0, {});
			let units = await Zotero.Lexical.analyzeQuery("owl migration routes ");
			assert.lengthOf(units, 3);
			for (let unit of units) {
				assert.approximately(unit.weight, Math.log(2), 1e-12);
			}
		});

		it("should look up statistics once per unique unit", async function () {
			stubStatistics(1000, { owl: 3, migration: 40 });
			await Zotero.Lexical.analyzeQuery("owl owl migration owl ");
			// The two deduplicated words, plus their pair
			assert.equal(Zotero.Lexical.getDocumentFrequency.callCount, 3);
		});

		it("should form a weighted pair for adjacent informative words", async function () {
			stubStatistics(1000, { special: 100, education: 150, 'special education': 8 });
			let units = await Zotero.Lexical.analyzeQuery("special education ");
			assert.lengthOf(units, 3);
			let pair = units[2];
			assert.equal(pair.type, 'pair');
			assert.equal(pair.text, 'special education');
			assert.deepEqual(pair.tokens, ['special', 'education']);
			assert.isFalse(pair.prefix);
			assert.isTrue(pair.informative);
			// Weighted by the adjacency's own rarity, which outweighs the words
			assert.approximately(pair.weight,
				Math.log(1 + (1000 - 8 + 0.5) / (8 + 0.5)), 1e-12);
			assert.isAbove(pair.weight, units[0].weight);
		});

		it("should let a trailing prefix pair match completions", async function () {
			stubStatistics(1000, { special: 100, education: 150, 'special education': 8 });
			let units = await Zotero.Lexical.analyzeQuery("special education");
			let pair = units.find(unit => unit.type == 'pair');
			assert.isTrue(pair.prefix);
		});

		it("should drop a pair no document contains", async function () {
			stubStatistics(1000, { special: 100, education: 150 });
			let units = await Zotero.Lexical.analyzeQuery("special education ");
			assert.lengthOf(units, 2);
			assert.isTrue(units.every(unit => unit.type == 'word'));
		});

		it("shouldn't pair through an uninformative word", async function () {
			stubStatistics(1000, {
				fall: 600, of: 1000, communism: 5,
				'fall of': 300, 'of communism': 4
			});
			let units = await Zotero.Lexical.analyzeQuery("fall of communism ");
			// "of" is uninformative, so neither word adjacent to it pairs
			assert.isTrue(units.every(unit => unit.type == 'word'));
		});
	});

	describe("term statistics", function () {
		// Fabricated corpus rows inserted straight into the real content
		// index, with rowids no item can collide with
		const BASE_ROWID = 900000000;
		var inserted = [];

		async function addDoc(id, text, cjkBigrams) {
			let rowid = BASE_ROWID + id;
			await Zotero.DB.queryAsync(
				"INSERT INTO ftindex.fulltextContent (rowid, text) VALUES (?, ?)",
				[rowid, Zotero.Utilities.Internal.normalizeForSearch(text) || '']
			);
			if (cjkBigrams) {
				await Zotero.DB.queryAsync(
					"INSERT INTO ftindex.fulltextContentCJK (rowid, text) VALUES (?, ?)",
					[rowid, cjkBigrams]
				);
			}
			await Zotero.DB.queryAsync(
				"REPLACE INTO ftindex.fulltextIndexState (itemID, version) VALUES (?, 1)",
				[rowid]
			);
			inserted.push(rowid);
		}

		after(async function () {
			for (let rowid of inserted) {
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextContent WHERE rowid=?", rowid);
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextContentCJK WHERE rowid=?", rowid);
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", rowid);
			}
		});

		it("should count the documents matching a word, not its occurrences", async function () {
			await addDoc(1, "lexowl migration and lexowl wintering across the lexbaltic");
			await addDoc(2, "lexowl feeding grounds");
			await addDoc(3, "entirely unrelated text");
			let df = unit => Zotero.Lexical.getDocumentFrequency(unit);
			assert.equal(await df({ type: 'word', text: 'lexowl', prefix: false }), 2);
			assert.equal(await df({ type: 'word', text: 'lexbaltic', prefix: false }), 1);
			assert.equal(await df({ type: 'word', text: 'lexmissing', prefix: false }), 0);
			// Words match whole tokens, not substrings
			assert.equal(await df({ type: 'word', text: 'lexow', prefix: false }), 0);
		});

		it("should count a prefix unit against every completion", async function () {
			assert.equal(await Zotero.Lexical.getDocumentFrequency(
				{ type: 'word', text: 'lexow', prefix: true }
			), 2);
		});

		it("should count a phrase by adjacent occurrence in order", async function () {
			let df = unit => Zotero.Lexical.getDocumentFrequency(unit);
			assert.equal(await df(
				{ type: 'phrase', text: 'lexowl migration', tokens: ['lexowl', 'migration'] }
			), 1);
			assert.equal(await df(
				{ type: 'phrase', text: 'migration lexowl', tokens: ['migration', 'lexowl'] }
			), 0);
		});

		it("should count CJK units against the 2-gram index", async function () {
			await addDoc(4, "lexchinese document", '疫情 情控 控制');
			let df = unit => Zotero.Lexical.getDocumentFrequency(unit);
			assert.equal(await df(
				{ type: 'cjk', text: '疫情控制', bigrams: '疫情 情控 控制' }
			), 1);
			assert.equal(await df({ type: 'cjk', text: '疫情', bigrams: '疫情' }), 1);
			// Not adjacent in the document
			assert.equal(await df({ type: 'cjk', text: '控疫', bigrams: '控疫' }), 0);
			// A single character approximates by the bigrams it starts...
			assert.equal(await df({ type: 'cjk', text: '疫', bigrams: null }), 1);
			// ...so one that only ever ends a run undercounts -- the
			// documented blind spot of the approximation
			assert.equal(await df({ type: 'cjk', text: '制', bigrams: null }), 0);
		});

		it("should measure corpus size from the index state", async function () {
			let before = await Zotero.Lexical.getCorpusSize();
			await addDoc(5, "lexcorpus size probe");
			assert.equal(await Zotero.Lexical.getCorpusSize(), before + 1);
		});
	});

	// A unit from an analyzed list by its text, for asserting on one term
	function unitByText(units, text) {
		return units.find(unit => unit.text == text);
	}

	describe("combined statistics", function () {
		const BASE_ROWID = 920000000;
		var inserted = [];

		async function addContentDoc(id, text) {
			let rowid = BASE_ROWID + id;
			await Zotero.DB.queryAsync(
				"INSERT INTO ftindex.fulltextContent (rowid, text) VALUES (?, ?)",
				[rowid, Zotero.Utilities.Internal.normalizeForSearch(text) || '']
			);
			await Zotero.DB.queryAsync(
				"REPLACE INTO ftindex.fulltextIndexState (itemID, version) VALUES (?, 1)",
				[rowid]
			);
			inserted.push(rowid);
			return rowid;
		}

		after(async function () {
			for (let rowid of inserted) {
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextContent WHERE rowid=?", rowid);
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", rowid);
			}
		});

		it("should count document frequency across content and item text", async function () {
			await addContentDoc(1, "lexcross appears in a document");
			await createDataObject('item', { title: 'Lexcross appears in a title' });
			assert.equal(await Zotero.Lexical.getDocumentFrequency(
				{ type: 'word', text: 'lexcross', prefix: false }
			), 2);
		});

		it("should count items toward the corpus size", async function () {
			let before = await Zotero.Lexical.getCorpusSize();
			await createDataObject('item', { title: 'Lexcorpus member item' });
			assert.equal(await Zotero.Lexical.getCorpusSize(), before + 1);
		});

		it("should keep a term cheap for an annotation when the library is full of it", async function () {
			this.timeout(60000);
			// The term saturates the content corpus...
			let corpusSize = await Zotero.Lexical.getCorpusSize();
			for (let i = 0; i < corpusSize + 10; i++) {
				await addContentDoc(100 + i, `lexeverywhere document ${i}`);
			}
			// ...and appears once in an annotation
			let item = await createDataObject('item');
			let attachment = await importPDFAttachment(item);
			await createAnnotation('highlight', attachment,
				{ comment: 'lexeverywhere in a comment' });

			let units = await Zotero.Lexical.analyzeQuery("lexeverywhere lexveryrare ");
			let everywhere = unitByText(units, 'lexeverywhere');
			let rare = unitByText(units, 'lexveryrare');
			// Rarity is a property of the library, not of where the match
			// lands: the saturated term is worth little anywhere, including
			// in the annotation, and gets cut from retrieval
			assert.isBelow(everywhere.weight, rare.weight * 0.2);
			assert.isFalse(everywhere.informative);
			assert.isTrue(rare.informative);
		});

		it("should keep the best unit informative in an all-common query", async function () {
			let stubs = [
				sinon.stub(Zotero.Lexical, 'getCorpusSize').resolves(1000),
				sinon.stub(Zotero.Lexical, 'getDocumentFrequency').resolves(950)
			];
			try {
				let units = await Zotero.Lexical.analyzeQuery("common words only ");
				assert.isTrue(units.every(unit => unit.informative));
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("#matchContent()", function () {
		const BASE_ROWID = 930000000;
		var inserted = [];

		async function addContentDoc(id, text, cjkBigrams) {
			let rowid = BASE_ROWID + id;
			await Zotero.DB.queryAsync(
				"INSERT INTO ftindex.fulltextContent (rowid, text) VALUES (?, ?)",
				[rowid, Zotero.Utilities.Internal.normalizeForSearch(text) || '']
			);
			if (cjkBigrams) {
				await Zotero.DB.queryAsync(
					"INSERT INTO ftindex.fulltextContentCJK (rowid, text) VALUES (?, ?)",
					[rowid, cjkBigrams]
				);
			}
			await Zotero.DB.queryAsync(
				"REPLACE INTO ftindex.fulltextIndexState (itemID, version) VALUES (?, 1)",
				[rowid]
			);
			inserted.push(rowid);
			return rowid;
		}

		after(async function () {
			for (let rowid of inserted) {
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextContent WHERE rowid=?", rowid);
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextContentCJK WHERE rowid=?", rowid);
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", rowid);
			}
		});

		it("should report presence for units a document contains", async function () {
			let doc = await addContentDoc(1, "lexprobe migration study text");
			let other = await addContentDoc(2, "entirely unrelated content");
			let units = await Zotero.Lexical.analyzeQuery("lexprobe missingword ");
			let strengths = await Zotero.Lexical.matchContent(units, [doc, other]);
			assert.equal(strengths.get(doc).get(unitByText(units, 'lexprobe')), 1);
			assert.isFalse(strengths.get(doc).has(unitByText(units, 'missingword')));
			assert.isFalse(strengths.has(other));
		});

		it("should only report the requested candidates", async function () {
			let units = await Zotero.Lexical.analyzeQuery("lexprobe ");
			let strengths = await Zotero.Lexical.matchContent(units, [BASE_ROWID + 2]);
			assert.isFalse(strengths.has(BASE_ROWID + 1));
		});

		it("should match a prefix unit against its completions", async function () {
			let units = await Zotero.Lexical.analyzeQuery("lexprob");
			assert.isTrue(units[0].prefix);
			let strengths = await Zotero.Lexical.matchContent(units, [BASE_ROWID + 1]);
			assert.equal(strengths.get(BASE_ROWID + 1).get(units[0]), 1);
		});

		it("should match CJK units against the 2-gram index", async function () {
			let doc = await addContentDoc(3, "lexcjk carrier", '疫情 情控 控制');
			let units = await Zotero.Lexical.analyzeQuery("疫情控制 ");
			let strengths = await Zotero.Lexical.matchContent(units, [doc]);
			assert.equal(strengths.get(doc).get(units[0]), 1);
		});

		it("should verify a phrase against the document's stored text", async function () {
			this.timeout(60000);
			let item = await createDataObject('item');
			let attachment = await importPDFAttachment(item);
			await Zotero.Fulltext.indexItems([attachment.id]);

			// "easy-to-use" in the document: hyphens and spaces separate the
			// same words, so the phrase verifies
			let units = await Zotero.Lexical.analyzeQuery('"easy to use" probe');
			let phrase = units.find(unit => unit.type == 'phrase');
			let strengths = await Zotero.Lexical.matchContent([phrase], [attachment.id]);
			assert.equal(strengths.get(attachment.id).get(phrase), 1);

			// "collect, organize" in the document: adjacent for the index,
			// but the comma has to match literally, so verification rejects it
			units = await Zotero.Lexical.analyzeQuery('"collect organize" probe');
			phrase = units.find(unit => unit.type == 'phrase');
			strengths = await Zotero.Lexical.matchContent([phrase], [attachment.id]);
			assert.isFalse(strengths.has(attachment.id));
		});
	});

	describe("#matchFields()", function () {
		it("should report title and abstract matches separately, at full strength", async function () {
			let item = await createDataObject('item', { title: 'Owl migration atlas' });
			item.setField('abstractNote', 'Statistical methods for tracking studies');
			await item.saveTx();

			let units = await Zotero.Lexical.analyzeQuery("migration statistical ");
			let result = await Zotero.Lexical.matchFields(units, [item.id]);
			assert.equal(result.title.get(item.id).get(unitByText(units, 'migration')), 1);
			assert.isFalse(result.title.get(item.id).has(unitByText(units, 'statistical')));
			assert.equal(result.abstract.get(item.id).get(unitByText(units, 'statistical')), 1);
			assert.isFalse(result.abstract.get(item.id).has(unitByText(units, 'migration')));
		});

		it("should match whole words, with the trailing prefix matching completions", async function () {
			let item = await createDataObject('item', { title: 'Rainfall patterns' });
			let units = await Zotero.Lexical.analyzeQuery("fall ");
			let result = await Zotero.Lexical.matchFields(units, [item.id]);
			assert.isFalse(result.title.has(item.id));
			units = await Zotero.Lexical.analyzeQuery("rain");
			result = await Zotero.Lexical.matchFields(units, [item.id]);
			assert.equal(result.title.get(item.id).get(units[0]), 1);
		});

		it("should match titles diacritic-insensitively", async function () {
			let item = await createDataObject('item', { title: 'Müller précis studies' });
			let units = await Zotero.Lexical.analyzeQuery("muller precis ");
			let result = await Zotero.Lexical.matchFields(units, [item.id]);
			assert.equal(result.title.get(item.id).get(unitByText(units, 'muller')), 1);
			assert.equal(result.title.get(item.id).get(unitByText(units, 'precis')), 1);
		});

		it("should verify a phrase against the stored title", async function () {
			// Adjacent for the index either way; only the hyphen reads as a
			// space literally
			let hyphenated = await createDataObject('item',
				{ title: 'Lexuno-lexdos analysis' });
			let punctuated = await createDataObject('item',
				{ title: 'Lexuno. Lexdos analysis' });
			let units = await Zotero.Lexical.analyzeQuery('"lexuno lexdos" probe');
			let phrase = units.find(unit => unit.type == 'phrase');
			let result = await Zotero.Lexical.matchFields(
				[phrase], [hyphenated.id, punctuated.id]);
			assert.equal(result.title.get(hyphenated.id).get(phrase), 1);
			assert.isFalse(result.title.has(punctuated.id));
		});
	});

	describe("#matchNotes()", function () {
		it("should score a note that returns to a term above one passing mention", async function () {
			let focused = new Zotero.Item('note');
			focused.setNote('<p>Lexowls hunt at night. Lexowls migrate. Lexowls return.</p>');
			await focused.saveTx();
			let passing = new Zotero.Item('note');
			let filler = Array.from({ length: 200 }, (x, i) => `note${i}`).join(' ');
			passing.setNote(`<p>One mention of lexowls. ${filler}</p>`);
			await passing.saveTx();

			let units = await Zotero.Lexical.analyzeQuery("lexowls ");
			let strengths = await Zotero.Lexical.matchNotes(units, [focused.id, passing.id]);
			let unit = units[0];
			assert.isAbove(strengths.get(focused.id).get(unit),
				strengths.get(passing.id).get(unit));
			assert.isAbove(strengths.get(passing.id).get(unit), 0);
			assert.isBelow(strengths.get(focused.id).get(unit), 1);
		});

		it("should match whole words only", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>Heavy rainfall in the region</p>');
			await note.saveTx();
			let units = await Zotero.Lexical.analyzeQuery("fall ");
			let strengths = await Zotero.Lexical.matchNotes(units, [note.id]);
			assert.isFalse(strengths.has(note.id));
		});

		it("should match an indexed note through the index", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>Lexindexed observations here today</p>');
			await note.saveTx();
			await Zotero.FullText.processNoteIndexQueue();
			let units = await Zotero.Lexical.analyzeQuery("lexindexed ");
			let strengths = await Zotero.Lexical.matchNotes(units, [note.id]);
			assert.isAbove(strengths.get(note.id).get(units[0]), 0);
		});

		it("should match a just-edited note by its current text", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>lexoldword only here</p>');
			await note.saveTx();
			await Zotero.FullText.processNoteIndexQueue();
			note.setNote('<p>lexnewword replaces it</p>');
			await note.saveTx();

			let units = await Zotero.Lexical.analyzeQuery("lexoldword lexnewword ");
			let strengths = await Zotero.Lexical.matchNotes(units, [note.id]);
			assert.isTrue(strengths.get(note.id).has(unitByText(units, 'lexnewword')));
			assert.isFalse(strengths.get(note.id).has(unitByText(units, 'lexoldword')));
		});

		it("should match a note the index doesn't have yet", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>lexunindexed content waiting for backfill</p>');
			await note.saveTx();
			// Simulate a note that predates the index
			await Zotero.DB.queryAsync(
				"DELETE FROM ftindex.fulltextNoteIndexState WHERE itemID=?", note.id);
			await Zotero.DB.queryAsync(
				"DELETE FROM ftindex.fulltextItemText WHERE rowid=?", note.id);
			let units = await Zotero.Lexical.analyzeQuery("lexunindexed ");
			let strengths = await Zotero.Lexical.matchNotes(units, [note.id]);
			assert.isAbove(strengths.get(note.id).get(units[0]), 0);
		});

		it("should count a phrase literally", async function () {
			let hyphenated = new Zotero.Item('note');
			hyphenated.setNote('<p>The lexunited-states policy record</p>');
			await hyphenated.saveTx();
			let punctuated = new Zotero.Item('note');
			punctuated.setNote('<p>The lexunited. States policy record</p>');
			await punctuated.saveTx();

			let units = await Zotero.Lexical.analyzeQuery('"lexunited states" probe');
			let phrase = units.find(unit => unit.type == 'phrase');
			let strengths = await Zotero.Lexical.matchNotes(
				[phrase], [hyphenated.id, punctuated.id]);
			assert.isAbove(strengths.get(hyphenated.id).get(phrase), 0);
			assert.isFalse(strengths.has(punctuated.id));
		});

		it("should count a pair on adjacent tokens, whatever separates them", async function () {
			let adjacent = new Zotero.Item('note');
			adjacent.setNote('<p>The lexpaired, states policy record</p>');
			await adjacent.saveTx();
			let apart = new Zotero.Item('note');
			apart.setNote('<p>The lexpaired policy states record</p>');
			await apart.saveTx();

			// A pair means the index's adjacency, so unlike a quoted phrase
			// the comma doesn't disqualify the match
			let pair = {
				type: 'pair',
				text: 'lexpaired states',
				tokens: ['lexpaired', 'states'],
				prefix: false
			};
			let strengths = await Zotero.Lexical.matchNotes(
				[pair], [adjacent.id, apart.id]);
			assert.isAbove(strengths.get(adjacent.id).get(pair), 0);
			assert.isFalse(strengths.has(apart.id));
		});
	});

	describe("#scoreItemIDs()", function () {
		const BASE_ROWID = 940000000;
		var inserted = [];

		async function addContentDoc(id, text) {
			let rowid = BASE_ROWID + id;
			await Zotero.DB.queryAsync(
				"INSERT INTO ftindex.fulltextContent (rowid, text) VALUES (?, ?)",
				[rowid, Zotero.Utilities.Internal.normalizeForSearch(text) || '']
			);
			await Zotero.DB.queryAsync(
				"REPLACE INTO ftindex.fulltextIndexState (itemID, version) VALUES (?, 1)",
				[rowid]
			);
			inserted.push(rowid);
			return rowid;
		}

		after(async function () {
			for (let rowid of inserted) {
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextContent WHERE rowid=?", rowid);
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", rowid);
			}
		});

		it("should rank the query's words adjacent above the words scattered", async function () {
			let adjacent = await createDataObject('item',
				{ title: 'Lexadjacent special education handbook' });
			let scattered = await createDataObject('item',
				{ title: 'Lexadjacent education for the special handbook' });

			let scores = await Zotero.Lexical.scoreItemIDs(
				'lexadjacent special education ', [adjacent.id, scattered.id]);
			assert.isAbove(scores.get(adjacent.id), scores.get(scattered.id));
		});

		it("should rank coverage over partial matches, wherever they land", async function () {
			// The walkthrough corpus: full coverage in a title, partial
			// coverage in a title, partial coverage in a document, and noise
			// containing none of the query's words. (Whether "in"/"the" count
			// as informative depends on the corpus -- in this test library
			// they can be rare enough to -- so the full title carries every
			// query word.)
			let full = await createDataObject('item',
				{ title: 'Lexsowl lexsmigration in the lexsunited lexsstates' });
			let census = await createDataObject('item',
				{ title: 'Lexsunited lexsstates census records' });
			let norway = await addContentDoc(1,
				'lexsowl lexsmigration routes across norway seasons');
			let noise = await addContentDoc(2, 'lexsother archive entry');

			let scores = await Zotero.Lexical.scoreItemIDs(
				'lexsowl lexsmigration in the lexsunited lexsstates ',
				[full.id, census.id, norway, noise]
			);
			// Full coverage at full strength in the best source is the
			// ceiling itself
			assert.approximately(scores.get(full.id), 1, 0.001);
			// Everything with an informative match is in, ranked under it...
			assert.isAbove(scores.get(full.id), scores.get(census.id));
			assert.isAbove(scores.get(census.id), 0);
			assert.isAbove(scores.get(norway), 0);
			// ...and matching nothing the query asked for is no match at all
			assert.isFalse(scores.has(noise));
		});

		it("should count the same unit once, at its best source", async function () {
			let item = await createDataObject('item', { title: 'Lexsboth appears here' });
			item.setField('abstractNote', 'Lexsboth appears in the abstract too');
			await item.saveTx();
			let scores = await Zotero.Lexical.scoreItemIDs('lexsboth ', [item.id]);
			// Title and abstract both match; max, not sum -- a score of
			// exactly 1 proves no double counting
			assert.approximately(scores.get(item.id), 1, 0.001);
		});

		it("should grade document matches relative to each other", async function () {
			let filler = Array.from({ length: 300 }, (x, i) => `lexsfill${i}`).join(' ');
			let buried = await addContentDoc(3, `lexsdeep ${filler}`);
			let focused = await addContentDoc(4, 'lexsdeep lexsdeep lexsdeep summary');
			let scores = await Zotero.Lexical.scoreItemIDs(
				'lexsdeep ', [buried, focused]);
			// The strongest document anchors the unit's full strength: one
			// unit at content boost against a title-boosted ceiling
			assert.approximately(scores.get(focused), 0.5, 0.001);
			if (scores.has(buried)) {
				assert.isBelow(scores.get(buried), scores.get(focused));
			}
		});

		it("should drop scores below the floor", async function () {
			let stubs = [
				sinon.stub(Zotero.Lexical, 'analyzeQuery').resolves([
					{ type: 'word', text: 'big', prefix: false, df: 1, weight: 5, informative: true },
					{ type: 'word', text: 'small', prefix: false, df: 1, weight: 1, informative: true }
				]),
				sinon.stub(Zotero.Lexical, 'matchContent').callsFake(
					async (units, itemIDs) => new Map([
						// One item barely touches both units; another matches
						// the big one outright
						[itemIDs[0], new Map([[units[0], 0.05], [units[1], 0.1]])],
						[itemIDs[1], new Map([[units[0], 1]])]
					])
				),
				sinon.stub(Zotero.Lexical, 'matchFields').resolves(
					{ title: new Map(), abstract: new Map() }),
				sinon.stub(Zotero.Lexical, 'matchNotes').resolves(new Map()),
				sinon.stub(Zotero.Lexical, 'matchAnnotations').resolves(new Map())
			];
			try {
				let scores = await Zotero.Lexical.scoreItemIDs('anything', [1, 2]);
				// (5 * 0.05 + 1 * 0.1) / 12 is under the floor; (5 * 1) / 12 is
				// well over
				assert.isFalse(scores.has(1));
				assert.isAbove(scores.get(2), 0.4);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should drop an item whose only match is a minor unit", async function () {
			let stubs = [
				sinon.stub(Zotero.Lexical, 'analyzeQuery').resolves([
					{ type: 'word', text: 'fall', prefix: false, df: 1000, weight: 2, informative: true },
					{ type: 'word', text: 'ussr', prefix: false, df: 50, weight: 5, informative: true }
				]),
				sinon.stub(Zotero.Lexical, 'matchFields').callsFake(
					async (units, itemIDs) => ({
						title: new Map(),
						abstract: new Map([
							// Only the minor word; only the dominant word; both
							[itemIDs[0], new Map([[units[0], 1]])],
							[itemIDs[1], new Map([[units[1], 1]])],
							[itemIDs[2], new Map([[units[0], 1], [units[1], 1]])]
						])
					})
				),
				sinon.stub(Zotero.Lexical, 'matchContent').resolves(new Map()),
				sinon.stub(Zotero.Lexical, 'matchNotes').resolves(new Map()),
				sinon.stub(Zotero.Lexical, 'matchAnnotations').resolves(new Map())
			];
			try {
				let scores = await Zotero.Lexical.scoreItemIDs('anything', [1, 2, 3]);
				// "fall" alone carries 2/7 of the query -- not a match, however
				// it scores
				assert.isFalse(scores.has(1));
				// "ussr" alone dominates the query -- a match
				assert.isAbove(scores.get(2), 0);
				// Coverage always qualifies, and outranks the lone match
				assert.isAbove(scores.get(3), scores.get(2));
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should return nothing for a query with no units", async function () {
			assert.equal((await Zotero.Lexical.scoreItemIDs('', [1])).size, 0);
			assert.equal((await Zotero.Lexical.scoreItemIDs('!!! ...', [1])).size, 0);
		});

		it("should abandon scoring when cancelled", async function () {
			let item = await createDataObject('item', { title: 'Lexscancel target' });
			let e = await getPromiseError(Zotero.Lexical.scoreItemIDs(
				'lexscancel ', [item.id], { shouldCancel: () => true }));
			assert.instanceOf(e, Zotero.Lexical.ScoringCancelledError);
		});
	});

	describe("#matchAnnotations()", function () {
		it("should match an annotation's passage and comment at full strength", async function () {
			this.timeout(60000);
			let item = await createDataObject('item');
			let attachment = await importPDFAttachment(item);
			let annotation = await createAnnotation('highlight', attachment,
				{ comment: 'lexanno methodology worry' });

			let units = await Zotero.Lexical.analyzeQuery("lexanno missingword ");
			let strengths = await Zotero.Lexical.matchAnnotations(
				units, [annotation.id, attachment.id]);
			assert.equal(strengths.get(annotation.id).get(unitByText(units, 'lexanno')), 1);
			assert.isFalse(strengths.get(annotation.id).has(unitByText(units, 'missingword')));
			assert.isFalse(strengths.has(attachment.id));
		});

		it("should match annotations diacritic-insensitively", async function () {
			this.timeout(60000);
			let item = await createDataObject('item');
			let attachment = await importPDFAttachment(item);
			let annotation = await createAnnotation('highlight', attachment,
				{ comment: 'Müller réviewed this lexdiacritic passage' });

			let units = await Zotero.Lexical.analyzeQuery("muller reviewed lexdiacritic ");
			let strengths = await Zotero.Lexical.matchAnnotations(units, [annotation.id]);
			for (let unit of units) {
				assert.equal(strengths.get(annotation.id).get(unit), 1);
			}
		});
	});

	describe("#getMatchingExcerpts()", function () {
		function rangeTexts(excerpt) {
			return excerpt.ranges.map(([start, end]) => excerpt.text.slice(start, end));
		}

		it("should excerpt a regular item's title and abstract, marking matches as written", async function () {
			let item = await createDataObject('item', { title: 'Lexkwic Owl Migrátion Atlas' });
			// Long enough that the match sits past any excerpt window
			item.setField('abstractNote',
				'Filler sentences pad this abstract out well past the window. '.repeat(6)
					+ 'Here the owl population finally appears.');
			await item.saveTx();

			let excerpts = await Zotero.Lexical.getMatchingExcerpts('owl migration ', item.id);
			assert.lengthOf(excerpts, 2);

			// The title covers both words at the title boost, so it leads,
			// whole and unelided. The words are adjacent, so their ranges and
			// the pair's span merge into one mark, in the original casing and
			// diacritics.
			let title = excerpts[0];
			assert.equal(title.source, 'title');
			assert.equal(title.text, 'Lexkwic Owl Migrátion Atlas');
			assert.deepEqual(rangeTexts(title), ['Owl Migrátion']);

			// The abstract excerpt is a window around its match, elided at
			// the start but running to the text's end
			let abstract = excerpts[1];
			assert.equal(abstract.source, 'abstract');
			assert.isTrue(abstract.text.startsWith('…'));
			assert.isFalse(abstract.text.endsWith('…'));
			assert.deepEqual(rangeTexts(abstract), ['owl']);

			// Strengths are 0-1 fractions of the query's ceiling: the title
			// shows everything the query asked at the best boost, the
			// abstract only part of it
			assert.equal(title.strength, 1);
			assert.isAbove(abstract.strength, 0);
			assert.isBelow(abstract.strength, title.strength);
		});

		it("should highlight the whole word a prefix unit matches", async function () {
			let item = await createDataObject('item', { title: 'Lexkwic Migration Study' });

			let excerpts = await Zotero.Lexical.getMatchingExcerpts('migr', item.id);
			assert.lengthOf(excerpts, 1);
			assert.deepEqual(rangeTexts(excerpts[0]), ['Migration']);
		});

		it("should excerpt attachment content around a verified phrase", async function () {
			this.timeout(60000);
			let item = await createDataObject('item');
			let attachment = await importPDFAttachment(item);
			await Zotero.Fulltext.indexItems([attachment.id]);

			// "easy-to-use" in the document: the phrase's spaces match its
			// hyphens, and the range marks the hyphenated original
			let excerpts = await Zotero.Lexical.getMatchingExcerpts('"easy to use"', attachment.id);
			assert.isNotEmpty(excerpts);
			assert.equal(excerpts[0].source, 'content');
			assert.match(rangeTexts(excerpts[0])[0], /^easy[\s-]+to[\s-]+use$/i);
		});

		it("should excerpt a note's text without its markup", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>Lexkwic owls fly at <b>night</b> over water</p>');
			await note.saveTx();

			let excerpts = await Zotero.Lexical.getMatchingExcerpts('lexkwic night ', note.id);
			assert.lengthOf(excerpts, 1);
			assert.equal(excerpts[0].source, 'note');
			assert.notInclude(excerpts[0].text, '<');
			assert.deepEqual(rangeTexts(excerpts[0]), ['Lexkwic', 'night']);
		});

		it("should excerpt an annotation's comment", async function () {
			this.timeout(60000);
			let item = await createDataObject('item');
			let attachment = await importPDFAttachment(item);
			let annotation = await createAnnotation('highlight', attachment,
				{ comment: 'Lexkwic owls in the comment' });

			let excerpts = await Zotero.Lexical.getMatchingExcerpts('lexkwic ', annotation.id);
			assert.isNotEmpty(excerpts);
			let comment = excerpts.find(excerpt => rangeTexts(excerpt)[0] == 'Lexkwic');
			assert.equal(comment.source, 'annotation');
		});

		it("should cap the excerpts at the limit, strongest first", async function () {
			let item = await createDataObject('item', { title: 'No match here' });
			// Five matches, each in its own window's worth of filler
			item.setField('abstractNote',
				Array.from({ length: 5 },
					(_, i) => `lexkwic sighting ${i} ` + 'filler '.repeat(40)).join(''));
			await item.saveTx();

			let excerpts = await Zotero.Lexical.getMatchingExcerpts('lexkwic ', item.id,
				{ limit: 2 });
			assert.lengthOf(excerpts, 2);
			for (let excerpt of excerpts) {
				assert.equal(excerpt.source, 'abstract');
				assert.deepEqual(rangeTexts(excerpt), ['lexkwic']);
			}
		});

		it("should return nothing for an empty query or an unmatched item", async function () {
			let item = await createDataObject('item', { title: 'Lexkwic quiet title' });
			assert.isEmpty(await Zotero.Lexical.getMatchingExcerpts('', item.id));
			assert.isEmpty(await Zotero.Lexical.getMatchingExcerpts('absentword ', item.id));
		});
	});

	describe("#findMatchRanges()", function () {
		it("should mark where the query matches in given texts", async function () {
			// Give the pair a corpus occurrence, so the query analyzes with it
			await createDataObject('item', { title: 'Lexranges owl migration anchor' });
			let [first, second, third] = await Zotero.Lexical.findMatchRanges(
				'owl migration ',
				['The Owl Migrátion Atlas', 'nothing relevant here', 'an owl alone']
			);
			// Adjacent words merge with their pair into one span
			assert.deepEqual(first, [[4, 17]]);
			assert.deepEqual(second, []);
			assert.deepEqual(third, [[3, 6]]);
		});

		it("should mark nothing for an empty query", async function () {
			assert.deepEqual(
				await Zotero.Lexical.findMatchRanges('', ['some text']),
				[[]]
			);
		});
	});
});
