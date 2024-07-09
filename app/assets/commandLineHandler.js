let { CommandLineOptions, TestOptions } = ChromeUtils.importESModule("chrome://zotero/content/modules/commandLineOptions.mjs");

// Only allow BrowserContentHandler to open a new window if this is the initial launch,
// meaning our CLH isn't registered yet.
if (cmdLine.state != Ci.nsICommandLine.STATE_INITIAL_LAUNCH) {
	cmdLine.preventDefault = true;
}

// Force debug output to window
if (cmdLine.handleFlag("ZoteroDebug", false)) {
	CommandLineOptions.forceDebugLog = 2;
}
// Force debug output to text console
else if (cmdLine.handleFlag("ZoteroDebugText", false)) {
	CommandLineOptions.forceDebugLog = 1;
}
// Pressing Ctrl-C via the terminal is interpreted as a crash, and after three crashes
// Firefox starts up in automatic safe mode (troubleshooting mode). To avoid this, we clear the crash
// counter when using one of the debug-logging flags, which generally imply terminal usage.
if (CommandLineOptions.forceDebugLog) {
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
if (cmdLine.handleFlag("ZoteroTest", false)) {
	CommandLineOptions.test = true;
	processTestOptions = true;
}
if (cmdLine.handleFlag("ZoteroAutomatedTest", false)) {
	CommandLineOptions.automatedTest = true;
}
if (cmdLine.handleFlag("ZoteroSkipBundledFiles", false)) {
	CommandLineOptions.skipBundledFiles = true;
}

if (processTestOptions) {
	TestOptions.tests = cmdLine.handleFlagWithParam("test", false);
	TestOptions.noquit = cmdLine.handleFlag("noquit", false);
	TestOptions.makeTestData = cmdLine.handleFlag("makeTestData", false);
	TestOptions.noquit = !TestOptions.makeTestData && TestOptions.noquit;
	TestOptions.runTests = !TestOptions.makeTestData;
	TestOptions.bail = cmdLine.handleFlag("bail", false);
	TestOptions.startAt = cmdLine.handleFlagWithParam("startAtTestFile", false);
	TestOptions.stopAt = cmdLine.handleFlagWithParam("stopAtTestFile", false);
	TestOptions.grep = cmdLine.handleFlagWithParam("grep", false);
	TestOptions.timeout = cmdLine.handleFlagWithParam("ZoteroTestTimeout", false);
	
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
			
			const { DevToolsLoader } = ChromeUtils.import(
				"resource://devtools/shared/loader/Loader.jsm"
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
