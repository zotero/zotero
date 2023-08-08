'use strict';

const path = require('path');
const fs = require('fs-extra');
const { onError } = require('./utils');

const ROOT = path.resolve(__dirname, '..');

async function getClean(source) {
	await fs.remove(source);
}

module.exports = getClean;

if (require.main === module) {
	(async () => {
		try {
			await getClean(path.join(ROOT, 'build'));
			await getClean(path.join(ROOT, '.signatures.json'));
			await getClean(path.join(ROOT, 'reader/build'));
			await getClean(path.join(ROOT, 'pdf-worker/build'));
			await getClean(path.join(ROOT, 'note-editor/build'));
		} catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}