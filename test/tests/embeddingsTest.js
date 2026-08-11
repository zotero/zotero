"use strict";

describe("Zotero.Embeddings", function () {
	// The mean vector of the stand-in calibration below, which tests build
	// their stored vectors around
	var testMean;

	before(async function () {
		Zotero.Embeddings.Indexing.init();
		testMean = await calibrateTestModel();
	});

	// Stands in for a model's tokenizer, which the test environment has no
	// downloaded model to provide: one token per whitespace-separated word, plus
	// the two special tokens a real tokenizer wraps every input in, so counts
	// here mean what they mean in production
	function wordTokenizer() {
		return {
			encode: text => ['<s>', ...text.split(/\s+/).filter(Boolean), '</s>'],
			decode: ids => ids.filter(id => id !== '<s>' && id !== '</s>').join(' ')
		};
	}

	// Stands in for a measured model (see Zotero.Embeddings.ensureCalibration()),
	// which the test environment has no downloaded model to measure. The mean
	// is shaped like a real one -- mixed signs, and shorter than unit length,
	// since it averages vectors that don't all point the same way -- so that
	// centering behaves here as it does in production.
	//
	// Written once for the whole file: nothing here resets the embeddings
	// database, and a model switch clears only the stored vectors.
	async function calibrateTestModel(
		{ modelVersion = 'test-model/1', minScore = 0.2, maxDisplayScore = 0.6,
			dimensions = 384 } = {}
	) {
		await Zotero.Embeddings.initDB();
		let mean = new Float32Array(dimensions);
		for (let i = 0; i < dimensions; i++) {
			mean[i] = i % 4 < 2 ? 0.03 : -0.03;
		}
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.modelCalibration "
				+ "(modelVersion, meanVector, minScore, maxDisplayScore) VALUES (?, ?, ?, ?)",
			[
				modelVersion,
				new Uint8Array(mean.buffer, mean.byteOffset, mean.byteLength),
				minScore,
				maxDisplayScore
			],
			{ debugParams: false }
		);
		return mean;
	}

	describe("#initDB()", function () {
		it("should attach the embeddings database and create its tables", async function () {
			await Zotero.Embeddings.initDB();
			assert.equal(
				await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings"
				),
				0
			);
			// The database is stamped with the local user key
			assert.equal(
				await Zotero.DB.valueQueryAsync(
					"SELECT value FROM embeddings.itemEmbeddingsMeta WHERE key='localUserKey'"
				),
				Zotero.Users.getLocalUserKey()
			);
		});
	});

	describe("#scoreItemIDs()", function () {
		it("should report the index as not ready when it wasn't built by the active model", async function () {
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1')
			];
			try {
				let e = await getPromiseError(Zotero.Embeddings.scoreItemIDs('query', [1]));
				assert.instanceOf(e, Zotero.Embeddings.IndexNotReadyError);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("#scoreItemIDs() floor", function () {
		it("should not return items scoring below the model's minimum", async function () {
			// Centering subtracts the mean, so an item stored as the mean plus
			// one axis scores against the query by that axis's share of it
			let axis = (index, scale = 1) => {
				let vector = Float32Array.from(testMean);
				vector[index] += scale;
				return vector;
			};
			let store = async (item, vector) => {
				let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, sourceHash) "
						+ "VALUES (?, 0, ?, 'hash')",
					[item.id, blob], { debugParams: false }
				);
			};
			let close = await createDataObject('item');
			await store(close, axis(0));
			let distant = await createDataObject('item');
			await store(distant, axis(1));
			// Almost all of the query lies along the first item's axis
			let query = axis(0, 0.9);
			query[1] += 0.1;

			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(query)
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			try {
				let scores = await Zotero.Embeddings.scoreItemIDs('anything',
					[close.id, distant.id]);
				assert.isAbove(scores.get(close.id), 0.9);
				assert.isFalse(scores.has(distant.id));
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should fall back to text matches when nothing clears the minimum", async function () {
			let axis = (index, scale = 1) => {
				let vector = Float32Array.from(testMean);
				vector[index] += scale;
				return vector;
			};
			let store = async (item, vector) => {
				let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, sourceHash) "
						+ "VALUES (?, 0, ?, 'hash')",
					[item.id, blob], { debugParams: false }
				);
			};
			// Neither item is close to the query, but one says the word
			let literal = await createDataObject('item',
				{ title: 'Migratory timing in Arctic-breeding shorebirds' });
			await store(literal, axis(1));
			let unrelated = await createDataObject('item',
				{ title: 'Guild regulation in early modern Nuremberg' });
			await store(unrelated, axis(2));

			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(axis(0))
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			try {
				let scores = await Zotero.Embeddings.scoreItemIDs('birds',
					[literal.id, unrelated.id]);
				assert.isTrue(scores.has(literal.id));
				assert.isBelow(scores.get(literal.id), 0.2);
				assert.isFalse(scores.has(unrelated.id));

				// Every word has to appear
				scores = await Zotero.Embeddings.scoreItemIDs('breeding penguins',
					[literal.id, unrelated.id]);
				assert.isFalse(scores.has(literal.id));

				// With a real match to show, text matches stay out of it
				let match = await createDataObject('item', { title: 'Birds' });
				await store(match, axis(0));
				scores = await Zotero.Embeddings.scoreItemIDs('birds',
					[literal.id, unrelated.id, match.id]);
				assert.isTrue(scores.has(match.id));
				assert.isFalse(scores.has(literal.id));
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("shouldn't match a note's wrapper markup in the text fallback", async function () {
			let axis = (index, scale = 1) => {
				let vector = Float32Array.from(testMean);
				vector[index] += scale;
				return vector;
			};
			let store = async (item, vector) => {
				let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, sourceHash) "
						+ "VALUES (?, 0, ?, 'hash')",
					[item.id, blob], { debugParams: false }
				);
			};
			// Neither note is close to the query. One says the word; the other
			// contains it only in the '<div class="zotero-note znv1">' wrapper
			// every stored note carries, which mustn't count as saying it.
			let saying = new Zotero.Item('note');
			saying.setNote('<p>Field notes on shorebirds</p>');
			await saying.saveTx();
			await store(saying, axis(1));
			let silent = new Zotero.Item('note');
			silent.setNote('<p>Guild regulation in Nuremberg</p>');
			await silent.saveTx();
			await store(silent, axis(2));

			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(axis(0))
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			try {
				let scores = await Zotero.Embeddings.scoreItemIDs('note',
					[saying.id, silent.id]);
				assert.isTrue(scores.has(saying.id));
				assert.isFalse(scores.has(silent.id));

				// The wrapper's own vocabulary matches nothing at all
				scores = await Zotero.Embeddings.scoreItemIDs('znv1',
					[saying.id, silent.id]);
				assert.equal(scores.size, 0);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should surface unindexed items in the text fallback", async function () {
			let axis = (index, scale = 1) => {
				let vector = Float32Array.from(testMean);
				vector[index] += scale;
				return vector;
			};
			let store = async (item, vector) => {
				let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, sourceHash) "
						+ "VALUES (?, 0, ?, 'hash')",
					[item.id, blob], { debugParams: false }
				);
			};
			// An indexed item unrelated to the query, and a note too short to
			// be indexed -- no stored embedding at all -- that says the
			// query's word. The note's only findable content is literal, so
			// the fallback has to reach it.
			let unrelated = await createDataObject('item',
				{ title: 'Guild regulation in early modern Nuremberg' });
			await store(unrelated, axis(1));
			let note = new Zotero.Item('note');
			note.setNote('<p>testing</p>');
			await note.saveTx();

			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(axis(0))
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			try {
				let scores = await Zotero.Embeddings.scoreItemIDs('testing',
					[unrelated.id, note.id]);
				assert.isTrue(scores.has(note.id));
				// With nothing to rank it by, the note sits at the floor,
				// where the relevance bar is empty
				assert.equal(scores.get(note.id), 0.2);
				assert.equal(Zotero.Embeddings.getScoreFraction(scores.get(note.id)), 0);
				assert.isFalse(scores.has(unrelated.id));
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("#scoreItemIDs() chunks", function () {
		it("should score an item by its best chunk", async function () {
			let axis = (index, scale = 1) => {
				let vector = Float32Array.from(testMean);
				vector[index] += scale;
				return vector;
			};
			let store = async (item, chunkIndex, vector) => {
				let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, sourceHash) "
						+ "VALUES (?, ?, ?, 'hash')",
					[item.id, chunkIndex, blob], { debugParams: false }
				);
			};
			// A long text whose first chunk says nothing about the query but
			// whose second chunk matches it, and a single-chunk distractor
			let chunked = await createDataObject('item');
			await store(chunked, 0, axis(1));
			await store(chunked, 1, axis(0));
			let distant = await createDataObject('item');
			await store(distant, 0, axis(2));

			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(axis(0))
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			try {
				let scores = await Zotero.Embeddings.scoreItemIDs('anything',
					[chunked.id, distant.id]);
				// The item scores as its best chunk, not an average, so the
				// unrelated first chunk doesn't dilute the match
				assert.isAbove(scores.get(chunked.id), 0.9);
				assert.isFalse(scores.has(distant.id));
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("#chunkText()", function () {
		// bge has no passage prefix, so the window less the two special tokens
		// that wrap every input is what a chunk's own text gets (see MODELS).
		// bge's window is under the chunking ceiling, so the window governs here.
		const BUDGET = 512 - 2;
		// CHUNK_MAX_TOKENS less those same special tokens
		const CEILING = 768 - 2;
		var fakeTokenizer = wordTokenizer();
		// A chunk's own tokens, the way chunking counts them
		var contentTokens = chunk => fakeTokenizer.encode(chunk).length - 2;
		var stubs = [];

		beforeEach(function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5'));
		});

		afterEach(function () {
			stubs.forEach(stub => stub.restore());
			stubs = [];
		});

		it("should return text that fits the window as a single chunk", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(fakeTokenizer));
			assert.deepEqual(
				await Zotero.Embeddings.Chunking.chunkText('A short title'),
				['A short title']
			);
			// Right up to the budget it's still one chunk, and one token past it
			// splits -- the budget being the window less the special tokens that
			// wrap every input and the model's passage prefix
			let words = n => Array.from({ length: n }, (x, i) => `word${i}`).join(' ');
			assert.lengthOf(await Zotero.Embeddings.Chunking.chunkText(words(BUDGET)), 1);
			assert.isAbove((await Zotero.Embeddings.Chunking.chunkText(words(BUDGET + 1))).length, 1);
		});

		it("should bound a chunk by the chunking ceiling, not the model's window", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(fakeTokenizer));
			// A model that accepts far more at once doesn't get one vector per
			// note: that would average a note's subjects together, which is
			// what scoring an item by its best chunk exists to avoid
			stubs.push(sinon.stub(Zotero.Embeddings, 'getModelMaxTokens').returns(8192));
			let words = (tag, n) => Array.from({ length: n }, (x, i) => `${tag}${i}`).join(' ');
			// 2100 tokens: comfortably inside the window, past the ceiling
			let chunks = await Zotero.Embeddings.Chunking.chunkText(
				[words('alpha', 700), words('bravo', 700), words('charlie', 700)].join('\n\n')
			);
			assert.isAbove(chunks.length, 1);
			for (let chunk of chunks) {
				assert.isAtMost(contentTokens(chunk), CEILING);
			}
		});

		it("shouldn't put two substantial paragraphs in one chunk", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(fakeTokenizer));
			// Two paragraphs on different subjects, each well under the
			// window but together over it. Packing them by size alone would
			// leave a chunk straddling both.
			let a = Array.from({ length: 300 }, (x, i) => `alpha${i}`).join(' ');
			let b = Array.from({ length: 300 }, (x, i) => `bravo${i}`).join(' ');
			let chunks = await Zotero.Embeddings.Chunking.chunkText(`${a}\n\n${b}`);
			assert.lengthOf(chunks, 2);
			// Neither chunk mixes the two subjects
			assert.include(chunks[0], 'alpha0');
			assert.include(chunks[0], 'alpha299');
			assert.notInclude(chunks[0], 'bravo');
			assert.include(chunks[1], 'bravo0');
			assert.notInclude(chunks[1], 'alpha');
		});

		it("should combine paragraphs too small to embed on their own", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(fakeTokenizer));
			// A heading and a date, then a substantial paragraph, then a second
			// substantial paragraph -- the shape of an annotations note
			let big1 = Array.from({ length: 300 }, (x, i) => `alpha${i}`).join(' ');
			let big2 = Array.from({ length: 300 }, (x, i) => `bravo${i}`).join(' ');
			let chunks = await Zotero.Embeddings.Chunking.chunkText(
				`Annotations\n(11/12/2024)\n${big1}\n\n${big2}`
			);
			assert.lengthOf(chunks, 2);
			// The tiny paragraphs never become chunks of their own -- they ride
			// along with the paragraph that follows them
			assert.include(chunks[0], 'Annotations');
			assert.include(chunks[0], '11/12/2024');
			assert.include(chunks[0], 'alpha0');
			assert.notInclude(chunks[1], 'Annotations');
			// And the second subject still gets a chunk to itself
			assert.include(chunks[1], 'bravo0');
			assert.notInclude(chunks[1], 'alpha');
		});

		it("should split an oversized paragraph into even pieces at sentence boundaries", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(fakeTokenizer));
			// One paragraph of 60 ten-token sentences -- 600 tokens, over the
			// window, with no paragraph breaks to split at
			let sentences = Array.from({ length: 60 },
				(x, i) => `Sentence ${i} has some words about subject number ${i}.`);
			let chunks = await Zotero.Embeddings.Chunking.chunkText(sentences.join(' '));
			assert.lengthOf(chunks, 2);
			let sizes = chunks.map(contentTokens);
			for (let size of sizes) {
				assert.isAtMost(size, BUDGET);
				// Filling the first piece to the budget would leave a short
				// remainder; even pieces are ~300 plus the overlap
				assert.isAbove(size, 250);
			}
			// No sentence was dropped
			let joined = chunks.join('\n');
			for (let sentence of sentences) {
				assert.include(joined, sentence);
			}
			// Adjacent pieces of one paragraph still overlap
			assert.include(chunks[1], sentences[29]);
		});

		it("shouldn't leave an undersized piece at the end of a split", async function () {
			stubs.push(sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(fakeTokenizer));
			// A block only ever closes on a sentence boundary, so each piece
			// lands a little under its target. Without spreading that slack over
			// the pieces still to come, it accumulates into an extra runt piece
			// -- which is what CHUNK_MIN_TOKENS exists to prevent.
			for (let count of [45, 64, 83, 97, 140]) {
				let sentences = Array.from({ length: count },
					(x, i) => `Sentence ${i} has a few more words in it about subject ${i}.`);
				let chunks = await Zotero.Embeddings.Chunking.chunkText(sentences.join(' '));
				let sizes = chunks.map(contentTokens);
				let total = contentTokens(sentences.join(' '));
				// No more pieces than the window requires
				assert.equal(chunks.length, Math.ceil(total / (BUDGET - 48)),
					`piece count for ${count} sentences (sizes ${sizes.join(', ')})`);
				for (let size of sizes) {
					assert.isAtMost(size, BUDGET, `piece over the window (sizes ${sizes.join(', ')})`);
					assert.isAtLeast(size, 120, `runt piece (sizes ${sizes.join(', ')})`);
				}
			}
		});

	});

	describe("#getScoreFraction()", function () {
		it("should clamp scores into the measured display range", async function () {
			let stub = sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1');
			try {
				await Zotero.Embeddings.loadCalibration();
				assert.equal(Zotero.Embeddings.getScoreFraction(0), 0);
				assert.equal(Zotero.Embeddings.getScoreFraction(0.2), 0);
				assert.approximately(Zotero.Embeddings.getScoreFraction(0.4), 0.5, 0.001);
				assert.equal(Zotero.Embeddings.getScoreFraction(0.6), 1);
				assert.equal(Zotero.Embeddings.getScoreFraction(0.99), 1);
				// An unmeasured model has no band to place a score in -> empty bar
				stub.returns('unmeasured-model/1');
				await Zotero.Embeddings.loadCalibration();
				assert.equal(Zotero.Embeddings.getScoreFraction(0.9), 0);
			}
			finally {
				stub.restore();
			}
		});
	});

	describe("#embedQuery()", function () {
		it("should retry after a failed embed rather than caching the rejection", async function () {
			let embedStub = sinon.stub(Zotero.Embeddings, 'embed');
			embedStub.onFirstCall().rejects(new Error('embed failed'));
			embedStub.onSecondCall().resolves(new Float32Array([1]));
			let stubs = [
				sinon.stub(Zotero.Embeddings.Indexing, 'startIndexing').resolves(),
				sinon.stub(Zotero.Embeddings, 'pruneModels').resolves(),
				embedStub
			];
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			try {
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				assert.ok(await getPromiseError(Zotero.Embeddings.embedQuery('retry query')));
				// The eviction runs from a rejection handler
				await Zotero.Promise.delay(0);
				await Zotero.Embeddings.embedQuery('retry query');
				assert.equal(embedStub.callCount, 2);
			}
			finally {
				Zotero.Prefs.set('embeddings.model', '');
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				Zotero.Prefs.clear('embeddings.indexingPaused');
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should strip a single pair of wrapping quotes", async function () {
			let embedStub = sinon.stub(Zotero.Embeddings, 'embed').resolves(new Float32Array([1]));
			let stubs = [
				sinon.stub(Zotero.Embeddings.Indexing, 'startIndexing').resolves(),
				sinon.stub(Zotero.Embeddings, 'pruneModels').resolves(),
				embedStub
			];
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			try {
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				// Whitespace around the quotes doesn't defeat the stripping
				await Zotero.Embeddings.embedQuery(' "wrapped query" ');
				assert.include(embedStub.firstCall.args[0], 'wrapped query');
				assert.notInclude(embedStub.firstCall.args[0], '"');
				// A query that normalizes to nothing is a caller bug
				assert.throws(() => Zotero.Embeddings.embedQuery('""'));
			}
			finally {
				Zotero.Prefs.set('embeddings.model', '');
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				Zotero.Prefs.clear('embeddings.indexingPaused');
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should share one in-flight embed across concurrent calls", async function () {
			let deferred = Zotero.Promise.defer();
			let stubs = [
				sinon.stub(Zotero.Embeddings.Indexing, 'startIndexing').resolves(),
				sinon.stub(Zotero.Embeddings, 'pruneModels').resolves(),
				sinon.stub(Zotero.Embeddings, 'embed').callsFake(() => deferred.promise)
			];
			// Select a model so the query prefix and model version resolve; the
			// switch's indexing side effects are stubbed out above
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			try {
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				let promise1 = Zotero.Embeddings.embedQuery('concurrent query');
				let promise2 = Zotero.Embeddings.embedQuery('concurrent query');
				deferred.resolve(new Float32Array([1]));
				assert.equal(await promise1, await promise2);
				assert.equal(Zotero.Embeddings.embed.callCount, 1);
			}
			finally {
				Zotero.Prefs.set('embeddings.model', '');
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				Zotero.Prefs.clear('embeddings.indexingPaused');
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("#embedMany()", function () {
		// Stands in for the wrapper Zotero.ML.createEngine() resolves to. The
		// runtime destroys an idle engine in place: the retained wrapper's
		// engineStatus leaves 'ready' and run() throws, and the runtime
		// expects the caller to create a fresh engine.
		function fakeEngine(run) {
			let engine = {
				engineStatus: 'ready',
				run: (...args) => run(engine, ...args),
				terminate: async () => {}
			};
			return engine;
		}

		function stubModel(createEngine) {
			return [
				createEngine,
				sinon.stub(Zotero.ML, 'shutdown').resolves(),
				sinon.stub(Zotero.ML, 'getOptimalConcurrency').returns(2),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5'),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1')
			];
		}

		let liveRun = async (engine, { args: [texts] }) => texts.map(() => new Array(4).fill(0.5));

		it("should replace an engine the runtime destroyed mid-call and retry once", async function () {
			// The idle timer fires between _getEngine()'s liveness check and
			// the run: the wrapper reports closed and the run throws
			let dead = fakeEngine(async (engine) => {
				engine.engineStatus = 'closed';
				throw new Error('Port does not exist');
			});
			let live = fakeEngine(liveRun);
			let createEngine = sinon.stub(Zotero.ML, 'createEngine')
				.onFirstCall().resolves(dead)
				.onSecondCall().resolves(live);
			let stubs = stubModel(createEngine);
			try {
				let vectors = await Zotero.Embeddings.embedMany(['some text']);
				assert.lengthOf(vectors, 1);
				assert.equal(vectors[0].constructor.name, 'Float32Array');
				// [0.5, 0.5, 0.5, 0.5] is already unit length, so
				// normalization returns it unchanged
				assert.approximately(vectors[0][0], 0.5, 1e-6);
				assert.equal(createEngine.callCount, 2);
			}
			finally {
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should replace a cached engine the runtime destroyed while idle", async function () {
			let first = fakeEngine(liveRun);
			let second = fakeEngine(liveRun);
			let createEngine = sinon.stub(Zotero.ML, 'createEngine')
				.onFirstCall().resolves(first)
				.onSecondCall().resolves(second);
			let stubs = stubModel(createEngine);
			try {
				await Zotero.Embeddings.embedMany(['first call']);
				assert.equal(createEngine.callCount, 1);
				// The idle timeout destroyed the engine between calls
				first.engineStatus = 'closed';
				let vectors = await Zotero.Embeddings.embedMany(['second call']);
				assert.lengthOf(vectors, 1);
				assert.equal(createEngine.callCount, 2);
			}
			finally {
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				stubs.forEach(stub => stub.restore());
			}
		});

		it("shouldn't retry a failure from a live engine", async function () {
			let engine = fakeEngine(async () => {
				throw new Error('inference failed');
			});
			let createEngine = sinon.stub(Zotero.ML, 'createEngine').resolves(engine);
			let stubs = stubModel(createEngine);
			try {
				let e = await getPromiseError(Zotero.Embeddings.embedMany(['some text']));
				assert.equal(e.message, 'inference failed');
				assert.equal(createEngine.callCount, 1);
			}
			finally {
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("#pruneModels()", function () {
		it("should drop calibration for the models it no longer keeps", async function () {
			await calibrateTestModel({ modelVersion: 'kept-model/1' });
			await calibrateTestModel({ modelVersion: 'dropped-model/1' });
			let measured = () => Zotero.DB.columnQueryAsync(
				"SELECT modelVersion FROM embeddings.modelCalibration"
			);
			// No cached files to prune -- this is only about what we measured
			let stubs = [
				sinon.stub(Zotero.ML, 'listModels').resolves([]),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('kept-model/1')
			];
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			try {
				await Zotero.Embeddings.pruneModels();
				assert.sameMembers(await measured(), ['kept-model/1']);

				// Disabling keeps nothing, so re-enabling measures afresh
				// rather than reusing numbers taken against an older corpus
				Zotero.Prefs.clear('embeddings.model');
				await Zotero.Embeddings.pruneModels();
				assert.isEmpty(await measured());
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.model');
				// Pruning cleared the row the rest of the file scores against
				testMean = await calibrateTestModel();
			}
		});
	});

	describe("Calibration", function () {
		// Stub the model rather than setting the pref: writing embeddings.model
		// kicks off a real model switch, which clears the index and the stored
		// calibration out from under the tests that follow
		let corpusFor = (model) => {
			let stub = sinon.stub(Zotero.Embeddings, 'getModelName').returns(model);
			try {
				return Zotero.Embeddings.Calibration.getCorpus();
			}
			finally {
				stub.restore();
			}
		};

		it("should measure each model against the pairs it can read", function () {
			let en = corpusFor('bge-small-en-v1.5');
			let zh = corpusFor('bge-small-zh-v1.5');
			// A model that claims no language of its own is measured on all of them
			let all = corpusFor('multilingual-e5-small');
			assert.isAbove(en.length, 0);
			assert.isAbove(zh.length, 0);
			assert.isAbove(all.length, en.length + zh.length);

			// Text a model can't tokenize has to stay out of its corpus: it
			// can't tell two such passages apart, so they score highly against
			// each other and crowd out the tail that sets the floor
			let han = /[一-鿿]/;
			assert.isFalse(en.some(pair => han.test(pair.query) || han.test(pair.passage)));
			assert.isTrue(zh.every(pair => han.test(pair.query) && han.test(pair.passage)));
		});

		it("should only let models claim a language the corpus is written in", function () {
			let codes = Object.keys(Zotero.Embeddings.Calibration.languages);
			let stub = sinon.stub(Zotero.Embeddings, 'getModelName');
			try {
				for (let { name } of Zotero.Embeddings.getAvailableModels()) {
					stub.returns(name);
					let language = Zotero.Embeddings.getModelLanguage();
					if (language !== null) {
						assert.include(codes, language, name);
					}
					// Whichever it claims, there are pairs to measure it against
					assert.isAbove(Zotero.Embeddings.Calibration.getCorpus().length, 0, name);
				}
			}
			finally {
				stub.restore();
			}
		});
	});

	describe("Indexing", function () {
		it("should announce cleared embeddings when the model changes", async function () {
			let stubs = [
				sinon.stub(Zotero.Embeddings.Indexing, 'startIndexing').resolves(),
				sinon.stub(Zotero.Embeddings, 'pruneModels').resolves()
			];
			let item = await createDataObject('item');
			try {
				await Zotero.Embeddings.initDB();
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings VALUES (?, 0, ?, ?)",
					[item.id, new Uint8Array([0, 0, 0, 0]), 'hash']
				);
				// The model switch clears the old vectors and announces the
				// removals (after the coalescing delay), so active semantic
				// views refresh
				let promise = waitForNotifierEvent('refresh', 'item');
				Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
				let event = await promise;
				assert.include(event.ids, item.id);
				assert.equal(
					await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(*) FROM embeddings.itemEmbeddings"
					),
					0
				);
			}
			finally {
				Zotero.Prefs.set('embeddings.model', '');
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				Zotero.Prefs.clear('embeddings.indexingPaused');
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should remove a deleted item's embedding", async function () {
			await Zotero.Embeddings.initDB();
			let stub = sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true);
			try {
				let item = await createDataObject('item');
				await Zotero.DB.queryAsync(
					"INSERT INTO embeddings.itemEmbeddings VALUES (?, 0, ?, ?)",
					[item.id, new Uint8Array([0, 0, 0, 0]), 'hash']
				);
				await item.eraseTx();
				// The notifier delete handler runs asynchronously, so poll (the test
				// times out on failure)
				while (await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
						item.id)) {
					await Zotero.Promise.delay(10);
				}
			}
			finally {
				stub.restore();
			}
		});

		it("should skip items with too little text to say anything", async function () {
			this.timeout(60000);
			await createDataObject('item', { title: 'C' });
			await createDataObject('item', { title: 'Influenza' });
			await createDataObject('item', { title: '猫' });
			await createDataObject('item', { title: 'A study of feline behavior' });
			await createDataObject('item', { title: '猫行为研究' });

			let vector = new Float32Array(4).fill(0.5);
			let texts = [];
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages').callsFake(async (passages) => {
					texts.push(...passages);
					return passages.map(() => vector);
				}),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'preloadModel').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5'),
				sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(wordTokenizer())
			];
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}

			assert.include(texts, 'A study of feline behavior');
			// Scripts without spaces are counted at their real word boundaries
			assert.include(texts, '猫行为研究');
			// A title needs two words in any script
			assert.notInclude(texts, 'Influenza');
			assert.notInclude(texts, '猫');
			assert.notInclude(texts, 'C');
		});

		it("should index notes and annotations on their own text", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of indexed children' });
			let note = new Zotero.Item('note');
			note.parentID = item.id;
			note.setNote('<p>First paragraph about owls.</p><p>Second paragraph about migration.</p>');
			await note.saveTx();
			let attachment = await importPDFAttachment(item);
			let annotation = await createAnnotation('highlight', attachment,
				{ comment: 'A comment on the passage' });

			let vector = new Float32Array(4).fill(0.5);
			let texts = [];
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages').callsFake(async (passages) => {
					texts.push(...passages);
					return passages.map(() => vector);
				}),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'preloadModel').resolves(),
				// These fake an active model rather than selecting one (which
				// would kick off a model switch), so name one to keep the
				// window and passage prefix chunking reads consistent with it
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5'),
				sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(wordTokenizer())
			];
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}

			// The note is embedded on its own text, stripped of markup, with
			// all of its paragraphs
			let noteText = texts.find(text => text.includes('First paragraph about owls.'));
			assert.ok(noteText);
			assert.include(noteText, 'Second paragraph about migration.');
			assert.notInclude(noteText, '<p>');
			// The annotation is embedded on the passage it marks together
			// with its comment
			let annotationText = texts.find(text => text.includes(annotation.annotationText));
			assert.ok(annotationText);
			assert.include(annotationText, 'A comment on the passage');
			// Both have stored embeddings of their own; the attachment has none
			assert.ok(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", note.id));
			assert.ok(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", annotation.id));
			assert.equal(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", attachment.id), 0);
		});

		it("should judge a note by its full text when its first line says nothing", async function () {
			this.timeout(60000);
			// The derived title is only the first line, so this note's title
			// fails the embeddable-text test while its body sails past it
			let body = 'The body below the trivial first line has plenty to say about owl migration.';
			let indexed = new Zotero.Item('note');
			indexed.setNote(`<p>X</p><p>${body}</p>`);
			await indexed.saveTx();
			// A note that is its trivial first line and nothing else stays out
			let skipped = new Zotero.Item('note');
			skipped.setNote('<p>X</p>');
			await skipped.saveTx();

			let vector = new Float32Array(4).fill(0.5);
			let texts = [];
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages').callsFake(async (passages) => {
					texts.push(...passages);
					return passages.map(() => vector);
				}),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'preloadModel').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5'),
				sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(wordTokenizer())
			];
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}

			assert.ok(texts.find(text => text.includes(body)));
			assert.ok(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", indexed.id));
			assert.equal(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", skipped.id), 0);
		});

		it("should skip notes and annotations with fewer than three words", async function () {
			this.timeout(60000);
			let makeNote = async (html) => {
				let note = new Zotero.Item('note');
				note.setNote(html);
				await note.saveTx();
				return note;
			};
			// One- and two-word placeholders give the model nothing to rank by
			// meaning, so they stay out of the index no matter what they say
			let oneWord = await makeNote('<p>testing</p>');
			let twoWords = await makeNote('<p>meeting notes</p>');
			// Numbers and dates aren't words
			let numbers = await makeNote('<p>2024-03-15 12345</p>');
			let enoughWords = await makeNote('<p>Enough words to index</p>');
			// Scripts without spaces are counted at their real word
			// boundaries, so a short phrase still reaches the minimum while a
			// single word doesn't
			let chinese = await makeNote('<p>青蒿素的抗疟机制研究</p>');
			let chineseWord = await makeNote('<p>测试</p>');
			// An annotation is judged on its passage and comment together
			let item = await createDataObject('item',
				{ title: 'Parent of a short annotation' });
			let attachment = await importPDFAttachment(item);
			let shortAnnotation = await createAnnotation('highlight', attachment,
				{ comment: 'ok' });

			let vector = new Float32Array(4).fill(0.5);
			let texts = [];
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages').callsFake(async (passages) => {
					texts.push(...passages);
					return passages.map(() => vector);
				}),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'preloadModel').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5'),
				sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(wordTokenizer())
			];
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}

			assert.include(texts, 'Enough words to index');
			assert.include(texts, '青蒿素的抗疟机制研究');
			for (let skipped of [oneWord, twoWords, numbers, chineseWord, shortAnnotation]) {
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					skipped.id
				), 0, skipped.id);
			}
			for (let indexed of [enoughWords, chinese]) {
				assert.ok(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					indexed.id
				), indexed.id);
			}
		});

		it("should store a long note as multiple chunk rows sharing one source hash", async function () {
			this.timeout(60000);
			// Well over the model window under the fallback estimate (~3
			// characters per token), split across paragraphs
			let paragraphs = [];
			for (let i = 0; i < 12; i++) {
				paragraphs.push(`<p>Paragraph ${i}: ${'chunked note text '.repeat(40)}</p>`);
			}
			let note = new Zotero.Item('note');
			note.setNote(paragraphs.join(''));
			await note.saveTx();
			// Only notes are chunked -- an annotation of the same length is
			// embedded as a single chunk
			let item = await createDataObject('item', { title: 'Unchunked annotation parent' });
			let attachment = await importPDFAttachment(item);
			let annotation = await createAnnotation('highlight', attachment,
				{ comment: 'long annotation comment '.repeat(300) });

			let vector = new Float32Array(4).fill(0.5);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'preloadModel').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5'),
				sinon.stub(Zotero.Embeddings.Chunking, 'getTokenizer').resolves(wordTokenizer())
			];
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}

			let rows = await Zotero.DB.queryAsync(
				"SELECT chunkIndex, sourceHash FROM embeddings.itemEmbeddings "
					+ "WHERE itemID=? ORDER BY chunkIndex",
				note.id
			);
			assert.isAbove(rows.length, 1);
			// Contiguous chunk indexes and a single hash for the whole note
			assert.deepEqual(rows.map(row => row.chunkIndex), rows.map((row, i) => i));
			assert.equal(new Set(rows.map(row => row.sourceHash)).size, 1);
			// The equally long annotation stayed a single chunk
			assert.equal(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
				annotation.id
			), 1);
		});

		it("should look up stored hashes without a query per item", async function () {
			this.timeout(60000);
			for (let i = 0; i < 5; i++) {
				await createDataObject('item', { title: "Batched lookup " + i });
			}

			let vector = new Float32Array(4).fill(0.5);
			let embedStub = sinon.stub(Zotero.Embeddings, 'embedPassages')
				.callsFake(async texts => texts.map(() => vector));
			let stubs = [
				embedStub,
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'preloadModel').resolves()
			];
			let queries = [];
			let queryStub = sinon.stub(Zotero.DB, 'queryAsync')
				.callsFake(function (sql, ...rest) {
					queries.push(sql);
					return queryStub.wrappedMethod.call(this, sql, ...rest);
				});
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
			}
			finally {
				queryStub.restore();
				stubs.forEach(stub => stub.restore());
			}

			// The run has to have indexed something for this to mean anything
			assert.isTrue(embedStub.called);
			assert.isEmpty(queries.filter(sql => sql.includes('sourceHash')
				&& sql.includes('itemID=?')));
			assert.isNotEmpty(queries.filter(sql => sql.includes('itemID, sourceHash')));
		});
	});

	describe("#embed() with a real model", function () {
		before(function () {
			if (!Services.env.get("ZOTERO_TEST_EMBEDDINGS_INFERENCE")) {
				this.skip();
			}
		});

		after(async function () {
			await Zotero.Embeddings.shutdownEngine();
			Zotero.Prefs.clear('embeddings.model');
		});

		it("should produce real vectors that rank a related passage above an unrelated one", async function () {
			this.timeout(600000);
			// The runtime's model cache resolves navigator.storage via the most
			// recent browser window
			await loadZoteroPane();
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			await Zotero.Embeddings.preloadModel();

			let [related, unrelated] = await Zotero.Embeddings.embedPassages([
				"Gut bacteria produce short-chain fatty acids that affect host metabolism",
				"A history of eighteenth-century French opera and its patrons"
			]);
			let query = await Zotero.Embeddings.embedQuery("intestinal microbiome and metabolism");

			assert.isAbove(related.length, 100);
			assert.equal(related.length, query.length);
			// Vectors are normalized, so a dot product is the cosine similarity
			let dot = (a, b) => a.reduce((sum, val, i) => sum + val * b[i], 0);
			assert.approximately(dot(related, related), 1, 0.01);
			assert.isAbove(dot(query, related), dot(query, unrelated));
		});
		it("should report a cached model as downloaded and keep it when pruning", async function () {
			this.timeout(1800000);
			await loadZoteroPane();
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			await Zotero.Embeddings.preloadModel();

			assert.isTrue(await Zotero.Embeddings.isDownloaded());
			// Pruning with the model still selected has to keep it
			await Zotero.Embeddings.pruneModels();
			assert.isTrue(await Zotero.Embeddings.isDownloaded());
		});

		it("should chunk with the model's own tokenizer", async function () {
			this.timeout(1800000);
			await loadZoteroPane();
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			await Zotero.Embeddings.download();

			let tokenizer = await Zotero.Embeddings.Chunking.getTokenizer();
			assert.ok(tokenizer);
			assert.isAbove(tokenizer.encode('a passage about owls').length, 3);

			// A long text splits into chunks that each fit the real window
			let sentences = [];
			for (let i = 0; i < 100; i++) {
				sentences.push(`Sentence number ${i} concerns the ecology of temperate wetlands.`);
			}
			let chunks = await Zotero.Embeddings.Chunking.chunkText(sentences.join(' '));
			assert.isAbove(chunks.length, 1);
			for (let chunk of chunks) {
				assert.isAtMost(tokenizer.encode(chunk).length, 512);
			}
		});
	});

	describe("memory pressure", function () {
		afterEach(function () {
			Services.obs.notifyObservers(null, 'memory-pressure-stop');
		});

		it("should release the engine under pressure", async function () {
			let stub = sinon.stub(Zotero.Embeddings, 'shutdownEngine').resolves();
			try {
				Services.obs.notifyObservers(null, 'memory-pressure', 'low-memory');
				assert.isTrue(stub.called);
				// Releasing to free memory doesn't invalidate stored vectors,
				// so scoring in flight isn't discarded
				assert.isFalse(stub.firstCall.args[0].modelChanged);
			}
			finally {
				stub.restore();
			}
		});

		it("should stop shrinking at the floor", async function () {
			let stub = sinon.stub(Zotero.Embeddings, 'shutdownEngine').resolves();
			try {
				// Enough rounds to reach the floor from any starting point
				for (let i = 0; i < 6; i++) {
					Services.obs.notifyObservers(null, 'memory-pressure', 'low-memory');
				}
				let callsAtFloor = stub.callCount;
				Services.obs.notifyObservers(null, 'memory-pressure', 'low-memory');
				assert.equal(stub.callCount, callsAtFloor);
			}
			finally {
				stub.restore();
			}
		});
	});
	describe("#scoreItemIDs() centering", function () {
		it("should score text with nothing to say near zero", async function () {
			let store = async (item, vector) => {
				let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, sourceHash) "
						+ "VALUES (?, 0, ?, 'hash')",
					[item.id, blob], { debugParams: false }
				);
			};
			let normalized = (vector) => {
				let sum = 0;
				for (let val of vector) {
					sum += val * val;
				}
				let out = new Float32Array(vector.length);
				for (let i = 0; i < vector.length; i++) {
					out[i] = vector[i] / Math.sqrt(sum);
				}
				return out;
			};

			// One item whose vector is the direction every embedding shares,
			// and one that differs from it
			let empty = await createDataObject('item');
			await store(empty, normalized(testMean));
			let distinct = await createDataObject('item');
			let other = Float32Array.from(testMean);
			for (let i = 0; i < other.length; i += 2) {
				other[i] += 0.05;
			}
			await store(distinct, normalized(other));

			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(normalized(other))
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			try {
				let scores = await Zotero.Embeddings.scoreItemIDs('anything',
					[empty.id, distinct.id]);
				// Without centering the two would be nearly indistinguishable,
				// since both consist mostly of the shared direction
				let raw = 0;
				let a = normalized(testMean);
				let b = normalized(other);
				for (let i = 0; i < a.length; i++) {
					raw += a[i] * b[i];
				}
				assert.isAbove(raw, 0.5);
				// The shared direction is gone, so what's left of the first
				// item says nothing about the query and isn't a match at all
				assert.isFalse(scores.has(empty.id));
				assert.isAbove(scores.get(distinct.id), 0.9);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});
	});
});
