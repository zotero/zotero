Zotero.Sync.Storage.Utilities = {
	getClassForMode: function (mode) {
		switch (mode) {
		case 'zfs':
			return Zotero.Sync.Storage.Mode.ZFS;
		
		case 'webdav':
			return Zotero.Sync.Storage.Mode.WebDAV;
		
		default:
			throw new Error("Invalid storage mode '" + mode + "'");
		}
	},
	
	getItemFromRequest: function (request) {
		var [libraryID, key] = request.name.split('/');
		return Zotero.Items.getByLibraryAndKey(libraryID, key);
	},
	
	
	/**
	 * Create zip file of attachment directory in the temp directory
	 *
	 * @param	{Zotero.Sync.Storage.Request}		request
	 * @return {Promise<Boolean>} - True if the zip file was created, false otherwise
	 */
	createUploadFile: Zotero.Promise.coroutine(function* (request) {
		var item = this.getItemFromRequest(request);
		Zotero.debug("Creating ZIP file for item " + item.libraryKey);
		
		switch (item.attachmentLinkMode) {
			case Zotero.Attachments.LINK_MODE_LINKED_FILE:
			case Zotero.Attachments.LINK_MODE_LINKED_URL:
				throw new Error("Upload file must be an imported snapshot or file");
		}
		
		var zipFile = OS.Path.join(Zotero.getTempDirectory().path, item.key + '.zip');
		
		return Zotero.File.zipDirectory(
			Zotero.Attachments.getStorageDirectory(item).path,
			zipFile,
			{
				onStopRequest: function (req, context, status) {
					var zipFileName = OS.Path.basename(zipFile);
					
					var originalSize = 0;
					for (let entry of context.entries) {
						let zipEntry = context.zipWriter.getEntry(entry.name);
						if (!zipEntry) {
							Zotero.logError("ZIP entry '" + entry.name + "' not found for "
								+ "request '" + request.name + "'")
							continue;
						}
						originalSize += zipEntry.realSize;
					}
					
					Zotero.debug("Zip of " + zipFileName + " finished with status " + status
						+ " (original " + Math.round(originalSize / 1024) + "KB, "
						+ "compressed " + Math.round(context.zipWriter.file.fileSize / 1024) + "KB, "
						+ Math.round(
							((originalSize - context.zipWriter.file.fileSize) / originalSize) * 100
						) + "% reduction)");
				}
			}
		);
	}),
	
	
	/**
	 * Prompt whether to reset unsynced local files in a library
	 *
	 * Keep in sync with Sync.Data.Utilities.showWriteAccessLostPrompt()
	 *
	 * @param {Window|null} win
	 * @param {Zotero.Library} library
	 * @return {Integer} - 0 to reset, 1 to skip
	 */
	showFileWriteAccessLostPrompt: function (win, library) {
		var libraryType = library.libraryType;
		switch (libraryType) {
		case 'group':
			var msg = Zotero.getString('sync.error.groupFileWriteAccessLost',
					[library.name, ZOTERO_CONFIG.DOMAIN_NAME])
				+ "\n\n"
				+ Zotero.getString('sync.error.groupCopyChangedFiles')
			var button1Text = Zotero.getString('sync.resetGroupFilesAndSync');
			var button2Text = Zotero.getString('sync.skipGroup');
			break;
		
		default:
			throw new Error("Unsupported library type " + libraryType);
		}
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
			+ ps.BUTTON_DELAY_ENABLE;
		
		return ps.confirmEx(
			win,
			Zotero.getString('general.permissionDenied'),
			msg,
			buttonFlags,
			button1Text,
			button2Text,
			null,
			null, {}
		);
	}
}
