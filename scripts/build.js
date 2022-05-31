const colors = require('colors/safe');

const getBrowserify = require('./browserify');
const getCopy = require('./copy');
const getJS = require('./js');
const getSass = require('./sass');
const getSymlinks = require('./symlinks');
const getPDFReader = require('./pdf-reader');
const getPDFWorker = require('./pdf-worker');
const getZoteroNoteEditor = require('./note-editor');
const getRewriteSrc = require('./rewrite-src');
const { envCheckTrue, formatDirsForMatcher, getSignatures, writeSignatures, cleanUp, onSuccess, onError } = require('./utils');
const { dirs, envDependentFiles, symlinkDirs, copyDirs, symlinkFiles, jsFiles, scssFiles, rewriteSrcFiles } = require('./config');
let { ignoreMask } = require('./config');

const REWRITE_SRC = envCheckTrue(process.env.REWRITE_SRC);

if (REWRITE_SRC) {
	ignoreMask = ignoreMask.filter(f => !f.startsWith('chrome/content/zotero/devHelper'));
}

if (require.main === module) {
	(async () => {
		try {
			const t1 = Date.now();
			global.isError = false; // used to prevent further output to avoid concealing errors
			const symlinks = symlinkFiles
				.concat(dirs.map(d => `${d}/**`))
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.js`])
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.jsx`])
				.concat([`!${formatDirsForMatcher(dirs)}/**/*.scss`])
				.concat([`!${formatDirsForMatcher(copyDirs)}/**`])
				.concat(REWRITE_SRC ? rewriteSrcFiles.map(rsf => `!${rsf}`) : []);

			const signatures = await getSignatures();

			// Check if all files in signatures are still present in src; Needed to avoid a problem
			// where what was a symlink before, now is compiled, resulting in polluting source files
			onSuccess(await cleanUp(
				signatures,
				symlinks.concat(symlinkDirs).concat([`!${formatDirsForMatcher(copyDirs)}`]),
				envDependentFiles
			));
			
			const jobs = [
				getBrowserify(signatures),
				getCopy(copyDirs.map(d => `${d}/**`), { ignore: ignoreMask }, signatures),
				getJS(jsFiles, { ignore: ignoreMask }, signatures),
				...scssFiles.map(scf => getSass(scf, { ignore: ignoreMask }, signatures)),
				getSymlinks(symlinks, { nodir: true, ignore: ignoreMask }, signatures),
				getSymlinks(symlinkDirs, { ignore: ignoreMask }, signatures),
				getPDFReader(signatures),
				getPDFWorker(signatures),
				getZoteroNoteEditor(signatures)
			];

			if (REWRITE_SRC) {
				jobs.push(getRewriteSrc(rewriteSrcFiles, { ignore: ignoreMask }, signatures));
			}

			const results = await Promise.all(jobs);

			await writeSignatures(signatures);
			for (const result of results) {
				onSuccess(result);
			}
			const t2 = Date.now();
			console.log(colors.yellow(`Total build time ${t2 - t1}ms`));
		} catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}