describe("Citation Dialog", function () {
	let io = {
		accept() {},
		cancel() {},
		sort() {},
		sortable: false,
		citation: {
			properties: {
				unsorted: false,
			}
		},
		getItems() {
			return [];
		}
	};
	let dialog, win;

	before(async function () {
		// one of helper functions of searchHandler uses zotero pane
		win = await loadZoteroPane();
		let dialogPromise = waitForWindow("chrome://zotero/content/integration/citationDialog.xhtml");
		Services.ww.openWindow(null, "chrome://zotero/content/integration/citationDialog.xhtml", "", "", io);
		dialog = await dialogPromise;
		// wait for everything (e.g. itemTree/collectionTree) inside of the dialog to be loaded.
		// it is not used currently but may be required when more complex tests are added
		// while (!dialog.loaded) {
		// 	await Zotero.Promise.delay(10);
		// }
	});

	after(function () {
		dialog.close();
		win.close();
	});

	describe("Helpers.extractLocator", function () {
		let locator;
		describe("Invalid locators", function () {
			it("has no locator label with numeric locator value", function() {
				locator = dialog.Helpers.extractLocator('history of the US 10-15');
				assert.isNull(locator);
				locator = dialog.Helpers.extractLocator('10-15');
				assert.isNull(locator);
			});

			it("has no locator label with textual locator value", function() {
				locator = dialog.Helpers.extractLocator('history of the US "test"');
				assert.isNull(locator);
				locator = dialog.Helpers.extractLocator('"test"');
				assert.isNull(locator);
			});
			
			it("has no quotes around textual locator value", function() {
				locator = dialog.Helpers.extractLocator('history of the US chapter something');
				assert.isNull(locator);
				locator = dialog.Helpers.extractLocator('chapter search query');
				assert.isNull(locator);
			});
			
			it("has no locator value", function() {
				locator = dialog.Helpers.extractLocator('history of the US p');
				assert.isNull(locator);
				locator = dialog.Helpers.extractLocator('page');
				assert.isNull(locator);
			});
			
			it("has textual locator value that does not follow locator label", function() {
				locator = dialog.Helpers.extractLocator('history of the US note blank "testing"');
				assert.isNull(locator);
			});
			
			it("has numeric locator value that does not follow locator label", function() {
				locator = dialog.Helpers.extractLocator('history of the US p blank 11-12');
				assert.isNull(locator);
			});
			
			it("has textual locator value not in the end of the string", function() {
				locator = dialog.Helpers.extractLocator('history of the US chapter "some quotations" some more text');
				assert.isNull(locator);
			});
			
			it("has numeric locator value not in the end of the string", function() {
				locator = dialog.Helpers.extractLocator('history of the US page 10-15 some more text');
				assert.isNull(locator);
			});
		});

		describe("Valid locator labels", function () {
			it("is a valid numeric locator by itself", function () {
				let locators = [
					'line 10-15',
					'line10-15',
					'l. 10-15',
					'l.10-15',
					'l    10-15',
					' l10-15'
				];
				for (let locatorString of locators) {
					let locator = dialog.Helpers.extractLocator(locatorString);
					assert.isOk(locator);
					assert.equal(locator.label, 'line');
					assert.equal(locator.locator, '10-15');
					assert.equal(locator.onlyLocator, true);
					assert.equal(locator.fullLocatorString, locatorString.trim());
				}
			});

			it("is a valid textual locator by itself", function () {
				let locators = [
					'note "this is a note"',
					'note"this is a note"',
					'n. "this is a note"',
					'n."this is a note"',
					'n    "this is a note"',
					' n"this is a note"'
				];
				
				for (let locatorString of locators) {
					let locator = dialog.Helpers.extractLocator(locatorString);
					assert.isOk(locator);
					assert.equal(locator.label, 'note');
					assert.equal(locator.locator, 'this is a note');
					assert.equal(locator.onlyLocator, true);
					assert.equal(locator.fullLocatorString, locatorString.trim());
				}
			});

			it("is a valid numeric locator with other text", function () {
				let locators = [
					{ str: 'history of the US page 10-15', locatorStr: 'page 10-15' },
					{ str: 'history of the US page10-15', locatorStr: 'page10-15' },
					{ str: 'history of the US p. 10-15', locatorStr: 'p. 10-15' },
					{ str: 'history of the US p.10-15', locatorStr: 'p.10-15' },
					{ str: 'history of the US p    10-15', locatorStr: 'p    10-15' },
					{ str: 'history of the US  p10-15', locatorStr: 'p10-15' }
				];
				
				for (let locatorObj of locators) {
					let locator = dialog.Helpers.extractLocator(locatorObj.str);
					assert.isOk(locator);
					assert.equal(locator.label, 'page');
					assert.equal(locator.locator, '10-15');
					assert.equal(locator.onlyLocator, false);
					assert.equal(locator.fullLocatorString, locatorObj.locatorStr);
				}
			});

			it("is a valid textual locator with other text", function () {
				let locators = [
					{ str: 'history of the US chapter  "one and two"', locatorStr: 'chapter  "one and two"' },
					{ str: 'history of the US chapter"one and two"', locatorStr: 'chapter"one and two"' },
					{ str: 'history of the US chap. "one and two"', locatorStr: 'chap. "one and two"' },
					{ str: 'history of the US chap."one and two"', locatorStr: 'chap."one and two"' },
					{ str: 'history of the US chap    "one and two"', locatorStr: 'chap    "one and two"' },
					{ str: 'history of the US chap"one and two"', locatorStr: 'chap"one and two"' }
				];
				
				for (let locatorObj of locators) {
					let locator = dialog.Helpers.extractLocator(locatorObj.str);
					assert.isOk(locator);
					assert.equal(locator.label, 'chapter');
					assert.equal(locator.locator, 'one and two');
					assert.equal(locator.onlyLocator, false);
					assert.equal(locator.fullLocatorString, locatorObj.locatorStr);
				}
			});
		});
	});
});
