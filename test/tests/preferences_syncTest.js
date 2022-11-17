describe("Sync Preferences", function () {
	var win, doc;
	before(function* () {
		// Load prefs with sync pane
		win = yield loadWindow("chrome://zotero/content/preferences/preferences.xhtml", {
			pane: 'zotero-prefpane-sync'
		});
		doc = win.document;
		yield win.Zotero_Preferences.waitForFirstPaneLoad();
	});

	after(function() {
		win.close();
	});

	describe("Settings", function () {
		describe("Data Syncing", function () {
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
				deleteAPIKey.resetHistory();
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
				
				yield assert.eventually.equal(Zotero.Sync.Data.Local.getAPIKey(), apiKey);
				assert.equal(doc.getElementById('sync-unauthorized').getAttribute('hidden'), 'true');
			});


			it("should display dialog when credentials incorrect", function* () {
				getAPIKeyFromCredentialsStub.resolves(false);
				yield setCredentials("Username", "incorrectPassword");

				assert.isTrue(Zotero.alert.called);
				yield assert.eventually.equal(Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-authorized').getAttribute('hidden'), 'true');
			});


			it("should delete API key and display auth form when 'Unlink Account' clicked", function* () {
				getAPIKeyFromCredentialsStub.resolves(apiResponse);
				yield setCredentials("Username", "correctPassword");
				yield assert.eventually.equal(Zotero.Sync.Data.Local.getAPIKey(), apiKey);

				yield win.Zotero_Preferences.Sync.unlinkAccount(false);

				assert.isTrue(deleteAPIKey.called);
				yield assert.eventually.equal(Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-authorized').getAttribute('hidden'), 'true');
			});
			
			it("should not unlink on pressing cancel", function* () {
				getAPIKeyFromCredentialsStub.resolves(apiResponse);
				yield setCredentials("Username", "correctPassword");
				
				waitForDialog(null, 'cancel');
				
				yield win.Zotero_Preferences.Sync.unlinkAccount();
				yield assert.eventually.equal(Zotero.Sync.Data.Local.getAPIKey(), apiKey);
				assert.equal(doc.getElementById('sync-unauthorized').getAttribute('hidden'), 'true');
			});
			
			it("should clear sync errors from the toolbar after logging in", async function () {
				let win = await loadZoteroPane();
				after(function () {
					win.close();
				});
				
				let syncError = win.document.getElementById('zotero-tb-sync-error');
				
				Zotero.Sync.Runner.updateIcons(new Error("a sync error"));
				assert.isFalse(syncError.hidden);

				getAPIKeyFromCredentialsStub.resolves(apiResponse);
				await setCredentials("Username", "correctPassword");
				assert.isTrue(syncError.hidden);
			});
		})
	})
})

