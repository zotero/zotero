"use strict";

describe("PDF Reader", function () {
	var win, zp;

	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
	});

	after(function () {
		win.close();
	});

	describe('Reader', function () {
		it('should create annotations', async function () {
			var attachment = await importFileAttachment('test.pdf');
			var reader = await Zotero.Reader.open(attachment.itemID);
			// TODO: Implement a promise that would be resolved when pdf-reader is completely loaded
			var n = 0;
			while (!reader._iframeWindow.wrappedJSObject.PDFViewerApplication.pdfDocument && n++ < 50) {
				await Zotero.Promise.delay(100);
			}
			await reader._iframeWindow.wrappedJSObject.viewerInstance._viewer._pdfjsPromise;
			await reader._iframeWindow.wrappedJSObject.viewerInstance._viewer._annotationsStore.addAnnotation(
				Components.utils.cloneInto({
					type: 'highlight',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					position: {
						pageIndex: 0,
						rects: [[0, 0, 100, 100]]
					},
					text: 'test'
				}, reader._iframeWindow)
			);
			await reader._iframeWindow.wrappedJSObject.viewerInstance._viewer._annotationsStore.addAnnotation(
				Components.utils.cloneInto({
					type: 'note',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					comment: 'test',
					position: {
						pageIndex: 0,
						rects: [[0, 0, 100, 100]]
					},
					text: 'test'
				}, reader._iframeWindow)
			);
			await reader._iframeWindow.wrappedJSObject.viewerInstance._viewer._annotationsStore.addAnnotation(
				Components.utils.cloneInto({
					type: 'image',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					comment: 'test',
					position: {
						pageIndex: 0,
						rects: [[0, 0, 100, 100]]
					}
				}, reader._iframeWindow)
			);
			// TODO: Try to avoid pdf-reader annotation saving debounce which is now 1000ms
			await Zotero.Promise.delay(1500);
			var annotations = attachment.getAnnotations();
			assert.equal(annotations.length, 3);
		});

		// TODO: Add annotation update and deletion tests
	});
});
