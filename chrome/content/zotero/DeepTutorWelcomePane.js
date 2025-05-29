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
    width: '123.47px',
    height: '94.37px',
    top: '611.75px',
    left: '105px',
    opacity: 0.2,
    zIndex: 0,
  },
  pageBg: {
    position: 'absolute',
    width: '89px',
    height: '107.33px',
    top: '306px',
    left: '309.68px',
    opacity: 0.2,
    zIndex: 0,
  },
  textSection: {
    position: 'absolute',
    width: '346px',
    height: '183px',
    top: '298px',
    left: '62px',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    zIndex: 1,
  },
  mainText: {
    width: '346px',
    height: '28px',
    fontWeight: 700,
    fontSize: '20px',
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    color: '#292929',
  },
  subText: {
    width: '346px',
    height: '19px',
    fontWeight: 600,
    fontSize: '15px',
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    color: '#292929',
  },
  descText: {
    width: '346px',
    height: '38px',
    fontWeight: 400,
    fontSize: '12px',
    lineHeight: '135%',
    letterSpacing: '0%',
    textAlign: 'center',
    color: '#292929',
  },
  signInButton: {
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1em',
    border: 'none',
    borderRadius: '10px',
    width: '346px',
    height: '48px',
    padding: '10px 20px',
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
      {/* Text Section */}
      <div style={styles.textSection}>
        <div style={styles.mainText}>Start Chatting with DeepTutor.</div>
        <div style={styles.subText}>Sign in to read papers more efficiently</div>
        <div style={styles.descText}>
          ask questions, get instant explanations and summaries,<br />
          and save your chat history for future reference.
        </div>
        <button style={styles.signInButton} onClick={onWelcomeSignIn}>Sign in</button>
      </div>
    </div>
  );
} 