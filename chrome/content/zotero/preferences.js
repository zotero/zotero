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

var autoUpdateBox;
var positionMenu;
var parseEndnoteBox;
var openURLMenu;
var openURLResolvers;
var openURLServerField;
var openURLVersionMenu;
var zoteroPaneOnTopInitial;

/*
	To add a new preference:
		1) modify defaults/preferences/zotero.js
		2) in this document:
			a) add var above
			b) add lines to init() function
			c) add line to accept() function
		3) add a control to prefs.xul
		4) (Optional) To add an observer for a preference change,
			add an appropriate case in the switch statement
			in Zotero.Prefs.observe()
*/

function init()
{	
	autoUpdateBox = document.getElementById('autoUpdateBox');
	autoUpdateBox.checked = Zotero.Prefs.get('automaticScraperUpdates');
	
	positionMenu = document.getElementById('positionMenu');
	positionMenu.selectedIndex = zoteroPaneOnTopInitial = Zotero.Prefs.get('zoteroPaneOnTop') ? 0 : 1;
	
	parseEndnoteBox = document.getElementById('parseEndnoteBox');
	parseEndnoteBox.checked = Zotero.Prefs.get('parseEndNoteMIMETypes');
	
	openURLServerField = document.getElementById('openURLServerField');
	openURLServerField.value = Zotero.Prefs.get('openURL.resolver');
	openURLVersionMenu = document.getElementById('openURLVersionMenu');
	openURLVersionMenu.value = Zotero.Prefs.get('openURL.version');

	openURLMenu = document.getElementById('openURLMenu');

	openURLResolvers = Zotero.OpenURL.discoverResolvers();
	for(var i in openURLResolvers)
	{
		openURLMenu.insertItemAt(i,openURLResolvers[i]['name']);
		if(openURLResolvers[i]['url'] == Zotero.Prefs.get('openURL.resolver') && openURLResolvers[i]['version'] == Zotero.Prefs.get('openURL.version'))
			openURLMenu.selectedIndex = i;
	}
}

function accept()
{
	Zotero.Prefs.set('automaticScraperUpdates', autoUpdateBox.checked);
	Zotero.Prefs.set('zoteroPaneOnTop', positionMenu.selectedIndex == 0);
	
	if(Zotero.Prefs.get('parseEndNoteMIMETypes') != parseEndnoteBox.checked)
	{
		Zotero.Prefs.set('parseEndNoteMIMETypes', parseEndnoteBox.checked);
		Zotero.Ingester.MIMEHandler.init();
	}
	
	Zotero.Prefs.set('openURL.resolver', openURLServerField.value);
	Zotero.Prefs.set('openURL.version', openURLVersionMenu.value);
}

function onOpenURLSelected()
{
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
	openURLMenu.value = "custom";
}

function onPositionChange()
{
	var statusLine = document.getElementById('statusLine');
	if (positionMenu.selectedIndex != zoteroPaneOnTopInitial)
	{
		statusLine.value = Zotero.getString('zotero.preferences.status.positionChange');
	}
	else
	{
		statusLine.value = '';
	}
}