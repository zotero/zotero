import React, { useState } from 'react';

const PEARL = '#F2F2F2';
const SKY = '#0687E5';
const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: PEARL,
    fontFamily: 'Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    position: 'absolute',
    top: '1.5rem',
    left: '2rem',
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
    width: '1.375rem',
    height: '1.375rem',
    marginLeft: '0.25rem',
    marginTop: '0.125rem',
  },
  folderBg: {
    position: 'absolute',
    width: '18%',
    height: 'auto',
    bottom: '33%',
    left: '31%',
    opacity: 0.8,
    zIndex: 0,
  },
  pageBg: {
    position: 'absolute',
    width: '15%',
    height: 'auto',
    top: '27%',
    right: '25%',
    opacity: 0.8,
    zIndex: 0,
  },
  contentWrapper: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    zIndex: 1,
  },
  mainTextWrapper: {
    width: '100%',
    marginBottom: '0.625rem',
    display: 'flex',
    justifyContent: 'center',
  },
  subTextWrapper: {
    width: '100%',
    marginBottom: '0.625rem',
    display: 'flex',
    justifyContent: 'center',
  },
  descTextWrapper: {
    width: '100%',
    marginBottom: '1.875rem',
    display: 'flex',
    justifyContent: 'center',
  },
  buttonWrapper: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  mainText: {
    width: '100%',
    fontWeight: 700,
    fontSize: '1.375rem',
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    color: '#292929',
  },
  subText: {
    width: '100%',
    fontWeight: 600,
    fontSize: '1rem',
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    color: '#292929',
  },
  descText: {
    width: '100%',
    fontWeight: 400,
    fontSize: '0.875rem',
    lineHeight: '135%',
    letterSpacing: '0%',
    textAlign: 'center',
    color: '#292929',
  },
  signInButton: {
    all: 'revert',
    background: SKY,
    color: '#fff',
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
  },
  signUpButton: {
    all: 'revert',
    background: '#fff',
    color: SKY,
    fontWeight: 700,
    fontSize: '1em',
    border: `0.0625rem solid ${SKY}`,
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
    marginTop: '0.625rem',
  },
};

const FolderImg = 'chrome://zotero/content/DeepTutorMaterials/Welcome/WELCOME_FOLDER.svg';
const PageImg = 'chrome://zotero/content/DeepTutorMaterials/Welcome/WELCOME_PAGE.svg';

export default function DeepTutorWelcomePane({ onWelcomeSignIn, onWelcomeSignUp }) {
  const [isSignInHovered, setIsSignInHovered] = useState(false);
  const [isSignUpHovered, setIsSignUpHovered] = useState(false);

  const handleSignInMouseEnter = () => setIsSignInHovered(true);
  const handleSignInMouseLeave = () => setIsSignInHovered(false);

  const handleSignUpMouseEnter = () => setIsSignUpHovered(true);
  const handleSignUpMouseLeave = () => setIsSignUpHovered(false);

  const signInButtonStyle = {
    ...styles.signInButton,
    background: isSignInHovered ? '#007BD5' : SKY,
  };

  const signUpButtonStyle = {
    ...styles.signUpButton,
    background: isSignUpHovered ? '#F8F6F7' : '#fff',
  };

  return (
    <div style={styles.container}>
      {/* Background Images */}
      <img src={FolderImg} alt="Folder" style={styles.folderBg} />
      <img src={PageImg} alt="Page" style={styles.pageBg} />
      {/* Content Section */}
      <div style={styles.contentWrapper}>
        <div style={styles.mainTextWrapper}>
          <div style={styles.mainText}>Start Chatting with DeepTutor</div>
        </div>
        <div style={styles.subTextWrapper}>
          <div style={styles.subText}>Sign in to read papers more efficiently</div>
        </div>
        <div style={styles.descTextWrapper}>
          <div style={styles.descText}>
            Get accurate answers and deep summaries, and save<br />
            reading history to build a personalized learning tool.
          </div>
        </div>
        <div style={styles.buttonWrapper}>
          <button
            style={signInButtonStyle}
            onMouseEnter={handleSignInMouseEnter}
            onMouseLeave={handleSignInMouseLeave}
            onClick={onWelcomeSignIn}
          >
            Sign in
          </button>
        </div>
        <div style={styles.buttonWrapper}>
          <button
            style={signUpButtonStyle}
            onMouseEnter={handleSignUpMouseEnter}
            onMouseLeave={handleSignUpMouseLeave}
            onClick={onWelcomeSignUp}
          >
            Create a new account
          </button>
        </div>
      </div>
    </div>
  );
} 