import { Zotero } from "chrome://zotero/content/zotero.mjs";

export function mergeItems(item, otherItems) {
	Zotero.debug("Merging items");
	
	return Zotero.DB.executeTransaction(async function () {
		var toSave = {};
		toSave[item.id] = item;

		var earliestDateAdded = item.dateAdded;

		let remapAttachmentKeys = await mergePDFAttachments(item, otherItems);
		await mergeWebAttachments(item, otherItems);
		await mergeOtherAttachments(item, otherItems);

		for (let otherItem of otherItems) {
			if (otherItem.libraryID !== item.libraryID) {
				throw new Error('Items being merged must be in the same library');
			}

			// Use the earliest date added of all the items
			if (otherItem.dateAdded < earliestDateAdded) {
				earliestDateAdded = otherItem.dateAdded;
			}

			// Move notes to master
			var noteIDs = otherItem.getNotes(true);
			for (let id of noteIDs) {
				var note = await Zotero.Items.getAsync(id);
				note.parentItemID = item.id;
				Zotero.Notes.replaceItemKey(note, otherItem.key, item.key);
				Zotero.Notes.replaceAllItemKeys(note, remapAttachmentKeys);
				toSave[note.id] = note;
			}

			// Move relations to master
			await moveRelations(otherItem, item);

			// old item, which will be put in the trash

			// Add collections to master
			otherItem.getCollections().forEach(id => item.addToCollection(id));

			// Add tags to master
			var tags = otherItem.getTags();
			for (let j = 0; j < tags.length; j++) {
				let tagName = tags[j].tag;
				if (item.hasTag(tagName)) {
					let type = item.getTagType(tagName);
					// If existing manual tag, leave that
					if (type == 0) {
						continue;
					}
					// Otherwise, add the non-master item's tag, which may be manual, in which
					// case it will remain at the end
					item.addTag(tagName, tags[j].type);
				}
				// If no existing tag, add with the type from the non-master item
				else {
					item.addTag(tagName, tags[j].type);
				}
			}

			// Trash other item
			otherItem.deleted = true;
			toSave[otherItem.id] = otherItem;
		}

		item.setField('dateAdded', earliestDateAdded);

		// Hack to remove master item from duplicates view without recalculating duplicates
		// Pass force = true so observers will be notified before this transaction is committed
		await Zotero.Notifier.trigger('removeDuplicatesMaster', 'item', item.id, null, true);

		for (let item of Object.values(toSave)) {
			await item.save();
		}
	});
}

async function mergePDFAttachments(item, otherItems) {
	Zotero.DB.requireTransaction();

	let remapAttachmentKeys = new Map();
	let masterAttachmentHashes = await hashItem(item, 'bytes');
	let hashesIncludeText = false;

	for (let otherItem of otherItems) {
		let mergedMasterAttachments = new Set();

		let doMerge = async (fromAttachment, toAttachment) => {
			mergedMasterAttachments.add(toAttachment.id);

			await Zotero.Items.moveChildItems(
				fromAttachment,
				toAttachment,
				{
					includeTrashed: true,
					skipEditCheck: true
				}
			);
			await moveEmbeddedNote(fromAttachment, toAttachment);
			await moveRelations(fromAttachment, toAttachment);

			fromAttachment.deleted = true;
			await fromAttachment.save();

			// Later on, when processing notes, we'll use this to remap
			// URLs pointing to the old attachment.
			remapAttachmentKeys.set(fromAttachment.key, toAttachment.key);

			// Items can only have one replaced item predicate
			if (!toAttachment.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate)) {
				toAttachment.addRelation(Zotero.Relations.replacedItemPredicate,
					Zotero.URI.getItemURI(fromAttachment));
			}

			await toAttachment.save();
		};

		for (let otherAttachment of await Zotero.Items.getAsync(otherItem.getAttachments(true))) {
			if (!otherAttachment.isPDFAttachment()) {
				continue;
			}

			// First check if master has an attachment with identical MD5 hash
			let matchingHash = await otherAttachment.attachmentHash;
			let masterAttachmentID = masterAttachmentHashes.get(matchingHash);

			if (!masterAttachmentID && item.numAttachments()) {
				// If that didn't work, hash master attachments by the
				// most common words in their text and check again.
				if (!hashesIncludeText) {
					masterAttachmentHashes = new Map([
						...masterAttachmentHashes,
						...(await hashItem(item, 'text'))
					]);
					hashesIncludeText = true;
				}

				matchingHash = await hashAttachmentText(otherAttachment);
				masterAttachmentID = masterAttachmentHashes.get(matchingHash);
			}

			if (!masterAttachmentID || mergedMasterAttachments.has(masterAttachmentID)) {
				Zotero.debug(`No unmerged match for attachment ${otherAttachment.key} in master item - moving`);
				otherAttachment.parentItemID = item.id;
				await otherAttachment.save();
				continue;
			}

			let masterAttachment = await Zotero.Items.getAsync(masterAttachmentID);

			if (masterAttachment.attachmentContentType !== otherAttachment.attachmentContentType) {
				Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key}, `
					+ 'but content types differ - keeping both');
				otherAttachment.parentItemID = item.id;
				await otherAttachment.save();
				continue;
			}

			if (!((masterAttachment.isImportedAttachment() && otherAttachment.isImportedAttachment())
				|| (masterAttachment.isLinkedFileAttachment() && otherAttachment.isLinkedFileAttachment()))) {
				Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key}, `
					+ 'but link modes differ - keeping both');
				otherAttachment.parentItemID = item.id;
				await otherAttachment.save();
				continue;
			}

			// Check whether master and other have embedded annotations
			// Error -> be safe and assume the item does have embedded annotations
			let logAndBeSafe = (e) => {
				Zotero.logError(e);
				return true;
			};

			if (await otherAttachment.hasEmbeddedAnnotations().catch(logAndBeSafe)) {
				// Other yes, master yes -> keep both
				if (await masterAttachment.hasEmbeddedAnnotations().catch(logAndBeSafe)) {
					Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key}, `
						+ 'but both have embedded annotations - keeping both');
					otherAttachment.parentItemID = item.id;
					await otherAttachment.save();
				}
				// Other yes, master no -> keep other
				else {
					Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key}, `
						+ 'but other has embedded annotations - merging into other');
					await doMerge(masterAttachment, otherAttachment);
					otherAttachment.parentItemID = item.id;
					await otherAttachment.save();
				}
				continue;
			}
			// Other no, master yes -> keep master
			// Other no, master no -> keep master

			Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key} - merging into master`);
			await doMerge(otherAttachment, masterAttachment);
		}
	}

	return remapAttachmentKeys;
}

async function mergeWebAttachments(item, otherItems) {
	Zotero.DB.requireTransaction();

	let masterAttachments = (await Zotero.Items.getAsync(item.getAttachments(true)))
		.filter(attachment => attachment.isWebAttachment());
	let masterAttachmentFilesExist = await Promise.all(masterAttachments.map(
		attachment => attachment.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_URL
			|| attachment.fileExists()
	));
	masterAttachments = masterAttachments.filter((_, i) => masterAttachmentFilesExist[i]);

	for (let otherItem of otherItems) {
		for (let otherAttachment of await Zotero.Items.getAsync(otherItem.getAttachments(true))) {
			if (!otherAttachment.isWebAttachment()) {
				continue;
			}

			// If we can find an attachment with the same title *and* URL, use it.
			let masterAttachment = (
				masterAttachments.find(attachment => attachment.getField('title') == otherAttachment.getField('title')
					&& attachment.getField('url') == otherAttachment.getField('url')
					&& attachment.attachmentLinkMode === otherAttachment.attachmentLinkMode)
				|| masterAttachments.find(attachment => attachment.getField('title') == otherAttachment.getField('title')
					&& attachment.attachmentLinkMode === otherAttachment.attachmentLinkMode)
			);

			if (!masterAttachment) {
				Zotero.debug(`No match for web attachment ${otherAttachment.key} in master item - moving`);
				otherAttachment.parentItemID = item.id;
				await otherAttachment.save();
				continue;
			}

			otherAttachment.deleted = true;
			await moveRelations(otherAttachment, masterAttachment);
			await otherAttachment.save();

			masterAttachment.addRelation(Zotero.Relations.replacedItemPredicate,
				Zotero.URI.getItemURI(otherAttachment));
			await masterAttachment.save();

			// Don't match with this attachment again
			masterAttachments = masterAttachments.filter(a => a !== masterAttachment);
		}
	}
}

async function mergeOtherAttachments(item, otherItems) {
	Zotero.DB.requireTransaction();

	for (let otherItem of otherItems) {
		for (let otherAttachment of await Zotero.Items.getAsync(otherItem.getAttachments(true))) {
			if (otherAttachment.isPDFAttachment() || otherAttachment.isWebAttachment()) {
				continue;
			}

			otherAttachment.parentItemID = item.id;
			await otherAttachment.save();
		}
	}
}

/**
 * Hash each attachment of the provided item. Return a map from hashes to
 * attachment IDs.
 *
 * @param {Zotero.Item} item
 * @param {String} hashType 'bytes' or 'text'
 * @return {Promise<Map<String, String>>}
 */
async function hashItem(item, hashType) {
	if (!['bytes', 'text'].includes(hashType)) {
		throw new Error('Invalid hash type');
	}

	let attachments = (await Zotero.Items.getAsync(item.getAttachments()))
		.filter(attachment => attachment.isFileAttachment());
	let hashes = new Map();
	await Promise.all(attachments.map(async (attachment) => {
		// attachmentHash and hashAttachmentText() implicitly check file existence
		let hash = hashType === 'bytes'
			? await attachment.attachmentHash
			: await hashAttachmentText(attachment);
		if (hash) {
			hashes.set(hash, attachment.id);
		}
	}));
	return hashes;
}

/**
 * Hash an attachment by the most common words in its text.
 * @param {Zotero.Item} attachment
 * @return {Promise<String>}
 */
// Exported for testing
export async function hashAttachmentText(attachment) {
	var fileInfo;
	try {
		fileInfo = await IOUtils.stat(attachment.getFilePath());
	}
	catch (e) {
		if (e.name === 'NotFoundError') {
			Zotero.debug('hashAttachmentText: Attachment not found');
			return null;
		}
		Zotero.logError(e);
		return null;
	}
	if (fileInfo.size > 5e8) {
		Zotero.debug('hashAttachmentText: Attachment too large');
		return null;
	}

	let text;
	try {
		text = await attachment.attachmentText;
	}
	catch (e) {
		Zotero.logError(e);
	}
	if (!text) {
		Zotero.debug('hashAttachmentText: Attachment has no text');
		return null;
	}

	let mostCommonWords = getMostCommonWords(text, 50);
	if (mostCommonWords.length < 10) {
		Zotero.debug('hashAttachmentText: Not enough unique words');
		return null;
	}
	return Zotero.Utilities.Internal.md5(mostCommonWords.sort().join(' '));
}

/**
 * Get the n most common words in s in descending order of frequency.
 * If s contains fewer than n unique words, the size of the returned array
 * will be less than n.
 *
 * @param {String} s
 * @param {Number} n
 * @return {String[]}
 */
function getMostCommonWords(s, n) {
	// Use an iterative approach for better performance.

	const whitespaceRe = /\s/;
	const wordCharRe = /\p{Letter}/u; // [a-z] only matches Latin

	let freqs = new Map();
	let currentWord = '';

	for (let codePoint of s) {
		if (whitespaceRe.test(codePoint)) {
			if (currentWord.length > 3) {
				freqs.set(currentWord, (freqs.get(currentWord) || 0) + 1);
			}

			currentWord = '';
			continue;
		}

		if (wordCharRe.test(codePoint)) {
			currentWord += codePoint.toLowerCase();
		}
	}

	// Add remaining word, if any
	if (currentWord.length > 3) {
		freqs.set(currentWord, (freqs.get(currentWord) || 0) + 1);
	}

	// Break ties in locale order.
	return [...freqs.keys()]
		.sort((a, b) => (freqs.get(b) - freqs.get(a)) || Zotero.localeCompare(a, b))
		.slice(0, n);
}

/**
 * Move fromItem's embedded note, if it has one, to toItem.
 * If toItem already has an embedded note, the note will be added as a new
 * child note item on toItem's parent.
 * Requires a transaction.
 */
async function moveEmbeddedNote(fromItem, toItem) {
	Zotero.DB.requireTransaction();

	if (fromItem.getNote()) {
		let noteItem = toItem;
		if (toItem.getNote()) {
			noteItem = new Zotero.Item('note');
			noteItem.parentItemID = toItem.parentItemID;
		}
		noteItem.setNote(fromItem.getNote());
		fromItem.setNote('');
		Zotero.Notes.replaceItemKey(noteItem, fromItem.key, toItem.key);
		await noteItem.save();
	}
}

/**
 * Move fromItem's relations to toItem as part of a merge.
 * Requires a transaction.
 *
 * @param {Zotero.Item} fromItem
 * @param {Zotero.Item} toItem
 * @return {Promise}
 */
async function moveRelations(fromItem, toItem) {
	Zotero.DB.requireTransaction();

	let replPred = Zotero.Relations.replacedItemPredicate;
	let fromURI = Zotero.URI.getItemURI(fromItem);
	let toURI = Zotero.URI.getItemURI(toItem);

	// Add relations to toItem
	let oldRelations = fromItem.getRelations();
	for (let pred in oldRelations) {
		oldRelations[pred].forEach((obj) => {
			// Avoid adding a relation to self
			if (obj !== toURI) {
				toItem.addRelation(pred, obj);
			}
		});
	}

	// Remove merge-tracking relations from fromItem, so that there aren't two
	// subjects for a given deleted object
	let replItems = fromItem.getRelationsByPredicate(replPred);
	for (let replItem of replItems) {
		fromItem.removeRelation(replPred, replItem);
	}

	// Update relations on items in the library that point to the other item
	// to point to the master instead
	let rels = await Zotero.Relations.getByObject('item', fromURI);
	for (let rel of rels) {
		// Skip merge-tracking relations, which are dealt with above
		if (rel.predicate == replPred) continue;
		// Skip items in other libraries. They might not be editable, and even
		// if they are, merging items in one library shouldn't affect another library,
		// so those will follow the merge-tracking relations and can optimize their
		// path if they're resaved.
		if (rel.subject.libraryID != toItem.libraryID) continue;
		// Do not add a relation to self
		if (rel.subject.id == toItem.id) continue;
		rel.subject.removeRelation(rel.predicate, fromURI);
		rel.subject.addRelation(rel.predicate, toURI);
		await rel.subject.save();
	}

	// Add relation to track merge
	toItem.addRelation(replPred, fromURI);

	await fromItem.save();
	await toItem.save();
}
