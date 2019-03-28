// TODO: Import ToC

class PdfImport {
	constructor() {
		this._queue = [];
		this._queueProcessing = false;
		this._processingItemID = null;
		this._progressQueue = Zotero.ProgressQueues.create({
			id: 'pdf-import',
			title: 'pdfImport.title',
			columns: [
				'recognizePDF.pdfName.label',
				'pdfImport.annotations.label'
			]
		});

		this._progressQueue.addListener('cancel', () => {
			this._queue = [];
		});
	}

	isPDFAttachment(item) {
		return item.isAttachment() && item.attachmentContentType === 'application/pdf';
	}

	canImport(item) {
		if (this.isPDFAttachment(item)) {
			return true;
		}
		else if (item.isRegularItem()) {
			let ids = item.getAttachments();
			for (let id of ids) {
				let attachment = Zotero.Items.get(id);
				if (this.isPDFAttachment(attachment)) {
					return true;
				}
			}
		}
	};

	/**
	 * Triggers queue processing and returns when all items in the queue are processed
	 * @return {Promise}
	 */
	async _processQueue() {
		// await Zotero.Schema.schemaUpdatePromise;

		if (this._queueProcessing) return;
		this._queueProcessing = true;

		while (1) {
			let itemID = this._queue.pop();
			if (!itemID) break;

			this._processingItemID = itemID;

			this._progressQueue.updateRow(itemID, Zotero.ProgressQueue.ROW_PROCESSING, Zotero.getString('general.processing'));

			try {
				let item = await Zotero.Items.getAsync(itemID);

				if (!item) {
					throw new Error();
				}

				let num = await this._importItemAnnotations(item);
				this._progressQueue.updateRow(itemID, Zotero.ProgressQueue.ROW_SUCCEEDED, num);
			}
			catch (e) {
				Zotero.logError(e);

				this._progressQueue.updateRow(
					itemID,
					Zotero.ProgressQueue.ROW_FAILED,
					e instanceof Zotero.Exception.Alert
						? e.message
						: Zotero.getString('general.error')
				);
			}
		}

		this._queueProcessing = false;
		this._processingItemID = null;
	}

	/**
	 * Adds items to the queue and triggers processing
	 * @param {Zotero.Item[]} items
	 */
	async import(items, isPriority) {
		let pdfItems = [];

		if (!Array.isArray(items)) {
			items = [items];
		}

		for (let item of items) {
			if (this.isPDFAttachment(item)) {
				pdfItems.push(item);
			}
			else if (item.isRegularItem()) {
				let ids = item.getAttachments();
				for (let id of ids) {
					let attachment = Zotero.Items.get(id);
					if (this.isPDFAttachment(attachment)) {
						pdfItems.push(attachment);
					}
				}
			}
		}

		for (let item of pdfItems) {
			if (
				this._processingItemID === item.id ||
				this._queue.includes(item.id)
			) {
				continue;
			}
			this._queue.unshift(item.id);
			this._progressQueue.addRow(item);
		}
		await this._processQueue();
	}

	similarAnnotions(annotation1, annotation2) {
		return (annotation1.position.pageIndex === annotation2.position.pageIndex &&
			JSON.stringify(annotation1.position.rects) === JSON.stringify(annotation2.position.rects));
	}

	async _importItemAnnotations(item) {
		if (!item.isAttachment() || item.attachmentContentType !== 'application/pdf') {
			throw new Error('Not a valid PDF attachment');
		}
		
		// TODO: Remove when fixed
		item._loaded.childItems = true;
		let ids = item.getAnnotations();
		let existingAnnotations = [];
		for (let id of ids) {
			try {
				existingAnnotations.push(Zotero.Annotations.toJSON(Zotero.Items.get(id)));
			} catch (e) {
				Zotero.logError(e);
			}
		}

		let annotations = await Zotero.PDFWorker.readAnnotations(item.id);
		annotations = annotations.filter(x => ['highlight', 'note'].includes(x.type));

		let num = 0;
		for (let annotation of annotations) {
			annotation.comment = annotation.comment || '';
			if (existingAnnotations.some(existingAnnotation => this.similarAnnotions(existingAnnotation, annotation))) {
				continue;
			}

			// TODO: Utilize the saved Zotero item key for deduplication
			annotation.key = Zotero.DataObjectUtilities.generateKey();
			let annotationItem = await Zotero.Annotations.saveFromJSON(item, annotation);
			num++;
		}

		return num;
	}
}

Zotero.PDFImport = new PdfImport();
