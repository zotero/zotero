import React, { useState } from 'react';
import { signIn, signInWithGoogle, forgotPassword } from './auth/cognitoAuth.js';

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
    position: 'relative',
  },
  form: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '0 auto',
  },
  inputGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: '1.25rem',
  },
  label: {
    fontWeight: 400,
    fontSize: '0.875rem',
    lineHeight: '135%',
    color: '#222',
    marginBottom: '0.625rem',
    marginLeft: '0.25rem',
  },
  input: {
    width: '100%',
    minHeight: '3rem',
    borderRadius: '0.625rem',
    border: `1px solid #DADCE0`,
    padding: '0.375rem 0.5rem',
    background: PEARL,
    fontSize: '1rem',
    fontFamily: 'Roboto, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  },
  forgot: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    fontWeight: 500,
    fontSize: '0.875rem',
    textDecoration: 'underline',
    color: '#757575',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginBottom: '1.25rem',
  },
  signInButton: {
    width: '100%',
    minHeight: '2.4375rem',
    borderRadius: '0.625rem',
    padding: '0.625rem 1.25rem',
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
  },
  signInButtonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
  },
  dividerContainer: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    margin: '1.875rem 0 0',
  },
  divider: {
    flex: 1,
    height: '0.15rem',
    background: PEARL,
    border: 'none',
  },
  orText: {
    margin: '0 0.625rem',
    color: '#888',
    fontWeight: 500,
    fontSize: '1rem',
  },
  googleContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    marginTop: '1.875rem',
  },
  googleButton: {
    width: '100%',
    minHeight: '2.75rem',
    borderRadius: '0.625rem',
    border: `1px solid ${PEARL}`,
    padding: '0.625rem 1.25rem',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '1.05rem',
    color: '#222',
    cursor: 'pointer',
  },
  googleIcon: {
    width: '1.375rem',
    height: '1.375rem',
    objectFit: 'contain',
    marginRight: '0.125rem',
  },
  bottomContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '1.875rem',
  },
  bottomText: {
    fontWeight: 500,
    fontSize: '0.875rem',
    color: '#757575',
  },
  signUpLink: {
    fontWeight: 500,
    fontSize: '0.875rem',
    textDecoration: 'underline',
    color: '#757575',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginLeft: '0.25rem',
    padding: 0,
  },
  errorMessage: {
    color: '#dc3545',
    fontSize: '0.875rem',
    marginTop: '0.625rem',
    textAlign: 'center',
    width: '100%',
  },
  successMessage: {
    color: '#28a745',
    fontSize: '0.875rem',
    marginTop: '0.625rem',
    textAlign: 'center',
    width: '100%',
  },
  mainContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
};

const GoogleImg = 'chrome://zotero/content/DeepTutorMaterials/SignIn/Google.png';

export default function DeepTutorSignIn({ onSignInSignUp, onSignInSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      Zotero.debug('DeepTutor SignIn: Attempting to sign in with Cognito');
      const result = await signIn(email, password);
      
      Zotero.debug('DeepTutor SignIn: Sign in successful');
      setMessage('Login successful!');

      // Initialize empty Map for recent sessions
      const emptyMap = new Map();
      Zotero.Prefs.set('deeptutor.recentSessions', JSON.stringify(Object.fromEntries(emptyMap)));
      
      // Call the success callback after a short delay
      setTimeout(() => {
        onSignInSuccess();
      }, 1000);
      
    } catch (error) {
      Zotero.debug(`DeepTutor SignIn: Sign in failed: ${error.message}`);
      
      // Handle specific Cognito errors
      let errorMessage = 'Login failed, please try again';
      
      if (error.code === 'NotAuthorizedException') {
        errorMessage = 'Incorrect email or password';
      } else if (error.code === 'UserNotConfirmedException') {
        errorMessage = 'Please verify your email address first';
      } else if (error.code === 'UserNotFoundException') {
        errorMessage = 'User does not exist';
      } else if (error.code === 'TooManyRequestsException') {
        errorMessage = 'Too many requests, please try again later';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError('');
      setMessage('');
      
      Zotero.debug('DeepTutor SignIn: Attempting Google sign in');
      await signInWithGoogle();
      setMessage('Redirecting to Google login...');
      
    } catch (error) {
      Zotero.debug(`DeepTutor SignIn: Google sign in failed: ${error.message}`);
      setError('Google login failed, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter email address first');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setMessage('');
      
      Zotero.debug('DeepTutor SignIn: Sending forgot password email');
      await forgotPassword(email);
      setMessage('Password reset email sent, please check your email');
      
    } catch (error) {
      Zotero.debug(`DeepTutor SignIn: Forgot password failed: ${error.message}`);
      setError('Failed to send reset email, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} autoComplete="off" onSubmit={handleSignIn}>
        <div style={styles.mainContent}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="At least 8 characters to Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button 
            style={styles.forgot} 
            type="button" 
            onClick={handleForgotPassword}
            disabled={isLoading}
          >
            Forgot Your Password?
          </button>
          <button 
            style={{
              ...styles.signInButton,
              ...(isLoading ? styles.signInButtonDisabled : {})
            }}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
          
          {error && <div style={styles.errorMessage}>{error}</div>}
          {message && <div style={styles.successMessage}>{message}</div>}
        </div>
        
        <div style={styles.dividerContainer}>
          <hr style={styles.divider} />
          <span style={styles.orText}>or</span>
          <hr style={styles.divider} />
        </div>

        <div style={styles.googleContainer}>
          <button 
            style={styles.googleButton} 
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <img src={GoogleImg} alt="Google" style={styles.googleIcon} />
            Sign in with Google
          </button>
        </div>

        <div style={styles.bottomContainer}>
          <span style={styles.bottomText}>Don't have an account?</span>
          <button 
            style={styles.signUpLink} 
            type="button" 
            onClick={onSignInSignUp}
            disabled={isLoading}
          >
            Sign up here
          </button>
        </div>
      </form>
    </div>
  );
} 