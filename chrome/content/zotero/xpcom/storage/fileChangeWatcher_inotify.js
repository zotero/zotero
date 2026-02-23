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
 * inotify backend for FileChangeWatcher (Linux)
 *
 * Like the Windows RDCW backend, inotify is a live watcher -- it only captures events from the
 * moment watches are set up. The first getChangedItemKeys() call returns null to trigger a full
 * scan. Periodic full scans every 3 hours ensure no changes are missed permanently.
 *
 * Note: errno values are read from ctypes.errno, which Mozilla ctypes captures immediately after
 * each default_abi call. Using an explicit __errno_location() call would be unreliable because
 * intervening ctypes machinery can reset errno.
 */
Object.assign(Zotero.Sync.Storage.FileChangeWatcher, {
	_libc: null,
	_inotifyFd: -1,
	_inotifyRootWd: -1,
	_inotifyWdToKey: null,         // Map<int, string>
	_inotifyAccumulatedKeys: null, // Set<string>
	_inotifySubdirsSetUp: false,

	// ctypes function declarations for inotify
	_inotifyInit1: null,
	_inotifyAddWatch: null,
	_readFn: null,
	_closeFn: null,

	// inotify constants
	_IN_CLOSE_WRITE: 0x00000008,
	_IN_CREATE: 0x00000100,
	_IN_DELETE: 0x00000200,
	_IN_MOVED_TO: 0x00000080,
	_IN_ISDIR: 0x40000000,
	_IN_Q_OVERFLOW: 0x00004000,
	_IN_NONBLOCK: 0x00000800,
	_IN_CLOEXEC: 0x00080000,
	_EAGAIN: 11,
	_EINTR: 4,
	_ENOSPC: 28,

	_INOTIFY_BUF_SIZE: 8192,
	_inotifyBuf: null,

	_initInotify() {
		let { ctypes } = ChromeUtils.importESModule(
			"resource://gre/modules/ctypes.sys.mjs"
		);
		this._ctypes = ctypes;

		this._libc = ctypes.open("libc.so.6");

		this._inotifyInit1 = this._libc.declare(
			"inotify_init1", ctypes.default_abi,
			ctypes.int, ctypes.int
		);

		this._inotifyAddWatch = this._libc.declare(
			"inotify_add_watch", ctypes.default_abi,
			ctypes.int,
			ctypes.int, ctypes.char.ptr, ctypes.uint32_t
		);

		this._readFn = this._libc.declare(
			"read", ctypes.default_abi, ctypes.ssize_t,
			ctypes.int, ctypes.uint8_t.ptr, ctypes.size_t
		);

		this._closeFn = this._libc.declare(
			"close", ctypes.default_abi,
			ctypes.int, ctypes.int
		);

		this._inotifyBuf = new (ctypes.ArrayType(
			ctypes.uint8_t, this._INOTIFY_BUF_SIZE
		))();

		// Create inotify instance (non-blocking, close-on-exec)
		let fd = this._inotifyInit1(
			this._IN_NONBLOCK | this._IN_CLOEXEC
		);
		if (fd < 0) {
			throw new Error("inotify_init1 failed (errno " + ctypes.errno + ")");
		}
		this._inotifyFd = fd;

		// Watch storage root for new item directories
		let rootWd = this._inotifyAddWatch(
			fd, this._storageRoot,
			this._IN_CREATE | this._IN_MOVED_TO
		);
		if (rootWd < 0) {
			let errno = ctypes.errno;
			this._closeFn(fd);
			this._inotifyFd = -1;
			throw new Error("inotify_add_watch on storage root failed (errno "
				+ errno + ")");
		}
		this._inotifyRootWd = rootWd;

		this._inotifyWdToKey = new Map();
		this._inotifyAccumulatedKeys = new Set();
		this._inotifySubdirsSetUp = false;
		this._liveWatcherFirstCall = true;
	},

	/**
	 * Add inotify watches for all existing item subdirectories. Called lazily on first
	 * getChangedItemKeys() to avoid slowing down startup.
	 */
	_inotifySetupSubdirs() {
		let ctypes = this._ctypes;
		let dir = Zotero.File.pathToFile(this._storageRoot.slice(0, -1));

		let count = 0;
		let entries = dir.directoryEntries;
		while (entries.hasMoreElements()) {
			let entry = entries.getNext().QueryInterface(Ci.nsIFile);
			if (!entry.isDirectory()) continue;
			let name = entry.leafName;
			if (!this._keyPattern.test(name)) continue;

			let wd = this._inotifyAddWatch(
				this._inotifyFd, entry.path,
				this._IN_CLOSE_WRITE | this._IN_MOVED_TO
					| this._IN_CREATE | this._IN_DELETE
			);
			if (wd < 0) {
				if (ctypes.errno === this._ENOSPC) {
					Zotero.debug("FileChangeWatcher: inotify watch limit reached after "
						+ count + " directories -- some changes may be missed");
					break;
				}
				continue;
			}
			this._inotifyWdToKey.set(wd, name);
			count++;
		}

		this._inotifySubdirsSetUp = true;
		Zotero.debug("FileChangeWatcher: Added inotify watches for " + count
			+ " storage directories");
	},

	/**
	 * Non-blocking drain of all pending inotify events into _inotifyAccumulatedKeys.
	 *
	 * @return {boolean} false if an overflow was detected
	 */
	_inotifyDrainEvents() {
		let ctypes = this._ctypes;
		let headerSize = 16; // struct inotify_event fixed part

		while (true) {
			let bytesRead = this._readFn(
				this._inotifyFd,
				this._inotifyBuf.addressOfElement(0),
				this._INOTIFY_BUF_SIZE
			);

			if (bytesRead <= 0) {
				let errno = ctypes.errno;
				if (errno === this._EAGAIN
						|| errno === this._EINTR) {
					break;
				}
				Zotero.debug("FileChangeWatcher: inotify read error (errno " + errno + ")");
				break;
			}

			let offset = 0;
			while (offset + headerSize <= bytesRead) {
				let wdPtr = ctypes.cast(
					this._inotifyBuf.addressOfElement(offset),
					ctypes.int32_t.ptr
				);
				let maskPtr = ctypes.cast(
					this._inotifyBuf.addressOfElement(offset + 4),
					ctypes.uint32_t.ptr
				);
				let lenPtr = ctypes.cast(
					this._inotifyBuf.addressOfElement(
						offset + 12
					),
					ctypes.uint32_t.ptr
				);

				let wd = wdPtr.contents;
				let mask = maskPtr.contents;
				let nameLen = lenPtr.contents;

				if (mask & this._IN_Q_OVERFLOW) {
					Zotero.debug("FileChangeWatcher: inotify queue overflow");
					return false;
				}

				let name = "";
				if (nameLen > 0) {
					let namePtr = ctypes.cast(
						this._inotifyBuf.addressOfElement(
							offset + headerSize
						),
						ctypes.char.ptr
					);
					name = namePtr.readString();
				}

				if (wd === this._inotifyRootWd) {
					if ((mask & (this._IN_CREATE
							| this._IN_MOVED_TO))
							&& (mask & this._IN_ISDIR)
							&& this._keyPattern.test(name)) {
						this._inotifyAccumulatedKeys.add(name);
						let subPath = this._storageRoot + name;
						let subWd = this._inotifyAddWatch(
							this._inotifyFd, subPath,
							this._IN_CLOSE_WRITE
								| this._IN_MOVED_TO
								| this._IN_CREATE
								| this._IN_DELETE
						);
						if (subWd >= 0) {
							this._inotifyWdToKey.set(
								subWd, name
							);
						}
					}
				}
				else {
					let key = this._inotifyWdToKey.get(wd);
					if (key) {
						this._inotifyAccumulatedKeys.add(key);
					}
				}

				offset += headerSize + nameLen;
			}
		}

		return true;
	},

	_getChangedItemKeysInotify() {
		if (!this._inotifySubdirsSetUp) {
			this._inotifySetupSubdirs();
		}

		let ok = this._inotifyDrainEvents();

		// First call or periodic refresh -- signal full scan
		if (this._liveWatcherNeedsFullScan()) {
			Zotero.debug("FileChangeWatcher: Live watcher signaling full scan"
				+ " (first call or periodic refresh)");
			this._inotifyAccumulatedKeys.clear();
			return null;
		}

		// Overflow -- signal full scan
		if (!ok) {
			this._inotifyAccumulatedKeys.clear();
			this._liveWatcherLastFullScanTime = Date.now();
			return null;
		}

		let keys = this._inotifyAccumulatedKeys;
		this._inotifyAccumulatedKeys = new Set();
		return this._returnKeys(keys);
	},

	_closeInotify() {
		if (this._inotifyFd >= 0) {
			this._closeFn(this._inotifyFd);
			this._inotifyFd = -1;
		}
		if (this._libc) {
			this._libc.close();
			this._libc = null;
		}
		this._inotifyWdToKey = null;
		this._inotifyAccumulatedKeys = null;
	},
});
