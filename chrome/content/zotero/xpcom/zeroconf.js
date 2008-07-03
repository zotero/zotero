Zotero.Zeroconf = new function () {
	this.init = init;
	this.registerService = registerService;
	this.findInstances = findInstances;
	this.findInstancesCallback = findInstancesCallback;
	this.unregisterService = unregisterService;
	this.getScript = getScript;
	
	this.clientEnabled = true;
	this.serverEnabled = true;
	
	this.__defineGetter__('clientPath', function () {
		return '/usr/bin/dns-sd';
	});
	
	this.__defineGetter__('displayName', function () {
		var dnsService = Components.classes["@mozilla.org/network/dns-service;1"].
			getService(Components.interfaces.nsIDNSService);
		var hostname = dnsService.myHostName;
		
		return hostname;
	});
	
	this.__defineGetter__('port', function () {
		return Zotero.DataServer.port;
	});
	
	this.__defineGetter__('instances', function () {
		var instances = {};
		for (var instance in _instances) {
			instances[instance] = new Zotero.Zeroconf.RemoteLibrary(instance);
		}
		return instances;
	});
	
	var _instances = [];
	var _browseCacheFile = '/tmp/zoteroconf_instances';
	var scriptsLoaded = false;
	
	function init() {
		if (!Zotero.Prefs.get("zeroconf.server.enabled")) {
			this.clientEnabled = false;
			this.serverEnabled = false;
		}
		
		// OS X only, for now
		if (!Zotero.isMac) {
			this.clientEnabled = false;
			this.serverEnabled = false;
			
			// TODO: Why is Windows breaking without this?
			return;
		}
		
		// Make sure we have the client executable
		var file = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(this.clientPath);
		
		if (!file.exists()) {
			Zotero.debug('Not enabling Z(ot)eroconf -- executable not found');
			this.clientEnabled = false;
			this.serverEnabled = false;
			return;
		}
		
		if (!this.serverEnabled) {
			Zotero.debug('Not enabling Z(ot)eroconf');
			return;
		}
		
		var registered = this.registerService();
		if (!registered) {
			return;
		}
		
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		observerService.addObserver({
			observe: function(subject, topic, data) {
				Zotero.Zeroconf.unregisterService();
			}
		}, "quit-application", false);
	}
	
	
	function registerService() {
		var file = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(this.clientPath);
		
		var process = Components.classes["@mozilla.org/process/util;1"].
				createInstance(Components.interfaces.nsIProcess);
		process.init(file);
		
		var args = ["-R", this.displayName, "_zotero._tcp", "local.", this.port];
		
		Zotero.debug("Registering Z(ot)eroconf on port " + this.port);
		process.run(false, args, args.length);
		
		return true;
	}
	
	
	function findInstances(callback) {
		if (!this.clientEnabled) {
			return;
		}
		
		Zotero.debug("Browsing for Z(ot)eroconf instances");
		var file = this.getScript('find_instances');
		
		var process = Components.classes["@mozilla.org/process/util;1"].
				createInstance(Components.interfaces.nsIProcess);
		process.init(file);
		var args = ['find_instances'];
		process.run(false, args, args.length);
		
		// Wait half a second for browse before proceeding
		setTimeout(function () {
			Zotero.Zeroconf.findInstancesCallback(callback);
		}, 500);
	}
	
	
	function findInstancesCallback(callback) {
		var file = Zotero.Zeroconf.getScript('kill_find_instances');
		
		var process = Components.classes["@mozilla.org/process/util;1"].
				createInstance(Components.interfaces.nsIProcess);
		process.init(file);
		var args = ['kill_find_instances'];
		process.run(false, args, args.length);
		
		var file = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(_browseCacheFile);
		
		if (!file.exists()) {
			Zotero.debug(_browseCacheFile + " doesn't exist", 2);
			_instances = {};
			return;
		}
		
		var browseCache = Zotero.File.getContents(file);
		Zotero.debug(browseCache);
		file.remove(null);
		
		// Parse browse output
		var lines = browseCache.split(/\n/);
		var newInstances = {};
		for each(var line in lines) {
			var matches = line.match(/([a-zA-Z\.]+) +_zotero\._tcp\. +(.+)/);
			if (matches) {
				var domain = matches[1];
				var name = matches[2];
				// Skip local host
				if (name == this.displayName) {
					continue;
				}
				newInstances[name] = true;
			}
		}
		
		// Remove expired instances
		for (var instance in _instances) {
			if (!newInstances[instance]) {
				delete _instances[instance];
			}
		}
		
		// Add new instances
		for (var instance in newInstances) {
			_instances[instance] = true;
		}
		
		Zotero.Notifier.trigger('refresh', 'share', 'all');
		
		if (callback) {
			callback();
		}
	}
	
	
	function unregisterService() {
		Zotero.debug("Unregistering Zeroconf service");
		var file = Zotero.Zeroconf.getScript('kill_service');
		
		var process = Components.classes["@mozilla.org/process/util;1"].
				createInstance(Components.interfaces.nsIProcess);
		process.init(file);
		var args = ['kill_service'];
		var ret = process.run(false, args, args.length);
		
		if (ret != 0) {
			Zotero.debug("Zeroconf client not stopped!", 2);
		}
		
		// Remove any zoteroconf files remaining in tmp directory
		var file = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath('/tmp');
		if (!file.exists() || !file.isDirectory()) {
			return;
		}
		try {
			var files = file.directoryEntries;
			while (files.hasMoreElements()) {
				var tmpFile = files.getNext();
				tmpFile.QueryInterface(Components.interfaces.nsILocalFile);
				if (tmpFile.leafName.indexOf('zoteroconf') != -1) {
					tmpFile.remove(null);
				}
			}
		}
		catch (e) {
			Zotero.debug(e);
		}
	}
	
	
	function getScript() {
		var file = Components.classes["@mozilla.org/extensions/manager;1"]
					.getService(Components.interfaces.nsIExtensionManager)
					.getInstallLocation(ZOTERO_CONFIG['GUID'])
					.getItemLocation(ZOTERO_CONFIG['GUID']);
		file.append('scripts');
		file.append('zoteroconf.sh');
		
		// The first time we load the script, do some checks
		if (!scriptsLoaded) {
			if (!file.exists()) {
				throw ('zoteroconf.sh not found in Zotero.Zeroconf.getScript()');
			}
			
			// Make sure the file is executable
			if (file.permissions != 33261) {
				try {
					file.permissions = 33261;
				}
				catch (e) {
					throw ('Cannot make zoteroconf.sh executable in Zotero.Zeroconf.getScript()');
				}
			}
		}
		
		return file;
	}
}



Zotero.Zeroconf.RemoteLibrary = function (name) {
	default xml namespace = '';
	
	this.name = name;
	
	this._host;
	this._port;
	this._items = [];
	this._tmpFile = '/tmp/zoteroconf_info_' + Zotero.randomString(6);
	//this.search = new Zotero.Zeroconf.RemoteLibrary.Search(this);
}

Zotero.Zeroconf.RemoteLibrary.prototype.load = function () {
	Zotero.debug("Getting service info for " + this.name);
	
	var file = Zotero.Zeroconf.getScript('get_info');
	
	var process = Components.classes["@mozilla.org/process/util;1"].
			createInstance(Components.interfaces.nsIProcess);
	process.init(file);
	var args = ['get_info', this.name, this._tmpFile];
	process.run(false, args, args.length);
	
	var self = this;
	
	setTimeout(function () {
		var file = Zotero.Zeroconf.getScript('kill_get_info');
		
		var process = Components.classes["@mozilla.org/process/util;1"].
				createInstance(Components.interfaces.nsIProcess);
		process.init(file);
		var args = ['kill_get_info'];
		process.run(false, args, args.length);
		
		var file = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(self._tmpFile);
		
		var infoCache = Zotero.File.getContents(file);
		Zotero.debug(infoCache);
		file.remove(null);
		
		var lines = infoCache.split(/\n/);
		for each(var line in lines) {
			var matches = line.match(/can be reached at +([^ ]+) *:([0-9]+)/);
			if (matches) {
				self._host = matches[1];
				self._port = matches[2];
				break;
			}
		}
		
		if (self._host) {
			self.loadItems(self);
		}
	}, 250);
}

Zotero.Zeroconf.RemoteLibrary.prototype.loadItems = function (self, noNotify) {
	var url = "http://" + this._host + ':' + this._port;
	Zotero.Utilities.HTTP.doPost(url, '', function (xmlhttp) {
		Zotero.debug(xmlhttp.responseText);
		
		self._items = [];
		var xml = new XML(xmlhttp.responseText);
		for each(var xmlNode in xml.items.item) {
			var obj = Zotero.Sync.Server.Data.xmlToItem(xmlNode, false, true);
			self._items.push(obj);
		}
		
		Zotero.debug("Retrieved " + self._items.length +
				" item" + (self._items.length == 1 ? '' : 's'));
		
		if (!noNotify) {
			Zotero.Notifier.trigger('refresh', 'share-items', 'all');
		}
	});
}

Zotero.Zeroconf.RemoteLibrary.prototype.getAll = function () {
	if (!this._host) {
		this.load();
		return [];
	}
	
	this.loadItems(this, true);
	
	return this._items;
}

/*
Zotero.Zeroconf.RemoteLibrary.Search = function (library) {
	this.library = library;
}

Zotero.Zeroconf.RemoteLibrary.Search.prototype = function () {
	
}
*/
