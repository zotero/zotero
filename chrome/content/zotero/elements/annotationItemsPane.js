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
	class AnnotationItemsPane extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="custom-head"></html:div>
			<html:div class="body zotero-view-item"> </html:div>
		`);

		set items(items) {
			if (items.some(item => !item.isAnnotation())) return;
			this._items = items;
		}

		get items() {
			return this._items || [];
		}

		init() {
			this._body = this.querySelector('.body');
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item']);
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids) {
			if (action == 'modify') {
				for (let id of ids) {
					let updatedItem = Zotero.Items.get(id);
					// If a selected annotation is renamed, re-render it's annotation row
					if (updatedItem.isAnnotation()) {
						let row = this.querySelector(`annotation-row[annotation-id="${id}"]`);
						if (row) {
							row.render();
						}
					}
					// Update name of collapsible section if item is renamed
					else if (updatedItem.isRegularItem()) {
						let section = this.querySelector(`collapsible-section[data-item-id="${id}"]`);
						if (section) {
							section.summary = updatedItem.getDisplayTitle();
						}
					}
				}
			}
		}

		render() {
			if (!this.initialized) return;

			let topLevelItems = Zotero.Items.getTopLevel(this.items);

			// Remove collapsible sections for top-level items whose annotations are no longer selected
			for (let section of [...this.querySelectorAll("collapsible-section")]) {
				let parentID = section.dataset.pane.split("-")[1];
				if (!topLevelItems.some(item => item.id == parentID)) {
					section.remove();
				}
			}
			for (let parentItem of topLevelItems) {
				let selectedAnnotations = this.items.filter(item => item.topLevelItem.id == parentItem.id);
				// Create a collapsible section for each top-level item if it does not exist yet
				let section = this.querySelector(`[data-pane="annotations-${parentItem.id}"]`);
				if (!section) {
					section = MozXULElement.parseXULToFragment(
						`<collapsible-section
							data-l10n-id="section-attachments-annotations"
							data-pane="annotations-${parentItem.id}"
							summary="${parentItem.getDisplayTitle()}"
							data-item-id="${parentItem.id}">

							<html:div class="body"></html:div>

						</collapsible-section>`
					).querySelector("collapsible-section");
					this._body.append(section);
				}
				document.l10n.setArgs(section, { count: selectedAnnotations.length });
				// Add annotations into this collapsible section
				for (let annotation of selectedAnnotations) {
					// Skip rows that already exist
					if (this.querySelector(`annotation-row[annotation-id="${annotation.id}"]`)) continue;
					let row = document.createXULElement('annotation-row');
					row.annotation = annotation;
					section.querySelector('.body').append(row);
				}
			}
			// Remove annotation rows for annotations that are no longer selected
			for (let row of [...this.querySelectorAll("annotation-row")]) {
				let rowID = row.getAttribute("annotation-id");
				if (!this.items.some(obj => obj.id == rowID)) {
					row.remove();
				}
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

	customElements.define("annotation-items-pane", AnnotationItemsPane);
}
