const path = require('path');
const fs = require('fs-extra');
const colors = require('colors/safe');
const green = colors.green;
const blue = colors.blue;
const yellow = colors.yellow;
const isWindows = /^win/.test(process.platform);
const multimatch = require('multimatch');

const envCheckTrue = env => !!(env && (parseInt(env) || env === true || env === "true"));

const ROOT = path.resolve(__dirname, '..');
const DEBUG = envCheckTrue(process.env.DEBUG);
const observedEnvs = ['DEBUG', 'REWRITE_SRC', 'SKIP_OMNI'];


function onError(err) {
	console.log('\u0007'); //🔔
	console.log(colors.red('Error:'), err);
}

function onSuccess(result) {
	var msg = `${green('Success:')} ${blue(`[${result.action}]`)} ${result.count} files processed`;
	if (result.totalCount) {
		msg += ` | ${result.totalCount} checked`; 
	}

	msg += ` [${yellow(`${result.processingTime}ms`)}]`;	

	console.log(msg);
}

function onProgress(sourcefile, outfile, operation) {
	if ('isError' in global && global.isError) {
		return;
	}
	if (DEBUG) {
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
	DEBUG && console.log('writing signatures to .signatures.json');
	signatures.__env = pick(process.env, observedEnvs);
	await fs.outputJson(signaturesFile, signatures);
}

// Remove files & dirs present in signatures & build but missing in source. Optionally, if symlinks
// argument is provided (multimatch array), remove files that should be symlinks or vice versa
async function cleanUp(signatures, symlinks = [], envDependentFiles = {}) {
	const t1 = Date.now();
	var removedCount = 0, invalidCount = 0;

	for (let f of Object.keys(signatures)) {
		if (f === '__env') {
			if (observedEnvs.some(env => signatures[f][env] !== process.env[env])) {
				DEBUG && console.log('Detected ENV change, applying additional cleanup');
				for (let ef of Object.values(envDependentFiles).flat()) {
					try {
						await fs.remove(path.join('build', ef));
						removedCount++;
					}
					catch (_) {
						// file wasn't in the build
					}
				}
			}
			continue;
		}
		try {
			// check if file from signatures exists in source
			await fs.access(f, fs.constants.F_OK);
			if (symlinks.length) {
				const shouldBeSymlink = !!multimatch(f, symlinks).length;
				const isSymlinked = !!signatures[f].isSymlinked;
				if (shouldBeSymlink !== isSymlinked) {
					try {
						await fs.remove(path.join('build', f));
						removedCount++;
					} catch (_) {
						// file wasn't in the build
					}
				}
			}
		} catch (_) {
			invalidCount++;
			DEBUG && console.log(`File ${f} found in signatures but not in src, deleting from build`);
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

function comparePaths(actualPath, testedPath) {
	// compare paths after normalizing os-specific path separator
	return path.normalize(actualPath) === path.normalize(testedPath);
}

const pick = (object, pickKeys) => {
	if (typeof pickKeys === 'function') {
		return Object.entries(object)
			.reduce((aggr, [key, value]) => {
				if (pickKeys(key)) {
					aggr[key] = value;
				}
				return aggr;
			}, {});
	}
	if (!Array.isArray(pickKeys)) {
		pickKeys = [pickKeys];
	}

	return Object.entries(object)
		.reduce((aggr, [key, value]) => {
			if (pickKeys.includes(key)) {
				aggr[key] = value;
			}
			return aggr;
		}, {});
};

module.exports = {
	cleanUp,
	comparePaths,
	compareSignatures,
	envCheckTrue,
	formatDirsForMatcher,
	getFileSignature,
	getPathRelativeTo,
	getSignatures,
	isWindows,
	onError,
	onProgress,
	onSuccess,
	writeSignatures,
};
