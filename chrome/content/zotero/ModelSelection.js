import React, { useState, useEffect, useRef } from 'react';
import { 
  getUserById, 
  getPreSignedUrl, 
  createSession 
} from './api/libs/api';
import { getCurrentUser } from './auth/cognitoAuth';

const DeleteImg = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_DELETE.svg';
const LitePath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_LITE.svg';
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
    BASIC: 'BASIC',
    ADVANCED: 'ADVANCED'
};

const PEARL = '#F8F6F7';
const SKY = '#0687E5';
const LIGHT_GREY2 = '#DADCE0';
const AQUA = '#0AE2FF';

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
    width: '100%',
    maxHeight: '53rem',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  section: {
    width: '100%',
    maxWidth: '26rem',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    marginBottom: '1.875rem',
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
    marginBottom: '0.625rem',
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
    marginBottom: '0.625rem',
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
    marginBottom: '1.25rem',
    justifyContent: 'space-between',
    gap: '0.25rem',
    boxSizing: 'border-box',
  },
  modelTypeButton: {
    flex: '1 1 0',
    minHeight: '3rem',
    borderRadius: '0.625rem',
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
    width: '8.125rem',
    maxWidth: '10rem',
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
    marginBottom: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3125rem',
    width: '100%',
    height: '11rem',
  },
  modelFeature: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.3125rem',
    fontSize: '1rem',
    lineHeight: '100%',
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
    marginTop: '0.3125rem',
    color: '#000000',
    fontSize: '1rem',
    lineHeight: '180%',
    fontWeight: '400',
    letterSpacing: '0%',
    width: '90%',
    height: 'auto',
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
    maxHeight: '12.5rem',
    overflowY: 'auto',
    background: '#FFFFFF',
    border: `0.0625rem solid ${LIGHT_GREY2}`,
    borderRadius: '0.5rem',
    boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
    zIndex: 1000,
    marginTop: '0.25rem',
  },
  searchItem: {
    padding: '0.5rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.9em',
    color: '#292929',
    transition: 'background 0.2s',
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

function ModelSelection({ onSubmit, user }) {
  const [fileList, setFileList] = useState([]);
  const [originalFileList, setOriginalFileList] = useState([]);
  const [modelName, setModelName] = useState('');
  const [backupModelName, setBackupModelName] = useState('Default Session');
  const [selectedType, setSelectedType] = useState('normal');
  const [searchValue, setSearchValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [attachmentNames, setAttachmentNames] = useState([]);
  const [filteredAttachments, setFilteredAttachments] = useState([]);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [showFileList, setShowFileList] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [buttonWidth, setButtonWidth] = useState(null);
  const [buttonLayout, setButtonLayout] = useState('row');
  const [isCreateHovered, setIsCreateHovered] = useState(false);
  const [hoveredSearchItem, setHoveredSearchItem] = useState(null);
  const buttonRef = useRef(null);

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

  // Update model name based on first file in fileList
  useEffect(() => {
    if (fileList.length > 0) {
      const firstName = fileList[0].name;
      setBackupModelName(firstName);
      Zotero.debug(`ModelSelection: Updated model name to: ${firstName}`);
    } else {
      setBackupModelName('Default Session');
      Zotero.debug('ModelSelection: Reset model name to Default Session');
    }
  }, [fileList]);

  // Load attachment names when component mounts
  useEffect(() => {
    const loadAttachmentNames = async () => {
      try {
        Zotero.debug("BBBBB: Loading attachment names");
        const libraryID = Zotero.Libraries.userLibraryID;
        Zotero.debug(`BBBBB: Using library ID: ${libraryID}`);
        
        const items = await Zotero.Items.getAll(libraryID);
        Zotero.debug(`BBBBB: Found ${items.length} total items`);
        
        const attachments = items.reduce((arr, item) => {
          if (item.isAttachment() && item.isPDFAttachment()) {
            const fileName = item.getField('title') || item.name || item.attachmentFilename;
            Zotero.debug(`BBBBB: Found PDF attachment: ${fileName}`);
            return arr.concat([{ id: item.id, name: fileName }]);
          }
          if (item.isRegularItem()) {
            return arr.concat(
              item.getAttachments()
                .map(x => Zotero.Items.get(x))
                .filter(x => x.isPDFAttachment())
                .map(x => ({ 
                  id: x.id, 
                  name: x.getField('title') || x.name || x.attachmentFilename 
                }))
            );
          }
          return arr;
        }, []);
        
        Zotero.debug(`BBBBB: Found ${attachments.length} PDF attachments`);
        setAttachmentNames(attachments);
      } catch (error) {
        Zotero.debug(`BBBBB: Error loading attachment names: ${error.message}`);
        Zotero.debug(`BBBBB: Error stack: ${error.stack}`);
      }
    };

    loadAttachmentNames();
  }, []);

  // Filter attachments when search value changes
  useEffect(() => {
    if (!searchValue.trim()) {
      setFilteredAttachments([]);
      setShowSearchPopup(false);
      return;
    }

    const searchTerm = searchValue.toLowerCase();
    const filtered = attachmentNames.filter(attachment => 
      attachment.name.toLowerCase().includes(searchTerm)
    );
    
    Zotero.debug(`BBBBB: Filtered ${filtered.length} attachments for search term: ${searchTerm}`);
    setFilteredAttachments(filtered);
    setShowSearchPopup(true);
  }, [searchValue, attachmentNames]);

  const handleSearchItemClick = async (attachment) => {
    try {
      Zotero.debug(`BBBBB: Selected attachment: ${attachment.name}`);
      const item = Zotero.Items.get(attachment.id);
      
      if (!item.isPDFAttachment()) {
        Zotero.debug(`BBBBB: Item is not a PDF attachment: ${attachment.name}`);
        return;
      }

      // Add to fileList with correct name property
      const fileName = item.getField('title') || item.name || item.attachmentFilename;
      Zotero.debug(`BBBBB: Using file name: ${fileName}`);
      
      setFileList(prev => {
        // Check if file ID already exists in the current list
        if (prev.some(existingFile => existingFile.id === item.id)) {
          Zotero.debug(`BBBBB: File ${fileName} already exists in fileList, skipping`);
          return prev;
        }
        return [...prev, { id: item.id, name: fileName }];
      });
      
      setOriginalFileList(prev => {
        // Check if file already exists in originalFileList
        if (prev.some(existingFile => existingFile.id === item.id)) {
          return prev;
        }
        return [...prev, item];
      });
      
      // Clear search
      setSearchValue('');
      setShowSearchPopup(false);
      
      Zotero.debug(`BBBBB: Added attachment to fileList: ${fileName}`);
    } catch (error) {
      Zotero.debug(`BBBBB: Error handling search item click: ${error.message}`);
    }
  };

  // Get model data in the same format as XUL version
  const getModelData = () => {
    return {
      fileList,
      name: modelName,
      type: selectedType,
      originalFileList
    };
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map((file, idx) => ({ 
      id: `${file.name}-${Date.now()}-${idx}`, 
      name: file.name 
    }));
    setFileList(prev => [...prev, ...newFiles]);
    setOriginalFileList(prev => [...prev, ...files]);
  };

  const handleUpload2 = async () => {
    try {
      Zotero.debug("ModelSelection: Starting Upload2 process");
      const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
      if (!selectedItems.length) {
        Zotero.debug("ModelSelection: No items selected");
        return;
      }

      const pdfAttachments = selectedItems.reduce((arr, item) => {
        if (item.isPDFAttachment()) {
          return arr.concat([item]);
        }
        if (item.isRegularItem()) {
          return arr.concat(item.getAttachments()
            .map(x => Zotero.Items.get(x))
            .filter(x => x.isPDFAttachment()));
        }
        return arr;
      }, []);

      if (!pdfAttachments.length) {
        Zotero.debug("ModelSelection: No PDF attachments found in selected items");
        return;
      }

      Zotero.debug(`ModelSelection: Found ${pdfAttachments.length} PDF attachments`);
      
      // Store original PDF attachments
      setOriginalFileList(pdfAttachments);

      // Process all PDFs concurrently using Promise.all
      const pdfProcessingPromises = pdfAttachments.map(async (pdf) => {
        try {
          const { text } = await Zotero.PDFWorker.getFullText(pdf.id);
          if (text) {
            const fileName = pdf.getField('title') || pdf.name || pdf.attachmentFilename;
            Zotero.debug(`NNNNN ModelSelection: Using file name: ${fileName}`);
            return {
              id: pdf.id,
              name: fileName,
              content: text.substring(0, 200)
            };
          }
          return null;
        } catch (e) {
          Zotero.debug(`ModelSelection: Error extracting text from PDF: ${e.message}`);
          return null;
        }
      });

      // Wait for all PDFs to be processed
      const results = await Promise.all(pdfProcessingPromises);
      
      // Filter out any null results and update fileList
      const validResults = results.filter(result => result !== null);
      setFileList(prev => {
        // Filter out results that already exist in the current fileList
        const newResults = validResults.filter(result => 
          !prev.some(existingFile => existingFile.id === result.id)
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

      Zotero.debug(`ModelSelection: Successfully processed ${validResults.length} PDFs`);
    } catch (error) {
      Zotero.debug(`ModelSelection: Error in handleUpload2: ${error.message}`);
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

    // Clear any existing error message
    setErrorMessage('');

    // Determine the final session name
    const finalSessionName = modelName.trim() || backupModelName || "Default Session";
    Zotero.debug(`ModelSelection: Using session name: ${finalSessionName}`);

    try {
      // Handle file uploads if fileList exists
      const uploadedDocumentIds = [];
      if (fileList.length > 0) {
        for (const file of originalFileList) {
          try {
            const fileName = file.name;
            Zotero.debug('ModelSelection: Processing file:', fileName);

            // Get the file as a Data URL and convert to Blob
            const dataURI = await file.attachmentDataURI;
            if (!dataURI) {
                throw new Error(`Failed to get file data for: ${fileName}`);
            }

            // Convert Data URL to Blob
            const response = await window.fetch(dataURI);
            const blob = await response.blob();
            Zotero.debug('ModelSelection: Converted file to Blob:', blob);

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
            
          } catch (fileError) {
            Zotero.debug('ModelSelection: Error uploading file:', fileError);
            continue;
          }
        }
      }

      // Create session data
      const sessionData = {
        userId: user.id,
        sessionName: finalSessionName,
        type: selectedType === 'lite' ? SessionType.LITE : 
              selectedType === 'advanced' ? SessionType.ADVANCED : 
              SessionType.BASIC,
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
        } catch (error) {
          Zotero.debug('ModelSelection0521: Error saving mapping to local storage:', error);
        }
      }

      // Call onSubmit with the session ID
      if (onSubmit) {
        onSubmit(createdSession.id);
      }

    } catch (error) {
      Zotero.debug('ModelSelection: Error creating session:', error);
      setErrorMessage('Failed to create session. Please try again.');
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
          return;
        }

        Zotero.debug(`BBBBB: Found ${pdfAttachments.length} total PDF attachments from dropped items`);
        Zotero.debug(`BBBBB: Current fileList length before update: ${fileList.length}`);
        
        // Store original PDF attachments
        setOriginalFileList(pdfAttachments);
        Zotero.debug("BBBBB: Updated originalFileList with PDF attachments");

        // Process all PDFs concurrently using Promise.all
        const pdfProcessingPromises = pdfAttachments.map(async (pdf) => {
          try {
            Zotero.debug(`BBBBB: Processing PDF: ${pdf.name}`);
            const { text } = await Zotero.PDFWorker.getFullText(pdf.id);
            if (text) {
              const fileName = pdf.getField('title') || pdf.name || pdf.attachmentFilename;
              Zotero.debug(`BBBBBF: Successfully extracted text from PDF: ${fileName}`);
              return {
                id: pdf.id,
                name: fileName,
                content: text.substring(0, 200)
              };
            }
            Zotero.debug(`BBBBB: No text extracted from PDF: ${pdf.name}`);
            return null;
          } catch (e) {
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
        
        setFileList(prev => {
          // Filter out results that already exist in the current fileList
          const newResults = validResults.filter(result => 
            !prev.some(existingFile => existingFile.id === result.id)
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
      } else {
        Zotero.debug("BBBBB: No 'zotero/item' found in dataTransfer types");
      }
    } catch (error) {
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

  const handleSearchItemMouseEnter = (id) => setHoveredSearchItem(id);
  const handleSearchItemMouseLeave = () => setHoveredSearchItem(null);

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
              style={styles.input1}
              placeholder={backupModelName}
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
                    <span style={styles.newFileListName}>{file.name}</span>
                    <button 
                      style={styles.newFileListDelete}
                      onClick={() => handleRemoveFile(file.id)}
                    >
                      <img src={DeleteImg} alt="Delete" width="24" height="24" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.searchContainer}>
            <div 
              style={styles.searchArea}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
            >
              <img src={RegisSearchPath} alt="Search" style={styles.searchIcon} />
              <input
                style={styles.searchInput}
                type="text"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder="Search for an Item"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
              />
            </div>
            {showSearchPopup && (
              <div style={styles.searchPopup}>
                {filteredAttachments.length > 0 ? (
                  filteredAttachments.map(attachment => (
                    <div
                      key={attachment.id}
                      style={{
                        ...styles.searchItem,
                        background: hoveredSearchItem === attachment.id ? PEARL : 'transparent',
                      }}
                      onClick={() => handleSearchItemClick(attachment)}
                      onMouseEnter={() => handleSearchItemMouseEnter(attachment.id)}
                      onMouseLeave={handleSearchItemMouseLeave}
                    >
                      {attachment.name}
                    </div>
                  ))
                ) : (
                  <div style={styles.noResults}>No matching attachments found</div>
                )}
              </div>
            )}
          </div>
          <div style={styles.orText}>or</div>
          <div 
            style={{
              ...styles.dragArea,
              ...(isDragging ? styles.dragAreaActive : {})
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <img src={RegisDragPath} alt="Drag" style={{ width: '2.125rem', height: '2.5rem' }} />
            Drag an Item Here
          </div>
        </div>

        <div style={styles.modelSection}>
          <label style={styles.label}>Select Your Model</label>
          <div style={styles.modelTypeRow}>
            <button
              ref={buttonRef}
              style={getModelTypeButtonStyle(selectedType === 'lite')}
              onClick={() => handleTypeSelection('lite')}
            >
              <img src={LitePath} alt="Lite" style={{ width: '1.5rem', height: '1.5rem' }} />
              LITE
            </button>
            <button
              ref={buttonRef}
              style={getModelTypeButtonStyle(selectedType === 'normal')}
              onClick={() => handleTypeSelection('normal')}
            >
              <img src={BasicPath} alt="Basic" style={{ width: '1.5rem', height: '1.5rem' }} />
              STANDARD
            </button>
            <button
              ref={buttonRef}
              style={getModelTypeButtonStyle(selectedType === 'advanced')}
              onClick={() => handleTypeSelection('advanced')}
            >
              <img src={AdvancedPath} alt="Advanced" style={{ width: '1.5rem', height: '1.5rem' }} />
              ADVANCED
            </button>
          </div>
          {selectedType === 'lite' && (
            <div style={styles.modelDescription}>
              <div style={styles.modelFeature}>
                <span style={styles.modelIcon}>🙌</span>
                <span>Popular model - Great for most papers</span>
              </div>
              <div style={styles.modelFeature}>
                <span style={styles.modelIcon}>💰</span>
                <span>Free for all users</span>
              </div>
              <div style={styles.modelLimitations}>
                ❌ No summary<br />
                ❌ No image understanding<br />
                ❌ No advanced model like graphRAG<br />
                ❌ No source content
              </div>
            </div>
          )}
          {selectedType === 'normal' && (
            <div style={styles.modelDescription}>
              <div style={styles.modelFeature}>
                <span style={styles.modelIcon}>🙌</span>
                <span>Popular model - Great for most papers</span>
              </div>
              <div style={styles.modelFeature}>
                <span style={styles.modelIcon}>💰</span>
                <span>Available with Premium Subscription</span>
              </div>
              <div style={styles.modelLimitations}>
                ✅ Image understanding<br />
                ✅ Inference mode with DeepSeek<br />
                ✅ High quality summary<br />
                ✅ Source content highlight<br />
                ✅ Markdown based RAG model
              </div>
            </div>
          )}
          {selectedType === 'advanced' && (
            <div style={styles.modelDescription}>
              <div style={styles.modelFeature}>
                <span style={styles.modelIcon}>🙌</span>
                <span>Deep but Slow - Our most powerful model.<br />Take 5 - 10 min to prepare the content</span>
              </div>
              <div style={styles.modelFeature}>
                <span style={styles.modelIcon}>💰</span>
                <span>Available with Premium Subscription</span>
              </div>
              <div style={styles.modelLimitations}>
                ✅ Everything in standard mode<br />
                🌟 Deeper understanding on figures, equations, and tables<br />
                🌟 Further enhanced context relavency<br />
                🌟 More advanced model using GraphRAG
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        style={createButtonDynamicStyle}
        onClick={handleSubmit}
        onMouseEnter={handleCreateMouseEnter}
        onMouseLeave={handleCreateMouseLeave}
      >
        Create
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
}

export default ModelSelection;