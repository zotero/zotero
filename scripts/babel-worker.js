/* global onmessage: true, postMessage: false */
'use strict';

const fs = require('fs-extra');
const path = require('path');
const babel = require('babel-core');
const multimatch = require('multimatch');
const options = JSON.parse(fs.readFileSync('.babelrc'));
const cluster = require('cluster');

/* exported onmessage */
async function babelWorker(ev) {
	const t1 = Date.now();
	const sourcefile = ev.file;
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
		if (sourcefile === 'resource/react.js') {
			// patch react
			transformed = contents.replace('instanceof Error', '.constructor.name == "Error"')
		} else if (sourcefile === 'resource/react-dom.js') {
			// and react-dom
			transformed = contents.replace(/ ownerDocument\.createElement\((.*?)\)/gi, 'ownerDocument.createElementNS(HTML_NAMESPACE, $1)')
				.replace('element instanceof win.HTMLIFrameElement',
					'typeof element != "undefined" && element.tagName.toLowerCase() == "iframe"')
				.replace("isInputEventSupported = false", 'isInputEventSupported = true');
		} else if ('ignore' in options && options.ignore.some(ignoreGlob => multimatch(sourcefile, ignoreGlob).length)) {
			transformed = contents;
			isSkipped = true;
		} else {
			try {
				transformed = babel.transform(contents, options).code;
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