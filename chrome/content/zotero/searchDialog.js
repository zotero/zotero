var itemsView;
var collectionsView;
var io;

function doLoad()
{
	// Set font size from pref
	var sbc = document.getElementById('zotero-search-box-container');
	Zotero.setFontSize(sbc);
	
	io = window.arguments[0];
	
	document.getElementById('search-box').search = io.dataIn.search;
	document.getElementById('search-name').value = io.dataIn.name;
}

function doUnload()
{

}

function doAccept()
{
	document.getElementById('search-box').search.name = document.getElementById('search-name').value;
	try {
		io.dataOut = document.getElementById('search-box').save();
	}
	catch (e) {
		Zotero.debug(e, 1);
		Components.utils.reportError(e);
		throw (e);
	}
}