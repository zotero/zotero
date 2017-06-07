'use strict';

const gulp = require('gulp');
const del = require('del');
const vfs = require('vinyl-fs');
const gutil = require('gulp-util');
const babel = require('gulp-babel');
const sass = require('gulp-sass');
const os = require('os');
const glob = require('glob');
const Worker = require('tiny-worker');
const merge = require('merge-stream');
const tap = require('gulp-tap');
const rename = require('gulp-rename');
const browserify = require('browserify');
const reactPatcher = require('./gulp/gulp-react-patcher');
const isWindows = /^win/.test(process.platform);
const NODE_ENV = process.env.NODE_ENV;
const workers = [];
var isExiting = false;

const formatDirsforMatcher = dirs => {
	return dirs.length > 1 ? `{${dirs.join(',')}}` : dirs[0];
};

const killAllWorkers = () => {
	for(let worker of workers) {
		worker.terminate();
	}
};

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
	'translators',
];

// list of folders which are copied to the build folder
const copyDirs = [
	'test/tests/data' // browser follows symlinks when loading test data
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

const jsGlob = `./\{${dirs.join(',')}\}/**/*.js`;
const jsGlobIgnore = `./\{${symlinkDirs.concat(copyDirs).join(',')}\}/**/*.js`;

function onError(shouldExit, err) {
	if(shouldExit) {
		isExiting = true;
		killAllWorkers();
		throw new Error(err);
	} else {
		gutil.log(gutil.colors.red('Error:'), err);
		this.emit('end');
	}
}

function onSuccess(msg) {
	if(!isExiting) {
		gutil.log(gutil.colors.green('Build:'), msg);
	}
}

function getBrowserify(exitOnError = true) {
	const streams = browserifyConfigs.map(config => {
		return gulp
			.src(config.src)
			.pipe(tap(file => {
				file.contents = browserify(file.path, config.config).bundle();
			}))
			.pipe(rename(config.dest))
			.on('error', function(err) { onError.bind(this)(exitOnError, err); })
			.on('data', file => {
				onSuccess(`[browserify] ${file.path}`);
			})
			.pipe(gulp.dest('build'));
	});

	return merge.apply(merge, streams);
}

function getJS(source, sourceIgnore, exitOnError = true) {
	if (sourceIgnore) {
		source = [source, '!' + sourceIgnore];
	}

	return gulp.src(source, { base: '.' })
		.pipe(babel())
		.on('error', function(err) { onError.bind(this)(exitOnError, err); })
		.on('data', file => {
			onSuccess(`[js] ${file.path}`);
		})
		.pipe(reactPatcher())
		.pipe(gulp.dest('./build'));
}

function getJSParallel(source, sourceIgnore, exitOnError = true) {
	const jsFiles = glob.sync(source, { ignore: sourceIgnore });
	const cpuCount = os.cpus().length;
	const threadCount = Math.min(cpuCount, jsFiles.length);
	let threadsActive = threadCount;
	let isError = false;

	return new Promise((resolve, reject) => {
		for(let i = 0; i < threadCount; i++) {
			let worker = new Worker('gulp/babel-worker.js');
			workers[i] = worker;
			worker.onmessage = ev => {
				if(ev.data.error) {
					isError = true;
					let errorMsg = `Failed while processing ${ev.data.sourcefile}: ${ev.data.error}`;
					NODE_ENV == 'debug' && console.log(`process ${i}: ${errorMsg}`);
					onError(exitOnError, errorMsg);
					reject(errorMsg);
				}

				NODE_ENV == 'debug' && console.log(`process ${i} took ${ev.data.processingTime} ms to process ${ev.data.sourcefile}`);
				NODE_ENV != 'debug' && onSuccess(`[js] ${ev.data.sourcefile}`);
				
				if(ev.data.isSkipped) {
					NODE_ENV == 'debug' && console.log(`process ${i} SKIPPED ${ev.data.sourcefile}`);
				}
				let nextFile = jsFiles.pop();

				if(!isError && nextFile) {
					NODE_ENV == 'debug' && console.log(`process ${i} scheduled to process ${nextFile}`);
					worker.postMessage(nextFile);
				} else {
					NODE_ENV == 'debug' && console.log(`process ${i} has terminated`);
					worker.terminate();
					workers.splice(i, 1);
					if(!--threadsActive) {
						resolve();
					}
				}
			};
			worker.postMessage(jsFiles.pop());
		}
		
		NODE_ENV == 'debug' && console.log(`Started ${threadCount} processes for processing JS`);
	});
}

function getSymlinks(exitOnError = true) {
	const match = symlinkFiles
		.concat(dirs.map(d => `${d}/**`))
		.concat(symlinkDirs.map(d => `${d}/**`))
		.concat([`!./${formatDirsforMatcher(dirs)}/**/*.js`])
		.concat([`!./${formatDirsforMatcher(copyDirs)}/**`]);

	return gulp
		.src(match, { nodir: true, base: '.', read: isWindows })
		.on('error', function(err) { onError.bind(this)(exitOnError, err); })
		.on('data', file => {
			onSuccess(`[ln] ${file.path.substr(__dirname.length + 1)}`);
		})
		.pipe(isWindows ? gulp.dest('build/') : vfs.symlink('build/'));
}

function getCopy(exitOnError = true) {
	return gulp
		.src(copyDirs.map(d => `${d}/**`), { base: '.' })
		.on('data', file => {
			onSuccess(`[cp] ${file.path.substr(__dirname.length + 1)}`);
		})
		.on('error', function(err) { onError.bind(this)(exitOnError, err); })
		.pipe(gulp.dest('build/'));
}

function getSass(exitOnError = true) {
	return gulp
		.src('scss/*.scss')
		.on('error', function(err) { onError.bind(this)(exitOnError, err); })
		.pipe(sass())
		.pipe(gulp.dest('./build/chrome/skin/default/zotero/components/'));
}


gulp.task('clean', () => {
	return del('build');
});

gulp.task('symlink', () => {
	return getSymlinks();
});

gulp.task('js', done => {
	getJSParallel(jsGlob, jsGlobIgnore)
		.then(done)
		.catch(errorMsg => {
			onError(errorMsg);
		});
});

gulp.task('browserify', () => {
	getBrowserify();
});

gulp.task('copy', () => {
	getCopy();
});

gulp.task('sass', () => {
	return getSass();
});

gulp.task('build', ['js', 'sass', 'symlink', 'browserify', 'copy']);

gulp.task('build-clean', ['clean'], () => {
	gulp.start('build');
});

gulp.task('dev', ['clean'], () => {
	var interval = 750;
	
	gulp.watch(jsGlob, { interval }).on('change', event => {
		getJS(event.path, jsGlobIgnore, false);
	});

	gulp.watch('src/styles/*.scss', { interval }).on('change', () => {
		getSass(false);
	});

	gulp.start('build');
});

gulp.task('default', ['dev']);