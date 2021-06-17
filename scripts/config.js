// list of folders from where .js files are compiled and non-js files are symlinked
const dirs = [
	'chrome',
	'components',
	'defaults',
	'test',
	'test/resource/chai',
	'test/resource/chai-as-promised',
	'test/resource/mocha'
];

// list of folders that are symlinked
const symlinkDirs = [
	'chrome/content/zotero/xpcom/rdf',
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
	'chrome.manifest',
	'install.rdf',
	// React needs to be patched by babel-worker.js, so symlink all files in resource/ except for
	// those. Babel transpilation for React is still disabled in .babelrc.
	'resource/**/*',
	'!resource/react.js',
	'!resource/react-dom.js',
	'!resource/react-virtualized.js',
	// Only include lib directory of singleFile
	// Also do a little bit of manipulation similar to React
	'!resource/SingleFile/**/*',
	'resource/SingleFile/lib/**/*',
	'resource/SingleFile/extension/lib/single-file/fetch/content/content-fetch.js',
	'!resource/SingleFile/lib/single-file/single-file.js',
	// We only need a couple Ace Editor files
	'!resource/ace/**/*',
	'resource/ace/ace.js',
	// Enable for autocomplete
	//'resource/ace/ext-language_tools.js',
	'resource/ace/ext-searchbox.js',
	'resource/ace/keybinding-emacs.js',
	'resource/ace/keybinding-vim.js',
	'resource/ace/mode-javascript.js',
	'resource/ace/theme-chrome.js',
	'resource/ace/theme-monokai.js',
	'resource/ace/worker-javascript.js',
	// Feed *.idl files are for documentation only
	'!resource/feeds/*.idl',
	'update.rdf',
	'!chrome/skin/default/zotero/**/*.scss'
];


// these files will be browserified during the build
const browserifyConfigs = [
	{
		src: 'node_modules/react-select/dist/react-select.cjs.prod.js',
		dest: 'resource/react-select.js',
		config: {
			standalone: 'react-select'
		}
	},
	{
		src: 'node_modules/url/url.js',
		dest: 'resource/url.js',
		config: {
			standalone: 'url'
		}
	},
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
const ignoreMask = [
	'**/#*',
	'resource/schema/global/schema.json.gz'
];

const jsFiles = [
	`{${dirs.join(',')}}/**/*.js`,
	`{${dirs.join(',')}}/**/*.jsx`,
	`!{${symlinkDirs.concat(copyDirs).join(',')}}/**/*.js`,
	`!{${symlinkDirs.concat(copyDirs).join(',')}}/**/*.jsx`,
	// Special handling for React -- see note above
	'resource/react.js',
	'resource/react-dom.js',
	'resource/react-virtualized.js',
	'resource/SingleFile/lib/single-file/single-file.js'
];

const scssFiles = [
	'scss/**/*.scss',
	'chrome/skin/default/zotero/**/*.scss'
];

const buildsURL = 'https://zotero-download.s3.amazonaws.com/ci/';

module.exports = {
	dirs, symlinkDirs, copyDirs, symlinkFiles, browserifyConfigs, jsFiles, scssFiles, ignoreMask, buildsURL
};
