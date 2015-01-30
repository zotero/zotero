/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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

const TRANSLATOR_CODE_PREFIX = "translatorCode-";
Zotero.Repo = new function() {
	var _nextCheck;
	var _timeoutID;
	const infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;
	
	this.SOURCE_ZOTERO_STANDALONE = 1;
	this.SOURCE_REPO = 2;
	
	/**
	 * Try to retrieve translator metadata from Zotero Standalone and initialize repository check
	 * timer
	 */
	this.init = function() {
		// get time of next check
		_nextCheck = Zotero.Prefs.get("connector.repo.lastCheck.localTime")
			+ZOTERO_CONFIG.REPOSITORY_CHECK_INTERVAL*1000;
		
		// update from standalone, but only cascade to repo if we are overdue
		_updateFromStandalone(_nextCheck <= Date.now());
	};
	
	/**
	 * Force updating translators
	 */
	var update = this.update = function(reset) {
		_updateFromStandalone(true, reset);
	};
	
	/**
	 * Get translator code from repository
	 * @param {String} translatorID ID of the translator to retrieve code for
	 * @param {Function} callback Callback to pass code when retreived
	 */
	this.getTranslatorCode = function(translatorID, callback) {
		// try standalone
		Zotero.Connector.callMethod("getTranslatorCode", {"translatorID":translatorID}, function(result) {
			if(result) {
				_haveCode(result, translatorID, Zotero.Repo.SOURCE_ZOTERO_STANDALONE, callback);
				return;
			}
			
			// then try repo
			Zotero.HTTP.doGet(ZOTERO_CONFIG.REPOSITORY_URL + "code/" + translatorID + "?version=" + Zotero.version,
				function(xmlhttp) {
					_haveCode(xmlhttp.status === 200 ? xmlhttp.responseText : false, translatorID,
						Zotero.Repo.SOURCE_REPO, callback);
				}
			);
		});
	};
	
	/**
	 * Called when code has been retrieved from standalone or repo
	 */
	function _haveCode(code, translatorID, source, callback) {
		if(!code) {
			Zotero.logError(new Error("Code could not be retrieved for " + translatorID));
			callback(false);
			return;
		}
		
		if(!Zotero.isFx) {
			code = Zotero.Translators.preprocessCode(code);
			
			var m = infoRe.exec(code);
			if (!m) {
				Zotero.logError(new Error("Invalid or missing translator metadata JSON object for " + translatorID));
				callback(false);
				return;
			}
			
			try {
				var metadata = JSON.parse(m[0]);
			} catch(e) {
				Zotero.logError(new Error("Invalid or missing translator metadata JSON object for " + translatorID));
				callback(false);
				return;
			}
			
			var translator = Zotero.Translators.getWithoutCode(translatorID);
			
			if(metadata.lastUpdated !== translator.lastUpdated) {
				if(Zotero.Date.sqlToDate(metadata.lastUpdated) > Zotero.Date.sqlToDate(translator.lastUpdated)) {
					Zotero.debug("Repo: Retrieved code for "+metadata.label+" newer than stored metadata; updating");
					Zotero.Translators.update([metadata]);
				} else {
					Zotero.debug("Repo: Retrieved code for "+metadata.label+" older than stored metadata; not caching");
				}
			}
		}
		callback(code, source);
	}
	
	/**
	 * Retrieve translator metadata from Zotero Standalone
	 * @param {Boolean} [tryRepoOnFailure] If true, run _updateFromRepo() if standalone cannot be
	 *                                     contacted
	 */
	function _updateFromStandalone(tryRepoOnFailure, reset, callback) {
		Zotero.Connector.callMethod("getTranslators", {}, function(result) {
			if(!result && tryRepoOnFailure) {
				_updateFromRepo(reset, callback);
			} else {
				_handleResponse(result, reset);
				if(callback) callback(!!result);
			}
		});
	}
	
	/**
	 * Retrieve metadata from repository
	 */
	function _updateFromRepo(reset, callback) {
		var url = ZOTERO_CONFIG.REPOSITORY_URL + "metadata?version=" + Zotero.version + "&last="+
				(reset ? "0" : Zotero.Prefs.get("connector.repo.lastCheck.repoTime"));
		
		Zotero.HTTP.doGet(url, function(xmlhttp) {
			var success = xmlhttp.status === 200;
			_handleResponse(success ? JSON.parse(xmlhttp.responseText) : false, reset);
			
			if(success) {
				var date = xmlhttp.getResponseHeader("Date");
				Zotero.Prefs.set("connector.repo.lastCheck.repoTime",
					Math.floor(Date.parse(date)/1000));
			}
			if(callback) callback(!!result);
		});
	}
	
	/**
	 * Handle response from Zotero Standalone or repository and set timer for next update
	 */
	function _handleResponse(result, reset) {
		// set up timer
		var now = Date.now();
		
		if(result) {
			Zotero.Translators.update(result, reset);
			Zotero.Prefs.set("connector.repo.lastCheck.localTime", now);
			Zotero.debug("Repo: Check succeeded");
		} else {
			Zotero.debug("Repo: Check failed");
		}
		
		if(result || _nextCheck <= now) {
			// if we failed a scheduled check, then use retry interval
			_nextCheck = now+(result
				? ZOTERO_CONFIG.REPOSITORY_CHECK_INTERVAL
				: ZOTERO_CONFIG.REPOSITORY_RETRY_INTERVAL)*1000;
		} else if(_timeoutID) {
			// if we didn't fail a scheduled check and another is already scheduled, leave it
			return;
		}
		
		// remove old timeout and create a new one
		if(_timeoutID) clearTimeout(_timeoutID);
		var nextCheckIn = (_nextCheck-now+2000);
		_timeoutID = setTimeout(update, nextCheckIn);
		Zotero.debug("Repo: Next check in "+nextCheckIn);
	}
}