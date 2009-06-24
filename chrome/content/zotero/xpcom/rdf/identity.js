//  Identity management and indexing for RDF
//
// This file provides  RDFIndexedFormula a formula (set of triples) which
// indexed by predicate, subject and object.
//
// It "smushes"  (merges into a single node) things which are identical 
// according to owl:sameAs or an owl:InverseFunctionalProperty
// or an owl:FunctionalProperty
//
//
//  2005-10 Written Tim Berners-Lee
//  2007    Changed so as not to munge statements from documents when smushing
//
// 

/*jsl:option explicit*/ // Turn on JavaScriptLint variable declaration checking

owl_ns = "http://www.w3.org/2002/07/owl#";
link_ns = "http://www.w3.org/2006/link#";

/* hashString functions are used as array indeces. This is done to avoid
** conflict with existing properties of arrays such as length and map.
** See issue 139.
*/
RDFLiteral.prototype.hashString = RDFLiteral.prototype.toNT;
RDFSymbol.prototype.hashString = RDFSymbol.prototype.toNT;
RDFBlankNode.prototype.hashString = RDFBlankNode.prototype.toNT;
RDFCollection.prototype.hashString = RDFCollection.prototype.toNT;

RDFIndexedFormula.prototype = new RDFFormula();
RDFIndexedFormula.prototype.constructor = RDFIndexedFormula;
// RDFIndexedFormula.superclass = RDFFormula.prototype;
RDFIndexedFormula.SuperClass = RDFFormula;

RDFArrayRemove = function(a, x) {  //removes all elements equal to x from a
    for(var i=0; i<a.length; i++) {
	if (a[i] == x) {
            a.splice(i,1);
            return;
	}
    }
    throw "RDFArrayRemove: Array did not contain " + x;
};



//Stores an associative array that maps URIs to functions
function RDFIndexedFormula(features) {
    this.statements = [];    // As in RDFFormula
    this.optional = [];
    this.propertyActions = []; // Array of functions to call when getting statement with {s X o}
    //maps <uri> to [f(F,s,p,o),...]
    this.classActions = [];   // Array of functions to call when adding { s type X }
    this.redirections = [];   // redirect to lexically smaller equivalent symbol
    this.aliases = [];   // reverse mapping to redirection: aliases for this
    this.HTTPRedirects = []; // redirections we got from HTTP
    this.subjectIndex = [];  // Array of statements with this X as subject
    this.predicateIndex = [];  // Array of statements with this X as subject
    this.objectIndex = [];  // Array of statements with this X as object
    this.whyIndex = [];     // Array of statements with X as provenance
    this.index = [ this.subjectIndex, this.predicateIndex, this.objectIndex, this.whyIndex ];
    this.namespaces = {} // Dictionary of namespace prefixes
    if (features == undefined) features = ["sameAs",
                    "InverseFunctionalProperty", "FunctionalProperty"];
//    this.features = features

    // Callbackify?
    
    function handleRDFType(formula, subj, pred, obj, why) {
        if (formula.typeCallback != undefined)
            formula.typeCallback(formula, obj, why);

        var x = formula.classActions[obj.hashString()];
        var done = false;
        if (x) {
            for (var i=0; i<x.length; i++) {                
                done = done || x[i](formula, subj, pred, obj, why);
            }
        }
        return done; // statement given is not needed if true
    } //handleRDFType

    //If the predicate is #type, use handleRDFType to create a typeCallback on the object
    this.propertyActions[
	'<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'] = [ handleRDFType ];

    // Assumption: these terms are not redirected @@fixme
    if (features.indexOf("sameAs") >=0)
        this.propertyActions['<http://www.w3.org/2002/07/owl#sameAs>'] = [
	function(formula, subj, pred, obj, why) {
            formula.equate(subj,obj);
            return true; // true if statement given is NOT needed in the store
	}]; //sameAs -> equate & don't add to index
/*
    function newPropertyAction(formula, pred, action) {
	tabulator.log.debug("newPropertyAction:  "+pred);
        if (formula.propertyActions[pred] == undefined)
            formula.propertyActions[pred] = [];
        formula.propertyActions[pred].push(action);
        // Now apply the function to to statements already in the store
	var toBeFixed = formula.statementsMatching(undefined, pred, undefined);
	var i;
	for (i=0; i<toBeFixed.length; i++) { // NOT optimized - sort toBeFixed etc
	    if (action(formula, toBeFixed[i].subject, pred, toBeFixed[i].object)) {
		tabulator.log.debug("newPropertyAction: NOT removing "+toBeFixed[i]);
	    }
	}
	return false;
    }
*/
    if (features.indexOf("InverseFunctionalProperty") >= 0)
        this.classActions["<"+owl_ns+"InverseFunctionalProperty>"] = [
            function(formula, subj, pred, obj, addFn) {
                return formula.newPropertyAction(subj, handle_IFP); // yes subj not pred!
            }]; //IFP -> handle_IFP, do add to index

    if (features.indexOf("FunctionalProperty") >= 0)
        this.classActions["<"+owl_ns+"FunctionalProperty>"] = [
            function(formula, subj, proj, obj, addFn) {
                return formula.newPropertyAction(subj, handle_FP);
            }]; //FP => handleFP, do add to index

    function handle_IFP(formula, subj, pred, obj)  {
        var s1 = formula.any(undefined, pred, obj);
        if (s1 == undefined) return false; // First time with this value
        formula.equate(s1, subj);
        return true;
    } //handle_IFP

    function handle_FP(formula, subj, pred, obj)  {
        var o1 = formula.any(subj, pred, undefined);
        if (o1 == undefined) return false; // First time with this value
        formula.equate(o1, obj);
        return true ;
    } //handle_FP
    
} /* end RDFIndexedFormula */




RDFIndexedFormula.prototype.newPropertyAction = function newPropertyAction(pred, action) {
    tabulator.log.debug("newPropertyAction:  "+pred);
    var hash = pred.hashString();
    if (this.propertyActions[hash] == undefined)
        this.propertyActions[hash] = [];
    this.propertyActions[hash].push(action);
    // Now apply the function to to statements already in the store
    var toBeFixed = this.statementsMatching(undefined, pred, undefined);
    done = false;
    for (var i=0; i<toBeFixed.length; i++) { // NOT optimized - sort toBeFixed etc
        done = done || action(this, toBeFixed[i].subject, pred, toBeFixed[i].object);
    }
    return done;
}




RDFPlainFormula = function() { return RDFIndexedFormula([]); } // No features


RDFIndexedFormula.prototype.setPrefixForURI = function(prefix, nsuri) {
    //TODO:This is a hack for our own issues, which ought to be fixed post-release
    //See http://dig.csail.mit.edu/cgi-bin/roundup.cgi/tabulator/issue227
    if(prefix=="tab" && this.namespaces["tab"]) {
        return;
    }
    this.namespaces[prefix] = nsuri
}

// Deprocated ... name too generic
RDFIndexedFormula.prototype.register = function(prefix, nsuri) {
    this.namespaces[prefix] = nsuri
}


/** simplify graph in store when we realize two identifiers are equal

We replace the bigger with the smaller.

*/
RDFIndexedFormula.prototype.equate = function(u1, u2) {
    tabulator.log.info("Equating "+u1+" and "+u2)
    
    var d = u1.compareTerm(u2);
    if (!d) return true; // No information in {a = a}
    var big, small;
    if (d < 0)  {  // u1 less than u2
	return this.replaceWith(u2, u1);
    } else {
	return this.replaceWith(u1, u2);
    }
}

// Replace big with small, obsoleted with obsoleting.
//
RDFIndexedFormula.prototype.replaceWith = function(big, small) {
    tabulator.log.debug("Replacing "+big+" with "+small) // @@
    var oldhash = big.hashString();
    var newhash = small.hashString();

    var moveIndex = function(ix) {
        var oldlist = ix[oldhash];
        if (oldlist == undefined) return; // none to move
        var newlist = ix[newhash];
        if (newlist == undefined) {
            ix[newhash] = newlist;
        } else {
            ix[newhash] = oldlist.concat(newlist);
        }
        delete ix[oldhash];    
    }
    
    // the canonical one carries all the indexes
    for (var i=0; i<4; i++) {
        moveIndex(this.index[i]);
    }

    this.redirections[oldhash] = small;
    if (big.uri) {
	if (this.aliases[newhash] == undefined)
	     this.aliases[newhash] = [];
	this.aliases[newhash].push(big); // Back link

	this.add(small, this.sym('http://www.w3.org/2006/link#uri'), big.uri)

	// If two things are equal, and one is requested, we should request the other.
	if (this.sf) {
	    this.sf.nowKnownAs(big, small)
	}
    
    }
    
    moveIndex(this.classActions);
    moveIndex(this.propertyActions);

    tabulator.log.debug("Equate done. "+big+" to be known as "+small)    
    return true;  // true means the statement does not need to be put in
};

// Return the symbol with canonical URI as smushed
RDFIndexedFormula.prototype.canon = function(term) {
    if (term == undefined) return term;
    var y = this.redirections[term.hashString()];
    if (y == undefined) return term;
    return y;
}

// Compare by canonical URI as smushed
RDFIndexedFormula.prototype.sameThings = function(x, y) {
    if (x.sameTerm(y)) return true;
    var x1 = this.canon(x);
//    alert('x1='+x1);
    if (x1 == undefined) return false;
    var y1 = this.canon(y);
//    alert('y1='+y1); //@@
    if (y1 == undefined) return false;
    return (x1.uri == y1.uri);
}

// A list of all the URIs by which this thing is known
RDFIndexedFormula.prototype.uris = function(term) {
    var cterm = this.canon(term)
    var terms = this.aliases[cterm.hashString()];
    if (!cterm.uri) return []
    var res = [ cterm.uri ]
    if (terms != undefined) {
	for (var i=0; i<terms.length; i++) {
	    res.push(terms[i].uri)
	}
    }
    return res
}

// On input parameters, convert constants to terms
// 
function RDFMakeTerm(formula,val, canonicalize) {
    if (typeof val != 'object') {   
	if (typeof val == 'string')
	    return new RDFLiteral(val);
        if (typeof val == 'number')
            return new RDFLiteral(val); // @@ differet types
        if (typeof val == 'boolean')
            return new RDFLiteral(val?"1":"0", undefined, 
                                            RDFSymbol.prototype.XSDboolean);
	else if (typeof val == 'number')
	    return new RDFLiteral(''+val);   // @@ datatypes
	else if (typeof val == 'undefined')
	    return undefined;
	else    // @@ add converting of dates and numbers
	    throw "Can't make Term from " + val + " of type " + typeof val; 
    }
    return val;
}

// add a triple to the store
RDFIndexedFormula.prototype.add = function(subj, pred, obj, why) {
    var actions, st;
    if (why == undefined) why = this.fetcher ? this.fetcher.appNode: kb.sym("chrome:theSession"); //system generated
                               //defined in source.js, is this OK with identity.js only user?
    subj = RDFMakeTerm(this, subj);
    pred = RDFMakeTerm(this, pred);
    obj = RDFMakeTerm(this, obj);
    why = RDFMakeTerm(this, why);
    
    var hash = [ this.canon(subj).hashString(), this.canon(pred).hashString(),
            this.canon(obj).hashString(), this.canon(why).hashString()];

/*    // Removed TimBL 2007-01-06
    // Check we don't already know it -- esp when working with dbview
    // db view has many documents with the same triple - a waste.
    // but is we want to be able to edit documents, we must maintain the original
    // triples from each one.  We might occasionally want to mutiple provences too
    // for a full Truth Management System.  Maybe this should be run-time option.
    st = this.anyStatementMatching(subj,pred,obj) // @@@@@@@ temp fix <====WATCH OUT!
    It is general necessary to know when data has come from >1 place.
    Maybe this should be a mode?
*/
    // This is wasting time and shouldn't happen at all
    //st = this.anyStatementMatching(subj,pred,obj,why) // Avoid duplicates
    //if (st != undefined) return; // already in store
 
    
       
    //    tabulator.log.debug("\nActions for "+s+" "+p+" "+o+". size="+this.statements.length)
    if (this.predicateCallback != undefined)
	this.predicateCallback(this, pred, why);
	
    // Action return true if the statement does not need to be added
    var actions = this.propertyActions[hash[1]]; // Predicate hash
    var done = false;
    if (actions) {
        // alert('type: '+typeof actions +' @@ actions='+actions);
        for (var i=0; i<actions.length; i++) {
            done = done || actions[i](this, subj, pred, obj, why);
        }
    }
    
    //If we are tracking provenanance, every thing should be loaded into the store
    //if (done) return new RDFStatement(subj, pred, obj, why); // Don't put it in the store
                                                             // still return this statement for owl:sameAs input
    var st = new RDFStatement(subj, pred, obj, why);
    for (var i=0; i<4; i++) {
        var ix = this.index[i];
        var h = hash[i];
        if (ix[h] == undefined) ix[h] = [];
        ix[h].push(st); // Set of things with this as subject
    }
    
    tabulator.log.debug("ADDING    {"+subj+" "+pred+" "+obj+"} "+why);
    this.statements.push(st);
    return st;
}; //add


// Find out whether a given URI is used as symbol in the formula
RDFIndexedFormula.prototype.mentionsURI = function(uri) {
    var hash = '<' + uri + '>';
    return (!!this.subjectIndex[hash] || !!this.objectIndex[hash]
            || !!this.predicateIndex[hash]);
}

// Find an unused id for a file being edited: return a symbol
// (Note: Slow iff a lot of them -- could be O(log(k)) )
RDFIndexedFormula.prototype.nextSymbol = function(doc) {
    for(var i=0;;i++) {
        var uri = doc.uri + '#n' + i;
        if (!this.mentionsURI(uri)) return kb.sym(uri);
    }
}


RDFIndexedFormula.prototype.anyStatementMatching = function(subj,pred,obj,why) {
    var x = this.statementsMatching(subj,pred,obj,why,true);
    if (!x || x == []) return undefined;
    return x[0];
};


// Return statements matching a pattern
// ALL CONVENIENCE LOOKUP FUNCTIONS RELY ON THIS!
RDFIndexedFormula.prototype.statementsMatching = function(subj,pred,obj,why,justOne) {
    tabulator.log.debug("Matching {"+subj+" "+pred+" "+obj+"}");
    
    var pat = [ subj, pred, obj, why ];
    var pattern = [];
    var hash = [];
    var wild = []; // wildcards
    var given = []; // Not wild
    for (var p=0; p<4; p++) {
        pattern[p] = this.canon(RDFMakeTerm(this, pat[p]));
        if (pattern[p] == undefined) {
            wild.push(p);
        } else {
            given.push(p);
            hash[p] = pattern[p].hashString();
        }
    }
    if (given.length == 0) return this.statements; // Easy
    if (given.length == 1) {  // Easy too, we have an index for that
        var p = given[0];
        var list = this.index[p][hash[p]];
        return list == undefined ? [] : list;
    }
    
    // Now given.length is 2, 3 or 4.
    // We hope that the scale-free nature of the data will mean we tend to get
    // a short index in there somewhere!
    
    var best = 1e10; // really bad
    var best_i;
    for (var i=0; i<given.length; i++) {
        var p = given[i]; // Which part we are dealing with
        var list = this.index[p][hash[p]];
        if (list == undefined) return []; // No occurrences
        if (list.length < best) {
            best = list.length;
            best_i = i;  // (not p!)
        }
    }
    
    // Ok, we have picked the shortest index but now we have to filter it
    var best_p = given[best_i];
    var possibles = this.index[best_p][hash[best_p]];
    var check = given.slice(0, best_i).concat(given.slice(best_i+1)) // remove best_i
    var results = [];
    var parts = [ 'subject', 'predicate', 'object', 'why'];
    for (var j=0; j<possibles.length; j++) {
        var st = possibles[j];
        for (var i=0; i <check.length; i++) { // for each position to be checked
            var p = check[i];
            if (!this.canon(st[parts[p]]).sameTerm(pattern[p])) {
                st = null; 
                break;
            }
        }
        if (st != null) results.push(st);
    }
    return results;
}; // statementsMatching


/** remove a particular statement from the bank **/
RDFIndexedFormula.prototype.remove = function (st) {
    tabulator.log.debug("entering remove w/ st=" + st);
    var term = [ st.subject, st.predicate, st.object, st.why];
    for (var p=0; p<4; p++) {
        var c = this.canon(term[p]);
        var h = c.hashString();
        if (this.index[p][h] == undefined) {
            tabulator.log.warn ("Statement removal: no index '+p+': "+st);
        } else {
            RDFArrayRemove(this.index[p][h], st);
        }
    }
    RDFArrayRemove(this.statements, st);
}; //remove

/** remove all statements matching args (within limit) **/
RDFIndexedFormula.prototype.removeMany = function (subj, pred, obj, why, limit) {
    tabulator.log.debug("entering removeMany w/ subj,pred,obj,why,limit = " + subj +", "+ pred+", " + obj+", " + why+", " + limit);
    var sts = this.statementsMatching (subj, pred, obj, why, false);
    //This is a subtle bug that occcured in updateCenter.js too.
    //The fact is, this.statementsMatching returns this.whyIndex instead of a copy of it
    //but for perfromance consideration, it's better to just do that
    //so make a copy here.
    var statements = [];
    for (var i=0;i<sts.length;i++) statements.push(sts[i]);
    if (limit) statements = statements.slice(0, limit);
    for (var st in statements) this.remove(statements[st]);
}; //removeMany

/** Load a resorce into the store **/

RDFIndexedFormula.prototype.load = function(url) {
    // get the XML
    var xhr = Util.XMLHTTPFactory(); // returns a new XMLHttpRequest, or ActiveX XMLHTTP object
    if (xhr.overrideMimeType) {
	xhr.overrideMimeType("text/xml");
    }

    // Get privileges for cross-domain web access
    if(!isExtension) {
        try {
            Util.enablePrivilege("UniversalXPConnect UniversalBrowserRead")
        } catch(e) {
            throw ("Failed to get privileges: (see http://dig.csail.mit.edu/2005/ajar/ajaw/Privileges.html)" + e)
        }
    }

    xhr.open("GET", url, false);  // Synchronous
    xhr.send("");

    // Get XML DOM Tree

    var nodeTree = xhr.responseXML;
    if (nodeTree === null && xhr.responseText !== null) {
	// Only if the server fails to set Content-Type: text/xml AND xmlhttprequest doesn't have the overrideMimeType method
	nodeTree = (new DOMParser()).parseFromString(xhr.responseText, 'text/xml');
    }

    // Get RDF statements fromm XML

    // must be an XML document node tree
    var parser = new RDFParser(this);
    parser.parse(nodeTree,url);
}


/** Utility**/

/*  @method: copyTo
    @discription: replace @template with @target and add appropriate triples (no triple removed)
                  one-direction replication 
*/ 
RDFIndexedFormula.prototype.copyTo = function(template,target,flags){
    if (!flags) flags=[];
    var statList=this.statementsMatching(template);
    if (flags.indexOf('two-direction')!=-1) 
        statList.concat(this.statementsMatching(undefined,undefined,template));
    for (var i=0;i<statList.length;i++){
        var st=statList[i];
        switch (st.object.termType){
            case 'symbol':
                this.add(target,st.predicate,st.object);
                break;
            case 'literal':
            case 'bnode':
            case 'collection':
                this.add(target,st.predicate,st.object.copy(this));
        }
        if (flags.indexOf('delete')!=-1) this.remove(st);
    }
};
//for the case when you alter this.value (text modified in userinput.js)
RDFLiteral.prototype.copy = function(){ 
    return new RDFLiteral(this.value,this.lang,this.datatype);
};
RDFBlankNode.prototype.copy = function(formula){ //depends on the formula
    var bnodeNew=new RDFBlankNode();
    formula.copyTo(this,bnodeNew);
    return bnodeNew;
}
/**  Full N3 bits  -- placeholders only to allow parsing, no functionality! **/

RDFIndexedFormula.prototype.newUniversal = function(uri) {
    var x = this.sym(uri);
    if (!this._universalVariables) this._universalVariables = [];
    this._universalVariables.push(x);
    return x;
}

RDFIndexedFormula.prototype.newExistential = function(uri) {
    if (!uri) return this.bnode();
    var x = this.sym(uri);
    return this.declareExistential(x);
}

RDFIndexedFormula.prototype.declareExistential = function(x) {
    if (!this._existentialVariables) this._existentialVariables = [];
    this._existentialVariables.push(x);
    return x;
}

RDFIndexedFormula.prototype.formula = function(features) {
    return new RDFIndexedFormula(features);
}

RDFIndexedFormula.prototype.close = function() {
    return this;
}

RDFIndexedFormula.prototype.hashString = RDFIndexedFormula.prototype.toNT;

/////////////////////////////  Provenance tracking
//  
// Where did this statement come from?
//

/*
RDFStatement.prototype.original = function() {
    for (var st = this;; st = st.why.premis[0]) {
        if (st.why.termType && st.why.termType== 'symbol')
            return this; // This statement came from a document
    }
}
*/



// ends

