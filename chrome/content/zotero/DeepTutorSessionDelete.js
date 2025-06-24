import React from 'react';
import PropTypes from 'prop-types';

const SKY = '#0687E5';

const styles = {
  container: {
    width: '100%',
    minHeight: '80%',
    background: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  content: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    background: '#dc3545',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: '#dc3545',
    fontWeight: 700,
    fontSize: '1.25rem',
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  message: {
    fontSize: '1rem',
    color: '#000000',
    textAlign: 'center',
    marginBottom: '1.875rem',
    fontWeight: 400,
    lineHeight: '135%',
  },
  buttonContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  confirmButton: {
    all: 'revert',
    background: '#dc3545',
    color: '#fff',
    minHeight: '3rem',
    fontWeight: 700,
    fontSize: '1rem',
    border: 'none',
    borderRadius: '0.625rem',
    padding: '0.625rem 1.25rem',
    width: '100%',
    cursor: 'pointer',
    boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
  },
  confirmButtonHover: {
    background: '#dc3545',
  },
  cancelButton: {
    all: 'revert',
    background: '#fff',
    color: SKY,
    fontWeight: 700,
    fontSize: '1rem',
    minHeight: '3rem',
    border: `0.125rem solid ${SKY}`,
    boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
    borderRadius: '0.625rem',
    width: '100%',
    padding: '0.625rem 1.25rem',
    cursor: 'pointer',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
  },
  cancelButtonHover: {
    background: '#F8F6F7',
  }
};

export default function DeepTutorSessionDelete({ 
  sessionToDelete, 
  onConfirmDelete, 
  onCancelDelete,
  sessionName = 'this session'
}) {
  const [isConfirmHovered, setIsConfirmHovered] = React.useState(false);
  const [isCancelHovered, setIsCancelHovered] = React.useState(false);

  // Truncate session name if it's too long
  const truncateSessionName = (name, maxLength = 35) => {
    if (!name || name.length <= maxLength) {
      return name;
    }
    return name.substring(0, maxLength) + '...';
  };

  const displaySessionName = truncateSessionName(sessionName);

  const handleConfirm = () => {
    if (sessionToDelete && onConfirmDelete) {
      onConfirmDelete(sessionToDelete);
    }
  };

  const handleCancel = () => {
    if (onCancelDelete) {
      onCancelDelete();
    }
  };

  const confirmButtonDynamicStyle = {
    ...styles.confirmButton,
    ...(isConfirmHovered ? styles.confirmButtonHover : {})
  };

  const cancelButtonDynamicStyle = {
    ...styles.cancelButton,
    ...(isCancelHovered ? styles.cancelButtonHover : {})
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.message}>
          Are you sure you want to delete "{displaySessionName}"? This action cannot be undone.
        </div>
        <div style={styles.buttonContainer}>
          <button 
            style={confirmButtonDynamicStyle}
            onClick={handleConfirm}
            onMouseEnter={() => setIsConfirmHovered(true)}
            onMouseLeave={() => setIsConfirmHovered(false)}
          >
            Delete
          </button>
          <button 
            style={cancelButtonDynamicStyle}
            onClick={handleCancel}
            onMouseEnter={() => setIsCancelHovered(true)}
            onMouseLeave={() => setIsCancelHovered(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

DeepTutorSessionDelete.propTypes = {
  sessionToDelete: PropTypes.string,
  onConfirmDelete: PropTypes.func.isRequired,
  onCancelDelete: PropTypes.func.isRequired,
  sessionName: PropTypes.string
};
