var EXPORTED_SYMBOLS = ["Zotero_Import_Mendeley"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");
Services.scriptloader.loadSubScript("chrome://zotero/content/include.js");

var Zotero_Import_Mendeley = function () {
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

Zotero_Import_Mendeley.prototype.translate = async function (options) {
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
				dontCache: true,
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
		await this._saveCollections(libraryID, collectionJSON);
		
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
			// Save each document with its attributes
			let itemJSON = await this._documentToAPIJSON(
				map,
				document,
				urls.get(document.id),
				creators.get(document.id),
				tags.get(document.id),
				collections.get(document.id),
				annotations.get(document.id)
			);
			let documentIDMap = await this._saveItems(libraryID, itemJSON);
			// Save the document's attachments and extracted annotations for any of them
			let docFiles = files.get(document.id);
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
		`SELECT F.*, RF.remoteUuid FROM Folders F `
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
Zotero_Import_Mendeley.prototype._saveCollections = async function (libraryID, json) {
	var idMap = new Map();
	for (let collectionJSON of json) {
		let collection = new Zotero.Collection;
		collection.libraryID = libraryID;
		if (collectionJSON.key) {
			collection.key = collectionJSON.key;
			await collection.loadPrimaryData();
		}
		
		// Remove external ids before saving
		let toSave = Object.assign({}, collectionJSON);
		delete toSave.folderID;
		delete toSave.remoteUUID;
		
		collection.fromJSON(toSave);
		await collection.saveTx({
			skipSelect: true
		});
		idMap.set(collectionJSON.folderID, collection.id);
	}
	return idMap;
};


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
		keys.push(folderKeys.get(row.folderId));
		map.set(row.documentId, keys);
	}
	return map;
};

/**
 * Get a Map of document ids to file metadata
 */
Zotero_Import_Mendeley.prototype._getDocumentFiles = async function (groupID) {
	var rows = await this._db.queryAsync(
		`SELECT documentId, hash, remoteFileUuid, localUrl FROM DocumentFiles `
			+ `JOIN Files USING (hash) `
			+ `JOIN RemoteDocuments USING (documentId) `
			+ `WHERE groupId=?`,
		groupID
	);
	var map = new Map();
	for (let row of rows) {
		let docFiles = map.get(row.documentId);
		if (!docFiles) docFiles = [];
		docFiles.push({
			hash: row.hash,
			uuid: row.remoteFileUuid,
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
	if (tags) parent.tags = tags;
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
	
	parent.relations = {
		'mendeleyDB:documentUUID': documentRow.uuid.replace(/^\{/, '').replace(/\}$/, '')
	};
	if (documentRow.remoteUuid) {
		parent.relations['mendeleyDB:remoteDocumentUUID'] = documentRow.remoteUuid;
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
	await Zotero.DB.executeTransaction(async function () {
		for (let itemJSON of json) {
			let item = new Zotero.Item;
			item.libraryID = libraryID;
			if (itemJSON.key) {
				item.key = itemJSON.key;
				await item.loadPrimaryData();
			}
			
			// Remove external id before save
			let toSave = Object.assign({}, itemJSON);
			delete toSave.documentID;
			
			item.fromJSON(toSave);
			await item.save({
				skipSelect: true,
				skipDateModifiedUpdate: true
			});
			if (itemJSON.documentID) {
				idMap.set(itemJSON.documentID, item.id);
			}
		}
	}.bind(this));
	return idMap;
};

/**
 * Saves attachments and extracted annotations for a given document
 */
Zotero_Import_Mendeley.prototype._saveFilesAndAnnotations = async function (files, libraryID, parentItemID, annotations) {
	var dataDir = OS.Path.dirname(this._file);
	for (let file of files) {
		try {
			if (!file.fileURL) continue;
			
			let path = OS.Path.fromFileURI(file.fileURL);
			let isDownloadedFile = this._isDownloadedFile(path);
			let fileExists = false;
			
			if (await OS.File.exists(path)) {
				fileExists = true;
			}
			// For file paths in Downloaded folder, try relative to database if not found at the
			// absolute location, in case this is a DB backup
			else if (isDownloadedFile) {
				let altPath = OS.Path.join(dataDir, 'Downloaded', OS.Path.basename(path));
				if (altPath != path && await OS.File.exists(altPath)) {
					path = altPath;
					fileExists = true;
				}
			}
			
			let attachment;
			if (fileExists) {
				let options = {
					libraryID,
					parentItemID,
					file: path
				};
				// If file is in Mendeley downloads folder, import it
				if (isDownloadedFile) {
					attachment = await Zotero.Attachments.importFromFile(options);
				}
				// Otherwise link it
				else {
					attachment = await Zotero.Attachments.linkFromFile(options);
				}
				attachment.relations = {
					'mendeleyDB:fileHash': file.hash,
					'mendeleyDB:fileUUID': file.uuid
				};
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
					attachment ? attachment.id : null
				);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
}

Zotero_Import_Mendeley.prototype._isDownloadedFile = async function (path) {
	var parentDir = OS.Path.dirname(path);
	return parentDir.endsWith(OS.Path.join('Application Support', 'Mendeley Desktop', 'Downloaded'))
		|| parentDir.endsWith(OS.Path.join('Local', 'Mendeley Ltd', 'Desktop', 'Downloaded'))
		|| parentDir.endsWith(OS.Path.join('data', 'Mendeley Ltd.', 'Mendeley Desktop', 'Downloaded'));
}

Zotero_Import_Mendeley.prototype._saveAnnotations = async function (annotations, parentItemID, attachmentItemID) {
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
	
	let note = new Zotero.Item('note');
	note.libraryID = libraryID;
	note.parentItemID = parentItemID;
	note.setNote('<h1>' + Zotero.getString('extractedAnnotations') + '</h1>\n' + noteStrings.join('\n'));
	return note.saveTx({
		skipSelect: true
	});
};
