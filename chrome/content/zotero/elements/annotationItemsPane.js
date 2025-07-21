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

		get filter() {
			return (this._filter || "").toLowerCase();
		}

		set filter(val) {
			this._filter = val;
		}

		get annotationsAction() {
			return this._annotationsAction;
		}

		set annotationsAction(val) {
			this._annotationsAction = val;
		}

		init() {
			this._body = this.querySelector('.body');
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item']);
			this._body.addEventListener('keydown', this._handleKeyDown.bind(this));
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
			this._body.removeEventListener('keydown', this._handleKeyDown.bind(this));
		}

		notify(action, type, ids) {
			if (action == 'modify') {
				for (let id of ids) {
					let updatedItem = Zotero.Items.get(id);
					// If a selected annotation is renamed, re-render its annotation row
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

			// Remove collapsible sections for top-level items that no longer have any annotations
			for (let section of [...this.querySelectorAll("collapsible-section")]) {
				let parentID = section.dataset.pane.split("-")[1];
				if (!topLevelItems.some(item => item.id == parentID)) {
					section.remove();
				}
			}
			for (let parentItem of topLevelItems) {
				let allAnnotations = this.items.filter(item => item.topLevelItem.id == parentItem.id);
				let visibleAnnotations = allAnnotations.filter(item => this._passesFilter(item));
				// Create a collapsible section for each top-level item if it does not exist yet
				let section = this.querySelector(`[data-pane="annotations-${parentItem.id}"]`);
				if (!section) {
					section = document.createXULElement("collapsible-section");
					section.dataset.l10nId = "section-attachments-annotations";
					section.dataset.pane = `annotations-${parentItem.id}`;
					section.summary = parentItem.getDisplayTitle();

					let sectionBody = document.createElement("div");
					sectionBody.classList.add("body");

					section.appendChild(sectionBody);
					this._body.append(section);
				}
				document.l10n.setArgs(section, { count: visibleAnnotations.length });
				// Hide section if all of its annotations are filtered out
				section.toggleAttribute("hidden", visibleAnnotations.length === 0);
				// Add annotations into this collapsible section (create if they don't exist)
				for (let annotation of allAnnotations) {
					let row = this.querySelector(`annotation-row[annotation-id="${annotation.id}"]`);
					if (!row) {
						row = document.createXULElement('annotation-row');
						row.annotation = annotation;
						if (this.annotationsAction) {
							row.action = this.annotationsAction;
						}
						section.querySelector('.body').append(row);
					}
					// Hide annotation rows that are filtered out
					row.toggleAttribute("hidden", !this._passesFilter(annotation));
				}
			}
			
			// Remove annotation rows for annotations that are no longer in this.items
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

		_passesFilter(annotation) {
			if (!this.filter) return true;
			let text = (annotation.annotationText || "").toLowerCase();
			let comment = (annotation.annotationComment || "").toLowerCase();
			let tags = (annotation.getTags() || []).map(tag => tag.tag.toLowerCase()).join(" ");
			return text.includes(this.filter) || comment.includes(this.filter) || tags.includes(this.filter);
		}

		// Handle arrowUp/Down navigation between focused annotation rows
		_handleKeyDown(event) {
			if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
			
			let currentRow = event.target.closest('annotation-row');
			if (!currentRow) return;

			let visibleRows = [...this.querySelectorAll('annotation-row:not([hidden])')];
			let currentIndex = visibleRows.indexOf(currentRow);
			
			if (currentIndex === -1) return;

			let nextIndex;
			if (event.key === 'ArrowDown') {
				nextIndex = currentIndex + 1;
			}
			else {
				nextIndex = currentIndex - 1;
			}

			if (nextIndex >= 0 && nextIndex < visibleRows.length) {
				visibleRows[nextIndex].focus();
				event.preventDefault();
			}
		}
	}

	customElements.define("annotation-items-pane", AnnotationItemsPane);
}
