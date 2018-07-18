/* Set up the environment before loading the rest of the files into Zotero */
var $rdf = {
	Util: {
		ArrayIndexOf: function (arr, item, i) {
			//supported in all browsers except IE<9
			return arr.indexOf(item, i);
		},
		RDFArrayRemove: function (a, x) { //removes all statements equal to x from a
			for (var i = 0; i < a.length; i++) {
				//TODO: This used to be the following, which didnt always work..why
				//if(a[i] == x)
				if (a[i].subject.sameTerm(x.subject) && a[i].predicate.sameTerm(x.predicate) && a[i].object.sameTerm(x.object) && a[i].why.sameTerm(x.why)) {
					a.splice(i, 1);
					return;
				}
			}
			throw new Error("RDFArrayRemove: Array did not contain " + x);
		}
	},
	log: {
		debug: Zotero.debug,
		warn: Zotero.debug,
		error: Zotero.debug
	}
};

if(Zotero.RDF) {
	Zotero.RDF.AJAW = $rdf;
} else {
	Zotero.RDF = {AJAW:$rdf};
}

var tabulator = {log: $rdf.log};
var alert = $rdf.log.warn;
