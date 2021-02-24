const path = require('path');
const chokidar = require('chokidar');
const multimatch = require('multimatch');
const { dirs, jsFiles, scssFiles, ignoreMask, copyDirs, symlinkFiles } = require('./config');
const { onSuccess, onError, getSignatures, writeSignatures, cleanUp, formatDirsForMatcher } = require('./utils');
const getJS = require('./js');
const getSass = require('./sass');
const getCopy = require('./copy');
const getSymlinks = require('./symlinks');


const ROOT = path.resolve(__dirname, '..');
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

function getWatch() {
	let watcher = chokidar.watch(source, { cwd: ROOT })
	.on('change', async (path) => {
		try {
			var matched = false;
			if (multimatch(path, jsFiles).length && !multimatch(path, ignoreMask).length) {
				onSuccess(await getJS(path, { ignore: ignoreMask }, signatures));
				onSuccess(await cleanUp(signatures));
				return;
			}
			for (var i = 0; i < scssFiles.length; i++) {
				if (multimatch(path, scssFiles[i])) {
					onSuccess(await getSass(scssFiles[i], { ignore: ignoreMask }));
					onSuccess(await cleanUp(signatures));
					return;
				}
			}
			if (multimatch(path, copyDirs.map(d => `${d}/**`)).length) {
				onSuccess(await getCopy(path, {}, signatures));
				onSuccess(await cleanUp(signatures));
				return;
			}
			if (multimatch(path, symlinks).length) {
				onSuccess(await getSymlinks(path, { nodir: true }, signatures));
				onSuccess(await cleanUp(signatures));
				return;
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
	console.log('Watching files for changes...');
}

module.exports = getWatch;

if (require.main === module) {
	(async () => {
		signatures = await getSignatures();
		getWatch();
	})();
}