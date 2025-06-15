// DeepTutor Google Authentication Dialog Script

var authParams = null;
var isAuthComplete = false;

function onLoad() {
	// Get parameters passed to the dialog
	authParams = window.arguments[0];

	if (!authParams || !authParams.url) {
		closeWithError('No authentication URL provided');
		return;
	}

	console.log('DeepTutor Google Auth: Loading URL:', authParams.url);

	// Hide the browser element and show manual input immediately
	var browser = document.getElementById('auth-browser');
	if (browser) {
		browser.style.display = 'none';
	}

	// Show manual input container
	showManualCodeInput();

	// Always show the URL to the user for manual copying
	showURLForManualOpening(authParams.url);

	// Also try to open the URL in the user's default browser
	try {
		if (typeof Zotero !== 'undefined' && Zotero.launchURL) {
			Zotero.launchURL(authParams.url);
			console.log('DeepTutor Google Auth: Attempted to open URL in external browser via Zotero.launchURL');
		} else {
			// Fallback: try to use Services to open URL
			try {
				if (typeof Services !== 'undefined' && Services.wm) {
					var win = Services.wm.getMostRecentWindow("navigator:browser");
					if (win) {
						win.gBrowser.selectedTab = win.gBrowser.addTab(authParams.url);
						win.focus();
						console.log('DeepTutor Google Auth: Attempted to open URL in Firefox tab via Services');
					}
				}
			} catch (servicesError) {
				console.warn('DeepTutor Google Auth: Could not open URL via Services:', servicesError);
			}
		}
	} catch (error) {
		console.error('DeepTutor Google Auth: Error opening URL:', error);
	}
}

function showURLForManualOpening(url) {
	// Use the predefined URL display section in the XUL
	var urlSection = document.getElementById('url-display-section');
	var urlTextbox = document.getElementById('oauth-url-textbox');

	if (urlSection && urlTextbox) {
		// Set the URL in the textbox
		urlTextbox.setAttribute('value', url);
		urlTextbox.value = url;

		// Show the URL section
		urlSection.style.display = 'block';

		console.log('DeepTutor Google Auth: URL display shown with URL:', url);
	} else {
		console.error('DeepTutor Google Auth: Could not find URL display elements');
		// Fallback: show URL in alert
		alert('Please open this URL in your browser:\n\n' + url);
	}
}

function showManualCodeInput() {
	var vbox = document.getElementById('manual-input-container');
	var inputElement = document.getElementById('manual-code-input');

	if (vbox) {
		vbox.style.display = 'block';
		console.log('DeepTutor Google Auth: Manual input container shown');
	}

	if (inputElement) {
		// Ensure the input is visible and editable
		inputElement.style.display = 'block';
		inputElement.style.visibility = 'visible';
		inputElement.style.opacity = '1';
		inputElement.disabled = false;
		inputElement.readOnly = false;

		// Try to focus the input after a short delay
		setTimeout(function() {
			try {
				inputElement.focus();
				console.log('DeepTutor Google Auth: Input element focused');
			} catch (e) {
				console.warn('DeepTutor Google Auth: Could not focus input:', e);
			}
		}, 100);

		console.log('DeepTutor Google Auth: Manual code input element found and made visible/editable');
	} else {
		console.error('DeepTutor Google Auth: Could not find manual-code-input element');
	}
}

function submitManualCode() {
	var inputElement = document.getElementById('manual-code-input');
	var code = inputElement.value.trim();

	if (!code) {
		alert('Please enter the authorization code');
		return;
	}

	completeAuth(code);
}

function completeAuth(authCode) {
	if (isAuthComplete) return;
	isAuthComplete = true;

	console.log('DeepTutor Google Auth: Completing authentication with code');

	if (authParams && authParams.onAuthComplete) {
		try {
			authParams.onAuthComplete(authCode);
		} catch (error) {
			console.error('DeepTutor Google Auth: Error in auth completion callback:', error);
		}
	}

	window.close();
}

function closeWithError(errorMessage) {
	console.error('DeepTutor Google Auth:', errorMessage);

	if (authParams && authParams.onAuthError) {
		try {
			authParams.onAuthError(errorMessage);
		} catch (error) {
			console.error('DeepTutor Google Auth: Error in error callback:', error);
		}
	}

	window.close();
}

function onCancel() {
	if (!isAuthComplete) {
		closeWithError('Authentication cancelled by user');
	}
	return true;
}

// Export functions to window for XUL access
window.onCancel = onCancel;
window.submitManualCode = submitManualCode;
window.copyOAuthURL = copyOAuthURL;

// Initialize when the dialog loads
window.addEventListener('load', onLoad);

// Add copy function for the copy button
function copyOAuthURL() {
	var urlTextbox = document.getElementById('oauth-url-textbox');
	var copyButton = document.getElementById('copy-url-button');

	if (urlTextbox) {
		try {
			var url = urlTextbox.value || urlTextbox.getAttribute('value') || '';

			// Try to use the Clipboard API if available (newer browsers)
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(url).then(function() {
					if (copyButton) {
						copyButton.setAttribute('label', 'Copied!');
						setTimeout(function() {
							copyButton.setAttribute('label', 'Copy URL');
						}, 2000);
					}
				}).catch(function(err) {
					console.error('Clipboard API failed:', err);
					fallbackCopy(url, copyButton);
				});
			} else {
				// Fallback for older browsers or when Clipboard API is not available
				fallbackCopy(url, copyButton);
			}
		} catch (e) {
			console.error('Copy failed:', e);
			alert('Please copy this URL manually:\n\n' + url);
		}
	}
}

function fallbackCopy(text, copyButton) {
	try {
		// Create a temporary textarea element to copy from
		var tempElement = document.createElement('textarea');
		tempElement.value = text;
		document.body.appendChild(tempElement);
		tempElement.select();
		tempElement.setSelectionRange(0, 99999); // For mobile devices

		var successful = document.execCommand('copy');
		document.body.removeChild(tempElement);

		if (successful && copyButton) {
			copyButton.setAttribute('label', 'Copied!');
			setTimeout(function() {
				copyButton.setAttribute('label', 'Copy URL');
			}, 2000);
		} else {
			alert('Please copy this URL manually:\n\n' + text);
		}
	} catch (err) {
		console.error('Fallback copy failed:', err);
		alert('Please copy this URL manually:\n\n' + text);
	}
}
