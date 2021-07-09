(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["JSONLD"] = factory();
	else
		root["JSONLD"] = factory();
})(typeof zContext === 'object' ? zContext.Zotero : {}, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 6);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const graphTypes = __webpack_require__(5);
const types = __webpack_require__(1);
// TODO: move `IdentifierIssuer` to its own package
const IdentifierIssuer = __webpack_require__(8);
const JsonLdError = __webpack_require__(2);

// constants
const REGEX_LINK_HEADERS = /(?:<[^>]*?>|"[^"]*?"|[^,])+/g;
const REGEX_LINK_HEADER = /\s*<([^>]*?)>\s*(?:;\s*(.*))?/;
const REGEX_LINK_HEADER_PARAMS =
  /(.*?)=(?:(?:"([^"]*?)")|([^"]*?))\s*(?:(?:;\s*)|$)/g;

const DEFAULTS = {
  headers: {
    accept: 'application/ld+json, application/json'
  }
};

const api = {};
module.exports = api;
api.IdentifierIssuer = IdentifierIssuer;

// define setImmediate and nextTick
// // nextTick implementation with browser-compatible fallback // //
// from https://github.com/caolan/async/blob/master/lib/async.js

// capture the global reference to guard against fakeTimer mocks
const _setImmediate = typeof setImmediate === 'function' && setImmediate;

const _delay = _setImmediate ?
  // not a direct alias (for IE10 compatibility)
  fn => _setImmediate(fn) :
  fn => setTimeout(fn, 0);

if(typeof process === 'object' && typeof process.nextTick === 'function') {
  api.nextTick = process.nextTick;
} else {
  api.nextTick = _delay;
}
api.setImmediate = _setImmediate ? _delay : api.nextTick;

/**
 * Clones an object, array, or string/number. If a typed JavaScript object
 * is given, such as a Date, it will be converted to a string.
 *
 * @param value the value to clone.
 *
 * @return the cloned value.
 */
api.clone = function(value) {
  if(value && typeof value === 'object') {
    let rval;
    if(types.isArray(value)) {
      rval = [];
      for(let i = 0; i < value.length; ++i) {
        rval[i] = api.clone(value[i]);
      }
    } else if(types.isObject(value)) {
      rval = {};
      for(const key in value) {
        rval[key] = api.clone(value[key]);
      }
    } else {
      rval = value.toString();
    }
    return rval;
  }
  return value;
};

/**
 * Ensure a value is an array. If the value is an array, it is returned.
 * Otherwise, it is wrapped in an array.
 *
 * @param value the value to return as an array.
 *
 * @return the value as an array.
 */
api.asArray = function(value) {
  return Array.isArray(value) ? value : [value];
};

/**
 * Builds an HTTP headers object for making a JSON-LD request from custom
 * headers and asserts the `accept` header isn't overridden.
 *
 * @param headers an object of headers with keys as header names and values
 *          as header values.
 *
 * @return an object of headers with a valid `accept` header.
 */
api.buildHeaders = (headers = {}) => {
  const hasAccept = Object.keys(headers).some(
    h => h.toLowerCase() === 'accept');

  if(hasAccept) {
    throw new RangeError(
      'Accept header may not be specified; only "' +
      DEFAULTS.headers.accept + '" is supported.');
  }

  return Object.assign({Accept: DEFAULTS.headers.accept}, headers);
};

/**
 * Parses a link header. The results will be key'd by the value of "rel".
 *
 * Link: <http://json-ld.org/contexts/person.jsonld>;
 * rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"
 *
 * Parses as: {
 *   'http://www.w3.org/ns/json-ld#context': {
 *     target: http://json-ld.org/contexts/person.jsonld,
 *     type: 'application/ld+json'
 *   }
 * }
 *
 * If there is more than one "rel" with the same IRI, then entries in the
 * resulting map for that "rel" will be arrays.
 *
 * @param header the link header to parse.
 */
api.parseLinkHeader = header => {
  const rval = {};
  // split on unbracketed/unquoted commas
  const entries = header.match(REGEX_LINK_HEADERS);
  for(let i = 0; i < entries.length; ++i) {
    let match = entries[i].match(REGEX_LINK_HEADER);
    if(!match) {
      continue;
    }
    const result = {target: match[1]};
    const params = match[2];
    while((match = REGEX_LINK_HEADER_PARAMS.exec(params))) {
      result[match[1]] = (match[2] === undefined) ? match[3] : match[2];
    }
    const rel = result['rel'] || '';
    if(Array.isArray(rval[rel])) {
      rval[rel].push(result);
    } else if(rel in rval) {
      rval[rel] = [rval[rel], result];
    } else {
      rval[rel] = result;
    }
  }
  return rval;
};

/**
 * Throws an exception if the given value is not a valid @type value.
 *
 * @param v the value to check.
 */
api.validateTypeValue = v => {
  // can be a string or an empty object
  if(types.isString(v) || types.isEmptyObject(v)) {
    return;
  }

  // must be an array
  let isValid = false;
  if(types.isArray(v)) {
    // must contain only strings
    isValid = true;
    for(let i = 0; i < v.length; ++i) {
      if(!(types.isString(v[i]))) {
        isValid = false;
        break;
      }
    }
  }

  if(!isValid) {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; "@type" value must a string, an array of ' +
      'strings, or an empty object.', 'jsonld.SyntaxError',
      {code: 'invalid type value', value: v});
  }
};

/**
 * Returns true if the given subject has the given property.
 *
 * @param subject the subject to check.
 * @param property the property to look for.
 *
 * @return true if the subject has the given property, false if not.
 */
api.hasProperty = (subject, property) => {
  if(property in subject) {
    const value = subject[property];
    return (!types.isArray(value) || value.length > 0);
  }
  return false;
};

/**
 * Determines if the given value is a property of the given subject.
 *
 * @param subject the subject to check.
 * @param property the property to check.
 * @param value the value to check.
 *
 * @return true if the value exists, false if not.
 */
api.hasValue = (subject, property, value) => {
  if(api.hasProperty(subject, property)) {
    let val = subject[property];
    const isList = graphTypes.isList(val);
    if(types.isArray(val) || isList) {
      if(isList) {
        val = val['@list'];
      }
      for(let i = 0; i < val.length; ++i) {
        if(api.compareValues(value, val[i])) {
          return true;
        }
      }
    } else if(!types.isArray(value)) {
      // avoid matching the set of values with an array value parameter
      return api.compareValues(value, val);
    }
  }
  return false;
};

/**
 * Adds a value to a subject. If the value is an array, all values in the
 * array will be added.
 *
 * @param subject the subject to add the value to.
 * @param property the property that relates the value to the subject.
 * @param value the value to add.
 * @param [options] the options to use:
 *        [propertyIsArray] true if the property is always an array, false
 *          if not (default: false).
 *        [allowDuplicate] true to allow duplicates, false not to (uses a
 *          simple shallow comparison of subject ID or value) (default: true).
 */
api.addValue = (subject, property, value, options) => {
  options = options || {};
  if(!('propertyIsArray' in options)) {
    options.propertyIsArray = false;
  }
  if(!('allowDuplicate' in options)) {
    options.allowDuplicate = true;
  }

  if(types.isArray(value)) {
    if(value.length === 0 && options.propertyIsArray &&
      !(property in subject)) {
      subject[property] = [];
    }
    for(let i = 0; i < value.length; ++i) {
      api.addValue(subject, property, value[i], options);
    }
  } else if(property in subject) {
    // check if subject already has value if duplicates not allowed
    const hasValue = (!options.allowDuplicate &&
      api.hasValue(subject, property, value));

    // make property an array if value not present or always an array
    if(!types.isArray(subject[property]) &&
      (!hasValue || options.propertyIsArray)) {
      subject[property] = [subject[property]];
    }

    // add new value
    if(!hasValue) {
      subject[property].push(value);
    }
  } else {
    // add new value as set or single value
    subject[property] = options.propertyIsArray ? [value] : value;
  }
};

/**
 * Gets all of the values for a subject's property as an array.
 *
 * @param subject the subject.
 * @param property the property.
 *
 * @return all of the values for a subject's property as an array.
 */
api.getValues = (subject, property) => [].concat(subject[property] || []);

/**
 * Removes a property from a subject.
 *
 * @param subject the subject.
 * @param property the property.
 */
api.removeProperty = (subject, property) => {
  delete subject[property];
};

/**
 * Removes a value from a subject.
 *
 * @param subject the subject.
 * @param property the property that relates the value to the subject.
 * @param value the value to remove.
 * @param [options] the options to use:
 *          [propertyIsArray] true if the property is always an array, false
 *            if not (default: false).
 */
api.removeValue = (subject, property, value, options) => {
  options = options || {};
  if(!('propertyIsArray' in options)) {
    options.propertyIsArray = false;
  }

  // filter out value
  const values = api.getValues(subject, property).filter(
    e => !api.compareValues(e, value));

  if(values.length === 0) {
    api.removeProperty(subject, property);
  } else if(values.length === 1 && !options.propertyIsArray) {
    subject[property] = values[0];
  } else {
    subject[property] = values;
  }
};

/**
 * Relabels all blank nodes in the given JSON-LD input.
 *
 * @param input the JSON-LD input.
 * @param [options] the options to use:
 *          [issuer] an IdentifierIssuer to use to label blank nodes.
 */
api.relabelBlankNodes = (input, options) => {
  options = options || {};
  const issuer = options.issuer || new IdentifierIssuer('_:b');
  return _labelBlankNodes(issuer, input);
};

/**
 * Compares two JSON-LD values for equality. Two JSON-LD values will be
 * considered equal if:
 *
 * 1. They are both primitives of the same type and value.
 * 2. They are both @values with the same @value, @type, @language,
 *   and @index, OR
 * 3. They both have @ids they are the same.
 *
 * @param v1 the first value.
 * @param v2 the second value.
 *
 * @return true if v1 and v2 are considered equal, false if not.
 */
api.compareValues = (v1, v2) => {
  // 1. equal primitives
  if(v1 === v2) {
    return true;
  }

  // 2. equal @values
  if(graphTypes.isValue(v1) && graphTypes.isValue(v2) &&
    v1['@value'] === v2['@value'] &&
    v1['@type'] === v2['@type'] &&
    v1['@language'] === v2['@language'] &&
    v1['@index'] === v2['@index']) {
    return true;
  }

  // 3. equal @ids
  if(types.isObject(v1) &&
    ('@id' in v1) &&
    types.isObject(v2) &&
    ('@id' in v2)) {
    return v1['@id'] === v2['@id'];
  }

  return false;
};

/**
 * Compares two strings first based on length and then lexicographically.
 *
 * @param a the first string.
 * @param b the second string.
 *
 * @return -1 if a < b, 1 if a > b, 0 if a === b.
 */
api.compareShortestLeast = (a, b) => {
  if(a.length < b.length) {
    return -1;
  }
  if(b.length < a.length) {
    return 1;
  }
  if(a === b) {
    return 0;
  }
  return (a < b) ? -1 : 1;
};

api.normalizeDocumentLoader = fn => {
  if(fn.length < 2) {
    return api.callbackify(fn);
  }

  return async function(url) {
    const callback = arguments[1];
    return new Promise((resolve, reject) => {
      try {
        fn(url, (err, remoteDoc) => {
          if(typeof callback === 'function') {
            return _invokeCallback(callback, err, remoteDoc);
          } else if(err) {
            reject(err);
          } else {
            resolve(remoteDoc);
          }
        });
      } catch(e) {
        if(typeof callback === 'function') {
          return _invokeCallback(callback, e);
        }
        reject(e);
      }
    });
  };
};

api.callbackify = fn => {
  return async function(...args) {
    const callback = args[args.length - 1];
    if(typeof callback === 'function') {
      args.pop();
    }

    let result;
    try {
      result = await fn.apply(null, args);
    } catch(e) {
      if(typeof callback === 'function') {
        return _invokeCallback(callback, e);
      }
      throw e;
    }

    if(typeof callback === 'function') {
      return _invokeCallback(callback, null, result);
    }

    return result;
  };
};

function _invokeCallback(callback, err, result) {
  // execute on next tick to prevent "unhandled rejected promise"
  // and simulate what would have happened in a promiseless API
  api.nextTick(() => callback(err, result));
}

/**
 * Labels the blank nodes in the given value using the given IdentifierIssuer.
 *
 * @param issuer the IdentifierIssuer to use.
 * @param element the element with blank nodes to rename.
 *
 * @return the element.
 */
function _labelBlankNodes(issuer, element) {
  if(types.isArray(element)) {
    for(let i = 0; i < element.length; ++i) {
      element[i] = _labelBlankNodes(issuer, element[i]);
    }
  } else if(graphTypes.isList(element)) {
    element['@list'] = _labelBlankNodes(issuer, element['@list']);
  } else if(types.isObject(element)) {
    // relabel blank node
    if(graphTypes.isBlankNode(element)) {
      element['@id'] = issuer.getId(element['@id']);
    }

    // recursively apply to all keys
    const keys = Object.keys(element).sort();
    for(let ki = 0; ki < keys.length; ++ki) {
      const key = keys[ki];
      if(key !== '@id') {
        element[key] = _labelBlankNodes(issuer, element[key]);
      }
    }
  }

  return element;
}


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const api = {};
module.exports = api;

/**
 * Returns true if the given value is an Array.
 *
 * @param v the value to check.
 *
 * @return true if the value is an Array, false if not.
 */
api.isArray = Array.isArray;

/**
 * Returns true if the given value is a Boolean.
 *
 * @param v the value to check.
 *
 * @return true if the value is a Boolean, false if not.
 */
api.isBoolean = v => (typeof v === 'boolean' ||
  Object.prototype.toString.call(v) === '[object Boolean]');

/**
 * Returns true if the given value is a double.
 *
 * @param v the value to check.
 *
 * @return true if the value is a double, false if not.
 */
api.isDouble = v => api.isNumber(v) && String(v).indexOf('.') !== -1;

/**
 * Returns true if the given value is an empty Object.
 *
 * @param v the value to check.
 *
 * @return true if the value is an empty Object, false if not.
 */
api.isEmptyObject = v => api.isObject(v) && Object.keys(v).length === 0;

/**
 * Returns true if the given value is a Number.
 *
 * @param v the value to check.
 *
 * @return true if the value is a Number, false if not.
 */
api.isNumber = v => (typeof v === 'number' ||
  Object.prototype.toString.call(v) === '[object Number]');

/**
 * Returns true if the given value is numeric.
 *
 * @param v the value to check.
 *
 * @return true if the value is numeric, false if not.
 */
api.isNumeric = v => !isNaN(parseFloat(v)) && isFinite(v);

/**
 * Returns true if the given value is an Object.
 *
 * @param v the value to check.
 *
 * @return true if the value is an Object, false if not.
 */
api.isObject = v => Object.prototype.toString.call(v) === '[object Object]';

/**
 * Returns true if the given value is a String.
 *
 * @param v the value to check.
 *
 * @return true if the value is a String, false if not.
 */
api.isString = v => (typeof v === 'string' ||
  Object.prototype.toString.call(v) === '[object String]');

/**
 * Returns true if the given value is undefined.
 *
 * @param v the value to check.
 *
 * @return true if the value is undefined, false if not.
 */
api.isUndefined = v => typeof v === 'undefined';


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


module.exports = class JsonLdError extends Error {
  /**
   * Creates a JSON-LD Error.
   *
   * @param msg the error message.
   * @param type the error type.
   * @param details the error details.
   */
  constructor(
    message = 'An unspecified JSON-LD error occurred.',
    name = 'jsonld.Error',
    details = {}) {
    super(message);
    this.name = name;
    this.message = message;
    this.details = details;
  }
};


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const util = __webpack_require__(0);
const ActiveContextCache = __webpack_require__(10);
const JsonLdError = __webpack_require__(2);

const {
  isArray: _isArray,
  isObject: _isObject,
  isString: _isString,
  isUndefined: _isUndefined
} = __webpack_require__(1);

const {
  isAbsolute: _isAbsoluteIri,
  isRelative: _isRelativeIri,
  prependBase,
  parse: parseUrl
} = __webpack_require__(4);

const {
  asArray: _asArray,
  compareShortestLeast: _compareShortestLeast
} = __webpack_require__(0);

const MAX_CONTEXT_URLS = 10;

const INITIAL_CONTEXT_CACHE = new Map();
const INITIAL_CONTEXT_CACHE_MAX_SIZE = 10000;

const api = {};
module.exports = api;

api.cache = new ActiveContextCache();

/**
 * Processes a local context and returns a new active context.
 *
 * @param activeCtx the current active context.
 * @param localCtx the local context to process.
 * @param options the context processing options.
 *
 * @return the new active context.
 */
api.process = ({activeCtx, localCtx, options}) => {
  // normalize local context to an array of @context objects
  if(_isObject(localCtx) && '@context' in localCtx &&
    _isArray(localCtx['@context'])) {
    localCtx = localCtx['@context'];
  }
  const ctxs = _isArray(localCtx) ? localCtx : [localCtx];

  // no contexts in array, return current active context w/o changes
  if(ctxs.length === 0) {
    return activeCtx;
  }

  // process each context in order, update active context
  // on each iteration to ensure proper caching
  let rval = activeCtx;
  for(let i = 0; i < ctxs.length; ++i) {
    let ctx = ctxs[i];

    // reset to initial context
    if(ctx === null) {
      rval = activeCtx = api.getInitialContext(options);
      continue;
    }

    // dereference @context key if present
    if(_isObject(ctx) && '@context' in ctx) {
      ctx = ctx['@context'];
    }

    // context must be an object by now, all URLs retrieved before this call
    if(!_isObject(ctx)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context must be an object.',
        'jsonld.SyntaxError', {code: 'invalid local context', context: ctx});
    }

    // get context from cache if available
    if(api.cache) {
      const cached = api.cache.get(activeCtx, ctx);
      if(cached) {
        rval = activeCtx = cached;
        continue;
      }
    }

    // update active context and clone new one before updating
    activeCtx = rval;
    rval = rval.clone();

    // define context mappings for keys in local context
    const defined = {};

    // handle @version
    if('@version' in ctx) {
      if(ctx['@version'] !== 1.1) {
        throw new JsonLdError(
          'Unsupported JSON-LD version: ' + ctx['@version'],
          'jsonld.UnsupportedVersion',
          {code: 'invalid @version value', context: ctx});
      }
      if(activeCtx.processingMode &&
        activeCtx.processingMode === 'json-ld-1.0') {
        throw new JsonLdError(
          '@version: ' + ctx['@version'] + ' not compatible with ' +
          activeCtx.processingMode,
          'jsonld.ProcessingModeConflict',
          {code: 'processing mode conflict', context: ctx});
      }
      rval.processingMode = 'json-ld-1.1';
      rval['@version'] = ctx['@version'];
      defined['@version'] = true;
    }

    // if not set explicitly, set processingMode to "json-ld-1.0"
    rval.processingMode =
      rval.processingMode || activeCtx.processingMode || 'json-ld-1.0';

    // handle @base
    if('@base' in ctx) {
      let base = ctx['@base'];

      if(base === null) {
        // no action
      } else if(_isAbsoluteIri(base)) {
        base = parseUrl(base);
      } else if(_isRelativeIri(base)) {
        base = parseUrl(prependBase(activeCtx['@base'].href, base));
      } else {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@base" in a ' +
          '@context must be an absolute IRI, a relative IRI, or null.',
          'jsonld.SyntaxError', {code: 'invalid base IRI', context: ctx});
      }

      rval['@base'] = base;
      defined['@base'] = true;
    }

    // handle @vocab
    if('@vocab' in ctx) {
      const value = ctx['@vocab'];
      if(value === null) {
        delete rval['@vocab'];
      } else if(!_isString(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@vocab" in a ' +
          '@context must be a string or null.',
          'jsonld.SyntaxError', {code: 'invalid vocab mapping', context: ctx});
      } else if(!_isAbsoluteIri(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@vocab" in a ' +
          '@context must be an absolute IRI.',
          'jsonld.SyntaxError', {code: 'invalid vocab mapping', context: ctx});
      } else {
        rval['@vocab'] = value;
      }
      defined['@vocab'] = true;
    }

    // handle @language
    if('@language' in ctx) {
      const value = ctx['@language'];
      if(value === null) {
        delete rval['@language'];
      } else if(!_isString(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@language" in a ' +
          '@context must be a string or null.',
          'jsonld.SyntaxError',
          {code: 'invalid default language', context: ctx});
      } else {
        rval['@language'] = value.toLowerCase();
      }
      defined['@language'] = true;
    }

    // process all other keys
    for(const key in ctx) {
      api.createTermDefinition(rval, ctx, key, defined);
    }

    // cache result
    if(api.cache) {
      api.cache.set(activeCtx, ctx, rval);
    }
  }

  return rval;
};

/**
 * Creates a term definition during context processing.
 *
 * @param activeCtx the current active context.
 * @param localCtx the local context being processed.
 * @param term the term in the local context to define the mapping for.
 * @param defined a map of defining/defined keys to detect cycles and prevent
 *          double definitions.
 */
api.createTermDefinition = (activeCtx, localCtx, term, defined) => {
  if(term in defined) {
    // term already defined
    if(defined[term]) {
      return;
    }
    // cycle detected
    throw new JsonLdError(
      'Cyclical context definition detected.',
      'jsonld.CyclicalContext',
      {code: 'cyclic IRI mapping', context: localCtx, term});
  }

  // now defining term
  defined[term] = false;

  if(api.isKeyword(term)) {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; keywords cannot be overridden.',
      'jsonld.SyntaxError',
      {code: 'keyword redefinition', context: localCtx, term});
  }

  if(term === '') {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; a term cannot be an empty string.',
      'jsonld.SyntaxError',
      {code: 'invalid term definition', context: localCtx});
  }

  // remove old mapping
  if(activeCtx.mappings[term]) {
    delete activeCtx.mappings[term];
  }

  // get context term value
  let value = localCtx[term];

  // clear context entry
  if(value === null || (_isObject(value) && value['@id'] === null)) {
    activeCtx.mappings[term] = null;
    defined[term] = true;
    return;
  }

  // convert short-hand value to object w/@id
  let simpleTerm = false;
  if(_isString(value)) {
    simpleTerm = true;
    value = {'@id': value};
  }

  if(!_isObject(value)) {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; @context term values must be ' +
      'strings or objects.',
      'jsonld.SyntaxError',
      {code: 'invalid term definition', context: localCtx});
  }

  // create new mapping
  const mapping = activeCtx.mappings[term] = {};
  mapping.reverse = false;

  // make sure term definition only has expected keywords
  const validKeys = ['@container', '@id', '@language', '@reverse', '@type'];

  // JSON-LD 1.1 support
  if(api.processingMode(activeCtx, 1.1)) {
    validKeys.push('@context', '@nest', '@prefix');
  }

  for(const kw in value) {
    if(!validKeys.includes(kw)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a term definition must not contain ' + kw,
        'jsonld.SyntaxError',
        {code: 'invalid term definition', context: localCtx});
    }
  }

  // always compute whether term has a colon as an optimization for
  // _compactIri
  const colon = term.indexOf(':');
  mapping._termHasColon = (colon !== -1);

  if('@reverse' in value) {
    if('@id' in value) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @reverse term definition must not ' +
        'contain @id.', 'jsonld.SyntaxError',
        {code: 'invalid reverse property', context: localCtx});
    }
    if('@nest' in value) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @reverse term definition must not ' +
        'contain @nest.', 'jsonld.SyntaxError',
        {code: 'invalid reverse property', context: localCtx});
    }
    const reverse = value['@reverse'];
    if(!_isString(reverse)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @context @reverse value must be a string.',
        'jsonld.SyntaxError', {code: 'invalid IRI mapping', context: localCtx});
    }

    // expand and add @id mapping
    const id = api.expandIri(
      activeCtx, reverse, {vocab: true, base: false}, localCtx, defined);
    if(!_isAbsoluteIri(id)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @context @reverse value must be an ' +
        'absolute IRI or a blank node identifier.',
        'jsonld.SyntaxError', {code: 'invalid IRI mapping', context: localCtx});
    }
    mapping['@id'] = id;
    mapping.reverse = true;
  } else if('@id' in value) {
    let id = value['@id'];
    if(!_isString(id)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @context @id value must be an array ' +
        'of strings or a string.',
        'jsonld.SyntaxError', {code: 'invalid IRI mapping', context: localCtx});
    }
    if(id !== term) {
      // expand and add @id mapping
      id = api.expandIri(
        activeCtx, id, {vocab: true, base: false}, localCtx, defined);
      if(!_isAbsoluteIri(id) && !api.isKeyword(id)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; a @context @id value must be an ' +
          'absolute IRI, a blank node identifier, or a keyword.',
          'jsonld.SyntaxError',
          {code: 'invalid IRI mapping', context: localCtx});
      }
      mapping['@id'] = id;
      // indicate if this term may be used as a compact IRI prefix
      mapping._prefix = (!mapping._termHasColon &&
        id.match(/[:\/\?#\[\]@]$/) &&
        (simpleTerm || api.processingMode(activeCtx, 1.0)));
    }
  }

  if(!('@id' in mapping)) {
    // see if the term has a prefix
    if(mapping._termHasColon) {
      const prefix = term.substr(0, colon);
      if(prefix in localCtx) {
        // define parent prefix
        api.createTermDefinition(activeCtx, localCtx, prefix, defined);
      }

      if(activeCtx.mappings[prefix]) {
        // set @id based on prefix parent
        const suffix = term.substr(colon + 1);
        mapping['@id'] = activeCtx.mappings[prefix]['@id'] + suffix;
      } else {
        // term is an absolute IRI
        mapping['@id'] = term;
      }
    } else {
      // non-IRIs *must* define @ids if @vocab is not available
      if(!('@vocab' in activeCtx)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; @context terms must define an @id.',
          'jsonld.SyntaxError',
          {code: 'invalid IRI mapping', context: localCtx, term});
      }
      // prepend vocab to term
      mapping['@id'] = activeCtx['@vocab'] + term;
    }
  }

  // IRI mapping now defined
  defined[term] = true;

  if('@type' in value) {
    let type = value['@type'];
    if(!_isString(type)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; an @context @type values must be a string.',
        'jsonld.SyntaxError',
        {code: 'invalid type mapping', context: localCtx});
    }

    if(type !== '@id' && type !== '@vocab') {
      // expand @type to full IRI
      type = api.expandIri(
        activeCtx, type, {vocab: true, base: false}, localCtx, defined);
      if(!_isAbsoluteIri(type)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; an @context @type value must be an ' +
          'absolute IRI.',
          'jsonld.SyntaxError',
          {code: 'invalid type mapping', context: localCtx});
      }
      if(type.indexOf('_:') === 0) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; an @context @type values must be an IRI, ' +
          'not a blank node identifier.',
          'jsonld.SyntaxError',
          {code: 'invalid type mapping', context: localCtx});
      }
    }

    // add @type to mapping
    mapping['@type'] = type;
  }

  if('@container' in value) {
    // normalize container to an array form
    const container = _isString(value['@container']) ?
      [value['@container']] : (value['@container'] || []);
    const validContainers = ['@list', '@set', '@index', '@language'];
    let isValid = true;
    const hasSet = container.includes('@set');

    // JSON-LD 1.1 support
    if(api.processingMode(activeCtx, 1.1)) {
      validContainers.push('@graph', '@id', '@type');

      // check container length
      if(container.includes('@list')) {
        if(container.length !== 1) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; @context @container with @list must ' +
            'have no other values',
            'jsonld.SyntaxError',
            {code: 'invalid container mapping', context: localCtx});
        }
      } else if(container.includes('@graph')) {
        if(container.some(key =>
          key !== '@graph' && key !== '@id' && key !== '@index' &&
          key !== '@set')) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; @context @container with @graph must ' +
            'have no other values other than @id, @index, and @set',
            'jsonld.SyntaxError',
            {code: 'invalid container mapping', context: localCtx});
        }
      } else {
        // otherwise, container may also include @set
        isValid &= container.length <= (hasSet ? 2 : 1);
      }
    } else {
      // in JSON-LD 1.0, container must not be an array (it must be a string,
      // which is one of the validContainers)
      isValid &= !_isArray(value['@container']);

      // check container length
      isValid &= container.length <= 1;
    }

    // check against valid containers
    isValid &= container.every(c => validContainers.includes(c));

    // @set not allowed with @list
    isValid &= !(hasSet && container.includes('@list'));

    if(!isValid) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @container value must be ' +
        'one of the following: ' + validContainers.join(', '),
        'jsonld.SyntaxError',
        {code: 'invalid container mapping', context: localCtx});
    }

    if(mapping.reverse &&
      !container.every(c => ['@index', '@set'].includes(c))) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @container value for a @reverse ' +
        'type definition must be @index or @set.', 'jsonld.SyntaxError',
        {code: 'invalid reverse property', context: localCtx});
    }

    // add @container to mapping
    mapping['@container'] = container;
  }

  // scoped contexts
  if('@context' in value) {
    mapping['@context'] = value['@context'];
  }

  if('@language' in value && !('@type' in value)) {
    let language = value['@language'];
    if(language !== null && !_isString(language)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @language value must be ' +
        'a string or null.', 'jsonld.SyntaxError',
        {code: 'invalid language mapping', context: localCtx});
    }

    // add @language to mapping
    if(language !== null) {
      language = language.toLowerCase();
    }
    mapping['@language'] = language;
  }

  // term may be used as a prefix
  if('@prefix' in value) {
    if(mapping._termHasColon) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @prefix used on a compact IRI term',
        'jsonld.SyntaxError',
        {code: 'invalid term definition', context: localCtx});
    }
    if(typeof value['@prefix'] === 'boolean') {
      mapping._prefix = value['@prefix'] === true;
    } else {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context value for @prefix must be boolean',
        'jsonld.SyntaxError',
        {code: 'invalid @prefix value', context: localCtx});
    }
  }

  if('@nest' in value) {
    const nest = value['@nest'];
    if(!_isString(nest) || (nest !== '@nest' && nest.indexOf('@') === 0)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @nest value must be ' +
        'a string which is not a keyword other than @nest.',
        'jsonld.SyntaxError',
        {code: 'invalid @nest value', context: localCtx});
    }
    mapping['@nest'] = nest;
  }

  // disallow aliasing @context and @preserve
  const id = mapping['@id'];
  if(id === '@context' || id === '@preserve') {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; @context and @preserve cannot be aliased.',
      'jsonld.SyntaxError', {code: 'invalid keyword alias', context: localCtx});
  }
};

/**
 * Expands a string to a full IRI. The string may be a term, a prefix, a
 * relative IRI, or an absolute IRI. The associated absolute IRI will be
 * returned.
 *
 * @param activeCtx the current active context.
 * @param value the string to expand.
 * @param relativeTo options for how to resolve relative IRIs:
 *          base: true to resolve against the base IRI, false not to.
 *          vocab: true to concatenate after @vocab, false not to.
 * @param localCtx the local context being processed (only given if called
 *          during context processing).
 * @param defined a map for tracking cycles in context definitions (only given
 *          if called during context processing).
 *
 * @return the expanded value.
 */
api.expandIri = (activeCtx, value, relativeTo, localCtx, defined) => {
  // already expanded
  if(value === null || !_isString(value) || api.isKeyword(value)) {
    return value;
  }

  // define term dependency if not defined
  if(localCtx && value in localCtx && defined[value] !== true) {
    api.createTermDefinition(activeCtx, localCtx, value, defined);
  }

  relativeTo = relativeTo || {};
  if(relativeTo.vocab) {
    const mapping = activeCtx.mappings[value];

    // value is explicitly ignored with a null mapping
    if(mapping === null) {
      return null;
    }

    if(mapping) {
      // value is a term
      return mapping['@id'];
    }
  }

  // split value into prefix:suffix
  const colon = value.indexOf(':');
  if(colon !== -1) {
    const prefix = value.substr(0, colon);
    const suffix = value.substr(colon + 1);

    // do not expand blank nodes (prefix of '_') or already-absolute
    // IRIs (suffix of '//')
    if(prefix === '_' || suffix.indexOf('//') === 0) {
      return value;
    }

    // prefix dependency not defined, define it
    if(localCtx && prefix in localCtx) {
      api.createTermDefinition(activeCtx, localCtx, prefix, defined);
    }

    // use mapping if prefix is defined
    const mapping = activeCtx.mappings[prefix];
    if(mapping) {
      return mapping['@id'] + suffix;
    }

    // already absolute IRI
    return value;
  }

  // prepend vocab
  if(relativeTo.vocab && '@vocab' in activeCtx) {
    return activeCtx['@vocab'] + value;
  }

  // prepend base
  if(relativeTo.base) {
    return prependBase(activeCtx['@base'], value);
  }

  return value;
};

/**
 * Gets the initial context.
 *
 * @param options the options to use:
 *          [base] the document base IRI.
 *
 * @return the initial context.
 */
api.getInitialContext = options => {
  const base = parseUrl(options.base || '');
  const key = JSON.stringify({base, processingMode: options.processingMode});
  const cached = INITIAL_CONTEXT_CACHE.get(key);
  if(cached) {
    return cached;
  }

  const initialContext = {
    '@base': base,
    processingMode: options.processingMode,
    mappings: {},
    inverse: null,
    getInverse: _createInverseContext,
    clone: _cloneActiveContext
  };
  // TODO: consider using LRU cache instead
  if(INITIAL_CONTEXT_CACHE.size === INITIAL_CONTEXT_CACHE_MAX_SIZE) {
    // clear whole cache -- assumes scenario where the cache fills means
    // the cache isn't being used very efficiently anyway
    INITIAL_CONTEXT_CACHE.clear();
  }
  INITIAL_CONTEXT_CACHE.set(key, initialContext);
  return initialContext;

  /**
   * Generates an inverse context for use in the compaction algorithm, if
   * not already generated for the given active context.
   *
   * @return the inverse context.
   */
  function _createInverseContext() {
    const activeCtx = this;

    // lazily create inverse
    if(activeCtx.inverse) {
      return activeCtx.inverse;
    }
    const inverse = activeCtx.inverse = {};

    // variables for building fast CURIE map
    const fastCurieMap = activeCtx.fastCurieMap = {};
    const irisToTerms = {};

    // handle default language
    const defaultLanguage = activeCtx['@language'] || '@none';

    // create term selections for each mapping in the context, ordered by
    // shortest and then lexicographically least
    const mappings = activeCtx.mappings;
    const terms = Object.keys(mappings).sort(_compareShortestLeast);
    for(let i = 0; i < terms.length; ++i) {
      const term = terms[i];
      const mapping = mappings[term];
      if(mapping === null) {
        continue;
      }

      let container = mapping['@container'] || '@none';
      container = [].concat(container).sort().join('');

      // iterate over every IRI in the mapping
      const ids = _asArray(mapping['@id']);
      for(let ii = 0; ii < ids.length; ++ii) {
        const iri = ids[ii];
        let entry = inverse[iri];
        const isKeyword = api.isKeyword(iri);

        if(!entry) {
          // initialize entry
          inverse[iri] = entry = {};

          if(!isKeyword && !mapping._termHasColon) {
            // init IRI to term map and fast CURIE prefixes
            irisToTerms[iri] = [term];
            const fastCurieEntry = {iri, terms: irisToTerms[iri]};
            if(iri[0] in fastCurieMap) {
              fastCurieMap[iri[0]].push(fastCurieEntry);
            } else {
              fastCurieMap[iri[0]] = [fastCurieEntry];
            }
          }
        } else if(!isKeyword && !mapping._termHasColon) {
          // add IRI to term match
          irisToTerms[iri].push(term);
        }

        // add new entry
        if(!entry[container]) {
          entry[container] = {
            '@language': {},
            '@type': {},
            '@any': {}
          };
        }
        entry = entry[container];
        _addPreferredTerm(term, entry['@any'], '@none');

        if(mapping.reverse) {
          // term is preferred for values using @reverse
          _addPreferredTerm(term, entry['@type'], '@reverse');
        } else if('@type' in mapping) {
          // term is preferred for values using specific type
          _addPreferredTerm(term, entry['@type'], mapping['@type']);
        } else if('@language' in mapping) {
          // term is preferred for values using specific language
          const language = mapping['@language'] || '@null';
          _addPreferredTerm(term, entry['@language'], language);
        } else {
          // term is preferred for values w/default language or no type and
          // no language
          // add an entry for the default language
          _addPreferredTerm(term, entry['@language'], defaultLanguage);

          // add entries for no type and no language
          _addPreferredTerm(term, entry['@type'], '@none');
          _addPreferredTerm(term, entry['@language'], '@none');
        }
      }
    }

    // build fast CURIE map
    for(const key in fastCurieMap) {
      _buildIriMap(fastCurieMap, key, 1);
    }

    return inverse;
  }

  /**
   * Runs a recursive algorithm to build a lookup map for quickly finding
   * potential CURIEs.
   *
   * @param iriMap the map to build.
   * @param key the current key in the map to work on.
   * @param idx the index into the IRI to compare.
   */
  function _buildIriMap(iriMap, key, idx) {
    const entries = iriMap[key];
    const next = iriMap[key] = {};

    let iri;
    let letter;
    for(let i = 0; i < entries.length; ++i) {
      iri = entries[i].iri;
      if(idx >= iri.length) {
        letter = '';
      } else {
        letter = iri[idx];
      }
      if(letter in next) {
        next[letter].push(entries[i]);
      } else {
        next[letter] = [entries[i]];
      }
    }

    for(const key in next) {
      if(key === '') {
        continue;
      }
      _buildIriMap(next, key, idx + 1);
    }
  }

  /**
   * Adds the term for the given entry if not already added.
   *
   * @param term the term to add.
   * @param entry the inverse context typeOrLanguage entry to add to.
   * @param typeOrLanguageValue the key in the entry to add to.
   */
  function _addPreferredTerm(term, entry, typeOrLanguageValue) {
    if(!(typeOrLanguageValue in entry)) {
      entry[typeOrLanguageValue] = term;
    }
  }

  /**
   * Clones an active context, creating a child active context.
   *
   * @return a clone (child) of the active context.
   */
  function _cloneActiveContext() {
    const child = {};
    child['@base'] = this['@base'];
    child.mappings = util.clone(this.mappings);
    child.clone = this.clone;
    child.inverse = null;
    child.getInverse = this.getInverse;
    if('@language' in this) {
      child['@language'] = this['@language'];
    }
    if('@vocab' in this) {
      child['@vocab'] = this['@vocab'];
    }
    return child;
  }
};

/**
 * Gets the value for the given active context key and type, null if none is
 * set.
 *
 * @param ctx the active context.
 * @param key the context key.
 * @param [type] the type of value to get (eg: '@id', '@type'), if not
 *          specified gets the entire entry for a key, null if not found.
 *
 * @return the value.
 */
api.getContextValue = (ctx, key, type) => {
  // return null for invalid key
  if(key === null) {
    return null;
  }

  // get specific entry information
  if(ctx.mappings[key]) {
    const entry = ctx.mappings[key];

    if(_isUndefined(type)) {
      // return whole entry
      return entry;
    }
    if(type in entry) {
      // return entry value for type
      return entry[type];
    }
  }

  // get default language
  if(type === '@language' && (type in ctx)) {
    return ctx[type];
  }

  return null;
};

/**
 * Retrieves external @context URLs using the given document loader. Every
 * instance of @context in the input that refers to a URL will be replaced
 * with the JSON @context found at that URL.
 *
 * @param input the JSON-LD input with possible contexts.
 * @param options the options to use:
 *          documentLoader(url, [callback(err, remoteDoc)]) the document loader.
 * @param callback(err, input) called once the operation completes.
 */
api.getAllContexts = async (input, options) => {
  return _retrieveContextUrls(input, options);
};

/**
 * Processing Mode check.
 *
 * @param activeCtx the current active context.
 * @param version the string or numeric version to check.
 *
 * @return boolean.
 */
api.processingMode = (activeCtx, version) => {
  if(version.toString() >= '1.1') {
    return activeCtx.processingMode &&
      activeCtx.processingMode >= 'json-ld-' + version.toString();
  } else {
    return !activeCtx.processingMode ||
      activeCtx.processingMode === 'json-ld-1.0';
  }
};

/**
 * Returns whether or not the given value is a keyword.
 *
 * @param v the value to check.
 *
 * @return true if the value is a keyword, false if not.
 */
api.isKeyword = v => {
  if(!_isString(v)) {
    return false;
  }
  switch(v) {
    case '@base':
    case '@container':
    case '@context':
    case '@default':
    case '@embed':
    case '@explicit':
    case '@graph':
    case '@id':
    case '@index':
    case '@language':
    case '@list':
    case '@nest':
    case '@none':
    case '@omitDefault':
    case '@prefix':
    case '@preserve':
    case '@requireAll':
    case '@reverse':
    case '@set':
    case '@type':
    case '@value':
    case '@version':
    case '@vocab':
      return true;
  }
  return false;
};

async function _retrieveContextUrls(input, options) {
  const documentLoader = util.normalizeDocumentLoader(options.documentLoader);

  // retrieve all @context URLs in input
  await retrieve(input, new Set(), documentLoader);

  return input;

  // recursive function that will retrieve all @context URLs in documents
  async function retrieve(doc, cycles, documentLoader) {
    if(cycles.size > MAX_CONTEXT_URLS) {
      throw new JsonLdError(
        'Maximum number of @context URLs exceeded.',
        'jsonld.ContextUrlError',
        {code: 'loading remote context failed', max: MAX_CONTEXT_URLS});
    }

    // find all URLs in the given document
    const urls = new Map();
    _findContextUrls(doc, urls, false, options.base);
    if(urls.size === 0) {
      return;
    }

    // queue all unretrieved URLs
    const queue = [...urls.keys()].filter(u => urls.get(u) === false);

    // retrieve URLs in queue
    return Promise.all(queue.map(async url => {
      // check for context URL cycle
      if(cycles.has(url)) {
        throw new JsonLdError(
          'Cyclical @context URLs detected.',
          'jsonld.ContextUrlError',
          {code: 'recursive context inclusion', url});
      }

      const _cycles = new Set(cycles);
      _cycles.add(url);
      let remoteDoc;
      let ctx;

      try {
        remoteDoc = await documentLoader(url);
        ctx = remoteDoc.document || null;
        // parse string context as JSON
        if(_isString(ctx)) {
          ctx = JSON.parse(ctx);
        }
      } catch(e) {
        throw new JsonLdError(
          'Dereferencing a URL did not result in a valid JSON-LD object. ' +
          'Possible causes are an inaccessible URL perhaps due to ' +
          'a same-origin policy (ensure the server uses CORS if you are ' +
          'using client-side JavaScript), too many redirects, a ' +
          'non-JSON response, or more than one HTTP Link Header was ' +
          'provided for a remote context.',
          'jsonld.InvalidUrl',
          {code: 'loading remote context failed', url, cause: e});
      }

      // ensure ctx is an object
      if(!_isObject(ctx)) {
        throw new JsonLdError(
          'Dereferencing a URL did not result in a JSON object. The ' +
          'response was valid JSON, but it was not a JSON object.',
          'jsonld.InvalidUrl',
          {code: 'invalid remote context', url});
      }

      // use empty context if no @context key is present
      if(!('@context' in ctx)) {
        ctx = {'@context': {}};
      } else {
        ctx = {'@context': ctx['@context']};
      }

      // append @context URL to context if given
      if(remoteDoc.contextUrl) {
        if(!_isArray(ctx['@context'])) {
          ctx['@context'] = [ctx['@context']];
        }
        ctx['@context'].push(remoteDoc.contextUrl);
      }

      // recurse
      await retrieve(ctx, _cycles, documentLoader);

      // store retrieved context w/replaced @context URLs
      urls.set(url, ctx['@context']);

      // replace all @context URLs in the document
      _findContextUrls(doc, urls, true, options.base);
    }));
  }
}

/**
 * Finds all @context URLs in the given JSON-LD input.
 *
 * @param input the JSON-LD input.
 * @param urls a map of URLs (url => false/@contexts).
 * @param replace true to replace the URLs in the given input with the
 *           @contexts from the urls map, false not to.
 * @param base the base IRI to use to resolve relative IRIs.
 *
 * @return true if new URLs to retrieve were found, false if not.
 */
function _findContextUrls(input, urls, replace, base) {
  if(_isArray(input)) {
    for(const element of input) {
      _findContextUrls(element, urls, replace, base);
    }
    return;
  }

  if(!_isObject(input)) {
    // no @context URLs can be found in non-object input
    return;
  }

  // input is an object
  for(const key in input) {
    if(key !== '@context') {
      _findContextUrls(input[key], urls, replace, base);
      continue;
    }

    // get @context
    const ctx = input[key];

    if(_isArray(ctx)) {
      // array @context
      let length = ctx.length;
      for(let i = 0; i < length; ++i) {
        const _ctx = ctx[i];
        if(_isString(_ctx)) {
          const prepended = prependBase(base, _ctx);
          const resolved = urls.get(prepended);
          // replace w/@context if requested
          if(replace) {
            if(_isArray(resolved)) {
              // add flattened context
              Array.prototype.splice.apply(ctx, [i, 1].concat(resolved));
              i += resolved.length - 1;
              length = ctx.length;
            } else if(resolved !== false) {
              ctx[i] = resolved;
            }
          } else if(resolved === undefined) {
            // @context URL found
            urls.set(prepended, false);
          }
        } else {
          // look for scoped context
          for(const key in _ctx) {
            if(_isObject(_ctx[key])) {
              _findContextUrls(_ctx[key], urls, replace, base);
            }
          }
        }
      }
    } else if(_isString(ctx)) {
      // string @context
      const prepended = prependBase(base, ctx);
      const resolved = urls.get(prepended);
      // replace w/@context if requested
      if(replace) {
        if(resolved !== false) {
          input[key] = resolved;
        }
      } else if(resolved === undefined) {
        // @context URL found
        urls.set(prepended, false);
      }
    } else {
      // look for scoped context
      for(const key in ctx) {
        if(_isObject(ctx[key])) {
          _findContextUrls(ctx[key], urls, replace, base);
        }
      }
    }
  }
}


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const types = __webpack_require__(1);

const api = {};
module.exports = api;

// define URL parser
// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
// with local jsonld.js modifications
api.parsers = {
  simple: {
    // RFC 3986 basic parts
    keys: [
      'href', 'scheme', 'authority', 'path', 'query', 'fragment'
    ],
    regex: /^(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/
  },
  full: {
    keys: [
      'href', 'protocol', 'scheme', 'authority', 'auth', 'user', 'password',
      'hostname', 'port', 'path', 'directory', 'file', 'query', 'fragment'
    ],
    regex: /^(([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?(?:(((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};
api.parse = (str, parser) => {
  const parsed = {};
  const o = api.parsers[parser || 'full'];
  const m = o.regex.exec(str);
  let i = o.keys.length;
  while(i--) {
    parsed[o.keys[i]] = (m[i] === undefined) ? null : m[i];
  }

  // remove default ports in found in URLs
  if((parsed.scheme === 'https' && parsed.port === '443') ||
    (parsed.scheme === 'http' && parsed.port === '80')) {
    parsed.href = parsed.href.replace(':' + parsed.port, '');
    parsed.authority = parsed.authority.replace(':' + parsed.port, '');
    parsed.port = null;
  }

  parsed.normalizedPath = api.removeDotSegments(parsed.path);
  return parsed;
};

/**
 * Prepends a base IRI to the given relative IRI.
 *
 * @param base the base IRI.
 * @param iri the relative IRI.
 *
 * @return the absolute IRI.
 */
api.prependBase = (base, iri) => {
  // skip IRI processing
  if(base === null) {
    return iri;
  }
  // already an absolute IRI
  if(iri.indexOf(':') !== -1) {
    return iri;
  }

  // parse base if it is a string
  if(types.isString(base)) {
    base = api.parse(base || '');
  }

  // parse given IRI
  const rel = api.parse(iri);

  // per RFC3986 5.2.2
  const transform = {
    protocol: base.protocol || ''
  };

  if(rel.authority !== null) {
    transform.authority = rel.authority;
    transform.path = rel.path;
    transform.query = rel.query;
  } else {
    transform.authority = base.authority;

    if(rel.path === '') {
      transform.path = base.path;
      if(rel.query !== null) {
        transform.query = rel.query;
      } else {
        transform.query = base.query;
      }
    } else {
      if(rel.path.indexOf('/') === 0) {
        // IRI represents an absolute path
        transform.path = rel.path;
      } else {
        // merge paths
        let path = base.path;

        // append relative path to the end of the last directory from base
        path = path.substr(0, path.lastIndexOf('/') + 1);
        if(path.length > 0 && path.substr(-1) !== '/') {
          path += '/';
        }
        path += rel.path;

        transform.path = path;
      }
      transform.query = rel.query;
    }
  }

  if(rel.path !== '') {
    // remove slashes and dots in path
    transform.path = api.removeDotSegments(transform.path);
  }

  // construct URL
  let rval = transform.protocol;
  if(transform.authority !== null) {
    rval += '//' + transform.authority;
  }
  rval += transform.path;
  if(transform.query !== null) {
    rval += '?' + transform.query;
  }
  if(rel.fragment !== null) {
    rval += '#' + rel.fragment;
  }

  // handle empty base
  if(rval === '') {
    rval = './';
  }

  return rval;
};

/**
 * Removes a base IRI from the given absolute IRI.
 *
 * @param base the base IRI.
 * @param iri the absolute IRI.
 *
 * @return the relative IRI if relative to base, otherwise the absolute IRI.
 */
api.removeBase = (base, iri) => {
  // skip IRI processing
  if(base === null) {
    return iri;
  }

  if(types.isString(base)) {
    base = api.parse(base || '');
  }

  // establish base root
  let root = '';
  if(base.href !== '') {
    root += (base.protocol || '') + '//' + (base.authority || '');
  } else if(iri.indexOf('//')) {
    // support network-path reference with empty base
    root += '//';
  }

  // IRI not relative to base
  if(iri.indexOf(root) !== 0) {
    return iri;
  }

  // remove root from IRI and parse remainder
  const rel = api.parse(iri.substr(root.length));

  // remove path segments that match (do not remove last segment unless there
  // is a hash or query)
  const baseSegments = base.normalizedPath.split('/');
  const iriSegments = rel.normalizedPath.split('/');
  const last = (rel.fragment || rel.query) ? 0 : 1;
  while(baseSegments.length > 0 && iriSegments.length > last) {
    if(baseSegments[0] !== iriSegments[0]) {
      break;
    }
    baseSegments.shift();
    iriSegments.shift();
  }

  // use '../' for each non-matching base segment
  let rval = '';
  if(baseSegments.length > 0) {
    // don't count the last segment (if it ends with '/' last path doesn't
    // count and if it doesn't end with '/' it isn't a path)
    baseSegments.pop();
    for(let i = 0; i < baseSegments.length; ++i) {
      rval += '../';
    }
  }

  // prepend remaining segments
  rval += iriSegments.join('/');

  // add query and hash
  if(rel.query !== null) {
    rval += '?' + rel.query;
  }
  if(rel.fragment !== null) {
    rval += '#' + rel.fragment;
  }

  // handle empty base
  if(rval === '') {
    rval = './';
  }

  return rval;
};

/**
 * Removes dot segments from a URL path.
 *
 * @param path the path to remove dot segments from.
 */
api.removeDotSegments = path => {
  // RFC 3986 5.2.4 (reworked)

  // empty path shortcut
  if(path.length === 0) {
    return '';
  }

  const input = path.split('/');
  const output = [];

  while(input.length > 0) {
    const next = input.shift();
    const done = input.length === 0;

    if(next === '.') {
      if(done) {
        // ensure output has trailing /
        output.push('');
      }
      continue;
    }

    if(next === '..') {
      output.pop();
      if(done) {
        // ensure output has trailing /
        output.push('');
      }
      continue;
    }

    output.push(next);
  }

  // ensure output has leading /
  if(output.length > 0 && output[0] !== '') {
    output.unshift('');
  }
  if(output.length === 1 && output[0] === '') {
    return '/';
  }

  return output.join('/');
};

// TODO: time better isAbsolute/isRelative checks using full regexes:
// http://jmrware.com/articles/2009/uri_regexp/URI_regex.html

// regex to check for absolute IRI (starting scheme and ':') or blank node IRI
const isAbsoluteRegex = /^([A-Za-z][A-Za-z0-9+-.]*|_):/;

/**
 * Returns true if the given value is an absolute IRI or blank node IRI, false
 * if not.
 * Note: This weak check only checks for a correct starting scheme.
 *
 * @param v the value to check.
 *
 * @return true if the value is an absolute IRI, false if not.
 */
api.isAbsolute = v => types.isString(v) && isAbsoluteRegex.test(v);

/**
 * Returns true if the given value is a relative IRI, false if not.
 * Note: this is a weak check.
 *
 * @param v the value to check.
 *
 * @return true if the value is a relative IRI, false if not.
 */
api.isRelative = v => types.isString(v);


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const types = __webpack_require__(1);

const api = {};
module.exports = api;

/**
 * Returns true if the given value is a subject with properties.
 *
 * @param v the value to check.
 *
 * @return true if the value is a subject with properties, false if not.
 */
api.isSubject = v => {
  // Note: A value is a subject if all of these hold true:
  // 1. It is an Object.
  // 2. It is not a @value, @set, or @list.
  // 3. It has more than 1 key OR any existing key is not @id.
  if(types.isObject(v) &&
    !(('@value' in v) || ('@set' in v) || ('@list' in v))) {
    const keyCount = Object.keys(v).length;
    return (keyCount > 1 || !('@id' in v));
  }
  return false;
};

/**
 * Returns true if the given value is a subject reference.
 *
 * @param v the value to check.
 *
 * @return true if the value is a subject reference, false if not.
 */
api.isSubjectReference = v =>
  // Note: A value is a subject reference if all of these hold true:
  // 1. It is an Object.
  // 2. It has a single key: @id.
  (types.isObject(v) && Object.keys(v).length === 1 && ('@id' in v));

/**
 * Returns true if the given value is a @value.
 *
 * @param v the value to check.
 *
 * @return true if the value is a @value, false if not.
 */
api.isValue = v =>
  // Note: A value is a @value if all of these hold true:
  // 1. It is an Object.
  // 2. It has the @value property.
  types.isObject(v) && ('@value' in v);

/**
 * Returns true if the given value is a @list.
 *
 * @param v the value to check.
 *
 * @return true if the value is a @list, false if not.
 */
api.isList = v =>
  // Note: A value is a @list if all of these hold true:
  // 1. It is an Object.
  // 2. It has the @list property.
  types.isObject(v) && ('@list' in v);

/**
 * Returns true if the given value is a @graph.
 *
 * @return true if the value is a @graph, false if not.
 */
api.isGraph = v => {
  // Note: A value is a graph if all of these hold true:
  // 1. It is an object.
  // 2. It has an `@graph` key.
  // 3. It may have '@id' or '@index'
  return types.isObject(v) &&
    '@graph' in v &&
    Object.keys(v)
      .filter(key => key !== '@id' && key !== '@index').length === 1;
};

/**
 * Returns true if the given value is a simple @graph.
 *
 * @return true if the value is a simple @graph, false if not.
 */
api.isSimpleGraph = v => {
  // Note: A value is a simple graph if all of these hold true:
  // 1. It is an object.
  // 2. It has an `@graph` key.
  // 3. It has only 1 key or 2 keys where one of them is `@index`.
  return api.isGraph(v) && !('@id' in v);
};

/**
 * Returns true if the given value is a blank node.
 *
 * @param v the value to check.
 *
 * @return true if the value is a blank node, false if not.
 */
api.isBlankNode = v => {
  // Note: A value is a blank node if all of these hold true:
  // 1. It is an Object.
  // 2. If it has an @id key its value begins with '_:'.
  // 3. It has no keys OR is not a @value, @set, or @list.
  if(types.isObject(v)) {
    if('@id' in v) {
      return (v['@id'].indexOf('_:') === 0);
    }
    return (Object.keys(v).length === 0 ||
      !(('@value' in v) || ('@set' in v) || ('@list' in v)));
  }
  return false;
};


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(7);


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

/**
 * A JavaScript implementation of the JSON-LD API.
 *
 * @author Dave Longley
 *
 * @license BSD 3-Clause License
 * Copyright (c) 2011-2017 Digital Bazaar, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of the Digital Bazaar, Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
const util = __webpack_require__(0);
const JsonLdError = __webpack_require__(2);

const {expand: _expand} = __webpack_require__(9);
const {toRDF: _toRDF} = __webpack_require__(11);
const DocumentCache = __webpack_require__(14);

const documentCache = new DocumentCache({size: 100, expires: 300*1000});

const {
  isArray: _isArray,
  isObject: _isObject,
  isString: _isString
} = __webpack_require__(1);

const {
  getInitialContext: _getInitialContext,
  process: _processContext,
  getAllContexts: _getAllContexts,
  expandIri: _expandIri
} = __webpack_require__(3);

// determine if in-browser or using node.js
const _nodejs = (
  typeof process !== 'undefined' && process.versions && process.versions.node);
const _browser = !_nodejs &&
  (typeof window !== 'undefined' || typeof self !== 'undefined');

/* eslint-disable indent */
// attaches jsonld API to the given object
const wrapper = function(jsonld) {

/* Core API */


/**
 * Performs JSON-LD expansion.
 *
 * @param input the JSON-LD input to expand.
 * @param [options] the options to use:
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [keepFreeFloatingNodes] true to keep free-floating nodes,
 *            false not to, defaults to false.
 *          [documentLoader(url, callback(err, remoteDoc))] the document loader.
 *          [expansionMap(info)] a function that can be used to custom map
 *            unmappable values (or to throw an error when they are detected);
 *            if this function returns `undefined` then the default behavior
 *            will be used.
 * @param [callback(err, expanded)] called once the operation completes.
 *
 * @return a Promise that resolves to the expanded output.
 */
jsonld.expand = util.callbackify(async function(input, options) {
  if(arguments.length < 1) {
    throw new TypeError('Could not expand, too few arguments.');
  }

  // set default options
  options = _setDefaults(options, {
    keepFreeFloatingNodes: false
  });
  if(options.expansionMap === false) {
    options.expansionMap = undefined;
  }

  // build set of objects that may have @contexts to resolve
  const toResolve = {};

  // build set of contexts to process prior to expansion
  const contextsToProcess = [];

  // if an `expandContext` has been given ensure it gets resolved
  if('expandContext' in options) {
    const expandContext = util.clone(options.expandContext);
    if(_isObject(expandContext) && '@context' in expandContext) {
      toResolve.expandContext = expandContext;
    } else {
      toResolve.expandContext = {'@context': expandContext};
    }
    contextsToProcess.push(toResolve.expandContext);
  }

  // if input is a string, attempt to dereference remote document
  let defaultBase;
  if(!_isString(input)) {
    // input is not a URL, do not need to retrieve it first
    toResolve.input = util.clone(input);
  } else {
    // load remote doc
    const remoteDoc = await jsonld.get(input, options);
    defaultBase = remoteDoc.documentUrl;
    toResolve.input = remoteDoc.document;
    if(remoteDoc.contextUrl) {
      // context included in HTTP link header and must be resolved
      toResolve.remoteContext = {'@context': remoteDoc.contextUrl};
      contextsToProcess.push(toResolve.remoteContext);
    }
  }

  // set default base
  if(!('base' in options)) {
    options.base = defaultBase || '';
  }

  // get all contexts in `toResolve`
  await _getAllContexts(toResolve, options);

  // process any additional contexts
  let activeCtx = _getInitialContext(options);
  contextsToProcess.forEach(localCtx => {
    activeCtx = _processContext({activeCtx, localCtx, options});
  });

  // expand resolved input
  let expanded = _expand({
    activeCtx,
    element: toResolve.input,
    options,
    expansionMap: options.expansionMap
  });

  // optimize away @graph with no other properties
  if(_isObject(expanded) && ('@graph' in expanded) &&
    Object.keys(expanded).length === 1) {
    expanded = expanded['@graph'];
  } else if(expanded === null) {
    expanded = [];
  }

  // normalize to an array
  if(!_isArray(expanded)) {
    expanded = [expanded];
  }

  return expanded;
});

/**
 * Outputs the RDF dataset found in the given JSON-LD object.
 *
 * @param input the JSON-LD input.
 * @param [options] the options to use:
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [skipExpansion] true to assume the input is expanded and skip
 *            expansion, false not to, defaults to false.
 *          [format] the format to use to output a string:
 *            'application/n-quads' for N-Quads.
 *          [produceGeneralizedRdf] true to output generalized RDF, false
 *            to produce only standard RDF (default: false).
 *          [documentLoader(url, callback(err, remoteDoc))] the document loader.
 * @param [callback(err, dataset)] called once the operation completes.
 *
 * @return a Promise that resolves to the RDF dataset.
 */
jsonld.toRDF = util.callbackify(async function(input, options) {
  if(arguments.length < 1) {
    throw new TypeError('Could not convert to RDF, too few arguments.');
  }
  
  let documentLoader = options.documentLoader;
  options.documentLoader = function(url, callback) {
    let doc = documentCache.get(url);
    if(doc) return callback(null, doc);
    documentLoader(url, function(err, remoteDoc) {
      if(err) return callback(err);
      documentCache.set(url, remoteDoc);
      callback(null, remoteDoc);
    });
  };
  
  // set default options
  options = _setDefaults(options, {
    base: _isString(input) ? input : '',
    skipExpansion: false
  });

  // TODO: support toRDF custom map?
  let expanded;
  if(options.skipExpansion) {
    expanded = input;
  } else {
    // expand input
    expanded = await jsonld.expand(input, options);
  }

  // output RDF dataset
  const dataset = _toRDF(expanded, options);
  if(options.format) {
    if(options.format === 'application/n-quads' ||
      options.format === 'application/nquads') {
      return await NQuads.serialize(dataset);
    }
    throw new JsonLdError(
      'Unknown output format.',
      'jsonld.UnknownFormat', {format: options.format});
  }

  return dataset;
});

/**
 * Gets a remote JSON-LD document using the default document loader or
 * one given in the passed options.
 *
 * @param url the URL to fetch.
 * @param [options] the options to use:
 *          [documentLoader] the document loader to use.
 * @param [callback(err, remoteDoc)] called once the operation completes.
 *
 * @return a Promise that resolves to the retrieved remote document.
 */
jsonld.get = util.callbackify(async function(url, options) {
  let load;
  if(typeof options.documentLoader === 'function') {
    load = util.normalizeDocumentLoader(options.documentLoader);
  } else {
    load = jsonld.documentLoader;
  }

  const remoteDoc = await load(url);

  // TODO: can this be moved into `normalizeDocumentLoader`?
  try {
    if(!remoteDoc.document) {
      throw new JsonLdError(
        'No remote document found at the given URL.',
        'jsonld.NullRemoteDocument');
    }
    if(_isString(remoteDoc.document)) {
      remoteDoc.document = JSON.parse(remoteDoc.document);
    }
  } catch(e) {
    throw new JsonLdError(
      'Could not retrieve a JSON-LD document from the URL.',
      'jsonld.LoadDocumentError', {
        code: 'loading document failed',
        cause: e,
        remoteDoc
      });
  }

  return remoteDoc;
});

/**
 * Processes a local context, resolving any URLs as necessary, and returns a
 * new active context in its callback.
 *
 * @param activeCtx the current active context.
 * @param localCtx the local context to process.
 * @param [options] the options to use:
 *          [documentLoader(url, callback(err, remoteDoc))] the document loader.
 * @param [callback(err, activeCtx)] called once the operation completes.
 *
 * @return a Promise that resolves to the new active context.
 */
jsonld.processContext = util.callbackify(async function(
  activeCtx, localCtx, options) {
  // set default options
  options = _setDefaults(options, {
    base: ''
  });

  // return initial context early for null context
  if(localCtx === null) {
    return _getInitialContext(options);
  }

  // get URLs in localCtx
  localCtx = util.clone(localCtx);
  if(!(_isObject(localCtx) && '@context' in localCtx)) {
    localCtx = {'@context': localCtx};
  }
  const ctx = await _getAllContexts(localCtx, options);

  return _processContext({activeCtx, localCtx: ctx, options});
});

// backwards compatibility
jsonld.getContextValue = __webpack_require__(3).getContextValue;

/**
 * Document loaders.
 */
jsonld.documentLoaders = {};

/**
 * Assigns the default document loader for external document URLs to a built-in
 * default. Supported types currently include: 'xhr' and 'node'.
 *
 * @param type the type to set.
 * @param [params] the parameters required to use the document loader.
 */
jsonld.useDocumentLoader = function(type) {
  if(!(type in jsonld.documentLoaders)) {
    throw new JsonLdError(
      'Unknown document loader type: "' + type + '"',
      'jsonld.UnknownDocumentLoader',
      {type});
  }

  // set document loader
  jsonld.documentLoader = jsonld.documentLoaders[type].apply(
    jsonld, Array.prototype.slice.call(arguments, 1));
};

/** Registered RDF dataset parsers hashed by content-type. */
const _rdfParsers = {};


/* URL API */
jsonld.url = __webpack_require__(4);

/* Utility API */
jsonld.util = util;
// backwards compatibility
Object.assign(jsonld, util);

// reexpose API as jsonld.promises for backwards compatability
jsonld.promises = jsonld;



function _setDefaults(options, defaults) {
  return Object.assign({}, defaults, options);
}

// end of jsonld API `wrapper` factory
return jsonld;
};

// external APIs:

// used to generate a new jsonld API instance
const factory = function() {
  return wrapper(function() {
    return factory();
  });
};

// wrap the main jsonld API instance
wrapper(factory);
// export API
module.exports = factory;


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */


const util = __webpack_require__(0);

module.exports = class IdentifierIssuer {
  /**
   * Creates a new IdentifierIssuer. A IdentifierIssuer issues unique
   * identifiers, keeping track of any previously issued identifiers.
   *
   * @param prefix the prefix to use ('<prefix><counter>').
   */
  constructor(prefix) {
    this.prefix = prefix;
    this.counter = 0;
    this.existing = {};
  }
  /**
   * Copies this IdentifierIssuer.
   *
   * @return a copy of this IdentifierIssuer.
   */


  clone() {
    const copy = new IdentifierIssuer(this.prefix);
    copy.counter = this.counter;
    copy.existing = util.clone(this.existing);
    return copy;
  }
  /**
   * Gets the new identifier for the given old identifier, where if no old
   * identifier is given a new identifier will be generated.
   *
   * @param [old] the old identifier to get the new identifier for.
   *
   * @return the new identifier.
   */


  getId(old) {
    // return existing old identifier
    if (old && old in this.existing) {
      return this.existing[old];
    } // get next identifier


    const identifier = this.prefix + this.counter;
    this.counter += 1; // save mapping

    if (old) {
      this.existing[old] = identifier;
    }

    return identifier;
  }
  /**
   * Returns true if the given old identifer has already been assigned a new
   * identifier.
   *
   * @param old the old identifier to check.
   *
   * @return true if the old identifier has been assigned a new identifier, false
   *   if not.
   */


  hasId(old) {
    return old in this.existing;
  }

};

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const JsonLdError = __webpack_require__(2);

const {
  isArray: _isArray,
  isObject: _isObject,
  isEmptyObject: _isEmptyObject,
  isString: _isString
} = __webpack_require__(1);

const {
  isList: _isList,
  isValue: _isValue,
  isGraph: _isGraph
} = __webpack_require__(5);

const {
  expandIri: _expandIri,
  getContextValue: _getContextValue,
  isKeyword: _isKeyword,
  process: _processContext
} = __webpack_require__(3);

const {
  isAbsolute: _isAbsoluteIri
} = __webpack_require__(4);

const {
  addValue: _addValue,
  asArray: _asArray,
  getValues: _getValues,
  validateTypeValue: _validateTypeValue
} = __webpack_require__(0);

const api = {};
module.exports = api;

/**
 * Recursively expands an element using the given context. Any context in
 * the element will be removed. All context URLs must have been retrieved
 * before calling this method.
 *
 * @param activeCtx the context to use.
 * @param activeProperty the property for the element, null for none.
 * @param element the element to expand.
 * @param options the expansion options.
 * @param insideList true if the element is a list, false if not.
 * @param expansionMap(info) a function that can be used to custom map
 *          unmappable values (or to throw an error when they are detected);
 *          if this function returns `undefined` then the default behavior
 *          will be used.
 *
 * @return a Promise that resolves to the expanded value.
 */
api.expand = ({
  activeCtx,
  activeProperty = null,
  element,
  options = {},
  insideList = false,
  expansionMap = () => undefined
}) => {
  // nothing to expand
  if(element === null || element === undefined) {
    return null;
  }

  // disable framing if activeProperty is @default
  if(activeProperty === '@default') {
    options = Object.assign({}, options, {isFrame: false});
  }

  if(!_isArray(element) && !_isObject(element)) {
    // drop free-floating scalars that are not in lists unless custom mapped
    if(!insideList && (activeProperty === null ||
      _expandIri(activeCtx, activeProperty, {vocab: true}) === '@graph')) {
      // TODO: use `await` to support async
      const mapped = expansionMap({
        unmappedValue: element,
        activeCtx,
        activeProperty,
        options,
        insideList
      });
      if(mapped === undefined) {
        return null;
      }
      return mapped;
    }

    // expand element according to value expansion rules
    return _expandValue({activeCtx, activeProperty, value: element});
  }

  // recursively expand array
  if(_isArray(element)) {
    let rval = [];
    const container = _getContextValue(
      activeCtx, activeProperty, '@container') || [];
    insideList = insideList || container.includes('@list');
    for(let i = 0; i < element.length; ++i) {
      // expand element
      let e = api.expand({
        activeCtx,
        activeProperty,
        element: element[i],
        options,
        expansionMap
      });
      if(insideList && (_isArray(e) || _isList(e))) {
        // lists of lists are illegal
        throw new JsonLdError(
          'Invalid JSON-LD syntax; lists of lists are not permitted.',
          'jsonld.SyntaxError', {code: 'list of lists'});
      }

      if(e === null) {
        // TODO: add `await` for async support
        e = expansionMap({
          unmappedValue: element[i],
          activeCtx,
          activeProperty,
          parent: element,
          index: i,
          options,
          expandedParent: rval,
          insideList
        });
        if(e === undefined) {
          continue;
        }
      }

      if(_isArray(e)) {
        rval = rval.concat(e);
      } else {
        rval.push(e);
      }
    }
    return rval;
  }

  // recursively expand object:

  // if element has a context, process it
  if('@context' in element) {
    activeCtx = _processContext(
      {activeCtx, localCtx: element['@context'], options});
  }

  // look for scoped context on @type
  let keys = Object.keys(element).sort();
  for(const key of keys) {
    const expandedProperty = _expandIri(activeCtx, key, {vocab: true});
    if(expandedProperty === '@type') {
      // set scopped contexts from @type
      // avoid sorting if possible
      const value = element[key];
      const types =
        Array.isArray(value) ?
          (value.length > 1 ? value.slice().sort() : value) : [value];
      for(const type of types) {
        const ctx = _getContextValue(activeCtx, type, '@context');
        if(ctx) {
          activeCtx = _processContext({activeCtx, localCtx: ctx, options});
        }
      }
    }
  }

  // expand the active property
  const expandedActiveProperty = _expandIri(
    activeCtx, activeProperty, {vocab: true});

  // process each key and value in element, ignoring @nest content
  let rval = {};
  _expandObject({
    activeCtx,
    activeProperty,
    expandedActiveProperty,
    element,
    expandedParent: rval,
    options,
    insideList,
    expansionMap});

  // get property count on expanded output
  keys = Object.keys(rval);
  let count = keys.length;

  if('@value' in rval) {
    // @value must only have @language or @type
    if('@type' in rval && '@language' in rval) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; an element containing "@value" may not ' +
        'contain both "@type" and "@language".',
        'jsonld.SyntaxError', {code: 'invalid value object', element: rval});
    }
    let validCount = count - 1;
    if('@type' in rval) {
      validCount -= 1;
    }
    if('@index' in rval) {
      validCount -= 1;
    }
    if('@language' in rval) {
      validCount -= 1;
    }
    if(validCount !== 0) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; an element containing "@value" may only ' +
        'have an "@index" property and at most one other property ' +
        'which can be "@type" or "@language".',
        'jsonld.SyntaxError', {code: 'invalid value object', element: rval});
    }
    const values = rval['@value'] === null ? [] : _asArray(rval['@value']);
    const types = _getValues(rval, '@type');

    // drop null @values unless custom mapped
    if(values.length === 0) {
      // TODO: use `await` to support async
      const mapped = expansionMap({
        unmappedValue: rval,
        activeCtx,
        activeProperty,
        element,
        options,
        insideList
      });
      if(mapped !== undefined) {
        rval = mapped;
      } else {
        rval = null;
      }
    } else if(!values.every(v => (_isString(v) || _isEmptyObject(v))) &&
      '@language' in rval) {
      // if @language is present, @value must be a string
      throw new JsonLdError(
        'Invalid JSON-LD syntax; only strings may be language-tagged.',
        'jsonld.SyntaxError',
        {code: 'invalid language-tagged value', element: rval});
    } else if(!types.every(t =>
      (_isAbsoluteIri(t) && !(_isString(t) && t.indexOf('_:') === 0) ||
      _isEmptyObject(t)))) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; an element containing "@value" and "@type" ' +
        'must have an absolute IRI for the value of "@type".',
        'jsonld.SyntaxError', {code: 'invalid typed value', element: rval});
    }
  } else if('@type' in rval && !_isArray(rval['@type'])) {
    // convert @type to an array
    rval['@type'] = [rval['@type']];
  } else if('@set' in rval || '@list' in rval) {
    // handle @set and @list
    if(count > 1 && !(count === 2 && '@index' in rval)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; if an element has the property "@set" ' +
        'or "@list", then it can have at most one other property that is ' +
        '"@index".', 'jsonld.SyntaxError',
        {code: 'invalid set or list object', element: rval});
    }
    // optimize away @set
    if('@set' in rval) {
      rval = rval['@set'];
      keys = Object.keys(rval);
      count = keys.length;
    }
  } else if(count === 1 && '@language' in rval) {
    // drop objects with only @language unless custom mapped
    // TODO: use `await` to support async
    const mapped = expansionMap(rval, {
      unmappedValue: rval,
      activeCtx,
      activeProperty,
      element,
      options,
      insideList
    });
    if(mapped !== undefined) {
      rval = mapped;
    } else {
      rval = null;
    }
  }

  // drop certain top-level objects that do not occur in lists, unless custom
  // mapped
  if(_isObject(rval) &&
    !options.keepFreeFloatingNodes && !insideList &&
    (activeProperty === null || expandedActiveProperty === '@graph')) {
    // drop empty object, top-level @value/@list, or object with only @id
    if(count === 0 || '@value' in rval || '@list' in rval ||
      (count === 1 && '@id' in rval)) {
      // TODO: use `await` to support async
      const mapped = expansionMap({
        unmappedValue: rval,
        activeCtx,
        activeProperty,
        element,
        options,
        insideList
      });
      if(mapped !== undefined) {
        rval = mapped;
      } else {
        rval = null;
      }
    }
  }

  return rval;
};

/**
 * Expand each key and value of element adding to result
 *
 * @param activeCtx the context to use.
 * @param activeProperty the property for the element.
 * @param expandedActiveProperty the expansion of activeProperty
 * @param element the element to expand.
 * @param expandedParent the expanded result into which to add values.
 * @param options the expansion options.
 * @param insideList true if the element is a list, false if not.
 * @param expansionMap(info) a function that can be used to custom map
 *          unmappable values (or to throw an error when they are detected);
 *          if this function returns `undefined` then the default behavior
 *          will be used.
 */
function _expandObject({
  activeCtx,
  activeProperty,
  expandedActiveProperty,
  element,
  expandedParent,
  options = {},
  insideList,
  expansionMap
}) {
  const keys = Object.keys(element).sort();
  const nests = [];
  for(const key of keys) {
    let value = element[key];
    let expandedValue;

    // skip @context
    if(key === '@context') {
      continue;
    }

    // expand property
    let expandedProperty = _expandIri(activeCtx, key, {vocab: true});

    // drop non-absolute IRI keys that aren't keywords unless custom mapped
    if(expandedProperty === null ||
      !(_isAbsoluteIri(expandedProperty) || _isKeyword(expandedProperty))) {
      // TODO: use `await` to support async
      expandedProperty = expansionMap({
        unmappedProperty: key,
        activeCtx,
        activeProperty,
        parent: element,
        options,
        insideList,
        value,
        expandedParent
      });
      if(expandedProperty === undefined) {
        continue;
      }
    }

    if(_isKeyword(expandedProperty)) {
      if(expandedActiveProperty === '@reverse') {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; a keyword cannot be used as a @reverse ' +
          'property.', 'jsonld.SyntaxError',
          {code: 'invalid reverse property map', value});
      }
      if(expandedProperty in expandedParent) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; colliding keywords detected.',
          'jsonld.SyntaxError',
          {code: 'colliding keywords', keyword: expandedProperty});
      }
    }

    // syntax error if @id is not a string
    if(expandedProperty === '@id') {
      if(!_isString(value)) {
        if(!options.isFrame) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; "@id" value must a string.',
            'jsonld.SyntaxError', {code: 'invalid @id value', value});
        }
        if(_isObject(value)) {
          // empty object is a wildcard
          if(!_isEmptyObject(value)) {
            throw new JsonLdError(
              'Invalid JSON-LD syntax; "@id" value an empty object or array ' +
              'of strings, if framing',
              'jsonld.SyntaxError', {code: 'invalid @id value', value});
          }
        } else if(_isArray(value)) {
          if(!value.every(v => _isString(v))) {
            throw new JsonLdError(
              'Invalid JSON-LD syntax; "@id" value an empty object or array ' +
              'of strings, if framing',
              'jsonld.SyntaxError', {code: 'invalid @id value', value});
          }
        } else {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; "@id" value an empty object or array ' +
            'of strings, if framing',
            'jsonld.SyntaxError', {code: 'invalid @id value', value});
        }
      }

      _addValue(
        expandedParent, '@id',
        _asArray(value).map(v =>
          _isString(v) ? _expandIri(activeCtx, v, {base: true}) : v),
        {propertyIsArray: options.isFrame});
      continue;
    }

    if(expandedProperty === '@type') {
      _validateTypeValue(value);
      _addValue(
        expandedParent, '@type',
        _asArray(value).map(v =>
          _isString(v) ?
            _expandIri(activeCtx, v, {base: true, vocab: true}) : v),
        {propertyIsArray: options.isFrame});
      continue;
    }

    // @graph must be an array or an object
    if(expandedProperty === '@graph' &&
      !(_isObject(value) || _isArray(value))) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; "@graph" value must not be an ' +
        'object or an array.',
        'jsonld.SyntaxError', {code: 'invalid @graph value', value});
    }

    // @value must not be an object or an array (unless framing)
    if(expandedProperty === '@value') {
      if((_isObject(value) || _isArray(value)) && !options.isFrame) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; "@value" value must not be an ' +
          'object or an array.',
          'jsonld.SyntaxError',
          {code: 'invalid value object value', value});
      }

      _addValue(
        expandedParent, '@value', value, {propertyIsArray: options.isFrame});
      continue;
    }

    // @language must be a string
    if(expandedProperty === '@language') {
      if(value === null) {
        // drop null @language values, they expand as if they didn't exist
        continue;
      }
      if(!_isString(value) && !options.isFrame) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; "@language" value must be a string.',
          'jsonld.SyntaxError',
          {code: 'invalid language-tagged string', value});
      }
      // ensure language value is lowercase
      value = _asArray(value).map(v => _isString(v) ? v.toLowerCase() : v);

      _addValue(
        expandedParent, '@language', value, {propertyIsArray: options.isFrame});
      continue;
    }

    // @index must be a string
    if(expandedProperty === '@index') {
      if(!_isString(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; "@index" value must be a string.',
          'jsonld.SyntaxError',
          {code: 'invalid @index value', value});
      }
      _addValue(expandedParent, '@index', value);
      continue;
    }

    // @reverse must be an object
    if(expandedProperty === '@reverse') {
      if(!_isObject(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; "@reverse" value must be an object.',
          'jsonld.SyntaxError', {code: 'invalid @reverse value', value});
      }

      expandedValue = api.expand({
        activeCtx,
        activeProperty:
        '@reverse',
        element: value,
        options,
        expansionMap
      });
      // properties double-reversed
      if('@reverse' in expandedValue) {
        for(const property in expandedValue['@reverse']) {
          _addValue(
            expandedParent, property, expandedValue['@reverse'][property],
            {propertyIsArray: true});
        }
      }

      // FIXME: can this be merged with code below to simplify?
      // merge in all reversed properties
      let reverseMap = expandedParent['@reverse'] || null;
      for(const property in expandedValue) {
        if(property === '@reverse') {
          continue;
        }
        if(reverseMap === null) {
          reverseMap = expandedParent['@reverse'] = {};
        }
        _addValue(reverseMap, property, [], {propertyIsArray: true});
        const items = expandedValue[property];
        for(let ii = 0; ii < items.length; ++ii) {
          const item = items[ii];
          if(_isValue(item) || _isList(item)) {
            throw new JsonLdError(
              'Invalid JSON-LD syntax; "@reverse" value must not be a ' +
              '@value or an @list.', 'jsonld.SyntaxError',
              {code: 'invalid reverse property value', value: expandedValue});
          }
          _addValue(reverseMap, property, item, {propertyIsArray: true});
        }
      }

      continue;
    }

    // nested keys
    if(expandedProperty === '@nest') {
      nests.push(key);
      continue;
    }

    // use potential scoped context for key
    let termCtx = activeCtx;
    const ctx = _getContextValue(activeCtx, key, '@context');
    if(ctx) {
      termCtx = _processContext({activeCtx, localCtx: ctx, options});
    }

    const container = _getContextValue(termCtx, key, '@container') || [];

    if(container.includes('@language') && _isObject(value)) {
      // handle language map container (skip if value is not an object)
      expandedValue = _expandLanguageMap(termCtx, value);
    } else if(container.includes('@index') && _isObject(value)) {
      // handle index container (skip if value is not an object)
      const asGraph = container.includes('@graph');
      expandedValue = _expandIndexMap({
        activeCtx: termCtx,
        options,
        activeProperty: key,
        value,
        expansionMap,
        asGraph,
        indexKey: '@index'
      });
    } else if(container.includes('@id') && _isObject(value)) {
      // handle id container (skip if value is not an object)
      const asGraph = container.includes('@graph');
      expandedValue = _expandIndexMap({
        activeCtx: termCtx,
        options,
        activeProperty: key,
        value,
        expansionMap,
        asGraph,
        indexKey: '@id'
      });
    } else if(container.includes('@type') && _isObject(value)) {
      // handle type container (skip if value is not an object)
      expandedValue = _expandIndexMap({
        activeCtx: termCtx,
        options,
        activeProperty: key,
        value,
        expansionMap,
        asGraph: false,
        indexKey: '@type'
      });
    } else {
      // recurse into @list or @set
      const isList = (expandedProperty === '@list');
      if(isList || expandedProperty === '@set') {
        let nextActiveProperty = activeProperty;
        if(isList && expandedActiveProperty === '@graph') {
          nextActiveProperty = null;
        }
        expandedValue = api.expand({
          activeCtx: termCtx,
          activeProperty: nextActiveProperty,
          element: value,
          options,
          insideList: isList,
          expansionMap
        });
        if(isList && _isList(expandedValue)) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; lists of lists are not permitted.',
            'jsonld.SyntaxError', {code: 'list of lists'});
        }
      } else {
        // recursively expand value with key as new active property
        expandedValue = api.expand({
          activeCtx: termCtx,
          activeProperty: key,
          element: value,
          options,
          insideList: false,
          expansionMap
        });
      }
    }

    // drop null values if property is not @value
    if(expandedValue === null && expandedProperty !== '@value') {
      // TODO: use `await` to support async
      expandedValue = expansionMap({
        unmappedValue: value,
        expandedProperty,
        activeCtx: termCtx,
        activeProperty,
        parent: element,
        options,
        insideList,
        key,
        expandedParent
      });
      if(expandedValue === undefined) {
        continue;
      }
    }

    // convert expanded value to @list if container specifies it
    if(expandedProperty !== '@list' && !_isList(expandedValue) &&
      container.includes('@list')) {
      // ensure expanded value in @list is an array
      expandedValue = {'@list': _asArray(expandedValue)};
    }

    // convert expanded value to @graph if container specifies it
    // and value is not, itself, a graph
    // index cases handled above
    if(container.includes('@graph') &&
      !container.some(key => key === '@id' || key === '@index')) {
      // ensure expanded values are arrays
      expandedValue = _asArray(expandedValue)
        .map(v => _isGraph(v) ? v : {'@graph': _asArray(v)});
    }

    // FIXME: can this be merged with code above to simplify?
    // merge in reverse properties
    if(termCtx.mappings[key] && termCtx.mappings[key].reverse) {
      const reverseMap =
        expandedParent['@reverse'] = expandedParent['@reverse'] || {};
      expandedValue = _asArray(expandedValue);
      for(let ii = 0; ii < expandedValue.length; ++ii) {
        const item = expandedValue[ii];
        if(_isValue(item) || _isList(item)) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; "@reverse" value must not be a ' +
            '@value or an @list.', 'jsonld.SyntaxError',
            {code: 'invalid reverse property value', value: expandedValue});
        }
        _addValue(reverseMap, expandedProperty, item, {propertyIsArray: true});
      }
      continue;
    }

    // add value for property
    // use an array except for certain keywords
    const useArray =
      !['@index', '@id', '@type', '@value', '@language']
        .includes(expandedProperty);
    _addValue(expandedParent, expandedProperty, expandedValue, {
      propertyIsArray: useArray
    });
  }

  // expand each nested key
  for(const key of nests) {
    const nestedValues = _isArray(element[key]) ? element[key] : [element[key]];
    for(const nv of nestedValues) {
      if(!_isObject(nv) || Object.keys(nv).some(k =>
        _expandIri(activeCtx, k, {vocab: true}) === '@value')) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; nested value must be a node object.',
          'jsonld.SyntaxError',
          {code: 'invalid @nest value', value: nv});
      }
      _expandObject({
        activeCtx,
        activeProperty,
        expandedActiveProperty,
        element: nv,
        expandedParent,
        options,
        insideList,
        expansionMap});
    }
  }
}

/**
 * Expands the given value by using the coercion and keyword rules in the
 * given context.
 *
 * @param activeCtx the active context to use.
 * @param activeProperty the active property the value is associated with.
 * @param value the value to expand.
 *
 * @return the expanded value.
 */
function _expandValue({activeCtx, activeProperty, value}) {
  // nothing to expand
  if(value === null || value === undefined) {
    return null;
  }

  // special-case expand @id and @type (skips '@id' expansion)
  const expandedProperty = _expandIri(activeCtx, activeProperty, {vocab: true});
  if(expandedProperty === '@id') {
    return _expandIri(activeCtx, value, {base: true});
  } else if(expandedProperty === '@type') {
    return _expandIri(activeCtx, value, {vocab: true, base: true});
  }

  // get type definition from context
  const type = _getContextValue(activeCtx, activeProperty, '@type');

  // do @id expansion (automatic for @graph)
  if((type === '@id' || expandedProperty === '@graph') && _isString(value)) {
    return {'@id': _expandIri(activeCtx, value, {base: true})};
  }
  // do @id expansion w/vocab
  if(type === '@vocab' && _isString(value)) {
    return {'@id': _expandIri(activeCtx, value, {vocab: true, base: true})};
  }

  // do not expand keyword values
  if(_isKeyword(expandedProperty)) {
    return value;
  }

  const rval = {};

  if(type && !['@id', '@vocab'].includes(type)) {
    // other type
    rval['@type'] = type;
  } else if(_isString(value)) {
    // check for language tagging for strings
    const language = _getContextValue(activeCtx, activeProperty, '@language');
    if(language !== null) {
      rval['@language'] = language;
    }
  }
  // do conversion of values that aren't basic JSON types to strings
  if(!['boolean', 'number', 'string'].includes(typeof value)) {
    value = value.toString();
  }
  rval['@value'] = value;

  return rval;
}

/**
 * Expands a language map.
 *
 * @param activeCtx the active context to use.
 * @param languageMap the language map to expand.
 *
 * @return the expanded language map.
 */
function _expandLanguageMap(activeCtx, languageMap) {
  const rval = [];
  const keys = Object.keys(languageMap).sort();
  for(const key of keys) {
    const expandedKey = _expandIri(activeCtx, key, {vocab: true});
    let val = languageMap[key];
    if(!_isArray(val)) {
      val = [val];
    }
    for(const item of val) {
      if(item === null) {
        // null values are allowed (8.5) but ignored (3.1)
        continue;
      }
      if(!_isString(item)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; language map values must be strings.',
          'jsonld.SyntaxError',
          {code: 'invalid language map value', languageMap});
      }
      const val = {'@value': item};
      if(expandedKey !== '@none') {
        val['@language'] = key.toLowerCase();
      }
      rval.push(val);
    }
  }
  return rval;
}

function _expandIndexMap(
  {activeCtx, options, activeProperty, value, expansionMap, asGraph,
    indexKey}) {
  const rval = [];
  const keys = Object.keys(value).sort();
  for(let key of keys) {
    // if indexKey is @type, there may be a context defined for it
    const ctx = _getContextValue(activeCtx, key, '@context');
    if(ctx) {
      activeCtx = _processContext({activeCtx, localCtx: ctx, options});
    }

    let val = value[key];
    if(!_isArray(val)) {
      val = [val];
    }

    // expand for @type, but also for @none
    const expandedKey = _expandIri(activeCtx, key, {vocab: true});
    if(indexKey === '@id') {
      // expand document relative
      key = _expandIri(activeCtx, key, {base: true});
    } else if(indexKey === '@type') {
      key = expandedKey;
    }

    val = api.expand({
      activeCtx,
      activeProperty,
      element: val,
      options,
      insideList: false,
      expansionMap
    });
    for(let item of val) {
      // If this is also a @graph container, turn items into graphs
      if(asGraph && !_isGraph(item)) {
        item = {'@graph': [item]};
      }
      if(indexKey === '@type') {
        if(expandedKey === '@none') {
          // ignore @none
        } else if(item['@type']) {
          item['@type'] = [key].concat(item['@type']);
        } else {
          item['@type'] = [key];
        }
      } else if(expandedKey !== '@none' && !(indexKey in item)) {
        item[indexKey] = key;
      }
      rval.push(item);
    }
  }
  return rval;
}


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */


const {clone} = __webpack_require__(0);

module.exports = class ActiveContextCache {
  /**
   * Creates an active context cache.
   *
   * @param size the maximum size of the cache.
   */
  constructor(size = 100) {
    this.order = [];
    this.cache = new Map();
    this.size = size;
  }

  get(activeCtx, localCtx) {
    const level1 = this.cache.get(activeCtx);
    if(level1) {
      const key = JSON.stringify(localCtx);
      const result = level1.get(key);
      return result || null;
    }
    return null;
  }

  set(activeCtx, localCtx, result) {
    if(this.order.length === this.size) {
      const entry = this.order.shift();
      this.cache.get(entry.activeCtx).delete(entry.localCtx);
    }
    const key = JSON.stringify(localCtx);
    this.order.push({activeCtx, localCtx: key});
    let level1 = this.cache.get(activeCtx);
    if(!level1) {
      level1 = new Map();
      this.cache.set(activeCtx, level1);
    }
    level1.set(key, clone(result));
  }
};


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const {createNodeMap} = __webpack_require__(12);
const {isKeyword} = __webpack_require__(3);
const graphTypes = __webpack_require__(5);
const types = __webpack_require__(1);
const util = __webpack_require__(0);

const {
  // RDF,
  // RDF_LIST,
  RDF_FIRST,
  RDF_REST,
  RDF_NIL,
  RDF_TYPE,
  // RDF_PLAIN_LITERAL,
  // RDF_XML_LITERAL,
  // RDF_OBJECT,
  RDF_LANGSTRING,

  // XSD,
  XSD_BOOLEAN,
  XSD_DOUBLE,
  XSD_INTEGER,
  XSD_STRING,
} = __webpack_require__(13);

const {
  isAbsolute: _isAbsoluteIri
} = __webpack_require__(4);

const api = {};
module.exports = api;

/**
 * Outputs an RDF dataset for the expanded JSON-LD input.
 *
 * @param input the expanded JSON-LD input.
 * @param options the RDF serialization options.
 *
 * @return the RDF dataset.
 */
api.toRDF = (input, options) => {
  // create node map for default graph (and any named graphs)
  const issuer = new util.IdentifierIssuer('_:b');
  const nodeMap = {'@default': {}};
  createNodeMap(input, nodeMap, '@default', issuer);

  const dataset = [];
  const graphNames = Object.keys(nodeMap).sort();
  for(const graphName of graphNames) {
    let graphTerm;
    if(graphName === '@default') {
      graphTerm = {termType: 'DefaultGraph', value: ''};
    } else if(_isAbsoluteIri(graphName)) {
      if(graphName.startsWith('_:')) {
        graphTerm = {termType: 'BlankNode'};
      } else {
        graphTerm = {termType: 'NamedNode'};
      }
      graphTerm.value = graphName;
    } else {
      // skip relative IRIs (not valid RDF)
      continue;
    }
    _graphToRDF(dataset, nodeMap[graphName], graphTerm, issuer, options);
  }

  return dataset;
};

/**
 * Adds RDF quads for a particular graph to the given dataset.
 *
 * @param dataset the dataset to append RDF quads to.
 * @param graph the graph to create RDF quads for.
 * @param graphTerm the graph term for each quad.
 * @param issuer a IdentifierIssuer for assigning blank node names.
 * @param options the RDF serialization options.
 *
 * @return the array of RDF triples for the given graph.
 */
function _graphToRDF(dataset, graph, graphTerm, issuer, options) {
  const ids = Object.keys(graph).sort();
  for(let i = 0; i < ids.length; ++i) {
    const id = ids[i];
    const node = graph[id];
    const properties = Object.keys(node).sort();
    for(let property of properties) {
      const items = node[property];
      if(property === '@type') {
        property = RDF_TYPE;
      } else if(isKeyword(property)) {
        continue;
      }

      for(const item of items) {
        // RDF subject
        const subject = {
          termType: id.startsWith('_:') ? 'BlankNode' : 'NamedNode',
          value: id
        };

        // skip relative IRI subjects (not valid RDF)
        if(!_isAbsoluteIri(id)) {
          continue;
        }

        // RDF predicate
        const predicate = {
          termType: property.startsWith('_:') ? 'BlankNode' : 'NamedNode',
          value: property
        };

        // skip relative IRI predicates (not valid RDF)
        if(!_isAbsoluteIri(property)) {
          continue;
        }

        // skip blank node predicates unless producing generalized RDF
        if(predicate.termType === 'BlankNode' &&
          !options.produceGeneralizedRdf) {
          continue;
        }

        // convert @list to triples
        if(graphTypes.isList(item)) {
          _listToRDF(
            item['@list'], issuer, subject, predicate, dataset, graphTerm);
        } else {
          // convert value or node object to triple
          const object = _objectToRDF(item);
          // skip null objects (they are relative IRIs)
          if(object) {
            dataset.push({
              subject,
              predicate,
              object,
              graph: graphTerm
            });
          }
        }
      }
    }
  }
}

/**
 * Converts a @list value into linked list of blank node RDF quads
 * (an RDF collection).
 *
 * @param list the @list value.
 * @param issuer a IdentifierIssuer for assigning blank node names.
 * @param subject the subject for the head of the list.
 * @param predicate the predicate for the head of the list.
 * @param dataset the array of quads to append to.
 * @param graphTerm the graph term for each quad.
 */
function _listToRDF(list, issuer, subject, predicate, dataset, graphTerm) {
  const first = {termType: 'NamedNode', value: RDF_FIRST};
  const rest = {termType: 'NamedNode', value: RDF_REST};
  const nil = {termType: 'NamedNode', value: RDF_NIL};

  for(const item of list) {
    const blankNode = {termType: 'BlankNode', value: issuer.getId()};
    dataset.push({
      subject,
      predicate,
      object: blankNode,
      graph: graphTerm
    });

    subject = blankNode;
    predicate = first;
    const object = _objectToRDF(item);

    // skip null objects (they are relative IRIs)
    if(object) {
      dataset.push({
        subject,
        predicate,
        object,
        graph: graphTerm
      });
    }

    predicate = rest;
  }

  dataset.push({
    subject,
    predicate,
    object: nil,
    graph: graphTerm
  });
}

/**
 * Converts a JSON-LD value object to an RDF literal or a JSON-LD string or
 * node object to an RDF resource.
 *
 * @param item the JSON-LD value or node object.
 *
 * @return the RDF literal or RDF resource.
 */
function _objectToRDF(item) {
  const object = {};

  // convert value object to RDF
  if(graphTypes.isValue(item)) {
    object.termType = 'Literal';
    object.value = undefined;
    object.datatype = {
      termType: 'NamedNode'
    };
    let value = item['@value'];
    const datatype = item['@type'] || null;

    // convert to XSD datatypes as appropriate
    if(types.isBoolean(value)) {
      object.value = value.toString();
      object.datatype.value = datatype || XSD_BOOLEAN;
    } else if(types.isDouble(value) || datatype === XSD_DOUBLE) {
      if(!types.isDouble(value)) {
        value = parseFloat(value);
      }
      // canonical double representation
      object.value = value.toExponential(15).replace(/(\d)0*e\+?/, '$1E');
      object.datatype.value = datatype || XSD_DOUBLE;
    } else if(types.isNumber(value)) {
      object.value = value.toFixed(0);
      object.datatype.value = datatype || XSD_INTEGER;
    } else if('@language' in item) {
      object.value = value;
      object.datatype.value = datatype || RDF_LANGSTRING;
      object.language = item['@language'];
    } else {
      object.value = value;
      object.datatype.value = datatype || XSD_STRING;
    }
  } else {
    // convert string/node object to RDF
    const id = types.isObject(item) ? item['@id'] : item;
    object.termType = id.startsWith('_:') ? 'BlankNode' : 'NamedNode';
    object.value = id;
  }

  // skip relative IRIs, not valid RDF
  if(object.termType === 'NamedNode' && !_isAbsoluteIri(object.value)) {
    return null;
  }

  return object;
}


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const {isKeyword} = __webpack_require__(3);
const graphTypes = __webpack_require__(5);
const types = __webpack_require__(1);
const util = __webpack_require__(0);
const JsonLdError = __webpack_require__(2);

const api = {};
module.exports = api;

/**
 * Creates a merged JSON-LD node map (node ID => node).
 *
 * @param input the expanded JSON-LD to create a node map of.
 * @param [options] the options to use:
 *          [issuer] a jsonld.IdentifierIssuer to use to label blank nodes.
 *
 * @return the node map.
 */
api.createMergedNodeMap = (input, options) => {
  options = options || {};

  // produce a map of all subjects and name each bnode
  const issuer = options.issuer || new util.IdentifierIssuer('_:b');
  const graphs = {'@default': {}};
  api.createNodeMap(input, graphs, '@default', issuer);

  // add all non-default graphs to default graph
  return api.mergeNodeMaps(graphs);
};

/**
 * Recursively flattens the subjects in the given JSON-LD expanded input
 * into a node map.
 *
 * @param input the JSON-LD expanded input.
 * @param graphs a map of graph name to subject map.
 * @param graph the name of the current graph.
 * @param issuer the blank node identifier issuer.
 * @param name the name assigned to the current input if it is a bnode.
 * @param list the list to append to, null for none.
 */
api.createNodeMap = (input, graphs, graph, issuer, name, list) => {
  // recurse through array
  if(types.isArray(input)) {
    for(let i = 0; i < input.length; ++i) {
      api.createNodeMap(input[i], graphs, graph, issuer, undefined, list);
    }
    return;
  }

  // add non-object to list
  if(!types.isObject(input)) {
    if(list) {
      list.push(input);
    }
    return;
  }

  // add values to list
  if(graphTypes.isValue(input)) {
    if('@type' in input) {
      let type = input['@type'];
      // rename @type blank node
      if(type.indexOf('_:') === 0) {
        input['@type'] = type = issuer.getId(type);
      }
    }
    if(list) {
      list.push(input);
    }
    return;
  }

  // Note: At this point, input must be a subject.

  // spec requires @type to be named first, so assign names early
  if('@type' in input) {
    const types = input['@type'];
    for(let i = 0; i < types.length; ++i) {
      const type = types[i];
      if(type.indexOf('_:') === 0) {
        issuer.getId(type);
      }
    }
  }

  // get name for subject
  if(types.isUndefined(name)) {
    name = graphTypes.isBlankNode(input) ?
      issuer.getId(input['@id']) : input['@id'];
  }

  // add subject reference to list
  if(list) {
    list.push({'@id': name});
  }

  // create new subject or merge into existing one
  const subjects = graphs[graph];
  const subject = subjects[name] = subjects[name] || {};
  subject['@id'] = name;
  const properties = Object.keys(input).sort();
  for(let pi = 0; pi < properties.length; ++pi) {
    let property = properties[pi];

    // skip @id
    if(property === '@id') {
      continue;
    }

    // handle reverse properties
    if(property === '@reverse') {
      const referencedNode = {'@id': name};
      const reverseMap = input['@reverse'];
      for(const reverseProperty in reverseMap) {
        const items = reverseMap[reverseProperty];
        for(let ii = 0; ii < items.length; ++ii) {
          const item = items[ii];
          let itemName = item['@id'];
          if(graphTypes.isBlankNode(item)) {
            itemName = issuer.getId(itemName);
          }
          api.createNodeMap(item, graphs, graph, issuer, itemName);
          util.addValue(
            subjects[itemName], reverseProperty, referencedNode,
            {propertyIsArray: true, allowDuplicate: false});
        }
      }
      continue;
    }

    // recurse into graph
    if(property === '@graph') {
      // add graph subjects map entry
      if(!(name in graphs)) {
        graphs[name] = {};
      }
      api.createNodeMap(input[property], graphs, name, issuer);
      continue;
    }

    // copy non-@type keywords
    if(property !== '@type' && isKeyword(property)) {
      if(property === '@index' && property in subject &&
        (input[property] !== subject[property] ||
        input[property]['@id'] !== subject[property]['@id'])) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; conflicting @index property detected.',
          'jsonld.SyntaxError',
          {code: 'conflicting indexes', subject});
      }
      subject[property] = input[property];
      continue;
    }

    // iterate over objects
    const objects = input[property];

    // if property is a bnode, assign it a new id
    if(property.indexOf('_:') === 0) {
      property = issuer.getId(property);
    }

    // ensure property is added for empty arrays
    if(objects.length === 0) {
      util.addValue(subject, property, [], {propertyIsArray: true});
      continue;
    }
    for(let oi = 0; oi < objects.length; ++oi) {
      let o = objects[oi];

      if(property === '@type') {
        // rename @type blank nodes
        o = (o.indexOf('_:') === 0) ? issuer.getId(o) : o;
      }

      // handle embedded subject or subject reference
      if(graphTypes.isSubject(o) || graphTypes.isSubjectReference(o)) {
        // relabel blank node @id
        const id = graphTypes.isBlankNode(o) ?
          issuer.getId(o['@id']) : o['@id'];

        // add reference and recurse
        util.addValue(
          subject, property, {'@id': id},
          {propertyIsArray: true, allowDuplicate: false});
        api.createNodeMap(o, graphs, graph, issuer, id);
      } else if(graphTypes.isList(o)) {
        // handle @list
        const _list = [];
        api.createNodeMap(o['@list'], graphs, graph, issuer, name, _list);
        o = {'@list': _list};
        util.addValue(
          subject, property, o,
          {propertyIsArray: true, allowDuplicate: false});
      } else {
        // handle @value
        api.createNodeMap(o, graphs, graph, issuer, name);
        util.addValue(
          subject, property, o, {propertyIsArray: true, allowDuplicate: false});
      }
    }
  }
};

/**
 * Merge separate named graphs into a single merged graph including
 * all nodes from the default graph and named graphs.
 *
 * @param graphs a map of graph name to subject map.
 *
 * @return the merged graph map.
 */
api.mergeNodeMapGraphs = graphs => {
  const merged = {};
  for(const name of Object.keys(graphs).sort()) {
    for(const id of Object.keys(graphs[name]).sort()) {
      const node = graphs[name][id];
      if(!(id in merged)) {
        merged[id] = {'@id': id};
      }
      const mergedNode = merged[id];

      for(const property of Object.keys(node).sort()) {
        if(isKeyword(property)) {
          // copy keywords
          mergedNode[property] = util.clone(node[property]);
        } else {
          // merge objects
          for(const value of node[property]) {
            util.addValue(
              mergedNode, property, util.clone(value),
              {propertyIsArray: true, allowDuplicate: false});
          }
        }
      }
    }
  }

  return merged;
};

api.mergeNodeMaps = graphs => {
  // add all non-default graphs to default graph
  const defaultGraph = graphs['@default'];
  const graphNames = Object.keys(graphs).sort();
  for(let i = 0; i < graphNames.length; ++i) {
    const graphName = graphNames[i];
    if(graphName === '@default') {
      continue;
    }
    const nodeMap = graphs[graphName];
    let subject = defaultGraph[graphName];
    if(!subject) {
      defaultGraph[graphName] = subject = {
        '@id': graphName,
        '@graph': []
      };
    } else if(!('@graph' in subject)) {
      subject['@graph'] = [];
    }
    const graph = subject['@graph'];
    const ids = Object.keys(nodeMap).sort();
    for(let ii = 0; ii < ids.length; ++ii) {
      const node = nodeMap[ids[ii]];
      // only add full subjects
      if(!graphTypes.isSubjectReference(node)) {
        graph.push(node);
      }
    }
  }
  return defaultGraph;
};


/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

module.exports = {
  LINK_HEADER_REL: 'http://www.w3.org/ns/json-ld#context',

  RDF,
  RDF_LIST: RDF + 'List',
  RDF_FIRST: RDF + 'first',
  RDF_REST: RDF + 'rest',
  RDF_NIL: RDF + 'nil',
  RDF_TYPE: RDF + 'type',
  RDF_PLAIN_LITERAL: RDF + 'PlainLiteral',
  RDF_XML_LITERAL: RDF + 'XMLLiteral',
  RDF_OBJECT: RDF + 'object',
  RDF_LANGSTRING: RDF + 'langString',

  XSD,
  XSD_BOOLEAN: XSD + 'boolean',
  XSD_DOUBLE: XSD + 'double',
  XSD_INTEGER: XSD + 'integer',
  XSD_STRING: XSD + 'string',
};


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */


const {parse: parseUrl} = __webpack_require__(4);

module.exports = class DocumentCache {
  /**
   * Creates a simple document cache that retains documents for a short
   * period of time.
   *
   * FIXME: Implement simple HTTP caching instead.
   *
   * @param options the options to use:
   *          [size] the maximum size of the cache (default: 50).
   *          [expires] expiration time for each entry in ms (default: 30000).
   */
  constructor({size = 50, expires = 30000}) {
    this.order = [];
    this.cache = {};
    this.size = size;
    this.expires = expires;
    this.schema = null;
  }

  get(url) {
    if(parseUrl(url).hostname === 'schema.org') {
      return this.schema;
    }
    if(url in this.cache) {
      const entry = this.cache[url];
      if(entry.expires >= Date.now()) {
        return entry.ctx;
      }
      delete this.cache[url];
      this.order.splice(this.order.indexOf(url), 1);
    }
    return null;
  }

  set(url, ctx) {
    if(parseUrl(url).hostname === 'schema.org') {
      this.schema = ctx;
      return;
    }
    if(this.order.length === this.size) {
      delete this.cache[this.order.shift()];
    }
    this.order.push(url);
    this.cache[url] = {ctx, expires: (Date.now() + this.expires)};
  }
};


/***/ })
/******/ ]);
});