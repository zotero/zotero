'use strict';

const globby = require('globby');
const path = require('path');
const fs = require('fs-extra');
const { getSignatures, writeSignatures, cleanUp, compareSignatures, getFileSignature, onSuccess, onError, onProgress } = require('./utils');
const { copyDirs, ignoreMask } = require('./config');

const ROOT = path.resolve(__dirname, '..');

async function getCopy(source, options, signatures) {
	const t1 = Date.now();
	const files = await globby(source, Object.assign({ cwd: ROOT }, options ));
	const totalCount = files.length;
	var count = 0;
	var f;

	while ((f = files.pop()) != null) {
		let newFileSignature = await getFileSignature(f);
		const dest = path.join('build', f);

		if (f in signatures) {
			if (compareSignatures(newFileSignature, signatures[f])) {
				try {
					await fs.access(dest, fs.constants.F_OK);
					continue;
				} catch (_) {
					// file does not exists in build, fallback to browserifing
				}
			}
		}
		try {
			await fs.mkdirp(path.dirname(dest));
			await fs.copy(f, dest);
			onProgress(f, dest, 'cp');
			signatures[f] = newFileSignature;
			count++;
		} catch (err) {
			throw new Error(`Failed on ${f}: ${err}`);
		}
	}
	
	const t2 = Date.now();
	return {
		action: 'copy',
		count,
		totalCount,
		processingTime: t2 - t1
	};
}

module.exports = getCopy;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getCopy(copyDirs.map(d => `${d}/**`), { ignore: ignoreMask }, signatures));
			onSuccess(await cleanUp(signatures));
			await writeSignatures(signatures);
		} catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}