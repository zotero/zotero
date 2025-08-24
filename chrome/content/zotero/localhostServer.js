/**
 * DeepTutor Localhost Server Integration
 *
 * This module integrates with Zotero's existing HTTP server infrastructure
 * to provide OAuth callback endpoints and text messaging functionality.
 *
 * @author DeepTutor Team
 * @license GNU Affero General Public License v3.0
 */

"use strict";

// Import the completeGoogleOAuth function from cognitoAuth
let completeGoogleOAuth = null;
try {
	const cognitoAuth = require('./auth/cognitoAuth.js');
	completeGoogleOAuth = cognitoAuth.completeGoogleOAuth;
}
catch (error) {
	console.log("🔐 DeepTutor: Could not import completeGoogleOAuth function:", error.message);
}

/**
 * DeepTutor Localhost Server Class
 *
 * Integrates with Zotero's existing HTTP server to provide OAuth callback
 * and text messaging functionality with robust error handling.
 */
class DeepTutorLocalhostServer {

	/**
	 * Constructor for the DeepTutor server integration
	 * @param {number} port - The port number (0 to use Zotero's dynamic port)
	 * @param {Object} options - Configuration options
	 */
	constructor(port = 0, options = {}) {
		this.port = port;
		this.isRunning = false;
		this.serverUrl = null;
		this.endpointRegistered = false;
		this.googleOAuthEnabled = false;
		this.oauthState = null;
		this._lastOAuthResult = null;
		this._serverCheckInterval = null;
		this._maxRetries = options.maxRetries || 3;
		this._retryDelay = options.retryDelay || 1000;
		this._healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
	}

	/**
	 * Enables the Google OAuth endpoint (called when Google sign-in popup is shown)
	 */
	enableGoogleOAuth() {
		this.googleOAuthEnabled = true;
		console.log("🔐 DeepTutor: Google OAuth endpoint enabled");
	}

	/**
	 * Disables the Google OAuth endpoint (called when Google sign-in popup is closed)
	 */
	disableGoogleOAuth() {
		this.googleOAuthEnabled = false;
		this.oauthState = null;
		console.log("🔐 DeepTutor: Google OAuth endpoint disabled");
	}

	/**
	 * Gets the OAuth redirect URI for external services
	 * @returns {string} The complete redirect URI
	 */
	getOAuthRedirectUri() {
		const baseUrl = this.getServerUrl();
		return `${baseUrl}/deeptutor/oauth-callback`;
	}

	/**
	 * Gets the OAuth status endpoint URI
	 * @returns {string} The complete status endpoint URI
	 */
	getOAuthStatusUri() {
		const baseUrl = this.getServerUrl();
		return `${baseUrl}/deeptutor/oauth-status`;
	}

	/**
	 * Handles OAuth code authentication by calling the completeGoogleOAuth function
	 * @param {string} authCode - The authorization code received from Google
	 * @returns {Promise<Object>} - Returns the authentication result
	 */
	async handleOAuthCode(authCode) {
		try {
			// Check if the completeGoogleOAuth function is available
			if (!completeGoogleOAuth) {
				return {
					success: false,
					error: "Authentication system not available"
				};
			}

			// Call the imported completeGoogleOAuth function
			const result = await completeGoogleOAuth(authCode);

			if (result.success) {
				console.log("✅ DeepTutor: OAuth authentication completed successfully");
				return {
					success: true,
					message: "Authentication completed successfully",
					user: result.user
				};
			}
			else {
				console.error("❌ DeepTutor: OAuth authentication failed:", result.error);
				return {
					success: false,
					error: result.error
				};
			}
		}
		catch (error) {
			console.error("❌ DeepTutor: OAuth code authentication failed:", error.message);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Opens the Google sign-in URL in the default browser
	 * @returns {Promise<boolean>} - Returns true if URL was opened successfully
	 */
	async openGoogleSignInUrl() {
		try {
			// Import amplify configuration to generate proper OAuth URL
			let amplifyConfig;
			try {
				amplifyConfig = require('./auth/amplifyconfiguration.js').default;
			}
			catch (error) {
				console.error("❌ DeepTutor: Could not import amplify configuration:", error.message);
				return false;
			}

			const domain = amplifyConfig.oauth.domain;
			const clientId = amplifyConfig.aws_user_pools_web_client_id;
			
			// Use the enhanced redirect URI method
			const redirectUri = this.getOAuthRedirectUri();
			const scope = encodeURIComponent(amplifyConfig.oauth.scope.join(' '));
			
			// Generate a cryptographically-strong random state for CSRF protection
			this.oauthState = this._generateRandomState();

			const url = `https://${domain}/oauth2/authorize?`
				+ `identity_provider=Google&`
				+ `redirect_uri=${encodeURIComponent(redirectUri)}&`
				+ `response_type=code&`
				+ `client_id=${clientId}&`
				+ `scope=${scope}&`
				+ `state=${encodeURIComponent(this.oauthState)}`;

			console.log("🔐 DeepTutor: Generated OAuth URL with redirect URI:", redirectUri);

			// Try multiple methods to open the URL
			try {
				// Primary: Use Zotero's proper API for opening external URLs
				Zotero.launchURL(url);
				return true;
			}
			catch (error) {
				console.error("❌ DeepTutor: Failed to open URL with Zotero.launchURL:", error.message);
				
				// Fallback: Try XPCOM nsIExternalProtocolService
				try {
					if (typeof Cc !== "undefined" && typeof Ci !== "undefined") {
						const extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
							.getService(Ci.nsIExternalProtocolService);
						const uri = Cc["@mozilla.org/network/io-service;1"]
							.getService(Ci.nsIIOService)
							.newURI(url, null, null);
						extps.loadURI(uri);
						return true;
					}
				}
				catch (fallbackError) {
					console.error("❌ DeepTutor: Failed to open URL with XPCOM:", fallbackError.message);
				}
				
				// Final fallback: Copy URL to clipboard
				if (navigator.clipboard) {
					await navigator.clipboard.writeText(url);
					if (typeof Zotero !== "undefined") {
						Zotero.alert(null, "DeepTutor",
							`Google sign-in URL copied to clipboard!\n\nRedirect URI: ${redirectUri}\n\nPlease paste the URL in your browser to access the sign-in page.`);
					}
					return true;
				}
				
				return false;
			}
		}
		catch (error) {
			console.error("❌ DeepTutor: Error opening Google sign-in URL:", error.message);
			return false;
		}
	}

	/**
	 * Generates a random 32-byte state as hex string
	 * @returns {string}
	 */
	_generateRandomState() {
		try {
			const array = new Uint8Array(32);
			if (typeof crypto !== "undefined" && crypto.getRandomValues) {
				crypto.getRandomValues(array);
			}
			else {
				// Fallback: use Math.random (less secure but acceptable as last resort in desktop context)
				for (let i = 0; i < array.length; i++) {
					array[i] = Math.floor(Math.random() * 256);
				}
			}
			return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
		}
		catch {
			// Ultimate fallback
			return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
		}
	}

	/**
	 * Starts the DeepTutor server integration with retry logic
	 * @returns {Promise<boolean>} - Returns true if integration started successfully
	 */
	async start() {
		let retryCount = 0;
		
		while (retryCount < this._maxRetries) {
			try {
				console.log(`🚀 DeepTutor: Attempting to start server integration (attempt ${retryCount + 1}/${this._maxRetries})`);
				
				// Check if Zotero.Server is available
				if (typeof Zotero === "undefined" || !Zotero.Server) {
					throw new Error("Zotero.Server not available");
				}

				// Initialize Zotero's HTTP server if not already running
				if (!Zotero.Server.port) {
					Zotero.Server.init(this.port);
				}

				// Wait for server to start with exponential backoff
				const waitTime = Math.min(100 * Math.pow(2, retryCount), 2000);
				await new Promise(resolve => setTimeout(resolve, waitTime));

				// Check if server is running
				if (!Zotero.Server.port) {
					throw new Error("Failed to start Zotero HTTP server");
				}

				// Register our endpoints
				this.registerEndpoint();

				// Set server URL
				this.serverUrl = `http://localhost:${Zotero.Server.port}`;
				this.isRunning = true;

				console.log("✅ DeepTutor: Server integration started successfully");
				console.log("🌐 Server URL:", this.serverUrl);
				console.log("🔐 OAuth Redirect URI:", this.getOAuthRedirectUri());


				// Start health monitoring (optional, won't fail if not available)
				try {
					this._startHealthMonitoring();
				} catch (error) {
					console.warn("⚠️ DeepTutor: Health monitoring failed to start, but server is running:", error.message);
				}

				return true;
			}
			catch (error) {
				retryCount++;
				console.error(`❌ DeepTutor: Server start attempt ${retryCount} failed:`, error.message);
				
				if (retryCount >= this._maxRetries) {
					console.error("❌ DeepTutor: Failed to start server integration after all retries");
					return false;
				}
				
				// Wait before retrying
				await new Promise(resolve => setTimeout(resolve, this._retryDelay));
			}
		}
		
		return false;
	}

	/**
	 * Starts health monitoring for the server
	 * @private
	 */
	_startHealthMonitoring() {
		// Check if setInterval and clearInterval are available
		if (typeof setInterval === "undefined" || typeof clearInterval === "undefined") {
			console.warn("⚠️ DeepTutor: setInterval/clearInterval not available, skipping health monitoring");
			return;
		}
		
		if (this._healthCheckInterval) {
			clearInterval(this._healthCheckInterval);
		}
		
		this._healthCheckInterval = setInterval(() => {
			if (!this.isServerRunning()) {
				console.warn("⚠️ DeepTutor: Server appears to have stopped, attempting restart...");
				this._attemptServerRestart();
			}
		}, this._healthCheckInterval);
	}

	/**
	 * Attempts to restart the server if it has stopped
	 * @private
	 */
	async _attemptServerRestart() {
		try {
			console.log("🔄 DeepTutor: Attempting server restart...");
			await this.stop();
			await new Promise(resolve => setTimeout(resolve, 1000));
			await this.start();
		}
		catch (error) {
			console.error("❌ DeepTutor: Failed to restart server:", error.message);
		}
	}

	/**
	 * Gets OAuth configuration information for external services
	 * @returns {Object} OAuth configuration details
	 */
	getOAuthConfig() {
		const baseUrl = this.getServerUrl();
		return {
			redirectUri: `${baseUrl}/deeptutor/oauth-callback`,
			statusUri: `${baseUrl}/deeptutor/oauth-status`,
			healthUri: `${baseUrl}/deeptutor/health`,
			serverPort: Zotero.Server?.port || this.port,
			isRunning: this.isRunning,
			oauthEnabled: this.googleOAuthEnabled
		};
	}

	/**
	 * Validates OAuth redirect URI configuration
	 * @returns {Object} Validation result
	 */
	validateOAuthConfig() {
		try {
			const config = this.getOAuthConfig();
			const issues = [];

			// Check if server is running
			if (!config.isRunning) {
				issues.push("Server is not running");
			}

			// Check if OAuth endpoint is enabled
			if (!config.oauthEnabled) {
				issues.push("OAuth endpoint is not enabled");
			}

			// Check if redirect URI is properly formatted
			if (!config.redirectUri || !config.redirectUri.startsWith("http://localhost:")) {
				issues.push("Invalid redirect URI format");
			}

			// Check if port is valid
			if (!config.serverPort || config.serverPort <= 0) {
				issues.push("Invalid server port");
			}

			return {
				valid: issues.length === 0,
				issues: issues,
				config: config
			};
		}
		catch (error) {
			return {
				valid: false,
				issues: [`Configuration validation error: ${error.message}`],
				config: null
			};
		}
	}

	/**
	 * Exports OAuth configuration for external use
	 * @returns {string} JSON string of OAuth configuration
	 */
	exportOAuthConfig() {
		try {
			const config = this.getOAuthConfig();
			return JSON.stringify(config, null, 2);
		}
		catch (error) {
			console.error("❌ DeepTutor: Failed to export OAuth config:", error.message);
			return JSON.stringify({ error: error.message });
		}
	}

	/**
	 * Registers the DeepTutor endpoints with Zotero's HTTP server
	 */
	registerEndpoint() {
		if (this.endpointRegistered) {
			return;
		}

		// Check if Zotero.Server.Endpoints exists
		if (!Zotero.Server.Endpoints) {
			console.error("❌ DeepTutor: Zotero.Server.Endpoints not available");
			return;
		}



		// Register sendText endpoint
		Zotero.Server.Connector.DeepTutorSendText = function () {};
		Zotero.Server.Endpoints["/deeptutor/sendText"] = Zotero.Server.Connector.DeepTutorSendText;
		Zotero.Server.Connector.DeepTutorSendText.prototype = {
			supportedMethods: ["POST", "OPTIONS"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: true,
			
			init: function (request) {
				if (request.method !== "POST") {
					return [405, "text/plain", "Method not allowed"];
				}

				try {
					const data = request.data;
					if (!data || !data.text) {
						return [400, "application/json", JSON.stringify({
							error: "Missing 'text' field in request body"
						})];
					}

					const text = data.text;
					
					// Display popup with the text
					this.displayPopup(text);

					return [200, "application/json", JSON.stringify({
						success: true,
						message: "Text received and popup displayed",
						receivedText: text
					})];
				}
				catch (error) {
					console.error("❌ DeepTutor: Error processing sendText request:", error.message);
					return [500, "application/json", JSON.stringify({
						error: "Internal server error"
					})];
				}
			},
			
			displayPopup: function (text) {
				try {
					// Create popup content
					const popupContent = `
						<div style="
							position: fixed;
							top: 50%;
							left: 50%;
							transform: translate(-50%, -50%);
							background: white;
							border: 2px solid #0687E5;
							border-radius: 10px;
							padding: 20px;
							box-shadow: 0 4px 20px rgba(0,0,0,0.3);
							z-index: 10000;
							max-width: 400px;
							max-height: 300px;
							overflow: auto;
							font-family: Arial, sans-serif;
						">
							<div style="
								display: flex;
								justify-content: space-between;
								align-items: center;
								margin-bottom: 15px;
								border-bottom: 1px solid #eee;
								padding-bottom: 10px;
							">
								<h3 style="
									margin: 0;
									color: #0687E5;
									font-size: 18px;
								">DeepTutor Message</h3>
								<button onclick="this.parentElement.parentElement.remove()" style="
									background: none;
									border: none;
									font-size: 20px;
									cursor: pointer;
									color: #999;
									padding: 0;
									width: 25px;
									height: 25px;
									display: flex;
									align-items: center;
									justify-content: center;
								">×</button>
							</div>
							<div style="
								color: #333;
								line-height: 1.5;
								white-space: pre-wrap;
								word-wrap: break-word;
							">${this.escapeHtml(text)}</div>
							<div style="
								text-align: center;
								margin-top: 15px;
								padding-top: 10px;
								border-top: 1px solid #eee;
							">
								<button onclick="this.parentElement.parentElement.remove()" style="
									background: #0894F0;
									color: white;
									border: none;
									padding: 8px 16px;
									border-radius: 5px;
									cursor: pointer;
									font-size: 14px;
									transition: background 0.2s;
								" onmouseover="this.style.background='#0687E5'" onmouseout="this.style.background='#0894F0'">Close</button>
							</div>
						</div>
					`;

					// Create and append popup element
					const popupElement = document.createElement("div");
					popupElement.innerHTML = popupContent;
					document.body.appendChild(popupElement.firstElementChild);

					// Auto-remove popup after 10 seconds
					setTimeout(() => {
						if (popupElement.firstElementChild && popupElement.firstElementChild.parentNode) {
							popupElement.firstElementChild.remove();
						}
					}, 10000);
				}
				catch {
					// Fallback: use Zotero alert
					try {
						Zotero.alert(null, "DeepTutor Message", text);
					}
					catch {

						// Silent fallback
					}
				}
			},
			
			escapeHtml: function (text) {
				const div = document.createElement("div");
				div.textContent = text;
				return div.innerHTML;
			}
		};

		// Register googleOauthCode endpoint (legacy compatibility)
		Zotero.Server.Connector.DeepTutorGoogleOauthCode = function () {};
		Zotero.Server.Endpoints["/deeptutor/googleOauthCode"] = Zotero.Server.Connector.DeepTutorGoogleOauthCode;
		Zotero.Server.Connector.DeepTutorGoogleOauthCode.prototype = {
			server: this,
			supportedMethods: ["POST", "OPTIONS"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: true,
			
			init: async function (request) {
				if (request.method !== "POST") {
					return [405, "text/plain", "Method not allowed"];
				}

				// Check if Google OAuth endpoint is enabled
				if (!this.server || !this.server.googleOAuthEnabled) {
					return [403, "application/json", JSON.stringify({
						error: "Google OAuth endpoint is not available. Please start the Google sign-in process first."
					})];
				}

				try {
					const data = request.data;
					// Accept both 'code' and 'oauthCode' field names for flexibility
					const oauthCode = data?.oauthCode || data?.code;
					
					if (!oauthCode) {
						return [400, "application/json", JSON.stringify({
							error: "Missing 'code' or 'oauthCode' field in request body"
						})];
					}

					// Process the OAuth code for authentication
					const authResult = await this.server.handleOAuthCode(oauthCode);

					if (authResult.success) {
						// Close sign-in popup if it exists in the global DeepTutor instance
						if (typeof window !== "undefined" && window.deepTutorInstance) {
							try {
								window.deepTutorInstance.setState({ showSignInPopup: false });
								console.log("🔐 DeepTutor: Sign-in popup closed after successful Google authentication");
							}
							catch (error) {
								console.warn("⚠️ DeepTutor: Could not close sign-in popup:", error.message);
							}
						}
						
						return [200, "application/json", JSON.stringify({
							success: true,
							message: "OAuth authentication successful",
							user: {
								email: authResult.user.username,
								name: authResult.user.attributes.name
							}
						})];
					}
					else {
						console.error("❌ DeepTutor: OAuth authentication failed:", authResult.error);
						
						// Display error popup
						this.displayAuthErrorPopup(authResult.error);

						return [400, "application/json", JSON.stringify({
							success: false,
							error: authResult.error
						})];
					}
				}
				catch (error) {
					console.error("❌ DeepTutor: Error processing googleOauthCode request:", error.message);
					return [500, "application/json", JSON.stringify({
						error: "Internal server error"
					})];
				}
			},
			
			displayAuthSuccessPopup: function (user) {
				try {
					// Check if we're in a DOM environment
					if (typeof document === "undefined" || !document.body) {
						console.log("🔐 DeepTutor: No DOM available, using Zotero alert for success");
						if (typeof Zotero !== "undefined") {
							Zotero.alert(null, "Google Sign-In Success",
								`Successfully signed in as: ${user.username}\nName: ${user.attributes.name}`);
						}
						return;
					}

					const popupContent = `
						<div style="
							position: fixed;
							top: 50%;
							left: 50%;
							transform: translate(-50%, -50%);
							background: white;
							border: 2px solid #4285F4;
							border-radius: 10px;
							padding: 20px;
							box-shadow: 0 4px 20px rgba(0,0,0,0.3);
							z-index: 10000;
							max-width: 400px;
							max-height: 300px;
							overflow: auto;
							font-family: Arial, sans-serif;
						">
							<div style="
								display: flex;
								justify-content: space-between;
								align-items: center;
								margin-bottom: 15px;
								border-bottom: 1px solid #eee;
								padding-bottom: 10px;
							">
								<h3 style="
									margin: 0;
									color: #4285F4;
									font-size: 18px;
								">Google Sign-In Success</h3>
								<button onclick="this.parentElement.parentElement.remove()" style="
									background: none;
									border: none;
									font-size: 20px;
									cursor: pointer;
									color: #999;
									padding: 0;
									width: 25px;
									height: 25px;
									display: flex;
									align-items: center;
									justify-content: center;
								">×</button>
							</div>
							<div style="
								color: #333;
								line-height: 1.5;
								white-space: pre-wrap;
								word-wrap: break-word;
								font-family: monospace;
								background: #f5f5f5;
								padding: 10px;
								border-radius: 5px;
								border: 1px solid #ddd;
							">
								Signed in as: <b>${user.username}</b><br/>
								Name: ${user.attributes.name}
							</div>
							<div style="
								text-align: center;
								margin-top: 15px;
								padding-top: 10px;
								border-top: 1px solid #eee;
							">
								<button onclick="this.parentElement.parentElement.remove()" style="
									background: #4285F4;
									color: white;
									border: none;
									padding: 8px 16px;
									border-radius: 5px;
									cursor: pointer;
									font-size: 14px;
								">Close</button>
							</div>
						</div>
					`;

					const popupElement = document.createElement("div");
					popupElement.innerHTML = popupContent;
					document.body.appendChild(popupElement.firstElementChild);

					setTimeout(() => {
						if (popupElement.firstElementChild && popupElement.firstElementChild.parentNode) {
							popupElement.firstElementChild.remove();
						}
					}, 10000);
				}
				catch (error) {
					console.error("❌ DeepTutor: Error displaying auth success popup:", error.message);
					// Fallback to Zotero alert
					if (typeof Zotero !== "undefined") {
						Zotero.alert(null, "Google Sign-In Success",
							`Successfully signed in as: ${user.username}\nName: ${user.attributes.name}`);
					}
				}
			},

			displayAuthErrorPopup: function (errorMsg) {
				try {
					// Check if we're in a DOM environment
					if (typeof document === "undefined" || !document.body) {
						console.log("🔐 DeepTutor: No DOM available, using Zotero alert for error");
						if (typeof Zotero !== "undefined") {
							Zotero.alert(null, "Google Sign-In Failed", `Error: ${errorMsg}`);
						}
						return;
					}

					// Check if dark mode is active
					const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
					const borderColor = isDarkMode ? '#33A9FF' : '#dc3545';
					const popupContent = `
						<div style="
							position: fixed;
							top: 50%;
							left: 50%;
							transform: translate(-50%, -50%);
							background: ${isDarkMode ? '#1E1E1E' : 'white'};
							border: 1px solid ${borderColor};
							border-radius: 10px;
							padding: 20px;
							box-shadow: 0 4px 20px rgba(0,0,0,0.3);
							z-index: 10000;
							max-width: 400px;
							max-height: 300px;
							overflow: auto;
							font-family: Arial, sans-serif;
						">
							<div style="
								display: flex;
								justify-content: space-between;
								align-items: center;
								margin-bottom: 15px;
								border-bottom: 1px solid #eee;
								padding-bottom: 10px;
							">
								<h3 style="
									margin: 0;
									color: #dc3545;
									font-size: 18px;
								">Google Sign-In Failed</h3>
								<button onclick="this.parentElement.parentElement.remove()" style="
									background: none;
									border: none;
									font-size: 20px;
									cursor: pointer;
									color: #999;
									padding: 0;
									width: 25px;
									height: 25px;
									display: flex;
									align-items: center;
									justify-content: center;
								">×</button>
							</div>
							<div style="
								color: #333;
								line-height: 1.5;
								white-space: pre-wrap;
								word-wrap: break-word;
								font-family: monospace;
								background: #f5f5f5;
								padding: 10px;
								border-radius: 5px;
								border: 1px solid #ddd;
							">
								Error: ${errorMsg}
							</div>
							<div style="
								text-align: center;
								margin-top: 15px;
								padding-top: 10px;
								border-top: 1px solid #eee;
							">
								<button onclick="this.parentElement.parentElement.remove()" style="
									background: #dc3545;
									color: white;
									border: none;
									padding: 8px 16px;
									border-radius: 5px;
									cursor: pointer;
									font-size: 14px;
								">Close</button>
							</div>
						</div>
					`;

					const popupElement = document.createElement("div");
					popupElement.innerHTML = popupContent;
					document.body.appendChild(popupElement.firstElementChild);

					setTimeout(() => {
						if (popupElement.firstElementChild && popupElement.firstElementChild.parentNode) {
							popupElement.firstElementChild.remove();
						}
					}, 10000);
				}
				catch (error) {
					console.error("❌ DeepTutor: Error displaying auth error popup:", error.message);
					// Fallback to Zotero alert
					if (typeof Zotero !== "undefined") {
						Zotero.alert(null, "Google Sign-In Failed", `Error: ${errorMsg}`);
					}
				}
			},
			
			escapeHtml: function (text) {
				const div = document.createElement("div");
				div.textContent = text;
				return div.innerHTML;
			}
		};

		// Register OAuth callback endpoint for desktop localhost flow
		Zotero.Server.Connector.DeepTutorOAuthCallback = function () {};
		Zotero.Server.Endpoints["/deeptutor/oauth-callback"] = Zotero.Server.Connector.DeepTutorOAuthCallback;
		Zotero.Server.Connector.DeepTutorOAuthCallback.prototype = {
			server: this,
			supportedMethods: ["GET"],
			permitBookmarklet: true,
			init: async function (request) {
				try {
					// Require that Google OAuth flow has been initiated
					if (!this.server || !this.server.googleOAuthEnabled) {
						return [403, "text/html", this._renderHtmlPage("Google sign-in is not active. Please try again from the app.")];
					}

					const code = request.searchParams.get("code");
					const state = request.searchParams.get("state");
					const err = request.searchParams.get("error");

					if (err) {
						this.server._lastOAuthResult = { completed: true, success: false, error: err };
						return [400, "text/html", this._renderHtmlPage(`Sign-in failed: ${this._escapeHtml(err)}`)];
					}

					if (!code || !state) {
						return [400, "text/html", this._renderHtmlPage("Missing OAuth parameters.")];
					}

					// Validate state for CSRF protection
					if (!this.server.oauthState || state !== this.server.oauthState) {
						return [400, "text/html", this._renderHtmlPage("Invalid OAuth state. Please retry sign-in from the app.")];
					}

					// Exchange code for tokens and complete auth
					const authResult = await this.server.handleOAuthCode(code);
					if (authResult.success) {
						this.server._lastOAuthResult = { completed: true, success: true, state: state };
						// Clear state and disable endpoint
						this.server.oauthState = null;
						this.server.disableGoogleOAuth();
						return [200, "text/html", this._renderHtmlPage("Google sign-in complete.")];
					}
					else {
						this.server._lastOAuthResult = { completed: true, success: false, error: authResult.error, state: state };
						return [400, "text/html", this._renderHtmlPage(`Sign-in failed: ${this._escapeHtml(authResult.error)}`)];
					}
				}
				catch (e) {
					console.error("❌ DeepTutor: Unexpected error in OAuth callback:", e.message);
					return [500, "text/html", this._renderHtmlPage(`Unexpected error: ${this._escapeHtml(e.message)}`)];
				}
			},
			_renderHtmlPage: function (message) {
				return (
					"<html><head><meta charset=\"utf-8\"/>"
					+ "<title>DeepTutor Sign-In</title>"
					+ "<style>body{font-family:Arial,Helvetica,sans-serif;margin:40px;color:#333}"
					+ ".card{border:1px solid #ddd;border-radius:8px;padding:20px;max-width:520px}"
					+ ".title{color:#0687E5;margin-top:0}"
					+ ".hint{color:#666;font-size:13px;margin-top:10px}</style>"
					+ "</head><body>"
					+ "<div class=\"card\">"
					+ "<h2 class=\"title\">DeepTutor Google Sign-In</h2>"
					+ `<div>${this._escapeHtml(String(message))}</div>`
					+ "<div class=\"hint\">You can now close this tab safely.</div>"
					+ "</div>"
					+ "</body></html>"
				);
			},
			_escapeHtml: function (text) {
				const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
				return String(text).replace(/[&<>"']/g, m => map[m] || m);
			}
		};

		// Register OAuth status endpoint for optional polling
		Zotero.Server.Connector.DeepTutorOAuthStatus = function () {};
		Zotero.Server.Endpoints["/deeptutor/oauth-status"] = Zotero.Server.Connector.DeepTutorOAuthStatus;
		Zotero.Server.Connector.DeepTutorOAuthStatus.prototype = {
			server: this,
			supportedMethods: ["GET"],
			permitBookmarklet: true,
			init: function (_request) {
				const payload = this.server && this.server._lastOAuthResult ? this.server._lastOAuthResult : { completed: false };
				return [200, "application/json", JSON.stringify(payload)];
			}
		};

		// Register health endpoint
		Zotero.Server.Connector.DeepTutorHealth = function () {};
		Zotero.Server.Endpoints["/deeptutor/health"] = Zotero.Server.Connector.DeepTutorHealth;
		Zotero.Server.Connector.DeepTutorHealth.prototype = {
			server: this,
			supportedMethods: ["GET", "OPTIONS"],
			permitBookmarklet: true,
			
			init: function (_request) {
				const healthData = {
					status: "healthy",
					server: "DeepTutor Integration with Zotero HTTP Server",
					port: Zotero.Server.port,
					timestamp: new Date().toISOString(),
					endpoints: Object.keys(Zotero.Server.Endpoints).filter(key => key.startsWith('/deeptutor/')),
					oauth: {
						enabled: this.server ? this.server.googleOAuthEnabled : false,
						redirectUri: this.server ? this.server.getOAuthRedirectUri() : "N/A",
						statusUri: this.server ? this.server.getOAuthStatusUri() : "N/A"
					}
				};

				return [200, "application/json", JSON.stringify(healthData)];
			}
		};

		// Register OAuth configuration endpoint
		Zotero.Server.Connector.DeepTutorOAuthConfig = function () {};
		Zotero.Server.Endpoints["/deeptutor/oauth-config"] = Zotero.Server.Connector.DeepTutorOAuthConfig;
		Zotero.Server.Connector.DeepTutorOAuthConfig.prototype = {
			server: this,
			supportedMethods: ["GET", "OPTIONS"],
			permitBookmarklet: true,
			
			init: function (_request) {
				try {
					if (!this.server) {
						return [500, "application/json", JSON.stringify({
							error: "DeepTutor server instance not available"
						})];
					}
					
					const config = this.server.getOAuthConfig();
					const validation = this.server.validateOAuthConfig();
					
					const responseData = {
						...config,
						validation: validation,
						timestamp: new Date().toISOString(),
						instructions: {
							redirectUri: "Use this URI as the redirect_uri in your OAuth application configuration",
							statusUri: "Poll this endpoint to check OAuth flow status",
							healthUri: "Use this endpoint to verify server health"
						}
					};

					return [200, "application/json", JSON.stringify(responseData)];
				}
				catch (error) {
					console.error("❌ DeepTutor: Error in OAuth config endpoint:", error.message);
					return [500, "application/json", JSON.stringify({
						error: "Failed to retrieve OAuth configuration",
						details: error.message
					})];
				}
			}
		};

		// Register server info endpoint
		Zotero.Server.Connector.DeepTutorServerInfo = function () {};
		Zotero.Server.Endpoints["/deeptutor/server-info"] = Zotero.Server.Connector.DeepTutorServerInfo;
		Zotero.Server.Connector.DeepTutorServerInfo.prototype = {
			server: this,
			supportedMethods: ["GET", "OPTIONS"],
			permitBookmarklet: true,
			
			init: function (_request) {
				try {
					if (!this.server) {
						return [500, "application/json", JSON.stringify({
							error: "DeepTutor server instance not available"
						})];
					}
					
					const serverInfo = {
						zoteroVersion: Zotero.version || "Unknown",
						serverPort: Zotero.Server?.port || "Unknown",
						serverEnabled: !!Zotero.Server?.port,
						deeptutorServer: {
							isRunning: this.server.isRunning,
							serverUrl: this.server.serverUrl,
							endpointsRegistered: this.server.endpointRegistered,
							oauthEnabled: this.server.googleOAuthEnabled
						},
						availableEndpoints: this.server.getDeepTutorEndpoints(),
						timestamp: new Date().toISOString()
					};

					return [200, "application/json", JSON.stringify(serverInfo)];
				}
				catch (error) {
					console.error("❌ DeepTutor: Error in server info endpoint:", error.message);
					return [500, "application/json", JSON.stringify({
						error: "Failed to retrieve server information",
						details: error.message
					})];
				}
			}
		};

		this.endpointRegistered = true;
	}

	/**
	 * Stops the DeepTutor server integration
	 * @returns {Promise<boolean>} - Returns true if integration stopped successfully
	 */
	async stop() {
		try {
			// Clear health monitoring interval if available
			if (this._healthCheckInterval && typeof clearInterval !== "undefined") {
				clearInterval(this._healthCheckInterval);
				this._healthCheckInterval = null;
			}
			
			// Remove our endpoints
			if (this.endpointRegistered) {
				delete Zotero.Server.Endpoints["/deeptutor/sendText"];
				delete Zotero.Server.Endpoints["/deeptutor/googleOauthCode"];
				delete Zotero.Server.Endpoints["/deeptutor/oauth-callback"];
				delete Zotero.Server.Endpoints["/deeptutor/oauth-status"];
				delete Zotero.Server.Endpoints["/deeptutor/health"];
				delete Zotero.Server.Endpoints["/deeptutor/oauth-config"];
				delete Zotero.Server.Endpoints["/deeptutor/server-info"];
				this.endpointRegistered = false;
			}

			this.isRunning = false;
			this.serverUrl = null;

			return true;
		}
		catch (error) {
			console.error(`DeepTutor: Error stopping server integration: ${error.message}`);
			return false;
		}
	}

	/**
	 * Gets the server URL
	 * @returns {string} - The server URL
	 */
	getServerUrl() {
		return this.serverUrl || `http://localhost:${Zotero.Server?.port || this.port}`;
	}

	/**
	 * Checks if the server integration is running
	 * @returns {boolean} - True if integration is running
	 */
	isServerRunning() {
		return this.isRunning && !!Zotero.Server?.port;
	}

	/**
	 * Provides a method to send text via the API (for testing)
	 * @param {string} text - The text to send
	 * @returns {Promise<Object>} - The response from the server
	 */
	async sendText(text) {
		try {
			if (!this.isRunning) {
				throw new Error("Server integration not running");
			}

			const response = await fetch(`${this.getServerUrl()}/deeptutor/sendText`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ text })
			});

			return await response.json();
		}
		catch (error) {
			console.error(`DeepTutor: Error sending text via API: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Provides a method to send OAuth code via the API (for testing)
	 * @param {string} code - The OAuth code to send
	 * @returns {Promise<Object>} - The response from the server
	 */
	async sendOAuthCode(code) {
		try {
			if (!this.isRunning) {
				throw new Error("Server integration not running");
			}

			const response = await fetch(`${this.getServerUrl()}/deeptutor/googleOauthCode`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ code })
			});

			return await response.json();
		}
		catch (error) {
			console.error(`DeepTutor: Error sending OAuth code via API: ${error.message}`);
			throw error;
		}
	}







	/**
	 * Gets a list of all available endpoints
	 * @returns {Array<string>} - Array of endpoint paths
	 */
	getAvailableEndpoints() {
		if (!Zotero.Server || !Zotero.Server.Endpoints) {
			return [];
		}
		return Object.keys(Zotero.Server.Endpoints);
	}

	/**
	 * Gets DeepTutor-specific endpoints
	 * @returns {Array<string>} - Array of DeepTutor endpoint paths
	 */
	getDeepTutorEndpoints() {
		if (!Zotero.Server || !Zotero.Server.Endpoints) {
			return [];
		}
		return Object.keys(Zotero.Server.Endpoints).filter(key => key.startsWith('/deeptutor/'));
	}
}

// Export the server class
if (typeof module !== "undefined" && module.exports) {
	module.exports = DeepTutorLocalhostServer;
}
else if (typeof window !== "undefined") {
	window.DeepTutorLocalhostServer = DeepTutorLocalhostServer;
}
