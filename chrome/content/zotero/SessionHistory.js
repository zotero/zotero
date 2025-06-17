import React, { useState } from 'react';
import PropTypes from 'prop-types';

const SKY = '#0687E5';

const containerStyle = {
  width: '100%',
  minHeight: '100%',
  padding: '0 1.25rem 1.875rem 1.25rem',
  borderWidth: '1px',
  background: '#F2F2F2',
  borderRadius: '0.5rem',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Roboto, Inter, Arial, sans-serif',
  position: 'relative',
  overflowX: 'hidden',
  overflowY: 'auto',
  boxSizing: 'border-box',
};

const createSessionButtonStyle = {
  all: 'revert',
  background: '#fff',
  color: SKY,
  fontWeight: 700,
  fontSize: '1em',
  border: '0.0625rem solid #0687E5',
  borderRadius: '0.625rem',
  width: '100%',
  minHeight: '3rem',
  padding: '0.625rem 1.25rem',
  cursor: 'pointer',
  boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
  fontFamily: 'Roboto, sans-serif',
  letterSpacing: 0.2,
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  marginBottom: '1.25rem',
};

const plusIconStyle = {
  width: '1rem',
  height: '1rem',
};

const searchSectionStyle = {
  all: 'revert',
  width: '100%',
  marginBottom: '0.875rem',
  padding: '0.375rem 0.5rem',
  background: '#F8F6F7',
  borderRadius: '0.625rem',
  boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,0.1)',
  display: 'flex',
  alignSelf: 'flex-start',
  alignItems: 'center',
  border: '1px solid #BDBDBD',
  minHeight: '3rem',
  boxSizing: 'border-box',
};

const sessionListTitleStyle = {
  width: '100%',
  fontSize: '1rem',
  fontWeight: 500,
  lineHeight: '135%',
  letterSpacing: '0%',
  verticalAlign: 'middle',
  color: '#757575',
  padding: '0.875rem',
  alignSelf: 'flex-start',
};

const searchInputStyle = {
  all: 'revert',
  flex: 1,
  width: '100%',
  padding: '0',
  border: 'none',
  borderRadius: '0.625rem',
  background: '#F8F6F7',
  color: '#757575',
  fontSize: '1rem',
  fontWeight: 400,
  lineHeight: '180%',
  outline: 'none',
  boxShadow: 'none',
  display: 'flex',
  alignItems: 'center',
};

const sessionListStyle = {
  width: '100%',
  borderRadius: '0.5rem',
  overflowY: 'auto',
  background: '#F2F2F2',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'flex-start',
};

const sessionButtonStyle = {
  all: 'revert',
  width: '100%',
  fontFamily: 'Roboto, sans-serif',
  padding: '1.2rem',
  background: '#F2F2F2',
  border: 'none',
  borderRadius: '0.375rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '1rem',
  lineHeight: '100%',
  letterSpacing: '0%',
  color: '#292929',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'relative',
};

const deleteButtonStyle = {
  all: 'revert',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '0.25rem',
  borderRadius: '0.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: '0.5rem',
  opacity: 0,
  transition: 'opacity 0.2s ease',
};

const deleteIconStyle = {
  width: '1rem',
  height: '1rem',
};

const sessionTextStyle = {
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const popupOverlayStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const popupContentStyle = {
  background: '#FFFFFF',
  borderRadius: '0.625rem',
  padding: '2rem',
  width: '20rem',
  maxWidth: '90%',
  fontFamily: 'Roboto, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  boxShadow: '0 0.25rem 1rem rgba(0,0,0,0.1)',
};

const popupTitleStyle = {
  background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  color: SKY,
  fontWeight: 700,
  fontSize: '1.25rem',
  lineHeight: '100%',
  letterSpacing: '0%',
  textAlign: 'center',
  marginBottom: '1.5rem',
};

const popupButtonStyle = {
  background: SKY,
  color: '#fff',
  fontWeight: 700,
  fontSize: '1rem',
  border: 'none',
  borderRadius: '0.625rem',
  padding: '0.875rem 0',
  width: '100%',
  margin: '0 auto 0.625rem auto',
  cursor: 'pointer',
  boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
  fontFamily: 'Roboto, sans-serif',
  letterSpacing: 0.2,
  display: 'block',
};

const popupCancelButtonStyle = {
  background: '#fff',
  color: SKY,
  fontWeight: 700,
  fontSize: '1rem',
  border: `0.125rem solid ${SKY}`,
  boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
  borderRadius: '0.625rem',
  width: '100%',
  padding: '0.875rem 0',
  margin: '0.75rem auto 0 auto',
  cursor: 'pointer',
  fontFamily: 'Roboto, sans-serif',
  letterSpacing: 0.2,
  display: 'block',
};

const loadingStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#666',
  fontSize: '0.875rem',
};

const errorStyle = {
  width: '90%',
  color: '#dc3545',
  padding: '0',
  background: '#fff',
  borderRadius: '0.375rem',
  margin: '0.5rem auto',
  fontSize: '0.8125rem',
  alignSelf: 'flex-start',
  marginLeft: '5%',
};

const plusIconPath = 'chrome://zotero/content/DeepTutorMaterials/History/SESHIS_BLUE_PLUS.svg';
const searchIconPath = 'chrome://zotero/content/DeepTutorMaterials/History/SESHIS_SEARCH.svg';
const DeleteImg = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_DELETE.svg';

function SessionHistory({ sessions = [], onSessionSelect, isLoading = false, error = null, showSearch = true, onCreateNewSession, onDeleteSession }) {
  const [search, setSearch] = useState('');
  const [hoveredButton, setHoveredButton] = useState(null);
  const [isCreateSessionHovered, setIsCreateSessionHovered] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  const handleCreateSessionMouseEnter = () => setIsCreateSessionHovered(true);
  const handleCreateSessionMouseLeave = () => setIsCreateSessionHovered(false);

  const handleDeleteClick = (e, sessionId) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
    setShowDeletePopup(true);
  };

  const handleConfirmDelete = () => {
    if (sessionToDelete && onDeleteSession) {
      onDeleteSession(sessionToDelete);
    }
    setShowDeletePopup(false);
    setSessionToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowDeletePopup(false);
    setSessionToDelete(null);
  };

  const handlePopupOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancelDelete();
    }
  };

  const createSessionButtonDynamicStyle = {
    ...createSessionButtonStyle,
    background: isCreateSessionHovered ? '#F8F6F7' : '#fff',
  };

  // Filter and sort sessions
  const filteredSessions = sessions
    .filter(s => !search || (s.sessionName || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.lastUpdatedTime || 0) - new Date(a.lastUpdatedTime || 0));

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={errorStyle}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <button
        style={createSessionButtonDynamicStyle}
        onClick={onCreateNewSession}
        onMouseEnter={handleCreateSessionMouseEnter}
        onMouseLeave={handleCreateSessionMouseLeave}
      >
        Create a New Session
        <img src={plusIconPath} alt="Plus" style={plusIconStyle} />
      </button>
      {/* Search Bar Section */}
      {showSearch && (
        <div style={searchSectionStyle}>
          <img src={searchIconPath} alt="Search Icon" style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
          <input
            type="text"
            placeholder="Search for a Session..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>
      )}
      <div style={sessionListTitleStyle}>Sessions</div>
      {/* Session List Section */}
      <div style={sessionListStyle}>
        {filteredSessions.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 16 }}>No sessions found.</div>
        )}
        {filteredSessions.map(session => (
          <button
            key={session.id || session.sessionName}
            style={{
              ...sessionButtonStyle,
              background: hoveredButton === session.id ? '#D9D9D9' : '#F2F2F2'
            }}
            onClick={() => onSessionSelect && onSessionSelect(session.id)}
            onMouseEnter={() => setHoveredButton(session.id)}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <span style={sessionTextStyle}>
              {session.sessionName || 'Unnamed Session'}
            </span>
            <button
              style={{
                ...deleteButtonStyle,
                opacity: hoveredButton === session.id ? 1 : 0,
              }}
              onClick={(e) => handleDeleteClick(e, session.id)}
            >
              <img src={DeleteImg} alt="Delete" style={deleteIconStyle} />
            </button>
          </button>
        ))}
      </div>

      {/* Delete Confirmation Popup */}
      {showDeletePopup && (
        <div style={popupOverlayStyle} onClick={handlePopupOverlayClick}>
          <div style={popupContentStyle}>
            <div style={popupTitleStyle}>Confirm Session Deletion?</div>
            <button style={popupButtonStyle} onClick={handleConfirmDelete}>
              Confirm
            </button>
            <button style={popupCancelButtonStyle} onClick={handleCancelDelete}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

SessionHistory.propTypes = {
  sessions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    sessionName: PropTypes.string,
    lastUpdatedTime: PropTypes.string
  })),
  onSessionSelect: PropTypes.func,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  showSearch: PropTypes.bool,
  onCreateNewSession: PropTypes.func,
  onDeleteSession: PropTypes.func
};

export default SessionHistory;
