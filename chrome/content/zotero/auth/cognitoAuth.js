// AWS Cognito Authentication for DeepTutor Zotero Extension

// Initialize Services
let Services;

// If Services is not immediately available, try to get it when needed
function getServices() {
	if (!Services) {
		Services = globalThis.Services || window.Services;

		// If still not available, try importing
		if (!Services) {
			try {
				if (typeof ChromeUtils !== 'undefined') {
					Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
				}
				else if (typeof Components !== 'undefined' && Components.utils) {
					Services = Components.utils.import("resource://gre/modules/Services.jsm").Services;
				}
			}
			catch (e) {
				Zotero.debug('DeepTutor Auth: Could not import Services:', e.message);
			}
		}
	}
	return Services;
}

// Dynamically load Amazon Cognito Identity JS library
let { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } = {};

function loadCognitoLibrary() {
	if (typeof window.AmazonCognitoIdentity !== 'undefined') {
		// Library already loaded
		({ CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } = window.AmazonCognitoIdentity);
		initializeUserPool();
		return Promise.resolve();
	}

		return new Promise(async (resolve, reject) => {
		try {
			// Method 1: Try using Services.scriptloader
			const services = getServices();
			if (services && services.scriptloader) {
				services.scriptloader.loadSubScript("resource://zotero/amazon-cognito-identity-js.js", window);
			}
			else {
				// Method 2: Try using fetch and eval
				try {
					const response = await fetch('resource://zotero/amazon-cognito-identity-js.js');
					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`);
					}
					const scriptContent = await response.text();

					// Execute the script in the global context
					const script = `
						(function() {
							${scriptContent}
						})();
					`;
					eval(script);
				}
				catch (fetchError) {
					throw new Error(`Failed to load via fetch: ${fetchError.message}`);
				}
			}

					// Give a moment for the library to initialize
		setTimeout(() => {
			try {
				// Check if library was loaded successfully
				if (typeof window.AmazonCognitoIdentity !== 'undefined') {
					({ CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } = window.AmazonCognitoIdentity);
					initializeUserPool();
					resolve();
				}
				else {
					throw new Error('Library loaded but AmazonCognitoIdentity not found in global scope');
				}
			}
			catch (checkError) {
				reject(checkError);
			}
		}, 50);
			}
	catch (error) {
		reject(new Error(`Failed to load Amazon Cognito Identity JS library. Please ensure the library is built and available. Error: ${error.message}`));
	}
	});
}

import amplifyConfig from './amplifyconfiguration.js';

// Initialize Cognito User Pool (will be set after library loads)
let userPool = null;

function initializeUserPool() {
	if (!userPool && CognitoUserPool) {
		const poolData = {
			UserPoolId: amplifyConfig.aws_user_pools_id,
			ClientId: amplifyConfig.aws_user_pools_web_client_id
		};
		userPool = new CognitoUserPool(poolData);
		Zotero.debug('DeepTutor Auth: User pool initialized');
	}
	return userPool;
}

// Authentication state management
class AuthState {
	constructor() {
		this.isAuthenticated = false;
		this.user = null;
		this.accessToken = null;
		this.idToken = null;
		this.refreshToken = null;
		this.listeners = [];
	}

	// Add listener for auth state changes
	addListener(callback) {
		this.listeners.push(callback);
	}

	// Remove listener
	removeListener(callback) {
		this.listeners = this.listeners.filter(listener => listener !== callback);
	}

	// Notify all listeners of auth state change
	notifyListeners() {
		this.listeners.forEach(callback => callback(this.isAuthenticated, this.user));
	}

	// Set authenticated state
	setAuthenticated(user, session) {
		this.isAuthenticated = true;
		this.user = user;
		this.accessToken = session.getAccessToken().getJwtToken();
		this.idToken = session.getIdToken().getJwtToken();
		this.refreshToken = session.getRefreshToken().getToken();

		// Store tokens in Zotero preferences for persistence
		Zotero.Prefs.set('deeptutor.auth.accessToken', this.accessToken);
		Zotero.Prefs.set('deeptutor.auth.idToken', this.idToken);
		Zotero.Prefs.set('deeptutor.auth.refreshToken', this.refreshToken);
		Zotero.Prefs.set('deeptutor.auth.isAuthenticated', true);

		// Store complete user data for restoration
		try {
			let completeUserData;

			if (user.attributes) {
				// For Google OAuth users - already has attributes
				completeUserData = {
					username: user.username || user.attributes.email,
					attributes: user.attributes,
					isGoogleOAuth: true,
					email: user.attributes.email,
					name: user.attributes.name,
					sub: user.attributes.sub
				};
			}
			else {
				// For regular Cognito users - extract what we need
				completeUserData = {
					username: user.username,
					attributes: {
						email: user.username, // Cognito uses username as email
						sub: user.username // Will be updated if we can get real attributes
					},
					isGoogleOAuth: false,
					email: user.username
				};

				// Try to get additional user attributes for regular Cognito users
				if (user.getUserAttributes && typeof user.getUserAttributes === 'function') {
					user.getUserAttributes((err, attributes) => {
						if (!err && attributes) {
							const attrs = {};
							attributes.forEach((attr) => {
								attrs[attr.getName()] = attr.getValue();
							});
							completeUserData.attributes = attrs;
							completeUserData.email = attrs.email || user.username;
							completeUserData.name = attrs.name;
							completeUserData.sub = attrs.sub;

							// Update stored data with complete attributes
							const userDataString = JSON.stringify(completeUserData);
							Zotero.Prefs.set('deeptutor.auth.userData', userDataString);
							Zotero.debug(`DeepTutor Auth: Updated user data with attributes: ${userDataString}`);
						}
					});
				}
			}

			const userDataString = JSON.stringify(completeUserData);
			Zotero.Prefs.set('deeptutor.auth.userData', userDataString);
			Zotero.debug(`DeepTutor Auth: Saved complete user data to preferences: ${userDataString}`);
		}
		catch (error) {
			Zotero.debug(`DeepTutor Auth: Error saving user data: ${error.message}`);
		}

		// Verify data was saved
		const savedIsAuth = Zotero.Prefs.get('deeptutor.auth.isAuthenticated');
		const savedUserData = Zotero.Prefs.get('deeptutor.auth.userData');
		Zotero.debug(`DeepTutor Auth: Verification - isAuthenticated: ${savedIsAuth}, userData: ${savedUserData}`);

		this.notifyListeners();
	}

	// Set unauthenticated state
	setUnauthenticated() {
		this.isAuthenticated = false;
		this.user = null;
		this.accessToken = null;
		this.idToken = null;
		this.refreshToken = null;

		// Clear tokens from Zotero preferences
		Zotero.Prefs.clear('deeptutor.auth.accessToken');
		Zotero.Prefs.clear('deeptutor.auth.idToken');
		Zotero.Prefs.clear('deeptutor.auth.refreshToken');
		Zotero.Prefs.clear('deeptutor.auth.isAuthenticated');
		Zotero.Prefs.clear('deeptutor.auth.userData');

		this.notifyListeners();
	}

	// Restore auth state from stored preferences
	async restoreFromStorage() {
		const isAuthenticated = Zotero.Prefs.get('deeptutor.auth.isAuthenticated');
		Zotero.debug(`DeepTutor Auth: Checking stored authentication state - isAuthenticated: ${isAuthenticated}`);

		if (isAuthenticated) {
			Zotero.debug('DeepTutor Auth: Restoring authentication state from storage');

			this.isAuthenticated = true;
			this.accessToken = Zotero.Prefs.get('deeptutor.auth.accessToken');
			this.idToken = Zotero.Prefs.get('deeptutor.auth.idToken');
			this.refreshToken = Zotero.Prefs.get('deeptutor.auth.refreshToken');

			Zotero.debug(`DeepTutor Auth: Restored tokens - accessToken: ${this.accessToken ? 'present' : 'missing'}, idToken: ${this.idToken ? 'present' : 'missing'}, refreshToken: ${this.refreshToken ? 'present' : 'missing'}`);

			// Restore user data directly from storage
			try {
				const userDataStr = Zotero.Prefs.get('deeptutor.auth.userData');
				Zotero.debug(`DeepTutor Auth: Raw user data from preferences: ${userDataStr}`);

				if (userDataStr) {
					const storedUserData = JSON.parse(userDataStr);
					Zotero.debug(`DeepTutor Auth: Parsed user data: ${JSON.stringify(storedUserData)}`);

					// Create a user object that can be used directly without Cognito methods
					this.user = {
						username: storedUserData.username,
						attributes: storedUserData.attributes,
						email: storedUserData.email,
						name: storedUserData.name,
						sub: storedUserData.sub,
						isGoogleOAuth: storedUserData.isGoogleOAuth
					};

					Zotero.debug(`DeepTutor Auth: Restored user from storage: ${storedUserData.isGoogleOAuth ? 'Google OAuth' : 'Regular Cognito'} user`);
				}
				else {
					Zotero.debug('DeepTutor Auth: No user data found in preferences');
					// If no user data, clear authentication state
					this.setUnauthenticated();
					return;
				}
			}
			catch (error) {
				Zotero.debug(`DeepTutor Auth: Error restoring user data from storage: ${error.message}`);
				// If we can't parse user data, clear authentication state
				this.setUnauthenticated();
				return;
			}

			// Notify listeners that auth state has been restored
			this.notifyListeners();
			Zotero.debug('DeepTutor Auth: Authentication state restored successfully');
		}
		else {
			Zotero.debug('DeepTutor Auth: No authentication state found in storage');
		}
	}

	// Get access token for API requests
	getAccessToken() {
		return this.accessToken;
	}

	// Get ID token
	getIdToken() {
		return this.idToken;
	}

	// Check if user is authenticated
	isUserAuthenticated() {
		return this.isAuthenticated;
	}

	// Get current user
	getCurrentUser() {
		return this.user;
	}
}

// Global auth state instance
const authState = new AuthState();

// Initialize auth state function - to be called when needed
async function initializeAuthState() {
	try {
		Zotero.debug('DeepTutor Auth: Initializing auth state...');
		await authState.restoreFromStorage();
		Zotero.debug('DeepTutor Auth: Auth state initialization complete');
	}
	catch (error) {
		Zotero.debug(`DeepTutor Auth: Error during auth state initialization: ${error.message}`);
	}
}

// Export the initialization function
export { initializeAuthState };

// Force clear authentication state - used when API calls fail due to auth issues
export const forceSignOut = async () => {
	Zotero.debug('DeepTutor Auth: Force clearing authentication state');
	authState.setUnauthenticated();
	return Promise.resolve();
};

// Sign up function
export const signUp = async (email, password, name) => {
	await loadCognitoLibrary();
	const pool = initializeUserPool();

	return new Promise((resolve, reject) => {
		const attributeList = [];

		// Add email attribute
		const dataEmail = {
			Name: 'email',
			Value: email
		};
		const attributeEmail = new CognitoUserAttribute(dataEmail);
		attributeList.push(attributeEmail);

		// Add name attribute if provided
		if (name) {
			const dataName = {
				Name: 'name',
				Value: name
			};
			const attributeName = new CognitoUserAttribute(dataName);
			attributeList.push(attributeName);
		}

		pool.signUp(email, password, attributeList, null, (err, result) => {
			if (err) {
				Zotero.debug(`DeepTutor Auth: Sign up error: ${err.message}`);
				reject(err);
				return;
			}

			Zotero.debug('DeepTutor Auth: Sign up successful');
			resolve({
				user: result.user,
				userConfirmed: result.userConfirmed,
				userSub: result.userSub
			});
		});
	});
};

// Confirm sign up with verification code
export const confirmSignUp = async (email, confirmationCode) => {
	await loadCognitoLibrary();
	const pool = initializeUserPool();

	return new Promise((resolve, reject) => {
		const userData = {
			Username: email,
			Pool: pool
		};

		const cognitoUser = new CognitoUser(userData);

		cognitoUser.confirmRegistration(confirmationCode, true, (err, result) => {
			if (err) {
				Zotero.debug(`DeepTutor Auth: Confirmation error: ${err.message}`);
				reject(err);
				return;
			}

			Zotero.debug('DeepTutor Auth: Email confirmation successful');
			resolve(result);
		});
	});
};

// Sign in function
export const signIn = async (email, password) => {
	await loadCognitoLibrary();
	const pool = initializeUserPool();

	return new Promise((resolve, reject) => {
		const authenticationData = {
			Username: email,
			Password: password
		};

		const authenticationDetails = new AuthenticationDetails(authenticationData);

		const userData = {
			Username: email,
			Pool: pool
		};

		const cognitoUser = new CognitoUser(userData);

		cognitoUser.authenticateUser(authenticationDetails, {
			onSuccess: (session) => {
				Zotero.debug('DeepTutor Auth: Sign in successful');
				authState.setAuthenticated(cognitoUser, session);
				resolve({
					user: cognitoUser,
					session: session,
					accessToken: session.getAccessToken().getJwtToken(),
					idToken: session.getIdToken().getJwtToken()
				});
			},
			onFailure: (err) => {
				Zotero.debug(`DeepTutor Auth: Sign in error: ${err.message}`);
				reject(err);
			},
			newPasswordRequired: (userAttributes, requiredAttributes) => {
				// Handle new password required case
				Zotero.debug('DeepTutor Auth: New password required');
				reject(new Error('New password required'));
			}
		});
	});
};

// Sign out function
export const signOut = async () => {
	try {
		await loadCognitoLibrary();
		const pool = initializeUserPool();

		const currentUser = pool.getCurrentUser();

		if (currentUser) {
			currentUser.signOut();
			Zotero.debug('DeepTutor Auth: Sign out successful');
		}

		authState.setUnauthenticated();
		return Promise.resolve();
	}
	catch (error) {
		Zotero.debug(`DeepTutor Auth: Sign out error: ${error.message}`);
		authState.setUnauthenticated();
		return Promise.resolve();
	}
};

// Get current authenticated user
export const getCurrentUser = async () => {
	await loadCognitoLibrary();
	const pool = initializeUserPool();

	return new Promise((resolve, reject) => {
		const currentUser = pool.getCurrentUser();

		Zotero.debug(`DeepTutor Auth: getCurrentUser - pool.getCurrentUser() result: ${currentUser ? 'found' : 'null'}`);

		if (!currentUser) {
			// Check if we have a user in authState (for Google OAuth users)
			if (authState.isUserAuthenticated() && authState.getCurrentUser()) {
				const authStateUser = authState.getCurrentUser();
				Zotero.debug('DeepTutor Auth: getCurrentUser - Using user from authState (Google OAuth)');
				Zotero.debug(`DeepTutor Auth: getCurrentUser - AuthState user: ${JSON.stringify(authStateUser, null, 2)}`);

				// Create a mock session object for consistency
				const mockSession = {
					isValid: () => true,
					getAccessToken: () => ({ getJwtToken: () => authState.getAccessToken() }),
					getIdToken: () => ({ getJwtToken: () => authState.getIdToken() })
				};

				resolve({
					user: authStateUser,
					session: mockSession,
					accessToken: authState.getAccessToken(),
					idToken: authState.getIdToken()
				});
				return;
			}

			Zotero.debug('DeepTutor Auth: getCurrentUser - No current user found in pool or authState');
			reject(new Error('No current user'));
			return;
		}

		// For regular Cognito users
		Zotero.debug('DeepTutor Auth: getCurrentUser - Processing regular Cognito user');
		currentUser.getSession((err, session) => {
			if (err) {
				Zotero.debug(`DeepTutor Auth: Get session error: ${err.message}`);
				authState.setUnauthenticated();
				reject(err);
				return;
			}

			if (session.isValid()) {
				authState.setAuthenticated(currentUser, session);
				resolve({
					user: currentUser,
					session: session,
					accessToken: session.getAccessToken().getJwtToken(),
					idToken: session.getIdToken().getJwtToken()
				});
			}
			else {
				authState.setUnauthenticated();
				reject(new Error('Session is not valid'));
			}
		});
	});
};

// Refresh session
export const refreshSession = async () => {
	await loadCognitoLibrary();
	const pool = initializeUserPool();

	return new Promise((resolve, reject) => {
		const currentUser = pool.getCurrentUser();

		if (!currentUser) {
			reject(new Error('No current user'));
			return;
		}

		currentUser.getSession((err, session) => {
			if (err) {
				Zotero.debug(`DeepTutor Auth: Refresh session error: ${err.message}`);
				authState.setUnauthenticated();
				reject(err);
				return;
			}

			if (session.isValid()) {
				authState.setAuthenticated(currentUser, session);
				resolve({
					user: currentUser,
					session: session,
					accessToken: session.getAccessToken().getJwtToken(),
					idToken: session.getIdToken().getJwtToken()
				});
			}
			else {
				// Try to refresh the session
				const refreshToken = session.getRefreshToken();
				currentUser.refreshSession(refreshToken, (refreshErr, refreshedSession) => {
					if (refreshErr) {
						Zotero.debug(`DeepTutor Auth: Refresh token error: ${refreshErr.message}`);
						authState.setUnauthenticated();
						reject(refreshErr);
						return;
					}

					authState.setAuthenticated(currentUser, refreshedSession);
					resolve({
						user: currentUser,
						session: refreshedSession,
						accessToken: refreshedSession.getAccessToken().getJwtToken(),
						idToken: refreshedSession.getIdToken().getJwtToken()
					});
				});
			}
		});
	});
};

// Forgot password
export const forgotPassword = async (email) => {
	await loadCognitoLibrary();
	const pool = initializeUserPool();

	return new Promise((resolve, reject) => {
		const userData = {
			Username: email,
			Pool: pool
		};

		const cognitoUser = new CognitoUser(userData);

		cognitoUser.forgotPassword({
			onSuccess: (data) => {
				Zotero.debug('DeepTutor Auth: Forgot password email sent');
				resolve(data);
			},
			onFailure: (err) => {
				Zotero.debug(`DeepTutor Auth: Forgot password error: ${err.message}`);
				reject(err);
			}
		});
	});
};

// Confirm forgot password
export const confirmForgotPassword = async (email, confirmationCode, newPassword) => {
	await loadCognitoLibrary();
	const pool = initializeUserPool();

	return new Promise((resolve, reject) => {
		const userData = {
			Username: email,
			Pool: pool
		};

		const cognitoUser = new CognitoUser(userData);

		cognitoUser.confirmPassword(confirmationCode, newPassword, {
			onSuccess: () => {
				Zotero.debug('DeepTutor Auth: Password reset successful');
				resolve();
			},
			onFailure: (err) => {
				Zotero.debug(`DeepTutor Auth: Password reset error: ${err.message}`);
				reject(err);
			}
		});
	});
};

// Google Sign In (OAuth) - Simplified version that doesn't show dialog
export const signInWithGoogle = () => {
	return new Promise((resolve, reject) => {
		// This function now just resolves immediately since the actual OAuth flow
		// will be handled by the localhost server when it receives the OAuth code
		Zotero.debug('DeepTutor Auth: signInWithGoogle called - OAuth flow will be handled by localhost server');
		
		// Return a mock success response since the real authentication will happen
		// when the localhost server receives the OAuth code
		resolve({
			user: null,
			session: null,
			accessToken: null,
			idToken: null,
			pending: true
		});
	});
};

// Extracted OAuth completion logic - can be called directly by localhost server
export const completeGoogleOAuth = async (authCode) => {
	try {
		Zotero.debug(`DeepTutor Auth: Processing OAuth code: ${authCode ? 'present' : 'missing'}`);

		if (!authCode) {
			throw new Error('No authorization code received');
		}

		// Exchange authorization code for tokens
		const tokenResponse = await exchangeCodeForTokens(authCode);
		Zotero.debug('DeepTutor Auth: Token exchange successful');

		// Parse and validate the ID token
		const { accessToken, idToken, refreshToken } = tokenResponse;
		const userInfo = parseJwtToken(idToken);

		// Print user data for debugging
		Zotero.debug('DeepTutor Auth: Google Sign In - User Info from JWT:');
		Zotero.debug(JSON.stringify(userInfo, null, 2));

		// Create a mock Cognito user for consistency with existing auth flow
		const cognitoUser = {
			username: userInfo.email,
			attributes: {
				email: userInfo.email,
				name: userInfo.name,
				sub: userInfo.sub
			}
		};

		// Print final user object for debugging
		Zotero.debug('DeepTutor Auth: Google Sign In - Final User Object:');
		Zotero.debug(JSON.stringify(cognitoUser, null, 2));

		// Create a mock session object
		const session = {
			isValid: () => true,
			getAccessToken: () => ({ getJwtToken: () => accessToken }),
			getIdToken: () => ({ getJwtToken: () => idToken }),
			getRefreshToken: () => ({ getToken: () => refreshToken })
		};

		// Update auth state
		authState.setAuthenticated(cognitoUser, session);

		return {
			success: true,
			user: cognitoUser,
			session: session,
			accessToken: accessToken,
			idToken: idToken
		};
	}
	catch (error) {
		Zotero.debug(`DeepTutor Auth: Google OAuth completion error: ${error.message}`);
		return {
			success: false,
			error: error.message
		};
	}
};

// Helper function to exchange authorization code for tokens
async function exchangeCodeForTokens(authCode) {
	const domain = amplifyConfig.oauth.domain;
	const clientId = amplifyConfig.aws_user_pools_web_client_id;
	// Must match the authorize redirect used by the desktop flow
	const redirectUri = `http://localhost:${Zotero.Server?.port}/deeptutor/oauth-callback`;

	const tokenEndpoint = `https://${domain}/oauth2/token`;

	// Create URL-encoded form data manually since URLSearchParams is not available in Zotero extension context
	const formData = [
		`grant_type=authorization_code`,
		`client_id=${encodeURIComponent(clientId)}`,
		`code=${encodeURIComponent(authCode)}`,
		`redirect_uri=${encodeURIComponent(redirectUri)}`
	].join('&');

	try {
		const xmlhttp = await Zotero.HTTP.request('POST', tokenEndpoint, {
			body: formData,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});

		if (xmlhttp.status < 200 || xmlhttp.status >= 300) {
			const errorText = xmlhttp.responseText;
			throw new Error(`Token exchange failed: ${xmlhttp.status} ${errorText}`);
		}

		const tokenData = JSON.parse(xmlhttp.responseText);

		return {
			accessToken: tokenData.access_token,
			idToken: tokenData.id_token,
			refreshToken: tokenData.refresh_token,
			tokenType: tokenData.token_type,
			expiresIn: tokenData.expires_in
		};
	}
	catch (error) {
		Zotero.debug(`DeepTutor Auth: Token exchange error: ${error.message}`);
		throw error;
	}
}

// Helper function to parse JWT token
function parseJwtToken(token) {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			throw new Error('Invalid JWT token format');
		}

		const payload = parts[1];
		// Add padding if necessary
		const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
		// Use Zotero's base64 decoder instead of atob
		const decodedPayload = Zotero.Utilities.Internal.Base64.decode(paddedPayload);

		return JSON.parse(decodedPayload);
	}
	catch (error) {
		Zotero.debug(`DeepTutor Auth: JWT parsing error: ${error.message}`);
		throw new Error('Failed to parse JWT token');
	}
}

// Export auth state for components to use
export const useAuthState = () => {
	return {
		isAuthenticated: authState.isUserAuthenticated(),
		user: authState.getCurrentUser(),
		accessToken: authState.getAccessToken(),
		idToken: authState.getIdToken(),
		addListener: authState.addListener.bind(authState),
		removeListener: authState.removeListener.bind(authState)
	};
};

// Export auth state instance
export { authState };
