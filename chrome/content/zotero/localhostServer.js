/**
 * DeepTutor Localhost Server Integration
 *
 * This module integrates with Zotero's existing HTTP server infrastructure
 * to provide a "sendText" endpoint that displays popups when called.
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

import { DT_BASE_URL } from './api/libs/api.js';

/**
 * DeepTutor Localhost Server Class
 *
 * Integrates with Zotero's existing HTTP server to provide text messaging functionality.
 */
class DeepTutorLocalhostServer {

	/**
	 * Constructor for the DeepTutor server integration
	 * @param {number} port - The port number (default: 3017, but uses Zotero's server port)
	 */
	constructor(port = 3017) {
		this.port = port;
		this.isRunning = false;
		this.serverUrl = null;
		this.endpointRegistered = false;
		this.googleOAuthEnabled = false; // Flag to control Google OAuth endpoint availability
	}

	/**
	 * Enables the Google OAuth endpoint (called when Google sign-in popup is shown)
	 */
	enableGoogleOAuth() {
		this.googleOAuthEnabled = true;
	}

	/**
	 * Disables the Google OAuth endpoint (called when Google sign-in popup is closed)
	 */
	disableGoogleOAuth() {
		this.googleOAuthEnabled = false;
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
			const redirectUri = encodeURIComponent(`https://${DT_BASE_URL}/`);
			const scope = encodeURIComponent(amplifyConfig.oauth.scope.join(' '));

			const url = `https://${domain}/oauth2/authorize?`
				+ `identity_provider=Google&`
				+ `redirect_uri=${redirectUri}&`
				+ `response_type=code&`
				+ `client_id=${clientId}&`
				+ `scope=${scope}`;

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
						Zotero.alert(null, "DeepTutor", "Google sign-in URL copied to clipboard!\nPlease paste it in your browser to access the sign-in page.");
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
	 * Starts the DeepTutor server integration
	 * @returns {Promise<boolean>} - Returns true if integration started successfully
	 */
	async start() {
		try {
			// Check if Zotero.Server is available
			if (typeof Zotero === "undefined" || !Zotero.Server) {
				console.error("❌ DeepTutor: Zotero.Server not available");
				return false;
			}

			// Initialize Zotero's HTTP server if not already running
			if (!Zotero.Server.port) {
				Zotero.Server.init(this.port);
			}

			// Wait a moment for server to start
			await new Promise(resolve => setTimeout(resolve, 100));

			// Check if server is running
			if (!Zotero.Server.port) {
				console.error("❌ DeepTutor: Failed to start Zotero HTTP server");
				return false;
			}

			// Register our endpoint
			this.registerEndpoint();

			// Set server URL
			this.serverUrl = `http://localhost:${Zotero.Server.port}`;
			this.isRunning = true;

			return true;
		}
		catch (error) {
			console.error("❌ DeepTutor: Failed to start server integration:", error.message);
			return false;
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
				catch (error) {
					// Fallback: use Zotero alert
					try {
						Zotero.alert(null, "DeepTutor Message", text);
					}
					catch (alertError) {
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

		// Register googleOauthCode endpoint
		Zotero.Server.Connector.DeepTutorGoogleOauthCode = function () {};
		Zotero.Server.Endpoints["/deeptutor/googleOauthCode"] = Zotero.Server.Connector.DeepTutorGoogleOauthCode;
		Zotero.Server.Connector.DeepTutorGoogleOauthCode.prototype = {
			server: this, // Reference to the server instance
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

		// Register health endpoint
		Zotero.Server.Connector.DeepTutorHealth = function () {};
		Zotero.Server.Endpoints["/deeptutor/health"] = Zotero.Server.Connector.DeepTutorHealth;
		Zotero.Server.Connector.DeepTutorHealth.prototype = {
			supportedMethods: ["GET", "OPTIONS"],
			permitBookmarklet: true,
			
			init: function (_request) {
				const healthData = {
					status: "healthy",
					server: "DeepTutor Integration with Zotero HTTP Server",
					port: Zotero.Server.port,
					timestamp: new Date().toISOString(),
					endpoints: Object.keys(Zotero.Server.Endpoints).filter(key => key.startsWith('/deeptutor/'))
				};

				return [200, "application/json", JSON.stringify(healthData)];
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
			// Remove our endpoints
			if (this.endpointRegistered) {
				delete Zotero.Server.Endpoints["/deeptutor/sendText"];
				delete Zotero.Server.Endpoints["/deeptutor/googleOauthCode"];
				delete Zotero.Server.Endpoints["/deeptutor/health"];
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
