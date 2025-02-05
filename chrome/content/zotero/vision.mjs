var { runJXA } = ChromeUtils.importESModule('chrome://zotero/content/jxa.mjs');

/**
 * @typedef { string: string, boundingRect: Rect, chars: RecognizedChar[] | null } RecognizedText
 * @typedef { char: string, rect: Rect } RecognizedChar
 * @typedef { x: number, y: number } Point
 * @typedef { bottomLeft: Point, bottomRight: Point, topLeft: Point, topRight: Point } Rect
 */

/**
 * @param {ArrayBuffer | TypedArray} imageBytes Must be in a format that NSImage can read
 * @returns {Promise<RecognizedText[]>} An array of recognized text segments
 */
export function recognizeTextInImage(imageBytes) {
	return runJXA((imageBytes) => {
		/* global ObjC, nil, $ */
		
		ObjC.import('Cocoa');
		ObjC.import('Vision');
		
		let nsImage = $.NSImage.alloc.initWithData(imageBytes);
		let nsImageRep = nsImage.representations.objectAtIndex(0);
		let imageWidth = nsImageRep.pixelsWide;
		let imageHeight = nsImageRep.pixelsHigh;
		let cgImage = nsImage.CGImageForProposedRectContextHints(nil, $.NSGraphicsContext.current, nil);

		let observations;
		let error = $();

		let requestHandler = $.VNImageRequestHandler.alloc.initWithCGImageOptions(cgImage, $.NSDictionary.alloc.init);
		let request = $.VNRecognizeTextRequest.alloc.initWithCompletionHandler((request) => {
			if (!request.results.isNil()) {
				observations = request.results.js;
			}
		});
		requestHandler.performRequestsError($.NSArray.arrayWithObjects(request), error);

		if (!error.isNil()) {
			throw new Error(error.localizedDescription);
		}

		function toIntegerPoint(point) {
			return {
				x: Math.floor(point.x * imageWidth),
				y: Math.floor((1 - point.y) * imageHeight)
			};
		}

		function toIntegerRect(rect) {
			return {
				bottomLeft: toIntegerPoint(rect.bottomLeft),
				bottomRight: toIntegerPoint(rect.bottomRight),
				topLeft: toIntegerPoint(rect.topLeft),
				topRight: toIntegerPoint(rect.topRight),
			};
		}

		return observations.map((obs) => {
			let text = obs.topCandidates(1).firstObject;
			let string = text.string;
			let boundingRect = toIntegerRect(obs);
			let chars = [];
			for (let i = 0; i < string.length; i++) {
				let range = $.NSMakeRange(i, 1);
				let rect = text.boundingBoxForRangeError(range, $());
				if (rect.isNil()) {
					// There was an error calculating this rect,
					// so we can't return character-level data
					chars = null;
					break;
				}
				chars.push({
					char: string.substringWithRange(range).js,
					rect: toIntegerRect(rect),
				});
			}
			return {
				string: string.js,
				boundingRect,
				chars,
			};
		});
	}, imageBytes);
}
