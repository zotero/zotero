/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
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

var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

var React = require('react');
var ReactDOM = require('react-dom');
var VirtualizedTable = require('components/virtualized-table');
var { makeRowRenderer } = VirtualizedTable;

Zotero_Preferences.Cite = {
	styles: [],
	wordPluginResourcePaths: {
		libreOffice: 'zotero-libreoffice-integration',
		macWord: 'zotero-macword-integration',
		winWord: 'zotero-winword-integration'
	},

	init: async function () {
		// Init word plugin sections
		let wordPlugins = [];
		if (Zotero.isWin) {
			wordPlugins.push('winWord');
		}
		else if (Zotero.isMac) {
			wordPlugins.push('macWord');
		}
		wordPlugins.push('libreOffice');
		await Zotero.Promise.delay();
		for (let wordPlugin of wordPlugins) {
			// This is the weirdest indirect code, but let's not fix what's not broken
			try {
				var installer = Components.utils.import(`resource://${this.wordPluginResourcePaths[wordPlugin]}/installer.jsm`).Installer;
				(new installer(true)).showPreferences(document);
			} catch(e) {
				Zotero.logError(e);
			}
		}
		await this.refreshStylesList();
		document.querySelector('#zotero-prefpane-cite').addEventListener('showing', () => {
			this._tree.invalidate();
		});
	},
	
	
	/**
	 * Refreshes the list of styles in the styles pane
	 * @param {String} cslID Style to select
	 * @return {Promise}
	 */
	refreshStylesList: async function (cslID) {
		Zotero.debug("Refreshing styles list");
		
		await Zotero.Styles.init();
		this.styles = Zotero.Styles.getVisible()
			.map((style) => {
				var updated = Zotero.Date.sqlToDate(style.updated, true);
				return {
					title: style.title,
					updated: updated ? updated.toLocaleDateString() : ""
				};
			});
		
		if (!this._tree) {
			const columns = [
				{
					dataKey: "title",
					label: "zotero.preferences.cite.styles.styleManager.title",
				},
				{
					dataKey: "updated",
					label: "zotero.preferences.cite.styles.styleManager.updated",
					fixedWidth: true,
					width: 100
				}
			];
			var handleKeyDown = (event) => {
				if (event.key == 'Delete' || Zotero.isMac && event.key == 'Backspace') {
					Zotero_Preferences.Cite.deleteStyle();
					return false;
				}
			};

			await new Promise((resolve) => {
				ReactDOM.createRoot(document.getElementById("styleManager")).render(
					<VirtualizedTable
						getRowCount={() => this.styles.length}
						id="styleManager-table"
						ref={(ref) => {
							this._tree = ref;
							resolve();
						}}
						renderItem={makeRowRenderer(index => this.styles[index])}
						showHeader={true}
						multiSelect={true}
						columns={columns}
						staticColumns={true}
						disableFontSizeScaling={true}
						onSelectionChange={selection => document.getElementById('styleManager-delete').disabled = !selection.count}
						onKeyDown={handleKeyDown}
						getRowString={index => this.styles[index].title}
					/>
				);
			});

			// Fix style manager showing partially blank until scrolled
			setTimeout(() => this._tree.invalidate());
		}
		else {
			this._tree.invalidate();
		}
		if (cslID) {
			var styles = Zotero.Styles.getVisible();
			var index = styles.findIndex(style => style.styleID == cslID);
			if (index != -1) {
				this._tree.selection.select(index);
			}
		}
		else if ([...this._tree.selection.selected].some(i => i >= this.styles.length)) {
			this._tree.selection.clearSelection();
		}
	},
	
	
	openStylesPage: function () {
		Zotero.openInViewer("https://www.zotero.org/styles/");
	},
	
	
	/**
	 * Adds a new style to the style pane
	 **/
	addStyle: async function () {
		var fp = new FilePicker();
		fp.init(window, Zotero.getString("zotero.preferences.styles.addStyle"), fp.modeOpen);
		
		fp.appendFilter("CSL Style", "*.csl");
		
		var rv = await fp.show();
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			try {
				await Zotero.Styles.install(
					{
						file: Zotero.File.pathToFile(fp.file)
					},
					fp.file,
					true
				);
			}
			catch (e) {
				(new Zotero.Exception.Alert("styles.install.unexpectedError",
					fp.file, "styles.install.title", e)).present()
			}
		}
	},
	
	
	/**
	 * Deletes selected styles from the styles pane
	 **/
	deleteStyle: Zotero.Promise.coroutine(function* () {
		// get selected cslIDs
		var styles = Zotero.Styles.getVisible();
		var cslIDs = [];
		for (let index of this._tree.selection.selected.keys()) {
			cslIDs.push(styles[index].styleID);
		}
		
		if(cslIDs.length == 0) {
			return;
		} else if(cslIDs.length == 1) {
			var selectedStyle = Zotero.Styles.get(cslIDs[0])
			var text = Zotero.getString('styles.deleteStyle', selectedStyle.title);
		} else {
			var text = Zotero.getString('styles.deleteStyles');
		}
		
		var ps = Services.prompt;
		if(ps.confirm(null, '', text)) {
			// delete if requested
			if(cslIDs.length == 1) {
				yield selectedStyle.remove();
			} else {
				for(var i=0; i<cslIDs.length; i++) {
					yield Zotero.Styles.get(cslIDs[i]).remove();
				}
			}
			
			yield this.refreshStylesList();
		}
	}),
	
	
	/**
	 * Shows an error if import fails
	 **/
	styleImportError: function () {
		alert(Zotero.getString('styles.installError', "This"));
	}
}
