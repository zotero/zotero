const { getCSSIcon, getCSSItemTypeIcon } = require('components/icons');
const { renderCell: baseRenderCell } = require('components/virtualized-table');
const { XPCOMUtils } = ChromeUtils.importESModule("resource://gre/modules/XPCOMUtils.sys.mjs");

const lazy = {};
XPCOMUtils.defineLazyPreferenceGetter(
	lazy,
	"BIDI_BROWSER_UI",
	"bidi.browser.ui",
	false
);

const ATTACHMENT_STATE_LOAD_DELAY = 150;

/**
 * Base row in an ItemTree.
 *
 * Provides safe defaults for all row types. Subclass for specific reference
 * types (ZoteroItemTreeRow, CollectionItemTreeRow, SearchItemTreeRow, etc.).
 */
class ItemTreeRow {
	constructor(ref, level, isOpen) {
		this.ref = ref;
		this.level = level;
		this.isOpen = isOpen;
		this.id = ref.treeViewID;
	}

	get type() {
		return 'item';
	}

	get isDraggable() {
		return false;
	}

	isContainer() {
		return false;
	}

	isContainerOpen() {
		return this.isOpen;
	}

	isContainerEmpty() {
		return true;
	}

	getChildItems() {
		return [];
	}

	getBestAttachmentStateCached() {
		return null;
	}

	getBestAttachmentState() {
		return null;
	}

	numNotes() {
		return 0;
	}

	getField(field) {
		if (Zotero.ItemTreeManager.isCustomColumn(field)) {
			return Zotero.ItemTreeManager.getCustomCellData(this.ref, field);
		}
		return '';
	}

	getTypeLabel() {
		return '';
	}

	getDisplayTitle() {
		return '';
	}

	getIcon() {
		return getCSSItemTypeIcon('document');
	}

	renderRow(div, index, columns, rowData, renderCtx) {
		for (let column of columns) {
			if (column.hidden) continue;
			div.appendChild(renderCtx.renderCell(index, rowData[column.dataKey], column, column === renderCtx.firstColumn));
		}
	}

	renderCell(index, data, column, isFirstColumn) {
		let cell;
		if (column.primary) {
			cell = this.renderPrimaryCell(index, data, column);
		}
		else {
			cell = baseRenderCell(index, data, column, isFirstColumn);
			if (column.dataKey === 'numNotes' && data) {
				cell.dataset.l10nId = 'items-table-cell-notes';
				cell.dataset.l10nArgs = JSON.stringify({ count: data });
			}
			else if (column.dataKey === 'itemType') {
				cell.setAttribute('aria-hidden', true);
			}
		}
		if (column.noPadding) {
			cell.classList.add('no-padding');
		}
		return cell;
	}

	renderPrimaryCell(index, data, column) {
		let span = document.createElement('span');
		span.className = `cell ${column.className}`;
		span.classList.add('primary');

		let textSpan = document.createElement('span');
		textSpan.className = 'cell-text';
		Zotero.Utilities.Internal.renderItemTitle(data, textSpan);
		span.append(textSpan);

		return span;
	}
}

/**
 * Row wrapping a Zotero.Item (regular items, notes, and non-file attachments).
 *
 * Provides field access, container logic for child notes/attachments,
 * and full primary-cell rendering (tags, retraction marks, BIDI handling).
 */
class ZoteroItemTreeRow extends ItemTreeRow {
	get isDraggable() {
		return true;
	}

	getField(field, unformatted) {
		if (this.ref.hasOwnProperty(field) && this.ref[field] != null) {
			return this.ref[field];
		}
		else if (!Zotero.ItemTreeManager.isCustomColumn(field)) {
			return this.ref.getField(field, unformatted, true);
		}
		return Zotero.ItemTreeManager.getCustomCellData(this.ref, field);
	}

	numNotes() {
		if (this.ref.isNote()) {
			return 0;
		}
		if (this.ref.isAttachment()) {
			return this.ref.note !== '' ? 1 : 0;
		}
		return this.ref.numNotes(false, true) || 0;
	}

	isContainer() {
		return this.ref.isRegularItem();
	}

	isContainerEmpty({ includeTrashed } = {}) {
		if (!this.ref.isRegularItem()) {
			return true;
		}
		return this.ref.numNotes(includeTrashed) === 0
			&& this.ref.numAttachments(includeTrashed) == 0;
	}

	getChildItems({ includeTrashed } = {}) {
		if (!this.ref.isRegularItem()) {
			return [];
		}

		let attachments = this.ref.getAttachments(includeTrashed);
		let notes = this.ref.getNotes(includeTrashed);
		let childIDs;
		if (attachments.length && notes.length) {
			childIDs = notes.concat(attachments);
		}
		else if (attachments.length) {
			childIDs = attachments;
		}
		else if (notes.length) {
			childIDs = notes;
		}
		else {
			return [];
		}

		return Zotero.Items.get(childIDs);
	}

	_supportsBestAttachmentState() {
		return this.ref.isRegularItem() && this.ref.numAttachments();
	}

	getBestAttachmentStateCached() {
		if (!this._supportsBestAttachmentState()) {
			return null;
		}
		return this.ref.getBestAttachmentStateCached();
	}

	getBestAttachmentState() {
		if (!this._supportsBestAttachmentState()) {
			return null;
		}
		return this.ref.getBestAttachmentState();
	}

	getTypeLabel() {
		if (!this.ref.itemTypeID) {
			return '';
		}
		try {
			return Zotero.ItemTypes.getLocalizedString(this.ref.itemTypeID);
		}
		catch (e) {
			Zotero.debug(`Error getting localized item type for ${this.ref.itemTypeID}`, 1);
			Zotero.debug(e, 1);
			return '';
		}
	}

	getDisplayTitle() {
		return this.ref.getDisplayTitle();
	}

	getIcon() {
		return getCSSItemTypeIcon(this.ref.getItemTypeIconName());
	}

	renderCell(index, data, column, isFirstColumn, renderCtx) {
		if (column.dataKey === 'hasAttachment') {
			return this.renderHasAttachmentCell(index, data, column, renderCtx);
		}
		return super.renderCell(index, data, column, isFirstColumn, renderCtx);
	}

	renderPrimaryCell(index, data, column) {
		let span = document.createElement('span');
		span.className = `cell ${column.className}`;
		span.classList.add('primary');

		const item = this.ref;
		let retracted = '';
		let retractedAriaLabel = '';
		if (Zotero.Retractions.isRetracted(item)) {
			retracted = getCSSIcon('cross');
			retracted.classList.add('icon-16');
			retracted.classList.add('retracted');
			retractedAriaLabel = Zotero.getString('retraction.banner');
		}

		let tagAriaLabel = '';
		let tagSpans = [];
		let coloredTags = item.getItemsListTags();
		if (coloredTags.length) {
			let { emoji, colored } = coloredTags.reduce((acc, tag) => {
				acc[Zotero.Utilities.Internal.containsEmoji(tag.tag) ? 'emoji' : 'colored'].push(tag);
				return acc;
			}, { emoji: [], colored: [] });

			if (colored.length) {
				let coloredTagSpans = colored.map(x => this.getTagSwatch(x.tag, x.color));
				let coloredTagSpanWrapper = document.createElement('span');
				coloredTagSpanWrapper.className = 'colored-tag-swatches';
				coloredTagSpanWrapper.append(...coloredTagSpans);
				tagSpans.push(coloredTagSpanWrapper);
			}

			tagSpans.push(...emoji.map(x => this.getTagSwatch(x.tag)));

			tagAriaLabel = coloredTags.length == 1 ? Zotero.getString('searchConditions.tag') : Zotero.getString('itemFields.tags');
			tagAriaLabel += ' ' + coloredTags.map(x => x.tag).join(', ') + '.';
		}

		let itemTypeAriaLabel = this.getTypeLabel();
		if (itemTypeAriaLabel) {
			itemTypeAriaLabel += '.';
		}

		let textSpan = document.createElement('span');
		let textWithFullStop = Zotero.Utilities.Internal.renderItemTitle(data, textSpan);
		if (!textWithFullStop.match(/\.$/)) {
			textWithFullStop += '.';
		}
		let textSpanAriaLabel = [textWithFullStop, itemTypeAriaLabel, tagAriaLabel, retractedAriaLabel]
			.filter(Boolean)
			.join(' ');
		textSpan.className = 'cell-text';
		if (item.itemTypeID && lazy.BIDI_BROWSER_UI) {
			textSpan.dir = Zotero.ItemFields.getDirection(
				item.itemTypeID, column.dataKey, item.getField('language')
			);
		}
		textSpan.setAttribute('aria-label', textSpanAriaLabel);

		if (Zotero.Prefs.get('ui.tagsAfterTitle')) {
			span.append(retracted, textSpan, ...tagSpans);
		}
		else {
			span.append(retracted, ...tagSpans, textSpan);
		}

		return span;
	}

	getTagSwatch(tag, color) {
		let span = document.createElement('span');
		span.className = 'tag-swatch';
		let extractedEmojis = Zotero.Tags.extractEmojiForItemsList(tag);
		if (extractedEmojis) {
			span.textContent = extractedEmojis;
			span.className += ' emoji';
		}
		else {
			span.className += ' colored';
			span.dataset.color = color.toLowerCase();
			span.style.color = color;
		}
		return span;
	}

	renderHasAttachmentCell(index, data, column, renderCtx = {}) {
		let span = document.createElement('span');
		span.className = `cell ${column.className}`;

		if (renderCtx.includeTrashed) {
			return span;
		}

		const item = this.ref;
		if ((!this.isContainer() || !this.isContainerOpen())) {
			let progressValue = Zotero.Sync.Storage.getItemDownloadProgress(item);
			if (progressValue) {
				let progress = document.createElement('progress');
				progress.value = progressValue;
				progress.max = 100;
				progress.style.setProperty('--progress', `${progressValue}%`);
				progress.className = 'attachment-progress';
				span.append(progress);
				return span;
			}
		}

		const attachmentState = this.getBestAttachmentStateCached();
		if (!attachmentState) {
			return span;
		}
		const { type, exists } = attachmentState;
		let icon;
		let ariaLabel;
		if (type !== null && type != 'none') {
			if (type == 'pdf') {
				icon = getCSSItemTypeIcon('attachmentPDF', 'attachment-type');
				ariaLabel = Zotero.getString('pane.item.attachments.hasPDF');
			}
			else if (type == 'snapshot') {
				icon = getCSSItemTypeIcon('attachmentSnapshot', 'attachment-type');
				ariaLabel = Zotero.getString('pane.item.attachments.hasSnapshot');
			}
			else if (type == 'epub') {
				icon = getCSSItemTypeIcon('attachmentEPUB', 'attachment-type');
				ariaLabel = Zotero.getString('pane.item.attachments.hasEPUB');
			}
			else if (type == 'image') {
				icon = getCSSItemTypeIcon('attachmentImage', 'attachment-type');
				ariaLabel = Zotero.getString('pane.item.attachments.hasImage');
			}
			else if (type == 'video') {
				icon = getCSSItemTypeIcon('attachmentVideo', 'attachment-type');
				ariaLabel = Zotero.getString('pane.item.attachments.hasVideo');
			}
			else {
				icon = getCSSItemTypeIcon('attachmentFile', 'attachment-type');
				ariaLabel = Zotero.getString('pane.item.attachments.has');
			}

			if (!exists) {
				icon.classList.add('icon-missing-file');
			}
		}
		if (icon && ariaLabel) {
			icon.setAttribute('aria-label', ariaLabel + '.');
			span.setAttribute('title', ariaLabel);
		}
		if (icon) {
			span.append(icon);
		}

		let invalidateRow = renderCtx.invalidateRow;
		if (!invalidateRow) {
			return span;
		}

		setTimeout(() => {
			let statePromise = this.getBestAttachmentState();
			if (!statePromise?.then) {
				return;
			}
			statePromise
				.then(({ type: newType, exists: newExists } = {}) => {
					if (newType !== type || newExists !== exists) {
						invalidateRow(index);
					}
				})
				.catch((e) => Zotero.logError(e));
		}, ATTACHMENT_STATE_LOAD_DELAY);

		return span;
	}
}

/**
 * Row wrapping a file attachment (PDF, snapshot, EPUB, etc.).
 *
 * Acts as a container for annotation child rows and overrides title display
 * to show attachment filenames when configured.
 */
class FileItemTreeRow extends ZoteroItemTreeRow {
	isContainer() {
		return true;
	}

	isContainerEmpty({ searchMode, searchItemIDs } = {}) {
		if (Zotero.Prefs.get("hideContextAnnotationRows") && searchMode) {
			return !this.ref.getAnnotations().some(annotation => searchItemIDs.has(annotation.id));
		}
		return this.ref.numAnnotations() == 0;
	}

	getChildItems({ searchMode, searchItemIDs } = {}) {
		let annotations = this.ref.getAnnotations();
		if (Zotero.Prefs.get("hideContextAnnotationRows") && searchMode) {
			annotations = annotations.filter(annotation => searchItemIDs.has(annotation.id));
		}
		return annotations;
	}

	_supportsBestAttachmentState() {
		return this.ref.isTopLevelItem();
	}

	getDisplayTitle() {
		if (!(this.ref.isSnapshotAttachment()
				&& /snapshot/i.test(this.ref.getField('title')))
				&& Zotero.Prefs.get('showAttachmentFilenames')) {
			try {
				return this.ref.attachmentFilename;
			}
			catch {
				// Path wasn't parseable - it could be truly invalid, or just
				// invalid for this platform (e.g., Windows path on macOS/Linux)
				return this.ref.attachmentPath;
			}
		}
		return this.ref.getDisplayTitle();
	}
}

/**
 * Row wrapping an annotation item.
 *
 * Never a container. Uses the annotation-specific icon and custom row content
 * layout used in the items tree.
 */
class AnnotationItemTreeRow extends ZoteroItemTreeRow {
	get type() {
		return 'annotation';
	}

	isContainer() {
		return false;
	}

	getIcon() {
		let itemType = this.ref.getItemTypeIconName();
		return getCSSItemTypeIcon(itemType, `annotation-${this.ref.annotationType}-${this.ref.annotationColor}`);
	}

	renderRow(div, index, columns, rowData, renderCtx) {
		div.classList.add('annotation-row');
		div.classList.remove('tight');

		let titleRowData = Object.assign({}, columns.find(column => column.dataKey == 'title'));
		titleRowData.className = 'title';

		let title;
		let parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
		let plainText = parserUtils.convertToPlainText(this.ref.annotationText || "", Ci.nsIDocumentEncoder.OutputRaw, 0);
		let plainComment = parserUtils.convertToPlainText(this.ref.annotationComment || "", Ci.nsIDocumentEncoder.OutputRaw, 0);
		if (["highlight", "underline"].includes(this.ref.annotationType)) {
			title = renderCtx.renderCell(index, plainText, titleRowData, true);
			let titleCell = title.querySelector('.cell-text');
			titleCell.classList.add('italics');
			titleCell.setAttribute('q-mark-open', Zotero.getString('punctuation.openingQMark'));
			title.setAttribute('q-mark-close', Zotero.getString('punctuation.closingQMark'));
			if (this.ref.annotationComment) {
				let comment = baseRenderCell(null, plainComment, { className: 'annotation-comment' });
				div.appendChild(comment);
			}
			let containsCJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(this.ref.annotationText);
			div.classList.toggle('tight', !containsCJK);
		}
		else if (this.ref.annotationComment) {
			title = renderCtx.renderCell(index, plainComment, titleRowData, true);
		}
		else {
			let annotationTypeName = Zotero.getString(`pdfReader.${this.ref.annotationType}Annotation`);
			title = renderCtx.renderCell(index, annotationTypeName, titleRowData, true);
		}
		div.prepend(title);
	}
}

/**
 * Row wrapping a Zotero.Collection (shown in trash view).
 */
class CollectionItemTreeRow extends ItemTreeRow {
	get type() {
		return 'collection';
	}

	getIcon() {
		let icon = getCSSIcon('collection');
		icon.classList.add('icon-item-type');
		return icon;
	}

	getTypeLabel() {
		return Zotero.getString('searchConditions.collection');
	}

	getDisplayTitle() {
		return this.ref.name;
	}

	getField(field) {
		if (field == 'title') {
			return this.ref.name;
		}
		if (Zotero.ItemTreeManager.isCustomColumn(field)) {
			return Zotero.ItemTreeManager.getCustomCellData(this.ref, field);
		}
		return '';
	}

	renderPrimaryCell(index, data, column) {
		return super.renderPrimaryCell(index, data, column);
	}
}

/**
 * Row wrapping a Zotero.Search (saved search, shown in trash view).
 */
class SearchItemTreeRow extends ItemTreeRow {
	get type() {
		return 'search';
	}

	getIcon() {
		let icon = getCSSIcon('search');
		icon.classList.add('icon-item-type');
		return icon;
	}

	getTypeLabel() {
		return Zotero.getString('searchConditions.savedSearch');
	}

	getDisplayTitle() {
		return this.ref.name;
	}

	getField(field) {
		if (field == 'title') {
			return this.ref.name;
		}
		if (Zotero.ItemTreeManager.isCustomColumn(field)) {
			return Zotero.ItemTreeManager.getCustomCellData(this.ref, field);
		}
		return '';
	}

	renderPrimaryCell(index, data, column) {
		return super.renderPrimaryCell(index, data, column);
	}
}

/**
 * Create the appropriate ItemTreeRow subclass for a reference object.
 *
 * Dispatch order: Collection, Search, annotation item, file attachment item,
 * generic Zotero.Item, and finally the base ItemTreeRow fallback.
 */
ItemTreeRow.create = function (ref, level, isOpen) {
	if (ref instanceof Zotero.Collection) return new CollectionItemTreeRow(ref, level, isOpen);
	if (ref instanceof Zotero.Search) return new SearchItemTreeRow(ref, level, isOpen);
	if (ref.isAnnotation?.()) return new AnnotationItemTreeRow(ref, level, isOpen);
	if (ref.isFileAttachment?.()) return new FileItemTreeRow(ref, level, isOpen);
	return new ZoteroItemTreeRow(ref, level, isOpen);
};

module.exports = ItemTreeRow;
module.exports.ItemTreeRow = ItemTreeRow;
module.exports.ZoteroItemTreeRow = ZoteroItemTreeRow;
module.exports.FileItemTreeRow = FileItemTreeRow;
module.exports.AnnotationItemTreeRow = AnnotationItemTreeRow;
module.exports.CollectionItemTreeRow = CollectionItemTreeRow;
module.exports.SearchItemTreeRow = SearchItemTreeRow;
