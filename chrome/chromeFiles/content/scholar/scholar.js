const SCHOLAR_CONFIG = {
	DB_FILE : 'scholar.sdb',
	DB_VERSION : 1,
	DEBUG_LOGGING : true
};

/*
 * Core functions
 */
var Scholar = {
	/*
	 * Initialize the extension
	 */
	init: function() {
		scholarDB.updateSchema();
	},
	
	/*
	 * Debug logging function
	 *
	 * Uses DebugLogger extension available from http://mozmonkey.com/debuglogger/
	 * if available, otherwise the console
	 *
	 * Defaults to log level 3 if level not provided
	 */
	debug: function(message, level) {
		if (!SCHOLAR_CONFIG['DEBUG_LOGGING']){
			return false;
		}
		
		if (!level){
			level = 3;
		}
		
		try {
			var logManager =
				Components.classes["@mozmonkey.com/debuglogger/manager;1"]
				.getService(Components.interfaces.nsIDebugLoggerManager);
			var logger = logManager.registerLogger("Firefox Scholar");
		}
		catch (e){}
		
		if (logger){
			logger.log(level, message);
		}
		else {
			dump('scholar(' + level + '): ' + message);
		}
		return true;
	}
}

window.addEventListener("load", function(e) { Scholar.init(e); }, false);
