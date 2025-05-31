import React from 'react';

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
    fontSize: '16px',
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
    fontWeight: 700,
    fontSize: '16px',
    border: 'none',
    borderRadius: '10px',
    padding: '14px 0',
    width: '90%',
    margin: '18px auto 0 auto',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    display: 'block',
  },
  cancelButton: {
    background: '#fff',
    color: SKY,
    fontWeight: 700,
    fontSize: '16px',
    border: `2px solid ${SKY}`,
    borderRadius: '10px',
    padding: '14px 0',
    width: '90%',
    margin: '12px auto 0 auto',
    cursor: 'pointer',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    display: 'block',
  },
};

export default function DeepTutorManageSubscription({ imagePath, onManage, onCancel }) {
  return (
    <div style={styles.container}>
      <div style={styles.title}>Manage Subscription</div>
      <img src={imagePath} alt="Manage Subscription" style={styles.image} />
      <div style={styles.text}>
        You can add or modify your payment method,<br />
        changing your billing information, view your payment<br />
        history or cancel your subscription here.
      </div>
      <button style={styles.button} onClick={onManage}>Manage</button>
      <button style={styles.cancelButton} onClick={onCancel}>Cancel</button>
    </div>
  );
}
