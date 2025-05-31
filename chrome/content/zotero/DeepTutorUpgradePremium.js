import React from 'react';

const AQUA = '#0AE2FF';
const SKY = '#0687E5';
const GREEN = '#22C55E';
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
  titleSection: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    paddingTop: '12px',
    paddingLeft: '20px',
    paddingRight: '20px',
    marginBottom: '8px',
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
  },
  contentFrame: {
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '0 8px',
  },
  headerFrame: {
    width: '100%',
    height: '15%',
    minHeight: '85px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  premium: {
    color: SKY,
    fontWeight: 700,
    fontSize: '16px',
    lineHeight: '23px',
    textAlign: 'left',
    width: '100%',
  },
  priceFrame: {
    width: '100%',
    height: '52px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: '10px',
  },
  price: {
    fontWeight: 700,
    fontSize: '36px',
    lineHeight: '52px',
    color: '#333333',
    margin: 0,
  },
  monthly: {
    color: '#AFAFAF',
    fontWeight: 500,
    fontSize: '14px',
    lineHeight: '19px',
    margin: 0,
    paddingBottom: '8px',
  },
  featureList: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    lineHeight: '22px',
    color: '#000000',
    fontWeight: 500,
    gap: '8px',
  },
  greenSquare: {
    width: '18px',
    height: '18px',
    background: GREEN,
    borderRadius: '4px',
    display: 'inline-block',
    marginRight: '8px',
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
    margin: '18px auto',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    display: 'block',
  },
};

export default function DeepTutorUpgradePremium({ onUpgradeSuccess }) {
  return (
    <div style={styles.container}>
      <div style={styles.contentFrame}>
        <div style={styles.headerFrame}>
          <div style={styles.premium}>Premium</div>
          <div style={styles.priceFrame}>
            <div style={styles.price}>$14.99</div>
            <div style={styles.monthly}>monthly</div>
          </div>
        </div>
        <div style={styles.featureList}>
          <div style={styles.featureRow}>✅ Unlimited Lite Mode</div>
          <div style={styles.featureRow}>✅ Unlimited Standard Mode sessions</div>
          <div style={styles.featureRow}>✅ Unlimited Advanced Mode sessions</div>
          <div style={styles.featureRow}>✅ Up to 100 pages and 30Mb/file</div>
        </div>
      </div>
      <button style={styles.button} onClick={onUpgradeSuccess}>Get Premium</button>
    </div>
  );
} 