/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is ScrapBook.
 *
 * The Initial Developer of the Original Code is Gomita.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bernhard Pollak <pollak@dbai.tuwien.ac.at> (WebPageDump Fork)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
// --------------------------------------------------------------------------------
// "WebPageDump" Firefox Extension        
// --------------------------------------------------------------------------------
// - File: "domsaver.js" -
// - Description:
//   Makes a (hopefully perfect) local copy of the actual open webpage.   
//   Current Browsers make sometimes errors when saving a webpage. The files
//   will be saved in one flat directory (without subdirs)
// - Using:
//   1. call "wpdDOMSaver.init(filePath)" and pass the full destination path 
//   2. afterwards call "wpdDOMSaver.saveHTMLDocument" for saving the (active) window
// --------------------------------------------------------------------------------          
// Call Tree Overview - wpdDOMSaver
//
// saveHTMLDocument
//	saveDocumentEx          (decide if we have a HTML or another file)
//	  saveDocumentFile        (we have a non HTML file (e.g for embedded objects - images, movies,...))
//	    download								(we download the file and ...)
//      writefile               (... make a HTML wrapper file)
//	  saveDocumentHTML        (we have a HTML File)
//			processDOMRecursively   (go through the DOM nodes)
//			  processDOMNode          (for each node we do extensive processing (links, javascript,...))
//			    download                (for image,flash,... references)
//			    saveDocumentEx ...  	  (starting again with "saveDocumentEx" for frame documents)
//      saveDocumentCSS       (save CSS File)
//			  processCSSRecursively   (process the CSS text)
//			    processCSSText          (do some replacement stuff and link processing)
//			      download                (download CSS image references)       
//      generateHTMLString     (create the HTML string)
//      
//   
// --------------------------------------------------------------------------------    
// 

//
                         
// TO DO: use version information from rdf file...                         
var WPD_VERSION = "0.2";       


// Bug variables: set to false if the bug is not present anymore 
                       
// CRLFBUG: Innerhtml trims the text inside a tag. This lead
// to problems with the PRE Tag where sometimes one starting
// carriage return is lost...
var WPD_CRLFBUG = true;

// ENTITYBUG: HTML Entities are lost inside the DOM Tree (they 
// are converted to corresponding unicode characters) which  
// results in problems when using a non unicode charset as output 
// target where this values/symbols do not exist. So we call 
// the ConvertToEntities XPCOM function for generating usual
// HTML Entities...    
// (this is precisely not a bug but a concept failure)
var WPD_ENTITYBUG = true;   
                            
// CSSSCROLLBUG: The css "scroll" property of "background" is 
// loosing the zero vertical position leading to a false
// positioned background (centered by default)...
var WPD_CSSSCROLLBUG = true;
// CSSBACKGROUNDPOSITIONBUG: "background-position 0 0" is
// loosing the zero vertical position
var WPD_CSSBACKGROUNDPOSITIONBUG = true;
                                      
// DOCTYPEBUG: If the doctype is inserted before
// the <HTML> tag there would be rendering errors with the
// right to left writing direction, because there are problems 
// with the DIR attribute (text direction (rtl,ltr,lro,rlo))
// Positioning the doctype below the <HTML> Tag would fix the 
// problem. 
// But: inserting the docctype only below the <HTML> tag 
// results in small layout changes in some tables. So we 
// leave the doctype at the original position  before the 
// HTML tag <HTML> and insert the doctype entry  a second 
// time below the <HTML> tag...
var WPD_DOCTYPEBUG = true;              

// JAVASCRIPTSRCBUG: Deleting the "src" attribute together 
// with the whole <SCRIPT> tag may result in unexpected 
// layout changes (table width is changed). So we set the 
// "src" attribute of the <SCRIPT> tag to an empty string 
// and don�t delete the whole tag...
// Remark: it may be necessary to use an invalid ip address
// (e.g. http://0.0.0.0) but this may lead to other strange  
// layout dependencies... 
var WPD_JAVASCRIPTSRCBUG = true;       

// CLONENODEBUG: CloneNode copies only the initial state of 
// the INPUT fields and ignores the actual values of the fields
// We introduced this.curBody and the getCurrentNodeValue function.
var WPD_CLONENODEBUG = true;


var wpdDOMSaver = {     
	
	name 				    : "",
	document 		    : null, // the original document  
	curDocument     : null, // the current document    
	curCharacterSet : "",   // the current characterset
	curBody         : null, // the current body node (inclusive child nodes)
	currentDir      : "",
	baseURL         : "",   // the original base url
	currentURL      : "",   // the current url (necessary for frames)       
	fileInfo        : [],   // for saving already processed files and double name checking 
	                    // (cause we use one flat directory for all files)
	option          : {},   
	frameList       : [],
	frameNumber     : 0,     
	dateObj         : null,
	
	// initialize the properties (set document, URL, Directory, ...)
  init : function(fileName, document)
	{                           
		dump("[wpdDOMSaver.init] ...\n");    
		                     
		this.name = "";                     
		this.document = null;          
		this.curDocument = null;      
		this.curCharacterSet = "";
		this.curBody = null;
		this.currentDir = "";
		this.baseURL = "";
		this.currentURL="";
		this.fileInfo = [];                             // clear registered downloaded files...
		
		this.option = {};
		this.frameList = [];                            // clear frame list
		this.frameNumber = 0;          		
		
		this.dateObj = new Date();     
		
		
		// Split fileName in Path and Name      

		this.name = wpdCommon.getFileLeafName(fileName); // extract fileName from filePath       
		this.currentDir=wpdCommon.getFilePath(fileName); // only directory          
		this.name=wpdCommon.splitFileName(this.name)[0]; // no extension!
		
		
		// Added by Dan S. for Zotero, replacing three lines below
		this.document = document;
		this.setFrameList(document.defaultView);
		this.baseURL = document.location.href;
		
		
		// Set the document and frames                                          
		//this.document = top.window._content.document;
		
		//this.setFrameList(top.window._content);      
		                              
		// set the urls                                     
		//this.baseURL = wpdCommon.getURL();               // initial base url
		this.currentURL = this.baseURL;                 // current base url - needed for frame processing
																									  //   (without frames this property will always be like the baseURL)																									  	  
		
		// default options - for the files which should be downloaded 
		// (this is only for external link references not for the embedded files)
		this.option = { 
			"image"   		: false,    
			"sound"   		: false, 
			"movie"   		: false, 
			"archive" 		: false, 
			"custom"  		: "",       // comma delimited custom extensions (e.g. doc,xls,...)
			"format"  		: true,     // when false we get only naked html without images
			
			// Changed by Dan for Zotero
			"script"  		: true,    // no scripts
			
			"encodeUTF8"	: false,    // write the DOM Tree as UTF-8 and change the charset entry of the document
			"metainfo"	  : true,     // include meta tags with URL and date/time information
			"metacharset" : false     // if the meta charset is defined inside html override document charset
			//"xtagging"    : true      // include a x tag around each word
		};
		
				
	},                                           

	                               
	// get all frames in the document (recursively) and save in this.frameList
	setFrameList : function(aDocument)
	{        
		try {
		  for ( var f=0; f<aDocument.frames.length; f++ )
		  {
  			this.frameList.push(aDocument.frames[f]);
			  this.setFrameList(aDocument.frames[f]);
		  }
		} catch(ex) {}
	},
	
	// resolve the javascript links inside the attributes (e.g. onclick,...)
	normalizeJavaScriptLink : function(aNode, aAttr)
	{
		var val = aNode.getAttribute(aAttr);  // get the attribute value and check for link stuff
		if ( !val.match(/\(\'([^\']+)\'/) ) return aNode;
		val = RegExp.$1;
		if ( val.indexOf("/") == -1 && val.indexOf(".") == -1 ) return aNode;
		val = wpdCommon.resolveURL(this.currentURL, val); // it is a link -> resolve and set the URL to the local URL
		if ( aNode.nodeName.toLowerCase() == "img" ) {
			if ( aNode.parentNode.nodeName.toLowerCase() == "a" ) {
				aNode.parentNode.setAttribute("href", val);   // change the href of img to the onclick url
				aNode.removeAttribute("onclick");
			} else {
				val = "window.open('" + val + "');";  // if this is not a reference make a window open function for the img
				aNode.setAttribute(aAttr, val);
			}
		}	else {  
			if ( aNode.hasAttribute("href") && aNode.getAttribute("href").indexOf("http://") != 0 )	{
				aNode.setAttribute("href", val);
				aNode.removeAttribute("onclick");
			}
		}
		return aNode;
	},    
	      
	// check if the file extension of the url is specified in the options array
	checkFileTypeOptions : function (aURL)  
	{                                           
	  var ext = wpdCommon.splitFileName(wpdCommon.getFileName(aURL))[1].toLowerCase();
		var flag = false;
		switch ( ext )
		{
		  case "jpg" : case "jpeg" : case "png" : case "gif" : flag = this.option["image"];   break;
			case "mp3" : case "wav"  : case "ram" : case "wma" : flag = this.option["sound"];   break;
			case "mpg" : case "mpeg" : case "avi" : 
			case "ram" : case "rm"   : case "mov" : case "wmv" : flag = this.option["movie"];   break;
			case "zip" : case "lzh"  : case "rar" :	case "xpi" : flag = this.option["archive"]; break;
			default :
				if ( ext && this.option["custom"] ) {
					if ( (", " + this.option["custom"] + ", ").indexOf(", " + ext + ", ") != -1 ) flag = true;
				}
	  }
		if ( aURL.indexOf("file://") == 0 && !aURL.match(/\.html$/) ) flag = true;
		return flag;
  },                          
   
                    
  // do the conversion from the DOM Text to the destination Charset                  
  convertEntity : function(aText)
  {
    if (this.option["encodeUTF8"]) {
		  return wpdCommon.unicodeToEntity(aText,"UTF-8");       
		} else {                                                                                        
		  return wpdCommon.unicodeToEntity(aText,this.curCharacterSet);       
		}    
  },
  
  // we only can manage GIF animations - Flash does not work...
  disableAnimation : function(aNode)
  {                 
    // thanx to pageanimator extension...
   /* try {                  
      //dump("inspecting "+aNode.nodeName+"\n");
      //aNode.setAttribute("swLiveConnect", "true");      
      aNode.StopPlay();        
      dump ("prepare flash deanimation ... ");
      if ( aNode.hasAttribute("play") ) aNode.setAttribute("play", "false");                
      dump ("flash deanimation ... ");
      aNode.Rewind(); // seems to be the key for some obnoxious instances
      aNode.StopPlay();                   
      dump ("ready! \n");
    } catch (e) {}     */
    try {  
      var container = aNode.QueryInterface(Components.interfaces.nsIImageLoadingContent)
                  .getRequest(Components.interfaces.nsIImageLoadingContent.CURRENT_REQUEST)
                  .image;
      container.animationMode = Components.interfaces.imgIContainer.kDontAnimMode;
    } catch(e) {}
  },            

  // get the node value of aNode directly from the actual DOM tree (WPD_CLONENODEBUG)
  getCurrentNodeValue : function(aNode)
  {             
    try {      
      this.curDocument.body.cloneNode(false);
	    var body=this.curDocument.body;	    
	  } catch(ex) {         
	    var body=this.curDocument.getElementsByTagName("body")[0];
	  } 	  
    var refnodes=body.getElementsByTagName(aNode.nodeName);
    var nodes=this.curBody.getElementsByTagName(aNode.nodeName);      
    if (refnodes.length!=nodes.length) return aNode.value;
    for (var i=0; i<refnodes.length; i++) {               
      if ( ( nodes[i]==aNode ) &&
           ( refnodes[i].name==aNode.name ) &&
           ( refnodes[i].defaultValue==aNode.defaultValue ) ) {
             return refnodes[i].value;                      
           }
    }                                              
    return aNode.value;
  },
	                     
	// process the DOM Node (update the links, remove attributes and process the options)
	processDOMNode : function(aNode)
	{		                 	  
	  this.disableAnimation(aNode);        	  
		try {                            		    		  
			switch ( aNode.nodeName.toLowerCase() )
			{         			  
				case "img" : 
				case "embed" :      // "embed": embedding multimedia content
					if ( this.option["format"] ) {
						if ( aNode.hasAttribute("onclick") ) aNode = this.normalizeJavaScriptLink(aNode, "onclick");                  
						var aDownload=true;
						if (aNode.nodeName.toLowerCase()=="img") {
  						try { 
  						  aDownload=aNode.complete; 
  						} catch(ex) {}     
  					}
						var aFileName = this.download(aNode.src,aDownload);  						
						if (aFileName) aNode.setAttribute("src", aFileName);
					} else {
						return wpdCommon.removeNodeFromParent(aNode);
					}
					break;             
			  case "object" :     // for embedding different data sources in the html page
					if ( this.option["format"] ) {
						var aFileName = this.download(aNode.data,true);
						if (aFileName) aNode.setAttribute("data", aFileName);
					} else {
						return wpdCommon.removeNodeFromParent(aNode);
					}
					break;
				case "body" : 
					if ( this.option["format"] ) {
						var aFileName = this.download(aNode.background,true);
						if (aFileName) aNode.setAttribute("background", aFileName);
					} else {
						aNode.removeAttribute("background");
						aNode.removeAttribute("bgcolor");
						aNode.removeAttribute("text");
					}
					break;		  
			  case "table" : 
				case "tr" : 
				case "th" : 
				case "td" : 
					if ( this.option["format"] ) {
						var aFileName = this.download(aNode.getAttribute("background"),true);
						if (aFileName) aNode.setAttribute("background", aFileName);
					} else {
						aNode.removeAttribute("background");
						aNode.removeAttribute("bgcolor");
					}
					break;           
				case "input" :     				
					if ( aNode.type.toLowerCase() == "image" ) {
						if ( this.option["format"] ) {
							var aFileName = this.download(aNode.src,true);
							if (aFileName) aNode.setAttribute("src", aFileName);
						} else {
						  aNode.setAttribute("type", "button");
							aNode.removeAttribute("src");							
						}    
					} else if ((aNode.type.toLowerCase() != "hidden" ) && ( aNode.hasAttribute("value"))) {					  
					  if (WPD_CLONENODEBUG) aNode.setAttribute("value",this.getCurrentNodeValue(aNode));    
					  if (WPD_ENTITYBUG) aNode.setAttribute("value",this.convertEntity(aNode.getAttribute("value")));
				  }    
				  break;		                                                                                            
				case "link" :  // could containt urls (icon, stylesheet and fontdef)		  
					// We have to remove nodes with the stylesheet attribute because they will be added later
					if ((aNode.getAttribute("rel").toLowerCase() == "stylesheet") && (aNode.getAttribute("href").indexOf("chrome://") == -1)) {					  
						return wpdCommon.removeNodeFromParent(aNode);              
					} else if ( (aNode.getAttribute("rel").toLowerCase() == "shortcut icon") || (aNode.getAttribute("rel").toLowerCase() == "icon") ) {
						var aFileName = this.download(aNode.href,true);
						if (aFileName) aNode.setAttribute("href", aFileName);
					} else if (aNode.getAttribute("rel").toLowerCase() == "fontdef") {
					  var aFileName = this.download(aNode.src,true);
						if (aFileName) aNode.setAttribute("src", aFileName);
					} else {		
						aNode.setAttribute("href", aNode.href);
					}
					break; 			  
				case "style" : 
					return wpdCommon.removeNodeFromParent(aNode);
					break;    
			  case "applet":
			    if ( aNode.hasAttribute("code") ) aNode.setAttribute("code","");
			    if ( aNode.hasAttribute("codebase") ) aNode.setAttribute("codebase","");
			    if ( aNode.hasAttribute("archive") ) aNode.setAttribute("archive","");
			    break;
				case "script" : 				 
					if ( this.option["script"] ) {
						if ( aNode.hasAttribute("src") ) {
							var aFileName = this.download(aNode.src,true);
							if (aFileName) aNode.setAttribute("src", aFileName);
						}
					} else {            
					  if ( WPD_JAVASCRIPTSRCBUG && aNode.hasAttribute("src") ) {
					    //if ( aNode.getAttribute("src").indexOf("http://")!=-1 ) {
					    //  aNode.setAttribute("src", "http://0.0.0.0"); 
					    //} else {                          
					      aNode.setAttribute("src", "");
					    //}
					  } else {
						  return wpdCommon.removeNodeFromParent(aNode);
						}
					}                     
					break;		    
				case "noscript" :	  
				  if ( !WPD_JAVASCRIPTSRCBUG ) 
					  return wpdCommon.removeNodeFromParent(aNode);
				  break;  				
				case "a" : 
				case "area" : 
					if ( aNode.hasAttribute("onclick") ) aNode = this.normalizeJavaScriptLink(aNode, "onclick");
					if ( !aNode.hasAttribute("href") ) return aNode;
					if ( aNode.target == "_blank" ) aNode.setAttribute("target", "_top");
					if ( aNode.href.match(/^javascript:/i) ) aNode = this.normalizeJavaScriptLink(aNode, "href");
					if ( !this.selection && aNode.getAttribute("href").charAt(0) == "#" ) return aNode;
					// download file depending on option settings and file extension
					if ( this.checkFileTypeOptions(aNode.href) ) {
						var aFileName = this.download(aNode.href,true);
						if (aFileName) aNode.setAttribute("href", aFileName);
					} else {
						aNode.setAttribute("href", aNode.href);
					}
					break;
				case "form" : 
					aNode.setAttribute("action", wpdCommon.resolveURL(this.currentURL, aNode.action));
					break;
				case "meta" : 			
						if ( (aNode.hasAttribute("http-equiv") && aNode.hasAttribute("content")) &&
						     (aNode.getAttribute("http-equiv").toLowerCase() == "content-type") && 
						     (aNode.getAttribute("content").match(/charset\=/i)) )
						{ 
						  // we remove possible charset definitions because they will be added later    
					    return wpdCommon.removeNodeFromParent(aNode);				    
					  }       
					  if ( (aNode.hasAttribute("http-equiv") && aNode.hasAttribute("content")) &&
						     (aNode.getAttribute("http-equiv").toLowerCase() == "refresh") && 
						     (aNode.getAttribute("content").match(/URL\=/i)) )
						{                    
						  // there should be no refresh present - could be a noframe relict...
						  // (is already processed or timer is longer...)
						  return wpdCommon.removeNodeFromParent(aNode);				    
					  }
					break;     
				case "base"	:
				  //<BASE HREF="http://www.amin.org/look/amin/">  
				  // we need to set the base url to currenturl 
				  if ( aNode.hasAttribute("href") && (aNode.getAttribute("href")!="") ) 
				    this.currentURL=aNode.getAttribute("href");    
				  return wpdCommon.removeNodeFromParent(aNode);	  
				  break;
				case "frame"  : 
				case "iframe" :      // normal and embedded frames (iframe) -> call "saveDocumentEx" for saving the frame document
					try {            
						// we don't have to worry about the currentURL - saveDocumentEx will set the
						// currentURL to the URL of the frame document and afterwards back to the baseURL
						if (this.frameNumber<this.frameList.length) { 
						  var newFileName = this.saveDocumentEx(this.frameList[this.frameNumber++].document, this.name + "_" + this.frameNumber);
						  aNode.setAttribute("src", newFileName);
						}
					} catch(ex) {  
	          wpdCommon.addError("[wpdCommon.processDOMNode]:\n -> aNode.nodeName: "+aNode.nodeName+"\n -> "+ex); 
					}
					break;    					
				case "xmp" :                    
				  // TO DO
          var pre = aNode.ownerDocument.createElement("pre");
          pre.appendChild(aNode.firstChild);
          aNode.parentNode.replaceChild(pre, aNode);
          break;
			}
	    if ( !this.option["format"] ) {
				aNode.removeAttribute("style");
			} else if ( aNode.style && aNode.style.cssText ) {			      
				var newCSStext = this.processCSSText(aNode.style.cssText, this.currentURL, true);    		
				if ( newCSStext ) aNode.setAttribute("style", newCSStext);      
			}
			if ( !this.option["script"] ) {
				aNode.removeAttribute("onmouseover");
				aNode.removeAttribute("onmouseout");
				aNode.removeAttribute("onload");
			}       
		} catch(ex) {   
			wpdCommon.addError("[wpdDOMSaver.processDOMNode]:\n -> aNode.nodeName: "+aNode.nodeName+"\n -> "+ex); 
		}                 
		return aNode;
	},                    

                                                     
  // get through the DOM tree (recursiv function)                                                   
	processDOMRecursively : function(rootNode)
	{                	  
	  if (rootNode==null) return;   	   
		for ( var curNode = rootNode.firstChild; curNode != null; curNode = curNode.nextSibling )
		{      
			if ( curNode.nodeName != "#text" && curNode.nodeName != "#comment" ) {
	  	  curNode=this.processDOMNode(curNode);
	  	  this.processDOMRecursively(curNode);
		  } else if ((curNode.nodeName == "#text") && (wpdCommon.trim(curNode.nodeValue)!="")) {   
		    // we need to replace special chars with HTML Entities 
		    if (WPD_ENTITYBUG) curNode.nodeValue=this.convertEntity(curNode.nodeValue);    		      
		    // if we have CRLFs before or after the text "innerhtml" will remove them, 
		    // so we have to make sure that we preserve this CRLFs for the PRE Tag
        if (WPD_CRLFBUG) curNode.nodeValue=wpdCommon.checkCRLF(curNode);   
			}                            
		}
	}, 
	
	// Do a correction directly inside the final HTML text.
	// This is necessary because setting the css text for the 
	// style attribute does not work - innerHTML will finally 
	// generate e.g "repeat scroll 0%;" regardless of the style setting
	// (e.g. "repeat;")
	repairInlineCSS : function(aHTMLText)
	{
    if ( (WPD_CSSSCROLLBUG) && ( aHTMLText.match(/background:/i)) ) {         
			var re = new RegExp(/style=\"(.*)background:(.*)(repeat scroll 0(?:pt|px|%);)/);     
			while ( re.exec( aHTMLText ) ) { 
  		  var firstPart = RegExp.$1;
        var secondPart = RegExp.$2;
        var thirdPart = RegExp.$3.replace(/scroll 0(pt|px|%);/g, ';');  
        aHTMLText = aHTMLText.replace(re,"style=\""+firstPart+"background:"+secondPart+thirdPart);
	    }
		}	 
		if ( (WPD_CSSBACKGROUNDPOSITIONBUG) && ( aHTMLText.match(/background-position: /i)) ) {
		  var re = new RegExp(/style=\"(.*)background-position: 0(?:pt|px|%);/);     
			while ( re.exec( aHTMLText ) ) { 
        aHTMLText = aHTMLText.replace(re,"style=\""+RegExp.$1+"background-position: ;");
	    }	
		}	    
		return aHTMLText;
	},  
		         	                                          
  // process the CSS text of one stylesheet element	                                          
	processCSSText : function(aCSStext, aCSShref, inline)
	{
		if ( !aCSStext ) return "";                            
		
		// search for "url" entries inside the css
		var re = new RegExp(/ url\(([^\'\)]+)\)/);
		var i = 0;
		while ( aCSStext.match(re) ) {
			if ( ++i > 20 ) break;  // safer (we try it maximal 20 times for one stylesheet element)
			var imgFile = this.download(wpdCommon.resolveURL(aCSShref, RegExp.$1),true);			
			aCSStext = aCSStext.replace(re, " url('" + imgFile + "')");
		}		                       
    
    // search for "content" entries inside the css and clean "attr"
		re = new RegExp(/ content: \"(.*?)\"; /);
		if ( aCSStext.match(re) ) {
			var innerQuote = RegExp.$1;
			innerQuote = innerQuote.replace(/\"/g, '\\"');  
			innerQuote = innerQuote.replace(/\\\" attr\(([^\)]+)\) \\\"/g, '" attr($1) "');
			aCSStext = aCSStext.replace(re, ' content: "' + innerQuote + '"; ');
		}
		
		//           
    if ( (WPD_CSSSCROLLBUG) && ( aCSStext.match(/background: /i)) ) 
			  aCSStext = aCSStext.replace(/ scroll 0(pt|px|%);/g, ";");   
		if ( (WPD_CSSBACKGROUNDPOSITIONBUG) && ( aCSStext.match(/background-position: /i)) ) 
		  aCSStext = aCSStext.replace(/ background-position: 0(pt|px|%);/g, ";");   		
		return aCSStext;
	},             

  // process the CSS stylesheets (recursively)	 
  // CSS Types:
  // UNKNOWN_RULE = 0,
  // STYLE_RULE = 1,
  // CHARSET_RULE = 2,
  // IMPORT_RULE = 3,
  // MEDIA_RULE = 4,
  // FONT_FACE_RULE = 5,
  // PAGE_RULE = 6  
	processCSSRecursively : function(aCSS)
	{
		if (aCSS.disabled) return "";
		var content = "";
		var medium = aCSS.media.mediaText;
		if ( medium != "" && medium.indexOf("screen") < 0 && medium.indexOf("all") < 0 ) {
			return "";
		}
		if ( aCSS.href.indexOf("chrome") == 0 ) return "";
		var flag = "";
		for ( var i=0; i<aCSS.cssRules.length; i++ ) {
			if ( aCSS.cssRules[i].type == 1 || aCSS.cssRules[i].type == 4 ) {
				if (flag=="") { 
					content += "\n/* ::::: " + aCSS.href + " ::::: */\n\n";  // write original css filename 
					flag = aCSS.href; 
				}                             
				var ref=aCSS.href;
				if (flag.indexOf(".css")==-1) ref=this.currentURL;
				content += this.processCSSText(aCSS.cssRules[i].cssText, ref, false) + "\n";
			} else if ( aCSS.cssRules[i].type == 3 ) {
				content += this.processCSSRecursively(aCSS.cssRules[i].styleSheet);
			} 
		}
		return content;
	},   
			  	           	       
  // is the file registered (e.g. downloaded)?	       
	isFileRegistered : function(newFileName)
	{
		if ( this.fileInfo[newFileName] != undefined ) 
		  return true;
		return false;
	},
	  
	// check for equal Filenames with different locations
	// if this is the case, we generate a new name...
	checkForEqualFilenames : function(newFileName,aURLSpec)
	{  
	  if (this.isFileRegistered(newFileName)) {
	  	if (this.fileInfo[newFileName]["url"] != aURLSpec ) {
		    // the file is already registered but from a different location
		    // => probably not the same file, so we have to find a different name it (e.g. filename_001.ext)
		    var seq = 1;
				var fileLR = wpdCommon.splitFileName(newFileName);
				if ( !fileLR[1] ) fileLR[1] = "dat";
				while ( this.fileInfo[newFileName] != undefined )
				{                      
					// is the file already registered with the new name?
					if ( this.fileInfo[newFileName]["url"] == aURLSpec ) 
						return newFileName;  // Yes -> so it�s already downloaded and we are finished
					newFileName = fileLR[0] + "_" + wpdCommon.addLeftZeros(++seq,3) + "." + fileLR[1];  // No -> "increment" filename
				}                                                
			}       
		}
		return newFileName;  
	},
	        
	// Download the specified URL to "this.currentDir". Takes
	// care about equal filenames from different locations
	download : function(aURLSpec,aDownload)
	{
		if ( !aURLSpec ) return "";
      
    // is this a relative URL (no protocol present) which needs to be resolved?
		if ( aURLSpec.indexOf("://") < 0 )                                 			
			aURLSpec = wpdCommon.resolveURL(this.currentURL, aURLSpec);
			
		try {			                               
		  var aURL = wpdCommon.convertURLToObject(aURLSpec);		
		                                       
		  // generate a filename		
      var newFileName = aURL.fileName.toLowerCase();
		  if ( !newFileName ) newFileName = "untitled";
		  newFileName = wpdCommon.getValidFileName(newFileName);            
		  // same name but different location? 
		  newFileName = this.checkForEqualFilenames(newFileName,aURLSpec); 
		                     
		  // is the file already registered (processed) ?
		  if ( this.isFileRegistered(newFileName)==false ) {
		  	// No -> we have to download and register the file 
		  	this.fileInfo[newFileName] = new Array("url","downloaded");
		  	this.fileInfo[newFileName]["url"] = aURLSpec;                
		  	this.fileInfo[newFileName]["downloaded"] = true;
		  	if (aDownload) 
		  	  this.fileInfo[newFileName]["downloaded"] = wpdCommon.downloadFile(aURLSpec,this.currentDir+newFileName);  		  
		  }                                     		  		               
		  return newFileName;				  
		} catch(ex) {  
			wpdCommon.addError("[wpdDOMSaver.download]\n -> aURLSpec: " + aURLSpec+"\n -> "+ex);
			return "";
		}      
	},
	                       
	// Get a CSS filename node for inserting in the DOM Tree                       
	createCSSFileNode : function(aDocument,rootNode,aFileName)
	{
		var newLinkNode = aDocument.createElement("link");
		
		rootNode.firstChild.appendChild(aDocument.createTextNode("\n"));
		
		newLinkNode.setAttribute("media", "all");
		newLinkNode.setAttribute("href", aFileName + ".css");
		newLinkNode.setAttribute("type", "text/css");
		newLinkNode.setAttribute("rel", "stylesheet");        
		
		rootNode.firstChild.appendChild(newLinkNode);
		
		rootNode.firstChild.appendChild(aDocument.createTextNode("\n"));  
		//return newLinkNode;
	},            
	
	// Creates a placeholder node for inserting the DOCTYPE after the html tag		
	createPseudeDocTypeNode : function(aDocument,rootNode)
	{                                              
	  var aDoctype=aDocument.doctype;
		if ( !aDoctype ) return;        
		try {                   		  
  	  rootNode.insertBefore(aDocument.createTextNode("\n"), rootNode.firstChild);
  	   
  	  var metaNode = aDocument.createElement("wpd_doctype");           
  	  rootNode.insertBefore(metaNode, rootNode.firstChild);
  		
  		rootNode.insertBefore(aDocument.createTextNode("\n"), rootNode.firstChild);			        			
		} catch(ex) {   
			wpdCommon.addError("[wpdDOMSaver.createDocTypeNode]\n -> "+ex);
		}
	},   
	
	// replaces the placeholder node generated by createPseudeDocTypeNode with the DOCTYPE
	replaceDocType : function(aDocument,aHTMLText)
	{
	  var aDoctype=aDocument.doctype;  
	  if ( !aDoctype ) return aHTMLText;        
	  try {                   	
    	return aHTMLText.replace("<wpd_doctype></wpd_doctype>",this.getDocType(aDocument));
    } catch(ex) {   
			wpdCommon.addError("[wpdDOMSaver.replaceDocType]\n -> "+ex);
		}   
		return aHTMLText;
	},    
	                                                                 
	// Returns the HTML Text generated from rootNode and does
	// some processing (WPD_DOCTYPEBUG, WPD_ENTITYBUG, cleaning,...)
	generateHTMLString : function(aDocument,rootNode)
	{
	  if (WPD_DOCTYPEBUG) this.createPseudeDocTypeNode(aDocument,rootNode);
	  var HTMLText = wpdCommon.nodeToHTMLString(rootNode);                       		
    if (WPD_DOCTYPEBUG) HTMLText = this.replaceDocType(aDocument,HTMLText);  
    // adding the doctype entry at the top
    HTMLText = this.getDocType(aDocument)+HTMLText;
		HTMLText = HTMLText.replace(/\x00/g, " ");  
		// replace the &amp; added by the innerHTML method 
		// because we have already generated all entities
		if (WPD_ENTITYBUG) HTMLText = HTMLText.replace(/&amp;/g,"&");		
    return this.repairInlineCSS(HTMLText);
  },

	// Returns a DOCTYPE definition string based on aDocument.doctype
	getDocType : function(aDocument)
	{
	  var aDoctype=aDocument.doctype;  
	  if ( !aDoctype ) return "";
	  var dt = "<!DOCTYPE " + aDoctype.name;
  	if ( aDoctype.publicId ) dt += ' PUBLIC "' + aDoctype.publicId + '"';
  	if ( aDoctype.systemId ) dt += ' "'        + aDoctype.systemId + '"';
  	dt += ">\n";            	
  	return dt;
	},       

  // Get the meta charset information from the document     	
	getMetaCharset : function(aDocument)
	{
    var metas = aDocument.getElementsByTagName("meta");
		for (var i = metas.length; --i >= 0;) {
			var meta = metas[i];
			if (/content-type/i.test(meta.httpEquiv)) {
				r = /^text\/html; *charset=(.*)$/i.exec(meta.content);
				return r[1];
			}
		}
		return "";       	 
	},    
	                                                                 	 
	
	// Create and return a meta charset node for the DOM Tree                       
	createMetaCharsetNode : function(aDocument,rootNode,aContentType,aCharSet)
	{              
	  try {
  	  var metaNode = aDocument.createElement("meta");
  	  rootNode.firstChild.insertBefore(aDocument.createTextNode("\n"), rootNode.firstChild.firstChild);
  	  
  		metaNode.setAttribute("content", aContentType + "; charset="+aCharSet);
  		metaNode.setAttribute("http-equiv", "Content-Type");  
  		
  		rootNode.firstChild.insertBefore(metaNode, rootNode.firstChild.firstChild);
  
      rootNode.firstChild.insertBefore(aDocument.createTextNode("\n"), rootNode.firstChild.firstChild);		 
	  } catch(ex) {   
			wpdCommon.addError("[wpdDOMSaver.createMetaCharsetNode]\n -> "+ex);
		}
	},         
	
		// get a meta node for the DOM Tree                       
	createMetaNameNode : function(aDocument,rootNode,name,content)
	{  
	  try {            	  
  	  var metaNode = aDocument.createElement("meta");	  
  	  
  	  metaNode.setAttribute("content", content);
  		metaNode.setAttribute("name", name);
  		
  		rootNode.firstChild.insertBefore(aDocument.createTextNode("\n"), rootNode.firstChild.firstChild);	
  		rootNode.firstChild.insertBefore(metaNode, rootNode.firstChild.firstChild);
		} catch(ex) {   
			wpdCommon.addError("[wpdDOMSaver.createMetaNameNode]\n -> "+ex);
		}
	},   
	
	/*existMetaCharsetNode : function(aDocument);
	{
	  var metaNodes = aDocument.getElementsByTagName("meta");
	  for (var i=0; i<metaNodes.length; i++ ) {   
      if ( (metaNodes[i].hasAttribute("http-equiv") && metaNodes[i].hasAttribute("content")) &&
			     (metaNodes[i].getAttribute("http-equiv").toLowerCase() == "content-type") && 
				   (metaNodes[i].getAttribute("content").match(/charset\=/i)) )
						return true;
	  }                   
	  return false;
	}*/   
                            

	// Return the WPD Meta Base URL Information from aFile
	getMetaBaseURL : function(aFile)
	{	                                         
	  if (wpdCommon.pathExists(aFile)) {
  	  str = new String(wpdCommon.readFile(aFile,false,true));
  	  re = new RegExp(/<meta name=\"wpd_baseurl\" content=\"(.*?)\">/);
  		if ( str.match(re) ) {   
  			return RegExp.$1;
  		}        
  	}
		return "";
	},
	
  // Return the WPD Meta Date Information from aFile
	getMetaDate : function(aFile)
	{	                                 
	  if (wpdCommon.pathExists(aFile)) {
  	  str = new String(wpdCommon.readFile(aFile,false,true));
  	  re = new RegExp(/<meta name=\"wpd_date\" content=\"(.*?)\">/);
  		if ( str.match(re) ) {   
  			return RegExp.$1;
  		}        
  	}
		return "";
	},
	
	// creates the meta nodes for the wpd meta tags (version, baseurl, url, date/time)
	createMetaInformation : function(aDocument,rootNode)         
	{
		// insert url/date/time meta information      
		// 
		var d = this.dateObj.getUTCFullYear()+"-"+wpdCommon.addLeftZeros(this.dateObj.getUTCMonth(),2)+"-"+wpdCommon.addLeftZeros(this.dateObj.getUTCDate(),2);
		d = d+"T"+wpdCommon.addLeftZeros(this.dateObj.getUTCHours(),2)+":"+wpdCommon.addLeftZeros(this.dateObj.getUTCMinutes(),2)+"Z";		   
		this.createMetaNameNode(aDocument,rootNode,"wpd_date",d);		
		this.createMetaNameNode(aDocument,rootNode,"wpd_url",this.currentURL);
		this.createMetaNameNode(aDocument,rootNode,"wpd_baseurl",this.baseURL);	
		this.createMetaNameNode(aDocument,rootNode,"wpd_version",WPD_VERSION);
		rootNode.firstChild.insertBefore(aDocument.createTextNode("\n\n"), rootNode.firstChild.firstChild);
  },
    	
  // save a non HTML "aDocument" as "aFileName" and generate a
  // wrapper HTML File which references "aDocument"
  // ("aFileName" is the filename without(!) extension)
	saveDocumentFile : function(aDocument,aFileName)
	{
	  dump("[wpdDOMSaver.saveDocumentFile]: "+aFileName+"\n");
	  
	  	return this.download(this.currentURL,true)
		/* Wrapper file disabled by Dan S. for Zotero
		var aFileURL = aDocument.location.href;
	
		if ( !aFileName ) aFileName = "file" + Math.random().toString();
		// this.download will generate a unique filename
		var newFileName = this.download(this.currentURL,true);

		if ( aDocument.contentType.substring(0,5) == "image" ) {
			var HTMLText = '<html><body><img src="' + newFileName + '"></body></html>';
		} else {
			var HTMLText = '<html><head><meta http-equiv="refresh" content="0;URL=' + newFileName + '"></head><body></body></html>';
		}
 
		var HTMLFile = this.currentDir + aFileName + ".html";
		
		if (!wpdCommon.writeFile(HTMLText,HTMLFile)) 
		  wpdCommon.addError("[wpdDOMSaver.saveDocumentFile]: could not write HTML wrapper for "+aFileName+"\n");
	  	
		return aFileName + ".html";
		*/
	},

  // save the CSS Stylesheets of "aDocument" as "aFileName" and 
  // process the CSS Text     
  // "aFileName" is the filename without(!) extension 
  // (".css" will be added)
  saveDocumentCSS: function(aDocument,aFileName)
  {  
  	var CSSText = ""; //"body {display: block;margin: 8px;}; ";
		if ( this.option["format"] ) {
			var myStyleSheets = aDocument.styleSheets;
			// get all style sheets to "CSSText" 
			for ( var i=0; i<myStyleSheets.length; i++ )
				CSSText += this.processCSSRecursively(myStyleSheets[i]);
			if ( CSSText ) {                                        
			  // don't forget to convert the CSS String to the document charset..  
			  // (necessary for e.g. font-family)
    		if (this.option["encodeUTF8"]) {
    		  CSSText = wpdCommon.ConvertFromUnicode16(CSSText,"UTF-8");
    		} else { 
          CSSText = wpdCommon.ConvertFromUnicode16(CSSText,this.curCharacterSet);		  
    		}  
			  dump("[wpdDOMSaver.saveDocumentCSS]: "+this.currentDir+aFileName+".css\n");  
				// write css file
				var CSSFile = this.currentDir + aFileName + ".css";   		
		    if (!wpdCommon.writeFile(CSSText, CSSFile)) 
		      wpdCommon.addError("[wpdDOMSaver.saveDocumentCSS]: could not write CSS File\n");
		    return true;  
			}
		}               
		return false;
	},       	       
	                                                                                 
  // save the HTML "aDocument" as "aFileName" and process the 
  // DOM Tree (see processDOMNode) - calls also saveDocumentCSS
  // "aFileName" is the filename without(!) extension 
  // (".html" will be added)
	saveDocumentHTML: function(aDocument,aFileName)
	{   
	  dump("[wpdDOMSaver.saveDocumentHTML]: "+this.currentDir+aFileName+".html\n");                           				
	  this.curDocument = aDocument;         
	  this.curCharacterSet = aDocument.characterSet;     
	  var charset=this.curCharacterSet;                        	  	  
	  // we get the html node without childs and add the head and body trees
	  // manually so we are sure that we have a correct html file                  	  	  	 
		var rootNode = aDocument.getElementsByTagName("html")[0].cloneNode(false);          		

		try {
			var headNode = aDocument.getElementsByTagName("head")[0].cloneNode(true);     
			rootNode.appendChild(headNode);
			rootNode.appendChild(aDocument.createTextNode("\n"));
		} catch(ex) { }  		  
		try {            
      this.curBody=aDocument.body.cloneNode(true);
	  } catch(ex) {         
	    this.curBody=aDocument.getElementsByTagName("body")[0].cloneNode(true);
	  }  	                                                    	  
	  rootNode.appendChild(this.curBody);
		rootNode.appendChild(aDocument.createTextNode("\n"));				
    
    // now the processing of the dom nodes (changing hrefs, downloading...)
	  this.processDOMRecursively(rootNode);      
	  
		// write css file and add css node with the new css filename in the DOM Tree          				 
		if (this.saveDocumentCSS(aDocument,aFileName))                            		  	
  		this.createCSSFileNode(aDocument,rootNode,aFileName);
		
		// create meta information (version, base_url, url, date/time)                                                  
		if (this.option["metainfo"]) 
		  this.createMetaInformation(aDocument,rootNode);		        

	  // add the charset defintions previously removed by processDOMNode
    if (this.option["encodeUTF8"] ) {
	    this.createMetaCharsetNode(aDocument,rootNode,aDocument.contentType,"UTF-8");	    
		} else {                         
		  // charset probably sent by web server only -> add the charset meta header for local viewing	
		  this.createMetaCharsetNode(aDocument,rootNode,aDocument.contentType,charset);
		} 
    
    // convert the nodes to a html string (including some processing)                                                                                       
    
	// "var " added by Dan S. for Zotero
    var HTMLText = this.generateHTMLString(aDocument,rootNode);
    
		// convert the DOM String to the desired Charset                         
		if (this.option["encodeUTF8"]) {
		  HTMLText = wpdCommon.ConvertFromUnicode16(HTMLText,"UTF-8");
		} else { 		       	  		                 
      HTMLText = wpdCommon.ConvertFromUnicode16(HTMLText,charset);		        
		}      
		
		this.curCharacterSet=charset;      		
                               
    // and write the file...                                                                                       
		var HTMLFile = this.currentDir + aFileName + ".html";   		
		if (!wpdCommon.writeFile(HTMLText, HTMLFile))
		  wpdCommon.addError("[wpdDOMSaver.saveDocumentHTML]: could not write HTML File\n");		
		                               		
		return aFileName + ".html"; 
	},           
	
	// Decides the calling of SaveDocumentFile or saveDocumentHTML
	saveDocumentEx : function(aDocument,aFileName)
	{
    // we have to set a new current url which is the 
    // base reference url (necessary for frame processing)
		this.currentURL = aDocument.location.href;    
		                                                                    
		// distinguish between HTML Documents and other 
		// embedded files like flash, video or images...
		if ( (aDocument.getElementsByTagName("head").length == 0) || !aDocument.contentType.match(/htm|html|xml/i) ) {
			aFileName = this.saveDocumentFile(aDocument, aFileName);
		} else {
			aFileName = this.saveDocumentHTML(aDocument,aFileName)
		}
		
		// set the current URL back to the original base URL                               
		this.currentURL = this.baseURL; 		
		
		return aFileName;
				
	},
	
	// Main Routine: call it for saving the actual active top window
	// (be sure to call the init function at the top of this file before)
	saveHTMLDocument: function()
	{                               
		try {
		  this.saveDocumentEx(this.document,this.name);     
		} catch(ex) {   
			wpdCommon.addError("[wpdDOMSaver.saveHTMLDocument]\n -> "+ex);
		}
	}
  
};                                                       
