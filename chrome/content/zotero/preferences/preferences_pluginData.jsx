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


"use strict";

var { AddonManager } = ChromeUtils.importESModule(
	"resource://gre/modules/AddonManager.sys.mjs");
var { PluginUUID } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/uuid.mjs");
var { PluginInfo } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/info.mjs");
var { PluginPrefs } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/prefs.mjs");
var { PluginFileAccess, PersistedGrantLayer } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/fileAccess.mjs");
var { PathIdentity } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/filePath.mjs");
var { FileIO } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/fileIO.mjs");
var { PluginSandbox } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/sandbox.mjs");
var { VarCheck } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/utils.mjs");

var React = require("react");
var ReactDOM = require("react-dom");
var VirtualizedTable = require("components/virtualized-table");
var { makeRowRenderer } = VirtualizedTable;

const PARENT_PANE_ID = 'zotero-prefpane-plugin-data';
const EDIT_PANE_ID = 'zotero-subpane-plugin-data-edit';
const EDIT_PANE_CONTENT_SELECTOR = '#zotero-subpane-plugin-data-edit-content';

function formatSize(bytes) {
	if (!bytes) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	let i = 0;
	let v = bytes;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return v.toFixed(v < 10 && i > 0 ? 1 : 0) + " " + units[i];
}

// Standard yes/cancel confirmation. Returns true when the user confirms.
async function confirmPrompt({ titleKey, bodyKey, actionKey, args }) {
	let [title, body, label] = await Promise.all([
		document.l10n.formatValue(titleKey),
		document.l10n.formatValue(bodyKey, args),
		document.l10n.formatValue(actionKey),
	]);
	let ps = Services.prompt;
	let flags = (ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL)
		+ ps.BUTTON_POS_1_DEFAULT;
	return ps.confirmEx(window, title, body, flags, label, "", "", null, {}) === 0;
}

function renderNameCell(row, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className}`;
	let text = document.createElement('span');
	text.className = 'cell-text';
	text.textContent = row.name;
	cell.appendChild(text);
	cell.title = row.pluginID || row.uuid;
	return cell;
}

function renderPrefNameCell(row, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className}`;
	if (row.isModified) cell.classList.add('pref-modified');
	let text = document.createElement('span');
	text.className = 'cell-text';
	text.textContent = row.name;
	cell.appendChild(text);
	cell.title = row.fullKey;
	return cell;
}

// getPrefType is identical on both branches, so probing the default
// branch is the only way to distinguish "has default" from "user only".
function prefHasDefault(defaultBranch, name) {
	if (!defaultBranch) return false;
	try {
		switch (defaultBranch.getPrefType(name)) {
			case defaultBranch.PREF_BOOL: defaultBranch.getBoolPref(name); return true;
			case defaultBranch.PREF_INT: defaultBranch.getIntPref(name); return true;
			case defaultBranch.PREF_STRING: defaultBranch.getStringPref(name); return true;
			default: return false;
		}
	}
	catch {
		return false;
	}
}

Zotero_Preferences.PluginData = {
	_rows: [],
	_tree: null,
	_editTarget: null,
	_editLayer: null,
	_editGrants: [],
	_editGrantsTree: null,
	_editPrefs: [],
	_editPrefsTree: null,

	init: async function () {
		// VirtualizedTable column headers go through Zotero.getString (.properties only),
		// so resolve FTL keys up front and pass the values as labels.
		this._labels = Object.fromEntries(await Promise.all([
			"preferences-plugin-data-col-plugin",
			"preferences-plugin-data",
			"preferences-plugin-data-grants-heading",
			"preferences-plugin-data-edit-prefs-heading",
			"preferences-plugin-data-col-status",
			"preferences-plugin-data-col-settings",
			"preferences-plugin-data-status-legacy",
			"preferences-plugin-data-status-legacy-disabled",
			"preferences-plugin-data-status-legacy-uninstalled",
			"preferences-plugin-data-status-enabled",
			"preferences-plugin-data-status-disabled",
			"preferences-plugin-data-status-uninstalled",
			"preferences-plugin-data-unknown",
			"preferences-plugin-data-pref-name",
			"preferences-plugin-data-pref-value",
			"preferences-plugin-data-grant-path",
			"preferences-plugin-data-grant-access",
			"preferences-plugin-data-grant-read",
			"preferences-plugin-data-grant-write",
			"preferences-plugin-data-grant-deny",
			"preferences-plugin-data-col-data",
		].map(async key => [key, await document.l10n.formatValue(key) || key])));

		let pane = document.getElementById(PARENT_PANE_ID);
		pane.addEventListener('showing', () => this.refresh());

		this._pluginObserver = {
			install: () => this._scheduleRefresh(),
			uninstall: () => this._scheduleRefresh(),
			startup: () => this._scheduleRefresh(),
			shutdown: () => this._scheduleRefresh(),
		};
		Zotero.Plugins.addObserver(this._pluginObserver);
		pane.addEventListener('unload', () => {
			if (this._pluginObserver) {
				Zotero.Plugins.removeObserver(this._pluginObserver);
				this._pluginObserver = null;
			}
			if (this._refreshTimer) {
				clearTimeout(this._refreshTimer);
				this._refreshTimer = null;
			}
		}, { once: true });

		await this.refresh();
	},

	_scheduleRefresh: function () {
		if (this._refreshTimer) return;
		this._refreshTimer = setTimeout(() => {
			this._refreshTimer = null;
			this.refresh().catch(e => Zotero.logError(e));
		}, 200);
	},

	refresh: async function () {
		let generation = this._refreshGeneration = (this._refreshGeneration || 0) + 1;
		let uuid = this._selectedRow()?.uuid;
		let rows = await this._collectRows();
		if (generation !== this._refreshGeneration) return;
		this._rows = rows;
		await this._renderTable();
		if (uuid) {
			let index = this._rows.findIndex(row => row.uuid === uuid);
			if (index === -1) this._tree.selection.clearSelection();
			else this._tree.selection.select(index);
		}
		this._updatePluginActions();
	},

	_collectRows: async function () {
		let byUUID = new Map();
		let addons = await AddonManager.getAddonsByTypes(["extension"]);
		for (let addon of addons) {
			let uuid = PluginUUID.getByID(addon.id);
			let scope = PluginSandbox.getScope(addon.id);
			let permissions = scope?.PERMISSIONS
				|| VarCheck.resolvePermissions(addon.installPermissions.permissions);
			let legacy = VarCheck.isPrivilegedPermission(addon);
			PluginInfo.record(addon.id, { name: addon.name, legacy });
			byUUID.set(uuid, {
				name: addon.name || addon.id,
				legacy,
				pluginID: addon.id,
				permissions,
				enabled: addon.isActive,
				statusText: this._labels[legacy
					? (addon.isActive ? "preferences-plugin-data-status-legacy" : "preferences-plugin-data-status-legacy-disabled")
					: (addon.isActive ? "preferences-plugin-data-status-enabled" : "preferences-plugin-data-status-disabled")],
			});
		}

		let orphans = new Set();
		let addIfOrphan = uuid => !byUUID.has(uuid) && orphans.add(uuid);
		for (let { uuid } of PluginInfo.list()) addIfOrphan(uuid);
		for (let uuid of PluginFileAccess.listFileAccessUUIDs()) addIfOrphan(uuid);
		for (let uuid of await this._listSubdirs("plugin-data")) addIfOrphan(uuid);
		for (let uuid of orphans) {
			let info = PluginInfo.get(uuid);
			let legacy = info?.legacy === true;
			byUUID.set(uuid, {
				name: info?.name || this._labels["preferences-plugin-data-unknown"],
				legacy,
				pluginID: null,
				permissions: [],
				enabled: false,
				statusText: this._labels[legacy
					? "preferences-plugin-data-status-legacy-uninstalled"
					: "preferences-plugin-data-status-uninstalled"],
			});
		}

		let sizeByUUID = new Map(await Promise.all(
			[...byUUID].map(async ([uuid, info]) => {
				if (info.legacy) return [uuid, 0];
				return [uuid, await PluginFileAccess.getDataDirSizeByUUID(uuid)];
			})
		));

		let rows = [];
		for (let [uuid, info] of byUUID) {
			let dataSize = sizeByUUID.get(uuid);
			rows.push({
				uuid,
				...info,
				settingsText: info.legacy
					? "—"
					: String(Services.prefs.getBranch(PluginPrefs.getBranch(uuid)).getChildList("").length),
				dataText: info.legacy ? "—" : formatSize(dataSize),
			});
		}
		// Plugin type, installation state, enabled state, then name.
		rows.sort((a, b) => Number(a.legacy) - Number(b.legacy)
			|| Number(!a.pluginID) - Number(!b.pluginID)
			|| Number(!a.enabled) - Number(!b.enabled)
			|| a.name.localeCompare(b.name) || a.uuid.localeCompare(b.uuid));
		return rows;
	},

	_listSubdirs: async function (dir) {
		let root = PathUtils.join(Zotero.DataDirectory.dir, dir);
		let out = [];
		try {
			for (let entry of await IOUtils.getChildren(root)) {
				let info;
				try {
					info = await IOUtils.stat(entry);
				}
				catch {
					continue;
				}
				if (info.type === "directory") out.push(PathUtils.filename(entry));
			}
		}
		catch {}
		return out;
	},

	_renderTable: async function () {
		document.getElementById("plugin-data-empty").hidden = !!this._rows.length;
		if (this._tree) {
			this._tree.invalidate();
			if ([...this._tree.selection.selected].some(i => i >= this._rows.length)) {
				this._tree.selection.clearSelection();
			}
			this._updatePluginActions();
			return;
		}

		const columns = [
			{
				dataKey: "name",
				label: this._labels["preferences-plugin-data-col-plugin"],
				flex: 1,
				renderCell: (index, _data, column) => renderNameCell(this._rows[index], column),
			},
			{
				dataKey: "statusText",
				label: this._labels["preferences-plugin-data-col-status"],
				fixedWidth: true,
				width: 140,
			},
			{
				dataKey: "dataText",
				label: this._labels["preferences-plugin-data-col-data"],
				fixedWidth: true,
				width: 100,
			},
			{
				dataKey: "settingsText",
				label: this._labels["preferences-plugin-data-col-settings"],
				fixedWidth: true,
				width: 70,
			},
		];
		let renderRow = makeRowRenderer(index => this._rows[index]);
		await new Promise((resolve) => {
			ReactDOM.createRoot(document.getElementById("plugin-data-table"))
				.render(
					<VirtualizedTable
						getRowCount={() => this._rows.length}
						id="plugin-data-vtable"
						label={this._labels["preferences-plugin-data"]}
						ref={(ref) => {
							this._tree = ref;
							resolve();
						}}
						renderItem={(index, ...args) => {
							let row = renderRow(index, ...args);
							row.classList.toggle("legacy-plugin", this._rows[index].legacy);
							row.setAttribute("aria-disabled", this._rows[index].legacy);
							return row;
						}}
						isSelectable={index => !this._rows[index].legacy}
						showHeader={true}
						columns={columns}
						staticColumns={true}
						disableFontSizeScaling={true}
						getRowString={index => this._rows[index].name}
						onActivate={(_event, indices) => {
							if (!indices.some(index => this._rows[index]?.legacy)) this._openSelected();
						}}
						onSelectionChange={() => this._updatePluginActions()}
					/>
				);
		});
		this._updatePluginActions();
	},

	_updatePluginActions: function () {
		let row = this._selectedRow();
		document.getElementById("plugin-data-manage").disabled = !row || row.legacy;
	},

	_selectedRow: function () {
		if (!this._tree?.selection.count) return null;
		let idx = this._tree.selection.focused;
		if (idx < 0 || idx >= this._rows.length) return null;
		return this._rows[idx];
	},

	_openSelected: function () {
		let row = this._selectedRow();
		if (!row || row.legacy) return;
		if (this._editTarget?.uuid !== row.uuid) {
			this._editPrefsTree?.selection.clearSelection();
			this._editGrantsTree?.selection.clearSelection();
		}
		this._editTarget = { ...row };
		Zotero_Preferences.navigateToPane(EDIT_PANE_ID);
	},

	initEditPane: async function () {
		await this._refreshEditPane();
		document.querySelector(EDIT_PANE_CONTENT_SELECTOR)
			.addEventListener('showing', () => this._refreshEditPane());
	},

	_refreshEditPane: async function () {
		if (!this._editTarget) {
			Zotero_Preferences.navigateToPane(PARENT_PANE_ID);
			return;
		}
		let { uuid, name, pluginID } = this._editTarget;
		this._editLayer = new PersistedGrantLayer(uuid);

		// Override the auto-prepended <h1> (from rawLabel) with the plugin name.
		let h1 = document.querySelector(`${EDIT_PANE_CONTENT_SELECTOR} > h1`);
		if (h1) h1.textContent = name;

		await this._refreshStatusBanner(pluginID);
		await this._refreshAccessSection(pluginID);
		await this._refreshDirSection({
			dir: PluginFileAccess.getDataDirByUUID(uuid),
			size: () => PluginFileAccess.getDataDirSizeByUUID(uuid),
			dirID: "plugin-data-edit-data-dir",
			emptyID: "plugin-data-edit-data-empty",
			actionsID: "plugin-data-edit-data-actions",
		});
		await this._renderEditGrants();
		await this._renderEditPrefs();
	},

	_refreshStatusBanner: async function (pluginID) {
		let addon = pluginID ? await AddonManager.getAddonByID(pluginID) : null;
		let state = !addon ? 'uninstalled' : (addon.isActive ? 'enabled' : 'disabled');
		let banner = document.getElementById("plugin-data-edit-status");
		let text = document.getElementById("plugin-data-edit-status-text");
		if (state === 'enabled') {
			banner.hidden = true;
			text.removeAttribute('data-l10n-id');
			return;
		}
		document.l10n.setAttributes(text,
			state === 'disabled'
				? 'preferences-plugin-data-edit-status-disabled'
				: 'preferences-plugin-data-edit-status-uninstalled');
		banner.hidden = false;
	},

	_refreshAccessSection: async function (pluginID) {
		let addon = pluginID ? await AddonManager.getAddonByID(pluginID) : null;
		let section = document.getElementById("plugin-data-access");
		section.hidden = !addon;
		if (!addon) return;
		let scope = PluginSandbox.getScope(pluginID);
		let permissions = scope?.PERMISSIONS || VarCheck.resolvePermissions(addon.installPermissions.permissions);
		let capabilities = permissions.filter(permission => permission !== "default"
			&& !(permission === "dataRead" && permissions.includes("dataWrite"))
			&& !(permission === "fileSystemRead" && permissions.includes("fileSystemWrite"))
			&& !(permissions.includes("ui") && ["itemTree",
				"itemPane",
				"menu",
				"button",
				"shortcut",
				"windowResource",
				"reader",
				"preferencePane",
				"userPrompt",
				"window",
				"tab"].includes(permission)));
		let labels = await Promise.all(capabilities.map(permission => document.l10n.formatValue(
			`preferences-plugin-data-capability-${permission}`)));
		// Network access comes from host_permissions, not a separate API permission.
		if (addon.installPermissions.origins?.length) {
			labels.push(await document.l10n.formatValue("preferences-plugin-data-capability-network"));
		}
		let list = document.getElementById("plugin-data-capabilities");
		list.replaceChildren();
		if (!labels.length) labels.push(await document.l10n.formatValue("preferences-plugin-data-access-basic"));
		for (let label of labels) {
			let item = document.createElement("li");
			item.textContent = label;
			list.appendChild(item);
		}
	},

	_refreshDirSection: async function ({ dir, size, dirID, emptyID, actionsID }) {
		let exists = await FileIO.exists(dir);
		let bytes = exists ? await size() : 0;
		document.getElementById(dirID).textContent = formatSize(bytes);
		document.getElementById(dirID).setAttribute("tooltiptext", PathIdentity.toNative(dir));
		document.getElementById(dirID).hidden = !exists;
		document.getElementById(emptyID).hidden = exists;
		document.getElementById(actionsID).hidden = !exists;
		document.getElementById("plugin-data-data-dir-clear").disabled = !bytes;
	},

	_renderEditGrants: async function () {
		let selected = this._selectedGrant();
		let grants = this._editLayer.list().sort((a, b) => a.path.localeCompare(b.path) || a.mode.localeCompare(b.mode));
		this._editGrants = grants.map(grant => ({
			...grant,
			canonicalPath: grant.path,
			path: PathIdentity.toNative(grant.path),
			access: this._labels[`preferences-plugin-data-grant-${grant.mode}`],
		}));
		let hasGrants = this._editGrants.length > 0;
		document.getElementById("plugin-data-grants-container").hidden = !hasGrants;
		document.getElementById("plugin-data-grants-empty").hidden = hasGrants;
		document.getElementById("plugin-data-grants-remove-all").disabled = !hasGrants;
		if (this._editGrantsTree) {
			this._editGrantsTree.invalidate();
			let index = selected ? this._editGrants.findIndex(grant => grant.canonicalPath === selected.canonicalPath && grant.mode === selected.mode) : -1;
			if (index === -1) this._editGrantsTree.selection.clearSelection();
			else this._editGrantsTree.selection.select(index);
			this._updateGrantActions();
			await this._fitTable("plugin-data-grants-container", this._editGrants.length);
			return;
		}
		const columns = [
			{ dataKey: "path", label: this._labels["preferences-plugin-data-grant-path"], flex: 1 },
			{ dataKey: "access", label: this._labels["preferences-plugin-data-grant-access"], fixedWidth: true, width: 100 },
		];
		await new Promise((resolve) => {
			ReactDOM.createRoot(document.getElementById("plugin-data-grants-table")).render(
				<VirtualizedTable
					getRowCount={() => this._editGrants.length}
					id="plugin-data-grants-vtable"
					label={this._labels["preferences-plugin-data-grants-heading"]}
					ref={(ref) => {
						this._editGrantsTree = ref; resolve();
					}}
					renderItem={makeRowRenderer(index => this._editGrants[index])}
					showHeader={true}
					columns={columns}
					staticColumns={true}
					disableFontSizeScaling={true}
					getRowString={index => this._editGrants[index].path}
					onSelectionChange={() => this._updateGrantActions()}
				/>
			);
		});
		this._updateGrantActions();
		await this._fitTable("plugin-data-grants-container", this._editGrants.length);
	},

	_selectedGrant: function () {
		return this._editGrantsTree?.selection.count
			? this._editGrants[this._editGrantsTree.selection.focused]
			: null;
	},

	_updateGrantActions: function () {
		document.getElementById("plugin-data-grants-remove").disabled = !this._selectedGrant();
	},

	removeSelectedGrant: async function () {
		let grant = this._selectedGrant();
		if (!grant) return;
		this._editLayer.remove(entry => entry.path === grant.canonicalPath && entry.mode === grant.mode);
		await this._renderEditGrants();
		await this.refresh();
	},

	_fitTable: async function (containerID, count) {
		await new Promise(resolve => window.requestAnimationFrame(resolve));
		let container = document.getElementById(containerID);
		if (container.hidden) return;
		let row = container.querySelector(".row");
		let header = container.querySelector(".virtualized-table-header");
		if (!row || !header) return;
		let rowHeight = row.getBoundingClientRect().height;
		let headerHeight = header.getBoundingClientRect().height;
		// A newly loaded subpane is still hidden. Its showing event will size it.
		if (!rowHeight || !headerHeight) return;
		let bodyStyle = window.getComputedStyle(container.querySelector(".virtualized-table-body"));
		let padding = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
		container.style.height = Math.min(220, Math.ceil(headerHeight + rowHeight * count + padding + 2)) + "px";
	},

	// Prefs live under the plugin's branch (see setupPreferences in xpcom/plugins/globals.mjs)
	_renderEditPrefs: async function () {
		let prefPrefix = PluginPrefs.getBranch(this._editTarget.uuid);
		let rootBranch = Services.prefs.getBranch("");
		let userBranch = Services.prefs.getBranch(prefPrefix);
		let defaultBranch;
		try {
			defaultBranch = Services.prefs.getDefaultBranch(prefPrefix);
		}
		catch {}

		let keys = new Set(userBranch.getChildList(""));

		let selectedName = this._selectedPref()?.name;

		this._editPrefs = [...keys].sort().map((name) => {
			let fullKey = prefPrefix + name;
			let prefType = rootBranch.getPrefType(fullKey);
			let typeText, value;
			try {
				switch (prefType) {
					case rootBranch.PREF_BOOL:
						value = rootBranch.getBoolPref(fullKey);
						typeText = "boolean";
						break;
					case rootBranch.PREF_INT:
						value = rootBranch.getIntPref(fullKey);
						typeText = "number";
						break;
					case rootBranch.PREF_STRING:
						value = rootBranch.getStringPref(fullKey);
						typeText = "string";
						break;
					default:
						value = "";
						typeText = "unknown";
				}
			}
			catch (e) {
				Zotero.logError(e);
				value = "";
				typeText = "unknown";
			}
			let isModified = rootBranch.prefHasUserValue(fullKey);
			let defaulted = prefHasDefault(defaultBranch, name);
			return {
				name,
				fullKey,
				prefType,
				typeText,
				value,
				valueText: typeText === "boolean" ? (value ? "true" : "false") : String(value),
				isModified,
				hasDefault: defaulted,
			};
		});

		let hasPrefs = this._editPrefs.length > 0;
		document.getElementById("plugin-data-prefs-reset-all").disabled = !this._editPrefs.some(row => row.isModified && row.hasDefault);
		document.getElementById("plugin-data-prefs-container").hidden = !hasPrefs;
		document.getElementById("plugin-data-prefs-empty").hidden = hasPrefs;

		if (this._editPrefsTree) {
			this._editPrefsTree.invalidate();
			let index = this._editPrefs.findIndex(row => row.name === selectedName);
			if (index === -1) this._editPrefsTree.selection.clearSelection();
			else this._editPrefsTree.selection.select(index);
			this._updatePrefActions();
			await this._fitTable("plugin-data-prefs-container", this._editPrefs.length);
			return;
		}

		const columns = [
			{
				dataKey: "name",
				label: this._labels["preferences-plugin-data-pref-name"],
				flex: 2,
				renderCell: (index, _data, column) => renderPrefNameCell(this._editPrefs[index], column),
			},
			{ dataKey: "valueText", label: this._labels["preferences-plugin-data-pref-value"], flex: 3 },
		];
		await new Promise((resolve) => {
			ReactDOM.createRoot(document.getElementById("plugin-data-prefs-table"))
				.render(
					<VirtualizedTable
						getRowCount={() => this._editPrefs.length}
						id="plugin-data-prefs-vtable"
						label={this._labels["preferences-plugin-data-edit-prefs-heading"]}
						ref={(ref) => {
							this._editPrefsTree = ref;
							resolve();
						}}
						renderItem={makeRowRenderer(index => this._editPrefs[index])}
						showHeader={true}
						columns={columns}
						staticColumns={true}
						disableFontSizeScaling={true}
						getRowString={index => this._editPrefs[index].name}
						onSelectionChange={() => this._updatePrefActions()}
						onActivate={() => this.editSelectedPref()}
					/>
				);
		});
		this._updatePrefActions();
		await this._fitTable("plugin-data-prefs-container", this._editPrefs.length);
	},

	_selectedPref: function () {
		return this._editPrefsTree?.selection.count
			? this._editPrefs[this._editPrefsTree.selection.focused]
			: null;
	},

	_updatePrefActions: function () {
		let row = this._selectedPref();
		let edit = document.getElementById("plugin-data-prefs-edit");
		edit.disabled = !row || row.typeText === "unknown";
		document.l10n.setAttributes(edit, row?.typeText === "boolean"
			? "preferences-plugin-data-prefs-toggle-button"
			: "preferences-plugin-data-prefs-edit-button");
		let reset = document.getElementById("plugin-data-prefs-reset");
		reset.disabled = !row?.isModified || !row.hasDefault;
		document.getElementById("plugin-data-prefs-delete").disabled = !row;
	},

	editSelectedPref: async function () {
		let row = this._selectedPref();
		if (!row || row.typeText === "unknown") return;
		if (row.typeText === "boolean") {
			await this._togglePref(row.fullKey);
			return;
		}
		let title = await document.l10n.formatValue("preferences-plugin-data-prefs-edit-title");
		let value = { value: row.valueText };
		if (Services.prompt.prompt(window, title, row.name, value, null, { value: false })) {
			await this._commitPrefEdit(row.fullKey, value.value);
		}
	},

	resetSelectedPref: async function () {
		let row = this._selectedPref();
		if (row?.isModified && row.hasDefault) await this._clearPref(row.fullKey);
	},

	deleteSelectedPref: async function () {
		let row = this._selectedPref();
		if (!row) return;
		let prefs = Services.prefs.getBranch("");
		let defaults = Services.prefs.getDefaultBranch("");
		try {
			// Gecko only exposes branch deletion. Preserve other settings in that
			// branch so deleting "foo" never deletes "foo.bar" as well.
			let prefix = row.fullKey.endsWith(".") ? row.fullKey : row.fullKey + ".";
			let affected = new Set(prefs.getChildList(prefix));
			affected.add(prefix.slice(0, -1));
			let saved = [];
			for (let name of affected) {
				if (name === row.fullKey) continue;
				for (let branch of [defaults, prefs]) {
					if (branch === defaults ? !prefHasDefault(defaults, name) : !prefs.prefHasUserValue(name)) continue;
					let type = branch.getPrefType(name);
					let kind = type === prefs.PREF_BOOL
						? "BoolPref"
						: type === prefs.PREF_INT ? "IntPref" : "StringPref";
					saved.push({ branch, name, kind, value: branch["get" + kind](name) });
				}
			}
			try {
				prefs.deleteBranch(row.fullKey);
			}
			finally {
				for (let { branch, name, kind, value } of saved) {
					try {
						branch["set" + kind](name, value);
					}
					catch (e) {
						Zotero.logError(e);
					}
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		await this._renderEditPrefs();
		await this.refresh();
	},

	_togglePref: async function (fullKey) {
		let rootBranch = Services.prefs.getBranch("");
		try {
			rootBranch.setBoolPref(fullKey, !rootBranch.getBoolPref(fullKey));
		}
		catch (e) {
			Zotero.logError(e);
		}
		await this._renderEditPrefs();
	},

	_commitPrefEdit: async function (fullKey, text) {
		let rootBranch = Services.prefs.getBranch("");
		let prefType = rootBranch.getPrefType(fullKey);
		try {
			if (prefType === rootBranch.PREF_INT) {
				let trimmed = text.trim();
				let n = parseInt(trimmed);
				// Reject decimals or trailing garbage; the re-render below
				// keeps the previously-stored value.
				if (!Number.isFinite(n) || String(n) !== trimmed) {
					Services.prompt.alert(window,
						await document.l10n.formatValue("preferences-plugin-data-prefs-edit-title"),
						await document.l10n.formatValue("preferences-plugin-data-prefs-number-invalid"));
					return;
				}
				rootBranch.setIntPref(fullKey, n);
			}
			else {
				rootBranch.setStringPref(fullKey, text);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		await this._renderEditPrefs();
	},

	_clearPref: async function (fullKey) {
		try {
			Services.prefs.getBranch("").clearUserPref(fullKey);
		}
		catch (e) {
			Zotero.logError(e);
		}
		await this._renderEditPrefs();
		await this.refresh();
	},

	addEditPref: async function () {
		if (!this._editTarget) return;
		let prefPrefix = PluginPrefs.getBranch(this._editTarget.uuid);
		let rootBranch = Services.prefs.getBranch("");

		let [title, nameMsg, nameInvalid, nameExists, typeMsg, valMsg] = await Promise.all([
			document.l10n.formatValue("preferences-plugin-data-prefs-add-title"),
			document.l10n.formatValue("preferences-plugin-data-prefs-add-name"),
			document.l10n.formatValue("preferences-plugin-data-prefs-add-name-invalid"),
			document.l10n.formatValue("preferences-plugin-data-prefs-add-exists"),
			document.l10n.formatValue("preferences-plugin-data-prefs-add-type"),
			document.l10n.formatValue("preferences-plugin-data-prefs-add-value"),
		]);

		let nameResult = { value: "" };
		if (!Services.prompt.prompt(window, title, nameMsg, nameResult, null, { value: false })) return;
		let name = nameResult.value.trim();
		if (!name) {
			Services.prompt.alert(window, title, nameInvalid);
			return;
		}
		let fullKey = prefPrefix + name;
		if (rootBranch.getPrefType(fullKey) !== rootBranch.PREF_INVALID) {
			Services.prompt.alert(window, title, nameExists);
			return;
		}

		let typeLabels = ["string", "number", "boolean"];
		let typeIdx = { value: 0 };
		if (!Services.prompt.select(window, title, typeMsg, typeLabels, typeIdx)) return;
		let type = typeLabels[typeIdx.value];

		let valResult = {
			value: type === "boolean" ? "false" : (type === "number" ? "0" : ""),
		};
		if (!Services.prompt.prompt(window, title, valMsg, valResult, null, { value: false })) return;

		try {
			if (type === "boolean") {
				rootBranch.setBoolPref(fullKey, valResult.value.trim().toLowerCase() === "true");
			}
			else if (type === "number") {
				let n = parseInt(valResult.value.trim());
				if (!Number.isFinite(n)) return;
				rootBranch.setIntPref(fullKey, n);
			}
			else {
				rootBranch.setStringPref(fullKey, valResult.value);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		await this._renderEditPrefs();
		await this.refresh();
	},

	// Only resets prefs that have defaults -- leaves user-only prefs alone.
	resetAllEditPrefs: async function () {
		if (!this._editTarget) return;
		let confirmed = await confirmPrompt({
			titleKey: "preferences-plugin-data-prefs-reset-all-confirm-title",
			bodyKey: "preferences-plugin-data-prefs-reset-all-confirm-body",
			actionKey: "preferences-plugin-data-prefs-reset-all-confirm-action",
			args: {},
		});
		if (!confirmed) return;

		let prefPrefix = PluginPrefs.getBranch(this._editTarget.uuid);
		let rootBranch = Services.prefs.getBranch("");
		let userBranch = Services.prefs.getBranch(prefPrefix);
		let defaultBranch;
		try {
			defaultBranch = Services.prefs.getDefaultBranch(prefPrefix);
		}
		catch {}

		for (let name of userBranch.getChildList("")) {
			let fullKey = prefPrefix + name;
			if (!rootBranch.prefHasUserValue(fullKey)) continue;
			if (!prefHasDefault(defaultBranch, name)) continue;
			try {
				rootBranch.clearUserPref(fullKey);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		await this._renderEditPrefs();
		await this.refresh();
	},

	showEditDir: function () {
		if (!this._editTarget) return;
		try {
			Zotero.File.reveal(PluginFileAccess.getDataDirByUUID(this._editTarget.uuid));
		}
		catch (e) {
			Zotero.logError(e);
		}
	},

	clearEditDir: async function () {
		if (!this._editTarget) return;
		let confirmed = await confirmPrompt({
			titleKey: "preferences-plugin-data-clear-folder-confirm-title",
			bodyKey: "preferences-plugin-data-clear-folder-confirm-body",
			actionKey: "preferences-plugin-data-clear-folder-confirm-action",
			args: { name: this._editTarget.name },
		});
		if (!confirmed) return;
		await PluginFileAccess.clearDataDirByUUID(this._editTarget.uuid);
		await this._refreshEditPane();
		await this.refresh();
	},

	addEditGrant: async function (type = 'file') {
		if (!this._editTarget) return;
		let path = await this._pickPath(type);
		if (!path) return;
		let mode = await this._pickGrantMode();
		if (!mode) return;
		this._editLayer.add({ path, mode });
		await this._renderEditGrants();
		await this.refresh();
	},

	removeAllEditGrants: async function () {
		if (!this._editTarget || !this._editLayer) return;
		if (!this._editLayer.list().length) return;
		let confirmed = await confirmPrompt({
			titleKey: "preferences-plugin-data-grants-remove-all-confirm-title",
			bodyKey: "preferences-plugin-data-grants-remove-all-confirm-body",
			actionKey: "preferences-plugin-data-grants-remove-all-confirm-action",
			args: {},
		});
		if (!confirmed) return;
		this._editLayer.clear();
		await this._renderEditGrants();
		await this.refresh();
	},

	_pickPath: async function (type) {
		let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
		let pickerMode = type === 'folder'
			? Ci.nsIFilePicker.modeGetFolder
			: Ci.nsIFilePicker.modeOpen;
		fp.init(window.browsingContext, "", pickerMode);
		return new Promise((resolve) => {
			fp.open((rv) => {
				resolve(rv === Ci.nsIFilePicker.returnOK ? fp.file.path : null);
			});
		});
	},

	_pickGrantMode: async function () {
		let [title, label] = await Promise.all([
			document.l10n.formatValue("preferences-plugin-data-add-grant-mode-title"),
			document.l10n.formatValue("preferences-plugin-data-add-grant-mode-label"),
		]);
		let modes = ["read", "write", "deny"];
		let labels = await Promise.all(modes.map(mode => document.l10n.formatValue(
			`preferences-plugin-data-grant-mode-${mode}`)));
		let selected = { value: 0 };
		let ok = Services.prompt.select(window, title, label, labels, selected);
		return ok ? modes[selected.value] : null;
	},

	removeAllForPlugin: async function () {
		if (!this._editTarget) return;
		if (!await this._confirmRemoveAll(this._editTarget.name)) return;
		await this._wipePluginData(this._editTarget);
		await this.refresh();
		Zotero_Preferences.navigateToPane(PARENT_PANE_ID);
	},

	_confirmRemoveAll: function (name) {
		return confirmPrompt({
			titleKey: "preferences-plugin-data-edit-remove-all-confirm-title",
			bodyKey: "preferences-plugin-data-edit-remove-all-confirm-body",
			actionKey: "preferences-plugin-data-edit-remove-all-confirm-action",
			args: { name },
		});
	},

	_wipePluginData: async function ({ uuid, pluginID }) {
		// clearFileAccess removes the pref entry entirely; layer.clear()
		// would just leave an empty list behind.
		PluginFileAccess.clearFileAccess(uuid);
		await PluginFileAccess.deleteDataDirByUUID(uuid);
		let prefBranch = Services.prefs.getBranch(PluginPrefs.getBranch(uuid));
		for (let key of prefBranch.getChildList("")) {
			try {
				prefBranch.clearUserPref(key);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		// Keep the UUID→name pref for active plugins so the name still
		// renders until the next load re-registers it.
		let addon = pluginID ? await AddonManager.getAddonByID(pluginID) : null;
		if (!addon?.isActive) PluginInfo.forget(uuid);
	},
};
