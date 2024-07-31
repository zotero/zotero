var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

chai.use(chaiAsPromised);

// Useful "constants"
var sqlDateTimeRe = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
var isoDateTimeRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
var zoteroObjectKeyRe = /^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/; // based on Zotero.Utilities::generateObjectKey()
var browserWindowInitialized = false;

/**
 * Waits for a DOM event on the specified node. Returns a promise
 * resolved with the event.
 */
function waitForDOMEvent(target, event, capture) {
	var deferred = Zotero.Promise.defer();
	var func = function(ev) {
		target.removeEventListener(event, func, capture);
		deferred.resolve(ev);
	}
	target.addEventListener(event, func, capture);
	return deferred.promise;
}

/**
 * Waits for a DOM element's attribute(s) to change.
 * @param {HTMLElement} target DOM element
 * @param {string | string[]} attributes array of attributes to watch
 * @param {(newValue, oldValue) => boolean} callback called whenever attributes changes. return true to stop waiting
 */
async function waitForDOMAttributes(target, attributes, callback) {
	if (typeof attributes === "string") {
		attributes = [attributes];
	}
	let deferred = Zotero.Promise.defer();
	function handleMutation(mutations) {
		for (let mutation of mutations) {
			if (mutation.type === 'attributes') {
				let oldValue = mutation.oldValue;
				let newValue = mutation.target.value;
				if (callback(newValue, oldValue)) {
					observer.disconnect();
					deferred.resolve();
					return;
				}
			}
		}
	}
	
	let observer = new MutationObserver(handleMutation);
	observer.observe(target, {
		attributes: true,
		attributeFilter: attributes,
		attributeOldValue: true,
	});

	await deferred.promise;
	observer.disconnect();
}

async function waitForRecognizer() {
	var win = await waitForWindow('chrome://zotero/content/progressQueueDialog.xhtml')
	// Wait for status to show as complete
	var completeStr = Zotero.getString("general.finished");
	while (win.document.getElementById("label").value != completeStr) {
		await Zotero.Promise.delay(20);
	}
	return win;
}

/**
 * Open a chrome window and return a promise for the window
 *
 * @return {Promise<ChromeWindow>}
 */
function loadWindow(winurl, argument) {
	var win = window.openDialog(winurl, "_blank", "chrome", argument);
	return waitForDOMEvent(win, "load").then(function() {
		return win;
	});
}

/**
 * Open a browser window and return a promise for the window
 *
 * @return {Promise<ChromeWindow>}
 */
function loadBrowserWindow() {
	var win = window.openDialog("chrome://browser/content/browser.xhtml", "", "all,height=700,width=1000");
	return waitForDOMEvent(win, "load").then(function() {
		return new Zotero.Promise((resolve) => {
			if (!browserWindowInitialized) {
				setTimeout(function () {
					browserWindowInitialized = true;
					resolve(win);
				}, 1000);
				return;
			}
			resolve(win);
		});
	});
}

/**
 * Open a Zotero window and return a promise for the window
 *
 * @return {Promise<ChromeWindow>}
 */
function loadZoteroWindow() {
	var win = window.openDialog("chrome://zotero/content/zoteroPane.xhtml", "", "all,height=700,width=1000");
	return waitForDOMEvent(win, "load").then(function() {
		return new Zotero.Promise((resolve) => {
			if (!browserWindowInitialized) {
				setTimeout(function () {
					browserWindowInitialized = true;
					resolve(win);
				}, 1000);
				return;
			}
			resolve(win);
		});
	});
}

/**
 * Opens the Zotero pane and selects My Library. Returns the containing window.
 *
 * @param {Window} [win] - Existing window to use; if not specified, a new window is opened
 */
var loadZoteroPane = async function (win) {
	if (!win) {
		var win = await loadZoteroWindow();
	}
	Zotero.Prefs.clear('lastViewedFolder');
	
	while (true) {
		if (win.ZoteroPane && win.ZoteroPane.collectionsView) {
			break;
		}
		Zotero.debug("Waiting for ZoteroPane initialization");
		await Zotero.Promise.delay(50);
	}
	
	await waitForItemsLoad(win, 0);
	
	return win;
};

var loadPrefPane = async function (paneName) {
	var id = 'zotero-prefpane-' + paneName;
	var win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", {
		pane: id
	});
	await win.Zotero_Preferences.waitForFirstPaneLoad();
	return win;
};


/**
 * Waits for a window with a specific URL to open. Returns a promise for the window, and
 * optionally passes the window to a callback immediately for use with modal dialogs,
 * which prevent async code from continuing
 */
function waitForWindow(uri, callback) {
	var deferred = Zotero.Promise.defer();
	var loadobserver = function(ev) {
		ev.originalTarget.removeEventListener("load", loadobserver, false);
		Zotero.debug("Window opened: " + ev.target.location.href);
		
		if (ev.target.location.href != uri) {
			Zotero.debug(`Ignoring window ${ev.target.location.href} in waitForWindow()`);
			return;
		}
		
		Services.ww.unregisterNotification(winobserver);
		var win = ev.target.ownerGlobal;
		// Give window code time to run on load
		win.setTimeout(function () {
			if (callback) {
				try {
					// If callback returns a promise, wait for it
					let maybePromise = callback(win);
					if (maybePromise && maybePromise.then) {
						maybePromise.then(() => deferred.resolve(win)).catch(e => deferred.reject(e));
						return;
					}
				}
				catch (e) {
					Zotero.logError(e);
					win.close();
					deferred.reject(e);
					return;
				}
			}
			deferred.resolve(win);
		});
	};
	var winobserver = {"observe":function(subject, topic, data) {
		if(topic != "domwindowopened") return;
		subject.addEventListener("load", loadobserver, false);
	}};
	Services.ww.registerNotification(winobserver);
	return deferred.promise;
}

/**
 * Wait for an alert or confirmation dialog to pop up and then close it
 *
 * @param {Function} [onOpen] - Function that is passed the window and dialog once it is opened.
 *                              Can be used to make assertions on the dialog contents
 *                              (e.g., with dialog.document.documentElement.textContent)
 * @param {String} [button='accept'] - Button in dialog to press (e.g., 'cancel', 'extra1')
 * @return {Promise}
 */
function waitForDialog(onOpen, button='accept', url) {
	return waitForWindow(url || "chrome://global/content/commonDialog.xhtml", Zotero.Promise.method(function (win) {
		var dialog = win.document.querySelector('dialog');
		var failure = false;
		if (onOpen) {
			try {
				onOpen(win, dialog);
			}
			catch (e) {
				failure = e;
			}
		}
		if (button === false) {
			if (failure) {
				throw failure;
			}
		}
		else if (button != 'cancel') {
			let deferred = Zotero.Promise.defer();
			function acceptWhenEnabled() {
				// Handle delayed buttons
				if (dialog.getButton(button).disabled) {
					win.setTimeout(function () {
						acceptWhenEnabled();
					}, 250);
				}
				else {
					dialog.getButton(button).click();
					if (failure) {
						deferred.reject(failure);
					}
					else {
						deferred.resolve();
					}
				}
			}
			acceptWhenEnabled();
			return deferred.promise;
		}
		else {
			dialog.getButton(button).click();
			if (failure) {
				throw failure;
			}
		}
	}))
}

async function select(win, object) {
	if (object instanceof Zotero.Library) {
		return selectLibrary(win, object);
	}
	if (object instanceof Zotero.Collection) {
		return selectCollection(win, object);
	}
	if (object instanceof Zotero.Search) {
		return selectSearch(win, object);
	}
	if (object instanceof Zotero.Item) {
		return win.ZoteroPane.itemsView.selectItem(object.id);
	}
	throw new Error("Unknown object");
}

async function selectLibrary(win, libraryOrID = Zotero.Libraries.userLibraryID) {
	var libraryID = libraryOrID instanceof Zotero.Library ? libraryOrID.libraryID : libraryOrID;
	await win.ZoteroPane.collectionsView.selectLibrary(libraryID);
	await waitForItemsLoad(win);
}

async function selectCollection(win, collectionOrID) {
	var collectionID = collectionOrID instanceof Zotero.Collection ? collectionOrID.id : collectionOrID;
	await win.ZoteroPane.collectionsView.selectCollection(collectionID);
	await waitForItemsLoad(win);
}

async function selectSearch(win, searchOrID) {
	var searchID = searchOrID instanceof Zotero.Search ? searchOrID.id : searchOrID;
	await win.ZoteroPane.collectionsView.selectSearch(searchID);
	await waitForItemsLoad(win);
}

async function selectTrash(win, libraryID = Zotero.Libraries.userLibraryID) {
	await win.ZoteroPane.collectionsView.selectTrash(libraryID);
	await waitForItemsLoad(win);
}

var waitForItemsLoad = Zotero.Promise.coroutine(function* (win, collectionRowToSelect) {
	var zp = win.ZoteroPane;
	var cv = zp.collectionsView;
	
	yield cv.waitForLoad();
	if (collectionRowToSelect !== undefined) {
		yield cv.selectWait(collectionRowToSelect);
	}
	yield zp.itemsView.waitForLoad();
});

/**
 * Return a promise that resolves once the tag selector has updated
 *
 * Some operations result in two tag selector updates, one from the notify() and another from
 * onItemViewChanged(). Pass 2 for numUpdates to wait for both.
 */
var waitForTagSelector = function (win, numUpdates = 1) {
	var updates = 0;
	
	var zp = win.ZoteroPane;
	var deferred = Zotero.Promise.defer();
	if (zp.tagSelectorShown()) {
		let tagSelector = zp.tagSelector;
		let componentDidUpdate = tagSelector.componentDidUpdate;
		tagSelector.componentDidUpdate = function() {
			updates++;
			if (updates == numUpdates) {
				deferred.resolve();
				tagSelector.componentDidUpdate = componentDidUpdate;
			}
			if (typeof componentDidUpdate == 'function') {
				componentDidUpdate.call(this, arguments);
			}
		}
	}
	else {
		deferred.resolve();
	}
	return deferred.promise;
};

var waitForCollectionTree = function(win) {
	let cv = win.ZoteroPane.collectionsView;
	return cv._waitForEvent('refresh');
}

/**
 * Waits for a single item event. Returns a promise for the item ID(s).
 */
function waitForItemEvent(event) {
	return waitForNotifierEvent(event, 'item').then(x => x.ids);
}

/**
 * Wait for a single notifier event and return a promise for the data
 *
 * Tests run after all other handlers (priority 101, since handlers are 100 by default)
 */
function waitForNotifierEvent(event, type) {
	if (!event) throw new Error("event not provided");
	
	var deferred = Zotero.Promise.defer();
	var notifierID = Zotero.Notifier.registerObserver({notify:function(ev, type, ids, extraData) {
		if(ev == event) {
			Zotero.Notifier.unregisterObserver(notifierID);
			deferred.resolve({
				ids: ids,
				extraData: extraData
			});
		}
	}}, [type], 'test', 101);
	return deferred.promise;
}

/**
 * Hang tests for manual inspection
 */
async function pause(thisObj) {
	thisObj.timeout(100000000);
	await Zotero.Promise.delay(100000000);
}

/**
 * Looks for windows with a specific URL.
 */
function getWindows(uri) {
	var enumerator = Services.wm.getEnumerator(null);
	var wins = [];
	while(enumerator.hasMoreElements()) {
		var win = enumerator.getNext();
		if(win.location == uri) {
			wins.push(win);
		}
	}
	return wins;
}

/**
 * Resolve a promise when a specified callback returns true. interval
 * specifies the interval between checks. timeout specifies when we
 * should assume failure.
 */
function waitForCallback(cb, interval, timeout) {
	var deferred = Zotero.Promise.defer();
	if(interval === undefined) interval = 100;
	if(timeout === undefined) timeout = 10000;
	var start = Date.now();
	var id = setInterval(function() {
		var success = cb();
		if(success) {
			clearInterval(id);
			deferred.resolve(success);
		} else if(Date.now() - start > timeout*1000) {
			clearInterval(id);
			deferred.reject(new Error("Promise timed out"));
		}
	}, interval);
	return deferred.promise;
}


async function delay(ms) {
	return Zotero.Promise.delay(ms);
}

async function waitForFrame() {
	return waitNoLongerThan(new Promise((resolve) => {
		requestAnimationFrame(resolve);
	}), 30);
}

async function waitForFrames(n) {
	for (let i = 0; i < n; i++) {
		await waitForFrame();
	}
}

async function waitNoLongerThan(promise, ms = 1000) {
	return Promise.race([
		promise,
		Zotero.Promise.delay(ms)
	]);
}

async function waitForScrollToPane(itemDetails, paneID) {
	await itemDetails._renderPromise;
	itemDetails.scrollToPane(paneID, "instant");
	// Wait for some frames or up to 150ms to ensure the pane is visible
	await waitForFrames(5);
}

function clickOnItemsRow(win, itemsView, row) {
	itemsView._treebox.scrollToRow(row);
	let elem = win.document.querySelector(`#${itemsView.id}-row-${row}`);
	elem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
}


/**
 * Synchronous inflate
 */
function gunzip(gzdata) {
	return pako.inflate(gzdata, { to: 'string' });
}


/**
 * Get a default group used by all tests that want one, creating one if necessary
 */
var _defaultGroup;
var getGroup = Zotero.Promise.method(function () {
	// Cleared in resetDB()
	if (_defaultGroup) {
		return _defaultGroup;
	}
	return _defaultGroup = createGroup({
		name: "My Group"
	});
});


var createGroup = Zotero.Promise.coroutine(function* (props = {}) {
	// Create a group item requires the current user to be set
	if (!Zotero.Users.getCurrentUserID()) {
		yield Zotero.Users.setCurrentUserID(1);
		yield Zotero.Users.setName(1, 'Name');
	}
	
	var group = new Zotero.Group;
	group.id = props.id || Zotero.Utilities.rand(10000, 1000000);
	group.name = props.name || "Test " + Zotero.Utilities.randomString();
	group.description = props.description || "";
	group.editable = props.editable === undefined ? true : props.editable;
	group.filesEditable = props.filesEditable === undefined ? true : props.filesEditable;
	group.version = props.version === undefined ? Zotero.Utilities.rand(1000, 10000) : props.version;
	if (props.libraryVersion) {
		group.libraryVersion = props.libraryVersion;
	}
	group.archived = props.archived === undefined ? false : props.archived;
	yield group.saveTx();
	return group;
});

var createFeed = Zotero.Promise.coroutine(function* (props = {}) {
	var feed = new Zotero.Feed;
	feed.name = props.name || "Test " + Zotero.Utilities.randomString();
	feed.description = props.description || "";
	feed.url = props.url || 'http://www.' + Zotero.Utilities.randomString() + '.com/feed.rss';
	feed.refreshInterval = props.refreshInterval || 12;
	feed.cleanupReadAfter = props.cleanupReadAfter || 2;
	feed.cleanupUnreadAfter = props.cleanupUnreadAfter || 30;
	yield feed.saveTx(props.saveOptions);
	return feed;
});

var clearFeeds = Zotero.Promise.coroutine(function* () {
	let feeds = Zotero.Feeds.getAll();
	for (let i=0; i<feeds.length; i++) {
		yield feeds[i].eraseTx();
	}
});

//
// Data objects
//
/**
 * @param {String} objectType - 'collection', 'item', 'search'
 * @param {Object} [params]
 * @param {Integer} [params.libraryID]
 * @param {String} [params.itemType] - Item type
 * @param {String} [params.title] - Item title
 * @param {Boolean} [params.setTitle] - Assign a random item title
 * @param {String} [params.name] - Collection/search name
 * @param {Integer} [params.parentID]
 * @param {String} [params.parentKey]
 * @param {Boolean} [params.synced]
 * @param {Integer} [params.version]
 * @param {Boolean} [params.deleted]
 * @param {Integer} [params.dateAdded] - Allowed for items
 * @param {Integer} [params.dateModified] - Allowed for items
 */
function createUnsavedDataObject(objectType, params = {}) {
	if (!objectType) {
		throw new Error("Object type not provided");
	}
	
	var allowedParams = ['libraryID', 'parentID', 'parentKey', 'synced', 'version', 'deleted'];
	
	var itemType;
	if (objectType == 'item' || objectType == 'feedItem') {
		itemType = params.itemType || 'book';
		allowedParams.push('dateAdded', 'dateModified');
	}
	if (objectType == 'item') {
		allowedParams.push('inPublications');
	}
	if (objectType == 'feedItem') {
		params.guid = params.guid || Zotero.randomString();
		allowedParams.push('guid');
	}
	
	var obj = new Zotero[Zotero.Utilities.capitalize(objectType)](itemType);
	if (params.libraryID) {
		obj.libraryID = params.libraryID;
	}
	
	switch (objectType) {
	case 'item':
	case 'feedItem':
		if (params.parentItemID) {
			params.parentID = params.parentItemID;
			delete params.parentItemID;
		}
		if (params.title !== undefined || params.setTitle) {
			obj.setField('title', params.title !== undefined ? params.title : Zotero.Utilities.randomString());
		}
		if (params.creators !== undefined) {
			obj.setCreators(params.creators);
		}
		if (params.collections !== undefined) {
			obj.setCollections(params.collections);
		}
		if (params.tags !== undefined) {
			obj.setTags(params.tags);
		}
		if (params.note !== undefined) {
			obj.setNote(params.note);
		}
		break;
	
	case 'collection':
	case 'search':
		obj.name = params.name !== undefined ? params.name : Zotero.Utilities.randomString();
		break;
	}
	
	if (objectType == 'search') {
		obj.addCondition('title', 'contains', Zotero.Utilities.randomString());
		obj.addCondition('title', 'isNot', Zotero.Utilities.randomString());
	}
	
	Zotero.Utilities.Internal.assignProps(obj, params, allowedParams);
	
	return obj;
}

async function createDataObject(objectType, params = {}, saveOptions) {
	var obj = createUnsavedDataObject(objectType, params);
	var options = {
		skipSelect: (objectType == 'item' || objectType == 'feedItem') ? false : true
	};
	await obj.saveTx(Object.assign(options, saveOptions));
	return obj;
}

function getNameProperty(objectType) {
	return objectType == 'item' ? 'title' : 'name';
}

var modifyDataObject = function (obj, params = {}, saveOptions) {
	switch (obj.objectType) {
	case 'item':
		obj.setField(
			'title',
			params.title !== undefined ? params.title : Zotero.Utilities.randomString()
		);
		break;
	
	default:
		obj.name = params.name !== undefined ? params.name : Zotero.Utilities.randomString();
	}
	return obj.saveTx(saveOptions);
};

/**
 * Return a promise for the error thrown by a promise, or false if none
 */
async function getPromiseError(promise) {
	try {
		await promise;
	}
	catch (e) {
		return e;
	}
	return false;
}

/**
 * Returns the nsIFile corresponding to the test data directory
 * (i.e., test/tests/data)
 */
function getTestDataDirectory() {
	var file = Zotero.File.pathToFile(Zotero.resourcesDir);
	file.append('tests');
	file.append('data');
	return file;
}

function getTestDataUrl(path) {
	path = path.split('/');
	if (path[0].length == 0) {
		path.splice(0, 1);
	}
	return "resource://zotero-unit-tests/data/" + path.join('/');
}

/**
 * Returns an absolute path to an empty temporary directory
 */
var getTempDirectory = Zotero.Promise.coroutine(function* getTempDirectory() {
	let path,
		attempts = 3,
		zoteroTmpDirPath = Zotero.getTempDirectory().path;
	while (attempts--) {
		path = PathUtils.join(zoteroTmpDirPath, Zotero.Utilities.randomString());
		try {
			yield IOUtils.makeDirectory(path, { ignoreExisting: false });
			break;
		} catch (e) {
			if (!attempts) throw e; // Throw on last attempt
		}
	}
	
	return path;
});

var removeDir = Zotero.Promise.coroutine(function* (dir) {
	// OS.File.DirectoryIterator, used by OS.File.removeDir(), isn't reliable on Travis,
	// returning entry.isDir == false for subdirectories, so use nsIFile instead
	//yield OS.File.removeDir(zipDir);
	dir = Zotero.File.pathToFile(dir);
	if (dir.exists()) {
		dir.remove(true);
	}
});

/**
 * Resets the Zotero DB and restarts Zotero. Returns a promise resolved
 * when this finishes.
 *
 * @param {Object} [options] - Initialization options, as passed to Zotero.init(), overriding
 *                             any that were set at startup
 */
async function resetDB(options = {}) {
	resetPrefs();
	
	if (options.thisArg) {
		options.thisArg.timeout(60000);
	}
	var db = Zotero.DataDirectory.getDatabase();
	await Zotero.reinit(
		async function () {
			// Extract a zipped DB file into place as the initial DB
			if (options.dbFile && options.dbFile.endsWith('.zip')) {
				let zipReader = Components.classes['@mozilla.org/libjar/zip-reader;1']
					.createInstance(Components.interfaces.nsIZipReader);
				zipReader.open(Zotero.File.pathToFile(options.dbFile));
				zipReader.extract('zotero.sqlite', Zotero.File.pathToFile(db));
				zipReader.close();
			}
			// Otherwise swap in the initial copy we made of the DB, or an alternative non-zip file
			// if given
			else {
				await IOUtils.copy(options.dbFile || db + '-test-template', db);
			}
			_defaultGroup = null;
		},
		options
	);
	await Zotero.Schema.schemaUpdatePromise;
}

/**
 * Equivalent to JSON.stringify, except that object properties are stringified
 * in a sorted order.
 */
function stableStringify(obj) {
	return JSON.stringify(obj, function(k, v) {
		if (v && typeof v == "object" && !Array.isArray(v)) {
			let o = {},
			    keys = Object.keys(v).sort();
			for (let i = 0; i < keys.length; i++) {
				o[keys[i]] = v[keys[i]];
			}
			return o;
		}
		return v;
	}, "\t");
}

/**
 * Loads specified sample data from file
 */
function loadSampleData(dataName) {
	let data = Zotero.File.getContentsFromURL('resource://zotero-unit-tests/data/' + dataName + '.js');
	return JSON.parse(data);
}

/**
 * Generates sample item data that is stored in data/sampleItemData.js
 */
function generateAllTypesAndFieldsData() {
	let data = {};
	let itemTypes = Zotero.ItemTypes.getTypes();
	// For most fields, use the field name as the value, but this doesn't
	// work well for some fields that expect values in certain formats
	let specialValues = {
		date: '1999-12-31',
		filingDate: '2000-01-02',
		accessDate: '1997-06-13T23:59:58Z',
		number: 3,
		numPages: 4,
		issue: 5,
		volume: 6,
		numberOfVolumes: 7,
		edition: 8,
		seriesNumber: 9,
		ISBN: '978-1-234-56789-7',
		ISSN: '1234-5679',
		url: 'http://www.example.com',
		pages: '1-10',
		DOI: '10.1234/example.doi',
		runningTime: '1:22:33',
		language: 'en-US'
	};
	
	// Item types that should not be included in sample data
	let excludeItemTypes = ['note', 'attachment', 'annotation'];
	
	for (let i = 0; i < itemTypes.length; i++) {
		if (excludeItemTypes.indexOf(itemTypes[i].name) != -1) continue;
		
		let itemFields = data[itemTypes[i].name] = {
			itemType: itemTypes[i].name
		};
		
		let fields = Zotero.ItemFields.getItemTypeFields(itemTypes[i].id);
		for (let j = 0; j < fields.length; j++) {
			let field = fields[j];
			field = Zotero.ItemFields.getBaseIDFromTypeAndField(itemTypes[i].id, field) || field;
			
			let name = Zotero.ItemFields.getName(field),
				value;
			
			// Use field name as field value
			if (specialValues[name]) {
				value = specialValues[name];
			} else {
				value = name.charAt(0).toUpperCase() + name.substr(1);
				// Make it look nice (sentence case)
				value = value.replace(/([a-z])([A-Z])/g, '$1 $2')
					.replace(/ [A-Z](?![A-Z])/g, m => m.toLowerCase()); // not all-caps words
			}
			
			itemFields[name] = value;
		}
		
		let creatorTypes = Zotero.CreatorTypes.getTypesForItemType(itemTypes[i].id),
			creators = itemFields.creators = [];
		for (let j = 0; j < creatorTypes.length; j++) {
			let typeName = creatorTypes[j].name;
			creators.push({
				creatorType: typeName,
				firstName: typeName + 'First',
				lastName: typeName + 'Last'
			});
		}
		
		// Also add a single-field mode author, which is valid for all types
		let primaryCreatorType = Zotero.CreatorTypes.getName(
			Zotero.CreatorTypes.getPrimaryIDForType(itemTypes[i].id)
		);
		creators.push({
			creatorType: primaryCreatorType,
			lastName: 'Institutional Author',
			fieldMode: 1
		});
	}
	
	return data;
}

/**
 * Populates the database with sample items
 * The field values should be in the form exactly as they would appear in Zotero
 */
function populateDBWithSampleData(data) {
	return Zotero.DB.executeTransaction(async function () {
		for (let itemName in data) {
			let item = data[itemName];
			let zItem = new Zotero.Item;
			zItem.fromJSON(item);
			item.id = await zItem.save();
		}

		return data;
	});
}

var generateItemJSONData = Zotero.Promise.coroutine(function* generateItemJSONData(options, currentData) {
	let items = yield populateDBWithSampleData(loadSampleData('allTypesAndFields')),
		jsonData = {};
	
	for (let itemName in items) {
		let zItem = yield Zotero.Items.getAsync(items[itemName].id);
		jsonData[itemName] = zItem.toJSON(options || {});

		// Don't replace some fields that _always_ change (e.g. item keys)
		// as long as it follows expected format
		// This makes it easier to generate more meaningful diffs
		if (!currentData || !currentData[itemName]) continue;
		
		for (let field in jsonData[itemName]) {
			let oldVal = currentData[itemName][field];
			if (!oldVal) continue;
			
			let val = jsonData[itemName][field];
			switch (field) {
				case 'dateAdded':
				case 'dateModified':
					if (!isoDateTimeRe.test(oldVal) || !isoDateTimeRe.test(val)) continue;
				break;
				case 'key':
					if (!zoteroObjectKeyRe.test(oldVal) || !zoteroObjectKeyRe.test(val)) continue;
				break;
				default:
					continue;
			}
			
			jsonData[itemName][field] = oldVal;
		}
	}
	
	return jsonData;
});

var generateCiteProcJSExportData = Zotero.Promise.coroutine(function* generateCiteProcJSExportData(currentData) {
	let items = yield populateDBWithSampleData(loadSampleData('allTypesAndFields')),
		cslExportData = {};
	
	for (let itemName in items) {
		let zItem = yield Zotero.Items.getAsync(items[itemName].id);
		cslExportData[itemName] = Zotero.Cite.System.prototype.retrieveItem(zItem);
		
		if (!currentData || !currentData[itemName]) continue;
		
		// Don't replace id as long as it follows expected format
		if (Number.isInteger(currentData[itemName].id)
			&& Number.isInteger(cslExportData[itemName].id)
		) {
			cslExportData[itemName].id = currentData[itemName].id;
		}
	}
	
	return cslExportData;
});

var generateTranslatorExportData = Zotero.Promise.coroutine(function* generateTranslatorExportData(legacy, currentData) {
	let items = yield populateDBWithSampleData(loadSampleData('allTypesAndFields')),
		translatorExportData = {};
	
	let itemGetter = new Zotero.Translate.ItemGetter();
	itemGetter.legacy = !!legacy;
	
	for (let itemName in items) {
		let zItem = yield Zotero.Items.getAsync(items[itemName].id);
		itemGetter._itemsLeft = [zItem];
		translatorExportData[itemName] = itemGetter.nextItem();
		
		// Don't replace some fields that _always_ change (e.g. item keys)
		if (!currentData || !currentData[itemName]) continue;
		
		// For simplicity, be more lenient than for item key
		let uriRe = /^http:\/\/zotero\.org\/users\/local\/\w{8}\/items\/\w{8}$/;
		let itemIDRe = /^\d+$/;
		for (let field in translatorExportData[itemName]) {
			let oldVal = currentData[itemName][field];
			if (!oldVal) continue;
			
			let val = translatorExportData[itemName][field];
			switch (field) {
				case 'uri':
					if (!uriRe.test(oldVal) || !uriRe.test(val)) continue;
				break;
				case 'itemID':
					if (!itemIDRe.test(oldVal) || !itemIDRe.test(val)) continue;
				break;
				case 'key':
					if (!zoteroObjectKeyRe.test(oldVal) || !zoteroObjectKeyRe.test(val)) continue;
				break;
				case 'dateAdded':
				case 'dateModified':
					if (legacy) {
						if (!sqlDateTimeRe.test(oldVal) || !sqlDateTimeRe.test(val)) continue;
					} else {
						if (!isoDateTimeRe.test(oldVal) || !isoDateTimeRe.test(val)) continue;
					}
				break;
				default:
					continue;
			}
			
			translatorExportData[itemName][field] = oldVal;
		}
	}
	
	return translatorExportData;
});


/**
 * Build a dummy translator that can be passed to Zotero.Translate
 */
function buildDummyTranslator(translatorType, code, info={}) {
	const TRANSLATOR_TYPES = {"import":1, "export":2, "web":4, "search":8};
	info = Object.assign({
		"translatorID":"dummy-translator",
		"translatorType": Number.isInteger(translatorType) ? translatorType : TRANSLATOR_TYPES[translatorType],
		"label":"Dummy Translator",
		"creator":"Simon Kornblith",
		"target":"",
		"priority":100,
		"browserSupport":"g",
		"inRepository":false,
		"lastUpdated":"0000-00-00 00:00:00",
	}, info);
	let translator = new Zotero.Translator(info);
	translator.code = JSON.stringify(info) + "\n" + code;
	return translator;
}


/**
 * Imports an attachment from a test file.
 * @param {string} filename - The filename to import (in data directory)
 * @return {Promise<Zotero.Item>}
 */
function importFileAttachment(filename, options = {}) {
	let file = getTestDataDirectory();
	filename.split('/').forEach((part) => file.append(part));
	let importOptions = {
		file,
		parentItemID: options.parentID,
	};
	Object.assign(importOptions, options);
	// Override default behavior - don't set title based on type,
	// just use extension-less leafName
	importOptions.title ??= file.leafName.replace(/\.[^.]+$/, '');
	return Zotero.Attachments.importFromFile(importOptions);
}


function importTextAttachment() {
	return importFileAttachment('test.txt', { contentType: 'text/plain', charset: 'utf-8' });
}


function importHTMLAttachment() {
	return importFileAttachment('test.html', { contentType: 'text/html', charset: 'utf-8' });
}


async function importPDFAttachment(parentItem, options = {}) {
	var attachment = await importFileAttachment(
		'test.pdf',
		{
			contentType: 'application/pdf',
			parentID: parentItem ? parentItem.id : null,
			title: options.title
		}
	);
	return attachment;
}


async function createAnnotation(type, parentItem, options = {}) {
	var annotation = new Zotero.Item('annotation');
	annotation.libraryID = parentItem.libraryID;
	if (options.version != undefined) {
		annotation.version = options.version;
	}
	annotation.parentID = parentItem.id;
	annotation.annotationType = type;
	if (type == 'highlight') {
		annotation.annotationText = Zotero.Utilities.randomString();
	}
	if (options.comment !== undefined) {
		annotation.annotationComment = options.comment;
	}
	else {
		annotation.annotationComment = Zotero.Utilities.randomString();
	}
	annotation.annotationColor = '#ffd400';
	var page = Zotero.Utilities.rand(1, 100);
	annotation.annotationPageLabel = `${page}`;
	page = page.toString().padStart(5, '0');
	var pos = Zotero.Utilities.rand(1, 10000).toString().padStart(6, '0');
	annotation.annotationSortIndex = `${page}|${pos}|00000`;
	annotation.annotationPosition = JSON.stringify({
		pageIndex: 123,
		rects: [
			[314.4, 412.8, 556.2, 609.6]
		]
	});
	if (options.createdByUserID) {
		annotation.createdByUserID = options.createdByUserID;
	}
	if (options.isExternal) {
		annotation.annotationIsExternal = options.isExternal;
	}
	if (options.tags) {
		annotation.setTags(options.tags);
	}
	if (options.synced !== undefined) {
		annotation.synced = options.synced;
	}
	await annotation.saveTx({
		skipEditCheck: true
	});
	return annotation;
}


async function createEmbeddedImage(parentItem, options = {}) {
	var attachment = await Zotero.Attachments.importEmbeddedImage({
		blob: await File.createFromFileName(
			PathUtils.join(getTestDataDirectory().path, 'test.png')
		),
		parentItemID: parentItem.id
	});
	if (options.tags) {
		attachment.setTags(options.tags);
		await attachment.saveTx();
	}
	return attachment;
}


async function getImageBlob() {
	var path = PathUtils.join(getTestDataDirectory().path, 'test.png');
	var imageData = await Zotero.File.getBinaryContentsAsync(path);
	var array = new Uint8Array(imageData.length);
	for (let i = 0; i < imageData.length; i++) {
		array[i] = imageData.charCodeAt(i);
	}
	return new Blob([array], { type: 'image/png' });
}


/**
 * Sets the fake XHR server to response to a given response
 *
 * @param {Object} server - Sinon FakeXMLHttpRequest server
 * @param {Object|String} response - Dot-separated path to predefined response in responses
 *                                   object (e.g., keyInfo.fullAccess) or a JSON object
 *                                   that defines the response
 * @param {Object} responses - Predefined responses
 */
function setHTTPResponse(server, baseURL, response, responses, username, password) {
	if (typeof response == 'string') {
		let [topic, key] = response.split('.');
		if (!responses[topic]) {
			throw new Error("Invalid topic");
		}
		if (!responses[topic][key]) {
			throw new Error("Invalid response key");
		}
		response = responses[topic][key];
	}
	
	var responseArray = [response.status !== undefined ? response.status : 200, {}, ""];
	if (response.json) {
		responseArray[1]["Content-Type"] = "application/json";
		responseArray[2] = JSON.stringify(response.json);
	}
	else {
		responseArray[1]["Content-Type"] = "text/plain";
		responseArray[2] = response.text || "";
	}
	
	if (!response.headers) {
		response.headers = {};
	}
	response.headers["Fake-Server-Match"] = 1;
	for (let i in response.headers) {
		responseArray[1][i] = response.headers[i];
	}
	
	if (username || password) {
		server.respondWith(function (req) {
			if (username && req.username != username) return;
			if (password && req.password != password) return;
			
			if (req.method == response.method && req.url == baseURL + response.url) {
				req.respond(...responseArray);
			}
		});
	}
	else {
		server.respondWith(response.method, baseURL + response.url, responseArray);
	}
}

let httpdServerPort = 16213;
/**
 * @param {Number} [port] - Port number to use. If not provided, one is picked automatically.
 * @return {Promise<{ httpd: Object, port: Number }>}
 */
async function startHTTPServer(port = null) {
	if (!port) {
		port = httpdServerPort;
	}
	Components.utils.import("resource://zotero-unit/httpd.js");
	var httpd = new HttpServer();
	while (true) {
		try {
			httpd.start(port);
			break;
		}
		catch (e) {
			await Zotero.Promise.delay(10);
		}
	}
	var baseURL = `http://localhost:${port}/`
	return { httpd, port, baseURL };
}

