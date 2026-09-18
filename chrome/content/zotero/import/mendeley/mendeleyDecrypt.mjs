/**
 * Decryption for encrypted Mendeley Desktop library databases.
 *
 * Mendeley encrypts the local library with the SQLite Encryption Extension,
 * which Zotero's SQLite cannot read. The 256-bit key is a constant compiled
 * into Mendeley Desktop, put through a fixed obfuscation and then XOR-folded
 * with the account's profile UUID, which is the database filename stem.
 *
 * Pages are encrypted with AES-256-OFB. Each page carries its own nonce in the
 * reserved space at the end of the page, which is left in the clear, and the
 * initialization vector is that nonce prefixed with the page number.
 */

const OBFUSCATED_KEY = 'e5431aeb503dcf0ab92d3e936c0bbb40fc7e0a9448699a77dac9cb6276d288bd';
const DEOBFUSCATION_XOR = 0x62;
const KEY_SIZE = 32;
const UUID_SIZE = 16;
const BLOCK_SIZE = 16;
const RESERVED_SIZE = 12;
const MIN_PAGE_SIZE = 512;
const MAX_PAGE_SIZE = 65536;
// Null-terminated, so this plus its terminator is the first 16 bytes of the file
const SQLITE_MAGIC = 'SQLite format 3';
// Page size and reserved-space fields, which are never encrypted so that the
// page layout stays readable
const CLEAR_HEADER_START = 16;
const CLEAR_HEADER_END = 24;

function hexToBytes(hex) {
	let bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function reverseBytes(hex) {
	let reversed = '';
	for (let i = hex.length - 2; i >= 0; i -= 2) {
		reversed += hex.slice(i, i + 2);
	}
	return reversed;
}

function getBaseKey() {
	let obfuscated = hexToBytes(OBFUSCATED_KEY);
	let key = new Uint8Array(KEY_SIZE);
	for (let i = 0; i < KEY_SIZE; i++) {
		let byte = obfuscated[i] ^ DEOBFUSCATION_XOR;
		key[i] = ((byte << 4) | (byte >> 4)) & 0xFF;
	}
	return key;
}

/**
 * Mendeley stores the profile UUID in the Windows GUID layout, where the first
 * three fields are little-endian rather than big-endian
 */
function uuidToBytes(uuid) {
	let parts = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i.exec(uuid);
	if (!parts) {
		throw new Error(`Invalid Mendeley profile UUID: ${uuid}`);
	}
	let [, timeLow, timeMid, timeHigh, clockSeq, node] = parts;
	return hexToBytes(
		reverseBytes(timeLow) + reverseBytes(timeMid) + reverseBytes(timeHigh) + clockSeq + node
	);
}

function getLibraryKey(profileUUID) {
	let key = getBaseKey();
	let uuid = uuidToBytes(profileUUID);
	for (let i = 0; i < UUID_SIZE; i++) {
		key[i] ^= uuid[i];
		key[KEY_SIZE - 1 - i] ^= uuid[i];
	}
	return key;
}

function getPageSize(header) {
	let pageSize = (header[CLEAR_HEADER_START] << 8) | header[CLEAR_HEADER_START + 1];
	// The maximum page size doesn't fit in the two-byte field and is stored as 1
	return pageSize == 1 ? MAX_PAGE_SIZE : pageSize;
}

function hasSQLiteMagic(page) {
	return String.fromCharCode(...page.subarray(0, SQLITE_MAGIC.length)) == SQLITE_MAGIC
		&& page[SQLITE_MAGIC.length] == 0;
}

/**
 * AES-256-OFB keystream.
 *
 * WebCrypto has no OFB mode, but CBC-encrypting a zero-filled buffer produces
 * the same sequence: with an all-zero plaintext, each ciphertext block is
 * E(key, previousBlock XOR 0), which is the OFB feedback relation. That gets
 * the whole page's keystream from a single call instead of one per block.
 */
async function getKeystream(key, iv, length) {
	let blocks = Math.ceil(length / BLOCK_SIZE);
	let keystream = await crypto.subtle.encrypt(
		{ name: 'AES-CBC', iv }, key, new Uint8Array(blocks * BLOCK_SIZE)
	);
	return new Uint8Array(keystream, 0, length);
}

/**
 * Decrypt a single page in place
 */
async function decryptPage(key, pageNumber, page) {
	let encryptedSize = page.length - RESERVED_SIZE;
	let iv = new Uint8Array(BLOCK_SIZE);
	new DataView(iv.buffer).setUint32(0, pageNumber, true);
	iv.set(page.subarray(encryptedSize), 4);

	let clearHeader = pageNumber == 1
		? page.slice(CLEAR_HEADER_START, CLEAR_HEADER_END)
		: null;

	let keystream = await getKeystream(key, iv, encryptedSize);
	for (let i = 0; i < encryptedSize; i++) {
		page[i] ^= keystream[i];
	}

	// The keystream advances over the unencrypted header fields, so they have to
	// be put back rather than skipped
	if (clearHeader) {
		page.set(clearHeader, CLEAR_HEADER_START);
	}
}

async function importKey(rawKey) {
	return crypto.subtle.importKey('raw', rawKey, { name: 'AES-CBC' }, false, ['encrypt']);
}

/**
 * Find the key that decrypts the database, or null if none of them do
 */
async function findKey(data, pageSize, profileUUID) {
	// online.sqlite, the database Mendeley uses before you sign in, has no
	// profile UUID to fold in and uses the unfolded key
	let candidates = profileUUID
		? [getLibraryKey(profileUUID), getBaseKey()]
		: [getBaseKey()];
	for (let candidate of candidates) {
		let key = await importKey(candidate);
		let firstPage = data.slice(0, pageSize);
		await decryptPage(key, 1, firstPage);
		if (hasSQLiteMagic(firstPage)) {
			return key;
		}
	}
	return null;
}

/**
 * Get the Mendeley profile UUID a database is keyed to, from its filename
 *
 * @param {String} path
 * @return {String|null}
 */
export function getProfileUUID(path) {
	let match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@www\.mendeley\.com\.sqlite$/i
		.exec(PathUtils.filename(path));
	return match ? match[1] : null;
}

/**
 * Check whether a file is an encrypted Mendeley database
 *
 * @param {String} path
 * @return {Promise<Boolean>}
 */
export async function isEncryptedDatabase(path) {
	let header;
	try {
		header = await IOUtils.read(path, { maxBytes: CLEAR_HEADER_END });
	}
	catch {
		return false;
	}
	if (header.length < CLEAR_HEADER_END || hasSQLiteMagic(header)) {
		return false;
	}
	let pageSize = getPageSize(header);
	return header[20] == RESERVED_SIZE
		&& pageSize >= MIN_PAGE_SIZE
		&& pageSize <= MAX_PAGE_SIZE
		&& (pageSize & (pageSize - 1)) == 0;
}

/**
 * Check whether Mendeley still has the database open
 *
 * SQLite removes both files when the last connection closes cleanly, so either
 * one means Mendeley is still running, or crashed leaving changes that exist
 * only in the write-ahead log.
 *
 * @param {String} path
 * @return {Promise<Boolean>}
 */
export async function isDatabaseInUse(path) {
	if (await IOUtils.exists(path + '-shm')) {
		return true;
	}
	if (await IOUtils.exists(path + '-wal')) {
		let { size } = await IOUtils.stat(path + '-wal');
		return size > 0;
	}
	return false;
}

/**
 * Decrypt a Mendeley database to a new file
 *
 * The decrypted copy keeps the reserved space the encryption used for its
 * nonces.
 *
 * @param {String} sourcePath - Encrypted database
 * @param {String} targetPath - Path to write the decrypted database to
 */
export async function decryptDatabase(sourcePath, targetPath) {
	let data = await IOUtils.read(sourcePath);
	let pageSize = getPageSize(data);
	if (data.length < CLEAR_HEADER_END
			|| data[20] != RESERVED_SIZE
			|| pageSize < MIN_PAGE_SIZE
			|| data.length % pageSize) {
		// Keep in sync with importWizard.js
		throw new Error('Unsupported Mendeley database encryption');
	}

	let key = await findKey(data, pageSize, getProfileUUID(sourcePath));
	if (!key) {
		// Keep in sync with importWizard.js
		throw new Error('Cannot derive Mendeley database key');
	}

	for (let pageNumber = 1; pageNumber <= data.length / pageSize; pageNumber++) {
		await decryptPage(
			key, pageNumber, data.subarray((pageNumber - 1) * pageSize, pageNumber * pageSize)
		);
	}

	await IOUtils.write(targetPath, data);
}
