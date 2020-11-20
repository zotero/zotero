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

"use strict";

var io;
let createParent;

function toggleAccept(enabled) {
	document.documentElement.getButton("accept").disabled = !enabled;
}

function doLoad() {
	// Set font size from pref
	let sbc = document.getElementById('zotero-create-parent-container');
	Zotero.setFontSize(sbc);

	io = window.arguments[0];

	createParent = document.getElementById('create-parent');
	Zotero.CreateParent.render(createParent, {
		loading: false,
		item: io.dataIn.item,
		toggleAccept
	});
}

function doUnload() {
	Zotero.CreateParent.destroy(createParent);
}

async function doAccept() {
	let textBox = document.getElementById('parent-item-identifier');
	let childItem = io.dataIn.item;
	let newItems = await Zotero_Lookup.addItemsFromIdentifier(
		textBox,
		childItem,
		(on) => {
			// Render react again with correct loading value
			Zotero.CreateParent.render(createParent, {
				loading: on,
				item: childItem,
				toggleAccept
			});
		}
	);

	// If we successfully created a parent, return it
	if (newItems) {
		io.dataOut = { parent: newItems[0] };
		window.close();
	}
}

function doManualEntry() {
	io.dataOut = { parent: false };
	window.close();
}
