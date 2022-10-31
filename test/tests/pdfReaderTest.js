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
		it('should create/update annotations', async function () {
			var attachment = await importFileAttachment('test.pdf');

			// Existing highlight annotation
			await Zotero.Annotations.saveFromJSON(attachment, {
				key: 'AAAAAAAA',
				type: 'highlight',
				color: '#ffd400',
				sortIndex: '00000|003305|00000',
				position: {
					pageIndex: 0,
					rects: [[0, 0, 100, 100]]
				}
			});

			// Existing note annotation
			await Zotero.Annotations.saveFromJSON(attachment, {
				key: 'BBBBBBBB',
				type: 'note',
				color: '#ffd400',
				sortIndex: '00000|003305|00000',
				position: {
					pageIndex: 0,
					rects: [[0, 0, 100, 100]]
				}
			});

			// Existing image annotation
			await Zotero.Annotations.saveFromJSON(attachment, {
				key: 'CCCCCCCC',
				type: 'image',
				color: '#ffd400',
				sortIndex: '00000|003305|00000',
				comment: 'asdf',
				position: {
					pageIndex: 0,
					rects: [[0, 0, 100, 100]]
				}
			});

			// Existing ink annotation
			await Zotero.Annotations.saveFromJSON(attachment, {
				key: 'DDDDDDDD',
				type: 'ink',
				color: '#ffd400',
				sortIndex: '00000|003305|00000',
				position: {
					pageIndex: 0,
					paths: [[517.759, 760.229]],
					width: 2,
					unknownField: 'test'
				},
			});

			var reader = await Zotero.Reader.open(attachment.itemID);
			// TODO: Implement a promise that would be resolved when pdf-reader is completely loaded
			var n = 0;
			while ((!reader._iframeWindow || !reader._iframeWindow.wrappedJSObject.PDFViewerApplication.pdfDocument) && n++ < 150) {
				await Zotero.Promise.delay(100);
			}
			await reader._iframeWindow.wrappedJSObject.viewerInstance._viewer._pdfjsPromise;

			// Create highlight annotation
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

			// Create note annotation
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

			// Create image annotation
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

			// Update 4 items
			await reader._iframeWindow.wrappedJSObject.viewerInstance._viewer._annotationsStore.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: 'AAAAAAAA',
						text: 'test'
					},
					{
						id: 'BBBBBBBB',
						color: '#aabbcc'
					},
					{
						id: 'CCCCCCCC',
						comment: 'test'
					},
					{
						id: 'DDDDDDDD',
						position: { pageIndex: 2 }
					},
				], reader._iframeWindow)
			);

			// TODO: Try to avoid pdf-reader annotation saving debounce which is now 1000ms
			await Zotero.Promise.delay(1500);
			var annotations = attachment.getAnnotations();

			// 4 existing + 3 created
			assert.equal(annotations.length, 7);

			// Test 4 updated annotations
			assert.equal(annotations.find(x => x.key === 'AAAAAAAA').annotationText, 'test');
			assert.equal(annotations.find(x => x.key === 'BBBBBBBB').annotationColor, '#aabbcc');
			assert.equal(annotations.find(x => x.key === 'CCCCCCCC').annotationComment, 'test');
			// Test updated position pageIndex, and make sure unknownField is preserved
			assert.equal(JSON.parse(annotations.find(x => x.key === 'DDDDDDDD').annotationPosition).pageIndex, 2);
			assert.equal(JSON.parse(annotations.find(x => x.key === 'DDDDDDDD').annotationPosition).unknownField, 'test');
			reader.close();
		});
	});
});
