/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
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

describe("Zotero.BrowserRequest", function () {
	describe("#downloadPDF()", function () {
		var httpd, port, baseURL;
		var tmpFile = Zotero.getTempDirectory();
		tmpFile.append('browserRequestTest.pdf');

		before(async function () {
			({ httpd, port } = await startHTTPServer());
			baseURL = `http://localhost:${port}/`;
		});

		after(async function () {
			await new Promise(resolve => httpd.stop(resolve));
		});

		it("should download a PDF from a JS redirect page", async function () {
			var dir = getTestDataDirectory().path;
			httpd.registerFile(
				'/test-pdf-redirect.html',
				Zotero.File.pathToFile(PathUtils.join(dir, 'test-pdf-redirect.html'))
			);
			httpd.registerFile(
				'/test.pdf',
				Zotero.File.pathToFile(PathUtils.join(dir, 'test.pdf'))
			);

			await Zotero.BrowserRequest.downloadPDF(`${baseURL}test-pdf-redirect.html`, tmpFile.path);

			var sample = await Zotero.File.getContentsAsync(tmpFile, null, 1000);
			assert.equal(Zotero.MIME.sniffForMIMEType(sample), 'application/pdf');
		});

		// Needs a js-redirect delay in test-pdf-redirect.html
		it.skip("should display a viewer to clear a captcha if detected", async function () {
			// Force downloadPDF() to time out with a hidden browser, which simulates running into a captcha
			Zotero.Prefs.set('browserRequest.timeout', 10);
			let downloadPDFStub = sinon.stub(Zotero.BrowserRequest, "downloadPDFViaViewer");

			let promise = Zotero.BrowserRequest.downloadPDF('https://zotero-static.s3.amazonaws.com/test-pdf-redirect.html', tmpFile.path,
				{ shouldDisplayCaptcha: true });
			await new Promise(resolve => downloadPDFStub.callsFake((...args) => {
				resolve();
				Zotero.Prefs.set('browserRequest.timeout', 60e3);
				return downloadPDFStub.wrappedMethod.call(Zotero.BrowserRequest, ...args);
			}));

			await promise;

			assert.isTrue(downloadPDFStub.calledOnce);
			downloadPDFStub.restore();
		});
	});

	describe("#getEntryForURL()", function () {
		it("returns null for unrecognized URLs", function () {
			assert.isNull(Zotero.BrowserRequest.getEntryForURL('https://example.com/foo'));
		});

		it("matches registered substrings", function () {
			let entry = Zotero.BrowserRequest.getEntryForURL(
				'https://search.worldcat.org/api/search?q=bn%3A123'
			);
			assert.isNotNull(entry);
			assert.equal(entry.match, '://search.worldcat.org');
		});

		it("sniffs response bodies via detectBlock", function () {
			let entry = Zotero.BrowserRequest.getEntryForURL(
				'https://search.worldcat.org/api/search?q=bn%3A123'
			);
			assert.isFunction(entry.detectBlock);
			assert.isTrue(entry.detectBlock(403, '{"turnstile_required":true}'));
			assert.isFalse(entry.detectBlock(403, 'some other 403 body'));
			assert.isFalse(entry.detectBlock(200, '{"turnstile_required":true}'));
		});
	});

	describe("#_pollForCookie()", function () {
		it("ignores a stale cookie present at poll start", async function () {
			// Simulate a leftover cookie from a previous session whose HMAC
			// is no longer valid: _pollForCookie must wait for the value to
			// change, not declare success on first read.
			let readStub = sinon.stub(Zotero.BrowserRequest, "_readCookieValue");
			readStub.returns("stale-value");

			let onFound = sinon.spy();
			let handle = Zotero.BrowserRequest._pollForCookie({
				successCookie: { host: 'example.com', name: 'c' },
				onFound,
				intervalMs: 10
			});

			try {
				await Zotero.Promise.delay(40);
				assert.isFalse(onFound.called, "should not fire while value is unchanged");

				readStub.returns("fresh-value");
				await Zotero.Promise.delay(40);
				assert.isTrue(onFound.called, "should fire once a new value appears");
			}
			finally {
				clearInterval(handle);
				readStub.restore();
			}
		});

		it("fires when the cookie first appears from nothing", async function () {
			let readStub = sinon.stub(Zotero.BrowserRequest, "_readCookieValue");
			readStub.returns(null);

			let onFound = sinon.spy();
			let handle = Zotero.BrowserRequest._pollForCookie({
				successCookie: { host: 'example.com', name: 'c' },
				onFound,
				intervalMs: 10
			});

			try {
				await Zotero.Promise.delay(40);
				assert.isFalse(onFound.called);

				readStub.returns("new-value");
				await Zotero.Promise.delay(40);
				assert.isTrue(onFound.called);
			}
			finally {
				clearInterval(handle);
				readStub.restore();
			}
		});
	});

	describe("translator request retry", function () {
		function makeUtils() {
			let fakeTranslate = {
				resolveURL: url => url,
				requestHeaders: {},
				cookieSandbox: undefined
			};
			return new Zotero.Utilities.Translate(fakeTranslate);
		}

		it("retries via clearChallenge when the initial request throws a registered 403", async function () {
			let url = 'https://search.worldcat.org/api/search?q=bn%3A978-0-585-03015-9';
			let clearStub = sinon.stub(Zotero.BrowserRequest, "clearChallenge").resolves();
			let call = 0;
			let requestStub = sinon.stub(Zotero.HTTP, "request").callsFake(() => {
				call++;
				if (call === 1) {
					let xhr = {
						status: 403,
						response: '{"turnstile_required":true}',
						responseText: '{"turnstile_required":true}',
						channel: null
					};
					throw new Zotero.HTTP.UnexpectedStatusException(xhr, url, "Forbidden");
				}
				return {
					status: 200,
					response: { ok: true },
					responseText: '{"ok":true}',
					getAllResponseHeaders: () => ''
				};
			});

			try {
				let utils = makeUtils();
				let result = await utils.request(url);
				assert.equal(result.status, 200);
				assert.deepEqual(result.body, { ok: true });
				assert.equal(requestStub.callCount, 2);
				assert.isTrue(clearStub.calledOnce);
				assert.equal(clearStub.firstCall.args[0], 'https://search.worldcat.org/search?q=bn%3A978-0-585-03015-9');
			}
			finally {
				requestStub.restore();
				clearStub.restore();
			}
		});

		it("retries when the 403's XHR is in responseType=json mode (responseText throws)", async function () {
			let url = 'https://search.worldcat.org/api/search?q=bn%3A978-0-585-03015-9';
			let clearStub = sinon.stub(Zotero.BrowserRequest, "clearChallenge").resolves();
			let call = 0;
			let requestStub = sinon.stub(Zotero.HTTP, "request").callsFake(() => {
				call++;
				if (call === 1) {
					let xhr = {
						status: 403,
						response: { turnstile_required: true },
						get responseText() { throw new Error('responseText unavailable'); },
						channel: null
					};
					throw new Zotero.HTTP.UnexpectedStatusException(xhr, url, "Forbidden");
				}
				return {
					status: 200,
					response: { ok: true },
					responseText: '{"ok":true}',
					getAllResponseHeaders: () => ''
				};
			});

			try {
				let utils = makeUtils();
				let result = await utils.request(url, { responseType: 'json' });
				assert.equal(result.status, 200);
				assert.deepEqual(result.body, { ok: true });
				assert.equal(requestStub.callCount, 2);
				assert.isTrue(clearStub.calledOnce);
			}
			finally {
				requestStub.restore();
				clearStub.restore();
			}
		});

		it("does not retry when the URL is not registered", async function () {
			let url = 'https://example.com/api/search';
			let clearStub = sinon.stub(Zotero.BrowserRequest, "clearChallenge").resolves();
			let requestStub = sinon.stub(Zotero.HTTP, "request").callsFake(() => {
				let xhr = { status: 403, response: '', responseText: '', channel: null };
				throw new Zotero.HTTP.UnexpectedStatusException(xhr, url, "Forbidden");
			});

			try {
				let utils = makeUtils();
				let err;
				try { await utils.request(url); }
				catch (e) { err = e; }
				assert.instanceOf(err, Zotero.HTTP.UnexpectedStatusException);
				assert.equal(requestStub.callCount, 1);
				assert.isTrue(clearStub.notCalled);
			}
			finally {
				requestStub.restore();
				clearStub.restore();
			}
		});

		it("does not retry in browser on a 200 body that matches detectBlock (status must also match)", async function () {
			let url = 'https://search.worldcat.org/api/search?q=bn%3A1';
			let clearStub = sinon.stub(Zotero.BrowserRequest, "clearChallenge").resolves();
			let requestStub = sinon.stub(Zotero.HTTP, "request").returns({
				status: 200,
				response: '{"turnstile_required":true}',
				responseText: '{"turnstile_required":true}',
				getAllResponseHeaders: () => ''
			});

			try {
				let utils = makeUtils();
				// WorldCat's detectBlock requires status === 403; a 200 with the same
				// body should not trigger a retry.
				await utils.request(url, { responseType: 'text' });
				assert.equal(requestStub.callCount, 1);
				assert.isTrue(clearStub.notCalled);
			}
			finally {
				requestStub.restore();
				clearStub.restore();
			}
		});
	});
});
