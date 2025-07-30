 
import React from 'react';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const StreamingStates = {
	DEFAULT: 0,
	ID: 1,
	THINKING: 2,
	RESPONSE: 3,
	SOURCES: 4,
	SOURCE_PAGE: 5,
	FOLLOW_UP_QUESTIONS: 6,
	APPENDIX: 7,
};

const getLoadingText = (currentStatus) => {
	switch (currentStatus) {
		case StreamingStates.THINKING:
			return 'Thinking ...';
		case StreamingStates.RESPONSE:
			return 'Outputting response ...';
		case StreamingStates.SOURCES:
			return 'Finding sources ...';
		case StreamingStates.SOURCE_PAGE:
			return 'Finding source page numbers ...';
		case StreamingStates.FOLLOW_UP_QUESTIONS:
			return 'Generating follow-up questions ...';
		case StreamingStates.APPENDIX:
			return 'Formatting response ...';
		default:
			return 'Generating ...';
	}
};

const DeepTutorStreamingTag = ({ streamState, isCurrentTag }) => {
	const { colors, theme } = useDeepTutorTheme();
	
	const tagStyle = {
		display: 'flex',
		width: 'fit-content',
		gap: '0.25rem',
		borderRadius: '0.375rem',
		border: `0.25rem solid ${theme === 'dark' ? colors.sky : '#E0E0E0'}`,
		paddingLeft: '1rem',
		paddingRight: '1rem',
		paddingTop: '0.5rem',
		paddingBottom: '0.5rem',
		marginTop: '1rem',
		marginBottom: '1rem',
		fontFamily: 'Roboto, sans-serif',
		fontSize: '0.875rem',
		alignItems: 'center',
		color: colors.text.allText
	};

	const checkIconStyle = {
		width: '1.5rem',
		height: '1.5rem',
		viewBox: '0 0 24 24',
		fill: 'none',
		xmlns: 'http://www.w3.org/2000/svg'
	};

	const spinnerStyle = {
		height: '1rem',
		width: '1rem',
		borderRadius: '50%',
		border: `0.125rem solid ${colors.sky}`,
		borderTopColor: 'transparent',
		animation: 'spin 1s linear infinite'
	};

	return React.createElement('div', null,
		React.createElement('style', {
			dangerouslySetInnerHTML: {
				__html: `
					@keyframes spin {
						0% { transform: rotate(0deg); }
						100% { transform: rotate(360deg); }
					}
				`
			}
		}),
		!isCurrentTag && React.createElement('div', { style: tagStyle },
			React.createElement('div', {
				style: {
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}
			},
			React.createElement('svg', checkIconStyle,
				React.createElement('path', {
					d: 'M5 12l5 5L20 7',
					stroke: 'green',
					strokeWidth: '2',
					strokeLinecap: 'round',
					strokeLinejoin: 'round'
				})
			)
			),
			getLoadingText(streamState)
		),
		isCurrentTag && React.createElement('div', { style: tagStyle },
			React.createElement('div', {
				style: {
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}
			},
			React.createElement('div', { style: spinnerStyle })
			),
			getLoadingText(streamState)
		)
	);
};

export { StreamingStates };
export default DeepTutorStreamingTag;
