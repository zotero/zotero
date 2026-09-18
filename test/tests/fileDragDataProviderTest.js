"use strict";

describe("Zotero.TempFileDragDataProvider", function () {
	it("should hand out a copy of the file with the same name and remove its directory once emptied", async function () {
		var attachment = await importFileAttachment('test.pdf');
		var path = attachment.getFilePath();
		var provider = new Zotero.TempFileDragDataProvider(path);
		
		var data = {};
		provider.getFlavorData(null, 'application/x-moz-file', data);
		var file = data.value.QueryInterface(Ci.nsIFile);
		var copyPath = file.path;
		var copyDir = PathUtils.parent(copyPath);
		
		assert.notEqual(copyPath, path);
		assert.equal(file.leafName, PathUtils.filename(path));
		assert.isTrue(copyPath.startsWith(Zotero.getTempDirectory().path));
		assert.equal(
			await Zotero.File.getBinaryContentsAsync(copyPath),
			await Zotero.File.getBinaryContentsAsync(path)
		);
		
		// Repeated requests get the same copy
		var data2 = {};
		provider.getFlavorData(null, 'application/x-moz-file', data2);
		assert.equal(data2.value.QueryInterface(Ci.nsIFile).path, copyPath);
		
		// A copy the target may still be using stays
		await Zotero.TempFileDragDataProvider.removeCopies({ onlyEmpty: true });
		assert.isTrue(await IOUtils.exists(copyPath));
		
		// Once the target has moved the file away, the directory goes
		await IOUtils.remove(copyPath);
		await Zotero.TempFileDragDataProvider.removeCopies({ onlyEmpty: true });
		assert.isFalse(await IOUtils.exists(copyDir));
	});
	
	it("should remove leftover copies from earlier drags", async function () {
		var attachment = await importFileAttachment('test.pdf');
		var provider = new Zotero.TempFileDragDataProvider(attachment.getFilePath());
		var data = {};
		provider.getFlavorData(null, 'application/x-moz-file', data);
		var copyDir = PathUtils.parent(data.value.QueryInterface(Ci.nsIFile).path);
		
		await Zotero.TempFileDragDataProvider.removeCopies();
		assert.isFalse(await IOUtils.exists(copyDir));
	});
});
