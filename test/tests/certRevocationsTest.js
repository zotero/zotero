describe("CertRevocations", function () {
	var { CertRevocations } = ChromeUtils.importESModule("chrome://zotero/content/modules/certRevocations.mjs");
	
	// OneCRL entry for "EM DV TLS CA - G3B", an eMudhra intermediate with a compromised key
	var record = {
		subject: "MD8xCzAJBgNVBAYTAk5MMRMwEQYDVQQKDAplTXVkaHJhIEJWMRswGQYDVQQDDBJFTSBEViBUTFMgQ0EgLSBHM0I=",
		pubKeyHash: "6+1kdcLC2A/LGZ8/6N1uazzmC3frFdTkLD3sDG9bUQU="
	};
	
	async function readCert(name) {
		var pem = await Zotero.File.getContentsAsync(PathUtils.join(getTestDataDirectory().path, name));
		var certDB = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);
		return certDB.constructX509FromBase64(pem.replace(/-----[^-]+-----|\s/g, ''));
	}
	
	// Verify the intermediate via emSign Root TLS CA - G3, cross-signed by the built-in
	// emSign ECC Root CA - G3
	async function verify() {
		var certDB = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);
		var cert = await readCert('em-dv-tls-ca-g3b.pem');
		var crossCert = await readCert('emsign-root-tls-ca-g3.pem');
		// 2026-06-01, within the validity periods of both certificates
		var time = Date.UTC(2026, 5, 1) / 1000;
		return new Promise((resolve) => {
			certDB.asyncVerifyCertAtTime(
				cert,
				Ci.nsIX509CertDB.verifyUsageTLSServerCA,
				Ci.nsIX509CertDB.FLAG_LOCAL_ONLY,
				null,
				time,
				[crossCert.getRawDER()],
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
