/* global onmessage: true, postMessage: false */
'use strict';

const fs = require('fs');
const path = require('path');
const babel = require('babel-core');
const minimatch = require('minimatch')
const mkdirp = require('mkdirp');
const options = JSON.parse(fs.readFileSync('.babelrc'));

/* exported onmessage */
onmessage = (ev) => {
	const t1 = Date.now();
	const sourcefile = path.normalize(ev.data);
	let error = null;
	let isSkipped = false;

	fs.readFile(sourcefile, 'utf8', (err, data) => {
		var transformed;
		if(sourcefile === 'resource/react-dom.js') {
			transformed = data.replace(/ownerDocument\.createElement\((.*?)\)/gi, 'ownerDocument.createElementNS(DOMNamespaces.html, $1)');
		} else if('ignore' in options && options.ignore.some(ignoreGlob => minimatch(sourcefile, ignoreGlob))) {
			transformed = data;
			isSkipped = true;
		} else {
			try {
				transformed = babel.transform(data, options).code;
			} catch(c) {
				transformed = data;
				isSkipped = true;
				error = c.message;
			}
		}

		const outfile = path.join('build', sourcefile);
		error = error || err;

		mkdirp(path.dirname(outfile), err => {
			error = error || err;

			fs.writeFile(outfile, transformed, err => {
				error = error || err;

				const t2 = Date.now();
				postMessage({
					isSkipped,
					sourcefile,
					outfile,
					error,
					processingTime: t2 - t1
				});	
			});
		});
	});	
};