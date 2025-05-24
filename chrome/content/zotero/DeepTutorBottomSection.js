import React from 'react';
import PropTypes from 'prop-types';

const styles = {
    bottom: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 32px 24px 32px',
        background: '#fff',
        borderTop: '1px solid #e9ecef',
        width: '100%',
        boxSizing: 'border-box',
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

class DeepTutorBottomSection extends React.Component {
    getComponentButtonStyle(isActive) {
        return {
            ...styles.componentButton,
            ...(isActive ? styles.componentButtonActive : {})
        };
    }

    renderMain() {
        return (
            <>
                <div style={styles.bottomLeft}>
                    <button style={styles.textButton}>
                        <img src={this.props.feedIconPath} alt="Feedback" style={styles.buttonIcon} />
                        Feedback
                    </button>
                    <button style={styles.textButton} onClick={this.props.onToggleProfilePopup}>
                        <img src={this.props.personIconPath} alt="Profile" style={styles.buttonIcon} />
                        Profile
                    </button>
                </div>
                <button style={styles.upgradeButton} onClick={this.props.onToggleUpgradePopup}>Upgrade</button>
            </>
        );
    }

    renderWelcome() {
        return <></>;
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
};

export default DeepTutorBottomSection; 