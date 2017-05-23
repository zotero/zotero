/* global onmessage: true, postMessage: false */
'use strict';

const fs = require('fs');
const path = require('path');
const babel = require('babel-core');
const mkdirp = require('mkdirp');
const options = JSON.parse(fs.readFileSync('.babelrc'));

/* exported onmessage */
onmessage = (ev) => {
	const t1 = Date.now();
	const sourcefile = path.normalize(ev.data);
	let isError = false;
	let isSkipped = false;
	
	fs.readFile(sourcefile, 'utf8', (err, data) => {
		var transformed;
		if(sourcefile === 'resource/react-dom.js') {
			transformed = data.replace(/ownerDocument\.createElement\((.*?)\)/gi, 'ownerDocument.createElementNS(DOMNamespaces.html, $1)');
		} else if('ignore' in options && options.ignore.includes(sourcefile)) {
			transformed = data;
			isSkipped = true;
		} else {
			transformed = babel.transform(data, options).code;
		}

		const outfile = path.join('build', sourcefile);
		isError = !!err;

		mkdirp(path.dirname(outfile), err => {
			isError = !!err;

			fs.writeFile(outfile, transformed, err => {
				isError = !!err;
				const t2 = Date.now();

				postMessage({
					isError,
					isSkipped,
					sourcefile,
					outfile,
					processingTime: t2 - t1
				});	
			});
		});
	});	
};