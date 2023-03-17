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

const HTML_NS = 'http://www.w3.org/1999/xhtml';

var Zotero_Long_Tag_Fixer = new function () { // eslint-disable-line camelcase, no-unused-vars
	const { oldTag, isLongTag } = window.arguments?.[0] ?? { isLongTag: true, oldTag: '' };
	const dataOut = window.arguments?.[1] || {};
	
	this.init = function () {
		const lastMode = Zotero.Prefs.get('lastLongTagMode') || 0;
		const delimiter = Zotero.Prefs.get('lastLongTagDelimiter');

		this.dialog = document.getElementById('zotero-long-tag-fixer');
		this.intro = document.getElementById('intro');
		this.tabs = document.getElementById('zotero-new-tag-actions');
		this.oldTagInput = document.getElementById('zotero-old-tag');
		this.oldTag = document.getElementById('zotero-old-tag');
		this.delimiterLabel = document.getElementById('delimiter-label');
		this.oldTagDelimiter = document.getElementById('zotero-old-tag-delimiter');
		this.listbox = document.getElementById('zotero-new-tag-list');
		this.newTagInput = document.getElementById('zotero-new-tag-editor');
		this.newTagCharacterCount = document.getElementById('zotero-new-tag-character-count');
		this.zoteroNewTagInfo = document.getElementById('zotero-new-tag-characters');

		document.addEventListener('dialogaccept', () => this.accept());
		document.addEventListener('dialogcancel', () => this.cancel());
		this.tabs.addEventListener('select', (ev) => {
			if (ev.target === this.tabs.querySelector('tabpanels')) {
				this.switchMode(ev.currentTarget.selectedIndex);
			}
		});

		this.dialog.classList.toggle('is-long-tag', isLongTag);

		this.oldTagDelimiter.addEventListener('input', () => this.onUpdateDelimiter());
		this.newTagInput.addEventListener('input', ev => this.updateEditLength(ev.currentTarget.value.length));

		this.oldTagInput.value = oldTag;
		this.oldTagDelimiter.value = delimiter;

		this.updateLabel();
		this.switchMode(isLongTag ? lastMode : 0);
	};
	
	this.switchMode = function (index) {
		this.tabs.selectedIndex = index;
		let buttonLabel = "";
		
		switch (index) {
			default:
			case 0:
				buttonLabel = 'saveTags';
				this.updateTagList();
				this.oldTagDelimiter.select();
				break;
				
			case 1:
				buttonLabel = 'saveTag';
				this.newTagInput.value = oldTag;
				this.updateEditLength(oldTag.length);
				break;
				
			case 2:
				buttonLabel = 'deleteTag';
				this.dialog.getButton('accept').disabled = false;
				break;
		}
		
		this.dialog.getButton('accept').label = Zotero.getString('sync.longTagFixer.' + buttonLabel);
		window.sizeToContent();
		if (isLongTag) {
			Zotero.Prefs.set('lastLongTagMode', index);
		}
	};
	
	/**
	 * Split tags and populate list
	 */
	this.updateTagList = function () {
		let tags = [];
		
		const delimiter = document.getElementById('zotero-old-tag-delimiter').value;
		if (delimiter) {
			Zotero.Prefs.set('lastLongTagDelimiter', delimiter);
			const re = new RegExp("\\s*" + delimiter.replace(/([\.\-\[\]\(\)\?\*\+])/g, "\\$1") + "\\s*");
			tags = [...new Set(oldTag.split(re).filter(t => t.length > 0))];
		}
		
		const acceptButton = document.getElementById('zotero-long-tag-fixer').getButton('accept');
		if (!delimiter || tags.length < 2) {
			acceptButton.disabled = true;
			// return;
		}
		else {
			acceptButton.disabled = false;
		}
		
		tags.sort();
		
		while (this.listbox.childNodes.length) {
			this.listbox.removeChild(this.listbox.lastChild);
		}

		tags.forEach((tag) => {
			const li = document.createElement('richlistitem');
			const div = document.createElement('div');
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = true;
			checkbox.id = 'tag-' + tag;
			const label = document.createElement('label');
			label.setAttribute('for', 'tag-' + tag);
			label.textContent = tag;
			// Don't toggle checkbox for single-click on label
			
			div.appendChild(checkbox);
			div.appendChild(label);
			li.appendChild(div);
			this.listbox.append(li);
		});
		
		window.sizeToContent();
	};

	this.updateLabel = function () {
		this.delimiterLabel.innerHTML = this.oldTagDelimiter.value.length > 1
			? Zotero.getString('general.character.plural')
			: Zotero.getString('general.character.singular');
	};

	this.onUpdateDelimiter = function () {
		this.updateLabel();
		this.updateTagList();
	};
	
	
	this.deselectAll = function () {
		this.listbox.querySelectorAll('[type=checkbox]').forEach(checkbox => checkbox.checked = false);
	};
	
	
	this.selectAll = function () {
		this.listbox.querySelectorAll('[type=checkbox]').forEach(checkbox => checkbox.checked = true);
	};
	
	
	this.updateEditLength = function (len) {
		this.newTagCharacterCount.innerText = len;
		const invalid = len == 0 || len > Zotero.Tags.MAX_SYNC_LENGTH;
		this.zoteroNewTagInfo.classList.toggle('invalid', invalid);
		this.dialog.getButton('accept').disabled = invalid;
	};
	
	
	this.cancel = function () {
		dataOut.result = false;
	};
	
	
	this.accept = function () {
		try {
			const result = {};
			switch (this.tabs.selectedIndex) {
				// Split
				case 0:
					result.op = 'split';
					result.tags = Array.from(this.listbox.querySelectorAll('[type=checkbox]'))
						.filter(c => c.checked)
						.map(n => n.nextSibling.textContent);
					break;
				// Edit
				case 1:
					result.op = 'edit';
					result.tag = this.newTagInput.value;
					break;
				
				// Delete
				case 2:
					result.op = 'delete';
					break;
			}
			dataOut.result = result;
		}
		catch (e) {
			Zotero.debug(e);
			throw (e);
		}
	};
};
