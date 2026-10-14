/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://www.zotero.org

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

{
	const lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		StoreAPIBase: "chrome://zotero/content/xpcom/pluginAPI/storeAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		Params: "chrome://zotero/content/xpcom/pluginAPI/apiParams.mjs",
		DataParams: "chrome://zotero/content/xpcom/pluginAPI/dataParams.mjs",
		DataAddress: "chrome://zotero/content/xpcom/pluginAPI/dataAddress.mjs",
		DataSnapshots: "chrome://zotero/content/xpcom/pluginAPI/dataSnapshots.mjs",
		DataItemFields: "chrome://zotero/content/xpcom/pluginAPI/dataItemFields.mjs",
		VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		ScopeUtils: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
		PluginFileAccess: "chrome://zotero/content/xpcom/plugins/fileAccess.mjs",
		PathIdentity: "chrome://zotero/content/xpcom/plugins/filePath.mjs",
		FileIO: "chrome://zotero/content/xpcom/plugins/fileIO.mjs",
	});

	/**
	 * What a hook that cannot await `query` passes: no argument reads its own item, an itemID any item in
	 * memory; null without dataRead or while loading, which it starts. Throws once the hook has returned
	 * @typedef {(itemID?: number) => (ItemSnapshot | null)} SyncItemGetter
	 */

	/**
	 * A read of one item; `data` is Zotero API JSON, the shape item.toJSON() and the web API use
	 * @typedef {object} ItemSnapshot
	 * @property {"item"} type
	 * @property {number} id
	 * @property {number} libraryID
	 * @property {string} key
	 * @property {number} revision - The core's clientVersion, moved by every save of the item and by sync; pass it
	 *     back to commit. Items.trash, a tag rename and a collection erase write rows directly and leave it
	 * @property {"regular" | "note" | "attachment" | "annotation"} kind
	 * @property {string} displayTitle - What the item tree shows
	 * @property {number | null} parentID
	 * @property {number[]} collectionIDs
	 * @property {{ notes?: number[], attachments?: number[], annotations?: number[] }} [children]
	 *     - Regular items list notes and attachments, file attachments their annotations
	 * @property {{ read: boolean, guid: string }} [feedItem] - Items of a feed library
	 * @property {object} data - Built on first read, so a per-row hook that never reads it pays nothing; a
	 *     linked-file attachment's `path` is as stored, so ask the `file` query for what the file store takes
	 *
	 *
	 * @typedef {object} CollectionSnapshot
	 * @property {"collection"} type
	 * @property {number} id
	 * @property {number} libraryID
	 * @property {string} key
	 * @property {number} revision - The collection's clientVersion; membership changes save the items, not the
	 *     collection, so they do not move it
	 * @property {number | null} parentID
	 * @property {number[]} childCollectionIDs
	 * @property {number[]} itemIDs
	 * @property {object} data - collection.toJSON()
	 *
	 *
	 * @typedef {object} SearchSnapshot
	 * @property {"search"} type
	 * @property {number} id
	 * @property {number} libraryID
	 * @property {string} key
	 * @property {number} revision - The search's clientVersion
	 * @property {object} data - search.toJSON(): name and conditions
	 *
	 *
	 * @typedef {object} LibrarySnapshot
	 * @property {"library"} type
	 * @property {number} id
	 * @property {"user" | "group" | "feed"} libraryType
	 * @property {string} name
	 * @property {boolean} editable
	 * @property {boolean} filesEditable
	 * @property {boolean} hasTrash
	 * @property {number} clientVersion - The library's save counter, moved by every save of any of its objects
	 * @property {{ id: number, description: string }} [group] - Group libraries
	 * @property {FeedSettings & { lastCheck: string | null, lastUpdate: string | null, lastCheckError: string | null, unreadCount: number, updating: boolean }} [feed]
	 *     - Feed libraries
	 *
	 *
	 * @typedef {object} FeedSettings
	 * @property {string} url
	 * @property {number | null} refreshInterval - Hours
	 * @property {number | null} cleanupReadAfter - Days
	 * @property {number | null} cleanupUnreadAfter - Days
	 *
	 *
	 * @typedef {object} SearchCondition
	 * @property {string} condition - A Zotero search condition name, optionally with a /mode suffix
	 * @property {string} operator
	 * @property {string} [value]
	 *
	 *
	 * @typedef {object} TagInfo
	 * @property {string} name
	 * @property {number} type - 0 manual, 1 automatic
	 * @property {string} [color]
	 * @property {number} [position] - The colored tag's slot, for colored tags
	 */

	// The query catalog as types for callers; keep in sync with the constructor's definitions
	/**
	 * @typedef {object} DataStoreQueryParams
	 * @property {{ itemID: number } | { libraryID: number, key: string }} item
	 * @property {{ itemIDs: number[] }} items
	 * @property {{ collectionID: number } | { libraryID: number, key: string }} collection
	 * @property {{ collectionIDs: number[] }} collections
	 * @property {{ searchID: number } | { libraryID: number, key: string }} search
	 * @property {{ searchIDs: number[] }} searches
	 * @property {{ libraryID: number }} library
	 * @property {{}} libraries
	 * @property {{ libraryID: number, conditions?: SearchCondition[], includeTrashed?: boolean }} findItems
	 * @property {{ libraryID: number, parentID?: number, recursive?: boolean }} findCollections
	 * @property {{ libraryID: number }} findSearches
	 * @property {{ libraryID: number }} tags
	 * @property {{ itemType?: string }} schema
	 * @property {{ libraryID: number }} findDuplicates
	 * @property {{ itemIDs: number[] }} topLevelItems
	 * @property {{ itemID: number }} fulltext
	 * @property {{ itemID: number }} file
	 * @property {{ changes: StoreChangeSet }} validate
	 *
	 *
	 * @typedef {object} DataStoreQueryResults
	 * @property {ItemSnapshot} item
	 * @property {{ items: ItemSnapshot[] }} items
	 * @property {CollectionSnapshot} collection
	 * @property {{ collections: CollectionSnapshot[] }} collections
	 * @property {SearchSnapshot} search
	 * @property {{ searches: SearchSnapshot[] }} searches
	 * @property {LibrarySnapshot} library
	 * @property {{ userLibraryID: number, libraries: LibrarySnapshot[] }} libraries
	 * @property {{ itemIDs: number[] }} findItems
	 * @property {{ collectionIDs: number[] }} findCollections
	 * @property {{ searchIDs: number[] }} findSearches
	 * @property {{ tags: TagInfo[] }} tags
	 * @property {{ path: string | null, exists: boolean }} file - Null for a linked URL or a path Zotero cannot resolve
	 * @property {{ itemTypes: ItemTypeSchema[], searchConditions?: SearchConditionSchema[] }} schema
	 * @property {{ sets: number[][] }} findDuplicates - Each set is the IDs of items that look like one work
	 * @property {{ itemIDs: number[] }} topLevelItems - The items themselves or, for child items, their parents
	 * @property {{ state: "unavailable" | "unindexed" | "partial" | "indexed" | "queued", indexedPages: number | null, totalPages: number | null }} fulltext
	 * @property {{ issues: StoreIssue[] }} validate
	 *
	 *
	 * @typedef {object} ItemTypeSchema
	 * @property {string} name
	 * @property {string} localized
	 * @property {{ name: string, localized: string, baseField?: string }[]} fields - baseField for type-specific
	 *     names of a base field, such as publicationTitle for bookTitle
	 * @property {{ name: string, localized: string, primary: boolean }[]} creatorTypes
	 *
	 *
	 * @typedef {object} SearchConditionSchema
	 * @property {string} name
	 * @property {string} localized
	 * @property {string[]} operators
	 */

	// The operation catalog as types for callers; every operation is `{ op: <name>, ...params }`
	/**
	 * @typedef {object} ItemOperationParams
	 * @property {{ itemType: string }} setType
	 * @property {{ field: string, value: string | number | boolean | object }} setField - An item field, or on the
	 *     matching kind an API JSON attachment or annotation property (DataItemFields.PROPERTIES)
	 * @property {{ creators: object[] }} setCreators - API JSON creators
	 * @property {{ creator: object }} addCreator
	 * @property {{ tags: (string | { tag: string, type?: number })[] }} setTags
	 * @property {{ tag: string, type?: number }} addTag
	 * @property {{ tag: string }} removeTag
	 * @property {{ collections: IDRef[] }} setCollections
	 * @property {{ collection: IDRef }} addToCollection
	 * @property {{ collection: IDRef }} removeFromCollection
	 * @property {{ relations: Record<string, string | string[]> }} setRelations
	 * @property {{ predicate: string, object: string }} addRelation
	 * @property {{ predicate: string, object: string }} removeRelation
	 * @property {{ note: string }} setNote - Notes and attachments only
	 * @property {{ parent: IDRef | null }} setParent
	 * @property {{ value: boolean }} setInPublications
	 * @property {{}} trash
	 * @property {{}} restore
	 * @property {{}} erase - Terminal
	 *
	 *
	 * @typedef {object} CollectionOperationParams
	 * @property {{ name: string }} setName
	 * @property {{ parent: IDRef | null }} setParent
	 * @property {{ items: IDRef[] }} addItems
	 * @property {{ items: IDRef[] }} removeItems
	 * @property {{}} trash
	 * @property {{}} restore
	 * @property {{}} erase - Terminal; child items stay in the library
	 *
	 *
	 * @typedef {object} SearchOperationParams
	 * @property {{ name: string }} setName
	 * @property {{ conditions: SearchCondition[] }} setConditions - Replaces all conditions
	 * @property {SearchCondition} addCondition
	 * @property {{}} erase - Terminal
	 *
	 *
	 * Library entries run after the store transaction, each in the core's own; they are not atomic with the rest
	 * @typedef {object} LibraryOperationParams
	 * @property {{ name: string }} setName - Feeds only
	 * @property {Partial<FeedSettings>} setFeed - Feeds only
	 * @property {{}} refreshFeed - Feeds only; fetches the feed
	 * @property {{}} clearExpiredFeedItems - Feeds only
	 * @property {{ items: IDRef[], read: boolean }} markRead - Feeds only; the feed's items
	 * @property {{}} erase - Feeds only; terminal
	 * @property {{ from: string, to: string }} renameTag
	 * @property {{ tag: string }} removeTag
	 * @property {{ tag: string, color: string | null, position?: number }} setTagColor
	 *
	 *
	 * How an operation names another object: a local ID; a key, bare (resolved in the library of the object
	 * being edited, else the set's) or with its library; or the `{ ref }` of an object the set creates
	 * @typedef {number | string | { key: string, libraryID?: number } | { ref: string }} IDRef
	 *
	 *
	 * Create params by type
	 * @typedef {object} DataStoreCreateParams
	 * @property {{ libraryID: number, itemType: string, parent?: IDRef, linkMode?: "linked_url",
	 *     annotationType?: string, annotationSortIndex?: string, annotationPosition?: object | string }} item
	 *     - Attachments need linkMode; file-backed link modes wait for the file API. Annotations need a PDF,
	 *     EPUB or snapshot parent and the three annotation fields, which only they take
	 * @property {{ libraryID: number, name: string, parent?: IDRef }} collection
	 * @property {{ libraryID: number, name: string, conditions?: SearchCondition[] }} search
	 * @property {{ libraryType: "feed", name: string } & Partial<FeedSettings>} library - Feeds only
	 */

	const FULLTEXT_STATES = {
		[Zotero.Fulltext.INDEX_STATE_UNAVAILABLE]: "unavailable",
		[Zotero.Fulltext.INDEX_STATE_UNINDEXED]: "unindexed",
		[Zotero.Fulltext.INDEX_STATE_PARTIAL]: "partial",
		[Zotero.Fulltext.INDEX_STATE_INDEXED]: "indexed",
		[Zotero.Fulltext.INDEX_STATE_QUEUED]: "queued",
	};

	// The core classes behind the keyed object types
	const OBJECTS = {
		item: Zotero.Items,
		collection: Zotero.Collections,
		search: Zotero.Searches,
	};

	// The library operations feeds alone support
	const feedOnly = what => library => !library.isFeed && `only feeds ${what}`;

	// The core refuses data with a plain Error of its own global, or in older setters a thrown string; a subclass or
	// a platform exception is something else
	function isCoreRefusal(e) {
		if (typeof e === "string") {
			return true;
		}
		return e !== null && typeof e === "object" && Object.getPrototypeOf(e) === Cu.getGlobalForObject(e).Error.prototype;
	}

	/**
	 * @param {Zotero.DataObjects} objects
	 * @param {number} id
	 * @returns {Promise<Zotero.DataObject | null>} Fully loaded
	 */
	async function resolveObject(objects, id) {
		let object = await objects.getAsync(id);
		if (!object) {
			return null;
		}
		await object.loadAllData();
		return object;
	}

	/**
	 * The batch form: one query per data type and library instead of one per object
	 * @param {Zotero.DataObjects} objects
	 * @param {number[]} ids
	 * @returns {Promise<(Zotero.DataObject | null)[]>} In the order of `ids`, fully loaded
	 */
	async function resolveObjects(objects, ids) {
		let loaded = await objects.getAsync(ids);
		await objects.loadDataTypes(loaded);
		let byID = new Map(loaded.map(object => [object.id, object]));
		return ids.map(id => byID.get(id) ?? null);
	}

	/**
	 * Replace a search's conditions through core's own Search.fromJSON, which resets `deleted` to what the JSON
	 * says, so the search's own goes along
	 * @param {Zotero.Search} search
	 * @param {SearchCondition[]} conditions
	 */
	function setSearchConditions(search, conditions) {
		search.fromJSON({
			conditions: conditions.map(condition => ({ ...condition, value: condition.value ?? "" })),
			deleted: search.deleted,
		});
	}

	/**
	 * The live item behind an ID, or null when it is not in memory; the load is started, so a later
	 * read finds it
	 * @param {number} [itemID]
	 * @returns {Zotero.Item | null}
	 */
	function cachedItem(itemID) {
		try {
			return Zotero.Items.get(itemID) || null;
		}
		catch (e) {
			if (!(e instanceof Zotero.Exception.UnloadedDataException)) {
				throw e;
			}
			Zotero.Items.getAsync(itemID)
				.then(loaded => loaded?.loadAllData())
				.catch(err => Zotero.logError(err));
			return null;
		}
	}

	/**
	 * Wrapped for the sandbox here, since the hook payload's per-property copy would defeat the snapshot's
	 * laziness. The caller expires it when its hook returns; kept past that, `ownItemID` would be stale
	 * @param {number} [ownItemID] - What the getter reads when called with no argument
	 * @param {string} pluginID
	 * @returns {SyncItemGetter & { expire: function }} `expire` is chrome-only; it does not cross the boundary
	 */
	function itemGetter(ownItemID, pluginID) {
		// Without dataRead a hook keeps its IDs and reads nothing
		let canRead = lazy.PluginSandbox.isPrivileged(pluginID)
			|| lazy.VarCheck.hasPermissions(lazy.PluginSandbox.getScope(pluginID), "dataRead");
		let live = true;
		let warned = false;
		let getItem = (itemID) => {
			if (!live) {
				// The boundary replaces a chrome error's message, so the advice goes to the log
				if (!warned) {
					warned = true;
					Zotero.warn(`Plugin ${pluginID}: getItem() only reads while its hook runs; for anything `
						+ `later, query Zotero.DataStore and refresh the column or row`);
				}
				throw new Error("getItem() is no longer valid");
			}
			if (!canRead) {
				return null;
			}
			let target = cachedItem(itemID === undefined ? ownItemID : itemID);
			return target ? lazy.ScopeVariables.toScope(lazy.DataSnapshots.item(target), pluginID) : null;
		};
		getItem.expire = () => {
			live = false;
		};
		return getItem;
	}

	class DataStoreInternal extends lazy.StoreAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "DataStore",
				permissions: "dataWrite",
				transaction: fn => Zotero.DB.executeTransaction(fn),
				queries: {
					item: {
						params: lazy.DataParams.address("itemID"),
						handler: ({ itemID, libraryID, key }) => this._readSnapshot("item", { id: itemID, libraryID, key }),
					},
					items: {
						params: { itemIDs: lazy.Params.intList },
						handler: ({ itemIDs }) => this._getSnapshots("item", itemIDs, "items"),
					},
					collection: {
						params: lazy.DataParams.address("collectionID"),
						handler: ({ collectionID, libraryID, key }) => this._readSnapshot("collection", { id: collectionID, libraryID, key }),
					},
					collections: {
						params: { collectionIDs: lazy.Params.intList },
						handler: ({ collectionIDs }) => this._getSnapshots("collection", collectionIDs, "collections"),
					},
					search: {
						params: lazy.DataParams.address("searchID"),
						handler: ({ searchID, libraryID, key }) => this._readSnapshot("search", { id: searchID, libraryID, key }),
					},
					searches: {
						params: { searchIDs: lazy.Params.intList },
						handler: ({ searchIDs }) => this._getSnapshots("search", searchIDs, "searches"),
					},
					library: {
						params: { libraryID: "number" },
						handler: ({ libraryID }) => this._readSnapshot("library", { id: libraryID }),
					},
					libraries: {
						handler: () => ({
							userLibraryID: Zotero.Libraries.userLibraryID,
							libraries: Zotero.Libraries.getAll().map(lazy.DataSnapshots.library),
						}),
					},
					findItems: {
						params: {
							libraryID: "number",
							conditions: lazy.DataParams.conditionList(true),
							includeTrashed: { type: "boolean", optional: true },
						},
						handler: ({ libraryID, conditions, includeTrashed }) => this._findItems(libraryID, conditions, includeTrashed),
					},
					findCollections: {
						params: {
							libraryID: "number",
							parentID: { type: "number", optional: true },
							recursive: { type: "boolean", optional: true },
						},
						handler: ({ libraryID, parentID, recursive }) => this._findCollections(libraryID, parentID, recursive),
					},
					findSearches: {
						params: { libraryID: "number" },
						handler: ({ libraryID }) => {
							this._requireLibrary(libraryID);
							return { searchIDs: Zotero.Searches.getByLibrary(libraryID).map(search => search.id) };
						},
					},
					tags: {
						params: { libraryID: "number" },
						handler: ({ libraryID }) => this._getTags(libraryID),
					},
					schema: {
						params: { itemType: { type: "string", optional: true } },
						handler: ({ itemType }) => this._getSchema(itemType),
					},
					findDuplicates: {
						params: { libraryID: "number" },
						handler: ({ libraryID }) => this._findDuplicates(libraryID),
					},
					topLevelItems: {
						params: { itemIDs: lazy.Params.intList },
						handler: ({ itemIDs }) => this._getTopLevelItems(itemIDs),
					},
					fulltext: {
						params: { itemID: "number" },
						handler: ({ itemID }) => this._getFulltext(itemID),
					},
					file: {
						params: { itemID: "number" },
						handler: ({ itemID }, { caller }) => this._getFile(itemID, caller),
					},
				},
				objectTypes: {
					item: {
						resolve: id => resolveObject(OBJECTS.item, id),
						address: lazy.DataAddress.objectAddress(OBJECTS.item),
						create: {
							params: {
								libraryID: { type: "number", optional: true },
								itemType: "string",
								parent: lazy.DataParams.idRef("item", true),
								linkMode: { type: "string", optional: true },
								...Object.fromEntries(lazy.DataItemFields.createFields().map(field => [field, {
									...lazy.Params.scalarOrObject,
									optional: true,
								}])),
							},
							handler: async (params, ctx) => {
								let { itemType, linkMode } = params;
								let { libraryID, parentID } = this._placeCreated("item", params, ctx);
								if (!Zotero.ItemTypes.getID(itemType)) {
									throw new Error(`Unknown item type '${itemType}'`);
								}
								let item = new Zotero.Item(itemType);
								item.libraryID = libraryID;
								if (linkMode !== undefined) {
									// File-backed attachments are created through the file API
									if (linkMode !== "linked_url") {
										throw new Error(`linkMode '${linkMode}' needs the file API; only linked_url can be created here`);
									}
									// Core refuses it on another kind
									item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_URL;
								}
								// Core would save one without
								else if (itemType === "attachment") {
									throw new Error("An attachment needs a linkMode");
								}
								if (parentID !== undefined) {
									item.parentID = parentID;
								}
								if (itemType === "annotation") {
									await this._requireAnnotatable(item, params);
								}
								// Under setField's rules, which refuse another kind's property
								for (let field of lazy.DataItemFields.createFields()) {
									if (params[field] === undefined) {
										continue;
									}
									let reason = lazy.DataItemFields.check(item, field, params[field]);
									if (reason) {
										throw new Error(reason);
									}
									lazy.DataItemFields.apply(item, field, params[field]);
								}
								return item;
							},
						},
						revision: item => item.clientVersion,
						isEditable: item => item.isEditable(),
						save: item => item.save(),
						restore: item => item.reload(null, true),
						describe: item => ({ id: item.id, key: item.key, libraryID: item.libraryID }),
						snapshot: lazy.DataSnapshots.item,
						operations: {
							setType: {
								params: { itemType: "string" },
								check: (item, { itemType }) => !Zotero.ItemTypes.getID(itemType) && `unknown item type '${itemType}'`,
								apply: (item, { itemType }) => {
									item.setType(Zotero.ItemTypes.getID(itemType));
								},
							},
							setField: {
								params: { field: "string", value: lazy.Params.scalarOrObject },
								check: (item, { field, value }) => lazy.DataItemFields.check(item, field, value),
								apply: (item, { field, value }) => lazy.DataItemFields.apply(item, field, value),
							},
							setCreators: {
								params: { creators: "array" },
								apply: (item, { creators }) => {
									item.setCreators(creators, { strict: true });
								},
							},
							addCreator: {
								params: { creator: "object" },
								apply: (item, { creator }) => {
									item.setCreator(item.numCreators(), creator, { strict: true });
								},
							},
							setTags: {
								params: { tags: "array" },
								apply: (item, { tags }) => {
									item.setTags(tags);
								},
							},
							addTag: {
								params: { tag: lazy.Params.nonEmptyString, type: { type: "number", optional: true } },
								apply: (item, { tag, type }) => {
									item.addTag(tag, type);
								},
							},
							removeTag: {
								params: { tag: "string" },
								apply: (item, { tag }) => {
									item.removeTag(tag);
								},
							},
							setCollections: {
								params: { collections: lazy.DataParams.idRefList("collection") },
								apply: (item, { collections }, ctx) => {
									item.setCollections(collections.map(value => ctx.resolveID("collection", value,
										{ scope: item.libraryID, what: "Param 'collections'" })));
								},
							},
							addToCollection: {
								params: { collection: lazy.DataParams.idRef("collection") },
								apply: (item, { collection }, ctx) => {
									item.addToCollection(ctx.resolveID("collection", collection,
										{ scope: item.libraryID, what: "Param 'collection'" }));
								},
							},
							removeFromCollection: {
								params: { collection: lazy.DataParams.idRef("collection") },
								apply: (item, { collection }, ctx) => {
									item.removeFromCollection(ctx.resolveID("collection", collection,
										{ scope: item.libraryID, what: "Param 'collection'" }));
								},
							},
							setRelations: {
								params: { relations: "object" },
								apply: (item, { relations }) => {
									item.setRelations(relations);
								},
							},
							addRelation: {
								params: { predicate: "string", object: "string" },
								apply: (item, { predicate, object }) => {
									item.addRelation(predicate, object);
								},
							},
							removeRelation: {
								params: { predicate: "string", object: "string" },
								apply: (item, { predicate, object }) => {
									item.removeRelation(predicate, object);
								},
							},
							setNote: {
								params: { note: "string" },
								apply: (item, { note }) => {
									item.setNote(note);
								},
							},
							setParent: {
								params: { parent: lazy.DataParams.nullableIDRef("item") },
								apply: (item, { parent }, ctx) => {
									item.parentID = parent === null
										? false
										: ctx.resolveID("item", parent, { scope: item.libraryID, what: "Param 'parent'" });
								},
							},
							setInPublications: {
								params: { value: "boolean" },
								apply: (item, { value }) => {
									item.inPublications = value;
								},
							},
							trash: {
								needsID: true,
								check: item => !Zotero.Libraries.get(item.libraryID)?.hasTrash && "this library has no trash",
								apply: item => Zotero.Items.trash([item.id]),
							},
							restore: {
								apply: (item) => {
									item.deleted = false;
								},
							},
							erase: {
								terminal: true,
								needsID: true,
								apply: item => item.erase(),
							},
						},
					},
					collection: {
						resolve: id => resolveObject(OBJECTS.collection, id),
						address: lazy.DataAddress.objectAddress(OBJECTS.collection),
						create: {
							params: {
								libraryID: { type: "number", optional: true },
								name: lazy.Params.nonEmptyString,
								parent: lazy.DataParams.idRef("collection", true),
							},
							handler: (params, ctx) => {
								let { libraryID, parentID } = this._placeCreated("collection", params, ctx);
								let collection = new Zotero.Collection();
								collection.libraryID = libraryID;
								collection.name = params.name;
								if (parentID !== undefined) {
									collection.parentID = parentID;
								}
								return collection;
							},
						},
						revision: collection => collection.clientVersion,
						isEditable: collection => collection.isEditable(),
						save: collection => collection.save(),
						restore: collection => collection.reload(null, true),
						describe: collection => ({ id: collection.id, key: collection.key, libraryID: collection.libraryID }),
						snapshot: lazy.DataSnapshots.collection,
						operations: {
							setName: {
								params: { name: lazy.Params.nonEmptyString },
								apply: (collection, { name }) => {
									collection.name = name;
								},
							},
							setParent: {
								params: { parent: lazy.DataParams.nullableIDRef("collection") },
								apply: (collection, { parent }, ctx) => {
									collection.parentID = parent === null
										? false
										: ctx.resolveID("collection", parent, { scope: collection.libraryID, what: "Param 'parent'" });
								},
							},
							addItems: {
								needsID: true,
								params: { items: lazy.DataParams.idRefList("item") },
								apply: (collection, { items }, ctx) => collection.addItems(
									items.map(value => ctx.resolveID("item", value, { scope: collection.libraryID, what: "Param 'items'" }))
								),
							},
							removeItems: {
								needsID: true,
								params: { items: lazy.DataParams.idRefList("item") },
								apply: (collection, { items }, ctx) => collection.removeItems(
									items.map(value => ctx.resolveID("item", value, { scope: collection.libraryID, what: "Param 'items'" }))
								),
							},
							trash: {
								apply: (collection) => {
									collection.deleted = true;
								},
							},
							restore: {
								apply: (collection) => {
									collection.deleted = false;
								},
							},
							erase: {
								terminal: true,
								needsID: true,
								apply: collection => collection.erase(),
							},
						},
					},
					search: {
						resolve: id => resolveObject(OBJECTS.search, id),
						address: lazy.DataAddress.objectAddress(OBJECTS.search),
						create: {
							params: { libraryID: "number", name: "string", conditions: lazy.DataParams.conditionList(true) },
							handler: ({ libraryID, name, conditions = [] }) => {
								this._requireEditableLibrary(libraryID);
								let search = new Zotero.Search();
								search.libraryID = libraryID;
								search.name = name;
								setSearchConditions(search, conditions);
								return search;
							},
						},
						revision: search => search.clientVersion,
						isEditable: search => search.isEditable(),
						save: search => search.save(),
						restore: search => search.reload(null, true),
						describe: search => ({ id: search.id, key: search.key, libraryID: search.libraryID }),
						snapshot: lazy.DataSnapshots.search,
						operations: {
							setName: {
								params: { name: "string" },
								apply: (search, { name }) => {
									search.name = name;
								},
							},
							setConditions: {
								params: { conditions: lazy.DataParams.conditionList() },
								apply: (search, { conditions }) => setSearchConditions(search, conditions),
							},
							addCondition: {
								params: lazy.DataParams.condition,
								apply: (search, { condition, operator, value }) => {
									search.addCondition(condition, operator, value ?? "");
								},
							},
							erase: {
								terminal: true,
								needsID: true,
								apply: search => search.erase(),
							},
						},
					},
					library: {
						// Feeds and the tag helpers open their own transactions, so these run after the store's
						transactional: false,
						resolve: id => Zotero.Libraries.get(id) || null,
						address: lazy.DataAddress.objectAddress(),
						create: {
							params: {
								libraryType: {
									type: "string",
									checkHook: value => value === "feed" || "only feed libraries can be created",
								},
								name: lazy.Params.nonEmptyString,
								...lazy.DataParams.feedSettings,
								url: lazy.Params.nonEmptyString,
							},
							handler: ({ libraryType: _type, name, ...settings }) => new Zotero.Feed(
								Object.fromEntries([["name", name], ...Object.entries(settings).filter(([, value]) => value !== undefined)])
							),
						},
						// Feeds are not user-editable libraries, but their own settings are
						isEditable: library => library.editable || !!library.isFeed,
						save: library => (library.isFeed && Object.keys(library._changed).length ? library.saveTx() : undefined),
						describe: library => ({ id: library.libraryID }),
						snapshot: lazy.DataSnapshots.library,
						operations: {
							setName: {
								params: { name: lazy.Params.nonEmptyString },
								check: feedOnly("can be renamed"),
								apply: (library, { name }) => {
									library.name = name;
								},
							},
							setFeed: {
								params: lazy.DataParams.feedSettings,
								check: feedOnly("have feed settings"),
								apply: (library, settings) => {
									for (let setting of Object.keys(lazy.DataParams.feedSettings)) {
										if (settings[setting] !== undefined) {
											library[setting] = settings[setting];
										}
									}
								},
							},
							refreshFeed: {
								needsID: true,
								check: feedOnly("can be refreshed"),
								apply: library => library.updateFeed(),
							},
							clearExpiredFeedItems: {
								needsID: true,
								check: feedOnly("have expiring items"),
								apply: library => library.clearExpiredItems(),
							},
							markRead: {
								needsID: true,
								params: { items: lazy.DataParams.idRefList("item"), read: "boolean" },
								check: feedOnly("have items with a read state"),
								apply: async (library, { items, read }, ctx) => {
									for (let value of items) {
										let itemID = ctx.resolveID("item", value, { scope: library.libraryID, what: "Param 'items'" });
										let item = await Zotero.Items.getAsync(itemID);
										if (!item?.isFeedItem || item.libraryID !== library.libraryID) {
											throw new Error(`Item ${itemID} is not an item of this feed`);
										}
										await item.toggleRead(read);
									}
								},
							},
							erase: {
								terminal: true,
								needsID: true,
								check: feedOnly("can be erased"),
								apply: library => library.eraseTx(),
							},
							// Deferred entries apply after the store transaction, so an unknown tag is caught before it commits
							renameTag: {
								params: { from: lazy.Params.nonEmptyString, to: lazy.Params.nonEmptyString },
								check: (library, { from }) => !Zotero.Tags.getID(from) && `tag '${from}' not found`,
								apply: (library, { from, to }) => Zotero.Tags.rename(library.libraryID, from, to),
							},
							removeTag: {
								params: { tag: lazy.Params.nonEmptyString },
								check: (library, { tag }) => !Zotero.Tags.getID(tag) && `tag '${tag}' not found`,
								apply: (library, { tag }) => Zotero.Tags.removeFromLibrary(library.libraryID, [Zotero.Tags.getID(tag)]),
							},
							setTagColor: {
								params: {
									tag: lazy.Params.nonEmptyString,
									color: {
										type: "any",
										checkHook: value => value === null || typeof value === "string" || "must be a hex color string or null",
									},
									position: { type: "number", optional: true },
								},
								apply: (library, { tag, color, position }) => Zotero.Tags.setColor(library.libraryID, tag, color, position),
							},
						},
					},
				},
			};
		}

		// The core refuses data in memory; a save, an operation that runs against the database (needsID,
		// terminal) or any step of a deferred type fails for other reasons
		_isCallerError(e, { entry, kind, op }) {
			if (!isCoreRefusal(e) || kind === "save" || !entry.def.transactional) {
				return false;
			}
			return !op || !(op.def.needsID || op.def.terminal);
		}

		/**
		 * @param {"item" | "collection" | "search"} type
		 * @param {number[]} ids
		 * @param {string} resultKey
		 * @returns {Promise<object>} The snapshots under `resultKey`, in order; any missing ID is NotFound
		 */
		async _getSnapshots(type, ids, resultKey) {
			let def = this._objectTypes.get(type);
			let targets = await resolveObjects(OBJECTS[type], ids);
			let snapshots = targets.map((target, i) => {
				if (!target) {
					this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `No ${type} with ID ${ids[i]}`);
				}
				return def.snapshot(target);
			});
			return { [resultKey]: snapshots };
		}

		_requireLibrary(libraryID) {
			if (!Zotero.Libraries.exists(libraryID)) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `No library with ID ${libraryID}`);
			}
		}

		_requireEditableLibrary(libraryID) {
			this._requireLibrary(libraryID);
			if (!Zotero.Libraries.isEditable(libraryID)) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_ALLOWED, `Library ${libraryID} is not editable`);
			}
		}

		/**
		 * Where a created object goes: its own libraryID, else its parent's library, else the change set's, the
		 * order a bare key resolves in. The parent is resolved once here, for the handler to set
		 * @param {"item" | "collection"} type
		 * @param {{ libraryID?: number, parent?: StoreIDRef }} params - The create block
		 * @param {StoreCommitContext} ctx
		 * @returns {{ libraryID: number, parentID?: number }}
		 */
		_placeCreated(type, { libraryID, parent }, ctx) {
			let parentID;
			if (parent !== undefined) {
				parentID = ctx.resolveID(type, parent, { scope: libraryID, what: "Param 'parent'" });
				if (libraryID === undefined) {
					let placed = OBJECTS[type].getLibraryAndKeyFromID(parentID);
					if (!placed) {
						this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `Param 'parent': no ${type} with ID ${parentID}`);
					}
					libraryID = placed.libraryID;
				}
			}
			if (libraryID === undefined && Number.isInteger(ctx.defaults.libraryID)) {
				libraryID = ctx.defaults.libraryID;
			}
			if (libraryID === undefined) {
				throw new Error(`A new ${type} needs a libraryID, a parent or the change set's libraryID`);
			}
			this._requireEditableLibrary(libraryID);
			return { libraryID, parentID };
		}

		/**
		 * Refuse a new annotation core refuses only at save, among database failures: a parent that cannot have
		 * one, as core checks it, or a create block missing what its row needs
		 * @param {Zotero.Item} item - With its parent set, if any
		 * @param {object} params - The create block
		 */
		async _requireAnnotatable(item, params) {
			let parentItem = item.parentID && await Zotero.Items.getAsync(item.parentID);
			if (!parentItem || !parentItem.isFileAttachment() || !parentItem.attachmentReaderType) {
				throw new Error("An annotation needs a PDF, EPUB or snapshot attachment as parent");
			}
			let missing = lazy.DataItemFields.createFields("annotation").filter(field => params[field] === undefined);
			if (missing.length) {
				throw new Error(`An annotation needs ${missing.join(", ")}`);
			}
		}

		/**
		 * @param {number} libraryID
		 * @param {SearchCondition[]} [conditions] - None returns every item in the library
		 * @param {boolean} [includeTrashed]
		 * @returns {Promise<DataStoreQueryResults["findItems"]>}
		 */
		async _findItems(libraryID, conditions = [], includeTrashed = false) {
			this._requireLibrary(libraryID);
			let search = new Zotero.Search();
			search.libraryID = libraryID;
			conditions.forEach(({ condition, operator, value }, i) => {
				try {
					search.addCondition(condition, operator, value ?? "");
				}
				catch (e) {
					this._throw(lazy.StoreAPIBase.errorCodes.INVALID_PARAMS, `Param 'conditions[${i}]': ${e.message}`);
				}
			});
			if (includeTrashed) {
				search.addCondition("includeDeleted", "true");
			}
			return { itemIDs: await search.search() };
		}

		/**
		 * @param {number} libraryID
		 * @param {number} [parentID] - The children of this collection instead of the library's top level
		 * @param {boolean} [recursive]
		 * @returns {DataStoreQueryResults["findCollections"]}
		 */
		_findCollections(libraryID, parentID, recursive = false) {
			this._requireLibrary(libraryID);
			let collections;
			if (parentID === undefined) {
				collections = Zotero.Collections.getByLibrary(libraryID, recursive);
			}
			else {
				let parent = Zotero.Collections.get(parentID);
				if (!parent || parent.libraryID !== libraryID) {
					this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `No collection with ID ${parentID} in library ${libraryID}`);
				}
				collections = Zotero.Collections.getByParent(parentID, recursive);
			}
			return { collectionIDs: collections.map(collection => collection.id) };
		}

		/**
		 * @param {string} [itemType] - One type instead of all; search conditions come only with all
		 * @returns {DataStoreQueryResults["schema"]}
		 */
		_getSchema(itemType) {
			let types = Zotero.ItemTypes.getAll();
			if (itemType !== undefined) {
				let typeID = Zotero.ItemTypes.getID(itemType);
				if (!typeID) {
					this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `No item type '${itemType}'`);
				}
				types = types.filter(type => type.id == typeID);
			}
			let itemTypes = types.map(({ id, name }) => {
				let primaryCreatorType = Zotero.CreatorTypes.getPrimaryIDForType(id);
				return {
					name,
					localized: Zotero.ItemTypes.getLocalizedString(id),
					fields: Zotero.ItemFields.getItemTypeFields(id).map((fieldID) => {
						let field = { name: Zotero.ItemFields.getName(fieldID), localized: Zotero.ItemFields.getLocalizedString(fieldID) };
						let baseID = Zotero.ItemFields.getBaseIDFromTypeAndField(id, fieldID);
						if (baseID && baseID != fieldID) {
							field.baseField = Zotero.ItemFields.getName(baseID);
						}
						return field;
					}),
					creatorTypes: Zotero.CreatorTypes.getTypesForItemType(id).map(creatorType => ({
						name: creatorType.name,
						localized: creatorType.localizedName,
						primary: creatorType.id == primaryCreatorType,
					})),
				};
			});
			let result = { itemTypes };
			if (itemType === undefined) {
				result.searchConditions = Zotero.SearchConditions.getStandardConditions().map(({ name, localized, operators }) => ({
					name,
					localized,
					operators: Object.keys(operators || {}),
				}));
			}
			return result;
		}

		/**
		 * @param {number} libraryID
		 * @returns {Promise<DataStoreQueryResults["findDuplicates"]>}
		 */
		async _findDuplicates(libraryID) {
			this._requireLibrary(libraryID);
			let duplicates = new Zotero.Duplicates(libraryID);
			let search = await duplicates.getSearchObject();
			let seen = new Set();
			let sets = [];
			for (let itemID of await search.search()) {
				if (seen.has(itemID)) {
					continue;
				}
				let set = duplicates.getSetItemsByItemID(itemID);
				set.forEach(id => seen.add(id));
				sets.push(set);
			}
			return { sets };
		}

		/**
		 * @param {number[]} itemIDs
		 * @returns {Promise<DataStoreQueryResults["topLevelItems"]>}
		 */
		async _getTopLevelItems(itemIDs) {
			let items = await Zotero.Items.getAsync(itemIDs);
			let found = new Set(items.map(item => item.id));
			let missing = itemIDs.find(itemID => !found.has(itemID));
			if (missing !== undefined) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `No item with ID ${missing}`);
			}
			return { itemIDs: Zotero.Items.getTopLevel(items).map(item => item.id) };
		}

		/**
		 * @param {number} itemID - An attachment
		 * @returns {Promise<DataStoreQueryResults["fulltext"]>}
		 */
		async _getFulltext(itemID) {
			let item = await Zotero.Items.getAsync(itemID);
			if (!item) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `No item with ID ${itemID}`);
			}
			if (!item.isAttachment()) {
				this._throw(lazy.StoreAPIBase.errorCodes.INVALID_PARAMS, `Item ${itemID} is not an attachment`);
			}
			let state = await Zotero.Fulltext.getIndexedState(item);
			let pages = await Zotero.Fulltext.getPages(itemID);
			return {
				state: FULLTEXT_STATES[state] || "unavailable",
				indexedPages: pages?.indexedPages ?? null,
				totalPages: pages?.total ?? null,
			};
		}

		/**
		 * The attachment's file as the file store addresses it; asking is the grant, to read, or to write with
		 * dataWrite on a file the user could edit, until the plugin unloads
		 * @param {number} itemID - An attachment
		 * @returns {Promise<DataStoreQueryResults["file"]>}
		 */
		async _getFile(itemID, caller) {
			let item = await Zotero.Items.getAsync(itemID);
			if (!item) {
				this._throw(lazy.StoreAPIBase.errorCodes.NOT_FOUND, `No item with ID ${itemID}`);
			}
			if (!item.isAttachment()) {
				this._throw(lazy.StoreAPIBase.errorCodes.INVALID_PARAMS, `Item ${itemID} is not an attachment`);
			}
			let native = item.getFilePath();
			if (!native) {
				return { path: null, exists: false };
			}
			let path = lazy.PathIdentity.canonicalize(native);
			if (caller.pluginID) {
				let canWrite = lazy.VarCheck.hasPermissions(caller.scope, "dataWrite")
					&& item.isEditable() && Zotero.Libraries.get(item.libraryID).filesEditable;
				lazy.PluginFileAccess.grantAttachment(caller.pluginID, path, canWrite ? "write" : "read");
			}
			return { path, exists: await lazy.FileIO.exists(path) };
		}

		/**
		 * @param {number} libraryID
		 * @returns {Promise<DataStoreQueryResults["tags"]>}
		 */
		async _getTags(libraryID) {
			this._requireLibrary(libraryID);
			let colors = Zotero.Tags.getColors(libraryID);
			let tags = (await Zotero.Tags.getAll(libraryID)).map(({ tag, type }) => {
				let info = { name: tag, type };
				let color = colors.get(tag);
				if (color) {
					info.color = color.color;
					info.position = color.position;
				}
				return info;
			});
			return { tags };
		}
	}

	// The builder scripts, in chrome; every dataRead sandbox gets its own copy under the same names
	let builder = lazy.ScopeUtils.loadChangeSet("chrome://zotero/content/xpcom/plugins/dataChangeSet.js");

	/**
	 * Snapshot reads and change set commits for library data. Requests take and return plain objects
	 * only; a change set is built locally with ChangeSet and applied by commit in one transaction
	 *
	 * @memberof Zotero
	 */
	Zotero.DataStore = {
		errorCodes: lazy.StoreAPIBase.errorCodes,

		ChangeSet: builder.DataChangeSet,

		_dataStore: new DataStoreInternal(),

		/**
		 * For chrome code handing an item to a plugin hook in place of the live object, including per-row
		 * ones: the expensive parts are lazy and cached. Not in the sandbox schema
		 * @param {Zotero.Item} item
		 * @returns {ItemSnapshot}
		 */
		itemSnapshot: lazy.DataSnapshots.item,

		/**
		 * The `getItem` a synchronous hook passes. Not in the sandbox schema
		 * @param {number} [ownItemID]
		 * @param {string} pluginID
		 * @returns {SyncItemGetter}
		 */
		itemGetter,

		/**
		 * @returns {string[]} The object types a change set can address
		 */
		get objectTypes() {
			return this._dataStore.objectTypes;
		},

		/**
		 * @returns {Record<string, string[]>} Operation names by object type
		 */
		get operationNames() {
			return this._dataStore.operationNames;
		},

		/**
		 * Read snapshots, find objects, or validate a change set
		 * @template {keyof DataStoreQueryParams} N
		 * @param {N} name
		 * @param {DataStoreQueryParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<APIResponse<DataStoreQueryResults[N]>>}
		 */
		query(name, params, _callerPluginID) {
			return Zotero.DataStore._dataStore.query(name, params, _callerPluginID);
		},

		/**
		 * Apply a change set in one transaction; nothing is applied unless the whole set passes
		 * @param {DataChangeSet | StoreChangeSet} changes
		 * @param {{ snapshots?: boolean }} [options] - snapshots: return each surviving object's new snapshot
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<APIResponse<StoreCommitResult>>}
		 */
		commit(changes, options, _callerPluginID) {
			return Zotero.DataStore._dataStore.commit(changes, options, _callerPluginID);
		},
	};

	// The traditional form, parallel to ChangeSet and as every sandbox gets it: Zotero.DataStore.Handle.item(target)
	Zotero.DataStore.Handle = builder.ChangeSetBase.handleClass(Zotero.DataStore, builder.DataChangeSet);

	let injectCaller = ({ pluginID, args }) => {
		args[2] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.DataStore.query, injectCaller);
	lazy.ScopeVariables.setCustomParser(Zotero.DataStore.commit, injectCaller);

	// Some core paths change what an item's JSON says without saving it (a tag rename, a collection erase,
	// Items.trash), so the snapshot cache cannot key on the revision alone and hears about them here
	Zotero.Notifier.registerObserver({
		notify(event, type, ids) {
			if (type === "collection") {
				// Erasing a collection edits every member item in memory, and the event does not say which
				if (event === "delete") {
					lazy.DataSnapshots.invalidate();
				}
				return;
			}
			// item-tag IDs are "itemID-tagID"
			let itemIDs = type === "item-tag" ? ids.map(id => parseInt(String(id).split("-")[0])) : ids;
			lazy.DataSnapshots.invalidate(itemIDs);
		},
	}, ["item", "item-tag", "collection"], "dataStore");
}
