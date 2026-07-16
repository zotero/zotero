"use strict";

describe("Zotero", function() {
	describe("#restoreZoteroPaneProgressMeter()", function () {
		// A token captures the current display state, so taking one and immediately
		// restoring it reads the state without changing it
		function getProgressState() {
			let token = Zotero.showZoteroPaneProgressMeter(undefined);
			Zotero.restoreZoteroPaneProgressMeter(token);
			return token;
		}
		
		afterEach(function () {
			Zotero.hideZoteroPaneOverlays();
		});
		
		it("should restore nested progress displays to their previous owners", function () {
			let token1 = Zotero.showZoteroPaneProgressMeter("One", true);
			Zotero.updateZoteroPaneProgressMeter(30);
			let token2 = Zotero.showZoteroPaneProgressMeter("Two");
			
			// The new display should start with no percentage, so that a first update
			// matching the previous meter's position isn't suppressed
			assert.isNull(getProgressState().percentage);
			
			// Restoring an outer token while an inner display is up should do nothing
			Zotero.restoreZoteroPaneProgressMeter(token1);
			assert.isTrue(Zotero.locked);
			
			// Restoring the inner token should re-show the outer display, including its
			// meter position, which is stored scaled by 10
			Zotero.restoreZoteroPaneProgressMeter(token2);
			let state = getProgressState();
			assert.equal(state.message, "One");
			assert.isTrue(state.determinate);
			assert.equal(state.percentage, 300);
			
			// Now the outer token can restore, unlocking the pane
			Zotero.restoreZoteroPaneProgressMeter(token1);
			assert.isFalse(Zotero.locked);
		});
		
		it("should capture a meter switched to indeterminate by updateZoteroPaneProgressMeter()", function () {
			let token1 = Zotero.showZoteroPaneProgressMeter("One", true);
			Zotero.updateZoteroPaneProgressMeter(null);
			let token2 = Zotero.showZoteroPaneProgressMeter("Two");
			assert.isFalse(token2.determinate);
			assert.isNull(token2.percentage);
			
			Zotero.restoreZoteroPaneProgressMeter(token2);
			let state = getProgressState();
			assert.isFalse(state.determinate);
			assert.isNull(state.percentage);
			
			Zotero.restoreZoteroPaneProgressMeter(token1);
			assert.isFalse(Zotero.locked);
		});
		
		it("should capture a meter switched to determinate by updateZoteroPaneProgressMeter()", function () {
			let token1 = Zotero.showZoteroPaneProgressMeter("One");
			Zotero.updateZoteroPaneProgressMeter(40);
			let token2 = Zotero.showZoteroPaneProgressMeter("Two");
			assert.isTrue(token2.determinate);
			assert.equal(token2.percentage, 400);
			
			Zotero.restoreZoteroPaneProgressMeter(token2);
			let state = getProgressState();
			assert.isTrue(state.determinate);
			assert.equal(state.percentage, 400);
			
			Zotero.restoreZoteroPaneProgressMeter(token1);
			assert.isFalse(Zotero.locked);
		});
	});
	
	
	describe("VersionHeader", function () {
		describe("#update()", function () {
			var majorMinorVersion;
			
			before(function () {
				majorMinorVersion = Zotero.version.replace(/(\d+\.\d+).*/, '$1');
			});
			
			it("should replace app name with Firefox", function () {
				var platformVersion = Services.appinfo.platformVersion.match(/^\d+/)[0] + '.0';
				var ua1 = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:60.0) Gecko/20100101 ${Zotero.clientName}/${Zotero.version}`;
				var ua2 = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:60.0) Gecko/20100101 Firefox/${platformVersion} ${Zotero.clientName}/${Zotero.version}`;
				assert.equal(Zotero.VersionHeader.update(ua1), ua2);
			});
			
			it("should show Chrome user agent unchanged", function () {
				var ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36';
				assert.equal(Zotero.VersionHeader.update(ua), ua);
			});
				
			it("should show Firefox user agent unchanged", function () {
				var ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:60.0) Gecko/20100101 Firefox/60.0';
				assert.equal(Zotero.VersionHeader.update(ua), ua);
			});
		});
	});
});
