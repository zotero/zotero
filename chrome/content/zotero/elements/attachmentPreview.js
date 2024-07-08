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
	class PreviewRenderAbortError extends Error {
		constructor() {
			super("AttachmentPreview render aborted");
		}
	}

	class AttachmentPreview extends ItemPaneSectionElementBase {
		static fileTypeMap = {
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

			/**
			 * The most recent task to be processed
			 * @type {Object}
			 * @property {string} type
			 * @property {Object} data
			 * @property {number} data.itemID
			 * @property {string} data.previewType
			 */
			this._lastTask = null;

			/**
			 * The ID of the last item that was rendered
			 * @type {number}
			 */
			this._lastRenderID = null;

			/**
			 * Whether a task is currently awaiting to be processed
			 * @type {boolean}
			 */
			this._isWaitingForTask = false;

			/**
			 * Whether a task is currently being processed
			 * @type {boolean}
			 */
			this._isProcessingTask = false;

			/**
			 * Whether a render task is currently being processed
			 * @type {boolean}
			 */
			this._isRendering = false;

			/**
			 * Whether a discard task is currently being processed
			 * @type {boolean}
			 */
			this._isDiscarding = false;

			/**
			 * Whether the current preview reader is initialized by `Zotero.Reader.openPreview`.
			 * When the previous reader rendering task is aborted before initialization,
			 * reuse the reader; otherwise must discard the old reader first.
			 */
			this._isReaderInitialized = false;

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
					oncommand="this.closest('attachment-preview').goto('prev');event.stopPropagation();"/>
				<toolbarbutton id="next" class="btn-next" ondblclick="event.stopPropagation()"
					oncommand="this.closest('attachment-preview').goto('next');event.stopPropagation();"/>
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
			this._item = (val instanceof Zotero.Item && val.isFileAttachment()) ? val : null;
		}

		get previewType() {
			if (this._item?.attachmentReaderType) {
				return this._item.attachmentReaderType;
			}
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

		get isPaginatedType() {
			return ["pdf", "epub"].includes(this.previewType);
		}

		get hasPreview() {
			return this.dataset.previewStatus === "success";
		}

		get disableResize() {
			return this.dataset.disableResize !== "false";
		}

		set disableResize(val) {
			this.dataset.disableResize = val ? "true" : "false";
			this._handleResize();
		}

		setPreviewStatus(val) {
			if (!val) {
				this.setAttribute("data-preview-status", "fail");
				return;
			}
			this.setAttribute("data-preview-status", val);
		}

		init() {
			this.setPreviewStatus("loading");
			this._dragImageContainer = this.querySelector(".drag-container");
			this._resizeOb.observe(this);
			this.addEventListener("dblclick", (event) => {
				this.openAttachment(event);
			});
			this.addEventListener("DOMContentLoaded", this._handleReaderLoad);
			this.addEventListener("mouseenter", this.updateGoto);
			this.addEventListener("dragstart", this._handleDragStart);
			this.addEventListener("dragend", this._handleDragEnd);
			this.addEventListener("click", this._handleFocusIn);
			this.addEventListener("focusin", this._handleFocusIn);
			this.addEventListener("keypress", this._handleKeypress);
			this.setAttribute("data-preview-type", "unknown");
			this._notifierID = Zotero.Notifier.registerObserver(this, ["item"], "attachmentPreview");
		}

		destroy() {
			this._reader?.uninit();
			this._resizeOb.disconnect();
			this.removeEventListener("DOMContentLoaded", this._handleReaderLoad);
			this.removeEventListener("mouseenter", this.updateGoto);
			this.removeEventListener("dragstart", this._handleDragStart);
			this.removeEventListener("dragend", this._handleDragEnd);
			this.removeEventListener("click", this._handleFocusIn);
			this.removeEventListener("focusin", this._handleFocusIn);
			this.removeEventListener("keypress", this._handleKeypress);
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(event, type, ids, extraData) {
			if (!this.item) return;
			if (this.isReaderType && this._reader) {
				// Following chrome/content/zotero/xpcom/reader.js
				if (event === "delete") {
					let disappearedIDs = this._reader.annotationItemIDs.filter(x => ids.includes(x));
					if (disappearedIDs.length) {
						let keys = disappearedIDs.map(id => extraData[id].key);
						this._reader.unsetAnnotations(keys);
					}
				}
				else if (["add", "modify"].includes(event)) {
					let annotationItems = this.item.getAnnotations();
					this._reader.annotationItemIDs = annotationItems.map(x => x.id);
					let affectedAnnotations = annotationItems.filter(({ id }) => (
						ids.includes(id)
						&& !(extraData && extraData[id] && extraData[id].instanceID === this._reader._instanceID)
					));
					if (affectedAnnotations.length) {
						this._reader.setAnnotations(affectedAnnotations);
					}
				}
				return;
			}
			if (this.isMediaType) {
				if (["refresh", "modify"].includes(event) && ids.includes(this.item.id)) {
					this.render();
				}
			}
		}

		/**
		 * Queue a render task
		 * Immediately update the `_lastTask` property and wait for the current task to finish
		 * before processing the new task. This is to prevent multiple tasks from being processed
		 * at the same time. Only the most recent task will be processed.
		 * @returns {Promise<void>}
		 */
		async render() {
			this._lastTask = {
				type: "render",
				uid: `${Date.now()}-${Math.random()}`,
				data: {
					itemID: this._item?.id,
					previewType: this.previewType
				}
			};
			this._debug(`Queue render task, itemID: ${this._item?.id}, previewType: ${this.previewType}`);
			await this._processTask();
		}

		/**
		 * Queue a discard task
		 */
		async discard() {
			this._lastTask = {
				type: "discard",
				uid: `${Date.now()}-${Math.random()}`,
			};
			this._debug(`Queue discard task`);
			await this._processTask();
		}

		/**
		 * Process the most recent task
		 * @returns {Promise<void>}
		 */
		async _processTask() {
			if (!this.initialized || !this._lastTask || this._isWaitingForTask) {
				this._debug("No task to process or already waiting for a processing task");
				return;
			}

			this._isWaitingForTask = true;

			// Wait for the current render/discard to finish
			let i = 0;
			while (i < 300 && (this._isRendering || this._isDiscarding || this._isProcessingTask)) {
				await Zotero.Promise.delay(10);
				i++;
			}

			this._debug("Current task finished, processing new task");

			let task = this._lastTask;
			if (!task) {
				this._debug("No task to process");
				this._isWaitingForTask = false;
				return;
			}

			let uid = task.uid;
			
			this._isWaitingForTask = false;
			this._isProcessingTask = true;

			// If no new task was queued while processing, clear the last task
			if (this._lastTask.uid === uid) {
				this._debug("Clear last task");
				this._lastTask = null;
			}

			this._debug(`Processing task ${task.type} (${uid})`);

			switch (task.type) {
				case "render":
					await Promise.race([this._processRender(task.data), Zotero.Promise.delay(3000)]);
					break;
				case "discard":
					await Promise.race([this._processDiscard(task.data), Zotero.Promise.delay(3000)]);
					break;
			}
			
			this._isProcessingTask = false;
			// Force reset flag anyway to avoid blocking following tasks
			this._isRendering = false;
			this._isDiscarding = false;

			this._debug(`Task ${task.type} (${uid}) processed`);
		}

		/**
		 * Render the preview for the given item
		 * First discard the current preview and then render the new preview
		 * The render task will be aborted if the item changes before the task is finished
		 * @returns {Promise<void>}
		 */
		async _processRender({ itemID, previewType }) {
			if (this._lastRenderID === itemID && this.hasPreview) {
				this._debug(`Item ${itemID} already rendered`);
				return;
			}

			this._debug(`Rendering item ${itemID}, previewType: ${previewType}`);

			this._isRendering = true;
			let success = false;

			try {
				// Discard the current preview.
				await this._processDiscard();

				this._debug(`Discard finished, rendering item ${itemID}`);
	
				this._tryAbortRender(itemID);
	
				let item = Zotero.Items.get(itemID);
				if (previewType !== "file" && await item.fileExists()) {
					if (this.isReaderType) {
						success = await this._renderReader(itemID);
					}
					else if (this.isMediaType) {
						success = await this._renderMedia(itemID);
					}
				}
				
				this._tryAbortRender(itemID);
	
				this._updateWidthHeightRatio();
				this.setAttribute("data-preview-type", this.previewType);
	
				this._lastRenderID = itemID;

				this._debug(`Render not aborted, item ${itemID}`);
			}
			catch (e) {
				if (!(e instanceof PreviewRenderAbortError)) {
					this.setPreviewStatus("fail");
					this._debug(`Render failed: item ${itemID}, ${e}`);
					throw e;
				}
			}
			finally {
				this.setPreviewStatus(success ? "success" : "fail");
				this._isRendering = false;

				this._debug(`Render processed, item ${itemID} ${success ? "succeeded" : "failed"}`);
			}
		}

		/**
		 * @throws {PreviewRenderAbortError}
		 * @param {number} itemID
		 */
		_tryAbortRender(itemID) {
			if (itemID !== this._item?.id) {
				throw new PreviewRenderAbortError();
			}
		}

		/**
		 * Discard the current preview if it exists and is initialized
		 * @returns {Promise<void>}
		 */
		async _processDiscard() {
			if (!this._isReaderInitialized && !this._lastRenderID) {
				this._debug("No preview to discard");
				return;
			}

			this._debug("Discard preview");

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
			this._debug("Preview discarded");

			// Preload a new next-preview
			await this._nextPreviewInitializePromise.promise;
			this._nextPreviewInitializePromise = Zotero.Promise.defer();

			this._debug("Next preview initialized");

			this._id("preview")?.after(this.nextPreview);
			this.setPreviewStatus("loading");

			// Clean up after discarding
			this._isDiscarding = false;
			this._lastRenderID = null;
			this._isReaderInitialized = false;

			this._debug("Discard processed");
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

		/**
		 * @param {"prev" | "next"} type
		 */
		goto(type) {
			if (!this._reader?.canGoto(type)) {
				return;
			}
			this._reader?.goto(type);
			setTimeout(() => this.updateGoto(), 300);
		}

		updateGoto() {
			this._id("prev").disabled = !this._reader?.canGoto("prev");
			this._id("next").disabled = !this._reader?.canGoto("next");
		}

		_handleFocusIn() {
			this.focus();
		}

		_handleKeypress(e) {
			let stopEvent = false;
			// Space or enter open attachment
			if ([" ", "Enter"].includes(e.key)) {
				this.openAttachment(e);
				stopEvent = true;
			}
			// Hacky way to preventing the focus from going into the actual reader where it can
			// get stuck. On tab from the preview, try to find the next element and focus it.
			else if (e.key == "Tab" && !e.shiftKey) {
				let toFocus = this.nextElementSibling.querySelector('[tabindex="0"]');
				if (!toFocus && this.nextElementSibling.getAttribute("tabindex") == "0") {
					toFocus = this.nextElementSibling;
				}
				if (toFocus) {
					toFocus.focus();
					stopEvent = true;
				}
			}
			else if (this.isPaginatedType && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
				let gotoType = {
					[Zotero.arrowPreviousKey]: "prev",
					[Zotero.arrowNextKey]: "next"
				};
				this.goto(gotoType[e.key]);
				stopEvent = true;
			}

			if (stopEvent) {
				e.stopPropagation();
				e.preventDefault();
			}
		}

		/**
		 * Render the reader for the given item
		 * @throws {PreviewRenderAbortError}
		 * @param {number} itemID
		 */
		async _renderReader(itemID) {
			this.setPreviewStatus("loading");
			// This only need to be awaited during first load
			await this._previewInitializePromise.promise;
			// This should be awaited in the following refreshes
			await this._nextPreviewInitializePromise.promise;

			this._tryAbortRender(itemID);

			let prev = this._id("prev");
			let next = this._id("next");
			prev && (prev.disabled = true);
			next && (next.disabled = true);
			let success = false;
			let preview = this._id("preview");

			this._debug(`Loading preview render for item id ${itemID}, iframe is ${preview}`);

			// The reader will be initialized if the operation is not aborted before this point
			// and we'll need to discard the reader even if the operation is not finished
			this._isReaderInitialized = true;
			this._reader = await Zotero.Reader.openPreview(itemID, preview);

			this._tryAbortRender(itemID);

			success = await this._reader._open({});
			
			prev && (prev.disabled = true);
			next && (next.disabled = false);
			return success;
		}

		async _renderMedia() {
			this.setPreviewStatus("loading");
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

		_handleResize() {
			if (this.disableResize) return;
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

		_id(id) {
			return this.querySelector(`#${id}`);
		}

		_debug(message, ...args) {
			if (!Zotero.test) return;
			Zotero.debug(`[AttachmentPreview] ${message}`, ...args);
		}
	}

	customElements.define("attachment-preview", AttachmentPreview);
}
