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
	const DEBOUNCED_SAVING_DELAY = 5 * 60 * 1000; // 5 min

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
			if (e.name != 'NotFoundError') {
				Zotero.logError(e);
			}
		}
	};
	
	this.setLastClosedZoteroPaneState = function (state) {
		_state.windows = [state];
	};

	this.debounceSave = Zotero.Utilities.debounce(() => {
		this.save();
	}, DEBOUNCED_SAVING_DELAY);

	this.save = async function () {
		try {
			// Saving is triggered in `zotero.js` when a quit event is received,
			// though if it was triggered by closing a window, ZoteroPane might
			// be already destroyed at the time
			let panes = Zotero.getZoteroPanes().map(x => x.getState());
			let readers = Zotero.Reader.getWindowStates();
			if (panes.length) {
				_state.windows = [...readers, ...panes];
			}
			else if (readers.length) {
				_state.windows = _state.windows.filter(x => x.type != 'reader');
				_state.windows = [..._state.windows, ...readers];
			}
			let sessionFile = OS.Path.join(Zotero.Profile.dir, SESSION_FILE_NAME);
			await Zotero.File.putContentsAsync(sessionFile, JSON.stringify(_state));
		}
		catch (e) {
			Zotero.logError(e);
		}
	};
};
