async function scrape(doc, url = doc.location.href) {
	// TODO adjust the url building
	let m = url.match(/FId=([\w\d]+)&/);
	if (m) {
		// e.g. http://www.fachportal-paedagogik.de/fis_bildung/suche/fis_ausg.html?FId=A18196&lart=BibTeX&Speichern=Speichern&senden_an=+E-Mail-Adresse
		let bibUrl = '/fis_bildung/suche/fis_ausg.html?FId=' + m[1] + '&lart=BibTeX';
		let bibText = await requestText(bibUrl);
		let translator = Zotero.loadTranslator("import");
		translator.setTranslator('9cb70025-a888-4a29-a210-93ec52da40d4');
		translator.setString(bibText);
		translator.setHandler('itemDone', (_obj, item) => {
			item.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			item.complete();
		});
		await translator.translate();
	}
}
