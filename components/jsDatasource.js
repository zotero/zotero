/* ***** BEGIN LICENSE BLOCK *****
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is ZoomCreator, from Zoomorama.
 * 
 * The Initial Developer of the Original Code is Zoomorama.
 * Portions created by The Initial Developer are Copyright (C) 2009-2010
 * The Initial Developer. All Rights Reserved.
 * 
 * Contributor(s):
 * - Laurent Jouanneau
 * 
 * ***** END LICENSE BLOCK ***** */
 
/**
 * This components implements a query processor for xul templates.
 * This query processor use javascript data as datasources.
 * @version 2.0
 * @link https://github.com/laurentj/XulJsDatasource
 */


Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const CI = Components.interfaces;
const CC = Components.classes;


function log(msg) {
  /*CC["@mozilla.org/consoleservice;1"]
    .getService(CI.nsIConsoleService)
    .logStringMessage(msg);
    */
  dump("jsdatasource: "+msg+"\n");
}

const SORT_TYPE_STRING = 0;
const SORT_TYPE_INT = 1;
const SORT_TYPE_FLOAT = 2;


/**
 * object associated to a result in the template
 */
function jsTemplateResult(aData, aId, aQuery) {
  if (aId == '' || aId==undefined || aId == null) {
    // if an id is not given, no results are shown
    // let's generate a random id 
    let uuidGenerator = Components.classes["@mozilla.org/uuid-generator;1"]
                                  .getService(Components.interfaces.nsIUUIDGenerator);
    aId = uuidGenerator.generateUUID();
  }

  this.mQuery = aQuery;
  this.mData = aData;
  this.mId = aId;
  this.wrappedJSObject = this;
  this.mChildrenData = null;

  if (this.mQuery && this.mQuery.memberVariable)
    this.mChildrenData = this.getBindingObjectFor(this.mQuery.memberVariable);
}

jsTemplateResult.prototype = {

  QueryInterface: XPCOMUtils.generateQI([CI.nsIXULTemplateResult]),

  get isContainer ()        { return (this.mChildrenData != null); },
  get isEmpty ()            { return (this.mChildrenData == null || this.mChildrenData.isEmpty);},
  get mayProcessChildren () { return (this.mChildrenData != null);},
  get resource ()           { return null;},
  get type ()               { return "js-item";},
  get id()                  { return this.mId;},

  /**
   * return the corresponding string of the property
   * @param nsIAtom aVar the name of the property, starting with a "?"
   * @return string
   */
  getBindingFor: function(aVar) {

    var names = aVar.toString().slice(1).split(".");
    if (!(names[0] in this.mData)) {
      return "";
    }

    var data = this.mData[names[0]];
    if (names.length <2) {
      return data;
    }

    for (let i=1; i < names.length; i++) {
      if (!(names[i] in data)) {
        return "";
      }
      data = data[names[i]];
    }
    return data;
  },

  /**
   * return the corresponding object of the property
   * @param nsIAtom aVar the name of the property, starting with a "?"
   * @return nsISupports
   */
  getBindingObjectFor: function(aVar) {
    if (!this.mQuery) {
      return null;
    }

    if (aVar == this.mQuery.memberVariable
        && this.mChildrenData) {
      return this.mChildrenData;
    }

    let data = this.getBindingFor(aVar);
    if (typeof(data) == 'object' && data !== null) {
      return createResultsSet(data, this.mQuery);
    }
    return null;
  },

  /**
   * called when a rule matches this item.
   */
  ruleMatched: function(aQuery, aRuleNode) { },

  /**
   * called when the item has been removed from the template
   */
  hasBeenRemoved: function() { }
};

/**
 * a result set based on a javascript array
 *
 * Note:
 * @param Array aArrayOfData  the list of data
 * @param jsTemplateQuery aQuery
 */
function jsTemplateResultSet(aArrayOfData, aQuery) {

  // To get all items of the array we use a generator, instead of
  // a simple index incrementation, because we could have array with
  // some missing indexes
  // for example ar[1], ar[3], ar[4]. Here, no item at 0 and 2.
  this.mArray = aArrayOfData;
  this.mGenerator = this._generatorOnArray();
  this.mQuery = aQuery;

  this.mCurrent = null;
  this.mCnt = 0;
}

jsTemplateResultSet.prototype = {

  QueryInterface: XPCOMUtils.generateQI([CI.nsISimpleEnumerator]),

  hasMoreElements: function() {
    try {
      this.mCurrent = this.mGenerator.next();
      return true;
    }
    catch(e) {
    }
    return false;
  },

  getNext: function() {
    this.mCnt ++;
    let pid = "";
    let idprop = this.mQuery.idProperty;

    if (idprop != null
        && this.mCurrent[idprop] != undefined) {
      pid = this.mQuery.idPrefix + ':' + this.mCurrent[idprop];
    }
    else {
      pid = this.mQuery.idPrefix + ':'+ (this.mCnt.toString());
    }

    return new jsTemplateResult(this.mCurrent, pid, this.mQuery);
  },

  _generatorOnArray : function() {
    for each (let i in this.mArray) {
      yield i;
    }
  },

  get isEmpty() { return this.mArray.length == 0; }
};

/**
 * a result set based on an nsIEnumerator object
 */
function jsTemplateSimpleEnumeratorResultSet(aEnumerator, aQuery) {
  this.mEnumerator = aEnumerator;
  this.mQuery = aQuery;
  this.mCnt = 0;
}

jsTemplateSimpleEnumeratorResultSet.prototype = {

  QueryInterface: XPCOMUtils.generateQI([CI.nsISimpleEnumerator]),

  hasMoreElements: function() {
    return this.mEnumerator.hasMoreElements();
  },

  getNext: function() {
    this.mCnt ++;
    let pid = "";
    let current = this.mEnumerator.getNext();

    if (this.mQuery.itemIface) {
      if (this.mQuery.itemIface.toLowerCase() == 'wrappedjsobject') {
        current = current.wrappedJSObject;
      }
      else if (Components.interfaces[this.mQuery.itemIface]) {
        current = current.QueryInterface(Components.interfaces[this.mQuery.itemIface]);
      }
    }

    if (this.mQuery.idProperty != null
        && current[this.mQuery.idProperty] != undefined) {
      pid = this.mQuery.idPrefix + ':' + current[this.mQuery.idProperty];
    }
    else {
      pid = this.mQuery.idPrefix + ':'+ (this.mCnt.toString());
    }

    return new jsTemplateResult(current, pid, this.mQuery);
  },

  get isEmpty() { return !this.mEnumerator.hasMoreElements(); }
};

/**
 * object which contains datasources informations
 */
function jsTemplateDatasource(aJSName, aIdPrefix, aSortType) {
  this.jsname = aJSName;
  this.idPrefix = aIdPrefix;
  this.wrappedJSObject = this;
  this.sortType = aSortType;
}

/**
 * object which contains query informations
 */
function jsTemplateQuery (aIdProperty, aFilterName, aDocument, aItemIface, aMemberVariable) {
  this.idProperty = aIdProperty;
  this.idPrefix = ''; // filled during results generation
  this.sortType = ''; // filled during results generation
  this.filter = aFilterName;
  this.doc = aDocument;
  this.itemIface = aItemIface;
  this.wrappedJSObject = this;
  this.memberVariable = aMemberVariable;
}


/**
 * the query processor which supports javascript objects.
 * it implements the nsIXULTemplateQueryProcessor interface
 */
function jsTemplateQueryProcessor() {
}

jsTemplateQueryProcessor.prototype = {

  QueryInterface: XPCOMUtils.generateQI([CI.nsIXULTemplateQueryProcessor]),

  classDescription: "Javascript Query Processor for XUL Template",

  classID: Components.ID("{EA696B77-AF80-4063-89AD-4985B14D0EBC}"),

  contractID: "@mozilla.org/xul/xul-query-processor;1?name=javascript",

  /**
   * read information on the root element for template
   * about the datasource.
   * @return jsTemplateDatasource
   */
  getDatasource: function(aDataSources, aRootNode, aIsTrusted, aBuilder, aShouldDelayBuilding) {
    aShouldDelayBuilding.value = false;

    if (aDataSources && aDataSources.length && aIsTrusted) {
      let uri = aDataSources.queryElementAt(0, CI.nsIURI);
      if (!uri)
        return null;
      
      let found = uri.spec.match(/^(?:js:|javascript:)(.*)/);
      if (found && found.length) {
        let prefix = found[1];
        let sortType = SORT_TYPE_STRING;

        // try to get the prefix for ids of all generated elements
        if (aRootNode) {
          let node = aRootNode.QueryInterface(CI.nsIDOMElement);
          if (node && node.hasAttribute("idprefix")) {
            prefix = node.getAttribute("idprefix");
          }
          else if(node && node.hasAttribute("id")){
            prefix = node.getAttribute("id");
          }
          if(node.hasAttribute("sortType")) {
            switch(node.getAttribute("sortType")) {
              case "int":
                sortType = SORT_TYPE_INT;
                break;
              case "float":
                sortType = SORT_TYPE_FLOAT;
                break;
            }
          }
        }

        return new jsTemplateDatasource(found[1], prefix, sortType);
      }
    }
    return null;
  },

  initializeForBuilding: function(aDatasource, aBuilder, aRootNode) {
    // nothing to do at this step
  },

  done: function() {
    // nothing to do at this step
  },

  /**
   * read informations from the query element
   * @return jsTemplateQuery
   */
  compileQuery: function(aBuilder, aQuery, aRefVariable, aMemberVariable) {
    let idProperty = null;
    let filter = null;
    let itemIface = null;
    let query = aQuery.QueryInterface(CI.nsIDOMElement);
    if(query.hasAttribute("idproperty"))
      idProperty = query.getAttribute("idproperty");

    if (query.hasAttribute("filterfunc")) {
      filter =  query.getAttribute("filterfunc");
    }

    if(query.hasAttribute("iteminterface"))
      itemIface = query.getAttribute("iteminterface");
  
    if (aMemberVariable == '?')
        aMemberVariable = '';
    return new jsTemplateQuery(idProperty, filter, aQuery.ownerDocument, itemIface, aMemberVariable);
  },

  generateResults: function(aDatasource, aRef, aQuery) {
    let data;
    try {
        // we get the wrappedJSObject of the datasource and the query objects
        aDatasource = aDatasource.wrappedJSObject;
        aQuery = aQuery.wrappedJSObject;

        aQuery.idPrefix = aDatasource.idPrefix;
        aQuery.sortType = aDatasource.sortType;

        // a reference result is given. Ignore it if it is the result given by translateRef
        // (so ignore it if this is the fake result for the first level results set)
        if (aRef && aRef.id != '__root__' && aQuery.memberVariable != '') {
          return aRef.getBindingObjectFor(aQuery.memberVariable);
        }
        else {
          data = findJavascriptObject(aDatasource.jsname, aQuery.doc);
          return createResultsSet(data, aQuery);
        }
    }
    catch(e) {
      throw Components.results.NS_ERROR_INVALID_ARG;
    }
  },

  addBinding: function(aRuleNode, aVar, aRef, aExpr) {
    // no support of bindings for the moment
  },

  translateRef: function(aDatasource, aRefstring) {
    // if we return null, everything stops
    // so just return an empty result
    // we cannot return a result for the first level because we don't have
    // here the query object
    return new jsTemplateResult(null, '__root__', null);
  },

  /**
   * used for the sort
   */
  compareResults: function(aLeft, aRight, aVar) {
    let leftValue = aLeft.getBindingFor(aVar);
    let type = aLeft.wrappedJSObject.mQuery.sortType;
    let rightValue = aRight.getBindingFor(aVar);

    if (type == SORT_TYPE_INT) {
      if (leftValue === "" || rightValue === "") {
        // it seems there is a bug in XUL
        // if we return 0, the first item becomes the last (!)
        return 1;
      }
      leftValue = parseInt(leftValue);
      rightValue = parseInt(rightValue);
    }
    else if (type == SORT_TYPE_FLOAT) {
      if (leftValue === "" || rightValue === "")
        return 1;
      leftValue = parseFloat(leftValue);
      rightValue = parseFloat(rightValue);
    }

    if (leftValue < rightValue) {
      return -1;
    }
    else if (leftValue > rightValue) {
      return 1;
    }
    return 0;
  },
  

};

/**
 * find a js object in the given document.
 * @param string aJsName the name of the js variable to find
 * @param DOMDocument aDocument the document in which the js variable live
 */
function findJavascriptObject (aJsName, aDocument) {
  let data = null;
  if(aJsName.indexOf(".") == -1) {
    // the given name is a single name
    // try to retrieve the corresponding variable attached to the window
    if (aJsName !="" && aDocument.defaultView[aJsName] != undefined)
      data = aDocument.defaultView[aJsName];
    else {
      throw aJsName+" is undefined";
    }
  }
  else {
    // the given string specifies recursive property names (eg foo.bar.baz)
    var varnames = aJsName.split(".");
    data = aDocument.defaultView;
    // let's loop recursively to retrieve the corresponding value
    for(var i=0; i < varnames.length; i++) {
      if(data[varnames[i]] != undefined) {
        data = data[varnames[i]];
      }
      else {
        throw aJsName+" is undefined";
      }
    }
  }
  return data;
};

/**
 * create an object jsTemplateResultSet or jsTemplateSimpleEnumeratorResultSet
 * iterating on the given data
 */
function createResultsSet(data, aQuery) {

  let isenumerator = false;

  // check if the data is an nsISimpleEnumerator/nsIArray or a simple js array
  if (!(data instanceof CI.nsIArray) &&
      !(data instanceof CI.nsISimpleEnumerator)){
    // for javascript objects which are non pure xpcom
    // ie javascript objects declared in the context
    // of the document with a QueryInterface function
    if(data['QueryInterface'] != undefined &&
      typeof data['QueryInterface'] == "function") {

      let dataQI;
      try {
        dataQI = data.QueryInterface(CI.nsISimpleEnumerator);
        isenumerator = true;
      }
      catch(e) {
        try {
          dataQI = data.QueryInterface(CI.nsIArray);
          data = data.enumerate();
          isenumerator = true;
        }
        catch(e) {
        }
      }
    }
  }
  else if (data instanceof CI.nsIArray){
    data = data.enumerate();
    isenumerator = true;
  }
  else if (data instanceof CI.nsISimpleEnumerator) {
    isenumerator = true;
  }

  if(aQuery.filter == null || aQuery.filter == '') {
    // no filter, just return a resultset on all results
    if (isenumerator) {
      return new jsTemplateSimpleEnumeratorResultSet(data, aQuery);
    }
    else {
      return new jsTemplateResultSet(data, aQuery);
    }
  }

  // we have a filter function. Try to retrieve it. 
  let func = null;
  try {
    func = findJavascriptObject(aQuery.filter, aQuery.doc);
  }
  catch(e) {
    throw Components.results.NS_ERROR_INVALID_ARG;
  }

  if (typeof func != "function") {
    throw Components.results.NS_ERROR_INVALID_ARG;
  }

  if (isenumerator) {
    // if we have en enumerator, let's retrieve all result
    // and apply the filter on them.
    let list = [];
    let idx = 0;
    while(data.hasMoreElements()) {
      let val = data.getNext();

      if (aQuery.itemIface) {
        if (aQuery.itemIface.toLowerCase() == 'wrappedjsobject')
          val = val.wrappedJSObject;
        else if (Components.interfaces[aQuery.itemIface])
          val = val.QueryInterface(Components.interfaces[aQuery.itemIface]);
      }

      //we cannot pass an array as an argument
      //since we loop over an enumerator and not over a javascript array
      if (func.call(null, val, idx, null)) 
        list.push(val);
      idx++;
    }
    return new jsTemplateResultSet(list, aQuery);
  }
  else {
    return new jsTemplateResultSet(data.filter(func), aQuery);
  }
};


// XPCOM registration

var components = [jsTemplateQueryProcessor];

if (XPCOMUtils.generateNSGetFactory)  
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components); 
else 
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);  
