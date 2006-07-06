Scholar_File_Interface = new function() {
	this.exportFile = exportFile;
	
	/*
	 * Creates Scholar.Translate instance and shows file picker for file export
	 */
	function exportFile() {
		var translation = new Scholar.Translate("export");
		var translators = translation.getTranslators();
		
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		fp.init(window, "Export", nsIFilePicker.modeSave);
		for(var i in translators) {
			fp.appendFilter(translators[i].label, translators[i].target);
		}
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
			translation.setLocation(fp.file);
			translation.setTranslator(translators[fp.filterIndex]);
			//translation.setHandler("done", _exportDone);
			translation.translate();
		}
	}
}