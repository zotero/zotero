/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

var openURLServerField;
var openURLVersionMenu;

function init()
{
	// Display the appropriate modifier keys for the platform
	var rows = document.getElementById('zotero-prefpane-keys').getElementsByTagName('row');
	for (var i=0; i<rows.length; i++) {
		rows[i].firstChild.nextSibling.value = Zotero.isMac ? 'Cmd+Shift+' : 'Ctrl+Alt+';
	}
	
	populateQuickCopyList();
	updateQuickCopyInstructions();
}



function populateOpenURLResolvers() {
	var openURLMenu = document.getElementById('openURLMenu');
	
	var openURLResolvers = Zotero.OpenURL.discoverResolvers();
	for each(var r in openURLResolvers) {
		openURLMenu.insertItemAt(i, r.name);
		if (r.url == Zotero.Prefs.get('openURL.resolver') && r.version == Zotero.Prefs.get('openURL.version')) {
			openURLMenu.selectedIndex = i;
		}
	}
	
	var button = document.getElementById('openURLSearchButton');
	switch (openURLResolvers.length) {
		case 0:
			var num = 'zero';
			break;
		case 1:
			var num = 'singular';
			break;
		default:
			var num = 'plural';
	}
	
	button.setAttribute('label', Zotero.getString('zotero.preferences.openurl.resolversFound.' + num, openURLResolvers.length));
}


function populateQuickCopyList() {
	var formatMenu = document.getElementById("quickCopy-menu");
	var listbox = formatMenu.firstChild;
	var styles = Zotero.Cite.getStyles();
	
	var format = Zotero.Prefs.get("export.quickCopy.setting");
	
	// add styles to list
	for (i in styles) {
		var itemNode = document.createElement("menuitem");
		itemNode.setAttribute("value", i);
		itemNode.setAttribute("label", styles[i]);
		listbox.appendChild(itemNode);
		
		if (i == format) {
			formatMenu.selectedItem = itemNode;
		}
	}
	
	formatMenu.setAttribute('preference', "pref-quickCopy-setting");
}


function updateQuickCopyInstructions() {
	if (Zotero.isMac) {
		document.getElementById('quickCopy-macWarning').setAttribute('hidden', false);
	}
	
	var prefix = Zotero.isMac ? 'Cmd+Shift+' : 'Ctrl+Alt+';
	var key = Zotero.Prefs.get('keys.copySelectedItemsToClipboard');
	
	var instr = document.getElementById('quickCopy-instructions');
	var str = Zotero.getString('zotero.preferences.export.quickCopy.instructions', prefix + key);
	
	while (instr.hasChildNodes()) {
		instr.removeChild(instr.firstChild);
	}
	instr.appendChild(document.createTextNode(str));
}


function onOpenURLSelected()
{
	var openURLMenu = document.getElementById('openURLMenu');
	
	if(openURLMenu.value == "custom")
	{
		openURLServerField.focus();
	}
	else
	{
		openURLServerField.value = openURLResolvers[openURLMenu.selectedIndex]['url'];
		openURLVersionMenu.value = openURLResolvers[openURLMenu.selectedIndex]['version'];
	}
}

function onOpenURLCustomized()
{
	document.getElementById('openURLMenu').value = "custom";
}