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

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

export class DocumentManager {
	_onSave;
	
	_currentState;
	
	_cleanState;
	
	_metadata;
	
	_unloaded = false;
	
	constructor(onSave) {
		this._onSave = onSave;
	}
	
	attach(win) {
		if (win.document.getElementById('cmd_close')) {
			throw new Error('#cmd_close already exists in document');
		}
		
		let commandset = win.document.createXULElement('commandset');
		win.document.documentElement.append(commandset);

		let closeCommand = win.document.createXULElement('command');
		closeCommand.id = 'cmd_close';
		closeCommand.addEventListener('command', async () => {
			if (await this.confirmClose()) {
				win.close();
			}
		});
		commandset.append(closeCommand);
		
		this._observer = {
			observe: async (cancelQuit) => {
				// We can't await a promise before deciding whether to cancel the quit,
				// so just cancel it
				cancelQuit.data = 1;
				
				// Run through the save prompt routine, and if the user doesn't choose Cancel,
				// quit for real
				if (await this.confirmClose()) {
					Zotero.Utilities.Internal.quit();
				}
			},
			
			QueryInterface: ChromeUtils.generateQI([
				"nsIObserver",
				"nsISupportsWeakReference",
			]),
		};
		Services.obs.addObserver(this._observer, 'quit-application-requested', true);

		win.addEventListener('close', (event) => {
			event.preventDefault();
			closeCommand.doCommand();
		});

		win.addEventListener('unload', () => {
			this._observer = null;
			this._unloaded = true;
		});
	}

	/**
	 * @param {any} state The current state.
	 * @param {Object} metadata
	 * @param {string} [metadata.title] The document title.
	 */
	setState(state, metadata) {
		this._currentState = state;
		this._metadata = metadata;
	}

	/**
	 * Set the current state as the "clean" state. Call this after opening/saving.
	 */
	setClean() {
		this._cleanState = this._currentState;
	}
	
	async confirmClose() {
		if (this._unloaded) {
			return true;
		}
		if (this._currentState === this._cleanState) {
			return true;
		}

		let title = this._metadata.title
			? await Zotero.ftl.formatValue('document-manager-confirm-dialog-title', {
				title: this._metadata.title
			})
			: await Zotero.ftl.formatValue('document-manager-confirm-dialog-title-new');
		let description = await Zotero.ftl.formatValue('document-manager-confirm-dialog-description');

		let ps = Services.prompt;
		let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_SAVE
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_DONT_SAVE;
		let index = ps.confirmEx(null,
			title,
			description,
			buttonFlags,
			null,
			null,
			null, null, {}
		);

		switch (index) {
			case 0: // Save
				await this._onSave();
				return true;
			case 1: // Cancel
				return false;
			case 2: // Don't Save
			default:
				return true;
		}
	}
}
