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
import DeepTutorSubscriptionConfirm from './DeepTutorSubscriptionConfirm.js';
import DeepTutorManageSubscription from './DeepTutorManageSubscription.js';
import {
	getMessagesBySessionId,
	getSessionById,
	getSessionsByUserId,
	getUserByProviderUserId
} from './api/libs/api.js';
import {
	useAuthState,
	getCurrentUser,
	refreshSession,
	signOut
} from './auth/cognitoAuth.js';

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
const MicroscopeIconPath = 'chrome://zotero/content/DeepTutorMaterials/History/Search.png';

const LitePath = 'chrome://zotero/content/DeepTutorMaterials/Chat/LITE.png';
const BasicPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/BASIC.png';
const AdvancedPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/ADVANCED.png';
const RegisDragPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/DRAG.png';
const SubscriptionConfirmBookPath = 'chrome://zotero/content/DeepTutorMaterials/Subscription/SubscriptionConfirmBook.png';
const SubscriptionManageMarkPath = 'chrome://zotero/content/DeepTutorMaterials/Subscription/SubscriptionManageMark.png';

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
		padding: '0.375rem 0.5rem 0.1875rem 0.5rem',
		minHeight: '4rem',
		background: '#fff',
		borderBottom: '0.0625rem solid #e9ecef',
	},
	logo: {
		height: '2rem',
		width: 'auto',
		display: 'block',
	},
	topRight: {
		display: 'flex',
		flexDirection: 'row',
		gap: '0.75rem',
	},
	iconButton: {
		width: '2.5rem',
		height: '2.5rem',
		background: '#F8F6F7',
		border: 'none',
		borderRadius: '0.375rem',
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: 'background-color 0.2s ease',
		padding: '0.5rem',
	},
	iconButtonActive: {
		background: '#D9D9D9',
	},
	iconImage: {
		width: '1.5rem',
		height: '1.5rem',
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
		padding: '1.125rem 2rem 1.5rem 2rem',
		background: '#fff',
		borderTop: '0.0625rem solid #e9ecef',
	},
	bottomLeft: {
		display: 'flex',
		flexDirection: 'column',
		gap: '0.5rem',
	},
	textButton: {
		background: '#F8F6F7',
		border: 'none',
		color: '#0687E5',
		fontWeight: 500,
		fontSize: '1em',
		fontFamily: 'Roboto, sans-serif',
		cursor: 'pointer',
		padding: '0.25rem 0.5rem',
		margin: 0,
		borderRadius: '0.25rem',
		width: 'fit-content',
		textAlign: 'left',
		display: 'flex',
		alignItems: 'center',
		gap: '0.5rem',
		transition: 'background-color 0.2s ease',
		':hover': {
			background: '#D9D9D9'
		}
	},
	buttonIcon: {
		width: '1rem',
		height: '1rem',
		objectFit: 'contain',
	},
	upgradeButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: '2.0625rem',
		minWidth: '2.0625rem',
		padding: '0 1.125rem',
		background: '#0687E5',
		border: 'none',
		borderRadius: '0.5rem',
		fontWeight: 600,
		fontSize: '1em',
		color: '#ffffff',
		cursor: 'pointer',
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.03)',
		transition: 'background 0.2s',
		fontFamily: 'Roboto, sans-serif',
	},
	profilePopup: {
		position: 'absolute',
		bottom: '100%',
		left: 0,
		background: '#fff',
		borderRadius: '0.5rem',
		boxShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.15)',
		padding: '0.75rem',
		marginBottom: '0.5rem',
		zIndex: 1000,
		minWidth: '12.5rem',
	},
	profileButtonContainer: {
		position: 'relative',
	},
	componentButton: {
		padding: '0.375rem 1.125rem',
		borderRadius: '0.375rem',
		border: '0.0625rem solid #0687E5',
		background: '#fff',
		color: '#0687E5',
		fontWeight: 600,
		cursor: 'pointer',
		fontFamily: 'Roboto, Inter, Arial, sans-serif',
		width: '100%',
		textAlign: 'left',
		marginBottom: '0.25rem',
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
			collapsed: false,
			showSearch: true,
			showSubscriptionConfirmPopup: false,
			showManageSubscriptionPopup: false,
			// Auth state
			isAuthenticated: false,
			currentUser: null,
			authError: null,
			// Prevent infinite loops
			isLoadingSessions: false
		};
		this._initialized = false;
		this._selection = null;
		this._messages = [];
		this._currentSession = null;
		this._loadingPromise = new Promise(resolve => {
			this._loadingPromiseResolve = resolve;
		});
		this.containerRef = React.createRef();

		// Bind auth state change handler
		this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
	}

	async componentDidMount() {
		this._initialized = true;
		this._loadingPromiseResolve();
		Zotero.debug("DeepTutor: Component mounted");

		// Initialize auth state
		await this.initializeAuthState();

		// Add auth state listener
		const authState = useAuthState();
		authState.addListener(this.handleAuthStateChange);
	}

	componentWillUnmount() {
		// Remove auth state listener
		const authState = useAuthState();
		authState.removeListener(this.handleAuthStateChange);
	}

	async initializeAuthState() {
		try {
			Zotero.debug("DeepTutor: Initializing auth state");

			// Try to get current user from stored session
			const currentUserData = await getCurrentUser();

			if (currentUserData) {
				Zotero.debug("DeepTutor: User is authenticated");
				Zotero.debug("DeepTutor: Current user data:", currentUserData);
				this.setState({
					isAuthenticated: true,
					currentUser: currentUserData.user,
					currentPane: 'sessionHistory'
				});

				// Load sessions for authenticated user (only once during initialization)
				if (!this.state.isLoadingSessions) {
					await this.loadSession();
				}
			} else {
				Zotero.debug("DeepTutor: User is not authenticated");
				this.setState({
					isAuthenticated: false,
					currentUser: null,
					currentPane: 'welcome'
				});
			}
		} catch (error) {
			Zotero.debug(`DeepTutor: Auth initialization error: ${error.message}`);

			// Don't attempt refresh for rate limiting errors
			if (error.message && error.message.includes('Rate')) {
				this.setState({
					isAuthenticated: false,
					currentUser: null,
					currentPane: 'welcome',
					authError: 'Rate limit exceeded - please wait a moment'
				});
				return;
			}

			// Try to refresh session for other errors
			try {
				const refreshedData = await refreshSession();
				Zotero.debug("DeepTutor: Session refreshed successfully");
				this.setState({
					isAuthenticated: true,
					currentUser: refreshedData.user,
					currentPane: 'sessionHistory'
				}, async () => {
					if (!this.state.isLoadingSessions) {
						await this.loadSession();
					}
				});
			} catch (refreshError) {
				Zotero.debug(`DeepTutor: Session refresh failed: ${refreshError.message}`);
				this.setState({
					isAuthenticated: false,
					currentUser: null,
					currentPane: 'welcome',
					authError: 'Session expired, please sign in again'
				});
			}
		}
	}

	handleAuthStateChange(isAuthenticated, user) {
		Zotero.debug(`DeepTutor: Auth state changed - authenticated: ${isAuthenticated}`);

		// Prevent infinite loops by checking if we're already loading sessions
		if (this.state.isLoadingSessions) {
			Zotero.debug("DeepTutor: Session loading already in progress, skipping auth state change");
			return;
		}

		this.setState({
			isAuthenticated,
			currentUser: user,
			authError: null
		}, async () => {
			if (isAuthenticated) {
				// User signed in, load sessions (only if not already loading)
				if (!this.state.isLoadingSessions) {
					await this.loadSession();
				}
				this.switchPane('sessionHistory');
			} else {
				// User signed out, clear data and show welcome
				this.setState({
					sessions: [],
					sesNamToObj: new Map(),
					currentSession: null,
					messages: [],
					isLoadingSessions: false
				});
				this.switchPane('welcome');
			}
		});
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

	toggleSubscriptionConfirmPopup = () => {
		this.setState(prevState => ({
			showSubscriptionConfirmPopup: !prevState.showSubscriptionConfirmPopup
		}));
	};

	toggleManageSubscriptionPopup = () => {
		this.setState(prevState => ({
			showManageSubscriptionPopup: !prevState.showManageSubscriptionPopup
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

	toggleSearch = () => {
		this.setState(prevState => ({
			showSearch: !prevState.showSearch
		}));
	}

	handleSignOut = async () => {
		try {
			Zotero.debug("DeepTutor: Signing out user");
			await signOut();

			// Close profile popup
			this.setState({ showProfilePopup: false });

			Zotero.debug("DeepTutor: Sign out successful");
		} catch (error) {
			Zotero.debug(`DeepTutor: Sign out error: ${error.message}`);
		}
	};

	async loadSession() {
		// Only load sessions if user is authenticated
		if (!this.state.isAuthenticated) {
			Zotero.debug("DeepTutor: Cannot load sessions - user not authenticated");
			return;
		}

		// Prevent multiple simultaneous calls
		if (this.state.isLoadingSessions) {
			Zotero.debug("DeepTutor: Session loading already in progress");
			return;
		}

		try {
			this.setState({ isLoading: true, error: null, isLoadingSessions: true });
			Zotero.debug("DeepTutor: Loading sessions...");

			// Get user ID from Cognito user attributes.sub as providerUserId and call getUserByProviderUserId
			const currentUserData = await getCurrentUser();
			if (!currentUserData || !currentUserData.user) {
				throw new Error('No current user found');
			}

			// Get user attributes to retrieve the 'sub' field (Cognito User ID)
			const userData = await new Promise((resolve, reject) => {
				currentUserData.user.getUserAttributes((err, attributes) => {
					if (err) {
						Zotero.debug(`DeepTutor: Error getting user attributes: ${err.message}`);
						
						// Handle rate limiting specifically
						if (err.message && err.message.includes('Rate exceeded')) {
							Zotero.debug("DeepTutor: Rate limit exceeded, will retry later");
							reject(new Error('Rate limit exceeded - please wait a moment'));
							return;
						}
						
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
					Zotero.debug(`DeepTutor: Using provider user ID: ${providerUserId}`);

					// Get user data using the provider user ID (sub)
					getUserByProviderUserId(providerUserId)
						.then(userData => {
							resolve(userData);
						})
						.catch(error => {
							Zotero.debug(`DeepTutor: Error getting user by provider ID: ${error.message}`);
							reject(error);
						});
				});
			});

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
				isLoading: false,
				isLoadingSessions: false
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

			// Handle rate limiting errors specifically - don't trigger auth state changes
			if (error.message && error.message.includes('Rate')) {
				this.setState({
					error: 'Rate limit exceeded - please wait a moment',
					isLoading: false,
					isLoadingSessions: false
				});
				
				// Don't trigger auth state changes for rate limiting
				return;
			}

			// Check if it's an authentication error
			if (error.message === 'Authentication required') {
				this.setState({
					isAuthenticated: false,
					currentUser: null,
					currentPane: 'welcome',
					authError: 'Please sign in to continue',
					isLoadingSessions: false
				});
			} else {
				this.setState({
					error: error.message,
					isLoading: false,
					isLoadingSessions: false
				});
			}
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
				await this.setState({
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
			minWidth: this.state.collapsed ? '0' : '20rem',
			maxWidth: this.state.collapsed ? '0' : '56.5625rem',
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
					onToggleSearch={this.toggleSearch}
					logoPath={logoPath}
					HistoryIconPath={HistoryIconPath}
					PlusIconPath={PlusIconPath}
					MicroscopeIconPath={MicroscopeIconPath}
				/>

				{/* Middle Section */}
				<div style={styles.middle}>
					<div style={styles.paneList}>
						{this.state.currentPane === 'main' && (
							<DeepTutorChatBox
								ref={ref => this._tutorBox = ref}
								currentSession={this.state.currentSession}
								key={this.state.currentSession?.id}
								onSessionSelect={this.handleSessionSelect}
							/>
						)}
						{this.state.currentPane === 'sessionHistory' &&
							<SessionHistory
								sessions={this.state.sessions}
								onSessionSelect={this.handleSessionSelect}
								isLoading={this.state.isLoading}
								error={this.state.error}
								showSearch={this.state.showSearch}
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
							width: '80%',
							maxWidth: '26.875rem',
							maxHeight: '80%',
							background: '#FFFFFF',
							borderRadius: '0.625rem',
							padding: '1.25rem',
							overflow: 'auto'
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginBottom: '2rem',
								minHeight: '4rem',
							}}>
								<div style={{
									position: 'absolute',
									left: '50%',
									transform: 'translateX(-50%)',
									background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									backgroundClip: 'text',
									color: '#0687E5',
									fontWeight: 700,
									fontSize: '1rem',
									lineHeight: '1.2',
									letterSpacing: '0%',
								}}>
									Upgrade Your Plan
								</div>
								<button
									onClick={this.toggleUpgradePopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										fontSize: '1.5rem',
										color: '#666',
										width: '2rem',
										height: '2rem',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
										marginLeft: 'auto',
									}}
								>
									✕
								</button>
							</div>
							<DeepTutorUpgradePremium onUpgradeSuccess={() => {
								this.setState({ showUpgradePopup: false, showSubscriptionConfirmPopup: true });
							}} />
						</div>
					</div>
				)}

				{/* Subscription Confirm Popup */}
				{this.state.showSubscriptionConfirmPopup && (
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
							width: '80%',
							maxWidth: '26.875rem',
							maxHeight: '80%',
							background: '#FFFFFF',
							borderRadius: '0.625rem',
							padding: '1.25rem',
							overflow: 'auto'
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginBottom: '1.25rem',
								minHeight: '4rem',
							}}>
								<div style={{
									position: 'absolute',
									left: '50%',
									transform: 'translateX(-50%)',
									background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									backgroundClip: 'text',
									color: '#0687E5',
									fontWeight: 700,
									fontSize: '1rem',
									lineHeight: '100%',
									letterSpacing: '0%',
								}}>
									Upgrade Your Plan
								</div>
								<button
									onClick={this.toggleUpgradePopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										fontSize: '1.5rem',
										color: '#666',
										width: '2rem',
										height: '2rem',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
										marginLeft: 'auto',
									}}
								>
									✕
								</button>
							</div>
							<DeepTutorSubscriptionConfirm
								imagePath={SubscriptionConfirmBookPath}
								onClose={() => this.setState({ showSubscriptionConfirmPopup: false, showManageSubscriptionPopup: true })}
							/>
						</div>
					</div>
				)}

				{/* Manage Subscription Popup */}
				{this.state.showManageSubscriptionPopup && (
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
							width: '80%',
							maxWidth: '26.875rem',
							maxHeight: '80%',
							background: '#FFFFFF',
							borderRadius: '0.625rem',
							padding: '1.25rem',
							overflow: 'auto'
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginBottom: '1.25rem',
								minHeight: '4rem',
							}}>
								<div style={{
									position: 'absolute',
									left: '50%',
									transform: 'translateX(-50%)',
									background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									backgroundClip: 'text',
									color: '#0687E5',
									fontWeight: 700,
									fontSize: '1rem',
									lineHeight: '100%',
									letterSpacing: '0%',
								}}>
									Upgrade Your Plan
								</div>
								<button
									onClick={this.toggleUpgradePopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										fontSize: '1.5rem',
										color: '#666',
										width: '2rem',
										height: '2rem',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
										marginLeft: 'auto',
									}}
								>
									✕
								</button>
							</div>
							<DeepTutorManageSubscription
								imagePath={SubscriptionManageMarkPath}
								onManage={() => this.setState({ showManageSubscriptionPopup: false })}
								onCancel={() => this.setState({ showManageSubscriptionPopup: false })}
							/>
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
							width: '80%',
							maxWidth: '28rem',
							maxHeight: '80%',
							background: '#FFFFFF',
							borderRadius: '0.625rem',
							padding: '1.25rem',
							overflow: 'auto'
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginBottom: '1.5rem',
								minHeight: '4rem',
							}}>
								<div style={{
									position: 'absolute',
									left: '50%',
									transform: 'translateX(-50%)',
									background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									backgroundClip: 'text',
									color: '#0687E5',
									fontWeight: 700,
									fontSize: '1.5rem',
									lineHeight: '1.2',
									letterSpacing: '0%',
								}}>
									Sign in
								</div>
								<button
									onClick={this.toggleSignInPopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										fontSize: '1.5rem',
										color: '#666',
										width: '2rem',
										height: '2rem',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
										marginLeft: 'auto',
									}}
								>
									✕
								</button>
							</div>
							<DeepTutorSignIn
								onSignInSignUp={() => {
									this.toggleSignInPopup();
									this.toggleSignUpPopup();
								}}
								onSignInSuccess={() => {
									this.toggleSignInPopup();
									// Auth state change will be handled by the listener
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
							width: '80%',
							maxWidth: '26.875rem',
							maxHeight: '80%',
							background: '#FFFFFF',
							borderRadius: '0.625rem',
							padding: '1.25rem',
							overflow: 'auto'
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginBottom: '2rem',
								minHeight: '4rem',
								padding: '0 1rem',
							}}>
								<div style={{
									position: 'absolute',
									left: '50%',
									transform: 'translateX(-50%)',
									background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									backgroundClip: 'text',
									color: '#0687E5',
									fontWeight: 700,
									fontSize: '1.5rem',
									lineHeight: '1.2',
									letterSpacing: '0%',
								}}>
									Sign up
								</div>
								<button
									onClick={this.toggleSignUpPopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										padding: '0.25rem',
										fontSize: '1.5rem',
										color: '#666',
										width: '2rem',
										height: '2rem',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
										marginLeft: 'auto',
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
							width: '80%',
							maxWidth: '26.875rem',
							maxHeight: '80%',
							background: '#FFFFFF',
							borderRadius: '0.625rem',
							padding: '1.25rem',
							overflow: 'auto'
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginBottom: '2rem',
								minHeight: '4rem',
								position: 'relative',
							}}>
								<div style={{
									position: 'absolute',
									left: '50%',
									transform: 'translateX(-50%)',
									background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									backgroundClip: 'text',
									color: '#0687E5',
									fontWeight: 700,
									fontSize: '1.5rem',
									lineHeight: '1.2',
									letterSpacing: '0%',
									textAlign: 'center',
								}}>
									Create a new session
								</div>
								<button
									onClick={this.toggleModelSelectionPopup}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										fontSize: '1.5rem',
										color: '#666',
										width: '2rem',
										height: '2rem',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
										marginLeft: 'auto',
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
					isAuthenticated={this.state.isAuthenticated}
					currentUser={this.state.currentUser}
					onSignOut={this.handleSignOut}
				/>
			</div>
		);
	}
}

// Add event dispatcher functionality
Zotero.Utilities.Internal.makeClassEventDispatcher(DeepTutor);

// Export the component
module.exports = DeepTutor;
