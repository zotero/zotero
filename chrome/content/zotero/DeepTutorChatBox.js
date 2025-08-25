/* eslint-disable no-loop-func */
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
	createMessage,
	getMessagesBySessionId,
	getDocumentById,
	subscribeToChat
} from './api/libs/api';
import DeepTutorChatBoxMessage from './DeepTutorChatBoxMessage';
import DeepTutorRenameSession from './DeepTutorRenameSession.js';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const markdownit = require('markdown-it');
// Try to require markdown-it-container, fallback to a simpler implementation if not available
try {
	require('markdown-it-container');
}
catch {
	// Fallback implementation for markdown-it-container
}
const md = markdownit({
	html: true,
	linkify: true,
	typographer: true,
	tables: true, // Enable built-in table support
	breaks: false, // GFM line breaks (optional)
	strikethrough: true, // Enable strikethrough support
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
}
catch {
	// Try alternative GFM plugin that includes tables
	try {
		const markdownItGfm = require('markdown-it-gfm');
		md.use(markdownItGfm);
	}
	catch {
		// Using basic table support only
	}
}

// Configure markdown-it-container for source buttons
// DISABLED - Using direct HTML replacement approach instead to avoid table conflicts
// The container plugin interferes with table parsing, so we'll use post-processing instead

// Test removed - no longer using container plugin


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


const SendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/RES_SEND.svg';
const StopIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/RES_STOP.svg';
const ArrowDownPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/CHAT_ARROWDOWN.svg';
const RenameIconPath = 'chrome://zotero/content/DeepTutorMaterials/History/RENAME_SESSION.svg';
const RenameIconDarkPath = 'chrome://zotero/content/DeepTutorMaterials/History/RENAME_SESSION_DARK.svg';
const DeepTutorChatBox = ({ currentSession, onInitWaitChange, handleShowNoteSavePopup }) => {
	const { colors, theme, isDark } = useDeepTutorTheme();
	
	// Theme-aware styles
	const styles = {
		container: {
			width: '100%',
			minHeight: '80%',
			background: colors.background.tertiary,
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
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: '10px',
		},
		sessionNameText: {
			color: colors.text.allText,
			fontWeight: 500,
			fontSize: '1.25rem',
			lineHeight: '100%',
			letterSpacing: '0%',
			textAlign: 'left',
			fontFamily: 'Roboto, sans-serif',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
			flex: 1,
		},
		renameIconButton: {
			width: '1.0625rem',
			height: '1.0625rem',
			background: 'transparent',
			border: 'none',
			cursor: 'pointer',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: 0,
			flexShrink: 0,
		},
		renameIcon: {
			width: '1.0625rem',
			height: '1.0625rem',
			objectFit: 'contain',
		},
		sessionInfo: {
			width: '90%',
			fontSize: '1em',
			color: colors.text.tertiary,
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
			background: colors.background.tertiary,
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
			background: colors.background.quaternary,
			display: 'flex',
			alignItems: 'flex-end', // Changed from 'center' to 'flex-end' to align with textarea
			justifyContent: 'space-between',
			fontFamily: 'Roboto, sans-serif',
			position: 'relative',
			zIndex: 1,
			border: `0.0625rem solid ${colors.border.quaternary}`,
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
			background: colors.background.quaternary,
			color: colors.text.tertiary,
			minHeight: '1.5rem',
			maxHeight: '7rem', // Approximately 5 lines of text at 0.95rem font size
			fontSize: '1rem',
			overflowY: 'auto',
			fontFamily: 'Roboto, sans-serif',
			resize: 'none',
			height: '24px', // Start with minHeight (1.5rem)
			marginRight: '0.625rem',
			alignSelf: 'center',
			lineHeight: '24px',
			wordWrap: 'break-word',
			whiteSpace: 'pre-wrap'
		},
		sendButton: {
			all: 'revert',
			background: colors.background.quaternary,
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
				background: colors.border.quaternary
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
			backgroundColor: colors.message.user,
			color: colors.message.userText,
			marginLeft: 'auto',
			marginRight: '1rem',
			borderRadius: '0.625rem',
			fontWeight: 400,
			textAlign: 'left',
			alignSelf: 'flex-end',
			maxWidth: '85%',
			width: 'fit-content',
			fontSize: '0.875rem',
			lineHeight: '1.35',
			padding: '0.25rem 1.25rem',
			letterSpacing: '0.02em',
		},
		botMessage: {
			backgroundColor: colors.message.bot,
			color: colors.message.botText,
			marginRight: 'auto',
			marginLeft: 0,
			borderBottomLeftRadius: '0.25rem',
			borderRadius: '1rem',
			fontWeight: 400,
			alignSelf: 'flex-start',
			letterSpacing: '0.02em',
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
			background: colors.button.secondary,
			color: colors.button.secondaryText,
			border: `0.0625rem solid ${colors.button.secondaryBorder}`,
			borderRadius: '0.625rem',
			padding: '0.625rem 1.25rem',
			minWidth: '8rem',
			maxWidth: '83%',
			fontWeight: 500,
			fontSize: '1rem',
			lineHeight: '1.5',
			letterSpacing: '0.02em',
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
			marginRight: '1rem',
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
			border: `0.0625rem solid ${colors.border.tertiary}`,
			borderRadius: '0.625rem',
			height: '3rem',
			background: colors.background.quaternary,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			boxSizing: 'border-box',
			cursor: 'pointer',
			transition: 'background-color 0.2s',
		},
		viewContextButtonHover: {
			background: colors.background.primary,
		},
		viewContextText: {
			fontSize: '1rem',
			fontWeight: 400,
			color: colors.text.tertiary,
			lineHeight: '100%',
		},
		contextPopup: {
			position: 'absolute',
			top: '100%',
			left: 0,
			right: 0,
			background: theme === 'light' ? '#FFFFFF' : colors.background.tertiary,
			border: `0.0625rem solid ${colors.border.primary}`,
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
			background: theme === 'light' ? '#FFFFFF' : colors.background.quaternary,
			border: 'none',
			borderBottom: `0.0625rem solid ${colors.border.primary}`,
			color: colors.text.quaternary,
			fontSize: '0.875rem',
			fontWeight: 600,
			cursor: 'pointer',
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
			background: theme === 'light' ? '#F8F6F7' : colors.background.primary,
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
			marginRight: '1rem',
		},
		renamePopupOverlay: {
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'rgba(0, 0, 0, 0.5)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 9999,
		},
	};
	const [messages, setMessages] = useState([]);
	const [inputValue, setInputValue] = useState('');
	const [sessionId, setSessionId] = useState(null);
	const [userId, setUserId] = useState(null);
	const [documentIds, setDocumentIds] = useState([]);
	const [latestMessageId, setLatestMessageId] = useState(null);
	const [curSessionType, setcurSessionType] = useState(SessionType.BASIC);
	const chatLogRef = useRef(null);
	const contextPopupRef = useRef(null);
	const textareaRef = useRef(null);
	const [hoveredContextDoc, setHoveredContextDoc] = useState(null);
	const [hoveredQuestion, setHoveredQuestion] = useState(null);
	const [iniWait, setInitWait] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const streamReaderRef = useRef(null);
	const isAutoScrollingRef = useRef(true);
	const [showContextPopup, setShowContextPopup] = useState(false);
	const [contextDocuments, setContextDocuments] = useState([]);
	const [currentSourceIndices, setCurrentSourceIndices] = useState([]);
	const sessionIdRef = useRef(null);
	const [isManuallyStopped, setIsManuallyStopped] = useState(false);
	const isManuallyStoppedRef = useRef(isManuallyStopped);
	const [_time, setTime] = useState(new Date());

	// Add state for note container (parent item ID for creating notes)
	const [noteContainer, setNoteContainer] = useState(null);

	// Add state to track if a note is currently being saved
	const [isSavingNote, _setIsSavingNote] = useState(false);

	// Add state to track streaming component visibility for each message
	const [streamingComponentVisibility, setStreamingComponentVisibility] = useState({});
	const [showRenamePopup, setShowRenamePopup] = useState(false);
	
	// Choose rename icon based on theme
	const renameIconPath = isDark ? RenameIconDarkPath : RenameIconPath;

	// Add state to track waiting for AI response (backend processing)
	const [waitingStreaming, setWaitingStreaming] = useState(false);

	// Add state to track if we have an active stream connection (vs just backend processing)
	const [hasActiveStream, setHasActiveStream] = useState(false);

	// Toggle streaming component visibility for a specific message
	const toggleStreamingComponent = (messageId) => {
		setStreamingComponentVisibility(prev => ({
			...prev,
			[messageId]: !prev[messageId]
		}));
	};

	// Helper function to check if we should continue checking for responses (within 10 minutes)
	const checkTime = React.useCallback((lastMessage) => {
		if (!lastMessage || !lastMessage.creationTime) return true;
		
		const messageTime = new Date(lastMessage.creationTime);
		const currentTime = new Date();
		const timeDiff = currentTime - messageTime;
		
		// Continue checking if less than 10 minutes have passed since the last message
		return timeDiff < 600000; // 10 minutes in milliseconds
	}, []);

	useEffect(() => {
		isManuallyStoppedRef.current = isManuallyStopped;
	}, [isManuallyStopped]);

	// Clear waiting state when active streaming starts
	useEffect(() => {
		if (hasActiveStream && waitingStreaming) {
			Zotero.debug(`DeepTutorChatBox: Active streaming started, clearing waiting state`);
			setWaitingStreaming(false);
		}
	}, [hasActiveStream, waitingStreaming]);

	// Periodic message fetching useEffect
	useEffect(() => {
		let isActive = true;
		let timeoutId = null;
		
		const periodicCheck = () => {
			if (!isActive) return;
			
			setTime(new Date()); // Update time every 30 seconds
			
			if (
				sessionId
				&& messages.length > 0
				&& messages[messages.length - 1].role === MessageRole.USER
				&& checkTime(messages[messages.length - 1])
			) {
				// Set waiting state to show thinking animation (AI is processing but not yet in history)
				Zotero.debug(`DeepTutorChatBox: Setting waitingStreaming to true - last message is USER and within time limit`);
				setWaitingStreaming(true);
				
				getMessagesBySessionId(sessionId).then((response) => {
					if (response && response.length > messages.length) {
						Zotero.debug(`DeepTutorChatBox: New messages found, stopping waitingStreaming`);
						setMessages(response);
						setLatestMessageId(response[response.length - 1].id);
						// Stop streaming if it was active (AI response received)
						setIsStreaming(false);
						setHasActiveStream(false);
						// Stop waiting since we got a response
						setWaitingStreaming(false);
					} else {
						Zotero.debug(`DeepTutorChatBox: No new messages, keeping waitingStreaming true`);
					}
					// If no new messages but we're still checking, keep waiting state true
				}).catch((error) => {
					Zotero.debug(`DeepTutorChatBox: Error checking messages: ${error}`);
					// Stop waiting state on error
					setWaitingStreaming(false);
				});
			} else {
				// Not waiting for response
				Zotero.debug(`DeepTutorChatBox: Not in waiting condition, setting waitingStreaming to false`);
				setWaitingStreaming(false);
			}
			
			// Schedule next check
			if (isActive) {
				timeoutId = setTimeout(periodicCheck, 60000);
			}
		};
		
		// Start the periodic check if checkTime is available
		if (checkTime) {
			timeoutId = setTimeout(periodicCheck, 60000);
		}
		
		// If checkTime is not available, don't start the periodic check
		if (!checkTime) {
			isActive = false;
		}
		
		return () => {
			isActive = false;
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [messages, checkTime]); // Dependencies: sessionId, messages, and checkTime function


	// Handle source button clicks
	const handleSourceClick = async (source) => {
		if (!source) {
			return;
		}

		// Determine which attachment the source refers to
		const docIdx
            = (source.refinedIndex !== undefined && source.refinedIndex !== null)
            	? source.refinedIndex
            	: source.index;

		if (docIdx === undefined || docIdx === null || docIdx < 0 || docIdx >= documentIds.length) {
			return;
		}

		const attachmentId = documentIds[docIdx];
		if (!attachmentId) {
			return;
		}

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
				return;
			}

			// Open the PDF on the correct page
			await Zotero.FileHandlers.open(item, {
				location: { pageIndex: source.page - 1 }
			});

			// Get the reader instance for the current tab
			const reader = Zotero.Reader.getByTabID(Zotero.getMainWindow().Zotero_Tabs.selectedID);
			if (!reader) {
				return; // Early exit if reader is not available
			}

			/*
			Search functionality commented out - preserve file opening and page switching only
			const searchQuery = source.referenceString || "test";
			
			reader._internalReader.setFindQuery(searchQuery, {
			primary: true,
			openPopup: false,
			activateSearch: true
			});
			*/
			
			// Future: Add search functionality here when needed
			Zotero.debug('DeepTutorChatBox: PDF opened, search functionality available if needed');
		}
		catch (error) {
			Zotero.debug(error);
		}
	};

	// Set up global handler for source button clicks
	useEffect(() => {
		window.handleDeepTutorSourceClick = (encodedSourceData) => {
			try {
				const sourceData = JSON.parse(decodeURIComponent(encodedSourceData));
				handleSourceClick(sourceData);
			}
			catch (error) {
				Zotero.debug(error);
			}
		};
		
		// Set up event delegation for source button clicks
		const handleDocumentClick = (event) => {
			if (event.target && event.target.classList.contains('deeptutor-source-button')) {
				const sourceData = event.target.getAttribute('data-source-data');
				if (sourceData) {
					try {
						const decodedData = JSON.parse(decodeURIComponent(sourceData));
						handleSourceClick(decodedData);
					}
					catch (error) {
						Zotero.debug(error);
					}
				}
			}
		};
		
		// Add event listener to document
		document.addEventListener('click', handleDocumentClick);
		
		// Cleanup function
		return () => {
			document.removeEventListener('click', handleDocumentClick);
			if (window.handleDeepTutorSourceClick) {
				delete window.handleDeepTutorSourceClick;
			}
		};
	}, [sessionId, documentIds]); // Re-setup when session or documents change

	// Re-enable placeholder to button conversion now that XML parsing is fixed
	// Convert placeholder spans to actual buttons after React renders
	useEffect(() => {
		const convertPlaceholdersToButtons = () => {
			if (!chatLogRef.current) return;
			
			const placeholders = chatLogRef.current.querySelectorAll('.deeptutor-source-placeholder');
			
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
					Zotero.debug(error);
				}
				
				// Fallback: Try to get source data from current messages if not in prefs
				if (!sourceData) {
					for (const message of messages) {
						if (message.subMessages) {
							for (const subMessage of message.subMessages) {
								if (subMessage.sources && subMessage.sources[sourceIndex]) {
									const source = subMessage.sources[sourceIndex];
									sourceData = JSON.stringify({
										index: source.index || sourceIndex,
										refinedIndex: source.refinedIndex !== undefined ? source.refinedIndex : source.index || sourceIndex,
										page: source.page || 1,
										referenceString: source.referenceString || '',
										sourceAnnotation: source.sourceAnnotation || {}
									});
									
									// Store it in prefs for future use
									Zotero.Prefs.set(storageKey, sourceData);
									break;
								}
							}
						}
						if (sourceData) break;
					}
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
			});
		};
		
		// Convert placeholders after messages change
		const timeoutId = setTimeout(convertPlaceholdersToButtons, 100);
		
		return () => {
			clearTimeout(timeoutId);
		};
	}, [messages, sessionId]); // Added sessionId dependency

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
			}
			else {
				// Use scrollHeight for multi-line content, but cap at maxHeight
				newHeight = Math.min(scrollHeight, maxHeight);
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

	// Handle session changes
	useEffect(() => {
		const loadSessionData = async () => {
			if (!currentSession?.id) return;

			// Update session and user IDs
			setSessionId(currentSession.id);
			setUserId(currentSession.userId);
			setDocumentIds(currentSession.documentIds || []);
			setcurSessionType(currentSession.type || SessionType.BASIC);

			// Fetch document information (errors are handled gracefully)
			const documentIds = currentSession.documentIds || [];
			const newDocumentFiles = await Promise.allSettled(
				documentIds.map(id => getDocumentById(id))
			);
			
			// Log any failures
			newDocumentFiles
				.filter(result => result.status === "rejected")
				.forEach(result => Zotero.debug(result.reason));
		};

		loadSessionData();
		
		// Immediately check for waiting state when session changes
		// This handles the case where user switches back to a session that's waiting for AI response
		setTimeout(() => {
			if (
				currentSession?.id
				&& messages.length > 0
				&& messages[messages.length - 1].role === MessageRole.USER
				&& checkTime(messages[messages.length - 1])
			) {
				Zotero.debug(`DeepTutorChatBox: Session changed, immediately checking for waiting state`);
				setWaitingStreaming(true);
			}
		}, 100); // Small delay to ensure state updates are processed
	}, [currentSession, messages, checkTime]);


	// Handle message updates
	useEffect(() => {
		const loadMessages = async () => {
			if (!sessionId) return;

			try {
				const sessionMessages = await getMessagesBySessionId(sessionId);
				setMessages([]);
                
				if (sessionMessages.length === 0) {
					await handleEmptySession();
					return;
				}

				// Process existing messages
				setLatestMessageId(sessionMessages[sessionMessages.length - 1].id);
				
				for (const [, message] of sessionMessages.entries()) {
					const sender = message.role === MessageRole.USER ? "You" : "DeepTutor";
					await _appendMessage(sender, message);
				}

				// Update streaming state based on last message
				const lastMessage = sessionMessages[sessionMessages.length - 1];
				const shouldStream = lastMessage?.role === MessageRole.USER && checkTime(lastMessage);
				setIsStreaming(shouldStream);
			}
			catch (error) {
				Zotero.debug(error);
			}
		};

		const handleEmptySession = async () => {
			setInitWait(true);
			
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
			
			await _appendMessage("DeepTutor", loadingMessage);
			await new Promise(resolve => setTimeout(resolve, 8000));
			setMessages([]);
			
			// Send initial message
			await userSendMessage('Based on the context provided, make a summary for the document. Begin with "Summary"');
			setInitWait(false);
		};

		loadMessages();
	}, [sessionId]);


	// Auto-scroll when messages change
	useEffect(() => {
		if (chatLogRef.current && isAutoScrollingRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
		}
	}, [messages]);

	// Auto-scroll during streaming
	useEffect(() => {
		if (chatLogRef.current && isAutoScrollingRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
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
			}
		}
	};

	// Handle rename functionality
	const handleRenameClick = () => {
		setShowRenamePopup(true);
	};

	const handleRenameCancel = () => {
		setShowRenamePopup(false);
	};

	const handleRenameConfirm = async (_sessionId) => {
		setShowRenamePopup(false);
		// The session should be refreshed after renaming, which will happen through the API
		// and the parent component should handle updating the current session
	};

	// Handle scroll to detect if user scrolled back to bottom
	const handleScroll = () => {
		if (chatLogRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = chatLogRef.current;
			const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100; // 100px tolerance
            
			if (isAtBottom && !isAutoScrollingRef.current) {
				isAutoScrollingRef.current = true;
			}
		}
	};

	const userSendMessage = async (messageString) => {
		if (!messageString.trim()) {
			return;
		}
        
		// Always enable auto-scrolling when user sends a message (which will trigger streaming)
		isAutoScrollingRef.current = true;

		try {
			if (!sessionId) throw new Error("No active session ID");
			if (!userId) throw new Error("No active user ID");

			// Create user message with proper structure
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
			await _appendMessage("You", userMessage);
			setLatestMessageId(userMessage.id);

			// Send to API and handle response
			const _response = await sendToAPI(userMessage);


			// Auto-scrolling is handled by useEffect hooks
		}
		catch (error) {
			Zotero.debug(error);
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
		setIsManuallyStopped(false);
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

	const handleStopStreaming = async () => {
		if (streamReaderRef.current) {
			try {
				setIsManuallyStopped(true);
				await streamReaderRef.current.cancel();
				// Update the last message to show it was stopped
				setMessages((prev) => {
					const newMessages = [...prev];
					const lastMessage = newMessages[newMessages.length - 1];
					if (lastMessage && lastMessage.isStreaming) {
						lastMessage.isStreaming = false;
						
						// Clean the message text to remove any message ID that might have been added
						let cleanText = lastMessage.subMessages[0].text || '';
						
						// Remove any message ID patterns that might have been added (like long hex strings)
						cleanText = cleanText.replace(/[a-f0-9]{16,}/gi, ''); // Remove long hex strings
						cleanText = cleanText.replace(/^\d+/, ''); // Remove leading numbers (index fallbacks)
						
						// Add the stopped tag
						cleanText += '<stopped>';
						
						// Update the message text
						lastMessage.subMessages[0].text = cleanText;
						
						// Add flag to indicate this message was manually stopped
						lastMessage.manuallyStopped = true;
						
						// Hide streaming component by default when streaming is stopped
						setStreamingComponentVisibility(prevVisibility => ({
							...prevVisibility,
							[lastMessage.id || newMessages.length - 1]: false
						}));
					}
					return newMessages;
				});
			}
			catch (error) {
				Zotero.debug(`Error stopping stream: ${error.message}`);
				streamReaderRef.current = null; // Clear reader reference even on error
			}
		}
		
		// Handle waiting case - just stop the waiting animation
		if (waitingStreaming) {
			Zotero.debug(`DeepTutorChatBox: Stopping waiting animation`);
			setWaitingStreaming(false);
		}
		
		setIsStreaming(false);
		setHasActiveStream(false);
	};

	const sendToAPI = async (message) => {
		try {
			setIsStreaming(true); // Set streaming to true at start
			setHasActiveStream(true); // Set active stream flag
			setWaitingStreaming(false); // Clear waiting state when normal streaming starts
			isAutoScrollingRef.current = true; // Re-enable auto-scrolling for new stream
			// Send message to API
			const responseData = await createMessage(message);
			const newDocumentFiles2 = [];
			for (const documentId of currentSession.documentIds || []) {
				try {
					const docData = await getDocumentById(documentId);
					newDocumentFiles2.push(docData);
				}
				catch (error) {
					Zotero.debug(error);
				}
			}
            
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
            
			// Subscribe to chat stream with timeout
			const streamResponse = await subscribeToChat(newState);

			if (!streamResponse.ok) {
				setIsStreaming(false); // Set streaming to false on error
				setHasActiveStream(false);
				throw new Error(`Stream request failed: ${streamResponse.status}`);
			}
            
			if (!streamResponse.body) {
				setIsStreaming(false); // Set streaming to false if no body
				setHasActiveStream(false);
				throw new Error('Stream response body is null');
			}

			const reader = streamResponse.body.getReader();
			streamReaderRef.current = reader; // Store reader reference for stopping
			const decoder = new TextDecoder();
			let streamText = "";
			let hasReceivedData = false;
			let lastDataTime = Date.now();

			// Create initial streaming message for TUTOR
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
					const newMessages = [...prev, initialStreamingMessage];
					resolve();
					return newMessages;
				});
			});

			while (true) {
				const { done, value } = await reader.read();
                
				// Check for timeout
				if (Date.now() - lastDataTime > 600000) {
					setIsStreaming(false); // Set streaming to false on timeout
					setHasActiveStream(false);
					throw new Error('Stream timeout - no data received for 300 seconds');
				}
                
				if (done) {
					if (!hasReceivedData) {
						setIsStreaming(false); // Set streaming to false if no data received
						setHasActiveStream(false);
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
						Zotero.debug(error);
					}
				});
			}
			if (isManuallyStoppedRef.current) {
				setIsStreaming(false);
				setHasActiveStream(false);
				// For manual stop, we need to handle this differently since the message doesn't have an ID yet
				// We'll set the visibility when the message is processed later
				return;
			}
			// Fetch message history for the session
			await new Promise(resolve => setTimeout(resolve, 3000));
            
			const historyData = await getMessagesBySessionId(sessionId);
			
			// Preserve streaming message data when updating from server
			setMessages((prevMessages) => {
				// Find the streaming message (last message with isStreaming: true)
				const streamingMessageIndex = prevMessages.findIndex(msg => msg.isStreaming);
				
				if (streamingMessageIndex !== -1) {
					// Replace the streaming message with the final server message, but preserve streamText
					const streamingMessage = prevMessages[streamingMessageIndex];
					const finalMessage = historyData[historyData.length - 1];
					
					// Create updated message that preserves streamText but uses server data
					const updatedMessage = {
						...finalMessage,
						streamText: streamingMessage.streamText || finalMessage.subMessages?.[0]?.text || '',
						isStreaming: false
					};
					
					// Replace the streaming message with the updated one
					const updatedMessages = [...prevMessages];
					updatedMessages[streamingMessageIndex] = updatedMessage;
					
					// Hide streaming component by default when streaming finishes
					// Use the actual message ID from the server
					setStreamingComponentVisibility(prevVisibility => ({
						...prevVisibility,
						[updatedMessage.id]: false
					}));
					
					return updatedMessages;
				}
				
				// If no streaming message found, use server data as is
				// Hide streaming component for the last message
				if (historyData.length > 0) {
					const lastMessage = historyData[historyData.length - 1];
					setStreamingComponentVisibility(prevVisibility => ({
						...prevVisibility,
						[lastMessage.id]: false
					}));
				}
				
				return historyData;
			});
			
			setLatestMessageId(historyData[historyData.length - 1].id);

            
			setIsStreaming(false); // Set streaming to false when done
			setHasActiveStream(false);
			streamReaderRef.current = null; // Clear reader reference
			
			// Hide streaming component by default when streaming finishes
			// We need to wait for the messages to be updated with server data
			// The visibility will be set after the server message is processed
		}
		catch (error) {
			Zotero.debug(error);
			setIsStreaming(false); // Set streaming to false on any error
			setHasActiveStream(false);
			streamReaderRef.current = null; // Clear reader reference
			
			// Even on error, try to fetch message history to ensure UI consistency
			try {
				await new Promise(resolve => setTimeout(resolve, 1000)); // Shorter wait for error case
				
				const historyData = await getMessagesBySessionId(sessionId);
				if (historyData && historyData.length > 0) {
					setMessages(historyData);
					setLatestMessageId(historyData[historyData.length - 1].id);
					
					// Hide streaming component by default when streaming finishes (even on error)
					const lastMessage = historyData[historyData.length - 1];
					setStreamingComponentVisibility(prevVisibility => ({
						...prevVisibility,
						[lastMessage.id]: false
					}));
				}
			}
			catch (historyError) {
				Zotero.debug(historyError);
			}
			
			throw error;
		}
	};


	const _appendMessage = async (sender, message) => {
		// Process subMessages
		if (message.subMessages && message.subMessages.length > 0) {
			// Create a new message object with processed subMessages
			const processedMessage = {
				...message,
				subMessages: await Promise.all(message.subMessages.map(async (subMessage) => {
					// Process sources if they exist
					if (subMessage.sources && subMessage.sources.length > 0) {
						// Store source data in Zotero.Prefs for history sessions
						subMessage.sources.forEach((source, sourceIndex) => {
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
						});
						
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


			// Auto-scrolling is handled by useEffect hooks
		}
	};

	const handleQuestionClick = async (question) => {
		// Set the input value to the question
		// Trigger send
		await userSendMessage(question);
	};

	const handleContextButtonClick = () => {
		setShowContextPopup(!showContextPopup);
	};

	const handleContextDocumentClick = async (contextDoc) => {
		try {
			// Get the item and open it
			const item = Zotero.Items.get(contextDoc.zoteroAttachmentId);
			if (!item) {
				return;
			}

			// Open the document in the reader at first page
			await Zotero.FileHandlers.open(item, {
				location: {
					pageIndex: 0 // Start at first page
				}
			});
            
			// Close the popup after opening document
			setShowContextPopup(false);
		}
		catch (error) {
			Zotero.debug(error);
		}
	};

	const renderMessage = (message, index) => {
		return (
			<DeepTutorChatBoxMessage
				key={`message-${message.id || index}`}
				message={message}
				index={index}
				messages={messages}
				sessionId={sessionId}
				_documentIds={documentIds}
				currentSession={currentSession}
				noteContainer={noteContainer}
				isSavingNote={isSavingNote}
				iniWait={iniWait}
				streamingComponentVisibility={streamingComponentVisibility}
				toggleStreamingComponent={toggleStreamingComponent}
				handleQuestionClick={handleQuestionClick}
				setHoveredQuestion={setHoveredQuestion}
				hoveredQuestion={hoveredQuestion}
				colors={colors}
				theme={theme}
				handleShowNoteSavePopup={handleShowNoteSavePopup}
			/>
		);
	};

	// Add new useEffect after the existing one
	useEffect(() => {
		const openAllDocuments = async () => {
			if (documentIds && documentIds.length > 0 && sessionId) {
				// Try to get the mapping from local storage
				const storageKey = `deeptutor_mapping_${sessionId}`;
				const mappingStr = Zotero.Prefs.get(storageKey);
				let mapping = {};
				
				if (mappingStr) {
					mapping = JSON.parse(mappingStr);
				}

				// Open all documents in order
				for (let i = 0; i < documentIds.length; i++) {
					const documentId = documentIds[i];
					try {
						let zoteroAttachmentId = documentId;

						// If we have a mapping for this document ID, use it
						if (mapping[documentId]) {
							zoteroAttachmentId = mapping[documentId];
						}

						// Get the item and open it
						const item = Zotero.Items.get(zoteroAttachmentId);
						if (!item) {
							continue; // Skip this document and continue with the next one
						}

						// Open the document in the reader
						await Zotero.FileHandlers.open(item, {
							location: {
								pageIndex: 0 // Start at first page
							}
						});
						
						// Add a small delay between opening documents to avoid overwhelming the UI
						if (i < documentIds.length - 1) {
							await new Promise(resolve => setTimeout(resolve, 500));
						}
					}
					catch (error) {
						Zotero.debug(error);
					}
				}
			}
		};
		openAllDocuments();
	}, [documentIds, sessionId]); // Dependencies array

	// Load context documents when documentIds change
	useEffect(() => {
		const loadContextDocuments = async () => {
			if (!documentIds?.length || !sessionId) {
				setContextDocuments([]);
				return;
			}
            
			try {
				const mapping = getDocumentMapping();
				const contextDocs = await Promise.allSettled(
					documentIds.map(id => processDocument(id, mapping))
				);
				
				const successfulDocs = contextDocs
					.filter(result => result.status === "fulfilled")
					.map(result => result.value);
				
				// Log any failures
				contextDocs
					.filter(result => result.status === "rejected")
					.forEach(result => Zotero.debug(result.reason));

				setContextDocuments(successfulDocs);
				setNoteContainerFromDocuments(successfulDocs);
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error loading context documents: ${error.message}`);
				setContextDocuments([]);
				setNoteContainer(null);
			}
		};

		const getDocumentMapping = () => {
			const storageKey = `deeptutor_mapping_${sessionId}`;
			const mappingStr = Zotero.Prefs.get(storageKey);
			return mappingStr ? JSON.parse(mappingStr) : {};
		};

		const processDocument = async (documentId, mapping) => {
			const zoteroAttachmentId = mapping[documentId] || documentId;
			const item = Zotero.Items.get(zoteroAttachmentId);
			
			if (!item) {
				return createFallbackDocument(documentId);
			}

			const documentName = getDocumentName(item);
			const filePath = await getDocumentFilePath(item);

			return {
				documentId,
				zoteroAttachmentId,
				name: documentName,
				filePath
			};
		};

		const getDocumentName = (item) => {
			return item.attachmentFilename
				|| (item.getDisplayTitle && item.getDisplayTitle())
				|| (item.parentItem && Zotero.Items.get(item.parentItem)?.getDisplayTitle?.())
				|| "Document Not Found";
		};

		const getDocumentFilePath = async (item) => {
			if (!item.isAttachment?.()) return null;
			
			try {
				const filePath = await item.getFilePathAsync();
				if (!filePath) return null;
				
				const maxPathLength = 60;
				if (filePath.length <= maxPathLength) return filePath;
				
				const pathParts = filePath.split(/[/\\]/);
				const filename = pathParts[pathParts.length - 1];
				const pathPrefix = filePath.substring(0, maxPathLength - filename.length - 3);
				return `${pathPrefix}...${filename}`;
			}
			catch (error) {
				Zotero.debug(error);
				return null;
			}
		};

		const createFallbackDocument = documentId => ({
			documentId,
			zoteroAttachmentId: documentId,
			name: "Document Not Found",
			filePath: null
		});

		const setNoteContainerFromDocuments = (docs) => {
			if (!docs.length) {
				setNoteContainer(null);
				return;
			}

			try {
				const firstDoc = docs[0];
				const firstItem = Zotero.Items.get(firstDoc.zoteroAttachmentId);
				
				if (!firstItem) {
					setNoteContainer(null);
					return;
				}

				let parentItemId = null;
				
				if (firstItem.isAttachment() && firstItem.parentID) {
					const parentItem = Zotero.Items.get(firstItem.parentID);
					if (parentItem?.isRegularItem()) {
						parentItemId = firstItem.parentID;
					}
				}
				else if (firstItem.isRegularItem()) {
					parentItemId = firstItem.id;
				}

				setNoteContainer(parentItemId);
			}
			catch (error) {
				Zotero.debug(error);
				setNoteContainer(null);
			}
		};

		loadContextDocuments();
	}, [documentIds, sessionId]);

	// Handle click outside context popup
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (contextPopupRef.current && !contextPopupRef.current.contains(event.target)) {
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
						catch {
							// Zotero.debug(`DeepTutorChatBox: Error opening document ${documentId}: ${error.message}`);
							// Zotero.debug(`DeepTutorChatBox: Error stack: ${error.stack}`);
							// Continue with the next document even if this one fails
						}
					}
				}
				catch {
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
						let documentName = "Document Not Found"; // fallback to "Document Not Found"
						let filePath = null;

						if (item) {
							// Prioritize attachment filename first
							if (item.attachmentFilename) {
								documentName = item.attachmentFilename;
							}
							// Fall back to display title if no filename
							else if (item.getDisplayTitle) {
								documentName = item.getDisplayTitle();
							}
							// Finally try parent item title
							else if (item.parentItem) {
								const parentItem = Zotero.Items.get(item.parentItem);
								if (parentItem && parentItem.getDisplayTitle) {
									documentName = parentItem.getDisplayTitle();
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
								catch {
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
					catch {
						// Zotero.debug(`DeepTutorChatBox: Error processing document ${documentId}: ${error.message}`);
						// Add with fallback name
						contextDocs.push({
							documentId: documentId,
							zoteroAttachmentId: documentId,
							name: "Document Not Found",
							filePath: null
						});
					}
				}

				// Zotero.debug(`DeepTutorChatBox: Loaded ${contextDocs.length} context documents`);
				setContextDocuments(contextDocs);
				
				// Set noteContainer to the parent of the first document (or the first document itself if it's a regular item)
				if (contextDocs.length > 0) {
					try {
						const firstDoc = contextDocs[0];
						const firstItem = Zotero.Items.get(firstDoc.zoteroAttachmentId);
						
						if (firstItem) {
							let parentItemId = null;
							
							// If the item is an attachment, get its parent
							if (firstItem.isAttachment() && firstItem.parentID) {
								parentItemId = firstItem.parentID;
								const parentItem = Zotero.Items.get(parentItemId);
								if (parentItem && parentItem.isRegularItem()) {
									setNoteContainer(parentItemId);
								}
							}
							// If the item is a regular item itself, use it as the container
							else if (firstItem.isRegularItem()) {
								parentItemId = firstItem.id;
								setNoteContainer(parentItemId);
							}
							// If no suitable parent found, log this
							else {
								setNoteContainer(null);
							}
						}
						else {
							setNoteContainer(null);
						}
					}
					catch (error) {
						Zotero.debug(error);
						setNoteContainer(null);
					}
				}
				else {
					setNoteContainer(null);
				}
			}
			catch {
				// Zotero.debug(`DeepTutorChatBox: Error loading context documents: ${error.message}`);
				setContextDocuments([]);
				setNoteContainer(null);
			}
		};

		loadContextDocuments();
	}, [documentIds, sessionId]);

	// Handle click outside context popup
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (contextPopupRef.current && !contextPopupRef.current.contains(event.target)) {
				setShowContextPopup(false);
			}
		};

		if (showContextPopup) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
		return undefined; // Explicit return for linter
	}, [showContextPopup]);


	// Communicate iniWait state changes to parent component
	useEffect(() => {
		if (onInitWaitChange) {
			onInitWaitChange(iniWait);
		}
	}, [iniWait, onInitWaitChange]);

	// Add cleanup function
	const cleanupSourceData = (oldSessionId) => {
		if (!oldSessionId) return;
		
		// Clean up source data for previous session, but preserve current session data
		currentSourceIndices.forEach((sourceIndex) => {
			const storageKey = `deeptutor_source_${oldSessionId}_${sourceIndex}`;
			try {
				if (Zotero.Prefs.get(storageKey)) {
					Zotero.Prefs.clear(storageKey);
				}
			}
			catch (error) {
				Zotero.debug(error);
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
				// Only cleanup if we're actually unmounting, not just switching sessions
				// This prevents removing source data that might be needed
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
			while (node !== null) {
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
					// Text copied successfully
				}).catch((err) => {
					Zotero.debug(err);
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
			{/* Add CSS styles for markdown tables and source buttons */}
			<style dangerouslySetInnerHTML={{
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
						background: ${colors.table.background};
						table-layout: auto;
					}
					.markdown thead {
						background: ${colors.table.header};
					}
					.markdown tbody {
						background: ${colors.table.background};
					}
					.markdown tr {
						border-bottom: 0.0625rem solid ${colors.table.border};
					}
					.markdown tr:last-child {
						border-bottom: none;
					}
					.markdown tr:hover {
						background: ${colors.table.hover};
					}
					.markdown th {
						padding: 0.75rem 0.5rem;
						text-align: left;
						font-weight: 600;
						color: ${colors.text.allText};
						border-bottom: 0.125rem solid ${colors.table.border};
						background: ${colors.table.header};
						font-size: 1.0rem;
						line-height: 1.6;
						white-space: normal;
						vertical-align: top;
					}
					.markdown td {
						padding: 0.75rem 0.5rem;
						text-align: left;
						color: ${colors.text.allText};
						border-bottom: 0.0625rem solid ${colors.table.border};
						border-right: 0.0625rem solid ${colors.table.border};
						border-left: 0.0625rem solid ${colors.table.border};
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
					/* Special styling for streaming source placeholders within tables */
					.markdown table .deeptutor-source-placeholder-streaming {
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
						background: ${colors.button.primaryHover} !important;
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
					/* Hide horizontal rules completely */
					.markdown hr,
					hr {
						display: none !important;
						border: none !important;
						margin: 0 !important;
						padding: 0 !important;
						height: 0 !important;
						width: 0 !important;
						visibility: hidden !important;
					}
					
					/* Image styling - make images fit their parent container */
					.markdown img {
						max-width: 100% !important;
						height: auto !important;
						display: block !important;
						margin: 0.5rem auto !important;
						border-radius: 0.375rem !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1) !important;
						object-fit: contain !important;
					}
					
					/* Ensure images don't overflow their containers */
					.markdown p img,
					.markdown div img {
						max-width: 100% !important;
						width: auto !important;
						height: auto !important;
					}
					
					/* Responsive image handling for different screen sizes */
					@media (max-width: 768px) {
						.markdown img {
							max-width: 95% !important;
							margin: 0.375rem auto !important;
						}
					}
				`
			}} />
            
			<div style={styles.sessionNameDiv}>
				<div style={styles.sessionNameText}>
					{currentSession?.sessionName || "New Session"}
				</div>
				<button
					style={styles.renameIconButton}
					onClick={handleRenameClick}
					title="Rename Session"
				>
					<img
						src={renameIconPath}
						alt="Rename"
						style={styles.renameIcon}
					/>
				</button>
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
										...(hoveredContextDoc === index
											? {
												...styles.contextDocumentButtonHover,
												background: contextDoc.filePath
													? (theme === 'light' ? '#F8F6F7' : colors.background.primary)
													: colors.background.secondary, // Light mode pearl hover, dark mode theme-aware
											}
											: {
												background: contextDoc.filePath
													? (theme === 'light' ? '#FFFFFF' : colors.background.quaternary)
													: colors.background.secondary // Light mode white, dark mode theme-aware
											}),
										borderBottom: index === contextDocuments.length - 1 ? "none" : `0.0625rem solid ${colors.border.primary}`,
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
										color: colors.text.primary,
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
											color: colors.text.tertiary,
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
									color: colors.text.tertiary,
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
				{/* Show waiting message with thinking animation when backend is processing (but NOT during active streaming) */}
				{waitingStreaming && !hasActiveStream && (() => {
					Zotero.debug(`DeepTutorChatBox: Rendering waiting message with thinking animation`);
					return renderMessage({
						id: 'waiting-message',
						role: MessageRole.TUTOR,
						subMessages: [{ text: '' }],
						isStreaming: true,
						streamText: '<thinking></thinking>',
						creationTime: new Date().toISOString()
					}, messages.length);
				})()}
			</div>

			<div style={styles.bottomBar}>
				<textarea
					ref={textareaRef}
					style={{
						...styles.textInput,
						opacity: iniWait ? 0.5 : 1,
						cursor: iniWait ? "not-allowed" : "text",
						color: colors.text.primary
					}}
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey && !iniWait && !isStreaming) {
							e.preventDefault(); // Prevent adding a new line
							handleSend();
						}
						// Shift+Enter allows new line (default behavior)
					}}
					placeholder={`Ask DeepTutor ${curSessionType === SessionType.LITE ? "Standard" : curSessionType === SessionType.BASIC ? "Advanced" : curSessionType.toLowerCase()}`}
					rows={1}
					disabled={iniWait}
				/>
				<style>
					{`
					textarea::placeholder {
						color: ${colors.text.tertiary} !important;
						opacity: 1;
					}
					`}
				</style>
				<button
					style={{
						...styles.sendButton,
						opacity: iniWait ? 0.5 : 1,
						cursor: iniWait ? "not-allowed" : "pointer"
					}}
					onClick={(hasActiveStream || waitingStreaming) ? handleStopStreaming : handleSend}
					disabled={iniWait}
					title={(hasActiveStream || waitingStreaming) ? "Stop Thinking" : "Send"}
				>
					<img
						src={(hasActiveStream || waitingStreaming) ? StopIconPath : SendIconPath}
						alt={(hasActiveStream || waitingStreaming) ? "Stop" : "Send"}
						style={styles.sendIcon}
					/>
				</button>
			</div>
			
			{/* Rename popup */}
			{showRenamePopup && currentSession && (
				<div style={styles.renamePopupOverlay} onClick={handleRenameCancel}>
					<div onClick={e => e.stopPropagation()}>
						<DeepTutorRenameSession
							sessionId={currentSession.id}
							currentSessionName={currentSession.sessionName || "New Session"}
							onConfirmRename={handleRenameConfirm}
							onCancelRename={handleRenameCancel}
						/>
					</div>
				</div>
			)}
		</div>
	);
};

DeepTutorChatBox.propTypes = {
	currentSession: PropTypes.object,
	onSessionSelect: PropTypes.func,
	onInitWaitChange: PropTypes.func,
	handleShowNoteSavePopup: PropTypes.func
};

export default DeepTutorChatBox;
