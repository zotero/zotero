import React, { useState } from 'react';
import PropTypes from 'prop-types';

const SKY = '#0687E5';

const containerStyle = {
	width: '100%',
	minHeight: '100%',
	padding: '0 1.25rem 0 1.25rem',
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
	fontWeight: 600,
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
	marginBottom: '1.875rem',
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
	minHeight: '2.5rem', // Fixed height for consistency
	fontFamily: 'Roboto, sans-serif',
	padding: '0.5rem 1.2rem',
	background: '#F2F2F2',
	border: 'none',
	borderRadius: '0.375rem',
	textAlign: 'left',
	fontWeight: 600,
	fontSize: '1rem',
	lineHeight: '1.2', // Increased line height for better text visibility
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
	width: '100%',
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
// Temporary: Using search icon as placeholder for edit - replace with proper edit icon
const EditImg = 'chrome://zotero/content/DeepTutorMaterials/History/SESHIS_SEARCH.svg';

function SessionHistory({ sessions = [], onSessionSelect, isLoading = false, error = null, onCreateNewSession, onShowDeletePopup, onRenameSession }) {
	const [search, setSearch] = useState('');
	const [hoveredButton, setHoveredButton] = useState(null);
	const [isCreateSessionHovered, setIsCreateSessionHovered] = useState(false);

	const handleCreateSessionMouseEnter = () => setIsCreateSessionHovered(true);
	const handleCreateSessionMouseLeave = () => setIsCreateSessionHovered(false);

	const handleDeleteClick = (e, sessionId) => {
		e.stopPropagation();
		if (onShowDeletePopup) {
			onShowDeletePopup(sessionId);
		}
	};

	const handleEditClick = (e, sessionId) => {
		e.stopPropagation();
		if (onRenameSession) {
			onRenameSession(sessionId);
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
						<div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
							<button
								style={{
									...deleteButtonStyle,
									opacity: hoveredButton === session.id ? 1 : 0,
									pointerEvents: hoveredButton === session.id ? 'auto' : 'none',
								}}
								onClick={e => handleEditClick(e, session.id)}
							>
								<img src={EditImg} alt="Edit" style={deleteIconStyle} />
							</button>
							<button
								style={{
									...deleteButtonStyle,
									opacity: hoveredButton === session.id ? 1 : 0,
									pointerEvents: hoveredButton === session.id ? 'auto' : 'none',
								}}
								onClick={e => handleDeleteClick(e, session.id)}
							>
								<img src={DeleteImg} alt="Delete" style={deleteIconStyle} />
							</button>
						</div>
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
	onCreateNewSession: PropTypes.func,
	onShowDeletePopup: PropTypes.func,
	onRenameSession: PropTypes.func
};

export default SessionHistory;
