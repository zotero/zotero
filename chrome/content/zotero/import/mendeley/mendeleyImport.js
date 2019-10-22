var EXPORTED_SYMBOLS = ["Zotero_Import_Mendeley"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");
Services.scriptloader.loadSubScript("chrome://zotero/content/include.js");

var Zotero_Import_Mendeley = function () {
	this.createNewCollection = null;
	this.linkFiles = null;
	this.newItems = [];
	
	this._db;
	this._file;
	this._itemDone;
	this._progress = 0;
	this._progressMax;
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
	
	this._db = new Zotero.DBConnection(this._file);
	
	try {
		if (!await this._isValidDatabase()) {
			throw new Error("Not a valid Mendeley database");
		}
		
		// Collections
		let folders = await this._getFolders(mendeleyGroupID);
		let collectionJSON = this._foldersToAPIJSON(folders, rootCollectionKey);
		let folderKeys = this._getFolderKeys(collectionJSON);
		await this._saveCollections(libraryID, collectionJSON, folderKeys);
		
		//
		// Items
		//
		let documents = await this._getDocuments(mendeleyGroupID);
		this._progressMax = documents.length;
		// Get various attributes mapped to document ids
		let urls = await this._getDocumentURLs(mendeleyGroupID);
		let creators = await this._getDocumentCreators(mendeleyGroupID, map.creatorTypes);
		let tags = await this._getDocumentTags(mendeleyGroupID);
		let collections = await this._getDocumentCollections(
			mendeleyGroupID,
			documents,
			rootCollectionKey,
			folderKeys
		);
		let files = await this._getDocumentFiles(mendeleyGroupID);
		let annotations = await this._getDocumentAnnotations(mendeleyGroupID);
		for (let document of documents) {
			let docURLs = urls.get(document.id);
			let docFiles = files.get(document.id);
			
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
			
			// Save each document with its attributes
			let itemJSON = await this._documentToAPIJSON(
				map,
				document,
				docURLs,
				creators.get(document.id),
				tags.get(document.id),
				collections.get(document.id),
				annotations.get(document.id)
			);
			let documentIDMap = await this._saveItems(libraryID, itemJSON);
			// Save the document's attachments and extracted annotations for any of them
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
			await this._db.closeDatabase();
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		resumeSync();
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
Zotero_Import_Mendeley.prototype._getFolders = async function (groupID) {
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
		let collection = this._findExistingCollection(
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
		await collection.saveTx({
			skipSelect: true
		});
	}
};


Zotero_Import_Mendeley.prototype._findExistingCollection = function (libraryID, collectionJSON, parentCollection) {
	// Don't use existing collections if the import is creating a top-level collection
	if (this.createNewCollection || !collectionJSON.relations) {
		return false;
	}
	
	var predicate = 'mendeleyDB:remoteFolderUUID';
	var uuid = collectionJSON.relations[predicate];
	
	var collections = Zotero.Relations.getByPredicateAndObject('collection', predicate, uuid)
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
}


//
// Items
//
Zotero_Import_Mendeley.prototype._getDocuments = async function (groupID) {
	return this._db.queryAsync(
		`SELECT D.*, RD.remoteUuid FROM Documents D `
			+ `JOIN RemoteDocuments RD ON (D.id=RD.documentId) `
			+ `WHERE groupId=? AND inTrash='false'`,
		groupID
	);
};

/**
 * Get a Map of document ids to arrays of URLs
 *
 * @return {Map<Number,String[]>}
 */
Zotero_Import_Mendeley.prototype._getDocumentURLs = async function (groupID) {
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

/**
 * Get a Map of document ids to arrays of creator API JSON
 *
 * @param {Integer} groupID
 * @param {Object} creatorTypeMap - Mapping of Mendeley creator types to Zotero creator types
 */
Zotero_Import_Mendeley.prototype._getDocumentCreators = async function (groupID, creatorTypeMap) {
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

/**
 * Get a Map of document ids to arrays of tag API JSON
 */
Zotero_Import_Mendeley.prototype._getDocumentTags = async function (groupID) {
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

/**
 * Get a Map of document ids to arrays of collection keys
 */
Zotero_Import_Mendeley.prototype._getDocumentCollections = async function (groupID, documents, rootCollectionKey, folderKeys) {
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

/**
 * Get a Map of document ids to arrays of file metadata
 *
 * @return {Map<Number,Object[]>}
 */
Zotero_Import_Mendeley.prototype._getDocumentFiles = async function (groupID) {
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

/**
 * Get a Map of document ids to arrays of annotations
 */
Zotero_Import_Mendeley.prototype._getDocumentAnnotations = async function (groupID) {
	var rows = await this._db.queryAsync(
		`SELECT documentId, uuid, fileHash, page, note, color `
			+ `FROM FileNotes `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=? `
			+ `ORDER BY page, y, x`,
		groupID
	);
	var map = new Map();
	for (let row of rows) {
		let docAnnotations = map.get(row.documentId);
		if (!docAnnotations) docAnnotations = [];
		docAnnotations.push({
			uuid: row.uuid,
			hash: row.fileHash,
			note: row.note,
			page: row.page,
			color: row.color
		});
		map.set(row.documentId, docAnnotations);
	}
	return map;
};

/**
 * Create API JSON array with item and any child attachments or notes
 */
Zotero_Import_Mendeley.prototype._documentToAPIJSON = async function (map, documentRow, urls, creators, tags, collections, annotations) {
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
	if (documentRow.favourite == 'true') {
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
		let item = this._findExistingItem(libraryID, itemJSON, lastExistingParentItem);
		if (item) {
			if (item.isRegularItem()) {
				lastExistingParentItem = item;
				
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
			skipSelect: true,
			skipDateModifiedUpdate: true
		});
		if (itemJSON.documentID) {
			idMap.set(itemJSON.documentID, item.id);
		}
	}
	return idMap;
};


Zotero_Import_Mendeley.prototype._findExistingItem = function (libraryID, itemJSON, existingParentItem) {
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
		existingItem = this._getItemByRelation(
			libraryID,
			predicate,
			itemJSON.relations[predicate]
		);
	}
	if (!existingItem) {
		predicate = 'mendeleyDB:remoteDocumentUUID';
		if (itemJSON.relations[predicate]) {
			existingItem = this._getItemByRelation(
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


Zotero_Import_Mendeley.prototype._getItemByRelation = function (libraryID, predicate, object) {
	var items = Zotero.Relations.getByPredicateAndObject('item', predicate, object)
		.filter(item => item.libraryID == libraryID && !item.deleted);
	if (!items.length) {
		return false;
	}
	return items[0];
};


/**
 * Saves attachments and extracted annotations for a given document
 */
Zotero_Import_Mendeley.prototype._saveFilesAndAnnotations = async function (files, libraryID, parentItemID, annotations) {
	for (let file of files) {
		try {
			if (!file.fileURL) continue;
			
			let path = OS.Path.fromFileURI(file.fileURL);
			let realPath = await this._getRealFilePath(path);
			
			let attachment;
			if (realPath) {
				if (this._findExistingFile(parentItemID, file)) {
					continue;
				}
				
				let options = {
					libraryID,
					parentItemID,
					file: realPath,
					title: file.title
				};
				// If we're not set to link files or file is in Mendeley downloads folder, import it
				if (!this._linkFiles || this._isDownloadedFile(path)) {
					if (file.url) {
						options.title = file.title;
						options.url = file.url;
						options.contentType = file.contentType;
						options.singleFile = true;
						attachment = await Zotero.Attachments.importSnapshotFromFile(options);
					}
					else {
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
				await attachment.saveTx({
					skipSelect: true
				});
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
	}
	
	for (let annotation of annotations) {
		if (!annotation.note || !annotation.note.trim()) continue;
		
		let linkStr;
		let linkText = `note on p. ${annotation.page}`;
		if (attachmentItem) {
			let url = `zotero://open-pdf/${attachmentURIPath}?page=${annotation.page}`;
			linkStr = `<a href="${url}">${linkText}</a>`;
		}
		else {
			linkStr = linkText;
		}
		
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
	return note.saveTx({
		skipSelect: true
	});
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
