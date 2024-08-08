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
	ChromeUtils.import("chrome://zotero/content/actors/ActorManager.jsm");

	const SANDBOX_ALL_FLAGS = 0xFFFFF;
	
	class AbstractBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-abstract" data-pane="abstract">
				<html:div class="body">
					<editable-text multiline="true" data-l10n-id="abstract-field" data-l10n-attrs="placeholder" />
				</html:div>
			</collapsible-section>
		`);
		
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

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'abstractBox');

			this.initCollapsibleSection();

			this._abstractField = this.querySelector('editable-text');
			this._abstractField.addEventListener('blur', () => this.save());
			this._abstractField.ariaLabel = Zotero.getString('itemFields.abstractNote');
			this.render();
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids) {
			if (action == 'modify' && this.item && ids.includes(this.item.id)) {
				this._forceRenderAll();
			}
		}
		
		async save() {
			if (this.item) {
				this.item.setField('abstractNote', this._abstractField.value);
				await this.item.saveTx();
			}
			this._forceRenderAll();
		}

		async blurOpenField() {
			if (this._abstractField?.matches(':focus-within')) {
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
		}

		async _ensureFeedAbstractBrowserExists() {
			if (!this._feedAbstractBrowser) {
				// dynamically create a browser element to avoid spawning a process for every tab (#4530)
				this._feedAbstractBrowser = document.createXULElement("browser");
				this._feedAbstractBrowser.setAttribute("type", "content");
				this._feedAbstractBrowser.setAttribute("remote", "true");
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
		}

		_discardFeedAbstractBrowser() {
			if (this._feedAbstractBrowser) {
				this._feedAbstractBrowser.remove();
				this._feedAbstractBrowser = null;
			}
		}
	}
	customElements.define("abstract-box", AbstractBox);
}
