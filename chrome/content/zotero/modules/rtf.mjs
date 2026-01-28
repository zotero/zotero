export const UNMAPPED = 0;
export const AMBIGUOUS = 1;
export const MAPPED = 2;

const BIBLIOGRAPHY_PLACEHOLDER = "\\{Bibliography\\}";

// https://en.wikipedia.org/wiki/Rich_Text_Format#Character_encoding
// https://encoding.spec.whatwg.org/
const CHARSET_CODEPAGE_LOOKUP = new Map([
	[0, 'windows-1252'],			// 	Latin alphabet, Western Europe / Americas
	[128, 'Shift_JIS'],				// 	Japanese, Shift JIS - TextEncoder has no support for "windows-932" but this should be close enough (https://en.wikipedia.org/wiki/Code_page_932_(Microsoft_Windows)) 
	[129, 'windows-949'], 			// 	Korean, Unified Hangul Code (extended Wansung)
	// [130, 'windows-1361'], 		// 	Korean, Johab (ASCII-based version) - TextEncoder has no support for anything close
	[134, 'GBK'], 					// 	Chinese, GBK (extended GB 2312) - windows-936
	[136, 'Big5'], 					// 	Chinese, Big5 - windows-950
	[161, 'windows-1253'], 			// 	Greek
	[162, 'windows-1254'], 			// 	Latin alphabet, Turkish
	[163, 'windows-1258'], 			// 	Latin alphabet, Vietnamese
	[177, 'windows-1255'], 			// 	Hebrew
	[178, 'windows-1256'], 			// 	Arabic
	[186, 'windows-1257'], 			// 	Baltic
	[204, 'windows-1251'], 			// 	Cyrillic
	[238, 'windows-1250'], 			// 	Latin alphabet, Eastern Europe
]);

// Regular expressions for citation parsing; see `parseCitations` for capture groups
const nameRe = String.raw`(?:\p{L}\p{M}*(?:[\p{L}\p{M}'’\-·]*\p{L}\p{M}*)?|\p{Lu}\.(?:\p{Lu}\.)*)(?:\p{Zs}+(?!(?:et\.?\p{Zs}+al\.?\b))(?:\p{L}\p{M}*(?:[\p{L}\p{M}'’\-·]*\p{L}\p{M}*)?|\p{Lu}\.(?:\p{Lu}\.)*))*`;
const creatorRe = String.raw`((?:(?:${nameRe}, )*${nameRe}(?:,? and|,? &|,) )?${nameRe})(,? et al\.?)?`;
const creatorSplitRe = /(?:,| *(?:and|&)) +/g;// TODO: localize "and" term
const titleRe = String.raw`(?:"(?:([^"]*?),")|"(?:([^"]*)",)|“(?:([^”]*?),”|([^”]*)”,)|„(?:([^“]*?),“|([^“]*)“,)|„(?:([^”]*?),”|([^”]*)”,)|‟(?:([^”]*?),”|([^”]*)”,))`;
const citationRe = new RegExp(String.raw`(\\\{|; )((?:${creatorRe},? )?(?:${titleRe} )?([0-9]{4})(?:\p{Ll})?)(?:,(?: pp?.?)? ([^ )]+))?(?=;|\\\})`, "gmu");
const suppressedCitationPartRe = new RegExp(String.raw`^\\\{([0-9]{4})(?:\p{Ll})?\\\}$`, "u");
const suppressedCitationRe = new RegExp(String.raw`((\p{L}[^ .,;]+)(,? et al\.?)? (?:\\\{([0-9]{4})(?:\p{Ll})?\\\}))`, "mu");

class Stack {
	constructor() {
		this._items = [];
	}

	push(value) {
		this._items.push(value);
	}

	pop() {
		return this._items.pop();
	}

	swap(value) {
		if (this._items.length === 0) {
			throw new Error("Cannot swap on an empty stack");
		}
		this._items[this._items.length - 1] = value;
	}

	peek() {
		return this._items[this._items.length - 1];
	}
}

export function decodeHex(charCode, codepage) {
	try {
		let decoder = new TextDecoder(codepage);
		let binary = Uint8Array.fromHex(charCode); // `fromHex` requires FF 133
		return decoder.decode(binary);
	}
	catch {
		Zotero.warn("Invalid ANSI codepage: " + codepage);
		return "?";
	}
}

const escapedHexByteRe = /\\'[0-9a-fA-F]{2}/y;

function readHexRun(str, start = 0) {
	escapedHexByteRe.lastIndex = start;
	let end = start;

	while (escapedHexByteRe.test(str)) {
		end = escapedHexByteRe.lastIndex;
	}

	return str.slice(start, end);
}

function extractFontCharset(rtfString) {
	const starts = rtfString.matchAll(/\{\s*\\fonttbl\b/g); // regex finds candidate starts
	const fontToCharset = new Map();

	for (const m of starts) {
		const start = m.index;
		let depth = 0;
		

		// Walk forward until the matching closing brace for this group.
		for (let i = start; i < rtfString.length - start; i++) {
			const ch = rtfString.charAt(i);

			if (ch === '{' && (i === 0 || rtfString.charAt(i - 1) !== "\\")) {
				depth++;
			}
			else if (ch === "}" && (i === 0 || rtfString.charAt(i - 1) !== "\\")) {
				depth--;
				if (depth === 0) {
					const fontTable = rtfString.slice(start, i + 1);
					const fontEntries = fontTable.matchAll(/\\f(\d+)[^}]*?\\fcharset(\d+)/g);
					for (const entry of fontEntries) {
						const fontNum = entry[1];
						const charset = entry[2] ? parseInt(entry[2]) : null;
						if (charset !== null) {
							fontToCharset.set(parseInt(fontNum), charset);
						}
					}

					break;
				}
			}
		}
	}
	return fontToCharset;
}

function stripRtfControlSequences(rtf) {
	return rtf
		// Remove RTF groups' braces
		.replace(/(?<!\\)[{}]/g, "")
		// Remove control words with optional numeric parameter.
		// If a space follows the control word, it’s a delimiter and should be removed too.
		.replace(/(?<!\\(?:\\\\)*)\\[a-zA-Z]+-?\d*\b ?/g, "")
		// Remove control symbols (single-character controls)
		.replace(/(?<!\\(?:\\\\)*)\\[~_\-|:*]/g, "")
		.replace(/\n/g, "");
}

export function decodeRTF(rtfString, codepage = 'windows-1252') {
	if (!rtfString) {
		return "";
	}
	
	let fontToCharset = extractFontCharset(rtfString);
	let ucTracker = new Stack();
	let codepageTracker = new Stack();
	let decodedString = "";
	
	const deffMatch = rtfString.match(/(?<!\\)\\deff(\d+)/);
	if (deffMatch) {
		const defaultFontID = parseInt(deffMatch[1]);
		if (fontToCharset.has(defaultFontID)) {
			codepage = CHARSET_CODEPAGE_LOOKUP.get(fontToCharset.get(defaultFontID));
		}
	}
	
	// removed unescaped space delimiters after \ucN and \uN sequences
	rtfString = rtfString.replaceAll(/(?<!\\)(\\(?:uc|u)\d+)\x20/g, '$1');
	
	ucTracker.push(1); // RTF's default value for "uc", i.e. how many characters to substitute for a Unicode character
	codepageTracker.push(codepage);

	for (let i = 0; i < rtfString.length; i++) {
		let char = rtfString.charAt(i);
		// CHUNK is an arbitrary number: how many characters after the beginning of the sequence to check, 7 would be bare minimum (\u is 2 and then 5 decimal digits required to represent a 16-bit integer (shifted to positive range so no minus sign)
		let CHUNK = 10;

		// Handle \uc sequences
		if (char === "\\" && (i === 0 || rtfString.charAt(i - 1) !== "\\") && rtfString.charAt(i + 1) === "u" && rtfString.charAt(i + 2) === "c") {
			const match = rtfString.slice(i, i + CHUNK).match(/^\\uc([0-9]+)/);
			if (match) {
				ucTracker.swap(parseInt(match[1]));
				i += 2 + match[1].length; // skip the \ucN sequence
				continue;
			}
		}

		// Handle \ansicpg sequences
		if (char === "\\" && (i === 0 || rtfString.charAt(i - 1) !== "\\") && rtfString.slice(i, i + 8) === "\\ansicpg") {
			const match = rtfString.slice(i, i + 8 + CHUNK).match(/^\\ansicpg([0-9]+)/);
			if (match) {
				let codepage = `windows-${match[1]}`;
				codepageTracker.swap(codepage);
				decodedString += "\\ansicpg" + match[1];
				i += 7 + match[1].length;
				continue;
			}
		}
		
		// Handle \f sequences
		if (char === "\\" && (i === 0 || rtfString.charAt(i - 1) !== "\\") && rtfString.charAt(i + 1) === 'f') {
			const match = rtfString.slice(i, i + 9 + CHUNK).match(/^\\f([0-9]+)/);
			if (match) {
				let fontID = parseInt(match[1]);
				if (fontToCharset.has(fontID)) {
					const fcharset = fontToCharset.get(fontID);
					if (CHARSET_CODEPAGE_LOOKUP.has(fcharset)) {
						codepageTracker.swap(CHARSET_CODEPAGE_LOOKUP.get(fcharset));
					}
				}
			}
		}

		// Handle scope opening
		if (char === '{' && (i === 0 || rtfString.charAt(i - 1) !== "\\")) {
			// inherit properties from the parent scope
			ucTracker.push(ucTracker.peek());
			codepageTracker.push(codepageTracker.peek());
			decodedString += char;
			continue;
		}

		// Handle scope closing
		if (char === '}' && (i === 0 || rtfString.charAt(i - 1) !== "\\")) {
			ucTracker.pop();
			codepageTracker.pop();
			decodedString += char;
			continue;
		}

		// Handle \u sequences
		if (char === "\\" && (i === 0 || rtfString.charAt(i - 1) !== "\\") && rtfString.charAt(i + 1) === "u") {
			const match = rtfString.slice(i, i + CHUNK).match(/^\\u([0-9]+)/);
			if (match) {
				let charCode = parseInt(match[1]);
				decodedString += String.fromCharCode(charCode);
				// Skip the \uN sequence and the substitution characters
				i += 1 + match[1].length + ucTracker.peek(); // skip the \uN sequence and the substitution characters
				continue;
			}
		}
		
		// Handle \' sequences, according to the current codepage
		if (char === "\\" && (i === 0 || rtfString.charAt(i - 1) !== "\\") && rtfString.charAt(i + 1) === "'") {
			const escapedBytes = readHexRun(rtfString, i);
			if (escapedBytes.length) {
				const hexBytes = [...escapedBytes.matchAll(/\\'([0-9a-fA-F]{2})/g)].map(m => m[1]).join("");
				decodedString += decodeHex(hexBytes, codepageTracker.peek());
				i += escapedBytes.length - 1;
				continue;
			}
		}
			
		decodedString += char;
	}
	
	return decodedString;
}

export function encodeRTF(unicodeString) {
	if (!unicodeString) {
		return "";
	}

	// ensure no \uc sequences are present
	unicodeString = unicodeString.replaceAll(/(?<!\\)(\\uc\d+)/g, '');
	// inject \uc0 at the beginning of the document
	unicodeString = unicodeString.replace('\\rtf1', '\\rtf1\\uc0');

	let rtfString = "";
	for (let i = 0; i < unicodeString.length; i++) {
		let charCode = unicodeString.charCodeAt(i);
		if (charCode > 127) {
			rtfString += "\\u" + charCode;
		}
		else {
			rtfString += unicodeString.charAt(i);
		}
	}

	return rtfString;
}


/**
 * Compares in-text creator string with an item creator object to determine if they match.
 *
 * @param {string} creator - The full name or initial string representation of the creator.
 * @param {Object} itemCreator - An object representing the item's creator, containing `firstName` and `lastName` properties.
 * @param {string} itemCreator.firstName - The first name of the item creator.
 * @param {string} itemCreator.lastName - The last name of the item creator.
 * @return {boolean} Returns `true` if the provided creator string matches the item creator object; otherwise, `false`.
 */
function matchesItemCreator(creator, itemCreator) {
	// make sure the last name matches
	const lowerLast = itemCreator.lastName.toLowerCase();
	if (lowerLast !== creator.slice(-lowerLast.length).toLowerCase()) {
		return false;
	}

	// make sure that the first name matches (if it exists)
	if (creator.length > lowerLast.length) {
		const firstName = Zotero.Utilities.trim(creator.substr(0, creator.length - lowerLast.length));
		if (firstName.length) {
			// check to see whether the first name is all initials
			const initialRe = /^(?:\p{L}\.? ?)+$/u;
			let match = initialRe.exec(firstName);
			if (match) {
				const initials = firstName.replace(/[^\p{L}]/gu, "");
				const itemInitials = itemCreator.firstName.split(/ +/g)
					.map(name => name[0].toUpperCase())
					.join("");
				if (initials !== itemInitials) {
					return false;
				}
			}
			else {
				// not all initials; verify that the first name matches
				const firstWord = firstName.slice(0, itemCreator.firstName)
					.toLowerCase();
				const itemFirstWord = itemCreator.firstName.substr(0, itemCreator.firstName.indexOf(" "))
					.toLowerCase();
				if (firstWord !== itemFirstWord) {
					return false;
				}
			}
		}
	}

	return true;
}

/**
 * Determines if the creators of a given in-text citation match the creators of an item
 *
 * @param {Array} creators - The list of creators from the citation to match against the item.
 * @param {Object} item - The item whose creators are being checked for a match.
 * @param {boolean} etAl - Indicates whether the "et al." condition is being used for matching.
 * @return {boolean} Returns true if the creators of the citation match the creators of the item,
 *                   considering the specified conditions; otherwise, false.
 */
function matchesItemCreators(creators, item, etAl) {
	let itemCreators = item.getCreators();
	let primaryCreators = [];
	let primaryCreatorTypeID = Zotero.CreatorTypes.getPrimaryIDForType(item.itemTypeID);

	// use only primary creators if primary creators exist
	for (let i = 0; i < itemCreators.length; i++) {
		if (itemCreators[i].creatorTypeID == primaryCreatorTypeID) {
			primaryCreators.push(itemCreators[i]);
		}
	}
	// if primaryCreators matches the creator list length, or if et al. is being used, use only
	// primary creators
	if (primaryCreators.length === creators.length || etAl) {
		itemCreators = primaryCreators;
	}

	// for us to have an exact match, either the citation creator list length has to match the
	// item creator list length, or et al. has to be used
	if (itemCreators.length === creators.length || (etAl && itemCreators.length > creators.length)) {
		var matched = true;
		for (let i = 0; i < creators.length; i++) {
			// check each item creator to see if it matches
			matched = matched && matchesItemCreator(creators[i], itemCreators[i]);
			if (!matched) break;
		}
		return matched;
	}

	return false;
}

/**
 * Parses RTF content to extract citation details
 *
 * @param {string} content - The RTF content with Unicode characters already decoded as a string.
 * @return {Array<Object>} An array of citation objects, where each object contains information such as citation strings, pages, data (e.g., creators, title, date), start and end positions, and whether the author is suppressed.
 */
export function parseCitations(content) {
	let citations = [];
	let lastEnd = 0; // track where the previous citation ended when dealing with suppressed citations
	const starts = content.matchAll(/\\\{/g);
	
	for (const m of starts) {
		const start = m.index;
		let end = content.indexOf("\\}", start);
		if (end === -1) {
			continue;
		}
		
		end += 2; // account for "\}"
		const slice = stripRtfControlSequences(content.slice(start, end));
		
		// try suppressed citation first
		let potentialSuppressedMatch = slice.match(suppressedCitationPartRe);
		if (potentialSuppressedMatch) {
			// look behind for a suppressed citation. We consider everything since the previous citation up to a 100-character limit.
			let searchStart = Math.max(start - 100, lastEnd);
			let candidate = content.slice(searchStart, end);
			let match = candidate.match(suppressedCitationRe);
			if (match) {
				const citationString = match[1].replaceAll("\\{", "{").replaceAll("\\}", "}");
				const creators = match[2];
				// const etAl = !!match[3];
				const date = match[4];
				let citation = { citationStrings: [citationString], pages: [], data: [{ creators, date, title: undefined }], suppressAuthor: true, start, end };
				citations.push(citation);
				lastEnd = end;
				continue;
			}
		}
		
		// try to match standard citations
		let match;
		let citation = { citationStrings: [], pages: [], data: [], suppressAuthor: false, start, end };
		while ((match = citationRe.exec(slice))) {
			const citationString = match[2].replaceAll("\\{", "{").replaceAll("\\}", "}");
			const creators = match[3];
			// const etAl = !!match[4];
			const title = match[5] ?? match[6] ?? match[7] ?? match[8] ?? match[9] ?? match[10] ?? match[11] ?? match[12] ?? match[13] ?? match[14];
			const date = match[15];
			const pages = match[16];
			citation.citationStrings.push(citationString);
			citation.pages.push(pages);
			citation.data.push({ creators, title, date });
		}
		citations.push(citation);
		lastEnd = end;
	}
	
	return citations;
}

/**
 * Processes a list of citation objects (from `parseCitations`) and attempts to match them to the existing items
 *
 * @param {Array<Object>} citationObjects - An array of citation objects, where each object contains citation strings and associated metadata as data.
 * @return {Promise<Array<Object>>} A promise that resolves to an array of mappings. Each mapping consists of the citation string, associated items (if any), and its mapping type (unmapped, mapped, or ambiguous).
 */
export async function processCitations(citationObjects) {
	let mappings = [];
	const citationsSeen = new Set();

	for (let citationObject of citationObjects) {
		for (let i = 0; i < citationObject.citationStrings.length; i++) {
			let citationString = citationObject.citationStrings[i];
			let {
				creators,
				title,
				date
			} = citationObject.data[i];
			// only add each citation once
			if (citationsSeen.has(citationString)) {
				continue;
			}
			citationsSeen.add(citationString);
			Zotero.debug("Found citation " + citationString);

			// for each individual match, look for an item in the database
			let search = new Zotero.Search;
			
			if (creators) {
				creators = creators.replace(".", "");
				// TODO: localize "et al." term
				creators = creators.split(creatorSplitRe);

				for (let i = 0; i < creators.length; i++) {
					if (!creators[i]) {
						if (i === creators.length - 1) {
							break;
						}
						else {
							creators.splice(i, 1);
						}
					}

					const spaceIndex = creators[i].lastIndexOf(" ");
					const lastName = spaceIndex === -1 ? creators[i] : creators[i].slice(spaceIndex + 1);
					search.addCondition("lastName", "contains", lastName);
				}
				if (title) {
					search.addCondition("title", "contains", title);
				}
			}

			search.addCondition("date", "is", date);
			let ids = await search.search();
			Zotero.debug("Mapped to " + ids);

			// no mapping found
			if (!ids.length) {
				mappings.push({
					rtf: citationString,
					items: [],
					type: UNMAPPED
				});
			}
			// some mapping found
			else {
				let items = await Zotero.Items.getAsync(ids);
				if (items.length > 1) {
					// check to see how well the author list matches the citation
					let matchedItems = [];
					for (let item of items) {
						await item.loadAllData();
						if (creators && matchesItemCreators(creators, item)) {
							matchedItems.push(item);
						}
					}

					if (matchedItems.length !== 0) {
						items = matchedItems;
					}
				}

				// only one mapping
				if (items.length === 1) {
					await items[0].loadAllData();
					mappings.push({
						rtf: citationString,
						items: [items[0]],
						type: MAPPED
					});
				}
				// ambiguous mapping
				else {
					mappings.push({
						rtf: citationString,
						items,
						type: AMBIGUOUS
					});
				}
			}
		}
	}

	return mappings;
}

/**
 * Regenerates the RTF document with citations replaced
 *
 * @param {string} content - The RTF content with Unicode characters already decoded as a string.
 * @param {Array<Object>} citations - An array of citations, extracted with `parseCitations`.
 * @param {Object} citationItemIDs - A mapping of citation strings to corresponding item IDs.
 * @param {string} style - The citation style to apply.
 * @param {string} locale - The locale for the citation style.
 * @param {string} displayAs - Specifies how the citations should be displayed, such as "endnotes" or "footnotes".
 * @return {Promise<string>} The re-formatted raw RTF document as a string.
 */
export async function replaceCitations(content, citations, citationItemIDs, style, locale, displayAs) {
	// load style and create ItemSet with all items
	let zStyle = Zotero.Styles.get(style);
	let cslEngine = zStyle.getCiteProc(locale, 'rtf');
	let isNote = zStyle.class === "note";

	// create citations
	// var k = 0;
	let cslCitations = [];
	let itemIDs = {};
	// var shouldBeSubsequent = {};
	for (let i = 0; i < citations.length; i++) {
		let citation = citations[i];
		let cslCitation = {
			citationItems: [],
			properties: {}
		};
		if (isNote) {
			cslCitation.properties.noteIndex = i;
		}

		// create citation items
		for (var j = 0; j < citation.citationStrings.length; j++) {
			var citationItem = {};
			citationItem.id = citationItemIDs[citation.citationStrings[j]][0];
			itemIDs[citationItem.id] = true;
			citationItem.locator = citation.pages[j];
			citationItem.label = "page";
			citationItem["suppress-author"] = citation.suppressAuthor && !isNote;
			cslCitation.citationItems.push(citationItem);
		}

		cslCitations.push(cslCitation);
	}

	Zotero.debug(cslCitations);
	itemIDs = Object.keys(itemIDs);
	Zotero.debug(itemIDs);

	// prepare the list of rendered citations
	let citationResults = cslEngine.rebuildProcessorState(cslCitations, "rtf");

	// format citations
	let contentArray = [];
	let lastEnd = 0;
	for (let i = 0; i < citations.length; i++) {
		let citation = citationResults[i][2];

		// if using notes, we might have to move the note after the punctuation
		if (isNote && citations[i].start !== 0 && content[citations[i].start - 1] === " ") {
			contentArray.push(content.substring(lastEnd, citations[i].start - 1));
		}
		else {
			contentArray.push(content.substring(lastEnd, citations[i].start));
		}

		lastEnd = citations[i].end;
		if (isNote && citations[i].end < content.length && ".,!?".indexOf(content[citations[i].end]) !== -1) {
			contentArray.push(content[citations[i].end]);
			lastEnd++;
		}

		if (isNote) {
			if (displayAs === 'endnotes') {
				contentArray.push("{\\super\\chftn}\\ftnbj {\\footnote\\ftnalt {\\super\\chftn } " + citation + "}");
			}
			else {	// footnotes
				contentArray.push("{\\super\\chftn}\\ftnbj {\\footnote {\\super\\chftn } " + citation + "}");
			}
		}
		else {
			contentArray.push(citation);
		}
	}
	contentArray.push(content.substring(lastEnd));
	content = contentArray.join("");

	// add bibliography
	if (zStyle.hasBibliography) {
		let bibliography = Zotero.Cite.makeFormattedBibliography(cslEngine, "rtf");
		bibliography = bibliography.substring(5, bibliography.length - 1);
		// fix line breaks
		let linebreak = "\r\n";
		if (content.indexOf("\r\n") === -1) {
			bibliography = bibliography.replaceAll("\r\n", "\n");
			linebreak = "\n";
		}

		if (content.indexOf(BIBLIOGRAPHY_PLACEHOLDER) !== -1) {
			content = content.replace(BIBLIOGRAPHY_PLACEHOLDER, bibliography);
		}
		else {
			// add two newlines before bibliography
			bibliography = linebreak + "\\" + linebreak + "\\" + linebreak + bibliography;

			// add bibliography automatically inside the last set of brackets closed
			const bracketRe = /^\{+/;
			var m = bracketRe.exec(content);
			if (m) {
				var closeBracketRe = new RegExp("(\\}{" + m[0].length + "}\\s*)$");
				content = content.replace(closeBracketRe, bibliography + "$1");
			}
			else {
				content += bibliography;
			}
		}
	}

	cslEngine.free();
	return content;
}
