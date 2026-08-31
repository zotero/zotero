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
	let _initialized = false;

	let _claimedPaneStates = new Set();
	let _paneStateClaimAttempted = false;
	let _finalized = false;
	
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
		_initialized = true;
	};
	
	function getPaneStates() {
		return _state.windows.filter(x => x.type == 'pane');
	}
	
	/**
	 * Take ownership of a saved main-window state, so that no other window restores it
	 *
	 * The window opened at startup claims the first saved state; windows opened for the
	 * remaining states pass the id of the state they were opened for. Windows opened by the
	 * user don't restore anything.
	 *
	 * @param {String} [windowID] - The window id of the state to claim
	 * @return {Object|null}
	 */
	this.claimPaneState = function (windowID) {
		let state = null;
		if (windowID) {
			state = getPaneStates().find(
				x => x.windowID == windowID && !_claimedPaneStates.has(x)
			);
		}
		else if (!_paneStateClaimAttempted) {
			state = getPaneStates().find(x => !_claimedPaneStates.has(x));
		}
		_paneStateClaimAttempted = true;
		if (!state) {
			return null;
		}
		_claimedPaneStates.add(state);
		return state;
	};
	
	/**
	 * The saved main-window states that no window has claimed yet
	 *
	 * @return {Object[]}
	 */
	this.getUnclaimedPaneStates = function () {
		return getPaneStates().filter(x => !_claimedPaneStates.has(x));
	};
	
	this.setLastClosedZoteroPaneState = function (state) {
		// This is the last open main window, so any other saved pane states are stale
		_state.windows = _state.windows
			.filter(x => x.type != 'pane')
			.concat([state]);
	};
	
	/**
	 * Forget the saved state of a window that was closed while other windows remained open
	 *
	 * @param {String} windowID
	 */
	this.removeZoteroPaneState = function (windowID) {
		_state.windows = _state.windows.filter(x => x.type != 'pane' || x.windowID != windowID);
	};

	this.debounceSave = Zotero.Utilities.debounce(() => {
		this.save();
	}, DEBOUNCED_SAVING_DELAY);

	/**
	 * Save the state at quit and ignore any save requests that arrive while windows are
	 * closing, which would record the already-emptying window list
	 */
	this.saveFinalState = function () {
		_finalized = true;
		return this.save(true);
	};

	this.save = Zotero.serial(async function (force) {
		// Don't overwrite the saved session if startup failed before the session was loaded
		if (!_initialized) {
			return;
		}
		if (_finalized && !force) {
			return;
		}
		try {
			// Saving is triggered in `zotero.js` when a quit event is received,
			// though if it was triggered by closing a window, ZoteroPane might
			// be already destroyed at the time
			// Order pane states with the most recently activated window last: restored
			// windows are opened in saved order, so the last-used window ends up on top
			let panes = Zotero.getZoteroPanes()
				.sort((a, b) => a.lastActivated - b.lastActivated)
				.map(x => x.getState());
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
	});
};
