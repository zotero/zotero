function init(window, document) {
	var io = window.arguments[0];
	var label = document.getElementById("mlz-extra-field-label");
	var textbox = document.getElementById("mlz-extra-field-content");
	label.value = io.label;
	textbox.value = io.value;
}

function saveContent(window,document) {
	var io = window.arguments[0];
	var label = document.getElementById("mlz-extra-field-content");
	var textbox = document.getElementById("mlz-extra-field-content");
	io.value = textbox.value;
}
