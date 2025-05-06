/*
Experiment putting deeptutor chat box out
*/
{
    class DeepTutorSession {
        constructor({
            id = 123,
            userId = 1234,
            sessionName = new Date().toISOString(),
            creationTime = new Date().toISOString(),
            lastUpdatedTime = new Date().toISOString(),
            type = 'default',
            status = 'active',
            statusTimeline = [],
            documentIds = [],
            generateHash = false
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
                documentIds: this.documentIds
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

    class SubMessage { 
        constructor({
            text = "",
            image =  "",
            audio = "",
            contentType = Highlight,
            creationTime = new Date().toISOString(),
            sources = []
        }) {
            this.text = text;
            this.image = image;
            this.audio = audio;
            this.contentType = contentType;
            this.creationTime = creationTime;
            this.sources = sources;
        }
    }

    class MessageSource {
        constructor({
            index = 0,
            page = 0,
            referenceString = ""
        }) {
            this.index = index;
            this.page = page;
            this.referenceString = referenceString;
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
           ">
               <hbox style="margin-bottom: 16px; width: 100%; height: calc(100% - 60px);" align="center"> 
                   <scrollbox id="chat-log" flex="1" orient="vertical" style="
                       border-radius: 8px;
                       padding: 12px;
                       overflow-y: auto;
                       background: white;
                       height: 100%;
                       max-height: 400px;
                       width: 100%;
                       box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
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
                               background: #fff;
                               color: #1a65b0;
                               min-height: 32px;
                               max-height: 80px;
                               font-size: 13px;
                               overflow-y: auto;
                           " />
                       </html:div>
                   </hbox>

                   <!-- Bottom Section: Model, Image, Send Buttons -->
                   <hbox style="width: 100%; align-items: center; justify-content: space-between;">
                       <!-- Model Button and Popup at left -->
                       <vbox style="position: relative;">
                           <button id="model-btn" label="Model" style="
                               background: #e0e0e0;
                               color: #444;
                               border: none;
                               border-radius: 4px;
                               font-weight: 500;
                               padding: 2px 7px;
                               margin-right: 4px;
                               cursor: pointer;
                               font-size: 11px;
                               min-width: 0;
                               min-height: 0;
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
                                   background: #e0e0e0;
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
                               background: #2c25ac;
                               color: #fff;
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

            // Listen for PDF data updates from model selection
            this._modelSelection.addEventListener('pdfDataUpdate', (e) => {
                this.pdfDataList = e.detail.pdfDataList;
                this._appendMessage("Upload Update", this.pdfDataList);
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
            
            // Create and store user message
            const userMessage = new DeepTutorMessage({
                subMessages: [new SubMessage({
                    text: newMessage,
                    contentType: 'text',
                    creationTime: new Date().toISOString()
                })],
                role: 'user',
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString()
            });
            this.messages.push(userMessage);
            this._appendMessage("User", userMessage);
            
            this._abstractField.value = "";

            // Get model data
            const modelData = this._modelSelection.getModelData();
            const modelInfoMessage = new DeepTutorMessage({
                subMessages: [new SubMessage({
                    text: JSON.stringify(modelData, null, 2),
                    contentType: 'text',
                    creationTime: new Date().toISOString()
                })],
                role: 'system',
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString()
            });
            this._appendMessage("Model Info", modelInfoMessage);

            const response = await this._sendToAPI(newMessage);
            let AIResponse = "No Response";
            if (response.ok) {
                try {
                    AIResponse = await response.json();
                } catch(err) {
                    AIResponse = "No Response";
                }
                if (!AIResponse.error) {
                    AIResponse = AIResponse.choices?.[0]?.message?.content || "No Response";
                }
            }
            Zotero.debug(AIResponse);

            // Create and store chatbot message
            const chatbotMessage = new DeepTutorMessage({
                subMessages: [new SubMessage({
                    text: AIResponse,
                    contentType: 'text',
                    creationTime: new Date().toISOString()
                })],
                role: 'assistant',
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString()
            });
            this.messages.push(chatbotMessage);
            this._appendMessage("Chatbot", chatbotMessage);
        }

        async _sendToAPI(message) {
            // Use the stored PDF data
            const pdfContent = this.pdfDataList.map(pdf => pdf.content).join("\n\n");
            
            // Create a message object for the PDF content
            const pdfMessage = new DeepTutorMessage({
                subMessages: [new SubMessage({
                    text: pdfContent,
                    contentType: 'text',
                    creationTime: new Date().toISOString()
                })],
                role: 'system',
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString()
            });
            this._appendMessage("Upload with User", pdfMessage);
            
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer YOUR_OPENAI_API_KEY",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-4",
                    messages: [
                        { role: "system", content: "You are a helpful assistant." },
                        { role: "user", content: `PDF Content:\n${pdfContent}\n\nUser Question: ${message}` }
                    ]
                })
            });
            return response;
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
                        color: white;
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

        async _LoadMessage(messages, documentIds) {
            Zotero.debug(`DeepTutorBox: Loading ${messages.length} messages with ${documentIds?.length || 0} document IDs`);
            this.documentIds = documentIds || [];
            const log = this.querySelector('scrollbox');
            // Clear existing content
            while (log.firstChild) {
                log.removeChild(log.firstChild);
            }

            // Process each message object
            this.messages = messages;
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
    }
    customElements.define("deep-tutor-box", DeepTutorBox);
}