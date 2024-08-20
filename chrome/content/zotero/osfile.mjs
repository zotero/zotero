//
// Compatibility shims from the Mozilla codebase
//
const isWin = Services.appinfo.OS == 'WINNT';

export let OS = {
	Constants: {
		Path: {
			get homeDir() {
				return FileUtils.getDir("Home", []).path;
			},
			
			get libDir() {
				return FileUtils.getDir("GreBinD", []).path;
			},
			
			get profileDir() {
				return FileUtils.getDir("ProfD", []).path;
			},
			
			get tmpDir() {
				return FileUtils.getDir("TmpD", []).path;
			},
		}
	},
	
	File: {
		DirectoryIterator: function (path) {
			var initialized = false;
			var paths = [];
			
			async function init() {
				paths.push(...await IOUtils.getChildren(path));
				initialized = true;
			}
			
			async function getEntry(path) {
				var info = await IOUtils.stat(path);
				return {
					name: PathUtils.filename(path),
					path,
					isDir: info.type == 'directory'
				};
			}
			
			this.nextBatch = async function (num) {
				if (!initialized) {
					await init();
				}
				var entries = [];
				while (paths.length && num > 0) {
					entries.push(await getEntry(paths.shift()));
					num--;
				}
				return entries;
			};
			
			this.forEach = async function (func) {
				if (!initialized) {
					await init();
				}
				var i = 0;
				while (paths.length) {
					let entry = await getEntry(paths.shift());
					await func(entry, i++, this);
				}
			};
			
			this.close = function () {};
		},
		
		Error: function (msg) {
			this.message = msg;
			this.stack = new Error().stack;
		},
		
		copy: wrapWrite(async function (src, dest) {
			return IOUtils.copy(src, dest);
		}),
		
		exists: async function (path) {
			try {
				return await IOUtils.exists(path);
			}
			catch (e) {
				if (e.message.includes('NS_ERROR_FILE_UNRECOGNIZED_PATH')) {
					dump(e.message + "\n\n" + e.stack + "\n\n");
					Components.utils.reportError(e);
					return false;
				}
			}
		},
		
		makeDir: wrapWrite(async function (path, options = {}) {
			try {
				return await IOUtils.makeDirectory(
					path,
					{
						ignoreExisting: options.ignoreExisting !== false,
						createAncestors: !!options.from,
						permissions: options.unixMode
					}
				);
			}
			catch (e) {
				// Broken symlink
				if (e.name == 'InvalidAccessError') {
					if (/Could not create directory because the target file(.+) exists and is not a directory/.test(e.message)) {
						let osFileError = new OS.File.Error(e.message);
						osFileError.becauseExists = true;
						throw osFileError;
					}
				}
			}
		}),
		
		move: wrapWrite(async function (src, dest, options = {}) {
			if (options.noCopy) {
				throw new Error("noCopy is no longer supported");
			}
			
			// Check noOverwrite
			var destFileInfo = null;
			try {
				destFileInfo = await IOUtils.stat(dest)
			}
			catch (e) {
				if (e.name != 'NotFoundError') {
					throw e;
				}
			}
			if (destFileInfo) {
				if (destFileInfo.type == 'directory') {
					throw new Error("OS.File.move() destination cannot be a directory -- use IOUtils.move()");
				}
				if (options.noOverwrite) {
					let e = new OS.File.Error;
					e.becauseExists = true;
					throw e;
				}
			}
			
			return IOUtils.move(src, dest, options);
		}),
		
		read: async function (path, options = {}) {
			if (options.encoding) {
				if (!/^utf\-?8$/i.test(options.encoding)) {
					throw new Error("Can only read UTF-8");
				}
				return IOUtils.readUTF8(path);
			}
			return IOUtils.read(
				path,
				{
					maxBytes: options.bytes
				}
			);
		},
		
		remove: async function (path, options = {}) {
			return IOUtils.remove(path, options);
		},
		
		removeDir: async function (path, options = {}) {
			return IOUtils.remove(
				path,
				{
					recursive: true,
					// OS.File.removeDir defaulted to ignoreAbsent: true
					ignoreAbsent: options.ignoreAbsent !== false
				}
			);
		},
		
		removeEmptyDir: async function (path) {
			return IOUtils.remove(path);
		},
		
		setDates: async function (path, atime, mtime) {
			if (atime) {
				await IOUtils.setAccessTime(path, atime.valueOf());
			}
			return await IOUtils.setModificationTime(path, mtime ? mtime.valueOf() : undefined);
		},
		
		setPermissions: async function (path, { unixMode, winAttributes } = {}) {
			await IOUtils.setPermissions(path, unixMode);
			if (winAttributes && isWin) {
				let { readOnly, hidden, system } = winAttributes;
				await IOUtils.setWindowsAttributes(path, { readOnly, hidden, system });
			}
		},
		
		stat: async function stat(path) {
			var info;
			try {
				info = await IOUtils.stat(path);
			}
			catch (e) {
				if (e.name == 'NotFoundError') {
					let osFileError = new this.Error("File not found");
					osFileError.becauseNoSuchFile = true;
					throw osFileError;
				}
				throw e;
			}
			return {
				isDir: info.type == 'directory',
				isSymLink: true, // Supposedly was broken in Firefox
				size: info.size,
				lastAccessDate: new Date(info.lastAccessed),
				lastModificationDate: new Date(info.lastModified),
				unixMode: !isWin ? info.permissions : undefined,
			};
		},
		
		unixSymLink: async function (pathTarget, pathCreate) {
			if (await IOUtils.exists(pathCreate)) {
				let osFileError = new this.Error(pathCreate + " already exists");
				osFileError.becauseExists = true;
				throw osFileError;
			}
			
			// Copy of Zotero.File.createSymlink
			const { ctypes } = ChromeUtils.importESModule(
				"resource://gre/modules/ctypes.sys.mjs"
			);
			
			try {
				if (Services.appinfo.OS === "Darwin") {
					const libc = ctypes.open(
						Services.appinfo.OS === "Darwin" ? "libSystem.B.dylib" : "libc.so"
					);
					
					const symlink = libc.declare(
						"symlink",
						ctypes.default_abi,
						ctypes.int, // return value
						ctypes.char.ptr, // target
						ctypes.char.ptr //linkpath
					);
					
					if (symlink(pathTarget, pathCreate)) {
						throw new Error("Failed to create symlink at " + pathCreate);
					}
				}
				// The above is failing with "invalid ELF header" for libc.so on GitHub Actions, so
				// just use ln -s on non-macOS systems
				else {
					let ln = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
					ln.initWithPath("/bin/ln");
					let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
					process.init(ln);
					let args = ["-s", pathTarget, pathCreate];
					process.run(true, args, args.length);
				}
			}
			catch (e) {
				dump(e.message + "\n\n");
				throw new Error("Failed to create symlink at " + pathCreate);
			}
		},
		
		writeAtomic: async function (path, bytes, options = {}) {
			if (options.backupTo) {
				options.backupFile = options.backupTo;
			}
			if (options.noOverwrite) {
				options.mode = 'create';
			}
			if (options.encoding == 'utf-8') {
				return IOUtils.writeUTF8(path, bytes, options);
			}
			return IOUtils.write(path, bytes, options);
		},
	},
	
	Path: {
		basename: function (path) {
			return PathUtils.filename(path);
		},
		
		dirname: function (path) {
			return PathUtils.parent(path);
		},
		
		fromFileURI: function (uri) {
			if (Services.appinfo.OS == "WINNT") {
				let url = new URL(uri);
				if (url.protocol != "file:") {
					throw new Error("fromFileURI expects a file URI");
				}
			
				// strip leading slash, since Windows paths don't start with one
				uri = url.pathname.substr(1);
			
				let path = decodeURI(uri);
				// decode a few characters where URL's parsing is overzealous
				path = path.replace(/%(3b|3f|23)/gi, match => decodeURIComponent(match));
				path = this.normalize(path);
			
				// this.normalize() does not remove the trailing slash if the path
				// component is a drive letter. eg. 'C:\'' will not get normalized.
				if (path.endsWith(":\\")) {
					path = path.substr(0, path.length - 1);
				}
				return this.normalize(path);
			}
			
			let url = new URL(uri);
			if (url.protocol != "file:") {
				throw new Error("fromFileURI expects a file URI");
			}
			let path = this.normalize(decodeURIComponent(url.pathname));
			return path;
		},
		
		join: function (path, ...args) {
			var platformSlash = Services.appinfo.OS == 'WINNT' ? '\\' : '/';
			try {
				if (args.length == 0) {
					return path;
				}
				if (args.length == 1 && args[0].includes(platformSlash)) {
					return PathUtils.joinRelative(path, ...args);
				}
				return PathUtils.join(path, ...args);
			}
			catch (e) {
				if (e.message.includes('NS_ERROR_FILE_UNRECOGNIZED_PATH')) {
					Cu.reportError("WARNING: " + e.message + " -- update for IOUtils");
					return [path, ...args].join(platformSlash);
				}
				throw e;
			}
		},
		
		// From Firefox 102
		normalize: function (path) {
			if (Services.appinfo.OS == "WINNT") {
				let stack = [];
				
				if (!path.startsWith("\\\\")) {
					// Normalize "/" to "\\"
					path = path.replace(/\//g, "\\");
				}
				
				// Remove the drive (we will put it back at the end)
				let root = winGetDrive(path);
				if (root) {
					path = path.slice(root.length);
				}
				
				// Remember whether we need to restore a leading "\\" or drive name.
				let absolute = winIsAbsolute(path);
				
				// And now, fill |stack| from the components,
				// popping whenever there is a ".."
				path.split("\\").forEach(function loop(v) {
					switch (v) {
						case "":
						case ".": // Ignore
							break;
						case "..":
							if (!stack.length) {
								if (absolute) {
									throw new Error("Path is ill-formed: attempting to go past root");
								} else {
									stack.push("..");
								}
							} else if (stack[stack.length - 1] == "..") {
								stack.push("..");
							} else {
								stack.pop();
							}
							break;
						default:
							stack.push(v);
					}
				});
				
				// Put everything back together
				let result = stack.join("\\");
				if (absolute || root) {
					result = "\\" + result;
				}
				if (root) {
					result = root + result;
				}
				return result;
			}
			
			let stack = [];
			let absolute;
			if (path.length >= 0 && path[0] == "/") {
				absolute = true;
			}
			else {
				absolute = false;
			}
			path.split("/").forEach(function (v) {
				switch (v) {
					case "":
					case ".": // fallthrough
						break;
					case "..":
						if (!stack.length) {
							if (absolute) {
								throw new Error("Path is ill-formed: attempting to go past root");
							}
							else {
								stack.push("..");
							}
						}
						else if (stack[stack.length - 1] == "..") {
							stack.push("..");
						}
						else {
							stack.pop();
						}
						break;
					default:
						stack.push(v);
				}
			});
			let string = stack.join("/");
			return absolute ? "/" + string : string;
		},
		
		split: function (path) {
			if (Services.appinfo.OS == "WINNT") {
				// winIsAbsolute()
				let index = path.indexOf(":");
				let absolute = path.length > index + 1 && path[index + 1] == "\\";
				
				return {
					absolute,
					winDrive: winGetDrive(path),
					components: path.split("\\")
				};
			}
			
			return {
				absolute: path.length && path[0] == "/",
				components: path.split("/")
			};
		},
		
		toFileURI: function (path) {
			return PathUtils.toFileURI(path);
		},
	}
};

// From Fx60 ospath_win.jsm
var winGetDrive = function (path) {
	if (path == null) {
		throw new TypeError("path is invalid");
	}
	
	if (path.startsWith("\\\\")) {
		// UNC path
		if (path.length == 2) {
			return null;
		}
		let index = path.indexOf("\\", 2);
		if (index == -1) {
			return path;
		}
		return path.slice(0, index);
	}
	// Non-UNC path
	let index = path.indexOf(":");
	if (index <= 0) return null;
	return path.slice(0, index + 1);
};

var winIsAbsolute = function (path) {
	let index = path.indexOf(":");
	return path.length > index + 1 && path[index + 1] == "\\";
};

function wrapWrite(func) {
	return async function () {
		try {
			return await func(...arguments);
		}
		catch (e) {
			if (DOMException.isInstance(e)) {
				if (e.name == 'NoModificationAllowedError') {
					e.becauseExists = true;
				}
			}
			throw e;
		}
	};
}