"use strict";

describe("Zotero.Sync.Runner", function () {
	Components.utils.import("resource://zotero/config.js");
	
	var apiKey = Zotero.Utilities.randomString(24);
	var baseURL = "http://local.zotero/";
	var userLibraryID, publicationsLibraryID, runner, caller, server, stub, spy;
	
	var responses = {
		keyInfo: {
			fullAccess: {
				method: "GET",
				url: "keys/current",
				status: 200,
				json: {
					key: apiKey,
					userID: 1,
					username: "Username",
					access: {
						user: {
							library: true,
							files: true,
							notes: true,
							write: true
						},
						groups: {
							all: {
								library: true,
								write: true
							}
						}
					}
				}
			}
		},
		userGroups: {
			groupVersions: {
				method: "GET",
				url: "users/1/groups?format=versions",
				json: {
					"1623562": 10,
					"2694172": 11
				}
			},
			groupVersionsEmpty: {
				method: "GET",
				url: "users/1/groups?format=versions",
				json: {}
			},
			groupVersionsOnlyMemberGroup: {
				method: "GET",
				url: "users/1/groups?format=versions",
				json: {
					"2694172": 11
				}
			}
		},
		groups: {
			ownerGroup: {
				method: "GET",
				url: "groups/1623562",
				json: {
					id: 1623562,
					version: 10,
					data: {
						id: 1623562,
						version: 10,
						name: "Group Name",
						description: "<p>Test group</p>",
						owner: 1,
						type: "Private",
						libraryEditing: "members",
						libraryReading: "all",
						fileEditing: "members",
						admins: [],
						members: []
					}
				}
			},
			memberGroup: {
				method: "GET",
				url: "groups/2694172",
				json: {
					id: 2694172,
					version: 11,
					data: {
						id: 2694172,
						version: 11,
						name: "Group Name 2",
						description: "<p>Test group</p>",
						owner: 123456,
						type: "Private",
						libraryEditing: "admins",
						libraryReading: "all",
						fileEditing: "admins",
						admins: [],
						members: [1]
					}
				}
			}
		}
	};
	
	//
	// Helper functions
	//
	function setResponse(response) {
		setHTTPResponse(server, baseURL, response, responses);
	}
	
	
	//
	// Tests
	//
	beforeEach(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		userLibraryID = Zotero.Libraries.userLibraryID;
		publicationsLibraryID = Zotero.Libraries.publicationsLibraryID;
		
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		
		runner = new Zotero.Sync.Runner_Module({ baseURL, apiKey });
		
		Components.utils.import("resource://zotero/concurrentCaller.js");
		caller = new ConcurrentCaller(1);
		caller.setLogger(msg => Zotero.debug(msg));
		caller.stopOnError = true;
		caller.onError = function (e) {
			Zotero.logError(e);
			if (options.onError) {
				options.onError(e);
			}
			if (e.fatal) {
				caller.stop();
				throw e;
			}
		};
		
		yield Zotero.Users.setCurrentUserID(1);
		yield Zotero.Users.setCurrentUsername("A");
	})
	afterEach(function () {
		if (stub) stub.restore();
		if (spy) spy.restore();
	})
	after(function () {
		Zotero.HTTP.mock = null;
	})
	
	describe("#checkAccess()", function () {
		it("should check key access", function* () {
			setResponse('keyInfo.fullAccess');
			var json = yield runner.checkAccess(runner.getAPIClient({ apiKey }));
			var compare = {};
			Object.assign(compare, responses.keyInfo.fullAccess.json);
			delete compare.key;
			assert.deepEqual(json, compare);
		})
	})
	
	describe("#checkLibraries()", function () {
		afterEach(function* () {
			var group = Zotero.Groups.get(responses.groups.ownerGroup.json.id);
			if (group) {
				yield group.eraseTx();
			}
			group = Zotero.Groups.get(responses.groups.memberGroup.json.id);
			if (group) {
				yield group.eraseTx();
			}
		})
		
		it("should check library access and versions without library list", function* () {
			// Create group with same id and version as groups response
			var groupData = responses.groups.ownerGroup;
			var group1 = yield createGroup({
				id: groupData.json.id,
				version: groupData.json.version
			});
			groupData = responses.groups.memberGroup;
			var group2 = yield createGroup({
				id: groupData.json.id,
				version: groupData.json.version
			});
			
			setResponse('userGroups.groupVersions');
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }), false, responses.keyInfo.fullAccess.json
			);
			assert.lengthOf(libraries, 4);
			assert.sameMembers(
				libraries,
				[userLibraryID, publicationsLibraryID, group1.libraryID, group2.libraryID]
			);
		})
		
		it("should check library access and versions with library list", function* () {
			// Create groups with same id and version as groups response
			var groupData = responses.groups.ownerGroup;
			var group1 = yield createGroup({
				id: groupData.json.id,
				version: groupData.json.version
			});
			groupData = responses.groups.memberGroup;
			var group2 = yield createGroup({
				id: groupData.json.id,
				version: groupData.json.version
			});
			
			setResponse('userGroups.groupVersions');
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }),
				false,
				responses.keyInfo.fullAccess.json,
				[userLibraryID]
			);
			assert.lengthOf(libraries, 1);
			assert.sameMembers(libraries, [userLibraryID]);
			
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }),
				false,
				responses.keyInfo.fullAccess.json,
				[userLibraryID, publicationsLibraryID]
			);
			assert.lengthOf(libraries, 2);
			assert.sameMembers(libraries, [userLibraryID, publicationsLibraryID]);
			
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }),
				false,
				responses.keyInfo.fullAccess.json,
				[group1.libraryID]
			);
			assert.lengthOf(libraries, 1);
			assert.sameMembers(libraries, [group1.libraryID]);
		})
		
		it("should update outdated group metadata", function* () {
			// Create groups with same id as groups response but earlier versions
			var groupData1 = responses.groups.ownerGroup;
			var group1 = yield createGroup({
				id: groupData1.json.id,
				version: groupData1.json.version - 1,
				editable: false
			});
			var groupData2 = responses.groups.memberGroup;
			var group2 = yield createGroup({
				id: groupData2.json.id,
				version: groupData2.json.version - 1,
				editable: true
			});
			
			setResponse('userGroups.groupVersions');
			setResponse('groups.ownerGroup');
			setResponse('groups.memberGroup');
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }), false, responses.keyInfo.fullAccess.json
			);
			assert.lengthOf(libraries, 4);
			assert.sameMembers(
				libraries,
				[userLibraryID, publicationsLibraryID, group1.libraryID, group2.libraryID]
			);
			
			assert.equal(group1.name, groupData1.json.data.name);
			assert.equal(group1.version, groupData1.json.version);
			assert.isTrue(group1.editable);
			assert.equal(group2.name, groupData2.json.data.name);
			assert.equal(group2.version, groupData2.json.version);
			assert.isFalse(group2.editable);
		})
		
		it("should update outdated group metadata for group created with classic sync", function* () {
			var groupData1 = responses.groups.ownerGroup;
			var group1 = yield createGroup({
				id: groupData1.json.id,
				version: 0,
				editable: false
			});
			var groupData2 = responses.groups.memberGroup;
			var group2 = yield createGroup({
				id: groupData2.json.id,
				version: 0,
				editable: true
			});
			
			yield Zotero.DB.queryAsync(
				"UPDATE groups SET version=0 WHERE groupID IN (?, ?)", [group1.id, group2.id]
			);
			yield Zotero.Libraries.init();
			group1 = Zotero.Groups.get(group1.id);
			group2 = Zotero.Groups.get(group2.id);
			
			setResponse('userGroups.groupVersions');
			setResponse('groups.ownerGroup');
			setResponse('groups.memberGroup');
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }),
				false,
				responses.keyInfo.fullAccess.json,
				[group1.libraryID, group2.libraryID]
			);
			assert.lengthOf(libraries, 2);
			assert.sameMembers(libraries, [group1.libraryID, group2.libraryID]);
			
			assert.equal(group1.name, groupData1.json.data.name);
			assert.equal(group1.version, groupData1.json.version);
			assert.isTrue(group1.editable);
			assert.equal(group2.name, groupData2.json.data.name);
			assert.equal(group2.version, groupData2.json.version);
			assert.isFalse(group2.editable);
		})
		
		it("should create locally missing groups", function* () {
			setResponse('userGroups.groupVersions');
			setResponse('groups.ownerGroup');
			setResponse('groups.memberGroup');
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }), false, responses.keyInfo.fullAccess.json
			);
			assert.lengthOf(libraries, 4);
			var groupData1 = responses.groups.ownerGroup;
			var group1 = Zotero.Groups.get(groupData1.json.id);
			var groupData2 = responses.groups.memberGroup;
			var group2 = Zotero.Groups.get(groupData2.json.id);
			assert.ok(group1);
			assert.ok(group2);
			assert.sameMembers(
				libraries,
				[userLibraryID, publicationsLibraryID, group1.libraryID, group2.libraryID]
			);
			assert.equal(group1.name, groupData1.json.data.name);
			assert.isTrue(group1.editable);
			assert.equal(group2.name, groupData2.json.data.name);
			assert.isFalse(group2.editable);
		})
		
		it("should delete remotely missing groups", function* () {
			var groupData1 = responses.groups.ownerGroup;
			var group1 = yield createGroup({ id: groupData1.json.id, version: groupData1.json.version });
			var groupData2 = responses.groups.memberGroup;
			var group2 = yield createGroup({ id: groupData2.json.id, version: groupData2.json.version });
			
			setResponse('userGroups.groupVersionsOnlyMemberGroup');
			waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				assert.include(text, group1.name);
			});
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }), false, responses.keyInfo.fullAccess.json
			);
			assert.lengthOf(libraries, 3);
			assert.sameMembers(libraries, [userLibraryID, publicationsLibraryID, group2.libraryID]);
			assert.isFalse(Zotero.Groups.exists(groupData1.json.id));
			assert.isTrue(Zotero.Groups.exists(groupData2.json.id));
		})
		
		it.skip("should keep remotely missing groups", function* () {
			var groupData = responses.groups.ownerGroup;
			var group = yield createGroup({ id: groupData.json.id, version: groupData.json.version });
			
			setResponse('userGroups.groupVersionsEmpty');
			waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				assert.include(text, group.name);
			}, "extra1");
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }), false, responses.keyInfo.fullAccess.json
			);
			assert.lengthOf(libraries, 3);
			assert.sameMembers(libraries, [userLibraryID, publicationsLibraryID, group.libraryID]);
			assert.isTrue(Zotero.Groups.exists(groupData.json.id));
		})
		
		it("should cancel sync with remotely missing groups", function* () {
			var groupData = responses.groups.ownerGroup;
			var group = yield createGroup({ id: groupData.json.id, version: groupData.json.version });
			
			setResponse('userGroups.groupVersionsEmpty');
			waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				assert.include(text, group.name);
			}, "cancel");
			var libraries = yield runner.checkLibraries(
				runner.getAPIClient({ apiKey }), false, responses.keyInfo.fullAccess.json
			);
			assert.lengthOf(libraries, 0);
			assert.isTrue(Zotero.Groups.exists(groupData.json.id));
		})
	})

	describe("#sync()", function () {
		it("should perform a sync across all libraries and update library versions", function* () {
			setResponse('keyInfo.fullAccess');
			setResponse('userGroups.groupVersions');
			setResponse('groups.ownerGroup');
			setResponse('groups.memberGroup');
			// My Library
			setResponse({
				method: "GET",
				url: "users/1/settings",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "users/1/collections?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "users/1/searches?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "users/1/items/top?format=versions&includeTrashed=1",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "users/1/items?format=versions&includeTrashed=1",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "users/1/deleted?since=0",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: []
			});
			// My Publications
			setResponse({
				method: "GET",
				url: "users/1/publications/settings",
				status: 200,
				headers: {
					"Last-Modified-Version": 10
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "users/1/publications/items/top?format=versions&includeTrashed=1",
				status: 200,
				headers: {
					"Last-Modified-Version": 10
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "users/1/publications/items?format=versions&includeTrashed=1",
				status: 200,
				headers: {
					"Last-Modified-Version": 10
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "users/1/publications/deleted?since=0",
				status: 200,
				headers: {
					"Last-Modified-Version": 10
				},
				json: []
			});
			// Group library 1
			setResponse({
				method: "GET",
				url: "groups/1623562/settings",
				status: 200,
				headers: {
					"Last-Modified-Version": 15
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/1623562/collections?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 15
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/1623562/searches?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 15
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/1623562/items/top?format=versions&includeTrashed=1",
				status: 200,
				headers: {
					"Last-Modified-Version": 15
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/1623562/items?format=versions&includeTrashed=1",
				status: 200,
				headers: {
					"Last-Modified-Version": 15
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/1623562/deleted?since=0",
				status: 200,
				headers: {
					"Last-Modified-Version": 15
				},
				json: []
			});
			// Group library 2
			setResponse({
				method: "GET",
				url: "groups/2694172/settings",
				status: 200,
				headers: {
					"Last-Modified-Version": 20
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/2694172/collections?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 20
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/2694172/searches?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 20
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/2694172/items/top?format=versions&includeTrashed=1",
				status: 200,
				headers: {
					"Last-Modified-Version": 20
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/2694172/items?format=versions&includeTrashed=1",
				status: 200,
				headers: {
					"Last-Modified-Version": 20
				},
				json: []
			});
			setResponse({
				method: "GET",
				url: "groups/2694172/deleted?since=0",
				status: 200,
				headers: {
					"Last-Modified-Version": 20
				},
				json: []
			});
			// Full-text syncing
			setResponse({
				method: "GET",
				url: "users/1/fulltext?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/publications/fulltext?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 10
				},
				json: {}
			});
			setResponse({
				method: "GET",
				url: "groups/1623562/fulltext?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 15
				},
				json: {}
			});
			setResponse({
				method: "GET",
				url: "groups/2694172/fulltext?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 20
				},
				json: {}
			});
			
			yield runner.sync({
				onError: e => { throw e },
			});
			
			// Check local library versions
			assert.equal(
				Zotero.Libraries.getVersion(userLibraryID),
				5
			);
			assert.equal(
				Zotero.Libraries.getVersion(publicationsLibraryID),
				10
			);
			assert.equal(
				Zotero.Libraries.getVersion(Zotero.Groups.getLibraryIDFromGroupID(1623562)),
				15
			);
			assert.equal(
				Zotero.Libraries.getVersion(Zotero.Groups.getLibraryIDFromGroupID(2694172)),
				20
			);
			
			// Last sync time should be within the last second
			var lastSyncTime = Zotero.Sync.Data.Local.getLastSyncTime();
			assert.isAbove(lastSyncTime, new Date().getTime() - 1000);
			assert.isBelow(lastSyncTime, new Date().getTime());
		})
		
		
		it("should handle user-initiated cancellation", function* () {
			setResponse('keyInfo.fullAccess');
			setResponse('userGroups.groupVersions');
			setResponse('groups.ownerGroup');
			setResponse('groups.memberGroup');
			
			var stub = sinon.stub(Zotero.Sync.Data.Engine.prototype, "start");
			
			stub.onCall(0).returns(Zotero.Promise.resolve());
			var e = new Zotero.Sync.UserCancelledException();
			e.handledRejection = true;
			stub.onCall(1).returns(Zotero.Promise.reject(e));
			// Shouldn't be reached
			stub.onCall(2).throws();
			
			yield runner.sync({
				onError: e => { throw e },
			});
			
			stub.restore();
		});
		
		
		it("should handle user-initiated cancellation for current library", function* () {
			setResponse('keyInfo.fullAccess');
			setResponse('userGroups.groupVersions');
			setResponse('groups.ownerGroup');
			setResponse('groups.memberGroup');
			
			var stub = sinon.stub(Zotero.Sync.Data.Engine.prototype, "start");
			
			stub.returns(Zotero.Promise.resolve());
			var e = new Zotero.Sync.UserCancelledException(true);
			e.handledRejection = true;
			stub.onCall(1).returns(Zotero.Promise.reject(e));
			
			yield runner.sync({
				onError: e => { throw e },
			});
			
			assert.equal(stub.callCount, 4);
			stub.restore();
		});
	})
	
	
	describe("#createAPIKeyFromCredentials()", function() {
		var data = {
			name: "Automatic Zotero Client Key",
			username: "Username",
			access: {
				user: {
					library: true,
					files: true,
					notes: true,
					write: true
				},
				groups: {
					all: {
						library: true,
						write: true
					}
				}
			}
		};
		var correctPostData = Object.assign({password: 'correctPassword'}, data);
		var incorrectPostData = Object.assign({password: 'incorrectPassword'}, data);
		var responseData = Object.assign({userID: 1, key: apiKey}, data);

		it("should return json with key when credentials valid", function* () {
			server.respond(function (req) {
				if (req.method == "POST") {
					var json = JSON.parse(req.requestBody);
					assert.deepEqual(json, correctPostData);
					req.respond(201, {}, JSON.stringify(responseData));
				}
			});

			var json = yield runner.createAPIKeyFromCredentials('Username', 'correctPassword');
			assert.equal(json.key, apiKey);
		});

		it("should return false when credentials invalid", function* () {
			server.respond(function (req) {
				if (req.method == "POST") {
					var json = JSON.parse(req.requestBody);
					assert.deepEqual(json, incorrectPostData);
					req.respond(403);
				}
			});

			var key = yield runner.createAPIKeyFromCredentials('Username', 'incorrectPassword');
			assert.isFalse(key);
		});
	});

	describe("#deleteAPIKey()", function() {
		it("should send DELETE request with correct key", function* (){
			Zotero.Sync.Data.Local.setAPIKey(apiKey);

			server.respond(function (req) {
				if (req.method == "DELETE") {
					assert.propertyVal(req.requestHeaders, 'Zotero-API-Key', apiKey);
					assert.equal(req.url, baseURL + "keys/current");
				}
				req.respond(204);
			});

			yield runner.deleteAPIKey();
		});
	});
	
	
	describe("Error Handling", function () {
		var win;
		
		afterEach(function () {
			if (win) {
				win.close();
			}
		});
		
		it("should show the sync error icon on error", function* () {
			let pubLib = Zotero.Libraries.get(publicationsLibraryID);
			pubLib.libraryVersion = 5;
			yield pubLib.save();
			
			setResponse('keyInfo.fullAccess');
			setResponse('userGroups.groupVersionsEmpty');
			// My Library
			setResponse({
				method: "GET",
				url: "users/1/settings",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: {
					INVALID: true // TODO: Find a cleaner error
				}
			});
			// No publications changes
			setResponse({
				method: "GET",
				url: "users/1/publications/settings?since=5",
				status: 304,
				headers: {
					"Last-Modified-Version": 5
				},
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/publications/fulltext?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": 5
				},
				json: {}
			});
			
			spy = sinon.spy(runner, "updateIcons");
			yield runner.sync();
			assert.isTrue(spy.calledTwice);
			assert.isArray(spy.args[1][0]);
			assert.lengthOf(spy.args[1][0], 1);
			// Not an instance of Error for some reason
			var error = spy.args[1][0][0];
			assert.equal(Object.getPrototypeOf(error).constructor.name, "Error");
		});
		
		
		it("should show a custom button in the error panel", function* () {
			win = yield loadZoteroPane();
			var libraryID = Zotero.Libraries.userLibraryID;
			
			yield runner.sync({
				background: true
			});
			
			var doc = win.document;
			var errorIcon = doc.getElementById('zotero-tb-sync-error');
			assert.isFalse(errorIcon.hidden);
			errorIcon.click();
			var panel = win.document.getElementById('zotero-sync-error-panel');
			var buttons = panel.getElementsByTagName('button');
			assert.lengthOf(buttons, 1);
			assert.equal(buttons[0].label, Zotero.getString('sync.openSyncPreferences'));
		});
		
		
		// TODO: Test multiple long tags and tags across libraries
		describe("Long Tag Fixer", function () {
			it("should split a tag", function* () {
				win = yield loadZoteroPane();
				
				var item = yield createDataObject('item');
				var tag = "title;feeling;matter;drum;treatment;caring;earthy;shrill;unit;obedient;hover;healthy;cheap;clever;wren;wicked;clip;shoe;jittery;shape;clear;dime;increase;complete;level;milk;false;infamous;lamentable;measure;cuddly;tasteless;peace;top;pencil;caption;unusual;depressed;frantic";
				item.addTag(tag, 1);
				yield item.saveTx();
				
				setResponse('keyInfo.fullAccess');
				setResponse('userGroups.groupVersions');
				setResponse('groups.ownerGroup');
				setResponse('groups.memberGroup');
				
				server.respond(function (req) {
					if (req.method == "POST" && req.url == baseURL + "users/1/items") {
						var json = JSON.parse(req.requestBody);
						if (json[0].tags.length == 1) {
							req.respond(
								200,
								{
									"Last-Modified-Version": 5
								},
								JSON.stringify({
									successful: {},
									success: {},
									unchanged: {},
									failed: {
										"0": {
											code: 413,
											message: "Tag 'title;feeling;matter;drum;treatment;caring;earthy;shrill;unit;obedient;hover…' is too long to sync",
											data: {
												tag
											}
										}
									}
								})
							);
						}
						else {
							let itemJSON = item.toResponseJSON();
							itemJSON.version = 6;
							itemJSON.data.version = 6;
							
							req.respond(
								200,
								{
									"Last-Modified-Version": 6
								},
								JSON.stringify({
									successful: {
										"0": itemJSON
									},
									success: {
										"0": json[0].key
									},
									unchanged: {},
									failed: {}
								})
							);
						}
					}
				});
				
				waitForDialog(null, 'accept', 'chrome://zotero/content/longTagFixer.xul');
				yield runner.sync({ libraries: [Zotero.Libraries.userLibraryID] });
				
				assert.isFalse(Zotero.Tags.getID(tag));
				assert.isNumber(Zotero.Tags.getID('feeling'));
			});
			
			it("should delete a tag", function* () {
				win = yield loadZoteroPane();
				
				var item = yield createDataObject('item');
				var tag = "title;feeling;matter;drum;treatment;caring;earthy;shrill;unit;obedient;hover;healthy;cheap;clever;wren;wicked;clip;shoe;jittery;shape;clear;dime;increase;complete;level;milk;false;infamous;lamentable;measure;cuddly;tasteless;peace;top;pencil;caption;unusual;depressed;frantic";
				item.addTag(tag, 1);
				yield item.saveTx();
				
				setResponse('keyInfo.fullAccess');
				setResponse('userGroups.groupVersions');
				setResponse('groups.ownerGroup');
				setResponse('groups.memberGroup');
				
				server.respond(function (req) {
					if (req.method == "POST" && req.url == baseURL + "users/1/items") {
						var json = JSON.parse(req.requestBody);
						if (json[0].tags.length == 1) {
							req.respond(
								200,
								{
									"Last-Modified-Version": 5
								},
								JSON.stringify({
									successful: {},
									success: {},
									unchanged: {},
									failed: {
										"0": {
											code: 413,
											message: "Tag 'title;feeling;matter;drum;treatment;caring;earthy;shrill;unit;obedient;hover…' is too long to sync",
											data: {
												tag
											}
										}
									}
								})
							);
						}
						else {
							let itemJSON = item.toResponseJSON();
							itemJSON.version = 6;
							itemJSON.data.version = 6;
							
							req.respond(
								200,
								{
									"Last-Modified-Version": 6
								},
								JSON.stringify({
									successful: {
										"0": itemJSON
									},
									success: {
										"0": json[0].key
									},
									unchanged: {},
									failed: {}
								})
							);
						}
					}
				});
				
				waitForDialog(function (dialog) {
					dialog.Zotero_Long_Tag_Fixer.switchMode(2);
				}, 'accept', 'chrome://zotero/content/longTagFixer.xul');
				yield runner.sync({ libraries: [Zotero.Libraries.userLibraryID] });
				
				assert.isFalse(Zotero.Tags.getID(tag));
				assert.isFalse(Zotero.Tags.getID('feeling'));
			});
		});
	});
})
