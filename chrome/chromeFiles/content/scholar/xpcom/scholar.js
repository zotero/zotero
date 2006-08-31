const SCHOLAR_CONFIG = {
	GUID: 'zotero@chnm.gmu.edu',
	DB_FILE: 'zotero.sqlite',
	DB_REBUILD: false, // erase DB and recreate from schema
	DEBUG_LOGGING: true,
	DEBUG_TO_CONSOLE: true, // dump debug messages to console rather than (much slower) Debug Logger
	REPOSITORY_URL: 'http://chnm.gmu.edu/firefoxscholar/repo',
	REPOSITORY_CHECK_INTERVAL: 86400, // 24 hours
	REPOSITORY_RETRY_INTERVAL: 3600 // 1 hour
};

/*
 * Core functions
 */
var Scholar = new function(){
	var _initialized = false;
	var _shutdown = false;
	var _localizedStringBundle;
	
	// Privileged (public) methods
	this.init = init;
	this.shutdown = shutdown;
	this.getProfileDirectory = getProfileDirectory;
	this.getScholarDirectory = getScholarDirectory;
	this.getStorageDirectory = getStorageDirectory;
	this.getScholarDatabase = getScholarDatabase;
	this.backupDatabase = backupDatabase;
	this.debug = debug;
	this.varDump = varDump;
	this.getString = getString;
	this.flattenArguments = flattenArguments;
	this.join = join;
	this.inArray = inArray;
	this.arraySearch = arraySearch;
	this.randomString = randomString;
	this.getRandomID = getRandomID;
	this.moveToUnique = moveToUnique;
	
	// Public properties
	this.version;
	this.platform;
	this.isMac;
	
	/*
	 * Initialize the extension
	 */
	function init(){
		if (_initialized){
			return false;
		}
		
		// Register shutdown handler to call Scholar.shutdown()
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		observerService.addObserver({
			observe: function(subject, topic, data){
				Scholar.shutdown(subject, topic, data)
			}
		}, "xpcom-shutdown", false);
		
		// Load in the preferences branch for the extension
		Scholar.Prefs.init();
		
		// Load in the extension version from the extension manager
		var nsIUpdateItem = Components.interfaces.nsIUpdateItem;
		var gExtensionManager =
			Components.classes["@mozilla.org/extensions/manager;1"]
				.getService(Components.interfaces.nsIExtensionManager);
		var itemType = nsIUpdateItem.TYPE_EXTENSION;
		this.version
			= gExtensionManager.getItemForID(SCHOLAR_CONFIG['GUID']).version;
		
		// OS platform
		var win = Components.classes["@mozilla.org/appshell/appShellService;1"]
			   .getService(Components.interfaces.nsIAppShellService)
			   .hiddenDOMWindow;
		this.platform = win.navigator.platform;
		this.isMac = (this.platform.substr(0, 3) == "Mac");
		
		// Load in the localization stringbundle for use by getString(name)
		var src = 'chrome://scholar/locale/scholar.properties';
		var localeService =
			Components.classes["@mozilla.org/intl/nslocaleservice;1"]
			.getService(Components.interfaces.nsILocaleService);
		var appLocale = localeService.getApplicationLocale();
		var stringBundleService =
			Components.classes["@mozilla.org/intl/stringbundle;1"]
			.getService(Components.interfaces.nsIStringBundleService);
		_localizedStringBundle = stringBundleService.createBundle(src, appLocale);
		
		// Trigger updating of schema and scrapers
		Scholar.Schema.updateSchema();
		Scholar.Schema.updateScrapersRemote();
		
		// Initialize integration web server
		Scholar.Integration.SOAP.init();
		Scholar.Integration.init();
		
		_initialized = true;
		return true;
	}
	
	
	function shutdown(subject, topic, data){
		// Called twice otherwise, for some reason
		if (_shutdown){
			return false;
		}
		
		_shutdown = true;
		
		Scholar.backupDatabase();
		
		return true;
	}
	
	
	function getProfileDirectory(){
		return Components.classes["@mozilla.org/file/directory_service;1"]
			 .getService(Components.interfaces.nsIProperties)
			 .get("ProfD", Components.interfaces.nsIFile);
	}
	
	
	function getScholarDirectory(){
		var file = Scholar.getProfileDirectory();
		
		file.append('zotero');
		// If it doesn't exist, create
		if (!file.exists() || !file.isDirectory()){
			file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
		return file;
	}
	
	
	function getStorageDirectory(){
		var file = Scholar.getScholarDirectory();
		
		file.append('storage');
		// If it doesn't exist, create
		if (!file.exists() || !file.isDirectory()){
			file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
		return file;
	}
	
	function getScholarDatabase(ext){
		ext = ext ? '.' + ext : '';
		
		var file = Scholar.getScholarDirectory();
		file.append(SCHOLAR_CONFIG['DB_FILE'] + ext);
		return file;
	}
	
	
	/*
	 * Back up the main database file
	 *
	 * This could probably create a corrupt file fairly easily if all changes
	 * haven't been flushed to disk -- proceed with caution
	 */
	function backupDatabase(){
		if (Scholar.DB.transactionInProgress()){
			Scholar.debug('Transaction in progress--skipping DB backup', 2);
			return false;
		}
		
		Scholar.debug('Backing up database');
		
		var file = Scholar.getScholarDatabase();
		var backupFile = Scholar.getScholarDatabase('bak');
		
		// Copy via a temporary file so we don't run into disk space issues
		// after deleting the old backup file
		var tmpFile = Scholar.getScholarDatabase('tmp');
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
		
		if (typeof message!='string'){
			message = Scholar.varDump(message);
		}
		
		if (!level){
			level = 3;
		}
		
		if (!SCHOLAR_CONFIG['DEBUG_TO_CONSOLE']){
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
	
	
	function getString(name){
		try {
			var l10n = _localizedStringBundle.GetStringFromName(name);
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
		if (typeof args!='object'){
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
			var exists = Scholar.DB.valueQuery(sql + rnd);
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



Scholar.Prefs = new function(){
	// Privileged methods
	this.init = init;
	this.get = get;
	this.set = set;
	
	this.register = register;
	this.unregister = unregister;
	this.observe = observe;
	
	// Public properties
	this.prefBranch; // set in Scholar.init()
	
	function init(){
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
						.getService(Components.interfaces.nsIPrefService);
		this.prefBranch = prefs.getBranch("extensions.scholar.");
		
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
					Scholar.Schema.updateScrapersRemote();
				}
				else {
					Scholar.Schema.stopRepositoryTimer();
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
**/
Scholar.Hash = function(){
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

Scholar.Hash.prototype.get = function(in_key){
	return this.items[in_key] ? this.items[in_key] : false;
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



Scholar.Date = new function(){
	this.sqlToDate = sqlToDate;
	this.strToDate = strToDate;
	this.formatDate = formatDate;
	this.getFileDateString = getFileDateString;
	this.getFileTimeString = getFileTimeString;
	
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
			
			if (isUTC){
				return new Date(Date.UTC(dateparts[0], dateparts[1]-1, dateparts[2],
					timeparts[0], timeparts[1], timeparts[2]));
			}
			
			return new Date(dateparts[0], dateparts[1]-1, dateparts[2],
				timeparts[0], timeparts[1], timeparts[2]);
		}
		catch (e){
			Scholar.debug(sqldate + ' is not a valid SQL date', 2)
			return false;
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
	function strToDate(string) {
		var date = new Object();
		
		// skip empty things
		if(!string) {
			return date;
		}
		
		string = string.replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/, " ");
		
		var dateRe = /^([0-9]{4})[\-\/]([0-9]{2})[\-\/]([0-9]{2})$/;
		var m = dateRe.exec(string);
		if(m) {		// sql date
			Scholar.debug("DATE: used form 1: SQL");
			var jsDate = new Date(m[1], m[2]-1, m[3], false, false, false);
		} else {	// not an sql date
			var yearRe = /^((?:circa |around |about |c\.? ?)[0-9]{1,4}(?: ?B\.? ?C\.?(?: ?E\.?)?| ?C\.? ?E\.?| ?A\.? ?D\.?)|[0-9]{4})$/i;
			if(yearRe.test(string)) {
				// is just a year
				Scholar.debug("DATE: used form 2: year-only");
				date.year = string;
				return date;
			}
			
			// who knows what this is, but try JavaScript's date handling first
			var jsDate = new Date(string)
		}
		
		if(!isNaN(jsDate.valueOf())) {
			Scholar.debug("DATE: retrieved from JavaScript");
			// got a javascript date
			date.year = jsDate.getFullYear();
			date.month = jsDate.getMonth();
			date.day = jsDate.getDate();
			return date;
		}
		
		// no javascript date. time for cruder things.
		
		// first, see if we have anything resembling a year
		var yearRe = /^(.*)\b((?:circa |around |about |c\.? ?)[0-9]{1,4}(?: ?B\.? ?C\.?(?: ?E\.?)?| ?C\.? ?E\.?| ?A\.? ?D\.?)|[0-9]{4})\b(.*)$/i;
		
		var m = yearRe.exec(string);
		if(m) {
			date.year = m[2];
			date.part = m[1]+m[3];
			Scholar.debug("DATE: got year ("+date.year+", "+date.part+")");
			
			// get short month strings from CSL interpreter
			var months = CSL.getMonthStrings("short");
			
			// then, see if have anything resembling a month anywhere
			var monthRe = new RegExp("^(.*)\\b("+months.join("|")+")[^ ]* (.*)$", "i");
			var m = monthRe.exec(date.part);
			if(m) {
				date.month = months.indexOf(m[2][0].toUpperCase()+m[2].substr(1).toLowerCase());
				date.part = m[1]+m[3];
				Scholar.debug("DATE: got month ("+date.month+", "+date.part+")");
				
				// then, see if there's a day 
				var dayRe = /^(.*)\b([0-9]{1,2})\b(.*)$/i;
				var m = dayRe.exec(date.part);
				if(m) {
					date.day = m[2];
					date.part = m[1]+m[3];
					Scholar.debug("DATE: got day ("+date.day+", "+date.part+")");
				}
			}
		}
		
		if(date.part) {
			date.part = date.part.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9]+$/, "");
		}
		
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
		
		if(date.month) {
			// get short month strings from CSL interpreter
			var months = CSL.getMonthStrings("long");
			string += months[date.month];
			if(date.day) {
				string += ", "+date.day;
			} else {
				string += " ";
			}
		}
		
		if(date.year) {
			string += date.year;
		}
		
		return string;
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
}

Scholar.Browser = new function() {
	this.createHiddenBrowser = createHiddenBrowser;
	this.deleteHiddenBrowser = deleteHiddenBrowser;
	
	 function createHiddenBrowser(myWindow) {
	 	if(!myWindow) {
			var myWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
				   .getService(Components.interfaces.nsIAppShellService)
				   .hiddenDOMWindow;
		}
		
		// Create a hidden browser			
		var newHiddenBrowser = myWindow.document.createElement("browser");
		var windows = myWindow.document.getElementsByTagName("window");
		windows[0].appendChild(newHiddenBrowser);
		Scholar.debug("created hidden browser");
		return newHiddenBrowser;
	}
	
	function deleteHiddenBrowser(myBrowser) {			
		// Delete a hidden browser
		myBrowser.parentNode.removeChild(myBrowser);
		delete myBrowser;
		Scholar.debug("deleted hidden browser");
	}
}