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

	after(function () {
		win.close();
	});

	describe("Settings", function () {
		describe("Data Syncing", function () {
			var createLoginSessionStub, checkLoginSessionStub, deleteAPIKey, launchURLStub,
				streamerSubscribeStub, streamerUnsubscribeStub, indicatorElem, apiKey;

			var performLogin = async function (username) {
				apiKey = Zotero.Utilities.randomString(24);

				createLoginSessionStub.resolves({
					sessionToken: 'test-session-token',
					loginURL: 'https://www.zotero.org/authorize?token=test-session-token'
				});
				checkLoginSessionStub.resolves({
					status: 'completed',
					apiKey,
					userID: 1,
					username
				});

				await win.Zotero_Preferences.Sync.linkAccount();
			};

			before(function* () {
				createLoginSessionStub = sinon.stub(
					Zotero.Sync.APIClient.prototype, 'createLoginSession');
				checkLoginSessionStub = sinon.stub(
					Zotero.Sync.APIClient.prototype, 'checkLoginSession');
				deleteAPIKey = sinon.stub(Zotero.Sync.APIClient.prototype, 'deleteAPIKey').resolves();
				launchURLStub = sinon.stub(Zotero, 'launchURL');
				streamerSubscribeStub = sinon.stub(Zotero.Streamer, 'subscribe').returns(false);
				streamerUnsubscribeStub = sinon.stub(Zotero.Streamer, 'unsubscribe');
				indicatorElem = doc.getElementById('sync-status-indicator');
				sinon.stub(Zotero, 'alert');
				// Speed up polling for tests
				win.Zotero_Preferences.Sync._pollInterval = 10;
			});

			beforeEach(function* () {
				yield win.Zotero_Preferences.Sync.unlinkAccount(false);
				deleteAPIKey.resetHistory();
				createLoginSessionStub.resetHistory();
				checkLoginSessionStub.resetHistory();
				launchURLStub.resetHistory();
				streamerSubscribeStub.resetHistory();
				streamerUnsubscribeStub.resetHistory();
				Zotero.alert.reset();
			});

			after(function () {
				Zotero.HTTP.mock = null;
				Zotero.alert.restore();
				createLoginSessionStub.restore();
				checkLoginSessionStub.restore();
				deleteAPIKey.restore();
				launchURLStub.restore();
				streamerSubscribeStub.restore();
				streamerUnsubscribeStub.restore();
				win.Zotero_Preferences.Sync._pollInterval = 3000;
			});

			it("should set API key and display full controls after successful login", async function () {
				await performLogin("Username");

				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), apiKey);
				assert.equal(doc.getElementById('sync-unauthorized').getAttribute('hidden'), 'true');
				assert.isTrue(launchURLStub.calledOnce);
			});


			it("should show error when login session expires", async function () {
				createLoginSessionStub.resolves({
					sessionToken: 'test-session-token',
					loginURL: 'https://www.zotero.org/authorize?token=test-session-token'
				});
				let expiredError = new Error("Login session expired");
				expiredError.expired = true;
				checkLoginSessionStub.rejects(expiredError);

				await win.Zotero_Preferences.Sync.linkAccount();

				assert.isTrue(Zotero.alert.called);
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-authorized').getAttribute('hidden'), 'true');
			});


			it("should reset UI when login session is cancelled on server", async function () {
				createLoginSessionStub.resolves({
					sessionToken: 'test-session-token',
					loginURL: 'https://www.zotero.org/authorize?token=test-session-token'
				});
				checkLoginSessionStub.resolves({
					status: 'cancelled'
				});

				await win.Zotero_Preferences.Sync.linkAccount();

				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-login-default').hidden, false);
				assert.equal(doc.getElementById('sync-login-pending').hidden, true);
			});


			it("should delete API key and display auth form when 'Unlink Account' clicked", async function () {
				await performLogin("Username");
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), apiKey);

				await win.Zotero_Preferences.Sync.unlinkAccount(false);

				assert.isTrue(deleteAPIKey.called);
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-authorized').getAttribute('hidden'), 'true');
			});

			it("should reset the storage controller when unlinking", async function () {
				await performLogin("Username");
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), apiKey);

				let options = {
					apiClient: Zotero.Sync.Runner.getAPIClient({ apiKey })
				};
				let controller = Zotero.Sync.Runner.getStorageController('zfs', options);
				let apiKey1 = controller.apiClient.apiKey;

				await win.Zotero_Preferences.Sync.unlinkAccount(false);
				await performLogin("Username");

				options = {
					apiClient: Zotero.Sync.Runner.getAPIClient({ apiKey })
				};
				controller = Zotero.Sync.Runner.getStorageController('zfs', options);
				assert.notEqual(controller.apiClient.apiKey, apiKey1);
			});

			it("should not unlink on pressing cancel", async function () {
				await performLogin("Username");

				waitForDialog(null, 'cancel');

				await win.Zotero_Preferences.Sync.unlinkAccount();
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), apiKey);
				assert.equal(doc.getElementById('sync-unauthorized').getAttribute('hidden'), 'true');
			});

			it("should clear sync errors from the toolbar after logging in", async function () {
				let win = await loadZoteroPane();

				let syncError = win.document.getElementById('zotero-tb-sync-error');

				Zotero.Sync.Runner.updateIcons(new Error("a sync error"));
				assert.isFalse(syncError.hidden);

				await performLogin("Username");
				assert.isTrue(syncError.hidden);

				win.close();
			});

			it("should cancel login and reset UI when cancelLogin is called", async function () {
				let cancelLoginSessionStub = sinon.stub(
					Zotero.Sync.APIClient.prototype, 'cancelLoginSession').resolves();

				createLoginSessionStub.resolves({
					sessionToken: 'test-session-token',
					loginURL: 'https://www.zotero.org/authorize?token=test-session-token'
				});
				// Return "pending" so the poll loop keeps iterating
				checkLoginSessionStub.resolves({ status: 'pending' });

				// Start login but don't await -- it will keep polling
				let loginPromise = win.Zotero_Preferences.Sync.linkAccount();

				// Wait for the poll loop to start
				await Zotero.Promise.delay(50);

				win.Zotero_Preferences.Sync.cancelLogin();

				// Wait for the login promise to resolve after cancellation
				await loginPromise;

				assert.equal(doc.getElementById('sync-login-default').hidden, false);
				assert.equal(doc.getElementById('sync-login-pending').hidden, true);
				assert.isTrue(cancelLoginSessionStub.calledWith('test-session-token'));

				cancelLoginSessionStub.restore();
			});
		});
	});
});
