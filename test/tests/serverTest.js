"use strict";

describe("Zotero.Server", function () {
	Components.utils.import("resource://zotero-unit/httpd.js");
	var serverPath;
	
	before(function* () {
		Zotero.Prefs.set("httpServer.enabled", true);
		Zotero.Server.init();
		serverPath = 'http://127.0.0.1:' + Zotero.Prefs.get('httpServer.port');
	});
	
	describe('DataListener', function() {
		describe("_processEndpoint()", function () {
			describe("1 argument", function () {
				it("integer return", function* () {
					var called = false;
					
					var endpoint = "/test/" + Zotero.Utilities.randomString();
					var handler = function () {};
					handler.prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: "*",
						
						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.propertyVal(options.headers, "Accept-Charset", "UTF-8");
							return 204;
						}
					};
					Zotero.Server.Endpoints[endpoint] = handler;
					
					let req = yield Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Accept-Charset": "UTF-8",
								"Content-Type": "application/json"
							},
							responseType: "text",
							body: JSON.stringify({
								foo: "bar"
							})
						}
					);
					
					assert.ok(called);
					assert.equal(req.status, 204);
				});
				
				it("array return", function* () {
					var called = false;
					
					var endpoint = "/test/" + Zotero.Utilities.randomString();
					var handler = function () {};
					handler.prototype = {
						supportedMethods: ["GET"],
						supportedDataTypes: "*",
						
						init: function (options) {
							called = true;
							assert.isObject(options);
							return [201, "text/plain", "Test"];
						}
					};
					Zotero.Server.Endpoints[endpoint] = handler;
					
					let req = yield Zotero.HTTP.request(
						"GET",
						serverPath + endpoint,
						{
							responseType: "text"
						}
					);
					
					assert.ok(called);
					assert.equal(req.status, 201);
					assert.equal(req.getResponseHeader("Content-Type"), "text/plain");
					assert.equal(req.responseText, "Test");
				});
				
				it("integer promise return", function* () {
					var called = false;
					
					var endpoint = "/test/" + Zotero.Utilities.randomString();
					var handler = function () {};
					handler.prototype = {
						supportedMethods: ["GET"],
						supportedDataTypes: "*",
						
						init: Zotero.Promise.coroutine(function* (options) {
							called = true;
							assert.isObject(options);
							return 204;
						})
					};
					Zotero.Server.Endpoints[endpoint] = handler;
					
					let req = yield Zotero.HTTP.request(
						"GET",
						serverPath + endpoint,
						{
							responseType: "text"
						}
					);
					
					assert.ok(called);
					assert.equal(req.status, 204);
				});
				
				it("array promise return", function* () {
					var called = false;
					
					var endpoint = "/test/" + Zotero.Utilities.randomString();
					var handler = function () {};
					handler.prototype = {
						supportedMethods: ["GET"],
						supportedDataTypes: "*",
						
						init: Zotero.Promise.coroutine(function* (options) {
							called = true;
							assert.isObject(options);
							return [201, "text/plain", "Test"];
						})
					};
					Zotero.Server.Endpoints[endpoint] = handler;
					
					let req = yield Zotero.HTTP.request(
						"GET",
						serverPath + endpoint,
						{
							responseType: "text"
						}
					);
					
					assert.ok(called);
					assert.equal(req.status, 201);
					assert.equal(req.getResponseHeader("Content-Type"), "text/plain");
					assert.equal(req.responseText, "Test");
				});
			});
		});
	})
});
