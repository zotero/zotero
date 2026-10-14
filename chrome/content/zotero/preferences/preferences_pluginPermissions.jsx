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
var { PluginNames } = ChromeUtils.importESModule(
	"chrome://zotero/content/xpcom/plugins/names.mjs");
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
var { getCSSIcon } = require("components/icons");

const PARENT_PANE_ID = 'zotero-prefpane-plugin-permissions';
const EDIT_PANE_ID = 'zotero-subpane-plugin-permissions-edit';
const EDIT_PANE_CONTENT_SELECTOR = '#zotero-subpane-plugin-permissions-edit-content';

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

function renderEditCell(index, data, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className} edit-action-cell`;
	if (data.legacy) {
		let badge = document.createElement('span');
		badge.className = 'legacy-badge';
		badge.textContent = '!';
		badge.setAttribute('title', data.legacyLabel);
		badge.setAttribute('aria-label', data.legacyLabel);
		cell.appendChild(badge);
		return cell;
	}
	cell.classList.add('clickable');
	let button = document.createElement('span');
	button.className = 'icon-action';
	button.setAttribute('role', 'button');
	button.setAttribute('aria-label', data.ariaLabel);
	button.appendChild(getCSSIcon(data.iconKey));
	button.addEventListener('click', (event) => data.onClick(index, event));
	cell.appendChild(button);
	return cell;
}

function renderSizeCell(index, data, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className}`;
	if (data === '—') cell.classList.add('size-na');
	cell.textContent = data;
	return cell;
}

function renderNameCell(row, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className}`;
	if (!row.pluginID) cell.classList.add('plugin-name-uninstalled');
	cell.textContent = row.name;
	return cell;
}

function renderModeCell(index, data, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className} grant-mode-cell`;
	let pill = document.createElement('span');
	pill.className = `grant-mode mode-${data}`;
	pill.textContent = data;
	cell.appendChild(pill);
	return cell;
}

function renderPrefNameCell(row, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className} pref-name-cell`;
	if (row.isModified) cell.classList.add('pref-modified');
	cell.textContent = row.name;
	cell.setAttribute('title', row.fullKey);
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

function renderPrefValueCell(row, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className} pref-value-cell`;
	if (row.isModified) cell.classList.add('pref-modified');
	cell.classList.add(`pref-type-${row.typeText}`);

	if (row.typeText === 'boolean') {
		cell.classList.add('pref-editable');
		cell.textContent = row.valueText;
		cell.setAttribute('role', 'button');
		cell.setAttribute('aria-label', row.toggleAriaLabel);
		cell.addEventListener('click', row.onToggle);
		return cell;
	}

	let input = document.createElement('input');
	input.className = 'pref-value-input';
	input.type = 'text';
	input.value = row.valueText;
	let initial = row.valueText;
	let done = false;
	let commit = () => {
		if (done) return;
		done = true;
		if (input.value !== initial) row.onCommit(input.value);
	};
	input.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			input.blur();
		}
		else if (event.key === 'Escape') {
			event.preventDefault();
			input.value = initial;
			input.blur();
		}
	});
	input.addEventListener('blur', commit);
	for (let type of ['mousedown', 'mouseup', 'click']) {
		input.addEventListener(type, event => event.stopPropagation());
	}
	cell.appendChild(input);
	return cell;
}

Zotero_Preferences.PluginPermissions = {
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
			"preferences-plugin-permissions-col-plugin",
			"preferences-plugin-permissions-col-permissions",
			"preferences-plugin-permissions-col-prefs",
			"preferences-plugin-permissions-col-data",
			"preferences-plugin-permissions-edit-row",
			"preferences-plugin-permissions-legacy-badge",
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
		this._rows = await this._collectRows();
		await this._renderTable();
	},

	_collectRows: async function () {
		let byUUID = new Map();
		let addons = await AddonManager.getAddonsByTypes(["extension"]);
		for (let addon of addons) {
			let uuid = PluginUUID.getByID(addon.id);
			let scope = PluginSandbox.getScope(addon.id);
			let permissions = scope?.PERMISSIONS;
			let legacy = VarCheck.isPrivilegedScope(scope);
			byUUID.set(uuid, {
				name: addon.name || addon.id,
				legacy,
				pluginID: addon.id,
				permissions,
			});
		}

		let orphans = new Set();
		let addIfOrphan = uuid => !byUUID.has(uuid) && orphans.add(uuid);
		for (let { uuid } of PluginNames.list()) addIfOrphan(uuid);
		for (let uuid of PluginFileAccess.listFileAccessUUIDs()) addIfOrphan(uuid);
		for (let uuid of await this._listSubdirs("plugin-data")) addIfOrphan(uuid);
		for (let uuid of orphans) {
			byUUID.set(uuid, {
				name: PluginNames.get(uuid) || uuid,
				legacy: false,
				pluginID: null,
				permissions: [],
			});
		}

		let editAriaLabel = this._labels["preferences-plugin-permissions-edit-row"];
		let legacyLabel = this._labels["preferences-plugin-permissions-legacy-badge"];

		let sizeByUUID = new Map(await Promise.all(
			[...byUUID].map(async ([uuid, info]) => {
				if (info.legacy) return [uuid, 0];
				return [uuid, await PluginFileAccess.getDataDirSizeByUUID(uuid)];
			})
		));

		let rows = [];
		for (let [uuid, info] of byUUID) {
			let dataSize = sizeByUUID.get(uuid);
			let permissionsText;
			if (info.legacy || !info.pluginID) permissionsText = "—";
			else permissionsText = String(info.permissions?.length ?? 0);
			let prefsText;
			if (info.legacy) {
				prefsText = "—";
			}
			else {
				let keys = new Set();
				try {
					for (let k of Services.prefs.getBranch(`extensions.${uuid}.`).getChildList("")) {
						keys.add(k);
					}
				}
				catch {}
				prefsText = String(keys.size);
			}
			rows.push({
				uuid,
				name: info.name,
				legacy: info.legacy,
				pluginID: info.pluginID,
				permissions: info.permissions,
				permissionsText,
				prefsText,
				dataText: info.legacy ? "—" : formatSize(dataSize),
				edit: {
					legacy: info.legacy,
					legacyLabel,
					iconKey: "edit",
					isFocusable: true,
					ariaLabel: editAriaLabel,
					onClick: info.legacy
						? null
						: () => this._openEditFor(uuid, info.name, info.pluginID),
				},
			});
		}
		// Sink legacy rows to the bottom; alphabetical within each group.
		rows.sort((a, b) => {
			if (a.legacy !== b.legacy) return a.legacy ? 1 : -1;
			return a.name.localeCompare(b.name);
		});
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
		if (this._tree) {
			this._tree.invalidate();
			if ([...this._tree.selection.selected].some(i => i >= this._rows.length)) {
				this._tree.selection.clearSelection();
			}
			this._updateSelectionInfo();
			return;
		}

		const columns = [
			{
				dataKey: "name",
				label: this._labels["preferences-plugin-permissions-col-plugin"],
				flex: 4,
				renderCell: (index, _data, column) => renderNameCell(this._rows[index], column),
			},
			{
				dataKey: "permissionsText",
				label: this._labels["preferences-plugin-permissions-col-permissions"],
				fixedWidth: true,
				width: 100,
				renderCell: renderSizeCell,
			},
			{
				dataKey: "prefsText",
				label: this._labels["preferences-plugin-permissions-col-prefs"],
				fixedWidth: true,
				width: 60,
				renderCell: renderSizeCell,
			},
			{
				dataKey: "dataText",
				label: this._labels["preferences-plugin-permissions-col-data"],
				fixedWidth: true,
				width: 70,
				renderCell: renderSizeCell,
			},
			{
				dataKey: "edit",
				label: " ",
				htmlLabel: ' ',
				fixedWidth: true,
				width: 40,
				renderCell: renderEditCell,
			},
		];
		await new Promise((resolve) => {
			ReactDOM.createRoot(document.getElementById("plugin-permissions-table"))
				.render(
					<VirtualizedTable
						getRowCount={() => this._rows.length}
						id="plugin-permissions-vtable"
						ref={(ref) => {
							this._tree = ref;
							resolve();
						}}
						renderItem={makeRowRenderer(index => this._rows[index])}
						showHeader={true}
						columns={columns}
						staticColumns={true}
						disableFontSizeScaling={true}
						getRowString={index => this._rows[index].name}
						onActivate={() => this._openSelected()}
						onSelectionChange={() => this._updateSelectionInfo()}
					/>
				);
		});
		this._updateSelectionInfo();
	},

	_updateSelectionInfo: function () {
		let container = document.getElementById("plugin-permissions-selection-info");
		if (!container) return;
		let legacy = document.getElementById("plugin-permissions-info-legacy");
		let uninstalled = document.getElementById("plugin-permissions-info-uninstalled");
		let installed = document.getElementById("plugin-permissions-info-installed");

		let row = this._selectedRow();
		if (!row) {
			container.hidden = true;
			legacy.hidden = uninstalled.hidden = installed.hidden = true;
			return;
		}

		let mode;
		if (row.legacy) mode = 'legacy';
		else if (row.pluginID) mode = 'installed';
		else mode = 'uninstalled';
		container.hidden = false;
		legacy.hidden = mode !== 'legacy';
		uninstalled.hidden = mode !== 'uninstalled';
		installed.hidden = mode !== 'installed';
		if (mode === 'installed') {
			document.getElementById("plugin-permissions-info-permissions-text")
				.textContent = row.permissions.length ? row.permissions.join(", ") : "—";
		}
	},

	_selectedRow: function () {
		if (!this._tree?.selection.count) return null;
		let idx = this._tree.selection.focused;
		if (idx < 0 || idx >= this._rows.length) return null;
		return this._rows[idx];
	},

	_openSelected: function () {
		if (!this._tree) return;
		let idx = this._tree.selection.focused;
		if (idx < 0 || idx >= this._rows.length) return;
		let row = this._rows[idx];
		if (row.legacy) return;
		this._openEditFor(row.uuid, row.name, row.pluginID);
	},

	_openEditFor: function (uuid, name, pluginID = null) {
		this._editTarget = { uuid, name, pluginID };
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
		await this._refreshDirSection({
			dir: PluginFileAccess.getDataDirByUUID(uuid),
			size: () => PluginFileAccess.getDataDirSizeByUUID(uuid),
			dirID: "plugin-permissions-edit-data-dir",
			emptyID: "plugin-permissions-edit-data-empty",
			actionsID: "plugin-permissions-edit-data-actions",
		});
		await this._renderEditGrants();
		await this._renderEditPrefs();
	},

	_refreshStatusBanner: async function (pluginID) {
		let addon = pluginID ? await AddonManager.getAddonByID(pluginID) : null;
		let state = !addon ? 'uninstalled' : (addon.isActive ? 'enabled' : 'disabled');
		let banner = document.getElementById("plugin-permissions-edit-status");
		let text = document.getElementById("plugin-permissions-edit-status-text");
		if (state === 'enabled') {
			banner.hidden = true;
			text.removeAttribute('data-l10n-id');
			return;
		}
		document.l10n.setAttributes(text,
			state === 'disabled'
				? 'preferences-plugin-permissions-edit-status-disabled'
				: 'preferences-plugin-permissions-edit-status-uninstalled');
		banner.hidden = false;
	},

	_refreshDirSection: async function ({ dir, size, dirID, emptyID, actionsID }) {
		let exists = await FileIO.exists(dir);
		let bytes = exists ? await size() : 0;
		document.getElementById(dirID).textContent = `${PathIdentity.toNative(dir)} (${formatSize(bytes)})`;
		document.getElementById(dirID).hidden = !exists;
		document.getElementById(emptyID).hidden = exists;
		document.getElementById(actionsID).hidden = !exists;
	},

	_renderEditGrants: async function () {
		let removeLabel = await document.l10n.formatValue(
			"preferences-plugin-permissions-remove-grant") || "Remove";

		let grants = this._editLayer.list();
		grants.sort((a, b) => a.path.localeCompare(b.path));
		this._editGrants = grants.map(grant => ({
			mode: grant.mode,
			// Shown in the platform's spelling; the layer keeps the canonical one
			path: PathIdentity.toNative(grant.path),
			remove: {
				iconKey: "minus-circle",
				isFocusable: true,
				ariaLabel: removeLabel,
				onClick: () => {
					this._editLayer.remove(g => g.path === grant.path && g.mode === grant.mode);
					this._renderEditGrants();
					this.refresh();
				},
			},
		}));

		let hasGrants = this._editGrants.length > 0;
		document.getElementById("plugin-permissions-grants-container").hidden = !hasGrants;
		document.getElementById("plugin-permissions-grants-empty").hidden = hasGrants;

		if (this._editGrantsTree) {
			this._editGrantsTree.invalidate();
			return;
		}

		const columns = [
			{
				dataKey: "mode",
				label: " ",
				htmlLabel: ' ',
				fixedWidth: true,
				width: 80,
				renderCell: renderModeCell,
			},
			{
				dataKey: "path",
				label: " ",
				htmlLabel: ' ',
				flex: 1,
			},
			{
				dataKey: "remove",
				label: " ",
				htmlLabel: ' ',
				fixedWidth: true,
				width: 36,
				type: "button",
			},
		];
		await new Promise((resolve) => {
			ReactDOM.createRoot(document.getElementById("plugin-permissions-grants-table"))
				.render(
					<VirtualizedTable
						getRowCount={() => this._editGrants.length}
						id="plugin-permissions-grants-vtable"
						ref={(ref) => {
							this._editGrantsTree = ref;
							resolve();
						}}
						renderItem={makeRowRenderer(index => this._editGrants[index])}
						showHeader={false}
						columns={columns}
						staticColumns={true}
						disableFontSizeScaling={true}
						getRowString={index => this._editGrants[index].path}
						isSelectable={() => false}
					/>
				);
		});
	},

	// Prefs live under `extensions.<uuid>.` (see setupPreferences in
	// xpcom/plugins/globals.mjs).
	_renderEditPrefs: async function () {
		let prefPrefix = `extensions.${this._editTarget.uuid}.`;
		let rootBranch = Services.prefs.getBranch("");
		let userBranch = Services.prefs.getBranch(prefPrefix);
		let defaultBranch;
		try {
			defaultBranch = Services.prefs.getDefaultBranch(prefPrefix);
		}
		catch {}

		let keys = new Set(userBranch.getChildList(""));

		let [toggleLabel, resetLabel, deleteLabel] = await Promise.all([
			document.l10n.formatValue("preferences-plugin-permissions-prefs-toggle"),
			document.l10n.formatValue("preferences-plugin-permissions-prefs-reset"),
			document.l10n.formatValue("preferences-plugin-permissions-prefs-delete"),
		]);

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
				toggleAriaLabel: toggleLabel,
				onToggle: () => this._togglePref(fullKey),
				onCommit: text => this._commitPrefEdit(fullKey, text),
				reset: {
					// `refresh` reverts to a default; `trash` clears (no default to revert to).
					iconKey: defaulted ? "refresh" : "trash",
					isFocusable: isModified,
					ariaLabel: defaulted ? resetLabel : deleteLabel,
					disabled: !isModified,
					onClick: isModified ? () => this._resetPref(fullKey) : () => {},
				},
			};
		});

		let hasPrefs = this._editPrefs.length > 0;
		document.getElementById("plugin-permissions-prefs-container").hidden = !hasPrefs;
		document.getElementById("plugin-permissions-prefs-empty").hidden = hasPrefs;

		if (this._editPrefsTree) {
			this._editPrefsTree.invalidate();
			return;
		}

		const columns = [
			{
				dataKey: "name",
				label: " ",
				htmlLabel: ' ',
				flex: 2,
				renderCell: (index, _data, column) => renderPrefNameCell(this._editPrefs[index], column),
			},
			{
				dataKey: "value",
				label: " ",
				htmlLabel: ' ',
				flex: 3,
				renderCell: (index, _data, column) => renderPrefValueCell(this._editPrefs[index], column),
			},
			{
				dataKey: "reset",
				label: " ",
				htmlLabel: ' ',
				fixedWidth: true,
				width: 36,
				type: "button",
			},
		];
		await new Promise((resolve) => {
			ReactDOM.createRoot(document.getElementById("plugin-permissions-prefs-table"))
				.render(
					<VirtualizedTable
						getRowCount={() => this._editPrefs.length}
						id="plugin-permissions-prefs-vtable"
						ref={(ref) => {
							this._editPrefsTree = ref;
							resolve();
						}}
						renderItem={makeRowRenderer(index => this._editPrefs[index])}
						showHeader={false}
						columns={columns}
						staticColumns={true}
						disableFontSizeScaling={true}
						getRowString={index => this._editPrefs[index].name}
						isSelectable={() => false}
					/>
				);
		});
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
					await this._renderEditPrefs();
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

	_resetPref: async function (fullKey) {
		try {
			Services.prefs.getBranch("").clearUserPref(fullKey);
		}
		catch (e) {
			Zotero.logError(e);
		}
		await this._renderEditPrefs();
	},

	addEditPref: async function () {
		if (!this._editTarget) return;
		let prefPrefix = `extensions.${this._editTarget.uuid}.`;
		let rootBranch = Services.prefs.getBranch("");

		let [title, nameMsg, nameInvalid, nameExists, typeMsg, valMsg] = await Promise.all([
			document.l10n.formatValue("preferences-plugin-permissions-prefs-add-title"),
			document.l10n.formatValue("preferences-plugin-permissions-prefs-add-name"),
			document.l10n.formatValue("preferences-plugin-permissions-prefs-add-name-invalid"),
			document.l10n.formatValue("preferences-plugin-permissions-prefs-add-exists"),
			document.l10n.formatValue("preferences-plugin-permissions-prefs-add-type"),
			document.l10n.formatValue("preferences-plugin-permissions-prefs-add-value"),
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
			titleKey: "preferences-plugin-permissions-prefs-reset-all-confirm-title",
			bodyKey: "preferences-plugin-permissions-prefs-reset-all-confirm-body",
			actionKey: "preferences-plugin-permissions-prefs-reset-all-confirm-action",
			args: {},
		});
		if (!confirmed) return;

		let prefPrefix = `extensions.${this._editTarget.uuid}.`;
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
			titleKey: "preferences-plugin-permissions-clear-folder-confirm-title",
			bodyKey: "preferences-plugin-permissions-clear-folder-confirm-body",
			actionKey: "preferences-plugin-permissions-clear-folder-confirm-action",
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
			titleKey: "preferences-plugin-permissions-grants-remove-all-confirm-title",
			bodyKey: "preferences-plugin-permissions-grants-remove-all-confirm-body",
			actionKey: "preferences-plugin-permissions-grants-remove-all-confirm-action",
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
			document.l10n.formatValue("preferences-plugin-permissions-add-grant-mode-title"),
			document.l10n.formatValue("preferences-plugin-permissions-add-grant-mode-label"),
		]);
		let modes = ["read", "write", "deny"];
		let labels = ["Allow read", "Allow write", "Deny"];
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

	removeAllForSelected: async function () {
		let row = this._selectedRow();
		if (!row) return;
		if (!await this._confirmRemoveAll(row.name)) return;
		await this._wipePluginData(row);
		await this.refresh();
	},

	_confirmRemoveAll: function (name) {
		return confirmPrompt({
			titleKey: "preferences-plugin-permissions-edit-remove-all-confirm-title",
			bodyKey: "preferences-plugin-permissions-edit-remove-all-confirm-body",
			actionKey: "preferences-plugin-permissions-edit-remove-all-confirm-action",
			args: { name },
		});
	},

	_wipePluginData: async function ({ uuid, pluginID }) {
		// clearFileAccess removes the pref entry entirely; layer.clear()
		// would just leave an empty list behind.
		PluginFileAccess.clearFileAccess(uuid);
		await PluginFileAccess.deleteDataDirByUUID(uuid);
		let prefBranch = Services.prefs.getBranch(`extensions.${uuid}.`);
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
		if (!addon?.isActive) PluginNames.forget(uuid);
	},
};
