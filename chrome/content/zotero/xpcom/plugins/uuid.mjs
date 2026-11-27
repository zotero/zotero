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


// Generated with the DNS namespace UUID from RFC 4122 Appendix C
// uuidv5(DNS_NAMESPACE_UUID, "plugin.zotero.org");
const ZOTERO_PLUGIN_NS_UUID = "3c0b7f5a-2b95-5af5-87c8-ecf611478d41";

// pluginID -> pluginUUID, avoid recomputing
const cache = new Map();

/**
 * Compute a UUIDv5 from a namespace UUID + name (RFC 4122 §4.3).
 *
 * @param {string} namespace -- Namespace UUID (curly braces and hyphens optional)
 * @param {string} name
 * @returns {string} 36-char hyphenated UUID
 */
function uuidv5(namespace, name) {
	let nsBytes = parseUUIDBytes(namespace);
	let nameBytes = new TextEncoder().encode(name);
	let combined = new Uint8Array(nsBytes.length + nameBytes.length);
	combined.set(nsBytes, 0);
	combined.set(nameBytes, nsBytes.length);

	let ch = Cc["@mozilla.org/security/hash;1"]
		.createInstance(Ci.nsICryptoHash);
	ch.init(ch.SHA1);
	ch.update(combined, combined.length);
	let hashStr = ch.finish(false);

	// SHA-1 is 20 bytes; UUID uses the first 16
	let uuid = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		uuid[i] = hashStr.charCodeAt(i);
	}
	// Stamp version (5) and variant (10xx) bits
	uuid[6] = (uuid[6] & 0x0F) | 0x50;
	uuid[8] = (uuid[8] & 0x3F) | 0x80;

	return formatUUID(uuid);
}

function parseUUIDBytes(uuid) {
	let hex = uuid.replace(/[{}-]/g, "");
	let bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return bytes;
}

function formatUUID(bytes) {
	let hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
	return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(16, 4)}-${hex.substr(20, 12)}`;
}


const PluginUUID = {
	getByID(id) {
		if (cache.has(id)) {
			return cache.get(id);
		}
		let uuid = uuidv5(ZOTERO_PLUGIN_NS_UUID, id);
		cache.set(id, uuid);
		return uuid;
	},
};

export { PluginUUID };
