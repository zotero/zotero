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


var { FilePath, PathIdentity } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/filePath.mjs");

var PluginFileAccessPrompt = {
	_args: null,
	_resolved: false,

	init() {
		this._args = window.arguments[0].wrappedJSObject;
		let { pluginName, path, mode, canPersistFile, isDirectory, parentPath } = this._args;

		this.rememberCheckbox = document.getElementById("opt-dont-ask");
		this.allowButton = document.getElementById("btn-allow");
		this.allowPlainButton = document.getElementById("btn-allow-plain");
		this.denyButton = document.getElementById("btn-deny");
		this.parentMenuitem = document.getElementById("allow-parent");
		this.headlineElement = document.getElementById("prompt-headline");

		document.l10n.setAttributes(
			this.headlineElement,
			"plugin-file-access-headline",
			{
				pluginName,
				action: mode,
				type: isDirectory ? "folder" : "file",
				// The gate speaks canonical paths; the user reads the platform's spelling
				fileName: FilePath.basename(path),
				directoryName: parentPath ? PathIdentity.toNative(parentPath) : "",
				hasDirectory: parentPath ? "yes" : "no",
			},
		);

		// Drop the checkbox when nothing on this prompt can be persisted.
		this.rememberCheckbox.hidden = !canPersistFile;

		this.rememberCheckbox.addEventListener("command", () => this._refreshLabels());
		this.denyButton.addEventListener("command", () => this._choose("deny", "file"));
		let onAllow = () => this._choose("allow", "file");
		this.allowButton.addEventListener("command", onAllow);
		this.allowButton.image = "";
		this.allowPlainButton.addEventListener("command", onAllow);
		this.parentMenuitem.addEventListener("command", () => this._choose("allow", "parent"));

		window.addEventListener("keydown", e => this._onKeydown(e));

		// The aria-describedby ensures the labels are announced on window open.
		// Remove it on blur to avoid redundant announcements
		this.denyButton.addEventListener("blur", () => {
			this.denyButton.removeAttribute("aria-describedby");
		}, { once: true });

		this._refreshLabels();

		// Fluent translates async; sizing before it finishes measures empty buttons.
		document.l10n.translateFragment(document.documentElement).then(() => {
			window.sizeToContent();
			this._positionWindow();
			window.focus();
			// Make sure the labels are announced as a unit
			this.headlineElement.setAttribute("aria-label", this.headlineElement.textContent);
			this.denyButton.focus();
		});
	},

	_refreshLabels() {
		this._updateAllowLabel();
		this._updateParentLabel();
		this._updateAllowButton();
	},

	_updateAllowLabel() {
		let always = this.rememberCheckbox.checked && this._args.canPersistFile;
		let id = always
			? "plugin-file-access-allow-always"
			: "plugin-file-access-allow";
		document.l10n.setAttributes(this.allowButton, id);
		document.l10n.setAttributes(this.allowPlainButton, id);
	},

	_updateParentLabel() {
		let always = this.rememberCheckbox.checked && this._args.canPersistParent;
		document.l10n.setAttributes(
			this.parentMenuitem,
			always
				? "plugin-file-access-allow-folder-always"
				: "plugin-file-access-allow-folder",
		);
	},

	_updateAllowButton() {
		let { parentPath, path, canPersistFile, canPersistParent } = this._args;
		let hasParent = !!parentPath && parentPath !== path;
		let remember = this.rememberCheckbox.checked;
		let show = hasParent && canPersistFile && (!remember || canPersistParent);
		this.parentMenuitem.hidden = !show;
		this.allowButton.hidden = !show;
		this.allowPlainButton.hidden = show;
	},

	_onKeydown(e) {
		// Esc / Ctrl-W: cancel() resolves the promise and closes
		let isClose = (Zotero.isMac ? e.metaKey : e.ctrlKey) && e.key === "w";
		if (e.key === "Escape" || isClose) {
			e.preventDefault();
			this.cancel();
			return;
		}
		// Enter: activate focused button, else the default Deny.
		if (e.key === "Enter") {
			let focused = document.activeElement;
			let target = focused?.localName === "button" ? focused : this.denyButton;
			e.preventDefault();
			target.click();
			return;
		}
		// Left/Right: cycle focus across the visible action buttons.
		if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
			let buttons = [this.allowPlainButton, this.allowButton, this.denyButton]
				.filter(b => !b.hidden);
			let focused = document.activeElement;
			let current = buttons.find(b => b === focused || b.contains(focused));
			if (!current) return;
			let idx = buttons.indexOf(current);
			let step = e.key === "ArrowRight" ? 1 : -1;
			buttons[(idx + step + buttons.length) % buttons.length].focus();
			e.preventDefault();
		}
	},

	_positionWindow() {
		const X_OFFSET = 50;
		const Y_OFFSET = 30;
		let right = window.screen.availLeft + window.screen.availWidth;
		let bottom = window.screen.availTop + window.screen.availHeight;
		window.moveTo(
			right - window.outerWidth - X_OFFSET,
			bottom - window.outerHeight - Y_OFFSET,
		);
	},

	_choose(decision, scope) {
		let remember = this.rememberCheckbox.checked;
		let persist = remember ? "always" : "once";
		if (remember && decision === "allow") {
			let { canPersistFile, canPersistParent } = this._args;
			let canPersist = scope === "parent" ? canPersistParent : canPersistFile;
			if (!canPersist) persist = "once";
		}
		this._resolve({ decision, persist, scope });
	},

	_resolve(answer) {
		if (this._resolved) return;
		this._resolved = true;
		try {
			this._args.resolve(answer);
		}
		catch (e) {
			Zotero.logError(e);
		}
		window.close();
	},

	cancel() {
		this._resolve({
			decision: "deny",
			persist: "once",
			scope: "file",
			reason: "closed",
		});
	},
};
