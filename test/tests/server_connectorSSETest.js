describe('Connector Server Server-Sent Events', function () {
	describe('/connector/sse', function () {
		var writeCallback = sinon.stub();
		
		before(function* () {
			yield loadZoteroPane();
		});
		
		it('should add a listener to listener list upon connection', function () {
			// A Zotero Connector might attach to this before the test runs
			// so we have to get the initial value here first;
			let numListeners = Zotero.Server.SSE.Connector._listeners.length;
			Zotero.Server.SSE.Endpoints['/connector/sse'](writeCallback);
			assert.equal(Zotero.Server.SSE.Connector._listeners.length, numListeners + 1);
		});
		
		it('should call the writeCallback on Zotero.Server.SSE.Connector.sendEvent()', function () {
			Zotero.Server.SSE.Connector.notify('test', 'testData');
			assert.equal(writeCallback.callCount, 1);
			assert.equal(writeCallback.lastCall.args[0], `data: ${JSON.stringify({
				data: 'testData', event: 'test'
			})}\n\n`);
		});
		
		it('should remove the listener when writeCallback throws an error', function () {
			writeCallback.throws(new Error('Client disconnected'));
			Zotero.Server.SSE.Connector.notify('test', 'testData');
			assert.equal(Zotero.Server.SSE.Connector._listeners.length, 0);
		});
	});
});
