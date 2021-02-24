/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2021 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     http://digitalscholar.org/
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

const SCALE_FACTOR = 4;

window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'resource://zotero/pdf-reader/pdf.worker.js';

function errObject(err) {
	return JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)));
}

let lastPromiseID = 0;
let waitingPromises = {};

async function query(action, data, transfer) {
	return new Promise((resolve, reject) => {
		lastPromiseID++;
		waitingPromises[lastPromiseID] = { resolve, reject };
		parent.postMessage({
			id: lastPromiseID,
			action,
			data
		}, parent.origin, transfer);
	});
}

async function renderAnnotations(buf, annotations) {
	let num = 0;
	let pdfDocument = await window.pdfjsLib.getDocument({ data: buf }).promise;
	let pages = new Map();
	for (let annotation of annotations) {
		let pageIndex = annotation.position.pageIndex;
		let page = pages.get(pageIndex) || [];
		page.push(annotation);
		pages.set(pageIndex, page);
	}
	for (let [pageIndex, annotations] of pages) {
		let { canvas, viewport } = await renderPage(pdfDocument, pageIndex);
		for (let annotation of annotations) {
			let position = p2v(annotation.position, viewport);
			let rect = position.rects[0];
			let [left, top, right, bottom] = rect;
			let width = right - left;
			let height = bottom - top;
			let newCanvas = document.createElement('canvas');
			newCanvas.width = width;
			newCanvas.height = height;
			let newCanvasContext = newCanvas.getContext('2d');
			newCanvasContext.drawImage(canvas, left, top, width, height, 0, 0, width, height);
			let blob = await new Promise(resolve => newCanvas.toBlob(resolve, 'image/png'));
			let image = await new Response(blob).arrayBuffer();
			await query('renderedAnnotation', { annotation: { id: annotation.id, image } }, [image]);
			num++;
		}
	}
	return num;
}

function p2v(position, viewport) {
	return {
		pageIndex: position.pageIndex,
		rects: position.rects.map(rect => {
			let [x1, y2] = viewport.convertToViewportPoint(rect[0], rect[1]);
			let [x2, y1] = viewport.convertToViewportPoint(rect[2], rect[3]);
			return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
		})
	};
}

async function renderPage(pdfDocument, pageIndex) {
	let page = await pdfDocument.getPage(pageIndex + 1);
	var canvas = document.createElement('canvas');
	var viewport = page.getViewport({ scale: SCALE_FACTOR });
	var context = canvas.getContext('2d', { alpha: false });
	canvas.height = viewport.height;
	canvas.width = viewport.width;
	await page.render({ canvasContext: context, viewport: viewport }).promise;
	return { canvas, viewport };
}

window.addEventListener('message', async (event) => {
	if (event.source === parent) {
		return;
	}
	let message = event.data;

	if (message.responseID) {
		let { resolve, reject } = waitingPromises[message.responseID];
		delete waitingPromises[message.responseID];
		if (message.data) {
			resolve(message.data);
		}
		else {
			let err = new Error(message.error.message);
			Object.assign(err, message.error);
			reject(err);
		}
		return;
	}
				
	if (message.action === 'renderAnnotations') {
		try {
			let { buf, annotations } = message.data;
			let num = await renderAnnotations(buf, annotations);
			parent.postMessage({ responseID: message.id, data: num }, parent.origin);
		}
		catch (e) {
			console.log(e);
			parent.postMessage({
				responseID: message.id,
				error: errObject(e)
			}, parent.origin);
		}
	}
});

setTimeout(() => {
	query('initialized', {});
}, 100);
