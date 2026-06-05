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


import { PluginUUID } from "chrome://zotero/content/xpcom/plugins/uuid.mjs";


const PREF_PREFIX = "extensions.zotero.pluginNames.";

const PluginNames = {
	record(pluginID, name) {
		if (!pluginID || typeof name !== "string" || !name) return;
		let uuid = PluginUUID.getByID(pluginID);
		Zotero.Prefs.set(PREF_PREFIX + uuid, name, true);
	},

	get(uuid) {
		if (!uuid) return null;
		return Zotero.Prefs.get(PREF_PREFIX + uuid, true) || null;
	},

	list() {
		let uuids = Services.prefs.getBranch(PREF_PREFIX).getChildList("");
		let out = [];
		for (let uuid of uuids) {
			let name = Zotero.Prefs.get(PREF_PREFIX + uuid, true);
			if (name) out.push({ uuid, name });
		}
		return out;
	},

	forget(uuid) {
		Zotero.Prefs.clear(PREF_PREFIX + uuid, true);
	},
};

export { PluginNames };
