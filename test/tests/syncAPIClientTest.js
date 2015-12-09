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
		
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		
		client = new Zotero.Sync.APIClient({
			baseURL,
			apiVersion: ZOTERO_CONFIG.API_VERSION,
			apiKey,
			caller
		})
	})
	
	beforeEach(function () {
		server = sinon.fakeServer.create();
		server.autoRespond = true;
	})
	
	after(function () {
		Zotero.HTTP.mock = null;
	})
	
	describe("#_checkConnection()", function () {
		it("should catch an error with an empty response", function* () {
			setResponse({
				method: "GET",
				url: "error",
				status: 500,
				text: ""
			})
			var e = yield getPromiseError(client.makeRequest("GET", baseURL + "error"));
			assert.ok(e);
			assert.isTrue(e.message.startsWith(Zotero.getString('sync.error.emptyResponseServer')));
		})
		
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
})
