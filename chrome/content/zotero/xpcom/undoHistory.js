/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

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

/**
 * In-memory undo/redo stack for DataObject field changes.
 *
 * Hooks into DB transaction lifecycle to batch all saves within a single
 * executeTransaction() into one undo step. Only tracks modifications to
 * existing objects.
 *
 * Capture is opt-in via a two-call staging protocol within a transaction:
 *   - stageChange(record) -- append a change record to the pending entry
 *   - stageAction(action, args) -- attach an action label
 * Both must be called within the same transaction for the entry to land on
 * the undo stack. A transaction that stages changes without an action (or
 * vice versa, with no staged changes) is silently discarded at commit.
 * DataObject.save() calls stageChange unconditionally for non-isNew saves;
 * stageAction is opt-in via save({ undoAction, undoActionArgs }) or by an
 * outer caller invoking Zotero.UndoHistory.stageAction() directly inside
 * the transaction.
 */
Zotero.UndoHistory = {
	_undoStack: [],
	_redoStack: [],
	_pendingEntry: null,
	_maxSteps: 100,
	_opQueue: Promise.resolve(),

	init() {
		// default (100) when unset or non-numeric. 0 (or less) disables undo/redo entirely.
		let steps = Zotero.Prefs.get('undoHistory.steps');
		this._maxSteps = Number.isInteger(steps) ? steps : 100;
		this.clear();
	},

	/**
	 * @return {Boolean}
	 */
	isEnabled() {
		return this._maxSteps > 0;
	},

	clear() {
		this._undoStack = [];
		this._redoStack = [];
		this._pendingEntry = null;
	},

	/**
	 * Discard both stacks if any entry references the given library
	 * @param {Integer} libraryID
	 */
	clearForLibrary(libraryID) {
		let affectsLibrary = entry => entry.libraryID === libraryID
			|| entry.changes.some(change => change.libraryID === libraryID);
		if (this._undoStack.some(affectsLibrary) || this._redoStack.some(affectsLibrary)) {
			this.clear();
		}
	},

	/**
	 * Return a window controller for cmd_undo/cmd_redo that defers to
	 * native text-editing controllers when they are active.
	 * Caller should append it to window.controllers.
	 *
	 * @param {Document} doc
	 * @return {Object}
	 */
	getController(doc) {
		return {
			supportsCommand: cmd => cmd === 'cmd_undo' || cmd === 'cmd_redo',
			isCommandEnabled: (cmd) => {
				// Defer to native text-editing controllers when they can
				// handle undo/redo (e.g. focused input/textarea)
				if (this._hasNativeCommand(doc, cmd)) return false;
				if (cmd === 'cmd_undo') return this.canUndo();
				if (cmd === 'cmd_redo') return this.canRedo();
				return false;
			},
			doCommand: (cmd) => {
				if (cmd === 'cmd_undo') this.undo();
				else if (cmd === 'cmd_redo') this.redo();
			},
			onEvent: () => {}
		};
	},

	canUndo() {
		return this._undoStack.length > 0;
	},

	canRedo() {
		return this._redoStack.length > 0;
	},

	/**
	 * Run an undo/redo operation only after all previously queued ones have
	 * settled, so each step's staleness check sees the fully committed result
	 * of the step before it. Returns the operation's own result; a failure in
	 * one operation doesn't stall the queue for the next.
	 *
	 * @param {Function} fn -- async operation returning Promise<Boolean>
	 * @return {Promise<Boolean>}
	 */
	_enqueue(fn) {
		this._opQueue = this._opQueue.then(fn, fn);
		return this._opQueue;
	},

	/**
	 * Check whether the focused element has a native controller (e.g.
	 * text-editing) that supports undo/redo, meaning UndoHistory should defer.
	 * Checks the focused element's own controllers directly to avoid
	 * re-entrancy with the command dispatcher.
	 *
	 * @param {Document} doc
	 * @return {Boolean}
	 */
	hasNativeUndo(doc) {
		return this._hasNativeCommand(doc, 'cmd_undo');
	},

	hasNativeRedo(doc) {
		return this._hasNativeCommand(doc, 'cmd_redo');
	},

	_hasNativeCommand(doc, cmd) {
		// If focus is in a child window (e.g. note-editor or reader iframe),
		// it handles its own undo/redo internally
		let focusedWindow = doc.commandDispatcher.focusedWindow;
		if (focusedWindow && focusedWindow !== doc.defaultView) {
			return true;
		}
		let el = doc.commandDispatcher.focusedElement;
		if (!el) return false;
		// Iframes (note-editor, reader) handle their own undo/redo
		// internally but don't expose XUL controllers for it
		if (el.tagName === 'iframe' || el.tagName === 'IFRAME') return true;
		let controllers;
		try {
			controllers = el.controllers;
		}
		catch {
			return false;
		}
		if (!controllers) return false;
		for (let i = 0; i < controllers.getControllerCount(); i++) {
			let ctrl = controllers.getControllerAt(i);
			if (ctrl.supportsCommand(cmd)) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Undo the most recent change entry. Serialized through a queue.
	 *
	 * @return {Promise<Boolean>} -- true if an entry was undone
	 */
	undo() {
		return this._enqueue(() => this._undo());
	},

	_undo() {
		// Undo restores the 'old' snapshot; decline if a covered object no
		// longer holds the recorded 'new' value (an outside writer changed it).
		return this._apply({
			fromStack: '_undoStack',
			toStack: '_redoStack',
			staleSide: 'new',
			applySide: 'old',
			label: 'undo'
		});
	},

	/**
	 * Redo the most recently undone entry. Serialized through the same queue as undo()
	 *
	 * @return {Promise<Boolean>} -- true if an entry was redone
	 */
	redo() {
		return this._enqueue(() => this._redo());
	},

	_redo() {
		// Redo reapplies the 'new' snapshot; decline if a covered object no
		// longer holds the recorded 'old' value (mirrors the check in _undo).
		return this._apply({
			fromStack: '_redoStack',
			toStack: '_undoStack',
			staleSide: 'old',
			applySide: 'new',
			label: 'redo'
		});
	},

	/**
	 * Check a custom entry's current state against the recorded value for the
	 * given side, using the entry's comparator or strict equality.
	 *
	 * @param {Object} entry
	 * @param {String} side -- 'old' or 'new'
	 * @return {Promise<Boolean>}
	 */
	async _customStateMatches(entry, side) {
		let current = await entry.getState();
		let expected = entry.state[side];
		return entry.isEqual ? entry.isEqual(current, expected) : current === expected;
	},


	/**
	 * Pop the top entry off one stack, write back the recorded snapshot for the
	 * given side, and -- on success -- push it onto the opposite stack. Shared by
	 * _undo() (applySide 'old') and _redo() (applySide 'new').
	 *
	 * Staleness check and apply share one transaction. If an object no longer
	 * holds its `staleSide` value, an outside writer changed it, so we decline and
	 * discard history rather than clobber it; a mid-apply failure is likewise
	 * untrustworthy, so we realign memory with the rolled-back DB and discard.
	 *
	 * Custom entries (entry.custom) have no snapshot and run outside a DB
	 * transaction. Entries that declare state/getState get an equivalent
	 * staleness check: the current state must match the recorded `staleSide`
	 * value before the callback runs and the `applySide` value after it, or
	 * the entry is declined and history discarded.
	 *
	 * @param {Object} opts
	 * @param {String} opts.fromStack -- name of the stack to pop the entry from
	 * @param {String} opts.toStack -- name of the stack to push the entry to on success
	 * @param {String} opts.staleSide -- recorded side the object must still hold ('new'/'old')
	 * @param {String} opts.applySide -- recorded side to write back ('old'/'new')
	 * @param {String} opts.label -- 'undo' or 'redo', for debug logging
	 * @return {Promise<Boolean>} -- true if an entry was applied
	 */
	async _apply({ fromStack, toStack, staleSide, applySide, label }) {
		let entry = this[fromStack].pop();
		if (!entry) return false;
		// Custom entries carry their own callbacks and run outside a DB transaction
		if (entry.custom) {
			try {
				if (entry.getState && !(await this._customStateMatches(entry, staleSide))) {
					Zotero.debug(`UndoHistory: declining stale ${label} entry`);
					this.clear();
					return false;
				}
				await (applySide === 'old' ? entry.undo() : entry.redo());
				if (entry.getState && !(await this._customStateMatches(entry, applySide))) {
					Zotero.debug(`UndoHistory: ${label} did not produce the recorded state`);
					this.clear();
					return false;
				}
				this[toStack].push(entry);
				return true;
			}
			catch (e) {
				Zotero.debug(`UndoHistory: ${label} failed: ` + e);
				this.clear();
				return false;
			}
		}
		let stale = false;
		try {
			await Zotero.DB.executeTransaction(async () => {
				if (this._entryIsStale(entry, staleSide)) {
					stale = true;
					return;
				}
				for (let change of entry.changes) {
					let obj = this._getObject(change);
					if (!obj) continue;
					// Apply itemTypeID first so setType() migrates fields before
					// the type-specific fields are restored on the correct type
					if (change.fields.itemTypeID) {
						this._applyFieldValue(obj, 'itemTypeID', change.fields.itemTypeID[applySide]);
					}
					for (let [field, values] of Object.entries(change.fields)) {
						if (field === 'itemTypeID') continue;
						this._applyFieldValue(obj, field, values[applySide]);
					}
					await obj.save({ skipSelect: true, skipDateModifiedUpdate: change.skipDateModified });
				}
			});
			if (stale) {
				Zotero.debug(`UndoHistory: declining stale ${label} entry`);
				this.clear();
				return false;
			}
			this[toStack].push(entry);
			return true;
		}
		catch (e) {
			Zotero.debug(`UndoHistory: ${label} failed: ` + e);
			// Realign memory with the rolled-back DB before clearing history.
			await this._reloadEntryObjects(entry);
			// A failure means the object drifted out from under our snapshots,
			// so the rest of the stack can't be trusted either. Discard history
			// rather than risk applying stale values.
			this.clear();
			return false;
		}
	},
	// -- Transaction lifecycle callbacks --

	_onTransactionBegin(_id) {
		this._pendingEntry = null;
	},

	_onTransactionCommit(_id) {
		// Only push entries that staged both changes and an action;
		// anything else (orphan captures, action without changes) is dropped
		if (this._pendingEntry && this._pendingEntry.changes.length && this._pendingEntry.action) {
			this._undoStack.push(this._pendingEntry);
			this._redoStack = [];
			if (this._undoStack.length > this._maxSteps) {
				this._undoStack.splice(0, this._undoStack.length - this._maxSteps);
			}
		}
		this._pendingEntry = null;
	},

	_onTransactionRollback(_id) {
		this._pendingEntry = null;
	},

	/**
	 * Push a custom entry directly onto the undo stack. A custom entry carries
	 * its own undo/redo callbacks, which are responsible for the revert/replay
	 * themselves and may be async.
	 *
	 * An entry that also declares state/getState opts in to the same staleness
	 * protection snapshot entries get: undo/redo is declined (and history
	 * discarded) when the current state no longer matches the recorded value
	 * for the side being left, or when the replay fails to produce the
	 * recorded value for the side being applied.
	 *
	 * @param {Object} entry
	 * @param {Function} entry.undo -- reverts the action; awaited on undo
	 * @param {Function} entry.redo -- reapplies the action; awaited on redo
	 * @param {String} entry.action -- Fluent message ID for the action label
	 *        (e.g. 'undo-action-hide-collection')
	 * @param {Object} [entry.actionArgs] -- Fluent message arguments
	 * @param {Integer} [entry.libraryID] -- library the action affects, so
	 *        clearForLibrary() can discard the entry when that library is erased
	 * @param {Object} [entry.state] -- recorded state values, { old, new };
	 *        optional, but if provided, getState must be too
	 * @param {Function} [entry.getState] -- returns the current state; may be
	 *        async; optional, but if provided, state must be too
	 * @param {Function} [entry.isEqual] -- compares two state values, returning
	 *        true when they match; strict equality is used when omitted
	 */
	pushCustomEntry({ undo, redo, action, actionArgs, libraryID, state, getState, isEqual }) {
		if (!!state !== !!getState) {
			throw new Error("UndoHistory: custom entry must provide state and getState together");
		}
		if (!this.isEnabled()) {
			return;
		}

		let entry = {
			custom: true,
			changes: [],
			undo,
			redo,
			action,
			actionArgs: actionArgs || null,
			libraryID: libraryID ?? null,
			state: state ?? null,
			getState: getState ?? null,
			isEqual: isEqual ?? null
		};
		this._undoStack.push(entry);
		this._redoStack = [];
		if (this._undoStack.length > this._maxSteps) {
			this._undoStack.splice(0, this._undoStack.length - this._maxSteps);
		}
	},

	/**
	 * Stage an action label on the pending entry. Must be called inside a
	 * transaction. Together with one or more stageChange() calls in the same
	 * transaction, this is what makes the staged changes land on the undo
	 * stack at commit -- a transaction that doesn't call stageAction has its
	 * staged changes silently discarded.
	 *
	 * If called more than once in the same transaction, the last call wins.
	 *
	 * @param {String} action -- Fluent message ID (e.g. 'undo-action-add-tag')
	 * @param {Object} [actionArgs] -- Fluent message arguments (e.g. { count: 3 })
	 */
	stageAction(action, actionArgs) {
		if (!this.isEnabled()) {
			return;
		}
		Zotero.DB.requireTransaction();
		if (!this._pendingEntry) {
			this._pendingEntry = { changes: [], action: null, actionArgs: null };
		}
		this._pendingEntry.action = action;
		this._pendingEntry.actionArgs = actionArgs || null;
	},

	/**
	 * Get the action description for the top of the undo stack
	 *
	 * @return {{ action: String, actionArgs: Object }|null}
	 */
	getUndoAction() {
		let entry = this._undoStack[this._undoStack.length - 1];
		if (!entry || !entry.action) return null;
		return { action: entry.action, actionArgs: entry.actionArgs };
	},

	/**
	 * Get the action description for the top of the redo stack
	 *
	 * @return {{ action: String, actionArgs: Object }|null}
	 */
	getRedoAction() {
		let entry = this._redoStack[this._redoStack.length - 1];
		if (!entry || !entry.action) return null;
		return { action: entry.action, actionArgs: entry.actionArgs };
	},

	/**
	 * Stage a change record. Must be called inside a transaction; without
	 * a matching stageAction() in the same transaction, the record is
	 * discarded at commit.
	 *
	 * Records for the same (objectType, id) are coalesced field-by-field:
	 * first-write-wins for `old`, last-write-wins for `new`. This lets a
	 * loop that saves the same object multiple times produce one composite
	 * record spanning the whole transaction.
	 *
	 * @param {Object} changeRecord
	 */
	stageChange(changeRecord) {
		if (!this.isEnabled()) {
			return;
		}
		Zotero.DB.requireTransaction();
		if (!this._pendingEntry) {
			this._pendingEntry = { changes: [], action: null, actionArgs: null };
		}
		let existing = this._pendingEntry.changes.find(
			c => c.objectType === changeRecord.objectType && c.id === changeRecord.id);
		if (existing) {
			existing.skipDateModified = !!(existing.skipDateModified && changeRecord.skipDateModified);
			for (let [field, vals] of Object.entries(changeRecord.fields)) {
				if (existing.fields[field]) {
					existing.fields[field].new = vals.new;
				}
				else {
					existing.fields[field] = vals;
				}
			}
		}
		else {
			this._pendingEntry.changes.push(changeRecord);
		}
	},

	/**
	 * Realign in-memory state with the DB after a failed apply. The apply runs
	 * many saves in one transaction; if a later one throws, the transaction
	 * rolls back, but objects saved earlier already hold their reverted values
	 * in memory. Reload each covered object so memory matches the committed DB.
	 * Objects that no longer resolve (e.g. erased) or fail to reload are skipped.
	 *
	 * @param {Object} entry
	 */
	async _reloadEntryObjects(entry) {
		for (let change of entry.changes) {
			let obj = this._getObject(change);
			if (!obj) {
				continue;
			}
			try {
				await obj.reload(null, true);
			}
			catch (e) {
				Zotero.debug('UndoHistory: failed to reload object after apply failure: ' + e);
			}
		}
	},

	/**
	 * Resolve a change record to a live DataObject
	 *
	 * @param {Object} change
	 * @return {Zotero.DataObject|null}
	 */
	_getObject(change) {
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(change.objectType);
		return objectsClass ? objectsClass.get(change.id) : null;
	},

	/**
	 * Apply a value to the appropriate setter on an object
	 *
	 * @param {Zotero.DataObject} obj
	 * @param {String} field
	 * @param {*} value
	 */
	_applyFieldValue(obj, field, value) {
		if (field === 'deleted') {
			obj.deleted = value;
		}
		else if (field === 'name') {
			obj.name = value;
		}
		else if (field === 'parentKey') {
			// parentID setter routes through _setParentKey, which marks
			// `parentKey` in _previousData (not parentID)
			obj.parentKey = value;
		}
		else if (field === 'collections') {
			obj.setCollections(value);
		}
		else if (field === 'tags') {
			obj.setTags(value);
		}
		else if (field === 'note') {
			obj.setNote(value);
		}
		else if (field === 'creators') {
			// value is an object mapping orderIndex -> creator data (or empty object)
			let maxIndex = -1;
			for (let idx of Object.keys(value)) {
				let i = parseInt(idx);
				let creatorData = value[i];
				obj.setCreator(i, creatorData);
				if (i > maxIndex) maxIndex = i;
			}
			// Remove any creators beyond the restored set
			while (obj.hasCreatorAt(maxIndex + 1)) {
				obj.removeCreator(maxIndex + 1);
			}
		}
		else if (field === 'relations') {
			// value is a flat array of [predicate, object] pairs
			let relObj = {};
			for (let [predicate, object] of value) {
				if (!relObj[predicate]) relObj[predicate] = [];
				relObj[predicate].push(object);
			}
			obj.setRelations(relObj);
		}
		else if (field === 'itemTypeID') {
			obj.setType(value);
		}
		else if (obj instanceof Zotero.Item) {
			obj.setField(field, value);
		}
		else {
			obj[field] = value;
		}
	},

	/**
	 * Whether an object covered by the entry no longer holds the value we
	 * recorded for the given side ('new' for undo, 'old' for redo) -- meaning
	 * something outside this history changed it and replaying would clobber that
	 * change. Objects that no longer resolve (e.g. erased) are skipped.
	 *
	 * @param {Object} entry
	 * @param {String} side -- 'new' (undo) or 'old' (redo)
	 * @return {Boolean}
	 */
	_entryIsStale(entry, side) {
		for (let change of entry.changes) {
			let obj = this._getObject(change);
			if (!obj) {
				continue;
			}

			let matches;
			try {
				matches = obj.matchesUndoSnapshot(change.fields, side);
			}
			catch (e) {
				// Can't verify the snapshot, so we can't rule out an external change
				Zotero.debug('UndoHistory: could not verify snapshot for staleness; declining entry: ' + e);
				return true;
			}
			if (!matches) {
				return true;
			}
		}
		return false;
	}
};
