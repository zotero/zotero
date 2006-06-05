const SCHOLAR_CONFIG = {
	GUID: 'scholar@chnm.gmu.edu',
	DB_FILE: 'scholar.sqlite',
	DB_VERSION: 13, // must match version at top of schema.sql
	DB_REBUILD: false, // erase DB and recreate from schema
	DEBUG_LOGGING: true,
	DEBUG_TO_CONSOLE: true // dump debug messages to console rather than (much slower) Debug Logger
};

/*
 * Core functions
 */
var Scholar = new function(){
	var _initialized = false;
	var _localizedStringBundle;
	
	// Privileged (public) methods
	this.init = init;
	this.debug = debug;
	this.varDump = varDump;
	this.getString = getString;
	this.flattenArguments = flattenArguments;
	this.join = join;
	this.randomString = randomString;
	this.getRandomID = getRandomID;
	
	this.Hash = Hash;
	
	/*
	 * Initialize the extension
	 */
	function init(){
		if (_initialized){
			return false;
		}
		
		Scholar.DB.updateSchema();
		
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
		
		_initialized = true;
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
	
	
	function getString(name){
		return _localizedStringBundle.GetStringFromName(name);
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
		
		var tries = 10; // # of tries to find a unique id
		do {
			// If no luck after number of tries, try a larger range
			if (!tries){
				max = max * 2;
			}
			var rnd = Math.floor(Math.random()*max);
			var exists = Scholar.DB.valueQuery(sql + rnd);
			tries--;
		}
		while (exists);
		
		return rnd;
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

/*
 *  Functions for handling dates
 *  Author: Matt Kruse <matt@mattkruse.com>
 *  WWW: http://www.mattkruse.com/javascript/date/
 */
Scholar.Date = new function(){
	this.parseDate = parseDate;
	this.formatDate = formatDate;

	var MONTH_NAMES=new Array('January','February','March','April','May','June','July','August','September','October','November','December','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec');var DAY_NAMES=new Array('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sun','Mon','Tue','Wed','Thu','Fri','Sat');
	function LZ(x){return(x<0||x>9?"":"0")+x}
	function isDate(val,format){var date=getDateFromFormat(val,format);if(date==0){return false;}return true;}
	function compareDates(date1,dateformat1,date2,dateformat2){var d1=getDateFromFormat(date1,dateformat1);var d2=getDateFromFormat(date2,dateformat2);if(d1==0 || d2==0){return -1;}else if(d1 > d2){return 1;}return 0;}
	function formatDate(date,format){format=format+"";var result="";var i_format=0;var c="";var token="";var y=date.getYear()+"";var M=date.getMonth()+1;var d=date.getDate();var E=date.getDay();var H=date.getHours();var m=date.getMinutes();var s=date.getSeconds();var yyyy,yy,MMM,MM,dd,hh,h,mm,ss,ampm,HH,H,KK,K,kk,k;var value=new Object();if(y.length < 4){y=""+(y-0+1900);}value["y"]=""+y;value["yyyy"]=y;value["yy"]=y.substring(2,4);value["M"]=M;value["MM"]=LZ(M);value["MMM"]=MONTH_NAMES[M-1];value["NNN"]=MONTH_NAMES[M+11];value["d"]=d;value["dd"]=LZ(d);value["E"]=DAY_NAMES[E+7];value["EE"]=DAY_NAMES[E];value["H"]=H;value["HH"]=LZ(H);if(H==0){value["h"]=12;}else if(H>12){value["h"]=H-12;}else{value["h"]=H;}value["hh"]=LZ(value["h"]);if(H>11){value["K"]=H-12;}else{value["K"]=H;}value["k"]=H+1;value["KK"]=LZ(value["K"]);value["kk"]=LZ(value["k"]);if(H > 11){value["a"]="PM";}else{value["a"]="AM";}value["m"]=m;value["mm"]=LZ(m);value["s"]=s;value["ss"]=LZ(s);while(i_format < format.length){c=format.charAt(i_format);token="";while((format.charAt(i_format)==c) &&(i_format < format.length)){token += format.charAt(i_format++);}if(value[token] != null){result=result + value[token];}else{result=result + token;}}return result;}
	function _isInteger(val){var digits="1234567890";for(var i=0;i < val.length;i++){if(digits.indexOf(val.charAt(i))==-1){return false;}}return true;}
	function _getInt(str,i,minlength,maxlength){for(var x=maxlength;x>=minlength;x--){var token=str.substring(i,i+x);if(token.length < minlength){return null;}if(_isInteger(token)){return token;}}return null;}
	function getDateFromFormat(val,format){val=val+"";format=format+"";var i_val=0;var i_format=0;var c="";var token="";var token2="";var x,y;var now=new Date();var year=now.getYear();var month=now.getMonth()+1;var date=1;var hh=now.getHours();var mm=now.getMinutes();var ss=now.getSeconds();var ampm="";while(i_format < format.length){c=format.charAt(i_format);token="";while((format.charAt(i_format)==c) &&(i_format < format.length)){token += format.charAt(i_format++);}if(token=="yyyy" || token=="yy" || token=="y"){if(token=="yyyy"){x=4;y=4;}if(token=="yy"){x=2;y=2;}if(token=="y"){x=2;y=4;}year=_getInt(val,i_val,x,y);if(year==null){return 0;}i_val += year.length;if(year.length==2){if(year > 70){year=1900+(year-0);}else{year=2000+(year-0);}}}else if(token=="MMM"||token=="NNN"){month=0;for(var i=0;i<MONTH_NAMES.length;i++){var month_name=MONTH_NAMES[i];if(val.substring(i_val,i_val+month_name.length).toLowerCase()==month_name.toLowerCase()){if(token=="MMM"||(token=="NNN"&&i>11)){month=i+1;if(month>12){month -= 12;}i_val += month_name.length;break;}}}if((month < 1)||(month>12)){return 0;}}else if(token=="EE"||token=="E"){for(var i=0;i<DAY_NAMES.length;i++){var day_name=DAY_NAMES[i];if(val.substring(i_val,i_val+day_name.length).toLowerCase()==day_name.toLowerCase()){i_val += day_name.length;break;}}}else if(token=="MM"||token=="M"){month=_getInt(val,i_val,token.length,2);if(month==null||(month<1)||(month>12)){return 0;}i_val+=month.length;}else if(token=="dd"||token=="d"){date=_getInt(val,i_val,token.length,2);if(date==null||(date<1)||(date>31)){return 0;}i_val+=date.length;}else if(token=="hh"||token=="h"){hh=_getInt(val,i_val,token.length,2);if(hh==null||(hh<1)||(hh>12)){return 0;}i_val+=hh.length;}else if(token=="HH"||token=="H"){hh=_getInt(val,i_val,token.length,2);if(hh==null||(hh<0)||(hh>23)){return 0;}i_val+=hh.length;}else if(token=="KK"||token=="K"){hh=_getInt(val,i_val,token.length,2);if(hh==null||(hh<0)||(hh>11)){return 0;}i_val+=hh.length;}else if(token=="kk"||token=="k"){hh=_getInt(val,i_val,token.length,2);if(hh==null||(hh<1)||(hh>24)){return 0;}i_val+=hh.length;hh--;}else if(token=="mm"||token=="m"){mm=_getInt(val,i_val,token.length,2);if(mm==null||(mm<0)||(mm>59)){return 0;}i_val+=mm.length;}else if(token=="ss"||token=="s"){ss=_getInt(val,i_val,token.length,2);if(ss==null||(ss<0)||(ss>59)){return 0;}i_val+=ss.length;}else if(token=="a"){if(val.substring(i_val,i_val+2).toLowerCase()=="am"){ampm="AM";}else if(val.substring(i_val,i_val+2).toLowerCase()=="pm"){ampm="PM";}else{return 0;}i_val+=2;}else{if(val.substring(i_val,i_val+token.length)!=token){return 0;}else{i_val+=token.length;}}}if(i_val != val.length){return 0;}if(month==2){if( ((year%4==0)&&(year%100 != 0) ) ||(year%400==0) ){if(date > 29){return 0;}}else{if(date > 28){return 0;}}}if((month==4)||(month==6)||(month==9)||(month==11)){if(date > 30){return 0;}}if(hh<12 && ampm=="PM"){hh=hh-0+12;}else if(hh>11 && ampm=="AM"){hh-=12;}var newdate=new Date(year,month-1,date,hh,mm,ss);return newdate.getTime();}
	function parseDate(val){var preferEuro=(arguments.length==2)?arguments[1]:false;generalFormats=new Array('y-M-d','MMM d, y','MMM d,y','y-MMM-d','d-MMM-y','MMM d');monthFirst=new Array('M/d/y','M-d-y','M.d.y','MMM-d','M/d','M-d');dateFirst =new Array('d/M/y','d-M-y','d.M.y','d-MMM','d/M','d-M');var checkList=new Array('generalFormats',preferEuro?'dateFirst':'monthFirst',preferEuro?'monthFirst':'dateFirst');var d=null;for(var i=0;i<checkList.length;i++){var l=window[checkList[i]];for(var j=0;j<l.length;j++){d=getDateFromFormat(val,l[j]);if(d!=0){return new Date(d);}}}return null;}
}
