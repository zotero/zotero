/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2026 Corporation for Digital Scholarship
                     Falls Church, Virginia, USA
                     https://www.zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero. If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

/**
 * State shared by the banners shown above the tab deck in every main window
 */
Zotero.Banners = {
	_postUpgradeRemindAfter: 0,
	_postUpgradeTimer: null,
	
	/**
	 * Collapse a banner container in every main window
	 */
	hide(containerID) {
		for (let win of Zotero.getMainWindows()) {
			win.document.getElementById(containerID)?.setAttribute('collapsed', true);
		}
	},
	
	isPostUpgradeBannerDeferred() {
		return Date.now() < this._postUpgradeRemindAfter;
	},
	
	/**
	 * Hide the post-upgrade banner in every window for the rest of the session or 24 hours,
	 * whichever comes first
	 */
	deferPostUpgradeBanner() {
		const DELAY = 1000 * 60 * 60 * 24;
		this.hide('post-upgrade-container');
		this._postUpgradeRemindAfter = Date.now() + DELAY;
		if (this._postUpgradeTimer) {
			clearTimeout(this._postUpgradeTimer);
		}
		this._postUpgradeTimer = setTimeout(() => {
			this._postUpgradeTimer = null;
			for (let win of Zotero.getMainWindows()) {
				win.ZoteroPane?.showPostUpgradeBanner();
			}
		}, DELAY);
	}
};
