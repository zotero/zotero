/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2023 Corporation for Digital Scholarship
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

describe("Zotero.BrowserDownload", function () {
	describe("#downloadPDF()", function () {
		var http, port, baseURL;
		var tmpFile = Zotero.getTempDirectory();
		tmpFile.append('browserDownloadTest.pdf');
		
		before(async function () {
			({ httpd, port } = await startHTTPServer());
			baseURL = `http://localhost:${port}/`;
		});
		
		after(async function () {
			await new Promise(resolve => httpd.stop(resolve));
		});
		
		it("#downloadPDF() should download a PDF from a JS redirect page", async function () {
			var dir = getTestDataDirectory().path;
			httpd.registerFile(
				'/test-pdf-redirect.html',
				Zotero.File.pathToFile(PathUtils.join(dir, 'test-pdf-redirect.html'))
			);
			httpd.registerFile(
				'/test.pdf',
				Zotero.File.pathToFile(PathUtils.join(dir, 'test.pdf'))
			);
			
			await Zotero.BrowserDownload.downloadPDF(`${baseURL}test-pdf-redirect.html`, tmpFile.path);
			
			var sample = await Zotero.File.getContentsAsync(tmpFile, null, 1000);
			assert.equal(Zotero.MIME.sniffForMIMEType(sample), 'application/pdf');
		});
		
		// Needs a js-redirect delay in test-pdf-redirect.html
		it.skip("should display a viewer to clear a captcha if detected", async function () {
			// Make it so that downloadPDF() times out with a hidden browser, which simulates running into a captcha
			Zotero.Prefs.set('downloadPDFViaBrowser.downloadTimeout', 10);
			let downloadPDFStub = sinon.stub(Zotero.BrowserDownload, "downloadPDFViaViewer");
			
			let promise = Zotero.BrowserDownload.downloadPDF('https://zotero-static.s3.amazonaws.com/test-pdf-redirect.html', tmpFile.path,
				{ cookieSandbox: new Zotero.CookieSandbox(), shouldDisplayCaptcha: true });
			await new Promise(resolve => downloadPDFStub.callsFake((...args) => {
				resolve();
				Zotero.Prefs.set('downloadPDFViaBrowser.downloadTimeout', 60e3);
				return downloadPDFStub.wrappedMethod.call(Zotero.BrowserDownload, ...args);
			}));
			
			await promise;

			assert.isTrue(downloadPDFStub.calledOnce);
			downloadPDFStub.restore();
		});
	});
});
