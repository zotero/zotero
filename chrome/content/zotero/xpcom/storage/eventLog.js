/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2012 Center for History and New Media
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

Zotero.Sync.Storage.EventLog = (function () {
	// Non-library-specific
	var _general = { warnings: [], errors: [] };
	// Library-specific
	var _warnings = {};
	var _errors = {};
	
	function call(type, data, libraryID) {
		if (libraryID) {
			switch (type) {
			case 'warning':
				var target = _general.warnings;
				break;
			
			case 'error':
				var target = _general.errors;
				break;
			}
		}
		else {
			switch (type) {
			case 'warning':
				var target = _warnings;
				break;
			
			case 'error':
				var target = _errors;
				break;
			}
		}
		
		if (!target[libraryID]) {
			target[libraryID] = [];
		}
		
		target[libraryID].push(data);
		
		Zotero.debug(data, type == 'error' ? 1 : 2);
		Components.utils.reportError(new Error(data));
	}
	
	return {
		error: function (e, libraryID) call('error', e, libraryID),
		warning: function (e, libraryID) call('warning', e, libraryID),
		
		clear: function (libraryID) {
			var queues = Zotero.Sync.Storage.QueueManager.getAll();
			for each(var queue in queues) {
				if (queue.isRunning()) {
					Zotero.debug(queue.name[0].toUpperCase() + queue.name.substr(1)
						+ " queue not empty -- not clearing storage sync event observers");
					return;
				}
			}
			
			if (typeof libraryID == 'undefined') {
				Zotero.debug("Clearing file sync event log");
				_general = { warnings: [], errors: [] };
				_warnings = {};
				_errors = {};
			}
			else {
				Zotero.debug("Clearing file sync event log for library " + libraryID);
				_warnings[libraryID] = [];
				_errors[libraryID] = [];
			}
		}
	};
}());
