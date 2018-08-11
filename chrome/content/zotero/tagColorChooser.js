/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2013 Center for History and New Media
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

var Zotero_Tag_Color_Chooser = new function() {
	var _io;
	
	this.init = function () {
		var dialog = document.getElementById('tag-color-chooser');
		
		try {
			// Set font size from pref
			Zotero.setFontSize(document.getElementById("tag-color-chooser-container"));
			
			if (window.arguments && window.arguments.length) {
				_io = window.arguments[0];
				if (_io.wrappedJSObject) _io = _io.wrappedJSObject;
			}
			if (typeof _io.libraryID == 'undefined') throw new Error("libraryID not set");
			if (typeof _io.name == 'undefined' || _io.name === "") throw new Error("name not set");
			if (_io.tagColors === undefined) throw new Error("tagColors not provided");
			
			window.sizeToContent();
			
			var colorPicker = document.getElementById('color-picker');
			var tagPosition = document.getElementById('tag-position');
			
			colorPicker.setAttribute('cols', 3);
			colorPicker.setAttribute('tileWidth', 24);
			colorPicker.setAttribute('tileHeight', 24);
			colorPicker.colors = [
				'#FF6666', '#FF8C19', '#999999',
				'#5FB236', '#009980', '#2EA8E5',
				'#576DD9', '#A28AE5', '#A6507B'
			];
			
			var maxTags = document.getElementById('max-tags');
			maxTags.value = Zotero.getString('tagColorChooser.maxTags', Zotero.Tags.MAX_COLORED_TAGS);
			
			var tagColors = _io.tagColors;
			var colorData = tagColors.get(_io.name);
			
			// Color
			if (colorData) {
				colorPicker.color = colorData.color;
				dialog.buttons = "extra1,cancel,accept";
			}
			else {
				// Get unused color at random
				var usedColors = [];
				for (let x of tagColors.values()) {
					usedColors.push(x.color);
				}
				var unusedColors = Zotero.Utilities.arrayDiff(
					colorPicker.colors, usedColors
				);
				var color = unusedColors[Zotero.Utilities.rand(0, unusedColors.length - 1)];
				colorPicker.color = color;
				dialog.buttons = "cancel,accept";
			}
			colorPicker.setAttribute('disabled', 'false');
			
			var numColors = tagColors.size;
			var max = colorData ? numColors : numColors + 1;
			
			// Position
			for (let i=1; i<=max; i++) {
				tagPosition.appendItem(i, i-1);
			}
			if (numColors) {
				tagPosition.setAttribute('disabled', 'false');
				if (colorData) {
					tagPosition.selectedIndex = colorData.position;
				}
				// If no color currently, default to end
				else {
					tagPosition.selectedIndex = numColors;
				}
			}
			// If no colors currently, only position "1" is available
			else {
				tagPosition.selectedIndex = 0;
			}
			
			this.onPositionChange();
			window.sizeToContent();
		}
		catch (e) {
			Zotero.logError(e);
			if (dialog.cancelDialog) {
				dialog.cancelDialog();
			}
		}
	};
	
	
	this.onPositionChange = function () {
		var tagPosition = document.getElementById('tag-position');
		var instructions = document.getElementById('number-key-instructions');
		
		while (instructions.hasChildNodes()) {
			instructions.removeChild(instructions.firstChild);
		}
		
		var msg = Zotero.getString('tagColorChooser.numberKeyInstructions');
		var matches = msg.match(/(.+)\$NUMBER(.+)/);
		
		var num = document.createElement('label');
		num.id = 'number-key';
		num.setAttribute('value', parseInt(tagPosition.value) + 1);
		
		if (matches) {
			instructions.appendChild(document.createTextNode(matches[1]));
			instructions.appendChild(num);
			instructions.appendChild(document.createTextNode(matches[2]));
		}
		// If no $NUMBER variable in translated string, fail as gracefully as possible
		else {
			instructions.appendChild(document.createTextNode(msg));
		}
	};
	
	
	this.onDialogAccept = function () {
		var colorPicker = document.getElementById('color-picker');
		var tagPosition = document.getElementById('tag-position');
		_io.color = colorPicker.color;
		_io.position = tagPosition.value;
	};
	
	
	this.onDialogCancel = function () {};
	
	
	this.onDialogRemoveColor = function () {
		_io.color = false;
		window.close();
	};
};
