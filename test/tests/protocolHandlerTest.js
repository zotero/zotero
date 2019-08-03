function runHandler(url) {
	var [_, extension] = url.match(/^zotero:\/\/([a-z]+)\//);
	var handler = Services.io.getProtocolHandler('zotero').wrappedJSObject;
	var uri = Services.io.newURI(url, null, null);
	return handler._extensions['zotero://' + extension].newChannel(uri);
}

describe("Protocol Handler", function () {
	var win;
	var zp;
	
	before(async function () {
		win = await loadZoteroPane();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	describe("zotero://select", function () {
		async function waitForItemSelect(items) {
			if (items instanceof Zotero.Item) {
				items = [items];
			}
			while (true) {
				let selected = zp.getSelectedItems();
				if (selected.every(item => items.includes(item))) {
					return;
				}
				await Zotero.Promise.delay(20);
			}
		}
		
		it("should select an item", async function () {
			var item1 = await createDataObject('item', { title: 'A' });
			var item2 = await createDataObject('item', { title: 'B' });
			runHandler(`zotero://select/library/items/${item1.key}`);
			await waitForItemSelect(item1);
		});
		
		it("should select multiple items", async function () {
			var item1 = await createDataObject('item', { title: 'A' });
			var item2 = await createDataObject('item', { title: 'B' });
			var item3 = await createDataObject('item', { title: 'C' });
			runHandler(`zotero://select/library/items?itemKey=${item1.key},${item2.key}`);
			await waitForItemSelect([item1, item2]);
		});
	});
});