import React from 'react';

const AQUA = '#0AE2FF';
const SKY = '#0687E5';
const styles = {
  container: {
    width: '100%',
    minHeight: '80%',
    background: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '16px 0',
    position: 'relative',
  },
  title: {
    background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: SKY,
    fontWeight: 700,
    fontSize: '24px',
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    marginBottom: '18px',
    marginTop: '8px',
  },
  image: {
    width: '110px',
    height: '110px',
    objectFit: 'contain',
    margin: '0 auto 18px auto',
    display: 'block',
  },
  text: {
    fontSize: '17px',
    color: '#222',
    textAlign: 'center',
    margin: '0 0 18px 0',
    fontFamily: 'Roboto, sans-serif',
    fontWeight: 400,
    lineHeight: '1.5',
  },
  button: {
    background: SKY,
    color: '#fff',
    width: '90%',
    minHeight: '2.4375rem',
    fontWeight: 700,
    fontSize: '16px',
    border: 'none',
    borderRadius: '10px',
    padding: '14px 0',
    margin: '18px auto 0 auto',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    display: 'block',
  },
};

export default function DeepTutorSubscriptionConfirm({ onClose, imagePath }) {
  return (
    <div style={styles.container}>
      <div style={styles.title}>Upgrade Successfully!</div>
      <img src={imagePath} alt="Subscription Confirm" style={styles.image} />
      <div style={styles.text}>Your Support for DeepTutor<br />is greatly appreciated!</div>
      <button style={styles.button} onClick={onClose}>Start Using Premium</button>
    </div>
  );
}
