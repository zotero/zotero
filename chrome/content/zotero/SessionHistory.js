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
  background: '#fff',
  color: SKY,
  fontWeight: 700,
  fontSize: '1em',
  border: 'none',
  borderRadius: '0.625rem',
  width: '100%',
  maxWidth: '21.625rem',
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
  marginBottom: '0.875rem',
};

const plusIconStyle = {
  width: '1rem',
  height: '1rem',
};

const searchSectionStyle = {
  width: '100%',
  marginBottom: '0.875rem',
  padding: '0',
  background: 'white',
  borderRadius: '0.375rem',
  boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,0.1)',
  display: 'flex',
  alignSelf: 'flex-start',
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
  flex: 1,
  width: '100%',
  padding: '0',
  border: 'none',
  borderRadius: '0.375rem',
  background: '#fff',
  color: '#1a65b0',
  minHeight: '2rem',
  fontSize: '0.8125rem',
  outline: 'none',
  boxShadow: 'none'
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
  padding: '0.875rem',
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

const plusIconPath = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_REGIS_NEW.svg';

function SessionHistory({ sessions = [], onSessionSelect, isLoading = false, error = null, showSearch = true, onCreateNewSession }) {
  const [search, setSearch] = useState('');
  const [hoveredButton, setHoveredButton] = useState(null);

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
      <button style={createSessionButtonStyle} onClick={onCreateNewSession}>
        Create a New Session
        <img src={plusIconPath} alt="Plus" style={plusIconStyle} />
      </button>
      {/* Search Bar Section */}
      {showSearch && (
        <div style={searchSectionStyle}>
          <input
            type="text"
            placeholder="Search sessions..."
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
            onClick={() => onSessionSelect && onSessionSelect(session.sessionName)}
            onMouseEnter={() => setHoveredButton(session.id)}
            onMouseLeave={() => setHoveredButton(null)}
          >
            {session.sessionName || 'Unnamed Session'}
          </button>
        ))}
      </div>
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
  onCreateNewSession: PropTypes.func
};

export default SessionHistory;
