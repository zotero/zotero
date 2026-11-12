/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

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


/**
 * @typedef {RequestAPIConfig & { commands?: Record<string, RequestDef> }} ControllerAPIConfig
 *     - `commands` are requests with side effects, defined on set
 */


import { RequestAPIBase } from "chrome://zotero/content/xpcom/pluginAPI/requestAPIBase.mjs";


/**
 * Controller-style API: plugins drive Zotero through named query/command requests, each done in one call
 */
class ControllerAPIBase extends RequestAPIBase {
	_config = {
		apiName: "ControllerAPIBase",
		permissions: [],
	};

	/**
	 * @type {Map<string, RequestDef>}
	 */
	_commands = new Map();

	/**
	 * Requests under `queries` and `commands` are defined as the config is set
	 * @param {ControllerAPIConfig} config
	 */
	set config(config) {
		let { commands = {}, ...rest } = config;
		super.config = rest;
		for (let [name, def] of Object.entries(commands)) {
			this._define(this._commands, name, def);
		}
	}

	/**
	 * Run a request with side effects
	 * @param {string} name
	 * @param {object} [params]
	 * @param {string} [callerPluginID] - Injected for sandbox callers; omitted by chrome
	 * @returns {Promise<APIResponse>}
	 */
	command(name, params = {}, callerPluginID) {
		return this._invoke(this._commands, "command", name, params, callerPluginID);
	}

	/**
	 * @returns {{ queries: string[], commands: string[] }}
	 */
	get requestNames() {
		return {
			queries: Array.from(this._queries.keys()),
			commands: Array.from(this._commands.keys()),
		};
	}
}

export { ControllerAPIBase };
