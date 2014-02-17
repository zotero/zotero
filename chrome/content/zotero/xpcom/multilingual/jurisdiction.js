Zotero.Jurisdiction = new function () {
	const JURISDICTION_FILE_NAME = "jurisdictions.json";

	var _jsonFileContents;
	var _jurisdictionObject;
	var _ios;

	this.getListData = getListData;
	this.getLabelFromKey = getLabelFromKey;

	this.init = function() {
		_ios = Components.classes["@mozilla.org/network/io-service;1"].
				  getService(Components.interfaces.nsIIOService);
		_jsonFileContents = Zotero.File.getContentsFromURL("resource://zotero/schema/"+JURISDICTION_FILE_NAME);
		_jurisdictionObject = JSON.parse(_jsonFileContents);
	}

	function getListData(keyAnchor) {
		var lst;
		if (keyAnchor) {
			lst = _jurisdictionObject[keyAnchor].children;
		} else {
			lst = _jurisdictionObject;
		}
		var ret = [];
		for (var key in lst) {
			ret.push([key, lst[key].name, lst[key].nickname]);
		}
		ret.sort(function(a,b){
			if (a[1] > b[1]) {
				return 1;
			} else if (a[1] < b[1]) {
				return -1;
			} else {
				return 0;
			}
		});
		return ret;
	};
	function getLabelFromKey(key) {
		ret = false;
		lst = key.split(";");
		pos = lst.length;
		var trykey;
		while (pos > 0) {
			var trykey = lst.slice(0,pos).join(";");
			if (_jurisdictionObject[trykey]) {
				if (pos < lst.length) {
					if (pos == 1) {
						trykey = trykey + ";subunit";
					}
					if (_jurisdictionObject[trykey] && _jurisdictionObject[trykey].children[key]) {
						ret = _jurisdictionObject[trykey].children[key].name;
					}
				} else {
					ret = _jurisdictionObject[trykey].name;
				}
			}
			pos += -1;
		}
		return ret;
	};
};
