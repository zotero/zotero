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
	var code = codeEditor.getSession().getValue();
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
		resultTextbox.textContent = e;
		return;
	}
	resultTextbox.classList.remove('error');
	resultTextbox.textContent = typeof result == 'string' ? result : Zotero.Utilities.varDump(result);
}

function openHelp() {
	Zotero.launchURL("https://www.zotero.org/support/dev/client_coding/javascript_api");
}

function handleInput() { // eslint-disable-line no-unused-vars
	var checkbox = document.getElementById('run-as-async');
	var isAsync = checkbox.checked;
	if (isAsync) {
		return;
	}
	var code = codeEditor.getSession().getValue();
	// If `await` is used, switch to async mode
	if (/[^=([]\s*await\s/m.test(code)) {
		checkbox.checked = true;
		update();
	}
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
	else if (event.key == 'w') {
		window.close();
	}
});

var shortcut = Zotero.isMac ? 'Cmd-R' : 'Ctrl+R';
document.getElementById('run-label').textContent = `(${shortcut})`;

update();

var codeWin, codeEditor;
window.addEventListener("load", function (e) {
	if (e.target !== document) {
		return;
	}

	codeWin = document.getElementById("editor-code").contentWindow;
	codeEditor = codeWin.editor;
	codeEditor.getSession().setMode(new codeWin.JavaScriptMode);
	codeEditor.getSession().setUseSoftTabs(false);
	codeEditor.on('input', handleInput);
}, false);
