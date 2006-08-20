//////////////////////////////////////////////////////////////////////////////
//
// Scholar_File_Interface_Export
//
//////////////////////////////////////////////////////////////////////////////

// Class to provide options for export

var Scholar_File_Interface_Export = new function() {
	var _options;
	
	this.init = init;
	this.accept = accept;
	this.cancel = cancel;
	
	/*
	 * add options to export
	 */
	function init() {
		_options = window.arguments[0].options;
		
		// add options to dialog
		var dialog = document.getElementById("scholar-export-options");
		for(var option in _options) {
			var defValue = _options[option];
			
			// get readable name for option
			try {
				var optionLabel = Scholar.getString("exportOptions."+option);
			} catch(e) {
				var optionLabel = option;
			}
			
			// right now, option interface supports only boolean values, which
			// it interprets as checkboxes
			Scholar.debug(option+" ("+optionLabel+") = "+defValue+" ("+typeof(defValue)+")");
			if(typeof(defValue) == "boolean") {
				var checkbox = document.createElement("checkbox");
				checkbox.setAttribute("id", option);
				checkbox.setAttribute("label", optionLabel);
				checkbox.setAttribute("checked", (defValue ? "true" : "false"));
				dialog.appendChild(checkbox);
			}
		}
	}
	
	/*
	 * make option array reflect status
	 */
	function accept() {
		for(var option in _options) {
			var defValue = _options[option];
			var element = document.getElementById(option);
			
			if(typeof(defValue) == "boolean") {
				if(element.checked == true) {
					_options[option] = true;
				} else {
					_options[option] = false;
				}
			}
		}
	}
	
	/*
	 * make option array reflect status
	 */
	function cancel() {
		window.arguments[0].options = false;
	}
}