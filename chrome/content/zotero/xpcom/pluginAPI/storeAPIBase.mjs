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
 * @property {Record<string, RequestDef>} [queries] - Read-only requests, as on any request API. Every
 *     store also gets `validate`, which dry-runs a change set, and `snapshot`, which reads one object by the
 *     address a change set entry gives it, unless it defines its own
 * @property {Record<string, StoreObjectTypeDef>} objectTypes - What a change set can address, by type name
 * @property {string | string[]} [permissions] - What every commit requires; a type or operation can add to it
 * @property {(fn: () => Promise<void>) => Promise<void>} [transaction]
 *     - Runs the transactional entries of a commit; defaults to calling fn directly
 *
 *
 * @typedef {object} StoreObjectTypeDef
 * @property {string | string[]} [permissions] - Required on top of the store's for every entry of this type
 * @property {boolean} [transactional] - Whether entries run inside the store transaction (default true), else after
 *     it, in order and not atomically; a create or an operation can move its own entry out too
 * @property {(id: number, ctx: StoreCommitContext) => (object | null | Promise<object | null>)} resolve
 *     - The live object for an ID, or null; entries that get the same object share it, one applying after another
 * @property {StoreAddressDef} address - How an entry or a reference names an existing object of this type;
 *     the store decides what an address looks like, the base only passes it through
 * @property {StoreCreateDef} [create] - How a new object is made; absent means the type cannot be created
 * @property {(target: object) => (string | number)} [revision] - The token an entry's `revision` is compared against
 * @property {(target: object) => boolean} [isEditable] - false fails the entry with NotAllowed
 * @property {(target: object, ctx: StoreCommitContext) => Promise<void>} [save] - Persist the target after its
 *     operations; also called before the first operation flagged `needsID` on a created target
 * @property {(target: object) => Promise<void>} [restore] - Drop in-memory changes after a failed commit
 * @property {(target: object) => Promise<void>} [discard] - Remove a created object again when a later step of
 *     its own entry fails outside the store transaction, where nothing rolls it back; runs on what the type's
 *     `create.handler` returned, so a handler that may return an existing object must not define it
 * @property {(target: object) => object} describe - The result entry for a target, at least `{ id }`
 * @property {(target: object) => (object | null)} [snapshot] - The object's snapshot, for the `snapshot` query
 *     and the `snapshots` commit option; null when nothing is there
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
 * @property {(params: object) => boolean} [transactional] - false when the create opens its own transaction
 * @property {(params: object, ctx: StoreCommitContext) => Promise<void>} [prepare] - Runs before the store
 *     transaction and any load, for a check that may wait on the user, such as a file prompt
 *
 *
 * @typedef {object} StoreOperationDef
 * @property {string | string[]} [permissions] - Required on top of the store's and the type's
 * @property {Record<string, PluginAPIOptDefValue>} [params] - Everything in the operation but `op`; unknown keys are rejected
 * @property {boolean} [terminal] - The target no longer exists afterwards (erase): no save, no later operation,
 *     and no later entry sharing the target
 * @property {boolean} [needsID] - A created target must be saved before this runs
 * @property {boolean} [transactional] - false when the operation opens its own transaction
 * @property {(target: object | undefined, params: object, ctx: StoreCommitContext) => Promise<void>} [prepare]
 *     - As a create's, with the target as loaded before the transaction, so only what cannot change may be read
 * @property {(target: object, params: object, ctx: StoreCommitContext) => (string | undefined | Promise<string | undefined>)} [check]
 *     - A reason the operation cannot apply, checked before anything changes; must not resolve refs
 * @property {(target: object, params: object, ctx: StoreCommitContext) => (void | Promise<void>)} apply
 *
 *
 * @typedef {object} StoreCommitContext
 * @property {string} [pluginID] - The calling plugin; unset for chrome
 * @property {boolean} privileged
 * @property {object | null} scope - The caller's sandbox scope, for permission checks
 * @property {boolean} [transactional] - While an entry applies, whether it runs inside the store transaction
 * @property {object} defaults - Every change set key but `changes`, for the object types to read
 * @property {Map<string, { type: string, target: object }>} refs - Objects created so far, by ref
 * @property {(type: string, value: StoreIDRef, options?: { scope?: *, what?: string }) => *} resolveID
 *     - The ID an operation names: a `{ ref }` resolves here, anything else through the type's
 *     `address.fromValue`, with `scope` as the object being edited
 *
 *
 * How an operation names another object: one this set creates, or any form the type's address accepts. A
 * create or operation param that takes one declares `objectType` in its definition, for its value or each element
 * @typedef {{ ref: string } | *} StoreIDRef
 *
 *
 * Each entry changes one object, which later entries may change again: created ones apply first, each after
 * those whose refs it names, then the rest in order. Every other key is a default; a single entry is a set
 * @typedef {object} StoreChangeSet
 * @property {StoreChangeEntry[]} changes
 *
 *
 * `create` makes an object any entry reaches as `{ ref }`; otherwise the type's `address.fields` name
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
 * @property {StoreObjectRef[]} objects - One per entry, in the set's order
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


import { RequestAPIBase } from "chrome://zotero/content/xpcom/pluginAPI/requestAPIBase.mjs";
import { PluginRequestError } from "chrome://zotero/content/xpcom/plugins/apiErrors.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
	VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
});


/**
 * Store-style API: plugins read snapshots through queries, describe changes locally as a change set, and
 * commit it once; the store checks the whole set, then applies it to the live objects in one transaction
 */
class StoreAPIBase extends RequestAPIBase {
	_config = {
		apiName: "StoreAPIBase",
		permissions: [],
		transaction: fn => fn(),
	};

	/**
	 * The request codes plus the one outcome only a commit has
	 */
	static errorCodes = Object.freeze({
		...RequestAPIBase.errorCodes,
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
	 * Queries are defined as on any request API, plus `validate` and `snapshot` unless the store defines them;
	 * object types under `objectTypes`. Every write is an operation in a change set
	 * @param {StoreAPIConfig} config
	 */
	set config(config) {
		let { objectTypes = {}, ...rest } = config;
		super.config = rest;
		for (let [type, def] of Object.entries(objectTypes)) {
			this._defineObjectType(type, def);
		}
		if (!this._queries.has("validate")) {
			this._define(this._queries, "validate", {
				params: { changes: "object" },
				handler: ({ changes }, { caller }) => this._validate(changes, caller),
			});
		}
		if (!this._queries.has("snapshot")) {
			this._define(this._queries, "snapshot", {
				params: { type: "string", ...this._addressParams() },
				handler: ({ type, pluginID: _pluginID, ...entry }, { caller }) => this._readSnapshot(type, entry, caller),
			});
		}
	}

	/**
	 * Every field any object type's address uses, so one query takes any type's address
	 * @returns {Record<string, PluginAPIOptDefValue>}
	 */
	_addressParams() {
		let params = {};
		for (let def of this._objectTypes.values()) {
			for (let field of def.address.fields) {
				params[field] = { type: "any", optional: true };
			}
		}
		return params;
	}

	/**
	 * @returns {string[]} The object types a change set can address
	 */
	get objectTypes() {
		return [...this._objectTypes.keys()];
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
	 * @returns {Promise<APIResponse<StoreCommitResult>>}
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
		let { entries, defaults, transactional, deferred } = this._plan(params.changes, context);
		let ctx = this._createCommitContext(context, defaults);
		await this._prepare(entries, ctx);

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
		// Entries that open their own transactions apply after the store's, in order
		try {
			await run(deferred);
		}
		catch (e) {
			// What the failed entry saved stays unless it created the object; what it changed only in memory goes
			if (failed) {
				await (failed.create ? this._discard(failed, ctx) : this._restore([failed]));
			}
			throw this._withProgress(e, entries, applied, failed);
		}
		return this._describe(entries, validatedOptions.obj.snapshots);
	}

	/**
	 * Check the set before anything is loaded: addressing, operations, params, refs and permissions
	 * @param {StoreChangeSet | StoreChangeEntry} changeSet
	 * @param {RequestCaller} context
	 * @returns {{ entries: object[], defaults: object, transactional: object[], deferred: object[] }} The
	 *     planned entries in the set's order, every key of the set but `changes`, and the order they apply in
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

			let planned = { index, type: entry.type, def, ops: [], uses: [], transactional: def.transactional };
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
				if (entry.revision !== undefined) {
					this._throw(INVALID_PARAMS, `${at}: a created object has no revision to expect`);
				}
				refs.add(entry.ref);
				planned.ref = entry.ref;
				planned.create = validated.obj;
				if (def.create.transactional?.(validated.obj) === false) {
					planned.transactional = false;
				}
				this._collectUses(planned, planned.create, def.create.params || {}, `${at}.create`);
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
				if (opDef.transactional === false) {
					planned.transactional = false;
				}
				this._collectUses(planned, validated.obj, opDef.params, opAt);
			});
			return planned;
		});
		this._link(entries);
		return { entries, defaults, ...this._order(entries) };
	}

	/**
	 * Record each `{ ref }` in a param that declares an `objectType`, alone or as an array element, with the
	 * type it must be and where it sits
	 * @param {object} planned - The entry, whose `uses` grows
	 * @param {object} params - Validated create or operation params
	 * @param {Record<string, PluginAPIOptDefValue>} paramDefs
	 * @param {string} at - Where the params sit, for messages
	 */
	_collectUses(planned, params, paramDefs, at) {
		for (let [key, value] of Object.entries(params)) {
			let type = paramDefs[key]?.objectType;
			if (!type) {
				continue;
			}
			let located = Array.isArray(value)
				? value.map((element, i) => [element, `${at}.${key}[${i}]`])
				: [[value, `${at}.${key}`]];
			for (let [element, where] of located) {
				let ref = this._refOf(element);
				if (ref !== undefined) {
					planned.uses.push({ ref, type, at: where });
				}
			}
		}
	}

	/**
	 * Point each ref an entry uses at the entry creating it, refusing any no order could satisfy: one nothing
	 * creates, the entry's own, one of another type, or one created only after the transaction that needs it
	 * @param {object[]} entries - The planned entries, in the set's order
	 */
	_link(entries) {
		let { INVALID_PARAMS } = StoreAPIBase.errorCodes;
		let creators = new Map(entries.filter(entry => entry.create).map(entry => [entry.ref, entry]));
		for (let entry of entries) {
			for (let use of entry.uses) {
				let creator = creators.get(use.ref);
				if (!creator) {
					this._throw(INVALID_PARAMS, `${use.at}: no entry creates ref '${use.ref}'`);
				}
				if (creator === entry) {
					this._throw(INVALID_PARAMS, `${use.at}: ref '${use.ref}' is the object this entry creates`);
				}
				if (creator.type !== use.type) {
					this._throw(INVALID_PARAMS, `${use.at}: ref '${use.ref}' is a ${creator.type}, not a ${use.type}`);
				}
				if (entry.transactional && !creator.transactional) {
					this._throw(INVALID_PARAMS, `${use.at}: ref '${use.ref}' is created after the store transaction this entry applies in`);
				}
				use.creator = creator;
			}
		}
	}

	/**
	 * @returns {string | undefined} The ref a value names, as resolveID reads it
	 */
	_refOf(value) {
		return lazy.VarCheck.isObject(value) && typeof value.ref === "string" ? value.ref : undefined;
	}

	/**
	 * Within the store transaction and after it, created objects apply first, each after the ones whose refs
	 * it names, so a ref reaches its object wherever the set lists it; existing objects follow in order
	 * @param {object[]} entries - The planned entries, in the set's order
	 * @returns {{ transactional: object[], deferred: object[] }}
	 */
	_order(entries) {
		let order = (group) => {
			let waiting = group.filter(entry => entry.create);
			let ordered = [];
			while (waiting.length) {
				// A creator outside the group has applied by then, since _link refused the other direction
				let next = waiting.findIndex(entry => entry.uses.every(use => !waiting.includes(use.creator)));
				if (next === -1) {
					let stuck = waiting.map(entry => `changes[${entry.index}] (ref '${entry.ref}')`).join(", ");
					this._throw(StoreAPIBase.errorCodes.INVALID_PARAMS,
						`No creation order satisfies the refs of ${stuck}: each needs another of them created first`);
				}
				ordered.push(...waiting.splice(next, 1));
			}
			return [...ordered, ...group.filter(entry => !entry.create)];
		};
		return {
			transactional: order(entries.filter(entry => entry.transactional)),
			deferred: order(entries.filter(entry => !entry.transactional)),
		};
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
		if (!(e instanceof PluginRequestError)) {
			lazy.Zotero.logError(e);
			e = new PluginRequestError(RequestAPIBase.errorCodes.INTERNAL_ERROR, String(e?.message ?? e));
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
	 * The snapshot of one existing object, addressed as a change set entry addresses it; a store that gates its
	 * reads does so in an override, before this takes the path a commit entry would
	 * @param {string} type
	 * @param {object} entry - The type's address fields
	 * @param {RequestCaller} _caller
	 * @returns {Promise<object>} NotFound when nothing is there
	 */
	async _readSnapshot(type, entry, _caller) {
		let { INVALID_PARAMS, NOT_FOUND } = StoreAPIBase.errorCodes;
		let def = this._objectTypes.get(type);
		if (!def) {
			this._throw(INVALID_PARAMS, `type must be one of ${[...this._objectTypes.keys()].join(", ")}, got ${type}`);
		}
		if (!def.snapshot) {
			this._throw(INVALID_PARAMS, `${type} objects have no snapshot`);
		}
		let address = def.address.plan({ ...entry, type }, {}, this._fail());
		let { id, target } = await this._loadTarget(type, address);
		let snapshot = def.snapshot(target);
		if (!snapshot) {
			this._throw(NOT_FOUND, `${type} ${id} does not exist`);
		}
		return snapshot;
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
	 * @param {RequestCaller} context
	 * @param {object} defaults - Every change set key but `changes`
	 * @returns {StoreCommitContext}
	 */
	_createCommitContext(context, defaults) {
		let { INVALID_PARAMS } = StoreAPIBase.errorCodes;
		let refs = new Map();
		return {
			pluginID: context.pluginID,
			privileged: context.privileged,
			scope: context.scope,
			defaults,
			refs,
			// A ref names an object this set created; anything else is the type's own address form
			resolveID: (type, value, { scope, what = "Reference" } = {}) => {
				let ref = this._refOf(value);
				if (ref !== undefined) {
					// _link already checked refs in params that declare an objectType; these catch one that does not
					let created = refs.get(ref);
					if (!created) {
						this._throw(INVALID_PARAMS, `${what}: no object with ref '${ref}' is created before this entry applies`);
					}
					if (created.type !== type) {
						this._throw(INVALID_PARAMS, `${what}: ref '${ref}' is a ${created.type}, not a ${type}`);
					}
					// The type says what its objects' IDs are; an unsaved one has none yet
					let { id } = this._objectTypes.get(created.type).describe(created.target);
					if (id === undefined || id === null || id === false) {
						this._throw(INVALID_PARAMS, `${what}: ref '${ref}' has no ID yet; it is saved after its own operations`);
					}
					return id;
				}
				let def = this._objectTypes.get(type);
				return def.address.fromValue(value, { defaults, scope, type, what }, this._fail(what));
			},
		};
	}

	/**
	 * Run the checks that may wait on the user, so no prompt holds the store transaction open
	 */
	async _prepare(plan, ctx) {
		for (let entry of plan) {
			if (entry.create && entry.def.create.prepare) {
				await this._callOp(entry, "prepare", null, () => entry.def.create.prepare(entry.create, ctx));
			}
			let preparing = entry.ops.filter(op => op.def.prepare);
			if (!preparing.length) {
				continue;
			}
			let target = entry.create
				? undefined
				: (await this._loadTarget(entry.type, entry.address, `changes[${entry.index}]`, ctx)).target;
			for (let op of preparing) {
				await this._callOp(entry, "prepare", op, () => op.def.prepare(target, op.params, ctx));
			}
		}
	}

	/**
	 * Load every addressed object and run the revision and pre-condition checks before anything changes;
	 * conflicts across the whole set are reported before any operation's check, since they come first
	 */
	async _resolve(plan, ctx) {
		let { INVALID_PARAMS, NOT_ALLOWED, CONFLICT } = StoreAPIBase.errorCodes;
		let conflicts = [];
		let existing = plan.filter(entry => !entry.create);
		// Entries that load one live object share it, so none can follow an entry whose terminal operation ends it
		let endedBy = new Map();
		for (let entry of existing) {
			let at = `changes[${entry.index}]`;
			let { id, target } = await this._loadTarget(entry.type, entry.address, at, ctx);
			entry.id = id;
			let ender = endedBy.get(target);
			if (ender) {
				this._throw(INVALID_PARAMS,
					`${at}: ${entry.type} ${id} no longer exists after changes[${ender.index}] (${ender.ops.at(-1).name})`);
			}
			if (entry.terminal) {
				endedBy.set(target, entry);
			}
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
		ctx = { ...ctx, transactional: entry.transactional };
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
	 * Run one step of an entry, naming the step in a refusal: a store's own coded one keeps its code, what
	 * the store deems the caller's error is InvalidParams, anything else propagates as a bug or a platform failure
	 * @param {object} entry
	 * @param {"prepare" | "create" | "check" | "apply" | "save"} kind
	 * @param {object | null} op - The operation, for its prepare, check and apply
	 * @param {() => any} fn
	 */
	async _callOp(entry, kind, op, fn) {
		try {
			return await fn();
		}
		catch (e) {
			let coded = e instanceof PluginRequestError;
			if (!coded && !this._isCallerError(e, { entry, kind, op })) {
				throw e;
			}
			let where = `changes[${entry.index}]`;
			if (op) {
				where += `.ops[${op.index}] (${entry.type}.${op.name})`;
			}
			else {
				where += kind === "save" ? ` (${entry.type} save)` : `.create (${entry.type})`;
			}
			if (coded) {
				this._throw(e.code, `${where}: ${e.message}`, e.data);
			}
			// A store may count a thrown string as a refusal too
			let reason = typeof e === "string" ? e : e.message;
			this._log(`${where} refused: ${reason}`);
			this._throw(StoreAPIBase.errorCodes.INVALID_PARAMS, `${where}: ${reason}`);
		}
		return undefined;
	}

	/**
	 * Whether a failed step is the caller's data being refused, to report as InvalidParams naming the step;
	 * the base says never, a store built on a core that validates in memory decides by step and error class
	 * @param {*} e
	 * @param {{ entry: object, kind: "prepare" | "create" | "check" | "apply" | "save", op: object | null }} step
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

	// A created object its failed entry already persisted outside the store transaction is removed again
	async _discard(entry, ctx) {
		let { def, target } = entry;
		if (!target || !def.discard) {
			return;
		}
		let { id } = def.describe(target);
		if (id === undefined || id === null || id === false) {
			return;
		}
		try {
			// A save that assigned the ID and then rolled back left nothing to remove
			if (!(await def.resolve(id, ctx))) {
				return;
			}
			await def.discard(target);
			entry.target = undefined;
			this._log(`changes[${entry.index}] (${entry.type}) removed again after its entry failed`);
		}
		catch (e) {
			lazy.Zotero.logError(e);
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
	 * @param {RequestCaller} context
	 * @returns {Promise<{ issues: StoreIssue[] }>}
	 */
	async _validate(changes, context) {
		let issues = [];
		try {
			let { entries, defaults } = this._plan(changes, context);
			let ctx = this._createCommitContext(context, defaults);
			await this._prepare(entries, ctx);
			await this._resolve(entries, ctx);
		}
		catch (e) {
			if (!(e instanceof PluginRequestError)) {
				throw e;
			}
			issues.push(Object.assign({ code: e.code, message: e.message }, e.data));
		}
		return { issues };
	}
}

export { StoreAPIBase };
