// list of folders from where .js files are compiled and non-js files are symlinked
const dirs = [
	'chrome',
	'components',
	'defaults',
	'resource',
	'resource/web-library',
	'test',
	'test/resource/chai',
	'test/resource/chai-as-promised',
	'test/resource/mocha'
];

// list of folders from which all files are symlinked
const symlinkDirs = [
	'styles',
	'translators'
];

// list of folders which are copied to the build folder
const copyDirs = [
	'test/tests/data'	// browser follows symlinks when loading test data
						// triggering false-positive test results with mismatched URIs
];

// list of files from root folder to symlink
const symlinkFiles = [
	'chrome.manifest', 'install.rdf', 'update.rdf'
];


// these files will be browserified during the build
const browserifyConfigs = [
	{
		src: 'node_modules/sinon/lib/sinon.js',
		dest: 'test/resource/sinon.js',
		config: {
			standalone: 'sinon'
		}
	},
	{
		src: 'node_modules/chai-as-promised/lib/chai-as-promised.js',
		dest: 'test/resource/chai-as-promised.js',
		config: {
			standalone: 'chaiAsPromised'
		}
	}
];

// exclude mask used for js, copy, symlink and sass tasks
const ignoreMask = ['**/#*'];

const jsFiles = [
	`{${dirs.join(',')}}/**/*.js`,
	`!{${symlinkDirs.concat(copyDirs).join(',')}}/**/*.js`
];

module.exports = {
	dirs, symlinkDirs, copyDirs, symlinkFiles, browserifyConfigs, jsFiles, ignoreMask
};