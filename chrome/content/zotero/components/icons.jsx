'use strict';

const React = require('react');
const { renderToStaticMarkup } = require('react-dom-server');
const { PureComponent } = React;
const { element, string, object } = require('prop-types');

const Icon = (props) => {
	props = Object.assign({}, props);
	props.className = `icon icon-${props.name} ${props.className || ""}`;
	delete props.name;
	// Pass the props forward
	return <span {...props}></span>;
};

Icon.propTypes = {
	children: element,
	className: string,
	name: string.isRequired,
	style: object
}

module.exports = { Icon }


function i(name, svgOrSrc, hasHiDPI = true) {
	if (typeof svgOrSrc == 'string' && hasHiDPI && window.devicePixelRatio >= 1.25) {
		// N.B. In Electron we can use css-image-set
		let parts = svgOrSrc.split('.');
		parts[parts.length - 2] = parts[parts.length - 2] + '@2x';
		svgOrSrc = parts.join('.');
	}

	const icon = class extends PureComponent {
		render() {
			let props = Object.assign({}, this.props);
			props.name = name.toLowerCase();
			
			if (typeof svgOrSrc == 'string') {
				if (!("style" in props)) props.style = {};
				props.style.backgroundImage = `url(${svgOrSrc})`;
				props.className = props.className || "";
				props.className += " icon-bg";
				// We use css background-image.
				// This is a performance optimization for fast-scrolling trees.
				// If we use img elements they are slow to render
				// and produce pop-in when fast-scrolling.
				return (
					<Icon {...props} />
				);
			}

			return (
				<Icon {...props}>{svgOrSrc}</Icon>
			)
		}
	}

	icon.propTypes = {
		className: string
	}

	icon.displayName = `Icon${name}`

	module.exports[icon.displayName] = icon
}

/* eslint-disable max-len */


i('TagSelectorMenu', "chrome://zotero/skin/tag-selector-menu.png");
i('SortMarker', "chrome://zotero/skin/tag-selector-menu.png");
i('DownChevron', "chrome://zotero/skin/searchbar-dropmarker.png");
i('Xmark', "chrome://zotero/skin/xmark.png")
i('Twisty', (
	/* This Source Code Form is subject to the terms of the Mozilla Public
	 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
	 * You can obtain one at http://mozilla.org/MPL/2.0/. */
	<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
		<path d="M8 13.4c-.5 0-.9-.2-1.2-.6L.4 5.2C0 4.7-.1 4.3.2 3.7S1 3 1.6 3h12.8c.6 0 1.2.1 1.4.7.3.6.2 1.1-.2 1.6l-6.4 7.6c-.3.4-.7.5-1.2.5z"/>
	</svg>
));
i('ArrowLeft', (
	/* This Source Code Form is subject to the terms of the Mozilla Public
	 * License, v. 2.0. If a copy of the MPL was not distributed with this
	 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
		<path d="m5.001 8.352 5.465 5.466a.626.626 0 0 0 .884-.886L6.416 7.999l4.933-4.932a.626.626 0 0 0-.885-.885L5 7.647l.001.705z"/>
	</svg>
));
i('ArrowRight', (
	/* This Source Code Form is subject to the terms of the Mozilla Public
	 * License, v. 2.0. If a copy of the MPL was not distributed with this
	 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
		<path d="m10.999 8.352-5.465 5.466a.626.626 0 0 1-.884-.886l4.935-4.934-4.934-4.931a.626.626 0 0 1 .885-.885L11 7.647l-.001.705z"/>
	</svg>
));
i('Cross', "chrome://zotero/skin/cross.png");
i('Tick', "chrome://zotero/skin/tick.png");
i('ArrowRefresh', "chrome://zotero/skin/arrow_refresh.png");
//i('Link', "chrome://zotero/skin/link.png");
i('PuzzleArrow', "chrome://zotero/skin/puzzle-arrow.png")
i('ArrowRotateAnimated', "chrome://zotero/skin/arrow_rotate_animated.png")
i('Warning', "chrome://zotero/skin/warning.png")
i('Pencil', "chrome://zotero/skin/pencil.png")

i('RTFScanAccept', "chrome://zotero/skin/rtfscan-accept.png", false);
i('RTFScanLink', "chrome://zotero/skin/rtfscan-link.png", false);

i('Attach', "chrome://zotero/skin/attach.png");
i('AttachSmall', "chrome://zotero/skin/attach-small.png");
i('BulletBlue', "chrome://zotero/skin/bullet_blue.png");
i('BulletBlueEmpty', "chrome://zotero/skin/bullet_blue_empty.png");

// TreeItems
i('TreeitemArtwork', 'chrome://zotero/skin/treeitem-artwork.png');
i('TreeitemAttachmentLink', 'chrome://zotero/skin/treeitem-attachment-link.png');
i('TreeitemAttachmentPDF', 'chrome://zotero/skin/treeitem-attachment-pdf.png');
i('TreeitemAttachmentPDFLink', 'chrome://zotero/skin/treeitem-attachment-pdf-link.png');
i('TreeitemAttachmentSnapshot', 'chrome://zotero/skin/treeitem-attachment-snapshot.png');
i('TreeitemAttachmentWebLink', 'chrome://zotero/skin/treeitem-attachment-web-link.png');
i('TreeitemAudioRecording', 'chrome://zotero/skin/treeitem-audioRecording.png');
i('TreeitemBill', 'chrome://zotero/skin/treeitem-bill.png');
i('TreeitemBlogPost', 'chrome://zotero/skin/treeitem-blogPost.png');
i('TreeitemBook', 'chrome://zotero/skin/treeitem-book.png');
i('TreeitemBookSection', 'chrome://zotero/skin/treeitem-bookSection.png');
i('TreeitemCase', 'chrome://zotero/skin/treeitem-case.png');
i('TreeitemComputerProgram', 'chrome://zotero/skin/treeitem-computerProgram.png');
i('TreeitemConferencePaper', 'chrome://zotero/skin/treeitem-conferencePaper.png');
i('TreeitemDictionaryEntry', 'chrome://zotero/skin/treeitem-dictionaryEntry.png');
i('TreeitemEmail', 'chrome://zotero/skin/treeitem-email.png');
i('TreeitemEncyclopediaArticle', 'chrome://zotero/skin/treeitem-encyclopediaArticle.png');
i('TreeitemFilm', 'chrome://zotero/skin/treeitem-film.png');
i('TreeitemForumPost', 'chrome://zotero/skin/treeitem-forumPost.png');
i('TreeitemHearing', 'chrome://zotero/skin/treeitem-hearing.png');
i('TreeitemInstantMessage', 'chrome://zotero/skin/treeitem-instantMessage.png');
i('TreeitemInterview', 'chrome://zotero/skin/treeitem-interview.png');
i('TreeitemJournalArticle', 'chrome://zotero/skin/treeitem-journalArticle.png');
i('TreeitemLetter', 'chrome://zotero/skin/treeitem-letter.png');
i('TreeitemMagazineArticle', 'chrome://zotero/skin/treeitem-magazineArticle.png');
i('TreeitemManuscript', 'chrome://zotero/skin/treeitem-manuscript.png');
i('TreeitemMap', 'chrome://zotero/skin/treeitem-map.png', false);
i('TreeitemNewspaperArticle', 'chrome://zotero/skin/treeitem-newspaperArticle.png');
i('TreeitemNote', 'chrome://zotero/skin/treeitem-note.png');
i('TreeitemNoteSmall', 'chrome://zotero/skin/treeitem-note-small.png');
i('TreeitemPatent', 'chrome://zotero/skin/treeitem-patent.png');
i('Treeitem', 'chrome://zotero/skin/treeitem.png');
i('TreeitemPodcast', 'chrome://zotero/skin/treeitem-podcast.png', false);
i('TreeitemPreprint', 'chrome://zotero/skin/treeitem-preprint.png');
i('TreeitemPresentation', 'chrome://zotero/skin/treeitem-presentation.png');
i('TreeitemRadioBroadcast', 'chrome://zotero/skin/treeitem-radioBroadcast.png', false);
i('TreeitemReport', 'chrome://zotero/skin/treeitem-report.png');
i('TreeitemStatute', 'chrome://zotero/skin/treeitem-statute.png');
i('TreeitemThesis', 'chrome://zotero/skin/treeitem-thesis.png');
i('TreeitemTvBroadcast', 'chrome://zotero/skin/treeitem-tvBroadcast.png', false);
i('TreeitemVideoRecording', 'chrome://zotero/skin/treeitem-videoRecording.png', false);
i('TreeitemWebpageGray', 'chrome://zotero/skin/treeitem-webpage-gray.png');
i('TreeitemWebpage', 'chrome://zotero/skin/treeitem-webpage.png', false);

// Treesource
i('TreesourceBucket', 'chrome://zotero/skin/treesource-bucket.png', false);
i('TreesourceCollection', 'chrome://zotero/skin/treesource-collection.png');
i('TreesourceCommons', 'chrome://zotero/skin/treesource-commons.png', false);
i('TreesourceDuplicates', 'chrome://zotero/skin/treesource-duplicates.png');
i('TreesourceFeedError', 'chrome://zotero/skin/treesource-feed-error.png');
i('TreesourceFeedLibrary', 'chrome://zotero/skin/treesource-feedLibrary.png');
i('TreesourceFeed', 'chrome://zotero/skin/treesource-feed.png');
i('TreesourceFeedUpdating', 'chrome://zotero/skin/treesource-feed-updating.png', false);
i('TreesourceGroups', 'chrome://zotero/skin/treesource-groups.png');
i('TreesourceLibrary', 'chrome://zotero/skin/treesource-library.png');
i('TreesourceSearch', 'chrome://zotero/skin/treesource-search.png');
i('TreesourceShare', 'chrome://zotero/skin/treesource-share.png', false);
i('TreesourceTrashFull', 'chrome://zotero/skin/treesource-trash-full.png');
i('TreesourceTrash', 'chrome://zotero/skin/treesource-trash.png');
i('TreesourceUnfiled', 'chrome://zotero/skin/treesource-unfiled.png');

if (Zotero.isMac) {
	i('TreesourceCollection', 'chrome://zotero-platform/content/treesource-collection.png', true);
	i('TreesourceSearch', 'chrome://zotero-platform/content/treesource-search.png', true);
	i('Twisty', (
		/* This Source Code Form is subject to the terms of the Mozilla Public
		 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
		 * You can obtain one at http://mozilla.org/MPL/2.0/. */
		<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
			<polyline points="3 4 12 4 7.5 12"/>
		</svg>
	));
}

if (Zotero.isWin) {
	i('Twisty', (
		/* This Source Code Form is subject to the terms of the Mozilla Public
		 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
		 * You can obtain one at http://mozilla.org/MPL/2.0/. */
		<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1792 1792">
			<path d="M1395 736q0 13-10 23l-466 466q-10 10-23 10t-23-10l-466-466q-10-10-10-23t10-23l50-50q10-10 23-10t23 10l393 393 393-393q10-10 23-10t23 10l50 50q10 10 10 23z"/>
		</svg>
	));
}

let domElementCache = {};

/**
 * Returns a DOM element for the icon class
 *
 * To be used in itemTree where rendering is done without react
 * for performance reasons
 * @param {String} icon
 * @returns {Element}
 */
module.exports.getDOMElement = function (icon) {
	if (domElementCache[icon]) return domElementCache[icon].cloneNode(true);
	if (!module.exports[icon]) {
		Zotero.debug(`Attempting to get non-existant icon ${icon}`);
		return "";
	}
	let div = document.createElementNS("http://www.w3.org/1999/xhtml", 'div');
	div.innerHTML = renderToStaticMarkup(React.createElement(module.exports[icon]));
	domElementCache[icon] = div.firstChild;
	return domElementCache[icon].cloneNode(true);
}