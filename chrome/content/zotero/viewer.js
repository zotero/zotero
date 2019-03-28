Components.utils.import('resource://gre/modules/Services.jsm');

function handleDragOver(event) {
	if (event.dataTransfer.getData('zotero/item')) {
		event.preventDefault();
		event.stopPropagation();
	}
}

function handleDrop(event) {
	let data;
	if (!(data = event.dataTransfer.getData('zotero/item'))) {
		return;
	}

	let ids = data.split(',').map(id => parseInt(id));
	let item = Zotero.Items.get(ids[0]);
	if (!item) {
		return;
	}

	if (item.isNote()) {
		event.preventDefault();
		event.stopPropagation();

		let cover = document.getElementById('zotero-viewer-sidebar-cover');
		let container = document.getElementById('zotero-viewer-sidebar-container');

		cover.hidden = true;
		container.hidden = false;

		let editor = document.getElementById('zotero-viewer-editor');
		let notebox = document.getElementById('zotero-viewer-note-sidebar');
		editor.mode = 'edit';
		notebox.hidden = false;
		editor.item = item;
	}
	else if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
		event.preventDefault();
		event.stopPropagation();
		let iframeWindow = document.getElementById('viewer').contentWindow;
		let url = 'zotero://pdf.js/viewer.html?libraryID=' + item.libraryID + '&key=' + item.key;
		if (url !== iframeWindow.location.href) {
			iframeWindow.location = url;
		}
	}
	else if (item.isRegularItem()) {
		let attachments = item.getAttachments();
		if (attachments.length === 1) {
			let id = attachments[0];
			let attachment = Zotero.Items.get(id);
			if (attachment.attachmentContentType === 'application/pdf') {
				event.preventDefault();
				event.stopPropagation();
				let iframeWindow = document.getElementById('viewer').contentWindow;
				let url = 'zotero://pdf.js/viewer.html?libraryID=' + attachment.libraryID + '&key=' + attachment.key;
				if (url !== iframeWindow.location.href) {
					iframeWindow.location = url;
				}
			}
		}
	}
}

window.addEventListener('dragover', handleDragOver, true);
window.addEventListener('drop', handleDrop, true);
