"use strict";

describe("query-textbox", function () {
	var win, textbox;

	before(async function () {
		win = await loadZoteroPane();
		textbox = win.document.getElementById('zotero-tb-search').searchTextbox;
	});

	after(async function () {
		await Zotero.Tags.setColor(Zotero.Libraries.userLibraryID, 'zzcompletion', false);
		textbox.value = '';
		win.close();
	});

	it("should render the query in spans covering the whole value", function () {
		textbox.value = 'by:smith crispr';
		let layer = textbox.shadowRoot.querySelector('.query-highlight');
		assert.equal(layer.textContent, 'by:smith crispr');
		assert.deepEqual(
			[...layer.children].map(span => span.className),
			['query-token-field', 'query-token-operator', 'query-token-value',
				'query-token-space', 'query-token-text']
		);
		assert.isTrue(textbox.hasAttribute('highlighted'));
	});

	it("should leave a query without conditions to the input", function () {
		textbox.value = 'just some words';
		assert.isFalse(textbox.hasAttribute('highlighted'));
		assert.equal(
			textbox.shadowRoot.querySelector('.query-highlight').textContent, ''
		);
	});

	it("should find the condition the caret is in", function () {
		textbox.value = 'by:smith crispr';
		textbox.inputField.setSelectionRange(4, 4);
		assert.equal(textbox.getConditionAtCaret().value, 'by');
		textbox.inputField.setSelectionRange(12, 12);
		assert.isNull(textbox.getConditionAtCaret());
	});

	it("should offer tags and creators from the library", async function () {
		let item = await createDataObject('item', { tags: [{ tag: 'zzcompletion' }] });
		item.setCreator(0, { firstName: 'Zora', lastName: 'Zzcompletion', creatorType: 'author' });
		// A two-field creator with only a last name, whose value has no
		// leading space to quote
		item.setCreator(1, { firstName: '', lastName: 'Zzlastonly', creatorType: 'author' });
		await item.saveTx();

		// updateCompletions() resolves once the library lookup has filled
		// the list
		let offered = async (query, value) => {
			textbox.value = query;
			textbox.inputField.setSelectionRange(query.length, query.length);
			await textbox.updateCompletions();
			let list = win.document.querySelector('.query-completions richlistbox');
			assert.isTrue(
				[...list.children].some(row => row.completion.label === value), value
			);
		};
		await Zotero.Tags.setColor(Zotero.Libraries.userLibraryID, 'zzcompletion', '#FF6666');
		await offered('tag:zzcomp', 'zzcompletion');
		// A colored tag carries its color, for the swatch in the list
		let list = win.document.querySelector('.query-completions richlistbox');
		let row = [...list.children].find(r => r.completion.label === 'zzcompletion');
		assert.equal(row.completion.color, '#FF6666');
		await offered('by:zzcomp', 'Zora Zzcompletion');
		await offered('by:zzlast', 'Zzlastonly');
	});

	it("should offer completions for a condition name and then its values", async function () {
		textbox.value = 'ty';
		textbox.inputField.setSelectionRange(2, 2);
		textbox.updateCompletions();
		let list = win.document.querySelector('.query-completions richlistbox');
		// The list is shown the first time there's something to offer
		assert.notEqual(win.document.querySelector('.query-completions').state, 'closed');
		let labels = [...list.children].map(row => row.completion.label);
		assert.include(labels, 'type:');

		// Completing a condition name offers what it takes next
		list.selectedIndex = labels.indexOf('type:');
		textbox._acceptCompletion();
		assert.equal(textbox.value, 'type:');
		assert.equal(textbox.inputField.selectionStart, 'type:'.length);
		labels = [...list.children].map(row => row.completion.label);
		assert.include(labels, 'journal article');

		// Arrowing up from nothing selected starts at the end of the list
		textbox._handleCompletionKey(new win.KeyboardEvent('keydown', { key: 'ArrowUp' }));
		assert.equal(list.selectedIndex, list.itemCount - 1);

		list.selectedIndex = labels.indexOf('journal article');
		textbox._acceptCompletion();
		assert.equal(textbox.value, 'type:"journal article"');
		assert.deepEqual(
			Zotero.SearchQuery.parse(textbox.value).tree.children,
			[{ condition: 'itemType', operator: 'is', value: 'journalArticle' }]
		);

		textbox.value = 'crispr ';
		textbox.inputField.setSelectionRange(7, 7);
		textbox.updateCompletions();
		assert.equal(win.document.querySelector('.query-completions').state, 'closed');
	});

	it("should stop recognizing a condition that's been undone", function () {
		textbox.value = 'title:foo';
		assert.isTrue(textbox.hasAttribute('highlighted'));
		textbox.readAsText(0);
		assert.isFalse(textbox.hasAttribute('highlighted'));
		assert.isFalse(Zotero.SearchQuery.getSearch(textbox.value, {
			literalAt: textbox.literalAt
		}));
	});

	it("should move or drop an undone condition's marker as the text changes", function () {
		textbox.value = 'title:foo';
		textbox.readAsText(0);
		assert.isFalse(textbox.hasAttribute('highlighted'));
		// The marker follows the condition when text is inserted before it
		textbox.value = 'x title:foo';
		assert.isFalse(textbox.hasAttribute('highlighted'));
		assert.isTrue(textbox.literalAt.has(2));
		// Replacing the condition makes a new one, recognized again
		textbox.value = 'tag:bar';
		assert.isTrue(textbox.hasAttribute('highlighted'));
		assert.equal(textbox.literalAt.size, 0);
	});

	it("should accept the completion under the mouse", async function () {
		textbox.value = 'ty';
		textbox.inputField.setSelectionRange(2, 2);
		await textbox.updateCompletions();
		let list = win.document.querySelector('.query-completions richlistbox');
		let row = [...list.children].find(r => r.completion.label === 'type:');
		row.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
		assert.equal(textbox.value, 'type:');
	});

	it("should not reopen the list after accepting a value", async function () {
		await createDataObject('item', { tags: [{ tag: 'zzaccepted' }] });
		textbox.value = 'tag:zzaccep';
		textbox.inputField.setSelectionRange(11, 11);
		await textbox.updateCompletions();
		let list = win.document.querySelector('.query-completions richlistbox');
		let index = [...list.children].findIndex(row => row.completion.label === 'zzaccepted');
		assert.isAbove(index, -1);
		list.selectedIndex = index;
		// Control the follow-up lookup, so the result demonstrably arrives
		// only after the acceptance has hidden the list
		let resolveLookup;
		let stub = sinon.stub(textbox, '_lookupValues').returns(new Promise((resolve) => {
			resolveLookup = resolve;
		}));
		try {
			textbox._acceptCompletion();
			assert.equal(textbox.value, 'tag:zzaccepted');
			resolveLookup([{ text: 'zzaccepted', label: 'zzaccepted' }]);
			await Zotero.Promise.delay(0);
			assert.include(['closed', 'hiding'],
				win.document.querySelector('.query-completions').state);
		}
		finally {
			stub.restore();
		}
	});

	it("should close the completion list on Enter without a selection", async function () {
		textbox.value = 'ty';
		textbox.inputField.setSelectionRange(2, 2);
		await textbox.updateCompletions();
		assert.notEqual(win.document.querySelector('.query-completions').state, 'closed');
		textbox._handleCompletionKey(new win.KeyboardEvent('keydown', { key: 'Enter' }));
		assert.include(['closed', 'hiding'],
			win.document.querySelector('.query-completions').state);
	});

	it("should hide completions when the value is set", async function () {
		textbox.value = 'ty';
		textbox.inputField.setSelectionRange(2, 2);
		await textbox.updateCompletions();
		assert.notEqual(win.document.querySelector('.query-completions').state, 'closed');
		textbox.value = 'something else';
		assert.include(['closed', 'hiding'],
			win.document.querySelector('.query-completions').state);
	});
});
