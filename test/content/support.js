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
 * Returns a promise for the nsIFile corresponding to the test data
 * directory (i.e., test/tests/data)
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
 * Generates sample item data that is stored in data/sampleItemData.js
 */
function generateAllTypesAndFieldsData() {
	let data = {},
		itemTypes = Zotero.ItemTypes.getTypes(),
		// For most fields, use the field name as the value, but this doesn't
		// work well for some fields that expect values in certain formats
		specialValues = {
			date: '1999-12-31',
			accessDate: '1999-12-31 23:59:59',
			number: '3',
			ISBN: '978-1-234-56789-7',
			ISSN: '1234-5679',
			url: 'http://www.example.com',
			pages: '1-10',
			DOI: '10.1234/example.doi',
			runningTime: '1:22:33',
			language: 'en-US'
		},
		// Additional fields that should use values from above
		specialValueMap = {
			date: ['filingDate'],
			number: ['numPages', 'issue', 'volume', 'numberOfVolumes', 'edition',
				'seriesNumber']
		},
		// Item types and fields that should not be included in sample data
		excludeItemTypes = ['note', 'attachment'],
		excludeItemFields = [];
	
	// Convenince object for quick special value lookups
	let coercedValues = {}
	for (let field in specialValues) {
		coercedValues[field] = specialValues[field];
	}
	for (let field in specialValueMap) {
		for (let i = 0; i < specialValueMap[field].length; i++) {
			coercedValues[specialValueMap[field][i]] = specialValues[field];
		}
	}
	
	for (let i = 0; i < itemTypes.length; i++) {
		if (excludeItemTypes.indexOf(itemTypes[i].name) != -1) continue;
		
		let itemFields = data[itemTypes[i].name] = {
			itemType: itemTypes[i].name
		};
		
		let fields = Zotero.ItemFields.getItemTypeFields(itemTypes[i].id).sort();
		for (let j = 0; j < fields.length; j++) {
			let field = fields[j];
			field = Zotero.ItemFields.getBaseIDFromTypeAndField(itemTypes[i].id, field) || field;
			
			if (excludeItemFields.indexOf(field) != -1) continue;
			
			let name = Zotero.ItemFields.getName(field);
			
			// Use field name as field value
			let value = coercedValues[name] || name.charAt(0).toUpperCase() + name.substr(1);
			
			value = value.replace(/([a-z])([A-Z])/g, '$1 $2')
				.replace(/ [A-Z](?=[a-z])/g, m => m.toLowerCase());
			itemFields[name] = value;
		}
		
		let creatorTypes = Zotero.CreatorTypes.getTypesForItemType(itemTypes[i].id),
			creators = itemFields.creators = [];
		for (let j = 0; j < creatorTypes.length; j++) {
			creators.push({
				creatorType: creatorTypes[j].name,
				firstName: 'First',
				lastName: 'Last'
			});
		}
	}
	
	return data;
}

/**
 * Loads specified sample data from file
 */
function loadSampleData(dataName = 'allTypesAndFields') {
	Components.utils.import("resource://gre/modules/Services.jsm");
	let data = {};
	Services.scriptloader.loadSubScript('resource://zotero-unit-tests/data/' + dataName + '.js', data, 'UTF-8');
	return data.data;
}

/**
 * Populates the database with sample items that have all fields filled in
 * The field values should be in the form exactly as they would appear in Zotero
 */
function populateDBWithSampleData(data) {
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
			
			zItem.setField(itemField, item[itemField]);
		}
		item.id = zItem.save();
	}
	
	return data;
}