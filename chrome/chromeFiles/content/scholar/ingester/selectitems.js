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
	this.documentObject = window.arguments[0];
	this.listbox = document.getElementById("scholar-selectitems-links");
	
	for(i in this.documentObject.scrapeURLList) {	// we could use a tree for this if we wanted to
		var itemNode = document.createElement("listitem");
		itemNode.setAttribute("type", "checkbox");
		itemNode.setAttribute("value", i);
		itemNode.setAttribute("label", this.documentObject.scrapeURLList[i]);
		itemNode.setAttribute("checked", false);
		this.listbox.appendChild(itemNode);
	}
}

Scholar_Ingester_Interface_SelectItems.acceptSelection = function() {
	// clear scrapeURLList
	this.documentObject.scrapeURLList = new Object();
	
	// collect scrapeURLList from listbox
	for(var i=0; i<this.listbox.length; i++) {
		var itemNode = this.listbox[i];
		this.documentObject.scrapeURLList[itemNode.getAttribute("value")] = itemNode.getAttribute("label");
	}
}