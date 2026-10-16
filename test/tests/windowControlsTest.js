/* global describe, it, before, after, beforeEach, afterEach, assert, sinon,
 loadZoteroPane, importPDFAttachment, waitForWindow */

describe("Window controls", function () {
	let win;

	before(async function () {
		win = await loadZoteroPane();
	});

	after(function () {
		win.close();
	});

	it("should enable the commands only on Windows", function () {
		assert.equal(win.document.getElementById('cmd_toggleFullScreen').hasAttribute('disabled'),
			!Zotero.isWin);
		assert.equal(win.document.getElementById('key_toggleFullScreen').hasAttribute('disabled'),
			!Zotero.isWin);
	});

	describe("Windows menu bar", function () {
		let bar, controls, previousPref;
		const waitForHide = () => Zotero.Promise.delay(500);

		before(function () {
			if (!Zotero.isWin) this.skip();
			bar = win.document.getElementById('titlebar');
			controls = win.ZoteroWindowControls;
			previousPref = Zotero.Prefs.get('ui.autoHideMenuBar');
		});

		beforeEach(function () {
			Zotero.Prefs.set('ui.autoHideMenuBar', false);
			bar.dispatchEvent(new win.MouseEvent('mouseleave'));
		});

		afterEach(function () {
			win.fullScreen = false;
			Zotero.Prefs.set('ui.autoHideMenuBar', previousPref);
		});

		it("should show the bar until auto-hide is enabled", async function () {
			await waitForHide();
			assert.isAbove(bar.getBoundingClientRect().height, 4);
			win.document.getElementById('cmd_toggleMenuBarAutoHide').doCommand();
			await waitForHide();
			assert.isTrue(Zotero.Prefs.get('ui.autoHideMenuBar'));
			assert.equal(bar.getBoundingClientRect().height, 4);
		});

		it("should reveal on hover and hide after leaving", async function () {
			Zotero.Prefs.set('ui.autoHideMenuBar', true);
			await waitForHide();
			bar.dispatchEvent(new win.MouseEvent('mouseenter'));
			assert.isAbove(bar.getBoundingClientRect().height, 4);
			bar.dispatchEvent(new win.MouseEvent('mouseleave'));
			await waitForHide();
			assert.equal(bar.getBoundingClientRect().height, 4);
		});

		it("should keep an open menu visible after the pointer leaves", async function () {
			Zotero.Prefs.set('ui.autoHideMenuBar', true);
			let popup = win.document.getElementById('menu_viewPopup');
			try {
				popup.dispatchEvent(new win.Event('popupshowing', { bubbles: true }));
				bar.dispatchEvent(new win.MouseEvent('mouseleave'));
				await waitForHide();
				assert.isAbove(bar.getBoundingClientRect().height, 4);
			}
			finally {
				popup.dispatchEvent(new win.Event('popuphidden', { bubbles: true }));
			}
			await waitForHide();
			assert.equal(bar.getBoundingClientRect().height, 4);
		});

		['Alt', 'F10'].forEach((key) => {
			it(`should reveal the bar for ${key}`, async function () {
				Zotero.Prefs.set('ui.autoHideMenuBar', true);
				await waitForHide();
				win.dispatchEvent(new win.KeyboardEvent('keydown', { key }));
				assert.isAbove(bar.getBoundingClientRect().height, 4);
			});
		});

		it("should toggle native full screen through the command", async function () {
			let command = win.document.getElementById('cmd_toggleFullScreen');
			command.doCommand();
			await Zotero.Promise.delay(100);
			assert.isTrue(win.fullScreen);
			assert.equal(command.getAttribute('checked'), 'true');
			command.doCommand();
			await Zotero.Promise.delay(100);
			assert.isFalse(win.fullScreen);
		});

		it("should not toggle full screen for a repeating shortcut", function () {
			controls.toggleFullScreen();
			controls.toggleFullScreen({ sourceEvent: { repeat: true } });
			assert.isTrue(win.fullScreen);
		});

		it("should handle the F5 shortcut without modifiers", async function () {
			win.focus();
			let keyboard = Cc['@mozilla.org/text-input-processor;1']
				.createInstance(Ci.nsITextInputProcessor);
			assert.isTrue(keyboard.beginInputTransactionForTests(win, null));
			let event = new win.KeyboardEvent('', { key: 'F5', code: 'F5', keyCode: 116 });
			keyboard.keydown(event);
			keyboard.keyup(event);
			await Zotero.Promise.delay(100);
			assert.isTrue(win.fullScreen);
			keyboard.keydown(event);
			keyboard.keyup(event);
			await Zotero.Promise.delay(100);
			assert.isFalse(win.fullScreen);
		});

		it("should use the same preference in a detached reader", async function () {
			let attachment = await importPDFAttachment();
			// A newly opened window can still expose a complete about:blank document.
			// Observe the reader document's load before requesting the window.
			let windowPromise = waitForWindow('chrome://zotero/content/reader.xhtml');
			let reader = await Zotero.Reader.open(attachment.id, null, { openInWindow: true });
			try {
				let readerWindow = await windowPromise;
				let readerBar = readerWindow.document.getElementById('reader-menubar');
				assert.isNotNull(readerBar);
				Zotero.Prefs.set('ui.autoHideMenuBar', true);
				assert.isTrue(readerBar.hasAttribute('autohide'));
				Zotero.Prefs.set('ui.autoHideMenuBar', false);
				assert.isFalse(readerBar.hasAttribute('autohide'));
				assert.isFalse(bar.hasAttribute('autohide'));
			}
			finally {
				reader.close();
				await attachment.eraseTx();
			}
		});

		it("should unregister its preference observer when the window closes", async function () {
			let other = await loadZoteroPane();
			let otherControls = other.ZoteroWindowControls;
			let unregister = sinon.spy(Zotero.Prefs, 'unregisterObserver');
			let observer = otherControls._prefObserver;
			try {
				other.close();
				await Zotero.Promise.delay(100);
				assert.isTrue(unregister.calledWith(observer));
			}
			finally {
				unregister.restore();
				if (!other.closed) other.close();
			}
		});
	});
});
