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
	this.citationPrimary = citationPrimary;
	this.citationSecondary = citationSecondary;
	this.citationSetAffixes = citationSetAffixes;
	this.setLanguageRoleHighlight = setLanguageRoleHighlight

	/*
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 */
	function init() {
		//Zotero.debug("XXX == init() ==");
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

		var citationPrefNames = ['Persons', 'Institutions', 'Titles', 'Publishers', 'Places'];
		for (var i = 0, ilen = citationPrefNames.length; i < ilen; i += 1) {
			var prefname = citationPrefNames[i].toLowerCase();
			var citationPrefNode = document.getElementById(prefname + '-radio');
			if (citationPrefNode) {
				citationLangSet(citationPrefNames[i], true);
				if (_io['citationLangPrefs'+citationPrefNames[i]] && _io['citationLangPrefs'+citationPrefNames[i]].length) {
					var selectedCitationPrefNode = document.getElementById(prefname + "-radio-" + _io['citationLangPrefs'+citationPrefNames[i]][0]);
					citationPrefNode.selectedItem = selectedCitationPrefNode;
				}
			}
			citationLangSet(citationPrefNames[i], true);
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
		            var newselector = buildSelector('default',tags[i],langSelectorTypes[j]);
		            if ((j % 3) == 0) {
			            newselector.setAttribute("class", "translit");
                        newselector.setAttribute("onmouseover", "Zotero_File_Interface_Bibliography.setLanguageRoleHighlight(['translit-primary', 'translit-secondary', 'translit'],true);");
                        newselector.setAttribute("onmouseout", "Zotero_File_Interface_Bibliography.setLanguageRoleHighlight(['translit-primary', 'translit-secondary', 'translit'],false);");
		            } else if ((j % 3) == 1) {
			            newselector.setAttribute("class", "translat");
                        newselector.setAttribute("onmouseover", "Zotero_File_Interface_Bibliography.setLanguageRoleHighlight(['translat-primary', 'translat-secondary', 'translat'],true);");
                        newselector.setAttribute("onmouseout", "Zotero_File_Interface_Bibliography.setLanguageRoleHighlight(['translat-primary', 'translat-secondary', 'translat'],false);");
		            }
		            langSelectors.push(newselector);
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
		//Zotero.debug("XXX == styleChanged() ==");
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
		//Zotero.debug("XXX == acceptSelection() ==");
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
		//Zotero.debug("XXX == addSelectorRow() ==");
		var row = document.createElement('row');
		row.setAttribute("class", "compact");
		for (var i = 0, ilen = selectors.length; i < ilen; i += 1) {
			row.appendChild(selectors[i]);
		}
		target.appendChild(row);
	}
		
    function setLanguageRoleHighlight(classes, mode) {
	    for (var i = 0, ilen = classes.length; i < ilen; i += 1) {
		    var nodes = document.getElementsByClassName(classes[i]);
		    for (var j = 0, jlen = nodes.length; j < jlen; j += 1) {
                var lst;
			    var str = nodes[j].getAttribute("class");
			    if (str) {
				    lst = str.split(/\s+/);
			    } else {
				    lst = [];
			    }
			    if (mode) {
				    lst.push("language-role-highlight");
				    nodes[j].setAttribute("class", lst.join(" "));
			    } else {
                    for (var k = lst.length - 1; k > -1; k += -1) {
                        if (lst[k] === "language-role-highlight") {
                            lst = lst.slice(0, k).concat(lst.slice(k + 1));
                        }
                    }
                    nodes[j].setAttribute("class", lst.join(" "));
                }
		    }
	    }
    };

	function buildSelector (profile,tagdata,param) {
		//Zotero.debug("XXX == buildSelector() ==");
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
		var hbox = document.createElement('hbox');
		hbox.setAttribute("style", "overflow:hidden;margin-top:0px;margin-bottom:0px;");
		hbox.setAttribute('flex','1');
		hbox.appendChild(checkbox);
		var hboxfil = document.createElement('hbox');
		hboxfil.setAttribute('flex','1');
		hbox.appendChild(hboxfil);
		return hbox;
	}
		
	function setLangPref(target) {
		//Zotero.debug("XXX == setLangPref() ==");
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

    function capFirst(str) {
	    return str[0].toUpperCase() + str.slice(1);
    }

    function citationPrimary(node) {
	    var lst = node.id.split('-');
	    var base = lst[0];
        var primarySetting = lst[2];
		var settings = _io['citationLangPrefs'+capFirst(base)];
        if (!settings) {
            settings = ['orig'];
        }
	    _io['citationLangPrefs'+capFirst(base)] = [primarySetting].concat(settings.slice(1));
        // Second true is for a radio click
	    citationLangSet(capFirst(base), true, true);
    }

	function citationSecondary() {
		//Zotero.debug("XXX == citationSecondary() ==");
		var node = document.popupNode;
		var lst = node.id.split('-');
		var lowerBase = lst[0];
		var upperBase = lst[0][0].toUpperCase() + lst[0].slice(1);
		var addme = false;
		var cullme = false;
		var secondarySetting = lst[2];
		var forms = ['orig', 'translit', 'translat'];
		// Check-box has not yet changed when this executes.
		if (!node.checked) {
			addme = secondarySetting;
		} else {
			cullme = secondarySetting;
			// Also unset configured affixes.
			citationSetAffixes(node);
		}
		var settings = _io['citationLangPrefs'+upperBase];
		var primarySetting = settings[0];
		var secondaries = settings.slice(1);
		for (var i = 0, ilen = secondaries.length; i < ilen; i += 1) {
			if (forms.indexOf(secondaries[i]) === -1) {
				secondaries = secondaries.slice(0, i).concat(secondaries.slice(i + 1));
			}
		}
		if (addme && secondaries.indexOf(secondarySetting) === -1) {
			secondaries.push(secondarySetting);
		}
		if (cullme) {
			var cullidx = secondaries.indexOf(secondarySetting);
			if (cullidx > -1) {
				secondaries = secondaries.slice(0, cullidx).concat(secondaries.slice(cullidx + 1));
			}
		}
		_io['citationLangPrefs'+upperBase] = [primarySetting].concat(secondaries);
		if (addme || cullme) {
			citationLangSet(upperBase);
		}
	};

    function citationLangSet (name, init, radioClick) {
		var settings = _io['citationLangPrefs'+name];
        Zotero.debug("XXX citationLangSet() "+name+" "+init+" "+radioClick);
	    if (!settings || !settings[0]) {
		    settings = ['orig'];
	    }
	    var nodes = [];
	    var forms = ['orig', 'translit', 'translat'];
        var base = name.toLowerCase();
        // get node
        // set node from pref
        if (init) {
            citationGetAffixes();
            var currentPrimaryID = base + "-radio-" + settings[0];
            var node = document.getElementById(currentPrimaryID);
            var control = node.control;
            control.selectedItem = node;
            
            var translitID = base + "-radio-translit";
            var translitNode = document.getElementById(translitID);
            nodes.push(translitNode);
            
            Zotero.debug();

            for (var i = 0, ilen = forms.length; i < ilen; i += 1) {
                nodes.push(document.getElementById(base + "-checkbox-" + forms[i]));
            }
	        for (var i = 0, ilen = nodes.length; i < ilen; i += 1) {
		        nodes[i].checked = false;
		        for (var j = 1, jlen = settings.length; j < jlen; j += 1) {
			        if (nodes[i].id === base + '-checkbox-' + settings[j]) {
				        nodes[i].checked = true;
			        }
		        }
		        if (nodes[i].id === base + "-checkbox-" + settings[0]) {
			        nodes[i].checked = false;
			        var idx = settings.slice(1).indexOf(settings[0]);
			        if (idx > -1) {
				        // +1 and +2 b/c first-position item (primary) is sliced off for this check
				        settings = settings.slice(0,idx + 1).concat(settings.slice(idx + 2));
		                _io['citationLangPrefs'+name] = settings;
			        }
                    citationSetAffixes(nodes[i]);
			        nodes[i].disabled = true;
                } else if (radioClick && nodes[i].id === translitID) {
                    // true invokes a quash of the affixes
                    if (currentPrimaryID === translitID) {
                        Zotero.debug("XXX ONE");
                        citationSetAffixes(nodes[i]);
                    } else {
                        Zotero.debug("XXX TWO");
                        citationSetAffixes(nodes[i], null, true);
                    }
                } else {
			        nodes[i].disabled = false;
		        }
	        }
        }
    }

    function citationSetAffixes (node, affixNode, quashPrimaryAffixes) {
        Zotero.debug("XXX in citationSetAffixes() "+node+" "+affixNode+" "+quashPrimaryAffixes);
        if (!node) {
            var node = document.popupNode;
        }
        var currentId = node.id;
        var prefixNode = document.getElementById(node.id + '-prefix');
        var suffixNode = document.getElementById(node.id + '-suffix');
        if (!affixNode || quashPrimaryAffixes) {
            prefixNode.value = "";
            suffixNode.value = "";
        } else {
            var prefix = affixNode.value.split("|")[0];
            if (!prefix) {
                prefix = "";
            }
            var suffix = affixNode.value.split("|")[1];
            if (!suffix) {
                suffix = "";
            }
            prefixNode.value = prefix;
            suffixNode.value = suffix;
        }
        // Do something to store this data in Prefs
        var types = ['persons', 'institutions', 'titles', 'publishers', 'places'];
	    var forms = ['orig', 'translit', 'translat'];
        var affixList = [];
        for (var i = 0, ilen = types.length; i < ilen; i += 1) {
            affixListPush(types[i], "radio", "translit", affixList, "prefix");
            affixListPush(types[i], "radio", "translit", affixList, "suffix");
            for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
                affixListPush(types[i], "checkbox", forms[j], affixList, "prefix");
                affixListPush(types[i], "checkbox", forms[j], affixList, "suffix");
            }
        }
        Zotero.debug("XXX citationAffixes saved: "+affixList);
		_io['citationAffixes'] = affixList;
    }

    function affixListPush(type, boxtype, form, lst, affix) {
        var elem = document.getElementById(type + "-" + boxtype + "-" + form + "-" +affix);
        if (!elem.value) {
            elem.value = "";
        }
        lst.push(elem.value);
    };

    function citationGetAffixes () {
		var affixList = null;
		if (_io['citationAffixes']) {
			if (_io['citationAffixes'].length === 40) {
				affixList = _io['citationAffixes'];
			}
		}
		if (!affixList) {
			affixList = [,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,];
		}
        var types = ['persons', 'institutions', 'titles', 'publishers', 'places'];
	    var forms = ['orig', 'translit', 'translat'];
        var count = 0;
        for (var i = 0, ilen = types.length; i < ilen; i += 1) {
        count =  citationGetAffixesAction(types[i], "radio", "translit", affixList, count);
            
            for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
                count = citationGetAffixesAction(types[i], "checkbox", forms[j], affixList, count);
            }
        }
    }

    function citationGetAffixesAction(type, boxtype, form, affixList, count) {
        var affixPos = ['prefix', 'suffix']
        for (var k = 0, klen = affixPos.length; k < klen; k += 1) {
            var id = type + '-' + boxtype + '-' + form + '-' + affixPos[k];
            var node = document.getElementById(id);
            if (affixList[count]) {
                node.value = affixList[count];
        }
            count += 1;
        }
        return count;
    }
}

