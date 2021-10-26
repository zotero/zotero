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

const SCALE = 4;
const PATH_BOX_PADDING = 10; // pt
const MIN_PATH_BOX_SIZE = 30; // pt
const MAX_CANVAS_PIXELS = 16777216; // 16 megapixels

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
	for (let annotation of annotations) {
		let canvas = await renderImage(pdfDocument, annotation);
		let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
		let image = await new Response(blob).arrayBuffer();
		await query('renderedAnnotation', { annotation: { id: annotation.id, image } }, [image]);
		num++;
	}
	return num;
}

function p2v(position, viewport) {
	if (position.rects) {
		return {
			pageIndex: position.pageIndex,
			rects: position.rects.map((rect) => {
				let [x1, y2] = viewport.convertToViewportPoint(rect[0], rect[1]);
				let [x2, y1] = viewport.convertToViewportPoint(rect[2], rect[3]);
				return [
					Math.min(x1, x2),
					Math.min(y1, y2),
					Math.max(x1, x2),
					Math.max(y1, y2)
				];
			})
		};
	}
	else if (position.paths) {
		return {
			pageIndex: position.pageIndex,
			width: position.width * viewport.scale,
			paths: position.paths.map((path) => {
				let vpath = [];
				for (let i = 0; i < path.length - 1; i += 2) {
					let x = path[i];
					let y = path[i + 1];
					vpath.push(...viewport.convertToViewportPoint(x, y));
				}
				return vpath;
			})
		};
	}
}

function fitRectIntoRect(rect, containingRect) {
	return [
		Math.max(rect[0], containingRect[0]),
		Math.max(rect[1], containingRect[1]),
		Math.min(rect[2], containingRect[2]),
		Math.min(rect[3], containingRect[3])
	];
}

function getPositionBoundingRect(position) {
	if (position.rects) {
		return [
			Math.min(...position.rects.map(x => x[0])),
			Math.min(...position.rects.map(x => x[1])),
			Math.max(...position.rects.map(x => x[2])),
			Math.max(...position.rects.map(x => x[3]))
		];
	}
	else if (position.paths) {
		let x = position.paths[0][0];
		let y = position.paths[0][1];
		let rect = [x, y, x, y];
		for (let path of position.paths) {
			for (let i = 0; i < path.length - 1; i += 2) {
				let x = path[i];
				let y = path[i + 1];
				rect[0] = Math.min(rect[0], x);
				rect[1] = Math.min(rect[1], y);
				rect[2] = Math.max(rect[2], x);
				rect[3] = Math.max(rect[3], y);
			}
		}
		return rect;
	}
}

async function renderImage(pdfDocument, annotation) {
	let { position, color } = annotation;

	let page = await pdfDocument.getPage(position.pageIndex + 1);

	// Create a new position that just contains single rect that is a bounding
	// box of image or ink annotations
	let expandedPosition = { pageIndex: position.pageIndex };
	if (position.rects) {
		// Image annotations have only one rect
		expandedPosition.rects = position.rects;
	}
	// paths
	else {
		let rect = getPositionBoundingRect(position);
		rect = [
			rect[0] - PATH_BOX_PADDING,
			rect[1] - PATH_BOX_PADDING,
			rect[2] + PATH_BOX_PADDING,
			rect[3] + PATH_BOX_PADDING
		];

		if (rect[2] - rect[0] < MIN_PATH_BOX_SIZE) {
			let x = rect[0] + (rect[2] - rect[0]) / 2;
			rect[0] = x - MIN_PATH_BOX_SIZE;
			rect[2] = x + MIN_PATH_BOX_SIZE;
		}

		if (rect[3] - rect[1] < MIN_PATH_BOX_SIZE) {
			let y = rect[1] + (rect[3] - rect[1]) / 2;
			rect[1] = y - MIN_PATH_BOX_SIZE;
			rect[3] = y + MIN_PATH_BOX_SIZE;
		}

		expandedPosition.rects = [fitRectIntoRect(rect, page.view)];
	}

	let rect = expandedPosition.rects[0];
	let maxScale = Math.sqrt(
		MAX_CANVAS_PIXELS
		/ ((rect[2] - rect[0]) * (rect[3] - rect[1]))
	);
	let scale = Math.min(SCALE, maxScale);

	expandedPosition = p2v(expandedPosition, page.getViewport({ scale }));
	rect = expandedPosition.rects[0];

	let viewport = page.getViewport({ scale, offsetX: -rect[0], offsetY: -rect[1] });
	position = p2v(position, viewport);

	let canvasWidth = (rect[2] - rect[0]);
	let canvasHeight = (rect[3] - rect[1]);

	let canvas = document.createElement('canvas');
	
	let ctx = canvas.getContext('2d', { alpha: false });

	if (!canvasWidth || !canvasHeight) {
		return null;
	}

	canvas.width = canvasWidth;
	canvas.height = canvasHeight;
	canvas.style.width = canvasWidth + 'px';
	canvas.style.height = canvasHeight + 'px';

	let renderContext = {
		canvasContext: ctx,
		viewport: viewport
	};

	await page.render(renderContext).promise;

	if (position.paths) {
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineWidth = position.width;
		ctx.beginPath();
		ctx.strokeStyle = color;
		for (let path of position.paths) {
			for (let i = 0; i < path.length - 1; i += 2) {
				let x = path[i];
				let y = path[i + 1];

				if (i === 0) {
					ctx.moveTo(x, y);
				}
				ctx.lineTo(x, y);
			}
		}
		ctx.stroke();
	}

	return canvas;
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
