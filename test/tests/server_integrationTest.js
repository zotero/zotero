"use strict";

describe("MacOS Integration Server", function () {
	var serverURL;
	
	before(function* () {
		this.timeout(20000);
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		serverURL = `http://127.0.0.1:${Zotero.Server.port}/integration`;
	});
	
	describe('/integration/macWordCommand', function () {
		it('should call Integration.execCommand with passed parameters', async function () {
			let stub = sinon.stub(Zotero.Integration, 'execCommand');
			try {
				await Zotero.HTTP.request(
					'GET',
					`${serverURL}/macWordCommand?agent=httpTest&command=httpTestCommand&document=docName&templateVersion=-1`,
				);
				
				assert.isTrue(stub.calledOnce);
				assert.isTrue(stub.firstCall.calledWithExactly('httpTest', 'httpTestCommand', 'docName', '-1'));
			} finally {
				stub.restore();
			}
		});
	});
});
