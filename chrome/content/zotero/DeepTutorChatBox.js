import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
	createMessage,
	getMessagesBySessionId,
	getDocumentById,
	subscribeToChat,
	getSessionById
} from './api/libs/api';
import { viewAttachment } from './elements/callZoteroPane';
// import ReactMarkdown from 'react-markdown';

// Enums
const SessionStatus = {
	CREATED: 'CREATED',
	READY: 'READY',
	PROCESSING_ERROR: 'PROCESSING_ERROR',
	FINAL_PROCESSING_ERROR: 'FINAL_PROCESSING_ERROR',
	PROCESSING: 'PROCESSING',
	DELETED: 'DELETED'
};

class Conversation {
	constructor({
		userId = null,
		sessionId = null,
		ragSessionId = null,
		storagePaths = [],
		history = [],
		message = null,
		streaming = false,
		type = null
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
		padding: '1.875rem 1.25rem 0 1.25rem',
		boxSizing: 'border-box',
	},
	sessionNameDiv: {
		width: '100%',
		marginBottom: '1.25rem',
		color: '#000000',
		fontWeight: 500,
		fontSize: '1rem',
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
	},
	bottomBar: {
		width: '100%',
		background: '#F8F6F7',
		boxShadow: '0 -0.0625rem 0.1875rem rgba(0,0,0,0.08)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		fontFamily: 'Roboto, sans-serif',
		position: 'relative',
		zIndex: 1,
		border: '0.0625rem solid #D9D9D9',
		borderRadius: '0.5rem',
		boxSizing: 'border-box',
		minHeight: '2.5rem',
		maxHeight: '3.5rem',
		padding: '0.5rem',
	},
	textInput: {
		flex: 1,
		padding: '0.5rem 0.75rem',
		border: 'none',
		outline: 'none',
		borderRadius: '0.625rem',
		background: '#F8F6F7',
		color: '#1a65b0',
		minHeight: '1.5rem',
		maxHeight: '2rem',
		fontSize: '0.95rem',
		overflowY: 'auto',
		fontFamily: 'Roboto, sans-serif',
		resize: 'none',
		height: 'auto',
		marginRight: '0.625rem',
		alignSelf: 'stretch',
		':focus': {
			outline: 'none',
			border: 'none',
			boxShadow: 'none'
		}
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
		padding: '0.625rem 1.25rem',
		borderRadius: '0.625rem',
		maxWidth: '100%',
		boxShadow: 'none',
		animation: 'slideIn 0.3s ease-out forwards',
		height: 'auto',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
		boxSizing: 'border-box',
		overflowWrap: 'break-word',
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
		maxWidth: '75%',
		fontSize: '0.875rem',
		lineHeight: '1.35',
		padding: '0.625rem 1.25rem',
		gap: '0.625rem',
		minHeight: '2.4375rem',
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
	senderLabel: {
		fontWeight: 'bold',
		marginBottom: '0.25rem',
		display: 'block',
	},
	messageText: {
		display: 'block',
		maxWidth: '100%',
		overflowWrap: 'break-word',
		wordBreak: 'break-word',
	},
	sourcesContainer: {
		marginTop: '0.5rem',
		display: 'flex',
		gap: '0.5rem',
		flexWrap: 'wrap',
		width: '100%',
		boxSizing: 'border-box',
	},
	sourceButton: {
		all: 'revert',
		background: '#0687E5',
        opacity: 0.4,
		color: 'white',
		border: 'none',
		borderRadius: '50%',
		width: '2rem',
		height: '2rem',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontWeight: 600,
		fontSize: '0.875rem',
		cursor: 'pointer',
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
		padding: 0,
		transition: 'background 0.2s',
	},
	questionContainer: {
		all: 'revert',
		width: '100%',
		margin: '0.5rem 0',
		display: 'flex',
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
		maxWidth: '100%',
		fontWeight: 500,
		fontSize: '1rem',
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
	sessionTabBar: {
		height: '1.8125rem',
		background: '#F2F2F2',
		display: 'flex',
		alignItems: 'center',
		padding: '0 0.5rem',
		gap: '0.625rem',
		borderBottom: '0.0625rem solid #E0E0E0',
		width: '100%',
		boxSizing: 'border-box',
	},
	sessionTab: {
		all: 'revert',
		gap: '0.625rem',
		borderRadius: '0.1875rem',
		padding: '0.3125rem 0.625rem',
		minWidth: 'fit-content',
		background: '#D9D9D9',
		fontSize: '0.8125rem',
		fontWeight: 400,
		color: '#292929',
		cursor: 'pointer',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		border: 'none',
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		boxSizing: 'border-box'
	},
	activeSessionTab: {
		background: '#FFFFFF',
		color: '#1C1B1F',
		border: 'none',
		boxSizing: 'border-box',
	},
	sessionTabClose: {
		all: 'revert',
		width: '0.5825rem',
		height: '0.5825rem',
		marginLeft: '0.3125rem',
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '0',
		background: 'none',
		border: 'none'
	},
	sessionTabCloseIcon: {
		width: '0.5825rem',
		height: '0.5825rem',
		objectFit: 'contain'
	},
	sessionPopup: {
		position: 'absolute',
		top: '1.8125rem',
		right: '0.5rem',
		background: '#FFFFFF',
		border: '0.0625rem solid #E0E0E0',
		borderRadius: '0.25rem',
		boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
		zIndex: 1000,
		minWidth: '9.375rem',
	},
	sessionPopupItem: {
		padding: '0.5rem 0.75rem',
		fontSize: '0.8125rem',
		color: '#292929',
		cursor: 'pointer',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		background: '#FFFFFF',
		border: 'none',
		width: '100%',
		textAlign: 'left',
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
		fontSize: '1rem',
		fontWeight: 500,
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
		maxHeight: '10rem',
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
};

const SendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/RES_SEND.svg';
const SessionTabClosePath = 'chrome://zotero/content/DeepTutorMaterials/Chat/CHAT_SES_TAB_CLOSE.svg';
const ArrowDownPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/CHAT_ARROWDOWN.svg';

const DeepTutorChatBox = ({ currentSession, key, onSessionSelect }) => {
	const [messages, setMessages] = useState([]);
	const [inputValue, setInputValue] = useState('');
	const [sessionId, setSessionId] = useState(null);
	const [userId, setUserId] = useState(null);
	const [documentIds, setDocumentIds] = useState([]);
	const [latestMessageId, setLatestMessageId] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const [storagePathsState, setStoragePathsState] = useState([]);
	const [recentSessions, setRecentSessions] = useState(new Map());
	const [showSessionPopup, setShowSessionPopup] = useState(false);
	const MAX_VISIBLE_SESSIONS = 2;
	const chatLogRef = useRef(null);
	const contextPopupRef = useRef(null);
	const [hoveredContextDoc, setHoveredContextDoc] = useState(null);
	// Removed hoveredQuestion and hoveredPopupSession states - these were causing unnecessary re-renders
	// const [hoveredQuestion, setHoveredQuestion] = useState(null);
	// const [hoveredPopupSession, setHoveredPopupSession] = useState(null);
	const [iniWait, setInitWait] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const isAutoScrollingRef = useRef(true);
	const [showContextPopup, setShowContextPopup] = useState(false);
	const [contextDocuments, setContextDocuments] = useState([]);

	// Load recent sessions from preferences on component mount
	useEffect(() => {
		const loadRecentSessions = () => {
			try {
				const storedSessions = Zotero.Prefs.get('deeptutor.recentSessions');
				if (storedSessions) {
					const parsedSessions = JSON.parse(storedSessions);
					const sessionsMap = new Map(Object.entries(parsedSessions));
					setRecentSessions(sessionsMap);
					Zotero.debug(`DeepTutorChatBox: Loaded ${sessionsMap.size} recent sessions from preferences`);
				}
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error loading recent sessions from preferences: ${error.message}`);
			}
		};
		loadRecentSessions();
	}, []);

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

				// Update recent sessions immediately
				Zotero.debug(`Current recent sessions TTT: ${JSON.stringify(recentSessions)}`);
				await updateRecentSessions(currentSession.id);
				Zotero.debug(`DeepTutorChatBox: Updated recent sessions for session ${currentSession.id}`);
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
			type: currentSession?.type || SessionType.BASIC,
			storagePaths: storagePathsState
		}));
		Zotero.debug(`DeepTutorChatBox: Conversation state updated with sessionId: ${sessionId}, userId: ${userId}`);
	}, [sessionId, userId, documentIds, currentSession]);

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
					for (const [index, message] of sessionMessages.entries()) {
						const sender = message.role === MessageRole.USER ? 'You' : 'DeepTutor';
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

	const [curSessionObj, setCurSessionObj] = useState(null);
	const [pdfDataList, setPdfDataList] = useState([]);
	const [showModelPopup, setShowModelPopup] = useState(false);
	const [showImagePopup, setShowImagePopup] = useState(false);

	const modelSelectionRef = useRef(null);

	// Conversation state
	const [conversation, setConversation] = useState({
		userId: null,
		sessionId: null,
		ragSessionId: null,
		storagePaths: [],
		history: [],
		message: null,
		streaming: true,
		type: currentSession?.type || SessionType.BASIC
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
		setUserId('67f5b836cb8bb15b67a1149e');
        
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
			const response = await sendToAPI(userMessage);
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

	const handleSend = async () => {
		setInputValue('');
		await userSendMessage(inputValue);
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
				type: currentSession?.type || SessionType.BASIC
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

			// Create initial empty message for TUTOR
			Zotero.debug(`DeepTutorChatBox: Creating initial empty message for TUTOR`);
			const initialTutorMessage = {
				subMessages: [{
					text: "",
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				role: MessageRole.TUTOR,
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.UNVIEW
			};
            
			// Add the empty message to messages
			await new Promise((resolve) => {
				setMessages((prev) => {
					resolve();
					return [...prev, initialTutorMessage];
				});
			});

			while (true) {
				const { done, value } = await reader.read();
                
				// Check for timeout
				if (Date.now() - lastDataTime > 30000) {
					setIsStreaming(false); // Set streaming to false on timeout
					throw new Error('Stream timeout - no data received for 30 seconds');
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
                            
							// Create a temporary message to display the stream
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
								status: MessageStatus.UNVIEW
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
			throw error;
		}
	};

	const handleFileUpload = async (files) => {
		// Implementation for file upload
	};

	const handleModelSelection = (modelData) => {
		// Implementation for model selection
	};

	/*
    const loadMessages = async (newMessages, newDocumentIds, sessionObj) => {
        Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION called with ${newMessages.length} messages, ${newDocumentIds?.length || 0} document IDs, sessionObj: ${sessionObj?.id || 'null'}`);
        
        // Update session and user IDs early
        if (sessionObj) {
            Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - Setting session ID to ${sessionObj.id} and user ID to ${sessionObj.userId}`);
            // Use Promise to ensure state updates complete
            await new Promise(resolve => {
                setSessionId(sessionObj.id);
                setUserId(sessionObj.userId);
                resolve();
            });
        }

        setDocumentIds(newDocumentIds || []);
        setCurSessionObj(sessionObj);
        setUserId(sessionObj.userId || null);
        setSessionId(sessionObj.id || null);

        // Update session info display
        if (newMessages.length > 0) {
            Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - Updating session info for existing messages`);
            _updateSessionInfo(newMessages[0].sessionId, newDocumentIds);
        }

        // Fetch document information
        const newDocumentFiles = [];
        for (const documentId of newDocumentIds || []) {
            try {
                const newDocData = await getDocumentById(documentId);
                Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - New session document: ${JSON.stringify(newDocData)}`);
                newDocumentFiles.push(newDocData);
            } catch (error) {
                Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - Error fetching document ${documentId}: ${error.message}`);
            }
        }

        // Update conversation state
        setConversation(prev => ({
            ...prev,
            userId: sessionObj?.userId || null,
            sessionId: sessionObj?.id || null,
            documentIds: newDocumentFiles.map(doc => doc.fileId),
            storagePaths: newDocumentFiles.map(doc => doc.storagePath),
            type: sessionObj?.type || SessionType.BASIC,
            history: [] // Will be populated by _appendMessage
        }));

        // Clear existing messages
        setMessages([]);

        // Process and append each message
        if (newMessages.length > 0) {
            Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - Processing ${newMessages.length} existing messages`);
            setLatestMessageId(newMessages[newMessages.length - 1].id);
            Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - Latest message ID set to ${newMessages[newMessages.length - 1].id}`);

            // Append each message using _appendMessage
            for (const message of newMessages) {
                const sender = message.role === MessageRole.USER ? 'You' : 'DeepTutor';
                await _appendMessage(sender, message);
            }
            Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - Finished processing all existing messages`);
        } else {
            Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - No new messages to load`);
            // Wait a bit to ensure state updates are complete
            // Call onNewSession with the current session object
            if (sessionObj) {
                Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - Calling onNewSession for empty session ${sessionObj.id}`);
                await onNewSession(sessionObj);
                Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - onNewSession completed for session ${sessionObj.id}`);
            } else {
                Zotero.debug(`DeepTutorChatBox: loadMessages FUNCTION - Cannot call onNewSession - session object is null`);
            }
        }

        // Scroll to bottom after all messages are loaded
        /*
        if (chatLogRef.current) {
            setTimeout(() => {
                chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
            }, 100);
        }
        
    };
    */

	const _updateSessionInfo = (newSessionId, newDocumentIds) => {
		Zotero.debug(`DeepTutorChatBox: Updating session info - Session ID: ${newSessionId}, Document IDs: ${newDocumentIds?.length || 0}`);
		setSessionId(newSessionId);
		setDocumentIds(newDocumentIds || []);
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

	const onNewSession = async (newSession) => {
		try {
			Zotero.debug(`DeepTutorChatBox: onNewSession CALLED for session ${newSession?.id || 'null'}: ${JSON.stringify(newSession)}`);
            
			// Check if session is too recent
			const sessionCreationTime = new Date(newSession.creationTime);
			const now = new Date();
			const timeDiff = (now - sessionCreationTime) / 1000; // Convert to seconds
            
			Zotero.debug(`DeepTutorChatBox: onNewSession - Session ${newSession.id} creation time: ${sessionCreationTime.toISOString()}`);
			Zotero.debug(`DeepTutorChatBox: onNewSession - Current time: ${now.toISOString()}`);
			Zotero.debug(`DeepTutorChatBox: onNewSession - Time difference: ${timeDiff} seconds`);
            
			if (timeDiff < 15) {
				// Wait for remaining time
				const waitTime = Math.ceil(15 - timeDiff) * 1000;
				Zotero.debug(`DeepTutorChatBox: onNewSession - Session ${newSession.id} is too recent, waiting for ${Math.ceil(15 - timeDiff)} seconds (${waitTime}ms)`);
				await new Promise(resolve => setTimeout(resolve, waitTime));
				Zotero.debug(`DeepTutorChatBox: onNewSession - Finished waiting for session ${newSession.id}`);
			}
			else {
				Zotero.debug(`DeepTutorChatBox: onNewSession - Session ${newSession.id} is old enough, no waiting needed`);
			}
            
			// Update userId and sessionId
			// setUserId(newSession.userId);
			//setSessionId(newSession.id);
			Zotero.debug(`DeepTutorChatBox: onNewSession - SENDING AUTOMATIC SUMMARY MESSAGE for session ${newSession.id}`);
			await userSendMessage("Can you give me a summary of this document?");
			Zotero.debug(`DeepTutorChatBox: onNewSession - AUTOMATIC SUMMARY MESSAGE SENT for session ${newSession.id}`);
		}
		catch (error) {
			Zotero.debug(`DeepTutorChatBox: onNewSession - ERROR for session ${newSession?.id || 'null'}: ${error.message}`);
			Zotero.debug(`DeepTutorChatBox: onNewSession - ERROR stack: ${error.stack}`);
		}
	};

	const renderMessage = (message, index) => {
		// Return nothing if it's the first message and from user
		if (index === 0 && message.role === MessageRole.USER) {
			return null;
		}
        
		const isUser = message.role === MessageRole.USER;
		const messageStyle = {
			...styles.messageContainer,
			animation: 'fadeIn 0.3s ease-in-out'
		};
        
		return (
			<div key={message.id || index} style={styles.messageStyle}>
				<div style={{
					...styles.messageBubble,
					...(isUser ? styles.userMessage : styles.botMessage),
					animation: 'slideIn 0.3s ease-out'
				}}>
					{message.subMessages.map((subMessage, subIndex) => (
						<div key={subIndex} style={styles.messageText}>
							{/* Commented out ReactMarkdown implementation
                            <ReactMarkdown
                                className="markdown mb-0 flex flex-col"
                                components={{
                                    h3: ({ children }) => (
                                        <h3 style={{ fontSize: '24px' }}>{children}</h3>
                                    ),
                                    ul: ({ children }) => (
                                        <ul style={{
                                            fontSize: '16px',
                                            marginTop: '0.5em',
                                            marginBottom: '0.5em',
                                            padding: '5',
                                        }}>
                                            {children}
                                        </ul>
                                    ),
                                    li: ({ children }) => (
                                        <li style={{
                                            marginBottom: '0.2em',
                                            fontSize: '16px',
                                            padding: '0',
                                        }}>
                                            {children}
                                        </li>
                                    ),
                                    code: ({ className, children, ...props }) => (
                                        <code
                                            className={className}
                                            style={{
                                                fontSize: '14px',
                                                fontFamily: 'Courier, monospace',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                            }}
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    ),
                                    p: ({ children, ...props }) => (
                                        <p
                                            style={{
                                                margin: '0.1',
                                                padding: '0',
                                                lineHeight: '1.5',
                                            }}
                                            {...props}
                                        >
                                            {children}
                                        </p>
                                    ),
                                }}
                            >
                                {subMessage.text || ''}
                            </ReactMarkdown>
                            */}
							<div style={{
								fontSize: '14px',
								lineHeight: '1.5',
								whiteSpace: 'pre-wrap',
								wordBreak: 'break-word',
								fontFamily: 'Roboto, sans-serif',
								width: '100%',
								boxSizing: 'border-box',
								overflowWrap: 'break-word',
							}}>
								{subMessage.text || ''}
							</div>
							{subMessage.sources && subMessage.sources.length > 0 && (
								<div style={styles.sourcesContainer}>
									{subMessage.sources.map((source, sourceIndex) => (
										<button
											key={sourceIndex}
											style={styles.sourceButton}
											onClick={() => handleSourceClick(source)}
										>
											{source.index + 1}
										</button>
									))}
								</div>
							)}
						</div>
					))}
				</div>
				{index === messages.length - 1 && message.followUpQuestions && message.followUpQuestions.length > 0 && (
					<div style={styles.questionContainer}>
						{message.followUpQuestions.map((question, qIndex) => (
							<button
								key={qIndex}
								style={styles.questionButton}
								onClick={() => handleQuestionClick(question)}
								onMouseEnter={(e) => {
									e.target.style.background = '#D9D9D9';
								}}
								onMouseLeave={(e) => {
									e.target.style.background = '#FFFFFF';
								}}
							>
								{question}
							</button>
						))}
					</div>
				)}
			</div>
		);
	};

	// Add animation styles
	const animationStyles = {
		'@keyframes fadeIn': {
			from: { opacity: 0 },
			to: { opacity: 1 }
		},
		'@keyframes slideIn': {
			from: { transform: 'translateY(20px)', opacity: 0 },
			to: { transform: 'translateY(0)', opacity: 1 }
		}
	};

	// Update styles object with new styles
	const updatedStyles = {
		...styles,
		messageContainer: {
			...styles.messageContainer,
			margin: '12px 0',
			opacity: 0,
			animation: 'fadeIn 0.3s ease-in-out forwards'
		},
		messageBubble: {
			...styles.messageBubble,
			padding: '12px 16px',
			borderRadius: '16px',
			maxWidth: '75%',
			boxShadow: 'none',
			animation: 'slideIn 0.3s ease-out forwards'
		},
		userMessage: {
			...styles.userMessage,
			backgroundColor: '#0AE2FF',
			color: 'white',
			marginLeft: 'auto',
			borderBottomRightRadius: '4px'
		},
		botMessage: {
			...styles.botMessage,
			backgroundColor: '#F8F6F7',
			color: '#212529',
			marginRight: 'auto',
			borderBottomLeftRadius: '4px'
		},
		senderLabel: {
			...styles.senderLabel,
			fontSize: '0.85em',
			opacity: 0.8,
			marginBottom: '4px'
		},
		messageText: {
			...styles.messageText,
			lineHeight: '1.4',
			whiteSpace: 'pre-wrap'
		}
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
							// Try to get the title from the item or its parent
							if (item.getDisplayTitle) {
								documentName = item.getDisplayTitle();
								Zotero.debug(`DeepTutorChatBox: Found item title: ${documentName}`);
							}
							else if (item.parentItem) {
								const parentItem = Zotero.Items.get(item.parentItem);
								if (parentItem && parentItem.getDisplayTitle) {
									documentName = parentItem.getDisplayTitle();
									Zotero.debug(`DeepTutorChatBox: Found parent item title: ${documentName}`);
								}
							}
							// If we still don't have a good name, try using the filename
							if (documentName === documentId && item.attachmentFilename) {
								documentName = item.attachmentFilename;
								Zotero.debug(`DeepTutorChatBox: Using attachment filename: ${documentName}`);
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

	const updateRecentSessions = async (sessionId) => {
		try {
			const session = await getSessionById(sessionId);
			if (!session) {
				Zotero.debug(`DeepTutorChatBox: No session found for ID ${sessionId}`);
				return;
			}

			Zotero.debug(`DeepTutorChatBox: Updating recent sessions with session ${sessionId}`);
			setRecentSessions((prev) => {
				const newMap = new Map(prev);
				// Only add if not already present or if it's a different session
				if (!newMap.has(sessionId)) {
					newMap.set(sessionId, {
						name: session.sessionName || `Session ${sessionId.slice(0, 8)}`,
						lastUpdatedTime: new Date().toISOString() // Use current time for new sessions
					});
					Zotero.debug(`DeepTutorChatBox: Added new session to recent sessions map, now has ${newMap.size} sessions`);
				}
				else {
					// Update the existing session's lastUpdatedTime with current time
					const existingSession = newMap.get(sessionId);
					newMap.set(sessionId, {
						...existingSession,
						lastUpdatedTime: new Date().toISOString() // Use current time for updates
					});
					Zotero.debug(`DeepTutorChatBox: Updated existing session in recent sessions map`);
				}

				// Store in preferences
				const sessionsObject = Object.fromEntries(newMap);
				Zotero.Prefs.set('deeptutor.recentSessions', JSON.stringify(sessionsObject));
				Zotero.debug(`DeepTutorChatBox: Stored ${newMap.size} sessions in preferences`);

				return newMap;
			});
		}
		catch (error) {
			Zotero.debug(`DeepTutorChatBox: Error updating recent sessions: ${error.message}`);
		}
	};

	// Add SessionTabBar component
	const SessionTabBar = () => {
		// Convert Map to sorted array and sort by lastUpdatedTime
		const sortedSessions = Array.from(recentSessions.entries())
            .sort((a, b) => {
            	const timeA = new Date(a[1].lastUpdatedTime || 0).getTime();
            	const timeB = new Date(b[1].lastUpdatedTime || 0).getTime();
            	return timeB - timeA; // Sort in descending order (most recent first)
            });

		Zotero.debug(`DeepTutorChatBox: Rendering SessionTabBar with ${sortedSessions.length} sessions`);
		const visibleSessions = sortedSessions.slice(0, MAX_VISIBLE_SESSIONS);
		const hiddenSessions = sortedSessions.slice(MAX_VISIBLE_SESSIONS);

		const truncateSessionName = (name) => {
			return name.length > 11 ? name.substring(0, 11) + '...' : name;
		};

		const handleSessionClick = async (sessionId) => {
			try {
				// Get the session data
				const session = await getSessionById(sessionId);
				if (!session) {
					Zotero.debug(`DeepTutorChatBox: No session found for ID ${sessionId}`);
					return;
				}

				// Update recent sessions with new timestamp
				await updateRecentSessions(sessionId);

				// Update the current session through props
				if (currentSession?.id !== sessionId) {
					Zotero.debug(`DeepTutorChatBox: Switching to session ${sessionId}`);
					// Use the onSessionSelect prop to switch sessions
					if (onSessionSelect) {
						onSessionSelect(session.id);
					}
				}
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error handling session click: ${error.message}`);
			}
		};

		const handleCloseSession = async (sessionId, event) => {
			event.stopPropagation(); // Prevent session click when closing
            
			// Check if we're closing the active session
			const isActiveSession = sessionId === currentSession?.id;
            
			setRecentSessions((prev) => {
				const newMap = new Map(prev);
				newMap.delete(sessionId);
                
				// Store in preferences
				const sessionsObject = Object.fromEntries(newMap);
				Zotero.Prefs.set('deeptutor.recentSessions', JSON.stringify(sessionsObject));
                
				return newMap;
			});

			// If we closed the active session and there are other sessions, load the next one
			if (isActiveSession) {
				const remainingSessions = Array.from(recentSessions.entries())
                    .filter(([id]) => id !== sessionId)
                    .sort((a, b) => {
                    	const timeA = new Date(a[1].lastUpdatedTime || 0).getTime();
                    	const timeB = new Date(b[1].lastUpdatedTime || 0).getTime();
                    	return timeB - timeA;
                    });

				if (remainingSessions.length > 0) {
					const [nextSessionId, nextSessionData] = remainingSessions[0];
					try {
						const session = await getSessionById(nextSessionId);
						if (session && onSessionSelect) {
							onSessionSelect(session.id);
						}
					}
					catch (error) {
						Zotero.debug(`DeepTutorChatBox: Error loading next session: ${error.message}`);
					}
				}
			}
		};

		return (
			<div style={styles.sessionTabBar}>
				{visibleSessions.map(([sessionId, sessionData]) => (
					<button
						key={sessionId}
						style={{
							...styles.sessionTab,
							...(sessionId === currentSession?.id ? styles.activeSessionTab : {})
						}}
						onClick={() => handleSessionClick(sessionId)}
					>
						{truncateSessionName(sessionData.name)}
						<button
							style={styles.sessionTabClose}
							onClick={e => handleCloseSession(sessionId, e)}
						>
							<img
								src={SessionTabClosePath}
								alt="Close"
								style={styles.sessionTabCloseIcon}
							/>
						</button>
					</button>
				))}
				{hiddenSessions.length > 0 && (
					<div style={{ position: 'relative' }}>
						<button
							style={styles.sessionTab}
							onClick={() => setShowSessionPopup(!showSessionPopup)}
						>
                            More ({hiddenSessions.length})
						</button>
						{showSessionPopup && (
							<div style={styles.sessionPopup}>
								{hiddenSessions.map(([sessionId, sessionData]) => (
									<div
										key={sessionId}
										style={styles.sessionPopupItem}
										onClick={() => {
											handleSessionClick(sessionId);
											setShowSessionPopup(false);
										}}
										onMouseEnter={(e) => {
											e.target.style.background = '#D9D9D9';
										}}
										onMouseLeave={(e) => {
											e.target.style.background = '#FFFFFF';
										}}
									>
										{truncateSessionName(sessionData.name)}
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		);
	};

	return (
		<div style={styles.container}>
			{isLoading && <LoadingPopup />}
            
			<div style={styles.sessionNameDiv}>
				{currentSession?.sessionName || 'New Session'}
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
						{contextDocuments.length > 0 ? (
							contextDocuments.map((contextDoc, index) => (
								<button
									key={contextDoc.documentId}
									style={{
										...styles.contextDocumentButton,
										...(hoveredContextDoc === index ? styles.contextDocumentButtonHover : {}),
										borderBottom: index === contextDocuments.length - 1 ? 'none' : '0.0625rem solid #E0E0E0',
										flexDirection: 'column',
										alignItems: 'flex-start',
										padding: '0.75rem 0.9375rem',
										minHeight: contextDoc.filePath ? '3rem' : 'auto',
										background: '#FFFFFF',
										gap: '0.3125rem'
									}}
									onClick={() => handleContextDocumentClick(contextDoc)}
									onMouseEnter={() => setHoveredContextDoc(index)}
									onMouseLeave={() => setHoveredContextDoc(null)}
									title={contextDoc.filePath ? `${contextDoc.name}\n${contextDoc.filePath}` : contextDoc.name} // Show full info on hover
								>
									<div style={{
										fontSize: '1rem',
										fontWeight: 400,
										color: '#1C1B1F',
										lineHeight: '180%',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
										width: '100%'
									}}>
										{contextDoc.name}
									</div>
									{contextDoc.filePath && (
										<div style={{
											fontSize: '0.875rem',
											fontWeight: 400,
											color: '#757575',
											lineHeight: '135%',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
											width: '100%',
											fontStyle: 'italic'
										}}>
											{contextDoc.filePath}
										</div>
									)}
								</button>
							))
						) : (
							<div style={{
								padding: '0.75rem',
								color: '#757575',
								fontSize: '0.875rem',
								textAlign: 'center',
								fontStyle: 'italic'
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
					style={{
						...styles.textInput,
						opacity: isStreaming || iniWait ? 0.5 : 1,
						cursor: isStreaming || iniWait ? 'not-allowed' : 'text'
					}}
					value={inputValue}
					onChange={e => setInputValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey && !isStreaming && !iniWait) {
							e.preventDefault(); // Prevent adding a new line
							handleSend();
						}
						// Shift+Enter allows new line (default behavior)
					}}
					placeholder="Type your message..."
					rows={1}
					disabled={isStreaming || iniWait}
				/>
				<button
					style={{
						...styles.sendButton,
						opacity: isStreaming || iniWait ? 0.5 : 1,
						cursor: isStreaming || iniWait ? 'not-allowed' : 'pointer'
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
	onSessionSelect: PropTypes.func
};

export default DeepTutorChatBox;
