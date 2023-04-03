import { extractTerms, ftlToJSON, JSONToFtl } from 'ftl-tx';
import fs from 'fs-extra';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { onError, onProgress, onSuccess } from './utils.js';
import { exit } from 'process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSONDir = join(ROOT, 'tmp', 'tx');
const localesDir = join(ROOT, 'chrome', 'locale');
const sourceDir = join(localesDir, 'en-US', 'zotero');

const termsSourceFTLPath = join(ROOT, 'app', 'assets', 'branding', 'locale', 'brand.ftl');
const fallbackJSONPath = join(sourceDir, 'zotero.json');

// don't override source zotero.ftl
const localeToSkip = ['en-US'];

async function getFTL() {
	const t1 = performance.now();
	if (!(await fs.pathExists(fallbackJSONPath))) {
		console.error(`File ${fallbackJSONPath} does not exist, please run 'ftl-to-json' first`);
		exit(1);
	}

	if (!(await fs.pathExists(termsSourceFTLPath))) {
		console.error(`Required file ${termsSourceFTLPath} does not exist`);
		exit(1);
	}

	const fallbackJSON = await fs.readJSON(fallbackJSONPath);
	const terms = extractTerms(await fs.readFile(termsSourceFTLPath, 'utf-8'));

	const expectedLocale = (await fs.readdir(localeDir, { withFileTypes: true }))
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	const totalCount = expectedLocale.length;
	let locale;
	let count = 0;

	while ((locale = expectedLocale.pop())) {
		if (localeToSkip.includes(locale)) {
			count++;
			continue;
		}

		const ftlFilePath = join(ROOT, 'chrome', 'locale', locale, 'zotero', 'zotero.ftl');
		let JSONFromLocalFTL = {};
		try {
			const ftl = await fs.readFile(ftlFilePath, 'utf8');
			JSONFromLocalFTL = ftlToJSON(ftl, { transformTerms: false, storeTermsInJSON: false });
		}
		catch (e) {
			// no local .ftl file
		}

		const JSONFilePath = join(JSONDir, `zotero_${locale.replace('-', '_')}.json`);
		let JSONFromTransifex = {};
		try {
			const json = await fs.readJSON(JSONFilePath);
			JSONFromTransifex = json;
		}
		catch (e) {
			// no .json file from transifex
		}

		const mergedJSON = { ...fallbackJSON, ...JSONFromLocalFTL, ...JSONFromTransifex };
		const ftl = JSONToFtl(mergedJSON, { addTermsToFTL: false, storeTermsInJSON: false, transformTerms: false, terms });

		const outFtlPath = join(ROOT, 'chrome', 'locale', locale, 'zotero', 'zotero.ftl');
		await fs.outputFile(outFtlPath, ftl);
		onProgress(outFtlPath, outFtlPath, 'ftl');
		count++;
	}

	const t2 = performance.now();
	return ({
		action: 'ftl',
		count,
		totalCount,
		processingTime: t2 - t1
	});
}


if (process.argv[1] === fileURLToPath(import.meta.url)) {
	(async () => {
		try {
			onSuccess(await getFTL());
		}
		catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}
