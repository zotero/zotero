"use strict";

describe("search-result-row", function () {
	var win, doc, row;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
	});

	after(function () {
		win.close();
	});

	beforeEach(function () {
		row = doc.createXULElement('search-result-row');
		doc.documentElement.append(row);
	});

	afterEach(function () {
		row.remove();
	});

	// A passage as the chunker describes recovered text: its blocks' text
	// in order, separated as the text is, each described by its node and
	// the blocks over it
	function passage(parts) {
		let text = '';
		let segments = [];
		for (let { text: piece, ...part } of parts) {
			if (text) {
				text += '\n\n';
			}
			segments.push({ start: text.length, end: text.length + piece.length, offset: 0, ...part });
			text += piece;
		}
		return { text, segments };
	}

	// A heading, an ordered list of two items -- one of plain text, one of
	// a paragraph -- and a table of a header cell and a data cell
	function structured() {
		let list = { type: 'list', ref: [1], ordered: true, startIndex: 3 };
		let table = { type: 'table', ref: [2] };
		let tr = { type: 'tablerow', ref: [2, 0] };
		return passage([
			{ text: 'Birds', ref: [0, 0], blocks: [{ type: 'heading', ref: [0] }] },
			{ text: 'Owls', ref: [1, 0, 0], blocks: [list, { type: 'listitem', ref: [1, 0] }], style: { bold: true } },
			{ text: 'Hawks', ref: [1, 1, 0, 0],
				blocks: [list, { type: 'listitem', ref: [1, 1] }, { type: 'paragraph', ref: [1, 1, 0] }] },
			{ text: 'Bird', ref: [2, 0, 0, 0, 0],
				blocks: [table, tr, { type: 'tablecell', ref: [2, 0, 0] }, { type: 'paragraph', ref: [2, 0, 0, 0] }] },
			{ text: 'Owl', ref: [2, 0, 1, 0, 0],
				blocks: [table, tr, { type: 'tablecell', ref: [2, 0, 1] }, { type: 'paragraph', ref: [2, 0, 1, 0] }] },
		]);
	}

	it("should show a passage as its blocks, keeping its text whole", function () {
		let { text, segments } = structured();
		let at = phrase => text.indexOf(phrase);
		row.highlightSnippet = true;
		row.result = {
			text,
			segments,
			ranges: [[at('Hawks'), at('Hawks') + 5]],
			snippet: { start: at('Owls'), end: at('Owls') + 4 },
			annotations: [{ key: 'A', type: 'highlight', color: '#ffd400',
				ranges: [[[2, 0, 0, 0, 0, 0], [2, 0, 0, 0, 0, 4]]] }]
		};
		let quote = row.querySelector('.quote');
		// Every character of the passage, separators included, so offsets
		// into it still count through the quote
		assert.equal(quote.textContent, text);
		assert.isTrue(quote.classList.contains('structured'));

		assert.equal(quote.querySelector('h4.block.heading').textContent, 'Birds');
		let list = quote.querySelector('ol.block.list');
		assert.equal(list.start, 3);
		let items = list.querySelectorAll(':scope > li.block.listitem');
		assert.lengthOf(items, 2);
		// Inline style, and the snippet marked within it
		assert.equal(items[0].querySelector('strong .snippet').textContent, 'Owls');
		// A nested block inside its item, with the query's match marked
		assert.equal(items[1].querySelector('p.block.paragraph .match').textContent, 'Hawks');
		// A table is a placeholder: one figure for all its cells, their text
		// in it but not shown, marks and all
		let tables = quote.querySelectorAll('figure.block.table');
		assert.lengthOf(tables, 1);
		assert.isNull(quote.querySelector('tr, td, th'));
		let hidden = tables[0].querySelectorAll('.hidden-text');
		assert.deepEqual([...hidden].map(span => span.textContent), ['Bird', 'Owl']);
		assert.equal(hidden[0].querySelector('.annotation.highlight').textContent, 'Bird');
		assert.equal(win.getComputedStyle(hidden[0]).display, 'none');
	});

	it("should address a selection as ranges of the structure's text it shows, one per segment", function () {
		let { text, segments } = structured();
		let at = phrase => text.indexOf(phrase);
		row.result = { text, segments, ranges: [] };
		// From inside the first item to inside the last cell: the table's
		// text, shown as a placeholder, isn't selected
		let selected = row._getSelectedRanges({ start: at('Owls') + 1, end: text.length - 1 });
		assert.deepEqual(selected, [
			[[1, 0, 0, 1], [1, 0, 0, 4]],
			[[1, 1, 0, 0, 0], [1, 1, 0, 0, 5]],
		]);
		// Nothing for a selection off the passage's text, or on a placeholder alone
		assert.deepEqual(row._getSelectedRanges({ start: 5, end: 7 }), []);
		assert.deepEqual(row._getSelectedRanges({ start: at('Bird\n\nOwl'), end: text.length }), []);
	});

	it("should mark a range across two nodes through the separator between them", function () {
		// Two nodes of one paragraph: the chunker separates them by a space
		let { text, segments } = passage([
			{ text: 'Owls hunt', ref: [0, 0], blocks: [{ type: 'paragraph', ref: [0] }] },
		]);
		text += ' at night.';
		segments.push({ start: text.length - 9, end: text.length, ref: [0, 1], offset: 0,
			blocks: [{ type: 'paragraph', ref: [0] }] });
		row.result = { text, segments, ranges: [[5, 12]] };
		let quote = row.querySelector('.quote');
		assert.equal(quote.textContent, text);
		assert.lengthOf(quote.querySelectorAll('p.block'), 1);
		assert.equal([...quote.querySelectorAll('.match')].map(span => span.textContent).join('|'), 'hunt| |at');
	});

	it("should keep an image's text in the quote without showing it", function () {
		let { text, segments } = passage([
			{ text: 'Figure 1. An owl.', ref: [0, 0], blocks: [{ type: 'caption', ref: [0] }] },
			{ text: '0 20 40 60 80', ref: [1, 0], blocks: [{ type: 'image', ref: [1] }] },
			{ text: 'Owls hunt at night.', ref: [2, 0], blocks: [{ type: 'paragraph', ref: [2] }] },
		]);
		row.result = { text, segments, ranges: [] };
		let quote = row.querySelector('.quote');
		assert.equal(quote.textContent, text);
		assert.equal(quote.querySelector('figcaption.block.caption').textContent, 'Figure 1. An owl.');
		let figure = quote.querySelector('figure.block.image');
		assert.equal(figure.querySelector('.hidden-text').textContent, '0 20 40 60 80');
		assert.equal(win.getComputedStyle(figure.querySelector('.hidden-text')).display, 'none');
	});

	describe("annotation popup", function () {
		var attachment, annotation;

		before(async function () {
			let item = await createDataObject('item');
			attachment = await importFileAttachment('test.pdf', { parentID: item.id });
			annotation = await createAnnotation('highlight', attachment, { comment: 'Noted' });
			annotation.setTags(['owls']);
			await annotation.saveTx({ skipSelect: true });
		});

		afterEach(function () {
			row._popup.hidePopup();
		});

		// The passage with the annotation drawn over its first word
		function show() {
			let { text, segments } = passage([
				{ text: 'Owls hunt at night.', ref: [0, 0], blocks: [{ type: 'paragraph', ref: [0] }] },
			]);
			row.itemID = attachment.id;
			row.result = { text, segments, ranges: [], annotations: [{
				key: annotation.key, type: 'highlight', color: '#ffd400', comment: 'Noted',
				ranges: [[[0, 0, 0], [0, 0, 4]]]
			}] };
			return row.querySelector('.quote .annotation');
		}

		it("should open a clicked annotation with its page, comment and tags, and no colors", async function () {
			let span = show();
			// The tags editor exists only while an annotation is shown
			assert.isNull(row.querySelector('tags-box'));
			win.getSelection().removeAllRanges();
			span.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }));
			await waitForCallback(() => row._popup.state == 'open');
			assert.isTrue(row._popup.querySelector('.selection-tools').hidden);
			let editor = row._popup.querySelector('.annotation-editor');
			assert.isFalse(editor.hidden);
			assert.equal(editor.querySelector('.head .title').textContent,
				'Page ' + annotation.annotationPageLabel);
			assert.include(editor.querySelector('.head .icon').src, 'annotate-highlight');
			assert.equal(editor.querySelector('.comment').value, 'Noted');
			let tagsBox = editor.querySelector('.tags-editor');
			assert.equal(tagsBox.item, annotation);
			assert.deepEqual([...tagsBox.querySelectorAll('.row editable-text')].map(e => e.value), ['owls']);
			// and goes with the popup
			row._popup.hidePopup();
			await waitForCallback(() => !row.querySelector('tags-box'));
		});

		it("should save a changed comment to the annotation", async function () {
			let span = show();
			win.getSelection().removeAllRanges();
			span.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }));
			await waitForCallback(() => row._popup.state == 'open');
			row._popup.querySelector('.comment').value = ' Noted again ';
			await row._saveComment();
			assert.equal(annotation.annotationComment, 'Noted again');
			// Unchanged text isn't saved again
			let save = sinon.spy(annotation, 'saveTx');
			await row._saveComment();
			assert.isFalse(save.called);
			save.restore();
		});
	});

	it("should stay expanded when its annotations are redrawn", async function () {
		// A passage long enough to be clamped
		let { text, segments } = passage([{
			text: Array(40).fill('Owls hunt at night and sleep by day.').join(' '),
			ref: [0, 0], blocks: [{ type: 'paragraph', ref: [0] }]
		}]);
		row.result = { text, segments, ranges: [] };
		await waitForCallback(() => !row._showMore.hidden);
		row._toggleExpanded();
		assert.isTrue(row.classList.contains('expanded'));

		row.setAnnotations({ text, segments, annotations: [{ key: 'A', type: 'highlight',
			color: '#ffd400', ranges: [[[0, 0, 0], [0, 0, 4]]] }] });
		assert.ok(row.querySelector('.quote .annotation'));
		// Measured collapsed within the frame, then shown in full again
		await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
		assert.isTrue(row.classList.contains('expanded'));
		assert.isFalse(row._showMore.hidden);
		assert.equal(row._showMore.getAttribute('data-l10n-id'), 'search-result-row-show-less');
	});

	it("should show a passage of unknown structure as running text", function () {
		row.result = { text: 'Owls hunt at night.\n\nHawks hunt by day.', ranges: [[0, 4]] };
		let quote = row.querySelector('.quote');
		assert.isFalse(quote.classList.contains('structured'));
		assert.isNull(quote.querySelector('.block'));
		assert.equal(quote.textContent, 'Owls hunt at night.\n\nHawks hunt by day.');
		assert.equal(quote.querySelector('.match').textContent, 'Owls');
	});
});
