async function scrape(doc, url = doc.location.href) {
	let DOI = url.match(/\/(10\.[^#?]+)/)[1];
	// TODO adjust the URL here
	let risURL = `http://citation-needed.services.springer.com/v2/references/${DOI}?format=refman&flavour=citation`;
	// Z.debug(risURL)

	// TODO adjust this
	let pdfLink = doc.querySelector('#articlePDF');
	// Z.debug("pdfURL: " + pdfURL);

	let risText = await requestText(risURL);
	let translator = Zotero.loadTranslator('import');
	translator.setTranslator('32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7'); // RIS
	translator.setString(risText);
	translator.setHandler('itemDone', (_obj, item) => {
		// TODO tweak some of the output here
		if (pdfLink) {
			item.attachments.push({
				url: pdfLink.href,
				title: 'Full Text PDF',
				mimeType: 'application/pdf'
			});
		}

		item.attachments.push({
			title: 'Snapshot',
			document: doc
		});

		item.complete();
	});
	await translator.translate();
}
