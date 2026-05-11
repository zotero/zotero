/* global Zotero */

// Stores a per-item reading-progress label as a structured key in the existing
// `extra` field. Same pattern used for `citation-key`: no schema migration,
// syncs natively, survives BBT and other extra-field consumers.

export const VALUES = ['Unread', 'In Progress', 'Done', 'Abandoned'];
export const EXTRA_KEY = 'Reading-Status';

export function get(item) {
	if (!item) return '';
	let extra = item.getField('extra') || '';
	let m = extra.match(/^Reading-Status:[ \t]*(.+)$/m);
	if (!m) return '';
	let value = m[1].trim();
	return VALUES.includes(value) ? value : '';
}

export function setNoSave(item, value) {
	let extra = item.getField('extra') || '';
	let stripped = extra.replace(/^Reading-Status:[ \t]*.*(?:\r?\n|$)/m, '');
	stripped = stripped.replace(/\s+$/, '');
	let next;
	if (value && VALUES.includes(value)) {
		next = stripped
			? stripped + '\n' + EXTRA_KEY + ': ' + value
			: EXTRA_KEY + ': ' + value;
	}
	else {
		next = stripped;
	}
	item.setField('extra', next);
}

export async function set(item, value) {
	setNoSave(item, value);
	await item.saveTx();
}

export function getLocalizedLabel(value) {
	switch (value) {
		case 'Unread': return Zotero.getString('reading-status-unread');
		case 'In Progress': return Zotero.getString('reading-status-in-progress');
		case 'Done': return Zotero.getString('reading-status-done');
		case 'Abandoned': return Zotero.getString('reading-status-abandoned');
		default: return '';
	}
}

// Accept either canonical English or localized label, return canonical, '', or
// null for invalid input (so callers can distinguish "clear" from "ignore").
export function parseInput(text) {
	let trimmed = (text || '').trim();
	if (!trimmed) return '';
	for (let v of VALUES) {
		if (trimmed.toLowerCase() === v.toLowerCase()) return v;
		let localized = getLocalizedLabel(v);
		if (localized && trimmed.toLowerCase() === localized.toLowerCase()) return v;
	}
	return null;
}
