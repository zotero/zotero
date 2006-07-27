//////////////////////////////////////////////////////////////////////////////
//
// Scholar_File_Interface_Bibliography
//
//////////////////////////////////////////////////////////////////////////////

// Class to provide options for bibliography

Scholar_File_Interface_Bibliography = new function() {
	var _io;
	
	this.init = init;
	this.acceptSelection = acceptSelection;
	
	/*
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 */
	function init() {
		_io = window.arguments[0];
		
		var listbox = document.getElementById("style-popup");
		var styles = Scholar.Cite.getStyles();
		
		var firstItem = true;
		for(i in styles) {
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("value", i);
			itemNode.setAttribute("label", styles[i]);
			listbox.appendChild(itemNode);
		}
		
		// select first item by default
		document.getElementById("style-menu").selectedIndex = 0;
		
		if(navigator.userAgent.toLowerCase().indexOf("mac") != -1) {
			// hack to eliminate clipboard option for mac users
			document.getElementById("output-radio").removeChild(document.getElementById("copy-to-clipboard"));
		}
	}

	function acceptSelection() {
		// collect code
		_io.style = document.getElementById("style-menu").selectedItem.value;
		_io.output = document.getElementById("output-radio").selectedItem.id;
	}
}