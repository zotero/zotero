function run() {
	var win = Zotero.getMainWindow();
	if (!win) {
		return;
	}
	var code = document.getElementById('code').value;
	var result = win.eval(code);
	document.getElementById('result').value = Zotero.Utilities.varDump(result);
}

window.addEventListener('keypress', function (event) {
	if (Zotero.isMac) {
		if (!event.metaKey) {
			return;
		}
	}
	else if (!event.ctrlKey) {
		return;
	}
	
	if (event.shiftKey || event.altKey) {
		return;
	}
	
	if (event.key == 'r') {
		run();
		event.stopPropagation();
	}
});

var shortcut = Zotero.isMac ? 'Cmd-R' : 'Ctrl+R';
document.getElementById('run-label').textContent = `(${shortcut})`;
