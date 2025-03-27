/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
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

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

// Helper functions for citationDialog.js
export class CitationDialogHelpers {
	constructor({ doc }) {
		this.doc = doc;
	}

	// shortcut to create a node with specified class and attributes
	createNode(type, attributes, className) {
		let node = this.doc.createElement(type);
		for (let [key, val] of Object.entries(attributes)) {
			node.setAttribute(key, val);
		}
		node.className = className;
		return node;
	}

	// build and return a node with the description (e.g. creator/published/date/etc) of an item
	buildItemDescription(item) {
		let descriptionWrapper = this.doc.createElement("div");
		descriptionWrapper.classList = "description";
		let wrapTextInSpan = (text, styles = {}) => {
			let span = this.doc.createElement("span");
			for (let [style, value] of Object.entries(styles)) {
				span.style[style] = value;
			}
			span.textContent = text;
			return span;
		};
		let addPeriodIfNeeded = (node) => {
			if (node.textContent.length && node.textContent[node.textContent.length - 1] !== ".") {
				let period = this.doc.createElement("span");
				period.textContent = ".";
				descriptionWrapper.lastChild.setAttribute("no-comma", true);
				descriptionWrapper.appendChild(period);
			}
		};
		if (item.isNote()) {
			var date = Zotero.Date.sqlToDate(item.dateModified, true);
			date = Zotero.Date.toFriendlyDate(date);
			let dateLabel = wrapTextInSpan(date);
			
			var text = item.note;
			text = Zotero.Utilities.unescapeHTML(text);
			text = text.trim();
			text = text.slice(0, 500);
			var parts = text.split('\n').map(x => x.trim()).filter(x => x.length);
			if (parts[1]) {
				dateLabel.textContent += ` ${parts[1]}.`;
			}
			descriptionWrapper.appendChild(dateLabel);
			addPeriodIfNeeded(descriptionWrapper);
			return descriptionWrapper;
		}

		var nodes = [];
		// Add a red label to retracted items
		if (Zotero.Retractions.isRetracted(item)) {
			let label = wrapTextInSpan(Zotero.getString("retraction.banner"), { color: 'var(--accent-red)', 'margin-inline-end': '5px' });
			label.setAttribute("no-comma", true);
			nodes.push(label);
		}
		var authorDate = "";
		if (item.firstCreator) authorDate = item.firstCreator;
		var date = item.getField("date", true, true);
		if (date && (date = date.substr(0, 4)) !== "0000") {
			authorDate += ` (${parseInt(date)})`;
		}
		authorDate = authorDate.trim();
		if (authorDate) nodes.push(wrapTextInSpan(authorDate));
		
		var publicationTitle = item.getField("publicationTitle", false, true);
		if (publicationTitle) {
			let label = wrapTextInSpan(publicationTitle, { fontStyle: 'italics' });
			nodes.push(label);
		}
		
		var volumeIssue = item.getField("volume");
		if (item.getField("issue")) volumeIssue += `(${item.getField("issue")})`;
		if (volumeIssue) nodes.push(wrapTextInSpan(volumeIssue));
		
		var publisherPlace = [];
		if (item.getField("publisher")) publisherPlace.push(item.getField("publisher"));
		if (item.getField("place")) publisherPlace.push(item.getField("place"));
		
		if (publisherPlace.length) nodes.push(wrapTextInSpan(publisherPlace.join(": ")));
		
		if (item.getField("pages")) nodes.push(wrapTextInSpan(item.getField("pages")));
		
		if (!nodes.length && item.getField("url")) {
			nodes.push(wrapTextInSpan(item.getField("url")));
		}

		descriptionWrapper.replaceChildren(...nodes);
		
		addPeriodIfNeeded(descriptionWrapper);

		// If no info, add a space so the rows are of the same length
		if (descriptionWrapper.childElementCount === 0) {
			descriptionWrapper.innerText = " ";
		}

		return descriptionWrapper;
	}

	// build a container for the item nodes in both layouts
	buildItemsSection(id, headerText, isCollapsible, deckLength, dialogMode) {
		let section = this.createNode("div", { id }, "section");
		let header = this.createNode("div", {}, "header");
		let headerSpan = this.createNode("span", {}, "header-label");
		let divider = this.createNode("div", {}, "divider");
		headerSpan.innerText = headerText;
		header.append(headerSpan);
		let itemContainer = this.createNode("div", { id: `${id}_container`, role: "group", "aria-label": headerText }, "itemsContainer");
		section.append(header, itemContainer, divider);

		let buttonGroup = this.createNode("div", {}, "header-btn-group");
		header.append(buttonGroup);

		if (isCollapsible) {
			headerSpan.id = `header_${id}`;
			section.classList.add("expandable");
			section.style.setProperty('--deck-length', deckLength);

			let addAllBtn = this.createNode("span", { tabindex: -1, 'data-tabindex': 22, role: "button", "aria-describedby": headerSpan.id }, "add-all keyboard-clickable");
			buttonGroup.append(addAllBtn);
			
			if (dialogMode == "list") {
				headerSpan.setAttribute("role", "button");
				headerSpan.setAttribute("tabindex", -1);
				headerSpan.setAttribute("data-tabindex", 21);
				headerSpan.classList.add("keyboard-clickable");
			}
			if (dialogMode == "library") {
				itemContainer.setAttribute("tabindex", -1);
				itemContainer.setAttribute("data-tabindex", 30);

				let collapseSectionBtn = this.createNode("button", { tabindex: -1, 'data-tabindex': 21, "aria-describedby": headerSpan.id }, "btn-icon collapse-section-btn keyboard-clickable");
				this.doc.l10n.setAttributes(collapseSectionBtn, "integration-citationDialog-collapse-section");
				buttonGroup.prepend(collapseSectionBtn);
			}
		}
		return section;
	}

	// Create mock item node to use as a the placeholder for cited items that are loading
	createCitedItemPlaceholder() {
		let itemNode = this.createNode("div", {
			role: "option",
			disabled: true
		}, "item cited-placeholder");
		let title = this.createNode("div", {}, "title");
		let description = this.createNode("div", {}, "description");
		title.textContent = Zotero.getString("general.loading");
		description.textContent = " ";
		itemNode.append(title, description);
		return itemNode;
	}

	// Extract locator from a string and return an object: { label: string, page: string, fullLocatorString:string, onlyLocator: bool}
	// to identify the locator and pass that info to the dialog. If no locator is found, return null.
	// Locator can be given in its full or short form (with or without trailing period).
	// Locator must be followed by numbers (e.g. page 10-30) or a string in quotes (e.g. chapter "one two three").
	// Locators are excluded from the search query, so quotes are required for textual locators to
	// avoid conflicts with actual search terms.
	// Whitespace between the locator and the value is not required. These are equivalent:
	// p10-15, p.10-15, p. 10-15, p 10-15, page10-15, page 10-15, p."testing testing", page "testing testing"
	// Locators should always be in the end of the string, to avoid conflicts with actual search terms,
	// so page10-15 in 'history of the US page10-15 and something else' will not be treated as a locator.
	extractLocator(string) {
		string = string.trim();
		let words = string.split(" ");
		let locatorLabel, locatorLabelString, locatorValue;
		let wordLocatorIndex = 0;
		// Go through every word
		for (let word of words) {
			word = word.toLowerCase();
			// Check if the current word has a locator label
			for (let labelCandidate of Zotero.Cite.labels) {
				let { fullLocator, shortLocator, shortLocatorNoPunctuation } = this.getLocatorLabels(labelCandidate);
				// Potential locator value is a substring from the current word till the end
				let potentialLocatorValue = words.slice(wordLocatorIndex).join(" ").trim();

				// Check if this word has a locator label in its full or short form (e.g. "line" or "l" or "l.")
				// If a locator string is found, check if the string without it is a valid locator value.
				if (potentialLocatorValue.startsWith(fullLocator)) {
					// e.g. 'US history chapter "one and two" '
					locatorLabelString = fullLocator;
					// potential locator value: "one and two"
					potentialLocatorValue = potentialLocatorValue.substring(fullLocator.length).trim();
				}
				else if (potentialLocatorValue.startsWith(shortLocator)) {
					// e.g. 'US history chapt."one and two" '
					locatorLabelString = shortLocator;
					// potential locator value: "one and two"
					potentialLocatorValue = potentialLocatorValue.substring(shortLocator.length).trim();
				}
				else if (potentialLocatorValue.startsWith(shortLocatorNoPunctuation)) {
					// e.g. 'US history chapt11-12 '
					locatorLabelString = shortLocatorNoPunctuation;
					// potential locator value: 11-12
					potentialLocatorValue = potentialLocatorValue.substring(shortLocatorNoPunctuation.length).trim();
				}
				else {
					continue;
				}

				// At this point, potentialLocatorValue should be a string following one of the locator labels
				// Now, check against a two different ways that locator value can be specified.

				// first candidate is numbers with optional punctuation (e.g. chapt.11-12)
				let numericRegex = /^(\d+(?:[\s,-:]+\d+)*)(?:\s+)?$/;
				let numericMatch = numericRegex.exec(potentialLocatorValue.trim());
				if (numericMatch) {
					locatorValue = numericMatch[1].trim();
					locatorLabel = labelCandidate;
					break;
				}

				// next candidate is text in quotes (e.g. chapter "one and two")
				let quoteRegex = /^((?:"[^"]+"|'[^']+'))(?:\s*)$/;
				let quoteMatch = quoteRegex.exec(potentialLocatorValue.trim());
				if (quoteMatch) {
					locatorValue = quoteMatch[1];
					locatorLabel = labelCandidate;
					break;
				}
			}
			if (locatorLabel) break;
			wordLocatorIndex += 1;
		}
		if (!locatorLabel || !locatorValue || !locatorLabelString) return null;

		// find the entire locator string - "chapter 'one and two'" ensuring
		// that fullLocatorString is strictly a part of the larger string (including whitespaces and etc.)
		let wordsWithLocator = words.slice(wordLocatorIndex).join(" ");
		let locatorLabelIndex = wordsWithLocator.indexOf(locatorLabelString);
		let locatorValueIndex = wordsWithLocator.indexOf(locatorValue);
		let fullLocatorString = wordsWithLocator.substring(locatorLabelIndex, locatorValueIndex + locatorValue.length);
		return {
			label: locatorLabel,
			locator: locatorValue.replace(/['"]/g, ""),
			onlyLocator: fullLocatorString.length == string.length,
			fullLocatorString
		};
	}

	// calculate the height of the #search-row accounting for margins and border
	getSearchRowHeight() {
		let searchRow = this.doc.querySelector("#search-row");
		let height = searchRow.getBoundingClientRect().height;
		let win = this.doc.defaultView;
		let style = win.getComputedStyle(searchRow);
		let margins = parseInt(style.marginTop) + parseInt(style.marginBottom);
		let border = 1;
		return height + margins + border;
	}

	buildBubbleString({ citationItem, zoteroItem }) {
		// Creator
		var title;
		var str = zoteroItem.getField("firstCreator");
		
		// Title, if no creator (getDisplayTitle in order to get case, e-mail, statute which don't have a title field)
		title = zoteroItem.getDisplayTitle();
		title = title.substr(0, 32) + (title.length > 32 ? "…" : "");
		if (!str && title) {
			str = Zotero.getString("punctuation.openingQMark") + title + Zotero.getString("punctuation.closingQMark");
		}
		else if (!str) {
			str = Zotero.getString("integration-citationDialog-bubble-empty");
		}
		
		// Date
		var date = zoteroItem.getField("date", true, true);
		if (date && (date = date.substr(0, 4)) !== "0000") {
			str += ", " + parseInt(date);
		}
		
		// Locator
		if (citationItem.locator) {
			// Try to fetch the short form of the locator label. E.g. "p." for "page"
			// If there is no locator label, default to "page" for now
			let label = (Zotero.Cite.getLocatorString(citationItem.label || 'page', 'short') || '').toLocaleLowerCase();
			
			str += `, ${label} ${citationItem.locator}`;
		}
		
		// Prefix
		if (citationItem.prefix && Zotero.CiteProc.CSL.ENDSWITH_ROMANESQUE_REGEXP) {
			let prefix = citationItem.prefix.substr(0, 10) + (citationItem.prefix.length > 10 ? "…" : "");
			str = prefix
				+ (Zotero.CiteProc.CSL.ENDSWITH_ROMANESQUE_REGEXP.test(citationItem.prefix) ? " " : "")
				+ str;
		}
		
		// Suffix
		if (citationItem.suffix && Zotero.CiteProc.CSL.STARTSWITH_ROMANESQUE_REGEXP) {
			let suffix = citationItem.suffix.substr(0, 10) + (citationItem.suffix.length > 10 ? "…" : "");
			str += (Zotero.CiteProc.CSL.STARTSWITH_ROMANESQUE_REGEXP.test(citationItem.suffix) ? " " : "") + suffix;
		}
		
		return str;
	}

	getLocatorLabels(loc) {
		return {
			fullLocator: Zotero.Cite.getLocatorString(loc).toLowerCase(),
			shortLocator: Zotero.Cite.getLocatorString(loc, "short").toLowerCase(),
			shortLocatorNoPunctuation: Zotero.Cite.getLocatorString(loc, "short").toLowerCase().replace(/[.,]/g, "")
		};
	}
}
