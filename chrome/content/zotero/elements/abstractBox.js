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
			<collapsible-section data-l10n-id="section-abstract" data-pane="abstract">
				<html:div class="body">
					<editable-text multiline="true" data-l10n-id="abstract-field" data-l10n-attrs="placeholder" />
				</html:div>
			</collapsible-section>
		`);
		
		showInFeeds = true;

		_item = null;

		_mode = null;

		get item() {
			return this._item;
		}

		set item(item) {
			this.blurOpenField();
			this._item = item;
			if (item?.isRegularItem()) {
				this.hidden = false;
				this.render();
			}
			else {
				this.hidden = true;
			}
		}

		get mode() {
			return this._mode;
		}

		set mode(mode) {
			if (this._mode === mode) {
				return;
			}
			this.blurOpenField();
			this._mode = mode;
			this.render();
		}

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'abstractBox');

			this._section = this.querySelector('collapsible-section');

			this._abstractField = this.querySelector('editable-text');
			this._abstractField.addEventListener('change', () => this.save());
			this._abstractField.ariaLabel = Zotero.getString('itemFields.abstractNote');

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
				this.item.setField('abstractNote', this._abstractField.value);
				await this.item.saveTx();
			}
			this.render();
		}

		async blurOpenField() {
			if (this._abstractField?.matches(':focus-within')) {
				this._abstractField.blur();
				await this.save();
			}
		}

		render() {
			if (!this.item) {
				return;
			}

			let abstract = this.item.getField('abstractNote');
			this._section.summary = abstract;
			if (!this._abstractField.initialValue || this._abstractField.initialValue !== abstract) {
				this._abstractField.value = abstract;
				this._abstractField.initialValue = '';
			}
			this._abstractField.readOnly = this._mode == 'view';
			this._abstractField.setAttribute('aria-label', Zotero.ItemFields.getLocalizedString('abstractNote'));
		}
	}
	customElements.define("abstract-box", AbstractBox);
}
