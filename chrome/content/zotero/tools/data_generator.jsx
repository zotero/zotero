/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2019 Center for History and New Media
					George Mason University, Fairfax, Virginia, USA
					http://zotero.org
	
	This file is part of Zotero.
	
	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
	
	***** END LICENSE BLOCK *****
*/

const React = require('react');
const ReactDOM = require('react-dom');

function init() {
	let div = document.querySelector('div');
	ReactDOM.render(<DataGeneratorForm/>, div);
}

class DataGeneratorForm extends React.Component {
	constructor() {
		super();
		this.state = {
			numItems: 10000,
			chunkSize: 50,
			numCollections: 1000
		};
	}

	render() {
		return (
			<div>
				<p>
					<label>Number of items</label>
					<input type="number" min={1}
						onChange={e => this.setState({ numItems: e.target.value })}
						value={this.state.numItems}/>
				</p>
				<p>
					<label>Items per transaction</label>
					<input type="number" min={10}
						onChange={e => this.setState({ chunkSize: e.target.value })}
						value={this.state.chunkSize}/>
				</p>
				<p>
					<label>Number of collections</label>
					<input type="number" min={0}
						onChange={e => this.setState({ numCollections: e.target.value })}
						value={this.state.numCollections}/>
				</p>
				<p>
					<input type="submit" onClick={_ => generateData(this.state)}/>
				</p>
			</div>
		)
	}
}

async function generateData(options = {}) {
	var chunkSize = options.chunkSize;
	var numItems = options.numItems;
	var numCollections = options.numCollections;
	var runs = Math.ceil(numItems / chunkSize);
	var created = 0;
	if (numCollections) {
		var itemsPerCollection = Math.ceil(numItems / numCollections);
		var collectionsCreated = 1;
		var collection = new Zotero.Collection({ name: randStr(4, 40) });
		await collection.saveTx();
	}
	var itemTypes = Zotero.ItemTypes.getAll()
		// Don't create attachments, notes, or custom item types
		.filter(x => x.name != 'attachment' && x.name != 'note' && x.id < 10000);
	var accessDateFieldID = Zotero.ItemFields.getID('accessDate');
	for (let i = 0; i < runs; i++) {
		await Zotero.DB.executeTransaction(async function () {
			for (let j = 0; j < chunkSize && created++ < numItems; j++) {
				let { id: itemTypeID, name: itemType } =
					itemTypes[Math.floor(Math.random() * itemTypes.length)];
				let item = new Zotero.Item(itemType);
				item.setField('title', randStr(5, 200));
				let fieldIDs = Zotero.ItemFields.getItemTypeFields(itemTypeID);
				// Creators
				if (rand(1, 10) > 2) {
					let creators = [];
					let primaryCreatorTypeID = Zotero.CreatorTypes.getPrimaryIDForType(itemTypeID);
					// Add primary type for most items
					if (rand(1, 10) > 2) {
						let creatorType = Zotero.CreatorTypes.getName(primaryCreatorTypeID);
						addCreatorOfType(creators, creatorType);
					}
					// Add other types
					let creatorTypes = Zotero.CreatorTypes.getTypesForItemType(itemTypeID)
						.map(type => type.name);
					let maxCreators = rand(0, 8);
					for (let i = 0; i < maxCreators; i++) {
						addCreatorOfType(
							creators,
							creatorTypes[Math.floor(Math.random() * creatorTypes.length)]
						);
					}
					item.setCreators(creators);
				}
				// Fill a random set of fields with random data
				fieldIDs = getRandomSubarray(fieldIDs, Zotero.Utilities.rand(1, 10));
				for (let fieldID of fieldIDs) {
					// Avoid warning from invalid access date
					if (fieldID == accessDateFieldID) continue;
					
					item.setField(fieldID, randStr(1, 200));
				}
				// Add tags to 1 in 4 items
				if (Zotero.Utilities.rand(1, 4) == 1) {
					let numTags = rand(1, 10);
					for (let i = 0; i < numTags; i++) {
						item.addTag(
							randStr(4, 40),
							// Make 1/4 of tags automatic
							rand(1, 4) == 1 ? 1 : 0
						);
					}
				}
				if (collection) {
					item.setCollections([collection.id]);
					if (created % itemsPerCollection == 0) {
						collectionsCreated++;
						collection = new Zotero.Collection({ name: randStr(4, 40) });
						await collection.save();
					}
				}
				await item.save();
			}
		});
	}
	if (collectionsCreated < numCollections) {
		runs = Math.ceil((numCollections - collectionsCreated) / chunkSize);
		for (let i = 0; i < runs; i++) {
			await Zotero.DB.executeTransaction(async function () {
				for (let j = 0; j < chunkSize && collectionsCreated++ < numCollections; j++) {
					collection = new Zotero.Collection({ name: randStr(4, 40) });
					await collection.save();
				}
			});
		}
	}
};

// From http://stackoverflow.com/a/11935263
function getRandomSubarray(arr, size) {
	var shuffled = arr.slice(0), i = arr.length, temp, index;
	while (i--) {
		index = Math.floor((i + 1) * Math.random());
		temp = shuffled[index];
		shuffled[index] = shuffled[i];
		shuffled[i] = temp;
	}
	return shuffled.slice(0, size);
}

var rand = Zotero.Utilities.rand;
function randStr(min, max) {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
		+ "éØü"
		+ "漢字"
		+ "                    "
	do {
		var rnd = Zotero.Utilities.randomString(rand(min, max), chars);
	}
	// Make sure string isn't all spaces
	while (rnd.trim().length == 0);
	return rnd;
}

function addCreatorOfType(creators, creatorType) {
	if (rand(1, 2) == 1) {
		creators.push({
			creatorType,
			firstName: randStr(0, 10),
			lastName: randStr(3, 20)
		});
	}
	else {
		creators.push({
			creatorType,
			name: randStr(3, 40)
		});
	}
}

document.addEventListener('DOMContentLoaded', init);

