function update() {
	var isAsync = document.getElementById('run-as-async').checked;
	var resultLabel = document.getElementById('result-label');
	var val = isAsync ? 'Return value' : 'Result';
	resultLabel.textContent = val + ':';
}

async function run() {
	var win = Zotero.getMainWindow();
	if (!win) {
		return;
	}
	var code = document.getElementById('code').value;
	var isAsync = document.getElementById('run-as-async').checked;
	var result;
	var resultTextbox = document.getElementById('result');
	try {
		if (isAsync) {
			code = '(async function () {' + code + '})()';
			result = await win.eval(code);
		}
		else {
			result = win.eval(code);
		}
	}
	catch (e) {
		resultTextbox.classList.add('error');
		resultTextbox.value = e;
		return;
	}
	resultTextbox.classList.remove('error');
	resultTextbox.value = Zotero.Utilities.varDump(result);
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

update();
