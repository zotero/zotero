/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
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

"use strict";

{
	class AbstractBox extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<editable-text multiline="true" data-l10n-id="abstract-field" />
		`);

		_item = null;

		_mode = null;

		get item() {
			return this._item;
		}

		set item(item) {
			this.blurOpenField();
			this._item = item;
			this.render();
		}

		get mode() {
			return this._mode;
		}

		set mode(mode) {
			this._mode = mode;
			this.render();
		}

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'abstractBox');

			this.abstractField = this.querySelector('editable-text');
			this.abstractField.addEventListener('change', () => this.save());
			this.abstractField.ariaLabel = Zotero.getString('itemFields.abstractNote');

			this.render();
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids) {
			if (action == 'modify' && this.item && ids.includes(this.item.id)) {
				this.render();
			}
		}
		
		async save() {
			if (this.item) {
				this.item.setField('abstractNote', this.abstractField.value);
				await this.item.saveTx();
			}
			this.render();
		}

		async blurOpenField() {
			this.abstractField.blur();
			await this.save();
		}

		render() {
			if (!this.item) {
				return;
			}

			let title = this.item.getField('abstractNote');
			if (this.abstractField.initialValue !== title) {
				this.abstractField.value = title;
			}
			this.abstractField.readOnly = this._mode == 'view';
			this.abstractField.setAttribute('aria-label', Zotero.ItemFields.getLocalizedString('abstractNote'));
		}
	}
	customElements.define("abstract-box", AbstractBox);
}
