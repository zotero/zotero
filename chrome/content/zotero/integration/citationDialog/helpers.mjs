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
		let itemContainer = this.createNode("div", { role: "group", "aria-label": headerText }, "itemsContainer");
		section.append(header, itemContainer, divider);

		if (isCollapsible) {
			headerSpan.id = `header_${id}`;
			section.classList.add("expandable");
			section.style.setProperty('--deck-length', deckLength);
			let buttonGroup = this.createNode("div", { }, "header-btn-group");
			header.append(buttonGroup);

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

	// Extract locator from a string and return an object: { label: string, page: string, onlyLocator: bool}
	// to identify the locator and pass that info to the dialog
	extractLocator(string) {
		string = string.trim();
		// Check for different ways of typing the page locator
		const pageRegex = /^(?:,? *(p{1,2})(?:\. *| *)|:)([0-9\-–]+) *$/;
		let pageLocator = pageRegex.exec(string);
		if (pageLocator && pageLocator.length) {
			return {
				label: "page",
				locator: pageLocator[2],
				onlyLocator: pageLocator[0].length == string.length,
				fullLocatorString: pageLocator[0]
			};
		}

		// Check for all other locators
		let words = string.split(" ");
		let locatorLabel = null;
		let wordLocatorIndex = 0;
		// Go through every word and look for a locator label in its full or short form (e.g. "line" or "l" or "l.")
		for (let word of words) {
			word = word.toLowerCase();
			locatorLabel = Zotero.Cite.labels.find((loc) => {
				let fullLocator = Zotero.Cite.getLocatorString(loc).toLowerCase();
				let shortLocator = Zotero.Cite.getLocatorString(loc, "short").toLowerCase();
				let shortLocatorNoPunctuation = shortLocator.replace(".", "").replace(",", "");
				return fullLocator == word || shortLocator == word || shortLocatorNoPunctuation == word;
			});
			if (locatorLabel) break;
			wordLocatorIndex += 1;
		}
		// Fetch the locator value - all strings following the label
		// e.g. for "history of USA chapter one and two", the locator value is "one and two"
		let locatorValue = words.slice(wordLocatorIndex + 1).join(" ").trim();
		if (locatorLabel === null || !locatorValue.length) return null;
		// The entire locator string - "chapter one and two"
		let fullLocatorString = words.slice(wordLocatorIndex).join(" ");
		return {
			label: locatorLabel,
			locator: locatorValue,
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
}
