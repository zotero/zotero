"use strict";

describe("Zotero.AttachmentReadObserver", function () {
	describe("file events", function () {
		beforeEach(function () {
			Zotero.Libraries.userLibrary.lastReadItemInSession = null;
		});

		it("should update an attachment's attachmentLastRead every time it is opened", async function () {
			let attachment = await importPDFAttachment(null);

			// We open the attachment at midnight on January 1
			let stub = sinon.stub(Zotero.AttachmentReadObserver, '_getCurrentDate')
				.callsFake(() => new Date(2023, 1, 1, 0, 0, 0));
			await Zotero.Notifier.trigger('open', 'file', [attachment.id]);
			let initialLastRead = attachment.attachmentLastRead;
			assert.isNumber(initialLastRead);

			// We open it again, only five seconds later
			stub.callsFake(() => new Date(2023, 1, 1, 0, 0, 5));
			await Zotero.Notifier.trigger('open', 'file', [attachment.id]);
			assert.isAbove(attachment.attachmentLastRead, initialLastRead);

			stub.restore();
		});

		it("should update an attachment's attachmentLastRead every five minutes when the page changes", async function () {
			let attachment = await importPDFAttachment(null);

			// We open the attachment at midnight on January 1
			let stub = sinon.stub(Zotero.AttachmentReadObserver, '_getCurrentDate')
				.callsFake(() => new Date(2023, 1, 1, 0, 0, 0));
			await Zotero.Notifier.trigger('open', 'file', [attachment.id]);
			let initialLastRead = attachment.attachmentLastRead;
			assert.isNumber(initialLastRead);

			// We change pages, only five seconds later
			stub.callsFake(() => new Date(2023, 1, 1, 0, 0, 5));
			await Zotero.Notifier.trigger('pageChange', 'file', [attachment.id]);
			assert.equal(attachment.attachmentLastRead, initialLastRead);

			// We change pages again, five minutes later
			stub.callsFake(() => new Date(2023, 1, 1, 0, 5, 5));
			await Zotero.Notifier.trigger('pageChange', 'file', [attachment.id]);
			let updatedLastRead = attachment.attachmentLastRead;
			assert.isAbove(updatedLastRead, initialLastRead);

			// We change pages again, a minute after that
			stub.callsFake(() => new Date(2023, 1, 1, 0, 6, 5));
			await Zotero.Notifier.trigger('pageChange', 'file', [attachment.id]);
			assert.equal(attachment.attachmentLastRead, updatedLastRead);

			stub.restore();
		});
	});

	describe("setting events", function () {
		it("should update a group attachment's attachmentLastRead when the associated synced setting changes", async function () {
			let group = await createGroup();
			let item = await createDataObject('item', { libraryID: group.libraryID });
			let attachment = await importPDFAttachment(item);
			let key = attachment._getLastReadSettingKey();
			
			let firstValue = 1674668000;
			await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, key, firstValue);
			assert.equal(attachment.attachmentLastRead, firstValue);

			let secondValue = 1674668123;
			await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, key, secondValue);
			assert.equal(attachment.attachmentLastRead, secondValue);
		});
	});
});
