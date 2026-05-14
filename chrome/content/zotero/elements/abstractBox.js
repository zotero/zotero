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
	const { ItemPaneSectionElementBase } = ChromeUtils.importESModule(
		"chrome://zotero/content/elements/itemPaneSectionElementBase.mjs",
		{ global: "current" }
	);
	ChromeUtils.importESModule("chrome://zotero/content/actors/ActorManager.mjs");

	const SANDBOX_ALL_FLAGS = 0xFFFFF;
	
	class AbstractBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-abstract" data-pane="abstract">
				<html:div class="body">
					<editable-text multiline="true" data-l10n-id="abstract-field" data-l10n-attrs="placeholder" />
				</html:div>
			</collapsible-section>
		`);
		
		_mode = 'view';

		_fieldAlternatives = {};

		get item() {
			return this._item;
		}

		set item(item) {
			this.blurOpenField();
			super.item = item;
			if (item?.isRegularItem()) {
				this.hidden = false;
			}
			else {
				this.hidden = true;
			}
		}

		get editable() {
			return this._editable;
		}

		set editable(editable) {
			if (this._editable === editable) {
				return;
			}
			this.blurOpenField();
			super.editable = editable;
		}

		get mode() {
			return this._mode;
		}

		set mode(val) {
			switch (val) {
				case 'view':
				case 'edit':
				case 'merge':
					break;
				case 'fieldmerge':
					this._fieldAlternatives = {};
					break;
				default:
					throw new Error(`Invalid mode '${val}'`);
			}
			this._mode = val;
			this.setAttribute('mode', val);
		}

		set fieldAlternatives(val) {
			if (val.constructor.name != 'Object') {
				throw Error('fieldAlternatives must be an Object in <abstract-box>.fieldAlternatives');
			}
			if (this._mode != 'fieldmerge') {
				throw Error('fieldAlternatives is valid only in fieldmerge mode in <abstract-box>.fieldAlternatives');
			}
			this._fieldAlternatives = val;
		}

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'tab'], 'abstractBox');

			this.initCollapsibleSection();

			this._abstractField = this.querySelector('editable-text');
			this._abstractField.addEventListener('blur', this._handleFieldBlur);
			this._abstractField.ariaLabel = Zotero.getString('itemFields.abstractNote');
			this.render();
		}

		destroy() {
			this._abstractField?.removeEventListener('blur', this._handleFieldBlur);
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids) {
			if (action == 'modify' && this.item && ids.includes(this.item.id)) {
				this._forceRenderAll();
			}
			if (action === 'select' && type === 'tab' && ids.length > 0) {
				this._handleTabSelect(ids[0]);
			}
		}
		
		async save() {
			if (!this.editable) {
				return;
			}
			if (this._item) {
				if (!this._item.itemID) {
					throw new Error('Item has not been added to library');
				}
				this._item.setField('abstractNote', this._abstractField.value);
				await this._item.saveTx();
			}
			this._forceRenderAll();
		}

		async blurOpenField() {
			if (this._abstractField.focused) {
				this._abstractField.blur();
				await this.save();
			}
		}

		render() {
			if (!this.item) return;
			if (this._isAlreadyRendered()) return;

			if (!this.item.isFeedItem) {
				this._renderRegularItem();
			}
		}
		
		async asyncRender() {
			if (!this._item) return;
			if (this._isAlreadyRendered("async")) return;
			
			if (this.item.isFeedItem) {
				await this._renderFeedItem();
			}
		}
		
		async _renderFeedItem() {
			await this._ensureFeedAbstractBrowserExists();
			let url = this.item.library.url;
			let html = this.item.getField('abstractNote');
			this._abstractField.hidden = true;
			this._section.summary = Zotero.Utilities.cleanTags(html);
			
			let actor = this._feedAbstractBrowser.browsingContext.currentWindowGlobal.getActor('FeedAbstract');
			await actor.sendQuery('setContent', { url, html });
		}
		
		_renderRegularItem() {
			this._discardFeedAbstractBrowser();

			let abstract = this.item.getField('abstractNote');
			this._abstractField.hidden = false;
			this._section.summary = abstract;
			// If focused, update the value that will be restored on Escape;
			// otherwise, update the displayed value
			if (this._abstractField.focused) {
				this._abstractField.initialValue = abstract;
			}
			else {
				this._abstractField.value = abstract;
			}
			this._abstractField.readOnly = !this.editable;
			this._abstractField.setAttribute('aria-label', Zotero.ItemFields.getLocalizedString('abstractNote'));

			this._renderFieldVersionButton();
		}

		_renderFieldVersionButton() {
			let existing = this.querySelector('.zotero-field-version-button');
			if (existing) {
				existing.remove();
			}

			if (this._mode !== 'fieldmerge') {
				return;
			}

			let alternatives = this._fieldAlternatives?.abstractNote;
			if (!alternatives || !alternatives.length) {
				return;
			}

			let button = document.createXULElement('toolbarbutton');
			button.className = 'zotero-field-version-button zotero-clicky-merge';
			document.l10n.setAttributes(button, 'itembox-button-merge', {
				field: Zotero.ItemFields.getLocalizedString('abstractNote') || ''
			});

			let popup = button.appendChild(document.createXULElement('menupopup'));
			for (let v of alternatives) {
				let menuitem = document.createXULElement('menuitem');
				let sv = Zotero.Utilities.ellipsize(v, 60);
				menuitem.setAttribute('label', sv);
				if (v != sv) {
					menuitem.setAttribute('tooltiptext', v);
				}
				menuitem.setAttribute('originalValue', v);
				menuitem.addEventListener('command', () => {
					this.item.setField('abstractNote', menuitem.getAttribute('originalValue'));
					this._forceRenderAll();
				});
				popup.appendChild(menuitem);
			}

			button.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (event.screenX) {
					popup.openPopupAtScreen(event.screenX - 5, event.screenY + 5, true);
				}
				else {
					popup.openPopup(button, 'after_start');
				}
			});

			this.querySelector('.body').appendChild(button);
		}

		_ensureFeedAbstractBrowserExists = Zotero.Utilities.Internal.serial(async () => {
			if (!this._feedAbstractBrowser) {
				// dynamically create a browser element to avoid spawning a process for every tab (#4530)
				this._feedAbstractBrowser = document.createXULElement("browser");
				this._feedAbstractBrowser.setAttribute("type", "content");
				// fx128: about:blank no longer displays content when loaded remotely
				// TODO: See if we can make this remote again
				this._feedAbstractBrowser.setAttribute("remote", "false");
				this._feedAbstractBrowser.setAttribute("maychangeremoteness", "true");
				this._feedAbstractBrowser.setAttribute("messagemanagergroup", "feedAbstract");
				this.querySelector('.body').appendChild(this._feedAbstractBrowser);
				this._feedAbstractBrowser.browsingContext.sandboxFlags |= SANDBOX_ALL_FLAGS;
				let webProgress = this._feedAbstractBrowser.browsingContext.webProgress;

				return new Promise((resolve) => {
					let progressListener = {
						onStateChange(_progressData, _requestData, stateFlags) {
							if (stateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
								webProgress.removeProgressListener(progressListener);
								resolve();
							}
						},
						QueryInterface: ChromeUtils.generateQI([
							"nsIWebProgressListener",
							"nsISupportsWeakReference"
						])
					};
					
					webProgress.addProgressListener(
						progressListener,
						Ci.nsIWebProgress.NOTIFY_STATE_ALL
					);
				});
			}
			return Promise.resolve();
		});

		_discardFeedAbstractBrowser() {
			if (this._feedAbstractBrowser) {
				this._feedAbstractBrowser.remove();
				this._feedAbstractBrowser = null;
			}
		}

		_handleFieldBlur = () => {
			this.save();
		};

		_handleTabSelect = (tabID) => {
			if (!this.tabID || typeof Zotero_Tabs === 'undefined') {
				return;
			}
			if (tabID !== this.tabID) {
				return;
			}

			if (this._syncRenderPending) {
				this._syncRenderPending = false;
				this.render();
			}
		};
	}
	customElements.define("abstract-box", AbstractBox);
}
