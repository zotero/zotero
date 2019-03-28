
const CMAPS_URL = 'resource://zotero/pdf.js/cmaps/';

class PDFWorker {
	constructor() {
		this.worker = null;
		this.promiseId = 0;
		this.waitingPromises = {};
	}
	
	async query(op, data, transfer) {
		return new Promise((resolve, reject) => {
			this.promiseId++;
			this.waitingPromises[this.promiseId] = {resolve, reject};
			this.worker.postMessage({id: this.promiseId, op, data}, transfer);
		});
	}
	
	init() {
		if (this.worker) return;
		this.worker = new Worker('chrome://zotero/content/xpcom/pdfWorker/worker.js');
		
		this.worker.addEventListener('message', async e => {
			let message = e.data;
			// console.log(e.data)
			if (message.responseId) {
				let { resolve, reject } = this.waitingPromises[message.responseId];
				if (message.data) {
					resolve(message.data);
				}
				else {
					reject(message.error);
				}
				return;
			}
			
			if (message.id) {
				let respData = null;
				
				try {
					if (message.op === 'FetchBuiltInCMap') {
						let response = await Zotero.HTTP.request(
							"GET",
							CMAPS_URL + e.data.data.name + '.bcmap',
							{responseType: 'arraybuffer'}
						);
						respData = {
							compressionType: 1,
							cMapData: new Uint8Array(response.response)
						};
					}
				}
				catch (e) {
					Zotero.debug('Failed to fetch CMap data:');
					Zotero.debug(e);
				}
				this.worker.postMessage({responseId: e.data.id, data: respData});
			}
		});
		
		this.worker.addEventListener('error', e => {
			Zotero.debug('PDF Web Worker error:');
			Zotero.debug(e);
		});
	}
	
	async writeAnnotations(itemID, annotations, path) {
		Zotero.debug("Writing annotations");
		this.init();
		
		
		let password = '';
		
		let item = await Zotero.Items.getAsync(itemID);
		let itemFilePath = await item.getFilePath();
		
		let buf = await OS.File.read(itemFilePath, {});
		buf = new Uint8Array(buf).buffer;
		
		let res = await this.query('write', {buf, annotations, password}, [buf]);
		
		if (!path) {
			path = itemFilePath;
		}
		
		await OS.File.writeAtomic(path, new Uint8Array(res.buf));
	}
	
	async readAnnotations(itemID) {
		this.init();
		
		let password = '';
		
		let item = await Zotero.Items.getAsync(itemID);
		let path = await item.getFilePath();
		
		let buf = await OS.File.read(path, {});
		buf = new Uint8Array(buf).buffer;
		
		let res = await this.query('read', {buf, password}, [buf]);
		
		return res.annotations;
	}
}

Zotero.PDFWorker = new PDFWorker();
