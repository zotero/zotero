// Matching a statement against a formula
//
//
// W3C open source licence 2005.
//
// We retpresent a set as an associative array whose value for
// each member is set to true.

/* Not used, bogus. See identity.js for the ones really used.
RDFFormula.prototype.statementsMatching = function(s,p,o,w) {
    var results = []
    var i
    var ls = this.statements.length
    for (i=0; i<ls; i++) {
	var st = this.statements[i]
	if (RDFTermMatch(p, st.predicate) &&  // first as simplest
	    RDFTermMatch(s, st.subject) &&
	    RDFTermMatch(o, st.object) &&
	    RDFTermMatch(w, st.why)) {
		results[st] = true          @@@@ sould use numeric indexed array
	}
	    
    }
    return results
}

RDFFormula.prototype.anyStatementMatching = function(s,p,o,w) {
    var ls = this.statements.length
    var i
    for (i=0; i<ls; i++) {
	var st = this.statements[i]
	if (RDFTermMatch(p, st.predicate) &&  // first as simplest
	    RDFTermMatch(s, st.subject) &&
	    RDFTermMatch(o, st.object) &&
	    RDFTermMatch(w, st.why)) {
		return st
	}
	    
    }
    return undefined
}

*/

function RDFTermMatch(pattern, term) {
    if (typeof pattern == 'undefined') return true;
    return pattern.sameTerm(term)
}

RDFSymbol.prototype.sameTerm = function(other) {
    if (!other) { return false }
    return ((this.termType == other.termType) && (this.uri == other.uri))
}

RDFBlankNode.prototype.sameTerm = function(other) {
    if (!other) { return false }
    return ((this.termType == other.termType) && (this.id == other.id))
}

RDFLiteral.prototype.sameTerm = function(other) {
    if (!other) { return false }
    return ((this.termType == other.termType)
	    && (this.value == other.value)
	    && (this.lang == other.lang) &&
	    ((!this.datatype && !other.datatype)
	     || this.datatype.sameTerm(other.datatype)))
}

RDFVariable.prototype.sameTerm = function (other) {
    if (!other) { return false }
    return((this.termType == other.termType) && (this.uri == other.uri))
}

RDFCollection.prototype.sameTerm = RDFBlankNode.prototype.sameTerm

RDFFormula.prototype.sameTerm = function (other) {
    return this.hashString() == other.hashString();
}
//  Comparison for ordering
//
// These compare with ANY term
//
//
// When we smush nodes we take the lowest value. This is not
// arbitrary: we want the value actually used to be the literal
// (or list or formula). 

RDFLiteral.prototype.classOrder = 1
// RDFList.prototype.classOrder = 2
// RDFSet.prototype.classOrder = 3
RDFCollection.prototype.classOrder = 3
RDFFormula.prototype.classOrder = 4
RDFSymbol.prototype.classOrder = 5
RDFBlankNode.prototype.classOrder = 6

//  Compaisons return  sign(self - other)
//  Literals must come out before terms for smushing

RDFLiteral.prototype.compareTerm = function(other) {
    if (this.classOrder < other.classOrder) return -1
    if (this.classOrder > other.classOrder) return +1
    if (this.value < other.value) return -1
    if (this.value > other.value) return +1
    return 0
} 

RDFSymbol.prototype.compareTerm = function(other) {
    if (this.classOrder < other.classOrder) return -1
    if (this.classOrder > other.classOrder) return +1
    if (this.uri < other.uri) return -1
    if (this.uri > other.uri) return +1
    return 0
} 

RDFBlankNode.prototype.compareTerm = function(other) {
    if (this.classOrder < other.classOrder) return -1
    if (this.classOrder > other.classOrder) return +1
    if (this.id < other.id) return -1
    if (this.id > other.id) return +1
    return 0
} 

RDFCollection.prototype.compareTerm = RDFBlankNode.prototype.compareTerm

//  Convenience routines

// Only one of s p o can be undefined, and w is optional.
RDFFormula.prototype.each = function(s,p,o,w) {
    var results = []
    var st, sts = this.statementsMatching(s,p,o,w)
    var i, n=sts.length
    if (typeof s == 'undefined') {
	for (i=0; i<n; i++) {st=sts[i]; results.push(st.subject)}
    } else if (typeof p == 'undefined') {
	for (i=0; i<n; i++) {st=sts[i]; results.push(st.predicate)}
    } else if (typeof o == 'undefined') {
	for (i=0; i<n; i++) {st=sts[i]; results.push(st.object)}
    } else if (typeof w == 'undefined') {
	for (i=0; i<n; i++) {st=sts[i]; results.push(st.why)}
    }
    return results
}

RDFFormula.prototype.any = function(s,p,o,w) {
    var st = this.anyStatementMatching(s,p,o,w)
    if (typeof st == 'undefined') return undefined;
    
    if (typeof s == 'undefined') return st.subject;
    if (typeof p == 'undefined') return st.predicate;
    if (typeof o == 'undefined') return st.object;

    return undefined
}

RDFFormula.prototype.the = function(s,p,o,w) {
    // the() should contain a check there is only one
    var x = this.any(s,p,o,w)
    if (typeof x == 'undefined')
	tabulator.log.error("No value found for the(){" + s + " " + p + " " + o + "}.")
    return x
}

RDFFormula.prototype.whether = function(s,p,o,w) {
    return this.statementsMatching(s,p,o,w).length;
}
 
// Not a method. For use in sorts
function RDFComparePredicateObject(self, other) {
    var x = self.predicate.compareTerm(other.predicate)
    if (x !=0) return x
    return self.object.compareTerm(other.object)
}
function RDFComparePredicateSubject(self, other) {
    var x = self.predicate.compareTerm(other.predicate)
    if (x !=0) return x
    return self.subject.compareTerm(other.subject)
}
// ends
