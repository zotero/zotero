describe("PluginProtocol", function () {
	var plugin = usePluginSandbox();
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");
	var { PluginProtocol } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/protocol.mjs");

	describe("plugin resource web-accessibility", function () {
		function canLoad(sourcePrincipal, targetURI) {
			try {
				Services.scriptSecurityManager.checkLoadURIWithPrincipal(
					sourcePrincipal, targetURI, Ci.nsIScriptSecurityManager.STANDARD
				);
				return true;
			}
			catch {
				return false;
			}
		}

		it("blocks web content from loading plugin resources, allows self/chrome", function () {
			plugin.load(["default"]);
			let policy = WebExtensionPolicy.getByID(plugin.id);
			let resURI = Services.io.newURI(policy.getURL("resources.html"));
			let secMan = Services.scriptSecurityManager;

			let webPrincipal = secMan.createContentPrincipal(
				Services.io.newURI("https://example.com/"), {}
			);
			let selfPrincipal = secMan.createContentPrincipal(resURI, {});

			assert.isFalse(canLoad(webPrincipal, resURI),
				"arbitrary web content must not load plugin resources");
			assert.isTrue(canLoad(selfPrincipal, resURI),
				"the plugin's own origin must load its resources");
			assert.isTrue(canLoad(secMan.getSystemPrincipal(), resURI),
				"chrome (system principal) must load plugin resources");
		});
	});

	describe("plugin page CSP", function () {
		it("defaults to the manifestVersion-3 page CSP when the plugin declares none", function () {
			plugin.load(["default"]);
			let policy = WebExtensionPolicy.getByID(plugin.id);
			// With no manifest content_security_policy the page gets the MV3
			// default (script-src 'self'); a plugin can override it (see below).
			assert.include(policy.extensionPageCSP, "script-src 'self'");
			assert.notInclude(policy.extensionPageCSP, "unsafe-eval");
		});
	});

	describe("image-URI origin allowlist", function () {
		it("canLoadImageURI enforces the declared-resource allowlist", function () {
			plugin.load(["default"], { origins: ["https://declared.example.com/*"] });
			let check = url => PluginProtocol.canLoadImageURI(url, plugin.id);
			assert.isTrue(check("chrome://zotero/skin/x.png"), "chrome: allowed");
			assert.isTrue(check("resource://gre/x.png"), "resource: allowed");
			assert.isTrue(check("data:image/png;base64,iVBORw0KGgo="), "data:image allowed");
			assert.isTrue(check("https://declared.example.com/pic.png"), "declared host_permissions origin allowed");
			assert.isTrue(check("foo/bar.png"), "relative URL resolves to the plugin root and is allowed");
			assert.isTrue(check(""), "empty value triggers no load");
			assert.isFalse(check("https://evil.example.com/x.png"), "undeclared remote origin blocked");
			assert.isFalse(check("https://other.example.com/x.png"), "other undeclared origin blocked");
			assert.isFalse(check("javascript:alert(1)"), "javascript: blocked (not a declared origin)");
			// data: is allowed as a local scheme; text/html is inert rendered as an image
			assert.isTrue(check("data:text/html,<b>x</b>"), "data:text/html allowed (inert as an image)");
			// Own moz-extension origin is in allowedOrigins (via register), so
			// canAccessURI permits it; another plugin's origin is blocked.
			let own = WebExtensionPolicy.getByID(plugin.id).getURL("icon.png");
			assert.isTrue(check(own), "own moz-extension resource allowed");
			assert.isFalse(check("moz-extension://00000000-0000-0000-0000-000000000000/x.png"),
				"another plugin's moz-extension resource blocked");
		});
	});

	describe("resolveURI", function () {
		it("should resolve relative URIs for unprivileged plugins against moz-extension:// root", async function () {
			var tmpDir = await getTempDirectory();
			plugin.load(["default"], { resourceURI: PathUtils.toFileURI(tmpDir) + "/" });
			try {
				let resolved = await Zotero.Plugins.resolveURI(plugin.id, "content/overlay.html");
				assert.isTrue(
					resolved.startsWith("moz-extension://"),
					"Unprivileged plugin URI should be moz-extension://"
				);
				assert.isTrue(
					resolved.endsWith("/content/overlay.html"),
					"Should resolve the relative path"
				);
			}
			finally {
				await FileIO.remove(tmpDir, { recursive: true });
			}
		});
	});

	describe("plugin manifest content_security_policy (real install)", function () {
		var { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
		const INSTALL_ID = "csp-install-test@zotero.org";

		// The loader counts a plugin's moz-extension URL as untrusted, so the load must say so explicitly
		it("should run bootstrap.js from an installed XPI so startup can register a command", async function () {
			let { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
			const ID = "xpi-startup-test@zotero.org";
			let dir = await getTempDirectory();
			await FileIO.writeUTF8(PathUtils.join(dir, "manifest.json"), JSON.stringify({
				manifest_version: 2,
				name: "XPI Startup Test",
				version: "1.0." + Date.now(),
				applications: { zotero: { id: ID, update_url: "https://example.invalid/none.json", strict_max_version: "9999.*" } },
				permissions: ["pluginInterop"],
			}));
			await FileIO.writeUTF8(PathUtils.join(dir, "bootstrap.js"), `
function startup({ id }) {
	Zotero.PluginInteropManager.register({
		commandName: "exec", commandVersion: "1.0.0",
		command({ data }) { return { echo: data && data.code }; },
	});
}
function shutdown() {}
function install() {}
function uninstall() {}
`);
			let xpiPath = PathUtils.join(dir, "plugin.xpi");
			let zw = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
			zw.open(new FileUtils.File(xpiPath), 0x02 | 0x08 | 0x20);
			for (let name of ["manifest.json", "bootstrap.js"]) {
				zw.addEntryFile(name, Ci.nsIZipWriter.COMPRESSION_DEFAULT, new FileUtils.File(PathUtils.join(dir, name)), false);
			}
			zw.close();
			let addon = await AddonManager.installTemporaryAddon(new FileUtils.File(xpiPath));
			try {
				// Another plugin, declaring the installed one, calls the command its startup registered
				plugin.load(["default", "pluginInterop"], { interopPermissions: [ID] });
				let echo = await plugin.run((targetPluginID) => {
					let exec = Zotero.PluginInteropManager.getCommand({ targetPluginID, commandName: "exec" });
					return typeof exec === "function" ? exec({ code: "1+1" }) : "getCommand answered " + exec;
				}, ID);
				assert.deepEqual(echo, { echo: "1+1" });
			}
			finally {
				await addon.uninstall();
				await FileIO.remove(dir, { recursive: true, ignoreAbsent: true });
			}
		});

		it("passes the manifest content_security_policy through to installPermissions and the policy", async function () {
			let dir = await getTempDirectory();
			await FileIO.writeUTF8(
				PathUtils.join(dir, "manifest.json"),
				JSON.stringify({
					manifest_version: 2,
					name: "CSP Install Test",
					version: "1.0.0",
					applications: {
						zotero: {
							id: INSTALL_ID,
							update_url: "https://example.com/updates.json",
							strict_max_version: "9999.*",
						},
					},
					content_security_policy: "script-src 'self'; object-src 'self'; connect-src 'none';",
				})
			);
			await FileIO.writeUTF8(
				PathUtils.join(dir, "bootstrap.js"),
				"function install() {}\nfunction startup() {}\nfunction shutdown() {}\nfunction uninstall() {}\n"
			);
			let expectedCSP = "script-src 'self'; object-src 'self'; connect-src 'none';";
			let addon = await AddonManager.installTemporaryAddon(Zotero.File.pathToFile(dir));
			try {
				assert.equal(addon.installPermissions?.content_security_policy, expectedCSP,
					"manifest content_security_policy should flow into installPermissions");
				// Loading the plugin registers its WebExtensionPolicy, whose CSP is what makes the declared one enforceable
				let policy = WebExtensionPolicy.getByID(INSTALL_ID);
				assert.ok(policy, "the installed plugin has a WebExtensionPolicy");
				assert.equal(policy.extensionPageCSP, expectedCSP, "the plugin's WebExtensionPolicy uses the declared CSP");
			}
			finally {
				await addon.uninstall();
				await FileIO.remove(dir, { recursive: true, ignoreAbsent: true });
			}
		});
	});
});
