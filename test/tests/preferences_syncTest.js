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
})

