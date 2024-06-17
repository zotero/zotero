"use strict";

describe("Connector HTTP Integration Server", function () {
	var serverURL;
	
	before(function* () {
		this.timeout(20000);
		Zotero.Prefs.set("httpServer.enabled", true);
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		const serverPort = Zotero.Prefs.get('httpServer.port');
		serverURL = `http://127.0.0.1:${serverPort}/connector/document`;
	});
	
	describe('/connector/document/execCommand', function () {
		it('should set HTTPIntegrationClient.inProgress=true and respond with a plugin command', async function () {
			let stub = sinon.stub(Zotero.Integration, 'execCommand');
			try {
				stub.callsFake(() => {
					let app = new Zotero.HTTPIntegrationClient.Application();
					app.getActiveDocument();
				});
				assert.isNotTrue(Zotero.HTTPIntegrationClient.inProgress);
				
				let response = await Zotero.HTTP.request(
					'POST',
					`${serverURL}/execCommand`,
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							command: "addEditCitation",
							docId: "zoteroTestDoc",
						}),
					},
				);
				
				assert.isTrue(Zotero.HTTPIntegrationClient.inProgress);
				assert.equal(response.status, 200);
				assert.equal(JSON.parse(response.response).command, 'Application.getActiveDocument');
			}
			finally {
				stub.restore();
				Zotero.HTTPIntegrationClient.inProgress = false;
				Zotero.Integration.currentDoc = Zotero.Integration.currentSession = null;
			}
		});
	});
	
	describe('/connector/document/respond', function () {
		it('should pass along the request body via HTTPIntegrationClient', async function () {
			try {
				Zotero.HTTPIntegrationClient.deferredResponse = new Zotero.Promise.defer();

				let postBody = { outputFormat: 'html' };
				Zotero.HTTP.request(
					'POST',
					`${serverURL}/respond`,
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify(postBody),
					},
				);
				
				let receivedBody = await Zotero.HTTPIntegrationClient.deferredResponse.promise;
				
				assert.deepEqual(postBody, receivedBody);
			}
			finally {
				Zotero.HTTPIntegrationClient.inProgress = false;
				Zotero.Integration.currentDoc = Zotero.Integration.currentSession = null;
			}
		});
	});
});
