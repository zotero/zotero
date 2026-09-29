// Run against the addon-list.mjs extracted from the patched Firefox omni.ja:
// node app/scripts/tests/addon-list-pending-uninstall.test.mjs <path>
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const sourcePath = process.argv.at(-1);
if (!sourcePath?.endsWith('addon-list.mjs')) {
	throw new Error('Pass the patched addon-list.mjs path as the last argument');
}
const source = readFileSync(sourcePath, 'utf8')
	.replace(/^import \{[\s\S]*?\} from "\.\.\/aboutaddons-utils\.mjs";\s*/mu, '')
	.replace('export class AddonList', 'class AddonList')
	.replace('customElements.define("addon-list", AddonList);', 'globalThis.AddonList = AddonList;');

function createList(currentById) {
	const errors = [];
	const context = {
		console: { error: error => errors.push(error) },
		HTMLElement: class {},
		ChromeUtils: {
			importESModule: () => ({ AddonManager: {
				getAddonByID: id => typeof currentById === 'function'
					? currentById(id) : Promise.resolve(currentById.get(id)),
			} }),
			defineESModuleGetters: () => {},
		},
		isPending: addon => addon.pendingUninstall,
	};
	runInNewContext(source, context, { filename: sourcePath });
	const list = new context.AddonList();
	list.removeListener = () => {};
	list.updateAddon = () => {};
	list.removePendingUninstallBar = () => {};
	list.errors = errors;
	return list;
}

test('a replacement clears the pending removal and survives list teardown', async () => {
	let uninstalls = 0;
	const old = { id: 'plugin@test', pendingUninstall: true, uninstall: () => uninstalls++ };
	const replacement = { id: old.id, pendingUninstall: false };
	const list = createList(new Map([[old.id, replacement]]));
	list.pendingUninstallAddons.add(old);
	list.onInstalled(replacement);
	assert.equal(list.pendingUninstallAddons.size, 0);
	await list.disconnectedCallback();
	assert.equal(uninstalls, 0);
});

test('list teardown checks the live add-on even before the install event arrives', async () => {
	let uninstalls = 0;
	const old = { id: 'plugin@test', pendingUninstall: true, uninstall: () => uninstalls++ };
	const replacement = { id: old.id, pendingUninstall: false };
	const list = createList(new Map([[old.id, replacement]]));
	list.pendingUninstallAddons.add(old);
	await list.disconnectedCallback();
	assert.equal(uninstalls, 0);
});

test('a genuinely pending removal still finalizes', async () => {
	let uninstalls = 0;
	const old = { id: 'plugin@test', pendingUninstall: true, uninstall: () => uninstalls++ };
	const list = createList(new Map([[old.id, old]]));
	list.pendingUninstallAddons.add(old);
	await list.disconnectedCallback();
	assert.equal(uninstalls, 1);
});

test('a reconnect during lookup leaves newly queued removals intact', async () => {
	let resolveLookup;
	let uninstalls = 0;
	const old = { id: 'old@test', pendingUninstall: true, uninstall: () => uninstalls++ };
	const fresh = { id: 'fresh@test', pendingUninstall: true };
	const list = createList(() => new Promise(resolve => { resolveLookup = resolve; }));
	list.pendingUninstallAddons.add(old);
	const teardown = list.disconnectedCallback();
	assert.equal(list.pendingUninstallAddons.has(old), true);
	list.isConnected = true;
	list.pendingUninstallAddons.add(fresh);
	resolveLookup(old);
	await teardown;
	assert.equal(uninstalls, 0);
	assert.equal(list.pendingUninstallAddons.has(fresh), true);
});

test('install notification during lookup removes the stale entry before reconnect', async () => {
	let resolveLookup;
	let uninstalls = 0;
	const old = { id: 'plugin@test', pendingUninstall: true, uninstall: () => uninstalls++ };
	const replacement = { id: old.id, pendingUninstall: false };
	const list = createList(() => new Promise(resolve => { resolveLookup = resolve; }));
	list.pendingUninstallAddons.add(old);
	const teardown = list.disconnectedCallback();
	list.onInstalled(replacement);
	list.isConnected = true;
	resolveLookup(replacement);
	await teardown;
	assert.equal(uninstalls, 0);
	assert.equal(list.pendingUninstallAddons.has(old), false);
});

test('a reconnect mid-loop preserves the unprocessed pending removal', async () => {
	let resolveSecond;
	let firstUninstalls = 0;
	let secondUninstalls = 0;
	const first = { id: 'first@test', pendingUninstall: true,
		uninstall: () => firstUninstalls++ };
	const second = { id: 'second@test', pendingUninstall: true,
		uninstall: () => secondUninstalls++ };
	const list = createList(id => id === first.id ? Promise.resolve(first)
		: new Promise(resolve => { resolveSecond = resolve; }));
	list.pendingUninstallAddons.add(first);
	list.pendingUninstallAddons.add(second);
	const teardown = list.disconnectedCallback();
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(firstUninstalls, 1);
	list.isConnected = true;
	resolveSecond(second);
	await teardown;
	assert.equal(secondUninstalls, 0);
	assert.equal(list.pendingUninstallAddons.has(second), true);
});

test('a failed current-add-on lookup retains the pending removal', async () => {
	const old = { id: 'plugin@test', pendingUninstall: true };
	const list = createList(() => Promise.reject(new Error('lookup failed')));
	list.pendingUninstallAddons.add(old);
	await list.disconnectedCallback();
	assert.equal(list.pendingUninstallAddons.has(old), true);
	assert.equal(list.errors.length, 1);
});
