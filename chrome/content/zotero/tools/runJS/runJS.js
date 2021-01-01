/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2021 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org

    This file is part of Zotero.

    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.

    ***** END LICENSE BLOCK *****
*/

Components.utils.import("resource://gre/modules/osfile.jsm");

let fileName = null;
let saveButton;
let loadingContent = false;

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

async function load() {
	var io = {};
	window.openDialog("chrome://zotero/content/tools/runJS/loadJS.xul", "_blank", "chrome,modal,centerscreen", io);
	if (io.dataOut) {
		document.getElementById('run-as-async').checked = false;
		update();
		fileName = io.dataOut;
		let contents = await Zotero.File.getContentsAsync(
			OS.Path.join(Zotero.getScriptsDirectory().path, fileName)
		);
		codeEditor.getSession().setValue(contents);
		loadingContent = true;
		updateSaved(true);
	}
}

async function save() {
	if (fileName !== null) {
		await Zotero.File.putContentsAsync(
			OS.Path.join(Zotero.getScriptsDirectory().path, fileName),
			codeEditor.getSession().getValue()
		);
		updateSaved(true);
	}
}

async function saveAs() {
	var io = {};
	window.openDialog("chrome://zotero/content/tools/runJS/saveJS.xul", "_blank", "chrome,modal,centerscreen", io);
	if (io.dataOut) {
		fileName = io.dataOut;
		await Zotero.File.putContentsAsync(
			OS.Path.join(Zotero.getScriptsDirectory().path, fileName),
			codeEditor.getSession().getValue()
		);
		updateSaved(true);
	}
}

// eslint-disable-next-line no-unused-vars
function openHelp() {
	Zotero.launchURL("https://www.zotero.org/support/dev/client_coding/javascript_api");
}

function updateSaved(saved) {
	if (fileName !== null && !saved) {
		saveButton.className = '';
	}
	else {
		saveButton.className = 'disabled';
	}

	document.title = 'Run JavaScript - ' + (fileName || 'Untitled') + (saved ? '' : '*');
}

function handleInput() { // eslint-disable-line no-unused-vars
	if (!loadingContent) {
		updateSaved(false);
	}
	else {
		loadingContent = false;
	}

	var checkbox = document.getElementById('run-as-async');
	var isAsync = checkbox.checked;
	if (isAsync) {
		return;
	}
	var code = codeEditor.getSession().getValue();
	// If `await` is used, switch to async mode
	if (/(^|[^=([]\s*)await\s/m.test(code)) {
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
	
	if (event.altKey) {
		return;
	}
	
	if (!event.shiftKey && event.key == 'r') {
		run();
		event.stopPropagation();
	}
	else if (!event.shiftKey && event.key == 'o') {
		load();
		event.stopPropagation();
	}
	else if (!event.shiftKey && event.key == 's') {
		save();
		event.stopPropagation();
	}
	else if (event.shiftKey && event.key == 's') {
		saveAs();
		event.stopPropagation();
	}
	else if (!event.shiftKey && event.key == 'w') {
		window.close();
	}
});

var shortcut = Zotero.isMac ? 'Cmd-R' : 'Ctrl+R';
document.getElementById('run').title = `Run (${shortcut})`;

update();

var codeEditor;
window.addEventListener("load", function (e) {
	if (e.target !== document) {
		return;
	}
	
	saveButton = document.getElementById('save');

	var codeWin = document.getElementById("editor-code").contentWindow;
	codeEditor = codeWin.editor;
	var session = codeEditor.getSession();
	session.setMode(new codeWin.JavaScriptMode);
	codeEditor.setOptions({
		// TODO: Enable if we modify to autocomplete from the Zotero API
		//enableLiveAutocompletion: true,
		highlightActiveLine: false,
		showGutter: false,
		theme: "ace/theme/chrome",
	});
	codeEditor.on('input', handleInput);
	codeEditor.focus();
}, false);
