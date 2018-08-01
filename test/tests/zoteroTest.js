"use strict";

describe("Zotero", function() {
	describe("VersionHeader", function () {
		describe("#update()", function () {
			var majorMinorVersion;
			
			before(function () {
				majorMinorVersion = Zotero.version.replace(/(\d+\.\d+).*/, '$1');
			});
			
			it("should add Zotero/[major.minor] to Chrome user agent", function () {
				var ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36';
				assert.equal(Zotero.VersionHeader.update('example.com', ua, ZOTERO_CONFIG.CLIENT_NAME), ua + ` Zotero/${majorMinorVersion}`);
			});
				
			it("should add Zotero/[major.minor] to Firefox user agent", function () {
				var ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:60.0) Gecko/20100101 Firefox/60.0';
				assert.equal(Zotero.VersionHeader.update('example.com', ua, ZOTERO_CONFIG.CLIENT_NAME), ua + ` Zotero/${majorMinorVersion}`);
			});
		});
	});
});
