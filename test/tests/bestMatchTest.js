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
			let lexicalScores = new Map([[1, 0.8], [2, 0.3]]);
			let semanticStub = sinon.stub(Zotero.Embeddings, 'scoreItemIDs');
			stubs.push(semanticStub);
			stubEngines({
				enabled: false,
				lexical: async () => lexicalScores
			});

			let { scores } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
			assert.isFalse(semanticStub.called);
			assert.deepEqual([...scores.entries()], [[1, 0.8], [2, 0.3]]);
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
			let lexicalScores = new Map([[1, 0.8], [2, 0.3]]);
			stubEngines({
				enabled: true,
				lexical: async () => lexicalScores,
				semantic: async () => {
					throw new Zotero.Embeddings.IndexNotReadyError('test');
				}
			});

			let { scores, matches } = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
			assert.deepEqual([...scores.entries()], [[1, 0.8], [2, 0.3]]);
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
	});

	describe("Session#getMatchingExcerpts()", function () {
		// Previews exist only for file attachments (see _hasPreviews())
		var attachment;

		before(async function () {
			attachment = await importFileAttachment('test.pdf');
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
			stubs.push(sinon.stub(Zotero.Embeddings, 'getChunks').resolves([]));
			stubs.push(sinon.stub(Zotero.SDT, 'getSections').resolves({ ok: false, reason: 'none' }));
			let text = 'A paragraph about owls.\n\n' + 'Filler about nothing. '.repeat(200)
				+ '\n\nAnother owl paragraph entirely.';
			stubs.push(sinon.stub(Zotero.Items, 'getAsync')
				.resolves({ attachmentText: Promise.resolve(text) }));

			let session = await sessionFor();
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			// The model was never asked about an item it hasn't indexed
			assert.isFalse(chunksStub.called);
			// Only the passages that say the query come back, each a slice of
			// the item's text with the query located in it
			assert.isAbove(excerpts.length, 0);
			for (let excerpt of excerpts) {
				assert.include(text, excerpt.text);
				assert.isAbove(excerpt.ranges.length, 0);
				assert.isAbove(excerpt.strength, 0);
				// The one line worth quoting, inside the passage it came from
				assert.isAtLeast(excerpt.snippet.start, 0);
				assert.isAtMost(excerpt.snippet.end, excerpt.text.length);
			}
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
			stubs.push(sinon.stub(Zotero.Embeddings, 'getChunks').resolves([
				{ text: 'a passage naming the owl', chunkIndex: 0 }
			]));

			// Scoring recorded a lexical match only, so the query is never
			// embedded for it -- but the chunks still say how it divides
			let session = await sessionFor({ semantic: false });
			let excerpts = await session.getMatchingExcerpts(attachment.id);
			assert.isFalse(chunksStub.called);
			assert.lengthOf(excerpts, 1);
			assert.equal(excerpts[0].text, 'a passage naming the owl');
			// Nothing weighed it but its words
			assert.isUndefined(excerpts[0].score);
		});

		it("should quote the way a pinned semantic engine would", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			let head = 'A first paragraph that never mentions the bird at all. '.repeat(5);
			let tail = 'A second paragraph where the owl is finally named outright. '.repeat(5);
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: head + '\n\n' + tail, score: 0.6 }
			]));
			let rangesStub = sinon.stub(Zotero.Lexical, 'findMatchRanges');
			stubs.push(rangesStub);
			let windowStub = sinon.stub(Zotero.Lexical, 'pickSnippetWindow');
			stubs.push(windowStub);
			// The model reads the lines and prefers the last
			stubs.push(sinon.stub(Zotero.Embeddings, 'scoreTexts')
				.callsFake(async (query, texts) => texts.map((text, i) => i / texts.length)));

			pinEngine('semantic');
			// The item matched lexically too, so only the pin can be keeping
			// the lexical engine out of the quote
			let session = await sessionFor();
			let [excerpt] = await session.getMatchingExcerpts(attachment.id);

			assert.isFalse(rangesStub.called);
			assert.isFalse(windowStub.called);
			assert.isEmpty(excerpt.ranges);
			// The model's own choice of line, not the one saying 'owl'
			assert.isAbove(excerpt.snippet.start, 0);
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

		it("should fill out a short chosen sentence with what follows it", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			let first = 'The owl is here.';
			let second = 'A modest follow-up sentence that adds a little context.';
			let third = 'A third sentence long enough that adding it would overrun the '
				+ 'budget for a quoted line, so it has to be left out of one that '
				+ 'already holds two sentences before it, whatever else is true.';
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: [first, second, third].join(' '), score: 0.6 }
			]));
			// The model likes the first sentence best, and it is far too
			// short to stand as a quote on its own
			stubs.push(sinon.stub(Zotero.Embeddings, 'scoreTexts')
				.callsFake(async (query, texts) => texts.map((text, i) => 1 - i)));

			pinEngine('semantic');
			let session = await sessionFor();
			let [excerpt] = await session.getMatchingExcerpts(attachment.id);
			let quoted = excerpt.text.slice(excerpt.snippet.start, excerpt.snippet.end);

			assert.equal(excerpt.snippet.start, 0);
			assert.include(quoted, first);
			// The next sentence fits alongside it...
			assert.include(quoted, second);
			// ...and the one after that doesn't
			assert.notInclude(quoted, third);
		});

		it("should not ask the model to quote an item it never ranked", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getChunks').resolves([
				{ text: 'A passage of owlish things. '.repeat(20), chunkIndex: 0 }
			]));
			// The lexical engine scored the passage on a term it then can't
			// point at -- the one way a passage arrives with no ranges to
			// quote around
			stubs.push(sinon.stub(Zotero.Lexical, 'scoreTexts').resolves([0.8]));
			stubs.push(sinon.stub(Zotero.Lexical, 'findMatchRanges').resolves([[]]));
			let scoreTextsStub = sinon.stub(Zotero.Embeddings, 'scoreTexts');
			stubs.push(scoreTextsStub);

			// Hybrid, but scoring recorded no semantic match for this item
			let session = await sessionFor({ semantic: false });
			let [excerpt] = await session.getMatchingExcerpts(attachment.id);

			assert.isFalse(scoreTextsStub.called);
			// Left with the passage's opening, and its lexical share whole
			assert.equal(excerpt.snippet.start, 0);
			assert.closeTo(excerpt.strength, 0.8, 1e-9);
		});

		it("should read an indexed item's chunks when the model shows nothing", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getChunks').resolves([
				{ text: 'a passage naming the owl', chunkIndex: 0 },
				{ text: 'a passage naming nothing', chunkIndex: 1 }
			]));

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

		function settledOnce(session) {
			return new Promise((resolve) => {
				session.onUpdate = resolve;
			});
		}

		it("should build placeholder previews from the engines' match sets", async function () {
			stubScore(new Map([[att1.id, 0.9], [att2.id, 0.8], [att3.id, 0.7]]), [att1.id], [att2.id]);
			let session = Zotero.BestMatch.createSession('owl');
			let scores = await session.score([att1.id, att2.id, att3.id]);
			assert.equal(scores.get(att1.id), 0.9);
			assert.equal(session.getPreviews(att1.id).state, 'pending');
			assert.equal(session.getPreviews(att2.id).state, 'pending');
			// A scored item neither engine can show matches in -- a semantic
			// match that is its own preview -- gets no placeholder
			assert.isNull(session.getPreviews(att3.id));
		});

		it("should fill requested previews all at once and report them", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map([[att1.id, [
				{ source: 'title', text: 'owl atlas', ranges: [[0, 3]], strength: 1 },
				{ source: 'abstract', text: 'about owls', ranges: [[6, 10]], strength: 0.5 }
			]]]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			let settled = settledOnce(session);
			session.request([att1.id]);
			assert.deepEqual(await settled, [att1.id]);
			let preview = session.getPreviews(att1.id);
			assert.equal(preview.state, 'filled');
			assert.deepEqual(preview.entries.map(entry => entry.key), [0, 1]);
			assert.equal(preview.entries[0].text, 'owl atlas');
			assert.deepEqual(derive.firstCall.args, [att1.id]);
		});

		it("should not derive again for a repeated or settled request", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map([[att1.id, [
				{ source: 'title', text: 'owl', ranges: [], strength: 1 }
			]]]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			let settled = settledOnce(session);
			session.request([att1.id]);
			await settled;
			session.request([att1.id]);
			await Zotero.Promise.delay(50);
			assert.equal(derive.callCount, 1);
		});

		it("should derive preloaded previews without waiting to be requested", async function () {
			stubScore(new Map([[att1.id, 0.9], [att2.id, 0.8]]), [att1.id, att2.id]);
			let derive = stubDerive(new Map([
				[att1.id, [{ source: 'title', text: 'one', ranges: [], strength: 1 }]]
			]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id, att2.id]);

			await session.preload([att1.id]);
			// Settled by the time preload() resolves, with no request() and no
			// wait for an idle main thread
			assert.equal(session.getPreviews(att1.id).state, 'filled');
			assert.equal(session.getPreviews(att2.id).state, 'pending');

			// A preview already in hand costs nothing to preload again
			await session.preload([att1.id]);
			assert.equal(derive.callCount, 1);
		});

		it("should not preload after dispose", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map([[att1.id, [
				{ source: 'title', text: 'owl', ranges: [], strength: 1 }
			]]]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			session.dispose();
			await session.preload([att1.id]);
			assert.equal(derive.callCount, 0);
		});

		it("should let a newer request supersede an older one", async function () {
			stubScore(new Map([[att1.id, 0.9], [att2.id, 0.8]]), [att1.id, att2.id]);
			let derive = stubDerive(new Map([
				[att1.id, [{ source: 'title', text: 'one', ranges: [], strength: 1 }]],
				[att2.id, [{ source: 'title', text: 'two', ranges: [], strength: 1 }]]
			]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id, att2.id]);
			let settled = settledOnce(session);
			// The second request lands before the first's idle batch runs
			session.request([att1.id]);
			session.request([att2.id]);
			assert.deepEqual(await settled, [att2.id]);
			assert.equal(derive.callCount, 1);
			assert.equal(session.getPreviews(att1.id).state, 'pending');
		});

		it("should show nothing for a preview that derives nothing, and not retry it", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map());
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			let settled = settledOnce(session);
			session.request([att1.id]);
			assert.deepEqual(await settled, [att1.id]);
			assert.isNull(session.getPreviews(att1.id));
			session.request([att1.id]);
			await Zotero.Promise.delay(50);
			assert.equal(derive.callCount, 1);
		});

		it("should show nothing for a failed derivation", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			stubs.push(sinon.stub(Zotero.BestMatch.Session.prototype, 'getMatchingExcerpts')
				.rejects(new Error('cache file missing')));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			let settled = settledOnce(session);
			session.request([att1.id]);
			assert.deepEqual(await settled, [att1.id]);
			assert.isNull(session.getPreviews(att1.id));
		});

		it("should rederive an invalidated preview on the next request", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map([[att1.id, [
				{ source: 'title', text: 'owl', ranges: [], strength: 1 }
			]]]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			let settled = settledOnce(session);
			session.request([att1.id]);
			await settled;

			session.invalidate([att1.id]);
			assert.equal(session.getPreviews(att1.id).state, 'pending');

			let settledAgain = settledOnce(session);
			session.request([att1.id]);
			await settledAgain;
			assert.equal(derive.callCount, 2);
			assert.equal(session.getPreviews(att1.id).state, 'filled');
		});

		it("should derive nothing and never report after dispose", async function () {
			stubScore(new Map([[att1.id, 0.9]]), [att1.id]);
			let derive = stubDerive(new Map([[att1.id, [
				{ source: 'title', text: 'owl', ranges: [], strength: 1 }
			]]]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id]);
			let updated = false;
			session.onUpdate = () => {
				updated = true;
			};
			session.request([att1.id]);
			session.dispose();
			await Zotero.Promise.delay(50);
			assert.isFalse(updated);
			assert.equal(derive.callCount, 0);
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
			stubDerive(new Map([[att1.id, [
				{ source: 'title', text: 'owl', ranges: [], strength: 1 }
			]]]));
			let session = Zotero.BestMatch.createSession('owl');
			await session.score([att1.id, att2.id]);
			let settled = settledOnce(session);
			session.request([att1.id]);
			await settled;

			await session.score([att1.id, att2.id]);
			// The derived text survives the re-score...
			let preview = session.getPreviews(att1.id);
			assert.equal(preview.state, 'filled');
			assert.equal(preview.entries[0].text, 'owl');
			// ...and an item no longer matched loses its preview
			assert.isNull(session.getPreviews(att2.id));
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
