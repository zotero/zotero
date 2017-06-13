'use strict';

const path = require('path');
const fs = require('fs-extra');
const globby = require('globby');

const { isWindows, formatDirsForMatcher, getSignatures, writeSignatures, cleanUp, onSuccess, onError, onProgress } = require('./utils');
const { dirs, symlinkDirs, copyDirs, symlinkFiles, ignoreMask } = require('./config');
const ROOT = path.resolve(__dirname, '..');


//@TODO: change signature to getSymlinks(source, options, signatures)
//		 here and elsewhere
//		 
//		 run symlinks twice, once for files (with nodir: true)
//		 once for dirs
async function getSymlinks(source, options, signatures) {
	const t1 = Date.now();
	const files = await globby(source, Object.assign({ cwd: ROOT }, options ));
	const filesDonePreviously = [];
	for (const [f, signature] of Object.entries(signatures)) {
		if ('isSymlinked' in signature && signature.isSymlinked) {
			try {
				await fs.access(path.join('build', f), fs.constants.F_OK);
				// file found in signatures and build/ dir, skip
				filesDonePreviously.push(f);
			} catch (_) {
				// file not found, needs symlinking
			}
		}
	}

	const filesToProcess = files.filter(f => !filesDonePreviously.includes(f));
	const filesProcessedCount = filesToProcess.length;

	var f;
	while ((f = filesToProcess.pop()) != null) {
		const dest = path.join('build', f);
		try {
			if (isWindows) {
				await fs.copy(f, dest);
			} else {
				await fs.ensureSymlink(f, dest);
			}
			signatures[f] = {
				isSymlinked: true
			};
			onProgress(f, dest, 'ln');
		} catch (err) {
			throw new Error(`Failed on ${f}: ${err}`);
		}
	}

	const t2 = Date.now();

	return {
		action: 'symlink',
		count: filesProcessedCount,
		totalCount: files.length,
		processingTime: t2 - t1
	};
}


module.exports = getSymlinks;

if (require.main === module) {
	(async () => {
		try {
			const source = symlinkFiles
				.concat(dirs.map(d => `${d}/**`))
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.js`])
				.concat([`!${formatDirsForMatcher(copyDirs)}/**`]);

			const signatures = await getSignatures();
			onSuccess(await getSymlinks(source, { nodir: true, ignore: ignoreMask }, signatures));
			onSuccess(await getSymlinks(symlinkDirs, {}, signatures));
			onSuccess(await cleanUp(signatures));
			await writeSignatures(signatures);
		} catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}