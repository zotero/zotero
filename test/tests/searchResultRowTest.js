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
			{ text: 'Birds', ref: [0, 0], run: 0, block: { type: 'heading', ref: [0] }, path: [] },
			{ text: 'Owls', ref: [1, 0, 0], run: 0, block: { type: 'listitem', ref: [1, 0] }, path: [list], style: { bold: true } },
			{ text: 'Hawks', ref: [1, 1, 0, 0], run: 0, block: { type: 'paragraph', ref: [1, 1, 0] },
				path: [list, { type: 'listitem', ref: [1, 1] }] },
			{ text: 'Bird', ref: [2, 0, 0, 0, 0], run: 0, block: { type: 'paragraph', ref: [2, 0, 0, 0] },
				path: [table, tr, { type: 'tablecell', ref: [2, 0, 0] }] },
			{ text: 'Owl', ref: [2, 0, 1, 0, 0], run: 1, block: { type: 'paragraph', ref: [2, 0, 1, 0] },
				path: [table, tr, { type: 'tablecell', ref: [2, 0, 1] }] },
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
				ranges: [{ start: segments[3].start, end: segments[3].end }] }]
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

	it("should address a selection as content ranges in the structure, one per run", function () {
		let { text, segments } = structured();
		let at = phrase => text.indexOf(phrase);
		row.result = { text, segments, ranges: [] };
		// From inside the first item through the data cell: the three
		// stretches that read in document order are one range, the cell
		// that doesn't is another
		let selected = row._getSelectedRanges({ start: at('Owls') + 1, end: text.length - 1 });
		assert.deepEqual(selected, [
			[[1, 0, 0, 1], [2, 0, 0, 0, 0, 4]],
			[[2, 0, 1, 0, 0, 0], [2, 0, 1, 0, 0, 2]],
		]);
		// Nothing for a selection off the passage's text
		assert.deepEqual(row._getSelectedRanges({ start: 5, end: 7 }), []);
	});

	it("should mark a range across two nodes through the separator between them", function () {
		// Two nodes of one paragraph: the chunker separates them by a space
		let { text, segments } = passage([
			{ text: 'Owls hunt', ref: [0, 0], run: 0, block: { type: 'paragraph', ref: [0] }, path: [] },
		]);
		text += ' at night.';
		segments.push({ start: text.length - 9, end: text.length, ref: [0, 1], offset: 0, run: 0,
			block: { type: 'paragraph', ref: [0] }, path: [] });
		row.result = { text, segments, ranges: [[5, 12]] };
		let quote = row.querySelector('.quote');
		assert.equal(quote.textContent, text);
		assert.lengthOf(quote.querySelectorAll('p.block'), 1);
		assert.equal([...quote.querySelectorAll('.match')].map(span => span.textContent).join('|'), 'hunt| |at');
	});

	it("should keep an image's text in the quote without showing it", function () {
		let { text, segments } = passage([
			{ text: 'Figure 1. An owl.', ref: [0, 0], run: 0, block: { type: 'caption', ref: [0] }, path: [] },
			{ text: '0 20 40 60 80', ref: [1, 0], run: 0, block: { type: 'image', ref: [1] }, path: [] },
			{ text: 'Owls hunt at night.', ref: [2, 0], run: 0, block: { type: 'paragraph', ref: [2] }, path: [] },
		]);
		row.result = { text, segments, ranges: [] };
		let quote = row.querySelector('.quote');
		assert.equal(quote.textContent, text);
		assert.equal(quote.querySelector('figcaption.block.caption').textContent, 'Figure 1. An owl.');
		let figure = quote.querySelector('figure.block.image');
		assert.equal(figure.querySelector('.hidden-text').textContent, '0 20 40 60 80');
		assert.equal(win.getComputedStyle(figure.querySelector('.hidden-text')).display, 'none');
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
