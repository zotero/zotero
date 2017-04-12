"use strict";

describe("Zotero.Integration", function () {
	Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
	// Fully functional document plugin dummy based on word-for-windows-integration
	// Functions should be stubbed when testing as needed
	var DocumentPluginDummy = {};
	
	DocumentPluginDummy.Application = function() { 
		this.doc = new DocumentPluginDummy.Document();
		this.primaryFieldType = "Field";
		this.secondaryFieldType = "Bookmark";
		this.fields = [];
	};
	DocumentPluginDummy.Application.prototype = {
		getActiveDocument: function() {return this.doc},
		getDocument: function() {return this.doc},
		QueryInterface: function() {return this},
	};
	
	DocumentPluginDummy.Document = function() {this.fields = []};
	DocumentPluginDummy.Document.prototype = {
		// Needs to be stubbed for expected return values depending on prompt type
		// - Yes: 2, No: 1, Cancel: 0
		// - Yes: 1, No: 0
		// - Ok: 1, Cancel: 0
		// - Ok: 0
		displayAlert: () => 0,
		activate: () => 0,
		canInsertField: () => true,
		cursorInField: () => false,
		getDocumentData: function() {return this.data},
		setDocumentData: function(data) {this.data = data},
		insertField: function() { var field = new DocumentPluginDummy.Field(this); this.fields.push(field); return field },
		getFields: function() {return new DocumentPluginDummy.FieldEnumerator(this)},
		getFieldsAsync: function(fieldType, observer) {
			observer.observe(this.getFields(fieldType), 'fields-available', null)
		},
		setBibliographyStyle: () => 0,
		convert: () => 0,
		cleanup: () => 0, 
		complete: () => 0,
		QueryInterface: function() {return this},
	};
	
	DocumentPluginDummy.FieldEnumerator = function(doc) {this.doc = doc; this.idx = 0};
	DocumentPluginDummy.FieldEnumerator.prototype = {
		hasMoreElements: function() {return this.idx < this.doc.fields.length;},
		getNext: function() {return this.doc.fields[this.idx++]},
		QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports,
			Components.interfaces.nsISimpleEnumerator])
	};
	
	DocumentPluginDummy.Field = function(doc) {
		this.doc = doc;
		this.code = this.text = '';
		this.noteIndex = DocumentPluginDummy.Field.noteIndex++;
		this.wrappedJSObject = this;
	};
	DocumentPluginDummy.Field.noteIndex = 0;
	DocumentPluginDummy.Field.prototype = {
		delete: function() {this.doc.fields.filter((field) => field != this)},
		removeCode: function() {this.code = ""},
		select: () => 0,
		setText: function(text) {this.text = text},
		getText: function() {return this.text},
		setCode: function(code) {this.code = code},
		getCode: function() {return this.code},
		equals: function(field) {return this == field},
		getNoteIndex: function() {return this.noteIndex},
		QueryInterface: function() {return this},
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
			storeReferences: true,
			automaticJournalAbbreviations: true
		};
		data.style = {styleID, locale: 'en-US', hasBibliography: true, bibliographyStyleHasBeenSet: true};
		data.sessionID = Zotero.Utilities.randomString(10);
		Object.assign(data, options);
		applications[docID].getActiveDocument().setDocumentData(data.serializeXML());
	}
	
	function setDefaultIntegrationDocPrefs() {
		dialogResults.integrationDocPrefs = {
			style: "http://www.zotero.org/styles/cell",
			locale: 'en-US',
			fieldType: 'Field',
			storeReferences: true,
			automaticJournalAbbreviations: false,
			useEndnotes: 0
		};
	}
	setDefaultIntegrationDocPrefs();
	
	function setAddEditItems(items) {
		if (items.length == undefined) items = [items];
		dialogResults.quickFormat = function(doc, dialogName) {
			var citationItems = items.map((i) => {return {id: i.id} });
			var field = doc.insertField();
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
		
		sinon.stub(Zotero.Integration, 'getApplication', function(agent, command, docID) {
			if (!applications[docID]) {
				applications[docID] = new DocumentPluginDummy.Application();
			}
			return applications[docID];
		});
		
		displayDialogStub = sinon.stub(Zotero.Integration, 'displayDialog', function(doc, dialogName, prefs, io) {
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
			
			it('should not call doc.setDocumentData when document communicates for first time since restart, but has data', function* () {
				Zotero.Integration.sessions = {};
				yield execCommand('addEditCitation', docID);
				assert.isFalse(setDocumentDataSpy.called);
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
						var styleGetStub = sinon.stub(Zotero.Styles, 'get', function() {
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
					var styleGetStub = sinon.stub(Zotero.Styles, 'get', function() {
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
	});
});
