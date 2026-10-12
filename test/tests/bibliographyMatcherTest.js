"use strict";

var { BibliographyMatcher } = ChromeUtils.importESModule('chrome://zotero/content/xpcom/bibliographyMatcher.mjs');
var { onlineReferenceLookup } = ChromeUtils.importESModule('chrome://zotero/content/xpcom/readerReferences.mjs');

describe("BibliographyMatcher", function () {
	let items = [];
	let observations;
	beforeEach(function () {
		observations = sinon.createSandbox();
	});
	afterEach(function () {
		observations.restore();
	});
	
	describe('cooperative cancellation', function () {
		it('should reject pre-aborted matching before parsing or querying', async function () {
			let controller = new AbortController();
			controller.abort();
			let prepareReference = observations.spy(BibliographyMatcher, 'prepareReference');
			let error = await getPromiseError(BibliographyMatcher.matchLibrary('Reference', 1, { signal: controller.signal }));
			assert.equal(error?.name, 'AbortError');
			assert.isFalse(prepareReference.called);
		});
		
		it('should stop before the following route after retrieval aborts', async function () {
			let controller = new AbortController();
			observations.stub(BibliographyMatcher, '_searchByIdentifiers').callsFake(async () => {
				controller.abort();
				return { ids: [], incomplete: false };
			});
			let title = observations.spy(BibliographyMatcher, '_searchTitleCandidates');
			let error = await getPromiseError(BibliographyMatcher.matchLibrary('Reference 2020', 1, { signal: controller.signal }));
			assert.equal(error?.name, 'AbortError');
			assert.isFalse(title.called);
		});
		
		it('should reject a cancelled real row stream without returning partial candidates or logging an error', async function () {
			let records = [];
			for (let i = 0; i < 3; i++) records.push(await createItem({ itemType: 'journalArticle', title: `Cancellation fixture ${i}` }));
			let controller = new AbortController();
			let matcher = BibliographyMatcher;
			let original = matcher._prepareField;
			let field = observations.stub(matcher, '_prepareField').callsFake(function (...args) {
				let result = original.apply(this, args);
				controller.abort();
				return result;
			});
			let log = observations.spy(Zotero, 'logError');
			let error = await getPromiseError(matcher._searchTitleCandidates(matcher.prepareReference('Cancellation fixture'),
				records[0].libraryID, { signal: controller.signal }));
			assert.equal(error?.name, 'AbortError');
			assert.isTrue(field.calledOnce);
			assert.isFalse(log.called);
		});
		
		it('should not evaluate candidates when cancellation occurs after loading', async function () {
			let controller = new AbortController();
			let matcher = BibliographyMatcher;
			let item = await createItem({ itemType: 'journalArticle', title: 'Cancellation loaded candidate' });
			observations.stub(matcher, '_searchByIdentifiers').resolves({ ids: [], incomplete: false });
			observations.stub(matcher, '_searchTitleCandidates').resolves({ ids: [item.id], incomplete: false });
			observations.stub(Zotero.Items, 'loadDataTypes').callsFake(async () => controller.abort());
			let evaluate = observations.spy(matcher, '_rankEvaluations');
			let error = await getPromiseError(matcher.matchLibrary('Cancellation loaded candidate', item.libraryID, { signal: controller.signal }));
			assert.equal(error?.name, 'AbortError');
			assert.isFalse(evaluate.called);
		});
		
		it('should stop an ISBN stream and reject its partial matching rows', async function () {
			for (let i = 0; i < 3; i++) await createItem({ itemType: 'book', title: `ISBN cancellation ${i}`, ISBN: '9780306406157' });
			let controller = new AbortController();
			let matcher = BibliographyMatcher;
			let reference = matcher.prepareReference('ISBN 9780306406157');
			let original = matcher.extractItemIdentifiers;
			let extract = observations.stub(matcher, 'extractItemIdentifiers').callsFake(function (...args) {
				let result = original.apply(this, args);
				controller.abort();
				return result;
			});
			let log = observations.spy(Zotero, 'logError');
			let error = await getPromiseError(matcher._searchByIdentifiers(reference.identifiers, Zotero.Libraries.userLibraryID,
				controller.signal));
			assert.equal(error?.name, 'AbortError');
			assert.isTrue(extract.called);
			assert.isFalse(log.called);
		});
		
		it('should stop loading metadata if item retrieval aborts', async function () {
			let controller = new AbortController();
			observations.stub(Zotero.Items, 'getAsync').callsFake(async () => {
				controller.abort();
				return [];
			});
			let load = observations.spy(Zotero.Items, 'loadDataTypes');
			let error = await getPromiseError(BibliographyMatcher._loadLibraryCandidates([], 1, controller.signal));
			assert.equal(error?.name, 'AbortError');
			assert.isFalse(load.called);
		});
		
		it('should preserve uncancelled output with an optional signal', async function () {
			let item = await createItem({ itemType: 'journalArticle', title: 'Cancellation equivalence', DOI: '10.1234/cancel-equivalent' });
			let matcher = BibliographyMatcher;
			let without = await matcher.matchLibrary('doi:10.1234/cancel-equivalent', item.libraryID);
			let withSignal = await matcher.matchLibrary('doi:10.1234/cancel-equivalent', item.libraryID, { signal: new AbortController().signal });
			assert.deepEqual(withSignal, without);
		});
	});
	
	afterEach(async function () {
		for (let item of items.splice(0)) {
			if (item.id && Zotero.Items.exists(item.id)) {
				await item.eraseTx();
			}
		}
	});
	
	async function createItem(data, libraryID = Zotero.Libraries.userLibraryID) {
		let item = new Zotero.Item(data.itemType || 'journalArticle');
		item.libraryID = libraryID;
		item.fromJSON(data);
		await item.saveTx();
		items.push(item);
		return item;
	}
	
	function evaluate(reference, candidates) {
		return BibliographyMatcher.matchCandidates(reference, candidates);
	}
	
	describe('real PDF citations', function () {
		// Source PDFs and licenses are cited alongside the cases below.
		// Candidate metadata comes from the publication records linked below.
		// https://aclanthology.org/L08-1005/
		let bird = {
			itemType: "conferencePaper",
			title: "The ACL Anthology Reference Corpus: A Reference Dataset for Bibliographic Research in Computational Linguistics",
			creators: [
				{ creatorType: "author", firstName: "Steven", lastName: "Bird" },
				{ creatorType: "author", firstName: "Robert", lastName: "Dale" },
				{ creatorType: "author", firstName: "Bonnie J.", lastName: "Dorr" },
				{ creatorType: "author", firstName: "Bryan", lastName: "Gibson" },
				{ creatorType: "author", firstName: "Mark T.", lastName: "Joseph" },
				{ creatorType: "author", firstName: "Min-Yen", lastName: "Kan" },
				{ creatorType: "author", firstName: "Dongwon", lastName: "Lee" },
				{ creatorType: "author", firstName: "Brett", lastName: "Powley" },
				{ creatorType: "author", firstName: "Dragomir R.", lastName: "Radev" },
				{ creatorType: "author", firstName: "Yee Fan", lastName: "Tan" },
			],
			date: "2008",
			proceedingsTitle: "Proceedings of the Sixth International Conference on Language Resources and Evaluation",
			publisher: "European Language Resources Association",
		};
		// https://www.duo.uio.no/handle/10852/8893
		let berg = {
			itemType: "thesis",
			title: "High Precision Text Extraction from PDF Documents",
			creators: [
				{ creatorType: "author", firstName: "Øyvind Raddum", lastName: "Berg" },
			],
			date: "2011",
			university: "University of Oslo",
		};
		// https://aclanthology.org/2020.lrec-1.494/
		let ccnet = {
			itemType: "conferencePaper",
			title: "CCNet: Extracting High Quality Monolingual Datasets from Web Crawl Data",
			creators: [
				{ creatorType: "author", firstName: "Guillaume", lastName: "Wenzek" },
				{ creatorType: "author", firstName: "Marie-Anne", lastName: "Lachaux" },
				{ creatorType: "author", firstName: "Alexis", lastName: "Conneau" },
				{ creatorType: "author", firstName: "Vishrav", lastName: "Chaudhary" },
				{ creatorType: "author", firstName: "Francisco", lastName: "Guzmán" },
				{ creatorType: "author", firstName: "Armand", lastName: "Joulin" },
				{ creatorType: "author", firstName: "Edouard", lastName: "Grave" },
			],
			date: "2020",
			proceedingsTitle: "Proceedings of the Twelfth Language Resources and Evaluation Conference",
			pages: "4003-4012",
		};
		// https://proceedings.neurips.cc/paper/2020/hash/1457c0d6bfcb4967418bfb8ac142f64a-Abstract.html
		let brown = {
			itemType: "conferencePaper",
			title: "Language Models are Few-Shot Learners",
			creators: [
				{ creatorType: "author", firstName: "Tom B.", lastName: "Brown" },
				{ creatorType: "author", firstName: "Benjamin", lastName: "Mann" },
				{ creatorType: "author", firstName: "Nick", lastName: "Ryder" },
			],
			date: "2020",
			proceedingsTitle: "Advances in Neural Information Processing Systems",
			volume: "33",
			pages: "1877-1901",
		};
		// https://proceedings.neurips.cc/paper/1994/hash/3cef96dcc9b8035d23f69e30bb19218a-Abstract.html
		let smyth = {
			itemType: "conferencePaper",
			title: "Inferring Ground Truth from Subjective Labelling of Venus Images",
			creators: [
				{ creatorType: "author", firstName: "Padhraic", lastName: "Smyth" },
				{ creatorType: "author", firstName: "Usama M.", lastName: "Fayyad" },
				{ creatorType: "author", firstName: "Michael C.", lastName: "Burl" },
				{ creatorType: "author", firstName: "Pietro", lastName: "Perona" },
				{ creatorType: "author", firstName: "Pierre", lastName: "Baldi" },
			],
			date: "1994",
			proceedingsTitle: "Advances in Neural Information Processing Systems",
			volume: "7",
			pages: "1085-1092",
			DOI: "10.5555/2998687.2998822",
		};
		// https://rss.onlinelibrary.wiley.com/doi/10.2307/2346806
		let dawid = {
			itemType: "journalArticle",
			title: "Maximum Likelihood Estimation of Observer Error-Rates Using the EM Algorithm",
			creators: [
				{ creatorType: "author", firstName: "A. Philip", lastName: "Dawid" },
				{ creatorType: "author", firstName: "Allan M.", lastName: "Skene" },
			],
			date: "1979",
			publicationTitle: "Journal of the Royal Statistical Society. Series C (Applied Statistics)",
			volume: "28",
			issue: "1",
			pages: "20-28",
			DOI: "10.2307/2346806",
		};
		// https://www.nature.com/articles/nature11148
		let cardinale = {
			itemType: "journalArticle",
			title: "Biodiversity Loss and Its Impact on Humanity",
			creators: [
				{ creatorType: "author", firstName: "Bradley J.", lastName: "Cardinale" },
				{ creatorType: "author", firstName: "J. Emmett", lastName: "Duffy" },
				{ creatorType: "author", firstName: "Andrew", lastName: "Gonzalez" },
				{ creatorType: "author", firstName: "David U.", lastName: "Hooper" },
				{ creatorType: "author", firstName: "Charles", lastName: "Perrings" },
				{ creatorType: "author", firstName: "Patrick", lastName: "Venail" },
			],
			date: "2012",
			publicationTitle: "Nature",
			volume: "486",
			pages: "59-67",
			DOI: "10.1038/nature11148",
			extra: "PMID: 22678280",
		};
		// https://www.nature.com/articles/nature05202
		let trophic = {
			itemType: "journalArticle",
			title: "Effects of Biodiversity on the Functioning of Trophic Groups and Ecosystems",
			creators: [
				{ creatorType: "author", firstName: "Bradley J.", lastName: "Cardinale" },
				{ creatorType: "author", firstName: "Diane S.", lastName: "Srivastava" },
				{ creatorType: "author", firstName: "J. Emmett", lastName: "Duffy" },
			],
			date: "2006",
			publicationTitle: "Nature",
			volume: "443",
			pages: "989-992",
			DOI: "10.1038/nature05202",
			extra: "PMID: 17066035",
		};
		// https://pmc.ncbi.nlm.nih.gov/articles/PMC10749071/
		let webpage = {
			itemType: "webpage",
			title: "What is decentralisation?",
			websiteTitle: "Center for International Earth Science Information Network",
		};
		// https://revistas.usp.br/revusp/article/view/13868
		let packer = {
			itemType: "journalArticle",
			title: "Os periódicos brasileiros e a comunicação da pesquisa nacional",
			creators: [
				{ creatorType: "author", firstName: "Abel L.", lastName: "Packer" },
			],
			date: "2011",
			publicationTitle: "Revista USP",
			issue: "89",
			pages: "26-61",
			DOI: "10.11606/issn.2316-9036.v0i89p26-61",
		};
		// https://www.repository.cam.ac.uk/items/dc4c1be0-9eab-474d-bc7c-0b9f4df615ca
		let bordg = {
			itemType: "journalArticle",
			title: "Simple Type Theory is Not Too Simple: Grothendieck’s Schemes Without Dependent Types",
			creators: [
				{ creatorType: "author", firstName: "Anthony", lastName: "Bordg" },
				{ creatorType: "author", firstName: "Lawrence", lastName: "Paulson" },
				{ creatorType: "author", firstName: "Wenda", lastName: "Li" },
			],
			date: "2022",
			publicationTitle: "Experimental Mathematics",
			volume: "31",
			issue: "2",
			pages: "364-382",
			DOI: "10.1080/10586458.2022.2062073",
		};
		// https://academic.oup.com/mnras/article/482/4/4570/5162857
		let dr2 = {
			itemType: "journalArticle",
			title: "A Gaia Data Release 2 Catalogue of White Dwarfs and a Comparison with SDSS",
			creators: [
				{ creatorType: "author", firstName: "Nicola Pietro", lastName: "Gentile Fusillo" },
				{ creatorType: "author", firstName: "Pier-Emmanuel", lastName: "Tremblay" },
				{ creatorType: "author", firstName: "Boris T.", lastName: "Gänsicke" },
			],
			date: "2019",
			publicationTitle: "Monthly Notices of the Royal Astronomical Society",
			volume: "482",
			issue: "4",
			pages: "4570-4591",
			DOI: "10.1093/mnras/sty3016",
		};
		// https://academic.oup.com/mnras/article/508/3/3877/6373953
		let edr3 = {
			itemType: "journalArticle",
			title: "A Catalogue of White Dwarfs in Gaia EDR3",
			creators: [
				{ creatorType: "author", firstName: "Nicola Pietro", lastName: "Gentile Fusillo" },
				{ creatorType: "author", firstName: "Pier-Emmanuel", lastName: "Tremblay" },
				{ creatorType: "author", firstName: "Boris T.", lastName: "Gänsicke" },
			],
			date: "2021",
			publicationTitle: "Monthly Notices of the Royal Astronomical Society",
			volume: "508",
			issue: "3",
			pages: "3877-3896",
			DOI: "10.1093/mnras/stab2672",
		};
		// https://www.aanda.org/articles/aa/abs/2023/06/aa43709-22/aa43709-22.html
		let gaia = {
			itemType: "journalArticle",
			title: "Gaia Data Release 3: The Galaxy in Your Preferred Colours: Synthetic Photometry from Gaia Low-Resolution Spectra",
			creators: [
				{ creatorType: "author", name: "Gaia Collaboration" },
				{ creatorType: "author", firstName: "C.", lastName: "Jordi" },
				{ creatorType: "author", firstName: "P.", lastName: "Montegriffo" },
			],
			date: "2023",
			publicationTitle: "Astronomy & Astrophysics",
			volume: "674",
			pages: "A33",
			DOI: "10.1051/0004-6361/202243709",
		};
		
		let cases = [
			// https://aclanthology.org/W12-3213/ (CC BY-NC-SA 3.0).
			{
				name: "acl-bird-long-authors-library",
				parts: [
					{ text: "Steven Bird, Robert Dale, Bonnie J. Dorr, Bryan Gibson, Mark T. Joseph, Min yen Kan, Dongwon Lee, Brett Powley, Dragomir R. Radev, and Yee Fan Tan. 2008. The acl anthology reference corpus: A reference dataset for bibliographic research in computational linguistics." },
				],
				items: [bird, berg, ccnet],
				library: true,
				match: bird,
			},
			{
				// Berg is the intended work; the damaged given name currently prevents a safe match.
				name: "acl-berg-damaged-initial",
				parts: [
					{ text: "φyvind Raddum Berg. 2011. High precision text extraction from PDF documents." },
				],
				items: [berg, bird],
				reason: "insufficient-evidence",
			},
			// https://aclanthology.org/2024.acl-long.192/ (CC BY 4.0).
			{
				// CCNet is the intended work; its extracted title is too short to verify.
				name: "acl-ccnet-truncated-title-library",
				parts: [
					{ text: "Guillaume Wenzek, Marie-Anne Lachaux, Alexis Conneau, Vishrav Chaudhary, Francisco Guzmán, Armand Joulin, and Edouard Grave. 2020.C" },
					{ text: "CNet:", attributes: { url: "https://www.aclweb.org/anthology/2020.lrec-1.494" } },
				],
				items: [ccnet, brown, bird],
				library: true,
			},
			{
				name: "acl-body-node-not-reference",
				parts: [
					{ text: "ing and generation (Brown et al.,2020;Wei et al., 2022;Shi et al.,2022). Much research has been conducted to understand in-context learning. Some suggest that the models secretly perform gradient descent on the exemplars (Dai et al.,2022), while others demonstrate that most of the knowledge is learned during pre-training, and the exemplars are only to provide evidence for the model to locate the intended task via a Bayesian inference process (Xie et al.,2021;Min et al.,2022;Zhou et al.,2023)." },
				],
				items: [brown, ccnet],
				reason: "insufficient-evidence",
			},
			// https://jmlr.org/papers/v25/19-301.html (CC BY 4.0).
			{
				name: "jmlr-smyth-provider-replay",
				parts: [
					{ text: "Padhraic Smyth, Usama Fayyad, Michael Burl, Pietro Perona, and Pierre Baldi. Inferring ground truth from subjective labelling of Venus images. In Neural Information Processing Systems (NeurIPS), pages 1085–1092. MIT Press, January 1994. URL https://dl.acm. " },
					{ text: "org/doi/10.5555/2998687.2998822", attributes: { url: "https://dl.acm.org/doi/10.5555/2998687.2998822" } },
					{ text: "." },
				],
				items: [dawid, smyth, bird],
				match: smyth,
			},
			{
				name: "jmlr-dawid-malformed-canonical-links",
				parts: [
					{ text: "A", attributes: { url: "https://doi.org/10.1002%2F047174882X.A" } },
					{ text: ". Philip Dawid and Allan M. Skene. Maximum likelihood estimation of observer errorrates using the EM algorithm. Journal of the Royal Statistical Society. Series C (Applied Statistics), 28(1):20–28, 1979. doi: " },
					{ text: "10.2307/2346806.", attributes: { url: "https://doi.org/10.2307%2F2346806.Arthur" } },
				],
				items: [dawid, smyth],
				library: true,
				match: dawid,
			},
			// https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0236550 (CC BY 4.0).
			{
				name: "plos-cardinale-trophic-library",
				parts: [
					{ text: "5. Cardinale BJ, Srivastava DS, Duffy JE, Wright JP, Downing AL, Sankaran M, et al. Effects of biodiversity on the functioning of trophic groups and ecosystems. Nature. 2006; 443: 989–992. " },
					{ text: "https://doi.org/", attributes: { url: "https://doi.org/" } },
					{ text: " " },
					{ text: "10.1038/nature05202", attributes: { url: "https://doi.org/10.1038%2Fnature05202" } },
					{ text: " PMID: " },
					{ text: "17066035", attributes: { url: "http://www.ncbi.nlm.nih.gov/pubmed/17066035" } },
				],
				items: [trophic, cardinale],
				library: true,
				match: trophic,
			},
			{
				name: "plos-cardinale-doi-pmid-library",
				parts: [
					{ text: "7. Cardinale BJ, Duffy JE, Gonzalez A, Hooper DU, Perrings C, Venail P, et al. Biodiversity loss and its impact on humanity. Nature. 2012; 486: 59–67. " },
					{ text: "https://doi.org/10.1038/nature11148", attributes: { url: "https://doi.org/10.1038/nature11148" } },
					{ text: " PMID: " },
					{ text: "22678280", attributes: { url: "http://www.ncbi.nlm.nih.gov/pubmed/22678280" } },
				],
				items: [cardinale, trophic],
				library: true,
				match: cardinale,
			},
			// https://europepmc.org/articles/PMC10749071 (CC BY 4.0).
			{
				// The decentralisation webpage is the intended work, but has insufficient metadata.
				name: "pmc-webpage-omitted-fields-library",
				parts: [
					{ text: "3 What is decentralisation?, Available: " },
					{ text: "http://www.ciesin.org/", attributes: { url: "http://www.ciesin.org/" } },
					{ text: " decentralization/English/General/Different_forms.html [Accessed 20 Jun 2023]." },
				],
				items: [webpage, brown],
				library: true,
			},
			// https://www.scielo.br/j/tinf/a/ytxYxh6Mbb4qq76FGJVsDbs/?lang=pt (CC BY 4.0).
			{
				name: "scielo-packer-diacritics-library",
				parts: [
					{ text: "PACKER, A. L. Os periódicos brasileiros e a comunicação da pesquisa nacional. Revista USP, n. 89, p. 26-61, 2011. Disponível em: <" },
					{ text: "http://rusp.scielo.br/scielo.php?script=sci_arttext&", attributes: { url: "http://rusp.scielo.br/scielo.php?script=sci_arttext&" } },
					{ text: " pid=S0103-99892011000200004&lng=pt&nrm=iso>. Acesso em: 25 abr. 2016." },
				],
				items: [packer, bird],
				library: true,
				match: packer,
			},
			// https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ITP.2023.35 (CC BY 4.0).
			{
				name: "lipics-bordg-doi-library",
				parts: [
					{ text: "1 Anthony Bordg, Lawrence Paulson, and Wenda Li. Simple type theory is not too simple: Grothendieck’s schemes without dependent types. Experimental Mathematics, 31(2):364–382, 2022. " },
					{ text: "doi:10.1080/10586458.2022.2062073", attributes: { url: "https://doi.org/10.1080/10586458.2022.2062073" } },
					{ text: "." },
				],
				items: [bordg, dawid],
				library: true,
				match: bordg,
			},
			// https://discovery.ucl.ac.uk/id/eprint/10173976/ (CC BY 4.0).
			{
				// DR2 is the intended work, not EDR3 or the linked Gaia paper; its visible title is missing.
				name: "aanda-gentile-publisher-link-library",
				parts: [
					{ text: "Gentile Fusillo, N. P., Tremblay, P.-E., Gänsicke, B. T., et al. 2019,MNRAS, 482, " },
					{ text: "4570", attributes: { url: "http://linker.aanda.org/10.1051/0004-6361/202243709/74" } },
				],
				items: [dr2, edr3, gaia],
				library: true,
			},
		];
		let network;
		
		beforeEach(function () {
			network = [
				...['request', 'doGet', 'doPost'].map(method => observations.stub(Zotero.HTTP, method)),
				observations.stub(Zotero.Translate.Search.prototype, 'translate'),
				observations.stub(onlineReferenceLookup, 'findOnline'),
			];
			for (let call of network) call.throws(new Error('Local matching must not use the network'));
		});
		
		for (let testCase of cases) {
			it(testCase.name, async function () {
				let group;
				try {
					if (testCase.library) group = await createGroup();
					let candidates = [], expected;
					for (let data of testCase.items) {
						let item = new Zotero.Item(data.itemType);
						if (group) item.libraryID = group.libraryID;
						item.fromJSON(JSON.parse(JSON.stringify(data)));
						if (group) await item.saveTx();
						candidates.push(item);
						if (data === testCase.match) expected = item;
					}
					let result = group
						? await BibliographyMatcher.matchLibrary(testCase.parts, group.libraryID)
						: BibliographyMatcher.matchCandidates(testCase.parts, candidates);
					assert.equal(result.status, testCase.match ? 'matched' : 'unmatched');
					if (testCase.match) assert.strictEqual(result.item, expected);
					else {
						assert.notProperty(result, 'item');
						if (testCase.reason) assert.equal(result.reason, testCase.reason);
					}
					assert.isTrue(network.every(call => !call.called));
				}
				finally {
					if (group) await group.eraseTx();
				}
			});
		}
	});
	
	async function retrieveISBN(reference, libraryID = Zotero.Libraries.userLibraryID) {
		return BibliographyMatcher._searchByIdentifiers(
			BibliographyMatcher.prepareReference(reference).identifiers, libraryID);
	}
	
	function article(overrides = {}) {
		return {
			itemType: 'journalArticle',
			title: 'Reliable matching across diverse bibliographies',
			creators: [
				{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
			],
			date: '2021',
			publicationTitle: 'Journal of Bibliographic Systems',
			volume: '12',
			issue: '3',
			pages: '120-139',
			...overrides,
		};
	}
	
	// References 11 and 19 in https://doi.org/10.1145/1542476.1542528.
	// Crossref returns each paper alongside a creator-less proceedings record.
	for (let { title, creators, date, pages, ordinal, DOI, volumeDOI, reference } of [
		{
			title: 'HotpathVM: an effective JIT compiler for resource-constrained devices',
			creators: [['Andreas', 'Gal'], ['Christian W.', 'Probst'], ['Michael', 'Franz']],
			date: '2006-06-14',
			pages: '144-153',
			ordinal: '2nd',
			DOI: '10.1145/1134760.1134780',
			volumeDOI: '10.1145/1134760',
			reference: '[11] A. Gal, C. W. Probst, and M. Franz. HotpathVM: An effective JIT compiler for resource-constrained devices. '
				+ 'In Proceedings of the International Conference on Virtual Execution Environments, pages 144–153. ACM Press, 2006.',
		},
		{
			title: 'YETI: a graduallY extensible trace interpreter',
			creators: [['Mathew', 'Zaleski'], ['Angela Demke', 'Brown'], ['Kevin', 'Stoodley']],
			date: '2007-06-13',
			pages: '83-93',
			ordinal: '3rd',
			DOI: '10.1145/1254810.1254823',
			volumeDOI: '10.1145/1254810',
			reference: '[19] M. Zaleski, A. D. Brown, and K. Stoodley. YETI: A graduallY Extensible Trace Interpreter. '
				+ 'In Proceedings of the International Conference on Virtual Execution Environments, pages 83–93. ACM Press, 2007.',
		},
	]) {
		it(`should match ${title} rather than its weak proceedings record`, async function () {
			let proceedingsTitle = `Proceedings of the ${ordinal} international conference on Virtual execution environments`;
			let paper = await createItem({ itemType: 'conferencePaper', title, proceedingsTitle, date, pages, DOI,
				creators: creators.map(([firstName, lastName]) => ({ creatorType: 'author', firstName, lastName })) });
			let volume = await createItem({ itemType: 'conferencePaper', title: proceedingsTitle, date, DOI: volumeDOI });
			for (let candidates of [[paper, volume], [volume, paper]]) {
				assert.strictEqual(evaluate(reference, candidates).item, paper);
				assert.equal(evaluate(reference, candidates.map(item => item.toJSON())).item.getField('DOI'), DOI);
			}
			assert.strictEqual((await BibliographyMatcher.matchLibrary(reference, paper.libraryID)).item, paper);
		});
	}
	
	it("should preserve strict rivals, identifier authority and conflicts beside a weak container", async function () {
		let paper = await createItem(article({ DOI: '10.1234/paper' }));
		let volume = await createItem({ itemType: 'book', title: paper.getField('publicationTitle'), date: '2021', DOI: '10.1234/volume' });
		let reference = `Lovelace, Ada. 2021. ${paper.getField('title')}. ${volume.getField('title')}. pp. 120-139.`;
		assert.strictEqual(evaluate(reference, [volume, paper]).item, paper);
		assert.strictEqual((await BibliographyMatcher.matchLibrary(reference, paper.libraryID)).item, paper);
		let rival = await createItem(article({ publicationTitle: 'Collected Research on Bibliographic Methods', DOI: '10.1234/rival',
			creators: [{ creatorType: 'author', firstName: 'Ada Augusta', lastName: 'Lovelace' }] }));
		assert.equal(evaluate(reference, [volume, paper, rival]).reason, 'ambiguous');
		assert.equal((await BibliographyMatcher.matchLibrary(reference, paper.libraryID)).reason, 'ambiguous');
		await rival.eraseTx();
		for (let text of [reference.replace('2021', '2020'), reference.replace('120-139', '200-219')]) {
			assert.equal(evaluate(text, [paper, volume]).status, 'unmatched');
			assert.equal((await BibliographyMatcher.matchLibrary(text, paper.libraryID)).status, 'unmatched');
		}
		let identified = reference + ' doi:10.1234/volume';
		assert.strictEqual(evaluate(identified, [paper, volume]).item, volume);
		assert.strictEqual((await BibliographyMatcher.matchLibrary(identified, paper.libraryID)).item, volume);
		volume.setCreators(paper.getCreators());
		await volume.saveTx();
		assert.equal(evaluate(reference, [paper, volume]).reason, 'ambiguous');
		assert.equal((await BibliographyMatcher.matchLibrary(reference, paper.libraryID)).reason, 'ambiguous');
	});
	
	// Alternate conference/journal records returned for references 7, 9 and 15
	// in https://doi.org/10.1145/1542476.1542528.
	for (let { title, creators, year, dates, pages, conferenceDOI, journalDOI, reference } of [
		{
			title: 'Dynamo: a transparent dynamic optimization system',
			creators: [['Vasanth', 'Bala'], ['Evelyn', 'Duesterwald'], ['Sanjeev', 'Banerjia']],
			year: '2000',
			dates: ['05/2000', '05/2000'],
			pages: '1-12',
			conferenceDOI: '10.1145/349299.349303',
			journalDOI: '10.1145/358438.349303',
			reference: '[7] V. Bala, E. Duesterwald, and S. Banerjia. Dynamo: A transparent dynamic optimization system. '
				+ 'In Proceedings of the ACM SIGPLAN Conference on Programming Language Design and Implementation, pages 1–12. ACM Press, 2000.',
		},
		{
			title: 'Customization: optimizing compiler technology for SELF, a dynamically-typed object-oriented programming language',
			creators: [['C.', 'Chambers'], ['D.', 'Ungar']],
			year: '1989',
			dates: ['1989-06-21', '07/1989'],
			pages: '146-160',
			conferenceDOI: '10.1145/73141.74831',
			journalDOI: '10.1145/74818.74831',
			reference: '[9] C. Chambers and D. Ungar. Customization: Optimizing Compiler Technology for SELF, a Dynamically-Typed O bject-Oriented Programming Language. '
				+ 'In Proceedings of the ACM SIGPLAN 1989 Conference on Programming Language Design and Implementation, pages 146–160. ACM New York, NY, USA, 1989.',
		},
		{
			title: 'Optimizing direct threaded code by selective inlining',
			creators: [['Ian', 'Piumarta'], ['Fabio', 'Riccardi']],
			year: '1998',
			dates: ['05/1998', '05/1998'],
			pages: '291-300',
			conferenceDOI: '10.1145/277650.277743',
			journalDOI: '10.1145/277652.277743',
			reference: '[15] I. Piumarta and F. Riccardi. Optimizing direct threaded code by selective inlining. '
				+ 'In Proceedings of the ACM SIGPLAN 1998 conference on Programming language design and implementation, pages 291300. ACM New York, NY, USA, 1998.',
		},
	]) {
		it(`should use the first equivalent online publication record for ${title}`, async function () {
			let data = { title, pages,
				creators: creators.map(([firstName, lastName]) => ({ creatorType: 'author', firstName, lastName })) };
			let conference = await createItem({ ...data, itemType: 'conferencePaper', date: dates[0], DOI: conferenceDOI,
				proceedingsTitle: `Proceedings of the ACM SIGPLAN ${year} conference on Programming language design and implementation` });
			let journal = await createItem({ ...data, itemType: 'journalArticle', date: dates[1], DOI: journalDOI, publicationTitle: 'ACM SIGPLAN Notices' });
			for (let candidates of [[conference, journal], [journal, conference]]) {
				assert.strictEqual(evaluate(reference, candidates).item, candidates[0]);
				assert.equal(evaluate(reference, candidates.map(item => item.toJSON())).item.getField('DOI'), candidates[0].getField('DOI'));
			}
			assert.equal((await BibliographyMatcher.matchLibrary(reference, conference.libraryID)).reason, 'ambiguous');
			let identified = reference + ' doi:' + journalDOI;
			assert.strictEqual(evaluate(identified, [conference, journal]).item, journal);
		});
	}
	
	it("should not use provider order to resolve different or insufficiently described works", function () {
		let reference = `Lovelace, A. 2020/2021. ${article().title}.`;
		for (let change of [
			{ creators: [{ creatorType: 'author', firstName: 'Augusta', lastName: 'Lovelace' }] },
			{ date: '2020' },
			{ date: '2020/2021' },
			{ pages: '120-140' },
			{ pages: '' },
		]) {
			let candidates = [article(), article({ publicationTitle: 'Another publication', ...change })];
			for (let order of [candidates, [...candidates].reverse()]) {
				assert.equal(evaluate(reference, order).reason, 'ambiguous', JSON.stringify(change));
			}
		}
		let candidates = [article(), article({ extra: 'x'.repeat(BibliographyMatcher.MAX_MATCH_TEXT_LENGTH + 1) })];
		assert.equal(evaluate(reference, candidates).status, 'incomplete');
	});
	
	it("should require the whole container title at the same span after the cited work", async function () {
		let container = 'Proceedings of the international symposium on reliable computational methods for scientific bibliographic matching and reproducible evidence evaluation';
		let paper = await createItem(article({ publicationTitle: container }));
		let volume = await createItem({ itemType: 'book', title: container, date: '2021' });
		let title = paper.getField('title');
		for (let reference of [
			`${container}. Lovelace, Ada. 2021. ${title}. pp. 120-139.`,
			`Lovelace, Ada. 2021. ${container}. Includes: Lovelace, Ada. ${title}.`,
		]) {
			assert.equal(evaluate(reference, [paper, volume]).status, 'unmatched');
			assert.equal((await BibliographyMatcher.matchLibrary(reference, paper.libraryID)).status, 'unmatched');
		}
		assert.strictEqual(evaluate(`${container}. Lovelace, Ada. 2021. ${title}.`, [paper]).item, paper);
		volume.setField('title', container + ' archives');
		await volume.saveTx();
		let reference = `Lovelace, Ada. 2021. ${title}. ${container}.`;
		assert.equal(evaluate(reference, [paper, volume]).reason, 'ambiguous');
		assert.equal((await BibliographyMatcher.matchLibrary(reference, paper.libraryID)).reason, 'ambiguous');
		paper.setField('title', 'Methods for robust approaches to bibliographic matching');
		paper.setField('publicationTitle', 'Robust approaches to bibliographic matching');
		volume.setField('title', paper.getField('publicationTitle'));
		await paper.saveTx();
		await volume.saveTx();
		reference = `Lovelace, Ada. 2021. ${paper.getField('title')}.`;
		assert.equal(evaluate(reference, [paper, volume]).reason, 'ambiguous');
		assert.equal((await BibliographyMatcher.matchLibrary(reference, paper.libraryID)).reason, 'ambiguous');
	});
	
	it("should retain the completeness veto for an excluded containing record", async function () {
		let paper = await createItem(article());
		let volume = await createItem({ itemType: 'book', title: paper.getField('publicationTitle'), date: '2021',
			extra: 'x'.repeat(BibliographyMatcher.MAX_MATCH_TEXT_LENGTH + 1) });
		let reference = `Lovelace, Ada. 2021. ${paper.getField('title')}. ${volume.getField('title')}.`;
		assert.equal(evaluate(reference, [paper, volume]).status, 'incomplete');
		assert.equal((await BibliographyMatcher.matchLibrary(reference, paper.libraryID)).status, 'incomplete');
	});
	
	it("should validate visible text without doing citation analysis", function () {
		let matcher = BibliographyMatcher;
		let text = 'Visible reference. DOI: 10.1234/example';
		let parts = [{ text: 'Visible reference. ' }, { text: 'DOI: 10.1234/example',
			attributes: { url: 'https://doi.org/10.1234/unrelated' } }];
		let identifiers = observations.spy(matcher, 'extractIdentifiers');
		for (let input of [text, parts, { referenceParts: parts }, { textParts: parts }]) {
			assert.strictEqual(matcher.getReferenceText(input), text);
		}
		assert.isFalse(identifiers.called);
		for (let input of ['',
			' \n ',
			null,
			[],
			[{ text: 42 }],
			'x'.repeat(matcher.MAX_MATCH_TEXT_LENGTH + 1),
			Array(matcher.MAX_REFERENCE_PARTS + 1).fill({ text: 'x' })]) {
			assert.isNull(matcher.getReferenceText(input));
			assert.isNull(matcher.prepareReference(input));
		}
		let parsed = matcher.prepareReference(parts);
		assert.equal(parsed.text, text);
		assert.deepEqual([...parsed.identifiers.DOI], ['10.1234/example']);
	});
	
	it("should match an exact visible identifier without requiring stored metadata fields", function () {
		let result = evaluate('doi: 10.1234/General.42', [article({
			title: '',
			creators: [],
			date: '',
			DOI: '10.1234/general.42',
		})]);
		
		assert.equal(result.status, 'matched');
	});
	
	it("should extract both DOI and explicitly labelled PMID from the real PLOS reference", function () {
		let parsed = BibliographyMatcher.prepareReference({
			referenceParts: [
				{
					text: '7. Cardinale BJ, Duffy JE, Gonzalez A, Hooper DU, Perrings C, '
						+ 'Venail P, et al. Biodiversity loss and its impact on humanity. '
						+ 'Nature. 2012; 486: 59–67. ',
				},
				{
					text: 'https://doi.org/10.1038/nature11148',
					attributes: { url: 'https://doi.org/10.1038/nature11148' },
				},
				{ text: ' PMID: ' },
				{
					text: '22678280',
					attributes: { url: 'http://www.ncbi.nlm.nih.gov/pubmed/22678280' },
				},
			],
		});
		
		assert.deepEqual([...parsed.identifiers.DOI], ['10.1038/nature11148']);
		assert.deepEqual([...parsed.identifiers.PMID], ['22678280']);
	});
	
	it("should extract only explicitly labelled PMID values", function () {
		let identifiers = BibliographyMatcher.extractIdentifiers(
			'7 Cardinale et al. 2012, volume 486, pages 59, 67, PMID: 22678280'
		);
		
		assert.deepEqual([...identifiers.PMID], ['22678280']);
	});
	
	it("should normalize repeated explicitly labelled PMIDs", function () {
		let identifiers = BibliographyMatcher.extractIdentifiers(
			'PMID: 22678280, PMID 22678280; pmid:22678280; PMID22678280'
		);
		
		assert.deepEqual([...identifiers.PMID], ['22678280']);
	});
	
	it("should not extract unlabeled, PMCID, or PubMed URL numbers as PMID", function () {
		for (let text of [
			'7 2012, volume 486, pages 59, 67, 22678280',
			'PMCID: PMC1234567; https://pubmed.ncbi.nlm.nih.gov/22678280/',
		]) {
			let identifiers = BibliographyMatcher.extractIdentifiers(text);
			assert.deepEqual([...identifiers.PMID], [], text);
		}
	});
	
	it("should preserve utility extraction for non-PMID identifier types", function () {
		let cases = [
			['DOI: 10.1234/General.42', 'DOI', '10.1234/general.42'],
			['ISBN 978-0-306-40615-7', 'ISBN', '9780306406157'],
			['arXiv:0706.0044v1', 'arXiv', '0706.0044'],
			['2021wfc..rept....8D', 'adsBibcode', '2021wfc..rept....8D'],
		];
		for (let [text, type, expected] of cases) {
			let identifiers = BibliographyMatcher.extractIdentifiers(text);
			assert.include([...identifiers[type]], expected, type);
			assert.deepEqual([...identifiers.PMID], [], type);
		}
	});
	
	it("should parse only populated item identifier fields", function () {
		let extract = observations.spy(BibliographyMatcher, 'extractIdentifiers');
		let identifiers = BibliographyMatcher.extractItemIdentifiers({ ISBN: '0-306-40615-2' });
		assert.isTrue(extract.calledOnceWithExactly('ISBN: 0-306-40615-2'));
		assert.deepEqual([...identifiers.ISBN], ['9780306406157']);
		extract.resetHistory();
		BibliographyMatcher.extractItemIdentifiers({ DOI: '', ISBN: null, PMID: false, extra: '\n\r\n', url: '' });
		assert.isFalse(extract.called);
	});
	
	it("should retain explicit arXiv evidence beside a DOI without inferring it from DOI digits", function () {
		for (let visible of ['arXiv:2101.12345v2', 'https://arxiv.org/abs/2101.12345v2']) {
			let reference = `doi:10.1234/example ${visible}`;
			let identifiers = BibliographyMatcher.extractIdentifiers(reference);
			assert.deepEqual([...identifiers.arXiv], ['2101.12345']);
			assert.equal(evaluate(reference, [article({ DOI: '10.1234/example', extra: 'arXiv:2101.12345' })]).status,
				'matched');
			assert.equal(evaluate(reference, [article({ DOI: '10.1234/example', extra: 'arXiv:2101.99999' })]).status,
				'unmatched');
		}
		assert.equal(BibliographyMatcher.extractIdentifiers('doi:10.1234/2101.12345').arXiv.size, 0);
	});
	
	it("should preserve independent identifier fields and lines when skipping empty values", function () {
		let identifiers = BibliographyMatcher.extractItemIdentifiers({
			DOI: 'https://doi.org/10.1234/General.42',
			ISBN: '0-306-40615-2',
			PMID: '22678280',
			extra: '\narXiv:0706.0044v1\r\n\r\nPMID: 22678281\n',
			url: 'https://doi.org/10.1234/other',
		});
		assert.sameMembers([...identifiers.DOI], ['10.1234/general.42', '10.1234/other']);
		assert.deepEqual([...identifiers.ISBN], ['9780306406157']);
		assert.sameMembers([...identifiers.PMID], ['22678280', '22678281']);
		assert.deepEqual([...identifiers.arXiv], ['0706.0044']);
	});
	
	it("should reject a candidate with an explicitly conflicting identifier", function () {
		let candidate = article({ DOI: '10.1234/different' });
		let reference = 'Lovelace, Ada. 2021. Reliable matching across diverse bibliographies.';
		assert.equal(evaluate(reference, [candidate]).status, 'matched');
		
		let result = evaluate(reference + ' doi:10.1234/expected', [candidate]);
		assert.equal(result.status, 'unmatched');
		assert.notProperty(result, 'item');
	});
	
	it("should use uniform title, creator, and year evidence", function () {
		let result = evaluate(
			'Lovelace, Ada. (2021). Reliable matching across diverse bibliographies.',
			[article()]
		);
		
		assert.equal(result.status, 'matched');
	});
	
	it("should accept Unicode normalization, case transformations, and punctuation changes", function () {
		let candidate = article({
			title: 'Étude: Über reliable systems',
			creators: [{ creatorType: 'author', firstName: 'Zoë', lastName: 'Ångström' }],
		});
		let result = evaluate(
			'ANGSTROM, Z. 2021. ETUDE — UBER RELIABLE SYSTEMS.',
			[candidate]
		);
		
		assert.equal(result.status, 'matched');
	});
	
	it("should share search normalization for non-decomposing Latin letters", function () {
		let positive = evaluate(
			'Bordg, Bolette. 2021. Lodz, Tromso and Dorde in bibliographic systems.',
			[article({
				title: 'Łódź, Tromsø and Đorđe in bibliographic systems',
				creators: [{ creatorType: 'author', firstName: 'Bolette', lastName: 'Børdg' }],
			})]
		);
		let negative = evaluate(
			'Bordg, Bolette. 2021. Lodaz, Tromso and Dorde in bibliographic systems.',
			[article({
				title: 'Łódź, Tromsø and Đorđe in bibliographic systems',
				creators: [{ creatorType: 'author', firstName: 'Bolette', lastName: 'Børdg' }],
			})]
		);
		
		assert.equal(positive.status, 'matched');
		assert.equal(negative.status, 'unmatched');
	});
	
	it("should align missing and pairwise-merged title tokens only within a bounded span", function () {
		let candidate = article({
			title: 'Reliable local matching across diverse bibliographies',
		});
		let missing = evaluate(
			'Lovelace, A. 2021. Reliable matching across diverse bibliographies. '
				+ 'Journal of Bibliographic Systems, pp. 120-139.',
			[candidate]
		);
		let merged = evaluate(
			'Lovelace, A. 2021. Reliable local matching across diversebibliographies. '
				+ 'Journal of Bibliographic Systems, pp. 120-139.',
			[candidate]
		);
		let separated = evaluate(
			'Lovelace, A. 2021. Reliable local. '
				+ 'one two three four five six seven eight nine ten eleven twelve '
				+ 'matching across diverse bibliographies.',
			[candidate]
		);
		
		assert.equal(missing.status, 'unmatched');
		assert.equal(merged.status, 'matched');
		assert.equal(separated.status, 'unmatched');
	});
	
	it("should retain approximate automatic matches and competition for long titles", function () {
		let title = 'Reliable matching across diverse bibliographies with efficient retrieval of existing research '
			+ 'records from large scientific libraries and digital scholarly collections';
		let shortened = title.replace('efficient ', '');
		let candidate = article({ title });
		let reference = `Lovelace, Ada. 2021. ${shortened}.`;
		let unique = evaluate(reference, [candidate]);
		assert.equal(unique.status, 'matched');
		
		assert.equal(evaluate(reference, [candidate, article({ title: shortened })]).status, 'unmatched');
	});
	
	it("should retain near-title words at either boundary in local and online matching", async function () {
		for (let title of [
			'Behavior patterns in scholarly digital libraries and their implications for reliable citation matching',
			'Behavior patterns in large scholarly digital libraries and archives with implications for reliable bibliographic citation matching',
			'Reliable citation matching for scholarly digital libraries and comprehensive studies of human behavior',
			'Reliable bibliographic citation matching for large scholarly digital libraries and comprehensive longitudinal studies of human behavior',
		]) {
			let candidate = await createItem(article({ title }));
			let reference = `Lovelace, Ada. 2021. ${title.replace(/behavior/i, 'behaviour')}.`;
			assert.equal(evaluate(reference, [candidate]).item?.id, candidate.id, title);
			assert.equal((await BibliographyMatcher.matchLibrary(reference, candidate.libraryID)).item?.id, candidate.id, title);
			await candidate.eraseTx();
		}
	});
	
	it("should recognize normalized double quotes as title boundaries without relying on container metadata", async function () {
		let candidate = await createItem(article({ publicationTitle: '' }));
		for (let [open, close] of [['“', '”'], ['"', '"']]) {
			let reference = `Lovelace, Ada. 2021. ${open}${candidate.getField('title')}${close} Uncatalogued Periodical 3.`;
			assert.equal(evaluate(reference, [candidate]).item?.id, candidate.id);
			assert.equal((await BibliographyMatcher.matchLibrary(reference, candidate.libraryID)).item?.id, candidate.id);
		}
	});
	
	it("should recognize slash-delimited creator and container fields in local and online matching", async function () {
		for (let [data, references] of [
			[article({
				title: 'Методы анализа библиографических ссылок', date: '2020',
				publicationTitle: 'Вестник Московского университета', creators: [
					{ creatorType: 'author', firstName: 'Иван Иванович', lastName: 'Иванов' },
					{ creatorType: 'author', firstName: 'Пётр Петрович', lastName: 'Петров' },
				],
			}), [
				'Иванов, И. И. Методы анализа библиографических ссылок / И. И. Иванов, П. П. Петров '
					+ '// Вестник Московского университета. – 2020. – № 1. – С. 10–20.',
				'Иванов И. И., Петров П. П. Методы анализа библиографических ссылок '
					+ '// Вестн. Моск. ун-та. 2020. № 1. С. 10–20.',
			]],
			[article({ publicationTitle: 'J. Bib. Syst.', creators: [
				{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
				{ creatorType: 'author', firstName: 'Grace', lastName: 'Hopper' },
			] }), [
				'Lovelace, A. Reliable matching across diverse bibliographies / A. Lovelace, G. Hopper '
					+ '// Journal of Bibliographic Systems. – 2021. – Vol. 12. – P. 120–139.',
			]],
		]) {
			let candidate = await createItem(data);
			for (let reference of references) {
				assert.equal(evaluate(reference, [candidate]).item?.id, candidate.id, reference);
				assert.equal((await BibliographyMatcher.matchLibrary(reference, candidate.libraryID)).item?.id, candidate.id, reference);
			}
			await candidate.eraseTx();
		}
	});
	
	it("should not treat a slash within a longer title as an independent field", async function () {
		let candidate = await createItem(article());
		for (let slash of ['/', ' / ']) {
			let reference = `Lovelace, Ada. 2021. Reliable matching across diverse bibliographies${slash}catalogues for libraries.`;
			assert.equal(evaluate(reference, [candidate]).status, 'unmatched');
			assert.equal((await BibliographyMatcher.matchLibrary(reference, candidate.libraryID)).status, 'unmatched');
		}
	});
	
	it("should reject title fragments without changing competition or identifier authority", async function () {
		for (let [title, citation] of [
			['Social Network Analysis', 'Teaching social network analysis to sociology undergraduates'],
			['Machine learning for medical imaging', 'Machine learning for medical imaging: a systematic review of deep learning in radiology'],
		]) {
			let partial = await createItem(article({ title }));
			let reference = `Lovelace, Ada. 2021. ${citation}.`;
			assert.equal(evaluate(reference, [partial]).status, 'unmatched', title);
			assert.equal((await BibliographyMatcher.matchLibrary(reference, partial.libraryID)).status, 'unmatched', title);
			let complete = await createItem(article({ title: citation }));
			// The veto must not discard the fragment and promote the other item.
			assert.equal(evaluate(reference, [partial, complete]).reason, 'ambiguous');
			assert.equal((await BibliographyMatcher.matchLibrary(reference, partial.libraryID)).reason, 'ambiguous');
			partial.setField('DOI', '10.1234/title-fragment');
			await partial.saveTx();
			let identified = reference + ' doi:10.1234/title-fragment';
			assert.equal(evaluate(identified, [partial, complete]).item.id, partial.id);
			assert.equal((await BibliographyMatcher.matchLibrary(identified, partial.libraryID)).item.id, partial.id);
			await partial.eraseTx();
			await complete.eraseTx();
		}
	});
	
	it("should distinguish a chapter's title and creators from its containing book", async function () {
		let book = await createItem({
			itemType: 'book', title: 'The Ethics of Belief', date: '2014', publisher: 'Oxford University Press',
			creators: [
				{ creatorType: 'editor', firstName: 'Jonathan', lastName: 'Matheson' },
				{ creatorType: 'editor', firstName: 'Rico', lastName: 'Vitz' },
			],
		});
		let reference = 'Whitcomb, D. (2014). Can There Be a Knowledge-First Ethics of Belief? '
			+ 'In: Matheson, J.; Vitz, R. (eds.), The Ethics of Belief. Oxford: Oxford University Press. pp. 93-112.';
		assert.equal(evaluate(reference, [book]).status, 'unmatched');
		assert.equal((await BibliographyMatcher.matchLibrary(reference, book.libraryID)).status, 'unmatched');
		for (let citation of [
			'Matheson, J.; Vitz, R. (eds.), The Ethics of Belief. Oxford: Oxford University Press. 2014.',
			'The Ethics of Belief (Oxford: Oxford University Press, 2014), Matheson, J.; Vitz, R.',
		]) {
			assert.equal(evaluate(citation, [book]).item.id, book.id);
			assert.equal((await BibliographyMatcher.matchLibrary(citation, book.libraryID)).item.id, book.id);
		}
		let chapter = await createItem({
			itemType: 'bookSection', title: 'Can There Be a Knowledge-First Ethics of Belief?',
			bookTitle: book.getField('title'), date: '2014', pages: '93-112',
			creators: [{ creatorType: 'author', firstName: 'Dennis', lastName: 'Whitcomb' }],
		});
		assert.equal(evaluate(reference, [chapter]).item.id, chapter.id);
		// Preserve the original competition decision instead of reranking after the veto.
		assert.equal(evaluate(reference, [book, chapter]).reason, 'ambiguous');
		assert.equal((await BibliographyMatcher.matchLibrary(reference, book.libraryID)).reason, 'ambiguous');
		for (let data of [{ ...book.toJSON(), date: '' }, { ...book.toJSON(), creators: [] }]) {
			book.fromJSON(data);
			await book.saveTx();
			assert.strictEqual(evaluate(reference, [book, chapter]).item, chapter);
			assert.strictEqual((await BibliographyMatcher.matchLibrary(reference, book.libraryID)).item, chapter);
		}
		await book.eraseTx();
		assert.equal((await BibliographyMatcher.matchLibrary(reference, chapter.libraryID)).item.id, chapter.id);
	});
	
	it("should reject a containing book when its editors also wrote the cited chapter", async function () {
		let book = await createItem({
			itemType: 'book', title: 'The Ethics of Belief', date: '2014', publisher: 'Oxford University Press',
			creators: [
				{ creatorType: 'editor', firstName: 'Jonathan', lastName: 'Matheson' },
				{ creatorType: 'editor', firstName: 'Rico', lastName: 'Vitz' },
			],
		});
		for (let reference of [
			'Matheson, J. (2014). Evidence and epistemic duty in recent debates. '
				+ 'In J. Matheson & R. Vitz (Eds.), The Ethics of Belief (pp. 11–30). Oxford University Press.',
			'Matheson, J., & Vitz, R. (2014). Introduction. '
				+ 'In J. Matheson & R. Vitz (Eds.), The Ethics of Belief (pp. 1–10). Oxford University Press.',
		]) {
			assert.equal(evaluate(reference, [book]).status, 'unmatched', reference);
			assert.equal((await BibliographyMatcher.matchLibrary(reference, book.libraryID)).status, 'unmatched', reference);
		}
		for (let reference of [
			'Matheson, J., & Vitz, R. (Eds.). (2014). The ethics of belief. Oxford University Press.',
			'Matheson, Jonathan, and Rico Vitz, editors. The Ethics of Belief. Oxford UP, 2014.',
			'Jonathan Matheson and Rico Vitz, eds., The Ethics of Belief (Oxford: Oxford University Press, 2014), 12.',
			'The Ethics of Belief (Oxford: Oxford University Press, 2014), Matheson, J.; Vitz, R.',
		]) {
			assert.equal(evaluate(reference, [book]).item?.id, book.id, reference);
			assert.equal((await BibliographyMatcher.matchLibrary(reference, book.libraryID)).item?.id, book.id, reference);
		}
	});
	
	it("should not automatically match a generic short title using author and year alone", function () {
		let result = evaluate('Lovelace, Ada. 2021. Sun.', [article({ title: 'Sun' })]);
		assert.equal(result.status, 'unmatched');
	});
	
	it("should keep close title alternatives ambiguous even when only one title is exact", function () {
		let title = 'The influence of seasonal environmental variation on coastal ecosystems and marine species diversity';
		let reference = `Lovelace, Ada. 2021. ${title}.`;
		let result = evaluate(reference, [article({ title }), article({ title: title.replace('coastal', 'freshwater') })]);
		assert.equal(result.status, 'unmatched');
		assert.notProperty(result, 'item');
	});
	
	it("should not stitch title evidence through creator and container text", function () {
		let result = evaluate(
			'Reliable Lovelace matching Journal across of diverse Bibliographic '
				+ 'bibliographies Systems 2021.',
			[article()]
		);
		
		assert.notEqual(result.status, 'matched');
	});
	
	it("should keep near-limit alignment bounded across a full candidate pool", function () {
		let scoring = observations.spy(BibliographyMatcher, '_evaluate');
		let title = ['anchor'].concat(
			Array.from({ length: 63 }, (_, index) => `target${index}`)
		).join(' ');
		let reference = Array.from({ length: 128 }, () => 'anchor noise').join(' ');
		let candidates = Array.from(
			{ length: BibliographyMatcher.MAX_CANDIDATES },
			() => article({ title, creators: [], date: '', publicationTitle: '', pages: '' })
		);
		let durations = [];
		for (let i = 0; i < 7; i++) {
			scoring.resetHistory();
			let started = Date.now();
			evaluate(reference, candidates);
			durations.push(Date.now() - started);
			assert.equal(scoring.callCount, BibliographyMatcher.MAX_CANDIDATES);
		}
		assert.isBelow(Math.max(...durations), 1000);
	});
	
	it("should require token boundaries for exact title containment", function () {
		let candidate = article({ title: 'Net theory for reliable bibliographies' });
		let positive = evaluate(
			'Lovelace, Ada. 2021. Net theory for reliable bibliographies.',
			[candidate]
		);
		let negative = evaluate(
			'Lovelace, Ada. 2021. Internet theory for reliable bibliographies.',
			[candidate]
		);
		
		assert.equal(positive.status, 'matched');
		assert.notEqual(negative.status, 'matched');
	});
	
	it("should uniformly align materially different unknown reference layouts", function () {
		let cases = [
			{
				name: 'creator and year before title',
				reference: 'Lovelace, Ada (2021). Reliable matching across diverse bibliographies.',
				candidate: article(),
				status: 'matched',
			},
			{
				name: 'title first with legitimately omitted year and given name',
				reference: 'Reliable matching across diverse bibliographies. '
					+ 'Lovelace. Journal of Bibliographic Systems.',
				candidate: article(),
				status: 'unmatched',
			},
			{
				name: 'initial, quoted title, container, pages, then year',
				reference: 'A. Lovelace, “Reliable matching across diverse bibliographies,” '
					+ 'Journal of Bibliographic Systems, 12(3), pp. 120–139, 2021.',
				candidate: article(),
				status: 'matched',
			},
			{
				name: 'compact creator title container date volume and pages',
				reference: 'Lovelace A. Reliable matching across diverse bibliographies. '
					+ 'Journal of Bibliographic Systems. 2021;12(3):120-139.',
				candidate: article(),
				status: 'matched',
			},
			{
				name: 'multiline punctuation noise',
				reference: 'Reliable—matching\nacross diverse bibliographies!!!\nLovelace, A. [2021]',
				candidate: article(),
				status: 'matched',
			},
			{
				name: 'corporate creator',
				reference: 'World Health Organization. 2021. '
					+ 'Reliable matching across diverse bibliographies.',
				candidate: article({
					creators: [{
						creatorType: 'author', name: 'World Health Organization', fieldMode: 1,
					}],
				}),
				status: 'matched',
			},
			{
				name: 'non-ASCII names and diacritics',
				reference: 'ÅNGSTRÖM, Z. (2021). ÉTUDE — ÜBER RELIABLE SYSTEMS.',
				candidate: article({
					title: 'Étude: Über reliable systems',
					creators: [{ creatorType: 'author', firstName: 'Zoë', lastName: 'Ångström' }],
				}),
				status: 'matched',
			},
		];
		
		for (let testCase of cases) {
			let result = evaluate(testCase.reference, [testCase.candidate]);
			assert.equal(result.status, testCase.status, testCase.name);
		}
	});
	
	it("should recognize compatible given-name initials", function () {
		let result = evaluate(
			'Lovelace, A. 2021. Reliable matching across diverse bibliographies.',
			[article()]
		);
		
		assert.equal(result.status, 'matched');
	});
	
	it("should match the primary creator group without requiring secondary roles", function () {
		let author = { creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' };
		let other = { firstName: 'Grace', lastName: 'Hopper' };
		let reference = 'Lovelace, A. 2021. Reliable matching across diverse bibliographies.';
		for (let [itemType, creators, status] of [
			['bookSection', [author, { ...other, creatorType: 'editor' }], 'matched'],
			['book', [author, { ...other, creatorType: 'translator' }], 'matched'],
			['book', [{ ...author, creatorType: 'editor' }, { ...other, creatorType: 'translator' }], 'matched'],
			['bookSection', [{ ...other, creatorType: 'author' }, { ...author, creatorType: 'editor' }], 'unmatched'],
			['book', [{ ...author, creatorType: 'editor' }, { ...other, creatorType: 'editor' }], 'unmatched'],
			['book', [{ ...author, creatorType: 'translator' }], 'matched'],
		]) {
			let candidate = { itemType, creators, date: '2021', title: article().title };
			assert.equal(evaluate(reference, [candidate]).status, status, `${itemType}: ${JSON.stringify(creators)}`);
		}
	});
	
	it("should use primary creators in library matching as well as provider matching", async function () {
		let item = await createItem({ itemType: 'bookSection', title: article().title, date: '2021', creators: [
			{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
			{ creatorType: 'editor', firstName: 'Grace', lastName: 'Hopper' },
		] });
		let result = await BibliographyMatcher.matchLibrary(
			'Lovelace, A. 2021. Reliable matching across diverse bibliographies.', item.libraryID);
		assert.equal(result.status, 'matched');
		assert.equal(result.item.id, item.id);
	});
	
	it("should bind visible given names to their own surnames even with complete supporting metadata", function () {
		let candidate = article({ creators: [
			{ creatorType: 'author', firstName: 'Bob', lastName: 'Smith' },
			{ creatorType: 'author', firstName: 'Alice', lastName: 'Jones' },
		] });
		for (let names of ['Smith, Alice; Jones, Bob.', 'Alice Smith, Bob Jones.']) {
			let reference = `${names} 2021. ${candidate.title}. ${candidate.publicationTitle}. pp. 120-139.`;
			let result = evaluate(reference, [candidate]);
			assert.equal(result.status, 'unmatched', names);
			let item = new Zotero.Item('journalArticle');
			item.fromJSON(candidate);
			assert.isTrue(BibliographyMatcher._evaluate(
				item, BibliographyMatcher.prepareReference(reference)
			).conflict);
		}
	});
	
	it("should not erase a visible wrong given name with et al", function () {
		let candidate = article({ creators: [
			{ creatorType: 'author', firstName: 'Alice', lastName: 'Smith' },
			{ creatorType: 'author', firstName: 'Bob', lastName: 'Jones' },
		] });
		let suffix = `2021. ${candidate.title}. ${candidate.publicationTitle}. pp. 120-139.`;
		assert.equal(evaluate(`Smith, Wrongname; et al. ${suffix}`, [candidate]).status, 'unmatched');
		assert.equal(evaluate(`Smith, A.; et al. ${suffix}`, [candidate]).status, 'matched');
	});
	
	it("should align compact adjacent creators once and allow unstored middle names", function () {
		let candidate = article({ creators: [
			{ creatorType: 'author', firstName: 'Alice', lastName: 'Smith' },
			{ creatorType: 'author', firstName: 'Bob', lastName: 'Jones' },
		] });
		for (let names of ['Smith A Jones B', 'Alice Helen Smith; Bob James Jones']) {
			let result = evaluate(`${names}. 2021. ${candidate.title}.`, [candidate]);
			assert.equal(result.status, 'matched', names);
		}
		candidate.creators[0].firstName = 'A.';
		candidate.creators[1].firstName = 'B.';
		assert.equal(evaluate(`Alice Smith; Bob Jones. 2021. ${candidate.title}.`, [candidate]).status, 'matched');
	});
	
	it("should abstain on damaged given names instead of guessing OCR corrections", function () {
		let candidate = article({ creators: [
			{ creatorType: 'author', firstName: 'Marianne Helen', lastName: 'Smith' },
		] });
		let result = evaluate(`Smith, Mariannx Helen. 2021. ${candidate.title}.`, [candidate]);
		assert.equal(result.status, 'unmatched');
	});
	
	it("should recognize compact merged initials without reusing one family occurrence", function () {
		let candidate = article({
			creators: [
				{ creatorType: 'author', firstName: 'Barbara Jean', lastName: 'Smith' },
				{ creatorType: 'author', firstName: 'Benjamin James', lastName: 'Smith' },
			],
		});
		let positive = evaluate(
			'Smith, BJ; Smith, B. J. 2021. Reliable matching across diverse bibliographies.',
			[candidate]
		);
		let negative = evaluate(
			'Smith, BJ. 2021. Reliable matching across diverse bibliographies.',
			[candidate]
		);
		
		assert.equal(positive.status, 'matched');
		
		assert.notEqual(negative.status, 'matched');
	});
	
	it("should withhold a title-only match when required evidence is missing", function () {
		let result = evaluate(
			'Lovelace. Reliable matching across diverse bibliographies.',
			[article()]
		);
		
		assert.equal(result.status, 'unmatched');
		assert.notProperty(result, 'item');
	});
	
	it("should require completeness only for a candidate capable of changing automatic matching", function () {
		let matcher = BibliographyMatcher;
		let rival = { score: 0.6, incomplete: true, scoreUpperBound: 0.99 };
		let evaluations = [{ item: { id: 1 }, score: 0.73 }, rival];
		assert.equal(matcher._rankEvaluations(evaluations).status, 'incomplete');
		rival.scoreUpperBound = 0.64;
		assert.equal(matcher._rankEvaluations(evaluations).status, 'unmatched');
	});
	
	it("should withhold tied candidates", function () {
		let first = { item: { id: 1 }, score: 0.8 };
		let second = { item: { id: 2 }, score: 0.8 };
		let lower = { item: { id: 3 }, score: 0.4 };
		let evaluations = [lower, first, second];
		let result = BibliographyMatcher._rankEvaluations(evaluations);
		assert.equal(result.status, 'unmatched');
		assert.notProperty(result, 'item');
		assert.equal(result.reason, 'ambiguous');
	});
	
	it("should reuse complete reference terms for split and joined title bounds", function () {
		let matcher = BibliographyMatcher;
		for (let [text, title, expected, local] of [
			['bio diversity', 'biodiversity', 1, 1],
			['biodiversity', 'bio diversity', 1, 0],
			['alpha beta', 'alpha gamma', 2 / 3, 2 / 3],
		]) {
			let reference = matcher.prepareReference(text);
			let terms = [...reference.alignmentTerms];
			for (let i = 0; i < 2; i++) {
				assert.equal(matcher._alignmentUpperBound(matcher._prepareField(title).tokens, reference.alignmentTerms), expected);
				assert.equal(matcher._alignmentUpperBound(matcher._prepareField(title).tokens, reference.alignmentTerms, false), local);
				assert.deepEqual([...reference.alignmentTerms], terms);
			}
		}
	});
	
	it("should withhold both unsupported titles and competing titles", function () {
		let candidate = article({
			creators: [],
			date: '',
			publicationTitle: '',
			pages: '',
		});
		let unique = evaluate('Reliable matching across diverse bibliographies.', [candidate]);
		let duplicate = evaluate(
			'Reliable matching across diverse bibliographies.',
			[candidate, { ...candidate }]
		);
		
		assert.equal(unique.status, 'unmatched');
		
		
		assert.equal(duplicate.status, 'unmatched');
		assert.notProperty(duplicate, 'item');
	});
	
	it("should not return an unsupported candidate simply because its title scores highest", function () {
		let target = article({ creators: [], date: '', publicationTitle: '', pages: '' });
		let other = article({
			title: 'Reliable matching across unfamiliar historic catalogues and their editions',
			publicationTitle: 'Journal of Bibliographic Systems',
		});
		let reference = `Lovelace, Ada. 2021. ${target.title}. ${other.publicationTitle}.`;
		let result = evaluate(reference, [target, other]);
		assert.equal(result.status, 'unmatched');
		assert.notProperty(result, 'item');
	});
	
	it("should never certify a bounded title prefix or clipped reference as complete", function () {
		let matcher = BibliographyMatcher;
		let prefix = Array.from({ length: matcher.MAX_ALIGNMENT_FIELD_TOKENS }, (_, i) => `word${i}`).join(' ');
		let field = matcher._prepareField(`${prefix} a different final conclusion`);
		let evidence = matcher._alignmentEvidence(field, matcher.prepareReference(prefix).tokens);
		assert.isBelow(evidence.similarity, 1);
		assert.isTrue(evidence.incomplete);
		assert.equal(evaluate(`Lovelace, Ada. 2021. ${prefix}`, [article({ title: field.raw })]).status, 'incomplete');
		let text = `${'a '.repeat(matcher.MAX_REFERENCE_TOKENS)}DOI: 10.1234/beyond-bound`;
		let result = evaluate(text, [article({ DOI: '10.1234/beyond-bound' })]);
		assert.equal(result.status, 'incomplete');
		assert.equal(result.reason, 'reference-token-limit');
	});
	
	it("should not let a noncompeting bounded field invalidate a complete candidate", function () {
		let longTitle = 'Reliable ' + Array.from({ length: 70 }, (_, i) => `unrelated${i}`).join(' ');
		let result = evaluate('Lovelace, Ada. 2021. Reliable matching across diverse bibliographies.', [
			article(),
			article({ title: longTitle, creators: [], date: '', publicationTitle: '', pages: '' }),
			article({ title: 'Reliable observations in another unrelated discipline',
				creators: Array.from({ length: 185 }, (_, i) => ({
					creatorType: 'author', firstName: 'Other', lastName: `Researcher${i}`,
				})) }),
		]);
		assert.equal(result.status, 'matched');
		assert.equal(result.item.getField('title'), article().title);
	});
	
	it("should measure a tiny title fragment against the complete title", function () {
		let matcher = BibliographyMatcher;
		let field = matcher._prepareField('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu');
		assert.closeTo(matcher._alignmentEvidence(field, ['alpha']).similarity, 2 / 13, 0.00001);
	});
	
	it("should preserve mathematical comparisons while removing known inline formatting", function () {
		let matcher = BibliographyMatcher;
		assert.equal(matcher._prepareField('Bounds for x < y and y > z').raw, 'Bounds for x < y and y > z');
		assert.equal(matcher._prepareField('An <i>italic</i> title and H<sub>2</sub>O').raw, 'An italic title and H2O');
	});
	
	it("should abstain when only creators and year are available", function () {
		let candidate = article({
			title: 'A title omitted from the visible record',
			creators: [
				{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
				{ creatorType: 'author', firstName: 'Grace', lastName: 'Hopper' },
			],
			publicationTitle: '',
			pages: '',
		});
		let reference = 'Lovelace, A.; Hopper, G. 2021.';
		let unique = evaluate(reference, [candidate]);
		let competitor = evaluate(reference, [candidate, {
			...candidate,
			title: 'A different title also omitted from the visible record',
		}]);
		
		assert.equal(unique.status, 'unmatched');
		
		assert.equal(competitor.status, 'unmatched');
		assert.notProperty(competitor, 'item');
	});
	
	it("should accept a general et-al creator omission", function () {
		let result = evaluate(
			'Lovelace et al. 2021. Reliable matching across diverse bibliographies.',
			[article({
				creators: [
					{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
					{ creatorType: 'author', firstName: 'Grace', lastName: 'Hopper' },
					{ creatorType: 'author', firstName: 'Katherine', lastName: 'Johnson' },
				],
			})]
		);
		
		assert.equal(result.status, 'matched');
	});
	
	it("should expand et al only after a leading creator prefix", function () {
		let candidate = article({
			creators: [
				{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
				{ creatorType: 'author', firstName: 'Grace', lastName: 'Hopper' },
				{ creatorType: 'author', firstName: 'Katherine', lastName: 'Johnson' },
			],
		});
		let positive = evaluate(
			'Lovelace, A.; Hopper, G.; et al. 2021. '
				+ 'Reliable matching across diverse bibliographies.',
			[candidate]
		);
		let negative = evaluate(
			'Hopper, G.; et al. 2021. Reliable matching across diverse bibliographies.',
			[candidate]
		);
		
		assert.equal(positive.status, 'matched');
		assert.notEqual(negative.status, 'matched');
	});
	
	it("should reject explicit year and page-range contradictions", function () {
		let candidate = new Zotero.Item('journalArticle');
		candidate.fromJSON(article());
		let reference = 'Lovelace, Ada. 2021. Reliable matching across diverse bibliographies. pp. 120–139.';
		assert.equal(evaluate(reference, [candidate]).status, 'matched');
		
		for (let text of [reference.replace('2021', '2020'), reference.replace('120–139', '200–219')]) {
			assert.isTrue(BibliographyMatcher._evaluate(candidate, BibliographyMatcher.prepareReference(text)).conflict);
			let result = evaluate(text, [candidate]);
			assert.equal(result.status, 'unmatched');
			assert.notProperty(result, 'item');
		}
	});
	
	it("should not treat noisy multiple years as one explicit contradiction", function () {
		let result = evaluate(
			'Lovelace, Ada. Originally circulated 2020; published 2021. '
				+ 'Reliable matching across diverse bibliographies.',
			[article()]
		);
		
		assert.equal(result.status, 'matched');
	});
	
	it("should exclude numbers aligned to candidate title and container fields from publication evidence", function () {
		for (let [date, container] of [['2008', ''], ['1999', ' Proceedings of History 1999.']]) {
			let candidate = article({ title: 'The financial crisis of 2008', date,
				publicationTitle: 'Proceedings of History 1999', pages: '' });
			let reference = `Lovelace, Ada. ${candidate.title}.${container}`;
			assert.equal(evaluate(`${reference} ${date}.`, [candidate]).status, 'matched', date);
			let result = evaluate(reference, [candidate]);
			assert.equal(result.status, 'unmatched', date);
			assert.notProperty(result, 'item');
			assert.equal(evaluate(`${reference} 2010.`, [candidate]).status, 'unmatched', date);
		}
		let parsed = BibliographyMatcher.prepareReference('Quantum gravity: 2001.12345');
		assert.isTrue(parsed.identifiers.arXiv.has('2001.12345'));
		assert.deepEqual([...BibliographyMatcher._extractYears(parsed.numericEvidenceText)], []);
		let invalidISBN = BibliographyMatcher.prepareReference('2008 123457');
		assert.equal(invalidISBN.identifiers.ISBN.size, 0);
		assert.deepEqual([...BibliographyMatcher._extractYears(invalidISBN.numericEvidenceText)], ['2008']);
	});
	
	it("should use all plausible item years and ignore numeric identifier and URL spans", function () {
		let parsed = BibliographyMatcher.prepareReference(
			'Lovelace. Reliable matching. DOI: 10.1234/archive_2019. '
				+ 'https://example.test/2020/1500-2100'
		);
		let result = evaluate(
			'Lovelace, A. 2021. Reliable matching across diverse bibliographies.',
			[article({ date: 'First circulated 2020; revised 2021' })]
		);
		
		assert.deepEqual([...BibliographyMatcher._extractYears(parsed.numericEvidenceText)], []);
		assert.deepEqual([...BibliographyMatcher._extractPageRanges(parsed.numericEvidenceText)], []);
		assert.equal(result.status, 'matched');
	});
	
	it("should preserve explicit and known page ranges that resemble years", function () {
		let positive = evaluate(
			'Lovelace, A. 2021. Reliable matching across diverse bibliographies. pp. 2019-2020.',
			[article({ pages: '2019-2020' })]
		);
		let negative = evaluate(
			'Lovelace, A. 2021. Reliable matching across diverse bibliographies. pp. 2018-2020.',
			[article({ pages: '2019-2020' })]
		);
		
		assert.equal(positive.status, 'matched');
		assert.equal(negative.status, 'unmatched');
		for (let pages of ['pp. 2021–2022', 'p. 2021']) {
			let citation = `Lovelace, A. Reliable matching across diverse bibliographies. ${pages}.`;
			let candidate = article({ date: '2021', pages: '2021–2022' });
			assert.equal(evaluate(citation, [candidate]).status, 'unmatched');
			assert.equal(evaluate(`${citation} 2020.`, [candidate]).status, 'unmatched');
			assert.equal(evaluate(`${citation} 2021.`, [candidate]).status, 'matched');
		}
	});
	
	it("should retrieve URL identifiers using the same evidence as candidate matching", async function () {
		for (let [reference, url] of [
			['arXiv: 2301.12345', 'https://arxiv.org/abs/2301.12345'],
			['2021ApJ...910...14S', 'https://ui.adsabs.harvard.edu/abs/2021ApJ...910...14S/abstract'],
		]) {
			let expected = await createItem({ itemType: 'journalArticle', title: 'URL identifier retrieval', url });
			await createItem({ itemType: 'journalArticle', title: 'Identifier substring distractor', url: url.replace('/abs/', '/abs/9') });
			let match = await BibliographyMatcher.matchLibrary(reference, expected.libraryID);
			assert.equal(match.status, 'matched');
			assert.equal(match.item.id, expected.id);
		}
	});
	
	it("should normalize abbreviated page endpoints", function () {
		let result = evaluate(
			'Lovelace, A. 2021. Reliable matching across diverse bibliographies. pp. 120–39.',
			[article()]
		);
		
		assert.equal(result.status, 'matched');
		assert.deepEqual([...BibliographyMatcher._extractPageRanges('120–39.')], ['120-139']);
	});
	
	it("should retrieve equivalent ISBN forms without treating ISBN alone as record identity", function () {
		let result = evaluate('ISBN 0-306-40615-2', [{
			itemType: 'book',
			title: '',
			ISBN: '9780306406157',
		}]);
		
		assert.equal(result.status, 'unmatched');
		let evidence = BibliographyMatcher._identifierEvidence(
			BibliographyMatcher.extractIdentifiers('ISBN 0-306-40615-2'),
			BibliographyMatcher.extractIdentifiers('ISBN 9780306406157'));
		assert.isFalse(evidence.match, 'A shared ISBN does not establish record identity');
		assert.isFalse(evidence.conflict);
	});
	
	it("should extract ISBNs independently from other identifiers and permitted separators", function () {
		let identifiers = BibliographyMatcher.extractIdentifiers(
			'DOI: 10.1234/isbn-cooccurrence\nISBN: 9791\u2011843\u00A0123\u2043391'
		);
		
		assert.deepEqual([...identifiers.DOI], ['10.1234/isbn-cooccurrence']);
		assert.deepEqual([...identifiers.ISBN], ['9791843123391']);
		for (let i = 0; i < 3; i++) {
			let parsed = BibliographyMatcher.prepareReference('ISBN 0-306-40615-2; ISBN 9791\u2011843\u00A0123\u2043391');
			assert.sameMembers([...parsed.identifiers.ISBN], ['9780306406157', '9791843123391']);
			assert.equal(parsed.numericEvidenceText.replace(/isbn|[;\s]/g, ''), '');
		}
	});
	
	it("should verify ordinary book metadata without an ISBN score boost or contradiction override", async function () {
		let book = await createItem({ itemType: 'book', title: 'Reliable methods for evaluating bibliographic identity',
			creators: [{ creatorType: 'author', firstName: 'Alice', lastName: 'Smith' }], date: '2021', ISBN: '9781118282175' });
		let reference = 'Alice Smith. 2021. Reliable methods for evaluating bibliographic identity. ISBN 1118282175';
		let result = await BibliographyMatcher.matchLibrary(reference, book.libraryID);
		assert.equal(result.status, 'matched');
		assert.equal(result.item.id, book.id);
		
		let withoutISBN = await BibliographyMatcher.matchLibrary(reference.replace('ISBN 1118282175', ''), book.libraryID);
		assert.deepEqual(withoutISBN, result);
		
		let conflict = evaluate(reference.replace('Alice Smith', 'Bob Smith'), [book]);
		assert.equal(conflict.status, 'unmatched');
		let dateConflict = evaluate(reference.replace('2021', '2022'), [book]);
		assert.equal(dateConflict.status, 'unmatched');
	});
	
	it("should not let a shared ISBN promote a different component to a strict match", async function () {
		let creators = ['Adam Jorgensen', 'Jorge Segarra', 'Patrick LeBlanc', 'Jose Chinchilla', 'Aaron Nelson']
			.map((name) => {
				let [firstName, lastName] = name.split(' '); return { firstName, lastName, creatorType: 'author' };
			});
		let sibling = await createItem({ itemType: 'bookSection', title: 'The World of SQL Server',
			creators, date: 'August 28, 2012', bookTitle: 'Microsoft SQL Server 2012 Bible', ISBN: '9781118282175' });
		let reference = 'Laying the Foundations. Adam Jorgensen; Jorge Segarra; Patrick LeBlanc; Jose Chinchilla; Aaron Nelson. '
			+ 'August 28, 2012. Microsoft SQL Server 2012 Bible. ISBN 9781118282175';
		let result = await BibliographyMatcher.matchLibrary(reference, sibling.libraryID);
		assert.equal(result.status, 'unmatched');
	});
	
	it("should retrieve a normally hyphenated ISBN from a populated library", async function () {
		let expected = await createItem({
			itemType: 'book',
			title: '',
			ISBN: '9780199535927',
		});
		assert.equal(expected.getField('ISBN'), '978-0-19-953592-7');
		
		let result = await BibliographyMatcher.matchLibrary(
			'ISBN: 9780199535927',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'unmatched');
		assert.deepEqual((await retrieveISBN('ISBN: 9780199535927')).ids, [expected.id]);
	});
	
	it("should retrieve equivalent stored and queried ISBN-10 and ISBN-13 forms both ways", async function () {
		let stored10 = await createItem({
			itemType: 'book',
			title: '',
			ISBN: '123456789X',
		});
		let stored13 = await createItem({
			itemType: 'book',
			title: '',
			ISBN: '9780306406157',
		});
		let generalParser = observations.spy(BibliographyMatcher, 'extractItemIdentifiers');
		
		let from10 = await retrieveISBN(
			'ISBN: 9781234567897',
			Zotero.Libraries.userLibraryID
		);
		let from13 = await retrieveISBN(
			'ISBN: 0-306-40615-2',
			Zotero.Libraries.userLibraryID
		);
		
		assert.deepEqual(from10.ids, [stored10.id]);
		assert.deepEqual(from13.ids, [stored13.id]);
		assert.equal(generalParser.callCount, 2, 'Only matching ISBN values should reach the parser');
	});
	
	it('should preserve general parsing for multi-value and mixed-content ISBN rows', async function () {
		let matcher = BibliographyMatcher;
		let values = [
			'978-0-306-40615-7',
			'123456789x',
			'9791843123391',
			'978 0 306 40615 7',
			'9791\u2011843\u00A0123\u2043391',
			'0306406152 (pbk.)',
			'9780306406157; 123456789X',
			'9780306406157 DOI: 10.1234/isbn-mixed',
			'ISBN 9783161484100 https://doi.org/%31%30%2E1234%2Fisbn-mixed',
			'123456789X PMID: 22678280',
			'DOI: 10.1234/isbn-mixed',
			'9780306406158',
			'invalid',
			'x'.repeat(matcher.MAX_MATCH_TEXT_LENGTH) + ' 123456789X',
			'prefix\u0000 123456789X',
			'2' + '0'.repeat(2000),
		];
		let records = [];
		for (let ISBN of values) records.push(await createItem({ itemType: 'book', ISBN }));
		for (let text of [
			'ISBN 9780306406157',
			'ISBN 9781234567897',
			'ISBN 9791843123391',
			'ISBN 9780000000026',
			'ISBN 9783161484100 DOI: 10.1234/isbn-mixed\nPMID: 22678280',
		]) {
			let identifiers = matcher.prepareReference(text).identifiers;
			let expected = records.filter(item => Object.entries(matcher.extractItemIdentifiers(item))
				.some(([type, stored]) => [...stored].some(id => identifiers[type].has(id)))).map(item => item.id);
			let result = await matcher._searchByIdentifiers(identifiers, Zotero.Libraries.userLibraryID);
			assert.sameMembers(result.ids, expected, text);
			assert.isFalse(result.incomplete);
		}
	});
	
	it('filters unrelated annotated ISBN values before parsing', async function () {
		let matcher = BibliographyMatcher;
		await createItem({ itemType: 'book', ISBN: '0306406152 (pbk.) 9780306406157' });
		let target = await createItem({ itemType: 'book', ISBN: '123456789X (hardback)' });
		let identifiers = matcher.prepareReference('ISBN 9781234567897').identifiers;
		let parser = observations.spy(matcher, 'extractItemIdentifiers');
		let result = await matcher._searchByIdentifiers(identifiers, target.libraryID);
		assert.deepEqual(result, { ids: [target.id], incomplete: false });
		assert.equal(parser.callCount, 1);
	});
	
	it("should retrieve formattable, unformattable, and multi-value ISBN-13 fields", async function () {
		let formattable = await createItem({
			itemType: 'book',
			title: '',
			ISBN: '9791000000008',
		});
		let canonical = await createItem({
			itemType: 'book',
			title: '',
			ISBN: '9791843123391',
		});
		let mixed = await createItem({
			itemType: 'book',
			title: '',
			ISBN: '9791\u2011843\u00A0123\u2043391',
		});
		let multiple = await createItem({
			itemType: 'book',
			title: '',
			ISBN: '9781000000009; 9791020000002',
		});
		
		let formattableResult = await retrieveISBN(
			'ISBN: 9791000000008',
			Zotero.Libraries.userLibraryID
		);
		let canonicalResult = await retrieveISBN(
			'ISBN: 9791843123391',
			Zotero.Libraries.userLibraryID
		);
		let mixedResult = await retrieveISBN(
			'ISBN: 9791\u2011843\u00A0123\u2043391',
			Zotero.Libraries.userLibraryID
		);
		let multipleResult = await retrieveISBN(
			'ISBN: 9791020000002',
			Zotero.Libraries.userLibraryID
		);
		
		assert.deepEqual(formattableResult.ids, [formattable.id]);
		for (let result of [canonicalResult, mixedResult]) {
			assert.sameMembers(result.ids, [canonical.id, mixed.id]);
		}
		assert.deepEqual(multipleResult.ids, [multiple.id]);
	});
	
	it("should preserve equivalent ISBN duplicate ambiguity and overflow", async function () {
		observations.stub(BibliographyMatcher, 'MAX_CANDIDATES').value(3);
		for (let i = 0; i <= BibliographyMatcher.MAX_CANDIDATES; i++) {
			await createItem({
				itemType: 'book',
				title: '',
				ISBN: i % 2 ? '0306406152' : '9780306406157',
			});
		}
		
		let isbnSearch = observations.spy(BibliographyMatcher, '_searchByIdentifiers');
		let result = await BibliographyMatcher.matchLibrary(
			'ISBN: 9780306406157',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'incomplete');
		assert.equal(result.reason, 'retrieval-limit');
		assert.isTrue(isbnSearch.calledOnce);
		let route = await isbnSearch.firstCall.returnValue;
		assert.lengthOf(route.ids, BibliographyMatcher.MAX_CANDIDATES + 1);
		assert.isTrue(route.incomplete);
	});
	
	it("should restrict ISBN retrieval to regular nondeleted items in the selected library", async function () {
		let metadata = { title: 'Reliable methods for evaluating bibliographic identity', date: '2021',
			creators: [{ creatorType: 'author', firstName: 'Alice', lastName: 'Smith' }] };
		let expected = await createItem({
			itemType: 'book',
			...metadata,
			ISBN: '9783161484100',
		});
		await createItem({
			itemType: 'book',
			title: '',
			ISBN: '9780199535927',
		});
		let deleted = await createItem({
			itemType: 'book',
			...metadata,
			ISBN: '9783161484100',
		});
		deleted.deleted = true;
		await deleted.saveTx();
		let child = new Zotero.Item('note');
		child.libraryID = Zotero.Libraries.userLibraryID;
		child.parentID = expected.id;
		child.setNote('ISBN: 9783161484100');
		await child.saveTx();
		items.push(child);
		let group = await createGroup();
		try {
			let groupItem = await createItem({
				itemType: 'book',
				...metadata,
				ISBN: '9783161484100',
			}, group.libraryID);
			
			let userResult = await retrieveISBN(
				'ISBN: 9783161484100',
				Zotero.Libraries.userLibraryID
			);
			let groupResult = await retrieveISBN(
				'ISBN: 9783161484100',
				group.libraryID
			);
			
			assert.deepEqual(userResult.ids, [expected.id]);
			assert.deepEqual(groupResult.ids, [groupItem.id]);
			let text = `Alice Smith. 2021. ${metadata.title}. ISBN 9783161484100`;
			for (let target of [expected, groupItem]) {
				let matched = await BibliographyMatcher.matchLibrary(text, target.libraryID);
				assert.equal(matched.status, 'matched');
				assert.equal(matched.item.id, target.id);
			}
		}
		finally {
			await group.eraseTx();
		}
	});
	
	it("should union co-occurring DOI and ISBN routes before resolving exact identifiers", async function () {
		let both = await createItem({
			itemType: 'book',
			title: '',
			DOI: '10.1234/isbn-union',
			ISBN: '9780306406157',
		});
		let isbnDuplicate = await createItem({
			itemType: 'book',
			title: '',
			ISBN: '0306406152',
		});
		
		let loading = observations.spy(BibliographyMatcher, '_loadLibraryCandidates');
		let result = await BibliographyMatcher.matchLibrary(
			'DOI: 10.1234/isbn-union\nISBN: 0-306-40615-2',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'matched');
		
		assert.equal(result.item.id, both.id);
		assert.notEqual(result.item.id, isbnDuplicate.id);
		assert.isTrue(loading.calledOnce);
		assert.sameMembers(loading.firstCall.args[0], [both.id, isbnDuplicate.id]);
	});
	
	it("should not use a citation hyperlink as matching evidence", function () {
		let result = evaluate([{
			text: 'Publisher page',
			attributes: { url: 'https://doi.org/10.1234/hidden' },
		}], [article({ title: '', creators: [], date: '', DOI: '10.1234/hidden' })]);
		
		assert.equal(result.status, 'unmatched');
		assert.deepEqual(
			[...BibliographyMatcher.prepareReference([{
				text: 'Publisher page',
				attributes: { url: 'https://doi.org/10.1234/hidden' },
			}]).identifiers.DOI],
			[]
		);
	});
	
	it("should match visible text regardless of unrelated, unsupported, malformed or excessive hrefs", function () {
		for (let url of [
			'http://linker.aanda.org/10.1051/0004-6361/202243709/74',
			'zotero://select/library/items/ABCDEFGH',
			'not a URL',
		]) {
			let parts = Array.from({ length: 21 }, (_, index) => ({
				text: index ? '' : 'Lovelace, A. 2021. Reliable matching across diverse bibliographies.',
				attributes: { url: index === 0 ? url : `https://example.com/${'x'.repeat(3000)}${index}` },
			}));
			let item = article({ DOI: '10.1234/visible-record' });
			let result = evaluate(parts, [item]);
			assert.equal(result.status, 'matched', url);
			assert.equal(result.item.getField('DOI'), item.DOI);
		}
	});
	
	it("should extract supported identifiers from candidate URL metadata", function () {
		let result = evaluate('doi:10.1234/from-url', [article({
			title: '',
			creators: [],
			date: '',
			url: 'https://doi.org/10.1234/from-url',
		})]);
		
		assert.equal(result.status, 'matched');
	});
	
	it("should let an exact identifier override conflicting secondary metadata", function () {
		let result = evaluate(
			'Lovelace. 2020. Reliable matching across diverse bibliographies. '
				+ 'pp. 200–219. DOI: 10.1234/secondary-conflict',
			[article({ DOI: '10.1234/secondary-conflict' })]
		);
		
		assert.equal(result.status, 'matched');
	});
	
	describe('normalized identifier retrieval', function () {
		it('preserves case folding and literal punctuation in identifier probes', async function () {
			for (let field of ['DOI', 'extra', 'url']) {
				for (let suffix of ['UPPER_CASE', 'ÉXAMPLE', 'PERCENT%literal']) {
					let DOI = `10.1234/${field}-${suffix}`;
					let item = await createItem(article({ [field]: DOI }));
					let result = await BibliographyMatcher.matchLibrary('DOI: ' + DOI.toLowerCase(), item.libraryID);
					assert.equal(result.status, 'matched');
					assert.equal(result.item.id, item.id);
				}
			}
		});
		
		it('matches URL-encoded DOIs in every identifier-bearing field without title overlap', async function () {
			let matcher = BibliographyMatcher;
			let titleSearch = observations.spy(matcher, '_searchTitleCandidates');
			for (let field of ['DOI', 'extra', 'url']) {
				for (let [index, encode] of [
					value => value.replaceAll('/', '%2F'),
					value => value.replaceAll('/', '%2f'),
					value => value.replace('10.', '%31%30%2E'),
					value => value.replace('10.', '1%30.'),
					value => value.replace('10.', '%310.'),
					value => [...value].map(char => '%' + char.charCodeAt(0).toString(16)).join(''),
					value => '\u0000 https://doi.org/' + encodeURIComponent(value),
				].entries()) {
					let DOI = `10.1234/encoded-${field}-${index}/id`;
					let item = await createItem(article({ [field]: `https://doi.org/${encode(DOI)}` }));
					let result = await matcher.matchLibrary(`DOI: ${DOI}`, item.libraryID);
					assert.equal(result.status, 'matched', `${field} encoding ${index}`);
					assert.equal(result.item.id, item.id);
					let duplicate = await matcher.checkForDuplicate(matcher.createCandidateSnapshot(article({ DOI })), item.libraryID);
					assert.equal(duplicate.status, 'matched');
					assert.equal(duplicate.item.id, item.id);
				}
			}
			assert.isFalse(titleSearch.called);
		});
		
		it('does not parse unrelated percent-encoded URLs during DOI retrieval', async function () {
			let matcher = BibliographyMatcher;
			let target = await createItem(article({ DOI: '10.1234/encoded-prefilter' }));
			await createItem({ itemType: 'journalArticle', url: 'https://example.invalid/field%20observations' });
			let identifiers = matcher.prepareReference('DOI: 10.1234/encoded-prefilter').identifiers;
			let parser = observations.spy(matcher, 'extractItemIdentifiers');
			let result = await matcher._searchByIdentifiers(identifiers, target.libraryID);
			assert.deepEqual(result, { ids: [target.id], incomplete: false });
			assert.equal(parser.callCount, 1);
		});
		
		it('preserves encoded DOI matches and competitors excluded by title pruning', async function () {
			let matcher = BibliographyMatcher;
			let title = 'Reliable identification of scientific references with incomplete';
			let DOI = '10.1234/encoded-competitors/id';
			let storedDOI = 'https://doi.org/10.1234/encoded-competitors%2Fid';
			let item = await createItem(article({ title: title + ' metadata across diverse libraries', DOI: storedDOI }));
			let reference = `Lovelace, Ada. 2021. ${title}. DOI: ${DOI}`;
			let result = await matcher.matchLibrary(reference, item.libraryID);
			assert.equal(result.status, 'matched');
			assert.equal(result.item.id, item.id);
			await createItem(article({ title, DOI: storedDOI }));
			assert.deepEqual(await matcher.matchLibrary(reference, item.libraryID), { status: 'unmatched', reason: 'ambiguous-identifiers' });
			let duplicate = await matcher.checkForDuplicate(matcher.createCandidateSnapshot(article({ DOI })), item.libraryID);
			assert.deepEqual(duplicate, { status: 'unresolved', reason: 'ambiguous' });
		});
		
		it('matches stored DOI forms without relying on title overlap', async function () {
			let matcher = BibliographyMatcher;
			let titleSearch = observations.spy(matcher, '_searchTitleCandidates');
			for (let [index, prefix] of ['', 'doi:', 'DOI: ', 'https://doi.org/', 'http://dx.doi.org/'].entries()) {
				let DOI = `10.1234/normalized-${index}`;
				let item = await createItem(article({ DOI: prefix + DOI }));
				let result = await matcher.matchLibrary(`DOI: ${DOI}`, item.libraryID);
				assert.equal(result.status, 'matched', prefix);
				assert.equal(result.item.id, item.id);
				let duplicate = await matcher.checkForDuplicate(matcher.createCandidateSnapshot(article({ DOI })), item.libraryID);
				assert.equal(duplicate.status, 'matched', prefix);
				assert.equal(duplicate.item.id, item.id);
			}
			assert.isFalse(titleSearch.called);
		});
		
		it('withholds competing DOI forms even when only one title survives pruning', async function () {
			let matcher = BibliographyMatcher;
			let title = 'Reliable identification of scientific references with incomplete';
			for (let [index, prefix] of ['', 'https://doi.org/'].entries()) {
				let DOI = `10.1234/normalized-duplicates-${index}`;
				await createItem(article({ title: title + ' metadata across diverse libraries', DOI: `https://doi.org/${DOI}` }));
				let item = await createItem(article({ title, DOI: prefix + DOI }));
				let result = await matcher.matchLibrary(`Lovelace, Ada. 2021. ${title}. DOI: ${DOI}`, item.libraryID);
				assert.equal(result.status, 'unmatched');
				assert.deepEqual(result, { status: 'unmatched', reason: 'ambiguous-identifiers' });
				let duplicate = await matcher.checkForDuplicate(matcher.createCandidateSnapshot(article({ DOI })), item.libraryID);
				assert.deepEqual(duplicate, { status: 'unresolved', reason: 'ambiguous' });
			}
		});
		
		it('counts normalized identifier equality, not substring collisions, against the candidate limit', async function () {
			let matcher = BibliographyMatcher;
			let DOI = '10.1234/normalized-prefix';
			for (let suffix of ['-one', '-two', '-three']) {
				await createItem(article({ DOI: DOI + suffix }));
				await createItem(article({ DOI: `https://doi.org/${encodeURIComponent(DOI + suffix)}` }));
			}
			let item = await createItem(article({ DOI: `https://doi.org/${encodeURIComponent(DOI)}` }));
			observations.stub(matcher, 'MAX_CANDIDATES').value(1);
			let identifiers = matcher.prepareReference(`DOI: ${DOI}`).identifiers;
			assert.deepEqual(await matcher._searchByIdentifiers(identifiers, item.libraryID), { ids: [item.id], incomplete: false });
			let duplicate = await createItem(article({ DOI: `doi:${DOI}` }));
			let overflow = await matcher._searchByIdentifiers(identifiers, item.libraryID);
			assert.sameMembers(overflow.ids, [item.id, duplicate.id]);
			assert.isTrue(overflow.incomplete);
		});
	});
	
	it("should return an exact identifier before a broad route can overflow", async function () {
		let expected = await createItem(article({ DOI: '10.1234/exact-before-overflow' }));
		observations.stub(BibliographyMatcher, '_searchByIdentifiers')
			.resolves({ ids: [expected.id], incomplete: false });
		let titleSearch = observations.stub(BibliographyMatcher, '_searchTitleCandidates')
			.resolves({ ids: [], incomplete: true });
		
		let result = await BibliographyMatcher.matchLibrary(
			'DOI: 10.1234/exact-before-overflow',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'matched');
		assert.equal(result.item.id, expected.id);
		assert.isFalse(titleSearch.called);
	});
	
	it("should abstain when multiple library items have the same exact identifier", async function () {
		await createItem(article({ DOI: '10.1234/duplicate-exact' }));
		await createItem(article({
			title: 'A separately saved duplicate record',
			DOI: '10.1234/duplicate-exact',
		}));
		
		let result = await BibliographyMatcher.matchLibrary(
			'DOI: 10.1234/duplicate-exact',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'unmatched');
		assert.equal(result.reason, 'ambiguous-identifiers');
		assert.notProperty(result, 'item');
	});
	
	it("should not prefer a DOI record over a separate explicitly cited preprint", async function () {
		let published = await createItem(article({ DOI: '10.1234/preprint-counterpart' }));
		let preprint = await createItem(article({ extra: 'arXiv:2101.12345' }));
		let reference = 'DOI: 10.1234/preprint-counterpart arXiv:2101.12345';
		for (let candidate of [published, preprint]) {
			assert.equal(evaluate(reference, [candidate]).status, 'matched', candidate.getField('DOI') || candidate.getField('extra'));
		}
		assert.deepEqual(await BibliographyMatcher.matchLibrary(reference, published.libraryID),
			{ status: 'unmatched', reason: 'ambiguous-identifiers' });
	});
	
	it("should retrieve a library DOI stored only in the URL field", async function () {
		let expected = await createItem(article({
			DOI: '',
			url: 'https://doi.org/10.1234/url-only-local',
		}));
		
		let result = await BibliographyMatcher.matchLibrary(
			'DOI: 10.1234/url-only-local',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'matched');
		
		assert.equal(result.item.id, expected.id);
	});
	
	it("should count identifier candidates once across fields and bound the DOI/ISBN union", async function () {
		let matcher = BibliographyMatcher;
		let first = await createItem(article({ DOI: '10.1234/union',
			url: 'https://doi.org/10.1234/union', extra: 'DOI: 10.1234/union' }));
		let second = await createItem({ itemType: 'book', title: 'Separate ISBN candidate', ISBN: '9780306406157' });
		observations.stub(matcher, 'MAX_CANDIDATES').value(1);
		let retrieve = text => matcher._searchByIdentifiers(matcher.prepareReference(text).identifiers, first.libraryID);
		let single = await retrieve('DOI: 10.1234/union');
		assert.deepEqual(single, { ids: [first.id], incomplete: false });
		let union = await retrieve('DOI: 10.1234/union ISBN 0-306-40615-2');
		assert.sameMembers(union.ids, [first.id, second.id]);
		assert.isTrue(union.incomplete);
	});
	
	it("should retrieve literal DOI wildcard characters without wildcard collisions", async function () {
		let firstClass = await createItem(article({
			DOI: '10.1234/field_2021',
		}));
		let expected = await createItem(article({
			DOI: '',
			url: 'https://doi.org/10.1234/archive_2021',
		}));
		await createItem(article({
			title: 'A wildcard-shaped distractor',
			DOI: '',
			url: 'https://doi.org/10.1234/archiveX2021',
		}));
		
		let result = await BibliographyMatcher.matchLibrary(
			'DOI: 10.1234/archive_2021',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'matched');
		
		assert.equal(result.item.id, expected.id);
		
		let firstClassResult = await BibliographyMatcher.matchLibrary(
			'DOI: 10.1234/field_2021',
			Zotero.Libraries.userLibraryID
		);
		assert.equal(firstClassResult.status, 'matched');
		assert.equal(firstClassResult.item.id, firstClass.id);
	});
	
	it("should preserve duplicate ambiguity across first-class and textual DOI storage", async function () {
		await createItem(article({ DOI: '10.1234/archive_2021' }));
		await createItem(article({
			title: 'Separately stored identifier duplicate',
			DOI: '',
			extra: 'DOI: 10.1234/archive_2021',
		}));
		
		let result = await BibliographyMatcher.matchLibrary(
			'DOI: 10.1234/archive_2021',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'unmatched');
		assert.equal(result.reason, 'ambiguous-identifiers');
		assert.notProperty(result, 'item');
	});
	
	it("should retrieve and match a saved item by first-class PMID alone", async function () {
		let expected = await createItem(article({
			title: '',
			creators: [],
			date: '',
			publicationTitle: '',
			volume: '',
			issue: '',
			pages: '',
			PMID: '22678280',
		}));
		
		let result = await BibliographyMatcher.matchLibrary(
			'PMID: 22678280',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'matched');
		
		assert.equal(result.item.id, expected.id);
	});
	
	it("should retrieve every accepted labelled PMID form from Extra and verify it exactly", async function () {
		for (let [index, extra] of [
			'PMID 22678280',
			'PMID:22678281',
			'pmid:\t22678282',
		].entries()) {
			let expected = await createItem(article({
				title: `PMID form ${index}`,
				PMID: '',
				extra,
			}));
			await createItem(article({
				title: `Numeric collision ${index}`,
				PMID: '',
				extra: `Unrelated number ${22678280 + index}`,
			}));
			
			let result = await BibliographyMatcher.matchLibrary(
				`PMID: ${22678280 + index}`,
				Zotero.Libraries.userLibraryID
			);
			
			assert.equal(result.status, 'matched', extra);
			assert.equal(result.item.id, expected.id, extra);
		}
	});
	
	it("should select a strict candidate only with a sufficient competitor margin", function () {
		let result = evaluate(
			'Lovelace, Ada. 2021. Reliable matching across diverse bibliographies.',
			[
				article(),
				article({
					title: 'A different work about bibliography matching',
					creators: [{ creatorType: 'author', firstName: 'Grace', lastName: 'Hopper' }],
				}),
			]
		);
		
		assert.equal(result.status, 'matched');
	});
	
	it("should query only the requested populated library with bounded loading", async function () {
		let expected = await createItem(article());
		let group = await createGroup();
		try {
			await createItem(article({ title: 'Same retrieval words in another library' }), group.libraryID);
			
			let loading = observations.spy(BibliographyMatcher, '_loadLibraryCandidates');
			let result = await BibliographyMatcher.matchLibrary(
				'Lovelace, A. 2021. Reliable matching across diverse bibliographies.',
				Zotero.Libraries.userLibraryID
			);
			
			assert.equal(result.status, 'matched');
			assert.equal(result.item.id, expected.id);
			for (let call of loading.getCalls()) {
				assert.isAtMost(call.args[0].length, BibliographyMatcher.CANDIDATE_BATCH_SIZE);
				assert.equal(call.args[1], Zotero.Libraries.userLibraryID);
			}
		}
		finally {
			await group.eraseTx();
		}
	});
	
	it("should keep the complete competing pool when loading in smaller batches", async function () {
		for (let i = 0; i < 3; i++) await createItem(article({ DOI: '', url: '' }));
		observations.stub(BibliographyMatcher, 'CANDIDATE_BATCH_SIZE').value(1);
		let loading = observations.spy(BibliographyMatcher, '_loadLibraryCandidates');
		let scoring = observations.spy(BibliographyMatcher, '_evaluate');
		observations.stub(BibliographyMatcher, 'MAX_CANDIDATES').value(2);
		let result = await BibliographyMatcher.matchLibrary(
			'Lovelace, A. 2021. Reliable matching across diverse bibliographies.',
			Zotero.Libraries.userLibraryID
		);
		assert.equal(result.status, 'unmatched');
		assert.equal(result.reason, 'ambiguous');
		assert.notProperty(result, 'item');
		assert.equal(loading.callCount, 3);
		assert.equal(scoring.callCount, 3);
		for (let call of loading.getCalls()) assert.lengthOf(call.args[0], 1);
	});
	
	it("should retrieve title-first references independently of journal and creator order", async function () {
		let expected = await createItem(article({
			title: 'How bees find their way home',
			creators: [{ creatorType: 'author', firstName: 'Alice', lastName: 'Smith' }],
			publicationTitle: 'International Entomological Investigations',
		}));
		let result = await BibliographyMatcher.matchLibrary(
			'How bees find their way home. Alice Smith. 2021. International Entomological Investigations.',
			Zotero.Libraries.userLibraryID
		);
		assert.equal(result.status, 'matched');
		assert.equal(result.item.id, expected.id);
	});
	
	it("should preserve title candidates across normalized SQL and library boundaries", async function () {
		let matcher = BibliographyMatcher;
		let libraryID = Zotero.Libraries.userLibraryID;
		let creator = { creatorType: 'author', firstName: 'Zoë', lastName: 'García' };
		let target = await createItem(article({ title: 'École research inquiry', creators: [creator,
			{ creatorType: 'author', firstName: 'Ana', lastName: 'García' }] }));
		await createItem({ itemType: 'case', caseName: 'École proceedings', dateDecided: '2021-03-04' });
		await createItem(article({ title: 'Independent proceedings',
			creators: [{ creatorType: 'author', name: 'École Recherche' }] }));
		let fallback = await createItem(article({ title: 'SubsequenceCatalog', creators: [creator] }));
		await Zotero.DB.queryAsync('UPDATE itemDataValues SET valueNormalized=NULL WHERE valueID IN '
			+ ' (SELECT valueID FROM itemData WHERE itemID=? AND fieldID=?)',
		[fallback.id, Zotero.ItemFields.getID('title')]);
		let deleted = await createItem(article({ title: 'École deleted', creators: [creator] }));
		deleted.deleted = true;
		await deleted.saveTx();
		let attachment = new Zotero.Item('attachment');
		attachment.libraryID = libraryID;
		attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_URL;
		attachment.setField('title', 'École child');
		attachment.setField('url', 'https://example.invalid/reference');
		attachment.parentID = target.id;
		await attachment.saveTx();
		items.push(attachment);
		let group = await createGroup();
		let leftBound = Zotero.Prefs.get('search.useLeftBound');
		try {
			let foreign = await createItem(article({ title: 'École foreign', creators: [creator] }), group.libraryID);
			Zotero.Prefs.set('search.useLeftBound', true);
			for (let text of ['ÉCOLE research inquiry García 2021', 'ÉCOLE research inquiry 2020', 'ÉCOLE research inquiry 2020 2021', 'ÉCOLE research inquiry', 'sequence 2021']) {
				let reference = matcher.prepareReference(text);
				let search = new Zotero.Search();
				search.libraryID = libraryID;
				search.addCondition('noChildren', 'true');
				// The oracle must inspect all titles, not repeat the retrieval predicate.
				let searched = await Zotero.Items.getAsync(await search.search());
				let expected = searched.filter(item => item.isRegularItem() && !item.deleted).filter((item) => {
					return matcher._evaluate(item, reference, false).scoreUpperBound
						>= matcher.MIN_STRICT_SCORE - matcher.MIN_MATCH_MARGIN;
				}).map(item => item.id);
				let actual = await matcher._searchTitleCandidates(reference, libraryID);
				assert.isFalse(actual.incomplete, text);
				assert.sameMembers(actual.ids, expected, text);
				let ids = actual.ids;
				assert.notInclude(ids, deleted.id);
				assert.notInclude(ids, attachment.id);
				assert.notInclude(ids, foreign.id);
				if (text === 'ÉCOLE research inquiry 2020') assert.include(ids, target.id, 'Year must not filter title candidates');
			}
		}
		finally {
			if (leftBound === undefined) Zotero.Prefs.clear('search.useLeftBound');
			else Zotero.Prefs.set('search.useLeftBound', leftBound);
			await group.eraseTx();
		}
	});
	
	it("should leave unsupported local word splits to complete online verification", async function () {
		let group = await createGroup();
		try {
			let candidates = [];
			for (let title of ['Quantum Computation', 'Quantum-Computation', 'Quantum/Computation']) {
				candidates.push(await createItem(article({ title }), group.libraryID));
			}
			let reference = 'Lovelace, Ada. 2021. QuantumComputation.';
			for (let candidate of candidates) {
				assert.equal(evaluate(reference, [candidate]).status, 'matched', candidate.getField('title'));
			}
			let complete = evaluate(reference, candidates);
			assert.equal(complete.status, 'matched');
			assert.strictEqual(complete.item, candidates[0], 'Equivalent title formatting uses the first provider record');
			
			assert.deepEqual(await BibliographyMatcher.matchLibrary(reference, group.libraryID),
				{ status: 'unmatched', reason: 'insufficient-evidence' });
			
			let literal = await createItem(article({ title: 'QuantumComputation' }), group.libraryID);
			let local = await BibliographyMatcher.matchLibrary(reference, group.libraryID);
			assert.equal(local.status, 'matched');
			assert.equal(local.item.id, literal.id);
			assert.equal(evaluate(reference, [...candidates, literal]).reason, 'ambiguous');
			assert.equal((await BibliographyMatcher.matchLibrary('Lovelace, Ada. 2021. Quantum Computation.',
				group.libraryID)).reason, 'ambiguous');
			assert.equal((await BibliographyMatcher.matchLibrary('Lovelace, Ada. 2021. Quan tumComputation.',
				group.libraryID)).item.id, literal.id, 'A split reference still provides a literal long-word probe');
		}
		finally {
			await group.eraseTx();
		}
	});
	
	it("should require searchable local title evidence but keep short-word online evidence", async function () {
		let group = await createGroup();
		try {
			let short = await createItem(article({ title: 'The way we see the sun' }), group.libraryID);
			let reference = 'Lovelace, Ada. 2021. The way we see the sun and stars.';
			assert.equal(evaluate('Lovelace, Ada. 2021. The way we see the sun.', [short]).status, 'matched');
			assert.equal(evaluate(reference, [short]).status, 'unmatched', 'A title fragment is not an independent work title');
			assert.equal((await BibliographyMatcher.matchLibrary(reference, group.libraryID)).status, 'unmatched');
			let anchored = await createItem(article({ title: 'The way we see the sun and stars' }), group.libraryID);
			assert.equal(evaluate(reference, [short, anchored]).reason, 'ambiguous');
			assert.equal((await BibliographyMatcher.matchLibrary(reference, group.libraryID)).item.id, anchored.id);
			short.setField('DOI', '10.1234/short-title');
			await short.saveTx();
			assert.equal((await BibliographyMatcher.matchLibrary(reference + ' doi:10.1234/short-title',
				group.libraryID)).item.id, short.id, 'Identifiers remain authoritative without a title probe');
		}
		finally {
			await group.eraseTx();
		}
	});
	
	it("should include native exact-title results in identity retrieval without approximate scoring", async function () {
		let literal = '100%_equality \\ study';
		await createItem(article({ title: literal }));
		await createItem(article({ title: '100X_equality \\ study' }));
		let numeric = await createItem(article({ title: '2021' }));
		await createItem({ itemType: 'case', caseName: 'École proceedings' });
		await Zotero.DB.queryAsync('UPDATE itemDataValues SET valueNormalized=NULL WHERE valueID IN '
			+ '(SELECT valueID FROM itemData WHERE itemID=? AND fieldID=?)',
		[numeric.id, Zotero.ItemFields.getID('title')]);
		let field = observations.spy(BibliographyMatcher, '_prepareField');
		for (let title of [literal, literal.toUpperCase(), '2021', 'Ecole proceedings']) {
			let search = new Zotero.Search();
			search.libraryID = numeric.libraryID;
			search.addCondition('title', 'is', title);
			let expected = (await Zotero.Items.getAsync(await search.search()))
				.filter(item => item.isRegularItem() && !item.deleted).map(item => item.id);
			let actual = await BibliographyMatcher._searchByExactTitle(title, numeric.libraryID);
			assert.isFalse(actual.incomplete, title);
			assert.includeMembers(actual.ids, expected, title);
		}
		assert.isFalse(field.called);
	});
	
	it("should abstain if any authoritative retrieval route overflows", async function () {
		observations.stub(BibliographyMatcher, '_searchByIdentifiers')
			.resolves({ ids: [], incomplete: false });
		observations.stub(BibliographyMatcher, '_searchTitleCandidates')
			.resolves({ ids: [], incomplete: true });
		
		let result = await BibliographyMatcher.matchLibrary(
			'Lovelace. 2021. Reliable matching across diverse bibliographies.',
			Zotero.Libraries.userLibraryID
		);
		assert.equal(result.status, 'incomplete');
		assert.equal(result.reason, 'retrieval-limit');
	});
	
	it("should retain a strong match when every omitted title candidate is provably weaker", async function () {
		observations.stub(BibliographyMatcher, 'MAX_CANDIDATES').value(1);
		let scoring = observations.spy(BibliographyMatcher, '_evaluate');
		let target = await createItem(article({
			title: 'Distinctive local matching across bibliographies',
		}));
		for (let i = 0; i < 2; i++) {
			await createItem(article({
				title: `Noisy bibliographies record ${i}`,
				creators: [{ creatorType: 'author', firstName: 'Other', lastName: `Author${i}` }],
				date: '1990',
			}));
		}
		
		let result = await BibliographyMatcher.matchLibrary(
			'Lovelace, A. 2021. Distinctive local matching across bibliographies.',
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'matched');
		assert.equal(result.item.id, target.id);
		assert.equal(scoring.callCount, 1, 'Provably weak titles need no full metadata scoring');
		assert.property(result, 'item');
	});
	
	it("should exclude standalone nonregular items before ranking the library candidate pool", async function () {
		observations.stub(BibliographyMatcher, 'MAX_CANDIDATES').value(1);
		for (let i = 0; i < 2; i++) {
			let attachment = new Zotero.Item('attachment');
			attachment.libraryID = Zotero.Libraries.userLibraryID;
			attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_URL;
			attachment.setField('url', `https://example.invalid/attachment-${i}`);
			attachment.setField('title', article().title);
			await attachment.saveTx();
			items.push(attachment);
		}
		assert.equal((await BibliographyMatcher.checkForDuplicate(
			BibliographyMatcher.createCandidateSnapshot(article()), Zotero.Libraries.userLibraryID
		)).status, 'absent');
		let target = await createItem(article());
		let duplicate = await BibliographyMatcher.checkForDuplicate(
			BibliographyMatcher.createCandidateSnapshot(article()), Zotero.Libraries.userLibraryID
		);
		assert.equal(duplicate.status, 'matched');
		assert.equal(duplicate.item.id, target.id);
		let result = await BibliographyMatcher.matchLibrary(
			'Ada Lovelace. 2021. Reliable matching across diverse bibliographies.',
			Zotero.Libraries.userLibraryID
		);
		assert.equal(result.status, 'matched');
		assert.equal(result.item.id, target.id);
	});
	
	it("should skip creator-only candidates without losing a strong title match", async function () {
		observations.stub(BibliographyMatcher, 'MAX_CANDIDATES').value(1);
		let scoring = observations.spy(BibliographyMatcher, '_evaluate');
		let creators = [
			{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
			{ creatorType: 'author', firstName: 'Charles', lastName: 'Babbage' },
		];
		let target = await createItem(article({ creators }));
		for (let i = 0; i < 2; i++) {
			await createItem(article({ title: `Unrelated record ${i}`, creators }));
		}
		let winner = await BibliographyMatcher.matchLibrary(
			'Ada Lovelace; Charles Babbage. 2021. Reliable matching across diverse bibliographies.',
			Zotero.Libraries.userLibraryID
		);
		assert.equal(winner.status, 'matched');
		assert.equal(winner.item.id, target.id);
		assert.isBelow(scoring.callCount, items.length);
		scoring.resetHistory();
		let ambiguous = await BibliographyMatcher.matchLibrary(
			'Ada Lovelace; Charles Babbage. 2021.', Zotero.Libraries.userLibraryID
		);
		assert.equal(ambiguous.status, 'unmatched');
		assert.equal(scoring.callCount, 0);
	});
	
	describe('adaptive library candidate evaluation', function () {
		const reference = 'Ada Lovelace; Charles Babbage. 2021. Reliable matching across diverse bibliographies.';
		let creators = [
			{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
			{ creatorType: 'author', firstName: 'Charles', lastName: 'Babbage' },
		];
		// Library title matching must span several batches even above the transient pool limit.
		beforeEach(function () {
			observations.stub(BibliographyMatcher, 'MAX_CANDIDATES').value(3);
			observations.stub(BibliographyMatcher, 'CANDIDATE_BATCH_SIZE').value(4);
		});
		
		async function distractors() {
			for (let i = 0; i < 10; i++) {
				await createItem(article({
					title: `Reliable matching across diverse bibliographies ${i}`,
					date: '1990',
					creators: [{ creatorType: 'author', firstName: 'Other', lastName: `Researcher${i}` }],
				}));
			}
		}
		
		it('should finish a multi-batch negative search instead of treating the first batch as final', async function () {
			await distractors();
			let evaluate = observations.spy(BibliographyMatcher, '_evaluate');
			let result = await BibliographyMatcher.matchLibrary(reference, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'unmatched');
			assert.equal(result.reason, 'insufficient-evidence');
			assert.equal(evaluate.callCount, 10);
			assert.notProperty(result, 'item');
		});
		
		it('should recover a strict target beyond the first batch of optimistic title bounds', async function () {
			let scoring = observations.spy(BibliographyMatcher, '_evaluate');
			for (let i = 0; i < 10; i++) {
				await createItem(article({ date: '1990', creators: [] }));
			}
			let target = await createItem(article({ creators }));
			let result = await BibliographyMatcher.matchLibrary(reference, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'matched');
			assert.equal(result.item.id, target.id);
			assert.equal(scoring.callCount, 11);
		});
		
		it('should withhold a late approximate title with insufficient evidence', async function () {
			let scoring = observations.spy(BibliographyMatcher, '_evaluate');
			await distractors();
			await createItem(article({ title: 'Reliable local matching across diverse bibliographies', creators }));
			let result = await BibliographyMatcher.matchLibrary(reference, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'unmatched');
			assert.notProperty(result, 'item');
			
			assert.equal(scoring.callCount, 11);
		});
		
		it('should withhold late competing approximate titles', async function () {
			await distractors();
			let title = 'Reliable matching across diverse bibliographies with efficient retrieval of existing research '
				+ 'records from large scientific libraries and digital scholarly collections';
			let text = `Ada Lovelace; Charles Babbage. 2021. ${title}.`;
			let target = await createItem(article({ title: title.replace('Reliable matching', 'Reliable local matching'), creators }));
			let competitor = await createItem(article({ title: title.replace('Reliable matching', 'Reliable automatic matching'), creators }));
			for (let candidate of [target, competitor]) {
				assert.equal(evaluate(text, [candidate]).status, 'matched');
			}
			let scoring = observations.spy(BibliographyMatcher, '_evaluate');
			let result = await BibliographyMatcher.matchLibrary(text, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'unmatched');
			assert.equal(result.reason, 'ambiguous');
			assert.notProperty(result, 'item');
			assert.equal(scoring.callCount, 12);
		});
		
		it('should abstain when the evaluation budget expires with candidates still unevaluated', async function () {
			await distractors();
			await createItem(article({ title: 'Unrelated omitted title', creators }));
			let matcher = BibliographyMatcher;
			observations.stub(matcher, 'MAX_EVALUATION_DURATION_MS').value(2000);
			let evaluate = matcher._evaluate;
			let evaluated = 0;
			observations.stub(matcher, '_evaluate').callsFake(function (...args) {
				let result = evaluate.apply(this, args);
				// Expire the deadline deterministically in the matcher's own realm.
				if (++evaluated === matcher.CANDIDATE_BATCH_SIZE) matcher.MAX_EVALUATION_DURATION_MS = 0;
				return result;
			});
			let result = await matcher.matchLibrary(reference, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'incomplete');
			assert.equal(result.reason, 'evaluation-time-limit');
			assert.equal(evaluated, matcher.CANDIDATE_BATCH_SIZE);
			assert.notProperty(result, 'item');
		});
		
		it('should not score or accept loaded candidates after their load exhausts the budget', async function () {
			await distractors();
			let matcher = BibliographyMatcher;
			observations.stub(matcher, 'MAX_EVALUATION_DURATION_MS').value(2000);
			let load = matcher._loadLibraryCandidates;
			observations.stub(matcher, '_loadLibraryCandidates').callsFake(async function (...args) {
				let result = await load.apply(this, args);
				matcher.MAX_EVALUATION_DURATION_MS = 0;
				return result;
			});
			let evaluate = observations.spy(matcher, '_evaluate');
			let result = await matcher.matchLibrary(reference, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'incomplete');
			assert.isFalse(evaluate.called);
			assert.notProperty(result, 'item');
		});
		
		it('should preserve competitive field incompleteness after finishing the candidate union', async function () {
			let scoring = observations.spy(BibliographyMatcher, '_evaluate');
			await distractors();
			await createItem(article({
				title: article().title,
				creators,
				publicationTitle: 'x'.repeat(BibliographyMatcher.MAX_MATCH_TEXT_LENGTH + 1),
			}));
			let result = await BibliographyMatcher.matchLibrary(reference, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'incomplete');
			assert.equal(result.reason, 'metadata-limit');
			assert.equal(scoring.callCount, 11);
			assert.notProperty(result, 'item');
		});
		
		it('should yield to an event-loop cancellation while scoring candidates', async function () {
			await distractors();
			let matcher = BibliographyMatcher;
			let controller = new AbortController();
			let evaluate = matcher._evaluate;
			let evaluated = 0;
			observations.stub(matcher, '_evaluate').callsFake(function (...args) {
				if (++evaluated === 1) {
					setTimeout(() => controller.abort(), 0);
					// Ensure this pass crosses the cooperative yield interval even on fast hosts.
					let started = Date.now();
					while (Date.now() - started < 20) {}
				}
				return evaluate.apply(this, args);
			});
			let error = await getPromiseError(matcher.matchLibrary(reference, Zotero.Libraries.userLibraryID,
				{ signal: controller.signal }));
			assert.equal(error?.name, 'AbortError');
			assert.isBelow(evaluated, matcher.CANDIDATE_BATCH_SIZE);
		});
		
		it('should stop before evaluating the next batch when its load is cancelled', async function () {
			await distractors();
			let matcher = BibliographyMatcher;
			let controller = new AbortController();
			let load = matcher._loadLibraryCandidates;
			let calls = 0;
			observations.stub(matcher, '_loadLibraryCandidates').callsFake(async function (...args) {
				let result = await load.apply(this, args);
				if (++calls === 2) controller.abort();
				return result;
			});
			let evaluate = observations.spy(matcher, '_evaluate');
			let error = await getPromiseError(matcher.matchLibrary(reference, Zotero.Libraries.userLibraryID,
				{ signal: controller.signal }));
			assert.equal(error?.name, 'AbortError');
			assert.equal(evaluate.callCount, matcher.CANDIDATE_BATCH_SIZE);
		});
		
		it('should account for a candidate deleted between retrieval and loading', async function () {
			let scoring = observations.spy(BibliographyMatcher, '_evaluate');
			await distractors();
			let removed = items[0];
			let matcher = BibliographyMatcher;
			let load = matcher._loadLibraryCandidates;
			let calls = 0;
			observations.stub(matcher, '_loadLibraryCandidates').callsFake(async function (...args) {
				if (++calls === 1) {
					removed.deleted = true;
					await removed.saveTx();
				}
				return load.apply(this, args);
			});
			let result = await matcher.matchLibrary(reference, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'unmatched');
			assert.equal(scoring.callCount, 9);
		});
		
		it('should reuse identifier-route evaluations while extending the candidate union', async function () {
			await distractors();
			let matcher = BibliographyMatcher;
			observations.stub(matcher, '_searchByIdentifiers').resolves({ ids: [items[0].id], incomplete: false });
			let evaluate = observations.spy(matcher, '_evaluate');
			let result = await matcher.matchLibrary(reference, Zotero.Libraries.userLibraryID);
			assert.equal(result.status, 'unmatched');
			assert.equal(evaluate.callCount, 10);
		});
	});
	
	it("should never truncate an overflowing transient candidate set into a winner", function () {
		let candidates = Array.from(
			{ length: BibliographyMatcher.MAX_CANDIDATES + 1 },
			() => article()
		);
		let result = evaluate('Reliable matching across diverse bibliographies', candidates);
		
		assert.equal(result.status, 'incomplete');
		assert.equal(result.reason, 'candidate-overflow');
	});
	
	it("should not discard an unreadable transient competitor and certify the remaining candidate", function () {
		for (let invalid of [null, { itemType: 'unknown-item-type' }]) {
			let result = evaluate('DOI: 10.1234/unreadable-pool', [article({ DOI: '10.1234/unreadable-pool' }), invalid]);
			assert.equal(result.status, 'incomplete');
			assert.equal(result.reason, 'invalid-candidate');
			assert.notProperty(result, 'item');
		}
	});
	
	it("should reject an excessive identifier probe set before querying", async function () {
		let reference = Array.from(
			{ length: BibliographyMatcher.MAX_IDENTIFIER_PROBES + 1 },
			(_, index) => `PMID: ${100000 + index}`
		).join('; ');
		let queries = ['queryAsync', 'columnQueryAsync'].map(method => observations.spy(Zotero.DB, method));
		let result = await BibliographyMatcher.matchLibrary(
			reference,
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.status, 'incomplete');
		assert.equal(result.reason, 'retrieval-limit');
		assert.isTrue(queries.every(query => !query.called));
	});
	
	it("should reject oversized references before querying", async function () {
		let queries = ['queryAsync', 'columnQueryAsync'].map(method => observations.spy(Zotero.DB, method));
		let result = await BibliographyMatcher.matchLibrary(
			'x'.repeat(BibliographyMatcher.MAX_MATCH_TEXT_LENGTH + 1),
			Zotero.Libraries.userLibraryID
		);
		
		assert.equal(result.reason, 'invalid-input');
		assert.isTrue(queries.every(query => !query.called));
	});
});
