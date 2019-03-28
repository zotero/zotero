'use strict';

const fs = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { getSignatures, writeSignatures, onSuccess, onError } = require('./utils');

async function getPDFReader(signatures) {
	const t1 = Date.now();

	var { stdout } = await exec('git rev-parse HEAD', { cwd: './pdf-reader/pdf.js' });
	const PDFJSHash = stdout.trim();

	var { stdout } = await exec('git rev-parse HEAD', { cwd: './pdf-reader' });
	const PDFReaderHash = stdout.trim();

	let updated = false;
	let name = 'pdf-reader/pdf.js';
	if (!(name in signatures) || signatures[name].hash !== PDFJSHash) {
		await exec('npm run build:pdf.js', { cwd: './pdf-reader' });
		signatures[name] = { hash: PDFJSHash };
		updated = true;
	}

	name = 'pdf-reader';
	if (!(name in signatures) || signatures[name].hash !== PDFReaderHash) {
		await exec('npm ci;npm run build:reader', { cwd: './pdf-reader' });
		signatures[name] = { hash: PDFReaderHash };
		updated = true;
	}

	if (updated) {
		await fs.copy('./pdf-reader/build/zotero', './build/resource/pdf.js');
	}

	const t2 = Date.now();

	return {
		action: 'pdf-reader',
		count: 1,
		totalCount: 1,
		processingTime: t2 - t1
	};
}

module.exports = getPDFReader;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getPDFReader(signatures));
			await writeSignatures(signatures);
		}
		catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}
