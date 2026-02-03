/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2026 Corporation for Digital Scholarship
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
	const { DEFAULT_ATTACHMENT_RENAME_TEMPLATE } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
	const DEFAULT_EXT = 'pdf';
	class FileRenameSettings extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<vbox>
				<groupbox id="file-rename-settings-section-main">
					<checkbox id="auto-rename-files"
						data-l10n-id="preferences-file-renaming-auto-rename-files"
						native="true"
					/>
					<vbox class="indented-pref" aria-labelledby="preferences-file-renaming-file-types" role="group">
						<label id="preferences-file-renaming-file-types" data-l10n-id="preferences-file-renaming-file-types"/>
						<hbox
							id="file-renaming-file-types-box"
							class="indented-pref"
						>
							<checkbox
								data-l10n-id="preferences-file-renaming-file-type-pdf"
								data-content-type="application/pdf"
								native="true"
							/>
							<checkbox
								data-l10n-id="preferences-file-renaming-file-type-epub"
								data-content-type="application/epub+zip"
								native="true"
							/>
							<checkbox
								data-l10n-id="preferences-file-renaming-file-type-image"
								data-content-type="image/"
								native="true"
							/>
							<checkbox
								data-l10n-id="preferences-file-renaming-file-type-audio"
								data-content-type="audio/"
								native="true"
							/>
							<checkbox
								data-l10n-id="preferences-file-renaming-file-type-video"
								data-content-type="video/"
								native="true"
							/>
						</hbox>
					</vbox>
					<checkbox id="rename-linked-files" class="indented-pref"
						data-l10n-id="preferences-file-renaming-rename-linked"
						preference="extensions.zotero.autoRenameFiles.linked"
						native="true"
					/>
				</groupbox>
				
				<groupbox id="file-rename-settings-section-instructions">
					<label data-l10n-id="preferences-file-renaming-format-instructions" />
					<separator class="thin" />
					<label data-l10n-id="preferences-file-renaming-format-instructions-example"
						data-l10n-args='${JSON.stringify({ example: "{{ title truncate=\"50\" }}" })}' />
					<separator class="thin" />
					<label data-l10n-id="preferences-file-renaming-format-instructions-more">
						<label
							is="zotero-text-link"
							href="https://www.zotero.org/support/file_renaming"
							data-l10n-name="file-renaming-format-help-link"
						/>
					</label>	
					<separator class="thin" />
				</groupbox>
				
				<groupbox id="file-rename-settings-section-template">
					<html:label
						for="file-renaming-format-template"
						id="file-renaming-format-template-label"
					>
						<html:h2 data-l10n-id="preferences-file-renaming-format-template" />
					</html:label>
					<html:textarea
						aria-labelledby="file-renaming-format-template-label"
						id="file-renaming-format-template"
						rows="8"
					/>
					<html:label id="file-renaming-format-preview-label">
						<html:h2
							data-l10n-id="preferences-file-renaming-format-preview"
						/>
					</html:label>
					<html:label
						aria-labelledby="file-renaming-format-preview-label"
						id="file-renaming-format-preview"
					/>
					<hbox id="file-renaming-format-preview-buttons">
						<button
							id="file-renaming-rename-now"
							data-l10n-id="preferences-file-renaming-rename-now"
						/>
					</hbox>
				</groupbox>
			</vbox>
	`);

		static get observedAttributes() {
			return [
				'auto-rename-enabled',
				'file-types',
				'format-template',
				'instructions-hidden',
				'main-hidden',
				'rename-linked-enabled',
				'rename-linked-hidden',
				'rename-now-disabled',
				'rename-now-hidden',
				'template-hidden',
			];
		}

		get autoRenameEnabled() {
			return this.autoRenameToggleCheckbox.checked;
		}
		
		set autoRenameEnabled(val) {
			this.autoRenameToggleCheckbox.checked = val;
			this.updateDisabled();
		}
		
		get renameLinkedEnabled() {
			return this.renameLinkedCheckbox.checked;
		}
		
		set renameLinkedEnabled(val) {
			this.renameLinkedCheckbox.checked = val;
		}
		
		get enabledFileTypes() {
			let enabledTypes = new Set(
				(this._enabledFileTypes).split(',').filter(Boolean)
			);
			for (let checkbox of this.fileTypesCheckboxes.querySelectorAll('checkbox')) {
				if (checkbox.checked) {
					enabledTypes.add(checkbox.dataset.contentType);
				}
				else {
					enabledTypes.delete(checkbox.dataset.contentType);
				}
			}
			return [...enabledTypes].join(',');
		}
		
		set enabledFileTypes(types) {
			this._enabledFileTypes = types;
			let enabledTypes = new Set(
				(this._enabledFileTypes).split(',').filter(Boolean)
			);
			for (let checkbox of this.fileTypesCheckboxes.querySelectorAll('checkbox')) {
				checkbox.checked = enabledTypes.has(checkbox.dataset.contentType);
			}
		}
		
		get formatTemplate() {
			return this.formatTemplateTextarea.value;
		}
		
		set formatTemplate(val) {
			this.formatTemplateTextarea.value = val;
		}

		handleChange = () => {
			const autoRenameEnabled = this.autoRenameEnabled;
			const enabledFileTypes = this.enabledFileTypes;
			const renameLinkedEnabled = this.renameLinkedEnabled;
			const formatTemplate = this.formatTemplate;
			this.dispatchEvent(new CustomEvent("change", {
				detail: {
					autoRenameEnabled,
					enabledFileTypes,
					renameLinkedEnabled,
					formatTemplate
				},
				bubbles: true,
				cancelable: true
			}));
		};

		handleTemplateInput = () => {
			const formatString = this.formatTemplateTextarea.value;
			// Ignore the empty value, which we'll reset in handleInputBlur() if necessary
			if (formatString.replace(/\s/g, '') === '') {
				return;
			}
			this.updatePreview();
			this.handleChange();
		};

		handleTemplateBlur = () => {
			const formatString = this.formatTemplateTextarea.value;
			if (formatString.replace(/\s/g, '') === '') {
				this.formatTemplateTextarea.value = DEFAULT_ATTACHMENT_RENAME_TEMPLATE;
				this.updatePreview();
				this.handleChange();
			}
		};

		handleRenameToggle = () => {
			this.autoRenameEnabled = this.autoRenameToggleCheckbox.checked;
			this.handleChange();
		};

		handleRenameNow = () => {
			const event = new CustomEvent("rename", {
				bubbles: true,
				cancelable: true
			});
			this.dispatchEvent(event);
		};
		
		updateDisabled = () => {
			for (let checkbox of this.fileTypesCheckboxes.querySelectorAll('checkbox')) {
				checkbox.disabled = !this.autoRenameEnabled;
			}
			this.renameLinkedCheckbox.disabled = !this.autoRenameEnabled;
			this.renameNowButton.hidden = !this.autoRenameEnabled;
		};

		updatePreview = () => {
			if (this.getAttribute('template-hidden') === 'true') {
				return;
			}
			
			const [item, ext, attachmentTitle] = this.getActiveItem() ?? [this.mockItem ?? this.makeMockItem(), DEFAULT_EXT, ''];
			const formatString = this.formatTemplate;
			const preview = Zotero.Attachments.getFileBaseNameFromItem(item, { formatString, attachmentTitle });
			this.querySelector('#file-renaming-format-preview').innerText = `${preview}.${ext}`;
		};

		async init() {
			this.sectionMain = this.querySelector('#file-rename-settings-section-main');
			this.sectionInstructions = this.querySelector('#file-rename-settings-section-instructions');
			this.sectionTemplate = this.querySelector('#file-rename-settings-section-template');
			this.autoRenameToggleCheckbox = this.querySelector('#auto-rename-files');
			this.fileTypesCheckboxes = this.querySelector('#file-renaming-file-types-box');
			this.renameLinkedCheckbox = this.querySelector('#rename-linked-files');
			this.formatTemplateTextarea = this.querySelector('#file-renaming-format-template');
			this.renameNowButton = this.querySelector('#file-renaming-rename-now');
			
			this.enabledFileTypes = this.getAttribute('file-types') ?? '';
			this.autoRenameEnabled = this.getAttribute('auto-rename-enabled') === 'true';
			this.renameLinkedCheckbox.checked = this.getAttribute('rename-linked-enabled') === 'true';
			this.formatTemplate = this.getAttribute('format-template') ?? '';
			this.sectionMain.hidden = this.getAttribute('main-hidden') === 'true';
			this.sectionInstructions.hidden = this.getAttribute('instructions-hidden') === 'true';
			this.renameLinkedCheckbox.hidden = this.getAttribute('rename-linked-hidden') === 'true';
			this.sectionTemplate.hidden = this.getAttribute('template-hidden') === 'true';
			this.renameNowButton.hidden = this.getAttribute('rename-now-hidden') === 'true';
			this.renameNowButton.disabled = this.getAttribute('rename-now-disabled') === 'true';

			this.autoRenameToggleCheckbox.addEventListener("command", this.handleRenameToggle);
			this.fileTypesCheckboxes.addEventListener("command", this.handleChange);
			this.renameLinkedCheckbox.addEventListener("command", this.handleChange);
			this.formatTemplateTextarea.addEventListener("input", this.handleTemplateInput);
			this.formatTemplateTextarea.addEventListener("blur", this.handleTemplateBlur);
			this.renameNowButton.addEventListener("command", this.handleRenameNow);

			this._itemsView = Zotero.getActiveZoteroPane()?.itemsView;
			if (this._itemsView) {
				this._itemsView.onSelect.addListener(this.updatePreview);
			}
			
			this.updatePreview();
		}

		disconnectedCallback() {
			super.disconnectedCallback();
			this._itemsView.onSelect.removeListener(this.updatePreview);
		}

		attributeChangedCallback(name, oldValue, newValue) {
			if (!this.sectionMain) return;

			switch (name) {
				case 'auto-rename-enabled':
					this.autoRenameEnabled = newValue === 'true';
					break;
				case 'file-types':
					this.enabledFileTypes = newValue ?? '';
					break;
				case 'format-template':
					this.formatTemplate = newValue ?? '';
					this.updatePreview();
					break;
				case 'instructions-hidden':
					this.sectionInstructions.hidden = newValue === 'true';
					break;
				case 'main-hidden':
					this.sectionMain.hidden = newValue === 'true';
					break;
				case 'rename-linked-enabled':
					this.renameLinkedCheckbox.checked = newValue === 'true';
					break;
				case 'rename-linked-hidden':
					this.renameLinkedCheckbox.hidden = newValue === 'true';
					break;
				case 'rename-now-disabled':
					this.renameNowButton.disabled = newValue === 'true';
					break;
				case 'rename-now-hidden':
					this.renameNowButton.hidden = newValue === 'true';
					break;
				case 'template-hidden':
					this.sectionTemplate.hidden = newValue === 'true';
					if (!this.sectionTemplate.hidden) {
						this.updatePreview();
					}
					break;
			}
		}

		getActiveItem() {
			let selectedItem = Zotero.getActiveZoteroPane()?.getSelectedItems()?.[0];
			if (selectedItem) {
				if (selectedItem.isRegularItem() && !selectedItem.parentKey) {
					return [selectedItem, DEFAULT_EXT, ''];
				}
				if (selectedItem.isFileAttachment() && selectedItem.parentKey) {
					let ext = Zotero.Attachments.getCorrectFileExtension(selectedItem);
					let parentItem = Zotero.Items.getByLibraryAndKey(selectedItem.libraryID, selectedItem.parentKey);
					return [parentItem, ext ?? DEFAULT_EXT, selectedItem.getField('title')];
				}
			}

			return null;
		}

		makeMockItem() {
			this.mockItem = new Zotero.Item('journalArticle');
			this.mockItem.libraryID = Zotero.Libraries.userLibraryID;
			this.mockItem.setField('title', 'Example Title: Example Subtitle');
			this.mockItem.setCreators([
				{ firstName: 'Jane', lastName: 'Doe', creatorType: 'author' },
				{ firstName: 'John', lastName: 'Smith', creatorType: 'author' }
			]);
			this.mockItem.setField('shortTitle', 'Example Title');
			this.mockItem.setField('publicationTitle', 'Advances in Example Engineering');
			this.mockItem.setField('volume', '9');
			this.mockItem.setField('issue', '1');
			this.mockItem.setField('pages', '34-55');
			this.mockItem.setField('date', '2018');
			this.mockItem.setField('DOI', '10.1016/1234-example');
			this.mockItem.setField('ISSN', '1234-5678');
			this.mockItem.setField('abstractNote', 'This is an example abstract.');
			this.mockItem.setField('extra', 'This is an example Extra field.');
			this.mockItem.setField('accessDate', '2020-01-01');
			this.mockItem.setField('url', 'https://example.com');
			this.mockItem.setField('libraryCatalog', 'Example Library Catalog');
			return this.mockItem;
		}
	}

	customElements.define('file-renaming-settings', FileRenameSettings);
}
