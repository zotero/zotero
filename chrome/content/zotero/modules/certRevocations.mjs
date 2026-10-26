/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2026 Corporation for Digital Scholarship
					 Falls Church, Virginia, USA
					 http://zotero.org
	
	This file is part of Zotero.
	
	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
	
	***** END LICENSE BLOCK *****
*/

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

const LIST_URL = "resource://app/defaults/settings/security-state/onecrl.json";
const STATE_FILE_NAME = "onecrl-state.json";

/**
 * Applies Mozilla's OneCRL list of revoked CA and intermediate certificates to Gecko's
 * certificate storage
 *
 * Firefox gets OneCRL via Remote Settings, which Zotero doesn't include, so Zotero applies the
 * snapshot bundled with each build instead. Entries applied previously that are no longer in
 * the list are unrevoked, and lists older than the last one applied are ignored.
 */
export var CertRevocations = {
	
	/**
	 * Apply the bundled list if the app has been updated since the last run
	 */
	async update() {
		let buildID = Services.appinfo.appBuildID;
		if (Zotero.Prefs.get('certRevocations.buildID') == buildID && await hasPriorData()) {
			return;
		}
		let list = JSON.parse(await Zotero.File.getResourceAsync(LIST_URL));
		await this.apply(list);
		Zotero.Prefs.set('certRevocations.buildID', buildID);
	},
	
	
	/**
	 * @param {Object} list
	 * @param {Object[]} list.data - OneCRL records, with either issuerName and serialNumber or
	 *     subject and pubKeyHash
	 * @param {Number} list.timestamp
	 */
	async apply({ data, timestamp }) {
		let stateFile = PathUtils.join(PathUtils.profileDir, STATE_FILE_NAME);
		
		let previous = [];
		// If the certificate storage was recreated, everything needs to be applied again
		if (await hasPriorData()) {
			try {
				let state = await IOUtils.readJSON(stateFile);
				// Ignore older lists (e.g., after a downgrade), which are missing newer revocations
				if (state.timestamp >= timestamp) {
					return;
				}
				previous = state.entries;
			}
			catch (e) {
				if (e.name != 'NotFoundError') {
					Zotero.logError(e);
				}
			}
		}
		
		let entries = data
			.map(({ issuerName, serialNumber, subject, pubKeyHash }) => {
				if (issuerName && serialNumber) {
					return { issuerName, serialNumber };
				}
				if (subject && pubKeyHash) {
					return { subject, pubKeyHash };
				}
				return null;
			})
			.filter(x => x);
		let currentKeys = new Set(entries.map(getKey));
		let previousKeys = new Set(previous.map(getKey));
		
		let states = [
			...previous
				.filter(entry => !currentKeys.has(getKey(entry)))
				.map(entry => createState(entry, Ci.nsICertStorage.STATE_UNSET)),
			...entries
				.filter(entry => !previousKeys.has(getKey(entry)))
				.map(entry => createState(entry, Ci.nsICertStorage.STATE_ENFORCE))
		];
		Zotero.debug(`Updating ${states.length} certificate revocations from OneCRL list ${timestamp}`);
		if (states.length) {
			await new Promise((resolve, reject) => {
				getCertStorage().setRevocations(states, (rv) => {
					if (rv == Cr.NS_OK) {
						resolve();
					}
					else {
						reject(new Error(`Failed to set certificate revocations (${rv})`));
					}
				});
			});
		}
		await IOUtils.writeJSON(stateFile, { timestamp, entries }, { tmpPath: stateFile + '.tmp' });
	}
};


function getCertStorage() {
	return Cc["@mozilla.org/security/certstorage;1"].getService(Ci.nsICertStorage);
}


function hasPriorData() {
	return new Promise((resolve) => {
		getCertStorage().hasPriorData(
			Ci.nsICertStorage.DATA_TYPE_REVOCATION,
			(rv, result) => resolve(rv == Cr.NS_OK && result)
		);
	});
}


function getKey(entry) {
	return entry.issuerName
		? `issuer ${entry.issuerName} ${entry.serialNumber}`
		: `subject ${entry.subject} ${entry.pubKeyHash}`;
}


function createState(entry, state) {
	if (entry.issuerName) {
		return {
			issuer: entry.issuerName,
			serial: entry.serialNumber,
			state,
			QueryInterface: ChromeUtils.generateQI(["nsIIssuerAndSerialRevocationState"])
		};
	}
	return {
		subject: entry.subject,
		pubKey: entry.pubKeyHash,
		state,
		QueryInterface: ChromeUtils.generateQI(["nsISubjectAndPubKeyRevocationState"])
	};
}
