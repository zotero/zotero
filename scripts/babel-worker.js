/* global onmessage: true, postMessage: false */
'use strict';

const fs = require('fs-extra');
const path = require('path');
const babel = require('@babel/core');
const multimatch = require('multimatch');
const options = JSON.parse(fs.readFileSync('.babelrc'));
const cluster = require('cluster');

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
		if (sourcefile === 'resource/react.js') {
			transformed = contents.replace('instanceof Error', '.constructor.name == "Error"')
		}
		// Patch react-dom
		else if (sourcefile === 'resource/react-dom.js') {
			transformed = contents.replace(/ ownerDocument\.createElement\((.*?)\)/gi, 'ownerDocument.createElementNS(HTML_NAMESPACE, $1)')
				.replace('element instanceof win.HTMLIFrameElement',
					'typeof element != "undefined" && element.tagName.toLowerCase() == "iframe"')
				.replace("isInputEventSupported = false", 'isInputEventSupported = true');
		}
		// Patch react-virtualized
		else if (sourcefile === 'resource/react-virtualized.js') {
			transformed = contents.replace('scrollDiv = document.createElement("div")', 'scrollDiv = document.createElementNS("http://www.w3.org/1999/xhtml", "div")')
				.replace('document.body.appendChild(scrollDiv)', 'document.documentElement.appendChild(scrollDiv)')
				.replace('document.body.removeChild(scrollDiv)', 'document.documentElement.removeChild(scrollDiv)');
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