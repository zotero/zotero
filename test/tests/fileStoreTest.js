"use strict";

describe("Zotero.FileStore", function () {
	var FS;
	var codes;
	var root;

	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");

	before(async function () {
		FS = Zotero.FileStore.ChangeSet;
		codes = Zotero.FileStore.errorCodes;
		root = PathUtils.join(await getTempDirectory(), "fileStoreTest-" + Zotero.Utilities.randomString());
		await FileIO.makeDirectory(root);
	});

	after(async function () {
		await FileIO.remove(root, { recursive: true, ignoreAbsent: true });
	});

	// The store's join takes nested segments, which PathUtils.join refuses
	function under(name) {
		return Zotero.FileStore.path.join(root, name);
	}

	async function ok(promise) {
		let res = await promise;
		assert.isTrue(res.success, res.error && `${res.error.code}: ${res.error.message}`);
		return res.result;
	}

	async function failing(promise, code) {
		let res = await promise;
		assert.isFalse(res.success, "expected the call to fail");
		assert.equal(res.error.code, code, res.error.message);
		return res.error;
	}

	function sameBytes(a, b) {
		if (a.byteLength !== b.byteLength) {
			return false;
		}
		for (let i = 0; i < a.byteLength; i++) {
			if (a[i] !== b[i]) {
				return false;
			}
		}
		return true;
	}

	describe("files", function () {
		it("should write, stat and read a file, replacing it in place", async function () {
			let path = under("plain.txt");
			let made = await ok(Zotero.FileStore.commit(FS.file(path).writeFile("first")));
			assert.equal(made.objects[0].type, "file");
			assert.equal(made.objects[0].path, Zotero.File.normalizeToUnix(path));
			let stat = await ok(Zotero.FileStore.query("stat", { path }));
			assert.equal(stat.type, "file");
			assert.equal(stat.size, 5);
			assert.equal(stat.revision, made.objects[0].revision);

			let again = await ok(Zotero.FileStore.commit(FS.file(path).writeFile("second, longer"), { snapshots: true }));
			assert.notEqual(again.objects[0].revision, stat.revision);
			assert.equal(again.objects[0].snapshot.size, 14);
			let read = await ok(Zotero.FileStore.query("readFile", { path, encoding: "utf8" }));
			assert.equal(read.data, "second, longer");
			// A byte range, as bytes or decoded
			let range = await ok(Zotero.FileStore.query("readFile", { path, offset: 8, length: 6, encoding: "utf8" }));
			assert.equal(range.data, "longer");
			let tail = await ok(Zotero.FileStore.query("readFile", { path, offset: 8 }));
			assert.equal(tail.data.byteLength, 6);
			await failing(Zotero.FileStore.query("readFile", { path, offset: -1 }), codes.INVALID_PARAMS);
			// The sibling temp file of the atomic write is gone
			let listing = await ok(Zotero.FileStore.query("readDir", { path: root }));
			assert.notInclude(listing.entries.map(name => name.endsWith(".tmp")), true);
		});

		it("should refuse overwrite: false on an existing file and a stale revision", async function () {
			let path = under("guarded.txt");
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile("v1", { overwrite: false, flush: true })));
			assert.equal(await FileIO.readUTF8(path), "v1");
			// The OS refuses it, as the write applies
			await failing(Zotero.FileStore.commit(FS.file(path).writeFile("v2", { overwrite: false })), codes.NOT_ALLOWED);
			assert.equal(await FileIO.readUTF8(path), "v1");

			let snapshot = await ok(Zotero.FileStore.query("stat", { path }));
			await FileIO.writeUTF8(path, "changed behind the store's back");
			let error = await failing(Zotero.FileStore.commit(FS.file(snapshot).writeFile("too late")), codes.CONFLICT);
			assert.lengthOf(error.data.conflicts, 1);
			assert.equal(await FileIO.readUTF8(path), "changed behind the store's back");
		});

		it("should append, truncate and carry bytes as bytes", async function () {
			let path = under("bytes.bin");
			let bytes = new Uint8Array([0, 1, 254, 255, 10, 13]);
			let editor = FS.file(path).writeFile(bytes);
			// The builder copied the bytes on the way in
			bytes[0] = 99;
			await ok(Zotero.FileStore.commit(editor));
			assert.deepEqual(Array.from(await FileIO.read(path)), [0, 1, 254, 255, 10, 13]);

			await ok(Zotero.FileStore.commit(FS.file(path).appendFile(new Uint8Array([42]))));
			let read = await ok(Zotero.FileStore.query("readFile", { path }));
			// From another realm for a chrome caller, so not an instance of this window's Uint8Array
			assert.isTrue(ArrayBuffer.isView(read.data));
			assert.deepEqual(Array.from(read.data), [0, 1, 254, 255, 10, 13, 42]);
			let base64 = await ok(Zotero.FileStore.query("readFile", { path, encoding: "base64" }));
			assert.deepEqual(Array.from(Uint8Array.fromBase64(base64.data)), [0, 1, 254, 255, 10, 13, 42]);

			await ok(Zotero.FileStore.commit(FS.file(path).truncate(2)));
			assert.deepEqual(Array.from(await FileIO.read(path)), [0, 1]);
			// Beyond the size, Node zero-pads
			await ok(Zotero.FileStore.commit(FS.file(path).truncate(4)));
			assert.deepEqual(Array.from(await FileIO.read(path)), [0, 1, 0, 0]);

			// Any view writes its bytes; a base64 string decodes; malformed base64 fails before any write
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile(new Float32Array([1]).subarray(0, 1))));
			assert.deepEqual(Array.from(await FileIO.read(path)), [0, 0, 128, 63]);
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile("AQI=", { encoding: "base64" })));
			assert.deepEqual(Array.from(await FileIO.read(path)), [1, 2]);
			await failing(Zotero.FileStore.commit(FS.file(path).writeFile("not base64!", { encoding: "base64" })), codes.INVALID_PARAMS);
			assert.deepEqual(Array.from(await FileIO.read(path)), [1, 2]);
		});

		// Content far past any 32K chunk boundary, where a chunked encoder would drop or repeat a piece
		it("should carry large content intact", async function () {
			let path = under("large.bin");
			let text = "中文 mixed ünïcödé 🚀 line\n".repeat(80000);
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile(text)));
			let read = await ok(Zotero.FileStore.query("readFile", { path, encoding: "utf8" }));
			assert.equal(read.data.length, text.length);
			assert.equal(read.data, text);
			let encoded = await ok(Zotero.FileStore.query("readFile", { path }));
			assert.equal(encoded.data.byteLength, new TextEncoder().encode(text).byteLength);

			let big = new Uint8Array(16 * 1024 * 1024);
			for (let i = 0; i < big.length; i++) {
				big[i] = (i * 2654435761) >>> 24;
			}
			// A view over part of a buffer carries only its own bytes
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile(big).appendFile(big.subarray(0, 1024))));
			let back = await ok(Zotero.FileStore.query("readFile", { path }));
			assert.equal(back.data.byteLength, big.byteLength + 1024);
			assert.isTrue(sameBytes(back.data.subarray(0, big.byteLength), big));
			assert.isTrue(sameBytes(back.data.subarray(big.byteLength), big.subarray(0, 1024)));
		});

		it("should rename and copy, refusing an existing destination unless overwrite", async function () {
			let src = under("move-me.txt");
			let dest = under("moved.txt");
			let copy = under("copied.txt");
			await FileIO.writeUTF8(dest, "in the way");
			await ok(Zotero.FileStore.commit(FS.file(src).writeFile("payload")));
			await failing(Zotero.FileStore.commit(FS.file(src).rename(dest)), codes.NOT_ALLOWED);
			assert.isTrue(await FileIO.exists(src));
			// Onto itself, even with overwrite, and into its own directory, which lands on itself
			await failing(Zotero.FileStore.commit(FS.file(src).copyFile(src, { overwrite: true })), codes.INVALID_PARAMS);
			await failing(Zotero.FileStore.commit(FS.file(src).rename(src, { overwrite: true })), codes.INVALID_PARAMS);
			await failing(Zotero.FileStore.commit(FS.file(src).copyFile(root, { overwrite: true })), codes.INVALID_PARAMS);
			assert.equal(await FileIO.readUTF8(src), "payload");

			// Later operations and the result follow the rename
			let result = await ok(Zotero.FileStore.commit(
				FS.file(src).rename(dest, { overwrite: true }).copyFile(copy)));
			assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(dest));
			assert.isFalse(await FileIO.exists(src));
			assert.equal(await FileIO.readUTF8(dest), "payload");
			assert.equal(await FileIO.readUTF8(copy), "payload");
		});

		// As cp and mv have it
		it("should put a file in a directory found where it is copied or moved", async function () {
			let src = under("into-src.txt");
			let folder = under("into-folder");
			let landed = Zotero.FileStore.path.join(folder, "into-src.txt");
			await FileIO.makeDirectory(folder);
			await ok(Zotero.FileStore.commit(FS.file(src).writeFile("into")));
			await ok(Zotero.FileStore.commit(FS.file(src).copyFile(folder)));
			assert.equal(await FileIO.readUTF8(landed), "into");
			// The copy now there is an existing file like any other
			await failing(Zotero.FileStore.commit(FS.file(src).copyFile(folder)), codes.NOT_ALLOWED);

			// Later operations and the result follow the file to where it landed
			let result = await ok(Zotero.FileStore.commit(FS.file(src).rename(folder, { overwrite: true }).appendFile("!")));
			assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(landed));
			assert.equal(await FileIO.readUTF8(landed), "into!");
			assert.isFalse(await FileIO.exists(src));

			// A directory under the file's name inside is not taken for the file
			let other = under("into-other.txt");
			await ok(Zotero.FileStore.commit(FS.file(other).writeFile("o")));
			await FileIO.makeDirectory(Zotero.FileStore.path.join(folder, "into-other.txt"));
			await failing(Zotero.FileStore.commit(FS.file(other).copyFile(folder)), codes.NOT_ALLOWED);
		});

		it("should tell a file from its other spellings", async function () {
			let upper = under("Spelling.txt");
			let lower = under("spelling.txt");
			await ok(Zotero.FileStore.commit(FS.file(upper).writeFile("payload")));
			// On a case-sensitive file system another spelling is simply another file
			if (!(await FileIO.exists(lower))) {
				await ok(Zotero.FileStore.commit(FS.file(upper).copyFile(lower)));
				assert.equal(await FileIO.readUTF8(lower), "payload");
				return;
			}
			await failing(Zotero.FileStore.commit(FS.file(upper).copyFile(lower, { overwrite: true })), codes.INVALID_PARAMS);
			assert.equal(await FileIO.readUTF8(upper), "payload");
			// A rename may recase
			let result = await ok(Zotero.FileStore.commit(FS.file(upper).rename(lower)));
			assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(lower));
			let listing = await ok(Zotero.FileStore.query("readDir", { path: root }));
			assert.include(listing.entries, "spelling.txt");
			assert.notInclude(listing.entries, "Spelling.txt");
			assert.equal(await FileIO.readUTF8(lower), "payload");
		});

		// The file system's own answer is simulated, so this runs the same on every OS and volume
		it("should treat another spelling as one file where the file system does", async function () {
			let upper = under("Simulated.txt");
			let lower = under("simulated.txt");
			let alias = under("alias-of-simulated.txt");
			await ok(Zotero.FileStore.commit(FS.file(upper).writeFile("payload")));
			let stub = sinon.stub(Zotero.FileStore._fileStore, "_realPath").callsFake(
				p => p.replace(/alias-of-simulated\.txt$/, "simulated.txt").toLowerCase());
			try {
				await failing(Zotero.FileStore.commit(FS.file(upper).copyFile(lower, { overwrite: true })), codes.INVALID_PARAMS);
				await failing(Zotero.FileStore.commit(FS.file(upper).copyFile(alias, { overwrite: true })), codes.INVALID_PARAMS);
				await failing(Zotero.FileStore.commit(FS.file(upper).rename(alias, { overwrite: true })), codes.INVALID_PARAMS);
				assert.equal(await FileIO.readUTF8(upper), "payload");
				let result = await ok(Zotero.FileStore.commit(FS.file(upper).rename(lower)));
				assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(lower));
				let listing = await ok(Zotero.FileStore.query("readDir", { path: root }));
				assert.include(listing.entries, "simulated.txt");
				assert.notInclude(listing.entries, "Simulated.txt");
				assert.equal(await FileIO.readUTF8(lower), "payload");
			}
			finally {
				stub.restore();
			}
		});

		it("should write a name of the longest legal length", async function () {
			// Windows caps the whole path at 260 unless long paths are enabled, so the name shrinks to fit there
			let max = Zotero.isWin ? Math.min(255, 259 - root.length - 1) : 255;
			let path = under("n".repeat(max - 4) + ".txt");
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile("long")));
			assert.equal(await FileIO.readUTF8(path), "long");
			await ok(Zotero.FileStore.commit(FS.file(path).rm()));
		});

		it("should remove a file, and tolerate an absent one only with force", async function () {
			let path = under("gone.txt");
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile("x")));
			let result = await ok(Zotero.FileStore.commit(FS.file(path).rm()));
			assert.isTrue(result.objects[0].erased);
			assert.isFalse(await FileIO.exists(path));
			await failing(Zotero.FileStore.commit(FS.file(path).rm()), codes.NOT_FOUND);
			await ok(Zotero.FileStore.commit(FS.file(path).rm({ force: true })));
			// A file's rm leaves a directory alone, where IOUtils would remove an empty one
			let dir = under("not-a-file");
			await FileIO.makeDirectory(dir);
			await failing(Zotero.FileStore.commit(FS.file(dir).rm()), codes.NOT_FOUND);
			assert.isTrue(await FileIO.exists(dir));
			let exists = await ok(Zotero.FileStore.query("exists", { path }));
			assert.isFalse(exists.exists);
		});
	});

	describe("directories", function () {
		it("should create, list, rename, copy and remove directories", async function () {
			let dir = under("tree/nested/deep");
			await failing(Zotero.FileStore.commit(FS.directory(dir).makeDir()), codes.NOT_FOUND);
			await ok(Zotero.FileStore.commit(FS.of(
				FS.directory(dir).makeDir({ recursive: true }),
				FS.file(Zotero.FileStore.path.join(dir, "a.txt")).writeFile("a"),
				FS.directory(Zotero.FileStore.path.join(dir, "sub")).makeDir()
			)));
			let listing = await ok(Zotero.FileStore.query("readDir", { path: dir, withFileTypes: true }));
			assert.sameDeepMembers(listing.entries, [{ name: "a.txt", type: "file" }, { name: "sub", type: "directory" }]);

			let moved = under("tree/moved");
			let copied = under("tree/copied");
			await ok(Zotero.FileStore.commit(FS.directory(dir).rename(moved).cp(copied)));
			assert.isFalse(await FileIO.exists(dir));
			assert.equal(await FileIO.readUTF8(Zotero.FileStore.path.join(copied, "a.txt")), "a");

			// An existing destination is refused, or replaced as a whole with overwrite
			await FileIO.writeUTF8(Zotero.FileStore.path.join(copied, "extra.txt"), "stale");
			await failing(Zotero.FileStore.commit(FS.directory(moved).cp(copied)), codes.NOT_ALLOWED);
			assert.isFalse(await FileIO.exists(Zotero.FileStore.path.join(copied, "moved")), "IOUtils would copy into it");
			await ok(Zotero.FileStore.commit(FS.directory(moved).cp(copied, { overwrite: true })));
			assert.isFalse(await FileIO.exists(Zotero.FileStore.path.join(copied, "extra.txt")));
			assert.equal(await FileIO.readUTF8(Zotero.FileStore.path.join(copied, "a.txt")), "a");
			assert.notInclude((await ok(Zotero.FileStore.query("readDir", { path: under("tree") }))).entries.map(name => name.endsWith(".tmp")), true);

			// Onto or into itself, as Node refuses too
			await failing(Zotero.FileStore.commit(FS.directory(moved).cp(Zotero.FileStore.path.join(moved, "inner"), { overwrite: true })), codes.INVALID_PARAMS);
			await failing(Zotero.FileStore.commit(FS.directory(moved).rename(`${moved}/`)), codes.INVALID_PARAMS);
			assert.isFalse(await FileIO.exists(Zotero.FileStore.path.join(moved, "inner")));

			// Without recursive, the OS refuses a directory with anything in it, and an empty one goes
			await failing(Zotero.FileStore.commit(FS.directory(moved).rm()), codes.NOT_ALLOWED);
			let empty = under("tree/empty");
			await FileIO.makeDirectory(empty);
			await ok(Zotero.FileStore.commit(FS.directory(empty).rm()));
			assert.isFalse(await FileIO.exists(empty));
			await ok(Zotero.FileStore.commit(FS.directory(moved).rm({ recursive: true })));
			await ok(Zotero.FileStore.commit(FS.directory(Zotero.FileStore.path.join(copied, "sub")).rm({ recursive: true })));
			assert.isFalse(await FileIO.exists(moved));
		});

		it("should refuse an existing directory to makeDir without recursive", async function () {
			let dir = under("exists");
			await ok(Zotero.FileStore.commit(FS.directory(dir).makeDir()));
			await failing(Zotero.FileStore.commit(FS.directory(dir).makeDir()), codes.NOT_ALLOWED);
			await ok(Zotero.FileStore.commit(FS.directory(dir).makeDir({ recursive: true })));
		});
	});

	describe("addressing and errors", function () {
		it("should digest a file", async function () {
			let path = under("digest.txt");
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile("digest me")));
			let bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("digest me")));
			let expected = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
			let { algorithm, digest } = await ok(Zotero.FileStore.query("digest", { path }));
			assert.equal(algorithm, "sha256");
			assert.equal(digest, expected);
			let sha512 = await ok(Zotero.FileStore.query("digest", { path, algorithm: "sha512" }));
			assert.lengthOf(sha512.digest, 128);
			await failing(Zotero.FileStore.query("digest", { path, algorithm: "md5" }), codes.INVALID_PARAMS);
			await failing(Zotero.FileStore.query("digest", { path: root }), codes.NOT_FOUND);
		});

		it("should report NotFound for a missing path and for the wrong kind", async function () {
			let dir = under("kinds");
			await ok(Zotero.FileStore.commit(FS.directory(dir).makeDir()));
			await failing(Zotero.FileStore.query("readFile", { path: under("nope.txt") }), codes.NOT_FOUND);
			await failing(Zotero.FileStore.query("stat", { path: under("nope.txt") }), codes.NOT_FOUND);
			// The other kind is NotFound for a query as for a commit
			await failing(Zotero.FileStore.commit(FS.file(dir).writeFile("x")), codes.NOT_FOUND);
			await failing(Zotero.FileStore.query("readFile", { path: dir }), codes.NOT_FOUND);
			await failing(Zotero.FileStore.query("readDir", { path: under("plain.txt") }), codes.NOT_FOUND);
			// An OS refusal is NotAllowed with the platform's reason, not a bug of ours; Windows says NotFound instead
			await failing(Zotero.FileStore.query("stat", { path: under("z".repeat(300)) }),
				Zotero.isWin ? codes.NOT_FOUND : codes.NOT_ALLOWED);
		});

		it("should refuse a relative path and an unknown encoding", async function () {
			await failing(Zotero.FileStore.query("readFile", { path: "relative.txt" }), codes.INVALID_PARAMS);
			await failing(Zotero.FileStore.query("readFile", { path: under("plain.txt"), encoding: "latin1" }), codes.INVALID_PARAMS);
			await failing(Zotero.FileStore.commit({ type: "file", path: "relative.txt", ops: [{ op: "rm" }] }), codes.INVALID_PARAMS);
			assert.throws(() => FS.file("relative.txt"), /absolute/);
		});

		it("should refuse an operation after a terminal one", async function () {
			let path = under("after-rm.txt");
			assert.throws(() => FS.file(path).rm().writeFile("x"), /No operation can follow/);
			let changes = FS.of(FS.file(path).rm()).toJSON();
			changes.changes[0].ops.push({ op: "writeFile", data: "x" });
			await failing(Zotero.FileStore.commit(changes), codes.INVALID_PARAMS);
		});

		it("should apply in order and say what a failed set left behind", async function () {
			let first = under("ordered-1.txt");
			let second = under("ordered-2.txt");
			// What the request alone decides is refused before anything is written
			let error = await failing(Zotero.FileStore.commit(FS.of(
				FS.file(first).writeFile("first"),
				FS.file(second).writeFile("%%%", { encoding: "base64" })
			)), codes.INVALID_PARAMS);
			assert.isUndefined(error.data && error.data.applied);
			assert.isFalse(await FileIO.exists(first));

			// What the file system decides fails as it applies, after the entries before it: the report says so
			error = await failing(Zotero.FileStore.commit(FS.of(
				FS.file(first).writeFile("first"),
				FS.directory(under("no-such-dir/child")).makeDir()
			)), codes.NOT_FOUND);
			// The OS's refusal is located like the store's own
			assert.match(error.message, /^changes\[1\]\.ops\[0\] \(directory\.makeDir\): /);
			assert.lengthOf(error.data.applied, 1);
			assert.equal(error.data.applied[0].id, Zotero.File.normalizeToUnix(first));
			assert.equal(error.data.failed.index, 1);
			assert.lengthOf(error.data.pending, 0);
			assert.equal(await FileIO.readUTF8(first), "first");
			assert.isFalse(await FileIO.exists(second));
		});

		// Operations apply in order, so a later operation of an entry may rely on an earlier one
		it("should let a write precede a rename in one entry", async function () {
			let written = under("write-then-move.txt");
			let moved = under("write-then-move-done.txt");
			let result = await ok(Zotero.FileStore.commit(FS.file(written).writeFile("payload").rename(moved)));
			assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(moved));
			assert.isFalse(await FileIO.exists(written));
			assert.equal(await FileIO.readUTF8(moved), "payload");
		});

		// Merged into the first editor, the copy ran before the second write and b ended up "B"
		it("should keep a path edited again after another in its place", async function () {
			let a = under("again-a.txt");
			let b = under("again-b.txt");
			let set = FS.of(FS.file(a).writeFile("A"), FS.file(b).writeFile("B"), FS.file(a).copyFile(b, { overwrite: true }));
			assert.equal(set.size, 3);
			let { objects } = await ok(Zotero.FileStore.commit(set));
			assert.lengthOf(objects, 3);
			assert.equal(await FileIO.readUTF8(b), "A");

			// Without overwrite, the destination an earlier entry wrote refuses the copy as it applies
			let c = under("again-c.txt");
			let d = under("again-d.txt");
			let error = await failing(Zotero.FileStore.commit(
				FS.of(FS.file(c).writeFile("c"), FS.file(d).writeFile("d"), FS.file(c).copyFile(d))
			), codes.NOT_ALLOWED);
			assert.include(error.message, "again-d.txt");
			assert.lengthOf(error.data.applied, 2);
			assert.equal(error.data.failed.index, 2);
			assert.equal(await FileIO.readUTF8(d), "d");
		});

		// Each operation meets the paths as the entries before it left them
		it("should let a later entry use a path an earlier one creates", async function () {
			let src = under("later-src.txt");
			let other = under("later-other.txt");
			let copy = under("later-copy.txt");
			await ok(Zotero.FileStore.commit(FS.of(
				FS.file(src).writeFile("abc"),
				FS.file(other).writeFile("x"),
				FS.file(src).copyFile(copy),
				FS.file(other).rm(),
				FS.file(copy).truncate(1)
			)));
			assert.equal(await FileIO.readUTF8(copy), "a");
			assert.isFalse(await FileIO.exists(other));
		});

		it("should remove a path and write it again later in the set", async function () {
			let path = under("rewritten.txt");
			await ok(Zotero.FileStore.commit(FS.file(path).writeFile("old")));
			await ok(Zotero.FileStore.commit(FS.of(
				FS.file(path).rm(),
				FS.file(under("rewritten-between.txt")).writeFile("x"),
				FS.file(path).writeFile("new")
			)));
			assert.equal(await FileIO.readUTF8(path), "new");
		});

		it("should validate a set without writing", async function () {
			let path = under("validated.txt");
			let result = await ok(Zotero.FileStore.query("validate", {
				changes: FS.of(FS.file(path).writeFile("x"), FS.file(path).rename(path)).toJSON(),
			}));
			assert.lengthOf(result.issues, 1);
			assert.equal(result.issues[0].code, codes.INVALID_PARAMS);
			assert.include(result.issues[0].message, "is the source itself");
			assert.isFalse(await FileIO.exists(path));
		});

		it("should answer dirs with nothing for a chrome caller", async function () {
			let dirs = await ok(Zotero.FileStore.query("dirs"));
			assert.isNull(dirs.data);
			assert.isNull(dirs.temp);
		});
	});

	describe("builder", function () {
		// The builder runs apart from the store's config, in chrome and in each sandbox, so only this keeps them in step
		it("should cover every object type and operation the store defines", function () {
			let types = Zotero.FileStore._fileStore._objectTypes;
			for (let [type, operations] of Object.entries(Zotero.FileStore.operationNames)) {
				let editor = FS[type](under("coverage"));
				for (let op of operations) {
					assert.isFunction(editor[op], `${type}.${op}`);
				}
				let terminal = operations.filter(op => types.get(type).operations[op].terminal);
				assert.sameMembers([...editor.constructor.TERMINAL_OPS], terminal, `${type} terminal operations`);
			}
		});

		it("should round-trip a set through JSON and merge editors of one path", function () {
			let path = under("json.txt");
			let set = FS.of(FS.file(path).writeFile("a"), FS.file(path).appendFile(new Uint8Array([1, 2])));
			assert.equal(set.size, 1);
			let json = set.toJSON();
			assert.deepEqual(json.changes[0].ops, [
				{ op: "writeFile", data: "a" },
				{ op: "appendFile", data: btoa("\x01\x02"), encoding: "base64" },
			]);
			assert.deepEqual(FS.from(json).toJSON(), json);
			// The store's form keeps the bytes
			let plain = set.toPlain();
			assert.deepEqual(Array.from(plain.changes[0].ops[1].data), [1, 2]);
			assert.notProperty(plain.changes[0].ops[1], "encoding");
		});

		it("should refuse a revision on nothing and a bad encoding", function () {
			assert.throws(() => FS.file(under("x")).writeFile("x", { encoding: "latin1" }), /encoding/);
			assert.throws(() => FS.file(under("x")).expect(""), /revision/);
		});

		// The core normalizer with the platform it asks about answered as Windows, plus the module's own alias
		// fold, so this runs on any OS without touching core
		it("should normalize Windows path shapes by the Windows rules", function () {
			let appinfo = Object.getOwnPropertyDescriptor(Services, "appinfo");
			let wasWin = Zotero.isWin;
			try {
				Object.defineProperty(Services, "appinfo", {
					value: new Proxy(Services.appinfo, { get: (target, key) => (key === "OS" ? "WINNT" : Reflect.get(target, key)) }),
					configurable: true,
				});
			}
			catch {
				if (!Zotero.isWin) {
					this.skip();
				}
			}
			try {
				Zotero.isWin = true;
				let win = p => Zotero.FileStore.path.normalize(p);
				assert.equal(win("C:\\a\\..\\b"), "C:/b");
				assert.equal(win("C:/a/./b//c/"), "C:/a/b/c");
				assert.equal(win("C:\\"), "C:/");
				assert.equal(win("C:"), "C:/");
				assert.equal(win("Z:\\mapped\\x\\..\\y"), "Z:/mapped/y");
				assert.equal(win("\\\\server\\share\\a\\..\\b"), "//server/share/b");
				assert.equal(win("\\\\wsl$\\Ubuntu\\home\\u\\..\\x"), "//wsl$/Ubuntu/home/x");
				assert.equal(win("//wsl.localhost/Ubuntu/home/u/../x"), "//wsl.localhost/Ubuntu/home/x");
				// Win32's own aliases of a path fold into its one spelling
				assert.equal(win("\\\\?\\C:\\long\\path\\..\\x"), "C:/long/x");
				assert.equal(win("\\\\.\\C:\\x"), "C:/x");
				assert.equal(win("\\\\?\\UNC\\server\\share\\x"), "//server/share/x");
				assert.throws(() => win("C:\\a\\..\\..\\b"), /root/);
				assert.throws(() => win("\\\\server\\share\\..\\..\\x"), /root/);
			}
			finally {
				Zotero.isWin = wasWin;
				if (appinfo) {
					Object.defineProperty(Services, "appinfo", appinfo);
				}
			}
		});

		it("should offer Node's path helpers over the canonical form", function () {
			let { path } = Zotero.FileStore;
			assert.equal(path.sep, "/");
			assert.equal(path.join("a", "b/", "../c"), "a/c");
			assert.equal(path.join(), ".");
			assert.equal(path.normalize(""), ".");
			assert.equal(path.dirname("a/b"), "a");
			assert.equal(path.dirname("a"), ".");
			assert.equal(path.basename("a/b/c.tar.gz", ".gz"), "c.tar");
			assert.equal(path.extname("x/y.tar.gz"), ".gz");
			assert.equal(path.extname("a/.hidden"), "");
			assert.isFalse(path.isAbsolute("a/b"));
			assert.isFalse(path.isAbsolute(""));
			// From another realm for a chrome caller, so matched by message rather than by class
			assert.throws(() => path.dirname(5), /must be a string/);
			if (Zotero.isWin) {
				assert.equal(path.join("C:\\Users\\x", "..", "y"), "C:/Users/y");
				assert.equal(path.normalize("C:/a//b/../c/"), "C:/a/c");
				assert.equal(path.dirname("C:/a/b/c.txt"), "C:/a/b");
				assert.equal(path.dirname("C:/a"), "C:/");
				assert.equal(path.dirname("C:/"), "C:/");
				assert.equal(path.dirname("//server/share/x"), "//server/share");
				assert.equal(path.basename("C:/"), "");
				assert.isTrue(path.isAbsolute("C:\\a"));
				assert.throws(() => path.normalize("C:/.."), /root/);
			}
			else {
				assert.equal(path.join("/a/b", "../c", "./d.txt"), "/a/c/d.txt");
				assert.equal(path.normalize("/a//b/../c/"), "/a/c");
				assert.equal(path.dirname("/a/b/c.txt"), "/a/b");
				assert.equal(path.dirname("/a"), "/");
				assert.equal(path.dirname("/"), "/");
				assert.equal(path.basename("/"), "");
				assert.isTrue(path.isAbsolute("/a"));
				assert.isFalse(path.isAbsolute("C:\\a"));
				assert.throws(() => path.normalize("/.."), /root/);
			}
		});
	});
});
