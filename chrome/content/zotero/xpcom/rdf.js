// Tweaks to get the Tabulator RDF library to work without Tabulator. All of this happens in the
// Zotero.RDF.AJAW namespace.
var kb = new RDFIndexedFormula();
var tabulator = {log:{debug:function(arg) {
	Zotero.debug(arg);
}}};
