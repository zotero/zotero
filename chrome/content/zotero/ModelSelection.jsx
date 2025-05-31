import React, { useState } from 'react';

const buttonStyle = {
  background: '#2c25ac',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 600,
  padding: '4px 8px',
  fontSize: '11px',
  cursor: 'pointer',
  minWidth: 0,
  minHeight: 0,
};

const fileButtonStyle = {
  background: '#f8f9fa',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  padding: '4px 8px',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  margin: '2px 0',
  display: 'flex',
};

const removeButtonStyle = {
  color: '#dc3545',
  fontWeight: 'bold',
  fontSize: '16px',
  cursor: 'pointer',
  padding: '0 4px',
  background: 'none',
  border: 'none',
};

const modelTypeButtonBase = {
  flex: 1,
  padding: '6px 0',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 600,
  fontSize: '1em',
  cursor: 'pointer',
  background: '#e0e0e0',
  color: '#444',
};

const selectedModelTypeButton = {
  background: '#2c25ac',
  color: '#fff',
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    width: '100%',
    height: '100%',
    maxHeight: '80vh',
    background: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    borderRadius: '0.625rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
    padding: '1.25rem',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflowY: 'auto',
    overflowX: 'hidden',
    position: 'relative',
  },
  section: {
    width: '100%',
    maxWidth: '90%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontWeight: 400,
    fontSize: '0.875rem',
    lineHeight: '135%',
    letterSpacing: '0%',
    verticalAlign: 'middle',
    color: '#000000',
    marginBottom: '0.125rem',
  },
  modelDescription: {
    marginTop: '0.3125rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3125rem',
    width: '90%',
    height: 'auto',
  },
  modelFeature: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.3125rem',
    fontSize: '0.875rem',
    lineHeight: '135%',
    letterSpacing: '0%',
    color: '#000000',
    height: 'auto',
    width: '100%',
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
    fontSize: '0.875rem',
    lineHeight: '135%',
    letterSpacing: '0%',
    width: '90%',
    height: 'auto',
  },
  createButton: {
    ...buttonStyle,
    marginTop: '1rem',
  },
};

function ModelSelection({ onSubmit }) {
  const [fileList, setFileList] = useState([]);
  const [modelName, setModelName] = useState('');
  const [selectedType, setSelectedType] = useState('normal');

  // Placeholder for file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    // For now, just add file names to the list
    setFileList(prev => [
      ...prev,
      ...files.map((file, idx) => ({ id: `${file.name}-${Date.now()}-${idx}`, name: file.name }))
    ]);
  };

  const handleRemoveFile = (id) => {
    setFileList(prev => prev.filter(file => file.id !== id));
  };

  const handleTypeSelection = (type) => {
    setSelectedType(type);
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({ fileList, name: modelName, type: selectedType });
    }
    // Otherwise, just log for now
    // console.log({ fileList, name: modelName, type: selectedType });
  };

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        {/* Upload Button Section */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
          <label style={buttonStyle}>
            Upload
            <input type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
        </div>

        {/* File List Section */}
        <div style={{ maxHeight: 100, border: '1px solid #e0e0e0', borderRadius: 4, background: 'white', padding: 4, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {fileList.map(file => (
              <div key={file.id} style={fileButtonStyle}>
                <span style={{ flex: 1, marginRight: 8 }}>{file.name}</span>
                <button style={removeButtonStyle} onClick={() => handleRemoveFile(file.id)}>&times;</button>
              </div>
            ))}
          </div>
        </div>

        {/* Model Name Section */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontWeight: 'bold', marginBottom: 4 }}>Model Name</label>
          <input
            type="text"
            value={modelName}
            onChange={e => setModelName(e.target.value)}
            style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid #e0e0e0' }}
          />
        </div>

        {/* Model Type Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <label style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Model Type</label>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              style={{ ...modelTypeButtonBase, ...(selectedType === 'lite' ? selectedModelTypeButton : {}), flex: 1 }}
              onClick={() => handleTypeSelection('lite')}
            >
              Lite
            </button>
            <button
              style={{ ...modelTypeButtonBase, ...(selectedType === 'normal' ? selectedModelTypeButton : {}), flex: 1 }}
              onClick={() => handleTypeSelection('normal')}
            >
              Normal
            </button>
            <button
              style={{ ...modelTypeButtonBase, ...(selectedType === 'advanced' ? selectedModelTypeButton : {}), flex: 1 }}
              onClick={() => handleTypeSelection('advanced')}
            >
              Advanced
            </button>
          </div>
        </div>
      </div>

      {/* Model Descriptions */}
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
          </div>
        </div>
      )}

      <button style={{ ...styles.createButton, width: '90%', maxWidth: '12rem' }} onClick={handleSubmit}>
        Create
      </button>
    </div>
  );
}

export default ModelSelection;
