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

// toJSON() is the expensive part of a snapshot, so it is kept per live item until the item is saved
// (clientVersion) or synced (version), or until invalidate() says a core path changed it without a save
let itemJSONCache = new WeakMap();

/**
 * The live item behind an ID, or null when it is not in memory
 */
function loadedItem(itemID) {
	try {
		return Zotero.Items.get(itemID) || null;
	}
	catch (e) {
		if (!(e instanceof Zotero.Exception.UnloadedDataException)) {
			throw e;
		}
		return null;
	}
}

/**
 * Read-only JSON of one object at one moment, the only form library data reaches a plugin in
 */
const DataSnapshots = {
	kind(item) {
		if (item.isNote()) {
			return "note";
		}
		if (item.isAttachment()) {
			return "attachment";
		}
		if (item.isAnnotation()) {
			return "annotation";
		}
		return "regular";
	},

	/**
	 * Read part of a snapshot from an item a synchronous hook caught mid-load: an unloaded data type
	 * reads as null and the load is started, so the next refresh finds it
	 */
	whenLoaded(item, read) {
		try {
			return read();
		}
		catch (e) {
			if (!(e instanceof Zotero.Exception.UnloadedDataException)) {
				throw e;
			}
			item.loadAllData().catch(err => Zotero.logError(err));
			return null;
		}
	},

	/**
	 * Define a property computed on first read; the boundary's lazy wrapping then builds it only when
	 * a plugin actually reads it
	 */
	lazyProperty(object, name, compute) {
		Object.defineProperty(object, name, {
			enumerable: true,
			configurable: true,
			get() {
				let value = compute();
				Object.defineProperty(object, name, { value, enumerable: true, writable: false, configurable: false });
				return value;
			},
		});
	},

	/**
	 * toJSON() throws UnloadedDataException itself for a data type it needs that is not loaded, which
	 * whenLoaded() turns into a null read; a type the item's kind skips (a regular item's note) never is
	 */
	itemJSON(item) {
		if (item.hasChanged()) {
			return item.toJSON();
		}
		let cached = itemJSONCache.get(item);
		if (cached && cached.clientVersion === item.clientVersion && cached.version === item.version) {
			return cached.json;
		}
		let json = item.toJSON();
		itemJSONCache.set(item, { clientVersion: item.clientVersion, version: item.version, json });
		return json;
	},

	/**
	 * Drop the cached JSON of these items, or of every item when a change cannot be attributed to items
	 * @param {number[]} [itemIDs]
	 */
	invalidate(itemIDs) {
		if (!itemIDs) {
			itemJSONCache = new WeakMap();
			return;
		}
		for (let itemID of itemIDs) {
			let item = loadedItem(itemID);
			if (item) {
				itemJSONCache.delete(item);
			}
		}
	},

	/**
	 * The envelope reads primary data, which a live item always has; everything else is lazy and reads
	 * as null while the item is still loading
	 * @param {Zotero.Item} item
	 * @returns {ItemSnapshot}
	 */
	item(item) {
		let snapshot = {
			type: "item",
			id: item.id,
			libraryID: item.libraryID,
			key: item.key,
			revision: item.clientVersion,
			kind: DataSnapshots.kind(item),
			parentID: item.parentID || null,
		};
		let lazily = (name, read) => DataSnapshots.lazyProperty(snapshot, name, () => DataSnapshots.whenLoaded(item, read));
		lazily("collectionIDs", () => item.getCollections());
		lazily("displayTitle", () => item.getDisplayTitle());
		if (item.isRegularItem()) {
			lazily("children", () => ({ notes: item.getNotes(), attachments: item.getAttachments() }));
		}
		else if (item.isFileAttachment()) {
			lazily("children", () => ({ annotations: item.getAnnotations(false, true) }));
		}
		if (item.isFeedItem) {
			snapshot.feedItem = { read: !!item.isRead, guid: item.guid };
		}
		lazily("data", () => DataSnapshots.itemJSON(item));
		return snapshot;
	},

	/**
	 * @param {Zotero.Collection} collection
	 * @returns {CollectionSnapshot}
	 */
	collection(collection) {
		return {
			type: "collection",
			id: collection.id,
			libraryID: collection.libraryID,
			key: collection.key,
			revision: collection.clientVersion,
			parentID: collection.parentID || null,
			childCollectionIDs: collection.getChildCollections(true) || [],
			itemIDs: collection.getChildItems(true) || [],
			data: collection.toJSON(),
		};
	},

	/**
	 * @param {Zotero.Search} search
	 * @returns {SearchSnapshot}
	 */
	search(search) {
		return {
			type: "search",
			id: search.id,
			libraryID: search.libraryID,
			key: search.key,
			revision: search.clientVersion,
			data: search.toJSON(),
		};
	},

	/**
	 * @param {Zotero.Library} library
	 * @returns {LibrarySnapshot}
	 */
	library(library) {
		let snapshot = {
			type: "library",
			id: library.libraryID,
			libraryType: library.libraryType,
			name: library.name,
			editable: library.editable,
			filesEditable: library.filesEditable,
			hasTrash: library.hasTrash,
			clientVersion: library.clientVersion,
		};
		if (library.libraryType === "group") {
			let groupID = Zotero.Groups.getGroupIDFromLibraryID(library.libraryID);
			snapshot.group = { id: groupID, description: Zotero.Groups.get(groupID)?.description ?? "" };
		}
		else if (library.isFeed) {
			snapshot.feed = {
				url: library.url,
				refreshInterval: library.refreshInterval ?? null,
				cleanupReadAfter: library.cleanupReadAfter ?? null,
				cleanupUnreadAfter: library.cleanupUnreadAfter ?? null,
				lastCheck: library.lastCheck ?? null,
				lastUpdate: library.lastUpdate ?? null,
				lastCheckError: library.lastCheckError ?? null,
				unreadCount: library.unreadCount ?? 0,
				updating: !!library.updating,
			};
		}
		return snapshot;
	},
};

export { DataSnapshots };
