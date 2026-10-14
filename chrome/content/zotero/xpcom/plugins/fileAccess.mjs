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


import { setTimeout, clearTimeout, requestIdleCallback } from "resource://gre/modules/Timer.sys.mjs";
import { FileUtils } from "resource://gre/modules/FileUtils.sys.mjs";
import { PluginUUID } from "chrome://zotero/content/xpcom/plugins/uuid.mjs";
import { FilePath, PathIdentity } from "chrome://zotero/content/xpcom/plugins/filePath.mjs";
import { FileIO } from "chrome://zotero/content/xpcom/plugins/fileIO.mjs";

const FILE_ACCESS_PREF_PREFIX = "extensions.zotero.pluginFileAccess.";

// Max wall-clock duration of a `withSession` call. Generous since
// file pickers and chained ops can legitimately take minutes.
const DEFAULT_SESSION_TIMEOUT_MS = 5 * 60 * 1000;

// Directories that cannot be granted with "always" persistence, besides the home directory
let persistBlockedPaths = Services.appinfo.OS === "WINNT"
	? ["C:/", "C:/Windows", "C:/Program Files", "C:/Program Files (x86)"]
	: ["/", "/etc", "/usr", "/bin", "/sbin", "/System", "/Library"];

// The platform's own directories, canonical from here on; the data directory is a pref, so read each time
function homeDir() {
	return PathIdentity.canonicalize(FileUtils.getDir("Home", []).path);
}

function profileDir() {
	return PathIdentity.canonicalize(PathUtils.profileDir);
}

function dataDir() {
	return PathIdentity.canonicalize(Zotero.DataDirectory.dir);
}

function getPluginDataDir() {
	return FilePath.join(dataDir(), "plugin-data");
}

function isPersistBlocked(path) {
	let real = PluginFileAccess._realPath(path);
	return [homeDir(), ...persistBlockedPaths].some(p => PathIdentity.contains(real, PluginFileAccess._realPath(p)));
}

function isForbidden(realPath) {
	if (PathIdentity.contains(PluginFileAccess._realPath(profileDir()), realPath)) {
		return true;
	}
	if (PathIdentity.contains(PluginFileAccess._realPath(dataDir()), realPath)) {
		return !PathIdentity.contains(PluginFileAccess._realPath(getPluginDataDir()), realPath);
	}
	return false;
}

/**
 * Open the prompt window and resolve when the user makes a choice.
 *
 * @param {string} pluginID
 * @param {string} path
 * @param {"read"|"write"} mode
 * @param {Object} promptArgs
 * @param {Object} [options]
 * @param {Function} [options.onWindowOpen]
 */
async function showPrompt(pluginID, path, mode, promptArgs, options = {}) {
	let { canPersistFile, canPersistParent, parentPath, isDirectory } = promptArgs;
	let { onWindowOpen } = options;
	let pluginName = await Zotero.Plugins.getName(pluginID) || pluginID;
	return new Promise((resolve) => {
		// Idempotent so a force-close settles as a deny instead of leaving the prompt worker hung.
		let settled = false;
		let settle = (answer) => {
			if (settled) return;
			settled = true;
			resolve(answer);
		};
		let args = {
			pluginID,
			pluginName,
			path,
			mode,
			canPersistFile,
			canPersistParent,
			parentPath,
			isDirectory,
			resolve: settle,
		};
		let win = Services.ww.openWindow(
			null,
			"chrome://zotero/content/pluginFileAccessPrompt.xhtml",
			"_blank",
			"chrome,resizable=no,alwaysontop=yes",
			args,
		);
		win.addEventListener("load", () => {
			win.addEventListener("unload", () => {
				settle({ decision: "deny", persist: "once", scope: "file", reason: "closed" });
			}, { once: true });
		}, { once: true });
		if (onWindowOpen) onWindowOpen(win);
	});
}

// TEMP: This is for the preference pane plugins page
async function _getDirSize(path) {
	if (!path) return 0;
	try {
		if (!(await FileIO.exists(path))) return 0;
		// The commands below take the platform's spelling
		let nativePath = PathIdentity.toNative(path);
		if (Services.appinfo.OS === "WINNT") {
			let escaped = nativePath.replace(/'/g, "''");
			let out = await Zotero.Utilities.Internal.subprocess(
				"powershell.exe",
				[
					"-NoProfile",
					"-Command",
					"$ErrorActionPreference='SilentlyContinue';"
					+ `[long]((Get-ChildItem -LiteralPath '${escaped}' -Recurse -File -Force`
					+ " | Measure-Object -Property Length -Sum).Sum)",
				]
			);
			return parseInt(out.trim()) || 0;
		}
		let out = await Zotero.Utilities.Internal.subprocess("du", ["-sk", nativePath]);
		let m = out.trim().match(/^(\d+)/);
		return m ? parseInt(m[1]) * 1024 : 0;
	}
	catch (e) {
		Zotero.logError(e);
		return 0;
	}
}


class GrantLayer {
	static VALID_MODES = ["read", "write", "deny"];

	/**
	 * If `stronger`'s grant makes `weaker`'s grant redundant:
	 * - `stronger.mode` implies `weaker.mode` (same mode, or write implies read)
	 * - and `stronger.path` covers `weaker.path`
	 */
	static subsumes(stronger, weaker, { skipPathCheck = false } = {}) {
		if (stronger.mode !== weaker.mode) {
			if (!(stronger.mode === "write" && weaker.mode === "read")) {
				return false;
			}
		}
		if (skipPathCheck) return true;
		return PathIdentity.same(stronger.path, weaker.path) || PathIdentity.contains(stronger.path, weaker.path);
	}

	/**
	 * @returns {Map<string, { mode: string }>} Map of path -> { mode }
	 */
	get cache() {
		throw new Error("GrantLayer.cache getter must be implemented by subclass");
	}

	* _grants() {
		for (let { path, mode } of this.cache.values()) {
			yield { path, mode };
		}
	}

	// Keyed by the folded spelling, so a lookup matches however the path was cased
	_get({ path }) {
		return this.cache.get(PathIdentity.foldCase(path));
	}

	_set({ path, mode }) {
		this.cache.set(PathIdentity.foldCase(path), { path, mode });
	}

	_delete({ path }) {
		this.cache.delete(PathIdentity.foldCase(path));
	}

	_batchDelete(grants) {
		for (let g of grants) {
			this._delete(g);
		}
	}

	_clear() {
		this.cache.clear();
	}

	_validate({ path, mode }) {
		if (!path || !GrantLayer.VALID_MODES.includes(mode)) {
			return false;
		}
		return true;
	}

	add({ path, mode }) {
		if (!this._validate({ path, mode })) {
			throw new Error(`Invalid grant: ${JSON.stringify({ path, mode })}`);
		}
		if (this.has({ path, mode })) return;

		this._set({ path, mode });

		// Defer cleanup
		requestIdleCallback(() => {
			this._removeRedundant({ path, mode });
		});
	}

	remove(predicate) {
		let toDelete = [];
		for (let g of this.list()) {
			if (predicate(g)) {
				toDelete.push(g);
			}
		}
		this._batchDelete(toDelete);
	}

	clear() {
		this._clear();
	}

	list() {
		return [...this._grants()];
	}

	has({ path, mode }) {
		let currentPath = path;
		let cache = this.cache;
		while (currentPath) {
			let g = cache.get(PathIdentity.foldCase(currentPath));
			if (g && GrantLayer.subsumes(g, { path, mode }, { skipPathCheck: true })) {
				return true;
			}
			currentPath = PathIdentity.parent(currentPath);
		}
		return false;
	}

	/**
	 * Walk up from `path` to the closest covering grant and return its verdict:
	 * - "allow" if the grant's mode covers the requested mode
	 * - "deny"  if a deny grant covers the path
	 * - null    if no grant covers
	 */
	getDecision({ path, mode }) {
		let currentPath = path;
		let cache = this.cache;
		while (currentPath) {
			let g = cache.get(PathIdentity.foldCase(currentPath));
			if (g) {
				if (g.mode === "deny") return "deny";
				if (g.mode === mode || (g.mode === "write" && mode === "read")) {
					return "allow";
				}
			}
			currentPath = PathIdentity.parent(currentPath);
		}
		return null;
	}

	/**
	 * Remove grants made redundant by the newly-added `grant`
	 */
	_removeRedundant({ path, mode }) {
		for (let g of this.list()) {
			if (g.path === path && g.mode === mode) continue;
			if (g.path === path) {
				this._delete(g);
				continue;
			}
			if (GrantLayer.subsumes({ path, mode }, g)) {
				this._delete(g);
			}
		}
	}
}


class SessionGrantLayer extends GrantLayer {
	_cache = new Map();

	donePromise = null;

	resolveDone = null;

	constructor() {
		super();
		this.donePromise = new Promise((resolve) => {
			this.resolveDone = resolve;
		});
	}

	get cache() {
		return this._cache;
	}
}


/** Persistent grants stored as a JSON under
 `extensions.zotero.pluginFileAccess.<PLUGIN_UUID>`.
*/
class PersistedGrantLayer extends GrantLayer {
	_cache = new Map();

	_cacheKey = null;

	constructor(pluginUUID) {
		super();
		this._prefKey = FILE_ACCESS_PREF_PREFIX + pluginUUID;
	}

	_updateCache() {
		let raw = Zotero.Prefs.get(this._prefKey, true);
		if (raw === this._cacheKey) return;
		this._cache.clear();
		if (!raw) return;
		try {
			let parsed = JSON.parse(raw);
			let entries = [];
			for (let entry of Array.isArray(parsed) ? parsed : []) {
				if (!Array.isArray(entry) || entry.length < 2) continue;
				let [path, value] = entry;
				if (typeof path !== "string" || !path) continue;
				if (!value || typeof value !== "object" || !GrantLayer.VALID_MODES.includes(value.mode)) continue;
				// Resolved again, since a link on the way may have changed since the grant was made
				let real = path;
				try {
					real = PluginFileAccess._realPath(path);
				}
				catch (e) {
					Zotero.logError(e);
					continue;
				}
				entries.push([PathIdentity.foldCase(real), { path: real, mode: value.mode }]);
			}
			this._cache = new Map(entries);
			this._cacheKey = raw;
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(`Invalid persisted grants for ${this._prefKey}, clearing`);
			Zotero.Prefs.set(this._prefKey, "[]", true);
			this._cacheKey = "[]";
		}
	}

	_writeCache() {
		let entries = [...this._cache.values()].map(({ path, mode }) => [path, { mode }]);
		let raw = JSON.stringify(entries);
		Zotero.Prefs.set(this._prefKey, raw, true);
		this._cacheKey = raw;
	}

	get cache() {
		this._updateCache();
		return this._cache;
	}

	_set(grant) {
		super._set(grant);
		this._writeCache();
	}

	_delete(grant) {
		super._delete(grant);
		this._writeCache();
	}

	_batchDelete(grants) {
		super._batchDelete(grants);
		this._writeCache();
	}

	_clear() {
		super._clear();
		this._writeCache();
	}
}


/**
 * Per-plugin file-access state. Owns the persisted grant store, the
 * (at most one) active session, and the prompt queue/worker pair.
 */
class FileAccessState {
	pluginID;

	uuid;

	persistedGrants;

	activeSession = null;

	queue = [];

	worker = null;

	// window -> session ref
	openPromptWindows = new Map();

	constructor(pluginID) {
		this.pluginID = pluginID;
		this.uuid = PluginUUID.getByID(pluginID);
		this.persistedGrants = new PersistedGrantLayer(this.uuid);
	}

	destroy() {
		for (let req of this.queue) {
			try {
				req.resolve({ decision: "deny", reason: "plugin-unloaded" });
			}
			catch {}
		}
		this.queue.length = 0;
		if (this.activeSession) {
			try {
				this.activeSession.resolveDone();
			}
			catch {}
			this.activeSession = null;
		}
		this._closeOpenPrompts();
	}

	_closeOpenPrompts(sessionFilter = null) {
		let toClose = [];
		for (let [win, session] of this.openPromptWindows) {
			if (sessionFilter === null || session === sessionFilter) {
				toClose.push(win);
			}
		}
		for (let win of toClose) {
			this.openPromptWindows.delete(win);
			try {
				win.close();
			}
			catch {}
		}
	}

	getDir() {
		return FilePath.join(getPluginDataDir(), this.uuid);
	}

	_tempDirPath() {
		return FilePath.join(PathIdentity.canonicalize(Zotero.getTempDirectory().path), `plugin-${this.uuid}`);
	}

	/**
	 * A scratch directory under Zotero's, always allowed like the data directory and gone with Zotero's
	 */
	async getTempDir() {
		let dir = this._tempDirPath();
		await FileIO.makeDirectory(dir);
		return dir;
	}

	/**
	 * Check whether the plugin has the necessary grant for `rawPath` and `mode`.
	 * If not, prompt the user and update grants based on the response.
	 * @param {String} rawPath
	 * @param {"read"|"write"} mode
	 * @returns {Promise<void>}
	 * @throws {Error} if access is not granted
	 */
	async check(rawPath, mode) {
		if (mode !== "read" && mode !== "write") {
			throw new Error(`Invalid file access mode: ${mode}`);
		}
		let path = PathIdentity.canonicalize(rawPath);
		let realPath = PluginFileAccess._realPath(path);

		if (isForbidden(realPath)) {
			throw new Error(
				`Permission denied: ${path} is not accessible to plugins`,
			);
		}

		let prior = this._getDecision(realPath, mode);
		if (prior === "allow") return;
		if (prior === "deny") {
			throw new Error(`Permission denied: plugin cannot ${mode} "${path}"`);
		}

		let sessionAtPrompt = this.activeSession;

		// Prompt for and store the grant against the resolved real path
		let answer = await this._promptOrReuse(realPath, mode);
		if (!answer) {
			throw new Error(`Permission denied: plugin cannot ${mode} "${path}"`);
		}

		let isDeny = answer.decision === "deny";
		let grantPath = answer.scope === "parent"
			? (PathIdentity.parent(realPath) || realPath)
			: realPath;
		let grant = { path: grantPath, mode: isDeny ? "deny" : mode };

		if (answer.persist === "always") {
			this.persistedGrants.add(grant);
		}
		else if (answer.persist === "once") {
			if (sessionAtPrompt) {
				sessionAtPrompt.add(grant);
			}
			// With no session active when we prompted, allow only once
		}

		if (isDeny) {
			throw new Error(`Permission denied: plugin cannot ${mode} "${path}"`);
		}
	}

	async withSession(fn, options = {}) {
		let timeout = options.timeout || DEFAULT_SESSION_TIMEOUT_MS;

		while (this.activeSession) {
			await Promise.race([
				this.waitForSession(),
				new Promise((resolve, reject) => setTimeout(
					() => reject(new Error(`Timed out waiting for active session to end for plugin ${this.pluginID}`)),
					timeout,
				)),
			]);
		}

		let session = new SessionGrantLayer();
		this.activeSession = session;

		let runTimeoutHandle;
		let runTimeout = new Promise((_, reject) => {
			runTimeoutHandle = setTimeout(
				() => reject(new Error(`Session exceeded max duration (>${timeout}ms)`)),
				timeout,
			);
		});

		try {
			let fnPromise = Promise.resolve().then(() => fn());
			// Suppress unhandled-rejection warnings if the timeout wins
			fnPromise.catch(() => {});
			return await Promise.race([fnPromise, runTimeout]);
		}
		finally {
			clearTimeout(runTimeoutHandle);
			if (this.activeSession === session) {
				this.activeSession = null;
			}
			session.resolveDone();
			// If the session ends with a prompt still open (e.g. timeout
			// abandoned the fn mid-await), close it. The user shouldn't be
			// left staring at a prompt whose answer can no longer matter.
			this._closeOpenPrompts(session);
		}
	}

	async waitForSession() {
		if (this.activeSession) {
			await this.activeSession.donePromise;
		}
	}

	addSessionGrant(rawPath, mode) {
		if (mode !== "read" && mode !== "write") {
			throw new Error(`Invalid grant mode: ${mode}`);
		}
		if (!this.activeSession) return;
		let path;
		try {
			path = PluginFileAccess._realPath(PathIdentity.canonicalize(rawPath));
		}
		catch (e) {
			Zotero.logError(e);
			return;
		}
		this.activeSession.add({ path, mode });
	}

	listGrants() {
		return this.persistedGrants.list();
	}

	revokeGrant(path, mode = null) {
		this.persistedGrants.remove(
			g => g.path === path && (mode === null || g.mode === mode),
		);
	}

	clearAllGrants() {
		this.persistedGrants.clear();
	}

	/**
	 * @returns {"allow"|"deny"|null}
	 */
	_getDecision(realPath, mode) {
		for (let own of [this.getDir(), this._tempDirPath()]) {
			let real = PluginFileAccess._realPath(own);
			if (real && PathIdentity.contains(real, realPath)) {
				return "allow";
			}
		}
		if (this.activeSession) {
			let d = this.activeSession.getDecision({ path: realPath, mode });
			if (d) return d;
		}
		return this.persistedGrants.getDecision({ path: realPath, mode });
	}

	_promptOrReuse(path, mode) {
		for (let req of this.queue) {
			if (req.path === path && req.mode === mode) return req.promise;
		}
		let resolveFn;
		let promise = new Promise((resolve) => {
			resolveFn = resolve;
		});
		let req = { path, mode, resolve: resolveFn, promise };
		this.queue.push(req);
		if (!this.worker) {
			this.worker = this._runPromptWorker().finally(() => {
				this.worker = null;
			});
		}
		return promise;
	}

	async _runPromptWorker() {
		while (this.queue.length) {
			let req = this.queue[0];
			let canPersistFile = !isPersistBlocked(req.path);
			let canPersistParent = false;
			let parentPath = PathIdentity.parent(req.path);
			if (parentPath) {
				canPersistParent = !isPersistBlocked(parentPath);
			}

			let isDirectory = false;
			try {
				isDirectory = (await FileIO.stat(req.path)).type === "directory";
			}
			catch {}

			let promptWindow;
			let owningSession = this.activeSession;
			let answer;
			try {
				answer = await showPrompt(
					this.pluginID, req.path, req.mode,
					{ canPersistFile, canPersistParent, parentPath, isDirectory },
					{
						onWindowOpen: (win) => {
							promptWindow = win;
							this.openPromptWindows.set(win, owningSession);
						},
					},
				);
			}
			catch (e) {
				Zotero.logError(e);
				answer = { decision: "deny", reason: "prompt-error" };
			}
			finally {
				if (promptWindow) {
					this.openPromptWindows.delete(promptWindow);
				}
			}
			if (this.queue[0] === req) {
				this.queue.shift();
			}
			try {
				req.resolve(answer);
			}
			catch {}
		}
	}
}


const PluginFileAccess = {
	// pluginID -> PluginState
	_states: new Map(),

	// Every real-path lookup of the gate goes through here, so a test can say where a path leads
	_realPath: PathIdentity.realPath,

	// The state answers at once; the plugin's data directory exists once the promise resolves
	register(pluginID) {
		let state = new FileAccessState(pluginID);
		this._states.set(pluginID, state);
		return FileIO.makeDirectory(state.getDir());
	},

	unregister(pluginID) {
		let state = this._states.get(pluginID);
		if (!state) return;
		state.destroy();
		this._states.delete(pluginID);
	},

	_requireState(pluginID) {
		let state = this._states.get(pluginID);
		if (!state) {
			throw new Error(`Plugin ${pluginID} is not registered for file access`);
		}
		return state;
	},

	check(pluginID, rawPath, mode) {
		return this._requireState(pluginID).check(rawPath, mode);
	},

	withSession(pluginID, fn, options) {
		return this._requireState(pluginID).withSession(fn, options);
	},

	waitForSession(pluginID) {
		return this._requireState(pluginID).waitForSession();
	},

	getDir(pluginID) {
		let state = this._states.get(pluginID);
		return state ? state.getDir() : null;
	},

	getTempDir(pluginID) {
		let state = this._states.get(pluginID);
		return state ? state.getTempDir() : null;
	},

	/**
	 * The canonical form of an absolute native path or file: URL, which every grant and check uses
	 * @throws {Error} For a relative path
	 */
	canonicalize: PathIdentity.canonicalize,

	addSessionGrant(pluginID, rawPath, mode) {
		let state = this._states.get(pluginID);
		if (!state) return;
		state.addSessionGrant(rawPath, mode);
	},

	listGrants(pluginID) {
		let state = this._states.get(pluginID);
		return state ? state.listGrants() : [];
	},

	revokeGrant(pluginID, path, mode = null) {
		let state = this._states.get(pluginID);
		if (!state) return;
		state.revokeGrant(path, mode);
	},

	clearAllGrants(pluginID) {
		let state = this._states.get(pluginID);
		if (!state) return;
		state.clearAllGrants();
	},

	getDataDirByUUID(uuid) {
		return FilePath.join(getPluginDataDir(), uuid);
	},

	async getDataDirSizeByUUID(uuid) {
		return _getDirSize(this.getDataDirByUUID(uuid));
	},

	async clearDataDirByUUID(uuid) {
		await this.deleteDataDirByUUID(uuid);
		await FileIO.makeDirectory(this.getDataDirByUUID(uuid));
	},

	async deleteDataDirByUUID(uuid) {
		let dir = this.getDataDirByUUID(uuid);
		try {
			await FileIO.remove(dir, { recursive: true, ignoreAbsent: true });
		}
		catch (e) {
			Zotero.logError(e);
		}
	},

	listFileAccessUUIDs() {
		return Services.prefs.getBranch(FILE_ACCESS_PREF_PREFIX).getChildList("");
	},

	clearFileAccess(uuid) {
		Zotero.Prefs.clear(FILE_ACCESS_PREF_PREFIX + uuid, true);
	},
};

export { PluginFileAccess, PersistedGrantLayer };
