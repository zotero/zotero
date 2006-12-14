/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

const ZOTERO_CONFIG = {
	GUID: 'zotero@chnm.gmu.edu',
	DB_FILE: 'zotero.sqlite',
	DB_REBUILD: false, // erase DB and recreate from schema
	REPOSITORY_URL: 'http://www.zotero.org/repo',
	REPOSITORY_CHECK_INTERVAL: 86400, // 24 hours
	REPOSITORY_RETRY_INTERVAL: 3600 // 1 hour
};

/*
 * Core functions
 */
var Zotero = new function(){
	var _initialized = false;
	var _debugLogging;
	var _debugLevel;
	var _shutdown = false;
	var _localizedStringBundle;
	
	// Privileged (public) methods
	this.init = init;
	this.shutdown = shutdown;
	this.getProfileDirectory = getProfileDirectory;
	this.getZoteroDirectory = getZoteroDirectory;
	this.getStorageDirectory = getStorageDirectory;
	this.getZoteroDatabase = getZoteroDatabase;
	this.backupDatabase = backupDatabase;
	this.debug = debug;
	this.varDump = varDump;
	this.safeDebug = safeDebug;
	this.getString = getString;
	this.flattenArguments = flattenArguments;
	this.getAncestorByTagName = getAncestorByTagName;
	this.join = join;
	this.inArray = inArray;
	this.arraySearch = arraySearch;
	this.arrayToHash = arrayToHash;
	this.randomString = randomString;
	this.getRandomID = getRandomID;
	this.moveToUnique = moveToUnique;
	
	// Public properties
	this.version;
	this.platform;
	this.locale;
	this.isMac;
	
	/*
	 * Initialize the extension
	 */
	function init(){
		if (_initialized){
			return false;
		}
		
		// Register shutdown handler to call Zotero.shutdown()
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		observerService.addObserver({
			observe: function(subject, topic, data){
				Zotero.shutdown(subject, topic, data)
			}
		}, "xpcom-shutdown", false);
		
		// Load in the preferences branch for the extension
		Zotero.Prefs.init();
		
		_debugLogging = Zotero.Prefs.get('debug.log');
		_debugLevel = Zotero.Prefs.get('debug.level');
		
		// Load in the extension version from the extension manager
		var nsIUpdateItem = Components.interfaces.nsIUpdateItem;
		var gExtensionManager =
			Components.classes["@mozilla.org/extensions/manager;1"]
				.getService(Components.interfaces.nsIExtensionManager);
		var itemType = nsIUpdateItem.TYPE_EXTENSION;
		this.version
			= gExtensionManager.getItemForID(ZOTERO_CONFIG['GUID']).version;
		
		// OS platform
		var win = Components.classes["@mozilla.org/appshell/appShellService;1"]
			   .getService(Components.interfaces.nsIAppShellService)
			   .hiddenDOMWindow;
		this.platform = win.navigator.platform;
		this.isMac = (this.platform.substr(0, 3) == "Mac");
		
		// Locale		
		var localeService = Components.classes['@mozilla.org/intl/nslocaleservice;1'].
							getService(Components.interfaces.nsILocaleService);
		this.locale = localeService.getLocaleComponentForUserAgent();
		
		// Load in the localization stringbundle for use by getString(name)
		var src = 'chrome://zotero/locale/zotero.properties';
		var localeService =
			Components.classes["@mozilla.org/intl/nslocaleservice;1"]
			.getService(Components.interfaces.nsILocaleService);
		var appLocale = localeService.getApplicationLocale();
		var stringBundleService =
			Components.classes["@mozilla.org/intl/stringbundle;1"]
			.getService(Components.interfaces.nsIStringBundleService);
		_localizedStringBundle = stringBundleService.createBundle(src, appLocale);
		
		// Add notifier queue callbacks to the DB layer
		Zotero.DB.addCallback('begin', Zotero.Notifier.begin);
		Zotero.DB.addCallback('commit', Zotero.Notifier.commit);
		Zotero.DB.addCallback('rollback', Zotero.Notifier.reset);
		
		// Trigger updating of schema and scrapers
		Zotero.Schema.updateSchema();
		Zotero.Schema.updateScrapersRemote();
		
		// Initialize integration web server
		Zotero.Integration.SOAP.init();
		Zotero.Integration.init();
		
		_initialized = true;
		return true;
	}
	
	
	function shutdown(subject, topic, data){
		// Called twice otherwise, for some reason
		if (_shutdown){
			return false;
		}
		
		var level = Zotero.DB.commitAllTransactions();
		if (level){
			level = level===true ? '0' : level;
			Zotero.debug("A transaction was still open! (level " + level + ")", 2);
		}
		
		_shutdown = true;
		
		Zotero.backupDatabase();
		
		return true;
	}
	
	
	function getProfileDirectory(){
		return Components.classes["@mozilla.org/file/directory_service;1"]
			 .getService(Components.interfaces.nsIProperties)
			 .get("ProfD", Components.interfaces.nsIFile);
	}
	
	
	function getZoteroDirectory(){
		var file = Zotero.getProfileDirectory();
		
		file.append('zotero');
		// If it doesn't exist, create
		if (!file.exists() || !file.isDirectory()){
			file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
		return file;
	}
	
	
	function getStorageDirectory(){
		var file = Zotero.getZoteroDirectory();
		
		file.append('storage');
		// If it doesn't exist, create
		if (!file.exists() || !file.isDirectory()){
			file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
		return file;
	}
	
	function getZoteroDatabase(ext){
		ext = ext ? '.' + ext : '';
		
		var file = Zotero.getZoteroDirectory();
		file.append(ZOTERO_CONFIG['DB_FILE'] + ext);
		return file;
	}
	
	
	/*
	 * Back up the main database file
	 */
	function backupDatabase(){
		if (Zotero.DB.transactionInProgress()){
			Zotero.debug('Transaction in progress--skipping DB backup', 2);
			return false;
		}
		
		Zotero.debug('Backing up database');
		
		var file = Zotero.getZoteroDatabase();
		var backupFile = Zotero.getZoteroDatabase('bak');
		
		// Copy via a temporary file so we don't run into disk space issues
		// after deleting the old backup file
		var tmpFile = Zotero.getZoteroDatabase('tmp');
		if (tmpFile.exists()){
			tmpFile.remove(null);
		}
		
		try {
			file.copyTo(file.parent, tmpFile.leafName);
		}
		catch (e){
			// TODO: deal with low disk space
			throw (e);
		}
		
		try {
			var store = Components.classes["@mozilla.org/storage/service;1"].
				getService(Components.interfaces.mozIStorageService);
				
			var connection = store.openDatabase(tmpFile);
		}
		catch (e){
			Zotero.debug("Database file is corrupt--skipping backup");
			return false;
		}
		
		// Remove old backup file
		if (backupFile.exists()){
			backupFile.remove(null);
		}
		
		tmpFile.moveTo(tmpFile.parent, backupFile.leafName);
		
		return true;
	}
	
	
	/*
	 * Debug logging function
	 *
	 * Uses prefs e.z.debug.log and e.z.debug.level (restart required)
	 *
	 * Defaults to log level 3 if level not provided
	 */
	function debug(message, level) {
		if (!_debugLogging){
			return false;
		}
		
		if (typeof message!='string'){
			message = Zotero.varDump(message);
		}
		
		if (!level){
			level = 3;
		}
		
		// If level above debug.level value, don't display
		if (level > _debugLevel){
			return false;
		}
		
		// Note: DebugLogger extension is old and no longer supported -- if there's
		// a better extension we could switch to that as an option
		if (false && ZOTERO_CONFIG['DEBUG_TO_CONSOLE']){
			try {
				var logManager =
				Components.classes["@mozmonkey.com/debuglogger/manager;1"]
				.getService(Components.interfaces.nsIDebugLoggerManager);
				var logger = logManager.registerLogger("Zotero");
			}
			catch (e){}
		}
		
		if (logger){
			logger.log(level, message);
		}
		else {
			dump('zotero(' + level + '): ' + message + "\n\n");
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
	
	
	function safeDebug(obj){
		for (var i in obj){
			try {
				Zotero.debug(i + ': ' + obj[i]);
			}
			catch (e){
				try {
					Zotero.debug(i + ': ERROR');
				}
				catch (e){}
			}
		}
	}
	
	
	function getString(name, params){
		try {
			if (params){
				if (typeof params != 'object'){
					params = [params];
				}
				var l10n = _localizedStringBundle.formatStringFromName(name, params, params.length);
			}
			else {
				var l10n = _localizedStringBundle.GetStringFromName(name);
			}
		}
		catch (e){
			throw ('Localized string not available for ' + name);
		}
		return l10n;
	}
	
	
	/*
	 * Flattens mixed arrays/values in a passed _arguments_ object and returns
	 * an array of values -- allows for functions to accept both arrays of
	 * values and/or an arbitrary number of individual values
	 */
	function flattenArguments(args){
		// Put passed scalar values into an array
		if (typeof args!='object' || args===null){
			args = [args];
		}
		
		var returns = new Array();
		
		for (var i=0; i<args.length; i++){
			if (typeof args[i]=='object'){
				if(args[i]) {
					for (var j=0; j<args[i].length; j++){
						returns.push(args[i][j]);
					}
				}
			}
			else {
				returns.push(args[i]);
			}
		}
		
		return returns;
	}
	
	
	function getAncestorByTagName(elem, tagName){
		while (elem.parentNode){
			elem = elem.parentNode;
			if (elem.tagName==tagName || elem.tagName=='xul:' + tagName){
				return elem;
			}
		}
		return false;
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
	 * PHP's in_array() for JS -- returns true if a value is contained in
	 * an array, false otherwise
	 */
	function inArray(needle, haystack){
		for (var i in haystack){
			if (haystack[i]==needle){
				return true;
			}
		}
		return false;
	}
	
	
	/*
	 * PHP's array_search() for JS -- searches an array for a value and
	 * returns the key if found, false otherwise
	 */
	function arraySearch(needle, haystack){
		for (var i in haystack){
			if (haystack[i]==needle){
				return i;
			}
		}
		return false;
	}
	
	
	function arrayToHash(array){
		var hash = {};
		
		for each(var val in array){
			hash[val] = true;
		}
		
		return hash;
	}
	
	
	/**
	* Generate a random string of length 'len' (defaults to 8)
	**/
	function randomString(len) {
		var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
		if (!len){
			len = 8;
		}
		var randomstring = '';
		for (var i=0; i<len; i++) {
			var rnum = Math.floor(Math.random() * chars.length);
			randomstring += chars.substring(rnum,rnum+1);
		}
		return randomstring;
	}
	
	
	/**
	* Find a unique random id for use in a DB table
	**/
	function getRandomID(table, column, max){
		if (!table){
			throw('SQL query not provided');
		}
		
		if (!column){
			throw('SQL query not provided');
		}
		
		var sql = 'SELECT COUNT(*) FROM ' + table + ' WHERE ' + column + '=';
		
		if (!max){
			max = 16383;
		}
		
		var tries = 3; // # of tries to find a unique id
		do {
			// If no luck after number of tries, try a larger range
			if (!tries){
				max = max * 128;
			}
			var rnd = Math.floor(Math.random()*max);
			var exists = Zotero.DB.valueQuery(sql + rnd);
			tries--;
		}
		while (exists);
		
		return rnd;
	}
	
	
	function moveToUnique(file, newFile){
		newFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
		var newName = newFile.leafName;
		newFile.remove(null);
		
		// Move file to unique name
		file.moveTo(newFile.parent, newName);
		return file;
	}
};



Zotero.Prefs = new function(){
	// Privileged methods
	this.init = init;
	this.get = get;
	this.set = set;
	
	this.register = register;
	this.unregister = unregister;
	this.observe = observe;
	
	// Public properties
	this.prefBranch; // set in Zotero.init()
	
	function init(){
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
						.getService(Components.interfaces.nsIPrefService);
		this.prefBranch = prefs.getBranch("extensions.zotero.");
		
		// Register observer to handle pref changes
		this.register();
	}
	
	
	/**
	* Retrieve a preference
	**/
	function get(pref){
		try {
			switch (this.prefBranch.getPrefType(pref)){
				case this.prefBranch.PREF_BOOL:
					return this.prefBranch.getBoolPref(pref);
				case this.prefBranch.PREF_STRING:
					return this.prefBranch.getCharPref(pref);
				case this.prefBranch.PREF_INT:
					return this.prefBranch.getIntPref(pref);
			}
		}
		catch (e){
			throw ("Invalid preference '" + pref + "'");
		}
	}
	
	
	/**
	* Set a preference
	**/
	function set(pref, value){
		try {
			switch (this.prefBranch.getPrefType(pref)){
				case this.prefBranch.PREF_BOOL:
					return this.prefBranch.setBoolPref(pref, value);
				case this.prefBranch.PREF_STRING:
					return this.prefBranch.setCharPref(pref, value);
				case this.prefBranch.PREF_INT:
					return this.prefBranch.setIntPref(pref, value);
			}
		}
		catch (e){
			throw ("Invalid preference '" + pref + "'");
		}
	}
	
	
	//
	// Methods to register a preferences observer
	//
	function register(){
		this.prefBranch.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefBranch.addObserver("", this, false);
	}
	
	function unregister(){
		if (!this.prefBranch){
			return;
		}
		this.prefBranch.removeObserver("", this);
	}
	
	function observe(subject, topic, data){
		if(topic!="nsPref:changed"){
			return;
		}
		// subject is the nsIPrefBranch we're observing (after appropriate QI)
		// data is the name of the pref that's been changed (relative to subject)
		switch (data){
			case "automaticScraperUpdates":
				if (this.get('automaticScraperUpdates')){
					Zotero.Schema.updateScrapersRemote();
				}
				else {
					Zotero.Schema.stopRepositoryTimer();
				}
				break;
		}
	}
}



/**
* Class for creating hash arrays that behave a bit more sanely
*
*   Hashes can be created in the constructor by alternating key and val:
*
*   var hasharray = new Zotero.Hash('foo','foovalue','bar','barvalue');
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
**/
Zotero.Hash = function(){
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

Zotero.Hash.prototype.get = function(in_key){
	return this.items[in_key] ? this.items[in_key] : false;
}

Zotero.Hash.prototype.set = function(in_key, in_value){
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

Zotero.Hash.prototype.remove = function(in_key){
	var tmp_value;
	if (typeof(this.items[in_key]) != 'undefined') {
		this.length--;
		var tmp_value = this.items[in_key];
		delete this.items[in_key];
	}
	
	return tmp_value;
}

Zotero.Hash.prototype.has = function(in_key){
	return typeof(this.items[in_key]) != 'undefined';
}



Zotero.Date = new function(){
	this.sqlToDate = sqlToDate;
	this.dateToSQL = dateToSQL;
	this.strToDate = strToDate;
	this.formatDate = formatDate;
	this.strToISO = strToISO;
	this.strToMultipart = strToMultipart;
	this.isMultipart = isMultipart;
	this.multipartToSQL = multipartToSQL;
	this.multipartToStr = multipartToStr;
	this.isSQLDate = isSQLDate;
	this.isSQLDateTime = isSQLDateTime;
	this.sqlHasYear = sqlHasYear;
	this.sqlHasMonth = sqlHasMonth;
	this.sqlHasDay = sqlHasDay;
	this.getFileDateString = getFileDateString;
	this.getFileTimeString = getFileTimeString;
	this.getLocaleDateOrder = getLocaleDateOrder;
	
	
	/**
	* Convert an SQL date in the form '2006-06-13 11:03:05' into a JS Date object
	*
	* Can also accept just the date part (e.g. '2006-06-13')
	**/
	function sqlToDate(sqldate, isUTC){
		try {
			var datetime = sqldate.split(' ');
			var dateparts = datetime[0].split('-');
			if (datetime[1]){
				var timeparts = datetime[1].split(':');
			}
			else {
				timeparts = [false, false, false];
			}
			
			// Invalid date part
			if (dateparts.length==1){
				return false;
			}
			
			if (isUTC){
				return new Date(Date.UTC(dateparts[0], dateparts[1]-1, dateparts[2],
					timeparts[0], timeparts[1], timeparts[2]));
			}
			
			return new Date(dateparts[0], dateparts[1]-1, dateparts[2],
				timeparts[0], timeparts[1], timeparts[2]);
		}
		catch (e){
			Zotero.debug(sqldate + ' is not a valid SQL date', 2)
			return false;
		}
	}
	
	
	/**
	* Convert a JS Date object to an SQL date in the form '2006-06-13 11:03:05'
	*
	* If _toUTC_ is true, creates a UTC date
	**/
	function dateToSQL(date, toUTC)
	{
		try {
			if (toUTC){
				var year = date.getUTCFullYear();
				var month = date.getUTCMonth();
				var day = date.getUTCDate();
				var hours = date.getUTCHours();
				var minutes = date.getUTCMinutes();
				var seconds = date.getUTCSeconds();
			}
			else {
				var year = date.getFullYear();
				var month = date.getMonth();
				var day = date.getDate();
				var hours = date.getHours();
				var minutes = date.getMinutes();
				var seconds = date.getSeconds();
			}
			
			var utils = new Zotero.Utilities();
			year = utils.lpad(year, '0', 4);
			month = utils.lpad(month + 1, '0', 2);
			day = utils.lpad(day, '0', 2);
			hours = utils.lpad(hours, '0', 2);
			minutes = utils.lpad(minutes, '0', 2);
			seconds = utils.lpad(seconds, '0', 2);
			
			return year + '-' + month + '-' + day + ' '
				+ hours + ':' + minutes + ':' + seconds;
		}
		catch (e){
			Zotero.debug(date + ' is not a valid JS date', 2);
			return '';
		}
	}
	
	
	/*
	 * converts a string to an object containing:
	 *    day: integer form of the day
	 *    month: integer form of the month (indexed from 0, not 1)
	 *    year: 4 digit year (or, year + BC/AD/etc.)
	 *    part: anything that does not fall under any of the above categories
	 *          (e.g., "Summer," etc.)
	 */
	var _slashRe = /^(.*?)\b([0-9]{1,4})(?:([\-\/\.\u5e74])([0-9]{1,2}))?(?:([\-\/\.\u6708])([0-9]{1,4}))?\b(.*?)$/
	var _yearRe = /^(.*?)\b((?:circa |around |about |c\.? ?)?[0-9]{1,4}(?: ?B\.? ?C\.?(?: ?E\.?)?| ?C\.? ?E\.?| ?A\.? ?D\.?)|[0-9]{3,4})\b(.*?)$/i;
	var _monthRe = null;
	var _dayRe = null;
	
	function strToDate(string) {
		var date = new Object();
		
		// skip empty things
		if(!string) {
			return date;
		}
		
		string = string.toString().replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/, " ");
		
		// first, directly inspect the string
		var m = _slashRe.exec(string);
		if(m &&
		  (!m[5] || m[3] == m[5] || (m[3] == "\u5e74" && m[5] == "\u6708")) &&	// require sane separators
		  ((m[2] && m[4] && m[6]) || (!m[1] && !m[7]))) {						// require that either all parts are found,
		  																		// or else this is the entire date field
			// figure out date based on parts
			if(m[2].length == 4 || m[3] == "\u5e74") {
				// ISO 8601 style date (big endian)
				date.year = m[2];
				date.month = m[4];
				date.day = m[6];
			} else {
				// local style date (middle or little endian)
				date.year = m[6];
				var country = Zotero.locale.substr(3);
				if(country == "US" ||	// The United States
				   country == "FM" ||	// The Federated States of Micronesia
				   country == "PW" ||	// Palau
				   country == "PH") {	// The Philippines
					date.month = m[2];
					date.day = m[4];
				} else {
					date.month = m[4];
					date.day = m[2];
				}
			}
			Zotero.debug(date);
			
			if(date.year) date.year = parseInt(date.year, 10);
			if(date.day) date.day = parseInt(date.day, 10);
			if(date.month) {
				date.month = parseInt(date.month, 10);
				
				if(date.month > 12) {
					// swap day and month
					var tmp = date.day;
					date.day = date.month
					date.month = tmp;
				}
			}
			
			Zotero.debug(date);
			
			if(!date.month || date.month <= 12) {
				if(date.year && date.year < 100) {	// for two digit years, determine proper
													// four digit year
					var today = new Date();
					var year = today.getFullYear();
					var twoDigitYear = year % 100;
					var century = year - twoDigitYear;
					
					if(date.year <= twoDigitYear) {
						// assume this date is from our century
						date.year = century + date.year;
					} else {
						// assume this date is from the previous century
						date.year = century - 100 + date.year;
					}
				}
				
				if(date.month) date.month--;		// subtract one for JS style
				Zotero.debug("DATE: retrieved with algorithms: "+date.toSource());
				
				date.part = m[1]+m[7];
			} else {
				// give up; we failed the sanity check
				Zotero.debug("DATE: algorithms failed sanity check");
				date = {"part":string};
			}
			
			Zotero.debug(date);
		} else {
			Zotero.debug("DATE: could not apply algorithms");
			date.part = string;
		}
		
		// couldn't find something with the algorithms; use regexp
		// YEAR
		if(!date.year) {
			var m = _yearRe.exec(date.part);
			if(m) {
				date.year = m[2];
				date.part = m[1]+m[3];
				Zotero.debug("DATE: got year ("+date.year+", "+date.part+")");
			}
		}
		
		// MONTH
		if(!date.month) {
			// compile month regular expression
			var months = Zotero.CSL.Global.getMonthStrings("short");
			if(!_monthRe) {
				_monthRe = new RegExp("^(.*)\\b("+months.join("|")+")[^ ]*(?: (.*)$|$)", "i");
			}
			
			var m = _monthRe.exec(date.part);
			if(m) {
				date.month = months.indexOf(m[2][0].toUpperCase()+m[2].substr(1).toLowerCase());
				date.part = m[1]+m[3];
				Zotero.debug("DATE: got month ("+date.month+", "+date.part+")");
			}
		}
		
		// DAY
		if(!date.day) {
			// compile day regular expression
			if(!_dayRe) {
				var daySuffixes = Zotero.getString("date.daySuffixes").replace(/, ?/g, "|");
				_dayRe = new RegExp("\\b([0-9]{1,2})(?:"+daySuffixes+")?\\b(.*)", "i");
			}
			
			var m = _dayRe.exec(date.part);
			if(m) {
				date.day = parseInt(m[1], 10);
				
				if(m.index > 0) {
					date.part = date.part.substr(0, m.index);
					if(m[2]) {
						date.part += " "+m[2];;
					}
				} else {
					date.part = m[2];
				}
				
				Zotero.debug("DATE: got day ("+date.day+", "+date.part+")");
			}
		}
		
		// clean up date part
		if(date.part) {
			date.part = date.part.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9]+$/, "");
			if(!date.part.length) {
				date.part = undefined;
			}
		}
		
		Zotero.debug(date);
		
		return date;
	}
	
	/*
	 * does pretty formatting of a date object returned by strToDate()
	 */
	function formatDate(date) {
		var string = "";
		
		if(date.part) {
			string += date.part+" ";
		}
		
		var months = Zotero.CSL.Global.getMonthStrings("long");
		if(date.month != undefined && months[date.month]) {
			// get short month strings from CSL interpreter
			string += months[date.month];
			if(date.day) {
				string += " "+date.day+", ";
			} else {
				string += " ";
			}
		}
		
		if(date.year) {
			string += date.year;
		}
		
		return string;
	}
	
	function strToISO(str){
		var date = Zotero.Date.strToDate(str);
		
		if(date.year) {
			var dateString = Zotero.Utilities.prototype.lpad(date.year, "0", 4);
			if(date.month) {
				dateString += "-"+Zotero.Utilities.prototype.lpad(date.month+1, "0", 2);
				if(date.day) {
					dateString += "-"+Zotero.Utilities.prototype.lpad(date.day, "0", 2);
				}
			}
			return dateString;
		}
		return false;
	}
	
	function strToMultipart(str){
		if (!str){
			return '';
		}
		
		var utils = new Zotero.Utilities();
		
		var parts = strToDate(str);
		parts.month = typeof parts.month != undefined ? parts.month + 1 : '';
		
		var multi = utils.lpad(parts.year, '0', 4) + '-'
			+ utils.lpad(parts.month, '0', 2) + '-'
			+ utils.lpad(parts.day, '0', 2)
			+ ' '
			+ str;
			
		return multi;
	}
	
	// Regexes for multipart and SQL dates
	var _multipartRE = /^[0-9]{4}\-[0-9]{2}\-[0-9]{2} /;
	var _sqldateRE = /^[0-9]{4}\-[0-9]{2}\-[0-9]{2}/;
	var _sqldatetimeRE = /^[0-9]{4}\-[0-9]{2}\-[0-9]{2} ([0-1][0-9]|[2][0-3]):([0-5][0-9]):([0-5][0-9])/;
	
	/**
	 * Tests if a string is a multipart date string
	 * e.g. '2006-11-03 November 3rd, 2006'
	 */
	function isMultipart(str){
		return _multipartRE.test(str);
	}
	
	
	/**
	 * Returns the SQL part of a multipart date string
	 * (e.g. '2006-11-03 November 3rd, 2006' returns '2006-11-03')
	 */
	function multipartToSQL(multi){
		if (!multi){
			return '';
		}
		
		if (!isMultipart(multi)){
			return '0000-00-00';
		}
		
		return multi.substr(0, 10);
	}
	
	
	/**
	 * Returns the user part of a multipart date string
	 * (e.g. '2006-11-03 November 3rd, 2006' returns 'November 3rd, 2006')
	 */
	function multipartToStr(multi){
		if (!multi){
			return '';
		}
		
		if (!isMultipart(multi)){
			return multi;
		}
		
		return multi.substr(11);
	}
	
	
	function isSQLDate(str){
		return _sqldateRE.test(str);
	}
	
	
	function isSQLDateTime(str){
		return _sqldatetimeRE.test(str);
	}
	
	
	function sqlHasYear(sqldate){
		return isSQLDate(sqldate) && sqldate.substr(0,4)!='0000';
	}
	
	
	function sqlHasMonth(sqldate){
		return isSQLDate(sqldate) && sqldate.substr(5,2)!='00';
	}
	
	
	function sqlHasDay(sqldate){
		return isSQLDate(sqldate) && sqldate.substr(8,2)!='00';
	}
	
	
	function getFileDateString(file){
		var date = new Date();
		date.setTime(file.lastModifiedTime);
		return date.toLocaleDateString();
	}
	
	
	function getFileTimeString(file){
		var date = new Date();
		date.setTime(file.lastModifiedTime);
		return date.toLocaleTimeString();
	}
	
	/**
	 * Figure out the date order from the output of toLocaleDateString()
	 *
	 * Note: Currently unused
	 *
	 * Returns a string with y, m, and d (e.g. 'ymd', 'mdy')
	 */
	function getLocaleDateOrder(){
		var date = new Date("October 5, 2006");
		var parts = date.toLocaleDateString().match(/([0-9]+)[^0-9]+([0-9]+)[^0-9]+([0-9]+)/);
		alert(parts);
		switch (parseInt(parts[1])){
			case 2006:
				var order = 'y';
				break;
			case 10:
				var order = 'm';
				break;
			case 5:
				var order = 'd';
				break;
		}
		switch (parseInt(parts[2])){
			case 2006:
				order += 'y';
				break;
			case 10:
				order += 'm';
				break;
			case 5:
				order += 'd';
				break;
		}
		switch (parseInt(parts[3])){
			case 2006:
				order += 'y';
				break;
			case 10:
				order += 'm';
				break;
			case 5:
				order += 'd';
				break;
		}
		
		return order;
	}
}

Zotero.Browser = new function() {
	this.createHiddenBrowser = createHiddenBrowser;
	this.deleteHiddenBrowser = deleteHiddenBrowser;
	
	function createHiddenBrowser(myWindow) {
	 	if(!myWindow) {
			var myWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			                   .getService(Components.interfaces.nsIWindowMediator)
			                   .getMostRecentWindow("navigator:browser");
		}
		
		// Create a hidden browser
		var newHiddenBrowser = myWindow.document.createElement("browser");
		myWindow.document.documentElement.appendChild(newHiddenBrowser);
		Zotero.debug("created hidden browser ("
			+ myWindow.document.getElementsByTagName('browser').length + ")");
		return newHiddenBrowser;
	}
	
	function deleteHiddenBrowser(myBrowser) {			
		// Delete a hidden browser
		myBrowser.parentNode.removeChild(myBrowser);
		delete myBrowser;
		Zotero.debug("deleted hidden browser");
	}
}


/*
 * Implements nsIWebProgressListener
 */
Zotero.WebProgressFinishListener = function(onFinish) {
	this.onStateChange = function(wp, req, stateFlags, status) {
		//Zotero.debug('onStageChange: ' + stateFlags);
		if ((stateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
				&& (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK)) {
			onFinish();
		}
	}
	
	this.onLocationChange = function() {}
	this.onProgressChange = function() {}
	this.onSecurityChange = function() {}
	this.onStatusChange = function() {}
}