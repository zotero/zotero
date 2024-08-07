"use strict";

{
	class ZoteroTextLink extends XULTextElement {
		constructor() {
			super();
			this.addEventListener('click', (event) => {
				if (event.button == 0 && !this.noClick) {
					this.open(event);
				}
			}, true);
			this.addEventListener('keypress', (event) => {
				if (event.key == 'Enter' || event.key == ' ') {
					event.preventDefault();
					this.click();
				}
			});
		}

		connectedCallback() {
			this.classList.add('zotero-text-link');
			this.setAttribute('role', 'link');
		}

		get href() {
			return this.getAttribute('href');
		}

		set href(href) {
			this.setAttribute('href', href);
			this.setAttribute('tooltiptext', href);
		}

		get noClick() {
			return this.getAttribute('no-click');
		}

		set noClick(val) {
			this.setAttribute('no-click', !!val);
		}

		open(event) {
			let href = this.href;
			if (!href || this.disabled || event.defaultPrevented) {
				return;
			}

			var uri = null;
			try {
				const nsISSM = Components.interfaces.nsIScriptSecurityManager;
				const secMan =
					Components.classes["@mozilla.org/scriptsecuritymanager;1"]
						.getService(nsISSM);

				const ioService =
					Components.classes["@mozilla.org/network/io-service;1"]
						.getService(Components.interfaces.nsIIOService);

				uri = ioService.newURI(href, null, null);

				var nullPrincipal = secMan.createNullPrincipal({});
				try {
					secMan.checkLoadURIWithPrincipal(nullPrincipal, uri,
						nsISSM.DISALLOW_INHERIT_PRINCIPAL);
				}
				catch (ex) {
					var msg = "Error: Cannot open a " + uri.scheme + ": link using the zotero-text-link CE.";
					Components.utils.reportError(msg);
					return;
				}

				// Open HTTP URLs externally
				if (window.Zotero && ["http", "https"].includes(uri.scheme)) {
					Zotero.launchURL(uri.spec);
					event.preventDefault();
					return;
				}
			}
			catch (ex) {
				Components.utils.reportError(ex);
			}

			// otherwise, fall back to opening the anchor directly
			var win = window;
			if (window instanceof Components.interfaces.nsIDOMChromeWindow) {
				while (win.opener && !win.opener.closed)
					win = win.opener;
			}

			if (uri)
				win.open(uri.spec);
			else
				win.open(href);

			event.preventDefault();
		}
	}

	customElements.define('zotero-text-link', ZoteroTextLink, { extends: 'label' });
}
