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
 *
 * The journal is volume-wide, so replaying it can keep fseventsd busy for minutes on a busy
 * volume. Rather than flushing the stream synchronously, the replay is pumped in short run-loop
 * slices between turns of the app's event loop, and a replay that runs too long is abandoned in
 * favor of full scans.
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
	_FSEventStreamStop: null,
	_FSEventStreamInvalidate: null,
	_FSEventStreamRelease: null,
	_CFRunLoopGetCurrent: null,
	_CFRunLoopRunInMode: null,
	_FSEventStreamCallbackType: null,

	// Longest to spend replaying the journal before falling back to full scans
	_MAX_REPLAY_TIME: 30000, // 30 seconds

	// How long each run-loop pump may hold the main thread before yielding to the app
	_REPLAY_SLICE_TIME: 20, // ms

	// Private run-loop mode for the stream, so only the pump calls ever run its callback
	_REPLAY_RUN_LOOP_MODE: "org.zotero.FileChangeWatcher.replay",

	// Stream of a pending replay, holding its callback until native code is done with it
	_activeStream: null,

	// ObjC bridge helpers
	_getClass: null,
	_regSel: null,
	_msg: null,
	_msg_id: null,
	_msg_ptr: null,

	/**
	 * Look up the volume the storage directory is on
	 *
	 * @return {Object|false} - { flags, fsTypeName }, or false if it couldn't be determined
	 */
	_statfsStorageRoot() {
		let { ctypes } = ChromeUtils.importESModule(
			"resource://gre/modules/ctypes.sys.mjs"
		);

		const MFSTYPENAMELEN = 16;
		const MAXPATHLEN = 1024;

		let statfs_t = new ctypes.StructType("statfs", [
			{ f_bsize: ctypes.uint32_t },
			{ f_iosize: ctypes.int32_t },
			{ f_blocks: ctypes.uint64_t },
			{ f_bfree: ctypes.uint64_t },
			{ f_bavail: ctypes.uint64_t },
			{ f_files: ctypes.uint64_t },
			{ f_ffree: ctypes.uint64_t },
			{ f_fsid: ctypes.ArrayType(ctypes.int32_t, 2) },
			{ f_owner: ctypes.uint32_t },
			{ f_type: ctypes.uint32_t },
			{ f_flags: ctypes.uint32_t },
			{ f_fssubtype: ctypes.uint32_t },
			{ f_fstypename: ctypes.ArrayType(ctypes.char, MFSTYPENAMELEN) },
			{ f_mntonname: ctypes.ArrayType(ctypes.char, MAXPATHLEN) },
			{ f_mntfromname: ctypes.ArrayType(ctypes.char, MAXPATHLEN) },
			{ f_flags_ext: ctypes.uint32_t },
			{ f_reserved: ctypes.ArrayType(ctypes.uint32_t, 7) }
		]);

		let lib;
		try {
			lib = ctypes.open("/usr/lib/libSystem.dylib");
			let statfsFn;
			// x86_64 keeps the 32-bit-inode statfs() under the plain name and the 64-bit-inode
			// version under a suffixed symbol, while on arm64 statfs() is already 64-bit-inode
			for (let symbol of ["statfs$INODE64", "statfs"]) {
				try {
					statfsFn = lib.declare(
						symbol, ctypes.default_abi, ctypes.int,
						ctypes.char.ptr, statfs_t.ptr
					);
					break;
				}
				catch (e) {
					Zotero.debug("FileChangeWatcher: No " + symbol + "() symbol");
				}
			}
			if (!statfsFn) {
				throw new Error("statfs() not available");
			}
			let sb = statfs_t();
			if (statfsFn(this._storageRoot, sb.address()) != 0) {
				throw new Error("statfs() failed for " + this._storageRoot);
			}
			return {
				flags: sb.f_flags,
				fsTypeName: sb.f_fstypename.readString()
			};
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		finally {
			if (lib) {
				lib.close();
			}
		}
	},

	/**
	 * Whether the storage directory is on a volume that FSEvents covers
	 *
	 * FSEvents is backed by a per-volume journal that only local volumes have. On a network
	 * mount the stream is created and started successfully but never delivers any events, so
	 * the watcher would report that nothing had changed for as long as it was used.
	 */
	_storageRootIsLocalVolume() {
		const MNT_LOCAL = 0x00001000;

		let info = this._statfsStorageRoot();
		if (!info) {
			return false;
		}
		if (!(info.flags & MNT_LOCAL)) {
			Zotero.debug("FileChangeWatcher: Storage directory is on a " + info.fsTypeName
				+ " volume, which FSEvents doesn't cover");
			return false;
		}
		return true;
	},

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

		this._CFRunLoopRunInMode = this._cfLib.declare(
			"CFRunLoopRunInMode", ctypes.default_abi,
			ctypes.int32_t, ctypes.voidptr_t, ctypes.double, ctypes.bool
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

	/**
	 * Replay the journal since the saved event ID and collect the keys of changed storage folders
	 *
	 * @return {Promise<Set|null>} - Changed item keys, or null to signal full scans
	 */
	async _getChangedItemKeysFSEvents() {
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

		if (this._activeStream) {
			Zotero.debug("FileChangeWatcher: FSEvents replay already in progress"
				+ " -- signaling full scan");
			return null;
		}

		// kFSEventStreamEventFlag flags indicating that events were dropped or coalesced,
		// so changes may be missing from the replay
		const MUST_SCAN_SUBDIRS = 0x01;
		const USER_DROPPED = 0x02;
		const KERNEL_DROPPED = 0x04;
		const EVENT_IDS_WRAPPED = 0x08;
		// Sentinel event marking the end of historical events -- not a file change
		const HISTORY_DONE = 0x10;

		let changedKeys = new Set();
		let droppedEvents = false;
		let historyDone = false;
		let storageRoot = this._storageRoot;
		let keyPattern = this._keyPattern;

		let callbackFn = this._FSEventStreamCallbackType.ptr(function (
			_streamRef, _info, numEvents, eventPaths,
			eventFlags, _eventIds
		) {
			let n = Number(numEvents);
			let StringArray = ctypes.ArrayType(ctypes.char.ptr, n);
			let paths = ctypes.cast(
				eventPaths, StringArray.ptr
			).contents;
			let FlagsArray = ctypes.ArrayType(ctypes.uint32_t, n);
			let flags = ctypes.cast(
				eventFlags, FlagsArray.ptr
			).contents;
			for (let i = 0; i < n; i++) {
				let f = flags[i];
				if (f & (MUST_SCAN_SUBDIRS | USER_DROPPED
						| KERNEL_DROPPED | EVENT_IDS_WRAPPED)) {
					droppedEvents = true;
					continue;
				}
				if (f & HISTORY_DONE) {
					historyDone = true;
					continue;
				}
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

		// Native code holds a pointer to the callback until the stream is released, so keep the
		// closure referenced where close() can also find the stream to tear it down
		this._activeStream = { stream, callbackFn, started: false };
		const kCFRunLoopRunFinished = 1;
		let outcome = 'timeout';
		// Where the next replay resumes from
		let resumeId;
		try {
			let runLoop = this._CFRunLoopGetCurrent();
			this._FSEventStreamScheduleWithRunLoop(
				stream, runLoop, this._nsStr(this._REPLAY_RUN_LOOP_MODE)
			);

			if (!this._FSEventStreamStart(stream)) {
				Zotero.debug("FileChangeWatcher: FSEventStreamStart failed");
				return null;
			}
			this._activeStream.started = true;

			// fseventsd walks the journal in its own process, so pump the stream's run-loop
			// source in short slices and let the app handle its own events in between
			let maxSlices = Math.ceil(this._MAX_REPLAY_TIME / this._REPLAY_SLICE_TIME);
			for (let i = 0; i < maxSlices; i++) {
				// The mode string is autoreleased, so make it afresh for each slice
				let result = this._CFRunLoopRunInMode(
					this._nsStr(this._REPLAY_RUN_LOOP_MODE),
					this._REPLAY_SLICE_TIME / 1000,
					false
				);
				if (historyDone) {
					outcome = 'done';
					break;
				}
				if (result == kCFRunLoopRunFinished) {
					// Nothing scheduled in the mode, so the stream can never deliver
					outcome = 'unscheduled';
					break;
				}
				await Zotero.Promise.delay(0);
				if (!this._activeStream) {
					outcome = 'closed';
					break;
				}
			}

			if (outcome == 'done') {
				// Resume the next replay from the current ID, which covers everything delivered
				// so far, and then drain anything the service queued before the ID was read
				resumeId = this._FSEventsGetCurrentEventId();
				this._CFRunLoopRunInMode(
					this._nsStr(this._REPLAY_RUN_LOOP_MODE),
					this._REPLAY_SLICE_TIME / 1000,
					false
				);
			}
		}
		finally {
			this._releaseActiveStream();
		}

		if (outcome == 'closed') {
			// The saved event ID wasn't advanced, so the next replay covers this span again
			Zotero.debug("FileChangeWatcher: FSEvents replay interrupted -- keeping saved event ID");
			return new Set();
		}

		if (outcome != 'done') {
			// The full scans triggered by the fallback cover everything up to now, so resuming
			// from the current ID is safe
			resumeId = this._FSEventsGetCurrentEventId();
		}
		Zotero.Prefs.set(
			"sync.storage.watcher.fsEventsEventID", resumeId.toString()
		);

		if (outcome != 'done') {
			Zotero.debug("FileChangeWatcher: FSEvents replay didn't finish (" + outcome
				+ ") -- signaling full scan");
			return null;
		}

		if (droppedEvents) {
			// As with an unfinished replay, the fallback scans cover everything up to now
			Zotero.debug("FileChangeWatcher: FSEvents reported dropped or coalesced events"
				+ " -- signaling full scan");
			return null;
		}

		return this._returnKeys(changedKeys);
	},

	/**
	 * Stop and release the stream of a pending replay, which then ends as 'closed'
	 */
	_releaseActiveStream() {
		let active = this._activeStream;
		if (!active) {
			return;
		}
		this._activeStream = null;
		if (active.started) {
			this._FSEventStreamStop(active.stream);
		}
		this._FSEventStreamInvalidate(active.stream);
		this._FSEventStreamRelease(active.stream);
	},

	_closeFSEvents() {
		this._releaseActiveStream();
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
