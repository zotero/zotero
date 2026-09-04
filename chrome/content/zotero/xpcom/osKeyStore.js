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

	// The settings window, where credentials are usually saved from, or the main window when
	// they're saved during a sync
	_getParentWindow: function () {
		return Services.wm.getMostRecentWindow('zotero:pref')
			|| Services.wm.getMostRecentWindow('navigator:browser');
	},

	// Offer to store credentials unencrypted after a write to the keystore fails. The keystore
	// can be unusable in ways the user can't fix -- most often on Linux, where the platform
	// requires a Secret Service that some managed systems don't run.
	//
	// Returns true if the user agrees.
	confirmUnencryptedFallback: function () {
		let index = Zotero.Prompt.confirm({
			window: this._getParentWindow(),
			title: Zotero.getString('general-error'),
			text: Zotero.getString('os-keystore-save-failed') + "\n\n"
				+ Zotero.getString('os-keystore-save-unencrypted'),
			button0: Zotero.getString('os-keystore-save-unencrypted-button'),
			button1: Zotero.Prompt.BUTTON_TITLE_CANCEL,
			defaultButton: 1
		});
		return index == 0;
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
		let win = this._getParentWindow();
		if (!win) {
			return;
		}
		Zotero.alert(
			win,
			Zotero.getString('general-error'),
			Zotero.getString('os-keystore-migrate-failed')
		);
	},

	// Returns whether the store can actually be used. asyncSecretAvailable() isn't enough,
	// since a locked or inaccessible store can still report a secret.
	_usable: async function () {
		let mod = this._load();
		if (!mod) {
			return false;
		}
		try {
			await mod.encrypt('test');
		}
		catch {
			return false;
		}
		return true;
	},

	// Mozilla's OSKeyStore reports every failure as a canceled unlock prompt, whatever the
	// cause, so probe the native store to record what actually went wrong and return an error
	// with a message that can be shown to the user
	_error: async function (e, stringName) {
		let detail;
		// Make sure the label from Mozilla's module still exists
		let label = this._module && this._module.STORE_LABEL;
		if (typeof label != 'string' || !label) {
			detail = "store label unavailable";
		}
		else {
			try {
				let keyStore = Cc["@mozilla.org/security/oskeystore;1"]
					.getService(Ci.nsIOSKeyStore);
				detail = (await keyStore.asyncSecretAvailable(label))
					? "secret is available"
					: "no secret stored";
			}
			catch (probeError) {
				detail = "key store unusable: " + probeError;
			}
		}
		Zotero.debug(`OS key store failure (${detail}): ${e}`, 1);
		return new Zotero.Error(Zotero.getString(stringName), 0, { keyStoreError: e });
	},

	// Returns prefixed ciphertext. Throws if OSKeyStore is unavailable so we
	// don't silently store plaintext when a caller expects encryption.
	encrypt: async function (plaintext) {
		let mod = this._load();
		if (!mod) {
			throw new Error("OSKeyStore unavailable");
		}
		let ciphertext;
		try {
			ciphertext = await mod.encrypt(plaintext);
		}
		catch (e) {
			throw await this._error(e, 'os-keystore-save-failed');
		}
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
		// OSKeyStore.encrypt() encodes the string as UTF-8 before encrypting, but
		// OSKeyStore.decrypt() returns the decrypted bytes as a binary string, so
		// decode it here
		let binaryStr;
		try {
			binaryStr = await mod.decrypt(value.slice(this._prefix.length));
		}
		catch (e) {
			// A read can fail because the store is unusable or because the store is working
			// and the stored value just can't be decrypted with the current key. Those need
			// different advice, since fixing the store won't bring the value back.
			let stringName = (await this._usable())
				? 'os-keystore-read-unrecoverable'
				: 'os-keystore-read-failed';
			throw await this._error(e, stringName);
		}
		return new TextDecoder().decode(
			Uint8Array.from(binaryStr, char => char.charCodeAt(0))
		);
	}
};
