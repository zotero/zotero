describe("Zotero.SDT", function () {
	const SDT_CACHE_FILE_NAME = '.zotero-sdt-cache';
	const TEST_PDF_HASH = 'e54589353710950c4b7ff70829a60036';
	const SDT_PACK_MAGIC = [0x89, 0x53, 0x44, 0x54, 0x0d, 0x0a, 0x1a, 0x0a];
	const TEST_SDT_PACK_BASE64 = 'iVNEVA0KGgoBAQAAGAAAAHMAAABGAAAAAAAAADMAAAAAAAAAAQAAAB3MsQ7CIBQF0H+5MzWXtpSW1V9wcsPySF2EQGtiGv7daHLmcyKXtEqtqcCd2D9Z4JBDhMJbSn2mF5xuCsHvci3idwlw6NlPHXVHfSPd34XkHQo1HWWVX7b5usFBzGjmZTCD1VwM1/FhY7Sc+8VP5DChtS+rVipITE8tVrKKrlbKTFGyUiowVNJRyklMSs1RslICsZPz80pS80qCEvPSU5WsoqMNYnWiDWNja2N1lPJLS3Iy80CisbUAY2BgYKhWKqksSFWyUipILEpML0osyFDSUSpJrShRslIKSS0uUQh2CVFITkzOSNVTqgUA';
	const STALE_SDT_PACK_BASE64 = 'iVNEVA0KGgoBAQAAGAAAAGAAAABGAAAAAAAAADMAAAAAAAAAAQAAAIXMMQ6DMBBE0btMbaIxBcW2uQIVnYUXkSa2dk2kCPnuEVwgX6/+J6qVVd2LQU60b1UIat4Q8FHzV3lDYg/IqenTNDXNEIwcp4FxYJxJuT1ILgjwctiq12xPvkPAP6H3H6tWKkhMTy1WsoquVspMUbJSKjBU0lHKSUxKzVGyUgKxk/PzSlLzSoIS89JTlayiow1idaINY2NrY3WU8ktLcjLzQKKxtQBjYGBgqFYqqSxIVbJSKkgsSkwvSizIUNJRKkmtKFGyUgpJLS5RCHYJUUhOTM5I1VOqBQA=';
	const STALE_PROCESSOR_VERSION_SDT_PACK_BASE64 = 'iVNEVA0KGgoBAQAAGAAAAHMAAABGAAAAAAAAADMAAAAAAAAAAQAAAB3MsQ7CIBQF0H+5MzW3tEDL6i84uWF5pC7SADUxTf/daHLmc2AreZFac4E/0D6bwGOLCQpvKfWZX/D6VIihybVIaBLhoaltx75jfyP934XkHQo172WRX7aGusJDzGimeTCD6zkbLuPDpeQ46TlYcrA4zy+rVipITE8tVrKKrlbKTFGyUiowVNJRyklMSs1RslICsZPz80pS80qCEvPSU5WsoqMNYnWiDWNja2N1lPJLS3Iy80CisbUAY2BgYKhWKqksSFWyUipILEpML0osyFDSUSpJrShRslIKSS0uUQh2CVFITkzOSNVTqgUA';
	const WRONG_PROCESSOR_TYPE_SDT_PACK_BASE64 = 'iVNEVA0KGgoBAQAAGAAAAHMAAABGAAAAAAAAADMAAAAAAAAAAQAAAB3MsQ6DIBQF0H+5szYXFRXW/kKnbojP2KUQwCaN4d8bm5z5nIgpeMk5JNgT5RsFFhKPBQ0+kvIrvGFVbbC6IvckrsgKi47d2FK1VA/S/t1IPtEghyN5ubbd5f3a9KBn0+t+UjSaflimbZs4d8aNZD+i1h+rVipITE8tVrKKrlbKTFGyUiowVNJRyklMSs1RslICsZPz80pS80qCEvPSU5WsoqMNYnWiDWNja2N1lPJLS3Iy80CisbUAY2BgYKhWKqksSFWyUipILEpML0osyFDSUSpJrShRslIKSS0uUQh2CVFITkzOSNVTqgUA';

	it("should return a valid cached pack", async function () {
		let item = await importFileAttachment('test.pdf');
		await writeTestSDTCache(item);

		let result = await getValidPack(item);

		assert.equal(result.packVersion, 1);
		assert.equal(result.schemaMajorVersion, 1);
		assertPackMagic(result);
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
			assert.equal(result.schemaMajorVersion, 1);
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
		let result = await getValidPack(item);
		assert.isTrue(await OS.File.exists(cachePath));
		assertPackMagic(result);

		// getReader() should return a parsed pack from the cache without
		// re-extracting
		let reader = await Zotero.SDT.getReader(item.id);
		assert.isOk(reader);
		let metadata = await reader.getMetadata();
		assert.equal(metadata.source.hash, TEST_PDF_HASH);
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

	async function getValidPack(item) {
		let result = await Zotero.SDT.getPack(item.id);
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
		bytes[9] = 2;
		return bytes;
	}

	function getTestSDTPackBytes() {
		return decodeBase64Bytes(TEST_SDT_PACK_BASE64);
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
