"use strict";

describe("Zotero.Embeddings", function () {
	// The mean vector of the stand-in calibration below, which tests build
	// their stored vectors around
	var testMean;
	var calibrationStub;

	before(function () {
		Zotero.Embeddings.Indexing.init();
		testMean = testCalibrationMean();
		// Stands in for a recorded model, which the test environment has no
		// downloaded model to measure, for every test in the file
		calibrationStub = sinon.stub(Zotero.Embeddings, 'getCalibration')
			.returns({ mean: testMean, minScore: 0.2, maxDisplayScore: 0.6 });
	});

	after(function () {
		calibrationStub.restore();
	});

	// A Zotero.SDT.getSections() section, built from its blocks -- which are
	// what indexing reads, the section's own text and span being derived.
	// A block is its text, or an object adding flowClass/reference/location.
	function sdtSection(outlinePath, start, blocks) {
		let entries = blocks.map((block, i) => Object.assign(
			{ index: start + i, reference: false },
			typeof block == 'string' ? { text: block } : block
		));
		return {
			text: entries.map(entry => entry.text).join('\n'),
			outlinePath,
			startBlock: start,
			endBlock: start + entries.length - 1,
			blocks: entries
		};
	}

	// A mean shaped like a real one -- mixed signs, and shorter than unit
	// length, since it averages vectors that don't all point the same way --
	// so that centering behaves here as it does in production
	function testCalibrationMean(dimensions = 384) {
		let mean = new Float32Array(dimensions);
		for (let i = 0; i < dimensions; i++) {
			mean[i] = i % 4 < 2 ? 0.03 : -0.03;
		}
		return mean;
	}

	// A vector as the index stores it: centered on the test mean and
	// quantized, the way Zotero.Embeddings.prepare() does with a loaded model
	function storedBlob(vector) {
		let stored = Zotero.Embeddings.quantize(Zotero.Embeddings.center(vector, testMean));
		return new Uint8Array(stored.buffer, stored.byteOffset, stored.byteLength);
	}

	describe("#quantize()", function () {
		it("should keep a vector's direction in 8 bits", function () {
			let vector = new Float32Array(384);
			for (let i = 0; i < vector.length; i++) {
				vector[i] = Math.sin(i * 12.9898) * (i % 7 ? 0.05 : 0.3);
			}
			let quantized = Zotero.Embeddings.quantize(vector);
			assert.equal(quantized.constructor.name, 'Int8Array');
			assert.lengthOf(quantized, 384);
			// The largest component fills the range, whichever sign it has
			assert.equal(Math.max(...Array.from(quantized, val => Math.abs(val))), 127);
			assert.isAbove(Zotero.Embeddings.cosine(quantized, vector), 0.9999);
		});

		it("should leave a vector with no length as zeros", function () {
			let quantized = Zotero.Embeddings.quantize(new Float32Array(8));
			assert.isTrue(quantized.every(val => val === 0));
			assert.equal(Zotero.Embeddings.cosine(quantized, quantized), 0);
		});
	});

	describe("#getCalibration()", function () {
		it("should decode every model's recorded calibration to a mean of its own width", function () {
			let recorded = calibrationStub.wrappedMethod;
			let stub = sinon.stub(Zotero.Embeddings, 'getModelName');
			try {
				for (let { name } of Zotero.Embeddings.getAvailableModels()) {
					stub.returns(name);
					let { mean, minScore, maxDisplayScore } = recorded.call(Zotero.Embeddings);
					// Built in the module's global, so not this scope's Float32Array
					assert.equal(mean.constructor.name, 'Float32Array', name);
					assert.include([256, 384, 512, 768, 1024], mean.length, name);
					assert.isBelow(minScore, maxDisplayScore, name);
				}
			}
			finally {
				stub.restore();
			}
		});
	});

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

		it("should score in SQL what cosine() computes in JS", async function () {
			let passage = Float32Array.from(testMean);
			passage[0] += 0.4;
			passage[1] += 0.2;
			let query = Float32Array.from(testMean);
			query[0] += 0.3;
			query[5] += 0.1;
			let item = await createDataObject('item');
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, sourceHash) "
					+ "VALUES (?, 0, ?, 'hash')",
				[item.id, storedBlob(passage)], { debugParams: false }
			);
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
				let { scores } = await Zotero.Embeddings.scoreItemIDs('anything', [item.id]);
				let expected = Zotero.Embeddings.cosine(
					Zotero.Embeddings.prepare(query),
					Zotero.Embeddings.prepare(passage)
				);
				assert.isAbove(expected, 0.5);
				assert.closeTo(scores.get(item.id), expected, 1e-4);
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
				let blob = storedBlob(vector);
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
				let { scores } = await Zotero.Embeddings.scoreItemIDs('anything',
					[close.id, distant.id]);
				assert.isAbove(scores.get(close.id), 0.9);
				assert.isFalse(scores.has(distant.id));
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
				let blob = storedBlob(vector);
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
				let { scores } = await Zotero.Embeddings.scoreItemIDs('anything',
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

	describe("#scoreItemIDs() previewable items", function () {
		it("should report which items a previewable chunk carries", async function () {
			let axis = (index, scale = 1) => {
				let vector = Float32Array.from(testMean);
				vector[index] += scale;
				return vector;
			};
			let store = async (item, chunkIndex, vector, { blocks = false } = {}) => {
				let blob = storedBlob(vector);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings "
						+ "(itemID, chunkIndex, embedding, sourceHash, startBlock, endBlock) "
						+ "VALUES (?, ?, ?, 'hash', ?, ?)",
					[item.id, chunkIndex, blob, blocks ? 0 : null, blocks ? 2 : null],
					{ debugParams: false }
				);
			};
			// One item matches through a chunk with source references (plus a
			// below-floor chunk with references, which must not count), one
			// matches only through a chunk without them, one matches through a
			// chunk without them while its only chunk with references scores
			// below the floor, and a distractor matches nothing
			let chunked = await createDataObject('item');
			await store(chunked, 0, axis(2), { blocks: true });
			await store(chunked, 1, axis(0), { blocks: true });
			let plain = await createDataObject('item');
			await store(plain, 0, axis(0));
			let buried = await createDataObject('item');
			await store(buried, 0, axis(0));
			await store(buried, 1, axis(2), { blocks: true });
			let distant = await createDataObject('item');
			await store(distant, 0, axis(3));

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
				let { scores, previewableIDs } = await Zotero.Embeddings.scoreItemIDs(
					'anything', [chunked.id, plain.id, buried.id, distant.id]);
				assert.isTrue(previewableIDs.has(chunked.id));
				// A match carried only by chunks without source references is
				// its own preview
				assert.isTrue(scores.has(plain.id));
				assert.isFalse(previewableIDs.has(plain.id));
				// References on a chunk the query didn't match don't make the
				// item's match showable
				assert.isTrue(scores.has(buried.id));
				assert.isFalse(previewableIDs.has(buried.id));
				assert.isFalse(previewableIDs.has(distant.id));
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	var axis = (index, scale = 1) => {
		let vector = Float32Array.from(testMean);
		vector[index] += scale;
		return vector;
	};
	var store = async (item, chunkIndex, vector, props = {}) => {
		let blob = storedBlob(vector);
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.itemEmbeddings "
				+ "(itemID, chunkIndex, embedding, sourceHash, startBlock, endBlock, "
				+ "startOffset, endOffset, textCheck, sectionPart, sectionParts) "
				+ "VALUES (?, ?, ?, 'hash', ?, ?, ?, ?, ?, ?, ?)",
			[
				item.id,
				chunkIndex,
				blob,
				props.startBlock ?? null,
				props.endBlock ?? null,
				props.startOffset ?? null,
				props.endOffset ?? null,
				props.text === undefined ? null : Zotero.Embeddings.textCheck(props.text),
				props.sectionPart ?? null,
				props.sectionParts ?? null
			],
			{ debugParams: false }
		);
	};
	// A document to re-derive chunk text from: what
	// Zotero.SDT.getBlockRanges() would report for each stored range
	var blockWorld = {
		0: { index: 0, text: 'The introduction', reference: false, outlineHeading: false },
		1: { index: 1, text: 'text', reference: false, outlineHeading: false },
		5: {
			index: 5,
			text: 'The sampling',
			reference: false,
			outlineHeading: false,
			pageIndex: 6,
			pageLabel: '7',
			position: { pageIndex: 6, rects: [[10, 20, 300, 40]] }
		},
		6: { index: 6, text: 'text procedures', reference: false, outlineHeading: false },
		12: { index: 12, text: 'The references text', reference: false, outlineHeading: false }
	};
	var stubBlockRanges = () => sinon.stub(Zotero.SDT, 'getBlockRanges').callsFake(
		async (itemID, ranges) => ({
			ok: true,
			ranges: ranges.map(([startBlock, endBlock]) => ({
				outlinePath: startBlock == 5 ? 'Methods > Sampling' : 'Introduction',
				blocks: Object.values(blockWorld).filter(
					block => block.index >= startBlock && block.index <= endBlock)
			}))
		})
	);

	describe("#getChunks()", function () {
		it("should return every chunk in document order without asking the model", async function () {
			let item = await createDataObject('item');
			await store(item, 1, axis(0), {
				text: 'The sampling\ntext',
				startBlock: 5,
				endBlock: 6,
				startOffset: 0,
				endOffset: 'text'.length,
				sectionPart: 2,
				sectionParts: 3
			});
			await store(item, 0, axis(1), {
				text: 'The introduction\ntext',
				startBlock: 0,
				endBlock: 1,
				startOffset: 0,
				endOffset: 'text'.length
			});
			// Disabled, and no model version stamped: reading how the item was
			// divided asks the model nothing
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(false),
				sinon.stub(Zotero.Embeddings, 'embedQuery').rejects(new Error('should not embed')),
				stubBlockRanges()
			];
			try {
				let chunks = await Zotero.Embeddings.getChunks(item.id);
				assert.lengthOf(chunks, 2);
				assert.deepEqual(chunks.map(chunk => chunk.chunkIndex), [0, 1]);
				assert.equal(chunks[0].text, 'The introduction\ntext');
				assert.equal(chunks[1].text, 'The sampling\ntext');
				assert.equal(chunks[1].outlinePath, 'Methods > Sampling');
				assert.equal(chunks[1].pageLabel, '7');
				// No score: nothing weighed these
				assert.isUndefined(chunks[1].score);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should return nothing for an item with no chunks", async function () {
			let item = await createDataObject('item');
			assert.deepEqual(await Zotero.Embeddings.getChunks(item.id), []);
		});
	});

	describe("#getMatchingChunks()", function () {
		it("should return an item's matching chunks with their locations, best first", async function () {
			let item = await createDataObject('item');
			// A weak match, a strong match, and a chunk below the floor
			let mixed = axis(0, 0.4);
			mixed[1] += 1;
			await store(item, 0, mixed, {
				text: 'The introduction\ntext',
				startBlock: 0,
				endBlock: 1,
				startOffset: 0,
				endOffset: 'text'.length
			});
			await store(item, 1, axis(0), {
				// The offsets cut into the last block's text
				text: 'The sampling\ntext',
				startBlock: 5,
				endBlock: 6,
				startOffset: 0,
				endOffset: 'text'.length,
				sectionPart: 2,
				sectionParts: 3
			});
			await store(item, 2, axis(2), {
				text: 'The references text', startBlock: 12, endBlock: 12,
				startOffset: 0, endOffset: 'The references text'.length
			});

			let query = axis(0, 0.9);
			query[1] += 0.1;
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(query),
				stubBlockRanges()
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			try {
				let chunks = await Zotero.Embeddings.getMatchingChunks('anything', item.id);
				// The chunk below the model's floor isn't a match
				assert.lengthOf(chunks, 2);
				// Best chunk first, its text re-derived from the blocks its
				// row references and cut to the stored offsets
				assert.equal(chunks[0].chunkIndex, 1);
				assert.equal(chunks[0].text, 'The sampling\ntext');
				assert.equal(chunks[0].outlinePath, 'Methods > Sampling');
				assert.equal(chunks[0].startBlock, 5);
				assert.equal(chunks[0].endBlock, 6);
				// Location is the first covered block's
				assert.equal(chunks[0].pageLabel, '7');
				assert.deepEqual(chunks[0].position,
					{ pageIndex: 6, rects: [[10, 20, 300, 40]] });
				assert.equal(chunks[0].sectionPart, 2);
				assert.equal(chunks[0].sectionParts, 3);
				assert.equal(chunks[1].chunkIndex, 0);
				assert.equal(chunks[1].text, 'The introduction\ntext');
				assert.isNull(chunks[1].position);
				assert.isAbove(chunks[0].score, chunks[1].score);
				// The limit caps how many come back
				let limited = await Zotero.Embeddings.getMatchingChunks('anything', item.id,
					{ limit: 1 });
				assert.lengthOf(limited, 1);
				assert.equal(limited[0].chunkIndex, 1);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should omit text and location when the source no longer matches the fingerprint", async function () {
			let item = await createDataObject('item');
			await store(item, 0, axis(0), {
				// A fingerprint from text the blocks no longer contain
				text: 'Words from an older extraction',
				startBlock: 5,
				endBlock: 6,
				startOffset: 0,
				endOffset: 'text'.length,
				sectionPart: 1,
				sectionParts: 1
			});
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(axis(0, 0.9)),
				stubBlockRanges()
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			try {
				// The chunk still matches -- its vector is intact -- but the
				// preview can't be shown, since the words it was embedded
				// from are gone
				let chunks = await Zotero.Embeddings.getMatchingChunks('anything', item.id);
				assert.lengthOf(chunks, 1);
				assert.isNull(chunks[0].text);
				assert.isNull(chunks[0].outlinePath);
				assert.isNull(chunks[0].pageLabel);
				assert.isNull(chunks[0].position);
				assert.equal(chunks[0].sectionPart, 1);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("#chunkText()", function () {
		// bge has no passage prefix, so the window less the two special tokens
		// that wrap every input, less the headroom held back for the character
		// estimate, is what a chunk's own text gets (see MODELS and
		// _getBudget()). bge's window is under the chunking ceiling, so the
		// window governs here.
		const BUDGET = Math.floor((512 - 2) * 0.9);
		// The shared BUDGET_TOKENS geometry under the same derivation
		const CEILING = Math.floor((768 - 2) * 0.9);
		// A chunk's own tokens, the way chunking estimates them: characters
		// at the chars-per-token scale of the whole text being chunked
		var estTokens = (text, whole) => text.length
			/ Zotero.Utilities.Internal.Chunking.getCharsPerToken(whole || text);
		// chunkText() returns { text, tokens, start, end }; most assertions
		// here are about the text
		var texts = chunks => chunks.map(chunk => chunk.text);
		// A paragraph of `count` sentences, each about 12 estimated tokens.
		// Sentences start with a capital: segmentation doesn't break on a
		// period followed by lowercase.
		var sentences = (tag, count) => Array.from({ length: count },
			(x, i) => `${tag} sentence number ${i} with several words in it.`).join(' ');
		var stubs = [];

		// A model with a 512-token window, which the fixtures are sized to
		beforeEach(function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-zh-v1.5'));
		});

		afterEach(function () {
			stubs.forEach(stub => stub.restore());
			stubs = [];
		});

		it("should return text that fits the window as a single chunk", async function () {
			let single = Zotero.Embeddings.Chunking.chunkText('A short title');
			assert.deepEqual(texts(single), ['A short title']);
			// Each chunk carries the count estimated on the way
			assert.equal(single[0].tokens, Math.round(estTokens('A short title')));
			// Right up to the budget it's still one chunk, and a token past it
			// splits -- pure letters, so the estimate is exactly four
			// characters per token
			let letters = tokens => 'a'.repeat(tokens * 4);
			assert.lengthOf(Zotero.Embeddings.Chunking.chunkText(letters(BUDGET)), 1);
			assert.isAbove((Zotero.Embeddings.Chunking.chunkText(letters(BUDGET + 1))).length, 1);
		});

		it("should bound a chunk by the chunking ceiling, not the model's window", async function () {
			// A model that accepts far more at once doesn't get one vector per
			// note: that would average a note's subjects together, which is
			// what scoring an item by its best chunk exists to avoid
			stubs.push(sinon.stub(Zotero.Embeddings, 'getModelMaxTokens').returns(8192));
			let words = (tag, n) => Array.from({ length: n }, (x, i) => `${tag}${i}`).join(' ');
			// ~1400 estimated tokens a paragraph: comfortably inside the
			// window, past the ceiling
			let chunks = Zotero.Embeddings.Chunking.chunkText(
				[words('alpha', 700), words('bravo', 700), words('charlie', 700)].join('\n\n')
			);
			assert.isAbove(chunks.length, 1);
			for (let chunk of chunks) {
				assert.isAtMost(chunk.tokens, CEILING);
			}
		});

		it("shouldn't put two substantial paragraphs in one chunk", async function () {
			// Two paragraphs on different subjects, each well under the
			// window but together over it. Packing them by size alone would
			// leave a chunk straddling both.
			let a = Array.from({ length: 150 }, (x, i) => `alpha${i}`).join(' ');
			let b = Array.from({ length: 150 }, (x, i) => `bravo${i}`).join(' ');
			let chunks = texts(Zotero.Embeddings.Chunking.chunkText(`${a}\n\n${b}`));
			assert.lengthOf(chunks, 2);
			// Neither chunk mixes the two subjects
			assert.include(chunks[0], 'alpha0');
			assert.include(chunks[0], 'alpha149');
			assert.notInclude(chunks[0], 'bravo');
			assert.include(chunks[1], 'bravo0');
			assert.notInclude(chunks[1], 'alpha');
		});

		it("should divide oversized text into even pieces at paragraph boundaries", async function () {
			// Four paragraphs of about 150 tokens, 600 in all: over the budget,
			// but only just, so the even division is two pieces of two
			// paragraphs. Filling each piece to the budget instead would put
			// three in the first and leave one on its own.
			let chunks = Zotero.Embeddings.Chunking.chunkText(
				['Alpha', 'Bravo', 'Charlie', 'Delta'].map(tag => sentences(tag, 12)).join('\n\n'));
			assert.lengthOf(chunks, 2);
			// Paragraphs stay whole, and the two pieces come out even
			assert.include(chunks[0].text, 'Alpha sentence');
			assert.include(chunks[0].text, 'Bravo sentence');
			assert.notInclude(chunks[0].text, 'Charlie');
			assert.include(chunks[1].text, 'Charlie sentence');
			assert.include(chunks[1].text, 'Delta sentence');
			assert.closeTo(chunks[0].tokens, chunks[1].tokens, chunks[0].tokens * 0.2);
		});

		it("should absorb a tail too small to stand alone rather than leaving it a chunk", async function () {
			// A paragraph filling most of the budget and a short one after it:
			// keeping the paragraph boundary would leave the tail as a runt, so
			// the two are divided at sentence boundaries instead
			let chunks = Zotero.Embeddings.Chunking.chunkText(
				sentences('Alpha', 32) + '\n\n' + sentences('Bravo', 8));
			assert.lengthOf(chunks, 2);
			for (let chunk of chunks) {
				assert.isAtLeast(chunk.tokens, Zotero.Utilities.Internal.Chunking.MIN_TOKENS);
				assert.isAtMost(chunk.tokens, BUDGET);
			}
			assert.closeTo(chunks[0].tokens, chunks[1].tokens, chunks[0].tokens * 0.35);
		});

		it("should combine paragraphs too small to embed on their own", async function () {
			// A heading and a date, then a substantial paragraph, then a second
			// substantial paragraph -- the shape of an annotations note
			let big1 = Array.from({ length: 150 }, (x, i) => `alpha${i}`).join(' ');
			let big2 = Array.from({ length: 150 }, (x, i) => `bravo${i}`).join(' ');
			let chunks = texts(Zotero.Embeddings.Chunking.chunkText(
				`Annotations\n(11/12/2024)\n${big1}\n\n${big2}`
			));
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
			// One paragraph of 60 sentences -- ~780 estimated tokens, over
			// the window, with no paragraph breaks to split at
			let sentences = Array.from({ length: 60 },
				(x, i) => `Sentence ${i} has some words about subject number ${i}.`);
			let chunks = Zotero.Embeddings.Chunking.chunkText(sentences.join(' '));
			assert.lengthOf(chunks, 2);
			for (let chunk of chunks) {
				assert.isAtMost(chunk.tokens, BUDGET);
				// Filling the first piece to the budget would leave a short
				// remainder; even pieces are ~390 plus the overlap
				assert.isAbove(chunk.tokens, 250);
			}
			// No sentence was dropped
			let joined = texts(chunks).join('\n');
			for (let sentence of sentences) {
				assert.include(joined, sentence);
			}
			// Adjacent pieces of one paragraph still overlap
			assert.isTrue(sentences.some(sentence => chunks[0].text.includes(sentence)
				&& chunks[1].text.includes(sentence)));
		});

		it("shouldn't leave an undersized piece at the end of a split", async function () {
			// A block only ever closes on a sentence boundary, so each piece
			// lands a little under its target. Without spreading that slack over
			// the pieces still to come, it accumulates into an extra runt piece
			// -- which is what the MIN_TOKENS geometry exists to prevent.
			for (let count of [45, 64, 83, 97, 140]) {
				let sentences = Array.from({ length: count },
					(x, i) => `Sentence ${i} has a few more words in it about subject ${i}.`);
				let text = sentences.join(' ');
				let chunks = Zotero.Embeddings.Chunking.chunkText(text);
				let sizes = chunks.map(chunk => chunk.tokens);
				let total = estTokens(text);
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

	describe("#chunkSections()", function () {
		var stubs = [];

		// A model with a 512-token window, which the fixtures are sized to
		beforeEach(function () {
			stubs.push(sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-zh-v1.5'));
		});

		afterEach(function () {
			stubs.forEach(stub => stub.restore());
			stubs = [];
		});

		var words = (tag, n) => Array.from({ length: n }, (x, i) => `${tag}${i}`).join(' ');
		// A section's text as `blockCount` block texts of `per` words each,
		// numbered straight through so `${tag}0` is in the first block
		var wordBlocks = (tag, blockCount, per) => Array.from({ length: blockCount },
			(x, i) => Array.from({ length: per },
				(y, j) => `${tag}${i * per + j}`).join(' '));

		it("shouldn't put two substantial sections in one chunk", async function () {
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Introduction', 0, wordBlocks('alpha', 5, 30)),
				sdtSection('Methods', 5, wordBlocks('bravo', 5, 30))
			]);
			assert.lengthOf(chunks, 2);
			// Neither chunk mixes the two sections, and each points back at
			// the blocks it covers, in full
			assert.include(chunks[0].text, 'alpha0');
			assert.notInclude(chunks[0].text, 'bravo');
			assert.equal(chunks[0].startBlock, 0);
			assert.equal(chunks[0].endBlock, 4);
			assert.equal(chunks[0].startOffset, 0);
			assert.equal(chunks[0].endOffset, wordBlocks('alpha', 5, 30)[4].length);
			assert.include(chunks[1].text, 'bravo0');
			assert.notInclude(chunks[1].text, 'alpha0');
			assert.equal(chunks[1].startBlock, 5);
			assert.equal(chunks[1].endBlock, 9);
		});

		it("should prefix the embedded text with the section's outline path", async function () {
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Results > Field studies', 2, [words('alpha', 150)])
			]);
			assert.lengthOf(chunks, 1);
			// What gets embedded carries the heading context; the display
			// text stays the plain piece
			assert.isTrue(chunks[0].embedText.startsWith('Results > Field studies\n\n'));
			assert.isTrue(chunks[0].text.startsWith('alpha0'));
			assert.equal(chunks[0].outlinePath, 'Results > Field studies');
		});

		it("should carry each merged section's own heading into the embedded text", async function () {
			// A stub too small to stand alone merges into the section after
			// it, so one chunk holds text from both. Labelling the whole
			// chunk with the stub's heading would describe almost none of it.
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Funding', 0, [words('alpha', 12)]),
				sdtSection('Methods', 1, wordBlocks('bravo', 4, 30))
			]);
			assert.lengthOf(chunks, 1);
			let embedded = chunks[0].embedText;
			// Each heading sits with the text it belongs to
			assert.isBelow(embedded.indexOf('Funding'), embedded.indexOf('alpha0'));
			assert.isBelow(embedded.indexOf('alpha0'), embedded.indexOf('Methods'));
			assert.isBelow(embedded.indexOf('Methods'), embedded.indexOf('bravo0'));
			// The plain text stays free of them, since block offsets index it
			assert.notInclude(chunks[0].text, 'Funding');
			assert.notInclude(chunks[0].text, 'Methods');
			// Both headings are counted against the window
			assert.isAbove(chunks[0].tokens,
				Zotero.Embeddings.Chunking.estimateTokens(chunks[0].text));
		});

		it("should label a chunk with the section it starts in", async function () {
			// Two small sections merge, then a third large one splits: the
			// pieces after the first belong to the section they sit in
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Preface', 0, [words('alpha', 12)]),
				sdtSection('Discussion', 1, wordBlocks('bravo', 8, 60))
			]);
			assert.isAbove(chunks.length, 1);
			assert.equal(chunks[0].outlinePath, 'Preface');
			for (let chunk of chunks.slice(1)) {
				assert.equal(chunk.outlinePath, 'Discussion');
				assert.notInclude(chunk.embedText, 'Preface');
			}
		});

		it("should combine sections too small to embed on their own", async function () {
			// Front matter before the first heading rides along with the
			// section that follows it, the way small paragraphs do in a note
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('', 0, ['Title page']),
				sdtSection('', 1, ['Copyright notice']),
				sdtSection('Introduction', 2, wordBlocks('alpha', 8, 18)),
				sdtSection('Methods', 10, wordBlocks('bravo', 10, 15))
			]);
			assert.lengthOf(chunks, 2);
			assert.include(chunks[0].text, 'Title page');
			assert.include(chunks[0].text, 'Copyright notice');
			assert.include(chunks[0].text, 'alpha0');
			assert.equal(chunks[0].startBlock, 0);
			assert.equal(chunks[0].endBlock, 9);
			// The substantial section that follows still gets a chunk of its own
			assert.include(chunks[1].text, 'bravo0');
			assert.notInclude(chunks[1].text, 'alpha0');
		});

		it("should join a trailing small section to the previous chunk", async function () {
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Body', 0, wordBlocks('alpha', 10, 15)),
				sdtSection('Appendix', 10, ['Short appendix note.', 'A closing line.'])
			]);
			assert.lengthOf(chunks, 1);
			assert.include(chunks[0].text, 'Short appendix note');
			assert.equal(chunks[0].startBlock, 0);
			assert.equal(chunks[0].endBlock, 11);
		});

		it("should split an oversized block into numbered pieces at their own offsets", async function () {
			// One block of 60 ten-token sentences: over the window, no
			// paragraph breaks, so splitting happens at sentence granularity
			// inside the block
			let sentences = Array.from({ length: 60 },
				(x, i) => `Sentence ${i} has some words about subject number ${i}.`);
			let block = sentences.join(' ');
			let position = { pageIndex: 4, rects: [[10, 20, 300, 40]] };
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Discussion', 3, [{
					text: block,
					pageIndex: 4,
					pageLabel: '5',
					position
				}])
			]);
			assert.isAbove(chunks.length, 1);
			// Every piece keeps its section's heading context, points at the
			// one block it came from at its own offsets, and knows which
			// piece of the section it is
			for (let i = 0; i < chunks.length; i++) {
				let chunk = chunks[i];
				assert.isTrue(chunk.embedText.startsWith('Discussion\n\n'));
				assert.equal(chunk.outlinePath, 'Discussion');
				assert.equal(chunk.startBlock, 3);
				assert.equal(chunk.endBlock, 3);
				assert.equal(chunk.pageLabel, '5');
				assert.deepEqual(chunk.position, position);
				assert.equal(chunk.sectionPart, i + 1);
				assert.equal(chunk.sectionParts, chunks.length);
				// Each piece is exactly the block's text at its offsets
				assert.equal(chunk.text, block.slice(chunk.startOffset, chunk.endOffset));
				if (i) {
					assert.isAbove(chunk.startOffset, chunks[i - 1].startOffset);
				}
			}
			// No sentence was dropped
			let joined = chunks.map(chunk => chunk.text).join('\n');
			for (let sentence of sentences) {
				assert.include(joined, sentence);
			}
		});

		it("should point each piece of a split section at the blocks it covers", async function () {
			// A section too big for one chunk, made of blocks that each know
			// where they are: a piece carries the location of the blocks it
			// actually covers, not the section's start
			let blocks = Array.from({ length: 60 }, (x, i) => ({
				text: `Sentence ${i} has some words about subject number ${i}.`,
				pageIndex: i,
				pageLabel: String(i + 1),
				position: { pageIndex: i, rects: [[10, 20, 300, 40]] }
			}));
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Discussion', 0, blocks)
			]);
			assert.isAbove(chunks.length, 1);
			for (let i = 0; i < chunks.length; i++) {
				let chunk = chunks[i];
				assert.isAtLeast(chunk.endBlock, chunk.startBlock);
				if (i) {
					assert.isAbove(chunk.startBlock, chunks[i - 1].startBlock);
				}
				// Located at its own first block
				assert.equal(chunk.pageLabel, String(chunk.startBlock + 1));
				assert.deepEqual(chunk.position,
					{ pageIndex: chunk.startBlock, rects: [[10, 20, 300, 40]] });
			}
			assert.isAbove(chunks[chunks.length - 1].startBlock, 0);
		});

		it("should keep auxiliary sections as standalone chunks", async function () {
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				// A small body section, a tiny caption, then a substantial
				// body section
				sdtSection('Results', 0, ['A short opening paragraph.']),
				{
					...sdtSection('Results', 1,
						['Figure 3: Owl migration routes across the Baltic.']),
					auxiliary: true
				},
				sdtSection('Results', 2, wordBlocks('alpha', 8, 18))
			]);
			assert.lengthOf(chunks, 2);
			// The caption is a chunk of its own, however small...
			let caption = chunks.find(chunk => chunk.auxiliary);
			assert.ok(caption);
			assert.equal(caption.text, 'Figure 3: Owl migration routes across the Baltic.');
			assert.equal(caption.sectionParts, 1);
			assert.equal(caption.startBlock, 1);
			assert.equal(caption.endBlock, 1);
			// ...and the small body section still merges with the body that
			// follows, straight across it
			let body = chunks.find(chunk => !chunk.auxiliary);
			assert.include(body.text, 'A short opening paragraph.');
			assert.include(body.text, 'alpha0');
			assert.notInclude(body.text, 'Figure 3');
			assert.equal(body.startBlock, 0);
			assert.equal(body.endBlock, 9);
		});

		it("shouldn't fold a trailing small body section into an auxiliary chunk", async function () {
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Body', 0, wordBlocks('alpha', 10, 15)),
				{
					...sdtSection('Body', 10,
						['Figure 1: A caption with enough words to keep.']),
					auxiliary: true
				},
				sdtSection('Body', 11, ['A trailing remnant paragraph.'])
			]);
			assert.lengthOf(chunks, 2);
			// The remnant joins the last body chunk, not the caption
			let caption = chunks.find(chunk => chunk.auxiliary);
			assert.equal(caption.text, 'Figure 1: A caption with enough words to keep.');
			let body = chunks.find(chunk => !chunk.auxiliary);
			assert.include(body.text, 'A trailing remnant paragraph.');
			assert.equal(body.endBlock, 11);
		});

		it("should mark an unsplit section as its only piece", async function () {
			let chunks = Zotero.Embeddings.Chunking.chunkSections([
				sdtSection('Body', 0, [words('alpha', 150)])
			]);
			assert.lengthOf(chunks, 1);
			assert.equal(chunks[0].sectionPart, 1);
			assert.equal(chunks[0].sectionParts, 1);
			assert.isNull(chunks[0].pageLabel);
			assert.isNull(chunks[0].position);
		});
	});

	describe("#getScoreFraction()", function () {
		it("should clamp scores into the recorded display range", function () {
			assert.equal(Zotero.Embeddings.getScoreFraction(0), 0);
			assert.equal(Zotero.Embeddings.getScoreFraction(0.2), 0);
			assert.approximately(Zotero.Embeddings.getScoreFraction(0.4), 0.5, 0.001);
			assert.equal(Zotero.Embeddings.getScoreFraction(0.6), 1);
			assert.equal(Zotero.Embeddings.getScoreFraction(0.99), 1);
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
			Zotero.Prefs.set('embeddings.model', 'bekko-embedding-v1-a8m');
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
			Zotero.Prefs.set('embeddings.model', 'bekko-embedding-v1-a8m');
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
			Zotero.Prefs.set('embeddings.model', 'bekko-embedding-v1-a8m');
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
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
		it("should collapse whitespace and give a model's tokenizer the leading space the runtime omits", async function () {
			let seen = [];
			let engine = fakeEngine(async (engine, { args: [texts] }) => {
				seen.push(...texts);
				return texts.map(() => Array.from({ length: 384 }, (_, i) => Math.sin(i + 1)));
			});
			let modelName = sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m');
			let stubs = [
				sinon.stub(Zotero.ML, 'createEngine').resolves(engine),
				sinon.stub(Zotero.ML, 'shutdown').resolves(),
				sinon.stub(Zotero.ML, 'getOptimalConcurrency').returns(2),
				modelName,
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-spacing/1')
			];
			try {
				await Zotero.Embeddings.embedMany(['some text', 'more', 'line one\nline  two\n']);
				assert.deepEqual(seen, [' some text', ' more', ' line one line two']);
				// A model whose tokenizer doesn't mark the first word is left alone
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				seen = [];
				modelName.returns('bge-small-zh-v1.5');
				await Zotero.Embeddings.embedMany(['some text']);
				assert.deepEqual(seen, ['some text']);
			}
			finally {
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				stubs.forEach(stub => stub.restore());
			}
		});
		it("should keep only the first dims of a model that truncates", async function () {
			// 384 raw dimensions from the engine; bekko-a25m stores 256 of them
			let raw = Array.from({ length: 384 }, (_, i) => Math.sin(i + 1));
			let engine = fakeEngine(async (engine, { args: [texts] }) => texts.map(() => raw));
			let stubs = [
				sinon.stub(Zotero.ML, 'createEngine').resolves(engine),
				sinon.stub(Zotero.ML, 'shutdown').resolves(),
				sinon.stub(Zotero.ML, 'getOptimalConcurrency').returns(2),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-truncating/1')
			];
			try {
				let [vector] = await Zotero.Embeddings.embedMany(['some text']);
				assert.lengthOf(vector, 256);
				let norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
				assert.closeTo(norm, 1, 1e-5);
				// The head of the raw vector, renormalized
				assert.closeTo(Zotero.Embeddings.cosine(vector, raw.slice(0, 256)), 1, 1e-6);
			}
			finally {
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("#ensureModelAvailable()", function () {
		it("should disable semantic search and drop the index when the selected model no longer exists", async function () {
			let stubs = [
				sinon.stub(Zotero.ML, 'listModels').resolves([]),
				sinon.stub(Zotero.Embeddings.Indexing, 'startIndexing').resolves()
			];
			let item = await createDataObject('item');
			try {
				// As if a build removed the model a user had selected
				Zotero.Prefs.set('embeddings.model', 'removed-model');
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				await Zotero.Embeddings.initDB();
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings "
						+ "(itemID, chunkIndex, embedding, sourceHash) VALUES (?, 0, ?, ?)",
					[item.id, new Uint8Array([0, 0, 0, 0]), 'hash']
				);
				assert.isFalse(Zotero.Embeddings.isEnabled());

				Zotero.Embeddings.ensureModelAvailable();
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				assert.equal(Zotero.Embeddings.getModelName(), '');
				assert.equal(
					await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM embeddings.itemEmbeddings"),
					0
				);
				// Nothing to do for a model that exists, or none
				Zotero.Embeddings.ensureModelAvailable();
				assert.equal(Zotero.Embeddings.getModelName(), '');
			}
			finally {
				Zotero.Prefs.clear('embeddings.model');
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexingPaused');
			}
		});
	});

	describe("Diagnostics", function () {
		it("should estimate remaining time once the window spans long enough", function () {
			let diagnostics = Zotero.Embeddings.Diagnostics;
			try {
				diagnostics.startRun();
				let batch = { chunks: 10, tokens: 1000, longest: 100, inferenceMs: 100 };
				diagnostics.recordBatch(batch);
				// One batch spans no time, so the window isn't trusted yet
				assert.isNull(diagnostics.estimateSeconds(300));
				// A batch a minute ago makes the window a minute wide
				diagnostics.startRun();
				diagnostics.recordBatch({ ...batch, time: Date.now() - 60 * 1000 });
				diagnostics.recordBatch(batch);
				assert.approximately(diagnostics.estimateSeconds(300), 900, 1);
				assert.isNull(diagnostics.estimateSeconds(0));
			}
			finally {
				diagnostics.endRun();
			}
		});
	});

	describe("Calibration", function () {
		// Stub the language rather than setting the model pref: writing
		// embeddings.model kicks off a real model switch, which clears the
		// index and the stored calibration out from under the tests that follow
		let corpusFor = (language) => {
			let stub = sinon.stub(Zotero.Embeddings, 'getModelLanguage').returns(language);
			try {
				return Zotero.Embeddings.Calibration.getCorpus();
			}
			finally {
				stub.restore();
			}
		};

		it("should give every query a passage and a near miss of chunk length", function () {
			for (let triple of corpusFor(null)) {
				assert.isString(triple.passage, triple.query);
				assert.isString(triple.nearMiss, triple.query);
				// The floor measured on near misses has to gate chunks of the
				// passages' length, so a near miss can't be a short paraphrase
				assert.isAtLeast(triple.nearMiss.length, triple.passage.length / 2, triple.query);
			}
		});

		it("should not build a near miss on its passage's wording", function () {
			// A near miss that reuses the passage's sentences with the nouns
			// swapped scores close to it for the phrasing alone, so the floor
			// it sets says nothing about the subject
			let grams = (text) => {
				let words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
				return new Set(words.slice(3).map((_, i) => words.slice(i, i + 4).join(' ')));
			};
			for (let triple of corpusFor(null)) {
				let passage = grams(triple.passage);
				let nearMiss = grams(triple.nearMiss);
				let shared = [...nearMiss].filter(gram => passage.has(gram)).length;
				assert.isBelow(shared / Math.min(passage.size, nearMiss.size), 0.08, triple.query);
			}
		});

		it("should measure each model against the triples it can read", function () {
			let en = corpusFor('en');
			let zh = corpusFor('zh');
			// A model that claims no language of its own is measured on all of them
			let all = corpusFor(null);
			assert.isAbove(en.length, 0);
			assert.isAbove(zh.length, 0);
			assert.isAbove(all.length, en.length + zh.length);

			// Text a model can't tokenize has to stay out of its corpus: it
			// can't tell a passage from its near miss, so both numbers would
			// describe that rather than what the model is there to rank
			let han = /[一-鿿]/;
			let texts = triple => [triple.query, triple.passage, triple.nearMiss];
			assert.isFalse(en.some(triple => texts(triple).some(text => han.test(text))));
			assert.isTrue(zh.every(triple => texts(triple).every(text => han.test(text))));
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
					// Whichever it claims, there are triples to measure it against
					assert.isAbove(Zotero.Embeddings.Calibration.getCorpus().length, 0, name);
				}
			}
			finally {
				stub.restore();
			}
		});
	});

	describe("Endpoint", function () {
		const URL = 'http://localhost:8080/v1/embeddings';
		// Deterministic unit vectors, one per text, in the width the served
		// model stores (bekko keeps 256 of its 384)
		let vectorFor = (text, dims = 256) => {
			let state = 0;
			for (let i = 0; i < text.length; i++) {
				state = (state * 31 + text.charCodeAt(i)) % 2147483647;
			}
			let vector = new Float32Array(dims);
			for (let d = 0; d < dims; d++) {
				state = (state * 1103515245 + 12345) % 2147483648;
				vector[d] = state / 2147483648 - 0.5;
			}
			let norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
			return vector.map(val => val / norm);
		};
		// A server: answers each request from `remoteFor(text)`, or throws
		// what `failWith(texts)` returns
		let serve = ({ remoteFor = vectorFor, model = 'served', failWith = () => null, shape = null } = {}) => {
			let calls = [];
			return {
				calls,
				stub: sinon.stub(Zotero.HTTP, 'request').callsFake(async (method, url, options) => {
					let { input } = JSON.parse(options.body);
					calls.push({ url, input, headers: options.headers });
					let error = failWith(input);
					if (error) {
						throw error;
					}
					if (shape) {
						return { status: 200, response: shape };
					}
					return {
						status: 200,
						response: {
							model,
							data: input.map((text, index) => ({ index, embedding: Array.from(remoteFor(text)) }))
						}
					};
				})
			};
		};
		let status = code => new Zotero.HTTP.UnexpectedStatusException({ status: code }, URL, `HTTP ${code}`);
		let stubs;
		beforeEach(async function () {
			stubs = [
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-endpoint/1'),
				sinon.stub(Zotero.Embeddings, 'embedMany').callsFake(async texts => texts.map(text => vectorFor(text)))
			];
			await Zotero.DB.queryAsync("DELETE FROM embeddings.itemEmbeddingsMeta WHERE key='endpoint'");
			Zotero.Embeddings.Endpoint.reset();
		});
		afterEach(async function () {
			stubs.forEach(stub => stub.restore());
			Zotero.HTTP.request.restore?.();
			Zotero.Prefs.clear('embeddings.endpoint');
			await Zotero.DB.queryAsync("DELETE FROM embeddings.itemEmbeddingsMeta WHERE key='endpoint'");
		});

		it("should describe how to serve the model", function () {
			let { command, url } = Zotero.Embeddings.Endpoint.getCommand();
			assert.include(command, 'hotchpotch/bekko-embedding-v1-a8m-GGUF:F16');
			assert.include(command, '--pooling mean');
			assert.include(url, 'localhost');
		});

		it("should accept a server whose vectors match the model's", async function () {
			let server = serve();
			let verdict = await Zotero.Embeddings.Endpoint.verify(URL);
			assert.equal(verdict.state, 'ok');
			assert.equal(verdict.serverModel, 'served');
			assert.closeTo(verdict.agreement, 1, 1e-5);
			// The regular texts in one request, the chunk-length one alone
			assert.lengthOf(server.calls, 2);
			assert.isAbove(server.calls[0].input.length, 10);
			assert.isAbove(server.calls[1].input[0].length, 8000);
		});

		it("should reject a server serving something else", async function () {
			serve({ remoteFor: text => vectorFor(text + ' but different') });
			let verdict = await Zotero.Embeddings.Endpoint.verify(URL);
			assert.equal(verdict.state, 'low-agreement');
			assert.isBelow(verdict.agreement, 0.5);
		});

		it("should reject vectors narrower than the model's", async function () {
			serve({ remoteFor: text => vectorFor(text, 100) });
			let verdict = await Zotero.Embeddings.Endpoint.verify(URL);
			assert.equal(verdict.state, 'width-mismatch');
		});

		it("should tell an unreachable server, a wrong endpoint, and one wanting credentials apart", async function () {
			serve({ failWith: () => new Error('connection refused') });
			assert.equal((await Zotero.Embeddings.Endpoint.verify(URL)).state, 'unreachable');
			Zotero.HTTP.request.restore();
			serve({ failWith: () => status(404) });
			assert.equal((await Zotero.Embeddings.Endpoint.verify(URL)).state, 'not-embeddings');
			Zotero.HTTP.request.restore();
			serve({ shape: { choices: [] } });
			assert.equal((await Zotero.Embeddings.Endpoint.verify(URL)).state, 'not-embeddings');
			Zotero.HTTP.request.restore();
			serve({ failWith: () => status(401) });
			assert.equal((await Zotero.Embeddings.Endpoint.verify(URL)).state, 'unauthorized');
		});

		it("should reject a server that can't take a chunk-length text", async function () {
			// llama.cpp rejects it
			serve({ failWith: texts => (texts[0].length > 8000 ? status(500) : null) });
			assert.equal((await Zotero.Embeddings.Endpoint.verify(URL)).state, 'context-too-small');
			Zotero.HTTP.request.restore();
			// Or embeds what fits and says nothing
			serve({ remoteFor: text => vectorFor(text.length > 8000 ? text.slice(0, 2000) : text) });
			assert.equal((await Zotero.Embeddings.Endpoint.verify(URL)).state, 'context-too-small');
		});

		it("should route passages only to a verified endpoint for this model", async function () {
			let server = serve();
			// Configured but unverified: local
			Zotero.Prefs.set('embeddings.endpoint', URL);
			await Zotero.Embeddings.embedPassages(['a passage']);
			assert.lengthOf(server.calls, 0);
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'unverified');

			await Zotero.Embeddings.Endpoint.verify(URL);
			let vectors = await Zotero.Embeddings.embedPassages(['a passage']);
			assert.lengthOf(server.calls, 3);
			// The batch plus its sentinel went out; only the batch came back
			assert.lengthOf(server.calls[2].input, 2);
			assert.lengthOf(vectors, 1);
			assert.closeTo(Zotero.Embeddings.cosine(vectors[0], vectorFor('a passage')), 1, 1e-5);
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'ok');

			// Verified for another URL: local
			Zotero.Prefs.set('embeddings.endpoint', 'http://elsewhere/v1/embeddings');
			await Zotero.Embeddings.embedPassages(['a passage']);
			assert.lengthOf(server.calls, 3);
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'unverified');

			// Verified for another model version: local
			Zotero.Prefs.set('embeddings.endpoint', URL);
			stubs[1].returns('test-endpoint/2');
			await Zotero.Embeddings.embedPassages(['a passage']);
			assert.lengthOf(server.calls, 3);
		});

		it("should stop trusting a server whose model changes mid-run", async function () {
			let server = serve();
			Zotero.Prefs.set('embeddings.endpoint', URL);
			await Zotero.Embeddings.Endpoint.verify(URL);
			Zotero.HTTP.request.restore();
			server = serve({ model: 'something-else' });
			let [vector] = await Zotero.Embeddings.embedPassages(['a passage']);
			// The batch embedded locally, and the endpoint is out
			assert.lengthOf(server.calls, 1);
			assert.closeTo(Zotero.Embeddings.cosine(vector, vectorFor('a passage')), 1, 1e-5);
			let status = Zotero.Embeddings.Endpoint.getStatus();
			assert.equal(status.state, 'invalid');
			await Zotero.Embeddings.embedPassages(['another']);
			assert.lengthOf(server.calls, 1);
		});

		it("should stop trusting a server whose vectors drift under the same name", async function () {
			serve();
			Zotero.Prefs.set('embeddings.endpoint', URL);
			await Zotero.Embeddings.Endpoint.verify(URL);
			Zotero.HTTP.request.restore();
			let server = serve({ remoteFor: text => vectorFor(text + ' drifted') });
			let [vector] = await Zotero.Embeddings.embedPassages(['first', 'a longer second passage']);
			// Caught on the very batch through its sentinel: nothing served was returned
			assert.lengthOf(server.calls, 1);
			assert.closeTo(Zotero.Embeddings.cosine(vector, vectorFor('first')), 1, 1e-5);
			let status = Zotero.Embeddings.Endpoint.getStatus();
			assert.equal(status.state, 'invalid');
		});

		it("should leave a server alone after repeated failures until the next run", async function () {
			serve();
			Zotero.Prefs.set('embeddings.endpoint', URL);
			await Zotero.Embeddings.Endpoint.verify(URL);
			Zotero.HTTP.request.restore();
			let server = serve({ failWith: () => new Error('timeout') });
			for (let i = 0; i < 5; i++) {
				await Zotero.Embeddings.embedPassages([`passage ${i}`]);
			}
			assert.lengthOf(server.calls, 3);
			let status = Zotero.Embeddings.Endpoint.getStatus();
			assert.equal(status.state, 'unreachable');

			// The next run tries again, and a server that answers is back
			Zotero.HTTP.request.restore();
			server = serve();
			await Zotero.Embeddings.Endpoint.recheck();
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'ok');
			await Zotero.Embeddings.embedPassages(['again']);
			assert.lengthOf(server.calls, 2);
		});

		it("should recheck a verified server when a run starts", async function () {
			serve();
			Zotero.Prefs.set('embeddings.endpoint', URL);
			await Zotero.Embeddings.Endpoint.verify(URL);
			Zotero.HTTP.request.restore();
			serve({ failWith: () => new Error('connection refused') });
			await Zotero.Embeddings.Endpoint.recheck();
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'unreachable');
			Zotero.HTTP.request.restore();
			serve({ model: 'swapped' });
			await Zotero.Embeddings.Endpoint.recheck();
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'invalid');
		});

		it("should embed a failed batch locally and keep the endpoint", async function () {
			let server = serve();
			Zotero.Prefs.set('embeddings.endpoint', URL);
			await Zotero.Embeddings.Endpoint.verify(URL);
			Zotero.HTTP.request.restore();
			server = serve({ failWith: () => status(500) });
			let [vector] = await Zotero.Embeddings.embedPassages(['a passage']);
			assert.closeTo(Zotero.Embeddings.cosine(vector, vectorFor('a passage')), 1, 1e-5);
			assert.lengthOf(server.calls, 1);
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'ok');
		});
	});

	describe("Indexing", function () {
		it("should clear embeddings when the model changes", async function () {
			let stubs = [
				sinon.stub(Zotero.Embeddings.Indexing, 'startIndexing').resolves(),
				sinon.stub(Zotero.Embeddings, 'pruneModels').resolves()
			];
			let item = await createDataObject('item');
			try {
				await Zotero.Embeddings.initDB();
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings "
						+ "(itemID, chunkIndex, embedding, sourceHash) VALUES (?, 0, ?, ?)",
					[item.id, new Uint8Array([0, 0, 0, 0]), 'hash']
				);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemChunkCounts (itemID, sourceHash, chunks) "
						+ "VALUES (?, ?, 1)",
					[item.id, 'hash']
				);
				// The model switch clears the old vectors
				Zotero.Prefs.set('embeddings.model', 'bekko-embedding-v1-a8m');
				await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
				assert.equal(
					await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(*) FROM embeddings.itemEmbeddings"
					),
					0
				);
				// Chunks are sized to the model, so the counts go too
				assert.equal(
					await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(*) FROM embeddings.itemChunkCounts"
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
					"INSERT INTO embeddings.itemEmbeddings "
						+ "(itemID, chunkIndex, embedding, sourceHash) VALUES (?, 0, ?, ?)",
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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				// These fake an active model rather than selecting one (which
				// would kick off a model switch), so name one to keep the
				// window and passage prefix chunking reads consistent with it
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
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

		it("should index an attachment's sections when fulltext indexing is enabled", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of fulltext attachment' });
			let attachment = await importPDFAttachment(item);

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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				// The extraction itself is sdt.js's concern (see sdtTest.js);
				// what's under test is what indexing does with the sections
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').resolves({
					ok: true,
					sections: [
						sdtSection('Introduction', 0, [{
							text: 'Owls migrate south when the winters turn cold.',
							pageIndex: 0,
							pageLabel: '2',
							position: { pageIndex: 0, rects: [[10, 20, 300, 40]] }
						}]),
						sdtSection('Methods', 4, [{
							text: 'Tracking devices recorded the routes of forty owls.',
							pageIndex: 1,
							pageLabel: '3',
							position: { pageIndex: 1, rects: [[10, 20, 300, 40]] }
						}])
					]
				})
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();

				// Both sections are far too small to embed on their own, so
				// they land in one chunk, prefixed with the first section's
				// outline path and referencing both sections' blocks
				let rows = await Zotero.DB.queryAsync(
					"SELECT chunkIndex, startBlock, endBlock, startOffset, endOffset, "
						+ "textCheck, sectionPart, sectionParts "
						+ "FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				);
				assert.lengthOf(rows, 1);
				assert.equal(rows[0].startBlock, 0);
				assert.equal(rows[0].endBlock, 4);
				assert.equal(rows[0].startOffset, 0);
				assert.equal(rows[0].endOffset,
					'Tracking devices recorded the routes of forty owls.'.length);
				assert.equal(rows[0].sectionPart, 1);
				assert.equal(rows[0].sectionParts, 1);
				// The fingerprint covers the plain chunk text, without the
				// outline-path context the embedded text carries
				assert.equal(rows[0].textCheck, Zotero.Embeddings.textCheck(
					'Owls migrate south when the winters turn cold.\n\n'
					+ 'Tracking devices recorded the routes of forty owls.'
				));
				let text = texts.find(t => t.includes('Owls migrate south'));
				assert.ok(text);
				assert.isTrue(text.startsWith('Introduction\n\n'));
				assert.include(text, 'Tracking devices');

				// And the preview round-trips: re-derived from the referenced
				// blocks, cut to the offsets, located at the first block
				stubs.push(
					sinon.stub(Zotero.Embeddings, 'embedQuery')
						.resolves(new Float32Array(4).fill(0.5)),
					sinon.stub(Zotero.SDT, 'getBlockRanges').resolves({
						ok: true,
						ranges: [{
							outlinePath: 'Introduction',
							blocks: [
								{
									index: 0,
									text: 'Owls migrate south when the winters turn cold.',
									reference: false,
									outlineHeading: false,
									pageIndex: 0,
									pageLabel: '2',
									position: { pageIndex: 0, rects: [[10, 20, 300, 40]] }
								},
								{
									index: 4,
									text: 'Tracking devices recorded the routes of forty owls.',
									reference: false,
									outlineHeading: false,
									pageIndex: 1,
									pageLabel: '3',
									position: { pageIndex: 1, rects: [[10, 20, 300, 40]] }
								}
							]
						}]
					})
				);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
						+ "VALUES ('modelVersion', 'test-model/1')"
				);
				let chunks = await Zotero.Embeddings.getMatchingChunks('owls', attachment.id);
				assert.lengthOf(chunks, 1);
				assert.include(chunks[0].text, 'Owls migrate south');
				assert.include(chunks[0].text, 'Tracking devices');
				assert.equal(chunks[0].outlinePath, 'Introduction');
				assert.equal(chunks[0].pageLabel, '2');
				assert.deepEqual(chunks[0].position,
					{ pageIndex: 0, rects: [[10, 20, 300, 40]] });
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should drop attachment chunks when fulltext indexing is turned off", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of pruned attachment' });
			let attachment = await importPDFAttachment(item);

			let vector = new Float32Array(4).fill(0.5);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').resolves({
					ok: true,
					sections: [
						sdtSection('', 0, ['A section with enough words to be worth indexing.'])
					]
				})
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.ok(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				));
				assert.ok(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemChunkCounts WHERE itemID=?",
					attachment.id
				));

				// Turning the pref off makes attachments ineligible, and the
				// pref observer prunes their stored chunks and chunk counts.
				// The observer runs asynchronously, so poll (the test times
				// out on failure).
				Zotero.Prefs.set('embeddings.indexFulltext', false);
				while (await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
						attachment.id)) {
					await Zotero.Promise.delay(10);
				}
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemChunkCounts WHERE itemID=?",
					attachment.id
				), 0);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should record an attachment's chunk count at extraction and keep it once embedded", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of counted attachment' });
			let attachment = await importPDFAttachment(item);

			let vector = new Float32Array(4).fill(0.5);
			// Two sections long enough that the chunker keeps them apart
			let sections = [
				sdtSection('', 0, ['Owls hunt at night. '.repeat(120)]),
				sdtSection('', 1, ['Hawks hunt by day. '.repeat(120)])
			];
			// Embedding the attachment fails on the first run, so its count
			// can only have come from the extraction step
			let failAttachment = true;
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages').callsFake(async (texts) => {
					if (failAttachment && texts.some(text => text.includes('hunt'))) {
						throw new Error('Embedding failed');
					}
					return texts.map(() => vector);
				}),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').resolves({ ok: true, sections })
			];
			// Status reports the ledger, and items apart from it
			let assertStatusMatchesLedger = async () => {
				let { items, chunks } = Zotero.Embeddings.Indexing.getStatus();
				assert.isAtLeast(items.done, 1);
				assert.isAtLeast(items.total, items.done);
				let ledger = await Zotero.DB.rowQueryAsync(
					"SELECT COALESCE(SUM(chunks), 0) AS total, COALESCE(SUM(embedded), 0) AS done "
						+ "FROM embeddings.itemChunkCounts"
				);
				assert.deepEqual(chunks, { done: ledger.done, total: ledger.total });
				return chunks;
			};
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();
				let counted = await Zotero.DB.valueQueryAsync(
					"SELECT chunks FROM embeddings.itemChunkCounts WHERE itemID=?",
					attachment.id
				);
				assert.isAbove(counted, 1);
				let chunks = await assertStatusMatchesLedger();
				assert.isAtLeast(chunks.total - chunks.done, counted);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				), 0);
				// Only attachments are counted
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemChunkCounts WHERE itemID=?",
					item.id
				), 0);

				// The count marks the attachment as extracted, so the next
				// run goes straight to embedding it
				failAttachment = false;
				Zotero.SDT.ensure.resetHistory();
				let phases = new Set();
				let listener = status => phases.add(status.phase);
				Zotero.Embeddings.Indexing.addProgressListener(listener);
				try {
					await Zotero.Embeddings.Indexing.startIndexing();
				}
				finally {
					Zotero.Embeddings.Indexing.removeProgressListener(listener);
				}
				assert.isFalse(Zotero.SDT.ensure.calledWith(attachment.id));
				assert.notInclude([...phases], 'extracting');
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT chunks FROM embeddings.itemChunkCounts WHERE itemID=?",
					attachment.id
				), counted);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings "
						+ "WHERE itemID=? AND embedding IS NOT NULL",
					attachment.id
				), counted);
				await assertStatusMatchesLedger();
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should store an attachment's chunks as they're embedded and resume from them", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of resumed attachment' });
			let attachment = await importPDFAttachment(item);

			let vector = new Float32Array(4).fill(0.5);
			// More chunks than fit one engine call, so the attachment spans
			// several batches
			let sections = [];
			for (let i = 0; i < 12; i++) {
				sections.push(sdtSection('', i, ['Owls hunt at night. '.repeat(200)]));
			}
			// The first batch with the attachment's text succeeds, the next
			// one fails, so the run ends with the attachment partly stored
			let hunts = 0;
			let failSecond = true;
			let embedded = [];
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages').callsFake(async (texts) => {
					if (texts.some(text => text.includes('hunt'))) {
						if (failSecond && ++hunts === 2) {
							throw new Error('Embedding failed');
						}
						embedded.push(...texts.filter(text => text.includes('hunt')));
					}
					return texts.map(() => vector);
				}),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').resolves({ ok: true, sections })
			];
			let ledgerRow = () => Zotero.DB.rowQueryAsync(
				"SELECT chunks, embedded FROM embeddings.itemChunkCounts WHERE itemID=?",
				attachment.id
			);
			let storedRows = () => Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings "
					+ "WHERE itemID=? AND embedding IS NOT NULL",
				attachment.id
			);
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();
				let { chunks, embedded: stored } = await ledgerRow();
				assert.isAbove(chunks, 20);
				assert.isAbove(stored, 0);
				assert.isBelow(stored, chunks);
				assert.equal(await storedRows(), stored);
				assert.equal(embedded.length, stored);

				// The next run embeds only what's missing
				failSecond = false;
				embedded = [];
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.equal(embedded.length, chunks - stored);
				let after = await ledgerRow();
				assert.equal(after.chunks, chunks);
				assert.equal(after.embedded, chunks);
				assert.equal(await storedRows(), chunks);

				// ...and a complete attachment isn't read again
				let reads = Zotero.SDT.getSections.callCount;
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.equal(Zotero.SDT.getSections.callCount, reads);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should report pipeline diagnostics", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of measured attachment' });
			let attachment = await importPDFAttachment(item);
			let vector = new Float32Array(4).fill(0.5);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').resolves({
					ok: true,
					sections: [
						sdtSection('', 0, ['Owls hunt at night. '.repeat(200)]),
						sdtSection('', 1, ['Hawks hunt by day. '.repeat(200)])
					]
				})
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();
				let { diagnostics } = await Zotero.Embeddings.Indexing.refreshStatus();

				// Every stored chunk carries its size
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=? AND tokens IS NULL",
					attachment.id
				), 0);

				// Rates come from the run's batches
				assert.isAbove(diagnostics.run.batches, 0);
				assert.isAbove(diagnostics.run.chunksPerSecond, 0);
				assert.isAbove(diagnostics.run.tokensPerSecond, 0);
				assert.isAbove(diagnostics.run.paddingEfficiency, 0);
				assert.isAtMost(diagnostics.run.paddingEfficiency, 1);
				assert.isAbove(diagnostics.window.chunksPerSecond, 0);
				assert.isNull(diagnostics.slice);
				assert.isAtLeast(diagnostics.engine.threads, 1);
				// Nothing left to embed, so no estimate
				assert.isNull((await Zotero.Embeddings.Indexing.refreshStatus()).eta);

				// Chunk shape agrees with the tables
				let { sizes, perDocument } = diagnostics.chunks;
				assert.equal(sizes.count, await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE sectionParts IS NOT NULL"
				));
				assert.equal(sizes.buckets.reduce((sum, b) => sum + b.count, 0), sizes.count);
				assert.isAbove(sizes.median, 0);
				assert.equal(perDocument.count, await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemChunkCounts"
				));
				assert.equal(perDocument.buckets.reduce((sum, b) => sum + b.count, 0), perDocument.count);
				assert.isAtLeast(perDocument.max, await Zotero.DB.valueQueryAsync(
					"SELECT chunks FROM embeddings.itemChunkCounts WHERE itemID=?", attachment.id
				));
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should skip an attachment's auxiliary blocks", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of captioned attachment' });
			let attachment = await importPDFAttachment(item);

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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').resolves({
					ok: true,
					sections: [
						sdtSection('Results', 0, [
							'Body text about owl migration patterns.',
							{
								text: 'Figure 3: Owl migration routes across the Baltic.',
								flowClass: 'auxiliary'
							},
							'More body text about the wintering grounds.',
							{ text: 'Figure 4', flowClass: 'auxiliary' }
						])
					]
				})
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();

				// The stubbed sections apply to every attachment the run
				// re-embeds, so judge the distinct fulltext passages
				let passages = [...new Set(texts)]
					.filter(text => text.startsWith('Results'));
				// The body reads straight through; neither caption is indexed
				assert.lengthOf(passages, 1);
				assert.include(passages[0], 'Body text about owl migration');
				assert.include(passages[0], 'More body text about the wintering');
				assert.isFalse(texts.some(text => text.includes('Figure')));
				// The chunk references its blocks straight across the caption's
				let rows = await Zotero.DB.queryAsync(
					"SELECT startBlock, endBlock FROM embeddings.itemEmbeddings "
						+ "WHERE itemID=? ORDER BY chunkIndex",
					attachment.id
				);
				assert.deepEqual(rows.map(row => [row.startBlock, row.endBlock]), [[0, 2]]);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should skip an attachment's reference entries", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of cited attachment' });
			let attachment = await importPDFAttachment(item);

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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').resolves({
					ok: true,
					sections: [
						sdtSection('Discussion', 0, [
							'Owls migrate south when the winters turn cold.',
							// An entry cited inline, inside a body section
							{
								text: 'Smith, J. (2019). Owls. J. Birds 4, 1-10.',
								reference: true
							}
						]),
						// A section that's nothing but references
						sdtSection('References', 2, [
							{
								text: 'Doe, A. (2020). Migration. Nature 1, 2-3.',
								reference: true
							}
						])
					]
				})
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();

				// The stubbed sections apply to every attachment the run
				// re-embeds, so judge the distinct fulltext passages. Only
				// the prose is indexed; a section left with nothing but
				// references contributes no chunk at all.
				let passages = [...new Set(texts)]
					.filter(text => text.startsWith('Discussion'));
				assert.lengthOf(passages, 1);
				assert.include(passages[0], 'Owls migrate south');
				assert.notInclude(passages[0], 'Smith, J.');
				assert.isFalse(texts.some(text => text.includes('Doe, A.')));
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				), 1);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should chunk an attachment that has nothing stored yet", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of derived attachment' });
			let attachment = await importPDFAttachment(item);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'getSections').resolves({
					ok: true,
					sections: [
						sdtSection('Results', 0, ['Owls hunt at night. '.repeat(200)]),
						sdtSection('Discussion', 1, ['Hawks hunt by day. '.repeat(200)])
					]
				})
			];
			try {
				assert.isEmpty(await Zotero.Embeddings.getChunks(attachment.id));
				let chunks = await Zotero.Embeddings.Indexing.getAttachmentChunks(attachment);
				assert.isAbove(chunks.length, 1);
				for (let chunk of chunks) {
					assert.isAbove(chunk.tokens, 0);
					assert.isNotEmpty(chunk.text);
				}
				assert.include(chunks.map(chunk => chunk.outlinePath), 'Results');
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should index recently touched attachments first", async function () {
			this.timeout(60000);
			// One attachment per signal, each under its own parent. All are
			// created now and then backdated, so creation order can't account
			// for the result.
			let attachments = [];
			for (let i = 0; i < 5; i++) {
				let item = await createDataObject('item', { title: 'Parent of recency attachment ' + i });
				attachments.push(await importPDFAttachment(item));
			}
			let [read, annotated, parentEdited, noted, untouched] = attachments;
			let annotation = await createAnnotation('highlight', annotated);
			let note = new Zotero.Item('note');
			note.parentID = noted.parentID;
			note.setNote('<p>A note about the attachment next to it.</p>');
			await note.saveTx();
			let ids = [
				...attachments.map(a => a.id),
				...attachments.map(a => a.parentID),
				annotation.id,
				note.id
			];
			await Zotero.DB.queryAsync(
				"UPDATE items SET dateModified='2020-01-01 00:00:00' WHERE itemID IN ("
					+ ids.join(',') + ")");
			// One signal each, newest first: read, annotated, parent
			// edited, note added
			await Zotero.DB.queryAsync(
				"UPDATE itemAttachments SET lastRead=? WHERE itemID=?",
				[Date.UTC(2024, 0, 5) / 1000, read.id]);
			await Zotero.DB.queryAsync(
				"UPDATE items SET dateModified='2024-01-04 00:00:00' WHERE itemID=?", annotation.id);
			await Zotero.DB.queryAsync(
				"UPDATE items SET dateModified='2024-01-03 00:00:00' WHERE itemID=?", parentEdited.parentID);
			await Zotero.DB.queryAsync(
				"UPDATE items SET dateModified='2024-01-02 00:00:00' WHERE itemID=?", note.id);

			let extracted = [];
			let vector = new Float32Array(4).fill(0.5);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').callsFake(async (itemID) => {
					// Sections are read once to count chunks and again to
					// embed; the first read is the order of interest
					if (attachments.some(a => a.id === itemID) && !extracted.includes(itemID)) {
						extracted.push(itemID);
					}
					return {
						ok: true,
						sections: [
							sdtSection('', 0, ['A section with enough words to be worth indexing.'])
						]
					};
				})
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();

				assert.deepEqual(extracted,
					[read.id, annotated.id, parentEdited.id, noted.id, untouched.id]);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should run items, then extraction, then attachments, one step at a time", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of phased attachment' });
			let note = new Zotero.Item('note');
			note.parentID = item.id;
			note.setNote('<p>A note with several words about owls.</p>');
			await note.saveTx();
			let attachment = await importPDFAttachment(item);

			let vector = new Float32Array(4).fill(0.5);
			// What the run did, in order, as the steps themselves report it
			let events = [];
			let ensureStub = sinon.stub(Zotero.SDT, 'ensure').callsFake(async () => {
				events.push('extract');
				return true;
			});
			let getSectionsStub = sinon.stub(Zotero.SDT, 'getSections').resolves({
				ok: true,
				sections: [sdtSection('', 0, ['A section with enough words to be worth indexing.'])]
			});
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages').callsFake(async (passages) => {
					events.push(passages.some(text => text.includes('A section with enough'))
						? 'embed-attachment'
						: 'embed-item');
					return passages.map(() => vector);
				}),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				ensureStub,
				getSectionsStub
			];
			let phases = [];
			let onProgress = (status) => {
				if (status.phase !== phases[phases.length - 1]) {
					phases.push(status.phase);
				}
			};
			Zotero.Embeddings.Indexing.addProgressListener(onProgress);
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();

				// Every item embeds before any document is extracted, and
				// every document is extracted before any of them embeds
				assert.include(events, 'embed-item');
				assert.include(events, 'embed-attachment');
				assert.isBelow(events.lastIndexOf('embed-item'), events.indexOf('extract'));
				assert.isBelow(events.lastIndexOf('extract'), events.indexOf('embed-attachment'));
				assert.isTrue(ensureStub.calledWith(attachment.id));
				assert.isTrue(getSectionsStub.calledWith(attachment.id));
				// And each step announces itself, in the same order
				assert.deepEqual(
					phases.filter(phase => phase !== 'idle'),
					['indexing', 'extracting', 'indexing-attachments']
				);
			}
			finally {
				Zotero.Embeddings.Indexing.removeProgressListener(onProgress);
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("shouldn't prepare an attachment whose stored embedding is current", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of current attachment' });
			let attachment = await importPDFAttachment(item);

			let vector = new Float32Array(4).fill(0.5);
			let ensureStub = sinon.stub(Zotero.SDT, 'ensure').resolves(true);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				ensureStub,
				sinon.stub(Zotero.SDT, 'getSections').resolves({
					ok: true,
					sections: [sdtSection('', 0, ['A section with enough words to be worth indexing.'])]
				})
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(ensureStub.calledWith(attachment.id));

				// A second pass finds the stored embedding current, so the
				// attachment needs no pack
				ensureStub.resetHistory();
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isFalse(ensureStub.calledWith(attachment.id));
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should fall back to an attachment's plain text when structured extraction fails", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of fallback attachment' });
			let attachment = await importPDFAttachment(item);
			Object.defineProperty(attachment, 'attachmentText', {
				get: () => Promise.resolve('A plain paragraph of text about owl migration routes.'),
				configurable: true
			});

			let vector = new Float32Array(4).fill(0.5);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getSections').resolves({ ok: false, reason: 'failed' })
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();

				// The flat text is chunked like a note: embedded and
				// referenced by its extent in the flat text, with no blocks
				let rows = await Zotero.DB.queryAsync(
					"SELECT embedding, startBlock, endBlock, startOffset, endOffset, textCheck "
						+ "FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				);
				assert.lengthOf(rows, 1);
				// One byte per dimension
				assert.lengthOf(rows[0].embedding, 4);
				assert.isNull(rows[0].startBlock);
				assert.equal(rows[0].startOffset, 0);
				assert.equal(rows[0].endOffset,
					'A plain paragraph of text about owl migration routes.'.length);
				assert.equal(rows[0].textCheck, Zotero.Embeddings.textCheck(
					'A plain paragraph of text about owl migration routes.'));

				// And the preview round-trips from the flat text
				stubs.push(sinon.stub(Zotero.Embeddings, 'embedQuery')
					.resolves(new Float32Array(4).fill(0.5)));
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) "
						+ "VALUES ('modelVersion', 'test-model/1')"
				);
				let chunks = await Zotero.Embeddings.getMatchingChunks('owls', attachment.id);
				assert.lengthOf(chunks, 1);
				assert.equal(chunks[0].text,
					'A plain paragraph of text about owl migration routes.');
				assert.isNull(chunks[0].outlinePath);
				assert.isNull(chunks[0].position);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				delete attachment.attachmentText;
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
		});

		it("should record an attachment with no extractable text as processed", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of empty attachment' });
			let attachment = await importPDFAttachment(item);
			Object.defineProperty(attachment, 'attachmentText', {
				get: () => Promise.resolve(''),
				configurable: true
			});

			let vector = new Float32Array(4).fill(0.5);
			let getSectionsStub = sinon.stub(Zotero.SDT, 'getSections')
				.resolves({ ok: false, reason: 'failed' });
			let ourCalls = () => getSectionsStub.getCalls()
				.filter(call => call.args[0] === attachment.id).length;
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a8m'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(Float32Array.from(testMean)),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				getSectionsStub
			];
			try {
				Zotero.Prefs.set('embeddings.indexFulltext', true);
				await Zotero.Embeddings.Indexing.startIndexing();

				// The attempt is recorded as a complete ledger row of zero
				// chunks, so the item counts as processed with nothing stored
				let row = await Zotero.DB.rowQueryAsync(
					"SELECT chunks, embedded FROM embeddings.itemChunkCounts WHERE itemID=?",
					attachment.id
				);
				assert.equal(row.chunks, 0);
				assert.equal(row.embedded, 0);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				), 0);
				// Sections are read once, to count chunks at extraction
				assert.equal(ourCalls(), 1);

				// A processed-but-empty item can't be scored, and doesn't
				// break scoring for anything else
				let { scores } = await Zotero.Embeddings.scoreItemIDs('anything', [attachment.id]);
				assert.isFalse(scores.has(attachment.id));

				// The record makes later passes skip the attachment without
				// re-extracting, until the file changes
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.equal(ourCalls(), 1);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				delete attachment.attachmentText;
				Zotero.Prefs.clear('embeddings.indexFulltext');
			}
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
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
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
			Zotero.Prefs.set('embeddings.model', 'bekko-embedding-v1-a8m');
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
			Zotero.Prefs.set('embeddings.model', 'bekko-embedding-v1-a8m');
			await Zotero.Embeddings.preloadModel();

			assert.isTrue(await Zotero.Embeddings.isDownloaded());
			// Pruning with the model still selected has to keep it
			await Zotero.Embeddings.pruneModels();
			assert.isTrue(await Zotero.Embeddings.isDownloaded());
		});

		it("should chunk within the model's real window", async function () {
			this.timeout(1800000);
			await loadZoteroPane();
			Zotero.Prefs.set('embeddings.model', 'bekko-embedding-v1-a8m');
			await Zotero.Embeddings.download();

			// The model's real tokenizer, built from the same files the
			// inference process reads, with the transformers.js
			// implementation Firefox ships
			let { PreTrainedTokenizer } = ChromeUtils.importESModule(
				'chrome://global/content/ml/transformers.js'
			);
			let decoder = new TextDecoder();
			let [tokenizerJSON, tokenizerConfig] = await Promise.all(
				['tokenizer.json', 'tokenizer_config.json'].map(
					async file => JSON.parse(decoder.decode(
						await Zotero.Embeddings.getModelFile(file)
					))
				)
			);
			let tokenizer = new PreTrainedTokenizer(tokenizerJSON, tokenizerConfig);
			assert.isAbove(tokenizer.encode('a passage about owls').length, 3);

			// A long text splits into chunks that each fit the real window,
			// even though their sizes are estimated from characters
			let sentences = [];
			for (let i = 0; i < 100; i++) {
				sentences.push(`Sentence number ${i} concerns the ecology of temperate wetlands.`);
			}
			let chunks = Zotero.Embeddings.Chunking.chunkText(sentences.join(' '));
			assert.isAbove(chunks.length, 1);
			for (let chunk of chunks) {
				assert.isAtMost(tokenizer.encode(chunk.text).length, 512);
				// The carried count is an estimate of the model's own count
				let real = tokenizer.encode(chunk.text).length - tokenizer.encode('').length;
				assert.isAbove(chunk.tokens, real / 2);
				assert.isBelow(chunk.tokens, real * 2);
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
				let blob = storedBlob(vector);
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
				let { scores } = await Zotero.Embeddings.scoreItemIDs('anything',
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
