"use strict";

describe("Zotero.Embeddings", function () {
	before(function () {
		Zotero.Embeddings.Indexing.init();
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
	});

	describe("#getScoreFraction()", function () {
		it("should clamp scores into the active model's display range", function () {
			// bge-small-en-v1.5's displayScoreRange is [0.5, 0.75]
			let stub = sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5');
			try {
				assert.equal(Zotero.Embeddings.getScoreFraction(0.4), 0);
				assert.equal(Zotero.Embeddings.getScoreFraction(0.5), 0);
				assert.approximately(Zotero.Embeddings.getScoreFraction(0.625), 0.5, 0.001);
				assert.equal(Zotero.Embeddings.getScoreFraction(0.75), 1);
				assert.equal(Zotero.Embeddings.getScoreFraction(0.99), 1);
				// No known model -> empty bar
				stub.returns('');
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
					"REPLACE INTO embeddings.itemEmbeddings VALUES (?, ?, ?)",
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
					"INSERT INTO embeddings.itemEmbeddings VALUES (?, ?, ?)",
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
});
