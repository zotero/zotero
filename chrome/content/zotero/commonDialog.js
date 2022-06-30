window.addEventListener('keypress', function (event) {
	if (event.key == 'Escape') {
		try {
			let elem = document.querySelector('button[dlgtype="cancel"]');
			if (!elem) {
				elem = document.getElementById('cancel-button');
			}
			elem.click();
		}
		catch (e) {
			window.close();
		}
	}
});