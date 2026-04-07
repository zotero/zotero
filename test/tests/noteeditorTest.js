"use strict";

describe("Note Editor", function () {
	var win, zp;
	
	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	var waitForNoteEditor = async function (item) {
		var noteEditor = win.document.getElementById('zotero-note-editor');
		while (noteEditor.item != item) {
			Zotero.debug("Waiting for note editor");
			await Zotero.Promise.delay(50);
			noteEditor = win.document.getElementById('zotero-note-editor');
		}
		return new Zotero.Promise((resolve, reject) => {
			noteEditor.onInit(() => resolve(noteEditor));
		});
	};

	describe("Edit menu", function () {
		afterEach(function () {
			win.Zotero_Tabs.closeAll();
		});

		it("should enable Redo when focused note editor has a redoable change", async function () {
			let item = new Zotero.Item('note');
			item.setNote('<p>Test note</p>');
			await item.saveTx();

			let editorInstance = await Zotero.Notes.open(item.id);
			await editorInstance._initPromise;
			let iframeWindow = editorInstance._iframeWindow;
			// Undo/redo API that the editor exposes on its content window
			let editorWindow = iframeWindow.wrappedJSObject;

			editorInstance.focus();
			await waitForCallback(
				() => win.document.commandDispatcher.focusedWindow == iframeWindow,
				50, 10
			);

			assert.isFalse(editorWindow.canUndo());
			assert.isFalse(editorWindow.canRedo());

			// Make an edit, then undo it, leaving a redoable change on the
			// editor's internal (ProseMirror) history stack
			editorInstance._postMessage({ action: 'insertHTML', pos: null, html: '<p>redo me</p>' });
			await waitForCallback(() => editorWindow.canUndo(), 50, 10);
			editorWindow.doUndo();
			assert.isTrue(editorWindow.canRedo());

			// Simulate opening the Edit menu
			win.document.getElementById('menu_EditPopup')
				.dispatchEvent(new win.Event('popupshowing'));

			let redoCmd = win.document.getElementById('cmd_redo');
			assert.notEqual(redoCmd.getAttribute('disabled'), 'true', "Redo should be enabled");
		});

		it("should enable Redo when note editor in a separate window has a redoable change", async function () {
			let item = new Zotero.Item('note');
			item.setNote('<p>Test note</p>');
			await item.saveTx();

			let editorInstance = await Zotero.Notes.open(item.id, null, { openInWindow: true });
			await editorInstance._initPromise;
			let iframeWindow = editorInstance._iframeWindow;
			let noteWin = iframeWindow.browsingContext.topChromeWindow;
			// Undo/redo API that the editor exposes on its content window
			let editorWindow = iframeWindow.wrappedJSObject;

			try {
				editorInstance.focus();
				await waitForCallback(
					() => noteWin.document.commandDispatcher.focusedWindow == iframeWindow,
					50, 10
				);

				assert.isFalse(editorWindow.canUndo());
				assert.isFalse(editorWindow.canRedo());

				// Make an edit, then undo it, leaving a redoable change on the
				// editor's internal (ProseMirror) history stack
				editorInstance._postMessage({ action: 'insertHTML', pos: null, html: '<p>redo me</p>' });
				await waitForCallback(() => editorWindow.canUndo(), 50, 10);
				editorWindow.doUndo();
				assert.isTrue(editorWindow.canRedo());

				// Simulate opening the Edit menu
				noteWin.document.getElementById('menu_EditPopup')
					.dispatchEvent(new noteWin.Event('popupshowing'));

				let redoCmd = noteWin.document.getElementById('cmd_redo');
				assert.notEqual(redoCmd.getAttribute('disabled'), 'true', "Redo should be enabled");
			}
			finally {
				noteWin.close();
			}
		});
	});
});
