/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2016 Center for History and New Media
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

/**
 * @param {Boolean} [advanceToNextLibrary=false] - If true, continue with next library; if false, stop
 *     sync completely
 */
Zotero.Sync.UserCancelledException = function (advanceToNextLibrary) {
	this.message = "User cancelled sync";
	this.advanceToNextLibrary = advanceToNextLibrary;
}

Zotero.Sync.UserCancelledException.prototype = Object.create(Error.prototype);

Zotero.Sync.UserCancelledException.prototype.toString = function() {
	return this.message;
};
