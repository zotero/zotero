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
		PluginFileAccess: "chrome://zotero/content/xpcom/plugins/fileAccess.mjs",
		PathIdentity: "chrome://zotero/content/xpcom/plugins/filePath.mjs",
		FileIO: "chrome://zotero/content/xpcom/plugins/fileIO.mjs",
		Params: "chrome://zotero/content/xpcom/pluginAPI/apiParams.mjs",
		FilePath: "chrome://zotero/content/xpcom/plugins/filePath.mjs",
	});

	const CHANGE_SET_URLS = [
		"chrome://zotero/content/xpcom/plugins/changeSetBase.js",
		"chrome://zotero/content/xpcom/plugins/fileChangeSet.js",
	];

	const OBJECT_TYPES = ["file", "directory"];

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

	const ENCODING_PARAM = {
		type: "string",
		optional: true,
		checkHook: value => value === undefined || ENCODINGS.includes(value) || "must be utf8 or base64",
	};

	const BOOLEAN_PARAM = { type: "boolean", optional: true };

	const COUNT_PARAM = {
		type: "number",
		optional: true,
		checkHook: value => value === undefined || (Number.isInteger(value) && value >= 0) || "must be a non-negative integer",
	};

	const HASHES = ["sha256", "sha384", "sha512"];

	const ALGORITHM_PARAM = {
		type: "string",
		optional: true,
		checkHook: value => value === undefined || HASHES.includes(value) || `must be one of ${HASHES.join(", ")}`,
	};

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

	/**
	 * The change set builder class, from the scripts the sandboxes load too
	 */
	function loadChangeSetClass() {
		let holder = { FilePath: lazy.FilePath };
		for (let url of CHANGE_SET_URLS) {
			Services.scriptloader.loadSubScript(url, holder);
		}
		return holder.FileChangeSet;
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
							mode: {
								type: "string",
								optional: true,
								checkHook: value => value === undefined || value === "read" || value === "write" || "must be read or write",
							},
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
			let canonical = (value, fail) => {
				try {
					return lazy.PathIdentity.canonicalize(value);
				}
				catch (e) {
					fail.invalid(e.message);
				}
				return undefined;
			};
			return {
				fields: ["path"],
				plan: (entry, _defaults, fail) => {
					if (typeof entry.path !== "string" || !entry.path) {
						fail.invalid("needs a path");
					}
					return { path: canonical(entry.path, fail) };
				},
				resolve: address => address.path,
				fromValue: (value, { what }, fail) => {
					if (typeof value !== "string" || !value) {
						fail.invalid(`${what} must be a path`);
					}
					return canonical(value, fail);
				},
			};
		}

		/**
		 * Checks run in operation order against the path's state before the entry, so an operation that
		 * creates the path marks it pending for the checks after it: a write may precede a rename
		 */
		_creates(target) {
			target.pending = true;
			return undefined;
		}

		_fileType() {
			let requireFile = target => !(target.exists || target.pending) && `${target.path} does not exist`;
			return {
				transactional: false,
				address: this._pathAddress(),
				resolve: (path, ctx) => this._resolveTarget("file", path, ctx),
				revision: target => target.revision,
				describe: target => ({ id: target.path, path: target.path }),
				snapshot: target => (target.stat ? pathStat(target.path, target.stat) : null),
				operations: {
					writeFile: {
						params: { data: DATA_PARAM, encoding: ENCODING_PARAM, overwrite: BOOLEAN_PARAM, flush: BOOLEAN_PARAM },
						check: (target, params) => checkContent(params)
							|| (params.overwrite === false && target.exists && `${target.path} exists`)
							|| this._creates(target),
						// The create mode makes the refusal the OS's too, closing the gap between check and apply
						apply: (target, { data, encoding, overwrite, flush }) => this._update(target,
							() => lazy.FileIO.write(target.path, decode(data, encoding), {
								tmpPath: tmpPathFor(target.path),
								mode: overwrite === false ? "create" : "overwrite",
								flush: !!flush,
							})),
					},
					appendFile: {
						params: { data: DATA_PARAM, encoding: ENCODING_PARAM, flush: BOOLEAN_PARAM },
						check: (target, params) => checkContent(params) || this._creates(target),
						apply: (target, { data, encoding, flush }) => this._update(target,
							() => lazy.FileIO.write(target.path, decode(data, encoding), { mode: "appendOrCreate", flush: !!flush })),
					},
					truncate: {
						params: { length: COUNT_PARAM },
						check: requireFile,
						// IOUtils has no truncate: the kept prefix is read back and written, zero-padded as Node does
						apply: async (target, { length = 0 }) => {
							let kept = length ? await this._io(() => lazy.FileIO.read(target.path, { maxBytes: length })) : new Uint8Array(0);
							let bytes = new Uint8Array(length);
							bytes.set(kept.subarray(0, length));
							await this._update(target, () => lazy.FileIO.write(target.path, bytes, { tmpPath: tmpPathFor(target.path) }));
						},
					},
					copyFile: {
						params: { dest: lazy.Params.nonEmptyString, overwrite: BOOLEAN_PARAM },
						check: async (target, { dest, overwrite }, ctx) => requireFile(target)
							|| this._checkDestination(target.path, dest, { type: "file", overwrite }, ctx),
						apply: (target, { dest, overwrite }) => this._io(
							() => lazy.FileIO.copy(target.path, this._canonical(dest), { noOverwrite: !overwrite })),
					},
					rename: {
						params: { dest: lazy.Params.nonEmptyString, overwrite: BOOLEAN_PARAM },
						check: async (target, { dest, overwrite }, ctx) => requireFile(target)
							|| this._checkDestination(target.path, dest, { type: "file", overwrite, recase: true }, ctx),
						apply: (target, { dest, overwrite }) => this._move(target, dest, !!overwrite),
					},
					rm: {
						terminal: true,
						params: { force: BOOLEAN_PARAM },
						check: (target, { force }) => !force && requireFile(target),
						apply: (target, { force }) => this._io(
							() => lazy.FileIO.remove(target.path, { ignoreAbsent: true, retryReadonly: !!force })),
					},
				},
			};
		}

		_directoryType() {
			let requireDirectory = target => !(target.exists || target.pending) && `${target.path} does not exist`;
			return {
				transactional: false,
				address: this._pathAddress(),
				resolve: (path, ctx) => this._resolveTarget("directory", path, ctx),
				revision: target => target.revision,
				describe: target => ({ id: target.path, path: target.path }),
				snapshot: target => (target.stat ? pathStat(target.path, target.stat) : null),
				operations: {
					makeDir: {
						params: { recursive: BOOLEAN_PARAM },
						check: (target, { recursive }) => (target.exists && !recursive && `${target.path} exists`)
							|| this._creates(target),
						apply: async (target, { recursive }) => {
							if (target.exists) {
								return;
							}
							await this._update(target, () => lazy.FileIO.makeDirectory(target.path,
								{ createAncestors: !!recursive, ignoreExisting: !!recursive }));
						},
					},
					rename: {
						params: { dest: lazy.Params.nonEmptyString },
						check: async (target, { dest }, ctx) => requireDirectory(target)
							|| this._checkDestination(target.path, dest, { type: "directory" }, ctx),
						apply: (target, { dest }) => this._move(target, dest, false),
					},
					cp: {
						params: { dest: lazy.Params.nonEmptyString, overwrite: BOOLEAN_PARAM },
						check: async (target, { dest, overwrite }, ctx) => requireDirectory(target)
							|| this._checkDestination(target.path, dest, { type: "directory", overwrite }, ctx),
						apply: (target, { dest, overwrite }) => this._copyTree(target.path, this._canonical(dest), !!overwrite),
					},
					rm: {
						terminal: true,
						params: { recursive: BOOLEAN_PARAM, force: BOOLEAN_PARAM },
						check: (target, { recursive, force }) => {
							if (!target.exists) {
								return !force && `${target.path} does not exist`;
							}
							return !recursive && `${target.path} is a directory; pass recursive: true`;
						},
						apply: (target, { force }) => this._io(
							() => lazy.FileIO.remove(target.path, { recursive: true, ignoreAbsent: true, retryReadonly: !!force })),
					},
				},
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
		 * A path in the gate's canonical form; InvalidParams when it is not absolute
		 */
		_canonical(rawPath, what = "path") {
			try {
				return lazy.PathIdentity.canonicalize(rawPath);
			}
			catch (e) {
				this._throw(lazy.StoreAPIBase.errorCodes.INVALID_PARAMS, `${what}: ${e.message}`);
			}
			return undefined;
		}

		/**
		 * The gate, for a sandbox caller; chrome and privileged callers bypass it
		 * @param {ControllerCaller | StoreCommitContext} caller
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
		 * The target an entry edits: the path's current state, or an absent path a later operation may create.
		 * A commit (ctx given) runs the gate for writing here, so every prompt precedes every write
		 * @param {"file" | "directory"} type
		 * @param {string} path - Canonical
		 * @param {StoreCommitContext} [ctx]
		 */
		async _resolveTarget(type, path, ctx) {
			if (ctx) {
				await this._checkAccess(ctx, path, "write");
			}
			let stat = await this._io(() => statPath(path));
			if (stat && kindOf(stat) !== type) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `${path} is a ${kindOf(stat)}, not a ${type}`);
			}
			return { path, stat, exists: !!stat, revision: revisionOf(stat) };
		}

		/**
		 * A reason an operation's destination cannot be used, or nothing; runs the gate for it
		 * @param {{ type: string, overwrite?: boolean, recase?: boolean }} rules - `recase` lets the destination be
		 *     the source under another spelling, which a rename on a case-insensitive file system may apply
		 */
		async _checkDestination(src, rawDest, { type, overwrite, recase }, ctx) {
			let dest = this._canonical(rawDest, "dest");
			await this._checkAccess(ctx, dest, "write");
			// Real paths, so another spelling or a link cannot make a file its own destination
			let realSrc = this._realPath(src);
			let realDest = this._realPath(dest);
			if (lazy.PathIdentity.same(realSrc, realDest)) {
				return (recase && differsOnlyByCase(src, dest)) ? undefined : `${dest} is the source itself`;
			}
			if (lazy.PathIdentity.contains(realSrc, realDest)) {
				return `${dest} is inside ${src}`;
			}
			let stat = await this._io(() => statPath(dest));
			if (!stat) {
				return undefined;
			}
			if (kindOf(stat) !== type) {
				return `${dest} is a ${kindOf(stat)}`;
			}
			return !overwrite && `${dest} exists`;
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
			target.exists = !!target.stat;
			target.revision = revisionOf(target.stat);
		}

		async _move(target, rawDest, overwrite) {
			let dest = this._canonical(rawDest, "dest");
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
				this._throw(lazy.StoreAPIBase.errorCodes.INVALID_PARAMS, `${path} is a ${kindOf(stat)}`);
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
				this._throw(lazy.StoreAPIBase.errorCodes.INVALID_PARAMS, `${path} is not a directory`);
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

	/**
	 * Snapshot reads and change set commits for the file system, gated by the plugin's file access. Requests
	 * take and return plain data; a change set is built locally with ChangeSet and applied by commit in order
	 *
	 * @memberof Zotero
	 */
	Zotero.FileStore = {
		objectTypes: Object.freeze(OBJECT_TYPES),

		errorCodes: lazy.StoreAPIBase.errorCodes,

		// The builder; every fileSystemRead sandbox gets its own copy under the same name
		ChangeSet: loadChangeSetClass(),

		_fileStore: new FileStoreInternal(),

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
		 * @returns {Promise<ControllerResponse<FileStoreQueryResults[N]>>}
		 */
		query(name, params, _callerPluginID) {
			return Zotero.FileStore._fileStore.query(name, params, _callerPluginID);
		},

		/**
		 * Apply a change set in order; the error says which entries were applied when one fails
		 * @param {FileChangeSet | StoreChangeSet} changes
		 * @param {{ snapshots?: boolean }} [options] - snapshots: return each surviving path's new stat
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<ControllerResponse<StoreCommitResult>>}
		 */
		commit(changes, options, _callerPluginID) {
			return Zotero.FileStore._fileStore.commit(changes, options, _callerPluginID);
		},
	};

	Zotero.FileStore.path = lazy.FilePath;

	let injectCaller = ({ pluginID, args }) => {
		args[2] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.FileStore.query, injectCaller);
	lazy.ScopeVariables.setCustomParser(Zotero.FileStore.commit, injectCaller);
}
