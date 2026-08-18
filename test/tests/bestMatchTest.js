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
		if (semantic) {
			stubs.push(sinon.stub(Zotero.Embeddings, 'scoreItemIDs').callsFake(semantic));
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

			let scores = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
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

			let scores = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3, 4]);
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

			let scores = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
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

			let scores = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
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

			let scores = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2, 3]);
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

			let scores = await Zotero.BestMatch.scoreItemIDs('owl', [1, 2]);
			assert.deepEqual([...scores.entries()], [[1, 0.8], [2, 0.3]]);
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

	describe("#getMatchingExcerpts()", function () {
		it("should return lexical excerpts when no semantic model is enabled", async function () {
			let lexicalExcerpts = [{ source: 'title', text: 'owl', ranges: [[0, 3]], strength: 1 }];
			let chunksStub = sinon.stub(Zotero.Embeddings, 'getMatchingChunks');
			stubs.push(chunksStub);
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(false));
			stubs.push(sinon.stub(Zotero.Lexical, 'getMatchingExcerpts')
				.resolves(lexicalExcerpts));

			let excerpts = await Zotero.BestMatch.getMatchingExcerpts('owl', 1);
			assert.isFalse(chunksStub.called);
			assert.equal(excerpts, lexicalExcerpts);
		});

		it("should overlay lexical highlights onto the semantic chunks that carry text", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: 'the owl chunk', score: 0.6, position: 1 },
				{ text: null, score: 0.9 }
			]));
			stubs.push(sinon.stub(Zotero.Lexical, 'getMatchingExcerpts').resolves([]));
			stubs.push(sinon.stub(Zotero.Lexical, 'findMatchRanges')
				.resolves([[[4, 7]]]));

			let excerpts = await Zotero.BestMatch.getMatchingExcerpts('owl', 1);
			assert.lengthOf(excerpts, 1);
			assert.equal(excerpts[0].text, 'the owl chunk');
			assert.deepEqual(excerpts[0].ranges, [[4, 7]]);
			assert.equal(excerpts[0].strength, 0.6);
			// Chunk fields pass through for the card's location line
			assert.equal(excerpts[0].position, 1);
		});

		it("should merge both engines' evidence, strongest first", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: 'a section that mentions owl migration in passing', score: 0.5 }
			]));
			stubs.push(sinon.stub(Zotero.Lexical, 'findMatchRanges')
				.resolves([[[24, 37]]]));
			stubs.push(sinon.stub(Zotero.Lexical, 'getMatchingExcerpts').resolves([
				{ source: 'title', text: 'Owl migration atlas', ranges: [[0, 13]], strength: 1 },
				// The same passage the chunk shows: redundant
				{
					source: 'content',
					text: '…that mentions owl migration in passing…',
					ranges: [[15, 28]],
					strength: 0.3
				},
				// A passage no chunk surfaced: stays
				{
					source: 'content',
					text: '…a different owl migration passage entirely…',
					ranges: [[13, 26]],
					strength: 0.3
				}
			]));

			let excerpts = await Zotero.BestMatch.getMatchingExcerpts('owl migration', 1);
			assert.deepEqual(
				excerpts.map(excerpt => excerpt.source || 'chunk'),
				['title', 'chunk', 'content']
			);
			assert.include(excerpts[2].text, 'different');
		});

		it("should cap the merged entries at the limit", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getScoreFraction').callsFake(score => score));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks').resolves([
				{ text: 'chunk one', score: 0.8 },
				{ text: 'chunk two', score: 0.4 }
			]));
			stubs.push(sinon.stub(Zotero.Lexical, 'findMatchRanges').resolves([[], []]));
			stubs.push(sinon.stub(Zotero.Lexical, 'getMatchingExcerpts').resolves([
				{ source: 'title', text: 'owl', ranges: [[0, 3]], strength: 0.6 }
			]));

			let excerpts = await Zotero.BestMatch.getMatchingExcerpts('owl', 1, { limit: 2 });
			assert.lengthOf(excerpts, 2);
			assert.equal(excerpts[0].text, 'chunk one');
			assert.equal(excerpts[1].source, 'title');
		});

		it("should keep the lexical excerpts alone when the model shows nothing", async function () {
			let lexicalExcerpts = [{ source: 'title', text: 'owl', ranges: [[0, 3]], strength: 1 }];
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Lexical, 'getMatchingExcerpts')
				.resolves(lexicalExcerpts));

			// No chunks with text
			let chunksStub = sinon.stub(Zotero.Embeddings, 'getMatchingChunks')
				.resolves([{ text: null }]);
			stubs.push(chunksStub);
			assert.equal(await Zotero.BestMatch.getMatchingExcerpts('owl', 1), lexicalExcerpts);

			// The semantic index isn't ready
			chunksStub.rejects(new Zotero.Embeddings.IndexNotReadyError('test'));
			assert.equal(await Zotero.BestMatch.getMatchingExcerpts('owl', 1), lexicalExcerpts);
		});

		it("should rethrow an unexpected semantic failure", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
			stubs.push(sinon.stub(Zotero.Lexical, 'getMatchingExcerpts').resolves([]));
			stubs.push(sinon.stub(Zotero.Embeddings, 'getMatchingChunks')
				.rejects(new Error('model exploded')));

			let e = await getPromiseError(Zotero.BestMatch.getMatchingExcerpts('owl', 1));
			assert.equal(e.message, 'model exploded');
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
