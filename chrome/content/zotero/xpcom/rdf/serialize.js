/*      Serialization of RDF Graphs
 **
 ** Tim Berners-Lee 2006
 ** This is or was http://dig.csail.mit.edu/2005/ajar/ajaw/js/rdf/serialize.js
 **
 ** Bug: can't serialize  http://data.semanticweb.org/person/abraham-bernstein/rdf
 ** in XML (from mhausenblas)
 */
// @@@ Check the whole toStr thing tosee whetehr it still makes sense -- tbl
// 
$rdf.Serializer = function () {

  var __Serializer = function (store) {
      this.flags = "";
      this.base = null;
      this.prefixes = [];
      this.keywords = ['a']; // The only one we generate at the moment
      this.prefixchars = "abcdefghijklmnopqustuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      this.incoming = null; // Array not calculated yet
      this.formulas = []; // remebering original formulae from hashes 
      this.store = store;

      /* pass */
    }

  var Serializer = function (store) {
      return new __Serializer(store)
    };

  __Serializer.prototype.setBase = function (base) {
    this.base = base
  };

  __Serializer.prototype.setFlags = function (flags) {
    this.flags = flags ? flags : ''
  };


  __Serializer.prototype.toStr = function (x) {
    var s = x.toNT();
    if(x.termType == 'formula') {
      this.formulas[s] = x; // remember as reverse does not work
    }
    return s;
  };

  __Serializer.prototype.fromStr = function (s) {
    if(s[0] == '{') {
      var x = this.formulas[s];
      if(!x) alert('No formula object for ' + s)
      return x;
    }
    return this.store.fromNT(s);
  };





  /* Accumulate Namespaces
   **
   ** These are only hints.  If two overlap, only one gets used
   ** There is therefore no guarantee in general.
   */

  __Serializer.prototype.suggestPrefix = function (prefix, uri) {
    this.prefixes[uri] = prefix;
  }

  // Takes a namespace -> prefix map
  __Serializer.prototype.suggestNamespaces = function (namespaces) {
    for(var px in namespaces) {
      this.prefixes[namespaces[px]] = px;
    }
  }

  // Make up an unused prefix for a random namespace
  __Serializer.prototype.makeUpPrefix = function (uri) {
    var p = uri;
    var namespaces = [];
    var pok;
    var sz = this;

    function canUse(pp) {
      if(namespaces[pp]) return false; // already used
      sz.prefixes[uri] = pp;
      pok = pp;
      return true
    }
    for(var ns in sz.prefixes) {
      namespaces[sz.prefixes[ns]] = ns; // reverse index
    }
    // trim off illegal characters from the end
    var i;
    for(i = p.length - 1; i>=0; i--) {
      if(sz._notNameChars.indexOf(p.charAt(i)) == -1) break;
    }
    p = p.substring(0, i+1);
    if(p) {
      // find shortest possible NCName to use as namespace name
      for(i = p.length - 1; i>=0; i--) {
        if(sz._notNameChars.indexOf(p.charAt(i)) != -1) break;
      }
      i++;
      p = p.substr(i);
      
      if(p.length < 6 && canUse(p)) return pok; // exact is best
      if(canUse(p.slice(0, 3))) return pok;
      if(canUse(p.slice(0, 2))) return pok;
      if(canUse(p.slice(0, 4))) return pok;
      if(canUse(p.slice(0, 1))) return pok;
      if(canUse(p.slice(0, 5))) return pok;
      p = p.slice(0, 3);
    } else {
      // no suitable characters (weird), fall back to 'ns'
      p = 'ns';
      if(canUse(p)) return pok;
    }
    for(var i = 0;; i++) if(canUse(p + i)) return pok;
  }



  // Todo:
  //  - Sort the statements by subject, pred, object
  //  - do stuff about the docu first and then (or first) about its primary topic.
  __Serializer.prototype.rootSubjects = function (sts) {
    var incoming = {};
    var subjects = {};
    var sz = this;
    var allBnodes = {};

    /* This scan is to find out which nodes will have to be the roots of trees
     ** in the serialized form. This will be any symbols, and any bnodes
     ** which hve more or less than one incoming arc, and any bnodes which have
     ** one incoming arc but it is an uninterrupted loop of such nodes back to itself.
     ** This should be kept linear time with repect to the number of statements.
     ** Note it does not use any indexing of the store.
     */


    tabulator.log.debug('serialize.js Find bnodes with only one incoming arc\n')
    for(var i = 0; i < sts.length; i++) {
      var st = sts[i];
      [st.subject, st.predicate, st.object].map(function (y) {
        if(y.termType == 'bnode') {
          allBnodes[y.toNT()] = true
        }
      });
      var x = sts[i].object;
      if(!incoming[x]) incoming[x] = [];
      incoming[x].push(st.subject) // List of things which will cause this to be printed
      var ss = subjects[sz.toStr(st.subject)]; // Statements with this as subject
      if(!ss) ss = [];
      ss.push(st);
      subjects[this.toStr(st.subject)] = ss; // Make hash. @@ too slow for formula?
      //$rdf.log.debug(' sz potential subject: '+sts[i].subject)
    }

    var roots = [];
    for(var xNT in subjects) {
      var x = sz.fromStr(xNT);
      if((x.termType != 'bnode') || !incoming[x] || (incoming[x].length != 1)) {
        roots.push(x);
        //$rdf.log.debug(' sz actual subject -: ' + x)
        continue;
      }
    }
    this.incoming = incoming; // Keep for serializing @@ Bug for nested formulas
    //////////// New bit for CONNECTED bnode loops:frootshash
    // This scans to see whether the serialization is gpoing to lead to a bnode loop
    // and at the same time accumulates a list of all bnodes mentioned.
    // This is in fact a cut down N3 serialization
    /*
    tabulator.log.debug('serialize.js Looking for connected bnode loops\n')
    for (var i=0; i<sts.length; i++) { // @@TBL
        // dump('\t'+sts[i]+'\n');
    }
    var doneBnodesNT = {};
    function dummyPropertyTree(subject, subjects, rootsHash) {
        // dump('dummyPropertyTree('+subject+'...)\n');
        var sts = subjects[sz.toStr(subject)]; // relevant statements
        for (var i=0; i<sts.length; i++) {
            dummyObjectTree(sts[i].object, subjects, rootsHash);
        }
    }

    // Convert a set of statements into a nested tree of lists and strings
    // @param force,    "we know this is a root, do it anyway. It isn't a loop."
    function dummyObjectTree(obj, subjects, rootsHash, force) { 
        // dump('dummyObjectTree('+obj+'...)\n');
        if (obj.termType == 'bnode' && (subjects[sz.toStr(obj)]  &&
            (force || (rootsHash[obj.toNT()] == undefined )))) {// and there are statements
            if (doneBnodesNT[obj.toNT()]) { // Ah-ha! a loop
                throw new Error("Serializer: Should be no loops "+obj);
            }
            doneBnodesNT[obj.toNT()] = true;
            return  dummyPropertyTree(obj, subjects, rootsHash);
        }
        return dummyTermToN3(obj, subjects, rootsHash);
    }
    
    // Scan for bnodes nested inside lists too
    function dummyTermToN3(expr, subjects, rootsHash) {
        if (expr.termType == 'bnode') doneBnodesNT[expr.toNT()] = true;
        tabulator.log.debug('serialize: seen '+expr);
        if (expr.termType == 'collection') {
            for (i=0; i<expr.elements.length; i++) {
                if (expr.elements[i].termType == 'bnode')
                    dummyObjectTree(expr.elements[i], subjects, rootsHash);
            }
        return;             
        }
    }

    // The tree for a subject
    function dummySubjectTree(subject, subjects, rootsHash) {
        // dump('dummySubjectTree('+subject+'...)\n');
        if (subject.termType == 'bnode' && !incoming[subject])
            return dummyObjectTree(subject, subjects, rootsHash, true); // Anonymous bnode subject
        dummyTermToN3(subject, subjects, rootsHash);
        dummyPropertyTree(subject, subjects, rootsHash);
    }
*/
    // Now do the scan using existing roots
    tabulator.log.debug('serialize.js Dummy serialize to check for missing nodes')
    var rootsHash = {};
    for(var i = 0; i < roots.length; i++) rootsHash[roots[i].toNT()] = true;
    /*
    for (var i=0; i<roots.length; i++) {
        var root = roots[i];
        dummySubjectTree(root, subjects, rootsHash);
    }
    // dump('Looking for mising bnodes...\n')
    
// Now in new roots for anythig not acccounted for
// Now we check for any bndoes which have not been covered.
// Such bnodes must be in isolated rings of pure bnodes.
// They each have incoming link of 1.

    tabulator.log.debug('serialize.js Looking for connected bnode loops\n')
    for (;;) {
        var bnt;
        var found = null;
        for (bnt in allBnodes) { // @@ Note: not repeatable. No canonicalisation
            if (doneBnodesNT[bnt]) continue;
            found = bnt; // Ah-ha! not covered
            break;
        }
        if (found == null) break; // All done - no bnodes left out/
        // dump('Found isolated bnode:'+found+'\n');
        doneBnodesNT[bnt] = true;
        var root = this.store.fromNT(found);
        roots.push(root); // Add a new root
        rootsHash[found] = true;
        tabulator.log.debug('isolated bnode:'+found+', subjects[found]:'+subjects[found]+'\n');
        if (subjects[found] == undefined) {
            for (var i=0; i<sts.length; i++) {
                // dump('\t'+sts[i]+'\n');
            }
            throw new Error("Isolated node should be a subject" +found);
        }
        dummySubjectTree(root, subjects, rootsHash); // trace out the ring
    }
    // dump('Done bnode adjustments.\n')
*/
    return {
      'roots': roots,
      'subjects': subjects,
      'rootsHash': rootsHash,
      'incoming': incoming
    };
  }

  ////////////////////////////////////////////////////////
  __Serializer.prototype.toN3 = function (f) {
    return this.statementsToN3(f.statements);
  }

  __Serializer.prototype._notQNameChars = "\t\r\n !\"#$%&'()*,+/;<=>?@[\\]^`{|}~";
  __Serializer.prototype._notNameChars = (__Serializer.prototype._notQNameChars + ":");
  __Serializer.prototype._NCNameRegExp = (function() {
    // escape characters that are unsafe inside RegExp character set
    var reSafeChars = __Serializer.prototype._notNameChars.replace(/[-\]\\]/g, '\\$&');
    return new RegExp('[^0-9\\-.' + reSafeChars + '][^' + reSafeChars + ']*$');
  })();


  __Serializer.prototype.statementsToN3 = function (sts) {
    var indent = 4;
    var width = 80;
    var sz = this;

    var namespaceCounts = []; // which have been used
    var predMap = {
      'http://www.w3.org/2002/07/owl#sameAs': '=',
      'http://www.w3.org/2000/10/swap/log#implies': '=>',
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': 'a'
    }




    ////////////////////////// Arrange the bits of text 
    var spaces = function (n) {
        var s = '';
        for(var i = 0; i < n; i++) s += ' ';
        return s
      }

    var treeToLine = function (tree) {
        var str = '';
        for(var i = 0; i < tree.length; i++) {
          var branch = tree[i];
          var s2 = (typeof branch == 'string') ? branch : treeToLine(branch);
          if(i != 0 && s2 != ',' && s2 != ';' && s2 != '.') str += ' ';
          str += s2;
        }
        return str;
      }

      // Convert a nested tree of lists and strings to a string
    var treeToString = function (tree, level) {
        var str = '';
        var lastLength = 100000;
        if(!level) level = 0;
        for(var i = 0; i < tree.length; i++) {
          var branch = tree[i];
          if(typeof branch != 'string') {
            var substr = treeToString(branch, level + 1);
            if(substr.length < 10 * (width - indent * level)
              && substr.indexOf('"""') < 0) {
              // Don't mess up multiline strings
              var line = treeToLine(branch);
              if(line.length < (width - indent * level)) {
                branch = '   ' + line; //   @@ Hack: treat as string below
                substr = ''
              }
            }
            if(substr) lastLength = 10000;
            str += substr;
          }
          if(typeof branch == 'string') {
            if(branch.length == '1' && str.slice(-1) == '\n') {
              if(",.;".indexOf(branch) >= 0) {
                str = str.slice(0, -1) + branch + '\n'; //  slip punct'n on end
                lastLength += 1;
                continue;
              } else if("])}".indexOf(branch) >= 0) {
                str = str.slice(0, -1) + ' ' + branch + '\n';
                lastLength += 2;
                continue;
              }
            }
            if(lastLength < (indent * level + 4)) { // continue
              str = str.slice(0, -1) + ' ' + branch + '\n';
              lastLength += branch.length + 1;
            } else {
              var line = spaces(indent * level) + branch;
              str += line + '\n';
              lastLength = line.length;
            }

          } else { // not string
          }
        }
        return str;
      };

    ////////////////////////////////////////////// Structure for N3

    // Convert a set of statements into a nested tree of lists and strings
    function statementListToTree(statements) {
      // print('Statement tree for '+statements.length);
      var res = [];
      var stats = sz.rootSubjects(statements);
      var roots = stats.roots;
      var results = []
      for(var i = 0; i < roots.length; i++) {
        var root = roots[i];
        results.push(subjectTree(root, stats))
      }
      return results;
    }

    // The tree for a subject
    function subjectTree(subject, stats) {
      if(subject.termType == 'bnode' && !stats.incoming[subject])
        return objectTree(subject, stats, true).concat(["."]); // Anonymous bnode subject
      return [termToN3(subject, stats)].concat([propertyTree(subject, stats)]).concat(["."]);
    }


    // The property tree for a single subject or anonymous node
    function propertyTree(subject, stats) {
      // print('Proprty tree for '+subject);
      var results = []
      var lastPred = null;
      var sts = stats.subjects[sz.toStr(subject)]; // relevant statements
      if(typeof sts == 'undefined') {
        throw('Cant find statements for ' + subject);
      }
      sts.sort();
      var objects = [];
      for(var i = 0; i < sts.length; i++) {
        var st = sts[i];
        if(st.predicate.uri == lastPred) {
          objects.push(',');
        } else {
          if(lastPred) {
            results = results.concat([objects]).concat([';']);
            objects = [];
          }
          results.push(predMap[st.predicate.uri] ?
            predMap[st.predicate.uri] :
            termToN3(st.predicate, stats));
        }
        lastPred = st.predicate.uri;
        objects.push(objectTree(st.object, stats));
      }
      results = results.concat([objects]);
      return results;
    }

    function objectTree(obj, stats, force) {
      if(obj.termType == 'bnode'
        && stats.subjects[sz.toStr(obj)]
        // and there are statements
        && (force || stats.rootsHash[obj.toNT()] == undefined)) // and not a root
        return ['['].concat(propertyTree(obj, stats)).concat([']']);
      return termToN3(obj, stats);
    }

    function termToN3(expr, stats) {
      switch(expr.termType) {
      case 'bnode':
      case 'variable':
        return expr.toNT();
      case 'literal':
        var str = stringToN3(expr.value);
        if(expr.lang) str += '@' + expr.lang;
        if(expr.datatype) str += '^^' + termToN3(expr.datatype, stats);
        return str;
      case 'symbol':
        return symbolToN3(expr.uri);
      case 'formula':
        var res = ['{'];
        res = res.concat(statementListToTree(expr.statements));
        return res.concat(['}']);
      case 'collection':
        var res = ['('];
        for(i = 0; i < expr.elements.length; i++) {
          res.push([objectTree(expr.elements[i], stats)]);
        }
        res.push(')');
        return res;

      default:
        throw new Error("Internal: termToN3 cannot handle " + expr + " of termType+" + expr.termType);
        return '' + expr;
      }
    }

    ////////////////////////////////////////////// Atomic Terms
    //  Deal with term level things and nesting with no bnode structure
    function symbolToN3(uri) { // c.f. symbolString() in notation3.py
      var j = uri.indexOf('#');
      if(j < 0 && sz.flags.indexOf('/') < 0) {
        j = uri.lastIndexOf('/');
      }
      if(j >= 0 && sz.flags.indexOf('p') < 0) { // Can split at namespace
        var canSplit = true;
        for(var k = j + 1; k < uri.length; k++) {
          if(__Serializer.prototype._notNameChars.indexOf(uri[k]) >= 0) {
            canSplit = false;
            break;
          }
        }
        if(canSplit) {
          var localid = uri.slice(j + 1);
          var namesp = uri.slice(0, j + 1);
          if(sz.defaultNamespace
            && sz.defaultNamespace == namesp
            && sz.flags.indexOf('d') < 0) { // d -> suppress default
            if(sz.flags.indexOf('k') >= 0
              && sz.keyords.indexOf(localid) < 0)
              return localid;
            return ':' + localid;
          }
          var prefix = sz.prefixes[namesp];
          if(prefix) {
            namespaceCounts[namesp] = true;
            return prefix + ':' + localid;
          }
          if(uri.slice(0, j) == sz.base)
            return '<#' + localid + '>';
          // Fall though if can't do qname
        }
      }
      if(sz.flags.indexOf('r') < 0 && sz.base)
        uri = $rdf.Util.uri.refTo(sz.base, uri);
      else if(sz.flags.indexOf('u') >= 0)
        uri = backslashUify(uri);
      else uri = hexify(uri);
      return '<' + uri + '>';
    }

    function prefixDirectives() {
      var str = '';
      if(sz.defaultNamespace)
        str += '@prefix : <' + sz.defaultNamespace + '>.\n';
      for(var ns in namespaceCounts) {
        str += '@prefix ' + sz.prefixes[ns] + ': <' + ns + '>.\n';
      }
      return str + '\n';
    }

    //  stringToN3:  String escaping for N3
    //
    var forbidden1 = new RegExp(/[\\"\b\f\r\v\t\n\u0080-\uffff]/gm);
    var forbidden3 = new RegExp(/[\\"\b\f\r\v\u0080-\uffff]/gm);

    function stringToN3(str, flags) {
      if(!flags) flags = "e";
      var res = '', i = 0, j = 0;
      var delim;
      var forbidden;
      if(str.length > 20 // Long enough to make sense
        && str.slice(-1) != '"' // corner case'
        && flags.indexOf('n') < 0 // Force single line
        && (str.indexOf('\n') > 0 || str.indexOf('"') > 0)) {
        delim = '"""';
        forbidden = forbidden3;
      } else {
        delim = '"';
        forbidden = forbidden1;
      }
      for(i = 0; i < str.length;) {
        forbidden.lastIndex = 0;
        var m = forbidden.exec(str.slice(i));
        if(m == null) break;
        j = i + forbidden.lastIndex - 1;
        res += str.slice(i, j);
        var ch = str[j];
        if(ch == '"' && delim == '"""' && str.slice(j, j + 3) != '"""') {
          res += ch;
        } else {
          var k = '\b\f\r\t\v\n\\"'.indexOf(ch); // No escaping of bell (7)?
          if(k >= 0) {
            res += "\\" + 'bfrtvn\\"' [k];
          } else {
            if(flags.indexOf('e') >= 0) {
              res += '\\u' + ('000' + ch.charCodeAt(0).toString(16).toLowerCase()).slice(-4)
            } else { // no 'e' flag
              res += ch;
            }
          }
        }
        i = j + 1;
      }
      return delim + res + str.slice(i) + delim
    }

    // Body of toN3:
    var tree = statementListToTree(sts);
    return prefixDirectives() + treeToString(tree, -1);

  }

  // String ecaping utilities 
  function hexify(str) { // also used in parser
    //     var res = '';
    //     for (var i=0; i<str.length; i++) {
    //         k = str.charCodeAt(i);
    //         if (k>126 || k<33)
    //             res += '%' + ('0'+n.toString(16)).slice(-2); // convert to upper?
    //         else
    //             res += str[i];
    //     }
    //     return res;
    return encodeURI(str);
  }


  function backslashUify(str) {
    var res = '', k;
    for(var i = 0; i < str.length; i++) {
      k = str.charCodeAt(i);
      if(k > 65535)
        res += '\\U' + ('00000000' + n.toString(16)).slice(-8); // convert to upper?
      else if(k > 126)
        res += '\\u' + ('0000' + n.toString(16)).slice(-4);
      else
        res += str[i];
    }
    return res;
  }






  //////////////////////////////////////////////// XML serialization
  __Serializer.prototype.statementsToXML = function (sts) {
    var indent = 4;
    var width = 80;
    var sz = this;

    var namespaceCounts = []; // which have been used
    namespaceCounts['http://www.w3.org/1999/02/22-rdf-syntax-ns#'] = true;

    ////////////////////////// Arrange the bits of XML text 
    var spaces = function (n) {
        var s = '';
        for(var i = 0; i < n; i++) s += ' ';
        return s
      }

    var XMLtreeToLine = function (tree) {
        var str = '';
        for(var i = 0; i < tree.length; i++) {
          var branch = tree[i];
          var s2 = (typeof branch == 'string') ? branch : XMLtreeToLine(branch);
          str += s2;
        }
        return str;
      }

      // Convert a nested tree of lists and strings to a string
    var XMLtreeToString = function (tree, level) {
        var str = '';
        var lastLength = 100000;
        if(!level) level = 0;
        for(var i = 0; i < tree.length; i++) {
          var branch = tree[i];
          if(typeof branch != 'string') {
            var substr = XMLtreeToString(branch, level + 1);
            if(substr.length < 10 * (width - indent * level)
              && substr.indexOf('"""') < 0) {
              // Don't mess up multiline strings
              var line = XMLtreeToLine(branch);
              if(line.length < (width - indent * level)) {
                branch = '   ' + line; //   @@ Hack: treat as string below
                substr = ''
              }
            }
            if(substr) lastLength = 10000;
            str += substr;
          }
          if(typeof branch == 'string') {
            if(lastLength < (indent * level + 4)) { // continue
              str = str.slice(0, -1) + ' ' + branch + '\n';
              lastLength += branch.length + 1;
            } else {
              var line = spaces(indent * level) + branch;
              str += line + '\n';
              lastLength = line.length;
            }

          } else { // not string
          }
        }
        return str;
      };

    function statementListToXMLTree(statements) {
      sz.suggestPrefix('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      var stats = sz.rootSubjects(statements);
      var roots = stats.roots;
      var results = [], root;
      for(var i = 0; i < roots.length; i++) {
        root = roots[i];
        results.push(subjectXMLTree(root, stats))
      }
      return results;
    }

    function escapeForXML(str) {
      if(typeof str == 'undefined') return '@@@undefined@@@@';
      return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function relURI(term) {
      return escapeForXML((sz.base) ? $rdf.Util.uri.refTo(this.base, term.uri) : term.uri);
    }

    // The tree for a subject
    function subjectXMLTree(subject, stats) {
      const liPrefix = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_';
      var results = [];
      var type = null, t, st;
      var sts = stats.subjects[sz.toStr(subject)]; // relevant statements
      // Sort only on the predicate, leave the order at object
      // level undisturbed.  This leaves multilingual content in
      // the order of entry (for partner literals), which helps
      // readability.
      //
      // For the predicate sort, we attempt to split the uri
      // as a hint to the sequence, as sequenced items seems
      // to be of the form http://example.com#_1, http://example.com#_2,
      // et cetera.  Probably not the most optimal of fixes, but
      // it does work.
      sts.sort(function (a, b) {
        var aa = a.predicate.uri.split('#_');
        var bb = a.predicate.uri.split('#_');
        if(aa[0] > bb[0]) {
          return 1;
        } else if(aa[0] < bb[0]) {
          return -1;
        } else if("undefined" !== typeof aa[1] && "undefined" !== typeof bb[1]) {
          if(parseInt(aa[1], 10) > parseInt(bb[1], 10)) {
            return 1;
          } else if(parseInt(aa[1], 10) < parseInt(bb[1], 10)) {
            return -1;
          }
        }
        return 0;
      });

      for(var i = 0; i < sts.length; i++) {
        st = sts[i];
        if(st.predicate.uri == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' && !type && st.object.termType == "symbol") {
          // look for a type
          type = st.object;
        } else {
          // see whether predicate can be replaced with "li"
          if(st.predicate.uri.substr(0, liPrefix.length) == liPrefix) {
            var number = st.predicate.uri.substr(liPrefix.length);
            // make sure these are actually numeric list items
            var intNumber = parseInt(number);
            if(number == intNumber.toString()) {
              // was numeric; don't need to worry about ordering since we've already
              // sorted the statements
              st.predicate = $rdf.Symbol('http://www.w3.org/1999/02/22-rdf-syntax-ns#li');
            }
          }
          t = qname(st.predicate);
          switch(st.object.termType) {
          case 'bnode':
            if(sz.incoming[st.object].length == 1) {
              results = results.concat(['<' + t + '>',
                                                        subjectXMLTree(st.object, stats),
                                                        '</' + t + '>']);
            } else {
              results = results.concat(['<' + t + ' rdf:nodeID="'
                                                        + st.object.toNT().slice(2) + '"/>']);
            }
            break;
          case 'symbol':
            results = results.concat(['<' + t + ' rdf:resource="'
                                                  + relURI(st.object) + '"/>']);
            break;
          case 'literal':
            results = results.concat(['<' + t
                                                  + (st.object.dt ? ' rdf:datatype="' + escapeForXML(st.object.dt.uri) + '"' : '')
                                                  + (st.object.lang ? ' xml:lang="' + st.object.lang + '"' : '')
                                                  + '>' + escapeForXML(st.object.value)
                                                  + '</' + t + '>']);
            break;
          case 'collection':
            results = results.concat(['<' + t + ' rdf:parseType="Collection">',
                                                  collectionXMLTree(st.object, stats),
                                                  '</' + t + '>']);
            break;
          default:
            throw new Error("Can't serialize object of type " + st.object.termType + " into XML");
          } // switch
        }
      }

      var tag = type ? qname(type) : 'rdf:Description';

      var attrs = '';
      if(subject.termType == 'bnode') {
        if(!sz.incoming[subject] || sz.incoming[subject].length != 1) { // not an anonymous bnode
          attrs = ' rdf:nodeID="' + subject.toNT().slice(2) + '"';
        }
      } else {
        attrs = ' rdf:about="' + relURI(subject) + '"';
      }

      return ['<' + tag + attrs + '>'].concat([results]).concat(["</" + tag + ">"]);
    }

    function collectionXMLTree(subject, stats) {
      var res = []
      for(var i = 0; i < subject.elements.length; i++) {
        res.push(subjectXMLTree(subject.elements[i], stats));
      }
      return res;
    }

    // The property tree for a single subject or anonymos node
    function propertyXMLTree(subject, stats) {
      var results = []
      var sts = stats.subjects[sz.toStr(subject)]; // relevant statements
      if(sts == undefined) return results; // No relevant statements
      sts.sort();
      for(var i = 0; i < sts.length; i++) {
        var st = sts[i];
        switch(st.object.termType) {
        case 'bnode':
          if(stats.rootsHash[st.object.toNT()]) { // This bnode has been done as a root -- no content here @@ what bout first time
            results = results.concat(['<' + qname(st.predicate) + ' rdf:nodeID="' + st.object.toNT().slice(2) + '">',
                                      '</' + qname(st.predicate) + '>']);
          } else {
            results = results.concat(['<' + qname(st.predicate) + ' rdf:parseType="Resource">',
                                      propertyXMLTree(st.object, stats),
                                      '</' + qname(st.predicate) + '>']);
          }
          break;
        case 'symbol':
          results = results.concat(['<' + qname(st.predicate) + ' rdf:resource="'
                                        + relURI(st.object) + '"/>']);
          break;
        case 'literal':
          results = results.concat(['<' + qname(st.predicate)
                                    + (st.object.datatype ? ' rdf:datatype="' + escapeForXML(st.object.datatype.uri) + '"' : '')
                                    + (st.object.lang ? ' xml:lang="' + st.object.lang + '"' : '')
                                    + '>' + escapeForXML(st.object.value)
                                    + '</' + qname(st.predicate) + '>']);
          break;
        case 'collection':
          results = results.concat(['<' + qname(st.predicate) + ' rdf:parseType="Collection">',
                                    collectionXMLTree(st.object, stats),
                                    '</' + qname(st.predicate) + '>']);
          break;
        default:
          throw new Error("Can't serialize object of type " + st.object.termType + " into XML");

        } // switch
      }
      return results;
    }

    function qname(term) {
      var uri = term.uri;

      var j = uri.search(sz._NCNameRegExp);
      if(j < 0) throw("Cannot make qname out of <" + uri + ">")
      
      var localid = uri.substr(j);
      var namesp = uri.substr(0, j);
      if(sz.defaultNamespace
        && sz.defaultNamespace == namesp
        && sz.flags.indexOf('d') < 0) { // d -> suppress default
        return localid;
      }
      var prefix = sz.prefixes[namesp];
      if(!prefix) prefix = sz.makeUpPrefix(namesp);
      namespaceCounts[namesp] = true;
      return prefix + ':' + localid;
      //        throw ('No prefix for namespace "'+namesp +'" for XML qname for '+uri+', namespaces: '+sz.prefixes+' sz='+sz); 
    }

    // Body of toXML:
    var tree = statementListToXMLTree(sts);
    var str = '<rdf:RDF';
    if(sz.defaultNamespace)
      str += ' xmlns="' + escapeForXML(sz.defaultNamespace) + '"';
    for(var ns in namespaceCounts) {
      str += '\n xmlns:' + sz.prefixes[ns] + '="' + escapeForXML(ns) + '"';
    }
    str += '>';

    var tree2 = [str, tree, '</rdf:RDF>']; //@@ namespace declrations
    return XMLtreeToString(tree2, -1);


  } // End @@ body
  return Serializer;

}();