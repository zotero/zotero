/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
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

"use strict";

{
	/**
	 * Extends MozToolbarbutton to use our own dropmarker image.
	 */
	class ToolbarbuttonDropmarker extends customElements.get('toolbarbutton') {
		static get dropmarkerFragment() {
			let frag = document.importNode(
				MozXULElement.parseXULToFragment(`
					<image src="chrome://zotero/skin/searchbar-dropmarker${Zotero.hiDPISuffix}.png" width="7" height="4"/>
				`),
				true
			);
			Object.defineProperty(this, "dropmarkerFragment", { value: frag });
			return frag;
		}
	}

	customElements.define("toolbarbutton-dropmarker", ToolbarbuttonDropmarker, {
		extends: "toolbarbutton",
	});
}
