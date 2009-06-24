// These are the classes corresponding to the RDF and N3 data models
//
// Designed to look like rdflib and cwm designs.
//
// Issues: Should the names start with RDF to make them
//      unique as program-wide symbols?
//
// W3C open source licence 2005.
//

RDFTracking = 0  // Are we requiring reasons for statements?

//takes in an object and makes it an object if it's a literal
function makeTerm(val) {
    //  tabulator.log.debug("Making term from " + val)
    if (typeof val == 'object') return val;
    if (typeof val == 'string') return new RDFLiteral(val);
    if (typeof val == 'number') return new RDFLiteral(val); // @@ differet types
    if (typeof val == 'boolean') return new RDFLiteral(val?"1":"0", undefined, 
                                                RDFSymbol.prototype.XSDboolean);
    if (typeof val == 'undefined') return undefined;
    alert("Can't make term from " + val + " of type " + typeof val);
}


//	Symbol

function RDFEmpty() {
	return this;
}
RDFEmpty.prototype.termType = 'empty'
RDFEmpty.prototype.toString = function () { return "()" }
RDFEmpty.prototype.toNT = function () { return "@@" }

function RDFSymbol_toNT(x) {
    return ("<" + x.uri + ">")
}

function toNT() {
    return RDFSymbol_toNT(this)
}

function RDFSymbol(uri) {
    this.uri = uri
    return this
}
	
RDFSymbol.prototype.termType = 'symbol'
RDFSymbol.prototype.toString = toNT
RDFSymbol.prototype.toNT = toNT

//  Some precalculaued symbols

RDFSymbol.prototype.XSDboolean = new RDFSymbol('http://www.w3.org/2001/XMLSchema#boolean');
RDFSymbol.prototype.integer = new RDFSymbol('http://www.w3.org/2001/XMLSchema#integer');


//	Blank Node

var RDFNextId = 0;  // Gobal genid
RDFGenidPrefix = "genid:"
NTAnonymousNodePrefix = "_:n"

function RDFBlankNode(id) {
    /*if (id)
    	this.id = id;
    else*/
    this.id = RDFNextId++
    return this
}

RDFBlankNode.prototype.termType = 'bnode'

RDFBlankNode.prototype.toNT = function() {
    return NTAnonymousNodePrefix + this.id
}
RDFBlankNode.prototype.toString = RDFBlankNode.prototype.toNT  

//	Literal

function RDFLiteral(value, lang, datatype) {
    this.value = value
    this.lang=lang;	  // string
    this.datatype=datatype;  // term
    this.toString = RDFLiteralToString
    this.toNT = RDFLiteral_toNT
    return this
}

RDFLiteral.prototype.termType = 'literal'

function RDFLiteral_toNT() {
    var str = this.value
    if (typeof str != 'string') {
        if (typeof str == 'number') return ''+str;
	throw Error("Value of RDF literal is not string: "+str)
    }
    str = str.replace(/\\/g, '\\\\');  // escape
    str = str.replace(/\"/g, '\\"');
    str = '"' + str + '"'  //'

    if (this.datatype){
	str = str + '^^' + this.datatype//.toNT()
    }
    if (this.lang) {
	str = str + "@" + this.lang
    }
    return str
}

function RDFLiteralToString() {
    return ''+this.value
}
    
RDFLiteral.prototype.toString = RDFLiteralToString   
RDFLiteral.prototype.toNT = RDFLiteral_toNT

function RDFCollection() {
    this.id = RDFNextId++
    this.elements = []
    this.closed = false
}

RDFCollection.prototype.termType = 'collection'

RDFCollection.prototype.toNT = function() {
    return NTAnonymousNodePrefix + this.id
}
RDFCollection.prototype.toString = RDFCollection.prototype.toNT 

RDFCollection.prototype.append = function (el) {
    this.elements.push(el)
}
RDFCollection.prototype.unshift=function(el){
    this.elements.unshift(el);
}
RDFCollection.prototype.shift=function(){
    return this.elements.shift();
}
        
RDFCollection.prototype.close = function () {
    this.closed = true
}

//	Statement
//
//  This is a triple with an optional reason.
//
//   The reason can point to provenece or inference
//
function RDFStatement_toNT() {
    return (this.subject.toNT() + " "
	    + this.predicate.toNT() + " "
	    +  this.object.toNT() +" .")
}

function RDFStatement(subject, predicate, object, why) {
    this.subject = makeTerm(subject)
    this.predicate = makeTerm(predicate)
    this.object = makeTerm(object)
    if (typeof why !='undefined') {
	this.why = why
    } else if (RDFTracking) {
	tabulator.log.debug("WARNING: No reason on "+subject+" "+predicate+" "+object)
    }
    return this
}

RDFStatement.prototype.toNT = RDFStatement_toNT
RDFStatement.prototype.toString = RDFStatement_toNT
	

//	Formula
//
//	Set of statements.

function RDFFormula() {
    this.statements = []
    this.constraints = []
    this.initBindings = []
    this.optional = []
    this.superFormula = null;
    return this
}

function RDFFormula_toNT() {
    // throw 'Who called me?';    
    return "{" + this.statements.join('\n') + "}"
}

//RDFQueryFormula.prototype = new RDFFormula()
//RDFQueryFormula.termType = 'queryFormula'
RDFFormula.prototype.termType = 'formula'
RDFFormula.prototype.toNT = RDFFormula_toNT
RDFFormula.prototype.toString = RDFFormula_toNT   

RDFFormula.prototype.add = function(subj, pred, obj, why) {
    this.statements.push(new RDFStatement(subj, pred, obj, why))
}

// Convenience methods on a formula allow the creation of new RDF terms:

RDFFormula.prototype.sym = function(uri,name) {
    if (name != null) {
        if (!tabulator.ns[uri]) throw 'The prefix "'+uri+'" is not set in the API';
	uri = tabulator.ns[uri] + name
    }
    return new RDFSymbol(uri)
}

RDFFormula.prototype.literal = function(val, lang, dt) {
    return new RDFLiteral(val.toString(), lang, dt)
}

RDFFormula.prototype.bnode = function(id) {
    return new RDFBlankNode(id)
}

RDFFormula.prototype.formula = function() {
    return new RDFFormula()
}

RDFFormula.prototype.collection = function () { // obsolete
    return new RDFCollection()
}

RDFFormula.prototype.list = function (values) {
    li = new RDFCollection();
    if (values) {
        for(var i = 0; i<values.length; i++) {
            li.append(values[i]);
        }
    }
    return li;
}

RDFFormula.instances={};
RDFFormula.prototype.registerFormula = function(accesskey){
    var superFormula = this.superFormula || this;
    RDFFormula.instances[accesskey] = this;
    var formulaTerm = superFormula.bnode();
    superFormula.add(formulaTerm, tabulator.ns.rdf('type'),superFormula.sym("http://www.w3.org/2000/10/swap/log#Formula"));
    superFormula.add(formulaTerm, tabulator.ns.foaf('name'), superFormula.literal(accesskey));
    superFormula.add(formulaTerm, tabulator.ns.link('accesskey'), superFormula.literal(accesskey));
    //RDFFormula.instances.push("accesskey");
}


/*  Variable
**
** Variables are placeholders used in patterns to be matched.
** In cwm they are symbols which are the formula's list of quantified variables.
** In sparl they are not visibily URIs.  Here we compromise, by having
** a common special base URI for variables.
*/

RDFVariableBase = "varid:"; // We deem variabe x to be the symbol varid:x 

function RDFVariable(rel) {
    this.uri = URIjoin(rel, RDFVariableBase);
    return this;
}

RDFVariable.prototype.termType = 'variable';
RDFVariable.prototype.toNT = function() {
    if (this.uri.slice(0, RDFVariableBase.length) == RDFVariableBase) {
	return '?'+ this.uri.slice(RDFVariableBase.length);} // @@ poor man's refTo
    return '?' + this.uri;
};

RDFVariable.prototype.toString = RDFVariable.prototype.toNT;
RDFVariable.prototype.classOrder = 7;

RDFFormula.prototype.variable = function(name) {
    return new RDFVariable(name);
};

RDFVariable.prototype.hashString = RDFVariable.prototype.toNT;


// The namespace function generator 

function RDFNamespace(nsuri) {
    return function(ln) { return new RDFSymbol(nsuri+(ln===undefined?'':ln)) }
}

RDFFormula.prototype.ns = function(nsuri) {
    return function(ln) { return new RDFSymbol(nsuri+(ln===undefined?'':ln)) }
}


// Parse a single token
//
// The bnode bit should not be used on program-external values; designed
// for internal work such as storing a bnode id in an HTML attribute.
// Not coded for literals.

RDFFormula.prototype.fromNT = function(str) {
    var len = str.length
    var ch = str.slice(0,1)
    if (ch == '<') return this.sym(str.slice(1,len-1))
    if (ch == '_') {
	var x = new RDFBlankNode();
	x.id = parseInt(str.slice(3));
	RDFNextId--
	return x
    }
    throw "Can't convert from NT"+str;
    
    //alert("Can't yet convert from NT: '"+str+"', "+str[0])
}

// ends
