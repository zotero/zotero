// These are the classes corresponding to the RDF and N3 data models
//
// Designed to look like rdflib and cwm designs.
//
// Issues: Should the names start with RDF to make them
//      unique as program-wide symbols?
//
// W3C open source licence 2005.
//
//	Symbol
$rdf.Empty = function () {
  return this;
};

$rdf.Empty.prototype.termType = 'empty';
$rdf.Empty.prototype.toString = function () {
  return "()"
};
$rdf.Empty.prototype.toNT = $rdf.Empty.prototype.toString;

$rdf.Symbol = function (uri) {
  this.uri = uri;
  this.value = uri; // -- why? -tim
  return this;
}

$rdf.Symbol.prototype.termType = 'symbol';
$rdf.Symbol.prototype.toString = function () {
  return("<" + this.uri + ">");
};
$rdf.Symbol.prototype.toNT = $rdf.Symbol.prototype.toString;

//  Some precalculated symbols
$rdf.Symbol.prototype.XSDboolean = new $rdf.Symbol('http://www.w3.org/2001/XMLSchema#boolean');
$rdf.Symbol.prototype.XSDdecimal = new $rdf.Symbol('http://www.w3.org/2001/XMLSchema#decimal');
$rdf.Symbol.prototype.XSDfloat = new $rdf.Symbol('http://www.w3.org/2001/XMLSchema#float');
$rdf.Symbol.prototype.XSDinteger = new $rdf.Symbol('http://www.w3.org/2001/XMLSchema#integer');
$rdf.Symbol.prototype.XSDdateTime = new $rdf.Symbol('http://www.w3.org/2001/XMLSchema#dateTime');
$rdf.Symbol.prototype.integer = new $rdf.Symbol('http://www.w3.org/2001/XMLSchema#integer'); // Used?
//	Blank Node
if(typeof $rdf.NextId != 'undefined') {
  $rdf.log.error('Attempt to re-zero existing blank node id counter at ' + $rdf.NextId);
} else {
  $rdf.NextId = 0; // Global genid
}
$rdf.NTAnonymousNodePrefix = "_:n";

$rdf.BlankNode = function (id) {
  /*if (id)
    	this.id = id;
    else*/
  this.id = $rdf.NextId++;
  this.value = id ? id : this.id.toString();
  return this
};

$rdf.BlankNode.prototype.termType = 'bnode';
$rdf.BlankNode.prototype.toNT = function () {
  return $rdf.NTAnonymousNodePrefix + this.id
};
$rdf.BlankNode.prototype.toString = $rdf.BlankNode.prototype.toNT;

//	Literal
$rdf.Literal = function (value, lang, datatype) {
  this.value = value
  if(lang == "" || lang == null) this.lang = undefined;
  else this.lang = lang; // string
  if(datatype == null) this.datatype = undefined;
  else this.datatype = datatype; // term
  return this;
}

$rdf.Literal.prototype.termType = 'literal'
$rdf.Literal.prototype.toString = function () {
  return '' + this.value;
};
$rdf.Literal.prototype.toNT = function () {
  var str = this.value
  if(typeof str != 'string') {
    if(typeof str == 'number') return '' + str;
    throw Error("Value of RDF literal is not string: " + str)
  }
  str = str.replace(/\\/g, '\\\\'); // escape backslashes
  str = str.replace(/\"/g, '\\"'); // escape quotes
  str = str.replace(/\n/g, '\\n'); // escape newlines
  str = '"' + str + '"' //';
  if(this.datatype) {
    str = str + '^^' + this.datatype.toNT()
  }
  if(this.lang) {
    str = str + "@" + this.lang;
  }
  return str;
};

$rdf.Collection = function () {
  this.id = $rdf.NextId++; // Why need an id? For hashstring.
  this.elements = [];
  this.closed = false;
};

$rdf.Collection.prototype.termType = 'collection';

$rdf.Collection.prototype.toNT = function () {
  return $rdf.NTAnonymousNodePrefix + this.id
};

$rdf.Collection.prototype.toString = function () {
  var str = '(';
  for(var i = 0; i < this.elements.length; i++)
  str += this.elements[i] + ' ';
  return str + ')';
};

$rdf.Collection.prototype.append = function (el) {
  this.elements.push(el)
}
$rdf.Collection.prototype.unshift = function (el) {
  this.elements.unshift(el);
}
$rdf.Collection.prototype.shift = function () {
  return this.elements.shift();
}

$rdf.Collection.prototype.close = function () {
  this.closed = true
}


//      Convert Javascript representation to RDF term object
//
$rdf.term = function (val) {
  if(typeof val == 'object')
    if(val instanceof Date) {
      var d2 = function (x) {
          return('' + (100 + x)).slice(1, 3)
        }; // format as just two digits
      return new $rdf.Literal('' + val.getUTCFullYear() + '-' + d2(val.getUTCMonth() + 1)
          + '-' + d2(val.getUTCDate()) + 'T' + d2(val.getUTCHours()) + ':'
          + d2(val.getUTCMinutes()) + ':' + d2(val.getUTCSeconds()) + 'Z',
        undefined,
        $rdf.Symbol.prototype.XSDdateTime);

    } else if(val instanceof Array) {
      var x = new $rdf.Collection();
      for(var i = 0; i < val.length; i++)
        x.append($rdf.term(val[i]));
      return x;
    } else
      return val;
  if(typeof val == 'string')
    return new $rdf.Literal(val);
  if(typeof val == 'number') {
    var dt;
    if(('' + val).indexOf('e') >= 0) dt = $rdf.Symbol.prototype.XSDfloat;
    else if(('' + val).indexOf('.') >= 0) dt = $rdf.Symbol.prototype.XSDdecimal;
    else dt = $rdf.Symbol.prototype.XSDinteger;
    return new $rdf.Literal(val, undefined, dt);
  }
  if(typeof val == 'boolean')
    return new $rdf.Literal(val ? "1" : "0", undefined, $rdf.Symbol.prototype.XSDboolean);
  if(typeof val == 'undefined')
    return undefined;
  throw("Can't make term from " + val + " of type " + typeof val);
}

//	Statement
//
//  This is a triple with an optional reason.
//
//   The reason can point to provenece or inference
//
$rdf.Statement = function (subject, predicate, object, why) {
  this.subject = $rdf.term(subject)
  this.predicate = $rdf.term(predicate)
  this.object = $rdf.term(object)
  if(typeof why != 'undefined') {
    this.why = why;
  }
  return this;
}

$rdf.st = function (subject, predicate, object, why) {
  return new $rdf.Statement(subject, predicate, object, why);
};

$rdf.Statement.prototype.toNT = function () {
  return (this.subject.toNT() + " " + this.predicate.toNT() + " " + this.object.toNT() + " .");
};

$rdf.Statement.prototype.toString = $rdf.Statement.prototype.toNT;

//	Formula
//
//	Set of statements.
$rdf.Formula = function () {
  this.statements = []
  this.constraints = []
  this.initBindings = []
  this.optional = []
  return this;
};


$rdf.Formula.prototype.termType = 'formula';
$rdf.Formula.prototype.toNT = function () {
  return "{" + this.statements.join('\n') + "}"
};
$rdf.Formula.prototype.toString = $rdf.Formula.prototype.toNT;

$rdf.Formula.prototype.add = function (subj, pred, obj, why) {
  this.statements.push(new $rdf.Statement(subj, pred, obj, why))
}

// Convenience methods on a formula allow the creation of new RDF terms:
$rdf.Formula.prototype.sym = function (uri, name) {
  if(name != null) {
    throw new Error("This feature (kb.sym with 2 args) is removed. Do not assume prefix mappings.");
    if(!$rdf.ns[uri]) throw 'The prefix "' + uri + '" is not set in the API';
    uri = $rdf.ns[uri] + name
  }
  return new $rdf.Symbol(uri)
}

$rdf.sym = function (uri) {
  return new $rdf.Symbol(uri);
};

$rdf.Formula.prototype.literal = function (val, lang, dt) {
  return new $rdf.Literal(val.toString(), lang, dt)
}
$rdf.lit = $rdf.Formula.prototype.literal;

$rdf.Formula.prototype.bnode = function (id) {
  return new $rdf.BlankNode(id)
}

$rdf.Formula.prototype.formula = function () {
  return new $rdf.Formula()
}

$rdf.Formula.prototype.collection = function () { // obsolete
  return new $rdf.Collection()
}

$rdf.Formula.prototype.list = function (values) {
  var li = new $rdf.Collection();
  if(values) {
    for(var i = 0; i < values.length; i++) {
      li.append(values[i]);
    }
  }
  return li;
}

/*  Variable
 **
 ** Variables are placeholders used in patterns to be matched.
 ** In cwm they are symbols which are the formula's list of quantified variables.
 ** In sparl they are not visibily URIs.  Here we compromise, by having
 ** a common special base URI for variables. Their names are uris,
 ** but the ? nottaion has an implicit base uri of 'varid:'
 */

$rdf.Variable = function (rel) {
  this.base = "varid:"; // We deem variabe x to be the symbol varid:x 
  this.uri = $rdf.Util.uri.join(rel, this.base);
  return this;
}

$rdf.Variable.prototype.termType = 'variable';
$rdf.Variable.prototype.toNT = function () {
  if(this.uri.slice(0, this.base.length) == this.base) {
    return '?' + this.uri.slice(this.base.length);
  } // @@ poor man's refTo
  return '?' + this.uri;
};

$rdf.Variable.prototype.toString = $rdf.Variable.prototype.toNT;
$rdf.Variable.prototype.classOrder = 7;

$rdf.variable = $rdf.Formula.prototype.variable = function (name) {
  return new $rdf.Variable(name);
};

$rdf.Variable.prototype.hashString = $rdf.Variable.prototype.toNT;


// The namespace function generator 
$rdf.Namespace = function (nsuri) {
  return function (ln) {
    return new $rdf.Symbol(nsuri + (ln === undefined ? '' : ln))
  }
}

$rdf.Formula.prototype.ns = function (nsuri) {
  return function (ln) {
    return new $rdf.Symbol(nsuri + (ln === undefined ? '' : ln))
  }
}


// Parse a single token
//
// The bnode bit should not be used on program-external values; designed
// for internal work such as storing a bnode id in an HTML attribute.
// This will only parse the strings generated by the vaious toNT() methods.
$rdf.Formula.prototype.fromNT = function (str) {
  var len = str.length
  var ch = str.slice(0, 1)
  if(ch == '<') return $rdf.sym(str.slice(1, len - 1))
  if(ch == '"') {
    var lang = undefined;
    var dt = undefined;
    var k = str.lastIndexOf('"');
    if(k < len - 1) {
      if(str[k + 1] == '@') lang = str.slice(k + 2, len);
      else if(str.slice(k + 1, k + 3) == '^^') dt = $rdf.fromNT(str.slice(k + 3, len));
      else throw new Error("Can't convert string from NT: " + str);
    }
    var str = (str.slice(1, k));
    str = str.replace(/\\"/g, '"'); // unescape quotes '
    str = str.replace(/\\n/g, '\n'); // unescape newlines
    str = str.replace(/\\\\/g, '\\'); // unescape backslashes 
    return $rdf.lit(str, lang, dt);
  }
  if(ch == '_') {
    var x = new $rdf.BlankNode();
    x.id = parseInt(str.slice(3));
    $rdf.NextId--
    return x
  }
  if(ch == '?') {
    var x = new $rdf.Variable(str.slice(1));
    return x;
  }
  throw new Error("Can't convert from NT: " + str);

}
$rdf.fromNT = $rdf.Formula.prototype.fromNT; // Not for inexpert user
// Convenience - and more conventional name:
$rdf.graph = function () {
  return new $rdf.IndexedFormula();
};

// ends