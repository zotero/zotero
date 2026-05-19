/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org

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

// Wrapper around Mozilla's OSKeyStore, which derives an encryption key from
// platform-native key storage (Keychain on macOS, DPAPI on Windows, libsecret
// on Linux). Encrypted values are returned with a versioned prefix so callers
// can distinguish them from legacy plaintext values previously written to
// nsILoginManager.
Zotero.OSKeyStore = {
	_prefix: 'oskv1:',
	_module: null,

	_load: function () {
		if (this._module === null) {
			try {
				let { OSKeyStore } = ChromeUtils.importESModule(
					"resource://gre/modules/OSKeyStore.sys.mjs"
				);
				this._module = OSKeyStore;
			}
			catch (e) {
				Zotero.logError(e);
				this._module = false;
			}
		}
		return this._module;
	},

	get available() {
		return !!this._load();
	},

	isEncrypted: function (value) {
		return typeof value == 'string' && value.startsWith(this._prefix);
	},

	// Show an alert when an active write of new credentials fails (e.g., keychain unavailable)
	alertSaveFailed: function () {
		let win = Services.wm.getMostRecentWindow('zotero:main');
		if (!win) {
			return;
		}
		Zotero.alert(
			win,
			Zotero.getString('general-error'),
			Zotero.getString('os-keystore-save-failed')
		);
	},

	// Show a one-shot alert when migration of an existing legacy plaintext entry
	// fails. The caller falls back to using the legacy value, so the user isn't
	// blocked, but show an alert so the keychain issue can be reported and
	// addressed before a future version drops the legacy fallback.
	alertMigrateFailed: function () {
		if (this._migrateAlertShown) {
			return;
		}
		this._migrateAlertShown = true;
		let win = Services.wm.getMostRecentWindow('zotero:main');
		if (!win) {
			return;
		}
		Zotero.alert(
			win,
			Zotero.getString('general-error'),
			Zotero.getString('os-keystore-migrate-failed')
		);
	},

	// Returns prefixed ciphertext. Throws if OSKeyStore is unavailable so we
	// don't silently store plaintext when a caller expects encryption.
	encrypt: async function (plaintext) {
		let mod = this._load();
		if (!mod) {
			throw new Error("OSKeyStore unavailable");
		}
		let ciphertext = await mod.encrypt(plaintext);
		return this._prefix + ciphertext;
	},

	// Returns the plaintext, or the input unchanged if it doesn't carry our
	// prefix (legacy plaintext). Throws if the value is prefixed but decryption
	// fails -- e.g. keychain locked, user canceled the unlock prompt, profile
	// copied to a different OS user, ciphertext corrupted.
	decrypt: async function (value) {
		if (!this.isEncrypted(value)) {
			return value;
		}
		let mod = this._load();
		if (!mod) {
			throw new Error("OSKeyStore unavailable but stored value is encrypted");
		}
		return mod.decrypt(value.slice(this._prefix.length));
	}
};
