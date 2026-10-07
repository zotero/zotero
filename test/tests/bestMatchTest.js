"use strict";

describe("Zotero.BestMatch", function () {
	var stubs = [];

	// A fused score's expected value: the sum of strength-weighted
	// reciprocal-rank contributions, each a [fraction, rank] pair,
	// normalized against full strength at rank 1 in both engines (RRF_K = 60)
	function rrf(...contributions) {
		return contributions.reduce(
			(sum, [fraction, rank]) => sum + fraction / (60 + rank), 0) / (2 / 61);
	}

	function stubEngines({ enabled, lexical, semantic, fraction }) {
		stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(enabled));
		// Semantic scores pass through the display band unchanged unless a
		// test maps them, so expected fused values compute from the stubbed
		// scores directly
		stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction')
			.callsFake(fraction || (score => score)));
		if (lexical) {
			stubs.push(sinon.stub(Zotero.Lexical, 'scoreItemIDs').callsFake(lexical));
		}
		// Per-test semantic fakes return bare score Maps; wrap them in the
		// engine's { scores, previewableIDs } envelope
		if (semantic) {
			stubs.push(sinon.stub(Zotero.Embeddings, 'scoreItemIDs')
				.callsFake(async (...args) => (
					{ scores: await semantic(...args), previewableIDs: new Set() })));
		}
	}

	afterEach(function () {
		stubs.forEach(stub => stub.restore());
		stubs = [];
	});

	describe("#scoreItemIDs()", function () {
		it("should return lexical scores directly when no semantic model is enabled", async function () {
			let lexicalScores = new Map([[1, 0.8], [2, 0.5]]);
			let semanticStub = sinon.stub(Zotero.Embeddings, 'scoreItemIDs');
			stubs.push(semanticStub);
			stubEngines({
				enabled: false,
				lexical: async () => lexicalScores
			});

			let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
			assert.isFalse(semanticStub.called);
			assert.deepEqual([...scores.entries()], [[1, 0.8], [2, 0.5]]);
		});

		it("should fuse the engines' rankings reciprocally over their union", async function () {
			stubEngines({
				enabled: true,
				// Item 1 only lexical, item 3 only semantic, item 2 in both
				lexical: async () => new Map([[1, 0.9], [2, 0.5]]),
				semantic: async () => new Map([[2, 0.8], [3, 0.6]])
			});

			let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3, 4]);
			assert.sameMembers([...scores.keys()], [1, 2, 3]);
			assert.closeTo(scores.get(1), rrf([0.9, 1]), 1e-12);
			assert.closeTo(scores.get(2), rrf([0.5, 2], [0.8, 1]), 1e-12);
			assert.closeTo(scores.get(3), rrf([0.6, 2]), 1e-12);
			// Strong matches in both engines beat topping either one alone
			assert.isAbove(scores.get(2), scores.get(1));
			assert.isAbove(scores.get(1), scores.get(3));
		});

		it("should keep the model's ordering above the display band", async function () {
			stubEngines({
				enabled: true,
				// Item 1 has a lexical co-match; item 2 is the model's clear
				// favorite, but both raw scores sit past the display ceiling
				lexical: async () => new Map([[1, 0.2]]),
				semantic: async () => new Map([[1, 1.1], [2, 1.9]]),
				fraction: (score, options) => (options && options.clamped === false
					? score
					: Math.min(1, score))
			});

			let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
			// Clamped to the band, the two would tie semantically and the
			// lexical co-match would decide; unclamped, the model's
			// preference stands
			assert.closeTo(scores.get(2), rrf([1.9, 1]), 1e-12);
			assert.closeTo(scores.get(1), rrf([0.2, 1], [1.1, 2]), 1e-12);
			assert.isAbove(scores.get(2), scores.get(1));
		});

		it("should rescale fused scores that overshoot the band", async function () {
			stubEngines({
				enabled: true,
				lexical: async () => new Map([[1, 1]]),
				semantic: async () => new Map([[1, 1.9], [2, 1.2]]),
				fraction: (score, options) => (options && options.clamped === false
					? score
					: Math.min(1, score))
			});

			let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
			// The strongest sum exceeds the nominal ceiling, so it becomes
			// the scale and pegs the band
			assert.equal(scores.get(1), 1);
			assert.isBelow(scores.get(2), 1);
		});

		it("should let strong single-engine evidence outrank weak agreement", async function () {
			stubEngines({
				enabled: true,
				// Item 1 only the semantic engine sees, strongly; item 2 sits
				// in both engines' tails
				lexical: async () => new Map([[2, 0.1]]),
				semantic: async () => new Map([[1, 0.9], [2, 0.05]])
			});

			let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
			// Appearing in both lists isn't worth much when both appearances
			// are weak: the contributions carry the engines' own fractions
			assert.isAbove(scores.get(1), scores.get(2));
		});

		it("should weigh the semantic contributions on the model's display band", async function () {
			stubEngines({
				enabled: true,
				lexical: async () => new Map(),
				semantic: async () => new Map([[1, 0.8], [2, 0.6]]),
				fraction: score => score / 2
			});

			let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
			// The raw similarity scores rank; their display-band fractions
			// (0.4 and 0.3) are what the contributions carry
			assert.closeTo(scores.get(1), rrf([0.4, 1]), 1e-12);
			assert.closeTo(scores.get(2), rrf([0.3, 2]), 1e-12);
		});

		it("should give tied scores within an engine the same rank", async function () {
			stubEngines({
				enabled: true,
				lexical: async () => new Map([[1, 0.5], [2, 0.5], [3, 0.4]]),
				semantic: async () => new Map()
			});

			let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
			assert.equal(scores.get(1), scores.get(2));
			assert.closeTo(scores.get(3), rrf([0.4, 2]), 1e-12);
		});

		it("should rank lexically when the semantic index isn't ready", async function () {
			let lexicalScores = new Map([[1, 0.8], [2, 0.5]]);
			stubEngines({
				enabled: true,
				lexical: async () => lexicalScores,
				semantic: async () => {
					throw new Zotero.Embeddings.IndexNotReadyError('test');
				}
			});

			let { scores, matches } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
			assert.deepEqual([...scores.entries()], [[1, 0.8], [2, 0.5]]);
			// The engine that didn't rank shows matches in nothing
			assert.equal(matches.semantic.size, 0);
			assert.sameMembers([...matches.lexical], [1, 2]);
		});

		it("should report which items each engine can show matches in", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction')
				.callsFake(score => score));
			stubs.push(sinon.stub(Zotero.Lexical, 'scoreItemIDs')
				.resolves(new Map([[1, 0.9]])));
			stubs.push(sinon.stub(Zotero.Embeddings, 'scoreItemIDs').resolves({
				scores: new Map([[2, 0.8], [3, 0.7]]),
				previewableIDs: new Set([2])
			}));

			let { matches } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
			// Every lexical match has excerpts to show...
			assert.sameMembers([...matches.lexical], [1]);
			// ...while a semantic match shows only through previewable chunks
			assert.sameMembers([...matches.semantic], [2]);
		});

		it("should map either engine's cancellation to its own error", async function () {
			stubEngines({
				enabled: true,
				lexical: async () => {
					throw new Zotero.Lexical.ScoringCancelledError();
				},
				semantic: async () => new Map()
			});
			let e = await getPromiseError(Zotero.BestMatch.scoreItemIDs('owl', [1]));
			assert.instanceOf(e, Zotero.BestMatch.ScoringCancelledError);

			stubs.forEach(stub => stub.restore());
			stubs = [];
			stubEngines({
				enabled: true,
				lexical: async () => new Map(),
				semantic: async () => {
					throw new Zotero.Embeddings.ScoringCancelledError();
				}
			});
			e = await getPromiseError(Zotero.BestMatch.scoreItemIDs('owl', [1]));
			assert.instanceOf(e, Zotero.BestMatch.ScoringCancelledError);
		});

		it("should rethrow an unexpected semantic failure", async function () {
			stubEngines({
				enabled: true,
				lexical: async () => new Map([[1, 0.8]]),
				semantic: async () => {
					throw new Error('model exploded');
				}
			});
			let e = await getPromiseError(Zotero.BestMatch.scoreItemIDs('owl', [1]));
			assert.equal(e.message, 'model exploded');
		});

		describe("margin", function () {
			let margin = (value) => {
				Zotero.Prefs.set('search.bestMatchMargin', value);
			};

			afterEach(function () {
				Zotero.Prefs.clear('search.bestMatchMargin');
			});

			it("should cut an engine's tail against its own strongest match", async function () {
				margin(50);
				stubEngines({
					enabled: true,
					lexical: async () => new Map(),
					// Item 3 sits at a tenth of the top; item 2 at half of it stays
					semantic: async () => new Map([[1, 0.9], [2, 0.5], [3, 0.09]])
				});

				let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
				assert.sameMembers([...scores.keys()], [1, 2]);
			});

			it("should keep items tied at the boundary together", async function () {
				margin(50);
				stubEngines({
					enabled: true,
					lexical: async () => new Map([[1, 1], [2, 0.5], [3, 0.5]]),
					semantic: async () => new Map()
				});

				let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
				assert.sameMembers([...scores.keys()], [1, 2, 3]);
			});

			it("should never cut a lone result", async function () {
				margin(10);
				stubEngines({
					enabled: true,
					lexical: async () => new Map([[1, 0.06]]),
					semantic: async () => new Map([[2, 0.01]])
				});

				let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
				assert.sameMembers([...scores.keys()], [1, 2]);
			});

			it("should keep everything above the floor at a margin of 1", async function () {
				margin(100);
				stubEngines({
					enabled: true,
					lexical: async () => new Map([[1, 0.9], [2, 0.05]]),
					semantic: async () => new Map([[3, 0.9], [4, 0.001]])
				});

				let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3, 4]);
				assert.sameMembers([...scores.keys()], [1, 2, 3, 4]);
			});

			it("should measure the semantic cut on the display band, not the raw score", async function () {
				margin(50);
				stubEngines({
					enabled: true,
					lexical: async () => new Map(),
					// Raw scores 0.6 and 0.4 look close; on a band starting at
					// 0.35 they are fractions 1.0 and 0.2, and the second is cut
					semantic: async () => new Map([[1, 0.6], [2, 0.4]]),
					fraction: score => Math.max(0, (score - 0.35) / 0.25)
				});

				let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
				assert.sameMembers([...scores.keys()], [1]);
			});

			it("should take an item's semantic voice and match away when only lexical keeps it", async function () {
				margin(50);
				stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
				stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction')
					.callsFake(score => score));
				stubs.push(sinon.stub(Zotero.Lexical, 'scoreItemIDs')
					.resolves(new Map([[1, 0.8], [2, 0.9]])));
				stubs.push(sinon.stub(Zotero.Embeddings, 'scoreItemIDs').resolves({
					scores: new Map([[1, 0.9], [2, 0.05]]),
					previewableIDs: new Set([1, 2])
				}));

				let { scores, matches } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
				// Item 2 stays, on its lexical evidence alone
				assert.closeTo(scores.get(2), rrf([0.9, 1]), 1e-12);
				assert.closeTo(scores.get(1), rrf([0.8, 2], [0.9, 1]), 1e-12);
				assert.sameMembers([...matches.lexical], [1, 2]);
				assert.sameMembers([...matches.semantic], [1]);
			});

			it("should cut the tail in single-engine modes too", async function () {
				margin(50);
				let saved = Zotero.Prefs.get('search.bestMatchEngine');
				try {
					Zotero.Prefs.set('search.bestMatchEngine', 'semantic');
					stubEngines({
						enabled: true,
						semantic: async () => new Map([[1, 1.8], [2, 1.2], [3, 0.3]]),
						fraction: (score, options) => (options && options.clamped === false
							? score
							: Math.min(1, score))
					});
					let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
					assert.sameMembers([...scores.keys()], [1, 2]);
					// Rescaled by the strongest kept fraction
					assert.equal(scores.get(1), 1);
					assert.closeTo(scores.get(2), 1.2 / 1.8, 1e-12);

					Zotero.Prefs.set('search.bestMatchEngine', 'lexical');
					stubs.forEach(stub => stub.restore());
					stubs = [];
					stubEngines({
						enabled: true,
						lexical: async () => new Map([[1, 0.9], [2, 0.3]])
					});
					({ scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]));
					assert.sameMembers([...scores.keys()], [1]);
				}
				finally {
					Zotero.Prefs.set('search.bestMatchEngine', saved);
				}
			});
		});
	});

	describe("Session#getMatchingExcerpts()", function () {
		// Previews exist only for file attachments (see _hasPreviews())
		var attachment;

		before(async function () {
			attachment = await importFileAttachment('test.pdf');
		});

		// The static model that picks a passage's closest sentence, never
		// downloaded: present, and scoring every sentence alike, so the first
		// is picked
		var staticStub;

		beforeEach(function () {
			stubs.push(sinon.stub(Zotero.Embeddings.Static, 'isDownloaded').resolves(true));
			staticStub = sinon.stub(Zotero.Embeddings.Static, 'similarities')
				.callsFake(async (queryText, texts) => texts.map(() => 0));
			stubs.push(staticStub);
		});

		// A session that has scored the attachment, recording which engines
		// matched it -- what getMatchingExcerpts() consults instead of being
		// told per call
		// Pin the temporary bestMatchEngine pref, leaving every other pref
		// reading through to the profile
		function pinEngine(engine) {
			let get = Zotero.Prefs.get;
			stubs.push(sinon.stub(Zotero.Prefs, 'get').callsFake(
				(key, ...rest) => (key == 'search.bestMatchEngine'
					? engine
					: get.call(Zotero.Prefs, key, ...rest))));
		}

		// The item's text as its structure cuts it, into passages saying
		// nothing of where they sit
		function cutInto(texts) {
			stubs.push(sinon.stub(Zotero.SDT, 'getItemChunks').resolves({
				ok: true,
				chunks: texts.map(text => ({
					text, outlinePath: '', pageLabel: null, anchor: null, position: null
				}))
			}));
		}

		async function sessionFor({ lexical = true, semantic = true } = {}) {
			stubs.push(sinon.stub(Zotero.BestMatch, 'scoreItemIDs').resolves({
				scores: new Map([[attachment.id, 0.9]]),
				matches: {
					lexical: new Set(lexical ? [attachment.id] : []),
					semantic: new Set(semantic ? [attachment.id] : [])
				}
			}));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([attachment.id]);
			return session;
		}

		it("should cut an unindexed item into passages of its own text", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(false));
			let chunksStub = sinon.stub(Zotero.Embeddings, 'getMatchingChunks');
			stubs.push(chunksStub);
			stubs.push(sinon.stub(Zotero.SDT, 'getItemChunks').resolves({ ok: false, reason: 'not-cached' }));
			let text = 'A paragraph about owls.\n\n' + 'Filler about nothing. '.repeat(200)
				+ '\n\nAnother owl paragraph entirely.';
			stubs.push(sinon.stub(Zotero.Items, 'getAsync')
				.resolves({ attachmentText: Promise.resolve(text) }));

			let session = await sessionFor();
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			// The model was never asked about an item it hasn't indexed
			assert.isFalse(chunksStub.called);
			// Only the passages that say the query come back, each a piece of
			// the item's text -- joined with the chunker's own separators --
			// with the query located in it
			assert.isAbove(excerpts.length, 0);
			let collapse = s => s.replace(/\s+/g, ' ');
			for (let excerpt of excerpts) {
				assert.include(collapse(text), collapse(excerpt.text));
				assert.isAbove(excerpt.ranges.length, 0);
				assert.isAbove(excerpt.strength, 0);
				// The one line worth quoting, inside the passage it came from
				assert.isAtLeast(excerpt.snippet.start, 0);
				assert.isAtMost(excerpt.snippet.end, excerpt.text.length);
			}
		});

		it("should cut an unindexed item along its structure, each passage opening where it sits", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(false));
			// Each passage's anchor is on its own page, which its position
			// opens at
			let passage = (text, pageIndex) => ({
				text,
				outlinePath: 'Methods',
				pageLabel: String(pageIndex + 1),
				anchor: { pageRects: [[pageIndex, 10, 20, 300, 40]] },
				position: { pageIndex, rects: [[10, 20, 300, 40]] }
			});
			let chunksStub = sinon.stub(Zotero.SDT, 'getItemChunks').resolves({
				ok: true,
				chunks: [
					passage('Filler about nothing in particular.', 2),
					passage('An owl hunts at night.', 3)
				]
			});
			stubs.push(chunksStub);

			let session = await sessionFor();
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			assert.lengthOf(excerpts, 1);
			// Cut off this thread, from structure already extracted, each
			// passage placed for the reader to open it at
			assert.isTrue(chunksStub.alwaysCalledWith(attachment.id,
				{ cachedOnly: true, isPriority: true, positions: true }));
			assert.equal(excerpts[0].text, 'An owl hunts at night.');
			assert.deepEqual(excerpts[0].position, { pageIndex: 3, rects: [[10, 20, 300, 40]] });
			assert.equal(excerpts[0].pageLabel, '4');
		});

		it("should quote a passage where the query's words are", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			let lead = 'Nothing of interest here. '.repeat(30);
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: lead + 'And here the owl appears at last.', score: 0.6, position: 1 },
				// A chunk whose source drifted has no text to quote
				{ text: null, score: 0.9 }
			]));

			let session = await sessionFor();
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			assert.lengthOf(excerpts, 1);
			let [excerpt] = excerpts;
			// The whole passage is carried, for reading it in full...
			assert.include(excerpt.text, 'Nothing of interest');
			// ...and the snippet is the line the query is on
			assert.include(excerpt.text.slice(excerpt.snippet.start, excerpt.snippet.end), 'owl');
			// Ranges locate the query in the whole passage, not in the snippet
			assert.deepEqual(excerpt.ranges, [[lead.length + 13, lead.length + 16]]);
			// Chunk fields pass through for the row's location line
			assert.equal(excerpt.position, 1);
			// Opened on the sentence saying the query, whole
			assert.equal(excerpt.snippet.start, lead.length);
			assert.isTrue(excerpt.snippet.startsSentence);
		});

		// The snippet of a one-passage item that says the query, with the
		// lexical engine picking its quote as given
		async function quoteOf(text, pick) {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([{ text, score: 0.6 }]));
			stubs.push(sinon.stub(Zotero.Lexical, 'findMatchRanges').resolves([[[0, 3]]]));
			let pickStub = sinon.stub(Zotero.Lexical, 'pickQuote').resolves(pick);
			stubs.push(pickStub);
			let session = await sessionFor();
			let [excerpt] = await session.getMatchingExcerpts(attachment.id);
			return { snippet: excerpt.snippet, pickStub };
		}

		it("should open on the sentence the lexical engine picks and fill the line after it", async function () {
			let sentences = [
				'An owl sat on the fence.',
				'Then the owl hunted at night, as barn owls usually do.',
				'It returned to the barn with its catch just before dawn, as it did every '
					+ 'morning of that long and unusually cold winter in the valley.',
				'A last sentence beyond the filled line.'
			];
			let text = sentences.join(' ');
			let pick = { sentence: Zotero.BestMatch.splitSentences(text)[1] };
			let { snippet, pickStub } = await quoteOf(text, pick);

			// Asked with the line's measures
			assert.deepEqual(pickStub.firstCall.args[3], { longSentence: 200, width: 150 });
			// Opened on the pick, the line filled with the next sentence whole
			let quoted = text.slice(snippet.start, snippet.end);
			assert.isTrue(quoted.startsWith(sentences[1]));
			assert.include(quoted, sentences[2]);
			assert.notInclude(quoted, sentences[3]);
			assert.isTrue(snippet.startsSentence);
		});

		it("should quote a long sentence as the line the lexical engine picks", async function () {
			let text = 'A passage whose long sentence the lexical engine cuts to a line.';
			let line = { start: 9, end: 40, startsSentence: false };
			let { snippet } = await quoteOf(text, { sentence: { start: 0, end: text.length }, line });
			assert.deepEqual(snippet, line);
		});

		it("should quote from the opening when no sentence says the query", async function () {
			let text = 'An opening sentence. And a second sentence after it.';
			let { snippet } = await quoteOf(text, null);
			assert.equal(snippet.start, 0);
			assert.isTrue(snippet.startsSentence);
		});

		it("should leave the static model out of a passage the lexical engine quotes", async function () {
			let text = 'An opening sentence. The owl sentence the lexical engine picks.';
			await quoteOf(text, { sentence: Zotero.BestMatch.splitSentences(text)[1] });
			assert.isFalse(staticStub.called);
		});

		// The snippet of a one-passage item the model matched in meaning alone
		async function meantQuoteOf(text) {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([{ text, score: 0.6 }]));
			pinEngine('semantic');
			let session = await sessionFor();
			// Scoring derived the preview already; count this derivation alone
			staticStub.resetHistory();
			let [excerpt] = await session.getMatchingExcerpts(attachment.id);
			return excerpt.snippet;
		}

		it("should open a passage matched in meaning alone on its sentence closest to the query", async function () {
			let opening = 'The collection was catalogued over several seasons of fieldwork.';
			// Too short to weigh alone, so it's weighed with the next
			let aside = 'See below.';
			let closest = 'Thick-skulled ornithischians may have butted heads in combat.';
			let closing = 'Funding came from a regional museum grant for the whole project.';
			let text = [opening, aside, closest, closing].join(' ');
			staticStub.callsFake(async (queryText, texts) => texts.map(
				unit => (unit.includes('ornithischians') ? 0.5 : 0.1)));

			let snippet = await meantQuoteOf(text);

			// Weighed in one call, the short sentence joined to the next
			assert.isTrue(staticStub.calledOnce);
			assert.deepEqual(staticStub.firstCall.args[1], [opening, `${aside} ${closest}`, closing]);
			// Opened on the closest unit, a sentence start
			assert.equal(snippet.start, text.indexOf(aside));
			assert.include(text.slice(snippet.start, snippet.end), closest);
			assert.isTrue(snippet.startsSentence);
		});

		it("should quote a passage matched in meaning from its opening while the static model is missing", async function () {
			Zotero.Embeddings.Static.isDownloaded.resolves(false);
			let snippet = await meantQuoteOf('A first sentence long enough to be weighed on its own. '
				+ 'A second sentence long enough to be weighed on its own too.');
			assert.isFalse(staticStub.called);
			assert.equal(snippet.start, 0);
		});

		it("should quote a passage matched in meaning from its opening when the static model fails", async function () {
			stubs.push(sinon.stub(Zotero, 'logError'));
			staticStub.rejects(new Error('no table'));
			let snippet = await meantQuoteOf('A first sentence long enough to be weighed on its own. '
				+ 'A second sentence long enough to be weighed on its own too.');
			assert.equal(snippet.start, 0);
		});

		it("should weigh saying the query against merely resembling it", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: 'a passage the model likes but that never says the word', score: 0.9 },
				{ text: 'a passage about the owl itself', score: 0.5 }
			]));
			stubs.push(sinon.stub(Zotero.Lexical, 'scoreTexts').resolves([0, 1]));

			let session = await sessionFor();
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			assert.lengthOf(excerpts, 2);
			// 0.7 * 0.5 + 0.3 * 1 beats 0.7 * 0.9 + 0.3 * 0
			assert.include(excerpts[0].text, 'the owl itself');
			assert.closeTo(excerpts[0].strength, 0.7 * 0.5 + 0.3, 1e-9);
			assert.closeTo(excerpts[1].strength, 0.7 * 0.9, 1e-9);
		});

		it("should skip the lexical engine for an item that didn't match it", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			let lexicalStub = sinon.stub(Zotero.Lexical, 'getMatchingExcerpts');
			stubs.push(lexicalStub);
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: 'the owl chunk', score: 0.6 }
			]));
			stubs.push(sinon.stub(Zotero.Lexical, 'findMatchRanges').resolves([[]]));

			// Scoring recorded a semantic match only, so the document's text
			// is never read or scanned
			let session = await sessionFor({ lexical: false });
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			assert.isFalse(lexicalStub.called);
			assert.lengthOf(excerpts, 1);
			assert.equal(excerpts[0].text, 'the owl chunk');
		});

		it("should skip the semantic engine for an item that didn't match it", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			let chunksStub = sinon.stub(Zotero.Embeddings, 'getMatchingChunks');
			stubs.push(chunksStub);
			cutInto(['a passage naming the owl']);

			// Scoring recorded a lexical match only, so the query is never
			// embedded for it -- its text is cut instead
			let session = await sessionFor({ semantic: false });
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			assert.isFalse(chunksStub.called);
			assert.lengthOf(excerpts, 1);
			assert.equal(excerpts[0].text, 'a passage naming the owl');
			// Nothing weighed it but its words
			assert.isUndefined(excerpts[0].score);
		});

		it("should keep the lexical engine out of a pinned semantic session's quotes", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			let head = 'A first paragraph that never mentions the bird at all. '.repeat(5);
			let tail = 'A second paragraph where the owl is finally named outright. '.repeat(5);
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: head + '\n\n' + tail, score: 0.6 }
			]));
			let rangesStub = sinon.stub(Zotero.Lexical, 'findMatchRanges');
			stubs.push(rangesStub);
			let pickStub = sinon.stub(Zotero.Lexical, 'pickQuote');
			stubs.push(pickStub);

			pinEngine('semantic');
			// The item matched lexically too, so only the pin can be keeping
			// the lexical engine out of the quote
			let session = await sessionFor();
			let [excerpt] = await session.getMatchingExcerpts(attachment.id);

			assert.isFalse(rangesStub.called);
			assert.isFalse(pickStub.called);
			assert.isEmpty(excerpt.ranges);
			// With no ranges to quote around, the passage's opening -- not
			// the line saying 'owl'
			assert.equal(excerpt.snippet.start, 0);
			// Nothing but the model weighed it, so its strength is the
			// model's fraction rather than a share of a blend
			assert.closeTo(excerpt.strength, 0.6, 1e-9);
		});

		it("should derive every matched passage but quote only the strongest", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			let scores = [0.9, 0.8, 0.7, 0.6, 0.5];
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves(
				scores.map((score, i) => ({ text: `Passage number ${i} of the document.`, score }))
			));

			// Semantic only, so the passages are kept on the model's word
			let session = await sessionFor({ lexical: false });
			let excerpts = await session.getMatchingExcerpts(attachment.id);

			// Every passage the model kept comes back, for reading whole
			assert.lengthOf(excerpts, scores.length);
			for (let i = 0; i < scores.length; i++) {
				assert.closeTo(excerpts[i].strength, scores[i], 1e-9);
			}
			// Only the strongest few carry the line the tree quotes
			for (let i = 0; i < Zotero.BestMatch.MAX_QUOTED_PASSAGES; i++) {
				assert.isDefined(excerpts[i].snippet, `passage ${i} is quoted`);
			}
			for (let i = Zotero.BestMatch.MAX_QUOTED_PASSAGES; i < excerpts.length; i++) {
				assert.isUndefined(excerpts[i].snippet, `passage ${i} is not quoted`);
			}
		});

		it("should quote whole opening sentences until the line is filled", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			// The opening sentence is far too short to stand as a quote on
			// its own
			let first = 'The owl is here.';
			let second = 'A modest follow-up sentence that adds a little context.';
			let third = 'A third sentence long enough to carry the quote past the '
				+ 'budget for a quoted line, taken whole anyway, since half a '
				+ 'sentence would read as a truncation rather than as a passage.';
			let fourth = 'A fourth sentence that lies beyond the filled line.';
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: [first, second, third, fourth].join(' '), score: 0.6 }
			]));

			pinEngine('semantic');
			let session = await sessionFor();
			let [excerpt] = await session.getMatchingExcerpts(attachment.id);
			let quoted = excerpt.text.slice(excerpt.snippet.start, excerpt.snippet.end);

			assert.equal(excerpt.snippet.start, 0);
			assert.include(quoted, first);
			// The next sentence doesn't fill the line either...
			assert.include(quoted, second);
			// ...so the one that crosses the limit is taken, whole...
			assert.include(quoted, third);
			// ...and nothing after it
			assert.notInclude(quoted, fourth);
		});

		it("should never ask the model to choose a quote", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			cutInto(['A passage of owlish things. '.repeat(20)]);
			// The lexical engine scored the passage on a term it then can't
			// point at -- so the passage arrives with no ranges to quote
			// around
			stubs.push(sinon.stub(Zotero.Lexical, 'scoreTexts').resolves([0.8]));
			stubs.push(sinon.stub(Zotero.Lexical, 'findMatchRanges').resolves([[]]));
			let embedStub = sinon.stub(Zotero.Embeddings, 'embedPassages');
			stubs.push(embedStub);

			let session = await sessionFor({ semantic: false });
			let [excerpt] = await session.getMatchingExcerpts(attachment.id);

			assert.isFalse(embedStub.called);
			// Left with the passage's opening, and its lexical share whole
			assert.equal(excerpt.snippet.start, 0);
			assert.closeTo(excerpt.strength, 0.8, 1e-9);
		});

		it("should cut an item's text when the model shows nothing", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			cutInto(['a passage naming the owl', 'a passage naming nothing']);

			// No chunk cleared the model's floor
			let chunksStub = sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([]);
			stubs.push(chunksStub);
			let session = await sessionFor();
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			// Only the passage that says the query is a match
			assert.lengthOf(excerpts, 1);
			assert.equal(excerpts[0].text, 'a passage naming the owl');

			// The semantic index isn't ready: same fallback
			chunksStub.rejects(new Zotero.Embeddings.IndexNotReadyError('test'));
			assert.lengthOf(await session.getMatchingExcerpts(attachment.id), 1);
		});

		it("should rethrow an unexpected semantic failure", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks')
				.rejects(new Error('model exploded')));

			let session = await sessionFor();
			let e = await getPromiseError(session.getMatchingExcerpts(attachment.id));
			assert.equal(e.message, 'model exploded');
		});
	});

	describe("Session", function () {
		// Previews are only built for file attachments (see _hasPreviews()),
		// so the items these tests score are real ones
		var att1, att2, att3;

		before(async function () {
			att1 = await importFileAttachment('test.pdf');
			att2 = await importFileAttachment('test.pdf');
			att3 = await importFileAttachment('test.pdf');
		});

		function stubScore(scores, lexicalIDs, semanticIDs) {
			let stub = sinon.stub(Zotero.BestMatch, 'scoreItemIDs').resolves({
				scores,
				matches: {
					lexical: new Set(lexicalIDs || []),
					semantic: new Set(semanticIDs || [])
				}
			});
			stubs.push(stub);
			return stub;
		}

		function stubDerive(entriesByItem) {
			let stub = sinon.stub(Zotero.BestMatch.Session.prototype, 'getMatchingExcerpts').callsFake(
				async itemID => entriesByItem.get(itemID) || []);
			stubs.push(stub);
			return stub;
		}

		it("should score and derive previews for the engines' matches", async function () {
			stubScore(new Map([[att1.id, 0.9], [att2.id, 0.8], [att3.id, 0.7]]), [att1.id], [att2.id]);
			stubDerive(new Map([
				[att1.id, [
					{ source: 'title', text: 'owl atlas', ranges: [[0, 3]], strength: 1 },
					{ source: 'abstract', text: 'about owls', ranges: [[6, 10]], strength: 0.5 }
				]],
				[att2.id, [{ source: 'content', text: 'strigiformes', ranges: [], strength: 1 }]]
			]));
			let session = Zotero.BestMatch.createSession('owl');
			let scores = await session.score([att1.id, att2.id, att3.id]);
			assert.equal(scores.get(att1.id), 0.9);
			// Settled by the time score() resolves
			let preview = session.getPreviews(att1.id);
			assert.equal(preview.state, 'filled');
			assert.deepEqual(preview.entries.map(entry => entry.key), [0, 1]);
			assert.equal(preview.entries[0].text, 'owl atlas');
			assert.equal(session.getPreviews(att2.id).state, 'filled');
			// A scored item neither engine can show matches in -- a semantic
			// match that is its own preview -- gets no preview
			assert.isNull(session.getPreviews(att3.id));
		});

		it("should rank rows by the best match beneath them, with bars reporting own scores", async function () {
			let parent = await createDataObject('item');
			let child = await importFileAttachment('test.pdf', { parentID: parent.id });
			stubScore(new Map([[child.id, 0.9], [att1.id, 0.5]]), [child.id, att1.id]);
			stubDerive(new Map());
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([child.id, att1.id]);
			// The child's score lifts onto its parent, which shares its rank
			assert.equal(session.ranks.get(child.treeViewID), 1);
			assert.equal(session.ranks.get(parent.treeViewID), 1);
			assert.equal(session.ranks.get(att1.treeViewID), 2);
			// The bar reports only the row's own score: an empty bar for a
			// row that only inherited its rank
			assert.equal(session.barFractions.get(child.treeViewID), 0.9);
			assert.equal(session.barFractions.get(parent.treeViewID), 0);
			assert.equal(session.barFractions.get(att1.treeViewID), 0.5);
		});

		it("should not derive after dispose", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map([[att1.id, [
				{ source: 'title', text: 'owl', ranges: [], strength: 1 }
			]]]));
			let session = Zotero.BestMatch.createSession('owl');
			session.dispose();
			await session.score([att1.id]);
			await session.fill([att1.id]);
			assert.equal(derive.callCount, 0);
			assert.isNull(session.getPreviews(att1.id));
		});

		it("should abandon scoring between derivations when shouldCancel says to", async function () {
			stubScore(new Map([[att1.id, 0.9], [att2.id, 0.8]]), [att1.id, att2.id]);
			let derive = stubDerive(new Map([
				[att1.id, [{ source: 'title', text: 'one', ranges: [], strength: 1 }]],
				[att2.id, [{ source: 'title', text: 'two', ranges: [], strength: 1 }]]
			]));
			let session = Zotero.BestMatch.createSession('owl');
			// Cancels between the first item and the second
			let e = await getPromiseError(session.score([att1.id, att2.id], {
				shouldCancel: () => session.getPreviews(att1.id)?.state == 'filled'
			}));
			assert.instanceOf(e, Zotero.BestMatch.ScoringCancelledError);
			assert.equal(derive.callCount, 1);
			assert.equal(session.getPreviews(att2.id).state, 'pending');
		});

		it("should show nothing for a preview that derives nothing, and not retry it", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map());
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			assert.isNull(session.getPreviews(att1.id));
			await session.fill([att1.id]);
			assert.equal(derive.callCount, 1);
		});

		it("should show nothing for a failed derivation", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			stubs.push(sinon.stub(Zotero.BestMatch.Session.prototype, 'getMatchingExcerpts')
				.rejects(new Error('cache file missing')));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			assert.isNull(session.getPreviews(att1.id));
		});

		it("should rederive an invalidated preview on the next fill", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map([[att1.id, [
				{ source: 'title', text: 'owl', ranges: [], strength: 1 }
			]]]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);

			session.invalidate([att1.id]);
			assert.equal(session.getPreviews(att1.id).state, 'pending');

			await session.fill([att1.id]);
			assert.equal(derive.callCount, 2);
			assert.equal(session.getPreviews(att1.id).state, 'filled');

			// A preview already in hand costs nothing to fill again
			await session.fill([att1.id]);
			assert.equal(derive.callCount, 2);
		});

		it("should keep settled previews across a re-score and drop unmatched items", async function () {
			let scoreStub = sinon.stub(Zotero.BestMatch, 'scoreItemIDs');
			stubs.push(scoreStub);
			scoreStub.onFirstCall().resolves({
				scores: new Map([[att1.id, 0.9], [att2.id, 0.8]]),
				matches: { lexical: new Set([att1.id, att2.id]), semantic: new Set() }
			});
			scoreStub.onSecondCall().resolves({
				scores: new Map([[att1.id, 0.9]]),
				matches: { lexical: new Set([att1.id]), semantic: new Set() }
			});
			let derive = stubDerive(new Map([
				[att1.id, [{ source: 'title', text: 'owl', ranges: [], strength: 1 }]],
				[att2.id, [{ source: 'title', text: 'two', ranges: [], strength: 1 }]]
			]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id, att2.id]);
			assert.equal(derive.callCount, 2);

			await session.score([att1.id, att2.id]);
			// The derived text survives the re-score without re-deriving...
			let preview = session.getPreviews(att1.id);
			assert.equal(preview.state, 'filled');
			assert.equal(preview.entries[0].text, 'owl');
			assert.equal(derive.callCount, 2);
			// ...and an item no longer matched loses its preview
			assert.isNull(session.getPreviews(att2.id));
		});

	});

	describe("Session background previews", function () {
		// More matches than score() derives before resolving, so the rest go
		// to the background pass
		const PRELOADED = Zotero.BestMatch.PRELOADED_MATCH_PREVIEWS;
		var atts;

		before(async function () {
			this.timeout(60000);
			atts = [];
			for (let i = 0; i < PRELOADED + 3; i++) {
				atts.push(await importFileAttachment('test.pdf'));
			}
		});

		// Scores descending in creation order, so the background pass covers
		// the last three
		function stubScore() {
			let scores = new Map(atts.map((att, i) => [att.id, 1 - i / 100]));
			stubs.push(sinon.stub(Zotero.BestMatch, 'scoreItemIDs').resolves({
				scores,
				matches: { lexical: new Set(scores.keys()), semantic: new Set() }
			}));
			return scores;
		}

		// Derives one entry per item, holding each derivation until it's let
		// through, so a test can stop the pass at a known point
		function stubDerive() {
			let waiting = [];
			let stub = sinon.stub(Zotero.BestMatch.Session.prototype, 'getMatchingExcerpts')
				.callsFake(async () => {
					await new Promise(resolve => waiting.push(resolve));
					return [{ source: 'title', text: 'owl', ranges: [], strength: 1 }];
				});
			stubs.push(stub);
			let release = () => waiting.splice(0).forEach(resolve => resolve());
			return {
				stub,
				release,
				// Let derivations through until `count` have started. They run
				// one at a time, so the last is left waiting, not released.
				advanceTo: async (count) => {
					while (stub.callCount < count) {
						release();
						await Zotero.Promise.delay(0);
					}
				}
			};
		}

		it("should derive the best-scored previews before resolving and the rest after", async function () {
			stubScore();
			let { stub, release, advanceTo } = stubDerive();
			let reported = [];
			let session = Zotero.BestMatch.createSession('owl');
			session.onPreviewsFilled = itemIDs => reported.push(...itemIDs);
			let scored = session.score(atts.map(att => att.id));
			// Only the previews score() waits for are let through, so its
			// resolution can't have depended on the one left in flight
			await advanceTo(PRELOADED + 1);
			await scored;

			// Settled by the time score() resolves
			for (let att of atts.slice(0, PRELOADED)) {
				assert.equal(session.getPreviews(att.id).state, 'filled');
			}
			for (let att of atts.slice(PRELOADED)) {
				assert.equal(session.getPreviews(att.id).state, 'pending');
			}
			// Nothing reported for what score() derived itself
			assert.isEmpty(reported);

			let settled = false;
			session.previewsSettled.then(() => settled = true);
			while (!settled) {
				release();
				await Zotero.Promise.delay(0);
			}
			await session.previewsSettled;
			assert.equal(stub.callCount, atts.length);
			for (let att of atts.slice(PRELOADED)) {
				assert.equal(session.getPreviews(att.id).state, 'filled');
			}
			assert.sameMembers(reported, atts.slice(PRELOADED).map(att => att.id));
		});

		it("should preload previews by where rows appear, not by items' own scores", async function () {
			let parent = await createDataObject('item');
			let child = await importFileAttachment('test.pdf', { parentItemID: parent.id });
			// The child scores worst of every match, but its preview rows
			// render under the top-ranked parent, at the top of the list
			let scores = new Map(atts.map((att, i) => [att.id, 0.9 - i / 100]));
			scores.set(parent.id, 0.99);
			scores.set(child.id, 0.01);
			stubs.push(sinon.stub(Zotero.BestMatch, 'scoreItemIDs').resolves({
				scores,
				matches: { lexical: new Set(scores.keys()), semantic: new Set() }
			}));
			let { release, advanceTo } = stubDerive();
			let session = Zotero.BestMatch.createSession('owl');
			let scored = session.score([...scores.keys()]);
			await advanceTo(PRELOADED + 1);
			await scored;

			assert.equal(session.getPreviews(child.id).state, 'filled');
			// The weakest standalone attachment waited instead
			assert.equal(session.getPreviews(atts[atts.length - 1].id).state, 'pending');

			session.dispose();
			release();
		});

		it("should stop the background pass when the session is disposed", async function () {
			stubScore();
			let { stub, release, advanceTo } = stubDerive();
			let session = Zotero.BestMatch.createSession('owl');
			let scored = session.score(atts.map(att => att.id));
			await advanceTo(PRELOADED + 1);
			await scored;

			session.dispose();
			release();
			await session.previewsSettled;
			// The in-flight derivation settles nothing, and the ones behind
			// it are never asked for
			assert.equal(stub.callCount, PRELOADED + 1);
			assert.equal(session.getPreviews(atts[PRELOADED].id).state, 'pending');
		});
	});

	describe("#isSearchableQuery()", function () {
		it("should accept any query the lexical engine can parse", function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(false));
			assert.isTrue(Zotero.BestMatch.isSearchableQuery('owl migration'));
			assert.isFalse(Zotero.BestMatch.isSearchableQuery('   '));
			assert.isFalse(Zotero.BestMatch.isSearchableQuery(''));
		});

		it("should let an enabled model accept what only it can embed", function () {
			// No word units to parse, but the text embeds
			let stub = sinon.stub(Zotero.Embeddings, 'isEnabled').returns(false);
			stubs.push(stub);
			assert.isFalse(Zotero.BestMatch.isSearchableQuery('???'));
			stub.returns(true);
			assert.isTrue(Zotero.BestMatch.isSearchableQuery('???'));
		});
	});
});
