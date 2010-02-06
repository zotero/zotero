/*      Serialization of RDF Graphs
**
** Tim Berners-Lee 2006
** This is or was http://dig.csail.mit.edu/2005/ajar/ajaw/js/rdf/serialize.js
**
** Bug: can't serialize  http://data.semanticweb.org/person/abraham-bernstein/rdf 
** in XML (from mhausenblas)
*/

__Serializer = function(){
    this.flags = "";
    this.base = null;
    this.prefixes = [];
    this.keywords = ['a']; // The only one we generate at the moment
    this.prefixchars = "abcdefghijklmnopqustuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    this.incoming = null;  // Array not calculated yet
    this.formulas = [];  // remebering original formulae from hashes 

    /* pass */
}

Serializer = function() {return new __Serializer()}; 

__Serializer.prototype.setBase = function(base)
    { this.base = base };

__Serializer.prototype.setFlags = function(flags)
    { this.flags = flags?flags: '' };


__Serializer.prototype.toStr = function(x) {
        var s = x.toNT();
        if (x.termType == 'formula') {
            this.formulas[s] = x; // remember as reverse does not work
        }
        return s;
};
    
__Serializer.prototype.fromStr = function(s) {
        if (s[0] == '{') {
            var x = this.formulas[s];
            if (!x) alert('No formula object for '+s)
            return x;
        }
        return kb.fromNT(s);
};
    




/* Accumulate Namespaces
** 
** These are only hints.  If two overlap, only one gets used
** There is therefore no guarantee in general.
*/

__Serializer.prototype.suggestPrefix = function(prefix, uri) {
    this.prefixes[uri] = prefix;
}

// Takes a namespace -> prefix map
__Serializer.prototype.suggestNamespaces = function(namespaces) {
    for (var px in namespaces) {
        this.prefixes[namespaces[px]] = px;
    }
}

// Make up an unused prefix for a random namespace
__Serializer.prototype.makeUpPrefix = function(uri) {
    var p = uri;
    var namespaces = [];
    var pok;
    var sz = this;
    
    function canUse(pp) {
        if (namespaces[pp]) return false; // already used
        sz.prefixes[uri] = pp;
        pok = pp;
        return true
    }
    for (var ns in sz.prefixes) namespaces[sz.prefixes[ns]] = ns; // reverse index
    if ('#/'.indexOf(p[p.length-1]) >= 0) p = p.slice(0, -1);
    var slash = p.lastIndexOf('/');
    if (slash >= 0) p = p.slice(slash+1);
    var i = 0;
    while (i < p.length)
        if (sz.prefixchars.indexOf(p[i])) i++; else break;
    p = p.slice(0,i);
    if (p.length < 6 && canUse(p)) return pok; // exact i sbest
    if (canUse(p.slice(0,3))) return pok;
    if (canUse(p.slice(0,2))) return pok;
    if (canUse(p.slice(0,4))) return pok;
    if (canUse(p.slice(0,1))) return pok;
    if (canUse(p.slice(0,5))) return pok;
    for (var i=0;; i++) if (canUse(p.slice(0,3)+i)) return pok; 
}


/* The scan is to find out which nodes will have to be the roots of trees
** in the serialized form. This will be any symbols, and any bnodes
** which hve more or less than one incoming arc, and any bnodes which have
** one incoming arc but it is an uninterrupted loop of such nodes back to itself.
** This should be kept linear time with repect to the number of statements.
** Note it does not use any indexing.
*/


// Todo:
//  - Sort the statements by subject, pred, object
//  - do stuff about the docu first and then (or first) about its primary topic.

__Serializer.prototype.rootSubjects = function(sts) {
    var incoming = {};
    var subjects = {};
    var sz = this;

    for (var i = 0; i<sts.length; i++) {
        var x = sts[i].object;
        if (!incoming[x]) incoming[x] = [];
        incoming[x].push(sts[i].subject) // List of things which will cause this to be printed
        var ss =  subjects[sz.toStr(sts[i].subject)]; // Statements with this as subject
        if (!ss) ss = [];
        ss.push(sts[i]);
        subjects[this.toStr(sts[i].subject)] = ss; // Make hash. @@ too slow for formula?
        tabulator.log.debug(' sz potential subject: '+sts[i].subject)
    }

    var roots = [];
    var loopBreakers = {};
    
    function accountedFor(x, start) {
        if (x.termType != 'bnode') return true; // will be subject
        var zz = incoming[x];
        if (!zz || zz.length != 1) return true;
        if (loopBreakers[x]) return true;
        if (zz[0] == start) return false;
        return accountedFor(zz[0], start);
    }
    for (var xNT in subjects) {
        var x = sz.fromStr(xNT);
        if ((x.termType != 'bnode') || !incoming[x] || (incoming[x].length != 1)){
            roots.push(x);
            tabulator.log.debug(' sz actual subject -: ' + x)
            continue;
        }
        if (accountedFor(incoming[x][0]), x) {
            continue;
        }
        roots.push(x);
        tabulator.log.debug(' sz potential subject *: '+sts[i].subject)
        loopBreakers[x] = 1;
    }
    this.incoming = incoming; // Keep for serializing
    return [roots, subjects];
}

////////////////////////////////////////////////////////

__Serializer.prototype.toN3 = function(f) {
    return this.statementsToN3(f.statements);
}

__Serializer.prototype._notQNameChars = "\t\r\n !\"#$%&'()*.,+/;<=>?@[\\]^`{|}~";
__Serializer.prototype._notNameChars = 
                    ( __Serializer.prototype._notQNameChars + ":" ) ;

    
__Serializer.prototype.statementsToN3 = function(sts) {
    var indent = 4;
    var width = 80;
    // var subjects = null; // set later
    var sz = this;

    var namespaceCounts = []; // which have been used

    predMap = {
        'http://www.w3.org/2002/07/owl#sameAs': '=',
        'http://www.w3.org/2000/10/swap/log#implies': '=>',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': 'a'
    }
    

    
    
    ////////////////////////// Arrange the bits of text 

    var spaces=function(n) {
        var s='';
        for(var i=0; i<n; i++) s+=' ';
        return s
    }

    treeToLine = function(tree) {
        var str = '';
        for (var i=0; i<tree.length; i++) {
            var branch = tree[i];
            var s2 = (typeof branch == 'string') ? branch : treeToLine(branch);
            if (i!=0 && s2 != ',' && s2 != ';' && s2 != '.') str += ' ';
            str += s2;
        }
        return str;
    }
    
    // Convert a nested tree of lists and strings to a string
    treeToString = function(tree, level) {
        var str = '';
        var lastLength = 100000;
        if (!level) level = 0;
        for (var i=0; i<tree.length; i++) {
            var branch = tree[i];
            if (typeof branch != 'string') {
                var substr = treeToString(branch, level +1);
                if (
                    substr.length < 10*(width-indent*level)
                    && substr.indexOf('"""') < 0) {// Don't mess up multiline strings
                    var line = treeToLine(branch);
                    if (line.length < (width-indent*level)) {
                        branch = '   '+line; //   @@ Hack: treat as string below
                        substr = ''
                    }
                }
                if (substr) lastLength = 10000;
                str += substr;
            }
            if (typeof branch == 'string') {
                if (branch.length == '1' && str.slice(-1) == '\n') {
                    if (",.;".indexOf(branch) >=0) {
                        str = str.slice(0,-1) + branch + '\n'; //  slip punct'n on end
                        lastLength += 1;
                        continue;
                    } else if ("])}".indexOf(branch) >=0) {
                        str = str.slice(0,-1) + ' ' + branch + '\n';
                        lastLength += 2;
                        continue;
                    }
                }
                if (lastLength < (indent*level+4)) { // continue
                    str = str.slice(0,-1) + ' ' + branch + '\n';
                    lastLength += branch.length + 1;
                } else {
                    var line = spaces(indent*level) +branch;
                    str += line +'\n'; 
                    lastLength = line.length;
                }
 
            } else { // not string
            }
        }
        return str;
    };

    ////////////////////////////////////////////// Structure for N3
    
    
    function statementListToTree(statements) {
        // print('Statement tree for '+statements.length);
        var res = [];
        var pair = sz.rootSubjects(statements);
        var roots = pair[0];
        // print('Roots: '+roots)
        var subjects = pair[1];
        var results = []
        for (var i=0; i<roots.length; i++) {
            var root = roots[i];
            results.push(subjectTree(root, subjects))
        }
        return results;
    }
    
    // The tree for a subject
    function subjectTree(subject, subjects) {
        if (subject.termType == 'bnode' && !sz.incoming[subject])
            return objectTree(subject, subjects).concat(["."]); // Anonymous bnode subject
        return [ termToN3(subject, subjects) ].concat([propertyTree(subject, subjects)]).concat(["."]);
    }
    

    // The property tree for a single subject or anonymous node
    function propertyTree(subject, subjects) {
        // print('Proprty tree for '+subject);
        var results = []
        var lastPred = null;
        var sts = subjects[sz.toStr(subject)]; // relevant statements
        if (typeof sts == 'undefined') {
            alert('Cant find statements for '+subject);
        }
        sts.sort();
        var objects = [];
        for (var i=0; i<sts.length; i++) {
            var st = sts[i];
            if (st.predicate.uri == lastPred) {
                objects.push(',');
            } else {
                if (lastPred) {
                    results=results.concat([objects]).concat([';']);
                    objects = [];
                }
                results.push(predMap[st.predicate.uri] ?
                            predMap[st.predicate.uri] : termToN3(st.predicate, subjects));
            }
            lastPred = st.predicate.uri;
            objects.push(objectTree(st.object, subjects));
        }
        results=results.concat([objects]);
        return results;
    }

    // Convert a set of statements into a nested tree of lists and strings
    function objectTree(obj, subjects) {
        if (obj.termType == 'bnode' && subjects[sz.toStr(obj)]) // and there are statements
            return  ['['].concat(propertyTree(obj, subjects)).concat([']']);
        return termToN3(obj, subjects);
    }
    
    ////////////////////////////////////////////// Atomic Terms
    
    //  Deal with term level things and nesting with no bnode structure
    
    function termToN3(expr, subjects) {
        switch(expr.termType) {
            case 'bnode':
            case 'variable':  return expr.toNT();
            case 'literal':
                var str = stringToN3(expr.value);
                if (expr.lang) str+= '@' + expr.lang;
                if (expr.dt) str+= '^^' + termToN3(expr.dt, subjects);
                return str;
            case 'symbol':
                return symbolToN3(expr.uri);
            case 'formula':
                var res = ['{'];
                res = res.concat(statementListToTree(expr.statements));
                return  res.concat(['}']);
            case 'collection':
                var res = ['('];
                for (i=0; i<expr.elements.length; i++) {
                    res.push(   [ objectTree(expr.elements[i], subjects) ]);
                }
                res.push(')');
                return res;
                
           default:
                throw "Internal: termToN3 cannot handle "+expr+" of termType+"+expr.termType
                return ''+expr;
        }
    }
    
    function symbolToN3(uri) {  // c.f. symbolString() in notation3.py
        var j = uri.indexOf('#');
        if (j<0 && sz.flags.indexOf('/') < 0) {
            j = uri.lastIndexOf('/');
        }
        if (j >= 0 && sz.flags.indexOf('p') < 0)  { // Can split at namespace
            var canSplit = true;
            for (var k=j+1; k<uri.length; k++) {
                if (__Serializer.prototype._notNameChars.indexOf(uri[k]) >=0) {
                    canSplit = false; break;
                }
            }
            if (canSplit) {
                var localid = uri.slice(j+1);
                var namesp = uri.slice(0,j+1);
                if (sz.defaultNamespace && sz.defaultNamespace == namesp
                    && sz.flags.indexOf('d') < 0) {// d -> suppress default
                    if (sz.flags.indexOf('k') >= 0 &&
                        sz.keyords.indexOf(localid) <0)
                        return localid; 
                    return ':' + localid;
                }
                var prefix = sz.prefixes[namesp];
                if (prefix) {
                    namespaceCounts[namesp] = true;
                    return prefix + ':' + localid;
                }
                if (uri.slice(0, j) == sz.base)
                    return '<#' + localid + '>';
                // Fall though if can't do qname
            }
        }
        if (sz.flags.indexOf('r') < 0 && sz.base)
            uri = Util.uri.refTo(sz.base, uri);
        else if (sz.flags.indexOf('u') >= 0)
            uri = backslashUify(uri);
        else uri = hexify(uri);
        return '<'+uri+'>';
    }
    
    function prefixDirectives() {
        str = '';
	if (sz.defaultNamespace)
	  str += '@prefix : <'+sz.defaultNamespace+'>.\n';
        for (var ns in namespaceCounts) {
            str += '@prefix ' + sz.prefixes[ns] + ': <'+ns+'>.\n';
        }
        return str + '\n';
    }
    
    //  stringToN3:  String escaping for N3
    //
    var forbidden1 = new RegExp(/[\\"\b\f\r\v\t\n\u0080-\uffff]/gm);
    var forbidden3 = new RegExp(/[\\"\b\f\r\v\u0080-\uffff]/gm);
    function stringToN3(str, flags) {
        if (!flags) flags = "e";
        var res = '', i=0, j=0;
        var delim;
        var forbidden;
        if (str.length > 20 // Long enough to make sense
                && str.slice(-1) != '"'  // corner case'
                && flags.indexOf('n') <0  // Force single line
                && (str.indexOf('\n') >0 || str.indexOf('"') > 0)) {
            delim = '"""';
            forbidden =  forbidden3;
        } else {
            delim = '"';
            forbidden = forbidden1;
        }
        for(i=0; i<str.length;) {
            forbidden.lastIndex = 0;
            var m = forbidden.exec(str.slice(i));
            if (m == null) break;
            j = i + forbidden.lastIndex -1;
            res += str.slice(i,j);
            var ch = str[j];
            if (ch=='"' && delim == '"""' &&  str.slice(j,j+3) != '"""') {
                res += ch;
            } else {
                var k = '\b\f\r\t\v\n\\"'.indexOf(ch); // No escaping of bell (7)?
                if (k >= 0) {
                    res += "\\" + 'bfrtvn\\"'[k];
                } else  {
                    if (flags.indexOf('e')>=0) {
                        res += '\\u' + ('000'+
                         ch.charCodeAt(0).toString(16).toLowerCase()).slice(-4)
                    } else { // no 'e' flag
                        res += ch;
                    }
                }
            }
            i = j+1;
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
    var res = '';
    for (var i=0; i<str.length; i++) {
        k = str.charCodeAt(i);
        if (k>65535)
            res += '\U' + ('00000000'+n.toString(16)).slice(-8); // convert to upper?
        else if (k>126) 
            res += '\u' + ('0000'+n.toString(16)).slice(-4);
        else
            res += str[i];
    }
    return res;
}






//////////////////////////////////////////////// XML serialization

__Serializer.prototype.statementsToXML = function(sts) {
    var indent = 4;
    var width = 80;
    // var subjects = null; // set later
    var sz = this;

    var namespaceCounts = []; // which have been used
    namespaceCounts['http://www.w3.org/1999/02/22-rdf-syntax-ns#'] = true;

    ////////////////////////// Arrange the bits of XML text 

    var spaces=function(n) {
        var s='';
        for(var i=0; i<n; i++) s+=' ';
        return s
    }

    XMLtreeToLine = function(tree) {
        var str = '';
        for (var i=0; i<tree.length; i++) {
            var branch = tree[i];
            var s2 = (typeof branch == 'string') ? branch : XMLtreeToLine(branch);
            str += s2;
        }
        return str;
    }
    
    // Convert a nested tree of lists and strings to a string
    XMLtreeToString = function(tree, level) {
        var str = '';
        var lastLength = 100000;
        if (!level) level = 0;
        for (var i=0; i<tree.length; i++) {
            var branch = tree[i];
            if (typeof branch != 'string') {
                var substr = XMLtreeToString(branch, level +1);
                if (
                    substr.length < 10*(width-indent*level)
                    && substr.indexOf('"""') < 0) {// Don't mess up multiline strings
                    var line = XMLtreeToLine(branch);
                    if (line.length < (width-indent*level)) {
                        branch = '   '+line; //   @@ Hack: treat as string below
                        substr = ''
                    }
                }
                if (substr) lastLength = 10000;
                str += substr;
            }
            if (typeof branch == 'string') {
                if (lastLength < (indent*level+4)) { // continue
                    str = str.slice(0,-1) + ' ' + branch + '\n';
                    lastLength += branch.length + 1;
                } else {
                    var line = spaces(indent*level) +branch;
                    str += line +'\n'; 
                    lastLength = line.length;
                }
 
            } else { // not string
            }
        }
        return str;
    };

    function statementListToXMLTree(statements) {
        sz.suggestPrefix('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
        var res = [];
        var pair = sz.rootSubjects(statements);
        var roots = pair[0];
        var subjects = pair[1];
        results = []
        for (var i=0; i<roots.length; i++) {
            root = roots[i];
            results.push(subjectXMLTree(root, subjects))
        }
        return results;
    }
    
    function escapeForXML(str) {
        if (typeof str == 'undefined') return '@@@undefined@@@@';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    }

    function relURI(term) {
        return escapeForXML((sz.base) ? Util.uri.refTo(this.base, term.uri) : term.uri);
    }

    // The tree for a subject
    function subjectXMLTree(subject, subjects, referenced) {
		const liPrefix = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_';
		
    	var type = null;
    	
        var results = []
        Zotero.debug(sz.toStr(subject));
        var sts = subjects[sz.toStr(subject)]; // relevant statements
        sts.sort();
        for (var i=0; i<sts.length; i++) {
            var st = sts[i];
            
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
						st.predicate = RDFSymbol('http://www.w3.org/1999/02/22-rdf-syntax-ns#li');
					}
            	}
            	
				switch (st.object.termType) {
					case 'bnode':
						if(sz.incoming[st.object].length == 1) {
							results = results.concat(['<'+qname(st.predicate)+'>', 
								subjectXMLTree(st.object, subjects, true),
								'</'+qname(st.predicate)+'>']);
						} else {
							results = results.concat(['<'+qname(st.predicate)+' rdf:nodeID="'
								+st.object.toNT().slice(2)+'"/>']);
						}
						break;
					case 'symbol':
						results = results.concat(['<'+qname(st.predicate)+' rdf:resource="'
								+ relURI(st.object)+'"/>']); 
						break;
					case 'literal':
						results = results.concat(['<'+qname(st.predicate)
							+ (st.object.dt ? ' rdf:datatype="'+escapeForXML(st.object.dt.uri)+'"' : '') 
							+ (st.object.lang ? ' xml:lang="'+st.object.lang+'"' : '') 
							+ '>' + escapeForXML(st.object.value)
							+ '</'+qname(st.predicate)+'>']);
						break;
					case 'collection':
						results = results.concat(['<'+qname(st.predicate)+' rdf:parseType="Collection">', 
							collectionXMLTree(st.object, subjects),
							'</'+qname(st.predicate)+'>']);
						break;
					default:
						throw "Can't serialize object of type "+st.object.termType +" into XML";
					
				} // switch
			}
        }
        
        var tag = type ? qname(type) : 'rdf:Description';
        
        attrs = '';
        if (subject.termType == 'bnode') {
            if(!referenced || sz.incoming[subject].length != 1) { // not an anonymous bnode
                attrs = ' rdf:nodeID="'+subject.toNT().slice(2)+'"';
            }
        } else {
            attrs = ' rdf:about="'+ relURI(subject)+'"';
        }

        return [ '<' + tag + attrs + '>' ].concat([results]).concat(["</"+ tag +">"]);
    }
    
    function collectionXMLTree(subject, subjects) {
        res = []
        for (var i=0; i< subject.elements.length; i++) {
            res.push(subjectXMLTree(subject.elements[i], subjects));
         }
         return res;
    }

    function qname(term) {
        var uri = term.uri;

        var j = uri.indexOf('#');
        if (j<0 && sz.flags.indexOf('/') < 0) {
            j = uri.lastIndexOf('/');
        }
        if (j < 0) throw ("Cannot make qname out of <"+uri+">")

        var canSplit = true;
        for (var k=j+1; k<uri.length; k++) {
            if (__Serializer.prototype._notNameChars.indexOf(uri[k]) >=0) {
                throw ('Invalid character "'+uri[k] +'" cannot be in XML qname for URI: '+uri); 
            }
        }
        var localid = uri.slice(j+1);
        var namesp = uri.slice(0,j+1);
        if (sz.defaultNamespace && sz.defaultNamespace == namesp
            && sz.flags.indexOf('d') < 0) {// d -> suppress default
            return localid;
        }
        var prefix = sz.prefixes[namesp];
        if (!prefix) prefix = sz.makeUpPrefix(namesp);
        namespaceCounts[namesp] = true;
        return prefix + ':' + localid;
//        throw ('No prefix for namespace "'+namesp +'" for XML qname for '+uri+', namespaces: '+sz.prefixes+' sz='+sz); 
    }

    // Body of toXML:
    
    var tree = statementListToXMLTree(sts);
    var str = '<rdf:RDF';
    if (sz.defaultNamespace)
      str += ' xmlns="'+escapeForXML(sz.defaultNamespace)+'"';
    for (var ns in namespaceCounts) {
        str += '\n xmlns:' + sz.prefixes[ns] + '="'+escapeForXML(ns)+'"';
    }
    str += '>';

    var tree2 = [str, tree, '</rdf:RDF>'];  //@@ namespace declrations
    return XMLtreeToString(tree2, -1);


} // End @@ body

