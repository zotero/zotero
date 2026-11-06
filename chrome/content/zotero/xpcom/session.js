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

	// Saved main-window states that haven't been restored into a window yet
	let _pendingPaneStates = [];
	let _finalized = false;
	// Tabs and main windows closed during the session, most recent last
	let _closed = [];
	
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
		_pendingPaneStates = _state.windows.filter(x => x.type == 'pane');
		_initialized = true;
	};
	
	/**
	 * The saved main-window states that haven't been restored into a window yet
	 *
	 * The first main window opened while no other is open, at startup or after the last one
	 * was closed, restores the first of these and opens a window for each of the others.
	 *
	 * @return {Object[]}
	 */
	this.getPendingPaneStates = function () {
		return [..._pendingPaneStates];
	};
	
	/**
	 * Remove a pending state once its window saves its own state, or closes before it can
	 *
	 * @param {Object} state
	 */
	this.removePendingPaneState = function (state) {
		_pendingPaneStates = _pendingPaneStates.filter(x => x !== state);
	};
	
	/**
	 * Remember tabs closed together in a main window, for reopening
	 *
	 * @param {String} windowID - The window's Zotero_Tabs.windowID
	 * @param {Object[]} tabs - { index, data, title, type } entries
	 */
	this.addClosedTabs = function (windowID, tabs) {
		_closed.push({ windowID, tabs });
	};

	/**
	 * Remember a closed main window, for reopening
	 *
	 * @param {Object} state - As returned by ZoteroPane.getState()
	 */
	this.addClosedWindow = function (state) {
		_closed.push({ window: state });
	};

	/**
	 * The most recently closed tabs or window, as { windowID, tabs } or { window }
	 *
	 * @return {Object|null}
	 */
	this.getLastClosed = function () {
		return _closed[_closed.length - 1] || null;
	};

	/**
	 * Remove and return the most recently closed tabs or window, for reopening
	 *
	 * @return {Object|null}
	 */
	this.takeLastClosed = function () {
		return _closed.pop() || null;
	};

	this.setLastClosedZoteroPaneState = function (state) {
		// This is the last open main window, so any other saved pane states are stale
		_state.windows = _state.windows
			.filter(x => x.type != 'pane')
			.concat([state]);
		// Let the next window opened restore it
		_pendingPaneStates = [state];
	};

	/**
	 * Take the saved states of reader windows, which are reopened as main windows holding a
	 * reader tab
	 *
	 * @return {Object[]} - { itemID, title, secondViewState } entries
	 */
	this.takeReaderWindowStates = function () {
		let states = _state.windows.filter(x => x.type == 'reader');
		_state.windows = _state.windows.filter(x => x.type != 'reader');
		return states;
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
			// windows are opened in saved order, so the last-used window ends up on top.
			// Windows still restoring their saved states don't have their own yet, and
			// pending states stay in the session until they're restored.
			let panes = Zotero.getZoteroPanes()
				.sort((a, b) => a.lastActivated - b.lastActivated)
				.map(x => x.getState())
				.filter(Boolean);
			if (panes.length) {
				_state.windows = [..._pendingPaneStates, ...panes];
			}
			let sessionFile = OS.Path.join(Zotero.Profile.dir, SESSION_FILE_NAME);
			await Zotero.File.putContentsAsync(sessionFile, JSON.stringify(_state));
		}
		catch (e) {
			Zotero.logError(e);
		}
	});
};
