/*
   ***** BEGIN LICENSE BLOCK *****


   Copyright © 2024 Corporation for Digital Scholarship
                Vienna, Virginia, USA
                https://www.zotero.org


   This file is part of Zotero.


   Zotero is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.


   Zotero is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.


   You should have received a copy of the GNU Affero General Public License
   along with Zotero.  If not, see <http://www.gnu.org/licenses/>.


   ***** END LICENSE BLOCK *****
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
            contentType = "text",
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

    class DeepTutorPane extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
           <vbox id="main-container" flex="1" style="
               padding: 16px;
               background: #f8f9fa;
               width: 100%;
               height: 100%;
               overflow: hidden;
               display: flex;
               flex-direction: column;
           ">
               <hbox id="top-bar" style="margin-bottom: 12px; gap: 8px; align-items: center; background: #e9ecef; padding: 2px 6px; border-radius: 6px; width: fit-content; height: 28px;">
                   <button id="tab1-btn" label="Tab 1" style="min-width: 48px; background: #dedede; border: none; border-radius: 4px; padding: 2px 12px; font-size: 0.95em; margin-right: 2px; height: 22px;" />
                   <button id="tab2-btn" label="Tab 2" style="min-width: 48px; background: #dedede; border: none; border-radius: 4px; padding: 2px 12px; font-size: 0.95em; margin-right: 8px; height: 22px;" />
                   <button id="model-btn" class="nav-button" label="+" style="background: none; border: none; font-size: 1em; margin-right: 4px; padding: 0 4px; min-width: 20px; height: 20px;" />
                   <button id="history-btn" class="nav-button" label="\u21bb" style="background: none; border: none; font-size: 1em; margin-right: 4px; padding: 0 4px; min-width: 20px; height: 20px;" />
                   <button id="close-btn" label="\u2715" style="background: none; border: none; font-size: 1em; padding: 0 4px; min-width: 20px; height: 20px;" />
               </hbox>
               <description value="DeepTutor" style="
                   font-size: 1.2em;
                   font-weight: 600;
                   color: #2c3e50;
                   margin-bottom: 16px;
                   padding-bottom: 8px;
                   border-bottom: 2px solid #e9ecef;
               " />
               <hbox id="button-container" style="
                   margin-bottom: 16px;
                   gap: 8px;
                   padding: 8px;
                   background: #fff;
                   border-radius: 8px;
                   box-shadow: 0 2px 4px rgba(0,0,0,0.1);
               ">
                   <button id="tutor-btn" class="nav-button" label="Tutor" />
                   <button id="notes-btn" class="nav-button" label="Notes" />
                   <button id="settings-btn" class="nav-button" label="Settings" />
               </hbox>
               <vbox id="content-container" flex="1" style="width: 100%; height: 100%; overflow: hidden;">
                   <deep-tutor-box id="tutor-component" style="height: 100%; width: 100%;" />
                   <deep-notes-box id="notes-component" style="height: 100%; width: 100%; display: none;" />
                   <deep-settings-box id="settings-component" style="height: 100%; width: 100%; display: none;" />
                   <session-history-box id="history-component" style="height: 100%; width: 100%; display: none;" />
                   <model-selection id="model-component" style="height: 100%; width: 100%; display: none;" />
               </vbox>
           </vbox>
        `);

        init() {
            this.render();
            this.setupEventListeners();
            
            // Get reference to the DeepTutorBox component
            this._tutorBox = this.querySelector('#tutor-component');
            
            // Listen for data updates from DeepTutorBox
            this._tutorBox.addEventListener('deepTutorDataUpdate', (event) => {
                // Handle the data update
                const { pdfDataList } = event.detail;
                this._handleTutorDataUpdate(pdfDataList);
            });

            // Listen for session selection from history
            this.addEventListener('HistorySessionSelected', (event) => {
                const sessionName = event.detail.sessionName;
                let messages = this.sesNamToMes.get(sessionName);
                if (!messages) {
                    // If session doesn't exist in sesNamToMes, set sample messages
                    messages = this.sampleMessages();
                    this.sesNamToMes.set(sessionName, messages);
                }
                this.curSesName = sessionName;
                const sessionObj = this.sesNamToObj.get(sessionName);
                const documentIds = sessionObj?.documentIds || [];
                this._tutorBox._LoadMessage(messages, documentIds);
                Zotero.debug(`DeepTutorPane: Loading messages for session: ${sessionName}`);
                if (this.sesNamToObj.get(sessionName)) {
                    let tempSes = this.sesNamToObj.get(sessionName);
                    Zotero.debug(`DeepTutorPane: Loading attachments for session: ${sessionName}`);
                    if (tempSes.documentIds.length > 0) {
                        ZoteroPane.viewAttachment(tempSes.documentIds[0]);
                        Zotero.debug(`DeepTutorPane: Viewing attachments for session: ${sessionName}`);
                    }
                }
            });

            // Listen for RegisterReq event
            this.addEventListener('RegisterReq', (event) => {
                Zotero.debug(`DeepTutorPane: Received RegisterReq event with data: ${JSON.stringify(event.detail)}`);
                const newSession = this.newEmptySession(event.detail.name, event.detail.fileList);
                Zotero.debug(`DeepTutorPane: Created new session: ${JSON.stringify(newSession)} ${event.detail.name} ${JSON.stringify(event.detail.fileList)}`);
                this.updateSessionHistory();
            });

            // Initialize session management attributes
            this.curSesName = null;  // Current session name
            this.sessions = []; // List of Session objects
            this.sesNamToObj = new Map();  // Map of session names to Session objects
            this.sesNamToMes = new Map();  // Map of session names to lists of Zotero.Message objects

            // Load sessions
            this.loadSession();
        }

        loadSession() {
            // Create sample sessions
            this.sampleSessions();

            // Update sesNamToObj with session data
            this.sessions.forEach(session => {
                this.sesNamToObj.set(session.sessionName, session);
            });

            // Update session history box
            this.updateSessionHistory();

            // Handle component display based on sessions length
            const components = this.querySelectorAll('#content-container > *');
            if (this.sessions.length === 0) {
                components.forEach(comp => {
                    comp.style.display = 'none';
                });
                const modelComponent = this.querySelector('#model-component');
                if (modelComponent) {
                    modelComponent.style.display = 'block';
                }
            }
        }

        updateSessionHistory() {
            // Get reference to the session history box
            const sessionHistoryBox = this.querySelector('#history-component');
            Zotero.debug(`DeepTutorPane: Updating session history. Found history box: ${!!sessionHistoryBox}`);
            if (sessionHistoryBox) {
                // Update the session list in the history box
                sessionHistoryBox.updateSessionList(this.sessions);
            }
        }

        sampleSessions() {
            // Create three new Session objects
            const session1 = new DeepTutorSession({
                sessionName: "Session 1",
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString()
            });
            
            const session2 = new DeepTutorSession({
                sessionName: "Session 2",
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString()
            });
            
            const session3 = new DeepTutorSession({
                sessionName: "Session 3",
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString()
            });

            // Update sessions list
            this.sessions = [session1, session2, session3];
        }

        newEmptySession(sessionName = "New Session", fileList = []) {
            const session = new DeepTutorSession({
                sessionName: sessionName,
                creationTime: new Date().toISOString(),
                lastUpdatedTime: new Date().toISOString(),
                documentIds: fileList.map(file => file.id)
            });
            this.sessions.push(session);
            this.sesNamToObj.set(session.sessionName, session);
        }

        sampleMessages() {
            const messages = [
                new DeepTutorMessage({
                    id: "msg1",
                    parentMessageId: null,
                    userId: "user1",
                    sessionId: "session1",
                    subMessages: [new SubMessage({ text: "Can you help me understand the main concepts in this paper?" })],
                    followUpQuestions: [],
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: 'active',
                    role: 'user'
                }),
                new DeepTutorMessage({
                    id: "msg2",
                    parentMessageId: "msg1",
                    userId: "chatbot1",
                    sessionId: "session1",
                    subMessages: [new SubMessage({ text: "Of course! I'd be happy to help you understand the paper. Could you please share the title or key points you'd like me to focus on?", sources: [new MessageSource({ index: 0, page: 3, referenceString: "1.1" })]})],
                    followUpQuestions: ["Would you like me to explain the specific architecture they used?"],
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: 'active',
                    role: 'chatbot'
                }),
                new DeepTutorMessage({
                    id: "msg3",
                    parentMessageId: "msg2",
                    userId: "user1",
                    sessionId: "session1",
                    subMessages: [new SubMessage({ text: "The paper is about machine learning applications in healthcare. I'm particularly interested in the methodology section." })],
                    followUpQuestions: [],
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: 'active',
                    role: 'user'
                }),
                new DeepTutorMessage({
                    id: "msg4",
                    parentMessageId: "msg3",
                    userId: "chatbot1",
                    sessionId: "session1",
                    subMessages: [new SubMessage({ text: "I'll help you analyze the methodology section. The paper uses a deep learning approach with convolutional neural networks to process medical imaging data. Would you like me to explain the specific architecture they used?", sources: [new MessageSource({ index: 0, page: 4, referenceString: "Erwin’s actual decisions and the essence of his life goal all  contributed to the “human race,” namely the Eldian people." })] })],
                    followUpQuestions: ["Would you like me to explain the specific architecture they used?"],
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: 'active',
                    role: 'chatbot'
                }),
                new DeepTutorMessage({
                    id: "msg5",
                    parentMessageId: "msg4",
                    userId: "user1",
                    sessionId: "session1",
                    subMessages: [new SubMessage({ text: "Sure!" })],
                    followUpQuestions: [],
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: 'active',
                    role: 'user'
                })
            ];
            return messages;
        }

        sampleMessages2() {
            const messages = [
                new DeepTutorMessage({
                    id: "msg1",
                    parentMessageId: null,
                    userId: "user1",
                    sessionId: "session1",
                    subMessages: [new SubMessage({ text: "Can you help me understand the main concepts in this paper?" })],
                    followUpQuestions: [],
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: 'active',
                    role: 'user'
                }),
                new DeepTutorMessage({
                    id: "msg2",
                    parentMessageId: "msg1",
                    userId: "chatbot1",
                    sessionId: "session1",
                    subMessages: [new SubMessage({ text: "Of course! I'd be happy to help you understand the paper. Could you please share the title or key points you'd like me to focus on?" })],
                    followUpQuestions: ["Would you like me to explain the specific architecture they used?"],
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    status: 'active',
                    role: 'chatbot'
                })
            ];
            return messages;
        }

        render() {
            Zotero.debug("Deep tutor loading");
            this.initialized = true;
        }

        setupEventListeners() {
            const buttons = this.querySelectorAll('.nav-button');
            buttons.forEach(button => {
                button.addEventListener('command', () => {
                    this.switchComponent(button.id);
                });
            });
        }

        static get observedAttributes() {
			return ['collapsed'];
		}

        switchComponent(buttonId) {
            // Hide all components
            const components = this.querySelectorAll('#content-container > *');
            /*
            components.forEach(comp => {
                comp.style.display = 'none';
            });
            */
            // Show selected component
            const componentId = buttonId.replace('-btn', '-component');
            const selectedComponent = this.querySelector(`#${componentId}`);
            let buttonChoice = 'open';
            if (selectedComponent) {
                  // If switching away from tutor component, update sesNamToMes with current messages
                if (componentId === 'tutor-component' && this.curSesName) {
                    const messages = this._tutorBox.messages;
                    if (messages) {
                        this.sesNamToMes.set(this.curSesName, messages);
                    }
                }
                if (selectedComponent.style.display === 'block') {
                    selectedComponent.style.display = 'none';
                    buttonChoice = 'close';
                } else {
                    components.forEach(comp => {
                        comp.style.display = 'none';
                    });
                    selectedComponent.style.display = 'block';
                }
            }

            // Update button styles
            const buttons = this.querySelectorAll('.nav-button');
            buttons.forEach(btn => {
                if (btn.id === buttonId && buttonChoice === 'open') {
                    btn.style.backgroundColor = '#e9ecef';
                    btn.style.fontWeight = '600';
                } else {
                    btn.style.backgroundColor = 'transparent';
                    btn.style.fontWeight = 'normal';
                }
            });
        }

        _handleTutorDataUpdate(pdfDataList) {
            // Handle the data update from DeepTutorBox
            // You can store it, process it, or update the UI as needed
            Zotero.debug(`Received PDF data update with ${pdfDataList.length} items`);
            // Add your custom handling logic here
        }
    }

    customElements.define("deep-tutor-pane", DeepTutorPane);
}
