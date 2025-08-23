/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
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

/**
 * Add utility functions to XULElement or a subclass.
 * @param {{ new(): XULElement }} Class
 */
function XULElementMixin(Class) {
	return class extends Class {
		initialized = false;

		/**
		 * @return {DocumentFragment | null}
		 */
		get content() {
			return null;
		}

		init() {}

		destroy() {}

		connectedCallback() {
			if (typeof super.connectedCallback === 'function') {
				super.connectedCallback();
			}
			
			let content = this.content;
			if (content) {
				content = document.importNode(content, true);
				this.append(content);
			}

			MozXULElement.insertFTLIfNeeded("branding/brand.ftl");
			MozXULElement.insertFTLIfNeeded("zotero.ftl");
			if (document.l10n && this.shadowRoot) {
				document.l10n.connectRoot(this.shadowRoot);
			}

			window.addEventListener("unload", this._handleWindowUnload);

			this.initialized = true;
			this.init();
		}

		disconnectedCallback() {
			if (typeof super.disconnectedCallback === 'function') {
				super.disconnectedCallback();
			}

			this.replaceChildren();
			this.destroy();
			window.removeEventListener("unload", this._handleWindowUnload);
			this.initialized = false;
		}

		_handleWindowUnload = () => {
			this.disconnectedCallback();
		};
	};
}

// eslint-disable-next-line no-unused-vars
var XULElementBase = XULElementMixin(XULElement);
