var { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");

var { ZOTERO_CONFIG } = ChromeUtils.importESModule('resource://zotero/config.mjs');
var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
var { TestOptions } = ChromeUtils.importESModule("chrome://zotero/content/modules/commandLineOptions.mjs");
var { OS } = ChromeUtils.importESModule("chrome://zotero/content/osfile.mjs");

// Mocha HTML reporter doesn't show deepEqual diffs, so we change this.
chai.config.truncateThreshold = 0

function quit(failed) {
	// Quit with exit status
	if(!failed) {
		IOUtils.write(PathUtils.join(FileUtils.getDir("ProfD", []).path, "success"), new Uint8Array(0));
	}
	if(!TestOptions.noquit) {
		setTimeout(function () {
			Components.classes['@mozilla.org/toolkit/app-startup;1']
				.getService(Components.interfaces.nsIAppStartup)
				.quit(Components.interfaces.nsIAppStartup.eForceQuit);
		}, 250);
	}
}

if (TestOptions.makeTestData) {
	let dataPath = getTestDataDirectory().path;
	
	Zotero.Prefs.set("export.citePaperJournalArticleURL", true);
	
	let dataFiles = [
		{
			name: 'allTypesAndFields',
			func: generateAllTypesAndFieldsData
		},
		{
			name: 'itemJSON',
			func: generateItemJSONData,
			args: [null]
		},
		{
			name: 'citeProcJSExport',
			func: generateCiteProcJSExportData
		},
		{
			name: 'translatorExportLegacy',
			func: generateTranslatorExportData,
			args: [true]
		},
		{
			name: 'translatorExport',
			func: generateTranslatorExportData,
			args: [false]
		}
	];
	(async function () {
		await Zotero.initializationPromise;
		for (let i=0; i<dataFiles.length; i++) {
			let first = !i;
			let params = dataFiles[i];

			// Make sure to not run next loop if previous fails
			if (!first) dump('\n');
			dump('Generating data for ' + params.name + '...');

			let filePath = PathUtils.join(dataPath, params.name + '.js');
			let exists = await IOUtils.exists(filePath);
			let currentData;
			if (exists) {
				currentData = loadSampleData(params.name);
			}

			let args = params.args || [];
			args.push(currentData);
			let newData = params.func.apply(null, args);
			if (newData instanceof Promise) {
				newData = await newData;
			}
			let str = stableStringify(newData);

			await IOUtils.writeUTF8(PathUtils.join(dataPath, params.name + '.js'), str);
			dump('\nWritten to ' + PathUtils.join(dataPath, params.name + '.js\n'));
		}
		dump("\n");
	})()
	.catch(function(e) { dump('\n'); dump(Zotero.Utilities.varDump(e)) })
	.finally(function() { quit(false) });
}

function Reporter(runner) {
	var indents = 0, passed = 0, failed = 0, aborted = false;

	function indent() {
		return Array(indents).join('  ');
	}

	runner.on('start', function(){});

	runner.on('suite', function(suite){
		++indents;
		dump(indent() + suite.title + "\n");
	});

	runner.on('suite end', function(suite){
		--indents;
		if (1 == indents) dump("\n");
	});

	runner.on('pending', function(test){
		dump(indent() + "pending  -" + test.title + "\n");
	});

	runner.on('pass', function(test){
		passed++;
		var msg = indent() + Mocha.reporters.Base.symbols.ok + " " + test.title;
		if ('fast' != test.speed) {
			msg += " ("+Math.round(test.duration)+" ms)";
		}
		if (test._currentRetry > 0) {
			msg += " (passed on retry " + test._currentRetry + ")";
		}
		dump(msg+"\n");
	});

	function cleanErrorStack(err) {
		// Remove internal code references
		err.stack = err.stack.replace(/.+(?:zotero-unit\/|\/Task\.jsm|zotero\/bluebird\/).+\n?/g, "");
		
		// Strip "From previous event:" block if it's all internals
		if (err.stack.includes('From previous event:')) {
			err.stack = err.stack
				// Drop first line, because it contains the error message
				.replace(/^.+\n/, '')
				// Drop "From previous event:" labels for empty blocks
				.replace(/.*From previous event:.*(?:\n(?=\s*From previous event:)|\s*$)/g, '');
		}
		
		// Make sure there's a blank line after all stack traces
		err.stack = err.stack.replace(/\s*$/, '\n\n');
	}
	
	runner.on('retry', function (test, err) {
		cleanErrorStack(err);
		let indentStr = indent();
		dump(indentStr
			// Yellow X for failures that will be retried
			+ "\x1B[33;40m" + Mocha.reporters.Base.symbols.err + " [FAIL -- retrying]\x1B[0m"
			+ " " + test.title + "\n"
			+ indentStr + "  " + err.message + " at\n"
			+ err.stack.replace(/^/gm, indentStr + "    ").trim() + "\n\n");
	});
	
	runner.on('fail', function(test, err){
		cleanErrorStack(err);
		
		failed++;
		let indentStr = indent();
		dump(indentStr
			// Dark red X for errors
			+ "\x1B[31;40m" + Mocha.reporters.Base.symbols.err + " [FAIL]\x1B[0m"
			// Trigger bell if interactive
			+ (Zotero.automatedTest ? "" : "\x07")
			+ " " + test.title + "\n"
			+ indentStr + "  " + err.message + " at\n"
			+ err.stack.replace(/^/gm, indentStr + "    ").trim() + "\n\n");
		
		if (TestOptions.bail) {
			aborted = true;
			runner.abort();
		}
	});

	runner.on('end', function() {
		dump(passed + "/" + (passed + failed) + " tests passed"
			+ (aborted ? " -- aborting" : "") + "\n");
		quit(failed != 0);
	});
}

// Setup Mocha
mocha.setup({
	ui: "bdd",
	reporter: Reporter,
	timeout: TestOptions.timeout || 10000,
	grep: TestOptions.grep,
	retries: TestOptions.retries || 0,
});

coMocha(Mocha);

before(function () {
	// Store all prefs set in runtests.sh
	var prefBranch = Services.prefs.getBranch(ZOTERO_CONFIG.PREF_BRANCH);
	TestOptions.customPrefs = {};
	prefBranch.getChildList("", {})
		.filter(key => prefBranch.prefHasUserValue(key))
		.forEach(key => TestOptions.customPrefs[key] = Zotero.Prefs.get(key));
});

/**
 * Clear all prefs, and reset those set in runtests.sh to original values
 */
function resetPrefs() {
	var prefBranch = Services.prefs.getBranch(ZOTERO_CONFIG.PREF_BRANCH);
	prefBranch.getChildList("", {}).forEach(key => {
		var origVal = TestOptions.customPrefs[key];
		if (origVal !== undefined) {
			if (origVal != Zotero.Prefs.get(key)) {
				Zotero.Prefs.set(key, TestOptions.customPrefs[key]);
			}
		}
		else if (prefBranch.prefHasUserValue(key)) {
			Zotero.Prefs.clear(key)
		}
	});
}

// TEMP: Track when the main window loses focus-manager activation, to diagnose
// intermittent focus-test timeouts (zoteroPaneTest #focus()). Surfaced in that
// test's failure message.
var focusDiag = { lastActive: null, firstInactive: null };

afterEach(function () {
	resetPrefs();

	try {
		let win = Zotero.getMainWindow();
		let title = this.currentTest && this.currentTest.fullTitle();
		if (win && Services.focus.activeWindow === win) {
			focusDiag.lastActive = title;
		}
		else if (!focusDiag.firstInactive) {
			focusDiag.firstInactive = title;
		}
	}
	catch (e) {}
});


var assert = chai.assert,
    expect = chai.expect;

// Set up tests to run
var run = TestOptions.runTests;
if (run && TestOptions.tests) {
	function getTestFilename(test) {
		// Remove any directory prefixes e.g. tests/fooTest.js, test/tests/fooTest.js
		test = test.split(/[/\\]/).pop();
		// Allow foo, fooTest, fooTest.js 
		test = test.replace(/\.js$/, "");
		test = test.replace(/Test$/, "");
		return test + "Test.js";
	}
	
	var testDirectory = getTestDataDirectory().parent,
	    testFiles = [];
	if(TestOptions.tests == "all") {
		var enumerator = testDirectory.directoryEntries;
		let startFile = TestOptions.startAt ? getTestFilename(TestOptions.startAt) : false;
		let started = !startFile;
		let stopFile = TestOptions.stopAt ? getTestFilename(TestOptions.stopAt) : false;
		while(enumerator.hasMoreElements()) {
			var file = enumerator.getNext().QueryInterface(Components.interfaces.nsIFile);
			if (file.leafName.endsWith(".js")) {
				testFiles.push(file.leafName);
			}
		}
		testFiles.sort((a, b) => {
			a = a.replace(/Test.js$/, '').toLowerCase();
			b = b.replace(/Test.js$/, '').toLowerCase();
			if (a < b) return -1;
			if (a > b) return 1;
			return 0;
		});
		
		// Find the start and stop files
		let startPos = 0;
		let stopPos = testFiles.length - 1;
		for (let i = 0; i < testFiles.length; i++) {
			if (testFiles[i] == startFile) {
				startPos = i;
			}
			if (testFiles[i] == stopFile) {
				stopPos = i;
				break;
			}
		}
		if (startFile && startPos == 0 && startFile != testFiles[0]) {
			dump(`Invalid start file ${startFile}\n`);
		}
		testFiles = testFiles.slice(startPos, stopPos + 1);

		// Limit to the given shard of the file list (e.g., "2/4")
		if (TestOptions.shard) {
			let matches = TestOptions.shard.match(/^([0-9]+)\/([0-9]+)$/);
			let shard = matches && parseInt(matches[1]);
			let numShards = matches && parseInt(matches[2]);
			if (!matches || shard < 1 || shard > numShards) {
				dump(`Invalid shard ${TestOptions.shard}\n`);
				run = false;
				quit(true);
			}
			else {
				// Split the sorted file list into contiguous chunks of roughly equal total file
				// size, using size as a stand-in for run time. Contiguous chunks preserve the
				// alphabetical run order of a full run, and a shard can be reproduced locally by
				// passing its first and last files to -s and -e.
				let sizes = new Map();
				let totalSize = 0;
				for (let fname of testFiles) {
					let file = testDirectory.clone();
					file.append(fname);
					sizes.set(fname, file.fileSize);
					totalSize += file.fileSize;
				}
				// A file belongs to the shard that the midpoint of its size range falls in
				let cumSize = 0;
				testFiles = testFiles.filter((fname) => {
					let midpoint = cumSize + sizes.get(fname) / 2;
					cumSize += sizes.get(fname);
					return Math.min(numShards - 1, Math.floor(midpoint / totalSize * numShards)) == shard - 1;
				});
				dump(`Running shard ${shard}/${numShards} with ${testFiles.length} test files:\n`
					+ testFiles.join(' ') + '\n');
			}
		}
	} else {
		var specifiedTests = TestOptions.tests.split(",");
		for (let test of specifiedTests) {
			let fname = getTestFilename(test);
			let file = testDirectory.clone();
			file.append(fname);
			if (!file.exists()) {
				dump("Invalid test file "+test+"\n");
				run = false;
				quit(true);
			}
			testFiles.push(fname);
		}
	}

	for(var fname of testFiles) {
		var el = document.createElement("script");
		el.type = "application/javascript";
		el.src = "resource://zotero-unit-tests/"+fname;
		el.async = false;
		document.body.appendChild(el);
	}
}

if(run) {
	window.onload = async function () {
		await Zotero.Schema.schemaUpdatePromise;
		
		// Make a copy of the database that can be used in resetDB()
		var dbFile = Zotero.DataDirectory.getDatabase();
		await IOUtils.copy(dbFile, dbFile + '-test-template');
		
		return mocha.run();
	};
}
