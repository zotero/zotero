/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2019 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
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

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import ModelSelection from './ModelSelection.js';
import SessionHistory from './SessionHistory.js';
import DeepTutorChatBox from './DeepTutorChatBox.js';
import DeepTutorWelcomePane from './DeepTutorWelcomePane.js';
import DeepTutorSignIn from './DeepTutorSignIn.js';
import DeepTutorSignUp from './DeepTutorSignUp.js';
import DeepTutorUpgradePremium from './DeepTutorUpgradePremium.js';
import DeepTutorTopSection from './DeepTutorTopSection.js';
import DeepTutorBottomSection from './DeepTutorBottomSection.js';
import { 
	getUserById, 
	getSessionsByUserId, 
	getMessagesBySessionId,
	getSessionById 
} from './api/libs/api';

// Enums
const SessionStatus = {
	CREATED: 'CREATED',
	READY: 'READY',
	PROCESSING_ERROR: 'PROCESSING_ERROR',
	FINAL_PROCESSING_ERROR: 'FINAL_PROCESSING_ERROR',
	PROCESSING: 'PROCESSING',
	DELETED: 'DELETED'
};

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

// Utility Classes
class SessionStatusEvent {
	constructor(effectiveTime, status) {
		this.effectiveTime = effectiveTime;
		this.status = status;
	}
}

class PresignedUrl {
	constructor(preSignedUrl, preSignedReadUrl) {
		this.preSignedUrl = preSignedUrl;
		this.preSignedReadUrl = preSignedReadUrl;
	}
}

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

const logoPath = 'chrome://zotero/content/DeepTutorMaterials/DPTLogo.png';
const HistoryIconPath = 'chrome://zotero/content/DeepTutorMaterials/History.png';
const PlusIconPath = 'chrome://zotero/content/DeepTutorMaterials/Plus.png';
const FeedIconPath = 'chrome://zotero/content/DeepTutorMaterials/Feedback.png';
const PersonIconPath = 'chrome://zotero/content/DeepTutorMaterials/Person.png';
const MicroscopeIconPath = 'chrome://zotero/content/DeepTutorMaterials/Microscope.png';

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		width: '100%',
		background: '#f8f9fa',
		fontFamily: 'Roboto, Inter, Arial, sans-serif',
		position: 'relative',
	},
	top: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '6px 8px 3px 8px',
		minHeight: '64px',
		background: '#fff',
		borderBottom: '1px solid #e9ecef',
	},
	logo: {
		height: '32px',
		width: 'auto',
		display: 'block',
	},
	topRight: {
		display: 'flex',
		flexDirection: 'row',
		gap: '12px',
	},
	iconButton: {
		width: '40px',
		height: '40px',
		background: '#F8F6F7',
		border: 'none',
		borderRadius: '6px',
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: 'background-color 0.2s ease',
		padding: '8px',
	},
	iconButtonActive: {
		background: '#D9D9D9',
	},
	iconImage: {
		width: '24px',
		height: '24px',
		objectFit: 'contain',
	},
	middle: {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'flex-start',
		position: 'relative',
		background: '#f8f9fa',
		minHeight: 0,
		width: '100%',
		padding: '0',
	},
	paneList: {
		width: '100%',
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'flex-start',
		position: 'relative',
		padding: '0',
	},
	bottom: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '18px 32px 24px 32px',
		background: '#fff',
		borderTop: '1px solid #e9ecef',
	},
	bottomLeft: {
		display: 'flex',
		flexDirection: 'column',
		gap: '8px',
	},
	textButton: {
		background: '#F8F6F7',
		border: 'none',
		color: '#0687E5',
		fontWeight: 500,
		fontSize: '1em',
		fontFamily: 'Roboto, sans-serif',
		cursor: 'pointer',
		padding: '4px 8px',
		margin: 0,
		borderRadius: '4px',
		width: 'fit-content',
		textAlign: 'left',
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		transition: 'background-color 0.2s ease',
		':hover': {
			background: '#D9D9D9'
		}
	},
	buttonIcon: {
		width: '16px',
		height: '16px',
		objectFit: 'contain',
	},
	upgradeButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: '33px',
		minWidth: '33px',
		padding: '0 18px',
		background: '#0687E5',
		border: 'none',
		borderRadius: '8px',
		fontWeight: 600,
		fontSize: '1em',
		color: '#ffffff',
		cursor: 'pointer',
		boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
		transition: 'background 0.2s',
		fontFamily: 'Roboto, sans-serif',
	},
	profilePopup: {
		position: 'absolute',
		bottom: '100%',
		left: 0,
		background: '#fff',
		borderRadius: '8px',
		boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
		padding: '12px',
		marginBottom: '8px',
		zIndex: 1000,
		minWidth: '200px',
	},
	profileButtonContainer: {
		position: 'relative',
	},
	componentButton: {
		padding: '6px 18px',
		borderRadius: 6,
		border: '1px solid #0687E5',
		background: '#fff',
		color: '#0687E5',
		fontWeight: 600,
		cursor: 'pointer',
		fontFamily: 'Roboto, Inter, Arial, sans-serif',
		width: '100%',
		textAlign: 'left',
		marginBottom: '4px',
		transition: 'all 0.2s ease',
		'&:hover': {
			background: '#f0f9ff',
		},
	},
	componentButtonActive: {
		background: '#0687E5',
		color: '#fff',
	},
};

var DeepTutor = class DeepTutor extends React.Component {
	/**
	 * Initialize the DeepTutor React component in the given DOM element.
	 * @param {Element} domEl - The DOM element to render into
	 * @param {Object} opts - Options to pass as props
	 * @returns {Promise<DeepTutor>}
	 */
	static async init(domEl, opts={}) {
		Zotero.debug("DPTDPTDEBUG!! DeepTutor.init called with options:", opts);
		var ref;
		opts.domEl = domEl;
		await new Promise((resolve) => {
			Zotero.debug("DPTDPTDEBUG!! Creating React root for DeepTutor");
			ReactDOM.createRoot(domEl).render(<DeepTutor ref={(c) => {
				ref = c;
				Zotero.debug("DPTDPTDEBUG!! DeepTutor component mounted");
				resolve();
			}} {...opts} />);
		});
		Zotero.debug("DPTDPTDEBUG!! DeepTutor initialization complete");
		return ref;
	}
	
	static defaultProps = {
		onSelectionChange: () => {},
		onContextMenu: () => {},
		onActivate: () => {},
		emptyMessage: "No messages",
		onNewSession: () => {},
		onSendMessage: () => {},
		onSwitchComponent: () => {}
	};

	static propTypes = {
		onSelectionChange: PropTypes.func,
		onContextMenu: PropTypes.func,
		onActivate: PropTypes.func,
		emptyMessage: PropTypes.string,
		onNewSession: PropTypes.func,
		onSendMessage: PropTypes.func,
		onSwitchComponent: PropTypes.func
	};
	
	constructor(props) {
		super(props);
		this.state = {
			currentPane: 'welcome',
			sessions: [],
			sesNamToObj: new Map(),
			isLoading: false,
			error: null,
			showProfilePopup: false,
			showSignInPopup: false,
			showSignUpPopup: false,
			showUpgradePopup: false,
			showModelSelectionPopup: false,
			collapsed: false
		};
		this._initialized = false;
		this._selection = null;
		this._messages = [];
		this._currentSession = null;
		this._loadingPromise = new Promise(resolve => {
			this._loadingPromiseResolve = resolve;
		});
		this.containerRef = React.createRef();
	}

	componentDidMount() {
		this._initialized = true;
		this._loadingPromiseResolve();
		Zotero.debug("DeepTutor: Component mounted");
		// Only load sessions if we're not in welcome pane
		if (this.state.currentPane !== 'welcome') {
			this.loadSession();
		}
	}

	waitForLoad() {
		return this._loadingPromise;
	}

	async setMessages(messages) {
		this._messages = messages;
		this.forceUpdate();
	}

	async setCurrentSession(session) {
		this._currentSession = session;
		this.forceUpdate();
	}

	handleNewSession = () => {
		this.props.onNewSession();
	}

	handleSendMessage = () => {
		this.props.onSendMessage();
	}

	handleSwitchComponent = (componentId) => {
		this.props.onSwitchComponent(componentId);
	}

	// Placeholder for pane switching logic
	switchPane = (pane) => {
		this.setState({ currentPane: pane });
	};

	toggleProfilePopup = () => {
		this.setState(prevState => ({
			showProfilePopup: !prevState.showProfilePopup
		}));
	};

	toggleSignInPopup = () => {
		this.setState(prevState => ({
			showSignInPopup: !prevState.showSignInPopup
		}));
	};

	toggleSignUpPopup = () => {
		this.setState(prevState => ({
			showSignUpPopup: !prevState.showSignUpPopup
		}));
	};

	toggleUpgradePopup = () => {
		this.setState(prevState => ({
			showUpgradePopup: !prevState.showUpgradePopup
		}));
	};

	toggleModelSelectionPopup = () => {
		this.setState(prevState => ({
			showModelSelectionPopup: !prevState.showModelSelectionPopup
		}));
	};

	toggleCollapse = () => {
		this.setState(prevState => ({
			collapsed: !prevState.collapsed
		}), () => {
			if (window.ZoteroPane && typeof window.ZoteroPane.updateLayoutConstraints === 'function') {
				window.ZoteroPane.updateLayoutConstraints();
			}
		});
	}

	async loadSession() {
		try {
			this.setState({ isLoading: true, error: null });
			Zotero.debug("DeepTutor: Loading sessions...");

			// Fetch user data using centralized API
			const userData = await getUserById('67f5b836cb8bb15b67a1149e');
			
			// Fetch sessions using centralized API
			const sessionsData = await getSessionsByUserId(userData.id);
			Zotero.debug(`DeepTutor: Fetched ${sessionsData.length} sessions`);

			// Convert API data to DeepTutorSession objects
			const sessions = sessionsData.map(sessionData => new DeepTutorSession(sessionData));

			// Update session name to object mapping
			const sesNamToObj = new Map();
			sessions.forEach(session => {
				sesNamToObj.set(session.sessionName, session);
			});

			// Update state with new sessions
			this.setState({ 
				sessions,
				sesNamToObj,
				isLoading: false
			});

			// If no sessions, switch to model selection pane
			if (sessions.length === 0) {
				this.switchPane('modelSelection');
			} else {
				// If sessions exist, switch to main pane
				this.switchPane('main');
			}

			Zotero.debug(`DeepTutor: Successfully loaded ${sessions.length} sessions`);
		} catch (error) {
			Zotero.debug(`DeepTutor: Error loading sessions: ${error.message}`);
			this.setState({ 
				error: error.message,
				isLoading: false
			});
		}
	}

	handleSessionSelect = async (sessionName) => {
		try {
			const session = this.state.sesNamToObj.get(sessionName);
			if (!session) {
				Zotero.debug(`DeepTutor: No session object found for: ${sessionName}`);
				return;
			}

			Zotero.debug(`DeepTutor: Fetching messages for session: ${sessionName}`);
			try {
				const messages = await getMessagesBySessionId(session.id);
				Zotero.debug(`DeepTutor: Successfully fetched ${messages.length} messages`);
				Zotero.debug(`DeepTutor: Messages content: ${JSON.stringify(messages)}`);

				// Update state with current session and messages
				this.setState({
					currentSession: session,
					messages: messages,
					documentIds: session.documentIds || []
				});

				// Switch to main pane
				this.switchPane('main');

				// Update DeepTutorChatBox through props
				if (session.id) {
					// Update session ID through props
					if (this.props.onSessionIdUpdate) {
						this.props.onSessionIdUpdate(session.id);
						Zotero.debug(`DeepTutor: Updated session ID to ${session.id}`);
					}

					// Update user ID through props
					if (session.userId && this.props.onUserIdUpdate) {
						this.props.onUserIdUpdate(session.userId);
						Zotero.debug(`DeepTutor: Updated user ID to ${session.userId}`);
					}
				}

				Zotero.debug(`DeepTutor: Messages loaded successfully`);

			} catch (error) {
				Zotero.debug(`DeepTutor: Error in fetching messages: ${error.message}`);
			}
		} catch (error) {
			Zotero.debug(`DeepTutor: Error in handleSessionSelect: ${error.message}`);
		}
	}

	render() {
		Zotero.debug("DeepTutor: Render called");
		
		const containerStyle = {
			...styles.container,
			width: this.state.collapsed ? '0' : '100%',
			minWidth: this.state.collapsed ? '0' : '320px',
			maxWidth: this.state.collapsed ? '0' : '905px',
			transition: 'all 0.3s ease-in-out',
			overflow: 'hidden',
			display: 'flex',
			flex: '1',
			flexDirection: 'column',
			height: '100%'
		};
		
		return (
			<div 
				ref={this.containerRef}
				style={containerStyle}
				id="zotero-deep-tutor-pane"
				collapsed={this.state.collapsed.toString()}
			>
				<DeepTutorTopSection
					currentPane={this.state.currentPane}
					onSwitchPane={this.switchPane}
					onToggleModelSelectionPopup={this.toggleModelSelectionPopup}
					logoPath={logoPath}
					HistoryIconPath={HistoryIconPath}
					PlusIconPath={PlusIconPath}
					MicroscopeIconPath={MicroscopeIconPath}
				/>

				{/* Middle Section */}
				<div style={styles.middle}>
					<div style={styles.paneList}>
						{this.state.currentPane === 'main' && <DeepTutorChatBox 
							ref={ref => this._tutorBox = ref}
							currentSession={this.state.currentSession}
						/>}
						{this.state.currentPane === 'sessionHistory' && 
							<SessionHistory 
								sessions={this.state.sessions} 
								onSessionSelect={this.handleSessionSelect}
								isLoading={this.state.isLoading}
								error={this.state.error}
							/>
						}
						{this.state.currentPane === 'modelSelection' && 
							<ModelSelection 
								onSubmit={async (sessionId) => {
									try {
										const sessionData = await getSessionById(sessionId);
										const session = new DeepTutorSession(sessionData);
										const newSesNamToObj = new Map(this.state.sesNamToObj);
										newSesNamToObj.set(session.sessionName, session);
										
										await this.setState({
											currentSession: session,
											messages: [],
											documentIds: session.documentIds || [],
											sesNamToObj: newSesNamToObj,
											sessions: [...this.state.sessions, session]
										});

										await this.handleSessionSelect(session.sessionName);
										this.switchPane('main');
										this.toggleModelSelectionPopup();
									} catch (error) {
										Zotero.debug(`DeepTutor: Error handling new session: ${error.message}`);
									}
								}}
							/>
						}
						{this.state.currentPane === 'welcome' && <DeepTutorWelcomePane onWelcomeSignIn={() => this.toggleSignInPopup()} />}
						{this.state.currentPane === 'signIn' && <DeepTutorSignIn 
							onSignInSignUp={() => this.toggleSignUpPopup()} 
							onSignInSuccess={() => {
								this.loadSession();
								this.switchPane('sessionHistory');
								this.toggleSignInPopup();
							}}
						/>}
						{this.state.currentPane === 'signUp' && <DeepTutorSignUp onSignUpSignIn={() => {
							this.toggleSignUpPopup();
							this.toggleSignInPopup();
						}} />}
					</div>
				</div>

				{/* Upgrade Premium Popup */}
				{this.state.showUpgradePopup && (
					<div style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}>
						<div style={{
							position: 'relative',
							width: '430px',
							background: '#FFFFFF',
							borderRadius: '10px',
							padding: '20px',
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'flex-end',
								alignItems: 'center',
								padding: '20px 20px 0 0',
							}}>
								<button
									onClick={this.toggleUpgradePopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										padding: '4px',
										fontSize: '24px',
										color: '#666',
										width: '32px',
										height: '32px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
									}}
								>
									✕
								</button>
							</div>
							<DeepTutorUpgradePremium />
						</div>
					</div>
				)}

				{/* Sign In Popup */}
				{this.state.showSignInPopup && (
					<div style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
						overflow: 'hidden',
					}}>
						<div style={{
							position: 'relative',
							width: '430px',
							background: '#FFFFFF',
							borderRadius: '10px',
							padding: '20px',
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'flex-end',
								alignItems: 'center',
								marginBottom: '20px',
							}}>
								<button
									onClick={this.toggleSignInPopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										padding: '4px',
										fontSize: '24px',
										color: '#666',
										width: '32px',
										height: '32px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
									}}
								>
									✕
								</button>
							</div>
							<DeepTutorSignIn 
								onSignInSignUp={() => this.toggleSignUpPopup()} 
								onSignInSuccess={() => {
									this.loadSession();
									this.switchPane('main');
									this.toggleSignInPopup();
								}}
							/>
						</div>
					</div>
				)}

				{/* Sign Up Popup */}
				{this.state.showSignUpPopup && (
					<div style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
						overflow: 'hidden',
					}}>
						<div style={{
							position: 'relative',
							width: '430px',
							background: '#FFFFFF',
							borderRadius: '10px',
							padding: '20px',
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'flex-end',
								alignItems: 'center',
								marginBottom: '20px',
							}}>
								<button
									onClick={this.toggleSignUpPopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										padding: '4px',
										fontSize: '24px',
										color: '#666',
										width: '32px',
										height: '32px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
									}}
								>
									✕
								</button>
							</div>
							<DeepTutorSignUp onSignUpSignIn={() => {
								this.toggleSignUpPopup();
								this.toggleSignInPopup();
							}} />
						</div>
					</div>
				)}

				{/* Model Selection Popup */}
				{this.state.showModelSelectionPopup && (
					<div style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
						overflow: 'hidden',
					}}>
						<div style={{
							position: 'relative',
							width: '430px',
							background: '#FFFFFF',
							borderRadius: '10px',
							padding: '20px',
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'flex-end',
								alignItems: 'center',
								marginBottom: '20px',
							}}>
								<button
									onClick={this.toggleModelSelectionPopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										padding: '4px',
										fontSize: '24px',
										color: '#666',
										width: '32px',
										height: '32px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
									}}
								>
									✕
								</button>
							</div>
							<ModelSelection 
								onSubmit={async (sessionId) => {
									try {
										const sessionData = await getSessionById(sessionId);
										const session = new DeepTutorSession(sessionData);
										const newSesNamToObj = new Map(this.state.sesNamToObj);
										newSesNamToObj.set(session.sessionName, session);
										
										await this.setState({
											currentSession: session,
											messages: [],
											documentIds: session.documentIds || [],
											sesNamToObj: newSesNamToObj,
											sessions: [...this.state.sessions, session]
										});

										await this.handleSessionSelect(session.sessionName);
										this.switchPane('main');
										this.toggleModelSelectionPopup();
									} catch (error) {
										Zotero.debug(`DeepTutor: Error handling new session: ${error.message}`);
									}
								}}
							/>
						</div>
					</div>
				)}

				{/* Bottom Section */}

				<DeepTutorBottomSection
					currentPane={this.state.currentPane}
					onSwitchPane={this.switchPane}
					onToggleProfilePopup={this.toggleProfilePopup}
					onToggleSignInPopup={this.toggleSignInPopup}
					onToggleSignUpPopup={this.toggleSignUpPopup}
					onToggleUpgradePopup={this.toggleUpgradePopup}
					showProfilePopup={this.state.showProfilePopup}
					feedIconPath={FeedIconPath}
					personIconPath={PersonIconPath}
				/>
			</div>
		);
	}
}

// Add event dispatcher functionality
Zotero.Utilities.Internal.makeClassEventDispatcher(DeepTutor);

// Export the component
module.exports = DeepTutor;
