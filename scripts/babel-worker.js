/* global onmessage: true, postMessage: false */
'use strict';

const fs = require('fs-extra');
const path = require('path');
const babel = require('@babel/core');
const multimatch = require('multimatch');
const options = JSON.parse(fs.readFileSync('.babelrc'));
const cluster = require('cluster');
const { comparePaths } = require('./utils');

/* exported onmessage */
async function babelWorker(ev) {
	const t1 = Date.now();
	const sourcefile = ev.file;
	const localOptions = {
		filename: sourcefile
	};
	const outfile = path.join('build', sourcefile.replace('.jsx', '.js'));
	const postError = (error) => {
		process.send({
			sourcefile,
			outfile,
			error
		});
	};

	var isSkipped = false;
	var transformed;

	try {
		let contents = await fs.readFile(sourcefile, 'utf8');
		// Patch react
		if (comparePaths(sourcefile, 'resource/react.js')) {
			transformed = contents.replace('instanceof Error', '.constructor.name == "Error"')
		}
		// Patch react-dom
		else if (comparePaths(sourcefile, 'resource/react-dom.js')) {
			transformed = contents.replace(/ ownerDocument\.createElement\((.*?)\)/gi, 'ownerDocument.createElementNS(HTML_NAMESPACE, $1)')
				.replace('element instanceof win.HTMLIFrameElement',
					'typeof element != "undefined" && element.tagName.toLowerCase() == "iframe"')
				.replace("isInputEventSupported = false", 'isInputEventSupported = true');
		}
		// Patch react-virtualized
		else if (comparePaths(sourcefile, 'resource/react-virtualized.js')) {
			transformed = contents.replace('scrollDiv = document.createElement("div")', 'scrollDiv = document.createElementNS("http://www.w3.org/1999/xhtml", "div")')
				.replace('document.body.appendChild(scrollDiv)', 'document.documentElement.appendChild(scrollDiv)')
				.replace('document.body.removeChild(scrollDiv)', 'document.documentElement.removeChild(scrollDiv)');
		}

		// Patch single-file
		else if (sourcefile === 'resource/SingleFile/lib/single-file/single-file.js') {
			// We need to add this bit that is done for the cli implementation of singleFile
			// See resource/SingleFile/cli/back-ends/common/scripts.js
			const WEB_SCRIPTS = [
				"lib/single-file/processors/hooks/content/content-hooks-web.js",
				"lib/single-file/processors/hooks/content/content-hooks-frames-web.js"
			];
			let basePath = 'resource/SingleFile/';
		
			function readScriptFile(path, basePath) {
				return new Promise((resolve, reject) =>
					fs.readFile(basePath + path, (err, data) => {
						if (err) {
							reject(err);
						} else {
							resolve(data.toString() + "\n");
						}
					})
				);
			}
		
			const webScripts = {};
			await Promise.all(
				WEB_SCRIPTS.map(async path => webScripts[path] = await readScriptFile(path, basePath))
			);
		
			transformed = contents + '\n\n'
				+ "this.singlefile.lib.getFileContent = filename => (" + JSON.stringify(webScripts) + ")[filename];\n";
		}

		else if ('ignore' in options && options.ignore.some(ignoreGlob => multimatch(sourcefile, ignoreGlob).length)) {
			transformed = contents;
			isSkipped = true;
		} else {
			try {
				({ code: transformed } = await babel.transformAsync(
					contents,
					Object.assign(
						localOptions,
						options
					)
				));
			} catch (error) { return postError(`Babel error: ${error}`);}
		}

		await fs.outputFile(outfile, transformed);
		const t2 = Date.now();
		process.send({
			isSkipped,
			sourcefile,
			outfile,
			processingTime: t2 - t1
		});
	} catch (error) { return postError(`I/O error: ${error}`); }
}

module.exports = babelWorker;

if (cluster.isWorker) {
	process.on('message', babelWorker);
}