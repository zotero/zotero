"use strict";

describe('Citation Explorer Wizard', function () {
	var dialog;
	var group;
	var targetCollection;
	var io;
	var savedItems;

	async function openCitationExplorerWizard(items, uncitedItems, citations) {
		io = {
			items,
			uncitedItems,
			citations,
			relinkItems: sinon.spy(),
			completed: false,
			deferred: Zotero.Promise.defer(),
		};
		io.wrappedJSObject = io;
		dialog = await loadWindow(
			'chrome://zotero/content/integration/citationExplorerWizard.xhtml',
			io
		);
		await waitForCallback(() => {
			return dialog.document.getElementById('item-target').getAttribute('label');
		});
		return dialog.document.getElementById('citation-explorer-wizard');
	}

	/**
	 * Open the review page for cited items with the specified destination and operation,
	 * and wait for either an action select or the no-changes message.
	 */
	async function openReview({ items, target, operation, noChanges = false }) {
		let citations = {};
		for (let [index, item] of items.entries()) {
			citations[index] = {
				citationItems: [{ id: item.cslItemID ?? item.id }],
			};
		}
		let wizard = await openCitationExplorerWizard(items, [], citations);
		dialog.document.getElementById('item-operation').value = operation;
		let targetMenuitem = dialog.document.querySelector(
			`#item-target-menu menuitem[value="${target.treeViewID}"]`
		);
		if (!targetMenuitem) {
			throw new Error(`Target ${target.treeViewID} not found`);
		}
		targetMenuitem.doCommand();
		wizard.getButton('next').click();
		await waitForCallback(() => {
			if (wizard.currentPage?.pageid !== 'review-actions') return false;
			if (noChanges) {
				return dialog.document.querySelector('.items-tree-message')?.textContent
					.includes('No changes are needed.');
			}
			let options = dialog.document.querySelectorAll('.item-action-select menuitem');
			return options.length && [...options].every(option => option.getAttribute('label'));
		});
		return wizard;
	}

	function getActionState() {
		let select = dialog.document.querySelector('.item-action-select');
		let options = [...select.menupopup.children].map(option => option.getAttribute('label'));
		return {
			selected: options[Number(select.value)],
			options,
		};
	}

	function createUnlinkedItem(itemData, cslItemID) {
		let item = new Zotero.Item(itemData.itemType);
		item.setField('title', itemData.title);
		item.setCreators(itemData.creators || []);
		item.cslItemID = cslItemID;
		return item;
	}

	before(async function () {
		group = await createGroup({ name: 'Wizard Target Group' });
		targetCollection = await createDataObject('collection', {
			libraryID: group.libraryID,
			name: 'Wizard Target Collection',
		});
	});

	beforeEach(function () {
		dialog = null;
		io = null;
		savedItems = [];
	});

	afterEach(async function () {
		if (dialog && !dialog.closed) {
			dialog.close();
			await io.deferred.promise;
		}
		for (let item of savedItems) {
			if (Zotero.Items.get(item.id)) {
				await item.eraseTx();
			}
		}
	});

	after(async function () {
		await group.eraseTx();
	});

	describe('Destination selection', function () {
		it('should default to the library with the most citation occurrences', async function () {
			let groupItem = await createDataObject('item', {
				libraryID: group.libraryID,
				title: 'Repeated Group Citation',
			});
			let userItem = await createDataObject('item', { title: 'Repeated User Citation' });
			let uncitedGroupItems = await Promise.all([1, 2].map(index => createDataObject('item', {
				libraryID: group.libraryID,
				title: `Uncited Group Item ${index}`,
			})));
			savedItems.push(groupItem, userItem, ...uncitedGroupItems);

			// Uncited linked items each add one to the destination score.
			await openCitationExplorerWizard(
				[groupItem, userItem],
				uncitedGroupItems,
				{
					0: { citationItems: [{ id: groupItem.id }] },
					1: { citationItems: [{ id: groupItem.id }] },
					2: { citationItems: [{ id: userItem.id }] },
					3: { citationItems: [{ id: userItem.id }] },
					4: { citationItems: [{ id: userItem.id }] },
				}
			);

			assert.equal(
				dialog.document.getElementById('item-target').getAttribute('label'),
				group.name,
				'Uncited items should make the group library the highest-scoring destination'
			);
			assert.isTrue(
				dialog.document.getElementById('item-operation-relink').hidden,
				'The relink option should be hidden when all items are linked'
			);
			assert.isTrue(
				dialog.document.getElementById('item-operation-relink-description').hidden,
				'The relink description should be hidden with its option'
			);
		});
	});

	describe('Review actions', function () {
		describe('Unlinked items', function () {
			it('should offer and select a destination-library match', async function () {
				let itemData = {
					itemType: 'book',
					title: `Target Match ${Zotero.Utilities.randomString()}`,
				};
				let match = await createDataObject('item', itemData);
				savedItems.push(match);
				let item = createUnlinkedItem(itemData, 'session/target-match');

				await openReview({
					items: [item],
					target: Zotero.Libraries.userLibrary,
					operation: 'relink',
				});

				assert.deepEqual(getActionState(), {
					selected: `Relink to existing item “${match.getDisplayTitle()}”`,
					options: [
						`Relink to existing item “${match.getDisplayTitle()}”`,
						'Choose Item…',
						'Do nothing',
					],
				}, 'A destination match should be selected for relinking');
			});

			it('should offer and select a non-destination-library match for copying', async function () {
				let itemData = {
					itemType: 'book',
					title: `Other Library Match ${Zotero.Utilities.randomString()}`,
				};
				let match = await createDataObject('item', {
					...itemData,
					libraryID: group.libraryID,
				});
				savedItems.push(match);
				let item = createUnlinkedItem(itemData, 'session/other-library-match');

				await openReview({
					items: [item],
					target: Zotero.Libraries.userLibrary,
					operation: 'relink',
				});

				assert.deepEqual(getActionState(), {
					selected: `Copy an existing item from ${group.name}`,
					options: [
						`Copy an existing item from ${group.name}`,
						`Add to ${Zotero.Libraries.userLibrary.name}`,
						'Choose Item…',
						'Do nothing',
					],
				}, 'A non-destination match should be selected for copying and linking');
			});

			it('should select adding the item from the document', async function () {
				let item = createUnlinkedItem({
					itemType: 'book',
					title: `Unmatched Document Item ${Zotero.Utilities.randomString()}`,
				}, 'session/unmatched');

				await openReview({
					items: [item],
					target: Zotero.Libraries.userLibrary,
					operation: 'relink',
				});

				assert.deepEqual(getActionState(), {
					selected: `Add to ${Zotero.Libraries.userLibrary.name}`,
					options: [
						`Add to ${Zotero.Libraries.userLibrary.name}`,
						'Choose Item…',
						'Do nothing',
					],
				}, 'An unmatched unlinked item should default to its document data');
			});
		});

		describe('Linked items', function () {
			it('should omit an item already in the destination library', async function () {
				let destinationItem = await createDataObject('item', {
					title: `Already in Destination ${Zotero.Utilities.randomString()}`,
				});
				let externalItem = await createDataObject('item', {
					libraryID: group.libraryID,
					title: `External Item ${Zotero.Utilities.randomString()}`,
				});
				savedItems.push(destinationItem, externalItem);

				await openReview({
					items: [destinationItem, externalItem],
					target: Zotero.Libraries.userLibrary,
					operation: 'addToTarget',
				});

				assert.lengthOf(
					dialog.document.querySelectorAll('.item-action-select'),
					1,
					'Only the item outside the destination library should have actions'
				);
			});

			it('should show no changes when all items are already in the destination library', async function () {
				let items = await Promise.all([1, 2].map(index => createDataObject('item', {
					title: `Already in Destination ${index} ${Zotero.Utilities.randomString()}`,
				})));
				savedItems.push(...items);

				await openReview({
					items,
					target: Zotero.Libraries.userLibrary,
					operation: 'addToTarget',
					noChanges: true,
				});

				assert.equal(
					dialog.document.querySelector('.items-tree-message').textContent,
					'No changes are needed.',
					'Items already in the destination should produce the no-changes state'
				);
			});

			it('should offer and select copying an item from another library', async function () {
				let item = await createDataObject('item', {
					libraryID: group.libraryID,
					title: `Linked Copy ${Zotero.Utilities.randomString()}`,
				});
				savedItems.push(item);

				await openReview({
					items: [item],
					target: Zotero.Libraries.userLibrary,
					operation: 'addToTarget',
				});

				assert.deepEqual(getActionState(), {
					selected: `Copy an existing item from ${group.name}`,
					options: [
						`Copy an existing item from ${group.name}`,
						'Choose Item…',
						'Do nothing',
					],
				}, 'An external linked item should be selected for copying');
			});
		});

		describe('Collection destinations', function () {
			it('should offer and select adding a library item to the collection', async function () {
				let item = await createDataObject('item', {
					libraryID: group.libraryID,
					title: `Add to Collection ${Zotero.Utilities.randomString()}`,
				});
				savedItems.push(item);

				await openReview({
					items: [item],
					target: targetCollection,
					operation: 'addToTarget',
				});

				assert.deepEqual(getActionState(), {
					selected: `Add to ${targetCollection.name}`,
					options: [
						`Add to ${targetCollection.name}`,
						'Choose Item…',
						'Do nothing',
					],
				}, 'An item in the target library should be selected for collection addition');
			});

			it('should offer and select copying an item from another library', async function () {
				let item = await createDataObject('item', {
					title: `Copy to Collection ${Zotero.Utilities.randomString()}`,
				});
				savedItems.push(item);

				await openReview({
					items: [item],
					target: targetCollection,
					operation: 'addToTarget',
				});

				assert.deepEqual(getActionState(), {
					selected: `Copy an existing item from ${Zotero.Libraries.userLibrary.name}`,
					options: [
						`Copy an existing item from ${Zotero.Libraries.userLibrary.name}`,
						'Choose Item…',
						'Do nothing',
					],
				}, 'An external item should be selected for copying to the collection library');
			});

			it('should omit an item already in the collection', async function () {
				let item = await createDataObject('item', {
					libraryID: group.libraryID,
					collections: [targetCollection.id],
					title: `Already in Collection ${Zotero.Utilities.randomString()}`,
				});
				savedItems.push(item);

				await openReview({
					items: [item],
					target: targetCollection,
					operation: 'addToTarget',
					noChanges: true,
				});

				assert.notExists(
					dialog.document.querySelector('.item-action-select'),
					'An item already in the target collection should not have actions'
				);
			});
		});
	});
});
