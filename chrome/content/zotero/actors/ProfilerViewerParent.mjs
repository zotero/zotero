export class ProfilerViewerParent extends JSWindowActorParent {
	async receiveMessage(message) {
		switch (message.name) {
			case "ProfilerViewer:OpenExternal": {
				// launchWithURI via the protocol handler info skips the
				// prompt that loadURI() triggers
				const uri = Services.io.newURI(message.data.href);
				const handler = Cc[
					"@mozilla.org/uriloader/external-protocol-service;1"
				].getService(Ci.nsIExternalProtocolService).getProtocolHandlerInfo(uri.scheme);
				handler.preferredAction = Ci.nsIHandlerInfo.useSystemDefault;
				handler.launchWithURI(uri, null);
				return;
			}
			case "ProfilerViewer:Download": {
				const browser = this.browsingContext.top.embedderElement;
				const fp = Cc["@mozilla.org/filepicker;1"]
					.createInstance(Ci.nsIFilePicker);
				fp.init(
					browser.browsingContext,
					"Save Profile",
					Ci.nsIFilePicker.modeSave
				);
				fp.defaultString = message.data.filename;
				const rv = await new Promise(resolve => fp.open(resolve));
				if (rv === Ci.nsIFilePicker.returnCancel) return;
				await IOUtils.write(fp.file.path, message.data.bytes);
			}
		}
	}
}
