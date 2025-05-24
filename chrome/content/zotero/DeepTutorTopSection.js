import React from 'react';
import PropTypes from 'prop-types';

const styles = {
    top: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px 3px 8px',
        minHeight: '64px',
        background: '#fff',
        width: '100%',
        boxSizing: 'border-box',
    },
    welcomeTop: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px 3px 8px',
        minHeight: '64px',
        background: '#D9D9D9',
        width: '100%',
        boxSizing: 'border-box',
    },
    logo: {
        height: '28px',
        width: 'auto',
        display: 'block',
        marginTop: '20px',
        marginLeft: '20px',
    },
    topRight: {
        display: 'flex',
        flexDirection: 'row',
        gap: '12px',
    },
    iconButton: {
        width: '40px',
        height: '40px',
        background: '#F8F6F7',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease',
        padding: '8px',
    },
    iconButtonActive: {
        background: '#F2F2F2',
    },
    iconImage: {
        width: '24px',
        height: '24px',
        objectFit: 'contain',
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
            <>
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
                        onClick={() => this.props.onSwitchPane('modelSelection')}
                    >
                        <img 
                            src={this.props.PlusIconPath}
                            alt="New Session" 
                            style={styles.iconImage}
                        />
                    </button>
                </div>
            </>
        );
    }

    renderWelcome() {
        return (
            <img src={this.props.logoPath} alt="DeepTutor Logo" style={styles.logo} />
        );
    }

    renderSessionHistory() {
        return (
            <>
                <img src={this.props.logoPath} alt="DeepTutor Logo" style={styles.logo} />
                <div style={styles.topRight}>
                    <button
                        style={this.getIconButtonStyle(true)}
                        onClick={() => this.props.onSwitchPane('sessionHistory')}
                    >
                        <img 
                            src={this.props.MicroscopeIconPath}
                            alt="Microscope" 
                            style={styles.iconImage}
                        />
                    </button>
                    <button
                        style={this.getIconButtonStyle(this.props.currentPane === 'modelSelection')}
                        onClick={() => this.props.onSwitchPane('modelSelection')}
                    >
                        <img 
                            src={this.props.PlusIconPath}
                            alt="New Session" 
                            style={styles.iconImage}
                        />
                    </button>
                </div>
            </>
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
    MicroscopeIconPath: PropTypes.string.isRequired,
};

export default DeepTutorTopSection; 