"use strict";

describe("Similar content context pane", function () {
	var win, doc, deck, similar, other;
	var stubs = [];
	var parent, attachment, secondAttachment;
	// Fake reader tabs, by tab ID
	var readers;

	before(async function () {
		this.timeout(60000);
		win = await loadZoteroPane();
		doc = win.document;
		attachment = await importFileAttachment('test.pdf');
		secondAttachment = await importFileAttachment('test.pdf');
		parent = await createDataObject('item', { title: 'Similar Parent' });
		other = await importFileAttachment('test.pdf', { parentItemID: parent.id });
	});

	after(function () {
		win.close();
	});

	// A pane of its own, shown in a deck as the context pane shows it, beside
	// another panel to switch to
	beforeEach(function () {
		readers = new Map([
			['tab-1', { tabID: 'tab-1', itemID: attachment.id }],
			['tab-2', { tabID: 'tab-2', itemID: secondAttachment.id }]
		]);
		stubs.push(sinon.stub(Zotero.Reader, 'getByTabID').callsFake(tabID => readers.get(tabID)));
		deck = doc.createXULElement('deck');
		deck.append(doc.createXULElement('box'));
		similar = doc.createXULElement('similar-context');
		deck.append(similar);
		doc.documentElement.append(deck);
		deck.selectedPanel = similar;
	});

	afterEach(function () {
		deck.remove();
		stubs.forEach(stub => stub.restore());
		stubs = [];
	});

	// A semantic search that matches the other attachment and the open one,
	// whose passages are always the same
	function stubSearch() {
		stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(true));
		let scoreStub = sinon.stub(Zotero.BestMatch, 'scoreItemIDs').callsFake(async (query, itemIDs) => {
			let scores = new Map(itemIDs.filter(id => id == other.id || id == attachment.id)
				.map(id => [id, 0.8]));
			return {
				scores,
				lexical: { scores: new Map(), matches: new Map() },
				semantic: { scores, previewable: new Set(scores.keys()) }
			};
		});
		stubs.push(scoreStub);
		stubs.push(sinon.stub(Zotero.BestMatch.Session.prototype, 'getMatchingExcerpts').resolves([
			{ text: 'A passage much like the selection.', ranges: [], strength: 1,
				anchor: { pageRects: [[0, 10, 10, 100, 20]] } }
		]));
		return scoreStub;
	}

	// Fails naming what it waited for, rather than timing the test out
	async function waitFor(predicate, what) {
		let started = Date.now();
		while (!predicate()) {
			if (Date.now() - started > 8000) {
				throw new Error(`Timed out waiting for ${what}`);
			}
			await Zotero.Promise.delay(20);
		}
	}

	// Text selected in the tab, as the reader's selection popup reports it
	// to its listeners when it appears
	function select(tabID, text) {
		Zotero.Reader._dispatchEvent({
			type: 'renderTextSelectionPopup',
			reader: readers.get(tabID),
			doc: doc,
			append: () => {},
			params: { annotation: { text } }
		});
	}

	let message = () => similar.querySelector('.similar-context-message');
	let rows = () => [...similar.querySelectorAll('search-result-row')];

	it("should take each tab's selection from its popup, and stop listening once gone", async function () {
		let scoreStub = stubSearch();
		similar.tabID = 'tab-1';
		// Another tab's selection waits for that tab
		select('tab-2', 'another tab\'s selection');
		await Zotero.Promise.delay(700);
		assert.isFalse(scoreStub.called);
		similar.tabID = 'tab-2';
		await waitFor(() => scoreStub.called, 'the other tab\'s search');
		assert.equal(scoreStub.lastCall.args[0], 'another tab\'s selection');

		// Removed, the pane no longer hears of selections
		deck.remove();
		select('tab-2', 'after the pane is gone');
		await Zotero.Promise.delay(700);
		assert.equal(scoreStub.callCount, 1);
	});

	it("should show the passages of other attachments similar to the selection", async function () {
		let scoreStub = stubSearch();
		similar.tabID = 'tab-1';
		assert.isTrue(similar.shown);
		// Nothing selected yet
		assert.isFalse(message().hidden);
		assert.equal(message().dataset.l10nId, 'similar-context-empty');

		select('tab-1', 'owls hunting at night');
		await waitFor(() => rows().length, 'the results');
		// Searched by meaning alone, in the library, without the open attachment
		let [query, candidateIDs, options] = scoreStub.lastCall.args;
		assert.equal(query, 'owls hunting at night');
		assert.equal(options.engine, 'semantic');
		assert.include(candidateIDs, other.id);
		assert.notInclude(candidateIDs, attachment.id);
		// One group, for the other attachment, headed by its parent's type and
		// title, with a bar of how relevant it is
		let groups = similar.querySelectorAll('.similar-context-group');
		assert.lengthOf(groups, 1);
		assert.equal(groups[0].dataset.itemId, other.id);
		assert.equal(groups[0].querySelector('.head .title').textContent, 'Similar Parent');
		assert.equal(groups[0].querySelector('.icon-item-type').dataset.itemType,
			parent.getItemTypeIconName(true));
		// The same bar the tree's Relevance column draws for the attachment
		assert.equal(groups[0].querySelector('.relevance-bar-fill').style.width,
			Math.round(similar._session.barFractions.get(other.treeViewID).semantic * 100) + '%');
		assert.isTrue(message().hidden);
		// Short, as in an item's section: clamped, with no quoted line marked
		let quote = rows()[0].querySelector('.quote');
		assert.equal(win.getComputedStyle(quote).webkitLineClamp, '9');
		assert.isFalse(rows()[0].highlightSnippet);
		assert.equal(rows()[0].itemID, other.id);

		// New results show from the top, wherever the last were scrolled to
		let results = similar.querySelector('.similar-context-results');
		results.style.maxHeight = '20px';
		results.scrollTop = 10;
		assert.isAbove(results.scrollTop, 0);
		select('tab-1', 'owls hunting at dawn');
		await waitFor(() => scoreStub.callCount == 2 && message().hidden, 'the second results');
		assert.equal(results.scrollTop, 0);
		results.style.maxHeight = '';

		// The same text selected again doesn't search again
		select('tab-1', 'owls hunting at dawn');
		await Zotero.Promise.delay(700);
		assert.lengthOf(rows(), 1);
		assert.equal(scoreStub.callCount, 2);
	});

	it("should search only while in view, and keep each tab's results", async function () {
		let scoreStub = stubSearch();
		similar.tabID = 'tab-1';
		select('tab-1', 'a first selection');
		await waitFor(() => rows().length, 'the first tab\'s results');

		// Out of view, nothing is searched
		deck.selectedIndex = 0;
		assert.isFalse(similar.shown);
		similar.tabID = 'tab-2';
		select('tab-2', 'a hidden selection');
		await Zotero.Promise.delay(700);
		assert.equal(scoreStub.callCount, 1);

		// Shown, the selection made meanwhile is searched
		deck.selectedPanel = similar;
		await similar.update();
		assert.equal(scoreStub.callCount, 2);
		assert.equal(scoreStub.lastCall.args[0], 'a hidden selection');

		// Back on the first tab, its results are shown without searching
		similar.tabID = 'tab-1';
		await Zotero.Promise.delay(100);
		assert.equal(scoreStub.callCount, 2);
		assert.lengthOf(rows(), 1);
	});

	it("should keep the cards' annotations current, on screen and in other tabs' results", async function () {
		stubSearch();
		// The passage reads back with a highlight over its first word
		let reads = sinon.stub(Zotero.SDT, 'readAnchors').callsFake(async (itemID, anchors) => ({
			ok: true,
			chunks: anchors.map(() => ({
				text: 'A passage much like the selection.',
				annotations: [{ key: 'ANNOTKEY', type: 'highlight', color: '#ffd400', comment: '',
					ranges: [{ start: 0, end: 1 }] }]
			}))
		}));
		stubs.push(reads);
		// The other attachment's card, in whichever results are drawn
		let otherCard = () => similar.querySelector(
			`.similar-context-group[data-item-id="${other.id}"] search-result-row`);
		similar.tabID = 'tab-1';
		select('tab-1', 'a first selection');
		await waitFor(() => otherCard(), 'the first tab\'s results');
		similar.tabID = 'tab-2';
		select('tab-2', 'a second selection');
		await waitFor(() => similar._shown?.text == 'a second selection', 'the second tab\'s results');
		assert.isNull(otherCard().querySelector('.annotation'));

		// Made elsewhere, as in another reader tab, the annotation is drawn
		// on the cards on screen
		await createAnnotation('highlight', other);
		await waitFor(() => otherCard().querySelector('.annotation'), 'the annotation on screen');
		assert.isTrue(reads.alwaysCalledWith(other.id));
		assert.equal(reads.callCount, 1);

		// and on the first tab's, once they're drawn again
		similar.tabID = 'tab-1';
		await waitFor(() => reads.callCount == 2 && otherCard().querySelector('.annotation'),
			'the annotation in the first tab\'s results');
	});

	it("should say when semantic search isn't available", async function () {
		stubs.push(sinon.stub(Zotero.Embeddings, 'isEnabled').returns(false));
		similar.tabID = 'tab-1';
		select('tab-1', 'something to search for');
		await waitFor(() => message().dataset.l10nId == 'similar-context-unavailable', 'the message');
		assert.isFalse(message().hidden);
		assert.lengthOf(rows(), 0);
	});
});
