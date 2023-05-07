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

class XULElementBase extends XULElement {
	/**
	 * @return {DocumentFragment | null}
	 */
	get content() {
		return null;
	}

	init() {}

	destroy() {}

	connectedCallback() {
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

		this.init();
	}

	disconnectedCallback() {
		this.replaceChildren();
		this.destroy();
	}
}
