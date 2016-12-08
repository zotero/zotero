"use strict";

describe("Zotero.Proxies", function(){
	describe("#getPotentialProxies", function() {
		it("should return the provided url mapped to null when url is not proxied", function() {
			let url = "http://www.example.com";
			let proxies = Zotero.Proxies.getPotentialProxies(url);
			let expectedProxies = {};
			expectedProxies[url] = null;
			assert.deepEqual(proxies, expectedProxies);
		});
		
		it("should return the provided url and deproxied url", function() {
			let url = "https://www.example.com.proxy.example.com";
			let proxies = Zotero.Proxies.getPotentialProxies(url);
			let expectedProxies = {};
			expectedProxies[url] = null;
			expectedProxies["https://www.example.com"] = {scheme: "https://%h.proxy.example.com/%p", dotsToHyphens: false};
			assert.deepEqual(proxies, expectedProxies);
		});
		
		it("should return the provided url and deproxied url with replaced hyphens", function() {
			let url = "https://www-example-com.proxy.example.com";
			let proxies = Zotero.Proxies.getPotentialProxies(url);
			let expectedProxies = {};
			expectedProxies[url] = null;
			expectedProxies["https://www.example.com"] = {scheme: "https://%h.proxy.example.com/%p", dotsToHyphens: true};
			assert.deepEqual(proxies, expectedProxies);
		});
	});
});
