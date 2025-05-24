import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  createMessage, 
  getMessagesBySessionId, 
  getDocumentById, 
  subscribeToChat 
} from './api/libs/api';
import { viewAttachment } from './elements/callZoteroPane';
import ReactMarkdown from 'react-markdown';

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
        padding: '16px',
        background: '#F8F6F7',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        height: '100%',
        width: '85%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Roboto, sans-serif',
    },
    sessionInfo: {
        fontSize: '1em',
        color: '#495057',
        marginBottom: '4px',
        paddingLeft: '4px',
        fontFamily: 'Roboto, sans-serif',
    },
    chatLog: {
        borderRadius: '8px',
        padding: '12px',
        overflowY: 'auto',
        background: 'white',
        height: '100%',
        maxHeight: '400px',
        width: '100%',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '16px',
        fontFamily: 'Roboto, sans-serif',
    },
    bottomBar: {
        marginTop: 'auto',
        padding: '10px 10px 6px 10px',
        background: '#F8F6F7',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -1px 3px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontFamily: 'Roboto, sans-serif',
    },
    inputContainer: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2px',
        gap: '8px',
    },
    textInput: {
        flex: 1,
        padding: '6px 10px',
        border: '1px solid #495057',
        borderRadius: '6px',
        background: '#fff',
        color: '#1a65b0',
        minHeight: '32px',
        maxHeight: '80px',
        fontSize: '13px',
        overflowY: 'auto',
        fontFamily: 'Roboto, sans-serif',
    },
    sendButton: {
        background: '#F8F6F7',
        border: 'none',
        borderRadius: '8px',
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: '6px',
        transition: 'background-color 0.2s ease',
        ':hover': {
            background: '#D9D9D9'
        }
    },
    sendIcon: {
        width: '28px',
        height: '28px',
        objectFit: 'contain',
    },
    messageContainer: {
        margin: '8px 0',
        width: '100%',
    },
    messageBubble: {
        padding: '10px 15px',
        borderRadius: '15px',
        maxWidth: '80%',
        wordWrap: 'break-word',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    userMessage: {
        backgroundColor: '#0AE2FF',
        color: 'white',
        marginLeft: 'auto',
        borderBottomRightRadius: '4px',
        borderRadius: '16px',
        fontWeight: 500,
    },
    botMessage: {
        backgroundColor: '#F8F6F7',
        color: '#212529',
        marginRight: 'auto',
        borderBottomLeftRadius: '4px',
        borderRadius: '16px',
        fontWeight: 400,
    },
    senderLabel: {
        fontWeight: 'bold',
        marginBottom: '4px',
        display: 'block',
    },
    messageText: {
        display: 'block',
    },
    sourcesContainer: {
        marginTop: '8px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
    },
    sourceButton: {
        background: '#0AE2FF',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        padding: 0,
        transition: 'background 0.2s',
    },
    questionContainer: {
        margin: '8px 0',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        flexWrap: 'wrap',
    },
    questionButton: {
        background: '#fff',
        color: '#000',
        border: '1.5px solid #0AE2FF',
        borderRadius: '8px',
        padding: '8px 28px',
        minWidth: '220px',
        minHeight: '32px',
        fontWeight: 500,
        fontSize: '15px',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'background 0.2s, border 0.2s',
        margin: '4px 0',
        textAlign: 'center',
        fontFamily: 'Roboto, sans-serif',
    },
};

const SendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Send.png';

const DeepTutorChatBox = ({ currentSession }) => {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [userId, setUserId] = useState(null);
    const [documentIds, setDocumentIds] = useState([]);
    const [latestMessageId, setLatestMessageId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [storagePathsState, setStoragePathsState] = useState([]);
    const chatLogRef = useRef(null);

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
            if (!currentSession?.id) return;

            try {
                // Update session and user IDs
                setSessionId(currentSession.id);
                setUserId(currentSession.userId);
                setDocumentIds(currentSession.documentIds || []);

                // Fetch document information
                const newDocumentFiles = [];
                for (const documentId of currentSession.documentIds || []) {
                    try {
                        const docData = await getDocumentById(documentId);
                        newDocumentFiles.push(docData);
                    } catch (error) {
                        Zotero.debug(`DeepTutorChatBox: Error fetching document ${documentId}: ${error.message}`);
                    }
                }
                Zotero.debug(`DeepTutorChatBox: ATTENTION New Document Files: ${JSON.stringify(newDocumentFiles)}`);
                setStoragePathsState(newDocumentFiles.map(doc => doc.storagePath));
                Zotero.debug(`DeepTutorChatBox: ATTENTION Storage Paths: ${JSON.stringify(storagePathsState)}`);

            } catch (error) {
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
            type: SessionType.BASIC,
            storagePaths: storagePathsState
        }));
        Zotero.debug(`DeepTutorChatBox: Conversation state updated with sessionId: ${sessionId}, userId: ${userId}`);

    }, [sessionId, userId, documentIds]);

    // Handle message updates
    useEffect(() => {
        const loadMessages = async () => {
            if (!sessionId) return;

            try {
                const sessionMessages = await getMessagesBySessionId(sessionId);
                setMessages(sessionMessages);
                
                if (sessionMessages.length > 0) {
                    setLatestMessageId(sessionMessages[sessionMessages.length - 1].id);
                    
                    // Process and append each message
                    for (const message of sessionMessages) {
                        const sender = message.role === MessageRole.USER ? 'You' : 'DeepTutor';
                        await _appendMessage(sender, message);
                    }

                    // Update conversation history with loaded messages
                    setConversation(prev => ({
                        ...prev,
                        history: sessionMessages
                    }));
                } else {
                    // Show loading popup
                    setIsLoading(true);
                    let shouldSendInitialMessage = true;
                    
                    // Wait for 10 seconds
                    Zotero.debug(`DeepTutorChatBox: Waiting 8 seconds before sending initial message`);
                    await new Promise(resolve => setTimeout(resolve, 8000));
                    
                    // Check if we should proceed with initial message
                    Zotero.debug(`DeepTutorChatBox: Checking if should send initial message: ${shouldSendInitialMessage}`);
                    if (shouldSendInitialMessage) {
                        setIsLoading(false);
                        // Send initial message
                        Zotero.debug(`DeepTutorChatBox: Sending initial message`);
                        await userSendMessage("Can you give me a summary of this document?");
                    }
                }

                // Scroll to bottom after messages are loaded
                if (chatLogRef.current) {
                    setTimeout(() => {
                        chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
                    }, 100);
                }
            } catch (error) {
                Zotero.debug(`DeepTutorChatBox: Error loading messages: ${error.message}`);
                setIsLoading(false);
            }
        };

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
        type: SessionType.BASIC
    });

    useEffect(() => {
        // Scroll to bottom when messages change
        if (chatLogRef.current) {
            chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
        }
    }, [messages]);

    const userSendMessage = async (messageString) => {
        if (!messageString.trim()) return;
        setUserId('67f5b836cb8bb15b67a1149e');

        try {
            if (!sessionId) throw new Error("No active session ID");
            if (!userId) throw new Error("No active user ID");
            Zotero.debug(`Show me messageString: ${messageString}`);

            // Create user message with proper structure
            Zotero.debug(`DeepTutorChatBox: Send API Request with Session ID: ${sessionId} and User ID: ${userId}`);
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
            await _appendMessage("You", userMessage);
            setLatestMessageId(userMessage.id);

            // Send to API and handle response
            Zotero.debug(`DeepTutorChatBox: Sending message to API: ${JSON.stringify(userMessage)}`);
            const response = await sendToAPI(userMessage);
            Zotero.debug(`DeepTutorChatBox: Response from API: ${JSON.stringify(response)}`);
            



            // Scroll to bottom after messages are added
            if (chatLogRef.current) {
                setTimeout(() => {
                    chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
                }, 100);
            }

        } catch (error) {
            Zotero.debug(`DeepTutorChatBox: Error in userSendMessage: ${error.message}`);
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
        await userSendMessage(inputValue);
        setInputValue('');
    };

    const sendToAPI = async (message) => {
        try {
            // Send message to API
            const responseData = await createMessage(message)
            Zotero.debug(`DeepTutorChatBox: Create Message Response from API: ${JSON.stringify(responseData)}`);
            const newDocumentFiles2 = [];
            for (const documentId of currentSession.documentIds || []) {
                try {
                    const docData = await getDocumentById(documentId);
                    newDocumentFiles2.push(docData);
                } catch (error) {
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
                type: SessionType.BASIC
            });
            
            setConversation(newState);

            // Subscribe to chat stream with timeout
            Zotero.debug(`DeepTutorChatBox: Subscribing to chat with conversation: ${JSON.stringify(newState)}`);
            
            const streamResponse = await subscribeToChat(newState);
            Zotero.debug(`DeepTutorChatBox: Stream Response from API: ${JSON.stringify(streamResponse)}`);

            if (!streamResponse.ok) {
                throw new Error(`Stream request failed: ${streamResponse.status}`);
            }
            
            if (!streamResponse.body) {
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
            await new Promise(resolve => {
                setMessages(prev => {
                    resolve();
                    return [...prev, initialTutorMessage];
                });
            });

            while (true) {
                const { done, value } = await reader.read();
                
                // Check for timeout
                if (Date.now() - lastDataTime > 30000) {
                    throw new Error('Stream timeout - no data received for 30 seconds');
                }
                
                if (done) {
                    if (!hasReceivedData) {
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
                            setMessages(prev => {
                                const newMessages = [...prev];
                                newMessages[newMessages.length - 1] = streamMessage;
                                return newMessages;
                            });
                        }
                    } catch (error) {
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
            return lastMessage;

        } catch (error) {
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

    const loadMessages = async (newMessages, newDocumentIds, sessionObj) => {
        Zotero.debug(`DeepTutorChatBox: Loading ${newMessages.length} messages with ${newDocumentIds?.length || 0} document IDs`);
        
        // Update session and user IDs early
        if (sessionObj) {
            Zotero.debug(`DeepTutorChatBox: Setting session ID to ${sessionObj.id} and user ID to ${sessionObj.userId}`);
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
            _updateSessionInfo(newMessages[0].sessionId, newDocumentIds);
        }

        // Fetch document information
        const newDocumentFiles = [];
        for (const documentId of newDocumentIds || []) {
            try {
                const newDocData = await getDocumentById(documentId);
                Zotero.debug(`DeepTutorChatBox: New session document: ${JSON.stringify(newDocData)}`);
                newDocumentFiles.push(newDocData);
            } catch (error) {
                Zotero.debug(`DeepTutorChatBox: Error fetching document ${documentId}: ${error.message}`);
            }
        }

        // Update conversation state
        setConversation(prev => ({
            ...prev,
            userId: sessionObj?.userId || null,
            sessionId: sessionObj?.id || null,
            documentIds: newDocumentFiles.map(doc => doc.fileId),
            storagePaths: newDocumentFiles.map(doc => doc.storagePath),
            history: [] // Will be populated by _appendMessage
        }));

        // Clear existing messages
        setMessages([]);

        // Process and append each message
        if (newMessages.length > 0) {
            setLatestMessageId(newMessages[newMessages.length - 1].id);
            Zotero.debug(`DeepTutorChatBox: Latest message ID set to ${newMessages[newMessages.length - 1].id}`);

            // Append each message using _appendMessage
            for (const message of newMessages) {
                const sender = message.role === MessageRole.USER ? 'You' : 'DeepTutor';
                await _appendMessage(sender, message);
            }
        } else {
            Zotero.debug(`DeepTutorChatBox: No new messages to load`);
            // Wait a bit to ensure state updates are complete
            // Call onNewSession with the current session object
            if (sessionObj) {
                await onNewSession(sessionObj);
            } else {
                Zotero.debug(`OOOOOOOO DeepTutorChatBox: Cannot send initial message - session object is null`);
            }
        }

        // Scroll to bottom after all messages are loaded
        if (chatLogRef.current) {
            setTimeout(() => {
                chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
            }, 100);
        }
    };

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
                        Zotero.debug(`DeepTutorChatBox: Found ${subMessage.sources.length} sources in subMessage`);
                        
                        // Process each source
                        const processedSources = await Promise.all(subMessage.sources.map(async (source) => {
                            Zotero.debug(`DeepTutorBox: Processing source - index: ${source.index}, page: ${source.page}`);
                            
                            if (source.index >= 0 && source.index < documentIds.length) {
                                const attachmentId = documentIds[source.index];
                                Zotero.debug(`DeepTutorBox: Found valid attachment ID: ${attachmentId} for source index ${source.index}`);
                                
                                // Create highlight annotation
                                const annotation = await _createHighlightAnnotation(attachmentId, source.page, source.referenceString);
                                
                                if (annotation) {
                                    Zotero.debug(`DeepTutorBox: Created source button for annotation ${annotation.id}`);
                                    return {
                                        ...source,
                                        attachmentId,
                                        annotationId: annotation.id
                                    };
                                }
                            }
                            return source;
                        }));

                        return {
                            ...subMessage,
                            sources: processedSources.filter(source => source !== null)
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

            // Scroll to bottom after message is added
            if (chatLogRef.current) {
                setTimeout(() => {
                    chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
                }, 100);
            }
        }
    };

    const _createHighlightAnnotation = async (attachmentId, page, referenceString) => {
        try {
            const attachment = Zotero.Items.get(attachmentId);
            if (!attachment) {
                Zotero.debug(`DeepTutorChatBox: No attachment found for ID ${attachmentId}`);
                return null;
            }

            // Create highlight annotation
            const annotation = await Zotero.Annotations.createHighlightAnnotation(attachment, {
                page,
                text: referenceString,
                color: '#ffeb3b'
            });

            Zotero.debug(`DeepTutorChatBox: Created highlight annotation ${annotation.id}`);
            return annotation;
        } catch (error) {
            Zotero.debug(`DeepTutorChatBox: Error creating highlight annotation: ${error.message}`);
            return null;
        }
    };

    const handleSourceClick = async (source) => {
        if (!source || source.refinedIndex === undefined || source.refinedIndex < 0 || source.refinedIndex >= documentIds.length) {
            Zotero.debug(`DeepTutorChatBox: Invalid source or refinedIndex: ${JSON.stringify(source)}`);
            return;
        }

        const attachmentId = documentIds[source.refinedIndex];
        if (!attachmentId) {
            Zotero.debug(`DeepTutorChatBox: No attachment ID found for refinedIndex ${source.refinedIndex}`);
            return;
        }

        Zotero.debug(`DeepTutorChatBox: Source button clicked for attachment ${attachmentId}, page ${source.page}`);
        
        try {
            // Try to get the mapping from local storage
            const storageKey = `deeptutor_mapping_${sessionId}`;
            let zoteroAttachmentId = attachmentId;

            const mappingStr = Zotero.Prefs.get(storageKey);
            Zotero.debug('ModelSelection0521AA: Get data mapping:', Zotero.Prefs.get(storageKey));
            if (mappingStr) {
                const mapping = JSON.parse(mappingStr);
                Zotero.debug(`DeepTutorChatBox: Found mapping in storage: ${JSON.stringify(mapping)}`);
                
                // If we have a mapping for this document ID, use it
                if (mapping[attachmentId]) {
                    zoteroAttachmentId = mapping[attachmentId];
                    Zotero.debug(`DeepTutorChatBox: Using mapped attachment ID: ${zoteroAttachmentId}`);
                }
            }

            // View the attachment using our new function
            const item = Zotero.Items.get(zoteroAttachmentId);
            if (!item) {
                Zotero.debug(`DeepTutorChatBox: No item found for ID ${zoteroAttachmentId}`);
                return;
            }

            await Zotero.FileHandlers.open(item, {
                location: {
                    pageIndex: source.page - 1, // Convert to 0-based index
                    annotationID: source.annotationId
                }
            });
            Zotero.debug(`DeepTutorChatBox: Opened PDF with page ${source.page} and annotation ${source.annotationId}`);
            
            // Find and focus on the annotation
            const attachment = Zotero.Items.get(zoteroAttachmentId);
            if (attachment) {
                Zotero.debug(`DeepTutorChatBox: Found attachment, retrieving annotations`);
                const annotations = await attachment.getAnnotations();
                Zotero.debug(`DeepTutorChatBox: Found ${annotations.length} annotations`);
                
                // Find highlight annotation for the specific page
                const highlight = annotations.find(a => 
                    a.type === 'highlight' && 
                    a.page === source.page &&
                    a.text === source.referenceString
                );
                
                if (highlight) {
                    Zotero.debug(`DeepTutorChatBox: Found matching highlight annotation ${highlight.id}, focusing on it`);
                    await Zotero.Annotations.focusAnnotation(highlight);
                    Zotero.debug(`DeepTutorChatBox: Focused on highlight annotation`);
                } else {
                    Zotero.debug(`DeepTutorChatBox: No matching highlight found for page ${source.page}, creating new highlight`);
                    // Create new highlight if not found
                    const newHighlight = await _createHighlightAnnotation(zoteroAttachmentId, source.page, source.referenceString);
                    if (newHighlight) {
                        Zotero.debug(`DeepTutorChatBox: Created new highlight annotation ${newHighlight.id}`);
                        await Zotero.Annotations.focusAnnotation(newHighlight);
                        Zotero.debug(`DeepTutorChatBox: Focused on new highlight annotation`);
                    }
                }
            } else {
                Zotero.debug(`DeepTutorChatBox: No attachment found for ID ${zoteroAttachmentId}`);
            }
        } catch (error) {
            Zotero.debug(`DeepTutorChatBox: Error handling source click: ${error.message}`);
            Zotero.debug(`DeepTutorChatBox: Error stack: ${error.stack}`);
        }
    };

    const handleQuestionClick = async (question) => {
        // Set the input value to the question
        Zotero.debug(`DeepTutorChatBox: Handling question click: ${question}`);
        // Trigger send
        Zotero.debug(`DeepTutorChatBox: Triggering send`);
        await userSendMessage(question);
    };

    const onNewSession = async (newSession) => {
        try {
            Zotero.debug(`UUUUUUUUUUUUUUU DeepTutorChatBox: onNewSession: ${JSON.stringify(newSession)}`);
            
            // Check if session is too recent
            const sessionCreationTime = new Date(newSession.creationTime);
            const now = new Date();
            const timeDiff = (now - sessionCreationTime) / 1000; // Convert to seconds
            
            if (timeDiff < 15) {
                // Wait for remaining time
                Zotero.debug(`UUUUUUUUUUUUUUU DeepTutorChatBox: Waiting for ${Math.ceil(15 - timeDiff)} seconds`);
                const waitTime = Math.ceil(15 - timeDiff) * 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));

            }
            
            // Update userId and sessionId
            // setUserId(newSession.userId);
            //setSessionId(newSession.id);
            await userSendMessage("Can you give me a summary of this document?");
        } catch (error) {
            Zotero.debug(`DeepTutorChatBox: Error in onNewSession: ${error.message}`);
        }
    };

    const renderMessage = (message, index) => {
        const isUser = message.role === MessageRole.USER;
        const messageStyle = {
            ...styles.messageContainer,
            animation: 'fadeIn 0.3s ease-in-out'
        };
        
        return (
            <div key={index} style={messageStyle}>
                <div style={{
                    ...styles.messageBubble,
                    ...(isUser ? styles.userMessage : styles.botMessage),
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <span style={styles.senderLabel}>
                        {isUser ? 'You' : 'DeepTutor'}
                    </span>
                    {message.subMessages.map((subMessage, subIndex) => (
                        <div key={subIndex} style={styles.messageText}>
                            {`[${index}] `}
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
                {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                    <div style={styles.questionContainer}>
                        {message.followUpQuestions.map((question, qIndex) => (
                            <button
                                key={qIndex}
                                style={styles.questionButton}
                                onClick={() => handleQuestionClick(question)}
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
            maxWidth: '85%',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
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
        const openFirstDocument = async () => {
            if (documentIds && documentIds.length > 0 && sessionId) {
                Zotero.debug(`DeepTutorChatBox: Opening first document - sessionId: ${sessionId}, documentId: ${documentIds[0]}`);
                
                try {
                    // Try to get the mapping from local storage
                    const storageKey = `deeptutor_mapping_${sessionId}`;
                    let zoteroAttachmentId = documentIds[0];

                    const mappingStr = Zotero.Prefs.get(storageKey);
                    Zotero.debug('DeepTutorChatBox: Get data mapping:', Zotero.Prefs.get(storageKey));
                    if (mappingStr) {
                        const mapping = JSON.parse(mappingStr);
                        Zotero.debug(`DeepTutorChatBox: Found mapping in storage: ${JSON.stringify(mapping)}`);
                        
                        // If we have a mapping for this document ID, use it
                        if (mapping[documentIds[0]]) {
                            zoteroAttachmentId = mapping[documentIds[0]];
                            Zotero.debug(`DeepTutorChatBox: Using mapped attachment ID: ${zoteroAttachmentId}`);
                        }
                    }

                    // Get the item and open it
                    const item = Zotero.Items.get(zoteroAttachmentId);
                    if (!item) {
                        Zotero.debug(`DeepTutorChatBox: No item found for ID ${zoteroAttachmentId}`);
                        return;
                    }

                    // Open the document in the reader
                    await Zotero.FileHandlers.open(item, {
                        location: {
                            pageIndex: 0 // Start at first page
                        }
                    });
                    Zotero.debug(`DeepTutorChatBox: Opened document ${zoteroAttachmentId} in reader`);
                } catch (error) {
                    Zotero.debug(`DeepTutorChatBox: Error opening first document: ${error.message}`);
                    Zotero.debug(`DeepTutorChatBox: Error stack: ${error.stack}`);
                }
            }
        };
        openFirstDocument();
    }, [documentIds, sessionId]); // Dependencies array

    return (
        <div style={updatedStyles.container}>
            {isLoading && <LoadingPopup />}
            
            <div ref={chatLogRef} style={updatedStyles.chatLog}>
                {messages.map((message, index) => renderMessage(message, index))}
            </div>

            <div style={styles.bottomBar}>
                <div style={styles.inputContainer}>
                    <textarea
                        style={styles.textInput}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        rows={1}
                    />
                    <button
                        style={styles.sendButton}
                        onClick={handleSend}
                    >
                        <img 
                            src={SendIconPath}
                            alt="Send" 
                            style={styles.sendIcon}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};

DeepTutorChatBox.propTypes = {
    currentSession: PropTypes.object
};

export default DeepTutorChatBox;
