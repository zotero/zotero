describe("CertRevocations", function () {
	var { CertRevocations } = ChromeUtils.importESModule("chrome://zotero/content/modules/certRevocations.mjs");
	
	// OneCRL-style entry for Let's Encrypt's R14, a backup intermediate signed by the built-in
	// ISRG Root X1
	var record = {
		subject: "MDMxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQDEwNSMTQ=",
		pubKeyHash: "8WR6XuPvrFTIkukwWE/keXm3rNHHbBJxvKHFB22GmIg="
	};
	
	async function readCert(name) {
		var pem = await Zotero.File.getContentsAsync(PathUtils.join(getTestDataDirectory().path, name));
		var certDB = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);
		return certDB.constructX509FromBase64(pem.replace(/-----[^-]+-----|\s/g, ''));
	}
	
	async function verify() {
		var certDB = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);
		var cert = await readCert('letsencrypt-r14.pem');
		// 2026-06-01, within the certificate's validity period
		var time = Date.UTC(2026, 5, 1) / 1000;
		return new Promise((resolve) => {
			certDB.asyncVerifyCertAtTime(
				cert,
				Ci.nsIX509CertDB.verifyUsageTLSServerCA,
				Ci.nsIX509CertDB.FLAG_LOCAL_ONLY,
				null,
				time,
				[],
				errorCode => resolve(errorCode)
			);
		});
	}
	
	// Above the timestamp of any real list
	var timestamp = Date.now();
	
	after(async function () {
		// Restore the bundled list
		await IOUtils.remove(PathUtils.join(PathUtils.profileDir, 'onecrl-state.json'));
		Zotero.Prefs.clear('certRevocations.buildID');
		await CertRevocations.update();
	});
	
	it("should revoke and unrevoke certificates as the list changes", async function () {
		const SEC_ERROR_REVOKED_CERTIFICATE = -8180;
		
		await CertRevocations.apply({ data: [], timestamp: ++timestamp });
		assert.equal(await verify(), 0);
		
		await CertRevocations.apply({ data: [record], timestamp: ++timestamp });
		assert.equal(await verify(), SEC_ERROR_REVOKED_CERTIFICATE);
		
		await CertRevocations.apply({ data: [], timestamp: ++timestamp });
		assert.equal(await verify(), 0);
	});
	
	it("should ignore a list older than the last one applied", async function () {
		const SEC_ERROR_REVOKED_CERTIFICATE = -8180;
		
		let olderTimestamp = ++timestamp;
		await CertRevocations.apply({ data: [record], timestamp: ++timestamp });
		await CertRevocations.apply({ data: [], timestamp: olderTimestamp });
		assert.equal(await verify(), SEC_ERROR_REVOKED_CERTIFICATE);
	});
});
