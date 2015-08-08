// Useful "constants"
var sqlDateTimeRe = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
var isoDateTimeRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
var zoteroObjectKeyRe = /^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/; // based on Zotero.Utilities::generateObjectKey()

/**
 * Waits for a DOM event on the specified node. Returns a promise
 * resolved with the event.
 */
function waitForDOMEvent(target, event, capture) {
	var deferred = Zotero.Promise.defer();
	var func = function(ev) {
		target.removeEventListener("event", func, capture);
		deferred.resolve(ev);
	}
	target.addEventListener(event, func, capture);
	return deferred.promise;
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
	var win = window.openDialog("chrome://browser/content/browser.xul", "", "all,height=400,width=1000");
	return waitForDOMEvent(win, "load").then(function() {
		return win;
	});
}

/**
 * Loads a Zotero pane in a new window and selects My Library. Returns the containing window.
 */
var loadZoteroPane = Zotero.Promise.coroutine(function* () {
	var win = yield loadBrowserWindow();
	Zotero.Prefs.clear('lastViewedFolder');
	win.ZoteroOverlay.toggleDisplay(true);
	
	// Hack to wait for pane load to finish. This is the same hack
	// we use in ZoteroPane.js, so either it's not good enough
	// there or it should be good enough here.
	yield Zotero.Promise.delay(52);
	
	yield waitForItemsLoad(win, 0);
	
	return win;
});

/**
 * Waits for a window with a specific URL to open. Returns a promise for the window, and
 * optionally passes the window to a callback immediately for use with modal dialogs,
 * which prevent async code from continuing
 */
function waitForWindow(uri, callback) {
	var deferred = Zotero.Promise.defer();
	Components.utils.import("resource://gre/modules/Services.jsm");
	var loadobserver = function(ev) {
		ev.originalTarget.removeEventListener("load", loadobserver, false);
		if(ev.target.location.href == uri) {
			Services.ww.unregisterNotification(winobserver);
			var win = ev.target.docShell
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindow);
			// Give window code time to run on load
			setTimeout(function () {
				if (callback) {
					try {
						// If callback is a promise, wait for it
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
		}
	};
	var winobserver = {"observe":function(subject, topic, data) {
		if(topic != "domwindowopened") return;
		var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
		win.addEventListener("load", loadobserver, false);
	}};
	Services.ww.registerNotification(winobserver);
	return deferred.promise;
}

/**
 * Wait for an alert or confirmation dialog to pop up and then close it
 *
 * @param {Function} [onOpen] - Function that is passed the dialog once it is opened.
 *                              Can be used to make assertions on the dialog contents
 *                              (e.g., with dialog.document.documentElement.textContent)
 * @param {String} [button='accept'] - Button in dialog to press (e.g., 'cancel', 'extra1')
 * @return {Promise}
 */
function waitForDialog(onOpen, button='accept', url) {
	return waitForWindow(url || "chrome://global/content/commonDialog.xul", Zotero.Promise.method(function (dialog) {
		var failure = false;
		if (onOpen) {
			try {
				onOpen(dialog);
			}
			catch (e) {
				failure = e;
			}
		}
		if (button != 'cancel') {
			let deferred = Zotero.Promise.defer();
			function acceptWhenEnabled() {
				// Handle delayed buttons
				if (dialog.document.documentElement.getButton(button).disabled) {
					setTimeout(function () {
						acceptWhenEnabled();
					}, 250);
				}
				else {
					dialog.document.documentElement.getButton(button).click();
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
			dialog.document.documentElement.getButton(button).click();
			if (failure) {
				throw failure;
			}
		}
	}))
}

var selectLibrary = Zotero.Promise.coroutine(function* (win, libraryID) {
	libraryID = libraryID || Zotero.Libraries.userLibraryID;
	yield win.ZoteroPane.collectionsView.selectLibrary(libraryID);
	yield waitForItemsLoad(win);
});

var waitForItemsLoad = Zotero.Promise.coroutine(function* (win, collectionRowToSelect) {
	var zp = win.ZoteroPane;
	var cv = zp.collectionsView;
	
	var deferred = Zotero.Promise.defer();
	cv.addEventListener('load', () => deferred.resolve());
	yield deferred.promise;
	if (collectionRowToSelect !== undefined) {
		yield cv.selectWait(collectionRowToSelect);
	}
	deferred = Zotero.Promise.defer();
	zp.itemsView.addEventListener('load', () => deferred.resolve());
	return deferred.promise;
});

/**
 * Waits for a single item event. Returns a promise for the item ID(s).
 */
function waitForItemEvent(event) {
	return waitForNotifierEvent(event, 'item').then(x => x.ids);
}

/**
 * Wait for a single notifier event and return a promise for the data
 */
function waitForNotifierEvent(event, type) {
	var deferred = Zotero.Promise.defer();
	var notifierID = Zotero.Notifier.registerObserver({notify:function(ev, type, ids, extraData) {
		if(ev == event) {
			Zotero.Notifier.unregisterObserver(notifierID);
			deferred.resolve({
				ids: ids,
				extraData: extraData
			});
		}
	}}, [type]);
	return deferred.promise;
}

/**
 * Looks for windows with a specific URL.
 */
function getWindows(uri) {
	Components.utils.import("resource://gre/modules/Services.jsm");
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


var createGroup = Zotero.Promise.coroutine(function* (props) {
	props = props || {};
	var group = new Zotero.Group;
	group.id = props.id || Zotero.Utilities.rand(10000, 1000000);
	group.name = props.name || "Test " + Zotero.Utilities.randomString();
	group.description = props.description || "";
	group.editable = props.editable || true;
	group.filesEditable = props.filesEditable || true;
	group.version = props.version || Zotero.Utilities.rand(1000, 10000);
	yield group.save();
	return group;
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
 * @param {Integer} [params.dateAdded] - Allowed for items
 * @param {Integer} [params.dateModified] - Allowed for items
 */
function createUnsavedDataObject(objectType, params = {}) {
	if (!objectType) {
		throw new Error("Object type not provided");
	}
	
	if (objectType == 'item') {
		var param = params.itemType || 'book';
	}
	var obj = new Zotero[Zotero.Utilities.capitalize(objectType)](param);
	if (params.libraryID) {
		obj.libraryID = params.libraryID;
	}
	switch (objectType) {
	case 'item':
		if (params.title !== undefined || params.setTitle) {
			obj.setField('title', params.title !== undefined ? params.title : Zotero.Utilities.randomString());
		}
		break;
	
	case 'collection':
	case 'search':
		obj.name = params.name !== undefined ? params.name : Zotero.Utilities.randomString();
		break;
	}
	var allowedParams = ['parentID', 'parentKey', 'synced', 'version'];
	if (objectType == 'item') {
		allowedParams.push('dateAdded', 'dateModified');
	}
	allowedParams.forEach(function (param) {
		if (params[param] !== undefined) {
			obj[param] = params[param];
		}
	})
	return obj;
}

var createDataObject = Zotero.Promise.coroutine(function* (objectType, params = {}, saveOptions) {
	var obj = createUnsavedDataObject(objectType, params);
	yield obj.saveTx(saveOptions);
	return obj;
});

function getNameProperty(objectType) {
	return objectType == 'item' ? 'title' : 'name';
}

var modifyDataObject = Zotero.Promise.coroutine(function* (obj, params = {}, saveOptions) {
	switch (obj.objectType) {
	case 'item':
		yield obj.loadItemData();
		obj.setField(
			'title',
			params.title !== undefined ? params.title : Zotero.Utilities.randomString()
		);
		break;
	
	default:
		obj.name = params.name !== undefined ? params.name : Zotero.Utilities.randomString();
	}
	return obj.saveTx(saveOptions);
});

/**
 * Return a promise for the error thrown by a promise, or false if none
 */
function getPromiseError(promise) {
	return promise.thenReturn(false).catch(e => e);
}

/**
 * Ensures that the PDF tools are installed, or installs them if not.
 *
 * @return {Promise}
 */
var installPDFTools = Zotero.Promise.coroutine(function* () {
	if(Zotero.Fulltext.pdfConverterIsRegistered() && Zotero.Fulltext.pdfInfoIsRegistered()) {
		return;
	}
	var version = yield Zotero.Fulltext.getLatestPDFToolsVersion();
	yield Zotero.Fulltext.downloadPDFTool('info', version);
	yield Zotero.Fulltext.downloadPDFTool('converter', version);
});

/**
 * @return {Promise}
 */
function uninstallPDFTools() {
	return Zotero.Fulltext.removePDFTools();
}

/**
 * Returns the nsIFile corresponding to the test data directory
 * (i.e., test/tests/data)
 */
function getTestDataDirectory() {
	Components.utils.import("resource://gre/modules/Services.jsm");
	var resource = Services.io.getProtocolHandler("resource").
	               QueryInterface(Components.interfaces.nsIResProtocolHandler),
	    resURI = Services.io.newURI("resource://zotero-unit-tests/data", null, null);
	return Services.io.newURI(resource.resolveURI(resURI), null, null).
	       QueryInterface(Components.interfaces.nsIFileURL).file;
}

/**
 * Returns an absolute path to an empty temporary directory
 * (i.e., test/tests/data)
 */
var getTempDirectory = Zotero.Promise.coroutine(function* getTempDirectory() {
	Components.utils.import("resource://gre/modules/osfile.jsm");
	let path,
		attempts = 3,
		zoteroTmpDirPath = Zotero.getTempDirectory().path;
	while (attempts--) {
		path = OS.Path.join(zoteroTmpDirPath, Zotero.Utilities.randomString());
		try {
			yield OS.File.makeDir(path, { ignoreExisting: false });
			break;
		} catch (e) {
			if (!attempts) throw e; // Throw on last attempt
		}
	}
	
	return path;
});

/**
 * Resets the Zotero DB and restarts Zotero. Returns a promise resolved
 * when this finishes.
 *
 * @param {Object} [options] - Initialization options, as passed to Zotero.init(), overriding
 *                             any that were set at startup
 */
function resetDB(options = {}) {
	var db = Zotero.getZoteroDatabase();
	return Zotero.reinit(function() {
		db.remove(false);
		_defaultGroup = null;
	}, false, options).then(function() {
		return Zotero.Schema.schemaUpdatePromise;
	});
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
	let excludeItemTypes = ['note', 'attachment'];
	
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
	return Zotero.DB.executeTransaction(function* () {
		for (let itemName in data) {
			let item = data[itemName];
			let zItem = new Zotero.Item;
			zItem.fromJSON(item);
			item.id = yield zItem.save();
		}

		return data;
	});
}

var generateItemJSONData = Zotero.Promise.coroutine(function* generateItemJSONData(options, currentData) {
	let items = yield populateDBWithSampleData(loadSampleData('allTypesAndFields')),
		jsonData = {};
	
	for (let itemName in items) {
		let zItem = yield Zotero.Items.getAsync(items[itemName].id);
		jsonData[itemName] = yield zItem.toJSON(options);

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
		translatorExportData[itemName] = yield itemGetter.nextItem();
		
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
 * Imports an attachment from a test file.
 * @param {string} filename - The filename to import (in data directory)
 * @return {Promise<Zotero.Item>}
 */
function importFileAttachment(filename) {
	let testfile = getTestDataDirectory();
	filename.split('/').forEach((part) => testfile.append(part));
	return Zotero.Attachments.importFromFile({file: testfile});
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
function setHTTPResponse(server, baseURL, response, responses) {
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
	
	var responseArray = [response.status || 200, {}, ""];
	if (response.json) {
		responseArray[1]["Content-Type"] = "application/json";
		responseArray[2] = JSON.stringify(response.json);
	}
	else {
		responseArray[1]["Content-Type"] = "text/plain";
		responseArray[2] = response.text || "";
	}
	for (let i in response.headers) {
		responseArray[1][i] = response.headers[i];
	}
	server.respondWith(response.method, baseURL + response.url, responseArray);
}
