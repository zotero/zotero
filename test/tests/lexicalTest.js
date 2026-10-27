"use strict";

describe("Zotero.Lexical", function () {
	describe("#parseQuery()", function () {
		it("should split a query into normalized word terms", function () {
			let terms = Zotero.Lexical.parseQuery("OWL Migrátion");
			assert.deepEqual(terms, [
				{ type: 'word', text: 'owl', prefix: false },
				{ type: 'word', text: 'migration', prefix: false }
			]);
		});

		it("should flag a word the query put an asterisk after as a prefix", function () {
			let terms = Zotero.Lexical.parseQuery("owl migr*");
			assert.deepEqual(terms, [
				{ type: 'word', text: 'owl', prefix: false },
				{ type: 'word', text: 'migr', prefix: true }
			]);
			// Any word can carry one, not just the last
			terms = Zotero.Lexical.parseQuery("migr* owl");
			assert.isTrue(terms[0].prefix);
			assert.isFalse(terms[1].prefix);
			// An unfinished word is exact unless the query says otherwise
			assert.isFalse(Zotero.Lexical.parseQuery("owl migr")[1].prefix);
		});

		it("should treat an asterisk inside quotes as literal text", function () {
			assert.deepEqual(Zotero.Lexical.parseQuery('"migr*"'), [
				{ type: 'word', text: 'migr', prefix: false }
			]);
		});

		it("should keep a quoted multi-word part as one exact phrase", function () {
			let terms = Zotero.Lexical.parseQuery('"united states" owl');
			assert.deepEqual(terms, [
				{ type: 'phrase', text: 'united states', tokens: ['united', 'states'] },
				{ type: 'word', text: 'owl', prefix: false }
			]);
		});

		it("should treat a quoted single word as an exact word", function () {
			let terms = Zotero.Lexical.parseQuery('"owl"');
			assert.deepEqual(terms, [
				{ type: 'word', text: 'owl', prefix: false }
			]);
		});

		it("should split a mixed-script part into word and CJK terms", function () {
			let terms = Zotero.Lexical.parseQuery("covid疫情");
			assert.deepEqual(terms, [
				{ type: 'word', text: 'covid', prefix: false },
				{ type: 'cjk', text: '疫情', bigrams: '疫情' }
			]);
		});

		it("should carry a CJK run as its overlapping bigrams", function () {
			let terms = Zotero.Lexical.parseQuery("疫情控制 ");
			assert.deepEqual(terms, [
				{ type: 'cjk', text: '疫情控制', bigrams: '疫情 情控 控制' }
			]);
		});

		it("should carry a single CJK character with no bigrams", function () {
			let terms = Zotero.Lexical.parseQuery("疫 ");
			assert.deepEqual(terms, [
				{ type: 'cjk', text: '疫', bigrams: null }
			]);
		});

		it("should count a repeated term once, preferring its exact form", function () {
			// One 'owl' carries an asterisk, but the query also asked for it
			// exactly
			let terms = Zotero.Lexical.parseQuery("owl migration owl*");
			assert.deepEqual(terms, [
				{ type: 'word', text: 'owl', prefix: false },
				{ type: 'word', text: 'migration', prefix: false }
			]);
		});

		it("should return no terms for text with nothing to match", function () {
			assert.deepEqual(Zotero.Lexical.parseQuery(""), []);
			assert.deepEqual(Zotero.Lexical.parseQuery("   "), []);
			assert.deepEqual(Zotero.Lexical.parseQuery("!!! ..."), []);
		});
	});

	describe("#buildExpression()", function () {
		function pieces(queryText, family) {
			let built = Zotero.Lexical.buildExpression(
				Zotero.Lexical.parseQuery(queryText), family);
			return built && built.pieces.map(
				piece => piece.match + ' x' + piece.repetitions);
		}

		it("should OR the query's words together, repeated against its phrases", function () {
			assert.deepEqual(pieces("special education ", 'word'), [
				'"special" x3',
				'"education" x3',
				'"special education" x1'
			]);
		});

		it("should add a phrase term for each consecutive pair of words", function () {
			assert.deepEqual(pieces("fall of communism ", 'word'), [
				'"fall" x3',
				'"of" x3',
				'"communism" x3',
				'"fall of" x1',
				'"of communism" x1'
			]);
		});

		it("should expand the expression from the pieces and their repetitions", function () {
			let built = Zotero.Lexical.buildExpression(
				Zotero.Lexical.parseQuery("owl migration "), 'word');
			assert.equal(built.expression,
				'"owl" OR "owl" OR "owl" OR "migration" OR "migration" OR "migration" '
					+ 'OR "owl migration"');
		});

		it("should carry a prefix into the word and its phrase", function () {
			assert.deepEqual(pieces("special educat*", 'word'), [
				'"special" x3',
				'"educat"* x3',
				'"special educat"* x1'
			]);
		});

		it("should keep a quoted phrase as one term, unrepeated", function () {
			assert.deepEqual(pieces('"united states" owl ', 'word'), [
				'"united states" x1',
				'"owl" x3'
			]);
		});

		it("should build CJK runs from their bigrams, and nothing else", function () {
			assert.deepEqual(pieces("疫情控制 ", 'cjk'), ['"疫情 情控 控制" x1']);
			// A single character has no bigram, so it matches every bigram
			// starting with it
			assert.deepEqual(pieces("疫 ", 'cjk'), ['"疫"* x1']);
			// Words never go to the 2-gram index
			assert.isNull(pieces("owl ", 'cjk'));
		});

		it("should route a mixed-script query to both families", function () {
			assert.deepEqual(pieces("covid疫情 ", 'word'), ['"covid" x3']);
			assert.deepEqual(pieces("covid疫情 ", 'cjk'), ['"疫情" x1']);
		});

		it("should return null when the query has nothing for a family", function () {
			assert.isNull(Zotero.Lexical.buildExpression([], 'word'));
			assert.isNull(Zotero.Lexical.buildExpression([], 'cjk'));
		});
	});

	describe("#buildProximityExpression()", function () {
		function expression(queryText, family = 'word') {
			return Zotero.Lexical.buildProximityExpression(
				Zotero.Lexical.parseQuery(queryText), family);
		}

		it("should gather every word of a short query in one window", function () {
			assert.equal(expression("fall communism "),
				'NEAR("fall" "communism", 200)');
			assert.equal(expression("owl migration patterns "),
				'NEAR("owl" "migration" "patterns", 200)');
		});

		it("should let a longer query miss a word, in any position", function () {
			assert.equal(expression("a1 b2 c3 d4 "), [
				'NEAR("a1" "b2" "c3", 200)',
				'NEAR("a1" "b2" "d4", 200)',
				'NEAR("a1" "c3" "d4", 200)',
				'NEAR("b2" "c3" "d4", 200)'
			].join(' OR '));
		});

		it("should carry prefixes and phrases as terms", function () {
			assert.equal(expression('owl* "barn owl" '),
				'NEAR("owl"* "barn owl", 200)');
		});

		it("should gate each family on its own terms", function () {
			assert.equal(expression("owl 猫头鹰 ", 'word'), null);
			assert.equal(expression("猫头鹰 迁徙 ", 'cjk'),
				'NEAR("猫头 头鹰" "迁徙", 200)');
		});

		it("should return null for a single term, which gathers anywhere", function () {
			assert.isNull(expression("owl "));
			assert.isNull(expression(""));
		});
	});

	describe("#scoreItemIDs()", function () {
		const BASE_ROWID = 940000000;
		var inserted = [];

		// Just the scores
		async function scoresFor(...args) {
			return (await Zotero.Lexical.scoreItemIDs(...args)).scores;
		}

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

		// A corpus of unrelated documents and items, so a test's words are
		// rare in it: in a corpus of two, every query word is in more than
		// half of it, and FTS5 weighs such a word as nothing
		before(async function () {
			let subjects = ['tides', 'granite', 'sonnets', 'bridges', 'yeast',
				'glaciers', 'violins', 'ledgers', 'orchards', 'compasses'];
			for (let i = 0; i < subjects.length; i++) {
				await addContentDoc(900 + i,
					`notes on ${subjects[i]} and their study through the years`);
				await createDataObject('item', { title: `A survey of ${subjects[i]}` });
			}
		});

		after(async function () {
			for (let rowid of inserted) {
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextContent WHERE rowid=?", rowid);
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", rowid);
			}
		});

		it("should match a document only where the query's words share a passage", async function () {
			let near = await addContentDoc(60,
				'the lexproxfall of lexproxcommunism in eastern europe');
			let far = await addContentDoc(61,
				'lexproxcommunism spread widely ' + 'filler '.repeat(300)
					+ 'in the lexproxfall season the leaves drop');
			// An item's own text is a passage already, so one word matches it
			let item = await createDataObject('item',
				{ title: 'Lexproxcommunism in the twentieth century' });

			let scores = await scoresFor(
				'lexproxfall lexproxcommunism', [near, far, item.id]);
			assert.isTrue(scores.has(near));
			assert.isFalse(scores.has(far));
			assert.isTrue(scores.has(item.id));
		});

		it("should admit a document saying most of a longer query in one passage", async function () {
			let most = await addContentDoc(62,
				'lexpcova lexpcovb and lexpcovc discussed here');
			let half = await addContentDoc(63,
				'lexpcova lexpcovb discussed here');
			let scattered = await addContentDoc(64,
				'lexpcova lexpcovb ' + 'filler '.repeat(300) + 'lexpcovc lexpcovd');

			let scores = await scoresFor(
				'lexpcova lexpcovb lexpcovc lexpcovd', [most, half, scattered]);
			// Three of four words in one passage is saying the query...
			assert.isTrue(scores.has(most));
			// ...two of four isn't, and neither is all four spread apart
			assert.isFalse(scores.has(half));
			assert.isFalse(scores.has(scattered));
		});

		it("should return scores as 0-1 fractions", async function () {
			let item = await createDataObject('item',
				{ title: 'Lexfrac owls of the northern coast' });
			let scores = await scoresFor('lexfrac ', [item.id]);
			let score = scores.get(item.id);
			assert.isAbove(score, 0);
			assert.isAtMost(score, 1);
		});

		it("should rank the query's words adjacent above the words scattered", async function () {
			let adjacent = await createDataObject('item',
				{ title: 'Lexadjacent special education handbook' });
			let scattered = await createDataObject('item',
				{ title: 'Lexadjacent education for the special handbook' });

			let scores = await scoresFor(
				'lexadjacent special education ', [adjacent.id, scattered.id]);
			// Not clearing the floor is the weakest ranking there is, so a
			// missing score reads as 0 either way
			assert.isAbove(scores.get(adjacent.id), scores.get(scattered.id) ?? 0);
		});

		it("should rank coverage above partial matches, wherever they land", async function () {
			// Full coverage in a title, partial coverage in a title, partial
			// coverage in a document, and noise containing none of the query
			let full = await createDataObject('item',
				{ title: 'Lexsowl lexsmigration in the lexsunited lexsstates' });
			let census = await createDataObject('item',
				{ title: 'Lexsunited lexsstates census records' });
			let norway = await addContentDoc(1,
				'lexsowl lexsmigration routes across norway seasons');
			let noise = await addContentDoc(2, 'lexsother archive entry');

			let scores = await scoresFor(
				'lexsowl lexsmigration in the lexsunited lexsstates ',
				[full.id, census.id, norway, noise]
			);
			// Full coverage outranks either partial match...
			assert.isAbove(scores.get(full.id), scores.get(census.id) ?? 0);
			assert.isAbove(scores.get(full.id), scores.get(norway) ?? 0);
			// ...and matching nothing the query asked for is no match at all
			assert.isFalse(scores.has(noise));
		});

		it("should rank a title match above the same words in a document", async function () {
			// A document's share is capped below a full short-text match
			let titled = await createDataObject('item',
				{ title: 'Lexcolumn owls of the coast' });
			let document = await addContentDoc(3, 'lexcolumn owls of the coast');
			let scores = await scoresFor(
				'lexcolumn owls ', [titled.id, document]);
			assert.isAbove(scores.get(titled.id), scores.get(document));
		});

		it("should rank an item named by creator and year above a document citing them", async function () {
			let paper = await createDataObject('item', { title: 'Owls of the coast' });
			paper.setCreators([{ firstName: 'Jane', lastName: 'Lexsmithson', creatorType: 'author' }]);
			paper.setField('date', '2019-03-01');
			await paper.saveTx();
			let earlier = await createDataObject('item', { title: 'Coastal wetlands' });
			earlier.setCreators([{ firstName: 'Jane', lastName: 'Lexsmithson', creatorType: 'author' }]);
			earlier.setField('date', '2018-06-01');
			await earlier.saveTx();
			let citing = await addContentDoc(8,
				'as lexsmithson 2019 showed, and lexsmithson 2019 argued again, '
					+ 'the lexsmithson 2019 survey remains the reference');

			let scores = await scoresFor(
				'lexsmithson 2019', [paper.id, earlier.id, citing]);
			// The paper the query names comes first, however often the
			// document repeats its words...
			assert.isAbove(scores.get(paper.id), scores.get(citing));
			// ...and a paper by the same author from another year carries
			// only part of the query
			assert.isAbove(scores.get(paper.id), scores.get(earlier.id));
			assert.isAbove(scores.get(earlier.id), 0);
		});

		it("should match a tag", async function () {
			let tagged = await createDataObject('item',
				{ title: 'Coastal study', tags: [{ tag: 'lextagword' }] });
			let scores = await scoresFor('lextagword ', [tagged.id]);
			assert.isAbove(scores.get(tagged.id), 0);
		});

		it("should not lower a title match for an item with an abstract", async function () {
			let bare = await createDataObject('item', { title: 'Lexabstract owls' });
			let full = await createDataObject('item', { title: 'Lexabstract owls' });
			full.setField('abstractNote', 'Filler sentence about nothing in particular. '.repeat(40));
			await full.saveTx();
			let scores = await scoresFor('lexabstract ', [bare.id, full.id]);
			assert.equal(scores.get(full.id), scores.get(bare.id));
		});

		it("should match a word as a whole token, or by its completions after an asterisk", async function () {
			let item = await createDataObject('item', { title: 'Lexprefixes of owls' });
			let scores = await scoresFor('lexprefix ', [item.id]);
			assert.isFalse(scores.has(item.id));
			scores = await scoresFor('lexprefix*', [item.id]);
			assert.isAbove(scores.get(item.id), 0);
			// Never by the tokens it sits inside
			scores = await scoresFor('refix*', [item.id]);
			assert.isFalse(scores.has(item.id));
		});

		it("should count a note's text no more than a document's", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>Lexnotekind owls</p>');
			await note.saveTx();
			let titled = await createDataObject('item', { title: 'Lexnotekind owls' });
			let scores = await scoresFor('lexnotekind ', [note.id, titled.id]);
			assert.isAbove(scores.get(titled.id), scores.get(note.id));
			assert.isAbove(scores.get(note.id), 0);
		});

		it("should record where the query matched, for marking the matches", async function () {
			let item = await createDataObject('item', { title: 'Lexrecord Owl Atlas' });
			item.setCreators([{ firstName: 'Ada', lastName: 'Lexrecord', creatorType: 'author' }]);
			await item.saveTx();
			let { matches } = await Zotero.Lexical.scoreItemIDs('lexrecord ', [item.id]);
			let record = matches.get(item.id);
			assert.isTrue(record.fields.has(Zotero.ItemFields.getID('title')));
			assert.isTrue(record.creators.has(0));
			assert.isFalse(record.content);

			// The terms it was scored with mark its text the way they matched
			assert.deepEqual(Zotero.Lexical.findHighlightRanges(record.terms, 'Lexrecord Owl Atlas'),
				[[0, 9]]);
			assert.deepEqual(Zotero.Lexical.findHighlightRanges(record.terms, 'Lexrecordson'), []);
			// A wildcard marks the whole token it completes
			assert.deepEqual(Zotero.Lexical.findHighlightRanges(
				Zotero.Lexical.parseQuery('lexrecord*'), 'Lexrecordson'), [[0, 12]]);
		});

		it("should rank a document returning to a term above one passing mention", async function () {
			let filler = Array.from({ length: 300 }, (x, i) => `lexsfill${i}`).join(' ');
			let buried = await addContentDoc(4, `lexsdeep ${filler}`);
			let focused = await addContentDoc(5, 'lexsdeep lexsdeep lexsdeep summary');
			let scores = await scoresFor('lexsdeep ', [buried, focused]);
			assert.isAbove(scores.get(focused), scores.get(buried));
		});

		it("should only score the requested candidates", async function () {
			let wanted = await addContentDoc(6, 'lexcandidate archive one');
			await addContentDoc(7, 'lexcandidate archive two');
			let scores = await scoresFor('lexcandidate ', [wanted]);
			assert.deepEqual([...scores.keys()], [wanted]);
		});

		it("should match a note the index doesn't have yet", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>Lexunindexed owls in a note never indexed</p>');
			await note.saveTx();
			await Zotero.DB.queryAsync(
				"DELETE FROM ftindex.fulltextNoteIndexState WHERE itemID=?", note.id);
			let scores = await scoresFor('lexunindexed ', [note.id]);
			assert.isAbove(scores.get(note.id), 0);
		});

		it("should match a just-edited note by its current text", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>Lexoldword only</p>');
			await note.saveTx();
			await Zotero.FullText.indexItems([note.id]);
			note.setNote('<p>Lexnewword only</p>');
			await note.saveTx();

			let scores = await scoresFor('lexnewword ', [note.id]);
			assert.isAbove(scores.get(note.id), 0);
		});

		it("should weigh a term by its rarity among the library's items", async function () {
			// A word in several items' titles says less than one in a single
			// title, so the item carrying the rare word ranks first
			for (let i = 0; i < 4; i++) {
				await createDataObject('item', { title: `Lexcommonword entry ${i}` });
			}
			let common = await createDataObject('item', { title: 'Lexcommonword only' });
			let rare = await createDataObject('item', { title: 'Lexrareword only' });
			let scores = await scoresFor(
				'lexrareword lexcommonword', [common.id, rare.id]);
			assert.isAbove(scores.get(rare.id), scores.get(common.id));
		});

		it("should return nothing for a query with no terms", async function () {
			assert.equal((await scoresFor('', [1])).size, 0);
			assert.equal((await scoresFor('!!! ...', [1])).size, 0);
		});

		it("should return nothing for no candidates", async function () {
			assert.equal((await scoresFor('owl ', [])).size, 0);
		});

		it("should abandon scoring when cancelled", async function () {
			let item = await createDataObject('item', { title: 'Lexscancel target' });
			let e = await getPromiseError(scoresFor(
				'lexscancel ', [item.id], { shouldCancel: () => true }));
			assert.instanceOf(e, Zotero.Lexical.ScoringCancelledError);
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

			// The title shows both of the query's words, so it leads, whole
			// and unelided, in the original casing and diacritics
			let title = excerpts[0];
			assert.equal(title.source, 'title');
			assert.equal(title.text, 'Lexkwic Owl Migrátion Atlas');
			assert.deepEqual(rangeTexts(title), ['Owl', 'Migrátion']);

			// The abstract excerpt is a window around its match, elided at
			// the start but running to the text's end
			let abstract = excerpts[1];
			assert.equal(abstract.source, 'abstract');
			assert.isTrue(abstract.text.startsWith('…'));
			assert.isFalse(abstract.text.endsWith('…'));
			assert.deepEqual(rangeTexts(abstract), ['owl']);

			// Strength is the share of the query's terms an excerpt shows
			assert.equal(title.strength, 1);
			assert.equal(abstract.strength, 0.5);
		});

		it("should highlight the whole word a prefix term matches", async function () {
			let item = await createDataObject('item', { title: 'Lexkwic Migration Study' });

			let excerpts = await Zotero.Lexical.getMatchingExcerpts('migr*', item.id);
			assert.lengthOf(excerpts, 1);
			assert.deepEqual(rangeTexts(excerpts[0]), ['Migration']);
		});

		it("should excerpt attachment content around a phrase", async function () {
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

		it("should excerpt a regular item's creators, tags and date", async function () {
			let item = await createDataObject('item',
				{ title: 'Coastal owls', tags: [{ tag: 'lexkwic reading' }] });
			item.setCreators([{ firstName: 'Ada', lastName: 'Lexkwic', creatorType: 'author' }]);
			item.setField('date', 'March 2019');
			await item.saveTx();

			let excerpts = await Zotero.Lexical.getMatchingExcerpts('lexkwic 2019', item.id);
			let bySource = Object.fromEntries(excerpts.map(e => [e.source, e]));
			assert.deepEqual(rangeTexts(bySource.creator), ['Lexkwic']);
			assert.deepEqual(rangeTexts(bySource.tag), ['lexkwic']);
			assert.deepEqual(rangeTexts(bySource.date), ['2019']);
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
			// Every fixture word is lex-prefixed so it can't be turned up by
			// another suite's quick search
			let item = await createDataObject('item', { title: 'Lexcap lexheading' });
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
			let [first, second, third] = await Zotero.Lexical.findMatchRanges(
				'owl migration ',
				['The Owl Migrátion Atlas', 'nothing relevant here', 'an owl alone']
			);
			assert.deepEqual(first, [[4, 7], [8, 17]]);
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

	describe("#scoreTexts()", function () {
		it("should score a text carrying the query above one that doesn't", async function () {
			let [carrying, unrelated] = await Zotero.Lexical.scoreTexts(
				'owl migration',
				['owl migration patterns across the tundra', 'a note about something else']
			);
			assert.isAbove(carrying, unrelated);
			assert.equal(unrelated, 0);
			assert.isAtMost(carrying, 1);
		});

		it("should keep every score within 0-1", async function () {
			let scores = await Zotero.Lexical.scoreTexts(
				'owl',
				['owl owl owl owl owl owl owl owl owl owl', 'owl']
			);
			for (let score of scores) {
				assert.isAtLeast(score, 0);
				assert.isAtMost(score, 1);
			}
		});

		it("should weigh terms by their rarity within the given texts", async function () {
			// Every passage of a dinosaur book says 'dinosaur', so among its
			// passages the word separates nothing -- 'weight' is what picks
			// out the passage answering the query, however loudly the others
			// repeat the word the whole document is about
			let spam = 'dinosaur dinosaur dinosaur dinosaur dinosaur everywhere';
			let answer = 'the weight of a grown dinosaur';
			let scores = await Zotero.Lexical.scoreTexts(
				'dinosaur weight',
				[spam, spam, spam, answer]
			);
			let best = Math.max(...scores);
			assert.equal(scores.indexOf(best), 3);
		});

		it("should score nothing for a query with no terms", async function () {
			assert.deepEqual(await Zotero.Lexical.scoreTexts('', ['owl']), [0]);
		});
	});

	describe("#pickQuote()", function () {
		const BASE_ROWID = 950000000;
		const OPTIONS = { longSentence: 200, width: 150 };
		var inserted = [];

		var pick = text => Zotero.Lexical.pickQuote(
			'lexweighrare lexweighcommon', text, Zotero.BestMatch.splitSentences(text), OPTIONS);
		var said = (text, extent) => text.slice(extent.start, extent.end);
		// A long sentence of filler with the given words spliced in where asked
		var longSentence = (words) => {
			let filler = 'the survey covered several plots over many seasons and noted everything seen there '
				.repeat(4).trim().split(' ');
			filler[0] = 'The';
			for (let [index, word] of Object.entries(words)) {
				filler[index] = word;
			}
			return filler.join(' ') + '.';
		};

		// Ten documents: one says the rare word, three the common one
		before(async function () {
			for (let i = 0; i < 10; i++) {
				let words = ['filler text about unrelated matters'];
				if (i < 3) {
					words.push('lexweighcommon');
				}
				if (i == 0) {
					words.push('lexweighrare');
				}
				let rowid = BASE_ROWID + i;
				await Zotero.DB.queryAsync(
					"INSERT INTO ftindex.fulltextContent (rowid, text) VALUES (?, ?)",
					[rowid, words.join(' ')]
				);
				inserted.push(rowid);
			}
		});

		after(async function () {
			for (let rowid of inserted) {
				await Zotero.DB.queryAsync(
					"DELETE FROM ftindex.fulltextContent WHERE rowid=?", rowid);
			}
		});

		it("should pick the sentence where the query weighs the most", async function () {
			// The common word three times, then the rare one once: a repeat
			// adds nothing, and the rarer word weighs more
			let first = 'The lexweighcommon, the lexweighcommon and the lexweighcommon again.';
			let second = 'Only the lexweighrare turns up in this one.';
			let text = `${first} ${second}`;
			let { sentence, line } = await pick(text);
			assert.equal(said(text, sentence), second);
			// A sentence that fits the line is quoted whole
			assert.isUndefined(line);
		});

		it("should add up distinct terms, and take the first sentence on a tie", async function () {
			let sentences = [
				'An opening that says lexweighrare alone.',
				'A middle that says lexweighrare and lexweighcommon both.',
				'A close that says lexweighcommon and lexweighrare too.'
			];
			let text = sentences.join(' ');
			assert.equal(said(text, (await pick(text)).sentence), sentences[1]);
		});

		it("should quote a long sentence as the line with its match toward the middle", async function () {
			let sentence = longSentence({ 30: 'lexweighrare' });
			let text = `A short sentence opens the passage. ${sentence}`;
			let { line } = await pick(text);
			let quoted = said(text, line);
			// Whole words, at least the width of them
			assert.isAtLeast(quoted.length, OPTIONS.width);
			assert.match(text[line.start - 1], /\s/);
			assert.isTrue(line.end == text.length || /\s/.test(text[line.end]));
			let offset = quoted.indexOf('lexweighrare');
			assert.isAbove(offset, 40);
			assert.isBelow(offset, quoted.length - 40);
			assert.isFalse(line.startsSentence);
		});

		it("should keep a long sentence's start when its match comes early", async function () {
			let sentence = longSentence({ 2: 'lexweighrare' });
			let text = `A short sentence opens the passage. ${sentence}`;
			let { line } = await pick(text);
			assert.equal(line.start, text.indexOf(sentence));
			assert.isTrue(line.startsSentence);
			assert.isBelow(line.end, text.length);
		});

		it("should end a long sentence's line on a match at its end, with what else fits", async function () {
			let words = longSentence({}).split(' ');
			let sentence = longSentence({ [words.length - 12]: 'lexweighcommon', [words.length - 1]: 'lexweighrare' });
			let { line } = await pick(sentence);
			let quoted = said(sentence, line);
			assert.isTrue(quoted.endsWith('lexweighrare.'));
			assert.include(quoted, 'lexweighcommon');
		});

		it("should pick nothing where no sentence says the query", async function () {
			assert.isNull(await pick('Nothing here says it. Nor here.'));
			assert.isNull(await pick(''));
		});
	});

});
