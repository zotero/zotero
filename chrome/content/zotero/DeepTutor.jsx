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
import DeepTutorMain from './DeepTutorMain.js';
import DeepTutorLocalhostServer from './localhostServer.js';
import {
	getMessagesBySessionId,
	getSessionById,
	getSessionsByUserId,
	getUserByProviderUserId,
	registerUser,
	createBackendUser,
	deleteSessionById,
	getActiveUserSubscriptionByUserId,
	getLatestUserSubscriptionByUserId,
	DT_SIGN_UP_URL
} from './api/libs/api.js';
import {
	useAuthState,
	getCurrentUser,
	refreshSession,
	signOut,
	initializeAuthState,
	forceSignOut
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

var DeepTutor = class DeepTutor extends React.Component {
	/**
	 * Initialize the DeepTutor React component in the given DOM element.
	 * @param {Element} domEl - The DOM element to render into
	 * @param {Object} opts - Options to pass as props
	 * @returns {Promise<DeepTutor>}
	 */
	static async init(domEl, opts = {}) {
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
		onSwitchComponent: () => {},
		onSessionIdUpdate: () => {},
		onUserIdUpdate: () => {}
	};

	static propTypes = {
		onSelectionChange: PropTypes.func,
		onContextMenu: PropTypes.func,
		onActivate: PropTypes.func,
		emptyMessage: PropTypes.string,
		onNewSession: PropTypes.func,
		onSendMessage: PropTypes.func,
		onSwitchComponent: PropTypes.func,
		onSessionIdUpdate: PropTypes.func,
		onUserIdUpdate: PropTypes.func
	};

	constructor(props) {
		super(props);
		this.state = {
			currentPane: 'welcome',
			sessions: [],
			sesIdToObj: new Map(),
			isLoading: false,
			error: null,
			showProfilePopup: false,
			showSignInPopup: false,

			showModelSelectionPopup: false,
			showDeletePopup: false,
			showRenamePopup: false,
			showNoPDFWarningPopup: false,
			showFileSizeWarningPopup: false,
			sessionToDelete: null,
			sessionNameToDelete: '',
			sessionToRename: null,
			sessionNameToRename: '',
			collapsed: false,
			showSubscriptionConfirmPopup: false,
			showManageSubscriptionPopup: false,
			showSearch: false,
			showSubscriptionPopup: false,
			showUsagePopup: false,
			// Auth state
			isAuthenticated: false,
			currentUser: null,
			authError: null,
			// Prevent infinite loops
			isLoadingSessions: false,
			// Store backend user data
			userData: null,
			userSubscribed: false,
			isFreeTrial: true,
			activeSubscription: null,
			// Model selection freezing state
			modelSelectionFrozen: false,
			// Window dimensions for responsive layout
			windowWidth: window.innerWidth,
			windowHeight: window.innerHeight
		};
		this._initialized = false;
		this._selection = null;
		this._messages = [];
		this._currentSession = null;
		this._loadingPromise = new Promise((resolve) => {
			this._loadingPromiseResolve = resolve;
		});
		this.containerRef = React.createRef();

		// Bind auth state change handler
		this.handleAuthStateChange = this.handleAuthStateChange.bind(this);

		// Multi-layer protection flags to prevent infinite loops and blinking
		// Flag 1: Prevents auth state changes during initial component setup
		this._isInitializingData = false;
		// Flag 2: Temporarily blocks auth state changes during data fetch operations
		this._blockingAuthStateChanges = false;

		// Timer reference for model selection freeze
		this._modelSelectionFreezeTimer = null;

		// Debounced resize handler to prevent excessive re-renders
		this._resizeDebounceTimer = null;
		this.handleWindowResize = this.handleWindowResize.bind(this);

		// Initialize localhost server
		console.log("🔧 DeepTutor: Initializing localhost server...");
		this.localhostServer = new DeepTutorLocalhostServer();
		console.log("📋 DeepTutor: Localhost server instance created");

		// Bind Google OAuth methods
		this.handleGoogleSignInClose = this.handleGoogleSignInClose.bind(this);
		this.toggleUsagePopup = this.toggleUsagePopup.bind(this);
	}

	async componentDidMount() {
		this._initialized = true;
		this._loadingPromiseResolve();
		Zotero.debug("DeepTutor: Component mounted");

		// Make instance available globally for testing
		if (typeof window !== "undefined") {
			window.deepTutorInstance = this;
			console.log("🌐 DeepTutor: Instance made available globally as window.deepTutorInstance");
		}

		// Add window resize listener for responsive layout
		window.addEventListener('resize', this.handleWindowResize);

		// Start the localhost server
		try {
			console.log("🚀 DeepTutor: Attempting to start localhost server...");
			const serverStarted = await this.localhostServer.start();
			if (serverStarted) {
				console.log("✅ DeepTutor: Localhost server started successfully!");
				console.log("🌐 Server URL:", this.localhostServer.getServerUrl());
				Zotero.debug(`DeepTutor: Localhost server started at ${this.localhostServer.getServerUrl()}`);

				// Auth functions are no longer needed since we use the existing completeAuth function
				console.log("🔧 DeepTutor: Using existing completeAuth function for authentication");
			}
			else {
				console.log("❌ DeepTutor: Failed to start localhost server");
				Zotero.debug("DeepTutor: Failed to start localhost server");
			}
		}
		catch (error) {
			console.error("❌ DeepTutor: Error starting localhost server:", error.message);
			Zotero.debug(`DeepTutor: Error starting localhost server: ${error.message}`);
		}

		// First, initialize the auth state from storage
		await initializeAuthState();

		// Then initialize the component's auth state
		await this.initializeAuthState();

		// Add auth state listener
		const authState = useAuthState();
		authState.addListener(this.handleAuthStateChange);
	}

	componentWillUnmount() {
		// Remove auth state listener
		const authState = useAuthState();
		authState.removeListener(this.handleAuthStateChange);

		// Remove window resize listener
		window.removeEventListener('resize', this.handleWindowResize);

		// Clear resize debounce timer
		if (this._resizeDebounceTimer) {
			clearTimeout(this._resizeDebounceTimer);
		}

		// Clear any pending timer
		if (this._modelSelectionFreezeTimer) {
			clearTimeout(this._modelSelectionFreezeTimer);
		}

		// Disable Google OAuth endpoint
		if (this.localhostServer) {
			this.localhostServer.disableGoogleOAuth();
		}

		// Stop localhost server
		if (this.localhostServer) {
			this.localhostServer.stop().then((stopped) => {
				if (stopped) {
					Zotero.debug("DeepTutor: Localhost server stopped successfully");
				}
				else {
					Zotero.debug("DeepTutor: Failed to stop localhost server");
				}
			}).catch((error) => {
				Zotero.debug(`DeepTutor: Error stopping localhost server: ${error.message}`);
			});
		}
	}

	async initializeAuthState() {
		try {
			Zotero.debug("DeepTutor: Initializing auth state");

			// Enable protection flags to prevent auth state change interference during initialization
			// This prevents the infinite loop where auth state changes trigger more auth state changes
			this._isInitializingData = true;
			this._blockingAuthStateChanges = true;

			// First, check if auth state has already been restored from storage
			const authStateInstance = useAuthState();
			if (authStateInstance.isAuthenticated && authStateInstance.user) {
				Zotero.debug("DeepTutor: User already authenticated from restored state");
				this.setState({
					isAuthenticated: true,
					currentUser: authStateInstance.user
				}, async () => {
					// Fetch backend user data
					await this.fetchUserData(authStateInstance.user);
					// Load sessions once userData is available
					if (!this.state.isLoadingSessions) {
						await this.loadSession();
				    }
				    // All data loading operations complete - safe to clear protection flags and switch pane
				    // This ensures only one pane switch happens after all async operations finish
				    this._isInitializingData = false;
				    this._blockingAuthStateChanges = false;

				    this.setState({
					    currentPane: this.getSessionHistoryPaneOrNoSession()
				    });
				});
				return;
			}

			// Try to get current user from stored session
			const currentUserData = await getCurrentUser();

			if (currentUserData) {
				Zotero.debug("DeepTutor: User is authenticated");
				Zotero.debug("DeepTutor: Current user data:", currentUserData);
				this.setState({
					isAuthenticated: true,
					currentUser: currentUserData.user
				}, async () => {
					// Fetch backend user data
					await this.fetchUserData(currentUserData.user);
					// Load sessions once userData is available
					if (!this.state.isLoadingSessions) {
						await this.loadSession();
					}
					// All data loading operations complete - safe to clear protection flags and switch pane
					// This ensures only one pane switch happens after all async operations finish
					this._isInitializingData = false;
					this._blockingAuthStateChanges = false;
					this.setState({
						currentPane: this.getSessionHistoryPaneOrNoSession()
					});
				});
			}
			else {
				Zotero.debug("DeepTutor: User is not authenticated");
				// Clear protection flags since initialization is complete (no auth needed)
				this._isInitializingData = false;
				this._blockingAuthStateChanges = false;
				this.setState({
					isAuthenticated: false,
					currentUser: null,
					currentPane: 'welcome'
				});
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutor: Auth initialization error: ${error.message}`);

			// Don't attempt refresh for rate limiting errors
			if (error.message && error.message.includes('Rate')) {
				// Clear protection flags on rate limit error (initialization failed)
				this._isInitializingData = false;
				this._blockingAuthStateChanges = false;
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
					currentUser: refreshedData.user
				}, async () => {
					await this.fetchUserData(refreshedData.user);
					if (!this.state.isLoadingSessions) {
						await this.loadSession();
					}
					// All data loading operations complete - safe to clear protection flags and switch pane
					// This ensures only one pane switch happens after all async operations finish
					this._isInitializingData = false;
					this._blockingAuthStateChanges = false;
					this.setState({
						currentPane: this.getSessionHistoryPaneOrNoSession()
					});
				});
			}
			catch (refreshError) {
				Zotero.debug(`DeepTutor: Session refresh failed: ${refreshError.message}`);
				// Clear protection flags on refresh failure (initialization failed)
				this._isInitializingData = false;
				this._blockingAuthStateChanges = false;
				this.setState({
					isAuthenticated: false,
					currentUser: null,
					currentPane: 'welcome',
					authError: 'Session expired, please sign in again'
				});
			}
		}
	}

	/**
	 * Handles authentication state changes with multi-layer protection against infinite loops
	 * This method is called whenever the auth state changes (sign in, sign out, token refresh, etc.)
	 * Multiple protection layers prevent the blinking issue caused by recursive auth state changes
	 */
	handleAuthStateChange(isAuthenticated, user) {
		Zotero.debug(`DeepTutor: Auth state changed - authenticated: ${isAuthenticated}, _isInitializingData: ${this._isInitializingData}, _blockingAuthStateChanges: ${this._blockingAuthStateChanges}`);

		// Layer 1: Skip if currently initializing component
		// Prevents interference during the initial authentication setup process
		if (this._isInitializingData) {
			Zotero.debug("DeepTutor: Skipping auth state change during initialization");
			return;
		}

		// Layer 2: Skip if temporarily blocking auth state changes during data operations
		// Prevents feedback loops where data fetching triggers more auth state changes
		if (this._blockingAuthStateChanges) {
			Zotero.debug("DeepTutor: Skipping auth state change - blocked during data operations");
			return;
		}

		// Layer 3: Skip if same user already authenticated (prevents redundant processing)
		// Avoids unnecessary re-processing when the same user triggers multiple auth events
		if (isAuthenticated && this.state.isAuthenticated
			&& user && this.state.currentUser
			&& user.username === this.state.currentUser.username) {
			Zotero.debug("DeepTutor: Skipping auth state change - same user already authenticated");
			return;
		}

		// Layer 4: Prevent concurrent session loading operations
		// Ensures only one session loading process runs at a time
		if (this.state.isLoadingSessions) {
			Zotero.debug("DeepTutor: Session loading already in progress, skipping auth state change");
			return;
		}

		Zotero.debug("DeepTutor: Processing auth state change");
		// Enable blocking flag to prevent recursive auth state changes during data operations
		this._blockingAuthStateChanges = true;

		this.setState({
			isAuthenticated,
			currentUser: user,
			authError: null
		}, async () => {
			try {
				if (isAuthenticated) {
					// Fetch backend user data
					await this.fetchUserData(user);

					// User signed in, load sessions (only if not already loading)
					if (!this.state.isLoadingSessions) {
						await this.loadSession();
					}
					// this.switchPane(this.getSessionHistoryPaneOrNoSession());
				}
				else {
					// User signed out, clear data and show welcome
					this.setState({
						sessions: [],
						sesIdToObj: new Map(),
						currentSession: null,
						messages: [],
						isLoadingSessions: false
					});
					this.switchPane('welcome');
				}
			}
			finally {
				// Always clear the blocking flag when operations complete (success or failure)
				this._blockingAuthStateChanges = false;
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
	};

	handleSendMessage = () => {
		this.props.onSendMessage();
	};

	handleSwitchComponent = (componentId) => {
		this.props.onSwitchComponent(componentId);
	};

	// Placeholder for pane switching logic
	switchPane = (pane) => {
		this.setState({ currentPane: pane });
	};

	// Helper method to determine if sessions exist
	getSessionHistoryPaneOrNoSession = () => {
		Zotero.debug(`DeepTutor06130613: getSessionHistoryPaneOrNoSession: ${this.state.sessions.length}`);
		return (this.state.sessions && this.state.sessions.length > 0) ? 'sessionHistory' : 'noSession';
	};

	toggleProfilePopup = () => {
		this.setState(prevState => ({
			showProfilePopup: !prevState.showProfilePopup
		}));
	};

	// Add handler for clicking outside profile popup
	handleContainerClick = (_e) => {
		// Only close profile popup if it's open
		if (this.state.showProfilePopup) {
			this.setState({ showProfilePopup: false });
		}
	};

	toggleSignInPopup = () => {
		this.setState(prevState => ({
			showSignInPopup: !prevState.showSignInPopup
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

	toggleUsagePopup = () => {
		this.setState(prevState => ({
			showUsagePopup: !prevState.showUsagePopup
		}));
	};

	toggleDeletePopup = () => {
		this.setState(prevState => ({
			showDeletePopup: !prevState.showDeletePopup,
			sessionToDelete: prevState.showDeletePopup ? null : prevState.sessionToDelete,
			sessionNameToDelete: prevState.showDeletePopup ? '' : prevState.sessionNameToDelete
		}));
	};

	toggleRenamePopup = () => {
		this.setState(prevState => ({
			showRenamePopup: !prevState.showRenamePopup,
			sessionToRename: prevState.showRenamePopup ? null : prevState.sessionToRename,
			sessionNameToRename: prevState.showRenamePopup ? '' : prevState.sessionNameToRename
		}));
	};

	openNoPDFWarningPopup = () => {
		this.setState({
			showNoPDFWarningPopup: true
		});
	};

	closeNoPDFWarningPopup = () => {
		this.setState({
			showNoPDFWarningPopup: false
		});
	};

	openFileSizeWarningPopup = () => {
		try {
			this.setState({
				showFileSizeWarningPopup: true
			});
		}
		catch (e) {
			Zotero.debug(`DeepTutor: Error opening file size warning popup: ${e.message}`);
		}
	};

	closeFileSizeWarningPopup = () => {
		this.setState({
			showFileSizeWarningPopup: false,
		});
	};

	handleShowDeletePopup = (sessionId) => {
		const session = this.state.sesIdToObj.get(sessionId);
		const sessionName = session ? session.sessionName || 'Unnamed Session' : 'this session';

		this.setState({
			sessionToDelete: sessionId,
			sessionNameToDelete: sessionName,
			showDeletePopup: true
		});
	};

	handleConfirmDelete = (sessionId) => {
		this.handleDeleteSession(sessionId);
		this.setState({
			showDeletePopup: false,
			sessionToDelete: null,
			sessionNameToDelete: ''
		});
	};

	handleCancelDelete = () => {
		this.setState({
			showDeletePopup: false,
			sessionToDelete: null,
			sessionNameToDelete: ''
		});
	};

	handleShowRenamePopup = (sessionId) => {
		const session = this.state.sesIdToObj.get(sessionId);
		const sessionName = session ? session.sessionName || 'Unnamed Session' : 'Unnamed Session';

		this.setState({
			sessionToRename: sessionId,
			sessionNameToRename: sessionName,
			showRenamePopup: true
		});
	};

	handleRenameSuccess = async () => {
		// Reload sessions to get updated session names
		try {
			await this.loadSession();
		}
		catch (error) {
			Zotero.debug(`DeepTutor: Error reloading sessions after rename: ${error.message}`);
		}
	};

	handleCancelRename = () => {
		this.setState({
			showRenamePopup: false,
			sessionToRename: null,
			sessionNameToRename: ''
		});
	};

	toggleCollapse = () => {
		this.setState(prevState => ({
			collapsed: !prevState.collapsed
		}), () => {
			if (window.ZoteroPane && typeof window.ZoteroPane.updateLayoutConstraints === 'function') {
				window.ZoteroPane.updateLayoutConstraints();
			}
		});
	};

	toggleSearch = () => {
		this.setState(prevState => ({
			showSearch: !prevState.showSearch
		}));
	};

	toggleSubscriptionPopup = () => {
		this.setState(prevState => ({
			showSubscriptionPopup: !prevState.showSubscriptionPopup
		}));
	};

	/**
	 * Handles subscription status change from DeepTutorSubscription component
	 * @param {boolean} hasActiveSubscription - Whether user has active subscription
	 */
	handleSubscriptionStatusChange = async (hasActiveSubscription) => {
		try {
			Zotero.debug(`DeepTutor: Subscription status changed to: ${hasActiveSubscription}`);

			// Update the subscription status in state
			this.setState({ userSubscribed: hasActiveSubscription });

			// If user now has subscription, also update isFreeTrial status and fetch active subscription
			if (hasActiveSubscription && this.state.userData?.id) {
				try {
					const activeSubscription = await getActiveUserSubscriptionByUserId(this.state.userData.id);
					this.setState({
						isFreeTrial: false,
						activeSubscription
					});
				}
				catch (error) {
					Zotero.debug(`DeepTutor: Error fetching active subscription: ${error.message}`);
					this.setState({ isFreeTrial: false });
				}
			}
			else if (this.state.userData?.id) {
				try {
					const latestSubscription = await getLatestUserSubscriptionByUserId(this.state.userData.id);
					this.setState({
						isFreeTrial: !latestSubscription,
						activeSubscription: null
					});
				}
				catch (error) {
					Zotero.debug(`DeepTutor: Error checking latest subscription: ${error.message}`);
					this.setState({
						isFreeTrial: true,
						activeSubscription: null
					});
				}
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutor: Error handling subscription status change: ${error.message}`);
		}
	};

	/**
	 * Refreshes subscription data from the server
	 */
	refreshSubscriptionData = async () => {
		try {
			if (!this.state.userData?.id) {
				Zotero.debug("DeepTutor: Cannot refresh subscription data - no user ID");
				return;
			}

			Zotero.debug("DeepTutor: Refreshing subscription data from server");

			// Check active subscription
			let userSubscribed = false;
			let activeSubscription = null;
			try {
				activeSubscription = await getActiveUserSubscriptionByUserId(this.state.userData.id);
				userSubscribed = !!activeSubscription;
				Zotero.debug('DeepTutor: Active subscription status:', userSubscribed);
			}
			catch (error) {
				Zotero.debug('DeepTutor: Error checking active subscription:', error);
			}

			// Check latest subscription
			let isFreeTrial = true;
			try {
				const latestSubscription = await getLatestUserSubscriptionByUserId(this.state.userData.id);
				isFreeTrial = !latestSubscription;
				Zotero.debug('DeepTutor: Latest subscription status:', isFreeTrial);
			}
			catch (error) {
				Zotero.debug('DeepTutor: Error checking latest subscription:', error);
			}

			// Update state with fresh subscription data
			this.setState({
				userSubscribed,
				isFreeTrial,
				activeSubscription
			});

			Zotero.debug("DeepTutor: Subscription data refreshed successfully");
		}
		catch (error) {
			Zotero.debug(`DeepTutor: Error refreshing subscription data: ${error.message}`);
		}
	};

	handleSignOut = async () => {
		try {
			Zotero.debug("DeepTutor: Signing out user");
			await signOut();

			// Close profile popup and clear subscription data
			this.setState({
				showProfilePopup: false,
				activeSubscription: null,
				userSubscribed: false,
				isFreeTrial: true
			});

			Zotero.debug("DeepTutor: Sign out successful");
		}
		catch (error) {
			Zotero.debug(`DeepTutor: Sign out error: ${error.message}`);
		}
	};

	handleSignInSuccess = () => {
		Zotero.debug("DeepTutor: Sign in success handler called");
		
		// Close the sign-in popup
		this.setState({ showSignInPopup: false });
		
		Zotero.debug("DeepTutor: Sign-in popup closed after successful authentication");
	};

	handleOpenSignUpPage = () => {
		// Open sign up page in default browser
		Zotero.debug("DeepTutor: Sign up button clicked");
		const url = DT_SIGN_UP_URL;
		Zotero.debug(`DeepTutor: Attempting to open sign up URL: ${url}`);

		try {
			// Primary: Use Zotero's proper API for opening external URLs
			Zotero.debug("DeepTutor: Trying primary method - Zotero.launchURL");
			Zotero.launchURL(url);
			Zotero.debug("DeepTutor: Successfully called Zotero.launchURL");
		}
		catch (error) {
			Zotero.debug(`DeepTutor: Primary method failed - Zotero.launchURL: ${error.message}`);

			// Fallback 1: Try Zotero.Utilities.Internal.launchURL
			try {
				if (Zotero.Utilities && Zotero.Utilities.Internal && Zotero.Utilities.Internal.launchURL) {
					Zotero.debug("DeepTutor: Trying Fallback 1 - Zotero.Utilities.Internal.launchURL");
					Zotero.Utilities.Internal.launchURL(url);
					Zotero.debug("DeepTutor: Successfully called Zotero.Utilities.Internal.launchURL");
				}
				else {
					throw new Error("Zotero.Utilities.Internal.launchURL not available");
				}
			}
			catch (fallback1Error) {
				Zotero.debug(`DeepTutor: Fallback 1 failed - Zotero.Utilities.Internal.launchURL: ${fallback1Error.message}`);

				// Fallback 2: Try Zotero.HTTP.loadDocuments
				try {
					if (Zotero.HTTP && Zotero.HTTP.loadDocuments) {
						Zotero.debug("DeepTutor: Trying Fallback 2 - Zotero.HTTP.loadDocuments");
						Zotero.HTTP.loadDocuments([url]);
						Zotero.debug("DeepTutor: Successfully called Zotero.HTTP.loadDocuments");
					}
					else {
						throw new Error("Zotero.HTTP.loadDocuments not available");
					}
				}
				catch (fallback2Error) {
					Zotero.debug(`DeepTutor: Fallback 2 failed - Zotero.HTTP.loadDocuments: ${fallback2Error.message}`);

					// Fallback 3: Try XPCOM nsIExternalProtocolService
					try {
						if (typeof Cc !== 'undefined' && typeof Ci !== 'undefined') {
							Zotero.debug("DeepTutor: Trying Fallback 3 - XPCOM nsIExternalProtocolService (using Cc/Ci shortcuts)");
							const extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
								.getService(Ci.nsIExternalProtocolService);
							const uri = Cc["@mozilla.org/network/io-service;1"]
								.getService(Ci.nsIIOService)
								.newURI(url, null, null);
							extps.loadURI(uri);
							Zotero.debug("DeepTutor: Successfully opened URL via XPCOM nsIExternalProtocolService");
						}
						else {
							throw new Error("XPCOM Cc/Ci shortcuts not available");
						}
					}
					catch (fallback3Error) {
						Zotero.debug(`DeepTutor: Fallback 3 failed - XPCOM nsIExternalProtocolService: ${fallback3Error.message}`);

						// Final fallback: Copy URL to clipboard
						if (navigator.clipboard) {
							Zotero.debug("DeepTutor: Trying final fallback - copy URL to clipboard");
							navigator.clipboard.writeText(url)
								.then(() => {
									Zotero.debug("DeepTutor: Successfully copied sign up URL to clipboard");
									Zotero.alert(null, "DeepTutor", 'Sign up URL copied to clipboard!\nPlease paste it in your browser to access the sign up page.');
								})
								.catch((clipboardError) => {
									Zotero.debug(`DeepTutor: Failed to copy to clipboard: ${clipboardError.message}`);
									Zotero.alert(null, "DeepTutor", `Please manually visit this URL:\n${url}`);
								});
						}
						else {
							Zotero.debug("DeepTutor: Clipboard API not available, showing alert with URL");
							Zotero.alert(null, "DeepTutor", `Please manually visit this URL:\n${url}`);
						}
					}
				}
			}
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
			Zotero.debug("DeepTutor: Calling getCurrentUser()...");
			const currentUserData = await getCurrentUser();

			Zotero.debug(`DeepTutor: getCurrentUser() result: ${currentUserData ? 'found' : 'null'}`);
			if (currentUserData && currentUserData.user) {
				Zotero.debug(`DeepTutor: Current user data: ${JSON.stringify(currentUserData.user, null, 2)}`);
			}

			if (!currentUserData || !currentUserData.user) {
				throw new Error('No current user found');
			}

			// Get user attributes to retrieve the 'sub' field (Cognito User ID)
			const userData = await new Promise((resolve, reject) => {
				// Check if this is a Google OAuth user (has attributes directly)
				if (currentUserData.user.attributes && currentUserData.user.attributes.sub) {
					const providerUserId = currentUserData.user.attributes.sub;
					Zotero.debug('DeepTutor: Using provider user ID from Google OAuth attributes');

					// Get user data using the provider user ID (sub)
					Zotero.debug('DeepTutor: Calling getUserByProviderUserId with providerUserId');
					getUserByProviderUserId(providerUserId)
						.then((userData) => {
							Zotero.debug('DeepTutor: getUserByProviderUserId successful');
							resolve(userData);
						})
						.catch(async (error) => {
							Zotero.debug(`DeepTutor: Error getting user by provider ID: ${error.message}`);

							// If user not found, try to register them
							if (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) {
								try {
									Zotero.debug('DeepTutor: User not found, attempting to register new user');

									// Create new user object
									const newUser = createBackendUser({
										name: currentUserData.user.attributes?.name || currentUserData.user.username || 'DeepTutor User',
										email: currentUserData.user.attributes?.email || currentUserData.user.username,
										providerUserId: providerUserId
									});

									// Register the user
									const registeredUser = await registerUser(newUser);
									Zotero.debug('DeepTutor: User registration successful from Google OAuth');
									Zotero.debug(`DeepTutor: Registered user: ${JSON.stringify(registeredUser)}`);

									resolve(registeredUser);
								}
								catch (registerError) {
									Zotero.debug(`DeepTutor: Error registering user: ${registerError.message}`);
									reject(registerError);
								}
							}
							else {
								reject(error);
							}
						});
					return;
				}

				// For regular Cognito users, use getUserAttributes method
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

					// Find the 'email' attribute for the actual email address
					const emailAttribute = attributes.find(attr => attr.getName() === 'email');
					const userEmail = emailAttribute ? emailAttribute.getValue() : currentUserData.user.username;

					// Find the 'name' attribute for the user's name
					const nameAttribute = attributes.find(attr => attr.getName() === 'name');
					const userName = nameAttribute ? nameAttribute.getValue() : currentUserData.user.username;

					const providerUserId = subAttribute.getValue();
					Zotero.debug('DeepTutor: Using provider user ID from getUserAttributes');
					Zotero.debug(`DeepTutor: User email: ${userEmail}, name: ${userName}`);

					// Get user data using the provider user ID (sub)
					Zotero.debug('DeepTutor: Calling getUserByProviderUserId with providerUserId');
					getUserByProviderUserId(providerUserId)
						.then((userData) => {
							Zotero.debug('DeepTutor: getUserByProviderUserId successful');
							resolve(userData);
						})
						.catch(async (error) => {
							Zotero.debug(`DeepTutor: Error getting user by provider ID: ${error.message}`);

							// If user not found, try to register them
							if (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) {
								try {
									Zotero.debug('DeepTutor: User not found, attempting to register new user');

									// Create new user object
									const newUser = createBackendUser({
										name: userName || 'DeepTutor User',
										email: userEmail,
										providerUserId: providerUserId
									});

									// Register the user
									const registeredUser = await registerUser(newUser);
									Zotero.debug('DeepTutor: User registration successful from regular Cognito');
									Zotero.debug(`DeepTutor: Registered user: ${JSON.stringify(registeredUser)}`);

									resolve(registeredUser);
								}
								catch (registerError) {
									Zotero.debug(`DeepTutor: Error registering user: ${registerError.message}`);
									reject(registerError);
								}
							}
							else {
								reject(error);
							}
						});
				});
			});

			// Fetch sessions using centralized API
			const sessionsData = await getSessionsByUserId(userData.id);
			Zotero.debug(`DeepTutor: Fetched ${sessionsData.length} sessions`);

			// Convert API data to DeepTutorSession objects
			const sessions = sessionsData.map(sessionData => new DeepTutorSession(sessionData));

			// Update session name to object mapping
			const sesIdToObj = new Map();
			sessions.forEach((session) => {
				sesIdToObj.set(session.id, session);
			});

			// Update state with new sessions
			this.setState({
				sessions,
				sesIdToObj,
				isLoading: false,
				isLoadingSessions: false
			});

			// Save backend user data if not already set or has changed
			if (!this.state.userData || (userData && userData.id !== this.state.userData.id)) {
				this.setState({ userData });
			}

			// Check active subscription
			let userSubscribed = false;
			let activeSubscription = null;
			try {
				activeSubscription = await getActiveUserSubscriptionByUserId(userData.id);
				userSubscribed = !!activeSubscription;
				Zotero.debug('DeepTutor: Active subscription status:', userSubscribed);
			}
			catch (error) {
				Zotero.debug('DeepTutor: Error checking active subscription:', error);
			}

			// Check latest subscription
			let isFreeTrial = true;
			try {
				const latestSubscription = await getLatestUserSubscriptionByUserId(userData.id);
				isFreeTrial = !latestSubscription;
				Zotero.debug('DeepTutor: Latest subscription status:', isFreeTrial);
			}
			catch (error) {
				Zotero.debug('DeepTutor: Error checking latest subscription:', error);
			}

			// Save to state
			this.setState({
				userData,
				userSubscribed,
				isFreeTrial,
				activeSubscription
			});

			// Wait a moment for all setState operations to complete, then switch panes
			// If no sessions, switch to model selection pane
			Zotero.debug(`DeepTutor061306130613: Switching to model selection pane: ${sessions}`);
			Zotero.debug(`DeepTutor061306130613: Sessions length: ${sessions.length}`);
			if (sessions.length === 0) {
				this.switchPane('noSession');
			}
			else {
				// If sessions exist, switch to main pane
				this.switchPane('sessionHistory');
			}

			Zotero.debug(`DeepTutor: Successfully loaded ${sessions.length} sessions`);
		}
		catch (error) {
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
			}
			else {
				this.setState({
					error: error.message,
					isLoading: false,
					isLoadingSessions: false
				});
			}
		}
	}

	handleSessionSelect = async (sessionId) => {
		try {
			const session = this.state.sesIdToObj.get(sessionId);
			if (!session) {
				Zotero.debug(`DeepTutor: No session object found for: ${sessionId}`);
				return;
			}

			Zotero.debug(`DeepTutor: Fetching messages for session: ${sessionId}`);
			try {
				const messages = await getMessagesBySessionId(session.id);
				Zotero.debug(`DeepTutor: Successfully fetched ${messages.length} messages`);
				// Zotero.debug(`DeepTutor: Messages content: ${JSON.stringify(messages)}`);

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
			}
			catch (error) {
				Zotero.debug(`DeepTutor: Error in fetching messages: ${error.message}`);
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutor: Error in handleSessionSelect: ${error.message}`);
		}
	};

	handleDeleteSession = async (sessionId) => {
		try {
			Zotero.debug(`DeepTutor: Deleting session: ${sessionId}`);

			// Call the API to delete the session
			await deleteSessionById(sessionId);
			Zotero.debug(`DeepTutor: Session ${sessionId} deleted successfully from backend`);

			// Update local state by removing the session
			const updatedSessions = this.state.sessions.filter(session => session.id !== sessionId);
			const updatedSesIdToObj = new Map(this.state.sesIdToObj);
			updatedSesIdToObj.delete(sessionId);

			// Check if the deleted session was the current session
			const wasCurrentSession = this.state.currentSession && this.state.currentSession.id === sessionId;

			// Update state
			const newState = {
				sessions: updatedSessions,
				sesIdToObj: updatedSesIdToObj
			};

			// If we deleted the current session, clear it and switch panes
			if (wasCurrentSession) {
				newState.currentSession = null;
				newState.messages = [];
				newState.documentIds = [];
			}

			this.setState(newState, () => {
				// If we deleted the current session or if no sessions remain, switch to appropriate pane
				if (wasCurrentSession || updatedSessions.length === 0) {
					if (updatedSessions.length === 0) {
						this.switchPane('noSession');
					}
					else {
						this.switchPane('sessionHistory');
					}
				}
			});

			Zotero.debug(`DeepTutor: Session ${sessionId} removed from local state`);
		}
		catch (error) {
			Zotero.debug(`DeepTutor: Error deleting session ${sessionId}: ${error.message}`);

			// You might want to show an error message to the user here
			this.setState({
				error: `Failed to delete session: ${error.message}`
			});
		}
	};

	// Helper to fetch backend user data using Cognito user object
	fetchUserData = async (cognitoUser) => {
		try {
			if (!cognitoUser) {
				Zotero.debug('DeepTutor: fetchUserData called with no cognitoUser');
				return null;
			}

			let providerUserId = null;

			// Check if this is a restored user with sub directly available
			if (cognitoUser.sub) {
				providerUserId = cognitoUser.sub;
				Zotero.debug(`DeepTutor: fetchUserData - Using provider user ID from restored user: ${providerUserId}`);
			}
			// Check if this is a Google OAuth user (has attributes directly)
			else if (cognitoUser.attributes && cognitoUser.attributes.sub) {
				providerUserId = cognitoUser.attributes.sub;
				Zotero.debug(`DeepTutor: fetchUserData - Using provider user ID from Google OAuth: ${providerUserId}`);
			}
			// For regular Cognito users, get user attributes
			else if (cognitoUser.getUserAttributes && typeof cognitoUser.getUserAttributes === 'function') {
				const attributes = await new Promise((resolve, reject) => {
					cognitoUser.getUserAttributes((err, attrs) => {
						if (err) {
							reject(err);
							return;
						}
						resolve(attrs);
					});
				});

				const subAttr = attributes.find(attr => attr.getName() === 'sub');
				if (!subAttr) {
					throw new Error('sub attribute not found on Cognito user');
				}

				// Store all necessary attributes for later use
				const emailAttr = attributes.find(attr => attr.getName() === 'email');
				const nameAttr = attributes.find(attr => attr.getName() === 'name');

				// Add attributes to cognitoUser for later use in registration
				cognitoUser.fetchedAttributes = {
					email: emailAttr ? emailAttr.getValue() : cognitoUser.username,
					name: nameAttr ? nameAttr.getValue() : cognitoUser.username
				};

				providerUserId = subAttr.getValue();
				Zotero.debug(`DeepTutor: fetchUserData - Using provider user ID from regular Cognito: ${providerUserId}`);
				Zotero.debug(`DeepTutor: fetchUserData - Fetched attributes: email=${cognitoUser.fetchedAttributes.email}, name=${cognitoUser.fetchedAttributes.name}`);
			}
			else {
				throw new Error('Cannot extract provider user ID from user object');
			}

			let userData;
			try {
				userData = await getUserByProviderUserId(providerUserId);
				Zotero.debug('DeepTutor: fetchUserData retrieved backend user data:', userData);
			}
			catch (getUserError) {
				Zotero.debug(`DeepTutor: fetchUserData getUserByProviderUserId error: ${getUserError.message}`);

				// If user not found, try to register them
				if (getUserError.message && (getUserError.message.includes('404') || getUserError.message.includes('Not Found'))) {
					try {
						Zotero.debug('DeepTutor: User not found in fetchUserData, attempting to register new user');

						// Create new user object
						const newUser = createBackendUser({
							name: cognitoUser.attributes?.name || cognitoUser.fetchedAttributes?.name || cognitoUser.name || cognitoUser.username || 'DeepTutor User',
							email: cognitoUser.attributes?.email || cognitoUser.fetchedAttributes?.email || cognitoUser.email || cognitoUser.username || 'user@deeptutor.com',
							providerUserId: providerUserId
						});

						// Register the user
						userData = await registerUser(newUser);
						Zotero.debug('DeepTutor: User registration successful in fetchUserData');
						Zotero.debug(`DeepTutor: Registered user: ${JSON.stringify(userData)}`);
					}
					catch (registerError) {
						Zotero.debug(`DeepTutor: Error registering user in fetchUserData: ${registerError.message}`);
						throw registerError;
					}
				}
				else {
					throw getUserError;
				}
			}

			// Check active subscription
			let userSubscribed = false;
			let activeSubscription = null;
			try {
				activeSubscription = await getActiveUserSubscriptionByUserId(userData.id);
				userSubscribed = !!activeSubscription;
				Zotero.debug('DeepTutor: Active subscription status:', userSubscribed);
			}
			catch (error) {
				Zotero.debug('DeepTutor: Error checking active subscription:', error);
			}

			// Check latest subscription
			let isFreeTrial = true;
			try {
				const latestSubscription = await getLatestUserSubscriptionByUserId(userData.id);
				isFreeTrial = !latestSubscription;
				Zotero.debug('DeepTutor: Latest subscription status:', isFreeTrial);
			}
			catch (error) {
				Zotero.debug('DeepTutor: Error checking latest subscription:', error);
			}

			// Save to state
			this.setState({
				userData,
				userSubscribed,
				isFreeTrial,
				activeSubscription
			});
			return userData;
		}
		catch (error) {
			Zotero.debug(`DeepTutor: fetchUserData error: ${error.message}`);

			// If the error suggests authentication issues, clear the stored auth state
			if (error.message && (
				error.message.includes('Authentication required')
				|| error.message.includes('Unauthorized')
				|| error.message.includes('Invalid token')
				|| error.message.includes('Token expired')
			)) {
				Zotero.debug('DeepTutor: Authentication error detected, clearing stored auth state');
				await forceSignOut(); // This will clear the stored auth state
				this.setState({
					isAuthenticated: false,
					currentUser: null,
					currentPane: 'welcome',
					authError: 'Session expired, please sign in again',
					activeSubscription: null,
					userSubscribed: false,
					isFreeTrial: true
				});
			}

			return null;
		}
	};

	// Handle iniWait state changes from DeepTutorChatBox
	handleInitWaitChange = (iniWait) => {
		Zotero.debug(`DeepTutor: Received iniWait state change: ${iniWait}`);

		if (iniWait) {
			// Freeze model selection immediately
			this.setState({ modelSelectionFrozen: true });
			Zotero.debug(`DeepTutor: Model selection frozen due to iniWait=true`);

			// Clear any existing timer
			if (this._modelSelectionFreezeTimer) {
				clearTimeout(this._modelSelectionFreezeTimer);
			}

			// Set 10-second timer to unfreeze model selection
			this._modelSelectionFreezeTimer = setTimeout(() => {
				this.setState({ modelSelectionFrozen: false });
				Zotero.debug(`DeepTutor: Model selection unfrozen after 10-second timer`);
				this._modelSelectionFreezeTimer = null;
			}, 10000);
		}
		else {
			// iniWait became false, but keep frozen until timer expires
			Zotero.debug(`DeepTutor: iniWait became false, but keeping model selection frozen until timer expires`);
		}
	};

	/**
	 * Handle window resize events with debouncing for performance
	 * This ensures the DeepTutor pane adjusts properly when the window size changes
	 */
	handleWindowResize = () => {
		// Clear any existing timer
		if (this._resizeDebounceTimer) {
			clearTimeout(this._resizeDebounceTimer);
		}

		// Debounce the resize handler to prevent excessive re-renders
		this._resizeDebounceTimer = setTimeout(() => {
			// Update window dimensions in state to trigger re-render
			this.setState({
				windowWidth: window.innerWidth,
				windowHeight: window.innerHeight
			});

			// Also trigger ZoteroPane layout update for consistency
			// This ensures the parent container dimensions are updated
			if (window.ZoteroPane && typeof window.ZoteroPane.updateLayoutConstraints === 'function') {
				window.ZoteroPane.updateLayoutConstraints();
			}

			Zotero.debug(`DeepTutor: Window resized to ${window.innerWidth}x${window.innerHeight}, layout updated`);
		}, 150); // 150ms debounce for good balance between responsiveness and performance
	};

	/**
	 * Handles Google sign-in popup close
	 * Disables the OAuth endpoint when popup is closed
	 */
	handleGoogleSignInClose = () => {
		try {
			console.log("🔐 DeepTutor: Google sign-in popup closed");

			// Disable the Google OAuth endpoint
			if (this.localhostServer) {
				this.localhostServer.disableGoogleOAuth();
			}

			Zotero.debug("DeepTutor: Google sign-in popup closed, OAuth endpoint disabled");
		}
		catch (error) {
			console.error("❌ DeepTutor: Error handling Google sign-in close:", error.message);
			Zotero.debug(`DeepTutor: Error handling Google sign-in close: ${error.message}`);
		}
	};


	render() {
		Zotero.debug("DeepTutor: Render called");

		return (
			<DeepTutorMain
				// State props
				currentPane={this.state.currentPane}
				currentSession={this.state.currentSession}
				sessions={this.state.sessions}
				isLoading={this.state.isLoading}
				error={this.state.error}
				collapsed={this.state.collapsed}
				windowWidth={this.state.windowWidth}
				windowHeight={this.state.windowHeight}
				
				// User props
				currentUser={this.state.currentUser}
				userData={this.state.userData}
				userSubscribed={this.state.userSubscribed}
				isFreeTrial={this.state.isFreeTrial}
				activeSubscription={this.state.activeSubscription}
				
				// Popup state props
				showProfilePopup={this.state.showProfilePopup}
				showSignInPopup={this.state.showSignInPopup}
				showUsagePopup={this.state.showUsagePopup}

				showModelSelectionPopup={this.state.showModelSelectionPopup}
				showDeletePopup={this.state.showDeletePopup}
				showRenamePopup={this.state.showRenamePopup}
				showNoPDFWarningPopup={this.state.showNoPDFWarningPopup}
				showSubscriptionConfirmPopup={this.state.showSubscriptionConfirmPopup}
				showManageSubscriptionPopup={this.state.showManageSubscriptionPopup}
				showSubscriptionPopup={this.state.showSubscriptionPopup}
				
				// Session props
				sessionToDelete={this.state.sessionToDelete}
				sessionNameToDelete={this.state.sessionNameToDelete}
				sessionToRename={this.state.sessionToRename}
				sessionNameToRename={this.state.sessionNameToRename}
				
				// Feature flags
				modelSelectionFrozen={this.state.modelSelectionFrozen}
				localhostServer={this.localhostServer}
				
				// Refs
				containerRef={this.containerRef}
				tutorBoxRef={ref => this._tutorBox = ref}
				
				// Event handlers
				handleContainerClick={this.handleContainerClick}
				handleSessionSelect={this.handleSessionSelect}
				handleInitWaitChange={this.handleInitWaitChange}
				handleModelSelectionSubmit={async (sessionId) => {
					try {
						const sessionData = await getSessionById(sessionId);
						const session = new DeepTutorSession(sessionData);
						const newsesIdToObj = new Map(this.state.sesIdToObj);
						newsesIdToObj.set(session.id, session);

						await this.setState({
							currentSession: session,
							messages: [],
							documentIds: session.documentIds || [],
							sesIdToObj: newsesIdToObj,
							sessions: [...this.state.sessions, session]
						});

						await this.handleSessionSelect(session.id);
						this.switchPane('main');
						this.toggleModelSelectionPopup();
					}
					catch (error) {
						Zotero.debug("Error creating session:", error);
					}
				}}
				handleSignInSuccess={this.handleSignInSuccess}

				handleSignOut={this.handleSignOut}
				handleOpenSignUpPage={this.handleOpenSignUpPage}

				handleShowDeletePopup={this.handleShowDeletePopup}
				handleConfirmDelete={this.handleConfirmDelete}
				handleCancelDelete={this.handleCancelDelete}
				handleShowRenamePopup={this.handleShowRenamePopup}
				handleRenameSuccess={this.handleRenameSuccess}
				handleCancelRename={this.handleCancelRename}
				handleSubscriptionStatusChange={this.handleSubscriptionStatusChange}
				
				// Toggle handlers
				switchPane={this.switchPane}
				toggleModelSelectionPopup={this.toggleModelSelectionPopup}
				toggleSignInPopup={this.toggleSignInPopup}
				toggleUsagePopup={this.toggleUsagePopup}

				toggleProfilePopup={this.toggleProfilePopup}
				openNoPDFWarningPopup={this.openNoPDFWarningPopup}
				closeNoPDFWarningPopup={this.closeNoPDFWarningPopup}
				toggleSubscriptionPopup={this.toggleSubscriptionPopup}
				toggleManageSubscriptionPopup={this.toggleManageSubscriptionPopup}
				toggleSubscriptionConfirmPopup={this.toggleSubscriptionConfirmPopup}

				// File size warning popup
				showFileSizeWarningPopup={this.state.showFileSizeWarningPopup}
				openFileSizeWarningPopup={this.openFileSizeWarningPopup}
				closeFileSizeWarningPopup={this.closeFileSizeWarningPopup}
			/>
		);
	}
};

// Add event dispatcher functionality
Zotero.Utilities.Internal.makeClassEventDispatcher(DeepTutor);

// Export the component
module.exports = DeepTutor;
