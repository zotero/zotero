import React from 'react';
import PropTypes from 'prop-types';

const styles = {
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        height: '1.5rem',
        width: '100%',
    },
    buttonsBox: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '1.5rem',
        width: '100%',
    },
    textButton: {
        background: '#F2F2F2',
        border: 'none',
        color: '#0687E5',
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
        ':hover': {
            background: '#D9D9D9'
        }
    },
    buttonIcon: {
        width: '1.1875rem',
        height: '1.1587rem',
        objectFit: 'contain',
    },
    upgradeButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '6.625rem',
        height: '2.4375rem',
        padding: '0.625rem 1.25rem',
        background: '#0687E5',
        border: 'none',
        borderRadius: '0.625rem',
        fontWeight: 600,
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
                <div style={styles.bottomLeft}>
                    <div style={styles.feedbackBox}>
                        <button style={styles.textButton}>
                            <img src={this.props.feedIconPath} alt="Feedback" style={styles.buttonIcon} />
                            Feedback
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