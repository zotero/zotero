/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://www.zotero.org

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

{
	const lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		StoreAPIBase: "chrome://zotero/content/xpcom/pluginAPI/storeAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		ScopeUtils: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		PluginFileAccess: "chrome://zotero/content/xpcom/plugins/fileAccess.mjs",
		PathIdentity: "chrome://zotero/content/xpcom/plugins/filePath.mjs",
		FileIO: "chrome://zotero/content/xpcom/plugins/fileIO.mjs",
		Params: "chrome://zotero/content/xpcom/pluginAPI/apiParams.mjs",
		FilePath: "chrome://zotero/content/xpcom/plugins/filePath.mjs",
	});

	const ENCODINGS = ["utf8", "utf-8", "base64"];

	/**
	 * What a path is at one moment; `revision` is `size:mtimeMs`, coarse and advisory, since no lock exists
	 * @typedef {object} PathStat
	 * @property {"file" | "directory" | "other"} type
	 * @property {string} path - The canonical form: absolute, forward slashes on every platform
	 * @property {number} size
	 * @property {number} mtimeMs
	 * @property {number | null} atimeMs
	 * @property {number | null} birthtimeMs - Null where the platform keeps none
	 * @property {string} revision
	 *
	 *
	 * @typedef {object} FileStoreQueryParams
	 * @property {{ path: string, encoding?: "utf8" | "base64", offset?: number, length?: number }} readFile - Bytes
	 *     unless an encoding is given, as in Node; `offset` and `length` read a byte range
	 * @property {{ path: string, withFileTypes?: boolean }} readDir
	 * @property {{ path: string }} stat
	 * @property {{ path: string }} exists
	 * @property {{ path: string, algorithm?: "sha256" | "sha384" | "sha512" }} digest - sha256 unless said otherwise
	 * @property {{ path: string, mode?: "read" | "write" }} access - Runs the gate, prompting if needed
	 * @property {{}} dirs
	 * @property {{ changes: StoreChangeSet }} validate
	 *
	 *
	 * @typedef {object} FileStoreQueryResults
	 * @property {{ data: Uint8Array | string }} readFile
	 * @property {{ entries: (string | { name: string, type: PathStat["type"] })[] }} readDir - Names, as in Node
	 * @property {PathStat} stat
	 * @property {{ exists: boolean }} exists
	 * @property {{ algorithm: string, digest: string }} digest - Hex
	 * @property {{}} access
	 * @property {{ data: string | null, temp: string | null }} dirs - The plugin's always-allowed directories
	 * @property {{ issues: StoreIssue[] }} validate
	 *
	 *
	 * Bytes cross as a Uint8Array; a string is utf8 text unless its encoding says base64, as in Node
	 * @typedef {object} FileOperationParams
	 * @property {{ data: Uint8Array | string, encoding?: "utf8" | "base64", overwrite?: boolean, flush?: boolean }} writeFile
	 *     - Creates or replaces; `overwrite: false` refuses an existing file; `flush` forces the OS buffers to disk
	 * @property {{ data: Uint8Array | string, encoding?: "utf8" | "base64", flush?: boolean }} appendFile - Creates when absent
	 * @property {{ length?: number }} truncate
	 * @property {{ dest: string, overwrite?: boolean }} copyFile - An existing destination is refused unless overwrite
	 * @property {{ dest: string, overwrite?: boolean }} rename - Later operations and the result use the new path
	 * @property {{ force?: boolean }} rm - Terminal; an absent file is no error with force
	 *
	 *
	 * @typedef {object} DirectoryOperationParams
	 * @property {{ recursive?: boolean }} makeDir - Refuses an existing directory unless recursive
	 * @property {{ dest: string }} rename - The destination must not exist
	 * @property {{ dest: string, overwrite?: boolean }} cp - Copies the tree; an existing destination is replaced only with overwrite
	 * @property {{ recursive?: boolean, force?: boolean }} rm - Terminal; recursive is required, as in Node
	 */

	const ENCODING_PARAM = { ...lazy.Params.oneOf(ENCODINGS), optional: true };

	const BOOLEAN_PARAM = { type: "boolean", optional: true };

	const COUNT_PARAM = {
		type: "number",
		optional: true,
		checkHook: value => (Number.isInteger(value) && value >= 0) || "must be a non-negative integer",
	};

	const HASHES = ["sha256", "sha384", "sha512"];

	const ALGORITHM_PARAM = { ...lazy.Params.oneOf(HASHES), optional: true };

	const DATA_PARAM = {
		type: "any",
		checkHook: value => typeof value === "string" || ArrayBuffer.isView(value) || "must be a string or bytes",
	};

	// IOUtils failures by DOMException name; anything else is the caller's bad request (an operation) or a bug (a query)
	const IO_ERROR_CODES = {
		NotFoundError: lazy.StoreAPIBase.errorCodes.NOT_FOUND,
		NotAllowedError: lazy.StoreAPIBase.errorCodes.NOT_ALLOWED,
		NoModificationAllowedError: lazy.StoreAPIBase.errorCodes.NOT_ALLOWED,
		ReadOnlyError: lazy.StoreAPIBase.errorCodes.NOT_ALLOWED,
		// The OS refused for a reason in the message: a name too long, a full disk, a directory not empty
		OperationError: lazy.StoreAPIBase.errorCodes.NOT_ALLOWED,
		QuotaExceededError: lazy.StoreAPIBase.errorCodes.NOT_ALLOWED,
		// A path of the other kind: a directory read as a file, a file where a directory should go
		InvalidAccessError: lazy.StoreAPIBase.errorCodes.NOT_ALLOWED,
	};

	/**
	 * @returns {Promise<object | null>} IOUtils' stat, or null when the path is absent
	 */
	async function statPath(path) {
		try {
			return await lazy.FileIO.stat(path);
		}
		catch (e) {
			if (e?.name === "NotFoundError") {
				return null;
			}
			throw e;
		}
	}

	function kindOf(stat) {
		if (stat.type === "regular") {
			return "file";
		}
		return stat.type === "directory" ? "directory" : "other";
	}

	function revisionOf(stat) {
		return stat ? `${stat.size}:${stat.lastModified}` : undefined;
	}

	/**
	 * @param {string} path - Canonical
	 * @param {object} stat - From IOUtils
	 * @returns {PathStat}
	 */
	function pathStat(path, stat) {
		return {
			type: kindOf(stat),
			path,
			size: stat.size,
			mtimeMs: stat.lastModified,
			atimeMs: stat.lastAccessed ?? null,
			birthtimeMs: stat.creationTime ?? null,
			revision: revisionOf(stat),
		};
	}

	// Bytes are written as they are; a string is text, or base64 when its encoding says so
	function decode(data, encoding) {
		if (typeof data !== "string") {
			return data;
		}
		return encoding === "base64" ? Uint8Array.fromBase64(data) : new TextEncoder().encode(data);
	}

	function encode(bytes, encoding) {
		return encoding === "base64" ? bytes.toBase64() : new TextDecoder().decode(bytes);
	}

	// Malformed base64 fails at resolve, before anything is written
	function checkContent({ data, encoding }) {
		if (encoding !== "base64" || typeof data !== "string") {
			return false;
		}
		try {
			Uint8Array.fromBase64(data);
			return false;
		}
		catch (e) {
			return `data is not base64: ${e.message}`;
		}
	}

	function differsOnlyByCase(a, b) {
		return a !== b && a.toLowerCase() === b.toLowerCase();
	}

	// A sibling of the target, so the rename that finishes an atomic write stays on one volume; its own
	// short name, so a target at the length limit still has room for it
	function tmpPathFor(path) {
		return `${path.slice(0, path.lastIndexOf("/") + 1)}.zotero-${Zotero.Utilities.randomString(8)}.tmp`;
	}

	class FileStoreInternal extends lazy.StoreAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "FileStore",
				permissions: "fileSystemWrite",
				queries: {
					readFile: {
						params: { path: lazy.Params.nonEmptyString, encoding: ENCODING_PARAM, offset: COUNT_PARAM, length: COUNT_PARAM },
						handler: ({ path, ...options }, { caller }) => this._readFile(path, options, caller),
					},
					readDir: {
						params: { path: lazy.Params.nonEmptyString, withFileTypes: BOOLEAN_PARAM },
						handler: ({ path, withFileTypes }, { caller }) => this._readDir(path, withFileTypes, caller),
					},
					stat: {
						params: { path: lazy.Params.nonEmptyString },
						handler: async ({ path }, { caller }) => {
							path = await this._readable(path, caller);
							return pathStat(path, await this._requireStat(path));
						},
					},
					exists: {
						params: { path: lazy.Params.nonEmptyString },
						handler: async ({ path }, { caller }) => {
							path = await this._readable(path, caller);
							return { exists: !!(await this._io(() => statPath(path))) };
						},
					},
					digest: {
						params: { path: lazy.Params.nonEmptyString, algorithm: ALGORITHM_PARAM },
						handler: async ({ path, algorithm = "sha256" }, { caller }) => {
							path = await this._readable(path, caller);
							await this._requireFile(path);
							return { algorithm, digest: await this._io(() => lazy.FileIO.computeHexDigest(path, algorithm)) };
						},
					},
					access: {
						params: {
							path: lazy.Params.nonEmptyString,
							mode: { ...lazy.Params.oneOf(["read", "write"]), optional: true },
						},
						handler: async ({ path, mode = "read" }, { caller }) => {
							if (mode === "write" && !caller.privileged
									&& !lazy.VarCheck.hasPermissions(caller.scope, "fileSystemWrite")) {
								this._throw(lazy.StoreAPIBase.errorCodes.PERMISSION_DENIED,
									"access to write requires permission fileSystemWrite");
							}
							await this._checkAccess(caller, this._canonical(path), mode);
							return {};
						},
					},
					dirs: {
						handler: async (_params, { caller }) => ({
							data: caller.pluginID ? lazy.PluginFileAccess.getDir(caller.pluginID) : null,
							temp: caller.pluginID ? await lazy.PluginFileAccess.getTempDir(caller.pluginID) : null,
						}),
					},
				},
				objectTypes: {
					file: this._fileType(),
					directory: this._directoryType(),
				},
			};
		}

		/**
		 * How an entry or a reference names a path; both kinds share it
		 * @returns {StoreAddressDef}
		 */
		_pathAddress() {
			return {
				fields: ["path"],
				plan: (entry, _defaults, fail) => {
					if (typeof entry.path !== "string" || !entry.path) {
						fail.invalid("needs a path");
					}
					return { path: this._canonical(entry.path, fail) };
				},
				resolve: address => address.path,
				fromValue: (value, { what }, fail) => {
					if (typeof value !== "string" || !value) {
						fail.invalid(`${what} must be a path`);
					}
					return this._canonical(value, fail);
				},
			};
		}

		/**
		 * What the file system holds is judged as each operation applies, after the entries before it, not
		 * predicted: every operation first refuses a path of the other kind, which IOUtils would take anyway
		 * (an empty directory removed as a file), and the OS refuses the rest with the codes IO_ERROR_CODES maps
		 */
		_kindChecked(operations) {
			return Object.fromEntries(Object.entries(operations).map(([name, op]) => [name, {
				...op,
				apply: async (target, params, ctx) => {
					await this._requireKind(target);
					return op.apply(target, params, ctx);
				},
			}]));
		}

		async _requireKind(target) {
			let stat = await this._io(() => statPath(target.path));
			if (stat && kindOf(stat) !== target.type) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `${target.path} is a ${kindOf(stat)}, not a ${target.type}`);
			}
		}

		/**
		 * Where a copy or move of the target to dest lands: a file goes in a directory found there under its own
		 * name, as cp and mv have it; anything else lands at dest itself
		 * @param {string} dest - Canonical
		 */
		async _landing(target, dest) {
			if (target.type === "file") {
				let stat = await this._io(() => statPath(dest));
				if (stat && kindOf(stat) === "directory") {
					return lazy.FilePath.join(dest, lazy.FilePath.basename(target.path));
				}
			}
			return dest;
		}

		/**
		 * Where a copy or move lands, settled as it applies. A directory there takes a file; for a directory it is
		 * refused unless `overwrite` replaces it where the operation allows, since IOUtils would put the tree
		 * inside. An existing file is the OS's to refuse without `overwrite`
		 * @param {{ overwrite?: boolean, replaces?: boolean, recase?: boolean }} rules - `replaces`: `overwrite`
		 *     may replace a directory; `recase`: the landing may be the source under another spelling
		 * @returns {Promise<string>} The canonical landing path
		 */
		async _destination(target, rawDest, { overwrite, replaces = false, recase = false }) {
			let { INVALID_PARAMS, NOT_ALLOWED } = lazy.StoreAPIBase.errorCodes;
			let dest = await this._landing(target, this._canonical(rawDest, this._fail("dest")));
			// The check refused this already, unless an earlier entry changed where the file lands
			if (this._sameFile(target.path, dest)) {
				if (!(recase && differsOnlyByCase(target.path, dest))) {
					this._throw(INVALID_PARAMS, `${dest} is the source itself`);
				}
				return dest;
			}
			let stat = await this._io(() => statPath(dest));
			if (!stat) {
				return dest;
			}
			if (kindOf(stat) !== target.type) {
				this._throw(NOT_ALLOWED, `${dest} is a ${kindOf(stat)}`);
			}
			if (target.type === "directory" && !(replaces && overwrite)) {
				this._throw(NOT_ALLOWED, `${dest} exists${replaces ? "; pass overwrite: true to replace it" : ""}`);
			}
			return dest;
		}

		_fileType() {
			return {
				transactional: false,
				address: this._pathAddress(),
				resolve: (path, ctx) => this._resolveTarget("file", path, ctx),
				revision: target => target.revision,
				describe: target => ({ id: target.path, path: target.path }),
				snapshot: target => (target.stat ? pathStat(target.path, target.stat) : null),
				operations: this._kindChecked({
					writeFile: {
						params: { data: DATA_PARAM, encoding: ENCODING_PARAM, overwrite: BOOLEAN_PARAM, flush: BOOLEAN_PARAM },
						check: (_target, params) => checkContent(params),
						// Under overwrite: false, the create mode leaves an existing file to the OS to refuse
						apply: (target, { data, encoding, overwrite, flush }) => this._update(target,
							() => lazy.FileIO.write(target.path, decode(data, encoding), {
								tmpPath: tmpPathFor(target.path),
								mode: overwrite === false ? "create" : "overwrite",
								flush: !!flush,
							})),
					},
					appendFile: {
						params: { data: DATA_PARAM, encoding: ENCODING_PARAM, flush: BOOLEAN_PARAM },
						check: (_target, params) => checkContent(params),
						apply: (target, { data, encoding, flush }) => this._update(target,
							() => lazy.FileIO.write(target.path, decode(data, encoding), { mode: "appendOrCreate", flush: !!flush })),
					},
					truncate: {
						params: { length: COUNT_PARAM },
						// IOUtils has no truncate: the kept prefix is read back and written, zero-padded as Node does
						apply: async (target, { length = 0 }) => {
							await this._requireStat(target.path);
							let kept = length ? await this._io(() => lazy.FileIO.read(target.path, { maxBytes: length })) : new Uint8Array(0);
							let bytes = new Uint8Array(length);
							bytes.set(kept.subarray(0, length));
							await this._update(target, () => lazy.FileIO.write(target.path, bytes, { tmpPath: tmpPathFor(target.path) }));
						},
					},
					copyFile: {
						params: { dest: lazy.Params.nonEmptyString, overwrite: BOOLEAN_PARAM },
						check: (target, { dest }, ctx) => this._checkDestination(target, dest, {}, ctx),
						apply: async (target, { dest, overwrite }) => {
							dest = await this._destination(target, dest, { overwrite });
							await this._io(() => lazy.FileIO.copy(target.path, dest, { noOverwrite: !overwrite }));
						},
					},
					rename: {
						params: { dest: lazy.Params.nonEmptyString, overwrite: BOOLEAN_PARAM },
						check: (target, { dest }, ctx) => this._checkDestination(target, dest, { recase: true }, ctx),
						apply: (target, { dest, overwrite }) => this._move(target, dest, { overwrite, recase: true }),
					},
					rm: {
						terminal: true,
						params: { force: BOOLEAN_PARAM },
						check: (target, _params, ctx) => this._refuseAttachmentRemoval(target.path, ctx),
						apply: (target, { force }) => this._io(
							() => lazy.FileIO.remove(target.path, { ignoreAbsent: !!force, retryReadonly: !!force })),
					},
				}),
			};
		}

		// The data store grants an attachment's file to edit; removing it would break or lose the attachment
		_refuseAttachmentRemoval(path, ctx) {
			if (ctx.pluginID && !ctx.privileged && lazy.PluginFileAccess.hasAttachmentGrant(ctx.pluginID, path)) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_ALLOWED,
					`${path} is an attachment's file; remove the attachment through Zotero.DataStore instead`);
			}
		}

		_directoryType() {
			return {
				transactional: false,
				address: this._pathAddress(),
				resolve: (path, ctx) => this._resolveTarget("directory", path, ctx),
				revision: target => target.revision,
				describe: target => ({ id: target.path, path: target.path }),
				snapshot: target => (target.stat ? pathStat(target.path, target.stat) : null),
				operations: this._kindChecked({
					makeDir: {
						params: { recursive: BOOLEAN_PARAM },
						apply: (target, { recursive }) => this._update(target, () => lazy.FileIO.makeDirectory(target.path,
							{ createAncestors: !!recursive, ignoreExisting: !!recursive })),
					},
					rename: {
						params: { dest: lazy.Params.nonEmptyString },
						check: (target, { dest }, ctx) => this._checkDestination(target, dest, {}, ctx),
						apply: (target, { dest }) => this._move(target, dest, {}),
					},
					cp: {
						params: { dest: lazy.Params.nonEmptyString, overwrite: BOOLEAN_PARAM },
						check: (target, { dest }, ctx) => this._checkDestination(target, dest, {}, ctx),
						apply: async (target, { dest, overwrite }) => {
							dest = await this._destination(target, dest, { overwrite, replaces: true });
							await this._copyTree(target.path, dest, !!overwrite);
						},
					},
					rm: {
						terminal: true,
						params: { recursive: BOOLEAN_PARAM, force: BOOLEAN_PARAM },
						// Without recursive, IOUtils removes an empty directory and the OS refuses one with anything in it
						apply: (target, { recursive, force }) => this._io(() => lazy.FileIO.remove(target.path,
							{ recursive: !!recursive, ignoreAbsent: !!force, retryReadonly: !!force })),
					},
				}),
			};
		}

		// An existing destination is set aside under a temp name and dropped only once the copy is in place,
		// so a failure leaves it as it was
		async _copyTree(src, dest, overwrite) {
			if (!overwrite || !(await this._io(() => statPath(dest)))) {
				await this._io(() => lazy.FileIO.copy(src, dest, { recursive: true, noOverwrite: true }));
				return;
			}
			let tmp = tmpPathFor(dest);
			let old = tmpPathFor(dest);
			try {
				await this._io(async () => {
					await lazy.FileIO.copy(src, tmp, { recursive: true, noOverwrite: true });
					await lazy.FileIO.move(dest, old);
					try {
						await lazy.FileIO.move(tmp, dest);
					}
					catch (e) {
						// The old tree goes back; should even that fail, it stays beside the destination
						await lazy.FileIO.move(old, dest).catch(err => Zotero.logError(err));
						throw e;
					}
					await lazy.FileIO.remove(old, { recursive: true, ignoreAbsent: true });
				});
			}
			finally {
				await lazy.FileIO.remove(tmp, { recursive: true, ignoreAbsent: true });
			}
		}

		/**
		 * A path in the gate's canonical form; InvalidParams through `fail` when it is not absolute
		 */
		_canonical(rawPath, fail = this._fail("path")) {
			try {
				return lazy.PathIdentity.canonicalize(rawPath);
			}
			catch (e) {
				fail.invalid(e.message);
			}
			return undefined;
		}

		/**
		 * The gate, for a sandbox caller; chrome and privileged callers bypass it
		 * @param {RequestCaller | StoreCommitContext} caller
		 * @param {string} path - Canonical
		 * @param {"read" | "write"} mode
		 */
		async _checkAccess(caller, path, mode) {
			if (caller.privileged || !caller.pluginID) {
				return;
			}
			try {
				await lazy.PluginFileAccess.check(caller.pluginID, path, mode);
			}
			catch (e) {
				this._throw(lazy.StoreAPIBase.errorCodes.PERMISSION_DENIED, e.message);
			}
		}

		/**
		 * @returns {Promise<string>} The canonical path, once the caller may read it
		 */
		async _readable(rawPath, caller) {
			let path = this._canonical(rawPath);
			await this._checkAccess(caller, path, "read");
			return path;
		}

		// A read goes through the gate for reading first, as every query does; the base then takes the path a
		// commit entry would, which gates nothing without a commit context
		async _readSnapshot(type, entry, caller) {
			if (this._objectTypes.has(type) && typeof entry.path === "string") {
				entry = { ...entry, path: await this._readable(entry.path, caller) };
			}
			let snapshot = await super._readSnapshot(type, entry, caller);
			// A path of the other kind is NotFound, as it is for a commit
			if (snapshot.type !== type) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `${snapshot.path} is a ${snapshot.type}, not a ${type}`);
			}
			return snapshot;
		}

		/**
		 * Run an IOUtils call, mapping the failures that have a response code
		 */
		async _io(fn) {
			try {
				return await fn();
			}
			catch (e) {
				let code = IO_ERROR_CODES[e?.name];
				if (code) {
					this._throw(code, e.message);
				}
				throw e;
			}
		}

		async _requireStat(path) {
			let stat = await this._io(() => statPath(path));
			if (!stat) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `${path} does not exist`);
			}
			return stat;
		}

		/**
		 * The target an entry edits: the path's state before the commit, for its revision; its kind is checked as
		 * each operation applies. A commit (ctx given) runs the gate for writing here, so every prompt precedes
		 * every write
		 * @param {"file" | "directory"} type
		 * @param {string} path - Canonical
		 * @param {StoreCommitContext} [ctx]
		 */
		async _resolveTarget(type, path, ctx) {
			if (ctx) {
				await this._checkAccess(ctx, path, "write");
			}
			let stat = await this._io(() => statPath(path));
			return { type, path, stat, revision: revisionOf(stat) };
		}

		/**
		 * A reason a destination cannot be used, or nothing: the source itself under another spelling, or inside
		 * it; runs the gate for it. Both are judged where it lands, so a file put in its own directory is the
		 * source, and a link already sitting at the landing goes through the gate
		 * @param {{ recase?: boolean }} rules - `recase` lets the destination be the source under another spelling,
		 *     which a rename on a case-insensitive file system may apply
		 */
		async _checkDestination(target, rawDest, { recase }, ctx) {
			let src = target.path;
			let dest = await this._landing(target, this._canonical(rawDest, this._fail("dest")));
			await this._checkAccess(ctx, dest, "write");
			// Real paths, so another spelling or a link cannot make a file its own destination
			let realSrc = this._realPath(src);
			let realDest = this._realPath(dest);
			if (lazy.PathIdentity.same(realSrc, realDest)) {
				return (recase && differsOnlyByCase(src, dest)) ? undefined : `${dest} is the source itself`;
			}
			return lazy.PathIdentity.contains(realSrc, realDest) ? `${dest} is inside ${src}` : undefined;
		}

		/**
		 * Run a change to the target's path, then re-read what it is
		 */
		async _update(target, fn) {
			await this._io(fn);
			await this._refresh(target);
		}

		async _refresh(target) {
			target.stat = await this._io(() => statPath(target.path));
			target.revision = revisionOf(target.stat);
		}

		async _move(target, rawDest, { overwrite, recase: mayRecase }) {
			let dest = await this._destination(target, rawDest, { overwrite, recase: mayRecase });
			// Recasing a name is a move onto the same file, which noOverwrite would refuse
			let recase = !overwrite && differsOnlyByCase(target.path, dest) && this._sameFile(target.path, dest);
			await this._io(() => lazy.FileIO.move(target.path, dest, { noOverwrite: !(overwrite || recase) }));
			target.path = dest;
			await this._refresh(target);
		}

		// Where a path really leads, for identity questions; a test can answer for another file system
		_realPath(path) {
			return lazy.PathIdentity.realPath(path);
		}

		// Whether two spellings name one file: real paths agree, case folded where the OS ignores it
		_sameFile(a, b) {
			return a === b || lazy.PathIdentity.same(this._realPath(a), this._realPath(b));
		}

		async _requireFile(path) {
			let stat = await this._requireStat(path);
			if (kindOf(stat) !== "file") {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `${path} is a ${kindOf(stat)}, not a file`);
			}
			return stat;
		}

		// A range read decodes what it got, so a cut inside a multibyte character shows as U+FFFD
		async _readFile(rawPath, { encoding, offset, length }, caller) {
			let path = await this._readable(rawPath, caller);
			await this._requireFile(path);
			let bytes = await this._io(() => lazy.FileIO.read(path, { offset, maxBytes: length }));
			return { data: encoding ? encode(bytes, encoding) : bytes };
		}

		async _readDir(rawPath, withFileTypes, caller) {
			let path = await this._readable(rawPath, caller);
			let stat = await this._requireStat(path);
			if (kindOf(stat) !== "directory") {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `${path} is a ${kindOf(stat)}, not a directory`);
			}
			let children = await this._io(() => lazy.FileIO.getChildren(path));
			let names = children.map(child => lazy.FilePath.basename(child));
			if (!withFileTypes) {
				return { entries: names };
			}
			let stats = await this._io(() => Promise.all(children.map(statPath)));
			return { entries: names.map((name, i) => ({ name, type: stats[i] ? kindOf(stats[i]) : "other" })) };
		}
	}

	// The builder scripts, in chrome; every fileSystemRead sandbox gets its own copy under the same names
	let builder = lazy.ScopeUtils.loadChangeSet("chrome://zotero/content/xpcom/plugins/fileChangeSet.js", {
		globals: { FilePath: lazy.FilePath },
	});

	/**
	 * Snapshot reads and change set commits for the file system, gated by the plugin's file access. Requests
	 * take and return plain data; a change set is built locally with ChangeSet and applied by commit in order
	 *
	 * @memberof Zotero
	 */
	Zotero.FileStore = {
		errorCodes: lazy.StoreAPIBase.errorCodes,

		ChangeSet: builder.FileChangeSet,

		_fileStore: new FileStoreInternal(),

		/**
		 * @returns {string[]} The object types a change set can address
		 */
		get objectTypes() {
			return this._fileStore.objectTypes;
		},

		/**
		 * @returns {Record<string, string[]>} Operation names by object type
		 */
		get operationNames() {
			return this._fileStore.operationNames;
		},

		/**
		 * Read a file, list a directory, stat a path, or ask for access
		 * @template {keyof FileStoreQueryParams} N
		 * @param {N} name
		 * @param {FileStoreQueryParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<APIResponse<FileStoreQueryResults[N]>>}
		 */
		query(name, params, _callerPluginID) {
			return Zotero.FileStore._fileStore.query(name, params, _callerPluginID);
		},

		/**
		 * Apply a change set in order; the error says which entries were applied when one fails. Each entry's
		 * revision and snapshot are the path as that entry left it, so a later entry on the path has the latest
		 * @param {FileChangeSet | StoreChangeSet} changes
		 * @param {{ snapshots?: boolean }} [options] - snapshots: return each surviving path's new stat
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<APIResponse<StoreCommitResult>>}
		 */
		commit(changes, options, _callerPluginID) {
			return Zotero.FileStore._fileStore.commit(changes, options, _callerPluginID);
		},
	};

	Zotero.FileStore.path = lazy.FilePath;
	// The traditional form, parallel to ChangeSet and as every sandbox gets it: Zotero.FileStore.Handle.file(path)
	Zotero.FileStore.Handle = builder.ChangeSetBase.handleClass(Zotero.FileStore, builder.FileChangeSet);

	let injectCaller = ({ pluginID, args }) => {
		args[2] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.FileStore.query, injectCaller);
	lazy.ScopeVariables.setCustomParser(Zotero.FileStore.commit, injectCaller);
}
