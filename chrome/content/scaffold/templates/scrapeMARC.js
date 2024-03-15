async function scrape(doc, url = doc.location.href) {
	// TODO adjust the selector for the lines here
	let lines = doc.querySelectorAll('table#marcData tr');

	let translator = Zotero.loadTranslator('import');
	translator.setTranslator('a6ee60df-1ddc-4aae-bb25-45e0537be973'); // MARC
	let MARC = await translator.getTranslatorObject();

	let record = new MARC.record();
	let item = new Zotero.Item();
	// ignore the table headings in lines[0]
	record.leader = text(lines[1], 'td', 4);
	let fieldTag;
	for (let line of Array.from(lines).slice(2)) {
		// multiple lines with same fieldTag do not repeat the tag
		// i.e. in these cases we will just take same value as before
		if (text(line, 'td', 0)) {
			fieldTag = text(line, 'td', 0);
		}
		let indicators = text(line, 'td', 1) + text(line, 'td', 2);
		let fieldContent = '';
		if (text(line, 'td', 3)) {
			fieldContent = MARC.subfieldDelimiter + text(line, 'td', 3);
		}
		fieldContent += text(line, 'td', 4);

		record.addField(fieldTag, indicators, fieldContent);
	}

	record.translate(item);

	// possibly clean item further here

	item.complete();
}
