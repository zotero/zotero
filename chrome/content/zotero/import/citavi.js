const parseCitavi5Quads = (quadsRaw) => {
	return quadsRaw.split('|').map((quadRaw) => {
		const [PageIndex, IsContainer, X1, Y1, X2, Y2] = quadRaw.split(';');
		return { PageIndex: parseInt(PageIndex), IsContainer: IsContainer === "True", X1:
			parseFloat(X1), Y1: parseFloat(Y1), X2: parseFloat(X2), Y2: parseFloat(Y2) };
	});
};

const ImportCitaviAnnotatons = async (translation) => {
	const IDMap = translation._itemSaver._IDMap;
	const ZU = translation._sandboxZotero.Utilities;
	
	// stream might be closed by now, re-init to make sure getXML() works
	translation._io.init('xml/dom');
	const doc = translation._sandboxZotero.getXML();
	const isCitavi5 = ZU.xpathText(doc, '//CitaviExchangeData/@Version').startsWith('5');
	var annotationNodes = ZU.xpath(doc, '//Annotations/Annotation');

	const xpathTextOrNull = (...args) => {
		try {
			return ZU.xpathText(...args);
		}
		catch (e) {
			return null;
		}
	};

	const promises = [];

	// no progress report from translator so let's say importing items etc. is 50%
	const baseProgress = 50;
	const stageProgress = 50;
	let progress = baseProgress;
	translation.getProgress = () => progress;

	for (var i = 0, n = annotationNodes.length; i < n; i++) {
		const id = ZU.xpathText(annotationNodes[i], '@id');
		const quadsRaw = ZU.xpathText(annotationNodes[i], './Quads');
		const locationID = ZU.xpathText(annotationNodes[i], './LocationID');

		const location = ZU.xpath(doc, `//Locations/Location[@id='${locationID}']|//Locations/Location[@ID='${locationID}']`)[0];

		if (!location) {
			Zotero.debug(`Missing <Location> entry for annotation ${id}, skipping...`);
			continue;
		}

		const referenceID = ZU.xpathText(location, './ReferenceID');
		const entityLink = ZU.xpath(doc, `//EntityLinks/EntityLink[TargetID='${id}']`)[0];

		if (!entityLink) {
			Zotero.debug(`Missing <EntityLink> entry for annotation ${id}, skipping...`);
			continue;
		}

		const entitySourceID = ZU.xpathText(entityLink, './SourceID');
		const knowledgeItem = ZU.xpath(doc, `//KnowledgeItems/KnowledgeItem[@id='${entitySourceID}']|//KnowledgeItems/KnowledgeItem[@ID='${entitySourceID}']`)[0];
		const keywordsIDsText = ZU.xpathText(doc, `//KnowledgeItemKeywords/OnetoN[starts-with(text(), "${entitySourceID}")]`);
		const keywords = keywordsIDsText
			? keywordsIDsText
				.split(';')
				.map(keywordText => keywordText.split(':')[0])
				.slice(1)
				.map(keywordID => ZU.xpathText(doc, `.//Keyword[@id='${keywordID}']/Name`))
			: [];

		const createdOn = xpathTextOrNull(knowledgeItem, './CreatedOn');
		const modifiedOn = xpathTextOrNull(knowledgeItem, './ModifiedOn');
		const coreStatement = xpathTextOrNull(knowledgeItem, './CoreStatement');
		const quotationType = xpathTextOrNull(knowledgeItem, './QuotationType');
		const text = xpathTextOrNull(knowledgeItem, './Text');
		const itemID = IDMap[referenceID];
		const item = await Zotero.Items.getAsync(itemID);
		const quads = isCitavi5 ? parseCitavi5Quads(quadsRaw) : JSON.parse(quadsRaw);
		
		const itemAttachmentIDs = item.getAttachments();
		
		if (itemAttachmentIDs.length === 0) {
			continue;
		}

		const itemAttachment = await Zotero.Items.getAsync(itemAttachmentIDs[0]);

		const rectsMappedByPage = quads.reduce((acc, quad) => {
			const pageIndex = parseInt(quad.PageIndex) - 1;
			if (Number.isNaN(pageIndex)) {
				return acc;
			}

			const rect = [quad.X1, quad.Y1, quad.X2, quad.Y2];
			acc.set(pageIndex, acc.has(pageIndex) ? [...acc.get(pageIndex), rect] : [rect]);
			return acc;
		}, new Map());

		if (rectsMappedByPage.keys().length === 0) {
			continue;
		}

		let annotations = [];

		Array.from(rectsMappedByPage.keys()).forEach((pageIndex, index) => {
			//for multi-page highlights, we put text & comments on the first highlight
			const isFirstPage = index === 0;
			const pageRects = rectsMappedByPage.get(pageIndex);
			pageRects.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
			const annotation = {
				key: Zotero.DataObjectUtilities.generateKey(),
				type: 'highlight',
				comment: isFirstPage ? coreStatement : '',
				text: isFirstPage ? text : '',
				position: { pageIndex, rects: pageRects },
				dateAdded: createdOn,
				dateModified: modifiedOn,
				tags: keywords.map(keyword => ({ name: keyword }))
			};

			switch (quotationType) {
				default:
				case '1':
					// citavi's "direct quotation"
					annotation.color = '#2ea8e5';
					break;
				case '2':
					// citavi's "indirect quotation"
					annotation.color = '#a6507b';
					// special treatment for indirect quotation
					annotation.text = coreStatement;
					annotation.comment = text;
					break;
				case '3':
					// citavi's "summary"
					annotation.color = '#5fb236';
					break;
				case '4':
					// citavi's "comment"
					annotation.color = '#ff8c19';
					break;
				case '5':
					// citavi's "highlight in yellow"
					annotation.color = '#ffd400';
					delete annotation.comment;
					break;
				case '6':
					// citavi's "highlight in red"
					annotation.color = '#ff6666';
					delete annotation.comment;
					break;
			}

			annotations.push(annotation);
		});


		try {
			// eslint-disable-next-line no-await-in-loop
			annotations = await Zotero.PDFWorker.processCitaviAnnotations(
				itemAttachment.getFilePath(), annotations
			);
			annotations.forEach((annotation) => {
				promises.push(Zotero.Annotations.saveFromJSON(
					itemAttachment, annotation, { skipSelect: true }
				));
			});
		}
		catch (e) {
			Zotero.debug(`Could not process annotations for attachment item ${itemAttachment.key} (file path: ${itemAttachment.getFilePath()})`);
		}

		progress = baseProgress + Math.ceil((i / annotationNodes.length) * stageProgress);
		translation._runHandler('itemDone', []);
	}
	await Promise.all(promises);
};

export { ImportCitaviAnnotatons };
