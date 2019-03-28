'use strict';

const fs = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { getSignatures, writeSignatures, onSuccess, onError } = require('./utils');

async function getZoteroNoteEditor(signatures) {
	const t1 = Date.now();

	var { stdout } = await exec('git rev-parse HEAD', { cwd: './zotero-note-editor' });
	const zoteroNoteEditorHash = stdout.trim();

	let updated = false;
	let name = 'zotero-note-editor';
	if (!(name in signatures) || signatures[name].hash !== zoteroNoteEditorHash) {
		await exec('npm ci;npm run build', { cwd: './zotero-note-editor' });
		signatures[name] = { hash: zoteroNoteEditorHash };
		updated = true;
	}

	if (updated) {
		await fs.copy('./zotero-note-editor/build/zotero', './build/resource/zotero-note-editor');
	}
	const t2 = Date.now();

	return {
		action: 'zotero-note-editor',
		count: 1,
		totalCount: 1,
		processingTime: t2 - t1
	};
}

module.exports = getZoteroNoteEditor;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getZoteroNoteEditor(signatures));
			await writeSignatures(signatures);
		}
		catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}
