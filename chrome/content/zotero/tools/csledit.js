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
*/

var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

var Zotero_CSL_Editor = new function () {
	let monaco, editor;

	this.init = init;
	this.loadCSL = loadCSL;

	async function init() {
		await Zotero.Schema.schemaUpdatePromise;

		const isDarkMQL = window.matchMedia('(prefers-color-scheme: dark)');
		
		Zotero.Styles.populateLocaleList(document.getElementById("locale-menu"));
		
		var cslList = document.getElementById('zotero-csl-list');
		cslList.removeAllItems();
		
		var lastStyle = Zotero.Prefs.get('export.lastStyle');
		
		var styles = Zotero.Styles.getVisible();
		var currentStyle = null;
		for (let style of styles) {
			if (style.source) {
				continue;
			}
			var item = cslList.appendItem(style.title, style.styleID);
			if (!currentStyle && lastStyle == style.styleID) {
				currentStyle = style;
				cslList.selectedItem = item;
			}
		}
		
		var pageList = document.getElementById('zotero-csl-page-type');
		var locators = Zotero.Cite.labels;
		for (let locator of locators) {
			pageList.appendItem(Zotero.Cite.getLocatorString(locator), locator);
		}
		
		pageList.selectedIndex = 0;

		let editorWin = document.getElementById("zotero-csl-editor-iframe").contentWindow;
		let { monaco: _monaco, editor: _editor } = await editorWin.loadMonaco({
			language: 'xml',
			theme: isDarkMQL.matches ? 'vs-dark' : 'vs-light',
			insertSpaces: true,
			tabSize: 2,
		});
		monaco = _monaco;
		editor = _editor;

		editor.getModel().onDidChangeContent(Zotero.Utilities.debounce(() => {
			this.onStyleModified();
		}, 250));

		if (currentStyle) {
			// Call asynchronously, see note in Zotero.Styles
			window.setTimeout(this.onStyleSelected.bind(this, currentStyle.styleID), 1);
		}

		isDarkMQL.addEventListener("change", (ev) => {
			monaco.editor.setTheme(ev.matches ? 'vs-dark' : 'vs-light');
			this.refresh();
		});
	}
	
	this.onStyleSelected = function (styleID) {
		Zotero.Prefs.set('export.lastStyle', styleID);
		let style = Zotero.Styles.get(styleID);
		Zotero.Styles.updateLocaleList(
			document.getElementById("locale-menu"),
			style,
			Zotero.Prefs.get('export.lastLocale')
		);
		
		loadCSL(style.styleID);
		this.refresh();
	};
	
	this.refresh = function () {
		this.generateBibliography(this.loadStyleFromEditor());
	};

	this.refreshDebounced = Zotero.Utilities.debounce(this.refresh, 250);
	
	this.save = async function () {
		var style = editor.getValue();
		var fp = new FilePicker();
		fp.init(window, Zotero.getString('styles.editor.save'), fp.modeSave);
		fp.appendFilter("Citation Style Language", "*.csl");
		//get the filename from the id; we could consider doing even more here like creating the id from filename.
		var parser = new DOMParser();
		var doc = parser.parseFromString(style, 'text/xml');
		var filename = doc.getElementsByTagName("id");
		if (filename) {
			filename = filename[0].textContent;
			fp.defaultString = filename.replace(/.+\//, "") + ".csl";
		}
		else {
			fp.defaultString = "untitled.csl";
		}
		var rv = await fp.show();
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			let outputFile = fp.file;
			Zotero.File.putContentsAsync(outputFile, style);
		}
	};
	
	function loadCSL(cslID) {
		var style = Zotero.Styles.get(cslID);
		editor.setValue(style.getXML());
		document.getElementById('zotero-csl-list').value = cslID;
	}
	
	this.loadStyleFromEditor = function () {
		var styleObject;
		try {
			styleObject = new Zotero.Style(
				editor.getValue()
			);
		}
		catch (e) {
			this.updateIframe(Zotero.getString('styles.editor.warning.parseError') + '<div>' + e + '</div>', 'error');
			throw e;
		}
		
		return styleObject;
	};
	
	this.onStyleModified = function () {
		let xml = editor.getValue();
		Zotero.Styles.validate(xml).then(
			() => this.updateMarkers(''),
			rawErrors => this.updateMarkers(rawErrors)
		);
		let cslList = document.getElementById('zotero-csl-list');
		let savedStyle = Zotero.Styles.get(cslList.value);
		if (!savedStyle || xml !== savedStyle?.getXML()) {
			cslList.selectedIndex = -1;
		}
		
		let styleObject = this.loadStyleFromEditor();
		
		Zotero.Styles.updateLocaleList(
			document.getElementById("locale-menu"),
			styleObject,
			Zotero.Prefs.get('export.lastLocale')
		);
		Zotero_CSL_Editor.generateBibliography(styleObject);
	};
	
	this.generateBibliography = function (style) {
		var items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (items.length == 0) {
			this.updateIframe(Zotero.getString('styles.editor.warning.noItems'), 'warning');
			return;
		}
		
		var selectedLocale = document.getElementById("locale-menu").value;
		var styleEngine;
		try {
			styleEngine = style.getCiteProc(style.locale || selectedLocale, 'html');
		}
		catch (e) {
			this.updateIframe(Zotero.getString('styles.editor.warning.parseError') + '<div>' + e + '</div>');
			throw e;
		}
		
		var itemIds = items.map(item => item.id);

		styleEngine.updateItems(itemIds);

		// Generate multiple citations
		var citation = {};
		citation.citationItems = [];
		citation.properties = {};
		citation.properties.noteIndex = 1;
		for (let i = 0, ilen = items.length; i < ilen; i += 1) {
			citation.citationItems.push({ id: itemIds[i] });
		}

		// Generate single citations
		var author = document.getElementById("preview-suppress-author").checked;
		var search = document.getElementById('preview-pages');
		var loc = document.getElementById('zotero-csl-page-type');
		var pos = document.getElementById('zotero-ref-position').selectedItem.value;
		var citations = '<h3>' + Zotero.getString('styles.editor.output.individualCitations') + '</h3>';
		for (let i = 0; i < citation.citationItems.length; i++) {
			citation.citationItems[i]['suppress-author'] = author;
			if (search.value !== '') {
				citation.citationItems[i].locator = search.value;
				citation.citationItems[i].label = loc.selectedItem.value;
			}
			if (pos == 4) {
				//near note is a subsequent citation with near note set to true;
				citation.citationItems[i].position = 1;
				citation.citationItems[i]["near-note"] = true;
			}
			else {
				citation.citationItems[i].position = parseInt(pos);
			}
			var subcitation = [citation.citationItems[i]];
			citations += styleEngine.makeCitationCluster(subcitation) + '<br />';
		}
		
		try {
			var multCitations = '<hr><h3>' + Zotero.getString('styles.editor.output.singleCitation') + '</h3>'
				+ styleEngine.previewCitationCluster(citation, [], [], "html");

			// Generate bibliography
			styleEngine.updateItems(itemIds);
			var bibliography = '<hr/><h3>' + Zotero.getString('styles.bibliography') + '</h3>'
				+ Zotero.Cite.makeFormattedBibliography(styleEngine, "html");
			
			this.updateIframe(citations + multCitations + bibliography);
		}
		catch (e) {
			this.updateIframe(Zotero.getString('styles.editor.warning.renderError') + '<div>' + e + '</div>', 'error');
			throw e;
		}
		styleEngine.free();
	};

	this.updateMarkers = function (rawErrors) {
		let model = editor.getModel();
		let errors = rawErrors ? rawErrors.split('\n') : [];
		let markers = errors.map((error) => {
			let matches = error.match(/^[^:]*:(?<line>[^:]*):(?<column>[^:]*): error: (?<message>.+)/);
			if (!matches) return null;
			let { line, message } = matches.groups;
			line = parseInt(line);
			return {
				startLineNumber: line,
				endLineNumber: line,
				// The error message doesn't give us an end column, so using its
				// start column looks weird. Just highlight the whole line.
				startColumn: model.getLineFirstNonWhitespaceColumn(line),
				endColumn: model.getLineMaxColumn(line),
				message,
				severity: 8
			};
		}).filter(Boolean);
		monaco.editor.setModelMarkers(model, 'csl-validator', markers);
	};

	this.updateIframe = function (content, containerClass = 'preview') {
		const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
		let iframe = document.getElementById('zotero-csl-preview-box');
		iframe.contentDocument.documentElement.innerHTML = `<html>
		<head>
			<title></title>
			<link rel="stylesheet" href="chrome://zotero-platform/content/zotero.css">
			<style>
				html {
					color-scheme: ${isDarkMode ? "dark" : "light"};
				}
			</style>
		</head>
		<body id="csl-edit-preview"><div class="${containerClass} zotero-dialog">${content}</div></body>
		</html>`;
	};
}();
