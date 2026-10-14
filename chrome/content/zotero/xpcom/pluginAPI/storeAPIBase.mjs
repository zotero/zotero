/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 Corporation for Digital Scholarship
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
 * @typedef {object} StoreAPIConfig
 * @property {string} apiName - Log prefix and error namespace
 * @property {Record<string, ControllerRequestDef>} [queries] - Read-only requests, as on a controller. Every
 *     store also gets `validate`, which dry-runs a change set, unless it defines its own
 * @property {Record<string, StoreObjectTypeDef>} objectTypes - What a change set can address, by type name
 * @property {string | string[]} [permissions] - What every commit requires; a type or operation can add to it
 * @property {(fn: () => Promise<void>) => Promise<void>} [transaction]
 *     - Runs the transactional entries of a commit; defaults to calling fn directly
 *
 *
 * @typedef {object} StoreObjectTypeDef
 * @property {string | string[]} [permissions] - Required on top of the store's for every entry of this type
 * @property {boolean} [transactional] - Whether entries run inside the store transaction (default true); the
 *     others run after it, in order, not atomically, and a failure among them leaves the earlier ones applied
 * @property {(id: number, ctx: StoreCommitContext) => (object | null | Promise<object | null>)} resolve
 *     - The live object for an ID, or null
 * @property {StoreAddressDef} address - How an entry or a reference names an existing object of this type;
 *     the store decides what an address looks like, the base only passes it through
 * @property {StoreCreateDef} [create] - How a new object is made; absent means the type cannot be created
 * @property {(target: object) => (string | number)} [revision] - The token an entry's `revision` is compared against
 * @property {(target: object) => boolean} [isEditable] - false fails the entry with NotAllowed
 * @property {(target: object, ctx: StoreCommitContext) => Promise<void>} [save] - Persist the target after its
 *     operations; also called before the first operation flagged `needsID` on a created target
 * @property {(target: object) => Promise<void>} [restore] - Drop in-memory changes after a failed commit
 * @property {(target: object) => object} describe - The result entry for a target, at least `{ id }`
 * @property {(target: object) => object} [snapshot] - For the `snapshots` commit option
 * @property {Record<string, StoreOperationDef>} operations
 *
 *
 * @typedef {object} StoreAddressDef
 * @property {string[]} fields - The entry keys that name an existing object, refused alongside `create`
 * @property {(entry: object, defaults: object, fail: StoreFail) => object} plan - The address an entry names,
 *     in any shape `resolve` understands; nothing is loaded yet
 * @property {(address: object, fail: StoreFail) => any} resolve - The id `StoreObjectTypeDef.resolve` takes
 * @property {(value: any, options: { defaults: object, scope?: any, type: string, what: string }, fail: StoreFail) => any} fromValue
 *     - The id an operation param names; the base has already handled `{ ref }`
 *
 *
 * @typedef {object} StoreFail
 * @property {(message: string) => never} invalid - Throw InvalidParams, located at the caller
 * @property {(message: string) => never} notFound - Throw NotFound, located at the caller
 *
 *
 * @typedef {object} StoreCreateDef
 * @property {Record<string, PluginAPIOptDefValue>} [params]
 * @property {(params: object, ctx: StoreCommitContext) => (object | Promise<object>)} handler - The new, unsaved target
 *
 *
 * @typedef {object} StoreOperationDef
 * @property {string | string[]} [permissions] - Required on top of the store's and the type's
 * @property {Record<string, PluginAPIOptDefValue>} [params] - Everything in the operation but `op`; unknown keys are rejected
 * @property {boolean} [terminal] - The target no longer exists afterwards (erase): no save, no later operation
 * @property {boolean} [needsID] - A created target must be saved before this runs
 * @property {(target: object, params: object, ctx: StoreCommitContext) => (string | undefined | Promise<string | undefined>)} [check]
 *     - A reason the operation cannot apply, checked before anything changes; must not resolve refs
 * @property {(target: object, params: object, ctx: StoreCommitContext) => (void | Promise<void>)} apply
 *
 *
 * @typedef {object} StoreCommitContext
 * @property {string} [pluginID] - The calling plugin; unset for chrome
 * @property {boolean} privileged
 * @property {object} defaults - Every change set key but `changes`, for the object types to read
 * @property {Map<string, { type: string, target: object }>} refs - Objects created so far, by ref
 * @property {(type: string, value: StoreIDRef, options?: { scope?: *, what?: string }) => *} resolveID
 *     - The ID an operation names: a `{ ref }` resolves here, anything else through the type's
 *     `address.fromValue`, with `scope` as the object being edited
 *
 *
 * How an operation names another object: one this set creates, or any form the type's address accepts
 * @typedef {{ ref: string } | *} StoreIDRef
 *
 *
 * Entries apply in order, each to one object, and every key besides `changes` is a default the object
 * types read. A single entry stands for a one-entry set
 * @typedef {object} StoreChangeSet
 * @property {StoreChangeEntry[]} changes
 *
 *
 * `create` makes an object later entries reach as `{ ref }`; otherwise the type's `address.fields` name
 * an existing one
 * @typedef {object} StoreChangeEntry
 * @property {string} type - One of the store's object types
 * @property {string} [ref] - Required with `create`; unique within the change set
 * @property {object} [create] - The type's create params
 * @property {string | number} [revision] - The snapshot revision the entry was built from; a mismatch fails
 *     the whole commit with Conflict before anything is applied
 * @property {StoreOperation[]} ops
 *
 *
 * @typedef {{ op: string } & Record<string, any>} StoreOperation
 *
 *
 * @typedef {object} StoreCommitResult
 * @property {StoreObjectRef[]} objects - One per entry, in order
 *
 *
 * What the type's `describe` returns for the target, plus the store's bookkeeping
 * @typedef {object} StoreObjectRef
 * @property {string} type
 * @property {*} id
 * @property {string} [ref] - The entry's ref, for created objects
 * @property {string | number} [revision] - Absent for erased objects and types without revisions
 * @property {boolean} [erased]
 * @property {object} [snapshot] - With the `snapshots` commit option, for objects that still exist
 *
 *
 * @typedef {object} StoreIssue
 * @property {string} code - One of StoreAPIBase.errorCodes
 * @property {string} message
 * @property {StoreConflict[]} [conflicts] - For a Conflict issue
 *
 *
 * @typedef {object} StoreConflict
 * @property {number} index - The entry's position in `changes`
 * @property {string} type
 * @property {number} id
 * @property {string | number} expected
 * @property {string | number} current
 */


import { ControllerAPIBase } from "chrome://zotero/content/xpcom/pluginAPI/controllerAPIBase.mjs";
import { ControllerError } from "chrome://zotero/content/xpcom/plugins/apiErrors.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
	VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
});


/**
 * Store-style API: plugins read snapshots through queries, describe changes locally as a change set, and
 * commit it once; the store checks the whole set, then applies it to the live objects in one transaction
 */
class StoreAPIBase extends ControllerAPIBase {
	_config = {
		apiName: "StoreAPIBase",
		permissions: [],
		transaction: fn => fn(),
	};

	/**
	 * The controller codes plus the one outcome only a commit has
	 */
	static errorCodes = Object.freeze({
		...ControllerAPIBase.errorCodes,
		// An entry's revision no longer matches its object; nothing was applied
		CONFLICT: "Conflict",
	});

	static COMMIT_OPTIONS = Object.freeze({
		snapshots: { type: "boolean", optional: true },
	});

	/**
	 * @type {Map<string, StoreObjectTypeDef>}
	 */
	_objectTypes = new Map();

	/**
	 * Queries are defined as on a controller, plus `validate` unless the store defines one; object types
	 * under `objectTypes`. Commands are refused: every write is an operation in a change set
	 * @param {StoreAPIConfig} config
	 */
	set config(config) {
		let { objectTypes = {}, commands, ...rest } = config;
		if (commands) {
			throw new Error(`${rest.apiName || this._config.apiName}: a store has no commands; writes are change set operations`);
		}
		super.config = rest;
		if (!this._queries.has("validate")) {
			this._define(this._queries, "validate", {
				params: { changes: "object" },
				handler: ({ changes }, { caller }) => this._validate(changes, caller),
			});
		}
		for (let [type, def] of Object.entries(objectTypes)) {
			this._defineObjectType(type, def);
		}
	}

	/**
	 * @returns {Record<string, string[]>} Operation names by object type, for feature detection
	 */
	get operationNames() {
		let names = {};
		for (let [type, def] of this._objectTypes) {
			names[type] = Object.keys(def.operations);
		}
		return names;
	}

	/**
	 * Apply a change set
	 * @param {StoreChangeSet | { toPlain: () => StoreChangeSet }} changes - A change set builder or its JSON
	 * @param {{ snapshots?: boolean }} [options]
	 * @param {string} [callerPluginID] - Injected for sandbox callers; omitted by chrome
	 * @returns {Promise<ControllerResponse<StoreCommitResult>>}
	 */
	commit(changes, options = {}, callerPluginID) {
		return this._respond(() => this._commit(changes, options, callerPluginID), callerPluginID, "commit");
	}

	_defineObjectType(type, def) {
		let { apiName } = this._config;
		if (this._objectTypes.has(type)) {
			throw new Error(`${apiName}: object type '${type}' is already defined`);
		}
		if (typeof def.resolve !== "function" || typeof def.describe !== "function") {
			throw new Error(`${apiName}: object type '${type}' needs resolve and describe`);
		}
		for (let hook of ["plan", "resolve", "fromValue"]) {
			if (typeof def.address?.[hook] !== "function") {
				throw new Error(`${apiName}: object type '${type}' needs address.${hook}`);
			}
		}
		let operations = {};
		for (let [name, op] of Object.entries(def.operations || {})) {
			if (typeof op.apply !== "function") {
				throw new Error(`${apiName}: operation '${type}.${name}' has no apply`);
			}
			operations[name] = Object.assign({ permissions: [], params: {} }, op);
		}
		this._objectTypes.set(type, Object.assign({ permissions: [], transactional: true }, def, { operations }));
	}

	async _commit(changes, options, callerPluginID) {
		let context = this._getContext(callerPluginID);
		// A builder serializes through its toPlain, bytes kept
		let params = this._toPlainParams("commit", { changes, options });
		let validatedOptions = this._validateParams(params.options || {}, StoreAPIBase.COMMIT_OPTIONS);
		if (!validatedOptions.valid) {
			this._throw(StoreAPIBase.errorCodes.INVALID_PARAMS, `Invalid commit options: ${validatedOptions.reason}`);
		}
		let { entries, defaults } = this._plan(params.changes, context);
		let ctx = this._createCommitContext(context, defaults);

		let transactional = entries.filter(entry => entry.def.transactional);
		let deferred = entries.filter(entry => !entry.def.transactional);
		// What survives a failure: entries applied outside the store transaction, or inside one that
		// committed before a later entry threw
		let applied = [];
		let failed;
		let run = async (toRun) => {
			for (let entry of toRun) {
				try {
					await this._applyEntry(entry, ctx);
				}
				catch (e) {
					failed = entry;
					throw e;
				}
				applied.push(entry);
			}
		};
		let applying = false;
		try {
			// Revisions are compared inside the transaction, so no other commit can save between the check
			// and the apply
			if (transactional.length) {
				await this._config.transaction(async () => {
					await this._resolve(entries, ctx);
					applying = true;
					await run(transactional);
				});
			}
			else {
				await this._resolve(entries, ctx);
			}
		}
		catch (e) {
			// The transaction rolled back; the live objects may still hold the changes
			if (applying) {
				await this._restore(transactional);
				applied.length = 0;
			}
			throw this._withProgress(e, entries, applied, failed);
		}
		// Types that manage their own transactions apply after the store's, in order
		try {
			await run(deferred);
		}
		catch (e) {
			throw this._withProgress(e, entries, applied, failed);
		}
		return this._describe(entries, validatedOptions.obj.snapshots);
	}

	/**
	 * Check the set before anything is loaded: addressing, operations, params, refs and permissions
	 * @param {StoreChangeSet | StoreChangeEntry} changeSet
	 * @param {ControllerCaller} context
	 * @returns {{ entries: object[], defaults: object }} The planned entries, in order, and every key of
	 *     the set but `changes`
	 */
	_plan(changeSet, context) {
		let { INVALID_PARAMS, PERMISSION_DENIED } = StoreAPIBase.errorCodes;
		let isObject = lazy.VarCheck.isObject;
		// A single entry stands for a one-entry set
		if (isObject(changeSet) && !Array.isArray(changeSet.changes) && typeof changeSet.type === "string") {
			changeSet = { changes: [changeSet] };
		}
		if (!isObject(changeSet) || !Array.isArray(changeSet.changes)) {
			this._throw(INVALID_PARAMS, "A change set must be an object with a 'changes' array");
		}
		// Everything but `changes` is a default the object types interpret; the base passes it through
		let { changes: _changes, ...defaults } = changeSet;
		let requirePermissions = (permissions, what) => {
			if (!context.privileged && !lazy.VarCheck.hasPermissions(context.scope, permissions)) {
				this._throw(PERMISSION_DENIED, `${what} requires permission ${[].concat(permissions).join(", ")}`);
			}
		};
		requirePermissions(this._config.permissions, "commit");

		let refs = new Set();
		let entries = changeSet.changes.map((entry, index) => {
			let at = `changes[${index}]`;
			if (!isObject(entry)) {
				this._throw(INVALID_PARAMS, `${at} must be an object`);
			}
			let def = this._objectTypes.get(entry.type);
			if (!def) {
				this._throw(INVALID_PARAMS, `${at}.type must be one of ${[...this._objectTypes.keys()].join(", ")}, got ${entry.type}`);
			}
			requirePermissions(def.permissions, `${at} (${entry.type})`);

			let planned = { index, type: entry.type, def, ops: [] };
			if (entry.create !== undefined) {
				if (!def.create) {
					this._throw(INVALID_PARAMS, `${at}: ${entry.type} objects cannot be created`);
				}
				if (def.address.fields.some(field => entry[field] !== undefined)) {
					this._throw(INVALID_PARAMS, `${at} cannot address an existing object and create one`);
				}
				if (typeof entry.ref !== "string" || !entry.ref) {
					this._throw(INVALID_PARAMS, `${at}.ref must be a non-empty string for a created object`);
				}
				if (refs.has(entry.ref)) {
					this._throw(INVALID_PARAMS, `${at}.ref '${entry.ref}' is used twice`);
				}
				let validated = this._validateParams(isObject(entry.create) ? entry.create : {}, def.create.params || {});
				if (!validated.valid) {
					this._throw(INVALID_PARAMS, `${at}.create: ${validated.reason}`);
				}
				refs.add(entry.ref);
				planned.ref = entry.ref;
				planned.create = validated.obj;
			}
			else if (typeof entry.ref === "string") {
				this._throw(INVALID_PARAMS, `${at}: ref '${entry.ref}' has no create block; the builder merges a ref-addressed editor into the entry creating it`);
			}
			else {
				planned.address = def.address.plan(entry, defaults, this._fail(at));
			}
			if (!planned.create && entry.revision !== undefined) {
				if (typeof entry.revision !== "string" && !Number.isInteger(entry.revision)) {
					this._throw(INVALID_PARAMS, `${at}.revision must be a string or an integer`);
				}
				planned.revision = entry.revision;
			}

			if (!Array.isArray(entry.ops)) {
				this._throw(INVALID_PARAMS, `${at}.ops must be an array`);
			}
			entry.ops.forEach((op, opIndex) => {
				let opAt = `${at}.ops[${opIndex}]`;
				if (planned.terminal) {
					this._throw(INVALID_PARAMS, `${opAt}: no operation can follow ${planned.ops.at(-1).name}`);
				}
				if (!isObject(op) || typeof op.op !== "string") {
					this._throw(INVALID_PARAMS, `${opAt} must be an object with an 'op' name`);
				}
				let opDef = def.operations[op.op];
				if (!opDef) {
					this._throw(INVALID_PARAMS, `${opAt}.op must be one of ${Object.keys(def.operations).join(", ")} for ${entry.type}, got ${op.op}`);
				}
				requirePermissions(opDef.permissions, `${opAt} (${entry.type}.${op.op})`);
				let { op: _name, ...opParams } = op;
				let validated = this._validateParams(opParams, opDef.params);
				if (!validated.valid) {
					this._throw(INVALID_PARAMS, `${opAt}: ${validated.reason}`);
				}
				planned.ops.push({ index: opIndex, name: op.op, def: opDef, params: validated.obj });
				planned.terminal = !!opDef.terminal;
			});
			return planned;
		});
		return { entries, defaults };
	}

	/**
	 * Say how far a commit got, for the entries a store does not run atomically. Nothing is attached when
	 * nothing survived, so an absent `applied` means the set had no effect
	 * @param {Error} e
	 * @param {object[]} entries - Every planned entry
	 * @param {object[]} applied - Those that completed and were not rolled back
	 * @param {object} [failed] - The one that threw
	 * @returns {Error} The same error
	 */
	_withProgress(e, entries, applied, failed) {
		if (!applied.length) {
			return e;
		}
		// A platform failure is still a bug to log, but the caller needs the progress more than the stack
		if (!(e instanceof ControllerError)) {
			lazy.Zotero.logError(e);
			e = new ControllerError(ControllerAPIBase.errorCodes.INTERNAL_ERROR, String(e?.message ?? e));
		}
		// The target's own ID, since an operation such as a rename may have moved the object
		let locate = entry => ({
			index: entry.index,
			type: entry.type,
			id: entry.target ? entry.def.describe(entry.target).id : entry.id,
			ref: entry.ref,
		});
		let done = new Set(applied);
		e.data = Object.assign({
			applied: applied.map(locate),
			failed: failed && locate(failed),
			pending: entries.filter(entry => entry !== failed && !done.has(entry)).map(locate),
		}, e.data);
		return e;
	}

	/**
	 * How an object type reports a bad address, located where the base knows the caller is
	 * @param {string} [at] - Omitted when the caller's location adds nothing, as in a one-object query
	 * @returns {StoreFail}
	 */
	_fail(at) {
		let { INVALID_PARAMS, NOT_FOUND } = StoreAPIBase.errorCodes;
		let where = at ? `${at}: ` : "";
		return {
			invalid: message => this._throw(INVALID_PARAMS, `${where}${message}`),
			notFound: message => this._throw(NOT_FOUND, `${where}${message}`),
		};
	}

	/**
	 * The one path from an address to a live target, for commit entries and read queries alike
	 * @param {string} type
	 * @param {object} address - What the type's `address.plan` returned
	 * @param {string} [at] - The caller's location, for messages
	 * @param {StoreCommitContext} [ctx]
	 * @returns {Promise<{ id: *, target: object }>} NotFound when nothing is there
	 */
	async _loadTarget(type, address, at, ctx) {
		let def = this._objectTypes.get(type);
		let id = def.address.resolve(address, this._fail(at));
		let target = await def.resolve(id, ctx);
		if (!target) {
			this._throw(StoreAPIBase.errorCodes.NOT_FOUND, `${at ? `${at}: ` : ""}no ${type} with ID ${id}`);
		}
		return { id, target };
	}

	/**
	 * @param {ControllerCaller} context
	 * @param {object} defaults - Every change set key but `changes`
	 * @returns {StoreCommitContext}
	 */
	_createCommitContext(context, defaults) {
		let { INVALID_PARAMS } = StoreAPIBase.errorCodes;
		let isObject = lazy.VarCheck.isObject;
		let refs = new Map();
		return {
			pluginID: context.pluginID,
			privileged: context.privileged,
			defaults,
			refs,
			// A ref names an object this set created; anything else is the type's own address form
			resolveID: (type, value, { scope, what = "Reference" } = {}) => {
				if (isObject(value) && typeof value.ref === "string") {
					let created = refs.get(value.ref);
					if (!created) {
						this._throw(INVALID_PARAMS, `${what}: no object created earlier in the change set has ref '${value.ref}'`);
					}
					if (created.type !== type) {
						this._throw(INVALID_PARAMS, `${what}: ref '${value.ref}' is a ${created.type}, not a ${type}`);
					}
					// The type says what its objects' IDs are; an unsaved one has none yet
					let { id } = this._objectTypes.get(created.type).describe(created.target);
					if (id === undefined || id === null || id === false) {
						this._throw(INVALID_PARAMS, `${what}: ref '${value.ref}' has no ID yet; it is saved after its own operations`);
					}
					return id;
				}
				let def = this._objectTypes.get(type);
				return def.address.fromValue(value, { defaults, scope, type, what }, this._fail(what));
			},
		};
	}

	/**
	 * Load every addressed object and run the revision and pre-condition checks before anything changes;
	 * conflicts across the whole set are reported before any operation's check, since they come first
	 */
	async _resolve(plan, ctx) {
		let { NOT_ALLOWED, CONFLICT } = StoreAPIBase.errorCodes;
		let conflicts = [];
		let existing = plan.filter(entry => !entry.create);
		for (let entry of existing) {
			let at = `changes[${entry.index}]`;
			let { id, target } = await this._loadTarget(entry.type, entry.address, at, ctx);
			entry.id = id;
			if (entry.def.isEditable && !entry.def.isEditable(target)) {
				this._throw(NOT_ALLOWED, `${at}: ${entry.type} ${entry.id} is not editable`);
			}
			if (entry.revision !== undefined && entry.def.revision) {
				let current = entry.def.revision(target);
				if (current !== entry.revision) {
					conflicts.push({ index: entry.index, type: entry.type, id: entry.id, expected: entry.revision, current });
				}
			}
			entry.target = target;
		}
		if (conflicts.length) {
			this._throw(CONFLICT,
				`${conflicts.length} object(s) changed since their snapshot: ${conflicts.map(c => `${c.type} ${c.id}`).join(", ")}`,
				{ conflicts });
		}
		// A created object's checks run once it exists
		for (let entry of existing) {
			await this._check(entry, entry.target, ctx);
		}
	}

	async _check(entry, target, ctx) {
		for (let op of entry.ops) {
			if (!op.def.check) {
				continue;
			}
			let reason = await this._callOp(entry, "check", op, () => op.def.check(target, op.params, ctx));
			if (reason) {
				this._throw(StoreAPIBase.errorCodes.INVALID_PARAMS,
					`changes[${entry.index}].ops[${op.index}] (${entry.type}.${op.name}): ${reason}`);
			}
		}
	}

	/**
	 * Create or take the target, run its operations, save
	 */
	async _applyEntry(entry, ctx) {
		let { def } = entry;
		let target = entry.target;
		let saved = !entry.create;
		if (entry.create) {
			target = await this._callOp(entry, "create", null, () => def.create.handler(entry.create, ctx));
			entry.target = target;
			ctx.refs.set(entry.ref, { type: entry.type, target });
			await this._check(entry, target, ctx);
		}
		for (let op of entry.ops) {
			if (op.def.needsID && !saved) {
				await this._callOp(entry, "save", null, () => def.save(target, ctx));
				saved = true;
			}
			await this._callOp(entry, "apply", op, () => op.def.apply(target, op.params, ctx));
		}
		if (entry.terminal) {
			entry.erased = true;
			return;
		}
		if (def.save) {
			await this._callOp(entry, "save", null, () => def.save(target, ctx));
		}
	}

	/**
	 * Run one step of an entry: what the store deems the caller's error is reported as InvalidParams naming
	 * the step, anything else propagates as a bug or a platform failure
	 * @param {object} entry
	 * @param {"create" | "check" | "apply" | "save"} kind
	 * @param {object | null} op - The operation, for check and apply
	 * @param {() => any} fn
	 */
	async _callOp(entry, kind, op, fn) {
		try {
			return await fn();
		}
		catch (e) {
			if (e instanceof ControllerError || !this._isCallerError(e, { entry, kind, op })) {
				throw e;
			}
			let where = `changes[${entry.index}]`;
			if (op) {
				where += `.ops[${op.index}] (${entry.type}.${op.name})`;
			}
			else {
				where += kind === "save" ? ` (${entry.type} save)` : `.create (${entry.type})`;
			}
			this._log(`${where} refused: ${e.message}`);
			this._throw(StoreAPIBase.errorCodes.INVALID_PARAMS, `${where}: ${e.message}`);
		}
		return undefined;
	}

	/**
	 * Whether a failed step is the caller's data being refused, to report as InvalidParams naming the step;
	 * the base says never, a store built on a core that validates in memory decides by step and error class
	 * @param {*} e
	 * @param {{ entry: object, kind: "create" | "check" | "apply" | "save", op: object | null }} step
	 * @returns {boolean}
	 */
	_isCallerError(_e, _step) {
		return false;
	}

	async _restore(entries) {
		for (let entry of entries) {
			if (entry.create || !entry.target || !entry.def.restore) {
				continue;
			}
			try {
				await entry.def.restore(entry.target);
			}
			catch (e) {
				lazy.Zotero.logError(e);
			}
		}
	}

	_describe(plan, withSnapshots) {
		let objects = plan.map((entry) => {
			let ref = Object.assign({ type: entry.type }, entry.def.describe(entry.target));
			if (entry.ref) {
				ref.ref = entry.ref;
			}
			if (entry.erased) {
				ref.erased = true;
				return ref;
			}
			if (entry.def.revision) {
				ref.revision = entry.def.revision(entry.target);
			}
			if (withSnapshots && entry.def.snapshot) {
				ref.snapshot = entry.def.snapshot(entry.target);
			}
			return ref;
		});
		return this._toPlainResult("commit", { objects });
	}

	/**
	 * The checks a commit makes before it changes anything, as data; stops at the first blocking issue.
	 * Runs outside the transaction, so a passing set can still conflict when committed
	 * @param {StoreChangeSet} changes
	 * @param {ControllerCaller} context
	 * @returns {Promise<{ issues: StoreIssue[] }>}
	 */
	async _validate(changes, context) {
		let issues = [];
		try {
			let { entries, defaults } = this._plan(changes, context);
			await this._resolve(entries, this._createCommitContext(context, defaults));
		}
		catch (e) {
			if (!(e instanceof ControllerError)) {
				throw e;
			}
			issues.push(Object.assign({ code: e.code, message: e.message }, e.data));
		}
		return { issues };
	}
}

export { StoreAPIBase };
