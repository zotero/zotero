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

import * as Timer from "resource://gre/modules/Timer.sys.mjs";
import { ScopeVariables } from "chrome://zotero/content/xpcom/plugins/variables.mjs";

/** Timers owned by a plugin scope, canceled when that scope unloads. */
const PluginTimers = {
	_scopes: new Map(),

	setup(scope) {
		let pluginID = scope.PLUGIN_ID;
		let timers = new Set();
		let idle = new Set();
		let state = { timers, idle, active: true };
		this._scopes.set(pluginID, state);

		function schedule(callback, delay, repeat, args) {
			if (typeof callback !== "function") throw new TypeError("Timer callback must be a function");
			let scheduleTimer = repeat ? Timer.setInterval : Timer.setTimeout;
			let id = scheduleTimer(() => {
				if (!state.active) return;
				if (!repeat) timers.delete(id);
				Reflect.apply(callback, null, args);
			}, delay);
			// Delay coercion can reenter chrome and unload the creating scope.
			if (state.active) timers.add(id);
			else Timer.clearTimeout(id);
			return id;
		}

		function clear(id) {
			if (timers.delete(id)) Timer.clearTimeout(id);
		}

		let functions = {
			setTimeout: (callback, delay, ...args) => schedule(callback, delay, false, args),
			setInterval: (callback, delay, ...args) => schedule(callback, delay, true, args),
			clearTimeout: clear,
			clearInterval: clear,
			requestIdleCallback(callback, options) {
				if (typeof callback !== "function") throw new TypeError("Idle callback must be a function");
				let id = Timer.requestIdleCallback((deadline) => {
					idle.delete(id);
					if (!state.active) return;
					Reflect.apply(callback, undefined, [ScopeVariables.toScope({
						didTimeout: deadline.didTimeout,
						timeRemaining: () => deadline.timeRemaining(),
					}, pluginID)]);
				}, options);
				if (state.active) idle.add(id);
				else Timer.cancelIdleCallback(id);
				return id;
			},
			cancelIdleCallback(id) {
				if (idle.delete(id)) Timer.cancelIdleCallback(id);
			},
		};
		for (let [name, fn] of Object.entries(functions)) {
			Cu.exportFunction((...args) => {
				if (!state.active) throw new Error("Plugin scope is no longer active");
				return fn(...args);
			}, scope, { defineAs: name });
		}
	},

	unregister(pluginID) {
		let state = this._scopes.get(pluginID);
		if (!state) return;
		this._scopes.delete(pluginID);
		state.active = false;
		for (let id of state.timers) Timer.clearTimeout(id);
		for (let id of state.idle) Timer.cancelIdleCallback(id);
		state.timers.clear();
		state.idle.clear();
	},
};

export { PluginTimers };
