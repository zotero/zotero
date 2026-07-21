describe("Plugin File Access", function () {
	var { PluginFileAccess } = ChromeUtils.importESModule(
		"chrome://zotero/content/xpcom/plugins/file.mjs"
	);
	var { PluginUUID } = ChromeUtils.importESModule(
		"chrome://zotero/content/xpcom/plugins/uuid.mjs"
	);

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
		// Resolve symlinks (e.g. macOS /var -> /private/var) so test paths are in
		// the same canonical (real) space the file-access layer stores/compares
		// grants against (it resolves real paths for case/symlink consistency).
		let tempDirFile = Zotero.File.pathToFile(tempDir);
		tempDirFile.normalize();
		tempDir = tempDirFile.path;
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
			await IOUtils.remove(dir, { recursive: true, ignoreAbsent: true });
		}
		catch {}
	});

	beforeEach(function () {
		// Wipe any leftover persisted grants from a previous run before register
		Zotero.Prefs.clear(PREF_PREFIX + pluginUUID, true);
		PluginFileAccess.register(PLUGIN_ID);
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

	async function assertRejects(fnOrPromise, label) {
		let threw = false;
		try {
			await (typeof fnOrPromise === "function" ? fnOrPromise() : fnOrPromise);
		}
		catch {
			threw = true;
		}
		assert.isTrue(threw, label || "expected the promise to reject");
	}

	// Open the prompt by triggering a check, returning both the prompt window
	// and a handle to the in-flight session promise so the caller can await it
	// after dismissing the prompt.
	function triggerPrompt(path, mode = "read") {
		let promptPromise = waitForWindow(PROMPT_URL);
		let sessionPromise = PluginFileAccess.withSession(PLUGIN_ID, async () => {
			await PluginFileAccess.check(PLUGIN_ID, path, mode).catch(() => {});
		});
		return { promptPromise, sessionPromise };
	}


	describe("Registration", function () {
		it("exposes the plugin data dir after register", function () {
			let dir = PluginFileAccess.getDir(PLUGIN_ID);
			assert.isString(dir);
			assert.include(dir, pluginUUID);
		});

		it("creates the plugin data dir on disk on register", async function () {
			let dir = PluginFileAccess.getDir(PLUGIN_ID);
			let exists = await IOUtils.exists(dir);
			assert.isTrue(exists, `expected ${dir} to exist after register`);
			let stat = await IOUtils.stat(dir);
			assert.equal(stat.type, "directory");
		});

		it("returns null for an unregistered plugin", function () {
			PluginFileAccess.unregister(PLUGIN_ID);
			assert.isNull(PluginFileAccess.getDir(PLUGIN_ID));
		});

		it("check() rejects for an unregistered plugin", async function () {
			PluginFileAccess.unregister(PLUGIN_ID);
			let path = PathUtils.join(tempDir, "x.txt");
			await assertRejects(
				() => PluginFileAccess.check(PLUGIN_ID, path, "read"),
				"check should reject without a registered plugin"
			);
		});
	});


	describe("Plugin data directory", function () {
		it("auto-allows the plugin's own data dir without a session", async function () {
			let pluginDir = PluginFileAccess.getDir(PLUGIN_ID);
			let nested = PathUtils.join(pluginDir, "deep", "nested.json");
			await PluginFileAccess.check(PLUGIN_ID, nested, "write");
		});
	});


	describe("Forbidden paths", function () {
		it("denies access to Zotero data dir outside plugin-data", async function () {
			let target = PathUtils.join(Zotero.DataDirectory.dir, "zotero.sqlite");
			await assertRejects(
				PluginFileAccess.check(PLUGIN_ID, target, "read"),
				"data-dir access should be forbidden"
			);
		});

		it("denies access to profile directory", async function () {
			let target = PathUtils.join(PathUtils.profileDir, "prefs.js");
			await assertRejects(
				PluginFileAccess.check(PLUGIN_ID, target, "read"),
				"profile-dir access should be forbidden"
			);
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
			let p1 = PathUtils.join(tempDir, "a.txt");
			let p2 = PathUtils.join(tempDir, "b.txt");
			setPersistedGrants([
				{ path: p1, mode: "read" },
				{ path: p2, mode: "write" },
			]);
			let grants = PluginFileAccess.listGrants(PLUGIN_ID);
			let paths = grants.map(g => g.path).sort();
			assert.deepEqual(paths, [p1, p2].sort());
		});

		it("revokeGrant removes a specific path", function () {
			let p1 = PathUtils.join(tempDir, "a.txt");
			let p2 = PathUtils.join(tempDir, "b.txt");
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


	describe("Deny decisions", function () {
		it("denies when a persisted deny covers the path", async function () {
			let path = PathUtils.join(tempDir, "deny-here.txt");
			setPersistedGrants([{ path, mode: "deny" }]);
			await assertRejects(
				PluginFileAccess.check(PLUGIN_ID, path, "read"),
				"persisted deny should reject without prompting"
			);
		});

		it("denies a child when a persisted deny covers parent", async function () {
			setPersistedGrants([{ path: tempDir, mode: "deny" }]);
			let nested = PathUtils.join(tempDir, "child.txt");
			await assertRejects(
				PluginFileAccess.check(PLUGIN_ID, nested, "read"),
				"parent deny should cover child"
			);
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
		it("serializes overlapping sessions", async function () {
			let order = [];
			let s1 = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				order.push("s1-start");
				await Zotero.Promise.delay(20);
				order.push("s1-end");
			});
			let s2 = PluginFileAccess.withSession(PLUGIN_ID, async () => {
				order.push("s2");
			});
			await Promise.all([s1, s2]);
			assert.deepEqual(order, ["s1-start", "s1-end", "s2"]);
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
			await assertRejects(
				PluginFileAccess.withSession(PLUGIN_ID, async () => {
					await Zotero.Promise.delay(500);
				}, { timeout: 50 }),
				"long session should time out"
			);
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
				grants.some(g => g.path === path && g.mode === "read"),
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
			let parent = PathUtils.parent(path);
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
				grants.some(g => g.path === path && g.mode === "deny"),
				"expected a persisted deny grant"
			);
			await assertRejects(
				PluginFileAccess.check(PLUGIN_ID, path, "read"),
				"persisted deny should reject"
			);
		});

		it("hides the Remember checkbox when no scope can be persisted", async function () {
			let path = Zotero.isWin ? "C:\\" : "/";
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			assert.isTrue(
				win.document.getElementById("opt-dont-ask").hidden,
				"Remember checkbox should be hidden when persist is unavailable"
			);
			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("dropdown disappears when Remember is checked and parent isn't persistable", async function () {
			// /etc/X: file persistable, parent /etc not. With Remember unchecked
			// the dropdown shows ("Allow once for /etc"); checking Remember
			// hides the dropdown because the parent option can't be persisted.
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

		it("Allow label swaps to 'Always allow' when Remember is checked", async function () {
			let path = PathUtils.join(tempDir, "label-toggle.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let allow = win.document.getElementById("btn-allow");
			assert.equal(allow.getAttribute("data-l10n-id"), "plugin-file-access-allow");

			win.document.getElementById("opt-dont-ask").checked = true;
			win.PluginFileAccessPrompt._updateAllowLabel();
			assert.equal(allow.getAttribute("data-l10n-id"), "plugin-file-access-allow-always");

			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("Allow-folder label swaps to 'Always allow ...' when Remember is checked", async function () {
			let path = PathUtils.join(tempDir, "parent-label-toggle.txt");
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			let item = win.document.getElementById("allow-parent");
			assert.equal(item.getAttribute("data-l10n-id"), "plugin-file-access-allow-folder");

			win.document.getElementById("opt-dont-ask").checked = true;
			win.PluginFileAccessPrompt._updateParentLabel();
			assert.equal(
				item.getAttribute("data-l10n-id"),
				"plugin-file-access-allow-folder-always"
			);

			win.PluginFileAccessPrompt._choose("deny", "file");
			await sessionPromise;
		});

		it("collapses Allow to the plain button when nothing on the prompt can be persisted", async function () {
			let path = Zotero.isWin ? "C:\\" : "/";
			let { promptPromise, sessionPromise } = triggerPrompt(path);
			let win = await promptPromise;
			assert.isTrue(win.document.getElementById("allow-parent").hidden);
			assert.isTrue(win.document.getElementById("btn-allow").hidden);
			assert.isFalse(win.document.getElementById("btn-allow-plain").hidden);
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
		// Run the handler directly with a synthetic event. dispatchEvent on a
		// chrome window doesn't reliably reach window-level listeners for
		// some keys (Mozilla intercepts e.g. Escape before they bubble out),
		// and `window.close()` from inside the listener doesn't always fire
		// onclose synchronously in the test environment.
		//
		// To isolate "the handler does the right thing" from "the close path
		// works in tests", we spy on `win.close` and observe what the handler
		// does instead of waiting for the close → cancel chain.
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
});
