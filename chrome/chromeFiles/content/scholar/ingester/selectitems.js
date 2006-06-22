//////////////////////////////////////////////////////////////////////////////
//
// Scholar_Ingester_Interface_SelectItems
//
//////////////////////////////////////////////////////////////////////////////

// Class to interface with the browser when ingesting data

Scholar_Ingester_Interface_SelectItems = function() {}

//////////////////////////////////////////////////////////////////////////////
//
// Public Scholar_Ingester_Interface_SelectItems methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Initialize some variables and prepare event listeners for when chrome is done
 * loading
 */
Scholar_Ingester_Interface_SelectItems.init = function() {
	this.io = window.arguments[0];
	this.Scholar_Ingester_Interface = window.arguments[1];
	this.listbox = document.getElementById("scholar-selectitems-links");
	
	for(i in this.io.dataIn) {	// we could use a tree for this if we wanted to
		var itemNode = document.createElement("listitem");
		itemNode.setAttribute("type", "checkbox");
		itemNode.setAttribute("value", i);
		itemNode.setAttribute("label", this.io.dataIn[i]);
		itemNode.setAttribute("checked", false);
		this.listbox.appendChild(itemNode);
	}
}

Scholar_Ingester_Interface_SelectItems.acceptSelection = function() {
	this.io.dataOut = new Object();
	
	// collect scrapeURLList from listbox
	for(var i=0; i<this.listbox.length; i++) {
		var itemNode = this.listbox[i];
		this.io.dataOut[itemNode.getAttribute("value")] = itemNode.getAttribute("label");
	}
}