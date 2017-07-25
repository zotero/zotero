"use strict";

var interval = 1000;
var intervalID;
var stopping = false;
var scrolling = false;
var autoscroll = true;

function start() {
	// If scrolled to the bottom of the page, stay there
	document.body.onscroll = function (event) {
		if (!scrolling) {
			autoscroll = atPageBottom();
		}
		scrolling = false;
	};
	
	updateErrors().then(function () {
		if (stopping) return;
		
		addInitialOutput();
		Zotero.Debug.addConsoleViewerListener(addLine)
		intervalID = setInterval(() => updateErrors(), interval);
	});
}

function stop() {
	stopping = true;
	if (intervalID) {
		clearInterval(intervalID);
		intervalID = null;
	}
	Zotero.Debug.removeConsoleViewerListener()
}

function updateErrors() {
	return Zotero.getSystemInfo()
	.then(function (sysInfo) {
		if (stopping) return;
		
		var errors = Zotero.getErrors(true);
		var errorStr = errors.length ? errors.join('\n\n') + '\n\n' : '';
		
		document.getElementById('errors').textContent = errorStr + sysInfo;
		
		if (autoscroll) {
			scrollToPageBottom();
		}
	});
}

function addInitialOutput() {
	Zotero.Debug.getConsoleViewerOutput().forEach(function (line) {
		addLine(line);
	});
}

function addLine(line) {
	var p = document.createElement('p');
	p.textContent = line;
	var output = document.getElementById('output');
	output.appendChild(p);
	
	if (autoscroll) {
		scrollToPageBottom();
	}
	
	document.getElementById('submit-button').removeAttribute('disabled');
	document.getElementById('clear-button').removeAttribute('disabled');
}

function atPageBottom() {
	return (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100;
}

function scrollToPageBottom() {
	// Set a flag when auto-scrolling to differentiate from manual scrolls
	scrolling = true;
	window.scrollTo(0, document.body.scrollHeight);
}

function submit(button) {
	button.setAttribute('disabled', '');
	clearSubmitStatus();
	
	Components.utils.import("resource://zotero/config.js");
	var url = ZOTERO_CONFIG.REPOSITORY_URL + "report?debug=1";
	var output = document.getElementById('errors').textContent
		+ "\n\n" + "=========================================================\n\n"
		+ Array.from(document.getElementById('output').childNodes).map(p => p.textContent).join("\n\n");
	var pm = document.getElementById('submit-progress');
	pm.removeAttribute('hidden');
	
	Zotero.HTTP.request(
		"POST",
		url,
		{
			compressBody: true,
			body: output,
			logBodyLength: 30,
			timeout: 30000,
			// Update progress meter
			requestObserver: function (req) {
				req.channel.notificationCallbacks = {
					onProgress: function (request, context, progress, progressMax) {
						if (!pm.value || progress > pm.value) {
							pm.value = progress;
						}
						if (!pm.max || progressMax > pm.max) {
							pm.max = progressMax;
						}
					},
					
					// nsIInterfaceRequestor
					getInterface: function (iid) {
						try {
							return this.QueryInterface(iid);
						}
						catch (e) {
							throw Components.results.NS_NOINTERFACE;
						}
					},
					
					QueryInterface: function(iid) {
						if (iid.equals(Components.interfaces.nsISupports) ||
								iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
								iid.equals(Components.interfaces.nsIProgressEventSink)) {
							return this;
						}
						throw Components.results.NS_NOINTERFACE;
					},
	
				}
			}
		}
	)
	.then(function (xmlhttp) {
		var reported = xmlhttp.responseXML.getElementsByTagName('reported');
		if (reported.length != 1) {
			showSubmitError(e);
			return false;
		}
		
		showSubmitResult(reported[0].getAttribute('reportID'));
	})
	.catch(function (e) {
		showSubmitError(e);
		return false;
	})
	.finally(function () {
		pm.setAttribute('hidden', '');
		button.removeAttribute('disabled');
	});
}

function showSubmitResult(id) {
	var elem = document.getElementById('submit-result');
	elem.removeAttribute('hidden');
	document.getElementById('debug-id').textContent = "D" + id;
	var copyID = document.getElementById('submit-result-copy-id');
	copyID.style.visibility = 'visible';
	copyID.setAttribute('data-tooltip', 'Copy ID to Clipboard');
}

function copyIDToClipboard(elem) {
	var id = document.getElementById('debug-id').textContent;
	Components.classes["@mozilla.org/widget/clipboardhelper;1"]
		.getService(Components.interfaces.nsIClipboardHelper)
		.copyString(id);
	elem.setAttribute('data-tooltip', 'Copied');
	setTimeout(() => elem.style.visibility = 'hidden', 750);
}

function showSubmitError(e) {
	var elem = document.getElementById('submit-error');
	elem.removeAttribute('hidden');
	elem.textContent = "Error submitting output";
	Components.utils.reportError(e);
	Zotero.debug(e, 1);
}

function clearSubmitStatus() {
	document.getElementById('submit-result').setAttribute('hidden', '');
	document.getElementById('submit-error').setAttribute('hidden', '');
}

function clearOutput(button) {
	document.getElementById('submit-button').setAttribute('disabled', '');
	button.setAttribute('disabled', '');
	document.getElementById('output').textContent = '';
	clearSubmitStatus();
}

window.addEventListener('load', start);
window.addEventListener("unload", stop);
