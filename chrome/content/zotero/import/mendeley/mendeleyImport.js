/* global map:false, mendeleyOnlineMappings:false, mendeleyAPIUtils:false */
var EXPORTED_SYMBOLS = ["Zotero_Import_Mendeley"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");
Services.scriptloader.loadSubScript("chrome://zotero/content/include.js");
Services.scriptloader.loadSubScript("chrome://zotero/content/import/mendeley/mendeleyOnlineMappings.js");
Services.scriptloader.loadSubScript("chrome://zotero/content/import/mendeley/mendeleyAPIUtils.js");

const { apiTypeToDBType, apiFieldToDBField } = mendeleyOnlineMappings;
const { apiFetch, get, getAll, getTokens } = mendeleyAPIUtils;

var Zotero_Import_Mendeley = function () {
	this.createNewCollection = null;
	this.linkFiles = null;
	this.newItems = [];
	this.mendeleyCode = null;
	
	this._tokens = null;
	this._db;
	this._file;
	this._saveOptions = null;
	this._itemDone;
	this._progress = 0;
	this._progressMax;
	this._tmpFilesToDelete = [];
};

Zotero_Import_Mendeley.prototype.setLocation = function (file) {
	this._file = file.path || file;
};

Zotero_Import_Mendeley.prototype.setHandler = function (name, handler) {
	switch (name) {
	case 'itemDone':
		this._itemDone = handler;
		break;
	}
};

Zotero_Import_Mendeley.prototype.getProgress = function () {
	return this._progress / this._progressMax * 100;
};

Zotero_Import_Mendeley.prototype.getTranslators = async function () {
	return [{
		label: Zotero.getString('fileInterface.appDatabase', 'Mendeley')
	}];
};

Zotero_Import_Mendeley.prototype.setTranslator = function () {};

Zotero_Import_Mendeley.prototype.translate = async function (options = {}) {
	this._linkFiles = options.linkFiles;
	this._saveOptions = {
		skipSelect: true,
		...(options.saveOptions || {})
	};
	
	if (true) {
		Services.scriptloader.loadSubScript("chrome://zotero/content/import/mendeley/mendeleySchemaMap.js");
	}
	// TEMP: Load uncached from ~/zotero-client for development
	else {
		Components.utils.import("resource://gre/modules/FileUtils.jsm");
		let file = FileUtils.getDir("Home", []);
		file = OS.Path.join(file.path, 'zotero-client', 'chrome', 'content', 'zotero', 'import', 'mendeley', 'mendeleySchemaMap.js');
		let fileURI = OS.Path.toFileURI(file);
		let xmlhttp = await Zotero.HTTP.request(
			'GET',
			fileURI,
			{
				noCache: true,
				responseType: 'text'
			}
		);
		eval(xmlhttp.response);
	}
	
	const libraryID = options.libraryID || Zotero.Libraries.userLibraryID;
	const { key: rootCollectionKey } = options.collections
		? Zotero.Collections.getLibraryAndKeyFromID(options.collections[0])
		: {};
	
	// TODO: Get appropriate version based on schema version
	const mapVersion = 83;
	map = map[mapVersion];
	
	const mendeleyGroupID = 0;
	
	// Disable syncing while we're importing
	var resumeSync = Zotero.Sync.Runner.delayIndefinite();
	
	if (this._file) {
		this._db = new Zotero.DBConnection(this._file);
	}
	
	try {
		if (this._file && !await this._isValidDatabase()) {
			throw new Error("Not a valid Mendeley database");
		}

		if (this.mendeleyCode) {
			this._tokens = await getTokens(this.mendeleyCode);
		}

		if (!this._file && !this._tokens) {
			throw new Error("Missing import token");
		}

		const folders = this._tokens
			? await this._getFoldersAPI(mendeleyGroupID)
			: await this._getFoldersDB(mendeleyGroupID);

		const collectionJSON = this._foldersToAPIJSON(folders, rootCollectionKey);
		const folderKeys = this._getFolderKeys(collectionJSON);
		await this._saveCollections(libraryID, collectionJSON, folderKeys);
		
		//
		// Items
		//
		let documents = this._tokens
			? await this._getDocumentsAPI(mendeleyGroupID)
			: await this._getDocumentsDB(mendeleyGroupID);

		this._progressMax = documents.length;
		// Get various attributes mapped to document ids
		let urls = this._tokens
			? await this._getDocumentURLsAPI(documents)
			: await this._getDocumentURLsDB(mendeleyGroupID);

		let creators = this._tokens
			? await this._getDocumentCreatorsAPI(documents)
			: await this._getDocumentCreatorsDB(mendeleyGroupID, map.creatorTypes);

		let tags = this._tokens
			? await this._getDocumentTagsAPI(documents)
			: await this._getDocumentTagsDB(mendeleyGroupID);

		let collections = this._tokens
			? await this._getDocumentCollectionsAPI(documents, rootCollectionKey, folderKeys)
			: await this._getDocumentCollectionsDB(mendeleyGroupID, documents, rootCollectionKey, folderKeys);

		let files = this._tokens
			? await this._getDocumentFilesAPI(documents)
			: await this._getDocumentFilesDB(mendeleyGroupID);
		
		let annotations = this._tokens
			? await this._getDocumentAnnotationsAPI(mendeleyGroupID)
			: await this._getDocumentAnnotationsDB(mendeleyGroupID);

		let profile = this._tokens
			? await this._getProfileAPI()
			: await this._getProfileDB();

		let groups = this._tokens
			? await this._getGroupsAPI()
			: await this._getGroupsDB();

		const fileHashLookup = new Map();

		for (let [documentID, fileEntries] of files) {
			for (let fileEntry of fileEntries) {
				fileHashLookup.set(fileEntry.hash, documentID);
			}
		}


		for (let group of groups) {
			let groupAnnotations = this._tokens
				? await this._getDocumentAnnotationsAPI(group.id, profile.id)
				: await this._getDocumentAnnotationsDB(group.id, profile.id);

			for (let groupAnnotationsList of groupAnnotations.values()) {
				for (let groupAnnotation of groupAnnotationsList) {
					if (fileHashLookup.has(groupAnnotation.hash)) {
						const targetDocumentID = fileHashLookup.get(groupAnnotation.hash);
						if (!annotations.has(targetDocumentID)) {
							annotations.set(targetDocumentID, []);
						}
						annotations.get(targetDocumentID).push(groupAnnotation);
					}
				}
			}
		}

		for (let document of documents) {
			let docURLs = urls.get(document.id);
			let docFiles = files.get(document.id);

			if (this._tokens) {
				// extract identifiers
				['arxiv', 'doi', 'isbn', 'issn', 'pmid', 'scopus', 'pui', 'pii', 'sgr'].forEach(
					i => document[i] = (document.identifiers || {})[i]
				);
				
				// normalise item type from the API to match Mendeley DB
				document.type = apiTypeToDBType[document.type] || document.type;

				// normalise field names from the API to match Mendeley DB
				Object.keys(apiFieldToDBField).forEach((key) => {
					if (key in document) {
						const newKey = apiFieldToDBField[key];
						if (newKey) {
							document[newKey] = document[key];
						}
						delete document[key];
					}
				});
			}
			
			// If there's a single PDF file, use "PDF" for the attachment title
			if (docFiles && docFiles.length == 1 && docFiles[0].fileURL.endsWith('.pdf')) {
				docFiles[0].title = 'PDF';
			}
			
			// If there's a single PDF file and a single PDF URL and the file exists, make an
			// imported_url attachment instead of separate file and linked_url attachments
			if (docURLs && docFiles) {
				let pdfFiles = docFiles.filter(x => x.fileURL.endsWith('.pdf'));
				let pdfURLs = docURLs.filter(x => x.includes('pdf'));
				if (pdfFiles.length == 1
						&& pdfURLs.length == 1
						&& await this._getRealFilePath(OS.Path.fromFileURI(pdfFiles[0].fileURL))) {
					// Add URL to PDF attachment
					docFiles.forEach((x) => {
						if (x.fileURL.endsWith('.pdf')) {
							x.title = 'PDF';
							x.url = pdfURLs[0];
						}
					});
					// Remove PDF URL from URLs array
					docURLs = docURLs.filter(x => !x.includes('pdf'));
				}
			}
			
			// Set content type for PDFs
			if (docFiles) {
				docFiles.forEach((file) => {
					if (file.fileURL.endsWith('.pdf')) {
						file.contentType = 'application/pdf';
					}
				});
			}
			
			// Save each document with its attributes
			let itemJSON = await this._documentToAPIJSON(
				map,
				document,
				docURLs,
				creators.get(document.id),
				tags.get(document.id),
				collections.get(document.id)
			);
			let documentIDMap = await this._saveItems(libraryID, itemJSON);
			// Save the document's attachments and annotations for any of them
			if (docFiles) {
				await this._saveFilesAndAnnotations(
					docFiles,
					libraryID,
					documentIDMap.get(document.id),
					annotations.get(document.id)
				);
			}
			this.newItems.push(Zotero.Items.get(documentIDMap.get(document.id)));
			this._progress++;
			if (this._itemDone) {
				this._itemDone();
			}
		}
	}
	finally {
		try {
			if (this._file) {
				await this._db.closeDatabase();
			}
			if (this._tokens) {
				await Promise.all(
					this._tmpFilesToDelete.map(f => this._removeTemporaryFile(f))
				);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		resumeSync();
	}
};

Zotero_Import_Mendeley.prototype._removeTemporaryFile = async function (file) {
	const containingDir = OS.Path.dirname(file);
	try {
		await Zotero.File.removeIfExists(file);
		await OS.File.removeEmptyDir(containingDir);
	}
	catch (e) {
		Zotero.logError(e);
	}
};


Zotero_Import_Mendeley.prototype._isValidDatabase = async function () {
	var tables = [
		'DocumentContributors',
		'DocumentFiles',
		'DocumentFolders',
		'DocumentKeywords',
		'DocumentTags',
		'DocumentUrls',
		'Documents',
		'Files',
		'Folders',
		'RemoteDocuments',
		'RemoteFolders'
	];
	for (let table of tables) {
		if (!await this._db.tableExists(table)) {
			return false;
		}
	}
	return true;
};

//
// Collections
//
Zotero_Import_Mendeley.prototype._getFoldersDB = async function (groupID) {
	return this._db.queryAsync(
		`SELECT F.id, F.uuid, F.name, `
			// Top-level folders can have a parentId of 0 instead of -1 (by mistake?)
			+ `CASE WHEN F.parentId=0 THEN -1 ELSE F.parentId END AS parentId, `
			+ `RF.remoteUuid `
			+ `FROM Folders F `
			+ `JOIN RemoteFolders RF ON (F.id=RF.folderId) `
			+ `WHERE groupId=?`,
		groupID
	);
};

Zotero_Import_Mendeley.prototype._getFoldersAPI = async function (groupID) {
	const params = {};
	const headers = { Accept: 'application/vnd.mendeley-folder.1+json' };

	if (groupID && groupID !== 0) {
		params.group_id = groupID; //eslint-disable-line camelcase
	}
	return (await getAll(this._tokens, 'folders', params, headers)).map(f => ({
		id: f.id,
		uuid: f.id,
		name: f.name,
		parentId: f.parent_id || -1,
		remoteUuid: f.id
	}));
};

/**
 * Get flat array of collection API JSON with parentCollection set
 *
 * The returned objects include an extra 'id' property for matching collections to documents.
 */
Zotero_Import_Mendeley.prototype._foldersToAPIJSON = function (folderRows, parentKey) {
	var maxDepth = 50;
	return this._getFolderDescendents(-1, parentKey, folderRows, maxDepth);
};

Zotero_Import_Mendeley.prototype._getFolderDescendents = function (folderID, folderKey, folderRows, maxDepth) {
	if (maxDepth == 0) return []
	var descendents = [];
	var children = folderRows
		.filter(f => f.parentId == folderID)
		.map(f => {
			let c = {
				folderID: f.id,
				remoteUUID: f.remoteUuid,
				key: Zotero.DataObjectUtilities.generateKey(),
				name: f.name,
				parentCollection: folderKey
			};
			if (f.remoteUuid) {
				c.relations = {
					'mendeleyDB:remoteFolderUUID': f.remoteUuid
				};
			}
			return c;
		});
	
	for (let child of children) {
		descendents.push(
			child,
			...this._getFolderDescendents(child.folderID, child.key, folderRows, maxDepth - 1)
		);
	}
	return descendents;
};

Zotero_Import_Mendeley.prototype._getFolderKeys = function (collections) {
	var map = new Map();
	for (let collection of collections) {
		map.set(collection.folderID, collection.key);
	}
	return map;
};

/**
 * @param {Integer} libraryID
 * @param {Object[]} json
 */
Zotero_Import_Mendeley.prototype._saveCollections = async function (libraryID, json, folderKeys) {
	var keyMap = new Map();
	for (let i = 0; i < json.length; i++) {
		let collectionJSON = json[i];
		
		// Check if the collection was previously imported
		let collection = await this._findExistingCollection(
			libraryID,
			collectionJSON,
			collectionJSON.parentCollection ? keyMap.get(collectionJSON.parentCollection) : null
		);
		if (collection) {
			// Update any child collections to point to the existing collection's key instead of
			// the new generated one
			this._updateParentKeys('collection', json, i + 1, collectionJSON.key, collection.key);
			// And update the map of Mendeley folderIDs to Zotero collection keys
			folderKeys.set(collectionJSON.folderID, collection.key);
		}
		else {
			collection = new Zotero.Collection;
			collection.libraryID = libraryID;
			if (collectionJSON.key) {
				collection.key = collectionJSON.key;
				await collection.loadPrimaryData();
			}
		}
		
		// Remove external ids before saving
		let toSave = Object.assign({}, collectionJSON);
		delete toSave.folderID;
		delete toSave.remoteUUID;
		
		collection.fromJSON(toSave);
		await collection.saveTx(this._saveOptions);
	}
};


Zotero_Import_Mendeley.prototype._findExistingCollection = async function (libraryID, collectionJSON, parentCollection) {
	// Don't use existing collections if the import is creating a top-level collection
	if (this.createNewCollection || !collectionJSON.relations) {
		return false;
	}
	
	var predicate = 'mendeleyDB:remoteFolderUUID';
	var uuid = collectionJSON.relations[predicate];
	
	var collections = (await Zotero.Relations.getByPredicateAndObject('collection', predicate, uuid))
		.filter((c) => {
			if (c.libraryID != libraryID) {
				return false;
			}
			// If there's a parent collection it has to be the one we've already used
			return parentCollection ? c.parentID == parentCollection.id : true;
		});
	if (!collections.length) {
		return false;
	}
	
	Zotero.debug(`Found existing collection ${collections[0].libraryKey} for `
		+ `${predicate} ${collectionJSON.relations[predicate]}`);
	return collections[0];
};


//
// Items
//
Zotero_Import_Mendeley.prototype._getDocumentsDB = async function (groupID) {
	return this._db.queryAsync(
		`SELECT D.*, RD.remoteUuid FROM Documents D `
			+ `JOIN RemoteDocuments RD ON (D.id=RD.documentId) `
			+ `WHERE groupId=? AND inTrash='false'`,
		groupID
	);
};

Zotero_Import_Mendeley.prototype._getDocumentsAPI = async function (groupID) {
	const params = { view: 'all' };
	const headers = { Accept: 'application/vnd.mendeley-document-with-files-list+json' };

	if (groupID && groupID !== 0) {
		params.group_id = groupID; //eslint-disable-line camelcase
	}
	

	return (await getAll(this._tokens, 'documents', params, headers)).map(d => ({
		...d,
		uuid: d.id,
		remoteUuid: d.id
	}));
};

/**
 * Get a Map of document ids to arrays of URLs
 *
 * @return {Map<Number,String[]>}
 */
Zotero_Import_Mendeley.prototype._getDocumentURLsDB = async function (groupID) {
	var rows = await this._db.queryAsync(
		`SELECT documentId, CAST(url AS TEXT) AS url FROM DocumentUrls DU `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=? ORDER BY position`,
		groupID
	);
	var map = new Map();
	for (let row of rows) {
		let docURLs = map.get(row.documentId);
		if (!docURLs) docURLs = [];
		docURLs.push(row.url);
		map.set(row.documentId, docURLs);
	}
	return map;
};

Zotero_Import_Mendeley.prototype._getDocumentURLsAPI = async function (documents) {
	return new Map(documents.map(d => ([d.id, d.websites])));
};

/**
 * Get a Map of document ids to arrays of creator API JSON
 *
 * @param {Integer} groupID
 * @param {Object} creatorTypeMap - Mapping of Mendeley creator types to Zotero creator types
 */
Zotero_Import_Mendeley.prototype._getDocumentCreatorsDB = async function (groupID, creatorTypeMap) {
	var rows = await this._db.queryAsync(
		`SELECT * FROM DocumentContributors `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=?`,
		groupID
	);
	var map = new Map();
	for (let row of rows) {
		let docCreators = map.get(row.documentId);
		if (!docCreators) docCreators = [];
		docCreators.push(this._makeCreator(
			creatorTypeMap[row.contribution] || 'author',
			row.firstNames,
			row.lastName
		));
		map.set(row.documentId, docCreators);
	}
	return map;
};

Zotero_Import_Mendeley.prototype._getDocumentCreatorsAPI = async function (documents) {
	var map = new Map();
	for (let doc of documents) {
		const authors = (doc.authors || []).map(c => this._makeCreator('author', c.first_name, c.last_name));
		const editors = (doc.editors || []).map(c => this._makeCreator('editor', c.first_name, c.last_name));
		const translators = (doc.translators || []).map(c => this._makeCreator('translator', c.first_name, c.last_name));
		map.set(doc.id, [...authors, ...editors, ...translators]);
	}
	return map;
};

/**
 * Get a Map of document ids to arrays of tag API JSON
 */
Zotero_Import_Mendeley.prototype._getDocumentTagsDB = async function (groupID) {
	var rows = await this._db.queryAsync(
		// Manual tags
		`SELECT documentId, tag, 0 AS type FROM DocumentTags `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=? `
			+ `UNION `
			// Automatic tags
			+ `SELECT documentId, keyword AS tag, 1 AS type FROM DocumentKeywords `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=?`,
		[groupID, groupID]
	);
	var map = new Map();
	for (let row of rows) {
		// Skip empty tags
		if (!row.tag.trim()) continue;
		let docTags = map.get(row.documentId);
		if (!docTags) docTags = [];
		docTags.push({
			tag: row.tag,
			type: row.type
		});
		map.set(row.documentId, docTags);
	}
	return map;
};

Zotero_Import_Mendeley.prototype._getDocumentTagsAPI = async function (documents) {
	var map = new Map();
	for (let doc of documents) {
		const tags = [...(doc.tags || []).map(tag => ({ tag, type: 0 })), ...(doc.keywords || []).map(tag => ({ tag, type: 1 }))];
		map.set(doc.id, tags);
	}
	return map;
};

/**
 * Get a Map of document ids to arrays of collection keys
 */
Zotero_Import_Mendeley.prototype._getDocumentCollectionsDB = async function (groupID, documents, rootCollectionKey, folderKeys) {
	var rows = await this._db.queryAsync(
		`SELECT documentId, folderId FROM DocumentFolders DF `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=?`,
		groupID
	);
	var map = new Map(
		// Add all documents to root collection if specified
		documents.map(d => [d.id, rootCollectionKey ? [rootCollectionKey] : []])
	);
	for (let row of rows) {
		let keys = map.get(row.documentId);
		if (!keys) keys = [];
		let key = folderKeys.get(row.folderId);
		if (!key) {
			Zotero.debug(`Document folder ${row.folderId} not found -- skipping`, 2);
			continue;
		}
		keys.push(key);
		map.set(row.documentId, keys);
	}
	return map;
};

Zotero_Import_Mendeley.prototype._getDocumentCollectionsAPI = async function (documents, rootCollectionKey, folderKeys) {
	return new Map(
		documents.map((d) => {
			const keys = (d.folder_uuids || []).map((fuuid) => {
				const key = folderKeys.get(fuuid);
				if (!key) {
					Zotero.debug(`Document folder ${fuuid} not found -- skipping`, 2);
				}
				return key;
			}).filter(Boolean);
			// Add all documents to root collection if specified
			return [d.id, [...keys, ...(rootCollectionKey ? [rootCollectionKey] : [])]];
		})
	);
};

/**
 * Get a Map of document ids to arrays of file metadata
 *
 * @return {Map<Number,Object[]>}
 */
Zotero_Import_Mendeley.prototype._getDocumentFilesDB = async function (groupID) {
	var rows = await this._db.queryAsync(
		`SELECT documentId, hash, localUrl FROM DocumentFiles `
			+ `JOIN Files USING (hash) `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=?`,
		groupID
	);
	var map = new Map();
	for (let row of rows) {
		let docFiles = map.get(row.documentId);
		if (!docFiles) docFiles = [];
		if (typeof row.localUrl != 'string') {
			Zotero.debug(`Skipping invalid localUrl '${row.localUrl}' for document ${row.documentId}`);
			continue;
		}
		docFiles.push({
			hash: row.hash,
			fileURL: row.localUrl
		});
		map.set(row.documentId, docFiles);
	}
	return map;
};

Zotero_Import_Mendeley.prototype._fetchFile = async function (fileID, filePath) {
	const fileDir = OS.Path.dirname(filePath);
	await Zotero.File.createDirectoryIfMissingAsync(fileDir);
	const xhr = await apiFetch(this._tokens, `files/${fileID}`, {}, {}, { responseType: 'blob', followRedirects: false });
	const uri = xhr.getResponseHeader('location');
	await Zotero.File.download(uri, filePath);

	this._progress += 1;
	if (this._itemDone) {
		this._itemDone();
	}
};

Zotero_Import_Mendeley.prototype._getDocumentFilesAPI = async function (documents) {
	const map = new Map();
	
	let totalSize = 0;

	Components.utils.import("resource://zotero/concurrentCaller.js");
	var caller = new ConcurrentCaller({
		numConcurrent: 6,
		onError: e => Zotero.logError(e),
		Promise: Zotero.Promise
	});

	for (let doc of documents) {
		const files = [];
		for (let file of (doc.files || [])) {
			// Most filesystems limit filename to 255 bytes
			let fileName = Zotero.File.truncateFileName(Zotero.File.getValidFileName(file.file_name || 'file'), 255);
			let ext = fileName.includes('.') ? fileName.split('.').pop() : '';
			let fileBaseName = ext === '' ? fileName : fileName.slice(0, -ext.length - 1);
			let tmpFile = OS.Path.join(Zotero.getTempDirectory().path, `m-api-${file.id}.${ext}`);
			
			this._tmpFilesToDelete.push(tmpFile);
			caller.add(this._fetchFile.bind(this, file.id, tmpFile));
			files.push({
				fileURL: OS.Path.toFileURI(tmpFile),
				title: file.file_name || '',
				contentType: file.mime_type || '',
				hash: file.filehash,
				fileBaseName
			});
			totalSize += file.size;
			this._progressMax += 1;
		}
		map.set(doc.id, files);
	}
	// check if enough space available totalSize
	await caller.runAll();
	return map;
};


/**
 * Get a Map of document ids to arrays of annotations
 */
Zotero_Import_Mendeley.prototype._getDocumentAnnotationsDB = async function (groupID, profileID = null) {
	var map = new Map();
	
	// Highlights
	var rows = await this._db.queryAsync(
		`SELECT documentId, FH.id AS highlightId, uuid, fileHash, color, createdTime, `
			+ `page, x1, y1, x2, y2 `
			+ `FROM FileHighlights FH `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `JOIN FileHighlightRects FHR ON (FH.id=FHR.highlightId) `
			+ `WHERE groupId=? `
			+ (profileID !== null ? `AND profileUuid=? ` : ``)
			+ `ORDER BY FH.id, page, y1 DESC, x1`,
		profileID !== null ? [groupID, profileID] : groupID
	);
	var currentHighlight = null;
	for (let i = 0; i < rows.length; i++) {
		let row = rows[i];
		let docAnnotations = map.get(row.documentId);
		if (!docAnnotations) docAnnotations = [];
		// There can be multiple highlight rows per annotation, so add the last annotation when the
		// UUID changes
		if (!currentHighlight || currentHighlight.uuid != row.uuid) {
			if (currentHighlight) {
				docAnnotations.push(currentHighlight);
				map.set(row.documentId, docAnnotations);
			}
			currentHighlight = {
				type: 'highlight',
				uuid: row.uuid,
				hash: row.fileHash,
				color: row.color,
				dateAdded: row.createdTime,
				page: null,
				rects: []
			};
		}
		currentHighlight.page = row.page;
		currentHighlight.rects.push({
			x1: row.x1,
			y1: row.y1,
			x2: row.x2,
			y2: row.y2,
		});
		if (i == rows.length - 1) {
			docAnnotations.push(currentHighlight);
			map.set(row.documentId, docAnnotations);
		}
	}
	
	// Notes
	rows = await this._db.queryAsync(
		`SELECT documentId, uuid, fileHash, page, x, y, note, color, modifiedTime, createdTime `
			+ `FROM FileNotes `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=? `
			+ (profileID !== null ? `AND profileUuid=? ` : ``)
			+ `ORDER BY page, y, x`,
		profileID !== null ? [groupID, profileID] : groupID
	);
	for (let row of rows) {
		let docAnnotations = map.get(row.documentId);
		if (!docAnnotations) docAnnotations = [];
		docAnnotations.push({
			type: 'note',
			uuid: row.uuid,
			hash: row.fileHash,
			x: row.x,
			y: row.y,
			note: row.note,
			page: row.page,
			color: row.color,
			dateAdded: row.createdTime,
			dateModified: row.modifiedTime
		});
		map.set(row.documentId, docAnnotations);
	}
	
	return map;
};

Zotero_Import_Mendeley.prototype._getDocumentAnnotationsAPI = async function (groupID, profileID = null) {
	const params = {};

	if (groupID && groupID !== 0) {
		params.group_id = groupID; //eslint-disable-line camelcase
	}

	const map = new Map();
	(await getAll(this._tokens, 'annotations', params, { Accept: 'application/vnd.mendeley-annotation.1+json' }))
		.forEach((a) => {
			if (profileID !== null && a.profile_id !== profileID) {
				// optionally filter annotations by profile id
				return;
			}

			if (a.type === 'note') {
				// This is a "general note" in Mendeley. It appears to be the same thing as
				// document.note thus not an annotations and can be discarded
				return;
			}

			const rects = (a.positions || []).map(position => ({
				x1: (position.top_left || {}).x || 0,
				y1: (position.top_left || {}).y || 0,
				x2: (position.bottom_right || {}).x || 0,
				y2: (position.bottom_right || {}).y || 0,
			}));
			let page = 1;
			try {
				// const page = ((a.positions || [])[0] || {}).page; // ???
				page = a.positions[0].page;
			}
			catch (e) { }
			
			const annotation = {
				id: a.id,
				color: a.color
					? `#${a.color.r.toString(16).padStart(2, '0')}${a.color.g.toString(16).padStart(2, '0')}${a.color.b.toString(16).padStart(2, '0')}`
					: null,
				dateAdded: a.created,
				dateModified: a.last_modified,
				hash: a.filehash,
				uuid: a.id,
				page,
			};

			if (a.type === 'highlight') {
				annotation.type = 'highlight';
				annotation.rects = rects;
			}

			if (a.type === 'sticky_note' && rects.length > 0) {
				annotation.type = 'note';
				annotation.note = a.text;
				annotation.x = rects[0].x1;
				annotation.y = rects[0].y1;
			}

			if (!map.has(a.document_id)) {
				map.set(a.document_id, []);
			}
			map.get(a.document_id).push(annotation);
		});
	return map;
};

Zotero_Import_Mendeley.prototype._getGroupsAPI = async function () {
	const params = { type: 'all' };
	const headers = { Accept: 'application/vnd.mendeley-group-list+json' };
	
	return getAll(this._tokens, 'groups/v2', params, headers);
};

Zotero_Import_Mendeley.prototype._getGroupsDB = async function () {
	const rows = await this._db.queryAsync(
		"SELECT id, remoteUUid, name, isOwner FROM Groups WHERE remoteUuID != ?", ['']
	);
	return rows;
};


Zotero_Import_Mendeley.prototype._getProfileAPI = async function () {
	const params = { };
	const headers = { Accept: 'application/vnd.mendeley-profiles.2+json' };
	
	return get(this._tokens, 'profiles/v2/me', params, headers);
};

Zotero_Import_Mendeley.prototype._getProfileDB = async function () {
	const rows = await this._db.queryAsync(
		"SELECT uuid as id, firstName, lastName, displayName FROM Profiles ORDER BY ROWID LIMIT 1"
	);

	return rows[0];
};

/**
 * Create API JSON array with item and any child attachments or notes
 */
Zotero_Import_Mendeley.prototype._documentToAPIJSON = async function (map, documentRow, urls, creators, tags, collections) {
	var parent = {
		key: Zotero.DataObjectUtilities.generateKey()
	};
	var children = [];
	
	parent.itemType = map.itemTypes[documentRow.type];
	if (!parent.itemType) {
		Zotero.warn(`Unmapped item type ${documentRow.type}`);
	}
	if (!parent.itemType || parent.itemType == 'document') {
		parent.itemType = this._guessItemType(documentRow);
		Zotero.debug(`Guessing type ${parent.itemType}`);
	}
	var itemTypeID = Zotero.ItemTypes.getID(parent.itemType);
	
	for (let [mField, zField] of Object.entries(map.fields)) {
		// If not mapped, skip
		if (!zField) {
			continue;
		}
		let val = documentRow[mField];
		// If no value, skip
		if (!val) {
			continue;
		}
		
		if (typeof zField == 'string') {
			this._processField(parent, children, zField, val);
		}
		// Function embedded in map file
		else if (typeof zField == 'function') {
			let [field, val] = zField(documentRow[mField], parent);
			this._processField(parent, children, field, val);
		}
	}
	
	// URLs
	if (urls) {
		for (let i = 0; i < urls.length; i++) {
			let url = urls[i];
			let isPDF = url.includes('pdf');
			if (i == 0 && !isPDF) {
				parent.url = url;
			}
			else {
				children.push({
					itemType: 'attachment',
					parentItem: parent.key,
					linkMode: 'linked_url',
					url,
					title: isPDF ? 'PDF' : '',
					contentType: isPDF ? 'application/pdf' : ''
				});
			}
		}
	}
	
	// Combine date parts if present
	if (documentRow.year) {
		parent.date = documentRow.year.toString().substr(0, 4).padStart(4, '0');
		if (documentRow.month) {
			parent.date += '-' + documentRow.month.toString().substr(0, 2).padStart(2, '0');
			if (documentRow.day) {
				parent.date += '-' + documentRow.day.toString().substr(0, 2).padStart(2, '0');
			}
		}
	}
	
	for (let field in parent) {
		switch (field) {
		case 'itemType':
		case 'key':
		case 'parentItem':
		case 'note':
		case 'creators':
		case 'dateAdded':
		case 'dateModified':
			continue;
		}
		
		// Move unknown/invalid fields to Extra
		let fieldID = Zotero.ItemFields.getID(field)
			&& Zotero.ItemFields.getFieldIDFromTypeAndBase(parent.itemType, field);
		if (!fieldID) {
			Zotero.warn(`Moving '${field}' to Extra for type ${parent.itemType}`);
			parent.extra = this._addExtraField(parent.extra, field, parent[field]);
			delete parent[field];
			continue;
		}
		let newField = Zotero.ItemFields.getName(fieldID);
		if (field != newField) {
			parent[newField] = parent[field];
			delete parent[field];
		}
	}
	
	if (!parent.dateModified) {
		parent.dateModified = parent.dateAdded;
	}
	
	if (creators) {
		// Add main creators before any added by fields (e.g., seriesEditor)
		parent.creators = [...creators, ...(parent.creators || [])];
		
		// If item type has a different primary type, use that for author to prevent a warning
		let primaryCreatorType = Zotero.CreatorTypes.getName(
			Zotero.CreatorTypes.getPrimaryIDForType(itemTypeID)
		);
		if (primaryCreatorType != 'author') {
			for (let creator of parent.creators) {
				if (creator.creatorType == 'author') {
					creator.creatorType = primaryCreatorType;
				}
			}
		}
		
		for (let creator of parent.creators) {
			// seriesEditor isn't valid on some item types (e.g., book)
			if (creator.creatorType == 'seriesEditor'
					&& !Zotero.CreatorTypes.isValidForItemType(
							Zotero.CreatorTypes.getID('seriesEditor'), itemTypeID)) {
				creator.creatorType = 'editor';
			}
		}
	}
	parent.tags = [];
	// Add star tag for favorites
	if (documentRow.favourite === 'true' || documentRow.favourite === true) {
		parent.tags.push('\u2605');
	}
	if (tags) {
		parent.tags.push(...tags);
	}
	if (collections) parent.collections = collections;
	
	// Copy date added/modified to child item
	var parentDateAdded = parent.dateAdded;
	var parentDateModified = parent.dateModified;
	for (let child of children) {
		child.dateAdded = parentDateAdded;
		child.dateModified = parentDateModified;
	}
	
	// Don't set an explicit key if no children
	if (!children.length) {
		delete parent.key;
	}
	
	var documentUUID = documentRow.uuid.replace(/^\{/, '').replace(/\}$/, '');
	parent.relations = {
		'mendeleyDB:documentUUID': documentUUID
	};
	if (documentRow.remoteUuid) {
		parent.relations['mendeleyDB:remoteDocumentUUID'] = documentRow.remoteUuid;
	}
	
	for (let child of children) {
		// Add relation to child note
		if (child.itemType == 'note') {
			child.relations = {
				'mendeleyDB:relatedDocumentUUID': documentUUID
			};
			if (documentRow.remoteUuid) {
				child.relations['mendeleyDB:relatedRemoteDocumentUUID'] = documentRow.remoteUuid;
			}
			break;
		}
	}
	
	parent.documentID = documentRow.id;
	
	var json = [parent, ...children];
	//Zotero.debug(json);
	return json;
};

/**
 * Try to figure out item type based on available fields
 */
Zotero_Import_Mendeley.prototype._guessItemType = function (documentRow) {
	if (documentRow.issn || documentRow.issue) {
		return 'journalArticle';
	}
	if (documentRow.isbn) {
		return 'book';
	}
	return 'document';
};

Zotero_Import_Mendeley.prototype._extractSubfield = function (field) {
	var sub = field.match(/([a-z]+)\[([^\]]+)]/);
	return sub ? { field: sub[1], subfield: sub[2] } : { field };
};

Zotero_Import_Mendeley.prototype._processField = function (parent, children, zField, val) {
	var { field, subfield } = this._extractSubfield(zField);
	if (subfield) {
		// Combine 'city' and 'country' into 'place'
		if (field == 'place') {
			if (subfield == 'city') {
				parent.place = val + (parent.place ? ', ' + parent.place : '');
			}
			else if (subfield == 'country') {
				parent.place = (parent.place ? ', ' + parent.place : '') + val;
			}
		}
		// Convert some item fields as creators
		else if (field == 'creator') {
			if (!parent.creators) {
				parent.creators = [];
			}
			parent.creators.push(this._makeCreator(subfield, null, val));
		}
		else if (field == 'extra') {
			parent.extra = this._addExtraField(parent.extra, subfield, val);
		}
		// Functions
		else if (field == 'func') {
			// Convert unix timestamps to ISO dates
			if (subfield.startsWith('fromUnixtime')) {
				let [, zField] = subfield.split(':');
				parent[zField] = Zotero.Date.dateToISO(new Date(val));
			}
			// If 'pages' isn't valid for itemType, use 'numPages' instead
			else if (subfield == 'pages') {
				let itemTypeID = Zotero.ItemTypes.getID(parent.itemType);
				if (!Zotero.ItemFields.isValidForType('pages', itemTypeID)
						&& Zotero.ItemFields.isValidForType('numPages', itemTypeID)) {
					zField = 'numPages';
				}
				else {
					zField = 'pages';
				}
				parent[zField] = val;
			}
			// Notes become child items
			else if (subfield == 'note') {
				children.push({
					parentItem: parent.key,
					itemType: 'note',
					note: this._convertNote(val)
				});
			}
			else {
				Zotero.warn(`Unknown function subfield: ${subfield}`);
				return;
			}
		}
		else {
			Zotero.warn(`Unknown field: ${field}[${subfield}]`);
		}
	}
	else {
		// These are added separately so that they're available for notes
		if (zField == 'dateAdded' || zField == 'dateModified') {
			return;
		}
		parent[zField] = val;
	}
};

Zotero_Import_Mendeley.prototype._makeCreator = function (creatorType, firstName, lastName) {
	var creator = { creatorType };
	if (firstName) {
		creator.firstName = firstName;
		creator.lastName = lastName;
	}
	else {
		creator.name = lastName;
	}
	return creator;
};

Zotero_Import_Mendeley.prototype._addExtraField = function (extra, field, val) {
	// Strip the field if it appears at the beginning of the value (to avoid "DOI: DOI: 10...")
	if (typeof val == 'string') {
		val = val.replace(new RegExp(`^${field}:\s*`, 'i'), "");
	}
	extra = extra ? extra + '\n' : '';
	if (field != 'arXiv') {
		field = field[0].toUpperCase() + field.substr(1);
		field = field.replace(/([a-z])([A-Z][a-z])/, "$1 $2");
	}
	return extra + `${field}: ${val}`;
};

Zotero_Import_Mendeley.prototype._convertNote = function (note) {
	return note
		// Add newlines after <br>
		.replace(/<br\s*\/>/g, '<br\/>\n')
		//
		// Legacy pre-HTML stuff
		//
		// <m:linebreak>
		.replace(/<m:linebreak><\/m:linebreak>/g, '<br/>')
		// <m:bold>
		.replace(/<(\/)?m:bold>/g, '<$1b>')
		// <m:italic>
		.replace(/<(\/)?m:italic>/g, '<$1i>')
		// <m:center>
		.replace(/<m:center>/g, '<p style="text-align: center;">')
		.replace(/<\/m:center>/g, '</p>')
		// <m:underline>
		.replace(/<m:underline>/g, '<span style="text-decoration: underline;">')
		.replace(/<\/m:underline>/g, '</span>');
};

Zotero_Import_Mendeley.prototype._saveItems = async function (libraryID, json) {
	var idMap = new Map();
	
	var lastExistingParentItem;
	for (let i = 0; i < json.length; i++) {
		let itemJSON = json[i];
		
		// Check if the item has been previously imported
		let item = await this._findExistingItem(libraryID, itemJSON, lastExistingParentItem);
		if (item) {
			if (item.isRegularItem()) {
				lastExistingParentItem = item;
				
				// Fill in Publication if empty, since it was missed in an early version of the
				// online importer
				if (itemJSON.publicationTitle && !item.getField('publicationTitle')) {
					item.setField('publicationTitle', itemJSON.publicationTitle);
				}

				// Add "★" tag if not present, since it was previously missed in the online importer
				if ((itemJSON.tags || []).includes('\u2605') && !item.hasTag('\u2605')) {
					item.addTag('\u2605');
				}
				
				// Update any child items to point to the existing item's key instead of the
				// new generated one
				this._updateParentKeys('item', json, i + 1, itemJSON.key, item.key);
				
				// Leave item in any collections it's in
				itemJSON.collections = item.getCollections()
					.map(id => Zotero.Collections.getLibraryAndKeyFromID(id).key)
					.concat(itemJSON.collections || []);
			}
		}
		else {
			lastExistingParentItem = null;
			
			item = new Zotero.Item;
			item.libraryID = libraryID;
			if (itemJSON.key) {
				item.key = itemJSON.key;
				await item.loadPrimaryData();
			}
		}
		
		// Remove external id before save
		let toSave = Object.assign({}, itemJSON);
		delete toSave.documentID;
		
		item.fromJSON(toSave);
		await item.saveTx({
			skipDateModifiedUpdate: true,
			...this._saveOptions
		});
		if (itemJSON.documentID) {
			idMap.set(itemJSON.documentID, item.id);
		}
	}
	return idMap;
};


Zotero_Import_Mendeley.prototype._findExistingItem = async function (libraryID, itemJSON, existingParentItem) {
	var predicate;
	
	//
	// Child item
	//
	if (existingParentItem) {
		if (itemJSON.itemType == 'note') {
			if (!itemJSON.relations) {
				return false;
			}
			
			// Main note
			let parentUUID = itemJSON.relations['mendeleyDB:relatedDocumentUUID'];
			let parentRemoteUUID = itemJSON.relations['mendeleyDB:relatedRemoteDocumentUUID'];
			if (parentUUID) {
				let notes = existingParentItem.getNotes().map(id => Zotero.Items.get(id));
				for (let note of notes) {
					predicate = 'mendeleyDB:relatedDocumentUUID';
					let rels = note.getRelationsByPredicate(predicate);
					if (rels.length && rels[0] == parentUUID) {
						Zotero.debug(`Found existing item ${note.libraryKey} for `
								+ `${predicate} ${parentUUID}`);
						return note;
					}
					if (parentRemoteUUID) {
						predicate = 'mendeleyDB:relatedRemoteDocumentUUID';
						rels = note.getRelationsByPredicate(predicate);
						if (rels.length && rels[0] == parentRemoteUUID) {
							Zotero.debug(`Found existing item ${note.libraryKey} for `
								+ `${predicate} ${parentRemoteUUID}`);
							return note;
						}
					}
				}
				return false;
			}
		}
		else if (itemJSON.itemType == 'attachment') {
			// Linked-URL attachments (other attachments are handled in _saveFilesAndAnnotations())
			if (itemJSON.linkMode == 'linked_url') {
				let attachments = existingParentItem.getAttachments().map(id => Zotero.Items.get(id));
				for (let attachment of attachments) {
					if (attachment.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL
							&& attachment.getField('url') == itemJSON.url) {
						Zotero.debug(`Found existing link attachment ${attachment.libraryKey}`);
						return attachment;
					}
				}
			}
		}
		
		return false;
	}
	
	//
	// Parent item
	//
	if (!itemJSON.relations) {
		return false;
	}
	var existingItem;
	predicate = 'mendeleyDB:documentUUID';
	if (itemJSON.relations[predicate]) {
		existingItem = await this._getItemByRelation(
			libraryID,
			predicate,
			itemJSON.relations[predicate]
		);
	}
	if (!existingItem) {
		predicate = 'mendeleyDB:remoteDocumentUUID';
		if (itemJSON.relations[predicate]) {
			existingItem = await this._getItemByRelation(
				libraryID,
				predicate,
				itemJSON.relations[predicate]
			);
		}
	}
	// If not found or in trash
	if (!existingItem) {
		return false;
	}
	Zotero.debug(`Found existing item ${existingItem.libraryKey} for `
		+ `${predicate} ${itemJSON.relations[predicate]}`);
	return existingItem;
}


Zotero_Import_Mendeley.prototype._getItemByRelation = async function (libraryID, predicate, object) {
	var items = (await Zotero.Relations.getByPredicateAndObject('item', predicate, object))
		.filter(item => item.libraryID == libraryID && !item.deleted);
	if (!items.length) {
		return false;
	}
	return items[0];
};


/**
 * Saves attachments and annotations for a given document
 */
Zotero_Import_Mendeley.prototype._saveFilesAndAnnotations = async function (files, libraryID, parentItemID, annotations) {
	for (let file of files) {
		try {
			if (!file.fileURL) continue;
			
			let path = OS.Path.fromFileURI(file.fileURL);
			let realPath = await this._getRealFilePath(path);
			
			let attachment;
			if (realPath) {
				attachment = this._findExistingFile(parentItemID, file);
				// If file hasn't already been imported, import it
				if (!attachment) {
					let options = {
						libraryID,
						parentItemID,
						file: realPath,
						title: file.title,
						contentType: file.contentType
					};

					// If we're not set to link files or file is in Mendeley downloads folder, import it
					if (!this._linkFiles || this._isDownloadedFile(path) || this._isTempDownloadedFile(path)) {
						if (file.url) {
							options.title = file.title;
							options.url = file.url;
							options.singleFile = true;
							attachment = await Zotero.Attachments.importSnapshotFromFile(options);
						}
						else {
							if (file.fileBaseName) {
								options.fileBaseName = file.fileBaseName;
							}
							attachment = await Zotero.Attachments.importFromFile(options);
						}
					}
					// Otherwise link it
					else {
						attachment = await Zotero.Attachments.linkFromFile(options);
					}
					attachment.setRelations({
						'mendeleyDB:fileHash': file.hash
					});
					await attachment.saveTx(this._saveOptions);
				}
			}
			else {
				Zotero.warn(path + " not found -- not importing");
			}
			
			if (annotations) {
				await this._saveAnnotations(
					// We have annotations from all files for this document, so limit to just those on
					// this file
					annotations.filter(a => a.hash == file.hash),
					parentItemID,
					attachment ? attachment.id : null,
					file.hash
				);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
}


Zotero_Import_Mendeley.prototype._findExistingFile = function (parentItemID, file) {
	var item = Zotero.Items.get(parentItemID);
	var attachmentIDs = item.getAttachments();
	for (let attachmentID of attachmentIDs) {
		let attachment = Zotero.Items.get(attachmentID);
		let predicate = 'mendeleyDB:fileHash';
		let rels = attachment.getRelationsByPredicate(predicate);
		if (rels.includes(file.hash)) {
			Zotero.debug(`Found existing file ${attachment.libraryKey} for `
				+ `${predicate} ${file.hash}`);
			return attachment;
		}
	}
	return false;
}

Zotero_Import_Mendeley.prototype._isDownloadedFile = function (path) {
	var parentDir = OS.Path.dirname(path);
	return parentDir.endsWith(OS.Path.join('Application Support', 'Mendeley Desktop', 'Downloaded'))
		|| parentDir.endsWith(OS.Path.join('Local', 'Mendeley Ltd', 'Mendeley Desktop', 'Downloaded'))
		|| parentDir.endsWith(OS.Path.join('Local', 'Mendeley Ltd.', 'Mendeley Desktop', 'Downloaded'))
		|| parentDir.endsWith(OS.Path.join('data', 'Mendeley Ltd.', 'Mendeley Desktop', 'Downloaded'));
}

Zotero_Import_Mendeley.prototype._isTempDownloadedFile = function (path) {
	var parentDir = OS.Path.dirname(path);
	return parentDir.startsWith(OS.Path.join(Zotero.getTempDirectory().path, 'm-api'));
};

/**
 * Get the path to use for a file that exists, or false if none
 *
 * This can be either the original path or, for a file in the Downloaded directory, in a directory
 * relative to the database.
 *
 * @return {String|false}
 */
Zotero_Import_Mendeley.prototype._getRealFilePath = async function (path) {
	if (await OS.File.exists(path)) {
		return path;
	}
	var isDownloadedFile = this._isDownloadedFile(path);
	if (!isDownloadedFile) {
		return false;
	}
	// For file paths in Downloaded folder, try relative to database if not found at the
	// absolute location, in case this is a DB backup
	var dataDir = OS.Path.dirname(this._file);
	var altPath = OS.Path.join(dataDir, 'Downloaded', OS.Path.basename(path));
	if (altPath != path && await OS.File.exists(altPath)) {
		return altPath;
	}
	return false;
}

Zotero_Import_Mendeley.prototype._saveAnnotations = async function (annotations, parentItemID, attachmentItemID, fileHash) {
	if (!annotations.length) return;
	var noteStrings = [];
	var parentItem = Zotero.Items.get(parentItemID);
	var libraryID = parentItem.libraryID;
	if (attachmentItemID) {
		var attachmentItem = Zotero.Items.get(attachmentItemID);
		var attachmentURIPath = Zotero.API.getLibraryPrefix(libraryID) + '/items/' + attachmentItem.key;
		
		if (attachmentItem) {
			let file = await attachmentItem.getFilePathAsync();
			if (file) {
				// Fix blank PDF attachment MIME type from previous imports
				if (!attachmentItem.attachmentContentType) {
					let type = 'application/pdf';
					if (Zotero.MIME.sniffForMIMEType(await Zotero.File.getSample(file)) == type) {
						attachmentItem.attachmentContentType = type;
						await attachmentItem.saveTx(this._saveOptions);
					}
				}
				
				let annotationMap = new Map();
				for (let annotation of annotations) {
					// 'type', 'uuid', 'hash', 'color', 'dateAdded', 'page'
					// For highlights: 'rects' (array of { x1, y1, x2, y2 })
					// For notes: 'dateModified', 'x', 'y'
					annotationMap.set(annotation.uuid, annotation);
				}
				// PDFWorker needs 'id'
				annotations.forEach(annotation => annotation.id = annotation.uuid);
				// Returns 'id', 'position', 'type', 'pageLabel', 'sortIndex', 'text' (for highlight)
				Zotero.debug("Processing annotations in " + file);
				annotations = await Zotero.PDFWorker.processMendeleyAnnotations(file, annotations);
				Zotero.debug("Done processing annotations");
				
				for (let annotation of annotations) {
					// Ignore empty highlights
					if (annotation.type == 'highlight' && !annotation.text) {
						continue;
					}
					
					let o = annotationMap.get(annotation.id);
					Object.assign(o, annotation);
					
					// Check for existing annotation, and update it if found
					predicate = 'mendeleyDB:annotationUUID';
					let existingItem = await this._getItemByRelation(
						attachmentItem.libraryID,
						predicate,
						o.uuid
					);
					let key = existingItem
						? existingItem.key
						: Zotero.DataObjectUtilities.generateKey();
					await Zotero.Annotations.saveFromJSON(
						attachmentItem,
						{
							key,
							type: o.type,
							text: o.text,
							comment: o.note,
							color: o.color,
							pageLabel: o.pageLabel,
							sortIndex: o.sortIndex,
							position: o.position,
							relations: {
								[predicate]: o.uuid
							}
						},
						{
							skipSelect: true
						}
					);
				}
				return;
			}
		}
	}
	
	// If no file, create note from extracted annotations instead
	for (let annotation of annotations) {
		if (!annotation.note || !annotation.note.trim()) continue;
		
		let linkStr = `note on p. ${annotation.page}`;
		noteStrings.push(
			Zotero.Utilities.text2html(annotation.note.trim())
				+ `<p class="pdf-link" style="margin-top: -0.5em; margin-bottom: 2em; font-size: .9em; text-align: right;">(${linkStr})</p>`
		);
	}
	
	if (!noteStrings.length) return;
	
	// Look for an existing note
	var existingNotes = parentItem.getNotes().map(id => Zotero.Items.get(id));
	var predicate = 'mendeleyDB:relatedFileHash';
	var note;
	for (let n of existingNotes) {
		let rels = n.getRelationsByPredicate(predicate);
		if (rels.length && rels[0] == fileHash) {
			Zotero.debug(`Found existing note ${n.libraryKey} for ${predicate} ${fileHash}`);
			note = n;
			break;
		}
	}
	// If not found, create new one
	if (!note) {
		note = new Zotero.Item('note');
		note.libraryID = libraryID;
		note.parentItemID = parentItemID;
		
		// Add relation to associated file
		note.setRelations({
			'mendeleyDB:relatedFileHash': fileHash
		});
	}
	note.setNote('<h1>' + Zotero.getString('extractedAnnotations') + '</h1>\n' + noteStrings.join('\n'));
	return note.saveTx(this._saveOptions);
};


Zotero_Import_Mendeley.prototype._updateParentKeys = function (objectType, json, i, oldKey, newKey) {
	var prop = 'parent' + objectType[0].toUpperCase() + objectType.substr(1);
	
	for (; i < json.length; i++) {
		let x = json[i];
		if (x[prop] == oldKey) {
			x[prop] = newKey;
		}
		// Child items are grouped together, so we can stop as soon as we stop seeing the prop
		else if (objectType == 'item') {
			break;
		}
	}
}

Zotero_Import_Mendeley.prototype._updateItemCollectionKeys = function (json, oldKey, newKey) {
	for (; i < json.length; i++) {
		let x = json[i];
		if (x[prop] == oldKey) {
			x[prop] = newKey;
		}
	}
}


//
// Clean up extra files created <5.0.51
//
Zotero_Import_Mendeley.prototype.hasImportedFiles = async function () {
	return !!(await Zotero.DB.valueQueryAsync(
		"SELECT itemID FROM itemRelations JOIN relationPredicates USING (predicateID) "
			+ "WHERE predicate='mendeleyDB:fileHash' LIMIT 1"
	));
};

Zotero_Import_Mendeley.prototype.queueFileCleanup = async function () {
	await Zotero.DB.queryAsync("INSERT INTO settings VALUES ('mImport', 'cleanup', 1)");
};

Zotero_Import_Mendeley.prototype.deleteNonPrimaryFiles = async function () {
	var rows = await Zotero.DB.queryAsync(
		"SELECT key, path FROM itemRelations "
			+ "JOIN relationPredicates USING (predicateID) "
			+ "JOIN items USING (itemID) "
			+ "JOIN itemAttachments USING (itemID) "
			+ "WHERE predicate='mendeleyDB:fileHash' AND linkMode=1" // imported_url
	);
	for (let row of rows) {
		let dir = (Zotero.Attachments.getStorageDirectoryByLibraryAndKey(1, row.key)).path;
		if (!row.path.startsWith('storage:')) {
			Zotero.logError(row.path + " does not start with 'storage:'");
			continue;
		}
		let filename = row.path.substr(8);
		
		Zotero.debug(`Checking for extra files in ${dir}`);
		await Zotero.File.iterateDirectory(dir, async function (entry) {
			if (entry.name.startsWith('.zotero') || entry.name == filename) {
				return;
			}
			Zotero.debug(`Deleting ${entry.path}`);
			try {
				await OS.File.remove(entry.path);
			}
			catch (e) {
				Zotero.logError(e);
			}
		});
	}
	
	await Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='mImport' AND key='cleanup'");
};
