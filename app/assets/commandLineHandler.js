let { CommandLineOptions, TestOptions } = ChromeUtils.importESModule("chrome://zotero/content/modules/commandLineOptions.mjs");

// Only allow BrowserContentHandler to open a new window if this is the initial launch,
// meaning our CLH isn't registered yet.
if (cmdLine.state != Ci.nsICommandLine.STATE_INITIAL_LAUNCH) {
	cmdLine.preventDefault = true;
}

// Handle a flag, accepting a deprecated name and recording its use so that Zotero.init() can log a
// warning once debug output is available
function handleFlag(name, deprecatedName) {
	if (cmdLine.handleFlag(name, false)) {
		return true;
	}
	if (deprecatedName && cmdLine.handleFlag(deprecatedName, false)) {
		CommandLineOptions.deprecatedFlags.push([deprecatedName, name]);
		return true;
	}
	return false;
}

function handleFlagWithParam(name, deprecatedName) {
	let value = cmdLine.handleFlagWithParam(name, false);
	if (value === null && deprecatedName) {
		value = cmdLine.handleFlagWithParam(deprecatedName, false);
		if (value !== null) {
			CommandLineOptions.deprecatedFlags.push([deprecatedName, name]);
		}
	}
	return value;
}

// Force debug output to window
if (handleFlag("debug", "ZoteroDebug")) {
	CommandLineOptions.forceDebugLog = 2;
}
// Force debug output to text console
else if (handleFlag("debug-text", "ZoteroDebugText")) {
	CommandLineOptions.forceDebugLog = 1;
}
// Write debug output to a file
CommandLineOptions.debugFile = cmdLine.handleFlagWithParam("debug-file", false);
if (CommandLineOptions.debugFile) {
	CommandLineOptions.debugFile = cmdLine.resolveFile(CommandLineOptions.debugFile).path;
}
// Pressing Ctrl-C via the terminal or ending a hung process is interpreted as a crash, and after
// three crashes Firefox starts up in automatic safe mode (troubleshooting mode). To avoid this, we
// clear the crash counter when using one of the debug-logging flags.
if (CommandLineOptions.forceDebugLog || CommandLineOptions.debugFile) {
	Services.prefs.getBranch("toolkit.startup.").clearUserPref("recent_crashes");
}

CommandLineOptions.forceDataDir = cmdLine.handleFlagWithParam("datadir", false);
// Set here, to be acted upon in xpcom/commandLineHandler.js
CommandLineOptions.file = cmdLine.handleFlagWithParam("file", false);
CommandLineOptions.url = cmdLine.handleFlagWithParam("url", false);
if (CommandLineOptions.url) {
	CommandLineOptions.url = cmdLine.resolveURI(CommandLineOptions.url);
}

var processTestOptions = false;
// -test runs the specified test files, or all tests if empty
if (cmdLine.findFlag("test", false) != -1) {
	CommandLineOptions.test = true;
	processTestOptions = true;
}
if (handleFlag("automated-test", "ZoteroAutomatedTest")) {
	CommandLineOptions.automatedTest = true;
}
if (handleFlag("skip-bundled-files", "ZoteroSkipBundledFiles")) {
	CommandLineOptions.skipBundledFiles = true;
}
if (handleFlag("skip-feed-updates")) {
	CommandLineOptions.skipFeedUpdates = true;
}

if (processTestOptions) {
	TestOptions.tests = cmdLine.handleFlagWithParam("test", false);
	TestOptions.noquit = cmdLine.handleFlag("noquit", false);
	TestOptions.makeTestData = cmdLine.handleFlag("make-test-data", false);
	TestOptions.noquit = !TestOptions.makeTestData && TestOptions.noquit;
	TestOptions.runTests = !TestOptions.makeTestData;
	TestOptions.bail = cmdLine.handleFlag("bail", false);
	TestOptions.startAt = cmdLine.handleFlagWithParam("start-at-test-file", false);
	TestOptions.stopAt = cmdLine.handleFlagWithParam("stop-at-test-file", false);
	TestOptions.shard = cmdLine.handleFlagWithParam("shard", false);
	TestOptions.grep = cmdLine.handleFlagWithParam("grep", false);
	TestOptions.timeout = handleFlagWithParam("test-timeout", "ZoteroTestTimeout");
	TestOptions.retries = cmdLine.handleFlagWithParam("retries", false) || 0;
	
	Services.ww.openWindow(
		null,
		"chrome://zotero-unit/content/runtests.html",
		"_blank",
		"chrome,dialog=no,all",
		Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray)
	);
	cmdLine.preventDefault = true;
}

if (cmdLine.handleFlag("debugger", false)) {
	(async function () {
		try {
			let portOrPath = Services.prefs.getBranch('').getIntPref('devtools.debugger.remote-port');
			
			const { DevToolsLoader } = ChromeUtils.importESModule(
				"resource://devtools/shared/loader/Loader.sys.mjs"
			);
			const loader = new DevToolsLoader({
				freshCompartment: true,
			});
			const { DevToolsServer } = loader.require("devtools/server/devtools-server");
			const { SocketListener } = loader.require("devtools/shared/security/socket");
			
			if (DevToolsServer.initialized) {
				dump("Debugger server already initialized\n\n");
				return;
			}
			
			DevToolsServer.init();
			DevToolsServer.registerAllActors();
			DevToolsServer.allowChromeProcess = true;
			const socketOptions = { portOrPath };
			const listener = new SocketListener(DevToolsServer, socketOptions);
			await listener.open();
			if (!DevToolsServer.listeningSockets) {
				throw new Error("No listening sockets");
			}
			
			dump(`Debugger server started on ${portOrPath}\n\n`);
		}
		catch (e) {
			dump(e + "\n\n");
			Components.utils.reportError(e);
		}
	})();
}
