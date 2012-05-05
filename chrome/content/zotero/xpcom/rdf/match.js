// Matching a statement against a formula
//
//
// W3C open source licence 2005.
//
// We retpresent a set as an associative array whose value for
// each member is set to true.
$rdf.Symbol.prototype.sameTerm = function (other) {
  if(!other) {
    return false
  }
  return((this.termType == other.termType) && (this.uri == other.uri))
}

$rdf.BlankNode.prototype.sameTerm = function (other) {
  if(!other) {
    return false
  }
  return((this.termType == other.termType) && (this.id == other.id))
}

$rdf.Literal.prototype.sameTerm = function (other) {
  if(!other) {
    return false
  }
  return((this.termType == other.termType)
    && (this.value == other.value)
    && (this.lang == other.lang)
    && ((!this.datatype && !other.datatype)
      || (this.datatype && this.datatype.sameTerm(other.datatype))))
}

$rdf.Variable.prototype.sameTerm = function (other) {
  if(!other) {
    return false
  }
  return((this.termType == other.termType) && (this.uri == other.uri))
}

$rdf.Collection.prototype.sameTerm = $rdf.BlankNode.prototype.sameTerm

$rdf.Formula.prototype.sameTerm = function (other) {
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
$rdf.Literal.prototype.classOrder = 1
$rdf.Collection.prototype.classOrder = 3
$rdf.Formula.prototype.classOrder = 4
$rdf.Symbol.prototype.classOrder = 5
$rdf.BlankNode.prototype.classOrder = 6

//  Compaisons return  sign(self - other)
//  Literals must come out before terms for smushing
$rdf.Literal.prototype.compareTerm = function (other) {
  if(this.classOrder < other.classOrder) return -1
  if(this.classOrder > other.classOrder) return +1
  if(this.value < other.value) return -1
  if(this.value > other.value) return +1
  return 0
}

$rdf.Symbol.prototype.compareTerm = function (other) {
  if(this.classOrder < other.classOrder) return -1
  if(this.classOrder > other.classOrder) return +1
  if(this.uri < other.uri) return -1
  if(this.uri > other.uri) return +1
  return 0
}

$rdf.BlankNode.prototype.compareTerm = function (other) {
  if(this.classOrder < other.classOrder) return -1
  if(this.classOrder > other.classOrder) return +1
  if(this.id < other.id) return -1
  if(this.id > other.id) return +1
  return 0
}

$rdf.Collection.prototype.compareTerm = $rdf.BlankNode.prototype.compareTerm

//  Convenience routines
// Only one of s p o can be undefined, and w is optional.
$rdf.Formula.prototype.each = function (s, p, o, w) {
  var results = []
  var st, sts = this.statementsMatching(s, p, o, w, false)
  var i, n = sts.length
  if(typeof s == 'undefined') {
    for(i = 0; i < n; i++) {
      st = sts[i];
      results.push(st.subject)
    }
  } else if(typeof p == 'undefined') {
    for(i = 0; i < n; i++) {
      st = sts[i];
      results.push(st.predicate)
    }
  } else if(typeof o == 'undefined') {
    for(i = 0; i < n; i++) {
      st = sts[i];
      results.push(st.object)
    }
  } else if(typeof w == 'undefined') {
    for(i = 0; i < n; i++) {
      st = sts[i];
      results.push(st.why)
    }
  }
  return results
}

$rdf.Formula.prototype.any = function (s, p, o, w) {
  var st = this.anyStatementMatching(s, p, o, w)
  if(typeof st == 'undefined') return undefined;

  if(typeof s == 'undefined') return st.subject;
  if(typeof p == 'undefined') return st.predicate;
  if(typeof o == 'undefined') return st.object;

  return undefined
}

$rdf.Formula.prototype.holds = function (s, p, o, w) {
  var st = this.anyStatementMatching(s, p, o, w)
  if(typeof st == 'undefined') return false;
  return true;
}

$rdf.Formula.prototype.the = function (s, p, o, w) {
  // the() should contain a check there is only one
  var x = this.any(s, p, o, w)
  if(typeof x == 'undefined')
    $rdf.log.error("No value found for the(){" + s + " " + p + " " + o + "}.")
  return x
}

$rdf.Formula.prototype.whether = function (s, p, o, w) {
  return this.statementsMatching(s, p, o, w, false).length;
}