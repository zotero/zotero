Components.utils.import("resource://zotero/q.js");

// Useful "constants"
var sqlDateTimeRe = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
var isoDateTimeRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
var zoteroObjectKeyRe = /^[23456789ABCDEFGHIJKMNPQRSTUVWXZ]{8}$/; // based on Zotero.Utilities::generateObjectKey()

/**
 * Waits for a DOM event on the specified node. Returns a promise
 * resolved with the event.
 */
function waitForDOMEvent(target, event, capture) {
	var deferred = Q.defer();
	var func = function(ev) {
		target.removeEventListener("event", func, capture);
		deferred.resolve(ev);
	}
	target.addEventListener(event, func, capture);
	return deferred.promise;
}

/**
 * Open a window. Returns a promise for the window.
 */
function loadWindow(winurl, argument) {
	var win = window.openDialog(winurl, "_blank", "chrome", argument);
	return waitForDOMEvent(win, "load").then(function() {
		return win;
	});
}

/**
 * Loads a Zotero pane in a new window. Returns the containing window.
 */
function loadZoteroPane() {
	return loadWindow("chrome://browser/content/browser.xul").then(function(win) {
		win.ZoteroOverlay.toggleDisplay(true);

		// Hack to wait for pane load to finish. This is the same hack
		// we use in ZoteroPane.js, so either it's not good enough
		// there or it should be good enough here.
		return Q.delay(52).then(function() {
			return win;
		});
	});
}

/**
 * Waits for a window with a specific URL to open. Returns a promise for the window.
 */
function waitForWindow(uri) {
	var deferred = Q.defer();
	Components.utils.import("resource://gre/modules/Services.jsm");
	var loadobserver = function(ev) {
		ev.originalTarget.removeEventListener("load", loadobserver, false);
		if(ev.target.location == uri) {
			Services.ww.unregisterNotification(winobserver);
			deferred.resolve(ev.target.docShell.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
				             getInterface(Components.interfaces.nsIDOMWindow));
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
 * Waits for a single item event. Returns a promise for the item ID(s).
 */
function waitForItemEvent(event) {
	var deferred = Q.defer();
	var notifierID = Zotero.Notifier.registerObserver({notify:function(ev, type, ids, extraData) {
		if(ev == event) {
			Zotero.Notifier.unregisterObserver(notifierID);
			deferred.resolve(ids);
		}
	}}, ["item"]);
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
	var deferred = Q.defer();
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
 * Ensures that the PDF tools are installed, or installs them if not.
 * Returns a promise.
 */
function installPDFTools() {
	if(Zotero.Fulltext.pdfConverterIsRegistered() && Zotero.Fulltext.pdfInfoIsRegistered()) {
		return Q(true);
	}

	// Begin install procedure
	return loadWindow("chrome://zotero/content/preferences/preferences.xul", {
		pane: 'zotero-prefpane-search',
		action: 'pdftools-install'
	}).then(function(win) {
		// Wait for confirmation dialog
		return waitForWindow("chrome://global/content/commonDialog.xul").then(function(dlg) {
			// Accept confirmation dialog
			dlg.document.documentElement.acceptDialog();

			// Wait for install to finish
			return waitForCallback(function() {
				return Zotero.Fulltext.pdfConverterIsRegistered() && Zotero.Fulltext.pdfInfoIsRegistered();
			}, 500, 30000).finally(function() {
				win.close();
			});
		});
	});
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
var getTempDirectory = Q.async(function getTempDirectory() {
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
	
	Q.return(path);
});

/**
 * Resets the Zotero DB and restarts Zotero. Returns a promise resolved
 * when this finishes.
 */
function resetDB() {
	var db = Zotero.getZoteroDatabase();
	return Zotero.reinit(function() {
		db.remove(false);
	}).then(function() {
		return Zotero.Schema.schemaUpdatePromise;
	});
}

/**
 * Equivalent to JSON.stringify, except that object properties are stringified
 * in a sorted order.
 */
function stableStringify(obj, level, label) {
	if (!level) level = 0;
	let indent = '\t'.repeat(level);
	
	if (label) label = JSON.stringify('' + label) + ': ';
	else label = '';
	
	if (typeof obj == 'function' || obj === undefined) return null;
	
	if (typeof obj != 'object' || obj === null) return indent + label + JSON.stringify(obj);
	
	if (Array.isArray(obj)) {
		let str = indent + label + '[';
		for (let i=0; i<obj.length; i++) {
			let json = stableStringify(obj[i], level + 1);
			if (json === null) json = indent + '\tnull'; // function
			str += '\n' + json + (i < obj.length-1 ? ',' : '');
		}
		return str + (obj.length ? '\n' + indent : '') + ']';
	}
	
	let keys = Object.keys(obj).sort(),
		empty = true,
		str = indent + label + '{';
	for (let i=0; i<keys.length; i++) {
		let json = stableStringify(obj[keys[i]], level + 1, keys[i]);
		if (json === null) continue; // function
		
		empty = false;
		str += '\n' + json + (i < keys.length-1 ? ',' : '');
	}
	
	return str + (!empty ? '\n' + indent : '') + '}';
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
		accessDate: '1997-06-13 23:59:58',
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
	}
	
	return data;
}

/**
 * Populates the database with sample items
 * The field values should be in the form exactly as they would appear in Zotero
 */
function populateDBWithSampleData(data) {
	Zotero.DB.beginTransaction();
	
	for (let itemName in data) {
		let item = data[itemName];
		let zItem = new Zotero.Item(item.itemType);
		for (let itemField in item) {
			if (itemField == 'itemType') continue;
			
			if (itemField == 'creators') {
				let creators = item[itemField];
				for (let i=0; i<creators.length; i++) {
					let creator = new Zotero.Creator();
					creator.firstName = creators[i].firstName;
					creator.lastName = creators[i].lastName;
					creator = Zotero.Creators.get(creator.save());
					
					zItem.setCreator(i, creator, creators[i].creatorType);
				}
				continue;
			}
			
			if (itemField == 'tags') {
				// Must save item first
				continue;
			}
			
			zItem.setField(itemField, item[itemField]);
		}
		item.id = zItem.save();
		
		if (item.tags && item.tags.length) {
			zItem = Zotero.Items.get(item.id);
			for (let i=0; i<item.tags.length; i++) {
				zItem.addTag(item.tags[i].tag, item.tags[i].type);
			}
		}
	}
	
	Zotero.DB.commitTransaction();
	return data;
}

function generateItemJSONData(options, currentData) {
	let items = populateDBWithSampleData(loadSampleData('allTypesAndFields')),
		jsonData = {};
	
	for (let itemName in items) {
		let zItem = Zotero.Items.get(items[itemName].id);
		jsonData[itemName] = zItem.toJSON(options);
		
		// Adjut accessDate so that it doesn't depend on computer time zone
		// Effectively, assume that current time zone is UTC
		if (jsonData[itemName].accessDate) {
			let date = Zotero.Date.isoToDate(jsonData[itemName].accessDate);
			date.setUTCMinutes(date.getUTCMinutes() - date.getTimezoneOffset());
			jsonData[itemName].accessDate = Zotero.Date.dateToISO(date);
		}
		
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
}

function generateCiteProcJSExportData(currentData) {
	let items = populateDBWithSampleData(loadSampleData('allTypesAndFields')),
		cslExportData = {};
	
	for (let itemName in items) {
		let zItem = Zotero.Items.get(items[itemName].id);
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
}

function generateTranslatorExportData(legacy, currentData) {
	let items = populateDBWithSampleData(loadSampleData('allTypesAndFields')),
		translatorExportData = {};
	
	let itemGetter = new Zotero.Translate.ItemGetter();
	itemGetter.legacy = !!legacy;
	
	for (let itemName in items) {
		let zItem = Zotero.Items.get(items[itemName].id);
		itemGetter._itemsLeft = [zItem];
		translatorExportData[itemName] = itemGetter.nextItem();
		
		// Adjut ISO accessDate so that it doesn't depend on computer time zone
		// Effectively, assume that current time zone is UTC
		if (!legacy && translatorExportData[itemName].accessDate) {
			let date = Zotero.Date.isoToDate(translatorExportData[itemName].accessDate);
			date.setUTCMinutes(date.getUTCMinutes() - date.getTimezoneOffset());
			translatorExportData[itemName].accessDate = Zotero.Date.dateToISO(date);
		}
		
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
}