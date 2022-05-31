/* eslint-disable no-process-env */
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const multimatch = require('multimatch');
const { exec } = require('child_process');
const { dirs, jsFiles, scssFiles, ignoreMask, copyDirs, symlinkFiles, rewriteSrcFiles } = require('./config');
const { envCheckTrue, onSuccess, onError, getSignatures, writeSignatures, cleanUp, formatDirsForMatcher } = require('./utils');
const getJS = require('./js');
const getSass = require('./sass');
const getCopy = require('./copy');
const getSymlinks = require('./symlinks');
const getRewriteSrc = require('./rewrite-src');
const colors = require('colors/safe');

const ROOT = path.resolve(__dirname, '..');
const addOmniExecPath = path.join(ROOT, '..', 'zotero-standalone-build', 'scripts', 'add_omni_file');
let shouldAddOmni = false;
const REWRITE_SRC = envCheckTrue(process.env.REWRITE_SRC);
const DEBUG = envCheckTrue(process.env.DEBUG);
const ZOTERO_HTTP_SERVER_PORT = process.env.ZOTERO_HTTP_SERVER_PORT || 23119;

const filteredIgnoreMask = REWRITE_SRC
	? ignoreMask.filter(f => !f.startsWith('chrome/content/zotero/devHelper'))
	: ignoreMask;

const source = [
	'chrome',
	'components',
	'defaults',
	'resource',
	'scss',
	'test',
	'styles',
	'translators',
	'scss',
	'chrome/**',
	'components/**',
	'defaults/**',
	'resource/**',
	'scss/**',
	'test/**',
	'styles/**',
	'translators/**',
	'scss/**'
];

const symlinks = symlinkFiles
				.concat(dirs.map(d => `${d}/**`))
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.js`])
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.jsx`])
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.scss`])
				.concat([`!${formatDirsForMatcher(copyDirs)}/**`])
				.concat(REWRITE_SRC ? rewriteSrcFiles.map(rsf => `!${rsf}`) : []);

var signatures;

process.on('SIGINT', () => {
	writeSignatures(signatures);
	process.exit(); // eslint-disable-line no-process-exit
});

async function addOmniFiles(relPaths) {
	const t1 = Date.now();
	const buildDirPath = path.join(ROOT, 'build');
	const wrappedPaths = relPaths.map(relPath => `"${path.relative(buildDirPath, relPath)}"`);

	await new Promise((resolve, reject) => {
		const cmd = `"${addOmniExecPath}" ${wrappedPaths.join(' ')}`;
		exec(cmd, { cwd: buildDirPath }, (error, output) => {
			if (error) {
				reject(error);
			}
			else {
				DEBUG && console.log(`Executed:\n${cmd};\nOutput:\n${output}\n`);
				resolve(output);
			}
		});
	});

	const t2 = Date.now();
	
	return {
		action: 'add-omni-files',
		count: relPaths.length,
		totalCount: relPaths.length,
		processingTime: t2 - t1
	};
}

async function notifyHTTP() {
	const host = '127.0.0.1';
	try {
		await fetch(
			`http://${host}:${ZOTERO_HTTP_SERVER_PORT}/dev-helper/update`,
			{ method: 'POST', headers: { contentType: 'text/plain' } }
		);
		console.log(`${colors.magenta('Notify:')} client on ${host}:${ZOTERO_HTTP_SERVER_PORT} notifed`);
	} catch (e) {
		console.log(`${colors.gray('Notify:')} no client on ${host}:${ZOTERO_HTTP_SERVER_PORT}`);
	}
}

async function getWatch() {
	try {
		await fs.access(addOmniExecPath, fs.constants.F_OK);
		shouldAddOmni = !envCheckTrue(process.env.SKIP_OMNI);
	}
	catch (_) {}

	let watcher = chokidar.watch(source, { cwd: ROOT })
	.on('change', async (path) => {
		try {
			var result = false;
			if (multimatch(path, jsFiles).length && !multimatch(path, filteredIgnoreMask).length) {
				result = await getJS(path, { ignore: filteredIgnoreMask }, signatures);
				onSuccess(await cleanUp(signatures));
			}
			if (!result) {
				for (var i = 0; i < scssFiles.length; i++) {
					if (multimatch(path, scssFiles[i]).length) {
						result = await getSass(scssFiles[i], { ignore: filteredIgnoreMask }); // eslint-disable-line no-await-in-loop
						break;
					}
				}
			}
			if (!result && multimatch(path, copyDirs.map(d => `${d}/**`)).length) {
				result = await getCopy(path, {}, signatures);
			}
			if (REWRITE_SRC && !result && multimatch(path, rewriteSrcFiles).length) {
				result = await getRewriteSrc(rewriteSrcFiles, {}, signatures);
			}
			if (!result && multimatch(path, symlinks).length) {
				result = await getSymlinks(path, { nodir: true }, signatures);
			}

			if (result) {
				onSuccess(result);
				onSuccess(await cleanUp(signatures));

				if (shouldAddOmni && result.outFiles?.length) {
					onSuccess(await addOmniFiles(result.outFiles));
				}

				if (REWRITE_SRC && result.outFiles?.length) {
					await notifyHTTP();
				}
			}
		}
		catch (err) {
			onError(err);
		}
	})
	.on('unlink', async () => {
		const signatures = await getSignatures();
		onSuccess(await cleanUp(signatures));
	});

	watcher.add(source);
	console.log(`[${colors.magenta(shouldAddOmni ? '✓' : '⨯')}] omni updates | [${colors.magenta(REWRITE_SRC ? '✓' : '⨯')}] notify ipc | Watching files for changes...`);
}

module.exports = getWatch;

if (require.main === module) {
	(async () => {
		signatures = await getSignatures();
		getWatch();
	})();
}
