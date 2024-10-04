window.addEventListener('DOMContentLoaded', () => {
	// Don't need to depend on Zotero object here
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

		// macOS 15 Sequoia has a new system keyboard shortcut, Ctrl-Enter,
		// that shows a context menu on the focused control. Firefox currently
		// doesn't handle it very well - it shows a context menu on the element
		// in the middle of the window, whatever element that may be.
		// Prevent/retarget these events (but not Ctrl-clicks).
		let lastPreventedContextMenuTime = 0;
		document.addEventListener('contextmenu', (event) => {
			if (!(event.button === 2 && event.buttons === 0 && !event.ctrlKey)) {
				return;
			}
			
			event.stopPropagation();
			event.stopImmediatePropagation();
			event.preventDefault();
			
			// We usually get three of these in a row - only act on the first
			if (event.timeStamp - lastPreventedContextMenuTime < 50) {
				return;
			}
			lastPreventedContextMenuTime = event.timeStamp;
			
			let targetElement = document.activeElement;
			if (!targetElement) {
				return;
			}
			if (targetElement.hasAttribute('aria-activedescendant')) {
				let activeDescendant = targetElement.querySelector(
					'#' + CSS.escape(targetElement.getAttribute('aria-activedescendant'))
				);
				if (activeDescendant) {
					targetElement = activeDescendant;
				}
			}
			
			let [clientX, clientY] = Zotero.Utilities.Internal.getContextMenuPosition(targetElement);
			let screenX = window.mozInnerScreenX + clientX;
			let screenY = window.mozInnerScreenY + clientY;
			
			// Run in the next tick, because otherwise our rate-limiting above
			// prevents this from working on form fields (somehow)
			setTimeout(() => {
				targetElement.dispatchEvent(new PointerEvent('contextmenu', {
					bubbles: true,
					cancelable: true,
					button: 2,
					buttons: 2,
					clientX,
					clientY,
					layerX: clientX, // Wrong, but nobody should ever use these
					layerY: clientY,
					screenX,
					screenY,
				}));
			});
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
