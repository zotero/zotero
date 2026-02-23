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
 * ReadDirectoryChangesW backend for FileChangeWatcher (Windows)
 *
 * Uses overlapped I/O with ReadDirectoryChangesW to watch the storage directory recursively.
 * Unlike the previous USN Change Journal backend, this works without admin privileges -- it only
 * needs read access to the storage directory itself.
 *
 * This is a live watcher (like inotify on Linux): the first getChangedItemKeys() call returns null
 * to trigger a full scan, then accumulates changes between calls. Periodic full scans every 3 hours
 * via _liveWatcherNeedsFullScan() ensure no changes are missed permanently.
 *
 * Approach -- overlapped I/O polling:
 *   1. Init: Open storage directory with FILE_FLAG_OVERLAPPED, create an event handle, issue the
 *      first ReadDirectoryChangesW call (returns immediately, queues the request)
 *   2. Poll (getChangedItemKeys): Call GetOverlappedResult(bWait=FALSE) -- non-blocking check.
 *      If data ready, parse FILE_NOTIFY_INFORMATION records, extract item keys, re-arm.
 *      If not ready, return accumulated keys (may be empty).
 *   3. Close: Close directory handle (auto-cancels pending I/O), close event handle, close kernel32
 *
 * Note: Win32 error codes are read from ctypes.winLastError, which Mozilla ctypes captures
 * immediately after each winapi_abi call. Using an explicit GetLastError() declaration would be
 * unreliable because intervening ctypes machinery can reset the thread error.
 */
Object.assign(Zotero.Sync.Storage.FileChangeWatcher, {
	_kernel32: null,
	_ctypes: null,
	_dirHandle: null,
	_eventHandle: null,
	_overlapped: null,
	_rdcwBuf: null,
	_rdcwAccumulatedKeys: null,
	_rdcwPending: false,

	// ctypes function declarations
	_CreateFileW: null,
	_CloseHandle: null,
	_ReadDirectoryChangesW: null,
	_GetOverlappedResult: null,
	_CreateEventW: null,

	// OVERLAPPED struct type
	_OVERLAPPED: null,

	// Windows constants
	_FILE_LIST_DIRECTORY: 0x0001,
	_FILE_SHARE_READ: 0x00000001,
	_FILE_SHARE_WRITE: 0x00000002,
	_FILE_SHARE_DELETE: 0x00000004,
	_OPEN_EXISTING: 3,
	_FILE_FLAG_BACKUP_SEMANTICS: 0x02000000,
	_FILE_FLAG_OVERLAPPED: 0x40000000,

	// Notify filter -- watch for file/dir name changes, size changes, and last-write changes
	_RDCW_NOTIFY_FILTER: 0x00000001   // FILE_NOTIFY_CHANGE_FILE_NAME
		| 0x00000002                   // FILE_NOTIFY_CHANGE_DIR_NAME
		| 0x00000008                   // FILE_NOTIFY_CHANGE_SIZE
		| 0x00000010,                  // FILE_NOTIFY_CHANGE_LAST_WRITE

	_RDCW_BUF_SIZE: 65536,

	// Expected overlapped I/O error codes
	_ERROR_IO_INCOMPLETE: 996,
	_ERROR_IO_PENDING: 997,
	_ERROR_NOTIFY_ENUM_DIR: 1022,

	_initRDCW() {
		let { ctypes } = ChromeUtils.importESModule(
			"resource://gre/modules/ctypes.sys.mjs"
		);
		this._ctypes = ctypes;

		this._kernel32 = ctypes.open("kernel32.dll");

		// ---- Struct types ----

		this._OVERLAPPED = new ctypes.StructType("OVERLAPPED", [
			{ "Internal": ctypes.uintptr_t },
			{ "InternalHigh": ctypes.uintptr_t },
			{ "OffsetLow": ctypes.uint32_t },
			{ "OffsetHigh": ctypes.uint32_t },
			{ "hEvent": ctypes.voidptr_t },
		]);

		// ---- Function declarations ----

		this._CreateFileW = this._kernel32.declare(
			"CreateFileW", ctypes.winapi_abi,
			ctypes.voidptr_t,      // HANDLE
			ctypes.char16_t.ptr,   // lpFileName
			ctypes.uint32_t,       // dwDesiredAccess
			ctypes.uint32_t,       // dwShareMode
			ctypes.voidptr_t,      // lpSecurityAttributes
			ctypes.uint32_t,       // dwCreationDisposition
			ctypes.uint32_t,       // dwFlagsAndAttributes
			ctypes.voidptr_t       // hTemplateFile
		);

		this._CloseHandle = this._kernel32.declare(
			"CloseHandle", ctypes.winapi_abi,
			ctypes.bool, ctypes.voidptr_t
		);

		this._ReadDirectoryChangesW = this._kernel32.declare(
			"ReadDirectoryChangesW", ctypes.winapi_abi,
			ctypes.bool,
			ctypes.voidptr_t,      // hDirectory
			ctypes.voidptr_t,      // lpBuffer
			ctypes.uint32_t,       // nBufferLength
			ctypes.bool,           // bWatchSubtree
			ctypes.uint32_t,       // dwNotifyFilter
			ctypes.uint32_t.ptr,   // lpBytesReturned
			ctypes.voidptr_t,      // lpOverlapped (OVERLAPPED*)
			ctypes.voidptr_t       // lpCompletionRoutine
		);

		this._GetOverlappedResult = this._kernel32.declare(
			"GetOverlappedResult", ctypes.winapi_abi,
			ctypes.bool,
			ctypes.voidptr_t,      // hFile
			ctypes.voidptr_t,      // lpOverlapped (OVERLAPPED*)
			ctypes.uint32_t.ptr,   // lpNumberOfBytesTransferred
			ctypes.bool            // bWait
		);

		this._CreateEventW = this._kernel32.declare(
			"CreateEventW", ctypes.winapi_abi,
			ctypes.voidptr_t,      // HANDLE return
			ctypes.voidptr_t,      // lpEventAttributes
			ctypes.bool,           // bManualReset
			ctypes.bool,           // bInitialState
			ctypes.voidptr_t       // lpName
		);

		// ---- Open storage directory ----

		let dirPath = this._storageRoot.slice(0, -1); // remove trailing backslash
		let dirPathBuf = ctypes.char16_t.array()(dirPath);

		let handle = this._CreateFileW(
			dirPathBuf,
			this._FILE_LIST_DIRECTORY,
			this._FILE_SHARE_READ | this._FILE_SHARE_WRITE | this._FILE_SHARE_DELETE,
			null,
			this._OPEN_EXISTING,
			this._FILE_FLAG_BACKUP_SEMANTICS | this._FILE_FLAG_OVERLAPPED,
			null
		);
		// INVALID_HANDLE_VALUE is (HANDLE)-1 -- cast to intptr_t to check
		if (ctypes.cast(handle, ctypes.intptr_t).value.toString() === "-1") {
			throw new Error("Cannot open storage directory for watching (error "
				+ ctypes.winLastError + ")");
		}
		this._dirHandle = handle;

		// ---- Create event for overlapped I/O ----

		let eventHandle = this._CreateEventW(null, true, false, null);
		if (eventHandle.isNull()) {
			this._CloseHandle(this._dirHandle);
			this._dirHandle = null;
			throw new Error("CreateEventW failed (error " + ctypes.winLastError + ")");
		}
		this._eventHandle = eventHandle;

		// ---- Allocate buffer and overlapped struct ----

		this._rdcwBuf = new (ctypes.ArrayType(
			ctypes.uint8_t, this._RDCW_BUF_SIZE
		))();

		this._overlapped = new this._OVERLAPPED();
		this._overlapped.Internal = 0;
		this._overlapped.InternalHigh = 0;
		this._overlapped.OffsetLow = 0;
		this._overlapped.OffsetHigh = 0;
		this._overlapped.hEvent = this._eventHandle;

		this._rdcwAccumulatedKeys = new Set();
		this._liveWatcherFirstCall = true;

		// ---- Issue first ReadDirectoryChangesW call ----

		this._rdcwArm();
		this._rdcwPending = true;
	},

	/**
	 * Issue (or re-issue) an overlapped ReadDirectoryChangesW call.
	 * Throws on failure.
	 */
	_rdcwArm() {
		let bytesReturned = new this._ctypes.uint32_t(0);
		let ok = this._ReadDirectoryChangesW(
			this._dirHandle,
			this._rdcwBuf.address(),
			this._RDCW_BUF_SIZE,
			true, // bWatchSubtree -- recursive
			this._RDCW_NOTIFY_FILTER,
			bytesReturned.address(),
			this._overlapped.address(),
			null  // no completion routine
		);
		if (!ok) {
			let err = this._ctypes.winLastError;
			// ERROR_IO_PENDING is expected for overlapped I/O
			if (err !== this._ERROR_IO_PENDING) {
				throw new Error("ReadDirectoryChangesW failed (error " + err + ")");
			}
		}
	},

	/**
	 * Parse FILE_NOTIFY_INFORMATION records from the buffer and extract item keys.
	 *
	 * FILE_NOTIFY_INFORMATION is a variable-length linked list:
	 *   DWORD NextEntryOffset  (0 = last entry)
	 *   DWORD Action
	 *   DWORD FileNameLength   (in bytes)
	 *   WCHAR FileName[]       (UTF-16LE, not null-terminated, relative path with backslashes)
	 *
	 * We extract the first path component before the first backslash as the item key.
	 *
	 * @param {number} bytesTransferred
	 */
	_rdcwParseNotifications(bytesTransferred) {
		let ctypes = this._ctypes;
		let offset = 0;

		while (offset < bytesTransferred) {
			// Read NextEntryOffset (uint32_t at offset+0)
			let nextEntryPtr = ctypes.cast(
				this._rdcwBuf.addressOfElement(offset),
				ctypes.uint32_t.ptr
			);
			let nextEntryOffset = nextEntryPtr.contents;

			// Read FileNameLength (uint32_t at offset+8, in bytes)
			let fileNameLenPtr = ctypes.cast(
				this._rdcwBuf.addressOfElement(offset + 8),
				ctypes.uint32_t.ptr
			);
			let fileNameLength = fileNameLenPtr.contents;

			// Read FileName (UTF-16LE at offset+12)
			let nameChars = fileNameLength / 2;
			if (nameChars > 0) {
				// Extract the first path component (before first backslash)
				let key = "";
				let nameStart = offset + 12;
				for (let i = 0; i < nameChars; i++) {
					let byteOff = nameStart + i * 2;
					let lo = this._rdcwBuf[byteOff];
					let hi = this._rdcwBuf[byteOff + 1];
					let ch = lo | (hi << 8);
					if (ch === 0x5C) { // backslash
						break;
					}
					key += String.fromCharCode(ch);
				}

				if (this._keyPattern.test(key)) {
					this._rdcwAccumulatedKeys.add(key);
				}
			}

			if (nextEntryOffset === 0) {
				break;
			}
			offset += nextEntryOffset;
		}
	},

	_getChangedItemKeysRDCW() {
		let ctypes = this._ctypes;

		// Drain all available notifications
		if (this._rdcwPending) {
			let maxDrains = 100;
			let drains = 0;

			while (drains++ < maxDrains) {
				let bytesTransferred = new ctypes.uint32_t(0);
				let ok = this._GetOverlappedResult(
					this._dirHandle,
					this._overlapped.address(),
					bytesTransferred.address(),
					false // bWait=FALSE -- non-blocking
				);

				if (!ok) {
					let err = ctypes.winLastError;
					if (err === this._ERROR_IO_INCOMPLETE) {
						// No data ready yet -- that's fine
						break;
					}
					if (err === this._ERROR_NOTIFY_ENUM_DIR) {
						// Buffer overflow -- signal full scan
						Zotero.debug("FileChangeWatcher: RDCW buffer overflow"
							+ " -- signaling full scan");
						this._rdcwAccumulatedKeys.clear();
						this._liveWatcherLastFullScanTime = Date.now();
						// Re-arm for future notifications
						try {
							this._rdcwArm();
						}
						catch (e) {
							Zotero.logError(e);
							this._rdcwPending = false;
						}
						return null;
					}
					// Other error -- log and signal full scan
					Zotero.debug("FileChangeWatcher: GetOverlappedResult failed"
						+ " (error " + err + ")");
					this._rdcwPending = false;
					return null;
				}

				// Data ready
				let bytes = bytesTransferred.value;
				if (bytes === 0) {
					// Zero bytes means overflow -- signal full scan
					Zotero.debug("FileChangeWatcher: RDCW returned 0 bytes"
						+ " -- signaling full scan");
					this._rdcwAccumulatedKeys.clear();
					this._liveWatcherLastFullScanTime = Date.now();
					try {
						this._rdcwArm();
					}
					catch (e) {
						Zotero.logError(e);
						this._rdcwPending = false;
					}
					return null;
				}

				this._rdcwParseNotifications(bytes);

				// Re-arm and check for more
				try {
					this._rdcwArm();
				}
				catch (e) {
					Zotero.logError(e);
					this._rdcwPending = false;
					break;
				}
			}
		}

		// First call or periodic refresh -- signal full scan
		if (this._liveWatcherNeedsFullScan()) {
			Zotero.debug("FileChangeWatcher: Live watcher signaling full scan"
				+ " (first call or periodic refresh)");
			this._rdcwAccumulatedKeys.clear();
			return null;
		}

		let keys = this._rdcwAccumulatedKeys;
		this._rdcwAccumulatedKeys = new Set();
		return this._returnKeys(keys);
	},

	_closeRDCW() {
		// Closing the directory handle auto-cancels pending overlapped I/O
		if (this._dirHandle && !this._dirHandle.isNull()) {
			this._CloseHandle(this._dirHandle);
			this._dirHandle = null;
		}
		if (this._eventHandle && !this._eventHandle.isNull()) {
			this._CloseHandle(this._eventHandle);
			this._eventHandle = null;
		}
		if (this._kernel32) {
			this._kernel32.close();
			this._kernel32 = null;
		}
		this._overlapped = null;
		this._rdcwBuf = null;
		this._rdcwAccumulatedKeys = null;
		this._rdcwPending = false;
	},
});
