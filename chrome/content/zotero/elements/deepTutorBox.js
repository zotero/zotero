/*
Experiment putting deeptutor chat box out
*/
{
    // Session Status Enum
    const SessionStatus = {
        CREATED: 'CREATED',
        READY: 'READY',
        PROCESSING_ERROR: 'PROCESSING_ERROR',
        FINAL_PROCESSING_ERROR: 'FINAL_PROCESSING_ERROR',
        PROCESSING: 'PROCESSING',
        DELETED: 'DELETED'
    };

    // Session Type Enum
    const SessionType = {
        LITE: 'LITE',
        BASIC: 'BASIC',
        ADVANCED: 'ADVANCED'
    };

    // Content Type Enum
    const ContentType = {
        THINK: 'THINK',
        TEXT: 'TEXT',
        IMAGE: 'IMAGE',
        AUDIO: 'AUDIO'
    };

    // Message Status Enum
    const MessageStatus = {
        UNVIEW: 'UNVIEW',
        DELETED: 'DELETED',
        VIEWED: 'VIEWED',
        PROCESSING_ERROR: 'PROCESSING_ERROR'
    };

    // Message Role Enum
    const MessageRole = {
        TUTOR: 'TUTOR',
        USER: 'USER'
    };

    // Session Status Event Interface (as a class for JavaScript)
    class SessionStatusEvent {
        constructor(effectiveTime, status) {
            this.effectiveTime = effectiveTime;
            this.status = status;
        }
    }

    // PresignedUrl Interface (as a class for JavaScript)
    class PresignedUrl {
        constructor(preSignedUrl, preSignedReadUrl) {
            this.preSignedUrl = preSignedUrl;
            this.preSignedReadUrl = preSignedReadUrl;
        }
    }

    // File Document Mapping Interface (as a class for JavaScript)
    class FileDocumentMap {
        constructor() {
            this._map = new Map(); // Maps file name to document ID
            this._reverseMap = new Map(); // Maps document ID to file name
            this._fileIdMap = new Map(); // Maps document ID to original file ID
        }

        addMapping(fileName, documentId, fileId) {
            this._map.set(fileName, documentId);
            this._reverseMap.set(documentId, fileName);
            this._fileIdMap.set(documentId, fileId);
        }

        getDocumentId(fileName) {
            return this._map.get(fileName);
        }

        getFileName(documentId) {
            return this._reverseMap.get(documentId);
        }

        getFileId(documentId) {
            return this._fileIdMap.get(documentId);
        }

        getAllDocumentIds() {
            return Array.from(this._map.values());
        }

        getAllFileNames() {
            return Array.from(this._map.keys());
        }

        hasFile(fileName) {
            return this._map.has(fileName);
        }

        hasDocument(documentId) {
            return this._reverseMap.has(documentId);
        }

        removeMapping(fileName) {
            const documentId = this._map.get(fileName);
            if (documentId) {
                this._map.delete(fileName);
                this._reverseMap.delete(documentId);
                this._fileIdMap.delete(documentId);
            }
        }

        clear() {
            this._map.clear();
            this._reverseMap.clear();
            this._fileIdMap.clear();
        }

        toJSON() {
            return {
                fileToDocument: Object.fromEntries(this._map),
                documentToFile: Object.fromEntries(this._reverseMap),
                documentToFileId: Object.fromEntries(this._fileIdMap)
            };
        }
    }

    // Message Interface (as a class for JavaScript)
    class Message {
        constructor({
            id = null,
            parentMessageId = null,
            userId = null,
            sessionId = null,
            subMessages = [],
            followUpQuestions = [],
            creationTime = new Date().toISOString(),
            lastUpdatedTime = new Date().toISOString(),
            status = MessageStatus.UNVIEW,
            role = MessageRole.USER
        } = {}) {
            this.id = null;  // Always set id to null
            this.parentMessageId = parentMessageId;
            this.userId = userId;
            this.sessionId = sessionId;
            this.subMessages = subMessages;
            this.followUpQuestions = followUpQuestions;
            this.creationTime = creationTime;
            this.lastUpdatedTime = lastUpdatedTime;
            this.status = status;
            this.role = role;
        }
    }

    // SubMessage Interface (as a class for JavaScript)
    class SubMessage {
        constructor({
            text = null,
            image = null,
            audio = null,
            contentType = ContentType.TEXT,
            creationTime = new Date().toISOString(),
            sources = []
        } = {}) {
            this.text = text;
            this.image = image;
            this.audio = audio;
            this.contentType = contentType;
            this.creationTime = creationTime;
            this.sources = sources;
        }
    }

    // MessageSource Interface (as a class for JavaScript)
    class MessageSource {
        constructor({
            index = 0,
            page = 0,
            referenceString = ""
        } = {}) {
            this.index = index;
            this.page = page;
            this.referenceString = referenceString;
        }
    }

    // Conversation Interface (as a class for JavaScript)
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

    class DeepTutorSession {
        constructor({
            id = null,
            userId = 1234,
            sessionName = new Date().toISOString(),
            creationTime = new Date().toISOString(),
            lastUpdatedTime = new Date().toISOString(),
            type = SessionType.BASIC,
            status = SessionStatus.CREATED,
            statusTimeline = [],
            documentIds = [],
            generateHash = null
        } = {}) {
            this.id = id;
            this.userId = userId;
            this.sessionName = sessionName;
            this.creationTime = creationTime;
            this.lastUpdatedTime = lastUpdatedTime;
            this.type = type;
            this.status = status;
            this.statusTimeline = statusTimeline;
            this.documentIds = documentIds;
            this.generateHash = generateHash;
        }
    
        update() {
            this.lastUpdatedTime = new Date().toISOString();
        }
    
        toJSON() {
            return {
                id: this.id,
                userId: this.userId,
                sessionName: this.sessionName,
                creationTime: this.creationTime,
                lastUpdatedTime: this.lastUpdatedTime,
                type: this.type,
                status: this.status,
                statusTimeline: this.statusTimeline,
                documentIds: this.documentIds,
                generateHash: this.generateHash
            };
        }
    }

    class DeepTutorMessage {
        constructor({ 
            id = null, 
            parentMessageId = null, 
            userId = null, 
            sessionId = null, 
            subMessages = [], 
            followUpQuestions = [], 
            creationTime = new Date().toISOString(), 
            lastUpdatedTime = new Date().toISOString(), 
            status = 'active', 
            role = 'user' 
        } = {}) {
            this.id = id;
            this.parentMessageId = parentMessageId;
            this.userId = userId;
            this.sessionId = sessionId;
            this.subMessages = subMessages;
            this.followUpQuestions = followUpQuestions;
            this.creationTime = creationTime;
            this.lastUpdatedTime = lastUpdatedTime;
            this.status = status;
            this.role = role;
        }
    }
    class DeepTutorBox extends XULElementBase {
        // Add class attribute for storing PDF data
        // pdfDataList = [];

        content = MozXULElement.parseXULToFragment(`
           <vbox id="chatbot-container" flex="1" style="
               padding: 16px;
               background: #f8f9fa;
               border-radius: 8px;
               box-shadow: 0 2px 4px rgba(0,0,0,0.1);
               height: 100%;
               display: flex;
               flex-direction: column;
               font-family: 'Roboto', sans-serif;
           ">
               <description id="session-name" value="Session: None" style="
                   font-size: 1em;
                   color: #495057;
                   margin-bottom: 4px;
                   padding-left: 4px;
               " />
               <description id="file-name" value="File: None" style="
                   font-size: 1em;
                   color: #495057;
                   margin-bottom: 16px;
                   padding-left: 4px;
               " />
               <hbox style="margin-bottom: 16px; width: 100%; height: calc(100% - 60px);" align="center"> 
                   <scrollbox id="chat-log" flex="1" orient="vertical" style="
                       border-radius: 8px;
                       padding: 12px;
                       overflow-y: auto;
                       background: #F8F6F7;
                       height: 100%;
                       max-height: 400px;
                       width: 100%;
                       box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
                       font-family: 'Roboto', sans-serif;
                   " />
               </hbox> 

               <vbox id="bottom-bar" style="
                   margin-top: auto;
                   padding: 10px 10px 6px 10px;
                   background: #e0e0e0;
                   border-radius: 12px 12px 0 0;
                   box-shadow: 0 -1px 3px rgba(0,0,0,0.08);
                   display: flex;
                   flex-direction: column;
                   gap: 4px;
               ">
                   <!-- Middle Section: Text Input -->
                   <hbox style="width: 100%; align-items: center; justify-content: center; margin-bottom: 2px;">
                       <html:div class="body" style="flex: 1; max-width: 100%;">
                           <editable-text multiline="true" data-l10n-id="question-field" data-l10n-attrs="placeholder" style="
                               width: 100%;
                               padding: 6px 10px;
                               border: 1px solid #495057;
                               border-radius: 6px;
                               background: #F8F6F7;
                               color: #1a65b0;
                               min-height: 32px;
                               max-height: 80px;
                               font-size: 13px;
                               overflow-y: auto;
                               font-family: 'Roboto', sans-serif;
                           " />
                       </html:div>
                   </hbox>

                   <!-- Bottom Section: Model, Image, Send Buttons -->
                   <hbox style="width: 100%; align-items: center; justify-content: space-between;">
                       <!-- Model Button and Popup at left -->
                       <vbox style="position: relative;">
                           <button id="model-btn" label="Model" style="
                               background: #0687E5;
                               color: #000000;
                               border: none;
                               border-radius: 4px;
                               font-weight: 500;
                               padding: 2px 7px;
                               margin-right: 4px;
                               cursor: pointer;
                               font-size: 11px;
                               min-width: 0;
                               min-height: 0;
                               font-family: 'Roboto', sans-serif;
                           " />
                           <vbox id="model-popup" style="
                               display: none;
                               position: absolute;
                               bottom: 26px;
                               left: 0;
                               background: #fff;
                               border-radius: 8px;
                               box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                               padding: 18px 12px;
                               z-index: 10;
                               min-width: 180px;
                               min-height: 60px;
                           ">
                               <model-selection id="model-selection-component"/>
                           </vbox>
                       </vbox>

                       <!-- Empty center -->
                       <spacer flex="1" />

                       <!-- Image and Send Buttons at right -->
                       <hbox style="align-items: center; gap: 4px;">
                           <vbox style="position: relative;">
                               <button id="image-btn" style="
                                   background: #0687E5;
                                   border: none;
                                   border-radius: 4px;
                                   width: 24px;
                                   height: 24px;
                                   display: flex;
                                   align-items: center;
                                   justify-content: center;
                                   cursor: pointer;
                                   margin-right: 2px;
                                   min-width: 0;
                                   min-height: 0;
                                   padding: 0;
                                   font-family: 'Roboto', sans-serif;
                               ">
                                   <html:img src="chrome://zotero/skin/image-icon.svg" style="width: 14px; height: 14px;" />
                               </button>
                               <vbox id="image-popup" style="
                                   display: none;
                                   position: absolute;
                                   bottom: 26px;
                                   left: 0;
                                   background: #fff;
                                   border-radius: 8px;
                                   box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                                   padding: 8px 10px;
                                   z-index: 10;
                                   min-width: 70px;
                                   min-height: 20px;
                               "></vbox>
                           </vbox>
                           <button id="send-btn" style="
                               background: #0687E5;
                               color: #000000;
                               border: none;
                               border-radius: 50%;
                               width: 26px;
                               height: 26px;
                               display: flex;
                               align-items: center;
                               justify-content: center;
                               cursor: pointer;
                               font-size: 13px;
                               min-width: 0;
                               min-height: 0;
                               padding: 0;
                               font-family: 'Roboto', sans-serif;
                           ">
                               <html:img src="chrome://zotero/skin/send-icon.svg" style="width: 13px; height: 13px;" />
                           </button>
                       </hbox>
                   </hbox>
               </vbox>
           </vbox>
        `);

        init() {
            this._abstractField = this.querySelector('editable-text');
            this._sendButton = this.querySelector('#send-btn');
            this._modelBtn = this.querySelector('#model-btn');
            this._modelPopup = this.querySelector('#model-popup');
            this._imageBtn = this.querySelector('#image-btn');
            this._imagePopup = this.querySelector('#image-popup');
            this._modelSelection = this.querySelector('#model-selection-component');

            this._sendButton.addEventListener('click', () => this._handleSend());
            this._modelBtn.addEventListener('click', () => this._togglePopup(this._modelPopup));
            this._imageBtn.addEventListener('click', () => this._togglePopup(this._imagePopup));

            this.pdfDataList = [];
            this.render();

            this.messages = [];
            this.documentIds = [];
            this.sessionId = null;
            this.userId = null;
            this.latestMessageId = null;  // Add property to track latest message ID
            this.curDocumentFiles = [];
            this.curSessionObj = null;

            // Initialize conversation object
            this._conversation = new Conversation({
                userId: null,
                sessionId: null,
                ragSessionId: null,
                storagePaths: [],
                history: [],
                message: null,
                streaming: true,
                type: SessionType.BASIC
            });

            // Listen for PDF data updates from model selection
            this._modelSelection.addEventListener('pdfDataUpdate', (e) => {
                this.pdfDataList = e.detail.pdfDataList;
                this._appendMessage("Upload Update", this.pdfDataList);
            });

            // Listen for session ID updates from parent
            this.addEventListener('SessionIdUpdate', async(event) => {
                this.sessionId = event.detail.sessionId;
                this._conversation.sessionId = this.sessionId;
                Zotero.debug(`DeepTutorBox: Session ID updated to ${this.sessionId}`);
            });

            // Listen for user ID updates from parent
            this.addEventListener('UserIdUpdate', (event) => {
                this.userId = event.detail.userId;
                this._conversation.userId = this.userId;
                Zotero.debug(`DeepTutorBox: User ID updated to ${this.userId}`);
            });
        }

        render() {
            Zotero.debug("Chatbot component loading");
            this.initialized = true;
        }

        async _handleUpload() {
            const selectedItems = ZoteroPane.getSelectedItems();
            if (!selectedItems.length) {
                Zotero.debug("No items selected");
                // update to empty if clicked with no selection
                this.pdfDataList = [];
                this._dispatchDataUpdate();
                return;
            }

            const pdfAttachments = selectedItems.reduce((arr, item) => {
                if (item.isPDFAttachment()) {
                    return arr.concat([item]);
                }
                if (item.isRegularItem()) {
                    return arr.concat(item.getAttachments()
                        .map(x => Zotero.Items.get(x))
                        .filter(x => x.isPDFAttachment()));
                }
                return arr;
            }, []);

            if (!pdfAttachments.length) {
                Zotero.debug("No PDF attachments found in selected items");
                return;
            }

            // Clear existing data
            this.pdfDataList = [];

            // Process all PDFs concurrently using Promise.all
            const pdfProcessingPromises = pdfAttachments.map(async (pdf) => {
                try {
                    const { text } = await Zotero.PDFWorker.getFullText(pdf.id);
                    if (text) {
                        return {
                            id: pdf.id,
                            content: text.substring(0, 200)
                        };
                    }
                    return null;
                } catch (e) {
                    Zotero.debug(`Error extracting text from PDF: ${e.message}`);
                    return null;
                }
            });

            // Wait for all PDFs to be processed
            const results = await Promise.all(pdfProcessingPromises);
            
            // Filter out any null results and update pdfDataList
            this.pdfDataList = results.filter(result => result !== null);
            
            // Create a message object for the upload update
            const uploadMessage = new DeepTutorMessage({
                subMessages: [new SubMessage({
                    text: JSON.stringify(this.pdfDataList, null, 2),
                    contentType: 'text',
                    creationTime: new Date().toISOString()
                })],
                role: 'system',
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString()
            });
            this._appendMessage("Upload Update", uploadMessage);
            
            this._dispatchDataUpdate();

            Zotero.debug(`Successfully uploaded ${this.pdfDataList.length} PDFs`);
        }

        _dispatchDataUpdate() {
            // Dispatch a custom event with the current data
            const event = new CustomEvent('deepTutorDataUpdate', {
                detail: {
                    pdfDataList: this.pdfDataList
                },
                bubbles: true // Allow the event to bubble up to parent components
            });
            this.dispatchEvent(event);
        }

        async _handleSend() {
            const newMessage = this._abstractField.value.trim();
            if (!newMessage) return;
            
            try {
                if (!this.sessionId) {
                    throw new Error("No active session ID");
                }
                if (!this.userId) {
                    throw new Error("No active user ID");
                }

                // Create user message with proper structure
                Zotero.debug(`DeepTutorBox: Send API Request with Session ID: ${this.sessionId} and User ID: ${this.userId}`);
                const userMessage = {
                    id: null,
                    parentMessageId: this.latestMessageId,  // Use the latest message ID as parent
                    userId: this.userId,
                    sessionId: this.sessionId,
                    subMessages: [{
                        text: newMessage,
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

                Zotero.debug(`DeepTutorBox: Created user message: ${JSON.stringify(userMessage)}`);

                // Add user message to local messages array and display it
                this.messages.push(new DeepTutorMessage(userMessage));
                this._appendMessage("User", new DeepTutorMessage(userMessage));
                
                // Update conversation history and current message
                this._conversation.history = this.messages;
                this._conversation.message = new DeepTutorMessage(userMessage);
                
                // Update latestMessageId
                this.latestMessageId = userMessage.id;
                Zotero.debug(`DeepTutorBox: Updated latest message ID to ${this.latestMessageId}`);
                
                // Clear input field
                this._abstractField.value = "";

                // Get model data
                const modelData = this._modelSelection.getModelData();
                Zotero.debug(`DeepTutorBox: Model data: ${JSON.stringify(modelData)}`);

                const modelInfoMessage = {
                    subMessages: [{
                        text: JSON.stringify(modelData, null, 2),
                        image: null,
                        audio: null,
                        contentType: ContentType.TEXT,
                        creationTime: new Date().toISOString(),
                        sources: []
                    }],
                    role: MessageRole.TUTOR,
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: MessageStatus.UNVIEW
                };
                this._appendMessage("Model Info", new DeepTutorMessage(modelInfoMessage));

                // Send message to API and get response
                Zotero.debug(`DeepTutorBox: Sending message to API...`);
                const apiResponse = await this._sendToAPI(userMessage);
                Zotero.debug(`DeepTutorBox: API response received: ${JSON.stringify(apiResponse)}`);

                // Create tutor message from API response
                const tutorMessage = {
                    id: null,
                    parentMessageId: userMessage.id,  // Link to the user message
                    userId: this.userId,
                    sessionId: this.sessionId,
                    subMessages: [{
                        text: apiResponse?.subMessages?.[0]?.text || "I apologize, but I couldn't process your request at this time.",
                        image: null,
                        audio: null,
                        contentType: ContentType.TEXT,
                        creationTime: new Date().toISOString(),
                        sources: apiResponse?.subMessages?.[0]?.sources || []
                    }],
                    followUpQuestions: apiResponse?.followUpQuestions || [],
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: MessageStatus.UNVIEW,
                    role: MessageRole.TUTOR
                };

                // Add tutor message to local messages array and display it
                this.messages.push(new DeepTutorMessage(tutorMessage));
                this._appendMessage("Chatbot", new DeepTutorMessage(tutorMessage));

                // Update conversation history and current message
                this._conversation.history = this.messages;
                this._conversation.message = new DeepTutorMessage(tutorMessage);

                // Update latestMessageId to the tutor message
                this.latestMessageId = tutorMessage.id;
                Zotero.debug(`DeepTutorBox: Updated latest message ID to ${this.latestMessageId}`);

            } catch (error) {
                Zotero.debug(`DeepTutorBox: Error in _handleSend: ${error.message}`);
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
                this.messages.push(new DeepTutorMessage(errorMessage));
                this._appendMessage("Chatbot", new DeepTutorMessage(errorMessage));
                
                // Update conversation history and current message
                this._conversation.history = this.messages;
                this._conversation.message = new DeepTutorMessage(errorMessage);
            }
        }

        async _sendToAPI(message) {
            try {
                // Use the stored PDF data
                const pdfContent = this.pdfDataList.map(pdf => pdf.content).join("\n\n");
                
                // Create a message object for the PDF content
                const pdfMessage = {
                    subMessages: [{
                        text: pdfContent,
                        image: null,
                        audio: null,
                        contentType: ContentType.TEXT,
                        creationTime: new Date().toISOString(),
                        sources: []
                    }],
                    role: MessageRole.TUTOR,
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: MessageStatus.UNVIEW
                };
                this._appendMessage("Upload with User", new DeepTutorMessage(pdfMessage));
                

                
                // Comment out old API call
                
                const response2 = await fetch("https://api.staging.deeptutor.knowhiz.us/api/message/create", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(message)
                });

                if (!response2.ok) {
                    const errorText = await response2.text();
                    Zotero.debug(`DeepTutorBox: API error response: ${errorText}`);
                    throw new Error(`API request failed: ${response2.status} ${response2.statusText}\nResponse: ${errorText}`);
                }
                const responseData2 = await response2.json();

                Zotero.debug(`DeepTutorBox: API response for input message: ${JSON.stringify(responseData2)}`);
                
                this._conversation.message = responseData2;
                Zotero.debug(`DeepTutorBox: Sending API request to: https://api.staging.deeptutor.knowhiz.us/api/chat/subscribe`);
                Zotero.debug(`DeepTutorBox: Request body: ${JSON.stringify(this._conversation)}`);
                // New API call using conversation object
                const response3 = await fetch("https://api.staging.deeptutor.knowhiz.us/api/chat/subscribe", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(this._conversation)
                });
                const reader = response3.body.getReader();
                const decoder = new TextDecoder();
                let streamText = "";

                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const data = decoder.decode(value);
                    
                    data.split('\n\n').forEach((event) => {
                        Zotero.debug('DeepTutorBox: Processing event:', event);
                        if (!event.startsWith('data:')) return;

                        const jsonStr = event.slice(5);
                        Zotero.debug('DeepTutorBox: Processing jsonStr:', jsonStr);
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const output = parsed.msg_content;
                            Zotero.debug('DeepTutorBox: Processing output:', output);
                            if (output && output.length > 0) {
                                streamText += output;
                                // Create a temporary message to display the stream
                                const streamMessage = new DeepTutorMessage({
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
                                });
                                // Update the last message in the chat
                                this._updateLastMessage(streamMessage);
                            }
                        } catch (error) {
                            Zotero.debug('DeepTutorBox: Error parsing SSE data:', error);
                        }
                    });
                }

                // Fetch message history for the session
                Zotero.debug(`DeepTutorBox: Fetching message history for session ${this.sessionId}`);
                const historyResponse = await fetch(`https://api.staging.deeptutor.knowhiz.us/api/message/bySession/${this.sessionId}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json"
                    }
                });

                if (!historyResponse.ok) {
                    const errorText = await historyResponse.text();
                    Zotero.debug(`DeepTutorBox: Failed to fetch message history: ${errorText}`);
                    throw new Error(`Failed to fetch message history: ${historyResponse.status} ${historyResponse.statusText}`);
                }

                const responseData = await historyResponse.json();
                Zotero.debug(`DeepTutorBox: API response data: ${JSON.stringify(responseData)}`);
                
                // Get only the last message from the response
                const lastMessage = responseData.length > 0 ? responseData[responseData.length - 2] : null;
                Zotero.debug(`DeepTutorBox: Last message from history: ${JSON.stringify(lastMessage)}`);
                return lastMessage;

            } catch (error) {
                Zotero.debug(`DeepTutorBox: Error in _sendToAPI: ${error.message}`);
                throw error;
            }
        }

        async _sendAIQuestion(AIQuestion) {
            this._abstractField.value = AIQuestion;
            await this._handleSend();
            this._abstractField.value = "";
        }

        async _createHighlightAnnotation(attachmentId, page, referenceString) {
            try {
                Zotero.debug(`DeepTutorBox: Attempting to create highlight annotation for attachment ${attachmentId} on page ${page}`);
                const attachment = Zotero.Items.get(attachmentId);
                if (!attachment) {
                    Zotero.debug(`DeepTutorBox: No attachment found for ID: ${attachmentId}`);
                    return null;
                }
                Zotero.debug(`DeepTutorBox: Found attachment: ${attachment.getField('title')}`);

                // Create annotation JSON
                const annotationJSON = {
                    key: Zotero.DataObjectUtilities.generateKey(),
                    type: 'highlight',
                    text: referenceString, // Empty text for now
                    comment: "Optional comment",
                    color: "#ffd400",
                    pageLabel: page.toString(),
                    sortIndex: "00001|000000|00000", // Add sortIndex
                    position: {
                        pageIndex: page - 1, // Convert to 0-based index
                        rects: [[0.2, 0.2, 0.8, 0.3]] // Random valid area
                    }
                };
                Zotero.debug(`DeepTutorBox: Creating highlight with JSON: ${JSON.stringify(annotationJSON)}`);

                // Create annotation using saveFromJSON
                const annotation = await Zotero.Annotations.saveFromJSON(attachment, annotationJSON);
                Zotero.debug(`DeepTutorBox: Successfully created highlight annotation: ${annotation.id}`);
                return annotation;
            } catch (e) {
                Zotero.debug(`DeepTutorBox: Error creating highlight annotation: ${e.message}`);
                return null;
            }
        }

        async _appendMessage(sender, message) {
            const log = this.querySelector('scrollbox');
            
            // Process subMessages
            if (message.subMessages && message.subMessages.length > 0) {
                Zotero.debug(`DeepTutorBox: Processing ${message.subMessages.length} subMessages for ${sender}`);
                for (const subMessage of message.subMessages) {
                    const messageContainer = document.createXULElement("hbox");
                    messageContainer.setAttribute("style", "margin: 8px 0; width: 100%;");
                    
                    const messageBubble = document.createXULElement("description");
                    const isUser = sender === "User";
                    
                    // Set bubble styling
                    messageBubble.setAttribute("style", `
                        padding: 10px 15px;
                        border-radius: 15px;
                        max-width: 80%;
                        word-wrap: break-word;
                        background-color: ${isUser ? '#007AFF' : '#E9ECEF'};
                        color: ${isUser ? 'white' : 'black'};
                        margin-${isUser ? 'left' : 'right'}: auto;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    `);
                    
                    // Add sender name and message
                    const senderLabel = document.createXULElement("description");
                    senderLabel.setAttribute("style", `
                        font-weight: bold;
                        margin-bottom: 4px;
                        display: block;
                    `);
                    senderLabel.textContent = sender;
                    
                    const messageText = document.createXULElement("description");
                    messageText.setAttribute("style", "display: block;");
                    messageText.textContent = subMessage.text;
                    
                    messageBubble.appendChild(senderLabel);
                    messageBubble.appendChild(messageText);

                    // Handle sources if they exist
                    if (subMessage.sources && subMessage.sources.length > 0) {
                        Zotero.debug(`DeepTutorBox: Found ${subMessage.sources.length} sources in subMessage`);
                        const sourcesContainer = document.createXULElement("hbox");
                        sourcesContainer.setAttribute("style", "margin-top: 8px; gap: 8px; flex-wrap: wrap;");

                        for (const source of subMessage.sources) {
                            Zotero.debug(`DeepTutorBox: Processing source - index: ${source.index}, page: ${source.page}`);
                            if (source.index >= 0 && source.index < this.documentIds.length) {
                                const attachmentId = this.documentIds[source.index];
                                Zotero.debug(`DeepTutorBox: Found valid attachment ID: ${attachmentId} for source index ${source.index}`);
                                const annotation = await this._createHighlightAnnotation(attachmentId, source.page, source.referenceString);
                                
                                if (annotation) {
                                    Zotero.debug(`DeepTutorBox: Created source button for annotation ${annotation.id}`);
                                    const sourceButton = document.createXULElement("button");
                                    sourceButton.setAttribute("label", `Source ${source.index + 1} (Page ${source.page})`);
                                    sourceButton.setAttribute("style", `
                                        background: #2c25ac;
                                        color: white;
                                        border: none;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        cursor: pointer;
                                        font-size: 12px;
                                    `);
                                    sourceButton.addEventListener('click', async () => {
                                        Zotero.debug(`DeepTutorBox: Source button clicked for attachment ${attachmentId}`);
                                        // First view the attachment
                                        ZoteroPane.viewAttachment(attachmentId);
                                        // Then try to find and focus on the annotation
                                        const attachment = Zotero.Items.get(attachmentId);
                                        if (attachment) {
                                            Zotero.debug(`DeepTutorBox: Found attachment, retrieving annotations`);
                                            const annotations = await Zotero.Annotations.getAnnotationsForItem(attachment);
                                            Zotero.debug(`DeepTutorBox: Found ${annotations.length} annotations`);
                                            const highlight = annotations.find(a => 
                                                a.type === 'highlight' && 
                                                a.page === source.page
                                            );
                                            if (highlight) {
                                                Zotero.debug(`DeepTutorBox: Found matching highlight annotation ${highlight.id}, focusing on it`);
                                                Zotero.Annotations.focusAnnotation(highlight);
                                            } else {
                                                Zotero.debug(`DeepTutorBox: No matching highlight found for page ${source.page}`);
                                            }
                                        }
                                    });
                                    sourcesContainer.appendChild(sourceButton);
                                } else {
                                    Zotero.debug(`DeepTutorBox: Failed to create annotation for source index ${source.index}`);
                                }
                            } else {
                                Zotero.debug(`DeepTutorBox: Invalid source index ${source.index} (documentIds length: ${this.documentIds.length})`);
                            }
                        }

                        if (sourcesContainer.children.length > 0) {
                            Zotero.debug(`DeepTutorBox: Adding ${sourcesContainer.children.length} source buttons to message`);
                            messageBubble.appendChild(sourcesContainer);
                        }
                    }

                    messageContainer.appendChild(messageBubble);
                    log.appendChild(messageContainer);
                }
            }

            // Process follow-up questions
            if (message.followUpQuestions && message.followUpQuestions.length > 0) {
                Zotero.debug(`DeepTutorBox: Processing ${message.followUpQuestions.length} follow-up questions`);
                const questionContainer = document.createXULElement("hbox");
                questionContainer.setAttribute("style", "margin: 8px 0; width: 100%; justify-content: center;");

                message.followUpQuestions.forEach(question => {
                    const questionButton = document.createXULElement("button");
                    questionButton.setAttribute("label", question);
                    questionButton.setAttribute("style", `
                        background: #2c25ac;
                        color: black;
                        border: none;
                        border-radius: 4px;
                        padding: 6px 12px;
                        margin: 4px;
                        cursor: pointer;
                        font-size: 13px;
                    `);
                    questionButton.addEventListener('click', () => {
                        this._sendAIQuestion(question);
                    });
                    questionContainer.appendChild(questionButton);
                });

                log.appendChild(questionContainer);
            }
            
            // Scroll to bottom
            log.scrollTop = log.scrollHeight;
        }

        async _LoadMessage(messages, documentIds, sessionObj) {
            Zotero.debug(`DeepTutorBox: Loading ${messages.length} messages with ${documentIds?.length || 0} document IDs`);
            this.documentIds = documentIds || [];
            this.curDocumentFiles = [];
            this.curSessionObj = sessionObj;

            // Update session info display
            if (messages.length > 0) {
                this._updateSessionInfo(messages[0].sessionId, documentIds);
            }

            for (const documentId of this.documentIds) {
                let newDoc = await fetch(`https://api.staging.deeptutor.knowhiz.us/api/document/${documentId}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json"
                    }
                });

                if (!newDoc.ok) {
                    const errorText = await newDoc.text();
                    Zotero.debug(`DeepTutorBox: Failed to fetch new session documents: ${errorText}`);
                    throw new Error(`Failed to fetch new session documents: ${newDoc.status} ${newDoc.statusText}`);
                }
                const newDocData = await newDoc.json();
                Zotero.debug(`DeepTutorBox: New session document: ${JSON.stringify(newDocData)}`);
                this.curDocumentFiles.push(newDocData);
            }

            this._conversation.documentIds = this.curDocumentFiles.map(doc => doc.fileId);
            this._conversation.storagePaths = this.curDocumentFiles.map(doc => doc.storagePath);
            
            const log = this.querySelector('scrollbox');
            // Clear existing content
            while (log.firstChild) {
                log.removeChild(log.firstChild);
            }

            // Process each message object
            this.messages = messages;
            if (messages.length > 0) {
                // Get sessionId from the first message
                this.sessionId = messages[0].sessionId;
                this._conversation.sessionId = this.sessionId;
                Zotero.debug(`DeepTutorBox: Session ID set to ${this.sessionId} from loaded messages`);
                
                // Set latestMessageId to the last message's ID
                const lastMessage = messages[messages.length - 1];
                this.latestMessageId = lastMessage.id;
                Zotero.debug(`DeepTutorBox: Latest message ID set to ${this.latestMessageId} from last loaded message`);
            }
            Zotero.debug(`DeepTutorBox: Messages: ${JSON.stringify(messages)}`);
            
            // Update conversation history
            this._conversation.history = messages;
            
            for (const message of messages) {
                const sender = message.role === 'user' ? 'User' : 'Chatbot';
                Zotero.debug(`DeepTutorBox: Processing message from ${sender}`);
                await this._appendMessage(sender, message);
            }

            // Scroll to bottom
            log.scrollTop = log.scrollHeight;
        }

        _togglePopup(popup) {
            // Hide all popups first
            [this._modelPopup, this._imagePopup].forEach(p => {
                if (p && p !== popup) p.style.display = 'none';
            });
            // Toggle the selected popup
            if (popup) {
                popup.style.display = (popup.style.display === 'none' || !popup.style.display) ? 'block' : 'none';
            }
        }

        _updateLastMessage(message) {
            const log = this.querySelector('scrollbox');
            // Remove the last message if it exists
            if (log.lastChild) {
                log.removeChild(log.lastChild);
            }
            // Append the updated message
            this._appendMessage("Chatbot", message);
        }

        _updateSessionInfo(sessionId, documentIds) {
            const sessionNameElement = this.querySelector('#session-name');
            const fileNameElement = this.querySelector('#file-name');
            
            if (sessionNameElement && fileNameElement) {
                // Update session name
                if (this.curSessionObj) {
                    sessionNameElement.value = `Session: ${this.curSessionObj?.sessionName || 'None'}`;
                } else {
                    sessionNameElement.value = 'Session: None';
                }
                
                // Update file name if available
                Zotero.debug(`DeepTutorBox: VVVVV Updating file name display. curDocumentFiles: ${JSON.stringify(this.curDocumentFiles)}`);
                if (this.curDocumentFiles && this.curDocumentFiles.length > 0) {
                    const fileName = this.curDocumentFiles[0].filename || 'None';
                    Zotero.debug(`DeepTutorBox: GGGGGG Setting file name to: ${fileName}`);
                    fileNameElement.value = `File: ${fileName}`;
                } else {
                    Zotero.debug(`DeepTutorBox: AAAAAAAAAAA No document files available, setting file name to None`);
                    fileNameElement.value = 'File: None';
                }
            }
        }
    }
    customElements.define("deep-tutor-box", DeepTutorBox);
}