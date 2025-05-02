/*
Experiment putting deeptutor chat box out
*/
{
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
                   <!-- Top Section: Add Context Button -->
                   <hbox style="width: 100%; align-items: center; margin-bottom: 2px;">
                       <vbox style="position: relative;">
                           <button id="add-context-btn" label="+ Add context" style="
                               background: white;
                               color: #222;
                               border: none;
                               border-radius: 4px;
                               font-weight: 500;
                               padding: 2px 7px;
                               margin-right: 6px;
                               cursor: pointer;
                               font-size: 11px;
                               min-width: 0;
                               min-height: 0;
                           " />
                           <vbox id="context-popup" style="
                               display: none;
                               position: absolute;
                               bottom: 26px;
                               left: 0;
                               background: #fff;
                               border-radius: 8px;
                               box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                               padding: 12px;
                               z-index: 10;
                               min-width: 140px;
                           ">
                               <button id="popup-upload-btn" label="Upload" style="
                                   background: #2c25ac;
                                   color: #fff;
                                   border: none;
                                   border-radius: 4px;
                                   font-weight: 600;
                                   padding: 4px 8px;
                                   font-size: 11px;
                                   cursor: pointer;
                                   min-width: 0;
                                   min-height: 0;
                               " />
                           </vbox>
                       </vbox>
                   </hbox>

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
            // Remove old upload button, add new popup upload
            this._popupUploadButton = this.querySelector('#popup-upload-btn');
            this._addContextBtn = this.querySelector('#add-context-btn');
            this._contextPopup = this.querySelector('#context-popup');
            this._modelBtn = this.querySelector('#model-btn');
            this._modelPopup = this.querySelector('#model-popup');
            this._imageBtn = this.querySelector('#image-btn');
            this._imagePopup = this.querySelector('#image-popup');
            this._modelSelection = this.querySelector('#model-selection-component');

            this._sendButton.addEventListener('click', () => this._handleSend());
            this._popupUploadButton.addEventListener('click', () => this._handleUpload());
            this._addContextBtn.addEventListener('click', () => this._togglePopup(this._contextPopup));
            this._modelBtn.addEventListener('click', () => this._togglePopup(this._modelPopup));
            this._imageBtn.addEventListener('click', () => this._togglePopup(this._imagePopup));

            this.pdfDataList = [];
            this.render();
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
            this._appendMessage("Upload Update", this.pdfDataList);

            Zotero.debug(`Successfully uploaded ${this.pdfDataList.length} PDFs`);
        }

        async _handleSend() {
            const newMessage = this._abstractField.value.trim();
            if (!newMessage) return;
            this._appendMessage("User", newMessage);
            
            this._abstractField.value = "";

            // Get model data
            const modelData = this._modelSelection.getModelData();
            this._appendMessage("Model Info", JSON.stringify(modelData, null, 2));

            // Use the stored PDF data
            const pdfContent = this.pdfDataList.map(pdf => pdf.content).join("\n\n");
            this._appendMessage("Upload with User", pdfContent);
            
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
                        { role: "user", content: `PDF Content:\n${pdfContent}\n\nUser Question: ${newMessage}` }
                    ]
                })
            });
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

            this._appendMessage("Chatbot", AIResponse);
        }

        _appendMessage(sender, text) {
            const log = this.querySelector('scrollbox');
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
            messageText.textContent = text;
            
            messageBubble.appendChild(senderLabel);
            messageBubble.appendChild(messageText);
            messageContainer.appendChild(messageBubble);
            log.appendChild(messageContainer);
            log.scrollTop = log.scrollHeight;
        }

        _togglePopup(popup) {
            // Hide all popups first
            [this._contextPopup, this._modelPopup, this._imagePopup].forEach(p => {
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