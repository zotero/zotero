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

import React from "react";
import PropTypes from "prop-types";
import DeepTutorUpgradePremium from "./DeepTutorUpgradePremium.js";
import DeepTutorSubscriptionConfirm from "./DeepTutorSubscriptionConfirm.js";
import DeepTutorManageSubscription from "./DeepTutorManageSubscription.js";
import DeepTutorProcessingSubscription from "./DeepTutorProcessingSubscription.js";
import { getActiveUserSubscriptionByUserId, DT_BASE_URL } from "./api/libs/api.js";

const PopupClosePath = "chrome://zotero/content/DeepTutorMaterials/Cross.png";
const SubscriptionConfirmBookPath = 'chrome://zotero/content/DeepTutorMaterials/Subscription/SUB_SUCCESS.svg';
const SubscriptionManageMarkPath = 'chrome://zotero/content/DeepTutorMaterials/Subscription/SUB_MANAGEMENT.svg';

/**
 * DeepTutorSubscription component handles subscription-related functionality
 * with conditional display based on user subscription status and free trial status.
 */
class DeepTutorSubscription extends React.Component {
	static propTypes = {
		onUpgradeSuccess: PropTypes.func,
		onManageSubscription: PropTypes.func,
		onCancel: PropTypes.func,
		userId: PropTypes.string,
		userSubscribed: PropTypes.bool,
		toggleSubscriptionPopup: PropTypes.func,
		onSubscriptionStatusChange: PropTypes.func
	};

	static defaultProps = {
		onUpgradeSuccess: () => {},
		onManageSubscription: () => {},
		onCancel: () => {},
		userId: null,
		userSubscribed: false,
		toggleSubscriptionPopup: () => {},
		onSubscriptionStatusChange: () => {}
	};

	constructor(props) {
		super(props);
		this.state = {
			currentPanel: "main", // "main", "confirm", "manage" , "processing"
		};
	}

	/**
	 * Handles upgrade success and shows confirmation panel
	 */
	handleUpgradeSuccess = () => {
		Zotero.launchURL(`https://${DT_BASE_URL}/dzSubscription`);
		this.setState({ currentPanel: "confirm" });
	};

	/**
	 * Handles subscription confirmation close and closes the popup
	 */
	handleSubscriptionConfirmClose = () => {
		// Notify parent component that subscription was confirmed
		this.props.onSubscriptionStatusChange(true);
		this.props.toggleSubscriptionPopup();
	};

	/**
	 * Handles manage subscription action
	 */
	handleManageSubscription = () => {
		this.setState({ currentPanel: "main" });
		Zotero.launchURL(`https://${DT_BASE_URL}/dzSubscription?manage=true`);
		this.props.toggleSubscriptionPopup();
	};

	/**
	 * Handles cancel action
	 */
	handleCancel = () => {
		this.props.toggleSubscriptionPopup();
	};

	/**
	 * Handles back to main panel
	 */
	handleBackToMain = () => {
		this.setState({ currentPanel: "main" });
	};

	handleShowProcessing = () => {
		const url = `https://${DT_BASE_URL}/dzSubscription`;
		
		try {
			// Primary: Use Zotero's proper API for opening external URLs
			Zotero.debug("DeepTutorSubscription: Trying primary method - Zotero.launchURL");
			Zotero.launchURL(url);
			Zotero.debug("DeepTutorSubscription: Successfully called Zotero.launchURL");
		}
		catch (error) {
			Zotero.debug(`DeepTutorSubscription: Primary method failed - Zotero.launchURL: ${error.message}`);
			
			// Fallback 1: Try Zotero.Utilities.Internal.launchURL
			try {
				if (Zotero.Utilities && Zotero.Utilities.Internal && Zotero.Utilities.Internal.launchURL) {
					Zotero.debug("DeepTutorSubscription: Trying Fallback 1 - Zotero.Utilities.Internal.launchURL");
					Zotero.Utilities.Internal.launchURL(url);
					Zotero.debug("DeepTutorSubscription: Successfully called Zotero.Utilities.Internal.launchURL");
				}
				else {
					throw new Error("Zotero.Utilities.Internal.launchURL not available");
				}
			}
			catch (fallback1Error) {
				Zotero.debug(`DeepTutorSubscription: Fallback 1 failed - Zotero.Utilities.Internal.launchURL: ${fallback1Error.message}`);
				
				// Fallback 2: Try Zotero.HTTP.loadDocuments
				try {
					if (Zotero.HTTP && Zotero.HTTP.loadDocuments) {
						Zotero.debug("DeepTutorSubscription: Trying Fallback 2 - Zotero.HTTP.loadDocuments");
						Zotero.HTTP.loadDocuments([url]);
						Zotero.debug("DeepTutorSubscription: Successfully called Zotero.HTTP.loadDocuments");
					}
					else {
						throw new Error("Zotero.HTTP.loadDocuments not available");
					}
				}
				catch (fallback2Error) {
					Zotero.debug(`DeepTutorSubscription: Fallback 2 failed - Zotero.HTTP.loadDocuments: ${fallback2Error.message}`);
					
					// Fallback 3: Try XPCOM nsIExternalProtocolService
					try {
						if (typeof Cc !== 'undefined' && typeof Ci !== 'undefined') {
							Zotero.debug("DeepTutorSubscription: Trying Fallback 3 - XPCOM nsIExternalProtocolService (using Cc/Ci shortcuts)");
							const extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
								.getService(Ci.nsIExternalProtocolService);
							const uri = Cc["@mozilla.org/network/io-service;1"]
								.getService(Ci.nsIIOService)
								.newURI(url, null, null);
							extps.loadURI(uri);
							Zotero.debug("DeepTutorSubscription: Successfully opened URL via XPCOM nsIExternalProtocolService");
						}
						else {
							throw new Error("XPCOM Cc/Ci shortcuts not available");
						}
					}
					catch (fallback3Error) {
						Zotero.debug(`DeepTutorSubscription: Fallback 3 failed - XPCOM nsIExternalProtocolService: ${fallback3Error.message}`);
						
						// Final fallback: Copy URL to clipboard
						if (navigator.clipboard) {
							Zotero.debug("DeepTutorSubscription: Trying final fallback - copy URL to clipboard");
							navigator.clipboard.writeText(url)
								.then(() => {
									Zotero.debug("DeepTutorSubscription: Successfully copied subscription URL to clipboard");
									Zotero.alert(null, "DeepTutor Subscription", 'Subscription URL copied to clipboard!\nPlease paste it in your browser to access the subscription page.');
								})
								.catch((clipboardError) => {
									Zotero.debug(`DeepTutorSubscription: Failed to copy to clipboard: ${clipboardError.message}`);
									Zotero.alert(null, "DeepTutor Subscription", `Please manually visit this URL:\n${url}`);
								});
						}
						else {
							Zotero.debug("DeepTutorSubscription: Clipboard API not available, showing alert with URL");
							Zotero.alert(null, "DeepTutor Subscription", `Please manually visit this URL:\n${url}`);
						}
					}
				}
			}
		}
		
		this.setState({ currentPanel: "processing" });
	};

	/**
	 * Handles processing continue action with subscription status check
	 */
	handleProcessingContinue = async () => {
		try {
			Zotero.debug("DeepTutorSubscription: Checking user subscription status after processing");
			
			// Check if user has active subscription
			const activeSubscription = await getActiveUserSubscriptionByUserId(this.props.userId);
			const hasActiveSubscription = !!activeSubscription;
			
			Zotero.debug(`DeepTutorSubscription: Active subscription check result: ${hasActiveSubscription}`);
			
			// Notify parent component about subscription status change
			this.props.onSubscriptionStatusChange(hasActiveSubscription);
			
			if (hasActiveSubscription) {
				// User has active subscription - proceed to confirmation
				Zotero.debug("DeepTutorSubscription: User has active subscription, showing confirmation");
				this.setState({ currentPanel: "confirm" });
			}
			else {
				// User does not have active subscription - return to main panel
				Zotero.debug("DeepTutorSubscription: User does not have active subscription, returning to main");
				this.setState({ currentPanel: "main" });
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutorSubscription: Error checking subscription status: ${error.message}`);
			
			// On error, return to main panel to allow user to try again
			this.setState({ currentPanel: "main" });
		}
	};

	/**
	 * Renders the header with title and close button
	 * @param {string} title - The header title text
	 * @param {Function} onClose - Function to call when close button is clicked
	 * @returns {JSX.Element} The header component
	 */
	renderHeader(title, onClose) {
		return (
			<div style={{
				display: 'flex',
				width: '100%',
				alignItems: 'center',
				marginBottom: '1.875rem',
				minHeight: '1rem',
				position: 'relative',
			}}>
				<div style={{
					width: '100%',
					textAlign: 'center',
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
					{title}
				</div>
				<button
					onClick={onClose}
					style={{
						background: 'none',
						border: 'none',
						cursor: 'pointer',
						position: 'absolute',
						right: 0,
						top: '50%',
						transform: 'translateY(-50%)',
						width: '1rem',
						height: '1rem',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<img src={PopupClosePath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
				</button>
			</div>
		);
	}

	/**
	 * Renders the main subscription panel based on subscription status
	 * @returns {JSX.Element} The main subscription panel
	 */
	renderMainPanel() {
		const { userSubscribed } = this.props;

		if (userSubscribed) {
			// User is subscribed - show management panel
			return (
				<div>
					{this.renderHeader("Manage Subscription", this.handleCancel)}
					<DeepTutorManageSubscription
						imagePath={SubscriptionManageMarkPath}
						onManage={this.handleManageSubscription}
						onCancel={this.handleCancel}
					/>
				</div>
			);
		}
		else {
			// User is not subscribed and no free trial - show upgrade premium panel
			return (
				<div>
					{this.renderHeader("Upgrade to Premium", this.handleCancel)}
					<DeepTutorUpgradePremium
						onGetPremium={() => this.handleShowProcessing()}
					/>
				</div>
			);
		}
	}

	/**
	 * Renders the subscription confirmation panel
	 * @returns {JSX.Element} The subscription confirmation panel
	 */
	renderConfirmPanel() {
		return (
			<div>
				{this.renderHeader("Upgrade Successfully!", this.handleSubscriptionConfirmClose)}
				<DeepTutorSubscriptionConfirm
					imagePath={SubscriptionConfirmBookPath}
					onClose={this.handleSubscriptionConfirmClose}
				/>
			</div>
		);
	}

	/**
	 * Renders the manage subscription panel
	 * @returns {JSX.Element} The manage subscription panel
	 */
	renderManagePanel() {
		return (
			<div>
				{this.renderHeader("Manage Subscription", this.handleCancel)}
				<DeepTutorManageSubscription
					imagePath={SubscriptionManageMarkPath}
					onManage={this.handleManageSubscription}
					onCancel={this.handleCancel}
				/>
			</div>
		);
	}

	renderProcessingPanel() {
		return (
			<div>
				{this.renderHeader("Processing Subscription", this.handleCancel)}
				<DeepTutorProcessingSubscription
					onContinue={this.handleProcessingContinue}
					onCancel={this.handleCancel}
				/>
			</div>
		);
	}

	render() {
		return (
			<div style={styles.container}>
				{this.state.currentPanel === "main" && this.renderMainPanel()}
				{this.state.currentPanel === "confirm" && this.renderConfirmPanel()}
				{this.state.currentPanel === "manage" && this.renderManagePanel()}
				{this.state.currentPanel === "processing" && this.renderProcessingPanel()}
			</div>
		);
	}
}

const styles = {
	container: {
		padding: "1.5rem",
		maxWidth: "800px",
		margin: "0 auto",
		position: "relative"
	}
};

module.exports = DeepTutorSubscription;
