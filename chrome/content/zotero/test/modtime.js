var tmp = Zotero.getTempDirectory();
tmp.append(Zotero.randomString());
tmp.create(Components.interfaces.nsIFile.FILE_TYPE, 0o644);

var date = new Date();
var nowTS = Zotero.Date.toUnixTimestamp(date) * 1000;

var fileOriginalTS = tmp.lastModifiedTime;

var date = new Date("June 1, 2009 12:34:56");
var fileSetTS = Zotero.Date.toUnixTimestamp(date) * 1000;
tmp.lastModifiedTime = fileSetTS;

var fileGetTS = tmp.lastModifiedTime;

tmp.remove(false);

var str = "Current time: " + Date(nowTS) + "\n"
	+ "File original time: " + Date(fileOriginalTS) + "\n"
	+ "File set time: " + Date(fileSetTS) + "\n"
	+ "File get time: " + Date(fileGetTS) + "\n\n"
	+ (fileSetTS == fileGetTS ? "PASS" : "FAIL (" + fileSetTS + " != " + fileGetTS + ")");

var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
						.getService(Components.interfaces.nsIPrompt);
prompt.alert('', str);
