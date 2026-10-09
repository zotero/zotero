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

	// A structure as the pack reader materializes one, from sections
	// given as [outlinePath, blocks]: for a section with a path, a heading
	// block titled with the path's last component, then the section's blocks,
	// all laid out in order. A block is its text, or an object adding
	// flowClass/reference and a PDF position (pageIndex, rects) with the
	// page's label; a page spans the blocks positioned on it. A block given
	// no position is laid out on the first page, a line below the last, so
	// that every text node has the character geometry the chunker requires
	// of a PDF.
	function sdtStructure(sections) {
		let content = [];
		let outline = [];
		let pages = [];
		let pageBlocks = [];
		let line = 700;
		let outlineNode = (items, title) => items.find(item => item.title == title)
			|| items[items.push({ title, children: [] }) - 1];
		let nextPosition = () => {
			line -= 20;
			return { pageIndex: 0, rects: [[10, line, 300, line + 10]] };
		};
		let place = (entry, position) => {
			entry.anchor = {
				pageRects: position.rects.map(rect => [position.pageIndex, ...rect])
			};
			entry.content[0].anchor = {
				textMap: sdtTextMap(entry.content[0].text, position.pageIndex, position.rects[0])
			};
			let span = pageBlocks[position.pageIndex] ||= { first: content.length };
			span.last = content.length;
		};
		for (let [path, blocks] of sections) {
			if (path) {
				let items = outline;
				let node = null;
				for (let title of path.split(' > ')) {
					node = outlineNode(items, title);
					items = node.children;
				}
				node.ref = [content.length];
				let heading = { type: 'heading', content: [{ text: node.title }] };
				place(heading, nextPosition());
				content.push(heading);
			}
			for (let block of blocks) {
				let { text, position, pageLabel, pageIndex: _pageIndex, ...rest } = typeof block == 'string'
					? { text: block }
					: block;
				let entry = { type: 'paragraph', ...rest, content: [{ text }] };
				if (position && pageLabel) {
					pages[position.pageIndex] = { label: pageLabel };
				}
				place(entry, position || nextPosition());
				content.push(entry);
			}
		}
		let pageCount = Math.max(pages.length, pageBlocks.length);
		return {
			metadata: { processor: { type: 'pdf' }, source: { hash: 'sdt-test-hash' } },
			catalog: {
				outline,
				pages: Array.from({ length: pageCount }, (_, i) => ({
					...pages[i],
					...pageBlocks[i] && { contentRange: [[pageBlocks[i].first], [pageBlocks[i].last + 1]] }
				}))
			},
			content
		};
	}

	// A text node's character geometry as a PDF pack encodes it: one run
	// along the rect, each non-whitespace character an equal share of it
	function sdtTextMap(text, pageIndex, [x1, y1, x2, y2]) {
		let count = text.replace(/\s/g, '').length;
		let width = (x2 - x1) / Math.max(1, count);
		return JSON.stringify([[0, pageIndex, x1, y1, x2, y2, ...new Array(count).fill(width)]]);
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
		it("should decode the recorded calibration to a mean of the model's width", function () {
			let recorded = calibrationStub.wrappedMethod;
			let { mean, minScore, maxDisplayScore } = recorded.call(Zotero.Embeddings);
			// Built in the module's global, so not this scope's Float32Array
			assert.equal(mean.constructor.name, 'Float32Array');
			assert.include([256, 384, 512, 768, 1024], mean.length);
			assert.isBelow(minScore, maxDisplayScore);
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
					"SELECT value FROM embeddings.embeddingsMeta WHERE key='localUserKey'"
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
				"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding) "
					+ "VALUES (?, 0, ?)",
				[item.id, storedBlob(passage)], { debugParams: false }
			);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(query)
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.embeddingsMeta (key, value) "
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
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding) "
						+ "VALUES (?, 0, ?)",
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
				"REPLACE INTO embeddings.embeddingsMeta (key, value) "
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
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding) "
						+ "VALUES (?, ?, ?)",
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
				"REPLACE INTO embeddings.embeddingsMeta (key, value) "
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
			let store = async (item, chunkIndex, vector, { positioned = false } = {}) => {
				let blob = storedBlob(vector);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings "
						+ "(itemID, chunkIndex, embedding, anchor) VALUES (?, ?, ?, ?)",
					[item.id, chunkIndex, blob, positioned ? Zotero.Embeddings.Indexing.compactAnchor({ pageRects: [[0, 0, 0, 1, 1]] }) : null],
					{ debugParams: false }
				);
			};
			// One item matches through a chunk with source references (plus a
			// below-floor chunk with references, which must not count), one
			// matches only through a chunk without them, one matches through a
			// chunk without them while its only chunk with references scores
			// below the floor, and a distractor matches nothing
			let chunked = await createDataObject('item');
			await store(chunked, 0, axis(2), { positioned: true });
			await store(chunked, 1, axis(0), { positioned: true });
			let plain = await createDataObject('item');
			await store(plain, 0, axis(0));
			let buried = await createDataObject('item');
			await store(buried, 0, axis(0));
			await store(buried, 1, axis(2), { positioned: true });
			let distant = await createDataObject('item');
			await store(distant, 0, axis(3));

			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(axis(0))
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.embeddingsMeta (key, value) "
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
	// A stored chunk row, made from the test document (see sdtStructure()),
	// as the item's state row records
	var store = async (item, chunkIndex, vector, props = {}) => {
		let blob = storedBlob(vector);
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, anchor) "
				+ "VALUES (?, ?, ?, ?)",
			[item.id, chunkIndex, blob, props.anchor ? Zotero.Embeddings.Indexing.compactAnchor(props.anchor) : null],
			{ debugParams: false }
		);
		await Zotero.DB.queryAsync(
			"INSERT OR IGNORE INTO embeddings.itemIndexState (itemID, contentHash) "
				+ "VALUES (?, 'sdt-test-hash')",
			[item.id]
		);
	};
	// A document to re-derive chunk text from: what each stored anchor
	// reads back as (Zotero.SDT.readAnchors()), with the reader position
	// its text is shown at
	var positionWorld = {
		intro: {
			anchor: { pageRects: [[0, 10, 20, 300, 40]] },
			position: { pageIndex: 0, rects: [[10, 20, 300, 40]] },
			text: 'The introduction\ntext',
			outlinePath: 'Introduction',
			pageLabel: null
		},
		sampling: {
			anchor: { pageRects: [[6, 10, 20, 300, 40]] },
			position: { pageIndex: 6, rects: [[10, 20, 300, 40]] },
			text: 'The sampling\ntext',
			outlinePath: 'Methods > Sampling',
			pageLabel: '7'
		},
		references: {
			anchor: { pageRects: [[9, 10, 20, 300, 40]] },
			position: { pageIndex: 9, rects: [[10, 20, 300, 40]] },
			text: 'The references text',
			outlinePath: 'References',
			pageLabel: '10'
		}
	};
	// The bundled SDT chunker, to cut a structure as the document worker does
	var sdtChunker = (() => {
		let scope = {};
		Services.scriptloader.loadSubScript('resource://zotero/require.js', scope);
		return scope.require('resource://zotero/document-worker/structured-document-text-chunker.js');
	})();
	// The document as this client extracts and cuts it, from a structure: what
	// the document worker would hand back for the item
	var stubItemChunks = structure => sinon.stub(Zotero.SDT, 'getItemChunks').resolves({
		ok: true,
		chunks: sdtChunker.getChunks(structure),
		contentHash: structure.metadata.source.hash
	});
	// Enough to count its chunks
	var stubStructure = () => stubItemChunks(
		sdtStructure([['Introduction', ['A section with enough words to be worth indexing.']]]));
	// The file's hash, as the stubbed extraction reports it
	var stubFileHash = () => sinon.stub(Zotero.Item.prototype, 'attachmentHash')
		.get(() => Promise.resolve('sdt-test-hash'));
	// Stored anchors read back as positionWorld says, and as nothing when
	// the document has no such place
	var stubReadAnchors = () => sinon.stub(Zotero.SDT, 'readAnchors').callsFake(
		async (itemID, anchors) => ({
			ok: true,
			chunks: anchors.map((anchor) => {
				let found = Object.values(positionWorld).find(
					entry => JSON.stringify(entry.anchor) == JSON.stringify(anchor));
				return found
					? { text: found.text, outlinePath: found.outlinePath, pageLabel: found.pageLabel,
						position: found.position }
					: null;
			})
		})
	);
	// What an item's stored rows read back as from their anchors, in chunk
	// order
	var readStoredChunks = async (itemID) => {
		let rows = await Zotero.DB.queryAsync(
			"SELECT anchor FROM embeddings.itemEmbeddings WHERE itemID=? ORDER BY chunkIndex", itemID);
		if (!rows.length) {
			return [];
		}
		let anchors = rows.map(row => (row.anchor ? Zotero.Embeddings.Indexing.expandAnchor(row.anchor) : null));
		let result = await Zotero.SDT.readAnchors(itemID, anchors);
		return result.ok ? result.chunks : [];
	};
	// Run the indexer over rows that arrived with their vectors and
	// anchors, as synced rows would: the pipeline keeps them and counts
	// them as indexed
	var indexArrivedRows = async () => {
		let stubs = [
			sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
			sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
			sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
			sinon.stub(Zotero.Embeddings, 'download').resolves(),
			sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
			sinon.stub(Zotero.Embeddings, 'embedPassages')
				.callsFake(async texts => texts.map(() => axis(0))),
			sinon.stub(Zotero.SDT, 'ensure').resolves(true)
		];
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.embeddingsMeta (key, value) "
				+ "VALUES ('modelVersion', 'test-model/1')"
		);
		try {
			await Zotero.Embeddings.Indexing.startIndexing();
		}
		finally {
			stubs.forEach(stub => stub.restore());
		}
	};

	describe("Indexing of arrived rows", function () {
		it("should keep rows that arrived before their file was read", async function () {
			this.timeout(60000);
			let item = await importFileAttachment('test.pdf');
			await store(item, 1, axis(0), { anchor: positionWorld.sampling.anchor });
			await store(item, 0, axis(1), { anchor: positionWorld.intro.anchor });
			let stubs = [
				stubStructure(),
				stubReadAnchors()
			];
			try {
				await indexArrivedRows();
				// The document was read once, to confirm the rows were made
				// from it, and the rows kept as its complete index. Counted
				// for this item alone: indexing runs over every attachment
				// the library holds.
				assert.lengthOf(
					Zotero.SDT.getItemChunks.args.filter(([itemID]) => itemID === item.id), 1);
				assert.equal(
					await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", item.id),
					2
				);
				// Their anchors are the ones that arrived
				let chunks = await readStoredChunks(item.id);
				assert.equal(chunks[0].text, positionWorld.intro.text);
				assert.equal(chunks[1].text, positionWorld.sampling.text);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("Indexing#addChunks()", function () {
		it("should take in an attachment's chunks from another client", async function () {
			this.timeout(60000);
			let item = await importFileAttachment('test.pdf');
			await Zotero.Embeddings.initDB();
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.embeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			let prepared = vector => Zotero.Embeddings.quantize(
				Zotero.Embeddings.center(vector, testMean));
			let arrival = rows => ({
				modelVersion: 'test-model/1',
				contentHash: 'sdt-test-hash',
				chunks: 2,
				rows
			});
			let sdtStubs = [stubStructure(), stubReadAnchors(), stubFileHash()];
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'getDimensions').returns(testMean.length)
			];
			try {
				assert.isTrue(await Zotero.Embeddings.Indexing.addChunks(item.id, arrival([
					{ chunkIndex: 0, embedding: prepared(axis(1)),
						anchor: positionWorld.intro.anchor },
					{ chunkIndex: 1, embedding: prepared(axis(0)),
						anchor: positionWorld.sampling.anchor }
				])));
				// Every row the sender declared is stored, so the rows read as
				// a complete index rather than as work half done
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", item.id), 2);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(embedding) FROM embeddings.itemEmbeddings WHERE itemID=?", item.id), 2);

				// A delivery short of the count it declares is refused rather
				// than left looking like a whole index
				assert.isFalse(await Zotero.Embeddings.Indexing.addChunks(item.id, arrival([
					{ chunkIndex: 0, embedding: prepared(axis(1)), anchor: null }
				])));
				// As are vectors from a model these can't be compared with
				assert.isFalse(await Zotero.Embeddings.Indexing.addChunks(item.id, {
					...arrival([]), modelVersion: 'other-model/1', chunks: 0
				}));
				// And rows made from anything but the file as it is here
				assert.isFalse(await Zotero.Embeddings.Indexing.addChunks(item.id, {
					...arrival([{ chunkIndex: 0, embedding: prepared(axis(1)), anchor: null }]),
					contentHash: 'other-hash', chunks: 1
				}));
				// And rows that couldn't be stored or scored: a vector of
				// another width, an index given twice, an anchor that isn't one
				let width = Zotero.Embeddings.getDimensions();
				assert.isFalse(await Zotero.Embeddings.Indexing.addChunks(item.id, arrival([
					{ chunkIndex: 0, embedding: new Int8Array(width + 1), anchor: null },
					{ chunkIndex: 1, embedding: prepared(axis(0)), anchor: null }
				])));
				assert.isFalse(await Zotero.Embeddings.Indexing.addChunks(item.id, arrival([
					{ chunkIndex: 0, embedding: prepared(axis(1)), anchor: null },
					{ chunkIndex: 0, embedding: prepared(axis(0)), anchor: null }
				])));
				assert.isFalse(await Zotero.Embeddings.Indexing.addChunks(item.id, arrival([
					{ chunkIndex: 0, embedding: prepared(axis(1)), anchor: 'page 1' },
					{ chunkIndex: 1, embedding: prepared(axis(0)), anchor: null }
				])));
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", item.id), 2);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}

			try {
				await indexArrivedRows();
				// The rows were complete and counted on arrival, so the
				// attachment is never cut here: the document isn't read
				assert.isFalse(Zotero.SDT.getItemChunks.args.some(([itemID]) => itemID === item.id));
				// The text reads back from the anchors
				let chunks = await readStoredChunks(item.id);
				assert.equal(chunks[0].text, positionWorld.intro.text);
				assert.equal(chunks[1].text, positionWorld.sampling.text);
			}
			finally {
				sdtStubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("Indexing#compactAnchor()", function () {
		let compact = anchor => Zotero.Embeddings.Indexing.compactAnchor(anchor);
		let expand = bytes => Zotero.Embeddings.Indexing.expandAnchor(bytes);

		it("should store an anchor as deflated JSON and read it back exactly", function () {
			let anchor = { pageRects: [] };
			for (let i = 0; i < 40; i++) {
				let x = 10 + i * 7.37;
				let y = 700 - i * 13.91;
				anchor.pageRects.push([i % 3, x, y, x + 283.123, y + 11.07]);
			}
			let bytes = compact(anchor);
			// Not instanceOf: the module's Uint8Array is another compartment's
			assert.equal(bytes.constructor.name, 'Uint8Array');
			assert.isBelow(bytes.length, JSON.stringify(anchor).length / 2);
			// The same JSON back, key order included
			assert.equal(JSON.stringify(expand(bytes)), JSON.stringify(anchor));
			// As the database returns a blob
			assert.deepEqual(expand([...bytes]), anchor);
			for (let other of [null, { selectors: [{ type: 'CssSelector', value: 'pre:last-child' }] },
				{ pageRects: [[0, 0, 0, 1, 1]], nextPageIndex: 7 }]) {
				assert.deepEqual(expand(compact(other)), other);
			}
		});

		it("should reject what it cannot read", function () {
			assert.throws(() => compact(undefined), /object or null/);
			assert.throws(() => compact([]), /object or null/);
			assert.throws(() => expand(new Uint8Array([])), /nonempty/);
			assert.throws(() => expand(new Uint8Array([9, 1, 1])));
		});
	});

	describe("#getMatchingChunks()", function () {
		it("should return an item's matching chunks with their locations, best first", async function () {
			this.timeout(60000);
			let item = await importFileAttachment('test.pdf');
			// A weak match, a strong match, and a chunk below the floor
			let mixed = axis(0, 0.4);
			mixed[1] += 1;
			await store(item, 0, mixed, { anchor: positionWorld.intro.anchor });
			await store(item, 1, axis(0), { anchor: positionWorld.sampling.anchor });
			await store(item, 2, axis(2), { anchor: positionWorld.references.anchor });

			let query = axis(0, 0.9);
			query[1] += 0.1;
			let stubs = [
				stubStructure(),
				stubReadAnchors()
			];
			try {
				await indexArrivedRows();
				stubs.push(
					sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
					sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
					sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(query)
				);
				let chunks = await Zotero.Embeddings.getMatchingChunks('anything', item.id);
				// The chunk below the model's floor isn't a match
				assert.lengthOf(chunks, 2);
				// Best chunk first, its text re-derived from its stored
				// anchor in the document
				assert.equal(chunks[0].chunkIndex, 1);
				assert.equal(chunks[0].text, 'The sampling\ntext');
				assert.equal(chunks[0].outlinePath, 'Methods > Sampling');
				assert.equal(chunks[0].pageLabel, '7');
				assert.deepEqual(chunks[0].position, positionWorld.sampling.position);
				assert.equal(chunks[1].chunkIndex, 0);
				assert.equal(chunks[1].text, 'The introduction\ntext');
				assert.isNull(chunks[1].pageLabel);
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

		it("should leave out chunks in a reference list", async function () {
			this.timeout(60000);
			let item = await importFileAttachment('test.pdf');
			// The reference list matches best, the sampling section after it
			await store(item, 0, axis(0), { anchor: positionWorld.references.anchor });
			await store(item, 1, axis(0, 0.8), { anchor: positionWorld.sampling.anchor });
			let referencesPath = positionWorld.references.outlinePath;
			let stubs = [
				stubStructure(),
				stubReadAnchors()
			];
			try {
				await indexArrivedRows();
				stubs.push(
					sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
					sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
					sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(axis(0))
				);
				// Skipped, and not counted toward the limit
				let chunks = await Zotero.Embeddings.getMatchingChunks('anything', item.id, { limit: 1 });
				assert.deepEqual(chunks.map(chunk => chunk.chunkIndex), [1]);
				// As is one under another heading, titled another way
				positionWorld.references.outlinePath = 'Back matter > Literature Cited:';
				chunks = await Zotero.Embeddings.getMatchingChunks('anything', item.id);
				assert.deepEqual(chunks.map(chunk => chunk.chunkIndex), [1]);
				// A heading that only mentions references isn't one
				positionWorld.references.outlinePath = 'Sources of law';
				chunks = await Zotero.Embeddings.getMatchingChunks('anything', item.id);
				assert.deepEqual(chunks.map(chunk => chunk.chunkIndex), [0, 1]);
			}
			finally {
				positionWorld.references.outlinePath = referencesPath;
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should omit text and location when the anchor no longer resolves", async function () {
			this.timeout(60000);
			let item = await importFileAttachment('test.pdf');
			// An anchor on nothing the current extraction has
			await store(item, 0, axis(0), { anchor: { pageRects: [[3, 0, 0, 1, 1]] } });
			let stubs = [
				stubStructure(),
				stubReadAnchors()
			];
			try {
				await indexArrivedRows();

				// The chunk still matches -- its vector is intact -- but the
				// preview can't be shown, since the place it was embedded
				// from is gone, and nothing is read back for it
				stubs.push(
					sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
					sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
					sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(axis(0, 0.9))
				);
				let chunks = await Zotero.Embeddings.getMatchingChunks('anything', item.id);
				assert.lengthOf(chunks, 1);
				assert.equal(chunks[0].chunkIndex, 0);
				assert.isNull(chunks[0].text);
				assert.isNull(chunks[0].outlinePath);
				assert.isNull(chunks[0].pageLabel);
				assert.isNull(chunks[0].position);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
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
			try {
				assert.ok(await getPromiseError(Zotero.Embeddings.embedQuery('retry query')));
				// The eviction runs from a rejection handler
				await Zotero.Promise.delay(0);
				await Zotero.Embeddings.embedQuery('retry query');
				assert.equal(embedStub.callCount, 2);
			}
			finally {
				embedStub.restore();
			}
		});

		it("should strip a single pair of wrapping quotes", async function () {
			let embedStub = sinon.stub(Zotero.Embeddings, 'embed').resolves(new Float32Array([1]));
			try {
				// Whitespace around the quotes doesn't defeat the stripping
				await Zotero.Embeddings.embedQuery(' "wrapped query" ');
				assert.include(embedStub.firstCall.args[0], 'wrapped query');
				assert.notInclude(embedStub.firstCall.args[0], '"');
				// A query that normalizes to nothing is a caller bug
				assert.throws(() => Zotero.Embeddings.embedQuery('""'));
			}
			finally {
				embedStub.restore();
			}
		});

		it("should share one in-flight embed across concurrent calls", async function () {
			let deferred = Zotero.Promise.defer();
			let embedStub = sinon.stub(Zotero.Embeddings, 'embed')
				.callsFake(() => deferred.promise);
			try {
				let promise1 = Zotero.Embeddings.embedQuery('concurrent query');
				let promise2 = Zotero.Embeddings.embedQuery('concurrent query');
				deferred.resolve(new Float32Array([1]));
				assert.equal(await promise1, await promise2);
				assert.equal(embedStub.callCount, 1);
			}
			finally {
				embedStub.restore();
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
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
				await Zotero.Embeddings.shutdownEngine();
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
				await Zotero.Embeddings.shutdownEngine();
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
				await Zotero.Embeddings.shutdownEngine();
				stubs.forEach(stub => stub.restore());
			}
		});
		it("should collapse whitespace and give a model's tokenizer the leading space the runtime omits", async function () {
			let seen = [];
			let engine = fakeEngine(async (engine, { args: [texts] }) => {
				seen.push(...texts);
				return texts.map(() => Array.from({ length: 384 }, (_, i) => Math.sin(i + 1)));
			});
			let stubs = [
				sinon.stub(Zotero.ML, 'createEngine').resolves(engine),
				sinon.stub(Zotero.ML, 'shutdown').resolves(),
				sinon.stub(Zotero.ML, 'getOptimalConcurrency').returns(2),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-spacing/1')
			];
			try {
				await Zotero.Embeddings.embedMany(['some text', 'more', 'line one\nline  two\n']);
				assert.deepEqual(seen, [' some text', ' more', ' line one line two']);
			}
			finally {
				await Zotero.Embeddings.shutdownEngine();
				stubs.forEach(stub => stub.restore());
			}
		});
		it("should keep only the first dims of a model that truncates", async function () {
			// 384 raw dimensions from the engine; the model stores 256 of them
			let raw = Array.from({ length: 384 }, (_, i) => Math.sin(i + 1));
			let engine = fakeEngine(async (engine, { args: [texts] }) => texts.map(() => raw));
			let stubs = [
				sinon.stub(Zotero.ML, 'createEngine').resolves(engine),
				sinon.stub(Zotero.ML, 'shutdown').resolves(),
				sinon.stub(Zotero.ML, 'getOptimalConcurrency').returns(2),
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
				await Zotero.Embeddings.shutdownEngine();
				stubs.forEach(stub => stub.restore());
			}
		});
	});

	describe("Static", function () {
		// The runtime's model cache, holding the given models by stored name
		function stubModelCache(models) {
			let { ModelHub } = ChromeUtils.importESModule("chrome://global/content/ml/ModelHub.sys.mjs");
			return sinon.stub(ModelHub.prototype, 'listModels').resolves(models);
		}

		it("should find the static model in the cache only once it's there", async function () {
			// Checked first: once found, the model is taken to stay
			let stub = stubModelCache([
				{ name: 'huggingface.co/some/other-model', taskName: 'feature-extraction', revision: 'main' }
			]);
			try {
				assert.isFalse(await Zotero.Embeddings.Static.isDownloaded());
			}
			finally {
				stub.restore();
			}

			stub = stubModelCache([
				{ name: 'model-hub.mozilla.org/mozilla/static-embeddings', taskName: 'static-embeddings', revision: 'v1.0.0' }
			]);
			try {
				assert.isTrue(await Zotero.Embeddings.Static.isDownloaded());
				// Named without the host it came from, like a Hugging Face model
				let [model] = await Zotero.ML.listModels({ taskName: 'static-embeddings' });
				assert.equal(model.modelId, 'mozilla/static-embeddings');
			}
			finally {
				stub.restore();
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
		let corpus = () => Zotero.Embeddings.Calibration.getCorpus();

		it("should give every query a passage and a near miss of chunk length", function () {
			for (let triple of corpus()) {
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
			for (let triple of corpus()) {
				let passage = grams(triple.passage);
				let nearMiss = grams(triple.nearMiss);
				let shared = [...nearMiss].filter(gram => passage.has(gram)).length;
				assert.isBelow(shared / Math.min(passage.size, nearMiss.size), 0.08, triple.query);
			}
		});

		it("should measure the model against every language the corpus holds", function () {
			// The shipping model is multilingual, so it's measured on all of
			// the corpus rather than one language's share of it
			let all = corpus();
			let han = /[一-鿿]/;
			let texts = triple => [triple.query, triple.passage, triple.nearMiss];
			assert.isAbove(all.length, 0);
			assert.isTrue(all.some(triple => texts(triple).some(text => han.test(text))));
			assert.isTrue(all.some(triple => texts(triple).every(text => !han.test(text))));
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
		// what `failWith(texts)` returns. Speaks llama.cpp's OpenAI-style
		// format, or TEI's with `format: 'tei'`, rejecting the other's body
		// the way the real server does
		let serve = ({ remoteFor = vectorFor, model = 'served', failWith = () => null, shape = null, format = 'openai' } = {}) => {
			let calls = [];
			return {
				calls,
				stub: sinon.stub(Zotero.HTTP, 'request').callsFake(async (method, url, options) => {
					let body = JSON.parse(options.body);
					let input = format == 'tei' ? body.inputs : body.input;
					if (!input) {
						throw status(422);
					}
					calls.push({ url, input, headers: options.headers });
					let error = failWith(input);
					if (error) {
						throw error;
					}
					if (shape) {
						return { status: 200, response: shape };
					}
					if (format == 'tei') {
						return { status: 200, response: input.map(text => Array.from(remoteFor(text))) };
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
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-endpoint/1'),
				sinon.stub(Zotero.Embeddings, 'embedMany').callsFake(async texts => texts.map(text => vectorFor(text)))
			];
			await Zotero.Embeddings.initDB();
			await Zotero.DB.queryAsync("DELETE FROM embeddings.embeddingsMeta WHERE key='endpoint'");
			Zotero.Embeddings.Endpoint.reset();
		});
		afterEach(async function () {
			stubs.forEach(stub => stub.restore());
			Zotero.HTTP.request.restore?.();
			Zotero.Prefs.clear('embeddings.endpoint');
			await Zotero.DB.queryAsync("DELETE FROM embeddings.embeddingsMeta WHERE key='endpoint'");
		});

		it("should report a configured endpoint as off while semantic search is disabled", async function () {
			Zotero.Prefs.set('embeddings.endpoint', URL);
			Zotero.Embeddings.isEnabled.returns(false);
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'off');
			assert.doesNotThrow(() => Zotero.Embeddings.Indexing.getStatus());
		});

		it("should describe how to serve the model", function () {
			let { command, url } = Zotero.Embeddings.Endpoint.getCommand();
			assert.include(command, 'hotchpotch/bekko-embedding-v1-a25m-GGUF:F16');
			assert.include(command, '--pooling mean');
			assert.include(url, 'localhost');
		});

		it("should accept a server whose vectors match the model's", async function () {
			let server = serve();
			let verdict = await Zotero.Embeddings.Endpoint.verify(URL);
			assert.equal(verdict.state, 'ok');
			assert.equal(verdict.format, 'openai');
			assert.equal(verdict.serverModel, 'served');
			assert.closeTo(verdict.agreement, 1, 1e-5);
			// The regular texts in one request, the chunk-length one alone
			assert.lengthOf(server.calls, 2);
			assert.isAbove(server.calls[0].input.length, 10);
			assert.isAbove(server.calls[1].input[0].length, 8000);
		});

		it("should accept a server speaking TEI's format and keep speaking it", async function () {
			let server = serve({ format: 'tei' });
			let verdict = await Zotero.Embeddings.Endpoint.verify(URL);
			assert.equal(verdict.state, 'ok');
			assert.equal(verdict.format, 'tei');
			assert.isNull(verdict.serverModel);
			assert.closeTo(verdict.agreement, 1, 1e-5);
			// The OpenAI-style probe was refused, then the regular texts and
			// the chunk-length one went through in TEI's format
			assert.lengthOf(server.calls, 2);

			Zotero.Prefs.set('embeddings.endpoint', URL);
			server.calls.length = 0;
			await Zotero.Embeddings.embedPassages(['a passage']);
			assert.lengthOf(server.calls, 1);
			assert.include(server.calls[0].input, 'a passage');
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

		it("should embed a failed batch locally in parts and keep the endpoint", async function () {
			let server = serve();
			Zotero.Prefs.set('embeddings.endpoint', URL);
			await Zotero.Embeddings.Endpoint.verify(URL);
			Zotero.HTTP.request.restore();
			server = serve({ failWith: () => status(500) });
			let texts = Array.from({ length: 10 }, (_, i) => `passage ${i}`);
			// The sentinel's local vector is computed once, on first use
			await Zotero.Embeddings.Endpoint.getSentinel();
			Zotero.Embeddings.embedMany.resetHistory();
			let vectors = await Zotero.Embeddings.embedPassages(texts);
			assert.lengthOf(vectors, 10);
			assert.closeTo(Zotero.Embeddings.cosine(vectors[7], vectorFor('passage 7')), 1, 1e-5);
			assert.lengthOf(server.calls, 1);
			// A batch cut for the server is too big for the local engine in
			// one go: quarters, in order
			assert.equal(Zotero.Embeddings.embedMany.callCount, 4);
			assert.deepEqual(Zotero.Embeddings.embedMany.firstCall.args[0], texts.slice(0, 3));
			assert.deepEqual(Zotero.Embeddings.embedMany.lastCall.args[0], texts.slice(9));
			assert.equal(Zotero.Embeddings.Endpoint.getStatus().state, 'ok');
		});

		it("should count a verified server on another machine as remote", async function () {
			let remote = 'https://example.com/prod/invoke';
			serve();
			// Verified, but on this machine
			Zotero.Prefs.set('embeddings.endpoint', URL);
			await Zotero.Embeddings.Endpoint.verify(URL);
			assert.isFalse(Zotero.Embeddings.Endpoint.isRemoteActive());
			// Configured elsewhere but not yet verified there
			Zotero.Prefs.set('embeddings.endpoint', remote);
			assert.isFalse(Zotero.Embeddings.Endpoint.isRemoteActive());
			await Zotero.Embeddings.Endpoint.verify(remote);
			assert.isTrue(Zotero.Embeddings.Endpoint.isRemoteActive());
			// Skipped after repeated failures
			for (let i = 0; i < 3; i++) {
				Zotero.Embeddings.Endpoint.recordFailure(new Error('down'));
			}
			assert.isFalse(Zotero.Embeddings.Endpoint.isRemoteActive());
		});
	});

	describe("Sync", function () {
		it("should ask the server for stored files in a syncing Zotero Storage library", async function () {
			let Sync = Zotero.Embeddings.Sync;
			let Storage = Zotero.Sync.Storage.Local;
			let stored = await importFileAttachment('test.pdf');
			let linked = await Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.pdf')
			});
			let syncState = sinon.stub(Zotero.Item.prototype, 'attachmentSyncState')
				.get(() => Storage.SYNC_STATE_IN_SYNC);
			let stubs = [
				syncState,
				sinon.stub(Sync, 'isAvailable').returns(true),
				sinon.stub(Storage, 'getEnabledForLibrary').returns(true),
				sinon.stub(Storage, 'getModeForLibrary').returns('zfs'),
				sinon.stub(Zotero.Sync.Data.Local, 'filterSkippedLibraries')
					.callsFake(libraries => libraries)
			];
			try {
				assert.isTrue(Sync.shouldAskServer(stored));
				// A linked file never goes up
				assert.isFalse(Sync.shouldAskServer(linked));
				// A file the server has but this client hasn't brought down
				// is the server's; one still to go up is this client's
				syncState.get(() => Storage.SYNC_STATE_TO_DOWNLOAD);
				assert.isTrue(Sync.shouldAskServer(stored));
				syncState.get(() => Storage.SYNC_STATE_TO_UPLOAD);
				assert.isFalse(Sync.shouldAskServer(stored));
				syncState.get(() => Storage.SYNC_STATE_IN_SYNC);
				// Files kept anywhere but Zotero Storage never reach the server
				Storage.getModeForLibrary.returns('webdav');
				assert.isFalse(Sync.shouldAskServer(stored));
				Storage.getModeForLibrary.returns('zfs');
				Storage.getEnabledForLibrary.returns(false);
				assert.isFalse(Sync.shouldAskServer(stored));
				Storage.getEnabledForLibrary.returns(true);
				// Nor do those of a library left out of syncing
				Zotero.Sync.Data.Local.filterSkippedLibraries.callsFake(() => []);
				assert.isFalse(Sync.shouldAskServer(stored));
				Zotero.Sync.Data.Local.filterSkippedLibraries.callsFake(libraries => libraries);
				// One the server declined is this client's
				assert.isFalse(Sync.shouldAskServer(stored, { syncDeclined: Date.now() }));
				// An active endpoint takes the server's place
				let endpoint = sinon.stub(Zotero.Embeddings.Endpoint, 'isActive').returns(true);
				try {
					assert.isFalse(Sync.shouldAskServer(stored));
				}
				finally {
					endpoint.restore();
				}
				// And nothing is asked when sync can't run
				Sync.isAvailable.returns(false);
				assert.isFalse(Sync.shouldAskServer(stored));
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
			// The override wins over a syncing account
			Zotero.Prefs.set('embeddings.sync.enabled', false);
			try {
				assert.isFalse(Sync.isAvailable());
			}
			finally {
				Zotero.Prefs.clear('embeddings.sync.enabled');
			}
		});

		describe("fetching", function () {
			var client;
			var prepared = vector => Zotero.Embeddings.quantize(
				Zotero.Embeddings.center(vector, testMean));
			// A vector as the server sends it: the model's raw output in the
			// given dtype, base64-encoded
			var encode = (vector, dtype = 'float16') => {
				let VectorArray = dtype == 'float32' ? Float32Array : Float16Array;
				return btoa(String.fromCharCode(...new Uint8Array(VectorArray.from(vector).buffer)));
			};
			// What the server sends for an attachment: rows with their
			// vectors encoded, made from the file as this client has it
			// unless said otherwise, at a version
			var arrival = (attachment, vectors, contentHash = 'sdt-test-hash', version = 1) => ({
				key: attachment.key,
				status: 'success',
				contentHash,
				chunks: vectors.length,
				version,
				rows: vectors.map((vector, chunkIndex) => ({
					chunkIndex,
					embedding: encode(vector),
					anchor: positionWorld.intro.anchor
				}))
			});
			// ...or that it has nothing for the attachment
			var declined = attachment => ({ key: attachment.key, status: 'declined' });
			// What the server answers an ask for rows with: the model it
			// answers in, the encoding of its vectors, and rows for the keys
			// asked for
			var serve = (arrivals = {}, model = 'test-model/1', dtype = 'float16') => {
				client.getEmbeddings.callsFake(async (type, id, asked, keys = []) => ({
					model,
					dtype,
					items: keys.filter(key => arrivals[key]).map(key => arrivals[key])
				}));
			};
			// An attachment's stored vectors, in chunk order
			var storedVectors = async (itemID) => {
				let rows = await Zotero.DB.queryAsync(
					"SELECT embedding FROM embeddings.itemEmbeddings WHERE itemID=? ORDER BY chunkIndex",
					itemID);
				return rows.map(row => Array.from(new Int8Array(new Uint8Array(row.embedding).buffer)));
			};
			// ...and what changed since the client last looked: the
			// library's version and the keys at theirs, or nothing
			var changed = (version, items = {}) => {
				client.getEmbeddingVersions.resolves(version ? { version, items, models: null } : false);
			};
			// Whether a request since the given one asked for the key
			var askedFor = (key, from = 0) => client.getEmbeddings.args.slice(from)
				.some(([,,, keys]) => keys?.includes(key));
			// The server's version an attachment's rows are recorded as from
			var versionOf = itemID => Zotero.DB.valueQueryAsync(
				"SELECT syncVersion FROM embeddings.itemIndexState WHERE itemID=?", itemID);
			// Rows with a vector: a cut attachment has a row per chunk before
			// any is embedded
			var rowCount = itemID => Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=? AND embedding IS NOT NULL", itemID);
			// Result rows are proxies, so copy what's compared
			// What's stored for an attachment, null when nothing is: a state
			// row that only says when it was looked at doesn't count
			var stored = async (itemID) => {
				let cut = await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemIndexState WHERE itemID=? "
						+ "AND (sourceKey IS NOT NULL OR contentHash IS NOT NULL)", itemID);
				if (!cut) {
					return null;
				}
				let row = await Zotero.DB.rowQueryAsync(
					"SELECT COUNT(*) AS chunks, COUNT(embedding) AS embedded "
						+ "FROM embeddings.itemEmbeddings WHERE itemID=?", itemID);
				return { chunks: row.chunks, embedded: row.embedded };
			};
			// The attachment's standing with the server, null when it has none
			var syncState = async (itemID) => {
				let row = await Zotero.DB.rowQueryAsync(
					"SELECT syncDeclined, syncShouldRefresh "
						+ "FROM embeddings.itemIndexState WHERE itemID=?",
					itemID);
				if (!row || (row.syncDeclined === null && !row.syncShouldRefresh)) {
					return null;
				}
				return {
					declined: row.syncDeclined,
					shouldRefresh: !!row.syncShouldRefresh
				};
			};
			var whileIndexing = async () => {
				while (Zotero.Embeddings.Indexing.getStatus().indexing) {
					await Zotero.Promise.delay(50);
				}
			};
			var library;
			var stubs;

			beforeEach(async function () {
				library = Zotero.Libraries.userLibrary;
				client = {
					getEmbeddings: sinon.stub().resolves({ model: null, items: [] }),
					getEmbeddingVersions: sinon.stub().resolves(false)
				};
				let Storage = Zotero.Sync.Storage.Local;
				stubs = [
					sinon.stub(Zotero.Sync.Runner, 'getAPIClient').returns(client),
					sinon.stub(Zotero.Sync.Data.Local, 'getAPIKey').resolves('key'),
					sinon.stub(Zotero.Embeddings.Sync, 'isAvailable').returns(true),
					sinon.stub(Storage, 'getEnabledForLibrary').returns(true),
					sinon.stub(Storage, 'getModeForLibrary').returns('zfs'),
					sinon.stub(Zotero.Sync.Data.Local, 'filterSkippedLibraries')
						.callsFake(libraries => libraries),
					sinon.stub(Zotero.Embeddings, 'embedPassages')
						.callsFake(async texts => texts.map(() => axis(0))),
					sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
					sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
					sinon.stub(Zotero.Embeddings, 'getDimensions').returns(testMean.length),
					sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
					sinon.stub(Zotero.Embeddings, 'download').resolves(),
					sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
					sinon.stub(Zotero.SDT, 'ensure').resolves(true),
					// Every file has gone up, unless a test says otherwise
					sinon.stub(Zotero.Item.prototype, 'attachmentSyncState')
						.get(() => Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC),
					stubFileHash(),
					stubStructure(),
					stubReadAnchors()
				];
			});

			afterEach(async function () {
				// Leave no run coming back for what the server put off
				Zotero.Embeddings.Indexing.stopIndexing();
				await whileIndexing();
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexingPaused');
				await Zotero.DB.queryAsync(
					"DELETE FROM embeddings.embeddingsMeta WHERE key LIKE ?", ['embeddingsVersion:%']);
			});

			it("should take the server's rows in place of embedding the attachment here", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of fetched attachment' });
				let attachment = await importPDFAttachment(item);
				serve({ [attachment.key]: arrival(attachment, [axis(1), axis(0)]) });
				await Zotero.Embeddings.Indexing.startIndexing();
				// Counted here, then asked for; the rows that came are the
				// attachment's index
				assert.isTrue(Zotero.SDT.ensure.calledWith(attachment.id));
				assert.isTrue(askedFor(attachment.key));
				assert.deepEqual(await stored(attachment.id), { chunks: 2, embedded: 2 });
				assert.equal(await rowCount(attachment.id), 2);
				assert.isNull(await syncState(attachment.id));
				assert.equal(await versionOf(attachment.id), 1);
				let chunks = await readStoredChunks(attachment.id);
				assert.equal(chunks[0].text, positionWorld.intro.text);

				// Complete, so the next run has nothing to ask about it
				let from = client.getEmbeddings.callCount;
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isFalse(askedFor(attachment.key, from));
			});

			it("should embed here an attachment whose rows can't be read, and take the others'", async function () {
				this.timeout(60000);
				let unreadable = await importPDFAttachment(
					await createDataObject('item', { title: 'Parent of attachment with unreadable rows' }));
				let readable = await importPDFAttachment(
					await createDataObject('item', { title: 'Parent of attachment with readable rows' }));
				let broken = arrival(unreadable, [axis(1)]);
				broken.rows[0].embedding = 'not base64!';
				serve({
					[unreadable.key]: broken,
					[readable.key]: arrival(readable, [axis(1)])
				});
				await Zotero.Embeddings.Indexing.startIndexing();
				// The request didn't fail: the one is declined and embedded
				// here, the other's rows are taken
				assert.isNull(Zotero.Embeddings.Indexing.getStatus().serverUnreachable);
				assert.isNotNull((await syncState(unreadable.id)).declined);
				assert.deepEqual(await stored(unreadable.id), { chunks: 1, embedded: 1 });
				assert.equal(await versionOf(readable.id), 1);
				assert.isNull(await syncState(readable.id));
			});

			it("should store the server's raw vectors trimmed, centered and quantized", async function () {
				this.timeout(60000);
				// Wider than the stored width, as a model that truncates sends them
				let wide = vector => Float32Array.from([...vector, ...new Array(16).fill(0.5)]);
				let vectors = [wide(axis(1)), wide(axis(0))];
				for (let [dtype, VectorArray] of [['float16', Float16Array], ['float32', Float32Array]]) {
					let attachment = await importPDFAttachment(
						await createDataObject('item', { title: `Parent of attachment with ${dtype} rows` }));
					let sent = arrival(attachment, vectors);
					sent.rows.forEach((row, i) => row.embedding = encode(vectors[i], dtype));
					serve({ [attachment.key]: sent }, 'test-model/1', dtype);
					await Zotero.Embeddings.Indexing.startIndexing();
					// Stored as this client stores its own: the values as sent,
					// finished and prepared
					let expected = vectors.map(vector => Array.from(Zotero.Embeddings.prepare(
						Zotero.Embeddings.finishVector(Float32Array.from(VectorArray.from(vector))))));
					assert.equal(expected[0].length, Zotero.Embeddings.getDimensions());
					assert.deepEqual(await storedVectors(attachment.id), expected, dtype);
				}
			});

			it("should embed here an attachment whose vectors are too narrow or not finite", async function () {
				this.timeout(60000);
				let narrow = await importPDFAttachment(
					await createDataObject('item', { title: 'Parent of attachment with narrow rows' }));
				let infinite = await importPDFAttachment(
					await createDataObject('item', { title: 'Parent of attachment with infinite rows' }));
				let good = await importPDFAttachment(
					await createDataObject('item', { title: 'Parent of attachment with good rows' }));
				let unbounded = axis(1);
				// Past float16's range, so it arrives as infinity
				unbounded[0] = 1e6;
				serve({
					[narrow.key]: arrival(narrow, [axis(1).slice(1)]),
					[infinite.key]: arrival(infinite, [unbounded]),
					[good.key]: arrival(good, [axis(1)])
				});
				await Zotero.Embeddings.Indexing.startIndexing();
				for (let attachment of [narrow, infinite]) {
					assert.isNotNull((await syncState(attachment.id)).declined);
					assert.isNull(await versionOf(attachment.id));
					assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				}
				assert.equal(await versionOf(good.id), 1);
				assert.isNull(await syncState(good.id));
			});

			it("should embed here the attachments of an answer in an encoding it doesn't read", async function () {
				this.timeout(60000);
				let attachment = await importPDFAttachment(
					await createDataObject('item', { title: 'Parent of attachment in another encoding' }));
				serve({ [attachment.key]: arrival(attachment, [axis(1)]) }, 'test-model/1', 'int8');
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(askedFor(attachment.key));
				assert.isNotNull((await syncState(attachment.id)).declined);
				assert.isNull(await versionOf(attachment.id));
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
			});

			it("should embed an attachment here once the server declines it", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of declined attachment' });
				let attachment = await importPDFAttachment(item);
				serve({ [attachment.key]: declined(attachment) });
				// The status says which step is on, and why the attachment is
				// embedded here
				let seen = [];
				let listener = status => seen.push({ phase: status.phase, work: status.embedWork });
				Zotero.Embeddings.Indexing.addProgressListener(listener);
				try {
					await Zotero.Embeddings.Indexing.startIndexing();
				}
				finally {
					Zotero.Embeddings.Indexing.removeProgressListener(listener);
				}
				// Declined when asked, so embedded here in the same run
				assert.isNotNull((await syncState(attachment.id)).declined);
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				// The server asked first, then the rest embedded here, this one
				// among them
				let fetching = seen.find(status => status.phase == 'fetching-documents');
				assert.isOk(fetching);
				let local = seen.find(status => status.phase == 'indexing-documents');
				assert.isAtLeast(local.work.own, 1);
				assert.isAtLeast(local.work.declined, 1);
				// Over, so the step's work is no longer reported
				assert.isNull(Zotero.Embeddings.Indexing.getStatus().embedWork);

				// Rows that come after all replace what was made here, and
				// the refusal is forgotten
				assert.isTrue(await Zotero.Embeddings.Indexing.addChunks(attachment.id, {
					modelVersion: 'test-model/1',
					contentHash: 'sdt-test-hash',
					chunks: 1,
					rows: [{ chunkIndex: 0, embedding: prepared(axis(1)),
						anchor: positionWorld.intro.anchor }]
				}));
				assert.isNull(await syncState(attachment.id));
			});

			it("should leave an attachment the server didn't answer for to the next run", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of unanswered attachment' });
				let attachment = await importPDFAttachment(item);
				serve({});
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(askedFor(attachment.key));
				// Not declined, and neither cut nor embedded here: as it was,
				// counted as the server's to come
				assert.isNull(await stored(attachment.id));
				assert.isAtLeast(Zotero.Embeddings.Indexing.getStatus().attachments.awaiting, 1);

				// The next run asks again, and this time the rows come
				let from = client.getEmbeddings.callCount;
				serve({ [attachment.key]: arrival(attachment, [axis(1)]) });
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(askedFor(attachment.key, from));
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
			});

			it("should embed an attachment here when the server's rows are from other content", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of attachment changed here' });
				let attachment = await importPDFAttachment(item);
				// The server still has rows for the file as it was
				serve({ [attachment.key]: arrival(attachment, [axis(1)], 'old-hash') });
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(askedFor(attachment.key));
				// Refused, so the server has nothing for the file as it is,
				// and it's embedded here in the same run
				assert.isNotNull((await syncState(attachment.id)).declined);
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				assert.isTrue(Zotero.Embeddings.embedPassages.called);
			});

			it("should ask again for a changed file the server declined", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of declined attachment, changed' });
				let attachment = await importPDFAttachment(item);
				serve({ [attachment.key]: declined(attachment) });
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isNotNull((await syncState(attachment.id)).declined);

				// The file changes -- a new key, and new content behind it:
				// the refusal was for the file as it was, so the new one is
				// asked for, and this time rows come
				let sourceKey = sinon.stub(Zotero.Embeddings.Indexing.Sources, 'getAttachmentSourceKey')
					.resolves('changed-file');
				Zotero.SDT.getItemChunks.resolves({
					ok: true,
					chunks: sdtChunker.getChunks(
						sdtStructure([['Introduction', ['A section with enough words to be worth indexing.']]])),
					contentHash: 'new-hash'
				});
				Object.defineProperty(attachment, 'attachmentHash', {
					get: () => Promise.resolve('new-hash'),
					configurable: true
				});
				try {
					let from = client.getEmbeddings.callCount;
					serve({ [attachment.key]: arrival(attachment, [axis(1), axis(0)], 'new-hash') });
					await Zotero.Embeddings.Indexing.startIndexing();
					assert.isTrue(askedFor(attachment.key, from));
					assert.deepEqual(await stored(attachment.id), { chunks: 2, embedded: 2 });
					assert.isNull(await syncState(attachment.id));
				}
				finally {
					sourceKey.restore();
					delete attachment.attachmentHash;
				}
			});

			it("should fetch rows for a file this client doesn't have", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of undownloaded attachment' });
				let attachment = await importPDFAttachment(item);
				Object.defineProperty(attachment, 'getFilePathAsync', {
					value: async () => null,
					configurable: true
				});
				try {
					serve({ [attachment.key]: arrival(attachment, [axis(1)]) });
					await Zotero.Embeddings.Indexing.startIndexing();
					assert.isTrue(askedFor(attachment.key));
					// Its rows score, recorded under no file key: there's no
					// file to cut them from or to anchor them in
					assert.equal(await rowCount(attachment.id), 1);
					assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
					assert.isNull(await Zotero.DB.valueQueryAsync(
						"SELECT sourceKey FROM embeddings.itemIndexState WHERE itemID=?", attachment.id));
					assert.isNull(await syncState(attachment.id));
					assert.isFalse(Zotero.SDT.ensure.calledWith(attachment.id));

					// And with rows, it isn't asked about again
					let from = client.getEmbeddings.callCount;
					await Zotero.Embeddings.Indexing.startIndexing();
					assert.isFalse(askedFor(attachment.key, from));
				}
				finally {
					delete attachment.getFilePathAsync;
				}
			});

			it("should forget rows cut from a file that's gone", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of attachment whose file went' });
				let attachment = await importPDFAttachment(item);
				// This client's, so cut and embedded here
				Object.defineProperty(attachment, 'attachmentSyncState', {
					value: Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD,
					configurable: true
				});
				try {
					await Zotero.Embeddings.Indexing.startIndexing();
					assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
					Object.defineProperty(attachment, 'getFilePathAsync', {
						value: async () => null,
						configurable: true
					});
					await Zotero.Embeddings.Indexing.startIndexing();
					assert.isNull(await stored(attachment.id));
				}
				finally {
					delete attachment.attachmentSyncState;
					delete attachment.getFilePathAsync;
				}
			});

			it("should wait for the server when a request fails, and ask again on Resume", async function () {
				this.timeout(60000);
				let Indexing = Zotero.Embeddings.Indexing;
				let item = await createDataObject('item', { title: 'Parent of attachment behind an unreachable server' });
				let attachment = await importPDFAttachment(item);
				let linked = await Zotero.Attachments.linkFromFile({
					file: OS.Path.join(getTestDataDirectory().path, 'test.pdf')
				});
				client.getEmbeddings.rejects(new Error('Connection refused'));
				await Indexing.startIndexing();
				assert.isTrue(askedFor(attachment.key));
				// Everything waits for the retry: neither this one nor this
				// client's own linked file is cut or embedded
				assert.isNull(await stored(attachment.id));
				assert.isNull(await stored(linked.id));
				let status = Indexing.getStatus();
				assert.isAbove(status.serverUnreachable.retryAt, Date.now());
				assert.include(status.serverUnreachable.error, 'Connection refused');
				assert.isNull(status.error);

				// Resume asks right away
				let from = client.getEmbeddings.callCount;
				serve({ [attachment.key]: arrival(attachment, [axis(1)]) });
				await Indexing.startIndexing();
				assert.isTrue(askedFor(attachment.key, from));
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				assert.isNull(Indexing.getStatus().serverUnreachable);
			});

			it("should go back to the server on its own after a request failed", async function () {
				this.timeout(60000);
				let Indexing = Zotero.Embeddings.Indexing;
				let item = await createDataObject('item', { title: 'Parent of attachment asked for again' });
				let attachment = await importPDFAttachment(item);
				let delay = Indexing.SERVER_RETRY_DELAY;
				Indexing.SERVER_RETRY_DELAY = 50;
				try {
					client.getEmbeddings.rejects(new Error('Connection refused'));
					await Indexing.startIndexing();
					assert.equal(await rowCount(attachment.id), 0);
					// The run comes back once the server answers
					serve({ [attachment.key]: arrival(attachment, [axis(1)]) });
					while (!await rowCount(attachment.id)) {
						await Zotero.Promise.delay(50);
					}
					await whileIndexing();
				}
				finally {
					Indexing.SERVER_RETRY_DELAY = delay;
				}
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				assert.isNull(Indexing.getStatus().serverUnreachable);
			});

			it("should fetch again the rows the server has embedded anew", async function () {
				this.timeout(60000);
				let Sync = Zotero.Embeddings.Sync;
				let Store = Zotero.Embeddings.Indexing.Store;
				let item = await createDataObject('item', { title: 'Parent of re-embedded attachment' });
				let attachment = await importPDFAttachment(item);
				let other = await importPDFAttachment(item);
				let linked = await Zotero.Attachments.linkFromFile({
					file: OS.Path.join(getTestDataDirectory().path, 'test.pdf')
				});
				// Rows come with the version they're from, which is kept
				serve({
					[attachment.key]: arrival(attachment, [axis(1)], 'sdt-test-hash', 3),
					[other.key]: arrival(other, [axis(1)], 'sdt-test-hash', 3)
				});
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				assert.equal(await versionOf(attachment.id), 3);
				// The linked file was embedded here
				assert.deepEqual(await stored(linked.id), { chunks: 1, embedded: 1 });

				// Nothing changed on the server: nothing to do
				await Sync.checkLibrary(client, library.libraryID);
				assert.isNull(await syncState(attachment.id));
				assert.isNull(await Store.getSyncVersion(library.libraryID));

				// The server has embedded one of them anew. It's marked,
				// along with a key this client has never fetched; one at the
				// version held isn't, nor is the linked file, this client's,
				// nor a key this client has no item for
				Zotero.Prefs.set('embeddings.indexingPaused', true);
				changed(7, {
					[attachment.key]: 7, [other.key]: 3, [linked.key]: 7, NOTHERE1: 7
				});
				await Sync.checkLibrary(client, library.libraryID);
				assert.isTrue((await syncState(attachment.id)).shouldRefresh);
				assert.isNull(await syncState(other.id));
				assert.isNull(await syncState(linked.id));
				assert.equal(await Store.getSyncVersion(library.libraryID), 7);
				assert.isTrue(client.getEmbeddingVersions.calledWith(
					library.libraryType, library.libraryTypeID, 'test-model/1', null));

				// The run asks for it again and the rows are replaced; the
				// other isn't asked about
				let from = client.getEmbeddings.callCount;
				serve({ [attachment.key]: arrival(attachment, [axis(0), axis(1)], 'sdt-test-hash', 7) });
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(askedFor(attachment.key, from));
				assert.isFalse(askedFor(other.key, from));
				assert.deepEqual(await stored(attachment.id), { chunks: 2, embedded: 2 });
				assert.equal(await versionOf(attachment.id), 7);
				assert.isNull(await syncState(attachment.id));
				assert.deepEqual(await stored(linked.id), { chunks: 1, embedded: 1 });

				// The next look asks from the version recorded
				changed(false);
				await Sync.checkLibrary(client, library.libraryID);
				assert.isTrue(client.getEmbeddingVersions.lastCall.calledWith(
					library.libraryType, library.libraryTypeID, 'test-model/1', 7));
				assert.equal(await Store.getSyncVersion(library.libraryID), 7);
			});

			it("should keep rows already held from the version the server sends", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of attachment kept' });
				let attachment = await importPDFAttachment(item);
				serve({ [attachment.key]: arrival(attachment, [axis(1)], 'sdt-test-hash', 2) });
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.equal(await versionOf(attachment.id), 2);

				// Marked to be fetched again, but the server answers with the
				// version held: the rows stand and the mark is cleared
				Zotero.Prefs.set('embeddings.indexingPaused', true);
				await Zotero.Embeddings.Indexing.Store.setSyncRefresh([attachment.id]);
				Zotero.Prefs.clear('embeddings.indexingPaused');
				let from = client.getEmbeddings.callCount;
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(askedFor(attachment.key, from));
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				assert.isNull(await syncState(attachment.id));
				assert.equal(await versionOf(attachment.id), 2);
			});

			it("should not ask the server while an endpoint is active", async function () {
				this.timeout(60000);
				let Sync = Zotero.Embeddings.Sync;
				let item = await createDataObject('item', { title: 'Parent of attachment embedded at the endpoint' });
				let attachment = await importPDFAttachment(item);
				serve({ [attachment.key]: arrival(attachment, [axis(1)]) });
				changed(1, { [attachment.key]: 1 });
				let endpoint = [
					sinon.stub(Zotero.Embeddings.Endpoint, 'isActive').returns(true),
					sinon.stub(Zotero.Embeddings.Endpoint, 'getActive').resolves({ url: 'http://localhost:1/' }),
					sinon.stub(Zotero.Embeddings.Endpoint, 'recheck').resolves()
				];
				try {
					await Zotero.Embeddings.Indexing.startIndexing();
					// Embedded here, through the endpoint, without an ask
					assert.isFalse(askedFor(attachment.key));
					assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
					assert.isTrue(Zotero.Embeddings.embedPassages.called);
					assert.isFalse(Zotero.Embeddings.Indexing.getStatus().server);
					// Nor is the server asked what changed
					await Sync.checkLibrary(client, library.libraryID);
					assert.isFalse(client.getEmbeddingVersions.called);
					assert.isNull(await syncState(attachment.id));
				}
				finally {
					endpoint.forEach(stub => stub.restore());
				}
			});

			it("should embed a file here while it's still to go up", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of attachment still to upload' });
				let attachment = await importPDFAttachment(item);
				Object.defineProperty(attachment, 'attachmentSyncState', {
					value: Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD,
					configurable: true
				});
				serve({ [attachment.key]: arrival(attachment, [axis(1)]) });
				try {
					await Zotero.Embeddings.Indexing.startIndexing();
					// Not asked for -- the server can't have it -- and not
					// waited on either: this client's, like a linked file
					assert.isFalse(askedFor(attachment.key));
					assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
					assert.isNull(await syncState(attachment.id));
					assert.equal(await Zotero.DB.valueQueryAsync(
						"SELECT contentHash FROM embeddings.itemIndexState WHERE itemID=?", attachment.id),
					'sdt-test-hash');
				}
				finally {
					delete attachment.attachmentSyncState;
				}
			});

			it("should hold the attachments while a sync runs and take them once it's over", async function () {
				this.timeout(60000);
				let item = await createDataObject('item', { title: 'Parent of attachment held by a sync' });
				let attachment = await importPDFAttachment(item);
				serve({ [attachment.key]: arrival(attachment, [axis(1)]) });
				let syncing = sinon.stub(Zotero.Sync.Runner, 'syncInProgress').get(() => true);
				try {
					await Zotero.Embeddings.Indexing.startIndexing();
					// The parent embedded, the attachment untouched
					assert.isFalse(Zotero.SDT.ensure.calledWith(attachment.id));
					assert.isNull(await stored(attachment.id));

					// The sync ends: the run picks the attachments up on its own
					syncing.restore();
					syncing = null;
					await Zotero.Notifier.trigger('finish', 'sync', []);
					while (!await rowCount(attachment.id)) {
						await Zotero.Promise.delay(50);
					}
					await whileIndexing();
					assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				}
				finally {
					syncing?.restore();
				}
			});

			it("should leave a server answering in another model alone", async function () {
				this.timeout(60000);
				let Sync = Zotero.Embeddings.Sync;
				let Store = Zotero.Embeddings.Indexing.Store;
				let item = await createDataObject('item', { title: 'Parent of attachment on another model' });
				let attachment = await importPDFAttachment(item);
				serve({ [attachment.key]: arrival(attachment, [axis(1)]) }, 'other-model/1');
				await Zotero.Embeddings.Indexing.startIndexing();
				// Asked, but its rows aren't taken: the server has nothing
				// for this client, so the attachment is embedded here
				assert.isTrue(askedFor(attachment.key));
				assert.isNotNull((await syncState(attachment.id)).declined);
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });
				assert.isNull(await versionOf(attachment.id));
				// A server with nothing in this client's model changes
				// nothing here, though its version is noted
				client.getEmbeddingVersions.resolves({ version: 4, items: {}, models: ['other-model/1'] });
				await Sync.checkLibrary(client, library.libraryID);
				assert.isNotNull((await syncState(attachment.id)).declined);
				assert.equal(await Store.getSyncVersion(library.libraryID), 4);
			});

			it("should ask again for what the server declined once it has it", async function () {
				this.timeout(60000);
				let Sync = Zotero.Embeddings.Sync;
				let item = await createDataObject('item', { title: 'Parent of attachment declined, then embedded' });
				let attachment = await importPDFAttachment(item);
				// Nothing on the server yet: declined and embedded here
				serve({ [attachment.key]: declined(attachment) });
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isNotNull((await syncState(attachment.id)).declined);
				assert.deepEqual(await stored(attachment.id), { chunks: 1, embedded: 1 });

				// The server now lists it among what changed: the refusal is
				// forgotten and it's to be fetched
				Zotero.Prefs.set('embeddings.indexingPaused', true);
				changed(5, { [attachment.key]: 5 });
				await Sync.checkLibrary(client, library.libraryID);
				let state = await syncState(attachment.id);
				assert.isNull(state.declined);
				assert.isTrue(state.shouldRefresh);
			});

			it("should leave the version where it was when the look at what changed fails", async function () {
				this.timeout(60000);
				let Sync = Zotero.Embeddings.Sync;
				let Store = Zotero.Embeddings.Indexing.Store;
				await Zotero.Embeddings.initDB();
				await Store.setSyncVersion(library.libraryID, 2);
				client.getEmbeddingVersions.rejects(new Error('Connection refused'));
				await Sync.checkLibrary(client, library.libraryID);
				assert.equal(await Store.getSyncVersion(library.libraryID), 2);
			});
		});
	});

	describe("Indexing runs", function () {
		var stubs;
		var events;
		var vector = new Float32Array(4).fill(0.5);
		var whileIndexing = async () => {
			while (Zotero.Embeddings.Indexing.getStatus().indexing) {
				await Zotero.Promise.delay(50);
			}
		};

		beforeEach(function () {
			events = [];
			stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				// What the run did, in order, as the steps themselves report it
				sinon.stub(Zotero.Embeddings, 'embedPassages').callsFake(async (passages) => {
					events.push(passages.some(text => text.includes('A section with enough'))
						? 'embed-attachment'
						: 'embed-item');
					return passages.map(() => vector);
				}),
				sinon.stub(Zotero.SDT, 'ensure').callsFake(async () => {
					events.push('extract');
					return true;
				}),
				stubItemChunks(
					sdtStructure([['', ['A section with enough words to be worth indexing.']]]))
			];
		});

		afterEach(function () {
			Zotero.Embeddings.Indexing.stopIndexing();
			stubs.forEach(stub => stub.restore());
			Zotero.Prefs.clear('embeddings.indexingPaused');
		});

		it("should take a new attachment through every step on the next run", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of attachment just added' });
			let attachment = await importPDFAttachment(item);

			await Zotero.Embeddings.Indexing.startIndexing();
			assert.include(events, 'extract');
			assert.include(events, 'embed-attachment');
			assert.equal(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(embedding) FROM embeddings.itemEmbeddings WHERE itemID=?", attachment.id), 1);
			assert.isNull(Zotero.Embeddings.Indexing.getStatus().error);
		});

		it("should count best-match coverage in items, attachments included", async function () {
			this.timeout(60000);
			// What the banner leaves to index, from the counts as they stand
			let outstanding = async () => {
				await Zotero.Embeddings.Indexing.refreshStatus();
				let state = await Zotero.BestMatch.getIndexState();
				return state ? state.total - state.indexed : 0;
			};
			// Everything else indexed first, so the counts move by the new
			// items alone, and stopped, so adding them kicks no run
			await Zotero.Embeddings.Indexing.startIndexing();
			Zotero.Embeddings.Indexing.stopIndexing();
			let before = await outstanding();

			let item = await createDataObject('item', { title: 'Parent of attachment the banner counts' });
			await importPDFAttachment(item);
			assert.equal(await outstanding(), before + 2);

			await Zotero.Embeddings.Indexing.startIndexing();
			assert.equal(await outstanding(), before);
		});

		it("should count a step's way through every eligible attachment, files or not", async function () {
			this.timeout(60000);
			let Indexing = Zotero.Embeddings.Indexing;
			// Stopped, so adding the attachments kicks no run
			Indexing.stopIndexing();
			let missing = await importPDFAttachment(
				await createDataObject('item', { title: 'Parent of attachment without its file' }));
			await IOUtils.remove(await missing.getFilePathAsync());
			await importPDFAttachment(
				await createDataObject('item', { title: 'Parent of attachment to prepare' }));
			// What the pane would show at every page of every pass
			let shown = [];
			let getOutstanding = Indexing.Sources.getOutstandingAttachments;
			stubs.push(sinon.stub(Indexing.Sources, 'getOutstandingAttachments').callsFake((...args) => {
				let { phase, sweep } = Indexing.getStatus();
				shown.push({ phase, ...sweep });
				return getOutstanding.apply(Indexing.Sources, args);
			}));
			await Indexing.startIndexing();

			let eligible = await Indexing.Sources.countEligibleAttachments();
			let preparing = shown.filter(entry => entry.phase === 'preparing');
			assert.isNotEmpty(preparing);
			// Out of every eligible attachment, the one without a file
			// included, so the count never runs past its total
			for (let { done, total } of preparing) {
				assert.equal(total, eligible);
				assert.isAtMost(done, total);
			}
			assert.isTrue(preparing.some(({ done, total }) => done === total));
		});

		it("should stay stopped until started again", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of attachment stopped' });
			await importPDFAttachment(item);

			Zotero.Embeddings.Indexing.stopIndexing();
			assert.isTrue(Zotero.Embeddings.Indexing.getStatus().paused);
			// A kick while stopped starts nothing
			await Zotero.Notifier.trigger('modify', 'item', [item.id]);
			await Zotero.Promise.delay(100);
			assert.isFalse(Zotero.Embeddings.Indexing.getStatus().indexing);
			assert.notInclude(events, 'extract');
		});

		// An item saved in the last few seconds is always looked at, so
		// one that's to be passed over has to look older than that
		var backdate = async (item) => {
			await Zotero.DB.queryAsync(
				"UPDATE items SET clientDateModified='2026-01-01 00:00:00' WHERE itemID=?", item.id);
		};

		// Whether a spy on the text reader was asked about an item
		var lookedAt = (spy, item) => spy.args.some(([itemIDs]) => itemIDs.includes(item.id));

		it("should look again only at items saved since it last saw them", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Owls hunt at night' });
			await backdate(item);
			let looked = sinon.spy(Zotero.Embeddings.Indexing.Sources, 'getItemTexts');
			stubs.push(looked);
			// How many engine calls embedded a text, whatever else the run
			// embeds alongside it
			let embedded = text => Zotero.Embeddings.embedPassages.args
				.filter(([passages]) => passages.some(passage => passage.includes(text))).length;
			await Zotero.Embeddings.Indexing.startIndexing();
			assert.isTrue(lookedAt(looked, item));
			assert.equal(embedded('Owls hunt at night'), 1);

			// Unchanged since: passed over without a look
			looked.resetHistory();
			await Zotero.Embeddings.Indexing.startIndexing();
			assert.isFalse(lookedAt(looked, item));

			// Saved since: looked at and embedded anew
			item.setField('title', 'Owls hunt at dusk');
			await item.saveTx();
			await Zotero.Embeddings.Indexing.startIndexing();
			assert.isTrue(lookedAt(looked, item));
			assert.equal(embedded('Owls hunt at night'), 1);
			assert.equal(embedded('Owls hunt at dusk'), 1);
		});

		it("should stamp an item with nothing to index and pass it over until it's saved", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Owls' });
			await backdate(item);
			// Known but not cached, as the items of a library not yet viewed
			// are: the run reads its text from the tables and loads nothing
			delete Zotero.Items._objectCache[item.id];
			try {
				let looked = sinon.spy(Zotero.Embeddings.Indexing.Sources, 'getItemTexts');
				stubs.push(looked);
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(lookedAt(looked, item));
				assert.isUndefined(Zotero.Items._objectCache[item.id]);
				let record = (await Zotero.Embeddings.Indexing.Store.getIndexStates([item.id])).get(item.id);
				assert.isNull(record.contentHash);
				assert.equal(record.clientDateModified, '2026-01-01 00:00:00');

				looked.resetHistory();
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isFalse(lookedAt(looked, item));
			}
			finally {
				// An item missing from the cache of a loaded library is read
				// later as an unloaded one, so it's erased by ID
				await Zotero.Items.erase(item.id);
			}
		});

		it("should drop an item's rows once its text is gone", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Owls hunt at night' });
			await Zotero.Embeddings.Indexing.startIndexing();
			let rows = () => Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", item.id);
			assert.equal(await rows(), 1);

			item.setField('title', 'Owls');
			await item.saveTx();
			await Zotero.Embeddings.Indexing.startIndexing();
			assert.equal(await rows(), 0);
			let record = (await Zotero.Embeddings.Indexing.Store.getIndexStates([item.id])).get(item.id);
			assert.isNull(record.contentHash);
		});

		it("should take the attachments a page at a time to the same end", async function () {
			this.timeout(60000);
			let { Indexing } = Zotero.Embeddings;
			let attachments = [];
			for (let i = 0; i < 3; i++) {
				let item = await createDataObject('item', { title: 'Parent of paged attachment ' + i });
				attachments.push(await importPDFAttachment(item));
			}
			// Known but not cached, as the items of a library not yet viewed
			// are: the run loads them for itself, without caching them
			for (let attachment of attachments) {
				delete Zotero.Items._objectCache[attachment.id];
			}
			let pageSize = Indexing.ATTACHMENT_PAGE_SIZE;
			Indexing.ATTACHMENT_PAGE_SIZE = 2;
			try {
				await Indexing.startIndexing();
				for (let attachment of attachments) {
					assert.equal(await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(embedding) FROM embeddings.itemEmbeddings WHERE itemID=?",
						attachment.id), 1);
				}
				assert.equal(events.filter(event => event === 'extract').length, 3);
				assert.isNull(Indexing.getStatus().error);
			}
			finally {
				Indexing.ATTACHMENT_PAGE_SIZE = pageSize;
				// Attachments missing from the cache of a loaded library are
				// read later as unloaded ones, so they're erased by ID
				await Zotero.Items.erase(attachments.map(attachment => attachment.id));
			}
		});

		it("should ask an attachment's file again on Resume or once it's saved, not on a kick", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of settled attachment' });
			let attachment = await importPDFAttachment(item);
			await backdate(attachment);
			let keyed = sinon.spy(Zotero.Embeddings.Indexing.Sources, 'getAttachmentSourceKey');
			stubs.push(keyed);
			let kicked = async () => {
				await Zotero.Promise.delay(3500);
				await whileIndexing();
			};
			await Zotero.Embeddings.Indexing.startIndexing();
			assert.isTrue(keyed.calledWith(attachment));

			// Settled, so a kicked run leaves its file alone
			keyed.resetHistory();
			await Zotero.Notifier.trigger('modify', 'item', [item.id]);
			await kicked();
			assert.isFalse(keyed.calledWith(attachment));

			// Resume asks every file again
			keyed.resetHistory();
			await Zotero.Embeddings.Indexing.startIndexing();
			assert.isTrue(keyed.calledWith(attachment));

			// Saved since: asked again on the next kick
			keyed.resetHistory();
			attachment.setField('title', 'Settled attachment, renamed');
			await attachment.saveTx();
			await kicked();
			assert.isTrue(keyed.calledWith(attachment));
		});

		it("should go again when a kick lands while a run is going", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of attachment kicked mid-run' });
			let attachment = await importPDFAttachment(item);
			let keyed = sinon.spy(Zotero.Embeddings.Indexing.Sources, 'getAttachmentSourceKey');
			stubs.push(keyed);
			// A kick while the attachment is being embedded, with the run
			// held long enough for it to land
			Zotero.Embeddings.embedPassages.callsFake(async (passages) => {
				if (passages.some(text => text.includes('A section with enough'))) {
					Zotero.Embeddings.Indexing.startIndexing();
					await Zotero.Promise.delay(200);
				}
				return passages.map(() => vector);
			});

			await Zotero.Embeddings.Indexing.startIndexing();
			assert.isFalse(Zotero.Embeddings.Indexing.getStatus().indexing);
			// The run goes again on its own and looks at the attachment's
			// file once more
			keyed.resetHistory();
			let waited = 0;
			while (!keyed.calledWith(attachment) && waited < 15000) {
				await Zotero.Promise.delay(50);
				waited += 50;
			}
			assert.isTrue(keyed.calledWith(attachment));
			await whileIndexing();
			assert.isNull(Zotero.Embeddings.Indexing.getStatus().error);
		});

		it("should give way to an item added mid-run and then start the pipeline over", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of attachment interrupted' });
			await importPDFAttachment(item);
			// A note arrives while the attachment is being extracted
			let added = false;
			Zotero.SDT.ensure.callsFake(async () => {
				events.push('extract');
				if (!added) {
					added = true;
					let note = new Zotero.Item('note');
					note.parentID = item.id;
					note.setNote('<p>A note with several words about owls.</p>');
					await note.saveTx();
				}
				return true;
			});

			await Zotero.Embeddings.Indexing.startIndexing();
			// The note is embedded before the attachment is, since a kick
			// brings the run back to the items between the pipeline's
			// steps; the pipeline then starts over and finishes the
			// attachment
			assert.include(events, 'extract');
			assert.include(events, 'embed-attachment');
			assert.isBelow(events.indexOf('extract'), events.lastIndexOf('embed-item'));
			assert.isBelow(events.lastIndexOf('embed-item'), events.indexOf('embed-attachment'));
			assert.isNull(Zotero.Embeddings.Indexing.getStatus().error);
		});
	});

	describe("Indexing", function () {
		it("should clear embeddings left by another model revision", async function () {
			this.timeout(60000);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/2'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => new Float32Array(4).fill(0.5)))
			];
			let item = await createDataObject('item');
			try {
				await Zotero.Embeddings.initDB();
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings "
						+ "(itemID, chunkIndex, embedding) VALUES (?, 0, ?)",
					[item.id, new Uint8Array([0, 0, 0, 0])]
				);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemIndexState (itemID, sourceKey, contentHash) "
						+ "VALUES (?, ?, 'hash')",
					[item.id, 'key']
				);
				// Stored by an earlier revision, whose vectors can't be
				// compared with this one's
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.embeddingsMeta (key, value) "
						+ "VALUES ('modelVersion', 'test-model/1')"
				);

				await Zotero.Embeddings.Indexing.startIndexing();
				assert.equal(
					await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(*) FROM embeddings.itemIndexState WHERE contentHash='hash'"
					),
					0
				);
				// Chunks are sized to the model, so the counts go too
				assert.equal(
					await Zotero.DB.valueQueryAsync(
						"SELECT COUNT(*) FROM embeddings.itemIndexState WHERE sourceKey='key'"
					),
					0
				);
				assert.equal(
					await Zotero.DB.valueQueryAsync(
						"SELECT value FROM embeddings.embeddingsMeta WHERE key='modelVersion'"
					),
					'test-model/2'
				);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				Zotero.Prefs.clear('embeddings.indexingPaused');
			}
		});

		it("should remove a deleted item's embedding", async function () {
			await Zotero.Embeddings.initDB();
			let stub = sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true);
			try {
				let item = await createDataObject('item');
				await Zotero.DB.queryAsync(
					"INSERT INTO embeddings.itemEmbeddings "
						+ "(itemID, chunkIndex, embedding) VALUES (?, 0, ?)",
					[item.id, new Uint8Array([0, 0, 0, 0])]
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
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
				sinon.stub(Zotero.Embeddings, 'download').resolves()
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
			// Each has stored embeddings of its own, separate from the
			// attachment's own full text
			assert.ok(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", note.id));
			assert.ok(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", annotation.id));
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
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

		it("should store a long note or annotation as multiple chunk rows", async function () {
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
			// An annotation of the same length is cut the same way
			let item = await createDataObject('item', { title: 'Chunked annotation parent' });
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
			];
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}

			let rows = await Zotero.DB.queryAsync(
				"SELECT chunkIndex FROM embeddings.itemEmbeddings "
					+ "WHERE itemID=? ORDER BY chunkIndex",
				note.id
			);
			assert.isAbove(rows.length, 1);
			// Contiguous chunk indexes
			assert.deepEqual(rows.map(row => row.chunkIndex), rows.map((row, i) => i));
			// The equally long annotation is cut too
			assert.isAbove(await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
				annotation.id
			), 1);
		});

		it("should index an attachment's sections", async function () {
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				// The extraction itself is sdt.js's concern (see sdtTest.js);
				// what's under test is what indexing does with the sections
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				stubItemChunks(sdtStructure([
					['Introduction', [{
						text: 'Owls migrate south when the winters turn cold.',
						pageIndex: 0,
						pageLabel: '2',
						position: { pageIndex: 0, rects: [[10, 20, 300, 40]] }
					}]],
					['Methods', [{
						text: 'Tracking devices recorded the routes of forty owls.',
						pageIndex: 1,
						pageLabel: '3',
						position: { pageIndex: 1, rects: [[10, 20, 300, 40]] }
					}]]
				]))
			];
			try {				await Zotero.Embeddings.Indexing.startIndexing();

				// Both sections are far too small to embed on their own, so
				// they land in one chunk, prefixed with the first section's
				// outline path and anchored on both pages: the first block's
				// line on its page and the second block's on the next
				let rows = await Zotero.DB.queryAsync(
					"SELECT chunkIndex, anchor FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				);
				assert.lengthOf(rows, 1);
				let anchor = Zotero.Embeddings.Indexing.expandAnchor(rows[0].anchor);
				assert.lengthOf(anchor.pageRects, 2);
				assert.deepEqual(anchor.pageRects.map(rect => rect[0]), [0, 1]);
				for (let rect of anchor.pageRects) {
					assert.approximately(rect[1], 10, 0.01);
					assert.approximately(rect[3], 300, 0.01);
				}
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT contentHash FROM embeddings.itemIndexState WHERE itemID=?", attachment.id
				), 'sdt-test-hash');
				let text = texts.find(t => t.includes('Owls migrate south'));
				assert.ok(text);
				assert.isTrue(text.startsWith('Introduction\n\n'));
				assert.include(text, 'Tracking devices');

				// The count was recorded against the extractor and options
				// that cut it
				let extractor = await Zotero.Embeddings.Indexing.Sources.getExtractor(attachment);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT extractor FROM embeddings.itemIndexState WHERE itemID=?", attachment.id
				), extractor);
				assert.equal(extractor, await Zotero.SDT.getProcessorVersion(attachment));

				// And the preview reads the anchor back from the pack
				let position = { pageIndex: 0, rects: [[10, 20, 300, 40]] };
				stubs.push(
					sinon.stub(Zotero.Embeddings, 'embedQuery')
						.resolves(new Float32Array(4).fill(0.5)),
					sinon.stub(Zotero.SDT, 'readAnchors').resolves({
						ok: true,
						chunks: [{
							text: 'Owls migrate south when the winters turn cold.\n\n'
								+ 'Tracking devices recorded the routes of forty owls.',
							outlinePath: 'Introduction',
							pageLabel: '2',
							position
						}]
					})
				);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.embeddingsMeta (key, value) "
						+ "VALUES ('modelVersion', 'test-model/1')"
				);
				let chunks = await Zotero.Embeddings.getMatchingChunks('owls', attachment.id);
				assert.lengthOf(chunks, 1);
				assert.deepEqual(Zotero.SDT.readAnchors.firstCall.args[1], [anchor]);
				assert.include(chunks[0].text, 'Owls migrate south');
				assert.include(chunks[0].text, 'Tracking devices');
				assert.equal(chunks[0].outlinePath, 'Introduction');
				assert.equal(chunks[0].pageLabel, '2');
				// The reader is sent to where the chunk opens
				assert.deepEqual(chunks[0].position, position);
			}
			finally {
				stubs.forEach(stub => stub.restore());			}
		});

		it("should record an attachment's chunk count when it's cut and keep it once embedded", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of counted attachment' });
			let attachment = await importPDFAttachment(item);

			let vector = new Float32Array(4).fill(0.5);
			// Two sections long enough that the chunker keeps them apart
			let sections = [
				['', ['Owls hunt at night. '.repeat(120)]],
				['', ['Hawks hunt by day. '.repeat(120)]]
			];
			// Embedding the attachment fails on the first run, so its count
			// can only have come from the chunk stage
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				stubItemChunks(sdtStructure(sections))
			];
			// Status reports what's stored, and items apart from it
			let assertStatusMatchesIndex = async () => {
				let { items, chunks, attachments, sweep } = Zotero.Embeddings.Indexing.getStatus();
				assert.isAtLeast(items.done, 1);
				assert.isAtLeast(items.total, items.done);
				// The rows of attachments cut here, which this client embeds
				let cut = await Zotero.DB.rowQueryAsync(
					"SELECT COUNT(*) AS total, COUNT(embedding) AS done "
						+ "FROM embeddings.itemEmbeddings JOIN embeddings.itemIndexState USING (itemID) "
						+ "WHERE extractor IS NOT NULL"
				);
				let finished = await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemIndexState L WHERE sourceKey IS NOT NULL "
						+ "AND NOT EXISTS (SELECT 1 FROM embeddings.itemEmbeddings E "
						+ "WHERE E.itemID=L.itemID AND E.embedding IS NULL)"
				);
				assert.deepEqual(chunks, { done: cut.done, total: cut.total });
				// Attachments are counted whole, and only once every chunk
				// is embedded, so the bar can't read full while work is
				// outstanding. Nothing here is the server's, so nothing is
				// awaited from it.
				assert.equal(attachments.done, finished);
				assert.isAtLeast(attachments.total, attachments.done);
				assert.equal(attachments.awaiting, 0);
				// How far a step has swept the library, cleared once a run ends
				assert.deepEqual(sweep, { done: 0, total: 0 });
				return chunks;
			};
			try {				await Zotero.Embeddings.Indexing.startIndexing();
				let counted = await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				);
				assert.isAbove(counted, 1);
				let chunks = await assertStatusMatchesIndex();
				assert.isAtLeast(chunks.total - chunks.done, counted);
				// Every counted chunk has its row, none of them a vector yet
				let rows = await Zotero.DB.rowQueryAsync(
					"SELECT COUNT(*) AS rows, COUNT(embedding) AS embedded "
						+ "FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				);
				assert.deepEqual([rows.rows, rows.embedded], [counted, 0]);

				// The count marks the attachment as cut, so the next run
				// doesn't cut it again
				failAttachment = false;
				let phases = new Set();
				let listener = status => phases.add(status.phase);
				let setSource = sinon.spy(Zotero.Embeddings.Indexing.Store, 'setSource');
				Zotero.Embeddings.Indexing.addProgressListener(listener);
				try {
					await Zotero.Embeddings.Indexing.startIndexing();
				}
				finally {
					Zotero.Embeddings.Indexing.removeProgressListener(listener);
					setSource.restore();
				}
				// Recording what it was cut from is what cutting an attachment
				// does, so an untouched record says it wasn't cut again
				assert.isFalse(setSource.args.some(([itemID]) => itemID === attachment.id));
				assert.include([...phases], 'indexing-documents');
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				), counted);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				), counted);
				await assertStatusMatchesIndex();
			}
			finally {
				stubs.forEach(stub => stub.restore());			}
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
				sections.push(['', ['Owls hunt at night. '.repeat(200)]]);
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				stubItemChunks(sdtStructure(sections))
			];
			let rowCounts = () => Zotero.DB.rowQueryAsync(
				"SELECT COUNT(*) AS chunks, COUNT(embedding) AS embedded FROM embeddings.itemEmbeddings WHERE itemID=?",
				attachment.id
			);
			// Rows with a vector; every chunk has a row from the count on
			let storedRows = () => Zotero.DB.valueQueryAsync(
				"SELECT COUNT(embedding) FROM embeddings.itemEmbeddings WHERE itemID=?",
				attachment.id
			);
			try {				await Zotero.Embeddings.Indexing.startIndexing();
				let { chunks, embedded: stored } = await rowCounts();
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
				let after = await rowCounts();
				assert.equal(after.chunks, chunks);
				assert.equal(after.embedded, chunks);
				assert.equal(await storedRows(), chunks);

				// ...and a complete attachment isn't read again
				let reads = Zotero.SDT.getItemChunks.callCount;
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.equal(Zotero.SDT.getItemChunks.callCount, reads);

				// ...until the chunker that cut it falls below the oldest
				// kept: then it's cut and embedded anew
				let extractor = await Zotero.DB.valueQueryAsync(
					"SELECT extractor FROM embeddings.itemIndexState WHERE itemID=?", attachment.id);
				await Zotero.DB.queryAsync(
					"UPDATE embeddings.itemIndexState SET extractor=? WHERE itemID=?",
					[extractor.replace(/\/\d+$/, '/0'), attachment.id]);
				embedded = [];
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isAbove(Zotero.SDT.getItemChunks.callCount, reads);
				assert.equal(embedded.length, chunks);
				assert.equal(await storedRows(), chunks);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT extractor FROM embeddings.itemIndexState WHERE itemID=?", attachment.id), extractor);
			}
			finally {
				stubs.forEach(stub => stub.restore());			}
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				stubItemChunks(sdtStructure([
					['', ['Owls hunt at night. '.repeat(200)]],
					['', ['Hawks hunt by day. '.repeat(200)]]
				]))
			];
			try {				await Zotero.Embeddings.Indexing.startIndexing();
				let { diagnostics } = await Zotero.Embeddings.Indexing.refreshStatus();

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

				// Chunk shape agrees with the state rows
				let { perDocument } = diagnostics.chunks;
				assert.equal(perDocument.count, await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemIndexState WHERE sourceKey IS NOT NULL"
				));
				assert.equal(perDocument.buckets.reduce((sum, b) => sum + b.count, 0), perDocument.count);
				assert.isAtLeast(perDocument.max, await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", attachment.id
				));
			}
			finally {
				stubs.forEach(stub => stub.restore());			}
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				stubItemChunks(sdtStructure([
					['Discussion', [
						'Owls migrate south when the winters turn cold.',
						// An entry cited inline, inside a body section
						{
							text: 'Smith, J. (2019). Owls. J. Birds 4, 1-10.',
							reference: true
						}
					]],
					// A section that's nothing but references
					['References', [
						{
							text: 'Doe, A. (2020). Migration. Nature 1, 2-3.',
							reference: true
						}
					]]
				]))
			];
			try {				await Zotero.Embeddings.Indexing.startIndexing();

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
				stubs.forEach(stub => stub.restore());			}
		});

		it("should chunk an attachment that has nothing stored yet", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of derived attachment' });
			let attachment = await importPDFAttachment(item);
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				stubItemChunks(sdtStructure([
					['Results', ['Owls hunt at night. '.repeat(200)]],
					['Discussion', ['Hawks hunt by day. '.repeat(200)]]
				]))
			];
			try {
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", attachment.id), 0);
				let { chunks, contentHash }
					= await Zotero.Embeddings.Indexing.Sources.getAttachmentChunks(attachment);
				assert.equal(contentHash, 'sdt-test-hash');
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

		it("shouldn't keep revisiting an attachment with no extractor", async function () {
			this.timeout(60000);
			let item = await importFileAttachment('test.pdf');
			await Zotero.Embeddings.initDB();
			await store(item, 0, axis(0), { anchor: positionWorld.intro.anchor });
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => axis(0))),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				stubStructure(),
				// No document-worker metadata, so every attachment's
				// extractor reads as null
				sinon.stub(Zotero.SDT, 'getProcessorVersion').resolves(null)
			];
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.embeddingsMeta (key, value) "
					+ "VALUES ('modelVersion', 'test-model/1')"
			);
			let extracted = () => Zotero.SDT.ensure.args
				.filter(([itemID]) => itemID === item.id).length;
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
				let afterFirst = extracted();
				await Zotero.Embeddings.Indexing.startIndexing();
				// Complete rows are left alone rather than counted again on
				// every pass, which would read the document each time, for
				// good
				assert.equal(extracted(), afterFirst);
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}
		});

		it("should run items, then the attachment pipeline, one stage at a time", async function () {
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
			let itemChunksStub = stubItemChunks(
				sdtStructure([['', ['A section with enough words to be worth indexing.']]]));
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				ensureStub,
				itemChunksStub
			];
			let phases = [];
			let onProgress = (status) => {
				if (status.phase !== phases[phases.length - 1]) {
					phases.push(status.phase);
				}
			};
			Zotero.Embeddings.Indexing.addProgressListener(onProgress);
			try {				await Zotero.Embeddings.Indexing.startIndexing();

				// Every item embeds before any document is extracted, and
				// every document is extracted before any of them embeds
				assert.include(events, 'embed-item');
				assert.include(events, 'embed-attachment');
				assert.isBelow(events.lastIndexOf('embed-item'), events.indexOf('extract'));
				assert.isBelow(events.lastIndexOf('extract'), events.indexOf('embed-attachment'));
				assert.isTrue(ensureStub.calledWith(attachment.id));
				assert.isTrue(itemChunksStub.calledWith(attachment.id));
				// And each step announces itself, in the same order
				assert.deepEqual(
					phases.filter(phase => phase !== 'idle'),
					['indexing', 'preparing', 'indexing-documents']
				);
			}
			finally {
				Zotero.Embeddings.Indexing.removeProgressListener(onProgress);
				stubs.forEach(stub => stub.restore());			}
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				ensureStub,
				stubItemChunks(
					sdtStructure([['', ['A section with enough words to be worth indexing.']]]))
			];
			try {				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isTrue(ensureStub.calledWith(attachment.id));

				// A second pass finds the stored embedding current, so the
				// attachment needs no pack
				ensureStub.resetHistory();
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isFalse(ensureStub.calledWith(attachment.id));
			}
			finally {
				stubs.forEach(stub => stub.restore());			}
		});

		it("should index anew an attachment cut by a chunker before the floor", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of outdated attachment' });
			let attachment = await importPDFAttachment(item);

			let vector = new Float32Array(4).fill(0.5);
			let embedStub = sinon.stub(Zotero.Embeddings, 'embedPassages')
				.callsFake(async texts => texts.map(() => vector));
			let stubs = [
				embedStub,
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				stubItemChunks(
					sdtStructure([['', ['Herons wade the shallows at dawn, hunting by sight.']]]))
			];
			let { Store } = Zotero.Embeddings.Indexing;
			let embeddedHerons = () => embedStub.args
				.filter(([texts]) => texts.some(text => text.includes('Herons'))).length;
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.equal(embeddedHerons(), 1);
				let extractor = (await Store.getIndexStates([attachment.id])).get(attachment.id).extractor;

				// Stamped as cut by chunker 0, below the floor of 1
				let outdated = extractor.replace(/\d+$/, '0');
				await Zotero.DB.queryAsync(
					"UPDATE embeddings.itemIndexState SET extractor=? WHERE itemID=?",
					[outdated, attachment.id]
				);
				await Zotero.Embeddings.Indexing.startIndexing();
				let record = (await Store.getIndexStates([attachment.id])).get(attachment.id);
				assert.equal(record.extractor, extractor);
				assert.equal(embeddedHerons(), 2);
				assert.isAbove(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", attachment.id), 0);

				// A current cut stands
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.equal(embeddedHerons(), 2);
			}
			finally {
				stubs.forEach(stub => stub.restore());
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
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				sinon.stub(Zotero.SDT, 'getItemChunks').resolves({ ok: false, reason: 'failed' })
			];
			try {				await Zotero.Embeddings.Indexing.startIndexing();

				// The plain text is chunked like a note: embedded without an
				// anchor, the rows deriving from the text rather than the
				// file
				let rows = await Zotero.DB.queryAsync(
					"SELECT embedding, anchor FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				);
				assert.lengthOf(rows, 1);
				// One byte per dimension
				assert.lengthOf(rows[0].embedding, 4);
				assert.isNull(rows[0].anchor);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT contentHash FROM embeddings.itemIndexState WHERE itemID=?", attachment.id),
				Zotero.Utilities.Internal.md5('A plain paragraph of text about owl migration routes.'));

				// And the preview round-trips by cutting the plain text again
				stubs.push(sinon.stub(Zotero.Embeddings, 'embedQuery')
					.resolves(new Float32Array(4).fill(0.5)));
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.embeddingsMeta (key, value) "
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
				delete attachment.attachmentText;			}
		});

		it("should leave an attachment as it is when the worker can't cut it", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of uncut attachment' });
			let attachment = await importPDFAttachment(item);
			Object.defineProperty(attachment, 'attachmentText', {
				get: () => Promise.resolve('A plain paragraph of text about owl migration routes.'),
				configurable: true
			});

			let vector = new Float32Array(4).fill(0.5);
			let itemChunksStub = sinon.stub(Zotero.SDT, 'getItemChunks')
				.resolves({ ok: false, reason: 'cut-failed' });
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				itemChunksStub
			];
			try {
				await Zotero.Embeddings.Indexing.startIndexing();

				// Nothing is stored: not the plain text, which would stand in
				// for the file for good, and no record of how the file cuts
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?", attachment.id), 0);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemIndexState WHERE itemID=? AND sourceKey IS NOT NULL",
					attachment.id), 0);

				// Once the worker can cut it, the next run does
				stubs.pop().restore();
				stubs.push(stubItemChunks(
					sdtStructure([['Introduction', ['A section with enough words to be worth indexing.']]])));
				await Zotero.Embeddings.Indexing.startIndexing();
				let rows = await Zotero.DB.queryAsync(
					"SELECT anchor FROM embeddings.itemEmbeddings WHERE itemID=?", attachment.id);
				assert.lengthOf(rows, 1);
				assert.isNotNull(rows[0].anchor);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				delete attachment.attachmentText;
			}
		});

		it("should pass over an attachment whose file is gone", async function () {
			this.timeout(60000);
			let item = await createDataObject('item', { title: 'Parent of fileless attachment' });
			let attachment = await importPDFAttachment(item);
			// No readable file, so there's nothing to cut it from and no
			// state row saying how it cuts
			Object.defineProperty(attachment, 'getFilePathAsync', {
				value: async () => null,
				configurable: true
			});

			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => new Float32Array(4).fill(0.5))),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true)
			];
			try {
				// The run reaches the end rather than throwing on the missing
				// state row
				await Zotero.Embeddings.Indexing.startIndexing();
				assert.isNull(Zotero.Embeddings.Indexing.getStatus().error);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				), 0);
				// Looked at, which is recorded, but not cut from anything
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemIndexState WHERE itemID=? "
						+ "AND (sourceKey IS NOT NULL OR contentHash IS NOT NULL)",
					attachment.id
				), 0);
			}
			finally {
				stubs.forEach(stub => stub.restore());
				delete attachment.getFilePathAsync;
				Zotero.Prefs.clear('embeddings.indexingPaused');
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
			let itemChunksStub = sinon.stub(Zotero.SDT, 'getItemChunks')
				.resolves({ ok: false, reason: 'failed' });
			let ourCalls = () => itemChunksStub.getCalls()
				.filter(call => call.args[0] === attachment.id).length;
			let stubs = [
				sinon.stub(Zotero.Embeddings, 'embedPassages')
					.callsFake(async texts => texts.map(() => vector)),
				sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true),
				sinon.stub(Zotero.Embeddings, 'getModelVersion').returns('test-model/1'),
				sinon.stub(Zotero.Embeddings, 'isDownloaded').resolves(true),
				sinon.stub(Zotero.Embeddings, 'download').resolves(),
				sinon.stub(Zotero.Embeddings, 'getModelName').returns('bekko-embedding-v1-a25m'),
				sinon.stub(Zotero.Embeddings, 'embedQuery').resolves(Float32Array.from(testMean)),
				sinon.stub(Zotero.SDT, 'ensure').resolves(true),
				itemChunksStub
			];
			try {				await Zotero.Embeddings.Indexing.startIndexing();

				// The attempt is recorded as a state row with no rows under
				// it, so the item counts as processed with nothing stored
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemIndexState WHERE itemID=?",
					attachment.id
				), 1);
				let row = await Zotero.DB.rowQueryAsync(
					"SELECT COUNT(*) AS chunks, COUNT(embedding) AS embedded FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				);
				assert.equal(row.chunks, 0);
				assert.equal(row.embedded, 0);
				assert.equal(await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM embeddings.itemEmbeddings WHERE itemID=?",
					attachment.id
				), 0);
				// Sections are read once, when the attachment is cut
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
				delete attachment.attachmentText;			}
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
			assert.isEmpty(queries.filter(sql => sql.includes('contentHash')
				&& sql.includes('itemID=?') && sql.startsWith('SELECT')));
			assert.isNotEmpty(queries.filter(sql => sql.includes('itemID, contentHash')));
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
		});

		it("should produce real vectors that rank a related passage above an unrelated one", async function () {
			this.timeout(600000);
			// The runtime's model cache resolves navigator.storage via the most
			// recent browser window
			await loadZoteroPane();
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

		it("should rank sentences with the static model, across languages", async function () {
			this.timeout(600000);
			await loadZoteroPane();
			await Zotero.Embeddings.Static.download();
			let query = "Pachycephalosaurs had thick domed skulls";
			let [literal, paraphrase, german, unrelated] = await Zotero.Embeddings.Static.similarities(query, [
				"The frontoparietal dome of Stegoceras thickened with age.",
				"Head-butting behaviour in thick-skulled ornithischians is debated.",
				"Pachycephalosaurier hatten dicke, gewölbte Schädel.",
				"We thank the reviewers for their comments."
			]);
			assert.isAbove(literal, unrelated);
			assert.isAbove(paraphrase, unrelated);
			assert.isAbove(german, unrelated);
		});

		it("should report a cached model as downloaded", async function () {
			this.timeout(1800000);
			await loadZoteroPane();
			await Zotero.Embeddings.preloadModel();

			assert.isTrue(await Zotero.Embeddings.isDownloaded());
			// The static model comes with it
			assert.isTrue(await Zotero.Embeddings.Static.isDownloaded());
		});

		it("should estimate chunk sizes within a factor of the model's real token counts", async function () {
			this.timeout(1800000);
			await loadZoteroPane();
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

			// A long text splits into several chunks, each sized by an
			// estimate from its characters that has to stay in the
			// neighbourhood of the model's own count
			let sentences = [];
			for (let i = 0; i < 100; i++) {
				sentences.push(`Sentence number ${i} concerns the ecology of temperate wetlands.`);
			}
			let chunks = Zotero.SDT.getPlainTextChunks(sentences.join(' '));
			assert.isAbove(chunks.length, 1);
			for (let chunk of chunks) {
				let real = tokenizer.encode(chunk.text).length - tokenizer.encode('').length;
				assert.isAbove(chunk.text.length, real / 2);
				assert.isBelow(chunk.text.length, real * 2);
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
					"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding) "
						+ "VALUES (?, 0, ?)",
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
				"REPLACE INTO embeddings.embeddingsMeta (key, value) "
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
