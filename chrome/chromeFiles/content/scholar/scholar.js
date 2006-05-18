const SCHOLAR_CONFIG = {
	GUID: 'scholar@chnm',
	DB_FILE: 'scholar.sqlite',
	DB_VERSION: 7, // must match version at top of schema.sql
	DB_REBUILD: false, // erase DB and recreate from schema
	DEBUG_LOGGING: true,
	DEBUG_TO_CONSOLE: true // dump debug messages to console rather than (much slower) Debug Logger
};

/*
 * Core functions
 */
var Scholar = new function(){
	var _initialized = false
	
	this.testString = 'Sidebar is not registered';
	
	this.init = init;
	this.debug = debug;
	this.varDump = varDump;
	this.flattenArguments = flattenArguments;
	this.join = join;
	this.Hash = Hash;
	
	/*
	 * Initialize the extension
	 */
	function init(){
		if (!_initialized){
			Scholar.DB.updateSchema();
			_initialized = true;
			return true;
		}
		return false;
	}
	
	
	/*
	 * Debug logging function
	 *
	 * Uses DebugLogger extension available from http://mozmonkey.com/debuglogger/
	 * if available, otherwise the console (in which case boolean browser.dom.window.dump.enabled
	 * must be created and set to true in about:config)
	 *
	 * Defaults to log level 3 if level not provided
	 */
	function debug(message, level) {
		if (!SCHOLAR_CONFIG['DEBUG_LOGGING']){
			return false;
		}
		
		if (!level){
			level = 3;
		}
		
		if (!SCHOLAR_CONFIG['DEBUG_TO_CONSOLE']){
			try {
				var logManager =
				Components.classes["@mozmonkey.com/debuglogger/manager;1"]
				.getService(Components.interfaces.nsIDebugLoggerManager);
				var logger = logManager.registerLogger("Firefox Scholar");
			}
			catch (e){}
		}
		
		if (logger){
			logger.log(level, message);
		}
		else {
			dump('scholar(' + level + '): ' + message + "\n\n");
		}
		return true;
	}
	
	
	/**
	 * PHP var_dump equivalent for JS
	 *
	 * Adapted from http://binnyva.blogspot.com/2005/10/dump-function-javascript-equivalent-of.html
	 */
	function varDump(arr,level) {
		var dumped_text = "";
		if (!level){
			level = 0;
		}
		
		// The padding given at the beginning of the line.
		var level_padding = "";
		for (var j=0;j<level+1;j++){
			level_padding += "    ";
		}
		
		if (typeof(arr) == 'object') { // Array/Hashes/Objects
			for (var item in arr) {
				var value = arr[item];
				
				if (typeof(value) == 'object') { // If it is an array,
					dumped_text += level_padding + "'" + item + "' ...\n";
					dumped_text += arguments.callee(value,level+1);
				}
				else {
					if (typeof value == 'function'){
						dumped_text += level_padding + "'" + item + "' => function(...){...} \n";
					}
					else {
						dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
					}
				}
			}
		}
		else { // Stings/Chars/Numbers etc.
			dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
		}
		return dumped_text;
	}
	
	
	/*
	 * Flattens mixed arrays/values in a passed _arguments_ object and returns
	 * an array of values -- allows for functions to accept both arrays of
	 * values and/or an arbitrary number of individual values
	 */
	function flattenArguments(args){
		var returns = new Array();
		
		for (var i=0; i<args.length; i++){
			if (typeof args[i]=='object'){
				for (var j=0; j<args[i].length; j++){
					returns.push(args[i][j]);
				}
			}
			else {
				returns.push(args[i]);
			}
		}
		
		return returns;
	}
	
	
	/*
	 * A version of join() that operates externally for use on objects other
	 * than arrays (e.g. _arguments_)
	 *
	 * Note that this is safer than extending Object()
	 */
	function join(obj, delim){
		var a = [];
		for (var i=0, len=obj.length; i<len; i++){
			a.push(obj[i]);
		}
		return a.join(delim);
	}
	
	
	/*
	 * Class for creating hash arrays that behave a bit more sanely
	 *
	 *   Hashes can be created in the constructor by alternating key and val:
	 *
	 *   var hasharray = new Scholar.Hash('foo','foovalue','bar','barvalue');
	 *
	 *   Or using hasharray.set(key, val)
	 *
	 *   _val_ defaults to true if not provided
	 *
	 *   If using foreach-style looping, be sure to use _for (i in arr.items)_
	 *   rather than just _for (i in arr)_, or else you'll end up with the
	 *   methods and members instead of the hash items
	 *
	 *   Most importantly, hasharray.length will work as expected, even with
	 *   non-numeric keys
	 *
	 * Adapated from http://www.mojavelinux.com/articles/javascript_hashes.html
	 * (c) Mojavelinux, Inc.
	 * License: Creative Commons
	 */
	 function Hash(){
		 this.length = 0;
		 this.items = new Array();
		 
		 // Public methods defined on prototype below
		 
		 for (var i = 0; i < arguments.length; i += 2) {
			 if (typeof(arguments[i + 1]) != 'undefined') {
				 this.items[arguments[i]] = arguments[i + 1];
				 this.length++;
			 }
		 }
	 }
};


Scholar.Hash.prototype.get = function(in_key){
	return this.items[in_key];
}

Scholar.Hash.prototype.set = function(in_key, in_value){
	// Default to a boolean hash if value not provided
	if (typeof(in_value) == 'undefined'){
		in_value = true;
	}
	
	if (typeof(this.items[in_key]) == 'undefined') {
		this.length++;
	}
	
	this.items[in_key] = in_value;
	
	return in_value;
}

Scholar.Hash.prototype.remove = function(in_key){
	var tmp_value;
	if (typeof(this.items[in_key]) != 'undefined') {
		this.length--;
		var tmp_value = this.items[in_key];
		delete this.items[in_key];
	}
	
	return tmp_value;
}

Scholar.Hash.prototype.has = function(in_key){
	return typeof(this.items[in_key]) != 'undefined';
}

window.addEventListener("load", function(e) { Scholar.init(e); }, false);
