const path = require('path');
const fs = require('fs-extra');
const colors = require('colors/safe');
const green = colors.green;
const blue = colors.blue;
const yellow = colors.yellow;
const isWindows = /^win/.test(process.platform);

const ROOT = path.resolve(__dirname, '..');
const NODE_ENV = process.env.NODE_ENV;


function onError(err) {
	console.log(colors.red('Error:'), err);
}

function onSuccess(result) {
	var msg = `${green('Success:')} ${blue(`[${result.action}]`)} ${result.count} files processed`;
	if (result.totalCount) {
		msg += ` (out of total ${result.totalCount} matched)`; 
	}

	msg += ` [${yellow(`${result.processingTime}ms`)}]`;	

	console.log(msg);
}

function onProgress(sourcefile, outfile, operation) {
	if ('isError' in global && global.isError) {
		return;
	}
	if (NODE_ENV == 'debug') {
		console.log(`${colors.blue(`[${operation}]`)} ${sourcefile} -> ${outfile}`);
	} else {
		console.log(`${colors.blue(`[${operation}]`)} ${sourcefile}`);
	}
}

async function getSignatures() {
	let signaturesFile = path.resolve(ROOT, '.signatures.json');
	var signatures = {};
	try {
		signatures = await fs.readJson(signaturesFile);
	} catch (_) {
		// if signatures files doesn't exist, return empty object instead
	}
	return signatures;
}

async function writeSignatures(signatures) {
	let signaturesFile = path.resolve(ROOT, '.signatures.json');
	NODE_ENV == 'debug' && console.log('writing signatures to .signatures.json');
	await fs.outputJson(signaturesFile, signatures);
}

async function cleanUp(signatures) {
	const t1 = Date.now();
	var removedCount = 0, invalidCount = 0;

	for (let f of Object.keys(signatures)) {
		try {
			// check if file from signatures exists in source
			await fs.access(f, fs.constants.F_OK);
		} catch (_) {
			invalidCount++;
			NODE_ENV == 'debug' && console.log(`File ${f} found in signatures but not in src, deleting from build`);
			try {
				await fs.remove(path.join('build', f));
				removedCount++;
			} catch (_) {
				// file wasn't in the build either
			}
			delete signatures[f];
		}
	}

	const t2 = Date.now();
	return {
		action: 'cleanup',
		count: removedCount,
		totalCount: invalidCount,
		processingTime: t2 - t1
	};
}

async function getFileSignature(file) {
	let stats = await fs.stat(file);
	return {
		mode: stats.mode,
		mtime: stats.mtimeMs || stats.mtime.getTime(),
		isDirectory: stats.isDirectory(),
		isFile: stats.isFile()
	};
}

function compareSignatures(a, b) {
	return typeof a === 'object'
	&& typeof b === 'object' 
	&& a != null
	&& b != null
	&& ['mode', 'mtime', 'isDirectory', 'isFile'].reduce((acc, k) => {
		return acc ? k in a && k in b && a[k] == b[k] : false;
	}, true);
}

function getPathRelativeTo(f, dirName) {
	return path.relative(path.join(ROOT, dirName), path.join(ROOT, f));
}

const formatDirsForMatcher = dirs => {
	return dirs.length > 1 ? `{${dirs.join(',')}}` : dirs[0];
};

module.exports = {
	isWindows,
	onError,
	onProgress,
	onSuccess,
	cleanUp,
	getSignatures,
	getFileSignature,
	compareSignatures,
	writeSignatures,
	getPathRelativeTo,
	formatDirsForMatcher
};