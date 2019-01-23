/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2019 Center for History and New Media
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

'use strict';

module.exports = {
	getDragTargetOrient(event) {
		let elem = event.target;
		let {y, height} = elem.getBoundingClientRect();
		let ratio = (event.clientY - y) / height;
		// first 1/6 of the elem	([x-----])
		if (ratio <= 0.166) return -1;
		// 2/6 to 5/6 of the elem	([-xxxx-])
		else if (ratio <= 0.833) return 0;
		// last 5/6 of the elem		([-----x])
		else return 1;
	}
}