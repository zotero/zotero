Scholar_File_Interface = new function() {
	this.exportFile = exportFile;
	this.importFile = importFile;
	
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
	
	/*
	 * Creates Scholar.Translate instance and shows file picker for file import
	 */
	function importFile() {
		var translation = new Scholar.Translate("import");
		var translators = translation.getTranslators();
		
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		fp.init(window, "Import", nsIFilePicker.modeOpen);
		for(var i in translators) {
			fp.appendFilter(translators[i].label, "*."+translators[i].target);
		}
		
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
			translation.setLocation(fp.file);
			// get translators again, bc now we can check against the file
			translators = translation.getTranslators();
			if(translators.length) {
				// TODO: display a list of available translators
				translation.setTranslator(translators[0]);
				translation.setHandler("itemDone", _importItemDone);
				translation.translate();
			}
		}
	}
	
	/*
	 * Saves items after they've been imported. We could have a nice little
	 * "items imported" indicator, too.
	 */
	function _importItemDone(obj, item) {
		item.save();
	}
}