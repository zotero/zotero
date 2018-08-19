/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
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
Components.utils.import("resource://gre/modules/Services.jsm");

Zotero_Preferences.Search = {
	init: function () {
		document.getElementById('fulltext-rebuildIndex').setAttribute('label',
			Zotero.getString('zotero.preferences.search.rebuildIndex')
				+ Zotero.getString('punctuation.ellipsis'));
		document.getElementById('fulltext-clearIndex').setAttribute('label',
			Zotero.getString('zotero.preferences.search.clearIndex')
				+ Zotero.getString('punctuation.ellipsis'));
		
		this.updateIndexStats();
	},
	
	updateIndexStats: Zotero.Promise.coroutine(function* () {
		var stats = yield Zotero.Fulltext.getIndexStats();
		document.getElementById('fulltext-stats-indexed').
			lastChild.setAttribute('value', stats.indexed);
		document.getElementById('fulltext-stats-partial').
			lastChild.setAttribute('value', stats.partial);
		document.getElementById('fulltext-stats-unindexed').
			lastChild.setAttribute('value', stats.unindexed);
		document.getElementById('fulltext-stats-words').
			lastChild.setAttribute('value', stats.words);
	}),
	
	
	rebuildIndexPrompt: async function () {
		var buttons = [
			document.getElementById('fulltext-rebuildIndex'),
			document.getElementById('fulltext-clearIndex')
		];
		buttons.forEach(b => b.disabled = true);
		
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		
		var index = ps.confirmEx(null,
			Zotero.getString('zotero.preferences.search.rebuildIndex'),
			Zotero.getString('zotero.preferences.search.rebuildWarning',
				Zotero.getString('zotero.preferences.search.indexUnindexed')),
			buttonFlags,
			Zotero.getString('zotero.preferences.search.rebuildIndex'),
			null,
			// Position 2 because of https://bugzilla.mozilla.org/show_bug.cgi?id=345067
			Zotero.getString('zotero.preferences.search.indexUnindexed'),
			null, {});
		
		try {
			if (index == 0) {
				await Zotero.Fulltext.rebuildIndex();
			}
			else if (index == 2) {
				await Zotero.Fulltext.rebuildIndex(true)
			}
			
			await this.updateIndexStats();
		}
		catch (e) {
			Zotero.alert(null, Zotero.getString('general.error'), e);
		}
		finally {
			buttons.forEach(b => b.disabled = false);
		}
		
	},
	
	
	clearIndexPrompt: async function () {
		var buttons = [
			document.getElementById('fulltext-rebuildIndex'),
			document.getElementById('fulltext-clearIndex')
		];
		buttons.forEach(b => b.disabled = true);
		
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		
		var index = ps.confirmEx(null,
			Zotero.getString('zotero.preferences.search.clearIndex'),
			Zotero.getString('zotero.preferences.search.clearWarning',
				Zotero.getString('zotero.preferences.search.clearNonLinkedURLs')),
			buttonFlags,
			Zotero.getString('zotero.preferences.search.clearIndex'),
			null,
			// Position 2 because of https://bugzilla.mozilla.org/show_bug.cgi?id=345067
			Zotero.getString('zotero.preferences.search.clearNonLinkedURLs'), null, {});
		
		try {
			if (index == 0) {
				await Zotero.Fulltext.clearIndex();
			}
			else if (index == 2) {
				await Zotero.Fulltext.clearIndex(true);
			}
			
			await this.updateIndexStats();
		}
		catch (e) {
			Zotero.alert(null, Zotero.getString('general.error'), e);
		}
		finally {
			buttons.forEach(b => b.disabled = false);
		}
	}
};
