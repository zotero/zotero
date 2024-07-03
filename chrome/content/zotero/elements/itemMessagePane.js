/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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

{
	class ItemMessagePane extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="custom-head empty"></html:div>
			<groupbox id="zotero-item-pane-groupbox" pack="center" align="center">
				<vbox id="zotero-item-pane-message-box"/>
			</groupbox>
		`);

		init() {
			this._messageBox = this.querySelector('#zotero-item-pane-message-box');
		}

		render(content) {
			if (typeof content == 'string') {
				this._messageBox.replaceChildren();
				let contentParts = content.split("\n\n");
				for (let part of contentParts) {
					let desc = document.createXULElement('description');
					desc.appendChild(document.createTextNode(part));
					this._messageBox.appendChild(desc);
				}
			}
			else if (typeof content === 'object' && 'l10nId' in content) {
				let { l10nId, l10nArgs } = content;
				if (this._messageBox.firstElementChild?.localName === 'description') {
					this._messageBox.replaceChildren(this._messageBox.firstElementChild);
				}
				else {
					this._messageBox.replaceChildren(document.createXULElement('description'));
				}
				document.l10n.setAttributes(this._messageBox.firstElementChild, l10nId, l10nArgs);
			}
			else {
				this._messageBox.replaceChildren(content);
			}
		}

		renderCustomHead(callback) {
			let customHead = this.querySelector(".custom-head");
			customHead.replaceChildren();
			let append = (...args) => {
				customHead.append(...args);
			};
			if (callback) callback({
				doc: document,
				append,
			});
		}
	}

	customElements.define("item-message-pane", ItemMessagePane);
}
