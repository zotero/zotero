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

var Zotero_Captcha = new function() {
	this._io;
	
	this.onLoad = function() {
		this._io = window.arguments[0];
		var description = document.getElementById('zotero-captcha-description'),
			errorMsg = document.getElementById('zotero-captcha-error');
		
		if(this._io.dataIn.title) {
			document.title = this._io.dataIn.title;
		}
		
		if(this._io.dataIn.description) {
			description.textContent = this._io.dataIn.description;
			description.hidden = false;
		} else {
			description.hidden = true;
		}
		
		if(this._io.dataIn.error) {
			errorMsg.textContent = this._io.dataIn.error;
			errorMsg.hidden = false;
		} else {
			errorMsg.hidden = true;
		}
		
		document.getElementById('zotero-captcha-image').src = this._io.dataIn.imgUrl;
		document.getElementById('zotero-captcha-input').focus();
	}
	
	this.imageOnLoad = function() {
		window.sizeToContent();
	}
	
	this.resolve = function() {
		var result = document.getElementById('zotero-captcha-input');
		if(!result.value) return;
		
		this._io.dataOut = {
			captcha: result.value
		};
		window.close();
	}
	
	this.cancel = function() {
		window.close();
	}
}