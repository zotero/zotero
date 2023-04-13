import { ftlToJSON } from "ftl-tx";
import fs from 'fs-extra';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { onError, onSuccess } from './utils.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function getJSON() {
	const t1 = performance.now();
	const sourceDir = join(ROOT, 'chrome', 'locale', 'en-US', 'zotero');
	const sourceFile = join(sourceDir, 'zotero.ftl');
	const destFile = join(sourceDir, 'zotero.json');
	const ftl = await fs.readFile(sourceFile, 'utf8');
	const json = ftlToJSON(ftl, { transformTerms: false, storeTermsInJSON: false });
	await fs.outputJSON(destFile, json, { spaces: '\t' });
	const t2 = performance.now();
	return ({
		action: 'ftl->json',
		count: 1,
		totalCount: 1,
		processingTime: t2 - t1
	});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	(async () => {
		try {
			onSuccess(await getJSON());
		}
		catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}
