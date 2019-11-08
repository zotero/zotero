/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2019 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://digitalscholar.org
    
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

import { Cc, Ci, Cu } from 'chrome';
Cu.import("resource://gre/modules/osfile.jsm");

/**
 * Interface to the system filepicker.
 *
 * Based on Mozilla's nsIFilePicker, with minor modifications (e.g., strings paths instead nsIFile,
 * promise-returning show()).
 *
 * @class
 */
class FilePicker {
	constructor() {
		this._fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
	}
	
	/**
	 * @param {Window} parentWindow
	 * @param {String} title
	 * @param {Integer} mode - One of the mode constants, indicating the type of picker to create
	 */
	init(parentWindow, title, mode) {
		this._fp.init(parentWindow, title, mode);
	};
	
	/**
	 * Appends a custom file extension filter to the dialog. The filter appended first will be used when
	 * the dialog is initially opened. The user may then select another from the list.
	 *
	 * @param {String} title - The title of the filter
	 * @param {String} filter - The filter string. Multiple extensions may be included, separated by a
	 *   semicolon and a space.
	 */
	appendFilter(title, filter) {
		this._fp.appendFilter(title, filter);
	};
	
	/**
	 * Appends a list of file extension filters, from the predefined list, to the dialog
	 *
	 * @param {Integer} filterMask - A combination of the filters you wish to use. You may OR multiple
	 *   filters together; for example <code>filterAll | filterHTML</code>.
	 */
	appendFilters(filterMask) {
		this._fp.appendFilters(filterMask);
	};
	
	/**
	 * Show the dialog
	 *
	 * @return {Promise<Integer>} One of the return constants
	 */
	async show() {
		return new Zotero.Promise(function (resolve) {
			this._fp.open(returnConstant => resolve(returnConstant));
		}.bind(this));
	};
};


/** @const {Integer} FilePicker#modeOpen - Load a file */
/** @const {Integer} FilePicker#modeSave - Save a file */
/** @const {Integer} FilePicker#modeGetFolder - Select a folder/directory */
/** @const {Integer} FilePicker#modeOpenMultiple - Load multiple files */
FilePicker.prototype.modeOpen = 0;
FilePicker.prototype.modeSave = 1;
FilePicker.prototype.modeGetFolder = 2;
FilePicker.prototype.modeOpenMultiple = 3;

/** @const {Integer} FilePicker#returnOK - The file picker dialog was closed by the user hitting 'OK' */
/** @const {Integer} FilePicker#returnCancel - The file picker dialog was closed by the user hitting 'Cancel' */
/** @const {Integer} FilePicker#returnReplace - The user chose an existing file and acknowledged that they want to overwrite the file */
FilePicker.prototype.returnOK = 0;
FilePicker.prototype.returnCancel = 1;
FilePicker.prototype.returnReplace = 2;

/** @const {Integer} FilePicker#filterAll - All files */
/** @const {Integer} FilePicker#filterHTML - HTML files */
/** @const {Integer} FilePicker#filterText - Text files */
/** @const {Integer} FilePicker#filterImages - Image files */
/** @const {Integer} FilePicker#filterXML - XML files */
/** @const {Integer} FilePicker#filterApps - Platform-specific application filter */
/** @const {Integer} FilePicker#filterAllowURLs - Allow URLs */
/** @const {Integer} FilePicker#filterAudio - Audio files */
/** @const {Integer} FilePicker#filterVideo - Video files */
FilePicker.prototype.filterAll = 0x001;
FilePicker.prototype.filterHTML = 0x002;
FilePicker.prototype.filterText = 0x004;
FilePicker.prototype.filterImages = 0x008;
FilePicker.prototype.filterXML = 0x010;
FilePicker.prototype.filterApps = 0x040;
FilePicker.prototype.filterAllowURLs = 0x80;
FilePicker.prototype.filterAudio = 0x100;
FilePicker.prototype.filterVideo = 0x200;

['addToRecentDocs', 'defaultExtension', 'defaultString', 'displayDirectory', 'filterIndex'].forEach((prop) => {
	/**
	 * @name FilePicker#addToRecentDocs
	 * @type Boolean
	 * @default false
	 * @desc If true, the file is added to the operating system's "recent documents" list (if the
	 *   operating system has one; nothing happens if there is no such concept on the user's platform).
	 */
	/**
	 * @name FilePicker#defaultExtension
	 * @type String
	 * @desc The extension for the type of files you want to work with. On some platforms, this is
	 *   automatically appended to filenames the user enters, if required.  Specify it without a
	 *   leading dot, for example "jpg".
	 */
	/**
	 * @name FilePicker#defaultString
	 * @type String
	 * @desc The filename, including extension, that should be suggested to the user as a default.
	 *   This should be set before calling show().
	*/
	/**
	 * @name FilePicker#displayDirectory
	 * @type String
	 * @desc The filename, including extension, that should be suggested to the user as a default.
	 *   This should be set before calling show().
	 */
	/**
	 * @name FilePicker#filterIndex
	 * @type Integer
	 * @desc The (0-based) index of the filter which is currently selected in the file picker dialog.
	 *   Set this to choose a particular filter to be selected by default.
	 */
	Object.defineProperty(FilePicker.prototype, prop, {
		// TODO: Others
		get: function () {
			var val = this._fp[prop];
			if (prop == 'displayDirectory') {
				// Convert from nsIFile
				val = val.path;
			}
			return val;
		},
		set: function (val) {
			if (prop == 'displayDirectory') {
				// Convert to nsIFile
				val = Zotero.File.pathToFile(val);
			}
			this._fp[prop] = val;
		},
		enumerable: true
	});
});

// Read-only properties
['file', 'files', 'fileURL'].forEach((prop) => {
	/**
	 * @name FilePicker#file
	 * @type String
	 * @readonly
	 * @desc The selected file or directory.
	 */
	/**
	 * @name FilePicker#files
	 * @type String[]
	 * @readonly
	 * @desc An array of the selected files. Only works with `modeOpenMultiple` mode.
	 */
	/**
	 * @name FilePicker#fileURL
	 * @type String
	 * @readonly
	 * @desc The URI of the selected file or directory.
	 */
	Object.defineProperty(FilePicker.prototype, prop, {
		get: function () {
			var val = this._fp[prop];
			switch (prop) {
				case 'file':
					// Convert from nsIFile
					val = OS.Path.normalize(val.path);
					break;
				
				case 'files':
					var files = [];
					while (val.hasMoreElements()) {
						let file = val.getNext();
						file.QueryInterface(Ci.nsIFile);
						files.push(file.path);
					}
					val = files;
					break;
				
				case 'fileURL':
					val = val.spec;
					break;
			}
			return val;
		},
		enumerable: true
	});
});

Object.freeze(FilePicker.prototype);

export default FilePicker;