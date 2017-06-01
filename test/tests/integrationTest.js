"use strict";

describe("Zotero.Integration", function () {
	Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
	/**
	 * To be used as a reference for Zotero-Word Integration plugins
	 */
	var DocumentPluginDummy = {};

	/**
	 * The Application class corresponds to a word processing application.
	 */
	DocumentPluginDummy.Application = function() { 
		this.doc = new DocumentPluginDummy.Document();
		this.primaryFieldType = "Field";
		this.secondaryFieldType = "Bookmark";
		this.fields = [];
	};
	DocumentPluginDummy.Application.prototype = {
		/**
		 * Gets the active document.
		 * @returns {DocumentPluginDummy.Document}
		 */
		getActiveDocument: function() {return this.doc},
		/**
		 * Gets the document by some app-specific identifier.
		 * @param {String|Number} docID
		 */
		getDocument: function(docID) {return this.doc},
		QueryInterface: function() {return this},
	};

	/**
	 * The Document class corresponds to a single word processing document.
	 */
	DocumentPluginDummy.Document = function() {this.fields = []};
	DocumentPluginDummy.Document.prototype = {
		/**
		 * Displays a dialog in the word processing application
		 * @param {String} dialogText
		 * @param {Number} icon - one of the constants defined in integration.js for dialog icons
		 * @param {Number} buttons - one of the constants defined in integration.js for dialog buttons
		 * @returns {Number}
		 *		 - Yes: 2, No: 1, Cancel: 0
		 *		 - Yes: 1, No: 0
		 *		 - Ok: 1, Cancel: 0
		 *		 - Ok: 0
		 */
		displayAlert: (dialogText, icon, buttons) => 0,
		/**
		 * Brings this document to the foreground (if necessary to return after displaying a dialog)
		 */
		activate: () => 0,
		/**
		 * Determines whether a field can be inserted at the current position.
		 * @param {String} fieldType
		 * @returns {Boolean}
		 */
		canInsertField: (fieldType) => true,
		/**
		 * Returns the field in which the cursor resides, or NULL if none.
		 * @param {String} fieldType
		 * @returns {Boolean}
		 */
		cursorInField: (fieldType) => false,
		/**
		 * Get document data property from the current document
		 * @returns {String}
		 */
		getDocumentData: function() {return this.data},
		/**
		 * Set document data property
		 * @param {String} data
		 */
		setDocumentData: function(data) {this.data = data},
		/**
		 * Inserts a field at the given position and initializes the field object.
		 * @param {String} fieldType
		 * @param {Integer} noteType
		 * @returns {DocumentPluginDummy.Field}
		 */
		insertField: function(fieldType, noteType) { 
			if (typeof noteType != "number") {
				throw new Error("noteType must be an integer");
			}
			var field = new DocumentPluginDummy.Field(this); 
			this.fields.push(field); 
			return field 
		},
		/**
		 * Gets all fields present in the document.
		 * @param {String} fieldType
		 * @returns {DocumentPluginDummy.FieldEnumerator}
		 */
		getFields: function(fieldType) {return new DocumentPluginDummy.FieldEnumerator(this)},
		/**
		 * Gets all fields present in the document. The observer will receive notifications for two
		 * topics: "fields-progress", with the document as the subject and percent progress as data, and
		 * "fields-available", with an nsISimpleEnumerator of fields as the subject and the length as
		 * data
		 * @param {String} fieldType
		 * @param {nsIObserver} observer
		 */
		getFieldsAsync: function(fieldType, observer) {
			observer.observe(this.getFields(fieldType), 'fields-available', null)
		},
		/**
		 * Sets the bibliography style, overwriting the current values for this document
		 */
		setBibliographyStyle: (firstLineIndent, bodyIndent, lineSpacing, entrySpacing,
			tabStops, tabStopsCount) => 0,
		/**
		 * Converts all fields in a document to a different fieldType or noteType
		 * @params {DocumentPluginDummy.FieldEnumerator} fields
		 */
		convert: (fields, toFieldType, toNoteType, count) => 0,
		/**
		 * Cleans up the document state and resumes processor for editing
		 */
		cleanup: () => 0,

		/**
		 * Informs the document processor that the operation is complete
		 */
		complete: () => 0,
	};

	DocumentPluginDummy.FieldEnumerator = function(doc) {this.doc = doc; this.idx = 0};
	DocumentPluginDummy.FieldEnumerator.prototype = {
		hasMoreElements: function() {return this.idx < this.doc.fields.length;},
		getNext: function() {return this.doc.fields[this.idx++]},
		QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports,
			Components.interfaces.nsISimpleEnumerator])
	};
	
	/**
	 * The Field class corresponds to a field containing an individual citation
	 * or bibliography
	 */
	DocumentPluginDummy.Field = function(doc) {
		this.doc = doc;
		this.code = '';
		// This is actually required and current integration code depends on text being non-empty upon insertion.
		// insertBibliography will fail if there is no placeholder text.
		this.text = '{Placeholder}';
		this.wrappedJSObject = this;
	};
	DocumentPluginDummy.Field.noteIndex = 0;
	DocumentPluginDummy.Field.prototype = {
		/**
		 * Deletes this field and its contents.
		 */
		delete: function() {this.doc.fields.filter((field) => field !== this)},
		/**
		 * Removes this field, but maintains the field's contents.
		 */
		removeCode: function() {this.code = ""},
		/**
		 * Selects this field.
		 */
		select: () => 0,
		/**
		 * Sets the text inside this field to a specified plain text string or pseudo-RTF formatted text
		 * string.
		 * @param {String} text
		 * @param {Boolean} isRich
		 */
		setText: function(text, isRich) {this.text = text},
		/**
		 * Gets the text inside this field, preferably with formatting, but potentially without
		 * @returns {String}
		 */
		getText: function() {return this.text},
		/**
		 * Sets field's code
		 * @param {String} code
		 */
		setCode: function(code) {this.code = code},
		/**
		 * Gets field's code.
		 * @returns {String}
		 */
		getCode: function() {return this.code},
		/**
		 * Returns true if this field and the passed field are actually references to the same field.
		 * @param {DocumentPluginDummy.Field} field
		 * @returns {Boolean}
		 */
		equals: function(field) {return this == field},
		/**
		 * This field's note index, if it is in a footnote or endnote; otherwise zero.
		 * @returns {Number}
		 */
		getNoteIndex: () => 0,
	};

	for (let cls of ['Application', 'Document', 'FieldEnumerator', 'Field']) {
		for (let methodName in DocumentPluginDummy[cls].prototype) {
			if (methodName !== 'QueryInterface') {
				let method = DocumentPluginDummy[cls].prototype[methodName];
				DocumentPluginDummy[cls].prototype[methodName] = function() {
					try {
						Zotero.debug(`DocumentPluginDummy: ${cls}.${methodName} invoked with args ${JSON.stringify(arguments)}`, 2);
					} catch (e) {
						Zotero.debug(`DocumentPluginDummy: ${cls}.${methodName} invoked with args ${arguments}`, 2);
					}
					var result = method.apply(this, arguments);
					try {
						Zotero.debug(`Result: ${JSON.stringify(result)}`, 2);
					} catch (e) {
						Zotero.debug(`Result: ${result}`, 2);
					}
					return result;
				}
			}
		}
	}
	
	var testItems;
	var applications = {};
	var addEditCitationSpy, displayDialogStub;
	var styleID = "http://www.zotero.org/styles/cell";
	var stylePath = OS.Path.join(getTestDataDirectory().path, 'cell.csl');

	var commandList = [
		'addCitation', 'editCitation', 'addEditCitation',
		'addBibliography', 'editBibliography', 'addEditBibliography',
		'refresh', 'removeCodes', 'setDocPrefs'
	];
	
	function execCommand(command, docID) {
		if (! commandList.includes(command)) {
			throw new Error(`${command} is not a valid document command`);
		}
		if (typeof docID === "undefined") {
			throw new Error(`docID cannot be undefined`)
		}
		return Zotero.Integration.execCommand("dummy", command, docID);
	}
	
	var dialogResults = {
		addCitationDialog: {},
		quickFormat: {},
		integrationDocPrefs: {},
		selectItemsDialog: {},
		editBibliographyDialog: {}
	};
	
	function initDoc(docID, options={}) {
		applications[docID] = new DocumentPluginDummy.Application();
		var data = new Zotero.Integration.DocumentData();
		data.prefs = {
			noteType: 0,
			fieldType: "Field",
			automaticJournalAbbreviations: true
		};
		data.style = {styleID, locale: 'en-US', hasBibliography: true, bibliographyStyleHasBeenSet: true};
		data.sessionID = Zotero.Utilities.randomString(10);
		Object.assign(data, options);
		applications[docID].getActiveDocument().setDocumentData(data.serialize());
	}
	
	function setDefaultIntegrationDocPrefs() {
		dialogResults.integrationDocPrefs = {
			style: "http://www.zotero.org/styles/cell",
			locale: 'en-US',
			fieldType: 'Field',
			automaticJournalAbbreviations: false,
			useEndnotes: 0
		};
	}
	setDefaultIntegrationDocPrefs();
	
	function setAddEditItems(items) {
		if (items.length == undefined) items = [items];
		dialogResults.quickFormat = function(doc, dialogName) {
			var citationItems = items.map((i) => {return {id: i.id} });
			var field = doc.insertField("Field", 0);
			field.setCode('TEMP');
			var integrationDoc = addEditCitationSpy.lastCall.thisValue;
			var fieldGetter = new Zotero.Integration.Fields(integrationDoc._session, integrationDoc._doc, () => 0);
			var io = new Zotero.Integration.CitationEditInterface(
				{ citationItems, properties: {} },
				field,
				fieldGetter,
				integrationDoc._session
			);
			io._acceptDeferred.resolve();
			return io;
		}
	}
	
	before(function* () {
		yield Zotero.Styles.init();
		yield Zotero.Styles.install({file: stylePath}, styleID, true);

		testItems = [];
		for (let i = 0; i < 5; i++) {
			testItems.push(yield createDataObject('item', {libraryID: Zotero.Libraries.userLibraryID}));
		}
		setAddEditItems(testItems[0]);
		
		sinon.stub(Zotero.Integration, 'getApplication').callsFake(function(agent, command, docID) {
			if (!applications[docID]) {
				applications[docID] = new DocumentPluginDummy.Application();
			}
			return applications[docID];
		});
		
		displayDialogStub = sinon.stub(Zotero.Integration, 'displayDialog', 
		// @TODO: This sinon.stub syntax is deprecated!
		// However when using callsFake tests won't work. This is due to a 
		// possible bug that reset() erases callsFake.
		// @NOTE: https://github.com/sinonjs/sinon/issues/1341
		// displayDialogStub.callsFake(function(doc, dialogName, prefs, io) {
		function(doc, dialogName, prefs, io) {
			var ioResult = dialogResults[dialogName.substring(dialogName.lastIndexOf('/')+1, dialogName.length-4)];
			if (typeof ioResult == 'function') {
				ioResult = ioResult(doc, dialogName);
			}
			Object.assign(io, ioResult);
			return Zotero.Promise.resolve();
		});
		
		addEditCitationSpy = sinon.spy(Zotero.Integration.Document.prototype, 'addEditCitation');
	});
	
	after(function() {
		Zotero.Integration.getApplication.restore();
		displayDialogStub.restore();
		addEditCitationSpy.restore();
	});
	
	describe('Document', function() {
		describe('#addEditCitation', function() {
			var setDocumentDataSpy;
			var docID = this.fullTitle();
			
			before(function() {
				setDocumentDataSpy = sinon.spy(DocumentPluginDummy.Document.prototype, 'setDocumentData');
			});
			
			afterEach(function() {
				setDocumentDataSpy.reset();
			});
			
			after(function() {
				setDocumentDataSpy.restore();
			});
			
			it('should call doc.setDocumentData on a fresh document', function* () {
				yield execCommand('addEditCitation', docID);
				assert.isTrue(setDocumentDataSpy.calledOnce);
			});
			
			it('should not call doc.setDocumentData on subsequent invocations', function* () {
				yield execCommand('addEditCitation', docID);
				assert.isFalse(setDocumentDataSpy.called);
			});
			
			it('should call doc.setDocumentData when document communicates for first time since restart to write new sessionID', function* () {
				Zotero.Integration.sessions = {};
				yield execCommand('addEditCitation', docID);
				assert.isTrue(setDocumentDataSpy.calledOnce);
			});
			
			describe('when style used in the document does not exist', function() {
				var docID = this.fullTitle();
				var displayAlertStub;
				var style;
				before(function* () {
					displayAlertStub = sinon.stub(DocumentPluginDummy.Document.prototype, 'displayAlert').returns(0);
				});
				
				beforeEach(function() {
					// 🦉birds?
					style = {styleID: "http://www.example.com/csl/waterbirds", locale: 'en-US'};
					
					// Make sure style not in library
					try {
						Zotero.Styles.get(style.styleID).remove();
					} catch (e) {}
					initDoc(docID, {style});
					displayDialogStub.reset();
					displayAlertStub.reset();
				});
				
				after(function* () {
					displayAlertStub.restore();
				});
			
				describe('when the style is not from a trusted source', function() {
					it('should download the style and not call doc.setDocumentData if user clicks YES', function* () {
						setDocumentDataSpy.reset();
						var styleInstallStub = sinon.stub(Zotero.Styles, "install").resolves();
						var style = Zotero.Styles.get(styleID);
						var styleGetCalledOnce = false;
						var styleGetStub = sinon.stub(Zotero.Styles, 'get').callsFake(function() {
							if (!styleGetCalledOnce) {
								styleGetCalledOnce = true;
								return false;
							}
							return style;
						});
						displayAlertStub.returns(1);
						yield execCommand('addEditCitation', docID);
						assert.isTrue(displayAlertStub.calledOnce);
						assert.isFalse(displayDialogStub.calledWith(applications[docID].doc, 'chrome://zotero/content/integration/integrationDocPrefs.xul'));
						assert.isTrue(styleInstallStub.calledOnce);
						assert.isFalse(setDocumentDataSpy.called);
						assert.isOk(Zotero.Styles.get(style.styleID));
						styleInstallStub.restore();
						styleGetStub.restore();
					});
					
					it('should prompt with the document preferences dialog if user clicks NO', function* () {
						displayAlertStub.returns(0);
						yield execCommand('addEditCitation', docID);
						assert.isTrue(displayAlertStub.calledOnce);
						// Prefs to select a new style and quickFormat
						assert.isTrue(displayDialogStub.calledTwice);
						assert.isNotOk(Zotero.Styles.get(style.styleID));
					});	
				});
					
				it('should download the style without prompting if it is from zotero.org', function* (){
					initDoc(docID, {styleID: "http://www.zotero.org/styles/waterbirds", locale: 'en-US'});
					var styleInstallStub = sinon.stub(Zotero.Styles, "install").resolves();
					var style = Zotero.Styles.get(styleID);
					var styleGetCalledOnce = false;
					var styleGetStub = sinon.stub(Zotero.Styles, 'get').callsFake(function() {
						if (!styleGetCalledOnce) {
							styleGetCalledOnce = true;
							return false;
						}
						return style;
					});
					displayAlertStub.returns(1);
					yield execCommand('addEditCitation', docID);
					assert.isFalse(displayAlertStub.called);
					assert.isFalse(displayDialogStub.calledWith(applications[docID].doc, 'chrome://zotero/content/integration/integrationDocPrefs.xul'));
					assert.isTrue(styleInstallStub.calledOnce);
					assert.isOk(Zotero.Styles.get(style.styleID));
					styleInstallStub.restore();
					styleGetStub.restore();	
				});
			});
		});
		
		describe('#addEditBibliography', function() {
			var docID = this.fullTitle();
			beforeEach(function* () {
				initDoc(docID);
				yield execCommand('addEditCitation', docID);
			});
			
			it('should insert bibliography if no bibliography field present', function* () {
				yield execCommand('addEditBibliography', docID);
				var biblPresent = false;
				for (let i = applications[docID].doc.fields.length-1; i >= 0; i--) {
					let field = applications[docID].doc.fields[i];
					Zotero.debug(field.getCode(), 1);
					if (field.getCode().includes("CSL_BIBLIOGRAPHY")) {
						biblPresent = true;
						break;
					}
				}
				assert.isTrue(biblPresent);
			});
			
			it('should display the edit bibliography dialog if bibliography present', function* () {
				yield execCommand('addEditBibliography', docID);
				displayDialogStub.reset();
				yield execCommand('addEditBibliography', docID);
				assert.isTrue(displayDialogStub.calledOnce);
				assert.isTrue(displayDialogStub.lastCall.args[1].includes('editBibliographyDialog'));
			});
		});
	});
	
	describe("DocumentData", function() {
		it('should properly unserialize old XML document data', function() {
			var serializedXMLData = "<data data-version=\"3\" zotero-version=\"5.0.SOURCE\"><session id=\"F0NFmZ32\"/><style id=\"http://www.zotero.org/styles/cell\" hasBibliography=\"1\" bibliographyStyleHasBeenSet=\"1\"/><prefs><pref name=\"fieldType\" value=\"ReferenceMark\"/><pref name=\"automaticJournalAbbreviations\" value=\"true\"/><pref name=\"noteType\" value=\"0\"/></prefs></data>";
			var data = new Zotero.Integration.DocumentData(serializedXMLData);
			var expectedData = {
				style: {
					styleID: 'http://www.zotero.org/styles/cell',
					locale: null,
					hasBibliography: true,
					bibliographyStyleHasBeenSet: true
				},
				prefs: {
					fieldType: 'ReferenceMark',
					automaticJournalAbbreviations: true,
					noteType: 0
				},
				sessionID: 'F0NFmZ32',
				zoteroVersion: '5.0.SOURCE',
				dataVersion: '3'
			};
			// Convert to JSON to remove functions from DocumentData object
			assert.equal(JSON.stringify(data), JSON.stringify(expectedData));
		});
		
		it('should properly unserialize JSON document data', function() {
			var expectedData = JSON.stringify({
				style: {
					styleID: 'http://www.zotero.org/styles/cell',
					locale: 'en-US',
					hasBibliography: true,
					bibliographyStyleHasBeenSet: true
				},
				prefs: {
					fieldType: 'ReferenceMark',
					automaticJournalAbbreviations: false,
					noteType: 0
				},
				sessionID: 'owl-sesh',
				zoteroVersion: '5.0.SOURCE',
				dataVersion: 4
			});
			var data = new Zotero.Integration.DocumentData(expectedData);
			// Convert to JSON to remove functions from DocumentData object
			assert.equal(JSON.stringify(data), expectedData);
		});
		
		it('should properly serialize document data to XML (data ver 3)', function() {
			sinon.spy(Zotero, 'debug');
			var data = new Zotero.Integration.DocumentData();
			data.sessionID = "owl-sesh";
			data.zoteroVersion = Zotero.version;
			data.dataVersion = 3;
			data.style = {
				styleID: 'http://www.zotero.org/styles/cell',
				locale: 'en-US',
				hasBibliography: false,
				bibliographyStyleHasBeenSet: true
			};
			data.prefs = {
				noteType: 1,
				fieldType: "Field",
				automaticJournalAbbreviations: true
			};
			
			var serializedData = data.serialize();
			// Make sure we serialized to XML here
			assert.equal(serializedData[0], '<');
			// Serialize and unserialize (above test makes sure unserialize works properly).
			var processedData = new Zotero.Integration.DocumentData(serializedData);
			
			// This isn't ideal, but currently how it works. Better serialization which properly retains types
			// coming with official 5.0 release.
			data.dataVersion = "3";

			// Convert to JSON to remove functions from DocumentData objects
			assert.equal(JSON.stringify(processedData), JSON.stringify(data));
			
			// Make sure we are not triggering debug traces in Utilities.htmlSpecialChars()
			assert.isFalse(Zotero.debug.calledWith(sinon.match.string, 1));
			Zotero.debug.restore();
		});
		
		it('should properly serialize document data to JSON (data ver 4)', function() {
			var data = new Zotero.Integration.DocumentData();
			// data version 4 triggers serialization to JSON
			// (e.g. when we've retrieved data from the doc and it was ver 4 already)
			data.dataVersion = 4;
			data.sessionID = "owl-sesh";
			data.style = {
				styleID: 'http://www.zotero.org/styles/cell',
				locale: 'en-US',
				hasBibliography: false,
				bibliographyStyleHasBeenSet: true
			};
			data.prefs = {
				noteType: 1,
				fieldType: "Field",
				automaticJournalAbbreviations: true
			};
			
			// Serialize and unserialize (above tests makes sure unserialize works properly).
			var processedData = new Zotero.Integration.DocumentData(data.serialize());

			// Added in serialization routine
			data.zoteroVersion = Zotero.version;
			
			// Convert to JSON to remove functions from DocumentData objects
			assert.deepEqual(JSON.parse(JSON.stringify(processedData)), JSON.parse(JSON.stringify(data)));
		});
	})
});
