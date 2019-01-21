'use strict';

const universalify = require('universalify');
const sass = require('node-sass');
const globby = require('globby');
const path = require('path');
const fs = require('fs-extra');
const { getSignatures, writeSignatures, cleanUp, compareSignatures, getFileSignature, onSuccess, onError, onProgress, getPathRelativeTo } = require('./utils');
const { ignoreMask } = require('./config');
const sassRender = universalify.fromCallback(sass.render);

const ROOT = path.resolve(__dirname, '..');

async function getSass(source, options, signatures={}) {
	const t1 = Date.now();
	const files = await globby(source, Object.assign({ cwd: ROOT }, options ));
	const totalCount = files.length;
	var count = 0;
	var f;

	while ((f = files.pop()) != null) {
		let newFileSignature = await getFileSignature(f);
		let destFile = getPathRelativeTo(f, 'scss');
		destFile = path.join(path.dirname(destFile), path.basename(destFile, '.scss') + '.css');
		let dest = path.join.apply(this, ['build', 'chrome', 'skin', 'default', 'zotero', destFile]);
		if (['win', 'mac', 'unix'].some(platform => f.endsWith(`-${platform}.scss`))) {
			let platform = f.slice(f.lastIndexOf('-')+1, f.lastIndexOf('.'));
			destFile = destFile.slice(0, destFile.lastIndexOf('-'))
				+ destFile.slice(destFile.lastIndexOf('-')+1+platform.length);
			dest = path.join.apply(this, ['build', 'chrome', 'content', 'zotero-platform', platform, destFile]);
		}

		if (f in signatures) {
			if (compareSignatures(newFileSignature, signatures[f])) {
				try {
					await fs.access(dest, fs.constants.F_OK);
					// TODO: Doesn't recompile on partial scss file changes, so temporarily disabled
					// continue;
				} catch (_) {
					// file does not exists in build, fallback to browserifing
				}
			}
		}
		try {
			const sass = await sassRender({
				file: f,
				outFile: dest,
				sourceMap: true,
				outputStyle: 'compressed'
			});

			await fs.outputFile(dest, sass.css);
			await fs.outputFile(`${dest}.map`, sass.map);
			onProgress(f, dest, 'sass');
			signatures[f] = newFileSignature;
			count++;
		} catch (err) {
			throw new Error(`Failed on ${f}: ${err}`);
		}
	}
	
	const t2 = Date.now();
	return {
		action: 'sass',
		count,
		totalCount,
		processingTime: t2 - t1
	};
}

module.exports = getSass;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getSass('scss/*.scss', { root: 'scss', ignore: ignoreMask }, signatures));
			onSuccess(await cleanUp(signatures));
			await writeSignatures(signatures);
		} catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}