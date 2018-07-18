//  Identity management and indexing for RDF
//
// This file provides  IndexedFormula a formula (set of triples) which
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
/*jsl:option explicit*/
// Turn on JavaScriptLint variable declaration checking
$rdf.IndexedFormula = function () {

  var owl_ns = "http://www.w3.org/2002/07/owl#";
  // var link_ns = "http://www.w3.org/2007/ont/link#";
  /* hashString functions are used as array indeces. This is done to avoid
   ** conflict with existing properties of arrays such as length and map.
   ** See issue 139.
   */
  $rdf.Literal.prototype.hashString = $rdf.Literal.prototype.toNT;
  $rdf.Symbol.prototype.hashString = $rdf.Symbol.prototype.toNT;
  $rdf.BlankNode.prototype.hashString = $rdf.BlankNode.prototype.toNT;
  $rdf.Collection.prototype.hashString = $rdf.Collection.prototype.toNT;


  //Stores an associative array that maps URIs to functions
  $rdf.IndexedFormula = function (features) {
    this.statements = []; // As in Formula
    this.optional = [];
    this.propertyActions = []; // Array of functions to call when getting statement with {s X o}
    //maps <uri> to [f(F,s,p,o),...]
    this.classActions = []; // Array of functions to call when adding { s type X }
    this.redirections = []; // redirect to lexically smaller equivalent symbol
    this.aliases = []; // reverse mapping to redirection: aliases for this
    this.HTTPRedirects = []; // redirections we got from HTTP
    this.subjectIndex = []; // Array of statements with this X as subject
    this.predicateIndex = []; // Array of statements with this X as subject
    this.objectIndex = []; // Array of statements with this X as object
    this.whyIndex = []; // Array of statements with X as provenance
    this.index = [this.subjectIndex, this.predicateIndex, this.objectIndex, this.whyIndex];
    this.namespaces = {} // Dictionary of namespace prefixes
    if(features === undefined) features = ["sameAs",
                                "InverseFunctionalProperty", "FunctionalProperty"];
    //    this.features = features
    // Callbackify?
    function handleRDFType(formula, subj, pred, obj, why) {
      if(formula.typeCallback != undefined)
        formula.typeCallback(formula, obj, why);

      var x = formula.classActions[obj.hashString()];
      var done = false;
      if(x) {
        for(var i = 0; i < x.length; i++) {
          done = done || x[i](formula, subj, pred, obj, why);
        }
      }
      return done; // statement given is not needed if true
    } //handleRDFType
    //If the predicate is #type, use handleRDFType to create a typeCallback on the object
    this.propertyActions['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'] = [handleRDFType];

    // Assumption: these terms are not redirected @@fixme
    if($rdf.Util.ArrayIndexOf(features, "sameAs") >= 0)
      this.propertyActions['<http://www.w3.org/2002/07/owl#sameAs>'] = [
      function (formula, subj, pred, obj, why) {
      // tabulator.log.warn("Equating "+subj.uri+" sameAs "+obj.uri);  //@@
      formula.equate(subj, obj);
      return true; // true if statement given is NOT needed in the store
    }]; //sameAs -> equate & don't add to index
    if($rdf.Util.ArrayIndexOf(features, "InverseFunctionalProperty") >= 0)
      this.classActions["<" + owl_ns + "InverseFunctionalProperty>"] = [
      function (formula, subj, pred, obj, addFn) {
      return formula.newPropertyAction(subj, handle_IFP); // yes subj not pred!
    }]; //IFP -> handle_IFP, do add to index
    if($rdf.Util.ArrayIndexOf(features, "FunctionalProperty") >= 0)
      this.classActions["<" + owl_ns + "FunctionalProperty>"] = [
        function (formula, subj, proj, obj, addFn) {
         return formula.newPropertyAction(subj, handle_FP);
        }
      ]; //FP => handleFP, do add to index
    function handle_IFP(formula, subj, pred, obj) {
      var s1 = formula.any(undefined, pred, obj);
      if(s1 == undefined) return false; // First time with this value
      // tabulator.log.warn("Equating "+s1.uri+" and "+subj.uri + " because IFP "+pred.uri);  //@@
      formula.equate(s1, subj);
      return true;
    } //handle_IFP
    function handle_FP(formula, subj, pred, obj) {
      var o1 = formula.any(subj, pred, undefined);
      if(o1 == undefined) return false; // First time with this value
      // tabulator.log.warn("Equating "+o1.uri+" and "+obj.uri + " because FP "+pred.uri);  //@@
      formula.equate(o1, obj);
      return true;
    } //handle_FP
  } /* end IndexedFormula */

  $rdf.IndexedFormula.prototype = new $rdf.Formula();
  $rdf.IndexedFormula.prototype.constructor = $rdf.IndexedFormula;
  $rdf.IndexedFormula.SuperClass = $rdf.Formula;

  $rdf.IndexedFormula.prototype.newPropertyAction = function newPropertyAction(pred, action) {
    //$rdf.log.debug("newPropertyAction:  "+pred);
    var hash = pred.hashString();
    if(this.propertyActions[hash] == undefined)
      this.propertyActions[hash] = [];
    this.propertyActions[hash].push(action);
    // Now apply the function to to statements already in the store
    var toBeFixed = this.statementsMatching(undefined, pred, undefined);
    var done = false;
    for(var i = 0; i < toBeFixed.length; i++) { // NOT optimized - sort toBeFixed etc
      done = done || action(this, toBeFixed[i].subject, pred, toBeFixed[i].object);
    }
    return done;
  }

  $rdf.IndexedFormula.prototype.setPrefixForURI = function (prefix, nsuri) {
    //TODO:This is a hack for our own issues, which ought to be fixed post-release
    //See http://dig.csail.mit.edu/cgi-bin/roundup.cgi/$rdf/issue227
    if(prefix == "tab" && this.namespaces["tab"]) {
      return;
    }
    this.namespaces[prefix] = nsuri
  }

  // Deprocated ... name too generic
  $rdf.IndexedFormula.prototype.register = function (prefix, nsuri) {
    this.namespaces[prefix] = nsuri
  }


  /** simplify graph in store when we realize two identifiers are equivalent

We replace the bigger with the smaller.

*/
  $rdf.IndexedFormula.prototype.equate = function (u1, u2) {
    // tabulator.log.warn("Equating "+u1+" and "+u2); // @@
    //@@JAMBO Must canonicalize the uris to prevent errors from a=b=c
    //03-21-2010
    u1 = this.canon(u1);
    u2 = this.canon(u2);
    var d = u1.compareTerm(u2);
    if(!d) return true; // No information in {a = a}
    var big, small;
    if(d < 0) { // u1 less than u2
      return this.replaceWith(u2, u1);
    } else {
      return this.replaceWith(u1, u2);
    }
  }

  // Replace big with small, obsoleted with obsoleting.
  //
  $rdf.IndexedFormula.prototype.replaceWith = function (big, small) {
    //$rdf.log.debug("Replacing "+big+" with "+small) // @@
    var oldhash = big.hashString();
    var newhash = small.hashString();

    var moveIndex = function (ix) {
        var oldlist = ix[oldhash];
        if(oldlist == undefined) return; // none to move
        var newlist = ix[newhash];
        if(newlist == undefined) {
          ix[newhash] = oldlist;
        } else {
          ix[newhash] = oldlist.concat(newlist);
        }
        delete ix[oldhash];
      }

      // the canonical one carries all the indexes
    for(var i = 0; i < 4; i++) {
      moveIndex(this.index[i]);
    }

    this.redirections[oldhash] = small;
    if(big.uri) {
      //@@JAMBO: must update redirections,aliases from sub-items, too.
      if(this.aliases[newhash] == undefined)
        this.aliases[newhash] = [];
      this.aliases[newhash].push(big); // Back link
      if(this.aliases[oldhash]) {
        for(var i = 0; i < this.aliases[oldhash].length; i++) {
          this.redirections[this.aliases[oldhash][i].hashString()] = small;
          this.aliases[newhash].push(this.aliases[oldhash][i]);
        }
      }

      //this.add(small, this.sym('http://www.w3.org/2007/ont/link#uri'), big.uri)

      // If two things are equal, and one is requested, we should request the other.
      if(this.sf) {
        this.sf.nowKnownAs(big, small)
      }
    }

    moveIndex(this.classActions);
    moveIndex(this.propertyActions);

    $rdf.log.debug("Equate done. "+big+" now links to "+small)    
    return true; // true means the statement does not need to be put in
  };

  // Return the symbol with canonical URI as smushed
  $rdf.IndexedFormula.prototype.canon = function (term) {
    if(term == undefined) return term;
    var y = this.redirections[term.hashString()];
    if(y == undefined) return term;
    return y;
  }

  // Compare by canonical URI as smushed
  $rdf.IndexedFormula.prototype.sameThings = function (x, y) {
    if(x.sameTerm(y)) return true;
    var x1 = this.canon(x);
    //    alert('x1='+x1);
    if(x1 == undefined) return false;
    var y1 = this.canon(y);
    //    alert('y1='+y1); //@@
    if(y1 == undefined) return false;
    return(x1.uri == y1.uri);
  }

  // A list of all the URIs by which this thing is known
  $rdf.IndexedFormula.prototype.uris = function (term) {
    var cterm = this.canon(term)
    var terms = this.aliases[cterm.hashString()];
    if(!cterm.uri) return []
    var res = [cterm.uri]
    if(terms != undefined) {
      for(var i = 0; i < terms.length; i++) {
        res.push(terms[i].uri)
      }
    }
    return res
  }

  // On input parameters, convert constants to terms
  // 
  function RDFMakeTerm(formula, val, canonicalize) {
    if(typeof val != 'object') {
      if(typeof val == 'string')
        return new $rdf.Literal(val);
      if(typeof val == 'number')
        return new $rdf.Literal(val); // @@ differet types
      if(typeof val == 'boolean')
        return new $rdf.Literal(val ? "1" : "0", undefined, $rdf.Symbol.prototype.XSDboolean);
      if(typeof val == 'undefined')
        return undefined;
      else // @@ add converting of dates and numbers
      throw new Error("Can't make Term from " + val + " of type " + typeof val);
    }
    return val;
  }

  // Add a triple to the store
  //
  //  Returns the statement added
  // (would it be better to return the original formula for chaining?)
  //
  $rdf.IndexedFormula.prototype.add = function (subj, pred, obj, why) {
    var actions, st;
    if(why == undefined) why = this.fetcher ? this.fetcher.appNode : this.sym("chrome:theSession"); //system generated
    //defined in source.js, is this OK with identity.js only user?
    subj = RDFMakeTerm(this, subj);
    pred = RDFMakeTerm(this, pred);
    obj = RDFMakeTerm(this, obj);
    why = RDFMakeTerm(this, why);

    if(this.predicateCallback != undefined)
      this.predicateCallback(this, pred, why);

    // Action return true if the statement does not need to be added
    var actions = this.propertyActions[this.canon(pred).hashString()];
    var done = false;
    if(actions) {
      // alert('type: '+typeof actions +' @@ actions='+actions);
      for(var i = 0; i < actions.length; i++) {
        done = done || actions[i](this, subj, pred, obj, why);
      }
    }

    //If we are tracking provenanance, every thing should be loaded into the store
    //if (done) return new Statement(subj, pred, obj, why); // Don't put it in the store
    // still return this statement for owl:sameAs input
    var hash = [this.canon(subj).hashString(), this.canon(pred).hashString(),
                   this.canon(obj).hashString(), this.canon(why).hashString()];
    var st = new $rdf.Statement(subj, pred, obj, why);
    for(var i = 0; i < 4; i++) {
      var ix = this.index[i];
      var h = hash[i];
      if(ix[h] == undefined) ix[h] = [];
      ix[h].push(st); // Set of things with this as subject, etc
    }

    //tabulator.log.debug("ADDING    {"+subj+" "+pred+" "+obj+"} "+why);
    this.statements.push(st);
    return st;
  }; //add
  // Find out whether a given URI is used as symbol in the formula
  $rdf.IndexedFormula.prototype.mentionsURI = function (uri) {
    var hash = '<' + uri + '>';
    return (!!this.subjectIndex[hash]
      || !!this.objectIndex[hash]
      || !!this.predicateIndex[hash]);
  }

  // Find an unused id for a file being edited: return a symbol
  // (Note: Slow iff a lot of them -- could be O(log(k)) )
  $rdf.IndexedFormula.prototype.nextSymbol = function (doc) {
    for(var i = 0;; i++) {
      var uri = doc.uri + '#n' + i;
      if(!this.mentionsURI(uri)) return this.sym(uri);
    }
  }


  $rdf.IndexedFormula.prototype.anyStatementMatching = function (subj, pred, obj, why) {
    var x = this.statementsMatching(subj, pred, obj, why, true);
    if(!x || x == []) return undefined;
    return x[0];
  };


  // Return statements matching a pattern
  // ALL CONVENIENCE LOOKUP FUNCTIONS RELY ON THIS!
  $rdf.IndexedFormula.prototype.statementsMatching = function (subj, pred, obj, why, justOne) {
    //$rdf.log.debug("Matching {"+subj+" "+pred+" "+obj+"}");
    var pat = [subj, pred, obj, why];
    var pattern = [];
    var hash = [];
    var wild = []; // wildcards
    var given = []; // Not wild
    for(var p = 0; p < 4; p++) {
      pattern[p] = this.canon(RDFMakeTerm(this, pat[p]));
      if(pattern[p] == undefined) {
        wild.push(p);
      } else {
        given.push(p);
        hash[p] = pattern[p].hashString();
      }
    }
    if(given.length == 0) {
      return this.statements;
    }
    if(given.length == 1) { // Easy too, we have an index for that
      var p = given[0];
      var list = this.index[p][hash[p]];
      if(list && justOne) {
        if(list.length > 1)
          list = list.slice(0, 1);
      }
      return list == undefined ? [] : list;
    }

    // Now given.length is 2, 3 or 4.
    // We hope that the scale-free nature of the data will mean we tend to get
    // a short index in there somewhere!
    var best = 1e10; // really bad
    var best_i;
    for(var i = 0; i < given.length; i++) {
      var p = given[i]; // Which part we are dealing with
      var list = this.index[p][hash[p]];
      if(list == undefined) return []; // No occurrences
      if(list.length < best) {
        best = list.length;
        best_i = i; // (not p!)
      }
    }

    // Ok, we have picked the shortest index but now we have to filter it
    var best_p = given[best_i];
    var possibles = this.index[best_p][hash[best_p]];
    var check = given.slice(0, best_i).concat(given.slice(best_i + 1)) // remove best_i
    var results = [];
    var parts = ['subject', 'predicate', 'object', 'why'];
    for(var j = 0; j < possibles.length; j++) {
      var st = possibles[j];
      for(var i = 0; i < check.length; i++) { // for each position to be checked
        var p = check[i];
        if(!this.canon(st[parts[p]]).sameTerm(pattern[p])) {
          st = null;
          break;
        }
      }
      if(st != null) {
        results.push(st);
        if(justOne)
          break;
      }
    }
    return results;
  }; // statementsMatching
  /** remove a particular statement from the bank **/
  $rdf.IndexedFormula.prototype.remove = function (st) {
    //$rdf.log.debug("entering remove w/ st=" + st);
    var term = [st.subject, st.predicate, st.object, st.why];
    for(var p = 0; p < 4; p++) {
      var c = this.canon(term[p]);
      var h = c.hashString();
      if(this.index[p][h] == undefined) {
        //$rdf.log.warn ("Statement removal: no index '+p+': "+st);
      } else {
        $rdf.Util.RDFArrayRemove(this.index[p][h], st);
      }
    }
    $rdf.Util.RDFArrayRemove(this.statements, st);
  }; //remove
  /** remove all statements matching args (within limit) **/
  $rdf.IndexedFormula.prototype.removeMany = function (subj, pred, obj, why, limit) {
    //$rdf.log.debug("entering removeMany w/ subj,pred,obj,why,limit = " + subj +", "+ pred+", " + obj+", " + why+", " + limit);
    var sts = this.statementsMatching(subj, pred, obj, why, false);
    //This is a subtle bug that occcured in updateCenter.js too.
    //The fact is, this.statementsMatching returns this.whyIndex instead of a copy of it
    //but for perfromance consideration, it's better to just do that
    //so make a copy here.
    var statements = [];
    for(var i = 0; i < sts.length; i++) statements.push(sts[i]);
    if(limit) statements = statements.slice(0, limit);
    for(var i = 0; i < statements.length; i++) this.remove(statements[i]);
  }; //removeMany
  /** Utility**/

  /*  @method: copyTo
    @description: replace @template with @target and add appropriate triples (no triple removed)
                  one-direction replication 
*/
  $rdf.IndexedFormula.prototype.copyTo = function (template, target, flags) {
    if(!flags) flags = [];
    var statList = this.statementsMatching(template);
    if($rdf.Util.ArrayIndexOf(flags, 'two-direction') != -1)
      statList.concat(this.statementsMatching(undefined, undefined, template));
    for(var i = 0; i < statList.length; i++) {
      var st = statList[i];
      switch(st.object.termType) {
      case 'symbol':
        this.add(target, st.predicate, st.object);
        break;
      case 'literal':
      case 'bnode':
      case 'collection':
        this.add(target, st.predicate, st.object.copy(this));
      }
      if($rdf.Util.ArrayIndexOf(flags, 'delete') != -1) this.remove(st);
    }
  };
  //for the case when you alter this.value (text modified in userinput.js)
  $rdf.Literal.prototype.copy = function () {
    return new $rdf.Literal(this.value, this.lang, this.datatype);
  };
  $rdf.BlankNode.prototype.copy = function (formula) { //depends on the formula
    var bnodeNew = new $rdf.BlankNode();
    formula.copyTo(this, bnodeNew);
    return bnodeNew;
  }
  /**  Full N3 bits  -- placeholders only to allow parsing, no functionality! **/

  $rdf.IndexedFormula.prototype.newUniversal = function (uri) {
    var x = this.sym(uri);
    if(!this._universalVariables) this._universalVariables = [];
    this._universalVariables.push(x);
    return x;
  }

  $rdf.IndexedFormula.prototype.newExistential = function (uri) {
    if(!uri) return this.bnode();
    var x = this.sym(uri);
    return this.declareExistential(x);
  }

  $rdf.IndexedFormula.prototype.declareExistential = function (x) {
    if(!this._existentialVariables) this._existentialVariables = [];
    this._existentialVariables.push(x);
    return x;
  }

  $rdf.IndexedFormula.prototype.formula = function (features) {
    return new $rdf.IndexedFormula(features);
  }

  $rdf.IndexedFormula.prototype.close = function () {
    return this;
  }

  $rdf.IndexedFormula.prototype.hashString = $rdf.IndexedFormula.prototype.toNT;

  return $rdf.IndexedFormula;

}();
// ends