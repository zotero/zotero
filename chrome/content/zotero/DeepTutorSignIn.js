import React, { useState } from 'react';

const AQUA = '#0AE2FF';
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
    padding: '16px 0 16px 0px',
    position: 'relative',
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
    color: '#222',
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
  forgot: {
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
    alignSelf: 'flex-end',
    marginBottom: 8,
    marginTop: -8,
    padding: 0,
  },
  signInButton: {
    width: '100%',
    height: '10%',
    minHeight: '39px',
    borderRadius: 10,
    paddingTop: 10,
    paddingRight: 20,
    paddingBottom: 10,
    paddingLeft: 20,
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
    minHeight: '44px',
    borderRadius: 10,
    gap: 10,
    border: `1px solid ${PEARL}`,
    paddingTop: 10,
    paddingRight: 20,
    paddingBottom: 10,
    paddingLeft: 20,
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
  signUpLink: {
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

export default function DeepTutorSignIn({ onSignInSignUp, onSignInSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      // Here you would typically make an API call to authenticate
      // For now, we'll just simulate a successful sign-in
      if (email && password) {
        // Call the success callback
        onSignInSuccess();
      }
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} autoComplete="off" onSubmit={handleSignIn}>
        <label style={styles.label}>Email address</label>
        <input
          style={styles.input}
          type="email"
          placeholder="example@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          placeholder="Must be at least 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button style={styles.forgot} type="button">Forgot your password?</button>
        <button 
          style={styles.signInButton} 
          type="submit"
          onClick={handleSignIn}
        >Sign in</button>
        <div style={styles.dividerRow}>
          <hr style={styles.divider} />
          <span style={styles.orText}>or</span>
          <hr style={styles.divider} />
        </div>
        <button style={styles.googleButton} type="button">
          <img src={GoogleImg} alt="Google" style={styles.googleIcon} />
          Sign in with Google
        </button>
        <div style={styles.bottomRow}>
          Don't have an account?
          <button style={styles.signUpLink} type="button" onClick={onSignInSignUp}>Sign up here</button>
        </div>
      </form>
    </div>
  );
} 