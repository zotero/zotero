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
 *
 * Components that maintain their own history of undoable changes participate
 * via registerProvider() and setProviderSteps(). Their steps are interleaved
 * with the entries captured here. Providers are responsible for
 * undoing/reapplying their changes themselves.
 */
Zotero.UndoHistory = {
	_undoStack: [],
	_redoStack: [],
	_pendingEntry: null,
	_maxSteps: 100,
	_opQueue: Promise.resolve(),
	_providers: new Map(),

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
	 * Discard both stacks if any entry references an object in the given library.
	 * @param {Integer} libraryID
	 */
	clearForLibrary(libraryID) {
		let affectsLibrary = entry => (entry.providerID
			? entry.libraryID === libraryID
			: entry.changes.some(change => change.libraryID === libraryID));
		if (this._undoStack.some(affectsLibrary) || this._redoStack.some(affectsLibrary)) {
			this.clear();
		}
	},

	/**
	 * Register a component that keeps its own history of undoable changes and
	 * wants those changes to take part in the app-wide undo/redo commands.
	 *
	 * The provider reports its history with setProviderSteps() and does the
	 * actual work in undo() and redo(), each of which steps the provider's
	 * own history by one and returns whether it did so.
	 *
	 * @param {String} providerID
	 * @param {Object} options
	 * @param {Integer} options.libraryID Library the provider's changes belong to
	 * @param {Function} options.undo () => boolean | Promise<boolean>
	 * @param {Function} options.redo () => boolean | Promise<boolean>
	 * @param {Function} [options.reveal] Bring the provider into view after a step
	 * @param {Window} [options.window] Frame the provider's changes are made in,
	 *     which therefore shouldn't be left to handle undo/redo itself
	 */
	registerProvider(providerID, { libraryID, undo, redo, reveal, window }) {
		this._providers.set(providerID,
			{ libraryID, undo, redo, reveal, window, seenSteps: new Map() });
	},

	/**
	 * Unregister a provider and discard its entries, since nothing can apply
	 * them anymore
	 *
	 * @param {String} providerID
	 */
	unregisterProvider(providerID) {
		if (this._providers.delete(providerID)) {
			this._filterEntries(entry => entry.providerID !== providerID);
		}
	},

	/**
	 * Bring a provider's entries in line with the provider's own history.
	 *
	 * Steps are ordered oldest first and identified by an ID that increases
	 * monotonically, plus a revision that changes when a step absorbs a later
	 * change (e.g., continued typing in an annotation comment). Steps the
	 * provider no longer has are dropped. A step we haven't seen, or one whose
	 * revision changed since we last saw it, covers a new change, so it goes
	 * to the top of the undo stack. A step reported with a revision we've
	 * already seen is left alone, so entries discarded in the meantime (e.g.
	 * by a clear()) aren't brought back.
	 *
	 * @param {String} providerID
	 * @param {Object} history
	 * @param {{ id, revision, action, actionArgs }[]} history.undoSteps
	 * @param {{ id, revision, action, actionArgs }[]} history.redoSteps
	 */
	setProviderSteps(providerID, { undoSteps = [], redoSteps = [] }) {
		let provider = this._providers.get(providerID);
		if (!provider || !this.isEnabled()) {
			return;
		}
		let steps = [...undoSteps, ...redoSteps];
		let stepIDs = new Set(steps.map(step => step.id));
		this._filterEntries(
			entry => entry.providerID !== providerID || stepIDs.has(entry.stepID)
		);
		let changed = false;
		for (let step of undoSteps) {
			if (provider.seenSteps.get(step.id) === step.revision) {
				continue;
			}
			let index = this._undoStack.findIndex(
				entry => entry.providerID === providerID && entry.stepID === step.id);
			if (index === -1) {
				this._undoStack.push({
					providerID,
					stepID: step.id,
					libraryID: provider.libraryID,
					action: step.action,
					actionArgs: step.actionArgs || null
				});
			}
			else {
				this._undoStack.push(...this._undoStack.splice(index, 1));
			}
			changed = true;
		}
		provider.seenSteps = new Map(steps.map(step => [step.id, step.revision]));
		if (changed) {
			// Any new change invalidates redo, including one absorbed into a
			// step we already had an entry for
			this._redoStack = [];
			this._trimUndoStack();
		}
	},

	_filterEntries(keep) {
		this._undoStack = this._undoStack.filter(keep);
		this._redoStack = this._redoStack.filter(keep);
	},

	/**
	 * Bring the context a change was made in back into view, so the user can see
	 * what an undo or redo did. Providers know how to reveal themselves; for
	 * entries we manage, focus the tab where the change was made.
	 *
	 * @param {Object} entry
	 */
	_revealEntry(entry) {
		try {
			if (entry.providerID) {
				let provider = this._providers.get(entry.providerID);
				if (provider && provider.reveal) {
					provider.reveal();
				}
				return;
			}
			this._revealTab(entry.tabID);
		}
		catch (e) {
			// A change that can't be revealed has still been applied
			Zotero.logError(e);
		}
	},

	/**
	 * Select a tab in the main window, bringing the window itself forward if
	 * it's not the one in front (e.g. when undoing from a reader window)
	 *
	 * @param {String} tabID
	 */
	_revealTab(tabID) {
		let win = Zotero.getMainWindow();
		// The tab may have been closed since the change was made
		if (!tabID || !win?.Zotero_Tabs?._getTab(tabID).tab) {
			return;
		}
		win.Zotero_Tabs.select(tabID);
		if (Services.focus.activeWindow !== win) {
			win.focus();
		}
	},

	_getSelectedTabID() {
		return Zotero.getMainWindow()?.Zotero_Tabs?.selectedID || null;
	},

	_trimUndoStack() {
		if (this._undoStack.length > this._maxSteps) {
			this._undoStack.splice(0, this._undoStack.length - this._maxSteps);
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
		// If focus is in a child frame, it handles its own undo/redo internally
		// (e.g. the note editor)... unless it has a provider here, in which case
		// its changes are ours to undo and only text editing within it wins
		let focusedWindow = doc.commandDispatcher.focusedWindow;
		if (focusedWindow && focusedWindow !== doc.defaultView) {
			if (!this._getProviderForWindow(focusedWindow)) {
				return true;
			}
			return this._isTextBoxFocused(focusedWindow, cmd);
		}
		let el = doc.commandDispatcher.focusedElement;
		if (!el) return false;
		if (['iframe', 'browser'].includes(el.localName)
				&& !this._getProviderForWindow(el.contentWindow)) {
			return true;
		}
		return this._elementSupportsCommand(el, cmd);
	},

	/**
	 * @param {Element} el
	 * @param {String} cmd
	 * @return {Boolean}
	 */
	_elementSupportsCommand(el, cmd) {
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
	 * The provider that records the changes made in a given frame, if any
	 *
	 * @param {Window} win
	 * @return {Object|undefined}
	 */
	_getProviderForWindow(win) {
		// Collect the frame and its ancestors, since focus may be in a frame
		// nested inside the provider's own (e.g., a reader's view iframe)
		let frames = [];
		for (; win && !frames.includes(win); win = win.parent) {
			frames.push(win);
		}
		for (let provider of this._providers.values()) {
			if (provider.window && frames.includes(provider.window)) {
				return provider;
			}
		}
		return undefined;
	},

	/**
	 * Whether the focused element in a frame is a text box, meaning native text
	 * editing owns undo/redo for it
	 *
	 * @param {Window} win
	 * @param {String} cmd
	 * @return {Boolean}
	 */
	_isTextBoxFocused(win, cmd) {
		let el = win.document.activeElement;
		if (!el) {
			return false;
		}
		// A contenteditable's undo/redo is handled by an editing controller on
		// the window rather than one of its own
		return el.isContentEditable || this._elementSupportsCommand(el, cmd);
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
	 * Pop the top entry off one stack, write back the recorded snapshot for the
	 * given side, and -- on success -- push the entry onto the opposite stack.
	 * Shared implementation behind _undo() (applySide 'old') and _redo()
	 * (applySide 'new').
	 *
	 * The staleness check and the apply share one transaction so they're atomic.
	 * If any object no longer holds its recorded `staleSide` value, an outside
	 * writer changed it and replaying would clobber that change, so we decline
	 * and discard history. A mid-apply failure is likewise untrustworthy, so we
	 * realign memory with the rolled-back DB and discard.
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
		if (entry.providerID) {
			return this._applyProviderEntry(entry, { toStack, label });
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
			this._revealEntry(entry);
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

	/**
	 * Hand an entry back to the provider that recorded it. The provider holds
	 * the snapshots and does its own staleness checking, so all that's left
	 * here is to step it and move the entry to the opposite stack.
	 *
	 * A provider that declines (or is gone) is out of step with us, so we drop
	 * the rest of its entries rather than risk applying them out of order.
	 * Entries captured here are self-contained, so the stacks are otherwise
	 * left alone.
	 *
	 * @param {Object} entry
	 * @param {Object} opts
	 * @param {String} opts.toStack -- name of the stack to push the entry to on success
	 * @param {String} opts.label -- 'undo' or 'redo'
	 * @return {Promise<Boolean>} -- true if the entry was applied
	 */
	async _applyProviderEntry(entry, { toStack, label }) {
		let provider = this._providers.get(entry.providerID);
		let applied = false;
		try {
			if (provider) {
				applied = !!(await (label === 'undo' ? provider.undo() : provider.redo()));
			}
		}
		catch (e) {
			Zotero.debug(`UndoHistory: ${label} failed for provider ${entry.providerID}: ` + e);
		}
		if (!applied) {
			Zotero.debug(`UndoHistory: declining ${label} entry for provider ${entry.providerID}`);
			this._filterEntries(other => other.providerID !== entry.providerID);
			return false;
		}
		this[toStack].push(entry);
		this._revealEntry(entry);
		return true;
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
			this._trimUndoStack();
		}
		this._pendingEntry = null;
	},

	_onTransactionRollback(_id) {
		this._pendingEntry = null;
	},

	/**
	 * The entry being staged by the current transaction, created on first use.
	 * It records the tab the change is being made in, so that undoing it later
	 * from somewhere else can bring the user back.
	 *
	 * @return {Object}
	 */
	_ensurePendingEntry() {
		if (!this._pendingEntry) {
			this._pendingEntry = {
				changes: [],
				action: null,
				actionArgs: null,
				tabID: this._getSelectedTabID()
			};
		}
		return this._pendingEntry;
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
		let entry = this._ensurePendingEntry();
		entry.action = action;
		entry.actionArgs = actionArgs || null;
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
	 * Update the Undo/Redo items in a window's Edit menu to name the action
	 * they would apply (e.g. "Undo Add Tag")
	 *
	 * @param {Document} doc
	 */
	updateMenuItems(doc) {
		// When a native text-editing controller handles undo/redo (e.g. focused
		// input), show generic labels and let it take over
		this._updateMenuItem(doc, 'menu_undo', 'text-action-undo', 'menu-edit-undo-action',
			!this.hasNativeUndo(doc) && this.getUndoAction());
		this._updateMenuItem(doc, 'menu_redo', 'text-action-redo', 'menu-edit-redo-action',
			!this.hasNativeRedo(doc) && this.getRedoAction());
	},

	_updateMenuItem(doc, id, genericMessageID, actionMessageID, action) {
		let menuitem = doc.getElementById(id);
		if (!menuitem) {
			return;
		}
		if (action) {
			let actionLabel = Zotero.ftl.formatValueSync(
				action.action, action.actionArgs || undefined
			);
			menuitem.removeAttribute('data-l10n-id');
			menuitem.setAttribute('label', Zotero.ftl.formatValueSync(
				actionMessageID, { action: actionLabel }
			));
		}
		else {
			doc.l10n.setAttributes(menuitem, genericMessageID);
		}
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
		this._ensurePendingEntry();
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
