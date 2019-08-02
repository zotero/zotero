function scrape(doc, url) {
	// TODO adjust the selector for the lines here
	var lines = doc.querySelectorAll('#cntPlcPortal_grdMrc tr');
	
	// call MARC translator
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	translator.getTranslatorObject(function (marc) {
		var record = new marc.record();
		var newItem = new Zotero.Item();
		// ignore the table headings in lines[0]
		record.leader = text(lines[1], 'td', 4);
		var fieldTag, indicators, fieldContent;
		for (let line of Array.from(lines).slice(2)) {
			// multiple lines with same fieldTag do not repeat the tag
			// i.e. in these cases we will just take same value as before
			if (text(line, 'td', 0).trim().length > 0) {
				fieldTag = text(line, 'td', 0);
			}
			indicators = text(line, 'td', 1) + text(line, 'td', 2);
			fieldContent = '';
			if (text(line, 'td', 3).trim().length > 0) {
				fieldContent = marc.subfieldDelimiter + text(line, 'td', 3);
			}
			fieldContent += text(line, 'td', 4);
			
			record.addField(fieldTag, indicators, fieldContent);
		}
		
		record.translate(newItem);
		
		// possibly clean newItem further here
		
		newItem.complete();
	});
}
