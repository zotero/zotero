/* eslint-disable react/display-name */
import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
	getPreSignedUrl,
	createSession
} from './api/libs/api';

const DeleteImg = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_DELETE.svg';
// const LitePath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_LITE.svg';
const BasicPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_STANDARD.svg';
const AdvancedPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_ADVANCED.svg';
const RegisDragPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_DRAG.svg';
const RegisSearchPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_SEARCH.svg';

// Session Status Enum
const SessionStatus = {
	CREATED: 'CREATED',
	READY: 'READY',
	PROCESSING_ERROR: 'PROCESSING_ERROR',
	FINAL_PROCESSING_ERROR: 'FINAL_PROCESSING_ERROR',
	PROCESSING: 'PROCESSING',
	DELETED: 'DELETED'
};

// Session Type Enum
const SessionType = {
	LITE: 'LITE',
	BASIC: 'BASIC'
};

const PEARL = '#F8F6F7';
const SKY = '#0687E5';
const LIGHT_GREY2 = '#DADCE0';

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column',
		width: '100%',
		maxHeight: '100%',
		background: '#FFFFFF',
		fontFamily: 'Roboto, sans-serif',
		alignItems: 'center',
		justifyContent: 'flex-start',
		overflowY: 'auto',
		position: 'relative',
		boxSizing: 'border-box',
	},
	mainSection: {
		display: 'flex',
		flexDirection: 'column',
		margin: '0 -0.5rem 0 0',
		padding: '0 0.5rem 0 0',
		width: '98%',
		maxHeight: '65vh',
		height: '100%',
		overflowY: 'auto',
		boxSizing: 'border-box',
	},
	nameSection: {
		width: '100%',
		maxWidth: '26rem',
		display: 'flex',
		flexDirection: 'column',
		boxSizing: 'border-box',
		margin: '0 auto 1.875rem auto',
	},
	contextSection: {
		width: '100%',
		maxWidth: '26rem',
		display: 'flex',
		flexDirection: 'column',
		boxSizing: 'border-box',
		margin: '0 auto 1.875rem auto',
	},
	modelSection: {
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		boxSizing: 'border-box',
		margin: '0 auto 0.625rem auto',
	},
	label: {
		fontWeight: 400,
		fontSize: '0.875rem',
		lineHeight: '135%',
		letterSpacing: '0%',
		verticalAlign: 'middle',
		color: '#000000',
		marginBottom: '0.5rem',
	},
	inputContainer: {
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		boxSizing: 'border-box',
		padding: 0,
		margin: 0,
	},
	input1: {
		width: '100%',
		height: '3rem',
		borderRadius: '0.625rem',
		padding: '0.375rem 0.5rem',
		border: `0.0625rem solid ${LIGHT_GREY2}`,
		background: PEARL,
		fontSize: '0.875rem',
		outline: 'none',
		boxSizing: 'border-box',
		margin: 0,
	},
	searchArea: {
		width: '100%',
		background: PEARL,
		borderRadius: '0.625rem',
		border: `0.0625rem solid ${LIGHT_GREY2}`,
		display: 'flex',
		alignItems: 'center',
		padding: '0.75rem 0.9375rem',
		marginBottom: '0.625rem',
		fontSize: '0.875rem',
		color: '#292929',
		boxSizing: 'border-box',
	},
	searchIcon: {
		width: '1rem',
		height: '1rem',
		opacity: 0.7,
	},
	searchInput: {
		flex: 1,
		border: 'none',
		outline: 'none',
		background: 'transparent',
		fontSize: '1rem',
		fontFamily: 'Roboto, sans-serif',
		color: '#292929',
	},
	searchLoadingIndicator: {
		marginLeft: '0.5rem',
		fontSize: '0.75rem',
		color: '#888',
		fontStyle: 'italic',
	},
	uploadButton: {
		background: SKY,
		color: '#fff',
		border: 'none',
		borderRadius: '0.5rem',
		fontWeight: 600,
		padding: '0.5rem 1.125rem',
		fontSize: '1em',
		cursor: 'pointer',
		fontFamily: 'Roboto, sans-serif',
		minWidth: 0,
		minHeight: 0,
	},
	orText: {
		fontWeight: 400,
		fontSize: '0.875rem',
		lineHeight: '135%',
		letterSpacing: '0%',
		textAlign: 'center',
		verticalAlign: 'middle',
		color: '#888',
		boxSizing: 'border-box',
	},
	dragArea: {
		width: '100%',
		borderRadius: '0.625rem',
		borderWidth: '0.0625rem',
		padding: '0.75rem 0.9375rem',
		border: `0.0625rem solid ${LIGHT_GREY2}`,
		background: PEARL,
		minHeight: '5.6875rem',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		color: '#888',
		fontSize: '1rem',
		flexDirection: 'column',
		transition: 'border-color 0.2s, background 0.2s',
		boxSizing: 'border-box',
		gap: '0.5rem',
	},
	dragAreaActive: {
		borderColor: SKY,
		background: '#F0F9FF',
	},
	modelTypeRow: {
		display: 'flex',
		flexDirection: 'row',
		width: '100%',
		background: '#F8F6F7',
		marginBottom: '1.25rem',
		justifyContent: 'space-between',
		gap: '0.5rem',
		borderRadius: '0.625rem',
		boxSizing: 'border-box',
		padding: '0.25rem',
	},
	modelTypeButton: {
		flex: '1 1 0',
		minHeight: '3rem',
		borderRadius: '0.5rem',
		padding: '0.75rem 0.9375rem',
		border: 'none',
		fontWeight: 400,
		fontSize: '1rem',
		lineHeight: '180%',
		letterSpacing: '0%',
		verticalAlign: 'middle',
		cursor: 'pointer',
		background: '#F8F6F7',
		color: '#757575',
		transition: 'background 0.2s, color 0.2s',
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		minWidth: 0,
		width: 'auto',
		maxWidth: 'none',
		minPadding: '0.75rem 0.9375rem',
		gap: '0.5rem',
	},
	modelTypeButtonSelected: {
		background: '#D9D9D9',
		color: '#292929',
		fontWeight: 400,
		fontSize: '1rem',
		lineHeight: '180%',
		letterSpacing: '0%',
		minHeight: '3rem',
		verticalAlign: 'middle',
	},
	createButton: {
		all: 'revert',
		width: '100%',
		minHeight: '2.4375rem',
		margin: '2rem auto 0 auto',
		padding: '0.875rem 0',
		background: SKY,
		color: '#fff',
		fontWeight: 700,
		fontSize: '1.1rem',
		border: 'none',
		borderRadius: '0.625rem',
		cursor: 'pointer',
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
		fontFamily: 'Roboto, sans-serif',
		letterSpacing: 0.2,
		transition: 'background 0.2s',
		display: 'block',
	},
	modelDescription: {
		display: 'flex',
		flexDirection: 'column',
		gap: '0.625rem',
		width: '100%',
		height: '11rem',
	},
	modelFeature: {
		display: 'flex',
		alignItems: 'flex-start',
		gap: '0.625rem',
		fontSize: '1rem',
		lineHeight: '135%',
		letterSpacing: '0%',
		color: '#000000',
		height: 'auto',
		width: '100%',
		fontWeight: '500',
	},
	modelIcon: {
		width: '1rem',
		height: '1rem',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: '0.09375rem',
	},
	modelLimitations: {
		color: '#000000',
		gap: '0.625rem',
		fontSize: '1rem',
		lineHeight: '135%',
		fontWeight: '400',
		letterSpacing: '0%',
		width: '100%',
		height: 'auto',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'flex-start',
	},
	searchContainer: {
		position: 'relative',
		width: '100%',
		height: '3rem',
		padding: '0',
		marginBottom: '0.625rem',
	},
	searchPopup: {
		position: 'absolute',
		top: '100%',
		left: 0,
		right: 0,
		maxHeight: '12.5rem', // Exactly 5 items (5 * 2.5rem = 12.5rem)
		maxWidth: '100%',
		overflowY: 'auto',
		overflowX: 'auto',
		padding: '0 0.75rem 0.75rem 0',
		background: '#FFFFFF',
		border: `0.0625rem solid ${LIGHT_GREY2}`,
		borderRadius: '0.5rem',
		boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
		zIndex: 1000,
		marginTop: '0.25rem',

	},
	searchPopupInner: {
		width: 'max-content',
		minWidth: '100%',
	},
	searchItem: {
		display: 'flex',
		padding: '0.5rem 0.75rem',
		cursor: 'pointer',
		fontSize: '0.9em',
		color: '#292929',
		width: '100%',
		transition: 'background 0.2s',
		height: '2.5rem', // Fixed height for each item
		lineHeight: '1.5rem',
		alignItems: 'center',
		boxSizing: 'border-box',
		whiteSpace: 'nowrap',
		margin: 0,

	},
	searchItemSelected: {
		background: PEARL,
	},
	noResults: {
		padding: '0.5rem 0.75rem',
		color: '#888',
		fontSize: '0.9em',
		textAlign: 'center',
	},
	fileListButton: {
		background: SKY,
		color: '#fff',
		border: 'none',
		borderRadius: '0.5rem',
		fontWeight: 600,
		padding: '0.5rem 1.125rem',
		fontSize: '1em',
		cursor: 'pointer',
		fontFamily: 'Roboto, sans-serif',
		minWidth: 0,
		minHeight: 0,
		boxSizing: 'border-box',
	},
	fileListPopup: {
		position: 'absolute',
		top: '100%',
		right: 0,
		width: '18.75rem',
		maxHeight: '18.75rem',
		overflowY: 'auto',
		background: '#FFFFFF',
		border: `0.0625rem solid ${LIGHT_GREY2}`,
		borderRadius: '0.5rem',
		boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
		zIndex: 1000,
		marginTop: '0.25rem',
		padding: '0.5rem',
	},
	fileListItem: {
		padding: '0.5rem',
		borderBottom: `0.0625rem solid ${LIGHT_GREY2}`,
		fontSize: '0.9em',
		color: '#292929',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		boxSizing: 'border-box',
	},
	fileListRemove: {
		color: '#ff4444',
		cursor: 'pointer',
		fontSize: '1.2em',
		padding: '0 0.25rem',
	},
	fileListEmpty: {
		padding: '0.5rem',
		color: '#888',
		fontSize: '0.9em',
		textAlign: 'center',
	},
	newFileList: {
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		gap: '0.625rem',
		marginBottom: '0.625rem',
		boxSizing: 'border-box',
	},
	newFileListItem: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '0.625rem',
		borderRadius: '0.625rem',
		border: '0.0625rem solid #D9D9D9',
		backgroundColor: '#FFFFFF',
		height: '2.75rem',
		boxSizing: 'border-box',
	},
	newFileListName: {
		fontSize: '0.875rem',
		lineHeight: '135%',
		letterSpacing: '0%',
		verticalAlign: 'middle',
		color: '#000000',
		fontWeight: 400,
		flex: 1,
		marginRight: '0.625rem',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
	},
	newFileListDelete: {
		width: '1.5rem',
		height: '1.5rem',
		cursor: 'pointer',
		padding: 0,
		border: 'none',
		background: 'transparent',
	},
	contextLabel: {
		width: '100%',
		marginBottom: '0.3125rem',
	},
	fileListContainer: {
		width: '100%',
		marginBottom: '0.3125rem',
		overflowY: 'auto',
		boxSizing: 'border-box',
	},
};

const ModelSelection = forwardRef(({ onSubmit, user, externallyFrozen = false, onShowNoPDFWarning }, ref) => {
	const [fileList, setFileList] = useState([]);
	const [originalFileList, setOriginalFileList] = useState([]);
	const [modelName, setModelName] = useState('');
	const [backupModelName, setBackupModelName] = useState('Default Session');
	const [selectedType, setSelectedType] = useState('lite');
	const [searchValue, setSearchValue] = useState('');
	const [isDragging, setIsDragging] = useState(false);
	const [containerNames, setContainerNames] = useState([]);
	const [filteredContainers, setFilteredContainers] = useState([]);
	const [showSearchPopup, setShowSearchPopup] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [buttonWidth, setButtonWidth] = useState(null);
	const [buttonLayout, setButtonLayout] = useState('row');
	const [isCreateHovered, setIsCreateHovered] = useState(false);
	const [hoveredSearchItem, setHoveredSearchItem] = useState(null);
	const [isInitializing, setIsInitializing] = useState(false);
	const [isSearchLoading, setIsSearchLoading] = useState(false);
	const buttonRef = useRef(null);

	// Combine internal initialization state with external freeze state
	const isEffectivelyFrozen = isInitializing || externallyFrozen;

	// Debug logging for external freeze state changes
	useEffect(() => {
		if (externallyFrozen !== undefined) {
			Zotero.debug(`ModelSelection: External freeze state changed to: ${externallyFrozen}`);
			Zotero.debug(`ModelSelection: Effective frozen state: ${isEffectivelyFrozen}`);
		}
	}, [externallyFrozen, isEffectivelyFrozen]);

	// Use requestAnimationFrame to track button width
	useEffect(() => {
		let animationFrameId;

		const checkWidth = () => {
			if (buttonRef.current) {
				const width = buttonRef.current.getBoundingClientRect().width;
				if (width !== buttonWidth) {
					setButtonWidth(width);
					Zotero.debug(`ModelSelection: Button width: ${width}`);
					setButtonLayout(width < 107 ? 'column' : 'row');
				}
			}
			animationFrameId = requestAnimationFrame(checkWidth);
		};

		checkWidth();

		// Cleanup
		return () => {
			cancelAnimationFrame(animationFrameId);
		};
	}, [buttonWidth]);

	// Function to get dynamic button styles based on layout
	const getModelTypeButtonStyle = (isSelected) => {
		return {
			...styles.modelTypeButton,
			...(isSelected ? styles.modelTypeButtonSelected : {}),
			flexDirection: buttonLayout,
		};
	};

	// Add debug logging for fileList changes
	useEffect(() => {
		Zotero.debug(`ModelSelection: fileList updated - length: ${fileList.length}`);
		fileList.forEach((file, index) => {
			Zotero.debug(`ModelSelection: fileList[${index}] - id: ${file.id}, name: ${file.name}`);
		});
    
		// Clear error message when files are added
		if (fileList.length > 0 && errorMessage) {
			setErrorMessage('');
		}
	}, [fileList, errorMessage]);

	// Update model name based on first file in fileList and handle model type switching
	useEffect(() => {
		if (fileList.length > 0) {
			const firstName = fileList[0].name;

			setBackupModelName(firstName);
			Zotero.debug(`ModelSelection: Updated model name to: ${firstName}`);
      
			// Auto-switch to standard mode when 2 or more files are selected
			if (fileList.length >= 2 && selectedType === 'normal') {
				setSelectedType('lite');
				Zotero.debug('ModelSelection: Auto-switched to standard mode due to multiple files');
			}
		}
		else {
			setBackupModelName('Default Session');
			Zotero.debug('ModelSelection: Reset model name to Default Session');
		}
	}, [fileList, selectedType]);

	// COMMENTED OUT: Load attachment names when component mounts
	// This is now replaced by container-based search logic
	/*
	useEffect(() => {
		const loadAttachmentNames = async () => {
			try {
				Zotero.debug("BBBBB: Loading attachment names");
				const libraryID = Zotero.Libraries.userLibraryID;
				Zotero.debug(`BBBBB: Using library ID: ${libraryID}`);
        
				const items = await Zotero.Items.getAll(libraryID);
				Zotero.debug(`BBBBB: Found ${items.length} total items`);
        
				// Use a Set to track unique attachment IDs and prevent duplicates
				const seenIds = new Set();
				const attachments = items.reduce((arr, item) => {
					if (item.isAttachment() && item.isPDFAttachment()) {
						// Skip if we've already processed this attachment
						if (seenIds.has(item.id)) {
							return arr;
						}
						seenIds.add(item.id);
            
						// Safe filename resolution with error handling
						let fileName = '';
						try {
							fileName = item.attachmentFilename || item.getField('title') || '';
						}
						catch (error) {
							Zotero.debug(`BBBBB: Error getting filename for attachment ${item.id}: ${error.message}`);
							fileName = '';
						}
            
						// Ensure we have a valid string and fallback to "Untitled"
						if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
							fileName = 'Untitled';
						}
            
						Zotero.debug(`BBBBB: Found PDF attachment: ${fileName}`);
						return arr.concat([{ id: item.id, name: fileName }]);
					}
					if (item.isRegularItem()) {
						const childAttachments = item.getAttachments()
              .map(x => Zotero.Items.get(x))
              .filter(x => x && x.isPDFAttachment && x.isPDFAttachment())
              .filter(x => !seenIds.has(x.id)) // Skip duplicates
              .map((x) => {
              	seenIds.add(x.id); // Mark as seen
                
              	// Safe filename resolution with error handling
              	let fileName = '';
              	try {
              		fileName = x.attachmentFilename || x.getField('title') || '';
              	}
              	catch (error) {
              		Zotero.debug(`BBBBB: Error getting filename for attachment ${x.id}: ${error.message}`);
              		fileName = '';
              	}
                
              	// Ensure we have a valid string and fallback to "Untitled"
              	if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
              		fileName = 'Untitled';
              	}
                
              	return { id: x.id, name: fileName };
              });
						return arr.concat(childAttachments);
					}
					return arr;
				}, []);
        
				Zotero.debug(`BBBBB: Found ${attachments.length} PDF attachments`);
				setAttachmentNames(attachments);
			}
			catch (error) {
				Zotero.debug(`BBBBB: Error loading attachment names: ${error.message}`);
				Zotero.debug(`BBBBB: Error stack: ${error.stack}`);
			}
		};

		loadAttachmentNames();
	}, []);
	*/

	// Load container names when component mounts
	useEffect(() => {
		const loadContainerNames = async () => {
			try {
				Zotero.debug("BBBBB: Loading container names");
				const libraryID = Zotero.Libraries.userLibraryID;
				Zotero.debug(`BBBBB: Using library ID: ${libraryID}`);
        
				const items = await Zotero.Items.getAll(libraryID);
				Zotero.debug(`BBBBB: Found ${items.length} total items`);
        
				// Use a Set to track unique container IDs and prevent duplicates
				const seenIds = new Set();
				const containers = items.reduce((arr, item) => {
					if (item.isRegularItem()) {
						// Skip if we've already processed this container
						if (seenIds.has(item.id)) {
							return arr;
						}
						
						// Check if this container has at least one PDF attachment
						const pdfAttachments = item.getAttachments()
							.map(x => Zotero.Items.get(x))
							.filter(x => x && x.isPDFAttachment && x.isPDFAttachment());
						
						if (pdfAttachments.length === 0) {
							return arr; // Skip containers with no PDF attachments
						}
						
						seenIds.add(item.id);
            
						// Safe title resolution with error handling
						let containerName = '';
						try {
							containerName = item.getField('title') || '';
						}
						catch (error) {
							Zotero.debug(`BBBBB: Error getting container title for ${item.id}: ${error.message}`);
							containerName = '';
						}
            
						// Ensure we have a valid string and fallback to "Untitled"
						if (!containerName || typeof containerName !== 'string' || containerName.trim() === '') {
							containerName = 'Untitled';
						}
            
						Zotero.debug(`BBBBB: Found container with PDFs: ${containerName} (${pdfAttachments.length} PDFs)`);
						return arr.concat([{ id: item.id, name: containerName }]);
					}
					return arr;
				}, []);
        
				Zotero.debug(`BBBBB: Found ${containers.length} containers with PDF attachments`);
				setContainerNames(containers);
			}
			catch (error) {
				Zotero.debug(`BBBBB: Error loading container names: ${error.message}`);
				Zotero.debug(`BBBBB: Error stack: ${error.stack}`);
			}
		};

		loadContainerNames();
	}, []);

	// Add currently opened PDF to fileList when component mounts
	useEffect(() => {
		const addCurrentOpenPDF = async () => {
			try {
				Zotero.debug("ModelSelection: Checking for currently opened PDF");
				
				// Get the current reader instance
				const reader = Zotero.Reader.getByTabID(Zotero.getMainWindow().Zotero_Tabs.selectedID);
				if (!reader) {
					Zotero.debug("ModelSelection: No reader instance found");
					return;
				}

				// Get the item from the reader
				const item = Zotero.Items.get(reader.itemID);
				if (!item) {
					Zotero.debug("ModelSelection: No item found for reader");
					return;
				}

				// Check if it's a PDF attachment
				if (!item.isPDFAttachment()) {
					Zotero.debug("ModelSelection: Current item is not a PDF attachment");
					return;
				}

				// Safe filename resolution with error handling
				let fileName = '';
				try {
					fileName = item.attachmentFilename || item.getField('title') || '';
				}
				catch (error) {
					Zotero.debug(`ModelSelection: Error getting filename for current PDF: ${error.message}`);
					fileName = '';
				}

				// Ensure we have a valid string and fallback to "Untitled"
				if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
					fileName = 'Untitled';
				}

				Zotero.debug(`ModelSelection: Found currently opened PDF: ${fileName} (ID: ${item.id})`);

				// Check if this file is already in the fileList
				if (fileList.some(existingFile => existingFile.id === item.id)) {
					Zotero.debug("ModelSelection: Current PDF is already in fileList, skipping");
					return;
				}

				// Add to fileList
				setFileList(prev => [...prev, { id: item.id, name: fileName }]);
				setOriginalFileList(prev => [...prev, item]);

				Zotero.debug(`ModelSelection: Successfully added current PDF to fileList: ${fileName}`);
			}
			catch (error) {
				Zotero.debug(`ModelSelection: Error adding current PDF to fileList: ${error.message}`);
				Zotero.debug(`ModelSelection: Error stack: ${error.stack}`);
			}
		};

		addCurrentOpenPDF();
	}, []); // Empty dependency array means this runs only once when component mounts

	// Filter containers when search value changes with debouncing
	useEffect(() => {
		Zotero.debug(`BBBBB: Container search filter triggered - searchValue: "${searchValue}", type: ${typeof searchValue}`);
    
		// Step 1: Validate searchValue - handle null, undefined, non-string values
		if (searchValue === null || searchValue === undefined) {
			Zotero.debug(`BBBBB: Search value is ${searchValue}, clearing results`);
			setIsSearchLoading(false);
			setFilteredContainers([]);
			setShowSearchPopup(false);
			return;
		}
    
		// Step 2: Ensure searchValue is a string
		if (typeof searchValue !== 'string') {
			Zotero.debug(`BBBBB: Search value is not a string (${typeof searchValue}), clearing results`);
			setIsSearchLoading(false);
			setFilteredContainers([]);
			setShowSearchPopup(false);
			return;
		}
    
		// Step 3: Check if searchValue is empty or only whitespace
		if (!searchValue.trim()) {
			Zotero.debug(`BBBBB: Search value is empty or whitespace-only, clearing results`);
			setIsSearchLoading(false);
			setFilteredContainers([]);
			setShowSearchPopup(false);
			return;
		}
    
		// Step 4: Set loading state immediately and show popup
		setIsSearchLoading(true);
		setShowSearchPopup(true);
    
		// Step 5: Debounce the search to avoid excessive filtering
		let processTimeoutId = null;
		const debounceTimeoutId = setTimeout(() => {
			// Use additional timeout to ensure React processes the loading state
			processTimeoutId = setTimeout(() => {
				try {
					const searchTerm = searchValue.toLowerCase().trim();
					Zotero.debug(`BBBBB: Processing container search term: "${searchTerm}"`);
          
					// Filter containers with comprehensive error handling
					const filtered = containerNames.filter((container) => {
						// Check for null/undefined container
						if (!container) {
							Zotero.debug(`BBBBB: Skipping null/undefined container`);
							return false;
						}
            
						// Check for null/undefined container name
						if (!container.name) {
							Zotero.debug(`BBBBB: Skipping container ${container.id} with null/undefined name`);
							return false;
						}
            
						// Ensure container.name is a string and process safely
						try {
							const containerName = String(container.name).toLowerCase();
							const matches = containerName.includes(searchTerm);
              
							if (matches) {
								Zotero.debug(`BBBBB: Container search match found - Term: "${searchTerm}", Name: "${container.name}"`);
							}
              
							return matches;
						}
						catch (error) {
							Zotero.debug(`BBBBB: Error processing container name for search: ${error.message}`);
							return false;
						}
					});
          
					Zotero.debug(`BBBBB: Container search completed - Found ${filtered.length} matches out of ${containerNames.length} total containers`);
          
					// Update state with results and clear loading
					setFilteredContainers(filtered);
					setIsSearchLoading(false);
				}
				catch (error) {
					Zotero.debug(`BBBBB: Critical error in container search filtering: ${error.message}`);
					Zotero.debug(`BBBBB: Error stack: ${error.stack}`);
					setFilteredContainers([]);
					setIsSearchLoading(false);
					setShowSearchPopup(false);
				}
			}, 10); // Small timeout to ensure React processes loading state first
		}, 150); // Debounce delay for user typing
    
		// Cleanup timeouts on dependency change
		return () => {
			clearTimeout(debounceTimeoutId);
			if (processTimeoutId) {
				clearTimeout(processTimeoutId);
			}
		};
	}, [searchValue, containerNames]);

	const handleSearchItemClick = async (container) => {
		try {
			Zotero.debug(`BBBBB: Selected container: ${container.name}`);
			const item = Zotero.Items.get(container.id);
      
			if (!item.isRegularItem()) {
				Zotero.debug(`BBBBB: Item is not a regular item: ${container.name}`);
				setErrorMessage("Please select a valid container");
				setSearchValue('');
				setShowSearchPopup(false);
				return;
			}

			// Get all PDF attachments from this container
			const pdfAttachments = item.getAttachments()
				.map(x => Zotero.Items.get(x))
				.filter(x => x && x.isPDFAttachment && x.isPDFAttachment());

			if (pdfAttachments.length === 0) {
				Zotero.debug(`BBBBB: No PDF attachments found in container: ${container.name}`);
				setErrorMessage("No PDF attachments found in this container");
				setSearchValue('');
				setShowSearchPopup(false);
				return;
			}

			Zotero.debug(`BBBBB: Found ${pdfAttachments.length} PDF attachments in container: ${container.name}`);

			// Process all PDF attachments and add them to the file list
			const newFileItems = [];
			const newOriginalItems = [];

			for (const pdf of pdfAttachments) {
				// Check if this PDF is already in the file list
				const existsInFileList = fileList.some(existingFile => existingFile.id === pdf.id);
				if (existsInFileList) {
					Zotero.debug(`BBBBB: PDF ${pdf.id} already exists in fileList, skipping`);
					continue;
				}

				// Safe filename resolution with error handling
				let fileName = '';
				try {
					fileName = pdf.attachmentFilename || pdf.getField('title') || '';
				}
				catch (error) {
					Zotero.debug(`BBBBB: Error getting filename for PDF ${pdf.id}: ${error.message}`);
					fileName = '';
				}
				
				// Ensure we have a valid string and fallback to "Untitled"
				if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
					fileName = 'Untitled';
				}

				newFileItems.push({ id: pdf.id, name: fileName });
				newOriginalItems.push(pdf);
				Zotero.debug(`BBBBB: Prepared PDF for addition: ${fileName}`);
			}

			// Update file lists with new PDFs
			if (newFileItems.length > 0) {
				setFileList(prev => [...prev, ...newFileItems]);
				setOriginalFileList(prev => [...prev, ...newOriginalItems]);
				Zotero.debug(`BBBBB: Added ${newFileItems.length} PDF attachments from container: ${container.name}`);
			}
			else {
				Zotero.debug(`BBBBB: No new PDFs to add from container: ${container.name}`);
			}

			// Clear search
			setSearchValue('');
			setShowSearchPopup(false);
		}
		catch (error) {
			Zotero.debug(`BBBBB: Error handling container search item click: ${error.message}`);
		}
	};

	const handleRemoveFile = (id) => {
		setFileList(prev => prev.filter(file => file.id !== id));
		setOriginalFileList(prev => prev.filter(file => file.id !== id));
	};

	const handleTypeSelection = (type) => {
		setSelectedType(type);
	};

	const handleSubmit = async () => {
		// Check if no files are selected
		if (fileList.length === 0) {
			Zotero.debug("ModelSelection: No files selected");
			setErrorMessage("Please add at least one file to create a session");
			return;
		}

		// Check if user is provided
		if (!user) {
			setErrorMessage("Please sign in to create a session");
			return;
		}

		// Clear any existing error message and start initializing
		setErrorMessage('');
		setIsInitializing(true);

		// Determine the final session name
		const finalSessionName = modelName.trim() || backupModelName || "Default Session";
		Zotero.debug(`ModelSelection: Using session name: ${finalSessionName}`);

		try {
			// Handle file uploads if fileList exists
			const uploadedDocumentIds = [];
			Zotero.debug(`ModelSelection: fileList length: ${fileList.length}`);
			Zotero.debug(`ModelSelection: originalFileList length: ${originalFileList.length}`);
			if (fileList.length > 0) {
				for (const file of originalFileList) {
					try {
						const fileName = file.name;
						Zotero.debug('ModelSelection: Processing file:', fileName);

						// Direct file reading approach (more memory-efficient than dataURI + fetch)
						Zotero.debug(`ModelSelection: ========== Starting direct file reading for: ${fileName} ==========`);
						const processStartTime = Date.now();
            
						let blob;
						try {
							// Get file path and check if file exists
							Zotero.debug(`ModelSelection: Getting file path for item ID: ${file.id}`);
							const pathStartTime = Date.now();
                
							const filePath = await file.getFilePathAsync();
							const pathDuration = Date.now() - pathStartTime;
                
							Zotero.debug(`ModelSelection: File path retrieved in ${pathDuration}ms: ${filePath}`);
                
							if (!filePath) {
								throw new Error(`No file path available for: ${fileName}`);
							}
                
							// Check file existence
							Zotero.debug(`ModelSelection: Checking if file exists: ${filePath}`);
							const existsStartTime = Date.now();
                
							const fileExists = await IOUtils.exists(filePath);
							const existsDuration = Date.now() - existsStartTime;
                
							Zotero.debug(`ModelSelection: File existence check completed in ${existsDuration}ms - exists: ${fileExists}`);
                
							if (!fileExists) {
								throw new Error(`File not found on disk: ${filePath}`);
							}
                
							// Check file size to avoid memory issues
							Zotero.debug(`ModelSelection: Getting file statistics...`);
							const statStartTime = Date.now();
                
							const fileStats = await IOUtils.stat(filePath);
							const statDuration = Date.now() - statStartTime;
                
							const fileSizeBytes = fileStats.size;
							const fileSizeMB = fileSizeBytes / (1024 * 1024);
                
							Zotero.debug(`ModelSelection: File stats retrieved in ${statDuration}ms`);
							Zotero.debug(`ModelSelection: File size: ${fileSizeBytes} bytes (${fileSizeMB.toFixed(2)} MB)`);
							Zotero.debug(`ModelSelection: File modified: ${new Date(fileStats.lastModified).toISOString()}`);
                
							// Set reasonable size limit (100MB for now, can be adjusted)
							const MAX_FILE_SIZE_MB = 100;
							if (fileSizeMB > MAX_FILE_SIZE_MB) {
								throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB (max: ${MAX_FILE_SIZE_MB}MB)`);
							}
                
							// Read file data directly
							Zotero.debug(`ModelSelection: Starting direct file read operation...`);
							const readStartTime = Date.now();
                
							const fileData = await IOUtils.read(filePath);
							const readDuration = Date.now() - readStartTime;
                
							Zotero.debug(`ModelSelection: File read completed in ${readDuration}ms`);
							Zotero.debug(`ModelSelection: Read ${fileData.length} bytes from disk`);
							Zotero.debug(`ModelSelection: File data type: ${fileData.constructor.name}`);
							Zotero.debug(`ModelSelection: Read speed: ${(fileSizeMB / (readDuration / 1000)).toFixed(2)} MB/s`);
                
							// Create blob directly from file data
							Zotero.debug(`ModelSelection: Creating blob from file data...`);
							const blobStartTime = Date.now();
                
							// Use Blob constructor from main window (required in Zotero's XPCOM context)
							const BlobConstructor = Zotero.getMainWindow().Blob;
							blob = new BlobConstructor([fileData], { type: 'application/pdf' });
							const blobDuration = Date.now() - blobStartTime;
							const totalDuration = Date.now() - processStartTime;
                
							Zotero.debug(`ModelSelection: Blob created in ${blobDuration}ms`);
							Zotero.debug(`ModelSelection: Final blob - size: ${blob.size} bytes, type: ${blob.type}`);
							Zotero.debug(`ModelSelection: Data integrity check - original: ${fileSizeBytes}, blob: ${blob.size}, match: ${fileSizeBytes === blob.size}`);
							Zotero.debug(`ModelSelection: ========== Direct file reading completed in ${totalDuration}ms ==========`);
						}
						catch (fileError) {
							// Limit error message size to prevent log overflow
							const errorMsg = fileError.message.length > 500
								? fileError.message.substring(0, 500) + '...[truncated]'
								: fileError.message;
							const errorStack = fileError.stack && fileError.stack.length > 1000
								? fileError.stack.substring(0, 1000) + '...[truncated]'
								: fileError.stack;
                
							Zotero.debug(`ModelSelection: Direct file reading ERROR - ${errorMsg}`);
							if (errorStack) {
								Zotero.debug(`ModelSelection: File reading stack: ${errorStack}`);
							}
							throw new Error(`Failed to read file data: ${errorMsg}`);
						}

						// 1. Get pre-signed URL for the file
						const preSignedUrlData = await getPreSignedUrl(user.id, fileName);
						Zotero.debug('ModelSelection: Got pre-signed URL:', preSignedUrlData);

						// 2. Upload file to Azure Blob Storage
						const uploadResponse = await window.fetch(preSignedUrlData.preSignedUrl, {
							method: 'PUT',
							headers: {
								'x-ms-blob-type': 'BlockBlob',
								'Content-Type': 'application/pdf'
							},
							body: blob
						});

						if (!uploadResponse.ok) {
							throw new Error(`Failed to upload file: ${uploadResponse.status}`);
						}

						Zotero.debug('ModelSelection: File uploaded successfully:', fileName);
						uploadedDocumentIds.push(preSignedUrlData.documentId);
						Zotero.debug(`ModelSelection: Uploaded document IDs: ${uploadedDocumentIds}`);
					}
					catch (fileError) {
						Zotero.debug('ModelSelection: Error uploading file:', fileError);
						continue;
					}
				}
			}

			// Create session data
			const sessionData = {
				userId: user.id,
				sessionName: finalSessionName,
        		type: selectedType === 'lite' ? SessionType.LITE : SessionType.BASIC,
				status: SessionStatus.CREATED,
				documentIds: uploadedDocumentIds,
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				statusTimeline: [],
				generateHash: null
			};

			Zotero.debug(`ModelSelection0521: Creating session with data: ${JSON.stringify(sessionData, null, 2)}`);

			// Create session with uploaded files
			const createdSession = await createSession(sessionData);
			Zotero.debug('ModelSelection0521: Session created successfully:', createdSession);

			// Create mapping file
			if (createdSession && createdSession.id) {
				try {
					// Create mapping between Azure document IDs and Zotero attachment IDs
					const mapping = {};
					fileList.forEach((file, index) => {
						mapping[uploadedDocumentIds[index]] = file.id;
					});

					// Save mapping to Zotero's local storage
					const storageKey = `deeptutor_mapping_${createdSession.id}`;
					Zotero.Prefs.set(storageKey, JSON.stringify(mapping));
					Zotero.debug('ModelSelection0521: Saved mapping to local storage for session:', createdSession.id);
					Zotero.debug('ModelSelection0521: Get data mapping:', Zotero.Prefs.get(storageKey));
				}
				catch (error) {
					Zotero.debug('ModelSelection0521: Error saving mapping to local storage:', error);
				}
			}

			// Call onSubmit with the session ID
			if (onSubmit) {
				onSubmit(createdSession.id);
			}
		}
		catch (error) {
			Zotero.debug('ModelSelection: Error creating session:', error);
			setErrorMessage('Failed to create session. Please try again.');
			setIsInitializing(false);
		}
	};

	const handleDragOver = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
    
		Zotero.debug("BBBBB: DragOver event triggered");
		Zotero.debug(`BBBBB: Available dataTransfer types: ${e.dataTransfer.types.join(', ')}`);
    
		// Check if we have Zotero items being dragged
		if (e.dataTransfer.types.includes('zotero/item')) {
			e.dataTransfer.dropEffect = 'copy';
			Zotero.debug("BBBBB: Setting dropEffect to 'copy' for Zotero items");
		}
	};

	const handleDragLeave = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
		Zotero.debug("BBBBB: DragLeave event triggered");
	};

	const handleDrop = async (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
		Zotero.debug("BBBBB: Drop event triggered");

		try {
			// Handle Zotero items being dropped
			if (e.dataTransfer.types.includes('zotero/item')) {
				Zotero.debug("BBBBB: Found 'zotero/item' in dataTransfer types");
				const itemIDs = e.dataTransfer.getData('zotero/item').split(',');
				Zotero.debug(`BBBBB: Retrieved itemIDs: ${itemIDs.join(', ')}`);
        
				const items = Zotero.Items.get(itemIDs);
				Zotero.debug(`BBBBB: Retrieved ${items.length} items from Zotero.Items.get`);
        
				// Check for non-PDF attachments and handle different scenarios
				const attachmentItems = items.filter(item => item.isAttachment());
				Zotero.debug(`BBBBB: Retrieved ${attachmentItems.length} attachment items`);
        
				const pdfAttachments = items.reduce((arr, item) => {
					if (item.isPDFAttachment()) {
						Zotero.debug(`BBBBB: Found direct PDF attachment: ${item.name}`);
						return arr.concat([item]);
					}
					if (item.isRegularItem()) {
						const attachments = item.getAttachments()
              .map(x => Zotero.Items.get(x))
              .filter(x => x.isPDFAttachment());
						if (attachments.length) {
							Zotero.debug(`BBBBB: Found ${attachments.length} PDF attachments in regular item: ${item.name}`);
						}
						return arr.concat(attachments);
					}
					return arr;
				}, []);

				if (!pdfAttachments.length) {
					Zotero.debug("BBBBB: No PDF attachments found in dropped items");
					if (onShowNoPDFWarning) {
						onShowNoPDFWarning();
					}
					return;
				}

				Zotero.debug(`BBBBB: Found ${pdfAttachments.length} total PDF attachments from dropped items`);
				Zotero.debug(`BBBBB: Current fileList length before update: ${fileList.length}`);
        
				// Store original PDF attachments (append to existing list)
				setOriginalFileList((prev) => {
					// Filter out PDFs that already exist in the current originalFileList
					const newPdfs = pdfAttachments.filter(pdf => !prev.some(existingFile => existingFile.id === pdf.id)
					);
					return [...prev, ...newPdfs];
				});
				Zotero.debug("BBBBB: Updated originalFileList with PDF attachments");

				// Process all PDFs concurrently using Promise.all
				const pdfProcessingPromises = pdfAttachments.map(async (pdf) => {
					try {
						Zotero.debug(`BBBBB: Processing PDF: ${pdf.name}`);
						const { text } = await Zotero.PDFWorker.getFullText(pdf.id);
						if (text) {
							// Safe filename resolution with error handling
							let fileName = '';
							try {
								fileName = pdf.attachmentFilename || pdf.getField('title') || '';
							}
							catch (error) {
								Zotero.debug(`BBBBBF: Error getting filename for PDF ${pdf.id}: ${error.message}`);
								fileName = '';
							}
              
							// Ensure we have a valid string and fallback to "Untitled"
							if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
								fileName = 'Untitled';
							}
              
							Zotero.debug(`BBBBBF: Successfully extracted text from PDF: ${fileName}`);
							return {
								id: pdf.id,
								name: fileName,
								content: text.substring(0, 200)
							};
						}
						Zotero.debug(`BBBBB: No text extracted from PDF: ${pdf.name}`);
						return null;
					}
					catch (e) {
						Zotero.debug(`BBBBB: Error extracting text from PDF ${pdf.name}: ${e.message}`);
						return null;
					}
				});

				// Wait for all PDFs to be processed
				const results = await Promise.all(pdfProcessingPromises);
				Zotero.debug(`BBBBB: Completed processing ${results.length} PDFs`);
        
				// Filter out any null results and update fileList
				const validResults = results.filter(result => result !== null);
				Zotero.debug(`BBBBB: Found ${validResults.length} valid results after processing`);
        
				setFileList((prev) => {
					// Filter out results that already exist in the current fileList
					const newResults = validResults.filter(result => !prev.some(existingFile => existingFile.id === result.id)
					);
          
					Zotero.debug(`BBBBB: Filtered out ${validResults.length - newResults.length} duplicate files`);
          
					const newList = [
						...prev,
						...newResults.map(result => ({
							id: result.id,
							name: result.name
						}))
					];
					Zotero.debug(`BBBBB: Updated fileList length: ${newList.length}`);
					return newList;
				});

				Zotero.debug(`BBBBB: Successfully processed ${validResults.length} PDFs from dropped items`);
			}
			else {
				Zotero.debug("BBBBB: No 'zotero/item' found in dataTransfer types");
			}
		}
		catch (error) {
			Zotero.debug(`BBBBB: Error handling dropped items: ${error.message}`);
			Zotero.debug(`BBBBB: Error stack: ${error.stack}`);
		}
	};

	const handleCreateMouseEnter = () => setIsCreateHovered(true);
	const handleCreateMouseLeave = () => setIsCreateHovered(false);

	const createButtonDynamicStyle = {
		...styles.createButton,
		background: isCreateHovered ? '#007BD5' : SKY,
	};

	const handleSearchItemMouseEnter = id => setHoveredSearchItem(id);
	const handleSearchItemMouseLeave = () => setHoveredSearchItem(null);

	// Public method to reset initializing state when component is about to close
	const resetInitializingState = () => {
		setIsInitializing(false);
	};

	// Expose public methods via ref
	useImperativeHandle(ref, () => ({
		resetInitializingState
	}));

	return (
		<div style={styles.container}>
			<div style={styles.mainSection}>
				<div style={styles.nameSection}>
					<label style={styles.label}>Session Name</label>
					<div style={styles.inputContainer}>
						<input
							type="text"
							value={modelName}
							onChange={e => setModelName(e.target.value)}
							style={{
								...styles.input1,
								opacity: isEffectivelyFrozen ? 0.5 : 1,
								cursor: isEffectivelyFrozen ? 'not-allowed' : 'text',
								color: '#000000'
							}}
							placeholder={backupModelName}
							disabled={isEffectivelyFrozen}
						/>
					</div>

				</div>

				<div style={styles.contextSection}>
					<div style={styles.contextLabel}>
						<label style={styles.label}>Add Context</label>
					</div>

					<div style={styles.fileListContainer}>
						{fileList.length > 0 && (
							<div style={styles.newFileList}>
								{fileList.map(file => (
									<div key={file.id} style={styles.newFileListItem}>
										<span
											style={styles.newFileListName}
											title={file.name}
										>
											{file.name}
										</span>
										<button
											style={{
												...styles.newFileListDelete,
												opacity: isEffectivelyFrozen ? 0.5 : 1,
												cursor: isEffectivelyFrozen ? 'not-allowed' : 'pointer'
											}}
											onClick={() => !isEffectivelyFrozen && handleRemoveFile(file.id)}
											disabled={isEffectivelyFrozen}
										>
											<img src={DeleteImg} alt="Delete" width="15" height="17" />
										</button>
									</div>
								))}
							</div>
						)}
					</div>

					<div style={styles.searchContainer}>
						<div
							style={styles.searchArea}
							onDragOver={e => e.preventDefault()}
							onDrop={e => e.preventDefault()}
						>
							<img src={RegisSearchPath} alt="Search" style={styles.searchIcon} />
							<input
								style={{
									...styles.searchInput,
									opacity: isEffectivelyFrozen ? 0.5 : 1,
									cursor: isEffectivelyFrozen ? 'not-allowed' : 'text'
								}}
								type="text"
								value={searchValue}
								onChange={e => !isEffectivelyFrozen && setSearchValue(e.target.value)}
								placeholder="Search for a PDF file"
								disabled={isEffectivelyFrozen}
								onDragOver={e => e.preventDefault()}
								onDrop={e => e.preventDefault()}
							/>
							{/* {isSearchLoading && !isEffectivelyFrozen && (
                <span style={styles.searchLoadingIndicator}>Searching...</span>
              )} */
								/*<div style={styles.noResults}>Searching...</div>
              */}
						</div>
						{showSearchPopup && !isEffectivelyFrozen && (
							<div style={styles.searchPopup}>
								<div style={styles.searchPopupInner}>
									{isSearchLoading
										? (<div style={styles.noResults}>&nbsp;</div>)
										: filteredContainers.length > 0
											? (filteredContainers.map(container => (
												<div
													key={container.id}
													style={{
														...styles.searchItem,
														background: hoveredSearchItem === container.id ? PEARL : 'transparent',
													}}
													onClick={() => handleSearchItemClick(container)}
													onMouseEnter={() => handleSearchItemMouseEnter(container.id)}
													onMouseLeave={handleSearchItemMouseLeave}
													title={container.name} // Show full name on hover
												>
													{container.name}
												</div>
											)))
											: (<div style={styles.noResults}>No matching containers found</div>)
									}
								</div>
							</div>
						)}
					</div>
					<div style={styles.orText}>or</div>
					<div
						style={{
							...styles.dragArea,
							...(isDragging && !isEffectivelyFrozen ? styles.dragAreaActive : {}),
							opacity: isEffectivelyFrozen ? 0.5 : 1,
							cursor: isEffectivelyFrozen ? 'not-allowed' : 'default'
						}}
						onDragOver={!isEffectivelyFrozen ? handleDragOver : e => e.preventDefault()}
						onDragLeave={!isEffectivelyFrozen ? handleDragLeave : e => e.preventDefault()}
						onDrop={!isEffectivelyFrozen ? handleDrop : e => e.preventDefault()}
					>
						<img src={RegisDragPath} alt="Drag" style={{ width: '2.125rem', height: '2.5rem' }} />
						{isEffectivelyFrozen ? 'Initializing Session...' : 'Drag PDF File Here'}
					</div>
				</div>

				<div style={styles.modelSection}>
					<label style={styles.label}>Select Your Model</label>
					<div style={styles.modelTypeRow}>
						<button
							ref={buttonRef}
							style={{
								all: 'revert',
								...getModelTypeButtonStyle(selectedType === 'lite'),
								opacity: isEffectivelyFrozen ? 0.5 : 1,
								cursor: isEffectivelyFrozen ? 'not-allowed' : 'pointer'
							}}
							onClick={() => !isEffectivelyFrozen && handleTypeSelection('lite')}
							disabled={isEffectivelyFrozen}
						>
							<img src={BasicPath} alt="Standard" style={{ width: '1.5rem', height: '1.5rem' }} />
              STANDARD
						</button>
						<button
							ref={buttonRef}
							style={{
								all: 'revert',
								...getModelTypeButtonStyle(selectedType === 'normal'),
								opacity: (isEffectivelyFrozen || fileList.length > 1) ? 0.5 : 1,
								cursor: (isEffectivelyFrozen || fileList.length > 1) ? 'not-allowed' : 'pointer'
							}}
							onClick={() => !(isEffectivelyFrozen || fileList.length > 1) && handleTypeSelection('normal')}
							disabled={isEffectivelyFrozen || fileList.length > 1}
							title={fileList.length > 1 ? "Advanced mode is not available with multiple files" : ""}
						>
							<img src={AdvancedPath} alt="Advanced" style={{ width: '1.5rem', height: '1.5rem' }} />
              ADVANCED
						</button>
					</div>
					{selectedType === 'lite' && (
						<div style={styles.modelDescription}>
							<div style={styles.modelFeature}>
								<span style={styles.modelIcon}>🙌</span>
								<span>Our quickest model - for general paper reading.</span>
							</div>
							<div style={styles.modelLimitations}>
								<span>✅ Free for all users</span>
								<span>✅ Process raw text the fastest</span>
								<span>✅ Source content highlight</span>
								<span>✅ Multiple files understanding</span>
							</div>
						</div>
					)}
					{selectedType === 'normal' && (
						<div style={styles.modelDescription}>
							<div style={styles.modelFeature}>
								<span style={styles.modelIcon}>🙌</span>
								<span>Our more powerful model - for deeper understanding.</span>
							</div>
							<div style={styles.modelLimitations}>
								<span>✅ Image understanding</span>
								<span>✅ Inference mode with DeepSeek</span>
								<span>✅ Higher quality summary</span>
								<span>✅ Markdown based RAG model</span>
								<span>✅ Available with Premium Subscription</span>
							</div>
						</div>
					)}

				</div>
			</div>

			<button
				style={{
					...createButtonDynamicStyle,
					opacity: isEffectivelyFrozen ? 0.8 : 1,
					cursor: isEffectivelyFrozen ? 'not-allowed' : 'pointer',
					background: isEffectivelyFrozen ? '#6B7B84' : (isCreateHovered ? '#007BD5' : SKY)
				}}
				onClick={!isEffectivelyFrozen ? handleSubmit : undefined}
				onMouseEnter={!isEffectivelyFrozen ? handleCreateMouseEnter : undefined}
				onMouseLeave={!isEffectivelyFrozen ? handleCreateMouseLeave : undefined}
				disabled={isEffectivelyFrozen}
			>
				{isEffectivelyFrozen ? 'Initializing...' : 'Create'}
			</button>

			{errorMessage && (
				<div style={{
					width: '100%',
					maxWidth: '26rem',
					padding: '0.75rem',
					marginBottom: '1rem',
					backgroundColor: '#FEF2F2',
					border: '1px solid #FECACA',
					borderRadius: '0.5rem',
					color: '#DC2626',
					fontSize: '0.875rem',
					textAlign: 'center'
				}}>
					{errorMessage}
				</div>
			)}
		</div>
	);
});

export default ModelSelection;
