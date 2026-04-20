'use strict';

const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { getSignatures, writeSignatures, onSuccess, onError } = require('./utils');
const { buildsURL } = require('./config');

async function getDocumentWorker(signatures) {
	const t1 = Date.now();

	const modulePath = path.join(__dirname, '..', 'document-worker');

	const { stdout } = await exec('git rev-parse HEAD', { cwd: modulePath });
	const hash = stdout.trim();

	if (!('document-worker' in signatures) || signatures['document-worker'].hash !== hash) {
		const targetDir = path.join(__dirname, '..', 'build', 'chrome', 'content', 'zotero', 'xpcom', 'pdfWorker');
		try {
			const filename = hash + '.zip';
			const tmpDir = path.join(__dirname, '..', 'tmp', 'builds', 'document-worker');
			const url = buildsURL + 'document-worker/' + filename;

			await fs.remove(targetDir);
			await fs.ensureDir(targetDir);
			await fs.ensureDir(tmpDir);

			await exec(
				`cd ${tmpDir}`
				+ ` && (test -f ${filename} || curl -f ${url} -o ${filename})`
				+ ` && unzip -o ${filename} -d ${targetDir}`
			);
		}
		catch (e) {
			console.error(e);
			await exec('npm ci', { cwd: modulePath });
			await exec('npm run build', { cwd: modulePath });
			await fs.copy(path.join(modulePath, 'build'), targetDir);
		}
		signatures['document-worker'] = { hash };
	}

	const t2 = Date.now();

	return {
		action: 'document-worker',
		count: 1,
		totalCount: 1,
		processingTime: t2 - t1
	};
}

module.exports = getDocumentWorker;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getDocumentWorker(signatures));
			await writeSignatures(signatures);
		}
		catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}
