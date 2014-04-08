/**
 * @fileoverview
 * TABULATOR RDF PARSER
 *
 * Version 0.1
 *  Parser believed to be in full positive RDF/XML parsing compliance
 *  with the possible exception of handling deprecated RDF attributes
 *  appropriately. Parser is believed to comply fully with other W3C
 *  and industry standards where appropriate (DOM, ECMAScript, &c.)
 *
 *  Author: David Sheets <dsheets@mit.edu>
 *  SVN ID: $Id$
 *
 * W3C® SOFTWARE NOTICE AND LICENSE
 * http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231
 * This work (and included software, documentation such as READMEs, or
 * other related items) is being provided by the copyright holders under
 * the following license. By obtaining, using and/or copying this work,
 * you (the licensee) agree that you have read, understood, and will
 * comply with the following terms and conditions.
 * 
 * Permission to copy, modify, and distribute this software and its
 * documentation, with or without modification, for any purpose and
 * without fee or royalty is hereby granted, provided that you include
 * the following on ALL copies of the software and documentation or
 * portions thereof, including modifications:
 * 
 * 1. The full text of this NOTICE in a location viewable to users of
 * the redistributed or derivative work.
 * 2. Any pre-existing intellectual property disclaimers, notices, or terms and
 * conditions. If none exist, the W3C Software Short Notice should be
 * included (hypertext is preferred, text is permitted) within the body
 * of any redistributed or derivative code.
 * 3. Notice of any changes or modifications to the files, including the
 * date changes were made. (We recommend you provide URIs to the location
 * from which the code is derived.)
 * 
 * THIS SOFTWARE AND DOCUMENTATION IS PROVIDED "AS IS," AND COPYRIGHT
 * HOLDERS MAKE NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO, WARRANTIES OF MERCHANTABILITY OR FITNESS
 * FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE SOFTWARE OR
 * DOCUMENTATION WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS,
 * TRADEMARKS OR OTHER RIGHTS.
 * 
 * COPYRIGHT HOLDERS WILL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, SPECIAL
 * OR CONSEQUENTIAL DAMAGES ARISING OUT OF ANY USE OF THE SOFTWARE OR
 * DOCUMENTATION.
 * 
 * The name and trademarks of copyright holders may NOT be used in
 * advertising or publicity pertaining to the software without specific,
 * written prior permission. Title to copyright in this software and any
 * associated documentation will at all times remain with copyright
 * holders.
 */
/**
 * @class Class defining an RDFParser resource object tied to an RDFStore
 *  
 * @author David Sheets <dsheets@mit.edu>
 * @version 0.1
 * 
 * @constructor
 * @param {RDFStore} store An RDFStore object
 */
$rdf.RDFParser = function (store) {
  var RDFParser = {};

  /** Standard namespaces that we know how to handle @final
   *  @member RDFParser
   */
  RDFParser['ns'] = {
    'RDF': "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    'RDFS': "http://www.w3.org/2000/01/rdf-schema#"
  }
  /** DOM Level 2 node type magic numbers @final
   *  @member RDFParser
   */
  RDFParser['nodeType'] = {
    'ELEMENT': 1,
    'ATTRIBUTE': 2,
    'TEXT': 3,
    'CDATA_SECTION': 4,
    'ENTITY_REFERENCE': 5,
    'ENTITY': 6,
    'PROCESSING_INSTRUCTION': 7,
    'COMMENT': 8,
    'DOCUMENT': 9,
    'DOCUMENT_TYPE': 10,
    'DOCUMENT_FRAGMENT': 11,
    'NOTATION': 12
  }

  /**
   * Frame class for namespace and base URI lookups
   * Base lookups will always resolve because the parser knows
   * the default base.
   *
   * @private
   */
  this['frameFactory'] = function (parser, parent, element) {
    return {
      'NODE': 1,
      'ARC': 2,
      'parent': parent,
      'parser': parser,
      'store': parser['store'],
      'element': element,
      'lastChild': 0,
      'base': null,
      'lang': null,
      'node': null,
      'nodeType': null,
      'listIndex': 1,
      'rdfid': null,
      'datatype': null,
      'collection': false,

      /** Terminate the frame and notify the store that we're done */
      'terminateFrame': function () {
        if(this['collection']) {
          this['node']['close']()
        }
      },

      /** Add a symbol of a certain type to the this frame */
      'addSymbol': function (type, uri) {
        uri = $rdf.Util.uri.join(uri, this['base'])
        this['node'] = this['store']['sym'](uri)
        this['nodeType'] = type
      },

      /** Load any constructed triples into the store */
      'loadTriple': function () {
        if(this['parent']['parent']['collection']) {
          this['parent']['parent']['node']['append'](this['node'])
        } else {
          this['store']['add'](this['parent']['parent']['node'],
            this['parent']['node'],
            this['node'],
            this['parser']['why'])
        }
        if(this['parent']['rdfid'] != null) { // reify
          var triple = this['store']['sym'](
          $rdf.Util.uri.join("#" + this['parent']['rdfid'], this['base']))
          this['store']['add'](triple,
            this['store']['sym'](RDFParser['ns']['RDF'] + "type"),
            this['store']['sym'](RDFParser['ns']['RDF'] + "Statement"),
            this['parser']['why'])
          this['store']['add'](triple,
            this['store']['sym'](RDFParser['ns']['RDF'] + "subject"),
            this['parent']['parent']['node'],
            this['parser']['why'])
          this['store']['add'](triple,
            this['store']['sym'](RDFParser['ns']['RDF'] + "predicate"),
            this['parent']['node'],
            this['parser']['why'])
          this['store']['add'](triple,
            this['store']['sym'](RDFParser['ns']['RDF'] + "object"),
            this['node'],
            this['parser']['why'])
        }
      },

      /** Check if it's OK to load a triple */
      'isTripleToLoad': function () {
        return (this['parent'] != null
          && this['parent']['parent'] != null
          && this['nodeType'] == this['NODE']
          && this['parent']['nodeType'] == this['ARC']
          && this['parent']['parent']['nodeType'] == this['NODE'])
      },

      /** Add a symbolic node to this frame */
      'addNode': function (uri) {
        this['addSymbol'](this['NODE'], uri)
        if(this['isTripleToLoad']()) {
          this['loadTriple']()
        }
      },

      /** Add a collection node to this frame */
      'addCollection': function () {
        this['nodeType'] = this['NODE']
        this['node'] = this['store']['collection']()
        this['collection'] = true
        if(this['isTripleToLoad']()) {
          this['loadTriple']()
        }
      },

      /** Add a collection arc to this frame */
      'addCollectionArc': function () {
        this['nodeType'] = this['ARC']
      },

      /** Add a bnode to this frame */
      'addBNode': function (id) {
        if(id != null) {
          if(this['parser']['bnodes'][id] != null) {
            this['node'] = this['parser']['bnodes'][id]
          } else {
            this['node'] = this['parser']['bnodes'][id] = this['store']['bnode']()
          }
        } else {
          this['node'] = this['store']['bnode']()
        }

        this['nodeType'] = this['NODE']
        if(this['isTripleToLoad']()) {
          this['loadTriple']()
        }
      },

      /** Add an arc or property to this frame */
      'addArc': function (uri) {
        if(uri == RDFParser['ns']['RDF'] + "li") {
          uri = RDFParser['ns']['RDF'] + "_" + this['parent']['listIndex']++
        }
        this['addSymbol'](this['ARC'], uri)
      },

      /** Add a literal to this frame */
      'addLiteral': function (value) {
        if(this['parent']['datatype']) {
          this['node'] = this['store']['literal'](
          value, "", this['store']['sym'](
          this['parent']['datatype']))
        } else {
          this['node'] = this['store']['literal'](
          value, this['lang'])
        }
        this['nodeType'] = this['NODE']
        if(this['isTripleToLoad']()) {
          this['loadTriple']()
        }
      }
    }
  }

  //from the OpenLayers source .. needed to get around IE problems.
  this['getAttributeNodeNS'] = function (node, uri, name) {
    var attributeNode = null;
    if(node.getAttributeNodeNS) {
      attributeNode = node.getAttributeNodeNS(uri, name);
    } else {
      var attributes = node.attributes;
      var potentialNode, fullName;
      for(var i = 0; i < attributes.length; ++i) {
        potentialNode = attributes[i];
        if(potentialNode.namespaceURI == uri) {
          fullName = (potentialNode.prefix) ? (potentialNode.prefix + ":" + name) : name;
          if(fullName == potentialNode.nodeName) {
            attributeNode = potentialNode;
            break;
          }
        }
      }
    }
    return attributeNode;
  }

  /** Our triple store reference @private */
  this['store'] = store
  /** Our identified blank nodes @private */
  this['bnodes'] = {}
  /** A context for context-aware stores @private */
  this['why'] = null
  /** Reification flag */
  this['reify'] = false

  /**
   * Build our initial scope frame and parse the DOM into triples
   * @param {DOMTree} document The DOM to parse
   * @param {String} base The base URL to use 
   * @param {Object} why The context to which this resource belongs
   */
  this['parse'] = function (document, base, why) {
    // alert('parse base:'+base);
    var children = document['childNodes']

    // clean up for the next run
    this['cleanParser']()

    // figure out the root element
    //var root = document.documentElement; //this is faster, I think, cross-browser issue? well, DOM 2
    if(document['nodeType'] == RDFParser['nodeType']['DOCUMENT']) {
      for(var c = 0; c < children['length']; c++) {
        if(children[c]['nodeType'] == RDFParser['nodeType']['ELEMENT']) {
          var root = children[c]
          break
        }
      }
    } else if(document['nodeType'] == RDFParser['nodeType']['ELEMENT']) {
      var root = document
    } else {
      throw new Error("RDFParser: can't find root in " + base + ". Halting. ")
      return false
    }

    this['why'] = why


    // our topmost frame
    var f = this['frameFactory'](this)
    this['base'] = base
    f['base'] = base
    f['lang'] = ''

    this['parseDOM'](this['buildFrame'](f, root))
    return true
  }
  this['parseDOM'] = function (frame) {
    // a DOM utility function used in parsing
    var elementURI = function (el) {
        var result = "";
        if(el['namespaceURI'] == null) {
          throw new Error("RDF/XML syntax error: No namespace for "
            + el['localName'] + " in " + this.base)
        }
        if(el['namespaceURI']) {
          result = result + el['namespaceURI'];
        }
        if(el['localName']) {
          result = result + el['localName'];
        } else if(el['nodeName']) {
          if(el['nodeName'].indexOf(":") >= 0)
            result = result + el['nodeName'].split(":")[1];
          else
            result = result + el['nodeName'];
        }
        return result;
      }
    var dig = true // if we'll dig down in the tree on the next iter
    while(frame['parent']) {
      var dom = frame['element']
      var attrs = dom['attributes']

      if(dom['nodeType'] == RDFParser['nodeType']['TEXT']
        || dom['nodeType'] == RDFParser['nodeType']['CDATA_SECTION']) {
        //we have a literal
        if(frame['parent']['nodeType'] == frame['NODE']) {
          //must have had attributes, store as rdf:value
          frame['addArc'](RDFParser['ns']['RDF'] + 'value');
          frame = this['buildFrame'](frame);
        }
        frame['addLiteral'](dom['nodeValue'])
      } else if(elementURI(dom) != RDFParser['ns']['RDF'] + "RDF") {
        // not root
        if(frame['parent'] && frame['parent']['collection']) {
          // we're a collection element
          frame['addCollectionArc']()
          frame = this['buildFrame'](frame, frame['element'])
          frame['parent']['element'] = null
        }
        if(!frame['parent'] || !frame['parent']['nodeType']
          || frame['parent']['nodeType'] == frame['ARC']) {
          // we need a node
          var about = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "about")
          var rdfid = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "ID")
          if(about && rdfid) {
            throw new Error("RDFParser: " + dom['nodeName']
              + " has both rdf:id and rdf:about." + " Halting. Only one of these"
              + " properties may be specified on a" + " node.");
          }
          if(about == null && rdfid) {
            frame['addNode']("#" + rdfid['nodeValue'])
            dom['removeAttributeNode'](rdfid)
          } else if(about == null && rdfid == null) {
            var bnid = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "nodeID")
            if(bnid) {
              frame['addBNode'](bnid['nodeValue'])
              dom['removeAttributeNode'](bnid)
            } else {
              frame['addBNode']()
            }
          } else {
            frame['addNode'](about['nodeValue'])
            dom['removeAttributeNode'](about)
          }

          // Typed nodes
          var rdftype = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "type")
          if(RDFParser['ns']['RDF'] + "Description" != elementURI(dom)) {
            rdftype = {
              'nodeValue': elementURI(dom)
            }
          }
          if(rdftype != null) {
            this['store']['add'](frame['node'],
              this['store']['sym'](RDFParser['ns']['RDF'] + "type"),
              this['store']['sym'](
                $rdf.Util.uri.join(
                  rdftype['nodeValue'],
                  frame['base'])),
              this['why'])
            if(rdftype['nodeName']) {
              dom['removeAttributeNode'](rdftype)
            }
          }

          // Property Attributes
          for(var x = attrs['length'] - 1; x >= 0; x--) {
            this['store']['add'](frame['node'],
              this['store']['sym'](elementURI(attrs[x])),
              this['store']['literal'](
                attrs[x]['nodeValue'],
                frame['lang']),
              this['why'])
          }
        } else {
          // we should add an arc (or implicit bnode+arc)
          frame['addArc'](elementURI(dom))

          // save the arc's rdf:ID if it has one
          if(this['reify']) {
            var rdfid = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "ID")
            if(rdfid) {
              frame['rdfid'] = rdfid['nodeValue']
              dom['removeAttributeNode'](rdfid)
            }
          }

          var parsetype = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "parseType")
          var datatype = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "datatype")
          if(datatype) {
            frame['datatype'] = datatype['nodeValue']
            dom['removeAttributeNode'](datatype)
          }

          if(parsetype) {
            var nv = parsetype['nodeValue']
            if(nv == "Literal") {
              frame['datatype'] = RDFParser['ns']['RDF'] + "XMLLiteral"
              // (this.buildFrame(frame)).addLiteral(dom)
              // should work but doesn't
              frame = this['buildFrame'](frame)
              frame['addLiteral'](dom)
              dig = false
            } else if(nv == "Resource") {
              frame = this['buildFrame'](frame, frame['element'])
              frame['parent']['element'] = null
              frame['addBNode']()
            } else if(nv == "Collection") {
              frame = this['buildFrame'](frame, frame['element'])
              frame['parent']['element'] = null
              frame['addCollection']()
            }
            dom['removeAttributeNode'](parsetype)
          }

          if(attrs['length'] != 0) {
            var resource = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "resource")
            var bnid = this['getAttributeNodeNS'](dom, RDFParser['ns']['RDF'], "nodeID")

            frame = this['buildFrame'](frame)
            if(resource) {
              frame['addNode'](resource['nodeValue'])
              dom['removeAttributeNode'](resource)
            } else {
              if(bnid) {
                frame['addBNode'](bnid['nodeValue'])
                dom['removeAttributeNode'](bnid)
              } else {
                frame['addBNode']()
              }
            }

            for(var x = attrs['length'] - 1; x >= 0; x--) {
              var f = this['buildFrame'](frame)
              f['addArc'](elementURI(attrs[x]))
              if(elementURI(attrs[x]) == RDFParser['ns']['RDF'] + "type") {
                (this['buildFrame'](f))['addNode'](
                attrs[x]['nodeValue'])
              } else {
                (this['buildFrame'](f))['addLiteral'](
                attrs[x]['nodeValue'])
              }
            }
          } else if(dom['childNodes']['length'] == 0) {
            (this['buildFrame'](frame))['addLiteral']("")
          }
        }
      } // rdf:RDF
      // dig dug
      dom = frame['element']
      while(frame['parent']) {
        var pframe = frame
        while(dom == null) {
          frame = frame['parent']
          dom = frame['element']
        }
        var candidate = dom['childNodes'][frame['lastChild']]
        if(candidate == null || !dig) {
          frame['terminateFrame']()
          if(!(frame = frame['parent'])) {
            break
          } // done
          dom = frame['element']
          dig = true
        } else if((candidate['nodeType'] != RDFParser['nodeType']['ELEMENT']
            && candidate['nodeType'] != RDFParser['nodeType']['TEXT']
            && candidate['nodeType'] != RDFParser['nodeType']['CDATA_SECTION'])
          || ((candidate['nodeType'] == RDFParser['nodeType']['TEXT']
              || candidate['nodeType'] == RDFParser['nodeType']['CDATA_SECTION'])
            && dom['childNodes']['length'] != 1)) {
          frame['lastChild']++
        } else {
          // not a leaf
          frame['lastChild']++;
          frame = this['buildFrame'](pframe, dom['childNodes'][frame['lastChild'] - 1])
          break
        }
      }
    } // while
  }

  /**
   * Cleans out state from a previous parse run
   * @private
   */
  this['cleanParser'] = function () {
    this['bnodes'] = {}
    this['why'] = null
  }

  /**
   * Builds scope frame 
   * @private
   */
  this['buildFrame'] = function (parent, element) {
    var frame = this['frameFactory'](this, parent, element)
    if(parent) {
      frame['base'] = parent['base']
      frame['lang'] = parent['lang']
    }
    if(element == null
      || element['nodeType'] == RDFParser['nodeType']['TEXT']
      || element['nodeType'] == RDFParser['nodeType']['CDATA_SECTION']) {
      return frame
    }

    var attrs = element['attributes']

    var base = element['getAttributeNode']("xml:base")
    if(base != null) {
      frame['base'] = base['nodeValue']
      element['removeAttribute']("xml:base")
    }
    var lang = element['getAttributeNode']("xml:lang")
    if(lang != null) {
      frame['lang'] = lang['nodeValue']
      element['removeAttribute']("xml:lang")
    }

    // remove all extraneous xml and xmlns attributes
    for(var x = attrs['length'] - 1; x >= 0; x--) {
      if(attrs[x]['nodeName']['substr'](0, 3) == "xml") {
        if(attrs[x].name.slice(0, 6) == 'xmlns:') {
          var uri = attrs[x].nodeValue;
          // alert('base for namespac attr:'+this.base);
          if(this.base) uri = $rdf.Util.uri.join(uri, this.base);
          this.store.setPrefixForURI(attrs[x].name.slice(6), uri);
        }
        //		alert('rdfparser: xml atribute: '+attrs[x].name) //@@
        element['removeAttributeNode'](attrs[x])
      }
    }
    return frame
  }
}