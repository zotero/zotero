/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Center for History and New Media
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

let io = window.arguments[0];
if (io.wrappedJSObject) io = io.wrappedJSObject;

function load() {
	let { filename } = io.dataIn;

	document.title = Zotero.getString('ingester.importFile.title');

	document.getElementById('select-target-text').value
		= Zotero.getString('ingester.importFile.text', filename);

	let menulist = document.getElementById('select-target-menu');
	let libraries = Zotero.Libraries.getAll().filter(lib => lib.editable);
	Zotero.Utilities.Internal.buildLibraryMenu(
		menulist,
		libraries,
		Zotero.getActiveZoteroPane().getSelectedLibraryID()
	);

	let checkbox = document.getElementById('select-target-checkbox');
	checkbox.setAttribute('label', Zotero.getString('ingester.importFile.intoNewCollection'));
	checkbox.checked = Zotero.Prefs.get('import.createNewCollection.fromFileOpenHandler');
}

function accept() {
	let selected = document.getElementById('select-target-menu').selectedItem.value;
	io.dataOut.libraryID = selected;
	let createNewCollection = document.getElementById('select-target-checkbox').checked;
	io.dataOut.createNewCollection = createNewCollection;
	Zotero.Prefs.set('import.createNewCollection.fromFileOpenHandler', createNewCollection);
}
