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
	"chrome://zotero/content/xpcom/plugins/file.mjs");
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

function renderFileAccessCell(index, data, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className} file-access-cell`;
	if (data.legacy) {
		let dash = document.createElement('span');
		dash.className = 'file-access-na';
		dash.textContent = '—';
		cell.appendChild(dash);
		return cell;
	}
	let mkCount = (n, kind) => {
		let el = document.createElement('span');
		el.className = `file-access-count file-access-${kind}${n ? '' : ' file-access-zero'}`;
		el.textContent = String(n);
		return el;
	};
	let sep = document.createElement('span');
	sep.className = 'file-access-sep';
	sep.textContent = ' / ';
	cell.append(mkCount(data.allow, 'allow'), sep, mkCount(data.deny, 'deny'));
	return cell;
}

function renderEditCell(index, data, column) {
	let cell = document.createElement('span');
	cell.className = `cell ${column.className} edit-action-cell`;
	if (data.legacy) {
		let badge = document.createElement('span');
		badge.className = 'legacy-badge';
		badge.textContent = data.legacyLabel;
		badge.setAttribute('title', data.legacyLabel);
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

// The parent pane and the edit subpane share this script via two separate
// sandboxes. Gate the assignment so the subpane re-load doesn't clobber
// state (_rows, _tree, _editTarget) populated by the parent.
if (!Zotero_Preferences.PluginPermissions) {
	Zotero_Preferences.PluginPermissions = {
		_rows: [],
		_tree: null,
		_editTarget: null,
		_editLayer: null,
		_editGrants: [],
		_editGrantsTree: null,

		async init() {
			// VirtualizedTable's header rendering goes through Zotero.getString,
			// which only handles .properties; resolve FTL keys up front.
			this._labels = Object.fromEntries(await Promise.all([
				"preferences-plugin-permissions-col-plugin",
				"preferences-plugin-permissions-col-file-access",
				"preferences-plugin-permissions-col-data",
				"preferences-plugin-permissions-col-db",
				"preferences-plugin-permissions-edit-row",
				"preferences-plugin-permissions-legacy-badge",
			].map(async key => [key, await document.l10n.formatValue(key) || key])));

			await this.refresh();

			document.getElementById(PARENT_PANE_ID)
				.addEventListener('showing', () => this._tree?.invalidate());
		},

		async refresh() {
			this._rows = await this._collectRows();
			await this._renderTable();
		},

		async _collectRows() {
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
			for (let dir of ["plugin-data", "plugin-db"]) {
				for (let uuid of await this._listSubdirs(dir)) addIfOrphan(uuid);
			}
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
			let rows = [];
			for (let [uuid, info] of byUUID) {
				let grants = info.legacy ? [] : new PersistedGrantLayer(uuid).list();
				let allow = grants.filter(g => g.mode !== "deny").length;
				let deny = grants.filter(g => g.mode === "deny").length;
				let dataSize = info.legacy ? 0 : await PluginFileAccess.getDataDirSizeByUUID(uuid);
				let dbSize = info.legacy ? 0 : await PluginFileAccess.getDbDirSizeByUUID(uuid);
				rows.push({
					uuid,
					name: info.name,
					legacy: info.legacy,
					pluginID: info.pluginID,
					permissions: info.permissions,
					fileAccess: { allow, deny, legacy: info.legacy },
					dataText: info.legacy ? "—" : formatSize(dataSize),
					dbText: info.legacy ? "—" : formatSize(dbSize),
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
			rows.sort((a, b) => a.name.localeCompare(b.name));
			return rows;
		},

		async _listSubdirs(dir) {
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

		async _renderTable() {
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
					dataKey: "fileAccess",
					label: this._labels["preferences-plugin-permissions-col-file-access"],
					fixedWidth: true,
					width: 140,
					renderCell: renderFileAccessCell,
				},
				{
					dataKey: "dataText",
					label: this._labels["preferences-plugin-permissions-col-data"],
					fixedWidth: true,
					width: 90,
					renderCell: renderSizeCell,
				},
				{
					dataKey: "dbText",
					label: this._labels["preferences-plugin-permissions-col-db"],
					fixedWidth: true,
					width: 90,
					renderCell: renderSizeCell,
				},
				{
					dataKey: "edit",
					label: " ",
					htmlLabel: ' ',
					fixedWidth: true,
					width: 100,
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

		_updateSelectionInfo() {
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

		_selectedRow() {
			if (!this._tree?.selection.count) return null;
			let idx = this._tree.selection.focused;
			if (idx < 0 || idx >= this._rows.length) return null;
			return this._rows[idx];
		},

		_openSelected() {
			if (!this._tree) return;
			let idx = this._tree.selection.focused;
			if (idx < 0 || idx >= this._rows.length) return;
			let row = this._rows[idx];
			if (row.legacy) return;
			this._openEditFor(row.uuid, row.name, row.pluginID);
		},

		_openEditFor(uuid, name, pluginID = null) {
			this._editTarget = { uuid, name, pluginID };
			Zotero_Preferences.navigateToPane(EDIT_PANE_ID);
		},

		async initEditPane() {
			await this._refreshEditPane();
			// The script only loads once per pane lifetime; re-run our setup
			// every time the user navigates back into the subpane.
			document.querySelector(EDIT_PANE_CONTENT_SELECTOR)
				.addEventListener('showing', () => this._refreshEditPane());
		},

		async _refreshEditPane() {
			if (!this._editTarget) {
				Zotero_Preferences.navigateToPane(PARENT_PANE_ID);
				return;
			}
			let { uuid, name, pluginID } = this._editTarget;
			this._editLayer = new PersistedGrantLayer(uuid);

			// The framework prepends an <h1> with the subpane's rawLabel to
			// the outer .main-section; rewrite it to show the plugin name.
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
			await this._refreshDirSection({
				dir: PluginFileAccess.getDbDirByUUID(uuid),
				size: () => PluginFileAccess.getDbDirSizeByUUID(uuid),
				dirID: "plugin-permissions-edit-db-dir",
				emptyID: "plugin-permissions-edit-db-empty",
				actionsID: "plugin-permissions-edit-db-actions",
			});
			await this._renderEditGrants();
		},

		async _refreshStatusBanner(pluginID) {
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

		// Existence (not size) decides whether the section collapses to its
		// empty state -- an empty-but-existing dir still represents a real
		// on-disk location.
		async _refreshDirSection({ dir, size, dirID, emptyID, actionsID }) {
			let exists = await IOUtils.exists(dir);
			let bytes = exists ? await size() : 0;
			document.getElementById(dirID).textContent = `${dir} (${formatSize(bytes)})`;
			document.getElementById(dirID).hidden = !exists;
			document.getElementById(emptyID).hidden = exists;
			document.getElementById(actionsID).hidden = !exists;
		},

		async _renderEditGrants() {
			let removeLabel = await document.l10n.formatValue(
				"preferences-plugin-permissions-remove-grant") || "Remove";

			let grants = this._editLayer.list();
			grants.sort((a, b) => a.path.localeCompare(b.path));
			this._editGrants = grants.map(grant => ({
				mode: grant.mode,
				path: grant.path,
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
			let onKeyDown = (event) => {
				if (event.key === 'Delete' || (Zotero.isMac && event.key === 'Backspace')) {
					this._removeSelectedGrants();
					return false;
				}
				return true;
			};
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
							multiSelect={true}
							columns={columns}
							staticColumns={true}
							disableFontSizeScaling={true}
							getRowString={index => this._editGrants[index].path}
							onKeyDown={onKeyDown}
						/>
					);
			});
		},

		_removeSelectedGrants() {
			if (!this._editGrantsTree || !this._editLayer) return;
			let selected = [...this._editGrantsTree.selection.selected];
			if (!selected.length) return;
			// Snapshot the {path, mode} pairs before mutating; the layer
			// shifts indices on each removal.
			let toRemove = selected
				.filter(i => i >= 0 && i < this._editGrants.length)
				.map(i => this._editGrants[i]);
			for (let { path, mode } of toRemove) {
				this._editLayer.remove(g => g.path === path && g.mode === mode);
			}
			this._editGrantsTree.selection.clearSelection();
			this._renderEditGrants();
			this.refresh();
		},

		showEditDir() {
			if (!this._editTarget) return;
			try {
				Zotero.File.reveal(PluginFileAccess.getDataDirByUUID(this._editTarget.uuid));
			}
			catch (e) {
				Zotero.logError(e);
			}
		},

		async clearEditDir() {
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

		async deleteEditDb() {
			if (!this._editTarget) return;
			let confirmed = await confirmPrompt({
				titleKey: "preferences-plugin-permissions-delete-db-confirm-title",
				bodyKey: "preferences-plugin-permissions-delete-db-confirm-body",
				actionKey: "preferences-plugin-permissions-delete-db-confirm-action",
				args: { name: this._editTarget.name },
			});
			if (!confirmed) return;
			await PluginFileAccess.deleteDbDirByUUID(this._editTarget.uuid);
			await this._refreshEditPane();
			await this.refresh();
		},

		async addEditGrant(type = 'file') {
			if (!this._editTarget) return;
			let path = await this._pickPath(type);
			if (!path) return;
			let mode = await this._pickGrantMode();
			if (!mode) return;
			this._editLayer.add({ path, mode });
			await this._renderEditGrants();
			await this.refresh();
		},

		async _pickPath(type) {
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

		async _pickGrantMode() {
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

		async removeAllForPlugin() {
			if (!this._editTarget) return;
			if (!await this._confirmRemoveAll(this._editTarget.name)) return;
			await this._wipePluginData(this._editTarget);
			await this.refresh();
			Zotero_Preferences.navigateToPane(PARENT_PANE_ID);
		},

		async removeAllForSelected() {
			let row = this._selectedRow();
			if (!row) return;
			if (!await this._confirmRemoveAll(row.name)) return;
			await this._wipePluginData(row);
			await this.refresh();
		},

		_confirmRemoveAll(name) {
			return confirmPrompt({
				titleKey: "preferences-plugin-permissions-edit-remove-all-confirm-title",
				bodyKey: "preferences-plugin-permissions-edit-remove-all-confirm-body",
				actionKey: "preferences-plugin-permissions-edit-remove-all-confirm-action",
				args: { name },
			});
		},

		async _wipePluginData({ uuid, pluginID }) {
			// Wipe the grants pref entirely -- layer.clear() would only store
			// an empty list, leaving the UUID in listFileAccessUUIDs() and the
			// row visible after refresh.
			PluginFileAccess.clearFileAccess(uuid);
			await PluginFileAccess.deleteDataDirByUUID(uuid);
			await PluginFileAccess.deleteDbDirByUUID(uuid);
			// Keep the UUID→name pref for enabled plugins so they show a human
			// name until the next plugin load re-registers it; drop it once
			// the plugin is gone so the row stops appearing in the list.
			let addon = pluginID ? await AddonManager.getAddonByID(pluginID) : null;
			if (!addon?.isActive) PluginNames.forget(uuid);
		},
	};
}
