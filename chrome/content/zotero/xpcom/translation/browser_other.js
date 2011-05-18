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

/**
 * @class Manages the translator sandbox
 * @param {Zotero.Translate} translate
 * @param {String|window} sandboxLocation
 */
Zotero.Translate.SandboxManager = function(translate, sandboxLocation) {
	this.sandbox = {};
	this._translate = translate;
}

Zotero.Translate.SandboxManager.prototype = {
	/**
	 * Evaluates code in the sandbox
	 */
	"eval":function(code) {
		// eval in sandbox scope
		(new Function("with(this) { " + code + " }")).call(this.sandbox);
	},
	
	/**
	 * Imports an object into the sandbox
	 *
	 * @param {Object} object Object to be imported (under Zotero)
	 * @param {Boolean} passTranslateAsFirstArgument Whether the translate instance should be passed
	 *     as the first argument to the function.
	 */
	"importObject":function(object, passAsFirstArgument) {
		var translate = this._translate;
		
		for(var key in (object.__exposedProps__ ? object.__exposedProps__ : object)) {
			var fn = (function(object, key) { return object[key] })();
			
			// magic "this"-preserving wrapping closure
			this.sandbox[key] = function() {
				var args = (passAsFirstArgument ? [passAsFirstArgument] : []);
				for(var i=0; i<arguments.length; i++) args.push(arguments[i]);
				fn.apply(object, args);
			};
		}
	}
}