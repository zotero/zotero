"use strict";

describe("Zotero.FileStore", function () {
	var plugin = usePluginSandbox();
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");
	var codes;
	var root;

	before(async function () {
		codes = Zotero.FileStore.errorCodes;
		// Inside the plugin's own data directory, which it reaches without a grant
		root = PathUtils.join(Zotero.DataDirectory.dir, "plugin-data", plugin.uuid, "fileStoreTest-" + Zotero.Utilities.randomString());
		await FileIO.makeDirectory(root, { createAncestors: true });
	});

	after(async function () {
		await FileIO.remove(root, { recursive: true, ignoreAbsent: true });
	});

	beforeEach(function () {
		load();
	});

	// The plugin with these permissions, and FS as its shorthand for its own builder
	function load(permissions = ["default", "fileSystemRead", "fileSystemWrite"]) {
		plugin.load(permissions);
		plugin.eval("var FS = Zotero.FileStore.ChangeSet;");
	}

	// The store's join takes nested segments, which PathUtils.join refuses
	function under(name) {
		return Zotero.FileStore.path.join(root, name);
	}

	function query(name, params) {
		return plugin.run((name, params) => Zotero.FileStore.query(name, params), name, params);
	}

	// Commit the change set `build` makes in the plugin, called there with these args
	function commit(build, ...args) {
		return plugin.run(`(...args) => Zotero.FileStore.commit((${build})(...args))`, ...args);
	}

	describe("files", function () {
		it("should write, stat and read a file, replacing it in place", async function () {
			let path = under("plain.txt");
			let made = await requestResult(commit(path => FS.file(path).writeFile("first"), path));
			assert.equal(made.objects[0].type, "file");
			assert.equal(made.objects[0].path, Zotero.File.normalizeToUnix(path));
			let stat = await requestResult(query("stat", { path }));
			assert.equal(stat.type, "file");
			assert.equal(stat.size, 5);
			assert.equal(stat.revision, made.objects[0].revision);

			let again = await requestResult(plugin.run(
				path => Zotero.FileStore.commit(FS.file(path).writeFile("second, longer"), { snapshots: true }), path));
			assert.notEqual(again.objects[0].revision, stat.revision);
			assert.equal(again.objects[0].snapshot.size, 14);
			let read = await requestResult(query("readFile", { path, encoding: "utf8" }));
			assert.equal(read.data, "second, longer");
			// A byte range, as bytes or decoded
			let range = await requestResult(query("readFile", { path, offset: 8, length: 6, encoding: "utf8" }));
			assert.equal(range.data, "longer");
			let tail = await requestResult(query("readFile", { path, offset: 8 }));
			assert.equal(tail.data.byteLength, 6);
			await requestError(query("readFile", { path, offset: -1 }), codes.INVALID_PARAMS);
			// The sibling temp file of the atomic write is gone
			let listing = await requestResult(query("readDir", { path: root }));
			assert.notInclude(listing.entries.map(name => name.endsWith(".tmp")), true);
		});

		it("should refuse overwrite: false on an existing file and a stale revision", async function () {
			let path = under("guarded.txt");
			await requestResult(commit(path => FS.file(path).writeFile("v1", { overwrite: false, flush: true }), path));
			assert.equal(await FileIO.readUTF8(path), "v1");
			// The OS refuses it, as the write applies
			await requestError(commit(path => FS.file(path).writeFile("v2", { overwrite: false }), path), codes.NOT_ALLOWED);
			assert.equal(await FileIO.readUTF8(path), "v1");

			let snapshot = await requestResult(query("stat", { path }));
			await FileIO.writeUTF8(path, "changed behind the store's back");
			let error = await requestError(commit(snapshot => FS.file(snapshot).writeFile("too late"), snapshot), codes.CONFLICT);
			assert.lengthOf(error.data.conflicts, 1);
			assert.equal(await FileIO.readUTF8(path), "changed behind the store's back");
		});

		it("should append, truncate and carry bytes as bytes", async function () {
			let path = under("bytes.bin");
			await requestResult(plugin.run((path) => {
				let bytes = new Uint8Array([0, 1, 254, 255, 10, 13]);
				let editor = FS.file(path).writeFile(bytes);
				// The builder copied the bytes on the way in
				bytes[0] = 99;
				return Zotero.FileStore.commit(editor);
			}, path));
			assert.deepEqual(Array.from(await FileIO.read(path)), [0, 1, 254, 255, 10, 13]);

			await requestResult(commit(path => FS.file(path).appendFile(new Uint8Array([42])), path));
			let read = await plugin.run(async (path) => {
				let { result: { data } } = await Zotero.FileStore.query("readFile", { path });
				return { isBytes: data instanceof Uint8Array, bytes: Array.from(data) };
			}, path);
			assert.isTrue(read.isBytes, "the plugin gets a Uint8Array of its own realm");
			assert.deepEqual(read.bytes, [0, 1, 254, 255, 10, 13, 42]);
			let base64 = await requestResult(query("readFile", { path, encoding: "base64" }));
			assert.deepEqual(Array.from(Uint8Array.fromBase64(base64.data)), [0, 1, 254, 255, 10, 13, 42]);

			await requestResult(commit(path => FS.file(path).truncate(2), path));
			assert.deepEqual(Array.from(await FileIO.read(path)), [0, 1]);
			// Beyond the size, Node zero-pads
			await requestResult(commit(path => FS.file(path).truncate(4), path));
			assert.deepEqual(Array.from(await FileIO.read(path)), [0, 1, 0, 0]);

			// Any view writes its bytes; a base64 string decodes; malformed base64 fails before any write
			await requestResult(commit(path => FS.file(path).writeFile(new Float32Array([1]).subarray(0, 1)), path));
			assert.deepEqual(Array.from(await FileIO.read(path)), [0, 0, 128, 63]);
			await requestResult(commit(path => FS.file(path).writeFile("AQI=", { encoding: "base64" }), path));
			assert.deepEqual(Array.from(await FileIO.read(path)), [1, 2]);
			await requestError(commit(path => FS.file(path).writeFile("not base64!", { encoding: "base64" }), path),
				codes.INVALID_PARAMS);
			assert.deepEqual(Array.from(await FileIO.read(path)), [1, 2]);
			// A JSON-style entry carries a typed array of any kind too
			await requestResult(plugin.run(path => Zotero.FileStore.commit({
				changes: [{ type: "file", path, ops: [{ op: "appendFile", data: new Uint16Array([0x0201]) }] }],
			}), path));
			assert.deepEqual(Array.from(await FileIO.read(path)), [1, 2, 1, 2]);
		});

		// Content far past any 32K chunk boundary, where a chunked encoder would drop or repeat a piece
		it("should carry large content intact", async function () {
			let path = under("large.bin");
			let line = "中文 mixed ünïcödé 🚀 line\n";
			let carried = await plugin.run(async (path, line) => {
				let text = line.repeat(80000);
				await Zotero.FileStore.commit(FS.file(path).writeFile(text));
				let read = await Zotero.FileStore.query("readFile", { path, encoding: "utf8" });
				let encoded = await Zotero.FileStore.query("readFile", { path });

				let big = new Uint8Array(16 * 1024 * 1024);
				for (let i = 0; i < big.length; i++) {
					big[i] = (i * 2654435761) >>> 24;
				}
				// A view over part of a buffer carries only its own bytes
				await Zotero.FileStore.commit(FS.file(path).writeFile(big).appendFile(big.subarray(0, 1024)));
				let back = (await Zotero.FileStore.query("readFile", { path })).result.data;
				let same = (a, b) => a.length === b.length && a.every((byte, i) => byte === b[i]);
				return {
					textIntact: read.result.data === text,
					encodedLength: encoded.result.data.byteLength,
					byteLength: back.byteLength,
					bytesIntact: same(back.subarray(0, big.length), big) && same(back.subarray(big.length), big.subarray(0, 1024)),
				};
			}, path, line);
			assert.isTrue(carried.textIntact);
			assert.equal(carried.encodedLength, new TextEncoder().encode(line.repeat(80000)).byteLength);
			assert.equal(carried.byteLength, 16 * 1024 * 1024 + 1024);
			assert.isTrue(carried.bytesIntact);
		});

		it("should rename and copy, refusing an existing destination unless overwrite", async function () {
			let src = under("move-me.txt");
			let dest = under("moved.txt");
			let copy = under("copied.txt");
			await FileIO.writeUTF8(dest, "in the way");
			await requestResult(commit(src => FS.file(src).writeFile("payload"), src));
			await requestError(commit((src, dest) => FS.file(src).rename(dest), src, dest), codes.NOT_ALLOWED);
			assert.isTrue(await FileIO.exists(src));
			// Onto itself, even with overwrite, and into its own directory, which lands on itself
			await requestError(commit(src => FS.file(src).copyFile(src, { overwrite: true }), src), codes.INVALID_PARAMS);
			await requestError(commit(src => FS.file(src).rename(src, { overwrite: true }), src), codes.INVALID_PARAMS);
			await requestError(commit((src, root) => FS.file(src).copyFile(root, { overwrite: true }), src, root),
				codes.INVALID_PARAMS);
			assert.equal(await FileIO.readUTF8(src), "payload");

			// Later operations and the result follow the rename
			let result = await requestResult(commit(
				(src, dest, copy) => FS.file(src).rename(dest, { overwrite: true }).copyFile(copy), src, dest, copy));
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
			await requestResult(commit(src => FS.file(src).writeFile("into"), src));
			await requestResult(commit((src, folder) => FS.file(src).copyFile(folder), src, folder));
			assert.equal(await FileIO.readUTF8(landed), "into");
			// The copy now there is an existing file like any other
			await requestError(commit((src, folder) => FS.file(src).copyFile(folder), src, folder), codes.NOT_ALLOWED);

			// Later operations and the result follow the file to where it landed
			let result = await requestResult(commit(
				(src, folder) => FS.file(src).rename(folder, { overwrite: true }).appendFile("!"), src, folder));
			assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(landed));
			assert.equal(await FileIO.readUTF8(landed), "into!");
			assert.isFalse(await FileIO.exists(src));

			// A directory under the file's name inside is not taken for the file
			let other = under("into-other.txt");
			await requestResult(commit(other => FS.file(other).writeFile("o"), other));
			await FileIO.makeDirectory(Zotero.FileStore.path.join(folder, "into-other.txt"));
			await requestError(commit((other, folder) => FS.file(other).copyFile(folder), other, folder), codes.NOT_ALLOWED);
		});

		it("should tell a file from its other spellings", async function () {
			let upper = under("Spelling.txt");
			let lower = under("spelling.txt");
			await requestResult(commit(upper => FS.file(upper).writeFile("payload"), upper));
			// On a case-sensitive file system another spelling is simply another file
			if (!(await FileIO.exists(lower))) {
				await requestResult(commit((upper, lower) => FS.file(upper).copyFile(lower), upper, lower));
				assert.equal(await FileIO.readUTF8(lower), "payload");
				return;
			}
			await requestError(commit((upper, lower) => FS.file(upper).copyFile(lower, { overwrite: true }), upper, lower),
				codes.INVALID_PARAMS);
			assert.equal(await FileIO.readUTF8(upper), "payload");
			// A rename may recase
			let result = await requestResult(commit((upper, lower) => FS.file(upper).rename(lower), upper, lower));
			assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(lower));
			let listing = await requestResult(query("readDir", { path: root }));
			assert.include(listing.entries, "spelling.txt");
			assert.notInclude(listing.entries, "Spelling.txt");
			assert.equal(await FileIO.readUTF8(lower), "payload");
		});

		// The file system's own answer is simulated, so this runs the same on every OS and volume
		it("should treat another spelling as one file where the file system does", async function () {
			let upper = under("Simulated.txt");
			let lower = under("simulated.txt");
			let alias = under("alias-of-simulated.txt");
			await requestResult(commit(upper => FS.file(upper).writeFile("payload"), upper));
			let stub = sinon.stub(Zotero.FileStore._fileStore, "_realPath").callsFake(
				p => p.replace(/alias-of-simulated\.txt$/, "simulated.txt").toLowerCase());
			try {
				for (let build of [
					(upper, lower) => FS.file(upper).copyFile(lower, { overwrite: true }),
					(upper, lower, alias) => FS.file(upper).copyFile(alias, { overwrite: true }),
					(upper, lower, alias) => FS.file(upper).rename(alias, { overwrite: true }),
				]) {
					await requestError(commit(build, upper, lower, alias), codes.INVALID_PARAMS);
				}
				assert.equal(await FileIO.readUTF8(upper), "payload");
				let result = await requestResult(commit((upper, lower) => FS.file(upper).rename(lower), upper, lower));
				assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(lower));
				let listing = await requestResult(query("readDir", { path: root }));
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
			await requestResult(commit(path => FS.file(path).writeFile("long"), path));
			assert.equal(await FileIO.readUTF8(path), "long");
			await requestResult(commit(path => FS.file(path).rm(), path));
		});

		it("should remove a file, and tolerate an absent one only with force", async function () {
			let path = under("gone.txt");
			await requestResult(commit(path => FS.file(path).writeFile("x"), path));
			let result = await requestResult(commit(path => FS.file(path).rm(), path));
			assert.isTrue(result.objects[0].erased);
			assert.isFalse(await FileIO.exists(path));
			await requestError(commit(path => FS.file(path).rm(), path), codes.NOT_FOUND);
			await requestResult(commit(path => FS.file(path).rm({ force: true }), path));
			// A file's rm leaves a directory alone, where IOUtils would remove an empty one
			let dir = under("not-a-file");
			await FileIO.makeDirectory(dir);
			await requestError(commit(dir => FS.file(dir).rm(), dir), codes.NOT_FOUND);
			assert.isTrue(await FileIO.exists(dir));
			let exists = await requestResult(query("exists", { path }));
			assert.isFalse(exists.exists);
		});
	});

	describe("directories", function () {
		it("should create, list, rename, copy and remove directories", async function () {
			let dir = under("tree/nested/deep");
			await requestError(commit(dir => FS.directory(dir).makeDir(), dir), codes.NOT_FOUND);
			await requestResult(commit(dir => FS.of(
				FS.directory(dir).makeDir({ recursive: true }),
				FS.file(Zotero.FileStore.path.join(dir, "a.txt")).writeFile("a"),
				FS.directory(Zotero.FileStore.path.join(dir, "sub")).makeDir()
			), dir));
			let listing = await requestResult(query("readDir", { path: dir, withFileTypes: true }));
			assert.sameDeepMembers(listing.entries, [{ name: "a.txt", type: "file" }, { name: "sub", type: "directory" }]);

			let moved = under("tree/moved");
			let copied = under("tree/copied");
			await requestResult(commit((dir, moved, copied) => FS.directory(dir).rename(moved).cp(copied), dir, moved, copied));
			assert.isFalse(await FileIO.exists(dir));
			assert.equal(await FileIO.readUTF8(Zotero.FileStore.path.join(copied, "a.txt")), "a");

			// An existing destination is refused, or replaced as a whole with overwrite
			await FileIO.writeUTF8(Zotero.FileStore.path.join(copied, "extra.txt"), "stale");
			await requestError(commit((moved, copied) => FS.directory(moved).cp(copied), moved, copied), codes.NOT_ALLOWED);
			assert.isFalse(await FileIO.exists(Zotero.FileStore.path.join(copied, "moved")), "IOUtils would copy into it");
			await requestResult(commit((moved, copied) => FS.directory(moved).cp(copied, { overwrite: true }), moved, copied));
			assert.isFalse(await FileIO.exists(Zotero.FileStore.path.join(copied, "extra.txt")));
			assert.equal(await FileIO.readUTF8(Zotero.FileStore.path.join(copied, "a.txt")), "a");
			let tree = await requestResult(query("readDir", { path: under("tree") }));
			assert.notInclude(tree.entries.map(name => name.endsWith(".tmp")), true);

			// Onto or into itself, as Node refuses too
			await requestError(commit(
				moved => FS.directory(moved).cp(Zotero.FileStore.path.join(moved, "inner"), { overwrite: true }), moved),
			codes.INVALID_PARAMS);
			await requestError(commit(moved => FS.directory(moved).rename(`${moved}/`), moved), codes.INVALID_PARAMS);
			assert.isFalse(await FileIO.exists(Zotero.FileStore.path.join(moved, "inner")));

			// Without recursive, the OS refuses a directory with anything in it, and an empty one goes
			await requestError(commit(moved => FS.directory(moved).rm(), moved), codes.NOT_ALLOWED);
			let empty = under("tree/empty");
			await FileIO.makeDirectory(empty);
			await requestResult(commit(empty => FS.directory(empty).rm(), empty));
			assert.isFalse(await FileIO.exists(empty));
			await requestResult(commit(moved => FS.directory(moved).rm({ recursive: true }), moved));
			await requestResult(commit(
				copied => FS.directory(Zotero.FileStore.path.join(copied, "sub")).rm({ recursive: true }), copied));
			assert.isFalse(await FileIO.exists(moved));
		});

		it("should refuse an existing directory to makeDir without recursive", async function () {
			let dir = under("exists");
			await requestResult(commit(dir => FS.directory(dir).makeDir(), dir));
			await requestError(commit(dir => FS.directory(dir).makeDir(), dir), codes.NOT_ALLOWED);
			await requestResult(commit(dir => FS.directory(dir).makeDir({ recursive: true }), dir));
		});
	});

	describe("addressing and errors", function () {
		it("should digest a file", async function () {
			let path = under("digest.txt");
			await requestResult(commit(path => FS.file(path).writeFile("digest me"), path));
			let bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("digest me")));
			let expected = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
			let { algorithm, digest } = await requestResult(query("digest", { path }));
			assert.equal(algorithm, "sha256");
			assert.equal(digest, expected);
			let sha512 = await requestResult(query("digest", { path, algorithm: "sha512" }));
			assert.lengthOf(sha512.digest, 128);
			await requestError(query("digest", { path, algorithm: "md5" }), codes.INVALID_PARAMS);
			await requestError(query("digest", { path: root }), codes.NOT_FOUND);
		});

		it("should read a path through the snapshot query, as stat does", async function () {
			let path = under("snapshot-query.txt");
			await FileIO.writeUTF8(path, "snap");
			let snapshot = await requestResult(query("snapshot", { type: "file", path }));
			let stat = await requestResult(query("stat", { path }));
			for (let field of ["type", "path", "size", "revision"]) {
				assert.equal(snapshot[field], stat[field], field);
			}
			await requestError(query("snapshot", { type: "file", path: under("nope.txt") }), codes.NOT_FOUND);
			await requestError(query("snapshot", { type: "file", id: 1 }), codes.INVALID_PARAMS);
			await requestError(query("snapshot", { type: "file", path: "relative.txt" }), codes.INVALID_PARAMS);
		});

		it("should report NotFound for a missing path and for the wrong kind", async function () {
			let dir = under("kinds");
			await requestResult(commit(dir => FS.directory(dir).makeDir(), dir));
			await requestError(query("readFile", { path: under("nope.txt") }), codes.NOT_FOUND);
			await requestError(query("stat", { path: under("nope.txt") }), codes.NOT_FOUND);
			// The other kind is NotFound for a query as for a commit
			await requestError(commit(dir => FS.file(dir).writeFile("x"), dir), codes.NOT_FOUND);
			await requestError(query("readFile", { path: dir }), codes.NOT_FOUND);
			await requestError(query("readDir", { path: under("plain.txt") }), codes.NOT_FOUND);
			// An OS refusal is NotAllowed with the platform's reason, not a bug of ours; Windows says NotFound instead
			await requestError(query("stat", { path: under("z".repeat(300)) }), Zotero.isWin ? codes.NOT_FOUND : codes.NOT_ALLOWED);
		});

		it("should refuse a relative path and an unknown encoding", async function () {
			await requestError(query("readFile", { path: "relative.txt" }), codes.INVALID_PARAMS);
			await requestError(query("readFile", { path: under("plain.txt"), encoding: "latin1" }), codes.INVALID_PARAMS);
			await requestError(plugin.run(() => Zotero.FileStore.commit({ type: "file", path: "relative.txt", ops: [{ op: "rm" }] })),
				codes.INVALID_PARAMS);
			assert.throws(() => plugin.run(() => FS.file("relative.txt")), /absolute/);
		});

		it("should refuse an operation after a terminal one", async function () {
			let path = under("after-rm.txt");
			assert.throws(() => plugin.run(path => FS.file(path).rm().writeFile("x"), path), /No operation can follow/);
			await requestError(plugin.run((path) => {
				let changes = FS.of(FS.file(path).rm()).toJSON();
				changes.changes[0].ops.push({ op: "writeFile", data: "x" });
				return Zotero.FileStore.commit(changes);
			}, path), codes.INVALID_PARAMS);
		});

		it("should apply in order and say what a failed set left behind", async function () {
			let first = under("ordered-1.txt");
			let second = under("ordered-2.txt");
			// What the request alone decides is refused before anything is written
			let error = await requestError(commit((first, second) => FS.of(
				FS.file(first).writeFile("first"),
				FS.file(second).writeFile("%%%", { encoding: "base64" })
			), first, second), codes.INVALID_PARAMS);
			assert.isUndefined(error.data && error.data.applied);
			assert.isFalse(await FileIO.exists(first));

			// What the file system decides fails as it applies, after the entries before it: the report says so
			error = await requestError(commit((first, orphan) => FS.of(
				FS.file(first).writeFile("first"),
				FS.directory(orphan).makeDir()
			), first, under("no-such-dir/child")), codes.NOT_FOUND);
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
			let result = await requestResult(commit(
				(written, moved) => FS.file(written).writeFile("payload").rename(moved), written, moved));
			assert.equal(result.objects[0].path, Zotero.File.normalizeToUnix(moved));
			assert.isFalse(await FileIO.exists(written));
			assert.equal(await FileIO.readUTF8(moved), "payload");
		});

		// Merged into the first editor, the copy ran before the second write and b ended up "B"
		it("should keep a path edited again after another in its place", async function () {
			let a = under("again-a.txt");
			let b = under("again-b.txt");
			let { size, response } = await plugin.run(async (a, b) => {
				let set = FS.of(FS.file(a).writeFile("A"), FS.file(b).writeFile("B"), FS.file(a).copyFile(b, { overwrite: true }));
				return { size: set.size, response: await Zotero.FileStore.commit(set) };
			}, a, b);
			assert.equal(size, 3);
			assert.lengthOf((await requestResult(response)).objects, 3);
			assert.equal(await FileIO.readUTF8(b), "A");

			// Without overwrite, the destination an earlier entry wrote refuses the copy as it applies
			let c = under("again-c.txt");
			let d = under("again-d.txt");
			let error = await requestError(commit(
				(c, d) => FS.of(FS.file(c).writeFile("c"), FS.file(d).writeFile("d"), FS.file(c).copyFile(d)), c, d
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
			await requestResult(commit((src, other, copy) => FS.of(
				FS.file(src).writeFile("abc"),
				FS.file(other).writeFile("x"),
				FS.file(src).copyFile(copy),
				FS.file(other).rm(),
				FS.file(copy).truncate(1)
			), src, other, copy));
			assert.equal(await FileIO.readUTF8(copy), "a");
			assert.isFalse(await FileIO.exists(other));
		});

		it("should remove a path and write it again later in the set", async function () {
			let path = under("rewritten.txt");
			await requestResult(commit(path => FS.file(path).writeFile("old"), path));
			await requestResult(commit((path, between) => FS.of(
				FS.file(path).rm(),
				FS.file(between).writeFile("x"),
				FS.file(path).writeFile("new")
			), path, under("rewritten-between.txt")));
			assert.equal(await FileIO.readUTF8(path), "new");
		});

		it("should validate a set without writing", async function () {
			let path = under("validated.txt");
			let result = await requestResult(plugin.run(path => Zotero.FileStore.query("validate", {
				changes: FS.of(FS.file(path).writeFile("x"), FS.file(path).rename(path)).toJSON(),
			}), path));
			assert.lengthOf(result.issues, 1);
			assert.equal(result.issues[0].code, codes.INVALID_PARAMS);
			assert.include(result.issues[0].message, "is the source itself");
			assert.isFalse(await FileIO.exists(path));
		});
	});

	describe("builder", function () {
		// The builder runs apart from the store's config, in each sandbox, so only this keeps them in step
		it("should cover every object type and operation the store defines", function () {
			let built = plugin.run((path) => {
				let built = {};
				for (let [type, operations] of Object.entries(Zotero.FileStore.operationNames)) {
					let editor = FS[type](path);
					built[type] = {
						missing: operations.filter(op => typeof editor[op] !== "function"),
						terminal: [...editor.constructor.TERMINAL_OPS],
					};
				}
				return built;
			}, under("coverage"));
			let types = Zotero.FileStore._fileStore._objectTypes;
			for (let [type, operations] of Object.entries(Zotero.FileStore.operationNames)) {
				assert.isEmpty(built[type].missing, `${type} operations`);
				let terminal = operations.filter(op => types.get(type).operations[op].terminal);
				assert.sameMembers(built[type].terminal, terminal, `${type} terminal operations`);
			}
		});

		it("should round-trip a set through JSON and merge editors of one path", function () {
			let { size, json, again, plain } = plugin.run((path) => {
				let set = FS.of(FS.file(path).writeFile("a"), FS.file(path).appendFile(new Uint8Array([1, 2])));
				let json = set.toJSON();
				return { size: set.size, json, again: FS.from(json).toJSON(), plain: set.toPlain() };
			}, under("json.txt"));
			assert.equal(size, 1);
			assert.deepEqual(json.changes[0].ops, [
				{ op: "writeFile", data: "a" },
				{ op: "appendFile", data: btoa("\x01\x02"), encoding: "base64" },
			]);
			assert.deepEqual(again, json);
			// The store's form keeps the bytes
			assert.deepEqual(Array.from(plain.changes[0].ops[1].data), [1, 2]);
			assert.notProperty(plain.changes[0].ops[1], "encoding");
		});

		it("should refuse a revision on nothing and a bad encoding", function () {
			assert.throws(() => plugin.run(path => FS.file(path).writeFile("x", { encoding: "latin1" }), under("x")), /encoding/);
			assert.throws(() => plugin.run(path => FS.file(path).expect(""), under("x")), /revision/);
		});
	});

	describe("handles", function () {
		// The traditional form: Zotero.FileStore.Handle.file(path) is FS.file(path) held in place
		it("should offer a Handle class with a factory per object type and every operation", function () {
			let built = plugin.run((path) => {
				let built = {};
				for (let [type, operations] of Object.entries(Zotero.FileStore.operationNames)) {
					let handle = Zotero.FileStore.Handle[type](path);
					built[type] = {
						missing: operations.filter(op => typeof handle[op] !== "function"),
						path: handle.path,
						isHandle: handle instanceof Zotero.FileStore.Handle,
						isEditor: handle.editor instanceof FS[type](path).constructor,
					};
				}
				return built;
			}, under("coverage"));
			for (let type of Zotero.FileStore.objectTypes) {
				assert.isEmpty(built[type].missing, `${type} operations`);
				assert.equal(built[type].path, Zotero.File.normalizeToUnix(under("coverage")));
				assert.isTrue(built[type].isHandle);
				assert.isTrue(built[type].isEditor);
			}
		});

		it("should write through a handle, then apply only what was added since", async function () {
			let path = under("handle.txt");
			let saved = await plugin.run(async (path) => {
				let file = Zotero.FileStore.Handle.file(path);
				file.writeFile("v1");
				let first = await file.save();
				file.appendFile(", v2");
				let second = await file.save({ snapshots: true });
				return { first, second, pending: file.ops.length, path: file.path };
			}, path);
			assert.equal(saved.first.type, "file");
			assert.equal(saved.first.path, Zotero.File.normalizeToUnix(path));
			assert.equal(saved.second.snapshot.size, 6);
			assert.notEqual(saved.second.revision, saved.first.revision);
			assert.equal(saved.pending, 0);
			assert.equal(saved.path, saved.first.path);
			assert.equal(await FileIO.readUTF8(path), "v1, v2");
		});

		it("should read a stat snapshot, then fail to save with Conflict once the file changed", async function () {
			let path = under("handle-guarded.txt");
			await FileIO.writeUTF8(path, "v1");
			let stat = await plugin.run(async (path) => {
				globalThis.file = Zotero.FileStore.Handle.file(path);
				return globalThis.file.snapshot();
			}, path);
			assert.equal(stat.type, "file");
			assert.equal(stat.size, 2);
			assert.equal(plugin.eval("file.revision"), stat.revision);
			await FileIO.writeUTF8(path, "changed behind the store's back");
			let code = await plugin.run(() => globalThis.file.writeFile("too late").save().then(() => "saved", e => e.code));
			assert.equal(code, codes.CONFLICT);
			assert.equal(await FileIO.readUTF8(path), "changed behind the store's back");
			// A fresh read takes the new revision, and the pending write goes through
			await plugin.run(async () => {
				await globalThis.file.snapshot();
				await globalThis.file.save();
			});
			assert.equal(await FileIO.readUTF8(path), "too late");
		});

		it("should make and remove a directory, and take no operation after rm", async function () {
			let dir = under("handle-dir");
			let out = await plugin.run(async (dir) => {
				let directory = Zotero.FileStore.Handle.directory(dir);
				await directory.makeDir({ recursive: true }).save();
				let made = await directory.snapshot();
				let removed = await directory.rm({ recursive: true }).save();
				let after;
				try {
					directory.makeDir();
					after = "allowed";
				}
				catch (e) {
					after = e.message;
				}
				let again = await directory.save().then(() => "saved", e => e.message);
				return { made: made.type, removed, after, again };
			}, dir);
			assert.equal(out.made, "directory");
			assert.isTrue(out.removed.erased);
			assert.match(out.after, /No operation can follow rm/);
			assert.match(out.again, /gone after rm/);
			assert.isFalse(await IOUtils.exists(dir));
		});

		it("should throw the store's error, gate the read, and refuse save without fileSystemWrite", async function () {
			let missing = under("handle-missing.txt");
			// The data directory is always refused, so no prompt is involved
			let forbidden = PathUtils.join(Zotero.DataDirectory.dir, "zotero.sqlite");
			let seen = await plugin.run(async (missing, forbidden) => ({
				snapshot: await Zotero.FileStore.Handle.file(missing).snapshot().catch(e => e.code),
				save: await Zotero.FileStore.Handle.file(missing).rm().save()
					.catch(e => e.code),
				forbidden: await Zotero.FileStore.Handle.file(forbidden).snapshot().catch(e => e.code),
			}), missing, forbidden);
			assert.equal(seen.snapshot, codes.NOT_FOUND);
			assert.equal(seen.save, codes.NOT_FOUND);
			assert.equal(seen.forbidden, codes.PERMISSION_DENIED);

			load(["default", "fileSystemRead"]);
			let path = under("handle-read-only.txt");
			await FileIO.writeUTF8(path, "read only");
			let readOnly = await plugin.run(async (path) => {
				let file = Zotero.FileStore.Handle.file(path);
				let stat = await file.snapshot();
				return {
					size: stat.size,
					code: await file.writeFile("x").save().catch(e => e.code),
					directory: typeof Zotero.FileStore.Handle.directory,
				};
			}, path);
			assert.equal(readOnly.size, 9);
			assert.equal(readOnly.code, codes.PERMISSION_DENIED);
			assert.equal(readOnly.directory, "function");
			assert.equal(await FileIO.readUTF8(path), "read only");
		});

		// save() calls take turns; what is pushed while one runs waits for the next
		it("should keep what is pushed while a save is in flight for the next save", async function () {
			let path = under("handle-in-flight.txt");
			let gate = Zotero.Promise.defer();
			let write = sinon.stub(FileIO, 'write').callsFake(async function (...args) {
				await gate.promise;
				return write.wrappedMethod.apply(this, args);
			});
			try {
				let saving = plugin.run((path) => {
					globalThis.file = Zotero.FileStore.Handle.file(path).writeFile("v1");
					return globalThis.file.save();
				}, path);
				for (let i = 0; i < 100 && !write.called; i++) {
					await Zotero.Promise.delay(10);
				}
				assert.isTrue(write.called, "the commit reached the write");
				plugin.eval('file.appendFile(", v2")');
				gate.resolve();
				await saving;
			}
			finally {
				gate.resolve();
				write.restore();
			}
			assert.equal(plugin.eval("file.ops.length"), 1);
			assert.equal(await FileIO.readUTF8(path), "v1");
			await plugin.run(() => globalThis.file.save());
			assert.equal(plugin.eval("file.ops.length"), 0);
			assert.equal(await FileIO.readUTF8(path), "v1, v2");
		});

		it("should append once when saves overlap", async function () {
			let path = under("handle-overlap.txt");
			let out = await plugin.run(async (path) => {
				let file = Zotero.FileStore.Handle.file(path).writeFile("a");
				await file.save();
				file.appendFile("b");
				let first = file.save();
				file.appendFile("c");
				let second = file.save();
				let [a, b] = await Promise.all([first, second]);
				return { same: a.path === b.path, pending: file.ops.length };
			}, path);
			assert.isTrue(out.same);
			assert.equal(out.pending, 0);
			assert.equal(await FileIO.readUTF8(path), "abc");
		});
	});

	describe("path helpers", function () {
		// The plugin's own helper, called there
		function path(name, ...args) {
			return plugin.run((name, args) => Zotero.FileStore.path[name](...args), name, args);
		}

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
				let win = p => path("normalize", p);
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
			assert.equal(plugin.eval("Zotero.FileStore.path.sep"), "/");
			assert.equal(path("join", "a", "b/", "../c"), "a/c");
			assert.equal(path("join"), ".");
			assert.equal(path("normalize", ""), ".");
			assert.equal(path("dirname", "a/b"), "a");
			assert.equal(path("dirname", "a"), ".");
			assert.equal(path("basename", "a/b/c.tar.gz", ".gz"), "c.tar");
			assert.equal(path("extname", "x/y.tar.gz"), ".gz");
			assert.equal(path("extname", "a/.hidden"), "");
			assert.isFalse(path("isAbsolute", "a/b"));
			assert.isFalse(path("isAbsolute", ""));
			// Chrome-backed, but a failure is the plugin's own TypeError
			assert.match(plugin.run(() => {
				try {
					Zotero.FileStore.path.dirname(5);
					return "no throw";
				}
				catch (e) {
					return e instanceof TypeError ? e.message : String(e);
				}
			}), /must be a string/);
			if (Zotero.isWin) {
				assert.equal(path("join", "C:\\Users\\x", "..", "y"), "C:/Users/y");
				assert.equal(path("normalize", "C:/a//b/../c/"), "C:/a/c");
				assert.equal(path("dirname", "C:/a/b/c.txt"), "C:/a/b");
				assert.equal(path("dirname", "C:/a"), "C:/");
				assert.equal(path("dirname", "C:/"), "C:/");
				assert.equal(path("dirname", "//server/share/x"), "//server/share");
				assert.equal(path("basename", "C:/"), "");
				assert.isTrue(path("isAbsolute", "C:\\a"));
				assert.throws(() => path("normalize", "C:/.."), /root/);
			}
			else {
				assert.equal(path("join", "/a/b", "../c", "./d.txt"), "/a/c/d.txt");
				assert.equal(path("normalize", "/a//b/../c/"), "/a/c");
				assert.equal(path("dirname", "/a/b/c.txt"), "/a/b");
				assert.equal(path("dirname", "/a"), "/");
				assert.equal(path("dirname", "/"), "/");
				assert.equal(path("basename", "/"), "");
				assert.isTrue(path("isAbsolute", "/a"));
				assert.isFalse(path("isAbsolute", "C:\\a"));
				assert.throws(() => path("normalize", "/.."), /root/);
			}
		});
	});

	describe("access", function () {
		var privileged = usePluginSandbox({ id: "test-file-store-privileged@zotero.org" });
		var { PluginFileAccess } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileAccess.mjs");
		var PREF_PREFIX = "extensions.zotero.pluginFileAccess.";

		var outsideDir;
		var outsidePath;

		before(async function () {
			// Lives outside the plugin's auto-allowed directories
			outsideDir = await getTempDirectory();
			outsidePath = PathUtils.join(outsideDir, "outside-" + Zotero.Utilities.randomString() + ".txt");
			await FileIO.writeUTF8(outsidePath, "outside content");
		});

		after(async function () {
			await FileIO.remove(outsidePath, { ignoreAbsent: true });
		});

		beforeEach(function () {
			Zotero.Prefs.clear(PREF_PREFIX + plugin.uuid, true);
		});

		afterEach(function () {
			Zotero.Prefs.clear(PREF_PREFIX + plugin.uuid, true);
		});

		function readFile(path) {
			return query("readFile", { path, encoding: "utf8" });
		}

		function writeFile(path, text) {
			return commit((path, text) => FS.file(path).writeFile(text), path, text);
		}

		it("should give the plugin its own directories, and a privileged one none", async function () {
			let dirs = await requestResult(query("dirs"));
			assert.equal(dirs.data, Zotero.File.normalizeToUnix(PathUtils.join(Zotero.DataDirectory.dir, "plugin-data", plugin.uuid)));
			assert.include(dirs.temp, plugin.uuid);
			// Its calls name no plugin, so the store has no directory to give
			privileged.load(["*"]);
			let none = await requestResult(privileged.run(() => Zotero.FileStore.query("dirs")));
			assert.isNull(none.data);
			assert.isNull(none.temp);
		});

		it("should write to the plugin's temp directory without a session", async function () {
			let dirs = await requestResult(query("dirs"));
			let target = dirs.temp + "/in-temp-" + Zotero.Utilities.randomString() + ".txt";
			await requestResult(writeFile(target, "temp"));
			assert.equal(await FileIO.readUTF8(target), "temp");
		});

		// Storage sits in the forbidden data directory, so a missing grant fails at once rather than prompting
		it("should reach an attachment's file through the data store, read with dataRead and write with dataWrite", async function () {
			let attachment = await importFileAttachment("test.txt");
			try {
				load(["default", "dataRead", "fileSystemRead", "fileSystemWrite"]);
				let fileOf = itemID => plugin.run(itemID => Zotero.DataStore.query("file", { itemID }), itemID);
				let file = await requestResult(fileOf(attachment.id));
				assert.isTrue(file.exists);
				assert.equal(file.path, PluginFileAccess.canonicalize(await attachment.getFilePathAsync()));
				let read = await requestResult(readFile(file.path));
				assert.equal(read.data, await FileIO.readUTF8(file.path));
				await requestError(writeFile(file.path, "changed"), codes.PERMISSION_DENIED);

				load(["default", "dataWrite", "fileSystemRead", "fileSystemWrite"]);
				file = await requestResult(fileOf(attachment.id));
				await requestResult(writeFile(file.path, "changed"));
				assert.equal(await FileIO.readUTF8(file.path), "changed");
			}
			finally {
				await attachment.eraseTx();
			}
		});

		it("should grant only read on an attachment the user cannot edit, whatever the permissions", async function () {
			let group = await createGroup();
			let attachment = await importFileAttachment("test.txt", { libraryID: group.libraryID });
			group.editable = false;
			group.filesEditable = false;
			await group.saveTx();
			try {
				load(["default", "dataWrite", "fileSystemRead", "fileSystemWrite"]);
				let file = await requestResult(plugin.run(itemID => Zotero.DataStore.query("file", { itemID }), attachment.id));
				await requestResult(readFile(file.path));
				await requestError(writeFile(file.path, "changed"), codes.PERMISSION_DENIED);
			}
			finally {
				await group.eraseTx();
			}
		});

		// A deny on the directory answers a prompt at once, so a missing grant fails instead of waiting
		it("should resolve a linked file stored relative to the base directory", async function () {
			let base = await getTempDirectory();
			let target = PathUtils.join(base, "linked-" + Zotero.Utilities.randomString() + ".txt");
			await FileIO.writeUTF8(target, "linked");
			let prefs = { baseAttachmentPath: Zotero.Prefs.get("baseAttachmentPath"), saveRelativeAttachmentPath: Zotero.Prefs.get("saveRelativeAttachmentPath") };
			Zotero.Prefs.set("baseAttachmentPath", base);
			Zotero.Prefs.set("saveRelativeAttachmentPath", true);
			let attachment = await Zotero.Attachments.linkFromFile({ file: target });
			Zotero.Prefs.set(PREF_PREFIX + plugin.uuid, JSON.stringify([[PluginFileAccess.canonicalize(base), { mode: "deny" }]]), true);
			try {
				assert.isTrue(attachment.attachmentPath.startsWith("attachments:"));
				load(["default", "dataRead", "fileSystemRead"]);
				let [item, file] = await plugin.run(itemID => Promise.all([
					Zotero.DataStore.query("item", { itemID }),
					Zotero.DataStore.query("file", { itemID }),
				]), attachment.id);
				assert.isTrue((await requestResult(item)).data.path.startsWith("attachments:"));
				let { path } = await requestResult(file);
				assert.equal(path, PluginFileAccess.canonicalize(target));
				let read = await requestResult(readFile(path));
				assert.equal(read.data, "linked");
			}
			finally {
				await attachment.eraseTx();
				for (let [pref, value] of Object.entries(prefs)) {
					if (value === undefined) {
						Zotero.Prefs.clear(pref);
					}
					else {
						Zotero.Prefs.set(pref, value);
					}
				}
			}
		});

		// Where a path leads is simulated, so a link out of plugin-data needs no link on this file system
		it("should judge a path by where it really leads, not by how it is spelled", async function () {
			let spelledInside = under("looks-inside.txt");
			let spelledOutside = PathUtils.join(outsideDir, "looks-outside-" + Zotero.Utilities.randomString() + ".txt");
			let realInside = PluginFileAccess._realPath(PluginFileAccess.canonicalize(under("really-inside.txt")));
			let stub = sinon.stub(PluginFileAccess, "_realPath").callsFake(function (p) {
				let canonical = Zotero.File.normalizeToUnix(p);
				if (canonical === Zotero.File.normalizeToUnix(spelledInside)) {
					return Zotero.File.normalizeToUnix(outsidePath);
				}
				if (canonical === Zotero.File.normalizeToUnix(spelledOutside)) {
					return realInside;
				}
				return stub.wrappedMethod(p);
			});
			try {
				await requestError(readFile(spelledInside), codes.PERMISSION_DENIED);
				// Allowed by the gate, so the store gets as far as looking for the file
				await requestError(readFile(spelledOutside), codes.NOT_FOUND);
			}
			finally {
				stub.restore();
			}
		});

		// A real link, so the walk itself runs; Windows needs a privilege to make one
		it("should follow a symlink out of plugin-data and refuse one that leads nowhere", async function () {
			if (Zotero.isWin) {
				this.skip();
			}
			let link = under("link-out");
			let dangling = under("link-nowhere");
			let nowhere = PathUtils.join(outsideDir, "never-" + Zotero.Utilities.randomString() + ".txt");
			await Zotero.Utilities.Internal.subprocess("ln", ["-s", outsidePath, link]);
			await Zotero.Utilities.Internal.subprocess("ln", ["-s", nowhere, dangling]);
			try {
				await requestError(readFile(link), codes.PERMISSION_DENIED);
				await requestError(writeFile(dangling, "x"), codes.PERMISSION_DENIED);
				assert.isFalse(await FileIO.exists(nowhere));
			}
			finally {
				await Zotero.Utilities.Internal.subprocess("rm", ["-f", link, dangling]);
			}
		});

		it("should refuse a read outside plugin-data without a grant", async function () {
			await requestError(readFile(outsidePath), codes.PERMISSION_DENIED);
		});

		it("should refuse a write outside plugin-data without a grant, writing nothing", async function () {
			let target = PathUtils.join(outsideDir, "no-write-" + Zotero.Utilities.randomString() + ".txt");
			await requestError(writeFile(target, "denied"), codes.PERMISSION_DENIED);
			assert.isFalse(await FileIO.exists(target), "no file should have been written");
		});

		it("should refuse access to the profile and to the data directory outside plugin-data", async function () {
			for (let target of [
				PathUtils.join(PathUtils.profileDir, "prefs.js"),
				PathUtils.join(Zotero.DataDirectory.dir, "zotero.sqlite"),
			]) {
				let error = await requestError(query("access", { path: target }));
				assert.equal(error.code, codes.PERMISSION_DENIED, target);
			}
		});

		it("should honor a persisted read grant and a persisted deny", async function () {
			Zotero.Prefs.set(PREF_PREFIX + plugin.uuid, JSON.stringify([[outsidePath, { mode: "read" }]]), true);
			let read = await requestResult(readFile(outsidePath));
			assert.equal(read.data, "outside content");

			// A deny on the outer directory covers the file
			Zotero.Prefs.set(PREF_PREFIX + plugin.uuid, JSON.stringify([[outsideDir, { mode: "deny" }]]), true);
			await requestError(query("access", { path: outsidePath }), codes.PERMISSION_DENIED);
		});

		it("should reject withSession when chrome times the session out", async function () {
			// The plugin's withSession takes no options, so it cannot extend the timeout; stub the chrome side with a
			// tight one and have the plugin's fn outlast it
			let original = PluginFileAccess.withSession;
			PluginFileAccess.withSession = (pluginID, fn) => original.call(PluginFileAccess, pluginID, fn, { timeout: 50 });
			try {
				let threw = await plugin.run(() => Zotero.FileStore.withSession(async () => {
					await new Promise(resolve => setTimeout(resolve, 300));
				}).then(() => false, () => true));
				assert.isTrue(threw, "withSession should reject when chrome times out the session");
			}
			finally {
				PluginFileAccess.withSession = original;
			}
		});

		it("should not expose commit without fileSystemWrite, nor the store without fileSystemRead", function () {
			load(["default", "fileSystemRead"]);
			assert.deepEqual(plugin.run(() => [
				typeof Zotero.FileStore.query,
				typeof Zotero.FileStore.ChangeSet,
				typeof Zotero.FileStore.Handle,
				typeof Zotero.FileStore.withSession,
				typeof Zotero.FileStore.commit,
			]), ["function", "function", "function", "function", "undefined"]);
			plugin.load(["default"]);
			assert.equal(plugin.eval("typeof Zotero.FileStore"), "undefined");
			// The pure helpers stay in the default schema
			assert.equal(plugin.eval("typeof Zotero.File.getExtension"), "function");
		});
	});
});
