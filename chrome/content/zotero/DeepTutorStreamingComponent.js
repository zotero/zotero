 
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import DeepTutorStreamingTag, { StreamingStates } from './DeepTutorStreamingTag';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const markdownit = require('markdown-it');
const md = markdownit({
	html: true,
	linkify: true,
	typographer: true
});
const mk = require('resource://zotero/markdown-it-katex.js');
md.use(mk, {
	throwOnError: false,
	errorColor: "#cc0000"
});

// Process markdown result to fix JSX compatibility issues using enhanced regex and Zotero-compatible parsing
const processMarkdownResult = (html) => {
	if (!html || typeof html !== "string") {
		return "";
	}
	
	try {
		// Try to use available DOM parsing APIs
		let parser = null;
		let serializer = null;
		
		// Try xmldom package first (if available)
		try {
			const xmldom = require('resource://zotero/xmldom.js');
			if (xmldom && xmldom.DOMParser && xmldom.XMLSerializer) {
				parser = new xmldom.DOMParser();
				serializer = new xmldom.XMLSerializer();
				Zotero.debug(`DeepTutorStreamingComponent: Successfully loaded and using xmldom package for DOM parsing`);
			}
			else {
				Zotero.debug(`DeepTutorStreamingComponent: xmldom package loaded but missing DOMParser/XMLSerializer`);
			}
		}
		catch (e) {
			Zotero.debug(`DeepTutorStreamingComponent: xmldom package not available or failed to load: ${e.message}`);
		}
		
		// Fallback to native DOM APIs if xmldom not available
		if (!parser) {
			// Check for DOMParser availability in different contexts
			if (typeof DOMParser !== 'undefined') {
				parser = new DOMParser();
				serializer = new XMLSerializer();
			}
			else if (typeof window !== 'undefined' && window.DOMParser) {
				parser = new window.DOMParser();
				serializer = new window.XMLSerializer();
			}
			else if (typeof Components !== 'undefined') {
				// Try Firefox/XUL specific APIs
				try {
					parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
						.createInstance(Components.interfaces.nsIDOMParser);
					serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
						.createInstance(Components.interfaces.nsIDOMSerializer);
				}
				catch (e) {
					Zotero.debug(`DeepTutorStreamingComponent: Components.classes DOMParser not available: ${e.message}`);
				}
			}
		}
		
		if (parser && serializer) {
			// DOM parsing is available, use it
			// Pre-process HTML to fix common XML compatibility issues
			let preprocessedHtml = html
				// Fix self-closing tags to be XML compliant
				.replace(/<(br|hr|img|input|area|base|col|embed|link|meta|param|source|track|wbr)(\s[^>]*)?>/gi, '<$1$2/>')
				// Fix attributes without quotes
				.replace(/(\w+)=([^"\s>]+)(?=[\s>])/g, '$1="$2"')
				// Convert HTML entities to XML-safe equivalents
				.replace(/&nbsp;/g, '&#160;');
			
			const wrappedHtml = `<root>${preprocessedHtml}</root>`;
			Zotero.debug(`DeepTutorStreamingComponent: Preprocessed HTML for XML compatibility`);
			
			// Debug: Show what parser type we're using
			if (parser.constructor && parser.constructor.name) {
				Zotero.debug(`DeepTutorStreamingComponent: Using parser type: ${parser.constructor.name}`);
			}
			
			// Debug: Show the HTML being parsed (truncated for readability)
			if (wrappedHtml.length > 500) {
				Zotero.debug(`DeepTutorStreamingComponent: Parsing HTML content (${wrappedHtml.length} chars, first 500): ${wrappedHtml.substring(0, 500)}...`);
			}
			else {
				Zotero.debug(`DeepTutorStreamingComponent: Parsing HTML content (${wrappedHtml.length} chars): ${wrappedHtml}`);
			}
			
			try {
				// Try parsing as HTML first, then convert to XML
				let doc = null;
				
				// First attempt: Parse as HTML (if the parser supports it)
				if (parser.parseFromString) {
					try {
						doc = parser.parseFromString(wrappedHtml, 'text/html');
						Zotero.debug(`DeepTutorStreamingComponent: Successfully parsed as HTML`);
					}
					catch (htmlError) {
						Zotero.debug(`DeepTutorStreamingComponent: HTML parsing failed: ${htmlError.message}`);
					}
				}
				
				// Second attempt: Parse as XML if HTML parsing failed or not supported
				if (!doc || !doc.documentElement || doc.documentElement.tagName === 'parsererror') {
					try {
						doc = parser.parseFromString(wrappedHtml, 'application/xml');
						Zotero.debug(`DeepTutorStreamingComponent: Parsed as XML`);
						
						// Check if parsing was successful (no parsererror elements)
						const parseError = doc.querySelector ? doc.querySelector('parsererror') : null;
						if (parseError) {
							throw new Error('XML parsing failed');
						}
					}
					catch (xmlError) {
						Zotero.debug(`DeepTutorStreamingComponent: XML parsing also failed: ${xmlError.message}`);
						throw new Error('Both HTML and XML parsing failed');
					}
				}
				
				// Function to recursively fix self-closing tags
				const fixXmlCompatibility = (node) => {
					if (node.nodeType === 1) { // ELEMENT_NODE
						const tagName = node.tagName.toLowerCase();
						
						// List of self-closing HTML tags
						const selfClosingTags = [
							'area',
							'base',
							'br',
							'col',
							'embed',
							'hr',
							'img',
							'input',
							'link',
							'meta',
							'param',
							'source',
							'track',
							'wbr'
						];
						
						// For self-closing tags, ensure they have no children
						if (selfClosingTags.includes(tagName)) {
							while (node.firstChild) {
								node.removeChild(node.firstChild);
							}
						}
						
						// Process child elements
						const children = Array.from(node.children || []);
						for (const child of children) {
							fixXmlCompatibility(child);
						}
					}
				};
				
				// Fix XML compatibility
				fixXmlCompatibility(doc.documentElement);
				
				// Serialize back to string
				const serializedXml = serializer.serializeToString(doc.documentElement);
				let result = serializedXml.replace(/^<root[^>]*>/, '').replace(/<\/root>$/, '');
				
				// Clean up whitespace: remove spaces around specific HTML tags
				result = result
					// Remove spaces before opening tags
					.replace(/\s+<(ol|ul|li|p|div|span|h[1-6])>/g, '<$1>')
					// Remove spaces after opening tags
					.replace(/<(ol|ul|li|p|div|span|h[1-6])>\s+/g, '<$1>')
					// Remove spaces before closing tags
					.replace(/\s+<\/(ol|ul|li|p|div|span|h[1-6])>/g, '</$1>')
					// Remove spaces after closing tags
					.replace(/<\/(ol|ul|li|p|div|span|h[1-6])>\s+/g, '</$1>')
					// Remove spaces at the beginning and end of the entire string
					.trim();
				
				Zotero.debug(`DeepTutorStreamingComponent: Successfully converted HTML to XML using DOM parser and cleaned whitespace`);
				return result;
			}
			catch (domError) {
				Zotero.debug(`DeepTutorStreamingComponent: DOM parsing failed: ${domError.message}, falling back to regex`);
				throw domError;
			}
		}
		else {
			// No DOM parsing available, skip to regex
			throw new Error('No DOM parsing APIs available');
		}
	}
	catch (error) {
		Zotero.debug(`DeepTutorStreamingComponent: DOM parsing failed, using enhanced regex fallback: ${error.message}`);
		
		// Enhanced regex-based approach with better XML compatibility
		let processedHtml = html;
		
		// Fix self-closing tags step by step with validation
		const selfClosingTagPatterns = [
			{ tag: 'br', pattern: /<br(\s[^>]*)?>/gi },
			{ tag: 'hr', pattern: /<hr(\s[^>]*)?>/gi },
			{ tag: 'img', pattern: /<img(\s[^>]*)?>/gi },
			{ tag: 'input', pattern: /<input(\s[^>]*)?>/gi },
			{ tag: 'area', pattern: /<area(\s[^>]*)?>/gi },
			{ tag: 'base', pattern: /<base(\s[^>]*)?>/gi },
			{ tag: 'col', pattern: /<col(\s[^>]*)?>/gi },
			{ tag: 'embed', pattern: /<embed(\s[^>]*)?>/gi },
			{ tag: 'link', pattern: /<link(\s[^>]*)?>/gi },
			{ tag: 'meta', pattern: /<meta(\s[^>]*)?>/gi },
			{ tag: 'param', pattern: /<param(\s[^>]*)?>/gi },
			{ tag: 'source', pattern: /<source(\s[^>]*)?>/gi },
			{ tag: 'track', pattern: /<track(\s[^>]*)?>/gi },
			{ tag: 'wbr', pattern: /<wbr(\s[^>]*)?>/gi }
		];
		
		// Process each self-closing tag type
		for (const { tag, pattern } of selfClosingTagPatterns) {
			processedHtml = processedHtml.replace(pattern, (match, attributes) => {
				const attrs = attributes || '';
				// Ensure the tag is self-closed and doesn't already end with />
				if (match.endsWith('/>')) {
					return match; // Already self-closed
				}
				else {
					return `<${tag}${attrs}/>`;
				}
			});
		}
		
		// Fix common attribute quoting issues
		processedHtml = processedHtml.replace(/(\w+)=([^"\s>]+)(?=[\s>])/g, '$1="$2"');
		
		// Fix HTML entities that might cause XML parsing issues
		processedHtml = processedHtml
			.replace(/&nbsp;/g, '&#160;')
			.replace(/&amp;/g, '&amp;') // Ensure & is properly escaped
			.replace(/&lt;/g, '&lt;')
			.replace(/&gt;/g, '&gt;')
			.replace(/&quot;/g, '&quot;')
			.replace(/&apos;/g, '&apos;');
		
		// Fix any remaining unclosed tags that could cause issues
		// This is a basic fix for common markdown-it output issues
		const unclosedTagPattern = /<(p|div|span|strong|em|ul|ol|li|h[1-6]|blockquote|code|pre)(\s[^>]*)?(?!.*<\/\1>)/gi;
		const tagMatches = [];
		let match;
		
		// Find unclosed tags (basic detection)
		while ((match = unclosedTagPattern.exec(processedHtml)) !== null) {
			tagMatches.push({
				tag: match[1],
				fullMatch: match[0],
				index: match.index
			});
		}
		
		// Log what changes were made
		if (html !== processedHtml) {
			Zotero.debug(`DeepTutorStreamingComponent: Enhanced regex processing made changes to HTML`);
			const changes = [];
			selfClosingTagPatterns.forEach(({ tag }) => {
				if (html.includes(`<${tag}`) && processedHtml.includes(`<${tag}`)
					&& !html.includes(`<${tag}`) === processedHtml.includes(`<${tag}/>`)) {
					changes.push(`${tag} tags made self-closing`);
				}
			});
			if (changes.length > 0) {
				Zotero.debug(`DeepTutorStreamingComponent: Specific changes: ${changes.join(', ')}`);
			}
		}
		
		// Clean up whitespace: remove spaces around specific HTML tags
		processedHtml = processedHtml
			// Remove spaces before opening tags
			.replace(/\s+<(ol|ul|li|p|div|span|h[1-6])>/g, '<$1>')
			// Remove spaces after opening tags
			.replace(/<(ol|ul|li|p|div|span|h[1-6])>\s+/g, '<$1>')
			// Remove spaces before closing tags
			.replace(/\s+<\/(ol|ul|li|p|div|span|h[1-6])>/g, '</$1>')
			// Remove spaces after closing tags
			.replace(/<\/(ol|ul|li|p|div|span|h[1-6])>\s+/g, '</$1>')
			// Remove spaces at the beginning and end of the entire string
			.trim();
		
		Zotero.debug(`DeepTutorStreamingComponent: Enhanced regex processing completed with whitespace cleanup`);
		return processedHtml;
	}
};

const DeepTutorStreamingComponent = ({ streamText, hideStreamResponse }) => {
	const { colors } = useDeepTutorTheme();
	const [streamingState, setStreamingState] = useState(StreamingStates.DEFAULT);
	const [thinkingText, setThinkingText] = useState('');
	const [responseText, setResponseText] = useState('');
	const [pastStatuses, setPastStatuses] = useState([]);

	useEffect(() => {
		setPastStatuses([...pastStatuses, streamingState]);
	}, [streamingState]);

	useEffect(() => {
		if (streamText.includes('</appendix> ')) {
			setStreamingState(StreamingStates.APPENDIX);
		}
		else if (streamText.includes('<followup_question>')) {
			setStreamingState(StreamingStates.FOLLOW_UP_QUESTIONS);
		}
		else if (streamText.includes('<source_page>')) {
			setStreamingState(StreamingStates.SOURCE_PAGE);
		}
		else if (streamText.includes('<sources>')) {
			setStreamingState(StreamingStates.SOURCES);
		}
		else if (streamText.includes('<response>')) {
			setStreamingState(StreamingStates.RESPONSE);
		}
		else if (streamText.includes('<thinking>')) {
			setStreamingState(StreamingStates.THINKING);
		}
		else if (streamText.includes('<id>')) {
			setStreamingState(StreamingStates.ID);
		}
		else if (streamText.includes('<stopped>')) {
			setStreamingState(StreamingStates.STOPPED);
		}
	}, [streamText]);

	const removeSubstrings = (originalString, substringsToRemove) => {
		let currentString = originalString;
		for (let i = 0; i < substringsToRemove.length; i += 1) {
			const substring = substringsToRemove[i];
			if (typeof substring === 'string') {
				const index = currentString.indexOf(substring);
				if (index !== -1) {
					currentString
						= currentString.slice(0, index)
						+ currentString.slice(index + (substring?.length || 0));
				}
			}
		}
		return currentString;
	};

	useEffect(() => {
		const thinkingIndex = streamText.includes('<thinking>')
			? streamText.indexOf('<thinking>') + '<thinking>'.length
			: -1;
		const endThinkingIndex = streamText.indexOf('</thinking>');
		if (endThinkingIndex !== -1) {
			setThinkingText(
				removeSubstrings(
					streamText.substring(thinkingIndex, endThinkingIndex),
					['<think>', '</think>'],
				),
			);
		}
		else if (thinkingIndex !== -1) {
			setThinkingText(
				removeSubstrings(streamText.substring(thinkingIndex), [
					'<think>',
					'</think>',
				]),
			);
		}

		const responseIndex = streamText.includes('<response>')
			? streamText.indexOf('<response>') + '<response>'.length
			: -1;
		const endResponseIndex = streamText.indexOf('</response>');
		if (endResponseIndex !== -1) {
			setResponseText(streamText.substring(responseIndex, endResponseIndex));
		}
		else if (responseIndex !== -1) {
			setResponseText(streamText.substring(responseIndex));
		}
	}, [streamText]);

	const formatResponseForMarkdown = (text, subMessage) => {
		if (!text || typeof text !== 'string') {
			return '';
		}
		
		// Helper function to remove custom tags from text
		const removeSubstrings = (originalString, substringsToRemove) => {
			let currentString = originalString;
			for (let i = 0; i < substringsToRemove.length; i++) {
				const substring = substringsToRemove[i];
				if (typeof substring === 'string') {
					const index = currentString.indexOf(substring);
					if (index !== -1) {
						currentString = currentString.slice(0, index)
							+ currentString.slice(index + (substring?.length || 0));
					}
				}
			}
			return currentString;
		};

		// Extract only the response content, removing custom tags
		let cleanText = text;
		
		// Check if text contains custom tags and extract only the response part
		if (text.includes('<response>')) {
			const responseIndex = text.indexOf('<response>') + '<response>'.length;
			const endResponseIndex = text.indexOf('</response>');
			if (endResponseIndex !== -1) {
				cleanText = text.substring(responseIndex, endResponseIndex);
			}
			else {
				cleanText = text.substring(responseIndex);
			}
		}
		
		// Replacement for source span identifier - same logic as DeepTutorChatBox but simplified for streaming
		Zotero.debug(`DeepTutorStreamingComponent: formatResponseForMarkdown - Replacing source span identifiers ${cleanText}`);
		cleanText = cleanText.replace(/\[<(\d{1,2})>\]/g, (match, sourceId) => {
			const sourceIndex = parseInt(sourceId) - 1; // Convert to 0-based index
			
			Zotero.debug(`DeepTutorStreamingComponent: Processing source reference: ${match}, sourceId: ${sourceId}, sourceIndex: ${sourceIndex}`);
			
			// For streaming, we don't have access to source data, so we create simple placeholders
			// The actual source data will be available when the final message is processed in DeepTutorChatBox
			const htmlSpan = `<span class="deeptutor-source-placeholder-streaming" data-source-id="${sourceId}" data-page="Unknown">${sourceId}</span>`;
			Zotero.debug(`DeepTutorStreamingComponent: Generated streaming HTML span for source ${sourceId}: "${htmlSpan}"`);
			return htmlSpan;
		});
		Zotero.debug(`DeepTutorStreamingComponent: formatResponseForMarkdown - Clean text after source span replacement: ${cleanText}`);

		// Remove any remaining custom tags that might interfere with XML parsing
		cleanText = removeSubstrings(cleanText, [
			'<thinking>',
			'</thinking>',
			'<think>',
			'</think>',
			'<followup_question>',
			'</followup_question>',
			'<source_page>',
			'</source_page>',
			'<sources>',
			'</sources>',
			'<id>',
			'</id>',
			'<appendix>',
			'</appendix>',
			'<stopped>',
			'</stopped>'
		]);
		
		// Remove any other custom tags that might cause XML issues
		// This regex removes any remaining custom tags that aren't standard HTML
		// cleanText = cleanText.replace(/<(?!\/?(p|div|span|strong|em|ul|ol|li|h[1-6]|blockquote|code|pre|table|thead|tbody|tr|th|td|br|hr|img|a)\b)[^>]*>/gi, '');
		
		// Now apply mathematical symbol processing and source processing to the clean text
		let formattedText = cleanText;

		// Replace inline math-like expressions (e.g., \( u \)) with proper Markdown math
		formattedText = formattedText.replace(/\\\((.+?)\\\)/g, '$$$1$$');

		// Replace block math-like expressions (e.g., \[ ... \]) with proper Markdown math
		formattedText = formattedText.replace(
			/\\\[([\s\S]+?)\\\]/g,
			'$$$$\n$1\n$$$$',
		);
		
		Zotero.debug(`DeepTutorStreamingComponent: formatResponseForMarkdown - Original text length: ${text.length}, Clean text length: ${cleanText.length}`);
		Zotero.debug(`DeepTutorStreamingComponent: formatResponseForMarkdown - Removed custom tags and processed for XML compatibility`);
		Zotero.debug(`DeepTutorStreamingComponent: formatResponseForMarkdown - Available sources: ${subMessage?.sources?.length || 0}`);
		
		Zotero.debug(`DeepTutorStreamingComponent: formatResponseForMarkdown - Final formatted text length: ${formattedText.length}`);
		return formattedText;
	};

	// Source component removed - using HTML spans instead for consistency with DeepTutorChatBox

	const containerStyle = {
		padding: '0.125rem',
		fontFamily: 'Roboto, sans-serif',
		fontSize: '0.875rem', // Match DeepTutorChatBox font size
		lineHeight: '1.35', // Match DeepTutorChatBox line height
		textAlign: 'left',
		wordWrap: 'break-word',
		overflowWrap: 'break-word',
		wordBreak: 'break-word',
		color: colors.text.primary,
	};

	const thinkingContainerStyle = {
		borderRadius: '0.5rem',
		backgroundColor: colors.background.quaternary,
		paddingLeft: '1rem',
		color: colors.text.primary,
	};

	const responseContainerStyle = {
		marginBottom: '0.5rem',
		textAlign: 'left',
		padding: '0.75rem',
		fontFamily: 'Roboto, sans-serif',
		fontSize: '0.875rem', // Match DeepTutorChatBox font size
		lineHeight: '1.35', // Match DeepTutorChatBox line height
		wordWrap: 'break-word',
		overflowWrap: 'break-word',
		wordBreak: 'break-word',
		color: colors.text.primary, // Use theme text color
	};

	return React.createElement('div', null,
		// Add CSS styles for markdown tables and source buttons to match DeepTutorChatBox
		React.createElement('style', {
			dangerouslySetInnerHTML: {
				__html: `
					.markdown table {
						border-collapse: collapse;
						width: 100%;
						margin: 1rem 0;
						font-size: 1rem;
						line-height: 1.4;
						border: 0.0625rem solid ${colors.border.primary};
						border-radius: 0.5rem;
						overflow: hidden;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1);
						background: ${colors.background.primary};
						table-layout: auto;
					}
					.markdown thead {
						background: ${colors.background.quaternary};
					}
					.markdown tbody {
						background: ${colors.background.primary};
					}
					.markdown tr {
						border-bottom: 0.0625rem solid ${colors.border.primary};
					}
					.markdown tr:last-child {
						border-bottom: none;
					}
					.markdown tr:hover {
						background: ${colors.background.quaternary};
					}
					.markdown th {
						padding: 0.75rem 0.5rem;
						text-align: left;
						font-weight: 600;
						color: ${colors.text.primary};
						border-bottom: 0.125rem solid ${colors.border.primary};
						background: ${colors.background.quaternary};
						font-size: 1.0rem;
						line-height: 1.6;
						white-space: normal;
						vertical-align: top;
					}
					.markdown td {
						padding: 0.75rem 0.5rem;
						text-align: left;
						color: ${colors.text.primary};
						border-bottom: 0.0625rem solid ${colors.border.primary};
						border-right: 0.0625rem solid ${colors.border.primary};
						border-left: 0.0625rem solid ${colors.border.primary};
						font-size: 1.0rem;
						line-height: 1.6;
						white-space: normal;
						word-break: keep-all;
						overflow-wrap: break-word;
						vertical-align: top;
					}
					/* First column - prevent word breaking but allow line wrapping */
					.markdown td:first-child {
						word-break: keep-all;
						overflow-wrap: break-word;
						white-space: normal;
						width: fit-content;
						min-width: fit-content;
					}
					/* Other columns - allow normal word breaking */
					.markdown td:nth-child(n+2) {
						word-break: break-word;
						overflow-wrap: break-word;
						white-space: normal;
						width: auto;
					}
					
					/* Special styling for source buttons within tables */
					.markdown table .deeptutor-source-button {
						width: 2em !important;
						height: 2em !important;
						font-size: 1em !important;
						margin: 0 0.15em !important;
						vertical-align: middle !important;
					}
					
					/* Special styling for source placeholders within tables */
					.markdown table .deeptutor-source-placeholder {
						width: 1.5em !important;
						height: 1.5em !important;
						font-size: 0.75em !important;
						margin: 0 0.15em !important;
						vertical-align: middle !important;
					}
					/* First column styling - prevent word breaking but allow line wrapping */
					.markdown table td:first-child,
					.markdown table th:first-child {
						width: fit-content;
						min-width: fit-content;
						white-space: normal;
						word-break: keep-all;
						overflow-wrap: break-word;
					}
					.deeptutor-source-button {
						background: ${colors.sourceButton.background} !important;
						opacity: 1 !important;
						color: ${colors.sourceButton.text} !important;
						border: none !important;
						border-radius: 50% !important;
						width: 2rem !important;
						height: 2rem !important;
						display: inline-flex !important;
						align-items: center !important;
						justify-content: center !important;
						font-weight: 600 !important;
						font-size: 0.875rem !important;
						cursor: pointer !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.08) !important;
						padding: 0 !important;
						margin: 0 0.25rem !important;
						transition: all 0.2s ease !important;
						vertical-align: middle !important;
						line-height: 1 !important;
						text-decoration: none !important;
						user-select: none !important;
						font-family: 'Roboto', sans-serif !important;
						position: relative !important;
						overflow: hidden !important;
					}
					.deeptutor-source-button:hover {
						background: ${colors.button.hover} !important;
						opacity: 0.8 !important;
						transform: scale(1.05) !important;
						box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.15) !important;
					}
					.deeptutor-source-button:active {
						transform: scale(0.95) !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1) !important;
					}
					.deeptutor-source-button:focus {
						outline: 0.125rem solid ${colors.sourceButton.background} !important;
						outline-offset: 0.125rem !important;
					}
					.deeptutor-source-button:focus:not(:focus-visible) {
						outline: none !important;
					}
					.deeptutor-source-placeholder {
						background: ${colors.sourceButton.placeholder} !important;
						color: ${colors.sourceButton.text} !important;
						border: none !important;
						border-radius: 50% !important;
						width: 2rem !important;
						height: 2rem !important;
						display: inline-flex !important;
						align-items: center !important;
						justify-content: center !important;
						font-weight: 600 !important;
						font-size: 0.875rem !important;
						cursor: default !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.08) !important;
						padding: 0 !important;
						margin: 0 0.25rem !important;
						vertical-align: middle !important;
						line-height: 1 !important;
						text-decoration: none !important;
						user-select: none !important;
						font-family: 'Roboto', sans-serif !important;
						position: relative !important;
						overflow: hidden !important;
					}
					/* Streaming-specific source placeholders - use theme colors */
					.deeptutor-source-placeholder-streaming {
						background: ${colors.sourceButton.streamingBackground} !important;
						color: ${colors.sourceButton.streamingText} !important;
						border: none !important;
						border-radius: 50% !important;
						width: 2rem !important;
						height: 2rem !important;
						display: inline-flex !important;
						align-items: center !important;
						justify-content: center !important;
						font-weight: 600 !important;
						font-size: 0.875rem !important;
						cursor: default !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.08) !important;
						padding: 0 !important;
						margin: 0 0.25rem !important;
						vertical-align: middle !important;
						line-height: 1 !important;
						text-decoration: none !important;
						user-select: none !important;
						font-family: 'Roboto', sans-serif !important;
						position: relative !important;
						overflow: hidden !important;
						opacity: 0.7 !important;
					}
					/* Special styling for streaming source placeholders within tables */
					.markdown table .deeptutor-source-placeholder-streaming {
						width: 1.5em !important;
						height: 1.5em !important;
						font-size: 0.75em !important;
						margin: 0 0.15em !important;
						vertical-align: middle !important;
					}
					@keyframes pulse {
						0% { opacity: 0.3; }
						100% { opacity: 0.6; }
					}
					/* KaTeX math expression styles */
					.katex {
						font-size: 1.1em !important;
						line-height: 1.2 !important;
						vertical-align: middle !important;
					}
					/* Inline math adjustments */
					.katex:not(.katex-display) {
						font-size: 1em !important;
						line-height: 1.1 !important;
						vertical-align: middle !important;
					}
					/* Display math adjustments */
					.katex-display {
						font-size: 1.2em !important;
						line-height: 1.4 !important;
						margin-bottom: 1em !important;
						margin-top: 0.5em !important;
						
					}
					/* General subscript/superscript positioning */
					.katex .msupsub {
						text-align: left !important;
					}
					.katex .msubsup {
						text-align: right !important;
					}
					/* Proper KaTeX subscript and superscript sizing */
					.katex .msupsub > .vlist-t {
						font-size: 0.7em !important;
					}
					.katex .msupsub .mord {
						font-size: 0.7em !important;
					}
					.katex .scriptstyle {
						font-size: 0.7em !important;
					}
					.katex .scriptscriptstyle {
						font-size: 0.5em !important;
					}
					/* Target actual superscript and subscript elements */
					.katex sup {
						font-size: 0.7em !important;
						vertical-align: super !important;
					}
					.katex sub {
						font-size: 0.7em !important;
						vertical-align: sub !important;
					}
					/* More specific KaTeX internal selectors */
					.katex .vlist .sizing.reset-size6.size3,
					.katex .vlist .fontsize-ensurer.reset-size6.size3 {
						font-size: 0.7em !important;
					}
					/* Radicals - fix square root positioning issues */
					.katex .sqrt {
						vertical-align: baseline !important;
						display: inline-block !important;
						position: relative !important;
					}
					.katex .sqrt > .vlist-t {
						display: inline-block !important;
						vertical-align: baseline !important;
					}
					.katex .sqrt-sign {
						position: relative !important;
						display: inline-block !important;
					}
					.katex .sqrt-line {
						border-top: 0.08em solid !important;
						position: relative !important;
						display: block !important;
						width: 100% !important;
						margin-top: -0.3em !important;
					}
					/* Fix radical symbol positioning */
					.katex .sqrt > .vlist-t > .vlist-r > .vlist {
						display: inline-block !important;
						vertical-align: baseline !important;
					}
					/* Prevent radical content from floating */
					.katex .sqrt .vlist {
						position: relative !important;
						display: inline-block !important;
					}
					/* Fractions - improve spacing and positioning */
					.katex .frac-line {
						border-bottom-width: 0.06em !important;
					}
					/* Fix outer containers that contain fractions */
					.katex-display:has(.frac),
					.katex-display:has(.mfrac) {
						margin-top: -1em !important;
						margin-bottom: 1.5em !important;
						vertical-align: middle !important;

					}
					/* General vertical alignment for all math elements */
					.katex * {
						vertical-align: baseline !important;
					}
					/* Improve spacing for operators */
					.katex .mop {
						vertical-align: baseline !important;
					}
					/* Ensure proper spacing around inline math */
					.katex:not(.katex-display)::after {
						content: " " !important;
						white-space: normal !important;
					}
					/* List styling - reduce horizontal spacing */
					.markdown ul,
					.markdown ol {
						margin: 0.5em 0 !important;
						padding-left: 1.5em !important;
					}
					.markdown li {
						margin: 0.25em 0 !important;
						padding-left: 0.5em !important;
					}
					/* Nested lists */
					.markdown ul ul,
					.markdown ol ol,
					.markdown ul ol,
					.markdown ol ul {
						margin: 0.25em 0 !important;
						padding-left: 1em !important;
					}
				`
			}
		}),
		// Thinking section
		pastStatuses.includes(StreamingStates.THINKING) && React.createElement(DeepTutorStreamingTag, {
			streamState: StreamingStates.THINKING,
			isCurrentTag: pastStatuses[pastStatuses.length - 1] === StreamingStates.THINKING
		}),
		React.createElement('div', { style: thinkingContainerStyle },
			React.createElement('div', { style: containerStyle },
				(() => {
					try {
						const text = formatResponseForMarkdown(thinkingText || '', null);
						const result = md.render(text);
						const processedResult = processMarkdownResult(result);
						
						return processedResult
							? React.createElement('div', {
								className: "markdown mb-0 flex flex-col",
								dangerouslySetInnerHTML: { __html: processedResult },
								style: {
									fontSize: "1rem", // 13px equivalent with 13px root font size
									lineHeight: "1.5", // Match DeepTutorChatBox line height
									wordBreak: "break-word",
									overflowWrap: "break-word",
									color: colors.text.primary // Use theme text color
								}
							})
							: React.createElement('div', {
								style: {
									fontSize: "1rem", // 13px equivalent with 13px root font size
									lineHeight: "1.5", // Match DeepTutorChatBox line height
									wordBreak: "break-word",
									overflowWrap: "break-word",
									color: colors.text.primary // Use theme text color
								}
							}, thinkingText || '');
					}
					catch (error) {
						Zotero.debug(`DeepTutorStreamingComponent: Error processing thinking text markdown: ${error.message}`);
						return React.createElement('div', {
							style: {
								fontSize: "1rem", // 13px equivalent with 13px root font size
								lineHeight: "1.5", // Match DeepTutorChatBox line height
								wordBreak: "break-word",
								overflowWrap: "break-word",
								color: colors.text.primary // Use theme text color
							}
						}, thinkingText || '');
					}
				})()
			)
		),
		// Response section
		!hideStreamResponse && responseText !== '' && React.createElement('div', { style: responseContainerStyle },
			React.createElement('div', { style: containerStyle },
				(() => {
					try {
						const text = formatResponseForMarkdown(responseText || '', null);
						const result = md.render(text);
						const processedResult = processMarkdownResult(result);
						
						return processedResult
							? React.createElement('div', {
								className: "markdown mb-0 flex flex-col",
								dangerouslySetInnerHTML: { __html: processedResult },
								style: {
									fontSize: "1rem", // 13px equivalent with 13px root font size
									lineHeight: "1.5", // Match DeepTutorChatBox line height
									wordBreak: "break-word",
									overflowWrap: "break-word",
									color: colors.text.primary // Use theme text color
								}
							})
							: React.createElement('div', {
								style: {
									fontSize: "1rem", // 13px equivalent with 13px root font size
									lineHeight: "1.5", // Match DeepTutorChatBox line height
									wordBreak: "break-word",
									overflowWrap: "break-word",
									color: colors.text.primary // Use theme text color
								}
							}, responseText || '');
					}
					catch (error) {
						Zotero.debug(`DeepTutorStreamingComponent: Error processing response text markdown: ${error.message}`);
						return React.createElement('div', {
							style: {
								fontSize: "1rem", // 13px equivalent with 13px root font size
								lineHeight: "1.5", // Match DeepTutorChatBox line height
								wordBreak: "break-word",
								overflowWrap: "break-word",
								color: colors.text.primary // Use theme text color
							}
						}, responseText || '');
					}
				})()
			)
		),
		// Other streaming status tags
		pastStatuses.slice(3).map((status, index) => React.createElement(DeepTutorStreamingTag, {
			key: index,
			streamState: status,
			isCurrentTag: pastStatuses[pastStatuses.length - 1] === status
		})),
		// Show stopped tag if stream text contains stopped tag
		streamText.includes('<stopped>') && React.createElement(DeepTutorStreamingTag, {
			key: 'stopped',
			streamState: StreamingStates.STOPPED,
			isCurrentTag: false
		})
	);
};

DeepTutorStreamingComponent.propTypes = {
	streamText: PropTypes.string.isRequired,
	hideStreamResponse: PropTypes.bool
};

export default DeepTutorStreamingComponent;
