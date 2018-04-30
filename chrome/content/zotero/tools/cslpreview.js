/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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
    Contributed by Julian Onions
*/

var Zotero_CSL_Preview = new function() {
	this.init = init;
	this.refresh = refresh;
	this.generateBibliography = generateBibliography;
	
	function init() { 
		var menulist = document.getElementById("locale-menu");
		
		Zotero.Styles.populateLocaleList(menulist);
		menulist.value = Zotero.Prefs.get('export.lastLocale');;
		
		var iframe = document.getElementById('zotero-csl-preview-box');
		iframe.contentDocument.documentElement.innerHTML = '<html><head><title></title></head><body><p>' + Zotero.getString('styles.preview.instructions') + '</p></body></html>';
	}
	function refresh() {
		var iframe = document.getElementById('zotero-csl-preview-box');
		var items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (items.length === 0) {
			iframe.contentDocument.documentElement.innerHTML = '<html><head><title></title></head><body><p style="color: red">' + Zotero.getString('styles.editor.warning.noItems') + '</p></body></html>';
			return;
		}
		var progressWin = new Zotero.ProgressWindow();
		// XXX needs its own string really!
		progressWin.changeHeadline(Zotero.getString("pane.items.menu.createBib.multiple"));
		var icon = 'chrome://zotero/skin/treeitem-attachment-file.png';
		progressWin.addLines(document.title, icon);
		progressWin.show();
		progressWin.startCloseTimer();
		var f = function() {
			var styles = Zotero.Styles.getVisible();
			// XXX needs its own string really for the title!
			var str = '<html><head><title></title></head><body>';
			for (let style of styles) {
				if (style.source) {
					continue;
				}
				Zotero.debug("Generate Bib for " + style.title);
				var cite = generateBibliography(style);
				if (cite) {
					str += '<h3>' + style.title + '</h3>';
					str += cite;
					str += '<hr>';
				}
			}
			
			str += '</body></html>';
			iframe.contentDocument.documentElement.innerHTML = str;			
		};
		// Give progress window time to appear
		setTimeout(f, 100);
	}
	
	function generateBibliography(style) {
		var iframe = document.getElementById('zotero-csl-preview-box');
		
		var items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (items.length === 0) {
			return '';
		}
		
		var citationFormat = document.getElementById("citation-format").selectedItem.value;
		if (citationFormat != "all" && citationFormat != style.categories) {
			Zotero.debug("CSL IGNORE: citation format is " + style.categories);
			return '';
		}
		
		var locale = document.getElementById("locale-menu").value;
		var styleEngine = style.getCiteProc(locale);
		
		// Generate multiple citations
		var citations = styleEngine.previewCitationCluster(
			{
				citationItems: items.map(item => ({ id: item.id })),
				properties: {}
			},
			[], [], "html"
		);
		
		// Generate bibliography
		var bibliography = '';
		if(style.hasBibliography) {
			styleEngine.updateItems(items.map(item => item.id));
			bibliography = Zotero.Cite.makeFormattedBibliography(styleEngine, "html");
		}
		
		return '<p>' + citations + '</p>' + bibliography;
	}
	
	
}();
