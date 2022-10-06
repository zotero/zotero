/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     http://digitalscholar.org/
    
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

Zotero.AttachmentReadObserver = {
	init() {
		this._observerID = Zotero.Notifier.registerObserver(this, ['file', 'setting'], 'attachmentReadObserver');
	},
	
	unregister() {
		if (this._observerID) {
			Zotero.Notifier.unregisterObserver(this._observerID);
			this._observerID = null;
		}
	},

	/**
	 * To make the date mockable in tests
	 * @return {Date}
	 */
	_getCurrentDate() {
		return new Date();
	},

	/**
	 * @param {Zotero.Item} item
	 */
	async updateAttachmentLastRead(item) {
		// Limit to My Library and groups
		if (item.libraryID != Zotero.Libraries.userLibraryID && !item.library.isGroup) {
			return;
		}
		
		item.attachmentLastRead = Math.round(this._getCurrentDate().getTime() / 1000);
		await item.saveTx({ skipDateModifiedUpdate: true });
	},
	
	async notify(action, type, ids, extraData) {
		if (type == 'file') {
			if (!['pageChange', 'open'].includes(action)) {
				return;
			}
			let items = await Zotero.Items.getAsync(ids);
			switch (action) {
				case 'open':
					for (let item of items) {
						await this.updateAttachmentLastRead(item);
					}
					break;
				case 'pageChange': {
					let fiveMinutesAgo = this._getCurrentDate();
					fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
					for (let item of items) {
						if (item.library.lastReadItemInSession !== item.id
							|| new Date(item.attachmentLastRead * 1000) < fiveMinutesAgo) {
							await this.updateAttachmentLastRead(item);
						}
					}
					break;
				}
			}
		}
		else if (type == 'setting') {
			for (let id of ids) {
				let [settingLibraryID, settingKey] = id.split('/');
				if (settingLibraryID != Zotero.Libraries.userLibraryID) {
					continue;
				}
				if (settingKey.startsWith('lastRead_')) {
					let [, librarySlug, itemKey] = settingKey.split('_');
					let libraryID;
					if (librarySlug == 'u') {
						continue; // lastRead_ synced settings are only used for group items
					}
					else if (librarySlug.startsWith('g')) {
						libraryID = Zotero.Groups.getLibraryIDFromGroupID(parseInt(librarySlug.substring(1)));
					}
					else {
						Zotero.debug('Invalid library slug in key: ' + settingKey);
					}
					let item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, itemKey);
					if (item.isAttachment()) {
						item.attachmentLastRead = Zotero.SyncedSettings.get(settingLibraryID, settingKey);
						await item.saveTx({ skipDateModifiedUpdate: true });
					}
				}
			}
		}
	}
};
