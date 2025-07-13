 
import React, { useEffect, useState } from 'react';
import DeepTutorStreamingTag, { StreamingStates } from './DeepTutorStreamingTag';

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

// Process markdown result to fix JSX compatibility issues
const processMarkdownResult = (html) => {
	if (!html || typeof html !== "string") {
		return "";
	}
	
	// Fix self-closing tags for XML/XHTML compatibility
	let processedHtml = html
		.replace(/<br>/g, "<br/>")
		.replace(/<hr>/g, "<hr/>")
		.replace(/<img([^>]*?)>/g, "<img$1/>")
		.replace(/<input([^>]*?)>/g, "<input$1/>")
		.replace(/<area([^>]*?)>/g, "<area$1/>")
		.replace(/<base([^>]*?)>/g, "<base$1/>")
		.replace(/<col([^>]*?)>/g, "<col$1/>")
		.replace(/<embed([^>]*?)>/g, "<embed$1/>")
		.replace(/<link([^>]*?)>/g, "<link$1/>")
		.replace(/<meta([^>]*?)>/g, "<meta$1/>")
		.replace(/<source([^>]*?)>/g, "<source$1/>")
		.replace(/<track([^>]*?)>/g, "<track$1/>")
		.replace(/<wbr([^>]*?)>/g, "<wbr$1/>")
		.replace(/\n/g, "");
	
	return processedHtml;
};

const DeepTutorStreamingComponent = ({ streamText, hideStreamResponse }) => {
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

	const formatResponseForMarkdown = (text) => {
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
			'</appendix>'
		]);
		
		// Remove any other custom tags that might cause XML issues
		// This regex removes any remaining custom tags that aren't standard HTML
		cleanText = cleanText.replace(/<(?!\/?(p|div|span|strong|em|ul|ol|li|h[1-6]|blockquote|code|pre|table|thead|tbody|tr|th|td|br|hr|img|a)\b)[^>]*>/gi, '');
		
		// Now apply mathematical symbol processing to the clean text
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
	};

	const thinkingContainerStyle = {
		marginTop: '1rem',
		borderRadius: '0.5rem',
		backgroundColor: '#F3F4F6',
		paddingLeft: '1rem'
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
						border: 0.0625rem solid #E0E0E0;
						border-radius: 0.5rem;
						overflow: hidden;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1);
						background: #FFFFFF;
						table-layout: auto;
					}
					.markdown thead {
						background: #F8F6F7;
					}
					.markdown tbody {
						background: #FFFFFF;
					}
					.markdown tr {
						border-bottom: 0.0625rem solid #E0E0E0;
					}
					.markdown tr:last-child {
						border-bottom: none;
					}
					.markdown tr:hover {
						background: #F5F5F5;
					}
					.markdown th {
						padding: 0.75rem 0.5rem;
						text-align: left;
						font-weight: 600;
						color: #1C1B1F;
						border-bottom: 0.125rem solid #E0E0E0;
						background: #F8F6F7;
						font-size: 1.0rem;
						line-height: 1.6;
						white-space: normal;
						vertical-align: top;
					}
					.markdown td {
						padding: 0.75rem 0.5rem;
						text-align: left;
						color: #1C1B1F;
						border-bottom: 0.0625rem solid #E0E0E0;
						border-right: 0.0625rem solid #E0E0E0;
						border-left: 0.0625rem solid #E0E0E0;
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
						background: #0687E5 !important;
						opacity: 0.4 !important;
						color: white !important;
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
						background: #0570c0 !important;
						opacity: 0.8 !important;
						transform: scale(1.05) !important;
						box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.15) !important;
					}
					.deeptutor-source-button:active {
						transform: scale(0.95) !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1) !important;
					}
					.deeptutor-source-button:focus {
						outline: 0.125rem solid #0687E5 !important;
						outline-offset: 0.125rem !important;
					}
					.deeptutor-source-button:focus:not(:focus-visible) {
						outline: none !important;
					}
					.deeptutor-source-placeholder {
						background: #9E9E9E !important;
						color: white !important;
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
					/* Streaming-specific source placeholders - gray and unclickable */
					.deeptutor-source-placeholder-streaming {
						background: #9E9E9E !important;
						color: white !important;
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
						vertical-align: baseline !important;
					}
					/* Inline math adjustments */
					.katex:not(.katex-display) {
						font-size: 1em !important;
						line-height: 1.1 !important;
					}
					/* Display math adjustments */
					.katex-display {
						font-size: 1.2em !important;
						line-height: 1.4 !important;
						margin-bottom: 1em !important;
						margin-top: -1.2em !important;
						text-align: bottom !important;
					}
					/* General subscript/superscript positioning */
					.katex .msupsub {
						text-align: left !important;
					}
					.katex .msubsup {
						text-align: right !important;
					}
					/* Improved subscript positioning - reduced to 50% */
					.katex .vlist-t2 > .vlist-r:nth-child(2) > .vlist > span > .sub {
						font-size: 50% !important;
						margin-right: 0.05em !important;
						margin-left: -0.1667em !important;
						margin-top: 0.05em !important;
						vertical-align: -0.2em !important;
					}
					/* Improved superscript positioning - reduced to 50% */
					.katex .vlist-t2 > .vlist-r:nth-child(2) > .vlist > span > .sup {
						font-size: 50% !important;
						margin-right: 0.05em !important;
						margin-left: -0.1667em !important;
						margin-bottom: 0.5em !important;
						vertical-align: 0.4em !important;
					}
					/* Adjust spacing between sub/sup and base */
					.katex .msupsub > .vlist-t2 {
						margin-right: 0.05em !important;
					}
					/* Fractions - improve spacing and positioning */
					.katex .frac-line {
						border-bottom-width: 0.04em !important;
					}
					.katex .frac {
						text-align: center !important;
						vertical-align: middle !important;
						margin: 0.2em 0 !important;
					}
					/* Nested fractions - improve spacing */
					.katex .frac .frac {
						margin: 0.1em 0 !important;
					}
					.katex .frac .frac .frac {
						margin: 0.05em 0 !important;
					}
					/* Fraction numerator and denominator spacing */
					.katex .frac > span {
						padding: 0.1em 0 !important;
					}
					.katex .frac .frac > span {
						padding: 0.05em 0 !important;
					}
					/* Radicals - improve positioning and sizing with better coverage */
					.katex .sqrt {
						vertical-align: baseline !important;
						position: relative !important;
						display: inline-flex !important;
						align-items: baseline !important;
					}
					.katex .sqrt > .sqrt-sign {
						vertical-align: baseline !important;
						position: relative !important;
						height: 1.6em !important;
						width: 1.2em !important;
						display: flex !important;
						align-items: stretch !important;
					}
					.katex .sqrt > .sqrt-sign > .sqrt-line {
						border-top-width: 0.12em !important;
						top: 0.02em !important;
						height: 0.12em !important;
						width: 100% !important;
					}
					.katex .sqrt > .sqrt-sign > .sqrt-line:first-child {
						top: 0.02em !important;
					}
					.katex .sqrt > .sqrt-sign > .sqrt-line:last-child {
						bottom: 0.02em !important;
					}
					.katex .sqrt > .sqrt-radicand {
						vertical-align: baseline !important;
						margin-left: 0.2em !important;
						padding-top: 0.1em !important;
						padding-bottom: 0.1em !important;
					}
					/* Ensure the radical symbol itself is properly sized and positioned */
					.katex .sqrt > .sqrt-sign > .sqrt-symbol {
						font-size: 1.4em !important;
						vertical-align: baseline !important;
						height: 100% !important;
						display: flex !important;
						align-items: stretch !important;
					}
					/* General vertical alignment for all math elements */
					.katex * {
						vertical-align: baseline !important;
					}
					/* Override for specific elements that need different alignment */
					.katex .sup,
					.katex .sub {
						vertical-align: baseline !important;
					}
					/* Prevent excessive spacing */
					.katex .strut {
						display: inline-block !important;
					}
					/* Improve spacing for operators */
					.katex .mop {
						vertical-align: baseline !important;
					}
					/* Add space after inline LaTeX expressions */
					.katex:not(.katex-display) {
						margin-right: 0.2em !important;
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
						const text = formatResponseForMarkdown(thinkingText || '');
						const result = md.render(text);
						const processedResult = processMarkdownResult(result);
						
						return processedResult
							? React.createElement('div', {
								className: "markdown mb-0 flex flex-col",
								dangerouslySetInnerHTML: { __html: processedResult },
								style: {
									fontSize: "14px", // Match DeepTutorChatBox font size
									lineHeight: "1.5", // Match DeepTutorChatBox line height
									wordBreak: "break-word",
									overflowWrap: "break-word"
								}
							})
							: React.createElement('div', {
								style: {
									fontSize: "14px", // Match DeepTutorChatBox font size
									lineHeight: "1.5", // Match DeepTutorChatBox line height
									wordBreak: "break-word",
									overflowWrap: "break-word"
								}
							}, thinkingText || '');
					}
					catch (error) {
						Zotero.debug(`DeepTutorStreamingComponent: Error processing thinking text markdown: ${error.message}`);
						return React.createElement('div', {
							style: {
								fontSize: "14px", // Match DeepTutorChatBox font size
								lineHeight: "1.5", // Match DeepTutorChatBox line height
								wordBreak: "break-word",
								overflowWrap: "break-word"
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
						const text = formatResponseForMarkdown(responseText || '');
						const result = md.render(text);
						const processedResult = processMarkdownResult(result);
						
						return processedResult
							? React.createElement('div', {
								className: "markdown mb-0 flex flex-col",
								dangerouslySetInnerHTML: { __html: processedResult },
								style: {
									fontSize: "14px", // Match DeepTutorChatBox font size
									lineHeight: "1.5", // Match DeepTutorChatBox line height
									wordBreak: "break-word",
									overflowWrap: "break-word"
								}
							})
							: React.createElement('div', {
								style: {
									fontSize: "14px", // Match DeepTutorChatBox font size
									lineHeight: "1.5", // Match DeepTutorChatBox line height
									wordBreak: "break-word",
									overflowWrap: "break-word"
								}
							}, responseText || '');
					}
					catch (error) {
						Zotero.debug(`DeepTutorStreamingComponent: Error processing response text markdown: ${error.message}`);
						return React.createElement('div', {
							style: {
								fontSize: "14px", // Match DeepTutorChatBox font size
								lineHeight: "1.5", // Match DeepTutorChatBox line height
								wordBreak: "break-word",
								overflowWrap: "break-word"
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
		}))
	);
};

export default DeepTutorStreamingComponent;
