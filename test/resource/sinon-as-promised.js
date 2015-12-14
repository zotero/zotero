(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.sinonAsPromised = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

var Promise = window.Zotero.Promise
var sinon = (window.sinon)
  
function methods (Promise) {
  return ['catch', 'finally'].concat(Object.keys(Promise.prototype)).filter(a => a != 'then');
} 
function createThenable (Promise, resolver) {
  return methods(Promise).reduce(createMethod, {then: then})
  function createMethod (thenable, name) {
    thenable[name] = method(name)
    return thenable
  }
  function method (name) {
    return function () {
      var promise = this.then()
      return promise[name].apply(promise, arguments)
    }
  }
  function then (/*onFulfill, onReject*/) {
    var promise = new Promise(resolver)
    return promise.then.apply(promise, arguments)
  }
} 

function resolves (value) {
  return this.returns(createThenable(Promise, function (resolve) {
    resolve(value)
  }))
}

sinon.stub.resolves = resolves
sinon.behavior.resolves = resolves

function rejects (err) {
  if (typeof err === 'string') {
    err = new Error(err)
  }
  return this.returns(createThenable(Promise, function (resolve, reject) {
    reject(err)
  }))
}

sinon.stub.rejects = rejects
sinon.behavior.rejects = rejects

module.exports = function (_Promise_) {
  if (typeof _Promise_ !== 'function') {
    throw new Error('A Promise constructor must be provided')
  } else {
    Promise = _Promise_
  }
  return sinon
}

},{"create-thenable":7,"native-promise-only":8}],2:[function(require,module,exports){
/*!
 * object.omit <https://github.com/jonschlinkert/object.omit>
 *
 * Copyright (c) 2014-2015 Jon Schlinkert.
 * Licensed under the MIT License
 */

'use strict';

var isObject = require('isobject');
var forOwn = require('for-own');

module.exports = function omit(obj, props) {
  if (obj == null || !isObject(obj)) {
    return {};
  }

  if (props == null) {
    return obj;
  }

  if (typeof props === 'string') {
    props = [].slice.call(arguments, 1);
  }

  var o = {};

  if (!Object.keys(obj).length) {
    return o;
  }

  forOwn(obj, function (value, key) {
    if (props.indexOf(key) === -1) {
      o[key] = value;
    }
  });
  return o;
};
},{"for-own":3,"isobject":5}],3:[function(require,module,exports){
/*!
 * for-own <https://github.com/jonschlinkert/for-own>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

var forIn = require('for-in');
var hasOwn = Object.prototype.hasOwnProperty;

module.exports = function forOwn(o, fn, thisArg) {
  forIn(o, function (val, key) {
    if (hasOwn.call(o, key)) {
      return fn.call(thisArg, o[key], key, o);
    }
  });
};

},{"for-in":4}],4:[function(require,module,exports){
/*!
 * for-in <https://github.com/jonschlinkert/for-in>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

module.exports = function forIn(o, fn, thisArg) {
  for (var key in o) {
    if (fn.call(thisArg, o[key], key, o) === false) {
      break;
    }
  }
};
},{}],5:[function(require,module,exports){
/*!
 * isobject <https://github.com/jonschlinkert/isobject>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT License
 */

'use strict';

/**
 * is the value an object, and not an array?
 *
 * @param  {*} `value`
 * @return {Boolean}
 */

module.exports = function isObject(o) {
  return o != null && typeof o === 'object'
    && !Array.isArray(o);
};
},{}],6:[function(require,module,exports){
'use strict';

/**
 * Concatenates two arrays, removing duplicates in the process and returns one array with unique values.
 * In case the elements in the array don't have a proper built in way to determine their identity,
 * a custom identity function must be provided.
 *
 * As an example, {Object}s all return '[ 'object' ]' when .toString()ed and therefore require a custom
 * identity function.
 *
 * @name exports
 * @function unique-concat
 * @param arr1 {Array} first batch of elements
 * @param arr2 {Array} second batch of elements
 * @param identity {Function} (optional) supply an alternative way to get an element's identity
 */
var go = module.exports = function uniqueConcat(arr1, arr2, identity) {

  if (!arr1 || !arr2) throw new Error('Need two arrays to merge');
  if (!Array.isArray(arr1)) throw new Error('First argument is not an array, but a ' + typeof arr1);
  if (!Array.isArray(arr2)) throw new Error('Second argument is not an array, but a ' + typeof arr2);
  if (identity && typeof identity !== 'function') throw new Error('Third argument should be a function');

  function hashify(acc, k) {
    acc[identity ? identity(k) : k] = k;
    return acc;
  }

  var arr1Hash = arr1.reduce(hashify, {});
  var mergedHash = arr2.reduce(hashify, arr1Hash);

  return Object.keys(mergedHash).map(function (key) { return mergedHash[key]; });
};

},{}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports['default'] = createThenable;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _defineProperty(obj, key, value) { return Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); }

var _uniqueConcat = require('unique-concat');

var _uniqueConcat2 = _interopRequireDefault(_uniqueConcat);

var _objectOmit = require('object-omit');

var _objectOmit2 = _interopRequireDefault(_objectOmit);

'use strict';

function createThenable(Promise, resolver) {
  return methods(Promise).reduce(createMethod, { then: then });
  function createMethod(thenable, name) {
    return _extends(thenable, _defineProperty({}, name, method(name)));
  }
  function method(name) {
    return function () {
      var _then;

      return (_then = this.then())[name].apply(_then, arguments);
    };
  }
  function then() {
    var _ref;

    return (_ref = new Promise(resolver)).then.apply(_ref, arguments);
  }
}

function methods(Promise) {
  return _uniqueConcat2['default'](['catch', 'finally'], Object.keys(_objectOmit2['default'](Promise.prototype, 'then')));
}
module.exports = exports['default'];
/*onFulfill, onReject*/
},{"object-omit":2,"unique-concat":6}],8:[function(require,module,exports){
(function (global){
/*! Native Promise Only
    v0.7.8-a (c) Kyle Simpson
    MIT License: http://getify.mit-license.org
*/
!function(t,n,e){n[t]=n[t]||e(),"undefined"!=typeof module&&module.exports?module.exports=n[t]:"function"==typeof define&&define.amd&&define(function(){return n[t]})}("Promise","undefined"!=typeof global?global:this,function(){"use strict";function t(t,n){l.add(t,n),h||(h=y(l.drain))}function n(t){var n,e=typeof t;return null==t||"object"!=e&&"function"!=e||(n=t.then),"function"==typeof n?n:!1}function e(){for(var t=0;t<this.chain.length;t++)o(this,1===this.state?this.chain[t].success:this.chain[t].failure,this.chain[t]);this.chain.length=0}function o(t,e,o){var r,i;try{e===!1?o.reject(t.msg):(r=e===!0?t.msg:e.call(void 0,t.msg),r===o.promise?o.reject(TypeError("Promise-chain cycle")):(i=n(r))?i.call(r,o.resolve,o.reject):o.resolve(r))}catch(c){o.reject(c)}}function r(o){var c,u,a=this;if(!a.triggered){a.triggered=!0,a.def&&(a=a.def);try{(c=n(o))?(u=new f(a),c.call(o,function(){r.apply(u,arguments)},function(){i.apply(u,arguments)})):(a.msg=o,a.state=1,a.chain.length>0&&t(e,a))}catch(s){i.call(u||new f(a),s)}}}function i(n){var o=this;o.triggered||(o.triggered=!0,o.def&&(o=o.def),o.msg=n,o.state=2,o.chain.length>0&&t(e,o))}function c(t,n,e,o){for(var r=0;r<n.length;r++)!function(r){t.resolve(n[r]).then(function(t){e(r,t)},o)}(r)}function f(t){this.def=t,this.triggered=!1}function u(t){this.promise=t,this.state=0,this.triggered=!1,this.chain=[],this.msg=void 0}function a(n){if("function"!=typeof n)throw TypeError("Not a function");if(0!==this.__NPO__)throw TypeError("Not a promise");this.__NPO__=1;var o=new u(this);this.then=function(n,r){var i={success:"function"==typeof n?n:!0,failure:"function"==typeof r?r:!1};return i.promise=new this.constructor(function(t,n){if("function"!=typeof t||"function"!=typeof n)throw TypeError("Not a function");i.resolve=t,i.reject=n}),o.chain.push(i),0!==o.state&&t(e,o),i.promise},this["catch"]=function(t){return this.then(void 0,t)};try{n.call(void 0,function(t){r.call(o,t)},function(t){i.call(o,t)})}catch(c){i.call(o,c)}}var s,h,l,p=Object.prototype.toString,y="undefined"!=typeof setImmediate?function(t){return setImmediate(t)}:setTimeout;try{Object.defineProperty({},"x",{}),s=function(t,n,e,o){return Object.defineProperty(t,n,{value:e,writable:!0,configurable:o!==!1})}}catch(d){s=function(t,n,e){return t[n]=e,t}}l=function(){function t(t,n){this.fn=t,this.self=n,this.next=void 0}var n,e,o;return{add:function(r,i){o=new t(r,i),e?e.next=o:n=o,e=o,o=void 0},drain:function(){var t=n;for(n=e=h=void 0;t;)t.fn.call(t.self),t=t.next}}}();var g=s({},"constructor",a,!1);return a.prototype=g,s(g,"__NPO__",0,!1),s(a,"resolve",function(t){var n=this;return t&&"object"==typeof t&&1===t.__NPO__?t:new n(function(n,e){if("function"!=typeof n||"function"!=typeof e)throw TypeError("Not a function");n(t)})}),s(a,"reject",function(t){return new this(function(n,e){if("function"!=typeof n||"function"!=typeof e)throw TypeError("Not a function");e(t)})}),s(a,"all",function(t){var n=this;return"[object Array]"!=p.call(t)?n.reject(TypeError("Not an array")):0===t.length?n.resolve([]):new n(function(e,o){if("function"!=typeof e||"function"!=typeof o)throw TypeError("Not a function");var r=t.length,i=Array(r),f=0;c(n,t,function(t,n){i[t]=n,++f===r&&e(i)},o)})}),s(a,"race",function(t){var n=this;return"[object Array]"!=p.call(t)?n.reject(TypeError("Not an array")):new n(function(e,o){if("function"!=typeof e||"function"!=typeof o)throw TypeError("Not a function");c(n,t,function(t,n){e(n)},o)})}),a});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1])(1)
});
