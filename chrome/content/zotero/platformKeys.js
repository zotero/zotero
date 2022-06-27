window.addEventListener('DOMContentLoaded', () => {
	let redoKey = document.getElementById('key_redo');
	if (redoKey) {
		// Don't need to depend on Zotero object here
		if (AppConstants.platform == 'win') {
			redoKey.setAttribute('data-l10n-id', 'text-action-redo-shortcut');
			redoKey.setAttribute('modifiers', 'accel');
		}
		else {
			redoKey.setAttribute('data-l10n-id', 'text-action-undo-shortcut');
			redoKey.setAttribute('modifiers', 'accel,shift');
		}
	}
});
