'use strict';

const fs = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { getSignatures, writeSignatures, onSuccess, onError } = require('./utils');
const { buildsURL } = require('./config');

async function getPDFReader(signatures) {
	const t1 = Date.now();
	
	const { stdout } = await exec('git rev-parse HEAD', { cwd: './pdf-reader' });
	const hash = stdout.trim();
	
	if (!('pdf-reader' in signatures) || signatures['pdf-reader'].hash !== hash) {
		const targetDir = 'build/resource/pdf-reader/';
		try {
			const filename = hash + '.zip';
			const tmpDir = 'tmp/builds/pdf-reader/';
			const url = buildsURL + 'client-pdf-reader/' + filename;
			await exec(
				`mkdir -p ${tmpDir}`
				+ `&& cd ${tmpDir}`
				+ `&& (test -f ${filename} || curl -f ${url} -o ${filename})`
				+ `&& rm -rf ../../../${targetDir}`
				+ `&& mkdir -p ../../../${targetDir}`
				+ `&& unzip -o ${filename} -d ../../../${targetDir}`
			);
		}
		catch (e) {
			await exec('npm ci;npm run build', { cwd: 'pdf-reader' });
			await fs.copy('pdf-reader/build/zotero', targetDir);
		}
		signatures['pdf-reader'] = { hash };
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
