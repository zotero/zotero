import React, { useState } from 'react';
import PropTypes from 'prop-types';

const containerStyle = {
  width: '100%',
  minHeight: '80%',
  padding: '16px 0',
  gap: '4px',
  borderWidth: '1px',
  background: '#F2F2F2',
  borderRadius: '8px',
  height: '100%',
  marginTop: '8px',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Roboto, Inter, Arial, sans-serif',
  position: 'relative',
  overflow: 'auto',
};

const searchSectionStyle = {
  width: '90%',
  marginBottom: '16px',
  padding: '8px',
  background: 'white',
  borderRadius: '6px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  display: 'flex',
  alignSelf: 'flex-start',
  marginLeft: '5%',
};

const sessionListTitleStyle = {
  width: '90%',
  fontSize: '14px',
  fontWeight: 400,
  lineHeight: '135%',
  letterSpacing: '0%',
  verticalAlign: 'middle',
  color: '#757575',
  padding: '8px 12px',
  margin: '4px 0',
  marginBottom: '0px',
  alignSelf: 'flex-start',
  marginLeft: '5%',
};

const searchInputStyle = {
  flex: 1,
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #495057',
  borderRadius: '6px',
  background: '#fff',
  color: '#1a65b0',
  minHeight: '32px',
  fontSize: '13px',
};

const sessionListStyle = {
  width: '90%',
  borderRadius: '8px',
  padding: '8px',
  overflowY: 'auto',
  background: '#F2F2F2',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  alignSelf: 'flex-start',
  marginLeft: '5%',
};

const sessionButtonStyle = {
  width: '100%',
  fontFamily: 'Roboto, sans-serif',
  padding: '8px 12px',
  margin: '4px 0',
  background: '#F2F2F2',
  border: 'none',
  borderRadius: '6px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '16px',
  lineHeight: '100%',
  letterSpacing: '0%',
  color: '#292929',
  cursor: 'pointer',
};

const loadingStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#666',
  fontSize: '14px',
};

const errorStyle = {
  width: '90%',
  color: '#dc3545',
  padding: '12px',
  background: '#fff',
  borderRadius: '6px',
  margin: '8px auto',
  fontSize: '13px',
  alignSelf: 'flex-start',
  marginLeft: '5%',
};

function SessionHistory({ sessions = [], onSessionSelect, isLoading = false, error = null }) {
  const [search, setSearch] = useState('');

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
      {/* Search Bar Section */}
      <div style={searchSectionStyle}>
        <input
          type="text"
          placeholder="Search sessions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={searchInputStyle}
        />
      </div>
      <div style={sessionListTitleStyle}>Sessions</div>
      {/* Session List Section */}
      <div style={sessionListStyle}>
        {filteredSessions.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 16 }}>No sessions found.</div>
        )}
        {filteredSessions.map(session => (
          <button
            key={session.id || session.sessionName}
            style={sessionButtonStyle}
            onClick={() => onSessionSelect && onSessionSelect(session.sessionName)}
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
  error: PropTypes.string
};

export default SessionHistory;
