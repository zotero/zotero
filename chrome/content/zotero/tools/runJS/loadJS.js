/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2021 Corporation for Digital Scholarship
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

Components.utils.import("resource://gre/modules/osfile.jsm");

var RunJS_Load = new function () {
	this.onLoad = async function () {
		let listbox = document.getElementById('listbox');

		listbox.addEventListener('dblclick', () => {
			let path = document.getElementById('listbox').selectedItem.getUserData('path');
			if (!path) return;
			this.accept();
			window.close();
		});
		
		listbox.addEventListener('select', () => {
			if (document.getElementById('listbox').selectedIndex > -1) {
				document.documentElement.getButton("accept").disabled = false;
			}
		});

		// Make a separator
		let loading = document.createElement('listitem');
		loading.setAttribute('disabled', true);
		loading.setAttribute('label', 'Loading Scripts...');
		listbox.appendChild(loading);

		let listitem, listcell;
		await Zotero.File.iterateDirectory(Zotero.getScriptsDirectory().path, async (entry) => {
			if (entry.name.startsWith('.')) {
				return;
			}
			listitem = document.createElement('listitem');

			// set label for type-to-find functionality. This is not displayed.
			listitem.setAttribute('label', entry.name);

			// And the path goes in DOM user data
			listitem.setUserData('name', entry.name, null);

			listcell = document.createElement('listcell');
			listcell.setAttribute('label', entry.name);
			listitem.appendChild(listcell);
			listcell = document.createElement('listcell');
			let lastModified = (await OS.File.stat(entry.path)).lastModificationDate;
			listcell.setAttribute('label', lastModified.toLocaleString());
			listitem.appendChild(listcell);

			listbox.appendChild(listitem);
		});

		// Remove loading item
		listbox.removeChild(loading);
	};

	this.accept = function () {
		let name = document.getElementById('listbox').selectedItem.getUserData('name');
		window.arguments[0].dataOut = name;
	};
};
