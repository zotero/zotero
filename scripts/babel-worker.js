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

		// Note about Single File helper and util patching:
		// I think this has something to do with the hidden browser being an older version or possibly
		// it is an issue with the sandbox, but it fails to find addEventListener and the fetch does
		// not work even if replace it properly in initOptions.

		// Patch single-file-helper
		else if (sourcefile === 'resource/SingleFileZ/lib/single-file/single-file-helper.js') {
			transformed = contents
				.replace('dispatchEvent(', 'window.dispatchEvent(')
				.replace(/addEventListener\(/g, 'window.addEventListener(');
		}
		
		// Patch index.js - This is a SingleFileZ issue. SingleFileZ does not typically use
		// use this code from SingleFile so the namespace is screwed up.
		else if (sourcefile === 'resource/SingleFileZ/lib/single-file/index.js') {
			transformed = contents
					.replace('this.frameTree.content.frames.getAsync',
						'this.processors.frameTree.content.frames.getAsync')
					.replace('this.lazy.content.loader.process',
						'this.processors.lazy.content.loader.process');
		}

		// Patch single-file-core
		// This style element trick was not working in the hidden browser, so we ignore it
		else if (sourcefile === 'resource/SingleFileZ/lib/single-file/single-file-core.js') {
			transformed = contents.replace('if (workStylesheet.sheet.cssRules.length) {', 'if (true) {');
		}
		
		// Patch content-lazy-loader
		else if (sourcefile === 'resource/SingleFileZ/lib/single-file/processors/lazy/content/content-lazy-loader.js') {
			transformed = contents
				.replace(
					'if (scrollY <= maxScrollY && scrollX <= maxScrollX)',
					'if (window.scrollY <= maxScrollY && window.scrollX <= maxScrollX)'
				);
		}

		// Patch single-file
		else if (sourcefile === 'resource/SingleFileZ/lib/single-file/single-file.js') {
			// We need to add this bit that is done for the cli implementation of singleFile
			// See resource/SingleFile/cli/back-ends/common/scripts.js
			const WEB_SCRIPTS = [
				"lib/single-file/processors/hooks/content/content-hooks-web.js",
				"lib/single-file/processors/hooks/content/content-hooks-frames-web.js"
			];
			let basePath = 'resource/SingleFileZ/';
		
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