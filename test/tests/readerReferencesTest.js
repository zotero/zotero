"use strict";

var { BibliographyMatcher } = ChromeUtils.importESModule('chrome://zotero/content/xpcom/bibliographyMatcher.mjs');
var { ReaderReferenceSession, referenceSaver, onlineReferenceLookup } = ChromeUtils.importESModule('chrome://zotero/content/xpcom/readerReferences.mjs');

describe("Reader reference sessions and actions", function () {
	let sandbox;
	let objects;
	let sessions;
	
	beforeEach(function () {
		sandbox = sinon.createSandbox();
		objects = [];
		sessions = [];
		sandbox.stub(onlineReferenceLookup, '_translateLandingPage').resolves([]);
	});
	
	afterEach(async function () {
		for (let session of sessions) session.dispose();
		sandbox.restore();
		Zotero.Prefs.clear('downloadAssociatedFiles');
		
		for (let object of objects.reverse()) {
			if (object.id && Zotero.Items.exists(object.id)) {
				await object.eraseTx();
			}
		}
	});
	
	function stubOnlineCandidates(items) {
		return sandbox.stub(onlineReferenceLookup, 'findOnline').callsFake(async reference => (
			BibliographyMatcher.matchCandidates(reference, items)
		));
	}
	
	async function createItem(data = {}) {
		let item = new Zotero.Item(data.itemType || 'journalArticle');
		item.libraryID = Zotero.Libraries.userLibraryID;
		item.fromJSON({
			itemType: 'journalArticle',
			title: 'Reliable matching across diverse bibliographies',
			creators: [
				{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
			],
			date: '2021',
			publicationTitle: 'Journal of Bibliographic Systems',
			DOI: '10.1234/general.42',
			url: 'https://example.invalid/article',
			...data,
		});
		await item.saveTx();
		objects.push(item);
		return item;
	}
	
	async function createAttachment() {
		let attachment = new Zotero.Item('attachment');
		attachment.libraryID = Zotero.Libraries.userLibraryID;
		attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_URL;
		attachment.attachmentContentType = 'application/pdf';
		attachment.setField('title', 'Source PDF');
		attachment.setField('url', 'https://example.invalid/source.pdf');
		await attachment.saveTx();
		objects.push(attachment);
		return attachment;
	}
	
	function strictMatch(item) {
		return { status: 'matched', item };
	}
	
	function unmatched() {
		return { status: 'unmatched', reason: 'no-candidates' };
	}
	
	function cacheMatch(session, text, match) {
		session._onlineMatchCache.set(text, JSON.stringify(BibliographyMatcher.createCandidateSnapshot(match.item)));
	}
	
	function bindingFor(session, resultID) {
		return [...session._references.values()].find(reference => reference.result?.resultID === resultID)?.result;
	}
	
	it("should preserve lookup failures and distinguish them from a completed no-match", async function () {
		let matcher = sandbox.stub(BibliographyMatcher, 'matchLibrary');
		let session = await createSession();
		for (let [match, expected] of [
			[{ status: 'unmatched', reason: 'no-candidates' }, 'no-match'],
			[{ status: 'unmatched', reason: 'invalid-input' }, 'invalid'],
			...['incomplete', 'offline', 'rate-limited', 'timeout', 'cancelled', 'error', 'invalid']
				.map(status => [{ status }, status]),
			[{ status: 'unexpected' }, 'error'],
		]) {
			matcher.resolves({ ...match });
			let response = await session.matchReference({ requestID: 'lookup-outcome', sourceKey: 'reference',
				referenceParts: [{ text: 'A bibliographic reference' }] });
			assert.equal(response.status, expected);
			assert.notProperty(response, 'result');
		}
	});
	
	function assertDisplayTextSafety(response) {
		let result = response.result;
		if (!result) return;
		let display = result.display;
		assert.notProperty(display, 'url');
		assert.notProperty(result, 'viewURL');
		assert.notProperty(result, 'evidence');
		for (let value of [display.title, display.firstCreator]) {
			assert.isAtMost(String(value ?? '').length, ReaderReferenceSession.MAX_DISPLAY_FIELD_LENGTH);
			assert.notMatch(String(value ?? ''), /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u);
		}
		assert.isAtMost((display.abstract || '').length, ReaderReferenceSession.MAX_ABSTRACT_LENGTH);
		assert.notMatch(display.abstract || '', /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u);
	}
	
	async function createSession() {
		let attachment = await createAttachment();
		let session = new ReaderReferenceSession(attachment);
		sessions.push(session);
		return session;
	}
	
	it("should leave chapter fallbacks available and cache only the verified online work", async function () {
		let book = await createItem({
			itemType: 'book', title: 'The Ethics of Belief', date: '2014', DOI: '', url: '',
			publisher: 'Oxford University Press', creators: [
				{ creatorType: 'editor', firstName: 'Jonathan', lastName: 'Matheson' },
				{ creatorType: 'editor', firstName: 'Rico', lastName: 'Vitz' },
			],
		});
		let provider = sandbox.stub(onlineReferenceLookup, '_translateSearch');
		for (let [firstName, lastName, title, text] of [
			[
				'Dennis',
				'Whitcomb',
				'Can There Be a Knowledge-First Ethics of Belief?',
				'Whitcomb, D. (2014). Can There Be a Knowledge-First Ethics of Belief? '
					+ 'In: Matheson, J.; Vitz, R. (eds.), The Ethics of Belief. Oxford: Oxford University Press. pp. 93-112.',
			],
			[
				'Jonathan',
				'Matheson',
				'Evidence and epistemic duty in recent debates',
				'Matheson, J. (2014). Evidence and epistemic duty in recent debates. '
					+ 'In J. Matheson & R. Vitz (Eds.), The Ethics of Belief (pp. 93–112). Oxford University Press.',
			],
		]) {
			let chapter = {
				itemType: 'bookSection', title, bookTitle: book.getField('title'), date: '2014', pages: '93-112',
				creators: [{ creatorType: 'author', firstName, lastName }],
			};
			let referenceParts = [{ text }];
			provider.resolves([book.toJSON()]).resetHistory();
			let session = await createSession();
			let local = await session.matchReference({ requestID: 'chapter-local', sourceKey: 'chapter', referenceParts });
			assert.equal(local.status, 'no-match');
			assert.notProperty(local, 'result');
			assert.isFalse(provider.called, 'Local lookup never starts the online fallback');
			let online = await session.findOnline({ requestID: 'chapter-online', referenceKey: local.referenceKey });
			assert.equal(online.status, 'no-match');
			assert.equal(session._onlineMatchCache.size, 0, 'The containing book must not be cached');
			provider.resolves([{ ...book.toJSON(), creators: [] }, chapter]);
			let found = await session.findOnline({ requestID: 'chapter-correct', referenceKey: local.referenceKey });
			assert.equal(found.status, 'strong');
			assert.equal(found.result.display.title, chapter.title);
			assert.equal(session._onlineMatchCache.size, 1);
			let reopened = await session.matchReference({ requestID: 'chapter-reopen', sourceKey: 'chapter', referenceParts });
			assert.equal(reopened.status, 'strong');
			assert.equal(reopened.lookupSource, 'online');
			assert.equal(reopened.result.display.title, chapter.title);
			assert.equal(provider.callCount, 2, 'Reopening reuses only the verified chapter metadata');
		}
	});
	
	it("should classify lookup errors consistently", function () {
		let transport = (type, fields = {}) => Object.assign(Object.create(Zotero.HTTP[type].prototype), fields);
		for (let [error, expected] of [
			[null, 'error'],
			[undefined, 'error'],
			[new Error('ordinary failure'), 'error'],
			[transport('CancelledException', { status: 429 }), 'cancelled'],
			[{ name: 'AbortError', status: 408 }, 'cancelled'],
			[transport('TimeoutException', { status: 429 }), 'timeout'],
			[transport('BrowserOfflineException', { status: 429 }), 'offline'],
			[transport('UnexpectedStatusException', { status: 429 }), 'rate-limited'],
			[transport('UnexpectedStatusException', { status: 408 }), 'timeout'],
			[transport('UnexpectedStatusException', { status: 500 }), 'error'],
			[{ status: 429 }, 'rate-limited'],
			[{ status: 408 }, 'timeout'],
			[{ name: 'TimeoutError' }, 'timeout'],
			[{ name: 'TimeoutError', status: 429 }, 'rate-limited'],
			[transport('UnexpectedStatusException', { name: 'TimeoutError', status: 500 }), 'timeout'],
			[{ status: '429' }, 'error'],
		]) {
			assert.equal(onlineReferenceLookup.errorStatus(error), expected);
		}
	});
	
	async function waitForCacheOperation(callback) {
		for (let attempt = 0; attempt < 100; attempt++) {
			if (callback()) return;
			await Zotero.Promise.delay(0);
		}
		throw new Error('Cache operation did not reach its asynchronous boundary');
	}
	
	it("should resolve reference lookup and action messages from Zotero's Fluent resources", function () {
		let keys = ['popup',
			'expand',
			'collapse',
			'no-match',
			'error',
			'retry',
			'find-online',
			'existing',
			'action-add-to-library',
			'action-open-attachment']
			.map(key => `reader-reference-${key}`);
		for (let key of [...keys, 'general-back', 'general-loading', 'general-show-in-library', 'view-online']) {
			let value = Zotero.ftl.formatValueSync(key);
			assert.isString(value);
			assert.isNotEmpty(value);
			assert.notEqual(value, key);
		}
	});
	
	it("should accept type-mapped titles in plain metadata and native snapshots", function () {
		for (let itemType of ['case', 'email', 'statute']) {
			let field = Zotero.ItemFields.getName(Zotero.ItemFields.getFieldIDFromTypeAndBase(itemType, 'title'));
			let input = { itemType, [field]: `Mapped ${itemType} title` };
			let item = new Zotero.Item(itemType);
			item.fromJSON(input);
			let snapshot = BibliographyMatcher.createCandidateSnapshot(input);
			assert.equal(snapshot[field], input[field]);
			assert.deepEqual(BibliographyMatcher.createCandidateSnapshot(item), snapshot);
			assert.deepEqual(BibliographyMatcher.createCandidateSnapshot({ itemType, title: input[field] }), snapshot);
			assert.throws(() => BibliographyMatcher.createCandidateSnapshot({ itemType }), 'required bibliographic fields');
		}
	});
	
	it("should bound total serialized candidate metadata rather than individual fields or creator count", function () {
		let limit = BibliographyMatcher.MAX_CANDIDATE_JSON_LENGTH;
		let fields = Zotero.ItemFields.getAll();
		// Reinitializing Zotero's field catalog can repeat allowlisted names.
		sandbox.stub(Zotero.ItemFields, 'getAll').returns([...fields, ...fields]);
		for (let metadata of [
			{ abstractNote: 'x'.repeat(limit / 2), title: 'y'.repeat(limit / 2) },
			{ abstractNote: '\\'.repeat(limit / 2) },
			{ creators: [{ creatorType: 'author', firstName: 'A'.repeat(limit / 2), lastName: 'B'.repeat(limit / 2) }] },
			{ creators: Array.from({ length: limit / 2 }, () => ({})) },
		]) {
			assert.throws(() => BibliographyMatcher.createCandidateSnapshot({
				itemType: 'journalArticle', title: 'Payload budget', ...metadata,
			}), 'candidate payload limit');
		}
		let allowed = { itemType: 'journalArticle', title: 'Complete fields',
			abstractNote: 'a'.repeat(limit / 4), creators: [{ creatorType: 'author', name: 'A research collaboration' }] };
		assert.equal(BibliographyMatcher.createCandidateSnapshot(allowed).abstractNote, allowed.abstractNote);
		let boundary = BibliographyMatcher.createCandidateSnapshot({ ...allowed, abstractNote: 'x' });
		boundary.abstractNote = 'x'.repeat(limit - JSON.stringify(boundary).length + 1);
		assert.equal(JSON.stringify(boundary).length, limit);
		assert.deepEqual(BibliographyMatcher.createCandidateSnapshot(boundary), boundary);
		assert.throws(() => BibliographyMatcher.createCandidateSnapshot({ ...boundary, abstractNote: boundary.abstractNote + 'x' }),
			'candidate payload limit');
	});
	
	it("should snapshot canonical Items without rebuilding them or retaining non-bibliographic data", function () {
		let input = { itemType: 'journalArticle', title: 'Canonical snapshot', DOI: '10.1234/snapshot',
			creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }],
			tags: [{ tag: 'Not metadata' }], collections: [], relations: {}, };
		let expected = BibliographyMatcher.createCandidateSnapshot(input);
		let item = new Zotero.Item(input.itemType);
		item.fromJSON(input);
		let original = item.toJSON();
		let fromJSON = sinon.spy(Zotero.Item.prototype, 'fromJSON');
		try {
			let snapshot = BibliographyMatcher.createCandidateSnapshot(item);
			assert.deepEqual(snapshot, expected);
			assert.isFalse(fromJSON.called);
			assert.notProperty(snapshot, 'tags');
			assert.notProperty(snapshot, 'collections');
			assert.notProperty(snapshot, 'relations');
			snapshot.title = 'Changed snapshot';
			snapshot.creators[0].firstName = 'Changed creator';
			assert.deepEqual(item.toJSON(), original);
			item.setField('abstractNote', 'x'.repeat(BibliographyMatcher.MAX_CANDIDATE_JSON_LENGTH));
			assert.throws(() => BibliographyMatcher.createCandidateSnapshot(item), 'candidate payload limit');
			assert.throws(() => BibliographyMatcher.createCandidateSnapshot(new Zotero.Item('attachment')),
				'not a bibliographic item');
		}
		finally {
			fromJSON.restore();
		}
	});
	
	it("should preserve first-class PMID candidate identity", function () {
		let candidate = {
			itemType: 'journalArticle',
			title: 'Biodiversity Loss and Its Impact on Humanity',
			PMID: '22678280',
		};
		let sanitized = BibliographyMatcher.createCandidateSnapshot(candidate);
		
		assert.equal(sanitized.PMID, '22678280');
		assert.include(BibliographyMatcher.getCandidateKey(sanitized), '22678280');
		assert.lengthOf(BibliographyMatcher.deduplicateCandidates([
			candidate,
			{ ...candidate, title: 'Different metadata for the same PMID' },
		]), 1);
	});
	
	it("should withhold tentative local candidates instead of displaying a browsable list", async function () {
		let item = await createItem({ DOI: '' });
		let session = await createSession();
		let response = await session.matchReference({ requestID: 'weak', sourceKey: 'reference',
			referenceParts: [{ text: item.getField('title') }] });
		assert.equal(response.status, 'no-match');
		assert.notProperty(response, 'result');
		assert.notProperty(session._references.get(response.referenceKey), 'result');
	});
	
	it("should match a first-class PMID without exposing unused display identifiers", async function () {
		let item = await createItem({ DOI: '', url: '', PMID: '22678280' });
		let session = await createSession();
		let prepareReference = sandbox.spy(BibliographyMatcher, 'prepareReference');
		
		let response = await session.matchReference({
			requestID: 'local-pmid',
			sourceKey: 'reference-pmid',
			referenceParts: [{ text: 'PMID: 22678280' }],
		});
		
		assert.equal(response.status, 'strong');
		assert.equal(response.result.libraryState, 'existing');
		assert.notProperty(response.result.display, 'identifiers');
		assert.equal(response.result.display.title, item.getField('title'));
		assert.isTrue(prepareReference.calledOnce, 'The session must not repeat the matcher\'s citation analysis');
	});
	
	it("should propagate independent local lookup signals and suppress normal cancellation errors", async function () {
		let session = await createSession();
		let pending = [];
		sandbox.stub(BibliographyMatcher, 'matchLibrary').callsFake((reference, libraryID, options) => new Promise((resolve, reject) => {
			pending.push({ signal: options?.signal, resolve, reject });
			options?.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
		}));
		let log = sandbox.spy(Zotero, 'logError');
		let first = session.matchReference({ requestID: 'cancel-local-first', sourceKey: 'primary:first', referenceParts: [{ text: 'First reference' }] });
		let second = session.matchReference({ requestID: 'cancel-local-second', sourceKey: 'secondary:second', referenceParts: [{ text: 'Second reference' }] });
		try {
			await waitForCacheOperation(() => pending.length === 2);
			assert.isOk(pending[0].signal);
			assert.isOk(pending[1].signal);
			assert.notStrictEqual(pending[0].signal, pending[1].signal);
			session.cancel({ requestID: 'cancel-local-first' });
			assert.isTrue(pending[0].signal.aborted);
			assert.isFalse(pending[1].signal.aborted);
			pending[1].resolve(unmatched());
			assert.equal((await first).status, 'cancelled');
			assert.equal((await second).status, 'no-match');
			assert.isFalse(log.called);
		}
		finally {
			session.dispose();
			for (let operation of pending) operation.resolve(unmatched());
			await Promise.allSettled([first, second]);
		}
	});
	
	it("should keep popup-open matching local and return only sanitized DTOs", async function () {
		let item = await createItem();
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(strictMatch(item));
		let translate = sandbox.spy(Zotero.Translate.Search.prototype, 'translate');
		let http = sandbox.spy(Zotero.HTTP, 'request');
		
		let response = await session.matchReference({
			requestID: 'local-1',
			sourceKey: 'page-3-reference-7',
			referenceParts: [{
				text: 'Lovelace. 2021. Reliable matching. ',
				attributes: { url: 'https://doi.org/10.1234/general.42' },
			}],
		});
		
		assert.equal(response.status, 'strong');
		assert.equal(response.requestID, 'local-1');
		assert.hasAllKeys(response, ['requestID', 'referenceKey', 'status', 'result']);
		assert.hasAllKeys(response.result, ['resultID', 'libraryState', 'actions', 'display']);
		assert.hasAllKeys(response.result.display, ['itemType', 'title', 'firstCreator', 'year']);
		assert.equal(response.result.display.title, item.getField('title'));
		assert.equal(response.result.display.firstCreator, item.getField('firstCreator'));
		assert.notProperty(response, 'sourceKey');
		assert.match(response.referenceKey, /^[0-9a-f-]+$/i);
		assert.isObject(response.result);
		assert.notProperty(response.result.display, 'identifiers');
		assert.notProperty(response.result.display, 'url');
		assert.notProperty(response.result, 'itemID');
		assert.notProperty(response.result, 'libraryID');
		assert.notInclude(JSON.stringify(response), 'https://example.invalid/article');
		assert.isFalse(translate.called);
		assert.isFalse(http.called);
	});
	
	it("should reuse localized creator summaries for saved and unsaved items without changing creator data", async function () {
		let session = await createSession();
		let author = lastName => ({ creatorType: 'author', firstName: 'Given', lastName });
		let cases = [
			{ creators: [author('One')], expected: 'One' },
			{ creators: [author('One'), author('Two')],
				expected: Zotero.getString('general.andJoiner', ['\u2068One\u2069', '\u2068Two\u2069']) },
			{ creators: [author('One'), author('Two'), author('Three')], expected: `One ${Zotero.getString('general.etAl')}` },
			{ creators: [{ creatorType: 'author', name: 'Example Organization' }], expected: 'Example Organization' },
			{ itemType: 'book', creators: [{ creatorType: 'editor', firstName: 'Ed', lastName: 'Editor' }], expected: 'Editor' },
			{ itemType: 'film', creators: [{ creatorType: 'director', firstName: 'Film', lastName: 'Director' }], expected: 'Director' },
			{ creators: [{ creatorType: 'contributor', firstName: 'A', lastName: 'Contributor' }], expected: 'Contributor' },
			{ creators: [], expected: '' },
		];
		for (let { expected, ...data } of cases) {
			let saved = await createItem(data);
			let unsaved = new Zotero.Item(saved.itemTypeID);
			unsaved.fromJSON(saved.toJSON());
			for (let item of [saved, unsaved]) {
				let creators = item.getCreators();
				let display = session._getDisplayMetadata(item);
				assert.equal(display.firstCreator, expected);
				assert.equal(display.firstCreator, item.getField('firstCreator'));
				assert.deepEqual(item.getCreators(), creators);
				assert.notProperty(display, 'creators');
			}
		}
	});
	
	it("should use the standard display year without changing stored dates", async function () {
		let session = await createSession();
		for (let date of ['1492', '2101', '2020-05-02', '']) {
			let saved = await createItem({ date });
			let unsaved = new Zotero.Item(saved.itemTypeID);
			unsaved.fromJSON(saved.toJSON());
			for (let item of [saved, unsaved]) {
				let storedDate = item.getField('date', true, true);
				assert.equal(session._getDisplayMetadata(item).year, item.getField('year'));
				assert.equal(item.getField('date', true, true), storedDate);
				if (date === '1492' || date === '2101') assert.equal(session._getDisplayMetadata(item).year, date);
			}
		}
	});
	
	it("should preserve item metadata as literal display text rather than extracted citation text", async function () {
		let title = 'Research on Node.js systems';
		let abstract = 'Sources: https://example.org/data?q=1, editor@example.org. '
			+ '<a href="https://example.org/link">literal link</a> '
			+ '<script>alert("literal")</script> x < y. Empty notation () [] {} stays.';
		let item = await createItem({ title, abstractNote: abstract });
		let stored = item.toJSON();
		let session = await createSession();
		let referenceParts = [{ text: 'Damaged PDF citation title. DOI: 10.1234/general.42' }];
		let network = ['request', 'doGet', 'doPost'].map(method => (
			sandbox.stub(Zotero.HTTP, method).throws(new Error('Display projection must not use HTTP'))
		));
		let loadURI = sandbox.stub();
		let viewAttachment = sandbox.stub();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { loadURI, viewAttachment } });
		let provider = sandbox.spy(onlineReferenceLookup, 'findOnline');
		let response = await session.matchReference({ requestID: 'literal-item-display',
			sourceKey: 'raw-pdf-reference', referenceParts });
		assert.equal(response.status, 'strong');
		assert.equal(response.result.display.title, title);
		assert.equal(response.result.display.abstract, abstract);
		assertDisplayTextSafety(response);
		assert.equal(session._references.get(response.referenceKey).text, referenceParts.map(part => part.text).join(''));
		assert.deepEqual(item.toJSON(), stored, 'Display projection must not alter stored metadata');
		assert.isTrue(network.every(method => !method.called));
		assert.isFalse(provider.called);
		assert.isFalse(loadURI.called);
		assert.isFalse(viewAttachment.called);
	});
	
	it("should preserve link-shaped text in every bibliographic display field", async function () {
		let cases = [
			{
				name: 'title',
				data: { title: 'Readable title (HTTPS://Example.org/Title?q=1), retained' },
				field: 'title',
				expected: 'Readable title (HTTPS://Example.org/Title?q=1), retained',
			},
			{
				name: 'creator',
				data: { creators: [{
					creatorType: 'author', firstName: 'Ada',
					lastName: 'Lovelace FTP://Files.Example.org/archive.zip.',
				}] },
				field: 'firstCreator',
				expected: 'Lovelace FTP://Files.Example.org/archive.zip.',
			},
			{
				name: 'abstract',
				data: {
					abstractNote: 'Tests at https://labelerrors.com and reproduced by '
						+ 'https://github.com/cleanlab/label-errors. Evidence remains.',
				},
				field: 'abstract',
				expected: 'Tests at https://labelerrors.com and reproduced by '
					+ 'https://github.com/cleanlab/label-errors. Evidence remains.',
			},
			{
				name: 'ordinary bibliography text',
				data: { title: 'Ordinary et.al, J. Biol., and DOI 10.1234/example remain' },
				field: 'title',
				expected: 'Ordinary et.al, J. Biol., and DOI 10.1234/example remain',
			},
			{
				name: 'protocol-relative Unicode punctuation',
				data: { title: 'Mirror（//Example.org/path）。 retained' },
				field: 'title',
				expected: 'Mirror（//Example.org/path）。 retained',
			},
			{
				name: 'supported title markup',
				data: { title: 'Growth of <i>Arabidopsis</i> under CO<sub>2</sub>' },
				field: 'title',
				expected: 'Growth of Arabidopsis under CO2',
			},
			{
				name: 'mathematical text within title markup',
				data: { title: '<i>0 < p ≤ 1</i> and Node.js' },
				field: 'title',
				expected: '0 < p ≤ 1 and Node.js',
			},
			{
				name: 'literal markup outside Zotero title formatting',
				data: { title: '<script>example</script> and <a>text</a>' },
				field: 'title',
				expected: '<script>example</script> and <a>text</a>',
			},
			{
				name: 'abstract markup remains plain content',
				data: { abstractNote: '<i>Evidence</i> at https://example.org/' },
				field: 'abstract',
				expected: '<i>Evidence</i> at https://example.org/',
			},
			{
				name: 'control characters and whitespace',
				data: {}, field: 'title', rawField: 'title',
				rawValue: '\u0000Research\u0001 on\tNode.js\u007F systems\n',
				expected: 'Research on Node.js systems',
			},
			{
				name: 'numeric zero',
				data: {},
				field: 'year',
				rawField: 'year',
				rawValue: 0,
				expected: '0',
			},
			{
				name: 'nullish value',
				data: {},
				field: 'year',
				rawField: 'year',
				rawValue: null,
				expected: '',
			},
		];
		
		let session = await createSession();
		for (let testCase of cases) {
			let item = new Zotero.Item('journalArticle');
			item.fromJSON({ itemType: 'journalArticle', ...testCase.data });
			if (testCase.rawField) {
				let originalGetField = item.getField.bind(item);
				sandbox.stub(item, 'getField').callsFake((field, ...args) => (
					field === testCase.rawField ? testCase.rawValue : originalGetField(field, ...args)
				));
			}
			let display = session._getDisplayMetadata(item);
			assert.deepEqual(display[testCase.field], testCase.expected, testCase.name);
			assertDisplayTextSafety({ result: { display } });
		}
	});
	
	it("should preserve complete container titles in every fallback position", function () {
		for (let fields of [
			{ itemType: 'journalArticle', publicationTitle: 'Journal of complete bibliographic metadata' },
			{ itemType: 'bookSection', bookTitle: 'Collected studies of complete bibliographic metadata' },
			{ itemType: 'conferencePaper', proceedingsTitle: 'Proceedings of complete bibliographic metadata' },
			{ itemType: 'webpage', websiteTitle: 'Website of complete bibliographic metadata' },
			{ itemType: 'blogPost', blogTitle: 'Blog of complete bibliographic metadata' },
			{ itemType: 'preprint', repository: 'Repository of complete bibliographic metadata' },
		]) {
			let item = new Zotero.Item(fields.itemType);
			item.fromJSON({ title: 'Container fallback', ...fields });
			let expected = Object.values(fields)[1];
			assert.equal(BibliographyMatcher._prepareMatchMetadata(item).container.raw, expected);
		}
	});
	
	it("should bound large raw display fields before sanitizing them", async function () {
		let item = await createItem({ DOI: '10.1234/bounded-display-input' });
		let originalGetField = item.getField.bind(item);
		let oversized = `Readable https://example.org/private ${'x'.repeat(1_000_000)}`;
		sandbox.stub(item, 'getField').callsFake((field, ...args) => (
			field === 'abstractNote' ? oversized : originalGetField(field, ...args)
		));
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(strictMatch(item));
		let session = await createSession();
		let started = Date.now();
		let response = await session.matchReference({
			requestID: 'bounded-display-input',
			sourceKey: 'bounded-display-input',
			referenceParts: [{ text: 'DOI: 10.1234/bounded-display-input' }],
		});
		let durationMS = Date.now() - started;
		
		assert.equal(response.status, 'strong');
		assert.isAtMost(
			response.result.display.abstract.length,
			ReaderReferenceSession.MAX_ABSTRACT_LENGTH
		);
		assert.isTrue(response.result.display.abstract.endsWith('…'));
		assertDisplayTextSafety(response);
		assert.include(response.result.display.abstract, 'https://example.org/private');
		assert.isBelow(durationMS, 1000);
	});
	
	it("should preserve literal online, saved, and reopened display text while keeping operational URLs private", async function () {
		let metadata = {
			itemType: 'journalArticle',
			title: 'URL boundary study HTTPS://Example.org/title retained',
			creators: [{
				creatorType: 'author', firstName: 'Ada',
				lastName: 'Lovelace ftp://files.example.org/creator',
			}],
			date: '2021',
			publicationTitle: 'Journal www.example.net/container',
			volume: '42 example.edu/volume',
			issue: '7 mailto:editor@example.org',
			pages: '10-20 https://example.dev/pages',
			DOI: '10.1234/url-boundary-regression',
			url: 'https://privileged.example/original',
			abstractNote: 'Test set errors can be viewed at https://labelerrors.com and reproduced by '
				+ 'https://github.com/cleanlab/label-errors. Mirror //example.org/results; '
				+ 'Unicode adjacent（HTTPS://Example.org/資料）。',
		};
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON(metadata);
		let attachment = await createAttachment();
		let session = new ReaderReferenceSession(attachment);
		let reopenedSession;
		let provider = stubOnlineCandidates([transient]);
		let loadURI = sandbox.stub();
		let network = ['request', 'doGet', 'doPost'].map(method => (
			sandbox.stub(Zotero.HTTP, method).throws(new Error('Display lifecycle fixture must not use HTTP'))
		));
		sandbox.stub(Zotero.Attachments, 'addFileFromURLs').resolves(false);
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { loadURI } });
		try {
			let local = await session.matchReference({
				requestID: 'url-boundary-local',
				sourceKey: 'url-boundary-reference',
				referenceParts: [{ text: `DOI: ${metadata.DOI}` }],
			});
			assert.equal(local.status, 'no-match');
			
			let online = await session.findOnline({
				requestID: 'url-boundary-online',
				referenceKey: local.referenceKey,
			});
			assert.equal(online.status, 'strong');
			assertDisplayTextSafety(online);
			assert.equal(online.result.display.title, metadata.title);
			assert.equal(online.result.display.abstract, metadata.abstractNote);
			assert.isFalse(loadURI.called, 'Projecting literal URLs must not navigate');
			let hidden = bindingFor(session, online.result.resultID);
			assert.equal(hidden.candidateJSON.abstractNote, metadata.abstractNote);
			assert.equal(hidden.candidateJSON.url, metadata.url);
			
			let viewed = await session.performAction({
				requestID: 'url-boundary-view',
				referenceKey: local.referenceKey,
				resultID: online.result.resultID,
				action: 'view-online',
			});
			assert.equal(viewed.status, 'ok');
			assert.isTrue(loadURI.calledOnceWithExactly(metadata.url));
			
			let added = await session.performAction({
				requestID: 'url-boundary-add',
				referenceKey: local.referenceKey,
				resultID: online.result.resultID,
				action: 'add-to-library',
			});
			let savedID = bindingFor(session, online.result.resultID)?.itemID;
			let saved = savedID && await Zotero.Items.getAsync(savedID);
			if (saved) objects.push(saved);
			assert.equal(added.status, 'saved');
			assertDisplayTextSafety({ result: added.result });
			assert.equal(added.result.display.abstract, metadata.abstractNote);
			for (let field of [
				'title', 'publicationTitle', 'volume', 'issue', 'pages', 'abstractNote', 'url',
			]) {
				assert.equal(saved.getField(field), metadata[field], `Saved ${field} was sanitized`);
			}
			assert.equal(saved.getCreators()[0].lastName, metadata.creators[0].lastName);
			
			reopenedSession = new ReaderReferenceSession(attachment);
			let reopened = await reopenedSession.matchReference({
				requestID: 'url-boundary-reopened-local',
				sourceKey: 'url-boundary-reopened-reference',
				referenceParts: [{ text: `DOI: ${metadata.DOI}` }],
			});
			assert.equal(reopened.status, 'strong');
			assertDisplayTextSafety(reopened);
			assert.equal(reopened.result.display.title, metadata.title);
			assert.equal(reopened.result.display.abstract, metadata.abstractNote);
			assert.equal(provider.callCount, 1);
			assert.isTrue(network.every(method => !method.called));
		}
		finally {
			reopenedSession?.dispose();
			session.dispose();
		}
	});
	
	it("should execute unsaved View Online without exposing its URL and reject cross-reference tokens", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle',
			title: 'Online-only result',
			DOI: '10.1234/online-only',
			url: 'https://example.invalid/online-only',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		stubOnlineCandidates([transient]);
		let loadURI = sandbox.stub();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { loadURI } });
		
		let first = await session.matchReference({
			requestID: 'local-view-1',
			sourceKey: 'reference-view-1',
			referenceParts: [{ text: 'doi:10.1234/online-only' }],
		});
		let online = await session.findOnline({
			requestID: 'online-view-1', referenceKey: first.referenceKey,
		});
		assert.include(online.result.actions, 'view-online');
		assert.notInclude(JSON.stringify(online), 'https://example.invalid/online-only');
		let viewed = await session.performAction({
			requestID: 'action-view-1',
			referenceKey: first.referenceKey,
			resultID: online.result.resultID,
			action: 'view-online',
		});
		assert.equal(viewed.status, 'ok');
		assert.notInclude(JSON.stringify(viewed), 'https://example.invalid/online-only');
		assert.isTrue(loadURI.calledOnceWithExactly('https://example.invalid/online-only'));
		
		let second = await session.matchReference({
			requestID: 'local-view-2',
			sourceKey: 'reference-view-2',
			referenceParts: [{ text: 'A different reference' }],
		});
		let stale = await session.performAction({
			requestID: 'action-view-stale',
			referenceKey: second.referenceKey,
			resultID: online.result.resultID,
			action: 'view-online',
		});
		assert.equal(stale.status, 'stale');
		assert.isTrue(loadURI.calledOnce);
	});
	
	it("should reject unsafe View Online URLs and report navigation failures", async function () {
		let session = await createSession();
		let referenceKey = session._replaceReference('navigation-safety', 'Reference');
		let binding = { resultID: 'result', referenceKey, actions: ['view-online'] };
		session._references.get(referenceKey).result = binding;
		let loadURI = sandbox.stub();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { loadURI } });
		sandbox.stub(Zotero, 'logError');
		let request = { requestID: 'view', referenceKey, resultID: binding.resultID, action: 'view-online' };
		// eslint-disable-next-line no-script-url -- Verify that script URLs cannot reach navigation.
		for (let url of ['file:///invalid-navigation', 'javascript:alert(1)', 'https://user:password@example.invalid/']) {
			binding.viewURL = url;
			assert.equal((await session.performAction(request)).status, 'stale', url);
		}
		assert.isFalse(loadURI.called);
		binding.viewURL = 'https://example.invalid/navigation';
		loadURI.throws(new Error('Navigation failed'));
		assert.equal((await session.performAction(request)).status, 'failed');
		assert.isTrue(loadURI.calledOnceWithExactly(binding.viewURL));
		loadURI.resetBehavior();
		assert.equal((await session.performAction(request)).status, 'ok');
	});
	
	it("should reject actions during a save and allow navigation once it completes", async function () {
		Zotero.Prefs.set('downloadAssociatedFiles', false);
		let session = await createSession();
		let key = session._replaceReference('navigation-save', 'doi:10.1234/navigation-save');
		let result = { resultID: 'navigation-candidate', referenceKey: key,
			actions: ['add-to-library', 'view-online'],
			viewURL: 'https://example.invalid/navigation-save', candidateJSON: {
				itemType: 'journalArticle', title: 'Navigation during save', DOI: '10.1234/navigation-save',
			} };
		session._references.get(result.referenceKey).result = result;
		let release;
		let originalSave = referenceSaver.saveCandidate.bind(referenceSaver);
		let save = sandbox.stub(referenceSaver, 'saveCandidate').callsFake(async (...args) => {
			await new Promise((resolve) => {
				release = resolve;
			});
			let saved = await originalSave(...args);
			objects.push(saved.item);
			return saved;
		});
		let loadURI = sandbox.stub();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { loadURI } });
		sandbox.stub(Zotero, 'logError');
		let request = { requestID: 'pending-add', referenceKey: key, resultID: result.resultID, action: 'add-to-library' };
		let pending = session.performAction(request);
		try {
			await waitForCacheOperation(() => release);
			let reference = session._references.get(key);
			let assertSavePending = () => {
				assert.equal(reference.saving, request.requestID);
				assert.isTrue(save.calledOnce);
			};
			let view = { ...request, requestID: 'view-during-add', action: 'view-online' };
			for (let blocked of [request, view, { ...request, requestID: 'duplicate-add' }]) {
				assert.equal((await session.performAction(blocked)).status, 'failed');
				assertSavePending();
			}
			assert.isFalse(loadURI.called);
			release();
			let saved = await pending;
			assert.equal(saved.status, 'saved');
			assert.equal(saved.result.libraryState, 'existing');
			assert.include(saved.result.actions, 'show-in-library');
			assert.equal((await session.performAction(view)).status, 'ok');
			assert.isTrue(loadURI.calledOnce);
			assert.isTrue(save.calledOnce);
		}
		finally {
			release?.();
			await pending;
			session.dispose();
		}
	});
	
	it("should keep actions blocked until saved metadata is ready", async function () {
		let session = await createSession();
		let saved = await createItem();
		let key = session._replaceReference('hydrating-navigation', 'Candidate');
		let result = { resultID: 'hydrating-candidate', referenceKey: key,
			actions: ['add-to-library', 'view-online'] };
		session._references.get(result.referenceKey).result = result;
		let save = sandbox.stub(referenceSaver, 'saveCandidate').resolves({ item: saved, existing: false });
		let release;
		let originalDTO = session._createLibraryResult.bind(session);
		let hydrate = sandbox.stub(session, '_createLibraryResult').callsFake(async (...args) => {
			if (hydrate.callCount === 1) {
				await new Promise((resolve) => {
					release = resolve;
				});
			}
			return originalDTO(...args);
		});
		let loadURI = sandbox.stub();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { loadURI } });
		let request = { requestID: 'hydrating-add', referenceKey: key, resultID: result.resultID, action: 'add-to-library' };
		let pending = session.performAction(request);
		try {
			await waitForCacheOperation(() => release);
			assert.equal(result.itemID, saved.id);
			let reference = session._references.get(key);
			let navigation = await session.performAction({ ...request, requestID: 'hydrating-view', action: 'view-online' });
			assert.equal(navigation.status, 'failed');
			assert.isFalse(loadURI.called);
			assert.equal(reference.saving, request.requestID);
			assert.isTrue(save.calledOnce);
			release();
			let response = await pending;
			assert.equal(response.status, 'saved');
			assert.equal(response.result.libraryState, 'existing');
			assert.include(response.result.actions, 'show-in-library');
		}
		finally {
			release?.();
			await pending;
			session.dispose();
		}
	});
	
	it("should reject View Online after disposal without cancelling a delegated save", async function () {
		let session = await createSession();
		let saved = await createItem();
		let key = session._replaceReference('disposed-navigation', 'Candidate');
		session._references.get(key).result = { resultID: 'candidate', referenceKey: key,
			actions: ['add-to-library', 'view-online'],
			viewURL: 'https://example.invalid/article' };
		let release;
		sandbox.stub(referenceSaver, 'saveCandidate').callsFake(() => new Promise((resolve) => {
			release = resolve;
		}));
		let loadURI = sandbox.stub();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { loadURI } });
		let request = { requestID: 'disposed-add', referenceKey: key, resultID: 'candidate', action: 'add-to-library' };
		let pending = session.performAction(request);
		try {
			await waitForCacheOperation(() => release);
			let reference = session._references.get(key);
			session.dispose();
			assert.equal((await session.performAction({ ...request, requestID: 'disposed-view', action: 'view-online' })).status, 'stale');
			assert.isFalse(loadURI.called);
			assert.equal(reference.saving, request.requestID);
			release({ item: saved, existing: false });
			assert.equal((await pending).status, 'saved');
		}
		finally {
			session.dispose();
			release?.({ item: saved, existing: false });
			await pending;
		}
	});
	
	it("should roll back a local result superseded during asynchronous DTO hydration", async function () {
		let item = await createItem();
		let session = await createSession();
		let releaseHydration;
		let hydrationStarted;
		let started = new Promise(resolve => hydrationStarted = resolve);
		sandbox.stub(item, 'getBestAttachment').callsFake(() => {
			hydrationStarted();
			return new Promise(resolve => releaseHydration = resolve);
		});
		sandbox.stub(BibliographyMatcher, 'matchLibrary')
			.onFirstCall().resolves(strictMatch(item))
			.onSecondCall()
.resolves(unmatched());
		
		let firstPromise = session.matchReference({
			requestID: 'hydrate-1',
			sourceKey: 'hydrated-reference',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		await started;
		let second = await session.matchReference({
			requestID: 'hydrate-2',
			sourceKey: 'hydrated-reference',
			referenceParts: [{ text: 'Replacement reference' }],
		});
		releaseHydration(null);
		let first = await firstPromise;
		
		assert.equal(first.status, 'cancelled');
		assert.equal(second.status, 'no-match');
		assert.equal([...session._references.values()].filter(reference => reference.result).length, 0);
		assert.equal(session._references.size, 1);
	});
	
	it("should publish no result when native metadata hydration fails", async function () {
		let item = await createItem();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(strictMatch(item));
		sandbox.stub(item, 'getBestAttachment').rejects(new Error('Hydration failed'));
		let session = await createSession();
		let response = await session.matchReference({ requestID: 'hydrate', sourceKey: 'reference',
			referenceParts: [{ text: item.getField('title') }] });
		assert.equal(response.status, 'error');
		assert.notProperty(session._references.get(response.referenceKey), 'result');
		assert.equal(session._operations.size, 0);
	});
	it("should bind result tokens to one reference and reject evicted tokens", async function () {
		let item = await createItem({ url: '' });
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(strictMatch(item));
		
		let first = await session.matchReference({
			requestID: 'local-1',
			sourceKey: 'reference-1',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		let second = await session.matchReference({
			requestID: 'local-2',
			sourceKey: 'reference-2',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		
		let leaked = await session.performAction({
			requestID: 'action-1',
			referenceKey: second.referenceKey,
			resultID: first.result.resultID,
			action: 'show-in-library',
		});
		assert.deepEqual(leaked, {
			requestID: 'action-1',
			referenceKey: second.referenceKey,
			status: 'stale',
		});
		
		delete session._references.get(first.referenceKey).result;
		let evicted = await session.performAction({
			requestID: 'action-2',
			referenceKey: first.referenceKey,
			resultID: first.result.resultID,
			action: 'show-in-library',
		});
		assert.equal(evicted.status, 'stale');
	});
	
	it("should execute existing-item navigation without rebuilding popup metadata", async function () {
		let item = await createItem({ DOI: '' });
		let attachment = await createAttachment();
		attachment.parentID = item.id;
		attachment.attachmentContentType = 'text/plain';
		await attachment.saveTx();
		assert.isFalse(!!attachment.attachmentReaderType);
		let session = await createSession();
		let originalGet = Zotero.Libraries.get;
		sandbox.stub(Zotero.Libraries, 'get').callsFake(libraryID => (
			libraryID === session._libraryID
				? { editable: true, filesEditable: true }
				: originalGet.call(Zotero.Libraries, libraryID)
		));
		let getBestAttachment = sandbox.stub(item, 'getBestAttachment').resolves(attachment);
		let canFindFile = sandbox.spy(Zotero.Attachments, 'canFindFileForItem');
		let addAvailableFile = sandbox.stub(Zotero.Attachments, 'addAvailableFile');
		let selectItem = sandbox.stub().resolves();
		let viewAttachment = sandbox.stub().resolves();
		let loadURI = sandbox.stub();
		sandbox.stub(Zotero, 'getMainWindow').returns({
			ZoteroPane: { selectItem, viewAttachment, loadURI },
		});
		let hydrate = sandbox.spy(session, '_createLibraryResult');
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(strictMatch(item));
		let onlineProvider = sandbox.spy(onlineReferenceLookup, 'findOnline');
		let translate = sandbox.spy(Zotero.Translate.Search.prototype, 'translate');
		let http = sandbox.spy(Zotero.HTTP, 'request');
		
		let local = await session.matchReference({
			requestID: 'local-existing-actions',
			sourceKey: 'reference-existing-actions',
			referenceParts: [{ text: 'Lovelace. 2021. Reliable matching.' }],
		});
		let result = local.result;
		assert.deepEqual(result.actions, [
			'open-attachment',
			'show-in-library',
			'view-online',
		]);
		getBestAttachment.resetHistory();
		
		for (let [action, requestID] of [
			['show-in-library', 'action-show-existing'],
			['open-attachment', 'action-open-existing'],
			['view-online', 'action-view-existing'],
		]) {
			let response = await session.performAction({
				requestID,
				referenceKey: local.referenceKey,
				resultID: result.resultID,
				action,
			});
			assert.deepEqual(response, {
				requestID,
				referenceKey: local.referenceKey,
				status: 'ok',
			});
		}
		
		assert.isTrue(selectItem.calledOnceWithExactly(item.id));
		assert.isTrue(viewAttachment.calledOnceWithExactly(attachment.id));
		assert.isTrue(loadURI.calledOnceWithExactly(item.getField('url')));
		assert.isTrue(hydrate.calledOnce, 'Only the lookup builds popup metadata');
		assert.isFalse(addAvailableFile.called);
		assert.isTrue(getBestAttachment.calledOnce, 'Only Open Attachment queries the attachment');
		assert.isTrue(getBestAttachment.alwaysCalledOn(item));
		assert.isFalse(canFindFile.called);
		assert.isFalse(onlineProvider.called);
		assert.isFalse(translate.called);
		assert.isFalse(http.called);
	});
	
	it("should prioritize attachment opening without changing the remaining action order", async function () {
		let item = await createItem();
		let attachment = await createAttachment();
		let session = await createSession();
		let best = sandbox.stub(item, 'getBestAttachment').resolves(null);
		let withoutAttachment = await session._createLibraryResult('without-attachment', item);
		assert.deepEqual(withoutAttachment.actions, ['show-in-library', 'view-online']);
		best.resolves(attachment);
		let withAttachment = await session._createLibraryResult('with-attachment', item);
		assert.deepEqual(withAttachment.actions, ['open-attachment', 'show-in-library', 'view-online']);
	});
	
	it("should reject stale parent and attachment state after asynchronous attachment selection", async function () {
		for (let mutation of ['parent-deleted', 'attachment-deleted', 'attachment-reparented']) {
			let item = await createItem({ DOI: '', url: '' });
			let attachment = await createAttachment();
			attachment.parentID = item.id;
			await attachment.saveTx();
			let session = await createSession();
			let key = session._replaceReference('stale-item', item.getField('title'));
			let result = await session._createLibraryResult('fixture', item);
			session._references.get(key).result = { referenceKey: key, resultID: result.resultID,
				itemID: item.id, actions: result.actions };
			// Linked-URL fixture is not selected by the real best-attachment SQL;
			// grant the already-advertised action and control only the async lookup.
			bindingFor(session, result.resultID).actions.push('open-attachment');
			let release, start;
			let started = new Promise(resolve => start = resolve);
			let best = sandbox.stub(item, 'getBestAttachment').resolves(attachment);
			best.onFirstCall().callsFake(() => {
				start();
				return new Promise(resolve => release = resolve);
			});
			let viewAttachment = sandbox.stub().resolves();
			let windowStub = sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { viewAttachment } });
			let pending = session.performAction({ requestID: 'open-stale', referenceKey: key,
				resultID: result.resultID, action: 'open-attachment' });
			await started;
			if (mutation === 'parent-deleted') {
				item.deleted = true; await item.saveTx();
			}
			if (mutation === 'attachment-deleted') {
				attachment.deleted = true; await attachment.saveTx();
			}
			if (mutation === 'attachment-reparented') {
				attachment.parentID = false; await attachment.saveTx();
			}
			release(attachment);
			assert.equal((await pending).status, 'stale', mutation);
			assert.isFalse(viewAttachment.called, mutation);
			best.restore(); windowStub.restore(); session.dispose();
		}
	});
	
	it("should return stale when a pending existing-item action loses its bound result", async function () {
		let item = await createItem({ DOI: '', url: '' });
		let session = await createSession();
		sandbox.stub(item, 'getBestAttachment').resolves(null);
		sandbox.stub(BibliographyMatcher, 'matchLibrary')
			.onFirstCall().resolves(strictMatch(item))
			.onSecondCall()
.resolves(unmatched());
		let releaseSelection;
		let selectionStarted;
		let started = new Promise(resolve => selectionStarted = resolve);
		let selectItem = sandbox.stub().callsFake(() => {
			selectionStarted();
			return new Promise(resolve => releaseSelection = resolve);
		});
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { selectItem } });
		let onlineProvider = sandbox.spy(onlineReferenceLookup, 'findOnline');
		let translate = sandbox.spy(Zotero.Translate.Search.prototype, 'translate');
		let http = sandbox.spy(Zotero.HTTP, 'request');
		
		let local = await session.matchReference({
			requestID: 'local-pending-action',
			sourceKey: 'reference-pending-action',
			referenceParts: [{ text: 'Lovelace. 2021. Reliable matching.' }],
		});
		let actionPromise = session.performAction({
			requestID: 'action-pending-show',
			referenceKey: local.referenceKey,
			resultID: local.result.resultID,
			action: 'show-in-library',
		});
		await started;
		let replacement = await session.matchReference({
			requestID: 'local-replacement',
			sourceKey: 'reference-pending-action',
			referenceParts: [{ text: 'A replacement reference' }],
		});
		releaseSelection();
		
		assert.equal(replacement.status, 'no-match');
		assert.deepEqual(await actionPromise, {
			requestID: 'action-pending-show',
			referenceKey: local.referenceKey,
			status: 'stale',
		});
		assert.isTrue(selectItem.calledOnceWithExactly(item.id));
		assert.isFalse(onlineProvider.called);
		assert.isFalse(translate.called);
		assert.isFalse(http.called);
	});
	
	it("should reject an action the result does not advertise", async function () {
		let item = await createItem();
		let session = await createSession();
		let key = session._replaceReference('unavailable-action', item.getField('title'));
		let result = await session._createLibraryResult('fixture', item);
		session._references.get(key).result = { referenceKey: key, resultID: result.resultID,
			itemID: item.id, actions: result.actions };
		let loadItem = sandbox.spy(Zotero.Items, 'getAsync');
		assert.notInclude(result.actions, 'add-to-library');
		let response = await session.performAction({ requestID: 'unavailable-action', referenceKey: key,
			resultID: result.resultID, action: 'add-to-library' });
		assert.equal(response.status, 'failed');
		assert.isFalse(loadItem.called);
	});
	
	it("should cancel stale local work and dispose pending lookups", async function () {
		let item = await createItem();
		let session = await createSession();
		let pending = [];
		sandbox.stub(BibliographyMatcher, 'matchLibrary').callsFake(() => (
			new Promise(resolve => pending.push(resolve))
		));
		
		let firstPromise = session.matchReference({
			requestID: 'local-1',
			sourceKey: 'same-reference',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		await waitForCacheOperation(() => pending.length === 1);
		let secondPromise = session.matchReference({
			requestID: 'local-2',
			sourceKey: 'same-reference',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		await waitForCacheOperation(() => pending.length === 2);
		pending[1](strictMatch(item));
		let second = await secondPromise;
		pending[0](strictMatch(item));
		let first = await firstPromise;
		
		assert.equal(second.status, 'strong');
		assert.equal(first.status, 'cancelled');
		
		let thirdPromise = session.matchReference({
			requestID: 'local-3',
			sourceKey: 'another-reference',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		await waitForCacheOperation(() => pending.length === 3);
		session.dispose();
		pending[2](strictMatch(item));
		assert.equal((await thirdPromise).status, 'cancelled');
	});
	
	it("should reject Add invalidated before persistence delegation", async function () {
		let save = sandbox.stub(referenceSaver, 'saveCandidate').resolves(null);
		for (let mutation of ['replacement', 'eviction', 'disposal']) {
			let attachment = await createAttachment();
			let session = new ReaderReferenceSession(attachment);
			let key = session._replaceReference('source', 'Candidate');
			session._references.get(key).result = { resultID: 'candidate', referenceKey: key,
				actions: ['add-to-library'] };
			let release;
			let original = Zotero.Items.getAsync;
			let lookup = sandbox.stub(Zotero.Items, 'getAsync').callsFake(function (id, ...args) {
				return id === attachment.id ? new Promise(resolve => release = resolve) : original.call(this, id, ...args);
			});
			let pending = session.performAction({ requestID: 'add', referenceKey: key,
				resultID: 'candidate', action: 'add-to-library' });
			assert.isFunction(release);
			if (mutation === 'replacement') session._replaceReference('source', 'Replacement');
			if (mutation === 'eviction') session._removeReference(key);
			if (mutation === 'disposal') session.dispose();
			release(attachment);
			assert.equal((await pending).status, 'stale', mutation);
			assert.isFalse(save.called, mutation);
			lookup.restore(); session.dispose();
		}
	});
	
	it("should redact arbitrary online provider failures at the Reader boundary", async function () {
		let citationSecret = 'Secret Author 2099 Private Citation';
		let urlSecret = 'https://metadata.invalid/private?citation=secret';
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		sandbox.stub(onlineReferenceLookup, 'findOnline')
			.rejects(new Error(`${citationSecret} ${urlSecret}`));
		let logError = sandbox.stub(Zotero, 'logError');
		let local = await session.matchReference({
			requestID: 'sensitive-local',
			sourceKey: 'sensitive-reference',
			referenceParts: [{ text: citationSecret }],
		});
		
		let response = await session.findOnline({
			requestID: 'sensitive-online',
			referenceKey: local.referenceKey,
		});
		let logged = logError.getCalls().flatMap(call => call.args).map(value => (
			`${String(value)}\n${value?.stack || ''}`
		))
			.join('\n');
		
		assert.equal(response.status, 'error');
		assert.isTrue(logError.calledOnce);
		assert.include(logged, 'Reference provider request failed');
		assert.notInclude(logged, citationSecret);
		assert.notInclude(logged, urlSecret);
	});
	
	it("should use the exact action response and finish a save after teardown", async function () {
		let acquiredAttachment = await createAttachment();
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle',
			title: 'Reliable matching across diverse bibliographies',
			creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }],
			date: '2021',
			DOI: '10.1234/general.42',
			attachments: [{ title: 'Must not survive', url: 'https://example.invalid/file.pdf' }],
			unknownActiveField: 'Must not survive',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		stubOnlineCandidates([transient]);
		let resolveSave;
		let saveStarted = new Promise((resolve) => {
			resolveSave = resolve;
		});
		let save = sandbox.stub(referenceSaver, 'saveCandidate').returns(saveStarted);
		
		let local = await session.matchReference({
			requestID: 'local-1',
			sourceKey: 'reference-1',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		let online = await session.findOnline({
			requestID: 'online-1',
			referenceKey: local.referenceKey,
		});
		let actionPromise = session.performAction({
			requestID: 'action-1',
			referenceKey: local.referenceKey,
			resultID: online.result.resultID,
			action: 'add-to-library',
		});
		await Zotero.Promise.delay(0);
		assert.isTrue(save.calledOnce);
		let savedInput = save.firstCall.args[0];
		assert.notProperty(savedInput, 'attachments');
		assert.notProperty(savedInput, 'unknownActiveField');
		
		session.dispose();
		let existingItem = await createItem();
		sandbox.stub(existingItem, 'getBestAttachment').resolves(acquiredAttachment);
		resolveSave({ item: existingItem, existing: false });
		let action = await actionPromise;
		assert.equal(action.status, 'saved');
		assert.property(action, 'result');
		assert.include(action.result.actions, 'open-attachment');
		assert.notProperty(action.result.display, 'url');
	});
	
	it("should keep a saved metadata result actionable when no file was acquired", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle',
			title: 'Metadata-only result',
			DOI: '10.1234/metadata-only',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		stubOnlineCandidates([transient]);
		sandbox.stub(referenceSaver, 'saveCandidate')
			.callsFake(async () => {
				let savedItem = await createItem({ DOI: '10.1234/metadata-only' });
				sandbox.stub(savedItem, 'getBestAttachment').resolves(null);
				return { item: savedItem, existing: false };
			});
		
		let local = await session.matchReference({
			requestID: 'metadata-only-local',
			sourceKey: 'metadata-only-reference',
			referenceParts: [{ text: 'doi:10.1234/metadata-only' }],
		});
		let online = await session.findOnline({
			requestID: 'metadata-only-online', referenceKey: local.referenceKey,
		});
		let action = await session.performAction({
			requestID: 'metadata-only-add',
			referenceKey: local.referenceKey,
			resultID: online.result.resultID,
			action: 'add-to-library',
		});
		
		assert.equal(action.status, 'saved');
		assert.sameMembers(action.result.actions, ['show-in-library', 'view-online']);
	});
	
	it("should not advertise Add for an unsaved result in a non-editable library", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle', title: 'Read-only result', DOI: '10.1234/read-only',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		stubOnlineCandidates([transient]);
		let local = await session.matchReference({
			requestID: 'local-read-only-presentation',
			sourceKey: 'reference-read-only-presentation',
			referenceParts: [{ text: 'doi:10.1234/read-only' }],
		});
		let originalGet = Zotero.Libraries.get;
		sandbox.stub(Zotero.Libraries, 'get').callsFake(libraryID => (
			libraryID === session._libraryID
				? { editable: false }
				: originalGet.call(Zotero.Libraries, libraryID)
		));
		
		let online = await session.findOnline({
			requestID: 'online-read-only-presentation', referenceKey: local.referenceKey,
		});
		
		assert.equal(online.status, 'strong');
		assert.notInclude(online.result.actions, 'add-to-library');
	});
	
	it("should reject Add when the source attachment no longer belongs to the session library", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle',
			title: 'Reliable matching across diverse bibliographies',
			DOI: '10.1234/general.42',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		stubOnlineCandidates([transient]);
		let save = sandbox.spy(referenceSaver, 'saveCandidate');
		let local = await session.matchReference({
			requestID: 'local-changed-library',
			sourceKey: 'reference-changed-library',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		let online = await session.findOnline({
			requestID: 'online-changed-library', referenceKey: local.referenceKey,
		});
		sandbox.stub(Zotero.Items, 'getAsync').withArgs(session._attachmentID).resolves({
			libraryID: session._libraryID + 1000,
			deleted: false,
			isAttachment: () => true,
		});
		
		let response = await session.performAction({
			requestID: 'add-changed-library',
			referenceKey: local.referenceKey,
			resultID: online.result.resultID,
			action: 'add-to-library',
		});
		
		assert.equal(response.status, 'stale');
		assert.isFalse(save.called);
	});
	
	it("should reject Add when the rederived target library is not editable", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle', title: 'Read-only result', DOI: '10.1234/read-only',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		stubOnlineCandidates([transient]);
		let local = await session.matchReference({
			requestID: 'local-read-only', sourceKey: 'reference-read-only',
			referenceParts: [{ text: 'doi:10.1234/read-only' }],
		});
		let online = await session.findOnline({
			requestID: 'online-read-only', referenceKey: local.referenceKey,
		});
		let originalGet = Zotero.Libraries.get;
		sandbox.stub(Zotero.Libraries, 'get').callsFake(libraryID => (
			libraryID === session._libraryID
				? { editable: false }
				: originalGet.call(Zotero.Libraries, libraryID)
		));
		
		let response = await session.performAction({
			requestID: 'add-read-only',
			referenceKey: local.referenceKey,
			resultID: online.result.resultID,
			action: 'add-to-library',
		});
		
		assert.equal(response.status, 'failed');
	});
	
	it("should recheck an item added after online lookup in the serialized duplicate check", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle', title: 'Remote duplicate', DOI: '10.1234/general.42',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		stubOnlineCandidates([transient]);
		let local = await session.matchReference({
			requestID: 'local-duplicate', sourceKey: 'reference-duplicate',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		let online = await session.findOnline({
			requestID: 'online-duplicate', referenceKey: local.referenceKey,
		});
		let duplicate = await createItem();
		let duplicateCheck = sandbox.spy(BibliographyMatcher, 'checkForDuplicate');
		let save = sandbox.spy(referenceSaver, 'saveCandidate');
		
		let response = await session.performAction({
			requestID: 'add-duplicate',
			referenceKey: local.referenceKey,
			resultID: online.result.resultID,
			action: 'add-to-library',
		});
		
		assert.equal(response.status, 'existing');
		assert.equal(session._references.get(local.referenceKey).result.itemID, duplicate.id);
		assert.isTrue(duplicateCheck.calledOnce);
		assert.isTrue(save.calledOnce);
	});
	
	it("should resolve duplicate identity before metadata persistence", async function () {
		let duplicate = await createItem();
		let duplicateCheck = sandbox.spy(BibliographyMatcher, 'checkForDuplicate');
		let itemSaver = sandbox.spy(Zotero.Translate, 'ItemSaver');
		let fromJSON = sandbox.spy(Zotero.Item.prototype, 'fromJSON');
		
		let response = await referenceSaver.saveCandidate({
			itemType: 'journalArticle', title: 'Remote duplicate', DOI: '10.1234/general.42',
		}, { libraryID: Zotero.Libraries.userLibraryID });
		
		assert.equal(response.item, duplicate);
		assert.isTrue(response.existing);
		assert.isTrue(duplicateCheck.calledOnce);
		assert.isFalse(itemSaver.called);
		assert.isTrue(fromJSON.calledOnce, 'Canonicalize once at the save boundary, not again for identity');
	});
	
	it("should keep the active reader when automatic PDF acquisition completes after Add", async function () {
		let win = await loadZoteroPane();
		let reader;
		try {
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let source = await Zotero.Attachments.importFromFile({ file });
			objects.push(source);
			reader = await Zotero.Reader.open(source.id);
			await reader._initPromise;
			Zotero.Prefs.set('downloadAssociatedFiles', true);
			sandbox.stub(Zotero.Attachments, 'downloadFirstAvailableFile').callsFake(async (_resolvers, path) => {
				await OS.File.copy(file.path, path);
				return { url: 'https://example.invalid/automatic.pdf', mimeType: 'application/pdf', props: {} };
			});
			let select = sandbox.spy(win.ZoteroPane, 'selectItem');
			let saved = await referenceSaver.saveCandidate({
				itemType: 'journalArticle', title: 'Automatic attachment reader retention', DOI: '10.1234/reader-retention',
			}, { libraryID: source.libraryID });
			objects.push(saved.item);
			await saved.fileAcquisitionPromise;
			assert.lengthOf(saved.item.getAttachments(), 1);
			assert.isFalse(select.called);
			assert.equal(win.Zotero_Tabs.selectedID, reader.tabID);
		}
		finally {
			reader?.close();
			win.close();
		}
	});
	
	it("should save only allowlisted root metadata and serialize concurrent Adds", async function () {
		Zotero.Prefs.set('downloadAssociatedFiles', true);
		sandbox.stub(Zotero.Attachments, 'addFileFromURLs').resolves(false);
		let savedItem = await createItem({ DOI: '10.1234/new-item' });
		let committed = false;
		let duplicate = sandbox.stub(BibliographyMatcher, 'checkForDuplicate').callsFake(async () => (
			committed ? { status: 'matched', item: savedItem } : { status: 'absent' }
		));
		let resolveSave;
		let savePromise = new Promise(resolve => resolveSave = resolve);
		let saveItems = sandbox.stub().callsFake(async () => {
			await savePromise;
			committed = true;
			return [savedItem];
		});
		let itemSaver = sandbox.stub(Zotero.Translate, 'ItemSaver').returns({ saveItems });
		let result = {
			candidateJSON: {
				itemType: 'journalArticle',
				title: 'New remote item',
				DOI: '10.1234/new-item',
				creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }],
				attachments: [{ url: 'https://example.invalid/file.pdf' }],
				collections: ['forged'],
				tags: [{ tag: 'forged' }],
				notes: [{ note: 'forged' }],
				relations: { forged: 'value' },
				unknownActiveField: 'forged',
			},
		};
		
		let firstPromise = referenceSaver.saveCandidate(result.candidateJSON, {
			libraryID: Zotero.Libraries.userLibraryID,
		});
		let secondPromise;
		try {
			await waitForCacheOperation(() => saveItems.called);
			secondPromise = referenceSaver.saveCandidate(result.candidateJSON, {
				libraryID: Zotero.Libraries.userLibraryID,
			});
			await Zotero.Promise.delay(0);
			assert.isTrue(duplicate.calledOnce, 'The second identity check must wait for metadata commit');
			assert.isTrue(itemSaver.calledOnce);
			let options = itemSaver.firstCall.args[0];
			assert.equal(options.libraryID, Zotero.Libraries.userLibraryID);
			assert.equal(options.attachmentMode, Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE);
			assert.notProperty(options, 'collections');
			let savedJSON = saveItems.firstCall.args[0][0];
			assert.notStrictEqual(savedJSON, result.candidateJSON);
			assert.notStrictEqual(savedJSON.creators, result.candidateJSON.creators);
			savedJSON.creators[0].firstName = 'Changed by ItemSaver';
			assert.equal(result.candidateJSON.creators[0].firstName, 'Ada');
			for (let field of ['attachments', 'collections', 'tags', 'notes', 'relations', 'unknownActiveField']) {
				assert.notProperty(savedJSON, field);
			}
			resolveSave();
			
			let [first, second] = await Promise.all([firstPromise, secondPromise]);
			assert.isFalse(first.existing);
			assert.isTrue(second.existing);
			assert.equal(first.item, savedItem);
			assert.equal(second.item, savedItem);
			assert.isTrue(duplicate.calledTwice);
			assert.isTrue(saveItems.calledOnce);
		}
		finally {
			resolveSave();
			await Promise.allSettled([firstPromise, secondPromise]);
		}
	});
	
	it("should select normal attachment acquisition only when preference and permissions allow it", async function () {
		let acquire = sandbox.stub(Zotero.Attachments, 'addFileFromURLs').resolves(false);
		let savedItem = await createItem({ DOI: '10.1234/attachment-mode' });
		sandbox.stub(BibliographyMatcher, 'checkForDuplicate').resolves({ status: 'absent' });
		let saveItems = sandbox.stub().resolves([savedItem]);
		let itemSaver = sandbox.stub(Zotero.Translate, 'ItemSaver').returns({ saveItems });
		let originalGet = Zotero.Libraries.get;
		let filesEditable = true;
		sandbox.stub(Zotero.Libraries, 'get').callsFake(libraryID => (
			libraryID === Zotero.Libraries.userLibraryID
				? { editable: true, filesEditable }
				: originalGet.call(Zotero.Libraries, libraryID)
		));
		
		for (let [index, prefEnabled, canEditFiles, shouldAcquire] of [
			[1, false, true, false],
			[2, true, false, false],
			[3, true, true, true],
		]) {
			Zotero.Prefs.set('downloadAssociatedFiles', prefEnabled);
			filesEditable = canEditFiles;
			let response = await referenceSaver.saveCandidate({
				itemType: 'journalArticle',
				title: `Attachment mode ${index}`,
				DOI: `10.1234/attachment-mode-${index}`,
			}, { libraryID: Zotero.Libraries.userLibraryID });
			
			assert.equal(response.item, savedItem);
			assert.equal(itemSaver.lastCall.args[0].attachmentMode, Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE);
			assert.equal(acquire.callCount, shouldAcquire ? 1 : 0);
		}
		assert.equal(saveItems.callCount, 3);
	});
	
	it("should release the save lock after an ItemSaver transaction failure", async function () {
		sandbox.stub(BibliographyMatcher, 'checkForDuplicate').resolves({ status: 'absent' });
		let saveItems = sandbox.stub().rejects(new Error('transaction failed'));
		sandbox.stub(Zotero.Translate, 'ItemSaver').returns({ saveItems });
		let result = {
			candidateJSON: {
				itemType: 'journalArticle', title: 'Failed save', DOI: '10.1234/failed-save',
			},
		};
		
		let firstError = await getPromiseError(referenceSaver.saveCandidate(result.candidateJSON, {
			libraryID: Zotero.Libraries.userLibraryID,
		}));
		assert.include(String(firstError), 'transaction failed');
		assert.equal(referenceSaver._metadataSaveTails.size, 0);
		let secondError = await getPromiseError(referenceSaver.saveCandidate(result.candidateJSON, {
			libraryID: Zotero.Libraries.userLibraryID,
		}));
		assert.include(String(secondError), 'transaction failed');
		assert.equal(saveItems.callCount, 2);
	});
	
	it("should pool weak or ambiguous identifier evidence with Crossref", async function () {
		let identifierItem = {
			itemType: 'journalArticle',
			title: 'Identifier metadata',
			date: '2021',
			DOI: '10.1234/general.42',
		};
		let crossrefItem = {
			itemType: 'journalArticle',
			title: 'Crossref metadata',
			date: '2021',
			DOI: '10.1234/crossref.42',
		};
		let identifier = sandbox.stub(onlineReferenceLookup, '_translateIdentifier')
			.resolves([identifierItem]);
		let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch')
			.resolves([crossrefItem]);
		let verify = sandbox.stub(BibliographyMatcher, 'matchCandidates');
		let reference = { referenceParts: [{ text: 'doi:10.1234/general.42' }] };
		
		for (let reason of ['insufficient-evidence', 'ambiguous']) {
			identifier.resetHistory();
			crossref.resetHistory();
			verify.resetHistory();
			verify.returns({ status: 'unmatched', reason });
			let result = await onlineReferenceLookup.findOnline(reference);
			assert.deepEqual(result, { status: 'unmatched', reason });
			assert.isTrue(identifier.calledOnce);
			assert.isTrue(verify.calledTwice);
			assert.deepEqual(verify.firstCall.args, [reference, [identifierItem]]);
			assert.deepEqual(verify.lastCall.args, [reference, [identifierItem, crossrefItem]]);
			assert.isTrue(crossref.calledOnce);
		}
	});
	
	it("should pool competing identifier routes independently of order with the real matcher", async function () {
		let items = ['alpha', 'beta'].map(name => ({
			itemType: 'journalArticle', title: `${name} work`, DOI: `10.1234/${name}`,
		}));
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier')
			.callsFake(async identifier => items.filter(item => item.DOI === identifier.DOI));
		sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([]);
		for (let order of [items, [...items].reverse()]) {
			provider.resetHistory();
			let reference = order.map(item => item.DOI).join(' ');
			let result = await onlineReferenceLookup.findOnline(reference);
			assert.equal(provider.callCount, 2);
			assert.equal(result.status, 'unmatched');
			assert.notProperty(result, 'item');
		}
	});
	
	it("should resolve completed same-work identifier routes with the real matcher", async function () {
		let item = { itemType: 'journalArticle', title: 'Same work', DOI: '10.1234/alpha', extra: 'PMID: 22678280' };
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier').resolves([item]);
		let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([]);
		let reference = '10.1234/alpha PMID: 22678280';
		let result = await onlineReferenceLookup.findOnline(reference);
		assert.equal(provider.callCount, 2);
		assert.property(result, 'item');
		assert.equal(result.status, 'matched');
		assert.isFalse(crossref.called);
	});
	
	it("should not certify partial multi-identifier results after failure or a cap", async function () {
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier');
		provider.onFirstCall().resolves([{ itemType: 'journalArticle', title: 'Alpha', DOI: '10.1234/alpha' }]);
		provider.onSecondCall().rejects(new Zotero.HTTP.TimeoutException(10));
		let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([]);
		let result = await onlineReferenceLookup.findOnline('10.1234/alpha 10.1234/beta');
		assert.equal(result.status, 'incomplete');
		assert.notProperty(result, 'items');
		assert.equal(provider.callCount, 2);
		provider.resetHistory();
		result = await onlineReferenceLookup.findOnline(
			'10.1234/alpha 10.1234/beta 10.1234/gamma 10.1234/delta');
		assert.equal(result.status, 'incomplete');
		assert.isFalse(provider.called);
		assert.isFalse(crossref.called);
	});
	
	it("should cancel a later identifier route without returning its partial pool", async function () {
		let controller = new AbortController();
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier');
		provider.onFirstCall().resolves([{ itemType: 'journalArticle', title: 'Alpha', DOI: '10.1234/alpha' }]);
		provider.onSecondCall().callsFake(async () => {
			controller.abort();
			throw new Zotero.HTTP.CancelledException();
		});
		let error = await getPromiseError(onlineReferenceLookup.findOnline(
			'10.1234/alpha 10.1234/beta', { signal: controller.signal }));
		assert.instanceOf(error, Zotero.HTTP.CancelledException);
		assert.equal(provider.callCount, 2);
	});
	
	for (let competing of [false, true]) {
		it(`should evaluate the complete merged online pool including a late ${competing ? 'competitor' : 'winner'}`, async function () {
			sandbox.stub(onlineReferenceLookup, '_translateIdentifier')
				.resolves([{ itemType: 'journalArticle', title: 'Identifier suggestion' }]);
			let pool = Array.from({ length: 20 }, (_, i) => ({
				itemType: 'journalArticle', title: `Distinct work ${i}`,
			}));
			pool[19].DOI = '10.1234/alpha';
			pool[19].extra = 'PMID: 22678280';
			if (competing) {
				pool[0].DOI = '10.1234/alpha';
				pool[0].extra = 'PMID: 22678281';
			}
			sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves(pool);
			let result = await onlineReferenceLookup.findOnline('10.1234/alpha');
			assert.equal(result.status, competing ? 'unmatched' : 'matched');
			if (competing) assert.notProperty(result, 'item');
			else assert.equal(result.item.getField('title'), 'Distinct work 19');
		});
	}
	
	it("should retain competing identifier results beyond twenty merged candidates", async function () {
		let pool = Array.from({ length: 20 }, (_, i) => ({
			itemType: 'journalArticle', title: `Identifier work ${i}`,
		}));
		pool[0].DOI = '10.1234/alpha';
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier');
		provider.onFirstCall().resolves(pool);
		provider.onSecondCall().resolves([{ itemType: 'journalArticle', title: 'Competing work', extra: 'PMID: 22678280' }]);
		sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([]);
		let result = await onlineReferenceLookup.findOnline('10.1234/alpha PMID: 22678280');
		assert.equal(result.status, 'unmatched');
		assert.notProperty(result, 'item');
		assert.equal(result.reason, 'ambiguous-identifiers');
	});
	
	for (let route of ['identifier', 'crossref']) {
		it(`should report incomplete ${route} translation selection instead of certifying the first five choices`, async function () {
			let pool = Array.from({ length: 6 }, (_, i) => ({ itemType: 'journalArticle',
				title: `Selection work ${i}`, DOI: i === 5 ? '10.1234/selection0' : `10.1234/selection${i}`,
				extra: `PMID: ${1111111 + i}` }));
			let reference = { referenceParts: [{ text: 'doi:10.1234/selection0' }] };
			assert.equal(BibliographyMatcher.matchCandidates(reference, pool).status, 'unmatched');
			assert.equal(BibliographyMatcher.matchCandidates(reference, pool.slice(0, 5)).status, 'matched');
			let select;
			let selected;
			let translate = {
				ERROR_NO_RESULTS: 'NO_RESULTS',
				setHandler(name, handler) {
					if (name === 'select') select = handler;
				},
				async translate() {
					select(this, Object.fromEntries(pool.map((item, i) => [String(i), item.title])), value => selected = value);
					if (!selected) throw this.ERROR_NO_RESULTS;
					return Object.keys(selected).map(key => pool[Number(key)]);
				},
			};
			let run = () => onlineReferenceLookup._runTranslation(translate);
			let identifier = sandbox.stub(onlineReferenceLookup, '_translateIdentifier');
			let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch');
			if (route === 'identifier') identifier.callsFake(run);
			else {
				identifier.resolves([{ itemType: 'journalArticle', title: 'Retained identifier candidate', DOI: '10.1234/retained' }]);
				crossref.callsFake(run);
			}
			let result = await onlineReferenceLookup.findOnline(reference);
			assert.equal(result.status, 'incomplete');
			assert.notProperty(result, 'items');
			assert.isFalse(selected, 'Over-limit choice set was partially downloaded');
			if (route === 'identifier') assert.isFalse(crossref.called);
		});
	}
	
	it("should retain every translator selection when it fits the existing request budget", async function () {
		let select;
		for (let count of [0, 1, 5]) {
			let items = Array.from({ length: count }, (_, i) => ({ title: `Work ${i}` }));
			let result = await onlineReferenceLookup._runTranslation({
				setHandler(name, handler) {
					if (name === 'select') select = handler;
				},
				async translate() {
					let selected;
					select(this, Object.fromEntries(items.map((item, i) => [String(i), item.title])), value => selected = value);
					return Object.keys(selected).map(key => items[Number(key)]);
				},
			});
			assert.deepEqual(result, items);
		}
	});
	
	it("should preserve cancellation when translator selection exceeds the request budget", async function () {
		let controller = new AbortController();
		let select;
		sandbox.stub(onlineReferenceLookup, '_translateIdentifier').callsFake(() => onlineReferenceLookup._runTranslation({
			setHandler(name, handler) {
				if (name === 'select') select = handler;
			},
			async translate() {
				select(this, Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), `Work ${i}`])), () => {});
				controller.abort();
				return [];
			},
		}));
		let error = await getPromiseError(onlineReferenceLookup.findOnline(
			'doi:10.1234/cancel-selection', { signal: controller.signal }));
		assert.instanceOf(error, Zotero.HTTP.CancelledException);
	});
	
	it("should retain a translation overflow witness for bounded verification", async function () {
		let items = Array.from({ length: 25 }, (_, i) => ({ title: `Work ${i}` }));
		let result = await onlineReferenceLookup._runTranslation({
			setHandler() {}, translate: async () => items,
		});
		assert.lengthOf(result, 21);
	});
	
	it("should reject raw provider overflow even when deduplication could hide the witness", async function () {
		let item = { itemType: 'journalArticle', title: 'Alpha', DOI: '10.1234/alpha' };
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier').resolves(Array(21).fill(item));
		assert.equal((await onlineReferenceLookup.findOnline(item.DOI)).status, 'incomplete');
		provider.resolves([]);
		sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves(Array(21).fill(item));
		assert.equal((await onlineReferenceLookup.findOnline(item.DOI)).status, 'incomplete');
	});
	
	it("should finalize a complete exact-identifier ambiguity without starting Crossref", async function () {
		sandbox.stub(onlineReferenceLookup, '_translateIdentifier').callsFake(async identifier => [{
			itemType: 'journalArticle', title: identifier.DOI, DOI: identifier.DOI,
		}]);
		let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch')
			.rejects(new Zotero.HTTP.TimeoutException(30));
		let reference = '10.1234/alpha 10.1234/beta';
		let result = await onlineReferenceLookup.findOnline(reference);
		assert.equal(result.status, 'unmatched');
		assert.equal(result.reason, 'ambiguous-identifiers');
		assert.notProperty(result, 'item');
		assert.isFalse(crossref.called);
	});
	
	it("should count equivalent ISBN forms as one provider identity with the real parser", async function () {
		let reference = '10.1234/alpha PMID: 22678280 ISBN 9781118282175';
		let parsed = BibliographyMatcher.prepareReference(reference);
		assert.deepEqual([...parsed.identifiers.ISBN], ['9781118282175'], 'ISBN aliases share one canonical identity');
		assert.deepEqual(onlineReferenceLookup._identifierSearches(parsed), [
			{ DOI: '10.1234/alpha' }, { ISBN: '9781118282175' }, { PMID: '22678280' },
		]);
		let item = { itemType: 'book', title: 'One work', ISBN: '9781118282175',
			extra: 'DOI: 10.1234/alpha\nPMID: 22678280' };
		let evaluate = sandbox.spy(BibliographyMatcher, 'matchCandidates');
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier').resolves([item]);
		let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([]);
		let result = await onlineReferenceLookup.findOnline(reference);
		assert.equal(provider.callCount, 3);
		assert.property(result, 'item');
		assert.equal(result.status, 'matched');
		assert.isFalse(crossref.called);
		provider.resetHistory();
		result = await onlineReferenceLookup.findOnline('ISBN 1118282175');
		assert.isTrue(provider.calledOnceWithExactly({ ISBN: '9781118282175' }));
		assert.equal(result.status, 'unmatched');
		assert.deepEqual(evaluate.lastCall.args[1], [item]);
		assert.isTrue(crossref.calledOnce, 'ISBN-only output is not an authoritative record match');
	});
	
	it("should keep distinct ISBN identities separate and preserve their route cap", async function () {
		let text = 'ISBN 9781118282175 ISBN 9780306406157';
		assert.deepEqual(onlineReferenceLookup._identifierSearches(BibliographyMatcher.prepareReference(text)), [
			{ ISBN: '9781118282175' }, { ISBN: '9780306406157' },
		]);
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier').resolves([]);
		assert.equal((await onlineReferenceLookup.findOnline(`10.1234/alpha PMID: 22678280 ${text}`)).status,
			'incomplete');
		assert.isFalse(provider.called);
	});
	
	it("should retain ordinary single-ISBN fallback after an identifier-provider failure", async function () {
		let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier')
			.rejects(new Zotero.HTTP.TimeoutException(10));
		let item = { itemType: 'book', title: 'One work', ISBN: '9781118282175' };
		let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([item]);
		let evaluate = sandbox.spy(BibliographyMatcher, 'matchCandidates');
		let result = await onlineReferenceLookup.findOnline('ISBN 1118282175');
		assert.isTrue(provider.calledOnce);
		assert.isTrue(crossref.calledOnce);
		assert.equal(result.status, 'timeout', 'Unverified fallback metadata cannot erase the failed provider');
		assert.deepEqual(evaluate.lastCall.args[1], [item]);
	});
	
	it("should retain a failed Crossref outcome when ISBN metadata is not independently matchable", async function () {
		sandbox.stub(onlineReferenceLookup, '_translateIdentifier').resolves([
			{ itemType: 'book', title: 'One work', ISBN: '9781118282175' },
		]);
		sandbox.stub(onlineReferenceLookup, '_translateSearch').rejects(new Zotero.HTTP.BrowserOfflineException());
		assert.equal((await onlineReferenceLookup.findOnline('ISBN 1118282175')).status, 'offline');
	});
	
	it("should keep final identifier ambiguity when fallback succeeds after a provider failure", async function () {
		sandbox.stub(onlineReferenceLookup, '_translateIdentifier').rejects(new Zotero.HTTP.TimeoutException(10));
		sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([
			{ itemType: 'journalArticle', title: 'First work', DOI: '10.1234/fallback-ambiguity', extra: 'PMID: 22678280' },
			{ itemType: 'journalArticle', title: 'Competing work', DOI: '10.1234/fallback-ambiguity', extra: 'PMID: 22678281' },
		]);
		assert.deepEqual(await onlineReferenceLookup.findOnline('doi:10.1234/fallback-ambiguity'),
			{ status: 'unmatched', reason: 'ambiguous-identifiers' });
	});
	
	it("should preserve ADS spelling through identifier lookup and bundled translator detection", async function () {
		let text = '2021wfc..rept....8D';
		let [identifier] = onlineReferenceLookup._identifierSearches(BibliographyMatcher.prepareReference(text));
		assert.deepEqual(identifier, { adsBibcode: text });
		let translate = new Zotero.Translate.Search();
		translate.setIdentifier(identifier);
		let translators = await translate.getTranslators();
		assert.include(translators.map(translator => translator.translatorID), '09bd8037-a9bb-4f9a-b3b9-d18b2564b49e');
	});
	
	it("should retain secondary arXiv conflict evidence without adding a provider route", async function () {
		let reference = 'doi:10.1234/primary arXiv:2101.12345';
		let parsed = BibliographyMatcher.prepareReference(reference);
		assert.deepEqual([...parsed.identifiers.arXiv], ['2101.12345']);
		assert.deepEqual(onlineReferenceLookup._identifierSearches(parsed), [{ DOI: '10.1234/primary' }]);
		let identifier = sandbox.stub(onlineReferenceLookup, '_translateIdentifier');
		identifier.withArgs({ DOI: '10.1234/primary' }).resolves([
			{ itemType: 'journalArticle', title: 'Published work', DOI: '10.1234/primary', extra: 'arXiv:2101.12345' },
		]);
		identifier.rejects(new Zotero.HTTP.TimeoutException(10));
		let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([]);
		assert.equal((await onlineReferenceLookup.findOnline(reference)).status, 'matched');
		assert.isTrue(identifier.calledOnceWithExactly({ DOI: '10.1234/primary' }));
		assert.isFalse(crossref.called);
		identifier.withArgs({ DOI: '10.1234/primary' }).resolves([
			{ itemType: 'journalArticle', title: 'Different work', DOI: '10.1234/primary', extra: 'arXiv:2101.99999' },
		]);
		assert.equal((await onlineReferenceLookup.findOnline(reference)).status, 'unmatched');
		assert.isTrue(crossref.calledOnce);
	});
	
	it("should preserve same-ISBN distinct provider records but deduplicate identical metadata and record identifiers", function () {
		let first = { itemType: 'bookSection', title: 'Laying the Foundations', ISBN: '9781118282175' };
		let second = { ...first, title: 'The World of SQL Server' };
		let results = BibliographyMatcher.deduplicateCandidates([first, second, { ...first }]);
		assert.lengthOf(results, 2);
		assert.strictEqual(results[0], first);
		assert.strictEqual(results[1], second);
		assert.lengthOf(BibliographyMatcher.deduplicateCandidates([
			{ ...first, DOI: '10.1234/record' }, { ...second, DOI: '10.1234/record' },
		]), 1);
	});
	
	it("should deduplicate strong identifiers before metadata signatures", function () {
		let providers = [
			{
				itemType: 'journalArticle',
				title: 'First title',
				date: '2020',
				DOI: '10.1234/SAME',
			},
			{
				itemType: 'journalArticle',
				title: 'Different provider title',
				date: '2021',
				DOI: '10.1234/same',
			},
			{
				itemType: 'book',
				title: 'ISBN ten',
				ISBN: '0-306-40615-2',
			},
			{
				itemType: 'book',
				title: 'ISBN thirteen',
				ISBN: '9780306406157',
			},
		];
		let candidates = BibliographyMatcher.deduplicateCandidates(providers);
		
		assert.lengthOf(candidates, 3);
		assert.strictEqual(candidates[0], providers[0]);
		assert.strictEqual(candidates[1], providers[2]);
		assert.strictEqual(candidates[2], providers[3]);
	});
	
	it("should continue to Crossref after an independent identifier-provider failure", async function () {
		let crossrefItem = {
			itemType: 'journalArticle',
			title: 'Crossref metadata',
			date: '2021',
			DOI: '10.1234/general.42',
		};
		sandbox.stub(onlineReferenceLookup, '_translateIdentifier')
			.rejects(new Zotero.HTTP.TimeoutException(10));
		let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch')
			.resolves([crossrefItem]);
		
		let result = await onlineReferenceLookup.findOnline({
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		
		assert.equal(result.status, 'matched');
		assert.equal(result.item.getField('DOI'), crossrefItem.DOI);
		assert.isTrue(crossref.calledOnce);
	});
	
	it("should time out one identifier provider without consuming the overall lookup", async function () {
		let originalProviderTimeout = onlineReferenceLookup.PROVIDER_TIMEOUT_MS;
		onlineReferenceLookup.PROVIDER_TIMEOUT_MS = 10;
		try {
			sandbox.stub(onlineReferenceLookup, '_translateIdentifier')
				.returns(new Promise(() => {}));
			let crossrefItem = {
				itemType: 'journalArticle', title: 'Crossref fallback', DOI: '10.1234/fallback',
			};
			let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch')
				.resolves([crossrefItem]);
			let evaluate = sandbox.spy(BibliographyMatcher, 'matchCandidates');
			
			let result = await onlineReferenceLookup.findOnline({
				referenceParts: [{ text: 'doi:10.1234/provider-timeout' }],
			});
			
			assert.equal(result.status, 'timeout', 'An unrelated fallback does not recover the timed-out identifier lookup');
			assert.isTrue(evaluate.calledOnce);
			assert.deepEqual(evaluate.firstCall.args[1], [crossrefItem]);
			assert.isTrue(crossref.calledOnce);
		}
		finally {
			onlineReferenceLookup.PROVIDER_TIMEOUT_MS = originalProviderTimeout;
		}
	});
	
	it("should enforce one overall lookup deadline", async function () {
		let originalTimeout = onlineReferenceLookup.ONLINE_LOOKUP_TIMEOUT_MS;
		let clock;
		onlineReferenceLookup.ONLINE_LOOKUP_TIMEOUT_MS = 10;
		try {
			let now = 0, elapsed;
			let lookupGlobal = Components.utils.getGlobalForObject(onlineReferenceLookup);
			clock = sandbox.stub(lookupGlobal.Date, 'now').callsFake(() => now);
			let runProvider = sandbox.stub(onlineReferenceLookup, '_runProvider').callsFake(run => run());
			let identifier = sandbox.stub(onlineReferenceLookup, '_translateIdentifier').callsFake(async () => {
				now += elapsed;
				throw new Zotero.HTTP.TimeoutException(elapsed);
			});
			let crossref = sandbox.stub(onlineReferenceLookup, '_translateSearch').callsFake(async () => {
				throw new Zotero.HTTP.TimeoutException(3);
			});
			for (elapsed of [7, 10]) {
				now = 0;
				runProvider.resetHistory();
				identifier.resetHistory();
				crossref.resetHistory();
				let result = await onlineReferenceLookup.findOnline({
					referenceParts: [{ text: 'doi:10.1234/general.42' }],
				});
				assert.equal(result.status, 'timeout');
				assert.isTrue(identifier.calledOnce);
				assert.deepEqual(runProvider.getCalls().map(call => call.args[2]), elapsed === 7 ? [10, 3] : [10]);
				assert.equal(crossref.callCount, elapsed === 7 ? 1 : 0, 'An exhausted deadline must not start fallback');
			}
		}
		finally {
			clock?.restore();
			onlineReferenceLookup.ONLINE_LOOKUP_TIMEOUT_MS = originalTimeout;
		}
	});
	
	it("should cache successful online results per session reference", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle',
			title: 'Reliable matching across diverse bibliographies',
			date: '2021',
			DOI: '10.1234/general.42',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		let provider = stubOnlineCandidates([transient]);
		let local = await session.matchReference({
			requestID: 'local-1',
			sourceKey: 'reference-1',
			referenceParts: [{ text: 'doi:10.1234/general.42' }],
		});
		
		let first = await session.findOnline({
			requestID: 'online-1', referenceKey: local.referenceKey,
		});
		let second = await session.findOnline({
			requestID: 'online-2', referenceKey: local.referenceKey,
		});
		
		assert.equal(first.status, 'strong');
		assert.notEqual(second.result.resultID, first.result.resultID);
		assert.deepEqual(second.result.display, first.result.display);
		assert.isFalse(!!bindingFor(session, first.result.resultID));
		assert.equal([...session._references.values()].filter(reference => reference.result).length, 1);
		assert.isTrue(provider.calledOnce);
	});
	
	it("should prepare one metadata snapshot per online result and keep the cache independent of actions", async function () {
		let session = await createSession();
		let item = new Zotero.Item('journalArticle');
		item.fromJSON({ itemType: 'journalArticle', title: 'Shared snapshot', DOI: '10.1234/shared-snapshot' });
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		stubOnlineCandidates([item]);
		let snapshot = sandbox.spy(BibliographyMatcher, 'createCandidateSnapshot');
		let parts = [{ text: 'doi:10.1234/shared-snapshot' }];
		let local = await session.matchReference({ requestID: 'snapshot-open', sourceKey: 'snapshot', referenceParts: parts });
		let found = await session.findOnline({ requestID: 'snapshot-find', referenceKey: local.referenceKey });
		assert.equal(found.status, 'strong');
		assert.isTrue(snapshot.calledOnce);
		let binding = bindingFor(session, found.result.resultID);
		let cached = JSON.parse(session._onlineMatchCache.get(parts[0].text));
		assert.deepEqual(cached, binding.candidateJSON);
		binding.candidateJSON.title = 'Changed action metadata';
		item.setField('title', 'Changed provider item');
		let evaluate = sandbox.stub(BibliographyMatcher, 'matchCandidates').throws(new Error('Unexpected re-evaluation'));
		session._removeReference(local.referenceKey);
		let reopened = await session.matchReference({ requestID: 'snapshot-reopen', sourceKey: 'snapshot', referenceParts: parts });
		assert.equal(reopened.result.display.title, 'Shared snapshot');
		assert.isTrue(snapshot.calledOnce, 'Restore reuses the cached snapshot');
		assert.isFalse(evaluate.called);
	});
	
	it("should cache plain provider metadata immediately and restore it without another provider call", async function () {
		let session = await createSession();
		let json = { itemType: 'journalArticle', title: 'Plain provider metadata',
			DOI: '10.1234/plain-cache', abstractNote: 'Retained provider abstract',
			creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' },
				{ creatorType: 'author', firstName: 'Grace', lastName: 'Hopper' }] };
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		let provider = stubOnlineCandidates([json]);
		let referenceParts = [{ text: 'doi:10.1234/plain-cache' }];
		let open = requestID => session.matchReference({ requestID, sourceKey: 'plain', referenceParts });
		let local = await open('plain-open');
		let found = await session.findOnline({ requestID: 'plain-find', referenceKey: local.referenceKey });
		assert.equal(found.status, 'strong');
		assert.equal(found.result.display.firstCreator,
			Zotero.getString('general.andJoiner', ['\u2068Lovelace\u2069', '\u2068Hopper\u2069']));
		assert.isTrue(session._onlineMatchCache.has(referenceParts.map(part => part.text).join('')));
		let prepareReference = sandbox.spy(BibliographyMatcher, 'prepareReference');
		let reopened = await open('plain-reopen');
		assert.equal(reopened.status, 'strong');
		assert.equal(reopened.lookupSource, 'online');
		assert.deepEqual(reopened.result.display, found.result.display);
		assert.notEqual(reopened.result.resultID, found.result.resultID);
		assert.isTrue(provider.calledOnce);
		assert.isFalse(prepareReference.called, 'Restoring verified metadata does not need citation matching analysis');
	});
	
	it("should cache and save the first equivalent online publication record", async function () {
		let data = { title: 'First-choice publication records', date: '2021', pages: '120-139',
			creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }] };
		let conference = { ...data, itemType: 'conferencePaper', proceedingsTitle: 'Collected Research on Bibliographic Methods',
			DOI: '10.1234/first-conference' };
		let journal = { ...data, itemType: 'journalArticle', publicationTitle: 'Journal of Bibliographic Systems',
			DOI: '10.1234/second-journal' };
		let provider = sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([conference, journal]);
		let session = await createSession();
		let referenceParts = [{ text: `Lovelace, Ada. 2021. ${data.title}. pp. 120-139.` }];
		let local = await session.matchReference({ requestID: 'first-open', sourceKey: 'reference', referenceParts });
		let found = await session.findOnline({ requestID: 'first-find', referenceKey: local.referenceKey });
		assert.equal(found.status, 'strong');
		assert.equal(bindingFor(session, found.result.resultID).candidateJSON.DOI, conference.DOI);
		let reopened = await session.matchReference({ requestID: 'first-reopen', sourceKey: 'reference', referenceParts });
		assert.equal(reopened.status, 'strong');
		assert.equal(bindingFor(session, reopened.result.resultID).candidateJSON.DOI, conference.DOI);
		assert.isTrue(provider.calledOnce);
		assert.equal(session._onlineMatchCache.size, 1);
		Zotero.Prefs.set('downloadAssociatedFiles', false);
		let added = await session.performAction({ requestID: 'first-add', referenceKey: reopened.referenceKey,
			resultID: reopened.result.resultID, action: 'add-to-library' });
		assert.equal(added.status, 'saved');
		let item = await Zotero.Items.getAsync(bindingFor(session, reopened.result.resultID).itemID);
		objects.push(item);
		assert.equal(item.getField('DOI'), conference.DOI);
		assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'conferencePaper');
	});
	
	it("should not publish or cache ambiguous online results", async function () {
		let session = await createSession();
		let referenceParts = [{ text: 'doi:10.1234/mixed-cache' }];
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline').resolves({ status: 'unmatched', reason: 'ambiguous' });
		let local = await session.matchReference({ requestID: 'open', sourceKey: 'reference', referenceParts });
		let found = await session.findOnline({ requestID: 'find', referenceKey: local.referenceKey });
		assert.equal(found.status, 'no-match');
		assert.notProperty(found, 'result');
		assert.equal(session._onlineMatchCache.size, 0);
		assert.notProperty(session._references.get(local.referenceKey), 'result');
		let reopened = await session.matchReference({ requestID: 'reopen', sourceKey: 'reference', referenceParts });
		assert.equal(reopened.status, 'no-match');
		assert.isTrue(provider.calledOnce);
	});
	
	for (let identifier of [true, false]) {
		it(`should reconcile fresh and cached online identity (${identifier ? 'DOI' : 'metadata'})`, async function () {
			let metadata = {
				itemType: 'journalArticle', title: 'Online identity: complete metadata', date: '2021',
				creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }],
				DOI: identifier ? '10.1234/online-identity' : '', abstractNote: 'Provider abstract',
			};
			let saved = await createItem({ ...metadata, publicationTitle: '', url: '',
				title: identifier ? 'Online identity' : metadata.title, abstractNote: 'Library abstract' });
			let transient = new Zotero.Item(metadata.itemType);
			transient.fromJSON(metadata);
			let session = await createSession();
			let local = sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
			let provider = stubOnlineCandidates([transient]);
			let duplicate = sandbox.spy(BibliographyMatcher, 'checkForDuplicate');
			let referenceParts = [{ text: `Lovelace, A. (2021). ${metadata.title}.` }];
			let open = requestID => session.matchReference({ requestID, sourceKey: 'online-identity', referenceParts });
			let first = await open('identity-open');
			let online = await session.findOnline({ requestID: 'identity-find', referenceKey: first.referenceKey });
			assert.equal(online.result.libraryState, 'existing');
			assert.equal(online.result.display.title, saved.getField('title'));
			assert.equal(online.result.display.abstract, 'Library abstract');
			assert.include(online.result.actions, 'show-in-library');
			assert.notInclude(online.result.actions, 'add-to-library');
			assert.isTrue(duplicate.calledOnce);
			assert.equal(JSON.parse(session._onlineMatchCache.get(referenceParts[0].text)).title, metadata.title);
			let reopened = await open('identity-reopen');
			assert.deepEqual(reopened.result.display, online.result.display);
			assert.deepEqual(reopened.result.actions, online.result.actions);
			assert.isTrue(duplicate.calledTwice);
			saved.deleted = true;
			await saved.saveTx();
			let deleted = await open('identity-deleted');
			assert.equal(deleted.result.libraryState, 'unsaved');
			assert.equal(deleted.result.display.title, metadata.title);
			assert.equal(deleted.result.display.abstract, 'Provider abstract');
			assert.isTrue(provider.calledOnce);
			assert.isTrue(local.calledOnce);
		});
	}
	
	it("should restore online metadata across popup replacement with fresh tokens and current library identity", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({ itemType: 'journalArticle', title: 'Recovered online work', DOI: '10.1234/cache' });
		let wrong = await createItem({ title: 'Approximate local alternative', DOI: '10.1234/other' });
		let session = await createSession();
		let localMatch = sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(strictMatch(wrong));
		let provider = stubOnlineCandidates([transient]);
		let parts = [{ text: 'doi:10.1234/cache' }];
		let open = requestID => session.matchReference({ requestID, sourceKey: 'same', referenceParts: parts });
		let first = await open('cache-open');
		let online = await session.findOnline({ requestID: 'cache-find', referenceKey: first.referenceKey });
		assert.equal(online.status, 'strong');
		let reopened = await open('cache-reopen');
		assert.equal(reopened.lookupSource, 'online');
		assert.equal(reopened.result.display.title, 'Recovered online work');
		assert.equal(reopened.result.libraryState, 'unsaved');
		assert.notEqual(reopened.referenceKey, first.referenceKey);
		assert.notEqual(reopened.result.resultID, online.result.resultID);
		assert.isFalse(!!bindingFor(session, online.result.resultID));
		let saved = await createItem({ title: 'Current edited saved title', DOI: '10.1234/cache' });
		sandbox.stub(saved, 'getBestAttachment').resolves(null);
		let current = await open('cache-saved');
		assert.equal(current.lookupSource, 'online');
		assert.equal(current.result.libraryState, 'existing');
		assert.equal(current.result.display.title, 'Current edited saved title');
		assert.include(current.result.actions, 'show-in-library');
		assert.notInclude(current.result.actions, 'add-to-library');
		assert.equal(localMatch.callCount, 1, 'A cache hit unnecessarily repeated local matching');
		assert.isTrue(provider.calledOnce);
		saved.deleted = true;
		await saved.saveTx();
		let deleted = await open('cache-deleted');
		assert.equal(deleted.result.libraryState, 'unsaved');
		session.dispose();
		assert.equal(session._onlineMatchCache.size, 0);
	});
	
	it("should retain session metadata and bindings until eviction while respecting visible text and permissions", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({ itemType: 'journalArticle', title: 'Cached work', DOI: '10.1234/cache-scope' });
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		let provider = stubOnlineCandidates([transient]);
		let parts = [{ text: 'doi:10.1234/cache-scope' }];
		let open = (requestID, referenceParts = parts) => session.matchReference({ requestID, sourceKey: 'same', referenceParts });
		let first = await open('scope-first');
		let found = await session.findOnline({ requestID: 'scope-find', referenceKey: first.referenceKey });
		let entry = session._onlineMatchCache.values().next().value;
		let loadURI = sandbox.stub();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { loadURI } });
		let valid = await session.performAction({ requestID: 'scope-valid-action', referenceKey: first.referenceKey,
			resultID: found.result.resultID, action: 'view-online' });
		assert.equal(valid.status, 'ok');
		assert.isTrue(loadURI.calledOnce);
		session._removeReference(first.referenceKey);
		let stale = await session.performAction({ requestID: 'scope-old-action', referenceKey: first.referenceKey,
			resultID: found.result.resultID, action: 'view-online' });
		assert.equal(stale.status, 'stale');
		let offline = sandbox.stub(Zotero.HTTP, 'browserIsOffline').returns(true);
		let primary = await open('scope-offline');
		assert.equal(primary.lookupSource, 'online');
		let secondary = await session.matchReference({ requestID: 'scope-secondary', sourceKey: 'secondary:same', referenceParts: parts });
		assert.equal(secondary.lookupSource, 'online');
		assert.notEqual(primary.result.resultID, secondary.result.resultID);
		assert.isTrue(!!bindingFor(session, primary.result.resultID), 'Split-view restoration invalidated the other owner');
		assert.notEqual(primary.referenceKey, first.referenceKey);
		assert.notEqual(primary.result.resultID, found.result.resultID);
		assert.strictEqual(session._onlineMatchCache.values().next().value, entry);
		offline.restore();
		assert.notProperty(await open('scope-text', [{ text: 'doi:10.1234/cache-scope ' }]), 'lookupSource');
		assert.equal((await open('scope-url', [{ text: parts[0].text, attributes: { url: 'https://example.invalid/' } }])).lookupSource, 'online');
		assert.equal((await open('scope-split', [{ text: 'doi:' }, { text: '10.1234/cache-scope' }])).lookupSource, 'online');
		let other = new ReaderReferenceSession(await Zotero.Items.getAsync(session._attachmentID));
		assert.notProperty(await other.matchReference({ requestID: 'other', sourceKey: 'same', referenceParts: parts }), 'lookupSource');
		other.dispose();
		assert.equal((await open('scope-still-retained')).lookupSource, 'online');
		assert.equal(session._onlineMatchCache.size, 1);
		assert.isTrue(provider.calledOnce);
	});
	
	it("should evict metadata at the fixed cap and never cache empty outcomes", async function () {
		let session = await createSession();
		let item = new Zotero.Item('journalArticle');
		item.fromJSON({ itemType: 'journalArticle', title: 'Bounded metadata' });
		sandbox.stub(ReaderReferenceSession, 'MAX_REFERENCES').value(2);
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline').resolves(strictMatch(item));
		for (let text of ['first', 'second', 'third']) {
			let local = await session.matchReference({ requestID: text, sourceKey: text, referenceParts: [{ text }] });
			await session.findOnline({ requestID: 'find-' + text, referenceKey: local.referenceKey });
		}
		assert.equal(session._onlineMatchCache.size, 2);
		assert.isFalse(session._onlineMatchCache.has('first'));
		assert.equal(session._references.size, 2);
		provider.resolves(unmatched()).resetHistory();
		let local = await session.matchReference({ requestID: 'empty', sourceKey: 'empty', referenceParts: [{ text: 'Missing work' }] });
		for (let requestID of ['empty-one', 'empty-two']) {
			assert.equal((await session.findOnline({ requestID, referenceKey: local.referenceKey })).status, 'no-match');
		}
		assert.isTrue(provider.calledTwice);
		assert.equal(session._onlineMatchCache.size, 2);
	});
	
	it("should retry failed reconciliation locally and honor permission changes during cache restoration", async function () {
		let session = await createSession();
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({ itemType: 'journalArticle', title: 'Cached permission work', DOI: '10.1234/cache-permission' });
		let wrong = await createItem({ DOI: '10.1234/other' });
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(strictMatch(wrong));
		let parts = [{ text: 'doi:10.1234/cache-permission' }];
		let open = requestID => session.matchReference({ requestID, sourceKey: 'permission', referenceParts: parts });
		cacheMatch(session, parts.map(part => part.text).join(''), strictMatch(transient));
		let duplicate = sandbox.stub(BibliographyMatcher, 'checkForDuplicate').rejects(new Error('Reconciliation failed'));
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline').rejects(new Error('Unexpected network retry'));
		let failed = await open('permission-failure');
		assert.equal(failed.lookupSource, 'online');
		assert.equal(failed.status, 'error');
		assert.notProperty(failed, 'result');
		assert.equal(session._onlineMatchCache.size, 1);
		assert.equal([...session._references.values()].filter(reference => reference.result).length, 0);
		duplicate.resolves({ status: 'absent' });
		let offline = sandbox.stub(Zotero.HTTP, 'browserIsOffline').returns(true);
		let retry = await session.findOnline({ requestID: 'permission-retry', referenceKey: failed.referenceKey });
		assert.equal(retry.status, 'strong');
		assert.equal(retry.result.display.title, 'Cached permission work');
		assert.isFalse(provider.called);
		let miss = await session.matchReference({ requestID: 'permission-offline-miss', sourceKey: 'uncached',
			referenceParts: [{ text: 'A different uncached reference' }] });
		assert.equal((await session.findOnline({ requestID: 'permission-offline-find',
			referenceKey: miss.referenceKey })).status, 'offline');
		assert.isFalse(provider.called, 'Offline cache miss reached a provider');
		session._removeReference(miss.referenceKey);
		offline.restore();
		let library = Zotero.Libraries.get(session._libraryID);
		let getLibrary = sandbox.stub(Zotero.Libraries, 'get').callThrough();
		getLibrary.withArgs(session._libraryID).returns({ editable: false });
		let readonly = await open('permission-readonly');
		assert.equal(readonly.lookupSource, 'online');
		assert.notInclude(readonly.result.actions, 'add-to-library');
		getLibrary.restore();
		assert.isTrue(library.editable);
		let release;
		duplicate.callsFake(() => new Promise(resolve => release = resolve));
		let disposed = open('permission-dispose-during-restore');
		await waitForCacheOperation(() => release);
		session.dispose();
		release({ status: 'absent' });
		assert.equal((await disposed).status, 'cancelled');
		assert.equal(session._onlineMatchCache.size, 0);
		assert.equal([...session._references.values()].filter(reference => reference.result).length, 0);
	});
	
	it("should not cache a cancelled explicit lookup or leak cancelled restoration bindings", async function () {
		let session = await createSession();
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({ itemType: 'journalArticle', title: 'Cancelled cache work', DOI: '10.1234/cache-cancel' });
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		let parts = [{ text: 'doi:10.1234/cache-cancel' }];
		let local = await session.matchReference({ requestID: 'cancel-open', sourceKey: 'cancel', referenceParts: parts });
		let release;
		sandbox.stub(onlineReferenceLookup, 'findOnline').callsFake(() => new Promise(resolve => release = resolve));
		let online = session.findOnline({ requestID: 'cancel-find', referenceKey: local.referenceKey });
		await waitForCacheOperation(() => release);
		session.cancel({ requestID: 'cancel-find' });
		release(strictMatch(transient));
		assert.equal((await online).status, 'cancelled');
		assert.equal(session._onlineMatchCache.size, 0);
		cacheMatch(session, parts.map(part => part.text).join(''), strictMatch(transient));
		release = null;
		sandbox.stub(BibliographyMatcher, 'checkForDuplicate').callsFake(() => new Promise(resolve => release = resolve));
		let reopened = session.matchReference({ requestID: 'cancel-restore', sourceKey: 'cancel', referenceParts: parts });
		await waitForCacheOperation(() => release);
		session.cancel({ requestID: 'cancel-restore' });
		release({ status: 'absent' });
		assert.equal((await reopened).status, 'cancelled');
		assert.equal([...session._references.values()].filter(reference => reference.result).length, 0);
	});
	
	it("should preserve metadata when another same-owner restoration supersedes a pending request", async function () {
		let session = await createSession();
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({ itemType: 'journalArticle', title: 'Retained across refresh', DOI: '10.1234/refresh-cache' });
		let referenceParts = [{ text: 'doi:10.1234/refresh-cache' }];
		cacheMatch(session, referenceParts.map(part => part.text).join(''), strictMatch(transient));
		let local = sandbox.stub(BibliographyMatcher, 'matchLibrary').rejects(new Error('Cache should be first'));
		let release;
		let duplicate = sandbox.stub(BibliographyMatcher, 'checkForDuplicate');
		duplicate.onFirstCall().callsFake(() => new Promise(resolve => release = resolve));
		duplicate.resolves({ status: 'absent' });
		let first = session.matchReference({ requestID: 'refresh-old', sourceKey: 'same', referenceParts });
		await waitForCacheOperation(() => release);
		let second = await session.matchReference({ requestID: 'refresh-new', sourceKey: 'same', referenceParts });
		release({ status: 'absent' });
		assert.equal((await first).status, 'cancelled');
		assert.equal(second.status, 'strong');
		assert.equal(second.lookupSource, 'online');
		assert.equal(session._onlineMatchCache.size, 1);
		assert.equal([...session._references.values()].filter(reference => reference.result).length, 1);
		assert.isTrue(!!bindingFor(session, second.result.resultID));
		assert.isFalse(local.called);
	});
	
	it("should retain verified metadata and allow recovery after a cached DTO failure", async function () {
		let session = await createSession();
		let item = new Zotero.Item('journalArticle');
		item.fromJSON({ itemType: 'journalArticle', title: 'Verified work' });
		let referenceParts = [{ text: 'Verified reference' }];
		cacheMatch(session, referenceParts[0].text, strictMatch(item));
		let raw = session._onlineMatchCache.values().next().value;
		sandbox.stub(BibliographyMatcher, 'checkForDuplicate').resolves({ status: 'absent' });
		let display = sandbox.stub(session, '_getDisplayMetadata').throws(new Error('Display failed'));
		let request = { sourceKey: 'reference', referenceParts };
		let failed = await session.matchReference({ ...request, requestID: 'failed' });
		assert.equal(failed.status, 'error');
		assert.equal(failed.lookupSource, 'online');
		assert.notProperty(failed, 'result');
		assert.notProperty(session._references.get(failed.referenceKey), 'result');
		assert.equal(session._onlineMatchCache.values().next().value, raw);
		display.restore();
		let restored = await session.matchReference({ ...request, requestID: 'retry' });
		assert.equal(restored.status, 'strong');
		assert.equal(restored.result.display.title, 'Verified work');
	});
	
	it("should preserve lookup failure statuses and existing actions without a result", async function () {
		let item = await createItem();
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(strictMatch(item));
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline');
		let local = await session.matchReference({ requestID: 'status-local', sourceKey: 'status',
			referenceParts: [{ text: item.getField('title') }] });
		let binding = bindingFor(session, local.result.resultID);
		for (let status of ['invalid', 'incomplete', 'offline', 'rate-limited', 'timeout', 'cancelled', 'error']) {
			provider.resolves({ status });
			let response = await session.findOnline({ requestID: `status-${status}`, referenceKey: local.referenceKey });
			assert.equal(response.status, status);
			assert.notProperty(response, 'result');
			assert.strictEqual(bindingFor(session, binding.resultID), binding);
			assert.equal(session._onlineMatchCache.size, 0);
		}
	});
	
	it("should not cache transient online failures", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle', title: 'Recovered result', DOI: '10.1234/recovered',
		});
		let session = await createSession();
		sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves(unmatched());
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline');
		provider.onFirstCall().resolves({ status: 'timeout' });
		provider.onSecondCall().resolves(strictMatch(transient));
		let local = await session.matchReference({
			requestID: 'local-transient-cache', sourceKey: 'reference-transient-cache',
			referenceParts: [{ text: 'doi:10.1234/recovered' }],
		});
		
		let first = await session.findOnline({
			requestID: 'online-transient-cache-1', referenceKey: local.referenceKey,
		});
		let second = await session.findOnline({
			requestID: 'online-transient-cache-2', referenceKey: local.referenceKey,
		});
		
		assert.equal(first.status, 'timeout');
		assert.equal(second.status, 'strong');
		assert.equal(provider.callCount, 2);
	});
	
	it("should allow explicit Find after a match, no-match, or incomplete local lookup", async function () {
		let item = await createItem();
		let remote = new Zotero.Item('journalArticle');
		remote.fromJSON({ itemType: 'journalArticle', title: 'Online work', DOI: '10.1234/remote' });
		let localMatcher = sandbox.stub(BibliographyMatcher, 'matchLibrary');
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline').resolves(strictMatch(remote));
		for (let outcome of [strictMatch(item), unmatched(), { status: 'incomplete' }]) {
			localMatcher.resolves(outcome);
			let session = await createSession();
			let callsBefore = provider.callCount;
			let local = await session.matchReference({ requestID: 'local', sourceKey: 'reference',
				referenceParts: [{ text: 'A reference' }] });
			assert.equal(local.status, { matched: 'strong', unmatched: 'no-match', incomplete: 'incomplete' }[outcome.status]);
			assert.equal(provider.callCount, callsBefore);
			let online = await session.findOnline({ requestID: 'online', referenceKey: local.referenceKey });
			assert.equal(online.status, 'strong');
			assert.equal(online.result.libraryState, 'unsaved');
			assert.equal(provider.callCount, callsBefore + 1);
			session.dispose();
		}
	});
	
	it("should reconcile an item added during online lookup without repeating citation matching", async function () {
		let transient = new Zotero.Item('journalArticle');
		transient.fromJSON({
			itemType: 'journalArticle', title: 'Remote result', DOI: '10.1234/remote-result',
		});
		let match = sandbox.stub(BibliographyMatcher, 'matchLibrary');
		match.onFirstCall().resolves(unmatched());
		let evaluate = sandbox.spy(BibliographyMatcher, 'matchCandidates');
		let existing;
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline')
			.callsFake(async (reference) => {
				existing = await createItem({ title: 'Remote result', DOI: '10.1234/remote-result' });
				match.resolves(strictMatch(existing));
				return BibliographyMatcher.matchCandidates(reference, [transient]);
			});
		let session = await createSession();
		let saver = sandbox.spy(Zotero.Translate, 'ItemSaver');
		let local = await session.matchReference({
			requestID: 'local-race', sourceKey: 'reference-race',
			referenceParts: [{ text: 'doi:10.1234/remote-result' }],
		});
		
		let response = await session.findOnline({
			requestID: 'online-race', referenceKey: local.referenceKey,
		});
		
		assert.equal(response.status, 'strong');
		assert.equal(response.result.libraryState, 'existing');
		assert.include(response.result.actions, 'show-in-library');
		assert.notInclude(response.result.actions, 'add-to-library');
		assert.isTrue(provider.calledOnce);
		assert.isTrue(evaluate.calledOnce);
		assert.isTrue(match.calledOnce);
		assert.equal(bindingFor(session, response.result.resultID).itemID, existing.id);
		assert.isFalse(saver.called);
	});
	it("should share identical Crossref translations without sharing caller cancellation", async function () {
		let controller = new AbortController();
		let release;
		let metadata = { itemType: 'journalArticle', title: 'Crossref shared translation', date: '2021',
			creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }] };
		let translate = sandbox.stub(onlineReferenceLookup, '_runTranslation').callsFake(() => (new Promise(resolve => release = resolve)));
		let text = 'Ada Lovelace. 2021. Crossref shared translation.';
		let first = getPromiseError(onlineReferenceLookup.findOnline(text, { signal: controller.signal }));
		let second = onlineReferenceLookup.findOnline(text);
		await waitForCacheOperation(() => release);
		controller.abort();
		assert.instanceOf(await first, Zotero.HTTP.CancelledException);
		release([metadata]);
		assert.equal((await second).status, 'matched');
		assert.isTrue(translate.calledOnce);
		assert.equal(onlineReferenceLookup._providerFlights.size, 0);
	});
	
	it("should preserve unreadable provider competitors rather than certify a partial pool", async function () {
		sandbox.stub(onlineReferenceLookup, '_translateIdentifier').resolves([
			{ itemType: 'journalArticle', title: 'Valid work', DOI: '10.1234/valid' }, null,
		]);
		sandbox.stub(onlineReferenceLookup, '_translateSearch').resolves([]);
		let result = await onlineReferenceLookup.findOnline('doi:10.1234/valid');
		assert.equal(result.status, 'incomplete');
		assert.notProperty(result, 'item');
	});
	
	it("should reject a duplicate pending lookup ID without invalidating the original reference", async function () {
		let item = await createItem();
		let session = await createSession();
		let release;
		sandbox.stub(BibliographyMatcher, 'matchLibrary').callsFake(() => new Promise(resolve => release = resolve));
		let request = { requestID: 'pending', sourceKey: 'reference', referenceParts: [{ text: 'A reference' }] };
		let first = session.matchReference(request);
		await waitForCacheOperation(() => release);
		assert.equal((await session.matchReference(request)).status, 'invalid');
		release(strictMatch(item));
		assert.equal((await first).status, 'strong');
	});
});

describe('Reader reference lookup', function () {
	let sandbox;
	let lookup = onlineReferenceLookup;
	let metadata = { itemType: 'journalArticle', title: 'Reference lookup boundary',
		DOI: '10.1234/lookup-boundary', date: '2020' };
	beforeEach(function () {
		sandbox = sinon.createSandbox();
		sandbox.stub(lookup, '_translateLandingPage').resolves([]);
	});
	afterEach(function () {
		sandbox.restore();
	});
	
	it('verifies the complete competing pool before returning a result', async function () {
		let candidates = [metadata, { ...metadata, DOI: '10.1234/competing', title: 'Competing work' }];
		sandbox.stub(lookup, '_translateIdentifier').resolves(candidates);
		sandbox.stub(lookup, '_translateSearch').resolves([]);
		let result = await lookup.findOnline('doi:' + metadata.DOI);
		assert.equal(result.status, 'matched');
		assert.equal(result.item.getField('DOI'), metadata.DOI);
		assert.notProperty(result, 'candidates');
		assert.notProperty(result, 'referenceKey');
		assert.notProperty(result, 'actions');
		assert.notProperty(result, 'display');
		let ambiguous = await lookup.findOnline('doi:' + metadata.DOI + ' doi:10.1234/competing');
		assert.equal(ambiguous.status, 'unmatched');
	});
	
	it('reuses a confirmed identifier outcome without verifying the same pool twice', async function () {
		let identifier = sandbox.stub(lookup, '_translateIdentifier').resolves([metadata]);
		let crossref = sandbox.stub(lookup, '_translateSearch').rejects(new Error('Unexpected fallback'));
		let verify = sandbox.spy(BibliographyMatcher, 'matchCandidates');
		let reference = 'doi:' + metadata.DOI;
		let result = await lookup.findOnline(reference);
		assert.equal(result.status, 'matched');
		assert.equal(result.item.getField('DOI'), metadata.DOI);
		assert.isTrue(verify.calledOnceWithExactly(reference, [metadata]));
		assert.isTrue(identifier.calledOnce);
		assert.isFalse(crossref.called);
	});

	it('adds only a verified publisher abstract and otherwise preserves the online match', async function () {
		let source = { ...metadata, url: `https://publisher.example/articles/${metadata.DOI}/full` };
		sandbox.stub(lookup, '_translateIdentifier').resolves([source]);
		let publisher = { ...source, title: 'Do not replace the verified title', abstractNote: 'Publisher abstract' };
		let landing = lookup._translateLandingPage;
		let baseline = BibliographyMatcher.createCandidateSnapshot(source);
		landing.resolves([publisher]);
		let enriched = await lookup.findOnline('doi:' + metadata.DOI);
		assert.equal(enriched.status, 'matched');
		assert.deepEqual(BibliographyMatcher.createCandidateSnapshot(enriched.item), { ...baseline, abstractNote: publisher.abstractNote });
		for (let result of [
			[{ ...publisher, DOI: '10.1234/other' }],
			[{ ...publisher, extra: 'DOI: 10.1234/other' }],
			[publisher, publisher],
			[{ ...publisher, abstractNote: 'x'.repeat(BibliographyMatcher.MAX_CANDIDATE_JSON_LENGTH) }],
			new Error('Publisher unavailable'),
		]) {
			if (result instanceof Error) landing.rejects(result);
			else landing.resolves(result);
			let match = await lookup.findOnline('doi:' + metadata.DOI);
			assert.equal(match.status, 'matched');
			assert.deepEqual(BibliographyMatcher.createCandidateSnapshot(match.item), baseline);
		}
		sandbox.stub(lookup, '_translateSearch').resolves([source]);
		lookup._translateIdentifier.resolves([]);
		landing.resolves([publisher]);
		let crossref = await lookup.findOnline('doi:' + metadata.DOI);
		assert.equal(crossref.item.getField('abstractNote'), publisher.abstractNote, 'Crossref matches are enriched too');
		lookup._translateIdentifier.resolves([{ ...source, abstractNote: 'Provider abstract' }]);
		landing.resetHistory();
		assert.equal((await lookup.findOnline(metadata.DOI)).item.getField('abstractNote'), 'Provider abstract');
		assert.isFalse(landing.called, 'existing abstracts do not start a publisher lookup');
	});

	it('bounds publisher enrichment and ignores results arriving after timeout or cancellation', async function () {
		sandbox.stub(lookup, '_translateIdentifier').resolves([metadata]);
		sandbox.stub(lookup, 'ABSTRACT_TIMEOUT_MS').value(20);
		let verify = sandbox.spy(BibliographyMatcher, 'matchCandidates');
		for (let cancel of [false, true]) {
			let started = Zotero.Promise.defer(), reply = Zotero.Promise.defer();
			lookup._translateLandingPage.callsFake(() => {
				started.resolve();
				return reply.promise;
			});
			let controller = new AbortController();
			let pending = lookup.findOnline(metadata.DOI, { signal: controller.signal });
			let failure = cancel && getPromiseError(pending);
			await started.promise;
			if (cancel) {
				controller.abort();
				assert.instanceOf(await failure, Zotero.HTTP.CancelledException);
			}
			else assert.equal((await pending).status, 'matched');
			let item = verify.lastCall.returnValue.item;
			reply.resolve([{ ...metadata, abstractNote: 'Too late' }]);
			await Zotero.Promise.delay(0);
			assert.equal(item.getField('abstractNote'), '', 'late enrichment cannot mutate delivered metadata');
		}
	});

	it('keeps failed or incomplete retrieval distinct from a searched empty pool', async function () {
		sandbox.stub(lookup, '_translateIdentifier').resolves([]);
		let provider = sandbox.stub(lookup, '_translateSearch');
		for (let status of ['timeout', 'error', 'incomplete']) {
			let error = status === 'timeout' ? new Zotero.HTTP.TimeoutException(10) : new Error('Provider failure');
			if (status === 'incomplete') error.name = 'IncompleteCandidatePoolError';
			provider.rejects(error);
			assert.deepEqual(await lookup.findOnline(metadata.DOI), { status });
		}
		provider.resolves([]);
		let empty = await lookup.findOnline(metadata.DOI);
		assert.equal(empty.status, 'unmatched');
		assert.notProperty(empty, 'item');
	});
	
	['identifier', 'crossref'].forEach((route) => {
		it(`does not return ${route} results after caller cancellation`, async function () {
			let controller = new AbortController();
			let identifier = sandbox.stub(lookup, '_translateIdentifier').resolves([]);
			let crossref = sandbox.stub(lookup, '_translateSearch').resolves([]);
			(route === 'identifier' ? identifier : crossref).callsFake(async () => {
				controller.abort();
				return [metadata];
			});
			let error = await getPromiseError(lookup.findOnline(metadata.DOI, { signal: controller.signal }));
			assert.instanceOf(error, Zotero.HTTP.CancelledException);
		});
	});
	
	it('rejects an already cancelled lookup even when the citation is invalid', async function () {
		let controller = new AbortController();
		assert.deepEqual(await lookup.findOnline(''), { status: 'invalid' });
		controller.abort();
		let error = await getPromiseError(lookup.findOnline('', { signal: controller.signal }));
		assert.instanceOf(error, Zotero.HTTP.CancelledException);
	});
});

describe('Reader reference translators', function () {
	let sandbox;
	let identifier = { DOI: '10.1234/provider-abstract' };
	let candidate = () => ({
		itemType: 'journalArticle', ...identifier, title: 'Verified baseline title',
		date: '2020', url: 'https://publisher.example/article', abstractNote: 'Provider abstract',
		creators: [{ firstName: 'Jane', lastName: 'Example', creatorType: 'author' }],
	});
	let response = (url, data) => ({
		status: 200, statusText: 'OK', responseURL: url, response: data,
		responseText: typeof data === 'string' ? data : JSON.stringify(data),
		getAllResponseHeaders: () => 'content-type: application/json\r\n',
		getResponseHeader: () => null,
	});
	
	beforeEach(function () {
		sandbox = sinon.createSandbox();
		let translator = buildDummyTranslator('search', `
			function detectSearch() { return true; }
			async function doSearch() {
				let data = await ZU.requestJSON('https://metadata.example/search');
				let item = new Zotero.Item(data.itemType);
				Object.assign(item, data);
				item.complete();
			}
		`);
		sandbox.stub(Zotero.Translate.Search.prototype, 'getTranslators').resolves([translator]);
	});
	
	afterEach(function () {
		sandbox.restore();
		assert.equal(onlineReferenceLookup._providerFlights.size, 0);
	});
	
	it('previews identifier metadata without saving or following its publisher URL', async function () {
		let request = sandbox.stub(Zotero.HTTP, 'request')
			.callsFake(async (method, url) => response(url, candidate()));
		let count = await Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM items');
		let result = await onlineReferenceLookup.findOnline('doi:' + identifier.DOI);
		assert.equal(result.status, 'matched');
		assert.property(result, 'item');
		assert.equal(result.item.getField('abstractNote'), 'Provider abstract');
		assert.equal(await Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM items'), count);
		assert.isTrue(request.calledOnce);
		assert.equal(request.firstCall.args[1], 'https://metadata.example/search');
	});

	it('loads the DOI landing page and translates its abstract without saving items', async function () {
		let doc = new DOMParser().parseFromString(`<!DOCTYPE html>
			<meta name="citation_doi" content="${identifier.DOI}">
			<meta name="description" content="Publisher abstract">`, 'text/html');
		let translator = buildDummyTranslator('web', `
			function detectWeb() { return 'journalArticle'; }
			function doWeb(doc) {
				let item = new Zotero.Item('journalArticle');
				item.title = 'Publisher title';
				item.DOI = doc.querySelector('meta[name="citation_doi"]').content;
				item.abstractNote = doc.querySelector('meta[name="description"]').content;
				item.complete();
			}
		`, { translatorID: 'publisher-abstract-test' });
		sandbox.stub(Zotero.Translate.Web.prototype, 'getTranslators').resolves([translator]);
		let request = sandbox.stub(Zotero.HTTP, 'request').callsFake(async (method, url) => (
			url === 'https://metadata.example/search'
				? response(url, { ...candidate(), abstractNote: '' })
				: { ...response('https://publisher.example/article', ''), response: doc }
		));
		let count = await Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM items');
		let match = await onlineReferenceLookup.findOnline('doi:' + identifier.DOI);
		assert.equal(match.status, 'matched');
		assert.equal(match.item.getField('title'), candidate().title);
		assert.equal(match.item.getField('abstractNote'), 'Publisher abstract');
		assert.isTrue(request.calledTwice);
		assert.equal(request.secondCall.args[1], 'https://doi.org/' + encodeURIComponent(identifier.DOI));
		assert.equal(request.secondCall.args[2].responseType, 'document');
		assert.equal(await Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM items'), count);
	});

	it('reuses an outstanding identifier request after timeout or cancellation', async function () {
		for (let cancel of [false, true]) {
			let started = Zotero.Promise.defer();
			let reply = Zotero.Promise.defer();
			let request = sandbox.stub(Zotero.HTTP, 'request').callsFake(async (method, url) => {
				started.resolve();
				return response(url, await reply.promise);
			});
			let controller = new AbortController();
			let first = getPromiseError(onlineReferenceLookup._runProvider(
				() => onlineReferenceLookup._translateIdentifier(identifier), controller.signal, cancel ? 5000 : 100
			));
			try {
				await started.promise;
				if (cancel) controller.abort();
				assert.instanceOf(await first, cancel ? Zotero.HTTP.CancelledException : Zotero.HTTP.TimeoutException);
				let reopened = onlineReferenceLookup._translateIdentifier({ ...identifier });
				reply.resolve(candidate());
				assert.equal((await reopened)[0].abstractNote, 'Provider abstract');
				assert.isTrue(request.calledOnce);
			}
			finally {
				reply.resolve(candidate());
				await Promise.allSettled([...onlineReferenceLookup._providerFlights.values()]);
				request.restore();
			}
		}
	});
	
	it('does not certify an empty pool when a standard translator hides a transport failure', async function () {
		let request = sandbox.stub(Zotero.HTTP, 'request').rejects(new Error('Fixture network failure'));
		let error = await getPromiseError(onlineReferenceLookup._translateIdentifier(identifier));
		assert.equal(String(error), new Zotero.Translate.Search().ERROR_NO_RESULTS);
		assert.equal(onlineReferenceLookup._providerFlights.size, 0);
		let result = await onlineReferenceLookup.findOnline('doi:' + identifier.DOI + ' doi:10.1234/another');
		assert.equal(result.status, 'incomplete');
		request.callsFake(async (method, url) => response(url, candidate()));
		assert.lengthOf(await onlineReferenceLookup._translateIdentifier(identifier), 1);
	});
	
	it('runs the packaged Crossref translator through the standard framework', async function () {
		let source = await Zotero.File.getContentsFromURLAsync('resource://app/translators/Crossref%20REST.js');
		let metadata = JSON.parse(/^\s*{[\S\s]*?}\s*?[\r\n]/.exec(source)[0]);
		metadata.cacheCode = true;
		let translator = Zotero.Translators.load(metadata, null, source);
		let data = JSON.stringify({ status: 'ok', message: { items: Array.from({ length: 20 }, (_, i) => ({
			type: 'journal-article', title: [`Fixture title ${i}`], DOI: i ? `10.1234/provider-${i}` : identifier.DOI,
			author: [{ given: 'Jane', family: 'Example' }], issued: { 'date-parts': [[2020]] },
			abstract: '<jats:p>Crossref abstract</jats:p>',
		})) } });
		// The unchanged Crossref translator uses the legacy callback API.
		let request = sandbox.stub(Zotero.HTTP, 'doGet').callsFake((url, callback) => {
			let xhr = response(url, data);
			Zotero.Promise.resolve().then(() => callback(xhr));
			return xhr;
		});
		let result = await onlineReferenceLookup._translateSearch({ search: { itemType: 'document', query: 'Fixture title' }, translator });
		assert.lengthOf(result, 20, 'The standard Crossref result pool must not be truncated to five choices');
		assert.equal(result[0].DOI, identifier.DOI);
		assert.include(result[0].abstractNote, 'Crossref abstract');
		assert.isTrue(request.calledOnce);
		assert.include(request.firstCall.args[0], 'query.bibliographic=Fixture%20title');
		assert.notInclude(request.firstCall.args[0], 'rows=');
	});
});

describe("Reader reference identity and saving", function () {
	let sandbox, items, sessions;
	let libraryID;
	let candidate = (changes = {}) => ({
		itemType: 'journalArticle', title: 'Structured identity regression', date: '2021',
		creators: [{ creatorType: 'author', firstName: 'Alice', lastName: 'Smith' }],
		...changes,
	});
	beforeEach(function () {
		libraryID = Zotero.Libraries.userLibraryID;
		sandbox = sinon.createSandbox();
		items = [];
		sessions = [];
		Zotero.Prefs.set('downloadAssociatedFiles', false);
	});
	afterEach(async function () {
		for (let session of sessions) session.dispose();
		sandbox.restore();
		Zotero.Prefs.clear('downloadAssociatedFiles');
		for (let item of items.reverse()) if (Zotero.Items.exists(item.id)) await item.eraseTx();
	});
	async function store(json) {
		let item = new Zotero.Item(json.itemType);
		item.libraryID = libraryID;
		item.fromJSON(json);
		await item.saveTx();
		items.push(item);
		return item;
	}
	async function save(json) {
		let result = await referenceSaver.saveCandidate(json, { libraryID });
		if (!result.existing) items.push(result.item);
		return result;
	}
	function findDuplicate(json) {
		return BibliographyMatcher.checkForDuplicate(BibliographyMatcher.createCandidateSnapshot(json), libraryID);
	}
	async function sessionFor(json, existing = false) {
		let attachment = new Zotero.Item('attachment');
		attachment.libraryID = libraryID;
		attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_URL;
		attachment.setField('url', 'https://example.invalid/source.pdf');
		await attachment.saveTx();
		items.push(attachment);
		let session = new ReaderReferenceSession(attachment);
		sessions.push(session);
		let item = existing ? json : new Zotero.Item(json.itemType);
		if (!existing) item.fromJSON(json);
		let referenceKey = session._replaceReference('reference', item.getField('title', false, true));
		let service = existing ? BibliographyMatcher : onlineReferenceLookup;
		let method = existing ? 'matchLibrary' : 'findOnline';
		let lookup = sandbox.stub(service, method).resolves({ status: 'matched', item });
		let response;
		try {
			response = await session._lookup({ requestID: 'fixture' }, referenceKey, !existing);
		}
		finally {
			lookup.restore();
		}
		let result = response.result;
		return { session, referenceKey, resultID: result.resultID, result };
	}
	it("saves distinct full creators separately and coalesces only identical candidates", async function () {
		let alice = candidate();
		let bob = candidate({ creators: [{ creatorType: 'author', firstName: 'Bob', lastName: 'Smith' }] });
		let [a, b, repeated] = await Promise.all([save(alice), save(bob), save(alice)]);
		assert.isFalse(a.existing);
		assert.isFalse(b.existing);
		assert.isTrue(repeated.existing);
		assert.notEqual(a.item.id, b.item.id);
		assert.equal(a.item.id, repeated.item.id);
		assert.equal(b.item.getCreators()[0].firstName, 'Bob');
		assert.lengthOf(BibliographyMatcher.deduplicateCandidates([alice, bob]), 2);
	});
	it("preserves complete schema metadata independently of display limits", async function () {
		let json = candidate({ itemType: 'preprint', abstractNote: 'x'.repeat(2100), repository: 'Research archive', archiveID: '12345' });
		let result = await save(json);
		assert.equal(result.item.getField('abstractNote'), json.abstractNote);
		assert.equal(result.item.getField('repository'), json.repository);
		assert.equal(result.item.getField('archiveID'), json.archiveID);
		let { result: dto } = await sessionFor(result.item, true);
		assert.equal(dto.display.abstract, json.abstractNote);
	});
	it("keeps different item types with the same mapped title distinct", async function () {
		await store({ itemType: 'case', caseName: 'École proceedings', dateDecided: '2021' });
		let json = candidate({ title: 'École proceedings' });
		assert.equal((await findDuplicate(json)).status, 'absent');
		let saved = await save(json);
		assert.isFalse(saved.existing);
		assert.equal(saved.item.itemType, 'journalArticle');
	});
	
	it("saves and restores mapped-title candidates through the popup lifecycle", async function () {
		for (let itemType of ['case', 'email', 'statute']) {
			let field = Zotero.ItemFields.getName(Zotero.ItemFields.getFieldIDFromTypeAndBase(itemType, 'title'));
			let json = { itemType, [field]: `Online ${itemType}`, extra: `DOI: 10.1234/mapped-${itemType}` };
			let { session, referenceKey } = await sessionFor(json);
			let item = new Zotero.Item(itemType);
			item.fromJSON(json);
			let provider = sandbox.stub(onlineReferenceLookup, 'findOnline')
				.resolves({ status: 'matched', item });
			let found = await session.findOnline({ requestID: 'mapped-find', referenceKey });
			assert.equal(found.status, 'strong');
			assert.equal(found.result.display.title, json[field]);
			let reopened = await session.matchReference({ requestID: 'mapped-reopen', sourceKey: 'mapped',
				referenceParts: [{ text: session._references.get(referenceKey).text }] });
			assert.equal(reopened.lookupSource, 'online');
			let added = await session.performAction({ requestID: 'mapped-add', referenceKey: reopened.referenceKey,
				resultID: reopened.result.resultID, action: 'add-to-library' });
			assert.equal(added.status, 'saved');
			let saved = await Zotero.Items.getAsync(session._references.get(reopened.referenceKey).result.itemID);
			items.push(saved);
			assert.equal(saved.getField('title', false, true), json[field]);
			assert.equal((await findDuplicate(json)).item.id, saved.id);
			provider.restore();
		}
	});
	
	it("uses mapped titles and dates for structured identity without identifiers", async function () {
		let creatorType = Zotero.CreatorTypes.getName(Zotero.CreatorTypes.getPrimaryIDForType(Zotero.ItemTypes.getID('case')));
		let json = { itemType: 'case', caseName: 'Mapped identity', dateDecided: '2021',
			creators: [{ creatorType, firstName: 'Ada', lastName: 'Example' }] };
		let item = await store(json);
		let duplicate = await findDuplicate(json);
		assert.equal(duplicate.status, 'matched');
		assert.equal(duplicate.item.id, item.id);
		assert.equal((await findDuplicate({ ...json, dateDecided: '2022' })).status, 'absent');
	});
	
	it("distinguishes mapped volume and page fields with incomplete creator names", async function () {
		let creatorType = Zotero.CreatorTypes.getName(Zotero.CreatorTypes.getPrimaryIDForType(Zotero.ItemTypes.getID('case')));
		let json = { itemType: 'case', caseName: 'Mapped locator identity', dateDecided: '2021',
			reporterVolume: '1', firstPage: '10', creators: [{ creatorType, firstName: 'A', lastName: 'Example' }] };
		let item = await store(json);
		assert.equal((await findDuplicate(json)).item.id, item.id);
		for (let fields of [{ reporterVolume: '2' }, { firstPage: '11' }]) {
			assert.equal((await findDuplicate({ ...json, ...fields })).status, 'absent');
		}
	});
	
	it("preserves all 250 creators through online registration and a real metadata save", async function () {
		let json = candidate({
			title: 'Large collaborative author list',
			creators: Array.from({ length: 250 }, (_, index) => ({
				creatorType: 'author', firstName: `Given ${index}`, lastName: `Family ${index}`,
			})),
			abstractNote: 'Complete abstract. '.repeat(1500).trim(),
		});
		let { session, referenceKey, resultID, result } = await sessionFor(json);
		assert.deepEqual(session._references.get(referenceKey).result.candidateJSON.creators, json.creators);
		assert.lengthOf(result.display.abstract, ReaderReferenceSession.MAX_ABSTRACT_LENGTH);
		assert.isTrue(result.display.abstract.endsWith('…'));
		let response = await session.performAction({ requestID: 'large-save', referenceKey, resultID, action: 'add-to-library' });
		assert.equal(response.status, 'saved');
		let saved = await Zotero.Items.getAsync(session._references.get(referenceKey).result.itemID);
		items.push(saved);
		assert.deepEqual(saved.getCreators().map(({ creatorTypeID, firstName, lastName }) => ({
			creatorType: Zotero.CreatorTypes.getName(creatorTypeID), firstName, lastName,
		})), json.creators);
		assert.equal(saved.getField('abstractNote'), json.abstractNote);
	});
	it("rejects oversized matched metadata before publication or persistence", async function () {
		let oversized = candidate({ title: 'Oversized metadata', abstractNote: 'x'.repeat(256 * 1024 + 1) });
		let saver = sandbox.spy(Zotero.Translate, 'ItemSaver');
		let error = await getPromiseError(save(oversized));
		assert.include(String(error), 'candidate payload limit');
		assert.isFalse(saver.called);
		let { session, referenceKey } = await sessionFor(candidate());
		delete session._references.get(referenceKey).result;
		session._onlineMatchCache.clear();
		let item = new Zotero.Item(oversized.itemType);
		item.fromJSON(oversized);
		sandbox.stub(onlineReferenceLookup, 'findOnline').resolves({ status: 'matched', item });
		let response = await session.findOnline({ requestID: 'oversized', referenceKey });
		assert.equal(response.status, 'error');
		assert.notProperty(response, 'result');
		assert.notProperty(session._references.get(referenceKey), 'result');
		assert.equal(session._onlineMatchCache.size, 0);
		assert.isFalse(saver.called);
	});
	
	it("requires same structured record identity before suppressing Add for a shared ISBN", async function () {
		let creators = [{ creatorType: 'author', firstName: 'Jayeeta', lastName: 'Chattopadhyay' },
			{ creatorType: 'author', firstName: 'Nimmy', lastName: 'Srivastava' }];
		let book = await store({ itemType: 'book', title: 'Application of Nanomaterials in Chemical Sensors and Biosensors',
			creators, date: '2021-07-23', ISBN: '9781003009085', extra: 'DOI: 10.1201/9781003009085' });
		let chapter = { itemType: 'bookSection', title: 'Nanomaterials as Heavy Metal Sensors in Water',
			creators, date: '2021', bookTitle: book.getField('title'), ISBN: '9781003009085' };
		let sibling = await store({ ...chapter, title: 'A different chapter in the same edition' });
		assert.equal((await findDuplicate(chapter)).status, 'absent');
		let { session, referenceKey, resultID } = await sessionFor(chapter);
		let response = await session.performAction({ requestID: 'add-isbn-chapter', referenceKey, resultID, action: 'add-to-library' });
		assert.equal(response.status, 'saved');
		let saved = await Zotero.Items.getAsync(session._references.get(referenceKey).result.itemID);
		items.push(saved);
		assert.notEqual(saved.id, book.id);
		assert.notEqual(saved.id, sibling.id);
		assert.equal(saved.getField('title'), chapter.title);
		assert.equal(saved.itemType, 'bookSection');
		let duplicate = await findDuplicate(chapter);
		assert.equal(duplicate.status, 'matched');
		assert.equal(duplicate.item.id, saved.id);
		let lookup = await session.matchReference({ requestID: 'isbn-only-popup', sourceKey: 'isbn-only',
			referenceParts: [{ text: `ISBN ${chapter.ISBN}` }] });
		assert.notEqual(lookup.status, 'strong');
	});
	it("does not suggest a differently titled shared-ISBN sibling or suppress Add", async function () {
		let authors = ['Adam Jorgensen', 'Jorge Segarra', 'Patrick LeBlanc', 'Jose Chinchilla', 'Aaron Nelson']
			.map((name) => {
				let [firstName, lastName] = name.split(' '); return { firstName, lastName, creatorType: 'author' };
			});
		let json = { itemType: 'bookSection', title: 'Laying the Foundations', creators: authors,
			date: 'August 28, 2012', bookTitle: 'Microsoft SQL Server 2012 Bible', ISBN: '9781118282175' };
		await store({ ...json, title: 'The World of SQL Server' });
		let { session } = await sessionFor(json);
		let text = [json.title,
			authors.map(c => `${c.firstName} ${c.lastName}`).join('; '),
			json.date,
			json.bookTitle,
			`ISBN ${json.ISBN}`].join('. ');
		let network = ['request', 'doGet', 'doPost'].map(method => sandbox.stub(Zotero.HTTP, method)
			.throws(new Error('Local identity check must not request the network')));
		let lookup = await session.matchReference({ requestID: 'sibling', sourceKey: 'sibling', referenceParts: [{ text }] });
		assert.equal(lookup.status, 'no-match');
		assert.notProperty(lookup, 'result');
		assert.equal((await findDuplicate(json)).status, 'absent');
		assert.isTrue(network.every(stub => !stub.called));
	});
	it("keeps ISBN-matched incomplete structured identity unresolved instead of silently adding a duplicate", async function () {
		let json = candidate({ itemType: 'book', ISBN: '9781118282175' });
		let item = await store(json);
		assert.equal((await findDuplicate({ ...json, ISBN: '1118282175' })).item.id, item.id);
		assert.equal((await findDuplicate({ ...json, creators: [] })).status, 'unresolved');
	});
	it("reuses normalized ISBN titles and blocks uncertain identity without saving duplicate metadata", async function () {
		let json = candidate({ itemType: 'book', ISBN: '9781118282175' });
		let item = await store(json);
		assert.equal((await findDuplicate(json)).item.id, item.id);
		let saver = sandbox.spy(Zotero.Translate, 'ItemSaver');
		for (let [changes, expected] of [
			[{ title: json.title + '.' }, 'unresolved'],
			[{ title: json.title.toUpperCase() }, 'matched'],
			[{ title: json.title.replaceAll(' ', '  ') }, 'matched'],
			[{ date: '2021-01-01' }, 'unresolved'],
		]) {
			let variant = { ...json, ...changes };
			let duplicate = await findDuplicate(variant);
			assert.equal(duplicate.status, expected);
			if (expected === 'matched') assert.equal(duplicate.item.id, item.id);
			let { session, referenceKey, resultID, result } = await sessionFor(variant);
			if (expected === 'matched') {
				assert.equal(result.libraryState, 'existing');
				assert.notInclude(result.actions, 'add-to-library');
				assert.equal(session._references.get(referenceKey).result.itemID, item.id);
			}
			else {
				let response = await session.performAction({ requestID: 'add-variant', referenceKey, resultID, action: 'add-to-library' });
				assert.equal(response.status, 'duplicate-conflict');
			}
		}
		assert.isFalse(saver.called);
	});
	it("bounds the union of ISBN and title candidates before structured inspection", async function () {
		let matcher = BibliographyMatcher;
		let first = await store(candidate());
		let second = await store(candidate({ title: 'Other retrieved record' }));
		sandbox.stub(matcher, 'MAX_CANDIDATES').value(1);
		sandbox.stub(matcher, '_searchByIdentifiers').resolves({ ids: [first.id], incomplete: false });
		sandbox.stub(matcher, '_searchByExactTitle').resolves({ ids: [second.id], incomplete: false });
		assert.deepEqual(await findDuplicate(candidate()), { status: 'unresolved', reason: 'incomplete' });
	});
	it("finds identifierless title variants without weakening structured identity", async function () {
		let json = candidate();
		let item = await store({ ...json, title: json.title.replaceAll(' ', '  ') });
		assert.equal((await findDuplicate(json)).item.id, item.id);
		assert.equal((await findDuplicate({ ...json, title: json.title + '.' })).status, 'unresolved');
		assert.equal((await findDuplicate({ ...json, title: 'Structured regression' })).status, 'absent');
	});
	it("ignores local abstract size for identity but still bounds incoming candidates", async function () {
		let json = candidate();
		let large = { ...json, abstractNote: 'x'.repeat(BibliographyMatcher.MAX_CANDIDATE_JSON_LENGTH + 1) };
		let item = await store(large);
		assert.equal((await findDuplicate(json)).item.id, item.id);
		assert.throws(() => BibliographyMatcher.createCandidateSnapshot(large), /payload limit/);
	});
	it("finds a URL identifier without artificial citation or title-length limits", async function () {
		let original = await store(candidate({ DOI: '10.1234/structured-long' }));
		let json = candidate({
			title: 'Long title '.repeat(100), url: 'https://doi.org/10.1234/structured-long',
			creators: Array.from({ length: 100 }, (_, i) => ({ creatorType: 'author', firstName: 'Longgivenname', lastName: `Family${i}` })),
		});
		let result = await findDuplicate(json);
		assert.equal(result.status, 'matched');
		assert.equal(result.item.id, original.id);
	});
	it("blocks Add for an ambiguous identifier and preserves the unsaved result", async function () {
		let json = candidate({ DOI: '10.1234/duplicate-conflict' });
		await store(json);
		await store(json);
		let { session, referenceKey, resultID } = await sessionFor(json);
		let saver = sandbox.spy(Zotero.Translate, 'ItemSaver');
		let response = await session.performAction({ requestID: 'add', referenceKey, resultID, action: 'add-to-library' });
		assert.equal(response.status, 'duplicate-conflict');
		assert.isFalse(saver.called);
		assert.notProperty(session._references.get(referenceKey).result, 'itemID');
		assert.property(session._references.get(referenceKey).result, 'candidateJSON');
	});
	it("keeps missing or initial-only creator identity unresolved", async function () {
		await store(candidate());
		for (let creators of [[],
			[{ creatorType: 'author', firstName: 'A', lastName: 'Smith' }],
			[{ creatorType: 'author', firstName: 'Alice Jane', lastName: 'Smith' }]]) {
			let response = await findDuplicate(candidate({ creators }));
			assert.equal(response.status, 'unresolved');
		}
	});
	it("rejects invalid save input before identity checks or persistence", async function () {
		let duplicate = sandbox.spy(BibliographyMatcher, 'checkForDuplicate');
		let saver = sandbox.spy(Zotero.Translate, 'ItemSaver');
		let error = await getPromiseError(save({}));
		assert.match(error.message, /missing required bibliographic fields/);
		assert.isFalse(duplicate.called);
		assert.isFalse(saver.called);
	});
	it("treats duplicate lookup bounds as unresolved", async function () {
		sandbox.stub(BibliographyMatcher, 'MAX_CANDIDATES').value(3);
		for (let i = 0; i <= BibliographyMatcher.MAX_CANDIDATES; i++) {
			await store(candidate({ DOI: `10.1234/overflow-${i}` }));
		}
		let result = await findDuplicate(candidate());
		assert.deepEqual(result, { status: 'unresolved', reason: 'incomplete' });
		let exact = await findDuplicate(candidate({ DOI: '10.1234/overflow-0' }));
		assert.equal(exact.status, 'matched');
		assert.equal(exact.item.getField('DOI'), '10.1234/overflow-0');
	});
	it("uses only open-access and opted-in custom resolvers for automatic acquisition while preserving the manual path", async function () {
		Zotero.Prefs.set('downloadAssociatedFiles', true);
		let custom;
		let originalGet = Zotero.Prefs.get.bind(Zotero.Prefs);
		sandbox.stub(Zotero.Prefs, 'get').callsFake((name, ...args) => (
			name === 'findPDFs.resolvers' ? JSON.stringify([custom]) : originalGet(name, ...args)
		));
		let http = sandbox.stub(Zotero.HTTP, 'request').resolves({ response: new DOMParser().parseFromString(
			'<a href="https://files.example/custom.pdf">PDF</a>', 'text/html'
		) });
		let oa = sandbox.stub(Zotero.Utilities.Internal, 'getOpenAccessPDFURLs').resolves([
			{ url: 'https://files.example/oa.pdf' },
		]);
		let methods;
		sandbox.stub(Zotero.Attachments, 'addFileFromURLs').callsFake(async (item, resolvers) => {
			assert.isTrue(Zotero.Items.exists(item.id));
			methods = [];
			for (let resolver of resolvers) {
				let resolved = typeof resolver === 'function' ? await resolver() : [resolver];
				methods.push(...resolved.map(value => value.accessMethod));
			}
			return false;
		});
		let saved;
		for (let automatic of [false, undefined, true]) {
			custom = {
				name: 'Synthetic custom resolver', method: 'GET',
				url: 'https://resolver.example/{doi}', mode: 'html', selector: 'a', attribute: 'href',
				...(automatic === undefined ? {} : { automatic }),
			};
			http.resetHistory();
			saved = await save(candidate({ title: `Resolver opt-in ${automatic}`,
				DOI: `10.1234/automatic-${automatic}`, url: 'https://publisher.example/article' }));
			await saved.fileAcquisitionPromise;
			assert.sameMembers(methods, automatic === true ? ['oa', custom.name] : ['oa']);
			assert.equal(http.callCount, automatic === true ? 1 : 0);
		}
		assert.equal(oa.callCount, 3);
		custom.automatic = false;
		await Zotero.Attachments.addAvailableFile(saved.item);
		assert.includeMembers(methods, ['doi', 'url', 'oa', custom.name]);
	});
	
	it("runs automatic file resolvers after metadata commit without holding unrelated saves", async function () {
		Zotero.Prefs.set('downloadAssociatedFiles', true);
		let finish;
		let pending = new Promise(resolve => finish = resolve);
		let acquisition = sandbox.stub(Zotero.Attachments, 'addFileFromURLs').callsFake(async () => {
			await pending;
			return false;
		});
		let first = save(candidate({ DOI: '10.1234/file', url: 'https://example.invalid/item' }));
		try {
			await waitForCallback(() => acquisition.called, 10, 5);
			let [item, resolvers] = acquisition.firstCall.args;
			assert.isTrue(Zotero.Items.exists(item.id));
			assert.notInclude(resolvers.map(resolver => resolver.accessMethod), 'doi');
			assert.notInclude(resolvers.map(resolver => resolver.accessMethod), 'url');
			Zotero.Prefs.set('downloadAssociatedFiles', false);
			let second = await save(candidate({ title: 'Unrelated metadata save' }));
			assert.isFalse(second.existing);
			assert.isFalse((await first).existing);
		}
		finally {
			finish();
			await (await first).fileAcquisitionPromise;
		}
	});
	it("completes Add before background PDF acquisition and refreshes a reopened result", async function () {
		Zotero.Prefs.set('downloadAssociatedFiles', true);
		let finish;
		let pending = new Promise(resolve => finish = resolve);
		let acquisition = sandbox.stub(Zotero.Attachments, 'addFileFromURLs').callsFake(async (item) => {
			await pending;
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.importFromFile({ file, parentItemID: item.id });
			return attachment;
		});
		let json = candidate({ DOI: '10.1234/background-reopen' });
		let { session, referenceKey, resultID } = await sessionFor(json);
		try {
			let response = await Promise.race([
				session.performAction({ requestID: 'background-save', referenceKey, resultID, action: 'add-to-library' }),
				Zotero.Promise.delay(2000).then(() => {
					throw new Error('Add awaited the optional PDF');
				}),
			]);
			assert.equal(response.status, 'saved');
			assert.notInclude(response.result.actions, 'open-attachment');
			let item = Zotero.Items.get(session._references.get(referenceKey).result.itemID);
			items.push(item);
			let repeated = await save(json);
			assert.isTrue(repeated.existing);
			assert.equal(repeated.item.id, item.id);
			assert.isTrue(acquisition.calledOnce);
			let oldRefresh = session.waitForAttachmentUpdate(referenceKey, resultID);
			session.dispose();
			let reopened = await sessionFor(item, true);
			assert.notEqual(reopened.resultID, resultID);
			assert.notInclude(reopened.result.actions, 'open-attachment');
			let freshRefresh = reopened.session.waitForAttachmentUpdate(reopened.referenceKey, reopened.resultID);
			finish();
			let update = await freshRefresh;
			assert.isNull(await oldRefresh, 'Disposed token must not receive attachment authority');
			assert.equal(update.referenceKey, reopened.referenceKey);
			assert.equal(update.result.resultID, reopened.resultID);
			assert.include(update.result.actions, 'open-attachment');
			assert.include(reopened.session._references.get(reopened.referenceKey).result.actions, 'open-attachment');
			await repeated.fileAcquisitionPromise;
			assert.equal(referenceSaver._metadataSaveTails.size, 0);
			assert.equal(referenceSaver._attachmentFlights.size, 0);
		}
		finally {
			finish();
			await Promise.all([...referenceSaver._attachmentFlights.values()]);
		}
	});
	it("rechecks a completed save if its item is trashed during PDF acquisition", async function () {
		let finish;
		let pending = new Promise(resolve => finish = resolve);
		sandbox.stub(referenceSaver, '_acquireAssociatedFile').returns(pending);
		let json = candidate({ DOI: '10.1234/trashed-during-download' });
		try {
			let first = await save(json);
			first.item.deleted = true;
			await first.item.saveTx();
			let second = await save(json);
			assert.isFalse(second.existing);
			assert.isFalse(second.item.deleted);
			assert.notEqual(second.item.id, first.item.id);
		}
		finally {
			finish();
			await Promise.all([...referenceSaver._attachmentFlights.values()]);
		}
	});
	it("handles background acquisition failure without failing committed Add or retaining flights", async function () {
		Zotero.Prefs.set('downloadAssociatedFiles', true);
		let fail;
		let pending = new Promise((resolve, reject) => fail = reject);
		sandbox.stub(Zotero.Attachments, 'addFileFromURLs').returns(pending);
		let log = sandbox.stub(Zotero, 'logError');
		let result = await save(candidate({ DOI: '10.1234/background-shutdown' }));
		assert.isTrue(Zotero.Items.exists(result.item.id));
		fail(new Error('Simulated shutdown during PDF acquisition'));
		await result.fileAcquisitionPromise;
		assert.isTrue(Zotero.Items.exists(result.item.id));
		assert.isFalse(result.existing);
		await Zotero.Promise.delay(0);
		assert.isTrue(log.calledOnce);
		assert.equal(referenceSaver._metadataSaveTails.size, 0);
		assert.equal(referenceSaver._attachmentFlights.size, 0);
	});
	it("opens an existing attachment and blocks attachment opening after disposal", async function () {
		let view = sandbox.stub().resolves();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { viewAttachment: view } });
		let item = await store(candidate({ DOI: '10.1234/actions' }));
		let file = getTestDataDirectory();
		file.append('test.pdf');
		let attachment = await Zotero.Attachments.importFromFile({ file, parentItemID: item.id });
		items.push(attachment);
		let { session, referenceKey, resultID, result } = await sessionFor(item, true);
		assert.include(result.actions, 'open-attachment');
		let opened = await session.performAction({ requestID: 'open', referenceKey, resultID, action: 'open-attachment' });
		assert.equal(opened.status, 'ok');
		assert.isTrue(view.calledOnceWithExactly(attachment.id));
		let release;
		sandbox.stub(item, 'getBestAttachment').returns(new Promise(resolve => release = resolve));
		let pending = session.performAction({ requestID: 'stale', referenceKey, resultID, action: 'open-attachment' });
		await Zotero.Promise.delay(0);
		session.dispose();
		release(attachment);
		assert.equal((await pending).status, 'stale');
		assert.isTrue(view.calledOnce);
	});
	it("reports eviction and refreshes locally from the original raw reference", async function () {
		let item = await store(candidate({ DOI: '10.1234/expiry' }));
		let { session, referenceKey } = await sessionFor(item, true);
		session._removeReference(referenceKey);
		let response = await session.findOnline({ requestID: 'expired', referenceKey });
		assert.equal(response.status, 'expired');
		let refreshed = await session.matchReference({ requestID: 'refresh', sourceKey: 'reference',
			referenceParts: [{ text: 'doi:10.1234/expiry' }] });
		assert.equal(refreshed.status, 'strong');
		assert.notEqual(refreshed.referenceKey, referenceKey);
	});
	it("retains local action bindings after empty and failed real translator searches", async function () {
		let source = await Zotero.File.getContentsFromURLAsync('resource://app/translators/Crossref%20REST.js');
		let metadata = JSON.parse(/^\s*{[\S\s]*?}\s*?[\r\n]/.exec(source)[0]);
		metadata.cacheCode = true;
		let translator = Zotero.Translators.load(metadata, null, source);
		sandbox.stub(Zotero.Translators, 'get').callThrough().withArgs(metadata.translatorID)
.returns(translator);
		let item = await store(candidate());
		let { session, referenceKey, resultID } = await sessionFor(item, true);
		let select = sandbox.stub().resolves();
		sandbox.stub(Zotero, 'getMainWindow').returns({ ZoteroPane: { selectItem: select } });
		let unexpected = sandbox.stub(Zotero.HTTP, 'request').rejects(new Error('Unexpected network request'));
		let emptyBody = JSON.stringify({ status: 'ok', message: { items: [] } });
		let statuses = [200, 503];
		let request = sandbox.stub(Zotero.HTTP, 'doGet').callsFake((url, callback) => {
			assert.match(url, /^https:\/\/api\.crossref\.org\/works\//);
			let response = { status: statuses.shift(), responseText: emptyBody, responseURL: url };
			Zotero.Promise.resolve().then(() => callback(response));
			return response;
		});
		let empty = await session.findOnline({ requestID: 'empty', referenceKey });
		// Standard Search translators use the same failure for no items and
		// transport errors. Neither certifies an empty candidate pool.
		assert.equal(empty.status, 'error');
		// These outcomes are not cached and leave the local action binding intact.
		let failure = await session.findOnline({ requestID: 'failed', referenceKey });
		assert.equal(failure.status, 'error');
		assert.isTrue(request.calledTwice);
		assert.isEmpty(statuses);
		assert.isFalse(unexpected.called);
		assert.equal(session._onlineMatchCache.size, 0);
		assert.equal(session._references.get(referenceKey).result.resultID, resultID);
		let action = await session.performAction({ requestID: 'select', referenceKey, resultID, action: 'show-in-library' });
		assert.equal(action.status, 'ok');
		assert.isTrue(select.calledOnceWithExactly(item.id));
	});
	
	it('rechecks current structured identity across changed local metadata and two sessions', async function () {
		let json = { itemType: 'journalArticle', title: 'Current metadata recovery review',
			DOI: '10.1234/lifecycle-review', date: '2021',
			creators: [{ creatorType: 'author', firstName: 'Alice', lastName: 'Smith' }] };
		let existing = await store(json);
		let attachment = new Zotero.Item('attachment');
		attachment.libraryID = libraryID;
		attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_URL;
		attachment.setField('url', 'https://example.invalid/source.pdf');
		await attachment.saveTx();
		items.push(attachment);
		let first = new ReaderReferenceSession(attachment);
		let second = new ReaderReferenceSession(attachment);
		sessions.push(first, second);
		let local = await first.matchReference({ requestID: 'local', sourceKey: 'primary:reference',
			referenceParts: [{ text: `doi:${json.DOI}` }] });
		assert.equal(local.status, 'strong');
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline').callsFake(async (reference) => {
			let item = new Zotero.Item(json.itemType);
			item.fromJSON(json);
			return BibliographyMatcher.matchCandidates(reference, [item]);
		});
		existing.setField('DOI', '10.1234/changed-record');
		existing.setField('title', 'A different current record');
		await existing.saveTx();
		let online = await first.findOnline({ requestID: 'online', referenceKey: local.referenceKey });
		assert.equal(online.status, 'strong');
		assert.equal(online.result.libraryState, 'unsaved');
		let otherLocal = await second.matchReference({ requestID: 'local', sourceKey: 'primary:reference',
			referenceParts: [{ text: `doi:${json.DOI}` }] });
		let otherOnline = await second.findOnline({ requestID: 'online', referenceKey: otherLocal.referenceKey });
		let saver = sandbox.spy(Zotero.Translate, 'ItemSaver');
		let add = (session, reference, result) => session.performAction({ requestID: 'add',
			referenceKey: reference.referenceKey, resultID: result.result.resultID, action: 'add-to-library' });
		let saved = await add(first, local, online);
		assert.equal(saved.status, 'saved');
		let savedID = first._references.get(local.referenceKey).result.itemID;
		items.push(await Zotero.Items.getAsync(savedID));
		assert.notEqual(savedID, existing.id);
		let repeated = await add(second, otherLocal, otherOnline);
		assert.equal(repeated.status, 'existing');
		assert.equal(second._references.get(otherLocal.referenceKey).result.itemID, savedID);
		assert.isTrue(saver.calledOnce);
		assert.equal(provider.callCount, 2);
		let crossSession = await second.performAction({ requestID: 'cross', referenceKey: local.referenceKey,
			resultID: online.result.resultID, action: 'show-in-library' });
		assert.equal(crossSession.status, 'stale');
		let release;
		// Explicit cache-miss fixture: session metadata no longer expires
		// with the independently expiring action/reference tokens.
		first._onlineMatchCache.clear();
		provider.callsFake(() => new Promise(resolve => release = resolve));
		let pending = first.findOnline({ requestID: 'pending-refresh', referenceKey: local.referenceKey });
		await waitForCallback(() => release, 1, 5);
		assert.isFunction(release);
		let refreshed = await first.matchReference({ requestID: 'refresh', sourceKey: 'primary:reference',
			referenceParts: [{ text: 'doi:10.1234/replacement-reference' }] });
		let transient = new Zotero.Item(json.itemType);
		transient.fromJSON(json);
		release(BibliographyMatcher.matchCandidates(`doi:${json.DOI}`, [transient]));
		assert.equal((await pending).status, 'cancelled');
		assert.equal(refreshed.status, 'no-match');
		assert.isFalse([...first._references.values()].some(reference => reference.result));
		assert.isTrue(second._isBoundResult(second._references.get(otherLocal.referenceKey).result));
	});
});


describe("Reader reference saving integration", function () {
	// PLOS reference parts: journals.plos.org/plosone/article?id=10.1371/journal.pone.0236550 (CC BY 4.0).
	// Metadata: https://www.nature.com/articles/nature11148
	let parts = [
		{ text: "7. Cardinale BJ, Duffy JE, Gonzalez A, Hooper DU, Perrings C, Venail P, et al. Biodiversity loss and its impact on humanity. Nature. 2012; 486: 59–67. " },
		{ text: "https://doi.org/10.1038/nature11148", attributes: { url: "https://doi.org/10.1038/nature11148" } },
		{ text: " PMID: " },
		{ text: "22678280", attributes: { url: "http://www.ncbi.nlm.nih.gov/pubmed/22678280" } },
	];
	let target = {
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
	
	async function createEmptyLibraryCase(title) {
		let group = await createGroup({ editable: true, filesEditable: true });
		let attachment = new Zotero.Item('attachment');
		attachment.libraryID = group.libraryID;
		attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_URL;
		attachment.attachmentContentType = 'application/pdf';
		attachment.setField('title', title);
		attachment.setField('url', "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0236550");
		await attachment.saveTx();
		return { attachment, group };
	}
	
	it("saves verified online metadata, rematches locally, and deduplicates concurrent Adds", async function () {
		this.timeout(120000);
		let targetPMID = [...BibliographyMatcher.extractIdentifiers(target.extra).PMID][0];
		assert.equal(targetPMID, '22678280');
		let canonicalTarget = new Zotero.Item(target.itemType);
		canonicalTarget.fromJSON(target);
		let expectedMetadata = BibliographyMatcher.createCandidateSnapshot(
			canonicalTarget.toJSON()
		);
		let sandbox = sinon.createSandbox();
		let groups = [];
		let sessions = [];
		let downloadPref = 'downloadAssociatedFiles';
		let hadDownloadPref = Zotero.Prefs.prefHasUserValue(downloadPref);
		let originalDownloadPref = Zotero.Prefs.get(downloadPref);
		let network = ['request', 'doGet', 'doPost'].map(method => sandbox.spy(Zotero.HTTP, method));
		let translate = sandbox.spy(Zotero.Translate.Search.prototype, 'translate');
		let availableFileLookup = sandbox.stub(Zotero.Attachments, 'addFileFromURLs').resolves(false);
		let provider = sandbox.stub(onlineReferenceLookup, 'findOnline').callsFake(
			(reference, { signal } = {}) => {
				assert.equal(reference, parts.map(part => part.text).join(''));
				assert.isFalse(signal?.aborted);
				let data = JSON.parse(JSON.stringify(target));
				let item = new Zotero.Item(data.itemType);
				item.fromJSON(data);
				return BibliographyMatcher.matchCandidates(reference, [item]);
			}
		);
		
		let regularItemsForTarget = async libraryID => (
			(await Zotero.Items.getAll(libraryID))
				.filter(item => item.isRegularItem() && item.getField('DOI') === target.DOI)
		);
		let assertSavedTarget = async (libraryID) => {
			let items = await regularItemsForTarget(libraryID);
			assert.lengthOf(items, 1);
			let item = items[0];
			for (let field of [
				'title', 'date', 'publicationTitle', 'volume', 'pages', 'DOI',
			]) {
				assert.equal(item.getField(field), target[field], `Saved ${field} differs from provider metadata`);
			}
			assert.equal(item.getField('PMID'), targetPMID);
			let normalizeCreator = creator => (
				creator.name || [creator.firstName, creator.lastName].filter(Boolean).join(' ')
			).normalize('NFKC').replace(/\s+/g, ' ').trim();
			assert.deepEqual(
				item.getCreators().map(normalizeCreator),
				target.creators.map(normalizeCreator)
			);
			assert.deepEqual(
				BibliographyMatcher.createCandidateSnapshot(item.toJSON()),
				expectedMetadata
			);
			assert.deepEqual(item.getAttachments(), []);
			assert.deepEqual(item.getNotes(), []);
			return item;
		};
		let findOnline = async (session, local, suffix) => {
			let response = await session.findOnline({
				requestID: `saving-online-${suffix}`,
				referenceKey: local.referenceKey,
			});
			assert.equal(response.status, 'strong');
			assert.isObject(response.result);
			assert.equal(response.result.libraryState, 'unsaved');
			assert.include(response.result.actions, 'add-to-library');
			assert.notProperty(response.result.display, 'identifiers');
			assert.deepEqual(
				session._references.get(response.referenceKey).result.candidateJSON,
				expectedMetadata
			);
			return response;
		};
		
		try {
			Zotero.Prefs.set(downloadPref, true);
			let primary = await createEmptyLibraryCase('Reference saving source');
			groups.push(primary.group);
			let session = new ReaderReferenceSession(primary.attachment);
			sessions.push(session);
			assert.isFunction(session.readerOptions.onFindReferenceOnline);
			let local = await session.matchReference({
				requestID: 'saving-local-primary',
				sourceKey: 'saving-reference-primary',
				referenceParts: parts,
			});
			assert.equal(local.status, 'no-match');
			assert.equal(provider.callCount, 0);
			assert.isTrue(network.every(spy => spy.callCount === 0));
			assert.equal(translate?.callCount || 0, 0);
			
			let online = await findOnline(session, local, 'primary');
			assert.equal(provider.callCount, 1);
			let added = await session.performAction({
				requestID: 'saving-add-primary',
				referenceKey: local.referenceKey,
				resultID: online.result.resultID,
				action: 'add-to-library',
			});
			assert.equal(added.status, 'saved');
			assert.equal(added.result.libraryState, 'existing');
			await assertSavedTarget(primary.group.libraryID);
			
			let repeatSession = new ReaderReferenceSession(primary.attachment);
			sessions.push(repeatSession);
			let repeat = await repeatSession.matchReference({
				requestID: 'saving-local-repeat',
				sourceKey: 'saving-reference-repeat',
				referenceParts: parts,
			});
			assert.equal(repeat.status, 'strong');
			assert.isObject(repeat.result);
			assert.equal(repeat.result.libraryState, 'existing');
			assert.notInclude(repeat.result.actions, 'add-to-library');
			assert.equal(provider.callCount, 1);
			
			let concurrent = await createEmptyLibraryCase('Concurrent reference saving source');
			groups.push(concurrent.group);
			let concurrentSessions = Array.from({ length: 2 }, () => {
				let concurrentSession = new ReaderReferenceSession(concurrent.attachment);
				sessions.push(concurrentSession);
				return concurrentSession;
			});
			let concurrentLocals = await Promise.all(concurrentSessions.map((current, index) => (
				current.matchReference({
					requestID: `saving-local-concurrent-${index}`,
					sourceKey: `saving-reference-concurrent-${index}`,
					referenceParts: parts,
				})
			)));
			assert.deepEqual(concurrentLocals.map(result => result.status), ['no-match', 'no-match']);
			let concurrentOnline = await Promise.all(concurrentSessions.map((current, index) => (
				findOnline(current, concurrentLocals[index], `concurrent-${index}`)
			)));
			let actions = await Promise.all(concurrentSessions.map((current, index) => (
				current.performAction({
					requestID: `saving-add-concurrent-${index}`,
					referenceKey: concurrentLocals[index].referenceKey,
					resultID: concurrentOnline[index].result.resultID,
					action: 'add-to-library',
				})
			)));
			assert.deepEqual(actions.map(result => result.status).sort(), ['existing', 'saved']);
			await assertSavedTarget(concurrent.group.libraryID);
			assert.equal(referenceSaver._metadataSaveTails.size, 0);
			assert.equal(provider.callCount, 3);
			assert.equal(availableFileLookup.callCount, 2);
			assert.isTrue(network.every(spy => spy.callCount === 0));
			assert.isFalse(translate.called);
		}
		finally {
			for (let session of sessions) session.dispose();
			
			if (hadDownloadPref) Zotero.Prefs.set(downloadPref, originalDownloadPref);
			else Zotero.Prefs.clear(downloadPref);
			sandbox.restore();
			for (let group of groups.reverse()) await group.eraseTx();
		}
	});
});


describe("Reader reference popup integration", function () {
	let win;
	
	before(async function () {
		win = await loadZoteroPane();
	});
	
	after(function () {
		win.Zotero_Tabs.closeAll();
		win.close();
	});
	
	it("finds explicitly, restores online metadata, and adds through the packaged Reader", async function () {
		this.timeout(15000);
		let sandbox = sinon.createSandbox();
		let reader, attachment, saved;
		let previousDownload = Zotero.Prefs.get('downloadAssociatedFiles');
		let candidate = {
			itemType: 'journalArticle', DOI: '10.1234/popup-integration',
			title: 'Node.js reference integration', date: '2021',
			creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Example' }],
			abstractNote: 'An abstract retained across popup reopening.',
		};
		try {
			Zotero.Prefs.set('downloadAssociatedFiles', false);
			attachment = await importFileAttachment('test.pdf');
			reader = await Zotero.Reader.open(attachment.id);
			await reader._initPromise;
			let view = reader._internalReader._primaryView;
			await view.initializedPromise;
			let provider = sandbox.stub(onlineReferenceLookup, '_translateIdentifier').resolves([candidate]);
			let network = sandbox.stub(Zotero.HTTP, 'request').rejects(new Error('Unexpected external request'));
			// The popup loads packaged item icons through the HTTP helper.
			network.withArgs('GET', sinon.match(/^resource:\/\/zotero\//)).callThrough();
			let save = sandbox.spy(referenceSaver, 'saveCandidate');
			let doc = reader._iframeWindow.document;
			let button = label => [...doc.querySelectorAll('.reference-actions button')]
				.find(node => node.textContent.trim() === label);
			let title = () => doc.querySelector('.reference-popup .item-preview .title');
			// Supply the semantic overlay directly: this covers the packaged UI and
			// client bridge, not PDF reference extraction.
			let popup = Components.utils.cloneInto({
				type: 'citation', rect: [100, 100, 130, 120], persistent: true,
				references: [{ sourceKey: 'integration', text: 'doi:' + candidate.DOI, chars: [
					{ c: 'https://doi.org/10.1234/popup-', lineBreakAfter: true, url: 'https://doi.org/' + candidate.DOI },
					{ c: 'integration', url: 'https://doi.org/' + candidate.DOI },
				] }],
			}, reader._iframeWindow);
			let open = () => view._onSetOverlayPopup(popup);
			let close = async () => {
				view._onSetOverlayPopup(null);
				await waitForCallback(() => !doc.querySelector('.reference-popup'), 50, 5);
			};
			open();
			(await waitForCallback(() => button('Find Online') && !button('Find Online').disabled && button('Find Online'), 50, 5)).click();
			await waitForCallback(title, 50, 5);
			assert.equal(provider.firstCall.args[0].DOI, candidate.DOI, 'The wrapped visible URL reaches the normal DOI route');
			assert.equal(title().textContent, candidate.title);
			assert.include(doc.querySelector('.reference-popup .abstract').textContent, candidate.abstractNote);
			await close();
			open();
			await waitForCallback(title, 50, 5);
			assert.equal(title().textContent, candidate.title);
			assert.isTrue(provider.calledOnce, 'Reopening must reuse the online result');
			assert.isUndefined(button('Find Online'));
			button('Add to Library').click();
			await waitForCallback(() => button('Show in Library'), 50, 5);
			saved = (await save.firstCall.returnValue).item;
			assert.equal(saved.getField('abstractNote'), candidate.abstractNote);
			await close();
			open();
			await waitForCallback(() => title() && button('Show in Library'), 50, 5);
			assert.equal(title().textContent, saved.getField('title'));
			assert.isUndefined(button('Add to Library'));
			let navigate = sandbox.spy(reader._referenceSession, 'performAction');
			let loadURI = sandbox.stub(win.ZoteroPane, 'loadURI');
			button('View Online').click();
			await waitForCallback(() => loadURI.calledOnce && button('View Online') && !button('View Online').disabled, 50, 5);
			let response = await navigate.firstCall.returnValue;
			assert.equal(response.status, 'ok');
			assert.notProperty(response, 'result');
			assert.equal(title().textContent, saved.getField('title'));
			assert.isDefined(button('Show in Library'));
			assert.isTrue(provider.calledOnce);
			assert.isTrue(network.getCalls().every(call => (
				call.args[0] === 'GET' && call.args[1].startsWith('resource://zotero/')
			)));
			let internal = reader._internalReader;
			assert.isTrue(internal._state.previewedReferences.has('integration'));
			internal.reload(internal._data);
			assert.equal(internal._state.previewedReferences.size, 0, 'Reload cannot reuse visited keys from the old document');
			await internal._primaryView.initializedPromise;
		}
		finally {
			sandbox.restore();
			reader?.close();
			if (saved?.id) await saved.eraseTx();
			if (attachment?.id) await attachment.eraseTx();
			Zotero.Prefs.set('downloadAssociatedFiles', previousDownload);
		}
	});
	
	it('should deliver saved metadata before attachment refresh and suppress refresh after teardown', async function () {
		let sandbox = sinon.createSandbox();
		let reader, attachment;
		let hostRequests, unsubscribe;
		let pending = Zotero.Promise.defer();
		try {
			attachment = await importFileAttachment('test.pdf');
			reader = await Zotero.Reader.open(attachment.id);
			await reader._initPromise;
			let session = reader._referenceSession;
			let bridge = reader._internalReader._referencePopupBridge;
			let response = { status: 'saved', referenceKey: 'reference',
				result: { resultID: 'saved-result', libraryState: 'existing', actions: ['show-in-library'],
					display: { itemType: 'journalArticle', title: 'Saved metadata', firstCreator: '', year: '', abstract: null } } };
			let update = { referenceKey: 'reference', result: { ...response.result,
				actions: ['open-attachment', 'show-in-library'] } };
			sandbox.stub(session, 'performAction').callsFake(async request => ({ ...response, requestID: request.requestID }));
			hostRequests = sandbox.spy(session, '_handleRequest');
			let events = [];
			let updates = [];
			let refresh = sandbox.stub(session, 'waitForAttachmentUpdate').resolves(update);
			unsubscribe = bridge.subscribeResultUpdates((value) => {
				updates.push(value);
				events.push('updated');
			});
			let request = { referenceKey: 'reference', resultID: 'saved-result', action: 'add-to-library' };
			let saved;
			bridge.startAction(Components.utils.cloneInto(request, reader._iframeWindow), (value) => {
				saved = value;
				events.push('saved');
			});
			await hostRequests.lastCall.returnValue;
			assert.equal(saved.status, 'saved');
			assert.isTrue(refresh.calledOnce, 'Host must ask for attachment update');
			await waitForCallback(() => updates.length === 1, 10, 5);
			assert.equal(saved.status, 'saved');
			assert.deepEqual(saved.result, response.result);
			assert.deepEqual(updates, [update]);
			assert.isTrue(refresh.calledOnceWithExactly(request.referenceKey, request.resultID));
			assert.deepEqual(events, ['saved', 'updated'], 'Already-complete acquisition still follows Saved');
			refresh.callsFake(() => pending.promise);
			let delivered;
			bridge.startAction(Components.utils.cloneInto(request, reader._iframeWindow), value => delivered = value);
			let running = hostRequests.lastCall.returnValue;
			await waitForCallback(() => delivered, 10, 5);
			assert.equal(delivered.status, 'saved', 'Slow acquisition cannot delay Saved');
			reader.close();
			pending.resolve(update);
			await running;
			assert.lengthOf(updates, 1, 'Closed Reader must not receive the late refresh');
		}
		finally {
			unsubscribe?.();
			pending.resolve();
			await Promise.allSettled(hostRequests?.getCalls().map(call => call.returnValue) || []);
			sandbox.restore();
			reader?.close();
			if (attachment?.id && Zotero.Items.exists(attachment.id)) await attachment.eraseTx();
		}
	});
	
	it('should expose the smart-reference capability and preserve DTO contracts across the bridge', async function () {
		let sandbox = sinon.createSandbox();
		let reader;
		let item;
		let attachment;
		try {
			item = await createDataObject('item', {
				itemType: 'journalArticle',
				title: 'Reliable matching across diverse bibliographies',
			});
			item.setField('DOI', '10.1234/general.42');
			item.setField('url', 'https://example.invalid/article');
			await item.saveTx();
			attachment = await importFileAttachment('test.pdf');
			sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves({
				status: 'matched', item,
			});
			
			reader = await Zotero.Reader.open(attachment.itemID);
			await reader._initPromise;
			let bridge = reader._internalReader._referencePopupBridge;
			assert.isTrue(bridge.canFindOnline);
			sandbox.stub(Zotero.HTTP, 'browserIsOffline').returns(true);
			
			let runBridgeRequest = async (method, request) => {
				let operation;
				let response = await Promise.race([
					new Promise(resolve => operation = bridge[method](Components.utils.cloneInto(request, reader._iframeWindow), resolve)),
					Zotero.Promise.delay(5000).then(() => {
						throw new Error(`Timed out waiting for ${method}`);
					}),
				]);
				assert.equal(response.requestID, operation.requestID);
				return response;
			};
			let lookup = await runBridgeRequest('startLocalLookup', {
				sourceKey: 'reference-1',
				referenceParts: [{ text: 'doi:10.1234/general.42' }],
			});
			lookup = JSON.parse(JSON.stringify(lookup));
			assert.equal(lookup.status, 'strong');
			assert.notProperty(lookup.result.display, 'url');
			assert.notProperty(lookup.result, 'itemID');
			assert.notProperty(lookup.result, 'libraryID');
			let provider = sandbox.stub(onlineReferenceLookup, 'findOnline');
			let offlineResult = await runBridgeRequest('startOnlineLookup', {
				referenceKey: lookup.referenceKey,
			});
			assert.equal(offlineResult.status, 'offline');
			assert.isFalse(provider.called);
			assert.isTrue(reader._internalReader._referencePopupBridge.canFindOnline);
			
			let action = await runBridgeRequest('startAction', {
				referenceKey: lookup.referenceKey,
				resultID: 'expired-or-foreign-token',
				action: 'show-in-library',
			});
			action = JSON.parse(JSON.stringify(action));
			assert.equal(action.referenceKey, lookup.referenceKey);
			assert.equal(action.status, 'stale');
		}
		finally {
			sandbox.restore();
			reader?.close();
			if (attachment?.id && Zotero.Items.exists(attachment.id)) await attachment.eraseTx();
			if (item?.id && Zotero.Items.exists(item.id)) await item.eraseTx();
		}
	});
	
	it('should cancel an online lookup through the Reader bridge without delivering or caching its result', async function () {
		let sandbox = sinon.createSandbox();
		let reader;
		let attachment;
		let hostRequests;
		let releaseProvider = Zotero.Promise.defer();
		try {
			attachment = await importFileAttachment('test.pdf');
			sandbox.stub(BibliographyMatcher, 'matchLibrary').resolves({
				status: 'unmatched',
				reason: 'no-candidates',
			});
			let candidate = new Zotero.Item('journalArticle');
			candidate.fromJSON({
				itemType: 'journalArticle',
				title: 'A late online result',
				DOI: '10.1234/late-result',
			});
			let providerStarted = Zotero.Promise.defer();
			let providerSignal;
			sandbox.stub(onlineReferenceLookup, 'findOnline').callsFake(
				(reference, { signal }) => {
					providerSignal = signal;
					providerStarted.resolve();
					return releaseProvider.promise.then(() => BibliographyMatcher.matchCandidates(reference, [candidate]));
				}
			);
			
			reader = await Zotero.Reader.open(attachment.itemID);
			await reader._initPromise;
			let bridge = reader._internalReader._referencePopupBridge;
			hostRequests = sandbox.spy(reader._referenceSession, '_handleRequest');
			let local = await Promise.race([
				new Promise(resolve => bridge.startLocalLookup(Components.utils.cloneInto({
					sourceKey: 'cancel-reference',
					referenceParts: [{ text: 'doi:10.1234/late-result' }],
				}, reader._iframeWindow), resolve)),
				Zotero.Promise.delay(3000).then(() => {
					throw new Error('Timed out waiting for the local lookup');
				}),
			]);
			assert.equal(local.status, 'no-match');
			let delivered = [];
			let operation = bridge.startOnlineLookup(Components.utils.cloneInto({
				referenceKey: local.referenceKey,
			}, reader._iframeWindow), response => delivered.push(JSON.parse(JSON.stringify(response))));
			let onlineFinished = hostRequests.lastCall.returnValue;
			await Promise.race([
				providerStarted.promise,
				Zotero.Promise.delay(3000).then(() => {
					throw new Error('Timed out waiting for the online provider');
				}),
			]);
			operation.cancel();
			assert.isTrue(providerSignal.aborted);
			releaseProvider.resolve();
			await onlineFinished;
			await Zotero.Promise.delay(0);
			
			assert.isEmpty(delivered, 'The bridge must suppress cancelled delivery to the popup');
			assert.notProperty(reader._referenceSession._references.get(local.referenceKey), 'result');
			assert.equal(reader._referenceSession._onlineMatchCache.size, 0);
		}
		finally {
			reader?.close();
			releaseProvider.resolve();
			await Promise.allSettled(hostRequests?.getCalls().map(call => call.returnValue) || []);
			sandbox.restore();
			if (attachment?.id && Zotero.Items.exists(attachment.id)) await attachment.eraseTx();
		}
	});
});
