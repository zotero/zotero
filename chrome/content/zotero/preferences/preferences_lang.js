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

Zotero_Preferences.Lang = {
	
	init: function () {
        var startTime = Date.now();
 	    Zotero_Preferences.Lang.refreshMenus();
 	    Zotero_Preferences.Lang.refreshLanguages();
 	    var radios = ['Persons', 'Institutions', 'Titles', 'Journals', 'Publishers', 'Places']
 	    var forms = ['orig', 'translit', 'translat'];
 	    // Check for a settings in Prefs. For those not found, set to orig.
 	    // Then set language in node.
 	    // Then update disable status on partner nodes.
 	    for (var i = 0, ilen = radios.length; i < ilen; i += 1) {
 		    var settings = Zotero.Prefs.get("csl.citation" + radios[i]).split(',');
 		    if (!settings || !settings[0] || forms.indexOf(settings[0]) == -1) {
 			    Zotero.Prefs.set("csl.citation" + radios[i], 'orig');
 		    }
 		    Zotero_Preferences.Lang.citationLangSet(radios[i], true);
 	    }
 	    Zotero.setupLocale(document);
	},
	
    refreshMenus: function () {
 	    Zotero.DB.beginTransaction();
 	    //var startTime = Date.now();
 	    Zotero_Preferences.Lang.refreshScriptMenu();
 	    //Zotero.debug("XXX scripts: "+(Date.now() - startTime));
 	    //var startTime = Date.now();
 	    Zotero_Preferences.Lang.refreshRegionMenu();
 	    //Zotero.debug("XXX regions: "+(Date.now() - startTime));
 	    //
 	    // The variant menu is built on the fly
 	    // because the number of items is relatively 
 	    // small.ZZZ
 	    // 
 	    //refreshVariantMenu();
 	    Zotero.DB.commitTransaction();
    },
    
    refreshScriptMenu: function () {
 	    Zotero.DB.beginTransaction();
 	    var box = document.getElementById('script-lang-box');
 	    if (!box.childNodes.length) {
 		    var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
 			    + 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
 			    + 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
 			    + 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
 			    + 'WHERE TY.value=? '
 			    + 'ORDER BY D.value';
 		    var res = Zotero.DB.query(sql,['script']);
 		    for (var i = 0, ilen = res.length; i < ilen; i += 1) {
 			    var item = document.createElement('menuitem');
 			    item.setAttribute('label',res[i].description+" -- "+res[i].subtag);
 			    item.setAttribute('id',res[i].subtag+'::script');
 			    item.setAttribute('onclick','Zotero_Preferences.Lang.selectScript(this);');
 			    box.appendChild(item);
 		    }
 	    }
 	    Zotero.DB.commitTransaction();
    },
    
    selectScript: function (node) {
        Zotero.debug("zls: selectScript()");
 	    var parent = node.parentNode;
 	    var hiddenItemId = parent.getAttribute('hidden-item');
 	    if (hiddenItemId) {
 		    var elem = document.getElementById(hiddenItemId);
 		    elem.setAttribute('hidden',false);
 	    }
 	    var topnode = document.getElementById('extend-lang-menu');
 	    var rowId = topnode.getAttribute('target-row-id');
 	    var tag = rowId.slice(0,-5);
 	    tag += '-' + node.getAttribute('id').slice(0, -8);
 	    Zotero_Preferences.Lang.handleDependentLanguageRowInsert(tag);
    },
    
    selectRegion: function (node) {
 	    var parent = node.parentNode;
 	    var topnode = document.getElementById('extend-lang-menu');
 	    var rowId = topnode.getAttribute('target-row-id');
 	    var tag = rowId.slice(0,-5);
 	    tag += '-' + node.getAttribute('id').slice(0, -8);
 	    Zotero_Preferences.Lang.handleDependentLanguageRowInsert(tag);
    },
    
    selectVariant: function (node) {
 	    var parent = node.parentNode;
 	    var topnode = document.getElementById('extend-lang-menu');
 	    var rowId = topnode.getAttribute('target-row-id');
 	    var tag = rowId.slice(0,-5);
 	    tag += '-' + node.getAttribute('id').slice(0, -9);
 	    Zotero_Preferences.Lang.handleDependentLanguageRowInsert(tag);
    },
    
    handleDependentLanguageRowInsert: function (tag) {
 	    var validator = Zotero.zlsValidator;
        Zotero.debug("zls: tag for validation: ("+tag+")");
 	    var res = validator.validate(tag);
 	    if (res) {
 		    Zotero_Preferences.Lang.insertLanguageRow(validator.tagdata);
 	    }
    },
 	
    refreshRegionMenu: function () {
 	    Zotero.DB.beginTransaction();
 	    var box = document.getElementById('region-lang-box');
 	    if (!box.childNodes.length) {
 		    var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
 			    + 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
 			    + 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
 			    + 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
 			    + 'WHERE TY.value=? '
 			    + 'ORDER BY D.value';
 		    var res = Zotero.DB.query(sql,['region']);
 		    for (var i = 0, ilen = res.length; i < ilen; i += 1) {
 			    var item = document.createElement('menuitem');
 			    item.setAttribute('label',res[i].description);
 			    item.setAttribute('id',res[i].subtag+'::region');
 			    item.setAttribute('onclick','Zotero_Preferences.Lang.selectRegion(this);');
 			    box.appendChild(item);
 		    }
 	    }
 	    Zotero.DB.commitTransaction();
    },
    
    scriptLangMenuPrep: function (topnode) {
 	    var targetId = topnode.getAttribute('target-row-id');
 	    var tag = targetId.slice(0,-5);
 	    var sql = 'SELECT SS.value AS script FROM zlsSubtags S '
 		    + 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
 		    + 'LEFT JOIN zlsSubTagData SS ON S.suppressscript=SS.id '
 		    + 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
 		    + 'WHERE TY.value=? AND TA.value=? AND S.suppressscript IS NOT NULL';
 	    var script = Zotero.DB.columnQuery(sql,['language',tag]);
 	    if (script && script.length) {
 		    var elem = document.getElementById(script[0]+'::script');
 		    elem.setAttribute('hidden',true);
 		    elem.parentNode.setAttribute('hidden-item',script[0]+'::script');
 	    }
    },
    
    variantLangMenuPrep: function (topnode) {
 	    var existing_variants = "";
 	    var targetId = topnode.getAttribute('target-row-id');
 	    var menubox = document.getElementById('variant-lang-box');
 	    for (var i = menubox.childNodes.length - 1; i > -1; i += -1) {
 		    menubox.removeChild(menubox.childNodes[i]);
 	    }
 	    var tag = targetId.slice(0,-5);
 	    // Drop regions for prefix comparison
 	    var searchtag = tag.replace(/(?:-[A-Z]{2})/g,"").replace(/(?:-[0-9]{3})/g,"");
 	    var m = searchtag.match(/(?:([0-9]{4,8}|[a-zA-Z][a-zA-Z0-9]{4,8})(?:-|$))/g);
 	    if (m) {
 		    for (var i = 0, ilen = m.length; i < ilen; i += 1) {
 			    m[i] = m[i].replace(/-$/,"");
 		    }
 		    existing_variants = "'" + m.join("','") + "'";
 	    }
 	    var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
 		    + 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
 		    + 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
 		    + 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
 		    + 'LEFT JOIN zlsSubTagData PR ON S.prefix=PR.id '
 		    + 'WHERE TY.value=? AND (PR.value=? OR S.prefix IS NULL) AND NOT TA.value IN (?)';
 	    var res = Zotero.DB.query(sql,['variant',searchtag,existing_variants]);
 	    for (var i = 0, ilen = res.length; i < ilen; i += 1) {
 		    var item = document.createElement('menuitem');
 		    item.setAttribute('label',res[i].description);
 		    item.setAttribute('id',res[i].subtag+'::variant');
 		    item.setAttribute('onclick','Zotero_Preferences.Lang.selectVariant(this);');
 		    menubox.appendChild(item);
 	    }
    },
    
    refreshLanguages: function () {
 	    var parent = document.getElementById("language-rows");
 	    for (var i = parent.childNodes.length - 1; i > -1; i += -1) {
 		    parent.removeChild(parent.childNodes[i]);
 	    }
 	    var tags = Zotero.DB.query("SELECT * FROM zlsTags ORDER BY tag");
 	    for (var i = 0, ilen = tags.length; i < ilen; i += 1) {
 		    var validator = Zotero.zlsValidator;
 		    var res = validator.validate(tags[i].tag);
 		    if (res) {
 			    var row = Zotero_Preferences.Lang.addLangRow(parent, tags[i].nickname, validator.tagdata);
 			    row.setAttribute("class", "compact");
 			    Zotero_Preferences.Lang.addSelectors(row, tags[i]);
 			    parent.appendChild(row);
 		    }
 		    // Should have an else here, that deletes invalid tags
 		    // from zlsTags et al. ?
 	    }
    },
    
    getTagFromTagdata: function (tagdata) {
 	    var tag = [];
 	    for (var i = 0, ilen = tagdata.length; i < ilen; i += 1) {
 		    tag.push(tagdata[i].subtag);
 	    }
 	    tag = tag.join('-');
 	    return tag;
    },
    
    addLangRow: function (parent, nickname, tagdata) {
 	    // Compose tag name as a string
 	    var tag = Zotero_Preferences.Lang.getTagFromTagdata(tagdata);
 	    
 	    // New row node
 	    var newrow = document.createElement('row');
 	    newrow.setAttribute('id', tag+'::row');
 	    newrow.setAttribute("class", "compact");
        //newrow.setAttribute("minwidth","600");
        //newrow.setAttribute("maxwidth","600");	
 	    // Set nickname
        
 	    var firsthbox = document.createElement('hbox');
 	    firsthbox.setAttribute('class', 'zotero-clicky');
 	    firsthbox.setAttribute("flex", "1");
 	    firsthbox.setAttribute('onclick', 'Zotero_Preferences.Lang.showNicknameEditor(this.firstChild)');
 	    var valbox = document.createElement('label');
 	    //valbox.setAttribute("width", "100");
 	    //valbox.setAttribute("style", "font-size:larger;");
 	    valbox.setAttribute("flex","1");
 	    valbox.setAttribute("value",nickname);
 	    firsthbox.appendChild(valbox);
 	    newrow.appendChild(firsthbox);
        
 	    var secondhbox = document.createElement('hbox');
 	    //secondhbox.setAttribute('minwidth', '150');
 	    //secondhbox.setAttribute('maxwidth', '150');
 	    // Set tags
 	    if (tagdata.length) {
 		    Zotero_Preferences.Lang.addSubtag(secondhbox, tagdata[0]);		
 	    }
 	    for (var i = 1, ilen = tagdata.length; i < ilen; i += 1) {
 		    var subtagdata = tagdata[i];
 		    Zotero_Preferences.Lang.addHyphen(secondhbox);
 		    Zotero_Preferences.Lang.addSubtag(secondhbox, subtagdata);
 	    }
 	    newrow.appendChild(secondhbox);
        
 	    var thirdhbox = document.createElement('hbox');
 	    var removeButton = document.createElement('label');
 	    removeButton.setAttribute('value', "-");
 	    removeButton.setAttribute('class', 'zotero-clicky zotero-clicky-minus');
 	    removeButton.setAttribute('style', 'max-height:18px;min-height:18px;');
 	    removeButton.setAttribute('disabled',true);
 	    Zotero_Preferences.Lang.setRemoveDisable(removeButton, tag);
 	    var removeBox = document.createElement("vbox");
 	    removeBox.appendChild(removeButton);
 	    thirdhbox.appendChild(removeBox);
        
 	    var addButton = document.createElement('label');
 	    addButton.setAttribute('value', "+");
 	    addButton.setAttribute('class', 'zotero-clicky zotero-clicky-plus');
 	    addButton.setAttribute('style', 'min-height:18px;max-height:18px;');
 	    addButton.setAttribute('disabled',false);
 	    addButton.setAttribute('onmouseover','Zotero_Preferences.Lang.extendLangMenuPrep(this.parentNode.parentNode.parentNode)');
 	    addButton.setAttribute('popup','extend-lang-menu');
 	    var addBox = document.createElement("vbox");
 	    addBox.appendChild(addButton);
 	    thirdhbox.appendChild(addBox);
 	    newrow.appendChild(thirdhbox);
        
 	    // temporary
 	    parent.appendChild(newrow);
 	    return newrow;
    },
    
    addHyphen: function (box) {
 	    var label = document.createElement('label');
 	    label.setAttribute('value','-');
 	    label.setAttribute('style','font-size:larger;margin:0px;');
 	    box.appendChild(label);
    },
    
    addSubtag: function (box, subtagdata) {
 	    var label = document.createElement('label');
 	    label.setAttribute('tooltiptext',subtagdata.description);
 	    label.setAttribute('value',subtagdata.subtag);
 	    label.setAttribute('type',subtagdata.type);
 	    label.setAttribute('style','font-size:larger;margin:0px;');
 	    box.appendChild(label);
    },
    
    handleLangKeypress: function (event, type) {
 	    //alert(textbox.mController);
 	    var target = event.target;
 	    var focused = document.commandDispatcher.focusedElement;
 		
 	    switch (event.keyCode) {
 		case event.DOM_VK_TAB:
 		case event.DOM_VK_RETURN:
 			event.preventDefault();
 			switch (type) {
 			case 'simpleEdit':
 				Zotero_Preferences.Lang.hideNicknameEditor(target);
 			default:
 				event.target.value = '';
 				event.target.blur();
 			}
 		    break;
 	    }
 	    return false;
    },
    
    getResultComment: function (textbox){
        /*
         * Support function for SAYT
         */
 	    var controller = textbox.controller;
 	    
 	    for (var i=0; i<controller.matchCount; i++) {
 		    if (controller.getValueAt(i) == textbox.value) {
 			    return controller.getCommentAt(i);
 		    }
 	    }
 	    return false;
    },
    
    
    handleLangAutoCompleteSelect: function (textbox) {
        /*
         * Function performed after auto-complete selection.
         */
 	    if (textbox.value) {
 		    // Comment is the tag code, value is the tag description
 		    
 		    var comment = Zotero_Preferences.Lang.getResultComment(textbox);
 		    if (!comment) {
 			    textbox.value = '';
 		    } else {
 			    var validator = Zotero.zlsValidator;
 			    if (validator.validate(comment)) {
 				    Zotero_Preferences.Lang.insertLanguageRow(validator.tagdata);
 				    textbox.value = '';
 				    textbox.blur();
 			    }
 		    }
 	    }
    },
    
    insertLanguageRow: function (tagdata) {
 	    // XXXZ This does not run for primary tags ... system uses
 	    // cachedLanguages instead. Should be using cachedLanguages
 	    // for everything?
        Zotero.debug("KKK I'm trying!");
 	    var tag = Zotero_Preferences.Lang.getTagFromTagdata(tagdata);
 	    var parent = Zotero_Preferences.Lang.getTagFromTagdata(tagdata.slice(0,-1));
 	    var sql = "INSERT INTO zlsTags VALUES (?,?,?)";
 	    // XXXZ The parent field is unnecessary and can be
 	    // dropped.
 	    // XXXZ The tag should be added to the (persistent)
 	    // store of language tags seen by the system if
 	    // necessary, so that it is assigned an integer
 	    // value.
 	    // XXXZ The second tag field should be the integer
 	    // key of the tag.
 	    Zotero.DB.query(sql, [tag,tag,parent]);
 	    Zotero_Preferences.Lang.refreshLanguages();
    },
    
    extendLanguageTopMenu: function (row) {
 	    // ZZZ
 	    var tag = row.getAttribute('id').slice(0,-5);
 	    //alert("Extend me: "+tag);
 	    var validator = Zotero.zlsValidator;
 	    var tagdata = validator.validate(tag);
 	    var menudata = Zotero_Preferences.Lang.getLanguageMenuData(tag, tagdata);
    },
    
    extendLangMenuPrep: function (row) {
 	    var menu = document.getElementById('extend-lang-menu');
 	    menu.setAttribute('target-row-id',row.getAttribute('id'));
 	    var type = row.firstChild.nextSibling.lastChild.getAttribute('type');
 	    var scriptElem = document.getElementById('script-lang-menu');
 	    var regionElem = document.getElementById('region-lang-menu');
 	    var variantElem = document.getElementById('variant-lang-menu');
 	    if (type === 'script') {
 		    scriptElem.setAttribute('hidden',true);
 	    } else if (type === 'region') {
 		    scriptElem.setAttribute('hidden',true);		
 		    regionElem.setAttribute('hidden',true);		
 	    } else if (type === 'variant') {
 		    scriptElem.setAttribute('hidden',true);		
 		    regionElem.setAttribute('hidden',true);
 		    // If no variants are available, the + button
 		    // itself will be disabled, so no special
 		    // action is required here.
 	    } else {
 		    scriptElem.setAttribute('hidden',false);
 		    regionElem.setAttribute('hidden',false);		
 	    }
    },
    
    setRemoveDisable: function (button, tag) {
        /*
         * Disable or enable the delete button on language rows,
         * as appropriate.
         */
 	    if (Zotero_Preferences.Lang.tagDependents(tag)) {
 		    button.setAttribute('disabled',true);
 		    button.setAttribute('onclick',false);
 	    } else {
 		    button.setAttribute('disabled',false);
 		    button.setAttribute('onclick','Zotero_Preferences.Lang.deleteTag(this.parentNode.parentNode.parentNode)');
 	    }
    },
    
    deleteTag: function (row) {
        /*
         * Deletes a language tag from the preferences
         * panel and from the language tags table in the 
         * database.
         */
 	    var tag = row.getAttribute('id');
 	    // tag attribute on the row carries a '::row' suffix.
 	    tag = tag.slice(0,-5);
 	    if (!Zotero_Preferences.Lang.tagDependents(tag)) {
 		    var sql = "DELETE FROM zlsTags WHERE tag=?";
 		    Zotero.DB.query(sql,[tag]);
 	    }
 	    Zotero_Preferences.Lang.refreshLanguages();
    },
    
    tagDependents: function (tag) {
        /*
         * Check for dependents and preferences that rely
         * on a tag.  Return true if found, false if not.
         */
 	    // Releasing dependent-tag constraint: disable delete
 	    // only when used in default prefs.
 	    //var sql = "SELECT COUNT(*) FROM zlsTags WHERE parent=?";
 	    // dependent tags
 	    //var hasDependents = Zotero.DB.valueQuery(sql, [tag]);
        
 	    var hasDependents = false;
 	    if (!hasDependents) {
 		    // dependent preferences
 		    var sql = "SELECT COUNT(*) FROM zlsPreferences WHERE tag=?";
 		    hasDependents = Zotero.DB.valueQuery(sql, [tag]);
 	    }
 	    return hasDependents;
    },
    
    nicknameExists: function (nickname) {
        /*
         * Check for a given nickname in the list of chosen
         * language tags.  Return true if found, false if not.
         */
 	    var sql = 'SELECT COUNT(*) FROM zlsTags WHERE nickname=?';
 	    var result = Zotero.DB.valueQuery(sql,[nickname]);
 	    return result;
    },
    
    showNicknameEditor: function (label) {
 	    var parent = label.parentNode;
 	    parent.setAttribute('onclick',false);
 	    var textbox = document.createElement('textbox');
 	    textbox.setAttribute('value',label.value);
 	    textbox.setAttribute('oncommand','Zotero_Preferences.Lang.hideNicknameEditor(this)');
 	    textbox.setAttribute('width','80');
 	    textbox.setAttribute('onkeypress', 'Zotero_Preferences.Lang.handleLangKeypress(event,"simpleEdit")');
 	    textbox.setAttribute('flex','1');
 	    parent.replaceChild(textbox,label);
 	    textbox.focus();
    },
    
    hideNicknameEditor: function (textbox) {
 	    if (textbox.value !== textbox.getAttribute('value') && Zotero_Preferences.Lang.nicknameExists(textbox.value)) {
 		    return;
 	    }
 	    var oldval = textbox.getAttribute('value');
 	    var newval = textbox.value;
 	    var parent = textbox.parentNode;
 	    parent.setAttribute('onclick', 'Zotero_Preferences.Lang.showNicknameEditor(this.firstChild)');
 	    var label = document.createElement('label');
 	    label.setAttribute("value",newval);
 	    label.setAttribute("flex", "1");
 	    parent.replaceChild(label, textbox);
 	    var sql = 'UPDATE zlsTags SET nickname=? WHERE nickname=?';
 	    Zotero.DB.query(sql,[newval,oldval]);
 	    Zotero.CachedLanguages.taint();
 	    //updateSelectors(parent.parentNode, parent.parentNode.id.slice(-5));
    },
    
    addSelectors: function (row, tag) {
 	    //var tags = Zotero.DB.query("SELECT * FROM zlsTags ORDER BY tag");
 	    //while (row.childNodes.length) {
 	    //	row.removeChild(row.childNodes[0]);
 	    //}
 	    var languageSelectorTypes = [
 		    'zoteroSort',
 		    'zoteroDisplay',
 		    'citationTransliteration',
 		    'citationTranslation',
 		    'citationSort'
 	    ];
 	    for (var j = 0, jlen = languageSelectorTypes.length; j < jlen; j += 1) {
 		    var newselector = Zotero_Preferences.Lang.buildSelector('default',tag,languageSelectorTypes[j]);
 		    if ((j % 5) == 2) {
 			    newselector.setAttribute("class", "translit");
 			    newselector.setAttribute("onmouseover", "Zotero_Preferences.Lang.setLanguageRoleHighlight(['translit-primary', 'translit-secondary', 'translit'],true);");
 			    newselector.setAttribute("onmouseout", "Zotero_Preferences.Lang.setLanguageRoleHighlight(['translit-primary', 'translit-secondary', 'translit'],false);");
 		    } else if ((j % 5) == 3) {
 			    newselector.setAttribute("class", "translat");
 			    newselector.setAttribute("onmouseover", "Zotero_Preferences.Lang.setLanguageRoleHighlight(['translat-primary', 'translat-secondary', 'translat'],true);");
 			    newselector.setAttribute("onmouseout", "Zotero_Preferences.Lang.setLanguageRoleHighlight(['translat-primary', 'translat-secondary', 'translat'],false);");
 		    }
 		    row.appendChild(newselector);
 	    }
    },
    
    setLanguageRoleHighlight: function (classes, mode) {
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
    },
    
    buildSelector: function (profile,tagdata,param) {
 	    var checkbox = document.createElement('checkbox');
 	    if (Zotero_Preferences.Lang.langPrefIsSet(profile,tagdata.tag,param)) {
 		    checkbox.setAttribute('checked',true);
 	    }
 	    checkbox.setAttribute('profile', profile);
 	    checkbox.setAttribute('param', param);
 	    checkbox.setAttribute('oncommand', 'Zotero_Preferences.Lang.setLangPref(event)');
 	    checkbox.setAttribute('value',tagdata.tag);
 	    checkbox.setAttribute("style", "overflow:hidden;margin-top:0px;max-width:18px;max-height:18px;");
 	    var checkboxBox = document.createElement("vbox");
 	    checkboxBox.appendChild(checkbox);
 	    var hbox = document.createElement("hbox");
 	    hbox.setAttribute("flex", "1");
 	    var lbox = document.createElement("hbox");
 	    lbox.setAttribute("flex", 1);
 	    var rbox = document.createElement("hbox");
 	    rbox.setAttribute("flex", 1);
 	    hbox.appendChild(lbox);
 	    hbox.appendChild(checkboxBox);
 	    hbox.appendChild(rbox);
 	    //checkbox.setAttribute('label',tagdata.nickname);
 	    //checkbox.setAttribute('type','checkbox');
 	    //checkbox.setAttribute('flex','1');
 	    return hbox;
    },
    
    langPrefIsSet: function (profile,tag,param) {
 	    var sql = 'SELECT COUNT(*) FROM zlsPreferences WHERE profile=? AND tag=? AND param=?';
 	    var res = Zotero.DB.valueQuery(sql,[profile, tag, param]);
 	    return res;
    },
    
    setLangPref: function (event) {
 	    var target = event.target;
 	    var profile = target.getAttribute('profile');
 	    var param = target.getAttribute('param');
 	    var tag = target.getAttribute('value');
 	    var enable = target.hasAttribute('checked');
 	    if (enable) {
 		    var sql = 'INSERT INTO zlsPreferences VALUES (?,?,?)';
 		    Zotero.DB.query(sql,['default',param,tag]);
 	    } else {
 		    var sql = 'DELETE FROM zlsPreferences WHERE profile=? AND param=? and tag=?';
 		    Zotero.DB.query(sql,['default',param,tag]);
 	    }
 	    Zotero.CachedLanguagePreferences.taint();
 	    var langRow = document.getElementById(tag+'::row');
 	    var removeButton = langRow.lastChild.lastChild.previousSibling;
 	    Zotero_Preferences.Lang.setRemoveDisable(removeButton,tag);
    },
    

    capFirst: function (str) {
 	    return str[0].toUpperCase() + str.slice(1);
    },
    
    citationPrimary: function (node) {
 	    var lst = node.id.split('-');
 	    var base = lst[0];
 	    var primarySetting = lst[2];
 	    var settings = Zotero.Prefs.get('csl.citation' + Zotero_Preferences.Lang.capFirst(base));
 	    if (settings) {
 		    settings = settings.split(',');
 	    } else {
 		    settings = ['orig'];
 	    }
 	    Zotero.Prefs.set('csl.citation' + Zotero_Preferences.Lang.capFirst(base), [primarySetting].concat(settings.slice(1)).join(','));
 	    // Second true is for a radio click
 	    Zotero_Preferences.Lang.citationLangSet(Zotero_Preferences.Lang.capFirst(base), true, true);
    },
    
    citationSecondary: function () {
        // Possibly want to cast two separate functions,
        // depending on whether we are updating in onpopupshowing
        // or menuitem? Is the ticked state the same in the two?
 	    var node = document.popupNode;
 	    var lst = node.id.split('-');
 	    var base = lst[0];
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
 		    Zotero_Preferences.Lang.citationSetAffixes(node);
 	    }
 	    var settings = Zotero.Prefs.get('csl.citation' + Zotero_Preferences.Lang.capFirst(base));
 	    var primarySetting = settings.split(',')[0];
 	    settings = settings.split(',').slice(1);
 	    for (var i = 0, ilen = settings.length; i < ilen; i += 1) {
 		    if (forms.indexOf(settings[i]) === -1) {
 			    settings = settings.slice(0, i).concat(settings.slice(i + 1));
 		    }
 	    }
 	    if (addme && settings.indexOf(secondarySetting) === -1) {
 		    settings.push(secondarySetting);
 	    }
 	    if (cullme) {
 		    var cullidx = settings.indexOf(secondarySetting);
 		    if (cullidx > -1) {
 			    settings = settings.slice(0, cullidx).concat(settings.slice(cullidx + 1));
 		    }
 	    }
 	    Zotero.Prefs.set('csl.citation' + Zotero_Preferences.Lang.capFirst(base), [primarySetting].concat(settings).join(','));
 	    if (addme || cullme) {
 		    Zotero_Preferences.Lang.citationLangSet(Zotero_Preferences.Lang.capFirst(base));
 	    }
    },
    
    citationLangSet: function (name, init, radioClick) {
 	    var settings = Zotero.Prefs.get('csl.citation' + name).split(',');
 	    if (!settings || !settings[0]) {
 		    settings = ['orig'];
 	    }
 	    var nodes = [];
 	    var forms = ['orig', 'translit', 'translat'];
 	    var base = name.toLowerCase();
 	    // get node
 	    // set node from pref
 	    if (init) {
 		    Zotero_Preferences.Lang.citationGetAffixes();
 		    var currentPrimaryID = base + "-radio-" + settings[0];
 		    var node = document.getElementById(currentPrimaryID);
 		    var control = node.control;
 		    control.selectedItem = node;
            
 		    var translitID = base + "-radio-translit";
 		    var translitNode = document.getElementById(translitID);
 		    nodes.push(translitNode);
            
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
 					    Zotero.Prefs.set('csl.citation' + Zotero_Preferences.Lang.capFirst(base), settings.join(','));
 				    }
 				    Zotero_Preferences.Lang.citationSetAffixes(nodes[i]);
 				    nodes[i].disabled = true;
 			    } else if (radioClick && nodes[i].id === translitID) {
 				    // true invokes a quash of the affixes
 				    if (currentPrimaryID === translitID) {
 					    Zotero_Preferences.Lang.citationSetAffixes(nodes[i]);
 				    } else {
 					    Zotero_Preferences.Lang.citationSetAffixes(nodes[i], null, true);
 				    }
 			    } else {
 				    nodes[i].disabled = false;
 			    }
 		    }
 	    }
    },
    
    citationSetAffixes: function (node, affixNode, quashPrimaryAffixes) {
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
 	    var types = ['persons', 'institutions', 'titles', 'journals', 'publishers', 'places'];
 	    var forms = ['orig', 'translit', 'translat'];
 	    var affixList = [];
 	    for (var i = 0, ilen = types.length; i < ilen; i += 1) {
 		    Zotero_Preferences.Lang.affixListPush(types[i], "radio", "translit", affixList, "prefix");
 		    Zotero_Preferences.Lang.affixListPush(types[i], "radio", "translit", affixList, "suffix");
 		    for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
 			    Zotero_Preferences.Lang.affixListPush(types[i], "checkbox", forms[j], affixList, "prefix");
 			    Zotero_Preferences.Lang.affixListPush(types[i], "checkbox", forms[j], affixList, "suffix");
 		    }
 	    }
 	    var affixes = affixList.join('|');
 	    Zotero.Prefs.set('csl.citationAffixes', affixes);
    },
    
    affixListPush: function (type, boxtype, form, lst, affix) {
 	    var elem = document.getElementById(type + "-" + boxtype + "-" + form + "-" +affix);
 	    if (!elem.value) {
 		    elem.value = "";
 	    }
 	    lst.push(elem.value);
    },
    
    citationGetAffixes: function () {
        // Hurray. For UI, all we need now is a function to apply the stored
        // affixes back into nodes.
 	    var affixList = Zotero.Prefs.get('csl.citationAffixes');
 	    if (affixList) {
 		    affixList = affixList.split('|');
 	    } else {
 		    affixList = '|||||||||||||||||||||||||||||||||||||||'.split('|');
 	    }
 	    var types = ['persons', 'institutions', 'titles', 'publishers', 'places'];
 	    var forms = ['orig', 'translit', 'translat'];
 	    var count = 0;
 	    for (var i = 0, ilen = types.length; i < ilen; i += 1) {
 		    count =  Zotero_Preferences.Lang.citationGetAffixesAction(types[i], "radio", "translit", affixList, count);
            
 		    for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
 			    count = Zotero_Preferences.Lang.citationGetAffixesAction(types[i], "checkbox", forms[j], affixList, count);
 		    }
 	    }
    },
    
    citationGetAffixesAction: function (type, boxtype, form, affixList, count) {
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

