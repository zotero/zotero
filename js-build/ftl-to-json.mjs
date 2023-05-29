import { ftlToJSON } from "ftl-tx";
import fs from 'fs-extra';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ftlFileBaseNames as sourceFileBaseNames } from './config.js';
import { onError, onProgress, onSuccess } from './utils.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function getJSON() {
	const t1 = performance.now();
	const sourceDir = join(ROOT, 'chrome', 'locale', 'en-US', 'zotero');
	for (let sourceFileBaseName of sourceFileBaseNames) {
		const sourceFile = join(sourceDir, sourceFileBaseName + '.ftl');
		const destFile = join(sourceDir, sourceFileBaseName + '.json');
		const ftl = await fs.readFile(sourceFile, 'utf8');
		const json = ftlToJSON(ftl, { transformTerms: false, storeTermsInJSON: false });
		await fs.outputJSON(destFile, json, { spaces: '\t' });
		onProgress(destFile, destFile, 'json');
	}
	const t2 = performance.now();
		return ({
			action: 'ftl->json',
			count: sourceFileBaseNames.length,
			totalCount: sourceFileBaseNames.length,
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
