/*
    ***** BEGIN LICENSE BLOCK *****

    This is being contributed to the Zotero effort.  
    This shall be replaced with the Zotero license information.
    
    ***** END LICENSE BLOCK *****
*/

"use strict";

// onLoad is called after the dialog displays
function onLoad() {
}

// onOK is called once if and only if the user clicks OK
function onOK() {
	// Return the checked tags arguments.
	// Notice if user clicks cancel then this function is never called
	var tagsOnePerLine = "";
	var checkboxesArray = document.getElementsByClassName("zotero-tagsdialog-listbox-content-checkbox");
	for (let cb of checkboxesArray ) {
		if (cb.label != "?name" 
			&& cb.checked
			&& cb.disabled != true) {
			tagsOnePerLine += cb.label + "\r\n";
		}
	}
	let console = (Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console; 
	console.log(tagsOnePerLine);

	window.arguments[0].outVars = {tagsOnePerLine:tagsOnePerLine};
	return true;
}

/* NOTE:  HERE, IF DESIRED, IS CODE FOR LOGGING TO THE FIREFOX BROWSER CONSOLE FROM AN EXTENSION
// Log to the Firefox Browser Console from an extension. 
// This code is from https://developer.mozilla.org/en-US/docs/Tools/Browser_Console
let console = (Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console; 
console.log("my message");
*/