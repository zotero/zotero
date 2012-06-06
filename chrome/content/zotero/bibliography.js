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

//////////////////////////////////////////////////////////////////////////////
//
// Zotero_File_Interface_Bibliography
//
//////////////////////////////////////////////////////////////////////////////

// Class to provide options for bibliography
// Used by rtfScan.xul, integrationDocPrefs.xul, and bibliography.xul

var Zotero_File_Interface_Bibliography = new function() {
	var _io, _saveStyle;
	
	this.init = init;
	this.styleChanged = styleChanged;
	this.acceptSelection = acceptSelection;
	this.setLangPref = setLangPref;
	this.citationLangRecord = citationLangRecord;
	
	/*
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 */
	function init() {
		// Set font size from pref
		// Affects bibliography.xul and integrationDocPrefs.xul
		var bibContainer = document.getElementById("zotero-bibliography-container");
		if(bibContainer) {
			Zotero.setFontSize(document.getElementById("zotero-bibliography-container"));
		}
		
		if(window.arguments && window.arguments.length) {
			_io = window.arguments[0];
			if(_io.wrappedJSObject) _io = _io.wrappedJSObject;
		} else {
			_io = {};
		}
		
		var listbox = document.getElementById("style-listbox");
		var styles = Zotero.Styles.getVisible();
		
		// if no style is set, get the last style used
		if(!_io.style) {
			_io.style = Zotero.Prefs.get("export.lastStyle");
			_saveStyle = true;

			// if language params not set, get from SQL prefs
			// and Firefox preferences
			Zotero.setCitationLanguages(_io);
		}
		
		// add styles to list
		var index = 0;
		var nStyles = styles.length;
		var selectIndex = -1;
		for(var i=0; i<nStyles; i++) {
			var itemNode = document.createElement("listitem");
			itemNode.setAttribute("value", styles[i].styleID);
			itemNode.setAttribute("label", styles[i].title);
			listbox.appendChild(itemNode);
			
			if(styles[i].styleID == _io.style) {
				selectIndex = index;
			}
			index++;
		}
		
		if (selectIndex < 1) {
			selectIndex = 0;
		}
		
		// Has to be async to work properly
		setTimeout(function () {
			listbox.ensureIndexIsVisible(selectIndex);
			listbox.selectedIndex = selectIndex;
		});
		
		// ONLY FOR bibliography.xul: export options
		if(document.getElementById("save-as-rtf")) {
			// restore saved bibliographic settings
			document.getElementById('output-radio').selectedItem =
				document.getElementById(Zotero.Prefs.get("export.bibliographySettings"));
		}
		
		// ONLY FOR integrationDocPrefs.xul: update status of displayAs, set
		// bookmarks text
		if(document.getElementById("displayAs")) {
			if(_io.useEndnotes && _io.useEndnotes == 1) document.getElementById("displayAs").selectedIndex = 1;
			styleChanged(selectIndex);
		}		
		if(document.getElementById("formatUsing")) {
			if(_io.fieldType == "Bookmark") document.getElementById("formatUsing").selectedIndex = 1;
			var formatOption = (_io.primaryFieldType == "ReferenceMark" ? "referenceMarks" : "fields");
			document.getElementById("fields").label = Zotero.getString("integration."+formatOption+".label");
			document.getElementById("fields-caption").textContent = Zotero.getString("integration."+formatOption+".caption");
			document.getElementById("fields-file-format-notice").textContent = Zotero.getString("integration."+formatOption+".fileFormatNotice");
			document.getElementById("bookmarks-file-format-notice").textContent = Zotero.getString("integration.fields.fileFormatNotice");
		}
		if(document.getElementById("storeReferences")) {
			if(_io.storeReferences || _io.storeReferences === undefined) {
				document.getElementById("storeReferences").checked = true;
				if(_io.requireStoreReferences) document.getElementById("storeReferences").disabled = true;
			}
		}

		// Also ONLY for integrationDocPrefs.xul: update language selections
		
		// initialize options display from provided params
		var citationPrefNames = ['persons', 'institutions', 'titles', 'publishers', 'places'];
		for (var i = 0, ilen = citationPrefNames.length; i < ilen; i += 1) {
			var citationPrefNode = document.getElementById(citationPrefNames[i] + '-radio');
			if (citationPrefNode) {
				if (_io['citationLangPrefs'][citationPrefNames[i]] && _io['citationLangPrefs'][citationPrefNames[i]].length) {
					var selectedCitationPrefNode = document.getElementById(citationPrefNames[i] + "-radio-" + _io['citationLangPrefs'][citationPrefNames[i]][0]);
					citationPrefNode.selectedItem = selectedCitationPrefNode;
				}
				citationLangSet(citationPrefNode);
			}
		}

		var langPrefs = document.getElementById('lang-prefs');
		if (langPrefs){
			for (var i = langPrefs.childNodes.length -1; i > 0; i += -1) {
				langPrefs.removeChild(langPrefs.childNodes.item(i));
			}
			var tags = Zotero.DB.query("SELECT * FROM zlsTags ORDER BY tag");
			for (var i = 0, ilen = tags.length; i < ilen; i += 1) {
				var langSelectors = [];
				var langSelectorTypes = [
					'citationTransliteration',
					'citationTranslation',
					'citationSort'
				];
				for (var j = 0, jlen = langSelectorTypes.length; j < jlen; j += 1) {
					langSelectors.push(buildSelector('default',tags[i],langSelectorTypes[j]));
				}
				addSelectorRow(langPrefs,langSelectors);
			}
		}

		
		// set style to false, in case this is cancelled
		_io.style = false;
	}

	/*
	 * ONLY FOR integrationDocPrefs.xul: called when style is changed
	 */
	function styleChanged(index) {
		// When called from init(), selectedItem isn't yet set
		if (index != undefined) {
			var selectedItem = document.getElementById("style-listbox").getItemAtIndex(index);
		}
		else {
			var selectedItem = document.getElementById("style-listbox").selectedItem;
		}
		
		var selectedStyle = selectedItem.getAttribute('value');
		
		// update status of displayAs box based on style class
		if(document.getElementById("displayAs")) {
			var isNote = Zotero.Styles.get(selectedStyle).class == "note";
			document.getElementById("displayAs").disabled = !isNote;
		}
		
		// update status of formatUsing box based on style class
		if(document.getElementById("formatUsing")) {
			if(isNote) document.getElementById("formatUsing").selectedIndex = 0;
			document.getElementById("bookmarks").disabled = isNote;
			document.getElementById("bookmarks-caption").disabled = isNote;
		}
	}

	function acceptSelection() {
		// collect code
		_io.style = document.getElementById("style-listbox").selectedItem.value;
		if(document.getElementById("output-radio")) {
			// collect settings
			_io.output = document.getElementById("output-radio").selectedItem.id;
			// save settings
			Zotero.Prefs.set("export.bibliographySettings", _io.output);
		}
		
		// ONLY FOR integrationDocPrefs.xul: collect displayAs
		if(document.getElementById("displayAs")) {
			_io.useEndnotes = document.getElementById("displayAs").selectedIndex;
			_io.fieldType = (document.getElementById("formatUsing").selectedIndex == 0 ? _io.primaryFieldType : _io.secondaryFieldType);
			_io.storeReferences = document.getElementById("storeReferences").checked;
		}
		
		// save style (this happens only for "Export Bibliography," or Word
		// integration when no bibliography style was previously selected)
		if(_saveStyle) {
			Zotero.Prefs.set("export.lastStyle", _io.style);
		}
	}
	/*
	 * ONLY FOR integrationDocPrefs.xul: language selection utility functions
	 */
	function addSelectorRow(target,selectors) {
		var row = document.createElement('row');
		for (var i = 0, ilen = selectors.length; i < ilen; i += 1) {
			row.appendChild(selectors[i]);
		}
		target.appendChild(row);
	}
		
	function buildSelector (profile,tagdata,param) {
		var checkbox = document.createElement('checkbox');
		if (_io[param] && _io[param].indexOf(tagdata.tag) > -1) {
			checkbox.setAttribute('checked',true);
		}
		checkbox.setAttribute('profile', profile);
		checkbox.setAttribute('param', param);
		checkbox.setAttribute('oncommand', 'Zotero_File_Interface_Bibliography.setLangPref(this);');
		checkbox.setAttribute('value',tagdata.tag);
		checkbox.setAttribute('label',tagdata.nickname);
		checkbox.setAttribute('type','checkbox');
		checkbox.setAttribute('flex','1');
		return checkbox;
	}
		
	function setLangPref(target) {
		var profile = target.getAttribute('profile');
		var param = target.getAttribute('param');
		var tag = target.getAttribute('value');
		var enable = target.hasAttribute('checked');
		if (enable) {
			if (_io[param].indexOf(tag) === -1) {
				if (!_io[param]) {
					_io[param] = [];
				}
				_io[param].push(tag);
			}
		} else {
			for (var i = _io[param].length - 1; i > -1; i += -1) {
				if (_io[param][i] === tag) {
					_io[param] = _io[param].slice(0,i).concat(_io[param].slice(i + 1));
				}
			}
		}
	}

	function citationLangRecord(node) {
		if (node.id.split('-')[1] === 'checkbox') {
			var addme = false;
			var cullme = false;
			var secondarySetting = node.id.split('-')[2];
			if (node.checked) {
				addme = secondarySetting;
			} else {
				cullme = secondarySetting;
			}
			node = node.parentNode.parentNode.childNodes[1];
		}
		var idlst = node.selectedItem.id.split('-');
		var base = idlst[0];
		var primarySetting = idlst[2];
		var secondaries = _io['citationLangPrefs'][base].slice(1);
		if (addme && secondaries.indexOf(secondarySetting) === -1) {
			secondaries.push(secondarySetting);
		}
		if (cullme) {
			var cullidx = secondaries.indexOf(secondarySetting);
			if (cullidx > -1) {
				secondaries = secondaries.slice(0, cullidx).concat(secondaries.slice(cullidx + 1));
			}
		}
		_io['citationLangPrefs'][base] = [primarySetting].concat(secondaries);
		citationLangSet(node);
	}

	function citationLangSet (node) {
		var idlst = node.selectedItem.id.split('-');
		var base = idlst[0];
		var settings = _io['citationLangPrefs'][base];
        if (!settings) {
            settings = [];
        }
		var parent = node.parentNode;
		var optionSetters = parent.lastChild.childNodes;
		for (var i = 0, ilen = optionSetters.length; i < ilen; i += 1) {
			optionSetters[i].checked = false;
			for (var j = 1, jlen = settings.length; j < jlen; j += 1) {
				if (optionSetters[i].id === base + '-checkbox-' + settings[j]) {
					optionSetters[i].checked = true;
				}
			}
			if (optionSetters[i].id === base + "-checkbox-" + settings[0]) {
				optionSetters[i].checked = false;
				var idx = settings.slice(1).indexOf(settings[0]);
				if (idx > -1) {
					// +1 and +2 b/c first-position item (primary) is sliced off for this check
					settings = settings.slice(0,idx + 1).concat(settings.slice(idx + 2));
					_io['citationLangPrefs'][base] = settings;
				}
				optionSetters[i].disabled = true;
			} else {
				optionSetters[i].disabled = false;
			}
		}
	};
}

