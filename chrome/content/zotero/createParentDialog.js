/*
	***** BEGIN LICENSE BLOCK *****
    
	Copyright © 2025 Corporation for Digital Scholarship
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

/* global Zotero_Lookup: false */

const ZoteroCreateParentDialog = { // eslint-disable-line no-unused-vars
	init() {
		this.io = window.arguments[0];

		this.inputEl = document.getElementById('parent-item-identifier');
		this.progressEl = document.getElementById('progress');
		this.acceptBtnEl = document.querySelector('dialog').getButton("accept");
		this.manualEntryBtnEl = document.querySelector('dialog').getButton("extra2");

		// Set font size from pref
		Zotero.UIProperties.registerRoot(
			document.getElementById('zotero-create-parent-container')
		);

		this.inputEl.addEventListener('input', this.handleInput.bind(this));
		document.addEventListener('dialogaccept', this.handleAcceptClick.bind(this));
		document.addEventListener('dialogextra2', this.handleManualEntry.bind(this));

		document.getElementById('title').textContent = this.io.dataIn.item.attachmentFilename;
		this.inputEl.focus();
	},

	async performLookup() {
		let newItems = await Zotero_Lookup.addItemsFromIdentifier(
			this.inputEl,
			this.io.dataIn.item,
			this.handleStatusChange.bind(this)
		);

		// If we successfully created a parent, return it
		if (newItems.length) {
			this.io.dataOut = { parent: newItems[0] };
			window.close();
		}
	},

	handleInput(event) {
		const input = event.target.value.trim();
		this.acceptBtnEl.disabled = input === '';
	},

	handleStatusChange(isLookingUp)	{
		this.inputEl.disabled = isLookingUp;
		this.acceptBtnEl.disabled = isLookingUp;
		this.manualEntryBtnEl.disabled = isLookingUp;
		if (isLookingUp) {
			this.progressEl.setAttribute("status", "animate");
		}
		else {
			this.progressEl.removeAttribute("status");
		}
	},

	handleAcceptClick(ev) {
		ev.preventDefault();

		if (this.inputEl.value.trim() === '') {
			return;
		}

		this.performLookup();
	},

	handleManualEntry() {
		this.io.dataOut = { parent: false };
		window.close();
	}
};
