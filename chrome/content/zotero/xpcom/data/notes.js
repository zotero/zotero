/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/


Zotero.Notes = new function() {
	this.noteToTitle = noteToTitle;
	
	this.__defineGetter__("MAX_TITLE_LENGTH", function() { return 80; });
	
	/**
	* Return first line (or first MAX_LENGTH characters) of note content
	**/
	function noteToTitle(text) {
		var max = this.MAX_TITLE_LENGTH;
		
		var t = text.substring(0, max);
		var ln = t.indexOf("\n");
		if (ln>-1 && ln<max) {
			t = t.substring(0, ln);
		}
		return t;
	}
}

