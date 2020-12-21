/**

how to make a tinymce plugin : 
https://www.tinymce.com/docs/advanced/creating-a-plugin/
tinymce command :
https://www.tinymce.com/docs/advanced/editor-command-identifiers/
**/


tinymce.PluginManager.add('katex_for_zotero', function (editor, url) {



	//***** load css 
	editor.on('init', function () {
		editor.dom.loadCSS(url + '/plugin.css');
	});

	// add style for katex not rendered
	editor.addCommand('katex_box', function () {
		var content = tinymce.activeEditor.selection.getContent();
		if (content) {
			tinyMCE.activeEditor.selection.setContent('<span class="katexCode">' + content + '</span>');
			// add a class on the p not the selection
			// var node = tinymce.activeEditor.selection.getNode();
			// tinyMCE.activeEditor.dom.addClass(node, 'tinymcekatex');
		} else {
			tinymce.activeEditor.selection.setContent('<span class="katexCode"></span>');
		}
	}); // 

	//parse the note content to display the katex formula
	editor.addCommand('katex_load', function () {
		katexrenderToString()
	}); // 




	//*** add shorcut 
	// for js key cf cf http://keycode.info/   32 = space  // 110 = point from numpad
	// "meta" = Ctrl on PC
	editor.addShortcut('alt+k', 'katex_box_desc', 'katex_box');
	editor.addShortcut('F5', 'katex_load_desc', 'katex_load');


}); // end   tinymce.PluginManager.add




function katexrenderToString() {
	removeKatexspan()
	parseTinymcekatexAndCreateKatex()
}


function removeKatexspan() {
	var myNode = tinymce.activeEditor.contentDocument.body.getElementsByClassName("katexRenderer")
	try {
		while (myNode[0]) {
			myNode[0].parentNode.removeChild(myNode[0]);
		}
	} catch (error) {

	}
}

function parseTinymcekatexAndCreateKatex() {
	var myNode = tinymce.activeEditor.contentDocument.body.getElementsByClassName("katexCode")

	var opts = {
		throwOnError: false,
		output: "mathml",
		displayMode: true
	};
	// var myNode = document.getElementsByClassName("katexCode");
	// alert(myNode.length)
	try {
		for (var i = 0; i < myNode.length; i++) {


			let katexNode = document.createElement("span");
			katexNode.className = "katexRenderer";
			// katexNode.style.display = "block";

			var renderedsting = katex.renderToString(myNode[i].innerHTML, opts)
			// alert(renderedsting)
			katexNode.innerHTML = renderedsting
			// alert(katexNode.innerHTML)


			// katexNode.innerHTML = katex.renderToString(myNode[i].innerHTML, opts)

			// add a <br> after the katex formula
			let brNode = document.createElement("br")
			katexNode.append(brNode)


			// Get a reference to the parent node
			let parentDiv = myNode[i].parentNode

			// for case like 
			// parentDiv.insertBefore(katexNode, myNode[i]);

			// for case like <p>this is a square root function: <span class="katexRenderer">f(x)=\sqrt[2]{x}</span>  and it's a fun function<p>
			parentDiv.append(katexNode);
		}

	} catch (error) {

	}

}
