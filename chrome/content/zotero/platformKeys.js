window.addEventListener('DOMContentLoaded', () => {
	// Don't need to depend on Zotero object here
	let isWin = AppConstants.platform == 'win';
	let isMac = AppConstants.platform == 'macosx';

	let redoKey = document.getElementById('key_redo');

	let fileQuitSeparator = document.getElementById('menu_NonMacFileQuitSeparator');
	let fileQuitItem = document.getElementById('menu_NonMacFileQuitItem');

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
		if (fileQuitItem) fileQuitItem.hidden = true;
		if (editPreferencesSeparator) editPreferencesSeparator.hidden = true;
		if (editPreferencesItem) editPreferencesItem.hidden = true;
	}
	else {
		// Set behavior on all non-macOS platforms
		if (applicationMenu) applicationMenu.hidden = true;
		if (windowMenu) windowMenu.hidden = true;
		if (macKeyset) macKeyset.disabled = true;
	}
});
