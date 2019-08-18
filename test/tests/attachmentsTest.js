describe("Zotero.Attachments", function() {
	var win;
	
	before(function* () {
		// Hidden browser, which requires a browser window, needed for charset detection
		// (until we figure out a better way)
		win = yield loadBrowserWindow();
	});
	after(function () {
		if (win) {
			win.close();
		}
	});
	
	describe("#importFromFile()", function () {
		it("should create a child attachment from a text file", function* () {
			// Create test file
			var contents = "Test";
			var tmpFile = Zotero.getTempDirectory();
			tmpFile.append('test.txt');
			yield Zotero.File.putContentsAsync(tmpFile, contents);
			
			// Create parent item
			var item = new Zotero.Item('book');
			var parentItemID = yield item.saveTx();
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: tmpFile,
				parentItemID: parentItemID
			});
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(item.id);
		});
		
		it("should create a top-level attachment from a PNG file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var contents = yield Zotero.File.getBinaryContentsAsync(file);
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getBinaryContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(item.id);
		});
		
		it("should create a top-level attachment from a PNG file in a collection", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var contents = yield Zotero.File.getBinaryContentsAsync(file);
			
			var collection = yield createDataObject('collection');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file,
				collections: [collection.id]
			});
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getBinaryContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(item.id);
		});
		
		it("should create a child attachment from a PNG file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var contents = yield Zotero.File.getBinaryContentsAsync(file);
			
			// Create parent item
			var item = new Zotero.Item('book');
			var parentItemID = yield item.saveTx();
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file,
				parentItemID: parentItemID
			});
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getBinaryContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(item.id);
		});
	})
	
	describe("#linkFromFile()", function () {
		it("should link to a file in My Library", function* () {
			var item = yield createDataObject('item');
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.linkFromFile({
				file: file,
				parentItemID: item.id
			});
			
			assert.equal(attachment.getFilePath(), file.path);
		})
		
		it.skip("should throw an error for a non-user library", function* () {
			// Should create a group library for use by all tests
		})
	})
	
	
	describe("#linkFromFileWithRelativePath()", function () {
		afterEach(function () {
			Zotero.Prefs.clear('baseAttachmentPath');
		});
		
		it("should link to a file using a relative path with no base directory set", async function () {
			Zotero.Prefs.clear('baseAttachmentPath');
			
			var item = await createDataObject('item');
			var spy = sinon.spy(Zotero.Fulltext, 'indexPDF');
			var relPath = 'a/b/test.pdf';
			
			var attachment = await Zotero.Attachments.linkFromFileWithRelativePath({
				path: relPath,
				title: 'test.pdf',
				parentItemID: item.id,
				contentType: 'application/pdf'
			});
			
			assert.ok(spy.notCalled);
			spy.restore();
			assert.equal(
				attachment.attachmentPath,
				Zotero.Attachments.BASE_PATH_PLACEHOLDER + relPath
			);
		});
		
		
		it("should link to a file using a relative path within the base directory", async function () {
			var baseDir = await getTempDirectory();
			Zotero.Prefs.set('baseAttachmentPath', baseDir);
			Zotero.Prefs.set('saveRelativeAttachmentPath', true);
			
			var subDir = OS.Path.join(baseDir, 'foo');
			await OS.File.makeDir(subDir);
			
			var file = OS.Path.join(subDir, 'test.pdf');
			await OS.File.copy(OS.Path.join(getTestDataDirectory().path, 'test.pdf'), file);
			
			var item = await createDataObject('item');
			var spy = sinon.spy(Zotero.Fulltext, 'indexPDF');
			var relPath = 'foo/test.pdf';
			
			var attachment = await Zotero.Attachments.linkFromFileWithRelativePath({
				path: relPath,
				title: 'test.pdf',
				parentItemID: item.id,
				contentType: 'application/pdf'
			});
			
			assert.ok(spy.called);
			spy.restore();
			assert.equal(
				attachment.attachmentPath,
				Zotero.Attachments.BASE_PATH_PLACEHOLDER + relPath
			);
			
			assert.ok(await attachment.fileExists());
		});
		
		
		it("should link to a nonexistent file using a relative path within the base directory", async function () {
			var baseDir = await getTempDirectory();
			Zotero.Prefs.set('baseAttachmentPath', baseDir);
			Zotero.Prefs.set('saveRelativeAttachmentPath', true);
			
			var subDir = OS.Path.join(baseDir, 'foo');
			await OS.File.makeDir(subDir);
			
			var item = await createDataObject('item');
			var spy = sinon.spy(Zotero.Fulltext, 'indexPDF');
			var relPath = 'foo/test.pdf';
			
			var attachment = await Zotero.Attachments.linkFromFileWithRelativePath({
				path: relPath,
				title: 'test.pdf',
				parentItemID: item.id,
				contentType: 'application/pdf'
			});
			
			assert.ok(spy.notCalled);
			spy.restore();
			assert.equal(
				attachment.attachmentPath,
				Zotero.Attachments.BASE_PATH_PLACEHOLDER + relPath
			);
			
			assert.isFalse(await attachment.fileExists());
		});
		
		
		it("should reject absolute paths", async function () {
			try {
				await Zotero.Attachments.linkFromFileWithRelativePath({
					path: '/a/b/test.pdf',
					title: 'test.pdf',
					contentType: 'application/pdf'
				});
			}
			catch (e) {
				return;
			}
			
			assert.fail();
		});
	});
	
	
	describe("#importSnapshotFromFile()", function () {
		it("should import an HTML file", function* () {
			var item = yield createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test.html');
			var attachment = yield Zotero.Attachments.importSnapshotFromFile({
				title: 'Snapshot',
				url: 'http://example.com',
				file,
				parentItemID: item.id,
				contentType: 'text/html',
				charset: 'utf-8'
			});
			
			var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'test');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
		});
		
		it("should detect charset for an HTML file", function* () {
			var item = yield createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test.html');
			var attachment = yield Zotero.Attachments.importSnapshotFromFile({
				title: 'Snapshot',
				url: 'http://example.com',
				file,
				parentItemID: item.id,
				contentType: 'text/html'
			});
			
			assert.equal(attachment.attachmentCharset, 'utf-8');
			
			var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'test');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
		});
		
		// This isn't particularly the behavior we want, but it documents the expected behavior
		it("shouldn't index JavaScript-created text in an HTML file when the charset isn't known in advance", async function () {
			var item = await createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test-js.html');
			var attachment = await Zotero.Attachments.importSnapshotFromFile({
				title: 'Snapshot',
				url: 'http://example.com',
				file,
				parentItemID: item.id,
				contentType: 'text/html'
			});
			
			assert.equal(attachment.attachmentCharset, 'utf-8');
			
			var matches = await Zotero.Fulltext.findTextInItems([attachment.id], 'test');
			assert.lengthOf(matches, 0);
		});
	});
	
	describe("#linkFromDocument", function () {
		it("should add a link attachment for the current webpage", function* () {
			var item = yield createDataObject('item');
			
			var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
			var deferred = Zotero.Promise.defer();
			win.addEventListener('pageshow', () => deferred.resolve());
			win.loadURI(uri);
			yield deferred.promise;
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.linkFromDocument({
				document: win.content.document,
				parentItemID: item.id
			});
			
			assert.equal(attachment.getField('url'), "file://" + uri);
			
			// Check indexing
			var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'share your research');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
		})
	})
	
	describe("#importFromDocument()", function () {
		it("should save a document with embedded files", function* () {
			var item = yield createDataObject('item');
			
			var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
			var deferred = Zotero.Promise.defer();
			win.addEventListener('pageshow', () => deferred.resolve());
			win.loadURI(uri);
			yield deferred.promise;
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.importFromDocument({
				document: win.content.document,
				parentItemID: item.id
			});
			
			assert.equal(attachment.getField('url'), "file://" + uri);
			
			// Check indexing
			var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'share your research');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
			
			// Check for embedded files
			var storageDir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var file = yield attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(file), 'index.html');
			assert.isTrue(yield OS.File.exists(OS.Path.join(storageDir, 'img.gif')));
		});
	});
	
	describe("PDF Retrieval", function () {
		var doiPrefix = 'https://doi.org/';
		var doi1 = '10.1111/abcd';
		var doi2 = '10.2222/bcde';
		var doi3 = '10.3333/cdef';
		var doi4 = '10.4444/defg';
		var doi5 = '10.5555/efgh';
		var doi6 = '10.6666/fghi';
		var pageURL1 = 'http://website/article1';
		var pageURL2 = 'http://website/article2';
		var pageURL3 = 'http://website/article3';
		var pageURL4 = 'http://website/article4';
		var pageURL5 = `http://website/${doi4}`;
		var pageURL6 = `http://website/${doi4}/json`;
		var pageURL7 = doiPrefix + doi5;
		var pageURL8 = 'http://website2/article8';
		var pageURL9 = 'http://website/article9';
		var pageURL10 = 'http://website/refresh';
		
		Components.utils.import("resource://zotero-unit/httpd.js");
		var httpd;
		var port = 16213;
		var baseURL = `http://localhost:${port}/`;
		var pdfPath = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
		var pdfURL = `${baseURL}article1/pdf`;
		var pdfSize;
		var requestStub;
		var requestStubCallTimes = [];
		var return429 = true;
		
		function makeGetResponseHeader(headers) {
			return function (header) {
				if (headers[header] !== undefined) {
					return headers[header];
				}
				throw new Error(`Unimplemented header '${header}'`);
			};
		}
		
		function getHTMLPage(includePDF) {
			return `<html>
				<head>
					<title>Page Title</title>
					<link rel="schema.DC" href="http://purl.org/dc/elements/1.1/" />
					<meta name="citation_title" content="Title"/>
					<meta name="${includePDF ? 'citation_pdf_url' : 'ignore'}" content="${pdfURL}"/>
				</head>
				<body>Body</body>
			</html>`;
		}
		
		function makeHTMLResponseFromType(html, responseType, responseURL) {
			var response;
			if (responseType == 'document') {
				let parser = new DOMParser();
				let doc = parser.parseFromString(html, 'text/html');
				doc = Zotero.HTTP.wrapDocument(doc, responseURL);
				response = doc;
			}
			else if (responseType == 'blob') {
				let blob = new Blob([html], {type: 'text/html'});
				response = blob;
			}
			else {
				throw new Error("Request not mocked");
			}
			
			return {
				status: 200,
				response,
				responseURL,
				getResponseHeader: makeGetResponseHeader({
					'Content-Type': 'text/html'
				})
			};
		}
		
		before(async function () {
			var pdfBlob = await File.createFromFileName(pdfPath);
			
			var origFunc = Zotero.HTTP.request.bind(Zotero.HTTP);
			requestStub = sinon.stub(Zotero.HTTP, 'request');
			requestStub.callsFake(function (method, url, options) {
				Zotero.debug("Intercepting " + method + " " + url);
				requestStubCallTimes.push(new Date());
				
				// Page responses
				var routes = [
					// DOI 1 redirects to page 1, which contains a PDF
					[doiPrefix + doi1, pageURL1, true],
					[pageURL1, pageURL1, true],
					// DOI 2 redirects to page 2, which doesn't contain a PDF, but DOI 2 has an
					// OA entry for the PDF URL
					[doiPrefix + doi2, pageURL2, false],
					[pageURL2, pageURL2, false],
					// DOI 3 redirects to page 2, which doesn't contain a PDF, but DOI 3 contains
					// an OA entry for page 3, which contains a PDF)
					[doiPrefix + doi3, pageURL2, false],
					[pageURL3, pageURL3, true],
					// DOI 4 redirects to page 4, which doesn't contain a PDF
					[doiPrefix + doi4, pageURL4, false],
					[pageURL4, pageURL4, false],
					// DOI 6 redirects to page 8, which is on a different domain and has a PDF
					[doiPrefix + doi6, pageURL8, true],
					[pageURL8, pageURL8, true],
				];
				for (let route of routes) {
					let [expectedURL, responseURL, includePDF] = route;
					
					if (url != expectedURL) continue;
					
					// Return explicit 302 if not following redirects
					if (expectedURL != responseURL && options.followRedirects === false) {
						return {
							status: 302,
							getResponseHeader: makeGetResponseHeader({
								Location: responseURL
							})
						};
					}
					
					let html = getHTMLPage(includePDF);
					return makeHTMLResponseFromType(html, options.responseType, responseURL);
				}
				
				// HTML page with PDF download link
				if (url == pageURL5) {
					let html = `<html>
						<head>
							<title>Page Title</title>
						</head>
						<body>
							<a id="pdf-link" href="${pdfURL}">Download PDF</a>
						</body>
					</html>`;
					
					return makeHTMLResponseFromType(html, options.responseType, pageURL5);
				}
				
				// JSON response with PDF download links
				if (url == pageURL6) {
					let response = {
						oa_locations: [
							{
								url_for_landing_page: pageURL1
							},
							{
								url_for_pdf: pdfURL
							}
						]
					};
					return {
						status: 200,
						response,
						responseURL: pageURL6,
						getResponseHeader: makeGetResponseHeader({
							'Content-Type': 'application/json'
						})
					};
				}
				
				// DOI that redirects directly to a PDF
				if (url == pageURL7) {
					return {
						status: 200,
						response: pdfBlob,
						responseURL: pdfURL,
						getResponseHeader: makeGetResponseHeader({
							'Content-Type': 'application/pdf'
						})
					};
				}
				
				// Returns a 429 every other call
				if (url.startsWith(pageURL9)) {
					if (return429) {
						return429 = false;
						throw new Zotero.HTTP.UnexpectedStatusException(
							{
								status: 429,
								response: '',
								responseURL: pageURL9,
								getResponseHeader: makeGetResponseHeader({
									'Content-Type': 'text/plain',
									'Retry-After': '2',
								})
							},
							pageURL9,
							'Failing with 429'
						);
					}
					else {
						return429 = true;
						let html = getHTMLPage(true);
						return makeHTMLResponseFromType(html, options.responseType, pageURL9);
					}
				}
				
				if (url == pageURL10) {
					let html = `<html><head><meta http-equiv=\"refresh\" content=\"2;url=${pageURL1}\"/></head><body></body></html>`;
					return makeHTMLResponseFromType(html, options.responseType, pageURL10);
				}
				
				// OA PDF lookup
				if (url.startsWith(ZOTERO_CONFIG.SERVICES_URL)) {
					let json = JSON.parse(options.body);
					let response = [];
					if (json.doi == doi2) {
						response.push({
							url: pdfURL,
							version: 'submittedVersion'
						});
					}
					else if (json.doi == doi3) {
						response.push({
							pageURL: pageURL3,
							version: 'submittedVersion'
						});
					}
					return {
						status: 200,
						response,
						getResponseHeader: makeGetResponseHeader({
							'Content-Type': 'application/pdf'
						})
					};
				}
				return origFunc(...arguments);
			});
			
			pdfSize = await OS.File.stat(pdfPath).size;
			
			Zotero.Prefs.clear('findPDFs.resolvers');
		});
		
		beforeEach(async function () {
			httpd = new HttpServer();
			httpd.start(port);
			httpd.registerFile(
				pdfURL.substr(baseURL.length - 1),
				Zotero.File.pathToFile(OS.Path.join(getTestDataDirectory().path, 'test.pdf'))
			);
			
			requestStubCallTimes = [];
		});
		
		afterEach(async function () {
			requestStub.resetHistory();
			await new Promise((resolve) => {
				httpd.stop(() => resolve());
			});
			Zotero.Prefs.clear('findPDFs.resolvers');
			
			// Close progress dialog after each run
			var queue = Zotero.ProgressQueues.get('findPDF');
			if (queue) {
				queue.getDialog().close();
			}
		}.bind(this));
		
		after(() => {
			Zotero.HTTP.request.restore();
		});
		
		it("should add a PDF from a resolved DOI webpage", async function () {
			var doi = doi1;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.isTrue(requestStub.calledTwice);
			assert.isTrue(requestStub.getCall(0).calledWith('GET', 'https://doi.org/' + doi));
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should add a PDF from a DOI that resolves directly to the file", async function () {
			var doi = doi5;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.isTrue(requestStub.calledOnce);
			assert.isTrue(requestStub.calledWith('GET', 'https://doi.org/' + doi));
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should add a PDF from a resolved DOI from the Extra field", async function () {
			var doi = doi1;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('extra', 'DOI: ' + doi);
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.isTrue(requestStub.calledTwice);
			assert.isTrue(requestStub.getCall(0).calledWith('GET', 'https://doi.org/' + doi));
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should add a PDF from a URL", async function () {
			var url = pageURL1;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('url', url);
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.isTrue(requestStub.calledOnce);
			assert.isTrue(requestStub.calledWith('GET', url));
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should add an OA PDF from a direct URL", async function () {
			var doi = doi2;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.isTrue(requestStub.calledThrice);
			var call1 = requestStub.getCall(0);
			assert.isTrue(call1.calledWith('GET', 'https://doi.org/' + doi));
			var call2 = requestStub.getCall(1);
			assert.isTrue(call2.calledWith('GET', pageURL2));
			var call3 = requestStub.getCall(2);
			assert.isTrue(call3.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should add an OA PDF from a page URL", async function () {
			var doi = doi3;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.equal(requestStub.callCount, 4);
			// Check the DOI (and get nothing)
			var call = requestStub.getCall(0);
			assert.isTrue(call.calledWith('GET', 'https://doi.org/' + doi));
			call = requestStub.getCall(1);
			assert.isTrue(call.calledWith('GET', pageURL2));
			// Check the OA resolver and get page 3
			call = requestStub.getCall(2);
			assert.isTrue(call.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			// Check page 3 and find the download URL
			call = requestStub.getCall(3);
			assert.isTrue(call.calledWith('GET', pageURL3));
			
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("shouldn't try the redirected DOI page again if also in the URL field", async function () {
			var doi = doi4;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			item.setField('url', pageURL4);
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.equal(requestStub.callCount, 3);
			var call = requestStub.getCall(0);
			assert.isTrue(call.calledWith('GET', 'https://doi.org/' + doi));
			call = requestStub.getCall(1);
			assert.isTrue(call.calledWith('GET', pageURL4));
			call = requestStub.getCall(2);
			assert.isTrue(call.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			
			assert.isFalse(attachment);
		});
		
		it("should wait between requests to the same domain", async function () {
			var url1 = pageURL1;
			var item1 = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item1.setField('title', 'Test');
			item1.setField('url', url1);
			await item1.saveTx();
			
			var url2 = pageURL3;
			var item2 = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item2.setField('title', 'Test');
			item2.setField('url', url2);
			await item2.saveTx();
			
			var attachments = await Zotero.Attachments.addAvailablePDFs([item1, item2]);
			
			assert.isTrue(requestStub.calledTwice);
			assert.isAbove(requestStubCallTimes[1] - requestStubCallTimes[0], 998);
			// Make sure both items have attachments
			assert.equal(item1.numAttachments(), 1);
			assert.equal(item2.numAttachments(), 1);
		});
		
		it("should wait between requests that resolve to the same domain", async function () {
			// DOI URL resolves to 'website' domain with PDF
			var url1 = doiPrefix + doi1;
			var item1 = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item1.setField('title', 'Test');
			item1.setField('url', url1);
			await item1.saveTx();
			
			// DOI URL resolves to 'website' domain without PDF
			var url2 = doiPrefix + doi4;
			var item2 = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item2.setField('title', 'Test');
			item2.setField('url', url2);
			await item2.saveTx();
			
			// DOI URL resolves to 'website2' domain without PDF
			var url3 = doiPrefix + doi6;
			var item3 = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item3.setField('title', 'Test');
			item3.setField('url', url3);
			await item3.saveTx();
			
			var attachments = await Zotero.Attachments.addAvailablePDFs([item1, item2, item3]);
			
			assert.equal(requestStub.callCount, 6);
			assert.equal(requestStub.getCall(0).args[1], doiPrefix + doi1);
			assert.equal(requestStub.getCall(1).args[1], pageURL1);
			assert.equal(requestStub.getCall(2).args[1], doiPrefix + doi4);
			// Should skip ahead to the next DOI
			assert.equal(requestStub.getCall(3).args[1], doiPrefix + doi6);
			// which is on a new domain
			assert.equal(requestStub.getCall(4).args[1], pageURL8);
			// and then return to make 'website' request for DOI 4
			assert.equal(requestStub.getCall(5).args[1], pageURL4);
			
			// 'website' requests should be a second apart
			assert.isAbove(requestStubCallTimes[5] - requestStubCallTimes[1], 999);
			
			assert.equal(item1.numAttachments(), 1);
			assert.equal(item2.numAttachments(), 0);
			assert.equal(item3.numAttachments(), 1);
		});
		
		it("should wait between requests to the same domain after a 429", async function () {
			var url1 = pageURL9;
			var item1 = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item1.setField('title', 'Test');
			item1.setField('url', url1);
			await item1.saveTx();
			
			var url2 = pageURL3;
			var item2 = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item2.setField('title', 'Test');
			item2.setField('url', url2);
			await item2.saveTx();
			
			var attachments = await Zotero.Attachments.addAvailablePDFs([item1, item2]);
			
			assert.isTrue(requestStub.calledThrice);
			assert.equal(requestStub.getCall(0).args[1], pageURL9);
			assert.equal(requestStub.getCall(1).args[1], pageURL9);
			assert.equal(requestStub.getCall(2).args[1], pageURL3);
			assert.isAbove(requestStubCallTimes[1] - requestStubCallTimes[0], 1999);
			// Make sure both items have attachments
			assert.equal(item1.numAttachments(), 1);
			assert.equal(item2.numAttachments(), 1);
		});
		
		it("should follow a meta redirect", async function () {
			var url = pageURL10;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('url', url);
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.isTrue(requestStub.calledTwice);
			assert.equal(requestStub.getCall(0).args[1], pageURL10)
			assert.equal(requestStub.getCall(1).args[1], pageURL1)
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should handle a custom resolver in HTML mode", async function () {
			var doi = doi4;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			await item.saveTx();
			
			var resolvers = [{
				name: 'Custom',
				method: 'get',
				url: 'http://website/{doi}',
				mode: 'html',
				selector: '#pdf-link',
				attribute: 'href'
			}];
			Zotero.Prefs.set('findPDFs.resolvers', JSON.stringify(resolvers));
			
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.equal(requestStub.callCount, 4);
			var call = requestStub.getCall(0);
			assert.isTrue(call.calledWith('GET', 'https://doi.org/' + doi));
			var call = requestStub.getCall(1);
			assert.isTrue(call.calledWith('GET', pageURL4));
			call = requestStub.getCall(2);
			assert.isTrue(call.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			call = requestStub.getCall(3);
			assert.isTrue(call.calledWith('GET', pageURL5));
			
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should handle a custom resolver in JSON mode with URL strings", async function () {
			var doi = doi4;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			await item.saveTx();
			
			var resolvers = [{
				name: 'Custom',
				method: 'get',
				url: 'http://website/{doi}/json',
				mode: 'json',
				selector: '.oa_locations.url_for_pdf'
			}];
			Zotero.Prefs.set('findPDFs.resolvers', JSON.stringify(resolvers));
			
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.equal(requestStub.callCount, 4);
			var call = requestStub.getCall(0);
			assert.isTrue(call.calledWith('GET', 'https://doi.org/' + doi));
			call = requestStub.getCall(1);
			assert.isTrue(call.calledWith('GET', pageURL4));
			call = requestStub.getCall(2);
			assert.isTrue(call.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			call = requestStub.getCall(3);
			assert.isTrue(call.calledWith('GET', pageURL6));
			
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should handle a custom resolver in JSON mode with mapped properties", async function () {
			var doi = doi4;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			await item.saveTx();
			
			var resolvers = [{
				name: 'Custom',
				method: 'get',
				url: 'http://website/{doi}/json',
				mode: 'json',
				selector: '.oa_locations',
				mappings: {
					url: 'url_for_pdf',
					pageURL: 'url_for_landing_page',
				}
			}];
			Zotero.Prefs.set('findPDFs.resolvers', JSON.stringify(resolvers));
			
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			
			assert.equal(requestStub.callCount, 5);
			var call = requestStub.getCall(0);
			assert.isTrue(call.calledWith('GET', 'https://doi.org/' + doi));
			call = requestStub.getCall(1);
			assert.isTrue(call.calledWith('GET', pageURL4));
			call = requestStub.getCall(2);
			assert.isTrue(call.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			call = requestStub.getCall(3);
			assert.isTrue(call.calledWith('GET', pageURL6));
			call = requestStub.getCall(4);
			assert.isTrue(call.calledWith('GET', pageURL1));
			
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
	});
	
	describe("#getBaseDirectoryRelativePath()", function () {
		it("should handle base directory at Windows drive root", function () {
			Zotero.Prefs.set('baseAttachmentPath', "C:\\");
			var path = Zotero.Attachments.getBaseDirectoryRelativePath("C:\\file.txt");
			assert.equal(path, Zotero.Attachments.BASE_PATH_PLACEHOLDER + "file.txt");
		});
		
		it("should convert backslashes to forward slashes", function () {
			Zotero.Prefs.set('baseAttachmentPath', "C:\\foo\\bar");
			var path = Zotero.Attachments.getBaseDirectoryRelativePath("C:\\foo\\bar\\test\\file.txt");
			assert.equal(path, Zotero.Attachments.BASE_PATH_PLACEHOLDER + "test/file.txt");
		});
	});
	
	describe("#getTotalFileSize", function () {
		it("should return the size for a single-file attachment", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			
			assert.equal((yield Zotero.Attachments.getTotalFileSize(item)), file.fileSize);
		})
	})
	
	describe("#hasMultipleFiles and #getNumFiles()", function () {
		it("should return false and 1 for a single file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			
			assert.isFalse(yield Zotero.Attachments.hasMultipleFiles(item));
			assert.equal((yield Zotero.Attachments.getNumFiles(item)), 1);
		})
		
		it("should return false and 1 for single HTML file with hidden file", function* () {
			var file = getTestDataDirectory();
			file.append('test.html');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var path = OS.Path.join(OS.Path.dirname(item.getFilePath()), '.zotero-ft-cache');
			yield Zotero.File.putContentsAsync(path, "");
			
			assert.isFalse(yield Zotero.Attachments.hasMultipleFiles(item));
			assert.equal((yield Zotero.Attachments.getNumFiles(item)), 1);
		})
		
		it("should return true and 2 for multiple files", function* () {
			var file = getTestDataDirectory();
			file.append('test.html');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var path = OS.Path.join(OS.Path.dirname(item.getFilePath()), 'test.png');
			yield Zotero.File.putContentsAsync(path, "");
			
			assert.isTrue(yield Zotero.Attachments.hasMultipleFiles(item));
			assert.equal((yield Zotero.Attachments.getNumFiles(item)), 2);
		})
	});
	
	describe("#createDirectoryForItem()", function () {
		it("should create missing directory", function* () {
			var item = yield importFileAttachment('test.png');
			var path = OS.Path.dirname(item.getFilePath());
			yield OS.File.removeDir(path);
			yield Zotero.Attachments.createDirectoryForItem(item);
			assert.isTrue(yield OS.File.exists(path));
		});
		
		it("should delete all existing files", function* () {
			var item = yield importFileAttachment('test.html');
			var path = OS.Path.dirname(item.getFilePath());
			var files = ['a', 'b', 'c', 'd'];
			for (let file of files) {
				yield Zotero.File.putContentsAsync(OS.Path.join(path, file), file);
			}
			yield Zotero.Attachments.createDirectoryForItem(item);
			assert.isTrue(yield Zotero.File.directoryIsEmpty(path));
			assert.isTrue(yield OS.File.exists(path));
		});
		
		it("should handle empty directory", function* () {
			var item = yield importFileAttachment('test.png');
			var file = item.getFilePath();
			var dir = OS.Path.dirname(item.getFilePath());
			yield OS.File.remove(file);
			yield Zotero.Attachments.createDirectoryForItem(item);
			assert.isTrue(yield OS.File.exists(dir));
		});
	});
	
	describe("#convertLinkedFileToStoredFile()", function () {
		it("should copy a linked file to a stored file", async function () {
			var item = await createDataObject('item');
			var relatedItem = await createDataObject('item');
			
			var originalFile = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
			var attachment = await Zotero.Attachments.linkFromFile({
				file: originalFile,
				title: 'Title',
				parentItemID: item.id
			});
			attachment.setNote('Note');
			attachment.setTags([{ tag: 'Tag' }]);
			attachment.addRelatedItem(relatedItem);
			await attachment.saveTx();
			relatedItem.addRelatedItem(attachment);
			await relatedItem.saveTx();
			// Make sure we're indexed
			await Zotero.Fulltext.indexItems([attachment.id]);
			
			var newAttachment = await Zotero.Attachments.convertLinkedFileToStoredFile(attachment);
			
			assert.isFalse(Zotero.Items.exists(attachment.id));
			assert.isTrue(await OS.File.exists(originalFile));
			assert.equal(newAttachment.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_FILE);
			assert.equal(newAttachment.attachmentContentType, 'application/pdf');
			assert.isTrue(await newAttachment.fileExists());
			assert.equal(newAttachment.getField('title'), 'Title');
			assert.equal(newAttachment.getNote(), 'Note');
			assert.sameDeepMembers(newAttachment.getTags(), [{ tag: 'Tag' }]);
			assert.sameMembers(newAttachment.relatedItems, [relatedItem.key]);
			assert.sameMembers(relatedItem.relatedItems, [newAttachment.key]);
			assert.isTrue(await OS.File.exists(Zotero.Fulltext.getItemCacheFile(newAttachment).path));
			assert.equal(
				await Zotero.Fulltext.getIndexedState(newAttachment),
				Zotero.Fulltext.INDEX_STATE_INDEXED
			);
		});
		
		
		it("should move a linked file to a stored file with `move: true`", async function () {
			var item = await createDataObject('item');
			
			var originalFile = OS.Path.join(Zotero.getTempDirectory().path, 'test.png');
			await OS.File.copy(
				OS.Path.join(getTestDataDirectory().path, 'test.png'),
				originalFile
			);
			var attachment = await Zotero.Attachments.linkFromFile({
				file: originalFile,
				parentItemID: item.id
			});
			
			var newAttachment = await Zotero.Attachments.convertLinkedFileToStoredFile(
				attachment,
				{
					move: true
				}
			);
			
			assert.isFalse(Zotero.Items.exists(attachment.id));
			assert.isFalse(await OS.File.exists(originalFile));
			assert.equal(newAttachment.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_FILE);
			assert.isTrue(await newAttachment.fileExists());
		});
	});
})
