Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import('chrome://remote/content/shared/WindowManager.jsm');
Components.utils.import("resource://gre/modules/osfile.jsm");

// eslint-disable-next-line no-unused-vars
class DevHelper {
	constructor(element) {
		Zotero.Server.Endpoints['/dev-helper/update'] = function () { };
		Zotero.Server.Endpoints['/dev-helper/update'].prototype = {
			supportedMethods: ["POST"],
			supportedDataTypes: ["application/json", "text/plain"],
			permitBookmarklet: false,
			
			init: () => {
				this.refresh();
				return 200;
			},
		};

		this.componentPathInput = element.querySelector('#component-path');
		this.loadComponentBtn = element.querySelector('#load-component');
		this.autoResizeCheckbox = element.querySelector('#auto-resize');
		this.frame = document.getElementById('component-iframe');
		this.componentHasBeenSelected = false;

		const handleComponentSelected = () => {
			this.componentHasBeenSelected = true;
			this.refresh();
		};

		this.componentPathInput.addEventListener('select', handleComponentSelected);
		this.loadComponentBtn.addEventListener('click', handleComponentSelected);
		this.frame.contentWindow.document.addEventListener('load', this.resizeWindow.bind(this));
	}

	register() {
		Zotero.DevHelper = this;
	}

	async refresh() {
		if (!this.componentHasBeenSelected) {
			return;
		}
		const wi = this.frame.docShell.QueryInterface(Ci.nsIWebNavigation);
		wi.loadURI(`chrome://zotero/content/${this.componentPathInput.value}`, {
			triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
		});

		if (this.autoResizeCheckbox.checked) {
			setTimeout(this.resizeWindow.bind(this), 200);
		}
	}

	resizeWindow() {
		const componentWindow = Array.from(this.frame.contentWindow.document.childNodes).find(cn => cn.tagName?.toLowerCase() === 'window');
		if (componentWindow) {
			const width = parseInt(componentWindow.getAttribute('width'));
			const height = parseInt(componentWindow.getAttribute('height'));
			if (width && height) {
				window.innerWidth = width;
				window.innerHeight = height + 40;
			}
			else {
				window.innerWidth = 600;
				window.innerHeight = 400;
			}
		}
	}
}
