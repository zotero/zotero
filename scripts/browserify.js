'use strict';

const browserify = require('browserify');
const globby = require('globby');
const path = require('path');
const fs = require('fs-extra');
const { getSignatures, writeSignatures, cleanUp, compareSignatures, getFileSignature, onSuccess, onError, onProgress } = require('./utils');

const { browserifyConfigs } = require('./config');
const ROOT = path.resolve(__dirname, '..');

async function getBrowserify(signatures) {
	const t1 = Date.now();
	var count = 0;
	var config, f, totalCount;
	
	while ((config = browserifyConfigs.pop()) != null) {
		let files = await globby(config.src, { cwd: ROOT });
		totalCount += files.length;
		
		while ((f = files.pop()) != null) {
			let newFileSignature = await getFileSignature(f);
			const dest = path.join('build', config.dest);
			
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
				const bundleFs = fs.createWriteStream(dest);
				await new Promise((resolve, reject) => {
					bundleFs
					.on('error', reject)
					.on('finish', resolve);
					browserify(f, config.config)
						.external('react')
						.external('react-dom')
						.bundle()
						.pipe(bundleFs);
				});

				onProgress(f, dest, 'browserify');
				signatures[f] = newFileSignature;
				count++;
			} catch (err) {
				throw new Error(`Failed on ${f}: ${err}`);
			}
		}
	}

	const t2 = Date.now();
	return {
		action: 'browserify',
		count,
		totalCount,
		processingTime: t2 - t1
	};
}

module.exports = getBrowserify;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getBrowserify(signatures));
			onSuccess(await cleanUp(signatures));
			await writeSignatures(signatures);
		} catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}