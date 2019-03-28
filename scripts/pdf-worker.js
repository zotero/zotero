'use strict';

const fs = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { getSignatures, writeSignatures, onSuccess, onError } = require('./utils');

async function getPDFWorker(signatures) {
	const t1 = Date.now();

	var { stdout } = await exec('git rev-parse HEAD', { cwd: './pdf-worker/pdf.js' });
	const PDFJSHash = stdout.trim();

	var { stdout } = await exec('git rev-parse HEAD', { cwd: './pdf-worker' });
	const PDFWorkerHash = stdout.trim();

	let updated = false;
	let name = 'pdf-worker/pdf.js';
	if (!(name in signatures) || signatures[name].hash !== PDFJSHash) {
		await exec('npm run build:pdf.js', { cwd: './pdf-worker' });
		signatures[name] = { hash: PDFJSHash };
		updated = true;
	}
	
	name = 'pdf-worker';
	if (!(name in signatures) || signatures[name].hash !== PDFWorkerHash) {
		await exec('npm ci;npm run build:worker', { cwd: './pdf-worker' });
		signatures[name] = { hash: PDFWorkerHash };
		updated = true;
	}

	if (updated) {
		await fs.copy('./pdf-worker/build/pdf-worker.js', './build/chrome/content/zotero/xpcom/pdfWorker/worker.js');
	}

	const t2 = Date.now();

	return {
		action: 'pdf-worker',
		count: 1,
		totalCount: 1,
		processingTime: t2 - t1
	};
}

module.exports = getPDFWorker;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getPDFWorker(signatures));
			await writeSignatures(signatures);
		}
		catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}
