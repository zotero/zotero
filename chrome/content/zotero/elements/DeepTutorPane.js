/*
   ***** BEGIN LICENSE BLOCK *****


   Copyright © 2024 Corporation for Digital Scholarship
                Virginia, Virginia, USA
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

if (typeof window === "undefined") {
	this.XULElementBase = require("resource://zotero/browser-shims.js").XULElementBase;
	this.MozXULElement = require("resource://zotero/browser-shims.js").MozXULElement;
} else {
	this.XULElementBase = XULElementBase;
	this.MozXULElement = MozXULElement;
}

// Import API functions
import {
	getUserByProviderUserId,
	getMessagesBySessionId,
	getUserById,
	getSessionsByUserId,
	getPreSignedUrl,
	uploadFileToAzure,
	createSession,
	createMessage,
	subscribeToChat
} from '../api/libs/api.js';

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
            this._preSignedUrlDataMap = new Map(); // Maps document ID to preSignedUrlData
        }

        addMapping(fileName, documentId, fileId, preSignedUrlData) {
            this._map.set(fileName, documentId);
            this._reverseMap.set(documentId, fileName);
            this._fileIdMap.set(documentId, fileId);
            if (preSignedUrlData) {
                this._preSignedUrlDataMap.set(documentId, preSignedUrlData);
            }
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
                documentToFileId: Object.fromEntries(this._fileIdMap),
                documentToPreSignedUrlData: Object.fromEntries(this._preSignedUrlDataMap)
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
               font-family: 'Roboto', sans-serif;
           ">
               <hbox id="top-bar" style="margin-bottom: 12px; gap: 8px; align-items: center; background: #e9ecef; padding: 2px 6px; border-radius: 6px; width: fit-content; height: 28px;">
                   <button id="tab1-btn" label="Tab 1" style="min-width: 48px; background: #0687E5; color: #000000; border: none; border-radius: 4px; padding: 2px 12px; font-size: 0.95em; margin-right: 2px; height: 22px; font-family: 'Roboto', sans-serif;" />
                   <button id="tab2-btn" label="Tab 2" style="min-width: 48px; background: #0687E5; color: #000000; border: none; border-radius: 4px; padding: 2px 12px; font-size: 0.95em; margin-right: 8px; height: 22px; font-family: 'Roboto', sans-serif;" />
                   <button id="model-btn" class="nav-button" label="+" style="background: #0687E5; color: #000000; border: none; font-size: 1em; margin-right: 4px; padding: 0 4px; min-width: 20px; height: 20px; font-family: 'Roboto', sans-serif;" />
                   <button id="history-btn" class="nav-button" label="\u21bb" style="background: #0687E5; color: #000000; border: none; font-size: 1em; margin-right: 4px; padding: 0 4px; min-width: 20px; height: 20px; font-family: 'Roboto', sans-serif;" />
                   <button id="close-btn" label="\u2715" style="background: #0687E5; color: #000000; border: none; font-size: 1em; padding: 0 4px; min-width: 20px; height: 20px; font-family: 'Roboto', sans-serif;" />
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
                   <button id="tutor-btn" class="nav-button" label="Tutor" style="background: #0687E5; color: #000000; font-family: 'Roboto', sans-serif;" />
                   <button id="notes-btn" class="nav-button" label="Notes" style="background: #0687E5; color: #000000; font-family: 'Roboto', sans-serif;" />
                   <button id="settings-btn" class="nav-button" label="Settings" style="background: #0687E5; color: #000000; font-family: 'Roboto', sans-serif;" />
                   <button id="no-login-btn" class="nav-button" label="No Login" style="background: #0687E5; color: #000000; font-family: 'Roboto', sans-serif;" />
               </hbox>
               <vbox id="content-container" flex="1" style="width: 100%; height: 100%; overflow: hidden;">
                   <deep-tutor-box id="tutor-component" style="height: 100%; width: 100%;" />
                   <deep-notes-box id="notes-component" style="height: 100%; width: 100%; display: none;" />
                   <deep-settings-box id="settings-component" style="height: 100%; width: 100%; display: none;" />
                   <session-history-box id="history-component" style="height: 100%; width: 100%; display: none;" />
                   <model-selection id="model-component" style="height: 100%; width: 100%; display: none;" />
                   <no-login-page id="no-login-component" style="height: 100%; width: 100%; display: none;" />
               </vbox>
           </vbox>
        `);

        // Helper function to get authenticated user ID
        async _getAuthenticatedUserId() {
            try {
                // Try to get the user ID from the DeepTutor component if it's available
                const deepTutorComponent = document.querySelector('deep-tutor');
                if (deepTutorComponent && deepTutorComponent.getCurrentUserId) {
                    const userId = await deepTutorComponent.getCurrentUserId();
                    if (userId) {
                        Zotero.debug(`DeepTutorPane: Got user ID from DeepTutor component: ${userId}`);
                        return userId;
                    }
                }

                // Try to access authentication through window or global scope
                if (window.DeepTutorAuth && window.DeepTutorAuth.getCurrentUser) {
                    const currentUserData = await window.DeepTutorAuth.getCurrentUser();
                    if (currentUserData && currentUserData.user) {
                        // Get user attributes to retrieve the 'sub' field (Cognito User ID)
                        return new Promise((resolve, reject) => {
                            currentUserData.user.getUserAttributes((err, attributes) => {
                                if (err) {
                                    Zotero.debug(`DeepTutorPane: Error getting user attributes: ${err.message}`);
                                    reject(err);
                                    return;
                                }

                                // Find the 'sub' attribute which is the Cognito User ID
                                const subAttribute = attributes.find(attr => attr.getName() === 'sub');
                                if (!subAttribute) {
                                    reject(new Error('No sub attribute found in user attributes'));
                                    return;
                                }

                                const providerUserId = subAttribute.getValue();
                                Zotero.debug(`DeepTutorPane: Using provider user ID: ${providerUserId}`);

                                // Get user data using the provider user ID (sub)
                                this._getUserByProviderUserId(providerUserId)
                                    .then(userData => {
                                        resolve(userData.id);
                                    })
                                    .catch(error => {
                                        Zotero.debug(`DeepTutorPane: Error getting user by provider ID: ${error.message}`);
                                        reject(error);
                                    });
                            });
                        });
                    }
                }

                throw new Error('No authentication method available');
            } catch (error) {
                Zotero.debug(`DeepTutorPane: Error in _getAuthenticatedUserId: ${error.message}`);
                // Fallback to hardcoded ID if authentication fails
                return '67f5b836cb8bb15b67a1149e';
            }
        }

        // Helper function to get user by provider user ID via API call
        async _getUserByProviderUserId(providerUserId) {
            try {
                const userData = await getUserByProviderUserId(providerUserId);
                return userData;
            } catch (error) {
                Zotero.debug(`DeepTutorPane: Error in _getUserByProviderUserId: ${error.message}`);
                throw error;
            }
        }

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
            this.addEventListener('HistorySessionSelected', async (event) => {
                try {
                    Zotero.debug(`DeepTutorPane: HistorySessionSelected event received for session: ${event.detail.sessionName}`);
                    const sessionName = event.detail.sessionName;
                    const sessionObj = this.sesNamToObj.get(sessionName);

                    if (!sessionObj) {
                        Zotero.debug(`DeepTutorPane: No session object found for: ${sessionName}`);
                        return;
                    }

                    Zotero.debug(`DeepTutorPane: Fetching messages for session: ${sessionName}`);
                    try {
                        const messages = await getMessagesBySessionId(sessionObj.id);
                        Zotero.debug(`DeepTutorPane: Successfully fetched ${messages.length} messages`);
                        Zotero.debug(`DeepTutorPane: Messages content: ${JSON.stringify(messages)}`);

                        this.curSesName = sessionName;
                        const documentIds = sessionObj?.documentIds || [];
                        Zotero.debug(`DeepTutorPane: Loading messages with ${documentIds.length} document IDs`);

                        await this._tutorBox._LoadMessage(messages, documentIds, sessionObj);
                        Zotero.debug(`DeepTutorPane: Messages loaded successfully`);

                        // Dispatch SessionIdUpdate event to DeepTutorBox
                        if (sessionObj?.id) {
                            const sessionIdEvent = new CustomEvent('SessionIdUpdate', {
                                detail: { sessionId: sessionObj.id },
                                bubbles: true
                            });
                            this._tutorBox.dispatchEvent(sessionIdEvent);
                            Zotero.debug(`DeepTutorPane: Dispatched SessionIdUpdate event with ID: ${sessionObj.id}`);

                            // Also dispatch UserIdUpdate event
                            if (sessionObj.userId) {
                                const userIdEvent = new CustomEvent('UserIdUpdate', {
                                    detail: { userId: sessionObj.userId },
                                    bubbles: true
                                });
                                this._tutorBox.dispatchEvent(userIdEvent);
                                Zotero.debug(`DeepTutorPane: Dispatched UserIdUpdate event with ID: ${sessionObj.userId}`);
                            }
                        }

                        if (this.sesNamToObj.get(sessionName)) {
                            let tempSes = this.sesNamToObj.get(sessionName);
                            Zotero.debug(`DeepTutorPane: Loading attachments for session: ${sessionName}`);
                            if (tempSes.documentIds.length > 0) {
                                // Get the file ID from the mapping using the document ID
                                const documentId = tempSes.documentIds[0];
                                const fileId = tempSes.metadata?.fileDocumentMap?.documentToFileId?.[documentId];
                                if (fileId) {
                                    Zotero.debug(`DeepTutorPane: Viewing attachment with file ID: ${fileId}`);
                                    // ZoteroPane.viewAttachment(fileId);
                                } else {
                                    Zotero.debug(`DeepTutorPane: No file ID mapping found for document ID: ${documentId}`);
                                }
                            }
                        }
                        // transfer to tutor component if session exist
                        Zotero.debug(`DeepTutorPane: Transferring to tutor component`);
                        const components = this.querySelectorAll('#content-container > *');
                        components.forEach(comp => {
                            comp.style.display = 'none';
                        });
                        const tutorComponent = this.querySelector('#tutor-component');
                        if (tutorComponent) {
                            tutorComponent.style.display = 'block';
                        }

                    } catch (error) {
                        Zotero.debug(`DeepTutorPane: Error in fetching messages: ${error.message}`);
                    }
                } catch (error) {
                    Zotero.debug(`DeepTutorPane: Error in HistorySessionSelected handler: ${error.message}`);
                }
            });

            // Listen for RegisterReq event
            this.addEventListener('RegisterReq', (event) => {
                Zotero.debug(`DeepTutorPane: Received RegisterReq event with data: ${JSON.stringify(event.detail)}`);
                const newSession = this.newEmptySession(event.detail);
                Zotero.debug(`DeepTutorPane: Created new session: ${JSON.stringify(newSession)}`);
                this.updateSessionHistory();

                // Handle component display based on sessions length
                // questionable code: if session exist go to tutor component, else go to model component
                Zotero.debug(`DeepTutorPane: WWWWWWWWWWWWWW Loading sessions: ${this.sessions.length}`);
                const components = this.querySelectorAll('#content-container > *');
                components.forEach(comp => {
                    comp.style.display = 'none';
                });
                const tutorComponent = this.querySelector('#tutor-component');
                if (tutorComponent) {
                    tutorComponent.style.display = 'block';
                }
            });

            // Initialize session management attributes
            this.curSesName = null;  // Current session name
            this.sessions = []; // List of Session objects
            this.sesNamToObj = new Map();  // Map of session names to Session objects
            this.sesNamToMes = new Map();  // Map of session names to lists of Zotero.Message objects
            Zotero.debug(`DeepTutorPane: QQQQQ New session created, and we should change to the tutor component`);


            // Load sessions
            this.loadSession();

            // Add event listener for SignInClicked from noLoginPage
            this.addEventListener('SignInClicked', () => {
                this._toggleSignUpPopup(true);
            });
            // Add a close handler for the popup (delegated)
            this._ensureSignUpPopup();
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
            // questionable code: if session exist go to tutor component, else go to model component
            Zotero.debug(`DeepTutorPane: WWWWWWWWWWWWWW Loading sessions: ${this.sessions.length}`);

            const components = this.querySelectorAll('#content-container > *');
            if (this.sessions.length === 0) {
                components.forEach(comp => {
                    comp.style.display = 'none';
                });
                const modelComponent = this.querySelector('#model-component');
                if (modelComponent) {
                    modelComponent.style.display = 'block';
                }
            } else {
                components.forEach(comp => {
                    comp.style.display = 'none';
                });
                const tutorComponent = this.querySelector('#tutor-component');
                if (tutorComponent) {
                    tutorComponent.style.display = 'block';
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

        /**
         * Fetches and initializes sessions for the current user.
         * This function performs the following steps:
         * 1. Fetches user data to get the correct user ID
         * 2. Uses the user ID to fetch all sessions associated with the user
         * 3. Converts API response sessions into DeepTutorSession objects
         * 4. Updates local session storage and mapping
         * If any API calls fail, falls back to default sample sessions
         */
        async sampleSessions() {
            try {
                Zotero.debug('DeepTutorPane: Starting sampleSessions function');

                // Get authenticated user ID
                const authenticatedUserId = await this._getAuthenticatedUserId();
                Zotero.debug(`DeepTutorPane: Using authenticated user ID: ${authenticatedUserId}`);

                // Get user ID from API
                Zotero.debug('DeepTutorPane: Attempting to fetch user data...');
                const userData = await getUserById(authenticatedUserId);
                Zotero.debug(`DeepTutorPane: Fetched user data: ${JSON.stringify(userData)}`);

                // Get sessions by userId
                Zotero.debug(`DeepTutorPane: Attempting to fetch sessions for user ID: ${userData.id}`);
                const sessionsData = await getSessionsByUserId(userData.id);
                Zotero.debug(`DeepTutorPane: Successfully fetched ${sessionsData.length} sessions: ${JSON.stringify(sessionsData)}`);

                // Convert API sessions to DeepTutorSession objects
                Zotero.debug('DeepTutorPane: Converting API sessions to DeepTutorSession objects...');
                this.sessions = sessionsData.map(sessionData => {
                    Zotero.debug(`DeepTutorPane: Converting session: ${JSON.stringify(sessionData)}`);
                    return new DeepTutorSession({
                        id: sessionData.id,
                        userId: sessionData.userId,
                        sessionName: sessionData.sessionName,
                        creationTime: sessionData.creationTime,
                        lastUpdatedTime: sessionData.lastUpdatedTime,
                        type: sessionData.type,
                        status: sessionData.status,
                        statusTimeline: sessionData.statusTimeline,
                        documentIds: sessionData.documentIds,
                        generateHash: sessionData.generateHash
                    });
                });
                Zotero.debug(`DeepTutorPane: Successfully converted ${this.sessions.length} sessions`);

                // Update sesNamToObj with session data
                Zotero.debug('DeepTutorPane: Updating session name to object mapping...');
                this.sessions.forEach(session => {
                    Zotero.debug(`DeepTutorPane: Mapping session name "${session.sessionName}" to session object`);
                    this.sesNamToObj.set(session.sessionName, session);
                });
                Zotero.debug(`DeepTutorPane: Successfully mapped ${this.sesNamToObj.size} sessions`);

            } catch (error) {
                Zotero.debug(`DeepTutorPane: Error in sampleSessions: ${error.message}`);
                Zotero.debug('DeepTutorPane: Falling back to default sessions...');

                // Get fallback user ID
                const fallbackUserId = await this._getAuthenticatedUserId();

                // Fallback to default sessions if API calls fail
                const session1 = new DeepTutorSession({
                    sessionName: "Session 1",
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    userId: fallbackUserId
                });
                Zotero.debug('DeepTutorPane: Created fallback session 1');

                const session2 = new DeepTutorSession({
                    sessionName: "Session 2",
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    userId: fallbackUserId
                });
                Zotero.debug('DeepTutorPane: Created fallback session 2');

                const session3 = new DeepTutorSession({
                    sessionName: "Session 3",
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    userId: fallbackUserId
                });
                Zotero.debug('DeepTutorPane: Created fallback session 3');

                this.sessions = [session1, session2, session3];
                Zotero.debug('DeepTutorPane: Set fallback sessions array');

                this.sessions.forEach(session => {
                    this.sesNamToObj.set(session.sessionName, session);
                });
                Zotero.debug(`DeepTutorPane: Mapped ${this.sesNamToObj.size} fallback sessions`);
            }
            Zotero.debug('DeepTutorPane: Completed sampleSessions function');
        }

        async newEmptySession(eventDetail) {
            try {
                // Get authenticated user ID
                const authenticatedUserId = await this._getAuthenticatedUserId();

                // Get user ID from API
                const userData = await getUserById(authenticatedUserId);
                Zotero.debug(`DeepTutorPane: Fetched user data: ${JSON.stringify(userData)}`);

                // Create file-document mapping
                const fileDocumentMap = new FileDocumentMap();

                // Handle file uploads if fileList exists
                const uploadedDocumentIds = [];
                if (eventDetail.fileList && eventDetail.fileList.length > 0) {
                    for (const fileId of eventDetail.fileList) {
                        try {
                            // Get the file object from Zotero
                            const file = eventDetail.originalFileList.length > 0 ? eventDetail.originalFileList[0] : null;
                            Zotero.debug(`DeepTutorPane: XXX Processing file: ${file}`);
                            if (!file) {
                                Zotero.debug(`DeepTutorPane: No file found for ID: ${fileId}`);
                                continue;
                            }

                            // Get the file name
                            const fileName = file.getField('title');
                            Zotero.debug(`DeepTutorPane: Processing file: ${fileName}`);

                            // 1. Get pre-signed URL for the file
                            const preSignedUrlData = await getPreSignedUrl(userData.id, fileName);
                            Zotero.debug(`DeepTutorPane: Got pre-signed URL: ${JSON.stringify(preSignedUrlData)}`);

                            // Store the preSignedUrlData in fileDocumentMap
                            fileDocumentMap.addMapping(fileName, preSignedUrlData.documentId, fileId, preSignedUrlData);

                            // Get the file as a Data URL and convert to Blob
                            const dataURI = await file.attachmentDataURI;
                            if (!dataURI) {
                                throw new Error(`Failed to get file data for: ${fileName}`);
                            }

                            // Convert Data URL to Blob
                            const response = await fetch(dataURI);
                            const blob = await response.blob();

                            // 2. Upload file to Azure Blob Storage
                            await uploadFileToAzure(preSignedUrlData.preSignedUrl, blob);

                            Zotero.debug(`DeepTutorPane: File uploaded successfully: ${fileName}`);

                            // Add mapping between file, document ID, and original file ID
                            uploadedDocumentIds.push(preSignedUrlData.documentId);

                        } catch (fileError) {
                            Zotero.debug(`DeepTutorPane: Error uploading file ${fileId}: ${fileError.message}`);
                            // Continue with other files even if one fails
                            continue;
                        }
                    }
                }

                // 3. Create session with uploaded files
                const sessionData = {
                    userId: userData.id,
                    sessionName: eventDetail.name || "New Session",
                    type: SessionType.BASIC,
                    status: SessionStatus.CREATED,
                    documentIds: uploadedDocumentIds,
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    statusTimeline: [],
                    generateHash: null
                };

                const sessionResponse = await createSession(sessionData);
                Zotero.debug(`DeepTutorPane: Session created successfully: ${JSON.stringify(sessionResponse)}`);

                const messageStart = {
                    id: null,
                    parentMessageId: null,
                    userId: sessionResponse.userId,
                    sessionId: sessionResponse.id,
                    subMessages: [{
                        text: "Can you give me a summary of this document?",
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

                Zotero.debug(`DeepTutorPane: Created initial message: ${JSON.stringify(messageStart)}`);
                const responseData2 = await createMessage(messageStart);
                Zotero.debug(`DeepTutorPane: API response for initial message: ${JSON.stringify(responseData2)}`);

                Zotero.debug(`DeepTutorPane: KKKKK File names: ${fileDocumentMap.getAllFileNames()}`);
                let startConversation = new Conversation({
                    userId: sessionResponse.userId,
                    sessionId: sessionResponse.id,
                    ragSessionId: null,
                    storagePaths: fileDocumentMap.getAllFileNames().map(fileName => {
                        const documentId = fileDocumentMap.getDocumentId(fileName);
                        return `tutor/materials/${documentId}/${fileName}`;
                    }),
                    history: [],
                    message: responseData2,
                    streaming: true,
                    type: SessionType.LITE
                });

                Zotero.debug(`DeepTutorPane: Sending API request to: https://api.staging.deeptutor.knowhiz.us/api/chat/subscribe`);
                Zotero.debug(`DeepTutorPane: Request body: ${JSON.stringify(startConversation)}`);

                const response3 = await subscribeToChat(startConversation);

                // Create local session object
                const session = new DeepTutorSession({
                    ...sessionData,
                    id: sessionResponse.id
                });

                // Store the file-document mapping in the session's metadata
                session.metadata = {
                    fileDocumentMap: fileDocumentMap.toJSON()
                };

                this.sessions.push(session);
                this.sesNamToObj.set(session.sessionName, session);
                return session;

            } catch (error) {
                Zotero.debug(`DeepTutorPane: Error in newEmptySession: ${error.message}`);
                // Get fallback user ID
                const fallbackUserId = await this._getAuthenticatedUserId();

                // Fallback to local session creation if API calls fail
                const session = new DeepTutorSession({
                    sessionName: eventDetail.name || "New Session",
                    creationTime: new Date().toISOString(),
                    lastUpdatedTime: new Date().toISOString(),
                    documentIds: eventDetail.fileList ? eventDetail.fileList.map(file => file.id) : [],
                    userId: fallbackUserId,
                    type: eventDetail.type || 'default',
                    status: eventDetail.status || 'active'
                });
                this.sessions.push(session);
                this.sesNamToObj.set(session.sessionName, session);
                return session;
            }
        }

        async pushMessageToAPI(message) {
            try {
                Zotero.debug(`DeepTutorPane: Attempting to push message to API: ${JSON.stringify(message)}`);
                const responseData = await createMessage(message);
                Zotero.debug(`DeepTutorPane: API response received: ${JSON.stringify(responseData)}`);
                return responseData;
            } catch (error) {
                Zotero.debug(`DeepTutorPane: Error with primary API call: ${error.message}`);
                // Try alternative call
                try {
                    Zotero.debug(`DeepTutorPane: Trying alternative API call...`);
                    const altResponseData = await createMessage(message);
                    Zotero.debug(`DeepTutorPane: Alternative API response: ${JSON.stringify(altResponseData)}`);
                    return altResponseData;
                } catch (altError) {
                    Zotero.debug(`DeepTutorPane: Error with alternative API call: ${altError.message}`);
                    return null;
                }
            }
        }

        async sampleMessages() {
            try {
                Zotero.debug(`DeepTutorPane: Starting sampleMessages...`);

                // Get the current session
                const currentSession = this.sesNamToObj.get(this.curSesName);
                if (!currentSession) {
                    throw new Error("No active session found");
                }

                Zotero.debug(`DeepTutorPane: Using session ID: ${currentSession.id} and user ID: ${currentSession.userId}`);

                // Create initial message
                const initialMessage = {
                    id: null,
                    parentMessageId: null,
                    userId: currentSession.userId,
                    sessionId: currentSession.id,
                    subMessages: [{
                        text: "Can you help me understand the main concepts in this paper?",
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
                Zotero.debug(`DeepTutorPane: Created initial message: ${JSON.stringify(initialMessage)}`);

                // Push message to API and get response
                const apiResponse = await this.pushMessageToAPI(initialMessage);
                Zotero.debug(`DeepTutorPane: API response in sampleMessages: ${JSON.stringify(apiResponse)}`);

                // Create messages array with consistent structure
                const messages = [
                    new DeepTutorMessage({
                        id: null,
                        parentMessageId: initialMessage.parentMessageId,
                        userId: currentSession.userId,
                        sessionId: currentSession.id,
                        subMessages: initialMessage.subMessages.map(subMsg => new SubMessage({
                            text: subMsg.text,
                            image: subMsg.image,
                            audio: subMsg.audio,
                            contentType: subMsg.contentType,
                            creationTime: subMsg.creationTime,
                            sources: subMsg.sources
                        })),
                        followUpQuestions: initialMessage.followUpQuestions,
                        creationTime: initialMessage.creationTime,
                        lastUpdatedTime: initialMessage.lastUpdatedTime,
                        status: initialMessage.status,
                        role: initialMessage.role
                    }),
                    new DeepTutorMessage({
                        id: null,
                        parentMessageId: initialMessage.id,
                        userId: currentSession.userId,
                        sessionId: currentSession.id,
                        subMessages: [new SubMessage({
                            text: apiResponse ? apiResponse.text : "Of course! I'd be happy to help you understand the paper. Could you please share the title or key points you'd like me to focus on?",
                            image: null,
                            audio: null,
                            contentType: ContentType.TEXT,
                            creationTime: new Date().toISOString(),
                            sources: []
                        })],
                        followUpQuestions: ["Would you like me to explain the specific architecture they used?"],
                        creationTime: new Date().toISOString(),
                        lastUpdatedTime: new Date().toISOString(),
                        status: MessageStatus.UNVIEW,
                        role: MessageRole.TUTOR
                    })
                ];
                Zotero.debug(`DeepTutorPane: Created messages array: ${JSON.stringify(messages)}`);
                return messages;
            } catch (error) {
                Zotero.debug(`DeepTutorPane: Error in sampleMessages: ${error.message}`);

                // Get fallback user ID
                const fallbackUserId = await this._getAuthenticatedUserId();

                // Return default messages if API call fails
                const defaultMessages = [
                    new DeepTutorMessage({
                        id: null,
                        parentMessageId: null,
                        userId: fallbackUserId,
                        sessionId: "default_session",
                        subMessages: [new SubMessage({
                            text: "Can you help me understand the main concepts in this paper?",
                            image: null,
                            audio: null,
                            contentType: ContentType.TEXT,
                            creationTime: new Date().toISOString(),
                            sources: []
                        })],
                        followUpQuestions: [],
                        creationTime: new Date().toISOString(),
                        lastUpdatedTime: new Date().toISOString(),
                        status: MessageStatus.UNVIEW,
                        role: MessageRole.USER
                    }),
                    new DeepTutorMessage({
                        id: null,
                        parentMessageId: `msg_${Date.now()}`,
                        userId: fallbackUserId,
                        sessionId: "default_session",
                        subMessages: [new SubMessage({
                            text: "Of course! I'd be happy to help you understand the paper. Could you please share the title or key points you'd like me to focus on?",
                            image: null,
                            audio: null,
                            contentType: ContentType.TEXT,
                            creationTime: new Date().toISOString(),
                            sources: []
                        })],
                        followUpQuestions: ["Would you like me to explain the specific architecture they used?"],
                        creationTime: new Date().toISOString(),
                        lastUpdatedTime: new Date().toISOString(),
                        status: MessageStatus.UNVIEW,
                        role: MessageRole.TUTOR
                    })
                ];
                Zotero.debug(`DeepTutorPane: Returning default messages: ${JSON.stringify(defaultMessages)}`);
                return defaultMessages;
            }
        }

        sampleMessages2() {
            const messages = [
                new DeepTutorMessage({
                    id: null,
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
                    id: null,
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

        attributeChangedCallback(name, oldValue, newValue) {
            if (name === 'collapsed') {
                const mainContainer = this.querySelector('#main-container');
                if (mainContainer) {
                    if (newValue === 'true') {
                        // When collapsing, set width to 0 and hide content
                        this.style.width = '0';
                        this.style.minWidth = '0';
                        mainContainer.style.width = '0';
                        mainContainer.style.minWidth = '0';
                        mainContainer.style.overflow = 'hidden';
                        mainContainer.style.opacity = '0';
                        mainContainer.style.transition = 'width 0.3s ease-in-out, opacity 0.3s ease-in-out';
                        mainContainer.style.visibility = 'hidden';
                    } else {
                        // When expanding, restore dimensions and show content
                        this.style.width = '100%';
                        this.style.minWidth = '0';
                        mainContainer.style.width = '100%';
                        mainContainer.style.minWidth = '0';
                        mainContainer.style.overflow = 'visible';
                        mainContainer.style.opacity = '1';
                        mainContainer.style.transition = 'width 0.3s ease-in-out, opacity 0.3s ease-in-out';
                        mainContainer.style.visibility = 'visible';
                    }
                }
            }
        }

        async switchComponent(buttonId) {
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

                // If switching to history component, refresh sessions
                if (componentId === 'history-component') {
                    Zotero.debug('DeepTutorPane: History component opened, refreshing sessions...');
                    await this.sampleSessions();
                    this.updateSessionHistory();
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
                    Zotero.debug('DeepTutorPaneKKKK: Updating button styles for open button #0687E5');
                    btn.style.backgroundColor = '#0687E5';
                    btn.style.color = '#FFFFFF';
                    btn.style.fontFamily = 'Roboto, sans-serif';
                    btn.style.fontWeight = 'bold';
                } else {
                    btn.style.backgroundColor = '#F8F6F7';
                    btn.style.color = '#000000';
                    btn.style.fontFamily = 'Roboto, sans-serif';
                    btn.style.fontWeight = 'bold';
                }
            });
        }

        _handleTutorDataUpdate(pdfDataList) {
            // Handle the data update from DeepTutorBox
            // You can store it, process it, or update the UI as needed
            Zotero.debug(`Received PDF data update with ${pdfDataList.length} items`);
            // Add your custom handling logic here
        }

        _ensureSignUpPopup() {
            // Only create once
            if (this._signUpPopup) return;
            const mainContainer = this.querySelector('#main-container');
            if (!mainContainer) return;
            // Create the popup container
            const popup = document.createXULElement('vbox');
            popup.setAttribute('id', 'signup-popup');
            popup.setAttribute('style', `
                display: none;
                position: absolute;
                left: 50%;
                top: 120px;
                transform: translateX(-50%);
                z-index: 9999;
                background: transparent;
                align-items: center;
                justify-content: flex-start;
                width: 100%;
                pointer-events: none;
            `);
            // Simple: Render dpt-signup-page directly
            const signUpPage = document.createElement('dpt-signup-page');
            signUpPage.addEventListener('CloseSignUp', () => {
                this._toggleSignUpPopup(false);
            });
            popup.appendChild(signUpPage);
            mainContainer.appendChild(popup);
            this._signUpPopup = popup;
        }

        _toggleSignUpPopup(show) {
            this._ensureSignUpPopup();
            if (this._signUpPopup) {
                this._signUpPopup.style.display = show ? 'flex' : 'none';
            }
        }
    }

    customElements.define("deep-tutor-pane", DeepTutorPane);
}
