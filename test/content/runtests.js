Components.utils.import("resource://gre/modules/osfile.jsm");
var EventUtils = Components.utils.import("resource://zotero-unit/EventUtils.jsm");

var ZoteroUnit = Components.classes["@mozilla.org/commandlinehandler/general-startup;1?type=zotero-unit"].
                 getService(Components.interfaces.nsISupports).
                 wrappedJSObject;

var dump = ZoteroUnit.dump;

function quit(failed) {
	// Quit with exit status
	if(!failed) {
		OS.File.writeAtomic(OS.Path.join(OS.Constants.Path.profileDir, "success"), new Uint8Array(0));
	}
	if(!ZoteroUnit.noquit) {
		setTimeout(function () {
			Components.classes['@mozilla.org/toolkit/app-startup;1']
				.getService(Components.interfaces.nsIAppStartup)
				.quit(Components.interfaces.nsIAppStartup.eForceQuit);
		}, 250);
	}
}

if (ZoteroUnit.makeTestData) {
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
		// {
		// 	name: 'citeProcJSExport',
		// 	func: generateCiteProcJSExportData
		// },
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
	Zotero.Promise.coroutine(function* () {
		yield Zotero.initializationPromise;
		for (let i=0; i<dataFiles.length; i++) {
			let first = !i;
			let params = dataFiles[i];

			// Make sure to not run next loop if previous fails
			if (!first) dump('\n');
			dump('Generating data for ' + params.name + '...');

			let filePath = OS.Path.join(dataPath, params.name + '.js');
			let exists = yield OS.File.exists(filePath);
			let currentData;
			if (exists) {
				currentData = loadSampleData(params.name);
			}

			let args = params.args || [];
			args.push(currentData);
			let newData = params.func.apply(null, args);
			if (newData instanceof Zotero.Promise) {
				newData = yield newData;
			}
			let str = stableStringify(newData);

			yield OS.File.writeAtomic(OS.Path.join(dataPath, params.name + '.js'), str);
			dump("done.");
		}
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
		dump("\r"+indent()+suite.title+"\n");
	});

	runner.on('suite end', function(suite){
		--indents;
		if (1 == indents) dump("\n");
	});

	runner.on('pending', function(test){
		dump("\r"+indent()+"pending  -"+test.title+"\n");
	});

	runner.on('pass', function(test){
		passed++;
		var msg = "\r"+indent()+Mocha.reporters.Base.symbols.ok+" "+test.title;
		if ('fast' != test.speed) {
			msg += " ("+Math.round(test.duration)+" ms)";
		}
		dump(msg+"\n");
	});

	runner.on('fail', function(test, err){
		// Remove internal code references
		err.stack = err.stack.replace(/.+(?:zotero-unit\/|\/Task\.jsm|\/bluebird\.js).+\n?/g, "");
		
		// Strip "From previous event:" block if it's all internals
		if (err.stack.indexOf('From previous event:') != -1) {
			err.stack = err.stack
				// Drop first line, because it contains the error message
				.replace(/^.+\n/, '')
				// Drop "From previous event:" labels for empty blocks
				.replace(/.*From previous event:.*(?:\n(?=\s*From previous event:)|\s*$)/g, '');
		}
		
		// Make sure there's a blank line after all stack traces
		err.stack = err.stack.replace(/\s*$/, '\n\n');
		
		failed++;
		let indentStr = indent();
		dump("\r" + indentStr
			// Dark red X for errors
			+ "\033[31;40m" + Mocha.reporters.Base.symbols.err + "\033[0m"
			+ " " + test.title + "\n"
			+ indentStr + "  " + err.toString() + " at\n"
			+ err.stack.replace(/^/gm, indentStr + "    "));
		
		if (ZoteroUnit.bail) {
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

// Monkey-patch Mocha to check instanceof Error using compartment-local
// Error object
Mocha.Runner.prototype.fail = function(test, err){
	++this.failures;
	test.state = 'failed';

	if ('string' == typeof err) {
		err = new Error('the string "' + err + '" was thrown, throw an Error :)');
	} else if (!(err instanceof Components.utils.getGlobalForObject(err).Error)) {
		err = new Error('the ' + Mocha.utils.type(err) + ' ' + Mocha.utils.stringify(err) + ' was thrown, throw an Error :)');
	}

	this.emit('fail', test, err);
};

// Setup Mocha
mocha.setup({
	ui: "bdd",
	reporter: Reporter,
	timeout: 5000,
	grep: ZoteroUnit.grep
});

// Enable Bluebird generator support in Mocha
(function () {
	var Runnable = Mocha.Runnable;
	var run = Runnable.prototype.run;
	Runnable.prototype.run = function (fn) {
		if (this.fn.constructor.name === 'GeneratorFunction') {
			this.fn = Zotero.Promise.coroutine(this.fn);
		} else if (typeof this.fn == 'function' && this.fn.isGenerator()) {
			throw new Error("Attempting to use a legacy generator in Mocha test");
		}
		return run.call(this, fn);
	};
})();

var assert = chai.assert,
    expect = chai.expect;

// Set up tests to run
var run = ZoteroUnit.runTests;
if(run && ZoteroUnit.tests) {
	var testDirectory = getTestDataDirectory().parent,
	    testFiles = [];
	if(ZoteroUnit.tests == "all") {
		var enumerator = testDirectory.directoryEntries;
		while(enumerator.hasMoreElements()) {
			var file = enumerator.getNext().QueryInterface(Components.interfaces.nsIFile);
			if(file.leafName.endsWith(".js")) {
				testFiles.push(file.leafName);
			}
		}
		testFiles.sort();
	} else {
		var specifiedTests = ZoteroUnit.tests.split(",");
		for (let test of specifiedTests) {
			// Allow foo, fooTest, fooTest.js, and tests/fooTest.js
			test = test.replace(/\.js$/, "");
			test = test.replace(/Test$/, "");
			test = test.replace(/^tests[/\\]/, "");
			let fname = test + "Test.js";
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
		el.type = "application/javascript;version=1.8";
		el.src = "resource://zotero-unit-tests/"+fname;
		el.async = false;
		document.body.appendChild(el);
	}
}

if(run) {
	window.onload = function() {
		Zotero.spawn(function* () {
			yield Zotero.Schema.schemaUpdatePromise;
			
			// Download and cache PDF tools for this platform
			//
			// To reset, delete test/tests/data/pdf/ directory
			var cachePDFTools = Zotero.Promise.coroutine(function* () {
				var path = OS.Path.join(getTestDataDirectory().path, 'pdf');
				yield OS.File.makeDir(path, { ignoreExisting: true });
				
				var baseURL = Zotero.Fulltext.pdfToolsDownloadBaseURL;
				// Point full-text code to the cache directory, so downloads come from there
				Zotero.Fulltext.pdfToolsDownloadBaseURL = OS.Path.toFileURI(path) + "/";
				
				// Get latest tools version for the current platform
				yield Zotero.File.download(baseURL + 'latest.json', OS.Path.join(path, 'latest.json'));
				
				var platform = Zotero.platform.replace(/\s/g, '-');
				var version = yield Zotero.Fulltext.getLatestPDFToolsVersion();
				
				// Create version directory (e.g., data/pdf/3.04) and download tools to it if
				// they don't exist
				yield OS.File.makeDir(OS.Path.join(path, version), { ignoreExisting: true });
				
				var fileName = "pdfinfo-" + platform + (Zotero.isWin ? ".exe" : "");
				var execPath = OS.Path.join(path, version, fileName);
				if (!(yield OS.File.exists(execPath))) {
					yield Zotero.File.download(baseURL + version + "/" + fileName, execPath);
				}
				fileName = "pdftotext-" + platform + (Zotero.isWin ? ".exe" : "");;
				execPath = OS.Path.join(path, version, fileName);
				if (!(yield OS.File.exists(execPath))) {
					yield Zotero.File.download(baseURL + version + "/" + fileName, execPath);
				}
			});
			
			try {
				yield cachePDFTools();
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			return mocha.run();
		})
	};
}