import React from 'react';
import PropTypes from 'prop-types';

const styles = {
    divider: {
        width: 'calc(100% - 2.5rem)',
        height: '0.0625rem',
        background: '#D9D9D9',
        margin: '0 1.25rem',
    },
    bottom: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem 1.25rem 1.25rem',
        background: '#F2F2F2',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        bottom: 0,
        left: 0,
        right: 0,
        margin: 0,
        zIndex: 1,
    },
    contentWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        gap: '0.3125rem',
    },
    bottomLeft: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.3125rem',
        width: '100%',
    },
    feedbackBox: {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        marginBottom: '0.3125rem',
    },
    buttonsBox: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    textButton: {
        background: '#F2F2F2',
        border: 'none',
        color: '#292929',
        fontWeight: 500,
        fontSize: '1rem',
        lineHeight: '100%',
        letterSpacing: '0%',
        fontFamily: 'Roboto, sans-serif',
        cursor: 'pointer',
        padding: '0.5rem 1rem',
        margin: 0,
        borderRadius: '0.25rem',
        width: 'fit-content',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'background-color 0.2s ease',
        textDecoration: 'underline',
        ':hover': {
            background: '#D9D9D9'
        }
    },
    buttonIcon: {
        width: '1.1rem',
        height: '1.1rem',
        objectFit: 'contain',
    },
    upgradeButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '7rem',
        height: '2.65rem',
        padding: '0.625rem 1.25rem',
        background: '#0687E5',
        border: 'none',
        borderRadius: '0.625rem',
        fontWeight: 500,
        fontSize: '1rem',
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
    profileInfo: {
        padding: '0.5rem 0',
        borderBottom: '0.0625rem solid #e9ecef',
        marginBottom: '0.5rem',
    },
    userEmail: {
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#333',
        marginBottom: '0.25rem',
    },
    userStatus: {
        fontSize: '0.75rem',
        color: '#666',
    },
    signOutButton: {
        background: '#dc3545',
        color: '#fff',
        border: 'none',
        borderRadius: '0.25rem',
        padding: '0.375rem 0.75rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
        width: '100%',
        marginTop: '0.5rem',
        transition: 'background 0.2s',
        ':hover': {
            background: '#c82333'
        }
    },
};

class DeepTutorBottomSection extends React.Component {
    getComponentButtonStyle(isActive) {
        return {
            ...styles.componentButton,
            ...(isActive ? styles.componentButtonActive : {})
        };
    }

    renderProfilePopup() {
        if (!this.props.showProfilePopup) return null;

        return (
            <div style={styles.profilePopup}>
                {this.props.isAuthenticated && this.props.currentUser ? (
                    <>
                        <div style={styles.profileInfo}>
                            <div style={styles.userEmail}>
                                {this.props.currentUser.username || 'User'}
                            </div>
                            <div style={styles.userStatus}>Logged in</div>
                        </div>
                        <button 
                            style={styles.signOutButton}
                            onClick={this.props.onSignOut}
                        >
                            Sign out
                        </button>
                    </>
                ) : (
                    <div style={styles.profileInfo}>
                        <div style={styles.userStatus}>Not logged in</div>
                        <button 
                            style={{...styles.componentButton, marginTop: '8px'}}
                            onClick={this.props.onToggleSignInPopup}
                        >
                            Sign in
                        </button>
                    </div>
                )}
            </div>
        );
    }

    renderMain() {
        return (
            <div style={styles.contentWrapper}>
                <div style={styles.divider} />
                <div style={styles.bottomLeft}>
                    <div style={styles.feedbackBox}>
                        <button 
                            style={styles.textButton}
                            onClick={() => {
                                Zotero.debug("DeepTutor: Feedback button clicked");
                                const url = 'https://docs.google.com/forms/d/e/1FAIpQLSdOZgoMsM4Th2nAAMv8CvhA2TsqTqWq_psQpdfuadoiVsus6g/viewform';
                                Zotero.debug(`DeepTutor: Attempting to open feedback URL: ${url}`);
                                
                                try {
                                    // Primary: Use Zotero's proper API for opening external URLs
                                    Zotero.debug("DeepTutor: Trying primary method - Zotero.launchURL");
                                    Zotero.launchURL(url);
                                    Zotero.debug("DeepTutor: Successfully called Zotero.launchURL");
                                } catch (error) {
                                    Zotero.debug(`DeepTutor: Primary method failed - Zotero.launchURL: ${error.message}`);
                                    
                                    // Fallback 1: Try Zotero.Utilities.Internal.launchURL
                                    try {
                                        if (Zotero.Utilities && Zotero.Utilities.Internal && Zotero.Utilities.Internal.launchURL) {
                                            Zotero.debug("DeepTutor: Trying Fallback 1 - Zotero.Utilities.Internal.launchURL");
                                            Zotero.Utilities.Internal.launchURL(url);
                                            Zotero.debug("DeepTutor: Successfully called Zotero.Utilities.Internal.launchURL");
                                        } else {
                                            throw new Error("Zotero.Utilities.Internal.launchURL not available");
                                        }
                                    } catch (fallback1Error) {
                                        Zotero.debug(`DeepTutor: Fallback 1 failed - Zotero.Utilities.Internal.launchURL: ${fallback1Error.message}`);
                                        
                                        // Fallback 2: Try Zotero.HTTP.loadDocuments
                                        try {
                                            if (Zotero.HTTP && Zotero.HTTP.loadDocuments) {
                                                Zotero.debug("DeepTutor: Trying Fallback 2 - Zotero.HTTP.loadDocuments");
                                                Zotero.HTTP.loadDocuments([url]);
                                                Zotero.debug("DeepTutor: Successfully called Zotero.HTTP.loadDocuments");
                                            } else {
                                                throw new Error("Zotero.HTTP.loadDocuments not available");
                                            }
                                        } catch (fallback2Error) {
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
                                                } else {
                                                    throw new Error("XPCOM Cc/Ci shortcuts not available");
                                                }
                                            } catch (fallback3Error) {
                                                Zotero.debug(`DeepTutor: Fallback 3 failed - XPCOM nsIExternalProtocolService: ${fallback3Error.message}`);
                                                
                                                // Final fallback: Copy URL to clipboard
                                                if (navigator.clipboard) {
                                                    Zotero.debug("DeepTutor: Trying final fallback - copy URL to clipboard");
                                                    navigator.clipboard.writeText(url)
                                                        .then(() => {
                                                            Zotero.debug("DeepTutor: Successfully copied feedback URL to clipboard");
                                                            Zotero.alert(null, "DeepTutor", 'Feedback form URL copied to clipboard!\nPlease paste it in your browser to access the form.');
                                                        })
                                                        .catch((clipboardError) => {
                                                            Zotero.debug(`DeepTutor: Failed to copy to clipboard: ${clipboardError.message}`);
                                                            Zotero.alert(null, "DeepTutor", `Please manually visit this URL:\n${url}`);
                                                        });
                                                } else {
                                                    Zotero.debug("DeepTutor: Clipboard API not available, showing alert with URL");
                                                    Zotero.alert(null, "DeepTutor", `Please manually visit this URL:\n${url}`);
                                                }
                                            }
                                        }
                                    }
                                }
                            }}
                        >
                            <img src={this.props.feedIconPath} alt="Give Us Feedback" style={styles.buttonIcon} />
                            Give Us Feedback
                        </button>
                    </div>
                    <div style={styles.buttonsBox}>
                        <div style={styles.profileButtonContainer}>
                            <button style={styles.textButton} onClick={this.props.onToggleProfilePopup}>
                                <img src={this.props.personIconPath} alt="Profile" style={styles.buttonIcon} />
                                Profile
                            </button>
                            {this.renderProfilePopup()}
                        </div>
                        <button style={styles.upgradeButton} onClick={this.props.onToggleUpgradePopup}>Upgrade</button>
                    </div>
                </div>
            </div>
        );
    }

    renderWelcome() {
        return (
            <div style={styles.contentWrapper}>
            </div>
        );
    }

    renderSessionHistory() {
        return this.renderMain();
    }

    render() {
        let content;
        if (this.props.currentPane === 'welcome') {
            content = this.renderWelcome();
        } else if (this.props.currentPane === 'main') {
            content = this.renderMain();
        } else if (this.props.currentPane === 'sessionHistory') {
            content = this.renderSessionHistory();
        } else {
            content = this.renderMain();
        }
        return (
            <div style={styles.bottom}>
                {content}
            </div>
        );
    }
}

DeepTutorBottomSection.propTypes = {
    currentPane: PropTypes.string.isRequired,
    onSwitchPane: PropTypes.func.isRequired,
    onToggleProfilePopup: PropTypes.func.isRequired,
    onToggleSignInPopup: PropTypes.func.isRequired,
    onToggleSignUpPopup: PropTypes.func.isRequired,
    onToggleUpgradePopup: PropTypes.func.isRequired,
    showProfilePopup: PropTypes.bool.isRequired,
    feedIconPath: PropTypes.string.isRequired,
    personIconPath: PropTypes.string.isRequired,
    isAuthenticated: PropTypes.bool,
    currentUser: PropTypes.object,
    onSignOut: PropTypes.func,
};

DeepTutorBottomSection.defaultProps = {
    isAuthenticated: false,
    currentUser: null,
    onSignOut: () => {},
};

export default DeepTutorBottomSection; 