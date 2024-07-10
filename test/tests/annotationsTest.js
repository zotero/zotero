describe("Zotero.Annotations", function() {
	var exampleHighlight = {
		"libraryID": null,
		"key": "92JLMCVT",
		"type": "highlight",
		"isExternal": false,
		"readOnly": false,
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
		"libraryID": null,
		"key": "5TKU34XX",
		"type": "note",
		"isExternal": false,
		"readOnly": false,
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
		"libraryID": null,
		"key": "QD32MQJF",
		"type": "image",
		"isExternal": false,
		"readOnly": false,
		"image": "zotero://attachment/library/items/LB417FR4",
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
		"libraryID": null,
		"key": "PE57YAYH",
		"type": "highlight",
		"isExternal": false,
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
		exampleHighlight.libraryID = item.libraryID;
		exampleNote.libraryID = item.libraryID;
		exampleImage.libraryID = item.libraryID;
		
		group = await getGroup();
		exampleGroupHighlight.libraryID = group.libraryID;
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
			var json = await Zotero.Annotations.toJSON(annotation);
			
			assert.sameMembers(Object.keys(json), Object.keys(exampleHighlight));
			for (let prop of Object.keys(exampleHighlight)) {
				if (prop == 'dateModified') {
					continue;
				}
				assert.deepEqual(json[prop], exampleHighlight[prop], `'${prop}' doesn't match`);
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
			var json = await Zotero.Annotations.toJSON(annotation);
			
			assert.sameMembers(Object.keys(json), Object.keys(exampleNote));
			for (let prop of Object.keys(exampleNote)) {
				if (prop == 'dateModified') {
					continue;
				}
				assert.deepEqual(json[prop], exampleNote[prop], `'${prop}' doesn't match`);
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
			var blob = new Blob([array], { type: 'image/png' });
			var file = await Zotero.Annotations.saveCacheImage(annotation, blob);
			
			var json = await Zotero.Annotations.toJSON(annotation);
			
			assert.sameMembers(Object.keys(json), Object.keys(exampleImage));
			for (let prop of Object.keys(exampleImage)) {
				if (prop == 'image'
						|| prop == 'dateModified') {
					continue;
				}
				assert.deepEqual(json[prop], exampleImage[prop], `'${prop}' doesn't match`);
			}
			
			var imageVal = await new Zotero.Promise((resolve) => {
				var reader = new FileReader();
				reader.readAsDataURL(blob);
				reader.onloadend = function() {
					resolve(reader.result);
				}
			});
			assert.equal(json.image, imageVal);
			
			await annotation.eraseTx();
		});
		
		it("should generate an object for a highlight by another user in a group library", async function () {
			await Zotero.Users.setName(12345, 'First Last');
			
			var annotation = new Zotero.Item('annotation');
			annotation.libraryID = groupAttachment.libraryID;
			annotation.key = exampleGroupHighlight.key;
			await annotation.loadPrimaryData();
			annotation.createdByUserID = 12345;
			annotation.parentID = groupAttachment.id;
			annotation.annotationType = 'highlight';
			for (let prop of ['text', 'comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				annotation[itemProp] = exampleGroupHighlightAlt[prop];
			}
			await annotation.saveTx({
				skipEditCheck: true
			});
			var json = await Zotero.Annotations.toJSON(annotation);
			
			assert.equal(json.authorName, 'First Last');
			
			await annotation.eraseTx({
				skipEditCheck: true
			});
		});
		
		it("should generate an object for a highlight by another user modified by the current user in a group library", async function () {
			await Zotero.Users.setName(1, 'My Name');
			await Zotero.Users.setName(12345, 'Their Name');
			
			var annotation = await createAnnotation('highlight', groupAttachment);
			annotation.createdByUserID = 12345;
			annotation.lastModifiedByUserID = 1;
			await annotation.saveTx({
				skipEditCheck: true
			});
			var json = await Zotero.Annotations.toJSON(annotation);
			
			assert.equal(json.authorName, 'Their Name');
			assert.equal(json.lastModifiedByUser, 'My Name');
			
			await annotation.eraseTx({
				skipEditCheck: true
			});
		});
		
		it("should generate an object for an annotation by another user in a personal library", async function () {
			var annotation = await createAnnotation('highlight', attachment);
			annotation.annotationAuthorName = 'First Last';
			await annotation.saveTx();
			
			var json = await Zotero.Annotations.toJSON(annotation);
			
			assert.equal(json.authorName, 'First Last');
			
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
			
			// Note: Image is created separately using Zotero.Annotations.saveCacheImage()
			
			assert.equal(annotation.key, exampleImage.key);
			for (let prop of ['comment', 'color', 'pageLabel', 'sortIndex', 'position']) {
				let itemProp = 'annotation' + prop[0].toUpperCase() + prop.substr(1);
				assert.deepEqual(annotation[itemProp], exampleImageAlt[prop], `'${prop}' doesn't match`);
			}
		});
		
		it("should remove empty fields", async function () {
			var annotation = await Zotero.Annotations.saveFromJSON(attachment, exampleHighlight);
			var json = Object.assign({}, exampleHighlight);
			json.comment = '';
			json.pageLabel = '';
			await Zotero.Annotations.saveFromJSON(attachment, json);
			
			assert.isNull(annotation.annotationComment);
			assert.isNull(annotation.annotationPageLabel);
		});
	});

	describe("#splitAnnotations()", function () {
		it("should split a highlight annotation", async function () {
			await Zotero.Items.erase(attachment.getAnnotations().map(x => x.id));
			let annotation = await createAnnotation('highlight', attachment);
			let position = {
				pageIndex: 1,
				rects: []
			};
			for (let i = 0; i < 10000; i++) {
				position.rects.push([100, 200, 100, 200]);
			}
			annotation.annotationPosition = JSON.stringify(position);
			annotation.annotationText = 'test';
			await annotation.saveTx();

			await Zotero.Annotations.splitAnnotations([annotation]);

			let splitAnnotations = attachment.getAnnotations();
			assert.equal(splitAnnotations.length, 3);
			assert.equal(splitAnnotations[0].annotationPosition.length, 64987);
			assert.equal(splitAnnotations[1].annotationPosition.length, 64987);
			assert.equal(splitAnnotations[2].annotationPosition.length, 50101);
			assert.equal(splitAnnotations[0].annotationText, 'test');
			assert.equal(splitAnnotations[1].annotationText, 'test');
			assert.equal(splitAnnotations[2].annotationText, 'test');

			assert.equal(Zotero.Items.get(annotation.id), false);
			await Zotero.Items.erase(splitAnnotations.map(x => x.id));
		});

		it("should split an ink annotation", async function () {
			await Zotero.Items.erase(attachment.getAnnotations().map(x => x.id));
			let annotation = await createAnnotation('ink', attachment);
			let position = {
				pageIndex: 1,
				width: 2,
				paths: []
			};
			for (let i = 0; i < 100; i++) {
				let path = [];
				for (let j = 0; j < 200; j++) {
					path.push(100, 200);
				}
				position.paths.push(path);
			}
			annotation.annotationPosition = JSON.stringify(position);
			annotation.annotationComment = 'test';
			await annotation.saveTx();

			await Zotero.Annotations.splitAnnotations([annotation]);

			let splitAnnotations = attachment.getAnnotations();
			assert.equal(splitAnnotations.length, 3);
			assert.equal(splitAnnotations[0].annotationPosition.length, 64957);
			assert.equal(splitAnnotations[1].annotationPosition.length, 64951);
			assert.equal(splitAnnotations[2].annotationPosition.length, 30401);
			assert.equal(splitAnnotations[0].annotationComment, 'test');
			assert.equal(splitAnnotations[1].annotationComment, 'test');
			assert.equal(splitAnnotations[2].annotationComment, 'test');

			assert.equal(Zotero.Items.get(annotation.id), false);
			await Zotero.Items.erase(splitAnnotations.map(x => x.id));
		});
	});
});

describe("Create a note from annotations from multiple items and attachments", function () {
	it("should create a note from single PDF file containing multiple annotations", async function () {
		let annotations = [];
		let attachment = await importPDFAttachment();
		let annotation1 = await createAnnotation('highlight', attachment);
		annotations.push(annotation1);
		let annotation2 = await createAnnotation('highlight', attachment);
		annotations.push(annotation2);
		let note = await Zotero.EditorInstance.createNoteFromAnnotations(annotations);
		assert.equal(note.note.split('test').length - 1, 1);
		assert.equal(note.note.split(annotation1.annotationText).length - 1, 1);
		assert.equal(note.note.split(annotation2.annotationText).length - 1, 1);
	});

	it("should create a note from multiple PDF files containing single annotation", async function () {
		let annotations = [];
		let item = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item);
		let attachment2 = await importPDFAttachment(item);
		let annotation1 = await createAnnotation('highlight', attachment1);
		annotations.push(annotation1);
		let annotation2 = await createAnnotation('highlight', attachment2);
		annotations.push(annotation2);
		let note = await Zotero.EditorInstance.createNoteFromAnnotations(annotations);
		assert.equal(note.note.split('test').length - 1, 2);
		assert.equal(note.note.split('>' + item.getField('title') + '<').length - 1, 0);
		assert.equal(note.note.split(annotation1.annotationText).length - 1, 1);
		assert.equal(note.note.split(annotation2.annotationText).length - 1, 1);
	});

	it("should create a note from multiple parent items containing single PDF file with single annotation", async function () {
		let annotations = [];
		let item1 = await createDataObject('item', { setTitle: true });
		let item2 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item1);
		let attachment2 = await importPDFAttachment(item2);
		let annotation1 = await createAnnotation('highlight', attachment1);
		annotations.push(annotation1);
		let annotation2 = await createAnnotation('highlight', attachment2);
		annotations.push(annotation2);
		let note = await Zotero.EditorInstance.createNoteFromAnnotations(annotations);
		assert.equal(note.note.split('test').length - 1, 0);
		assert.equal(note.note.split('>' + item1.getField('title') + '<').length - 1, 1);
		assert.equal(note.note.split('>' + item2.getField('title') + '<').length - 1, 1);
		assert.equal(note.note.split(annotation1.annotationText).length - 1, 1);
		assert.equal(note.note.split(annotation2.annotationText).length - 1, 1);
	});

	it("should create a note from multiple parent items containing multiple PDF files with multiple annotations", async function () {
		let annotations = [];
		let item1 = await createDataObject('item', { setTitle: true });
		let item2 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item1);
		let attachment2 = await importPDFAttachment(item2);
		let attachment3 = await importPDFAttachment(item2);
		let annotation1 = await createAnnotation('highlight', attachment1);
		annotations.push(annotation1);
		let annotation2 = await createAnnotation('highlight', attachment2);
		annotations.push(annotation2);
		let annotation3 = await createAnnotation('highlight', attachment3);
		annotations.push(annotation3);
		let annotation4 = await createAnnotation('highlight', attachment3);
		annotations.push(annotation4);
		let note = await Zotero.EditorInstance.createNoteFromAnnotations(annotations);
		Zotero.debug(note.note);
		assert.equal(note.note.split('test').length - 1, 2);
		assert.equal(note.note.split('>' + item1.getField('title') + '<').length - 1, 1);
		assert.equal(note.note.split('>' + item2.getField('title') + '<').length - 1, 1);
		assert.equal(note.note.split(annotation1.annotationText).length - 1, 1);
		assert.equal(note.note.split(annotation2.annotationText).length - 1, 1);
		// Check item URIs count
		assert.equal(note.note.split('zotero.org').length - 1, 16);
	});
});
