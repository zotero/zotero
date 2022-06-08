addMessageListener('Scaffold:GetDocument', {
	receiveMessage() {
		dump('received document request\n')
		sendAsyncMessage('Scaffold:Document', {
			html: new XMLSerializer().serializeToString(content.document),
			url: content.location.href
		});
	}
});

function onLoad() {
	sendAsyncMessage('Scaffold:Load', { url: content.location.href });
}

addEventListener('load', onLoad, true);
