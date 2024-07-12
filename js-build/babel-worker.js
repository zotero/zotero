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
			// React 18: wrap setState in onScroll handler with ReactDOM.flushSync to avoid
			// automatic batching https://react.dev/blog/2022/03/08/react-18-upgrade-guide#automatic-batching
			// which causes less frequent re-rendering and lagginess on scroll of components such as tag selector
			let onScrollSetStateChunkRegex = /(_this\.state\.isScrolling\s*\|\|\s*isScrollingChange\(!0\),\s*)(_this\.setState\s*\(\s*\{[^}]*\}\s*\))/;
			if (!onScrollSetStateChunkRegex.test(transformed)) {
				throw new Error(`"_this.state.isScrolling || isScrollingChange(!0), _this.setState({" not found in react-virtualized`);
			}
			transformed = transformed.replace(onScrollSetStateChunkRegex, (_, p1, p2) => {
				return `${p1}ReactDOM.flushSync(() => ${p2})`;
			});
		}
		// Patch single-file
		else if (sourcefile === 'resource/SingleFile/lib/single-file.js') {
			// Change for what I assume is a bug in Firefox. We create a singlefile
			// sandbox which is based on a document.defaultView of a hidden browser.
			// The minified single-file then uses globalThis.Set which for some reason
			// doesn't properly support iterating over and throws an error. The normal
			// `Set` object accessible in the sandbox does not have this problem.
			// I've tried using a proxy for globalThis with a custom Set, but that
			// manifest its own issues. Setting the globalThis to sandbox produced
			// issues with monkey-patching that singleFile does for default interfaces.
			transformed = contents.replace('globalThis.Set', 'Set')
				.replace('globalThis.Map', 'Map');
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