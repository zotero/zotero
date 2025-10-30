document.addEventListener('DOMContentLoaded', (event) => {
	if (event.currentTarget !== event.target) {
		return;
	}
	
	const { AppConstants } = ChromeUtils.importESModule('resource://gre/modules/AppConstants.sys.mjs');
	
	// Can't depend on Zotero object in hidden window initialization
	let isWin = AppConstants.platform == 'win';
	let isMac = AppConstants.platform == 'macosx';

	let redoKey = document.getElementById('key_redo');
	let macUnixQuitKey = document.getElementById('key_quitApplication');

	let fileQuitSeparator = document.getElementById('menu_fileQuitSeparatorNonMac');
	let fileQuitItemWin = document.getElementById('menu_fileQuitItemWin');
	let fileQuitItemUnix = document.getElementById('menu_fileQuitItemUnix');

	let editPreferencesSeparator = document.getElementById('menu_EditPreferencesSeparator');
	let editPreferencesItem = document.getElementById('menu_EditPreferencesItem');

	let applicationMenu = document.getElementById('mac_application_menu');
	let windowMenu = document.getElementById('windowMenu');
	let macKeyset = document.getElementById('macKeyset');
	
	let genericCommandSet = document.createXULElement('commandset');
	document.documentElement.append(genericCommandSet);
	let genericKeyset = document.createXULElement('keyset');
	document.documentElement.append(genericKeyset);

	if (isWin) {
		// Set behavior on Windows only
		if (redoKey) {
			redoKey.setAttribute('data-l10n-id', 'text-action-redo-shortcut');
			redoKey.setAttribute('modifiers', 'accel');
		}
		if (macUnixQuitKey) macUnixQuitKey.disabled = true;
	}
	else {
		// Set behavior on all non-Windows platforms
		if (redoKey) {
			redoKey.setAttribute('data-l10n-id', 'text-action-undo-shortcut');
			redoKey.setAttribute('modifiers', 'accel,shift');
		}
	}

	if (isMac) {
		// Set behavior on macOS only
		if (fileQuitSeparator) fileQuitSeparator.hidden = true;
		if (fileQuitItemWin) fileQuitItemWin.hidden = true;
		if (fileQuitItemUnix) fileQuitItemUnix.hidden = true;
		if (editPreferencesSeparator) editPreferencesSeparator.hidden = true;
		if (editPreferencesItem) editPreferencesItem.hidden = true;
		
		// Non-main windows: Add Window → Zotero to focus/reopen main window
		if (windowMenu && window.location.href !== AppConstants.BROWSER_CHROME_URL) {
			MozXULElement.insertFTLIfNeeded('branding/brand.ftl');
			MozXULElement.insertFTLIfNeeded('zotero.ftl');
			
			let mainWindowCommand = document.createXULElement('command');
			mainWindowCommand.id = 'cmd_mainWindow';
			document.l10n.setAttributes(mainWindowCommand, 'main-window-command');
			mainWindowCommand.addEventListener('command', () => {
				// Zotero.getMainWindow()
				let win = Services.wm.getMostRecentWindow("navigator:browser");
				if (win) {
					win.focus();
					return;
				}
				
				// Zotero.openMainWindow()
				var chromeURI = AppConstants.BROWSER_CHROME_URL;
				var flags = "chrome,all,dialog=no,resizable=yes";
				Services.ww.openWindow(null, chromeURI, '_blank', flags, null);
			});
			genericCommandSet.append(mainWindowCommand);
			
			let mainWindowKey = document.createXULElement('key');
			mainWindowKey.id = 'key_mainWindow';
			mainWindowKey.setAttribute('command', mainWindowCommand.id);
			mainWindowKey.setAttribute('modifiers', 'accel shift');
			document.l10n.setAttributes(mainWindowKey, 'main-window-key');
			genericKeyset.append(mainWindowKey);

			let mainWindowItem = document.createXULElement('menuitem');
			mainWindowItem.setAttribute('command', mainWindowCommand.id);
			mainWindowItem.setAttribute('key', mainWindowKey.id);
			windowMenu.menupopup.append(mainWindowItem);
		}

		// macOS 15 Sequoia has a new system keyboard shortcut, Ctrl-Return,
		// that shows a context menu on the focused control. Firefox currently
		// doesn't handle it very well - it shows a context menu on the element
		// in the middle of the window, whatever element that may be.
		// Prevent/retarget these events (but not Ctrl-clicks).
		var { getTargetElement, createContextMenuEvent } = ChromeUtils.importESModule("chrome://zotero/content/contextMenuUtils.sys.mjs");
		let lastPreventedContextMenuTime = 0;
		document.addEventListener('contextmenu', (event) => {
			if (!(event.button === 0 && event.buttons === 0 && !event.ctrlKey)) {
				return;
			}
			
			event.stopPropagation();
			event.stopImmediatePropagation();
			event.preventDefault();
			
			let targetElement = getTargetElement(document);
			// targetElement may be null here
			if (targetElement && 'browsingContext' in targetElement) {
				// Browser or iframe: let SequoiaContextMenuChild handle it
				targetElement.browsingContext.currentWindowGlobal.getActor('SequoiaContextMenu')
					.sendAsyncMessage('handleContextMenuEvent');
				return;
			}
			
			// We usually get three of these in a row - only act on the first
			if (event.timeStamp - lastPreventedContextMenuTime < 50) {
				return;
			}
			lastPreventedContextMenuTime = event.timeStamp;
			
			// If nothing is focused, we're done
			if (!targetElement) {
				return;
			}
			
			let contextMenuEvent = createContextMenuEvent(targetElement);
			// Run in the next tick, because otherwise our rate-limiting above
			// prevents this from working on form fields (somehow)
			setTimeout(() => targetElement.dispatchEvent(contextMenuEvent));
		}, { capture: true });
		
		// Make sure the Ctrl-Enter isn't handled by listeners further down in
		// the tree as a regular Enter
		document.documentElement.addEventListener('keydown', (event) => {
			if (event.ctrlKey && event.key === 'Enter') {
				event.stopPropagation();
				event.stopImmediatePropagation();
				event.preventDefault();
			}
		}, { capture: true });
	}
	else {
		// Set behavior on all non-macOS platforms
		if (applicationMenu) applicationMenu.hidden = true;
		if (windowMenu) windowMenu.hidden = true;
		if (macKeyset) {
			macKeyset.setAttribute('disabled', true);
			// Keys display on menu items even when disabled individually, so just remove the relevant attributes
			// Relevant platform code:
			// https://searchfox.org/mozilla-central/rev/3ba3d0a57b6419206f82f80cd6c30faf59397664/toolkit/content/widgets/menu.js#295
			for (let key of macKeyset.querySelectorAll('key')) {
				key.removeAttribute('modifiers');
				key.removeAttribute('keycode');
				key.removeAttribute('key');
			}
		}
		
		if (isWin) {
			if (fileQuitItemUnix) fileQuitItemUnix.hidden = true;
		}
		else {
			if (fileQuitItemWin) fileQuitItemWin.hidden = true;
		}
	}
});
