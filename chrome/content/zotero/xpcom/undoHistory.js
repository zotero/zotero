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
 */
Zotero.UndoHistory = {
	_undoStack: [],
	_redoStack: [],
	_pendingEntry: null,
	_maxSteps: 100,

	init() {
		this._maxSteps = Zotero.Prefs.get('undoHistory.steps') || 100;
		this.clear();
	},

	clear() {
		this._undoStack = [];
		this._redoStack = [];
		this._pendingEntry = null;
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
		let self = this;
		return {
			supportsCommand(cmd) {
				return cmd === 'cmd_undo' || cmd === 'cmd_redo';
			},
			isCommandEnabled(cmd) {
				// Defer to native text-editing controllers when they can
				// handle undo/redo (e.g. focused input/textarea)
				if (self._hasNativeCommand(doc, cmd)) return false;
				if (cmd === 'cmd_undo') return self.canUndo();
				if (cmd === 'cmd_redo') return self.canRedo();
				return false;
			},
			doCommand(cmd) {
				if (cmd === 'cmd_undo') self.undo();
				else if (cmd === 'cmd_redo') self.redo();
			},
			onEvent() {}
		};
	},

	canUndo() {
		return this._undoStack.length > 0;
	},

	canRedo() {
		return this._redoStack.length > 0;
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
	 * Undo the most recent change entry
	 *
	 * @return {Promise<Boolean>} -- true if an entry was undone
	 */
	async undo() {
		let entry = this._undoStack.pop();
		if (!entry) return false;
		try {
			await Zotero.DB.executeTransaction(async () => {
				for (let change of entry.changes) {
					let obj = this._getObject(change);
					if (!obj) continue;
					// Apply itemTypeID first so type-specific fields
					// can be restored on the correct item type
					if (change.fields.itemTypeID) {
						this._applyFieldValue(obj, 'itemTypeID', change.fields.itemTypeID.old);
					}
					for (let [field, { old }] of Object.entries(change.fields)) {
						if (field === 'itemTypeID') continue;
						this._applyFieldValue(obj, field, old);
					}
					await obj.save({ skipUndo: true, skipSelect: true });
				}
			});
			this._redoStack.push(entry);
		}
		catch (e) {
			Zotero.logError('UndoHistory: undo failed: ' + e);
			// Entry is lost -- don't push to redo
		}
		return true;
	},

	/**
	 * Redo the most recently undone entry
	 *
	 * @return {Promise<Boolean>} -- true if an entry was redone
	 */
	async redo() {
		let entry = this._redoStack.pop();
		if (!entry) return false;
		try {
			await Zotero.DB.executeTransaction(async () => {
				for (let change of entry.changes) {
					let obj = this._getObject(change);
					if (!obj) continue;
					// Apply itemTypeID first so setType() handles
					// field migration before individual fields are set
					if (change.fields.itemTypeID) {
						this._applyFieldValue(obj, 'itemTypeID', change.fields.itemTypeID.new);
					}
					for (let [field, values] of Object.entries(change.fields)) {
						if (field === 'itemTypeID') continue;
						this._applyFieldValue(obj, field, values.new);
					}
					await obj.save({ skipUndo: true, skipSelect: true });
				}
			});
			this._undoStack.push(entry);
		}
		catch (e) {
			Zotero.logError('UndoHistory: redo failed: ' + e);
			// Entry is lost -- don't push to undo
		}
		return true;
	},

	// -- Transaction lifecycle callbacks --

	_onTransactionBegin(_id) {
		this._pendingEntry = null;
	},

	_onTransactionCommit(_id) {
		if (this._pendingEntry && this._pendingEntry.changes.length) {
			// Auto-infer action if none was explicitly set
			if (!this._pendingEntry.action) {
				let inferred = this._inferAction(this._pendingEntry);
				this._pendingEntry.action = inferred.action;
				this._pendingEntry.actionArgs = inferred.actionArgs;
			}
			this._undoStack.push(this._pendingEntry);
			this._redoStack = [];
			// Trim to max steps
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
	 * Set an explicit action description on the pending entry.
	 * Call inside a transaction to override auto-inference.
	 *
	 * @param {String} action -- Fluent message ID (e.g. 'undo-action-add-tag')
	 * @param {Object} [actionArgs] -- Fluent message arguments (e.g. { count: 3 })
	 */
	setAction(action, actionArgs) {
		if (this._pendingEntry) {
			this._pendingEntry.action = action;
			this._pendingEntry.actionArgs = actionArgs || null;
		}
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
	 * Infer an action description from an entry's change records.
	 *
	 * @param {Object} entry
	 * @return {{ action: String, actionArgs: Object }}
	 */
	_inferAction(entry) {
		let changes = entry.changes;
		let count = changes.length;

		// Check fields across all changes to determine the action
		let hasDeleted = false;
		let hasCollections = false;
		let hasTags = false;
		let hasCreators = false;
		let hasNote = false;
		let hasName = false;
		let hasParentID = false;
		let isTrash = false;
		let isAddToCollection = false;
		let isAddTag = false;
		let isChangeTag = false;
		let isAddCreator = false;
		let isRemoveCreator = false;
		let hasRelations = false;
		let isAddRelation = false;
		let objectTypes = new Set();

		for (let change of changes) {
			objectTypes.add(change.objectType);
			let fields = Object.keys(change.fields);
			for (let field of fields) {
				if (field === 'deleted') {
					hasDeleted = true;
					// Check if trashing or restoring
					if (change.fields.deleted.new) {
						isTrash = true;
					}
				}
				else if (field === 'collections') {
					hasCollections = true;
					let oldCols = change.fields.collections.old || [];
					let newCols = change.fields.collections.new || [];
					if (newCols.length > oldCols.length) {
						isAddToCollection = true;
					}
				}
				else if (field === 'tags') {
					hasTags = true;
					let oldTags = change.fields.tags.old || [];
					let newTags = change.fields.tags.new || [];
					if (newTags.length > oldTags.length) {
						isAddTag = true;
					}
					else if (newTags.length === oldTags.length) {
						isChangeTag = true;
					}
				}
				else if (field === 'creators') {
					hasCreators = true;
					let oldCreators = change.fields.creators.old || {};
					let newCreators = change.fields.creators.new || {};
					let oldCount = Object.keys(oldCreators).length;
					let newCount = Object.keys(newCreators).length;
					if (newCount > oldCount) {
						isAddCreator = true;
					}
					else if (newCount < oldCount) {
						isRemoveCreator = true;
					}
				}
				else if (field === 'relations') {
					hasRelations = true;
					let oldRels = change.fields.relations.old || [];
					let newRels = change.fields.relations.new || [];
					if (newRels.length > oldRels.length) {
						isAddRelation = true;
					}
				}
				else if (field === 'note') {
					hasNote = true;
				}
				else if (field === 'name') {
					hasName = true;
				}
				else if (field === 'parentID') {
					hasParentID = true;
				}
			}
		}

		// Priority: deleted > collections > tags > name > parentID > generic edit
		if (hasDeleted) {
			if (isTrash) {
				if (objectTypes.has('collection')) {
					return { action: 'undo-action-trash-collection', actionArgs: { count } };
				}
				return { action: 'undo-action-trash', actionArgs: { count } };
			}
			if (objectTypes.has('collection')) {
				return { action: 'undo-action-restore-collection', actionArgs: { count } };
			}
			return { action: 'undo-action-restore', actionArgs: { count } };
		}

		if (hasCollections) {
			if (isAddToCollection) {
				return { action: 'undo-action-add-to-collection', actionArgs: { count } };
			}
			return { action: 'undo-action-remove-from-collection', actionArgs: { count } };
		}

		if (hasTags) {
			if (isAddTag) {
				return { action: 'undo-action-add-tag', actionArgs: null };
			}
			if (isChangeTag) {
				return { action: 'undo-action-change-tag', actionArgs: null };
			}
			return { action: 'undo-action-remove-tag', actionArgs: null };
		}

		if (hasCreators) {
			if (isAddCreator) {
				return { action: 'undo-action-add-creator', actionArgs: null };
			}
			if (isRemoveCreator) {
				return { action: 'undo-action-remove-creator', actionArgs: null };
			}
			return { action: 'undo-action-edit-creator', actionArgs: null };
		}

		if (hasRelations) {
			if (isAddRelation) {
				return { action: 'undo-action-add-related', actionArgs: null };
			}
			return { action: 'undo-action-remove-related', actionArgs: null };
		}

		if (hasNote) {
			return { action: 'undo-action-edit-note', actionArgs: null };
		}

		if (hasName) {
			if (objectTypes.has('collection')) {
				return { action: 'undo-action-rename-collection', actionArgs: null };
			}
			if (objectTypes.has('search')) {
				return { action: 'undo-action-rename-search', actionArgs: null };
			}
		}

		if (hasParentID) {
			if (objectTypes.has('collection')) {
				return { action: 'undo-action-move-collection', actionArgs: null };
			}
			return { action: 'undo-action-move-item', actionArgs: { count } };
		}

		// Default: generic metadata edit for items
		return { action: 'undo-action-edit-metadata', actionArgs: { count } };
	},

	/**
	 * Add a change record to the pending transaction entry.
	 * Called from DataObject.save() during the transaction.
	 *
	 * @param {Object} changeRecord
	 */
	_addChange(changeRecord) {
		if (!this._pendingEntry) {
			// Save happened outside an explicit transaction (saveTx creates its own).
			// Create a standalone entry that will be committed when the tx callback fires.
			this._pendingEntry = { changes: [], action: null, actionArgs: null };
		}
		this._pendingEntry.changes.push(changeRecord);
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
		else if (field === 'parentID') {
			obj.parentID = value;
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
	}
};
