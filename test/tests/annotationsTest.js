describe("Zotero.Annotations", function() {
	var exampleHighlight = {
		"key": "92JLMCVT",
		"type": "highlight",
		"isAuthor": true,
		"text": "This is an <b>extracted</b> text with rich-text\nAnd a new line",
		"comment": "This is a comment with <i>rich-text</i>\nAnd a new line",
		"color": "#ffec00",
		"pageLabel": "15",
		"sortIndex": "00015|002431|00000",
		"position": {
			"pageIndex": 1,
			"rects": [
				[231.284, 402.126, 293.107, 410.142],
				[54.222, 392.164, 293.107, 400.18],
				[54.222, 382.201, 293.107, 390.217],
				[54.222, 372.238, 293.107, 380.254],
				[54.222, 362.276, 273.955, 370.292]
			]
		},
		"tags": [
			{
				"name": "math",
				"color": "#ff0000"
			},
			{
				"name": "chemistry"
			}
		],
		"dateModified": "2019-05-14 06:50:40"
	};
	var exampleHighlightAlt = jsonPositionToString(exampleHighlight);
	
	var exampleNote = {
		"key": "5TKU34XX",
		"type": "note",
		"isAuthor": true,
		"comment": "This is a note",
		"color": "#ffec00",
		"pageLabel": "14",
		"sortIndex": "00014|001491|00283",
		"position": {
			"pageIndex": 0,
			"rects": [
				[371.395, 266.635, 486.075, 274.651]
			]
		},
		"dateModified": "2019-05-14 06:50:54"
	};
	var exampleNoteAlt = jsonPositionToString(exampleNote);
	
	var exampleImage = {
		"key": "QD32MQJF",
		"type": "image",
		"isAuthor": true,
		"imageURL": "zotero://attachment/library/items/LB417FR4",
		"comment": "This is a comment",
		"color": "#ffec00",
		"pageLabel": "XVI",
		"sortIndex": "00016|003491|00683",
		"position": {
			"pageIndex": 123,
			"rects": [
				[314.4, 412.8, 556.2, 609.6]
			],
			"width": 400,
			"height": 200
		},
		"dateModified": "2019-05-14 06:51:22"
	};
	var exampleImageAlt = jsonPositionToString(exampleImage);
	
	var exampleGroupHighlight = {
		"key": "PE57YAYH",
		"type": "highlight",
		"isAuthor": false,
		"authorName": "Kate Smith",
		"text": "This is an <b>extracted</b> text with rich-text\nAnd a new line",
		"comment": "This is a comment with <i>rich-text</i>\nAnd a new line",
		"color": "#ffec00",
		"pageLabel": "15",
		"sortIndex": "00015|002431|00000",
		"position": {
			"pageIndex": 1,
			"rects": [
				[231.284, 402.126, 293.107, 410.142],
				[54.222, 392.164, 293.107, 400.18],
				[54.222, 382.201, 293.107, 390.217],
				[54.222, 372.238, 293.107, 380.254],
				[54.222, 362.276, 273.955, 370.292]
			]
		},
		"dateModified": "2019-05-14 06:50:40"
	};
	var exampleGroupHighlightAlt = jsonPositionToString(exampleGroupHighlight);
	
	// Item.position is a string, so when using the annotation JSON as input or when comparing we
	// have to use a version where 'position' has been stringified
	function jsonPositionToString(json) {
		var o = Object.assign({}, json);
		o.position = JSON.stringify(o.position);
		return o;
	}
	
	var item;
	var attachment;
	var group;
	var groupItem;
	var groupAttachment;
	
	before(async function () {
		item = await createDataObject('item');
		attachment = await importFileAttachment('test.pdf', { parentID: item.id });
		
		group = await getGroup();
		groupItem = await createDataObject('item', { libraryID: group.libraryID });
		groupAttachment = await importFileAttachment(
			'test.pdf',
			{ libraryID: group.libraryID, parentID: groupItem.id }
		);
	});
	
	describe("#toJSON()", function () {
		it("should generate an object for a highlight", async function () {
			var annotation = new Zotero.Item('annotation');
			annotation.libraryID = attachment.libraryID;
			annotation.key = exampleHighlight.key;
			await annotation.loadPrimaryData();
			annotation.parentID = attachment.id;
			annotation.annotationType = 'highlight';
			for (let prop of ['text', 'comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				annotation[itemProp] = exampleHighlightAlt[prop];
			}
			annotation.addTag("math");
			annotation.addTag("chemistry");
			await annotation.saveTx();
			await Zotero.Tags.setColor(annotation.libraryID, "math", "#ff0000", 0);
			var json = Zotero.Annotations.toJSON(annotation);
			
			assert.sameMembers(Object.keys(json), Object.keys(exampleHighlight));
			for (let prop of Object.keys(exampleHighlight)) {
				if (prop == 'dateModified') {
					continue;
				}
				assert.deepEqual(json[prop], exampleHighlightAlt[prop], `'${prop}' doesn't match`);
			}
			
			await annotation.eraseTx();
		});
		
		it("should generate an object for a note", async function () {
			var annotation = new Zotero.Item('annotation');
			annotation.libraryID = attachment.libraryID;
			annotation.key = exampleNote.key;
			await annotation.loadPrimaryData();
			annotation.parentID = attachment.id;
			annotation.annotationType = 'note';
			for (let prop of ['comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				annotation[itemProp] = exampleNoteAlt[prop];
			}
			await annotation.saveTx();
			var json = Zotero.Annotations.toJSON(annotation);
			
			assert.sameMembers(Object.keys(json), Object.keys(exampleNote));
			for (let prop of Object.keys(exampleNote)) {
				if (prop == 'dateModified') {
					continue;
				}
				assert.deepEqual(json[prop], exampleNoteAlt[prop], `'${prop}' doesn't match`);
			}
			
			await annotation.eraseTx();
		});
		
		it("should generate an object for an image", async function () {
			var annotation = new Zotero.Item('annotation');
			annotation.libraryID = attachment.libraryID;
			annotation.key = exampleImage.key;
			await annotation.loadPrimaryData();
			annotation.parentID = attachment.id;
			annotation.annotationType = 'image';
			for (let prop of ['comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				annotation[itemProp] = exampleImageAlt[prop];
			}
			await annotation.saveTx();
			
			// Get Blob from file and attach it
			var path = OS.Path.join(getTestDataDirectory().path, 'test.png');
			var imageData = await Zotero.File.getBinaryContentsAsync(path);
			var array = new Uint8Array(imageData.length);
			for (let i = 0; i < imageData.length; i++) {
				array[i] = imageData.charCodeAt(i);
			}
			var imageAttachment = await Zotero.Attachments.importEmbeddedImage({
				blob: new Blob([array], { type: 'image/png' }),
				parentItemID: annotation.id
			});
			
			var json = Zotero.Annotations.toJSON(annotation);
			
			assert.sameMembers(Object.keys(json), Object.keys(exampleImage));
			for (let prop of Object.keys(exampleImage)) {
				if (prop == 'imageURL'
						|| prop == 'dateModified') {
					continue;
				}
				assert.deepEqual(json[prop], exampleImageAlt[prop], `'${prop}' doesn't match`);
			}
			assert.equal(json.imageURL, `zotero://attachment/library/items/${imageAttachment.key}`);
			
			await annotation.eraseTx();
		});
		
		it("should generate an object for a highlight by another user in a group library", async function () {
			await Zotero.Users.setName(12345, 'Kate Smith');
			
			var annotation = new Zotero.Item('annotation');
			annotation.libraryID = group.libraryID;
			annotation.key = exampleGroupHighlight.key;
			await annotation.loadPrimaryData();
			annotation.createdByUserID = 12345;
			annotation.parentID = groupAttachment.id;
			annotation.annotationType = 'highlight';
			for (let prop of ['text', 'comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				annotation[itemProp] = exampleGroupHighlightAlt[prop];
			}
			await annotation.saveTx();
			var json = Zotero.Annotations.toJSON(annotation);
			
			assert.isFalse(json.isAuthor);
			assert.equal(json.authorName, 'Kate Smith');
			
			await annotation.eraseTx();
		});
	});
	
	
	describe("#saveFromJSON()", function () {
		it("should create an item from a highlight", async function () {
			var annotation = await Zotero.Annotations.saveFromJSON(attachment, exampleHighlight);
			
			assert.equal(annotation.key, exampleHighlight.key);
			for (let prop of ['text', 'comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				assert.deepEqual(annotation[itemProp], exampleHighlightAlt[prop], `'${prop}' doesn't match`);
			}
			var itemTags = annotation.getTags().map(t => t.tag);
			var jsonTags = exampleHighlight.tags.map(t => t.name);
			assert.sameMembers(itemTags, jsonTags);
		});
		
		it("should create an item from a note", async function () {
			var annotation = await Zotero.Annotations.saveFromJSON(attachment, exampleNote);
			
			assert.equal(annotation.key, exampleNote.key);
			for (let prop of ['comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				assert.deepEqual(annotation[itemProp], exampleNoteAlt[prop], `'${prop}' doesn't match`);
			}
		});
		
		it("should create an item from an image", async function () {
			var annotation = await Zotero.Annotations.saveFromJSON(attachment, exampleImage);
			
			// Note: Image is created separately using Zotero.Attachments.importEmbeddedImage()
			
			assert.equal(annotation.key, exampleImage.key);
			for (let prop of ['comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				assert.deepEqual(annotation[itemProp], exampleImageAlt[prop], `'${prop}' doesn't match`);
			}
		});
	});
})