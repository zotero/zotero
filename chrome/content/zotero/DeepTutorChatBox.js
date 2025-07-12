// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
	createMessage,
	getMessagesBySessionId,
	getDocumentById,
	subscribeToChat
} from './api/libs/api';
import DeepTutorStreamingComponent from './DeepTutorStreamingComponent';

const markdownit = require('markdown-it');
// Try to require markdown-it-container, fallback to a simpler implementation if not available
try {
	require('markdown-it-container');
	Zotero.debug(`DeepTutorChatBox: markdown-it-container found, using it`);
}
catch {
	// Fallback implementation for markdown-it-container
	Zotero.debug(`DeepTutorChatBox: markdown-it-container not found, using fallback implementation`);
}
const md = markdownit({
	html: true,
	linkify: true,
	typographer: true,
	tables: true, // Enable built-in table support
	breaks: false, // GFM line breaks (optional)
	strikethrough: true // Enable strikethrough support
});

// Re-enable markdown-it-katex plugin now that XML parsing is fixed
const mk = require('resource://zotero/markdown-it-katex.js');
md.use(mk, {
	throwOnError: false,
	errorColor: "#cc0000"
});

// Try to add enhanced table support with plugins
try {
	// Try to load markdown-it-table plugin for enhanced table features
	const markdownItTable = require('markdown-it-table');
	md.use(markdownItTable);
	Zotero.debug(`DeepTutorChatBox: markdown-it-table plugin loaded successfully`);
}
catch {
	Zotero.debug(`DeepTutorChatBox: markdown-it-table plugin not found, using built-in table support`);
		
	// Try alternative GFM plugin that includes tables
	try {
		const markdownItGfm = require('markdown-it-gfm');
		md.use(markdownItGfm);
		Zotero.debug(`DeepTutorChatBox: markdown-it-gfm plugin loaded successfully`);
	}
	catch {
		Zotero.debug(`DeepTutorChatBox: markdown-it-gfm plugin not found, using basic table support only`);
	}
}

// Configure markdown-it-container for source buttons
// DISABLED - Using direct HTML replacement approach instead to avoid table conflicts
// The container plugin interferes with table parsing, so we'll use post-processing instead

// Test removed - no longer using container plugin

// Test the markdown-it table setup with HTML support
try {
	const testTableSyntax = `
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell A <span>HTML</span> | Cell B | Cell C |
`;
	const testTableResult = md.render(testTableSyntax);
	Zotero.debug(`DeepTutorChatBox: Table test - input: "${testTableSyntax.trim()}"`);
	Zotero.debug(`DeepTutorChatBox: Table test - output: "${testTableResult}"`);
	if (testTableResult.includes('<table') && testTableResult.includes('<th') && testTableResult.includes('<td')) {
		Zotero.debug(`DeepTutorChatBox: Table test PASSED - tables are being rendered correctly`);
		if (testTableResult.includes('<span>HTML</span>')) {
			Zotero.debug(`DeepTutorChatBox: HTML support test PASSED - HTML in tables is preserved`);
		}
		else {
			Zotero.debug(`DeepTutorChatBox: HTML support test FAILED - HTML in tables was escaped`);
		}
	}
	else {
		Zotero.debug(`DeepTutorChatBox: Table test FAILED - no table elements found in output`);
	}
}
catch (error) {
	Zotero.debug(`DeepTutorChatBox: Table test ERROR: ${error.message}`);
}



class Conversation {
	constructor({
		userId = null,
		sessionId = null,
		ragSessionId = null,
		storagePaths = [],
		history = [],
		message = null,
		streaming = false,
		type = SessionType.BASIC
	} = {}) {
		this.userId = userId;
		this.sessionId = sessionId;
		this.ragSessionId = ragSessionId;
		this.storagePaths = storagePaths;
		this.history = history;
		this.message = message;
		this.streaming = streaming;
		this.type = type;
	}
}

const SessionType = {
	LITE: 'LITE',
	BASIC: 'BASIC',
	ADVANCED: 'ADVANCED'
};

const ContentType = {
	THINK: 'THINK',
	TEXT: 'TEXT',
	IMAGE: 'IMAGE',
	AUDIO: 'AUDIO'
};

const MessageStatus = {
	UNVIEW: 'UNVIEW',
	DELETED: 'DELETED',
	VIEWED: 'VIEWED',
	PROCESSING_ERROR: 'PROCESSING_ERROR'
};

const MessageRole = {
	TUTOR: 'TUTOR',
	USER: 'USER'
};

// Styles
const styles = {
	container: {
		width: '100%',
		minHeight: '80%',
		background: '#F2F2F2',
		borderRadius: '0.5rem',
		boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		fontFamily: 'Roboto, sans-serif',
		position: 'relative',
		overflow: 'hidden',
		padding: '1.875rem 0.75rem 0 0.75rem',
		boxSizing: 'border-box',
		userSelect: 'text', // Ensure text is selectable
		WebkitUserSelect: 'text',
		MozUserSelect: 'text',
		msUserSelect: 'text',
	},
	sessionNameDiv: {
		width: '100%',
		marginBottom: '1.25rem',
		color: '#000000',
		fontWeight: 500,
		fontSize: '1.25rem',
		lineHeight: '100%',
		fontFamily: 'Roboto, sans-serif',
	},
	sessionInfo: {
		width: '90%',
		fontSize: '1em',
		color: '#495057',
		marginBottom: '0.25rem',
		paddingLeft: '0.25rem',
		fontFamily: 'Roboto, sans-serif',
		alignSelf: 'flex-start',
		marginLeft: '5%',
	},
	chatLog: {
		width: '100%',
		borderRadius: '0.625rem',
		overflowY: 'auto',
		overflowX: 'hidden',
		background: '#F2F2F2',
		height: '100%',
		boxShadow: 'none',
		fontFamily: 'Roboto, sans-serif',
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'stretch',
		boxSizing: 'border-box',
		marginBottom: '1.25rem',
		userSelect: 'text',
		WebkitUserSelect: 'text',
		MozUserSelect: 'text',
		msUserSelect: 'text',
	},
	bottomBar: {
		width: '100%',
		background: '#F8F6F7',
		display: 'flex',
		alignItems: 'flex-end', // Changed from 'center' to 'flex-end' to align with textarea
		justifyContent: 'space-between',
		fontFamily: 'Roboto, sans-serif',
		position: 'relative',
		zIndex: 1,
		border: '0.0625rem solid #D9D9D9',
		borderRadius: '0.5rem',
		boxSizing: 'border-box',
		minHeight: '2.5rem',
		maxHeight: '10rem', // Increased to accommodate larger textarea (7rem + padding)
		padding: '0.5rem',
	},
	textInput: {
		flex: 1,
		padding: '0.5rem 0.75rem',
		border: 'none',
		outline: 'none',
		borderRadius: '0.625rem',
		background: '#F8F6F7',
		color: '#757575',
		minHeight: '1.5rem',
		maxHeight: '7rem', // Approximately 5 lines of text at 0.95rem font size
		fontSize: '1.25rem',
		overflowY: 'auto',
		fontFamily: 'Roboto, sans-serif',
		resize: 'none',
		height: '24px', // Start with minHeight (1.5rem)
		marginRight: '0.625rem',
		alignSelf: 'flex-end',
		lineHeight: '1.4',
		wordWrap: 'break-word',
		whiteSpace: 'pre-wrap'
	},
	sendButton: {
		all: 'revert',
		background: '#F8F6F7',
		border: 'none',
		borderRadius: '50%',
		aspectRatio: '1',
		height: '1.8rem',
		width: '1.8rem',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		cursor: 'pointer',
		padding: '0.125rem',
		transition: 'background-color 0.2s ease',
		flexShrink: 0,
		alignSelf: 'center',
		':hover': {
			background: '#D9D9D9'
		}
	},
	sendIcon: {
		width: '1.5rem',
		height: '1.5rem',
		objectFit: 'contain',
	},
	messageContainer: {
		width: '100%',
		margin: '0.5rem 0',
		boxSizing: 'border-box',
		display: 'flex',
		flexDirection: 'column',
	},
	messageBubble: {
		padding: '0.5rem 0.75rem',
		borderRadius: '0.625rem',
		maxWidth: '100%',
		boxShadow: 'none',
		animation: 'slideIn 0.3s ease-out forwards',
		height: 'auto',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
		boxSizing: 'border-box',
		overflowWrap: 'break-word',
		userSelect: 'text',
		WebkitUserSelect: 'text',
		MozUserSelect: 'text',
		msUserSelect: 'text',
	},
	userMessage: {
		backgroundColor: 'white',
		color: '#1C1B1F',
		marginLeft: 'auto',
		marginRight: 0,
		borderRadius: '0.625rem',
		fontWeight: 400,
		textAlign: 'left',
		alignSelf: 'flex-end',
		maxWidth: '85%',
		width: 'fit-content',
		fontSize: '0.875rem',
		lineHeight: '1.35',
		padding: '0.25rem 1.25rem',
		
	},
	botMessage: {
		backgroundColor: '#F2F2F2',
		color: '#000000',
		marginRight: 'auto',
		marginLeft: 0,
		borderBottomLeftRadius: '0.25rem',
		borderRadius: '1rem',
		fontWeight: 400,
		alignSelf: 'flex-start',
	},

	messageText: {
		display: 'block',
		maxWidth: '100%',
		overflowWrap: 'break-word',
		wordBreak: 'break-word',
		userSelect: 'text',
		WebkitUserSelect: 'text',
		MozUserSelect: 'text',
		msUserSelect: 'text',
		cursor: 'text',
	},

	questionContainer: {
		all: 'revert',
		width: '100%',
		margin: '0.5rem 0',
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'flex-start',
		gap: '0.75rem',
		flexWrap: 'wrap',
		boxSizing: 'border-box',
	},
	questionButton: {
		all: 'revert',
		background: '#FFFFFF',
		color: '#000',
		border: '0.0625rem solid #0687E5',
		borderRadius: '0.625rem',
		padding: '0.625rem 1.25rem',
		minWidth: '8rem',
		maxWidth: '83%',
		fontWeight: 500,
		fontSize: '1.25rem',
		lineHeight: '1.5',
		cursor: 'pointer',
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.04)',
		textAlign: 'left',
		fontFamily: 'Roboto, sans-serif',
		height: 'auto',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
		transition: 'background 0.2s',
		boxSizing: 'border-box',
		overflowWrap: 'break-word',
		alignSelf: 'flex-end',
		marginLeft: 'auto',
		marginRight: '0',
	},

	viewContextContainer: {
		position: 'relative',
		width: '100%',
		marginBottom: '1.25rem',
	},
	viewContextButton: {
		all: 'revert',
		width: '100%',
		gap: '0.625rem',
		padding: '0.625rem 1.25rem',
		border: '0.0625rem solid #BDBDBD',
		borderRadius: '0.625rem',
		height: '3rem',
		background: '#F8F6F7',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		boxSizing: 'border-box',
		cursor: 'pointer',
		transition: 'background-color 0.2s',
	},
	viewContextButtonHover: {
		background: '#FFFFFF',
	},
	viewContextText: {
		fontSize: '1.25rem',
		fontWeight: 400,
		color: '#757575',
		lineHeight: '100%',
	},
	contextPopup: {
		position: 'absolute',
		top: '100%',
		left: 0,
		right: 0,
		background: '#F2F2F2',
		border: '0.0625rem solid #E0E0E0',
		borderRadius: '0.5rem',
		boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
		zIndex: 1000,
		maxHeight: '24rem', // 360px = 5 items * (3rem height + 1.5rem padding)
		overflowY: 'auto',
		marginTop: '0.25rem',
		boxSizing: 'border-box',
	},
	contextDocumentButton: {
		all: 'revert',
		width: '100%',
		padding: '0.75rem',
		background: '#F8F6F7',
		border: 'none',
		borderBottom: '0.0625rem solid #E0E0E0',
		color: '#292929',
		fontSize: '0.875rem',
		fontWeight: 400,
		cursor: 'pointer',
		textAlign: 'left',
		fontFamily: 'Roboto, sans-serif',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'flex-start',
		transition: 'background-color 0.2s',
		boxSizing: 'border-box',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
	},
	contextDocumentButtonHover: {
		background: '#FFFFFF',
	},
	followUpQuestionText: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'flex-end',
		fontSize: '0.875rem',
		fontWeight: 400,
		color: '#757575',
		lineHeight: '1.35',
		cursor: 'pointer',
	}
};

const SendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/RES_SEND.svg';
const ArrowDownPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/CHAT_ARROWDOWN.svg';
const DeepTutorChatBox = ({ currentSession, onInitWaitChange }) => {
	const [messages, setMessages] = useState([]);
	const [inputValue, setInputValue] = useState('');
	const [sessionId, setSessionId] = useState(null);
	const [userId, setUserId] = useState(null);
	const [documentIds, setDocumentIds] = useState([]);
	const [latestMessageId, setLatestMessageId] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const [storagePathsState, setStoragePathsState] = useState([]);
	const [curSessionType, setcurSessionType] = useState(SessionType.BASIC);
	const chatLogRef = useRef(null);
	const contextPopupRef = useRef(null);
	const textareaRef = useRef(null);
	const [hoveredContextDoc, setHoveredContextDoc] = useState(null);
	// Removed hoveredQuestion and hoveredPopupSession states - these were causing unnecessary re-renders
	const [hoveredQuestion, setHoveredQuestion] = useState(null);
	// const [hoveredPopupSession, setHoveredPopupSession] = useState(null);
	const [iniWait, setInitWait] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const isAutoScrollingRef = useRef(true);
	const [showContextPopup, setShowContextPopup] = useState(false);
	const [contextDocuments, setContextDocuments] = useState([]);
	const [currentSourceIndices, setCurrentSourceIndices] = useState([]);
	const sessionIdRef = useRef(null);

	// Set up global handler for source button clicks
	useEffect(() => {
		window.handleDeepTutorSourceClick = (encodedSourceData) => {
			try {
				const sourceData = JSON.parse(decodeURIComponent(encodedSourceData));
				Zotero.debug(`DeepTutorChatBox: Source button clicked with data:`, sourceData);
				handleSourceClick(sourceData);
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error parsing source data: ${error.message}`);
			}
		};
		
		// Set up event delegation for source button clicks
		const handleDocumentClick = (event) => {
			if (event.target && event.target.classList.contains('deeptutor-source-button')) {
				const sourceData = event.target.getAttribute('data-source-data');
				if (sourceData) {
					try {
						const decodedData = JSON.parse(decodeURIComponent(sourceData));
						Zotero.debug(`DeepTutorChatBox: Source button clicked via delegation:`, decodedData);
						handleSourceClick(decodedData);
					}
					catch (error) {
						Zotero.debug(`DeepTutorChatBox: Error parsing source data from button: ${error.message}`);
					}
				}
			}
		};
		
		// Add event listener to document
		document.addEventListener('click', handleDocumentClick);
		
		// Debug function for testing source button functionality
		window.testDeepTutorSourceButton = (sourceId, page = 1, referenceString = "test") => {
			const testSourceData = {
				index: sourceId - 1,
				refinedIndex: sourceId - 1,
				page: page,
				referenceString: referenceString,
				sourceAnnotation: {
					pageNum: page,
					startChar: 0,
					endChar: referenceString.length,
					success: true,
					similarity: 1.0
				}
			};
			Zotero.debug(`DeepTutorChatBox: Testing source button with data:`, testSourceData);
			handleSourceClick(testSourceData);
		};
		
		// Debug function for testing table with source buttons
		window.testDeepTutorTableWithSources = () => {
			const testTableWithSources = `
Here's a comparison table with source references:

| Metric | Value 1 | Value 2 | Reference |
|--------|---------|---------|-----------|
| Accuracy | 95.2% [<1>] | 89.7% [<2>] | Study A vs Study B |
| Precision | 0.92 [<1>] | 0.88 [<2>] | Measurement data |
| Recall | 0.89 | 0.85 [<3>] | Performance metrics |

The table above shows [<1>] the comparison results.
`;
			
			const testSources = [
				{
					index: 0,
					refinedIndex: 0,
					page: 15,
					referenceString: "accuracy measurement",
					sourceAnnotation: { pageNum: 15, startChar: 100, endChar: 120, success: true, similarity: 0.95 }
				},
				{
					index: 1,
					refinedIndex: 1,
					page: 23,
					referenceString: "precision data",
					sourceAnnotation: { pageNum: 23, startChar: 200, endChar: 220, success: true, similarity: 0.88 }
				},
				{
					index: 2,
					refinedIndex: 2,
					page: 31,
					referenceString: "recall metrics",
					sourceAnnotation: { pageNum: 31, startChar: 300, endChar: 320, success: true, similarity: 0.92 }
				}
			];
			
			const testMessage = {
				id: 'test-table-message',
				subMessages: [{
					text: testTableWithSources,
					sources: testSources,
					contentType: ContentType.TEXT
				}],
				role: MessageRole.TUTOR,
				creationTime: new Date().toISOString()
			};
			
			Zotero.debug(`DeepTutorChatBox: Testing table with source buttons using direct HTML approach`);
			setMessages(prev => [...prev, testMessage]);
		};
		
		// Debug function for testing simple tables without source buttons
		window.testDeepTutorTable = () => {
			const testTableText = `
Here's a comparison table for testing:

| Metric | Value A | Value B | Value C | Status |
|--------|---------|---------|---------|--------|
| Accuracy | 95.2% | 89.7% | 92.1% | Good |
| Precision | 0.92 | 0.88 | 0.90 | Excellent |
| Recall | 0.89 | 0.85 | 0.87 | Good |
| F1-Score | 0.905 | 0.865 | 0.885 | Very Good |

The table above shows performance metrics across different models.

## Another Table Example

| Feature | Description | Priority | Estimated Hours |
|---------|-------------|----------|-----------------|
| User Authentication | Login/logout functionality | High | 16 |
| Data Export | Export to CSV/PDF | Medium | 12 |
| Real-time Updates | Live data synchronization | Low | 24 |
| Mobile Support | Responsive design | Medium | 20 |

This demonstrates multiple table formats working correctly.
`;
			
			const testMessage = {
				id: 'test-simple-table-message',
				subMessages: [{
					text: testTableText,
					sources: [],
					contentType: ContentType.TEXT
				}],
				role: MessageRole.TUTOR,
				creationTime: new Date().toISOString()
			};
			
			Zotero.debug(`DeepTutorChatBox: Testing simple table without source buttons`);
			setMessages(prev => [...prev, testMessage]);
		};
		
		// Cleanup function
		return () => {
			document.removeEventListener('click', handleDocumentClick);
			if (window.handleDeepTutorSourceClick) {
				delete window.handleDeepTutorSourceClick;
			}
			if (window.testDeepTutorSourceButton) {
				delete window.testDeepTutorSourceButton;
			}
			if (window.testDeepTutorTableWithSources) {
				delete window.testDeepTutorTableWithSources;
			}
			if (window.testDeepTutorTable) {
				delete window.testDeepTutorTable;
			}
		};
	}, [sessionId, documentIds]); // Re-setup when session or documents change

	// Re-enable placeholder to button conversion now that XML parsing is fixed
	// Convert placeholder spans to actual buttons after React renders
	useEffect(() => {
		const convertPlaceholdersToButtons = () => {
			if (!chatLogRef.current) return;
			
			const placeholders = chatLogRef.current.querySelectorAll('.deeptutor-source-placeholder');
			Zotero.debug(`DeepTutorChatBox: Found ${placeholders.length} source placeholders to convert`);
			
			placeholders.forEach((placeholder) => {
				const sourceId = placeholder.getAttribute('data-source-id');
				const sourceIndex = parseInt(sourceId) - 1;
				const page = placeholder.getAttribute('data-page');
				
				// Get source data from Zotero.Prefs
				const storageKey = `deeptutor_source_${sessionId}_${sourceIndex}`;
				let sourceData;
				try {
					const sourceDataStr = Zotero.Prefs.get(storageKey);
					if (sourceDataStr) {
						sourceData = JSON.stringify(JSON.parse(sourceDataStr));
					}
				}
				catch (error) {
					Zotero.debug(`DeepTutorChatBox: Error retrieving source data from prefs: ${error.message}`);
				}
				
				// Create the button element
				const button = document.createElement('button');
				button.className = 'deeptutor-source-button';
				button.setAttribute('data-source-id', sourceId);
				if (sourceData) {
					button.setAttribute('data-source-data', encodeURIComponent(sourceData));
				}
				button.title = `Jump to source: Page ${page}`;
				button.textContent = sourceId;
				
				// Replace the placeholder with the button
				placeholder.parentNode.replaceChild(button, placeholder);
				
				Zotero.debug(`DeepTutorChatBox: Converted placeholder to button for source ${sourceId}`);
			});
		};
		
		// Convert placeholders after messages change
		const timeoutId = setTimeout(convertPlaceholdersToButtons, 100);
		
		return () => {
			clearTimeout(timeoutId);
		};
	}, [messages]); // Run after messages update

	// Function to adjust textarea height based on content
	const adjustTextareaHeight = () => {
		const textarea = textareaRef.current;
		if (textarea) {
			// Reset height to get the correct scrollHeight
			textarea.style.height = 'auto';
			
			// Calculate the new height
			const scrollHeight = textarea.scrollHeight;
			const maxHeight = 83; // 10rem converted to pixels (assuming 16px base)
			
			// For empty or single-line content, use a fixed minimum height
			// We detect single-line by checking if textarea value has newlines or if it's empty
			const isEmpty = !textarea.value.trim();
			const hasMultipleLines = textarea.value.includes('\n');
			
			let newHeight;
			
			if (isEmpty || (!hasMultipleLines && scrollHeight <= 50)) {
				// Use minimum height for empty or short single-line content
				newHeight = 24; // 1.5rem in pixels
				Zotero.debug(`DeepTutorChatBox: Using minimum height ${newHeight}px for single-line content`);
			}
			else {
				// Use scrollHeight for multi-line content, but cap at maxHeight
				newHeight = Math.min(scrollHeight, maxHeight);
				Zotero.debug(`DeepTutorChatBox: Using scroll height ${newHeight}px for multi-line content`);
			}
			
			textarea.style.height = newHeight + 'px';
			
			// Show/hide scrollbar based on content
			if (scrollHeight > maxHeight) {
				textarea.style.overflowY = 'scroll';
			}
			else {
				textarea.style.overflowY = 'hidden';
			}
		}
	};

	// Adjust textarea height on mount and when inputValue changes
	useEffect(() => {
		adjustTextareaHeight();
	}, [inputValue]);

	// Load recent sessions from preferences on component mount
	// useEffect(() => {
	// 	const loadRecentSessions = () => {
	// 		try {
	// 			const storedSessions = Zotero.Prefs.get('deeptutor.recentSessions');
	// 			if (storedSessions) {
	// 				const parsedSessions = JSON.parse(storedSessions);
	// 				const sessionsMap = new Map(Object.entries(parsedSessions));
	// 				setRecentSessions(sessionsMap);
	// 				Zotero.debug(`DeepTutorChatBox: Loaded ${sessionsMap.size} recent sessions from preferences`);
	// 			}
	// 		}
	// 		catch (error) {
	// 			Zotero.debug(`DeepTutorChatBox: Error loading recent sessions from preferences: ${error.message}`);
	// 		}
	// 	};
	// 	loadRecentSessions();
	// }, []);

	// Simple popup component
	const LoadingPopup = () => (
		<div style={{
			position: 'fixed',
			top: '50%',
			left: '50%',
			transform: 'translate(-50%, -50%)',
			background: 'white',
			padding: '20px',
			borderRadius: '8px',
			boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
			zIndex: 1000,
			textAlign: 'center',
			fontFamily: 'Roboto, sans-serif',
			minWidth: '200px',
		}}>
			<div style={{ marginBottom: '15px' }}>
                Please wait for 10 seconds
			</div>
			<button
				onClick={() => setIsLoading(false)}
				style={{
					background: '#0687E5',
					color: 'white',
					border: 'none',
					padding: '8px 16px',
					borderRadius: '4px',
					cursor: 'pointer',
					fontSize: '14px',
					fontWeight: 500,
					transition: 'background-color 0.2s',
					':hover': {
						background: '#0570c0'
					}
				}}
			>
                Close
			</button>
		</div>
	);

	// Handle session changes
	useEffect(() => {
		const loadSessionData = async () => {
			if (!currentSession?.id) {
				Zotero.debug(`DeepTutorChatBox: No current session ID available`);
				return;
			}

			try {
				Zotero.debug(`DeepTutorChatBox: Loading session data for session ${currentSession.id}`);
				// Update session and user IDs
				setSessionId(currentSession.id);
				setUserId(currentSession.userId);
				setDocumentIds(currentSession.documentIds || []);
				setcurSessionType(currentSession.type || SessionType.BASIC);

				// Update recent sessions immediately
				// Zotero.debug(`Current recent sessions TTT: ${JSON.stringify(recentSessions)}`);
				// await updateRecentSessions(currentSession.id);
				// Zotero.debug(`DeepTutorChatBox: Updated recent sessions for session ${currentSession.id}`);
				Zotero.debug(`DeepTutorChatBox: Current session type: ${currentSession.type}`);

				// Fetch document information
				const newDocumentFiles = [];
				for (const documentId of currentSession.documentIds || []) {
					try {
						const docData = await getDocumentById(documentId);
						newDocumentFiles.push(docData);
					}
					catch (error) {
						Zotero.debug(`DeepTutorChatBox: Error fetching document ${documentId}: ${error.message}`);
					}
				}
				Zotero.debug(`DeepTutorChatBox: ATTENTION New Document Files: ${JSON.stringify(newDocumentFiles)}`);
				setStoragePathsState(newDocumentFiles.map(doc => doc.storagePath));
				Zotero.debug(`DeepTutorChatBox: ATTENTION Storage Paths: ${JSON.stringify(storagePathsState)}`);
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error loading session data: ${error.message}`);
			}
		};

		loadSessionData();
	}, [currentSession]);

	// Handle conversation updates when sessionId changes
	useEffect(() => {
		if (!sessionId) return;

		setConversation(prev => ({
			...prev,
			userId: userId,
			sessionId: sessionId,
			documentIds: documentIds,
			history: [],
			message: null,
			streaming: true,
			type: curSessionType || SessionType.BASIC,
			storagePaths: storagePathsState
		}));
		Zotero.debug(`DeepTutorChatBox: Conversation state updated with sessionId: ${sessionId}, userId: ${userId}`);
	}, [sessionId, userId, documentIds, curSessionType, storagePathsState]);

	// Handle message updates
	useEffect(() => {
		const loadMessages = async () => {
			Zotero.debug(`DeepTutorChatBox: loadMessages useEffect triggered - sessionId: ${sessionId}`);
			if (!sessionId) {
				Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - No sessionId, returning early`);
				return;
			}

			try {
				Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Fetching messages for session ${sessionId}`);
				const sessionMessages = await getMessagesBySessionId(sessionId);
				Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Retrieved ${sessionMessages.length} messages for session ${sessionId}`);
				setMessages([]);
                
				if (sessionMessages.length > 0) {
					Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Session ${sessionId} has existing messages, processing them`);
					setLatestMessageId(sessionMessages[sessionMessages.length - 1].id);

                    
					// Process and append each message
					for (const [, message] of sessionMessages.entries()) {
						const sender = message.role === MessageRole.USER ? "You" : "DeepTutor";
						await _appendMessage(sender, message);
					}

					// Update conversation history with loaded messages
					setConversation(prev => ({
						...prev,
						history: sessionMessages
					}));
					Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Finished processing existing messages for session ${sessionId}`);
				}
				else {
					Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Session ${sessionId} is EMPTY, triggering automatic summary`);
					// Show loading popup
					setIsLoading(false);
					let shouldSendInitialMessage = true;
					setInitWait(true);
                    
					// Show loading message
					const loadingMessage = {
						id: null,
						parentMessageId: latestMessageId,
						userId: userId,
						sessionId: sessionId,
						subMessages: [{
							text: "Loading...Please wait for a few seconds",
							image: null,
							audio: null,
							contentType: ContentType.TEXT,
							creationTime: new Date().toISOString(),
							sources: []
						}],
						followUpQuestions: [],
						creationTime: new Date().toISOString(),
						lastUpdatedTime: new Date().toISOString(),
						status: MessageStatus.UNVIEW,
						role: MessageRole.TUTOR
					};
					Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Showing loading message for empty session ${sessionId}`);
					await _appendMessage("DeepTutor", loadingMessage);

					// Wait for 10 seconds
					Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Waiting 8 seconds before sending automatic summary for session ${sessionId}`);
					await new Promise(resolve => setTimeout(resolve, 8000));
                    
					// Clear messages
					setMessages([]);
                    
					// Check if we should proceed with initial message
					Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Checking if should send automatic summary: ${shouldSendInitialMessage} for session ${sessionId}`);
					if (shouldSendInitialMessage) {
						setIsLoading(false);
						// Send initial message
						Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - SENDING AUTOMATIC SUMMARY MESSAGE for empty session ${sessionId}`);
						await userSendMessage("Can you give me a summary of this document?");
						Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - AUTOMATIC SUMMARY MESSAGE SENT for session ${sessionId}`);
					}
					else {
						Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - Skipping automatic summary for session ${sessionId} (shouldSendInitialMessage=false)`);
					}
					setInitWait(false);
				}

				// Auto-scrolling is now handled by useEffect hooks
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - ERROR loading messages for session ${sessionId}: ${error.message}`);
				setIsLoading(false);
			}
		};

		Zotero.debug(`DeepTutorChatBox: loadMessages useEffect - About to call loadMessages() for sessionId: ${sessionId}`);
		loadMessages();
	}, [sessionId]);



	// Conversation state
	const [_conversation, setConversation] = useState({
		userId: null,
		sessionId: null,
		ragSessionId: null,
		storagePaths: [],
		history: [],
		message: null,
		streaming: true,
		type: curSessionType || SessionType.BASIC
	});

	// Auto-scroll when messages change
	useEffect(() => {
		if (chatLogRef.current && isAutoScrollingRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
			Zotero.debug(`DeepTutorChatBox: Auto-scrolled to bottom due to messages change`);
		}
		else if (chatLogRef.current) {
			Zotero.debug(`DeepTutorChatBox: Auto-scroll SKIPPED (disabled) on messages change`);
		}
	}, [messages]);

	// Auto-scroll during streaming
	useEffect(() => {
		if (chatLogRef.current && isAutoScrollingRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
			Zotero.debug(`DeepTutorChatBox: Auto-scrolled to bottom due to streaming change`);
		}
		else if (chatLogRef.current) {
			Zotero.debug(`DeepTutorChatBox: Auto-scroll SKIPPED (disabled) on streaming change`);
		}
	}, [messages, isStreaming]);

	// Handle manual scrolling - disable auto-scroll when user scrolls up
	const handleWheel = () => {
		if (chatLogRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = chatLogRef.current;
			const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100; // 100px tolerance
            
			// Only disable auto-scrolling if user is NOT at bottom
			if (!isAtBottom && isAutoScrollingRef.current) {
				isAutoScrollingRef.current = false;
				Zotero.debug(`DeepTutorChatBox: Auto-scrolling DISABLED by wheel event (not at bottom)`);
			}
			else if (isAtBottom) {
				Zotero.debug(`DeepTutorChatBox: Wheel event ignored - still at bottom`);
			}
		}
	};

	// Handle scroll to detect if user scrolled back to bottom
	const handleScroll = () => {
		if (chatLogRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = chatLogRef.current;
			const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100; // 100px tolerance
			Zotero.debug(`DeepTutorChatBox: Scroll - scrollHeight: ${scrollHeight}, scrollTop: ${scrollTop}, clientHeight: ${clientHeight}, isAtBottom: ${isAtBottom}, autoScroll: ${isAutoScrollingRef.current}`);
            
			if (isAtBottom && !isAutoScrollingRef.current) {
				isAutoScrollingRef.current = true;
				Zotero.debug(`DeepTutorChatBox: Auto-scrolling RE-ENABLED by scroll to bottom`);
			}
		}
	};

	const userSendMessage = async (messageString) => {
		Zotero.debug(`DeepTutorChatBox: userSendMessage CALLED with message: "${messageString}" for session ${sessionId}`);
		if (!messageString.trim()) {
			Zotero.debug(`DeepTutorChatBox: userSendMessage - Message is empty, returning early`);
			return;
		}
		// TODO_DEEPTUTOR: Get user ID from Cognito user attributes, such as sending user object/userid from DeepTutor.jsx
		setUserId("67f5b836cb8bb15b67a1149e");
        
		// Always enable auto-scrolling when user sends a message (which will trigger streaming)
		isAutoScrollingRef.current = true;
		Zotero.debug(`DeepTutorChatBox: Auto-scrolling enabled for new user message`);

		try {
			if (!sessionId) throw new Error("No active session ID");
			if (!userId) throw new Error("No active user ID");
			Zotero.debug(`DeepTutorChatBox: userSendMessage - Validated sessionId: ${sessionId}, userId: ${userId}`);
			Zotero.debug(`DeepTutorChatBox: userSendMessage - Message content: "${messageString}"`);

			// Create user message with proper structure
			Zotero.debug(`DeepTutorChatBox: userSendMessage - Creating message structure for API request`);
			const userMessage = {
				id: null,
				parentMessageId: latestMessageId,
				userId: userId,
				sessionId: sessionId,
				subMessages: [{
					text: messageString,
					image: null,
					audio: null,
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				followUpQuestions: [],
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.UNVIEW,
				role: MessageRole.USER
			};

			// Add user message to state and append to chatbox
			// if it is the first message, don't append it to the chatbox
			Zotero.debug(`DeepTutorChatBox: userSendMessage - Appending user message to chat`);
			await _appendMessage("You", userMessage);
			setLatestMessageId(userMessage.id);

			// Send to API and handle response
			Zotero.debug(`DeepTutorChatBox: userSendMessage - Sending message to API`);
			const _response = await sendToAPI(userMessage);
			Zotero.debug(`DeepTutorChatBox: userSendMessage - Received response from API`);


			// Auto-scrolling is handled by useEffect hooks
		}
		catch (error) {
			Zotero.debug(`DeepTutorChatBox: userSendMessage - ERROR sending message "${messageString}": ${error.message}`);
			// Create error message
			const errorMessage = {
				subMessages: [{
					text: "I apologize, but I encountered an error processing your request. Please try again.",
					image: null,
					audio: null,
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				role: MessageRole.TUTOR,
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.PROCESSING_ERROR
			};
			await _appendMessage("DeepTutor", errorMessage);
		}
	};

	const handleInputChange = (e) => {
		setInputValue(e.target.value);
		// Adjust height after the value is set
		setTimeout(adjustTextareaHeight, 0);
	};

	const handleSend = async () => {
		const trimmedValue = inputValue.trim(); // Remove both leading and trailing spaces
		if (trimmedValue) { // Only send if there's actual content after trimming
			setInputValue('');
			// Reset textarea height after clearing
			setTimeout(adjustTextareaHeight, 0);
			await userSendMessage(trimmedValue);
		}
		else {
			setInputValue(''); // Clear input even if empty
			// Reset textarea height after clearing
			setTimeout(adjustTextareaHeight, 0);
		}
	};

	const sendToAPI = async (message) => {
		try {
			setIsStreaming(true); // Set streaming to true at start
			isAutoScrollingRef.current = true; // Re-enable auto-scrolling for new stream
			Zotero.debug(`DeepTutorChatBox: Auto-scrolling FORCE ENABLED for streaming`);
			// Send message to API
			const responseData = await createMessage(message);
			Zotero.debug(`DeepTutorChatBox: Create Message Response from API: ${JSON.stringify(responseData)}`);
			const newDocumentFiles2 = [];
			for (const documentId of currentSession.documentIds || []) {
				try {
					const docData = await getDocumentById(documentId);
					newDocumentFiles2.push(docData);
				}
				catch (error) {
					Zotero.debug(`DeepTutorChatBox: Error fetching document ${documentId}: ${error.message}`);
				}
			}
			Zotero.debug(`DeepTutorChatBox: ATTENTION New Document Files: ${JSON.stringify(newDocumentFiles2)}`);
            
			// Update conversation state
			const newState = new Conversation({
				userId: userId,
				sessionId: sessionId,
				ragSessionId: null,
				storagePaths: newDocumentFiles2.map(doc => doc.storagePath),
				history: messages,
				message: responseData,
				streaming: true,
				type: curSessionType || SessionType.BASIC
			});
            
			setConversation(newState);

			// Subscribe to chat stream with timeout
			Zotero.debug(`DeepTutorChatBox: Subscribing to chat with conversation: ${JSON.stringify(newState)}`);
            
			const streamResponse = await subscribeToChat(newState);
			Zotero.debug(`DeepTutorChatBox: Stream Response from API: ${JSON.stringify(streamResponse)}`);

			if (!streamResponse.ok) {
				setIsStreaming(false); // Set streaming to false on error
				throw new Error(`Stream request failed: ${streamResponse.status}`);
			}
            
			if (!streamResponse.body) {
				setIsStreaming(false); // Set streaming to false if no body
				throw new Error('Stream response body is null');
			}

			const reader = streamResponse.body.getReader();
			const decoder = new TextDecoder();
			let streamText = "";
			let hasReceivedData = false;
			let lastDataTime = Date.now();

			// Create initial streaming message for TUTOR
			Zotero.debug(`DeepTutorChatBox: Creating initial streaming message for TUTOR`);
			const initialStreamingMessage = {
				subMessages: [{
					text: "",
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				role: MessageRole.TUTOR,
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.UNVIEW,
				isStreaming: true,
				streamText: ""
			};
            
			// Add the streaming message to messages
			await new Promise((resolve) => {
				setMessages((prev) => {
					resolve();
					return [...prev, initialStreamingMessage];
				});
			});

			while (true) {
				const { done, value } = await reader.read();
                
				// Check for timeout
				if (Date.now() - lastDataTime > 300000) {
					setIsStreaming(false); // Set streaming to false on timeout
					throw new Error('Stream timeout - no data received for 300 seconds');
				}
                
				if (done) {
					if (!hasReceivedData) {
						setIsStreaming(false); // Set streaming to false if no data received
						throw new Error('Stream closed without receiving any data');
					}
					break;
				}

				lastDataTime = Date.now();
				const data = decoder.decode(value);
                
				data.split('\n\n').forEach((event) => {
					if (!event.startsWith('data:')) return;

					const jsonStr = event.slice(5);
					// Skip empty or whitespace-only strings
					if (!jsonStr || !jsonStr.trim()) return;

					try {
						const parsed = JSON.parse(jsonStr);
						const output = parsed.msg_content;
						Zotero.debug(`DeepTutorChatBox: Received data: ${output}`);
						if (output && output.length > 0) {
							hasReceivedData = true;
							streamText += output;
                            
							// Create a temporary streaming message to display the stream
							const streamMessage = {
								subMessages: [{
									text: streamText,
									contentType: ContentType.TEXT,
									creationTime: new Date().toISOString(),
									sources: []
								}],
								role: MessageRole.TUTOR,
								creationTime: new Date().toISOString(),
								lastUpdatedTime: new Date().toISOString(),
								status: MessageStatus.UNVIEW,
								isStreaming: true,
								streamText: streamText
							};

							// Update the last message in the chat
							setMessages((prev) => {
								const newMessages = [...prev];
								newMessages[newMessages.length - 1] = streamMessage;
								return newMessages;
							});
						}
					}
					catch (error) {
						Zotero.debug('DeepTutorChatBox: Error parsing SSE data:', error);
					}
				});
			}

			// Fetch message history for the session
			Zotero.debug(`DeepTutorChatBox: Waiting 3 seconds before fetching message history`);
			await new Promise(resolve => setTimeout(resolve, 3000));
            
			Zotero.debug(`DeepTutorChatBox: Fetching message history for session ${sessionId}`);
			const historyData = await getMessagesBySessionId(sessionId);
			setMessages(historyData);
			setLatestMessageId(historyData[historyData.length - 1].id);
			Zotero.debug(`DeepTutorChatBox: FINAL History Data: ${JSON.stringify(historyData)}`);

			// Update conversation with the latest history
			setConversation(prev => ({
				...prev,
				history: historyData,
			}));
            
			// Get only the last message from the response
			const lastMessage = historyData.length > 0 ? historyData[historyData.length - 2] : null;
			setIsStreaming(false); // Set streaming to false when done
			return lastMessage;
		}
		catch (error) {
			setIsStreaming(false); // Set streaming to false on any error
			Zotero.debug(`DeepTutorChatBox: Error in sendToAPI: ${error.message}`);
			
			// Even on error, try to fetch message history to ensure UI consistency
			try {
				Zotero.debug(`DeepTutorChatBox: Attempting to fetch message history after error`);
				await new Promise(resolve => setTimeout(resolve, 1000)); // Shorter wait for error case
				
				const historyData = await getMessagesBySessionId(sessionId);
				if (historyData && historyData.length > 0) {
					setMessages(historyData);
					setLatestMessageId(historyData[historyData.length - 1].id);
					Zotero.debug(`DeepTutorChatBox: Successfully fetched message history after error: ${historyData.length} messages`);
					
					// Update conversation with the latest history
					setConversation(prev => ({
						...prev,
						history: historyData,
					}));
				} else {
					Zotero.debug(`DeepTutorChatBox: No message history found after error`);
				}
			} catch (historyError) {
				Zotero.debug(`DeepTutorChatBox: Error fetching message history after timeout: ${historyError.message}`);
			}
			
			throw error;
		}
	};



	const _appendMessage = async (sender, message) => {
		Zotero.debug(`DeepTutorChatBox: Appending message from ${sender}`);
        
		// Process subMessages
		if (message.subMessages && message.subMessages.length > 0) {
			Zotero.debug(`DeepTutorChatBox: Processing ${message.subMessages.length} subMessages for ${sender}`);
            
			// Create a new message object with processed subMessages
			const processedMessage = {
				...message,
				subMessages: await Promise.all(message.subMessages.map(async (subMessage) => {
					// Process sources if they exist
					if (subMessage.sources && subMessage.sources.length > 0) {
						// Annotation workflow removed — simply pass sources through unchanged
						return {
							...subMessage,
							sources: subMessage.sources
						};
					}
					return subMessage;
				}))
			};

			// Update messages state with only the new message
			setMessages(prev => [...prev, processedMessage]);
			// Update conversation with only the new message
			setConversation(prev => ({
				...prev,
				message: processedMessage
			}));

			// Auto-scrolling is handled by useEffect hooks
		}
	};

	const handleQuestionClick = async (question) => {
		// Set the input value to the question
		Zotero.debug(`DeepTutorChatBox: Handling question click: ${question}`);
		// Trigger send
		Zotero.debug(`DeepTutorChatBox: Triggering send`);
		await userSendMessage(question);
	};

	const handleContextButtonClick = () => {
		Zotero.debug(`DeepTutorChatBox: Context button clicked, current popup state: ${showContextPopup}`);
		setShowContextPopup(!showContextPopup);
	};

	const handleContextDocumentClick = async (contextDoc) => {
		Zotero.debug(`DeepTutorChatBox: Context document clicked: ${contextDoc.name} (ID: ${contextDoc.zoteroAttachmentId})`);
        
		try {
			// Get the item and open it
			const item = Zotero.Items.get(contextDoc.zoteroAttachmentId);
			if (!item) {
				Zotero.debug(`DeepTutorChatBox: No item found for ID ${contextDoc.zoteroAttachmentId}`);
				return;
			}

			// Open the document in the reader at first page
			await Zotero.FileHandlers.open(item, {
				location: {
					pageIndex: 0 // Start at first page
				}
			});
			Zotero.debug(`DeepTutorChatBox: Opened document ${contextDoc.name} in reader`);
            
			// Close the popup after opening document
			setShowContextPopup(false);
		}
		catch (error) {
			Zotero.debug(`DeepTutorChatBox: Error opening context document: ${error.message}`);
			Zotero.debug(`DeepTutorChatBox: Error stack: ${error.stack}`);
		}
	};



	// Format response text for markdown rendering
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
		// Replacement for source span identifier
		Zotero.debug(`3TESTTESTTEST DeepTutorChatBox: formatResponseForMarkdown - Replacing source span identifiers ${cleanText}`);
		cleanText = cleanText.replace(/\[<(\d{1,2})>\]/g, (match, sourceId) => {
			const sourceIndex = parseInt(sourceId) - 1; // Convert to 0-based index
			
			Zotero.debug(`DeepTutorChatBox: Processing source reference: ${match}, sourceId: ${sourceId}, sourceIndex: ${sourceIndex}`);
			
			// Get the source data from subMessage.sources
			if (subMessage && subMessage.sources && subMessage.sources[sourceIndex]) {
				const source = subMessage.sources[sourceIndex];
				
				// Store source data in Zotero.Prefs
				const storageKey = `deeptutor_source_${sessionId}_${sourceIndex}`;
				const sourceData = {
					index: source.index || sourceIndex,
					refinedIndex: source.refinedIndex !== undefined ? source.refinedIndex : source.index || sourceIndex,
					page: source.page || 1,
					referenceString: source.referenceString || '',
					sourceAnnotation: source.sourceAnnotation || {}
				};
				Zotero.Prefs.set(storageKey, JSON.stringify(sourceData));
				
				// Add sourceIndex to tracking state
				if (!currentSourceIndices.includes(sourceIndex)) {
					setCurrentSourceIndices(prev => [...prev, sourceIndex]);
				}
				
				// Create HTML span with minimal data
				const htmlSpan = `<span class="deeptutor-source-placeholder" data-source-id="${sourceId}" data-page="${source.page || 'Unknown'}">[${sourceId}]</span>`;
				Zotero.debug(`DeepTutorChatBox: Generated HTML span for source ${sourceId}: "${htmlSpan}"`);
				return htmlSpan;
			}
			else {
				// Fallback if source not found
				const storageKey = `deeptutor_source_${sessionId}_${sourceIndex}`;
				const fallbackData = {
					index: sourceIndex,
					refinedIndex: sourceIndex,
					page: 1,
					referenceString: '',
					sourceAnnotation: {}
				};
				Zotero.Prefs.set(storageKey, JSON.stringify(fallbackData));
				
				// Add sourceIndex to tracking state
				if (!currentSourceIndices.includes(sourceIndex)) {
					setCurrentSourceIndices(prev => [...prev, sourceIndex]);
				}
				
				const htmlSpan = `<span class="deeptutor-source-placeholder" data-source-id="${sourceId}" data-page="Unknown">[${sourceId}]</span>`;
				Zotero.debug(`DeepTutorChatBox: Generated fallback HTML span for source ${sourceId}: "${htmlSpan}"`);
				return htmlSpan;
			}
		});
		Zotero.debug(`4TESTTESTTEST DeepTutorChatBox: formatResponseForMarkdown - Clean text after source span replacement: ${cleanText}`);

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
		
		// Now apply mathematical symbol processing and source processing to the clean text
		let formattedText = cleanText;

		// Replace inline math-like expressions (e.g., \( u \)) with proper Markdown math
		formattedText = formattedText.replace(/\\\((.+?)\\\)/g, '$$$1$$');

		// Replace block math-like expressions (e.g., \[ ... \]) with proper Markdown math
		formattedText = formattedText.replace(
			/\\\[([\s\S]+?)\\\]/g,
			'$$$$\n$1\n$$$$',
		);

		// Apply additional mathematical symbol processing for non-KaTeX expressions
		/*
		formattedText = formattedText
			// Convert Ca$^{2+}$ to Ca<sup>2+</sup>
			.replace(/Ca\$\^\{?2\+\}\$?/g, 'Ca<sup>2+</sup>')
			// Convert other LaTeX superscripts: $^{text}$ to <sup>text</sup>
			.replace(/\$\^\{([^}]+)\}\$/g, '<sup>$1</sup>')
			// Convert standalone superscripts: $^text$ to <sup>text</sup>
			.replace(/\$\^([a-zA-Z0-9\+\-]+)\$/g, '<sup>$1</sup>')
			// Convert Greek letters to HTML entities
			.replace(/β/g, '&beta;')
			.replace(/α/g, '&alpha;')
			.replace(/γ/g, '&gamma;')
			.replace(/δ/g, '&delta;')
			.replace(/ε/g, '&epsilon;')
			.replace(/θ/g, '&theta;')
			.replace(/λ/g, '&lambda;')
			.replace(/μ/g, '&mu;')
			.replace(/π/g, '&pi;')
			.replace(/ρ/g, '&rho;')
			.replace(/σ/g, '&sigma;')
			.replace(/τ/g, '&tau;')
			.replace(/φ/g, '&phi;')
			.replace(/χ/g, '&chi;')
			.replace(/ψ/g, '&psi;')
			.replace(/ω/g, '&omega;')
			// Convert any remaining standalone $ to HTML entity (only for non-math expressions)
			.replace(/\$(?!\$)/g, '&#36;')
			// Convert standalone ^ to HTML entity (for any remaining cases)
			.replace(/\^/g, '&#94;');
		*/
		Zotero.debug(`DeepTutorChatBox: formatResponseForMarkdown - Original text length: ${text.length}, Clean text length: ${cleanText.length}`);
		Zotero.debug(`DeepTutorChatBox: formatResponseForMarkdown - Removed custom tags and processed for XML compatibility`);
		Zotero.debug(`DeepTutorChatBox: formatResponseForMarkdown - Available sources: ${subMessage?.sources?.length || 0}`);
		
		Zotero.debug(`DeepTutorChatBox: formatResponseForMarkdown - Final formatted text length: ${formattedText.length}`);
		return formattedText;
	};

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
					Zotero.debug(`DeepTutorChatBox: Successfully loaded and using xmldom package for DOM parsing`);
				}
				else {
					Zotero.debug(`DeepTutorChatBox: xmldom package loaded but missing DOMParser/XMLSerializer`);
				}
			}
			catch (e) {
				Zotero.debug(`DeepTutorChatBox: xmldom package not available or failed to load: ${e.message}`);
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
						Zotero.debug(`DeepTutorChatBox: Components.classes DOMParser not available: ${e.message}`);
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
				Zotero.debug(`DeepTutorChatBox: Preprocessed HTML for XML compatibility`);
				
				// Debug: Show what parser type we're using
				if (parser.constructor && parser.constructor.name) {
					Zotero.debug(`DeepTutorChatBox: Using parser type: ${parser.constructor.name}`);
				}
				
				// Debug: Show the HTML being parsed (truncated for readability)
				if (wrappedHtml.length > 500) {
					Zotero.debug(`DeepTutorChatBox: Parsing HTML content (${wrappedHtml.length} chars, first 500): ${wrappedHtml.substring(0, 500)}...`);
				}
				else {
					Zotero.debug(`DeepTutorChatBox: Parsing HTML content (${wrappedHtml.length} chars): ${wrappedHtml}`);
				}
				
				try {
					// Try parsing as HTML first, then convert to XML
					let doc = null;
					
					// First attempt: Parse as HTML (if the parser supports it)
					if (parser.parseFromString) {
						try {
							doc = parser.parseFromString(wrappedHtml, 'text/html');
							Zotero.debug(`DeepTutorChatBox: Successfully parsed as HTML`);
						}
						catch (htmlError) {
							Zotero.debug(`DeepTutorChatBox: HTML parsing failed: ${htmlError.message}`);
						}
					}
					
					// Second attempt: Parse as XML if HTML parsing failed or not supported
					if (!doc || !doc.documentElement || doc.documentElement.tagName === 'parsererror') {
						try {
							doc = parser.parseFromString(wrappedHtml, 'application/xml');
							Zotero.debug(`DeepTutorChatBox: Parsed as XML`);
							
							// Check if parsing was successful (no parsererror elements)
							const parseError = doc.querySelector ? doc.querySelector('parsererror') : null;
							if (parseError) {
								throw new Error('XML parsing failed');
							}
						}
						catch (xmlError) {
							Zotero.debug(`DeepTutorChatBox: XML parsing also failed: ${xmlError.message}`);
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
					
					Zotero.debug(`DeepTutorChatBox: Successfully converted HTML to XML using DOM parser and cleaned whitespace`);
					return result;
				}
				catch (domError) {
					Zotero.debug(`DeepTutorChatBox: DOM parsing failed: ${domError.message}, falling back to regex`);
					throw domError;
				}
			}
			else {
				// No DOM parsing available, skip to regex
				throw new Error('No DOM parsing APIs available');
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutorChatBox: DOM parsing failed, using enhanced regex fallback: ${error.message}`);
			
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
				Zotero.debug(`DeepTutorChatBox: Enhanced regex processing made changes to HTML`);
				const changes = [];
				selfClosingTagPatterns.forEach(({ tag }) => {
					if (html.includes(`<${tag}`) && processedHtml.includes(`<${tag}`)
						&& !html.includes(`<${tag}`) === processedHtml.includes(`<${tag}/>`)) {
						changes.push(`${tag} tags made self-closing`);
					}
				});
				if (changes.length > 0) {
					Zotero.debug(`DeepTutorChatBox: Specific changes: ${changes.join(', ')}`);
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
			
			Zotero.debug(`DeepTutorChatBox: Enhanced regex processing completed with whitespace cleanup`);
			return processedHtml;
		}
	};
	const handleSourceClick = async (source) => {
		if (!source) {
			Zotero.debug("DeepTutorChatBox: Source button clicked with empty source object");
			return;
		}

		// Determine which attachment the source refers to
		const docIdx
            = (source.refinedIndex !== undefined && source.refinedIndex !== null)
            	? source.refinedIndex
            	: source.index;

		if (docIdx === undefined || docIdx === null || docIdx < 0 || docIdx >= documentIds.length) {
			Zotero.debug(`DeepTutorChatBox: Invalid source index (index=${source.index}, refinedIndex=${source.refinedIndex})`);
			return;
		}

		const attachmentId = documentIds[docIdx];
		if (!attachmentId) {
			Zotero.debug(`DeepTutorChatBox: No attachment ID found for docIdx ${docIdx}`);
			return;
		}

		Zotero.debug(`DeepTutorChatBox: Source button clicked for attachment ${attachmentId}, page ${source.page}`);

		try {
			const storageKey = `deeptutor_mapping_${sessionId}`;
			let zoteroAttachmentId = attachmentId;

			const mappingStr = Zotero.Prefs.get(storageKey);
			if (mappingStr) {
				const mapping = JSON.parse(mappingStr);
				if (mapping[attachmentId]) {
					zoteroAttachmentId = mapping[attachmentId];
				}
			}

			const item = Zotero.Items.get(zoteroAttachmentId);
			if (!item) {
				Zotero.debug(`DeepTutorChatBox: No item found for ID ${zoteroAttachmentId}`);
				return;
			}

			// Open the PDF on the correct page
			await Zotero.FileHandlers.open(item, {
				location: { pageIndex: source.page - 1 }
			});
			Zotero.debug(`DeepTutorChatBox: Opened PDF at page ${source.page}`);

			// Get the reader instance for the current tab
			const reader = Zotero.Reader.getByTabID(Zotero.getMainWindow().Zotero_Tabs.selectedID);
			if (!reader) {
				Zotero.debug("DeepTutorChatBox: No reader instance found");
				return;
			}
			
			// Use the new public setFindQuery method
			const searchQuery = source.referenceString || "test";
			Zotero.debug(`DeepTutorChatBox: Setting find query to "${searchQuery}"`);
			
			reader._internalReader.setFindQuery(searchQuery, {
				primary: true,
				openPopup: false,
				activateSearch: true
			});
			
			Zotero.debug(`DeepTutorChatBox: Successfully set find query and activated search`);
		}
		catch (error) {
			Zotero.debug(`DeepTutorChatBox: Error handling source click: ${error.message}`);
		}
	};

	const renderMessage = (message, index) => {
		// Return nothing if it's the first message and from user
		if (index === 0 && message.role === MessageRole.USER) {
			return null;
		}
        
		const isUser = message.role === MessageRole.USER;
		const _messageStyle = {
			...styles.messageContainer,
			animation: "fadeIn 0.3s ease-in-out"
		};
        
		// Handle streaming messages for TUTOR role
		if (!isUser && message.isStreaming && message.streamText) {
			return (
				<div key={message.id || index} style={styles.messageContainer}>
					<DeepTutorStreamingComponent
						streamText={message.streamText || ''}
						hideStreamResponse={false}
					/>
				</div>
			);
		}
        
		return (
			<div key={message.id || index} style={styles.messageStyle}>
				<div style={{
					...styles.messageBubble,
					...(isUser ? styles.userMessage : styles.botMessage),
					animation: "slideIn 0.3s ease-out",
					...(isUser && { display: 'flex', alignItems: 'flex-start', gap: '0.5rem' })
				}}>
					{/* Add user message icon inside the bubble for user messages */}
					{isUser && <DeepTutorUserMessage />}
					{message.subMessages.map((subMessage, subIndex) => {
						const text = formatResponseForMarkdown(subMessage.text || "", subMessage);
						try {
							Zotero.debug(`DeepTutorChatBox: About to render markdown for subMessage ${subIndex}, text length: ${text.length}`);
							var result = md.render(text);
							Zotero.debug(`DeepTutorChatBox: Markdown render result length: ${result.length}`);
							// Zotero.debug(`DeepTutorChatBox: Markdown render result (first 1000 chars): ${result.substring(0, 1000)}`);
							
							// Process through DOM-based XML conversion
							const processedResult = processMarkdownResult(result);
							Zotero.debug(`DeepTutorChatBox: DOM-processed result length: ${processedResult.length}`);
							Zotero.debug(`DeepTutorChatBox: DOM-processed result (first 1000 chars): ${processedResult.substring(0, 1000)}`);
							
							// Compare HTML vs XML conversion with enhanced logging
							if (result !== processedResult) {
								Zotero.debug(`1234567890 DeepTutorChatBox: DOM XML conversion made changes - detailed comparison:`);
								Zotero.debug(`1234567890 DeepTutorChatBox: Original HTML (${result.length} chars): ${result}`);
								Zotero.debug(`1234567890 DeepTutorChatBox: DOM-converted XML (${processedResult.length} chars): ${processedResult}`);
								
								// Try to identify specific differences
								const differences = [];
								if (result.includes('<br>') && processedResult.includes('<br/>')) {
									differences.push('br tags converted to self-closing');
								}
								if (result.includes('<hr>') && processedResult.includes('<hr/>')) {
									differences.push('hr tags converted to self-closing');
								}
								if (result.includes('<img') && !result.includes('/>') && processedResult.includes('/>')) {
									differences.push('img tags converted to self-closing');
								}
								if (differences.length > 0) {
									Zotero.debug(`1234567890 DeepTutorChatBox: Specific changes detected: ${differences.join(', ')}`);
								}
							}
							else {
								Zotero.debug(`DeepTutorChatBox: DOM XML conversion made no changes - HTML was already XML-compatible`);
							}
							
							return (
								<div key={subIndex} style={styles.messageText}>
									{/* Render text content through markdown-it with DOM-processed XML */}
									{processedResult ? (
										<div
											className="markdown mb-0 flex flex-col"
											dangerouslySetInnerHTML={{
												__html: (() => {
													try {
														// Final validation before rendering
														if (typeof processedResult !== 'string' || processedResult.trim() === '') {
															Zotero.debug(`DeepTutorChatBox: Invalid processedResult, falling back to plain text`);
															return null;
														}
														Zotero.debug(`DeepTutorChatBox: Successfully preparing DOM-processed content for React rendering`);
														return processedResult;
													}
													catch (error) {
														Zotero.debug(`DeepTutorChatBox: Error preparing content for React: ${error.message}`);
														return null;
													}
												})()
											}}
											style={{
												fontSize: "14px",
												lineHeight: "1.5",
												wordBreak: "break-word",
												overflowWrap: "break-word"
											}}
										/>
									) : (
										<div style={{
											fontSize: "14px",
											lineHeight: "1.5",
											wordBreak: "break-word",
											overflowWrap: "break-word"
										}}>
											{subMessage.text || ""}
										</div>
									)}
								</div>
							);
						}
						catch (error) {
							// Zotero.debug(`DeepTutorChatBox: Error processing markdown: ${error.message}`);
							// Zotero.debug(`DeepTutorChatBox: Error stack: ${error.stack}`);
							// Fallback to plain text if markdown processing fails
							return (
								<div key={subIndex} style={styles.messageText}>
									<div style={{
										fontSize: "16px",
										lineHeight: "1.5",
										wordBreak: "break-word",
										overflowWrap: "break-word"
									}}>
										{subMessage.text || ""}
									</div>
								</div>
							);
						}
					})}
				</div>
				{index === messages.length - 1 && message.followUpQuestions && message.followUpQuestions.length > 0 && (
					<div>
						<div style={styles.followUpQuestionText}>
							Follow-up Questions
						</div>
						<div style={styles.questionContainer}>
							{message.followUpQuestions.map((question, qIndex) => (
								<button
									key={qIndex}
									style={{
										...styles.questionButton,
										background: hoveredQuestion === qIndex ? "#D9D9D9" : "#FFFFFF"
									}}
									onClick={() => handleQuestionClick(question)}
									onMouseEnter={() => setHoveredQuestion(qIndex)}
									onMouseLeave={() => setHoveredQuestion(null)}
								>
									{question}
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		);
	};



	// Add new useEffect after the existing one
	useEffect(() => {
		const openAllDocuments = async () => {
			if (documentIds && documentIds.length > 0 && sessionId) {
				Zotero.debug(`DeepTutorChatBox: Opening all documents - sessionId: ${sessionId}, ${documentIds.length} documents`);
                
				// Try to get the mapping from local storage
				const storageKey = `deeptutor_mapping_${sessionId}`;
				const mappingStr = Zotero.Prefs.get(storageKey);
				let mapping = {};
				
				if (mappingStr) {
					mapping = JSON.parse(mappingStr);
					Zotero.debug(`DeepTutorChatBox: Found mapping in storage: ${JSON.stringify(mapping)}`);
				}

				// Open all documents in order
				for (let i = 0; i < documentIds.length; i++) {
					const documentId = documentIds[i];
					try {
						let zoteroAttachmentId = documentId;

						// If we have a mapping for this document ID, use it
						if (mapping[documentId]) {
							zoteroAttachmentId = mapping[documentId];
							Zotero.debug(`DeepTutorChatBox: Using mapped attachment ID: ${zoteroAttachmentId} for document ${documentId}`);
						}

						// Get the item and open it
						const item = Zotero.Items.get(zoteroAttachmentId);
						if (!item) {
							Zotero.debug(`DeepTutorChatBox: No item found for ID ${zoteroAttachmentId}`);
							continue; // Skip this document and continue with the next one
						}

						// Open the document in the reader
						await Zotero.FileHandlers.open(item, {
							location: {
								pageIndex: 0 // Start at first page
							}
						});
						Zotero.debug(`DeepTutorChatBox: Opened document ${i + 1}/${documentIds.length}: ${zoteroAttachmentId} in reader`);
						
						// Add a small delay between opening documents to avoid overwhelming the UI
						if (i < documentIds.length - 1) {
							await new Promise(resolve => setTimeout(resolve, 500));
						}
					}
					catch (error) {
						Zotero.debug(`DeepTutorChatBox: Error opening document ${documentId}: ${error.message}`);
						Zotero.debug(`DeepTutorChatBox: Error stack: ${error.stack}`);
						// Continue with the next document even if this one fails
					}
				}
				
				Zotero.debug(`DeepTutorChatBox: Finished opening all ${documentIds.length} documents`);
			}
		};
		openAllDocuments();
	}, [documentIds, sessionId]); // Dependencies array

	// Load context documents when documentIds change
	useEffect(() => {
		const loadContextDocuments = async () => {
			if (!documentIds || documentIds.length === 0 || !sessionId) {
				Zotero.debug(`DeepTutorChatBox: No documentIds or sessionId available for context loading`);
				setContextDocuments([]);
				return;
			}

			Zotero.debug(`DeepTutorChatBox: Loading context documents for ${documentIds.length} documents`);
            
			try {
				// Try to get the mapping from local storage
				const storageKey = `deeptutor_mapping_${sessionId}`;
				const mappingStr = Zotero.Prefs.get(storageKey);
				let mapping = {};
                
				if (mappingStr) {
					mapping = JSON.parse(mappingStr);
					Zotero.debug(`DeepTutorChatBox: Found mapping in storage: ${JSON.stringify(mapping)}`);
				}

				const contextDocs = [];
				for (const documentId of documentIds) {
					try {
						// Get the actual Zotero attachment ID
						let zoteroAttachmentId = documentId;
						if (mapping[documentId]) {
							zoteroAttachmentId = mapping[documentId];
							Zotero.debug(`DeepTutorChatBox: Using mapped attachment ID: ${zoteroAttachmentId} for document ${documentId}`);
						}

						// Try to get the Zotero item to get the document name and path
						const item = Zotero.Items.get(zoteroAttachmentId);
						let documentName = documentId; // fallback to documentId
						let filePath = null;

						if (item) {
							// Prioritize attachment filename first
							if (item.attachmentFilename) {
								documentName = item.attachmentFilename;
								Zotero.debug(`DeepTutorChatBox: Using attachment filename: ${documentName}`);
							}
							// Fall back to display title if no filename
							else if (item.getDisplayTitle) {
								documentName = item.getDisplayTitle();
								Zotero.debug(`DeepTutorChatBox: Found item title: ${documentName}`);
							}
							// Finally try parent item title
							else if (item.parentItem) {
								const parentItem = Zotero.Items.get(item.parentItem);
								if (parentItem && parentItem.getDisplayTitle) {
									documentName = parentItem.getDisplayTitle();
									Zotero.debug(`DeepTutorChatBox: Found parent item title: ${documentName}`);
								}
							}

							// Get the file path if it's an attachment
							if (item.isAttachment && item.isAttachment()) {
								try {
									filePath = await item.getFilePathAsync();
									if (filePath) {
										Zotero.debug(`DeepTutorChatBox: Found file path: ${filePath}`);
										// Optionally truncate long paths for display
										const maxPathLength = 60;
										if (filePath.length > maxPathLength) {
											const pathParts = filePath.split(/[/\\]/);
											const filename = pathParts[pathParts.length - 1];
											const pathPrefix = filePath.substring(0, maxPathLength - filename.length - 3);
											filePath = pathPrefix + '...' + filename;
										}
									}
								}
								catch (error) {
									Zotero.debug(`DeepTutorChatBox: Error getting file path for ${zoteroAttachmentId}: ${error.message}`);
								}
							}
						}
						else {
							Zotero.debug(`DeepTutorChatBox: No item found for ID ${zoteroAttachmentId}, using document ID as name`);
						}

						contextDocs.push({
							documentId: documentId,
							zoteroAttachmentId: zoteroAttachmentId,
							name: documentName,
							filePath: filePath // Add file path to the context document object
						});
					}
					catch (error) {
						Zotero.debug(`DeepTutorChatBox: Error processing document ${documentId}: ${error.message}`);
						// Add with fallback name
						contextDocs.push({
							documentId: documentId,
							zoteroAttachmentId: documentId,
							name: documentId,
							filePath: null
						});
					}
				}

				Zotero.debug(`DeepTutorChatBox: Loaded ${contextDocs.length} context documents`);
				setContextDocuments(contextDocs);
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error loading context documents: ${error.message}`);
				setContextDocuments([]);
			}
		};

		loadContextDocuments();
	}, [documentIds, sessionId]);

	// Handle click outside context popup
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (contextPopupRef.current && !contextPopupRef.current.contains(event.target)) {
				Zotero.debug(`DeepTutorChatBox: Clicked outside context popup, closing`);
				setShowContextPopup(false);
			}
		};

		if (showContextPopup) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
	}, [showContextPopup]);



	// Handle click outside context popup
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (contextPopupRef.current && !contextPopupRef.current.contains(event.target)) {
				Zotero.debug(`DeepTutorChatBox: Clicked outside context popup, closing`);
				setShowContextPopup(false);
			}
		};

		if (showContextPopup) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
		return undefined; // Explicit return for linter
	}, [showContextPopup]);

	// const updateRecentSessions = async (sessionId) => {
	// 	try {
	// 		const session = await getSessionById(sessionId);
	// 		if (!session) {
	// 			// Zotero.debug(`DeepTutorChatBox: No session found for ID ${sessionId}`);
	// 			return;
	// 		}

	// 		// Zotero.debug(`DeepTutorChatBox: Updating recent sessions with session ${sessionId}`);
	// 		setRecentSessions((prev) => {
	// 			const newMap = new Map(prev);
	// 			// Only add if not already present or if it's a different session
	// 			if (!newMap.has(sessionId)) {
	// 				newMap.set(sessionId, {
	// 					name: session.sessionName || `Session ${sessionId.slice(0, 8)}`,
	// 					lastUpdatedTime: new Date().toISOString() // Use current time for new sessions
	// 				});
	// 				// Zotero.debug(`DeepTutorChatBox: Added new session to recent sessions map, now has ${newMap.size} sessions`);
	// 			}
	// 			else {
	// 				// Update the existing session's lastUpdatedTime with current time
	// 				const existingSession = newMap.get(sessionId);
	// 				newMap.set(sessionId, {
	// 					...existingSession,
	// 					lastUpdatedTime: new Date().toISOString() // Use current time for updates
	// 				});
	// 				// Zotero.debug(`DeepTutorChatBox: Updated existing session in recent sessions map`);
	// 			}

	// 			// Store in preferences
	// 			const sessionsObject = Object.fromEntries(newMap);
	// 			Zotero.Prefs.set('deeptutor.recentSessions', JSON.stringify(sessionsObject));
	// 			// Zotero.debug(`DeepTutorChatBox: Stored ${newMap.size} sessions in preferences`);

	// 			return newMap;
	// 		});
	// 	}
	// 	catch (error) {
	// 		// Zotero.debug(`DeepTutorChatBox: Error updating recent sessions: ${error.message}`);
	// 	}
	// };

	// Add new useEffect after the existing one
	useEffect(() => {
		const openAllDocuments = async () => {
			if (documentIds && documentIds.length > 0 && sessionId) {
				// Zotero.debug(`DeepTutorChatBox: Opening all documents - sessionId: ${sessionId}, ${documentIds.length} documents`);
                
				try {
					// Try to get the mapping from local storage
					const storageKey = `deeptutor_mapping_${sessionId}`;
					const mappingStr = Zotero.Prefs.get(storageKey);
					// Zotero.debug("DeepTutorChatBox: Get data mapping:", Zotero.Prefs.get(storageKey));
					
					let mapping = {};
					if (mappingStr) {
						mapping = JSON.parse(mappingStr);
						// Zotero.debug(`DeepTutorChatBox: Found mapping in storage: ${JSON.stringify(mapping)}`);
					}

					// Loop through all document IDs
					for (let i = 0; i < documentIds.length; i++) {
						const documentId = documentIds[i];
						try {
							let zoteroAttachmentId = documentId;

							// If we have a mapping for this document ID, use it
							if (mapping[documentId]) {
								zoteroAttachmentId = mapping[documentId];
								// Zotero.debug(`DeepTutorChatBox: Using mapped attachment ID: ${zoteroAttachmentId} for document ${documentId}`);
							}

							// Get the item and open it
							const item = Zotero.Items.get(zoteroAttachmentId);
							if (!item) {
								// Zotero.debug(`DeepTutorChatBox: No item found for ID ${zoteroAttachmentId}`);
								continue; // Skip this document and continue with the next one
							}

							// Open the document in the reader
							await Zotero.FileHandlers.open(item, {
								location: {
									pageIndex: 0 // Start at first page
								}
							});
							// Zotero.debug(`DeepTutorChatBox: Opened document ${i + 1}/${documentIds.length}: ${zoteroAttachmentId} in reader`);
							
							// Add a small delay between opening documents to avoid overwhelming the UI
							if (i < documentIds.length - 1) {
								await new Promise(resolve => setTimeout(resolve, 500));
							}
						}
						catch (error) {
							// Zotero.debug(`DeepTutorChatBox: Error opening document ${documentId}: ${error.message}`);
							// Zotero.debug(`DeepTutorChatBox: Error stack: ${error.stack}`);
							// Continue with the next document even if this one fails
						}
					}
				}
				catch (error) {
					// Zotero.debug(`DeepTutorChatBox: Error in openAllDocuments: ${error.message}`);
				}
				
				// Zotero.debug(`DeepTutorChatBox: Finished opening all ${documentIds.length} documents`);
			}
		};
		openAllDocuments();
	}, [documentIds, sessionId]); // Dependencies array

	// Load context documents when documentIds change
	useEffect(() => {
		const loadContextDocuments = async () => {
			if (!documentIds || documentIds.length === 0 || !sessionId) {
				// Zotero.debug(`DeepTutorChatBox: No documentIds or sessionId available for context loading`);
				setContextDocuments([]);
				return;
			}

			// Zotero.debug(`DeepTutorChatBox: Loading context documents for ${documentIds.length} documents`);
            
			try {
				// Try to get the mapping from local storage
				const storageKey = `deeptutor_mapping_${sessionId}`;
				const mappingStr = Zotero.Prefs.get(storageKey);
				let mapping = {};
                
				if (mappingStr) {
					mapping = JSON.parse(mappingStr);
					// Zotero.debug(`DeepTutorChatBox: Found mapping in storage: ${JSON.stringify(mapping)}`);
				}

				const contextDocs = [];
				for (const documentId of documentIds) {
					try {
						// Get the actual Zotero attachment ID
						let zoteroAttachmentId = documentId;
						if (mapping[documentId]) {
							zoteroAttachmentId = mapping[documentId];
							// Zotero.debug(`DeepTutorChatBox: Using mapped attachment ID: ${zoteroAttachmentId} for document ${documentId}`);
						}

						// Try to get the Zotero item to get the document name and path
						const item = Zotero.Items.get(zoteroAttachmentId);
						let documentName = documentId; // fallback to documentId
						let filePath = null;

						if (item) {
							// Prioritize attachment filename first
							if (item.attachmentFilename) {
								documentName = item.attachmentFilename;
								// Zotero.debug(`DeepTutorChatBox: Using attachment filename: ${documentName}`);
							}
							// Fall back to display title if no filename
							else if (item.getDisplayTitle) {
								documentName = item.getDisplayTitle();
								// Zotero.debug(`DeepTutorChatBox: Found item title: ${documentName}`);
							}
							// Finally try parent item title
							else if (item.parentItem) {
								const parentItem = Zotero.Items.get(item.parentItem);
								if (parentItem && parentItem.getDisplayTitle) {
									documentName = parentItem.getDisplayTitle();
									// Zotero.debug(`DeepTutorChatBox: Found parent item title: ${documentName}`);
								}
							}

							// Get the file path if it's an attachment
							if (item.isAttachment && item.isAttachment()) {
								try {
									filePath = await item.getFilePathAsync();
									if (filePath) {
										// Zotero.debug(`DeepTutorChatBox: Found file path: ${filePath}`);
										// Optionally truncate long paths for display
										const maxPathLength = 60;
										if (filePath.length > maxPathLength) {
											const pathParts = filePath.split(/[/\\]/);
											const filename = pathParts[pathParts.length - 1];
											const pathPrefix = filePath.substring(0, maxPathLength - filename.length - 3);
											filePath = pathPrefix + "..." + filename;
										}
									}
								}
								catch (error) {
									// Zotero.debug(`DeepTutorChatBox: Error getting file path for ${zoteroAttachmentId}: ${error.message}`);
								}
							}
						}
						else {
							// Zotero.debug(`DeepTutorChatBox: No item found for ID ${zoteroAttachmentId}, using document ID as name`);
						}

						contextDocs.push({
							documentId: documentId,
							zoteroAttachmentId: zoteroAttachmentId,
							name: documentName,
							filePath: filePath // Add file path to the context document object
						});
					}
					catch (error) {
						// Zotero.debug(`DeepTutorChatBox: Error processing document ${documentId}: ${error.message}`);
						// Add with fallback name
						contextDocs.push({
							documentId: documentId,
							zoteroAttachmentId: documentId,
							name: documentId,
							filePath: null
						});
					}
				}

				// Zotero.debug(`DeepTutorChatBox: Loaded ${contextDocs.length} context documents`);
				setContextDocuments(contextDocs);
			}
			catch (error) {
				// Zotero.debug(`DeepTutorChatBox: Error loading context documents: ${error.message}`);
				setContextDocuments([]);
			}
		};

		loadContextDocuments();
	}, [documentIds, sessionId]);

	// Handle click outside context popup
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (contextPopupRef.current && !contextPopupRef.current.contains(event.target)) {
				Zotero.debug(`DeepTutorChatBox: Clicked outside context popup, closing`);
				setShowContextPopup(false);
			}
		};

		if (showContextPopup) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
	}, [showContextPopup]);

	// Add SessionTabBar component
	// const SessionTabBar = () => {
	// 	// Convert Map to sorted array and sort by lastUpdatedTime
	// 	const sortedSessions = Array.from(recentSessions.entries())
	//         .sort((a, b) => {
	//         	const timeA = new Date(a[1].lastUpdatedTime || 0).getTime();
	//         	const timeB = new Date(b[1].lastUpdatedTime || 0).getTime();
	//         	return timeB - timeA; // Sort in descending order (most recent first)
	//         });

	// 	// Zotero.debug(`DeepTutorChatBox: Rendering SessionTabBar with ${sortedSessions.length} sessions`);
	// 	const visibleSessions = sortedSessions.slice(0, MAX_VISIBLE_SESSIONS);
	// 	const hiddenSessions = sortedSessions.slice(MAX_VISIBLE_SESSIONS);

	// 	const truncateSessionName = (name) => {
	// 		return name.length > 11 ? name.substring(0, 11) + '...' : name;
	// 	};

	// 	const handleSessionClick = async (sessionId) => {
	// 		try {
	// 			// Get the session data
	// 			const session = await getSessionById(sessionId);
	// 			if (!session) {
	// 				// Zotero.debug(`DeepTutorChatBox: No session found for ID ${sessionId}`);
	// 				return;
	// 			}

	// 			// Update recent sessions with new timestamp
	// 			await updateRecentSessions(sessionId);

	// 			// Update the current session through props
	// 			if (currentSession?.id !== sessionId) {
	// 				// Zotero.debug(`DeepTutorChatBox: Switching to session ${sessionId}`);
	// 				// Use the onSessionSelect prop to switch sessions
	// 				if (onSessionSelect) {
	// 					onSessionSelect(session.id);
	// 				}
	// 			}
	// 		}
	// 		catch (error) {
	// 			// Zotero.debug(`DeepTutorChatBox: Error handling session click: ${error.message}`);
	// 		}
	// 	};

	// 	const handleCloseSession = async (sessionId, event) => {
	// 		event.stopPropagation(); // Prevent session click when closing
	            
	// 		// Check if we're closing the active session
	// 		const isActiveSession = sessionId === currentSession?.id;
	            
	// 		setRecentSessions((prev) => {
	// 			const newMap = new Map(prev);
	// 			newMap.delete(sessionId);
	                
	// 			// Store in preferences
	// 			const sessionsObject = Object.fromEntries(newMap);
	// 			Zotero.Prefs.set('deeptutor.recentSessions', JSON.stringify(sessionsObject));
	                
	// 			return newMap;
	// 		});

	// 		// If we closed the active session and there are other sessions, load the next one
	// 		if (isActiveSession) {
	// 			const remainingSessions = Array.from(recentSessions.entries())
	//                 .filter(([id]) => id !== sessionId)
	//                 .sort((a, b) => {
	//                 	const timeA = new Date(a[1].lastUpdatedTime || 0).getTime();
	//                 	const timeB = new Date(b[1].lastUpdatedTime || 0).getTime();
	//                 	return timeB - timeA;
	//                 });

	// 			if (remainingSessions.length > 0) {
	// 				const [nextSessionId, nextSessionData] = remainingSessions[0];
	// 				try {
	// 					const session = await getSessionById(nextSessionId);
	// 					if (session && onSessionSelect) {
	// 						onSessionSelect(session.id);
	// 					}
	// 				}
	// 				catch (error) {
	// 					// Zotero.debug(`DeepTutorChatBox: Error loading next session: ${error.message}`);
	// 				}
	// 			}
	// 		}
	// 	};

	// 	return (
	// 		<div style={styles.sessionTabBar}>
	// 			{visibleSessions.map(([sessionId, sessionData]) => (
	// 				<button
	// 					key={sessionId}
	// 					style={{
	// 						...styles.sessionTab,
	// 						...(sessionId === currentSession?.id ? styles.activeSessionTab : {})
	// 					}}
	// 					onClick={() => handleSessionClick(sessionId)}
	// 				>
	// 					{truncateSessionName(sessionData.name)}
	// 					<button
	// 						style={styles.sessionTabClose}
	// 						onClick={e => handleCloseSession(sessionId, e)}
	// 					>
	// 						<img
	// 							src={SessionTabClosePath}
	// 							alt="Close"
	// 							style={styles.sessionTabCloseIcon}
	// 						/>
	// 					</button>
	// 				</button>
	// 			))}
	// 			{hiddenSessions.length > 0 && (
	// 				<div style={{ position: 'relative' }}>
	// 					<button
	// 						style={styles.sessionTab}
	// 						onClick={() => setShowSessionPopup(!showSessionPopup)}
	// 					>
	//                         More ({hiddenSessions.length})
	// 					</button>
	// 					{showSessionPopup && (
	// 						<div style={styles.sessionPopup}>
	// 							{hiddenSessions.map(([sessionId, sessionData]) => (
	// 								<div
	// 									key={sessionId}
	// 									style={styles.sessionPopupItem}
	// 									onClick={() => {
	// 										handleSessionClick(sessionId);
	// 										setShowSessionPopup(false);
	// 									}}
	// 									onMouseEnter={(e) => {
	// 										e.target.style.background = '#D9D9D9';
	// 									}}
	// 									onMouseLeave={(e) => {
	// 										e.target.style.background = '#FFFFFF';
	// 									}}
	// 								>
	// 									{truncateSessionName(sessionData.name)}
	// 								</div>
	// 							))}
	// 						</div>
	// 					)}
	// 				</div>
	// 			)}
	// 		</div>
	// 	);
	// };

	// Communicate iniWait state changes to parent component
	useEffect(() => {
		if (onInitWaitChange) {
			onInitWaitChange(iniWait);
			// Zotero.debug(`DeepTutorChatBox: Communicated iniWait state change to parent: ${iniWait}`);
		}
	}, [iniWait, onInitWaitChange]);

	// Add cleanup function
	const cleanupSourceData = (oldSessionId) => {
		if (!oldSessionId) return;
		
		// Clean up source data for previous session
		currentSourceIndices.forEach((sourceIndex) => {
			const storageKey = `deeptutor_source_${oldSessionId}_${sourceIndex}`;
			try {
				if (Zotero.Prefs.get(storageKey)) {
					Zotero.Prefs.clear(storageKey);
					Zotero.debug(`DeepTutorChatBox: Cleaned up source data for ${storageKey}`);
				}
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error cleaning up source data: ${error.message}`);
			}
		});
		
		// Reset source indices tracking
		setCurrentSourceIndices([]);
	};

	// Add effect to handle session changes
	useEffect(() => {
		if (sessionId) {
			// Store previous session ID for cleanup
			const prevSessionId = sessionIdRef.current;
			sessionIdRef.current = sessionId;
			
			// Clean up previous session's source data
			if (prevSessionId && prevSessionId !== sessionId) {
				cleanupSourceData(prevSessionId);
			}
		}
	}, [sessionId]);

	// Add cleanup on unmount
	useEffect(() => {
		return () => {
			if (sessionIdRef.current) {
				cleanupSourceData(sessionIdRef.current);
			}
		};
	}, []);



	// Add copy event handler for the chat box
	useEffect(() => {
		const handleCopy = (e) => {
			const selection = window.getSelection();
			const selectedText = selection.toString();
			
			// Check if selection is within our chat box
			let isWithinChatBox = false;
			let node = selection.anchorNode;
			while (node != null) {
				if (node.classList && node.classList.contains('deeptutor-chat-box')) {
					isWithinChatBox = true;
					break;
				}
				node = node.parentNode;
			}

			if (isWithinChatBox && selectedText) {
				e.preventDefault(); // Prevent Zotero's global copy
				e.stopPropagation(); // Stop event bubbling
				
				// Copy the selected text
				navigator.clipboard.writeText(selectedText).then(() => {
					Zotero.debug('DeepTutorChatBox: Text copied successfully');
				}).catch((err) => {
					Zotero.debug(`DeepTutorChatBox: Copy failed: ${err.message}`);
				});
			}
		};

		// Add event listener for copy events
		document.addEventListener('copy', handleCopy, true); // true for event capture phase

		return () => {
			// Cleanup listener on component unmount
			document.removeEventListener('copy', handleCopy, true);
		};
	}, []);

	return (
		<div
			className="deeptutor-chat-box"
			style={styles.container}
		>
			{isLoading && <LoadingPopup />}
            
			{/* Add CSS styles for markdown tables and source buttons */}
			<style dangerouslySetInnerHTML={{
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
					@keyframes pulse {
						0% { opacity: 0.3; }
						100% { opacity: 0.6; }
					}
					/* KaTeX math expression styles */
					.katex {
						font-size: 1em !important;
						line-height: 0.3 !important;
					}
					.katex .msupsub {
						text-align: left !important;
					}
					.katex .msubsup {
						text-align: right !important;
					}
					/* Adjust subscript positioning */
					.katex .vlist-t2 > .vlist-r:nth-child(2) > .vlist > span > .sub {
						font-size: 85% !important;
						margin-right: 0.05em !important;
						margin-left: -0.1667em !important;
						margin-top: 0.1em !important;
						vertical-align: -0.25em !important;
					}
					/* Adjust superscript positioning */
					.katex .vlist-t2 > .vlist-r:nth-child(2) > .vlist > span > .sup {
						font-size: 85% !important;
						margin-right: 0.05em !important;
						margin-left: -0.1667em !important;
						margin-bottom: 1em !important;
						vertical-align: 0.5em !important;
					}
					/* Adjust spacing between sub/sup and base */
					.katex .msupsub > .vlist-t2 {
						margin-right: 0.05em !important;
					}
					/* Prevent subscripts from overlapping with the next line */
					.katex-display {
						margin-bottom: 1.5em !important;
						margin-top: 0.5em !important;
					}
				`
			}} />
            
			<div style={styles.sessionNameDiv}>
				{currentSession?.sessionName || "New Session"}
			</div>

			<div style={styles.viewContextContainer} ref={contextPopupRef}>
				<button
					style={styles.viewContextButton}
					onClick={handleContextButtonClick}
				>
					<span style={styles.viewContextText}>View Context</span>
					<img src={ArrowDownPath} alt="Arrow Down" />
				</button>
            
				{showContextPopup && (
					<div style={styles.contextPopup}>
						{contextDocuments.length > 0
							? contextDocuments.map((contextDoc, index) => (
								<button
									key={contextDoc.documentId}
									style={{
										...styles.contextDocumentButton,
										...(hoveredContextDoc === index ? {
											...styles.contextDocumentButtonHover,
											background: contextDoc.filePath ? '#D9D9D9' : '#E8E8E8', // Lighter gray for null filePath
										} : {
											background: contextDoc.filePath ? '#FFFFFF' : '#F5F5F5' // Light gray base for null filePath
										}),
										borderBottom: index === contextDocuments.length - 1 ? "none" : "0.0625rem solid #E0E0E0",
										flexDirection: "column",
										alignItems: "flex-start",
										padding: "0.75rem 0.9375rem",
										minHeight: contextDoc.filePath ? "3rem" : "auto",
										gap: "0.3125rem",
										cursor: contextDoc.filePath ? 'pointer' : 'not-allowed', // Change cursor for null filePath
										opacity: contextDoc.filePath ? 1 : 0.7, // Reduce opacity for null filePath
										filter: contextDoc.filePath ? 'none' : 'grayscale(20%)' // Add grayscale effect for null filePath
									}}
									onClick={() => contextDoc.filePath && handleContextDocumentClick(contextDoc)} // Only allow click if filePath exists
									onMouseEnter={() => setHoveredContextDoc(index)}
									onMouseLeave={() => setHoveredContextDoc(null)}
									title={contextDoc.filePath ? `${contextDoc.name}\n${contextDoc.filePath}` : `${contextDoc.name} (Not available)`} // Updated tooltip
								>
									<div style={{
										fontSize: "1rem",
										fontWeight: 400,
										color: "#1C1B1F",
										lineHeight: "180%",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										width: "100%"
									}}>
										{contextDoc.name}
									</div>
									{contextDoc.filePath && (
										<div style={{
											fontSize: "0.875rem",
											fontWeight: 400,
											color: "#757575",
											lineHeight: "135%",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											width: "100%",
											fontStyle: "italic"
										}}>
											{contextDoc.filePath}
										</div>
									)}
								</button>
							))
							: (
								<div style={{
									padding: "0.75rem",
									color: "#757575",
									fontSize: "0.875rem",
									textAlign: "center",
									fontStyle: "italic"
								}}>
                                    No documents available
								</div>
							)}
					</div>
				)}
			</div>

			<div
				ref={chatLogRef}
				style={styles.chatLog}
				onWheel={handleWheel}
				onScroll={handleScroll}
			>
				{messages.map((message, index) => renderMessage(message, index))}
			</div>

			<div style={styles.bottomBar}>
				<textarea
					ref={textareaRef}
					style={{
						...styles.textInput,
						opacity: isStreaming || iniWait ? 0.5 : 1,
						cursor: isStreaming || iniWait ? "not-allowed" : "text"
					}}
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey && !isStreaming && !iniWait) {
							e.preventDefault(); // Prevent adding a new line
							handleSend();
						}
						// Shift+Enter allows new line (default behavior)
					}}
					placeholder={`Ask DeepTutor ${curSessionType.toLowerCase()}`}
					rows={1}
					disabled={isStreaming || iniWait}
				/>
				<button
					style={{
						...styles.sendButton,
						opacity: isStreaming || iniWait ? 0.5 : 1,
						cursor: isStreaming || iniWait ? "not-allowed" : "pointer"
					}}
					onClick={handleSend}
					disabled={isStreaming || iniWait}
				>
					<img
						src={SendIconPath}
						alt="Send"
						style={styles.sendIcon}
					/>
				</button>
			</div>
		</div>
	);
};

DeepTutorChatBox.propTypes = {
	currentSession: PropTypes.object,
	onSessionSelect: PropTypes.func,
	onInitWaitChange: PropTypes.func
};

export default DeepTutorChatBox;
