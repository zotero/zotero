/* eslint-disable */
/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
	                 Vienna, Virginia, USA
	                 https://www.zotero.org

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

/**
 * FSEvents backend for FileChangeWatcher (macOS)
 *
 * Uses the macOS FSEvents persistent event journal to detect which storage files have changed
 * since the last sync. The event ID is saved to a pref so changes that occur while Zotero is
 * closed are still detected.
 */
Object.assign(Zotero.Sync.Storage.FileChangeWatcher, {
	_ctypes: null,
	_objcLib: null,
	_coreServicesLib: null,
	_cfLib: null,

	// Cached ctypes declarations
	_FSEventsGetCurrentEventId: null,
	_FSEventStreamCreate: null,
	_FSEventStreamScheduleWithRunLoop: null,
	_FSEventStreamStart: null,
	_FSEventStreamFlushSync: null,
	_FSEventStreamStop: null,
	_FSEventStreamInvalidate: null,
	_FSEventStreamRelease: null,
	_CFRunLoopGetCurrent: null,
	_FSEventStreamCallbackType: null,

	// ObjC bridge helpers
	_getClass: null,
	_regSel: null,
	_msg: null,
	_msg_id: null,
	_msg_ptr: null,

	_initFSEvents() {
		let { ctypes } = ChromeUtils.importESModule(
			"resource://gre/modules/ctypes.sys.mjs"
		);
		this._ctypes = ctypes;

		let id = ctypes.voidptr_t;
		let SEL = ctypes.voidptr_t;

		this._objcLib = ctypes.open("/usr/lib/libobjc.dylib");
		this._coreServicesLib = ctypes.open(
			"/System/Library/Frameworks/CoreServices.framework"
				+ "/CoreServices"
		);
		this._cfLib = ctypes.open(
			"/System/Library/Frameworks/CoreFoundation.framework"
				+ "/CoreFoundation"
		);

		// ObjC bridge -- just enough for NSString/NSArray creation
		this._getClass = this._objcLib.declare(
			"objc_getClass", ctypes.default_abi, id, ctypes.char.ptr
		);
		this._regSel = this._objcLib.declare(
			"sel_registerName", ctypes.default_abi, SEL, ctypes.char.ptr
		);
		this._msg = this._objcLib.declare(
			"objc_msgSend", ctypes.default_abi, id, id, SEL
		);
		this._msg_id = this._objcLib.declare(
			"objc_msgSend", ctypes.default_abi, id, id, SEL, id
		);
		this._msg_ptr = this._objcLib.declare(
			"objc_msgSend", ctypes.default_abi, id, id, SEL,
			ctypes.char.ptr
		);

		// FSEvents functions
		this._FSEventsGetCurrentEventId = this._coreServicesLib.declare(
			"FSEventsGetCurrentEventId",
			ctypes.default_abi, ctypes.uint64_t
		);

		this._FSEventStreamCallbackType = ctypes.FunctionType(
			ctypes.default_abi, ctypes.void_t,
			[
				ctypes.voidptr_t, ctypes.voidptr_t,
				ctypes.size_t, ctypes.voidptr_t,
				ctypes.voidptr_t, ctypes.voidptr_t,
			]
		);

		this._FSEventStreamCreate = this._coreServicesLib.declare(
			"FSEventStreamCreate", ctypes.default_abi,
			ctypes.voidptr_t,
			ctypes.voidptr_t, this._FSEventStreamCallbackType.ptr,
			ctypes.voidptr_t, ctypes.voidptr_t,
			ctypes.uint64_t, ctypes.double, ctypes.uint32_t
		);

		this._FSEventStreamScheduleWithRunLoop
			= this._coreServicesLib.declare(
				"FSEventStreamScheduleWithRunLoop",
				ctypes.default_abi, ctypes.void_t,
				ctypes.voidptr_t, ctypes.voidptr_t, ctypes.voidptr_t
			);

		this._FSEventStreamStart = this._coreServicesLib.declare(
			"FSEventStreamStart", ctypes.default_abi,
			ctypes.bool, ctypes.voidptr_t
		);

		this._FSEventStreamFlushSync = this._coreServicesLib.declare(
			"FSEventStreamFlushSync", ctypes.default_abi,
			ctypes.void_t, ctypes.voidptr_t
		);

		this._FSEventStreamStop = this._coreServicesLib.declare(
			"FSEventStreamStop", ctypes.default_abi,
			ctypes.void_t, ctypes.voidptr_t
		);

		this._FSEventStreamInvalidate = this._coreServicesLib.declare(
			"FSEventStreamInvalidate", ctypes.default_abi,
			ctypes.void_t, ctypes.voidptr_t
		);

		this._FSEventStreamRelease = this._coreServicesLib.declare(
			"FSEventStreamRelease", ctypes.default_abi,
			ctypes.void_t, ctypes.voidptr_t
		);

		this._CFRunLoopGetCurrent = this._cfLib.declare(
			"CFRunLoopGetCurrent", ctypes.default_abi,
			ctypes.voidptr_t
		);

		// Check for data directory change since last run
		let savedPath = Zotero.Prefs.get(
			"sync.storage.watcher.fsEventsStoragePath"
		);
		if (savedPath && savedPath !== this._storageRoot) {
			Zotero.debug("FileChangeWatcher: Storage path changed -- clearing saved event ID");
			Zotero.Prefs.clear("sync.storage.watcher.fsEventsEventID");
		}
		Zotero.Prefs.set("sync.storage.watcher.fsEventsStoragePath", this._storageRoot);
	},

	_cls(name) {
		return this._getClass(name);
	},

	_sel(name) {
		return this._regSel(name);
	},

	_nsStr(str) {
		return this._msg_ptr(
			this._cls("NSString"),
			this._sel("stringWithUTF8String:"),
			str
		);
	},

	_getChangedItemKeysFSEvents() {
		let ctypes = this._ctypes;

		// If no saved event ID, record baseline and signal full scan
		let savedIdStr = Zotero.Prefs.get(
			"sync.storage.watcher.fsEventsEventID"
		);
		if (!savedIdStr) {
			let currentId = this._FSEventsGetCurrentEventId();
			Zotero.Prefs.set(
				"sync.storage.watcher.fsEventsEventID", currentId.toString()
			);
			Zotero.debug("FileChangeWatcher: No saved event ID -- recorded baseline "
				+ currentId + ", signaling full scan");
			return null;
		}
		let sinceEventId = ctypes.UInt64(savedIdStr);

		let changedKeys = new Set();
		let storageRoot = this._storageRoot;
		let keyPattern = this._keyPattern;

		let callbackFn = this._FSEventStreamCallbackType.ptr(function (
			_streamRef, _info, numEvents, eventPaths,
			_eventFlags, _eventIds
		) {
			let n = Number(numEvents);
			let StringArray = ctypes.ArrayType(ctypes.char.ptr, n);
			let paths = ctypes.cast(
				eventPaths, StringArray.ptr
			).contents;
			for (let i = 0; i < n; i++) {
				let p = paths[i].readString();
				if (!p.startsWith(storageRoot)) continue;
				let relative = p.substring(storageRoot.length);
				let slashIdx = relative.indexOf("/");
				let key = slashIdx > 0
					? relative.substring(0, slashIdx)
					: relative;
				if (keyPattern.test(key)) {
					changedKeys.add(key);
				}
			}
		});

		let pathNS = this._nsStr(this._storageRoot);
		let pathsArray = this._msg_id(
			this._cls("NSArray"),
			this._sel("arrayWithObject:"),
			pathNS
		);

		// kFSEventStreamCreateFlagNoDefer |
		// kFSEventStreamCreateFlagFileEvents
		let flags = 0x02 | 0x10;

		let stream = this._FSEventStreamCreate(
			null, callbackFn, null, pathsArray,
			sinceEventId, 0.0, flags
		);

		if (stream.isNull()) {
			Zotero.debug("FileChangeWatcher: FSEventStreamCreate returned null");
			return null;
		}

		try {
			let runLoop = this._CFRunLoopGetCurrent();
			let runLoopMode = this._nsStr("kCFRunLoopDefaultMode");
			this._FSEventStreamScheduleWithRunLoop(
				stream, runLoop, runLoopMode
			);

			let started = this._FSEventStreamStart(stream);
			if (!started) {
				Zotero.debug("FileChangeWatcher: FSEventStreamStart failed");
				return null;
			}

			this._FSEventStreamFlushSync(stream);
			this._FSEventStreamStop(stream);
		}
		finally {
			this._FSEventStreamInvalidate(stream);
			this._FSEventStreamRelease(stream);
		}

		let newEventId = this._FSEventsGetCurrentEventId();
		Zotero.Prefs.set(
			"sync.storage.watcher.fsEventsEventID", newEventId.toString()
		);

		return this._returnKeys(changedKeys);
	},

	_closeFSEvents() {
		if (this._objcLib) {
			this._objcLib.close();
			this._objcLib = null;
		}
		if (this._coreServicesLib) {
			this._coreServicesLib.close();
			this._coreServicesLib = null;
		}
		if (this._cfLib) {
			this._cfLib.close();
			this._cfLib = null;
		}
	},
});
