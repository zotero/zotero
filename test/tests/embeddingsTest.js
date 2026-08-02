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

	describe("#scoreItemIDs() floor", function () {
		it("should not return items scoring below the model's minimum", async function () {
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			await Zotero.Embeddings.initDB();
			let mean = Zotero.Embeddings.getMeanVector();

			// Centering subtracts the mean, so an item stored as the mean plus
			// one axis scores against the query by that axis's share of it
			let axis = (index, scale = 1) => {
				let vector = Float32Array.from(mean);
				vector[index] += scale;
				return vector;
			};
			let store = async (item, vector) => {
				let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings (itemID, embedding, sourceHash) "
						+ "VALUES (?, ?, 'hash')",
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
				Zotero.Prefs.clear('embeddings.model');
			}
		});
	});

	describe("#getScoreFraction()", function () {
		it("should clamp scores into the active model's display range", function () {
			// bge-small-en-v1.5's band runs from 0.2 to 0.6
			let stub = sinon.stub(Zotero.Embeddings, 'getModelName').returns('bge-small-en-v1.5');
			try {
				assert.equal(Zotero.Embeddings.getScoreFraction(0), 0);
				assert.equal(Zotero.Embeddings.getScoreFraction(0.2), 0);
				assert.approximately(Zotero.Embeddings.getScoreFraction(0.4), 0.5, 0.001);
				assert.equal(Zotero.Embeddings.getScoreFraction(0.6), 1);
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

		it("should skip items with too little text to say anything", async function () {
			this.timeout(60000);
			await createDataObject('item', { title: 'C' });
			await createDataObject('item', { title: '猫' });
			await createDataObject('item', { title: 'A study of feline behavior' });

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
				sinon.stub(Zotero.Embeddings, 'preloadModel').resolves()
			];
			try {
				await Zotero.Embeddings.Indexing.startIndexing();
			}
			finally {
				stubs.forEach(stub => stub.restore());
			}

			assert.include(texts, 'A study of feline behavior');
			// A single ideograph is a word; a single letter isn't
			assert.include(texts, '猫');
			assert.notInclude(texts, 'C');
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
	describe("TEMP mean computation", function () {
		before(function () {
			if (!Services.env.get("ZOTERO_TEST_EMBEDDINGS_INFERENCE")) {
				this.skip();
			}
		});

		it("should compute a mean vector for each model", async function () {
			this.timeout(1800000);
			await loadZoteroPane();

			// Titles and abstract fragments across fields and languages, so the
			// mean captures the direction every embedding shares rather than
			// any one subject
			let corpus = [
				'Grounded theory methodology in qualitative sociology',
				'The gut microbiome influences host metabolism through short-chain fatty acid production',
				'A transformer architecture for protein structure prediction from sequence alone',
				'Sleep deprivation impairs hippocampal memory consolidation in rodents',
				'Does peer review improve manuscript quality? Evidence from a randomized trial',
				'Dopaminergic neurons in the ventral tegmental area encode reward prediction error',
				'Bilingualism and the onset of dementia: a population-based cohort study',
				'The amyloid cascade hypothesis of Alzheimer disease revisited',
				'Critiques of the serotonin hypothesis of depression',
				'Machine learning emulation of atmospheric convection',
				'The colonial history of the French Atlantic world, 1660-1800',
				'CRISPR screens identify regulators of T cell exhaustion',
				'Measurement of the Higgs boson mass in the four-lepton channel',
				'Ocean acidification reduces coral reef calcification rates',
				'Urban heat islands and heat-related mortality in European cities',
				'Patronage and the economics of eighteenth-century opera',
				'Quantum error correction with surface codes on superconducting qubits',
				'Wage inequality and the decline of labor market institutions',
				'Antibiotic resistance in hospital-acquired Klebsiella infections',
				'Neural correlates of decision making under uncertainty',
				'Land use change and pollinator decline in temperate agriculture',
				'A grammar of evidentiality in Amazonian languages',
				'Constitutional courts and democratic backsliding',
				'Stellar nucleosynthesis in asymptotic giant branch stars',
				'Tectonic controls on Himalayan river incision',
				'The reception of Ovid in medieval French romance',
				'Randomized trial of cognitive behavioral therapy for insomnia',
				'Supply chain resilience after the 2020 disruption',
				'Photocatalytic water splitting with earth-abundant catalysts',
				'Archaeological evidence for early dairying in Neolithic Europe',
				'Social media use and adolescent wellbeing: a longitudinal analysis',
				'Numerical methods for stiff differential equations',
				'The epidemiology of long COVID in primary care',
				'Rhetoric and citizenship in the Roman republic',
				'Deep learning for medical image segmentation',
				'Monetary policy transmission in emerging markets',
				'Gene flow between domestic and wild populations of Atlantic salmon',
				'Phenomenology of embodiment in twentieth-century philosophy',
				'Nanoparticle drug delivery across the blood-brain barrier',
				'Historical demography of the Black Death in England',
				'Étude sur la transition énergétique dans les villes européennes',
				'Die Rolle des Gedächtnisses in der deutschen Nachkriegsliteratur',
				'Un estudio sobre la biodiversidad en los bosques tropicales',
				'気候変動が海洋生態系に与える影響についての研究',
				'Исследование структуры белков методом криоэлектронной микроскопии',
				'城市化进程中的社会流动性研究',
				'Uno studio sulla conservazione dei manoscritti medievali',
				'Estudo sobre políticas públicas de saúde no Brasil',
				'Onderzoek naar waterbeheer in laaggelegen gebieden',
				'Badania nad historią gospodarczą Europy Środkowej'
			];

			for (let modelName of Zotero.Embeddings.getAvailableModels().map(m => m.name)) {
				Zotero.Prefs.set('embeddings.model', modelName);
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				await Zotero.Embeddings.preloadModel();

				let vectors = [];
				for (let i = 0; i < corpus.length; i += 10) {
					vectors.push(...await Zotero.Embeddings.embedPassages(corpus.slice(i, i + 10)));
				}
				let mean = new Float32Array(vectors[0].length);
				for (let vector of vectors) {
					for (let d = 0; d < mean.length; d++) {
						mean[d] += vector[d] / vectors.length;
					}
				}
				let bytes = new Uint8Array(mean.buffer);
				let binary = '';
				for (let byte of bytes) {
					binary += String.fromCharCode(byte);
				}
				Zotero.debug('MEAN ' + modelName + ' dim=' + mean.length + ' '
					+ btoa(binary));
			}
			await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
		});
	});
	describe("#scoreItemIDs() centering", function () {
		it("should score text with nothing to say near zero", async function () {
			Zotero.Prefs.set('embeddings.model', 'bge-small-en-v1.5');
			await Zotero.Embeddings.initDB();
			let mean = Zotero.Embeddings.getMeanVector();
			assert.isNotNull(mean);

			let store = async (item, vector) => {
				let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
				await Zotero.DB.queryAsync(
					"REPLACE INTO embeddings.itemEmbeddings (itemID, embedding, sourceHash) "
						+ "VALUES (?, ?, 'hash')",
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
			await store(empty, normalized(mean));
			let distinct = await createDataObject('item');
			let other = Float32Array.from(mean);
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
				let a = normalized(mean);
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
				Zotero.Prefs.clear('embeddings.model');
			}
		});
	});
});
