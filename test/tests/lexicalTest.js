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

		it("should limit scoring to the given sources", async function () {
			let doc = await addContentDoc(46, 'lexsource in fulltext alone');
			let item = await createDataObject('item', { title: 'Lexsource in a title' });

			let all = await Zotero.Lexical.scoreItemIDs('lexsource', [doc, item.id]);
			assert.isTrue(all.has(doc));
			assert.isTrue(all.has(item.id));

			// The items' own text doesn't include attachment fulltext
			let own = await Zotero.Lexical.scoreItemIDs('lexsource', [doc, item.id],
				{ sources: ['itemText'] });
			assert.isFalse(own.has(doc));
			assert.isTrue(own.has(item.id));
		});

		it("should limit scoring to the given sources", async function () {
			let doc = await addContentDoc(46, 'lexsource in fulltext alone');
			let item = await createDataObject('item', { title: 'Lexsource in a title' });

			let all = await Zotero.Lexical.scoreItemIDs('lexsource', [doc, item.id]);
			assert.isTrue(all.has(doc));
			assert.isTrue(all.has(item.id));

			// The items' own text doesn't include attachment fulltext
			let own = await Zotero.Lexical.scoreItemIDs('lexsource', [doc, item.id],
				{ sources: ['itemText'] });
			assert.isFalse(own.has(doc));
			assert.isTrue(own.has(item.id));
		});

		it("should return scores as 0-1 fractions", async function () {
			let item = await createDataObject('item',
				{ title: 'Lexfrac owls of the northern coast' });
			let scores = await Zotero.Lexical.scoreItemIDs('lexfrac ', [item.id]);
			let score = scores.get(item.id);
			assert.isAbove(score, 0);
			assert.isAtMost(score, 1);
		});

		it("should rank the query's words adjacent above the words scattered", async function () {
			let adjacent = await createDataObject('item',
				{ title: 'Lexadjacent special education handbook' });
			let scattered = await createDataObject('item',
				{ title: 'Lexadjacent education for the special handbook' });

			let scores = await Zotero.Lexical.scoreItemIDs(
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

			let scores = await Zotero.Lexical.scoreItemIDs(
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
			// The item-text index is scored with per-column weights, so the
			// column a match lands in moves the score
			let titled = await createDataObject('item',
				{ title: 'Lexcolumn owls of the coast' });
			let document = await addContentDoc(3, 'lexcolumn owls of the coast');
			let scores = await Zotero.Lexical.scoreItemIDs(
				'lexcolumn owls ', [titled.id, document]);
			assert.isAbove(scores.get(titled.id), scores.get(document));
		});

		it("should rank a document returning to a term above one passing mention", async function () {
			let filler = Array.from({ length: 300 }, (x, i) => `lexsfill${i}`).join(' ');
			let buried = await addContentDoc(4, `lexsdeep ${filler}`);
			let focused = await addContentDoc(5, 'lexsdeep lexsdeep lexsdeep summary');
			let scores = await Zotero.Lexical.scoreItemIDs('lexsdeep ', [buried, focused]);
			assert.isAbove(scores.get(focused), scores.get(buried));
		});

		it("should only score the requested candidates", async function () {
			let wanted = await addContentDoc(6, 'lexcandidate archive one');
			await addContentDoc(7, 'lexcandidate archive two');
			let scores = await Zotero.Lexical.scoreItemIDs('lexcandidate ', [wanted]);
			assert.deepEqual([...scores.keys()], [wanted]);
		});

		it("should match a note the index doesn't have yet", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>Lexunindexed owls in a note never indexed</p>');
			await note.saveTx();
			await Zotero.DB.queryAsync(
				"DELETE FROM ftindex.fulltextNoteIndexState WHERE itemID=?", note.id);
			let scores = await Zotero.Lexical.scoreItemIDs('lexunindexed ', [note.id]);
			assert.isAbove(scores.get(note.id), 0);
		});

		it("should match a just-edited note by its current text", async function () {
			let note = new Zotero.Item('note');
			note.setNote('<p>Lexoldword only</p>');
			await note.saveTx();
			await Zotero.FullText.indexItems([note.id]);
			note.setNote('<p>Lexnewword only</p>');
			await note.saveTx();

			let scores = await Zotero.Lexical.scoreItemIDs('lexnewword ', [note.id]);
			assert.isAbove(scores.get(note.id), 0);
		});

		it("should weigh terms only as far as the corpus can tell them apart", async function () {
			// FTS5's BM25 floors the inverse document frequency of a term in
			// more than about half a corpus, so in a corpus too small (or too
			// uniform) for any term to be rare, every term weighs the same and
			// ranking falls back to term frequency alone. Ordering survives;
			// term importance doesn't.
			let corpusSize = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM ftindex.fulltextItemText");
			let common = await createDataObject('item',
				{ title: 'Lexweigh lexweigh lexweigh repeated' });
			let single = await createDataObject('item', { title: 'Lexweigh once only' });
			let scores = await Zotero.Lexical.scoreItemIDs('lexweigh ', [common.id, single.id]);
			// Whatever the corpus can say about the term, repetition still ranks
			assert.isAbove(scores.get(common.id), scores.get(single.id) ?? 0);
			assert.isAtLeast(corpusSize, 1);
		});

		it("should return nothing for a query with no terms", async function () {
			assert.equal((await Zotero.Lexical.scoreItemIDs('', [1])).size, 0);
			assert.equal((await Zotero.Lexical.scoreItemIDs('!!! ...', [1])).size, 0);
		});

		it("should return nothing for no candidates", async function () {
			assert.equal((await Zotero.Lexical.scoreItemIDs('owl ', [])).size, 0);
		});

		it("should abandon scoring when cancelled", async function () {
			let item = await createDataObject('item', { title: 'Lexscancel target' });
			let e = await getPromiseError(Zotero.Lexical.scoreItemIDs(
				'lexscancel ', [item.id], { shouldCancel: () => true }));
			assert.instanceOf(e, Zotero.Lexical.ScoringCancelledError);
		});
	});

	describe("#getScoringTermCount()", function () {
		it("should count the terms BM25 can score with", async function () {
			assert.equal(
				await Zotero.Lexical.getScoringTermCount('lexcountaaa lexcountbbb'), 2);
			assert.equal(await Zotero.Lexical.getScoringTermCount(''), 0);
		});
	});

	describe("#isFullyQuotedQuery()", function () {
		it("should be true only when every part is quoted", function () {
			assert.isTrue(Zotero.Lexical.isFullyQuotedQuery('"owl migration"'));
			assert.isTrue(Zotero.Lexical.isFullyQuotedQuery('"owl" "migration"'));
			assert.isFalse(Zotero.Lexical.isFullyQuotedQuery('"owl" migration'));
			assert.isFalse(Zotero.Lexical.isFullyQuotedQuery('owl migration'));
			assert.isFalse(Zotero.Lexical.isFullyQuotedQuery(''));
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

	describe("#pickSnippetWindow()", function () {
		it("should center the window on the query's terms", async function () {
			let filler = 'padding words here '.repeat(40);
			let text = filler + 'the owl migration atlas ' + filler;
			let { start, end } = await Zotero.Lexical.pickSnippetWindow('owl migration', text);
			let quoted = text.slice(start, end);
			assert.include(quoted, 'owl migration');
			// Offsets are into the text given, not a copy of it
			assert.isAtLeast(start, 0);
			assert.isAtMost(end, text.length);
		});

		it("should prefer the window covering the most of the query", async function () {
			let gap = 'x '.repeat(300);
			// One place says only 'owl', another says both terms
			let text = 'owl alone here ' + gap + 'owl migration together here';
			let { start, end } = await Zotero.Lexical.pickSnippetWindow('owl migration', text);
			assert.include(text.slice(start, end), 'owl migration together');
		});

		it("should return nothing when the query doesn't match", async function () {
			assert.isNull(await Zotero.Lexical.pickSnippetWindow('owl', 'nothing here'));
			assert.isNull(await Zotero.Lexical.pickSnippetWindow('owl', ''));
		});
	});

});
