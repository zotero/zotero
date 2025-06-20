import React from 'react';
import PropTypes from 'prop-types';

const styles = {
    top: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1.25rem 1.875rem 1.25rem',
        minHeight: '4rem',
        background: '#F2F2F2',
        width: '100%',
        boxSizing: 'border-box',
    },
    welcomeTop: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1.25rem 1.875rem 1.25rem',
        minHeight: '4rem',
        background: '#F2F2F2',
        width: '100%',
        boxSizing: 'border-box',
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
        height: '1.75rem',
        alignItems: 'center',
    },
    iconButton: {
        width: '2.5rem',
        height: '2.5rem',
        background: '#F2F2F2',
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
        background: '#F2F2F2',
    },
    iconImage: {
        width: '1.0625rem',
        height: '1.0625rem',
        objectFit: 'contain',
    },
    contentWrapper: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '1.75rem',
    },
};

class DeepTutorTopSection extends React.Component {
    getIconButtonStyle(isActive) {
        return {
            ...styles.iconButton,
            ...(isActive ? styles.iconButtonActive : {})
        };
    }

    renderMain() {
        return (
            <div style={styles.contentWrapper}>
                <img src={this.props.logoPath} alt="DeepTutor Logo" style={styles.logo} />
                <div style={styles.topRight}>
                    <button
                        style={this.getIconButtonStyle(this.props.currentPane === 'sessionHistory')}
                        onClick={() => this.props.onSwitchPane('sessionHistory')}
                    >
                        <img 
                            src={this.props.HistoryIconPath}
                            alt="History" 
                            style={styles.iconImage}
                        />
                    </button>
                    <button
                        style={this.getIconButtonStyle(this.props.currentPane === 'modelSelection')}
                        onClick={this.props.onToggleModelSelectionPopup}
                    >
                        <img 
                            src={this.props.PlusIconPath}
                            alt="New Session" 
                            style={styles.iconImage}
                        />
                    </button>
                </div>
            </div>
        );
    }

    renderWelcome() {
        return (
            <div style={styles.contentWrapper}>
                <img src={this.props.logoPath} alt="DeepTutor Logo" style={styles.logo} />
            </div>
        );
    }

    renderSessionHistory() {
        return (
            <div style={styles.contentWrapper}>
                <img src={this.props.logoPath} alt="DeepTutor Logo" style={styles.logo} />
            </div>
        );
    }

    render() {
        let content;
        if (this.props.currentPane === 'main') {
            content = this.renderMain();
        } else if (this.props.currentPane === 'welcome') {
            content = this.renderWelcome();
        } else if (this.props.currentPane === 'sessionHistory') {
            content = this.renderSessionHistory();
        } else {
            // fallback to main design for other panes
            content = this.renderMain();
        }
        return (
            <div style={this.props.currentPane === 'welcome' ? styles.welcomeTop : styles.top}>
                {content}
            </div>
        );
    }
}

DeepTutorTopSection.propTypes = {
    currentPane: PropTypes.string.isRequired,
    onSwitchPane: PropTypes.func.isRequired,
    logoPath: PropTypes.string.isRequired,
    HistoryIconPath: PropTypes.string.isRequired,
    PlusIconPath: PropTypes.string.isRequired,
    onToggleModelSelectionPopup: PropTypes.func.isRequired,
};

export default DeepTutorTopSection; 