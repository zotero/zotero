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
