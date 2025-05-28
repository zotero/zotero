import React from 'react';

const AQUA = '#0AE2FF';
const SKY = '#0687E5';
const GREEN = '#22C55E';
const styles = {
  container: {
    width: '100%',
    minHeight: 400,
    background: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 0',
  },
  title: {
    background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: SKY, // fallback
    fontWeight: 700,
    fontSize: '1.35em',
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: 0.2,
  },
  premium: {
    color: SKY,
    fontWeight: 700,
    fontSize: '1.1em',
    marginBottom: 8,
    textAlign: 'center',
  },
  price: {
    fontWeight: 700,
    fontSize: '2.3em',
    color: '#222',
    marginBottom: 2,
    textAlign: 'center',
    lineHeight: 1.1,
  },
  monthly: {
    color: '#444',
    fontWeight: 500,
    fontSize: '1em',
    marginBottom: 18,
    textAlign: 'center',
  },
  featureList: {
    width: '100%',
    maxWidth: 340,
    margin: '0 auto 24px auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '1.08em',
    color: '#222',
    fontWeight: 500,
    gap: 10,
  },
  greenSquare: {
    width: 18,
    height: 18,
    background: GREEN,
    borderRadius: 4,
    display: 'inline-block',
    marginRight: 8,
  },
  button: {
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1em',
    border: 'none',
    borderRadius: 10,
    padding: '14px 0',
    width: 320,
    margin: '0 auto',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    display: 'block',
    marginTop: 18,
  },
};

export default function DeepTutorUpgradePremium() {
  return (
    <div style={styles.container}>
      <div style={styles.title}>Upgrade Your Plan</div>
      <div style={styles.premium}>Premium</div>
      <div style={styles.price}>$14.99</div>
      <div style={styles.monthly}>monthly</div>
      <div style={styles.featureList}>
        <div style={styles.featureRow}><span style={styles.greenSquare}></span>Unlimited Lite Mode</div>
        <div style={styles.featureRow}><span style={styles.greenSquare}></span>Unlimited Standard Mode sessions</div>
        <div style={styles.featureRow}><span style={styles.greenSquare}></span>Unlimited Advanced Mode sessions</div>
        <div style={styles.featureRow}><span style={styles.greenSquare}></span>Up to 100 pages and 30Mb/file</div>
      </div>
      <button style={styles.button}>Get Premium</button>
    </div>
  );
} 