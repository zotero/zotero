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
	'chrome/content/zotero/xpcom/translate/src',
	'styles',
	'translators',
];

// list of folders which are copied to the build folder
const copyDirs = [
	'test/tests/data'	// browser follows symlinks when loading test data
						// triggering false-positive test results with mismatched URIs
];

// list of files from root folder to symlink
const symlinkFiles = [
	'chrome.manifest',
	// React needs to be patched by babel-worker.js, so symlink all files in resource/ except for
	// those. Babel transpilation for React is still disabled in .babelrc.
	'resource/**/*',
	'!resource/react.js',
	'!resource/react-dom.js',
	'!resource/react-virtualized.js',
	// Only include dist directory of singleFile
	// Also do a little bit of manipulation similar to React
	'!resource/SingleFile/**/*',
	'resource/SingleFile/lib/**/*',
	'!resource/SingleFile/lib/single-file.js',
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
	'!chrome/skin/default/zotero/**/*.scss',
	'!resource/citeproc_rs_wasm.js',
	// We only need a few Monaco languages
	'!resource/vs/**/*',
	'resource/vs/loader.js',
	'resource/vs/editor/editor.main.{js,css,nls.js}',
	'resource/vs/base/**/*',
	'resource/vs/basic-languages/javascript/*.js',
	'resource/vs/basic-languages/typescript/*.js',
	'resource/vs/basic-languages/xml/*.js',
	'resource/vs/language/typescript/*.js',
	'resource/vs/language/json/*.js',
	'version',
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
	'resource/schema/global/README.md',
	'resource/schema/global/schema.json.gz',
	'resource/schema/global/scripts/*',
	'chrome/content/zotero/xpcom/translate/example/**/*',
	'chrome/content/zotero/xpcom/translate/README.md',
	'chrome/content/zotero/xpcom/utilities/node_modules/**/*',
	'chrome/content/zotero/xpcom/utilities/test/**/*',
	'chrome/content/zotero/xpcom/utilities/scripts/**/*',
	'chrome/content/zotero/xpcom/utilities/package*.json',
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
	'resource/SingleFile/lib/single-file.js',
	'resource/citeproc_rs_wasm.js',
];

const scssFiles = [
	'scss/**/*.scss',
	'chrome/skin/default/zotero/**/*.scss'
];

const ftlFileBaseNames = [
	'zotero',
	'preferences',
];

const buildsURL = 'https://zotero-download.s3.amazonaws.com/ci/';

module.exports = {
	dirs,
	symlinkDirs,
	copyDirs,
	symlinkFiles,
	browserifyConfigs,
	jsFiles,
	scssFiles,
	ignoreMask,
	ftlFileBaseNames,
	buildsURL,
};
