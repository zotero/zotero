// Import Services for Zotero extension environment
// In Zotero extensions, Services is usually available globally
let Services = globalThis.Services || window.Services;

// If Services is not immediately available, try to get it when needed
function getServices() {
    if (!Services) {
        Services = globalThis.Services || window.Services;
        
        // If still not available, try importing
        if (!Services) {
            try {
                if (typeof ChromeUtils !== 'undefined') {
                    Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
                } else if (typeof Components !== 'undefined' && Components.utils) {
                    Services = Components.utils.import("resource://gre/modules/Services.jsm").Services;
                }
            } catch (e) {
                Zotero.debug('DeepTutor Auth: Could not import Services:', e.message);
            }
        }
    }
    return Services;
}

// Dynamically load Amazon Cognito Identity JS library
let CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute;

function loadCognitoLibrary() {
    if (typeof window.AmazonCognitoIdentity !== 'undefined') {
        // Library already loaded
        ({ CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } = window.AmazonCognitoIdentity);
        initializeUserPool();
        return Promise.resolve();
    }

    return new Promise(async (resolve, reject) => {
        try {
            Zotero.debug('DeepTutor Auth: Loading Amazon Cognito Identity JS library...');
            
            // Method 1: Try using Services.scriptloader
            const services = getServices();
            if (services && services.scriptloader) {
                Zotero.debug('DeepTutor Auth: Using Services.scriptloader method');
                services.scriptloader.loadSubScript("resource://zotero/amazon-cognito-identity-js.js", window);
            } else {
                // Method 2: Try using fetch and eval
                Zotero.debug('DeepTutor Auth: Services not available, trying fetch method');
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
                    
                    Zotero.debug('DeepTutor Auth: Script loaded via fetch and eval');
                } catch (fetchError) {
                    Zotero.debug(`DeepTutor Auth: Fetch method failed: ${fetchError.message}`);
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
                        Zotero.debug('DeepTutor Auth: Amazon Cognito Identity JS library loaded successfully');
                        resolve();
                    } else {
                        throw new Error('Library loaded but AmazonCognitoIdentity not found in global scope');
                    }
                } catch (checkError) {
                    reject(checkError);
                }
            }, 50);
            
        } catch (error) {
            Zotero.debug(`DeepTutor Auth: Failed to load Amazon Cognito Identity JS library: ${error.message}`);
            const services = getServices();
            Zotero.debug(`DeepTutor Auth: Services available: ${services !== null && services !== undefined}`);
            Zotero.debug(`DeepTutor Auth: Services.scriptloader available: ${services && typeof services.scriptloader !== 'undefined'}`);
            Zotero.debug(`DeepTutor Auth: Window object: ${typeof window !== 'undefined'}`);
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
        
        this.notifyListeners();
    }

    // Restore auth state from stored preferences
    async restoreFromStorage() {
        const isAuthenticated = Zotero.Prefs.get('deeptutor.auth.isAuthenticated');
        if (isAuthenticated) {
            this.isAuthenticated = true;
            this.accessToken = Zotero.Prefs.get('deeptutor.auth.accessToken');
            this.idToken = Zotero.Prefs.get('deeptutor.auth.idToken');
            this.refreshToken = Zotero.Prefs.get('deeptutor.auth.refreshToken');
            
            // Try to get current user
            try {
                await loadCognitoLibrary();
                const pool = initializeUserPool();
                const currentUser = pool.getCurrentUser();
                if (currentUser) {
                    this.user = currentUser;
                }
            } catch (error) {
                Zotero.debug(`DeepTutor Auth: Error restoring user from storage: ${error.message}`);
            }
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

// Initialize auth state from storage on module load (async)
(async () => {
    try {
        await authState.restoreFromStorage();
    } catch (error) {
        Zotero.debug(`DeepTutor Auth: Error during initial auth state restoration: ${error.message}`);
    }
})();

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
    } catch (error) {
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
        
        if (!currentUser) {
            reject(new Error('No current user'));
            return;
        }
        
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
            } else {
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
            } else {
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

// Google Sign In (OAuth)
export const signInWithGoogle = () => {
    return new Promise((resolve, reject) => {
        const domain = amplifyConfig.oauth.domain;
        const clientId = amplifyConfig.aws_user_pools_web_client_id;
        const redirectUri = encodeURIComponent('https://staging.deeptutor.knowhiz.us/');
        const scope = encodeURIComponent(amplifyConfig.oauth.scope.join(' '));
        
        const googleAuthUrl = `https://${domain}/oauth2/authorize?` +
            `identity_provider=Google&` +
            `redirect_uri=${redirectUri}&` +
            `response_type=code&` +
            `client_id=${clientId}&` +
            `scope=${scope}`;
        
        // Open Google auth in external browser
        Zotero.launchURL(googleAuthUrl);
        
        // Note: In a real implementation, you would need to handle the redirect
        // and extract the authorization code to complete the OAuth flow
        resolve({ message: 'Google auth initiated' });
    });
};

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