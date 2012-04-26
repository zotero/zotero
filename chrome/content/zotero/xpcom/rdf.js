// Tweaks to get the Tabulator RDF library to work without Tabulator. All of this happens in the
// Zotero.RDF.AJAW namespace.
$rdf.RDFIndexedFormula = $rdf.IndexedFormula;
$rdf.RDFSymbol = $rdf.Symbol;
$rdf.RDFBlankNode = $rdf.BlankNode;

Zotero.RDF.AJAW = $rdf;