"use strict";

describe("Zotero", function() {
	describe("VersionHeader", function () {
		describe("#update()", function () {
			var majorMinorVersion;
			
			before(function () {
				majorMinorVersion = Zotero.version.replace(/(\d+\.\d+).*/, '$1');
			});
			
			it("should replace app name with Firefox", function () {
				var platformVersion = Services.appinfo.platformVersion.match(/^\d+/)[0] + '.0';
				var ua1 = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:60.0) Gecko/20100101 ${Zotero.clientName}/${Zotero.version}`;
				var ua2 = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:60.0) Gecko/20100101 Firefox/${platformVersion}`;
				assert.equal(Zotero.VersionHeader.update('example.com', ua1, ZOTERO_CONFIG.CLIENT_NAME), ua2);
			});
			
			it("should show Chrome user agent unchanged", function () {
				var ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36';
				assert.equal(Zotero.VersionHeader.update('example.com', ua, ZOTERO_CONFIG.CLIENT_NAME), ua);
			});
				
			it("should show Firefox user agent unchanged", function () {
				var ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:60.0) Gecko/20100101 Firefox/60.0';
				assert.equal(Zotero.VersionHeader.update('example.com', ua, ZOTERO_CONFIG.CLIENT_NAME), ua);
			});
		});
	});
});
