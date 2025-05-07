/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2025 Corporation for Digital Scholarship
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

/**
 * Get the collapsed state of an <item-pane> or <context-pane>.
 *
 * @param {XULElement} pane
 * @returns {boolean}
 */
export function isPaneCollapsed(pane) {
	let collapsibleParent = pane.closest('splitter:not([hidden="true"]) + *');
	if (collapsibleParent.previousElementSibling?.localName !== 'splitter') {
		return false;
	}
	return collapsibleParent.getAttribute('collapsed') === 'true';
}

/**
 * Set the collapsed state of an <item-pane> or <context-pane>.
 *
 * @param {XULElement} pane
 * @param {boolean} collapsed
 */
export function setPaneCollapsed(pane, collapsed) {
	let collapsibleParent = pane.closest('splitter:not([hidden="true"]) + *');
	if (!collapsibleParent) {
		return;
	}
	let splitter = collapsibleParent.previousElementSibling;

	if (collapsed) {
		collapsibleParent.setAttribute('collapsed', 'true');
		collapsibleParent.removeAttribute('width');
		collapsibleParent.removeAttribute('height');
		splitter.setAttribute('state', 'collapsed');
		splitter.setAttribute('substate', 'after');
	}
	else {
		collapsibleParent.removeAttribute('collapsed');
		splitter.setAttribute('state', '');
		splitter.setAttribute('substate', 'after');
	}
	pane.ownerDocument.defaultView.dispatchEvent(new Event('resize'));
}
