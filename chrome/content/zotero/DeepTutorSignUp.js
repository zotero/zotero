import React, { useState } from 'react';

const SKY = '#0687E5';
const PEARL = '#F2F2F2';
const styles = {
  container: {
    width: '100%',
    minHeight: 480,
    background: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 0',
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
  title: {
    fontWeight: 700,
    fontSize: '1.5em',
    color: '#222',
    fontFamily: 'Roboto, sans-serif',
    marginBottom: 4,
  },
  subtitle: {
    fontWeight: 400,
    fontSize: '1.08em',
    color: '#4a4a4a',
    marginBottom: 18,
    fontFamily: 'Roboto, sans-serif',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    alignItems: 'center',
  },
  label: {
    fontWeight: 500,
    color: '#222',
    fontSize: '1em',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: 8,
    border: `1px solid #DADCE0`,
    background: PEARL,
    fontSize: '1em',
    fontFamily: 'Roboto, sans-serif',
    outline: 'none',
    marginBottom: 2,
  },
  signUpButton: {
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1em',
    border: 'none',
    borderRadius: 10,
    padding: '14px 0',
    width: '100%',
    margin: '0 auto',
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
    background: '#fff',
    border: `1.5px solid ${PEARL}`,
    borderRadius: 10,
    padding: '12px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
    textAlign: 'center',
    marginTop: 10,
    fontSize: '1em',
    color: '#888',
    fontWeight: 400,
  },
  signInLink: {
    color: SKY,
    textDecoration: 'underline',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginLeft: 4,
    fontSize: '1em',
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
      <div style={styles.iconRow}>
        <div style={styles.blueSquare}></div>
      </div>
      <div style={styles.title}>Sign up</div>
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