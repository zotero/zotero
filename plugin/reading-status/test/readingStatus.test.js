// Unit tests for the storage helpers. Run with: node --test test/
//
// We can't import readingStatus.js directly because it references the `Zotero`
// global at module load time (for getLocalizedLabel). Install the mock first.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Zotero = {
	getString(name) {
		const table = {
			'reading-status-unread': 'Unread',
			'reading-status-in-progress': 'In Progress',
			'reading-status-done': 'Done',
			'reading-status-abandoned': 'Abandoned',
		};
		return table[name] || '';
	},
};

const { get, setNoSave, parseInput, VALUES } = await import('../content/readingStatus.js');

function makeItem(extra = '') {
	let fields = { extra };
	return {
		getField: (k) => fields[k] ?? '',
		setField: (k, v) => { fields[k] = v; },
		_fields: fields,
	};
}

test('get() returns empty for item without extra field', () => {
	let item = makeItem('');
	assert.equal(get(item), '');
});

test('get() returns empty for unrelated extra content', () => {
	let item = makeItem('DOI: 10.1000/x\nPMID: 123');
	assert.equal(get(item), '');
});

test('get() returns canonical value when set', () => {
	let item = makeItem('Reading-Status: In Progress');
	assert.equal(get(item), 'In Progress');
});

test('get() returns empty for unknown values', () => {
	let item = makeItem('Reading-Status: Bogus');
	assert.equal(get(item), '');
});

test('setNoSave() round-trips each canonical value', () => {
	let item = makeItem('');
	for (let v of VALUES) {
		setNoSave(item, v);
		assert.equal(get(item), v);
	}
});

test('setNoSave() clears the status when given empty', () => {
	let item = makeItem('');
	setNoSave(item, 'Done');
	assert.equal(get(item), 'Done');
	setNoSave(item, '');
	assert.equal(get(item), '');
});

test('setNoSave() preserves other extra-field content', () => {
	let item = makeItem('DOI: 10.1000/x\nCitation Key: smith2020');
	setNoSave(item, 'Unread');
	let extra = item.getField('extra');
	assert.ok(extra.includes('DOI: 10.1000/x'));
	assert.ok(extra.includes('Citation Key: smith2020'));
	assert.ok(extra.includes('Reading-Status: Unread'));
});

test('setNoSave() overwrites existing Reading-Status without duplication', () => {
	let item = makeItem('Reading-Status: Unread\nDOI: 10.1000/y');
	setNoSave(item, 'Done');
	let extra = item.getField('extra');
	assert.equal((extra.match(/Reading-Status:/g) || []).length, 1);
	assert.ok(extra.includes('Reading-Status: Done'));
	assert.ok(extra.includes('DOI: 10.1000/y'));
});

test('parseInput() accepts canonical English values', () => {
	assert.equal(parseInput('Unread'), 'Unread');
	assert.equal(parseInput('in progress'), 'In Progress');
});

test('parseInput() returns empty string for blank input', () => {
	assert.equal(parseInput(''), '');
	assert.equal(parseInput('   '), '');
});

test('parseInput() returns null for invalid input', () => {
	assert.equal(parseInput('Bogus'), null);
});
