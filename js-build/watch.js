const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const multimatch = require('multimatch');
const { exec } = require('child_process');
const { dirs, jsFiles, scssFiles, ignoreMask, copyDirs, symlinkFiles } = require('./config');
const { debounce, envCheckTrue, onSuccess, onError, getSignatures, writeSignatures, cleanUp, formatDirsForMatcher } = require('./utils');
const getJS = require('./js');
const getSass = require('./sass');
const getCopy = require('./copy');
const getSymlinks = require('./symlinks');
const colors = require('colors/safe');


const ROOT = path.resolve(__dirname, '..');
const addOmniExecPath = path.join(ROOT, 'app', 'scripts', 'add_omni_file');
let shouldAddOmni = false;

const source = [
	'chrome',
	'components',
	'defaults',
	'resource',
	'scss',
	'test',
	'styles',
	'translators',
	'scss',
	'chrome/**',
	'components/**',
	'defaults/**',
	'resource/**',
	'scss/**',
	'test/**',
	'styles/**',
	'translators/**',
	'scss/**'
];

const symlinks = symlinkFiles
				.concat(dirs.map(d => `${d}/**`))
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.js`])
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.jsx`])
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.scss`])
				.concat([`!${formatDirsForMatcher(copyDirs)}/**`]);

var signatures;

process.on('SIGINT', () => {
	writeSignatures(signatures);
	process.exit(); // eslint-disable-line no-process-exit
});

async function addOmniFiles(relPaths) {
	const t1 = Date.now();
	const buildDirPath = path.join(ROOT, 'build');
	const wrappedPaths = relPaths.map(relPath => `"${path.relative(buildDirPath, relPath)}"`);

	await new Promise((resolve, reject) => {
		const cmd = `"${addOmniExecPath}" ${wrappedPaths.join(' ')}`;
		exec(cmd, { cwd: buildDirPath }, (error, output) => {
			if (error) {
				reject(error);
			}
			else {
				process.env.NODE_ENV === 'debug' && console.log(`Executed:\n${cmd};\nOutput:\n${output}\n`);
				resolve(output);
			}
		});
	});

	const t2 = Date.now();
	
	return {
		action: 'add-omni-files',
		count: relPaths.length,
		totalCount: relPaths.length,
		processingTime: t2 - t1
	};
}

async function processFile(path) {
	try {
		var result = false;
		if (multimatch(path, jsFiles).length && !multimatch(path, ignoreMask).length) {
			result = await getJS(path, { ignore: ignoreMask }, signatures);
			onSuccess(await cleanUp(signatures));
		}
		if (!result) {
			for (var i = 0; i < scssFiles.length; i++) {
				if (multimatch(path, scssFiles[i]).length) {
					result = await getSass(scssFiles[i], { ignore: ignoreMask }); // eslint-disable-line no-await-in-loop
					break;
				}
			}
		}
		if (!result && multimatch(path, copyDirs.map(d => `${d}/**`)).length) {
			result = await getCopy(path, {}, signatures);
		}
		if (!result && multimatch(path, symlinks).length) {
			result = await getSymlinks(path, { nodir: true }, signatures);
		}
	}
	catch (err) {
		onError(err);
		result = false;
	}
	return result;
}

async function processFiles(mutex) {
	mutex.isLocked = true;
	try {
		const t1 = Date.now();
		let paths = Array.from(mutex.batch);
		let results = await Promise.all(paths.map(processFile));
		let t2 = Date.now();
		let aggrResult;

		if (results.length === 1 && results[0]) {
			onSuccess(results[0]);
			aggrResult = results[0];
		}
		else if (results.length > 1) {
			aggrResult = results.reduce((acc, result) => {
				if (result) {
					if (!(result.action in acc)) {
						acc.actions[result.action] = 0;
					}
					acc.actions[result.action] += result?.count ?? 0;
					acc.count += result?.count ?? 0;
					acc.outFiles = acc.outFiles.concat(result?.outFiles ?? []);
				}
				return acc;
			}, { actions: {}, count: 0, processingTime: t2 - t1, outFiles: [] });

			onSuccess({
				action: Object.keys(aggrResult.actions).length > 1 ? 'multiple' : Object.keys(aggrResult.actions)[0],
				count: aggrResult.count,
				processingTime: aggrResult.processingTime,
			});
		}
		
		onSuccess(await cleanUp(signatures));

		if (shouldAddOmni && aggrResult?.outFiles?.length) {
			try {
				onSuccess(await addOmniFiles(aggrResult.outFiles));
			}
			catch (err) {
				onError(`omni update failed: ${err}`);
			}
		}
	}
	finally {
		mutex.isLocked = false;
		mutex.batch.clear();
	}
}
	

async function batchProcessFiles(path, mutex, debouncedProcessFiles) {
	let counter = 0;
	let pollInterval = 250;
	let started = Date.now();
	
	// if there's a batch processing and another batch waiting, add to it
	if (mutex.isLocked && mutex.nextBatch) {
		mutex.nextBatch.add(path);
		return;
	}
	// else if there's a batch processing, create a new batch
	else if (mutex.isLocked) {
		mutex.nextBatch = new Set([path]);
	}
	while (mutex.isLocked) {
		if (counter === 0) {
			console.log(colors.yellow(`Waiting for previous batch to finish...`));
		}
		if (++counter >= 40) {
			onError(`Batch processing timeout after ${counter * pollInterval}ms. ${mutex?.nextBatch?.size ?? 0} files in this batch have not been processed 😢`);
			mutex.batch.clear();
			mutex.nextBatch = null;
			mutex.isLocked = false;
			return;
		}
		process.env.NODE_ENV === 'debug' && console.log(`waiting ${pollInterval}ms...`);
		await new Promise(resolve => setTimeout(resolve, pollInterval));
	}
	if (counter > 0) {
		console.log(colors.green(`Previous batch finished in ${Date.now() - started}ms. ${mutex?.nextBatch?.size ?? 0} files in the next batch.`));
	}
	if (mutex.nextBatch) {
		mutex.batch = new Set([...mutex.nextBatch]);
		mutex.nextBatch = null;
	}
	else {
		mutex.batch.add(path);
	}
	debouncedProcessFiles();
}

async function getWatch() {
	try {
		await fs.access(addOmniExecPath, fs.constants.F_OK);
		shouldAddOmni = !envCheckTrue(process.env.SKIP_OMNI);
	}
	catch (_) {}
	
	let mutex = { batch: new Set(), isLocked: false };
	const debouncedProcessFiles = debounce(() => processFiles(mutex));

	let watcher = chokidar.watch(source, { cwd: ROOT, ignoreInitial: true })
	.on('change', (path) => {
		batchProcessFiles(path, mutex, debouncedProcessFiles);
	})
	.on('add', (path) => {
		batchProcessFiles(path, mutex, debouncedProcessFiles);
	})
	.on('unlink', debounce(async () => {
		onSuccess(await cleanUp(signatures));
	}));

	watcher.add(source);
	console.log(`Watching files for changes (omni updates ${shouldAddOmni ? 'enabled' : 'disabled'})...`);
}

module.exports = getWatch;

if (require.main === module) {
	(async () => {
		signatures = await getSignatures();
		getWatch();
	})();
}
