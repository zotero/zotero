describe("Debug Output Logging", function () {
	var server;
	var win;
	var doc;

	before(async function () {
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		
		win = await loadZoteroPane();
		doc = win.document;
	});

	after(function () {
		Zotero.HTTP.mock = null;
		win.close();
	});

	it("should log output and submit to server", async function () {
		doc.getElementById('debug-output-enable-disable').doCommand();
		await createDataObject('item');
		doc.getElementById('debug-output-submit').doCommand();

		server.respond(function (req) {
			if (req.method == "POST") {
				req.respond(
					200,
					{},
					'<?xml version="1.0" encoding="UTF-8"?>\n'
					+ '<xml><reported reportID="1234567890"/></xml>'
				);
			}
		});

		// Make sure Debug ID is shown in dialog
		var promise = waitForDialog(function (dialog) {
			assert.match(dialog.document.documentElement.textContent, /D1234567890/);
		});
		doc.getElementById('debug-output-submit').click();
		await promise;

		win.close();
	});
});
