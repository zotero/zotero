"use strict";

describe("Zotero.Sync.APIClient", function () {
	Components.utils.import("resource://zotero/config.js");
	
	var apiKey = Zotero.Utilities.randomString(24);
	var baseURL = "http://local.zotero/";
	var server, client;
	
	function setResponse(response) {
		setHTTPResponse(server, baseURL, response, {});
	}
	
	before(function () {
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
	});
	
	beforeEach(function () {
		Components.utils.import("resource://zotero/concurrentCaller.js");
		var caller = new ConcurrentCaller(1);
		caller.setLogger(msg => Zotero.debug(msg));
		caller.stopOnError = true;
		caller.onError = function (e) {
			Zotero.logError(e);
			if (e.fatal) {
				caller.stop();
				throw e;
			}
		};
		
		client = new Zotero.Sync.APIClient({
			baseURL,
			apiVersion: ZOTERO_CONFIG.API_VERSION,
			apiKey,
			caller
		})
		
		server = sinon.fakeServer.create();
		server.autoRespond = true;
	})
	
	after(function () {
		Zotero.HTTP.mock = null;
	})
	
	describe("#_checkConnection()", function () {
		it("should catch an interrupted connection", function* () {
			setResponse({
				method: "GET",
				url: "empty",
				status: 0,
				text: ""
			})
			var e = yield getPromiseError(client.makeRequest("GET", baseURL + "empty"));
			assert.ok(e);
			assert.equal(e.message, Zotero.getString('sync.error.checkConnection'));
		})
	})
	
	describe("#getGroups()", function () {
		it("should automatically fetch multiple pages of results", function* () {
			function groupJSON(groupID) {
				return {
					id: groupID,
					version: 1,
					data: {
						id: groupID,
						version: 1,
						name: "Group " + groupID
					}
				};
			}
			
			server.respond(function (req) {
				if (req.method == "GET" && req.url.startsWith(baseURL + "users/1/groups")) {
					// TODO: Use a real parser
					let matches = req.url.match(/start=(\d+)/);
					let start = matches ? parseInt(matches[1]) : null;
					matches = req.url.match(/limit=(\d+)/);
					let limit = matches ? parseInt(matches[1]) : null;
					if (start === null && limit === null) {
						req.respond(
							200,
							{
								Link: `<${baseURL}users/1/groups?limit=2&start=2>; rel="next", <${baseURL}users/1/groups?limit=2&start=4>; rel="last", <${baseURL}users/1/groups>; rel="alternate"`,
								"Total-Results": 2
							},
							JSON.stringify([
								groupJSON(1),
								groupJSON(2)
							])
						);
					}
					else if (start == 2 && limit == 2) {
						req.respond(
							200,
							{
								Link: `<${baseURL}users/1/groups?limit=2&start=4>; rel="next", <${baseURL}users/1/groups?limit=2&start=4>; rel="last", <${baseURL}users/1/groups>; rel="alternate"`,
								"Total-Results": 5
							},
							JSON.stringify([
								groupJSON(3),
								groupJSON(4)
							])
						);
					}
					else if (start == 4 && limit == 2) {
						req.respond(
							200,
							{
								Link: `<${baseURL}users/1/groups?limit=2&start=4>; rel="last", <${baseURL}users/1/groups>; rel="alternate"`,
								"Total-Results": 5
							},
							JSON.stringify([
								groupJSON(5),
							])
						);
					}
				}
			});
			
			var results = yield client.getGroups(1);
			assert.lengthOf(results, 5);
			assert.sameMembers(results.map(o => o.id), [1, 2, 3, 4, 5]);
		});
	});
	
	
	describe("Retries", function () {
		var spy;
		var delayStub;
		
		before(function () {
			delayStub = sinon.stub(Zotero.Promise, "delay").returns(Zotero.Promise.resolve());
		});
		
		beforeEach(function () {
			client.failureDelayIntervals = [10, 20];
			client.failureDelayMax = 25;
			client.rateDelayIntervals = [15, 25];
		});
		
		afterEach(function () {
			if (spy) {
				spy.restore();
			}
			delayStub.resetHistory();
		});
		
		after(function () {
			delayStub.restore();
		});
		
		
		describe("#makeRequest()", function () {
			it("should retry on 500 error", function* () {
				setResponse({
					method: "GET",
					url: "error",
					status: 500,
					text: ""
				});
				spy = sinon.spy(Zotero.HTTP, "request");
				var e = yield getPromiseError(client.makeRequest("GET", baseURL + "error"));
				assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
				assert.isTrue(spy.calledTwice);
			});
			
			it("should obey Retry-After for 503", function* () {
				var called = 0;
				server.respond(function (req) {
					if (req.method == "GET" && req.url == baseURL + "error") {
						if (called < 1) {
							req.respond(
								503,
								{
									"Retry-After": "5"
								},
								""
							);
						}
						else if (called < 2) {
							req.respond(
								503,
								{
									"Retry-After": "10"
								},
								""
							);
						}
						else {
							req.respond(
								200,
								{},
								""
							);
						}
					}
					called++;
				});
				spy = sinon.spy(Zotero.HTTP, "request");
				yield client.makeRequest("GET", baseURL + "error");
				assert.isTrue(spy.calledThrice);
				// DEBUG: Why are these slightly off?
				assert.approximately(delayStub.args[0][0], 5 * 1000, 5);
				assert.approximately(delayStub.args[1][0], 10 * 1000, 5);
			});
		});
		
		
		describe("#_check429()", function () {
			it("should retry on 429 error", function* () {
				var called = 0;
				server.respond(function (req) {
					if (req.method == "GET" && req.url == baseURL + "error") {
						if (called < 2) {
							req.respond(
								429,
								{},
								""
							);
						}
						else {
							req.respond(
								200,
								{},
								""
							);
						}
					}
					called++;
				});
				spy = sinon.spy(Zotero.HTTP, "request");
				yield client.makeRequest("GET", baseURL + "error");
				assert.isTrue(spy.calledThrice);
				// DEBUG: Why are these slightly off?
				assert.approximately(delayStub.args[0][0], 15 * 1000, 5);
				assert.approximately(delayStub.args[1][0], 25 * 1000, 5);
			});
		});
	});
})
