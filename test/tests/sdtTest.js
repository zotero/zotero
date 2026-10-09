describe("Zotero.SDT", function () {
	const SDT_CACHE_FILE_NAME = '.zotero-sdt-cache';
	const TEST_PDF_HASH = 'e54589353710950c4b7ff70829a60036';
	const SDT_PACK_MAGIC = [0x89, 0x53, 0x44, 0x54, 0x0d, 0x0a, 0x1a, 0x0a];
	const STALE_SDT_PACK_BASE64 = 'iVNEVA0KGgoBAQAAGAAAAGAAAABGAAAAAAAAADMAAAAAAAAAAQAAAIXMMQ6DMBBE0btMbaIxBcW2uQIVnYUXkSa2dk2kCPnuEVwgX6/+J6qVVd2LQU60b1UIat4Q8FHzV3lDYg/IqenTNDXNEIwcp4FxYJxJuT1ILgjwctiq12xPvkPAP6H3H6tWKkhMTy1WsoquVspMUbJSKjBU0lHKSUxKzVGyUgKxk/PzSlLzSoIS89JTlayiow1idaINY2NrY3WU8ktLcjLzQKKxtQBjYGBgqFYqqSxIVbJSKkgsSkwvSizIUNJRKkmtKFGyUgpJLS5RCHYJUUhOTM5I1VOqBQA=';
	const STALE_PROCESSOR_VERSION_SDT_PACK_BASE64 = 'iVNEVA0KGgoBAQAAGAAAAHMAAABGAAAAAAAAADMAAAAAAAAAAQAAAB3MsQ7CIBQF0H+5MzWXtpSW1V9wcsPySF2EQGtiGv7daHLmcyKXtEqtqcCd2D9Z4JBDhMJbSn2mF5xuCsHvci3idwlw6NlPHXVHfSPd34XkHQo1HWWVX7b5usFBzGjmZTCD1VwM1/FhY7Sc+8VP5DChtS+rVipITE8tVrKKrlbKTFGyUiowVNJRyklMSs1RslICsZPz80pS80qCEvPSU5WsoqMNYnWiDWNja2N1lPJLS3Iy80CisbUAY2BgYKhWKqksSFWyUipILEpML0osyFDSUSpJrShRslIKSS0uUQh2CVFITkzOSNVTqgUA';
	const WRONG_PROCESSOR_TYPE_SDT_PACK_BASE64 = 'iVNEVA0KGgoBAQAAGAAAAHMAAABGAAAAAAAAADMAAAAAAAAAAQAAAB3MsQ6DIBQF0H+5szYXFRXW/kKnbojP2KUQwCaN4d8bm5z5nIgpeMk5JNgT5RsFFhKPBQ0+kvIrvGFVbbC6IvckrsgKi47d2FK1VA/S/t1IPtEghyN5ubbd5f3a9KBn0+t+UjSaflimbZs4d8aNZD+i1h+rVipITE8tVrKKrlbKTFGyUiowVNJRyklMSs1RslICsZPz80pS80qCEvPSU5WsoqMNYnWiDWNja2N1lPJLS3Iy80CisbUAY2BgYKhWKqksSFWyUipILEpML0osyFDSUSpJrShRslIKSS0uUQh2CVFITkzOSNVTqgUA';
	let testSDTPackBytes;
	let documentWorkerMetadata;

	before(async function () {
		let pako = getTestRequire()('pako');
		documentWorkerMetadata = JSON.parse(await Zotero.File.getContentsFromURLAsync(
			'resource://zotero/document-worker/metadata.json'
		));
		testSDTPackBytes = makeEmptyTestSDTPackV1(documentWorkerMetadata, pako);
	});

	it("should return a valid cached pack", async function () {
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item);

		let progress = [];
		let result = await getValidPack(item, {
			onProgress: value => progress.push(value),
		});

		assert.equal(result.packVersion, documentWorkerMetadata.SDT_PACK_VERSION);
		assert.equal(result.schemaMajorVersion, parseInt(documentWorkerMetadata.SDT_SCHEMA_VERSION));
		assertPackMagic(result);
		assert.deepEqual(progress, []);
	});

	it("should cut a cached pack into chunks", async function () {
		// Cold worker startup
		this.timeout(60000);
		let item = await importFileAttachment('test.pdf');
		let pako = getTestRequire()('pako');
		let bytes = makeTestSDTPackV1WithContent(documentWorkerMetadata, pako, {
			outline: [
				{ title: 'Introduction', ref: [1] },
			],
			pages: [
				{ label: '1', contentRange: [[0], [2]] },
			],
			blocks: [
				testBlock('Front matter on the title page', 0, [10, 700, 300, 720]),
				testBlock('Introduction', 0, [10, 650, 300, 670], 'heading'),
				testBlock('Owls are nocturnal birds of prey.', 0, [10, 600, 300, 620]),
			],
		});
		await writeTestSDTCache(item, bytes);

		let result = await Zotero.SDT.getItemChunks(item.id);
		assert.isTrue(result.ok);
		assert.equal(result.contentHash, TEST_PDF_HASH);
		let { chunks } = result;
		assert.lengthOf(chunks, 1);
		assert.include(chunks[0].text, 'Front matter on the title page');
		assert.include(chunks[0].text, 'Owls are nocturnal birds of prey.');
		assert.isTrue(chunks[0].anchor.pageRects.every(rect => rect[0] === 0));

		// A pack that isn't cached isn't generated when the caller says so
		let other = await importFileAttachment('test.pdf');
		assert.deepEqual(await Zotero.SDT.getItemChunks(other.id, { cachedOnly: true }),
			{ ok: false, reason: 'not-cached' });
	});

	it("should read chunk anchors back as their text", async function () {
		// Cold worker startup fetches the wasm runtime
		this.timeout(60000);
		let item = await importFileAttachment('test.pdf');
		let pako = getTestRequire()('pako');
		let bytes = makeTestSDTPackV1WithContent(documentWorkerMetadata, pako, {
			outline: [
				{ title: 'Introduction', ref: [0] },
				{ title: 'Methods', ref: [2] },
			],
			pages: [
				{ label: 'ix', contentRange: [[0], [2]] },
				{ label: '10', contentRange: [[2], [4]] },
			],
			blocks: [
				testBlock('Introduction', 0, [10, 700, 300, 720], 'heading'),
				testBlock('Owls are nocturnal birds of prey. '.repeat(40), 0, [10, 600, 300, 680]),
				testBlock('Methods', 1, [10, 700, 300, 720], 'heading'),
				testBlock('We tracked forty owls with GPS loggers. '.repeat(40), 1, [10, 600, 300, 680]),
			],
		});
		await writeTestSDTCache(item, bytes);

		let { chunks } = await Zotero.SDT.getItemChunks(item.id, { positions: true });
		assert.lengthOf(chunks, 2);
		// Each chunk is anchored on its own page
		assert.deepEqual(chunks.map(chunk => chunk.anchor.pageRects.map(rect => rect[0])), [[0], [1]]);

		// Each chunk's anchor gives back its text, with where it sits -- the
		// section it starts in and its page -- and the reader position to
		// open it at, the one the chunk was cut with. Anchors on nothing the
		// document has read back as nothing.
		let anchors = [
			chunks[0].anchor,
			chunks[1].anchor,
			null,
			{ pageRects: [[5, 0, 0, 1, 1]] },
			{ pageRects: [[0, 0, 0, 1, 1]] },
		];
		let spy = sinon.spy(Zotero.PDFWorker, 'readStructuredDocumentTextAnchors');
		try {
			var read = await Zotero.SDT.readAnchors(item.id, anchors);
			assert.isTrue(spy.calledOnce);
		}
		finally {
			spy.restore();
		}
		assert.isTrue(read.ok);
		assert.lengthOf(read.chunks, 5);
		assert.equal(read.chunks[0].text, chunks[0].text);
		assert.equal(read.chunks[0].outlinePath, 'Introduction');
		assert.equal(read.chunks[0].pageLabel, 'ix');
		assert.equal(read.chunks[0].position.pageIndex, 0);
		assert.equal(read.chunks[1].text, chunks[1].text);
		assert.equal(read.chunks[1].outlinePath, 'Methods');
		assert.equal(read.chunks[1].pageLabel, '10');
		assert.equal(read.chunks[1].position.pageIndex, 1);
		assert.isNull(read.chunks[2]);
		assert.isNull(read.chunks[3]);
		assert.isNull(read.chunks[4]);
		assert.deepEqual(read.chunks[1].position, chunks[1].position);

		// A worker failure is reported, not worked around
		let stub = sinon.stub(Zotero.PDFWorker, 'readStructuredDocumentTextAnchors')
			.rejects(new Error('Worker down'));
		try {
			assert.deepEqual(await Zotero.SDT.readAnchors(item.id, anchors),
				{ ok: false, reason: 'failed' });
		}
		finally {
			stub.restore();
		}
	});

	it("should report the expected extraction identity from getProcessorVersion()", async function () {
		let item = await importFileAttachment('test.pdf');
		let version = await Zotero.SDT.getProcessorVersion(item);
		let { CHUNKER_VERSION } = getTestRequire()(
			'resource://zotero/document-worker/structured-document-text-chunker.js');
		assert.equal(version, 'pdf/' + documentWorkerMetadata.SDT_PROCESSOR_VERSIONS.pdf
			+ '/' + parseInt(documentWorkerMetadata.SDT_SCHEMA_VERSION)
			+ '/' + CHUNKER_VERSION);
		// Unsupported attachment types have no extraction identity
		let unsupported = await importFileAttachment('test.png');
		assert.isNull(await Zotero.SDT.getProcessorVersion(unsupported));
	});

	it("should generate the pack when missing", async function () {
		let item = await importFileAttachment('test.pdf');
		let cachePath = getSDTCachePath(item);
		await OS.File.remove(cachePath, { ignoreAbsent: true });

		let workerStub = stubStructuredDocumentTextWorker();
		try {
			let result = await getValidPack(item);
			assert.isTrue(workerStub.calledOnce);
			assert.equal(workerStub.firstCall.args[0], item.id);
			assert.isTrue(await OS.File.exists(cachePath));
			assertPackMagic(result);

			// A second call should hit the cache
			await getValidPack(item);
			assert.isTrue(workerStub.calledOnce);
		}
		finally {
			workerStub.restore();
		}
	});

	it("should share a single generation between concurrent getPack() calls", async function () {
		let item = await importFileAttachment('test.pdf');
		await OS.File.remove(getSDTCachePath(item), { ignoreAbsent: true });

		let unblockWorker;
		let workerBlocked = new Promise((resolve) => {
			unblockWorker = resolve;
		});
		let workerStub = sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentText')
			.callsFake(async () => {
				await workerBlocked;
				return { buf: getTestSDTPackBuffer() };
			});
		try {
			// One generation per item at a time -- this is also what keeps
			// concurrent generations from racing on the cache file write
			let promise1 = Zotero.SDT.getPack(item.id);
			let promise2 = Zotero.SDT.getPack(item.id);
			await waitForStubCall(workerStub);
			unblockWorker();

			let [result1, result2] = await Promise.all([promise1, promise2]);
			assert.isTrue(result1.ok, result1.reason);
			assert.isTrue(result2.ok, result2.reason);
			assert.isTrue(workerStub.calledOnce);
		}
		finally {
			unblockWorker();
			workerStub.restore();
		}
	});

	it("should share generation progress between concurrent getPack() calls", async function () {
		let item = await importFileAttachment('test.pdf');
		await OS.File.remove(getSDTCachePath(item), { ignoreAbsent: true });

		let unblockWorker;
		let workerBlocked = new Promise((resolve) => {
			unblockWorker = resolve;
		});
		let workerStub = sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentText')
			.callsFake(async (itemID, options = {}) => {
				options.onProgress(10);
				await workerBlocked;
				options.onProgress(60);
				return { buf: getTestSDTPackBuffer() };
			});
		try {
			let progress1 = [];
			let progress2 = [];
			let promise1 = Zotero.SDT.getPack(item.id, {
				onProgress: progress => progress1.push(progress),
			});
			await waitForProgress(progress1, 10);
			assert.deepEqual(progress1, [10]);

			let promise2 = Zotero.SDT.getPack(item.id, {
				onProgress: progress => progress2.push(progress),
			});
			await waitForProgress(progress2, 10);
			assert.deepEqual(progress2, [10]);

			unblockWorker();
			let [result1, result2] = await Promise.all([promise1, promise2]);
			assert.isTrue(result1.ok, result1.reason);
			assert.isTrue(result2.ok, result2.reason);
			assert.isTrue(workerStub.calledOnce);
			assert.deepEqual(progress1, [10, 60]);
			assert.deepEqual(progress2, [10, 60]);
		}
		finally {
			unblockWorker();
			workerStub.restore();
		}
	});

	it("should regenerate a stale pack", async function () {
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item, getStaleSDTPackBytes());

		let workerStub = stubStructuredDocumentTextWorker();
		try {
			await getValidPack(item);
			assert.isTrue(workerStub.calledOnce);
		}
		finally {
			workerStub.restore();
		}
	});

	it("should return a stale-processor pack and regenerate it in the background", async function () {
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item, getStaleProcessorVersionSDTPackBytes());

		let unblockWorker;
		let workerBlocked = new Promise((resolve) => {
			unblockWorker = resolve;
		});
		let workerStub = sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentText')
			.callsFake(async () => {
				await workerBlocked;
				return { buf: getTestSDTPackBuffer() };
			});
		try {
			// The old pack is returned immediately while regeneration is
			// still blocked in the worker
			let result = await getValidPack(item);
			assert.deepEqual(
				new Uint8Array(result.bytes),
				getStaleProcessorVersionSDTPackBytes()
			);
			await waitForStubCall(workerStub);

			unblockWorker();
			await waitForCacheBytes(item, getTestSDTPackBytes());

			// The next call returns the fresh pack without re-extracting
			result = await getValidPack(item);
			assert.deepEqual(new Uint8Array(result.bytes), getTestSDTPackBytes());
			assert.isTrue(workerStub.calledOnce);
		}
		finally {
			unblockWorker();
			workerStub.restore();
		}
	});

	it("should regenerate a stale-processor pack before returning it with allowStale: false", async function () {
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item, getStaleProcessorVersionSDTPackBytes());

		let workerStub = sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentText')
			.resolves({ buf: getTestSDTPackBuffer() });
		try {
			// A consumer that stores references into the pack's content gets
			// the current extraction, never one about to be replaced
			let result = await Zotero.SDT.getPack(item.id, { allowStale: false });
			assert.isTrue(result.ok);
			assert.deepEqual(new Uint8Array(result.bytes), getTestSDTPackBytes());
			assert.isTrue(workerStub.calledOnce);
		}
		finally {
			workerStub.restore();
		}
	});

	it("should regenerate a pack with the wrong processor type", async function () {
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item, getWrongProcessorTypeSDTPackBytes());

		let workerStub = stubStructuredDocumentTextWorker();
		try {
			await getValidPack(item);
			assert.isTrue(workerStub.calledOnce);
		}
		finally {
			workerStub.restore();
		}
	});

	it("should regenerate a pack with an incompatible schema major version", async function () {
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item, getIncompatibleSchemaMajorSDTPackBytes());

		let workerStub = stubStructuredDocumentTextWorker();
		try {
			let result = await getValidPack(item);
			assert.isTrue(workerStub.calledOnce);
			assert.equal(result.schemaMajorVersion,
				parseInt(documentWorkerMetadata.SDT_SCHEMA_VERSION));
		}
		finally {
			workerStub.restore();
		}
	});

	it("should retry generation after a transient failure", async function () {
		let item = await importFileAttachment('test.pdf');
		await OS.File.remove(getSDTCachePath(item), { ignoreAbsent: true });

		let workerStub = sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentText');
		workerStub.onFirstCall().rejects(new Error('Transient extraction failure'));
		workerStub.callsFake(async () => ({ buf: getTestSDTPackBuffer() }));
		try {
			let result = await Zotero.SDT.getPack(item.id);
			assert.isFalse(result.ok);
			assert.equal(result.reason, 'failed');

			await getValidPack(item);
			assert.isTrue(workerStub.calledTwice);
		}
		finally {
			workerStub.restore();
		}
	});

	it("shouldn't re-extract a password-protected file until it changes", async function () {
		let item = await importFileAttachment('test.pdf');
		await OS.File.remove(getSDTCachePath(item), { ignoreAbsent: true });

		let error = new Error('Password required');
		error.name = 'PasswordException';
		let workerStub = sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentText')
			.rejects(error);
		try {
			let result = await Zotero.SDT.getPack(item.id);
			assert.isFalse(result.ok);
			assert.equal(result.reason, 'password-required');

			result = await Zotero.SDT.getPack(item.id);
			assert.isFalse(result.ok);
			assert.equal(result.reason, 'password-required');
			assert.isTrue(workerStub.calledOnce);
		}
		finally {
			workerStub.restore();
		}
	});

	it("should regenerate a stale-processor pack before resolving ensure()", async function () {
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item, getStaleProcessorVersionSDTPackBytes());

		let workerStub = stubStructuredDocumentTextWorker();
		try {
			// Unlike getPack(), ensure() doesn't return early with the old
			// pack -- once it resolves, the cache must already be current
			assert.isTrue(await Zotero.SDT.ensure(item.id));
			assert.isTrue(workerStub.calledOnce);
			assert.deepEqual(
				await IOUtils.read(getSDTCachePath(item)),
				getTestSDTPackBytes()
			);
		}
		finally {
			workerStub.restore();
		}
	});

	it("should return false from ensure() when generation fails", async function () {
		let item = await importFileAttachment('test.pdf');
		await OS.File.remove(getSDTCachePath(item), { ignoreAbsent: true });

		let workerStub = sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentText')
			.rejects(new Error('Extraction failure'));
		try {
			assert.isFalse(await Zotero.SDT.ensure(item.id));
		}
		finally {
			workerStub.restore();
		}
	});

	it("should return unavailable for unsupported items", async function () {
		let item = await importFileAttachment('test.txt');
		let result = await Zotero.SDT.getPack(item.id);
		assert.isFalse(result.ok);
		assert.equal(result.reason, 'unavailable');
	});

	it("should cut chunks in the document worker", async function () {
		// Cold worker startup
		this.timeout(60000);

		let item = await importFileAttachment('test.pdf');
		let pako = getTestRequire()('pako');
		let bytes = makeTestSDTPackV1WithContent(documentWorkerMetadata, pako, {
			outline: [
				{ title: 'Introduction', ref: [0] },
				{ title: 'Methods', ref: [2] },
			],
			pages: [
				{ label: 'ix', contentRange: [[0], [2]] },
				{ label: '10', contentRange: [[2], [4]] },
			],
			blocks: [
				testBlock('Introduction', 0, [10, 700, 300, 720], 'heading'),
				testBlock('Owls are nocturnal birds of prey. '.repeat(40), 0, [10, 600, 300, 680]),
				testBlock('Methods', 1, [10, 700, 300, 720], 'heading'),
				testBlock('We tracked forty owls with GPS loggers. '.repeat(40), 1, [10, 600, 300, 680]),
			],
		});
		await writeTestSDTCache(item, bytes);

		let spy = sinon.spy(Zotero.PDFWorker, 'getStructuredDocumentTextChunks');
		try {
			let result = await Zotero.SDT.getItemChunks(item.id);
			assert.isTrue(spy.calledOnce);
			assert.isTrue(result.ok);
			assert.equal(result.contentHash, TEST_PDF_HASH);
			let { chunks } = result;
			assert.lengthOf(chunks, 2);
			assert.include(chunks[0].text, 'Owls are nocturnal');
			assert.include(chunks[1].text, 'We tracked forty owls');
			assert.deepEqual(chunks.map(chunk => chunk.outlinePath), ['Introduction', 'Methods']);
			assert.deepEqual(chunks.map(chunk => chunk.anchor.pageRects.map(rect => rect[0])), [[0], [1]]);
			assert.isFalse('position' in chunks[0]);

			// Asked for, each chunk also carries the position it opens at
			result = await Zotero.SDT.getItemChunks(item.id, { positions: true });
			assert.isTrue(result.ok);
			assert.deepEqual(result.chunks.map(chunk => chunk.position.pageIndex), [0, 1]);
			assert.isFalse('positions' in result.chunks[0]);
		}
		finally {
			spy.restore();
		}

		// A worker failure, or a chunker the metadata doesn't describe, is
		// reported as a failed cut rather than worked around
		let stub = sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentTextChunks')
			.rejects(new Error('Worker down'));
		try {
			assert.deepEqual(await Zotero.SDT.getItemChunks(item.id),
				{ ok: false, reason: 'cut-failed' });
			stub.resolves({ chunks: [], sourceHash: TEST_PDF_HASH, chunkerVersion: 999 });
			assert.deepEqual(await Zotero.SDT.getItemChunks(item.id),
				{ ok: false, reason: 'cut-failed' });
		}
		finally {
			stub.restore();
		}
	});

	it("should fail pending worker requests on a worker error and start afresh", async function () {
		this.timeout(60000);
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item);

		// A request in flight when the worker errors
		Zotero.PDFWorker._init();
		let pending = Zotero.PDFWorker._query('sdt.readAnchors', { buf: new ArrayBuffer(0), anchors: [] }, []);
		Zotero.PDFWorker._worker.dispatchEvent(new ErrorEvent('error', { message: 'Worker down' }));
		let error = null;
		try {
			await pending;
		}
		catch (e) {
			error = e;
		}
		assert.include(error?.message, 'Worker down');
		assert.isNull(Zotero.PDFWorker._worker);

		// The next request gets a new worker
		let result = await Zotero.SDT.getItemChunks(item.id);
		assert.isTrue(result.ok);
		assert.isNotNull(Zotero.PDFWorker._worker);
	});

	it("should generate and open a pack with the real document worker", async function () {
		// Cold worker startup fetches the wasm runtime and segmentation models
		this.timeout(120000);

		let item = await importFileAttachment('test.pdf');
		let cachePath = getSDTCachePath(item);
		await OS.File.remove(cachePath, { ignoreAbsent: true });

		// getPack() succeeds only if the worker-produced pack parses with the
		// bundled SDT module, matches its schema major version, and is
		// stamped with the source file's hash, so this catches version
		// drift between the document-worker and the bundled module
		let progress = [];
		let result = await getValidPack(item, {
			onProgress: value => progress.push(value),
		});
		assert.isTrue(await OS.File.exists(cachePath));
		assertPackMagic(result);
		assert.deepEqual(progress, progress.slice().sort((a, b) => a - b));
		assert.equal(progress[0], 0);
		assert.equal(progress.at(-1), 100);
		assert.isTrue(progress.some(value => value > 0 && value < 100));

		// The cached pack cuts in the worker without re-extracting
		let cut = await Zotero.SDT.getItemChunks(item.id);
		assert.isTrue(cut.ok);
		assert.equal(cut.contentHash, TEST_PDF_HASH);
		assert.isNotEmpty(cut.chunks);
	});

	function getSDTCachePath(item) {
		return OS.Path.join(Zotero.Attachments.getStorageDirectory(item).path, SDT_CACHE_FILE_NAME);
	}

	async function writeTestSDTCache(item, bytes = getTestSDTPackBytes()) {
		// The fixture packs embed the hash of test.pdf, so they have to be
		// regenerated if the test PDF ever changes
		assert.equal(await item.attachmentHash, TEST_PDF_HASH,
			'fixture pack source hash should match test.pdf');
		let cachePath = getSDTCachePath(item);
		await OS.File.writeAtomic(cachePath, bytes, { tmpPath: `${cachePath}.tmp` });
		return cachePath;
	}

	async function getValidPack(item, options) {
		let result = await Zotero.SDT.getPack(item.id, options);
		assert.isTrue(result.ok, result.reason);
		return result;
	}

	function assertPackMagic(result) {
		assert.deepEqual(Array.from(new Uint8Array(result.bytes, 0, 8)), SDT_PACK_MAGIC);
	}

	async function waitForStubCall(stub) {
		while (!stub.called) {
			await Zotero.Promise.delay(5);
		}
	}

	async function waitForProgress(progress, value) {
		while (!progress.includes(value)) {
			await Zotero.Promise.delay(5);
		}
	}

	async function waitForCacheBytes(item, expected) {
		let cachePath = getSDTCachePath(item);
		while (true) {
			let bytes = await IOUtils.read(cachePath);
			if (bytes.length === expected.length && bytes.every((b, i) => b === expected[i])) {
				return;
			}
			await Zotero.Promise.delay(10);
		}
	}

	function stubStructuredDocumentTextWorker() {
		return sinon.stub(Zotero.PDFWorker, 'getStructuredDocumentText')
			.callsFake(async () => ({ buf: getTestSDTPackBuffer() }));
	}

	function getTestSDTPackBuffer() {
		let bytes = getTestSDTPackBytes();
		return bytes.buffer;
	}

	function getStaleSDTPackBytes() {
		return decodeBase64Bytes(STALE_SDT_PACK_BASE64);
	}

	function getStaleProcessorVersionSDTPackBytes() {
		return decodeBase64Bytes(STALE_PROCESSOR_VERSION_SDT_PACK_BASE64);
	}

	function getWrongProcessorTypeSDTPackBytes() {
		return decodeBase64Bytes(WRONG_PROCESSOR_TYPE_SDT_PACK_BASE64);
	}

	function getIncompatibleSchemaMajorSDTPackBytes() {
		let bytes = getTestSDTPackBytes();
		let currentMajor = parseInt(documentWorkerMetadata.SDT_SCHEMA_VERSION);
		bytes[9] = currentMajor === 0xff ? currentMajor - 1 : currentMajor + 1;
		return bytes;
	}

	function getTestSDTPackBytes() {
		return testSDTPackBytes.slice();
	}

	function getTestRequire() {
		let scope = {};
		Services.scriptloader.loadSubScript('resource://zotero/require.js', scope);
		return scope.require;
	}

	// Minimal empty SDT pack for cache tests. This intentionally implements
	// only pack format v1; a pack-format change should require test review,
	// while schema and processor version bumps should not.
	function makeEmptyTestSDTPackV1(metadata, pako) {
		if (metadata.SDT_PACK_VERSION !== 1) {
			throw new Error('Unsupported test SDT pack version');
		}
		const HEADER_LENGTH = 16;
		const INDEX_LENGTH = 16;
		let schemaVersion = metadata.SDT_SCHEMA_VERSION.split('.').map(Number);
		let metadataBytes = pako.deflateRaw(JSON.stringify({
			processor: {
				type: 'pdf',
				version: metadata.SDT_PROCESSOR_VERSIONS.pdf,
			},
			dateCreated: '2026-01-01T00:00:00.000Z',
			source: { hash: TEST_PDF_HASH },
		}));
		let catalogBytes = pako.deflateRaw(JSON.stringify({
			pages: [],
			outline: [],
		}));
		let payloadOffset = HEADER_LENGTH + INDEX_LENGTH;
		let bytes = new Uint8Array(
			payloadOffset + metadataBytes.byteLength + catalogBytes.byteLength
		);
		bytes.set(SDT_PACK_MAGIC, 0);
		bytes.set([metadata.SDT_PACK_VERSION, ...schemaVersion], 8);
		let view = new DataView(bytes.buffer);
		view.setUint32(12, INDEX_LENGTH, true);
		view.setUint32(HEADER_LENGTH, metadataBytes.byteLength, true);
		view.setUint32(HEADER_LENGTH + 4, catalogBytes.byteLength, true);
		// The final eight index bytes are zeroes: one empty content offset
		// and one empty block-start entry.
		bytes.set(metadataBytes, payloadOffset);
		bytes.set(catalogBytes, payloadOffset + metadataBytes.byteLength);
		return bytes;
	}

	// A block of one text node laid out on a page, with the character
	// geometry the chunker requires of a PDF: one run along the rect, each
	// non-whitespace character an equal share of it
	function testBlock(text, pageIndex, [x1, y1, x2, y2], type = 'paragraph') {
		let count = text.replace(/\s/g, '').length;
		let width = (x2 - x1) / Math.max(1, count);
		return {
			type,
			anchor: { pageRects: [[pageIndex, x1, y1, x2, y2]] },
			content: [{
				text,
				anchor: { textMap: JSON.stringify([[0, pageIndex, x1, y1, x2, y2, ...new Array(count).fill(width)]]) }
			}]
		};
	}

	// A v1 pack with real content blocks and catalog, for section/outline
	// consumers (see makeEmptyTestSDTPackV1() for the layout)
	function makeTestSDTPackV1WithContent(metadata, pako, { outline = [], pages = [], blocks = [] } = {}) {
		if (metadata.SDT_PACK_VERSION !== 1) {
			throw new Error('Unsupported test SDT pack version');
		}
		const HEADER_LENGTH = 16;
		// Two entries each of chunk byte offsets and chunk block starts, after
		// the metadata and catalog lengths
		const INDEX_LENGTH = 8 + 2 * 4 + 2 * 4;
		let encoder = new TextEncoder();
		let schemaVersion = metadata.SDT_SCHEMA_VERSION.split('.').map(Number);
		let metadataBytes = pako.deflateRaw(JSON.stringify({
			processor: {
				type: 'pdf',
				version: metadata.SDT_PROCESSOR_VERSIONS.pdf,
			},
			dateCreated: '2026-01-01T00:00:00.000Z',
			source: { hash: TEST_PDF_HASH },
		}));
		let catalogBytes = pako.deflateRaw(JSON.stringify({ pages, outline }));
		// One content chunk: an offset table, then the block JSON back to back
		let blockByteArrays = blocks.map(block => encoder.encode(JSON.stringify(block)));
		let chunkBytes = new Uint8Array(
			blocks.length * 4 + blockByteArrays.reduce((sum, b) => sum + b.byteLength, 0)
		);
		let chunkView = new DataView(chunkBytes.buffer);
		let blockOffset = 0;
		let writeOffset = blocks.length * 4;
		for (let i = 0; i < blockByteArrays.length; i++) {
			chunkView.setUint32(i * 4, blockOffset, true);
			blockOffset += blockByteArrays[i].byteLength;
			chunkBytes.set(blockByteArrays[i], writeOffset);
			writeOffset += blockByteArrays[i].byteLength;
		}
		let compressedChunk = pako.deflateRaw(chunkBytes);

		let payloadOffset = HEADER_LENGTH + INDEX_LENGTH;
		let bytes = new Uint8Array(
			payloadOffset + metadataBytes.byteLength + catalogBytes.byteLength
				+ compressedChunk.byteLength
		);
		bytes.set(SDT_PACK_MAGIC, 0);
		bytes.set([metadata.SDT_PACK_VERSION, ...schemaVersion], 8);
		let view = new DataView(bytes.buffer);
		view.setUint32(12, INDEX_LENGTH, true);
		view.setUint32(HEADER_LENGTH, metadataBytes.byteLength, true);
		view.setUint32(HEADER_LENGTH + 4, catalogBytes.byteLength, true);
		// chunkByteOffsets [0, byteLength], chunkBlockStarts [0, blockCount]
		view.setUint32(HEADER_LENGTH + 12, compressedChunk.byteLength, true);
		view.setUint32(HEADER_LENGTH + 20, blocks.length, true);
		bytes.set(metadataBytes, payloadOffset);
		bytes.set(catalogBytes, payloadOffset + metadataBytes.byteLength);
		bytes.set(compressedChunk,
			payloadOffset + metadataBytes.byteLength + catalogBytes.byteLength);
		return bytes;
	}

	function decodeBase64Bytes(base64) {
		let binary = atob(base64);
		let bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}
});
