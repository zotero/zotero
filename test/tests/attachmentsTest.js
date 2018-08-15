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
	
	describe("#addAvailablePDF()", function () {
		var doiPrefix = 'https://doi.org/';
		var doi1 = '10.1111/abcd';
		var doi2 = '10.2222/bcde';
		var doi3 = '10.3333/cdef';
		var doi4 = '10.4444/defg';
		var pageURL1 = 'http://website/article1';
		var pageURL2 = 'http://website/article2';
		var pageURL3 = 'http://website/article3';
		var pageURL4 = 'http://website/article4';
		var pageURL5 = `http://website/${doi4}`;
		var pageURL6 = `http://website/${doi4}/json`;
		
		Components.utils.import("resource://zotero-unit/httpd.js");
		var httpd;
		var port = 16213;
		var baseURL = `http://localhost:${port}/`;
		var pdfURL = `${baseURL}article1/pdf`;
		var pdfSize;
		var requestStub;
		
		before(async function () {
			var origFunc = Zotero.HTTP.request.bind(Zotero.HTTP);
			requestStub = sinon.stub(Zotero.HTTP, 'request');
			requestStub.callsFake(function (method, url, options) {
				// Page responses
				var routes = [
					// Page 1 contains a PDF
					[pageURL1, pageURL1, true],
					// DOI 1 redirects to page 1, which contains a PDF
					[doiPrefix + doi1, pageURL1, true],
					// DOI 2 redirects to page 2, which doesn't contain a PDF, but DOI 2 has an
					// OA entry for the PDF URL
					[doiPrefix + doi2, pageURL2, false],
					// DOI 3 redirects to page 2, which doesn't contain a PDF, but DOI 3 contains
					// an OA entry for page 3, which contains a PDF)
					[doiPrefix + doi3, pageURL2, false],
					[pageURL3, pageURL3, true],
					// DOI 4 redirects to page 4, which doesn't contain a PDF
					[doiPrefix + doi4, pageURL4, false]
				];
				for (let route of routes) {
					let [expectedURL, responseURL, includePDF] = route;
					
					if (url != expectedURL) continue;
					
					var html = `<html>
						<head>
							<title>Page Title</title>
							<link rel="schema.DC" href="http://purl.org/dc/elements/1.1/" />
							<meta name="citation_title" content="Title"/>
							<meta name="${includePDF ? 'citation_pdf_url' : 'ignore'}" content="${pdfURL}"/>
						</head>
						<body>Body</body>
					</html>`;
					let parser = new DOMParser();
					let doc = parser.parseFromString(html, 'text/html');
					doc = Zotero.HTTP.wrapDocument(doc, responseURL);
					return {
						status: 200,
						response: doc,
						responseURL
					};
				}
				
				// HTML page with PDF download link
				if (url == pageURL5) {
					var html = `<html>
						<head>
							<title>Page Title</title>
						</head>
						<body>
							<a id="pdf-link" href="${pdfURL}">Download PDF</a>
						</body>
					</html>`;
					let parser = new DOMParser();
					let doc = parser.parseFromString(html, 'text/html');
					doc = Zotero.HTTP.wrapDocument(doc, pageURL5);
					return {
						status: 200,
						response: doc,
						responseURL: pageURL5
					};
				}
				
				// JSON response with PDF download links
				if (url == pageURL6) {
					return {
						status: 200,
						response: {
							oa_locations: [
								{
									url_for_landing_page: pageURL1
								},
								{
									url_for_pdf: pdfURL
								}
							]
						},
						responseURL: pageURL6
					};
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
						response
					};
				}
				return origFunc(...arguments);
			});
			
			pdfSize = await OS.File.stat(
				OS.Path.join(getTestDataDirectory().path, 'test.pdf')
			).size;
			
			Zotero.Prefs.clear('findPDFs.resolvers');
		});
		
		beforeEach(async function () {
			httpd = new HttpServer();
			httpd.start(port);
			httpd.registerFile(
				pdfURL.substr(baseURL.length - 1),
				Zotero.File.pathToFile(OS.Path.join(getTestDataDirectory().path, 'test.pdf'))
			);
		});
		
		afterEach(async function () {
			requestStub.resetHistory();
			await new Promise((resolve) => {
				httpd.stop(() => resolve());
			});
			Zotero.Prefs.clear('findPDFs.resolvers');
		}.bind(this));
		
		after(() => {
			Zotero.HTTP.request.restore();
		});
		
		it("should add a PDF from a resolved DOI", async function () {
			var doi = doi1;
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
			
			assert.isTrue(requestStub.calledTwice);
			var call1 = requestStub.getCall(0);
			assert.isTrue(call1.calledWith('GET', 'https://doi.org/' + doi));
			var call2 = requestStub.getCall(1);
			assert.isTrue(call2.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			
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
			
			assert.isTrue(requestStub.calledThrice);
			// Check the DOI (and get nothing)
			var call1 = requestStub.getCall(0);
			assert.isTrue(call1.calledWith('GET', 'https://doi.org/' + doi));
			// Check the OA resolver and get page 3
			var call2 = requestStub.getCall(1);
			assert.isTrue(call2.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			// Check page 3 and find the download URL
			var call3 = requestStub.getCall(2);
			assert.isTrue(call3.calledWith('GET', pageURL3));
			
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
			
			assert.isTrue(requestStub.calledTwice);
			var call1 = requestStub.getCall(0);
			assert.isTrue(call1.calledWith('GET', 'https://doi.org/' + doi));
			var call2 = requestStub.getCall(1);
			assert.isTrue(call2.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			
			assert.isFalse(attachment);
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
			
			assert.isTrue(requestStub.calledThrice);
			var call1 = requestStub.getCall(0);
			assert.isTrue(call1.calledWith('GET', 'https://doi.org/' + doi));
			var call2 = requestStub.getCall(1);
			assert.isTrue(call2.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			var call3 = requestStub.getCall(2);
			assert.isTrue(call3.calledWith('GET', pageURL5));
			
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
			
			assert.isTrue(requestStub.calledThrice);
			var call1 = requestStub.getCall(0);
			assert.isTrue(call1.calledWith('GET', 'https://doi.org/' + doi));
			var call2 = requestStub.getCall(1);
			assert.isTrue(call2.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			var call3 = requestStub.getCall(2);
			assert.isTrue(call3.calledWith('GET', pageURL6));
			
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
			
			assert.equal(requestStub.callCount, 4);
			var call1 = requestStub.getCall(0);
			assert.isTrue(call1.calledWith('GET', 'https://doi.org/' + doi));
			var call2 = requestStub.getCall(1);
			assert.isTrue(call2.calledWith('POST', ZOTERO_CONFIG.SERVICES_URL + 'oa/search'));
			var call3 = requestStub.getCall(2);
			assert.isTrue(call3.calledWith('GET', pageURL6));
			var call4 = requestStub.getCall(3);
			assert.isTrue(call4.calledWith('GET', pageURL1));
			
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
})
