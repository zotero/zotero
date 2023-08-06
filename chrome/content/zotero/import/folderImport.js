var EXPORTED_SYMBOLS = ["Zotero_Import_Folder"]; // eslint-disable-line no-unused-vars

Components.utils.import("resource://gre/modules/Services.jsm");
Services.scriptloader.loadSubScript("chrome://zotero/content/include.js");

// matches "*" and "?" wildcards of a glob pattern, case-insensitive
function simpleGlobMatch(filename, patterns) {
	for (const pattern of patterns) {
		// Convert glob pattern to regex pattern
		const regexPattern = pattern
			.replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
			.replace(/\*/g, '.*') // Replace * with regex equivalent
			.replace(/\?/g, '.'); // Replace ? with regex equivalent

		if (new RegExp(`^${regexPattern}$`, 'i').test(filename)) {
			return true;
		}
	}
	return false;
}

const collectFilesRecursive = async (dirPath, parents = [], files = []) => {
	await Zotero.File.iterateDirectory(dirPath, async ({ isDir, _isSymlink, name, path }) => {
		if (isDir) {
			await collectFilesRecursive(path, [...parents, name], files);
		}
		// TODO: Also check for hidden file attribute on windows?
		else if (!name.startsWith('.')) {
			files.push({ parents, path, name });
		}
	});
	return files;
};

const findCollection = (libraryID, parentCollectionID, collectionName) => {
	const collections = parentCollectionID
		? Zotero.Collections.getByParent(parentCollectionID)
		: Zotero.Collections.getByLibrary(libraryID);

	return collections.find(c => c.name === collectionName);
};

// @TODO
const findItemByHash = async (libraryID, hash) => {
	return null;
};

class Zotero_Import_Folder { // eslint-disable-line camelcase,no-unused-vars
	constructor({ mimeTypes = ['application/pdf'], fileTypes, folder, libraryID, recreateStructure }) {
		this.folder = folder;
		this.libraryID = libraryID;
		this.newItems = [];
		this.recreateStructure = recreateStructure;
		this.fileTypes = fileTypes && fileTypes.length ? fileTypes.split(',').map(ft => ft.trim()) : [];
		this._progress = 0;
		this._progressMax = 0;
		this._itemDone = () => {};
		this.types = mimeTypes; // whitelist of mime types to process
	}

	setLocation(folder) {
		this.folder = folder;
	}

	setHandler(name, handler) {
		switch (name) {
			case 'itemDone':
				this._itemDone = handler;
				break;
		}
	}

	setTranslator() {}

	getProgress() {
		return this._progress / this._progressMax * 100;
	}

	async getTranslators() {
		return [{ label: 'Folder import' }];
	}

	async translate({ collections = [], linkFiles = false } = {}) {
		// https://github.com/zotero/zotero/pull/2862#discussion_r1141324302
		throw new Error('Folder import is not supported yet');
		const libraryID = this.libraryID || Zotero.Libraries.userLibraryID;
		const files = await collectFilesRecursive(this.folder);

		// import is done in four phases: sniff for mime type, calculate md5, import as attachment, recognize.
		// hence number of files is multiplied by 4 to determine max progress
		this._progressMax = files.length * 4;
		
		const mimeTypes = await Promise.all(files.map(
			async ({ path }) => {
				const mimeType = Zotero.MIME.sniffForMIMEType(await Zotero.File.getSample(path));
				this._progress++;
				this._itemDone();
				return mimeType;
			}
		));

		const fileHashes = await Promise.all(files.map(
			async ({ name, path }, index) => {
				const contentType = mimeTypes[index];
				this._progress++;
				if (!(this.types.includes(contentType) || simpleGlobMatch(name, this.fileTypes))) {
					// don't bother calculating a hash for file that will be ignored
					return null;
				}
				const md5Hash = await Zotero.Utilities.Internal.md5Async(path);
				this._itemDone();
				return md5Hash;
			}
		));

		files.forEach((fileData, index) => {
			fileData.parentCollectionIDs = (collections && collections.length) ? [...collections] : [];
			fileData.mimeType = mimeTypes[index];
		});

		if (this.recreateStructure) {
			for (const fileData of files) {
				const { parents } = fileData;
				let prevParentCollectionID = null;
				if (parents.length) {
					prevParentCollectionID = (collections && collections.length) ? collections[0] : null;
					for (const parentName of parents) {
						const parentCollection = findCollection(libraryID, prevParentCollectionID, parentName) || new Zotero.Collection;
						parentCollection.libraryID = libraryID;
						parentCollection.name = parentName;
						if (prevParentCollectionID) {
							parentCollection.parentID = prevParentCollectionID;
						}
						await parentCollection.saveTx({ skipSelect: true }); //eslint-disable-line no-await-in-loop
						prevParentCollectionID = parentCollection.id;
					}
				}
				if (prevParentCollectionID) {
					fileData.parentCollectionIDs = [prevParentCollectionID];
				}
			}
		}

		// index files by hash to avoid importing duplicate files. Keep track of where duplicates were found so that
		// duplicate item is still added to one collection per folder
		const fileDataByHash = {};
		files.forEach((fileData, index) => {
			const hash = fileHashes[index];
			if (hash in fileDataByHash) {
				fileDataByHash[hash].parentCollectionIDs.push(...fileData.parentCollectionIDs);
			}
			else {
				fileDataByHash[hash] = fileData;
			}
		});

		// advance progress to account for duplicates found within file structure
		// these files won't be imported nor recognized so advance 2 ticks per file
		this._progress += 2 * (files.length - Object.keys(fileDataByHash).length);
		this._itemDone();

		const attachmentItemHashLookup = {};
		const attachmentItems = await Promise.all(Object.entries(fileDataByHash).map(
			async ([hash, { name, path, parentCollectionIDs, mimeType }]) => {
				const options = {
					collections: parentCollectionIDs,
					contentType: mimeType,
					file: path,
					libraryID,
				};

				let attachmentItem = null;
				
				if ((this.types.includes(mimeType) || simpleGlobMatch(name, this.fileTypes))) {
					const existingItem = await findItemByHash(libraryID, hash);

					if (existingItem) {
						existingItem.setCollections([...existingItem.getCollections(), ...parentCollectionIDs]);
						await existingItem.saveTx({ skipSelect: true });
					}
					else {
						if (linkFiles) {
							attachmentItem = await Zotero.Attachments.linkFromFile(options);
						}
						else {
							attachmentItem = await Zotero.Attachments.importFromFile(options);
						}
						
						this.newItems.push(attachmentItem);
						attachmentItemHashLookup[attachmentItem.id] = hash;
					}
				}

				if (attachmentItem && !Zotero.RecognizeDocument.canRecognize(attachmentItem)) {
					// @TODO: store hash of an item that cannot be recognized
					await attachmentItem.saveTx({ skipSelect: true });
					attachmentItem = null;
				}
				this._progress++;
				this._itemDone();
				return attachmentItem;
			}
		));


		// discard unrecognizable items, increase progress for discarded items
		const recognizableItems = attachmentItems.filter(item => item !== null);
		this._progress += attachmentItems.length - recognizableItems.length;
		this._itemDone();

		const recognizeQueue = Zotero.ProgressQueues.get('recognize');
		const itemsToSavePostRecognize = [];
		
		const processRecognizedItem = ({ status, id }) => {
			const updatedItem = recognizableItems.find(i => i.id === id);
			if (status === Zotero.ProgressQueue.ROW_SUCCEEDED) {
				const recognizedItem = updatedItem.parentItem;
				if (recognizedItem && id in attachmentItemHashLookup) {
					// @TODO: Store hash of an attachment (attachmentItemHashLookup[id]) for this recognized item
					itemsToSavePostRecognize.push(recognizedItem);
				}
			}
			if (status === Zotero.ProgressQueue.ROW_FAILED) {
				if (updatedItem && id in attachmentItemHashLookup) {
					// @TODO: Store hash of a file that failed to be recognized (attachmentItemHashLookup[id])
					itemsToSavePostRecognize.push(updatedItem);
				}
			}
			if ([Zotero.ProgressQueue.ROW_FAILED, Zotero.ProgressQueue.ROW_SUCCEEDED].includes(status)) {
				this._progress++;
				this._itemDone();
			}
		};
		
		recognizeQueue.addListener('rowupdated', processRecognizedItem);
		try {
			await Zotero.RecognizeDocument.recognizeItems(recognizableItems);
		}
		finally {
			recognizeQueue.removeListener('rowupdated', processRecognizedItem);
		}

		for (const item of itemsToSavePostRecognize) {
			await item.saveTx({ skipSelect: true });
		}
	}
}
