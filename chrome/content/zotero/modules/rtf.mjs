export const UNMAPPED = 0;
export const AMBIGUOUS = 1;
export const MAPPED = 2;

const BIBLIOGRAPHY_PLACEHOLDER = "\\{Bibliography\\}";

// set up regular expressions
// this assumes that names are >=2 chars or only capital initials and that there are no
// more than 4 names
const nameRe = "(?:[^ .,;]{2,} |[A-Z].? ?){0,3}[A-Z][^ .,;]+";
const creatorRe = '((?:(?:' + nameRe + ', )*' + nameRe + '(?:,? and|,? \\&|,) )?' + nameRe + ')(,? et al\\.?)?';
// TODO: localize "and" term
const creatorSplitRe = /(?:,| *(?:and|&)) +/g;
const citationRe = new RegExp('(\\\\\\{|; )(' + creatorRe + ',? (?:"([^"]+)(?:,"|",) )?([0-9]{4})[a-z]?)(?:,(?: pp?.?)? ([^ )]+))?(?=;|\\\\\\})|(([A-Z][^ .,;]+)(,? et al\\.?)? (\\\\\\{([0-9]{4})[a-z]?\\\\\\}))', "gm");

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
			const initialRe = /^(?:[A-Z]\.? ?)+$/;
			let match = initialRe.exec(firstName);
			if (match) {
				const initials = firstName.replace(/[^A-Z]/g, "");
				const itemInitials = itemCreator.firstName.split(/ +/g)
					.map(name => name[0].toUpperCase())
					.join("");
				if (initials !== itemInitials) {
					return false;
				}
			}
			else {
				// not all initials; verify that the first name matches
				const firstWord = firstName.slice(0, itemCreator.firstName).toLowerCase();
				const itemFirstWord = itemCreator.firstName.substr(0, itemCreator.firstName.indexOf(" ")).toLowerCase();
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
 * @param {string} content - The text content to parse for citations.
 * @return {Array<Object>} An array of citation objects, where each object contains information such as citation strings, pages, data (e.g., creators, title, date), start and end positions, and whether the author is suppressed.
 */
export function parseCitations(content) {
	let citations = [];
	let matches;
	let lastCitation = {};
	while ((matches = citationRe.exec(content))) {
		// determine whether suppressed or standard regular expression was used
		if (matches[2]) {	// standard parenthetical
			var citationString = matches[2];
			var creators = matches[3];
			// var etAl = !!matches[4];
			var title = matches[5];
			var date = matches[6];
			var pages = matches[7];
			var start = citationRe.lastIndex - matches[0].length;
			var end = citationRe.lastIndex + 2;
		}
		else {	// suppressed
			citationString = matches[8];
			creators = matches[9];
			// etAl = !!matches[10];
			title = undefined;
			date = matches[12];
			pages = undefined;
			start = citationRe.lastIndex - matches[11].length;
			end = citationRe.lastIndex;
		}
		citationString = citationString
			.replaceAll("\\{", "{")
			.replaceAll("\\}", "}");
		let suppressAuthor = !matches[2];

		if (lastCitation.citationStrings && lastCitation.end >= start) {
			// if this citation is just an extension of the last, add items to it
			lastCitation.citationStrings.push(citationString);
			lastCitation.pages.push(pages);
			lastCitation.data.push({ creators, title, date });
			lastCitation.end = end;
		}
		else {
			// otherwise, add another citation
			lastCitation = {
				citationStrings: [citationString],
				pages: [pages],
				data: [{ creators, title, date }],
				start,
				end,
				suppressAuthor
			};
			citations.push(lastCitation);
		}
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
			let { creators, title, date } = citationObject.data[i];
			// only add each citation once
			if (citationsSeen.has(citationString)) {
				continue;
			}
			citationsSeen.add(citationString);
			Zotero.debug("Found citation " + citationString);

			// for each individual match, look for an item in the database
			let search = new Zotero.Search;
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
						if (matchesItemCreators(creators, item)) {
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
 * @param {string} content - The RTF content, as a string.
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
		let cslCitation = { citationItems: [], properties: {} };
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
