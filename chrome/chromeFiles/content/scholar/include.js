var Scholar_browserWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator)
				.getMostRecentWindow("navigator:browser");
				
const SCHOLAR_CONFIG = Scholar_browserWindow.SCHOLAR_CONFIG;
var Scholar = Scholar_browserWindow.Scholar;
