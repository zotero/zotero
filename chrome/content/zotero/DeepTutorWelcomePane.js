import React from 'react';

const PEARL = '#F2F2F2';
const SKY = '#0687E5';
const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 480,
    background: PEARL,
    fontFamily: 'Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoRow: {
    position: 'absolute',
    top: 24,
    left: 32,
    fontWeight: 700,
    fontSize: '1.5em',
    display: 'flex',
    alignItems: 'center',
    letterSpacing: 0.2,
  },
  logoText: {
    fontWeight: 700,
    fontSize: '1.5em',
    color: '#222',
    fontFamily: 'Roboto, sans-serif',
  },
  logoIcon: {
    width: 22,
    height: 22,
    marginLeft: 4,
    marginTop: 2,
  },
  folderBg: {
    position: 'absolute',
    left: '18%',
    bottom: '18%',
    width: 140,
    opacity: 0.13,
    zIndex: 0,
  },
  pageBg: {
    position: 'absolute',
    right: '18%',
    top: '18%',
    width: 120,
    opacity: 0.13,
    zIndex: 0,
  },
  mainText: {
    marginTop: 120,
    marginBottom: 16,
    fontWeight: 700,
    fontSize: '1.25em',
    color: '#222',
    textAlign: 'center',
    zIndex: 1,
  },
  subText: {
    fontWeight: 500,
    fontSize: '1.1em',
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
    zIndex: 1,
  },
  descText: {
    fontWeight: 400,
    fontSize: '1em',
    color: '#444',
    textAlign: 'center',
    marginBottom: 32,
    zIndex: 1,
  },
  signInButton: {
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1em',
    border: 'none',
    borderRadius: 10,
    padding: '14px 0',
    width: 240,
    margin: '0 auto',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    zIndex: 1,
    display: 'block',
  },
};

const FolderImg = 'chrome://zotero/content/DeepTutorMaterials/Welcome/Folder.png';
const PageImg = 'chrome://zotero/content/DeepTutorMaterials/Welcome/Page.png';


export default function DeepTutorWelcomePane({ onWelcomeSignIn }) {
  return (
    <div style={styles.container}>
      {/* Background Images */}
      <img src={FolderImg} alt="Folder" style={styles.folderBg} />
      <img src={PageImg} alt="Page" style={styles.pageBg} />
      {/* Main Text */}
      <div style={styles.mainText}>Start Chatting with DeepTutor.</div>
      <div style={styles.subText}>Sign in to read papers more <b>efficiently</b></div>
      <div style={styles.descText}>
        ask questions, get instant explanations and summaries,<br />
        and save your chat history for future reference.
      </div>
      <button style={styles.signInButton} onClick={onWelcomeSignIn}>Sign in</button>
    </div>
  );
} 