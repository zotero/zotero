import React, { useState, useEffect } from 'react';
import { 
  getUserById, 
  getPreSignedUrl, 
  createSession 
} from './api/libs/api';

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
    gap: 20,
    width: '100%',
    height: '100%',
    maxHeight: 'calc(100vh - 100px)', // Account for Zotero pane header
    background: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    borderRadius: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
    padding: '16px',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  title: {
    background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: SKY,
    fontWeight: 700,
    fontSize: '1.2em',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.2,
    width: '100%',
  },
  section: {
    width: '100%',
    maxWidth: 390,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontWeight: 500,
    color: '#000000',
    marginBottom: 2,
    fontSize: '1em',
  },
  input: {
    width: '100%',
    padding: '16px',
    borderRadius: 10,
    border: `1px solid ${LIGHT_GREY2}`,
    background: PEARL,
    fontSize: '1em',
    fontFamily: 'Roboto, sans-serif',
    outline: 'none',
  },
  searchArea: {
    width: '100%',
    maxWidth: 390,
    background: PEARL,
    borderRadius: 10,
    border: `1px solid ${LIGHT_GREY2}`,
    display: 'flex',
    alignItems: 'center',
    padding: '12px 15px',
    margin: '8px 0',
    fontSize: '1em',
    color: '#292929',
    gap: 10,
  },
  searchIcon: {
    width: 24,
    height: 24,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '1em',
    fontFamily: 'Roboto, sans-serif',
    color: '#292929',
  },
  contextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    margin: '8px 0',
  },
  uploadButton: {
    background: SKY,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    padding: '8px 18px',
    fontSize: '1em',
    cursor: 'pointer',
    fontFamily: 'Roboto, sans-serif',
    minWidth: 0,
    minHeight: 0,
  },
  orText: {
    color: '#888',
    fontWeight: 500,
    fontSize: '1em',
    textAlign: 'center',
    minWidth: 32,
  },
  dragArea: {
    border: `1.5px dashed ${LIGHT_GREY2}`,
    borderRadius: 10,
    background: PEARL,
    minHeight: 91,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
    fontSize: '1em',
    margin: '8px 0',
    width: '100%',
    flexDirection: 'column',
    gap: 6,
    transition: 'border-color 0.2s, background 0.2s',
  },
  dragAreaActive: {
    borderColor: SKY,
    background: '#F0F9FF',
  },
  modelTypeRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 0,
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
  },
  modelTypeButton: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: '1em',
    cursor: 'pointer',
    background: PEARL,
    color: '#292929',
    transition: 'background 0.2s, color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  modelTypeButtonSelected: {
    background: '#0AE2FF',
    color: '#292929',
    fontWeight: 700,
  },
  createButton: {
    width: '100%',
    maxWidth: 390,
    margin: '32px auto 0 auto',
    padding: '14px 0',
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1em',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    transition: 'background 0.2s',
    display: 'block',
  },
  modelDescription: {
    marginTop: 5,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  modelFeature: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: '0.9em',
    color: '#000000',
  },
  modelIcon: {
    width: 16,
    height: 16,
  },
  modelLimitations: {
    marginTop: 5,
    color: '#000000',
    fontSize: '0.9em',
  },
  searchContainer: {
    position: 'relative',
    width: '100%',
  },
  searchPopup: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: '200px',
    overflowY: 'auto',
    background: '#FFFFFF',
    border: `1px solid ${LIGHT_GREY2}`,
    borderRadius: 8,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    zIndex: 1000,
    marginTop: 4,
  },
  searchItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '0.9em',
    color: '#292929',
    transition: 'background 0.2s',
    '&:hover': {
      background: PEARL,
    },
  },
  searchItemSelected: {
    background: PEARL,
  },
  noResults: {
    padding: '8px 12px',
    color: '#888',
    fontSize: '0.9em',
    textAlign: 'center',
  },
  fileListButton: {
    background: SKY,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    padding: '8px 18px',
    fontSize: '1em',
    cursor: 'pointer',
    fontFamily: 'Roboto, sans-serif',
    minWidth: 0,
    minHeight: 0,
  },
  fileListPopup: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: '300px',
    maxHeight: '300px',
    overflowY: 'auto',
    background: '#FFFFFF',
    border: `1px solid ${LIGHT_GREY2}`,
    borderRadius: 8,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    zIndex: 1000,
    marginTop: 4,
    padding: '8px',
  },
  fileListItem: {
    padding: '8px',
    borderBottom: `1px solid ${LIGHT_GREY2}`,
    fontSize: '0.9em',
    color: '#292929',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileListRemove: {
    color: '#ff4444',
    cursor: 'pointer',
    fontSize: '1.2em',
    padding: '0 4px',
  },
  fileListEmpty: {
    padding: '8px',
    color: '#888',
    fontSize: '0.9em',
    textAlign: 'center',
  },
};

function ModelSelection({ onSubmit }) {
  const [fileList, setFileList] = useState([]);
  const [originalFileList, setOriginalFileList] = useState([]);
  const [modelName, setModelName] = useState('');
  const [selectedType, setSelectedType] = useState('lite');
  const [searchValue, setSearchValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [attachmentNames, setAttachmentNames] = useState([]);
  const [filteredAttachments, setFilteredAttachments] = useState([]);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [showFileList, setShowFileList] = useState(false);

  // Add debug logging for fileList changes
  useEffect(() => {
    Zotero.debug(`ModelSelection: fileList updated - length: ${fileList.length}`);
    fileList.forEach((file, index) => {
      Zotero.debug(`ModelSelection: fileList[${index}] - id: ${file.id}, name: ${file.name}`);
    });
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
      setFileList(prev => [...prev, { id: item.id, name: fileName }]);
      setOriginalFileList(prev => [...prev, item]);
      
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
      setFileList(prev => [
        ...prev,
        ...validResults.map(result => ({ 
          id: result.id,
          name: result.name
        }))
      ]);

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
    if (!modelName.trim()) {
      Zotero.debug("ModelSelection: Model name is required");
      return;
    }

    try {
      // Get user ID from API
      const userData = await getUserById('67f5b836cb8bb15b67a1149e');
      Zotero.debug('ModelSelection: Fetched user data:', userData);

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
            const preSignedUrlData = await getPreSignedUrl(userData.id, fileName);
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
        userId: userData.id,
        sessionName: modelName || "New Session",
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
          const newList = [
            ...prev,
            ...validResults.map(result => ({ 
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

  return (
    <div style={styles.container}>
      <div style={styles.title}>Create a new session</div>

      <div style={styles.section}>
        <label style={styles.label}>Name Your Session</label>
        <input
          type="text"
          value={modelName}
          onChange={e => setModelName(e.target.value)}
          style={styles.input}
          placeholder="Default Name According to the Paper Title"
        />
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Add Context</label>
        <div style={styles.searchContainer}>
          <div style={styles.searchArea}>
            <svg style={styles.searchIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="7" stroke="#0687E5" strokeWidth="2" />
              <line x1="16.2" y1="16.2" x2="20" y2="20" stroke="#0687E5" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              style={styles.searchInput}
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder="Search for an Item"
            />
          </div>
          {showSearchPopup && (
            <div style={styles.searchPopup}>
              {filteredAttachments.length > 0 ? (
                filteredAttachments.map(attachment => (
                  <div
                    key={attachment.id}
                    style={styles.searchItem}
                    onClick={() => handleSearchItemClick(attachment)}
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
        <div style={styles.contextRow}>
          <button style={styles.uploadButton}>Upload</button>
          <span style={styles.orText}>or</span>
          <button style={styles.uploadButton}>Upload2</button>
          <span style={styles.orText}>or</span>
          <div style={{ position: 'relative' }}>
            <button 
              style={styles.fileListButton}
              onClick={() => setShowFileList(!showFileList)}
            >
              File List
            </button>
            {showFileList && (
              <div style={styles.fileListPopup}>
                {fileList.length > 0 ? (
                  fileList.map(file => (
                    <div key={file.id} style={styles.fileListItem}>
                      <span>{file.name}</span>
                      <span 
                        style={styles.fileListRemove}
                        onClick={() => handleRemoveFile(file.id)}
                      >
                        ×
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={styles.fileListEmpty}>No files selected</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div 
          style={{
            ...styles.dragArea,
            ...(isDragging ? styles.dragAreaActive : {})
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span style={{fontSize: '1.2em', opacity: 0.7}}>📄</span>
          Drag an Item Here
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Select Your Model</label>
        <div style={styles.modelTypeRow}>
          <button
            style={{
              ...styles.modelTypeButton,
              ...(selectedType === 'lite' ? styles.modelTypeButtonSelected : {})
            }}
            onClick={() => handleTypeSelection('lite')}
          >
            <span>🚫</span>
            LITE
          </button>
          <button
            style={{
              ...styles.modelTypeButton,
              ...(selectedType === 'normal' ? styles.modelTypeButtonSelected : {})
            }}
            onClick={() => handleTypeSelection('normal')}
          >
            <span>➕</span>
            STANDARD
          </button>
          <button
            style={{
              ...styles.modelTypeButton,
              ...(selectedType === 'advanced' ? styles.modelTypeButtonSelected : {})
            }}
            onClick={() => handleTypeSelection('advanced')}
          >
            <span>⚡</span>
            ADVANCED
          </button>
        </div>
        {selectedType === 'lite' && (
          <div style={styles.modelDescription}>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>⚡</span>
              Our quickest model - for a quick grasp of the content.
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Free for all users
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Process raw text the fastest
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Source content highlight
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Multiple files understanding
            </div>
          </div>
        )}
        {selectedType === 'normal' && (
          <div style={styles.modelDescription}>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>🙌</span>
              Popular model - Great for most papers
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Image understanding
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Inference mode with DeepSeek
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Higher quality summary
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Markdown based RAG model
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>💰</span>
              Available with Premium Subscription
            </div>
          </div>
        )}
        {selectedType === 'advanced' && (
          <div style={styles.modelDescription}>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>⚡</span>
              Deep but Slow - Our most powerful model. It will take 5 - 10 min to prepare the content
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Everything in standard mode
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Deeper understanding on figures, equations, tables and graphs
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              Further enhanced context relavency
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>✅</span>
              More advanced model using GraphRAG
            </div>
            <div style={styles.modelFeature}>
              <span style={styles.modelIcon}>💰</span>
              Available with Premium Subscription
            </div>
          </div>
        )}
      </div>

      <button style={styles.createButton} onClick={handleSubmit}>
        Create
      </button>
    </div>
  );
}

export default ModelSelection;