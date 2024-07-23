"use strict";

describe("Reader", function () {
	var win, zp;

	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
	});

	after(function () {
		win.close();
	});

	describe('PDF Reader', function () {
		it('should create/update annotations', async function () {
			var attachment = await importFileAttachment('test.pdf');

			var reader = await Zotero.Reader.open(attachment.itemID);
			await reader._initPromise;
			reader._internalReader._annotationManager._skipAnnotationSavingDebounce = true;

			// Add highlight annotation
			let highlightAnnotation = reader._internalReader._annotationManager.addAnnotation(
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
			await waitForItemEvent("add");
			// Add underline annotation
			let underlineAnnotation = await reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'underline',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					position: {
						pageIndex: 0,
						rects: [[0, 0, 100, 100]]
					},
					text: 'test'
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");
			// Add note annotation
			let noteAnnotation = await reader._internalReader._annotationManager.addAnnotation(
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
			await waitForItemEvent("add");
			// Add text annotation
			let textAnnotation = await reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'text',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					comment: 'test',
					position: {
						pageIndex: 0,
						rects: [[17.70514027630181, 729.1404633368757, 132.24914027630183, 762.1404633368757]],
						fontSize: 14,
						rotation: 10
					},
					text: 'test'
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");
			// Add image annotation
			let imageAnnotation = await reader._internalReader._annotationManager.addAnnotation(
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
			await waitForItemEvent("add");
			// Add ink annotation
			let inkAnnotation = await reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'ink',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					position: {
						pageIndex: 0,
						paths: [[517.759, 760.229]],
						width: 2
					},
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");

			// Modify highlight annotation
			reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: highlightAnnotation.id,
						text: 'test2'
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify underline annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: underlineAnnotation.id,
						text: 'test2'
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify note annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: noteAnnotation.id,
						color: '#aabbcc'
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify text annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: textAnnotation.id,
						sortIndex: '00000|001491|00283',
						position: {
							pageIndex: 0,
							rects: [[17.70514027630181, 729.1404633368757, 132.24914027630183, 762.1404633368757]],
							fontSize: 16,
							rotation: 10
						},
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify image annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: imageAnnotation.id,
						sortIndex: '00000|001491|00283',
						position: {
							pageIndex: 0,
							rects: [[0, 0, 200, 200]]
						}
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify ink annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: inkAnnotation.id,
						sortIndex: '00000|001491|00283',
						position: {
							pageIndex: 0,
							paths: [[617.759, 560.229]],
							width: 2,
							unknownField: 'test'
						},
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");

			var annotations = attachment.getAnnotations();
			assert.equal(annotations.length, 6);

			assert.equal(annotations.find(x => x.key === highlightAnnotation.id).annotationText, 'test2');
			assert.equal(annotations.find(x => x.key === underlineAnnotation.id).annotationText, 'test2');
			assert.equal(annotations.find(x => x.key === noteAnnotation.id).annotationColor, '#aabbcc');
			assert.equal(JSON.parse(annotations.find(x => x.key === textAnnotation.id).annotationPosition).fontSize, 16);
			assert.equal(JSON.parse(annotations.find(x => x.key === imageAnnotation.id).annotationPosition).rects[0][2], 200);
			assert.equal(JSON.parse(annotations.find(x => x.key === inkAnnotation.id).annotationPosition).pageIndex, 0);
			assert.equal(JSON.parse(annotations.find(x => x.key === inkAnnotation.id).annotationPosition).unknownField, 'test');
			reader.close();
		});
	});
});
