"use strict";

describe.skip("Zotero.CiteprocRs", function () {
	var chicagoNoteStyleID = "http://www.zotero.org/styles/chicago-shortened-notes-bibliography";
	var chicagoAuthorDateStyleID = "http://www.zotero.org/styles/chicago-author-date";
	var style;
	function getCiteprocJSEngine(style) {
		Zotero.Prefs.set('cite.useCiteprocRs', false);
		return style.getCiteProc('en-US', 'text');
	}
	function getCiteprocRSEngine(style) {
		Zotero.Prefs.set('cite.useCiteprocRs', true);
		return style.getCiteProc('en-US', 'text');
	}
	function createCitationItem(item) {
		return {
			id: item.id,
			uris: Zotero.Utilities.randomString(10),
			itemData: Zotero.Cite.System.prototype.retrieveItem(item.id)
		};
	}
	function createACitation(items) {
		if (!Array.isArray(items)) items = [items];
		return {
			citationID: Zotero.Utilities.randomString(10),
			citationItems: items.map(createCitationItem),
			properties: { noteIndex: noteIndex++ }
		};
	}
	function assertProducedCitationsAreEqual(citation) {
		citeprocRS.insertCluster(citation);
		citeprocRS.setClusterOrder([[citation.citationID, citation.properties.noteIndex]]);
		let updateSummary = citeprocRS.getBatchedUpdates();
		let CRSCitation = updateSummary.clusters[0][1];
		let CRSBibl = Zotero.Cite.makeFormattedBibliography(citeprocRS, 'text');
		
		// We need to deepcopy before passing to citeproc-js, because it doesn't respect
		// our objects and just writes stuff all over them.
		let [_, citationInfo] = citeprocJS.processCitationCluster(citation, [], []);
		let CJSCitation = citationInfo[0][1];
		let CJSBibl = Zotero.Cite.makeFormattedBibliography(citeprocJS, 'text');
		
		Zotero.debug(`\nciteproc-js: ${CJSCitation}\nciteproc-rs: ${CRSCitation}`, 2);
		Zotero.debug(`\nciteproc-js: ${CJSBibl}\nciteproc-rs: ${CRSBibl}`, 2);
		
		assert.equal(CJSCitation, CRSCitation, 'citations are equal');
		assert.deepEqual(CJSBibl, CRSBibl, 'bibliographies are equal');
	}
	
	var item1, item2SameLastName, item3;
	var citeprocRS, citeprocJS;
	var noteIndex = 1;
	
	before(async function () {
		await Zotero.CiteprocRs.init();
		await Zotero.Styles.init();
		item1 = createUnsavedDataObject(
			'item',
			{
				itemType: 'book',
				title: 'Test book'
			}
		);
		item1.libraryID = Zotero.Libraries.userLibraryID;
		item1.setField('date', '2021');
		item1.setCreators([
			{
				firstName: "First1",
				lastName: "Last1",
				creatorType: "author"
			}
		]);
		
		item2SameLastName = item1.clone();
		item2SameLastName.setField('title', 'Test book 2');
		item2SameLastName.setCreators([
			{
				firstName: "DifferentFirst2",
				lastName: "Last1",
				creatorType: "author"
			}
		]);
		item3 = item1.clone();
		item3.setCreators([
			{
				firstName: "First3",
				lastName: "Last3",
				creatorType: "author"
			}
		]);
		await Zotero.Promise.all([item1.saveTx(), item2SameLastName.saveTx(), item3.saveTx()]);
	});

	after(function () {
		Zotero.Prefs.set('cite.useCiteprocRs', false);
	});
	
	beforeEach(function () {
		noteIndex = 1;
		citeprocJS = getCiteprocJSEngine(style);
		citeprocRS = getCiteprocRSEngine(style);
	});
	
	afterEach(function () {
		citeprocJS.free();
		citeprocRS.free();
	});
	
	describe('with chicago-shortened-notes-bibliography.csl', function () {
		before(function () {
			style = Zotero.Styles.get(chicagoNoteStyleID);
		});
		
		it("should produce a correct citation", function () {
			assertProducedCitationsAreEqual(createACitation([item1, item3]));
		});

		it("should produce a correct citation with a locator", function () {
			let citation = createACitation(item1);
			Object.assign(citation.citationItems[0], { locator: 1, label: "page" });
			assertProducedCitationsAreEqual(citation);
		});

		it("should produce a correct citation with a prefix", function () {
			let citation = createACitation(item1);
			Object.assign(citation.citationItems[0], { prefix: 'hello' });
			assertProducedCitationsAreEqual(citation);
		});

		it("should produce a correct citation with a suppressed author", function () {
			let citation = createACitation(item1);
			Object.assign(citation.citationItems[0], { 'suppress-author': true });
			assertProducedCitationsAreEqual(citation);
		});

		it("should should produce ibid when appropriate", function () {
			let citation1 = createACitation(item1);
			let citation2 = createACitation(item1);

			citeprocRS.insertCluster(citation1);
			citeprocRS.insertCluster(citation2);
			citeprocRS.setClusterOrder([[citation1.citationID, 1], [citation2.citationID, 2]]);
			let updateSummary = citeprocRS.getBatchedUpdates();

			let [_, citationInfo] = citeprocJS.processCitationCluster(citation1, [], []);
			[_, citationInfo] = citeprocJS.processCitationCluster(citation2, [[citation1.citationID, 1]], []);

			for (let i = 0; i < 2; i++) {
				let CRSCitation = updateSummary.clusters[i][1];
				let CJSCitation = citationInfo[i][1];
				Zotero.debug(`\nciteproc-js: ${CJSCitation}\nciteproc-rs: ${CRSCitation}`, 2);
				assert.equal(CJSCitation, CRSCitation, `citations #${i} are equal`);
			}

			let CRSBibl = Zotero.Cite.makeFormattedBibliography(citeprocRS, 'text');
			let CJSBibl = Zotero.Cite.makeFormattedBibliography(citeprocJS, 'text');
			assert.deepEqual(CJSBibl, CRSBibl, 'bibliographies are equal');
		});
	});

	// Chicago note-bibliography does not perform last name disambiguation
	describe('with chicago-author-date.csl', function () {
		before(function () {
			style = Zotero.Styles.get(chicagoAuthorDateStyleID);
		});
		
		it("should perform last name disambiguation", function () {
			assertProducedCitationsAreEqual(createACitation([item1, item2SameLastName]));
		});
	});
});
