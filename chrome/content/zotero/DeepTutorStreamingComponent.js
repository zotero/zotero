// eslint-disable-next-line no-unused-vars
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
		} else if (streamText.includes('<followup_question>')) {
			setStreamingState(StreamingStates.FOLLOW_UP_QUESTIONS);
		} else if (streamText.includes('<source_page>')) {
			setStreamingState(StreamingStates.SOURCE_PAGE);
		} else if (streamText.includes('<sources>')) {
			setStreamingState(StreamingStates.SOURCES);
		} else if (streamText.includes('<response>')) {
			setStreamingState(StreamingStates.RESPONSE);
		} else if (streamText.includes('<thinking>')) {
			setStreamingState(StreamingStates.THINKING);
		} else if (streamText.includes('<id>')) {
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
					currentString =
						currentString.slice(0, index) +
						currentString.slice(index + (substring?.length || 0));
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
		} else if (thinkingIndex !== -1) {
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
		} else if (responseIndex !== -1) {
			setResponseText(streamText.substring(responseIndex));
		}
	}, [streamText]);

	const formatResponseForMarkdown = (text) => {
		let formattedText = text;

		// Replace inline math-like expressions (e.g., \( u \)) with proper Markdown math
		formattedText = formattedText.replace(/\\\((.+?)\\\)/g, '$$$1$$');

		// Replace block math-like expressions (e.g., \[ ... \]) with proper Markdown math
		formattedText = formattedText.replace(
			/\\\[([\s\S]+?)\\\]/g,
			'$$$$\n$1\n$$$$',
		);

		return formattedText.replace(/\[<(\d{1,2})>\]/g, (_, id) => {
			return `<Source id="${id}" />`;
		});
	};

	const Source = ({ id }) => React.createElement('div', {
		style: {
			marginLeft: '0.125rem',
			marginRight: '0.125rem',
			display: 'inline-block',
			height: '1.5rem',
			width: '1.5rem',
			alignItems: 'center',
			borderRadius: '0.75rem',
			backgroundColor: '#9CA3AF',
			textAlign: 'center',
			fontSize: '0.875rem',
			color: 'white'
		},
		'aria-label': 'source'
	}, id);

	const containerStyle = {
		padding: '0.125rem',
		fontFamily: 'Roboto, sans-serif',
		fontSize: '1.125rem',
		lineHeight: '1.5',
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
		fontSize: '1.125rem',
		lineHeight: '1.5',
		textAlign: 'left',
		wordWrap: 'break-word',
		overflowWrap: 'break-word',
		wordBreak: 'break-word',
	};

	return React.createElement('div', null,
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
						
						return processedResult ? React.createElement('div', {
							className: "markdown mb-0 flex flex-col",
							dangerouslySetInnerHTML: { __html: processedResult },
							style: {
								fontSize: "16px",
								lineHeight: "1.5",
								wordBreak: "break-word",
								overflowWrap: "break-word"
							}
						}) : React.createElement('div', {
							style: {
								fontSize: "16px",
								lineHeight: "1.5",
								wordBreak: "break-word",
								overflowWrap: "break-word"
							}
						}, thinkingText || '');
					} catch (error) {
						Zotero.debug(`DeepTutorStreamingComponent: Error processing thinking text markdown: ${error.message}`);
						return React.createElement('div', {
							style: {
								fontSize: "16px",
								lineHeight: "1.5",
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
						
						return processedResult ? React.createElement('div', {
							className: "markdown mb-0 flex flex-col",
							dangerouslySetInnerHTML: { __html: processedResult },
							style: {
								fontSize: "16px",
								lineHeight: "1.5",
								wordBreak: "break-word",
								overflowWrap: "break-word"
							}
						}) : React.createElement('div', {
							style: {
								fontSize: "16px",
								lineHeight: "1.5",
								wordBreak: "break-word",
								overflowWrap: "break-word"
							}
						}, responseText || '');
					} catch (error) {
						Zotero.debug(`DeepTutorStreamingComponent: Error processing response text markdown: ${error.message}`);
						return React.createElement('div', {
							style: {
								fontSize: "16px",
								lineHeight: "1.5",
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
