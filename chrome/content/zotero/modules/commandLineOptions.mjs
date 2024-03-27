// Used by commandLineHandler.js to store parameters from the command line

export var CommandLineOptions = {
	forceDebugLog: 0,
	forceDataDir: false,
	test: false,
	automatedTest: false,
	skipBundledFiles: false,
	file: false,
	url: false,
};

export var TestOptions = {
	tests: false,
	noquit: false,
	makeTestData: false,
	noquit: false,
	runTests: false,
	bail: false,
	startAt: false,
	stopAt: false,
	grep: false,
	timeout: false,
};
