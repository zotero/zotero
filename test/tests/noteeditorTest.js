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

	async function openEditor(options = {}) {
		let item = new Zotero.Item('note');
		item.setNote('<p>Test note</p>');
		await item.saveTx();

		let editorInstance = await Zotero.Notes.open(item.id, null, options);
		await editorInstance._initPromise;
		return editorInstance;
	}

	async function focusEditor(editorInstance, chromeWindow) {
		let iframeWindow = editorInstance._iframeWindow;
		editorInstance.focus();
		await waitForCallback(
			() => chromeWindow.document.commandDispatcher.focusedWindow == iframeWindow
				&& iframeWindow.document.activeElement?.isContentEditable,
			50, 10
		);
	}

	function isCommandEnabled(chromeWindow, command) {
		chromeWindow.goUpdateCommand(command);
		return chromeWindow.document.getElementById(command).getAttribute('disabled') != 'true';
	}

	function insertTextWithNativeUndo(input, text) {
		input.focus();
		let textInputProcessor = Components.classes['@mozilla.org/text-input-processor;1']
			.createInstance(Components.interfaces.nsITextInputProcessor);
		assert.isTrue(textInputProcessor.beginInputTransactionForTests(win));
		assert.isTrue(textInputProcessor.commitCompositionWith(text));
	}

	describe("Edit menu", function () {
		afterEach(function () {
			win.Zotero_Tabs.closeAll();
		});

		it("should dispatch history commands to a focused note editor", async function () {
			let editorInstance = await openEditor();
			let iframeWindow = editorInstance._iframeWindow;
			let editorWindow = iframeWindow.wrappedJSObject;

			await focusEditor(editorInstance, win);
			assert.isFalse(isCommandEnabled(win, 'cmd_undo'));

			editorInstance._postMessage({ action: 'insertHTML', pos: null, html: '<p>redo me</p>' });
			await waitForCallback(() => editorWindow.canUndo(), 50, 10);
			assert.isTrue(isCommandEnabled(win, 'cmd_undo'));

			win.goDoCommand('cmd_undo');
			await waitForCallback(() => editorWindow.canRedo(), 50, 10);
			assert.isFalse(editorWindow.canUndo());
			assert.isTrue(isCommandEnabled(win, 'cmd_redo'));

			win.goDoCommand('cmd_redo');
			await waitForCallback(() => editorWindow.canUndo(), 50, 10);
			assert.isFalse(editorWindow.canRedo());

			let noteBeforeCrash = editorWindow.getDataSync(false).html;
			editorInstance._postMessage({ action: 'crash' });
			await waitForCallback(() => !editorWindow.canUndo(), 50, 10);
			assert.isFalse(isCommandEnabled(win, 'cmd_undo'));
			assert.isFalse(editorWindow.doUndo());
			assert.equal(editorWindow.getDataSync(false).html, noteBeforeCrash);
		});

		it("should dispatch history commands in a separate note window", async function () {
			let editorInstance = await openEditor({ openInWindow: true });
			let iframeWindow = editorInstance._iframeWindow;
			let noteWin = iframeWindow.browsingContext.topChromeWindow;
			let editorWindow = iframeWindow.wrappedJSObject;

			try {
				await focusEditor(editorInstance, noteWin);
				editorInstance._postMessage({ action: 'insertHTML', pos: null, html: '<p>redo me</p>' });
				await waitForCallback(() => editorWindow.canUndo(), 50, 10);
				assert.isTrue(isCommandEnabled(noteWin, 'cmd_undo'));

				noteWin.goDoCommand('cmd_undo');
				await waitForCallback(() => editorWindow.canRedo(), 50, 10);
				assert.isTrue(isCommandEnabled(noteWin, 'cmd_redo'));

				noteWin.goDoCommand('cmd_redo');
				await waitForCallback(() => editorWindow.canUndo(), 50, 10);
				assert.isFalse(editorWindow.canRedo());
			}
			finally {
				noteWin.close();
			}
		});

		it("should preserve native history in a focused Find input", async function () {
			let editorInstance = await openEditor();
			let iframeWindow = editorInstance._iframeWindow;
			let editorWindow = iframeWindow.wrappedJSObject;

			editorInstance._postMessage({ action: 'insertHTML', pos: null, html: '<p>note edit</p>' });
			await waitForCallback(() => editorWindow.canUndo(), 50, 10);
			let noteBeforeUndo = editorWindow.getDataSync(false).html;

			editorInstance._postMessage({ action: 'openFindBar' });
			let input = await waitForCallback(
				() => iframeWindow.document.querySelector('.findbar > input[type="text"]'),
				50, 20
			);
			input.focus();
			await waitForCallback(
				() => win.document.commandDispatcher.focusedWindow == iframeWindow
					&& iframeWindow.document.activeElement == input,
				50, 10
			);

			assert.isFalse(isCommandEnabled(win, 'cmd_undo'));
			insertTextWithNativeUndo(input, 'typed');
			assert.equal(input.value, 'typed');
			assert.isTrue(isCommandEnabled(win, 'cmd_undo'));

			win.goDoCommand('cmd_undo');
			await waitForCallback(() => input.value == '', 50, 10);
			assert.isTrue(isCommandEnabled(win, 'cmd_redo'));

			win.goDoCommand('cmd_redo');
			await waitForCallback(() => input.value == 'typed', 50, 10);
			assert.isTrue(editorWindow.canUndo());
			assert.equal(editorWindow.getDataSync(false).html, noteBeforeUndo);
		});

		it("should replace its controller during reinitialization", async function () {
			let editorInstance = await openEditor();
			let controllers = editorInstance._iframeWindow.controllers;
			let controllerCount = controllers.getControllerCount();
			let oldControllerID = controllers.getControllerId(
				editorInstance._undoRedoController
			);

			await editorInstance.reinit();
			await editorInstance._initPromise;

			assert.equal(controllers.getControllerCount(), controllerCount);
			let controllerIDs = [];
			for (let i = 0; i < controllerCount; i++) {
				controllerIDs.push(controllers.getControllerId(controllers.getControllerAt(i)));
			}
			assert.notInclude(controllerIDs, oldControllerID);
			assert.equal(
				controllers.getControllerId(controllers.getControllerAt(0)),
				controllers.getControllerId(editorInstance._undoRedoController)
			);
		});
	});
});
