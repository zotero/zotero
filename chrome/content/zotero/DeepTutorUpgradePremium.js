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
    position: 'relative',
  },
  contentFrame: {
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  headerFrame: {
    width: '100%',
    height: '15%',
    minHeight: '5.3125rem',
    display: 'flex',
    flexDirection: 'column',
  },
  premium: {
    color: SKY,
    fontWeight: 700,
    fontSize: '1rem',
    lineHeight: '1.4375rem',
    textAlign: 'left',
    width: '100%',
    marginBottom: '0.625rem',
  },
  priceFrame: {
    width: '100%',
    height: '3.25rem',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: '0.625rem',
    marginBottom: '1.25rem',
  },
  price: {
    fontWeight: 700,
    fontSize: '2.25rem',
    color: '#333333',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
  },
  monthly: {
    color: '#AFAFAF',
    fontWeight: 500,
    fontSize: '0.875rem',
    lineHeight: '1.1875rem',
    margin: 0,
  },
  featureList: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
    marginBottom: '1.875rem',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.875rem',
    lineHeight: '1.375rem',
    color: '#000000',
    fontWeight: 500,
    gap: '0.625rem',
  },
  greenSquare: {
    width: '1.125rem',
    height: '1.125rem',
    background: GREEN,
    borderRadius: '0.25rem',
    display: 'inline-block',
    marginRight: '0.5rem',
  },
  button: {
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    border: 'none',
    borderRadius: '0.625rem',
    padding: '0.75rem 1rem',
    minHeight: '3rem',
    width: '90%',
    cursor: 'pointer',
    boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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