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
	var code = document.getElementById('code').value;
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
});

var shortcut = Zotero.isMac ? 'Cmd-R' : 'Ctrl+R';
document.getElementById('run-label').textContent = `(${shortcut})`;

update();
