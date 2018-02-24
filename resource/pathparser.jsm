/**
 * pathparser.js - tiny URL parser/router
 *
 * Copyright (c) 2014 Dan Stillman
 * License: MIT
 * https://github.com/dstillman/pathparser.js
 */
(function (root, factory) {
	// AMD/RequireJS
	if (typeof define === 'function' && define.amd) {
		define(factory);
	// CommonJS/Node
	} else if (typeof exports === 'object') {
		module.exports = factory();
	// Mozilla JSM
	} else if (typeof Components != 'undefined'
			&& typeof Components.utils != 'undefined'
			&& typeof Components.utils.import == 'function') {
		root.EXPORTED_SYMBOLS = ["PathParser"];
		root.PathParser = factory();
	// Browser global
	} else {
		root.PathParser = factory();
	}
}(this, function () {
	"use strict";
	
	var PathParser = function (params) {
		this.rules = [];
		this.params = params;
	}
	
	PathParser.prototype = (function () {
		function getParamsFromRule(rule, pathParts, queryParts) {
			var params = {};
			var missingParams = {};
			
			// Parse path components
			for (var i = 0; i < rule.parts.length; i++) {
				var rulePart = rule.parts[i];
				var part = pathParts[i];
				
				if (part !== undefined) {
					if (rulePart.charAt(0) == ':') {
						params[rulePart.substr(1)] = part;
						continue;
					}
					else if (rulePart !== part) {
						return false;
					}
				}
				else if (rulePart.charAt(0) != ':') {
					return false;
				}
				else {
					missingParams[rulePart.substr(1)] = true;
				}
			}
			
			// Parse query strings
			for (var i = 0; i < queryParts.length; ++i) {
				var nameValue = queryParts[i].split('=', 2);
				var key = nameValue[0];
				// But ignore empty parameters and don't override named parameters
				if (nameValue.length == 2 && !params[key] && !missingParams[key]) {
					params[key] = nameValue[1];
				}
			}
			
			return params;
		}
		
		return {
			add: function (route, handler, autoPopulateOnMatch) {
				this.rules.push({
					parts: route.replace(/^\//, '').split('/'),
					handler: handler,
					autoPopulateOnMatch: autoPopulateOnMatch === undefined || autoPopulateOnMatch
				});
			},
			
			run: function (url) {
				if (url && url.length) {
					url = url
						// Remove redundant slashes
						.replace(/\/+/g, '/')
						// Strip leading and trailing '/' (at end or before query string)
						.replace(/^\/|\/($|\?)/, '')
						// Strip fragment identifiers
						.replace(/#.*$/, '');
				}
				
				var urlSplit = url.split('?', 2);
				var pathParts = urlSplit[0].split('/', 50);
				var queryParts = urlSplit[1] ? urlSplit[1].split('&', 50) : [];
				
				for (var i=0; i < this.rules.length; i++) {
					var rule = this.rules[i];
					var params = getParamsFromRule(rule, pathParts, queryParts);
					if (params) {
						params.url = url;
						// Automatic parameter assignment
						if (rule.autoPopulateOnMatch && this.params) {
							for (var param in params) {
								this.params[param] = params[param];
							}
						}
						// Call handler with 'this' bound to parameter object
						if (rule.handler) {
							rule.handler.call(params);
						}
						return true;
					}
				}
				return false;
			}
		};
	})();
	
	return PathParser;
}));