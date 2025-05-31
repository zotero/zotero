import React, { useState } from 'react';

const SKY = '#0687E5';
const PEARL = '#F2F2F2';
const styles = {
  container: {
    width: '100%',
    minHeight: '80%',
    background: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 0',
    position: 'relative',
  },
  iconRow: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    alignItems: 'center',
    marginBottom: 8,
  },
  blueSquare: {
    width: 28,
    height: 28,
    background: SKY,
    borderRadius: 6,
    marginRight: 8,
  },
  subtitle: {
    fontWeight: 400,
    fontSize: '1.08em',
    color: '#4a4a4a',
    marginBottom: '18px',
    fontFamily: 'Roboto, sans-serif',
    width: '90%',
    textAlign: 'center',
  },
  form: {
    position: 'relative',
    width: '90%',
    height: '80%',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'flex-start',
    padding: '0 8px',
  },
  label: {
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: '135%',
    letterSpacing: '0%',
    verticalAlign: 'middle',
    color: '#000000',
    marginBottom: 4,
    width: '100%',
  },
  input: {
    width: '100%',
    height: '10%',
    minHeight: '32px',
    borderRadius: 10,
    gap: 10,
    border: `1px solid #DADCE0`,
    paddingTop: 6,
    paddingRight: 8,
    paddingBottom: 6,
    paddingLeft: 8,
    background: PEARL,
    fontSize: '1em',
    fontFamily: 'Roboto, sans-serif',
    outline: 'none',
    marginBottom: 2,
  },
  signUpButton: {
    width: '100%',
    height: '10%',
    minHeight: '32px',
    borderRadius: 10,
    paddingTop: 6,
    paddingRight: 8,
    paddingBottom: 6,
    paddingLeft: 8,
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    display: 'block',
    marginTop: 8,
  },
  dividerRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    margin: '18px 0 10px 0',
  },
  divider: {
    flex: 1,
    height: 1,
    background: PEARL,
    border: 'none',
  },
  orText: {
    margin: '0 12px',
    color: '#888',
    fontWeight: 500,
    fontSize: '1em',
  },
  googleButton: {
    width: '100%',
    height: '10%',
    minHeight: '32px',
    borderRadius: 10,
    gap: 10,
    border: `1px solid ${PEARL}`,
    paddingTop: 6,
    paddingRight: 8,
    paddingBottom: 6,
    paddingLeft: 8,
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '1.05em',
    color: '#222',
    cursor: 'pointer',
    marginBottom: 8,
    marginTop: 0,
  },
  googleIcon: {
    width: 22,
    height: 22,
    objectFit: 'contain',
    marginRight: 2,
  },
  bottomRow: {
    width: '100%',
    fontWeight: 500,
    fontSize: '14px',
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    verticalAlign: 'middle',
    color: '#888',
    marginTop: 10,
  },
  signInLink: {
    fontWeight: 500,
    fontSize: '14px',
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    verticalAlign: 'middle',
    textDecoration: 'underline',
    textDecorationStyle: 'solid',
    textDecorationOffset: '0%',
    textDecorationThickness: '0%',
    textDecorationSkipInk: 'auto',
    color: SKY,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginLeft: 4,
    padding: 0,
  },
};

const GoogleImg = 'chrome://zotero/content/DeepTutorMaterials/SignIn/Google.png';

export default function DeepTutorSignUp({ onSignUpSignIn }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div style={styles.container}>
      <div style={styles.subtitle}>Create a free account and start to create your unique learning experience</div>
      <form style={styles.form} autoComplete="off">
        <label style={styles.label}>Your name</label>
        <input
          style={styles.input}
          type="text"
          placeholder=""
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <label style={styles.label}>Email address</label>
        <input
          style={styles.input}
          type="email"
          placeholder="example@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <label style={styles.label}>Create your password</label>
        <input
          style={styles.input}
          type="password"
          placeholder="Must be at least 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button style={styles.signUpButton} type="button">Sign up for free</button>
        <div style={styles.dividerRow}>
          <hr style={styles.divider} />
          <span style={styles.orText}>Or</span>
          <hr style={styles.divider} />
        </div>
        <button style={styles.googleButton} type="button">
          <img src={GoogleImg} alt="Google" style={styles.googleIcon} />
          Sign up with Google
        </button>
        <div style={styles.bottomRow}>
          Already have an account?
          <button style={styles.signInLink} type="button" onClick={onSignUpSignIn}>Sign in</button>
        </div>
      </form>
    </div>
  );
} 