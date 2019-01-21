const globby = require('globby');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const cluster = require('cluster');
const { getSignatures, compareSignatures, getFileSignature, writeSignatures, cleanUp, onSuccess, onError, onProgress } = require('./utils');
const { jsFiles, ignoreMask } = require('./config');

const NODE_ENV = process.env.NODE_ENV;
const ROOT = path.resolve(__dirname, '..');

async function getJS(source, options, signatures) {
	const t1 = Date.now();
	const matchingJSFiles = await globby(source, Object.assign({ cwd: ROOT }, options));
	const cpuCount = os.cpus().length;
	const totalCount = matchingJSFiles.length;
	var count = 0;
	var isError = false;

	cluster.setupMaster({
		exec: path.join(__dirname, 'babel-worker.js')
	});

	// check signatures, collect signatures for files to be processes 
	const newFilesSignatures = {};
	const filesForProcessing = [];
	var f;
	while ((f = matchingJSFiles.pop()) != null) {
		const newFileSignature = await getFileSignature(f);
		const dest = path.join('build', f.replace('.jsx', '.js'));
		f = path.normalize(f);
		if (f in signatures) {
			if (compareSignatures(newFileSignature, signatures[f])) {
				try {
					await fs.access(dest, fs.constants.F_OK);
					continue;
				} catch (_) {
					// file does not exists in build, fallback to browserifing
				}
			}
		}
		filesForProcessing.push(f);
		newFilesSignatures[f] = newFileSignature;
	}

	// shortcut if no files need rebuilding
	if (Object.keys(filesForProcessing).length === 0) {
		const t2 = Date.now();
		return Promise.resolve({
				action: 'js',
				count,
				totalCount,
				processingTime: t2 - t1
		});
	}

	// distribute processing among workers
	const workerCount = Math.min(cpuCount, filesForProcessing.length);
	var workersActive = workerCount;
	NODE_ENV == 'debug' && console.log(`Will process ${filesForProcessing.length} files using ${workerCount} processes`);
	return new Promise((resolve, reject) => {
		for (let i = 0; i < workerCount; i++) {
			var worker = cluster.fork();

			worker.on('message', function(ev) {
				if (ev.error) {
					isError = true;
					let errorMsg = `Failed while processing ${ev.sourcefile}: ${ev.error}`;
					reject(errorMsg);
				} else {
					signatures[ev.sourcefile] = newFilesSignatures[ev.sourcefile];
					
					if (ev.isSkipped) {
						NODE_ENV == 'debug' && console.log(`process ${this.id} SKIPPED ${ev.sourcefile}`);
					} else {
						NODE_ENV == 'debug' && console.log(`process ${this.id} took ${ev.processingTime} ms to process ${ev.sourcefile} into ${ev.outfile}`);
						NODE_ENV != 'debug' && onProgress(ev.sourcefile, ev.outfile, 'js');
						count++;
					}
				}

				let nextFile = filesForProcessing.pop();

				if (!isError && nextFile) {
					NODE_ENV == 'debug' && console.log(`process ${this.id} scheduled to process ${nextFile}`);
					this.send({
						file: nextFile
					});
				} else {
					if (this.isConnected()) {
						this.kill();
					}
					NODE_ENV == 'debug' && console.log(`process ${this.id} has terminated`);
					if (!--workersActive) {
						const t2 = Date.now();
						resolve({
							action: 'js',
							count,
							totalCount,
							processingTime: t2 - t1
						});
					}
				}
			});

			let nextFile = filesForProcessing.pop();
			NODE_ENV == 'debug' && console.log(`process ${worker.id} scheduled to process ${nextFile}`);
			worker.send({
				file: nextFile
			});
		}
	});
}

module.exports = getJS;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getJS(jsFiles, { ignore: ignoreMask }, signatures));
			onSuccess(await cleanUp(signatures));
			await writeSignatures(signatures);
		} catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}