class PDFExport {
	constructor() {
		this._queue = [];
		this._queueProcessing = false;
		this._processingItemID = null;
		this._progressQueue = Zotero.ProgressQueues.create({
			id: 'pdf-export',
			title: 'pdfExport.title',
			columns: [
				'recognizePDF.pdfName.label',
				'pdfImport.annotations.label'
			]
		});

		this._progressQueue.addListener('cancel', () => {
			this._queue = [];
		});
	}

	hasAnnotations(item) {
		item._loaded.childItems = true;
		return item.isAttachment() && item.getAnnotations().length;
	}

	canExport(item) {
		if (this.hasAnnotations(item)) {
			return true;
		}
		else if (item.isRegularItem()) {
			let ids = item.getAttachments();
			for (let id of ids) {
				let attachment = Zotero.Items.get(id);
				if (this.hasAnnotations(attachment)) {
					return true;
				}
			}
		}
		
		return false;
	}

	/**
	 * Triggers queue processing and returns when all items in the queue are processed
	 * @return {Promise}
	 */
	async _processQueue() {
		// await Zotero.Schema.schemaUpdatePromise;

		if (this._queueProcessing) return;
		this._queueProcessing = true;

		while (1) {
			let data = this._queue.pop();
			if (!data) break;

			let { itemID, path } = data;

			this._processingItemID = itemID;

			this._progressQueue.updateRow(itemID, Zotero.ProgressQueue.ROW_PROCESSING, Zotero.getString('general.processing'));

			try {
				let item = await Zotero.Items.getAsync(itemID);

				if (!item) {
					throw new Error();
				}

				let num = await this._exportItemAnnotations(item, path);
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
	async export(items) {
		let pdfItems = [];

		if (!Array.isArray(items)) {
			items = [items];
		}

		for (let item of items) {
			if (this.hasAnnotations(item)) {
				pdfItems.push(item);
			}
			else if (item.isRegularItem()) {
				let ids = item.getAttachments();
				for (let id of ids) {
					let attachment = Zotero.Items.get(id);
					if (this.hasAnnotations(attachment)) {
						pdfItems.push(attachment);
					}
				}
			}
		}

		for (let item of pdfItems) {
			if (
				this._processingItemID === item.id ||
				this._queue.find(x => x.itemID === item.id)
			) {
				continue;
			}
			this._queue.unshift({ itemID: item.id });
			this._progressQueue.addRow(item);
		}
		await this._processQueue();
	}

	async exportToPath(item, path, isPriority) {
		if (isPriority) {
			this._queue.push({ itemID: item.id, path });
		}
		else {
			this._queue.unshift({ itemID: item.id, path });
		}
		this._progressQueue.addRow(item);
		await this._processQueue();
	}

	async _exportItemAnnotations(item, path) {
		let ids = item.getAnnotations();
		
		let annotations = [];
		for (let id of ids) {
			try {
				annotations.push(Zotero.Annotations.toJSON(Zotero.Items.get(id)));
			} catch (e) {
				Zotero.logError(e);
			}
		}
		
		annotations.id = annotations.key;
		// annotations.image = annotations.imageURL;
		
		for (let annotation of annotations) {
			delete annotation.key;
			for (let key in annotation) {
				annotation[key] = annotation[key] || '';
			}
			
			annotation.authorName = '';
		}
		
		await Zotero.PDFWorker.writeAnnotations(item.id, annotations, path);
		return annotations.length;
	}
}

Zotero.PDFExport = new PDFExport();
