describe("Sync Preferences", function () {
	var win, doc;
	before(function* () {
		// Load prefs with sync pane
		win = yield loadWindow("chrome://zotero/content/preferences/preferences.xul", {
			pane: 'zotero-prefpane-sync',
			tabIndex: 0
		});
		doc = win.document;
		let defer = Zotero.Promise.defer();
		let pane = doc.getElementById('zotero-prefpane-sync');
		if (!pane.loaded) {
			pane.addEventListener('paneload', function () {
				defer.resolve();
			});
			yield defer.promise;
		}
	});

	after(function() {
		win.close();
	});

	describe("Settings", function () {
		describe("Zotero Data Sync", function () {
			var getAPIKeyFromCredentialsStub, deleteAPIKey, indicatorElem;

			var setCredentials = Zotero.Promise.coroutine(function* (username, password) {
				let usernameElem = doc.getElementById('sync-username-textbox');
				let passwordElem = doc.getElementById('sync-password');
				usernameElem.value = username;
				passwordElem.value = password;
				
				// Triggered by `change` event for usernameElem and passwordElem;
				yield win.Zotero_Preferences.Sync.linkAccount();
			});

			var apiKey = Zotero.Utilities.randomString(24);

			var apiResponse = {
				key: apiKey,
				username: "Username",
				userID: 1,
				access: {}
			};

			before(function* () {
				getAPIKeyFromCredentialsStub = sinon.stub(
						Zotero.Sync.APIClient.prototype, 'createAPIKeyFromCredentials');
				deleteAPIKey = sinon.stub(Zotero.Sync.APIClient.prototype, 'deleteAPIKey').resolves();
				indicatorElem = doc.getElementById('sync-status-indicator')
				sinon.stub(Zotero, 'alert');
			});

			beforeEach(function* (){
				yield win.Zotero_Preferences.Sync.unlinkAccount(false);
				deleteAPIKey.reset();
				Zotero.alert.reset();
			});
			
			after(function() {
				Zotero.HTTP.mock = null;
				Zotero.alert.restore();
				getAPIKeyFromCredentialsStub.restore();
				deleteAPIKey.restore();
			});

			it("should set API key and display full controls with correct credentials", function* () {
				getAPIKeyFromCredentialsStub.resolves(apiResponse);
				yield setCredentials("Username", "correctPassword");
				
				assert.equal(Zotero.Sync.Data.Local.getAPIKey(), apiKey);
				assert.equal(doc.getElementById('sync-unauthorized').getAttribute('hidden'), 'true');
			});


			it("should display dialog when credentials incorrect", function* () {
				getAPIKeyFromCredentialsStub.resolves(false);
				yield setCredentials("Username", "incorrectPassword");

				assert.isTrue(Zotero.alert.called);
				assert.equal(Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-authorized').getAttribute('hidden'), 'true');
			});


			it("should delete API key and display auth form when 'Unlink Account' clicked", function* () {
				getAPIKeyFromCredentialsStub.resolves(apiResponse);
				yield setCredentials("Username", "correctPassword");
				assert.equal(Zotero.Sync.Data.Local.getAPIKey(), apiKey);

				yield win.Zotero_Preferences.Sync.unlinkAccount(false);

				assert.isTrue(deleteAPIKey.called);
				assert.equal(Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-authorized').getAttribute('hidden'), 'true');
			});

		})
	})

	describe("#checkUser()", function () {
		it("should prompt for user update and perform on accept", function* () {
			yield Zotero.Users.setCurrentUserID(1);
			yield Zotero.Users.setCurrentUsername("A");

			waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				var matches = text.match(/'[^']*'/g);
				assert.equal(matches.length, 4);
				assert.equal(matches[0], "'A'");
				assert.equal(matches[1], "'B'");
				assert.equal(matches[2], "'B'");
				assert.equal(matches[3], "'A'");
			});
			var cont = yield win.Zotero_Preferences.Sync.checkUser(2, "B");
			assert.isTrue(cont);

			assert.equal(Zotero.Users.getCurrentUserID(), 2);
			assert.equal(Zotero.Users.getCurrentUsername(), "B");
		})

		it("should prompt for user update and cancel", function* () {
			yield Zotero.Users.setCurrentUserID(1);
			yield Zotero.Users.setCurrentUsername("A");

			waitForDialog(false, 'cancel');
			var cont = yield win.Zotero_Preferences.Sync.checkUser(2, "B");
			assert.isFalse(cont);

			assert.equal(Zotero.Users.getCurrentUserID(), 1);
			assert.equal(Zotero.Users.getCurrentUsername(), "A");
		})

		it("should update local relations when syncing for the first time", function* () {
			yield resetDB({
				thisArg: this,
				skipBundledFiles: true
			});

			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject(
				'item', { libraryID: Zotero.Libraries.publicationsLibraryID }
			);

			yield item1.addLinkedItem(item2);

			var cont = yield win.Zotero_Preferences.Sync.checkUser(1, "A");
			assert.isTrue(cont);

			var json = yield item1.toJSON();
			var uri = json.relations[Zotero.Relations.linkedObjectPredicate][0];
			assert.notInclude(uri, 'users/local');
			assert.include(uri, 'users/1/publications');
		})
	})

})

