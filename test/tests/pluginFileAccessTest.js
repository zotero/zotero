describe("Plugin File Access", function () {
	var { PluginFileAccess, PersistedGrantLayer } = ChromeUtils.importESModule(
		"chrome://zotero/content/xpcom/plugins/fileAccess.mjs"
	);
	var { PluginUUID } = ChromeUtils.importESModule(
		"chrome://zotero/content/xpcom/plugins/uuid.mjs"
	);
	var { PathIdentity } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/filePath.mjs");
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");

	var PLUGIN_ID = "test-file-access@zotero.org";
	var PLUGIN_NAME = "Test File Access Plugin";
	var PREF_PREFIX = "extensions.zotero.pluginFileAccess.";
	var PROMPT_URL = "chrome://zotero/content/pluginFileAccessPrompt.xhtml";

	var pluginUUID;
	var tempDir;
	var originalGetName;
	var mainWin;

	before(async function () {
		await Zotero.initializationPromise;
		pluginUUID = PluginUUID.getByID(PLUGIN_ID);
		tempDir = await getTempDirectory();
		// The gate compares real paths (macOS /var -> /private/var), so the test builds its paths there too, in
		// the native spelling PathUtils.join takes
		tempDir = PathIdentity.toNative(PluginFileAccess._realPath(PluginFileAccess.canonicalize(tempDir)));
		// The prompt opens with the main Zotero window as opener; make sure
		// one exists so `Zotero.getMainWindow()` resolves.
		mainWin = await loadZoteroPane();
		// AddonManager doesn't know our fake plugin -- stub getName so the
		// prompt opens with a stable display name instead of throwing.
		originalGetName = Zotero.Plugins.getName;
		Zotero.Plugins.getName = async function (id) {
			if (id === PLUGIN_ID) return PLUGIN_NAME;
			return originalGetName.call(this, id);
		};
	});

	after(async function () {
		if (originalGetName) {
			Zotero.Plugins.getName = originalGetName;
		}
		// Remove the per-plugin data dir created during registration.
		let dir = PathUtils.join(Zotero.DataDirectory.dir, "plugin-data", pluginUUID);
		try {
			await FileIO.remove(dir, { recursive: true, ignoreAbsent: true });
		}
		catch {}
	});

	beforeEach(async function () {
		// Wipe any leftover persisted grants from a previous run before register
		Zotero.Prefs.clear(PREF_PREFIX + pluginUUID, true);
		await PluginFileAccess.register(PLUGIN_ID);
	});

	afterEach(async function () {
		try {
			PluginFileAccess.clearAllGrants(PLUGIN_ID);
			PluginFileAccess.unregister(PLUGIN_ID);
		}
		catch {}
		Zotero.Prefs.clear(PREF_PREFIX + pluginUUID, true);
		// Close any prompt window left open by a failing test
		let enumerator = Services.wm.getEnumerator(null);
		while (enumerator.hasMoreElements()) {
			let win = enumerator.getNext();
			if (win.location && win.location.href === PROMPT_URL) {
				try { win.close(); }
				catch {}
			}
		}
	});

	function setPersistedGrants(grants) {
		let entries = grants.map(g => [g.path, { mode: g.mode }]);
		Zotero.Prefs.set(PREF_PREFIX + pluginUUID, JSON.stringify(entries), true);
	}

	// Open the prompt through a check in a session; the caller awaits the session after dismissing the prompt
	function triggerPrompt(path, mode = "read") {
		let promptPromise = waitForWindow(PROMPT_URL);
		let sessionPromise = PluginFileAccess.withSession(PLUGIN_ID, async () => {
			await PluginFileAccess.check(PLUGIN_ID, path, mode).catch(() => {});
		});
		return { promptPromise, sessionPromise };
	}


	describe("Registration", function () {
		it("exposes and creates the plugin data dir on register", async function () {
			let dir = PluginFileAccess.getDir(PLUGIN_ID);
			assert.isString(dir);
			assert.include(dir, pluginUUID);
			assert.isTrue(await FileIO.exists(dir), `expected ${dir} to exist after register`);
			let stat = await FileIO.stat(dir);
			assert.equal(stat.type, "directory");
		});

		it("getDir is null and check() rejects for an unregistered plugin", async function () {
			PluginFileAccess.unregister(PLUGIN_ID);
			assert.isNull(PluginFileAccess.getDir(PLUGIN_ID));
			let path = PathUtils.join(tempDir, "x.txt");
			// check() throws synchronously on the unregistered guard, so wrap it
			let e = await getPromiseError((async () => PluginFileAccess.check(PLUGIN_ID, path, "read"))());
			assert.ok(e, "check should reject without a registered plugin");
		});
	});


	describe("Plugin data directory", function () {
		it("auto-allows the plugin's own data dir without a session", async function () {
			let pluginDir = PluginFileAccess.getDir(PLUGIN_ID);
			let nested = Zotero.FileStore.path.join(pluginDir, "deep", "nested.json");
			await PluginFileAccess.check(PLUGIN_ID, nested, "write");
		});
	});


	describe("Forbidden paths", function () {
		it("denies access to Zotero data dir outside plugin-data", async function () {
			let target = PathUtils.join(Zotero.DataDirectory.dir, "zotero.sqlite");
			let e = await getPromiseError(PluginFileAccess.check(PLUGIN_ID, target, "read"));
			assert.ok(e, "data-dir access should be forbidden");
		});

		it("denies access to profile directory", async function () {
			let target = PathUtils.join(PathUtils.profileDir, "prefs.js");
			let e = await getPromiseError(PluginFileAccess.check(PLUGIN_ID, target, "read"));
			assert.ok(e, "profile-dir access should be forbidden");
		});
	});


	describe("Session grants", function () {
		it("allows a path explicitly granted in session", async function () {
			let path = PathUtils.join(tempDir, "granted.txt");
			await PluginFileAccess.withSession(PLUGIN_ID, async () => {
				PluginFileAccess.addSessionGrant(PLUGIN_ID, path, "read");
				await PluginFileAccess.check(PLUGIN_ID, path, "read");
			});
		});

		it("allows a child path of a granted directory", async function () {
			let child = PathUtils.join(tempDir, "deep", "child.txt");
			await PluginFileAccess.withSession(PLUGIN_ID, async () => {
				PluginFileAccess.addSessionGrant(PLUGIN_ID, tempDir, "read");
				await PluginFileAccess.check(PLUGIN_ID, child, "read");
			});
		});

		it("write grant covers read on the same path", async function () {
			let path = PathUtils.join(tempDir, "w-grant.txt");
			await PluginFileAccess.withSession(PLUGIN_ID, async () => {
				PluginFileAccess.addSessionGrant(PLUGIN_ID, path, "write");
				await PluginFileAccess.check(PLUGIN_ID, path, "read");
			});
		});

		it("session grants do not survive the session", async function () {
			let path = PathUtils.join(tempDir, "transient.txt");
			await PluginFileAccess.withSession(PLUGIN_ID, async () => {
				PluginFileAccess.addSessionGrant(PLUGIN_ID, path, "read");
				await PluginFileAccess.check(PLUGIN_ID, path, "read");
			});
			assert.lengthOf(PluginFileAccess.listGrants(PLUGIN_ID), 0);
		});

		it("addSessionGrant is a no-op without an active session", function () {
			let path = PathUtils.join(tempDir, "no-session.txt");
			PluginFileAccess.addSessionGrant(PLUGIN_ID, path, "read");
			assert.lengthOf(PluginFileAccess.listGrants(PLUGIN_ID), 0);
		});
	});


	describe("Persisted grants", function () {
		it("honors persisted grants without prompting", async function () {
			let path = PathUtils.join(tempDir, "persisted.txt");
			setPersistedGrants([{ path, mode: "read" }]);
			await PluginFileAccess.check(PLUGIN_ID, path, "read");
		});

		it("persisted write covers read", async function () {
			let path = PathUtils.join(tempDir, "pw.txt");
			setPersistedGrants([{ path, mode: "write" }]);
			await PluginFileAccess.check(PLUGIN_ID, path, "read");
		});

		it("listGrants returns the stored grants", function () {
			// Listed as the gate keeps them: canonical
			let p1 = PluginFileAccess.canonicalize(PathUtils.join(tempDir, "a.txt"));
			let p2 = PluginFileAccess.canonicalize(PathUtils.join(tempDir, "b.txt"));
			setPersistedGrants([
				{ path: p1, mode: "read" },
				{ path: p2, mode: "write" },
			]);
			let grants = PluginFileAccess.listGrants(PLUGIN_ID);
			let paths = grants.map(g => g.path).sort();
			assert.deepEqual(paths, [p1, p2].sort());
		});

		it("revokeGrant removes a specific path", function () {
			let p1 = PluginFileAccess.canonicalize(PathUtils.join(tempDir, "a.txt"));
			let p2 = PluginFileAccess.canonicalize(PathUtils.join(tempDir, "b.txt"));
			setPersistedGrants([
				{ path: p1, mode: "read" },
				{ path: p2, mode: "write" },
			]);
			PluginFileAccess.revokeGrant(PLUGIN_ID, p1);
			let grants = PluginFileAccess.listGrants(PLUGIN_ID);
			assert.lengthOf(grants, 1);
			assert.equal(grants[0].path, p2);
		});

		it("clearAllGrants empties the store", function () {
			setPersistedGrants([
				{ path: PathUtils.join(tempDir, "a.txt"), mode: "read" },
			]);
			PluginFileAccess.clearAllGrants(PLUGIN_ID);
			assert.lengthOf(PluginFileAccess.listGrants(PLUGIN_ID), 0);
		});
	});


	describe("Attachment grants", function () {
		it("allows a file the data store handed out, even in the data directory, without a session", async function () {
			let path = PluginFileAccess.canonicalize(PathUtils.join(Zotero.DataDirectory.dir, "storage", "ZZZZZZZZ", "granted.txt"));
			let refusal = mode => PluginFileAccess.check(PLUGIN_ID, path, mode).then(() => "", e => e.message);
			assert.match(await refusal("read"), /not accessible/);
			PluginFileAccess.grantAttachment(PLUGIN_ID, path, "read");
			assert.equal(await refusal("read"), "");
			assert.match(await refusal("write"), /not accessible/);
			PluginFileAccess.grantAttachment(PLUGIN_ID, path, "write");
			assert.equal(await refusal("write"), "");
		});
	});

	describe("Deny decisions", function () {
		it("denies when a persisted deny covers the path", async function () {
			let path = PathUtils.join(tempDir, "deny-here.txt");
			setPersistedGrants([{ path, mode: "deny" }]);
			let e = await getPromiseError(PluginFileAccess.check(PLUGIN_ID, path, "read"));
			assert.ok(e, "persisted deny should reject without prompting");
		});

		it("denies a child when a persisted deny covers parent", async function () {
			setPersistedGrants([{ path: tempDir, mode: "deny" }]);
			let nested = PathUtils.join(tempDir, "child.txt");
			let e = await getPromiseError(PluginFileAccess.check(PLUGIN_ID, nested, "read"));
			assert.ok(e, "parent deny should cover child");
		});

		it("more-specific allow overrides a higher deny", async function () {
			let nested = PathUtils.join(tempDir, "allowed-island.txt");
			setPersistedGrants([
				{ path: tempDir, mode: "deny" },
				{ path: nested, mode: "read" },
			]);
			await PluginFileAccess.check(PLUGIN_ID, nested, "read");
		});
	});


	describe("withSession lifecycle", function () {
		it("lets overlapping calls share one session, which ends with the last of them", async function () {
			let order = [];
			let s1 = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				order.push("s1-start");
				await Zotero.Promise.delay(20);
				order.push("s1-end");
			});
			let s2 = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				order.push("s2-start");
				await Zotero.Promise.delay(40);
				order.push("s2-end");
			});
			let ended = PluginFileAccess.waitForSession(PLUGIN_ID).then(() => order.push("session-end"));
			await Promise.all([s1, s2, ended]);
			assert.deepEqual(order, ["s1-start", "s2-start", "s1-end", "s2-end", "session-end"]);
		});

		it("lets a nested call join the session instead of waiting for itself", async function () {
			let path = PathUtils.join(tempDir, "nested-" + Zotero.Utilities.randomString() + ".txt");
			let inner = await PluginFileAccess.withSession(PLUGIN_ID, async () => {
				PluginFileAccess.addSessionGrant(PLUGIN_ID, path, "read");
				return PluginFileAccess.withSession(PLUGIN_ID, async () => {
					// The outer call's grant is the inner call's too
					await PluginFileAccess.check(PLUGIN_ID, path, "read");
					return "joined";
				}, { timeout: 500 });
			}, { timeout: 500 });
			assert.equal(inner, "joined");
		});

		it("waitForSession resolves after fn completes", async function () {
			let sessionDone = false;
			let s = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				await Zotero.Promise.delay(10);
				sessionDone = true;
			});
			await PluginFileAccess.waitForSession(PLUGIN_ID);
			assert.isTrue(sessionDone);
			await s;
		});

		it("times out a long-running session", async function () {
			let e = await getPromiseError(
				PluginFileAccess.withSession(PLUGIN_ID, async () => {
					await Zotero.Promise.delay(500);
				}, { timeout: 50 })
			);
			assert.ok(e, "long session should time out");
		});

		it("clears activeSession even when fn throws", async function () {
			try {
				await PluginFileAccess.withSession(PLUGIN_ID, async () => {
					throw new Error("boom");
				});
			}
			catch {}
			let ran = false;
			await PluginFileAccess.withSession(PLUGIN_ID, async () => {
				ran = true;
			});
			assert.isTrue(ran);
		});
	});


	describe("Path identity", function () {
		it("compares paths without regard to case where the default file system ignores it", function () {
			let was = { isWin: Zotero.isWin, isMac: Zotero.isMac };
			try {
				Zotero.isWin = false;
				Zotero.isMac = false;
				assert.isFalse(PathIdentity.same("/A/b", "/a/b"));
				assert.isFalse(PathIdentity.contains("/A", "/a/b"));
				assert.isFalse(PersistedGrantLayer.subsumes({ path: "/A", mode: "read" }, { path: "/a/b", mode: "read" }));
				Zotero.isMac = true;
				assert.isTrue(PathIdentity.same("/A/b", "/a/b"));
				assert.isTrue(PathIdentity.contains("/Users/X", "/users/x/doc.txt"));
				Zotero.isWin = true;
				assert.isTrue(PathIdentity.same("C:/A/b", "c:/a/B"));
				assert.isTrue(PathIdentity.contains("C:/Users/X", "c:/users/x/doc.txt"));
				assert.isFalse(PathIdentity.contains("C:/Users/X", "c:/users/xy/doc.txt"));
				assert.isTrue(PersistedGrantLayer.subsumes({ path: "C:/Users/X", mode: "write" }, { path: "c:/users/x/doc.txt", mode: "read" }));
			}
			finally {
				Object.assign(Zotero, was);
			}
		});

		it("sees through a junction on Windows", async function () {
			if (!Zotero.isWin) {
				this.skip();
			}
			// A junction needs no privilege, which is what makes it the escape to catch
			let base = await getTempDirectory();
			let target = PathUtils.join(base, "target");
			let junction = PathUtils.join(base, "junction");
			await IOUtils.makeDirectory(target);
			// Subprocess does not search PATH here
			let cmd = Services.env.get("COMSPEC") || "C:\\Windows\\System32\\cmd.exe";
			let made = await Zotero.Utilities.Internal.subprocess(cmd, ["/c", "mklink", "/J", junction, target]);
			try {
				assert.isTrue(await IOUtils.exists(junction), `mklink via ${cmd} said: ${made}`);
				// Windows stores the target's long name in the junction, so the resolved path is compared by
				// shape: a short-name spelling of the temp dir would not match it letter for letter
				let throughJunction = PathIdentity.realPath(PathIdentity.canonicalize(PathUtils.join(junction, "inside.txt")));
				assert.notInclude(throughJunction, "/junction/", "the junction should be seen through");
				assert.isTrue(throughJunction.endsWith("/target/inside.txt"), throughJunction);
			}
			finally {
				await Zotero.Utilities.Internal.subprocess(cmd, ["/c", "rmdir", junction]);
			}
		});
	});

	describe("Prompt UI", function () {
		it("renders the title, headline, checkbox, and action buttons", async function () {
			let path = PathUtils.join(tempDir, "ui-shape.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;

			for (let id of [
				"prompt-title", "prompt-headline",
				"opt-dont-ask",
				"btn-deny", "btn-allow", "btn-allow-plain",
				"allow-menu", "allow-parent",
			]) {
				assert.ok(win.document.getElementById(id), `missing #${id}`);
			}
			// Headline message + args (Fluent fills textContent async, so check
			// the l10n metadata, which is set synchronously in init()).
			let headline = win.document.getElementById("prompt-headline");
			assert.equal(headline.getAttribute("data-l10n-id"), "plugin-file-access-headline");
			let args = JSON.parse(headline.getAttribute("data-l10n-args") || "{}");
			assert.equal(args.pluginName, PLUGIN_NAME);
			assert.equal(args.type, "file");
			assert.equal(args.action, "read");
			assert.equal(args.fileName, "ui-shape.txt");
			assert.equal(args.hasDirectory, "yes");
			// Defaults for a fully-persistable path: split Allow shown, plain hidden
			assert.isFalse(win.document.getElementById("opt-dont-ask").checked);
			assert.isFalse(win.document.getElementById("allow-parent").hidden);
			assert.isFalse(win.document.getElementById("btn-allow").hidden);
			assert.isTrue(win.document.getElementById("btn-allow-plain").hidden);

			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("uses type=folder when the request path is a directory", async function () {
			// tempDir itself is a real directory; the access worker stats it
			// and passes isDirectory=true to the prompt.
			let { promptPromise, sessionPromise } = triggerPrompt(tempDir);
			let win = await promptPromise;
			let args = JSON.parse(
				win.document.getElementById("prompt-headline").getAttribute("data-l10n-args")
			);
			assert.equal(args.type, "folder");
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("main Allow (no Remember) stores a session grant for this file", async function () {
			let path = PathUtils.join(tempDir, "allow-once.txt");
			let promptPromise = waitForWindow(PROMPT_URL);
			let secondCheckResolved = false;
			let sessionPromise = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				await PluginFileAccess.check(PLUGIN_ID, path, "read");
				// Should NOT prompt again in the same session
				await PluginFileAccess.check(PLUGIN_ID, path, "read");
				secondCheckResolved = true;
			});
			let win = await promptPromise;
			win.PluginFileAccessPrompt._choose("allow", "file");
			await sessionPromise;
			assert.isTrue(secondCheckResolved);
			assert.lengthOf(PluginFileAccess.listGrants(PLUGIN_ID), 0);
		});

		it("Allow + Remember persists a file-scoped allow", async function () {
			let path = PathUtils.join(tempDir, "allow-always.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			win.document.getElementById("opt-dont-ask").checked = true;
			win.PluginFileAccessPrompt._choose("allow", "file");
			await sessionPromise;

			let grants = PluginFileAccess.listGrants(PLUGIN_ID);
			assert.isTrue(
				grants.some(g => g.path === PluginFileAccess.canonicalize(path) && g.mode === "read"),
				"expected a persisted read grant"
			);
			// Subsequent check (no session) does not prompt
			await PluginFileAccess.check(PLUGIN_ID, path, "read");
		});

		it("Allow-folder + Remember persists a parent-scoped allow", async function () {
			let path = PathUtils.join(tempDir, "scope-parent.txt");
			let promptPromise = waitForWindow(PROMPT_URL);
			let sessionPromise = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				await PluginFileAccess.check(PLUGIN_ID, path, "read");
				// A sibling should now also be allowed (no new prompt)
				let sibling = PathUtils.join(tempDir, "sibling.txt");
				await PluginFileAccess.check(PLUGIN_ID, sibling, "read");
			});
			let win = await promptPromise;
			win.document.getElementById("opt-dont-ask").checked = true;
			win.PluginFileAccessPrompt._choose("allow", "parent");
			await sessionPromise;

			let grants = PluginFileAccess.listGrants(PLUGIN_ID);
			let parent = PluginFileAccess.canonicalize(PathUtils.parent(path));
			assert.isTrue(
				grants.some(g => g.path === parent && g.mode === "read"),
				`expected a persisted read grant on parent ${parent}`
			);
		});

		it("Allow-folder (no Remember) grants a parent session-allow", async function () {
			let path = PathUtils.join(tempDir, "scope-parent-once.txt");
			let promptPromise = waitForWindow(PROMPT_URL);
			let sessionPromise = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				await PluginFileAccess.check(PLUGIN_ID, path, "read");
				let sibling = PathUtils.join(tempDir, "sibling-once.txt");
				await PluginFileAccess.check(PLUGIN_ID, sibling, "read");
			});
			let win = await promptPromise;
			win.PluginFileAccessPrompt._choose("allow", "parent");
			await sessionPromise;
			assert.lengthOf(PluginFileAccess.listGrants(PLUGIN_ID), 0);
		});

		it("Deny (no Remember) rejects and prevents re-prompting in session", async function () {
			let path = PathUtils.join(tempDir, "deny-once.txt");
			let promptPromise = waitForWindow(PROMPT_URL);
			let secondThrew = false;
			let sessionPromise = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				let first = PluginFileAccess.check(PLUGIN_ID, path, "read");
				await first.catch(() => {});
				try { await PluginFileAccess.check(PLUGIN_ID, path, "read"); }
				catch { secondThrew = true; }
			});
			let win = await promptPromise;
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
			assert.isTrue(secondThrew, "second check should still reject");
			assert.lengthOf(PluginFileAccess.listGrants(PLUGIN_ID), 0);
		});

		it("Deny + Remember persists a deny grant", async function () {
			let path = PathUtils.join(tempDir, "deny-always.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			win.document.getElementById("opt-dont-ask").checked = true;
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;

			let grants = PluginFileAccess.listGrants(PLUGIN_ID);
			assert.isTrue(
				grants.some(g => g.path === PluginFileAccess.canonicalize(path) && g.mode === "deny"),
				"expected a persisted deny grant"
			);
			let e = await getPromiseError(PluginFileAccess.check(PLUGIN_ID, path, "read"));
			assert.ok(e, "persisted deny should reject");
		});

		it("collapses the prompt when nothing can be persisted", async function () {
			// Neither a root nor any parent of it can be persisted, so only the plain Allow button shows
			let path = Zotero.isWin ? "C:\\" : "/";
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			assert.isTrue(win.document.getElementById("opt-dont-ask").hidden,
				"Remember checkbox hidden when persist is unavailable");
			assert.isTrue(win.document.getElementById("allow-parent").hidden);
			assert.isTrue(win.document.getElementById("btn-allow").hidden);
			assert.isFalse(win.document.getElementById("btn-allow-plain").hidden);
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("dropdown disappears when Remember is checked and parent isn't persistable", async function () {
			// /etc/X can be persisted but /etc cannot, so checking Remember drops the parent option
			let parent = Zotero.isWin ? "C:\\Windows" : "/etc";
			let path = PathUtils.join(parent, "dyn-dropdown.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			assert.isFalse(win.document.getElementById("opt-dont-ask").hidden);

			let parentItem = win.document.getElementById("allow-parent");
			let btnSplit = win.document.getElementById("btn-allow");
			let btnPlain = win.document.getElementById("btn-allow-plain");

			assert.isFalse(parentItem.hidden, "parent item shown when Remember unchecked");
			assert.isFalse(btnSplit.hidden, "split Allow visible when Remember unchecked");
			assert.isTrue(btnPlain.hidden, "plain Allow hidden when Remember unchecked");

			win.document.getElementById("opt-dont-ask").checked = true;
			win.PluginFileAccessPrompt._updateAllowButton();
			assert.isTrue(parentItem.hidden, "parent item hidden after Remember checked");
			assert.isTrue(btnSplit.hidden, "split Allow hidden after Remember checked");
			assert.isFalse(btnPlain.hidden, "plain Allow visible after Remember checked");

			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("Allow and Allow-folder labels swap to 'Always allow' when Remember is checked", async function () {
			let path = PathUtils.join(tempDir, "label-toggle.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let allow = win.document.getElementById("btn-allow");
			let parent = win.document.getElementById("allow-parent");
			assert.equal(allow.getAttribute("data-l10n-id"), "plugin-file-access-allow");
			assert.equal(parent.getAttribute("data-l10n-id"), "plugin-file-access-allow-folder");

			win.document.getElementById("opt-dont-ask").checked = true;
			win.PluginFileAccessPrompt._updateAllowLabel();
			win.PluginFileAccessPrompt._updateParentLabel();
			assert.equal(allow.getAttribute("data-l10n-id"), "plugin-file-access-allow-always");
			assert.equal(parent.getAttribute("data-l10n-id"), "plugin-file-access-allow-folder-always");

			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("collapses Allow to the plain button for paths where the file can't be persisted", async function () {
			// /etc itself: canPersistFile=false, no parent persistable.
			let path = Zotero.isWin ? "C:\\Windows" : "/etc";
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			assert.isTrue(win.document.getElementById("opt-dont-ask").hidden);
			assert.isTrue(win.document.getElementById("allow-parent").hidden);
			assert.isTrue(win.document.getElementById("btn-allow").hidden);
			assert.isFalse(win.document.getElementById("btn-allow-plain").hidden);
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("opens in the bottom-right of the screen", async function () {
			let path = PathUtils.join(tempDir, "position.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			// X_OFFSET=50, Y_OFFSET=30 in _positionWindow; screen.avail* gives
			// the usable area. WMs may clamp/snap, so use a generous margin.
			let expectedRight = win.screen.availLeft + win.screen.availWidth - 50;
			let expectedBottom = win.screen.availTop + win.screen.availHeight - 30;
			let actualRight = win.screenX + win.outerWidth;
			let actualBottom = win.screenY + win.outerHeight;
			assert.closeTo(actualRight, expectedRight, 50, "right edge near screen right");
			assert.closeTo(actualBottom, expectedBottom, 50, "bottom edge near screen bottom");

			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("draws into the titlebar on all platforms (borderless look)", async function () {
			let path = PathUtils.join(tempDir, "no-title.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let windowEl = win.document.querySelector("window");
			let platforms = windowEl.getAttribute("drawintitlebar-platforms");
			assert.isNotNull(platforms);
			for (let plat of ["mac", "win", "linux"]) {
				assert.include(platforms, plat);
			}
			// titlebar.js sets customtitlebar on every platform listed above
			assert.isTrue(
				win.document.documentElement.hasAttribute("customtitlebar"),
				"titlebar.js should set customtitlebar"
			);
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("closing the prompt without a choice denies as deny-once", async function () {
			let path = PathUtils.join(tempDir, "closed.txt");
			let promptPromise = waitForWindow(PROMPT_URL);
			let sessionThrew = false;
			let secondAlsoThrew = false;
			let sessionPromise = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				try { await PluginFileAccess.check(PLUGIN_ID, path, "read"); }
				catch { sessionThrew = true; }
				// cancel() resolves with persist:"once", so a re-check inside
				// the same session should be denied without re-prompting.
				try { await PluginFileAccess.check(PLUGIN_ID, path, "read"); }
				catch { secondAlsoThrew = true; }
			});
			let win = await promptPromise;
			win.PluginFileAccessPrompt.cancel();
			await sessionPromise;
			assert.isTrue(sessionThrew, "closing the prompt should deny");
			assert.isTrue(secondAlsoThrew, "cancel should leave a session-level deny");
			// Nothing was persisted
			assert.lengthOf(PluginFileAccess.listGrants(PLUGIN_ID), 0);
		});
	});


	describe("Prompt cleanup on lifecycle events", function () {
		it("unregister closes any open prompt window for the plugin", async function () {
			let path = PathUtils.join(tempDir, "unreg-cleanup.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			assert.isFalse(win.closed, "prompt should be open before unregister");

			PluginFileAccess.unregister(PLUGIN_ID);
			// The window closes asynchronously through its onclose handler.
			await waitForCallback(() => win.closed);
			// The originating check() inside the session sees deny and the
			// session fn's .catch absorbs it, so sessionPromise resolves.
			await sessionPromise;
		});

		it("session timeout closes any open prompt window for that session", async function () {
			let path = PathUtils.join(tempDir, "session-timeout-cleanup.txt");
			let promptPromise = waitForWindow(PROMPT_URL);
			// Short chrome-side session timeout; sandbox API can't override it.
			let sessionPromise = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				// Leave the check pending so the session timeout fires while
				// the prompt is still open.
				await PluginFileAccess.check(PLUGIN_ID, path, "read").catch(() => {});
				await Zotero.Promise.delay(500);
			}, { timeout: 100 });
			let win = await promptPromise;
			assert.isFalse(win.closed, "prompt should be open before timeout");

			// Session rejects with timeout; consume.
			try {
				await sessionPromise;
			}
			catch {}
			await waitForCallback(() => win.closed);
		});
	});


	describe("Prompt accessibility", function () {
		it("declares the window as an alertdialog with labelled/described relations", async function () {
			let path = PathUtils.join(tempDir, "a11y-roles.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let root = win.document.documentElement;
			assert.equal(root.getAttribute("role"), "alertdialog");
			assert.equal(root.getAttribute("aria-modal"), "true");
			assert.equal(root.getAttribute("aria-labelledby"), "prompt-title");
			assert.equal(root.getAttribute("aria-describedby"), "prompt-headline");
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("marks the title as a heading and exposes title/headline to Tab navigation", async function () {
			let path = PathUtils.join(tempDir, "a11y-tab.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let title = win.document.getElementById("prompt-title");
			let headline = win.document.getElementById("prompt-headline");
			assert.equal(title.getAttribute("role"), "heading");
			assert.equal(title.getAttribute("aria-level"), "1");
			assert.equal(title.getAttribute("tabindex"), "0");
			assert.equal(headline.getAttribute("tabindex"), "0");
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("points Deny at the title+headline initially and drops it on first blur", async function () {
			let path = PathUtils.join(tempDir, "a11y-deny.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let deny = win.document.getElementById("btn-deny");
			assert.equal(
				deny.getAttribute("aria-describedby"),
				"prompt-title prompt-headline",
				"initial aria-describedby chains title + headline"
			);
			// Once focus leaves Deny, the long description shouldn't be
			// re-read on subsequent focus.
			deny.dispatchEvent(new win.FocusEvent("blur"));
			assert.isFalse(
				deny.hasAttribute("aria-describedby"),
				"aria-describedby should be removed after blur"
			);
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});
	});


	describe("Prompt keyboard shortcuts", function () {
		// Calls the handler directly with win.close spied: a dispatched key doesn't reliably reach window
		// listeners (Escape is intercepted), and a close() from one doesn't always fire onclose in tests
		function setup(win) {
			let calls = { close: 0 };
			let originalClose = win.close.bind(win);
			win.close = () => { calls.close++; };
			let fire = (init) => {
				let event = new win.KeyboardEvent("keydown", { cancelable: true, ...init });
				win.PluginFileAccessPrompt._onKeydown(event);
			};
			let restore = () => { win.close = originalClose; };
			return { calls, fire, restore };
		}

		it("Escape requests window.close()", async function () {
			let path = PathUtils.join(tempDir, "kbd-esc.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let { calls, fire, restore } = setup(win);
			fire({ key: "Escape" });
			assert.equal(calls.close, 1, "Escape should trigger window.close()");
			restore();
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("Cmd/Ctrl+W requests window.close()", async function () {
			let path = PathUtils.join(tempDir, "kbd-w.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let { calls, fire, restore } = setup(win);
			let modifier = Zotero.isMac ? { metaKey: true } : { ctrlKey: true };
			fire({ key: "w", ...modifier });
			assert.equal(calls.close, 1, "Cmd/Ctrl+W should trigger window.close()");
			restore();
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("plain W (no modifier) doesn't close the prompt", async function () {
			let path = PathUtils.join(tempDir, "kbd-plain-w.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let { calls, fire, restore } = setup(win);
			fire({ key: "w" });
			assert.equal(calls.close, 0, "Plain W shouldn't close the prompt");
			restore();
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("Enter clicks the default Deny when no button is focused", async function () {
			let path = PathUtils.join(tempDir, "kbd-enter.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let deny = win.document.getElementById("btn-deny");
			let denyClicks = 0;
			let originalClick = deny.click.bind(deny);
			deny.click = () => { denyClicks++; };
			let { fire, restore } = setup(win);
			// Move focus off any button so the handler falls back to Deny.
			win.document.getElementById("prompt-title").focus();
			fire({ key: "Enter" });
			assert.equal(denyClicks, 1, "Enter should click the default Deny");
			deny.click = originalClick;
			restore();
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("Enter activates the focused button instead of Deny", async function () {
			let path = PathUtils.join(tempDir, "kbd-enter-focused.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let allow = win.document.getElementById("btn-allow");
			let allowClicks = 0;
			let originalClick = allow.click.bind(allow);
			allow.click = () => { allowClicks++; };
			let { fire, restore } = setup(win);
			allow.focus();
			fire({ key: "Enter" });
			assert.equal(allowClicks, 1, "Enter should click the focused Allow button");
			allow.click = originalClick;
			restore();
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("ArrowRight from Deny wraps to the visible Allow button", async function () {
			let path = PathUtils.join(tempDir, "kbd-arrow.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let allow = win.document.getElementById("btn-allow");
			let deny = win.document.getElementById("btn-deny");
			let { fire, restore } = setup(win);
			deny.focus();
			fire({ key: "ArrowRight" });
			assert.isTrue(
				win.document.activeElement === allow || allow.contains(win.document.activeElement),
				"ArrowRight from Deny should wrap to the Allow button"
			);
			restore();
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});
	});

	describe("FilePicker", function () {
		var plugin = usePluginSandbox();
		var { VarCheck } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");

		var pickedFile;
		var pickedDir;

		before(async function () {
			let scratch = await getTempDirectory();
			pickedDir = PathUtils.join(scratch, "picked-dir-" + Zotero.Utilities.randomString());
			await FileIO.makeDirectory(pickedDir);
			pickedFile = PathUtils.join(pickedDir, "picked.txt");
			await FileIO.writeUTF8(pickedFile, "picked content");
		});

		after(async function () {
			await FileIO.remove(pickedDir, { recursive: true, ignoreAbsent: true });
		});

		beforeEach(function () {
			plugin.load(["default", "fileSystemRead", "fileSystemWrite"]);
		});

		// The plugin's own picker as `picker`, over a fake native dialog the user answers with these paths
		function createPicker(paths, result = 0) {
			plugin.eval("var picker = new FilePicker();");
			VarCheck.getOriginalOrSelf(plugin.scope.picker)._fp = {
				init() {},
				open: callback => callback(result),
				file: { path: paths[0] },
				displayDirectory: null,
				// A fresh enumerator on each read, as the native picker gives
				get files() {
					let next = 0;
					return { hasMoreElements: () => next < paths.length, getNext: () => ({ QueryInterface() {}, path: paths[next++] }) };
				},
			};
		}

		// Pick in the given mode inside a session, then read each path the picker hands back
		function pickAndRead(mode) {
			return plugin.run(mode => Zotero.FileStore.withSession(async () => {
				picker.init(null, "Pick", picker[mode]);
				await picker.show();
				let paths = mode === "modeOpenMultiple" ? picker.files : [picker.file];
				let reads = [];
				for (let path of paths) {
					reads.push(await Zotero.FileStore.query("readFile", { path, encoding: "utf8" }));
				}
				return reads;
			}), mode);
		}

		it("does not expose FilePicker without fileSystemRead", function () {
			plugin.load(["default"]);
			assert.equal(plugin.eval("typeof FilePicker"), "undefined");
		});

		it("hands out paths in the canonical spelling and takes a display directory in it", function () {
			let picked = [PathUtils.join(pickedDir, "Picked.txt"), PathUtils.join(pickedDir, "Other.txt")];
			createPicker(picked);
			assert.equal(plugin.eval("picker.file"), PluginFileAccess.canonicalize(picked[0]));
			assert.deepEqual(plugin.run(() => picker.files), picked.map(p => PluginFileAccess.canonicalize(p)));
			plugin.run((dir) => {
				picker.displayDirectory = dir;
			}, PluginFileAccess.canonicalize(pickedDir));
			assert.equal(VarCheck.getOriginalOrSelf(plugin.scope.picker)._fp.displayDirectory.path, pickedDir);
			assert.equal(plugin.eval("picker.displayDirectory"), PluginFileAccess.canonicalize(pickedDir));
		});

		it("grants read on a file picked to open", async function () {
			createPicker([pickedFile]);
			let [read] = await pickAndRead("modeOpen");
			assert.equal((await requestResult(read)).data, "picked content");
		});

		it("grants read on each file picked to open together", async function () {
			let extra = PathUtils.join(pickedDir, "extra.txt");
			await FileIO.writeUTF8(extra, "extra content");
			try {
				createPicker([pickedFile, extra]);
				let reads = await pickAndRead("modeOpenMultiple");
				assert.deepEqual(reads.map(read => read.result.data), ["picked content", "extra content"]);
			}
			finally {
				await FileIO.remove(extra, { ignoreAbsent: true });
			}
		});

		it("grants write on the destination picked to save", async function () {
			let target = PathUtils.join(pickedDir, "saved-" + Zotero.Utilities.randomString() + ".txt");
			createPicker([target]);
			try {
				await requestResult(plugin.run(() => Zotero.FileStore.withSession(async () => {
					picker.init(null, "Save", picker.modeSave);
					await picker.show();
					return Zotero.FileStore.commit(Zotero.FileStore.ChangeSet.file(picker.file).writeFile("saved"));
				})));
				assert.equal(await FileIO.readUTF8(target), "saved");
			}
			finally {
				await FileIO.remove(target, { ignoreAbsent: true });
			}
		});

		it("grants write on everything inside a picked folder", async function () {
			createPicker([pickedDir]);
			let inner = PathUtils.join(pickedDir, "inside-" + Zotero.Utilities.randomString() + ".txt");
			try {
				let read = await plugin.run(name => Zotero.FileStore.withSession(async () => {
					picker.init(null, "Folder", picker.modeGetFolder);
					await picker.show();
					let path = Zotero.FileStore.path.join(picker.file, name);
					await Zotero.FileStore.commit(Zotero.FileStore.ChangeSet.file(path).writeFile("in folder"));
					return Zotero.FileStore.query("readFile", { path, encoding: "utf8" });
				}), PathUtils.filename(inner));
				assert.equal((await requestResult(read)).data, "in folder");
			}
			finally {
				await FileIO.remove(inner, { ignoreAbsent: true });
			}
		});

		it("ends the grant with the session", async function () {
			createPicker([pickedFile]);
			await pickAndRead("modeOpen");
			await requestError(plugin.run(path => Zotero.FileStore.query("readFile", { path, encoding: "utf8" }), pickedFile),
				Zotero.FileStore.errorCodes.PERMISSION_DENIED);
		});

		it("grants nothing when the picker is cancelled", async function () {
			createPicker([pickedFile], 1);
			let [read] = await pickAndRead("modeOpen");
			await requestError(read, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
		});
	});
});
