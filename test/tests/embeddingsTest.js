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

	describe("Indexing", function () {
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
	});
});
