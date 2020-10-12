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
			
			describe("multipart/form-data", function () {
				it("should support text", async function () {
					var called = false;
					var endpoint = "/test/" + Zotero.Utilities.randomString();

					Zotero.Server.Endpoints[endpoint] = function () {};
					Zotero.Server.Endpoints[endpoint].prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: ["multipart/form-data"],
						
						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.property(options.headers, "Content-Type");
							assert(options.headers["Content-Type"].startsWith("multipart/form-data; boundary="));
							assert.isArray(options.data);
							assert.equal(options.data.length, 1);
							
							let expected = {
								header: "Content-Disposition: form-data; name=\"foo\"",
								body: "bar",
								params: {
									name: "foo"
								}
							};
							assert.deepEqual(options.data[0], expected);
							return 204;
						}
					};

					let formData = new FormData();
					formData.append("foo", "bar");

					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Content-Type": "multipart/form-data"
							},
							body: formData
						}
					);

					assert.ok(called);
					assert.equal(req.status, 204);
				});
				
				it("should support binary", async function () {
					let called = false;
					let endpoint = "/test/" + Zotero.Utilities.randomString();
					let file = getTestDataDirectory();
					file.append('test.png');
					let contents = await Zotero.File.getBinaryContentsAsync(file);

					Zotero.Server.Endpoints[endpoint] = function () {};
					Zotero.Server.Endpoints[endpoint].prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: ["multipart/form-data"],
						
						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.property(options.headers, "Content-Type");
							assert(options.headers["Content-Type"].startsWith("multipart/form-data; boundary="));
							assert.isArray(options.data);
							assert.equal(options.data.length, 1);
							assert.equal(options.data[0].header, "Content-Disposition: form-data; name=\"image\"; filename=\"test.png\"\r\nContent-Type: image/png");
							let expected = {
								name: "image",
								filename: "test.png",
								contentType: "image/png"
							};
							assert.deepEqual(options.data[0].params, expected);
							assert.equal(options.data[0].body, contents);
							
							return 204;
						}
					};

					let image = await File.createFromFileName(OS.Path.join(getTestDataDirectory().path, 'test.png'));
					let formData = new FormData();
					formData.append("image", image);

					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Content-Type": "multipart/form-data"
							},
							body: formData
						}
					);

					assert.ok(called);
					assert.equal(req.status, 204);
				});

				it("should support an empty body", async function () {
					var called = false;
					var endpoint = "/test/" + Zotero.Utilities.randomString();

					Zotero.Server.Endpoints[endpoint] = function () {};
					Zotero.Server.Endpoints[endpoint].prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: ["multipart/form-data"],

						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.property(options.headers, "Content-Type");
							assert(options.headers["Content-Type"].startsWith("multipart/form-data; boundary="));
							assert.isArray(options.data);
							assert.equal(options.data.length, 1);

							let expected = {
								header: "Content-Disposition: form-data; name=\"foo\"",
								body: "",
								params: {
									name: "foo"
								}
							};
							assert.deepEqual(options.data[0], expected);
							return 204;
						}
					};

					let formData = new FormData();
					formData.append("foo", "");

					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Content-Type": "multipart/form-data"
							},
							body: formData
						}
					);

					assert.ok(called);
					assert.equal(req.status, 204);
				});
			});
		});
	})
});
