describe("Zotero.Attachments", function() {
	var HiddenBrowser;
	var browser;
	
	before(function () {
		HiddenBrowser = ChromeUtils.import("chrome://zotero/content/HiddenBrowser.jsm").HiddenBrowser;
	});
	
	afterEach(function () {
		if (browser) {
			browser.destroy();
			browser = null;
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

		it("should set a top-level item's title to the filename, minus its extension", async function () {
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.importFromFile({
				file: file,
			});
			assert.equal(attachment.getField('title'), 'test');
			await attachment.eraseTx();
		});

		it("should set a child item's title to the filename, minus its extension", async function () {
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let parent = await createDataObject('item');
			let attachment = await Zotero.Attachments.importFromFile({
				file: file,
				parentItemID: parent.id,
			});
			assert.equal(attachment.getField('title'), Zotero.getString('fileTypes.pdf'));
			await parent.eraseTx();
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

		it("should set a top-level item's title to the filename, minus its extension", async function () {
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.linkFromFile({
				file: file,
			});
			assert.equal(attachment.getField('title'), 'test');
			await attachment.eraseTx();
		});

		it("should set a child item's title to the filename, minus its extension", async function () {
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let parent = await createDataObject('item');
			let attachment = await Zotero.Attachments.linkFromFile({
				file: file,
				parentItemID: parent.id,
			});
			assert.equal(attachment.getField('title'), Zotero.getString('fileTypes.pdf'));
			await parent.eraseTx();
		});
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
		
		it("should index JavaScript-created text in an HTML file", async function () {
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
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
		});
	});
	
	
	describe("#importFromURL()", function () {
		it("should use BrowserDownload for a JS redirect page", async function () {
			let downloadPDFStub = sinon.stub(Zotero.BrowserDownload, "downloadPDF");
			downloadPDFStub.callsFake(async (_url, path) => {
				await OS.File.copy(OS.Path.join(getTestDataDirectory().path, 'test.pdf'), path);
			});
			try {
				var item = await Zotero.Attachments.importFromURL({
					libraryID: Zotero.Libraries.userLibraryID,
					url: 'https://zotero-static.s3.amazonaws.com/test-pdf-redirect.html',
					contentType: 'application/pdf'
				});
				
				assert.isTrue(downloadPDFStub.calledOnce);
			}
			finally {
				// Clean up
				await Zotero.Items.erase(item.id);
				downloadPDFStub.restore();
			}
		});
	});
	
	
	describe("#linkFromDocument", function () {
		it("should add a link attachment for the current webpage", function* () {
			var item = yield createDataObject('item');
			
			var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
			browser = new HiddenBrowser(uri);
			yield browser.load(uri);
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.linkFromDocument({
				document: yield browser.getDocument(),
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
		Components.utils.import("resource://gre/modules/FileUtils.jsm");
		
		var testServerPath, httpd, prefix;
		var testServerPort;

		before(async function () {
			this.timeout(20000);
			Zotero.Prefs.set("httpServer.enabled", true);
		});

		beforeEach(async function () {
			// Use random prefix because httpd does not actually stop between tests
			prefix = Zotero.Utilities.randomString();
			({ httpd, port: testServerPort } = await startHTTPServer());
			testServerPath = 'http://127.0.0.1:' + testServerPort + '/' + prefix;
		});

		afterEach(async function () {
			var defer = new Zotero.Promise.defer();
			httpd.stop(() => defer.resolve());
			await defer.promise;
		});

		it("should save a document with embedded files", async function () {
			var item = await createDataObject('item');

			var uri = OS.Path.join(getTestDataDirectory().path, "snapshot");
			httpd.registerDirectory("/" + prefix + "/", new FileUtils.File(uri));
			
			browser = new HiddenBrowser();
			await browser.load(testServerPath + "/index.html");
			Zotero.FullText.indexNextInTest();
			var attachment = await Zotero.Attachments.importFromDocument({
				browser,
				parentItemID: item.id
			});
			
			assert.equal(attachment.getField('url'), testServerPath + "/index.html");
			
			// Check indexing
			var matches = await Zotero.Fulltext.findTextInItems([attachment.id], 'share your research');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
			
			var storageDir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var file = await attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(file), 'index.html');
			
			// Check attachment html file contents
			let path = OS.Path.join(storageDir, 'index.html');
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getContentsAsync(path);
			assert.include(contents, "><!--\n Page saved with SingleFile");
			
			// Check attachment base64 contents
			let expectedPath = getTestDataDirectory();
			expectedPath.append('snapshot');
			expectedPath.append('img.gif');
			let needle = await Zotero.File.getBinaryContentsAsync(expectedPath);
			needle = '<img src=data:image/gif;base64,' + btoa(needle) + '>';
			assert.include(contents, needle);
		});

		it("should save a document with embedded files restricted by CORS", async function () {
			var item = await createDataObject('item');

			var url = "file://" + OS.Path.join(getTestDataDirectory().path, "snapshot", "img.gif");
			httpd.registerPathHandler(
				'/' + prefix + '/index.html',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(`<html><head><title>Test</title></head><body><img src="${url}"/>`);
					}
				}
			);

			let browser = new HiddenBrowser();
			await browser.load(testServerPath + "/index.html");
			var attachment = await Zotero.Attachments.importFromDocument({
				browser,
				parentItemID: item.id
			});

			assert.equal(attachment.getField('url'), testServerPath + "/index.html");

			// Check for embedded files
			var storageDir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var file = await attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(file), 'index.html');

			// Check attachment html file contents
			let path = OS.Path.join(storageDir, 'index.html');
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getContentsAsync(path);
			assert.include(contents, "><!--\n Page saved with SingleFile");

			// Check attachment base64 contents
			let expectedPath = getTestDataDirectory();
			expectedPath.append('snapshot');
			expectedPath.append('img.gif');
			// This is broken because the browser will not load the image due to CORS and
			// then SingleFile detects that it is an empty image and replaces it without
			// trying to load the file. I don't really know of a good way around this for
			// the moment so I am leaving this assertion commented out, but without the
			// test is much less useful.
			// let needle = await Zotero.File.getBinaryContentsAsync(expectedPath);
			// needle = '<img src=data:image/gif;base64,' + btoa(needle) + '>';
			// assert.include(contents, needle);
		});

		it("should save a document with embedded files that throw errors", async function () {
			var item = await createDataObject('item');

			var url = "file://" + OS.Path.join(getTestDataDirectory().path, "snapshot", "foobar.gif");
			httpd.registerPathHandler(
				'/' + prefix + '/index.html',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(`<html><head><title>Test</title></head><body><img src="${url}"/>`);
					}
				}
			);

			let browser = new HiddenBrowser();
			await browser.load(testServerPath + "/index.html");
			var attachment = await Zotero.Attachments.importFromDocument({
				browser,
				parentItemID: item.id
			});

			assert.equal(attachment.getField('url'), testServerPath + "/index.html");

			// Check for embedded files
			var storageDir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var file = await attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(file), 'index.html');
			assert.isFalse(await OS.File.exists(OS.Path.join(storageDir, 'images', '1.gif')));

			// Check attachment html file contents
			let path = OS.Path.join(storageDir, 'index.html');
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getContentsAsync(path);
			assert.include(contents, "><!--\n Page saved with SingleFile");
		});

		it("should save a document but not save the iframe", async function () {
			let item = await createDataObject('item');

			let content = `<html><head><title>Test</title></head><body><iframe src="${testServerPath + "/iframe.html"}"/>`;
			httpd.registerPathHandler(
				'/' + prefix + '/index.html',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(content);
					}
				}
			);

			let url = "file://" + OS.Path.join(getTestDataDirectory().path, "snapshot", "img.gif");
			httpd.registerPathHandler(
				'/' + prefix + '/iframe.html',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(`<html><head><title>Test</title></head><body><img src="${url}"/>`);
					}
				}
			);

			let browser = new HiddenBrowser();
			await browser.load(testServerPath + "/index.html");
			let attachment = await Zotero.Attachments.importFromDocument({
				browser,
				parentItemID: item.id
			});

			assert.equal(attachment.getField('url'), testServerPath + "/index.html");

			// Check for embedded files
			var storageDir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var file = await attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(file), 'index.html');
			assert.isFalse(await OS.File.exists(OS.Path.join(storageDir, 'images', '1.gif')));

			// Check attachment html file contents
			let path = OS.Path.join(storageDir, 'index.html');
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getContentsAsync(path);
			assert.include(contents, "><!--\n Page saved with SingleFile");
			assert.notInclude(contents, "<img src=\"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==\">'></iframe>");
		});
	});
	
	describe("#importFromSnapshotContent()", function () {
		it("should save simple HTML content", async function () {
			let item = await createDataObject('item');
			
			let content = getTestDataDirectory();
			content.append('snapshot');
			content.append('index.html');
			
			let snapshotContent = await Zotero.File.getContentsAsync(content);
			
			Zotero.FullText.indexNextInTest();
			let attachment = await Zotero.Attachments.importFromSnapshotContent({
				parentItemID: item.id,
				url: "https://example.com/test.html",
				title: "Testing Title",
				snapshotContent
			});
			
			assert.equal(attachment.getField('url'), "https://example.com/test.html");
			
			// Check indexing
			let matches = await Zotero.Fulltext.findTextInItems([attachment.id], 'share your research');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
			
			// Check for embedded files
			let storageDir = Zotero.Attachments.getStorageDirectory(attachment).path;
			let file = await attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(file), 'test.html');
			
			// Check attachment html file contents
			let path = OS.Path.join(storageDir, 'test.html');
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getContentsAsync(path);
			let expectedContents = await Zotero.File.getContentsAsync(file);
			assert.equal(contents, expectedContents);
		});
	});
	
	describe("Find Available PDF", function () {
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
					
					// Redirect loop
					['http://website/redirect_loop1', 'http://website/redirect_loop2', false],
					['http://website/redirect_loop2', 'http://website/redirect_loop3', false],
					['http://website/redirect_loop3', 'http://website/redirect_loop1', false],
					
					// Too many total redirects
					['http://website/too_many_redirects1', 'http://website/too_many_redirects2', false],
					['http://website/too_many_redirects2', 'http://website/too_many_redirects3', false],
					['http://website/too_many_redirects3', 'http://website/too_many_redirects4', false],
					['http://website/too_many_redirects4', 'http://website/too_many_redirects5', false],
					['http://website/too_many_redirects5', 'http://website/too_many_redirects6', false],
					['http://website/too_many_redirects6', 'http://website/too_many_redirects7', false],
					['http://website/too_many_redirects7', 'http://website/too_many_redirects8', false],
					['http://website/too_many_redirects8', 'http://website/too_many_redirects9', false],
					['http://website/too_many_redirects9', 'http://website/too_many_redirects10', false],
					['http://website/too_many_redirects10', 'http://website/too_many_redirects11', false],
					['http://website/too_many_redirects11', pageURL1, true],
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
							'Content-Type': 'application/json'
						})
					};
				}
				return origFunc(...arguments);
			});
			
			pdfSize = await OS.File.stat(pdfPath).size;
			
			Zotero.Prefs.clear('findPDFs.resolvers');
		});
		
		beforeEach(async function () {
			({ httpd } = await startHTTPServer(port));
			httpd.registerFile(
				pdfURL.substr(baseURL.length - 1),
				Zotero.File.pathToFile(OS.Path.join(getTestDataDirectory().path, 'test.pdf'))
			);
			
			// Generate a page with a relative PDF URL
			httpd.registerPathHandler(
				"/" + doi4,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(`<html>
							<head>
								<title>Page Title</title>
							</head>
							<body>
								<a id="pdf-link" href="/article1/pdf">Download PDF</a>
							</body>
						</html>`);
					}
				}
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
			
			assert.equal(requestStub.callCount, 2);
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
			
			assert.equal(requestStub.callCount, 1);
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
			
			assert.equal(requestStub.callCount, 2);
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
			
			assert.equal(requestStub.callCount, 1);
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
			
			assert.equal(requestStub.callCount, 3);
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
		
		it("shouldn't try the URL-field URL again if it was already checked as the redirected DOI URL", async function () {
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
			
			assert.equal(requestStub.callCount, 2);
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
			assert.isAbove(requestStubCallTimes[5] - requestStubCallTimes[1], 995);
			
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
			
			assert.equal(requestStub.callCount, 3);
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
			
			assert.equal(requestStub.callCount, 2);
			assert.equal(requestStub.getCall(0).args[1], pageURL10)
			assert.equal(requestStub.getCall(1).args[1], pageURL1)
			assert.ok(attachment);
			var json = attachment.toJSON();
			assert.equal(json.url, pdfURL);
			assert.equal(json.contentType, 'application/pdf');
			assert.equal(json.filename, 'Test.pdf');
			assert.equal(await OS.File.stat(attachment.getFilePath()).size, pdfSize);
		});
		
		it("should stop after too many redirects to the same URL", async function () {
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('url', 'http://website/redirect_loop1');
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			assert.isFalse(attachment);
			assert.equal(requestStub.callCount, 7);
		});
		
		it("should stop after too many total redirects for a given page URL", async function () {
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('url', 'http://website/too_many_redirects1');
			await item.saveTx();
			var attachment = await Zotero.Attachments.addAvailablePDF(item);
			assert.isFalse(attachment);
			assert.equal(requestStub.callCount, 10);
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
		
		it("should handle a custom resolver with a relative PDF path in HTML mode", async function () {
			var doi = doi4;
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('title', 'Test');
			item.setField('DOI', doi);
			await item.saveTx();
			
			var resolvers = [{
				name: 'Custom',
				method: 'get',
				// Registered with httpd.js in beforeEach()
				url: baseURL + "{doi}",
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
			var call = requestStub.getCall(3);
			assert.isTrue(call.calledWith('GET', baseURL + doi4));
			
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
	
	describe("#getFileBaseNameFromItem()", function () {
		var item, itemManyAuthors, itemPatent, itemIncomplete, itemBookSection, itemSpaces, itemSuffixes, itemKeepDashes;

		before(() => {
			item = createUnsavedDataObject('item', { title: 'Lorem Ipsum', itemType: 'journalArticle' });
			item.setCreators([
				{ firstName: 'Foocius', lastName: 'Barius', creatorType: 'author' },
				{ firstName: 'Bazius', lastName: 'Pixelus', creatorType: 'author' }
			]);
			item.setField('date', "1975-10-15");
			item.setField('publicationTitle', 'Best Publications Place');
			item.setField('journalAbbreviation', 'BPP');
			item.setField('issue', '42');
			item.setField('pages', '321');

			
			itemManyAuthors = createUnsavedDataObject('item', { title: 'Has Many Authors', itemType: 'book' });
			itemManyAuthors.setCreators([
				{ firstName: 'First', lastName: 'Author', creatorType: 'author' },
				{ firstName: 'Second', lastName: 'Creator', creatorType: 'author' },
				{ firstName: 'Third', lastName: 'Person', creatorType: 'author' },
				{ firstName: 'Final', lastName: 'Writer', creatorType: 'author' },
				{ firstName: 'Some', lastName: 'Editor1', creatorType: 'editor' },
				{ firstName: 'Other', lastName: 'ProEditor2', creatorType: 'editor' },
				{ firstName: 'Last', lastName: 'SuperbEditor3', creatorType: 'editor' },
			]);
			itemManyAuthors.setField('date', "2000-01-02");
			itemManyAuthors.setField('publisher', 'Awesome House');
			itemManyAuthors.setField('volume', '3');

			itemPatent = createUnsavedDataObject('item', { title: 'Retroencabulator', itemType: 'patent' });
			itemPatent.setCreators([
				{ name: 'AcmeCorp', creatorType: 'inventor' },
				{ firstName: 'Wile', lastName: 'E', creatorType: 'contributor' },
				{ firstName: 'Road', lastName: 'R', creatorType: 'contributor' },
			]);
			itemPatent.setField('date', '1952-05-10');
			itemPatent.setField('number', 'HBK-8539b');
			itemPatent.setField('assignee', 'Fast FooBar');
			itemIncomplete = createUnsavedDataObject('item', { title: 'Incomplete', itemType: 'preprint' });
			itemBookSection = createUnsavedDataObject('item', { title: 'Book Section', itemType: 'bookSection' });
			itemBookSection.setField('bookTitle', 'Book Title');
			itemSpaces = createUnsavedDataObject('item', { title: ' Spaces! ', itemType: 'book' });
			itemSuffixes = createUnsavedDataObject('item', { title: '-Suffixes-', itemType: 'book' });
			itemSuffixes.setField('date', "1999-07-15");
			itemKeepDashes = createUnsavedDataObject('item', { title: 'keep--dashes', itemType: 'journalArticle' });
			itemKeepDashes.setField('publicationTitle', "keep");
			itemKeepDashes.setField('issue', 'dashes');
			itemKeepDashes.setField('date', "1999-07-15");
		});

		
		it('should strip HTML tags from title', function () {
			var htmlItem = createUnsavedDataObject('item', { title: 'Foo <i>Bar</i> Foo<br><br/><br />Bar' });
			var str = Zotero.Attachments.getFileBaseNameFromItem(htmlItem, '{{ title }}');
			assert.equal(str, 'Foo Bar Foo Bar');
		});

		it('should accept basic formating options', function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, 'FOO{{year}}BAR'),
				'FOO1975BAR'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{firstCreator suffix=" - "}}{{year suffix=" - "}}{{title truncate="50" }}'),
				'Barius and Pixelus - 1975 - Lorem Ipsum'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{year suffix="-"}}{{firstCreator truncate="10" suffix="-"}}{{title truncate="5" }}'),
				'1975-Barius and-Lorem'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, 'foo {{year}} bar {{year prefix="++" truncate="2" suffix="++"}}'),
				'foo 1975 bar ++19++'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{firstCreator suffix=" - "}}{{year suffix=" - "}}{{title}}'),
				'Author et al. - 2000 - Has Many Authors'
			);
		});

		it('should trim whitespaces from a value', function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemSpaces, '{{ title }}'),
				'Spaces!'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{title truncate="6"}}'),
				'Lorem'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{firstCreator truncate="7"}}'),
				'Barius'
			);
			// but preserve if it's configured as a prefix or suffix
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{title prefix=" " suffix=" "}}'),
				' Lorem Ipsum '
			);
		});

		it('should offer a range of options for composing creators', function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ authors max="1" }}'),
				'Barius'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ authors max="1" truncate="3" }}'),
				'Bar'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ authors max="5" join=" " }}'),
				'Barius Pixelus'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ authors max="3" join=" " }}'),
				'Author Creator Person'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemPatent, '{{ authors }}'),
				'AcmeCorp'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ authors max="2" name="family" initialize="family" join=" " initialize-with="" }}'),
				'A C'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemPatent, '{{ authors max="2" name="family" initialize="family" initialize-with="" }}'),
				'A'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ authors max="1" name="full" initialize="full" name-part-separator="" initialize-with="" }}'),
				'FB'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ authors max="3" name="full" initialize="full" name-part-separator="" join=" " initialize-with="" }}'),
				'FA SC TP'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ authors max="1" name="family-given" initialize="given" name-part-separator="" initialize-with="" }}'),
				'BariusF'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ authors max="2" name="family-given" initialize="given" join=" " name-part-separator="" initialize-with="" }}'),
				'AuthorF CreatorS'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ editors }}test'),
				'test'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ editors max="1" }}'),
				'Editor1'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ editors max="5" join=" " }}'),
				'Editor1 ProEditor2 SuperbEditor3'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ editors max="2" name="family" initialize="family" join=" " initialize-with="" }}'),
				'E P'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ editors max="1" name="full" initialize="full" name-part-separator="" initialize-with="" }}'),
				'SE'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ editors max="1" name="family-given" initialize="given" name-part-separator="" initialize-with="" }}'),
				'Editor1S'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ authors max="3" name="full" initialize="given" }}'),
				'F. Barius, B. Pixelus'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ creators case="upper" }}'),
				'BARIUS, PIXELUS'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ authors max="2" }}'),
				'Author, Creator'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ creators max="3" join=" " name="given" }}'),
				'First Second Third'
			);
		});

		it('should accept case parameter', async function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ publicationTitle case="upper" }}'),
				'BEST PUBLICATIONS PLACE'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ publicationTitle case="lower" }}'),
				'best publications place'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ publicationTitle case="title" }}'),
				'Best Publications Place'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ publicationTitle case="hyphen" }}'),
				'best-publications-place'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ publicationTitle case="camel" }}'),
				'bestPublicationsPlace'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ publicationTitle case="snake" }}'),
				'best_publications_place'
			);
		});

		it('should accept itemType or any other field', function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ itemType localize="true" }}'),
				'Journal Article'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ publicationTitle }}'),
				'Best Publications Place'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ journalAbbreviation }}'),
				'BPP'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ publisher }}'),
				'Awesome House'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, '{{ volume }}'),
				'3'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ issue }}'),
				'42'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ pages }}'),
				'321'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemPatent, '{{ number }}'),
				'HBK-8539b'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemPatent, '{{ assignee }}'),
				'Fast FooBar'
			);
		});

		it("should support simple logic in template syntax", function () {
			const template = '{{ if itemType == "journalArticle" }}j-{{ publicationTitle case="hyphen" }}{{ elseif itemType == "patent" }}p-{{ number case="hyphen" }}{{ else }}o-{{ title case="hyphen" }}{{ endif }}';
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, template), 'j-best-publications-place'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemPatent, template), 'p-hbk-8539b'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemManyAuthors, template), 'o-has-many-authors'
			);
		});

		it("should skip missing fields", function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemIncomplete, '{{ authors prefix = "a" suffix="-" }}{{ publicationTitle case="hyphen" suffix="-" }}{{ title }}'),
				'Incomplete'
			);
		});

		it("should recognized base-mapped fields", function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemBookSection, '{{ bookTitle case="snake" }}'),
				'book_title'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemBookSection, '{{ publicationTitle case="snake" }}'),
				'book_title'
			);
		});

		it("should trim spaces from template string", function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemBookSection, ' {{ bookTitle case="snake" }} '),
				'book_title'
			);
		});

		it("should suppress suffixes where they would create a repeat character", function () {
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(item, '{{ title suffix="-" }}{{ year prefix="-" }}'),
				'Lorem Ipsum-1975'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemSuffixes, '{{ title prefix="-" suffix="-" }}{{ year }}'),
				'-Suffixes-1999'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemSuffixes, '{{ title suffix="-" }}{{ year prefix="-" }}'),
				'-Suffixes-1999'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemKeepDashes, '{{ title suffix="-" }}{{ year prefix="-" }}'),
				'keep--dashes-1999'
			);
			// keep--dashes is a title and should be kept unchanged but "keep" and "dashes" are fields
			// separated by prefixes and suffixes where repeated characters should be suppressed
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemKeepDashes, '{{ title suffix="-" }}{{ publicationTitle suffix="-" }}{{ issue prefix="-" }}'),
				'keep--dashes-keep-dashes'
			);
			// keep--dashes is provided as literal part of the template and should be kept unchanged
			// but "keep" and "dashes" are fields separated by prefixes and suffixes where repeated
			// characters should be suppressed. Finally "keep--dashes" title is appended at the end
			// which should also be kept as is.
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemKeepDashes, 'keep--dashes-{{ publicationTitle prefix="-" suffix="-" }}{{ issue prefix="-" suffix="-" }}-keep--dashes-{{ publicationTitle suffix="-" }}test{{ title prefix="-" }}'),
				'keep--dashes-keep-dashes-keep--dashes-keep-test-keep--dashes'
			);
			assert.equal(
				Zotero.Attachments.getFileBaseNameFromItem(itemSuffixes, '{{ title prefix="/" suffix="\\" }}{{ year }}'),
				'-Suffixes-1999'
			);
		});

		it("should convert old attachmentRenameFormatString to use new attachmentRenameTemplate syntax", function () {
			assert.equal(
				Zotero.Prefs.convertLegacyAttachmentRenameFormatString('{%c - }{%y - }{%t{50}}'),
				'{{ firstCreator suffix=" - " }}{{ year suffix=" - " }}{{ title truncate="50" }}'
			);
			assert.equal(
				Zotero.Prefs.convertLegacyAttachmentRenameFormatString('{ - %y - }'),
				'{{ year prefix=" - " suffix=" - " }}'
			);
			assert.equal(
				Zotero.Prefs.convertLegacyAttachmentRenameFormatString('{%y{2}00}'),
				'{{ year truncate="2" suffix="00" }}'
			);
			assert.equal(
				Zotero.Prefs.convertLegacyAttachmentRenameFormatString('{%c5 - }'),
				'{{ firstCreator suffix="5 - " }}'
			);
			assert.equal(
				Zotero.Prefs.convertLegacyAttachmentRenameFormatString('{%c-2 - }'),
				'{{ firstCreator suffix="-2 - " }}'
			);
			assert.equal(
				Zotero.Prefs.convertLegacyAttachmentRenameFormatString('{%t5 - }'),
				'{{ title suffix="5 - " }}'
			);
			assert.equal(
				Zotero.Prefs.convertLegacyAttachmentRenameFormatString('{++%t{10}--}'),
				'{{ title truncate="10" prefix="++" suffix="--" }}'
			);
			assert.equal(
				Zotero.Prefs.convertLegacyAttachmentRenameFormatString('foo{%c}-{%t{10}}-{%y{2}00}'),
				'foo{{ firstCreator }}-{{ title truncate="10" }}-{{ year truncate="2" suffix="00" }}'
			);
		});

		it("should strip bidi isolates from firstCreator", async function () {
			var item = createUnsavedDataObject('item',
				{ creators: [{ name: 'Foo', creatorType: 'author' }, { name: 'Bar', creatorType: 'author' }] });
			var str = Zotero.Attachments.getFileBaseNameFromItem(item);
			assert.equal(str, Zotero.getString('general.andJoiner', ['Foo', 'Bar']) + ' - ');
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
			assert.equal(newAttachment.note, 'Note');
			assert.sameDeepMembers(newAttachment.getTags(), [{ tag: 'Tag' }]);
			assert.sameMembers(newAttachment.relatedItems, [relatedItem.key]);
			assert.sameMembers(relatedItem.relatedItems, [newAttachment.key]);
			assert.isTrue(await OS.File.exists(Zotero.Fulltext.getItemCacheFile(newAttachment).path));
			assert.equal(
				await Zotero.Fulltext.getIndexedState(newAttachment),
				Zotero.Fulltext.INDEX_STATE_INDEXED
			);
		});
		
		
		it("should move annotations to stored file", async function () {
			var item = await createDataObject('item');
			var relatedItem = await createDataObject('item');
			
			var originalFile = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
			var attachment = await Zotero.Attachments.linkFromFile({
				file: originalFile,
				title: 'Title',
				parentItemID: item.id
			});
			var annotation1 = await createAnnotation('highlight', attachment);
			var annotation2 = await createAnnotation('note', attachment);
			
			var newAttachment = await Zotero.Attachments.convertLinkedFileToStoredFile(attachment);
			
			assert.isFalse(Zotero.Items.exists(attachment.id));
			assert.isTrue(Zotero.Items.exists(annotation1.id));
			assert.isTrue(Zotero.Items.exists(annotation2.id));
			
			var annotations = newAttachment.getAnnotations();
			assert.lengthOf(annotations, 2);
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
