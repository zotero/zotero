/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2023 Corporation for Digital Scholarship
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

{
	// eslint-disable-next-line no-undef
	class AttachmentPreview extends XULElementBase {
		static fileTypeMap = {
			'application/pdf': 'pdf',
			'application/epub+zip': 'epub',
			'text/html': 'snapshot',
			// TODO: support video and audio
			// 'video/mp4': 'video',
			// 'video/webm': 'video',
			// 'video/ogg': 'video',
			// 'audio/': 'audio',
			'image/': 'image',
		};

		constructor() {
			super();

			this._item = null;
			this._reader = null;
			this._previewInitializePromise = Zotero.Promise.defer();
			this._nextPreviewInitializePromise = Zotero.Promise.defer();

			this._renderingItemID = null;

			this._isDiscardPlanned = false;
			this._isDiscarding = false;

			this._intersectionOb = new IntersectionObserver(this._handleIntersection.bind(this));
			this._resizeOb = new ResizeObserver(this._handleResize.bind(this));
		}

		content = MozXULElement.parseXULToFragment(`
			<browser id="preview"
				tooltip="iframeTooltip"
				type="content"
				primary="true"
				transparent="transparent"
				src="resource://zotero/reader/reader.html"
				flex="1"/>
			<browser id="next-preview"
				tooltip="iframeTooltip"
				type="content"
				primary="true"
				transparent="transparent"
				src="resource://zotero/reader/reader.html"
				flex="1"/>
			<html:img id="image-preview" class="media-preview"></html:img>
			<html:span class="icon"></html:span>
			<html:div class="btn-container">
				<toolbarbutton id="prev" class="btn-prev" ondblclick="event.stopPropagation()"
					data-goto="prev" oncommand="this.closest('attachment-preview').goto(event)"/>
				<toolbarbutton id="next" class="btn-next" ondblclick="event.stopPropagation()"
					data-goto="next" oncommand="this.closest('attachment-preview').goto(event)"/>
			</html:div>
			<html:div class="drag-container"></html:div>
		`);

		get nextPreview() {
			return MozXULElement.parseXULToFragment(`
				<browser id="next-preview"
					tooltip="iframeTooltip"
					type="content"
					primary="true"
					transparent="transparent"
					src="resource://zotero/reader/reader.html"
					flex="1"/>
			`);
		}

		get item() {
			return this._item;
		}

		set item(val) {
			this._item = (val instanceof Zotero.Item && val.isAttachment()) ? val : null;
			if (this.isVisible) {
				this.render();
			}
		}

		setItemAndRender(item) {
			this._item = item;
			this.render();
		}

		get previewType() {
			let contentType = this._item?.attachmentContentType;
			if (!contentType) {
				return "file";
			}
			for (let type in AttachmentPreview.fileTypeMap) {
				if (contentType.startsWith(type)) {
					return AttachmentPreview.fileTypeMap[type];
				}
			}
			return "file";
		}

		get isValidType() {
			return this.previewType !== "file";
		}

		get isReaderType() {
			return ["pdf", "epub", "snapshot"].includes(this.previewType);
		}

		get isMediaType() {
			return ["video", "audio", "image"].includes(this.previewType);
		}

		get hasPreview() {
			return this.getAttribute("data-preview-status") === "success";
		}

		setPreviewStatus(val) {
			if (!val) {
				this.setAttribute("data-preview-status", "fail");
				return;
			}
			this.setAttribute("data-preview-status", val);
		}

		get isVisible() {
			const rect = this.getBoundingClientRect();
			// Sample per 20 px
			const samplePeriod = 20;
			let x = rect.left + rect.width / 2;
			let yStart = rect.top;
			let yEnd = rect.bottom;
			let elAtPos;
			// Check visibility from top/bottom to center
			for (let dy = 1; dy < Math.floor((yEnd - yStart) / 2); dy += samplePeriod) {
				elAtPos = document.elementFromPoint(x, yStart + dy);
				if (this.contains(elAtPos)) {
					return true;
				}
				elAtPos = document.elementFromPoint(x, yEnd - dy);
				if (this.contains(elAtPos)) {
					return true;
				}
			}
			return false;
		}

		init() {
			this.setPreviewStatus("loading");
			this._dragImageContainer = this.querySelector(".drag-container");
			this._intersectionOb.observe(this);
			this._resizeOb.observe(this);
			this.addEventListener("dblclick", (event) => {
				this.openAttachment(event);
			});
			this.addEventListener("DOMContentLoaded", this._handleReaderLoad);
			this.addEventListener("mouseenter", this.updateGoto);
			this.addEventListener("dragstart", this._handleDragStart);
			this.addEventListener("dragend", this._handleDragEnd);
			this.setAttribute("data-preview-type", "unknown");
		}

		destroy() {
			this._reader?.uninit();
			this._intersectionOb.disconnect();
			this._resizeOb.disconnect();
			this.removeEventListener("DOMContentLoaded", this._handleReaderLoad);
			this.removeEventListener("mouseenter", this.updateGoto);
			this.removeEventListener("dragstart", this._handleDragStart);
			this.removeEventListener("dragend", this._handleDragEnd);
		}

		async render() {
			let itemID = this._item?.id;
			if (!this.initialized && itemID === this._renderingItemID) {
				return;
			}
			this._renderingItemID = itemID;
			let success = false;
			if (this.isValidType && await IOUtils.exists(this._item.getFilePath())) {
				if (this.isReaderType) {
					success = await this._renderReader();
				}
				else if (this.isMediaType) {
					success = await this._renderMedia();
				}
			}
			if (itemID !== this._item?.id) {
				return;
			}
			this._updateWidthHeightRatio();
			this.setAttribute("data-preview-type", this.previewType);
			this.setPreviewStatus(success ? "success" : "fail");
			if (this._renderingItemID === itemID) {
				this._renderingItemID = null;
			}
		}

		async discard(force = false) {
			if (!this.initialized) {
				return;
			}
			this._isDiscardPlanned = false;
			if (this._isDiscarding) {
				return;
			}
			if (!force && this.isVisible) {
				return;
			}
			this._isDiscarding = true;
			if (this._reader) {
				let _reader = this._reader;
				this._reader = null;
				try {
					_reader.uninit();
				}
				catch (e) {}
			}
			this._id("preview")?.remove();
			// Make previously loaded next-preview be current preview browser
			let nextPreview = this._id("next-preview");
			if (nextPreview) {
				nextPreview.id = "preview";
			}
			// Preload a new next-preview
			await this._nextPreviewInitializePromise.promise;
			this._nextPreviewInitializePromise = Zotero.Promise.defer();
			this._id("preview")?.after(this.nextPreview);
			this.setPreviewStatus("loading");
			this._isDiscarding = false;
		}

		async openAttachment(event) {
			if (!this.isValidType) {
				return;
			}
			let options = {
				location: {},
			};
			if (this.previewType === "pdf") {
				let state = await this._reader?._internalReader?._state;
				options.location = state?.primaryViewStats;
			}
			ZoteroPane.viewAttachment(this._item.id, event, false, options);
		}

		goto(ev) {
			this._reader?.goto(ev.target.getAttribute("data-goto"));
			ev.stopPropagation();
			setTimeout(() => this.updateGoto(), 300);
		}

		updateGoto() {
			this._id("prev").disabled = !this._reader?.canGoto("prev");
			this._id("next").disabled = !this._reader?.canGoto("next");
		}

		async _renderReader() {
			this.setPreviewStatus("loading");
			// This only need to be awaited during first load
			await this._previewInitializePromise.promise;
			// This should be awaited in the following refreshes
			await this._nextPreviewInitializePromise.promise;
			let prev = this._id("prev");
			let next = this._id("next");
			prev && (prev.disabled = true);
			next && (next.disabled = true);
			let success = false;
			if (this._reader?._item?.id !== this._item?.id) {
				await this.discard(true);
				this._reader = await Zotero.Reader.openPreview(this._item.id, this._id("preview"));
				success = await this._reader._open({});
				if (!success) {
					this._nextPreviewInitializePromise.resolve();
					// If failed on half-way of initialization, discard it
					this.discard(true);
					setTimeout(() => {
						// Try to re-render later
						this.render();
					}, 500);
				}
			}
			else {
				success = true;
			}
			prev && (prev.disabled = true);
			next && (next.disabled = false);
			return success;
		}

		async _renderMedia() {
			let mediaLoadPromise = new Zotero.Promise.defer();
			let mediaID = `${this.previewType}-preview`;
			let media = this._id(mediaID);
			// Create media element when needed to avoid unnecessarily loading libs like libavcodec, libvpx, etc.
			if (!media) {
				if (this.previewType === "video") {
					media = document.createElement("video");
				}
				else if (this.previewType === "audio") {
					media = document.createElement("audio");
				}
				media.id = mediaID;
				media.classList.add("media-preview");
				this._id("next-preview").after(media);
			}
			media.onload = () => {
				mediaLoadPromise.resolve();
			};
			media.src = `zotero://attachment/${Zotero.API.getLibraryPrefix(this._item.libraryID)}/items/${this._item.key}/`;
			await mediaLoadPromise.promise;
			return true;
		}

		_handleReaderLoad(event) {
			if (this._id("preview")?.contentWindow?.document === event.target) {
				this._previewInitializePromise.resolve();
			}
			else if (this._id("next-preview")?.contentWindow?.document === event.target) {
				this._nextPreviewInitializePromise.resolve();
			}
		}

		async _handleIntersection(entries) {
			const DISCARD_TIMEOUT = 60000;
			let needsRefresh = false;
			let needsDiscard = false;
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					needsRefresh = true;
				}
				else {
					needsDiscard = true;
				}
			});
			if (needsRefresh) {
				let sidenav = this._getSidenav();
				// Sidenav is in smooth scrolling mode
				if (sidenav?._disableScrollHandler) {
					// Wait for scroll to finish
					await sidenav._waitForScroll();
					// If the preview is not visible, do not render
					if (!this.isVisible) {
						return;
					}
				}
				// Try to render the preview when the preview enters viewport
				this.render();
			}
			else if (!this._isDiscardPlanned && needsDiscard) {
				this._isDiscardPlanned = true;
				setTimeout(() => {
					this.discard();
				}, DISCARD_TIMEOUT);
			}
		}

		_handleResize() {
			this.style.setProperty("--preview-width", `${this.clientWidth}px`);
		}

		_handleDragStart(event) {
			this._updateDragImage();
			Zotero.Utilities.Internal.onDragItems(event, [this.item.id], this._dragImageContainer);
		}

		_handleDragEnd() {
			this._dragImageContainer.innerHTML = "";
		}

		_updateDragImage() {
			let dragImage;
			if (this.isMediaType) {
				dragImage = this._id(`${this.previewType}-preview`).cloneNode(true);
			}
			else {
				dragImage = this.querySelector(".icon").cloneNode(true);
			}
			this._dragImageContainer.append(dragImage);
		}
		
		_updateWidthHeightRatio() {
			const A4Size = 0.7070707071;
			const BookSize = 1.25;
			let defaultSize = this.previewType === "pdf" ? A4Size : BookSize;
			let scaleRatio = defaultSize;
			if (this.previewType === "pdf") {
				scaleRatio = this._reader?.getPageWidthHeightRatio();
			}
			else if (this.previewType === "image") {
				let img = this._id("image-preview");
				scaleRatio = img.naturalWidth / img.naturalHeight;
			}
			!scaleRatio && (scaleRatio = defaultSize);
			this.style.setProperty("--width-height-ratio", scaleRatio);
		}

		_getSidenav() {
			// TODO: update this after unifying item pane & context pane
			return document.querySelector(
				Zotero_Tabs.selectedType === 'library'
					? "#zotero-view-item-sidenav"
					: "#zotero-context-pane-sidenav");
		}

		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}

	customElements.define("attachment-preview", AttachmentPreview);
}
