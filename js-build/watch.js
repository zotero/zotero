const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const multimatch = require('multimatch');
const { exec } = require('child_process');
const { dirs, jsFiles, scssFiles, ignoreMask, copyDirs, symlinkFiles } = require('./config');
const { envCheckTrue, onSuccess, onError, getSignatures, writeSignatures, cleanUp, formatDirsForMatcher } = require('./utils');
const getJS = require('./js');
const getSass = require('./sass');
const getCopy = require('./copy');
const getSymlinks = require('./symlinks');


const ROOT = path.resolve(__dirname, '..');
const addOmniExecPath = path.join(ROOT, 'app', 'scripts', 'add_omni_file');
let shouldAddOmni = false;

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
				.concat([`!${formatDirsForMatcher(copyDirs)}/**`]);

var signatures;

process.on('SIGINT', () => {
	writeSignatures(signatures);
	process.exit();
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
				process.env.NODE_ENV === 'debug' && console.log(`Executed:\n${cmd};\nOutput:\n${output}\n`);
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
			if (multimatch(path, jsFiles).length && !multimatch(path, ignoreMask).length) {
				result = await getJS(path, { ignore: ignoreMask }, signatures);
				onSuccess(await cleanUp(signatures));
			}
			if (!result) {
				for (var i = 0; i < scssFiles.length; i++) {
					if (multimatch(path, scssFiles[i]).length) {
						result = await getSass(scssFiles[i], { ignore: ignoreMask }); // eslint-disable-line no-await-in-loop
						break;
					}
				}
			}
			if (!result && multimatch(path, copyDirs.map(d => `${d}/**`)).length) {
				result = await getCopy(path, {}, signatures);
			}
			if (!result && multimatch(path, symlinks).length) {
				result = await getSymlinks(path, { nodir: true }, signatures);
			}

			onSuccess(result);
			onSuccess(await cleanUp(signatures));

			if (shouldAddOmni && result.outFiles?.length) {
				onSuccess(await addOmniFiles(result.outFiles));
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
	console.log(`Watching files for changes (omni updates ${shouldAddOmni ? 'enabled' : 'disabled'})...`);
}

module.exports = getWatch;

if (require.main === module) {
	(async () => {
		signatures = await getSignatures();
		getWatch();
	})();
}
