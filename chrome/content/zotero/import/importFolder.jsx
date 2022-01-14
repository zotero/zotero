var EXPORTED_SYMBOLS = ["Zotero_Import_Folder"]; // eslint-disable-line no-unused-vars

Components.utils.import("resource://gre/modules/Services.jsm");
Services.scriptloader.loadSubScript("chrome://zotero/content/include.js");

const collectFilesRecursive = async (dirPath, parents = [], files = []) => {
	await Zotero.File.iterateDirectory(dirPath, async ({ isDir, _isSymlink, name, path }) => {
		if (isDir) {
			await collectFilesRecursive(path, [...parents, name], files);
		}
		else {
			files.push({ parents, path });
		}
	});
	return files;
};

class Zotero_Import_Folder { // eslint-disable-line camelcase,no-unused-vars
	constructor({ folder, libraryID, recreateStructure }) {
		this.folder = folder;
		this.libraryID = libraryID;
		this.newItems = [];
		this.recreateStructure = recreateStructure;
		this._progress = 0;
		this._progressMax = 0;
		this._itemDone = () => {};
		this.types = ['application/pdf']; // whitelist of mime types to process
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
		const libraryID = this.libraryID || Zotero.Libraries.userLibraryID;
		const files = await collectFilesRecursive(this.folder);
		const collectionsLookup = {};

		// import is done in three phases: sniff for mime type, import as attachment, recognize.
		// hence number of files is multiplied by 3 to determine max progress
		this._progressMax = files.length * 3;
		
		const mimeTypes = await Promise.all(files.map(
			async ({ path }) => {
				const mimeType = Zotero.MIME.sniffForMIMEType(await Zotero.File.getSample(path));
				this._progress++;
				this._itemDone();
				return mimeType;
			}
		));

		if (this.recreateStructure) {
			for (const { parents } of files) {
				if (parents.length) {
					let prevParentCollectionID = (collections && collections.length) ? collections[0] : null;
					let path = '';
					for (const parentName of parents) {
						path += '/' + parentName;
						if (!(path in collectionsLookup)) {
							const parentCollection = new Zotero.Collection;
							parentCollection.libraryID = libraryID;
							parentCollection.name = parentName;
							if (prevParentCollectionID) {
								parentCollection.parentID = prevParentCollectionID;
							}
							await parentCollection.saveTx({ skipSelect: true }); //eslint-disable-line no-await-in-loop
							collectionsLookup[path] = parentCollection.id;
							prevParentCollectionID = parentCollection.id;
						}
						else {
							prevParentCollectionID = collectionsLookup[path];
						}
					}
				}
			}
		}

		const attachmentItems = await Promise.all(files.map(
			async ({ path, parents }, index) => {
				const contentType = mimeTypes[index];
				const options = {
					collections,
					contentType,
					file: path,
					libraryID,
				};

				let attachmentItem = null;

				if (this.types.includes(contentType)) {
					if (this.recreateStructure && parents.length) {
						options.collections = [collectionsLookup['/' + parents.join('/')]];
					}
					if (linkFiles) {
						attachmentItem = await Zotero.Attachments.linkFromFile(options);
					}
					else {
						attachmentItem = await Zotero.Attachments.importFromFile(options);
					}
					
					this.newItems.push(attachmentItem);
					if (!Zotero.RecognizePDF.canRecognize(attachmentItem)) {
						attachmentItem = null;
					}
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
		recognizeQueue.addListener('rowupdated', ({ status }) => {
			if ([Zotero.ProgressQueue.ROW_FAILED, Zotero.ProgressQueue.ROW_SUCCEEDED].includes(status)) {
				this._progress++;
				this._itemDone();
			}
		});
		await Zotero.RecognizePDF.recognizeItems(recognizableItems);
		recognizeQueue.removeListener('rowupdated');
	}
}
