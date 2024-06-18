import { ftlToJSON } from "ftl-tx";
import fs from 'fs-extra';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ftlFileBaseNames as sourceFileBaseNames } from './config.js';
import { onError, onProgress, onSuccess } from './utils.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRANSIFEX_FILE_NAME = 'zotero.json';

async function getJSON() {
	const t1 = performance.now();
	const sourceDir = join(ROOT, 'chrome', 'locale', 'en-US', 'zotero');
	const destFile = join(sourceDir, TRANSIFEX_FILE_NAME);
	let messagesMap = new Map();
	
	for (let sourceFileBaseName of sourceFileBaseNames) {
		const sourceFile = join(sourceDir, sourceFileBaseName + '.ftl');
		const ftl = await fs.readFile(sourceFile, 'utf8');
		const json = ftlToJSON(ftl, { transformTerms: false, storeTermsInJSON: false, skipRefOnly: true });
		Object.entries(json).forEach(([key, value]) => {
			if (messagesMap.has(key)) {
				throw new Error(`Duplicate key: ${key} found in file ${sourceFileBaseName}.ftl`);
			}
			messagesMap.set(key, value);
		});
		onProgress(`${sourceFileBaseName}.ftl`, TRANSIFEX_FILE_NAME, 'ftl->json');
	}
	
	const messagesJSON = Object.fromEntries(messagesMap);
	await fs.outputJSON(destFile, messagesJSON, { spaces: '\t' });
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
