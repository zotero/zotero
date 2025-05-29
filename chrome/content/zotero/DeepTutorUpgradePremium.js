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
    justifyContent: 'flex-start',
    padding: '0',
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
    width: 350,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: '0 20px',
  },
  headerFrame: {
    width: 350,
    height: 85,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
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
    width: 229,
    height: 52,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
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
    width: 279,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    lineHeight: '22px',
    color: '#000000',
    fontWeight: 500,
    gap: 8,
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
    fontSize: '16px',
    border: 'none',
    borderRadius: 10,
    padding: '14px 0',
    width: 320,
    margin: '18px auto',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    display: 'block',
  },
};

export default function DeepTutorUpgradePremium() {
  return (
    <div style={styles.container}>
      <div style={styles.titleSection}>
        <div style={styles.title}>Upgrade Your Plan</div>
      </div>
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
      <button style={styles.button}>Get Premium</button>
    </div>
  );
} 