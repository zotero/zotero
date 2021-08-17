/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2021 Corporation for Digital Scholarship
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

Zotero.Session = new function () {
	const SESSION_FILE_NAME = 'session.json';

	let _state = {
		windows: []
	};

	Zotero.defineProperty(this, 'state', {
		get: () => {
			return _state;
		}
	});

	this.init = async function () {
		try {
			let sessionFile = OS.Path.join(Zotero.Profile.dir, SESSION_FILE_NAME);
			let state = await Zotero.File.getContentsAsync(sessionFile);
			_state = JSON.parse(state);
		}
		catch (e) {
			Zotero.logError(e);
		}
	};
	
	this.setLastClosedZoteroPaneState = function (state) {
		_state.windows = [state];
	};

	this.save = async function () {
		try {
			// Save is triggered when application receives quit event,
			// but if it was triggered by closing window, ZoteroPane might
			// be already destroyed
			let panes = Zotero.getZoteroPanes();
			if (panes.length) {
				_state.windows = panes.map(x => x.getState());
			}

			let sessionFile = OS.Path.join(Zotero.Profile.dir, SESSION_FILE_NAME);
			await Zotero.File.putContentsAsync(sessionFile, JSON.stringify(_state));
		}
		catch (e) {
			Zotero.logError(e);
		}
	};
};
