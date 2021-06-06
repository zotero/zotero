/* eslint-disable no-await-in-loop */

const universalify = require('universalify');
const sass = require('sass');
const globby = require('globby');
const path = require('path');
const fs = require('fs-extra');
const { getSignatures, writeSignatures, cleanUp, compareSignatures, getFileSignature, onSuccess, onError, onProgress, getPathRelativeTo } = require('./utils');
const { scssFiles, ignoreMask } = require('./config');
const sassRender = universalify.fromCallback(sass.render);

const ROOT = path.resolve(__dirname, '..');

async function getSass(source, options, signatures={}) {
	const t1 = Date.now();
	const files = await globby(source, Object.assign({ cwd: ROOT }, options));
	const totalCount = files.length;
	var count = 0, shouldRebuild = false;

	for (const f of files) {
		// if any file changed, rebuild all onSuccess
		let newFileSignature = await getFileSignature(f);
		if (!compareSignatures(newFileSignature, signatures[f])) {
			signatures[f] = newFileSignature;
			shouldRebuild = true;
		}
	}

	var f;
	if (shouldRebuild) {
		const filesToBuild = files.filter(f => !path.basename(f).startsWith('_'));
		while ((f = filesToBuild.pop())) {
			let newFileSignature = await getFileSignature(f);
			let destFile = getPathRelativeTo(f, 'scss');
			destFile = path.join(path.dirname(destFile), path.basename(destFile, '.scss') + '.css');
			let dest = path.join.apply(this, ['build', 'chrome', 'skin', 'default', 'zotero', destFile]);

			if (['win', 'mac', 'unix'].some(platform => f.endsWith(`-${platform}.scss`))) {
				let platform = f.slice(f.lastIndexOf('-') + 1, f.lastIndexOf('.'));
				destFile = destFile.slice(0, destFile.lastIndexOf('-'))
				+ destFile.slice(destFile.lastIndexOf('-') + 1 + platform.length);
				dest = path.join.apply(this, ['build', 'chrome', 'content', 'zotero-platform', platform, destFile]);
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
			}
			catch (err) {
				throw new Error(`Failed on ${f}: ${err}`);
			}
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
			for (var i = 0; i < scssFiles.length; i++) {
				onSuccess(await getSass(scssFiles[i], { ignore: ignoreMask }, signatures));
			}
			onSuccess(await cleanUp(signatures));
			await writeSignatures(signatures);
		}
		catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}
